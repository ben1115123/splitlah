// Pure money logic. Every amount is an integer in MINOR units (sen, cents…)
// so nothing is ever lost to floating-point rounding.

export const CURRENCIES = {
  MYR: { symbol: 'RM', dp: 2, name: 'Malaysian Ringgit' },
  SGD: { symbol: 'S$', dp: 2, name: 'Singapore Dollar' },
  THB: { symbol: '฿', dp: 2, name: 'Thai Baht' },
  IDR: { symbol: 'Rp', dp: 0, name: 'Indonesian Rupiah' },
  VND: { symbol: '₫', dp: 0, name: 'Vietnamese Dong' },
  PHP: { symbol: '₱', dp: 2, name: 'Philippine Peso' },
  JPY: { symbol: '¥', dp: 0, name: 'Japanese Yen' },
  KRW: { symbol: '₩', dp: 0, name: 'South Korean Won' },
  CNY: { symbol: 'CN¥', dp: 2, name: 'Chinese Yuan' },
  HKD: { symbol: 'HK$', dp: 2, name: 'Hong Kong Dollar' },
  TWD: { symbol: 'NT$', dp: 0, name: 'Taiwan Dollar' },
  INR: { symbol: '₹', dp: 2, name: 'Indian Rupee' },
  AUD: { symbol: 'A$', dp: 2, name: 'Australian Dollar' },
  NZD: { symbol: 'NZ$', dp: 2, name: 'New Zealand Dollar' },
  USD: { symbol: 'US$', dp: 2, name: 'US Dollar' },
  EUR: { symbol: '€', dp: 2, name: 'Euro' },
  GBP: { symbol: '£', dp: 2, name: 'British Pound' },
  CHF: { symbol: 'CHF', dp: 2, name: 'Swiss Franc' },
  CAD: { symbol: 'C$', dp: 2, name: 'Canadian Dollar' },
  AED: { symbol: 'AED', dp: 2, name: 'UAE Dirham' },
};

export const dpOf = (cur) => (CURRENCIES[cur] ? CURRENCIES[cur].dp : 2);

/** Parse a user-typed amount ("12.5", "1,234.56", "-3") into minor units without floats. */
export function toMinor(input, cur) {
  const dp = dpOf(cur);
  let s = String(input ?? '').trim().replace(/[,\s]/g, '');
  if (!s) return NaN;
  let neg = false;
  if (s[0] === '-') { neg = true; s = s.slice(1); }
  if (!/^\d*\.?\d*$/.test(s) || s === '.' ) return NaN;
  let [whole, frac = ''] = s.split('.');
  whole = whole || '0';
  // round half up on the first dropped digit
  let roundUp = frac.length > dp && Number(frac[dp]) >= 5;
  frac = frac.slice(0, dp).padEnd(dp, '0');
  let v = Number(whole) * 10 ** dp + (dp ? Number(frac) : 0) + (roundUp ? 1 : 0);
  if (!Number.isSafeInteger(v)) return NaN;
  return neg ? -v : v;
}

export function fromMinor(minor, cur) {
  return minor / 10 ** dpOf(cur);
}

/** Plain number string for an input box, e.g. 1234.5 -> "1234.50" */
export function minorToInput(minor, cur) {
  const dp = dpOf(cur);
  const neg = minor < 0;
  const a = Math.abs(minor);
  const whole = Math.floor(a / 10 ** dp);
  const frac = dp ? '.' + String(a % 10 ** dp).padStart(dp, '0') : '';
  return (neg ? '-' : '') + whole + frac;
}

export function formatMoney(minor, cur, { sign = false, symbol = true } = {}) {
  const dp = dpOf(cur);
  const neg = minor < 0;
  const a = Math.abs(minor);
  const whole = Math.floor(a / 10 ** dp).toLocaleString('en-US');
  const frac = dp ? '.' + String(a % 10 ** dp).padStart(dp, '0') : '';
  const sym = symbol ? (CURRENCIES[cur]?.symbol ?? cur) + (/^[A-Z]{3}$/.test(CURRENCIES[cur]?.symbol ?? cur) ? ' ' : '') : '';
  const pre = neg ? '−' : sign && minor > 0 ? '+' : '';
  return pre + sym + whole + frac;
}

