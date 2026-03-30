
import "react-native-reanimated";
import React, { useEffect } from "react";
import { Stack, usePathname, useRouter } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { SystemBars } from "react-native-edge-to-edge";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { useColorScheme } from "react-native";
import { ThemeProvider } from "@react-navigation/native";
import { StatusBar } from "expo-status-bar";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { SubscriptionProvider, useSubscription } from "@/contexts/SubscriptionContext";
import { BCCTLightTheme, BCCTDarkTheme } from "@/styles/bcctTheme";

// Prevent the splash screen from auto-hiding
SplashScreen.preventAutoHideAsync();

export const unstable_settings = {
  initialRouteName: "index",
};


function SubscriptionRedirect() {
  const { isSubscribed, loading } = useSubscription();
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (loading || authLoading) return;
    const onAuthScreen = pathname === "/auth";
    if (onAuthScreen) return;
    if (!user) {
      router.replace("/auth");
      return;
    }
    // Allow onboarding, coach-onboarding, and paywall screens to render freely
    const isExempt =
      pathname.startsWith("/onboarding") ||
      pathname === "/coach-onboarding" ||
      pathname === "/paywall";
    if (isExempt) return;

    if (!isSubscribed) {
      router.replace("/paywall");
    }
  }, [isSubscribed, loading, authLoading, pathname, user, router]);

  return null;
}

export default function RootLayout() {
  const colorScheme = useColorScheme();

  useEffect(() => {
    // Hide splash screen immediately since we're not loading custom fonts
    console.log('App initialized with system fonts, hiding splash screen');
    SplashScreen.hideAsync();
  }, []);

  console.log('Rendering app with system fonts');

  return (
    <>
      <StatusBar style="auto" animated />
      <ThemeProvider
        value={colorScheme === "dark" ? BCCTDarkTheme : BCCTLightTheme}
      >
        <AuthProvider>
        <SubscriptionProvider>
          <SubscriptionRedirect />
          <GestureHandlerRootView style={{ flex: 1 }}>
            <Stack screenOptions={{ headerShown: false }}>
              <Stack.Screen name="index" />
              <Stack.Screen name="auth" />
              <Stack.Screen name="auth-popup" />
              <Stack.Screen name="auth-callback" />
              <Stack.Screen name="onboarding" />
              <Stack.Screen name="coach-onboarding" />
              <Stack.Screen name="paywall" />
              <Stack.Screen name="(app)" />
            </Stack>
            <SystemBars style="auto" />
          </GestureHandlerRootView>
        </SubscriptionProvider>
        </AuthProvider>
      </ThemeProvider>
    </>
  );
}
