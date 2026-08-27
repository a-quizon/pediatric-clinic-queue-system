/* Compatibility shim for browsers that still have firebase-messaging-sw.js registered.
 * New installs use /sw.js. This file implements the same Push API handlers.
 */

self.addEventListener("install", (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("push", (event) => {
  event.waitUntil((async () => {
    let payload = {
      title: "Pediatric Clinic",
      body: "You have a new clinic update.",
      url: "/parent/notifications",
    };
    try {
      if (event.data) payload = { ...payload, ...event.data.json() };
    } catch (_err) {
      try {
        if (event.data) payload.body = event.data.text();
      } catch (_textErr) {
        // keep fallback
      }
    }

    const windowClients = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    if (windowClients.some((client) => client.focused)) return;

    await self.registration.showNotification(payload.title || payload.data?.title || "Pediatric Clinic", {
      body: payload.body || payload.data?.body || "",
      icon: payload.icon || "/favicon.svg",
      tag: payload.tag || payload.type || "clinic-notification",
      data: { url: payload.url || "/parent/notifications" },
    });
  })());
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = event.notification?.data?.url || "/parent/notifications";
  event.waitUntil((async () => {
    const windowClients = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    for (const client of windowClients) {
      if (client.url.startsWith(self.location.origin) && "focus" in client) {
        return client.focus();
      }
    }
    return self.clients.openWindow(targetUrl);
  })());
});
