// Formulaires présentés dans la feuille du bas.

import * as calc from "./calc.js";
import * as act from "./actions.js";
import { categoriesOf, BILL_TEMPLATES, FREQUENCIES, OPERATORS, PAYMENT_METHODS } from "./data.js";
import { uid } from "./store.js";
import { $, $$, esc, money, num, icon, openSheet, closeSheet, toast, today, isoDate, fmtDate, readAmount, toggle, catIcon } from "./ui.js";

// ---------- Morceaux de formulaire ----------

const amountField = (value = "", label = "Montant") => `
  <label class="amount-field">
    <span>${label}</span>
    <div><input name="amount" type="text" inputmode="numeric" autocomplete="off" required placeholder="0" value="${value ? num(value) : ""}" autofocus><b>F</b></div>
  </label>`;

function categoryPicker(type, selected) {
  return `<fieldset class="cat-picker"><legend>Catégorie</legend><div class="cat-scroll">
    ${categoriesOf(type)
      .map(
        (c) => `<label class="cat-chip"><input type="radio" name="category" value="${c.id}" ${c.id === selected ? "checked" : ""}>
        <span>${catIcon(c.id, "sm")}<em>${esc(c.label)}</em></span></label>`,
      )
      .join("")}
  </div></fieldset>`;
}

const methodPicker = (selected = "") => `
  <fieldset class="chips"><legend>Payé avec <small>(facultatif)</small></legend>
    ${Object.entries(PAYMENT_METHODS)
      .map(([k, v]) => `<label class="chip"><input type="radio" name="method" value="${k}" ${k === selected ? "checked" : ""}><span>${esc(v)}</span></label>`)
      .join("")}
  </fieldset>`;

const segmented = (name, options, selected) => `
  <div class="segmented" role="radiogroup">
    ${options.map(([v, l]) => `<label><input type="radio" name="${name}" value="${v}" ${v === selected ? "checked" : ""}><span>${l}</span></label>`).join("")}
  </div>`;

/** Formate le montant pendant la saisie (espaces des milliers). */
function liveAmount(input) {
  input.addEventListener("input", () => {
    const digits = input.value.replace(/\D/g, "");
    input.value = digits ? num(Number(digits)) : "";
  });
}

const radio = (form, name) => form.querySelector(`[name="${name}"]:checked`)?.value;

// ---------- Ajout rapide ----------

/** Feuille « Ajouter » : dépense, revenu, Mobile Money ou paiement programmé. */
export function openAddSheet(ctx, initialTab = "expense") {
  openSheet(
    "Ajouter",
    `${segmented("tab", [["expense", "Dépense"], ["income", "Revenu"], ["momo", "Mobile Money"], ["rule", "Programmer"]], initialTab)}
     <div class="add-pane"></div>`,
    (root) => {
      const pane = $(".add-pane", root);
      const show = (tab) => {
        if (tab === "momo") return mobileMoneyForm(ctx, pane);
        if (tab === "rule") return ruleForm(ctx, pane);
        return transactionForm(ctx, pane, tab);
      };
      $$("[name=tab]", root).forEach((r) => r.addEventListener("change", () => show(r.value)));
      show(initialTab);
    },
  );
}

function transactionForm(ctx, pane, type, existing = null) {
  const t = existing || { type, category: type === "income" ? "salaire" : "alimentation", date: today(), note: "", method: "" };
  pane.innerHTML = `
    <form class="form" novalidate>
      ${amountField(t.amount)}
      ${categoryPicker(t.type, t.category)}
      <div class="row-2">
        <label class="field"><span>Date</span><input name="date" type="date" value="${t.date}" required></label>
        <label class="field"><span>Note</span><input name="note" maxlength="80" value="${esc(t.note)}" placeholder="${t.type === "income" ? "ex. Vente du jour" : "ex. Marché d'Adjamé"}"></label>
      </div>
      ${methodPicker(t.method)}
      <div class="form-actions">
        ${existing ? `<button type="button" class="btn danger-soft" data-del>${icon("trash")} Supprimer</button>` : ""}
        <button class="btn primary block">${existing ? "Enregistrer" : t.type === "income" ? "Ajouter le revenu" : "Ajouter la dépense"}</button>
      </div>
    </form>`;
  const form = $("form", pane);
  liveAmount(form.amount);
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const amount = readAmount(form.amount.value);
    if (!(amount > 0)) return shakeField(form.amount, "Indiquez un montant");
    const data = {
      type: t.type,
      amount,
      category: radio(form, "category") || t.category,
      date: form.date.value || today(),
      note: form.note.value.trim(),
      method: radio(form, "method") || "",
    };
    if (existing) {
      Object.assign(existing, data);
      ctx.commit();
      closeSheet();
      return toast("Transaction modifiée");
    }
    act.addTransaction(ctx.state, data);
    ctx.commit();
    if (data.type === "income" && ctx.state.settings.savePercent > 0 && ctx.state.goals.length) {
      return savingPrompt(ctx, pane, data.amount);
    }
    closeSheet();
    toast(data.type === "income" ? "Revenu ajouté" : "Dépense ajoutée");
  });
  $("[data-del]", pane)?.addEventListener("click", () => {
    if (!confirm("Supprimer cette transaction ?")) return;
    ctx.state.transactions = ctx.state.transactions.filter((x) => x !== existing);
    ctx.commit();
    closeSheet();
    toast("Transaction supprimée");
  });
}

