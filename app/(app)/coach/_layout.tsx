
import React from "react";
import { Stack } from "expo-router";

export default function CoachLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="modules" />
      <Stack.Screen name="theme-detail" />
      <Stack.Screen name="clients" />
      <Stack.Screen name="client-detail" />
    </Stack>
  );
}
