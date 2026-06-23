/*jslint browser */
import R from "./ramda.js";
import BoxedUp from "./BoxedUp.js";
import Chef from "./Chef.js";

// String literals.
const cell_descriptions = [
    "Empty",
    "Chef 1's food",
    "Chef 2's food",
    "Garnish (cannot be covered)"
];
const computer_names = ["", "Apprentice", "Cook", "Head Chef"];

const board_side = 9;
const piece_names = Object.keys(BoxedUp.piece_shapes);

// This is my helper function to shorten document.getElementById.
const el = (id) => document.getElementById(id);

// Announce game events to assistive technology via a polite live
// region, so the game narrates itself for keyboard and screen-reader
// players.
const announce = function (text) {
    el("announcer").textContent = text;
};

// Tiny retro sound effects, synthesised live so no audio files are
// needed. Sounds only ever start after a user gesture.
let sound_on = true;
let audio_context;

const play_sound = function (notes) {
    if (!sound_on) {
        return;
    }
    if (audio_context === undefined) {
        audio_context = new window.AudioContext();
    }
    const now = audio_context.currentTime;
    notes.forEach(function ([frequency, start, length, wave]) {
        const oscillator = audio_context.createOscillator();
        const gain = audio_context.createGain();
        oscillator.type = wave || "square";
        oscillator.frequency.value = frequency;
        gain.gain.setValueAtTime(0.05, now + start);
        gain.gain.exponentialRampToValueAtTime(
            0.001,
            now + start + length
        );
        oscillator.connect(gain);
        gain.connect(audio_context.destination);
        oscillator.start(now + start);
        oscillator.stop(now + start + length);
    });
};

const sound_effects = {
    "place": [[392, 0, 0.08], [523, 0.06, 0.1]],
    "seal": [[523, 0, 0.09], [659, 0.08, 0.09], [784, 0.16, 0.2]],
    "star": [[784, 0, 0.09], [1175, 0.08, 0.18]],
    "matcha": [[659, 0, 0.08], [784, 0.07, 0.08], [988, 0.14, 0.18]],
    "wasabi": [[196, 0, 0.12, "sawtooth"], [131, 0.1, 0.3, "sawtooth"]],
    "win": [
        [523, 0, 0.12],
        [659, 0.12, 0.12],
        [784, 0.24, 0.12],
        [1047, 0.36, 0.35]
    ]
};

// Cheeky chef chatter, shown in a speech bubble by each portrait.
const quips = {
    "draw": ["Even steven.", "Split the bill?"],
    "lose": ["My Boxed Up dreams...", "I demand a rematch!"],
    "matcha": [
        "MATCHA POWER!",
        "Green means GO!",
        "Another turn? Don't mind if I do!"
    ],
    "misfit": ["It doesn't fit!", "Too chunky!", "Try the umeboshi?"],
    "place": ["Nice fit!", "Packed!", "In it goes!", "Chef's kiss!"],
    "vip": ["VIP order served!", "Ten-point dish!", "The critics rave!"],
    "robbed": ["Hey, my corner!", "I wanted that one!", "Outrageous!"],
    "seal": ["Compartment mine!", "Sealed it!", "+5, thank you!"],
    "star": ["Golden bite!", "Lucky me!", "Shiny +3!"],
    "taunt": ["Ha! Enjoy the burn!", "More tea for me!", "Spicy, huh?"],
    "thinking": [
        "Hmm, let me think...",
        "Calculating tastiness...",
        "Where to nibble..."
    ],
    "wasabi": ["YEOW! Spicy!!", "My tongue!!", "Worth it... maybe."],
    "win": ["Itadakimasu!", "Top chef, me!", "Order up!"]
};

const bubble_timers = {};

const speak = function (player, kind) {
    const lines = quips[kind];
    const bubble = el(`player_${player}_bubble`);
    bubble.textContent = lines[
        Math.floor(Math.random() * lines.length)
    ];
    bubble.classList.add("visible");
    window.clearTimeout(bubble_timers[player]);
    bubble_timers[player] = window.setTimeout(function () {
        bubble.classList.remove("visible");
    }, 2000);
};

const game_board = el("game_board");
const piece_tray = el("piece_tray");
const result_dialog = el("result_dialog");

// Difficulty: how much garnish crowds the next box (set in settings).
let garnish_per_box = 5;

// Omakase mode hides the special cells until they are covered.
let omakase_on = false;

// Fair starts: the first box's starter is random, after which the
// loser of each box packs first in the next one (draws alternate).
let next_starter = (
    Math.random() < 0.5
    ? 1
    : 2
);

// Chef 2 is a human friend, or a computer chef at a Chef.levels level.
let chef_2_control = "human";
let computer_thinking = false;

// Endless rush: an optional timed mode. One countdown runs for the
// whole sitting; within it, every time a box is packed full it is
// banked and a fresh box is dealt, so chefs race to pack as many as
// they can. When the clock reaches zero the chef with the higher
// running total wins. The clock is a real-time interface concern —
// the module stays timeless and supplies every box's score.
let endless_on = false;
let endless_seconds = 90;
let run_remaining = 0;
let run_timer;
let refresh_timer;
let run_over = false;
let boxes_filled = 0;
let run_score = [0, 0, 0];

// Every box gets random garnish, golden stars, and wasabi dabs,
// making each game different. The module stays pure: the random
// positions are chosen here and passed in.
const specials_per_box = 2;

