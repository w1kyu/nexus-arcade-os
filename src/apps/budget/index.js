// @ts-check
// Nexus Budget: personal accounts, transactions, category budgets, reports,
// CSV bank import/export with column mapping, and expense splitting.
import { button, h, icon, replace } from '../../ui/dom.js';
import { openModal } from '../../ui/overlay.js';
import {
  computeAccountBalances,
  computeBudgetProgress,
  computeExpenseSplit,
  computeMonthlySpending,
  exportTransactionsCsv,
  formatCurrency,
  parseTransactionsCsv,
} from './model.js';
import './styles.css';

/** @typedef {import('./model.js').Account} Account */
/** @typedef {import('./model.js').Transaction} Transaction */
/** @typedef {import('./model.js').CategoryBudget} CategoryBudget */

/**
 * Terminal command handler: `budget [balance | summary | add <amount> <category>]`.
 * @type {Record<string, (ctx: import('../../kernel/types').HeadlessContext, io: import('../../kernel/types').TerminalIo) => Promise<number>>}
 */
export const terminal = {
  async budget(ctx, io) {
    const accCol = /** @type {import('../../kernel/types').Collection<Account>} */ (ctx.storage.collection('accounts'));
    const transCol = /** @type {import('../../kernel/types').Collection<Transaction>} */ (
      ctx.storage.collection('transactions')
    );
    const accounts = await accCol.all();
    const transactions = await transCol.all();
    const sub = io.args[0] ?? 'balance';

    if (sub === 'balance') {
      const { balances, netWorth } = computeAccountBalances(accounts, transactions);
      io.out(`--- Financial Overview ---\n`);
      io.out(`Net Worth: ${formatCurrency(netWorth)}\n\n`);
      for (const a of accounts) {
        io.out(`• ${a.name} (${a.type}): ${formatCurrency(balances[a.id] || 0, a.currency)}\n`);
      }
      return 0;
    }

    if (sub === 'summary') {
      const curMonth = new Date().toISOString().slice(0, 7);
      const { totalIncome, totalExpenses, netBalance, byCategory } = computeMonthlySpending(transactions, curMonth);
      io.out(`--- Summary for ${curMonth} ---\n`);
      io.out(`Income:   +${formatCurrency(totalIncome)}\n`);
      io.out(`Expenses: -${formatCurrency(totalExpenses)}\n`);
      io.out(`Balance:   ${formatCurrency(netBalance)}\n\n`);
      io.out(`By Category:\n`);
      for (const [cat, spent] of Object.entries(byCategory)) {
        io.out(`  - ${cat}: ${formatCurrency(spent)}\n`);
      }
      return 0;
    }

    if (sub === 'add') {
      const amount = parseFloat(io.args[1]);
      const category = io.args[2] || 'Uncategorized';
      if (isNaN(amount) || amount <= 0) {
        io.err('Usage: budget add <amount> <category>\n');
        return 1;
      }
      const primaryAcc = accounts[0];
      if (!primaryAcc) {
        io.err('No account created yet. Open Budget app to create an account first.\n');
        return 1;
      }
      const today = new Date().toISOString().split('T')[0];
      await transCol.put({
        id: crypto.randomUUID(),
        accountId: primaryAcc.id,
        type: 'expense',
        amount,
        category,
        date: today,
        createdAt: Date.now(),
      });
      io.out(`Recorded expense of ${formatCurrency(amount)} in ${category}.\n`);
      return 0;
    }

    io.err(`Unknown subcommand "${sub}". Try: budget [balance | summary | add <amount> <category>]\n`);
    return 1;
  },
};

/** @type {import('../../kernel/types').AppModule['commands']} */
export const commands = {
  'budget.newTransaction': (ctx) =>
    ctx.commands.execute('shell.launchApp', { appId: 'nexus.budget', args: { action: 'newTransaction' } }),
  'budget.split': (ctx) =>
    ctx.commands.execute('shell.launchApp', { appId: 'nexus.budget', args: { action: 'split' } }),
};

/**
 * @param {HTMLElement} root
 * @param {import('../../kernel/types').AppContext} ctx
 */
