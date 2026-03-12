const socket = typeof io !== 'undefined' ? io() : null;

const canvas = document.getElementById('Canvas01');
const ctx = canvas.getContext('2d');

const backgrounds = [
  { id: '1', name: 'Standard', src: 'Hintergrund.jpg', price: 0 },
  { id: '2', name: 'Nacht', src: 'Hintergrund Nacht.png', price: 100 },
  { id: '3', name: 'Weltraum', src: 'Hintergrund Weltraum.jpg', price: 200 },
  { id: '4', name: 'Wald', src: 'Hintergrund Wald.png', price: 300 }
];

const characters = [
  { id: '1', name: 'Standard', src: 'mann.png', price: 0 },
  { id: '2', name: 'Tiger Classic', src: 'mann2.png', price: 50 },
  { id: '3', name: 'Hund', src: 'Hund.png', price: 100 },
  { id: '4', name: 'Neon Tiger', src: 'Neon Tiger.png', price: 200 }
];

const caseConfigs = [
  { id: 1, name: 'Kupferkiste', src: 'Kiste.png', price: 50 },
  { id: 2, name: 'Silberkiste', src: 'Kiste2.png', price: 100 },
  { id: 3, name: 'Diamantkiste', src: 'Kiste3.png', price: 300 }
];

const imageFiles = {
  jet: 'Kampfjet.webp',
  ufo: 'ufo.png',
  coin: 'Münze.png',
  x2: '2x.png',
  blitz: 'Blitz.png',
  shield: 'Schild.png',
  speed: 'Speed.png',
  clown: 'Clown.png',
  freeSpin: 'Free spins.png',
  wolke1: 'Wolke.png',
  wolke2: 'Wolke (2).png',
  wolke3: 'Wolke (3).png',
  wolke4: 'Wolke (4).png',
  wolke5: 'Wolke (5).png',
  wolke6: 'Wolke (6).png'
};

const images = {};
for (const bg of backgrounds) {
  images['bg' + bg.id] = new Image();
  images['bg' + bg.id].src = bg.src;
}
for (const ch of characters) {
  images['char' + ch.id] = new Image();
  images['char' + ch.id].src = ch.src;
}
for (const [key, src] of Object.entries(imageFiles)) {
  images[key] = new Image();
  images[key].src = src;
}

const menuMusic = new Audio('Music menü.mp3');
menuMusic.loop = true;
const gameMusic = new Audio('Music.mp3');
gameMusic.loop = true;
const altGameMusic = new Audio('Musik.mp3');
altGameMusic.loop = true;
const twoPlayerMusic = new Audio('Epische musik.mp3');
twoPlayerMusic.loop = true;
const lockSound = new Audio('Schloss.mp3');
const coinSound = new Audio('Münze.mp3');
const caseSound = new Audio('cs2 case.mp3');
const buttonSound = new Audio('Knopf.mp3');

const allMenus = [
  'startMenu','modeMenu','difficultyMenu','classicMenu','twoPlayerChoiceMenu','localSetupMenu','onlineMenu','createLobbyMenu',
  'joinLobbyMenu','onlineLobbyMenu','skinsMenu','shopMenu','casesMenu','itemsMenu','settingsMenu','adminLoginMenu','adminMenu',
  'pauseMenu','singleGameOverMenu','levelCompleteMenu','twoPlayerGameOverMenu'
].map(id => document.getElementById(id));

const scoreBoard = document.getElementById('scoreBoard');
const powerDisplay = document.getElementById('powerDisplay');
const statusToast = document.getElementById('statusToast');
const singleItemBar = document.getElementById('singleItemBar');
const hudTop = document.getElementById('hudTop');
const hudBottom = document.getElementById('hudBottom');

const levelTargets = { 1: 150, 2: 200, 3: 250, 4: 500 };
const wolkenBilder = ['wolke1', 'wolke2', 'wolke3', 'wolke4', 'wolke5', 'wolke6'];
const twoPlayerMusicOptions = ['Epische musik.mp3', 'Epische musik2.mp3'];
const endlessMusicOptions = ['Music.mp3', 'Musik.mp3'];
const NORMAL_MODE_FACTOR = 1.10;
const PLAYER_DRAW_W = 92;
const PLAYER_DRAW_H = 56;
const PLAYER_HIT_W = 56;
const PLAYER_HIT_H = 34;

let keyState = {};
let firstInteractionDone = false;
let toastTimeout = null;
let awaitingKeybind = null;
let localSetupStep = 0;
let caseSpinActive = false;
let caseAnimationFrame = null;
let remoteKeyState = {};
let onlineSendInputEnabled = false;
let lastSnapshotSent = 0;

let adminGodMode = false;
let adminDoubleScore = false;
let sfxMuted = localStorage.getItem('sfxMuted') === 'true';
let keybinds = {
  up: localStorage.getItem('keybind_up') || 'w',
  down: localStorage.getItem('keybind_down') || 's',
  pause: localStorage.getItem('keybind_pause') || 'escape',
  restart: localStorage.getItem('keybind_restart') || 'r'
};

let highscore = parseInt(localStorage.getItem('highscore') || '0', 10);
let coinCounter = parseInt(localStorage.getItem('coins') || '0', 10);
let itemInventory = {
  x2: parseInt(localStorage.getItem('inv_x2') || '0', 10),
  shield: parseInt(localStorage.getItem('inv_shield') || '0', 10),
  blitz: parseInt(localStorage.getItem('inv_blitz') || '0', 10)
};
let caseSpins = {
  1: parseInt(localStorage.getItem('inv_caseSpin1') || '0', 10),
  2: parseInt(localStorage.getItem('inv_caseSpin2') || '0', 10),
  3: parseInt(localStorage.getItem('inv_caseSpin3') || '0', 10)
};

let ownedBackgrounds = new Set(['1']);
let ownedCharacters = new Set(['1']);
for (const bg of backgrounds) if (localStorage.getItem('bg' + bg.id + 'Owned') === 'true') ownedBackgrounds.add(bg.id);
for (const ch of characters) if (localStorage.getItem('char' + ch.id + 'Owned') === 'true') ownedCharacters.add(ch.id);
let currentBg = localStorage.getItem('bgSelected') || '1';
let currentCharacter = localStorage.getItem('characterSelected') || '1';
let highestUnlockedLevel = parseInt(localStorage.getItem('highestUnlockedLevel') || '1', 10);
if (!ownedBackgrounds.has(currentBg)) currentBg = '1';
if (!ownedCharacters.has(currentCharacter)) currentCharacter = '1';

let selectedMode = '';
let currentLevel = 0;
let gameActive = false;
let gameOver = false;
let pause = false;
let intro = true;
let bgX = 0;
let difficultyFactor = NORMAL_MODE_FACTOR;
let score = 0;
let scoreFloat = 0;
let endlessStartTime = 0;
let score2x = false;
let score2xUntil = 0;
let blitzUntil = 0;
let shieldHits = 0;
let shieldUntil = 0;
let powerUpCooldownUntil = 0;
let currentGameMusic = null;

const player = {
  x: 220,
  y: 210,
  w: PLAYER_DRAW_W,
  h: PLAYER_DRAW_H,
  hitW: PLAYER_HIT_W,
  hitH: PLAYER_HIT_H,
  speed: 5.2,
  invincibleUntil: 0
};

let enemies = [];
let coins = [];
let clouds = [];
let powerUps = [];

let localSetup = {
  p1Name: 'Spieler 1',
  p2Name: 'Spieler 2',
  p1Char: '1',
  p2Char: '3',
  bg: '1'
};

let twoPlayer = {
  active: false,
  over: false,
  winner: '',
  background: '1',
  p1: null,
  p2: null,
  online: false,
  host: false,
  guest: false
};

let onlineState = {
  role: null,
  code: '',
  lobby: null,
  ready: false,
  connected: false
};

function saveInventory() {
  localStorage.setItem('inv_x2', itemInventory.x2);
  localStorage.setItem('inv_shield', itemInventory.shield);
  localStorage.setItem('inv_blitz', itemInventory.blitz);
  localStorage.setItem('inv_caseSpin1', caseSpins[1]);
  localStorage.setItem('inv_caseSpin2', caseSpins[2]);
  localStorage.setItem('inv_caseSpin3', caseSpins[3]);
}

function saveOwnership() {
  backgrounds.forEach(bg => {
    if (bg.id !== '1') localStorage.setItem('bg' + bg.id + 'Owned', ownedBackgrounds.has(bg.id) ? 'true' : 'false');
  });
  characters.forEach(ch => {
    if (ch.id !== '1') localStorage.setItem('char' + ch.id + 'Owned', ownedCharacters.has(ch.id) ? 'true' : 'false');
  });
}

function showToast(text, duration = 2400) {
  statusToast.textContent = text;
  statusToast.style.display = 'block';
  clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => {
    statusToast.style.display = 'none';
  }, duration);
}

function openOnly(menu) {
  allMenus.forEach(m => m.classList.add('hidden'));
  menu.classList.remove('hidden');
}

function closeAllMenus() {
  allMenus.forEach(m => m.classList.add('hidden'));
}

function safePlay(audio) {
  const p = audio.play();
  if (p && typeof p.catch === 'function') p.catch(() => {});
}

function stopAudio(audio) {
  audio.pause();
  audio.currentTime = 0;
}

function playSfx(audio) {
  if (sfxMuted) return;
  try {
    const clone = audio.cloneNode();
    clone.volume = 1;
    safePlay(clone);
  } catch {
    safePlay(audio);
  }
}

function playButtonSound() { playSfx(buttonSound); }
function playLockSound() { playSfx(lockSound); }
function playCoinPickup() { playSfx(coinSound); }
function playCaseSound() { playSfx(caseSound); }

function stopAllGameMusic() {
  stopAudio(gameMusic);
  stopAudio(altGameMusic);
  stopAudio(twoPlayerMusic);
  currentGameMusic = null;
}

function startMenuMusic() {
  stopAllGameMusic();
  safePlay(menuMusic);
}

function startSelectedGameMusic(audioFile) {
  stopAllGameMusic();
  menuMusic.pause();
  menuMusic.currentTime = 0;
  let target = gameMusic;
  if (audioFile === 'Musik.mp3') target = altGameMusic;
  if (audioFile === 'Epische musik.mp3' || audioFile === 'Epische musik2.mp3') {
    twoPlayerMusic.src = audioFile;
    twoPlayerMusic.load();
    target = twoPlayerMusic;
  }
  currentGameMusic = target;
  safePlay(target);
}

function getClassicMusicFile(level) {
  return level === 2 || level === 4 ? 'Musik.mp3' : 'Music.mp3';
}

