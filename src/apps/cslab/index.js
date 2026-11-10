// @ts-check
import { h } from '../../ui/dom.js';
import './styles.css';

export const CSLAB_TOOLS = [
  {
    id: 'nexus.sorting',
    name: { en: 'Sorting Visualizer', de: 'Sortieralgorithmen-Visualisierer' },
    category: 'algorithms',
    badge: 'Algorithms',
    description: {
      en: '10 sorting algorithms, comparison audio synthesizer, race mode, and complexity analysis.',
      de: '10 Sortierverfahren, Tonsynthesizer, Wettkampf-Modus und Komplexitätsanalyse.',
    },
    keywords: ['bubble', 'quick', 'merge', 'heap', 'radix', 'lomuto', 'hoare', 'complexity', 'sort'],
  },
  {
    id: 'nexus.pathfinding',
    name: { en: 'Pathfinding & Maze Lab', de: 'Wegfindung & Labyrinthe' },
    category: 'algorithms',
    badge: 'Algorithms',
    description: {
      en: 'BFS, DFS, Dijkstra, A*, Greedy Best-First, and 5 procedural maze generators.',
      de: 'BFS, DFS, Dijkstra, A*, Greedy-Suche und 5 Labyrinth-Generatoren.',
    },
    keywords: ['dijkstra', 'astar', 'bfs', 'dfs', 'heuristics', 'maze', 'kruskal', 'prim', 'path'],
  },
  {
    id: 'nexus.graphlab',
    name: { en: 'Graph Editor & Algorithms', de: 'Graph-Editor & Algorithmen' },
    category: 'algorithms',
    badge: 'Algorithms',
    description: {
      en: 'Interactive graph canvas with 12 step-by-step algorithms, layouts, and DOT export.',
      de: 'Interaktiver Graph-Editor mit 12 Algorithmen, Layouts und DOT-Export.',
    },
    keywords: ['graph', 'bellman-ford', 'floyd-warshall', 'mst', 'tarjan', 'topological', 'bipartite'],
  },
  {
    id: 'nexus.datastructures',
    name: { en: 'Data Structures Visualizer', de: 'Datenstrukturen-Visualisierer' },
    category: 'dataStructures',
    badge: 'Data Structures',
    description: {
      en: '11 interactive data structures with AVL tree rotations, binary heaps, hash tables, and tries.',
      de: '11 interaktive Datenstrukturen mit AVL-Rotationen, Heaps, Hashtabellen und Tries.',
    },
    keywords: ['tree', 'avl', 'heap', 'hash', 'trie', 'stack', 'queue', 'linked list'],
  },
  {
    id: 'nexus.automata',
    name: { en: 'Automata Lab', de: 'Automaten-Labor' },
    category: 'theory',
    badge: 'Theoretical CS',
    description: {
      en: 'DFA and NFA simulator, NFA to DFA subset construction, minimization, and Thompson regex.',
      de: 'DFA/NFA-Simulator, Potenzmengenkonstruktion, Minimierung und Thompson-Regex.',
    },
    keywords: ['dfa', 'nfa', 'automata', 'regex', 'thompson', 'hopcroft', 'formal languages'],
  },
  {
    id: 'nexus.turing',
    name: { en: 'Turing Machine Simulator', de: 'Turing-Maschinen-Simulator' },
    category: 'theory',
    badge: 'Theoretical CS',
    description: {
      en: 'Single-tape Turing Machine with animated head, state table, and busy beaver machines.',
      de: '1-Band-Turing-Maschine mit Bandkopf-Animation, Zustandstabelle und Fleißigen Bibern.',
    },
    keywords: ['turing', 'tape', 'halting', 'busy beaver', 'computation', 'theory'],
  },
  {
    id: 'nexus.circuits',
    name: { en: 'Logic Circuit & Boolean Lab', de: 'Logikgatter & Boolesche Algebra' },
    category: 'hardware',
    badge: 'Digital Logic',
    description: {
      en: 'Gate-level digital simulator, truth tables, KV maps, and Quine-McCluskey minimization.',
      de: 'Schaltungssimulator, Wahrheitstabellen, KV-Diagramme und Quine-McCluskey.',
    },
    keywords: ['circuit', 'gate', 'boolean', 'karnaugh', 'kv map', 'quine mccluskey', 'adder'],
  },
  {
    id: 'nexus.archlab',
    name: { en: 'Number & CPU Lab', de: 'Zahlendarstellung & CPU-Lab' },
    category: 'hardware',
    badge: 'Architecture',
    description: {
      en: 'IEEE 754 floating-point inspector, integer formats, and Nexus-8 toy CPU simulator.',
      de: 'IEEE 754 Gleitkomma-Inspektor, Ganzzahl-Formate und Nexus-8 CPU-Simulator.',
    },
    keywords: ['cpu', 'assembly', 'architecture', 'ieee 754', 'float', 'twos complement', 'registers'],
  },
];

