// @ts-check

/**
 * Quiz Arena Question Engine, Streak Multipliers & Pack Validator
 */

/**
 * @typedef {object} Question
 * @property {string} id
 * @property {string} category 'cs' | 'web' | 'logic' | 'general'
 * @property {{ en: string, de: string }} text
 * @property {{ en: string[], de: string[] }} options 4 options
 * @property {number} correct Index of correct option (0..3)
 * @property {{ en: string, de: string }} explanation
 */

export const BUNDLED_QUESTIONS = [
  // CS Basics
  {
    id: 'cs_1',
    category: 'cs',
    text: {
      en: 'What is the average time complexity of searching in a balanced Binary Search Tree?',
      de: 'Wie lautet die durchschnittliche Zeitkomplexität für die Suche in einem balancierten binären Suchbaum?',
    },
    options: {
      en: ['O(1)', 'O(log n)', 'O(n)', 'O(n log n)'],
      de: ['O(1)', 'O(log n)', 'O(n)', 'O(n log n)'],
    },
    correct: 1,
    explanation: {
      en: 'Balanced BSTs halve the search space at each node, resulting in logarithmic O(log n) average time.',
      de: 'Balancierte binäre Suchbäume halbieren den Suchraum bei jedem Knoten, was zu logarithmischer O(log n) Zeit führt.',
    },
  },
  {
    id: 'cs_2',
    category: 'cs',
    text: {
      en: 'Which data structure operates on a Last-In, First-Out (LIFO) principle?',
      de: 'Welche Datenstruktur arbeitet nach dem Last-In, First-Out (LIFO)-Prinzip?',
    },
    options: {
      en: ['Queue', 'Stack', 'Linked List', 'Hash Map'],
      de: ['Queue (Warteschlange)', 'Stack (Stapelspeicher)', 'Verkettete Liste', 'Hash-Map'],
    },
    correct: 1,
    explanation: {
      en: 'A Stack pushes and pops items from the top, making the last added item the first to be removed.',
      de: 'Ein Stack legt Elemente oben ab und entfernt sie von oben, sodass das zuletzt hinzugefügte Element als erstes entnommen wird.',
    },
  },
  {
    id: 'cs_3',
    category: 'cs',
    text: {
      en: 'In operating systems, what is a condition where two or more processes are unable to proceed because each is waiting for the other?',
      de: 'Wie nennt man in Betriebssystemen den Zustand, bei dem zwei Prozesse blockiert sind, weil jeder auf den anderen wartet?',
    },
    options: {
      en: ['Starvation', 'Deadlock', 'Race Condition', 'Context Switch'],
      de: ['Starvation (Verhungern)', 'Deadlock (Verklemmung)', 'Race Condition', 'Kontextwechsel'],
    },
    correct: 1,
    explanation: {
      en: 'A deadlock occurs when processes hold resources and wait indefinitely for resources held by each other.',
      de: 'Ein Deadlock entsteht, wenn Prozesse Ressourcen belegen und wechselseitig auf die vom anderen gehaltenen Ressourcen warten.',
    },
  },
  {
    id: 'cs_4',
    category: 'cs',
    text: {
      en: 'What is the hexadecimal representation of the decimal number 255?',
      de: 'Wie lautet die hexadezimale Darstellung der Dezimalzahl 255?',
    },
    options: {
      en: ['0xFE', '0xFF', '0x100', '0xEF'],
      de: ['0xFE', '0xFF', '0x100', '0xEF'],
    },
    correct: 1,
    explanation: {
      en: '15 * 16 + 15 = 240 + 15 = 255, which is represented by FF in hexadecimal.',
      de: '15 * 16 + 15 = 240 + 15 = 255, was im Hexadezimalsystem FF entspricht.',
    },
  },

  // Web & Dev
  {
    id: 'web_1',
    category: 'web',
    text: {
      en: 'Which HTTP status code signifies that a resource was successfully created?',
      de: 'Welcher HTTP-Statuscode signalisiert, dass eine Ressource erfolgreich erstellt wurde?',
    },
    options: {
      en: ['200 OK', '201 Created', '204 No Content', '304 Not Modified'],
      de: ['200 OK', '201 Created', '204 No Content', '304 Not Modified'],
    },
    correct: 1,
    explanation: {
      en: 'HTTP 201 Created is the standard REST response when a POST request successfully creates a new resource.',
      de: 'HTTP 201 Created ist die Standard-REST-Antwort, wenn ein POST-Request eine neue Ressource erfolgreich erzeugt.',
    },
  },
  {
    id: 'web_2',
    category: 'web',
    text: {
      en: 'In the JavaScript event loop, which queue has priority for task execution before macrotasks?',
      de: 'Welche Warteschlange hat in der JavaScript-Event-Loop vor Makrotasks Vorrang bei der Ausführung?',
    },
    options: {
      en: ['Microtask Queue', 'Timer Queue', 'I/O Queue', 'Animation Frame Queue'],
      de: ['Microtask Queue', 'Timer Queue', 'I/O Queue', 'Animation Frame Queue'],
    },
    correct: 0,
    explanation: {
      en: 'Microtasks (Promises, queueMicrotask) are drained completely at the end of the current execution and before the next macrotask.',
      de: 'Microtasks (Promises, queueMicrotask) werden am Ende der aktuellen Ausführung vor der nächsten Makrotask vollständig abgearbeitet.',
    },
  },

  // Logic & Math
  {
    id: 'logic_1',
    category: 'logic',
    text: {
      en: 'What is the boolean logic equivalent of NOT (A AND B)?',
      de: 'Was ist das logische Äquivalent von NOT (A AND B) nach De Morgan?',
    },
    options: {
      en: ['(NOT A) AND (NOT B)', '(NOT A) OR (NOT B)', 'NOT (A OR B)', 'A OR B'],
      de: ['(NICHT A) UND (NICHT B)', '(NICHT A) ODER (NICHT B)', 'NICHT (A ODER B)', 'A ODER B'],
    },
    correct: 1,
    explanation: {
      en: "According to De Morgan's laws: !(A && B) == (!A || !B).",
      de: 'Nach den De-Morganschen Gesetzen gilt: !(A && B) == (!A || !B).',
    },
  },
  {
    id: 'logic_2',
    category: 'logic',
    text: {
      en: 'If 5 machines take 5 minutes to make 5 widgets, how many minutes would it take 100 machines to make 100 widgets?',
      de: 'Wenn 5 Maschinen 5 Minuten brauchen, um 5 Werkstücke herzustellen, wie viele Minuten brauchen dann 100 Maschinen für 100 Werkstücke?',
    },
    options: {
      en: ['100 minutes', '5 minutes', '1 minute', '20 minutes'],
      de: ['100 Minuten', '5 Minuten', '1 Minute', '20 Minuten'],
    },
    correct: 1,
    explanation: {
      en: 'Each machine takes 5 minutes to make 1 widget. Thus, 100 machines running simultaneously produce 100 widgets in 5 minutes.',
      de: 'Jede Maschine braucht 5 Minuten für 1 Werkstück. 100 Maschinen parallel brauchen daher ebenfalls 5 Minuten für 100 Werkstücke.',
    },
  },

  // General Knowledge
  {
    id: 'gen_1',
    category: 'general',
    text: {
      en: 'Who is widely credited as the world’s first computer programmer for writing an algorithm for the Analytical Engine?',
      de: 'Wer gilt als erste Programmiererin der Welt durch das Schreiben eines Algorithmus für die Analytical Engine?',
    },
    options: {
      en: ['Ada Lovelace', 'Grace Hopper', 'Alan Turing', 'Margaret Hamilton'],
      de: ['Ada Lovelace', 'Grace Hopper', 'Alan Turing', 'Margaret Hamilton'],
    },
    correct: 0,
    explanation: {
      en: 'Ada Lovelace published the first algorithm intended to be carried out by Charles Babbage’s mechanical Analytical Engine in 1843.',
      de: 'Ada Lovelace veröffentlichte 1843 den ersten Algorithmus für die mechanische Analytical Engine von Charles Babbage.',
    },
  },
  {
    id: 'gen_2',
    category: 'general',
    text: {
      en: 'Which chemical element has the atomic number 1 and is the most abundant element in the universe?',
      de: 'Welches chemische Element hat die Ordnungszahl 1 und ist das häufigste Element im Universum?',
    },
    options: {
      en: ['Helium', 'Hydrogen', 'Carbon', 'Oxygen'],
      de: ['Helium', 'Wasserstoff', 'Kohlenstoff', 'Sauerstoff'],
    },
    correct: 1,
    explanation: {
      en: 'Hydrogen (H) has atomic number 1 and constitutes approximately 75% of all baryonic mass in the universe.',
      de: 'Wasserstoff (H) hat die Ordnungszahl 1 und macht etwa 75 % der normalen Materie im Universum aus.',
    },
  },
];

