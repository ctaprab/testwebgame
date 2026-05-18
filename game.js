/* ═══════════════════════════════════════════════════════════════════════
   Dragon's Ladder: Realm of Fortune
   ═══════════════════════════════════════════════════════════════════════ */

// ============ CHARACTER DEFINITIONS ============
const CHARACTERS = [
  {
    id: 'aldric',
    name: 'Aldric',
    title: 'The Stone Troll',
    sprite: 'sprites/Aldric.gif',
    color: '#9B2626',
    str: 5, lck: 2, wit: 2,
    ability: {
      name: 'Ironclad March',
      icon: '🛡',
      desc: 'Advance 6 squares without rolling and ignore any snake on this turn.',
      timing: 'preroll',
    }
  },
  {
    id: 'lysara',
    name: 'Lysara',
    title: 'The Ocular Watcher',
    sprite: 'sprites/Lysara.gif',
    color: '#5C4A9C',
    str: 1, lck: 5, wit: 3,
    ability: {
      name: 'Hex Reversal',
      icon: '🔮',
      desc: 'When stopping on a snake — flip it into a ladder for this turn only.',
      timing: 'onsnake',
    }
  },
  {
    id: 'keth',
    name: 'Keth',
    title: 'The Murky Slaad',
    sprite: 'sprites/Keth.gif',
    color: '#1A6B6B',
    str: 3, lck: 3, wit: 5,
    ability: {
      name: 'Shadow Step',
      icon: '🌑',
      desc: 'Teleport to any rival, then force them to re-roll their next move.',
      timing: 'preroll',
    }
  },
  {
    id: 'seraphel',
    name: 'Seraphel',
    title: 'The Crimson Slaad',
    sprite: 'sprites/Seraphel.gif',
    color: '#D4A017',
    str: 2, lck: 4, wit: 4,
    ability: {
      name: 'Foresight',
      icon: '👁',
      desc: 'Roll the die twice and pick whichever result you prefer.',
      timing: 'preroll',
    }
  },
];

// ============ BOARD CONFIG ============
const LADDERS = { 4:14, 9:31, 20:38, 28:56, 40:59, 51:67, 63:81, 71:91 };
const SNAKES  = { 17:7, 35:15, 46:25, 54:34, 62:43, 74:53, 87:24, 95:73 };

// Fortune (+) events keyed by square (LCK-scaling)
const FORTUNE = {
  12: { name: "Golden Rain",     low:+1, mid:+3, high:+5 },
  33: { name: "Fairy Blessing",  low:0,  mid:'reroll-high', high:'+4-skipsnake' },
  58: { name: "Dragon's Eye",    low:-2, mid:+3, high:'jump-ladder' },
  82: { name: "Star Alignment",  low:+2, mid:+5, high:'choose-1-6' },
};

// Curse events
const CURSE = {
  19: { name: "Black Mist",     low:-5, mid:-3, high:-1 },
  44: { name: "Witch's Hex",    low:'skip', mid:'coin-skip', high:0 },
  69: { name: "Falling Ruins",  low:'to-51', mid:-6, high:-2 },
  88: { name: "Void Rift",      low:'to-50', mid:-8, high:-3 },
};

// Gamble (push-your-luck) events
const GAMBLE = {
  22: { name: "Fortune's Wheel", safe:+3, push_win:+8,    push_lose:-5 },
  47: { name: "Dragon's Gambit", safe:+4, push_win:'next-ladder', push_lose:'next-snake' },
  65: { name: "Ancient Roulette", safe:+3, push_win:+10,  push_lose:-7 },
  79: { name: "Sky Dice",        safe:+5, push_win:+15,   push_lose:'to-60' },
};

// Duel events
const DUEL = {
  15: { name: "Crossroads Clash", win:+4, lose:-2 },
  38: { name: "Arena of Fate",    win:+6, lose:-4, push:{win:+12, lose:-8} },
  61: { name: "Dragon's Tribunal", win:'+5-skipsnake', lose:-5 },
  84: { name: "Sky Throne Duel",  win:'to-95', lose:'to-70', push:{win:'to-95', lose:'to-55'} },
};

// Zones
function zoneOf(n) {
  if (n <= 25)  return 'plains';
  if (n <= 50)  return 'forest';
  if (n <= 75)  return 'peak';
  return 'sky';
}

// Map a square number (1..100) to (row, col) within the serpentine grid.
// Square 1 is bottom-left; goes right on row 0, then left on row 1, etc.
function coordsOf(n) {
  const idx = n - 1;
  const row = Math.floor(idx / 10);              // 0 = bottom
  const colInRow = idx % 10;
  const col = (row % 2 === 0) ? colInRow : 9 - colInRow;
  const visualRow = 9 - row;                     // 0 = top
  return { row: visualRow, col };
}

function eventTypeOf(n) {
  if (FORTUNE[n]) return 'fortune';
  if (CURSE[n])   return 'curse';
  if (GAMBLE[n])  return 'gamble';
  if (DUEL[n])    return 'duel';
  return null;
}

const SYM = { fortune: '⚡', curse: '💀', gamble: '🎲', duel: '⚔' };

// ============ STATE ============
const State = {
  selected: [],       // [{charId, slot}]
  players: [],        // active players
  current: 0,
  dice: null,
  pendingMove: null,  // for re-roll
  rollMode: 'normal', // 'normal' | 'foresight-a' | 'foresight-b'
  foresightRolls: [],
  skipFlags: {},      // playerIdx -> turns to skip
  immuneFlags: {},    // playerIdx -> snake immunity counter (next N landings)
  hexReversalActive: false,
  forcedRoll: null,   // playerIdx -> true (must re-roll next move)
  pendingPush: null,  // store gamble context
};

// ============ HELPERS ============
const $ = (id) => document.getElementById(id);

function log(html) {
  const el = document.createElement('div');
  el.className = 'entry';
  el.innerHTML = html;
  $('log').appendChild(el);
  $('log').scrollTop = $('log').scrollHeight;
}

function lckTier(lck) {
  if (lck <= 2) return 'low';
  if (lck === 3) return 'mid';
  return 'high';
}

function currentPlayer() { return State.players[State.current]; }

// ============ SELECT SCREEN ============
function renderCharGrid() {
  const grid = $('char-grid');
  grid.innerHTML = '';
  CHARACTERS.forEach((c) => {
    const taken = State.selected.findIndex(s => s.charId === c.id);
    const card = document.createElement('div');
    card.className = 'char-card' + (taken >= 0 ? ' taken' : '');
    const strPips = [...Array(5)].map((_,i) => `<div class="pip ${i<c.str?'f':''}"></div>`).join('');
    const lckPips = [...Array(5)].map((_,i) => `<div class="pip ${i<c.lck?'f g':''}"></div>`).join('');
    const witPips = [...Array(5)].map((_,i) => `<div class="pip ${i<c.wit?'f':''}"></div>`).join('');
    card.innerHTML = `
      <span class="slot-pill">P${taken+1}</span>
      <div class="char-portrait"><img src="${c.sprite}" alt=""></div>
      <div class="char-name">${c.name}</div>
      <div class="char-title">${c.title}</div>
      <div class="stat-row"><span>STR</span><div class="pips">${strPips}</div></div>
      <div class="stat-row"><span>LCK</span><div class="pips">${lckPips}</div></div>
      <div class="stat-row"><span>WIT</span><div class="pips">${witPips}</div></div>
      <div class="ability-mini">
        <div class="label">${c.ability.icon} ${c.ability.name}</div>
        <div class="desc">${c.ability.desc}</div>
      </div>
    `;
    card.addEventListener('click', () => toggleSelect(c.id));
    grid.appendChild(card);
  });
}

function toggleSelect(charId) {
  const idx = State.selected.findIndex(s => s.charId === charId);
  if (idx >= 0) {
    State.selected.splice(idx, 1);
  } else {
    const max = parseInt($('player-count').textContent, 10);
    if (State.selected.length >= max) return;
    State.selected.push({ charId });
  }
  renderCharGrid();
  renderSelectRoster();
  $('start-game').disabled = State.selected.length !== parseInt($('player-count').textContent, 10);
}

function renderSelectRoster() {
  const el = $('select-roster');
  el.innerHTML = '';
  State.selected.forEach((s, i) => {
    const c = CHARACTERS.find(x => x.id === s.charId);
    const slot = document.createElement('div');
    slot.className = 'roster-slot';
    slot.innerHTML = `
      <span class="slot-num">${i+1}</span>
      <img src="${c.sprite}" alt="">
      <span>${c.name}</span>
      <span class="swatch" style="background:${c.color}"></span>
    `;
    el.appendChild(slot);
  });
}