/** Après un revenu : proposer de mettre un pourcentage de côté (revenus irréguliers). */
function savingPrompt(ctx, pane, income) {
  const { savePercent, goalForSavings } = ctx.state.settings;
  const suggested = calc.suggestedSaving(income, savePercent) || Math.round((income * savePercent) / 100);
  const goals = ctx.state.goals.filter((g) => g.saved < g.target);
  if (!goals.length || suggested <= 0) {
    closeSheet();
    return toast("Revenu ajouté");
  }
  const selected = goals.find((g) => g.id === goalForSavings)?.id || goals[0].id;
  pane.innerHTML = `
    <div class="saving-prompt">
      <div class="saving-emoji" aria-hidden="true">🐷</div>
      <h3>Revenu ajouté ! On met un peu de côté ?</h3>
      <p class="muted">Votre règle : épargner ${savePercent} % de chaque rentrée d'argent.</p>
      <form class="form">
        ${amountField(suggested, "À mettre de côté")}
        <label class="field"><span>Vers l'objectif</span>
          <select name="goal">${goals.map((g) => `<option value="${g.id}" ${g.id === selected ? "selected" : ""}>${esc(g.name)}</option>`).join("")}</select>
        </label>
        <div class="form-actions">
          <button type="button" class="btn ghost" data-skip>Pas cette fois</button>
          <button class="btn primary">Épargner</button>
        </div>
      </form>
    </div>`;
  const form = $("form", pane);
  liveAmount(form.amount);
  $("[data-skip]", pane).addEventListener("click", () => {
    closeSheet();
    toast("Revenu ajouté");
  });
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const amount = readAmount(form.amount.value);
    const goal = ctx.state.goals.find((g) => g.id === form.goal.value);
    if (!(amount > 0) || !goal) return;
    act.moveToGoal(ctx.state, goal, amount, today());
    ctx.state.settings.goalForSavings = goal.id;
    ctx.commit();
    closeSheet();
    toast(`${money(amount)} mis de côté pour « ${goal.name} »`);
  });
}

export function openTransactionSheet(ctx, tx) {
  openSheet("Modifier la transaction", `<div class="add-pane"></div>`, (root) => transactionForm(ctx, $(".add-pane", root), tx.type, tx));
}

function shakeField(input, msg) {
  toast(msg);
  const box = input.closest("label") || input;
  box.classList.remove("shake");
  void box.offsetWidth;
  box.classList.add("shake");
  input.focus();
}

// ---------- Mobile Money ----------

export function feesFor(state, operator, operation) {
  return state.settings.fees?.[operator]?.[operation] || OPERATORS[operator].fees[operation] || { rate: 0, cap: 0 };
}

