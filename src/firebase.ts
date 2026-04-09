import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore, doc, getDocFromServer } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

const firebaseConfig = {
  apiKey: "AIzaSyCsyTXq_GXtbL03tpkBqZV7--b4r_V5Q78",
  authDomain: "docuflow-5463c.firebaseapp.com",
  projectId: "docuflow-5463c",
  storageBucket: "docuflow-5463c.firebasestorage.app",
  messagingSenderId: "519340161550",
  appId: "1:519340161550:web:8300b1985e2f6c7f1bda5f",
  measurementId: "G-H7SNPC4Z74"
};

console.log("Firebase Config loaded directly. API Key exists:", !!firebaseConfig.apiKey);

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);

async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if(error instanceof Error && error.message.includes('the client is offline')) {
      console.error("Please check your Firebase configuration. ");
    }
  }
}
testConnection();
