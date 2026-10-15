// サブスク管理の純粋ロジック（DOM非依存・テスト対象）

export const CYCLES = {
  weekly: { label: '週ごと', monthsPerCycle: 12 / 52 },
  monthly: { label: '月ごと', monthsPerCycle: 1 },
  quarterly: { label: '3か月ごと', monthsPerCycle: 3 },
  halfyear: { label: '半年ごと', monthsPerCycle: 6 },
  yearly: { label: '年ごと', monthsPerCycle: 12 },
};

export const CATEGORIES = ['動画・音楽', 'ゲーム', '仕事・ツール', 'クラウド', '学習', '健康・ライフ', 'その他'];

/** 月額換算（円）。不正値は0 */
export function monthlyCost(sub) {
  const c = CYCLES[sub.cycle];
  const amount = Number(sub.amount);
  if (!c || !Number.isFinite(amount) || amount < 0) return 0;
  return amount / c.monthsPerCycle;
}

export function yearlyCost(sub) {
  return monthlyCost(sub) * 12;
}

export function totals(subs) {
  const active = subs.filter((s) => s.active !== false);
  const monthly = active.reduce((a, s) => a + monthlyCost(s), 0);
  return { monthly: Math.round(monthly), yearly: Math.round(monthly * 12), count: active.length };
}

export function byCategory(subs) {
  const map = new Map();
  for (const s of subs.filter((x) => x.active !== false)) {
    const k = s.category || 'その他';
    map.set(k, (map.get(k) || 0) + monthlyCost(s));
  }
  return [...map.entries()]
    .map(([category, monthly]) => ({ category, monthly: Math.round(monthly) }))
    .sort((a, b) => b.monthly - a.monthly);
}

function parseYmd(s) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s || '');
  if (!m) return null;
  const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
  return d.getUTCMonth() === +m[2] - 1 ? d : null; // 2/30等を弾く
}

export function fmtYmd(d) {
  return d.toISOString().slice(0, 10);
}

function addMonthsClamped(d, n) {
  const y = d.getUTCFullYear();
  const m = d.getUTCMonth() + n;
  const day = d.getUTCDate();
  const last = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
  return new Date(Date.UTC(y, m, Math.min(day, last)));
}

/** 基準日(today)以降で最も近い支払日。anchorは登録された支払日（過去でも可） */
export function nextPayment(sub, today) {
  const anchor = parseYmd(sub.nextDate);
  const t = parseYmd(today);
  if (!anchor || !t) return null;
  if (anchor >= t) return fmtYmd(anchor);
  if (sub.cycle === 'weekly') {
    const days = Math.ceil((t - anchor) / 86400000 / 7) * 7;
    return fmtYmd(new Date(anchor.getTime() + days * 86400000));
  }
  const step = CYCLES[sub.cycle]?.monthsPerCycle;
  if (!step) return null;
  // 元の日付を基準に n 周期進めることで、月末クランプの累積ズレを防ぐ
  let n = 1;
  let d = addMonthsClamped(anchor, step * n);
  while (d < t) {
    n += 1;
    d = addMonthsClamped(anchor, step * n);
  }
  return fmtYmd(d);
}

export function daysUntil(ymd, today) {
  const a = parseYmd(ymd);
  const b = parseYmd(today);
  if (!a || !b) return null;
  return Math.round((a - b) / 86400000);
}

/** 今後 withinDays 日以内の支払い（近い順） */
export function upcoming(subs, today, withinDays = 30) {
  return subs
    .filter((s) => s.active !== false)
    .map((s) => {
      const date = nextPayment(s, today);
      return { sub: s, date, days: date ? daysUntil(date, today) : null };
    })
    .filter((x) => x.days !== null && x.days <= withinDays)
    .sort((a, b) => a.days - b.days);
}

export function validate(input) {
  const errors = [];
  if (!String(input.name || '').trim()) errors.push('サービス名を入力してください');
  const amount = Number(input.amount);
  if (!Number.isFinite(amount) || amount < 0) errors.push('金額は0以上の数値で入力してください');
  if (amount > 10_000_000) errors.push('金額が大きすぎます');
  if (!CYCLES[input.cycle]) errors.push('支払い周期が不正です');
  if (!parseYmd(input.nextDate)) errors.push('次回支払日を正しく入力してください');
  return errors;
}

