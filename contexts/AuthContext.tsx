
import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { supabase } from '@/lib/supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { User, Session } from '@supabase/supabase-js';

/**
 * Safely upsert a profile row, always preserving the existing role if one exists.
 * Falls back to the provided defaultRole (or 'client') if no row exists yet.
 */
async function upsertProfileWithRole(
  userId: string,
  defaultRole: 'client' | 'coach',
  fullName?: string,
) {
  console.log('[Auth] upsertProfileWithRole — userId:', userId, 'defaultRole:', defaultRole);

  // Read existing row first so we never overwrite an already-set role
  const { data: existing, error: fetchError } = await supabase
    .from('profiles')
    .select('role, onboarding_completed')
    .eq('id', userId)
    .single();

  if (fetchError && fetchError.code !== 'PGRST116') {
    // PGRST116 = row not found — that's fine, we'll create it
    console.warn('[Auth] Could not fetch existing profile (non-fatal):', fetchError.message);
  }

  const role = existing?.role ?? defaultRole;
  console.log('[Auth] upserting profile with role:', role);

  const payload: Record<string, unknown> = {
    id: userId,
    role,
    updated_at: new Date().toISOString(),
  };
  if (fullName) payload.full_name = fullName;

  const { data, error } = await supabase
    .from('profiles')
    .upsert(payload, { onConflict: 'id' });

  if (error) {
    console.error('[Auth] Profile upsert error:', error);
  } else {
    console.log('[Auth] profile upsert result: success', data);
    // Cache the resolved role so guards can read it synchronously
    await AsyncStorage.setItem('user_role', role);
    console.log('[Auth] Cached user_role in AsyncStorage:', role);
  }

  return role;
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  role: string | null;
  signInWithPassword: (email: string, password: string, role: 'client' | 'coach') => Promise<void>;
  signUpWithPassword: (email: string, password: string, name?: string, role?: 'client' | 'coach') => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  signInWithApple: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [role, setRole] = useState<string | null>(null);

  useEffect(() => {
    console.log('[AuthContext] Bootstrapping session...');

    // Get initial session
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      console.log('[AuthContext] Initial session:', session ? 'Found' : 'None');
      setSession(session);
      setUser(session?.user ?? null);

      if (session?.user) {
        // Populate role cache on boot — fast path for subsequent renders
        try {
          const { data: profile } = await supabase
            .from('profiles')
            .select('role')
            .eq('id', session.user.id)
            .single();
          if (profile?.role) {
            setRole(profile.role);
            await AsyncStorage.setItem('user_role', profile.role);
            console.log('[AuthContext] Boot: cached user_role:', profile.role);
          }
        } catch (e) {
          console.warn('[AuthContext] Boot: could not fetch profile role (non-fatal):', e);
        }
      }

      setLoading(false);
    });

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      console.log('[AuthContext] Auth state changed:', _event, session ? 'Session active' : 'No session');
      setSession(session);
      setUser(session?.user ?? null);
      if (!session) {
        setRole(null);
      }
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

    console.log('[AuthContext] Sign in successful:', data.user?.id, 'with role:', role);

    // Ensure profile exists with role preserved; also caches role in AsyncStorage
    if (data.user) {
      const resolvedRole = await upsertProfileWithRole(data.user.id, role);
      setRole(resolvedRole);
    }
  };

  const signUpWithPassword = async (email: string, password: string, name?: string, role: 'client' | 'coach' = 'client') => {
    console.log('[AuthContext] Signing up with email:', email, 'role:', role);
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

    // Create initial profile with the selected role — never default blindly to 'client'
    if (data.user) {
      const resolvedRole = await upsertProfileWithRole(data.user.id, role, name);
      setRole(resolvedRole);
    }
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
      await AsyncStorage.removeItem('user_role');
      console.log('[AuthContext] Sign out successful, cleared user_role cache');
    } catch (error) {
      console.error('[AuthContext] Sign out error:', error);
    } finally {
      // Always clear local state
      setUser(null);
      setSession(null);
      setRole(null);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        loading,
        role,
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

const AUTH_DEFAULT: AuthContextType = {
  user: null,
  session: null,
  loading: true,
  role: null,
  signInWithPassword: async () => {},
  signUpWithPassword: async () => {},
  signInWithGoogle: async () => {},
  signInWithApple: async () => {},
  signOut: async () => {},
};

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    // AuthProvider not yet mounted (Expo Router hydration race) — return safe defaults.
    // loading: true ensures consumers wait before acting on session.
    console.warn('[useAuth] Called outside AuthProvider — returning defaults');
    return AUTH_DEFAULT;
  }
  return context;
}
