
import React, { useEffect, useState } from "react";
import { View, ActivityIndicator, StyleSheet } from "react-native";
import { Redirect, Stack } from "expo-router";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@react-navigation/native";
import { authenticatedGet } from "@/utils/api";

interface UserProfile {
  id: string;
  email: string;
  name?: string | null;
  phone?: string | null;
  role: "client" | "coach" | "org_admin";
  goals?: string | null;
}

export default function AppLayout() {
  const { user, loading: authLoading } = useAuth();
  const { colors } = useTheme();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    console.log("[AppLayout] Checking auth state", { user: user?.id, authLoading });
    
    if (!authLoading) {
      if (!user) {
        console.log("[AppLayout] No user, should redirect to auth");
        setLoading(false);
        return;
      }

      fetchProfile();
    }
  }, [user, authLoading]);

  const fetchProfile = async () => {
    console.log("[AppLayout] Fetching user profile from GET /api/profile");
    try {
      // Backend Integration: GET /api/profile returns { id, email, name, phone, role, goals }
      const profileData = await authenticatedGet<UserProfile>("/api/profile");
      
      console.log("[AppLayout] Profile loaded successfully", profileData);
      setProfile(profileData);
    } catch (error: any) {
      console.error("[AppLayout] Error fetching profile", error);
      // If profile fetch fails, user might need to complete onboarding
      // or there's an auth issue - let the redirect logic handle it
    } finally {
      setLoading(false);
    }
  };

  if (authLoading || loading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (!user) {
    console.log("AppLayout: Redirecting to auth");
    return <Redirect href="/auth" />;
  }

  if (!profile?.name) {
    console.log("[AppLayout] Profile incomplete, redirecting to onboarding");
    return <Redirect href="/onboarding" />;
  }

  console.log("[AppLayout] Rendering role-based layout", { role: profile.role });

  // Role-based routing
  if (profile.role === "client") {
    return <Redirect href="/(app)/client" />;
  }

  if (profile.role === "coach") {
    return <Redirect href="/(app)/coach" />;
  }

  if (profile.role === "org_admin") {
    return <Redirect href="/(app)/org" />;
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ActivityIndicator size="large" color={colors.primary} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
});