function setupSelect() {
  renderCharGrid();
  renderSelectRoster();
  $('start-game').disabled = true;

  document.querySelectorAll('.count-ctrl button').forEach(btn => {
    btn.addEventListener('click', () => {
      const cur = parseInt($('player-count').textContent, 10);
      const next = btn.dataset.count === '+' ? Math.min(4, cur+1) : Math.max(2, cur-1);
      $('player-count').textContent = next;
      while (State.selected.length > next) State.selected.pop();
      renderCharGrid();
      renderSelectRoster();
      $('start-game').disabled = State.selected.length !== next;
    });
  });

  $('start-game').addEventListener('click', startGame);
}

// ============ START GAME ============
function startGame() {
  State.players = State.selected.map((s, i) => {
    const c = CHARACTERS.find(x => x.id === s.charId);
    return {
      idx: i,
      ...c,
      pos: 1,
      witLeft: c.wit,
      abilityUsed: false,
    };
  });

  $('screen-select').classList.remove('active');
  $('screen-game').classList.add('active');

  buildBoard();
  drawOverlay();
  renderTokens();
  renderActivePlayer();
  renderRoster();
  renderAbility();

  log(`<strong>The journey begins.</strong> ${State.players.map(p => p.name).join(', ')} stand at the gate.`);
  setupGameControls();
}

// ============ BOARD ============
function buildBoard() {
  const board = $('board');
  board.innerHTML = '';
  // Visual rows top→bottom = squares 100..91 (row 0), 81..90 (row 1), etc.
  for (let visualRow = 0; visualRow < 10; visualRow++) {
    const boardRow = 9 - visualRow;
    for (let col = 0; col < 10; col++) {
      const colInRow = (boardRow % 2 === 0) ? col : 9 - col;
      const n = boardRow * 10 + colInRow + 1;
      const cell = document.createElement('div');
      cell.className = `cell zone-${zoneOf(n)}`;
      cell.dataset.n = n;
      if (LADDERS[n]) cell.classList.add('ladder-bot');
      if (SNAKES[n])  cell.classList.add('snake-top');
      const et = eventTypeOf(n);
      if (et) cell.classList.add(`event-${et}`);
      if (n === 1)   cell.classList.add('start');
      if (n === 100) cell.classList.add('finish');

      let sym = '';
      if (et) sym = SYM[et];
      else if (LADDERS[n]) sym = '🪜';
      else if (SNAKES[n])  sym = '🐍';
      else if (n === 100)  sym = '🐉';

      cell.innerHTML = `
        <span class="cell-num">${n}</span>
        ${sym ? `<span class="cell-sym">${sym}</span>` : ''}
      `;
      cell.addEventListener('click', () => openCellInfo(n));
      board.appendChild(cell);
    }
  }
}

function drawOverlay() {
  const svg = $('overlay');
  svg.innerHTML = '';
  const W = 1000, H = 1000;
  const cw = W / 10, ch = H / 10;
  // pixel center of square n
  function center(n) {
    const { row, col } = coordsOf(n);
    return { x: col * cw + cw/2, y: row * ch + ch/2 };
  }

  // Ladders
  Object.entries(LADDERS).forEach(([from, to]) => {
    const a = center(+from), b = center(+to);
    drawLadder(svg, a, b);
  });
  // Snakes
  Object.entries(SNAKES).forEach(([from, to]) => {
    const a = center(+from), b = center(+to);
    drawSnake(svg, a, b);
  });
}

function drawLadder(svg, a, b) {
  const dx = b.x - a.x, dy = b.y - a.y;
  const len = Math.hypot(dx, dy);
  const nx = -dy/len, ny = dx/len;  // perp
  const w = 18;
  const ax1 = a.x + nx*w, ay1 = a.y + ny*w;
  const ax2 = a.x - nx*w, ay2 = a.y - ny*w;
  const bx1 = b.x + nx*w, by1 = b.y + ny*w;
  const bx2 = b.x - nx*w, by2 = b.y - ny*w;

  const g = svgEl('g', { 'opacity': 0.9 });
  // rails (gold)
  g.appendChild(svgEl('line', { x1: ax1, y1: ay1, x2: bx1, y2: by1, stroke: '#F5CC40', 'stroke-width': 5, 'stroke-linecap': 'round' }));
  g.appendChild(svgEl('line', { x1: ax2, y1: ay2, x2: bx2, y2: by2, stroke: '#F5CC40', 'stroke-width': 5, 'stroke-linecap': 'round' }));
  // shadow rails
  g.appendChild(svgEl('line', { x1: ax1+2, y1: ay1+2, x2: bx1+2, y2: by1+2, stroke: '#7C5A00', 'stroke-width': 2, opacity: 0.6 }));
  g.appendChild(svgEl('line', { x1: ax2+2, y1: ay2+2, x2: bx2+2, y2: by2+2, stroke: '#7C5A00', 'stroke-width': 2, opacity: 0.6 }));
  // rungs
  const rungs = Math.max(3, Math.floor(len / 38));
  for (let i = 1; i < rungs; i++) {
    const t = i / rungs;
    const x1 = ax1 + (bx1-ax1)*t, y1 = ay1 + (by1-ay1)*t;
    const x2 = ax2 + (bx2-ax2)*t, y2 = ay2 + (by2-ay2)*t;
    g.appendChild(svgEl('line', { x1, y1, x2, y2, stroke: '#F4A532', 'stroke-width': 4, 'stroke-linecap': 'round' }));
  }
  svg.appendChild(g);
}

function drawSnake(svg, a, b) {
  // serpentine path from a (dragon head) to b (tail)
  const dx = b.x - a.x, dy = b.y - a.y;
  const len = Math.hypot(dx, dy);
  const nx = -dy/len, ny = dx/len;
  const amp = Math.min(28, len * 0.12);
  const segments = 4;
  let d = `M ${a.x} ${a.y}`;
  for (let i = 1; i <= segments; i++) {
    const t = i / segments;
    const px = a.x + dx*t + nx*amp*Math.sin(i * Math.PI);
    const py = a.y + dy*t + ny*amp*Math.sin(i * Math.PI);
    const cx = a.x + dx*(t - 0.5/segments) + nx*amp*(i%2===1 ? 1 : -1);
    const cy = a.y + dy*(t - 0.5/segments) + ny*amp*(i%2===1 ? 1 : -1);
    d += ` Q ${cx} ${cy} ${px} ${py}`;
  }
  const g = svgEl('g', { 'opacity': 0.95 });
  // body
  g.appendChild(svgEl('path', { d, stroke: '#5C0A0A', 'stroke-width': 14, fill: 'none', 'stroke-linecap': 'round' }));
  g.appendChild(svgEl('path', { d, stroke: '#9B2626', 'stroke-width': 10, fill: 'none', 'stroke-linecap': 'round' }));
  // scales
  g.appendChild(svgEl('path', { d, stroke: '#D44F2E', 'stroke-width': 4, fill: 'none', 'stroke-linecap': 'round', 'stroke-dasharray': '3 6' }));
  // tail spike
  const tailAngle = Math.atan2(dy, dx) + Math.PI;
  const tx = b.x + Math.cos(tailAngle) * 10;
  const ty = b.y + Math.sin(tailAngle) * 10;
  const tnx = -Math.sin(tailAngle), tny = Math.cos(tailAngle);
  g.appendChild(svgEl('polygon', {
    points: `${b.x},${b.y} ${tx + tnx*5},${ty + tny*5} ${tx - tnx*5},${ty - tny*5}`,
    fill: '#5C0A0A'
  }));

  // ─── DRAGON HEAD at A ───
  // angle pointing AWAY from body (head looks outward)
  const headAngle = Math.atan2(-dy, -dx); // away from B
  drawDragonHead(g, a.x, a.y, headAngle);

  svg.appendChild(g);
}

