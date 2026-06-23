import R from "./ramda.js";
/**
 * BoxedUp.js is a module to model and play "Boxed Up".
 * Boxed Up is a turn-based game for two players (chefs),
 * who take turns packing food-shaped pieces into a shared box.
 * Pieces may be rotated, and may only cover empty cells of the box.
 * Some cells hold garnish from the start; garnish may never be covered.
 * A few cells are special: golden star cells reward whoever covers
 * them, wasabi cells burn points from whoever covers them, and a
 * matcha cell grants the chef who covers it another turn at once.
 * The box is divided into 3×3 compartments; one of them may be the
 * VIP order, which is worth extra when sealed, and the chef who
 * packs the final piece earns a small closing bonus.
 * When a compartment is fully covered it is sealed,
 * and the chef with more food in it earns a bonus.
 * When the chef to move cannot fit any piece anywhere in the box,
 * the box is sealed and the chef with the higher score wins.
 * @namespace BoxedUp
 * @author Leo
 * @version 2025/26
 */
const BoxedUp = Object.create(null);

/**
 * A Board is the rectangular grid of cells that pieces are packed into.
 * It is implemented as an array of rows of cells.
 * @memberof BoxedUp
 * @typedef {BoxedUp.Cell[][]} Board
 */

/**
 * A Player token marks a cell covered by one of that player's pieces.
 * Player 1 packs first unless {@link BoxedUp.new_game} is given a
 * different starting player.
 * @memberof BoxedUp
 * @typedef {(1 | 2)} Player
 */

/**
 * A Cell of the board is either empty (`0`),
 * covered by a player's piece (`1` or `2`),
 * or holds garnish (`3`, see {@link BoxedUp.garnish_token}),
 * which belongs to neither player and may never be covered.
 * @memberof BoxedUp
 * @typedef {(0 | BoxedUp.Player | 3)} Cell
 */

/**
 * A Position picks out a single cell of the board.
 * It is a [row, column] pair of zero-based indices.
 * Row 0 is the top of the board; column 0 is its left edge.
 * @memberof BoxedUp
 * @typedef {number[]} Position
 */

/**
 * A Shape is the footprint of a piece:
 * an array of [row, column] offsets from the piece's anchor cell,
 * which is the position the piece is placed at.
 * The shapes of the standard pieces are listed in
 * {@link BoxedUp.piece_shapes}, and may be rotated with
 * {@link BoxedUp.rotated_shape}.
 * @memberof BoxedUp
 * @typedef {number[][]} Shape
 */

/**
 * A Game records everything needed to continue a game of Boxed Up:
 * the contents of the box, and which player packs next.
 * Game objects are never mutated;
 * {@link BoxedUp.place} returns a new game object.
 * @memberof BoxedUp
 * @typedef {Object} Game
 * @property {BoxedUp.Board} board The current contents of the box.
 * @property {BoxedUp.Player} player The player whose turn it is.
 * @property {BoxedUp.Position[]} [star_cells] Golden cells that award
 *   {@link BoxedUp.star_bonus} to whoever covers them.
 * @property {BoxedUp.Position[]} [wasabi_cells] Fiery cells that cost
 *   {@link BoxedUp.wasabi_penalty} to whoever covers them.
 * @property {BoxedUp.Position[]} [matcha_cells] Energising cells that
 *   grant whoever covers them an immediate extra turn.
 * @property {BoxedUp.Position} [vip_compartment] The origin of the
 *   compartment that is this box's VIP order, worth
 *   {@link BoxedUp.vip_bonus} extra to its owner when sealed.
 * @property {BoxedUp.Player} [last_player] The chef who made the most
 *   recent ply, who earns {@link BoxedUp.closing_bonus} if their piece
 *   finished the box.
 */

/**
 * A Compartment is one 3×3 section of the box,
 * aligned to multiples of three from the top-left corner.
 * Boards whose width or height is not a multiple of three have
 * margin cells that belong to no compartment.
 * @memberof BoxedUp
 * @typedef {Object} Compartment
 * @property {BoxedUp.Position} origin The compartment's top-left cell.
 * @property {BoxedUp.Position[]} cells The nine cells of the compartment.
 */

