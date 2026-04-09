import React, { createContext, useContext, useEffect, useState } from 'react';
import { User as FirebaseUser, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { auth, db } from '../firebase';
import { User, Role } from '../types';
import { toast } from 'sonner';
import { handleFirestoreError, OperationType } from '../lib/firebase-utils';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (email: string, pass: string) => Promise<void>;
  register: (email: string, pass: string, name: string) => Promise<void>;
  logout: () => Promise<void>;
  switchRole: (role: Role) => Promise<void>; // For demo purposes
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState<Error | null>(null);

  if (authError) {
    throw authError;
  }

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        try {
          // Fetch user role from Firestore
          const userDocRef = doc(db, 'users', firebaseUser.uid);
          const userDoc = await getDoc(userDocRef);
          
          if (userDoc.exists()) {
            setUser(userDoc.data() as User);
          } else {
            // Fallback if user document doesn't exist but auth does
             const newUser: User = {
              uid: firebaseUser.uid,
              email: firebaseUser.email || '',
              displayName: firebaseUser.displayName || firebaseUser.email?.split('@')[0] || 'User',
              role: 'sales',
            };
            await setDoc(userDocRef, newUser);
            setUser(newUser);
          }
        } catch (error: any) {
          console.error("Error fetching user data:", error);
          
          setUser({
            uid: firebaseUser.uid,
            email: firebaseUser.email || '',
            displayName: firebaseUser.displayName || firebaseUser.email?.split('@')[0] || 'User',
            role: 'sales',
          });

          if (error.code === 'permission-denied' || error.message?.includes('Missing or insufficient permissions')) {
            try {
              handleFirestoreError(error, OperationType.GET, `users/${firebaseUser.uid}`);
            } catch (e: any) {
              setAuthError(e);
            }
          } else {
            toast.error("Error al cargar datos del usuario.");
          }
        }
      } else {
        setUser(null);
      }
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  const login = async (email: string, pass: string) => {
    try {
      await signInWithEmailAndPassword(auth, email, pass);
    } catch (error: any) {
      console.error("Login error:", error);
      let errorMsg = "Verifica tus credenciales.";
      if (error.code === 'auth/user-not-found') errorMsg = "Usuario no encontrado.";
      if (error.code === 'auth/wrong-password') errorMsg = "Contraseña incorrecta.";
      if (error.code === 'auth/invalid-credential') errorMsg = "Credenciales inválidas.";
      toast.error(`Error al iniciar sesión: ${errorMsg}`);
      throw error;
    }
  };

  const register = async (email: string, pass: string, name: string) => {
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, pass);
      const firebaseUser = userCredential.user;
      
      const newUser: User = {
        uid: firebaseUser.uid,
        email: firebaseUser.email || '',
        displayName: name || firebaseUser.email?.split('@')[0] || 'User',
        role: 'sales', // Default role
      };
      
      try {
        await setDoc(doc(db, 'users', firebaseUser.uid), newUser);
      } catch (firestoreError: any) {
        if (firestoreError.code === 'permission-denied' || firestoreError.message?.includes('Missing or insufficient permissions')) {
          handleFirestoreError(firestoreError, OperationType.CREATE, `users/${firebaseUser.uid}`);
        }
        throw firestoreError;
      }
      
      setUser(newUser);
      toast.success("Cuenta creada correctamente");
    } catch (error: any) {
      console.error("Register error:", error);
      let errorMsg = error.message || "Error desconocido";
      if (error.code === 'auth/email-already-in-use') errorMsg = "El correo ya está en uso.";
      if (error.code === 'auth/weak-password') errorMsg = "La contraseña es muy débil.";
      if (error.code === 'auth/operation-not-allowed') errorMsg = "La autenticación por correo/contraseña no está habilitada en Firebase Console.";
      if (error.message?.includes('Firestore Error')) errorMsg = "Error de permisos en la base de datos (Firestore Rules).";
      
      toast.error(`Error al registrar: ${errorMsg}`);
      throw error;
    }
  };

  const logout = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error("Logout error:", error);
    }
  };

  // For demo purposes: allow switching roles easily
  const switchRole = async (newRole: Role) => {
    if (!user) return;
    const updatedUser = { ...user, role: newRole };
    try {
      await setDoc(doc(db, 'users', user.uid), updatedUser);
      setUser(updatedUser);
    } catch (error: any) {
      if (error.code === 'permission-denied' || error.message?.includes('Missing or insufficient permissions')) {
        handleFirestoreError(error, OperationType.UPDATE, `users/${user.uid}`);
      }
      console.error("Error switching role:", error);
      toast.error("Error al cambiar de rol. Verifica las reglas de Firestore.");
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout, switchRole }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}



