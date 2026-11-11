// @ts-check

/**
 * @typedef {object} ChessPuzzle
 * @property {string} id
 * @property {{ en: string, de: string }} title
 * @property {string} fen
 * @property {string[]} moves Sequence of legal SAN moves for the puzzle
 * @property {{ en: string, de: string }} hint
 */

/** @type {ChessPuzzle[]} */
export const CHESS_PUZZLES = [
  {
    id: 'scholars-mate',
    title: { en: "Scholar's Finish", de: 'Schäfermatt-Finale' },
    fen: 'r1bqkb1r/pppp1ppp/2n2n2/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR w KQkq - 4 4',
    moves: ['Qxf7#'],
    hint: { en: 'Target the weak f7 square with your queen', de: 'Greife das schwache f7-Feld mit der Dame an' },
  },
  {
    id: 'back-rank-mate',
    title: { en: 'Back Rank Defeat', de: 'Grundreihenmatt' },
    fen: '3r2k1/5ppp/8/8/8/8/4R1PP/4R1K1 w - - 0 1',
    moves: ['Re8+', 'Rxe8', 'Rxe8#'],
    hint: {
      en: 'Sacrifice the first rook to break the 8th rank',
      de: 'Opfere den ersten Turm, um die 8. Reihe zu brechen',
    },
  },
  {
    id: 'opera-box',
    title: { en: 'Opera Box Deflection', de: 'Opern-Ablenkung' },
    fen: '4kb1r/p2n1ppp/4q3/4p1B1/4P3/1Q6/PPP2PPP/2KR4 w k - 1 1',
    moves: ['Qb8+', 'Nxb8', 'Rd8#'],
    hint: { en: 'Sacrifice the queen to deflect the defender', de: 'Opfere die Dame, um den Verteidiger abzulenken' },
  },
  {
    id: 'arabian-mate',
    title: { en: 'Arabian Mate', de: 'Arabisches Matt' },
    fen: '7k/5R2/5N2/8/8/8/8/6K1 w - - 0 1',
    moves: ['Rh7#'],
    hint: { en: 'Rook delivers mate protected by the knight', de: 'Turm setzt matt, gedeckt vom Springer' },
  },
  {
    id: 'fork-tactic',
    title: { en: 'Central Pawn Fork', de: 'Zentraler Bauerngewinn' },
    fen: 'r1bqk2r/pppp1ppp/2n5/4p3/2B1n3/3P1N2/PPP2PPP/RNBQK2R w KQkq - 0 5',
    moves: ['dxe4'],
    hint: { en: 'Capture the overextended black knight', de: 'Schlage den vorwitzigen schwarzen Springer' },
  },
  {
    id: 'corner-mate',
    title: { en: 'Corner Box', de: 'Eck-Abschnürung' },
    fen: 'k7/8/1K6/8/8/8/8/R7 w - - 0 1',
    moves: ['Rh1', 'Kb8', 'Rh8#'],
    hint: { en: 'Transfer your rook to the open h-file', de: 'Ziehe den Turm auf die offene h-Linie' },
  },
  {
    id: 'corridor-mate',
    title: { en: 'Corridor Mate', de: 'Korridormatt' },
    fen: '6k1/6pp/8/8/8/8/5Q2/6K1 w - - 0 1',
    moves: ['Qa2+', 'Kh8', 'Qa8#'],
    hint: {
      en: 'Check from the long diagonal then seal the back rank',
      de: 'Schach über die lange Diagonale und matt auf der Grundreihe',
    },
  },
  {
    id: 'rook-invasion',
    title: { en: 'Rook Invasion', de: 'Turm-Invasion' },
    fen: '5rk1/5ppp/8/8/8/8/5PPP/4R1K1 w - - 0 1',
    moves: ['Re8', 'Rxe8'],
    hint: { en: 'Invade the back rank with your rook', de: 'Dringe mit dem Turm in die Grundreihe ein' },
  },
];