/**
 * The menu of pieces that either chef may pack on their turn.
 * Each piece has a {@link BoxedUp.Shape} given in its unrotated orientation.
 * @memberof BoxedUp
 * @enum {BoxedUp.Shape}
 * @property {BoxedUp.Shape} tamago A 1×2 slice of rolled egg.
 * @property {BoxedUp.Shape} cucumber A 1×3 stick of cucumber.
 * @property {BoxedUp.Shape} onigiri A triangular rice ball:
 * an upside-down T of four cells.
 * @property {BoxedUp.Shape} rice A 2×2 block of steamed rice.
 * @property {BoxedUp.Shape} salmon A 1×4 fillet of salmon.
 * @property {BoxedUp.Shape} tempura An L-shaped cluster of tempura
 * (three cells).
 * @property {BoxedUp.Shape} umeboshi A single pickled plum (one cell).
 */
BoxedUp.piece_shapes = Object.freeze({
    "cucumber": [[0, 0], [0, 1], [0, 2]],
    "onigiri": [[0, 1], [1, 0], [1, 1], [1, 2]],
    "rice": [[0, 0], [0, 1], [1, 0], [1, 1]],
    "salmon": [[0, 0], [0, 1], [0, 2], [0, 3]],
    "tamago": [[0, 0], [0, 1]],
    "tempura": [[0, 0], [0, 1], [1, 0]],
    "umeboshi": [[0, 0]]
});

/**
 * The cell value marking garnish: decoration already in the box when a
 * game begins. Garnish belongs to neither player, may never be covered,
 * but does count towards sealing a compartment.
 * @memberof BoxedUp
 * @constant {number}
 */
BoxedUp.garnish_token = 3;

/**
 * The points a chef earns for each sealed compartment they own,
 * on top of one point per covered cell.
 * See {@link BoxedUp.sealed_compartments} and {@link BoxedUp.score}.
 * @memberof BoxedUp
 * @constant {number}
 */
BoxedUp.compartment_bonus = 5;

/**
 * The points a chef earns for covering a golden star cell.
 * See {@link BoxedUp.covered_stars} and {@link BoxedUp.score}.
 * @memberof BoxedUp
 * @constant {number}
 */
BoxedUp.star_bonus = 3;

/**
 * The points a chef loses for covering a wasabi cell.
 * Sometimes the burn is worth it to steal a compartment!
 * See {@link BoxedUp.covered_wasabi} and {@link BoxedUp.score}.
 * @memberof BoxedUp
 * @constant {number}
 */
BoxedUp.wasabi_penalty = 3;

/**
 * The extra points (on top of {@link BoxedUp.compartment_bonus}) that
 * the owner of the VIP order compartment earns when it is sealed.
 * @memberof BoxedUp
 * @constant {number}
 */
BoxedUp.vip_bonus = 5;

/**
 * The points the chef who packs the final piece of the box earns
 * for closing the lid.
 * @memberof BoxedUp
 * @constant {number}
 */
BoxedUp.closing_bonus = 2;

/**
 * A set of template token strings for
 * {@link BoxedUp.to_string_with_tokens}.
 * @memberof BoxedUp
 * @enum {string[]}
 * @property {string[]} default ["0", "1", "2", "3"]
 * Displays cells by their value.
 * @property {string[]} food ["⬜", "🍣", "🍙", "🍥"]
 * Displays player pieces and garnish as food in the box.
 */
BoxedUp.token_strings = Object.freeze({
    "default": ["0", "1", "2", "3"],
    "food": ["⬜", "🍣", "🍙", "🍥"]
});

/**
 * Create a new empty board.
 * Optionally with a specified width and height,
 * otherwise returns a standard 9 wide, 9 high board.
 * @memberof BoxedUp
 * @function
 * @param {number} [width = 9] The width of the new board.
 * @param {number} [height = 9] The height of the new board.
 * @returns {BoxedUp.Board} An empty board.
 */
BoxedUp.empty_board = function (width = 9, height = 9) {
    return R.repeat(R.repeat(0, width), height);
};

