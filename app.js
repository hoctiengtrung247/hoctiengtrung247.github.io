/* ============================================================
   App: Học từ vựng tiếng Anh - Claude Builder
   Dữ liệu: window.VOCAB_DATA (load từ vocabulary.js)
   Lưu tiến độ: localStorage key 'claude-vocab-progress-v1'
   ============================================================ */

const STORAGE_KEY = 'claude-vocab-progress-v1';
const DATA = window.VOCAB_DATA;
const WORDS = DATA.words;
const TOPICS = DATA.topics;
const TOPICS_BY_ID = Object.fromEntries(TOPICS.map(t => [t.id, t]));
const WORDS_BY_ID = Object.fromEntries(WORDS.map(w => [w.id, w]));

/* ------------------ State ------------------ */
function defaultState() {
  return {
    perDay: 7,
    lastStudyDate: null,
    streak: 0,
    words: {} // id -> { box, nextReview, reps, mastered }
  };
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultState();
    return { ...defaultState(), ...JSON.parse(raw) };
  } catch (e) {
    return defaultState();
  }
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

let state = loadState();

/* ------------------ Date helpers ------------------ */
function todayStr() {
  const d = new Date();
  return d.toISOString().slice(0, 10);
}
function addDaysStr(days) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}
function daysBetween(a, b) {
  const da = new Date(a + 'T00:00:00');
  const db = new Date(b + 'T00:00:00');
  return Math.round((db - da) / 86400000);
}

/* ------------------ SRS (Leitner) ------------------ */
function reviewIntervalDays(box) {
  // box 1 -> 1 day, box 2 -> 2, box 3 -> 4, box 4 -> 8, box 5 -> 16
  return Math.max(1, Math.pow(2, box - 1));
}

function rateWord(wordId, rate) {
  const cur = state.words[wordId] || { box: 1, reps: 0, mastered: false };
  let newBox = cur.box;
  if (rate === 'hard') {
    newBox = Math.max(1, cur.box); // stay
  } else if (rate === 'normal') {
    newBox = cur.box + 1;
  } else if (rate === 'easy') {
    newBox = cur.box + 2;
  }
  newBox = Math.min(6, newBox);
  const mastered = newBox >= 5 && rate === 'easy' ? true : (cur.mastered || newBox >= 6);
  const interval = rate === 'hard' ? 1 : reviewIntervalDays(newBox);
  state.words[wordId] = {
    box: newBox,
    reps: cur.reps + 1,
    nextReview: addDaysStr(interval),
    mastered: mastered
  };
  updateStreakOnStudy();
  saveState();
}

function updateStreakOnStudy() {
  const today = todayStr();
  if (state.lastStudyDate === today) return;
  if (state.lastStudyDate && daysBetween(state.lastStudyDate, today) === 1) {
    state.streak = (state.streak || 0) + 1;
  } else {
    state.streak = 1;
  }
  state.lastStudyDate = today;
}

/* ------------------ Today's session ------------------ */
function buildTodaySession() {
  const today = todayStr();
  const due = [];
  const newWords = [];

  for (const w of WORDS) {
    const p = state.words[w.id];
    if (!p) {
      newWords.push(w);
    } else if (!p.mastered && p.nextReview && p.nextReview <= today) {
      due.push(w);
    }
  }

  // sort due by earliest nextReview, newWords stay in JSON order
  due.sort((a, b) => {
    const pa = state.words[a.id].nextReview;
    const pb = state.words[b.id].nextReview;
    return pa < pb ? -1 : pa > pb ? 1 : 0;
  });

  const perDay = state.perDay;
  let session;
  if (due.length >= perDay) {
    session = due.slice(0, perDay);
  } else {
    session = due.concat(newWords.slice(0, perDay - due.length));
  }
  return session;
}

/* ------------------ TTS ------------------ */
let _voices = [];
function loadVoices() {
  _voices = speechSynthesis.getVoices();
}
if (typeof speechSynthesis !== 'undefined') {
  loadVoices();
  speechSynthesis.onvoiceschanged = loadVoices;
}

