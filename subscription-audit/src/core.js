// サブスク棚卸し: 純粋ロジック(DOM非依存)。日付は 'YYYY-MM-DD' 文字列、UTC基準で扱う。

export const CYCLES = {
  weekly: { label: '毎週', months: 0 },
  monthly: { label: '毎月', months: 1 },
  quarterly: { label: '3か月ごと', months: 3 },
  yearly: { label: '毎年', months: 12 },
};
export const CATEGORIES = ['動画・音楽', '仕事・開発', 'クラウド・保存', '学習', 'ニュース・読書', 'ゲーム', 'その他'];
export const MAX_AMOUNT = 10_000_000;

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

export function daysInMonth(y, m) {
  return new Date(Date.UTC(y, m, 0)).getUTCDate(); // m: 1-12
}

export function isValidDate(s) {
  if (typeof s !== 'string') return false;
  const m = DATE_RE.exec(s);
  if (!m) return false;
  const y = +m[1], mo = +m[2], d = +m[3];
  if (y < 1970 || y > 2200 || mo < 1 || mo > 12) return false;
  return d >= 1 && d <= daysInMonth(y, mo);
}

function parse(s) {
  const m = DATE_RE.exec(s);
  return { y: +m[1], m: +m[2], d: +m[3] };
}
function fmt(y, m, d) {
  return `${String(y).padStart(4, '0')}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}
const toDays = (s) => { const { y, m, d } = parse(s); return Date.UTC(y, m - 1, d) / 86400000; };
const fromDays = (n) => { const dt = new Date(n * 86400000); return fmt(dt.getUTCFullYear(), dt.getUTCMonth() + 1, dt.getUTCDate()); };

export function addDays(s, n) { return fromDays(toDays(s) + n); }
export function daysBetween(a, b) { return toDays(b) - toDays(a); }

/** 月加算。日が存在しない月は月末にクランプ(anchorDay基準)。 */
export function addMonths(s, n, anchorDay) {
  const { y, m, d } = parse(s);
  const day0 = anchorDay ?? d;
  const total = y * 12 + (m - 1) + n;
  const ny = Math.floor(total / 12), nm = (total % 12) + 1;
  return fmt(ny, nm, Math.min(day0, daysInMonth(ny, nm)));
}

export function todayString(now = new Date()) {
  // ローカル日付(ユーザーの暦日)で扱う
  return fmt(now.getFullYear(), now.getMonth() + 1, now.getDate());
}

/** 月額換算(円)。小数は保持し表示側で丸める。 */
export function monthlyCost(item) {
  const a = item.amount;
  switch (item.cycle) {
    case 'weekly': return (a * 52) / 12;
    case 'monthly': return a;
    case 'quarterly': return a / 3;
    case 'yearly': return a / 12;
    default: return 0;
  }
}
export function yearlyCost(item) { return monthlyCost(item) * 12; }

/** 基準日(過去でも未来でも可)から、today 以降で最初の請求日を返す。 */
export function nextRenewal(item, today) {
  const anchor = item.billingDate;
  if (daysBetween(today, anchor) >= 0) return anchor;
  if (item.cycle === 'weekly') {
    const diff = daysBetween(anchor, today);
    return addDays(anchor, Math.ceil(diff / 7) * 7);
  }
  const step = CYCLES[item.cycle].months;
  const a = parse(anchor), t = parse(today);
  const k = (t.y - a.y) * 12 + (t.m - a.m);
  let n = Math.max(0, Math.floor(k / step) * step);
  let cand = addMonths(anchor, n, a.d);
  while (daysBetween(today, cand) < 0) {
    n += step;
    cand = addMonths(anchor, n, a.d);
  }
  return cand;
}

export function validateItem(raw) {
  const errors = [];
  const r = raw && typeof raw === 'object' ? raw : {};
  const name = typeof r.name === 'string' ? r.name.trim() : '';
  if (!name) errors.push('サービス名を入力してください');
  if (name.length > 100) errors.push('サービス名は100文字以内にしてください');
  const amount = typeof r.amount === 'string' && r.amount.trim() !== '' ? Number(r.amount) : r.amount;
  if (typeof amount !== 'number' || !Number.isFinite(amount) || amount < 0 || amount > MAX_AMOUNT) {
    errors.push(`金額は0〜${MAX_AMOUNT.toLocaleString('ja-JP')}の数値で入力してください`);
  }
  if (!Object.hasOwn(CYCLES, r.cycle)) errors.push('支払い周期が不正です');
  if (!isValidDate(r.billingDate)) errors.push('請求日(基準日)は実在する日付で入力してください');
  const usage = Number(r.usage);
  if (!Number.isInteger(usage) || usage < 1 || usage > 5) errors.push('利用頻度は1〜5で指定してください');
  const category = CATEGORIES.includes(r.category) ? r.category : 'その他';
  const memo = typeof r.memo === 'string' ? r.memo.slice(0, 500) : '';
  if (errors.length) return { ok: false, errors };
  const id = typeof r.id === 'string' && /^[\w-]{1,64}$/.test(r.id) ? r.id : null;
  return { ok: true, item: { id, name, amount: Math.round(amount * 100) / 100, cycle: r.cycle, billingDate: r.billingDate, usage, category, memo } };
}

export function summarize(items, today, { lowUsage = 2, windowDays = 30 } = {}) {
  let monthly = 0;
  const byCategory = {};
  const upcoming = [];
  const candidates = [];
  for (const it of items) {
    const m = monthlyCost(it);
    monthly += m;
    byCategory[it.category] = (byCategory[it.category] || 0) + m;
    const next = nextRenewal(it, today);
    const days = daysBetween(today, next);
    if (days <= windowDays) upcoming.push({ item: it, next, days });
    if (it.usage <= lowUsage) candidates.push(it);
  }
  upcoming.sort((a, b) => a.days - b.days);
  const potentialYearlySaving = candidates.reduce((s, it) => s + yearlyCost(it), 0);
  return { monthly, yearly: monthly * 12, byCategory, upcoming, candidates, potentialYearlySaving };
}

// ---------- 出力 ----------

/** CSVインジェクション対策(先頭の = + - @ タブ CR をシングルクォートで無効化)。 */
export function csvCell(v) {
  let s = String(v ?? '');
  if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
  return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}

export function toCSV(items, today) {
  const head = ['サービス名', '金額(円)', '周期', '月額換算(円)', '年額換算(円)', '次回請求日', '利用頻度(1-5)', 'カテゴリ', 'メモ'];
  const rows = items.map((it) => [
    it.name, it.amount, CYCLES[it.cycle].label, Math.round(monthlyCost(it)), Math.round(yearlyCost(it)),
    nextRenewal(it, today), it.usage, it.category, it.memo,
  ]);
  // BOM付き(Excelでの文字化け防止)
  return '\uFEFF' + [head, ...rows].map((r) => r.map(csvCell).join(',')).join('\r\n') + '\r\n';
}

export function icsEscape(s) {
  return String(s).replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
}

/** RFC5545: 75オクテットで折り返し(UTF-8の文字境界を守る)。 */
export function icsFold(line) {
  const enc = new TextEncoder();
  if (enc.encode(line).length <= 75) return line;
  const out = [];
  let cur = '', curBytes = 0, limit = 75;
  for (const ch of line) {
    const b = enc.encode(ch).length;
    if (curBytes + b > limit) {
      out.push(cur);
      cur = ' '; curBytes = 1; limit = 75;
    }
    cur += ch; curBytes += b;
  }
  out.push(cur);
  return out.join('\r\n');
}

function rrule(item) {
  const d = parse(item.billingDate).d;
  switch (item.cycle) {
    case 'weekly': return 'FREQ=WEEKLY';
    case 'yearly': return 'FREQ=YEARLY';
    default: {
      const interval = CYCLES[item.cycle].months;
      if (d <= 28) return `FREQ=MONTHLY;INTERVAL=${interval}`;
      // 29〜31日: 存在しない月は月末へ寄せる
      const days = []; for (let i = 28; i <= d; i++) days.push(i);
      return `FREQ=MONTHLY;INTERVAL=${interval};BYMONTHDAY=${days.join(',')};BYSETPOS=-1`;
    }
  }
}

function hash(s) {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h * 33) ^ s.charCodeAt(i)) >>> 0;
  return h.toString(16).padStart(8, '0');
}

export function toICS(items, today, { remindDays = 3, now = new Date() } = {}) {
  const stamp = now.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//subscription-audit//JA', 'CALSCALE:GREGORIAN', 'X-WR-CALNAME:サブスク更新日'];
  for (const it of items) {
    const next = nextRenewal(it, today);
    const ymd = next.replace(/-/g, '');
    const end = addDays(next, 1).replace(/-/g, '');
    lines.push(
      'BEGIN:VEVENT',
      `UID:${hash(it.id || it.name)}-${hash(it.name + it.billingDate)}@subscription-audit`,
      `DTSTAMP:${stamp}`,
      `DTSTART;VALUE=DATE:${ymd}`,
      `DTEND;VALUE=DATE:${end}`,
      `RRULE:${rrule(it)}`,
      `SUMMARY:${icsEscape(`【更新】${it.name} ${it.amount.toLocaleString('ja-JP')}円/${CYCLES[it.cycle].label}`)}`,
      `DESCRIPTION:${icsEscape(`継続しますか? 解約するなら更新前に。${it.memo ? '\n' + it.memo : ''}`)}`,
      'BEGIN:VALARM', 'ACTION:DISPLAY', `DESCRIPTION:${icsEscape(it.name + ' の更新が近づいています')}`, `TRIGGER:-P${remindDays}D`, 'END:VALARM',
      'END:VEVENT',
    );
  }
  lines.push('END:VCALENDAR');
  return lines.map(icsFold).join('\r\n') + '\r\n';
}

/** JSONバックアップの読み込み(不正行は捨てて件数を返す)。 */
export function importJSON(text) {
  let data;
  try { data = JSON.parse(text); } catch { return { items: [], skipped: 0, error: 'JSONとして読み込めません' }; }
  const arr = Array.isArray(data) ? data : data && Array.isArray(data.items) ? data.items : null;
  if (!arr) return { items: [], skipped: 0, error: '形式が不正です' };
  const items = []; let skipped = 0;
  for (const r of arr.slice(0, 1000)) {
    const v = validateItem(r);
    if (v.ok) items.push(v.item); else skipped++;
  }
  skipped += Math.max(0, arr.length - 1000);
  return { items, skipped, error: null };
}
