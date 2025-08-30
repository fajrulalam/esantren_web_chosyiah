// Import the functions you need from the SDKs you need
import { initializeApp, getApps, getApp } from "firebase/app";
import { getFirestore, doc, getDoc } from "firebase/firestore";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFunctions, connectFunctionsEmulator } from "firebase/functions";
import { getStorage } from "firebase/storage";

// Primary Firebase configuration (e-santren)
const primaryFirebaseConfig = {
  apiKey: "AIzaSyCyU6tlP6wQawmZd4jOwXmbX6VDQNSpC0E",
  authDomain: "e-santren.firebaseapp.com",
  projectId: "e-santren",
  storageBucket: "e-santren.appspot.com",
  messagingSenderId: "385003370337",
  appId: "1:385003370337:web:0dd74d0aee02434ed47720",
  measurementId: "G-5RVGD6Z9H1"
};

// Secondary Firebase configuration (inventory system)
const inventoryFirebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  databaseURL: process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
};

// Initialize Firebase apps with singleton pattern to prevent re-initialization
let primaryApp;
let inventoryApp;

// Initialize primary app (with singleton check)
if (!getApps().length) {
  primaryApp = initializeApp(primaryFirebaseConfig);
} else {
  primaryApp = getApp();
}

// Initialize inventory app (only in browser and if config is available)
const initInventoryApp = () => {
  if (typeof window === 'undefined') return null; // Skip on server side
  
  try {
    const hasInventoryConfig = inventoryFirebaseConfig.apiKey && 
                              inventoryFirebaseConfig.authDomain && 
                              inventoryFirebaseConfig.projectId;
    
    if (!hasInventoryConfig) {
      console.warn('Inventory Firebase config incomplete, skipping inventory app initialization');
      return null;
    }

    // Check if inventory app already exists
    try {
      return getApp('inventory');
    } catch {
      // App doesn't exist, create it
      return initializeApp(inventoryFirebaseConfig, 'inventory');
    }
  } catch (error) {
    console.warn('Failed to initialize inventory Firebase app:', error);
    return null;
  }
};

// Initialize inventory app
inventoryApp = initInventoryApp();

// Export primary app services (existing e-santren)
export const db = getFirestore(primaryApp);
export const auth = getAuth(primaryApp);
export const storage = getStorage(primaryApp);
export const functions = getFunctions(primaryApp, 'us-central1');

// Export inventory app services (with fallback and lazy initialization)
export const getInventoryDb = () => {
  if (!inventoryApp && typeof window !== 'undefined') {
    inventoryApp = initInventoryApp();
  }
  return inventoryApp ? getFirestore(inventoryApp) : null;
};

export const inventoryDb = getInventoryDb();
export const inventoryAuth = inventoryApp ? getAuth(inventoryApp) : null;
export const inventoryStorage = inventoryApp ? getStorage(inventoryApp) : null;
export const inventoryFunctions = inventoryApp ? getFunctions(inventoryApp, 'us-central1') : null;

// Connect to Firebase emulators in development environment
// But only if explicitly enabled through an environment variable
const USE_EMULATORS = false; // Set to false to use production Firebase

if (process.env.NODE_ENV === 'development' && USE_EMULATORS) {
  try {
    console.log('Attempting to connect to Firebase emulators...');
    
    // Connect to Functions emulator
    connectFunctionsEmulator(functions, 'localhost', 5001);
    console.log('Connected to Functions emulator');
    
    // Connect to Firestore emulator
    import('firebase/firestore').then(({ connectFirestoreEmulator }) => {
      connectFirestoreEmulator(db, 'localhost', 8080);
      console.log('Connected to Firestore emulator');
    }).catch(err => {
      console.error('Failed to connect to Firestore emulator:', err);
    });
    
    // Connect to Auth emulator
    import('firebase/auth').then(({ connectAuthEmulator }) => {
      connectAuthEmulator(auth, 'http://localhost:9099', { disableWarnings: true });
      console.log('Connected to Auth emulator');
    }).catch(err => {
      console.error('Failed to connect to Auth emulator:', err);
    });
  } catch (e) {
    console.error('Could not connect to Firebase emulators:', e);
  }
} else {
  console.log('Using production Firebase services');
}

export const googleProvider = new GoogleAuthProvider();

// Log data from both databases when the config is loaded
if (typeof window !== 'undefined') {
  // Only run in browser environment
  


  // Log from primary database: AktivitasCollection/DU11_Chosyiah.namaAsrama

}

export default primaryApp;