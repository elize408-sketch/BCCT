
import React, { useEffect, useState } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@react-navigation/native';
import { supabase } from '@/lib/supabase';

interface UserProfile {
  id: string;
  full_name?: string | null;
  phone?: string | null;
  role: 'client' | 'coach' | 'org_admin';
  goals?: string | null;
  onboarding_completed: boolean;
}

export default function IndexScreen() {
  const { session, loading: authLoading } = useAuth();
  const router = useRouter();
  const { colors } = useTheme();
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    console.log('[IndexScreen] Auth state changed', { session: session?.user?.id, loading: authLoading });

    // Wait until auth has fully resolved before making any routing decisions
    if (authLoading) return;
    checkAuthAndRedirect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, authLoading]);

  const checkAuthAndRedirect = async () => {
    if (!session) {
      console.log('[IndexScreen] No session, redirecting to auth');
      setTimeout(() => router.replace('/auth'), 100);
      setChecking(false);
      return;
    }

    console.log('[IndexScreen] Session found, checking profile');

    try {
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', session.user.id)
        .single();

      if (error || !profile) {
        console.log('[IndexScreen] No profile found, redirecting to onboarding');
        setTimeout(() => router.replace('/onboarding'), 100);
        setChecking(false);
        return;
      }

      // Coach onboarding guard
      if (profile.role === 'coach') {
        if (!profile.onboarding_completed) {
          console.log('[IndexScreen] Coach onboarding incomplete, redirecting to coach-onboarding');
          setTimeout(() => router.replace('/coach-onboarding'), 100);
          setChecking(false);
          return;
        }
        console.log('[IndexScreen] Coach onboarding complete, redirecting to coach dashboard');
        setTimeout(() => router.replace('/(app)/coach'), 100);
        setChecking(false);
        return;
      }

      // For all other roles (or undefined role), redirect to generic onboarding if incomplete
      if (profile.role !== 'coach' && (!profile.onboarding_completed || !profile.full_name)) {
        console.log('[IndexScreen] Profile incomplete, redirecting to onboarding');
        setTimeout(() => router.replace('/onboarding'), 100);
        setChecking(false);
        return;
      }

      console.log('[IndexScreen] Profile complete, redirecting based on role:', profile.role);

      // Role-based routing
      if (profile.role === 'client') {
        setTimeout(() => router.replace('/(app)/client'), 100);
      } else if (profile.role === 'org_admin') {
        setTimeout(() => router.replace('/(app)/org'), 100);
      } else {
        console.log('[IndexScreen] Unknown role, redirecting to onboarding');
        setTimeout(() => router.replace('/onboarding'), 100);
      }
    } catch (error) {
      console.error('[IndexScreen] Error checking profile:', error);
      setTimeout(() => router.replace('/onboarding'), 100);
    } finally {
      setChecking(false);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ActivityIndicator size="large" color={colors.primary} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
