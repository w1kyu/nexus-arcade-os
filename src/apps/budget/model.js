// @ts-check
// Budget model: account balances, monthly category spending & budget tracking,
// expense splitting ("who owes whom"), and CSV import/export.

/**
 * @typedef {'bank' | 'cash' | 'savings' | 'credit'} AccountType
 * @typedef {'income' | 'expense' | 'transfer'} TransactionType
 */

/**
 * @typedef {object} Account
 * @property {string} id
 * @property {string} name
 * @property {AccountType} type
 * @property {number} initialBalance
 * @property {string} currency           e.g. 'EUR', 'USD'
 * @property {string} [color]
 */

/**
 * @typedef {object} Transaction
 * @property {string} id
 * @property {string} accountId
 * @property {string} [targetAccountId]  for transfer
 * @property {TransactionType} type
 * @property {number} amount             positive number (in cents or float, e.g. 12.50)
 * @property {string} category           e.g. 'Groceries', 'Rent', 'Salary', 'Leisure'
 * @property {string} date               'YYYY-MM-DD'
 * @property {string} [note]
 * @property {string[]} [tags]
 * @property {boolean} [isRecurring]
 * @property {'monthly' | 'yearly'} [recurringFreq]
 * @property {number} createdAt
 */

/**
 * @typedef {object} CategoryBudget
 * @property {string} id                 category name
 * @property {string} category
 * @property {number} monthlyLimit
 */

/**
 * @typedef {object} SavingsGoal
 * @property {string} id
 * @property {string} name
 * @property {number} targetAmount
 * @property {number} currentAmount
 * @property {string} [targetDate]       'YYYY-MM-DD'
 * @property {string} [color]
 */

/**
 * Formats a monetary value using Intl.NumberFormat.
 * @param {number} amount
 * @param {string} [currency]
 * @param {string} [locale]
 * @returns {string}
 */
export function formatCurrency(amount, currency = 'EUR', locale = 'de-DE') {
  try {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency,
    }).format(amount);
  } catch {
    return `${amount.toFixed(2)} ${currency}`;
  }
}

/**
 * Computes balances for all accounts and total net worth.
 * @param {Account[]} accounts
 * @param {Transaction[]} transactions
 * @returns {{ balances: Record<string, number>, netWorth: number }}
 */
export function computeAccountBalances(accounts, transactions) {
  /** @type {Record<string, number>} */
  const balances = {};
  for (const acc of accounts) {
    balances[acc.id] = acc.initialBalance || 0;
  }

  for (const t of transactions) {
    if (t.type === 'income') {
      if (balances[t.accountId] !== undefined) balances[t.accountId] += t.amount;
    } else if (t.type === 'expense') {
      if (balances[t.accountId] !== undefined) balances[t.accountId] -= t.amount;
    } else if (t.type === 'transfer' && t.targetAccountId) {
      if (balances[t.accountId] !== undefined) balances[t.accountId] -= t.amount;
      if (balances[t.targetAccountId] !== undefined) balances[t.targetAccountId] += t.amount;
    }
  }

  let netWorth = 0;
  for (const b of Object.values(balances)) {
    netWorth += b;
  }

  return { balances, netWorth };
}

/**
 * Computes category spending, total income, total expenses, and balance for a month.
 * @param {Transaction[]} transactions
 * @param {string} monthStr 'YYYY-MM'
 * @returns {{
 *   byCategory: Record<string, number>,
 *   totalIncome: number,
 *   totalExpenses: number,
 *   netBalance: number
 * }}
 */
export function computeMonthlySpending(transactions, monthStr) {
  /** @type {Record<string, number>} */
  const byCategory = {};
  let totalIncome = 0;
  let totalExpenses = 0;

  for (const t of transactions) {
    if (!t.date.startsWith(monthStr)) continue;

    if (t.type === 'expense') {
      const cat = t.category || 'Other';
      byCategory[cat] = (byCategory[cat] || 0) + t.amount;
      totalExpenses += t.amount;
    } else if (t.type === 'income') {
      totalIncome += t.amount;
    }
  }

  return {
    byCategory,
    totalIncome,
    totalExpenses,
    netBalance: totalIncome - totalExpenses,
  };
}

/**
 * Compares actual spending against category budgets.
 * @param {CategoryBudget[]} budgets
 * @param {Record<string, number>} spendingByCategory
 * @returns {Array<{ category: string, limit: number, spent: number, percent: number, isOver: boolean }>}
 */
export function computeBudgetProgress(budgets, spendingByCategory) {
  return budgets.map((b) => {
    const spent = spendingByCategory[b.category] || 0;
    const percent = b.monthlyLimit > 0 ? Math.round((spent / b.monthlyLimit) * 100) : 0;
    return {
      category: b.category,
      limit: b.monthlyLimit,
      spent,
      percent,
      isOver: spent > b.monthlyLimit,
    };
  });
}

