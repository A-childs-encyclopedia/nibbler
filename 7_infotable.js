"use strict";

function new_info(board, move) {

	return {
		board: board,
		cp: -999999,
		d: null,
		move: move,
		multipv: 999,
		n: 0,				// The draw logic will only ever draw things with non-negative n, so make this 0
		p: "?",
		pv: [],
		nice_pv_cache: null,
		value: null,

		nice_pv: function() {

			// Human readable moves. Since there's no real guarantee that our
			// moves list is legal, we legality check them. We at least know
			// the initial move is legal, since it's checked on receipt.

			if (this.nice_pv_cache) {
				return Array.from(this.nice_pv_cache);
			}

			let tmp_board = this.board;

			if (!this.pv || this.pv.length === 0) {
				return [tmp_board.nice_string(this.move)];
			}

			let ret = [];

			for (let move of this.pv) {
				if (tmp_board.illegal(move) !== "") {
					break;
				}
				ret.push(tmp_board.nice_string(move));
				tmp_board = tmp_board.move(move);
			}

			this.nice_pv_cache = ret;
			return Array.from(this.nice_pv_cache);
		},

		value_string: function(dp) {
			if (typeof this.value !== "number") {
				return "?";
			}
			let pc = Math.floor(this.value * 100 * 10) / 10;
			return pc.toFixed(dp);
		}
	};
}

function NewInfoTable() {			// There's only ever going to be one of these made I guess.

	return {

		drawn: false,
		table: Object.create(null),
	
		clear: function() {
			this.drawn = false;
			this.table = Object.create(null);
		},

		receive: function(s, board) {

			// Although the renderer tries to avoid sending invalid moves by
			// syncing with "isready" "readyok" an engine like Stockfish doesn't
			// behave properly, IMO. So we use the board to check legality.

			if (s.startsWith("info") && s.indexOf(" pv ") !== -1) {

				this.drawn = false;

				// info depth 13 seldepth 48 time 5603 nodes 67686 score cp 40 hashfull 204 nps 12080 tbhits 0 multipv 2
				// pv d2d4 g8f6 c2c4 e7e6 g2g3 f8b4 c1d2 b4e7 g1f3 e8g8 d1c2 a7a6 f1g2 b7b5 e1g1 c8b7 f1c1 b7e4 c2d1 b5c4 c1c4 a6a5 d2e1 h7h6 c4c1 d7d6

				let move = InfoVal(s, "pv");
				let move_info;

				if (this.table[move]) {						// We already have move info for this move.
					move_info = this.table[move];
				} else {									// We don't.
					if (board.illegal(move) !== "") {
						Log(`... Nibbler: invalid move received!: ${move}`);
						return;
					}
					move_info = new_info(board, move);
					this.table[move] = move_info;
				}

				let tmp;

				tmp = parseInt(InfoVal(s, "cp"), 10);		// Score in centipawns
				if (Number.isNaN(tmp) === false) {
					move_info.cp = tmp;				
				}

				tmp = parseInt(InfoVal(s, "multipv"), 10);	// Leela's ranking of the move, starting at 1
				if (Number.isNaN(tmp) === false) {
					move_info.multipv = tmp;
				}

				let new_pv = InfoPV(s);

				if (new_pv.length > 0) {
					if (CompareArrays(new_pv, move_info.pv) === false) {
						move_info.nice_pv_cache = null;
						move_info.pv = new_pv;
					}
				}

			} else if (s.startsWith("info string")) {

				this.drawn = false;

				// info string d2d4  (293 ) N:   12845 (+121) (P: 20.10%) (Q:  0.09001) (D:  0.000) (U: 0.02410) (Q+U:  0.11411) (V:  0.1006)

				let move = InfoVal(s, "string");

				let move_info;

				if (this.table[move]) {						// We already have move info for this move.
					move_info = this.table[move];
				} else {									// We don't.
					if (board.illegal(move) !== "") {
						Log(`... Nibbler: invalid move received!: ${move}`);
						return;
					}
					move_info = new_info(board, move);
					this.table[move] = move_info;
				}

				let tmp;

				tmp = parseInt(InfoVal(s, "N:"), 10);
				if (Number.isNaN(tmp) === false) {
					move_info.n = tmp;
				}

				tmp = parseFloat(InfoVal(s, "(D:"));
				if (Number.isNaN(tmp) === false) {
					move_info.d = tmp;
				}

				move_info.p = InfoVal(s, "(P:");			// Worst case here is just empty string, which is OK.

				tmp = parseFloat(InfoVal(s, "(Q:"));
				if (Number.isNaN(tmp) === false) {
					move_info.value = (tmp + 1) / 2;
				}
			}
		},

		sorted: function() {

			let info_list = [];

			for (let key of Object.keys(this.table)) {
				info_list.push(this.table[key]);
			}

			info_list.sort((a, b) => {

				// multipv ranking - lower is better...

				if (a.multipv < b.multipv) {
					return -1;
				}
				if (a.multipv > b.multipv) {
					return 1;
				}

				// node count - higher is better...

				if (a.n < b.n) {
					return 1;
				}
				if (a.n > b.n) {
					return -1;
				}

				// centipawn score - higher is better...

				if (a.cp < b.cp) {
					return 1;
				}
				if (a.cp > b.cp) {
					return -1;
				}

				return 0;
			});

			return info_list;
		}
	};
}