/**
 * This helper writes a token into one cell of a board,
 * returning a new board.
 * @function
 * @param {BoxedUp.Cell} token The token to write.
 * @returns {function} Reducer from a board and a position to a new board.
 */
const fill_cell = function (token) {
    return function (board, [row, column]) {
        return R.update(
            row,
            R.update(column, token, board[row]),
            board
        );
    };
};

/**
 * Create a new game, ready for the first ply.
 * The box starts empty, except for any garnish, and player 1 packs
 * first. Optionally provide a width and height for the box,
 * otherwise a standard 9×9 box is used.
 * @memberof BoxedUp
 * @function
 * @param {number} [width = 9] The width of the box.
 * @param {number} [height = 9] The height of the box.
 * @param {BoxedUp.Position[]} [garnish_cells = []] Cells that start the
 *   game holding garnish, which may never be covered.
 * @param {BoxedUp.Position[]} [star_cells = []] Empty cells holding a
 *   golden star. Garnish, star, and wasabi cells must not overlap.
 * @param {BoxedUp.Position[]} [wasabi_cells = []] Empty cells holding
 *   a dab of wasabi.
 * @param {BoxedUp.Position[]} [matcha_cells = []] Empty cells holding
 *   a bowl of matcha. Special cells must not overlap.
 * @param {BoxedUp.Position} [vip_compartment] The origin of the
 *   compartment serving as this box's VIP order, if any.
 * @param {BoxedUp.Player} [starting_player = 1] The chef who packs the
 *   first piece of this box — alternate it between games for
 *   fairness, since packing first means first pick of the specials.
 * @returns {BoxedUp.Game} A new game.
 */
BoxedUp.new_game = function (
    width = 9,
    height = 9,
    garnish_cells = [],
    star_cells = [],
    wasabi_cells = [],
    matcha_cells = [],
    vip_compartment = undefined,
    starting_player = 1
) {
    return {
        "board": garnish_cells.reduce(
            fill_cell(BoxedUp.garnish_token),
            BoxedUp.empty_board(width, height)
        ),
        "player": starting_player,
        "star_cells": star_cells,
        "wasabi_cells": wasabi_cells,
        "matcha_cells": matcha_cells,
        "vip_compartment": vip_compartment
    };
};

/**
 * Returns which player is next to pack a piece into the box.
 * @memberof BoxedUp
 * @function
 * @param {BoxedUp.Game} game The game to check.
 * @returns {BoxedUp.Player} The player next to play.
 */
BoxedUp.player_to_ply = function (game) {
    return game.player;
};

/**
 * Returns the size of a board as an array of [width, height].
 * @memberof BoxedUp
 * @function
 * @param {BoxedUp.Board} board The board to check the size of.
 * @returns {number[]} The width and height of the board, [width, height].
 */
BoxedUp.size = function (board) {
    return [board[0].length, board.length];
};

/**
 * This helper shifts a shape so its offsets are relative to [0, 0],
 * and sorts them, giving each shape one canonical form.
 * @function
 * @param {BoxedUp.Shape} shape The shape to normalise.
 * @returns {BoxedUp.Shape} The normalised shape.
 */
const normalised = function (shape) {
    const min_row = R.reduce(R.min, Infinity, shape.map(R.head));
    const min_column = R.reduce(R.min, Infinity, shape.map(R.last));
    return R.sortWith(
        [R.ascend(R.head), R.ascend(R.last)],
        shape.map(function ([row, column]) {
            return [row - min_row, column - min_column];
        })
    );
};

/**
 * Returns a shape rotated a quarter turn clockwise.
 * The returned shape is normalised,
 * i.e. its offsets are relative to its own top-left corner.
 * @memberof BoxedUp
 * @function
 * @param {BoxedUp.Shape} shape The shape to rotate.
 * @returns {BoxedUp.Shape} The rotated shape.
 */
BoxedUp.rotated_shape = function (shape) {
    return normalised(shape.map(function ([row, column]) {
        return [column, -row];
    }));
};

