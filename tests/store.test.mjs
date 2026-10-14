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
    tontines: [{ id: "t", name: "T", amount: 100, start: "2026-10-01", members: ["Moi"] }],
  });
  assert.equal(s.recurring[0].auto, false);
  assert.equal(s.recurring[0].remindDays, 2);
  assert.deepEqual(s.debts[0].repayments, []);
  assert.deepEqual(s.tontines[0].paid, {});
  assert.equal(hasData(normalize(null)), false);
});

test("sécurité : un fichier piégé ne peut rien injecter dans l'affichage", () => {
  const evil = '"><img src=x onerror=alert(1)>';
  const s = normalize({
    version: 2,
    updatedAt: evil,
    settings: { currency: "FCFA", savePercent: "10" + evil, goalForSavings: evil, theme: { mode: evil, accent: evil, glass: "full" }, fees: { wave: { send: { rate: evil, cap: 0 } } } },
    transactions: [
      { id: "t1" + evil, type: evil, amount: 1000, category: evil, date: "2026-10-14", note: "ok", method: evil, recurringId: evil, goalId: "g1" },
      { id: "t2", type: "expense", amount: 500, category: "transport", date: "2026-10-14" + evil },
      { id: "t3", type: "income", amount: "1e3", category: "loyer", date: "2026-10-01", round: evil },
    ],
    recurring: [
      { id: "r1", type: "expense", amount: 5000, category: "loyer", note: "Loyer", frequency: evil, start: "2026-10-01" },
      { id: "r2" + evil, type: "expense", amount: 5000, category: "loyer", note: "Loyer", frequency: "monthly", start: "2026-10-01", end: evil, lastRun: evil, remindDays: evil, pausedReason: evil },
    ],
    goals: [{ id: "g" + evil, name: "Terrain", target: 100000, saved: evil, deadline: "2027-01-01", rate: evil }],
    tontines: [{ id: "x", name: "T", amount: 100, start: "2026-10-01", frequency: evil, members: ["Moi", 42, "Awa"], myIndex: evil, paid: { 0: [0, evil, 9], [evil]: [1] } }],
    debts: [{ id: "d", person: "Yao", amount: 1000, direction: evil, date: evil, due: evil, repayments: [{ id: evil, amount: 10, date: "2026-10-02" }, { amount: evil, date: "2026-10-02" }] }],
    budgets: { transport: 1000, [evil]: 5, salaire: 100 },
  });
  const json = JSON.stringify(s);
  assert.ok(!json.includes("<img"), "aucune balise ne survit hors des textes libres échappés");

  const [t1, t3] = s.transactions;
  assert.equal(s.transactions.length, 2, "date invalide : transaction rejetée");
  assert.match(t1.id, /^[A-Za-z0-9_-]+$/);
  assert.equal(t1.type, "expense");
  assert.equal(t1.category, "autre_depense");
  assert.equal(t1.method, "");
  assert.equal(t1.recurringId, undefined);
  assert.equal(t1.goalId, "g1");
  assert.equal(t3.amount, 1000);
  assert.equal(t3.category, "autre_revenu", "catégorie d'un autre type : remplacée");
  assert.equal(t3.round, undefined);

  assert.equal(s.recurring.length, 1, "fréquence inconnue : règle rejetée");
  const r = s.recurring[0];
  assert.match(r.id, /^[A-Za-z0-9_-]+$/);
  assert.equal(r.end, null);
  assert.equal(r.lastRun, null);
  assert.equal(r.remindDays, 2);
  assert.equal(r.pausedReason, undefined);

  assert.match(s.goals[0].id, /^[A-Za-z0-9_-]+$/);
  assert.equal(s.goals[0].saved, 0);
  assert.equal(s.goals[0].rate, 0);

  const t = s.tontines[0];
  assert.deepEqual(t.members, ["Moi", "Awa"]);
  assert.equal(t.frequency, "monthly");
  assert.equal(t.myIndex, 0);
  assert.deepEqual(t.paid, { 0: [0] });

  const d = s.debts[0];
  assert.equal(d.direction, "lent");
  assert.match(d.date, /^\d{4}-\d{2}-\d{2}$/);
  assert.equal(d.due, null);
  assert.equal(d.repayments.length, 1);
  assert.match(d.repayments[0].id, /^[A-Za-z0-9_-]+$/);

  assert.deepEqual(s.budgets, { transport: 1000 });
  assert.equal(s.updatedAt, null);
  assert.equal(s.settings.savePercent, 10);
  assert.equal(s.settings.goalForSavings, null);
  assert.deepEqual(s.settings.theme, { mode: "auto", accent: "indigo", glass: "full", splash: true });
  assert.deepEqual(s.settings.fees, { wave: { send: { rate: 0, cap: 0 } } });
});

test("normalize conserve un état valide à l'identique (aller-retour)", () => {
  const valid = normalize({
    version: 2,
    updatedAt: "2026-10-14T10:00:00.000Z",
    settings: { currency: "FCFA", firstName: "Aya", lastName: "Koné", name: "Aya", onboarded: true, savePercent: 15, theme: { mode: "dark", accent: "or", glass: "lite", splash: false } },
    transactions: [{ id: "a1", type: "expense", amount: 1500, category: "transport", date: "2026-10-14", note: "Gbaka", method: "wave", recurringId: "r1", goalId: "g1" }],
    recurring: [{ id: "r1", type: "expense", amount: 5000, category: "epargne", note: "Épargne", frequency: "monthly", start: "2026-10-01", lastRun: "2026-10-01", auto: false, variable: false, remindDays: 1, goalId: "g1", paused: true, pausedReason: "goal_reached" }],
    goals: [{ id: "g1", name: "Terrain", icon: "🏗️", target: 100000, saved: 5000, deadline: "2027-06-30", rate: 0.035 }],
    tontines: [{ id: "t1", name: "Bureau", amount: 25000, frequency: "weekly", start: "2026-08-15", members: ["Awa", "Moi"], myIndex: 1, paid: { 0: [0, 1] }, received: true }],
    debts: [{ id: "d1", direction: "borrowed", person: "Yao", amount: 30000, date: "2026-10-02", due: "2026-11-01", note: "", repayments: [{ id: "p1", amount: 10000, date: "2026-10-10" }] }],
    budgets: { alimentation: 90000 },
  });
  assert.deepEqual(normalize(JSON.parse(JSON.stringify(valid))), valid);
  assert.equal(valid.transactions[0].method, "wave");
  assert.equal(valid.recurring[0].pausedReason, "goal_reached");
  assert.equal(valid.settings.theme.accent, "or");
});
