
import React from "react";
import { Stack } from "expo-router";
import FloatingTabBar from "@/components/FloatingTabBar";
import type { TabBarItem } from "@/components/FloatingTabBar";

export default function ClientLayout() {
  const tabs: TabBarItem[] = [
    {
      name: "checkin",
      route: "/(app)/client/checkin" as any,
      icon: "favorite",
      label: "",
    },
    {
      name: "chat",
      route: "/(app)/client/chat" as any,
      icon: "chat",
      label: "",
    },
    {
      name: "files",
      route: "/(app)/client/files" as any,
      icon: "folder",
      label: "",
    },
    {
      name: "settings",
      route: "/(app)/client/settings" as any,
      icon: "settings",
      label: "",
    },
  ];

  return (
    <>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="checkin" />
        <Stack.Screen name="chat" />
        <Stack.Screen name="files" />
        <Stack.Screen name="settings" />
      </Stack>
      <FloatingTabBar tabs={tabs} />
    </>
  );
}
