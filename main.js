/*jslint browser: true */

/**
 * @fileoverview Muddy Puddles Flip – web application entry point.
 *
 * Handles all DOM interaction: building the board, responding to click and
 * keyboard events, and re-rendering the UI in response to game state changes.
 * All game logic is delegated to the {@link module:MuddyPuddles} module;
 * no game rules are implemented here.
 */

"use strict";

import {
    PEPPA,
    GEORGE,
    BOARD_SIZE,
    initialState,
    isValidMove,
    validMoves,
    makeMove,
    score
} from "./MuddyPuddles.js";

// ---------------------------------------------------------------------------
// Mutable application state (single source of truth for the UI)
// ---------------------------------------------------------------------------

/** @type {import("./MuddyPuddles.js").GameState} */
let gameState = initialState();

/** Whether move-hint highlighting is currently enabled. */
let hintsEnabled = true;

/**
 * The [row, col] of the cell that currently holds keyboard focus within
 * the board grid, or null when focus is outside the board.
 * @type {number[] | null}
 */
let focusedCell = null;

// ---------------------------------------------------------------------------
// DOM references (set once after DOMContentLoaded)
// ---------------------------------------------------------------------------

/** @type {HTMLElement} */ let boardBody;
/** @type {HTMLElement} */ let peppaScoreEl;
/** @type {HTMLElement} */ let georgeScoreEl;
/** @type {HTMLElement} */ let statusEl;
/** @type {HTMLElement} */ let peppaCard;
/** @type {HTMLElement} */ let georgeCard;
/** @type {HTMLButtonElement} */ let newGameBtn;
/** @type {HTMLButtonElement} */ let hintBtn;

// ---------------------------------------------------------------------------
// Board DOM construction
// ---------------------------------------------------------------------------

/**
 * Builds the 8×8 table body with one `<button>` per cell.
 * Each button is given `data-row` and `data-col` attributes so event
 * delegation can identify which cell was activated.
 */
const buildBoard = function () {
    boardBody.innerHTML = "";
    let r = 0;
    while (r < BOARD_SIZE) {
        const tr = document.createElement("tr");
        let c = 0;
        while (c < BOARD_SIZE) {
            const td = document.createElement("td");
            const btn = document.createElement("button");
            btn.type = "button";
            btn.className = "cell empty";
            btn.dataset.row = String(r);
            btn.dataset.col = String(c);
            btn.tabIndex = (r === 0 && c === 0 ? 0 : -1);
            td.appendChild(btn);
            tr.appendChild(td);
            c += 1;
        }
        boardBody.appendChild(tr);
        r += 1;
    }
    focusedCell = [0, 0];
};

// ---------------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------------

/**
 * Returns the `<button>` element at the given board position.
 * @param {number} row
 * @param {number} col
 * @returns {HTMLButtonElement}
 */
const getCell = function (row, col) {
    return boardBody.querySelector(
        `[data-row="${row}"][data-col="${col}"]`
    );
};

/**
 * Returns the CSS class name for a token belonging to `player`.
 * @param {string} player
 * @returns {string}
 */
const tokenClass = function (player) {
    return (player === PEPPA ? "peppa-token" : "george-token");
};

/**
 * Re-renders every cell to match the current game state.
 * Valid-move cells are always enabled for clicking; the visual muddy-puddle
 * hint is only shown when {@link hintsEnabled} is true.
 */
