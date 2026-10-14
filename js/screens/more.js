import * as calc from "../calc.js";
import * as act from "../actions.js";
import { category, OPERATORS } from "../data.js";
import { normalize } from "../store.js";
import { esc, money, num, icon, catIcon, initialsIcon, fmtDate, fmtLong, dueBadge, today, toast, signed, toggle, $, $$ } from "../ui.js";
import { ACCENTS, applyTheme, themeOf } from "../theme.js";
import { openPaySheet, feesFor } from "../sheets.js";
import { bindTxRows, txRow, monthOptions } from "./home.js";

export function more(ctx) {
  const { state, cloud } = ctx;
  const st = state.settings;
  const name = [st.firstName || st.name, st.lastName].filter(Boolean).join(" ").trim();
  const { owedToMe, iOwe } = calc.debtTotals(state.debts);
  const item = (href, ico, color, title, sub) => `
    <a class="list-row glass menu" href="${href}"><span class="qi" style="--q:${color}">${icon(ico)}</span>
      <div class="lr-main"><b>${title}</b><small>${sub}</small></div>${icon("next", "chev")}</a>`;
  const account = cloud.user
    ? `Connecté · ${esc(cloud.user.email)}`
    : cloud.configured
      ? "Non connecté · données sur ce téléphone"
      : "Données sur ce téléphone";
  return {
    html: `
    <header class="top"><span class="top-spacer"></span><h1 class="top-title">Plus</h1><span class="top-spacer"></span></header>
    <a class="profile glass" href="#/compte">
      <span class="avatar lg">${esc((name || "S")[0].toUpperCase())}</span>
      <div class="lr-main"><b>${esc(name || "Mon profil")}</b><small>${icon("cloud", "xs")} ${account}</small></div>
      ${cloud.user ? `<span class="badge ${cloud.status === "error" ? "late" : "ok"}">${cloud.status === "error" ? "Erreur synchro" : "Synchronisé"}</span>` : icon("next", "chev")}
    </a>
    <section class="block"><div class="list">
      ${item("#/tontines", "users", "#f97316", "Tontines", `${state.tontines.length} tontine(s)`)}
      ${item("#/dettes", "swap", "#7c3aed", "Dettes & prêts", owedToMe || iOwe ? `On me doit ${money(owedToMe)} · je dois ${money(iOwe)}` : "Argent prêté ou emprunté")}
      ${item("#/paiements", "receipt", "#10b981", "Paiements programmés", "Salaire, loyer, CIE, SODECI, abonnements")}
      ${item("#/analyses", "chart", "#f59e0b", "Analyses", "Où part l'argent, règle 50/30/20")}
      ${item("#/budgets", "target", "#ef4444", "Budgets", "Plafonds par catégorie")}
      ${item("#/transactions", "list", "#0ea5e9", "Toutes les transactions", `${state.transactions.length} transaction(s)`)}
      ${item("#/simulateur", "piggy", "#14b8a6", "Simulateur d'épargne", "Intérêts composés")}
      ${item("#/reglages", "palette", "#ec4899", "Apparence", "Thème clair ou sombre, couleur, animation")}
      ${item("#/reglages", "settings", "#64748b", "Réglages", "Nom, frais Mobile Money, sauvegarde")}
    </div></section>
    <p class="muted center small">Sika · vos finances, simplement</p>`,
  };
}

