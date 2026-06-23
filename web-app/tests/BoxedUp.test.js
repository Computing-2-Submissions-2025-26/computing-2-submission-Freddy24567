import BoxedUp from "../BoxedUp.js";
import R from "../ramda.js";

const display_board = function (board) {
    return "\n" + BoxedUp.to_string(board);
};

const display_game = function (game) {
    return (
        display_board(game.board) +
        "\n(Player " + game.player + " to play)"
    );
};

/**
 * Returns if the game is in a valid state.
 * A game state is valid if all the following are true:
 * - The board is a rectangular 2d array containing only
 *   0, 1, 2, or 3 (garnish).
 * - The player to play is either 1 or 2.
 * @memberof BoxedUp.test
 * @function
 * @param {BoxedUp.Game} game The game to test.
 * @throws if the game fails any of the above conditions.
 */
const throw_if_invalid = function (game) {
    const board = game.board;
    if (!Array.isArray(board) || !Array.isArray(board[0])) {
        throw new Error(
            "The board is not a 2D array: " + display_game(game)
        );
    }
    const width = board[0].length;
    const rectangular = R.all(
        (row) => row.length === width,
        board
    );
    if (!rectangular) {
        throw new Error(
            "The board is not rectangular: " + display_game(game)
        );
    }
    const token_or_empty = [0, 1, 2, 3];
    const contains_valid_tokens = R.pipe(
        R.flatten,
        R.all((cell) => token_or_empty.includes(cell))
    )(board);
    if (!contains_valid_tokens) {
        throw new Error(
            "The board contains invalid tokens: " + display_game(game)
        );
    }
    if (game.player !== 1 && game.player !== 2) {
        throw new Error(
            "The player to play is not 1 or 2: " + display_game(game)
        );
    }
};

describe("New games", function () {
    it(
        `Given no arguments,
when a new game is started,
then it has an empty 9×9 board, player 1 to play, and is not ended.`,
        function () {
            const game = BoxedUp.new_game();
            throw_if_invalid(game);
            if (!R.equals(BoxedUp.size(game.board), [9, 9])) {
                throw new Error(
                    "A new game does not have a 9×9 board: " +
                    display_game(game)
                );
            }
            const all_empty = R.pipe(
                R.flatten,
                R.all(R.equals(0))
            )(game.board);
            if (!all_empty) {
                throw new Error(
                    "A new game has filled cells: " + display_game(game)
                );
            }
            if (BoxedUp.player_to_ply(game) !== 1) {
                throw new Error(
                    "A new game is not player 1 to play: " +
                    display_game(game)
                );
            }
            if (BoxedUp.is_ended(game)) {
                throw new Error(
                    "A new game should not be ended: " + display_game(game)
                );
            }
        }
    );

    it(
        `Given a requested width and height,
when a new game is started,
then its board has that width and height.`,
        function () {
            const game = BoxedUp.new_game(4, 6);
            throw_if_invalid(game);
            if (!R.equals(BoxedUp.size(game.board), [4, 6])) {
                throw new Error(
                    "Requested a 4×6 board, but got: " + display_game(game)
                );
            }
        }
    );
});

/**
 * This function tries every legal placement of every orientation of
 * every piece on a game, and will throw if any resulting game,
 * - Is an invalid game state,
 * - Does not place the ply-maker's token on exactly the covered cells,
 * - Changes any cell outside the placed piece,
 * - Does not pass the turn to the other player.
 * @memberof BoxedUp.test
 * @function
 * @param {BoxedUp.Game} game The (not ended) game to test.
 * @throws if any placement fails any of the above conditions.
 */
