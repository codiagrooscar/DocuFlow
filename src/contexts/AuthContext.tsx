import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { User, Role } from '../types';
import { toast } from 'sonner';

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

  const fetchProfile = async (authUser: any) => {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('uid', authUser.id)
        .single();

      if (data) {
        setUser(data as User);
      } else {
        // Create user profile if it doesn't exist
        const newUser: User = {
          uid: authUser.id,
          email: authUser.email || '',
          displayName: authUser.user_metadata?.full_name || authUser.email?.split('@')[0] || 'Usuario',
          role: 'sales', // Default role
        };

        const { error: insertError } = await supabase
          .from('users')
          .insert([newUser]);

        if (insertError) {
          console.error("Error creating user profile:", insertError);
          toast.error("Error al crear el perfil de usuario");
        } else {
          setUser(newUser);
        }
      }
    } catch (err) {
      console.error("Error fetching profile:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Check active sessions and sets the user
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        fetchProfile(session.user);
      } else {
        setUser(null);
        setLoading(false);
      }
    });

    // Listen for changes on auth state (logged in, signed out, etc.)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        fetchProfile(session.user);
      } else {
        setUser(null);
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const login = async (email: string, pass: string) => {
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password: pass,
      });
      if (error) throw error;
    } catch (error: any) {
      console.error("Login error:", error);
      toast.error(`Error al iniciar sesión: ${error.message}`);
      throw error;
    }
  };

  const register = async (email: string, pass: string, name: string) => {
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password: pass,
        options: {
          data: {
            full_name: name,
          }
        }
      });
      
      if (error) throw error;
      toast.success("Cuenta creada correctamente");
    } catch (error: any) {
      console.error("Register error:", error);
      toast.error(`Error al registrar: ${error.message}`);
      throw error;
    }
  };

  const logout = async () => {
    try {
      await supabase.auth.signOut();
    } catch (error) {
      console.error("Logout error:", error);
    }
  };

  // For demo purposes: allow switching roles easily
  const switchRole = async (newRole: Role) => {
    if (!user) return;
    const updatedUser = { ...user, role: newRole };
    try {
      const { error } = await supabase
        .from('users')
        .update({ role: newRole })
        .eq('uid', user.uid);
        
      if (error) throw error;
      setUser(updatedUser);
      toast.success(`Rol cambiado a ${newRole}`);
    } catch (error: any) {
      console.error("Error switching role:", error);
      toast.error("Error al cambiar de rol.");
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