function startSingleGameMusic() {
  if (selectedMode === 'classic') {
    startSelectedGameMusic(getClassicMusicFile(currentLevel));
    return;
  }
  if (selectedMode === 'endless') {
    startSelectedGameMusic(endlessMusicOptions[Math.floor(Math.random() * endlessMusicOptions.length)]);
  }
}

function startTwoPlayerMusic() {
  startSelectedGameMusic(twoPlayerMusicOptions[Math.floor(Math.random() * twoPlayerMusicOptions.length)]);
}

function resumeCurrentGameMusic() {
  if (currentGameMusic) safePlay(currentGameMusic);
}

function enableMenuMusicOnce() {
  if (firstInteractionDone) return;
  firstInteractionDone = true;
  startMenuMusic();
}

document.addEventListener('click', enableMenuMusicOnce);
document.addEventListener('keydown', enableMenuMusicOnce);

function formatKeyName(key) {
  if (key === ' ') return 'SPACE';
  if (key === 'escape') return 'ESC';
  if (key === 'arrowup') return 'ArrowUp';
  if (key === 'arrowdown') return 'ArrowDown';
  if (key.length === 1) return key.toUpperCase();
  return key;
}

function refreshKeybindButtons() {
  document.getElementById('bindUp').textContent = formatKeyName(keybinds.up);
  document.getElementById('bindDown').textContent = formatKeyName(keybinds.down);
  document.getElementById('bindPause').textContent = formatKeyName(keybinds.pause);
  document.getElementById('bindRestart').textContent = formatKeyName(keybinds.restart);
}

function getBackgroundImageById(id) {
  return images['bg' + id] || images.bg1;
}

function getCharacterImageById(id) {
  return images['char' + id] || images.char1;
}

function getActiveBackground() {
  if (selectedMode === 'classic') return getBackgroundImageById(String(currentLevel));
  if (selectedMode === 'twoplayer') return getBackgroundImageById(twoPlayer.background);
  return getBackgroundImageById(currentBg);
}

function createVariedEnemy(areaTop, areaBottom, baseX, forcedType = null) {
  const type = forcedType || (Math.random() < 0.5 ? 'jet' : 'ufo');
  const scale = 0.68 + Math.random() * 0.14;
  const speedMul = 0.92 + Math.random() * 0.22;
  let baseW = 75, baseH = 75, hitW = 62, hitH = 48;
  if (type === 'ufo') {
    baseW = 120;
    baseH = 75;
    hitW = 100;
    hitH = 48;
  }
  const w = Math.round(baseW * scale);
  const h = Math.round(baseH * scale);
  return {
    x: baseX,
    y: areaTop + Math.random() * Math.max(20, areaBottom - areaTop - h),
    w,
    h,
    hitW: Math.round(hitW * scale),
    hitH: Math.round(hitH * scale),
    type,
    speedMul
  };
}

function getNextEnemyX(enemyList) {
  if (!enemyList.length) return canvas.width + 120;
  let maxX = canvas.width;
  enemyList.forEach(e => { if (e.x > maxX) maxX = e.x; });
  return maxX + 120 + Math.random() * 170;
}

function createTwoPlayerPlayer(name, controls, areaTop, areaBottom, sprite) {
  const p = {
    name,
    controls,
    areaTop,
    areaBottom,
    x: 160,
    y: areaTop + (areaBottom - areaTop) / 2 - PLAYER_DRAW_H / 2,
    w: PLAYER_DRAW_W,
    h: PLAYER_DRAW_H,
    hitW: PLAYER_HIT_W,
    hitH: PLAYER_HIT_H,
    speed: 5.2,
    alive: true,
    score: 0,
    scoreFloat: 0,
    coins: 0,
    enemies: [],
    coinItems: [],
    powerItems: [],
    clouds: [],
    sprite,
    speedDebuffUntil: 0,
    self2xUntil: 0,
    blitzUntil: 0,
    shieldHits: 0,
    shieldUntil: 0,
    invincibleUntil: 0,
    attackMessage: '',
    attackMessageUntil: 0,
    cooldowns: { jet: 0, ufo: 0, speed: 0, self2x: 0, selfBlitz: 0, selfShield: 0 }
  };
  p.enemies.push(createVariedEnemy(areaTop, areaBottom, canvas.width + 120, 'jet'));
  p.enemies.push(createVariedEnemy(areaTop, areaBottom, canvas.width + 290, 'ufo'));
  return p;
}

function resetSinglePlayerState() {
  player.x = -120;
  player.y = canvas.height / 2 - PLAYER_DRAW_H / 2;
  player.invincibleUntil = 0;
  enemies = [];
  coins = [];
  clouds = [];
  powerUps = [];
  score = 0;
  scoreFloat = 0;
  gameOver = false;
  pause = false;
  intro = true;
  bgX = 0;
  score2x = false;
  score2xUntil = 0;
  blitzUntil = 0;
  shieldHits = 0;
  shieldUntil = 0;
  powerUpCooldownUntil = Date.now() + 12000;
  endlessStartTime = Date.now();
}

function spawnSingleEnemies() {
  enemies = [];
  enemies.push(createVariedEnemy(0, canvas.height, canvas.width + 140, 'jet'));
  enemies.push(createVariedEnemy(0, canvas.height, canvas.width + 330, 'ufo'));
}

function spawnSingleCloud() {
  if (clouds.length >= 6) return;
  const img = wolkenBilder[Math.floor(Math.random() * wolkenBilder.length)];
  clouds.push({ x: canvas.width + Math.random() * 120, y: Math.random() * 150, speed: 0.8 + Math.random() * 1.2, img });
}

function getDifficultyForCurrentMode() {
  if (selectedMode === 'endless') return difficultyFactor;
  return NORMAL_MODE_FACTOR;
}

function getSpeedFactor(scoreValue, modeFactor) {
  if (scoreValue < 50) return 1;
  return Math.pow(modeFactor, Math.floor(scoreValue / 50));
}

function getBackgroundScrollSpeed() {
  if (selectedMode === 'twoplayer' && twoPlayer.online && !twoPlayer.host && twoPlayer.guest) return 0;
  if (selectedMode === 'twoplayer' && twoPlayer.active && twoPlayer.p1 && twoPlayer.p2) {
    const avgScore = ((twoPlayer.p1.score || 0) + (twoPlayer.p2.score || 0)) / 2;
    return 1.2 * getSpeedFactor(avgScore, NORMAL_MODE_FACTOR);
  }
  if (selectedMode === 'classic' || selectedMode === 'endless') {
    return 1.2 * getSpeedFactor(score, getDifficultyForCurrentMode());
  }
  return 1.2;
}

function applySinglePower(type) {
  if (type === '2x') {
    score2x = true;
    score2xUntil = Date.now() + 8000;
  }
  if (type === 'blitz') blitzUntil = Date.now() + 8000;
  if (type === 'shield') {
    shieldHits = 1;
    shieldUntil = Date.now() + 5000;
  }
}

function applyTwoPlayerPower(tpPlayer, type) {
  if (type === '2x') tpPlayer.self2xUntil = Date.now() + 8000;
  if (type === 'blitz') tpPlayer.blitzUntil = Date.now() + 8000;
  if (type === 'shield') {
    tpPlayer.shieldHits = 1;
    tpPlayer.shieldUntil = Date.now() + 5000;
  }
}

function handleSingleHit() {
  if (adminGodMode) return;
  if (Date.now() < player.invincibleUntil) return;
  if (shieldHits > 0 && Date.now() < shieldUntil) {
    shieldHits = 0;
    player.invincibleUntil = Date.now() + 2000;
    return;
  }
  gameOver = true;
  gameActive = false;
  stopAllGameMusic();
  document.getElementById('singleGameOverText').textContent = 'Score: ' + score;
  openOnly(document.getElementById('singleGameOverMenu'));
}

function handleTwoPlayerHit(tpPlayer) {
  if (adminGodMode) return;
  if (Date.now() < tpPlayer.invincibleUntil) return;
  if (tpPlayer.shieldHits > 0 && Date.now() < tpPlayer.shieldUntil) {
    tpPlayer.shieldHits = 0;
    tpPlayer.invincibleUntil = Date.now() + 2000;
    return;
  }
  tpPlayer.alive = false;
}

function rewardInfo(reward) {
  if (reward.type === 'x2') return { label: reward.qty + 'x 2X', image: images.x2 };
  if (reward.type === 'shield') return { label: reward.qty + 'x Schild', image: images.shield };
  if (reward.type === 'blitz') return { label: reward.qty + 'x Blitz', image: images.blitz };
  if (reward.type === 'case1spin') return { label: reward.qty + 'x Kupfer-Spin', image: images.freeSpin };
  if (reward.type === 'case2spin') return { label: reward.qty + 'x Silber-Spin', image: images.freeSpin };
  if (reward.type === 'case3spin') return { label: reward.qty + 'x Diamant-Spin', image: images.freeSpin };
  return { label: 'Clown', image: images.clown };
}

function getRewardPool(caseType) {
  if (caseType === 1) {
    return [
      { type: 'x2', qty: 1, weight: 10 }, { type: 'shield', qty: 1, weight: 10 }, { type: 'blitz', qty: 1, weight: 10 },
      { type: 'x2', qty: 2, weight: 3 }, { type: 'shield', qty: 2, weight: 3 }, { type: 'blitz', qty: 2, weight: 3 },
      { type: 'case1spin', qty: 1, weight: 6 }, { type: 'nothing', qty: 1, weight: 55 }
    ];
  }
  if (caseType === 2) {
    return [
      { type: 'x2', qty: 1, weight: 10 }, { type: 'shield', qty: 1, weight: 10 }, { type: 'blitz', qty: 1, weight: 10 },
      { type: 'x2', qty: 2, weight: 8 }, { type: 'shield', qty: 2, weight: 8 }, { type: 'blitz', qty: 2, weight: 8 },
      { type: 'case1spin', qty: 1, weight: 4 }, { type: 'case2spin', qty: 1, weight: 8 }, { type: 'case2spin', qty: 2, weight: 4 },
      { type: 'nothing', qty: 1, weight: 30 }
    ];
  }
  return [
    { type: 'x2', qty: 2, weight: 12 }, { type: 'shield', qty: 2, weight: 12 }, { type: 'blitz', qty: 2, weight: 12 },
    { type: 'x2', qty: 3, weight: 10 }, { type: 'shield', qty: 3, weight: 10 }, { type: 'blitz', qty: 3, weight: 10 },
    { type: 'case2spin', qty: 1, weight: 6 }, { type: 'case3spin', qty: 1, weight: 8 }, { type: 'case3spin', qty: 2, weight: 4 },
    { type: 'nothing', qty: 1, weight: 16 }
  ];
}

function pickReward(caseType) {
  const pool = getRewardPool(caseType);
  const total = pool.reduce((sum, item) => sum + item.weight, 0);
  let r = Math.random() * total;
  for (const item of pool) {
    r -= item.weight;
    if (r <= 0) return { ...item };
  }
  return { ...pool[pool.length - 1] };
}

