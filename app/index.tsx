
import React, { useEffect } from "react";
import { View, ActivityIndicator, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@react-navigation/native";

export default function IndexScreen() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const { colors } = useTheme();

  useEffect(() => {
    console.log("IndexScreen: Auth state changed", { user: user?.id, loading });
    
    if (!loading) {
      if (user) {
        console.log("IndexScreen: User authenticated, redirecting to app");
        router.replace("/(app)");
      } else {
        console.log("IndexScreen: No user, redirecting to auth");
        router.replace("/auth");
      }
    }
  }, [user, loading]);

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
