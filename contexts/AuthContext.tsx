
import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { supabase } from '@/lib/supabase';
import type { User, Session } from '@supabase/supabase-js';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  selectedRole: 'client' | 'coach';
  setSelectedRole: (role: 'client' | 'coach') => void;
  signInWithPassword: (email: string, password: string, role: 'client' | 'coach') => Promise<void>;
  signUpWithPassword: (email: string, password: string, name?: string) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  signInWithApple: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedRole, setSelectedRole] = useState<'client' | 'coach'>('client');

  useEffect(() => {
    console.log('[AuthContext] Bootstrapping session...');
    
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      console.log('[AuthContext] Initial session:', session ? 'Found' : 'None');
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      console.log('[AuthContext] Auth state changed:', _event, session ? 'Session active' : 'No session');
      setSession(session);
      setUser(session?.user ?? null);
    });

    return () => {
      console.log('[AuthContext] Cleaning up auth listener');
      subscription.unsubscribe();
    };
  }, []);

  const signInWithPassword = async (email: string, password: string, role: 'client' | 'coach') => {
    console.log('[AuthContext] Signing in with email:', email, 'role:', role);
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      console.error('[AuthContext] Sign in error:', error);
      throw error;
    }

    // Store the selected role
    setSelectedRole(role);
    console.log('[AuthContext] Sign in successful:', data.user?.id, 'with role:', role);
  };

  const signUpWithPassword = async (email: string, password: string, name?: string) => {
    console.log('[AuthContext] Signing up with email:', email);
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: name,
        },
      },
    });

    if (error) {
      console.error('[AuthContext] Sign up error:', error);
      throw error;
    }

    console.log('[AuthContext] Sign up successful:', data.user?.id);
  };

  const signInWithGoogle = async () => {
    console.log('[AuthContext] Initiating Google sign in');
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: 'bcct-coaching://auth-callback',
      },
    });

    if (error) {
      console.error('[AuthContext] Google sign in error:', error);
      throw error;
    }
  };

  const signInWithApple = async () => {
    console.log('[AuthContext] Initiating Apple sign in');
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'apple',
      options: {
        redirectTo: 'bcct-coaching://auth-callback',
      },
    });

    if (error) {
      console.error('[AuthContext] Apple sign in error:', error);
      throw error;
    }
  };

  const signOut = async () => {
    console.log('[AuthContext] Signing out');
    try {
      await supabase.auth.signOut();
      console.log('[AuthContext] Sign out successful');
    } catch (error) {
      console.error('[AuthContext] Sign out error:', error);
    } finally {
      // Always clear local state
      setUser(null);
      setSession(null);
      setSelectedRole('client'); // Reset to default
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        loading,
        selectedRole,
        setSelectedRole,
        signInWithPassword,
        signUpWithPassword,
        signInWithGoogle,
        signInWithApple,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}
