// 取引の正規化・定期支払い検出・ICS生成(すべて純粋関数)
export function parseDate(s) {
  const m = String(s).normalize('NFKC').match(/(\d{4})\s*[\/\-.年]\s*(\d{1,2})\s*[\/\-.月]\s*(\d{1,2})/);
  if (!m) return null;
  const [y, mo, d] = [+m[1], +m[2], +m[3]];
  const dt = new Date(Date.UTC(y, mo - 1, d));
  return dt.getUTCMonth() === mo - 1 ? dt : null;
}

export function parseAmount(s) {
  const t = String(s).normalize('NFKC').replace(/[¥￥円,\s]/g, '');
  if (!/^[-+△▲]?\d+(\.\d+)?$/.test(t)) return null;
  const neg = /^[-△▲]/.test(t);
  const n = parseFloat(t.replace(/^[-+△▲]/, ''));
  return neg ? -n : n;
}

export function toTransactions(rows, cols) {
  const out = [];
  for (const r of rows.slice(cols.headerRow + 1)) {
    const date = parseDate(r[cols.date] ?? '');
    const amount = parseAmount(r[cols.amt] ?? '');
    const desc = (r[cols.desc] ?? '').trim();
    if (date && amount !== null && desc) out.push({ date, amount, desc });
  }
  // 支出の符号を判定(多数派を支出とみなし、逆符号=返金は除外)
  const neg = out.filter((t) => t.amount < 0).length;
  const sign = neg > out.length / 2 ? -1 : 1;
  return out.filter((t) => Math.sign(t.amount) === sign).map((t) => ({ ...t, amount: Math.abs(t.amount) }));
}

export function normalizeMerchant(s) {
  return String(s)
    .normalize('NFKC')
    .toUpperCase()
    .replace(/[*＊]/g, ' ')
    .replace(/\d{4,}/g, '')       // 長い数字(伝票番号等)
    .replace(/\s+/g, ' ')
    .trim();
}

const DAY = 86400000;
const median = (a) => { const s = [...a].sort((x, y) => x - y); const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };

const CYCLES = [
  { name: 'weekly', days: 7, tol: 1, perYear: 52 },
  { name: 'monthly', days: 30.4, tol: 4, perYear: 12 },
  { name: 'yearly', days: 365, tol: 10, perYear: 1 },
];

export function detectRecurring(txs, today = new Date()) {
  const groups = new Map();
  for (const t of txs) {
    const k = normalizeMerchant(t.desc);
    if (!k) continue;
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k).push(t);
  }
  const result = [];
  for (const [key, list] of groups) {
    if (list.length < 2) continue;
    list.sort((a, b) => a.date - b.date);
    const gaps = [];
    for (let i = 1; i < list.length; i++) gaps.push((list[i].date - list[i - 1].date) / DAY);
    const g = median(gaps);
    const cycle = CYCLES.find((c) => Math.abs(g - c.days) <= c.tol);
    if (!cycle) continue;
    const amounts = list.map((t) => t.amount);
    const ma = median(amounts);
    const stable = amounts.filter((a) => Math.abs(a - ma) <= ma * 0.15).length / amounts.length;
    if (stable < 0.6) continue;
    const last = list[list.length - 1];
    const step = Math.round(cycle.days) * DAY;
    let next = new Date(last.date.getTime() + step);
    let rolled = false;
    // 古い明細でも「次回目安」は今日以降に繰り上げる(過去日のリマインダーを作らない)
    const t0 = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());
    while (next.getTime() < t0) { next = new Date(next.getTime() + step); rolled = true; }
    const annual = Math.round(ma * cycle.perYear);
    result.push({
      key, label: list[0].desc, cycle: cycle.name, count: list.length,
      amount: Math.round(ma), annual, monthly: Math.round(annual / 12),
      last: last.date, next, rolled,
      confidence: Math.min(1, stable * Math.min(1, list.length / 3)),
    });
  }
  return result.sort((a, b) => b.annual - a.annual);
}

const icsEsc = (s) => String(s).replace(/\\/g, '\\\\').replace(/;/g, '\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');
const ymd = (d) => d.toISOString().slice(0, 10).replace(/-/g, '');

export function buildICS(items, leadDays = 3, now = new Date()) {
  const stamp = now.toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '');
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//SubScan//JP//', 'CALSCALE:GREGORIAN'];
  items.forEach((it, i) => {
    const d = new Date(it.next.getTime() - leadDays * DAY);
    const end = new Date(d.getTime() + DAY);
    lines.push('BEGIN:VEVENT', `UID:subscan-${i}-${ymd(it.next)}@local`, `DTSTAMP:${stamp}`,
      `DTSTART;VALUE=DATE:${ymd(d)}`, `DTEND;VALUE=DATE:${ymd(end)}`,
      `SUMMARY:${icsEsc(`【要確認】${it.label} の更新が近づいています`)}`,
      `DESCRIPTION:${icsEsc(`${ymd(it.next)}頃に約${it.amount}円の請求が見込まれます。継続するか確認しましょう。`)}`,
      'END:VEVENT');
  });
  lines.push('END:VCALENDAR');
  return lines.join('\r\n') + '\r\n';
}