function mobileMoneyForm(ctx, pane) {
  pane.innerHTML = `
    <form class="form" novalidate>
      ${segmented("operation", [["send", "Envoi"], ["withdraw", "Retrait"], ["deposit", "Dépôt"]], "send")}
      <fieldset class="chips operators"><legend>Opérateur</legend>
        ${Object.entries(OPERATORS)
          .map(([k, o], i) => `<label class="chip op" style="--op:${o.color}"><input type="radio" name="operator" value="${k}" ${i === 0 ? "checked" : ""}><span><i></i>${esc(o.label)}</span></label>`)
          .join("")}
      </fieldset>
      ${amountField()}
      <div class="fee-box">
        <label class="field"><span>Frais</span><input name="fee" type="text" inputmode="numeric" value="0"></label>
        <p class="muted fee-hint"></p>
      </div>
      <div class="send-only">
        ${categoryPicker("expense", "famille")}
        <label class="field"><span>Destinataire / motif</span><input name="note" maxlength="80" placeholder="ex. Maman au village"></label>
      </div>
      <p class="muted withdraw-only" hidden>Un retrait ou un dépôt ne change pas votre total : seuls les frais sont comptés comme dépense.</p>
      <label class="field"><span>Date</span><input name="date" type="date" value="${today()}"></label>
      <button class="btn primary block">Enregistrer</button>
    </form>`;
  const form = $("form", pane);
  liveAmount(form.amount);
  liveAmount(form.fee);
  let feeEdited = false;
  form.fee.addEventListener("input", () => (feeEdited = true));

  const refresh = () => {
    const operation = radio(form, "operation");
    const operator = radio(form, "operator");
    $(".send-only", form).hidden = operation !== "send";
    $(".withdraw-only", form).hidden = operation === "send";
    const amount = readAmount(form.amount.value) || 0;
    const grid = operation === "deposit" ? { rate: 0, cap: 0 } : feesFor(ctx.state, operator, operation);
    if (!feeEdited) form.fee.value = num(calc.mobileMoneyFee(amount, grid));
    $(".fee-hint", form).textContent =
      operation === "deposit"
        ? "Dépôt généralement gratuit."
        : `${OPERATORS[operator].label} : ${grid.rate} %${grid.cap ? `, plafonné à ${num(grid.cap)} F` : ""} (modifiable dans Réglages).`;
  };
  form.addEventListener("input", (e) => e.target.name !== "fee" && refresh());
  form.addEventListener("change", (e) => {
    if (e.target.name === "operation" || e.target.name === "operator") feeEdited = false;
    refresh();
  });
  refresh();

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const amount = readAmount(form.amount.value);
    if (!(amount > 0)) return shakeField(form.amount, "Indiquez un montant");
    const operator = radio(form, "operator");
    const created = act.mobileMoney(ctx.state, {
      operation: radio(form, "operation"),
      operator,
      operatorLabel: OPERATORS[operator].label,
      amount,
      fee: readAmount(form.fee.value) || 0,
      category: radio(form, "category") || "famille",
      note: form.note.value.trim(),
      date: form.date.value || today(),
    });
    ctx.commit();
    closeSheet();
    toast(created.length ? "Opération enregistrée" : "Rien à enregistrer (aucun frais)");
  });
}

// ---------- Paiements programmés ----------

