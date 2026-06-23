
import React from 'react';
import { Stack } from 'expo-router';
import { useSubscriptionGuard } from "@/hooks/useSubscriptionGuard";

export default function TabLayout() {
  useSubscriptionGuard();

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
