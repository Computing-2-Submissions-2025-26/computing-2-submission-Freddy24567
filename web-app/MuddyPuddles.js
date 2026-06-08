/*jslint browser: true, node: true */

/**
 * @fileoverview Muddy Puddles Flip – game logic module.
 *
 * Implements a Reversi/Othello style turn-based board game with a Peppa Pig
 * theme. Peppa (pink) and George (green) take turns placing tokens on an 8×8
 * grid. Any opponent tokens sandwiched in a straight line between the newly
 * placed token and an existing friendly token are flipped. The player with the
 * most tokens when neither player can move wins.
 *
 * All exported functions are **pure**: they never mutate their arguments and
 * always return the same output for the same input.
 *
 * @module MuddyPuddles
 */

"use strict";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/**
 * The number of rows and columns on the board.
 * @constant {number}
 */
const BOARD_SIZE = 8;

/**
 * Token identifier for Peppa (player one).
 * @constant {string}
 */
const PEPPA = "peppa";

/**
 * Token identifier for George (player two).
 * @constant {string}
 */
const GEORGE = "george";

/**
 * All eight movement directions expressed as [rowDelta, colDelta] pairs.
 * Used to scan lines in every direction when checking or applying flips.
 * @constant {number[][]}
 */
const DIRECTIONS = [
    [-1, -1], [-1, 0], [-1, 1],
    [0, -1],           [0, 1],
    [1, -1],  [1, 0],  [1, 1]
];

// ---------------------------------------------------------------------------
// Type definitions (JSDoc only – no runtime cost)
// ---------------------------------------------------------------------------

/**
 * @typedef {"peppa" | "george"} Player
 * A player token colour. Either {@link PEPPA} or {@link GEORGE}.
 */

/**
 * @typedef {(Player | null)[][]} Board
 * An {@link BOARD_SIZE}×{@link BOARD_SIZE} row-major array.
 * Each cell holds a {@link Player} string or `null` for an empty cell.
 */

/**
 * @typedef {Object} GameState
 * The complete, immutable snapshot of a game in progress.
 * @property {Board} board - Current token layout.
 * @property {Player} currentPlayer - The player whose turn it is.
 * @property {boolean} gameOver - `true` once neither player can move.
 * @property {Player | "draw" | null} winner -
 *   The winning player, `"draw"`, or `null` while the game is ongoing.
 */

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Produces an integer sequence `[0, 1, …, n-1]`.
 * @param {number} n - Length of the sequence.
 * @returns {number[]} Array of integers from 0 to n-1.
 */
const range = function (n) {
    return Array.from({length: n}, function (ignore, i) {
        return i;
    });
};

/**
 * All board positions as `[row, col]` pairs, in row-major order.
 * Pre-computed once to support functional iteration.
 * @constant {number[][]}
 */
const ALL_POSITIONS = range(BOARD_SIZE).reduce(
    function (acc, r) {
        return acc.concat(
            range(BOARD_SIZE).map(function (c) {
                return [r, c];
            })
        );
    },
    []
);

/**
 * Returns `true` if the row and column indices are inside the board.
 * @param {number} row - Row index.
 * @param {number} col - Column index.
 * @returns {boolean}
 */
const inBounds = function (row, col) {
    return row >= 0 && row < BOARD_SIZE && col >= 0 && col < BOARD_SIZE;
};

/**
 * Returns a new board with a single cell replaced (pure, no mutation).
 * @param {Board} board - The source board.
 * @param {number} row - Row to update.
 * @param {number} col - Column to update.
 * @param {Player | null} value - New cell value.
 * @returns {Board} Updated board.
 */
const setCell = function (board, row, col, value) {
    return board.map(function (r, i) {
        if (i !== row) {
            return r;
        }
        return r.map(function (cell, j) {
            return (j === col ? value : cell);
        });
    });
};

/**
 * Returns a new board with multiple cells set to the same value (pure).
 * Uses {@link setCell} iteratively via reduce.
 * @param {Board} board - The source board.
 * @param {number[][]} positions - Array of `[row, col]` pairs to update.
 * @param {Player | null} value - Value to place at each position.
 * @returns {Board} Updated board.
 */
const setCells = function (board, positions, value) {
    return positions.reduce(
        function (b, pos) {
            return setCell(b, pos[0], pos[1], value);
        },
        board
    );
};

// ---------------------------------------------------------------------------
// Core game logic
// ---------------------------------------------------------------------------

/**
 * Returns the opposing player.
 * @param {Player} player - A player identifier.
 * @returns {Player} The other player.
 */
const opponent = function (player) {
    return (player === PEPPA ? GEORGE : PEPPA);
};

/**
 * Walks one direction from a candidate cell, collecting consecutive opponent
 * tokens. Returns those tokens only if they are terminated by a friendly
 * token (forming a valid capture line); otherwise returns an empty array.
 *
 * Uses tail recursion to traverse each direction without mutation.
 *
 * @param {Board} board - Current board state.
 * @param {number} row - Starting row (the candidate empty cell).
 * @param {number} col - Starting column.
 * @param {Player} player - The player placing the token.
 * @param {number} dr - Row delta (−1, 0, or 1).
 * @param {number} dc - Column delta (−1, 0, or 1).
 * @returns {number[][]} Positions of tokens that would be flipped along
 *   this direction, or `[]` if none.
 */