/** Formulaire de création ou de modification d'un paiement programmé. */
export function ruleForm(ctx, pane, existing = null, template = null) {
  const base = existing ||
    template || { type: "expense", category: "loyer", note: "", frequency: "monthly", day: 5 };
  const start = existing?.start || templateStart(base);
  const auto = existing ? existing.auto !== false : false;
  const variable = existing?.variable ?? Boolean(base.variable);
  pane.innerHTML = `
    <form class="form" novalidate>
      ${existing ? "" : `<div class="templates" aria-label="Modèles">
        ${BILL_TEMPLATES.map((tpl, i) => `<button type="button" class="tpl" data-tpl="${i}">${catIcon(tpl.category, "xs")}${esc(tpl.note)}</button>`).join("")}
      </div>`}
      ${segmented("type", [["expense", "Dépense"], ["income", "Revenu"]], base.type)}
      <label class="field"><span>Nom</span><input name="note" required maxlength="60" value="${esc(base.note)}" placeholder="ex. Loyer, Facture CIE, Salaire"></label>
      ${amountField(base.amount, variable ? "Montant estimé" : "Montant")}
      <div class="cat-slot">${categoryPicker(base.type, base.category)}</div>
      <div class="row-2">
        <label class="field"><span>Fréquence</span>
          <select name="frequency">${Object.entries(FREQUENCIES).map(([k, f]) => `<option value="${k}" ${k === base.frequency ? "selected" : ""}>${f.label}</option>`).join("")}</select>
        </label>
        <label class="field"><span>${existing ? "Première échéance" : "Prochaine échéance"}</span><input name="start" type="date" value="${start}" required></label>
      </div>
      <label class="field"><span>Fin <small>(facultatif)</small></span><input name="end" type="date" value="${existing?.end || ""}"></label>
      <div class="toggles">
        <div class="toggle-row"><div><b>Montant variable</b><small>Ex. CIE, SODECI : vous confirmez le montant à chaque facture</small></div>${toggle("variable", variable, "Montant variable")}</div>
        <div class="toggle-row"><div><b>Enregistrer automatiquement</b><small>Sinon, un rappel vous demande de confirmer le paiement</small></div>${toggle("auto", auto, "Enregistrer automatiquement")}</div>
        <label class="toggle-row"><div><b>Me rappeler</b><small>Avant chaque échéance</small></div>
          <select name="remindDays" class="mini-select">${[0, 1, 2, 3, 5, 7].map((d) => `<option value="${d}" ${d === (existing?.remindDays ?? 2) ? "selected" : ""}>${d === 0 ? "Le jour même" : `${d} jour${d > 1 ? "s" : ""} avant`}</option>`).join("")}</select>
        </label>
      </div>
      <button class="btn primary block">${existing ? "Enregistrer" : "Programmer"}</button>
    </form>`;

  const form = $("form", pane);
  liveAmount(form.amount);
  const syncAuto = () => {
    if (form.variable.checked) form.auto.checked = false;
    form.auto.disabled = form.variable.checked;
  };
  form.variable.addEventListener("change", syncAuto);
  syncAuto();
  $$("[name=type]", form).forEach((r) =>
    r.addEventListener("change", () => {
      $(".cat-slot", form).innerHTML = categoryPicker(r.value, r.value === "income" ? "salaire" : "loyer");
    }),
  );
  $$("[data-tpl]", form).forEach((b) => b.addEventListener("click", () => ruleForm(ctx, pane, null, BILL_TEMPLATES[b.dataset.tpl])));

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const amount = readAmount(form.amount.value);
    if (!(amount > 0)) return shakeField(form.amount, "Indiquez un montant");
    if (!form.note.value.trim()) return shakeField(form.note, "Donnez un nom");
    const end = form.end.value || null;
    if (end && end < form.start.value) return shakeField(form.end, "La fin précède la première échéance");
    const data = {
      type: radio(form, "type"),
      amount,
      category: radio(form, "category") || base.category,
      note: form.note.value.trim(),
      frequency: form.frequency.value,
      start: form.start.value,
      end,
      variable: form.variable.checked,
      auto: form.auto.checked && !form.variable.checked,
      remindDays: Number(form.remindDays.value),
    };
    if (existing) {
      const restart = data.start !== existing.start || data.frequency !== existing.frequency;
      Object.assign(existing, data);
      // Nouveau calendrier : on ne rattrape pas les échéances passées.
      if (restart) existing.lastRun = lastPast(existing);
      act.applyRecurring(ctx.state, today());
      ctx.commit();
      closeSheet();
      return toast("Paiement modifié");
    }
    const rule = { id: uid(), lastRun: null, paused: false, created: today(), ...data };
    const past = calc.occurrencesBetween(rule, null, calc.addDays(today(), -1));
    if (past.length && data.auto) {
      if (!confirm(`${past.length} échéance(s) sont déjà passées depuis le ${fmtDate(rule.start)}. Les ajouter à l'historique ?`)) rule.lastRun = past.at(-1);
    } else if (past.length) {
      // Paiements à confirmer : on considère les échéances passées comme réglées.
      rule.lastRun = past.at(-1);
    }
    ctx.state.recurring.push(rule);
    const created = act.applyRecurring(ctx.state, today());
    ctx.commit();
    closeSheet();
    toast(created ? `Programmé — ${created} transaction(s) ajoutée(s)` : "Paiement programmé");
  });
}

function lastPast(rule) {
  return calc.occurrencesBetween(rule, null, calc.addDays(today(), -1)).at(-1) || null;
}

/** Prochaine date correspondant au jour du modèle (31 = fin du mois). */
function templateStart(tpl) {
  const now = new Date();
  const day = tpl.day || now.getDate();
  const candidate = (y, m) => isoDate(new Date(y, m, Math.min(day, new Date(y, m + 1, 0).getDate())));
  const thisMonth = candidate(now.getFullYear(), now.getMonth());
  return thisMonth >= today() ? thisMonth : candidate(now.getFullYear(), now.getMonth() + 1);
}