function drawDragonHead(parent, cx, cy, angle) {
  // Build head in local space (head facing +X), then translate+rotate
  const wrap = svgEl('g', {
    transform: `translate(${cx} ${cy}) rotate(${angle * 180 / Math.PI})`
  });

  // skull / muzzle outline
  // muzzle path: from back-jaw curves around the snout
  const skull = svgEl('path', {
    d: 'M -10 -11 Q 8 -16 18 -7 Q 22 0 18 7 Q 8 16 -10 11 Q -14 0 -10 -11 Z',
    fill: '#9B2626', stroke: '#3A0606', 'stroke-width': 1.6, 'stroke-linejoin': 'round'
  });
  wrap.appendChild(skull);

  // belly highlight
  wrap.appendChild(svgEl('path', {
    d: 'M -2 8 Q 8 13 16 6 Q 12 10 4 11 Q -2 11 -2 8 Z',
    fill: '#D44F2E', opacity: 0.7
  }));

  // horns (two backward-swept)
  wrap.appendChild(svgEl('path', {
    d: 'M -6 -10 Q -14 -18 -22 -22 L -16 -12 Q -10 -10 -6 -10 Z',
    fill: '#3A0606', stroke: '#1A0000', 'stroke-width': 1
  }));
  wrap.appendChild(svgEl('path', {
    d: 'M -2 -12 Q -8 -20 -14 -24 L -8 -14 Q -4 -12 -2 -12 Z',
    fill: '#5C0A0A', stroke: '#1A0000', 'stroke-width': 1
  }));

  // brow ridge
  wrap.appendChild(svgEl('path', {
    d: 'M 0 -10 Q 6 -12 12 -8 Q 8 -10 4 -10 Z',
    fill: '#3A0606'
  }));

  // eye socket + glowing eye
  wrap.appendChild(svgEl('ellipse', { cx: 7, cy: -4, rx: 4, ry: 3, fill: '#1A0000' }));
  wrap.appendChild(svgEl('ellipse', { cx: 7.5, cy: -4, rx: 2.8, ry: 2.2, fill: '#F5CC40' }));
  wrap.appendChild(svgEl('ellipse', { cx: 8, cy: -4, rx: 1, ry: 1.8, fill: '#1A0000' })); // slit pupil
  wrap.appendChild(svgEl('circle', { cx: 8.5, cy: -5, r: 0.6, fill: '#FFF8CC' }));

  // nostril
  wrap.appendChild(svgEl('ellipse', { cx: 16, cy: -2, rx: 1.2, ry: 0.9, fill: '#1A0000' }));

  // teeth (fangs at front of mouth)
  wrap.appendChild(svgEl('polygon', {
    points: '14,3 16,8 18,3',
    fill: '#FDF3DC', stroke: '#3A0606', 'stroke-width': 0.5
  }));
  wrap.appendChild(svgEl('polygon', {
    points: '11,4 12.5,9 14.5,4',
    fill: '#FDF3DC', stroke: '#3A0606', 'stroke-width': 0.5
  }));

  // tongue flicker
  wrap.appendChild(svgEl('path', {
    d: 'M 18 1 Q 24 2 26 0 M 22 1 L 23 -1 M 24 0 L 25 2',
    stroke: '#D44F2E', 'stroke-width': 1.3, fill: 'none', 'stroke-linecap': 'round'
  }));

  parent.appendChild(wrap);
}

function svgEl(tag, attrs) {
  const el = document.createElementNS('http://www.w3.org/2000/svg', tag);
  for (const k in attrs) el.setAttribute(k, attrs[k]);
  return el;
}

// ============ TOKENS ============
function renderTokens() {
  const layer = $('tokens');
  layer.innerHTML = '';
  State.players.forEach((p, i) => {
    const t = document.createElement('div');
    t.className = 'token' + (i === State.current ? ' active' : '');
    t.id = `token-${i}`;
    t.style.color = p.color;
    t.innerHTML = `<img src="${p.sprite}" alt="${p.name}"><div class="token-base"></div>`;
    layer.appendChild(t);
    positionToken(i, p.pos, i);
  });
}

function positionToken(playerIdx, square, offsetIdx) {
  const t = document.getElementById(`token-${playerIdx}`);
  if (!t) return;
  const { row, col } = coordsOf(square);
  // pack multiple tokens in a cell with small offsets
  const cellSize = 10; // percent
  // offsets per slot (within a cell)
  const offsets = [
    { dx: -1.4, dy: -1.4 },
    { dx:  1.4, dy: -1.4 },
    { dx: -1.4, dy:  1.4 },
    { dx:  1.4, dy:  1.4 },
  ];
  const off = offsets[offsetIdx % 4];
  const left = col * cellSize + cellSize/2 - 4.5 + off.dx;
  const top  = row * cellSize + cellSize/2 - 4.5 + off.dy;
  t.style.left = left + '%';
  t.style.top  = top + '%';
}

function moveToken(playerIdx, fromN, toN, callback) {
  const p = State.players[playerIdx];
  const step = toN > fromN ? 1 : -1;
  const path = [];
  for (let n = fromN + step; step > 0 ? n <= toN : n >= toN; n += step) path.push(n);
  if (path.length === 0) { callback && callback(); return; }

  let i = 0;
  const stepDur = 180;
  const tick = () => {
    p.pos = path[i];
    positionToken(playerIdx, p.pos, playerIdx);
    renderRoster();
    i++;
    if (i < path.length) setTimeout(tick, stepDur);
    else setTimeout(() => callback && callback(), 220);
  };
  tick();
}

// teleport (no step animation) — e.g. ladders/snakes
function warpToken(playerIdx, toN, callback) {
  const p = State.players[playerIdx];
  p.pos = toN;
  positionToken(playerIdx, toN, playerIdx);
  renderRoster();
  setTimeout(() => callback && callback(), 380);
}

// ============ SIDEBAR ============
function renderActivePlayer() {
  const p = currentPlayer();
  const el = $('active-player');
  el.innerHTML = `
    <div class="ap-portrait"><img src="${p.sprite}" alt=""></div>
    <div>
      <div class="ap-name">${p.name}</div>
      <div class="ap-title">${p.title}</div>
    </div>
    <div class="ap-pos">${p.pos}<small>square</small></div>
  `;
  el.style.cursor = 'pointer';
  el.onclick = () => openCharacterSheet(p.idx);
}

function renderRoster() {
  const r = $('roster');
  r.innerHTML = '';
  State.players.forEach((p, i) => {
    const row = document.createElement('div');
    row.className = 'roster-row' + (i === State.current ? ' active' : '');
    row.innerHTML = `
      <img src="${p.sprite}" alt="">
      <span class="rname">${p.name}</span>
      <span class="rpos">${p.pos}</span>
      <span class="rwit">WIT ${p.witLeft}</span>
    `;
    row.addEventListener('click', () => openCharacterSheet(i));
    r.appendChild(row);
  });
}

function renderAbility() {
  const p = currentPlayer();
  const block = $('ability-block');
  const usable = !p.abilityUsed && p.ability.timing === 'preroll';
  block.className = 'ability-block' + (p.abilityUsed ? ' used' : '');
  block.innerHTML = `
    <div class="ab-label">
      <span>${p.ability.icon} ${p.ability.name}</span>
    </div>
    <div>${p.ability.desc}</div>
    ${usable ? `<button id="ability-btn">Invoke</button>` : ''}
  `;
  if (usable) {
    $('ability-btn').addEventListener('click', invokeAbility);
  }
}

// ============ GAME CONTROLS ============
function setupGameControls() {
  $('roll-btn').addEventListener('click', onRollClick);
  $('reroll-btn').addEventListener('click', onRerollClick);
}

function setRollEnabled(en) {
  $('roll-btn').disabled = !en;
  $('reroll-btn').disabled = !(en && currentPlayer().witLeft > 0 && State.dice !== null);
}

function rollD6() {
  // Crypto random
  const buf = new Uint8Array(1);
  let v;
  do { crypto.getRandomValues(buf); v = buf[0]; } while (v >= 252);
  return (v % 6) + 1;
}

function animateDice(value, cb) {
  const face = $('dice-face');
  const dice = $('dice');
  dice.classList.remove('rolling');
  void dice.offsetWidth;
  dice.classList.add('rolling');
  let ticks = 0;
  const tickIv = setInterval(() => {
    face.textContent = (Math.floor(Math.random()*6)+1);
    ticks++;
    if (ticks >= 6) { clearInterval(tickIv); face.textContent = value; cb && cb(); }
  }, 70);
}

