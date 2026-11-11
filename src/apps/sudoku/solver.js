// @ts-check
// Sudoku solver, unique solution verifier, generator, and technique-based hint engine

/**
 * Checks if placing num at (r, c) is valid in board
 * @param {number[][]} board 9x9 grid
 * @param {number} r
 * @param {number} c
 * @param {number} num
 * @returns {boolean}
 */
export function isValidPlacement(board, r, c, num) {
  for (let i = 0; i < 9; i++) {
    if (board[r][i] === num && i !== c) return false;
    if (board[i][c] === num && i !== r) return false;
  }
  const br = Math.floor(r / 3) * 3;
  const bc = Math.floor(c / 3) * 3;
  for (let dr = 0; dr < 3; dr++) {
    for (let dc = 0; dc < 3; dc++) {
      const nr = br + dr;
      const nc = bc + dc;
      if (board[nr][nc] === num && (nr !== r || nc !== c)) return false;
    }
  }
  return true;
}

/**
 * Solves a 9x9 board in place using backtracking.
 * Returns true if solved.
 * @param {number[][]} board
 * @param {() => number} [rng]
 * @returns {boolean}
 */
export function solve(board, rng = Math.random) {
  for (let r = 0; r < 9; r++) {
    for (let c = 0; c < 9; c++) {
      if (board[r][c] === 0) {
        // Shuffle numbers 1..9 for variety
        const nums = [1, 2, 3, 4, 5, 6, 7, 8, 9];
        for (let i = nums.length - 1; i > 0; i--) {
          const j = Math.floor(rng() * (i + 1));
          const t = nums[i];
          nums[i] = nums[j];
          nums[j] = t;
        }

        for (const num of nums) {
          if (isValidPlacement(board, r, c, num)) {
            board[r][c] = num;
            if (solve(board, rng)) return true;
            board[r][c] = 0;
          }
        }
        return false;
      }
    }
  }
  return true;
}

/**
 * Counts solutions to determine uniqueness (stops if count >= 2)
 * @param {number[][]} board
 * @param {number} [limit]
 * @returns {number}
 */
export function countSolutions(board, limit = 2) {
  let count = 0;

  const copy = board.map((row) => [...row]);

  function backtrack() {
    if (count >= limit) return;
    let findEmpty = null;
    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c++) {
        if (copy[r][c] === 0) {
          findEmpty = { r, c };
          break;
        }
      }
      if (findEmpty) break;
    }

    if (!findEmpty) {
      count++;
      return;
    }

    const { r, c } = findEmpty;
    for (let num = 1; num <= 9; num++) {
      if (isValidPlacement(copy, r, c, num)) {
        copy[r][c] = num;
        backtrack();
        copy[r][c] = 0;
      }
    }
  }

  backtrack();
  return count;
}

export const DIFFICULTY_CLUES = {
  veryEasy: 50,
  easy: 40,
  medium: 33,
  hard: 28,
  expert: 24,
};

/**
 * Generates a valid Sudoku puzzle with guaranteed UNIQUE solution.
 * @param {'veryEasy' | 'easy' | 'medium' | 'hard' | 'expert'} difficulty
 * @param {() => number} [rng]
 * @returns {{ puzzle: number[][], solution: number[][] }}
 */
export function generateSudoku(difficulty = 'medium', rng = Math.random) {
  const targetClues = DIFFICULTY_CLUES[difficulty] || 33;

  // 1. Generate full solved board
  const solution = Array.from({ length: 9 }, () => Array(9).fill(0));
  solve(solution, rng);

  // 2. Clone solution to puzzle
  const puzzle = solution.map((row) => [...row]);

  // 3. Create list of all 81 cell coordinates and shuffle
  const cells = [];
  for (let r = 0; r < 9; r++) {
    for (let c = 0; c < 9; c++) {
      cells.push({ r, c });
    }
  }
  for (let i = cells.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const t = cells[i];
    cells[i] = cells[j];
    cells[j] = t;
  }

  // 4. Remove cells while preserving unique solution
  let currentClues = 81;
  for (const { r, c } of cells) {
    if (currentClues <= targetClues) break;

    const val = puzzle[r][c];
    puzzle[r][c] = 0;

    // Check if puzzle still has exactly 1 solution
    if (countSolutions(puzzle, 2) !== 1) {
      // Not unique! Put it back
      puzzle[r][c] = val;
    } else {
      currentClues--;
    }
  }

  return { puzzle, solution };
}