const deal_box = function () {
    const shuffled = R.xprod(
        R.range(0, board_side),
        R.range(0, board_side)
    ).sort(() => Math.random() - 0.5);
    return BoxedUp.new_game(
        board_side,
        board_side,
        shuffled.slice(0, garnish_per_box),
        shuffled.slice(
            garnish_per_box,
            garnish_per_box + specials_per_box
        ),
        shuffled.slice(
            garnish_per_box + specials_per_box,
            garnish_per_box + 2 * specials_per_box
        ),
        shuffled.slice(
            garnish_per_box + 2 * specials_per_box,
            garnish_per_box + 2 * specials_per_box + 1
        ),
        R.xprod([0, 3, 6], [0, 3, 6])[Math.floor(Math.random() * 9)],
        next_starter
    );
};

let game = deal_box();

// Each piece in the tray remembers its current orientation.
let tray_shapes = R.clone(BoxedUp.piece_shapes);
let selected_piece = "tamago";
// Wins are kept separately for each opponent — a human friend, or
// each computer chef — so beating the Head Chef never mingles with a
// human rivalry. Each record is [draws, chef 1 wins, chef 2 wins] and
// survives page reloads.
const default_wins = function () {
    return {
        "human": [0, 0, 0],
        "1": [0, 0, 0],
        "2": [0, 0, 0],
        "3": [0, 0, 0]
    };
};

const load_wins = function () {
    try {
        const stored = window.localStorage.getItem("boxed_up_wins_v2");
        return (
            stored === null
            ? default_wins()
            : Object.assign(default_wins(), JSON.parse(stored))
        );
    } catch (ignore) {
        return default_wins();
    }
};

let all_wins = load_wins();

const save_wins = function () {
    try {
        window.localStorage.setItem(
            "boxed_up_wins_v2",
            JSON.stringify(all_wins)
        );
    } catch (ignore) {
        return;
    }
};

// The win record for whoever is currently playing chef 2.
const opponent_key = function () {
    return String(chef_2_control);
};

const current_wins = function () {
    return all_wins[opponent_key()];
};

// The UI remembers which food was packed in each cell, so the box
// fills up with varied dishes. (Presentation only — the game state
// just records which chef covered the cell.)
const fresh_foods = function () {
    return R.range(0, board_side).map(() => R.repeat("", board_side));
};
let cell_foods = fresh_foods();

const player_name = function (player) {
    return el(`player_${player}_name`).value;
};

// Build the board as a 3×3 grid of compartments,
// each holding a 3×3 grid of cell buttons.

const compartment_origins = R.xprod([0, 3, 6], [0, 3, 6]);
const compartment_divs = {};
const cell_buttons = R.range(0, board_side).map(() => []);

compartment_origins.forEach(function ([origin_row, origin_column]) {
    const compartment_div = document.createElement("div");
    compartment_div.className = "compartment";
    compartment_divs[`${origin_row},${origin_column}`] = compartment_div;
    R.xprod(R.range(0, 3), R.range(0, 3)).forEach(
        function ([row_offset, column_offset]) {
            const row = origin_row + row_offset;
            const column = origin_column + column_offset;
            const cell_button = document.createElement("button");
            cell_button.setAttribute("type", "button");
            cell_button.tabIndex = (
                (row === 0 && column === 0)
                ? 0
                : -1
            );
            cell_buttons[row][column] = cell_button;
            compartment_div.append(cell_button);
        }
    );
    game_board.append(compartment_div);
});

// The compartments slide into place when a new box arrives.
const deal_in_compartments = function () {
    Object.values(compartment_divs).forEach(
        function (compartment_div, index) {
            compartment_div.style.animationDelay = `${index * 60}ms`;
            compartment_div.classList.add("dealt");
        }
    );
    window.setTimeout(function () {
        Object.values(compartment_divs).forEach(function (compartment_div) {
            compartment_div.classList.remove("dealt");
            compartment_div.style.animationDelay = "";
        });
    }, 1200);
};

// The last previewed position, so rotating can refresh the preview.
let preview_position;

// The board cell that last had keyboard focus, so that selecting a
// piece can return focus to the box, ready to place.
let board_focus_position = [0, 0];

const focus_board = function () {
    const [row, column] = board_focus_position;
    cell_buttons[row][column].tabIndex = 0;
    cell_buttons[row][column].focus();
};

const clear_preview = function () {
    document.querySelectorAll(".preview_value").forEach(function (badge) {
        badge.remove();
    });
    cell_buttons.forEach((row) => row.forEach(function (cell_button) {
        cell_button.classList.remove("preview_legal", "preview_illegal");
    }));
};

const show_preview = function (position) {
    preview_position = position;
    clear_preview();
    const shape = tray_shapes[selected_piece];
    const legal = BoxedUp.is_legal_placement(shape, position, game.board);
    const preview_class = (
        legal
        ? "preview_legal"
        : "preview_illegal"
    );
    BoxedUp.placement_cells(shape, position).forEach(
        function ([row, column]) {
            if (cell_buttons[row] && cell_buttons[row][column]) {
                cell_buttons[row][column].classList.add(preview_class);
            }
        }
    );
    // Float the points this ply would earn over the anchor cell, so a
    // chef can weigh it before committing. The value comes from the
    // module (BoxedUp.score_gain), not from any sums made here. It is
    // withheld in omakase mode, where it would betray a hidden special.
    const [anchor_row, anchor_column] = position;
    const anchor = (
        cell_buttons[anchor_row]
        ? cell_buttons[anchor_row][anchor_column]
        : undefined
    );
    if (legal && anchor !== undefined && !omakase_on) {
        const gain = BoxedUp.score_gain(shape, position, game);
        const badge = document.createElement("div");
        badge.className = (
            gain < 0
            ? "preview_value loss"
            : "preview_value gain"
        );
        badge.textContent = (
            gain < 0
            ? String(gain)
            : `+${gain}`
        );
        anchor.append(badge);
    }
};

