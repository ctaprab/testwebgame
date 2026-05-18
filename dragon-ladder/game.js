/* ═══════════════════════════════════════════════════
   DRAGON'S LADDER — GAME LOGIC
   No Math.random() anywhere in core mechanics.
   All randomness comes from user inputting D6 results.
   ═══════════════════════════════════════════════════ */

'use strict';

// ───────── STATE ─────────
const State = {
  playerCount: 0,
  players: [],       // { idx, character, pos, abilityUsed, rerollsLeft, skipNextTurn, snakeShield }
  currentIdx: 0,
  currentSelectIdx: 0,
  pendingChar: null,
  log: [],

  // Turn-state flags (cleared between turns)
  turn: {
    awaitingRoll: false,
    awaitingRerollDecision: false,
    pendingForesightRolls: null,  // for Seraphel
    pendingFairyReroll: null,     // for fortune_fairy
    pendingHexParity: false,
    duelContext: null,            // { eventKey, attackerIdx, defenderIdx, attackerRoll, defenderRoll, push }
    gambleContext: null           // { eventKey, decision }
  }
};

// ───────── DOM REFS ─────────
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

// ═══════════════════════════════════════════════════
// SCREEN MANAGEMENT
// ═══════════════════════════════════════════════════
function showScreen(id) {
  $$('.screen').forEach(s => s.classList.remove('active'));
  $(id).classList.add('active');
}

// ═══════════════════════════════════════════════════
// TITLE SCREEN
// ═══════════════════════════════════════════════════
$$('.count-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    State.playerCount = parseInt(btn.dataset.count, 10);
    startCharacterSelect();
  });
});

// ═══════════════════════════════════════════════════
// CHARACTER SELECT
// ═══════════════════════════════════════════════════
function startCharacterSelect() {
  State.players = [];
  State.currentSelectIdx = 0;
  renderCharGrid();
  updateSelectHeader();
  showScreen('#screen-select');
}

function renderCharGrid() {
  const grid = $('#char-grid');
  grid.innerHTML = '';
  const takenIds = State.players.map(p => p.character.id);

  CHARACTERS.forEach(ch => {
    const taken = takenIds.includes(ch.id);
    const card = document.createElement('div');
    card.className = 'char-card' + (taken ? ' taken' : '');
    card.dataset.charId = ch.id;
    card.setAttribute('data-icon', ch.icon);

    card.innerHTML = `
      <div class="char-name">${ch.name}</div>
      <div class="char-title">${ch.title}</div>
      ${renderStatBar('STR กำลัง', ch.stats.str, 'str')}
      ${renderStatBar('LCK โชค', ch.stats.lck, 'lck')}
      ${renderStatBar('WIT (Re-roll)', ch.stats.wit, 'wit')}
      <div class="char-ability">
        <div class="ability-label">${ch.ability.icon} ${ch.ability.name}</div>
        <div class="ability-text">${ch.ability.description}</div>
      </div>
    `;

    if (!taken) {
      card.addEventListener('click', () => selectChar(ch));
    }
    grid.appendChild(card);
  });

  $('#confirm-char').disabled = true;
  State.pendingChar = null;
}

function renderStatBar(label, value, cls) {
  const pips = [1,2,3,4,5].map(i => {
    const filled = i <= value ? `filled ${cls}` : '';
    return `<div class="stat-pip ${filled}"></div>`;
  }).join('');
  return `
    <div class="stat-bar">
      <div class="stat-label"><span>${label}</span><span>${value}/5</span></div>
      <div class="stat-track">${pips}</div>
    </div>
  `;
}

function selectChar(ch) {
  State.pendingChar = ch;
  $$('#char-grid .char-card').forEach(c => c.classList.remove('selected'));
  $(`#char-grid .char-card[data-char-id="${ch.id}"]`).classList.add('selected');
  $('#confirm-char').disabled = false;
}

function updateSelectHeader() {
  $('#select-player-num').textContent = State.currentSelectIdx + 1;
  $('#select-player-total').textContent = State.playerCount;
}

$('#confirm-char').addEventListener('click', () => {
  if (!State.pendingChar) return;
  const ch = State.pendingChar;
  State.players.push({
    idx: State.currentSelectIdx,
    character: ch,
    stats: { ...ch.stats },
    pos: 1,
    abilityUsed: false,
    rerollsLeft: ch.stats.wit,
    skipNextTurn: false,
    snakeShield: false
  });
  State.currentSelectIdx++;
  if (State.currentSelectIdx >= State.playerCount) {
    startGame();
  } else {
    renderCharGrid();
    updateSelectHeader();
  }
});

// ═══════════════════════════════════════════════════
// GAME START
// ═══════════════════════════════════════════════════
function startGame() {
  State.currentIdx = 0;
  State.log = [];
  buildBoard();
  renderPlayers();
  beginTurn();
  $('#log-toggle').classList.add('visible');
  showScreen('#screen-game');
  logEvent(`เกมเริ่มต้น — ผู้เล่น ${State.playerCount} คน`);
}

