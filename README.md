# Boxed Up: Spicy Special – Computing 2 Coursework Submission
**CID**: [02556701]

## The Game
**Boxed Up: Spicy Special** is a turn-based, board-based game for two
players — play a friend, or take on a **computer chef**.

### Deluxe extras (over the base Boxed Up)
* **Computer opponents** (`web-app/Chef.js`, a separate pure module
  that only uses the public `BoxedUp` API): pick under Chef 2's name.
  * *Apprentice* — packs the smallest piece in the first free spot.
  * *Cook* — grabs the largest piece that fits.
  * *Head Chef* — fights for compartment bonuses, simulating every
    legal ply and maximising its score lead.
* **Difficulty**: choose how much garnish crowds the next box
  (Calm 3 / Classic 5 / Crowded 8) in ⚙ settings — more garnish
  means tighter packing and earlier sealing.
* **Transitions**: compartments deal in for each new box, placements
  cascade in, changed stats bump, the active chef's stall glows, and
  dialogs drift in. All motion respects the "Reduce animations"
  setting and `prefers-reduced-motion`.

Two chefs share one box: a 9×9 grid divided into nine 3×3
**compartments**. A few cells already hold 🍥 **garnish**, scattered
differently every game — garnish may never be covered.

On each turn, the current chef picks a food piece from the menu,
rotates it if they like, and packs it anywhere in the box where it
covers only empty cells.

**Sealing compartments:** when the last empty cell of a compartment is
covered, it is sealed. The chef with more food inside it owns it and
earns a **+5 point bonus** (a tie means nobody gets the bonus —
garnish counts to neither chef).

When the chef to move cannot fit **any** piece, in **any** orientation,
**anywhere** in the box, the box is sealed and the game ends —
since the 1×1 umeboshi fits any empty cell, that means the game
ends when the box is completely full.
**Score = cells covered + 5 per owned compartment.**
The higher score wins; equal scores are a draw.
So a chef can win the box while covering fewer cells —
fight for the compartments!

### The Menu
| Piece | Shape | Cells |
|---|---|---|
| 🍑 Umeboshi | 1×1 | 1 |
| 🥚 Tamago | 1×2 rectangle | 2 |
| 🥒 Cucumber | 1×3 rectangle | 3 |
| 🍤 Tempura | L-tromino | 3 |
| 🍚 Rice | 2×2 square | 4 |
| 🍣 Salmon | 1×4 rectangle | 4 |
| 🍙 Onigiri | T-tetromino (rotated 180°) | 4 |