function onRollClick() {
  setRollEnabled(false);
  const p = currentPlayer();

  // Skipped turn
  if (State.skipFlags[p.idx] > 0) {
    State.skipFlags[p.idx]--;
    log(`<strong>${p.name}</strong> is rooted in place. <span class="bad">Turn skipped.</span>`);
    setTimeout(endTurn, 700);
    return;
  }

  if (State.rollMode === 'foresight-a') {
    const v = rollD6();
    State.foresightRolls = [v];
    animateDice(v, () => {
      log(`<strong>${p.name}</strong> rolls <strong>${v}</strong> (Foresight #1).`);
      State.rollMode = 'foresight-b';
      setRollEnabled(true);
    });
    return;
  }

  if (State.rollMode === 'foresight-b') {
    const v = rollD6();
    State.foresightRolls.push(v);
    animateDice(v, () => {
      log(`<strong>${p.name}</strong> rolls <strong>${v}</strong> (Foresight #2). Choose: ${State.foresightRolls.join(' or ')}.`);
      openForesightPicker();
    });
    return;
  }

  // Normal roll
  const v = rollD6();
  State.dice = v;
  animateDice(v, () => {
    log(`<strong>${p.name}</strong> rolls <strong>${v}</strong>.`);
    // Re-roll: only allow once before move
    if (p.witLeft > 0) {
      $('reroll-btn').disabled = false;
      // Show a brief moment to decide
      setTimeout(() => beginMove(v), 800);
    } else {
      beginMove(v);
    }
  });
}

function onRerollClick() {
  const p = currentPlayer();
  if (p.witLeft <= 0 || State.dice === null) return;
  p.witLeft--;
  renderRoster();
  log(`<strong>${p.name}</strong> spends a <span class="good">WIT charge</span> (${p.witLeft} left) and re-rolls.`);
  const v = rollD6();
  State.dice = v;
  $('reroll-btn').disabled = true;
  animateDice(v, () => {
    log(`<strong>${p.name}</strong> re-rolls <strong>${v}</strong>.`);
    setTimeout(() => beginMove(v), 600);
  });
}

function beginMove(v) {
  const p = currentPlayer();
  $('reroll-btn').disabled = true;
  let target = p.pos + v;
  // bounce back on overshoot
  if (target > 100) target = 100 - (target - 100);

  moveToken(p.idx, p.pos, target, () => onLanding(target));
}

function onLanding(square) {
  const p = currentPlayer();

  // Snake immunity (Aldric's Ironclad March)
  if (SNAKES[square] && State.immuneFlags[p.idx] > 0) {
    State.immuneFlags[p.idx]--;
    log(`<strong>${p.name}</strong> stomps through the snake at <strong>${square}</strong> — <span class="good">immune</span>.`);
    return checkFinishOrEvent(square);
  }

  // Snake — but Lysara may reverse it
  if (SNAKES[square]) {
    if (p.ability.timing === 'onsnake' && !p.abilityUsed) {
      // Offer Hex Reversal
      openHexReversal(square);
      return;
    }
    return slideSnake(square);
  }

  // Ladder
  if (LADDERS[square]) {
    const to = LADDERS[square];
    log(`<strong>${p.name}</strong> climbs the ladder to <strong>${to}</strong>! <span class="good">⬆</span>`);
    return warpToken(p.idx, to, () => checkFinishOrEvent(to));
  }

  checkFinishOrEvent(square);
}

function slideSnake(square) {
  const p = currentPlayer();
  const to = SNAKES[square];
  log(`<strong>${p.name}</strong> is swallowed by the snake! Down to <strong>${to}</strong>. <span class="bad">🐍</span>`);
  warpToken(p.idx, to, () => checkFinishOrEvent(to));
}

function checkFinishOrEvent(square) {
  if (square === 100) return doVictory();
  const et = eventTypeOf(square);
  if (et) return runEvent(et, square);
  endTurn();
}

// ============ EVENTS ============
function runEvent(type, square) {
  if (type === 'fortune') runFortune(square);
  else if (type === 'curse') runCurse(square);
  else if (type === 'gamble') runGamble(square);
  else if (type === 'duel') runDuel(square);
}

function runFortune(square) {
  const p = currentPlayer();
  const ev = FORTUNE[square];
  const tier = lckTier(p.lck);
  const outcome = ev[tier];
  showEventModal({
    type: 'fortune',
    title: ev.name,
    body: `${p.name} feels fortune's gaze. <em>(LCK ${p.lck} → ${tier.toUpperCase()})</em>`,
    extra: outcomeText(outcome),
    buttons: [{ label: 'Receive', onClick: () => { closeModal(); resolveOutcome(outcome); } }]
  });
}

function runCurse(square) {
  const p = currentPlayer();
  const ev = CURSE[square];
  const tier = lckTier(p.lck);
  const outcome = ev[tier];
  showEventModal({
    type: 'curse',
    title: ev.name,
    body: `Dark forces gather around ${p.name}. <em>(LCK ${p.lck} → ${tier.toUpperCase()})</em>`,
    extra: outcomeText(outcome),
    buttons: [{ label: 'Endure', onClick: () => { closeModal(); resolveOutcome(outcome); } }]
  });
}

function runGamble(square) {
  const p = currentPlayer();
  const ev = GAMBLE[square];
  showEventModal({
    type: 'gamble',
    title: ev.name,
    body: `${p.name} stands at the wheel of chance. Push your luck?`,
    extra: `
      <div style="display:grid;grid-template-columns:auto 1fr;gap:6px 14px;font-size:0.95rem;">
        <strong style="color:#4A7C2A">Safe:</strong>  <span>${outcomeText(ev.safe)}</span>
        <strong style="color:#D4A017">Push ✓ (4–6):</strong> <span>${outcomeText(ev.push_win)}</span>
        <strong style="color:#9B2626">Push ✗ (1–3):</strong> <span>${outcomeText(ev.push_lose)}</span>
      </div>
    `,
    buttons: [
      { label: 'Accept (Safe)', cls: 'safe', onClick: () => { closeModal(); resolveOutcome(ev.safe); } },
      { label: 'Push!', cls: 'risk', onClick: () => doGamblePush(ev) },
    ]
  });
}

function doGamblePush(ev) {
  closeModal();
  const p = currentPlayer();
  log(`<strong>${p.name}</strong> pushes the gamble...`);
  // animate dice
  const v = rollD6();
  animateDice(v, () => {
    const win = v >= 4;
    log(`Rolled <strong>${v}</strong>. ${win ? '<span class="good">Push ✓</span>' : '<span class="bad">Push ✗</span>'}`);
    showEventModal({
      type: 'gamble',
      title: win ? 'The Gods Smile' : 'The Gods Frown',
      body: `${p.name} rolled a <strong>${v}</strong>.`,
      extra: outcomeText(win ? ev.push_win : ev.push_lose),
      buttons: [{ label: 'Resolve', onClick: () => { closeModal(); resolveOutcome(win ? ev.push_win : ev.push_lose); } }]
    });
  });
}

function runDuel(square) {
  const p = currentPlayer();
  const ev = DUEL[square];
  const opponents = State.players.filter(x => x.idx !== p.idx);

  showEventModal({
    type: 'duel',
    title: ev.name,
    body: `${p.name} calls a rival to the field of honor.`,
    extra: `<div class="target-picker">` +
      opponents.map(o => `
        <button class="target-pick" data-idx="${o.idx}">
          <img src="${o.sprite}" alt="">
          <span>${o.name} <small style="opacity:0.7">(STR ${o.str})</small></span>
          <span class="pos-mini">${o.pos}</span>
        </button>
      `).join('') + `</div>`,
    buttons: []
  });
  // attach handlers after modal renders
  document.querySelectorAll('.target-pick').forEach(btn => {
    btn.addEventListener('click', () => {
      const opp = State.players[+btn.dataset.idx];
      closeModal();
      runDuelClash(ev, opp);
    });
  });
}