export function openRuleSheet(ctx, existing = null) {
  openSheet(existing ? "Modifier le paiement" : "Programmer un paiement", `<div class="add-pane"></div>`, (root) => ruleForm(ctx, $(".add-pane", root), existing));
}

/** Confirmer (ou passer) une échéance d'un paiement programmé. */
export function openPaySheet(ctx, rule, occurrence = act.occurrenceToPay(rule, today())) {
  if (!occurrence) return toast("Ce paiement est terminé");
  const isIncome = rule.type === "income";
  openSheet(
    isIncome ? "Confirmer la rentrée" : "Confirmer le paiement",
    `<div class="pay-head">${catIcon(rule.category, "lg")}<div><b>${esc(rule.note)}</b><small>Échéance du ${fmtDate(occurrence)}</small></div></div>
     <form class="form" novalidate>
       ${amountField(rule.amount, rule.variable ? "Montant de la facture" : "Montant")}
       <label class="field"><span>${isIncome ? "Reçu le" : "Payé le"}</span><input name="date" type="date" value="${today()}"></label>
       ${methodPicker()}
       <div class="form-actions">
         <button type="button" class="btn ghost" data-skip>Passer cette échéance</button>
         <button class="btn primary">${isIncome ? "Confirmer" : "Payer"}</button>
       </div>
     </form>`,
    (root) => {
      const form = $("form", root);
      liveAmount(form.amount);
      form.addEventListener("submit", (e) => {
        e.preventDefault();
        const amount = readAmount(form.amount.value);
        if (!(amount > 0)) return shakeField(form.amount, "Indiquez un montant");
        act.payRule(ctx.state, rule, { amount, date: form.date.value || today(), occurrence });
        const last = ctx.state.transactions.at(-1);
        last.method = radio(form, "method") || "";
        ctx.commit();
        closeSheet();
        toast(isIncome ? "Rentrée enregistrée" : "Paiement enregistré");
      });
      $("[data-skip]", root).addEventListener("click", () => {
        act.skipOccurrence(rule, occurrence);
        ctx.commit();
        closeSheet();
        toast("Échéance passée");
      });
    },
  );
}

// ---------- Objectifs d'épargne ----------

export function openGoalSheet(ctx, existing = null) {
  const g = existing || { name: "", target: "", saved: 0, deadline: isoDate(new Date(new Date().getFullYear() + 1, new Date().getMonth(), new Date().getDate())), rate: 0, icon: "🎯" };
  const icons = ["🎯", "🆘", "🏠", "🏗️", "🎓", "🚗", "💍", "✈️", "🛵", "🏪", "👶", "📱"];
  openSheet(
    existing ? "Modifier l'objectif" : "Nouvel objectif",
    `<form class="form" novalidate>
      <fieldset class="chips emoji-chips"><legend>Icône</legend>
        ${icons.map((i) => `<label class="chip"><input type="radio" name="icon" value="${i}" ${i === g.icon ? "checked" : ""}><span>${i}</span></label>`).join("")}
      </fieldset>
      <label class="field"><span>Nom</span><input name="name" required maxlength="60" value="${esc(g.name)}" placeholder="ex. Fonds d'urgence, Terrain, Rentrée scolaire" autofocus></label>
      <div class="row-2">
        <label class="field"><span>Montant visé</span><input name="target" inputmode="numeric" value="${g.target ? num(g.target) : ""}" required></label>
        <label class="field"><span>Déjà épargné</span><input name="saved" inputmode="numeric" value="${num(g.saved)}"></label>
      </div>
      <div class="row-2">
        <label class="field"><span>Date limite</span><input name="deadline" type="date" value="${g.deadline}" required></label>
        <label class="field"><span>Rendement / an <small>(%)</small></span><input name="rate" type="number" min="0" max="30" step="0.1" value="${(g.rate || 0) * 100}"></label>
      </div>
      <p class="muted">Astuce : un fonds d'urgence de 3 à 6 mois de dépenses vous protège des imprévus (santé, perte d'activité…).</p>
      <button class="btn primary block">${existing ? "Enregistrer" : "Créer l'objectif"}</button>
    </form>`,
    (root) => {
      const form = $("form", root);
      liveAmount(form.target);
      liveAmount(form.saved);
      form.addEventListener("submit", (e) => {
        e.preventDefault();
        const target = readAmount(form.target.value);
        if (!form.name.value.trim()) return shakeField(form.name, "Donnez un nom");
        if (!(target > 0)) return shakeField(form.target, "Indiquez le montant visé");
        const data = {
          name: form.name.value.trim(),
          target,
          saved: readAmount(form.saved.value) || 0,
          deadline: form.deadline.value,
          rate: (Number(form.rate.value) || 0) / 100,
          icon: radio(form, "icon") || "🎯",
        };
        if (existing) Object.assign(existing, data);
        else ctx.state.goals.push({ id: uid(), created: today(), ...data });
        ctx.commit();
        closeSheet();
        toast(existing ? "Objectif modifié" : "Objectif créé");
      });
    },
  );
}

