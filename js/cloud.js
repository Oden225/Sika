// Compte en ligne et synchronisation (Supabase).
//
// Principe : les données restent d'abord sur le téléphone (l'application marche
// hors connexion). Une fois connecté, tout l'état est copié dans une ligne de la
// table `sika_state`. À chaque modification, la copie en ligne est mise à jour
// (après 1,5 s) ; à l'ouverture, la version la plus récente l'emporte.

import { SUPABASE_URL, SUPABASE_ANON_KEY } from "./config.js";
import { onSave, normalize, hasData } from "./store.js";

const SDK = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/+esm";
const LINK_KEY = "sika:linked";

let sb = null;
let hooks = { getState: () => null, applyRemote: () => {}, onChange: () => {} };
let pushTimer = null;
let pending = false;
let busy = null;

export const cloud = {
  configured: Boolean(SUPABASE_URL && SUPABASE_ANON_KEY),
  user: null,
  status: "idle", // idle | syncing | ok | offline | error
  lastSync: null,
  error: null,
  sendCode,
  verify,
  signOut,
  pull,
  syncNow: () => pull(),
};

async function client() {
  if (!cloud.configured) throw new Error("Compte en ligne non configuré");
  if (!sb) {
    const { createClient } = await import(SDK);
    sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { persistSession: true, autoRefreshToken: true } });
  }
  return sb;
}

function setStatus(status, error = null) {
  cloud.status = status;
  cloud.error = error;
  if (status === "ok") cloud.lastSync = new Date();
  hooks.onChange();
}

export async function initCloud(h) {
  hooks = h;
  onSave(schedulePush);
  window.addEventListener("online", () => pending && push());
  if (!cloud.configured) return;
  try {
    const c = await client();
    const { data } = await c.auth.getSession();
    cloud.user = data.session?.user ?? null;
    c.auth.onAuthStateChange((_event, session) => {
      const was = cloud.user?.id;
      cloud.user = session?.user ?? null;
      if (cloud.user && cloud.user.id !== was) pull();
      hooks.onChange();
    });
    hooks.onChange();
    if (cloud.user) await pull();
  } catch (e) {
    setStatus(navigator.onLine ? "error" : "offline", e.message);
  }
}

// ---------- Connexion par code e-mail ----------

async function sendCode(email) {
  const c = await client();
  const { error } = await c.auth.signInWithOtp({ email, options: { shouldCreateUser: true } });
  if (error) throw error;
}

/** Vérifie le code reçu : true, false (mauvais code) ou un message d'erreur. */
async function verify(email, token) {
  try {
    const c = await client();
    const { data, error } = await c.auth.verifyOtp({ email, token, type: "email" });
    if (!error) {
      cloud.user = data.user;
      await pull();
      return true;
    }
    // Supabase renvoie le même message pour un code faux ou expiré.
    if (/expired|invalid/i.test(error.message)) return "Code incorrect ou expiré. Vérifiez-le ou demandez-en un nouveau.";
    if (/rate|limit/i.test(error.message)) return "Trop d'essais : patientez une minute.";
    if (/fetch|network/i.test(error.message)) return "Connexion impossible. Vérifiez le réseau puis réessayez.";
    return false;
  } catch {
    return "Connexion impossible. Vérifiez le réseau puis réessayez.";
  }
}

async function signOut() {
  const c = await client();
  await c.auth.signOut();
  cloud.user = null;
  try {
    localStorage.removeItem(LINK_KEY);
  } catch {}
  setStatus("idle");
}

// ---------- Synchronisation ----------

function schedulePush() {
  if (!cloud.user) return;
  pending = true;
  clearTimeout(pushTimer);
  pushTimer = setTimeout(push, 1500);
}

async function push() {
  if (!cloud.user) return;
  if (!navigator.onLine) return setStatus("offline");
  const state = hooks.getState();
  pending = false;
  setStatus("syncing");
  try {
    const c = await client();
    const { error } = await c
      .from("sika_state")
      .upsert({ user_id: cloud.user.id, data: state, updated_at: state.updatedAt || new Date().toISOString() });
    if (error) throw error;
    setStatus("ok");
  } catch (e) {
    pending = true;
    setStatus(navigator.onLine ? "error" : "offline", e.message);
  }
}

/** Récupère la copie en ligne et garde la version la plus récente. */
async function pull() {
  if (!cloud.user || !cloud.configured) return;
  if (busy) return busy;
  busy = (async () => {
    if (!navigator.onLine) return setStatus("offline");
    setStatus("syncing");
    try {
      const c = await client();
      const { data: row, error } = await c.from("sika_state").select("data, updated_at").eq("user_id", cloud.user.id).maybeSingle();
      if (error) throw error;
      const local = hooks.getState();
      let linked = null;
      try {
        linked = localStorage.getItem(LINK_KEY);
      } catch {}

      if (!row) {
        await push();
      } else {
        const remote = normalize(row.data);
        const localTime = local.updatedAt || "";
        const remoteTime = remote.updatedAt || row.updated_at || "";
        if (linked !== cloud.user.id && hasData(local) && hasData(remote) && localTime !== remoteTime) {
          // Premier lien de ce téléphone avec un compte qui a déjà des données.
          const useRemote = confirm(
            `Votre compte contient déjà des données (${remote.transactions.length} transactions).\n\n` +
              `OK : utiliser les données du compte sur ce téléphone.\n` +
              `Annuler : garder celles de ce téléphone (${local.transactions.length} transactions) et remplacer celles du compte.`,
          );
          if (useRemote) hooks.applyRemote(remote);
          else await push();
        } else if (remoteTime > localTime || (!hasData(local) && hasData(remote))) {
          hooks.applyRemote(remote);
        } else if (localTime > remoteTime) {
          await push();
        }
        if (cloud.status === "syncing") setStatus("ok");
      }
      try {
        localStorage.setItem(LINK_KEY, cloud.user.id);
      } catch {}
    } catch (e) {
      setStatus(navigator.onLine ? "error" : "offline", e.message);
    }
  })();
  try {
    await busy;
  } finally {
    busy = null;
  }
}
