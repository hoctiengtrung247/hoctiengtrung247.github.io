// Học Tiếng Trung 247 — app logic
// Globals from other scripts:
//   - window.data (data.js): { days: [{ id, hsk, theme, themeZh, cards: [...] }] }

(function () {
  const STORAGE_KEY = "htt247:state";

  const defaultState = {
    currentDay: 1,
    currentCardIndex: 0,
    ratings: {}, // key: `${dayId}-${cardIdx}` → "easy" | "medium" | "hard"
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

  // ---------- DOM ----------
  const $ = (id) => document.getElementById(id);
  const els = {
    statEasy: $("stat-easy"),
    statMedium: $("stat-medium"),
    statHard: $("stat-hard"),
    dayLabel: $("day-label"),
    dayThemeZh: $("day-theme-zh"),
    dayThemeVi: $("day-theme-vi"),
    topicName: $("topic-name"),
    cardProgress: $("card-progress"),
    dayPrev: $("day-prev"),
    dayNext: $("day-next"),
    openPicker: $("open-picker"),
    flashcard: $("flashcard"),
    frontType: $("front-type"),
    frontWord: $("front-word"),
    frontPinyin: $("front-pinyin"),
    backType: $("back-type"),
    backWord: $("back-word"),
    backPinyin: $("back-pinyin"),
    backMeaning: $("back-meaning"),
    exampleZh: $("example-zh"),
    examplePinyin: $("example-pinyin"),
    exampleVi: $("example-vi"),
    cardPrev: $("card-prev"),
    cardNext: $("card-next"),
    emptyState: $("empty-state"),
    picker: $("picker"),
    pickerOverlay: $("picker-overlay"),
    pickerClose: $("picker-close"),
    pickerGrid: $("picker-grid"),
  };

  // ---------- Helpers ----------
  function currentDayData() {
    return data.days[state.currentDay - 1];
  }
  function currentCard() {
    const d = currentDayData();
    if (!d || !d.cards.length) return null;
    return d.cards[state.currentCardIndex] || null;
  }
  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    }[c]));
  }
  function highlightWord(sentence, word) {
    if (!word) return escapeHtml(sentence);
    const escSent = escapeHtml(sentence);
    const escWord = escapeHtml(word);
    return escSent.split(escWord).join(`<span class="text-brand-red font-semibold">${escWord}</span>`);
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

  // ---------- Renderers ----------
  function renderHeader() {
    let easy = 0, medium = 0, hard = 0;
    for (const v of Object.values(state.ratings)) {
      if (v === "easy") easy++;
      else if (v === "medium") medium++;
      else if (v === "hard") hard++;
    }
    els.statEasy.textContent = easy;
    els.statMedium.textContent = medium;
    els.statHard.textContent = hard;
  }

  function renderDayInfo() {
    const d = currentDayData();
    els.dayLabel.textContent = `Ngày ${d.id} /`;
    els.dayThemeZh.textContent = d.themeZh || "—";
    els.dayThemeVi.textContent = d.theme || "Chưa cập nhật";
    els.topicName.textContent = d.theme || "—";
    const total = d.cards.length;
    const shown = total ? Math.min(state.currentCardIndex + 1, total) : 0;
    els.cardProgress.textContent = `${shown} / ${total || 10}`;
  }

  function renderCard() {
    // Reset flip when changing card
    els.flashcard.classList.remove("is-flipped");

    const card = currentCard();
    if (!card) {
      els.flashcard.style.visibility = "hidden";
      els.emptyState.classList.remove("hidden");
      return;
    }
    els.flashcard.style.visibility = "visible";
    els.emptyState.classList.add("hidden");

    // Front
    els.frontType.textContent = card.type || "từ";
    els.frontWord.textContent = card.word;
    els.frontPinyin.textContent = card.pinyin;

    // Back
    els.backType.textContent = card.type || "từ";
    els.backWord.textContent = card.word;
    els.backPinyin.textContent = card.pinyin;
    els.backMeaning.textContent = card.meaning;

    if (card.example) {
      els.exampleZh.innerHTML = highlightWord(card.example.zh, card.word);
      els.examplePinyin.textContent = card.example.pinyin;
      els.exampleVi.textContent = card.example.vi;
    } else {
      els.exampleZh.textContent = "";
      els.examplePinyin.textContent = "";
      els.exampleVi.textContent = "";
    }

    // add subtle fade-in
    const inner = els.flashcard.querySelector(".card-inner");
    inner.classList.remove("fade-in");
    void inner.offsetWidth;
    inner.classList.add("fade-in");
  }

  function renderAll() {
    renderHeader();
    renderDayInfo();
    renderCard();
  }

  // ---------- Actions ----------
  function flipCard() {
    if (!currentCard()) return;
    els.flashcard.classList.toggle("is-flipped");
  }
  function goPrev() {
    if (state.currentCardIndex > 0) {
      state.currentCardIndex--;
      saveState();
      renderDayInfo();
      renderCard();
    }
  }
  function goNext() {
    const d = currentDayData();
    if (!d.cards.length) return;
    if (state.currentCardIndex < d.cards.length - 1) {
      state.currentCardIndex++;
      saveState();
      renderDayInfo();
      renderCard();
    }
  }
  function rateCard(level) {
    if (!currentCard()) return;
    const key = `${state.currentDay}-${state.currentCardIndex}`;
    state.ratings[key] = level;
    saveState();
    renderHeader();
    // small delay so flip animation does not collide
    setTimeout(goNext, 180);
  }
  function setDay(n) {
    if (n < 1 || n > data.days.length) return;
    state.currentDay = n;
    state.currentCardIndex = 0;
    saveState();
    renderAll();
  }
  function dayPrevAction() { setDay(state.currentDay - 1); }
  function dayNextAction() { setDay(state.currentDay + 1); }

  // ---------- Modal ----------
  function buildPickerGrid() {
    const groups = [
      { hsk: 1, label: "1-3 nét", range: [1, 6] },
      { hsk: 2, label: "4-5 nét", range: [7, 12] },
      { hsk: 3, label: "6+ nét", range: [13, data.days.length] },
    ];
    els.pickerGrid.innerHTML = groups.map((g) => {
      const cells = [];
      for (let i = g.range[0]; i <= g.range[1]; i++) {
        const d = data.days[i - 1];
        const isCurrent = i === state.currentDay;
        const isEmpty = !d.cards.length;
        cells.push(`<button class="day-cell ${isCurrent ? "is-current" : ""} ${isEmpty ? "is-empty" : ""}" data-day="${i}">${i}</button>`);
      }
      return `
        <div>
          <div class="flex items-baseline justify-between mb-3">
            <div class="text-brand-red text-xs tracking-[0.18em] uppercase font-semibold">${g.label}</div>
            <div class="text-xs text-dim">Ngày ${g.range[0]}–${g.range[1]}</div>
          </div>
          <div class="grid grid-cols-10 gap-2">${cells.join("")}</div>
        </div>`;
    }).join("");

    els.pickerGrid.querySelectorAll(".day-cell").forEach((btn) => {
      btn.addEventListener("click", () => {
        const n = Number(btn.dataset.day);
        setDay(n);
        closePicker();
      });
    });
  }
  function openPicker() {
    buildPickerGrid();
    els.picker.classList.remove("modal-hidden");
  }
  function closePicker() {
    els.picker.classList.add("modal-hidden");
  }

  // ---------- Bindings ----------
  function bindEvents() {
    // card flip on click (front + back faces)
    els.flashcard.querySelectorAll(".card-face").forEach((face) => {
      face.addEventListener("click", (e) => {
        if (e.target.closest(".speaker")) return; // don't flip when clicking speaker
        flipCard();
      });
    });

    // speakers
    document.querySelectorAll(".speaker").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const targetId = btn.dataset.target;
        const el = document.getElementById(targetId);
        if (el) speak(el.textContent.trim());
      });
    });

    // card nav
    els.cardPrev.addEventListener("click", goPrev);
    els.cardNext.addEventListener("click", goNext);

    // day nav
    els.dayPrev.addEventListener("click", dayPrevAction);
    els.dayNext.addEventListener("click", dayNextAction);

    // open / close modal
    els.openPicker.addEventListener("click", openPicker);
    els.pickerClose.addEventListener("click", closePicker);
    els.pickerOverlay.addEventListener("click", closePicker);

    // rating
    document.querySelectorAll(".rate-btn").forEach((btn) => {
      btn.addEventListener("click", () => rateCard(btn.dataset.level));
    });

    // keyboard
    document.addEventListener("keydown", (e) => {
      // Don't intercept when typing
      if (["INPUT", "TEXTAREA"].includes(document.activeElement?.tagName)) return;

      if (!els.picker.classList.contains("modal-hidden")) {
        if (e.key === "Escape") { e.preventDefault(); closePicker(); }
        return;
      }

      switch (e.key) {
        case " ":
        case "Spacebar":
          e.preventDefault();
          flipCard();
          break;
        case "ArrowLeft":
          e.preventDefault(); goPrev(); break;
        case "ArrowRight":
          e.preventDefault(); goNext(); break;
        case "1":
          e.preventDefault(); rateCard("hard"); break;
        case "2":
          e.preventDefault(); rateCard("medium"); break;
        case "3":
          e.preventDefault(); rateCard("easy"); break;
        case "Escape":
          // no-op when no modal
          break;
      }
    });
  }

  // ---------- Init ----------
  function init() {
    // clamp state
    if (state.currentDay < 1 || state.currentDay > data.days.length) state.currentDay = 1;
    const d = currentDayData();
    if (!d.cards.length) state.currentCardIndex = 0;
    else if (state.currentCardIndex >= d.cards.length) state.currentCardIndex = 0;

    bindEvents();
    renderAll();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
