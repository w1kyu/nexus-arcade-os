// @ts-check
// Chess rules: position, move generation, FEN, SAN, and draw detection. Pure: no DOM.
//
// Board: 0x88 (square = rank * 16 + file; rank 0 is White's first rank). A square is on the board
// when (square & 0x88) === 0. Pieces: type 1–6 (P N B R Q K), plus 8 for Black.

export const PAWN = 1;
export const KNIGHT = 2;
export const BISHOP = 3;
export const ROOK = 4;
export const QUEEN = 5;
export const KING = 6;
export const WHITE = 0;
export const BLACK = 1;

export const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

const FLAG_EP = 1;
const FLAG_DOUBLE = 2;
const FLAG_CASTLE_K = 4;
const FLAG_CASTLE_Q = 8;

const KNIGHT_OFFSETS = [-33, -31, -18, -14, 14, 18, 31, 33];
const BISHOP_OFFSETS = [-17, -15, 15, 17];
const ROOK_OFFSETS = [-16, -1, 1, 16];
const KING_OFFSETS = [-17, -16, -15, -1, 1, 15, 16, 17];
const PIECE_LETTERS = ' PNBRQK';

/** Castling rights lost when a piece leaves or reaches a square (1 K, 2 Q, 4 k, 8 q). */
const CASTLE_MASK = new Uint8Array(128);
CASTLE_MASK[4] = 3;
CASTLE_MASK[7] = 1;
CASTLE_MASK[0] = 2;
CASTLE_MASK[116] = 12;
CASTLE_MASK[119] = 4;
CASTLE_MASK[112] = 8;

/**
 * @typedef {object} Move
 * @property {number} from
 * @property {number} to
 * @property {number} piece Moving piece (with color bit)
 * @property {number} captured Captured piece or 0
 * @property {number} promo Promotion piece type or 0
 * @property {number} flags
 */

export const typeOf = (/** @type {number} */ piece) => piece & 7;
export const colorOf = (/** @type {number} */ piece) => piece >> 3;
export const fileOf = (/** @type {number} */ sq) => sq & 7;
export const rankOf = (/** @type {number} */ sq) => sq >> 4;
/** @param {number} sq @returns {string} e.g. "e4" */
export const squareName = (sq) => 'abcdefgh'[sq & 7] + ((sq >> 4) + 1);
/** @param {string} name @returns {number} */
export const squareFromName = (name) => (name.charCodeAt(1) - 49) * 16 + (name.charCodeAt(0) - 97);
/** 0–63 index (a8 = 0 … h1 = 63), the order boards are drawn in. @param {number} sq */
export const to64 = (sq) => (7 - (sq >> 4)) * 8 + (sq & 7);
/** @param {number} index */
export const from64 = (index) => (7 - (index >> 3)) * 16 + (index & 7);
/** @param {Move} move @returns {string} e.g. "e7e8q" */
export const moveToUci = (move) =>
  squareName(move.from) + squareName(move.to) + (move.promo ? PIECE_LETTERS[move.promo].toLowerCase() : '');

export class Position {
  /** @param {string} [fen] */
  constructor(fen = START_FEN) {
    this.board = new Int8Array(128);
    this.turn = WHITE;
    this.castling = 0;
    this.ep = -1;
    this.halfmove = 0;
    this.fullmove = 1;
    this.kings = [-1, -1];
    /** @type {{ move: Move, castling: number, ep: number, halfmove: number }[]} */
    this.undoStack = [];
    this.load(fen);
  }