const redraw_board = function () {
    cell_buttons.forEach(function (row_buttons, row) {
        row_buttons.forEach(function (cell_button, column) {
            const token = game.board[row][column];
            if (token === BoxedUp.garnish_token) {
                cell_button.className = "garnish";
            } else if (token === 0) {
                cell_button.className = "";
            } else {
                cell_button.className = (
                    `player_${token} food_${cell_foods[row][column]}`
                );
            }
            const revealed = (
                token === 1 || token === 2 || !omakase_on
            );
            const is_star = revealed && R.includes(
                [row, column],
                game.star_cells
            );
            const is_wasabi = revealed && R.includes(
                [row, column],
                game.wasabi_cells
            );
            const is_matcha = revealed && R.includes(
                [row, column],
                game.matcha_cells
            );
            if (is_star) {
                cell_button.classList.add("star_cell");
            }
            if (is_wasabi) {
                cell_button.classList.add("wasabi_cell");
            }
            if (is_matcha) {
                cell_button.classList.add("matcha_cell");
            }
            cell_button.setAttribute(
                "aria-label",
                `Row ${row + 1}, column ${column + 1}. ` +
                cell_descriptions[token] +
                (
                    is_star
                    ? " Golden star cell."
                    : ""
                ) +
                (
                    is_wasabi
                    ? " Wasabi cell!"
                    : ""
                ) +
                (
                    is_matcha
                    ? " Matcha boost cell!"
                    : ""
                )
            );
        });
    });
};

// Sealed compartments stay highlighted in their owner's colour.
// Newly sealed ones get a little fanfare.
let sealed_keys_seen = [];

const update_compartments = function () {
    let new_seals = 0;
    BoxedUp.sealed_compartments(game).forEach(function (sealed) {
        const key = `${sealed.origin[0]},${sealed.origin[1]}`;
        const compartment_div = compartment_divs[key];
        compartment_div.classList.add(`sealed_${sealed.owner}`);
        if (!sealed_keys_seen.includes(key)) {
            sealed_keys_seen.push(key);
            new_seals += 1;
            compartment_div.classList.add("just_sealed");
            window.setTimeout(function () {
                compartment_div.classList.remove("just_sealed");
            }, 900);
        }
    });
    return new_seals;
};

const mark_vip_compartment = function () {
    const vip_key = (
        `${game.vip_compartment[0]},${game.vip_compartment[1]}`
    );
    Object.entries(compartment_divs).forEach(function ([key, div]) {
        div.classList.toggle("vip", key === vip_key);
    });
};

const reset_compartments = function () {
    sealed_keys_seen = [];
    Object.values(compartment_divs).forEach(function (compartment_div) {
        compartment_div.classList.remove(
            "sealed_0",
            "sealed_1",
            "sealed_2",
            "just_sealed"
        );
    });
};

const owned_compartments = function (player) {
    return BoxedUp.sealed_compartments(game).filter(
        (sealed) => sealed.owner === player
    ).length;
};

// Changed statistics get a little bump so the eye is drawn to them.
const set_stat = function (id, value) {
    const stat = el(id);
    if (stat.textContent === String(value)) {
        return;
    }
    stat.textContent = value;
    stat.classList.add("bump");
    window.setTimeout(function () {
        stat.classList.remove("bump");
    }, 400);
};

const update_sidebars = function () {
    update_piece_availability();
    const wins = current_wins();
    [1, 2].forEach(function (player) {
        set_stat(`player_${player}_score`, BoxedUp.score(player, game));
        set_stat(
            `player_${player}_cells`,
            BoxedUp.cells_covered(player, game)
        );
        set_stat(
            `player_${player}_compartments`,
            owned_compartments(player)
        );
        set_stat(`player_${player}_wins`, wins[player]);
    });
    el("player_1_crown").hidden = !(wins[1] > wins[2]);
    el("player_2_crown").hidden = !(wins[2] > wins[1]);
    const ended = BoxedUp.is_ended(game);
    const player = BoxedUp.player_to_ply(game);
    el("player_1_panel").classList.toggle(
        "active",
        !ended && player === 1
    );
    el("player_2_panel").classList.toggle(
        "active",
        !ended && player === 2
    );
    if (ended) {
        el("player_1_status").textContent = "Box sealed.";
        el("player_2_status").textContent = "Box sealed.";
        return;
    }
    el(`player_${player}_status`).textContent = "You're up!";
    el(`player_${3 - player}_status`).textContent = "Wait your turn…";
};

const score_summary = function (player) {
    const bonuses = owned_compartments(player);
    return (
        `${player_name(player)} scored ` +
        `${BoxedUp.score(player, game)} points — ` +
        `${BoxedUp.cells_covered(player, game)} cells and ` +
        `${bonuses} sealed compartment${(
            bonuses === 1
            ? ""
            : "s"
        )}.`
    );
};

// A cheeky one-liner for the result ticket.
const flavor_line = function (winner) {
    if (winner !== 0 && BoxedUp.covered_wasabi(winner, game) > 0) {
        return `${player_name(winner)} ate wasabi and STILL won!`;
    }
    if (
        winner !== 0 &&
        game.last_player === winner &&
        BoxedUp.score(winner, game) - BoxedUp.score(3 - winner, game) <=
        BoxedUp.closing_bonus
    ) {
        return `${player_name(winner)} won by slamming the lid!`;
    }
    if (
        BoxedUp.covered_wasabi(1, game) + BoxedUp.covered_wasabi(2, game) === 0
    ) {
        return "Not one wasabi touched. Cowards? Geniuses?";
    }
    if (winner === 0) {
        return "Two chefs, one box, zero bragging rights.";
    }
    return `${player_name(3 - winner)} demands a rematch!`;
};