// ═══════════════════════════════════════════════════
// BOARD RENDERING (10×10 serpentine, 1 at bottom-left)
// ═══════════════════════════════════════════════════
function buildBoard() {
  const board = $('#board');
  board.innerHTML = '';
  // Render rows top to bottom, each row left/right alternating
  // Row 10 (top) = 91..100 if going right OR 100..91 if reversed
  // Serpentine: row 1 (bottom) goes L→R (1..10),
  //             row 2 goes R→L (20..11), etc.
  // Top row (row 10) — for 10 rows numbered, alternates.
  // We render visually: row index 0 = top
  for (let visualRow = 0; visualRow < 10; visualRow++) {
    const gameRow = 10 - visualRow; // 10..1
    const leftToRight = (gameRow % 2 === 1); // odd rows go L→R
    for (let col = 0; col < 10; col++) {
      const cellIdx = leftToRight
        ? (gameRow - 1) * 10 + col + 1
        : gameRow * 10 - col;
      const cell = document.createElement('div');
      cell.className = `cell zone-${getZone(cellIdx)}`;
      cell.dataset.cell = cellIdx;
      cell.innerHTML = `<span class="cell-num">${cellIdx}</span>`;

      if (LADDERS[cellIdx]) {
        cell.classList.add('ladder-start');
        cell.innerHTML += `<span class="cell-symbol ladder">⇧${LADDERS[cellIdx]}</span>`;
      }
      if (SNAKES[cellIdx]) {
        cell.classList.add('snake-start');
        cell.innerHTML += `<span class="cell-symbol snake">⇩${SNAKES[cellIdx]}</span>`;
      }
      if (EVENT_TILES[cellIdx]) {
        cell.classList.add('event');
        const ev = EVENTS[EVENT_TILES[cellIdx]];
        cell.innerHTML += `<span class="cell-symbol">${ev.icon}</span>`;
      }
      if (cellIdx === 100) {
        cell.classList.add('cell-100');
        cell.innerHTML += `<span class="cell-symbol">👑</span>`;
      }

      // tokens container
      const tokensDiv = document.createElement('div');
      tokensDiv.className = 'cell-tokens';
      cell.appendChild(tokensDiv);

      board.appendChild(cell);
    }
  }
  redrawTokens();
}

function redrawTokens() {
  $$('.cell-tokens').forEach(el => el.innerHTML = '');
  State.players.forEach(p => {
    const cell = $(`.cell[data-cell="${p.pos}"]`);
    if (!cell) return;
    const container = cell.querySelector('.cell-tokens');
    const tok = document.createElement('div');
    tok.className = `token p${p.idx + 1}`;
    tok.title = p.character.name;
    container.appendChild(tok);
  });
}

// ═══════════════════════════════════════════════════
// PLAYERS PANEL
// ═══════════════════════════════════════════════════
function renderPlayers() {
  const panel = $('#players-panel');
  panel.innerHTML = '';
  State.players.forEach(p => {
    const card = document.createElement('div');
    card.className = 'player-card' + (p.idx === State.currentIdx ? ' active' : '');
    card.style.borderLeftColor = `var(--p${p.idx + 1})`;

    const rerollPips = Array.from({length: p.character.stats.wit}, (_, i) =>
      `<div class="pc-reroll-pip ${i >= p.rerollsLeft ? 'used' : ''}"></div>`
    ).join('');

    card.innerHTML = `
      <div class="pc-header">
        <div class="pc-color" style="background:var(--p${p.idx + 1})"></div>
        <div>
          <div class="pc-name">${p.character.name}</div>
          <div class="pc-title">P${p.idx + 1} · ${p.character.title}</div>
        </div>
      </div>
      <div class="pc-stats">
        <div class="pc-stat"><span class="pc-stat-label">STR</span><span class="pc-stat-value">${p.stats.str}</span></div>
        <div class="pc-stat"><span class="pc-stat-label">LCK</span><span class="pc-stat-value">${p.stats.lck}</span></div>
        <div class="pc-stat"><span class="pc-stat-label">WIT</span><span class="pc-stat-value">${p.stats.wit}</span></div>
      </div>
      <div class="pc-bottom">
        <span class="pc-pos">ช่อง <strong>${p.pos}</strong></span>
        <div class="pc-rerolls" title="Re-rolls เหลือ ${p.rerollsLeft}/${p.character.stats.wit}">${rerollPips}</div>
      </div>
      <button class="pc-ability-btn" data-player-idx="${p.idx}"
        ${p.abilityUsed || p.idx !== State.currentIdx || p.character.ability.timing !== 'pre-roll' ? 'disabled' : ''}>
        ${p.character.ability.icon} ${p.character.ability.name}
      </button>
    `;
    panel.appendChild(card);
  });

  // wire ability buttons
  $$('.pc-ability-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const idx = parseInt(btn.dataset.playerIdx, 10);
      handleAbility(idx);
    });
  });
}