export function transactions(ctx) {
  const { state } = ctx;
  const filter = ctx.ui.txFilter;
  const q = (ctx.ui.txSearch || "").toLowerCase();
  let list = filter === "all" ? state.transactions : calc.filterByMonth(state.transactions, filter);
  if (q) list = list.filter((t) => `${t.note} ${category(t.category).label}`.toLowerCase().includes(q));
  list = [...list].sort((a, b) => b.date.localeCompare(a.date));
  const days = [...new Set(list.map((t) => t.date))];
  const { income, expense } = calc.summarize(list);
  return {
    html: `
    <header class="top">
      <a class="icon-btn" href="#/" aria-label="Retour">${icon("back")}</a>
      <h1 class="top-title">Transactions</h1>
      <span class="top-spacer"></span>
    </header>
    <div class="filters">
      <label class="search glass">${icon("search")}<input type="search" data-search placeholder="Rechercher" value="${esc(ctx.ui.txSearch || "")}" aria-label="Rechercher"></label>
      <select class="glass-select" data-filter aria-label="Période"><option value="all" ${filter === "all" ? "selected" : ""}>Tout</option>${monthOptions(state, filter === "all" ? null : filter)}</select>
    </div>
    <div class="sum-line"><span class="pos">+${money(income)}</span><span class="neg">−${money(expense)}</span></div>
    ${days.length
      ? days.map((d) => `<div class="day-group"><h3>${fmtLong(d)}</h3><div class="list">${list.filter((t) => t.date === d).map(txRow).join("")}</div></div>`).join("")
      : `<div class="empty glass"><p>Aucune transaction.</p></div>`}`,
    bind(root) {
      $("[data-filter]", root).addEventListener("change", (e) => {
        ctx.ui.txFilter = e.target.value;
        ctx.render();
      });
      const search = $("[data-search]", root);
      search.addEventListener("input", () => {
        ctx.ui.txSearch = search.value;
        clearTimeout(ctx.ui.searchTimer);
        ctx.ui.searchTimer = setTimeout(() => {
          ctx.render();
          const s = document.querySelector("[data-search]");
          s?.focus();
          s?.setSelectionRange(s.value.length, s.value.length);
        }, 250);
      });
      bindTxRows(ctx, root);
    },
  };
}

export function reminders(ctx) {
  const { state } = ctx;
  const items = calc.reminders(state, today());
  const row = (r) => {
    const ico = r.kind === "bill" ? catIcon(state.recurring.find((x) => x.id === r.id)?.category) : r.kind === "tontine" ? catIcon("tontine") : initialsIcon(r.title);
    const action = r.kind === "bill" ? `<button class="pill" data-pay="${r.id}" data-date="${r.date}">${r.type === "income" ? "Confirmer" : "Payer"}</button>` : `<a class="pill" href="#/${r.kind === "debt" ? "dette" : "tontine"}/${r.id}">Voir</a>`;
    return `<div class="list-row glass">${ico}<div class="lr-main"><div class="lr-title"><b>${esc(r.title)}</b>${dueBadge(r.date)}</div><small>${fmtDate(r.date)} · ${money(r.amount)}</small></div>${action}</div>`;
  };
  const perm = "Notification" in window ? Notification.permission : "unsupported";
  return {
    html: `
    <header class="top">
      <a class="icon-btn" href="#/" aria-label="Retour">${icon("back")}</a>
      <h1 class="top-title">Rappels</h1>
      <span class="top-spacer"></span>
    </header>
    ${perm === "default" ? `<div class="alert glass soft"><span class="alert-ico">${icon("bell")}</span><div><b>Activer les notifications</b><small>Sika vous prévient à l'ouverture de l'application quand un paiement approche.</small></div><button class="pill" data-notif>Activer</button></div>` : ""}
    ${items.length ? `<div class="list">${items.map(row).join("")}</div>` : `<div class="empty glass"><p>🎉 Rien à payer pour le moment.</p></div>`}`,
    bind(root) {
      $$("[data-pay]", root).forEach((b) =>
        b.addEventListener("click", () => {
          const rule = state.recurring.find((r) => r.id === b.dataset.pay);
          if (rule) openPaySheet(ctx, rule, b.dataset.date);
        }),
      );
      $("[data-notif]", root)?.addEventListener("click", async () => {
        await Notification.requestPermission();
        ctx.render();
      });
    },
  };
}

