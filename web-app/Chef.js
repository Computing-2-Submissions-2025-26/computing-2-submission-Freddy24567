import BoxedUp from "./BoxedUp.js";
/**
 * Chef.js provides computer opponents ("chefs") for Boxed Up.
 * A computer chef examines a game using only the public {@link BoxedUp}
 * API and proposes a ply for the player to move, at one of three
 * skill levels. Chefs are deterministic and pure:
 * the same game always gets the same proposal.
 * @namespace Chef
 * @author Leo
 * @version 2025/26
 */
const Chef = Object.create(null);

/**
 * A Ply is one proposed turn: which piece to pack,
 * in which orientation, and where.
 * @memberof Chef
 * @typedef {Object} Ply
 * @property {string} name The name of the piece,
 *   a key of {@link BoxedUp.piece_shapes}.
 * @property {BoxedUp.Shape} shape The chosen orientation of the piece.
 * @property {BoxedUp.Position} position The anchor position to pack at.
 */

/**
 * The skill levels a computer chef can play at.
 * @memberof Chef
 * @enum {number}
 * @property {number} apprentice 1 —
 * Packs the smallest piece that fits, in the first free spot.
 * @property {number} cook 2 —
 * Packs the largest piece that fits, claiming cells quickly.
 * @property {number} head_chef 3 —
 * Packs the ply that most improves its score lead,
 * fighting for compartment bonuses.
 */
Chef.levels = Object.freeze({
    "apprentice": 1,
    "cook": 2,
    "head_chef": 3
});

/**
 * Returns every legal ply available to the player to move:
 * each piece from the menu, in each orientation,
 * at each position where it may be packed.
 * @memberof Chef
 * @function
 * @param {BoxedUp.Game} game The game to examine.
 * @returns {Chef.Ply[]} All legal plies, in a stable order.
 */
Chef.legal_plies = function (game) {
    return Object.entries(BoxedUp.piece_shapes).flatMap(
        function ([name, base_shape]) {
            return BoxedUp.orientations(base_shape).flatMap(
                (shape) => BoxedUp.legal_placements(
                    shape,
                    game.board
                ).map((position) => ({name, position, shape}))
            );
        }
    );
};

/**
 * This helper folds a list to its first maximal element:
 * later elements only replace the current best if strictly better,
 * keeping the chef deterministic.
 * @function
 * @param {function} is_better Whether the first argument beats
 *   the second.
 * @param {Array} list The (non-empty) list to fold.
 * @returns The first maximal element.
 */
const first_best = function (is_better, list) {
    return list.reduce(function (best, candidate) {
        return (
            is_better(candidate, best)
            ? candidate
            : best
        );
    });
};

/**
 * This helper scores a ply for the head chef:
 * the chef's score lead over its opponent after making the ply,
 * including any compartment bonuses gained or conceded.
 * @function
 * @param {BoxedUp.Game} game The game the ply is made on.
 * @returns {function} From a ply to its resulting score lead.
 */
const lead_after = function (game) {
    const player = BoxedUp.player_to_ply(game);
    return function (ply) {
        const next = BoxedUp.place(ply.shape, ply.position, game);
        return (
            BoxedUp.score(player, next) -
            BoxedUp.score(3 - player, next)
        );
    };
};

/**
 * Proposes a ply for the player to move, at the given skill level.
 * Returns `undefined` if the game has already ended.
 * The proposal is always a legal ply;
 * pass it to {@link BoxedUp.place} to make the move.
 * @memberof Chef
 * @function
 * @param {number} level A skill level from {@link Chef.levels}.
 * @param {BoxedUp.Game} game The game to propose a ply for.
 * @returns {(Chef.Ply | undefined)} The proposed ply,
 *   or `undefined` if no ply is possible.
 */
Chef.choose_ply = function (level, game) {
    if (BoxedUp.is_ended(game)) {
        return undefined;
    }
    const plies = Chef.legal_plies(game);
    if (level === Chef.levels.apprentice) {
        return first_best(
            (a, b) => a.shape.length < b.shape.length,
            plies
        );
    }
    if (level === Chef.levels.cook) {
        return first_best(
            (a, b) => a.shape.length > b.shape.length,
            plies
        );
    }
    const lead = lead_after(game);
    return first_best(
        (a, b) => a.lead > b.lead,
        plies.map((ply) => ({"lead": lead(ply), ply}))
    ).ply;
};

export default Object.freeze(Chef);
