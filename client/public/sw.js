/* Pediatric Clinic Queue — Web Push Service Worker
 * Handles background/closed-browser delivery via the Push API.
 * Must live at the site root so its scope covers the whole app.
 */

self.addEventListener("install", (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

const DEFAULT_ICON = "/favicon.svg";
const DEFAULT_URL = "/parent/notifications";
const HIGH_PRIORITY_TYPES = new Set([
  "YOU_ARE_NEXT",
  "ALMOST_NEXT",
  "CHECK_IN_REQUESTED",
  "PENALIZED",
  "FORFEITED",
]);

function parsePushPayload(event) {
  const fallback = {
    title: "Pediatric Clinic",
    body: "You have a new clinic update.",
    url: DEFAULT_URL,
    icon: DEFAULT_ICON,
    tag: "clinic-notification",
    type: "INFO",
  };

  if (!event.data) return fallback;

  try {
    const data = event.data.json();
    const nested = data.notification || data.data || {};
    return {
      title: data.title || nested.title || fallback.title,
      body: data.body || nested.body || data.message || nested.message || fallback.body,
      url: data.url || nested.url || DEFAULT_URL,
      icon: data.icon || nested.icon || DEFAULT_ICON,
      tag: data.tag || nested.tag || data.type || nested.type || fallback.tag,
      type: data.type || nested.type || fallback.type,
      reservationId: data.reservationId || nested.reservationId || null,
    };
  } catch (_err) {
    try {
      const text = event.data.text();
      if (text) return { ...fallback, body: text };
    } catch (_textErr) {
      // Ignore malformed payloads and show the fallback notification.
    }
    return fallback;
  }
}

self.addEventListener("push", (event) => {
  event.waitUntil(handlePush(event));
});

async function handlePush(event) {
  const payload = parsePushPayload(event);

  const windowClients = await self.clients.matchAll({
    type: "window",
    includeUncontrolled: true,
  });
  const focusedClient = windowClients.find((client) => client.focused);

  if (focusedClient) {
    focusedClient.postMessage({ type: "PUSH_RECEIVED", payload });
  }

  // Chrome requires showNotification() for userVisibleOnly subscriptions,
  // including when the site tab is already open.
  await self.registration.showNotification(payload.title, {
    body: payload.body,
    icon: payload.icon,
    badge: DEFAULT_ICON,
    tag: String(payload.tag),
    renotify: true,
    data: {
      url: payload.url,
      type: payload.type,
      reservationId: payload.reservationId,
    },
    vibrate: [120, 80, 120],
    requireInteraction: HIGH_PRIORITY_TYPES.has(payload.type),
  });
}

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = event.notification?.data?.url || DEFAULT_URL;

  event.waitUntil(openOrFocusWindow(targetUrl));
});

async function openOrFocusWindow(targetUrl) {
  const origin = self.location.origin;
  const absoluteUrl = targetUrl.startsWith("http")
    ? targetUrl
    : new URL(targetUrl, origin).href;

  const windowClients = await self.clients.matchAll({
    type: "window",
    includeUncontrolled: true,
  });

  for (const client of windowClients) {
    if (client.url.startsWith(origin) && "focus" in client) {
      try {
        if ("navigate" in client) {
          await client.navigate(absoluteUrl);
        }
      } catch (_navErr) {
        // Navigate can fail on some browsers; focusing is still useful.
      }
      return client.focus();
    }
  }

  if (self.clients.openWindow) {
    return self.clients.openWindow(absoluteUrl);
  }
}

self.addEventListener("pushsubscriptionchange", (event) => {
  event.waitUntil(self.registration.pushManager.subscribe(event.oldSubscription?.options || { userVisibleOnly: true })
    .then((subscription) => {
      return Promise.all(
        self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
          clients.forEach((client) => {
            client.postMessage({
              type: "PUSH_SUBSCRIPTION_CHANGED",
              subscription: subscription ? subscription.toJSON() : null,
            });
          });
        })
      );
    })
    .catch((err) => {
      console.error("[sw.js] pushsubscriptionchange resubscribe failed:", err);
    }));
});