function renderRouletteWindow(sequence, centerIndex) {
  const container = document.getElementById('rouletteWindow');
  container.innerHTML = '';
  for (let offset = -2; offset <= 2; offset++) {
    const index = Math.max(0, Math.min(sequence.length - 1, centerIndex + offset));
    const reward = sequence[index];
    const info = rewardInfo(reward);
    const card = document.createElement('div');
    card.className = 'rouletteCard' + (offset === 0 ? ' rouletteCenter' : '');
    card.innerHTML = `<img src="${info.image.src}"><div>${info.label}</div>`;
    container.appendChild(card);
  }
}

function applyReward(reward) {
  if (reward.type === 'x2') itemInventory.x2 += reward.qty;
  if (reward.type === 'shield') itemInventory.shield += reward.qty;
  if (reward.type === 'blitz') itemInventory.blitz += reward.qty;
  if (reward.type === 'case1spin') caseSpins[1] += reward.qty;
  if (reward.type === 'case2spin') caseSpins[2] += reward.qty;
  if (reward.type === 'case3spin') caseSpins[3] += reward.qty;
  saveInventory();
  updateItemsMenu();
  updateCasesMenu();
}

function animateCaseOpen(caseType, result, sequence, resultIndex) {
  if (caseAnimationFrame) cancelAnimationFrame(caseAnimationFrame);
  const duration = 7000;
  const startCenterIndex = 2;
  const totalDistance = resultIndex - startCenterIndex;
  let lastRenderedIndex = -1;
  const startTime = performance.now();
  playCaseSound();
  document.getElementById('caseResultText').textContent = 'Rolling...';

  function step(now) {
    const elapsed = now - startTime;
    const progress = Math.min(elapsed / duration, 1);
    const eased = 1 - Math.pow(1 - progress, 3);
    let centerIndex = Math.floor(startCenterIndex + totalDistance * eased);
    if (centerIndex > resultIndex) centerIndex = resultIndex;
    if (centerIndex !== lastRenderedIndex) {
      renderRouletteWindow(sequence, centerIndex);
      lastRenderedIndex = centerIndex;
    }
    if (progress < 1) {
      caseAnimationFrame = requestAnimationFrame(step);
    } else {
      renderRouletteWindow(sequence, resultIndex);
      applyReward(result);
      document.getElementById('caseResultText').textContent = 'Gewonnen: ' + rewardInfo(result).label;
      caseSpinActive = false;
    }
  }

  caseAnimationFrame = requestAnimationFrame(step);
}

function openCase(caseType) {
  if (caseSpinActive) return;
  const cfg = caseConfigs.find(c => c.id === caseType);
  const cost = cfg.price;
  if (caseSpins[caseType] > 0) {
    caseSpins[caseType]--;
  } else {
    if (coinCounter < cost) {
      playLockSound();
      return;
    }
    coinCounter -= cost;
    localStorage.setItem('coins', coinCounter);
  }
  saveInventory();
  updateCasesMenu();
  updateItemsMenu();
  const result = pickReward(caseType);
  const sequence = [];
  for (let i = 0; i < 56; i++) sequence.push(pickReward(caseType));
  const resultIndex = 50;
  sequence[resultIndex] = result;
  caseSpinActive = true;
  renderRouletteWindow(sequence, 2);
  animateCaseOpen(caseType, result, sequence, resultIndex);
}

function formatCaseSpinText(count) {
  return count === 1 ? '1 freier Spin' : count + ' freie Spins';
}

function updateItemsMenu() {
  document.getElementById('itemsCount2x').textContent = '2X: ' + itemInventory.x2;
  document.getElementById('itemsCountShield').textContent = 'Schild: ' + itemInventory.shield;
  document.getElementById('itemsCountBlitz').textContent = 'Blitz: ' + itemInventory.blitz;
  document.getElementById('itemsCountCaseSpins').innerHTML = 'Kupfer: ' + caseSpins[1] + '<br>Silber: ' + caseSpins[2] + '<br>Diamant: ' + caseSpins[3];
}

function updateCasesMenu() {
  document.getElementById('freeSpinsText').textContent = 'Freie Spins gelten immer nur für genau diese Kiste.';
  const grid = document.getElementById('casesGrid');
  grid.innerHTML = '';
  caseConfigs.forEach(cfg => {
    const card = document.createElement('div');
    card.className = 'cardBox';
    card.innerHTML = `
      <div class="smallText">${formatCaseSpinText(caseSpins[cfg.id])}</div>
      <img src="${cfg.src}" class="casePreview">
      <div class="smallText">${cfg.name} - ${cfg.price} Münzen</div>
      <button class="tightBtn">Öffnen</button>
    `;
    card.querySelector('button').onclick = () => openCase(cfg.id);
    grid.appendChild(card);
  });
}

function updateSingleItemBar() {
  if ((selectedMode === 'classic' || selectedMode === 'endless') && (gameActive || gameOver || pause)) {
    singleItemBar.style.display = 'block';
    singleItemBar.innerHTML = `
      <div class="itemHotbar">
        <div class="itemHotbarEntry"><img src="${images.x2.src}"><span>1 = ${itemInventory.x2}</span></div>
        <div class="itemHotbarEntry"><img src="${images.shield.src}"><span>2 = ${itemInventory.shield}</span></div>
        <div class="itemHotbarEntry"><img src="${images.blitz.src}"><span>3 = ${itemInventory.blitz}</span></div>
      </div>
    `;
  } else {
    singleItemBar.style.display = 'none';
  }
}

function buildSkinCard(item, type, owned, selected, onClick, options = {}) {
  const { showPrice = false, shopMode = false } = options;
  const card = document.createElement('div');
  card.className = 'cardBox';

  const previewClass = type === 'bg' ? 'skinPreview' : 'characterPreview';
  const overlay = !owned ? '<div class="lockOverlay">🔒</div>' : '';

  let tag = '';
  if (shopMode && owned) {
    tag = '<div class="equippedTag" style="display:block;">Gekauft</div>';
  } else if (!shopMode && selected) {
    tag = '<div class="equippedTag" style="display:block;">Equipped</div>';
  }

  const priceText = showPrice ? ` - ${item.price === 0 ? 'Gratis' : item.price + ' Münzen'}` : '';

  let buttonText = 'Select';
  let buttonDisabled = false;
  if (shopMode) {
    buttonText = owned ? 'Gekauft' : 'Kaufen';
    buttonDisabled = owned;
  } else {
    buttonText = selected ? 'Equipped' : 'Select';
  }

  card.innerHTML = `
    <div class="previewWrap">
      <img src="${item.src}" class="${previewClass}">
      ${overlay}
      ${tag}
    </div>
    <div class="smallText">${item.name}${priceText}</div>
    <button class="tightBtn" ${buttonDisabled ? 'disabled' : ''}>${buttonText}</button>
  `;

  const button = card.querySelector('button');
  if (!buttonDisabled) {
    button.onclick = () => {
      playButtonSound();
      onClick();
    };
  }

  if (selected && !shopMode) card.classList.add('selectedCard');
  return card;
}

function renderSkinsAndShop() {
  const skinsBgGrid = document.getElementById('skinsBgGrid');
  const skinsCharGrid = document.getElementById('skinsCharGrid');
  const shopBgGrid = document.getElementById('shopBgGrid');
  const shopCharGrid = document.getElementById('shopCharGrid');
  skinsBgGrid.innerHTML = '';
  skinsCharGrid.innerHTML = '';
  shopBgGrid.innerHTML = '';
  shopCharGrid.innerHTML = '';

  backgrounds.forEach(bg => {
    skinsBgGrid.appendChild(buildSkinCard(bg, 'bg', ownedBackgrounds.has(bg.id), currentBg === bg.id, () => {
      if (!ownedBackgrounds.has(bg.id)) {
        playLockSound();
        return;
      }
      currentBg = bg.id;
      localStorage.setItem('bgSelected', currentBg);
      renderSkinsAndShop();
    }));

    shopBgGrid.appendChild(buildSkinCard(bg, 'bg', ownedBackgrounds.has(bg.id), false, () => {
      if (ownedBackgrounds.has(bg.id)) return;
      if (coinCounter < bg.price) {
        playLockSound();
        return;
      }
      coinCounter -= bg.price;
      ownedBackgrounds.add(bg.id);
      localStorage.setItem('coins', coinCounter);
      saveOwnership();
      renderSkinsAndShop();
    }, { showPrice: true, shopMode: true }));
  });

  characters.forEach(ch => {
    skinsCharGrid.appendChild(buildSkinCard(ch, 'char', ownedCharacters.has(ch.id), currentCharacter === ch.id, () => {
      if (!ownedCharacters.has(ch.id)) {
        playLockSound();
        return;
      }
      currentCharacter = ch.id;
      localStorage.setItem('characterSelected', currentCharacter);
      renderSkinsAndShop();
    }));

    shopCharGrid.appendChild(buildSkinCard(ch, 'char', ownedCharacters.has(ch.id), false, () => {
      if (ownedCharacters.has(ch.id)) return;
      if (coinCounter < ch.price) {
        playLockSound();
        return;
      }
      coinCounter -= ch.price;
      ownedCharacters.add(ch.id);
      localStorage.setItem('coins', coinCounter);
      saveOwnership();
      renderSkinsAndShop();
    }, { showPrice: true, shopMode: true }));
  });
}

function updateClassicLevelButtons() {
  for (let i = 1; i <= 4; i++) {
    const btn = document.getElementById('levelBtn' + i);
    if (i <= highestUnlockedLevel) {
      btn.disabled = false;
      btn.classList.remove('levelLocked');
      btn.textContent = 'Level ' + i;
    } else {
      btn.disabled = true;
      btn.classList.add('levelLocked');
      btn.textContent = 'Level ' + i + ' 🔒';
    }
  }
}

function drawScrollingBackground(areaTop = 0, areaHeight = canvas.height) {
  const bg = getActiveBackground();
  ctx.drawImage(bg, bgX, areaTop, canvas.width + 2, areaHeight);
  ctx.drawImage(bg, bgX + canvas.width - 1, areaTop, canvas.width + 2, areaHeight);
}