/**
 * Returns all distinct orientations of a shape,
 * i.e. its unique quarter-turn rotations.
 * Symmetric shapes have fewer than four distinct orientations.
 * @memberof BoxedUp
 * @function
 * @param {BoxedUp.Shape} shape The shape to rotate.
 * @returns {BoxedUp.Shape[]} An array of distinct orientations of the shape.
 */
BoxedUp.orientations = function (shape) {
    const quarter_turns = R.range(0, 4).reduce(
        (rotations) => R.append(
            BoxedUp.rotated_shape(R.last(rotations)),
            rotations
        ),
        [normalised(shape)]
    );
    return R.uniq(R.take(4, quarter_turns));
};

/**
 * Returns the coordinates of the cells a shape would cover
 * when placed with its anchor at a given position.
 * @memberof BoxedUp
 * @function
 * @param {BoxedUp.Shape} shape The shape being placed.
 * @param {BoxedUp.Position} position The position of the shape's anchor.
 * @returns {BoxedUp.Position[]} The cells the placed shape would cover.
 */
BoxedUp.placement_cells = function (shape, position) {
    const [row, column] = position;
    return shape.map(function ([row_offset, column_offset]) {
        return [row + row_offset, column + column_offset];
    });
};

/**
 * Returns whether a shape may be packed at a position on a board.
 * A placement is legal if every cell the shape would cover
 * lies inside the board and is currently empty.
 * Cells holding pieces or garnish may not be covered.
 * @memberof BoxedUp
 * @function
 * @param {BoxedUp.Shape} shape The shape being placed.
 * @param {BoxedUp.Position} position The position of the shape's anchor.
 * @param {BoxedUp.Board} board The board to place the shape on.
 * @returns {boolean} Whether the placement is legal.
 */
BoxedUp.is_legal_placement = function (shape, position, board) {
    return BoxedUp.placement_cells(shape, position).every(
        function ([row, column]) {
            return (
                board[row] !== undefined &&
                board[row][column] === 0
            );
        }
    );
};

/**
 * This helper returns every position on a board.
 * @function
 * @param {BoxedUp.Board} board The board.
 * @returns {BoxedUp.Position[]} All [row, column] positions on the board.
 */
const all_positions = function (board) {
    const [width, height] = BoxedUp.size(board);
    return R.xprod(R.range(0, height), R.range(0, width));
};

/**
 * Returns all the positions at which a shape may legally be packed.
 * @memberof BoxedUp
 * @function
 * @param {BoxedUp.Shape} shape The shape being placed.
 * @param {BoxedUp.Board} board The board to place the shape on.
 * @returns {BoxedUp.Position[]} The legal anchor positions for the shape.
 */
BoxedUp.legal_placements = function (shape, board) {
    return all_positions(board).filter(
        (position) => BoxedUp.is_legal_placement(shape, position, board)
    );
};

/**
 * The distinct orientations of every menu piece, computed once.
 * The menu of {@link BoxedUp.piece_shapes} is fixed, so a piece's
 * orientations never change; precomputing them keeps the hot paths
 * ({@link BoxedUp.is_ended}, {@link BoxedUp.available_pieces}) from
 * re-deriving rotations on every call.
 * @constant {Object.<string, BoxedUp.Shape[]>}
 */
const menu_orientations = R.map(BoxedUp.orientations, BoxedUp.piece_shapes);

/**
 * This helper returns whether any of a list of shape orientations
 * fits at any of the given positions on a board. It stops at the
 * first fit, and reuses one precomputed list of positions.
 * @function
 * @param {BoxedUp.Shape[]} orientations The orientations to try.
 * @param {BoxedUp.Position[]} positions The positions to try them at.
 * @param {BoxedUp.Board} board The board to place on.
 * @returns {boolean} Whether some orientation fits at some position.
 */
const fits_any = function (orientations, positions, board) {
    return orientations.some(
        (orientation) => positions.some(
            (position) => BoxedUp.is_legal_placement(
                orientation,
                position,
                board
            )
        )
    );
};

