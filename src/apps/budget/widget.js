// @ts-check
// Budget desktop widget: net worth overview and monthly expense progress.
import { button, h, replace } from '../../ui/dom.js';
import { computeAccountBalances, computeMonthlySpending, formatCurrency } from './model.js';

/** @typedef {import('./model.js').Account} Account */
/** @typedef {import('./model.js').Transaction} Transaction */

/**
 * @param {HTMLElement} root
 * @param {import('../../kernel/types').WidgetContext} ctx
 */
export async function mount(root, ctx) {
  const accountsCol = /** @type {import('../../kernel/types').Collection<Account>} */ (
    ctx.storage.collection('accounts')
  );
  const transCol = /** @type {import('../../kernel/types').Collection<Transaction>} */ (
    ctx.storage.collection('transactions')
  );

  async function render() {
    const accounts = await accountsCol.all();
    const trans = await transCol.all();
    const curMonth = new Date().toISOString().slice(0, 7);

    const { netWorth } = computeAccountBalances(accounts, trans);
    const { totalIncome, totalExpenses } = computeMonthlySpending(trans, curMonth);

    replace(
      root,
      h(
        'div',
        {
          style: {
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
            height: '100%',
            padding: '8px',
            boxSizing: 'border-box',
          },
        },
        h(
          'div',
          { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' } },
          h('strong', { style: { fontSize: '13px' }, text: ctx.i18n.t('appTitle') }),
          button({
            icon: 'wallet',
            size: 'small',
            onClick: () => void ctx.commands.execute('shell.launchApp', { appId: 'nexus.budget' }),
          }),
        ),
        h(
          'div',
          { style: { display: 'flex', flexDirection: 'column', gap: '2px' } },
          h('span', {
            style: { fontSize: '11px', color: 'var(--nx-text-muted, #7d8590)' },
            text: ctx.i18n.t('netWorth'),
          }),
          h('span', {
            style: { fontSize: '18px', fontWeight: '700', color: '#4ade80' },
            text: formatCurrency(netWorth),
          }),
        ),
        h(
          'div',
          { style: { display: 'flex', justifyContent: 'space-between', fontSize: '12px' } },
          h('span', { style: { color: '#4ade80' }, text: `+${formatCurrency(totalIncome)}` }),
          h('span', { style: { color: '#f87171' }, text: `-${formatCurrency(totalExpenses)}` }),
        ),
        button({
          label: ctx.i18n.t('newTransaction'),
          size: 'small',
          icon: 'plus',
          variant: 'primary',
          onClick: () =>
            void ctx.commands.execute('shell.launchApp', { appId: 'nexus.budget', args: { action: 'newTransaction' } }),
        }),
      ),
    );
  }

  accountsCol.onChange(() => void render());
  transCol.onChange(() => void render());
  await render();
}