function drawEnemy(enemy) {
  if (enemy.type === 'jet') {
    ctx.save();
    ctx.translate(enemy.x + enemy.w / 2, enemy.y + enemy.h / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.drawImage(images.jet, -enemy.w / 2, -enemy.h / 2, enemy.w, enemy.h);
    ctx.restore();
  } else {
    ctx.drawImage(images.ufo, enemy.x, enemy.y, enemy.w, enemy.h);
  }
}

function drawPowerIcon(type, x, y, w, h) {
  if (type === '2x') ctx.drawImage(images.x2, x, y, w, h);
  if (type === 'blitz') ctx.drawImage(images.blitz, x, y, w, h);
  if (type === 'shield') ctx.drawImage(images.shield, x, y, w, h);
}

function drawShieldOnChest(rect, active) {
  if (!active) return;
  const sx = rect.x + rect.w / 2 - 10;
  const sy = rect.y + rect.h / 2 - 10;
  ctx.drawImage(images.shield, sx, sy, 20, 20);
}

function drawCanvasEffectCard(x, y, img, timeText, size = 56) {
  ctx.fillStyle = 'rgba(0,0,0,0.6)';
  ctx.fillRect(x, y, size + 12, size + 30);
  ctx.drawImage(img, x + 6, y + 4, size, size);
  ctx.fillStyle = 'white';
  ctx.font = '15px Arial';
  ctx.textAlign = 'center';
  ctx.fillText(timeText, x + (size + 12) / 2, y + size + 24);
}

function drawSingleEffectCards() {
  const effects = [];
  if (score2x && Date.now() < score2xUntil) effects.push({ img: images.x2, text: ((score2xUntil - Date.now()) / 1000).toFixed(1) + 's' });
  if (Date.now() < blitzUntil) effects.push({ img: images.blitz, text: ((blitzUntil - Date.now()) / 1000).toFixed(1) + 's' });
  if (shieldHits > 0 && Date.now() < shieldUntil) effects.push({ img: images.shield, text: ((shieldUntil - Date.now()) / 1000).toFixed(1) + 's' });
  if (!effects.length) return;
  const cardWidth = 68;
  const gap = 12;
  const totalWidth = effects.length * cardWidth + (effects.length - 1) * gap;
  const startX = (canvas.width - totalWidth) / 2;
  effects.forEach((effect, index) => drawCanvasEffectCard(startX + index * (cardWidth + gap), 10, effect.img, effect.text, 56));
}

function drawTwoPlayerEffectCards(tpPlayer) {
  const effects = [];
  if (Date.now() < tpPlayer.self2xUntil) effects.push({ img: images.x2, text: ((tpPlayer.self2xUntil - Date.now()) / 1000).toFixed(1) + 's' });
  if (Date.now() < tpPlayer.blitzUntil) effects.push({ img: images.blitz, text: ((tpPlayer.blitzUntil - Date.now()) / 1000).toFixed(1) + 's' });
  if (tpPlayer.shieldHits > 0 && Date.now() < tpPlayer.shieldUntil) effects.push({ img: images.shield, text: ((tpPlayer.shieldUntil - Date.now()) / 1000).toFixed(1) + 's' });
  if (Date.now() < tpPlayer.speedDebuffUntil) effects.push({ img: images.speed, text: ((tpPlayer.speedDebuffUntil - Date.now()) / 1000).toFixed(1) + 's' });
  if (!effects.length) return;
  const cardWidth = 56;
  const gap = 8;
  const totalWidth = effects.length * cardWidth + (effects.length - 1) * gap;
  const startX = (canvas.width - totalWidth) / 2;
  effects.forEach((effect, index) => drawCanvasEffectCard(startX + index * (cardWidth + gap), tpPlayer.areaTop + 36, effect.img, effect.text, 44));
}

function getSinglePowerText() {
  const parts = [];
  if (selectedMode === 'endless' && gameActive) {
    const secs = Math.floor((Date.now() - endlessStartTime) / 1000);
    parts.push('Zeit ' + secs + 's');
  }
  return parts.join(' | ');
}

function drawSinglePlayer() {
  drawScrollingBackground(0, canvas.height);
  clouds.forEach(c => ctx.drawImage(images[c.img], c.x, c.y, 96, 56));
  if (gameActive || gameOver || pause) {
    const rect = { x: player.x, y: player.y, w: player.w, h: player.h };
    ctx.drawImage(getCharacterImageById(currentCharacter), rect.x, rect.y, rect.w, rect.h);
    drawShieldOnChest(rect, shieldHits > 0 && Date.now() < shieldUntil);
  }
  enemies.forEach(drawEnemy);
  coins.forEach(c => ctx.drawImage(images.coin, c.x, c.y, 42, 42));
  powerUps.forEach(p => drawPowerIcon(p.type, p.x, p.y, p.w, p.h));
  drawSingleEffectCards();
  powerDisplay.textContent = getSinglePowerText();
  if (gameActive && selectedMode === 'classic') {
    ctx.fillStyle = 'white';
    ctx.font = '20px Arial';
    ctx.textAlign = 'left';
    ctx.fillText('Score: ' + score + ' / ' + levelTargets[currentLevel], canvas.width - 180, 38);
  }
  scoreBoard.innerHTML = gameActive ? 'Score: ' + score + ' | Highscore: ' + highscore + ' | Münzen: ' + coinCounter : 'Highscore: ' + highscore + ' | Münzen: ' + coinCounter;
}

function drawTwoPlayerHalf(tpPlayer) {
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, tpPlayer.areaTop, canvas.width, tpPlayer.areaBottom - tpPlayer.areaTop);
  ctx.clip();
  drawScrollingBackground(tpPlayer.areaTop, tpPlayer.areaBottom - tpPlayer.areaTop);
  tpPlayer.clouds.forEach(c => ctx.drawImage(images[c.img], c.x, c.y, 90, 52));
  const rect = { x: tpPlayer.x, y: tpPlayer.y, w: tpPlayer.w, h: tpPlayer.h };
  ctx.drawImage(getCharacterImageById(tpPlayer.sprite), rect.x, rect.y, rect.w, rect.h);
  drawShieldOnChest(rect, tpPlayer.shieldHits > 0 && Date.now() < tpPlayer.shieldUntil);
  tpPlayer.enemies.forEach(drawEnemy);
  tpPlayer.coinItems.forEach(c => ctx.drawImage(images.coin, c.x, c.y, c.w, c.h));
  tpPlayer.powerItems.forEach(p => drawPowerIcon(p.type, p.x, p.y, p.w, p.h));
  ctx.restore();
  ctx.fillStyle = 'rgba(0,0,0,0.45)';
  ctx.fillRect(0, tpPlayer.areaTop, canvas.width, 30);
  ctx.fillStyle = 'white';
  ctx.font = '18px Arial';
  ctx.textAlign = 'left';
  ctx.fillText(tpPlayer.name + ' | Score: ' + tpPlayer.score + ' | Münzen: ' + tpPlayer.coins, 12, tpPlayer.areaTop + 21);
  drawTwoPlayerEffectCards(tpPlayer);
  if (Date.now() < tpPlayer.attackMessageUntil) {
    ctx.fillStyle = '#ffd700';
    ctx.font = '24px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(tpPlayer.attackMessage, canvas.width / 2, tpPlayer.areaTop + 108);
  }
  if (!tpPlayer.alive) {
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(0, tpPlayer.areaTop, canvas.width, tpPlayer.areaBottom - tpPlayer.areaTop);
    ctx.fillStyle = 'red';
    ctx.font = '54px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('K.O.', canvas.width / 2, tpPlayer.areaTop + (tpPlayer.areaBottom - tpPlayer.areaTop) / 2);
  }
}

function drawTwoPlayer() {
  drawTwoPlayerHalf(twoPlayer.p1);
  drawTwoPlayerHalf(twoPlayer.p2);
  ctx.fillStyle = '#222';
  ctx.fillRect(0, canvas.height / 2 - 2, canvas.width, 4);
  powerDisplay.textContent = '';
  scoreBoard.innerHTML = 'Two-Player Mode';
}

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  if (twoPlayer.active && twoPlayer.p1 && twoPlayer.p2) drawTwoPlayer();
  else drawSinglePlayer();
}

function updateOnlineHelpText() {
  if (!twoPlayer.active || !twoPlayer.p1 || !twoPlayer.p2) {
    hudTop.classList.add('hidden');
    hudBottom.classList.add('hidden');
    return;
  }
  hudTop.innerHTML = `
    <div>${twoPlayer.p1.name} (W / S)</div>
    <div class="attackLine"><img src="Kampfjet.webp"><span>1 = Jet senden <span class="priceRed">5</span></span></div>
    <div class="attackLine"><img src="ufo.png"><span>2 = UFO senden <span class="priceRed">8</span></span></div>
    <div class="attackLine"><img src="Speed.png"><span>3 = Speed senden <span class="priceRed">10</span></span></div>
    <div class="attackLine"><img src="2x.png"><span>4 = 2X kaufen <span class="priceRed">6</span></span></div>
    <div class="attackLine"><img src="Blitz.png"><span>5 = Blitz kaufen <span class="priceRed">6</span></span></div>
    <div class="attackLine"><img src="Schild.png"><span>6 = Schild kaufen <span class="priceRed">8</span></span></div>
  `;
  hudBottom.innerHTML = `
    <div>${twoPlayer.p2.name} (↑ / ↓)</div>
    <div class="attackLine"><img src="Kampfjet.webp"><span>7 = Jet senden <span class="priceRed">5</span></span></div>
    <div class="attackLine"><img src="ufo.png"><span>8 = UFO senden <span class="priceRed">8</span></span></div>
    <div class="attackLine"><img src="Speed.png"><span>9 = Speed senden <span class="priceRed">10</span></span></div>
    <div class="attackLine"><img src="2x.png"><span>J = 2X kaufen <span class="priceRed">6</span></span></div>
    <div class="attackLine"><img src="Blitz.png"><span>K = Blitz kaufen <span class="priceRed">6</span></span></div>
    <div class="attackLine"><img src="Schild.png"><span>L = Schild kaufen <span class="priceRed">8</span></span></div>
  `;
  hudTop.classList.remove('hidden');
  hudBottom.classList.remove('hidden');
}

function hideTwoPlayerHelp() {
  hudTop.classList.add('hidden');
  hudBottom.classList.add('hidden');
}

function giveClassicReward(level) {
  let rewardImage = 'Kiste.png';
  let rewardText = '';
  if (level === 1) { caseSpins[1] += 1; rewardImage = 'Kiste.png'; rewardText = 'Als Belohnung: 1 freier Spin für die Kupferkiste'; }
  else if (level === 2) { caseSpins[2] += 1; rewardImage = 'Kiste2.png'; rewardText = 'Als Belohnung: 1 freier Spin für die Silberkiste'; }
  else if (level === 3) { caseSpins[2] += 2; rewardImage = 'Kiste2.png'; rewardText = 'Als Belohnung: 2 freie Spins für die Silberkiste'; }
  else if (level === 4) { caseSpins[3] += 1; rewardImage = 'Kiste3.png'; rewardText = 'Als Belohnung: 1 freier Spin für die Diamantkiste'; }
  saveInventory();
  updateItemsMenu();
  updateCasesMenu();
  document.getElementById('levelRewardImage').src = rewardImage;
  document.getElementById('levelRewardText').textContent = rewardText;
  document.getElementById('nextLevelBtn').classList.toggle('hidden', level >= 4);
}