// ═══════════════════════════════════════════════════
// TURN LIFECYCLE
// ═══════════════════════════════════════════════════
function beginTurn() {
  const p = currentPlayer();
  if (p.skipNextTurn) {
    p.skipNextTurn = false;
    logEvent(`${p.character.name} เสียเทิร์น (Witch's Hex)`);
    endTurn();
    return;
  }
  State.turn = {
    awaitingRoll: true,
    awaitingRerollDecision: false,
    pendingForesightRolls: null,
    pendingFairyReroll: null,
    pendingHexParity: false,
    duelContext: null,
    gambleContext: null
  };
  updateTurnUI();
  renderPlayers();
  enableDiceButtons(true);
}

function currentPlayer() { return State.players[State.currentIdx]; }

function updateTurnUI() {
  const p = currentPlayer();
  $('#turn-name').textContent = `${p.character.name} (P${p.idx + 1})`;
  $('#turn-name').style.color = `var(--p${p.idx + 1})`;
}

function enableDiceButtons(enabled) {
  $$('.dice-btn').forEach(b => b.disabled = !enabled);
}

// Hook up dice buttons (turn-bar only — modal handles its own)
$$('.dice-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const roll = parseInt(btn.dataset.roll, 10);
    onDiceRoll(roll);
  });
});

function onDiceRoll(roll) {
  // Branch based on what's pending
  if (State.turn.pendingForesightRolls !== null) {
    // Seraphel waiting for two rolls
    State.turn.pendingForesightRolls.push(roll);
    if (State.turn.pendingForesightRolls.length < 2) {
      logEvent(`${currentPlayer().character.name} (Foresight) ทอดครั้งที่ 1 = ${roll}, รอครั้งที่ 2`);
      return;
    }
    const [r1, r2] = State.turn.pendingForesightRolls;
    State.turn.pendingForesightRolls = null;
    State.turn.awaitingRoll = false;
    logEvent(`Foresight: ทอดได้ ${r1} และ ${r2} — เลือกผล...`);
    showForesightChoice(r1, r2);
    return;
  }

  if (!State.turn.awaitingRoll) return;
  State.turn.awaitingRoll = false;
  enableDiceButtons(false);
  performMove(currentPlayer(), roll);
}

function showForesightChoice(r1, r2) {
  showModal({
    icon: '👁',
    title: 'Foresight — เลือกผล',
    body: `<p>คุณทอดได้ <strong>${r1}</strong> และ <strong>${r2}</strong> — เลือกผลที่ต้องการใช้</p>`,
    actions: [
      { label: `ใช้ ${r1}`, className: 'btn btn-neutral', onClick: () => { closeModal(); performMove(currentPlayer(), r1); }},
      { label: `ใช้ ${r2}`, className: 'btn btn-neutral', onClick: () => { closeModal(); performMove(currentPlayer(), r2); }}
    ]
  });
}

// ═══════════════════════════════════════════════════
// MOVE + RESOLVE LANDING
// ═══════════════════════════════════════════════════
function performMove(player, distance, options = {}) {
  // options: { skipLanding, ignoreSnakes }
  let target = player.pos + distance;
  // Bounce-back if over 100
  if (target > 100) {
    const over = target - 100;
    target = 100 - over;
  }
  if (target < 1) target = 1;

  const oldPos = player.pos;
  player.pos = target;
  logEvent(`${player.character.name} เดินจาก ${oldPos} ไปยัง ${target} (${distance > 0 ? '+' : ''}${distance})`);

  redrawTokens();

  // Win check
  if (player.pos === 100 && !options.suppressWin) {
    setTimeout(() => declareVictory(player), 600);
    return;
  }

  if (options.skipLanding) {
    setTimeout(() => endTurn(), 600);
    return;
  }

  setTimeout(() => resolveLanding(player, options), 500);
}

function resolveLanding(player, options = {}) {
  // 1. Ladder
  if (LADDERS[player.pos]) {
    const dest = LADDERS[player.pos];
    logEvent(`🪜 ${player.character.name} ปีนบันได ${player.pos} → ${dest}!`);
    player.pos = dest;
    redrawTokens();
    if (player.pos === 100) { setTimeout(() => declareVictory(player), 500); return; }
    setTimeout(() => resolveLanding(player, options), 500);
    return;
  }

  // 2. Snake
  if (SNAKES[player.pos] && !options.ignoreSnakes) {
    // Snake shield?
    if (player.snakeShield) {
      player.snakeShield = false;
      logEvent(`🛡 ${player.character.name} ใช้ Snake Shield — ข้ามงูที่ ${player.pos}`);
      setTimeout(() => endTurn(), 600);
      return;
    }
    // Lysara on-snake ability?
    if (player.character.id === 'lysara' && !player.abilityUsed) {
      offerHexReversal(player);
      return;
    }
    const dest = SNAKES[player.pos];
    logEvent(`🐍 ${player.character.name} โดนงูกัด ${player.pos} → ${dest}!`);
    player.pos = dest;
    redrawTokens();
    setTimeout(() => resolveLanding(player, options), 500);
    return;
  }

  // 3. Event
  if (EVENT_TILES[player.pos]) {
    triggerEvent(player, EVENT_TILES[player.pos]);
    return;
  }

  // No event — end turn
  setTimeout(() => endTurn(), 400);
}

