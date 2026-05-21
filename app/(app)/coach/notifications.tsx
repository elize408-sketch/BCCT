
import React, { useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Stack, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import { bcctColors } from "@/styles/bcctTheme";

interface Notification {
  id: string;
  user_id: string;
  type: string;
  title: string;
  message: string;
  related_id: string | null;
  related_type: string | null;
  is_read: boolean;
  created_at: string;
}

interface Section {
  title: string;
  data: Notification[];
}

const ICON_MAP: Record<string, keyof typeof Ionicons.glyphMap> = {
  appointment: "calendar-outline",
  message: "chatbubble-outline",
  payment: "card-outline",
  homework: "book-outline",
};

const ROUTE_MAP: Record<string, string> = {
  appointment: "/(app)/coach/appointments",
  client: "/(app)/coach/clients",
  payment: "/(app)/coach/billing",
  message: "/(app)/coach/chat",
};

function getNotificationIcon(type: string): keyof typeof Ionicons.glyphMap {
  return ICON_MAP[type] ?? "notifications-outline";
}

function relativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "zojuist";
  if (mins < 60) return `${mins} min geleden`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} uur geleden`;
  const days = Math.floor(hours / 24);
  return `${days} dag${days !== 1 ? "en" : ""} geleden`;
}

function isToday(dateStr: string): boolean {
  const d = new Date(dateStr);
  const now = new Date();
  return (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  );
}

function isThisWeek(dateStr: string): boolean {
  const d = new Date(dateStr);
  const now = new Date();
  const startOfWeek = new Date(now);
  startOfWeek.setHours(0, 0, 0, 0);
  startOfWeek.setDate(now.getDate() - now.getDay());
  return d >= startOfWeek && d <= now;
}

function groupNotifications(notifications: Notification[]): Section[] {
  const today: Notification[] = [];
  const thisWeek: Notification[] = [];
  const older: Notification[] = [];

  for (const n of notifications) {
    if (isToday(n.created_at)) {
      today.push(n);
    } else if (isThisWeek(n.created_at)) {
      thisWeek.push(n);
    } else {
      older.push(n);
    }
  }

  const sections: Section[] = [];
  if (today.length > 0) sections.push({ title: "Vandaag", data: today });
  if (thisWeek.length > 0) sections.push({ title: "Deze week", data: thisWeek });
  if (older.length > 0) sections.push({ title: "Ouder", data: older });
  return sections;
}

function NotificationCard({
  item,
  onPress,
}: {
  item: Notification;
  onPress: (item: Notification) => void;
}) {
  const iconName = getNotificationIcon(item.type);
  const timeText = relativeTime(item.created_at);
  const cardBg = item.is_read ? "#FFFFFF" : "#FFF8F3";

  return (
    <TouchableOpacity
      style={[styles.card, { backgroundColor: cardBg }]}
      onPress={() => onPress(item)}
      activeOpacity={0.75}
    >
      {!item.is_read && <View style={styles.unreadDot} />}
      <View style={styles.iconCircle}>
        <Ionicons name={iconName} size={20} color={bcctColors.primaryOrange} />
      </View>
      <View style={styles.cardContent}>
        <Text style={styles.cardTitle}>{item.title}</Text>
        <Text style={styles.cardMessage} numberOfLines={2}>
          {item.message}
        </Text>
        <Text style={styles.cardTime}>{timeText}</Text>
      </View>
    </TouchableOpacity>
  );
}

export default function NotificationsScreen() {
  const { session } = useAuth();
  const router = useRouter();

  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  const userId = session?.user?.id;

  const fetchNotifications = useCallback(async () => {
    if (!userId) return;
    console.log("[Notifications] fetching for user:", userId);
    const { data, error } = await supabase
      .from("notifications")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("[Notifications] fetch error:", error.message);
    } else {
      console.log("[Notifications] loaded", data?.length ?? 0, "notifications");
      setNotifications(data ?? []);
    }
    setLoading(false);
  }, [userId]);

  useFocusEffect(
    useCallback(() => {
      console.log("[Notifications] screen mounted");
      setLoading(true);
      fetchNotifications();
    }, [fetchNotifications])
  );

  const handleMarkAllRead = async () => {
    if (!userId) return;
    console.log("[Notifications] marking all as read");
    const { error } = await supabase
      .from("notifications")
      .update({ is_read: true })
      .eq("user_id", userId)
      .eq("is_read", false);

    if (error) {
      console.error("[Notifications] mark all read error:", error.message);
    } else {
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
    }
  };

  const handleDeleteRead = async () => {
    if (!userId) return;
    Alert.alert(
      "Gelezen verwijderen",
      "Weet je zeker dat je alle gelezen meldingen wilt verwijderen?",
      [
        { text: "Annuleren", style: "cancel" },
        {
          text: "Verwijderen",
          style: "destructive",
          onPress: async () => {
            console.log("[Notifications] deleting read notifications");
            const { error } = await supabase
              .from("notifications")
              .delete()
              .eq("user_id", userId)
              .eq("is_read", true);

            if (error) {
              console.error("[Notifications] delete read error:", error.message);
            } else {
              setNotifications((prev) => prev.filter((n) => !n.is_read));
            }
          },
        },
      ]
    );
  };

  const handleTapNotification = async (item: Notification) => {
    console.log("[Notifications] tapped notification id:", item.id, ", type:", item.type);

    if (!item.is_read) {
      const { error } = await supabase
        .from("notifications")
        .update({ is_read: true })
        .eq("id", item.id);

      if (!error) {
        console.log("[Notifications] marked as read:", item.id);
        setNotifications((prev) =>
          prev.map((n) => (n.id === item.id ? { ...n, is_read: true } : n))
        );
      }
    }

    const route = item.related_type ? ROUTE_MAP[item.related_type] : undefined;
    if (route) {
      console.log("[Notifications] navigating to:", route);
      router.push(route as any);
    }
  };

  const sections = groupNotifications(notifications);

  const renderHeaderRight = () => (
    <View style={styles.headerButtons}>
      <TouchableOpacity
        onPress={() => {
          console.log("[Notifications] header — mark all read pressed");
          handleMarkAllRead();
        }}
        style={styles.headerTextButton}
        activeOpacity={0.7}
      >
        <Text style={styles.headerTextButtonLabel}>Alles gelezen</Text>
      </TouchableOpacity>
      <TouchableOpacity
        onPress={() => {
          console.log("[Notifications] header — delete read pressed");
          handleDeleteRead();
        }}
        style={styles.headerIconButton}
        activeOpacity={0.7}
      >
        <Ionicons name="trash-outline" size={20} color={bcctColors.error} />
      </TouchableOpacity>
    </View>
  );

  return (
    <>
      <Stack.Screen
        options={{
          title: "Notificaties",
          headerShown: true,
          headerBackTitle: "Terug",
          headerRight: renderHeaderRight,
          headerStyle: { backgroundColor: bcctColors.lightBackground },
          headerTitleStyle: { color: bcctColors.textPrimary, fontWeight: "700" },
          headerTintColor: bcctColors.primaryOrange,
        }}
      />
      <SafeAreaView style={styles.container} edges={["bottom"]}>
        {loading ? (
          <View style={styles.centered}>
            <ActivityIndicator size="large" color={bcctColors.primaryOrange} />
          </View>
        ) : sections.length === 0 ? (
          <View style={styles.emptyState}>
            <View style={styles.emptyIconCircle}>
              <Ionicons name="notifications-outline" size={36} color={bcctColors.textSecondary} />
            </View>
            <Text style={styles.emptyTitle}>Nog geen notificaties</Text>
            <Text style={styles.emptyMessage}>
              Meldingen verschijnen hier zodra er activiteit is.
            </Text>
          </View>
        ) : (
          <FlatList
            data={sections}
            keyExtractor={(section) => section.title}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            renderItem={({ item: section }) => (
              <View>
                <Text style={styles.sectionHeader}>{section.title}</Text>
                {section.data.map((notif) => (
                  <NotificationCard
                    key={notif.id}
                    item={notif}
                    onPress={handleTapNotification}
                  />
                ))}
              </View>
            )}
          />
        )}
      </SafeAreaView>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: bcctColors.lightBackground,
  },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  listContent: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 32,
  },
  sectionHeader: {
    fontSize: 11,
    fontWeight: "700",
    color: bcctColors.textSecondary,
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginTop: 16,
    marginBottom: 8,
    marginLeft: 4,
  },
  card: {
    borderRadius: 12,
    marginBottom: 8,
    padding: 14,
    flexDirection: "row",
    alignItems: "flex-start",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: bcctColors.primaryOrange,
    marginTop: 6,
    marginRight: 10,
    flexShrink: 0,
  },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#FFF3E8",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
    flexShrink: 0,
  },
  cardContent: {
    flex: 1,
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: bcctColors.textPrimary,
    marginBottom: 2,
  },
  cardMessage: {
    fontSize: 13,
    color: bcctColors.textSecondary,
    lineHeight: 18,
  },
  cardTime: {
    fontSize: 11,
    color: bcctColors.textSecondary,
    marginTop: 6,
  },
  emptyState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 40,
  },
  emptyIconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: "#F3F4F6",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: bcctColors.textPrimary,
    marginBottom: 8,
    textAlign: "center",
  },
  emptyMessage: {
    fontSize: 14,
    color: bcctColors.textSecondary,
    textAlign: "center",
    lineHeight: 20,
  },
  headerButtons: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  headerTextButton: {
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  headerTextButtonLabel: {
    fontSize: 14,
    color: bcctColors.primaryOrange,
    fontWeight: "600",
  },
  headerIconButton: {
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
});
