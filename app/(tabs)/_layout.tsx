
import React, { useEffect, useState } from 'react';
import { Stack, useRouter } from 'expo-router';
import { useSubscriptionGuard } from "@/hooks/useSubscriptionGuard";
import { useAuth } from '@/contexts/AuthContext';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function TabLayout() {
  useSubscriptionGuard();

  const { user, loading } = useAuth();
  const router = useRouter();
  const [roleChecked, setRoleChecked] = useState(false);
  const [isCoach, setIsCoach] = useState(false);

  useEffect(() => {
    if (loading || !user) return;

    AsyncStorage.getItem('user_role').then((role) => {
      console.log('[TabLayout] Role guard check — cached role:', role);
      if (role === 'coach') {
        console.log('[TabLayout] Coach detected — blocking client tabs and redirecting to coach portal');
        setIsCoach(true);
        router.replace('/(app)/coach');
      } else {
        console.log('[TabLayout] Client role confirmed — rendering client tabs');
        setRoleChecked(true);
      }
    });
  }, [user, loading]);

  // Block rendering of client tabs entirely until role is confirmed
  if (!roleChecked || isCoach) return null;

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        animation: 'none',
      }}
    >
      <Stack.Screen name="(home)" />
      <Stack.Screen name="(chat)" />
      <Stack.Screen name="appointments" />
      <Stack.Screen name="documenten" />
      <Stack.Screen name="profiel" />
      <Stack.Screen name="mijn-reis" />
      <Stack.Screen name="mijn-groei" />
      <Stack.Screen name="mijn-gewoontes" />
      <Stack.Screen name="huiswerk" />
      <Stack.Screen name="notities" />
      <Stack.Screen name="voortgang" />
    </Stack>
  );
}
