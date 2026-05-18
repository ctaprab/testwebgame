/* ═══════════════════════════════════════════════════
   DRAGON'S LADDER — STATIC GAME DATA
   No randomness here. All event resolution is
   pure deterministic lookup based on dice + stats.
   ═══════════════════════════════════════════════════ */

const CHARACTERS = [
  {
    id: 'aldric',
    name: 'Aldric',
    title: 'The Iron Knight',
    icon: '⚔',
    stats: { str: 5, lck: 2, wit: 2 },
    ability: {
      name: 'Ironclad March',
      icon: '🛡',
      description: 'ก่อนทอดเต๋า: เคลื่อนที่ +6 ช่อง โดยไม่ต้องทอด และข้ามผลของงูในเทิร์นนี้',
      timing: 'pre-roll'
    }
  },
  {
    id: 'lysara',
    name: 'Lysara',
    title: 'The Moon Witch',
    icon: '🌙',
    stats: { str: 1, lck: 5, wit: 3 },
    ability: {
      name: 'Hex Reversal',
      icon: '🔮',
      description: 'หลังหยุดบนงู: เปลี่ยนงูตัวนั้นเป็นบันได ในเทิร์นนี้',
      timing: 'on-snake'
    }
  },
  {
    id: 'keth',
    name: 'Keth',
    title: 'The Shadow Rogue',
    icon: '🗡',
    stats: { str: 3, lck: 3, wit: 5 },
    ability: {
      name: 'Shadow Step',
      icon: '🌑',
      description: 'ก่อนทอดเต๋า: เลือกผู้เล่นคนหนึ่ง — teleport ไปช่องเดียวกับเขา และบังคับให้เขาทอดเต๋าใหม่',
      timing: 'pre-roll'
    }
  },
  {
    id: 'seraphel',
    name: 'Seraphel',
    title: 'The Dawn Oracle',
    icon: '☀',
    stats: { str: 2, lck: 4, wit: 4 },
    ability: {
      name: 'Foresight',
      icon: '👁',
      description: 'ก่อนทอดเต๋า: ทอด 2 ครั้ง (ป้อนทั้งสองผล) แล้วเลือกผลใดก็ได้',
      timing: 'pre-roll'
    }
  }
];

/* Ladders: { from: to } — all forward */
const LADDERS = {
  4: 14, 9: 31, 20: 38, 28: 56,
  40: 59, 51: 67, 63: 81, 71: 91
};

/* Snakes: { from: to } — all backward */
const SNAKES = {
  17: 7, 35: 15, 46: 25, 54: 34,
  62: 43, 74: 53, 87: 24, 95: 73
};

/* Event squares + which event type */
const EVENT_TILES = {
  // Fortune ⚡
  12: 'fortune_goldenrain',
  33: 'fortune_fairy',
  58: 'fortune_dragoneye',
  82: 'fortune_star',
  // Curse 💀
  19: 'curse_mist',
  44: 'curse_hex',
  69: 'curse_ruins',
  88: 'curse_void',
  // Gamble 🎲
  22: 'gamble_wheel',
  47: 'gamble_dragon',
  65: 'gamble_roulette',
  79: 'gamble_sky',
  // Duel ⚔
  15: 'duel_crossroad',
  38: 'duel_arena',
  61: 'duel_tribunal',
  84: 'duel_throne'
};

/* Zone mapping (1-25, 26-50, 51-75, 76-100) */
function getZone(cell) {
  if (cell <= 25) return 1;
  if (cell <= 50) return 2;
  if (cell <= 75) return 3;
  return 4;
}

