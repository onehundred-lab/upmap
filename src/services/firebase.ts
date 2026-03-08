import { initializeApp } from 'firebase/app';
import { getDatabase } from 'firebase/database';

const firebaseConfig = {
  apiKey: "AIzaSyBHGRINkIcwGR5Vuoo66uJ4o9CviXTcpes",
  authDomain: "grab-428f0.firebaseapp.com",
  databaseURL: "https://grab-428f0-default-rtdb.firebaseio.com",
  projectId: "grab-428f0",
  storageBucket: "grab-428f0.firebasestorage.app",
  messagingSenderId: "1023013070360",
  appId: "1:1023013070360:web:8927999da7076c858a856d",
};

const app = initializeApp(firebaseConfig);
export const db = getDatabase(app);
