
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
    name: 'documenten',
    route: '/(tabs)/documenten',
    icon: 'documenten',
    label: 'Documenten',
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
        <Stack.Screen name="documenten" />
        <Stack.Screen name="profiel" />
      </Stack>
      <FloatingTabBar tabs={tabs} />
    </>
  );
}