export const SYLLABUS_TOPICS = [
  { id: 'sort_quick', text: 'Quicksort Partitioning (Hoare & Lomuto)' },
  { id: 'path_dijkstra', text: 'Dijkstra & A* Shortest Paths' },
  { id: 'graph_mst', text: 'Minimum Spanning Trees (Prim & Kruskal)' },
  { id: 'ds_avl', text: 'AVL Tree Balancing & Rotations (LL, RR, LR, RL)' },
  { id: 'theory_nfa_dfa', text: 'NFA to DFA Subset Construction' },
  { id: 'theory_turing', text: 'Turing Machines & Halting Problem' },
  { id: 'logic_kv', text: 'Boolean Minimization via KV Maps & Quine-McCluskey' },
  { id: 'arch_ieee', text: 'IEEE 754 Floating-Point Precision & Rounding' },
  { id: 'arch_cpu', text: 'Nexus-8 Fetch-Decode-Execute Microarchitecture' },
];

/** @type {import('../../kernel/types').AppModule['mount']} */
export async function mount(container, ctx) {
  const t = (/** @type {string} */ k, /** @type {Record<string, unknown>} */ v = {}) => ctx.i18n.t(k, v);
  const isDe = ctx.i18n.currentLocale === 'de';

  let searchQuery = '';
  let selectedCategory = 'all';

  // Completed syllabus topics
  /** @type {Set<string>} */
  const completedTopics = new Set();
  try {
    const raw = localStorage.getItem('nexus_cslab_syllabus');
    if (raw) JSON.parse(raw).forEach((id) => completedTopics.add(id));
  } catch {
    // Ignore storage errors
  }

  const root = h('div', { class: 'nx-cslab-app' });

  // Hero section
  const hero = h('div', { class: 'nx-cslab-hero' }, [h('h2', {}, t('app.title')), h('p', {}, t('app.description'))]);

  // Search & Category Filters
  const searchBar = h('div', { class: 'nx-cslab-search-bar' });
  const searchInput = h('input', {
    type: 'text',
    class: 'nx-input',
    placeholder: t('hub.searchPlaceholder'),
    style: 'flex:1;min-width:260px;',
  });
  searchInput.addEventListener('input', () => {
    searchQuery = searchInput.value.toLowerCase().trim();
    renderToolsGrid();
  });

  const catSelect = h('select', { class: 'nx-input small' }, [
    h('option', { value: 'all' }, t('hub.allCategories')),
    h('option', { value: 'algorithms' }, t('hub.algorithms')),
    h('option', { value: 'dataStructures' }, t('hub.dataStructures')),
    h('option', { value: 'theory' }, t('hub.theory')),
    h('option', { value: 'hardware' }, t('hub.hardware')),
  ]);
  catSelect.addEventListener('change', () => {
    selectedCategory = catSelect.value;
    renderToolsGrid();
  });

  searchBar.append(searchInput, catSelect);

  // Tools Grid Container
  const toolsGrid = h('div', { class: 'nx-cslab-tools-grid' });

  function renderToolsGrid() {
    toolsGrid.innerHTML = '';
    const filtered = CSLAB_TOOLS.filter((tool) => {
      if (selectedCategory !== 'all' && tool.category !== selectedCategory) return false;
      if (!searchQuery) return true;
      const title = (tool.name[isDe ? 'de' : 'en'] || tool.name.en).toLowerCase();
      const desc = (tool.description[isDe ? 'de' : 'en'] || tool.description.en).toLowerCase();
      const hasKw = tool.keywords.some((k) => k.toLowerCase().includes(searchQuery));
      return title.includes(searchQuery) || desc.includes(searchQuery) || hasKw;
    });

    for (const tool of filtered) {
      const card = h('div', { class: 'nx-cslab-card' }, [
        h('div', {}, [
          h('div', { class: 'nx-cslab-card-header' }, [
            h(
              'h3',
              { style: 'margin:0;font-size:var(--text-md, 1rem);color:var(--text-1)' },
              tool.name[isDe ? 'de' : 'en'] || tool.name.en,
            ),
            h('span', { class: 'nx-cslab-badge' }, tool.badge),
          ]),
          h(
            'p',
            { class: 'nx-cslab-card-desc', style: 'margin-top:8px;' },
            tool.description[isDe ? 'de' : 'en'] || tool.description.en,
          ),
        ]),
        h('div', { style: 'display:flex;justify-content:flex-end;margin-top:6px;' }, [
          h(
            'button',
            {
              class: 'nx-cs-btn primary small',
              onclick: () => ctx.commands?.execute?.('shell.launchApp', { appId: tool.id }),
            },
            t('hub.launch'),
          ),
        ]),
      ]);
      toolsGrid.append(card);
    }
  }

  // Syllabus Checklist Section
  const checklistSection = h('div', { class: 'nx-cslab-checklist' });
  const progressLabel = h('p', { style: 'font-size:12px;color:var(--text-2);margin:4px 0 10px 0;' });

  function updateChecklistHeader() {
    progressLabel.textContent = t('hub.progress', {
      completed: completedTopics.size,
      total: SYLLABUS_TOPICS.length,
    });
  }

  const checklistItems = h('div', { class: 'nx-checklist-items' });
  for (const item of SYLLABUS_TOPICS) {
    const isChecked = completedTopics.has(item.id);
    const cb = h('input', {
      type: 'checkbox',
      checked: isChecked,
    });
    cb.addEventListener('change', () => {
      if (cb.checked) {
        completedTopics.add(item.id);
      } else {
        completedTopics.delete(item.id);
      }
      try {
        localStorage.setItem('nexus_cslab_syllabus', JSON.stringify(Array.from(completedTopics)));
      } catch {
        // Ignore
      }
      updateChecklistHeader();
    });

    const itemLabel = h('label', { class: 'nx-checklist-item' }, cb, h('span', {}, item.text));
    checklistItems.append(itemLabel);
  }

  updateChecklistHeader();
  checklistSection.append(h('h3', {}, t('hub.syllabus')), progressLabel, checklistItems);

  root.append(hero, searchBar, toolsGrid, checklistSection);
  container.append(root);

  renderToolsGrid();

  return () => {};
}

export const commands = {
  'cslab.open': (ctx, args) => {
    return ctx.commands?.execute?.('shell.launchApp', { appId: 'nexus.cslab', args });
  },
};

export const terminal = {
  cslab: async (ctx, io) => {
    const args = io.args || [];
    if (args.length === 0) {
      await ctx.commands?.execute?.('shell.launchApp', { appId: 'nexus.cslab' });
      return 0;
    }

    const sub = args[0].toLowerCase();
    if (sub === 'list') {
      io.stdout?.('Available CS Lab Tools:\n');
      for (const t of CSLAB_TOOLS) {
        io.stdout?.(`  - ${t.id.padEnd(22)}: ${t.name.en} [${t.badge}]\n`);
      }
      return 0;
    }

    if (sub === 'open') {
      const target = args[1];
      if (!target) {
        io.stderr?.('Usage: cslab open <appId>\n');
        return 1;
      }
      const fullId = target.startsWith('nexus.') ? target : `nexus.${target}`;
      await ctx.commands?.execute?.('shell.launchApp', { appId: fullId });
      return 0;
    }

    io.stderr?.(`Unknown subcommand: ${sub}. Usage: cslab [list | open <appId>]\n`);
    return 1;
  },
};