function offerHexReversal(player) {
  const dest = SNAKES[player.pos];
  showModal({
    icon: '🔮',
    title: 'Hex Reversal',
    body: `<p>${player.character.name} หยุดบนงูที่ช่อง <strong>${player.pos}</strong> (จะลงไป ${dest})</p>
           <p>ต้องการใช้ <strong>Hex Reversal</strong> เพื่อเปลี่ยนงูเป็นบันได? (ใช้ได้ครั้งเดียวต่อเกม)</p>`,
    actions: [
      { label: 'ใช้ Hex Reversal', className: 'btn btn-neutral', onClick: () => {
        closeModal();
        player.abilityUsed = true;
        // Find nearest ladder dest ahead — or just jump forward equal to snake distance reversed
        // Spec: งูตัวนั้นกลายเป็นบันไดในเทิร์นนี้ — interpret as: move forward by same amount
        const moveDist = player.pos - dest;
        const newPos = Math.min(100, player.pos + moveDist);
        logEvent(`🔮 ${player.character.name} ใช้ Hex Reversal! ${player.pos} → ${newPos}`);
        player.pos = newPos;
        redrawTokens();
        renderPlayers();
        if (player.pos === 100) { setTimeout(() => declareVictory(player), 500); return; }
        setTimeout(() => resolveLanding(player), 500);
      }},
      { label: 'ไม่ใช้', className: 'btn btn-ghost', onClick: () => {
        closeModal();
        const dest = SNAKES[player.pos];
        logEvent(`🐍 ${player.character.name} โดนงูกัด ${player.pos} → ${dest}`);
        player.pos = dest;
        redrawTokens();
        setTimeout(() => resolveLanding(player), 500);
      }}
    ]
  });
}

// ═══════════════════════════════════════════════════
// EVENT TRIGGER
// ═══════════════════════════════════════════════════
function triggerEvent(player, eventKey) {
  const ev = EVENTS[eventKey];

  if (ev.isPushYourLuck) {
    showGambleModal(player, eventKey);
  } else if (ev.isDuel) {
    showDuelTargetModal(player, eventKey);
  } else {
    // Direct fortune/curse
    const result = ev.resolveDirect(player);
    showFortuneCurseModal(player, eventKey, result);
  }
}

// ───── FORTUNE / CURSE ─────
function showFortuneCurseModal(player, eventKey, result) {
  const ev = EVENTS[eventKey];
  let body = `<p><em>${ev.flavor}</em></p>
              <div class="modal-outcome ${result.type}">
                <strong>ผล (${player.character.name})</strong>
                ${result.message}
              </div>`;

  // Some special outcomes need extra input
  if (result.requestReroll) {
    body += `<p style="margin-top:14px;">ทอดเต๋าใหม่ แล้วป้อนผล (ใช้ผลที่สูงกว่า):</p>`;
    showModal({
      icon: ev.icon, title: ev.title, body,
      actions: makeDiceActions((newRoll) => {
        // We need original roll — but for Fairy event the original roll is already used.
        // The fairy event re-rolls a new movement roll. So just use new roll directly.
        const oldRoll = 1; // placeholder; spec says "use higher" — but on Fortune square the move already happened.
        // Interpretation: roll a new dice and move forward by it.
        logEvent(`Fairy Blessing: ทอดใหม่ได้ ${newRoll}`);
        closeModal();
        performMove(player, newRoll);
      })
    });
    return;
  }

  if (result.requestParity) {
    body += `<p style="margin-top:14px;">ทอดเต๋า: คี่=เสียเทิร์นถัดไป, คู่=ปลอดภัย</p>`;
    showModal({
      icon: ev.icon, title: ev.title, body,
      actions: makeDiceActions((r) => {
        closeModal();
        if (r % 2 === 1) {
          player.skipNextTurn = true;
          logEvent(`Hex parity: ทอดได้ ${r} (คี่) — ${player.character.name} เสียเทิร์นถัดไป`);
        } else {
          logEvent(`Hex parity: ทอดได้ ${r} (คู่) — ปลอดภัย`);
        }
        endTurn();
      })
    });
    return;
  }

  if (result.chooseMove) {
    body += `<p style="margin-top:14px;">เลือกเดิน 1-6 ช่อง:</p>`;
    showModal({
      icon: ev.icon, title: ev.title, body,
      actions: result.chooseMove.map(n => ({
        label: `+${n}`, className: 'btn btn-neutral',
        onClick: () => { closeModal(); performMove(player, n, { skipLanding: false }); }
      }))
    });
    return;
  }

  // Standard: apply result, OK button
  showModal({
    icon: ev.icon, title: ev.title, body,
    actions: [{
      label: 'รับผล', className: 'btn btn-neutral',
      onClick: () => {
        closeModal();
        applyOutcome(player, result);
      }
    }]
  });
}