function speak(text) {
  if (!('speechSynthesis' in window)) return;
  try {
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'en-US';
    u.rate = 0.9;
    u.pitch = 1;
    const enVoice = _voices.find(v => v.lang && v.lang.startsWith('en'));
    if (enVoice) u.voice = enVoice;
    speechSynthesis.speak(u);
  } catch (e) {
    console.warn('TTS failed', e);
  }
}

/* ------------------ DOM refs ------------------ */
const $ = (id) => document.getElementById(id);

const els = {
  tabs: document.querySelectorAll('.tab'),
  views: {
    today: $('view-today'),
    topics: $('view-topics'),
    progress: $('view-progress')
  },
  // Today
  todayBar: $('todayBar'),
  todayCount: $('todayCount'),
  todayTotal: $('todayTotal'),
  cardArea: $('cardArea'),
  flashcard: $('flashcard'),
  cardTopic: $('cardTopic'),
  cardWord: $('cardWord'),
  cardIpa: $('cardIpa'),
  cardPos: $('cardPos'),
  cardEveryday: $('cardEveryday'),
  cardAi: $('cardAi'),
  cardExampleEn: $('cardExampleEn'),
  cardExampleVi: $('cardExampleVi'),
  cardTip: $('cardTip'),
  btnSpeak: $('btnSpeak'),
  btnFlip: $('btnFlip'),
  rateButtons: $('rateButtons'),
  doneArea: $('doneArea'),
  doneStat: $('doneStat'),
  perDay: $('perDay'),
  // Topics
  topicGrid: $('topicGrid'),
  topicDetail: $('topicDetail'),
  topicDetailTitle: $('topicDetailTitle'),
  topicWordList: $('topicWordList'),
  wordDetail: $('wordDetail'),
  wordDetailContent: $('wordDetailContent'),
  btnBackTopics: $('btnBackTopics'),
  btnBackWordList: $('btnBackWordList'),
  // Progress
  statLearned: $('statLearned'),
  statMastered: $('statMastered'),
  statStreak: $('statStreak'),
  statTotal: $('statTotal'),
  topicProgressList: $('topicProgressList'),
  btnReset: $('btnReset')
};

/* ------------------ Tab switching ------------------ */
els.tabs.forEach(tab => {
  tab.addEventListener('click', () => {
    const view = tab.dataset.view;
    els.tabs.forEach(t => t.classList.toggle('active', t === tab));
    Object.entries(els.views).forEach(([k, el]) => {
      el.classList.toggle('active', k === view);
    });
    if (view === 'today') renderToday();
    if (view === 'topics') renderTopicsGrid();
    if (view === 'progress') renderProgress();
  });
});

/* ------------------ Today view ------------------ */
let session = [];
let sessionIndex = 0;

function renderToday() {
  session = buildTodaySession();
  sessionIndex = 0;
  els.cardArea.classList.remove('hidden');
  els.doneArea.classList.add('hidden');
  els.todayTotal.textContent = session.length;
  els.perDay.value = state.perDay;
  if (session.length === 0) {
    showDone(true);
  } else {
    showCard();
  }
}

function showCard() {
  const w = session[sessionIndex];
  if (!w) {
    showDone(false);
    return;
  }
  els.todayCount.textContent = sessionIndex;
  els.todayBar.style.width = (sessionIndex / session.length * 100) + '%';
  const topic = TOPICS_BY_ID[w.topic];
  els.cardTopic.textContent = topic ? (topic.emoji + ' ' + topic.name_vi) : '';
  els.cardWord.textContent = w.word;
  els.cardIpa.textContent = w.ipa || '';
  els.cardPos.textContent = w.pos || '';
  els.cardEveryday.textContent = w.meaning_everyday_vi || '—';
  els.cardAi.textContent = w.meaning_ai_vi || '—';
  els.cardExampleEn.textContent = w.example_en || '';
  els.cardExampleVi.textContent = w.example_vi || '';
  els.cardTip.textContent = w.tip_vi || '';

  els.flashcard.classList.remove('flipped');
  els.rateButtons.classList.add('hidden');
}