/**
 * Returns whether a game has ended.
 * A game ends when the player to move cannot pack any piece from
 * {@link BoxedUp.piece_shapes}, in any orientation, anywhere in the box.
 * Both players choose from the same menu of pieces,
 * so this depends only on the contents of the box.
 * Since the umeboshi covers a single cell, the game ends exactly
 * when every cell of the box is covered.
 * @memberof BoxedUp
 * @function
 * @param {BoxedUp.Game} game The game to test.
 * @returns {boolean} Whether the game has ended.
 */
BoxedUp.is_ended = function (game) {
    const positions = all_positions(game.board);
    return !R.values(menu_orientations).some(
        (orientations) => fits_any(orientations, positions, game.board)
    );
};

/**
 * Returns the names of the menu pieces that can still be packed
 * somewhere in the box, in at least one orientation.
 * This is the menu a chef can actually choose from on their turn:
 * a game has ended (see {@link BoxedUp.is_ended}) exactly when no
 * pieces remain available.
 * @memberof BoxedUp
 * @function
 * @param {BoxedUp.Game} game The game to inspect.
 * @returns {string[]} The names of the pieces that still fit,
 *   drawn from the keys of {@link BoxedUp.piece_shapes}.
 */
BoxedUp.available_pieces = function (game) {
    const positions = all_positions(game.board);
    return R.keys(BoxedUp.piece_shapes).filter(
        (name) => fits_any(menu_orientations[name], positions, game.board)
    );
};

/**
 * Returns how many cells of the box are still empty: cells holding
 * neither a piece nor garnish, and so open to be packed. A measure
 * of how much room is left in the box.
 * @memberof BoxedUp
 * @function
 * @param {BoxedUp.Game} game The game to inspect.
 * @returns {number} The number of empty cells remaining.
 */
BoxedUp.empty_cells = function (game) {
    return R.count(R.equals(0), R.flatten(game.board));
};

/**
 * This helper builds the 3×3 square of offsets used by compartments.
 * @constant {BoxedUp.Shape}
 */
const compartment_square = R.xprod(R.range(0, 3), R.range(0, 3));

/**
 * Returns the compartments of a board:
 * its 3×3 sections, aligned to multiples of three from the top-left.
 * @memberof BoxedUp
 * @function
 * @param {BoxedUp.Board} board The board to divide up.
 * @returns {BoxedUp.Compartment[]} The board's compartments.
 */
BoxedUp.compartments = function (board) {
    const [width, height] = BoxedUp.size(board);
    const starts = (limit) => R.map(
        R.multiply(3),
        R.range(0, Math.floor(limit / 3))
    );
    return R.xprod(starts(height), starts(width)).map(function (origin) {
        return {
            "origin": origin,
            "cells": BoxedUp.placement_cells(compartment_square, origin)
        };
    });
};

/**
 * This helper decides who owns a fully covered compartment:
 * the player with more cells in it, or `0` if they are level.
 * @function
 * @param {BoxedUp.Board} board The board the compartment belongs to.
 * @returns {function} From a compartment to its owner.
 */
const compartment_owner = function (board) {
    return function (compartment) {
        const tokens = compartment.cells.map(function ([row, column]) {
            return board[row][column];
        });
        const count_1 = R.count(R.equals(1), tokens);
        const count_2 = R.count(R.equals(2), tokens);
        if (count_1 === count_2) {
            return 0;
        }
        return (
            count_1 > count_2
            ? 1
            : 2
        );
    };
};

/**
 * Returns the sealed compartments of a game, with their owners.
 * A compartment is sealed when none of its cells remain empty.
 * Its owner is the player whose pieces cover more of its cells
 * (garnish counts to neither player);
 * if they cover it equally, the owner is `0` and
 * nobody earns its bonus.
 * @memberof BoxedUp
 * @function
 * @param {BoxedUp.Game} game The game to check.
 * @returns {Object[]} An array of {origin, owner} records,
 *   one per sealed compartment.
 */
BoxedUp.sealed_compartments = function (game) {
    return BoxedUp.compartments(game.board).filter(
        (compartment) => compartment.cells.every(function ([row, column]) {
            return game.board[row][column] !== 0;
        })
    ).map(function (compartment) {
        return {
            "origin": compartment.origin,
            "owner": compartment_owner(game.board)(compartment)
        };
    });
};