const throw_if_bad_placement = function (game) {
    const player = BoxedUp.player_to_ply(game);
    const other_player = 3 - player;
    R.values(BoxedUp.piece_shapes).forEach(function (shape) {
        BoxedUp.orientations(shape).forEach(function (orientation) {
            BoxedUp.legal_placements(
                orientation,
                game.board
            ).forEach(function (position) {
                const next = BoxedUp.place(orientation, position, game);
                throw_if_invalid(next);
                const covered = BoxedUp.placement_cells(
                    orientation,
                    position
                );
                covered.forEach(function ([row, column]) {
                    if (next.board[row][column] !== player) {
                        throw new Error(
                            `Placing at [${row}, ${column}] did not ` +
                            `mark the cell for player ${player}: ` +
                            display_game(next)
                        );
                    }
                });
                const expected_board = covered.reduce(
                    function (board, [row, column]) {
                        return R.update(
                            row,
                            R.update(column, player, board[row]),
                            board
                        );
                    },
                    game.board
                );
                if (!R.equals(next.board, expected_board)) {
                    throw new Error(
                        "A placement changed cells outside the piece." +
                        "\nBefore: " + display_board(game.board) +
                        "\nAfter: " + display_board(next.board)
                    );
                }
                if (BoxedUp.player_to_ply(next) !== other_player) {
                    throw new Error(
                        `After player ${player} packs a piece, ` +
                        `player ${other_player} should be up: ` +
                        display_game(next)
                    );
                }
            });
        });
    });
};

describe("Placements", function () {
    it(
        `Given a game that is not ended,
when the current player packs any piece, in any orientation,
at any legal position,
then the resulting game is a valid state where exactly the covered
cells gain that player's token and the other player is up.`,
        function () {
            const not_ended_games = [
                BoxedUp.new_game(),
                BoxedUp.new_game(3, 3),
                {
                    "board": [
                        [1, 1, 0, 0],
                        [2, 0, 0, 0],
                        [2, 0, 0, 1],
                        [2, 0, 0, 1]
                    ],
                    "player": 2
                }
            ];
            not_ended_games.forEach(throw_if_bad_placement);
        }
    );

    it(
        `Given a piece that would overlap an already filled cell,
when the current player attempts to pack it there,
then the placement is rejected (undefined)
and the original game is unchanged.`,
        function () {
            const game = {
                "board": [
                    [1, 1, 0],
                    [0, 0, 0],
                    [0, 0, 0]
                ],
                "player": 2
            };
            const original_board = R.clone(game.board);
            const rejected = BoxedUp.place(
                BoxedUp.piece_shapes.tamago,
                [0, 1],
                game
            );
            if (rejected !== undefined) {
                throw new Error(
                    "An overlapping placement was not rejected: " +
                    display_game(rejected)
                );
            }
            if (!R.equals(game.board, original_board)) {
                throw new Error(
                    "A rejected placement mutated the game: " +
                    display_game(game)
                );
            }
        }
    );

    it(
        `Given a piece that would overhang the edge of the box,
when the current player attempts to pack it there,
then the placement is rejected (undefined).`,
        function () {
            const game = BoxedUp.new_game(3, 3);
            const overhanging = BoxedUp.place(
                BoxedUp.piece_shapes.salmon, // 1×4 into a 3-wide box.
                [0, 0],
                game
            );
            if (overhanging !== undefined) {
                throw new Error(
                    "An overhanging placement was not rejected: " +
                    display_game(overhanging)
                );
            }
        }
    );

    it(
        `Given a game that has already ended,
when a player attempts to pack any piece,
then the placement is rejected (undefined).`,
        function () {
            const ended_game = {
                "board": [
                    [1, 2],
                    [2, 1]
                ],
                "player": 1
            };
            const after_end = BoxedUp.place(
                BoxedUp.piece_shapes.tamago,
                [0, 0],
                ended_game
            );
            if (after_end !== undefined) {
                throw new Error(
                    "A placement on an ended game was not rejected: " +
                    display_game(after_end)
                );
            }
        }
    );
});