function startClassicLevel(level) {
  selectedMode = 'classic';
  currentLevel = level;
  difficultyFactor = NORMAL_MODE_FACTOR;
  resetSinglePlayerState();
  gameActive = true;
  twoPlayer.active = false;
  twoPlayer.online = false;
  hideTwoPlayerHelp();
  spawnSingleEnemies();
  closeAllMenus();
  startSingleGameMusic();
}

function startEndless() {
  selectedMode = 'endless';
  currentLevel = 0;
  resetSinglePlayerState();
  gameActive = true;
  twoPlayer.active = false;
  twoPlayer.online = false;
  hideTwoPlayerHelp();
  spawnSingleEnemies();
  closeAllMenus();
  startSingleGameMusic();
}

function startLocalTwoPlayer() {
  selectedMode = 'twoplayer';
  difficultyFactor = NORMAL_MODE_FACTOR;
  gameActive = false;
  gameOver = false;
  pause = false;
  bgX = 0;
  closeAllMenus();
  twoPlayer.active = true;
  twoPlayer.over = false;
  twoPlayer.online = false;
  twoPlayer.host = false;
  twoPlayer.guest = false;
  twoPlayer.background = localSetup.bg;
  twoPlayer.p1 = createTwoPlayerPlayer(localSetup.p1Name, { up: 'w', down: 's', jet: '1', ufo: '2', speed: '3', self2x: '4', selfBlitz: '5', selfShield: '6' }, 0, canvas.height / 2 - 3, localSetup.p1Char);
  twoPlayer.p2 = createTwoPlayerPlayer(localSetup.p2Name, { up: 'arrowup', down: 'arrowdown', jet: '7', ufo: '8', speed: '9', self2x: 'j', selfBlitz: 'k', selfShield: 'l' }, canvas.height / 2 + 3, canvas.height, localSetup.p2Char);
  updateOnlineHelpText();
  startTwoPlayerMusic();
}

function applyLobbyChoices(lobby) {
  onlineState.lobby = lobby;
  document.getElementById('onlineLobbyCode').textContent = lobby.code;
  document.getElementById('onlineLobbyRoleText').textContent = onlineState.role === 'host' ? 'Du bist Host' : 'Du bist Spieler 2';
  document.getElementById('lobbyHostName').textContent = lobby.hostName || '-';
  document.getElementById('lobbyGuestName').textContent = lobby.guestName || 'Wartet...';
  document.getElementById('lobbyHostReady').textContent = lobby.hostReady ? 'Bereit' : 'Nicht bereit';
  document.getElementById('lobbyGuestReady').textContent = lobby.guestReady ? 'Bereit' : 'Nicht bereit';
  document.getElementById('onlineStartBtn').style.display = onlineState.role === 'host' ? 'inline-block' : 'none';
  renderOnlinePickers();
}

function renderOnlinePickers() {
  const charGrid = document.getElementById('onlineCharPicker');
  const bgGrid = document.getElementById('onlineBgPicker');
  charGrid.innerHTML = '';
  bgGrid.innerHTML = '';
  const lobby = onlineState.lobby;
  if (!lobby) return;
  const currentChar = onlineState.role === 'host' ? lobby.hostChar : lobby.guestChar;
  characters.forEach(ch => {
    const card = document.createElement('div');
    card.className = 'cardBox' + (currentChar === ch.id ? ' selectedCard' : '');
    card.innerHTML = `<div class="previewWrap"><img src="${ch.src}" class="characterPreview"></div><div class="smallText">${ch.name}</div>`;
    card.onclick = () => {
      if (!socket) return;
      socket.emit('online:update-choice', { code: onlineState.code, role: onlineState.role, char: ch.id });
    };
    charGrid.appendChild(card);
  });
  backgrounds.forEach(bg => {
    const card = document.createElement('div');
    card.className = 'cardBox' + (lobby.bg === bg.id ? ' selectedCard' : '');
    card.innerHTML = `<div class="previewWrap"><img src="${bg.src}" class="skinPreview"></div><div class="smallText">${bg.name}</div>`;
    card.onclick = () => {
      if (!socket || onlineState.role !== 'host') return;
      socket.emit('online:update-choice', { code: onlineState.code, role: 'host', bg: bg.id });
    };
    bgGrid.appendChild(card);
  });
}

function openOnlineLobby(role, lobby) {
  onlineState.role = role;
  onlineState.code = lobby.code;
  onlineState.ready = false;
  applyLobbyChoices(lobby);
  openOnly(document.getElementById('onlineLobbyMenu'));
}

function startOnlineMatch(lobby) {
  selectedMode = 'twoplayer';
  difficultyFactor = NORMAL_MODE_FACTOR;
  gameActive = false;
  gameOver = false;
  pause = false;
  bgX = 0;
  closeAllMenus();
  twoPlayer.active = true;
  twoPlayer.over = false;
  twoPlayer.online = true;
  twoPlayer.host = onlineState.role === 'host';
  twoPlayer.guest = onlineState.role === 'guest';
  twoPlayer.background = lobby.bg;
  twoPlayer.p1 = createTwoPlayerPlayer(lobby.hostName, { up: 'w', down: 's', jet: '1', ufo: '2', speed: '3', self2x: '4', selfBlitz: '5', selfShield: '6' }, 0, canvas.height / 2 - 3, lobby.hostChar);
  twoPlayer.p2 = createTwoPlayerPlayer(lobby.guestName, { up: 'arrowup', down: 'arrowdown', jet: '7', ufo: '8', speed: '9', self2x: 'j', selfBlitz: 'k', selfShield: 'l' }, canvas.height / 2 + 3, canvas.height, lobby.guestChar);
  remoteKeyState = {};
  updateOnlineHelpText();
  startTwoPlayerMusic();
  onlineSendInputEnabled = true;
}

function endTwoPlayer(winnerText, notifyRemote = true) {
  if (!twoPlayer.active) return;
  twoPlayer.over = true;
  stopAllGameMusic();
  document.getElementById('twoPlayerWinnerText').textContent = winnerText;
  openOnly(document.getElementById('twoPlayerGameOverMenu'));
  if (notifyRemote && socket && twoPlayer.online && twoPlayer.host) {
    socket.emit('online:match-over', { winnerText });
  }
}

function canUseTpAbility(tpPlayer, key, cost) {
  return tpPlayer.alive && tpPlayer.coins >= cost && Date.now() >= tpPlayer.cooldowns[key];
}

function sendJetAttack(fromPlayer, toPlayer) {
  if (!canUseTpAbility(fromPlayer, 'jet', 5)) return;
  fromPlayer.coins -= 5;
  fromPlayer.cooldowns.jet = Date.now() + 3200;
  toPlayer.enemies.push(createVariedEnemy(toPlayer.areaTop, toPlayer.areaBottom, getNextEnemyX(toPlayer.enemies), 'jet'));
  toPlayer.attackMessage = 'Extra-Jet!';
  toPlayer.attackMessageUntil = Date.now() + 1500;
}

function sendUfoAttack(fromPlayer, toPlayer) {
  if (!canUseTpAbility(fromPlayer, 'ufo', 8)) return;
  fromPlayer.coins -= 8;
  fromPlayer.cooldowns.ufo = Date.now() + 4200;
  toPlayer.enemies.push(createVariedEnemy(toPlayer.areaTop, toPlayer.areaBottom, getNextEnemyX(toPlayer.enemies), 'ufo'));
  toPlayer.attackMessage = 'UFO-Angriff!';
  toPlayer.attackMessageUntil = Date.now() + 1500;
}

function sendSpeedAttack(fromPlayer, toPlayer) {
  if (!canUseTpAbility(fromPlayer, 'speed', 10)) return;
  fromPlayer.coins -= 10;
  fromPlayer.cooldowns.speed = Date.now() + 5200;
  toPlayer.speedDebuffUntil = Date.now() + 5000;
  toPlayer.attackMessage = 'Speed-Angriff!';
  toPlayer.attackMessageUntil = Date.now() + 1500;
}

function buySelf2x(tpPlayer) {
  if (!canUseTpAbility(tpPlayer, 'self2x', 6)) return;
  tpPlayer.coins -= 6;
  tpPlayer.cooldowns.self2x = Date.now() + 4500;
  applyTwoPlayerPower(tpPlayer, '2x');
  tpPlayer.attackMessage = '2X aktiv!';
  tpPlayer.attackMessageUntil = Date.now() + 1400;
}

function buySelfBlitz(tpPlayer) {
  if (!canUseTpAbility(tpPlayer, 'selfBlitz', 6)) return;
  tpPlayer.coins -= 6;
  tpPlayer.cooldowns.selfBlitz = Date.now() + 4500;
  applyTwoPlayerPower(tpPlayer, 'blitz');
  tpPlayer.attackMessage = 'Blitz aktiv!';
  tpPlayer.attackMessageUntil = Date.now() + 1400;
}

function buySelfShield(tpPlayer) {
  if (!canUseTpAbility(tpPlayer, 'selfShield', 8)) return;
  tpPlayer.coins -= 8;
  tpPlayer.cooldowns.selfShield = Date.now() + 5200;
  applyTwoPlayerPower(tpPlayer, 'shield');
  tpPlayer.attackMessage = 'Schild aktiv!';
  tpPlayer.attackMessageUntil = Date.now() + 1400;
}

function triggerAbilityForPlayerKey(playerIndex, key) {
  if (!twoPlayer.active || !twoPlayer.p1 || !twoPlayer.p2) return;
  const fromPlayer = playerIndex === 1 ? twoPlayer.p1 : twoPlayer.p2;
  const toPlayer = playerIndex === 1 ? twoPlayer.p2 : twoPlayer.p1;
  const controls = fromPlayer.controls;
  if (key === controls.jet) sendJetAttack(fromPlayer, toPlayer);
  if (key === controls.ufo) sendUfoAttack(fromPlayer, toPlayer);
  if (key === controls.speed) sendSpeedAttack(fromPlayer, toPlayer);
  if (key === controls.self2x) buySelf2x(fromPlayer);
  if (key === controls.selfBlitz) buySelfBlitz(fromPlayer);
  if (key === controls.selfShield) buySelfShield(fromPlayer);
}

function getMoveStateForPlayer(tpPlayer, playerIndex) {
  if (!twoPlayer.online || !twoPlayer.host) {
    return {
      up: !!keyState[tpPlayer.controls.up],
      down: !!keyState[tpPlayer.controls.down]
    };
  }
  if (playerIndex === 1) {
    return { up: !!keyState[tpPlayer.controls.up], down: !!keyState[tpPlayer.controls.down] };
  }
  return { up: !!remoteKeyState[tpPlayer.controls.up], down: !!remoteKeyState[tpPlayer.controls.down] };
}