export function openGoalMoveSheet(ctx, goal, direction = 1) {
  openSheet(
    direction > 0 ? `Épargner pour « ${goal.name} »` : `Retirer de « ${goal.name} »`,
    `<form class="form" novalidate>
      ${amountField()}
      <label class="field"><span>Date</span><input name="date" type="date" value="${today()}"></label>
      <div class="toggle-row"><div><b>Compter dans mes transactions</b><small>${direction > 0 ? "Comme une dépense « Épargne »" : "Comme un revenu"}</small></div>${toggle("record", true, "Compter dans mes transactions")}</div>
      <button class="btn primary block">${direction > 0 ? "Verser" : "Retirer"}</button>
    </form>`,
    (root) => {
      const form = $("form", root);
      liveAmount(form.amount);
      form.addEventListener("submit", (e) => {
        e.preventDefault();
        const amount = readAmount(form.amount.value);
        if (!(amount > 0)) return shakeField(form.amount, "Indiquez un montant");
        act.moveToGoal(ctx.state, goal, direction * amount, form.date.value || today(), form.record.checked);
        ctx.commit();
        closeSheet();
        toast(direction > 0 ? (goal.saved >= goal.target ? "Objectif atteint, bravo ! 🎉" : "Versement enregistré") : "Retrait enregistré");
      });
    },
  );
}

// ---------- Tontine ----------

export function openTontineSheet(ctx, existing = null) {
  const t = existing || { name: "", amount: "", frequency: "monthly", start: today(), members: [], myIndex: 0 };
  const names = existing ? t.members.map((m, i) => (i === t.myIndex ? "Moi" : m)) : ["Moi"];
  openSheet(
    existing ? "Modifier la tontine" : "Nouvelle tontine",
    `<form class="form" novalidate>
      <label class="field"><span>Nom</span><input name="name" required maxlength="40" value="${esc(t.name)}" placeholder="ex. Tontine du bureau" autofocus></label>
      <div class="row-2">
        <label class="field"><span>Cotisation par tour</span><input name="amount" inputmode="numeric" value="${t.amount ? num(t.amount) : ""}" required></label>
        <label class="field"><span>Fréquence</span>
          <select name="frequency">${["weekly", "monthly"].map((k) => `<option value="${k}" ${k === t.frequency ? "selected" : ""}>${FREQUENCIES[k].label}</option>`).join("")}</select>
        </label>
      </div>
      <label class="field"><span>Date du 1er tour</span><input name="start" type="date" value="${t.start}" required></label>
      <label class="field"><span>Membres, dans l'ordre de passage <small>(un par ligne, « Moi » pour vous)</small></span>
        <textarea name="members" rows="6" placeholder="Awa&#10;Moi&#10;Koffi&#10;Adjoua">${esc(names.join("\n"))}</textarea>
      </label>
      <p class="muted">Chacun cotise à chaque tour ; le bénéficiaire du tour reçoit la cagnotte (cotisation × nombre de membres).</p>
      <button class="btn primary block">${existing ? "Enregistrer" : "Créer la tontine"}</button>
    </form>`,
    (root) => {
      const form = $("form", root);
      liveAmount(form.amount);
      form.addEventListener("submit", (e) => {
        e.preventDefault();
        const amount = readAmount(form.amount.value);
        const members = form.members.value.split("\n").map((s) => s.trim()).filter(Boolean);
        const myIndex = members.findIndex((m) => m.toLowerCase() === "moi");
        if (!form.name.value.trim()) return shakeField(form.name, "Donnez un nom");
        if (!(amount > 0)) return shakeField(form.amount, "Indiquez la cotisation");
        if (members.length < 2) return shakeField(form.members, "Ajoutez au moins 2 membres");
        if (myIndex < 0) return shakeField(form.members, "Écrivez « Moi » à votre place dans la liste");
        const data = { name: form.name.value.trim(), amount, frequency: form.frequency.value, start: form.start.value, members, myIndex };
        if (existing) {
          if (existing.members.length !== members.length && Object.keys(existing.paid || {}).length && !confirm("Le nombre de membres change : les cotisations cochées seront conservées par numéro de tour. Continuer ?")) return;
          Object.assign(existing, data);
        } else ctx.state.tontines.push({ id: uid(), paid: {}, received: false, ...data });
        ctx.commit();
        closeSheet();
        toast(existing ? "Tontine modifiée" : "Tontine créée");
      });
    },
  );
}