describe("Ended games and the winner", function () {
    it(
        `Given a box with only isolated single empty cells,
then the game is not ended —
the one-cell umeboshi still fits in each of them.`,
        function () {
            const holey_game = {
                "board": [
                    [1, 0, 2],
                    [0, 1, 0],
                    [2, 0, 1]
                ],
                "player": 2
            };
            if (BoxedUp.is_ended(holey_game)) {
                throw new Error(
                    "The umeboshi still fits, so the game " +
                    "should not be ended: " + display_game(holey_game)
                );
            }
        }
    );

    it(
        `Given a box with two adjacent empty cells,
(so the smallest piece, tamago, still fits),
then the game is not ended and has no winner yet (undefined).`,
        function () {
            const open_game = {
                "board": [
                    [1, 0, 0],
                    [2, 2, 1],
                    [1, 2, 1]
                ],
                "player": 2
            };
            if (BoxedUp.is_ended(open_game)) {
                throw new Error(
                    "The tamago still fits, " +
                    "so the game should not be ended: " +
                    display_game(open_game)
                );
            }
            if (BoxedUp.winner(open_game) !== undefined) {
                throw new Error(
                    "A game that has not ended should have no winner: " +
                    display_game(open_game)
                );
            }
        }
    );

    it(
        `Given an ended (full) game with no sealed compartments,
then the player who covered more cells is the winner.`,
        function () {
            const sealed_game = {
                "board": [
                    [1, 1, 1],
                    [1, 2, 2]
                ],
                "player": 2
            };
            if (!BoxedUp.is_ended(sealed_game)) {
                throw new Error(
                    "The box is full, so the game should be ended: " +
                    display_game(sealed_game)
                );
            }
            if (BoxedUp.winner(sealed_game) !== 1) {
                throw new Error(
                    "Player 1 covers 4 cells to player 2's 2, " +
                    `but the winner is ${BoxedUp.winner(sealed_game)}: ` +
                    display_game(sealed_game)
                );
            }
        }
    );

    it(
        `Given an ended game where both players covered equal cells,
then the game is a draw (0).`,
        function () {
            const drawn_game = {
                "board": [
                    [1, 2],
                    [2, 1]
                ],
                "player": 1
            };
            if (!BoxedUp.is_ended(drawn_game)) {
                throw new Error(
                    "A full box should be ended: " +
                    display_game(drawn_game)
                );
            }
            if (BoxedUp.winner(drawn_game) !== 0) {
                throw new Error(
                    "Both players cover 2 cells, " +
                    `but the winner is ${BoxedUp.winner(drawn_game)}: ` +
                    display_game(drawn_game)
                );
            }
        }
    );

    it(
        `Given a game that is one placement away from sealing the box,
when the current player packs that final piece,
then the game becomes ended,
and the player covering more cells wins.`,
        function () {
            const nearly_done = {
                "board": [
                    [1, 0, 0],
                    [2, 2, 1]
                ],
                "player": 1
            };
            if (BoxedUp.is_ended(nearly_done)) {
                throw new Error(
                    "The test setup should not be ended yet: " +
                    display_game(nearly_done)
                );
            }
            const sealed = BoxedUp.place(
                BoxedUp.piece_shapes.tamago,
                [0, 1],
                nearly_done
            );
            throw_if_invalid(sealed);
            if (!BoxedUp.is_ended(sealed)) {
                throw new Error(
                    "The box is full, so the game should be ended: " +
                    display_game(sealed)
                );
            }
            if (BoxedUp.winner(sealed) !== 1) {
                throw new Error(
                    "Player 1 covers 4 cells to player 2's 2, " +
                    `but the winner is ${BoxedUp.winner(sealed)}: ` +
                    display_game(sealed)
                );
            }
        }
    );
});