/**
 * Split an integer `total` across `weights` (array of non-negative numbers)
 * using the largest-remainder method. Result sums EXACTLY to total.
 * Ties go to earlier entries, so results are deterministic.
 */
export function allocate(total, weights) {
  const n = weights.length;
  if (!n) return [];
  const W = weights.reduce((a, b) => a + b, 0);
  if (W <= 0) return weights.map(() => 0);
  const sign = total < 0 ? -1 : 1;
  const T = Math.abs(total);
  const raw = weights.map((w) => (T * w) / W);
  const base = raw.map(Math.floor);
  let left = T - base.reduce((a, b) => a + b, 0);
  const order = raw
    .map((r, i) => ({ i, frac: r - Math.floor(r) }))
    .sort((a, b) => b.frac - a.frac || a.i - b.i);
  for (let k = 0; left > 0; k = (k + 1) % n, left--) base[order[k].i] += 1;
  return base.map((v) => v * sign);
}

export const SPLIT_TYPES = {
  equal: 'Equally',
  exact: 'Exact amounts',
  percent: 'Percentages',
  shares: 'Shares',
  adjust: 'Adjustment',
};

/**
 * Compute each participant's share of `total` (minor units, in the expense's currency).
 * @param {number} total
 * @param {string[]} ids        members taking part, in display order
 * @param {string} type         equal | exact | percent | shares | adjust
 * @param {object} input        per-member values: exact -> minor units, percent -> %, shares -> weight, adjust -> minor units (+/-)
 * @returns {{ok:boolean, shares?:Object<string,number>, error?:string, diff?:number}}
 */
export function computeSplit(total, ids, type, input = {}) {
  if (!Number.isSafeInteger(total) || total === 0) return { ok: false, error: 'Enter an amount' };
  if (!ids.length) return { ok: false, error: 'Pick at least one person' };
  const out = {};
  if (type === 'equal') {
    allocate(total, ids.map(() => 1)).forEach((v, i) => (out[ids[i]] = v));
    return { ok: true, shares: out };
  }
  if (type === 'exact') {
    let sum = 0;
    for (const id of ids) {
      const v = input[id] ?? 0;
      if (!Number.isSafeInteger(v)) return { ok: false, error: 'Check the amounts' };
      out[id] = v; sum += v;
    }
    if (sum !== total) return { ok: false, error: sum < total ? 'left to assign' : 'over the total', diff: total - sum };
    return { ok: true, shares: out };
  }
  if (type === 'percent') {
    const p = ids.map((id) => Number(input[id] ?? 0));
    if (p.some((x) => !isFinite(x) || x < 0)) return { ok: false, error: 'Percentages must be positive' };
    const sum = p.reduce((a, b) => a + b, 0);
    if (Math.abs(sum - 100) > 1e-6) return { ok: false, error: sum < 100 ? '% left to assign' : '% over 100', diff: Math.round((100 - sum) * 1000) / 1000 };
    allocate(total, p).forEach((v, i) => (out[ids[i]] = v));
    return { ok: true, shares: out };
  }
  if (type === 'shares') {
    const w = ids.map((id) => Number(input[id] ?? 0));
    if (w.some((x) => !isFinite(x) || x < 0)) return { ok: false, error: 'Shares must be positive' };
    if (w.reduce((a, b) => a + b, 0) <= 0) return { ok: false, error: 'Give someone at least 1 share' };
    allocate(total, w).forEach((v, i) => (out[ids[i]] = v));
    return { ok: true, shares: out };
  }
  if (type === 'adjust') {
    let adjSum = 0;
    for (const id of ids) {
      const v = input[id] ?? 0;
      if (!Number.isSafeInteger(v)) return { ok: false, error: 'Check the adjustments' };
      adjSum += v;
    }
    const rest = total - adjSum;
    if (Math.sign(rest) !== Math.sign(total) && rest !== 0) return { ok: false, error: 'Adjustments exceed the total' };
    const eq = allocate(rest, ids.map(() => 1));
    ids.forEach((id, i) => (out[id] = eq[i] + (input[id] ?? 0)));
    return { ok: true, shares: out };
  }
  return { ok: false, error: 'Unknown split type' };
}

