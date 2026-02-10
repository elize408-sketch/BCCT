
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

    if (!authLoading) {
      checkAuthAndRedirect();
    }
  }, [session, authLoading]);

  const checkAuthAndRedirect = async () => {
    if (!session) {
      console.log('[IndexScreen] No session, redirecting to auth');
      router.replace('/auth');
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
        router.replace('/onboarding');
        setChecking(false);
        return;
      }

      if (!profile.onboarding_completed || !profile.full_name) {
        console.log('[IndexScreen] Profile incomplete, redirecting to onboarding');
        router.replace('/onboarding');
        setChecking(false);
        return;
      }

      console.log('[IndexScreen] Profile complete, redirecting based on role:', profile.role);

      // Role-based routing
      if (profile.role === 'client') {
        router.replace('/(app)/client');
      } else if (profile.role === 'coach') {
        router.replace('/(app)/coach');
      } else if (profile.role === 'org_admin') {
        router.replace('/(app)/org');
      } else {
        console.log('[IndexScreen] Unknown role, redirecting to onboarding');
        router.replace('/onboarding');
      }
    } catch (error) {
      console.error('[IndexScreen] Error checking profile:', error);
      router.replace('/onboarding');
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