describe("Garnish and compartment scoring", function () {
    it(
        `Given garnish positions,
when a new game is started,
then garnish occupies exactly those cells,
counts towards neither chef's covered cells,
and may not be covered by a piece.`,
        function () {
            const game = BoxedUp.new_game(3, 3, [[1, 1]]);
            throw_if_invalid(game);
            if (game.board[1][1] !== BoxedUp.garnish_token) {
                throw new Error(
                    "The garnish cell is not marked as garnish: " +
                    display_game(game)
                );
            }
            const garnish_count = R.count(
                R.equals(BoxedUp.garnish_token),
                R.flatten(game.board)
            );
            if (garnish_count !== 1) {
                throw new Error(
                    `Expected 1 garnish cell, found ${garnish_count}: ` +
                    display_game(game)
                );
            }
            if (
                BoxedUp.cells_covered(1, game) !== 0 ||
                BoxedUp.cells_covered(2, game) !== 0
            ) {
                throw new Error(
                    "Garnish counted towards a chef's covered cells: " +
                    display_game(game)
                );
            }
            const onto_garnish = BoxedUp.place(
                BoxedUp.piece_shapes.tamago, // Covers [1, 0] and [1, 1].
                [1, 0],
                game
            );
            if (onto_garnish !== undefined) {
                throw new Error(
                    "A piece was packed on top of garnish: " +
                    display_game(onto_garnish)
                );
            }
        }
    );

    it(
        `Given a compartment with no empty cells remaining,
then it is sealed,
and owned by the chef who covered more of its cells,
who earns the compartment bonus on top of their covered cells.`,
        function () {
            const sealed_box = {
                "board": [
                    [1, 1, 2],
                    [1, 2, 2],
                    [2, 2, 2]
                ],
                "player": 1
            };
            const sealed = BoxedUp.sealed_compartments(sealed_box);
            if (
                sealed.length !== 1 ||
                !R.equals(sealed[0].origin, [0, 0]) ||
                sealed[0].owner !== 2
            ) {
                throw new Error(
                    "Expected one sealed compartment at [0, 0] " +
                    "owned by player 2, got " +
                    JSON.stringify(sealed) + ": " +
                    display_game(sealed_box)
                );
            }
            const expected = 6 + BoxedUp.compartment_bonus;
            if (BoxedUp.score(2, sealed_box) !== expected) {
                throw new Error(
                    `Player 2 should score ${expected} ` +
                    "(6 cells + 1 compartment bonus), " +
                    `but scores ${BoxedUp.score(2, sealed_box)}: ` +
                    display_game(sealed_box)
                );
            }
            if (BoxedUp.score(1, sealed_box) !== 3) {
                throw new Error(
                    "Player 1 should score 3 (3 cells, no bonus), " +
                    `but scores ${BoxedUp.score(1, sealed_box)}: ` +
                    display_game(sealed_box)
                );
            }
        }
    );

    it(
        `Given a sealed compartment covered equally by both chefs,
(garnish making up the difference),
then the compartment has no owner and awards no bonus,
so the game is a draw.`,
        function () {
            const level_box = {
                "board": [
                    [1, 3, 2],
                    [1, 3, 2],
                    [1, 3, 2]
                ],
                "player": 1
            };
            const sealed = BoxedUp.sealed_compartments(level_box);
            if (sealed.length !== 1 || sealed[0].owner !== 0) {
                throw new Error(
                    "A level compartment should have owner 0, got " +
                    JSON.stringify(sealed) + ": " +
                    display_game(level_box)
                );
            }
            if (BoxedUp.winner(level_box) !== 0) {
                throw new Error(
                    "Equal cells and no bonuses should draw, " +
                    `but the winner is ${BoxedUp.winner(level_box)}: ` +
                    display_game(level_box)
                );
            }
        }
    );

    it(
        `Given a compartment with an empty cell remaining,
then it is not sealed and awards no bonus.`,
        function () {
            const open_box = {
                "board": [
                    [1, 1, 2],
                    [1, 1, 0],
                    [2, 0, 1]
                ],
                "player": 2
            };
            const sealed = BoxedUp.sealed_compartments(open_box);
            if (sealed.length !== 0) {
                throw new Error(
                    "An unfilled compartment was reported sealed: " +
                    JSON.stringify(sealed) + ": " +
                    display_game(open_box)
                );
            }
            if (BoxedUp.score(1, open_box) !== 5) {
                throw new Error(
                    "Player 1 should score 5 (5 cells, no bonus), " +
                    `but scores ${BoxedUp.score(1, open_box)}: ` +
                    display_game(open_box)
                );
            }
        }
    );

    it(
        `Given an ended game,
a chef who covered fewer cells can still win
by owning more sealed compartments.`,
        function () {
            // A full 3-row × 7-column box: two compartments, both owned
            // by player 2, and a margin column covered by player 1.
            const ended_box = {
                "board": [
                    [1, 2, 1, 1, 2, 1, 1],
                    [2, 2, 2, 2, 2, 2, 1],
                    [1, 2, 1, 1, 2, 1, 1]
                ],
                "player": 1
            };
            if (!BoxedUp.is_ended(ended_box)) {
                throw new Error(
                    "A full box should be ended: " +
                    display_game(ended_box)
                );
            }
            const cells_1 = BoxedUp.cells_covered(1, ended_box);
            const cells_2 = BoxedUp.cells_covered(2, ended_box);
            if (!(cells_1 > cells_2)) {
                throw new Error(
                    "The test setup needs player 1 ahead on cells, " +
                    `but they have ${cells_1} to ${cells_2}: ` +
                    display_game(ended_box)
                );
            }
            if (BoxedUp.winner(ended_box) !== 2) {
                throw new Error(
                    "Player 2 owns both compartments " +
                    `(${BoxedUp.score(2, ended_box)} points to ` +
                    `${BoxedUp.score(1, ended_box)}) and should win, ` +
                    `but the winner is ${BoxedUp.winner(ended_box)}: ` +
                    display_game(ended_box)
                );
            }
        }
    );
});

