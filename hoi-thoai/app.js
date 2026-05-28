// Hội thoại — app logic
// Globals: window.dialogueBooks (data.js, data-b2.js, data-b3.js, data-b4.js)
//   = [{ id, shortName, name, lessons: [...] }, ...]

(function () {
  const STORAGE_KEY = "htt247:hoi-thoai:state";

  const defaultState = {
    currentLessonIdx: 0,
    completed: {},   // { lessonId: true }
    hidePinyin: false,
    hideVi: false,
  };

  function loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return { ...defaultState };
      const parsed = JSON.parse(raw);
      return { ...defaultState, ...parsed };
    } catch {
      return { ...defaultState };
    }
  }
  function saveState() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch {}
  }

  const state = loadState();

  // Gộp tất cả lessons từ các giáo trình thành mảng phẳng,
  // mỗi lesson có thêm bookId / bookShortName / bookName / bookIdx để hiển thị.
  const books = window.dialogueBooks || [];
  const lessons = [];
  books.forEach((book, bookIdx) => {
    book.lessons.forEach((l) => {
      lessons.push({ ...l, bookId: book.id, bookShortName: book.shortName, bookName: book.name, bookIdx });
    });
  });

  // pickerActiveBookIdx — chỉ phục vụ UI picker (không persist)
  let pickerActiveBookIdx = 0;

  // ---------- DOM ----------
  const $ = (id) => document.getElementById(id);
  const els = {
    statCompleted: $("stat-completed"),
    statTotal: $("stat-total"),
    lessonLabel: $("lesson-label"),
    lessonTitleZh: $("lesson-title-zh"),
    lessonTitleVi: $("lesson-title-vi"),
    exchangeCount: $("exchange-count"),
    lessonPrev: $("lesson-prev"),
    lessonNext: $("lesson-next"),
    openPicker: $("open-picker"),
    exchanges: $("exchanges"),
    emptyState: $("empty-state"),
    playAll: $("play-all"),
    playAllIconPlay: $("play-all-icon-play"),
    playAllIconStop: $("play-all-icon-stop"),
    playAllLabel: $("play-all-label"),
    togglePinyin: $("toggle-pinyin"),
    toggleVi: $("toggle-vi"),
    chipPinyin: $("chip-pinyin"),
    chipVi: $("chip-vi"),
    bottomPrev: $("bottom-prev"),
    bottomNext: $("bottom-next"),
    bottomDone: $("bottom-done"),
    bottomDoneLabel: $("bottom-done-label"),
    picker: $("picker"),
    pickerOverlay: $("picker-overlay"),
    pickerClose: $("picker-close"),
    pickerGrid: $("picker-grid"),
    pickerTabs: $("picker-tabs"),
  };

  // ---------- Helpers ----------
  function currentLesson() {
    return lessons[state.currentLessonIdx] || null;
  }
  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    }[c]));
  }

  // ---------- Speech ----------
  function speak(text) {
    if (!("speechSynthesis" in window) || !text) return;
    try {
      window.speechSynthesis.cancel();
      const utt = new SpeechSynthesisUtterance(text);
      utt.lang = "zh-CN";
      utt.rate = 0.85;
      utt.pitch = 1;
      window.speechSynthesis.speak(utt);
    } catch {}
  }

  function speakAndWait(text) {
    return new Promise((resolve) => {
      if (!("speechSynthesis" in window) || !text) { resolve(); return; }
      try {
        window.speechSynthesis.cancel();
        const utt = new SpeechSynthesisUtterance(text);
        utt.lang = "zh-CN";
        utt.rate = 0.85;
        utt.pitch = 1;
        let done = false;
        utt.onend = () => { if (!done) { done = true; resolve(); } };
        utt.onerror = () => { if (!done) { done = true; resolve(); } };
        window.speechSynthesis.speak(utt);
        // Safety fallback nếu onend không bao giờ trigger
        setTimeout(() => { if (!done) { done = true; resolve(); } }, 15000);
      } catch { resolve(); }
    });
  }

  // ---------- IndexedDB (recordings) ----------
  const DB_NAME = "htt247-recordings-hoi-thoai";
  const DB_VERSION = 1;
  const DB_STORE = "recordings";
  let _dbPromise = null;

  function openRecDB() {
    if (_dbPromise) return _dbPromise;
    _dbPromise = new Promise((resolve, reject) => {
      if (!("indexedDB" in window)) { reject(new Error("IndexedDB not supported")); return; }
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(DB_STORE)) {
          db.createObjectStore(DB_STORE, { keyPath: "id" });
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    return _dbPromise;
  }

  async function putRecording(id, blob, mimeType) {
    const db = await openRecDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(DB_STORE, "readwrite");
      tx.objectStore(DB_STORE).put({ id, blob, mimeType, createdAt: Date.now() });
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async function getRecording(id) {
    const db = await openRecDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(DB_STORE, "readonly");
      const req = tx.objectStore(DB_STORE).get(id);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });
  }

  function recordingId(lessonId, idx) {
    return `${lessonId}-${idx}`;
  }

  // ---------- MediaRecorder ----------
  let activeRecorder = null;
  let sharedStream = null;

  async function getMicStream() {
    if (sharedStream && sharedStream.getTracks().some((t) => t.readyState === "live")) {
      return sharedStream;
    }
    sharedStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    return sharedStream;
  }

  function setRecButtonState(slot, recording) {
    document.querySelectorAll(`.rec-btn[data-slot="${slot}"]`).forEach((btn) => {
      btn.classList.toggle("is-recording", recording);
      const mic = btn.querySelector(".rec-icon-mic");
      const stop = btn.querySelector(".rec-icon-stop");
      if (mic) mic.classList.toggle("hidden", recording);
      if (stop) stop.classList.toggle("hidden", !recording);
      btn.title = recording ? "Dừng thu" : "Thu âm câu này";
    });
  }

  function setPlayButtonVisible(slot, visible) {
    document.querySelectorAll(`.play-rec-btn[data-slot="${slot}"]`).forEach((btn) => {
      btn.classList.toggle("hidden", !visible);
    });
  }

  async function refreshRecButtons() {
    const lesson = currentLesson();
    if (!lesson) return;
    for (let i = 0; i < lesson.exchanges.length; i++) {
      try {
        const rec = await getRecording(recordingId(lesson.id, i));
        setPlayButtonVisible(String(i), !!rec);
      } catch {
        setPlayButtonVisible(String(i), false);
      }
    }
  }

  function pickRecorderMime() {
    if (!window.MediaRecorder || !MediaRecorder.isTypeSupported) return "";
    const candidates = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg;codecs=opus"];
    for (const c of candidates) {
      if (MediaRecorder.isTypeSupported(c)) return c;
    }
    return "";
  }

  async function startRecording(slot) {
    if (!navigator.mediaDevices || !window.MediaRecorder) {
      alert("Trình duyệt không hỗ trợ thu âm.");
      return;
    }
    if (activeRecorder) {
      await stopRecording();
    }
    let stream;
    try {
      stream = await getMicStream();
    } catch (err) {
      alert("Cần cấp quyền truy cập micro để thu âm.");
      return;
    }
    const mimeType = pickRecorderMime();
    const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
    const chunks = [];
    recorder.ondataavailable = (e) => { if (e.data && e.data.size) chunks.push(e.data); };
    const lessonId = currentLesson().id;
    const idx = Number(slot);
    const savedPromise = new Promise((resolve) => {
      recorder.onstop = async () => {
        try {
          const type = recorder.mimeType || "audio/webm";
          const blob = new Blob(chunks, { type });
          await putRecording(recordingId(lessonId, idx), blob, type);
        } catch (err) {
          console.error("Lưu bản thu thất bại:", err);
        } finally {
          if (currentLesson() && currentLesson().id === lessonId) {
            setPlayButtonVisible(slot, true);
          }
          resolve();
        }
      };
    });
    activeRecorder = { recorder, slot, lessonId, idx, savedPromise };
    setRecButtonState(slot, true);
    recorder.start();
  }

  async function stopRecording() {
    if (!activeRecorder) return;
    const { recorder, slot, savedPromise } = activeRecorder;
    activeRecorder = null;
    setRecButtonState(slot, false);
    if (recorder.state !== "inactive") {
      try { recorder.stop(); } catch {}
    }
    await savedPromise;
  }

  // ---------- Playback (bản thu của user) ----------
  let activePlayback = null;

  function setPlayBtnState(slot, isPlaying) {
    document.querySelectorAll(`.play-rec-btn[data-slot="${slot}"]`).forEach((btn) => {
      btn.classList.toggle("is-playing", isPlaying);
      const p = btn.querySelector(".play-icon-play");
      const ps = btn.querySelector(".play-icon-pause");
      if (p) p.classList.toggle("hidden", isPlaying);
      if (ps) ps.classList.toggle("hidden", !isPlaying);
      btn.title = isPlaying ? "Tạm dừng" : "Nghe lại bản thu";
    });
  }

  function stopPlayback() {
    if (!activePlayback) return;
    const { audio, slot, url } = activePlayback;
    activePlayback = null;
    try { audio.pause(); } catch {}
    try { URL.revokeObjectURL(url); } catch {}
    setPlayBtnState(slot, false);
  }

  async function playRecording(slot) {
    if (activePlayback && activePlayback.slot === slot) {
      const a = activePlayback.audio;
      if (a.paused) {
        try { await a.play(); setPlayBtnState(slot, true); }
        catch { stopPlayback(); }
      } else {
        a.pause();
        setPlayBtnState(slot, false);
      }
      return;
    }
    if (activePlayback) stopPlayback();

    const lesson = currentLesson();
    if (!lesson) return;
    const id = recordingId(lesson.id, Number(slot));
    let rec;
    try { rec = await getRecording(id); } catch { rec = null; }
    if (!rec || !rec.blob) return;
    const url = URL.createObjectURL(rec.blob);
    const audio = new Audio(url);
    activePlayback = { audio, slot, url };
    setPlayBtnState(slot, true);
    const cleanup = () => { if (activePlayback && activePlayback.audio === audio) stopPlayback(); };
    audio.onended = cleanup;
    audio.onerror = cleanup;
    try { await audio.play(); } catch { cleanup(); }
  }

  // ---------- Autoplay đoạn hội thoại ----------
  let autoPlayState = { running: false, cancelled: false };

  function setPlayAllUI(running) {
    els.playAll.classList.toggle("is-playing", running);
    els.playAllIconPlay.classList.toggle("hidden", running);
    els.playAllIconStop.classList.toggle("hidden", !running);
    els.playAllLabel.textContent = running ? "Dừng" : "Phát cả đoạn";
  }

  function highlightExchange(idx) {
    els.exchanges.querySelectorAll(".bubble").forEach((b) => b.classList.remove("is-active"));
    if (idx >= 0) {
      const bubble = els.exchanges.querySelector(`.bubble[data-idx="${idx}"]`);
      if (bubble) {
        bubble.classList.add("is-active");
        bubble.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    }
  }

  function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

  async function playAllExchanges() {
    if (autoPlayState.running) {
      autoPlayState.cancelled = true;
      autoPlayState.running = false;
      try { window.speechSynthesis.cancel(); } catch {}
      setPlayAllUI(false);
      highlightExchange(-1);
      return;
    }
    const lesson = currentLesson();
    if (!lesson || !lesson.exchanges.length) return;

    autoPlayState = { running: true, cancelled: false };
    setPlayAllUI(true);
    for (let i = 0; i < lesson.exchanges.length; i++) {
      if (autoPlayState.cancelled) break;
      highlightExchange(i);
      await speakAndWait(lesson.exchanges[i].zh);
      if (autoPlayState.cancelled) break;
      await sleep(350);
    }
    autoPlayState.running = false;
    setPlayAllUI(false);
    highlightExchange(-1);
  }

  function cancelAutoPlay() {
    if (autoPlayState.running) {
      autoPlayState.cancelled = true;
      autoPlayState.running = false;
      try { window.speechSynthesis.cancel(); } catch {}
      setPlayAllUI(false);
      highlightExchange(-1);
    }
  }

  // ---------- Renderers ----------
  function renderHeader() {
    const completed = Object.values(state.completed).filter(Boolean).length;
    els.statCompleted.textContent = completed;
    els.statTotal.textContent = lessons.length;
  }

  function renderLessonInfo() {
    const lesson = currentLesson();
    if (!lesson) return;
    els.lessonLabel.textContent = `${lesson.bookShortName} · Bài ${lesson.baiNumber} · ${lesson.partLabel}`;
    els.lessonTitleZh.textContent = lesson.baiTitleZh;
    els.lessonTitleVi.textContent = lesson.baiTitleVi;
    els.exchangeCount.textContent = `${lesson.exchanges.length} câu`;
    const isDone = !!state.completed[lesson.id];
    els.bottomDone.classList.toggle("is-done", isDone);
    els.bottomDoneLabel.textContent = isDone ? "Đã học ✓" : "Đánh dấu đã học";
  }

  function micSvg() {
    return `<svg class="rec-icon-mic" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="2" width="6" height="12" rx="3"/><path d="M5 11a7 7 0 0 0 14 0"/><line x1="12" y1="18" x2="12" y2="22"/></svg>
      <svg class="rec-icon-stop hidden" width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="6" width="12" height="12" rx="2"/></svg>`;
  }
  function speakerSvg() {
    return `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/></svg>`;
  }
  function playSvg() {
    return `<svg class="play-icon-play" width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><polygon points="6 4 20 12 6 20 6 4"/></svg>
      <svg class="play-icon-pause hidden" width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/></svg>`;
  }

  function renderExchanges() {
    const lesson = currentLesson();
    if (!lesson || !lesson.exchanges.length) {
      els.exchanges.innerHTML = "";
      els.emptyState.classList.remove("hidden");
      return;
    }
    els.emptyState.classList.add("hidden");

    const firstRole = lesson.exchanges[0].role;
    const html = lesson.exchanges.map((ex, i) => {
      const isRight = ex.role === firstRole;
      const side = isRight ? "right" : "left";
      return `
        <div class="bubble-row row-${side}">
          <div class="bubble bubble-${side}" data-idx="${i}">
            <div class="role-tag font-cjk">${escapeHtml(ex.role)}</div>
            <div class="ex-zh">${escapeHtml(ex.zh)}</div>
            <div class="ex-pinyin">${escapeHtml(ex.pinyin)}</div>
            <div class="ex-vi">${escapeHtml(ex.vi)}</div>
            <div class="actions">
              <button class="speaker" data-idx="${i}" title="Phát âm câu này">${speakerSvg()}</button>
              <button class="rec-btn" data-slot="${i}" title="Thu âm câu này">${micSvg()}</button>
              <button class="play-rec-btn hidden" data-slot="${i}" title="Nghe lại bản thu">${playSvg()}</button>
            </div>
          </div>
        </div>`;
    }).join("");

    els.exchanges.innerHTML = html;
    els.exchanges.classList.remove("fade-in");
    void els.exchanges.offsetWidth;
    els.exchanges.classList.add("fade-in");

    bindBubbleEvents();
    refreshRecButtons();
  }

  function renderAll() {
    renderHeader();
    renderLessonInfo();
    renderExchanges();
    applyToggleClasses();
  }

  // ---------- Toggles ----------
  function applyToggleClasses() {
    document.body.classList.toggle("hide-pinyin", state.hidePinyin);
    document.body.classList.toggle("hide-vi", state.hideVi);
    els.togglePinyin.checked = !state.hidePinyin;
    els.toggleVi.checked = !state.hideVi;
    els.chipPinyin.classList.toggle("is-off", state.hidePinyin);
    els.chipVi.classList.toggle("is-off", state.hideVi);
  }

  // ---------- Actions ----------
  async function leaveCurrentLesson() {
    cancelAutoPlay();
    stopPlayback();
    if (activeRecorder) await stopRecording();
  }

  async function setLesson(idx) {
    if (idx < 0 || idx >= lessons.length) return;
    await leaveCurrentLesson();
    state.currentLessonIdx = idx;
    saveState();
    renderAll();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function toggleDone() {
    const lesson = currentLesson();
    if (!lesson) return;
    state.completed[lesson.id] = !state.completed[lesson.id];
    saveState();
    renderHeader();
    renderLessonInfo();
  }

  // ---------- Modal ----------
  function buildPickerTabs() {
    const tabsHtml = books.map((book, idx) => {
      const isActive = idx === pickerActiveBookIdx;
      return `<button class="lesson-cell ${isActive ? "is-current" : ""}" data-book-idx="${idx}" style="width:auto;padding:6px 14px;">
        <span class="font-semibold">${escapeHtml(book.shortName)}</span>
      </button>`;
    }).join("");
    els.pickerTabs.innerHTML = tabsHtml;
    els.pickerTabs.querySelectorAll("[data-book-idx]").forEach((btn) => {
      btn.addEventListener("click", () => {
        pickerActiveBookIdx = Number(btn.dataset.bookIdx);
        buildPickerTabs();
        buildPickerGrid();
      });
    });
  }

  function buildPickerGrid() {
    // Chỉ hiển thị lessons của book đang chọn ở tab
    const book = books[pickerActiveBookIdx];
    if (!book) { els.pickerGrid.innerHTML = ""; return; }

    // Nhóm theo baiNumber trong book này
    const groups = {};
    lessons.forEach((l, idx) => {
      if (l.bookIdx !== pickerActiveBookIdx) return;
      if (!groups[l.baiNumber]) {
        groups[l.baiNumber] = { baiNumber: l.baiNumber, titleZh: l.baiTitleZh, titleVi: l.baiTitleVi, items: [] };
      }
      groups[l.baiNumber].items.push({ lesson: l, idx });
    });

    const html = Object.values(groups).map((g) => {
      const cells = g.items.map(({ lesson, idx }) => {
        const isCurrent = idx === state.currentLessonIdx;
        const isDone = !!state.completed[lesson.id];
        const doneMark = isDone ? '<span class="text-ok">✓</span>' : '';
        return `<button class="lesson-cell ${isCurrent ? "is-current" : ""}" data-idx="${idx}">
          <span class="flex items-center gap-2">
            <span class="part-tag">${escapeHtml(lesson.partLabel)}</span>
            ${doneMark}
          </span>
          <span class="text-xs text-dim tabular-nums">${lesson.exchanges.length} câu</span>
        </button>`;
      }).join("");

      return `
        <div>
          <div class="flex items-baseline justify-between mb-3">
            <div class="text-brand-red text-xs tracking-[0.18em] uppercase font-semibold">Bài ${g.baiNumber}</div>
            <div class="text-xs text-dim">
              <span class="font-cjk text-neutral-300">${escapeHtml(g.titleZh)}</span>
              <span class="mx-1">·</span>
              <span>${escapeHtml(g.titleVi)}</span>
            </div>
          </div>
          <div class="grid sm:grid-cols-2 gap-2">${cells}</div>
        </div>`;
    }).join("");

    els.pickerGrid.innerHTML = html;
    els.pickerGrid.querySelectorAll(".lesson-cell").forEach((btn) => {
      btn.addEventListener("click", () => {
        const n = Number(btn.dataset.idx);
        setLesson(n);
        closePicker();
      });
    });
  }
  function openPicker() {
    // Mặc định mở tab khớp với bài đang học
    const cur = currentLesson();
    pickerActiveBookIdx = cur ? cur.bookIdx : 0;
    buildPickerTabs();
    buildPickerGrid();
    els.picker.classList.remove("modal-hidden");
  }
  function closePicker() {
    els.picker.classList.add("modal-hidden");
  }

  // ---------- Bindings ----------
  function bindBubbleEvents() {
    els.exchanges.querySelectorAll(".speaker").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        cancelAutoPlay();
        const idx = Number(btn.dataset.idx);
        const lesson = currentLesson();
        if (lesson && lesson.exchanges[idx]) speak(lesson.exchanges[idx].zh);
      });
    });
    els.exchanges.querySelectorAll(".rec-btn").forEach((btn) => {
      btn.addEventListener("click", async (e) => {
        e.stopPropagation();
        cancelAutoPlay();
        const slot = btn.dataset.slot;
        if (activeRecorder && activeRecorder.slot === slot) {
          await stopRecording();
        } else {
          await startRecording(slot);
        }
      });
    });
    els.exchanges.querySelectorAll(".play-rec-btn").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        cancelAutoPlay();
        const slot = btn.dataset.slot;
        playRecording(slot);
      });
    });
  }

  function bindGlobalEvents() {
    els.lessonPrev.addEventListener("click", () => setLesson(state.currentLessonIdx - 1));
    els.lessonNext.addEventListener("click", () => setLesson(state.currentLessonIdx + 1));
    els.bottomPrev.addEventListener("click", () => setLesson(state.currentLessonIdx - 1));
    els.bottomNext.addEventListener("click", () => setLesson(state.currentLessonIdx + 1));
    els.bottomDone.addEventListener("click", toggleDone);

    els.openPicker.addEventListener("click", openPicker);
    els.pickerOverlay.addEventListener("click", closePicker);
    els.pickerClose.addEventListener("click", closePicker);

    els.playAll.addEventListener("click", playAllExchanges);

    els.togglePinyin.addEventListener("change", (e) => {
      state.hidePinyin = !e.target.checked;
      saveState();
      applyToggleClasses();
    });
    els.toggleVi.addEventListener("change", (e) => {
      state.hideVi = !e.target.checked;
      saveState();
      applyToggleClasses();
    });

    document.addEventListener("keydown", (e) => {
      // Bỏ qua khi đang gõ vào input
      if (e.target && (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA")) return;
      if (!els.picker.classList.contains("modal-hidden") && e.key === "Escape") {
        closePicker(); return;
      }
      if (e.key === "ArrowLeft") { setLesson(state.currentLessonIdx - 1); }
      else if (e.key === "ArrowRight") { setLesson(state.currentLessonIdx + 1); }
      else if (e.key === " ") { e.preventDefault(); playAllExchanges(); }
      else if (e.key.toLowerCase() === "p") { setLesson(state.currentLessonIdx - 1); }
      else if (e.key.toLowerCase() === "n") { setLesson(state.currentLessonIdx + 1); }
    });
  }

  // ---------- Init ----------
  function init() {
    if (state.currentLessonIdx >= lessons.length) state.currentLessonIdx = 0;
    bindGlobalEvents();
    renderAll();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
