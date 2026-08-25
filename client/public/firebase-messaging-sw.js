// public/firebase-messaging-sw.js
importScripts('https://www.gstatic.com/firebasejs/10.14.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.14.1/firebase-messaging-compat.js');

const urlParams = new URLSearchParams(self.location.search);
const firebaseConfigStr = urlParams.get('firebaseConfig');

if (firebaseConfigStr) {
  const firebaseConfig = JSON.parse(decodeURIComponent(firebaseConfigStr));
  firebase.initializeApp(firebaseConfig);
} else {
  console.error("[firebase-messaging-sw.js] Missing firebaseConfig query parameter.");
}

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  console.log('[firebase-messaging-sw.js] Received background message ', payload);
  const notificationTitle = payload.data?.title || 'Notification';
  const notificationOptions = {
    body: payload.data?.body || '',
    icon: '/favicon.svg'
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});