// Format a whole number of seconds as m:ss for the clock readout.
const format_clock = function (seconds) {
    return (
        Math.floor(seconds / 60) +
        ":" +
        String(seconds % 60).padStart(2, "0")
    );
};

// Deal a fresh box into the interface without disturbing the run
// clock or the running totals. Used both to start a box and to
// refresh the box mid-run when one is packed full.
const refresh_board = function () {
    game = deal_box();
    cell_foods = fresh_foods();
    reset_compartments();
    mark_vip_compartment();
    redraw_board();
    update_sidebars();
    clear_preview();
    deal_in_compartments();
    board_focus_position = [0, 0];
    focus_board();
};

// Reflect the run on the heads-up display: the countdown, the
// draining bar, the boxes packed, and each chef's running total. The
// last ten seconds turn "urgent" — shown by colour and by the bare
// countdown, never by colour alone.
const show_run_hud = function () {
    el("run_hud").hidden = !endless_on;
    if (!endless_on) {
        document.body.style.removeProperty("--hud-reserve");
        return;
    }
    const fraction = (
        endless_seconds === 0
        ? 0
        : run_remaining / endless_seconds
    );
    el("run_time").textContent = format_clock(run_remaining);
    el("run_bar").style.width = `${Math.round(fraction * 100)}%`;
    el("run_boxes").textContent = boxes_filled;
    el("run_score_1").textContent = run_score[1];
    el("run_score_2").textContent = run_score[2];
    el("run_hud").classList.toggle("urgent", run_remaining <= 10);
    el("run_hud").setAttribute(
        "aria-label",
        `Endless rush: ${run_remaining} seconds left. ` +
        `${boxes_filled} boxes packed. ` +
        `${player_name(1)} ${run_score[1]}, ` +
        `${player_name(2)} ${run_score[2]}.`
    );
    // Reserve exactly the HUD's real height (plus its margin) so the
    // board leaves room whether the tallies sit on one line or wrap
    // to two — the piece tray below is never pushed off.
    document.body.style.setProperty(
        "--hud-reserve",
        `${el("run_hud").offsetHeight + 16}px`
    );
};

const stop_run = function () {
    window.clearInterval(run_timer);
    run_timer = undefined;
};

// At the end of a run, present the cumulative result. The winner is
// whoever scored more across the run; each box's score comes from the
// module, this only sums them.
const show_run_result = function () {
    const winner = (
        run_score[1] === run_score[2]
        ? 0
        : (
            run_score[1] > run_score[2]
            ? 1
            : 2
        )
    );
    const wins = current_wins();
    all_wins[opponent_key()] = R.update(winner, wins[winner] + 1, wins);
    save_wins();
    next_starter = (
        winner === 0
        ? 3 - next_starter
        : 3 - winner
    );
    el("result_heading").textContent = "Time's Up!";
    el("result_winner").textContent = (
        winner === 0
        ? "It's a draw!"
        : `${player_name(winner)} wins the rush!`
    );
    [1, 2].forEach(function (player) {
        el(`result_name_${player}`).textContent = player_name(player);
        el(`result_points_${player}`).textContent = (
            `${run_score[player]} pts`
        );
        el(`result_detail_${player}`).textContent = (
            `across ${boxes_filled} packed `
            + (
                boxes_filled === 1
                ? "box"
                : "boxes"
            )
        );
        el(`result_row_${player}`).classList.toggle(
            "winner_row",
            winner === player
        );
    });
    announce(
        "Time's up! " + el("result_winner").textContent + " " +
        `${player_name(1)} scored ${run_score[1]} and ` +
        `${player_name(2)} scored ${run_score[2]} ` +
        `over ${boxes_filled} packed boxes.`
    );
    el("result_flavor").textContent = (
        winner === 0
        ? "A photo finish at the pass!"
        : `${player_name(winner)} ran the hottest kitchen!`
    );
    update_sidebars();
    play_sound(sound_effects.win);
    confetti_rain();
    if (winner === 0) {
        speak(1, "draw");
        speak(2, "draw");
    } else {
        speak(winner, "win");
        speak(3 - winner, "lose");
        react(winner, "bounce");
        react(3 - winner, "wince");
    }
    result_dialog.showModal();
};

// A box has been packed full during a run: bank both chefs' scores
// into the running totals, then deal the next box so play flows on.
const continue_run_box = function () {
    [1, 2].forEach(function (player) {
        run_score[player] += BoxedUp.score(player, game);
    });
    boxes_filled += 1;
    show_run_hud();
    mega_banner(`Box ${boxes_filled} packed!`);
    play_sound(sound_effects.seal);
    announce(
        `Box ${boxes_filled} packed. Running totals: ` +
        `${player_name(1)} ${run_score[1]}, ` +
        `${player_name(2)} ${run_score[2]}. A fresh box is coming.`
    );
    refresh_timer = window.setTimeout(function () {
        refresh_board();
        maybe_computer_turn();
    }, 850);
};

// The run clock has reached zero. Bank the box in progress (if it was
// not just refreshed), then show the cumulative result.
const end_run = function () {
    run_over = true;
    stop_run();
    window.clearTimeout(refresh_timer);
    if (!BoxedUp.is_ended(game)) {
        [1, 2].forEach(function (player) {
            run_score[player] += BoxedUp.score(player, game);
        });
    }
    show_run_hud();
    show_run_result();
};