function updateSinglePlayer() {
  if (!gameActive || pause || gameOver) return;
  if (intro) {
    player.x += 8;
    if (player.x > 220) intro = false;
    return;
  }
  const moveSpeed = Date.now() < blitzUntil ? player.speed * 1.75 : player.speed;
  if (keyState[keybinds.up]) player.y -= moveSpeed;
  if (keyState[keybinds.down]) player.y += moveSpeed;
  const maxY = canvas.height - player.h;
  if (player.y < 0) player.y = 0;
  if (player.y > maxY) player.y = maxY;
  if (score2x && Date.now() >= score2xUntil) score2x = false;
  if (shieldHits > 0 && Date.now() >= shieldUntil) shieldHits = 0;
  clouds.forEach(c => c.x -= c.speed);
  clouds = clouds.filter(c => c.x > -120);
  const speedFactor = getSpeedFactor(score, getDifficultyForCurrentMode());
  enemies.forEach(enemy => {
    enemy.x -= enemy.speedMul * 5.8 * speedFactor;
    if (enemy.x < -100) {
      const replacement = createVariedEnemy(0, canvas.height, getNextEnemyX(enemies), enemy.type);
      Object.assign(enemy, replacement);
      enemy.type = Math.random() < 0.45 ? 'jet' : 'ufo';
    }
    const dx = (player.x + player.hitW / 2) - (enemy.x + enemy.hitW / 2);
    const dy = (player.y + player.hitH / 2) - (enemy.y + enemy.hitH / 2);
    if (Math.abs(dx) < (player.hitW + enemy.hitW) / 2 - 8 && Math.abs(dy) < (player.hitH + enemy.hitH) / 2 - 8) handleSingleHit();
  });
  for (let i = coins.length - 1; i >= 0; i--) {
    const c = coins[i];
    c.x -= c.speed * speedFactor;
    if (c.x < -50) { coins.splice(i, 1); continue; }
    if (Math.abs((player.x + player.hitW / 2) - (c.x + 21)) < 40 && Math.abs((player.y + player.hitH / 2) - (c.y + 21)) < 40) {
      coinCounter++;
      localStorage.setItem('coins', coinCounter);
      playCoinPickup();
      coins.splice(i, 1);
    }
  }
  for (let i = powerUps.length - 1; i >= 0; i--) {
    const p = powerUps[i];
    p.x -= p.speed * speedFactor;
    if (p.x + p.w < 0) { powerUps.splice(i, 1); continue; }
    if (Math.abs((player.x + player.hitW / 2) - (p.x + p.w / 2)) < 42 && Math.abs((player.y + player.hitH / 2) - (p.y + p.h / 2)) < 42) {
      applySinglePower(p.type);
      powerUps.splice(i, 1);
    }
  }
}

function updateTwoPlayerPlayer(tpPlayer, playerIndex) {
  if (!tpPlayer.alive) return;
  const controls = getMoveStateForPlayer(tpPlayer, playerIndex);
  const boosted = Date.now() < tpPlayer.blitzUntil ? tpPlayer.speed * 1.75 : tpPlayer.speed;
  const moveSpeed = Date.now() < tpPlayer.speedDebuffUntil ? boosted * 0.75 : boosted;
  if (controls.up) tpPlayer.y -= moveSpeed;
  if (controls.down) tpPlayer.y += moveSpeed;
  const maxY = tpPlayer.areaBottom - tpPlayer.h;
  if (tpPlayer.y < tpPlayer.areaTop) tpPlayer.y = tpPlayer.areaTop;
  if (tpPlayer.y > maxY) tpPlayer.y = maxY;
  if (tpPlayer.shieldHits > 0 && Date.now() >= tpPlayer.shieldUntil) tpPlayer.shieldHits = 0;
  tpPlayer.clouds.forEach(c => c.x -= c.speed);
  tpPlayer.clouds = tpPlayer.clouds.filter(c => c.x > -120);
  const speedFactor = getSpeedFactor(tpPlayer.score, NORMAL_MODE_FACTOR);
  tpPlayer.enemies.forEach(enemy => {
    const extra = Date.now() < tpPlayer.speedDebuffUntil ? 1.7 : 0;
    enemy.x -= enemy.speedMul * (5.4 + extra) * speedFactor;
    if (enemy.x < -100) {
      const replacement = createVariedEnemy(tpPlayer.areaTop, tpPlayer.areaBottom, getNextEnemyX(tpPlayer.enemies), enemy.type);
      Object.assign(enemy, replacement);
      enemy.type = Math.random() < 0.45 ? 'jet' : 'ufo';
    }
    const dx = (tpPlayer.x + tpPlayer.hitW / 2) - (enemy.x + enemy.hitW / 2);
    const dy = (tpPlayer.y + tpPlayer.hitH / 2) - (enemy.y + enemy.hitH / 2);
    if (Math.abs(dx) < (tpPlayer.hitW + enemy.hitW) / 2 - 8 && Math.abs(dy) < (tpPlayer.hitH + enemy.hitH) / 2 - 8) handleTwoPlayerHit(tpPlayer);
  });
  for (let i = tpPlayer.coinItems.length - 1; i >= 0; i--) {
    const c = tpPlayer.coinItems[i];
    c.x -= c.speed * speedFactor;
    if (c.x + c.w < 0) { tpPlayer.coinItems.splice(i, 1); continue; }
    if (Math.abs((tpPlayer.x + tpPlayer.hitW / 2) - (c.x + c.w / 2)) < 38 && Math.abs((tpPlayer.y + tpPlayer.hitH / 2) - (c.y + c.h / 2)) < 38) {
      tpPlayer.coins++;
      playCoinPickup();
      tpPlayer.coinItems.splice(i, 1);
    }
  }
  for (let i = tpPlayer.powerItems.length - 1; i >= 0; i--) {
    const p = tpPlayer.powerItems[i];
    p.x -= p.speed * speedFactor;
    if (p.x + p.w < 0) { tpPlayer.powerItems.splice(i, 1); continue; }
    if (Math.abs((tpPlayer.x + tpPlayer.hitW / 2) - (p.x + p.w / 2)) < 40 && Math.abs((tpPlayer.y + tpPlayer.hitH / 2) - (p.y + p.h / 2)) < 40) {
      applyTwoPlayerPower(tpPlayer, p.type);
      tpPlayer.powerItems.splice(i, 1);
    }
  }
}

function updateTwoPlayer() {
  if (!twoPlayer.active || twoPlayer.over || pause || !twoPlayer.p1 || !twoPlayer.p2) return;
  if (twoPlayer.online && !twoPlayer.host) return;
  updateTwoPlayerPlayer(twoPlayer.p1, 1);
  updateTwoPlayerPlayer(twoPlayer.p2, 2);
  if (!twoPlayer.p1.alive && twoPlayer.p2.alive) { endTwoPlayer(twoPlayer.p2.name + ' gewinnt!'); return; }
  if (!twoPlayer.p2.alive && twoPlayer.p1.alive) { endTwoPlayer(twoPlayer.p1.name + ' gewinnt!'); return; }
  if (!twoPlayer.p1.alive && !twoPlayer.p2.alive) endTwoPlayer('Unentschieden!');
}

function updateSingleScoreTick() {
  if (gameActive && !pause && !gameOver) {
    const speedFactor = getSpeedFactor(score, getDifficultyForCurrentMode());
    let gain = speedFactor;
    if (score2x) gain *= 2;
    if (adminDoubleScore) gain *= 2;
    scoreFloat += gain;
    score = Math.floor(scoreFloat);
    if (score > highscore) {
      highscore = score;
      localStorage.setItem('highscore', highscore);
    }
    if (selectedMode === 'classic') {
      const target = levelTargets[currentLevel];
      if (score >= target) {
        score = target;
        gameActive = false;
        pause = true;
        if (currentLevel < 4 && highestUnlockedLevel < currentLevel + 1) {
          highestUnlockedLevel = currentLevel + 1;
          localStorage.setItem('highestUnlockedLevel', highestUnlockedLevel);
          updateClassicLevelButtons();
        }
        giveClassicReward(currentLevel);
        openOnly(document.getElementById('levelCompleteMenu'));
        stopAllGameMusic();
      }
    }
  }
}

function updateTwoPlayerScoreTick() {
  if (!twoPlayer.active || twoPlayer.over || pause || !twoPlayer.p1 || !twoPlayer.p2) return;
  if (twoPlayer.online && !twoPlayer.host) return;
  [twoPlayer.p1, twoPlayer.p2].forEach(tp => {
    const speedFactor = getSpeedFactor(tp.score, NORMAL_MODE_FACTOR);
    let gain = speedFactor;
    if (Date.now() < tp.self2xUntil) gain *= 2;
    if (adminDoubleScore) gain *= 2;
    tp.scoreFloat += gain;
    tp.score = Math.floor(tp.scoreFloat);
  });
}

function updateSinglePowerText() {
  powerDisplay.textContent = getSinglePowerText();
}

function spawnSinglePeriodicThings() {
  if (gameActive && !pause && !gameOver) spawnSingleCloud();
  if (twoPlayer.active && !twoPlayer.over && !pause && (!twoPlayer.online || twoPlayer.host)) {
    [twoPlayer.p1, twoPlayer.p2].forEach(tp => {
      if (!tp) return;
      if (tp.clouds.length < 4) tp.clouds.push({ x: canvas.width + Math.random() * 80, y: tp.areaTop + Math.random() * 75, speed: 0.7 + Math.random() * 1.1, img: wolkenBilder[Math.floor(Math.random() * wolkenBilder.length)] });
    });
  }
}

function spawnCoinsPeriodic() {
  if (gameActive && !pause && !gameOver && Math.random() < 0.45) {
    coins.push({ x: canvas.width, y: Math.random() * (canvas.height - 50), speed: 4.1 });
  }
  if (twoPlayer.active && !twoPlayer.over && !pause && (!twoPlayer.online || twoPlayer.host)) {
    [twoPlayer.p1, twoPlayer.p2].forEach(tp => {
      if (Math.random() < 0.65) tp.coinItems.push({ x: canvas.width + Math.random() * 80, y: tp.areaTop + 26 + Math.random() * Math.max(20, tp.areaBottom - tp.areaTop - 70), w: 40, h: 40, speed: 3.8 });
    });
  }
}