function runDuelClash(ev, opp) {
  const p = currentPlayer();
  const offerPush = !!ev.push;

  const doClash = (push) => {
    const r1 = rollD6();
    const r2 = rollD6();
    const a = r1 + p.str;
    const b = r2 + opp.str;
    const winner = a >= b ? p : opp;
    const playerWon = winner.idx === p.idx;

    let outA, outB;
    if (push) {
      outA = playerWon ? ev.push.win : ev.push.lose;
      // duel: opponent gets opposite outcome from base table
      outB = playerWon ? ev.lose : ev.win;
    } else {
      outA = playerWon ? ev.win : ev.lose;
      outB = playerWon ? ev.lose : ev.win;
    }

    showEventModal({
      type: 'duel',
      title: ev.name + ' — Clash',
      body: '',
      extra: `
        <div class="duel-grid">
          <div class="duel-side ${playerWon?'winner':''}">
            <img src="${p.sprite}" alt="">
            <div class="dname">${p.name}</div>
            <div class="dcalc">${r1} + ${p.str} STR</div>
            <div class="dtotal">${a}</div>
          </div>
          <div class="duel-vs">VS</div>
          <div class="duel-side ${!playerWon?'winner':''}">
            <img src="${opp.sprite}" alt="">
            <div class="dname">${opp.name}</div>
            <div class="dcalc">${r2} + ${opp.str} STR</div>
            <div class="dtotal">${b}</div>
          </div>
        </div>
        <p style="text-align:center;margin-top:6px;"><strong>${winner.name}</strong> claims the field!</p>
        <div style="font-size:0.9rem;margin-top:8px;">
          <div>${p.name}: ${outcomeText(outA)}</div>
          <div>${opp.name}: ${outcomeText(outB)}</div>
        </div>
      `,
      buttons: [{ label: 'Apply', onClick: () => {
        closeModal();
        log(`<strong>${p.name}</strong> ${r1}+${p.str} vs <strong>${opp.name}</strong> ${r2}+${opp.str}. ${playerWon?'<span class="good">Victory!</span>':'<span class="bad">Defeated.</span>'}`);
        applyOutcomeFor(opp.idx, outB, () => resolveOutcome(outA));
      }}]
    });
  };

  if (offerPush) {
    showEventModal({
      type: 'duel',
      title: ev.name,
      body: `${p.name} vs ${opp.name}. Push for higher stakes?`,
      extra: `
        <div style="display:grid;grid-template-columns:auto 1fr;gap:6px 14px;font-size:0.95rem;">
          <strong>Standard W/L:</strong> <span>${outcomeText(ev.win)} / ${outcomeText(ev.lose)}</span>
          <strong style="color:#D4A017">Push W/L:</strong> <span>${outcomeText(ev.push.win)} / ${outcomeText(ev.push.lose)}</span>
        </div>
      `,
      buttons: [
        { label: 'Standard', cls: 'safe', onClick: () => { closeModal(); doClash(false); } },
        { label: 'Push!',    cls: 'risk', onClick: () => { closeModal(); doClash(true); } },
      ]
    });
  } else {
    doClash(false);
  }
}

// ============ OUTCOME RESOLUTION ============
function outcomeText(o) {
  if (typeof o === 'number') {
    if (o === 0) return 'No effect.';
    return (o > 0 ? `Advance +${o}` : `Retreat ${o}`) + ' squares.';
  }
  if (o === 'skip') return 'Skip next turn.';
  if (o === 'coin-skip') return 'Coin flip: odd = skip, even = no effect.';
  if (o === 'reroll-high') return 'Roll D6 twice — use the higher result.';
  if (o === '+4-skipsnake') return 'Advance +4 and immune to next snake.';
  if (o === 'jump-ladder') return 'Jump to the nearest ladder ahead.';
  if (o === 'choose-1-6') return 'Choose any advance 1–6.';
  if (typeof o === 'string' && o.startsWith('to-')) return `Go to square ${o.slice(3)}.`;
  if (typeof o === 'string' && o.startsWith('+5-skipsnake')) return 'Advance +5 and immune to next snake.';
  if (o === 'next-ladder') return 'Jump to the next ladder ahead.';
  if (o === 'next-snake')  return 'Slide down at the next snake ahead.';
  return String(o);
}

function resolveOutcome(o, cb) {
  const p = currentPlayer();
  applyOutcomeFor(p.idx, o, () => { cb ? cb() : endTurn(); });
}

function applyOutcomeFor(idx, o, cb) {
  const p = State.players[idx];
  const finish = () => cb && cb();

  if (o == null || o === 0) return finish();

  if (typeof o === 'number') {
    let target = p.pos + o;
    if (target > 100) target = 100 - (target - 100);
    if (target < 1) target = 1;
    return moveToken(idx, p.pos, target, () => {
      if (target === 100 && idx === State.current) return doVictory();
      finish();
    });
  }

  if (o === 'skip') {
    State.skipFlags[idx] = (State.skipFlags[idx] || 0) + 1;
    log(`<strong>${p.name}</strong> is dazed — will skip next turn.`);
    return finish();
  }
  if (o === 'coin-skip') {
    const v = rollD6();
    if (v % 2 === 1) {
      State.skipFlags[idx] = (State.skipFlags[idx] || 0) + 1;
      log(`Coin landed odd — <strong>${p.name}</strong> skips next turn.`);
    } else {
      log(`Coin landed even — <strong>${p.name}</strong> shrugs off the hex.`);
    }
    return finish();
  }
  if (o === 'reroll-high') {
    const a = rollD6(), b = rollD6();
    const v = Math.max(a, b);
    log(`<strong>${p.name}</strong> rolls ${a} and ${b}, picks <strong>${v}</strong>.`);
    let target = p.pos + v;
    if (target > 100) target = 100 - (target - 100);
    return moveToken(idx, p.pos, target, () => {
      if (target === 100 && idx === State.current) return doVictory();
      finish();
    });
  }
  if (o === '+4-skipsnake') {
    State.immuneFlags[idx] = (State.immuneFlags[idx]||0) + 1;
    return applyOutcomeFor(idx, 4, finish);
  }
  if (o === '+5-skipsnake') {
    State.immuneFlags[idx] = (State.immuneFlags[idx]||0) + 1;
    return applyOutcomeFor(idx, 5, finish);
  }
  if (o === 'jump-ladder' || o === 'next-ladder') {
    const next = nextLadderFrom(p.pos);
    if (!next) { log(`No ladders ahead — no effect.`); return finish(); }
    log(`<strong>${p.name}</strong> leaps to ladder at <strong>${next}</strong>.`);
    return moveToken(idx, p.pos, next, () => {
      const to = LADDERS[next];
      log(`...and climbs to <strong>${to}</strong>!`);
      warpToken(idx, to, () => { if (to === 100 && idx === State.current) return doVictory(); finish(); });
    });
  }
  if (o === 'next-snake') {
    const next = nextSnakeFrom(p.pos);
    if (!next) { log(`No snakes ahead — no effect.`); return finish(); }
    log(`<strong>${p.name}</strong> stumbles onto snake at <strong>${next}</strong>.`);
    return moveToken(idx, p.pos, next, () => {
      const to = SNAKES[next];
      log(`...and slides to <strong>${to}</strong>.`);
      warpToken(idx, to, finish);
    });
  }
  if (o === 'choose-1-6') {
    return openChoosePicker(idx, finish);
  }
  if (typeof o === 'string' && o.startsWith('to-')) {
    const target = +o.slice(3);
    return moveToken(idx, p.pos, target, () => {
      if (target === 100 && idx === State.current) return doVictory();
      finish();
    });
  }
  finish();
}

function nextLadderFrom(pos) {
  const arr = Object.keys(LADDERS).map(Number).sort((a,b)=>a-b);
  return arr.find(n => n > pos);
}
function nextSnakeFrom(pos) {
  const arr = Object.keys(SNAKES).map(Number).sort((a,b)=>a-b);
  return arr.find(n => n > pos);
}

function openChoosePicker(idx, cb) {
  const p = State.players[idx];
  const buttons = [1,2,3,4,5,6].map(n => ({
    label: `+${n}`,
    onClick: () => { closeModal(); applyOutcomeFor(idx, n, cb); }
  }));
  showEventModal({
    type: 'fortune',
    title: 'Star Alignment',
    body: `${p.name} chooses the path of the stars.`,
    extra: 'Pick any advance from 1 to 6.',
    buttons
  });
}

// ============ ABILITIES ============
function invokeAbility() {
  const p = currentPlayer();
  if (p.abilityUsed) return;
  if (p.id === 'aldric') {
    p.abilityUsed = true;
    State.immuneFlags[p.idx] = (State.immuneFlags[p.idx]||0) + 1;
    renderAbility();
    log(`🛡 <strong>${p.name}</strong> invokes <strong>Ironclad March</strong> — advances 6 and ignores snakes.`);
    setRollEnabled(false);
    let target = p.pos + 6;
    if (target > 100) target = 100 - (target - 100);
    moveToken(p.idx, p.pos, target, () => onLanding(target));
    return;
  }
  if (p.id === 'keth') {
    // pick target
    const others = State.players.filter(x => x.idx !== p.idx);
    showEventModal({
      type: 'duel',
      title: 'Shadow Step',
      body: 'Teleport to a rival, then force them to re-roll their next move.',
      extra: `<div class="target-picker">` + others.map(o => `
        <button class="target-pick" data-idx="${o.idx}">
          <img src="${o.sprite}"><span>${o.name}</span>
          <span class="pos-mini">${o.pos}</span>
        </button>`).join('') + `</div>`,
      buttons: [{ label: 'Cancel', cls: 'ghost', onClick: closeModal }]
    });
    document.querySelectorAll('.target-pick').forEach(btn => {
      btn.addEventListener('click', () => {
        const opp = State.players[+btn.dataset.idx];
        closeModal();
        p.abilityUsed = true;
        State.forcedRoll = opp.idx;
        log(`🌑 <strong>${p.name}</strong> shadow-steps to <strong>${opp.name}</strong> at ${opp.pos}.`);
        warpToken(p.idx, opp.pos, () => {
          renderAbility();
          renderActivePlayer();
          // still need to roll
          setRollEnabled(true);
        });
      });
    });
    return;
  }
  if (p.id === 'seraphel') {
    p.abilityUsed = true;
    State.rollMode = 'foresight-a';
    State.foresightRolls = [];
    renderAbility();
    log(`👁 <strong>${p.name}</strong> invokes <strong>Foresight</strong> — roll twice, choose one.`);
    return;
  }
}