// One tick of the run clock. It pauses while a dialog is open or the
// computer is thinking, so only the chefs' own decision time is spent.
const run_tick = function () {
    if (document.querySelector("dialog[open]") || computer_thinking) {
        return;
    }
    run_remaining -= 1;
    show_run_hud();
    if (run_remaining === 30 || run_remaining === 10) {
        announce(`Endless rush: ${run_remaining} seconds left!`);
    }
    if (run_remaining <= 0) {
        stop_run();
        end_run();
    }
};

// Start a fresh run clock (a no-op when Endless mode is off).
const start_run = function () {
    stop_run();
    run_remaining = endless_seconds;
    show_run_hud();
    if (endless_on) {
        run_timer = window.setInterval(run_tick, 1000);
    }
};

const show_result = function () {
    const winner = BoxedUp.winner(game);
    const wins = current_wins();
    all_wins[opponent_key()] = R.update(winner, wins[winner] + 1, wins);
    save_wins();
    next_starter = (
        winner === 0
        ? 3 - next_starter
        : 3 - winner
    );
    el("result_heading").textContent = "Box Sealed!";
    if (winner === 0) {
        el("result_winner").textContent = "It's a draw!";
    } else {
        el("result_winner").textContent = `${player_name(winner)} wins!`;
    }
    [1, 2].forEach(function (player) {
        el(`result_name_${player}`).textContent = player_name(player);
        el(`result_points_${player}`).textContent = (
            `${BoxedUp.score(player, game)} pts`
        );
        el(`result_detail_${player}`).textContent = (
            `${BoxedUp.cells_covered(player, game)} cells covered · ` +
            `${owned_compartments(player)} compartments sealed`
        );
        el(`result_row_${player}`).classList.toggle(
            "winner_row",
            winner === player
        );
    });
    announce(
        "The box is sealed! " + el("result_winner").textContent + " " +
        score_summary(1) + " " + score_summary(2)
    );
    el("result_flavor").textContent = flavor_line(winner);
    update_sidebars();
    play_sound(sound_effects.win);
    confetti_rain();
    if (winner === 0) {
        speak(1, "draw");
        speak(2, "draw");
    } else {
        speak(winner, "win");
        speak(3 - winner, "lose");
        react(winner, "bounce");
        react(3 - winner, "wince");
    }
    result_dialog.showModal();
};

const animate_placement = function (covered) {
    covered.forEach(function ([row, column], index) {
        const cell_button = cell_buttons[row][column];
        cell_button.style.animationDelay = `${index * 60}ms`;
        cell_button.classList.add("just_placed");
    });
    window.setTimeout(function () {
        covered.forEach(function ([row, column]) {
            const cell_button = cell_buttons[row][column];
            cell_button.classList.remove("just_placed");
            cell_button.style.animationDelay = "";
        });
    }, 700);
};

// A little score number floats up from special cells when hit.
const float_score = function ([row, column], text, gained) {
    const float = document.createElement("div");
    float.className = (
        gained
        ? "score_float gain"
        : "score_float loss"
    );
    float.textContent = text;
    cell_buttons[row][column].append(float);
    window.setTimeout(function () {
        float.remove();
    }, 950);
};

// Chef portraits physically react to the drama.
const react = function (player, mood) {
    const portrait = document.querySelector(
        `#player_${player}_panel .portrait`
    );
    portrait.classList.add(mood);
    window.setTimeout(function () {
        portrait.classList.remove(mood);
    }, 700);
};

// A burst of sparkles over the box for big moments.
const sparkle_burst = function (count) {
    R.range(0, count).forEach(function (index) {
        const sparkle = document.createElement("img");
        sparkle.src = "./assets/sparkle.svg";
        sparkle.alt = "";
        sparkle.className = "burst_sparkle";
        sparkle.style.left = `${8 + Math.random() * 84}%`;
        sparkle.style.top = `${8 + Math.random() * 84}%`;
        sparkle.style.animationDelay = `${index * 70}ms`;
        game_board.append(sparkle);
        window.setTimeout(function () {
            sparkle.remove();
        }, 1600);
    });
};

// Confetti rains over the whole kitchen when the box is done.
const confetti_rain = function () {
    R.range(0, 16).forEach(function (index) {
        const confetto = document.createElement("img");
        confetto.src = (
            index % 2 === 0
            ? "./assets/sparkle.svg"
            : "./assets/blossom.svg"
        );
        confetto.alt = "";
        confetto.className = "confetti";
        confetto.style.left = `${Math.random() * 96}%`;
        confetto.style.animationDelay = `${index * 90}ms`;
        document.body.append(confetto);
        window.setTimeout(function () {
            confetto.remove();
        }, 3200);
    });
};

// A big banner across the box for outrageous plays.
const mega_banner = function (text) {
    const banner = document.createElement("div");
    banner.className = "mega_banner";
    banner.textContent = text;
    game_board.append(banner);
    window.setTimeout(function () {
        banner.remove();
    }, 1300);
};

// Forward declaration: defined below, used by perform_placement.
let maybe_computer_turn;