  /** @param {string} fen Throws on malformed input. */
  load(fen) {
    const parts = fen.trim().split(/\s+/);
    if (parts.length < 2) throw new Error('Invalid FEN');
    const rows = parts[0].split('/');
    if (rows.length !== 8) throw new Error('Invalid FEN: 8 ranks expected');
    this.board.fill(0);
    this.kings = [-1, -1];
    rows.forEach((row, i) => {
      let file = 0;
      for (const ch of row) {
        if (ch >= '1' && ch <= '8') {
          file += Number(ch);
          continue;
        }
        const type = PIECE_LETTERS.indexOf(ch.toUpperCase());
        if (type < 1 || file > 7) throw new Error('Invalid FEN: bad piece placement');
        const color = ch === ch.toUpperCase() ? WHITE : BLACK;
        const sq = (7 - i) * 16 + file;
        this.board[sq] = type | (color << 3);
        if (type === KING) this.kings[color] = sq;
        file++;
      }
      if (file !== 8) throw new Error('Invalid FEN: bad rank length');
    });
    if (this.kings[0] < 0 || this.kings[1] < 0) throw new Error('Invalid FEN: both kings are required');
    this.turn = parts[1] === 'b' ? BLACK : WHITE;
    this.castling = 0;
    for (const ch of parts[2] ?? '-') {
      const bit = { K: 1, Q: 2, k: 4, q: 8 }[ch];
      if (bit) this.castling |= bit;
    }
    // Rights without king and rook on their squares are meaningless (and would corrupt castling).
    if (this.board[4] !== KING || this.board[7] !== ROOK) this.castling &= ~1;
    if (this.board[4] !== KING || this.board[0] !== ROOK) this.castling &= ~2;
    if (this.board[116] !== (KING | 8) || this.board[119] !== (ROOK | 8)) this.castling &= ~4;
    if (this.board[116] !== (KING | 8) || this.board[112] !== (ROOK | 8)) this.castling &= ~8;
    this.ep = parts[3] && parts[3] !== '-' && /^[a-h][36]$/.test(parts[3]) ? squareFromName(parts[3]) : -1;
    this.halfmove = Number.parseInt(parts[4] ?? '0', 10) || 0;
    this.fullmove = Number.parseInt(parts[5] ?? '1', 10) || 1;
    this.undoStack = [];
    return this;
  }

  /** @returns {string} */
  fen() {
    let placement = '';
    for (let rank = 7; rank >= 0; rank--) {
      let empty = 0;
      for (let file = 0; file < 8; file++) {
        const piece = this.board[rank * 16 + file];
        if (!piece) {
          empty++;
          continue;
        }
        if (empty) placement += empty;
        empty = 0;
        const letter = PIECE_LETTERS[piece & 7];
        placement += piece >> 3 ? letter.toLowerCase() : letter;
      }
      if (empty) placement += empty;
      if (rank) placement += '/';
    }
    const rights =
      (this.castling & 1 ? 'K' : '') +
      (this.castling & 2 ? 'Q' : '') +
      (this.castling & 4 ? 'k' : '') +
      (this.castling & 8 ? 'q' : '');
    return `${placement} ${this.turn ? 'b' : 'w'} ${rights || '-'} ${this.ep >= 0 ? squareName(this.ep) : '-'} ${
      this.halfmove
    } ${this.fullmove}`;
  }

  /**
   * Identity of a position for repetition: placement, side to move, castling rights, and the
   * en-passant square only when a pawn could actually capture there.
   */
  key() {
    const [placement, turn, rights] = this.fen().split(' ');
    let ep = '-';
    if (this.ep >= 0) {
      const pawn = PAWN | (this.turn << 3);
      const behind = this.turn === WHITE ? -16 : 16;
      for (const side of [-1, 1]) {
        const sq = this.ep + behind + side;
        if (!(sq & 0x88) && this.board[sq] === pawn) ep = squareName(this.ep);
      }
    }
    return `${placement} ${turn} ${rights} ${ep}`;
  }

  /**
   * @param {number} sq
   * @param {number} by Attacking color
   */
  isAttacked(sq, by) {
    const board = this.board;
    const pawn = PAWN | (by << 3);
    if (by === WHITE) {
      if ((!((sq - 15) & 0x88) && board[sq - 15] === pawn) || (!((sq - 17) & 0x88) && board[sq - 17] === pawn))
        return true;
    } else if ((!((sq + 15) & 0x88) && board[sq + 15] === pawn) || (!((sq + 17) & 0x88) && board[sq + 17] === pawn))
      return true;
    const knight = KNIGHT | (by << 3);
    for (const o of KNIGHT_OFFSETS) if (!((sq + o) & 0x88) && board[sq + o] === knight) return true;
    const king = KING | (by << 3);
    for (const o of KING_OFFSETS) if (!((sq + o) & 0x88) && board[sq + o] === king) return true;
    const bishop = BISHOP | (by << 3);
    const rook = ROOK | (by << 3);
    const queen = QUEEN | (by << 3);
    for (const o of BISHOP_OFFSETS) {
      let t = sq + o;
      while (!(t & 0x88) && !board[t]) t += o;
      if (!(t & 0x88) && (board[t] === bishop || board[t] === queen)) return true;
    }
    for (const o of ROOK_OFFSETS) {
      let t = sq + o;
      while (!(t & 0x88) && !board[t]) t += o;
      if (!(t & 0x88) && (board[t] === rook || board[t] === queen)) return true;
    }
    return false;
  }

