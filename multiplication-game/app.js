(() => {
  'use strict';

  const $ = (id) => document.getElementById(id);
  const screens = [...document.querySelectorAll('.screen')];
  const FACTS = Array.from({ length: 12 }, (_, i) => i + 1);
  const STORAGE_KEY = 'factQuest.v1';
  const badgeDefs = [
    { id: 'first10', icon: '🌟', name: 'First 10', test: s => s.totalCorrect >= 10 },
    { id: 'streak5', icon: '🔥', name: 'Hot Streak', test: s => s.bestStreak >= 5 },
    { id: 'streak10', icon: '🚀', name: '10 Streak', test: s => s.bestStreak >= 10 },
    { id: 'hundred', icon: '💯', name: '100 Correct', test: s => s.totalCorrect >= 100 },
    { id: 'boss', icon: '🐉', name: 'Dragon Slayer', test: s => s.bossWins >= 1 },
    { id: 'speed', icon: '⚡', name: 'Speedster', test: s => s.speedBest >= 15 },
    { id: 'master', icon: '👑', name: 'Fact Master', test: s => FACTS.every(f => masteryStars(s.mastery[f]) >= 3) },
    { id: 'daily', icon: '🎁', name: 'Daily Treasure', test: s => s.dailyWins >= 1 },
    { id: 'level5', icon: '🏆', name: 'Level 5', test: s => levelForXp(s.xp) >= 5 }
  ];

  const defaultState = () => ({
    player: '',
    xp: 0,
    totalCorrect: 0,
    totalAnswered: 0,
    bestStreak: 0,
    bossWins: 0,
    speedBest: 0,
    dailyWins: 0,
    sound: true,
    selectedFacts: [2, 3, 4, 5, 10],
    mastery: Object.fromEntries(FACTS.map(f => [f, { correct: 0, total: 0, recentWrong: 0 }])),
    badges: [],
    lastDaily: ''
  });

  let state = loadState();
  let game = null;
  let timerId = null;
  let locked = false;
  let audioCtx = null;
  let toastTimer = null;

  function loadState() {
    try {
      const raw = JSON.parse(localStorage.getItem(STORAGE_KEY));
      if (!raw) return defaultState();
      const base = defaultState();
      const merged = { ...base, ...raw, mastery: { ...base.mastery, ...(raw.mastery || {}) } };
      FACTS.forEach(f => {
        merged.mastery[f] = { ...base.mastery[f], ...(merged.mastery[f] || {}) };
      });
      return merged;
    } catch {
      return defaultState();
    }
  }

  function saveState() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }

  function showScreen(id) {
    screens.forEach(s => s.classList.toggle('active', s.id === id));
    $('homeBtn').classList.toggle('hidden', id === 'welcomeScreen' || id === 'homeScreen');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function levelForXp(xp) {
    return Math.floor(xp / 100) + 1;
  }

  function xpIntoLevel(xp) {
    return xp % 100;
  }

  function masteryStars(rec = {}) {
    const total = rec.total || 0;
    if (total < 5) return 0;
    const accuracy = (rec.correct || 0) / Math.max(1, total);
    if (total >= 20 && accuracy >= 0.9) return 3;
    if (total >= 10 && accuracy >= 0.8) return 2;
    if (accuracy >= 0.65) return 1;
    return 0;
  }

  function starsText(n) {
    return '★'.repeat(n) + '☆'.repeat(3 - n);
  }

  function renderHome() {
    $('playerGreeting').textContent = state.player || 'Hero';
    const lvl = levelForXp(state.xp);
    $('levelBadge').textContent = `Lv ${lvl}`;
    $('xpText').textContent = `${state.xp} XP`;
    $('xpFill').style.width = `${xpIntoLevel(state.xp)}%`;
    $('soundBtn').textContent = state.sound ? '🔊' : '🔇';
    const today = new Date().toISOString().slice(0, 10);
    const done = state.lastDaily === today;
    $('dailyBtn').textContent = done ? 'Done ✓' : 'Play';
    $('dailyBtn').disabled = done;
    $('dailyBtn').style.opacity = done ? '.55' : '1';
  }

  function renderFactPicker() {
    $('factPicker').innerHTML = '';
    FACTS.forEach(f => {
      const btn = document.createElement('button');
      btn.className = `fact-chip ${state.selectedFacts.includes(f) ? 'selected' : ''}`;
      const stars = masteryStars(state.mastery[f]);
      btn.innerHTML = `<span>×${f}</span><span class="starline">${starsText(stars)}</span>`;
      btn.dataset.fact = f;
      btn.setAttribute('aria-pressed', state.selectedFacts.includes(f));
      btn.addEventListener('click', () => {
        const fact = Number(btn.dataset.fact);
        const set = new Set(state.selectedFacts);
        if (set.has(fact) && set.size > 1) set.delete(fact); else set.add(fact);
        state.selectedFacts = [...set].sort((a, b) => a - b);
        saveState();
        renderFactPicker();
      });
      $('factPicker').appendChild(btn);
    });
  }

  function renderProgress() {
    $('masteryGrid').innerHTML = '';
    FACTS.forEach(f => {
      const rec = state.mastery[f];
      const stars = masteryStars(rec);
      const accuracy = rec.total ? Math.round(rec.correct / rec.total * 100) : 0;
      const card = document.createElement('div');
      card.className = 'mastery-card';
      card.innerHTML = `<strong>×${f}</strong><span class="stars">${starsText(stars)}</span><small>${rec.total ? `${accuracy}% • ${rec.total} tries` : 'Not started'}</small>`;
      $('masteryGrid').appendChild(card);
    });
    updateBadges();
    $('badgesGrid').innerHTML = '';
    badgeDefs.forEach(b => {
      const unlocked = state.badges.includes(b.id);
      const item = document.createElement('div');
      item.className = `badge-card ${unlocked ? 'unlocked' : ''}`;
      item.innerHTML = `<span>${b.icon}</span><small>${b.name}</small>`;
      $('badgesGrid').appendChild(item);
    });
  }

  function updateBadges() {
    const before = new Set(state.badges);
    badgeDefs.forEach(b => {
      if (b.test(state) && !state.badges.includes(b.id)) state.badges.push(b.id);
    });
    saveState();
    return state.badges.filter(id => !before.has(id));
  }

  function weightedFact() {
    const facts = state.selectedFacts.length ? state.selectedFacts : [2, 3, 4, 5, 10];
    const bag = [];
    facts.forEach(f => {
      const rec = state.mastery[f];
      const accuracy = rec.total ? rec.correct / rec.total : 0.5;
      const weakness = Math.max(1, Math.round((1.05 - accuracy) * 5) + Math.min(3, rec.recentWrong || 0));
      for (let i = 0; i < weakness; i++) bag.push(f);
    });
    return bag[Math.floor(Math.random() * bag.length)];
  }

  function makeQuestion() {
    const a = weightedFact();
    const b = Math.floor(Math.random() * 12) + 1;
    const answer = a * b;
    const options = new Set([answer]);
    const nudges = [a, b, a + 1, Math.max(1, a - 1), 10, -a, a * 2];
    let guard = 0;
    while (options.size < 4 && guard++ < 50) {
      const nudge = nudges[Math.floor(Math.random() * nudges.length)];
      let candidate;
      if (Math.random() < 0.6) candidate = answer + nudge;
      else candidate = (Math.floor(Math.random() * 12) + 1) * a;
      if (candidate > 0 && candidate !== answer) options.add(candidate);
    }
    while (options.size < 4) options.add(answer + options.size + 1);
    return { a, b, answer, options: shuffle([...options]) };
  }

  function shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  function startGame(mode) {
    clearTimer();
    const config = {
      adventure: { target: 10, hearts: 3 },
      daily: { target: 12, hearts: 3 },
      boss: { target: Infinity, hearts: 3, bossHp: 100 },
      speed: { target: Infinity, seconds: 60 },
      practice: { target: Infinity }
    }[mode];

    game = {
      mode,
      ...config,
      score: 0,
      streak: 0,
      bestStreak: 0,
      correct: 0,
      answered: 0,
      xpEarned: 0,
      question: null,
      startedAt: Date.now(),
      secondsLeft: config.seconds || null
    };
    locked = false;
    $('feedback').textContent = '';
    $('feedback').className = 'feedback';
    $('bossWrap').classList.toggle('hidden', mode !== 'boss');
    $('timerWrap').classList.toggle('hidden', mode !== 'speed');
    $('hintBtn').classList.toggle('hidden', mode !== 'practice');
    $('hintText').classList.add('hidden');

    if (mode === 'speed') startSpeedTimer();
    renderHud();
    showScreen('gameScreen');
    nextQuestion();
  }

  function renderHud() {
    if (!game) return;
    $('scoreText').textContent = game.score;
    $('streakText').textContent = `${game.streak} 🔥`;
    if (game.mode === 'speed') {
      $('modeStatLabel').textContent = 'Time';
      $('modeStatText').textContent = `${Math.max(0, game.secondsLeft)}s`;
    } else if (game.mode === 'practice') {
      $('modeStatLabel').textContent = 'Correct';
      $('modeStatText').textContent = game.correct;
    } else {
      $('modeStatLabel').textContent = 'Hearts';
      $('modeStatText').textContent = '♥'.repeat(Math.max(0, game.hearts)) + '♡'.repeat(Math.max(0, 3 - game.hearts));
    }
    if (game.mode === 'boss') {
      $('bossHpText').textContent = `${Math.max(0, game.bossHp)} HP`;
      $('bossHpFill').style.width = `${Math.max(0, game.bossHp)}%`;
    }
  }

  function nextQuestion() {
    if (!game) return;
    if (game.mode === 'speed' && game.secondsLeft <= 0) return endGame();
    if ((game.mode === 'adventure' || game.mode === 'daily') && game.answered >= game.target) return endGame();
    if ((game.mode === 'adventure' || game.mode === 'daily' || game.mode === 'boss') && game.hearts <= 0) return endGame();
    if (game.mode === 'boss' && game.bossHp <= 0) return endGame();

    locked = false;
    game.question = makeQuestion();
    const q = game.question;
    $('questionText').textContent = `${q.a} × ${q.b} = ?`;
    if (game.mode === 'adventure' || game.mode === 'daily') {
      $('questionCount').textContent = `Question ${game.answered + 1} of ${game.target}`;
    } else if (game.mode === 'boss') {
      $('questionCount').textContent = `Attack ${game.answered + 1}`;
    } else if (game.mode === 'speed') {
      $('questionCount').textContent = `Solved ${game.correct}`;
    } else {
      $('questionCount').textContent = `Practice ${game.answered + 1}`;
    }
    $('hintText').classList.add('hidden');
    $('hintText').textContent = '';
    $('feedback').textContent = '';
    $('feedback').className = 'feedback';
    $('answersGrid').innerHTML = '';
    q.options.forEach(value => {
      const btn = document.createElement('button');
      btn.className = 'answer-btn';
      btn.textContent = value;
      btn.dataset.value = value;
      btn.addEventListener('click', () => answerQuestion(value, btn));
      $('answersGrid').appendChild(btn);
    });
  }

  function answerQuestion(value, btn) {
    if (locked || !game) return;
    locked = true;
    const q = game.question;
    const right = Number(value) === q.answer;
    const rec = state.mastery[q.a];
    game.answered++;
    state.totalAnswered++;
    rec.total++;

    [...$('answersGrid').children].forEach(b => {
      b.disabled = true;
      if (Number(b.dataset.value) === q.answer) b.classList.add('correct');
    });

    if (right) {
      btn.classList.add('correct');
      game.correct++;
      state.totalCorrect++;
      game.streak++;
      game.bestStreak = Math.max(game.bestStreak, game.streak);
      state.bestStreak = Math.max(state.bestStreak, game.streak);
      rec.correct++;
      rec.recentWrong = Math.max(0, (rec.recentWrong || 0) - 1);
      const gain = 10 + Math.min(10, game.streak * 2);
      game.score += gain;
      game.xpEarned += 5 + Math.min(5, game.streak);
      if (game.mode === 'boss') game.bossHp -= 20 + Math.min(10, game.streak * 2);
      $('feedback').textContent = game.streak >= 5 ? `🔥 ${game.streak} in a row!` : pick(['Nice!', 'Correct!', 'Boom!', 'You got it!', 'Great job!']);
      $('feedback').className = 'feedback good';
      sound('good');
      vibrate(35);
      if (game.streak === 5 || game.streak === 10) confetti(24);
    } else {
      btn.classList.add('wrong');
      game.streak = 0;
      rec.recentWrong = Math.min(5, (rec.recentWrong || 0) + 1);
      if (game.mode === 'adventure' || game.mode === 'daily' || game.mode === 'boss') game.hearts--;
      $('feedback').textContent = `${q.a} × ${q.b} = ${q.answer}. You’ll see it again.`;
      $('feedback').className = 'feedback bad';
      sound('bad');
      vibrate([45, 35, 45]);
    }

    saveState();
    renderHud();
    const delay = right ? 650 : 1250;
    setTimeout(() => {
      if (game) nextQuestion();
    }, delay);
  }

  function startSpeedTimer() {
    const total = game.secondsLeft;
    $('timerFill').style.width = '100%';
    timerId = setInterval(() => {
      if (!game || game.mode !== 'speed') return clearTimer();
      game.secondsLeft--;
      $('timerFill').style.width = `${Math.max(0, game.secondsLeft / total * 100)}%`;
      renderHud();
      if (game.secondsLeft <= 0) {
        clearTimer();
        locked = true;
        [...$('answersGrid').children].forEach(b => b.disabled = true);
        sound('finish');
        endGame();
      }
    }, 1000);
  }

  function clearTimer() {
    if (timerId) clearInterval(timerId);
    timerId = null;
  }

  function endGame() {
    if (!game) return;
    clearTimer();
    const finished = game;
    game = null;
    let title = 'Great work!';
    let icon = '🏆';
    let message = 'Every round makes your facts stronger.';

    if (finished.mode === 'boss') {
      if (finished.bossHp <= 0) {
        title = 'Dragon defeated!';
        icon = '🐉';
        message = 'You crushed the boss battle.';
        state.bossWins++;
        finished.xpEarned += 25;
        confetti(50);
      } else {
        title = 'So close!';
        icon = '🛡️';
        message = 'Train a little more, then challenge the dragon again.';
      }
    } else if (finished.mode === 'speed') {
      state.speedBest = Math.max(state.speedBest, finished.correct);
      title = `${finished.correct} facts in 60 seconds!`;
      icon = '⚡';
      message = finished.correct >= 15 ? 'Lightning fast!' : 'Try again and beat your score.';
    } else if (finished.mode === 'daily') {
      const today = new Date().toISOString().slice(0, 10);
      if (finished.answered >= finished.target && finished.hearts > 0) {
        state.lastDaily = today;
        state.dailyWins++;
        finished.xpEarned += 20;
        icon = '🎁';
        title = 'Treasure unlocked!';
        message = 'Daily quest complete. Bonus XP earned!';
        confetti(45);
      }
    } else if (finished.mode === 'adventure') {
      if (finished.hearts <= 0) {
        title = 'Adventure paused';
        icon = '❤️';
        message = 'Your hearts ran out, but the facts you practiced still count.';
      } else {
        title = 'Adventure complete!';
        confetti(34);
      }
    } else if (finished.mode === 'practice') {
      title = 'Practice saved!';
      icon = '🎯';
      message = 'Your mastery chart has been updated.';
    }

    state.xp += finished.xpEarned;
    const newBadges = updateBadges();
    saveState();
    renderHome();

    $('resultIcon').textContent = icon;
    $('resultEyebrow').textContent = finished.mode === 'daily' ? 'DAILY QUEST' : 'ROUND COMPLETE';
    $('resultTitle').textContent = title;
    $('resultMessage').textContent = message;
    $('finalScore').textContent = finished.score;
    $('finalCorrect').textContent = `${finished.correct}/${finished.answered}`;
    $('finalStreak').textContent = finished.bestStreak;
    $('finalXp').textContent = `+${finished.xpEarned}`;
    $('newBadge').classList.toggle('hidden', newBadges.length === 0);
    $('newBadge').textContent = newBadges.length ? `New badge: ${badgeDefs.find(b => b.id === newBadges[0])?.icon || '🏅'} ${badgeDefs.find(b => b.id === newBadges[0])?.name || 'Unlocked!'}` : '';
    $('playAgainBtn').dataset.mode = finished.mode;
    showScreen('resultsScreen');
  }

  function showHint() {
    if (!game || !game.question) return;
    const { a, b, answer } = game.question;
    let hint;
    if (b <= 5) {
      hint = `${a} added ${b} times = ${Array.from({ length: b }, () => a).join(' + ')} = ${answer}`;
    } else if (a === 10) {
      hint = `×10 trick: put a zero after ${b} → ${answer}`;
    } else if (a === 5) {
      hint = `×5 answers end in 0 or 5. Count by fives to ${answer}.`;
    } else if (a === 9) {
      hint = `×9 trick: ${b} × 10 is ${b * 10}; subtract ${b} → ${answer}.`;
    } else {
      const half = Math.floor(b / 2);
      hint = `Break it apart: ${a} × ${half} = ${a * half}; then add ${a} another ${b - half} time${b - half === 1 ? '' : 's'}.`;
    }
    $('hintText').textContent = hint;
    $('hintText').classList.remove('hidden');
  }

  function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

  function sound(type) {
    if (!state.sound) return;
    try {
      audioCtx ||= new (window.AudioContext || window.webkitAudioContext)();
      const now = audioCtx.currentTime;
      const notes = type === 'good' ? [523, 659, 784] : type === 'finish' ? [523, 659, 784, 1047] : [180, 140];
      notes.forEach((freq, i) => {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = type === 'bad' ? 'sawtooth' : 'sine';
        osc.frequency.value = freq;
        gain.gain.setValueAtTime(0.0001, now + i * 0.07);
        gain.gain.exponentialRampToValueAtTime(0.13, now + i * 0.07 + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + i * 0.07 + 0.12);
        osc.connect(gain).connect(audioCtx.destination);
        osc.start(now + i * 0.07);
        osc.stop(now + i * 0.07 + 0.13);
      });
    } catch { /* audio is optional */ }
  }

  function vibrate(pattern) {
    if ('vibrate' in navigator) navigator.vibrate(pattern);
  }

  function confetti(count = 30) {
    const layer = $('confettiLayer');
    const colors = ['#fde047', '#22d3ee', '#a78bfa', '#4ade80', '#fb7185', '#f97316'];
    for (let i = 0; i < count; i++) {
      const el = document.createElement('i');
      el.className = 'confetti';
      el.style.left = `${Math.random() * 100}%`;
      el.style.background = pick(colors);
      el.style.setProperty('--drift', `${(Math.random() - 0.5) * 180}px`);
      el.style.animationDelay = `${Math.random() * 260}ms`;
      el.style.animationDuration = `${750 + Math.random() * 600}ms`;
      layer.appendChild(el);
      setTimeout(() => el.remove(), 1700);
    }
  }

  function toast(msg) {
    clearTimeout(toastTimer);
    $('toast').textContent = msg;
    $('toast').classList.add('show');
    toastTimer = setTimeout(() => $('toast').classList.remove('show'), 1700);
  }

  function goHome() {
    clearTimer();
    game = null;
    renderHome();
    showScreen('homeScreen');
  }

  function init() {
    $('playerName').value = state.player;
    $('startBtn').addEventListener('click', () => {
      const name = $('playerName').value.trim() || 'Hero';
      state.player = name.slice(0, 18);
      saveState();
      renderHome();
      showScreen('homeScreen');
      sound('good');
    });
    $('playerName').addEventListener('keydown', e => { if (e.key === 'Enter') $('startBtn').click(); });

    document.querySelectorAll('.mode-card').forEach(btn => btn.addEventListener('click', () => startGame(btn.dataset.mode)));
    $('dailyBtn').addEventListener('click', () => startGame('daily'));
    $('factsBtn').addEventListener('click', () => { renderFactPicker(); showScreen('factsScreen'); });
    $('progressBtn').addEventListener('click', () => { renderProgress(); showScreen('progressScreen'); });
    $('progressHomeBtn').addEventListener('click', goHome);
    $('homeBtn').addEventListener('click', goHome);
    $('resultsHomeBtn').addEventListener('click', goHome);
    $('playAgainBtn').addEventListener('click', () => startGame($('playAgainBtn').dataset.mode || 'adventure'));
    $('hintBtn').addEventListener('click', showHint);

    $('selectAllBtn').addEventListener('click', () => {
      state.selectedFacts = [...FACTS];
      saveState();
      renderFactPicker();
    });
    $('saveFactsBtn').addEventListener('click', () => {
      saveState();
      renderHome();
      toast(`Practicing ${state.selectedFacts.map(f => `×${f}`).join(', ')}`);
      showScreen('homeScreen');
    });

    $('soundBtn').addEventListener('click', () => {
      state.sound = !state.sound;
      saveState();
      $('soundBtn').textContent = state.sound ? '🔊' : '🔇';
      if (state.sound) sound('good');
    });

    $('resetBtn').addEventListener('click', () => {
      if (!confirm('Reset all Fact Quest progress on this device?')) return;
      const name = state.player;
      state = defaultState();
      state.player = name;
      saveState();
      renderProgress();
      renderHome();
      toast('Progress reset');
    });

    renderHome();
    renderFactPicker();
    if (state.player) showScreen('homeScreen'); else showScreen('welcomeScreen');

    if ('serviceWorker' in navigator) {
      window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(() => {}));
    }
  }

  init();
})();