const tokensInDirection = function (board, row, col, player, dr, dc) {
    const opp = opponent(player);

    const walk = function (r, c, acc) {
        if (!inBounds(r, c)) {
            return [];
        }
        if (board[r][c] === opp) {
            return walk(r + dr, c + dc, acc.concat([[r, c]]));
        }
        if (board[r][c] === player && acc.length > 0) {
            return acc;
        }
        return [];
    };

    return walk(row + dr, col + dc, []);
};

/**
 * Returns every opponent token that would be flipped if `player` placed at
 * `(row, col)`. Aggregates results across all eight directions.
 *
 * @param {Board} board - Current board state.
 * @param {number} row - Candidate row.
 * @param {number} col - Candidate column.
 * @param {Player} player - The player placing the token.
 * @returns {number[][]} Array of `[row, col]` positions to flip.
 */
const tokensToFlip = function (board, row, col, player) {
    return DIRECTIONS.reduce(
        function (acc, dir) {
            return acc.concat(
                tokensInDirection(board, row, col, player, dir[0], dir[1])
            );
        },
        []
    );
};

/**
 * Checks whether placing a token at `(row, col)` is a legal move for the
 * current player. A move is legal when the target cell is empty and at least
 * one opponent token would be flipped.
 *
 * @param {GameState} state - Current game state.
 * @param {number} row - Target row.
 * @param {number} col - Target column.
 * @returns {boolean} `true` if the move is valid.
 */
const isValidMove = function (state, row, col) {
    if (state.gameOver) {
        return false;
    }
    if (!inBounds(row, col)) {
        return false;
    }
    if (state.board[row][col] !== null) {
        return false;
    }
    return tokensToFlip(state.board, row, col, state.currentPlayer).length > 0;
};

/**
 * Returns all legal moves available to the current player as `[row, col]`
 * pairs. Returns an empty array when the current player has no legal moves.
 *
 * @param {GameState} state - Current game state.
 * @returns {number[][]} Array of valid `[row, col]` positions.
 */
const validMoves = function (state) {
    if (state.gameOver) {
        return [];
    }
    return ALL_POSITIONS.filter(function (pos) {
        return isValidMove(state, pos[0], pos[1]);
    });
};

/**
 * Counts the number of tokens belonging to `player` on the board.
 *
 * @param {Board} board - The board to inspect.
 * @param {Player} player - The player whose tokens to count.
 * @returns {number} Token count.
 */
const score = function (board, player) {
    return board.reduce(
        function (total, row) {
            return total + row.filter(function (cell) {
                return cell === player;
            }).length;
        },
        0
    );
};

/**
 * Determines the winner once neither player can move.
 * The player with the most tokens wins; equal scores produce a draw.
 *
 * @param {Board} board - Final board state.
 * @returns {Player | "draw"} The winning player, or `"draw"`.
 */
const determineWinner = function (board) {
    const peppaScore = score(board, PEPPA);
    const georgeScore = score(board, GEORGE);
    if (peppaScore > georgeScore) {
        return PEPPA;
    }
    if (georgeScore > peppaScore) {
        return GEORGE;
    }
    return "draw";
};

/**
 * Applies a move and returns the resulting game state.
 *
 * If the move is invalid the original state is returned unchanged.
 * After placing, if the next player has legal moves the turn passes to them.
 * If the next player has no legal moves but the current player still does,
 * the turn is *not* passed (the current player plays again).
 * If neither player can move the game ends and the winner is determined.
 *
 * @param {GameState} state - Current game state.
 * @param {number} row - Row to place the token.
 * @param {number} col - Column to place the token.
 * @returns {GameState} The new game state.
 */
const makeMove = function (state, row, col) {
    if (!isValidMove(state, row, col)) {
        return state;
    }

    const player = state.currentPlayer;
    const flipped = tokensToFlip(state.board, row, col, player);

    const boardAfterPlace = setCell(state.board, row, col, player);
    const newBoard = setCells(boardAfterPlace, flipped, player);

    const next = opponent(player);
    const nextState = {
        board: newBoard,
        currentPlayer: next,
        gameOver: false,
        winner: null
    };

    if (validMoves(nextState).length > 0) {
        return nextState;
    }

    const stayState = {
        board: newBoard,
        currentPlayer: player,
        gameOver: false,
        winner: null
    };

    if (validMoves(stayState).length > 0) {
        return stayState;
    }

    return {
        board: newBoard,
        currentPlayer: next,
        gameOver: true,
        winner: determineWinner(newBoard)
    };
};

/**
 * Creates the standard opening game state.
 *
 * The board starts with four tokens in the centre in a 2×2 diagonal
 * arrangement. Peppa plays first.
 *
 * @returns {GameState} A fresh game ready for the first move.
 */
const initialState = function () {
    const mid = BOARD_SIZE / 2;
    let board = Array.from(
        {length: BOARD_SIZE},
        function () {
            return Array.from({length: BOARD_SIZE}, function () {
                return null;
            });
        }
    );
    board = setCell(board, mid - 1, mid - 1, GEORGE);
    board = setCell(board, mid,     mid,     GEORGE);
    board = setCell(board, mid - 1, mid,     PEPPA);
    board = setCell(board, mid,     mid - 1, PEPPA);

    return {
        board,
        currentPlayer: PEPPA,
        gameOver: false,
        winner: null
    };
};

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

export {
    BOARD_SIZE,
    PEPPA,
    GEORGE,
    initialState,
    isValidMove,
    validMoves,
    makeMove,
    score,
    opponent,
    tokensToFlip
};