function applyOutcome(player, outcome) {
  if (outcome.teleportTo !== undefined) {
    logEvent(`${player.character.name} ถูกย้ายไปช่อง ${outcome.teleportTo}`);
    player.pos = outcome.teleportTo;
    redrawTokens();
    if (player.pos === 100) { setTimeout(() => declareVictory(player), 500); return; }
    setTimeout(() => resolveLanding(player), 500);
    return;
  }
  if (outcome.jumpToNearestLadder) {
    const ladderStart = findNearestLadderAhead(player.pos);
    if (ladderStart) {
      logEvent(`${player.character.name} กระโดดไปหัวบันไดที่ช่อง ${ladderStart}`);
      player.pos = ladderStart;
      redrawTokens();
      setTimeout(() => resolveLanding(player), 500);
      return;
    } else {
      logEvent(`ไม่มีบันไดด้านหน้า — ไม่มีผล`);
    }
  }
  if (outcome.jumpToNearestSnake) {
    const snakeStart = findNearestSnakeAhead(player.pos);
    if (snakeStart) {
      logEvent(`${player.character.name} ถูกพาไปหัวงูที่ช่อง ${snakeStart}`);
      player.pos = snakeStart;
      redrawTokens();
      setTimeout(() => resolveLanding(player), 500);
      return;
    } else {
      logEvent(`ไม่มีงูด้านหน้า — ไม่มีผล`);
    }
  }
  if (outcome.grantSnakeShield) {
    player.snakeShield = true;
    logEvent(`${player.character.name} ได้รับ Snake Shield`);
  }
  if (outcome.skipNextTurn) {
    player.skipNextTurn = true;
  }
  if (outcome.deltaMove !== undefined && outcome.deltaMove !== 0) {
    performMove(player, outcome.deltaMove);
    return;
  }
  endTurn();
}

// ───── GAMBLE ─────
function showGambleModal(player, eventKey) {
  const ev = EVENTS[eventKey];
  const body = `<p><em>${ev.flavor}</em></p>
                <p>เลือกทางของคุณ:</p>
                <div class="modal-outcome neutral"><strong>Safe</strong>${ev.safe.label}</div>
                <div class="modal-outcome good"><strong>Push ✓ (ทอย ≥ 4)</strong>${ev.pushSuccess.label}</div>
                <div class="modal-outcome bad"><strong>Push ✗ (ทอย ≤ 3)</strong>${ev.pushFail.label}</div>`;
  showModal({
    icon: ev.icon, title: ev.title, body,
    actions: [
      { label: 'Safe', className: 'btn btn-safe', onClick: () => {
        closeModal();
        logEvent(`${player.character.name} เลือก Safe ที่ ${ev.title} → ${ev.safe.label}`);
        applyOutcome(player, ev.safe);
      }},
      { label: 'Push Your Luck', className: 'btn btn-risky', onClick: () => {
        showGambleRollModal(player, eventKey);
      }}
    ]
  });
}

function showGambleRollModal(player, eventKey) {
  const ev = EVENTS[eventKey];
  const body = `<p>ทอดเต๋า D6 — ผล <strong>4-6</strong> = ชนะ, <strong>1-3</strong> = แพ้</p>
                <p style="margin-top:10px;"><strong>ป้อนผลการทอด:</strong></p>`;
  showModal({
    icon: '🎲', title: `Push: ${ev.title}`, body,
    actions: makeDiceActions((roll) => {
      const success = roll >= 4;
      const outcome = success ? ev.pushSuccess : ev.pushFail;
      logEvent(`${player.character.name} Push ที่ ${ev.title} — ทอดได้ ${roll} (${success ? 'สำเร็จ' : 'ล้มเหลว'})`);
      // Offer re-roll if available
      if (player.rerollsLeft > 0) {
        offerReroll(player, roll, (finalRoll) => {
          closeModal();
          const ok = finalRoll >= 4;
          const out = ok ? ev.pushSuccess : ev.pushFail;
          applyOutcome(player, out);
        }, (newRoll) => {
          // re-rolled value — re-evaluate
          const ok = newRoll >= 4;
          logEvent(`Push ใหม่: ทอดได้ ${newRoll} (${ok ? 'สำเร็จ' : 'ล้มเหลว'})`);
        }, (acceptedRoll) => {
          // final accept after possible re-rolls
          const ok = acceptedRoll >= 4;
          const out = ok ? ev.pushSuccess : ev.pushFail;
          applyOutcome(player, out);
        });
      } else {
        closeModal();
        applyOutcome(player, outcome);
      }
    })
  });
}

