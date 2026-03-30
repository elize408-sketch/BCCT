
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
import { TipsProvider } from "@/contexts/TipsContext";
import { BCCTLightTheme, BCCTDarkTheme } from "@/styles/bcctTheme";
import { isOnboardingDone } from "@/utils/tipsStorage";

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
    // Allow onboarding, coach-onboarding, welcome-onboarding, and paywall screens to render freely
    const isExempt =
      pathname.startsWith("/onboarding") ||
      pathname === "/coach-onboarding" ||
      pathname === "/coach-welcome-onboarding" ||
      pathname === "/paywall";
    if (isExempt) return;

    if (!isSubscribed) {
      router.replace("/paywall");
    }
  }, [isSubscribed, loading, authLoading, pathname, user, router]);

  return null;
}

function OnboardingRedirect() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (authLoading) return;
    if (!user) return;

    // Only redirect to welcome onboarding from the main tabs area
    const isOnMainTabs = pathname.startsWith("/(tabs)") || pathname === "/";
    if (!isOnMainTabs) return;

    console.log('[OnboardingRedirect] Checking if coach welcome onboarding is done for user:', user.id);
    isOnboardingDone().then((done) => {
      if (!done) {
        console.log('[OnboardingRedirect] Onboarding not done, redirecting to coach-welcome-onboarding');
        router.replace("/coach-welcome-onboarding");
      }
    });
  }, [user, authLoading, pathname, router]);

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
          <TipsProvider>
            <SubscriptionRedirect />
            <OnboardingRedirect />
            <GestureHandlerRootView style={{ flex: 1 }}>
              <Stack screenOptions={{ headerShown: false }}>
                <Stack.Screen name="index" />
                <Stack.Screen name="auth" />
                <Stack.Screen name="auth-popup" />
                <Stack.Screen name="auth-callback" />
                <Stack.Screen name="onboarding" />
                <Stack.Screen name="coach-onboarding" />
                <Stack.Screen name="coach-welcome-onboarding" />
                <Stack.Screen name="paywall" />
                <Stack.Screen name="(app)" />
              </Stack>
              <SystemBars style="auto" />
            </GestureHandlerRootView>
          </TipsProvider>
        </SubscriptionProvider>
        </AuthProvider>
      </ThemeProvider>
    </>
  );
}