  /** @param {number} [color] Defaults to the side to move */
  inCheck(color = this.turn) {
    return this.isAttacked(this.kings[color], color ^ 1);
  }

  /**
   * Pseudo-legal moves (may leave the own king in check).
   * @param {boolean} [capturesOnly] Captures and promotions only (quiescence search)
   * @returns {Move[]}
   */
  pseudoMoves(capturesOnly = false) {
    const board = this.board;
    const us = this.turn;
    const them = us ^ 1;
    /** @type {Move[]} */
    const moves = [];
    const add = (/** @type {number} */ from, /** @type {number} */ to, /** @type {number} */ flags = 0) => {
      const piece = board[from];
      const captured = flags & FLAG_EP ? PAWN | (them << 3) : board[to];
      if ((piece & 7) === PAWN && (to >> 4 === 7 || to >> 4 === 0)) {
        for (const promo of [QUEEN, ROOK, BISHOP, KNIGHT]) moves.push({ from, to, piece, captured, promo, flags });
      } else moves.push({ from, to, piece, captured, promo: 0, flags });
    };

    for (let sq = 0; sq < 120; sq++) {
      if (sq & 0x88) {
        sq += 7;
        continue;
      }
      const piece = board[sq];
      if (!piece || piece >> 3 !== us) continue;
      const type = piece & 7;
      if (type === PAWN) {
        const dir = us === WHITE ? 16 : -16;
        const one = sq + dir;
        const promoting = one >> 4 === 7 || one >> 4 === 0;
        if (!board[one] && (!capturesOnly || promoting)) {
          add(sq, one);
          const startRank = us === WHITE ? 1 : 6;
          if (sq >> 4 === startRank && !board[one + dir]) add(sq, one + dir, FLAG_DOUBLE);
        }
        for (const side of [-1, 1]) {
          const to = one + side;
          if (to & 0x88) continue;
          if (board[to] && board[to] >> 3 === them) add(sq, to);
          else if (to === this.ep) add(sq, to, FLAG_EP);
        }
        continue;
      }
      const offsets =
        type === KNIGHT
          ? KNIGHT_OFFSETS
          : type === BISHOP
            ? BISHOP_OFFSETS
            : type === ROOK
              ? ROOK_OFFSETS
              : KING_OFFSETS;
      const slides = type === BISHOP || type === ROOK || type === QUEEN;
      for (const o of offsets) {
        let to = sq + o;
        while (!(to & 0x88)) {
          const target = board[to];
          if (!target) {
            if (!capturesOnly) add(sq, to);
          } else {
            if (target >> 3 === them) add(sq, to);
            break;
          }
          if (!slides) break;
          to += o;
        }
      }
      if (type === KING && !capturesOnly) {
        const kingBit = us === WHITE ? 1 : 4;
        const queenBit = us === WHITE ? 2 : 8;
        if (this.castling & (kingBit | queenBit) && !this.isAttacked(sq, them)) {
          if (
            this.castling & kingBit &&
            !board[sq + 1] &&
            !board[sq + 2] &&
            !this.isAttacked(sq + 1, them) &&
            !this.isAttacked(sq + 2, them)
          )
            add(sq, sq + 2, FLAG_CASTLE_K);
          if (
            this.castling & queenBit &&
            !board[sq - 1] &&
            !board[sq - 2] &&
            !board[sq - 3] &&
            !this.isAttacked(sq - 1, them) &&
            !this.isAttacked(sq - 2, them)
          )
            add(sq, sq - 2, FLAG_CASTLE_Q);
        }
      }
    }
    return moves;
  }