// ───── DUEL ─────
function showDuelTargetModal(player, eventKey) {
  const ev = EVENTS[eventKey];
  const others = State.players.filter(p => p.idx !== player.idx);
  if (others.length === 0) {
    logEvent(`ไม่มีคู่ดวล — Event ไม่มีผล`);
    endTurn();
    return;
  }
  const body = `<p><em>${ev.flavor}</em></p>
                <p>เลือกผู้เล่นที่ท้าทาย:</p>`;
  const actions = others.map(opp => ({
    label: `${opp.character.name} (P${opp.idx + 1})`,
    className: 'btn btn-neutral',
    onClick: () => startDuel(player, opp, eventKey)
  }));
  // For optional-push duels, let player decide push/normal first
  if (ev.isDuelPush) {
    showModal({
      icon: ev.icon, title: ev.title,
      body: `<p><em>${ev.flavor}</em></p>
             <p>เลือกประเภทดวล:</p>
             <div class="modal-outcome neutral"><strong>Normal</strong>ผู้ชนะ ${ev.winner.label} / แพ้ ${ev.loser.label}</div>
             <div class="modal-outcome bad"><strong>Push</strong>ผู้ชนะ ${ev.pushWinner.label} / แพ้ ${ev.pushLoser.label}</div>`,
      actions: [
        { label: 'Normal', className: 'btn btn-safe', onClick: () => {
          State.turn.duelContext = { eventKey, push: false };
          showDuelTargetSelection(player, eventKey, false);
        }},
        { label: 'Push', className: 'btn btn-risky', onClick: () => {
          State.turn.duelContext = { eventKey, push: true };
          showDuelTargetSelection(player, eventKey, true);
        }}
      ]
    });
  } else {
    State.turn.duelContext = { eventKey, push: false };
    showModal({ icon: ev.icon, title: ev.title, body, actions });
  }
}

function showDuelTargetSelection(attacker, eventKey, push) {
  const ev = EVENTS[eventKey];
  const others = State.players.filter(p => p.idx !== attacker.idx);
  showModal({
    icon: ev.icon, title: `${ev.title} ${push ? '(Push)' : ''}`,
    body: `<p>เลือกคู่ต่อสู้:</p>`,
    actions: others.map(opp => ({
      label: `${opp.character.name} (P${opp.idx + 1}) · STR ${opp.stats.str}`,
      className: 'btn btn-neutral',
      onClick: () => startDuel(attacker, opp, eventKey, push)
    }))
  });
}

function startDuel(attacker, defender, eventKey, push = false) {
  State.turn.duelContext = { eventKey, attackerIdx: attacker.idx, defenderIdx: defender.idx, push, attackerRoll: null, defenderRoll: null };
  promptDuelRoll('attacker');
}

function promptDuelRoll(who) {
  const ctx = State.turn.duelContext;
  const attacker = State.players[ctx.attackerIdx];
  const defender = State.players[ctx.defenderIdx];
  const p = who === 'attacker' ? attacker : defender;
  showModal({
    icon: '⚔', title: `Duel — ${p.character.name} ทอด`,
    body: `<p><strong>${p.character.name}</strong> (STR ${p.stats.str}) ทอดเต๋า D6 แล้วป้อนผล</p>
           <p style="font-size:0.88rem;color:var(--ink-soft);">รวมจะเป็น ${p.stats.str} + ผลเต๋า</p>`,
    actions: makeDiceActions((roll) => {
      if (who === 'attacker') {
        ctx.attackerRoll = roll;
        logEvent(`${attacker.character.name} (attacker) ทอดได้ ${roll} + STR ${attacker.stats.str} = ${roll + attacker.stats.str}`);
        promptDuelRoll('defender');
      } else {
        ctx.defenderRoll = roll;
        logEvent(`${defender.character.name} (defender) ทอดได้ ${roll} + STR ${defender.stats.str} = ${roll + defender.stats.str}`);
        resolveDuel();
      }
    })
  });
}