/**
 * "Who owes whom" expense splitting algorithm.
 * Takes individual payments made for a shared activity and settles debts with minimal transactions.
 * @param {Array<{ person: string, paid: number }>} payments
 * @param {string[]} participants
 * @returns {Array<{ from: string, to: string, amount: number }>}
 */
export function computeExpenseSplit(payments, participants) {
  if (participants.length === 0) return [];

  // Calculate total spent
  let totalPaid = 0;
  /** @type {Record<string, number>} */
  const paidMap = {};
  for (const p of participants) paidMap[p] = 0;

  for (const item of payments) {
    paidMap[item.person] = (paidMap[item.person] || 0) + item.paid;
    totalPaid += item.paid;
  }

  const sharePerPerson = totalPaid / participants.length;

  // Net balances: positive means they should receive, negative means they owe
  const debtors = [];
  const creditors = [];

  for (const p of participants) {
    const diff = Number(((paidMap[p] || 0) - sharePerPerson).toFixed(2));
    if (diff < -0.009) {
      debtors.push({ person: p, amount: -diff });
    } else if (diff > 0.009) {
      creditors.push({ person: p, amount: diff });
    }
  }

  /** @type {Array<{ from: string, to: string, amount: number }>} */
  const settlements = [];

  let dIdx = 0;
  let cIdx = 0;

  while (dIdx < debtors.length && cIdx < creditors.length) {
    const debtor = debtors[dIdx];
    const creditor = creditors[cIdx];
    const amountToSettle = Math.min(debtor.amount, creditor.amount);

    settlements.push({
      from: debtor.person,
      to: creditor.person,
      amount: Number(amountToSettle.toFixed(2)),
    });

    debtor.amount -= amountToSettle;
    creditor.amount -= amountToSettle;

    if (debtor.amount <= 0.009) dIdx++;
    if (creditor.amount <= 0.009) cIdx++;
  }

  return settlements;
}

/**
 * Parses bank CSV lines with custom column mapping.
 * @param {string} csvText
 * @param {{
 *   dateCol: number,
 *   amountCol: number,
 *   descCol: number,
 *   categoryCol?: number,
 *   delimiter?: string,
 *   hasHeader?: boolean
 * }} mapping
 * @param {string} accountId
 * @returns {Transaction[]}
 */
export function parseTransactionsCsv(csvText, mapping, accountId) {
  const lines = csvText.split(/\r?\n/).filter((l) => l.trim().length > 0);
  const delimiter = mapping.delimiter || (lines[0].includes(';') ? ';' : ',');
  const startRow = mapping.hasHeader !== false ? 1 : 0;
  const result = [];

  for (let i = startRow; i < lines.length; i++) {
    const cols = lines[i].split(delimiter).map((c) => c.replace(/^["']|["']$/g, '').trim());
    if (cols.length <= Math.max(mapping.dateCol, mapping.amountCol, mapping.descCol)) continue;

    const rawDate = cols[mapping.dateCol];
    const rawAmount = cols[mapping.amountCol].replace(/\s/g, '').replace(',', '.');
    const amountNum = Math.abs(parseFloat(rawAmount));
    if (isNaN(amountNum) || amountNum === 0) continue;

    const isNegative = rawAmount.startsWith('-') || parseFloat(rawAmount) < 0;
    const type = isNegative ? 'expense' : 'income';
    const note = cols[mapping.descCol] || '';
    const category =
      mapping.categoryCol !== undefined && cols[mapping.categoryCol] ? cols[mapping.categoryCol] : 'Uncategorized';

    // Standardize date to YYYY-MM-DD
    let formattedDate = rawDate;
    if (/^\d{2}\.\d{2}\.\d{4}$/.test(rawDate)) {
      const [d, m, y] = rawDate.split('.');
      formattedDate = `${y}-${m}-${d}`;
    }

    result.push({
      id: crypto.randomUUID(),
      accountId,
      type: /** @type {TransactionType} */ (type),
      amount: amountNum,
      category,
      date: formattedDate,
      note,
      createdAt: Date.now(),
    });
  }

  return result;
}

/**
 * Serializes transactions to CSV.
 * @param {Transaction[]} transactions
 * @returns {string}
 */
export function exportTransactionsCsv(transactions) {
  const header = 'date,type,category,amount,note\n';
  const rows = transactions.map(
    (t) =>
      `"${t.date}","${t.type}","${t.category.replace(/"/g, '""')}",${t.amount},"${(t.note || '').replace(/"/g, '""')}"`,
  );
  return header + rows.join('\n');
}
