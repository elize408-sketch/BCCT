import React, { useCallback, useEffect, useRef, useState } from "react";
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
  const [unreadCount, setUnreadCount] = useState(0);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  const fetchUnreadCount = useCallback(async (userId: string) => {
    console.log("[HeaderButtons] Fetching unread notification count for userId:", userId);
    const { count, error } = await supabase
      .from("notifications")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("is_read", false);
    if (error) {
      console.warn("[HeaderButtons] Could not fetch notification count:", error.message);
      return;
    }
    console.log("[HeaderButtons] Unread notifications:", count ?? 0);
    setUnreadCount(count ?? 0);
  }, []);

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

      fetchUnreadCount(user.id);
    }, [user?.id, fetchUnreadCount])
  );

  // Realtime subscription for notifications bell badge
  useEffect(() => {
    if (!user?.id) return;
    const userId = user.id;
    const channelName = `notifications-bell-${userId}`;
    console.log("[HeaderButtons] Subscribing to realtime notifications channel:", channelName);

    const channel = supabase
      .channel(channelName)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          console.log("[HeaderButtons] Realtime notification event:", payload.eventType);
          fetchUnreadCount(userId);
        }
      )
      .subscribe((status) => {
        console.log("[HeaderButtons] Realtime channel status:", status);
      });

    channelRef.current = channel;

    return () => {
      console.log("[HeaderButtons] Unsubscribing from realtime notifications channel:", channelName);
      supabase.removeChannel(channel);
      channelRef.current = null;
    };
  }, [user?.id, fetchUnreadCount]);

  const handleAvatarPress = () => {
    console.log("[HeaderButtons] Avatar pressed — navigating to profiel");
    router.push("/(tabs)/profiel");
  };

  const handleTipsPress = () => {
    console.log("[HeaderButtons] Tips lightbulb icon pressed");
    onTipsPress?.();
  };

  const hasUnread = unreadCount > 0;
  const badgeDisplay = unreadCount > 9 ? "9+" : String(unreadCount);

  return (
    <View style={styles.rightGroup}>
      <Pressable onPress={handleTipsPress} style={styles.headerButtonContainer}>
        <View>
          <Ionicons name="bulb-outline" size={22} color={theme.colors.primary} />
          {hasUnread && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{badgeDisplay}</Text>
            </View>
          )}
        </View>
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
  badge: {
    position: "absolute",
    top: -4,
    right: -6,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: bcctColors.error,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 3,
  },
  badgeText: {
    fontSize: 9,
    fontWeight: "800",
    color: "#fff",
  },
});