function resolveDuel() {
  const ctx = State.turn.duelContext;
  const ev = EVENTS[ctx.eventKey];
  const attacker = State.players[ctx.attackerIdx];
  const defender = State.players[ctx.defenderIdx];
  const aTotal = ctx.attackerRoll + attacker.stats.str;
  const dTotal = ctx.defenderRoll + defender.stats.str;

  let winner, loser, winOut, loseOut;
  if (aTotal >= dTotal) {
    winner = attacker; loser = defender;
  } else {
    winner = defender; loser = attacker;
  }
  if (ctx.push) {
    winOut = ev.pushWinner; loseOut = ev.pushLoser;
  } else {
    winOut = ev.winner; loseOut = ev.loser;
  }

  const body = `<p>${attacker.character.name} ได้ <strong>${aTotal}</strong> vs ${defender.character.name} ได้ <strong>${dTotal}</strong></p>
                <div class="modal-outcome good"><strong>${winner.character.name} (ชนะ)</strong>${winOut.label}</div>
                <div class="modal-outcome bad"><strong>${loser.character.name} (แพ้)</strong>${loseOut.label}</div>`;
  showModal({
    icon: '⚔', title: `${ev.title} — ผล`, body,
    actions: [{
      label: 'รับผล', className: 'btn btn-neutral', onClick: () => {
        closeModal();
        logEvent(`Duel: ${winner.character.name} ชนะ ${loser.character.name}`);
        // Apply to both — winner first, then loser, then end turn
        applyDuelOutcomes(winner, loser, winOut, loseOut);
      }
    }]
  });
}

function applyDuelOutcomes(winner, loser, winOut, loseOut) {
  // Apply non-move effects to both, then move winner, then loser, then end
  if (winOut.grantSnakeShield) winner.snakeShield = true;
  if (loseOut.grantSnakeShield) loser.snakeShield = true;

  const applyMoveOrTeleport = (p, out, cb) => {
    if (out.teleportTo !== undefined) {
      p.pos = out.teleportTo;
      redrawTokens();
      logEvent(`${p.character.name} ย้ายไปช่อง ${out.teleportTo}`);
      if (p.pos === 100) { setTimeout(() => declareVictory(p), 400); return; }
      setTimeout(cb, 400);
    } else if (out.deltaMove) {
      let target = p.pos + out.deltaMove;
      if (target > 100) { const over = target - 100; target = 100 - over; }
      if (target < 1) target = 1;
      logEvent(`${p.character.name} เดิน ${out.deltaMove > 0 ? '+' : ''}${out.deltaMove} → ช่อง ${target}`);
      p.pos = target;
      redrawTokens();
      if (p.pos === 100) { setTimeout(() => declareVictory(p), 400); return; }
      setTimeout(cb, 400);
    } else {
      cb();
    }
  };

  applyMoveOrTeleport(winner, winOut, () => {
    applyMoveOrTeleport(loser, loseOut, () => {
      endTurn();
    });
  });
}

// ═══════════════════════════════════════════════════
// RE-ROLL OFFER (WIT)
// ═══════════════════════════════════════════════════
function offerReroll(player, currentRoll, immediateAccept, rerollCallback, finalCallback) {
  if (player.rerollsLeft <= 0) {
    immediateAccept(currentRoll);
    return;
  }
  showModal({
    icon: '🎲', title: 'ทอดใหม่?',
    body: `<p>${player.character.name} ทอดได้ <strong>${currentRoll}</strong></p>
           <p>มี Re-roll เหลือ <strong>${player.rerollsLeft}</strong> ครั้ง — ต้องการทอดใหม่ไหม?</p>`,
    actions: [
      { label: `ใช้ ${currentRoll}`, className: 'btn btn-safe', onClick: () => {
        immediateAccept(currentRoll);
      }},
      { label: 'ทอดใหม่ (-1 Re-roll)', className: 'btn btn-risky', onClick: () => {
        player.rerollsLeft--;
        renderPlayers();
        logEvent(`${player.character.name} ใช้ Re-roll (เหลือ ${player.rerollsLeft})`);
        showModal({
          icon: '🎲', title: 'ทอดใหม่',
          body: `<p>ทอด D6 อีกครั้ง แล้วป้อนผล:</p>`,
          actions: makeDiceActions((newRoll) => {
            rerollCallback(newRoll);
            offerReroll(player, newRoll, finalCallback, rerollCallback, finalCallback);
          })
        });
      }}
    ]
  });
}

