// Installation de l'application sur l'écran d'accueil (PWA).
//
// Android / Chrome : le navigateur envoie « beforeinstallprompt », que l'on garde
// pour lancer l'installation en un geste (capturé tôt dans index.html).
// iPhone : pas d'installation automatique, on affiche les étapes Safari.
// Navigateurs intégrés (Gmail, WhatsApp, TikTok…) : installation impossible,
// on explique comment ouvrir la page dans le vrai navigateur.

import { icon, openSheet, closeSheet, toast, $ } from "./ui.js";

let deferred = window.__sikaInstall || null;
let onChange = () => {};

const ua = navigator.userAgent;
const isIOS = /iphone|ipad|ipod/i.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
const isAndroid = /android/i.test(ua);
// Navigateurs intégrés courants (réseaux sociaux, messageries, WebView Android).
const isInApp = /FBAN|FBAV|Instagram|Line\/|TikTok|musical_ly|Bytedance|Snapchat|WhatsApp|; wv\)/i.test(ua);
const isIOSOtherBrowser = isIOS && /CriOS|FxiOS|EdgiOS|OPiOS/i.test(ua);

export function initInstall(change) {
  onChange = change;
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferred = e;
    onChange();
  });
  window.addEventListener("appinstalled", () => {
    deferred = null;
    toast("Sika est installée sur votre téléphone 🎉");
    onChange();
  });
}

export function isStandalone() {
  return matchMedia("(display-mode: standalone)").matches || navigator.standalone === true;
}

/** Situation actuelle : déjà installée, installation directe possible, ou étapes à suivre. */
export function installState() {
  if (isStandalone()) return "installed";
  if (deferred) return "prompt";
  if (isInApp) return "inapp";
  if (isIOS) return isIOSOtherBrowser ? "ios-other" : "ios-safari";
  if (isAndroid) return "android-manual";
  return "desktop";
}

/** Le bandeau de l'accueil est-il à proposer ? (pas déjà installée, pas masqué récemment) */
export function shouldOfferInstall() {
  const state = installState();
  if (state === "installed" || state === "desktop") return false;
  try {
    const until = Number(localStorage.getItem("sika:install-later") || 0);
    if (Date.now() < until) return false;
  } catch {}
  return true;
}

export function dismissInstall(days = 14) {
  try {
    localStorage.setItem("sika:install-later", String(Date.now() + days * 864e5));
  } catch {}
}

const appUrl = () => location.origin + location.pathname;

const step = (n, html) => `<li><span class="step-n">${n}</span><span>${html}</span></li>`;
const SHARE_ICON = `<svg class="ico inline" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-label="Partager"><path d="M12 15V3M8 7l4-4 4 4"/><path d="M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7"/></svg>`;
const DOTS = `<b class="kbd">⋮</b>`;

function sheetContent(state) {
  const copy = `<button class="btn ghost block" data-copy>${icon("list")} Copier le lien de Sika</button>`;
  switch (state) {
    case "installed":
      return `<p class="install-lead">✅ Sika est déjà installée : vous l'utilisez depuis votre écran d'accueil.</p>`;
    case "prompt":
      return `
        <p class="install-lead">Ajoutez Sika à votre écran d'accueil : elle s'ouvre en plein écran, comme une vraie application, et fonctionne même sans connexion.</p>
        <button class="btn primary block" data-install>${icon("download")} Installer Sika</button>`;
    case "ios-safari":
      return `
        <p class="install-lead">Sur iPhone, l'installation se fait depuis Safari, en 3 gestes :</p>
        <ol class="install-steps">
          ${step(1, `Touchez le bouton <b>Partager</b> ${SHARE_ICON} en bas de l'écran.`)}
          ${step(2, `Faites défiler et choisissez <b>« Sur l'écran d'accueil »</b>.`)}
          ${step(3, `Touchez <b>Ajouter</b> : l'icône Sika apparaît sur votre écran d'accueil.`)}
        </ol>`;
    case "ios-other":
      return `
        <p class="install-lead">Sur iPhone, seule <b>Safari</b> permet d'installer Sika.</p>
        <ol class="install-steps">
          ${step(1, `Copiez le lien ci-dessous.`)}
          ${step(2, `Ouvrez <b>Safari</b> et collez le lien dans la barre d'adresse.`)}
          ${step(3, `Touchez <b>Partager</b> ${SHARE_ICON} puis <b>« Sur l'écran d'accueil »</b>.`)}
        </ol>${copy}`;
    case "inapp":
      return `
        <p class="install-lead">Vous avez ouvert Sika <b>à l'intérieur d'une autre application</b> (Gmail, WhatsApp, TikTok…). L'installation n'y est pas possible.</p>
        <ol class="install-steps">
          ${step(1, `Touchez ${DOTS} (ou ⋯) en haut à droite, puis <b>« Ouvrir dans Chrome »</b> (ou « Ouvrir dans le navigateur »).`)}
          ${step(2, `Dans Chrome, revenez ici : Plus → <b>Installer l'application</b>.`)}
        </ol>
        <p class="muted">Sinon, copiez le lien et collez-le dans Chrome :</p>${copy}`;
    case "android-manual":
      return `
        <p class="install-lead">Pour installer Sika depuis <b>Chrome</b> :</p>
        <ol class="install-steps">
          ${step(1, `Touchez ${DOTS} en haut à droite.`)}
          ${step(2, `Choisissez <b>« Installer l'application »</b> ou <b>« Ajouter à l'écran d'accueil »</b>.`)}
          ${step(3, `Confirmez avec <b>Installer</b>.`)}
        </ol>
        <p class="muted">Vous ne voyez pas ce choix ? Vous êtes peut-être dans le navigateur d'une autre application : touchez ${DOTS} puis « Ouvrir dans Chrome », ou copiez le lien :</p>${copy}`;
    default:
      return `
        <p class="install-lead">Sur ordinateur (Chrome ou Edge), cliquez sur l'icône d'installation à droite de la barre d'adresse. Pour votre téléphone, ouvrez ce lien :</p>${copy}`;
  }
}

export function openInstallSheet() {
  const state = installState();
  openSheet("Installer l'application", `<div class="install-sheet">
      <div class="install-hero"><img src="icons/icon-192.png" alt="" width="64" height="64"><div><b>Sika</b><small>Votre argent, bien géré</small></div></div>
      ${sheetContent(state)}
    </div>`, (root) => {
    $("[data-install]", root)?.addEventListener("click", async () => {
      if (!deferred) return toast("Installation indisponible, utilisez le menu ⋮ de Chrome");
      deferred.prompt();
      const { outcome } = await deferred.userChoice;
      deferred = null;
      closeSheet();
      onChange();
      if (outcome !== "accepted") toast("Installation annulée");
    });
    $("[data-copy]", root)?.addEventListener("click", async () => {
      try {
        await navigator.clipboard.writeText(appUrl());
        toast("Lien copié : collez-le dans votre navigateur");
      } catch {
        prompt("Copiez ce lien :", appUrl());
      }
    });
  });
}
