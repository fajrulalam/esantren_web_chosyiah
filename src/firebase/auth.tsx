"use client";

import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import {
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  onAuthStateChanged,
  sendSignInLinkToEmail,
  isSignInWithEmailLink,
  signInWithEmailLink,
  GoogleAuthProvider,
  User as FirebaseUser
} from "firebase/auth";
import { httpsCallable } from "firebase/functions";
import { auth, googleProvider, db, functions } from "./config";
import { PHONE_LOGIN_ENABLED } from "@/constants";
import { collection, doc, getDoc, getDocs, query, setDoc, where, type DocumentData } from "firebase/firestore";

// User roles
export type UserRole = "waliSantri" | "pengurus" | "pengasuh" | "superAdmin" | "bendahara";

// User interface
export interface UserData {
  uid: string;
  email: string | null;
  role: UserRole;
  name?: string;
  santriId?: string; // For wali santri to link to their child
}

// Minimal shape needed to preview another user's UI/UX (e.g. a row from the
// user-management table). Only superAdmin may start a preview.
export interface UiPreviewTarget {
  uid: string;
  email?: string | null;
  name?: string;
  role: UserRole;
  santriId?: string;
}

const UI_PREVIEW_STORAGE_KEY = "esantren_ui_preview_user";
// Remembers which address a sign-in link was sent to, so opening the link in
// the same browser doesn't ask for the email again.
const EMAIL_FOR_SIGN_IN_KEY = "esantren_email_for_sign_in";

// Shared phones often hold several Google accounts; always let the santri pick.
const santriGoogleProvider = new GoogleAuthProvider();
santriGoogleProvider.setCustomParameters({ prompt: "select_account" });

export type EmailLinkResult = "completed" | "needs-email" | "not-a-link";

// A santri is a bendahara if their santri record says so, or if a
// PengurusCollection bendahara entry points at them.
async function isSantriBendahara(santriId: string, santri: DocumentData): Promise<boolean> {
  if (santri.role === "bendahara" || santri.isBendahara) return true;
  try {
    const pengurusSnapshot = await getDocs(query(
      collection(db, "PengurusCollection"),
      where("santriId", "==", santriId),
      where("role", "==", "bendahara"),
    ));
    return !pengurusSnapshot.empty;
  } catch (error) {
    console.warn("Could not check PengurusCollection for bendahara:", error);
    return false;
  }
}

function linkErrorMessage(error: unknown): string {
  const code = (error as { code?: string })?.code || "";
  const message = error instanceof Error ? error.message : "";
  // The linking function words its own not-found / duplicate messages for santri.
  if (message && ["functions/not-found", "functions/failed-precondition", "functions/unauthenticated"].includes(code)) {
    return message;
  }
  return "Gagal menautkan akun ke data santri. Coba lagi beberapa saat lagi.";
}

/**
 * Santri sign in with Google or an email link. The linkSantriAccount function
 * ties the Firebase account to the santri record with the same verified email
 * and stores its id as the `santriId` custom claim. Throws a message meant for
 * the login page when the account can't be linked.
 */
async function resolveSantriUser(firebaseUser: FirebaseUser): Promise<UserData> {
  const claims = (await firebaseUser.getIdTokenResult()).claims;
  let santriId = typeof claims.santriId === "string" ? claims.santriId : null;
  let santriDoc = santriId ? await getDoc(doc(db, "SantriCollection", santriId)) : null;

  // First sign-in, or the linked record was merged or deleted: link again by email.
  if (!santriDoc?.exists()) {
    try {
      const result = await httpsCallable<void, { santriId: string }>(functions, "linkSantriAccount")();
      santriId = result.data.santriId;
    } catch (error) {
      // Usually expected (email not on file); the login page shows the reason.
      console.warn("Could not link santri account:", error);
      throw new Error(linkErrorMessage(error));
    }
    // Refresh the ID token so the new claim reaches security rules right away.
    await firebaseUser.getIdToken(true);
    santriDoc = await getDoc(doc(db, "SantriCollection", santriId));
    if (!santriDoc.exists()) throw new Error("Data santri tidak ditemukan.");
  }

  const santri = santriDoc.data();
  return {
    uid: firebaseUser.uid,
    email: firebaseUser.email,
    role: (await isSantriBendahara(santriDoc.id, santri)) ? "bendahara" : "waliSantri",
    name: santri.nama || "",
    santriId: santriDoc.id,
  };
}