describe("Golden stars and wasabi", function () {
    it(
        `Given a star cell,
when a chef's piece covers it,
then that chef alone earns the star bonus on top of their cells.`,
        function () {
            const starry = {
                "board": [
                    [1, 2],
                    [2, 1]
                ],
                "player": 1,
                "star_cells": [[0, 0]]
            };
            if (
                BoxedUp.covered_stars(1, starry) !== 1 ||
                BoxedUp.covered_stars(2, starry) !== 0
            ) {
                throw new Error(
                    "Player 1 covers the star at [0, 0], player 2 " +
                    "covers none: " + display_game(starry)
                );
            }
            const expected = 2 + BoxedUp.star_bonus;
            if (BoxedUp.score(1, starry) !== expected) {
                throw new Error(
                    `Player 1 should score ${expected} ` +
                    "(2 cells + 1 star), " +
                    `but scores ${BoxedUp.score(1, starry)}: ` +
                    display_game(starry)
                );
            }
            if (BoxedUp.score(2, starry) !== 2) {
                throw new Error(
                    "Player 2 should score 2 (2 cells, no star), " +
                    `but scores ${BoxedUp.score(2, starry)}: ` +
                    display_game(starry)
                );
            }
        }
    );

    it(
        `Given a wasabi cell,
when a chef's piece covers it,
then that chef pays the wasabi penalty.`,
        function () {
            const fiery = {
                "board": [
                    [1, 2],
                    [2, 1]
                ],
                "player": 1,
                "wasabi_cells": [[0, 1]]
            };
            if (BoxedUp.covered_wasabi(2, fiery) !== 1) {
                throw new Error(
                    "Player 2 covers the wasabi at [0, 1]: " +
                    display_game(fiery)
                );
            }
            const expected = 2 - BoxedUp.wasabi_penalty;
            if (BoxedUp.score(2, fiery) !== expected) {
                throw new Error(
                    `Player 2 should score ${expected} ` +
                    "(2 cells - 1 wasabi), " +
                    `but scores ${BoxedUp.score(2, fiery)}: ` +
                    display_game(fiery)
                );
            }
            if (BoxedUp.winner(fiery) !== 1) {
                throw new Error(
                    "The wasabi burn should hand player 1 the win, " +
                    `but the winner is ${BoxedUp.winner(fiery)}: ` +
                    display_game(fiery)
                );
            }
        }
    );

    it(
        `Given a game with star and wasabi cells,
when a ply is made,
then the special cells carry through to the next game state.`,
        function () {
            const game = BoxedUp.new_game(3, 3, [], [[0, 2]], [[2, 2]]);
            const next = BoxedUp.place(
                BoxedUp.piece_shapes.tamago,
                [0, 0],
                game
            );
            throw_if_invalid(next);
            if (
                !R.equals(next.star_cells, [[0, 2]]) ||
                !R.equals(next.wasabi_cells, [[2, 2]])
            ) {
                throw new Error(
                    "The special cells were lost by place(): " +
                    JSON.stringify({
                        "star_cells": next.star_cells,
                        "wasabi_cells": next.wasabi_cells
                    })
                );
            }
        }
    );

    it(
        `Given an ended game where both chefs covered equal cells,
then stars and wasabi swing the result.`,
        function () {
            const swung = {
                "board": [
                    [1, 1, 2],
                    [1, 2, 2]
                ],
                "player": 1,
                "star_cells": [[0, 2]],
                "wasabi_cells": [[0, 0]]
            };
            if (!BoxedUp.is_ended(swung)) {
                throw new Error(
                    "A full box should be ended: " + display_game(swung)
                );
            }
            if (BoxedUp.winner(swung) !== 2) {
                throw new Error(
                    "Equal cells, but player 2 holds the star and " +
                    "player 1 ate the wasabi, so player 2 should win. " +
                    `Winner: ${BoxedUp.winner(swung)} ` +
                    `(${BoxedUp.score(1, swung)} vs ` +
                    `${BoxedUp.score(2, swung)}): ` + display_game(swung)
                );
            }
        }
    );
});

