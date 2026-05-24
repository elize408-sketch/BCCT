
import React from 'react';
import { Stack } from 'expo-router';
import FloatingTabBar, { TabBarItem } from '@/components/FloatingTabBar';
import { useSubscriptionGuard } from "@/hooks/useSubscriptionGuard";

const tabs: TabBarItem[] = [
  {
    name: '(home)',
    route: '/(tabs)/(home)/',
    icon: 'home',
    label: 'Home',
  },
  {
    name: '(chat)',
    route: '/(tabs)/(chat)/',
    icon: 'chat',
    label: 'Chat',
  },
  {
    name: 'appointments',
    route: '/(tabs)/appointments',
    icon: 'appointments',
    label: 'Afspraken',
  },
  {
    name: 'profiel',
    route: '/(tabs)/profiel',
    icon: 'profiel',
    label: 'Profiel',
  },
];

export default function TabLayout() {
  useSubscriptionGuard();

  return (
    <>
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
        <Stack.Screen name="(chat)/[id]" options={{ href: null }} />
      </Stack>
      <FloatingTabBar tabs={tabs} />
    </>
  );
}