export function settings(ctx) {
  const { state } = ctx;
  const s = state.settings;
  return {
    html: `
    <header class="top">
      <a class="icon-btn" href="#/plus" aria-label="Retour">${icon("back")}</a>
      <h1 class="top-title">Réglages</h1>
      <span class="top-spacer"></span>
    </header>
    ${appearance(themeOf(s))}
    <form class="glass card-pad form" data-profile>
      <h2>Profil</h2>
      <div class="row-2">
        <label class="field"><span>Prénom</span><input name="first" autocomplete="given-name" maxlength="30" value="${esc(s.firstName || s.name)}" placeholder="ex. Aya"></label>
        <label class="field"><span>Nom</span><input name="last" autocomplete="family-name" maxlength="40" value="${esc(s.lastName || "")}" placeholder="ex. Koné"></label>
      </div>
      <div class="row-2">
        <label class="field"><span>Devise</span><input name="currency" maxlength="6" value="${esc(s.currency)}"></label>
      </div>
      <button class="btn primary">Enregistrer</button>
    </form>

    <form class="glass card-pad form" data-fees>
      <h2>Frais Mobile Money</h2>
      <p class="muted">Valeurs indicatives (les grilles changent souvent) : ajustez-les selon votre opérateur. Le plafond 0 signifie « sans plafond ».</p>
      <div class="fee-table">
        <span></span><b>Envoi %</b><b>Plafond</b><b>Retrait %</b>
        ${Object.entries(OPERATORS)
          .map(([k, o]) => {
            const send = feesFor(state, k, "send");
            const wd = feesFor(state, k, "withdraw");
            return `<span class="op-name"><i style="background:${o.color}"></i>${esc(o.label)}</span>
              <input name="${k}.send.rate" type="number" min="0" max="10" step="0.1" value="${send.rate}" aria-label="${esc(o.label)} envoi %">
              <input name="${k}.send.cap" type="number" min="0" step="50" value="${send.cap}" aria-label="${esc(o.label)} plafond envoi">
              <input name="${k}.withdraw.rate" type="number" min="0" max="10" step="0.1" value="${wd.rate}" aria-label="${esc(o.label)} retrait %">`;
          })
          .join("")}
      </div>
      <div class="form-actions"><button type="button" class="btn ghost" data-reset-fees>Valeurs par défaut</button><button class="btn primary">Enregistrer</button></div>
    </form>

    <section class="glass card-pad">
      <h2>Sauvegarde</h2>
      <p class="muted">${ctx.cloud.user ? "Vos données sont synchronisées avec votre compte. Vous pouvez aussi garder une copie." : "Vos données sont sur ce téléphone. Exportez-les régulièrement, ou créez un compte pour les retrouver partout."}</p>
      <div class="btn-grid">
        <button class="btn ghost" data-export>${icon("download")} Exporter (JSON)</button>
        <button class="btn ghost" data-csv>${icon("download")} Transactions (CSV)</button>
        <label class="btn ghost">${icon("refresh")} Importer<input type="file" accept="application/json" data-import hidden></label>
        <button class="btn danger-soft" data-wipe>${icon("trash")} Tout effacer</button>
      </div>
    </section>`,
    bind(root) {
      bindAppearance(ctx, root);
      $("[data-profile]", root).addEventListener("submit", (e) => {
        e.preventDefault();
        s.firstName = e.target.first.value.trim();
        s.lastName = e.target.last.value.trim();
        s.name = s.firstName;
        ctx.cloud.updateProfile(s.firstName, s.lastName);
        s.currency = e.target.currency.value.trim() || "FCFA";
        ctx.commit();
        toast("Profil enregistré");
      });
      $("[data-fees]", root).addEventListener("submit", (e) => {
        e.preventDefault();
        const fees = {};
        for (const input of $$("input", e.target)) {
          const [op, kind, field] = input.name.split(".");
          fees[op] ||= {};
          fees[op][kind] ||= { rate: 0, cap: 0 };
          fees[op][kind][field] = Math.max(0, Number(input.value) || 0);
        }
        s.fees = fees;
        ctx.commit();
        toast("Frais enregistrés");
      });
      $("[data-reset-fees]", root).addEventListener("click", () => {
        s.fees = null;
        ctx.commit();
        toast("Frais par défaut rétablis");
      });
      $("[data-export]", root).addEventListener("click", () => download(`sika-sauvegarde-${today()}.json`, JSON.stringify(state, null, 2), "application/json"));
      $("[data-csv]", root).addEventListener("click", () => {
        const qv = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
        const rows = ["date;type;categorie;montant;note;moyen"];
        for (const t of [...state.transactions].sort((a, b) => a.date.localeCompare(b.date))) {
          rows.push([t.date, t.type === "income" ? "revenu" : "depense", qv(category(t.category).label), t.amount, qv(t.note), qv(t.method || "")].join(";"));
        }
        download(`sika-transactions-${today()}.csv`, "﻿" + rows.join("\n"), "text/csv");
      });
      $("[data-import]", root).addEventListener("change", async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        try {
          const data = normalize(JSON.parse(await file.text()));
          if (!confirm(`Remplacer vos données par ce fichier (${data.transactions.length} transactions, ${data.goals.length} objectifs) ?`)) return;
          ctx.replaceState(data);
          toast("Données importées");
        } catch {
          toast("Fichier invalide");
        } finally {
          e.target.value = "";
        }
      });
      $("[data-wipe]", root).addEventListener("click", () => {
        if (!confirm(`Effacer toutes vos données${ctx.cloud.user ? " (sur ce téléphone ET sur votre compte)" : ""} ? Cette action est irréversible.`)) return;
        ctx.replaceState(normalize({ settings: { name: s.name, firstName: s.firstName, lastName: s.lastName, currency: s.currency, theme: s.theme, onboarded: true } }));
        toast("Données effacées");
      });
    },
  };
}

