import React, { useCallback, useState } from "react";
import { Pressable, StyleSheet, Alert, View, Image, Text } from "react-native";
import { IconSymbol } from "@/components/IconSymbol";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "@react-navigation/native";
import { useFocusEffect, useRouter } from "expo-router";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { bcctColors } from "@/styles/bcctTheme";

interface HeaderRightButtonProps {
  onTipsPress?: () => void;
}

export function HeaderRightButton({ onTipsPress }: HeaderRightButtonProps) {
  const theme = useTheme();
  const router = useRouter();
  const { user } = useAuth();
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [initials, setInitials] = useState<string>("?");

  useFocusEffect(
    useCallback(() => {
      if (!user?.id) return;
      console.log("[HeaderButtons] Fetching profile for avatar, userId:", user.id);
      supabase
        .from("profiles")
        .select("avatar_url, full_name, updated_at")
        .eq("id", user.id)
        .single()
        .then(({ data, error }) => {
          if (error) {
            console.warn("[HeaderButtons] Could not fetch profile:", error.message);
            return;
          }
          console.log("[HeaderButtons] Profile fetched, avatar_url:", data?.avatar_url);
          setAvatarUrl(data?.avatar_url || null);
          setUpdatedAt(data?.updated_at || null);
          if (data?.full_name) {
            const parts = (data.full_name as string).trim().split(" ");
            setInitials(parts.map((p: string) => p[0]).join("").toUpperCase().slice(0, 2));
          }
        });
    }, [user?.id])
  );

  const handleAvatarPress = () => {
    console.log("[HeaderButtons] Avatar pressed — navigating to profiel");
    router.push("/(tabs)/profiel");
  };

  const handleTipsPress = () => {
    console.log("[HeaderButtons] Tips lightbulb icon pressed");
    onTipsPress?.();
  };

  return (
    <View style={styles.rightGroup}>
      <Pressable onPress={handleTipsPress} style={styles.headerButtonContainer}>
        <Ionicons name="bulb-outline" size={22} color={theme.colors.primary} />
      </Pressable>
      <Pressable
        onPress={handleAvatarPress}
        accessibilityLabel="Open profiel"
        style={styles.avatarButton}
      >
        {avatarUrl ? (
          <Image
            source={{ uri: `${avatarUrl}${avatarUrl.includes('?') ? '&' : '?'}t=${updatedAt ? new Date(updatedAt).getTime() : Date.now()}` }}
            style={styles.avatarImage}
          />
        ) : (
          <Text style={styles.avatarInitials}>{initials}</Text>
        )}
      </Pressable>
    </View>
  );
}

export function HeaderLeftButton() {
  const theme = useTheme();

  return (
    <Pressable
      onPress={() => Alert.alert("Not Implemented", "This feature is not implemented yet")}
      style={styles.headerButtonContainer}
    >
      <IconSymbol ios_icon_name="gear" android_material_icon_name="settings" color={theme.colors.primary} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  rightGroup: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  headerButtonContainer: {
    padding: 6,
  },
  avatarButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: bcctColors.primaryOrangeLight,
    borderWidth: 2,
    borderColor: bcctColors.primaryOrange,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    marginLeft: 4,
  },
  avatarImage: {
    width: 36,
    height: 36,
    borderRadius: 18,
  },
  avatarInitials: {
    fontSize: 13,
    fontWeight: "700",
    color: "#fff",
    letterSpacing: 0.5,
  },
});