/**
 * Returns the number of cells of the box covered by a player's pieces.
 * Garnish counts to neither player.
 * @memberof BoxedUp
 * @function
 * @param {BoxedUp.Player} player The player whose cells to count.
 * @param {BoxedUp.Game} game The game to count cells in.
 * @returns {number} The number of cells the player has covered.
 */
BoxedUp.cells_covered = function (player, game) {
    return R.count(R.equals(player), R.flatten(game.board));
};

/**
 * This helper counts how many of the given special cells are covered
 * by a player's pieces.
 * @function
 * @param {BoxedUp.Player} player The player whose pieces to look for.
 * @param {BoxedUp.Board} board The board to inspect.
 * @param {BoxedUp.Position[]} positions The special cells to check.
 * @returns {number} How many of those cells the player covers.
 */
const covered_specials = function (player, board, positions) {
    const cells = positions || [];
    return cells.filter(function ([row, column]) {
        return board[row][column] === player;
    }).length;
};

/**
 * Returns how many golden star cells a player has covered.
 * @memberof BoxedUp
 * @function
 * @param {BoxedUp.Player} player The player to count stars for.
 * @param {BoxedUp.Game} game The game to inspect.
 * @returns {number} The number of stars the player covers.
 */
BoxedUp.covered_stars = function (player, game) {
    return covered_specials(player, game.board, game.star_cells);
};

/**
 * Returns how many wasabi cells a player has covered.
 * @memberof BoxedUp
 * @function
 * @param {BoxedUp.Player} player The player to count wasabi for.
 * @param {BoxedUp.Game} game The game to inspect.
 * @returns {number} The number of wasabi cells the player covers.
 */
BoxedUp.covered_wasabi = function (player, game) {
    return covered_specials(player, game.board, game.wasabi_cells);
};

/**
 * Returns a player's score:
 * one point per covered cell,
 * plus {@link BoxedUp.compartment_bonus} per sealed compartment owned
 * (plus {@link BoxedUp.vip_bonus} more if it is the VIP order),
 * plus {@link BoxedUp.star_bonus} per covered golden star,
 * minus {@link BoxedUp.wasabi_penalty} per covered wasabi cell,
 * plus {@link BoxedUp.closing_bonus} if the game has ended and this
 * player packed the final piece.
 * @memberof BoxedUp
 * @function
 * @param {BoxedUp.Player} player The player whose score to compute.
 * @param {BoxedUp.Game} game The game to score.
 * @returns {number} The player's score.
 */
BoxedUp.score = function (player, game) {
    const owned = BoxedUp.sealed_compartments(game).filter(
        (sealed) => sealed.owner === player
    );
    const compartment_points = owned.reduce(function (total, sealed) {
        return total + BoxedUp.compartment_bonus + (
            R.equals(sealed.origin, game.vip_compartment)
            ? BoxedUp.vip_bonus
            : 0
        );
    }, 0);
    const closing = (
        (game.last_player === player && BoxedUp.is_ended(game))
        ? BoxedUp.closing_bonus
        : 0
    );
    return (
        BoxedUp.cells_covered(player, game) +
        compartment_points +
        BoxedUp.star_bonus * BoxedUp.covered_stars(player, game) -
        BoxedUp.wasabi_penalty * BoxedUp.covered_wasabi(player, game) +
        closing
    );
};

/**
 * Returns which player is currently ahead on {@link BoxedUp.score},
 * whether or not the game has ended:
 * the player with the higher score, or `0` if the scores are level.
 * Unlike {@link BoxedUp.winner}, this reports the standing of a game
 * still in progress — useful, for example, to decide the result of a
 * box whose play was cut short.
 * @memberof BoxedUp
 * @function
 * @param {BoxedUp.Game} game The game to check.
 * @returns {(BoxedUp.Player | 0)} The player ahead, or `0` for a tie.
 */
BoxedUp.leader = function (game) {
    const score_1 = BoxedUp.score(1, game);
    const score_2 = BoxedUp.score(2, game);
    if (score_1 === score_2) {
        return 0;
    }
    return (
        score_1 > score_2
        ? 1
        : 2
    );
};