function download(name, content, type) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = Object.assign(document.createElement("a"), { href: url, download: name });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}


// ---------- Apparence ----------

function appearance(t) {
  const mode = (v, ico, label) =>
    `<label class="theme-mode"><input type="radio" name="mode" value="${v}" ${t.mode === v ? "checked" : ""}><span>${icon(ico)}${label}</span></label>`;
  return `
    <section class="glass card-pad appearance" data-appearance>
      <h2>Apparence</h2>
      <h3>Mode</h3>
      <div class="theme-modes" role="radiogroup" aria-label="Mode d'affichage">
        ${mode("auto", "auto", "Automatique")}${mode("light", "sun", "Clair")}${mode("dark", "moon", "Sombre")}
      </div>
      <h3 style="margin-top:16px">Couleur</h3>
      <div class="swatches" role="radiogroup" aria-label="Couleur principale">
        ${ACCENTS.map((a) => `<label class="swatch" style="--sw:${a.color}"><input type="radio" name="accent" value="${a.id}" ${t.accent === a.id ? "checked" : ""}><b>${icon("check")}</b>${esc(a.label)}</label>`).join("")}
      </div>
      <div class="toggle-row" style="margin-top:16px"><div><b>Effet verre</b><small>Désactivez-le si l'application rame sur votre téléphone</small></div>${toggle("glass", t.glass !== "lite", "Effet verre")}</div>
      <div class="toggle-row"><div><b>Animation d'ouverture</b><small>La pièce Sika à chaque lancement</small></div>${toggle("splash", t.splash !== false, "Animation d'ouverture")}</div>
      <div class="btn-row"><button type="button" class="btn ghost" data-replay>${icon("play")} Revoir l'animation</button></div>
    </section>`;
}

function bindAppearance(ctx, root) {
  const box = $("[data-appearance]", root);
  const update = (patch) => {
    const t = { ...themeOf(ctx.state.settings), ...patch };
    ctx.state.settings.theme = t;
    applyTheme(t);
    ctx.commit();
  };
  box.addEventListener("change", (e) => {
    const { name, value, checked } = e.target;
    if (name === "mode" || name === "accent") update({ [name]: value });
    if (name === "glass") update({ glass: checked ? "full" : "lite" });
    if (name === "splash") update({ splash: checked });
  });
  $("[data-replay]", box).addEventListener("click", () => {
    try {
      sessionStorage.removeItem("sika:splash");
    } catch {}
    const t = themeOf(ctx.state.settings);
    if (t.splash === false) update({ splash: true });
    location.reload();
  });
}
