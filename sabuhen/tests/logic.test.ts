import { describe, expect, it } from "vitest";
import {
  annualSwitchSavings, assess, costPerUse, csvEscape, duplicateCategories, fromCsv,
  monthlyCost, parseCsv, parseNumberField, simulateCancel, toCsv, totals,
  validateSubscription, sampleData, type Subscription,
} from "../src/logic";

let n = 0;
const id = () => `t${++n}`;
const sub = (o: Partial<Subscription> = {}): Subscription => ({
  id: id(), name: "A", price: 1000, cycle: "monthly", category: "動画",
  usesPerMonth: 10, annualPrice: null, note: "", ...o,
});
const input = (o: Record<string, string> = {}) => ({
  name: "A", price: "1000", cycle: "monthly", category: "動画", usesPerMonth: "", annualPrice: "", note: "", ...o,
});

describe("cost", () => {
  it("converts cycles to monthly", () => {
    expect(monthlyCost(sub({ price: 1200 }))).toBe(1200);
    expect(monthlyCost(sub({ price: 3000, cycle: "quarterly" }))).toBe(1000);
    expect(monthlyCost(sub({ price: 12000, cycle: "yearly" }))).toBe(1000);
  });
  it("totals", () => {
    expect(totals([sub(), sub({ price: 12000, cycle: "yearly" })])).toEqual({ monthly: 2000, yearly: 24000 });
    expect(totals([])).toEqual({ monthly: 0, yearly: 0 });
  });
  it("cost per use", () => {
    expect(costPerUse(sub({ usesPerMonth: null }))).toBeNull();
    expect(costPerUse(sub({ usesPerMonth: 0 }))).toBe(Infinity);
    expect(costPerUse(sub({ usesPerMonth: 4 }))).toBe(250);
  });
  it("annual switch savings", () => {
    expect(annualSwitchSavings(sub({ annualPrice: 10000 }))).toBe(2000);
    expect(annualSwitchSavings(sub({ annualPrice: 12000 }))).toBeNull();
    expect(annualSwitchSavings(sub({ annualPrice: 13000 }))).toBeNull();
    expect(annualSwitchSavings(sub({ cycle: "yearly", annualPrice: 100 }))).toBeNull();
  });
});

describe("assess", () => {
  it("verdicts by threshold boundaries", () => {
    const v = (uses: number | null, price = 1000) => assess(sub({ price, usesPerMonth: uses, category: "その他" }), []).verdict;
    expect(v(null)).toBe("unknown");
    expect(v(0)).toBe("cancel");
    expect(v(1)).toBe("cancel"); // 1000/回 = 閾値ちょうど
    expect(v(2)).toBe("review"); // 500/回
    expect(v(3)).toBe("keep");
  });
  it("duplicates promote keep to review but not to cancel", () => {
    const a = sub({ usesPerMonth: 100 });
    const b = sub({ usesPerMonth: 100 });
    expect(duplicateCategories([a, b])).toEqual(["動画"]);
    expect(assess(a, [a, b]).verdict).toBe("review");
  });
  it("その他 is never a duplicate", () => {
    const a = sub({ category: "その他" });
    expect(duplicateCategories([a, sub({ category: "その他" })])).toEqual([]);
  });
  it("free plans are never cancel candidates", () => {
    const a = assess(sub({ price: 0, usesPerMonth: 0, category: "その他" }), []);
    expect(a.verdict).toBe("keep");
  });
  it("simulate cancel", () => {
    const a = sub({ price: 1000 });
    const b = sub({ price: 2400, cycle: "yearly" });
    expect(simulateCancel([a, b], new Set([a.id, b.id]))).toEqual({ monthly: 1200, yearly: 14400 });
    expect(simulateCancel([a, b], new Set(["zzz"]))).toEqual({ monthly: 0, yearly: 0 });
  });
});

describe("validation", () => {
  it("accepts valid and normalises full-width digits / commas", () => {
    const r = validateSubscription(input({ price: "１,２００", usesPerMonth: "８" }), "x");
    expect(r.ok).toBe(true);
    expect(r.value?.price).toBe(1200);
    expect(r.value?.usesPerMonth).toBe(8);
  });
  it("rejects bad input", () => {
    expect(validateSubscription(input({ name: " " }), "x").ok).toBe(false);
    expect(validateSubscription(input({ price: "" }), "x").ok).toBe(false);
    expect(validateSubscription(input({ price: "-5" }), "x").ok).toBe(false);
    expect(validateSubscription(input({ price: "abc" }), "x").ok).toBe(false);
    expect(validateSubscription(input({ price: "1e9" }), "x").ok).toBe(false);
    expect(validateSubscription(input({ price: "99999999" }), "x").ok).toBe(false);
    expect(validateSubscription(input({ usesPerMonth: "-1" }), "x").ok).toBe(false);
  });
  it("rejects prototype-key cycles", () => {
    for (const c of ["constructor", "toString", "__proto__", "hasOwnProperty", ""]) {
      expect(validateSubscription(input({ cycle: c }), "x").ok).toBe(false);
    }
  });
  it("unknown category falls back to その他", () => {
    expect(validateSubscription(input({ category: "zzz" }), "x").value?.category).toBe("その他");
  });
  it("parseNumberField", () => {
    expect(parseNumberField("")).toBeNull();
    expect(parseNumberField("  ")).toBeNull();
    expect(parseNumberField("12.5")).toBe(12.5);
    expect(parseNumberField("1 2")).toBeNaN();
  });
});

describe("csv", () => {
  it("escapes formula injection and quotes", () => {
    expect(csvEscape("=SUM(A1)")).toBe("'=SUM(A1)");
    expect(csvEscape("@x")).toBe("'@x");
    expect(csvEscape('a"b')).toBe('"a""b"');
    expect(csvEscape("a,b")).toBe('"a,b"');
    expect(csvEscape("plain")).toBe("plain");
  });
  it("round trips including tricky strings", () => {
    const list = [
      sub({ name: '=cmd|"x"', note: "line1\nline2, with comma" }),
      sub({ name: "日本語", usesPerMonth: null, annualPrice: 5000 }),
    ];
    const r = fromCsv(toCsv(list), id);
    expect(r.errors).toEqual([]);
    expect(r.subs.map(({ id: _i, ...rest }) => rest)).toEqual(list.map(({ id: _i, ...rest }) => rest));
  });
  it("handles BOM, CRLF and reports bad rows with line numbers", () => {
    const csv = "﻿name,price,cycle\r\nOK,100,monthly\r\nBad,xx,monthly\r\nBad2,100,weekly\r\n";
    const r = fromCsv(csv, id);
    expect(r.subs).toHaveLength(1);
    expect(r.errors).toHaveLength(2);
    expect(r.errors[0]).toContain("3行目");
  });
  it("rejects missing header / empty", () => {
    expect(fromCsv("", id).errors.length).toBe(1);
    expect(fromCsv("a,b\n1,2", id).subs).toEqual([]);
  });
  it("caps rows", () => {
    const rows = Array.from({ length: 600 }, (_, i) => `S${i},100,monthly`).join("\n");
    const r = fromCsv("name,price,cycle\n" + rows, id);
    expect(r.subs).toHaveLength(500);
    expect(r.errors.length).toBe(1);
  });
  it("parseCsv handles quoted newline", () => {
    expect(parseCsv('a,"b\nc"\n1,2')).toEqual([["a", "b\nc"], ["1", "2"]]);
  });
  it("sample data is valid", () => {
    const s = sampleData(id);
    expect(fromCsv(toCsv(s), id).errors).toEqual([]);
  });
});
