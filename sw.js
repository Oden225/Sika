// Service worker : l'application s'ouvre même sans connexion.
// Stratégie « réseau d'abord » : on sert toujours la dernière version en ligne,
// et la copie en cache seulement si le réseau est indisponible.

const CACHE = "sika-v10";
const SHELL = [
  "./",
  "index.html",
  "manifest.webmanifest",
  "css/style.css",
  "css/otp.css",
  "icons/icon.svg",
  "icons/icon-192.png",
  "js/app.js",
  "js/actions.js",
  "js/calc.js",
  "js/cloud.js",
  "js/config.js",
  "js/data.js",
  "js/install.js",
  "js/otp.js",
  "js/sheets.js",
  "js/store.js",
  "js/theme.js",
  "js/ui.js",
  "js/screens/account.js",
  "js/screens/analytics.js",
  "js/screens/bills.js",
  "js/screens/calendar.js",
  "js/screens/community.js",
  "js/screens/home.js",
  "js/screens/more.js",
  "js/screens/savings.js",
  "js/screens/welcome.js",
];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (e) => {
  const { request } = e;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  // Les appels au compte en ligne (Supabase) ne passent jamais par le cache.
  if (url.hostname.endsWith("supabase.co")) return;
  const cacheable = url.origin === location.origin || /fonts\.(googleapis|gstatic)\.com|cdn\.jsdelivr\.net/.test(url.hostname);
  if (!cacheable) return;
  e.respondWith(
    fetch(request)
      .then((res) => {
        if (res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(request, copy));
        }
        return res;
      })
      // Hors connexion : la copie en cache ; la page d'accueil seulement pour une
      // ouverture de page (jamais à la place d'un script ou d'une feuille de style).
      .catch(() =>
        caches.match(request, { ignoreSearch: true }).then((r) => r || (request.mode === "navigate" ? caches.match("index.html") : Response.error())),
      ),
  );
});

self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  e.waitUntil(
    self.clients.matchAll({ type: "window" }).then((list) => {
      const client = list.find((c) => "focus" in c);
      return client ? client.focus() : self.clients.openWindow("./#/rappels");
    }),
  );
});