function flipCard() {
  if (els.flashcard.classList.contains('flipped')) return;
  els.flashcard.classList.add('flipped');
  els.rateButtons.classList.remove('hidden');
  const w = session[sessionIndex];
  if (w) speak(w.word);
}

function showDone(empty) {
  els.cardArea.classList.add('hidden');
  els.doneArea.classList.remove('hidden');
  els.todayBar.style.width = '100%';
  if (empty) {
    els.doneStat.textContent = 'Không có từ nào cần ôn hôm nay. Quay lại sau nhé!';
  } else {
    els.doneStat.textContent = `Đã học ${session.length} từ. Chuỗi: ${state.streak} ngày 🔥`;
  }
}

els.btnFlip.addEventListener('click', (e) => { e.stopPropagation(); flipCard(); });
els.flashcard.addEventListener('click', flipCard);
els.btnSpeak.addEventListener('click', (e) => {
  e.stopPropagation();
  const w = session[sessionIndex];
  if (w) speak(w.word);
});

document.querySelectorAll('.btn-rate').forEach(btn => {
  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    const rate = btn.dataset.rate;
    const w = session[sessionIndex];
    if (!w) return;
    rateWord(w.id, rate);
    sessionIndex++;
    if (sessionIndex >= session.length) {
      showDone(false);
    } else {
      showCard();
    }
  });
});

els.perDay.addEventListener('change', () => {
  const val = parseInt(els.perDay.value, 10);
  if (isNaN(val) || val < 3) {
    els.perDay.value = state.perDay;
    return;
  }
  state.perDay = Math.min(30, val);
  els.perDay.value = state.perDay;
  saveState();
  renderToday();
});

/* ------------------ Topics view ------------------ */
function statusOfWord(wid) {
  const p = state.words[wid];
  if (!p) return 'new';
  if (p.mastered) return 'mastered';
  return 'learning';
}

function statusLabel(s) {
  return s === 'new' ? 'Chưa học' : s === 'mastered' ? 'Đã thuộc' : 'Đang học';
}

function renderTopicsGrid() {
  els.topicDetail.classList.add('hidden');
  els.wordDetail.classList.add('hidden');
  els.topicGrid.classList.remove('hidden');
  els.topicGrid.innerHTML = '';
  TOPICS.forEach(t => {
    const wordsInTopic = WORDS.filter(w => w.topic === t.id);
    const mastered = wordsInTopic.filter(w => statusOfWord(w.id) === 'mastered').length;
    const total = wordsInTopic.length;
    const pct = total ? (mastered / total * 100) : 0;
    const card = document.createElement('div');
    card.className = 'topic-card';
    card.innerHTML = `
      <div class="topic-emoji">${t.emoji || '📘'}</div>
      <div class="topic-name">${t.name_vi}</div>
      <div class="topic-count">${mastered}/${total} thuộc</div>
      <div class="topic-mini-bar"><div class="topic-mini-fill" style="width:${pct}%"></div></div>
    `;
    card.addEventListener('click', () => openTopicDetail(t));
    els.topicGrid.appendChild(card);
  });
}

function openTopicDetail(topic) {
  els.topicGrid.classList.add('hidden');
  els.wordDetail.classList.add('hidden');
  els.topicDetail.classList.remove('hidden');
  els.topicDetailTitle.textContent = `${topic.emoji} ${topic.name_vi}`;
  els.topicWordList.innerHTML = '';
  WORDS.filter(w => w.topic === topic.id).forEach(w => {
    const status = statusOfWord(w.id);
    const item = document.createElement('div');
    item.className = 'word-list-item';
    item.innerHTML = `
      <div>
        <span class="word-list-name">${w.word}</span>
        <span class="word-list-ipa">${w.ipa || ''}</span>
      </div>
      <span class="word-list-badge ${status}">${statusLabel(status)}</span>
    `;
    item.addEventListener('click', () => openWordDetail(w, topic));
    els.topicWordList.appendChild(item);
  });
}