export async function mount(root, ctx) {
  const accountsCol = /** @type {import('../../kernel/types').Collection<Account>} */ (
    ctx.storage.collection('accounts')
  );
  const transCol = /** @type {import('../../kernel/types').Collection<Transaction>} */ (
    ctx.storage.collection('transactions')
  );
  const budgetsCol = /** @type {import('../../kernel/types').Collection<CategoryBudget>} */ (
    ctx.storage.collection('budgets')
  );

  /** @type {string | null} */
  let selectedAccountId = null; // null = all
  /** @type {'transactions' | 'budgets' | 'reports'} */
  let currentView = 'transactions';

  const container = h('div', { class: 'nx-budget' });
  replace(root, container);

  async function render() {
    const accounts = await accountsCol.all();
    const transactions = await transCol.all();
    const budgets = await budgetsCol.all();
    const curMonth = new Date().toISOString().slice(0, 7);

    const { balances, netWorth } = computeAccountBalances(accounts, transactions);
    const { byCategory, totalIncome, totalExpenses, netBalance } = computeMonthlySpending(transactions, curMonth);
    const budgetProgress = computeBudgetProgress(budgets, byCategory);

    // Toolbar
    const toolbar = h(
      'header',
      { class: 'nx-budget-toolbar' },
      h(
        'div',
        { class: 'nx-budget-toolbar-title' },
        icon('wallet', { size: 18 }),
        h('span', { text: ctx.i18n.t('appTitle') }),
      ),
      h(
        'div',
        { class: 'nx-budget-toolbar-actions' },
        button({
          label: ctx.i18n.t('newTransaction'),
          icon: 'plus',
          variant: 'primary',
          onClick: () => showTransactionModal(accounts),
        }),
        button({
          label: ctx.i18n.t('splitExpenses'),
          icon: 'users',
          onClick: () => showSplitModal(),
        }),
        button({
          label: ctx.i18n.t('csvImport'),
          icon: 'download',
          onClick: () => showCsvImportModal(accounts),
        }),
        button({
          label: ctx.i18n.t('csvExport'),
          icon: 'upload',
          onClick: () => {
            const csv = exportTransactionsCsv(transactions);
            const blob = new Blob([csv], { type: 'text/csv' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `transactions-${curMonth}.csv`;
            a.click();
            URL.revokeObjectURL(url);
          },
        }),
      ),
    );

    // Sidebar
    const accountItems = [
      h(
        'div',
        {
          class: `nx-budget-account-item${selectedAccountId === null ? ' is-selected' : ''}`,
          onClick: () => {
            selectedAccountId = null;
            render();
          },
        },
        h('span', { style: { fontWeight: '600' }, text: 'All Accounts' }),
        h('span', { style: { color: '#4ade80', fontWeight: '700' }, text: formatCurrency(netWorth) }),
      ),
      ...accounts.map((acc) => {
        const bal = balances[acc.id] || 0;
        const isSelected = selectedAccountId === acc.id;
        return h(
          'div',
          {
            class: `nx-budget-account-item${isSelected ? ' is-selected' : ''}`,
            onClick: () => {
              selectedAccountId = acc.id;
              render();
            },
          },
          h(
            'div',
            { style: { display: 'flex', flexDirection: 'column', gap: '2px' } },
            h('span', { style: { fontWeight: '500' }, text: acc.name }),
            h('span', { style: { fontSize: '11px', color: 'var(--nx-text-muted, #7d8590)' }, text: acc.type }),
          ),
          h('span', {
            style: { fontWeight: '700', color: bal >= 0 ? '#4ade80' : '#f87171' },
            text: formatCurrency(bal, acc.currency),
          }),
        );
      }),
    ];

    const sidebar = h(
      'aside',
      { class: 'nx-budget-sidebar' },
      h(
        'div',
        { class: 'nx-budget-networth-card' },
        h('span', { class: 'nx-budget-networth-label', text: ctx.i18n.t('netWorth') }),
        h('span', { class: 'nx-budget-networth-val', text: formatCurrency(netWorth) }),
      ),
      h(
        'div',
        { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' } },
        h('span', {
          style: {
            fontSize: '12px',
            fontWeight: '600',
            textTransform: 'uppercase',
            color: 'var(--nx-text-muted, #7d8590)',
          },
          text: ctx.i18n.t('accounts'),
        }),
        button({
          icon: 'plus',
          size: 'small',
          onClick: () => showAccountModal(),
        }),
      ),
      h('div', { class: 'nx-budget-accounts-list' }, ...accountItems),
    );

    // Main Area
    const mainPane = h('main', { class: 'nx-budget-main' });

    // View Tabs
    const viewTabs = h(
      'div',
      {
        style: {
          display: 'flex',
          gap: '8px',
          borderBottom: '1px solid var(--nx-border, #2d3342)',
          paddingBottom: '8px',
        },
      },
      button({
        label: ctx.i18n.t('transactions'),
        variant: currentView === 'transactions' ? 'primary' : 'secondary',
        onClick: () => {
          currentView = 'transactions';
          render();
        },
      }),
      button({
        label: ctx.i18n.t('monthlyBudgets'),
        variant: currentView === 'budgets' ? 'primary' : 'secondary',
        onClick: () => {
          currentView = 'budgets';
          render();
        },
      }),
      button({
        label: ctx.i18n.t('reports'),
        variant: currentView === 'reports' ? 'primary' : 'secondary',
        onClick: () => {
          currentView = 'reports';
          render();
        },
      }),
    );

    mainPane.appendChild(viewTabs);

    if (currentView === 'transactions') {
      renderTransactionsView(mainPane, transactions, accounts);
    } else if (currentView === 'budgets') {
      renderBudgetsView(mainPane, budgetProgress);
    } else if (currentView === 'reports') {
      renderReportsView(mainPane, totalIncome, totalExpenses, netBalance, byCategory);
    }

    const content = h('div', { class: 'nx-budget-content' }, sidebar, mainPane);
    replace(container, toolbar, content);
  }

  /**
   * @param {HTMLElement} host
   * @param {Transaction[]} allTrans
   * @param {Account[]} accounts
   */
  function renderTransactionsView(host, allTrans, accounts) {
    const filtered = selectedAccountId
      ? allTrans.filter((t) => t.accountId === selectedAccountId || t.targetAccountId === selectedAccountId)
      : allTrans;

    filtered.sort((a, b) => b.date.localeCompare(a.date));

    if (filtered.length === 0) {
      host.appendChild(
        h(
          'div',
          { style: { textAlign: 'center', padding: '40px', color: 'var(--nx-text-muted, #7d8590)' } },
          h('p', { text: ctx.i18n.t('noTransactionsYet') }),
        ),
      );
      return;
    }

    const rows = filtered.map((t) => {
      const acc = accounts.find((a) => a.id === t.accountId);
      const isExp = t.type === 'expense';
      const isInc = t.type === 'income';
      const sign = isExp ? '-' : isInc ? '+' : '';
      const amountClass = isExp ? 'nx-budget-amount-expense' : isInc ? 'nx-budget-amount-income' : '';

      return h(
        'tr',
        {},
        h('td', { text: t.date }),
        h('td', { text: t.category }),
        h('td', { text: t.note || acc?.name || '' }),
        h('td', { class: amountClass, text: `${sign}${formatCurrency(t.amount)}` }),
        h(
          'td',
          {},
          button({
            icon: 'trash',
            size: 'small',
            onClick: async () => {
              if (confirm(ctx.i18n.t('confirmDelete'))) {
                await transCol.delete(t.id);
              }
            },
          }),
        ),
      );
    });

    const table = h(
      'table',
      { class: 'nx-budget-table' },
      h(
        'thead',
        {},
        h(
          'tr',
          {},
          h('th', { text: ctx.i18n.t('date') }),
          h('th', { text: ctx.i18n.t('category') }),
          h('th', { text: ctx.i18n.t('note') }),
          h('th', { text: ctx.i18n.t('amount') }),
          h('th', { text: '' }),
        ),
      ),
      h('tbody', {}, ...rows),
    );

    host.appendChild(table);
  }

  /**
   * @param {HTMLElement} host
   * @param {Array<{ category: string, limit: number, spent: number, percent: number, isOver: boolean }>} budgetProgress
   */
  function renderBudgetsView(host, budgetProgress) {
    const addBudgetBtn = button({
      label: ctx.i18n.t('newBudget'),
      icon: 'plus',
      variant: 'primary',
      size: 'small',
      onClick: () => showBudgetModal(),
    });

    const header = h(
      'div',
      { class: 'nx-budget-section-title' },
      h('span', { text: ctx.i18n.t('monthlyBudgets') }),
      addBudgetBtn,
    );
    host.appendChild(header);

    if (budgetProgress.length === 0) {
      host.appendChild(
        h(
          'div',
          { style: { padding: '30px', textAlign: 'center', color: 'var(--nx-text-muted, #7d8590)' } },
          ctx.i18n.t('newBudget'),
        ),
      );
      return;
    }

    const cards = budgetProgress.map((bp) => {
      const fillWidth = Math.min(100, bp.percent);
      return h(
        'div',
        { class: 'nx-budget-card' },
        h(
          'div',
          { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' } },
          h('strong', { text: bp.category }),
          h(
            'span',
            {
              style: {
                fontSize: '12px',
                fontWeight: '600',
                color: bp.isOver ? '#f87171' : 'var(--nx-text-primary, #e6edf3)',
              },
            },
            `${bp.percent}%`,
          ),
        ),
        h(
          'div',
          { class: 'nx-budget-progress-track' },
          h('div', {
            class: `nx-budget-progress-fill${bp.isOver ? ' is-over' : ''}`,
            style: { width: `${fillWidth}%` },
          }),
        ),
        h(
          'div',
          {
            style: {
              display: 'flex',
              justifyContent: 'space-between',
              fontSize: '11px',
              color: 'var(--nx-text-muted, #7d8590)',
            },
          },
          h('span', {
            text: ctx.i18n.t('spent', { spent: formatCurrency(bp.spent), limit: formatCurrency(bp.limit) }),
          }),
          bp.isOver ? h('span', { style: { color: '#f87171', fontWeight: '600' }, text: '!' }) : h('span'),
        ),
      );
    });

    host.appendChild(h('div', { class: 'nx-budget-grid' }, ...cards));
  }

  /**
   * Reports view (Income vs Expense bar summary & category breakdown).
   */
  function renderReportsView(host, totalIncome, totalExpenses, netBalance, byCategory) {
    const summaryCard = h(
      'div',
      {
        style: {
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: '12px',
          padding: '14px',
          background: 'var(--nx-bg-surface, #1a1d26)',
          borderRadius: '8px',
        },
      },
      h(
        'div',
        {},
        h('div', {
          style: { fontSize: '11px', color: 'var(--nx-text-muted, #7d8590)' },
          text: ctx.i18n.t('typeIncome'),
        }),
        h('div', {
          style: { fontSize: '18px', fontWeight: '700', color: '#4ade80' },
          text: `+${formatCurrency(totalIncome)}`,
        }),
      ),
      h(
        'div',
        {},
        h('div', {
          style: { fontSize: '11px', color: 'var(--nx-text-muted, #7d8590)' },
          text: ctx.i18n.t('typeExpense'),
        }),
        h('div', {
          style: { fontSize: '18px', fontWeight: '700', color: '#f87171' },
          text: `-${formatCurrency(totalExpenses)}`,
        }),
      ),
      h(
        'div',
        {},
        h('div', { style: { fontSize: '11px', color: 'var(--nx-text-muted, #7d8590)' }, text: ctx.i18n.t('balance') }),
        h('div', {
          style: { fontSize: '18px', fontWeight: '700', color: netBalance >= 0 ? '#4ade80' : '#f87171' },
          text: formatCurrency(netBalance),
        }),
      ),
    );

    const catRows = Object.entries(byCategory).map(([cat, amount]) => {
      const pct = totalExpenses > 0 ? Math.round((amount / totalExpenses) * 100) : 0;
      return h(
        'div',
        { style: { display: 'flex', flexDirection: 'column', gap: '4px' } },
        h(
          'div',
          { style: { display: 'flex', justifyContent: 'space-between', fontSize: '12px' } },
          h('span', { text: cat }),
          h('span', { style: { fontWeight: '600' }, text: `${formatCurrency(amount)} (${pct}%)` }),
        ),
        h(
          'div',
          {
            style: {
              width: '100%',
              height: '6px',
              background: 'var(--nx-bg-subtle, #212631)',
              borderRadius: '3px',
              overflow: 'hidden',
            },
          },
          h('div', { style: { height: '100%', width: `${pct}%`, background: '#38bdf8' } }),
        ),
      );
    });

    const categoryCard = h(
      'div',
      {
        style: {
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
          padding: '14px',
          background: 'var(--nx-bg-surface, #1a1d26)',
          borderRadius: '8px',
        },
      },
      h('span', { style: { fontSize: '13px', fontWeight: '600' }, text: 'Spending by Category' }),
      ...catRows,
    );

    host.appendChild(summaryCard);
    host.appendChild(categoryCard);
  }

  /**
   * Modal for creating/editing an Account.
   */
  function showAccountModal() {
    let name = '';
    let type = 'bank';
    let balance = 0;
    let curr = 'EUR';

    const nameIn = h('input', { type: 'text', class: 'nx-input', placeholder: 'e.g. DKB Girokonto' });
    nameIn.addEventListener('input', (e) => {
      name = /** @type {HTMLInputElement} */ (e.target).value;
    });

    const typeSel = h(
      'select',
      { class: 'nx-select' },
      h('option', { value: 'bank', text: ctx.i18n.t('typeBank') }),
      h('option', { value: 'cash', text: ctx.i18n.t('typeCash') }),
      h('option', { value: 'savings', text: ctx.i18n.t('typeSavings') }),
      h('option', { value: 'credit', text: ctx.i18n.t('typeCredit') }),
    );
    typeSel.addEventListener('change', (e) => {
      type = /** @type {import('./model.js').AccountType} */ (/** @type {HTMLSelectElement} */ (e.target).value);
    });

    const balIn = h('input', { type: 'number', step: '0.01', class: 'nx-input', value: '0' });
    balIn.addEventListener('input', (e) => {
      balance = parseFloat(/** @type {HTMLInputElement} */ (e.target).value) || 0;
    });

    const form = h(
      'div',
      { style: { display: 'flex', flexDirection: 'column', gap: '10px', minWidth: '300px' } },
      h('label', { style: { fontSize: '12px' } }, ctx.i18n.t('accountName'), nameIn),
      h('label', { style: { fontSize: '12px' } }, ctx.i18n.t('accountType'), typeSel),
      h('label', { style: { fontSize: '12px' } }, ctx.i18n.t('initialBalance'), balIn),
    );

    const modal = openModal({
      title: ctx.i18n.t('newAccount'),
      content: form,
      actions: [
        { label: ctx.i18n.t('cancel'), variant: 'secondary', onClick: () => modal.close() },
        {
          label: ctx.i18n.t('save'),
          variant: 'primary',
          onClick: async () => {
            if (!name.trim()) return;
            await accountsCol.put({
              id: crypto.randomUUID(),
              name: name.trim(),
              type: /** @type {import('./model.js').AccountType} */ (type),
              initialBalance: balance,
              currency: curr,
            });
            modal.close();
          },
        },
      ],
    });
  }

  /**
   * Modal for creating a Transaction.
   * @param {Account[]} accounts
   */
  function showTransactionModal(accounts) {
    if (accounts.length === 0) {
      alert(ctx.i18n.t('noAccountsYet'));
      return;
    }

    let accId = accounts[0].id;
    let type = 'expense';
    let amount = 0;
    let category = ctx.i18n.t('categoryGroceries');
    let date = new Date().toISOString().split('T')[0];
    let note = '';

    const typeSel = h(
      'select',
      { class: 'nx-select' },
      h('option', { value: 'expense', text: ctx.i18n.t('typeExpense') }),
      h('option', { value: 'income', text: ctx.i18n.t('typeIncome') }),
    );
    typeSel.addEventListener('change', (e) => {
      type = /** @type {any} */ (/** @type {HTMLSelectElement} */ (e.target).value);
    });

    const accSel = h(
      'select',
      { class: 'nx-select' },
      ...accounts.map((a) => h('option', { value: a.id, text: a.name })),
    );
    accSel.addEventListener('change', (e) => {
      accId = /** @type {HTMLSelectElement} */ (e.target).value;
    });

    const amtIn = h('input', { type: 'number', step: '0.01', class: 'nx-input', placeholder: '0.00' });
    amtIn.addEventListener('input', (e) => {
      amount = parseFloat(/** @type {HTMLInputElement} */ (e.target).value) || 0;
    });

    const catIn = h('input', { type: 'text', class: 'nx-input', value: category });
    catIn.addEventListener('input', (e) => {
      category = /** @type {HTMLInputElement} */ (e.target).value;
    });

    const dateIn = h('input', { type: 'date', class: 'nx-input', value: date });
    dateIn.addEventListener('input', (e) => {
      date = /** @type {HTMLInputElement} */ (e.target).value;
    });

    const noteIn = h('input', { type: 'text', class: 'nx-input', placeholder: 'Note' });
    noteIn.addEventListener('input', (e) => {
      note = /** @type {HTMLInputElement} */ (e.target).value;
    });

    const form = h(
      'div',
      { style: { display: 'flex', flexDirection: 'column', gap: '10px', minWidth: '320px' } },
      h('label', { style: { fontSize: '12px' } }, ctx.i18n.t('accountType'), typeSel),
      h('label', { style: { fontSize: '12px' } }, ctx.i18n.t('selectAccount'), accSel),
      h('label', { style: { fontSize: '12px' } }, ctx.i18n.t('amount'), amtIn),
      h('label', { style: { fontSize: '12px' } }, ctx.i18n.t('category'), catIn),
      h('label', { style: { fontSize: '12px' } }, ctx.i18n.t('date'), dateIn),
      h('label', { style: { fontSize: '12px' } }, ctx.i18n.t('note'), noteIn),
    );

    const modal = openModal({
      title: ctx.i18n.t('newTransaction'),
      content: form,
      actions: [
        { label: ctx.i18n.t('cancel'), variant: 'secondary', onClick: () => modal.close() },
        {
          label: ctx.i18n.t('save'),
          variant: 'primary',
          onClick: async () => {
            if (amount <= 0) return;
            await transCol.put({
              id: crypto.randomUUID(),
              accountId: accId,
              type: /** @type {any} */ (type),
              amount,
              category: category.trim() || 'Other',
              date,
              note: note.trim() || undefined,
              createdAt: Date.now(),
            });
            modal.close();
          },
        },
      ],
    });
  }

  /**
   * Modal to set Category Budget.
   */
  function showBudgetModal() {
    let cat = '';
    let limit = 100;

    const catIn = h('input', { type: 'text', class: 'nx-input', placeholder: 'e.g. Groceries, Dining' });
    catIn.addEventListener('input', (e) => {
      cat = /** @type {HTMLInputElement} */ (e.target).value;
    });

    const limIn = h('input', { type: 'number', step: '10', class: 'nx-input', value: '100' });
    limIn.addEventListener('input', (e) => {
      limit = parseFloat(/** @type {HTMLInputElement} */ (e.target).value) || 100;
    });

    const form = h(
      'div',
      { style: { display: 'flex', flexDirection: 'column', gap: '10px', minWidth: '280px' } },
      h('label', { style: { fontSize: '12px' } }, ctx.i18n.t('category'), catIn),
      h('label', { style: { fontSize: '12px' } }, ctx.i18n.t('monthlyLimit'), limIn),
    );

    const modal = openModal({
      title: ctx.i18n.t('newBudget'),
      content: form,
      actions: [
        { label: ctx.i18n.t('cancel'), variant: 'secondary', onClick: () => modal.close() },
        {
          label: ctx.i18n.t('save'),
          variant: 'primary',
          onClick: async () => {
            if (!cat.trim()) return;
            await budgetsCol.put({
              id: cat.trim(),
              category: cat.trim(),
              monthlyLimit: limit,
            });
            modal.close();
          },
        },
      ],
    });
  }

  /**
   * Expense Split Calculator Modal ("Who owes whom").
   */
  function showSplitModal() {
    let participants = ['Alice', 'Bob', 'Carol'];
    /** @type {Array<{ person: string, paid: number }>} */
    const payments = [
      { person: 'Alice', paid: 60 },
      { person: 'Bob', paid: 0 },
      { person: 'Carol', paid: 0 },
    ];

    const partIn = h('input', { type: 'text', class: 'nx-input', value: participants.join(', ') });
    const resultBox = h('div', {
      style: { padding: '10px', background: 'var(--nx-bg-surface, #1a1d26)', borderRadius: '6px', fontSize: '13px' },
    });

    function updateSplit() {
      const parts = partIn.value
        .split(',')
        .map((p) => p.trim())
        .filter(Boolean);
      const settlements = computeExpenseSplit(payments, parts);
      if (settlements.length === 0) {
        resultBox.textContent = 'All settled!';
      } else {
        resultBox.innerHTML = '';
        for (const s of settlements) {
          resultBox.appendChild(
            h('div', {
              style: { padding: '4px 0', color: '#ff8a3d' },
              text: ctx.i18n.t('owes', { debtor: s.from, creditor: s.to, amount: formatCurrency(s.amount) }),
            }),
          );
        }
      }
    }

    partIn.addEventListener('input', () => updateSplit());
    updateSplit();

    const form = h(
      'div',
      { style: { display: 'flex', flexDirection: 'column', gap: '12px', minWidth: '340px' } },
      h('p', { style: { fontSize: '12px', color: 'var(--nx-text-muted, #7d8590)' }, text: ctx.i18n.t('splitDesc') }),
      h('label', { style: { fontSize: '12px' } }, ctx.i18n.t('participants'), partIn),
      h('label', { style: { fontSize: '12px', fontWeight: '600' } }, ctx.i18n.t('settlements'), resultBox),
    );

    openModal({
      title: ctx.i18n.t('splitExpenses'),
      content: form,
    });
  }

  /**
   * CSV Import Modal with column mapping.
   * @param {Account[]} accounts
   */
  function showCsvImportModal(accounts) {
    if (accounts.length === 0) return;
    let targetAcc = accounts[0].id;
    let csvText = '';
    let dCol = 0;
    let aCol = 1;
    let descCol = 2;

    const accSel = h(
      'select',
      { class: 'nx-select' },
      ...accounts.map((a) => h('option', { value: a.id, text: a.name })),
    );
    accSel.addEventListener('change', (e) => {
      targetAcc = /** @type {HTMLSelectElement} */ (e.target).value;
    });

    const ta = h('textarea', {
      class: 'nx-textarea',
      style: { width: '100%', height: '120px', fontFamily: 'monospace', fontSize: '11px' },
    });
    ta.addEventListener('input', (e) => {
      csvText = /** @type {HTMLTextAreaElement} */ (e.target).value;
    });

    const dIn = h('input', { type: 'number', class: 'nx-input', value: '0' });
    dIn.addEventListener('input', (e) => {
      dCol = parseInt(/** @type {HTMLInputElement} */ (e.target).value, 10) || 0;
    });

    const aIn = h('input', { type: 'number', class: 'nx-input', value: '1' });
    aIn.addEventListener('input', (e) => {
      aCol = parseInt(/** @type {HTMLInputElement} */ (e.target).value, 10) || 1;
    });

    const descIn = h('input', { type: 'number', class: 'nx-input', value: '2' });
    descIn.addEventListener('input', (e) => {
      descCol = parseInt(/** @type {HTMLInputElement} */ (e.target).value, 10) || 2;
    });

    const form = h(
      'div',
      { style: { display: 'flex', flexDirection: 'column', gap: '10px', minWidth: '340px' } },
      h('label', { style: { fontSize: '12px' } }, ctx.i18n.t('selectAccount'), accSel),
      h('label', { style: { fontSize: '12px' } }, ctx.i18n.t('pasteCsv'), ta),
      h(
        'div',
        { style: { display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' } },
        h('label', { style: { fontSize: '11px' } }, ctx.i18n.t('dateCol'), dIn),
        h('label', { style: { fontSize: '11px' } }, ctx.i18n.t('amountCol'), aIn),
        h('label', { style: { fontSize: '11px' } }, ctx.i18n.t('descCol'), descIn),
      ),
    );

    const modal = openModal({
      title: ctx.i18n.t('csvImport'),
      content: form,
      actions: [
        { label: ctx.i18n.t('cancel'), variant: 'secondary', onClick: () => modal.close() },
        {
          label: ctx.i18n.t('csvImport'),
          variant: 'primary',
          onClick: async () => {
            if (!csvText.trim()) return;
            const imported = parseTransactionsCsv(
              csvText,
              { dateCol: dCol, amountCol: aCol, descCol, delimiter: csvText.includes(';') ? ';' : ',' },
              targetAcc,
            );
            for (const t of imported) {
              await transCol.put(t);
            }
            modal.close();
          },
        },
      ],
    });
  }

  accountsCol.onChange(() => void render());
  transCol.onChange(() => void render());
  budgetsCol.onChange(() => void render());
  await render();
}
