// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth, GoogleAuthProvider } from "firebase/auth";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyCyU6tlP6wQawmZd4jOwXmbX6VDQNSpC0E",
  authDomain: "e-santren.firebaseapp.com",
  projectId: "e-santren",
  storageBucket: "e-santren.appspot.com",
  messagingSenderId: "385003370337",
  appId: "1:385003370337:web:0dd74d0aee02434ed47720",
  measurementId: "G-5RVGD6Z9H1"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

export default app;