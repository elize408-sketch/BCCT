
import React, { useEffect } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@react-navigation/native';

export default function IndexScreen() {
  const { session, loading } = useAuth();
  const router = useRouter();
  const { colors } = useTheme();

  useEffect(() => {
    console.log('[IndexScreen] Auth state changed', { session: session?.user?.id, loading });

    if (!loading) {
      if (session) {
        console.log('[IndexScreen] Session found, redirecting to app');
        router.replace('/(app)');
      } else {
        console.log('[IndexScreen] No session, redirecting to auth');
        router.replace('/auth');
      }
    }
  }, [session, loading]);

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
