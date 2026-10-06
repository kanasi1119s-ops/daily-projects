import { describe, expect, it } from "vitest";
import { calculate, parseTable, taxIncluded, toCsv, type Entry } from "../src/calc";
import { ratioFor } from "../src/schedule";

const e = (date: string, amount: number, o: Partial<Entry> = {}): Entry => ({ date, supplier: "x", amount, rate: 10, registered: false, ...o });

describe("ratioFor", () => {
  it.each([
    ["2023-09-30", 1], ["2023-10-01", 0.8], ["2026-09-30", 0.8], ["2026-10-01", 0.7],
    ["2028-09-30", 0.7], ["2028-10-01", 0.5], ["2030-09-30", 0.5], ["2030-10-01", 0.3],
    ["2031-09-30", 0.3], ["2031-10-01", 0],
  ])("%s -> %s", (d, r) => expect(ratioFor(d).ratio).toBe(r));
});

describe("calculate", () => {
  it("10%: 110,000円 -> 税10,000, 70%控除=7,000", () => {
    const s = calculate([e("2026-10-15", 110000)]);
    expect(s.lines[0]).toMatchObject({ tax: 10000, deductible: 7000, nonDeductible: 3000 });
  });
  it("8%: 108,000円 -> 税8,000", () => expect(taxIncluded(108000, 8)).toBe(8000));
  it("インボイス発行事業者は全額控除", () => {
    expect(calculate([e("2026-10-15", 110000, { registered: true })]).totalDeductible).toBe(10000);
  });
  it("1円未満切り捨て", () => expect(calculate([e("2026-10-15", 999)]).lines[0].tax).toBe(90));
  it("1億円超過分は控除0（行が上限をまたぐ場合は按分）", () => {
    const s = calculate([e("2026-10-01", 99_000_000), e("2026-10-02", 2_000_000)]);
    expect(s.capWarning).toBe(true);
    expect(s.lines[0].capExceeded).toBe(false);
    expect(s.lines[1].capExceeded).toBe(true);
    // 2,000,000のうち1,000,000のみ対象: tax=181818 -> 90909 -> 70% = 63636
    expect(s.lines[1].deductible).toBe(Math.floor(Math.floor((181818 * 1_000_000) / 2_000_000) * 0.7));
  });
  it("上限は取引日順に適用され、入力順は維持される", () => {
    const s = calculate([e("2026-12-01", 2_000_000), e("2026-10-01", 99_000_000)]);
    expect(s.lines[0].capExceeded).toBe(true);
    expect(s.lines[1].capExceeded).toBe(false);
  });
  it("空入力", () => expect(calculate([]).totalTax).toBe(0));
});

describe("parseTable", () => {
  it("ヘッダ読み飛ばし・カンマ/タブ・スラッシュ日付", () => {
    const r = parseTable("取引日,取引先,税込金額,税率,発行事業者\n2026/10/5,A商店,\"110,000\",10,N\n2026-11-01\tB\t5400\t8\tY");
    expect(r.errors).toEqual([]);
    expect(r.entries).toHaveLength(2);
    expect(r.entries[0]).toMatchObject({ date: "2026-10-05", amount: 110000, registered: false });
    expect(r.entries[1]).toMatchObject({ rate: 8, registered: true });
  });
  it("不正行はエラーとして報告", () => {
    const r = parseTable("2026-13-01,A,100,10,N\n2026-10-01,A,abc,10,N\n2026-10-01,A,100,5,N\n2026-10-01,A,100,10,Z");
    expect(r.entries).toHaveLength(0);
    expect(r.errors).toHaveLength(4);
  });
});

describe("toCsv", () => {
  it("数式インジェクションを無効化しBOMを付ける", () => {
    const csv = toCsv(calculate([e("2026-10-15", 1000, { supplier: "=cmd()" })]));
    expect(csv.startsWith("﻿")).toBe(true);
    expect(csv).toContain("'=cmd()");
  });
});
