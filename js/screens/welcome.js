// Premier lancement : créer un compte ou se connecter, et enregistrer le nom.
//
// Étapes (ctx.ui.ob.step) :
//   choice → names → email → code → fin            (créer un compte)
//   choice → email → code → [names si absent] → fin (j'ai déjà un compte)
//   choice → names → fin                            (continuer sans compte)

import { esc, icon, toast, setLoading, $ } from "../ui.js";
import { mountOtp } from "./account.js";

const COIN = `
  <svg class="welcome-coin" viewBox="0 0 120 120" aria-hidden="true">
    <defs><radialGradient id="wcoin" cx="35%" cy="30%" r="75%"><stop offset="0" stop-color="#fff2b8"/><stop offset=".45" stop-color="#f9c74f"/><stop offset="1" stop-color="#c47f12"/></radialGradient></defs>
    <circle cx="60" cy="60" r="56" fill="url(#wcoin)"/>
    <circle cx="60" cy="60" r="45" fill="none" stroke="#9a5b07" stroke-opacity=".35" stroke-width="3"/>
    <path d="M73 46c-2.6-6.4-8.7-10-15.6-10-9.4 0-15.7 5.5-15.7 12.9 0 16.5 32.8 9.4 32.8 26.6 0 7.9-6.9 14-17 14-8.2 0-14.8-4.1-17.6-11.8" fill="none" stroke="#7c2d12" stroke-width="8" stroke-linecap="round"/>
  </svg>`;

/** Faut-il afficher l'accueil ? Jamais si l'on est connecté ou si l'on a déjà des données. */
export function needsOnboarding(state, cloud, hasData, hasStoredSession) {
  return !state.settings.onboarded && !cloud.user && !hasStoredSession() && !hasData(state);
}

function ob(ctx) {
  ctx.ui.ob ||= { step: "choice", mode: null, first: "", last: "", email: "" };
  return ctx.ui.ob;
}