describe("Matcha boost", function () {
    it(
        `Given a matcha cell,
when a chef's piece covers it,
then that same chef immediately takes another turn,
and the matcha carries through to the next game state.`,
        function () {
            const game = BoxedUp.new_game(3, 3, [], [], [], [[0, 0]]);
            const boosted = BoxedUp.place(
                BoxedUp.piece_shapes.umeboshi,
                [0, 0],
                game
            );
            throw_if_invalid(boosted);
            if (BoxedUp.player_to_ply(boosted) !== 1) {
                throw new Error(
                    "Covering the matcha should grant player 1 " +
                    "another turn, but the player to play is " +
                    `${BoxedUp.player_to_ply(boosted)}: ` +
                    display_game(boosted)
                );
            }
            if (!R.equals(boosted.matcha_cells, [[0, 0]])) {
                throw new Error(
                    "The matcha cells were lost by place(): " +
                    JSON.stringify(boosted.matcha_cells)
                );
            }
            const second = BoxedUp.place(
                BoxedUp.piece_shapes.umeboshi,
                [0, 1],
                boosted
            );
            throw_if_invalid(second);
            if (BoxedUp.player_to_ply(second) !== 2) {
                throw new Error(
                    "A plain follow-up ply should pass the turn " +
                    "to player 2, but the player to play is " +
                    `${BoxedUp.player_to_ply(second)}: ` +
                    display_game(second)
                );
            }
        }
    );

    it(
        `Given a matcha cell elsewhere on the board,
when a chef's piece misses it,
then the turn passes to the other chef as usual.`,
        function () {
            const game = BoxedUp.new_game(3, 3, [], [], [], [[2, 2]]);
            const next = BoxedUp.place(
                BoxedUp.piece_shapes.umeboshi,
                [0, 0],
                game
            );
            throw_if_invalid(next);
            if (BoxedUp.player_to_ply(next) !== 2) {
                throw new Error(
                    "Missing the matcha should pass the turn, " +
                    "but the player to play is " +
                    `${BoxedUp.player_to_ply(next)}: ` +
                    display_game(next)
                );
            }
        }
    );
});

