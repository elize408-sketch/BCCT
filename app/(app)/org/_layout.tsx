
import React from "react";
import { Stack } from "expo-router";

export default function OrgLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
    </Stack>
  );
}