const renderBoard = function () {
    // Always compute valid moves so buttons are enabled regardless of hints.
    const moves = validMoves(gameState);
    const validSet = new Set(
        moves.map(function (m) {
            return `${m[0]},${m[1]}`;
        })
    );

    let r = 0;
    while (r < BOARD_SIZE) {
        let c = 0;
        while (c < BOARD_SIZE) {
            const btn = getCell(r, c);
            const cellValue = gameState.board[r][c];
            const isValid = validSet.has(`${r},${c}`);

            // Clear existing classes and content
            btn.className = "cell";
            btn.innerHTML = "";

            if (cellValue !== null) {
                btn.classList.add("occupied");
                const token = document.createElement("span");
                token.className = `token ${tokenClass(cellValue)}`;
                token.setAttribute("aria-hidden", "true");
                btn.appendChild(token);
                btn.setAttribute(
                    "aria-label",
                    `Row ${r + 1}, Column ${c + 1} – ${cellValue}'s token`
                );
                btn.disabled = true;
            } else if (isValid && !gameState.gameOver) {
                btn.classList.add("empty");
                // Only add the visual muddy-puddle highlight when hints are on.
                if (hintsEnabled) {
                    btn.classList.add("valid-move");
                }
                btn.setAttribute(
                    "aria-label",
                    `Row ${r + 1}, Column ${c + 1} – valid move for ${gameState.currentPlayer}`
                );
                btn.disabled = false;
            } else {
                btn.classList.add("empty");
                btn.setAttribute(
                    "aria-label",
                    `Row ${r + 1}, Column ${c + 1} – empty`
                );
                btn.disabled = true;
            }

            c += 1;
        }
        r += 1;
    }
};

/**
 * Updates scores, active-player highlights, and the status message.
 */
const renderStatus = function () {
    peppaScoreEl.textContent = String(score(gameState.board, PEPPA));
    georgeScoreEl.textContent = String(score(gameState.board, GEORGE));

    peppaCard.classList.toggle(
        "active-player",
        !gameState.gameOver && gameState.currentPlayer === PEPPA
    );
    georgeCard.classList.toggle(
        "active-player",
        !gameState.gameOver && gameState.currentPlayer === GEORGE
    );

    statusEl.className = "status-message";

    if (gameState.gameOver) {
        statusEl.classList.add("game-over");
        if (gameState.winner === "draw") {
            statusEl.textContent =
                "It's a draw! Peppa and George both love muddy puddles equally!";
        } else if (gameState.winner === PEPPA) {
            statusEl.textContent =
                "🐷 Peppa wins! She's jumped in the most muddy puddles!";
        } else {
            statusEl.textContent =
                "🦕 George wins! He's splashed through the most puddles!";
        }
        return;
    }

    if (gameState.currentPlayer === GEORGE) {
        statusEl.classList.add("george-turn");
    }

    if (validMoves(gameState).length === 0) {
        const skipped = (gameState.currentPlayer === PEPPA ? "Peppa" : "George");
        statusEl.textContent =
            `${skipped} has no valid moves – turn skipped!`;
    } else if (gameState.currentPlayer === PEPPA) {
        statusEl.textContent = "Peppa's turn – place a muddy puddle!";
    } else {
        statusEl.textContent = "George's turn – jump in a puddle!";
    }
};

/**
 * Full re-render: board + scores + status + roving tabindex.
 */
const render = function () {
    renderBoard();
    renderStatus();
    updateRovingTabindex();
};

// ---------------------------------------------------------------------------
// Roving tabindex (keyboard grid navigation)
// ---------------------------------------------------------------------------

/**
 * Ensures exactly one cell has `tabIndex = 0` (the focused cell) and all
 * others have `tabIndex = -1`, implementing the ARIA roving tabindex pattern.
 */
const updateRovingTabindex = function () {
    if (focusedCell === null) {
        return;
    }
    let r = 0;
    while (r < BOARD_SIZE) {
        let c = 0;
        while (c < BOARD_SIZE) {
            const btn = getCell(r, c);
            btn.tabIndex = (
                r === focusedCell[0] && c === focusedCell[1] ? 0 : -1
            );
            c += 1;
        }
        r += 1;
    }
};

/**
 * Moves the keyboard focus to a new cell by row/col delta.
 * Clamps to board boundaries.
 * @param {number} dr - Row delta.
 * @param {number} dc - Column delta.
 */
const moveFocus = function (dr, dc) {
    if (focusedCell === null) {
        focusedCell = [0, 0];
    }
    const newRow = Math.max(0, Math.min(BOARD_SIZE - 1, focusedCell[0] + dr));
    const newCol = Math.max(0, Math.min(BOARD_SIZE - 1, focusedCell[1] + dc));
    focusedCell = [newRow, newCol];
    updateRovingTabindex();
    getCell(newRow, newCol).focus();
};