// Carries out a legal ply for the current player and updates the
// whole interface. Used for human and computer plies alike.
const perform_placement = function (name, shape, position) {
    if (run_over) {
        return false;
    }
    const next_game = BoxedUp.place(shape, position, game);
    if (next_game === undefined) {
        return false;
    }
    const mover = BoxedUp.player_to_ply(game);
    const covered = BoxedUp.placement_cells(shape, position);
    covered.forEach(function ([row, column]) {
        cell_foods[row][column] = name;
    });
    const stars_hit = covered.filter(
        (cell) => R.includes(cell, game.star_cells)
    );
    const wasabi_hit = covered.filter(
        (cell) => R.includes(cell, game.wasabi_cells)
    );
    const matcha_hit = covered.filter(
        (cell) => R.includes(cell, game.matcha_cells)
    );
    game = next_game;
    redraw_board();
    animate_placement(covered);
    stars_hit.forEach(function (cell) {
        float_score(cell, `+${BoxedUp.star_bonus}`, true);
    });
    wasabi_hit.forEach(function (cell) {
        float_score(cell, `-${BoxedUp.wasabi_penalty}`, false);
    });
    if (wasabi_hit.length > 0) {
        game_board.classList.add("shake");
        window.setTimeout(function () {
            game_board.classList.remove("shake");
        }, 500);
    }
    const vip_key = (
        `${game.vip_compartment[0]},${game.vip_compartment[1]}`
    );
    const vip_sealed_before = sealed_keys_seen.includes(vip_key);
    const new_seals = update_compartments();
    const vip_owner = (
        (!vip_sealed_before && sealed_keys_seen.includes(vip_key))
        ? R.find(
            (sealed) => R.equals(sealed.origin, game.vip_compartment),
            BoxedUp.sealed_compartments(game)
        ).owner
        : 0
    );
    update_sidebars();
    if (BoxedUp.is_ended(game)) {
        if (endless_on) {
            continue_run_box();
        } else {
            show_result();
        }
        return true;
    }
    const rival = 3 - mover;
    if (matcha_hit.length > 0) {
        mega_banner("EXTRA TURN!");
    } else if (vip_owner > 0) {
        mega_banner("VIP ORDER!");
        sparkle_burst(8);
    } else if (new_seals >= 2) {
        mega_banner("DOUBLE SEAL!");
        sparkle_burst(10);
    } else if (new_seals > 0) {
        sparkle_burst(5);
    }
    if (matcha_hit.length > 0) {
        play_sound(sound_effects.matcha);
        speak(mover, "matcha");
        react(mover, "bounce");
    } else if (wasabi_hit.length > 0) {
        play_sound(sound_effects.wasabi);
        speak(mover, "wasabi");
        react(mover, "wince");
        window.setTimeout(function () {
            speak(rival, "taunt");
            react(rival, "bounce");
        }, 700);
    } else if (stars_hit.length > 0) {
        play_sound(sound_effects.star);
        speak(mover, "star");
        react(mover, "bounce");
    } else if (vip_owner > 0) {
        play_sound(sound_effects.seal);
        speak(vip_owner, "vip");
        react(vip_owner, "bounce");
        window.setTimeout(function () {
            speak(3 - vip_owner, "robbed");
            react(3 - vip_owner, "wince");
        }, 700);
    } else if (new_seals > 0) {
        play_sound(sound_effects.seal);
        speak(mover, "seal");
        react(mover, "bounce");
        window.setTimeout(function () {
            speak(rival, "robbed");
            react(rival, "wince");
        }, 700);
    } else {
        play_sound(sound_effects.place);
        speak(mover, "place");
    }
    announce(
        `${player_name(mover)} packed the ${name}.` +
        (
            stars_hit.length > 0
            ? ` Grabbed a golden star, +${BoxedUp.star_bonus}!`
            : ""
        ) +
        (
            wasabi_hit.length > 0
            ? ` Hit the wasabi, -${BoxedUp.wasabi_penalty}!`
            : ""
        ) +
        (
            new_seals > 0
            ? " A compartment was sealed!"
            : ""
        ) +
        (
            matcha_hit.length > 0
            ? ` Matcha boost — ${player_name(mover)} goes again!`
            : ` ${player_name(BoxedUp.player_to_ply(game))}'s turn.`
        ) +
        ` ${BoxedUp.empty_cells(game)} cells left.`
    );
    maybe_computer_turn();
    return true;
};

const is_computer_turn = function () {
    return (
        chef_2_control !== "human" &&
        !BoxedUp.is_ended(game) &&
        BoxedUp.player_to_ply(game) === 2
    );
};

// When it is the computer's turn, it pauses to "think", then packs.
let thinking_timer;

maybe_computer_turn = function () {
    if (!is_computer_turn() || computer_thinking) {
        return;
    }
    computer_thinking = true;
    el("player_2_status").textContent = "Thinking…";
    speak(2, "thinking");
    thinking_timer = window.setTimeout(function () {
        computer_thinking = false;
        if (!is_computer_turn()) {
            return; // E.g. a new box was started while thinking.
        }
        const ply = Chef.choose_ply(chef_2_control, game);
        if (ply !== undefined) {
            perform_placement(ply.name, ply.shape, ply.position);
        }
    }, 850);
};

const attempt_placement = function (position) {
    if (run_over) {
        announce("Time is up. Start a new run to play on.");
        return;
    }
    if (computer_thinking || is_computer_turn()) {
        announce("The computer chef is taking its turn.");
        return;
    }
    const placed = perform_placement(
        selected_piece,
        tray_shapes[selected_piece],
        position
    );
    if (!placed) {
        const [row, column] = position;
        cell_buttons[row][column].classList.add("reject");
        window.setTimeout(function () {
            cell_buttons[row][column].classList.remove("reject");
        }, 400);
        speak(BoxedUp.player_to_ply(game), "misfit");
        announce(`The ${selected_piece} does not fit there.`);
    }
};

// Board events: click to place, hover or focus to preview,
// arrow keys to move around the board, R to rotate.

