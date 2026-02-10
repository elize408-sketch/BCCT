
import React, { useEffect, useState } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { Redirect } from 'expo-router';
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

export default function AppLayout() {
  const { session, loading: authLoading } = useAuth();
  const { colors } = useTheme();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    console.log('[AppLayout] Checking auth state', { session: session?.user?.id, authLoading });

    if (!authLoading) {
      if (!session) {
        console.log('[AppLayout] No session, should redirect to auth');
        setLoading(false);
        return;
      }

      fetchProfile();
    }
  }, [session, authLoading]);

  const fetchProfile = async () => {
    console.log('[AppLayout] Fetching user profile from Supabase');
    try {
      const {
        data: { session: currentSession },
      } = await supabase.auth.getSession();

      if (!currentSession) {
        console.error('[AppLayout] No session found');
        setLoading(false);
        return;
      }

      const { data, error } = await supabase.from('profiles').select('*').eq('id', currentSession.user.id).single();

      if (error) {
        console.error('[AppLayout] Error fetching profile:', error);
        // Profile might not exist yet, redirect to onboarding
        setProfile(null);
      } else {
        console.log('[AppLayout] Profile loaded successfully', data);
        setProfile(data);
      }
    } catch (error: any) {
      console.error('[AppLayout] Error fetching profile', error);
    } finally {
      setLoading(false);
    }
  };

  if (authLoading || loading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (!session) {
    console.log('[AppLayout] Redirecting to auth');
    return <Redirect href="/auth" />;
  }

  if (!profile || !profile.onboarding_completed || !profile.full_name) {
    console.log('[AppLayout] Profile incomplete, redirecting to onboarding');
    return <Redirect href="/onboarding" />;
  }

  console.log('[AppLayout] Rendering role-based layout', { role: profile.role });

  // Role-based routing
  if (profile.role === 'client') {
    return <Redirect href="/(app)/client" />;
  }

  if (profile.role === 'coach') {
    return <Redirect href="/(app)/coach" />;
  }

  if (profile.role === 'org_admin') {
    return <Redirect href="/(app)/org" />;
  }

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
