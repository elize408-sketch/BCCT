
import "react-native-reanimated";
import React, { useEffect } from "react";
import { useFonts } from "expo-font";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { SystemBars } from "react-native-edge-to-edge";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { useColorScheme } from "react-native";
import { ThemeProvider } from "@react-navigation/native";
import { StatusBar } from "expo-status-bar";
import { AuthProvider } from "@/contexts/AuthContext";
import { BCCTLightTheme, BCCTDarkTheme } from "@/styles/bcctTheme";
import {
  Baloo2_400Regular,
  Baloo2_500Medium,
  Baloo2_600SemiBold,
  Baloo2_700Bold,
  Baloo2_800ExtraBold,
} from '@expo-google-fonts/baloo-2';
import {
  Poppins_300Light,
  Poppins_400Regular,
  Poppins_500Medium,
  Poppins_600SemiBold,
  Poppins_700Bold,
} from '@expo-google-fonts/poppins';

// Prevent the splash screen from auto-hiding before fonts are loaded
SplashScreen.preventAutoHideAsync();

export const unstable_settings = {
  initialRouteName: "index",
};

export default function RootLayout() {
  const colorScheme = useColorScheme();
  
  // Load custom fonts
  const [fontsLoaded, fontError] = useFonts({
    // Baloo 2 fonts for headings
    'Baloo2_400Regular': Baloo2_400Regular,
    'Baloo2_500Medium': Baloo2_500Medium,
    'Baloo2_600SemiBold': Baloo2_600SemiBold,
    'Baloo2_700Bold': Baloo2_700Bold,
    'Baloo2_800ExtraBold': Baloo2_800ExtraBold,
    // Poppins fonts for body text
    'Poppins_300Light': Poppins_300Light,
    'Poppins_400Regular': Poppins_400Regular,
    'Poppins_500Medium': Poppins_500Medium,
    'Poppins_600SemiBold': Poppins_600SemiBold,
    'Poppins_700Bold': Poppins_700Bold,
    // Keep SpaceMono for backwards compatibility
    'SpaceMono': require("../assets/fonts/SpaceMono-Regular.ttf"),
  });

  useEffect(() => {
    if (fontsLoaded || fontError) {
      console.log('Fonts loaded successfully, hiding splash screen');
      // Hide the splash screen once fonts are loaded or if there's an error
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

  // Log font loading errors
  useEffect(() => {
    if (fontError) {
      console.error('Font loading error:', fontError);
    }
  }, [fontError]);

  // Keep splash screen visible until fonts are loaded
  if (!fontsLoaded && !fontError) {
    console.log('Waiting for fonts to load...');
    return null;
  }

  console.log('Rendering app with theme and fonts');

  return (
    <>
      <StatusBar style="auto" animated />
      <ThemeProvider
        value={colorScheme === "dark" ? BCCTDarkTheme : BCCTLightTheme}
      >
        <AuthProvider>
          <GestureHandlerRootView style={{ flex: 1 }}>
            <Stack screenOptions={{ headerShown: false }}>
              <Stack.Screen name="index" />
              <Stack.Screen name="auth" />
              <Stack.Screen name="auth-popup" />
              <Stack.Screen name="auth-callback" />
              <Stack.Screen name="onboarding" />
              <Stack.Screen name="(app)" />
            </Stack>
            <SystemBars style="auto" />
          </GestureHandlerRootView>
        </AuthProvider>
      </ThemeProvider>
    </>
  );
}