function spawnPowerupsPeriodic() {
  if (gameActive && !pause && !gameOver) {
    if (Date.now() >= powerUpCooldownUntil && powerUps.length < 2) {
      const r = Math.random();
      const type = r < 0.33 ? '2x' : r < 0.66 ? 'blitz' : 'shield';
      powerUps.push({ type, x: canvas.width, y: 30 + Math.random() * (canvas.height - 90), w: 46, h: 46, speed: 4 });
      powerUpCooldownUntil = Date.now() + 9000;
    }
  }
  if (twoPlayer.active && !twoPlayer.over && !pause && (!twoPlayer.online || twoPlayer.host)) {
    [twoPlayer.p1, twoPlayer.p2].forEach(tp => {
      if (Math.random() < 0.48 && tp.powerItems.length < 2) {
        const r = Math.random();
        const type = r < 0.33 ? '2x' : r < 0.66 ? 'blitz' : 'shield';
        tp.powerItems.push({ type, x: canvas.width + Math.random() * 80, y: tp.areaTop + 28 + Math.random() * Math.max(20, tp.areaBottom - tp.areaTop - 72), w: 40, h: 40, speed: 3.7 });
      }
    });
  }
}

function serializeTwoPlayerState() {
  return JSON.parse(JSON.stringify({
    bgX,
    background: twoPlayer.background,
    p1: twoPlayer.p1,
    p2: twoPlayer.p2,
    over: twoPlayer.over,
    winner: twoPlayer.winner
  }));
}

function applyRemoteTwoPlayerState(payload) {
  if (!payload) return;
  bgX = payload.bgX;
  twoPlayer.background = payload.background;
  twoPlayer.p1 = payload.p1;
  twoPlayer.p2 = payload.p2;
  twoPlayer.over = payload.over;
  twoPlayer.winner = payload.winner || '';
}

function attachButtonSounds() {
  document.querySelectorAll('button').forEach(btn => {
    btn.addEventListener('click', () => { if (!btn.disabled) playButtonSound(); });
  });
}

function renderLocalSetup() {
  const content = document.getElementById('localSetupContent');
  const nextBtn = document.getElementById('localSetupNextBtn');
  if (localSetupStep === 0) {
    content.innerHTML = `<div class="stepText">Spieler 1 Name</div><input type="text" id="localName1Input" value="${localSetup.p1Name}" maxlength="16">`;
    nextBtn.textContent = 'Weiter';
  } else if (localSetupStep === 1) {
    content.innerHTML = `<div class="stepText">Spieler 2 Name</div><input type="text" id="localName2Input" value="${localSetup.p2Name}" maxlength="16">`;
    nextBtn.textContent = 'Weiter';
  } else if (localSetupStep === 2) {
    content.innerHTML = `<div class="stepText">${localSetup.p1Name} wählt Character</div><div id="localP1CharGrid" class="rowButtons"></div>`;
    const grid = content.querySelector('#localP1CharGrid');
    characters.forEach(ch => {
      const card = document.createElement('div');
      card.className = 'cardBox' + (localSetup.p1Char === ch.id ? ' selectedCard' : '');
      card.innerHTML = `<div class="previewWrap"><img src="${ch.src}" class="characterPreview"></div><div class="smallText">${ch.name}</div>`;
      card.onclick = () => { localSetup.p1Char = ch.id; renderLocalSetup(); };
      grid.appendChild(card);
    });
    nextBtn.textContent = 'Weiter';
  } else if (localSetupStep === 3) {
    content.innerHTML = `<div class="stepText">${localSetup.p2Name} wählt Character</div><div id="localP2CharGrid" class="rowButtons"></div>`;
    const grid = content.querySelector('#localP2CharGrid');
    characters.forEach(ch => {
      const card = document.createElement('div');
      card.className = 'cardBox' + (localSetup.p2Char === ch.id ? ' selectedCard' : '');
      card.innerHTML = `<div class="previewWrap"><img src="${ch.src}" class="characterPreview"></div><div class="smallText">${ch.name}</div>`;
      card.onclick = () => { localSetup.p2Char = ch.id; renderLocalSetup(); };
      grid.appendChild(card);
    });
    nextBtn.textContent = 'Weiter';
  } else {
    content.innerHTML = `<div class="stepText">Hintergrund wählen</div><div id="localBgGrid" class="rowButtons"></div>`;
    const grid = content.querySelector('#localBgGrid');
    backgrounds.forEach(bg => {
      const card = document.createElement('div');
      card.className = 'cardBox' + (localSetup.bg === bg.id ? ' selectedCard' : '');
      card.innerHTML = `<div class="previewWrap"><img src="${bg.src}" class="skinPreview"></div><div class="smallText">${bg.name}</div>`;
      card.onclick = () => { localSetup.bg = bg.id; renderLocalSetup(); };
      grid.appendChild(card);
    });
    nextBtn.textContent = 'Start';
  }
}

function resetAllData() {
  localStorage.clear();
  window.location.reload();
}

function leaveOnlineLobbyAndReturn() {
  if (socket && onlineState.code) socket.emit('online:leave-lobby', { code: onlineState.code });
  onlineState = { role: null, code: '', lobby: null, ready: false, connected: false };
  twoPlayer.online = false;
  twoPlayer.active = false;
  twoPlayer.p1 = null;
  twoPlayer.p2 = null;
  hideTwoPlayerHelp();
  startMenuMusic();
  openOnly(document.getElementById('startMenu'));
}

function bindUI() {
  document.getElementById('playButton').onclick = () => openOnly(document.getElementById('modeMenu'));
  document.getElementById('skinsButton').onclick = () => openOnly(document.getElementById('skinsMenu'));
  document.getElementById('shopButton').onclick = () => openOnly(document.getElementById('shopMenu'));
  document.getElementById('settingsButton').onclick = () => openOnly(document.getElementById('settingsMenu'));
  document.getElementById('casesButton').onclick = () => openOnly(document.getElementById('casesMenu'));
  document.getElementById('itemsButton').onclick = () => openOnly(document.getElementById('itemsMenu'));
  document.getElementById('backModeBtn').onclick = () => openOnly(document.getElementById('startMenu'));
  document.getElementById('backDifficultyBtn').onclick = () => openOnly(document.getElementById('modeMenu'));
  document.getElementById('backClassicBtn').onclick = () => openOnly(document.getElementById('modeMenu'));
  document.getElementById('closeSkinsBtn').onclick = () => openOnly(document.getElementById('startMenu'));
  document.getElementById('closeShopBtn').onclick = () => openOnly(document.getElementById('startMenu'));
  document.getElementById('closeCasesBtn').onclick = () => openOnly(document.getElementById('startMenu'));
  document.getElementById('closeItemsBtn').onclick = () => openOnly(document.getElementById('startMenu'));
  document.getElementById('closeSettingsBtn').onclick = () => {
    if (pause && (gameActive || twoPlayer.active)) openOnly(document.getElementById('pauseMenu'));
    else openOnly(document.getElementById('startMenu'));
  };
  document.getElementById('classicModeBtn').onclick = () => { updateClassicLevelButtons(); openOnly(document.getElementById('classicMenu')); };
  document.getElementById('endlessModeBtn').onclick = () => openOnly(document.getElementById('difficultyMenu'));
  document.getElementById('twoPlayerModeBtn').onclick = () => openOnly(document.getElementById('twoPlayerChoiceMenu'));
  document.getElementById('backTwoPlayerChoiceBtn').onclick = () => openOnly(document.getElementById('modeMenu'));
  document.getElementById('localPlayBtn').onclick = () => { localSetupStep = 0; openOnly(document.getElementById('localSetupMenu')); renderLocalSetup(); };
  document.getElementById('onlinePlayBtn').onclick = () => openOnly(document.getElementById('onlineMenu'));
  document.getElementById('backOnlineMenuBtn').onclick = () => openOnly(document.getElementById('twoPlayerChoiceMenu'));
  document.getElementById('openCreateLobbyBtn').onclick = () => openOnly(document.getElementById('createLobbyMenu'));
  document.getElementById('openJoinLobbyBtn').onclick = () => openOnly(document.getElementById('joinLobbyMenu'));
  document.getElementById('backCreateLobbyBtn').onclick = () => openOnly(document.getElementById('onlineMenu'));
  document.getElementById('backJoinLobbyBtn').onclick = () => openOnly(document.getElementById('onlineMenu'));
  document.getElementById('createLobbyConfirmBtn').onclick = () => {
    if (!socket) return showToast('Keine Serververbindung.');
    const name = document.getElementById('createLobbyNameInput').value.trim() || 'Spieler 1';
    socket.emit('online:create-lobby', { name });
  };
  document.getElementById('joinLobbyConfirmBtn').onclick = () => {
    if (!socket) return showToast('Keine Serververbindung.');
    const name = document.getElementById('joinLobbyNameInput').value.trim() || 'Spieler 2';
    const code = document.getElementById('joinLobbyCodeInput').value.trim().toUpperCase();
    socket.emit('online:join-lobby', { name, code });
  };
  document.getElementById('onlineReadyBtn').onclick = () => {
    if (!socket || !onlineState.code) return;
    onlineState.ready = !onlineState.ready;
    socket.emit('online:set-ready', { code: onlineState.code, ready: onlineState.ready });
    document.getElementById('onlineReadyBtn').textContent = onlineState.ready ? 'Nicht bereit' : 'Bereit';
  };
  document.getElementById('onlineStartBtn').onclick = () => {
    if (socket && onlineState.code) socket.emit('online:start', { code: onlineState.code });
  };
  document.getElementById('onlineLobbyBackBtn').onclick = () => {
    if (socket && onlineState.code) socket.emit('online:leave-lobby', { code: onlineState.code });
    openOnly(document.getElementById('onlineMenu'));
    onlineState = { role: null, code: '', lobby: null, ready: false, connected: false };
  };
  document.querySelectorAll('.difficultyBtn').forEach(btn => {
    btn.onclick = () => {
      difficultyFactor = parseFloat(btn.dataset.fac);
      startEndless();
    };
  });
  document.querySelectorAll('.levelBtn').forEach(btn => {
    btn.onclick = () => {
      const level = parseInt(btn.dataset.level, 10);
      if (level <= highestUnlockedLevel) startClassicLevel(level);
      else playLockSound();
    };
  });
  document.getElementById('localSetupBackBtn').onclick = () => {
    if (localSetupStep > 0) { localSetupStep--; renderLocalSetup(); }
    else openOnly(document.getElementById('twoPlayerChoiceMenu'));
  };
  document.getElementById('localSetupNextBtn').onclick = () => {
    if (localSetupStep === 0) localSetup.p1Name = document.getElementById('localName1Input').value.trim() || 'Spieler 1';
    else if (localSetupStep === 1) localSetup.p2Name = document.getElementById('localName2Input').value.trim() || 'Spieler 2';
    if (localSetupStep < 4) { localSetupStep++; renderLocalSetup(); }
    else startLocalTwoPlayer();
  };
  document.getElementById('resumeBtn').onclick = () => { pause = false; closeAllMenus(); resumeCurrentGameMusic(); };
  document.getElementById('pauseSettingsBtn').onclick = () => openOnly(document.getElementById('settingsMenu'));
  document.getElementById('pauseToMenuBtn').onclick = () => goToMainMenu();
  document.getElementById('singleRestartBtn').onclick = () => { if (selectedMode === 'classic') startClassicLevel(currentLevel); else startEndless(); };
  document.getElementById('singleMenuBtn').onclick = () => goToMainMenu();
  document.getElementById('nextLevelBtn').onclick = () => { if (currentLevel < 4) startClassicLevel(currentLevel + 1); else goToMainMenu(); };
  document.getElementById('levelCompleteMenuBtn').onclick = () => goToMainMenu();
  document.getElementById('twoPlayerRestartBtn').onclick = () => {
    if (twoPlayer.online) {
      openOnly(document.getElementById('onlineLobbyMenu'));
      return;
    }
    startLocalTwoPlayer();
  };
  document.getElementById('twoPlayerAdjustBtn').onclick = () => {
    if (twoPlayer.online) openOnly(document.getElementById('onlineLobbyMenu'));
    else { localSetupStep = 0; openOnly(document.getElementById('localSetupMenu')); renderLocalSetup(); }
  };
  document.getElementById('twoPlayerToMenuBtn').onclick = () => {
    if (twoPlayer.online) leaveOnlineLobbyAndReturn();
    else goToMainMenu();
  };

  document.getElementById('adminButton').onclick = () => {
    document.getElementById('adminCoinsInput').value = coinCounter;
    openOnly(document.getElementById('adminLoginMenu'));
  };
  document.getElementById('adminLoginBtn').onclick = () => {
    if (document.getElementById('adminCodeInput').value === 'Anes') {
      document.getElementById('adminCodeInput').value = '';
      document.getElementById('adminGodMode').checked = adminGodMode;
      document.getElementById('adminDoubleScore').checked = adminDoubleScore;
      document.getElementById('adminCoinsInput').value = coinCounter;
      openOnly(document.getElementById('adminMenu'));
    } else playLockSound();
  };
  document.getElementById('adminLoginBackBtn').onclick = () => openOnly(document.getElementById('startMenu'));
  document.getElementById('closeAdminMenuBtn').onclick = () => openOnly(document.getElementById('startMenu'));
  document.getElementById('adminGodMode').onchange = e => { adminGodMode = e.target.checked; };
  document.getElementById('adminDoubleScore').onchange = e => { adminDoubleScore = e.target.checked; };
  document.getElementById('applyAdminCoinsBtn').onclick = () => {
    coinCounter = Math.max(0, parseInt(document.getElementById('adminCoinsInput').value || '0', 10));
    localStorage.setItem('coins', coinCounter);
  };

  document.getElementById('menuVolume').value = parseFloat(localStorage.getItem('menuVolume') || '0.5');
  document.getElementById('gameVolume').value = parseFloat(localStorage.getItem('gameVolume') || '0.5');
  menuMusic.volume = parseFloat(document.getElementById('menuVolume').value);
  gameMusic.volume = parseFloat(document.getElementById('gameVolume').value);
  altGameMusic.volume = parseFloat(document.getElementById('gameVolume').value);
  twoPlayerMusic.volume = parseFloat(document.getElementById('gameVolume').value);
  document.getElementById('muteSfxToggle').checked = sfxMuted;
  document.getElementById('menuVolume').oninput = e => { menuMusic.volume = parseFloat(e.target.value); localStorage.setItem('menuVolume', menuMusic.volume); };
  document.getElementById('gameVolume').oninput = e => {
    const v = parseFloat(e.target.value);
    gameMusic.volume = v;
    altGameMusic.volume = v;
    twoPlayerMusic.volume = v;
    localStorage.setItem('gameVolume', v);
  };
  document.getElementById('muteSfxToggle').onchange = e => { sfxMuted = e.target.checked; localStorage.setItem('sfxMuted', sfxMuted ? 'true' : 'false'); };
  document.getElementById('changeKeybindsBtn').onclick = () => document.getElementById('keybindPanel').classList.toggle('hidden');
  document.querySelectorAll('.keybindButton').forEach(btn => {
    btn.onclick = () => {
      awaitingKeybind = btn.dataset.action;
      btn.textContent = 'Taste drücken...';
    };
  });
  document.getElementById('resetDataBtn').onclick = () => resetAllData();
}