/* Pure-data event definitions.
   Each event has `resolve(player, ctx)` → returns
   { type, message, outcome, choices? } — NO random!
   When event needs dice (Gamble/Duel/CurseHex),
   it returns 'choices' or 'rollRequest'.
*/
const EVENTS = {

  // ═══════════════ FORTUNE ═══════════════
  fortune_goldenrain: {
    icon: '⚡', title: 'Golden Rain',
    flavor: 'ฝนทองหลั่งลงจากฟ้า — โชคยิ่งสูง พระพรยิ่งหนา',
    resolveDirect: (p) => {
      const lck = p.stats.lck;
      let move = lck <= 2 ? 1 : lck === 3 ? 3 : 5;
      return {
        type: 'good',
        message: `LCK ${lck} → เดิน +${move} ช่อง`,
        deltaMove: move
      };
    }
  },
  fortune_fairy: {
    icon: '⚡', title: 'Fairy Blessing',
    flavor: 'นางฟ้าประทานคำอวยพร',
    resolveDirect: (p) => {
      const lck = p.stats.lck;
      if (lck <= 2) return { type: 'neutral', message: `LCK ${lck} → ไม่มีผล`, deltaMove: 0 };
      if (lck === 3) return { type: 'good', message: `LCK 3 → ทอดเต๋าใหม่ ใช้ผลที่สูงกว่า`, requestReroll: 'higher' };
      return { type: 'good', message: `LCK ${lck} → เดิน +4 และข้ามงูครั้งถัดไป`, deltaMove: 4, grantSnakeShield: true };
    }
  },
  fortune_dragoneye: {
    icon: '⚡', title: "Dragon's Eye",
    flavor: 'ตามังกรเฝ้ามองคุณ',
    resolveDirect: (p) => {
      const lck = p.stats.lck;
      if (lck <= 2) return { type: 'bad', message: `LCK ${lck} → ถอย -2`, deltaMove: -2 };
      if (lck === 3) return { type: 'good', message: `LCK 3 → เดิน +3`, deltaMove: 3 };
      return { type: 'good', message: `LCK ${lck} → กระโดดบันไดใกล้สุด`, jumpToNearestLadder: true };
    }
  },
  fortune_star: {
    icon: '⚡', title: 'Star Alignment',
    flavor: 'ดวงดาวเรียงตัวเป็นใจคุณ',
    resolveDirect: (p) => {
      const lck = p.stats.lck;
      if (lck <= 2) return { type: 'good', message: `LCK ${lck} → เดิน +2`, deltaMove: 2 };
      if (lck === 3) return { type: 'good', message: `LCK 3 → เดิน +5`, deltaMove: 5 };
      return { type: 'good', message: `LCK ${lck} → เลือกเดิน 1-6 ช่อง`, chooseMove: [1,2,3,4,5,6] };
    }
  },

  // ═══════════════ CURSE ═══════════════
  curse_mist: {
    icon: '💀', title: 'Black Mist',
    flavor: 'หมอกดำพันธนาการก้าวเดิน',
    resolveDirect: (p) => {
      const lck = p.stats.lck;
      const move = lck <= 2 ? -5 : lck === 3 ? -3 : -1;
      return { type: 'bad', message: `LCK ${lck} → ถอย ${move}`, deltaMove: move };
    }
  },
  curse_hex: {
    icon: '💀', title: "Witch's Hex",
    flavor: 'คำสาปแม่มดเรียกหา',
    resolveDirect: (p) => {
      const lck = p.stats.lck;
      if (lck <= 2) return { type: 'bad', message: `LCK ${lck} → เสีย 1 เทิร์น`, skipNextTurn: true };
      if (lck === 3) return { type: 'neutral', message: `LCK 3 → ทอดเต๋า: คี่=เสียเทิร์น, คู่=ไม่มีผล`, requestParity: true };
      return { type: 'good', message: `LCK ${lck} → ไม่มีผล`, deltaMove: 0 };
    }
  },
  curse_ruins: {
    icon: '💀', title: 'Falling Ruins',
    flavor: 'ซากปรักหักพังถล่มลง',
    resolveDirect: (p) => {
      const lck = p.stats.lck;
      if (lck <= 2) return { type: 'bad', message: `LCK ${lck} → ถอยไปช่อง 51`, teleportTo: 51 };
      if (lck === 3) return { type: 'bad', message: `LCK 3 → ถอย -6`, deltaMove: -6 };
      return { type: 'bad', message: `LCK ${lck} → ถอย -2`, deltaMove: -2 };
    }
  },
  curse_void: {
    icon: '💀', title: 'Void Rift',
    flavor: 'รอยแยกแห่งความว่างเปล่า',
    resolveDirect: (p) => {
      const lck = p.stats.lck;
      if (lck <= 2) return { type: 'bad', message: `LCK ${lck} → ถอยไปช่อง 50`, teleportTo: 50 };
      if (lck === 3) return { type: 'bad', message: `LCK 3 → ถอย -8`, deltaMove: -8 };
      return { type: 'bad', message: `LCK ${lck} → ถอย -3`, deltaMove: -3 };
    }
  },

  // ═══════════════ GAMBLE (Push Your Luck) ═══════════════
  gamble_wheel: {
    icon: '🎲', title: "Fortune's Wheel",
    flavor: 'วงล้อแห่งโชคหมุน — กล้าเสี่ยงไหม?',
    isPushYourLuck: true,
    safe: { deltaMove: 3, label: 'เดิน +3' },
    pushSuccess: { deltaMove: 8, label: 'เดิน +8' },
    pushFail: { deltaMove: -5, label: 'ถอย -5' }
  },
  gamble_dragon: {
    icon: '🎲', title: "Dragon's Gambit",
    flavor: 'มังกรท้าทาย — เดิมพันเหรียญสุดท้าย',
    isPushYourLuck: true,
    safe: { deltaMove: 4, label: 'เดิน +4' },
    pushSuccess: { jumpToNearestLadder: true, label: 'กระโดดบันไดถัดไป' },
    pushFail: { jumpToNearestSnake: true, label: 'ถอยไปหาง... งูถัดไป' }
  },
  gamble_roulette: {
    icon: '🎲', title: 'Ancient Roulette',
    flavor: 'เลเซอร์โบราณหมุนรอบช้า ๆ',
    isPushYourLuck: true,
    safe: { deltaMove: 3, label: 'เดิน +3' },
    pushSuccess: { deltaMove: 10, label: 'เดิน +10' },
    pushFail: { deltaMove: -7, label: 'ถอย -7' }
  },
  gamble_sky: {
    icon: '🎲', title: 'Sky Dice',
    flavor: 'ลูกเต๋าฟ้าทอดเสียงดังก้องเมฆ',
    isPushYourLuck: true,
    safe: { deltaMove: 5, label: 'เดิน +5' },
    pushSuccess: { deltaMove: 15, label: 'เดิน +15 (ใกล้ Finish)' },
    pushFail: { teleportTo: 60, label: 'ถอยไปช่อง 60' }
  },

  // ═══════════════ DUEL ═══════════════
  duel_crossroad: {
    icon: '⚔', title: 'Crossroads Clash',
    flavor: 'ทางแยกแห่งดวงดาบ',
    isDuel: true,
    winner: { deltaMove: 4, label: 'เดิน +4' },
    loser: { deltaMove: -2, label: 'ถอย -2' }
  },
  duel_arena: {
    icon: '⚔', title: 'Arena of Fate',
    flavor: 'สังเวียนแห่งชะตา — กล้าเดิมพันสองเท่าไหม?',
    isDuel: true,
    isDuelPush: true,
    winner: { deltaMove: 6, label: 'เดิน +6' },
    loser: { deltaMove: -4, label: 'ถอย -4' },
    pushWinner: { deltaMove: 12, label: 'เดิน +12' },
    pushLoser: { deltaMove: -8, label: 'ถอย -8' }
  },
  duel_tribunal: {
    icon: '⚔', title: "Dragon's Tribunal",
    flavor: 'ศาลแห่งมังกรพิพากษา',
    isDuel: true,
    winner: { deltaMove: 5, grantSnakeShield: true, label: 'เดิน +5 + ข้ามงู 1 ครั้ง' },
    loser: { deltaMove: -5, label: 'ถอย -5' }
  },
  duel_throne: {
    icon: '⚔', title: 'Sky Throne Duel',
    flavor: 'ดวลบนบัลลังก์เมฆา — รางวัลใหญ่ ความเสี่ยงใหญ่',
    isDuel: true,
    isDuelPush: true,
    winner: { deltaMove: 8, label: 'เดิน +8' },
    loser: { teleportTo: 70, label: 'ถอยไปช่อง 70' },
    pushWinner: { teleportTo: 95, label: 'พุ่งไปช่อง 95' },
    pushLoser: { teleportTo: 55, label: 'ตกไปช่อง 55' }
  }
};

/* Helper: find nearest ladder/snake start ahead/behind */
function findNearestLadderAhead(pos) {
  const keys = Object.keys(LADDERS).map(Number).filter(k => k > pos).sort((a,b)=>a-b);
  return keys[0] || null;
}
function findNearestSnakeAhead(pos) {
  const keys = Object.keys(SNAKES).map(Number).filter(k => k > pos).sort((a,b)=>a-b);
  return keys[0] || null;
}
