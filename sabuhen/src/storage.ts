import type { Subscription } from "./logic";
import { CATEGORIES, isCycle } from "./logic";

const KEY = "sabuhen.v1";

/** localStorage から読み込み。壊れたデータや不正な型は除外する */
export function load(): Subscription[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const data: unknown = JSON.parse(raw);
    if (!Array.isArray(data)) return [];
    return data.filter(isSubscription);
  } catch {
    return [];
  }
}

export function save(subs: Subscription[]): boolean {
  try {
    localStorage.setItem(KEY, JSON.stringify(subs));
    return true;
  } catch {
    return false;
  }
}

function isSubscription(x: unknown): x is Subscription {
  if (typeof x !== "object" || x === null) return false;
  const s = x as Record<string, unknown>;
  const numOrNull = (v: unknown) => v === null || (typeof v === "number" && Number.isFinite(v) && v >= 0);
  return (
    typeof s.id === "string" &&
    typeof s.name === "string" &&
    typeof s.price === "number" &&
    Number.isFinite(s.price) &&
    s.price >= 0 &&
    isCycle(s.cycle) &&
    typeof s.category === "string" &&
    (CATEGORIES as readonly string[]).includes(s.category) &&
    numOrNull(s.usesPerMonth) &&
    numOrNull(s.annualPrice) &&
    typeof s.note === "string"
  );
}
