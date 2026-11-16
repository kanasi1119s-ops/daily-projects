export type Method = 'onestop' | 'kakutei';

export interface Donation {
  id: string;
  date: string; // YYYY-MM-DD
  municipality: string;
  amount: number; // 円
  item: string;
  method: Method;
  paid: boolean; // 決済完了
  receiptReceived: boolean; // 寄附金受領証明書 到着
  onestopSent: boolean; // ワンストップ申請書 投函済み
}

export interface Summary {
  total: number;
  paidTotal: number;
  unpaidTotal: number;
  limit: number;
  remaining: number; // limit - total (負なら超過)
  overLimit: boolean;
  estimatedSelfBurden: number;
  municipalityCount: number;
  onestopMunicipalityCount: number;
  onestopOverFive: boolean;
}

export const MAX_AMOUNT = 100_000_000; // 1億円で頭打ち（異常値対策）
export const SELF_BURDEN = 2000;
export const ONESTOP_MAX_MUNICIPALITIES = 5;

export function normalizeName(s: string): string {
  return s.normalize('NFKC').replace(/\s+/g, '').trim();
}

export function sanitizeAmount(v: unknown): number {
  const n = typeof v === 'number' ? v : Number(String(v ?? '').normalize('NFKC').replace(/[,，円\s]/g, ''));
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.min(Math.floor(n), MAX_AMOUNT);
}

export function summarize(list: Donation[], limit: number): Summary {
  const lim = sanitizeAmount(limit);
  const total = list.reduce((a, d) => a + d.amount, 0);
  const paidTotal = list.filter((d) => d.paid).reduce((a, d) => a + d.amount, 0);
  const all = new Set(list.map((d) => normalizeName(d.municipality)).filter(Boolean));
  const one = new Set(
    list.filter((d) => d.method === 'onestop').map((d) => normalizeName(d.municipality)).filter(Boolean),
  );
  return {
    total,
    paidTotal,
    unpaidTotal: total - paidTotal,
    limit: lim,
    remaining: lim - total,
    overLimit: lim > 0 && total > lim,
    // 上限内なら自己負担は概ね2,000円（寄付が2,000円以下ならその額）。目安のみ。
    estimatedSelfBurden: total === 0 ? 0 : Math.min(total, SELF_BURDEN),
    municipalityCount: all.size,
    onestopMunicipalityCount: one.size,
    onestopOverFive: one.size > ONESTOP_MAX_MUNICIPALITIES,
  };
}

/** YYYY-MM-DD を日付のみで扱う（タイムゾーン非依存） */
export function daysBetween(fromISO: string, toISO: string): number {
  const p = (s: string) => {
    const [y, m, d] = s.split('-').map(Number);
    return Date.UTC(y, m - 1, d);
  };
  return Math.round((p(toISO) - p(fromISO)) / 86400000);
}

export interface Deadlines {
  year: number;
  paymentDeadline: string; // 年内決済
  onestopDeadline: string; // 翌年1/10必着
  daysToPayment: number;
  daysToOnestop: number;
}

export function deadlines(todayISO: string): Deadlines {
  const cal = Number(todayISO.slice(0, 4));
  // 1月は「前年分」の寄付の申請期限（1/10）を基準にする
  const year = todayISO.slice(5, 7) === '01' ? cal - 1 : cal;
  const paymentDeadline = `${year}-12-31`;
  const onestopDeadline = `${year + 1}-01-10`;
  return {
    year,
    paymentDeadline,
    onestopDeadline,
    daysToPayment: daysBetween(todayISO, paymentDeadline),
    daysToOnestop: daysBetween(todayISO, onestopDeadline),
  };
}

export interface Todo {
  id: string;
  label: string;
}

/** 未完了のやることを返す */
export function todos(list: Donation[]): Todo[] {
  const out: Todo[] = [];
  for (const d of list) {
    const name = d.municipality || '(名称未入力)';
    if (!d.paid) out.push({ id: d.id + ':pay', label: `${name}：決済を完了する（年内に決済が必要）` });
    if (d.method === 'onestop' && !d.onestopSent)
      out.push({ id: d.id + ':os', label: `${name}：ワンストップ特例申請書を提出する（翌年1/10必着）` });
    if (d.method === 'kakutei' && !d.receiptReceived)
      out.push({ id: d.id + ':rc', label: `${name}：寄附金受領証明書の到着を確認する（確定申告で使用）` });
  }
  return out;
}

export function warnings(list: Donation[], s: Summary): string[] {
  const w: string[] = [];
  if (s.overLimit) w.push(`寄付合計が入力した上限額を ${(s.total - s.limit).toLocaleString('ja-JP')} 円超えています。超過分は自己負担になります。`);
  if (s.onestopOverFive)
    w.push('ワンストップ特例の対象は寄付先が5自治体までです。6自治体以上は確定申告に切り替える必要があります。');
  if (list.some((d) => d.method === 'onestop') && list.some((d) => d.method === 'kakutei'))
    w.push('確定申告を行う場合、ワンストップ特例は無効になり、すべての寄付を確定申告に記載する必要があります。');
  const seen = new Map<string, number>();
  for (const d of list) {
    const k = `${d.date}|${normalizeName(d.municipality)}|${d.amount}`;
    seen.set(k, (seen.get(k) ?? 0) + 1);
  }
  if ([...seen.values()].some((c) => c > 1)) w.push('同じ日付・自治体・金額の寄付が重複している可能性があります。');
  return w;
}

export function toCSV(list: Donation[]): string {
  const esc = (v: string | number | boolean) => {
    let s = String(v);
    // CSVインジェクション対策
    if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
    return `"${s.replace(/"/g, '""')}"`;
  };
  const head = ['日付', '自治体', '金額', '返礼品', '申請方法', '決済済', '受領証明書', 'ワンストップ送付'];
  const rows = list.map((d) =>
    [d.date, d.municipality, d.amount, d.item, d.method === 'onestop' ? 'ワンストップ' : '確定申告', d.paid ? '○' : '', d.receiptReceived ? '○' : '', d.onestopSent ? '○' : ''].map(esc).join(','),
  );
  return '﻿' + [head.map(esc).join(','), ...rows].join('\r\n');
}

export function parseImport(json: string): Donation[] {
  const raw = JSON.parse(json);
  const arr = Array.isArray(raw) ? raw : raw?.donations;
  if (!Array.isArray(arr)) throw new Error('形式が正しくありません');
  return arr.map((x: any, i: number) => ({
    id: String(x.id ?? `imp-${i}-${Date.now()}`),
    date: /^\d{4}-\d{2}-\d{2}$/.test(String(x.date)) ? String(x.date) : '',
    municipality: String(x.municipality ?? '').slice(0, 100),
    amount: sanitizeAmount(x.amount),
    item: String(x.item ?? '').slice(0, 200),
    method: x.method === 'kakutei' ? 'kakutei' : 'onestop',
    paid: !!x.paid,
    receiptReceived: !!x.receiptReceived,
    onestopSent: !!x.onestopSent,
  }));
}