describe("VIP orders and the closing bonus", function () {
    it(
        `Given a sealed compartment that is the box's VIP order,
then its owner earns the VIP bonus on top of the compartment bonus.`,
        function () {
            const vip_box = {
                "board": [
                    [1, 1, 2],
                    [1, 2, 2],
                    [2, 2, 2]
                ],
                "player": 1,
                "vip_compartment": [0, 0]
            };
            const expected = (
                6 + BoxedUp.compartment_bonus + BoxedUp.vip_bonus
            );
            if (BoxedUp.score(2, vip_box) !== expected) {
                throw new Error(
                    `Player 2 should score ${expected} ` +
                    "(6 cells + compartment + VIP bonus), " +
                    `but scores ${BoxedUp.score(2, vip_box)}: ` +
                    display_game(vip_box)
                );
            }
        }
    );

    it(
        `Given a game one piece away from a full box,
when a chef packs that final piece,
then that chef earns the closing bonus —
here turning a would-be draw into a win.`,
        function () {
            const nearly_done = {
                "board": [
                    [1, 2, 0],
                    [2, 1, 2]
                ],
                "player": 1
            };
            const sealed = BoxedUp.place(
                BoxedUp.piece_shapes.umeboshi,
                [0, 2],
                nearly_done
            );
            throw_if_invalid(sealed);
            const expected = 3 + BoxedUp.closing_bonus;
            if (BoxedUp.score(1, sealed) !== expected) {
                throw new Error(
                    `Player 1 should score ${expected} ` +
                    "(3 cells + closing bonus), " +
                    `but scores ${BoxedUp.score(1, sealed)}: ` +
                    display_game(sealed)
                );
            }
            if (BoxedUp.score(2, sealed) !== 3) {
                throw new Error(
                    "Player 2 should score 3 (no closing bonus), " +
                    `but scores ${BoxedUp.score(2, sealed)}: ` +
                    display_game(sealed)
                );
            }
            if (BoxedUp.winner(sealed) !== 1) {
                throw new Error(
                    "The closing bonus should break the tie for " +
                    `player 1, but the winner is ` +
                    `${BoxedUp.winner(sealed)}: ` + display_game(sealed)
                );
            }
        }
    );
});

describe("Fair starts", function () {
    it(
        `Given a chosen starting player,
when a new game is started,
then that chef packs the first piece.`,
        function () {
            const game = BoxedUp.new_game(
                3,
                3,
                [],
                [],
                [],
                [],
                undefined,
                2
            );
            throw_if_invalid(game);
            if (BoxedUp.player_to_ply(game) !== 2) {
                throw new Error(
                    "Player 2 was chosen to start, but the player " +
                    `to play is ${BoxedUp.player_to_ply(game)}: ` +
                    display_game(game)
                );
            }
        }
    );
});

// Reports the value actually seen on failure, so a broken
// implementation is pinpointed rather than merely flagged.
const report = function (label, actual, expected, game) {
    if (!R.equals(actual, expected)) {
        throw new Error(
            `${label}: expected ${JSON.stringify(expected)}, ` +
            `but got ${JSON.stringify(actual)}.` + display_game(game)
        );
    }
};

describe("Pieces still available to pack", function () {
    it(
        `Given a fresh, empty box,
when the available pieces are listed,
then every piece on the menu can still be packed.`,
        function () {
            const game = BoxedUp.new_game();
            report(
                "Available pieces on an empty box",
                BoxedUp.available_pieces(game),
                Object.keys(BoxedUp.piece_shapes),
                game
            );
        }
    );

    it(
        `Given a box whose only empty cells are isolated singles,
when the available pieces are listed,
then only the one-cell umeboshi remains, and the game is not ended.`,
        function () {
            const game = {
                "board": [
                    [1, 0, 2],
                    [0, 1, 0],
                    [2, 0, 1]
                ],
                "player": 2
            };
            report(
                "Available pieces among isolated singles",
                BoxedUp.available_pieces(game),
                ["umeboshi"],
                game
            );
            if (BoxedUp.is_ended(game)) {
                throw new Error(
                    "The umeboshi still fits, so the game is not ended, " +
                    "yet is_ended reported true: " + display_game(game)
                );
            }
        }
    );

    it(
        `Given a completely packed box,
when the available pieces are listed,
then none remain, agreeing with is_ended.`,
        function () {
            const game = {
                "board": [
                    [1, 2],
                    [2, 1]
                ],
                "player": 1
            };
            report(
                "Available pieces on a full box",
                BoxedUp.available_pieces(game),
                [],
                game
            );
            if (!BoxedUp.is_ended(game)) {
                throw new Error(
                    "No piece fits, so the game should be ended: " +
                    display_game(game)
                );
            }
        }
    );
});