function goToMainMenu() {
  gameActive = false;
  gameOver = false;
  pause = false;
  selectedMode = '';
  currentLevel = 0;
  twoPlayer.active = false;
  twoPlayer.over = false;
  twoPlayer.online = false;
  twoPlayer.p1 = null;
  twoPlayer.p2 = null;
  remoteKeyState = {};
  onlineSendInputEnabled = false;
  hideTwoPlayerHelp();
  resetSinglePlayerState();
  openOnly(document.getElementById('startMenu'));
  startMenuMusic();
}

function setupSocket() {
  if (!socket) return;
  socket.on('connect', () => { onlineState.connected = true; });
  socket.on('disconnect', () => { onlineState.connected = false; showToast('Serververbindung getrennt.'); });
  socket.on('online:error', msg => showToast(msg));
  socket.on('online:lobby-created', ({ role, lobby }) => openOnlineLobby(role, lobby));
  socket.on('online:lobby-joined', ({ role, lobby }) => openOnlineLobby(role, lobby));
  socket.on('online:lobby-state', lobby => {
    if (onlineState.code && lobby.code !== onlineState.code) return;
    onlineState.code = lobby.code;
    applyLobbyChoices(lobby);
  });
  socket.on('online:start-game', lobby => {
    onlineState.code = lobby.code;
    onlineState.lobby = lobby;
    onlineState.ready = false;
    document.getElementById('onlineReadyBtn').textContent = 'Bereit';
    startOnlineMatch(lobby);
  });
  socket.on('online:force-menu', () => {
    showToast('Online-Lobby wurde geschlossen.');
    goToMainMenu();
  });
  socket.on('online:input', payload => {
    if (!twoPlayer.active || !twoPlayer.online || !twoPlayer.host) return;
    if (payload.type === 'key') {
      remoteKeyState[payload.key] = payload.down;
      if (payload.down) triggerAbilityForPlayerKey(2, payload.key);
    }
  });
  socket.on('online:state', payload => {
    if (!twoPlayer.active || !twoPlayer.online || !twoPlayer.guest) return;
    applyRemoteTwoPlayerState(payload);
    updateOnlineHelpText();
  });
  socket.on('online:match-over', payload => {
    if (!twoPlayer.active || !twoPlayer.online) return;
    twoPlayer.over = true;
    stopAllGameMusic();
    document.getElementById('twoPlayerWinnerText').textContent = payload.winnerText;
    openOnly(document.getElementById('twoPlayerGameOverMenu'));
  });
}

function maybeSendSnapshot() {
  if (!socket || !twoPlayer.online || !twoPlayer.host || !twoPlayer.active || twoPlayer.over) return;
  const now = performance.now();
  if (now - lastSnapshotSent < 50) return;
  lastSnapshotSent = now;
  socket.emit('online:state', serializeTwoPlayerState());
}

function onKeyDown(e) {
  const pressed = e.key.toLowerCase();
  keyState[pressed] = true;
  if (awaitingKeybind) {
    e.preventDefault();
    keybinds[awaitingKeybind] = pressed;
    localStorage.setItem('keybind_' + awaitingKeybind, pressed);
    awaitingKeybind = null;
    refreshKeybindButtons();
    return;
  }

  if ((pressed === keybinds.pause || pressed === 'escape') && ((gameActive && !gameOver) || (twoPlayer.active && !twoPlayer.over))) {
    pause = !pause;
    if (pause) {
      currentGameMusic?.pause();
      openOnly(document.getElementById('pauseMenu'));
    } else {
      closeAllMenus();
      resumeCurrentGameMusic();
    }
  }

  if (pressed === keybinds.restart && gameOver) {
    if (selectedMode === 'classic') startClassicLevel(currentLevel);
    if (selectedMode === 'endless') startEndless();
  }

  if (!twoPlayer.active && (selectedMode === 'classic' || selectedMode === 'endless') && gameActive && !pause && !gameOver) {
    if (pressed === '1' && itemInventory.x2 > 0) { itemInventory.x2--; applySinglePower('2x'); saveInventory(); updateItemsMenu(); }
    if (pressed === '2' && itemInventory.shield > 0) { itemInventory.shield--; applySinglePower('shield'); saveInventory(); updateItemsMenu(); }
    if (pressed === '3' && itemInventory.blitz > 0) { itemInventory.blitz--; applySinglePower('blitz'); saveInventory(); updateItemsMenu(); }
  }

  if (twoPlayer.active && !twoPlayer.over && !pause) {
    if (!twoPlayer.online) {
      triggerAbilityForPlayerKey(1, pressed);
      triggerAbilityForPlayerKey(2, pressed);
    } else if (twoPlayer.host) {
      triggerAbilityForPlayerKey(1, pressed);
    } else if (twoPlayer.guest) {
      if (socket && onlineSendInputEnabled) socket.emit('online:input', { type: 'key', key: pressed, down: true });
    }
  }

  if (twoPlayer.online && twoPlayer.host && socket && onlineSendInputEnabled && ['arrowup','arrowdown','7','8','9','j','k','l'].includes(pressed)) {
    // host ignores remote control presses locally
  }
}

function onKeyUp(e) {
  const pressed = e.key.toLowerCase();
  keyState[pressed] = false;
  if (twoPlayer.active && twoPlayer.online && twoPlayer.guest && socket && onlineSendInputEnabled) {
    socket.emit('online:input', { type: 'key', key: pressed, down: false });
  }
}

document.addEventListener('keydown', onKeyDown);
document.addEventListener('keyup', onKeyUp);

setInterval(updateSingleScoreTick, 200);
setInterval(updateTwoPlayerScoreTick, 200);
setInterval(spawnSinglePeriodicThings, 1800);
setInterval(spawnCoinsPeriodic, 1450);
setInterval(spawnPowerupsPeriodic, 2200);

function gameLoop() {
  if (!pause) {
    if (!(twoPlayer.online && twoPlayer.guest)) {
      bgX -= getBackgroundScrollSpeed();
      if (bgX <= -canvas.width) bgX += canvas.width;
    }
  }
  draw();
  updateSinglePlayer();
  updateTwoPlayer();
  updateSingleItemBar();
  updateSinglePowerText();
  maybeSendSnapshot();
}

renderSkinsAndShop();
updateItemsMenu();
updateCasesMenu();
updateClassicLevelButtons();
refreshKeybindButtons();
bindUI();
attachButtonSounds();
setupSocket();
openOnly(document.getElementById('startMenu'));
setInterval(gameLoop, 1000 / 60);