export function newId() {
  return 's' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

// ---------- ICS ----------
function icsEscape(s) {
  return String(s).replace(/\\/g, '\\\\').replace(/;/g, '\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
}

/** 各サービスの次回支払日の daysBefore 日前に通知する終日予定 */
export function buildIcs(subs, today, daysBefore = 3) {
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//sub-keeper//JA', 'CALSCALE:GREGORIAN'];
  for (const s of subs.filter((x) => x.active !== false)) {
    const date = nextPayment(s, today);
    if (!date) continue;
    const d = parseYmd(date);
    const next = new Date(d.getTime() + 86400000);
    const ymd = (x) => fmtYmd(x).replace(/-/g, '');
    lines.push(
      'BEGIN:VEVENT',
      `UID:${s.id}-${ymd(d)}@sub-keeper`,
      `DTSTAMP:${ymd(parseYmd(today))}T000000Z`,
      `DTSTART;VALUE=DATE:${ymd(d)}`,
      `DTEND;VALUE=DATE:${ymd(next)}`,
      `SUMMARY:${icsEscape(`【支払い】${s.name} ${Math.round(Number(s.amount)).toLocaleString('ja-JP')}円`)}`,
      `DESCRIPTION:${icsEscape('不要なら解約を検討。' + (s.note || ''))}`,
      'BEGIN:VALARM',
      'ACTION:DISPLAY',
      `DESCRIPTION:${icsEscape(s.name + ' の支払いが近づいています')}`,
      `TRIGGER:-P${Math.max(0, daysBefore)}D`,
      'END:VALARM',
      'END:VEVENT',
    );
  }
  lines.push('END:VCALENDAR');
  return lines.join('\r\n') + '\r\n';
}

// ---------- CSV ----------
const CSV_HEAD = ['name', 'amount', 'cycle', 'nextDate', 'category', 'note', 'active'];

function csvCell(v) {
  let s = String(v ?? '');
  // CSVインジェクション対策: 式として解釈されうる先頭文字を無害化
  if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
  return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}

export function toCsv(subs) {
  const rows = subs.map((s) => CSV_HEAD.map((k) => csvCell(k === 'active' ? (s.active !== false ? '1' : '0') : s[k])));
  return [CSV_HEAD.join(','), ...rows.map((r) => r.join(','))].join('\n') + '\n';
}

export function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = '';
  let q = false;
  const src = text.replace(/^\uFEFF/, '');
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (q) {
      if (ch === '"' && src[i + 1] === '"') { cell += '"'; i++; }
      else if (ch === '"') q = false;
      else cell += ch;
    } else if (ch === '"') q = true;
    else if (ch === ',') { row.push(cell); cell = ''; }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && src[i + 1] === '\n') i++;
      row.push(cell); cell = '';
      if (row.some((c) => c !== '')) rows.push(row);
      row = [];
    } else cell += ch;
  }
  row.push(cell);
  if (row.some((c) => c !== '')) rows.push(row);
  return rows;
}

/** CSV文字列 → {subs, skipped}. 不正行はスキップして件数を返す */
export function importCsv(text) {
  const rows = parseCsv(text);
  if (rows.length === 0) return { subs: [], skipped: 0 };
  const head = rows[0].map((h) => h.trim());
  const idx = Object.fromEntries(CSV_HEAD.map((k) => [k, head.indexOf(k)]));
  if (idx.name < 0 || idx.amount < 0) return { subs: [], skipped: rows.length - 1, error: 'ヘッダ行が不正です' };
  const subs = [];
  let skipped = 0;
  for (const r of rows.slice(1)) {
    const get = (k) => (idx[k] >= 0 ? (r[idx[k]] ?? '').trim() : '');
    const unquote = (v) => v.replace(/^'(?=[=+\-@])/, '');
    const sub = {
      id: newId(),
      name: unquote(get('name')),
      amount: Number(get('amount')),
      cycle: get('cycle') || 'monthly',
      nextDate: get('nextDate'),
      category: CATEGORIES.includes(get('category')) ? get('category') : 'その他',
      note: unquote(get('note')),
      active: get('active') !== '0',
    };
    if (validate(sub).length) skipped++;
    else subs.push(sub);
  }
  return { subs, skipped };
}

/** localStorage等から読んだ未信頼データを検証し、正常な要素だけ返す */
export function sanitize(list) {
  if (!Array.isArray(list)) return [];
  return list
    .filter((x) => x && typeof x === 'object' && validate(x).length === 0)
    .map((x) => ({
      id: typeof x.id === 'string' && x.id ? x.id : newId(),
      name: String(x.name).slice(0, 60),
      amount: Number(x.amount),
      cycle: x.cycle,
      nextDate: x.nextDate,
      category: CATEGORIES.includes(x.category) ? x.category : 'その他',
      note: String(x.note ?? '').slice(0, 120),
      active: x.active !== false,
    }));
}