// ---------------------------------------------------------------------------
// Move handling
// ---------------------------------------------------------------------------

/**
 * Attempts to apply a move at `(row, col)` for the current player.
 * Ignores the attempt if the move is invalid (cell already occupied,
 * not a legal Reversi move, or game already over).
 * @param {number} row
 * @param {number} col
 */
const handleMove = function (row, col) {
    if (!isValidMove(gameState, row, col)) {
        return;
    }

    gameState = makeMove(gameState, row, col);
    focusedCell = [row, col];
    render();
};

// ---------------------------------------------------------------------------
// Event listeners
// ---------------------------------------------------------------------------

/**
 * Attaches a delegated click listener to the board body.
 * Reads the row/col from the button's data attributes.
 */
const attachBoardClickListener = function () {
    boardBody.addEventListener("click", function (event) {
        const btn = event.target.closest("button.cell");
        if (btn === null) {
            return;
        }
        handleMove(Number(btn.dataset.row), Number(btn.dataset.col));
    });
};

/**
 * Attaches keyboard navigation and action listeners to the board body.
 * Arrow keys move focus; Enter/Space trigger a move on the focused cell.
 */
const attachBoardKeyboardListener = function () {
    boardBody.addEventListener("keydown", function (event) {
        const key = event.key;

        if (key === "ArrowUp" || key === "ArrowDown" ||
                key === "ArrowLeft" || key === "ArrowRight") {
            event.preventDefault();
            const delta = {
                ArrowUp:    [-1, 0],
                ArrowDown:  [1,  0],
                ArrowLeft:  [0, -1],
                ArrowRight: [0,  1]
            };
            const d = delta[key];
            moveFocus(d[0], d[1]);
            return;
        }

        if ((key === "Enter" || key === " ") && focusedCell !== null) {
            event.preventDefault();
            handleMove(focusedCell[0], focusedCell[1]);
            return;
        }
    });

    // Track which cell has focus for the roving tabindex
    boardBody.addEventListener("focusin", function (event) {
        const btn = event.target.closest("button.cell");
        if (btn !== null) {
            focusedCell = [Number(btn.dataset.row), Number(btn.dataset.col)];
        }
    });
};

/**
 * Attaches global keyboard shortcuts:
 * N – new game, H – toggle hints.
 */
const attachGlobalKeyboardListener = function () {
    document.addEventListener("keydown", function (event) {
        if (event.target.closest("#game-board") !== null) {
            return;
        }
        if (event.key === "n" || event.key === "N") {
            newGameBtn.click();
        }
        if (event.key === "h" || event.key === "H") {
            hintBtn.click();
        }
    });
};

/**
 * Wires up the New Game button.
 */
const attachNewGameListener = function () {
    newGameBtn.addEventListener("click", function () {
        gameState = initialState();
        focusedCell = [0, 0];
        render();
        // Return keyboard focus to the board so users can play immediately
        getCell(0, 0).focus();
    });
};

/**
 * Wires up the Hints toggle button.
 */
const attachHintListener = function () {
    hintBtn.addEventListener("click", function () {
        hintsEnabled = !hintsEnabled;
        hintBtn.setAttribute("aria-pressed", String(hintsEnabled));
        hintBtn.textContent = (hintsEnabled ? "Hide Hints" : "Show Hints");
        render();
    });
};

// ---------------------------------------------------------------------------
// Bootstrap
// ---------------------------------------------------------------------------

/**
 * Initialises the application once the DOM is ready.
 */
const init = function () {
    boardBody     = document.getElementById("board-body");
    peppaScoreEl  = document.getElementById("peppa-score");
    georgeScoreEl = document.getElementById("george-score");
    statusEl      = document.getElementById("status-message");
    peppaCard     = document.getElementById("peppa-card");
    georgeCard    = document.getElementById("george-card");
    newGameBtn    = document.getElementById("new-game-btn");
    hintBtn       = document.getElementById("hint-btn");

    buildBoard();
    render();

    attachBoardClickListener();
    attachBoardKeyboardListener();
    attachGlobalKeyboardListener();
    attachNewGameListener();
    attachHintListener();
};

document.addEventListener("DOMContentLoaded", init);