/** Convert an amount in `from` currency to `to` currency. rate = how many `to` for 1 `from`. */
export function convertMinor(minor, from, to, rate) {
  if (from === to) return minor;
  const v = minor * rate * 10 ** (dpOf(to) - dpOf(from));
  return Math.sign(v) * Math.round(Math.abs(v));
}

/**
 * Build the stored form of an expense: shares converted to the group's base currency,
 * re-allocated so that base shares always sum exactly to the base total.
 */
export function buildExpenseAmounts({ amount, currency, rate, baseCurrency, ids, splitType, splitInput, payers }) {
  const r = computeSplit(amount, ids, splitType, splitInput);
  if (!r.ok) return r;
  // Several people paid: amounts (expense currency) must be on the same side as the total and add up to it.
  let payerIds = null;
  if (payers) {
    payerIds = Object.keys(payers).filter((id) => payers[id]);
    let sum = 0;
    for (const id of payerIds) {
      const v = payers[id];
      if (!Number.isSafeInteger(v) || Math.sign(v) !== Math.sign(amount)) return { ok: false, payerError: true, error: 'Check who paid what' };
      sum += v;
    }
    if (!payerIds.length) return { ok: false, payerError: true, error: 'Enter who paid what' };
    if (sum !== amount) return { ok: false, payerError: true, error: sum < amount ? 'left to assign to payers' : 'over the total (payers)', diff: amount - sum };
  }
  const baseTotal = convertMinor(amount, currency, baseCurrency, currency === baseCurrency ? 1 : rate);
  if (baseTotal === 0) return { ok: false, error: 'Amount too small after conversion' };
  const weights = ids.map((id) => Math.abs(r.shares[id]));
  // adjust can produce mixed signs; allocate on signed values via two passes when needed
  let baseShares;
  if (ids.every((id) => Math.sign(r.shares[id]) === Math.sign(amount) || r.shares[id] === 0)) {
    baseShares = allocate(baseTotal, weights);
  } else {
    // rare: negative adjustment bigger than the equal part. Convert individually, fix drift on the largest.
    baseShares = ids.map((id) => convertMinor(r.shares[id], currency, baseCurrency, rate));
    const drift = baseTotal - baseShares.reduce((a, b) => a + b, 0);
    let big = 0; baseShares.forEach((v, i) => { if (Math.abs(v) > Math.abs(baseShares[big])) big = i; });
    baseShares[big] += drift;
  }
  const sharesBase = {};
  ids.forEach((id, i) => (sharesBase[id] = baseShares[i]));
  const out = { ok: true, shares: r.shares, sharesBase, baseTotal };
  if (payerIds) {
    // convert each payer's amount, re-allocated so they add up exactly to the base total
    const pb = allocate(baseTotal, payerIds.map((id) => Math.abs(payers[id])));
    out.payers = Object.fromEntries(payerIds.map((id) => [id, payers[id]]));
    out.paidBase = Object.fromEntries(payerIds.map((id, i) => [id, pb[i]]));
  }
  return out;
}

/** Who paid how much of an expense, in base minor units. Supports single- and multi-payer expenses. */
export function paidMap(e) {
  if (e.paidBase && Object.keys(e.paidBase).length) return e.paidBase;
  return { [e.paidBy]: e.baseTotal };
}
export const payerIds = (e) => Object.keys(paidMap(e)).filter((id) => paidMap(e)[id]);

/** Net balance per member in base minor units. Positive = is owed money, negative = owes. */
export function computeNet(memberIds, expenses) {
  const net = Object.fromEntries(memberIds.map((id) => [id, 0]));
  const bump = (id, v) => { net[id] = (net[id] ?? 0) + v; };
  for (const e of expenses) {
    if (e.deleted) continue;
    if (e.type === 'payment') {
      bump(e.from, e.baseTotal);
      bump(e.to, -e.baseTotal);
    } else {
      for (const [id, v] of Object.entries(paidMap(e))) bump(id, v);
      for (const [id, v] of Object.entries(e.sharesBase || {})) bump(id, -v);
    }
  }
  return net;
}