// ---------- Dettes et prêts ----------

export function openDebtSheet(ctx, existing = null) {
  const d = existing || { direction: "lent", person: "", amount: "", date: today(), due: "", note: "" };
  openSheet(
    existing ? "Modifier" : "Nouvelle dette ou prêt",
    `<form class="form" novalidate>
      ${segmented("direction", [["lent", "J'ai prêté"], ["borrowed", "J'ai emprunté"]], d.direction)}
      <label class="field"><span>Personne</span><input name="person" required maxlength="40" value="${esc(d.person)}" placeholder="ex. Tonton Yao" autofocus></label>
      ${amountField(d.amount)}
      <div class="row-2">
        <label class="field"><span>Date</span><input name="date" type="date" value="${d.date}"></label>
        <label class="field"><span>À rembourser avant <small>(facultatif)</small></span><input name="due" type="date" value="${d.due || ""}"></label>
      </div>
      <label class="field"><span>Note</span><input name="note" maxlength="80" value="${esc(d.note || "")}" placeholder="ex. Pour l'ordonnance"></label>
      ${existing ? "" : `<div class="toggle-row"><div><b>Compter dans mes transactions</b><small>L'argent sort (prêt) ou entre (emprunt) de votre total</small></div>${toggle("record", true, "Compter dans mes transactions")}</div>`}
      <button class="btn primary block">${existing ? "Enregistrer" : "Ajouter"}</button>
    </form>`,
    (root) => {
      const form = $("form", root);
      liveAmount(form.amount);
      form.addEventListener("submit", (e) => {
        e.preventDefault();
        const amount = readAmount(form.amount.value);
        if (!form.person.value.trim()) return shakeField(form.person, "Indiquez la personne");
        if (!(amount > 0)) return shakeField(form.amount, "Indiquez un montant");
        const data = { direction: radio(form, "direction"), person: form.person.value.trim(), amount, date: form.date.value || today(), due: form.due.value || null, note: form.note.value.trim() };
        if (existing) Object.assign(existing, data);
        else act.addDebt(ctx.state, data, form.record.checked);
        ctx.commit();
        closeSheet();
        toast(existing ? "Modifié" : "Ajouté");
      });
    },
  );
}

export function openRepaymentSheet(ctx, debt) {
  const remaining = calc.debtRemaining(debt);
  openSheet(
    debt.direction === "lent" ? `${debt.person} vous rembourse` : `Rembourser ${debt.person}`,
    `<form class="form" novalidate>
      ${amountField(remaining)}
      <p class="muted">Reste dû : ${money(remaining)}</p>
      <label class="field"><span>Date</span><input name="date" type="date" value="${today()}"></label>
      <div class="toggle-row"><div><b>Compter dans mes transactions</b></div>${toggle("record", true, "Compter dans mes transactions")}</div>
      <button class="btn primary block">Enregistrer le remboursement</button>
    </form>`,
    (root) => {
      const form = $("form", root);
      liveAmount(form.amount);
      form.addEventListener("submit", (e) => {
        e.preventDefault();
        const amount = readAmount(form.amount.value);
        if (!(amount > 0)) return shakeField(form.amount, "Indiquez un montant");
        act.addRepayment(ctx.state, debt, amount, form.date.value || today(), form.record.checked);
        ctx.commit();
        closeSheet();
        toast(calc.debtRemaining(debt) <= 0 ? "Entièrement remboursé ✅" : "Remboursement enregistré");
      });
    },
  );
}