### Controls
The game is fully playable with **only a mouse** or **only a
keyboard**:
* **Mouse**: click a piece in the tray to select it, **right-click**
  anywhere on the box to rotate it, and click a cell to pack it
  (the clicked cell is the piece's top-left anchor).
* **Keyboard**: `1`–`7` pick a piece, `Tab` to the board, move with
  the **arrow keys**, pack with `Enter` or `Space`, rotate with `R`,
  ask for a hint with `H`.
* Hovering or focusing a cell previews the placement — green for
  legal, grey for illegal — and floats the points it would earn.
* A hidden live region narrates selections, placements, seals, and
  results for screen readers.
* Sealed compartments glow in their owner's colour.
* The `?` button (or **How to play**) opens the rules;
  the `⚙` button opens settings (reduce animations, restart).

### Credits
* All food, garnish, and chef sprites are hand-made pixel-art SVGs
  in `web-app/assets/`.
* Typeface: "Press Start 2P" by CodeMan38,
  SIL Open Font License 1.1 (`web-app/assets/OFL.txt`).

## Project Structure
* `web-app/BoxedUp.js` – The game module: a pure-functional model of the
  game state and the operations on it (documented with JSDoc). Its API
  includes `available_pieces` (the pieces that still fit), `leader`
  (who is ahead right now), `empty_cells` (how much room is left), and
  `score_gain` (the points a ply would earn).
* `web-app/Chef.js` – The computer-opponent module: pure, deterministic
  chefs that propose plies using only the public `BoxedUp` API.
* `web-app/tests/BoxedUp.test.js` – Unit tests specifying placement
  behaviour, the win condition, and the `available_pieces`, `leader`,
  `empty_cells`, and `score_gain` helpers.
* `web-app/tests/Chef.test.js` – Unit tests specifying the computer
  chefs' behaviour (legality, levels, and seal-taking).
* `web-app/index.html` / `default.css` / `main.js` – The web app:
  structure, styling, and behaviour, kept separate.
  `main.js` defers to `BoxedUp.js` and `Chef.js` for all game logic.

## Checklist
### Install dependencies locally
This template relies on a few packages from the Node Package Manager,
npm. To install them run the following command in the terminal.
```properties
npm install
```

### Run the tests
With the packages installed, run the unit test suite with either:
```properties
npm test
```
or `npx mocha`. All tests should pass.

### Run the web app
`main.js` loads as an ES module and imports Ramda from `node_modules`,
so **run `npm install` first**, then launch the app one of these ways:
* **VS Code (easiest):** use the bundled **Run Web App – Firefox**
  launch configuration (`.vscode/launch.json`) — it opens
  `web-app/index.html` in Firefox with module loading enabled.
* **Any browser:** from the **project root**, run a static HTTP server,
  e.g. `npx http-server`, then open
  `http://127.0.0.1:8080/web-app/index.html`.

Opening `index.html` via `file://` in Chrome will not work, because
Chrome blocks ES-module imports loaded over `file://`.

### Game Module – API
- [x] Include a `.js` module file in `/web-app` containing the API
      using `jsdoc` → `web-app/BoxedUp.js`
- [x] Update `/jsdoc.json` to point to this module in
      `.source.include` (line 7)
- [x] Compile jsdoc using the run configuration `Generate Docs`
- [x] Check the generated docs have compiled correctly.

### Game Module – Implementation
- [x] The file above should be fully implemented.

### Unit Tests – Specification
- [x] Write unit test definitions in `/web-app/tests`.
- [x] Check the headings appear in the Testing sidebar.

### Unit Tests – Implementation
- [x] Implement the tests above.

### Web Application
- Implement in `/web-app`
  - [x] `index.html`
  - [x] `default.css`
  - [x] `main.js`
  - [x] Any other files you need to include.

### Finally
- [ ] Push to GitHub.
- [ ] Sync the changes.
- [ ] Check submission on GitHub website.

### Spicy Special extras
* **Golden star cells** — two per box. Covering one earns **+3**.
* **Wasabi cells** — two per box. Covering one burns **−3**…
  but eating the wasabi to steal a compartment can still pay off!
* Chefs chatter in speech bubbles, scores pop off the board,
  the box shakes when somebody bites the wasabi, and live-synthesised
  retro sound effects play (toggle them in ⚙ settings — no audio
  files needed, everything is generated with the Web Audio API).
### Ultimate edition extras
* **Matcha boost** — one cell per box grants an immediate **extra
  turn** to whoever covers it. Chain it with a star or a seal!
* **VIP order** — one compartment per box (marked with a gold star)
  is worth **+10** to its owner when sealed.
* **Closing bonus** — whoever packs the final piece slams the lid
  for **+2**, so the endgame parity battle matters.
* **Fair starts** — packing first means first pick of the specials,
  so the first box's starter is random and the loser of each box
  packs first in the next one (draws alternate).
* **Omakase mode** (settings) — all special cells are hidden until
  covered, turning every placement into a gamble.
* On every visit the rules appear first, then the settings,
  so new chefs are ready to cook.
* The **match leader wears the crown** — wins persist across page
  reloads (stored locally), so rivalries run for days.
* Chefs **taunt each other**, wince, bounce, and chatter while the
  computer "thinks".
* **DOUBLE SEAL!** banners, sparkle bursts, and end-of-game confetti.
* A cheeky one-liner sums up every result ticket.
* Pieces that don't fit flash red and get heckled — and closing the
  result ticket any way (even Escape) always deals a fresh box.
* The How-to-Play rules are served on a framed kitchen-shelf menu.

### Endless rush — time attack
**Endless rush** (toggle it in ⚙ settings, with a Brisk / Standard /
Relaxed service time) puts one countdown on the whole sitting. Within
it, every time a box is packed full it is banked and a fresh box is
dealt at once, so the chefs race to pack as many boxes as they can.
A heads-up display above the box tracks the time, the number of boxes
packed, and each chef's running total. When the clock reaches zero the
chef with the higher total wins the rush. The countdown pauses while a
dialog is open or the computer is thinking, and calls out thirty and
ten seconds to go; every box's score still comes from the game module.
The countdown is drawn as a row of **pixel-food morsels** that are
eaten away as the time runs down. (The timer only appears in this
mode — outside it the game is untimed, one box at a time.)

### Helping hands
* **Hint** (the ⌨ <kbd>H</kbd> button, bottom-right) asks the Head
  Chef computer for a strong move, then selects that piece in the
  right orientation and glows the cells where it would go.
* **Placement value** — hovering or focusing a cell floats the points
  that placement would earn (e.g. `+5` for a sealing move, `-3` for a
  wasabi bite), so you can weigh a move before committing.
* **Pieces that no longer fit anywhere are dimmed** in the tray, so a
  chef can see at a glance which dishes are still packable.
* **Win records are kept per opponent**, so beating the Head Chef
  never mingles with a human rivalry's tally.

#### Extra game-module functions
Four more pure functions in `web-app/BoxedUp.js`, each documented with
JSDoc and covered by tests in `web-app/tests/BoxedUp.test.js`:
* `BoxedUp.available_pieces(game)` — the menu pieces that can still be
  packed somewhere (the game ends exactly when none remain).
* `BoxedUp.leader(game)` — the chef currently ahead on score (`0` for a
  tie), reported for games still in progress too.
* `BoxedUp.empty_cells(game)` — how many cells of the box are still
  empty and open to be packed.
* `BoxedUp.score_gain(shape, position, game)` — the points the player to
  move would gain from a ply (`0` if it is not legal).
