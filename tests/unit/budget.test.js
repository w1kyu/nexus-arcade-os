import { describe, expect, it } from 'vitest';
import {
  computeAccountBalances,
  computeBudgetProgress,
  computeExpenseSplit,
  computeMonthlySpending,
  exportTransactionsCsv,
  formatCurrency,
  parseTransactionsCsv,
} from '../../src/apps/budget/model.js';

describe('Budget Model', () => {
  /** @type {import('../../src/apps/budget/model.js').Account[]} */
  const accounts = [
    { id: 'a1', name: 'Girokonto', type: 'bank', initialBalance: 1000, currency: 'EUR' },
    { id: 'a2', name: 'Cash', type: 'cash', initialBalance: 100, currency: 'EUR' },
  ];

  /** @type {import('../../src/apps/budget/model.js').Transaction[]} */
  const transactions = [
    { id: 't1', accountId: 'a1', type: 'income', amount: 800, category: 'Salary', date: '2026-11-01', createdAt: 1 },
    { id: 't2', accountId: 'a1', type: 'expense', amount: 50, category: 'Groceries', date: '2026-11-02', createdAt: 1 },
    {
      id: 't3',
      accountId: 'a1',
      targetAccountId: 'a2',
      type: 'transfer',
      amount: 50,
      category: 'Transfer',
      date: '2026-11-03',
      createdAt: 1,
    },
  ];

  it('computes account balances and total net worth correctly', () => {
    const { balances, netWorth } = computeAccountBalances(accounts, transactions);
    // Girokonto: 1000 + 800 - 50 - 50 = 1700
    expect(balances.a1).toBe(1700);
    // Cash: 100 + 50 = 150
    expect(balances.a2).toBe(150);
    // Net worth: 1700 + 150 = 1850
    expect(netWorth).toBe(1850);
  });

  it('computes monthly spending and category breakdown', () => {
    const summary = computeMonthlySpending(transactions, '2026-11');
    expect(summary.totalIncome).toBe(800);
    expect(summary.totalExpenses).toBe(50);
    expect(summary.netBalance).toBe(750);
    expect(summary.byCategory.Groceries).toBe(50);
  });

  it('tracks budget progress and over-budget states', () => {
    /** @type {import('../../src/apps/budget/model.js').CategoryBudget[]} */
    const budgets = [
      { id: 'b1', category: 'Groceries', monthlyLimit: 40 }, // spent 50 -> over budget
      { id: 'b2', category: 'Leisure', monthlyLimit: 100 }, // spent 0 -> 0%
    ];
    const progress = computeBudgetProgress(budgets, { Groceries: 50 });
    expect(progress[0].isOver).toBe(true);
    expect(progress[0].percent).toBe(125);
    expect(progress[1].isOver).toBe(false);
    expect(progress[1].percent).toBe(0);
  });

  it('splits group expenses with minimal settlement transactions', () => {
    // Alice paid 60 for dinner for Alice, Bob, and Carol (20 each)
    const payments = [{ person: 'Alice', paid: 60 }];
    const settlements = computeExpenseSplit(payments, ['Alice', 'Bob', 'Carol']);
    expect(settlements.length).toBe(2);
    // Bob owes Alice 20, Carol owes Alice 20
    const bob = settlements.find((s) => s.from === 'Bob');
    const carol = settlements.find((s) => s.from === 'Carol');
    expect(bob?.to).toBe('Alice');
    expect(bob?.amount).toBe(20);
    expect(carol?.to).toBe('Alice');
    expect(carol?.amount).toBe(20);
  });

  it('parses CSV bank statements and exports to CSV', () => {
    const bankCsv = `Datum;Betrag;Verwendungszweck\n05.11.2026;-34,50;Supermarkt\n06.11.2026;500,00;Stipendium`;
    const parsed = parseTransactionsCsv(bankCsv, { dateCol: 0, amountCol: 1, descCol: 2, delimiter: ';' }, 'a1');
    expect(parsed.length).toBe(2);
    expect(parsed[0].type).toBe('expense');
    expect(parsed[0].amount).toBe(34.5);
    expect(parsed[0].date).toBe('2026-11-05');
    expect(parsed[0].note).toBe('Supermarkt');

    expect(parsed[1].type).toBe('income');
    expect(parsed[1].amount).toBe(500);

    const exported = exportTransactionsCsv(parsed);
    expect(exported).toContain('2026-11-05');
    expect(exported).toContain('34.5');
  });

  it('formats currency correctly via Intl', () => {
    const formatted = formatCurrency(42.5, 'EUR', 'en-US');
    expect(formatted).toContain('42.50');
  });
});