export function welcome(ctx) {
  const o = ob(ctx);
  const cloudOn = ctx.cloud.configured;
  const titles = {
    choice: ["Bienvenue sur Sika", "Sika veut dire « argent ». Suivez vos dépenses, vos factures, vos tontines et planifiez votre épargne."],
    names: [o.mode === "login" ? "Comment vous appelez-vous ?" : "Faisons connaissance", "Votre nom reste privé : il sert à personnaliser l'application."],
    email: [o.mode === "login" ? "Content de vous revoir" : "Votre adresse e-mail", o.mode === "login" ? "Entrez l'e-mail de votre compte : nous vous envoyons un code." : "Elle sert à vous connecter avec un code, sans mot de passe, et à retrouver vos données sur tous vos appareils."],
    code: ["Vérification", ""],
  };
  const [title, sub] = titles[o.step];
  const back = o.step !== "choice" ? `<button class="welcome-back" data-back aria-label="Retour">${icon("back")}</button>` : "";

  let body = "";
  if (o.step === "choice") {
    body = `
      <div class="welcome-actions">
        ${cloudOn ? `<button class="btn primary block" data-create>${icon("plus")} Créer un compte</button>
        <button class="btn ghost block" data-login>J'ai déjà un compte</button>` : `<button class="btn primary block" data-local>Commencer</button>`}
      </div>
      ${cloudOn ? `<button class="link-muted" data-local>Continuer sans compte</button>` : ""}`;
  } else if (o.step === "names") {
    body = `
      <form class="form" data-names novalidate>
        <label class="field"><span>Prénom</span><input name="first" autocomplete="given-name" maxlength="30" required value="${esc(o.first)}" placeholder="ex. Aya" autofocus></label>
        <label class="field"><span>Nom</span><input name="last" autocomplete="family-name" maxlength="40" value="${esc(o.last)}" placeholder="ex. Koné"></label>
        <button class="btn primary block">${o.mode === "create" ? "Continuer" : "C'est parti"}</button>
      </form>`;
  } else if (o.step === "email") {
    body = `
      <form class="form" data-email novalidate>
        <label class="field"><span>Adresse e-mail</span><input name="email" type="email" inputmode="email" autocomplete="email" required value="${esc(o.email)}" placeholder="vous@exemple.com" autofocus></label>
        <button class="btn primary block">Recevoir le code</button>
      </form>
      ${o.mode === "login" ? `<button class="link-muted" data-switch-create>Pas encore de compte ? Créer un compte</button>` : `<button class="link-muted" data-switch-login>Déjà un compte ? Se connecter</button>`}`;
  } else {
    body = `<div class="otp-slot"></div>`;
  }

  return {
    html: `
    <section class="welcome">
      <header class="welcome-wave">
        ${back}
        <div class="welcome-brand">${COIN}<p class="welcome-word">SIKA</p></div>
        <p class="welcome-tag">Votre argent, bien géré</p>
      </header>
      <div class="welcome-card glass">
        <h1>${esc(title)}</h1>
        ${sub ? `<p class="muted">${esc(sub)}</p>` : ""}
        ${o.mode === "create" && o.step !== "choice" ? steps(o.step) : ""}
        ${body}
      </div>
    </section>`,
    bind(root) {
      const go = (patch) => {
        Object.assign(o, patch);
        ctx.render();
      };
      $("[data-back]", root)?.addEventListener("click", () => {
        const prev = { names: "choice", email: o.mode === "create" ? "names" : "choice", code: "email" }[o.step] || "choice";
        // Connexion réussie : on ne revient pas en arrière depuis le nom.
        if (o.step === "names" && o.mode === "login" && ctx.cloud.user) return;
        go({ step: prev });
      });
      $("[data-create]", root)?.addEventListener("click", () => go({ mode: "create", step: "names" }));
      $("[data-login]", root)?.addEventListener("click", () => go({ mode: "login", step: "email" }));
      root.querySelectorAll("[data-local]").forEach((b) => b.addEventListener("click", () => go({ mode: "local", step: "names" })));
      $("[data-switch-create]", root)?.addEventListener("click", () => go({ mode: "create", step: "names" }));
      $("[data-switch-login]", root)?.addEventListener("click", () => go({ mode: "login", step: "email" }));

      $("[data-names]", root)?.addEventListener("submit", (e) => {
        e.preventDefault();
        const first = e.target.first.value.trim();
        const last = e.target.last.value.trim();
        if (!first) {
          toast("Indiquez votre prénom");
          return e.target.first.focus();
        }
        Object.assign(o, { first, last });
        if (o.mode === "create") return go({ step: "email" });
        finish(ctx);
      });

      $("[data-email]", root)?.addEventListener("submit", async (e) => {
        e.preventDefault();
        const email = e.target.email.value.trim();
        if (!/^\S+@\S+\.\S+$/.test(email)) return toast("Adresse e-mail invalide");
        const btn = e.target.querySelector("button");
        setLoading(btn, true);
        try {
          await ctx.cloud.sendCode(email, { create: o.mode !== "login" });
          go({ email, step: "code" });
        } catch (err) {
          setLoading(btn, false);
          if (err.code === "no_account") {
            toast("Aucun compte avec cette adresse : créons-en un.");
            return go({ mode: "create", step: "names", email });
          }
          toast(/rate|limit/i.test(err.message) ? "Trop de demandes : patientez une minute." : "Envoi impossible. Vérifiez le réseau.");
        }
      });

      const slot = $(".otp-slot", root);
      if (slot) {
        mountOtp(ctx, slot, o.email, {
          create: o.mode !== "login",
          onSuccess: () => {
            const s = ctx.state.settings;
            // Connexion à un compte existant sans nom enregistré : on le demande.
            if (o.mode === "login" && !s.firstName && !s.name) return go({ step: "names" });
            finish(ctx);
          },
          onChangeEmail: () => go({ step: "email" }),
        });
      }
    },
  };
}

function steps(step) {
  const order = ["names", "email", "code"];
  const i = order.indexOf(step);
  return `<div class="welcome-steps" aria-label="Étape ${i + 1} sur 3">${order.map((_, k) => `<i class="${k <= i ? "on" : ""}"></i>`).join("")}</div>`;
}

/** Fin de l'accueil : enregistre le nom (s'il a été saisi) et ouvre l'application. */
function finish(ctx) {
  const o = ob(ctx);
  const s = ctx.state.settings;
  if (o.first) {
    s.firstName = o.first;
    s.lastName = o.last;
    s.name = o.first;
    ctx.cloud.updateProfile(o.first, o.last);
  }
  s.onboarded = true;
  const name = s.firstName || s.name;
  ctx.ui.ob = null;
  ctx.commit();
  ctx.navigate("#/");
  toast(name ? `Bienvenue, ${name} !` : "Bienvenue !");
}
