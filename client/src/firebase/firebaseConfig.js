import { initializeApp } from "firebase/app";

const firebaseConfig = {
  apiKey: "AIzaSyBdCJu_ratr-Eys-522wsb648eZoRd48-I",
  authDomain: "pediatric-clinic-queue-system.firebaseapp.com",
  projectId: "pediatric-clinic-queue-system",
  databaseURL: "https://pediatric-clinic-queue-system-default-rtdb.asia-southeast1.firebasedatabase.app",
  storageBucket: "pediatric-clinic-queue-system.firebasestorage.app",
  messagingSenderId: "499769277320",
  appId: "1:499769277320:web:cfe04b7f5b2b7f2d7e983d"
};

const app = initializeApp(firebaseConfig);
console.log("Firebase Connected");

export default app;