function openForesightPicker() {
  const [a, b] = State.foresightRolls;
  showEventModal({
    type: 'fortune',
    title: 'Foresight',
    body: 'Choose your fate.',
    extra: `<div style="display:flex;gap:10px;justify-content:center;font-family:'Cinzel Decorative',serif;font-size:1.5rem;">
      <button class="target-pick" data-v="${a}" style="font-size:2rem;justify-content:center;">${a}</button>
      <button class="target-pick" data-v="${b}" style="font-size:2rem;justify-content:center;">${b}</button>
    </div>`,
    buttons: []
  });
  document.querySelectorAll('.target-pick').forEach(btn => {
    btn.addEventListener('click', () => {
      const v = +btn.dataset.v;
      closeModal();
      State.rollMode = 'normal';
      State.foresightRolls = [];
      State.dice = v;
      log(`<strong>${currentPlayer().name}</strong> chooses <strong>${v}</strong>.`);
      setTimeout(() => beginMove(v), 300);
    });
  });
}

function openHexReversal(square) {
  const p = currentPlayer();
  showEventModal({
    type: 'fortune',
    title: 'Hex Reversal?',
    body: `${p.name} stops on the snake at <strong>${square}</strong>. Invoke Hex Reversal?`,
    extra: `Snake would drag you to <strong>${SNAKES[square]}</strong>. The hex inverts it — climb instead.`,
    buttons: [
      { label: 'Invoke 🔮', cls: 'safe', onClick: () => {
        closeModal();
        p.abilityUsed = true;
        renderAbility();
        // find an ascending destination — flip snake into a "ladder"
        const climbTo = Math.min(100, square + (square - SNAKES[square])); // mirror upward
        log(`🔮 <strong>${p.name}</strong> reverses the hex — climbs to <strong>${climbTo}</strong>!`);
        warpToken(p.idx, climbTo, () => checkFinishOrEvent(climbTo));
      }},
      { label: 'Endure the snake', cls: 'ghost', onClick: () => { closeModal(); slideSnake(square); }}
    ]
  });
}

// ============ MODAL ============
function showEventModal({ type, title, body, extra, buttons }) {
  $('modal-banner').textContent = (type || 'event').toUpperCase();
  $('modal-banner').className = 'modal-banner ' + (type || '');
  $('modal-title').textContent = title;
  $('modal-body').innerHTML = body || '';
  $('modal-extra').innerHTML = extra || '';
  const btnWrap = $('modal-buttons');
  btnWrap.innerHTML = '';
  (buttons || []).forEach(b => {
    const el = document.createElement('button');
    if (b.cls) el.className = b.cls;
    el.textContent = b.label;
    el.addEventListener('click', b.onClick);
    btnWrap.appendChild(el);
  });
  $('modal-shade').classList.add('show');
}
function closeModal() { $('modal-shade').classList.remove('show'); }

// ============ END TURN / VICTORY ============
function endTurn() {
  State.dice = null;
  // Advance current player
  const n = State.players.length;
  let next = (State.current + 1) % n;
  // Handle Keth's "force re-roll": if the next player was hit by Shadow Step,
  // they still take their turn — but spec says "force re-roll" of their move.
  // We implement this as: their first roll is automatically re-rolled (no WIT cost).
  State.current = next;
  renderActivePlayer();
  renderRoster();
  renderAbility();
  // refresh active token highlight
  document.querySelectorAll('.token').forEach((el, i) => el.classList.toggle('active', i === State.current));
  setRollEnabled(true);

  // If forced re-roll applies to this player, prepend a notice
  if (State.forcedRoll === State.current) {
    log(`<strong>${currentPlayer().name}</strong> is shadow-marked — must re-roll their first die.`);
    State.forcedRoll = null;
    // We implement by giving a free re-roll: on next roll, if WIT=0 we still allow one extra.
    State.players[State.current].witLeft += 1; // temporary free
    State.players[State.current]._forcedFree = true;
  }
}

function doVictory() {
  const p = currentPlayer();
  log(`🏆 <strong>${p.name}</strong> reaches the Sky Temple's peak!`);

  // Populate the scene
  $('victory-name').textContent = p.name;
  $('victory-title').textContent = p.title;
  $('victory-sub').textContent = `claims the dragon's blessing.`;
  $('victory-sprite').src = p.sprite;

  // Final standings strip — winner stats
  const witUsed = p.wit - p.witLeft;
  $('victory-stats').innerHTML = `
    <div class="vs-cell"><div class="vs-num">${p.pos}</div><div class="vs-lbl">Final Square</div></div>
    <div class="vs-cell"><div class="vs-num">${witUsed}</div><div class="vs-lbl">WIT Spent</div></div>
    <div class="vs-cell"><div class="vs-num">${p.abilityUsed ? '✓' : '—'}</div><div class="vs-lbl">${p.ability.name}</div></div>
  `;

  $('victory-shade').classList.add('show');

  // Wire buttons (idempotent — replace by re-binding)
  $('new-game-btn').onclick = newGame;
  $('rematch-btn').onclick = rematch;

  // Kick off confetti
  startConfetti();
}

function newGame() {
  stopConfetti();
  location.reload();
}

function rematch() {
  stopConfetti();
  // Reset player runtime state, keep selection
  State.players.forEach(p => {
    p.pos = 1;
    p.witLeft = p.wit;
    p.abilityUsed = false;
    delete p._forcedFree;
  });
  State.current = 0;
  State.dice = null;
  State.pendingMove = null;
  State.rollMode = 'normal';
  State.foresightRolls = [];
  State.skipFlags = {};
  State.immuneFlags = {};
  State.hexReversalActive = false;
  State.forcedRoll = null;
  State.pendingPush = null;

  $('victory-shade').classList.remove('show');
  $('log').innerHTML = '';
  renderTokens();
  renderActivePlayer();
  renderRoster();
  renderAbility();
  setRollEnabled(true);
  log(`<strong>The rematch begins.</strong> ${State.players.map(x => x.name).join(', ')} return to the gate.`);
}

// ═══════════════════════════════════════════════════════════════════════
// CONFETTI
// ═══════════════════════════════════════════════════════════════════════
let confettiState = { running: false, particles: [], rafId: 0, canvas: null, ctx: null };

function startConfetti() {
  const canvas = $('confetti');
  const shade = $('victory-shade');
  canvas.width = shade.clientWidth;
  canvas.height = shade.clientHeight;
  const ctx = canvas.getContext('2d');

  const colors = ['#F5CC40', '#D4A017', '#C96B00', '#9B2626', '#FDD17A', '#4A7C2A', '#5C4A9C'];
  const particles = [];
  const count = 140;
  for (let i = 0; i < count; i++) {
    particles.push({
      x: Math.random() * canvas.width,
      y: -Math.random() * canvas.height * 0.5,
      vx: (Math.random() - 0.5) * 2,
      vy: 1.5 + Math.random() * 2.5,
      vr: (Math.random() - 0.5) * 8,
      r: 0,
      size: 5 + Math.random() * 8,
      color: colors[i % colors.length],
      shape: Math.random() < 0.4 ? 'rect' : (Math.random() < 0.5 ? 'circ' : 'tri'),
      drift: Math.random() * Math.PI * 2,
    });
  }

  confettiState = { running: true, particles, canvas, ctx, rafId: 0 };

  const tick = () => {
    if (!confettiState.running) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    for (const p of particles) {
      p.drift += 0.02;
      p.x += p.vx + Math.sin(p.drift) * 0.6;
      p.y += p.vy;
      p.r += p.vr;
      if (p.y > canvas.height + 20) {
        p.y = -20;
        p.x = Math.random() * canvas.width;
      }
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.r * Math.PI / 180);
      ctx.fillStyle = p.color;
      if (p.shape === 'rect') {
        ctx.fillRect(-p.size/2, -p.size/3, p.size, p.size/1.6);
      } else if (p.shape === 'circ') {
        ctx.beginPath();
        ctx.arc(0, 0, p.size/2, 0, Math.PI*2);
        ctx.fill();
      } else {
        ctx.beginPath();
        ctx.moveTo(0, -p.size/2);
        ctx.lineTo(p.size/2, p.size/2);
        ctx.lineTo(-p.size/2, p.size/2);
        ctx.closePath();
        ctx.fill();
      }
      ctx.restore();
    }
    confettiState.rafId = requestAnimationFrame(tick);
  };
  tick();

  // Resize handler
  confettiState.onResize = () => {
    canvas.width = shade.clientWidth;
    canvas.height = shade.clientHeight;
  };
  window.addEventListener('resize', confettiState.onResize);
}

