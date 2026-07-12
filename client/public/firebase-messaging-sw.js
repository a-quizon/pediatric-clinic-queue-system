// public/firebase-messaging-sw.js
importScripts('https://www.gstatic.com/firebasejs/10.14.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.14.1/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: "AIzaSyBdCJu_ratr-Eys-522wsb648eZoRd48-I",
  authDomain: "pediatric-clinic-queue-system.firebaseapp.com",
  projectId: "pediatric-clinic-queue-system",
  databaseURL: "https://pediatric-clinic-queue-system-default-rtdb.asia-southeast1.firebasedatabase.app",
  storageBucket: "pediatric-clinic-queue-system.firebasestorage.app",
  messagingSenderId: "499769277320",
  appId: "1:499769277320:web:cfe04b7f5b2b7f2d7e983d"
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  console.log('[firebase-messaging-sw.js] Received background message ', payload);
  const notificationTitle = payload.notification?.title || 'Notification';
  const notificationOptions = {
    body: payload.notification?.body || '',
    icon: '/favicon.svg'
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});
