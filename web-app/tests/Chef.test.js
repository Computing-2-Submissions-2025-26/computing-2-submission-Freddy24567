import BoxedUp from "../BoxedUp.js";
import Chef from "../Chef.js";
import R from "../ramda.js";

const display_game = function (game) {
    return (
        "\n" + BoxedUp.to_string(game.board) +
        "\n(Player " + game.player + " to play)"
    );
};

const display_ply = function (ply) {
    return JSON.stringify(ply);
};

const all_levels = Object.values(Chef.levels);

describe("Computer chefs", function () {
    it(
        `Given a game that has already ended,
when a chef of any level is asked for a ply,
then it proposes none (undefined).`,
        function () {
            const ended_game = {
                "board": [
                    [1, 2],
                    [2, 1]
                ],
                "player": 1
            };
            all_levels.forEach(function (level) {
                const ply = Chef.choose_ply(level, ended_game);
                if (ply !== undefined) {
                    throw new Error(
                        `A level ${level} chef proposed a ply ` +
                        "for an ended game: " + display_ply(ply) +
                        display_game(ended_game)
                    );
                }
            });
        }
    );

    it(
        `Given a game in progress,
when a chef of any level is asked for a ply,
then the proposal names a piece from the menu,
in one of that piece's orientations,
at a position where it may legally be packed.`,
        function () {
            const games_in_progress = [
                BoxedUp.new_game(),
                BoxedUp.new_game(3, 3, [[1, 1]]),
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
            games_in_progress.forEach(function (game) {
                all_levels.forEach(function (level) {
                    const ply = Chef.choose_ply(level, game);
                    if (ply === undefined) {
                        throw new Error(
                            `A level ${level} chef passed on a game ` +
                            "that has not ended: " + display_game(game)
                        );
                    }
                    const base_shape = BoxedUp.piece_shapes[ply.name];
                    if (base_shape === undefined) {
                        throw new Error(
                            `The chef named an unknown piece: ` +
                            display_ply(ply)
                        );
                    }
                    const is_orientation = R.any(
                        R.equals(ply.shape),
                        BoxedUp.orientations(base_shape)
                    );
                    if (!is_orientation) {
                        throw new Error(
                            "The proposed shape is not an orientation " +
                            `of the ${ply.name}: ` + display_ply(ply)
                        );
                    }
                    const next = BoxedUp.place(ply.shape, ply.position, game);
                    if (next === undefined) {
                        throw new Error(
                            `A level ${level} chef proposed an illegal ` +
                            "ply: " + display_ply(ply) + display_game(game)
                        );
                    }
                });
            });
        }
    );

    it(
        `Given a box where exactly one ply would seal a compartment
in the chef's favour,
when the head chef is asked for a ply,
then it makes that sealing ply, ending the game as the winner.`,
        function () {
            const nearly_sealed = {
                "board": [
                    [1, 1, 2],
                    [2, 2, 0],
                    [1, 0, 0]
                ],
                "player": 2
            };
            const ply = Chef.choose_ply(
                Chef.levels.head_chef,
                nearly_sealed
            );
            const next = BoxedUp.place(ply.shape, ply.position, nearly_sealed);
            const sealed = BoxedUp.sealed_compartments(next);
            if (sealed.length !== 1 || sealed[0].owner !== 2) {
                throw new Error(
                    "The head chef did not take the sealing ply: " +
                    display_ply(ply) + display_game(next)
                );
            }
            if (BoxedUp.winner(next) !== 2) {
                throw new Error(
                    "Sealing the compartment should win the game " +
                    "for the head chef, but the winner is " +
                    `${BoxedUp.winner(next)}: ` + display_game(next)
                );
            }
        }
    );

    it(
        `Given an open box where every piece fits,
the apprentice packs the smallest piece on the menu (the umeboshi),
and the cook packs a largest one (4 cells).`,
        function () {
            const open_game = BoxedUp.new_game();
            const apprentice_ply = Chef.choose_ply(
                Chef.levels.apprentice,
                open_game
            );
            if (apprentice_ply.shape.length !== 1) {
                throw new Error(
                    "The apprentice should pack the 1-cell umeboshi, " +
                    "but packed: " + display_ply(apprentice_ply)
                );
            }
            const cook_ply = Chef.choose_ply(Chef.levels.cook, open_game);
            if (cook_ply.shape.length !== 4) {
                throw new Error(
                    "The cook should pack a 4-cell piece, " +
                    "but packed: " + display_ply(cook_ply)
                );
            }
        }
    );

    it(
        `Given an open box whose first free cell is not the corner,
when the apprentice is asked for a ply,
then it packs the one-cell umeboshi in that first free spot,
not merely a smallest piece somewhere.`,
        function () {
            const first_free = {
                "board": [
                    [1, 1, 0],
                    [0, 0, 0],
                    [0, 0, 0]
                ],
                "player": 1
            };
            const ply = Chef.choose_ply(Chef.levels.apprentice, first_free);
            if (ply.name !== "umeboshi" || !R.equals(ply.position, [0, 2])) {
                throw new Error(
                    "The apprentice should pack the umeboshi in the first " +
                    "free spot [0, 2], but packed: " +
                    display_ply(ply) + display_game(first_free)
                );
            }
        }
    );

    it(
        `Given an open box where three pieces are equally the largest,
when the cook is asked for a ply,
then it deterministically packs the first such piece on the menu
(the onigiri) at the first spot, not just any 4-cell piece.`,
        function () {
            const open_game = BoxedUp.new_game(3, 3);
            const ply = Chef.choose_ply(Chef.levels.cook, open_game);
            if (ply.name !== "onigiri" || !R.equals(ply.position, [0, 0])) {
                throw new Error(
                    "The cook should pack the onigiri at [0, 0] (the first " +
                    "of the equally-large pieces), but packed: " +
                    display_ply(ply) + display_game(open_game)
                );
            }
        }
    );

    it(
        `Given a box where the only compartment-filling pack would hand
that compartment to the opponent,
when the head chef is asked for a ply,
then it declines that larger pack in favour of the one that most
improves its score lead, not the one that covers the most cells.`,
        function () {
            // The 2x2 hole is the only 4-cell spot; filling it with the
            // rice seals the compartment for player 2 (5 cells to 4), so a
            // chef that just grabbed cells (or its own raw score) would take
            // it. A 3-cell tempura leaves a gap and keeps a better lead.
            const conceding_box = {
                "board": [
                    [2, 2, 2],
                    [2, 0, 0],
                    [2, 0, 0]
                ],
                "player": 1
            };
            const rice_pack = {
                "shape": BoxedUp.piece_shapes.rice,
                "position": [1, 1]
            };
            if (!BoxedUp.is_legal_placement(
                rice_pack.shape,
                rice_pack.position,
                conceding_box.board
            )) {
                throw new Error(
                    "Test setup is wrong: the 4-cell rice should be a legal " +
                    "pack at [1, 1]." + display_game(conceding_box)
                );
            }
            const ply = Chef.choose_ply(
                Chef.levels.head_chef,
                conceding_box
            );
            if (ply.shape.length >= 4) {
                throw new Error(
                    "The head chef took the compartment-conceding 4-cell " +
                    "pack instead of protecting its lead: " +
                    display_ply(ply) + display_game(conceding_box)
                );
            }
            const lead_of = function (pick) {
                const after = BoxedUp.place(
                    pick.shape,
                    pick.position,
                    conceding_box
                );
                return BoxedUp.score(1, after) - BoxedUp.score(2, after);
            };
            if (lead_of(ply) <= lead_of(rice_pack)) {
                throw new Error(
                    "The chosen pack should beat the 4-cell rice on score " +
                    "lead, but did not: chosen lead " + lead_of(ply) +
                    " vs rice lead " + lead_of(rice_pack) +
                    display_game(conceding_box)
                );
            }
        }
    );

    it(
        `Given the same in-progress game asked twice,
when the head chef proposes a ply each time,
then it proposes exactly the same ply: ties resolve to the first
maximal pack, so the chef is deterministic.`,
        function () {
            const game = BoxedUp.new_game(3, 3, [[0, 0]]);
            const first = Chef.choose_ply(Chef.levels.head_chef, game);
            const second = Chef.choose_ply(Chef.levels.head_chef, game);
            if (!R.equals(first, second)) {
                throw new Error(
                    "The head chef proposed different plies for the same " +
                    "game: " + display_ply(first) + " vs " +
                    display_ply(second) + display_game(game)
                );
            }
        }
    );
});
