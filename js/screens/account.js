import { esc, icon, toast, $ } from "../ui.js";
import { createOtpDeck } from "../otp.js";
import { OTP_LENGTH } from "../config.js";

const OTP_HTML = `
  <section class="auth" aria-labelledby="otpTitle">
    <div class="grab" aria-hidden="true"></div>
    <h1 class="otp-title" id="otpTitle">Entrez votre code</h1>
    <p class="otp-sub"></p>
    <div class="otp">
      <label class="sr" for="otpInput">Code de vérification</label>
      <input class="otp-input" id="otpInput" type="text" inputmode="numeric" autocomplete="one-time-code" pattern="[0-9]*" maxlength="${OTP_LENGTH}" spellcheck="false">
      <div class="otp-deck" aria-hidden="true"></div>
    </div>
    <div class="otp-foot"><span>Pas reçu ?</span><button type="button" class="otp-resend">Renvoyer</button></div>
    <div class="otp-done">
      <div class="lock"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg>Vérifié</div>
      <button type="button">Continuer</button>
    </div>
    <p class="sr" aria-live="polite"></p>
  </section>
  <button class="link-muted" data-change-email>Changer d'adresse e-mail</button>`;

export function account(ctx) {
  const { cloud } = ctx;
  const header = `
    <header class="top">
      <a class="icon-btn" href="#/plus" aria-label="Retour">${icon("back")}</a>
      <h1 class="top-title">Compte</h1>
      <span class="top-spacer"></span>
    </header>`;

  if (!cloud.configured) {
    return {
      html: `${header}
      <section class="glass card-pad account-intro">
        <div class="big-ico">${icon("cloud")}</div>
        <h2>Compte en ligne bientôt disponible</h2>
        <p class="muted">Le compte permettra de retrouver vos données sur tous vos appareils. Il n'est pas encore activé sur cette version de Sika : vos données sont enregistrées sur ce téléphone.</p>
        <p class="muted small">Pour l'administrateur : renseignez <code>js/config.js</code> avec les identifiants Supabase (voir README, « Compte en ligne »).</p>
        <a class="btn ghost block" href="#/reglages">${icon("download")} Exporter une sauvegarde</a>
      </section>`,
    };
  }

  if (cloud.user) {
    const statusText = {
      idle: "En attente",
      syncing: "Synchronisation…",
      ok: `Synchronisé${cloud.lastSync ? ` à ${cloud.lastSync.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}` : ""}`,
      offline: "Hors connexion : les modifications seront envoyées au retour du réseau",
      error: `Erreur : ${cloud.error || "synchronisation impossible"}`,
    }[cloud.status];
    return {
      html: `${header}
      <section class="glass card-pad account-intro">
        <div class="big-ico ok">${icon("check")}</div>
        <h2>Connecté</h2>
        <p><b>${esc(cloud.user.email)}</b></p>
        <p class="muted">${esc(statusText)}</p>
        <div class="btn-grid">
          <button class="btn primary" data-sync>${icon("refresh")} Synchroniser</button>
          <button class="btn ghost" data-logout>${icon("logout")} Se déconnecter</button>
        </div>
      </section>
      <p class="muted pad-x small">Vos données restent aussi sur ce téléphone pour fonctionner sans connexion. Elles sont envoyées sur votre compte à chaque modification.</p>`,
      bind(root) {
        $("[data-sync]", root).addEventListener("click", async () => {
          await cloud.syncNow();
          toast(cloud.status === "ok" ? "Synchronisé" : "Synchronisation impossible");
          ctx.render();
        });
        $("[data-logout]", root).addEventListener("click", async () => {
          if (!confirm("Se déconnecter ? Les données restent sur ce téléphone.")) return;
          await cloud.signOut();
          ctx.render();
          toast("Déconnecté");
        });
      },
    };
  }

  return {
    html: `${header}
    <section class="glass card-pad account-intro" data-step-email>
      <div class="big-ico">${icon("cloud")}</div>
      <h2>Retrouvez vos données partout</h2>
      <p class="muted">Connectez-vous avec votre e-mail : nous vous envoyons un code à ${OTP_LENGTH} chiffres. Pas de mot de passe à retenir.</p>
      <form class="form" data-email-form novalidate>
        <label class="field"><span>Adresse e-mail</span><input name="email" type="email" inputmode="email" autocomplete="email" required placeholder="vous@exemple.com" value="${esc(ctx.ui.pendingEmail || "")}"></label>
        <button class="btn primary block">Recevoir le code</button>
      </form>
    </section>
    <div class="otp-slot" hidden></div>`,
    bind(root) {
      const form = $("[data-email-form]", root);
      const slot = $(".otp-slot", root);
      const showOtp = (email) => {
        $("[data-step-email]", root).hidden = true;
        slot.hidden = false;
        slot.innerHTML = OTP_HTML;
        ctx.ui.holdRender = true;
        const masked = email.replace(/^(.{2}).*(@.*)$/, "$1•••$2");
        const otp = createOtpDeck(slot.querySelector(".auth"), {
          length: OTP_LENGTH,
          texts: { sub: (n) => `Code à ${n} chiffres envoyé à <b>${esc(masked)}</b>. Regardez aussi vos spams.` },
          verify: (code) => cloud.verify(email, code),
          onResend: () => cloud.sendCode(email).catch(() => toast("Envoi impossible, réessayez")),
          onSuccess: () => {
            ctx.ui.pendingEmail = "";
            ctx.ui.holdRender = false;
            ctx.navigate("#/plus");
            toast("Bienvenue ! Vos données sont synchronisées.");
          },
        });
        otp.focus();
        $("[data-change-email]", slot).addEventListener("click", () => {
          ctx.ui.holdRender = false;
          slot.hidden = true;
          $("[data-step-email]", root).hidden = false;
          form.email.focus();
        });
      };
      form.addEventListener("submit", async (e) => {
        e.preventDefault();
        const email = form.email.value.trim();
        if (!/^\S+@\S+\.\S+$/.test(email)) return toast("Adresse e-mail invalide");
        const btn = form.querySelector("button");
        btn.disabled = true;
        btn.textContent = "Envoi…";
        try {
          await cloud.sendCode(email);
          ctx.ui.pendingEmail = email;
          showOtp(email);
        } catch (err) {
          toast(/rate|limit/i.test(err.message) ? "Trop de demandes : patientez une minute." : "Envoi impossible. Vérifiez le réseau.");
          btn.disabled = false;
          btn.textContent = "Recevoir le code";
        }
      });
    },
  };
}