interface AuthContextProps {
  // Effective user: the previewed user while a superAdmin UI preview is
  // active, otherwise the real authenticated user. Almost everything in the
  // app should keep reading this field, since role-gated navigation and
  // pages will then automatically render as the previewed role would see it.
  user: UserData | null;
  // The real, authenticated user regardless of any active preview. Use this
  // for permission checks that must not be affected by previewing (e.g. the
  // user-management page itself).
  realUser: UserData | null;
  isPreviewing: boolean;
  loading: boolean;
  santriName: string | null;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  signInAsSantri: (namaSantri: string, nomorTelpon: string) => Promise<boolean>;
  establishSantriSession: (santri: {
    id: string;
    name: string;
    email?: string | null;
    role?: UserRole;
  }) => void;
  checkSantriName: (namaSantri: string) => Promise<boolean>;
  checkSantriPhone: (namaSantri: string, nomorTelpon: string) => Promise<boolean>;
  createNewUser: (userData: {
    email: string;
    name: string;
    role: UserRole;
    phoneNumber?: string;
    honoraryPronoun: string;
    kodeAsrama: string;
    namaPanggilan: string;
    tanggalLahir: string;
  }) => Promise<void>;
  logOut: () => Promise<void>;
  // Lets a superAdmin see the app exactly as another user would, without
  // signing out. This is a client-side UI preview only: the real Firebase
  // Auth session stays the superAdmin's, so no real re-authentication and no
  // backend/service-account involvement.
  startUiPreview: (target: UiPreviewTarget) => UserData;
  stopUiPreview: () => void;
  // Set when a santri signed in with Google or an email link but the account
  // couldn't be tied to a santri record; that sign-in is undone.
  authError: string | null;
  clearAuthError: () => void;
  signInSantriWithGoogle: () => Promise<void>;
  sendSantriSignInLink: (email: string) => Promise<void>;
  // Finishes an email-link sign-in when the current URL is one. Returns
  // "needs-email" when the link was opened in a different browser, since
  // Firebase then needs the address confirmed.
  completeSantriSignInLink: (email?: string) => Promise<EmailLinkResult>;
}