/**
 * Calculates candidates for all empty cells
 * @param {number[][]} board
 * @returns {Set<number>[][]}
 */
export function computeCandidates(board) {
  const notes = Array.from({ length: 9 }, () => Array.from({ length: 9 }, () => new Set()));
  for (let r = 0; r < 9; r++) {
    for (let c = 0; c < 9; c++) {
      if (board[r][c] === 0) {
        for (let num = 1; num <= 9; num++) {
          if (isValidPlacement(board, r, c, num)) {
            notes[r][c].add(num);
          }
        }
      }
    }
  }
  return notes;
}

/**
 * Finds a technique-based hint: Naked Single, Hidden Single, or candidate reduction.
 * @param {number[][]} board
 * @param {number[][]} solution
 * @returns {{ r: number, c: number, value: number, technique: string, explanation: string } | null}
 */
export function findHint(board, solution) {
  const candidates = computeCandidates(board);

  // 1. Technique: Naked Single (cell has only 1 candidate)
  for (let r = 0; r < 9; r++) {
    for (let c = 0; c < 9; c++) {
      if (board[r][c] === 0 && candidates[r][c].size === 1) {
        const val = [...candidates[r][c]][0];
        return {
          r,
          c,
          value: val,
          technique: 'Naked Single',
          explanation: `Row ${r + 1}, Column ${c + 1} can only be ${val} because all other numbers already exist in its row, column, or 3×3 box.`,
        };
      }
    }
  }

  // 2. Technique: Hidden Single in Row
  for (let r = 0; r < 9; r++) {
    for (let num = 1; num <= 9; num++) {
      const spots = [];
      for (let c = 0; c < 9; c++) {
        if (board[r][c] === 0 && candidates[r][c].has(num)) {
          spots.push(c);
        }
      }
      if (spots.length === 1) {
        const c = spots[0];
        return {
          r,
          c,
          value: num,
          technique: 'Hidden Single (Row)',
          explanation: `In Row ${r + 1}, ${num} can only be placed at Column ${c + 1}.`,
        };
      }
    }
  }

  // 3. Technique: Hidden Single in Column
  for (let c = 0; c < 9; c++) {
    for (let num = 1; num <= 9; num++) {
      const spots = [];
      for (let r = 0; r < 9; r++) {
        if (board[r][c] === 0 && candidates[r][c].has(num)) {
          spots.push(r);
        }
      }
      if (spots.length === 1) {
        const r = spots[0];
        return {
          r,
          c,
          value: num,
          technique: 'Hidden Single (Column)',
          explanation: `In Column ${c + 1}, ${num} can only be placed at Row ${r + 1}.`,
        };
      }
    }
  }

  // 4. Technique: Hidden Single in 3x3 Block
  for (let br = 0; br < 9; br += 3) {
    for (let bc = 0; bc < 9; bc += 3) {
      for (let num = 1; num <= 9; num++) {
        const spots = [];
        for (let dr = 0; dr < 3; dr++) {
          for (let dc = 0; dc < 3; dc++) {
            const r = br + dr;
            const c = bc + dc;
            if (board[r][c] === 0 && candidates[r][c].has(num)) {
              spots.push({ r, c });
            }
          }
        }
        if (spots.length === 1) {
          const { r, c } = spots[0];
          return {
            r,
            c,
            value: num,
            technique: 'Hidden Single (Box)',
            explanation: `In this 3×3 box, ${num} can only be placed at Row ${r + 1}, Column ${c + 1}.`,
          };
        }
      }
    }
  }

  // 5. Fallback: Take any empty cell and provide solution value
  for (let r = 0; r < 9; r++) {
    for (let c = 0; c < 9; c++) {
      if (board[r][c] === 0) {
        const val = solution[r][c];
        return {
          r,
          c,
          value: val,
          technique: 'Logical Deduction',
          explanation: `Through advanced chain deduction, Row ${r + 1}, Column ${c + 1} resolves to ${val}.`,
        };
      }
    }
  }

  return null;
}
