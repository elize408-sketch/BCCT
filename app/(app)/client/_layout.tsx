
import React from "react";
import { Stack } from "expo-router";
import FloatingTabBar from "@/components/FloatingTabBar";
import type { TabBarItem } from "@/components/FloatingTabBar";

const tabs: TabBarItem[] = [
  {
    name: "index",
    route: "/(app)/client" as any,
    icon: "home",
    label: "Home",
  },
  {
    name: "chat",
    route: "/(app)/client/chat" as any,
    icon: "chat",
    label: "Chat",
  },
  {
    name: "files",
    route: "/(app)/client/files" as any,
    icon: "files",
    label: "Documenten",
  },
  {
    name: "settings",
    route: "/(app)/client/settings" as any,
    icon: "settings",
    label: "Profiel",
  },
];

export default function ClientLayout() {
  return (
    <>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="checkin" />
        <Stack.Screen name="chat" />
        <Stack.Screen name="chat-detail" options={{ headerShown: true }} />
        <Stack.Screen name="files" />
        <Stack.Screen name="settings" />
      </Stack>
      <FloatingTabBar tabs={tabs} />
    </>
  );
}