/**
 * Returns the winner of an ended game.
 * The winner is the player with the higher {@link BoxedUp.score}
 * (i.e. the {@link BoxedUp.leader}).
 * If both players have the same score,
 * the game is a draw, signified by `0`.
 * @memberof BoxedUp
 * @function
 * @param {BoxedUp.Game} game The game to check for a winner.
 * @returns {(BoxedUp.Player | 0 | undefined)} The winning player,
 *   `0` for a draw, or `undefined` if the game has not ended.
 */
BoxedUp.winner = function (game) {
    return (
        BoxedUp.is_ended(game)
        ? BoxedUp.leader(game)
        : undefined
    );
};

/**
 * A ply is one turn taken by one of the players:
 * the current player packs one piece, in a chosen orientation,
 * into the box at a chosen position.
 * Returns a new game with the piece packed and the other player to
 * play — unless the piece covered a matcha cell, in which case the
 * energised chef immediately takes another turn.
 * @memberof BoxedUp
 * @function
 * @param {BoxedUp.Shape} shape The shape of the piece being packed,
 *   one of {@link BoxedUp.piece_shapes} or a rotation of one.
 * @param {BoxedUp.Position} position The position of the shape's anchor.
 * @param {BoxedUp.Game} game The game state that the ply is made on.
 * @returns {(BoxedUp.Game | undefined)} If the ply was legal,
 *   return the new game state, otherwise return `undefined`.
 */
BoxedUp.place = function (shape, position, game) {
    if (BoxedUp.is_ended(game)) {
        return undefined;
    }
    if (!BoxedUp.is_legal_placement(shape, position, game.board)) {
        return undefined;
    }
    const covered = BoxedUp.placement_cells(shape, position);
    const matcha_cells = game.matcha_cells || [];
    const extra_turn = covered.some(
        (cell) => R.includes(cell, matcha_cells)
    );
    return {
        "board": covered.reduce(fill_cell(game.player), game.board),
        "player": (
            extra_turn
            ? game.player
            : 3 - game.player
        ),
        "star_cells": game.star_cells,
        "wasabi_cells": game.wasabi_cells,
        "matcha_cells": game.matcha_cells,
        "vip_compartment": game.vip_compartment,
        "last_player": game.player
    };
};

/**
 * Returns how many points the player to move would gain by packing a
 * shape at a position: the change in their {@link BoxedUp.score} once
 * the ply is made. A ply that is not legal gains nothing, so this
 * returns `0` for it. Lets a chef weigh a move before committing.
 * @memberof BoxedUp
 * @function
 * @param {BoxedUp.Shape} shape The shape being placed.
 * @param {BoxedUp.Position} position The position of the shape's anchor.
 * @param {BoxedUp.Game} game The game the ply would be made on.
 * @returns {number} The points the player to move would gain.
 */
BoxedUp.score_gain = function (shape, position, game) {
    const after = BoxedUp.place(shape, position, game);
    if (after === undefined) {
        return 0;
    }
    return BoxedUp.score(game.player, after) - BoxedUp.score(game.player, game);
};

/**
 * Returns a {@link BoxedUp.to_string} like function,
 * mapping tokens to provided string representations.
 * @memberof BoxedUp
 * @function
 * @param {string[]} token_strings
 * Strings to represent tokens as. Examples are given in
 * {@link BoxedUp.token_strings}.
 * @returns {function} The string representation.
 */
BoxedUp.to_string_with_tokens = (token_strings) => (board) => R.pipe(
    R.map(R.map((token) => token_strings[token] || token)),
    R.map(R.join(" ")), // Add a space between each cell.
    R.join("\n") // Stack rows atop each other.
)(board);

/**
 * Returns a string representation of a board.
 * I.e. for printing to the console rather than serialisation.
 * @memberof BoxedUp
 * @function
 * @param {BoxedUp.Board} board The board to represent.
 * @returns {string} The string representation.
 */
BoxedUp.to_string = BoxedUp.to_string_with_tokens(["0", "1", "2", "3"]);

export default Object.freeze(BoxedUp);