describe("The current leader", function () {
    it(
        `Given a game in progress where one chef has covered more,
when the leader is checked,
then it names that chef even though there is no winner yet.`,
        function () {
            const game = {
                "board": [
                    [1, 1, 0],
                    [0, 0, 0],
                    [0, 0, 0]
                ],
                "player": 2
            };
            report(
                "Leader while ahead in progress",
                BoxedUp.leader(game),
                1,
                game
            );
            if (BoxedUp.winner(game) !== undefined) {
                throw new Error(
                    "The game has not ended, so there is no winner yet, " +
                    `but winner returned ${BoxedUp.winner(game)}: ` +
                    display_game(game)
                );
            }
        }
    );

    it(
        `Given a game where both chefs have equal scores,
when the leader is checked,
then it reports a tie (0).`,
        function () {
            const game = {
                "board": [
                    [1, 2, 0],
                    [0, 0, 0],
                    [0, 0, 0]
                ],
                "player": 1
            };
            report("Leader when level", BoxedUp.leader(game), 0, game);
        }
    );

    it(
        `Given a game where chef 2 has covered more,
when the leader is checked,
then it names chef 2.`,
        function () {
            const game = {
                "board": [
                    [2, 2, 1],
                    [0, 0, 0],
                    [0, 0, 0]
                ],
                "player": 1
            };
            report("Leader when chef 2 ahead", BoxedUp.leader(game), 2, game);
        }
    );
});

describe("Empty cells remaining", function () {
    it(
        `Given a fresh, empty box,
when the empty cells are counted,
then every cell of the box is empty.`,
        function () {
            report(
                "Empty cells on a fresh 9x9 box",
                BoxedUp.empty_cells(BoxedUp.new_game()),
                81
            );
        }
    );

    it(
        `Given a box that starts with some garnish,
when the empty cells are counted,
then the garnish cells are not counted as empty.`,
        function () {
            const game = BoxedUp.new_game(3, 3, [[0, 0], [1, 1]]);
            report(
                "Empty cells with two garnish",
                BoxedUp.empty_cells(game),
                7,
                game
            );
        }
    );

    it(
        `Given a completely packed box,
when the empty cells are counted,
then none remain.`,
        function () {
            const game = {
                "board": [
                    [1, 2],
                    [2, 1]
                ],
                "player": 1
            };
            report(
                "Empty cells on a full box",
                BoxedUp.empty_cells(game),
                0,
                game
            );
        }
    );
});

describe("Points a ply would gain", function () {
    it(
        `Given a one-cell ply onto a golden star,
when its gain is measured,
then it is the covered cell plus the star bonus.`,
        function () {
            const game = BoxedUp.new_game(9, 9, [], [[0, 0]]);
            report(
                "Gain from packing onto a star",
                BoxedUp.score_gain(BoxedUp.piece_shapes.umeboshi, [0, 0], game),
                1 + BoxedUp.star_bonus,
                game
            );
        }
    );

    it(
        `Given a one-cell ply onto a wasabi cell,
when its gain is measured,
then the burn makes the gain negative.`,
        function () {
            const game = BoxedUp.new_game(9, 9, [], [], [[0, 0]]);
            report(
                "Gain from packing onto wasabi",
                BoxedUp.score_gain(BoxedUp.piece_shapes.umeboshi, [0, 0], game),
                1 - BoxedUp.wasabi_penalty,
                game
            );
        }
    );

    it(
        `Given a ply that is not legal (off the board),
when its gain is measured,
then it gains nothing.`,
        function () {
            const game = BoxedUp.new_game(3, 3);
            report(
                "Gain from an illegal ply",
                BoxedUp.score_gain(BoxedUp.piece_shapes.umeboshi, [9, 9], game),
                0,
                game
            );
        }
    );
});