  /** @param {Move} move */
  make(move) {
    const board = this.board;
    const us = this.turn;
    this.undoStack.push({ move, castling: this.castling, ep: this.ep, halfmove: this.halfmove });
    board[move.from] = 0;
    board[move.to] = move.promo ? move.promo | (us << 3) : move.piece;
    if (move.flags & FLAG_EP) board[move.to + (us === WHITE ? -16 : 16)] = 0;
    else if (move.flags & FLAG_CASTLE_K) {
      board[move.to - 1] = board[move.to + 1];
      board[move.to + 1] = 0;
    } else if (move.flags & FLAG_CASTLE_Q) {
      board[move.to + 1] = board[move.to - 2];
      board[move.to - 2] = 0;
    }
    if ((move.piece & 7) === KING) this.kings[us] = move.to;
    this.ep = move.flags & FLAG_DOUBLE ? (move.from + move.to) >> 1 : -1;
    this.castling &= ~(CASTLE_MASK[move.from] | CASTLE_MASK[move.to]);
    this.halfmove = (move.piece & 7) === PAWN || move.captured ? 0 : this.halfmove + 1;
    if (us === BLACK) this.fullmove++;
    this.turn = us ^ 1;
  }

  unmake() {
    const undo = this.undoStack.pop();
    if (!undo) return;
    const { move } = undo;
    const board = this.board;
    const us = this.turn ^ 1;
    this.turn = us;
    if (us === BLACK) this.fullmove--;
    this.castling = undo.castling;
    this.ep = undo.ep;
    this.halfmove = undo.halfmove;
    board[move.from] = move.piece;
    if (move.flags & FLAG_EP) {
      board[move.to] = 0;
      board[move.to + (us === WHITE ? -16 : 16)] = move.captured;
    } else {
      board[move.to] = move.captured;
      if (move.flags & FLAG_CASTLE_K) {
        board[move.to + 1] = board[move.to - 1];
        board[move.to - 1] = 0;
      } else if (move.flags & FLAG_CASTLE_Q) {
        board[move.to - 2] = board[move.to + 1];
        board[move.to + 1] = 0;
      }
    }
    if ((move.piece & 7) === KING) this.kings[us] = move.from;
  }

  /** @returns {Move[]} */
  legalMoves() {
    const us = this.turn;
    return this.pseudoMoves().filter((move) => {
      this.make(move);
      const legal = !this.isAttacked(this.kings[us], us ^ 1);
      this.unmake();
      return legal;
    });
  }

  /**
   * True when neither side can possibly checkmate: bare kings, a single minor piece, or only
   * bishops that all stand on squares of one color.
   */
  insufficientMaterial() {
    let knights = 0;
    /** @type {number[]} */
    const bishopColors = [];
    for (let sq = 0; sq < 120; sq++) {
      if (sq & 0x88) continue;
      const type = this.board[sq] & 7;
      if (type === PAWN || type === ROOK || type === QUEEN) return false;
      if (type === KNIGHT) knights++;
      else if (type === BISHOP) bishopColors.push(((sq >> 4) + (sq & 7)) & 1);
    }
    if (knights === 0) return bishopColors.every((c) => c === bishopColors[0]);
    return knights === 1 && bishopColors.length === 0;
  }

  /** @param {number} depth @returns {number} */
  perft(depth) {
    if (depth === 0) return 1;
    let nodes = 0;
    const us = this.turn;
    for (const move of this.pseudoMoves()) {
      this.make(move);
      if (!this.isAttacked(this.kings[us], us ^ 1)) nodes += depth === 1 ? 1 : this.perft(depth - 1);
      this.unmake();
    }
    return nodes;
  }

  /**
   * Standard Algebraic Notation of a legal move in this position.
   * @param {Move} move
   * @param {Move[]} [legal] Legal moves, if already known
   */
  san(move, legal = this.legalMoves()) {
    let text;
    if (move.flags & FLAG_CASTLE_K) text = 'O-O';
    else if (move.flags & FLAG_CASTLE_Q) text = 'O-O-O';
    else {
      const type = move.piece & 7;
      const dest = squareName(move.to);
      if (type === PAWN) {
        text = (move.captured ? `${'abcdefgh'[move.from & 7]}x` : '') + dest;
        if (move.promo) text += `=${PIECE_LETTERS[move.promo]}`;
      } else {
        const rivals = legal.filter((m) => m.piece === move.piece && m.to === move.to && m.from !== move.from);
        let origin = '';
        if (rivals.length) {
          const sameFile = rivals.some((m) => (m.from & 7) === (move.from & 7));
          const sameRank = rivals.some((m) => m.from >> 4 === move.from >> 4);
          if (!sameFile) origin = 'abcdefgh'[move.from & 7];
          else if (!sameRank) origin = String((move.from >> 4) + 1);
          else origin = squareName(move.from);
        }
        text = PIECE_LETTERS[type] + origin + (move.captured ? 'x' : '') + dest;
      }
    }
    this.make(move);
    if (this.inCheck()) text += this.legalMoves().length ? '+' : '#';
    this.unmake();
    return text;
  }

