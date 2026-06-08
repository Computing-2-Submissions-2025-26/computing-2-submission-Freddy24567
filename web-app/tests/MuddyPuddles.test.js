/*jslint browser: true, node: true */

/**
 * @fileoverview Unit tests for the MuddyPuddles game module.
 *
 * Tests focus on the flip mechanic – the defining behaviour of
 * Reversi/Othello – covering: which tokens flip, how many flip,
 * that unaffected tokens are unchanged, that the active player
 * rotates correctly, and that the game-over and win conditions
 * fire at the right moments.
 */

"use strict";

import assert from "node:assert/strict";
import {
    PEPPA,
    GEORGE,
    BOARD_SIZE,
    initialState,
    isValidMove,
    validMoves,
    makeMove,
    score,
    opponent
} from "../MuddyPuddles.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Counts how many cells on the board are occupied (non-null).
 * @param {import("../MuddyPuddles.js").Board} board
 * @returns {number}
 */
const totalTokens = function (board) {
    return board.reduce(
        function (sum, row) {
            return sum + row.filter(function (c) {
                return c !== null;
            }).length;
        },
        0
    );
};

/**
 * Returns the value at a given position.
 * @param {import("../MuddyPuddles.js").Board} board
 * @param {number} row
 * @param {number} col
 * @returns {string | null}
 */
const cell = function (board, row, col) {
    return board[row][col];
};

// ---------------------------------------------------------------------------
// Initial state
// ---------------------------------------------------------------------------

describe("initialState", function () {

    it("should return a board of size BOARD_SIZE × BOARD_SIZE", function () {
        const state = initialState();
        assert.strictEqual(state.board.length, BOARD_SIZE);
        state.board.forEach(function (row) {
            assert.strictEqual(row.length, BOARD_SIZE);
        });
    });

    it("should place exactly four tokens at the start", function () {
        const state = initialState();
        assert.strictEqual(totalTokens(state.board), 4);
    });

    it("should give each player two tokens at the start", function () {
        const state = initialState();
        assert.strictEqual(score(state.board, PEPPA), 2);
        assert.strictEqual(score(state.board, GEORGE), 2);
    });

    it("should set Peppa as the first player", function () {
        const state = initialState();
        assert.strictEqual(state.currentPlayer, PEPPA);
    });

    it("should not be game over at the start", function () {
        const state = initialState();
        assert.strictEqual(state.gameOver, false);
    });

    it("should have no winner at the start", function () {
        const state = initialState();
        assert.strictEqual(state.winner, null);
    });
});

// ---------------------------------------------------------------------------
// opponent
// ---------------------------------------------------------------------------

describe("opponent", function () {

    it("should return George when given Peppa", function () {
        assert.strictEqual(opponent(PEPPA), GEORGE);
    });

    it("should return Peppa when given George", function () {
        assert.strictEqual(opponent(GEORGE), PEPPA);
    });

    it("should be its own inverse", function () {
        assert.strictEqual(opponent(opponent(PEPPA)), PEPPA);
        assert.strictEqual(opponent(opponent(GEORGE)), GEORGE);
    });
});

// ---------------------------------------------------------------------------
// validMoves on the opening position
// ---------------------------------------------------------------------------

describe("validMoves – opening position", function () {

    let state;
    before(function () {
        state = initialState();
    });

    it("should return exactly four valid moves for Peppa at the start", function () {
        assert.strictEqual(validMoves(state).length, 4);
    });

    it("should include the cell directly above the centre-right George token", function () {
        // In standard Othello opening, row 2 col 3 is a valid first move.
        const moves = validMoves(state);
        const has = moves.some(function (m) {
            return m[0] === 2 && m[1] === 3;
        });
        assert.strictEqual(has, true);
    });

    it("should return an empty array when the game is over", function () {
        const over = {
            board: initialState().board,
            currentPlayer: PEPPA,
            gameOver: true,
            winner: PEPPA
        };
        assert.deepStrictEqual(validMoves(over), []);
    });
});

// ---------------------------------------------------------------------------
// isValidMove
// ---------------------------------------------------------------------------

describe("isValidMove", function () {

    let state;
    before(function () {
        state = initialState();
    });

    it("should return false for an occupied cell", function () {
        // Centre cells are occupied at start: (3,3), (3,4), (4,3), (4,4)
        assert.strictEqual(isValidMove(state, 3, 3), false);
        assert.strictEqual(isValidMove(state, 3, 4), false);
    });

    it("should return false for a cell that would flip no tokens", function () {
        // Corner (0,0) is empty but sandwiches nothing at game start
        assert.strictEqual(isValidMove(state, 0, 0), false);
    });

    it("should return true for a known valid opening move", function () {
        assert.strictEqual(isValidMove(state, 2, 3), true);
    });

    it("should return false when the game is already over", function () {
        const over = {
            board: state.board,
            currentPlayer: PEPPA,
            gameOver: true,
            winner: PEPPA
        };
        assert.strictEqual(isValidMove(over, 2, 3), false);
    });
});

// ---------------------------------------------------------------------------
// makeMove – flip mechanic
// ---------------------------------------------------------------------------

