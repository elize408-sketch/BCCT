
import "react-native-reanimated";
import React, { useEffect } from "react";
import { Stack, usePathname, useRouter } from "expo-router";
import FloatingTabBar, { TabBarItem } from '@/components/FloatingTabBar';
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
import { supabase } from "@/lib/supabase";

// Prevent the splash screen from auto-hiding
SplashScreen.preventAutoHideAsync();

export const unstable_settings = {
  initialRouteName: "index",
};

const TABS: TabBarItem[] = [
  { name: '(home)', route: '/(tabs)/(home)/', icon: 'home', label: 'Home' },
  { name: '(chat)', route: '/(tabs)/(chat)/', icon: 'chat', label: 'Chat' },
  { name: 'appointments', route: '/(tabs)/appointments', icon: 'appointments', label: 'Afspraken' },
  { name: 'profiel', route: '/(tabs)/profiel', icon: 'profiel', label: 'Profiel' },
];


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
      pathname === "/paywall" ||
      pathname === "/stripe-return" ||
      pathname === "/stripe-onboarding-webview";
    if (isExempt) return;

    // NOTE: subscription gate is intentionally disabled.
    // Coaches with subscription_active=false / subscription_plan=null must still
    // reach the app after completing onboarding. The paywall is shown inline
    // on the dashboard instead of as a hard redirect here.
    console.log('[SubscriptionRedirect] isSubscribed:', isSubscribed, '— gate disabled, not redirecting');
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

    // Only fire when on the main tabs area or root index
    const isOnMainTabs = pathname.startsWith('/(tabs)') || pathname === '/';
    if (!isOnMainTabs) return;

    supabase
      .from('profiles')
      .select('id, role, onboarding_completed')
      .eq('id', user.id)
      .single()
      .then(({ data: profile, error }) => {
        if (error) {
          console.warn('[OnboardingRedirect] Could not fetch profile (non-fatal):', error.message);
          return;
        }

        console.log('[Routing] role:', profile?.role, 'onboarding_completed:', profile?.onboarding_completed);

        // Onboarding not completed → send to onboarding regardless of role
        if (!profile?.onboarding_completed || !profile?.role) {
          console.log('[OnboardingRedirect] onboarding incomplete, redirecting to coach-welcome-onboarding');
          router.replace('/coach-welcome-onboarding');
          return;
        }

        // CRITICAL: Coaches must NEVER land on /(tabs) — redirect to coach portal
        if (profile.role === 'coach') {
          console.log('[OnboardingRedirect] Coach detected on /(tabs) — redirecting to coach portal');
          router.replace('/(app)/coach');
          return;
        }

        // Clients stay on /(tabs) — no redirect needed
        console.log('[Routing] Client on tabs — no redirect needed');
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
                <Stack.Screen name="stripe-return" />
                <Stack.Screen name="stripe-onboarding-webview" />
                <Stack.Screen name="(tabs)" />
                <Stack.Screen name="(app)" options={{ presentation: 'card' }} />
              </Stack>
              <SystemBars style="auto" />
              <FloatingTabBar tabs={TABS} />
            </GestureHandlerRootView>
          </TipsProvider>
        </SubscriptionProvider>
        </AuthProvider>
      </ThemeProvider>
    </>
  );
}
