import { test } from "node:test";
import assert from "node:assert/strict";
import * as calc from "../js/calc.js";

const tx = [
  { type: "income", amount: 300000, category: "Salaire", date: "2026-10-01" },
  { type: "expense", amount: 80000, category: "Logement", date: "2026-10-03" },
  { type: "expense", amount: 45000, category: "Alimentation", date: "2026-10-10" },
  { type: "expense", amount: 15000, category: "Alimentation", date: "2026-10-20" },
  { type: "expense", amount: 20000, category: "Transport", date: "2026-09-28" },
];

test("monthKey", () => {
  assert.equal(calc.monthKey("2026-01-31"), "2026-01");
  assert.equal(calc.monthKey(new Date(2026, 11, 5)), "2026-12");
});

test("monthsBetween compte les mois entiers, minimum 1", () => {
  assert.equal(calc.monthsBetween("2026-10-11", "2027-10-11"), 12);
  assert.equal(calc.monthsBetween("2026-10-11", "2027-10-10"), 11);
  assert.equal(calc.monthsBetween("2026-10-11", "2026-10-20"), 1);
  assert.equal(calc.monthsBetween("2026-10-11", "2025-01-01"), 1);
});

test("summarize et filterByMonth", () => {
  const oct = calc.filterByMonth(tx, "2026-10");
  assert.equal(oct.length, 4);
  assert.deepEqual(calc.summarize(oct), { income: 300000, expense: 140000, balance: 160000 });
});

test("expensesByCategory trie par montant décroissant", () => {
  const cats = calc.expensesByCategory(calc.filterByMonth(tx, "2026-10"));
  assert.deepEqual(cats, [
    { category: "Logement", amount: 80000 },
    { category: "Alimentation", amount: 60000 },
  ]);
});

test("savingsRate", () => {
  assert.equal(calc.savingsRate(300000, 240000), 0.2);
  assert.equal(calc.savingsRate(0, 1000), 0);
});

test("monthlyContribution sans intérêts", () => {
  assert.equal(calc.monthlyContribution(1200000, 0, 12), 100000);
  assert.equal(calc.monthlyContribution(1200000, 600000, 12), 50000);
  assert.equal(calc.monthlyContribution(1000, 2000, 12), 0);
});

test("monthlyContribution avec intérêts atteint exactement la cible", () => {
  const target = 1000000, saved = 100000, months = 24, rate = 0.06;
  const pmt = calc.monthlyContribution(target, saved, months, rate);
  const pts = calc.projectSavings(saved, pmt, rate, 2);
  assert.ok(Math.abs(pts.at(-1).balance - target) < 0.01);
  assert.ok(pmt < (target - saved) / months);
});

test("projectSavings", () => {
  const pts = calc.projectSavings(0, 10000, 0, 2);
  assert.equal(pts.length, 3);
  assert.equal(pts[2].balance, 240000);
  assert.equal(pts[2].contributed, 240000);
});

test("budgetRule et goalProgress", () => {
  assert.deepEqual(calc.budgetRule(100), { needs: 50, wants: 30, savings: 20 });
  assert.equal(calc.goalProgress({ target: 200, saved: 50 }), 0.25);
  assert.equal(calc.goalProgress({ target: 200, saved: 500 }), 1);
});

test("nthOccurrence : fin de mois, hebdomadaire et annuel", () => {
  assert.equal(calc.nthOccurrence("2026-01-31", "monthly", 1), "2026-02-28");
  assert.equal(calc.nthOccurrence("2026-01-31", "monthly", 2), "2026-03-31");
  assert.equal(calc.nthOccurrence("2026-11-15", "monthly", 3), "2027-02-15");
  assert.equal(calc.nthOccurrence("2026-12-28", "weekly", 1), "2027-01-04");
  assert.equal(calc.nthOccurrence("2028-02-29", "yearly", 1), "2029-02-28");
});

test("occurrencesBetween respecte after, until et end", () => {
  const rule = { start: "2026-07-25", frequency: "monthly" };
  assert.deepEqual(calc.occurrencesBetween(rule, null, "2026-10-11"), ["2026-07-25", "2026-08-25", "2026-09-25"]);
  assert.deepEqual(calc.occurrencesBetween(rule, "2026-08-25", "2026-10-25"), ["2026-09-25", "2026-10-25"]);
  assert.deepEqual(calc.occurrencesBetween({ ...rule, end: "2026-08-31" }, null, "2026-12-31"), ["2026-07-25", "2026-08-25"]);
  assert.deepEqual(calc.occurrencesBetween({ start: "2026-11-01", frequency: "monthly" }, null, "2026-10-11"), []);
});

test("nextOccurrence", () => {
  const rule = { start: "2026-01-05", frequency: "monthly" };
  assert.equal(calc.nextOccurrence(rule, "2026-10-11"), "2026-11-05");
  assert.equal(calc.nextOccurrence({ ...rule, end: "2026-10-31" }, "2026-10-11"), null);
});

test("generateRecurring rattrape les échéances sans doublon", () => {
  const rules = [
    { id: "r1", type: "income", amount: 300000, category: "Salaire", note: "Salaire", start: "2026-08-28", frequency: "monthly" },
    { id: "r2", type: "expense", amount: 80000, category: "Logement", note: "Loyer", start: "2026-10-05", frequency: "monthly", paused: true },
  ];
  const first = calc.generateRecurring(rules, "2026-10-11");
  assert.deepEqual(first.transactions.map((t) => t.date), ["2026-08-28", "2026-09-28"]);
  assert.equal(first.transactions[0].recurringId, "r1");
  assert.equal(first.rules[0].lastRun, "2026-09-28");
  assert.equal(first.rules[1], rules[1]);

  const again = calc.generateRecurring(first.rules, "2026-10-27");
  assert.equal(again.transactions.length, 0);
  const later = calc.generateRecurring(first.rules, "2026-10-28");
  assert.deepEqual(later.transactions.map((t) => t.date), ["2026-10-28"]);
});

test("upcomingThisMonth", () => {
  const rules = [
    { id: "a", start: "2026-01-28", frequency: "monthly", amount: 1 },
    { id: "b", start: "2026-01-05", frequency: "monthly", amount: 1 },
    { id: "c", start: "2026-10-12", frequency: "weekly", amount: 1 },
  ];
  assert.deepEqual(
    calc.upcomingThisMonth(rules, "2026-10-11").map((r) => `${r.id}:${r.date}`),
    ["c:2026-10-12", "c:2026-10-19", "c:2026-10-26", "a:2026-10-28"],
  );
});