cell_buttons.forEach(function (row_buttons, row) {
    row_buttons.forEach(function (cell_button, column) {
        cell_button.onclick = function () {
            attempt_placement([row, column]);
            show_preview([row, column]);
        };
        cell_button.onmouseenter = function () {
            show_preview([row, column]);
        };
        cell_button.onfocus = function () {
            board_focus_position = [row, column];
            show_preview([row, column]);
        };
        cell_button.onkeydown = function (event) {
            const moves = {
                "ArrowDown": [row + 1, column],
                "ArrowLeft": [row, column - 1],
                "ArrowRight": [row, column + 1],
                "ArrowUp": [row - 1, column]
            };
            const move = moves[event.key];
            if (!move) {
                return;
            }
            event.preventDefault();
            const [new_row, new_column] = move;
            if (cell_buttons[new_row] && cell_buttons[new_row][new_column]) {
                cell_button.tabIndex = -1;
                cell_buttons[new_row][new_column].tabIndex = 0;
                cell_buttons[new_row][new_column].focus();
            }
        };
    });
});

game_board.onmouseleave = function () {
    preview_position = undefined;
    clear_preview();
};

// The piece tray: a button per piece showing its current orientation,
// built from tiles of that piece's pixel-art sprite.

const mini_grid_of = function (name) {
    const shape = tray_shapes[name];
    const mini_grid = document.createElement("div");
    mini_grid.className = "mini_grid";
    const rows = 1 + R.reduce(R.max, 0, shape.map(R.head));
    const columns = 1 + R.reduce(R.max, 0, shape.map(R.last));
    mini_grid.style.gridTemplateColumns = `repeat(${columns}, 1fr)`;
    R.xprod(R.range(0, rows), R.range(0, columns)).forEach(
        function (position) {
            const mini_cell = document.createElement("div");
            if (R.includes(position, shape)) {
                mini_cell.className = `mini_filled food_${name}`;
            }
            mini_grid.append(mini_cell);
        }
    );
    return mini_grid;
};

const piece_buttons = {};

const redraw_piece_button = function (name) {
    const piece_button = piece_buttons[name];
    piece_button.textContent = "";
    const label = document.createElement("span");
    label.textContent = name;
    piece_button.append(mini_grid_of(name), label);
    piece_button.setAttribute(
        "aria-pressed",
        (
            name === selected_piece
            ? "true"
            : "false"
        )
    );
    piece_button.setAttribute(
        "aria-label",
        `Select the ${name} piece, ` +
        `covering ${tray_shapes[name].length} cells`
    );
};

const select_piece = function (name) {
    const previous = selected_piece;
    selected_piece = name;
    redraw_piece_button(previous);
    redraw_piece_button(name);
    announce(`${name} selected.`);
    focus_board(); // Ready to place: jump focus back to the box.
};

Object.keys(BoxedUp.piece_shapes).forEach(function (name) {
    const piece_button = document.createElement("button");
    piece_button.setAttribute("type", "button");
    piece_button.className = "piece_button";
    piece_buttons[name] = piece_button;
    piece_button.onclick = function () {
        select_piece(name);
    };
    piece_button.onkeydown = function (event) {
        if (event.key === "ArrowUp") {
            event.preventDefault();
            focus_board();
            return;
        }
        const index = piece_names.indexOf(name);
        const neighbours = {
            "ArrowLeft": piece_names[index - 1],
            "ArrowRight": piece_names[index + 1]
        };
        if (neighbours[event.key]) {
            event.preventDefault();
            piece_buttons[neighbours[event.key]].focus();
        }
    };
    piece_tray.append(piece_button);
    redraw_piece_button(name);
});

// Dim the pieces that no longer fit anywhere, so a chef sees at a
// glance which dishes are still packable. The web app asks the
// module (BoxedUp.available_pieces) rather than working this out itself.
const update_piece_availability = function () {
    const fits = BoxedUp.available_pieces(game);
    piece_names.forEach(function (name) {
        piece_buttons[name].classList.toggle(
            "unavailable",
            !fits.includes(name)
        );
    });
};

const rotate_selected_piece = function () {
    tray_shapes = R.assoc(
        selected_piece,
        BoxedUp.rotated_shape(tray_shapes[selected_piece]),
        tray_shapes
    );
    redraw_piece_button(selected_piece);
    announce(`${selected_piece} rotated.`);
    if (preview_position !== undefined) {
        show_preview(preview_position); // Refresh the preview.
    }
};

el("rotate_button").onclick = rotate_selected_piece;

// Ask the strongest computer chef (Chef.choose_ply) for a move for the
// player to play, then select that piece in its suggested orientation
// and preview where it would go. The chef still packs it themselves —
// the hint only points the way, leaning on the existing AI module.
const give_hint = function () {
    if (omakase_on) {
        announce("No hints in omakase mode — the specials are hidden!");
        return;
    }
    const cannot_hint = (
        run_over ||
        BoxedUp.is_ended(game) ||
        computer_thinking ||
        is_computer_turn()
    );
    if (cannot_hint) {
        announce("No hint available right now.");
        return;
    }
    const ply = Chef.choose_ply(3, game);
    if (ply === undefined) {
        return;
    }
    tray_shapes = R.assoc(ply.name, ply.shape, tray_shapes);
    select_piece(ply.name);
    board_focus_position = ply.position;
    focus_board();
    show_preview(ply.position);
    announce(`Hint: pack the ${ply.name} where the box is glowing.`);
};

el("hint_button").onclick = give_hint;

// Right-clicking the board also rotates the selected piece,
// so the game can be played entirely with the mouse.
game_board.oncontextmenu = function (event) {
    event.preventDefault();
    rotate_selected_piece();
};

