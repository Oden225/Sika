import { test } from "node:test";
import assert from "node:assert/strict";
import * as act from "../js/actions.js";

const base = () => ({
  transactions: [],
  goals: [{ id: "g", name: "Terrain", target: 100000, saved: 40000 }],
  recurring: [
    { id: "r", type: "expense", amount: 25000, category: "epargne", note: "Épargne : Terrain", frequency: "monthly", start: "2026-08-30", lastRun: null, goalId: "g" },
  ],
});

test("versement automatique : crédite l'objectif à chaque échéance", () => {
  const s = base();
  const n = act.applyRecurring(s, "2026-09-30");
  assert.equal(n, 2);
  assert.equal(s.goals[0].saved, 90000);
  assert.deepEqual(s.transactions.map((t) => [t.date, t.amount, t.goalId]), [["2026-08-30", 25000, "g"], ["2026-09-30", 25000, "g"]]);
  assert.equal(s.recurring[0].paused, undefined);
});

test("versement automatique : dernier versement ajusté puis pause quand l'objectif est atteint", () => {
  const s = base();
  act.applyRecurring(s, "2026-12-31");
  assert.equal(s.goals[0].saved, 100000);
  assert.deepEqual(s.transactions.map((t) => t.amount), [25000, 25000, 10000]);
  assert.equal(s.recurring[0].paused, true);
  assert.equal(s.recurring[0].pausedReason, "goal_reached");
});

test("versement à confirmer : payRule crédite l'objectif et plafonne", () => {
  const s = base();
  const rule = { ...s.recurring[0], auto: false };
  s.recurring = [rule];
  const tx = act.payRule(s, rule, { amount: 70000, date: "2026-10-01", occurrence: "2026-09-30" });
  assert.equal(tx.amount, 60000);
  assert.equal(tx.goalId, "g");
  assert.equal(s.goals[0].saved, 100000);
  assert.equal(rule.paused, true);
  assert.equal(act.payRule(s, rule, { amount: 5000, date: "2026-10-02", occurrence: "2026-10-30" }), null);
});

test("objectif supprimé : le versement est mis en pause sans transaction", () => {
  const s = base();
  s.goals = [];
  assert.equal(act.applyRecurring(s, "2026-09-01"), 0);
  assert.equal(s.recurring[0].pausedReason, "goal_deleted");
});