/** Pairwise debts without simplification: returns [{from,to,amount}] where from owes to. */
export function computePairwise(expenses) {
  const owe = {}; // owe[a][b] = a owes b
  const add = (a, b, v) => {
    if (a === b || !v) return;
    owe[a] ??= {}; owe[a][b] = (owe[a][b] ?? 0) + v;
  };
  for (const e of expenses) {
    if (e.deleted) continue;
    if (e.type === 'payment') add(e.to, e.from, e.baseTotal); // payment from A to B reduces A's debt to B
    else {
      // Within one expense: everyone's paid minus share, then debtors pay creditors (exact for one payer).
      const n = {};
      for (const [id, v] of Object.entries(paidMap(e))) n[id] = (n[id] ?? 0) + v;
      for (const [id, v] of Object.entries(e.sharesBase || {})) n[id] = (n[id] ?? 0) - v;
      for (const t of simplifyDebts(n)) add(t.from, t.to, t.amount);
    }
  }
  const res = [];
  const seen = new Set();
  for (const a of Object.keys(owe)) for (const b of Object.keys(owe[a])) {
    const key = [a, b].sort().join('|');
    if (seen.has(key)) continue;
    seen.add(key);
    const d = (owe[a]?.[b] ?? 0) - (owe[b]?.[a] ?? 0);
    if (d > 0) res.push({ from: a, to: b, amount: d });
    else if (d < 0) res.push({ from: b, to: a, amount: -d });
  }
  return res.sort((x, y) => y.amount - x.amount);
}

/** Simplify debts: fewest practical transfers that settle everyone (greedy largest-first). */
export function simplifyDebts(net) {
  const cred = [], debt = [];
  for (const [id, v] of Object.entries(net)) {
    if (v > 0) cred.push({ id, v });
    else if (v < 0) debt.push({ id, v: -v });
  }
  const byAmt = (a, b) => b.v - a.v || (a.id < b.id ? -1 : 1);
  const res = [];
  // First pass: settle exact matches with one transfer each
  for (const d of debt) {
    const c = cred.find((c) => c.v === d.v && c.v > 0);
    if (c && d.v > 0) { res.push({ from: d.id, to: c.id, amount: d.v }); c.v = 0; d.v = 0; }
  }
  for (;;) {
    cred.sort(byAmt); debt.sort(byAmt);
    const c = cred[0], d = debt[0];
    if (!c || !d || c.v <= 0 || d.v <= 0) break;
    const amt = Math.min(c.v, d.v);
    res.push({ from: d.id, to: c.id, amount: amt });
    c.v -= amt; d.v -= amt;
  }
  return res;
}

/** Per-member totals: what they paid (for real expenses) and what their share/consumption was. */
export function computeStats(memberIds, expenses) {
  const paid = Object.fromEntries(memberIds.map((id) => [id, 0]));
  const share = Object.fromEntries(memberIds.map((id) => [id, 0]));
  const byCat = {};
  let total = 0;
  for (const e of expenses) {
    if (e.deleted || e.type === 'payment') continue;
    total += e.baseTotal;
    for (const [id, v] of Object.entries(paidMap(e))) paid[id] = (paid[id] ?? 0) + v;
    for (const [id, v] of Object.entries(e.sharesBase || {})) share[id] = (share[id] ?? 0) + v;
    byCat[e.category || 'general'] = (byCat[e.category || 'general'] ?? 0) + e.baseTotal;
  }
  return { total, paid, share, byCat };
}

/** Which members appear in any (non-deleted) expense or payment. */
export function involvedMembers(expenses) {
  const s = new Set();
  for (const e of expenses) {
    if (e.deleted) continue;
    if (e.type === 'payment') { s.add(e.from); s.add(e.to); }
    else { Object.keys(paidMap(e)).forEach((id) => s.add(id)); Object.keys(e.sharesBase || {}).forEach((id) => s.add(id)); }
  }
  return s;
}