const AuthContext = createContext<AuthContextProps | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserData | null>(null);
  const [loading, setLoading] = useState(true);
  const [santriName, setSantriName] = useState<string | null>(null);
  const [previewUser, setPreviewUser] = useState<UserData | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);

  // Restore an in-progress UI preview (e.g. after a page refresh). Scoped to
  // sessionStorage so it never survives closing the tab.
  useEffect(() => {
    try {
      const stored = sessionStorage.getItem(UI_PREVIEW_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as UserData;
        setPreviewUser(parsed);
        if (parsed.role === "waliSantri" || parsed.role === "bendahara") {
          setSantriName(parsed.name || null);
        }
      }
    } catch (error) {
      console.warn("Failed to restore UI preview state:", error);
    }
  }, []);

  const isPreviewing = user?.role === "superAdmin" && !!previewUser;
  const effectiveUser = isPreviewing ? previewUser : user;

  const startUiPreview = (target: UiPreviewTarget): UserData => {
    if (!user || user.role !== "superAdmin") {
      throw new Error("Hanya Super Admin yang dapat menggunakan Preview UI.");
    }
    if (target.uid === user.uid) {
      throw new Error("Anda sudah masuk sebagai akun ini.");
    }

    const preview: UserData = {
      uid: target.uid,
      email: target.email ?? null,
      role: target.role,
      name: target.name,
      santriId: target.santriId,
    };

    setPreviewUser(preview);
    // A few waliSantri and bendahara screens (payment history, izin) show this alongside
    // the profile, the same way a real Santri self-login would set it.
    setSantriName(
      preview.role === "waliSantri" || preview.role === "bendahara"
        ? preview.name || null
        : null
    );
    try {
      sessionStorage.setItem(UI_PREVIEW_STORAGE_KEY, JSON.stringify(preview));
    } catch (error) {
      console.warn("Failed to persist UI preview state:", error);
    }

    return preview;
  };

  const stopUiPreview = () => {
    setPreviewUser(null);
    setSantriName(null);
    try {
      sessionStorage.removeItem(UI_PREVIEW_STORAGE_KEY);
    } catch (error) {
      console.warn("Failed to clear UI preview state:", error);
    }
  };

  // Staff are found in PengurusCollection; every other Firebase sign-in is a
  // santri, resolved by resolveSantriUser (which throws if it can't be linked).
  const getUserRole = async (firebaseUser: FirebaseUser): Promise<UserData | null> => {
    try {
      // First try to look up the user by UID (for existing users)
      const userDocRef = doc(db, "PengurusCollection", firebaseUser.uid);
      const userDoc = await getDoc(userDocRef);
      
      if (userDoc.exists()) {
        const userData = userDoc.data();
        
        return {
          uid: firebaseUser.uid,
          email: firebaseUser.email,
          role: userData.role as UserRole,
          name: userData.name || "",
          santriId: userData.santriId || undefined,
        };
      }
      
      // If not found by UID, try to find by email (for pre-registered users)
      const pengurusCollectionRef = collection(db, "PengurusCollection");
      const pengurusQuery = query(
        pengurusCollectionRef,
        where("email", "==", firebaseUser.email)
      );
      
      const querySnapshot = await getDocs(pengurusQuery);
      
      if (!querySnapshot.empty) {
        // Found a pre-registered user with this email
        const pengurusDoc = querySnapshot.docs[0];
        const pengurusData = pengurusDoc.data();
        
        // Update the document with the user's UID for future lookups
        await setDoc(doc(db, "PengurusCollection", firebaseUser.uid), {
          ...pengurusData,
          uid: firebaseUser.uid,  // Add the UID to the document
          // Lets security rules check this copy against the invitation it came from.
          inviteId: pengurusDoc.id,
          lastLogin: new Date()
        });
        
        return {
          uid: firebaseUser.uid,
          email: firebaseUser.email,
          role: pengurusData.role as UserRole,
          name: pengurusData.name || "",
          santriId: pengurusData.santriId || undefined,
        };
      }
    } catch (error) {
      console.error("Error getting user role:", error);
      return null;
    }

    return resolveSantriUser(firebaseUser);
  };

  // Listen for auth state changes
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setLoading(true);
      if (firebaseUser) {
        try {
          const userData = await getUserRole(firebaseUser);
          setUser(userData);
          // Santri pages read the santri's name from here, as with phone login.
          setSantriName(
            userData?.santriId && (userData.role === "waliSantri" || userData.role === "bendahara")
              ? userData.name || null
              : null
          );
          if (userData) setAuthError(null);
        } catch (error) {
          // Not tied to any santri (or staff) record: undo the sign-in and say why.
          setAuthError(error instanceof Error ? error.message : "Gagal masuk.");
          setUser(null);
          setSantriName(null);
          await signOut(auth).catch((signOutError) => console.error("Error signing out:", signOutError));
        }
      } else {
        // Check for wali santri data in localStorage
        try {
          const savedUser = localStorage.getItem('waliSantriUser');
          const savedSantriName = localStorage.getItem('santriName');

          if (!PHONE_LOGIN_ENABLED) {
            // After the cutover, old phone-login sessions must sign in again.
            localStorage.removeItem('waliSantriUser');
            localStorage.removeItem('santriName');
            setUser(null);
          } else if (savedUser && savedSantriName) {
            const userData = JSON.parse(savedUser) as UserData;
            setUser(userData);
            setSantriName(savedSantriName);
          } else {
            setUser(null);
          }
        } catch (error) {
          console.error("Error retrieving saved session:", error);
          setUser(null);
        }
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // A UI preview is only meaningful while the real session belongs to a
  // superAdmin. Drop any stale preview the moment that stops being true
  // (sign-out, role change, session expiry, etc.).
  useEffect(() => {
    if (loading) return;
    if (previewUser && user?.role !== "superAdmin") {
      setPreviewUser(null);
      setSantriName(null);
      try {
        sessionStorage.removeItem(UI_PREVIEW_STORAGE_KEY);
      } catch (error) {
        console.warn("Failed to clear UI preview state:", error);
      }
    }
  }, [loading, previewUser, user]);

  // Sign in with email and password
  const signInWithEmail = async (email: string, password: string) => {
    try {
      setLoading(true);
      await signInWithEmailAndPassword(auth, email, password);
    } catch (error) {
      console.error("Error signing in with email/password:", error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  // Sign in with Google
  const signInWithGoogle = async () => {
    try {
      setLoading(true);
      await signInWithPopup(auth, googleProvider);
    } catch (error: any) {
      console.error("Error signing in with Google:", error);
      // Make sure we're throwing the error with the Firebase error code
      if (error.code) {
        throw error;
      } else if (error.message && error.message.includes('user-cancelled')) {
        // Sometimes the error structure might be different
        const firebaseError = new Error('Firebase: IdP denied access.');
        (firebaseError as any).code = 'auth/user-cancelled';
        throw firebaseError;
      } else {
        throw error;
      }
    } finally {
      setLoading(false);
    }
  };

  // Function to properly capitalize a name
  const capitalizeName = (name: string): string => {
    if (!name) return '';
    
    // Trim any leading/trailing whitespace
    const trimmedName = name.trim();
    
    // First, ensure the first character is not a period
    if (trimmedName.startsWith('.')) {
      return capitalizeName(trimmedName.substring(1));
    }
    
    // Handle extra spaces
    const normalizedName = trimmedName.replace(/\s+/g, ' ');
    
    // Convert name to lowercase first for consistency
    const lowercaseName = normalizedName.toLowerCase();
    
    // Split by spaces to handle each word
    return lowercaseName.split(' ').map(word => {
      // Skip empty words
      if (!word) return '';
      
      // Handle prefixes like "M.", "H.", etc.
      if (word.length === 2 && word.endsWith('.')) {
        return word.charAt(0).toUpperCase() + '.';
      }
      
      // For words with periods inside (like "M.Fajrul")
      if (word.includes('.') && !word.endsWith('.')) {
        const parts = word.split('.');
        return parts.map((namePart, index) => {
          if (!namePart) {
            // Handle consecutive periods
            return index < parts.length - 1 ? '.' : '';
          }
          return namePart.charAt(0).toUpperCase() + namePart.slice(1);
        }).join('.');
      }
      
      // Special case for common Indonesian naming particles
      const particles = ['bin', 'binti', 'al', 'el', 'van', 'von', 'de', 'der', 'dan', 'den'];
      if (particles.includes(word)) {
        return word;
      }
      
      // For "name-name" format with hyphens
      if (word.includes('-')) {
        return word.split('-').map(namePart => 
          namePart.charAt(0).toUpperCase() + namePart.slice(1)
        ).join('-');
      }
      
      // Regular words: capitalize first letter
      return word.charAt(0).toUpperCase() + word.slice(1);
    }).join(' ');
  };
  
  // Log the capitalization function for testing
  console.log("Capitalization examples:");
  console.log("m. fajrul alam → ", capitalizeName("m. fajrul alam"));
  console.log("M.FAJRUL ALAM → ", capitalizeName("M.FAJRUL ALAM"));
  console.log("m.fajrul alam → ", capitalizeName("m.fajrul alam"));
  console.log("Muhammad Fajrul → ", capitalizeName("Muhammad Fajrul"));

  // Sign in as wali santri (special case - no auth)
  const signInAsSantri = async (namaSantri: string, nomorTelpon: string) => {
    if (!PHONE_LOGIN_ENABLED) return false;
    try {
      setLoading(true);
      
      // Format the name to ensure proper capitalization
      const formattedName = capitalizeName(namaSantri.trim());
      
      console.log("Attempting login with formatted name:", formattedName);
      console.log("Attempting login with phone:", nomorTelpon);
      
      // CHECK FIRESTORE CONNECTION
      try {
        // Verify db is initialized correctly
        console.log("Checking Firebase initialization...");
        if (!db) {
          throw new Error("Firestore DB not initialized properly");
        }
        console.log("Firebase DB object exists:", !!db);
        
        // Try to get the DB name or ID if possible
        try {
          // @ts-ignore - Just for debugging
          console.log("DB details:", db._databaseId ? db._databaseId.projectId : "Unknown");
        } catch (e) {
          console.log("Could not get DB details");
        }
      } catch (dbError) {
        console.error("Firebase DB check failed:", dbError);
        throw new Error("Firebase DB initialization issue");
      }
      
      // Import necessary Firestore functions
      console.log("Importing Firestore functions...");
      const { collection, query, where, getDocs, limit, getFirestore } = await import('firebase/firestore');
      
      // Re-initialize Firestore to ensure it's working
      console.log("Re-initializing Firestore connection...");
      const firestore = getFirestore();
      
      // First, let's try to get all santri to see if we can access the collection at all
      try {
        console.log("Testing collection access with a simple query...");
        const testQuery = query(
          collection(firestore, "SantriCollection"),
          limit(1)
        );
        const testSnapshot = await getDocs(testQuery);
        console.log("Collection access test result:", !testSnapshot.empty ? "Success" : "Empty result");
      } catch (testError) {
        console.error("Collection access test failed:", testError);
        // Don't throw yet, try the main query
      }
      
      // Query Firestore for santri documents that match both nama and nomorTelpon
      console.log("Executing login query with name and phone...");
      
      try {
        const santriCollectionRef = collection(firestore, "SantriCollection");
        const santriQuery = query(
          santriCollectionRef,
          where("nama", "==", formattedName),
          where("nomorTelpon", "==", nomorTelpon)
        );
        
        console.log("Query constructed, fetching results...");
        const querySnapshot = await getDocs(santriQuery);
        
        // Check if we found any matching documents
        if (!querySnapshot.empty) {
          // Get the first matching document
          const santriDoc = querySnapshot.docs[0];
          const santriData = santriDoc.data();
          const santriId = santriDoc.id;
          
          console.log("Santri found:", santriData.nama);
          
          // Check if this santri has bendahara role
          const role: UserRole = (await isSantriBendahara(santriId, santriData)) ? "bendahara" : "waliSantri";

          // Create user data object
          const userData = {
            uid: `wali_${santriId}`,
            email: santriData.email || null,
            role: role,
            name: santriData.nama,
            santriId: santriId
          };
          
          // Set wali santri user without firebase auth
          setUser(userData);
          setSantriName(formattedName);
          
          // Store in localStorage for persistence
          localStorage.setItem('waliSantriUser', JSON.stringify(userData));
          localStorage.setItem('santriName', formattedName);
          
          return true;
        } else {
          console.log("Santri tidak ditemukan dengan nama dan nomor telepon tersebut");
          console.log("Attempted with name:", formattedName);
          console.log("Attempted with phone:", nomorTelpon);
          return false;
        }
      } catch (queryError) {
        console.error("Login query failed:", queryError);
        throw queryError;
      }
    } catch (error) {
      console.error("Error signing in as santri:", error);
      return false;
    } finally {
      setLoading(false);
    }
  };

  // Registration already has the authoritative document ID, so it should not
  // re-query by a potentially duplicated name/phone pair merely to start the
  // same local wali-santri session used by the login page.
  const establishSantriSession = (santri: {
    id: string;
    name: string;
    email?: string | null;
    role?: UserRole;
  }) => {
    // After the cutover, new santri sign in with the email they registered with.
    if (!PHONE_LOGIN_ENABLED) return;
    const userData: UserData = {
      uid: `wali_${santri.id}`,
      email: santri.email ?? null,
      role: santri.role || "waliSantri",
      name: santri.name,
      santriId: santri.id,
    };

    setUser(userData);
    setSantriName(santri.name);
    localStorage.setItem("waliSantriUser", JSON.stringify(userData));
    localStorage.setItem("santriName", santri.name);
  };

  // Create a new user (for superAdmin only)
  const createNewUser = async (userData: {
    email: string;
    name: string;
    role: UserRole;
    phoneNumber?: string;
    honoraryPronoun: string;
    kodeAsrama: string;
    namaPanggilan: string;
    tanggalLahir: string;
  }) => {
    try {
      setLoading(true);
      
      // Import necessary Firestore functions
      const { collection, addDoc } = await import('firebase/firestore');
      
      // Add user data to PengurusCollection
      const pengurusRef = collection(db, "PengurusCollection");
      const docData = {
        ...userData,
        phoneNumber: userData.phoneNumber || null,
        createdAt: new Date(),
        createdBy: user?.uid || 'unknown'
      };
      
      await addDoc(pengurusRef, docData);
      
    } catch (error) {
      console.error("Error creating new user:", error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const clearAuthError = () => setAuthError(null);

  // Santri Google sign-in; linking to the santri record happens in the
  // auth state listener above.
  const signInSantriWithGoogle = async () => {
    setAuthError(null);
    await signInWithPopup(auth, santriGoogleProvider);
  };

  // Passwordless sign-in: Firebase emails a one-time link back to /login.
  const sendSantriSignInLink = async (email: string) => {
    const normalizedEmail = email.trim().toLowerCase();
    setAuthError(null);
    auth.languageCode = "id";
    await sendSignInLinkToEmail(auth, normalizedEmail, {
      url: `${window.location.origin}/login/`,
      handleCodeInApp: true,
    });
    try {
      localStorage.setItem(EMAIL_FOR_SIGN_IN_KEY, normalizedEmail);
    } catch (error) {
      console.warn("Could not remember the sign-in email:", error);
    }
  };

  const completeSantriSignInLink = async (email?: string): Promise<EmailLinkResult> => {
    const href = window.location.href;
    if (!isSignInWithEmailLink(auth, href)) return "not-a-link";
    let storedEmail = "";
    try {
      storedEmail = localStorage.getItem(EMAIL_FOR_SIGN_IN_KEY) || "";
    } catch {
      // Storage unavailable: fall back to asking for the email.
    }
    const signInEmail = (email || storedEmail).trim().toLowerCase();
    if (!signInEmail) return "needs-email";
    setAuthError(null);
    await signInWithEmailLink(auth, signInEmail, href);
    try {
      localStorage.removeItem(EMAIL_FOR_SIGN_IN_KEY);
    } catch {
      // Nothing to clean up.
    }
    return "completed";
  };

  // Sign out
  const logOut = async () => {
    try {
      // For regular Firebase authenticated users
      if (auth.currentUser) {
        await signOut(auth);
      }
      
      // Clear localStorage for wali santri
      localStorage.removeItem('waliSantriUser');
      localStorage.removeItem('santriName');
      
      // Clear user state regardless of auth type (handles waliSantri case)
      setUser(null);
      setSantriName(null);
      stopUiPreview();
    } catch (error) {
      console.error("Error signing out:", error);
      throw error;
    }
  };

  // Check if a santri name exists in the database
  const checkSantriName = async (namaSantri: string): Promise<boolean> => {
    try {
      // Format the name to ensure proper capitalization
      const formattedName = capitalizeName(namaSantri.trim());
      
      console.log("Checking name existence:", formattedName);
      
      // Import necessary Firestore functions
      const { collection, query, where, getDocs, limit, getFirestore } = await import('firebase/firestore');
      
      // Re-initialize Firestore to ensure it's working
      console.log("Re-initializing Firestore connection for name check...");
      const firestore = getFirestore();
      
      // Try a simple query first to check access
      try {
        console.log("Testing collection access for name check...");
        const testQuery = query(
          collection(firestore, "SantriCollection"),
          limit(1)
        );
        await getDocs(testQuery);
        console.log("Collection access for name check successful");
      } catch (testError) {
        console.error("Collection access test for name check failed:", testError);
        // Don't throw yet, try the name query
      }
      
      // Query Firestore for santri documents that match the name
      try {
        console.log("Executing name query...");
        const santriCollectionRef = collection(firestore, "SantriCollection");
        const santriQuery = query(
          santriCollectionRef,
          where("nama", "==", formattedName)
        );
        
        console.log("Name query constructed, fetching results...");
        const querySnapshot = await getDocs(santriQuery);
        
        // For debugging
        if (!querySnapshot.empty) {
          console.log("Name found in database:", querySnapshot.docs[0].data().nama);
        } else {
          console.log("Name not found in database. Searched for:", formattedName);
          
          // For debugging, let's get all names that start with the same first character
          const firstChar = formattedName.charAt(0);
          if (firstChar) {
            try {
              const debugQuery = query(
                santriCollectionRef,
                where("nama", ">=", firstChar),
                where("nama", "<", firstChar + "\uf8ff"),
                limit(10) // Limit to 10 results for performance
              );
              
              const debugSnapshot = await getDocs(debugQuery);
              console.log("Similar names in database:", 
                debugSnapshot.docs.map(doc => doc.data().nama)
              );
            } catch (debugError) {
              console.error("Debug query for similar names failed:", debugError);
            }
          }
        }
        
        // Return true if at least one document matches
        return !querySnapshot.empty;
      } catch (queryError) {
        console.error("Name check query failed:", queryError);
        throw queryError;
      }
    } catch (error) {
      console.error("Error checking santri name:", error);
      return false;
    }
  };

  // Check if a phone number matches a santri's registered number
  const checkSantriPhone = async (namaSantri: string, nomorTelpon: string): Promise<boolean> => {
    try {
      // Format the name to ensure proper capitalization
      const formattedName = capitalizeName(namaSantri.trim());
      
      console.log("Checking phone for:", formattedName, "Phone:", nomorTelpon);
      
      // Import necessary Firestore functions
      const { collection, query, where, getDocs, getFirestore, limit } = await import('firebase/firestore');
      
      // Re-initialize Firestore
      const firestore = getFirestore();
      
      try {
        // Query Firestore for santri documents that match both the name and phone number
        const santriCollectionRef = collection(firestore, "SantriCollection");
        const santriQuery = query(
          santriCollectionRef,
          where("nama", "==", formattedName),
          where("nomorTelpon", "==", nomorTelpon)
        );
        
        const querySnapshot = await getDocs(santriQuery);
        
        if (!querySnapshot.empty) {
          console.log("Phone matches for:", querySnapshot.docs[0].data().nama);
        } else {
          console.log("Phone doesn't match for:", formattedName);
          
          // Get the actual phone for this name to debug
          try {
            const nameQuery = query(
              santriCollectionRef,
              where("nama", "==", formattedName)
            );
            
            const nameSnapshot = await getDocs(nameQuery);
            if (!nameSnapshot.empty) {
              console.log("Actual phone in DB:", nameSnapshot.docs[0].data().nomorTelpon);
              console.log("Provided phone:", nomorTelpon);
            } else {
              console.log("No santri found with this name for phone check");
            }
          } catch (nameQueryError) {
            console.error("Failed to fetch santri by name for phone check:", nameQueryError);
          }
        }
        
        // Return true if at least one document matches both criteria
        return !querySnapshot.empty;
      } catch (queryError) {
        console.error("Phone check query failed:", queryError);
        throw queryError;
      }
    } catch (error) {
      console.error("Error checking santri phone:", error);
      return false;
    }
  };

  const value = {
    user: effectiveUser,
    realUser: user,
    isPreviewing,
    loading,
    santriName,
    signInWithEmail,
    signInWithGoogle,
    signInAsSantri,
    establishSantriSession,
    checkSantriName,
    checkSantriPhone,
    createNewUser,
    logOut,
    startUiPreview,
    stopUiPreview,
    authError,
    clearAuthError,
    signInSantriWithGoogle,
    sendSantriSignInLink,
    completeSantriSignInLink,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
