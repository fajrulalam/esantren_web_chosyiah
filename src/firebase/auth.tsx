"use client";

import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { 
  signInWithEmailAndPassword, 
  signInWithPopup, 
  signOut, 
  onAuthStateChanged,
  User as FirebaseUser
} from "firebase/auth";
import { auth, googleProvider, db } from "./config";
import { doc, getDoc, setDoc } from "firebase/firestore";

// User roles
export type UserRole = "waliSantri" | "pengurus" | "pengasuh" | "superAdmin";

// User interface
export interface UserData {
  uid: string;
  email: string | null;
  role: UserRole;
  name?: string;
  santriId?: string; // For wali santri to link to their child
}

interface AuthContextProps {
  user: UserData | null;
  loading: boolean;
  santriName: string | null;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  signInAsSantri: (namaSantri: string, nomorTelpon: string) => Promise<boolean>;
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
}

const AuthContext = createContext<AuthContextProps | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserData | null>(null);
  const [loading, setLoading] = useState(true);
  const [santriName, setSantriName] = useState<string | null>(null);

  // Get user role from Firestore
  const getUserRole = async (firebaseUser: FirebaseUser) => {
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
          name: userData.name || ""
        };
      }
      
      // If not found by UID, try to find by email (for pre-registered users)
      const { collection, query, where, getDocs } = await import('firebase/firestore');
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
          lastLogin: new Date()
        });
        
        return {
          uid: firebaseUser.uid,
          email: firebaseUser.email,
          role: pengurusData.role as UserRole,
          name: pengurusData.name || ""
        };
      }
      
      // Default to waliSantri if no role found in PengurusCollection
      return {
        uid: firebaseUser.uid,
        email: firebaseUser.email,
        role: "waliSantri" as UserRole
      };
    } catch (error) {
      console.error("Error getting user role:", error);
      return null;
    }
  };

  // Listen for auth state changes
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setLoading(true);
      if (firebaseUser) {
        const userData = await getUserRole(firebaseUser);
        setUser(userData);
      } else {
        // Check for wali santri data in localStorage
        try {
          const savedUser = localStorage.getItem('waliSantriUser');
          const savedSantriName = localStorage.getItem('santriName');
          
          if (savedUser && savedSantriName) {
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
    try {
      setLoading(true);
      
      // Format the name to ensure proper capitalization
      const formattedName = capitalizeName(namaSantri.trim());
      
      console.log("Attempting login with formatted name:", formattedName);
      
      // Import necessary Firestore functions
      const { collection, query, where, getDocs } = await import('firebase/firestore');
      
      // Query Firestore for santri documents that match both nama and nomorTelpon
      const santriCollectionRef = collection(db, "SantriCollection");
      const santriQuery = query(
        santriCollectionRef,
        where("nama", "==", formattedName),
        where("nomorTelpon", "==", nomorTelpon)
      );
      
      const querySnapshot = await getDocs(santriQuery);
      
      // Check if we found any matching documents
      if (!querySnapshot.empty) {
        // Get the first matching document
        const santriDoc = querySnapshot.docs[0];
        const santriData = santriDoc.data();
        const santriId = santriDoc.id;
        
        console.log("Santri found:", santriData.nama);
        
        // Create user data object
        const userData = {
          uid: `wali_${santriId}`,
          email: null,
          role: "waliSantri" as UserRole,
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
    } catch (error) {
      console.error("Error signing in as santri:", error);
      return false;
    } finally {
      setLoading(false);
    }
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
      const { collection, query, where, getDocs } = await import('firebase/firestore');
      
      // Query Firestore for santri documents that match the name
      const santriCollectionRef = collection(db, "SantriCollection");
      const santriQuery = query(
        santriCollectionRef,
        where("nama", "==", formattedName)
      );
      
      const querySnapshot = await getDocs(santriQuery);
      
      // For debugging
      if (!querySnapshot.empty) {
        console.log("Name found in database:", querySnapshot.docs[0].data().nama);
      } else {
        console.log("Name not found in database. Searched for:", formattedName);
        
        // For debugging, let's get all names that start with the same first character
        const firstChar = formattedName.charAt(0);
        if (firstChar) {
          const debugQuery = query(
            santriCollectionRef,
            where("nama", ">=", firstChar),
            where("nama", "<", firstChar + "\uf8ff")
          );
          
          const debugSnapshot = await getDocs(debugQuery);
          console.log("Similar names in database:", 
            debugSnapshot.docs.map(doc => doc.data().nama).slice(0, 10)
          );
        }
      }
      
      // Return true if at least one document matches
      return !querySnapshot.empty;
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
      const { collection, query, where, getDocs } = await import('firebase/firestore');
      
      // Query Firestore for santri documents that match both the name and phone number
      const santriCollectionRef = collection(db, "SantriCollection");
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
        const nameQuery = query(
          santriCollectionRef,
          where("nama", "==", formattedName)
        );
        
        const nameSnapshot = await getDocs(nameQuery);
        if (!nameSnapshot.empty) {
          console.log("Actual phone in DB:", nameSnapshot.docs[0].data().nomorTelpon);
          console.log("Provided phone:", nomorTelpon);
        }
      }
      
      // Return true if at least one document matches both criteria
      return !querySnapshot.empty;
    } catch (error) {
      console.error("Error checking santri phone:", error);
      return false;
    }
  };

  const value = {
    user,
    loading,
    santriName,
    signInWithEmail,
    signInWithGoogle,
    signInAsSantri,
    checkSantriName,
    checkSantriPhone,
    createNewUser,
    logOut
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