  /**
   * Finds the legal move a SAN (or coordinate, e.g. "e2e4") string means; lenient about
   * check marks, annotations and zeros for castling.
   * @param {string} text
   * @returns {Move | null}
   */
  parseMove(text) {
    const legal = this.legalMoves();
    const clean = text
      .replace(/[+#!?]+$/g, '')
      .replace(/0/g, 'O')
      .replace(/e\.p\.$/, '')
      .trim();
    const uci = /^([a-h][1-8])([a-h][1-8])([qrbn])?$/.exec(text.trim().toLowerCase());
    if (uci) {
      const hit = legal.find(
        (m) =>
          squareName(m.from) === uci[1] &&
          squareName(m.to) === uci[2] &&
          (m.promo ? PIECE_LETTERS[m.promo].toLowerCase() === (uci[3] ?? 'q') : true),
      );
      if (hit) return hit;
    }
    const strip = (/** @type {string} */ s) => s.replace(/[+#=x]/g, '');
    const wanted = strip(clean);
    const hits = legal.filter((m) => strip(this.san(m, legal)) === wanted);
    if (hits.length === 1) return hits[0];
    // Over-specified origins ("Nb1d2" where "Nbd2" or "Nd2" would do).
    const full = /^([NBRQK])([a-h])?([1-8])?x?([a-h][1-8])$/.exec(clean.replace(/[=]/g, ''));
    if (full) {
      const candidates = legal.filter(
        (m) =>
          PIECE_LETTERS[m.piece & 7] === full[1] &&
          squareName(m.to) === full[4] &&
          (!full[2] || 'abcdefgh'[m.from & 7] === full[2]) &&
          (!full[3] || String((m.from >> 4) + 1) === full[3]),
      );
      if (candidates.length === 1) return candidates[0];
    }
    return null;
  }
}

/**
 * @typedef {object} GameStatus
 * @property {'playing' | 'checkmate' | 'stalemate' | 'draw'} state
 * @property {'repetition' | 'fifty' | 'material' | null} reason Why it is a draw
 * @property {number | null} winner WHITE or BLACK
 * @property {boolean} check
 */

/** A game: a start position plus the moves played, with SAN and repetition tracking. */
export class Game {
  /** @param {string} [fen] */
  constructor(fen = START_FEN) {
    this.startFen = fen;
    this.pos = new Position(fen);
    /** @type {{ move: Move, san: string, fen: string }[]} */
    this.moves = [];
    this.keys = [this.pos.key()];
  }

  /** @param {Move} move A legal move of the current position */
  play(move) {
    const san = this.pos.san(move);
    this.pos.make(move);
    this.moves.push({ move, san, fen: this.pos.fen() });
    this.keys.push(this.pos.key());
    return san;
  }

  /** Plays a move given as SAN or coordinates; returns false if it is not legal. @param {string} text */
  playText(text) {
    const move = this.pos.parseMove(text);
    if (!move) return false;
    this.play(move);
    return true;
  }

  undo() {
    if (!this.moves.length) return false;
    this.pos.unmake();
    this.moves.pop();
    this.keys.pop();
    return true;
  }

  /** FEN after `ply` moves (0 = start position). @param {number} ply */
  fenAt(ply) {
    return ply <= 0 ? this.startFen : this.moves[Math.min(ply, this.moves.length) - 1].fen;
  }

  /** How often the current position has occurred. */
  repetitions() {
    const current = this.keys.at(-1);
    return this.keys.filter((k) => k === current).length;
  }

  /** @returns {GameStatus} */
  status() {
    const pos = this.pos;
    const check = pos.inCheck();
    if (pos.legalMoves().length === 0)
      return check
        ? { state: 'checkmate', reason: null, winner: pos.turn ^ 1, check }
        : { state: 'stalemate', reason: null, winner: null, check };
    if (pos.insufficientMaterial()) return { state: 'draw', reason: 'material', winner: null, check };
    if (pos.halfmove >= 100) return { state: 'draw', reason: 'fifty', winner: null, check };
    if (this.repetitions() >= 3) return { state: 'draw', reason: 'repetition', winner: null, check };
    return { state: 'playing', reason: null, winner: null, check };
  }
}