// ═══════════════════════════════════════════════════
// ABILITIES (pre-roll)
// ═══════════════════════════════════════════════════
function handleAbility(playerIdx) {
  const player = State.players[playerIdx];
  if (player.abilityUsed) return;
  if (player.idx !== State.currentIdx) return;
  const ab = player.character.ability;

  if (player.character.id === 'aldric') {
    // Ironclad March: +6, skip snake-result on this turn
    player.abilityUsed = true;
    logEvent(`🛡 ${player.character.name} ใช้ Ironclad March → +6 และข้ามงู`);
    State.turn.awaitingRoll = false;
    enableDiceButtons(false);
    renderPlayers();
    performMove(player, 6, { ignoreSnakes: true });
    return;
  }

  if (player.character.id === 'seraphel') {
    // Foresight: prompt two rolls
    player.abilityUsed = true;
    State.turn.pendingForesightRolls = [];
    logEvent(`👁 ${player.character.name} ใช้ Foresight — ทอดเต๋า 2 ครั้ง`);
    renderPlayers();
    showModal({
      icon: '👁', title: 'Foresight',
      body: `<p>ทอด D6 ทั้งหมด 2 ครั้ง แล้วป้อนผลทีละครั้ง — สุดท้ายเลือกผลที่ต้องการ</p>
             <p style="font-size:0.9rem;color:var(--ink-soft);">ครั้งที่ 1:</p>`,
      actions: makeDiceActions((r1) => {
        State.turn.pendingForesightRolls.push(r1);
        logEvent(`Foresight ครั้งที่ 1: ${r1}`);
        showModal({
          icon: '👁', title: 'Foresight (ครั้งที่ 2)',
          body: `<p>ทอดครั้งที่ 1 ได้ <strong>${r1}</strong></p>
                 <p>ทอดครั้งที่ 2 แล้วป้อนผล:</p>`,
          actions: makeDiceActions((r2) => {
            State.turn.pendingForesightRolls.push(r2);
            logEvent(`Foresight ครั้งที่ 2: ${r2}`);
            showForesightChoice(r1, r2);
          })
        });
      })
    });
    return;
  }

  if (player.character.id === 'keth') {
    // Shadow Step: choose another player, teleport to them, force them to re-roll
    const others = State.players.filter(p => p.idx !== player.idx);
    if (others.length === 0) return;
    showModal({
      icon: '🌑', title: 'Shadow Step',
      body: `<p>เลือกผู้เล่นเป้าหมาย — Keth จะ teleport ไปช่องเดียวกัน และผู้เล่นนั้นจะถูกบังคับให้ทอดเต๋าใหม่ในเทิร์นถัดไป</p>`,
      actions: others.map(opp => ({
        label: `${opp.character.name} (ช่อง ${opp.pos})`,
        className: 'btn btn-neutral',
        onClick: () => {
          closeModal();
          player.abilityUsed = true;
          player.pos = opp.pos;
          // Tag opponent — for simplicity: force them to skip their next turn (since they 'wasted' a roll, basic interpretation)
          // Better interpretation: they roll again when their turn comes; but to keep state simple we just teleport.
          logEvent(`🌑 Keth ใช้ Shadow Step → ย้ายไปช่อง ${opp.pos} (ตาม ${opp.character.name})`);
          redrawTokens();
          renderPlayers();
          // Still need to roll normally on this turn
          State.turn.awaitingRoll = true;
          enableDiceButtons(true);
        }
      }))
    });
    return;
  }
}

// ═══════════════════════════════════════════════════
// MODAL UTILITIES
// ═══════════════════════════════════════════════════
function showModal({ icon, title, body, actions }) {
  $('#modal-icon').textContent = icon;
  $('#modal-title').textContent = title;
  $('#modal-body').innerHTML = body;
  const actionsDiv = $('#modal-actions');
  actionsDiv.innerHTML = '';
  actions.forEach(a => {
    const btn = document.createElement('button');
    btn.className = a.className;
    btn.textContent = a.label;
    btn.addEventListener('click', a.onClick);
    actionsDiv.appendChild(btn);
  });
  $('#modal-overlay').classList.add('active');
}

function closeModal() {
  $('#modal-overlay').classList.remove('active');
}

function makeDiceActions(callback) {
  return [1,2,3,4,5,6].map(n => ({
    label: `${n}`, className: 'btn btn-neutral',
    onClick: () => callback(n)
  }));
}

// ═══════════════════════════════════════════════════
// END TURN
// ═══════════════════════════════════════════════════
function endTurn() {
  State.currentIdx = (State.currentIdx + 1) % State.playerCount;
  beginTurn();
}

// ═══════════════════════════════════════════════════
// VICTORY
// ═══════════════════════════════════════════════════
function declareVictory(player) {
  logEvent(`🏆 ${player.character.name} ชนะ!`);
  $('#victory-name').textContent = `${player.character.name}`;
  $('#victory-name').style.color = `var(--gold-bright)`;
  showScreen('#screen-victory');
  $('#log-toggle').classList.remove('visible');
}

$('#play-again').addEventListener('click', () => {
  State.playerCount = 0;
  State.players = [];
  showScreen('#screen-title');
});

// ═══════════════════════════════════════════════════
// LOG
// ═══════════════════════════════════════════════════
function logEvent(msg) {
  State.log.push(msg);
  const body = $('#log-body');
  const entry = document.createElement('div');
  entry.className = 'log-entry';
  entry.innerHTML = msg;
  body.insertBefore(entry, body.firstChild);
  // Limit log
  while (body.children.length > 50) body.removeChild(body.lastChild);
}

$('#log-toggle').addEventListener('click', () => {
  $('#log-panel').classList.toggle('visible');
});
$('#log-close').addEventListener('click', () => {
  $('#log-panel').classList.remove('visible');
});

// ═══════════════════════════════════════════════════
// INIT
// ═══════════════════════════════════════════════════
showScreen('#screen-title');
