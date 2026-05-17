# 🐉 Dragon's Ladder — Realm of Fortune

A fantasy-themed snakes-and-ladders board game playable in the browser using a real D6 die.

> **Built with HTML + Vanilla JavaScript + CSS.** No frameworks, no `Math.random()` in core mechanics — every dice roll comes from a real die that you input on the screen. Playable as both a web app and a physical board game from the same rule set.

---

## ✨ Features

- 🎴 **4 unique characters** with 3 stats (STR / LCK / WIT) and a one-time special ability
- 🗺 **10×10 board** divided into 4 themed zones (Golden Plains, Whispering Forest, Dragon's Peak, Sky Temple)
- 🪜 **8 ladders & 8 snakes** for the classic experience
- ⚡ **16 event tiles** in 4 categories: Fortune, Curse, Gamble, Duel
- 🎰 **Push-Your-Luck mechanic** on Gamble events and select Duels
- 🎲 **WIT = Re-roll charges** — characters with higher WIT can re-roll any unfavorable D6 result
- 👥 **2–4 players** supported
- 📱 **Responsive** for desktop, tablet, and mobile

---

## 🚀 Quick Start

This is a static site — no build step needed.

### Option A: Just open it
```bash
# clone or download, then open index.html in any modern browser
open index.html
```

### Option B: Local server (recommended)
```bash
# Python 3
python3 -m http.server 8000

# Node.js
npx serve

# Then open http://localhost:8000
```

---

## 🎮 How to Play

1. **Choose player count** (2-4)
2. **Each player picks a character** (Aldric, Lysara, Keth, or Seraphel)
3. **Roll a real D6** and input the result by tapping 1-6 on screen
4. **Resolve the landing tile** — ladder, snake, event, or empty
5. **First to space 100 wins** (bounce-back rule applies if you overshoot)

### Characters

| Character | Title | STR | LCK | WIT | Ability |
|-----------|-------|-----|-----|-----|---------|
| **Aldric** | The Iron Knight | 5 | 2 | 2 | Ironclad March: +6 squares, ignore snakes this turn |
| **Lysara** | The Moon Witch | 1 | 5 | 3 | Hex Reversal: turn a snake into a ladder once |
| **Keth** | The Shadow Rogue | 3 | 3 | 5 | Shadow Step: teleport to another player |
| **Seraphel** | The Dawn Oracle | 2 | 4 | 4 | Foresight: roll twice, pick either result |

### Stats Explained

- **STR** — Used in Duel events. Adds to your D6 in Duels.
- **LCK** — Determines outcomes on Fortune & Curse events.
- **WIT** — Number of times you can re-roll the D6 for the whole game. (e.g. Keth has 5 re-rolls; Aldric has 2.)

---

## 🛠 Tech Stack

- **HTML5** — semantic structure
- **Vanilla JavaScript** — no frameworks, ES6+
- **CSS3** — custom properties, grid, flexbox, animations
- **Google Fonts** — Cinzel Decorative, Cinzel, Crimson Pro

### Project Structure

```
dragon-ladder/
├── index.html      # Game shell — title, select, board, modal, victory
├── styles.css      # Fantasy warm theme — amber, parchment, deep red
├── data.js         # Static game data (characters, board, events) — no random
├── game.js         # Game logic — state, turn flow, event resolution
├── README.md       # This file
└── LICENSE         # MIT
```

---

## 🎨 Design Philosophy

- **Physical Parity** — Every rule works on a real board with paper, tokens, and a single die. The web version is a digital twin, not a digital-only experience.
- **Deterministic Events** — All random outcomes come from the physical D6 you input. The web app never rolls for you.
- **Meaningful Choices** — Push Your Luck events have a clear upside and downside. WIT lets you take calculated risks.

For full design details, see the [Game Design Document](GDD_DragonLadder.html) (if included).

---

## 📜 License

MIT — see [LICENSE](LICENSE) file.

---

## 🤝 Contributing

This is a personal project, but feel free to fork and modify. Pull requests for bug fixes and accessibility improvements are welcome.

---

*Roll high, traveler.* 🎲