els.btnBackTopics.addEventListener('click', renderTopicsGrid);

function openWordDetail(w, topic) {
  els.topicDetail.classList.add('hidden');
  els.topicGrid.classList.add('hidden');
  els.wordDetail.classList.remove('hidden');
  els.wordDetailContent.innerHTML = `
    <div class="word-detail-card">
      <div class="word-topic">${topic.emoji} ${topic.name_vi}</div>
      <div class="word-detail-word">${w.word}</div>
      <div class="word-detail-ipa">${w.ipa || ''}</div>
      <div class="word-detail-pos">${w.pos || ''}</div>
      <div class="word-detail-speak">
        <button class="btn-speak" id="detailSpeak" aria-label="Phát âm">🔊</button>
      </div>
      <div class="back-section">
        <div class="back-label">Nghĩa thường ngày</div>
        <div class="back-text">${w.meaning_everyday_vi || '—'}</div>
      </div>
      <div class="back-section back-section-ai">
        <div class="back-label">Nghĩa trong AI 🤖</div>
        <div class="back-text">${w.meaning_ai_vi || '—'}</div>
      </div>
      <div class="back-section">
        <div class="back-label">Ví dụ</div>
        <div class="back-text back-example">${w.example_en || ''}</div>
        <div class="back-text back-example-vi">${w.example_vi || ''}</div>
      </div>
      <div class="back-section back-tip">
        <div class="back-label">💡 Mẹo</div>
        <div class="back-text">${w.tip_vi || ''}</div>
      </div>
    </div>
  `;
  const btn = $('detailSpeak');
  if (btn) btn.addEventListener('click', () => speak(w.word));
}

els.btnBackWordList.addEventListener('click', () => {
  // back to the topic the word belongs to
  const topicTitle = els.topicDetailTitle.textContent;
  const topic = TOPICS.find(t => topicTitle.includes(t.name_vi));
  if (topic) openTopicDetail(topic);
  else renderTopicsGrid();
});

/* ------------------ Progress view ------------------ */
function renderProgress() {
  const learned = Object.keys(state.words).length;
  const mastered = Object.values(state.words).filter(w => w.mastered).length;
  els.statLearned.textContent = learned;
  els.statMastered.textContent = mastered;
  els.statStreak.textContent = state.streak || 0;
  els.statTotal.textContent = WORDS.length;

  els.topicProgressList.innerHTML = '<h3 style="margin-bottom:12px">Tiến độ theo chủ đề</h3>';
  TOPICS.forEach(t => {
    const wordsInTopic = WORDS.filter(w => w.topic === t.id);
    const masteredInTopic = wordsInTopic.filter(w => state.words[w.id]?.mastered).length;
    const total = wordsInTopic.length;
    const pct = total ? (masteredInTopic / total * 100) : 0;
    const row = document.createElement('div');
    row.className = 'topic-progress-row';
    row.innerHTML = `
      <div class="topic-progress-name">${t.emoji} ${t.name_vi}</div>
      <div class="topic-progress-bar"><div class="topic-progress-fill" style="width:${pct}%"></div></div>
      <div class="topic-progress-text">${masteredInTopic}/${total}</div>
    `;
    els.topicProgressList.appendChild(row);
  });
}

els.btnReset.addEventListener('click', () => {
  if (!confirm('Xóa hết tiến độ học? Hành động này không thể hoàn tác.')) return;
  state = defaultState();
  saveState();
  renderProgress();
  renderToday();
});

/* ------------------ Init ------------------ */
function init() {
  if (!DATA || !WORDS || WORDS.length === 0) {
    document.body.innerHTML = '<p style="padding:40px;text-align:center">⚠️ Không load được dữ liệu từ vựng. Kiểm tra file vocabulary.js.</p>';
    return;
  }
  renderToday();
}

init();