describe("makeMove – token placement", function () {

    let before_state;
    let after_state;

    before(function () {
        before_state = initialState();
        // Move (2,3): Peppa places above George's token at (3,3),
        // sandwiching it between (4,3) Peppa below → flips (3,3).
        after_state = makeMove(before_state, 2, 3);
    });

    it("should place the active player's token at the chosen cell", function () {
        assert.strictEqual(cell(after_state.board, 2, 3), PEPPA);
    });

    it("should flip the sandwiched opponent token", function () {
        // (3,3) was George's; it should now be Peppa's
        assert.strictEqual(cell(after_state.board, 3, 3), PEPPA);
    });

    it("should add exactly one token to the board (the placed one; flips only change colour)", function () {
        assert.strictEqual(
            totalTokens(after_state.board),
            totalTokens(before_state.board) + 1
        );
    });

    it("should leave tokens outside the affected line unchanged", function () {
        // Initial layout: (3,3)=George, (4,4)=George, (3,4)=Peppa, (4,3)=Peppa.
        // Move (2,3) only flips (3,3). All other tokens must be unchanged.
        assert.strictEqual(cell(after_state.board, 3, 4), PEPPA);
        assert.strictEqual(cell(after_state.board, 4, 4), GEORGE);
        assert.strictEqual(cell(after_state.board, 4, 3), PEPPA);
    });

    it("should leave the placed cell belonging to the current player", function () {
        assert.strictEqual(cell(after_state.board, 2, 3), PEPPA);
    });

    it("should leave empty cells empty", function () {
        assert.strictEqual(cell(after_state.board, 0, 0), null);
        assert.strictEqual(cell(after_state.board, 7, 7), null);
    });
});

describe("makeMove – turn progression", function () {

    it("should pass the turn to the opponent after a valid move", function () {
        const state = initialState();
        const next = makeMove(state, 2, 3);
        assert.strictEqual(next.currentPlayer, GEORGE);
    });

    it("should return the original state unchanged for an invalid move", function () {
        const state = initialState();
        const next = makeMove(state, 0, 0); // corner – not valid at start
        assert.deepStrictEqual(next, state);
    });

    it("should not set gameOver after a normal move", function () {
        const state = initialState();
        const next = makeMove(state, 2, 3);
        assert.strictEqual(next.gameOver, false);
    });
});

describe("makeMove – score changes", function () {

    it("should increase the mover's score after a valid move", function () {
        const state = initialState();
        const peppaBefore = score(state.board, PEPPA);
        const next = makeMove(state, 2, 3);
        assert.strictEqual(score(next.board, PEPPA) > peppaBefore, true);
    });

    it("should decrease the opponent's score when tokens are flipped", function () {
        const state = initialState();
        const georgeBefore = score(state.board, GEORGE);
        const next = makeMove(state, 2, 3);
        assert.strictEqual(score(next.board, GEORGE) < georgeBefore, true);
    });

    it("should keep total token count = previous + 1 after any move", function () {
        const state = initialState();
        const before = score(state.board, PEPPA) + score(state.board, GEORGE);
        const next = makeMove(state, 2, 3);
        const after = score(next.board, PEPPA) + score(next.board, GEORGE);
        assert.strictEqual(after, before + 1);
    });
});

// ---------------------------------------------------------------------------
// makeMove – game-over detection
// ---------------------------------------------------------------------------

describe("makeMove – game over", function () {

    /**
     * Builds a near-full board where only one move remains.
     * Fills the board with alternating tokens except for one empty cell at
     * (0,0) and a configuration that lets the current player flip (0,1).
     *
     * Board layout (P = peppa, G = george, . = empty):
     *   .  G  P  P  P  P  P  P
     *   P  P  P  P  P  P  P  P
     *   P  P  P  P  P  P  P  P
     *   …(all Peppa)
     *
     * Placing Peppa at (0,0) flips (0,1) George → game ends (George has 0).
     */
    const makeEndgameState = function () {
        const board = Array.from({length: BOARD_SIZE}, function () {
            return Array.from({length: BOARD_SIZE}, function () {
                return PEPPA;
            });
        });
        // Place one George token that can be sandwiched
        const withGeorge = board.map(function (row, r) {
            return row.map(function (c, col) {
                if (r === 0 && col === 1) {
                    return GEORGE;
                }
                return c;
            });
        });
        // Empty the corner
        const withEmpty = withGeorge.map(function (row, r) {
            return row.map(function (c, col) {
                if (r === 0 && col === 0) {
                    return null;
                }
                return c;
            });
        });
        return {
            board: withEmpty,
            currentPlayer: PEPPA,
            gameOver: false,
            winner: null
        };
    };

    it("should set gameOver when neither player can make a move", function () {
        const state = makeEndgameState();
        const next = makeMove(state, 0, 0);
        assert.strictEqual(next.gameOver, true);
    });

    it("should set the winner to the player with the most tokens", function () {
        const state = makeEndgameState();
        const next = makeMove(state, 0, 0);
        // All tokens are Peppa's after the final flip
        assert.strictEqual(next.winner, PEPPA);
    });

    it("should not report a winner while the game is still in progress", function () {
        const state = initialState();
        const next = makeMove(state, 2, 3);
        assert.strictEqual(next.winner, null);
    });
});
