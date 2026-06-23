
import React from 'react';
import { Stack } from 'expo-router';

export default function AppLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="client" />
      <Stack.Screen name="coach" />
      <Stack.Screen name="org" />
      <Stack.Screen name="appointment-detail" />
      <Stack.Screen name="appointment-form" />
      <Stack.Screen
        name="homework-compose"
        options={{
          presentation: 'modal',
          headerShown: true,
          title: 'Huiswerk sturen',
        }}
      />
      <Stack.Screen
        name="chat-conversation"
        options={{
          headerShown: true,
          headerStyle: { backgroundColor: '#FFFFFF' },
          headerTintColor: '#F97316',
          headerTitleStyle: { fontWeight: '600', color: '#1F2937' },
          headerShadowVisible: true,
          headerBackButtonDisplayMode: 'minimal',
        }}
      />
    </Stack>
  );
}