/**
 * Calculates streak score multiplier
 * @param {number} streak
 */
export function getStreakMultiplier(streak) {
  if (streak >= 5) return 3.0;
  if (streak >= 3) return 2.0;
  if (streak >= 2) return 1.5;
  return 1.0;
}

/**
 * Applies 50:50 Lifeline to eliminate 2 incorrect answers
 * @param {number} correctIndex 0..3
 * @returns {number[]} Array of 2 indices to eliminate
 */
export function get5050Eliminations(correctIndex) {
  const incorrect = [0, 1, 2, 3].filter((i) => i !== correctIndex);
  // Shuffle incorrect and take 2
  for (let i = incorrect.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [incorrect[i], incorrect[j]] = [incorrect[j], incorrect[i]];
  }
  return incorrect.slice(0, 2);
}

/**
 * Validates a custom quiz pack JSON
 * @param {any} pack
 */
export function validateQuizPack(pack) {
  if (!pack || typeof pack !== 'object') return false;
  if (typeof pack.title !== 'string' || !Array.isArray(pack.questions)) return false;
  if (pack.questions.length === 0) return false;

  for (const q of pack.questions) {
    if (!q.text || !q.options || !Array.isArray(q.options) || q.options.length !== 4) return false;
    if (typeof q.correct !== 'number' || q.correct < 0 || q.correct > 3) return false;
  }
  return true;
}