// Keyboard shortcuts: R rotates, 1–7 pick a piece from the tray,
// so the game can be played entirely with the keyboard.
document.body.onkeydown = function (event) {
    if (event.target.tagName === "INPUT") {
        return;
    }
    if (document.querySelector("dialog[open]")) {
        return;
    }
    if (event.key === "r" || event.key === "R") {
        rotate_selected_piece();
        return;
    }
    if (event.key === "h" || event.key === "H") {
        give_hint();
        return;
    }
    const numbered_piece = piece_names[Number(event.key) - 1];
    if (event.key >= "1" && event.key <= "9" && numbered_piece) {
        select_piece(numbered_piece);
    }
};

// Name changes update the sidebar and result texts.

el("player_1_name").onchange = update_sidebars;
el("player_2_name").onchange = update_sidebars;

// Starting a new game: from the result dialog, the settings menu,
// or whenever chef 2 changes hands.

const start_new_game = function () {
    window.clearTimeout(thinking_timer);
    window.clearTimeout(refresh_timer);
    computer_thinking = false;
    run_over = false;
    boxes_filled = 0;
    run_score = [0, 0, 0];
    refresh_board();
    announce(
        "A fresh box is on the counter. " +
        `${player_name(BoxedUp.player_to_ply(game))} packs first.`
    );
    if (result_dialog.open) {
        result_dialog.close();
    }
    start_run();
    maybe_computer_turn();
};

// Chef 2 can be handed to a computer chef of a chosen skill level.
// Changing who plays chef 2 always starts a fresh box, so nobody
// inherits a half-packed game.

el("opponent_select").onchange = function () {
    const choice = el("opponent_select").value;
    chef_2_control = (
        choice === "human"
        ? "human"
        : Number(choice)
    );
    const name_input = el("player_2_name");
    if (chef_2_control === "human") {
        name_input.disabled = false;
        if (computer_names.includes(name_input.value)) {
            name_input.value = "Chef 2";
        }
    } else {
        name_input.disabled = true;
        name_input.value = computer_names[chef_2_control];
    }
    start_new_game();
    announce(
        (
            chef_2_control === "human"
            ? "Chef 2 is played by a human friend. "
            : `Chef 2 is played by the computer ${name_input.value}. `
        ) +
        "A fresh box is on the counter and " +
        `${player_name(BoxedUp.player_to_ply(game))} packs first.`
    );
};

// Difficulty: how much garnish crowds the next box.

el("garnish_select").onchange = function () {
    garnish_per_box = Number(el("garnish_select").value);
    announce(
        `The next box will hold ${garnish_per_box} pieces of garnish.`
    );
};

// Next Order deals a fresh box directly (which also closes the
// ticket). This does not rely on the dialog's "close" event, so the
// game can never be left stuck behind the result.
el("new_game_button").onclick = function () {
    start_new_game();
};

// Dismissing the ticket any other way (e.g. the Escape key) also moves
// on to a fresh box. After Next Order the game is already fresh, so
// this guard makes it a no-op and never deals a second box.
result_dialog.onclose = function () {
    if (run_over || BoxedUp.is_ended(game)) {
        start_new_game();
    }
};

// The help and settings dialogs.

const how_to_dialog = el("how_to_dialog");
const settings_dialog = el("settings_dialog");

el("how_to_button").onclick = function () {
    how_to_dialog.showModal();
};

el("settings_button").onclick = function () {
    settings_dialog.showModal();
};

document.querySelectorAll(".close_button").forEach(
    function (close_button) {
        close_button.onclick = function () {
            close_button.closest("dialog").close();
        };
    }
);

el("restart_button").onclick = function () {
    start_new_game();
    settings_dialog.close();
};

el("reduce_motion_checkbox").onchange = function () {
    document.body.classList.toggle(
        "reduced_motion",
        el("reduce_motion_checkbox").checked
    );
};

el("sound_checkbox").onchange = function () {
    sound_on = el("sound_checkbox").checked;
};

el("omakase_checkbox").onchange = function () {
    omakase_on = el("omakase_checkbox").checked;
    // No peeking: hints are disabled while the specials are hidden.
    el("hint_button").disabled = omakase_on;
    redraw_board();
    announce(
        omakase_on
        ? "Omakase mode: special cells are hidden until covered!"
        : "Special cells are visible again."
    );
};

el("endless_checkbox").onchange = function () {
    endless_on = el("endless_checkbox").checked;
    // Reserve room for the timer HUD so the board never grows into
    // the piece tray below it.
    document.body.classList.toggle("endless", endless_on);
    start_new_game();
    announce(
        endless_on
        ? "Endless rush on — pack as many boxes as you can before time!"
        : "Endless rush off — one box at a time."
    );
};

el("endless_select").onchange = function () {
    endless_seconds = Number(el("endless_select").value);
    if (endless_on) {
        start_new_game();
    }
};

mark_vip_compartment();
redraw_board();
update_sidebars();
deal_in_compartments();

// Browsers can restore form controls when the page is reloaded,
// without firing change events. Sync the game state to whatever the
// controls actually show, so a restored "Head Chef" really plays.
el("reduce_motion_checkbox").onchange();
el("sound_checkbox").onchange();
el("omakase_checkbox").onchange();
el("endless_select").onchange();
el("endless_checkbox").onchange();
el("garnish_select").onchange();
el("opponent_select").onchange();

// Every visit opens with the rules, then the settings,
// so new chefs know the menu before they cook.
let onboarding = true;

how_to_dialog.onclose = function () {
    if (onboarding) {
        onboarding = false;
        settings_dialog.showModal();
    }
};

how_to_dialog.showModal();
