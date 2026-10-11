import { test } from "node:test";
import assert from "node:assert/strict";
import { normalize, hasData } from "../js/store.js";

test("migration des données de la première version", () => {
  const v1 = {
    settings: { currency: "FCFA" },
    transactions: [{ id: "a", type: "expense", amount: 5000, category: "Logement", date: "2026-10-01" }, { bad: true }],
    goals: [{ id: "g", name: "Urgence", target: 100000, saved: 0, deadline: "2027-01-01", rate: 0 }],
    budgets: { Alimentation: 50000, Loisirs: "" },
    recurring: [{ id: "r", type: "income", amount: 1, category: "Salaire", start: "2026-01-31", frequency: "monthly" }],
  };
  const s = normalize(v1);
  assert.equal(s.version, 2);
  assert.equal(s.transactions.length, 1);
  assert.equal(s.transactions[0].category, "loyer");
  assert.deepEqual(s.budgets, { alimentation: 50000 });
  assert.equal(s.recurring[0].category, "salaire");
  assert.equal(s.recurring[0].auto, true);
  assert.deepEqual(s.tontines, []);
  assert.ok(hasData(s));
});

test("normalize v2 garde auto:false et complète les champs", () => {
  const s = normalize({
    version: 2,
    recurring: [{ id: "r", amount: 1, start: "2026-01-01", frequency: "monthly", auto: false, category: "electricite" }],
    debts: [{ id: "d", person: "Yao", amount: 1000, direction: "lent" }],
    tontines: [{ id: "t", name: "T", amount: 100, members: ["Moi"] }],
  });
  assert.equal(s.recurring[0].auto, false);
  assert.equal(s.recurring[0].remindDays, 2);
  assert.deepEqual(s.debts[0].repayments, []);
  assert.deepEqual(s.tontines[0].paid, {});
  assert.equal(hasData(normalize(null)), false);
});