function stopConfetti() {
  if (!confettiState.running) return;
  confettiState.running = false;
  cancelAnimationFrame(confettiState.rafId);
  if (confettiState.onResize) window.removeEventListener('resize', confettiState.onResize);
  if (confettiState.canvas) {
    const ctx = confettiState.canvas.getContext('2d');
    ctx.clearRect(0, 0, confettiState.canvas.width, confettiState.canvas.height);
  }
}

// ============ INIT ============
window.addEventListener('DOMContentLoaded', () => {
  setupSelect();
  setupInfoModal();
});

// ═══════════════════════════════════════════════════════════════════════
// CELL INFO MODAL — click a square to view its event/snake/ladder details
// ═══════════════════════════════════════════════════════════════════════

function pipsHtml(n, max=5, cls='f') {
  return [...Array(max)].map((_,i) => `<div class="pip ${i<n?cls:''}"></div>`).join('');
}

function openCellInfo(square) {
  const body = $('cell-body');
  const zone = zoneOf(square);
  const zoneNames = { plains: 'The Golden Plains', forest: 'Whispering Forest', peak: "Dragon's Peak", sky: 'Sky Temple' };
  const zoneLabel = zoneNames[zone];

  // Occupants
  const occ = (State.players || []).filter(p => p.pos === square);
  const occHtml = occ.length
    ? `<div class="info-card"><div class="info-card-title">⚑ Heroes Here</div>
        <div class="occupants">${occ.map(p => `<span class="occ"><img src="${p.sprite}">${p.name}</span>`).join('')}</div></div>`
    : '';

  // Special squares
  let specialHtml = '';
  if (square === 1) {
    specialHtml = `<div class="info-card"><div class="info-card-title">🏁 Starting Gate</div>
      Every hero begins their ascent here.</div>`;
  } else if (square === 100) {
    specialHtml = `<div class="info-card"><div class="info-card-title">🐉 Sky Temple Apex</div>
      The final square. Reach it (or beyond) to claim victory.<br>
      <em>Overshoot bounces you back.</em></div>`;
  }

  if (LADDERS[square]) {
    specialHtml += `<div class="info-card ladder"><div class="info-card-title">🪜 Ladder Foot</div>
      Climb up to square <strong>${LADDERS[square]}</strong> on landing here.</div>`;
  }
  const ladderTopFrom = Object.entries(LADDERS).find(([,to]) => +to === square);
  if (ladderTopFrom) {
    specialHtml += `<div class="info-card ladder"><div class="info-card-title">🪜 Ladder Top</div>
      Heroes climbing from <strong>${ladderTopFrom[0]}</strong> arrive here.</div>`;
  }

  if (SNAKES[square]) {
    specialHtml += `<div class="info-card snake"><div class="info-card-title">🐉 Dragon's Maw</div>
      Land here and the dragon drags you down to square <strong>${SNAKES[square]}</strong>.
      <br><em>Lysara may invoke Hex Reversal to climb instead.</em></div>`;
  }
  const snakeTailFrom = Object.entries(SNAKES).find(([,to]) => +to === square);
  if (snakeTailFrom) {
    specialHtml += `<div class="info-card snake"><div class="info-card-title">🐲 Dragon's Tail</div>
      Heroes dragged from <strong>${snakeTailFrom[0]}</strong> land here.</div>`;
  }

  // Event
  let eventHtml = '';
  const et = eventTypeOf(square);
  if (et) eventHtml = renderEventCard(et, square);

  body.innerHTML = `
    <h3>${zoneLabel}</h3>
    <div class="sq-num">Square ${square}</div>
    ${specialHtml}
    ${eventHtml}
    ${occHtml}
    ${!specialHtml && !eventHtml ? `<div class="info-card"><div class="info-card-title">— Quiet Path —</div>An ordinary square. No event, no peril.</div>` : ''}
  `;
  $('cell-shade').classList.add('show');
}

function renderEventCard(type, square) {
  if (type === 'fortune') {
    const ev = FORTUNE[square];
    return `<div class="info-card fortune">
      <div class="info-card-title">⚡ Fortune — ${ev.name}</div>
      <table>
        <tr><th>LCK 1–2</th><th>LCK 3</th><th>LCK 4–5</th></tr>
        <tr><td>${outcomeText(ev.low)}</td><td>${outcomeText(ev.mid)}</td><td>${outcomeText(ev.high)}</td></tr>
      </table>
    </div>`;
  }
  if (type === 'curse') {
    const ev = CURSE[square];
    return `<div class="info-card curse">
      <div class="info-card-title">💀 Curse — ${ev.name}</div>
      <table>
        <tr><th>LCK 1–2</th><th>LCK 3</th><th>LCK 4–5</th></tr>
        <tr><td>${outcomeText(ev.low)}</td><td>${outcomeText(ev.mid)}</td><td>${outcomeText(ev.high)}</td></tr>
      </table>
    </div>`;
  }
  if (type === 'gamble') {
    const ev = GAMBLE[square];
    return `<div class="info-card gamble">
      <div class="info-card-title">🎲 Gamble — ${ev.name}</div>
      <table>
        <tr><td><strong style="color:#4A7C2A">Safe</strong></td><td>${outcomeText(ev.safe)}</td></tr>
        <tr><td><strong style="color:#D4A017">Push ✓ (4–6)</strong></td><td>${outcomeText(ev.push_win)}</td></tr>
        <tr><td><strong style="color:#9B2626">Push ✗ (1–3)</strong></td><td>${outcomeText(ev.push_lose)}</td></tr>
      </table>
    </div>`;
  }
  if (type === 'duel') {
    const ev = DUEL[square];
    const pushRow = ev.push
      ? `<tr><td><strong style="color:#D4A017">Push W/L</strong></td><td>${outcomeText(ev.push.win)} / ${outcomeText(ev.push.lose)}</td></tr>`
      : '';
    return `<div class="info-card duel">
      <div class="info-card-title">⚔ Duel — ${ev.name}</div>
      <table>
        <tr><td><strong>Winner</strong></td><td>${outcomeText(ev.win)}</td></tr>
        <tr><td><strong>Loser</strong></td><td>${outcomeText(ev.lose)}</td></tr>
        ${pushRow}
      </table>
      <p style="font-size:0.82rem;margin-top:6px;color:var(--ink-soft);"><em>Both fighters roll D6 + STR.</em></p>
    </div>`;
  }
  return '';
}

// ═══════════════════════════════════════════════════════════════════════
// CHARACTER SHEET MODAL
// ═══════════════════════════════════════════════════════════════════════

function openCharacterSheet(idx) {
  const p = State.players[idx];
  const body = $('sheet-body');
  body.innerHTML = `
    <div class="sheet-head">
      <div class="sh-portrait"><img src="${p.sprite}" alt=""></div>
      <div>
        <div class="sh-name">${p.name}</div>
        <div class="sh-title">${p.title}</div>
        <div class="sh-pos">SQUARE ${p.pos}</div>
      </div>
    </div>

    <div class="sheet-stat-row">
      <span>STR <em style="opacity:0.6;font-style:normal;">Might</em></span>
      <div class="pips">${pipsHtml(p.str, 5, 'f r')}</div>
      <span class="s-num">${p.str}/5</span>
    </div>
    <div class="sheet-stat-row">
      <span>LCK <em style="opacity:0.6;font-style:normal;">Fortune</em></span>
      <div class="pips">${pipsHtml(p.lck, 5, 'f g')}</div>
      <span class="s-num">${p.lck}/5</span>
    </div>
    <div class="sheet-stat-row">
      <span>WIT <em style="opacity:0.6;font-style:normal;">Re-roll</em></span>
      <div class="pips">${pipsHtml(p.witLeft, p.wit, 'f')}</div>
      <span class="s-num">${p.witLeft}/${p.wit}</span>
    </div>

    <div class="ability-mini">
      <div class="label">${p.ability.icon} ${p.ability.name}</div>
      <div class="desc">${p.ability.desc}</div>
    </div>
    <div class="ability-status ${p.abilityUsed ? 'used' : 'ready'}">
      ${p.abilityUsed ? '◯ Ability Spent' : '● Ability Ready'}
    </div>

    ${State.skipFlags[idx] > 0 ? `<div class="info-card curse" style="margin-top:12px;"><div class="info-card-title">💀 Hexed</div>Skipping next ${State.skipFlags[idx]} turn(s).</div>` : ''}
    ${State.immuneFlags[idx] > 0 ? `<div class="info-card ladder" style="margin-top:12px;"><div class="info-card-title">🛡 Snake-Proof</div>Immune to next ${State.immuneFlags[idx]} snake(s).</div>` : ''}
  `;
  $('sheet-shade').classList.add('show');
}

// ═══════════════════════════════════════════════════════════════════════
// INFO / RULES MODAL
// ═══════════════════════════════════════════════════════════════════════

function setupInfoModal() {
  $('info-btn').addEventListener('click', () => openInfoTab('rules'));
  $('info-close').addEventListener('click', () => $('info-shade').classList.remove('show'));
  $('cell-close').addEventListener('click', () => $('cell-shade').classList.remove('show'));
  $('sheet-close').addEventListener('click', () => $('sheet-shade').classList.remove('show'));
  // click outside to close
  ['info-shade','cell-shade','sheet-shade'].forEach(id => {
    $(id).addEventListener('click', (e) => {
      if (e.target.id === id) $(id).classList.remove('show');
    });
  });
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => openInfoTab(btn.dataset.tab));
  });
}

function openInfoTab(tab) {
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
  const body = $('info-body');
  if (tab === 'rules') body.innerHTML = INFO_RULES_HTML;
  else if (tab === 'heroes') body.innerHTML = INFO_HEROES_HTML();
  else if (tab === 'events') body.innerHTML = INFO_EVENTS_HTML();
  else if (tab === 'board') body.innerHTML = INFO_BOARD_HTML;
  body.scrollTop = 0;
  $('info-shade').classList.add('show');
}

const INFO_RULES_HTML = `
  <h4>Objective</h4>
  <p>Be the first hero to reach (or exceed) square <strong>100</strong> — the Sky Temple's apex. Overshooting <em>bounces back</em>: if you'd land past 100, count the remainder backward from the goal.</p>

  <h4>Turn Flow</h4>
  <ol>
    <li><strong>Invoke ability</strong> (optional, pre-roll abilities only).</li>
    <li><strong>Roll the D6</strong>, then optionally spend a <strong>WIT charge</strong> to re-roll.</li>
    <li>Token advances step by step.</li>
    <li>Resolve landing — <em>ladder, dragon's maw, event, or quiet path</em>.</li>
    <li>Lysara may invoke Hex Reversal here, on a snake landing.</li>
    <li>End turn — pass the dice clockwise.</li>
  </ol>

  <h4>Ladders & Dragons</h4>
  <ul>
    <li><strong>Ladders (×8)</strong> — climb to a higher square instantly.</li>
    <li><strong>Dragons / Snakes (×8)</strong> — the dragon's maw drags you down. Lysara can reverse one per game.</li>
  </ul>

  <h4>WIT Re-roll Charges</h4>
  <p>WIT is your reservoir of re-rolls for the <em>entire game</em>. Spend one any time you've just rolled and dislike the result — works for normal rolls, gambles, duels, anything.</p>

  <h4>Push Your Luck</h4>
  <p>Gamble squares — and one or two Duel squares — let you accept a safe outcome or push. Push success (D6 = 4–6) yields a bigger reward; failure (1–3) is brutal. <strong>Decide before rolling.</strong></p>

  <h4>Abilities</h4>
  <p>Each hero has one signature ability usable <strong>once per game</strong>. Click a hero on the roster or in the active-player card to review their sheet at any time.</p>

  <h4>Victory</h4>
  <p>First hero to land exactly on (or bounce back to) 100 wins. The Sky Temple's blessing — and the dragon's hoard — is theirs.</p>
`;

function INFO_HEROES_HTML() {
  return `
    <h4>The Four Heroes</h4>
    <div class="info-hero-grid">
      ${CHARACTERS.map(c => `
        <div class="info-hero">
          <img src="${c.sprite}" alt="">
          <div>
            <div class="h-name">${c.name}</div>
            <div class="h-title">${c.title}</div>
            <div class="h-stat">STR <strong>${c.str}</strong> · LCK <strong>${c.lck}</strong> · WIT <strong>${c.wit}</strong></div>
          </div>
          <div class="h-abil"><strong>${c.ability.icon} ${c.ability.name}.</strong> ${c.ability.desc}</div>
        </div>
      `).join('')}
    </div>
    <h4>Reading the Stats</h4>
    <ul>
      <li><strong>STR (Might)</strong> — added to the D6 in Duel events.</li>
      <li><strong>LCK (Fortune)</strong> — bands the outcome of Fortune & Curse events into three tiers (1–2 / 3 / 4–5).</li>
      <li><strong>WIT (Wits)</strong> — number of re-rolls available across the whole game.</li>
    </ul>
  `;
}

function INFO_EVENTS_HTML() {
  const fortune = Object.entries(FORTUNE).map(([sq, ev]) => `
    <div class="evt-row fortune"><div class="e-sq">${sq}</div>
      <div><div class="e-name">⚡ ${ev.name}</div>
        <small>LCK low: ${outcomeText(ev.low)} · mid: ${outcomeText(ev.mid)} · high: ${outcomeText(ev.high)}</small>
      </div></div>`).join('');
  const curse = Object.entries(CURSE).map(([sq, ev]) => `
    <div class="evt-row curse"><div class="e-sq">${sq}</div>
      <div><div class="e-name">💀 ${ev.name}</div>
        <small>LCK low: ${outcomeText(ev.low)} · mid: ${outcomeText(ev.mid)} · high: ${outcomeText(ev.high)}</small>
      </div></div>`).join('');
  const gamble = Object.entries(GAMBLE).map(([sq, ev]) => `
    <div class="evt-row gamble"><div class="e-sq">${sq}</div>
      <div><div class="e-name">🎲 ${ev.name}</div>
        <small>Safe ${outcomeText(ev.safe)} · Push✓ ${outcomeText(ev.push_win)} · Push✗ ${outcomeText(ev.push_lose)}</small>
      </div></div>`).join('');
  const duel = Object.entries(DUEL).map(([sq, ev]) => `
    <div class="evt-row duel"><div class="e-sq">${sq}</div>
      <div><div class="e-name">⚔ ${ev.name}</div>
        <small>Win ${outcomeText(ev.win)} · Lose ${outcomeText(ev.lose)}${ev.push ? ` · <strong>Push:</strong> ${outcomeText(ev.push.win)} / ${outcomeText(ev.push.lose)}` : ''}</small>
      </div></div>`).join('');
  return `
    <h4>⚡ Fortune (×4)</h4>${fortune}
    <h4>💀 Curse (×4)</h4>${curse}
    <h4>🎲 Gamble — Push Your Luck (×4)</h4>${gamble}
    <h4>⚔ Duel (×4)</h4>${duel}
  `;
}

const INFO_BOARD_HTML = `
  <h4>The Four Realms</h4>
  <ul>
    <li><strong>Squares 1–25 — The Golden Plains</strong> — gentle slopes, generous fortunes.</li>
    <li><strong>26–50 — Whispering Forest</strong> — dense canopy hides curses & deception.</li>
    <li><strong>51–75 — Dragon's Peak</strong> — fierce duels and the lair of red dragons.</li>
    <li><strong>76–100 — Sky Temple</strong> — clouds of risk; the final ascent.</li>
  </ul>

  <h4>Ladders (×8)</h4>
  <p>${Object.entries(LADDERS).map(([f,t]) => `<strong>${f}→${t}</strong>`).join(' · ')}</p>

  <h4>Dragon Maws / Snakes (×8)</h4>
  <p>${Object.entries(SNAKES).map(([f,t]) => `<strong>${f}→${t}</strong>`).join(' · ')}</p>

  <h4>Tip</h4>
  <p>Tap any square on the board to view its full effect, who's standing there, and which heroes can intervene.</p>
`;
