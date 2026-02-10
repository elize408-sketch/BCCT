
import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from "react-native";
import Modal from "react-native-modal";
import { useTheme } from "@react-navigation/native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "@/contexts/AuthContext";
import { IconSymbol } from "@/components/IconSymbol";
import { useRouter } from "expo-router";
import { authenticatedGet } from "@/utils/api";

interface HomeData {
  checkinStatus: string | null;
  currentWeek: any | null;
  nextTask: any | null;
  nextAppointment: any | null;
  unreadChatCount: number;
}

export default function ClientHomeScreen() {
  const { colors } = useTheme();
  const { user, signOut } = useAuth();
  const router = useRouter();
  const [signingOut, setSigningOut] = useState(false);
  const [loading, setLoading] = useState(true);
  const [homeData, setHomeData] = useState<HomeData | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [modalTitle, setModalTitle] = useState("");
  const [modalMessage, setModalMessage] = useState("");

  const showModal = (title: string, message: string) => {
    setModalTitle(title);
    setModalMessage(message);
    setModalVisible(true);
  };

  useEffect(() => {
    fetchHomeData();
  }, []);

  const fetchHomeData = async () => {
    console.log("[Client] Fetching home data from GET /api/client/home");
    try {
      const data = await authenticatedGet<HomeData>("/api/client/home");
      console.log("[Client] Home data loaded", data);
      setHomeData(data);
    } catch (error: any) {
      console.error("[Client] Error fetching home data", error);
      showModal("Error", "Failed to load home data");
    } finally {
      setLoading(false);
    }
  };

  const handleSignOut = async () => {
    console.log("[Client] Sign out requested");
    setSigningOut(true);
    try {
      await signOut();
      console.log("[Client] Sign out successful");
      router.replace("/auth");
    } catch (error: any) {
      console.error("[Client] Sign out error", error);
      showModal("Error", "Failed to sign out");
    } finally {
      setSigningOut(false);
    }
  };

  const quickActions = [
    {
      id: "checkin",
      title: "Daily Check-in",
      description: "Log your stress, energy, sleep & mood",
      icon: "favorite" as const,
      color: "#ef4444",
    },
    {
      id: "program",
      title: "My Program",
      description: "Continue your coaching journey",
      icon: "school" as const,
      color: "#6366f1",
    },
    {
      id: "chat",
      title: "Chat with Coach",
      description: "Send a message to your coach",
      icon: "chat" as const,
      color: "#10b981",
    },
    {
      id: "appointments",
      title: "Appointments",
      description: "View upcoming sessions",
      icon: "calendar-today" as const,
      color: "#f59e0b",
    },
  ];

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={["top"]}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <>
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={["top"]}>
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <View style={styles.header}>
            <View>
              <Text style={[styles.greeting, { color: colors.text, opacity: 0.7 }]}>Welcome back</Text>
              <Text style={[styles.name, { color: colors.text }]}>{user?.name || "Client"}</Text>
            </View>
            <TouchableOpacity
              style={[styles.signOutButton, { backgroundColor: colors.card }]}
              onPress={handleSignOut}
              disabled={signingOut}
            >
              <IconSymbol
                ios_icon_name="arrow.right.square"
                android_material_icon_name="logout"
                size={24}
                color={colors.text}
              />
            </TouchableOpacity>
          </View>

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Quick Actions</Text>
          <View style={styles.actionsGrid}>
            {quickActions.map((action) => (
              <TouchableOpacity
                key={action.id}
                style={[styles.actionCard, { backgroundColor: colors.card }]}
                onPress={() => console.log("Action pressed:", action.id)}
              >
                <View style={[styles.actionIcon, { backgroundColor: action.color + "20" }]}>
                  <IconSymbol
                    ios_icon_name="star"
                    android_material_icon_name={action.icon}
                    size={28}
                    color={action.color}
                  />
                </View>
                <Text style={[styles.actionTitle, { color: colors.text }]}>{action.title}</Text>
                <Text style={[styles.actionDescription, { color: colors.text, opacity: 0.6 }]}>
                  {action.description}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Today&apos;s Overview</Text>
          <View style={[styles.overviewCard, { backgroundColor: colors.card }]}>
            <View style={styles.overviewItem}>
              <IconSymbol
                ios_icon_name="checkmark.circle"
                android_material_icon_name="check-circle"
                size={24}
                color="#10b981"
              />
              <View style={styles.overviewText}>
                <Text style={[styles.overviewLabel, { color: colors.text, opacity: 0.7 }]}>
                  Check-in Status
                </Text>
                <Text style={[styles.overviewValue, { color: colors.text }]}>
                  {homeData?.checkinStatus || "Not completed"}
                </Text>
              </View>
            </View>
            <View style={[styles.divider, { backgroundColor: colors.border }]} />
            <View style={styles.overviewItem}>
              <IconSymbol
                ios_icon_name="calendar"
                android_material_icon_name="event"
                size={24}
                color="#6366f1"
              />
              <View style={styles.overviewText}>
                <Text style={[styles.overviewLabel, { color: colors.text, opacity: 0.7 }]}>
                  Next Appointment
                </Text>
                <Text style={[styles.overviewValue, { color: colors.text }]}>
                  {homeData?.nextAppointment ? "Scheduled" : "No upcoming"}
                </Text>
              </View>
            </View>
            {homeData && homeData.unreadChatCount > 0 && (
              <>
                <View style={[styles.divider, { backgroundColor: colors.border }]} />
                <View style={styles.overviewItem}>
                  <IconSymbol
                    ios_icon_name="message"
                    android_material_icon_name="chat"
                    size={24}
                    color="#f59e0b"
                  />
                  <View style={styles.overviewText}>
                    <Text style={[styles.overviewLabel, { color: colors.text, opacity: 0.7 }]}>
                      Unread Messages
                    </Text>
                    <Text style={[styles.overviewValue, { color: colors.text }]}>
                      {homeData.unreadChatCount}
                    </Text>
                  </View>
                </View>
              </>
            )}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={[styles.infoText, { color: colors.text, opacity: 0.6 }]}>
            This is your client dashboard. Complete your daily check-in, work on your program tasks,
            and stay connected with your coach.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>

    <Modal
      isVisible={modalVisible}
      onBackdropPress={() => setModalVisible(false)}
      onBackButtonPress={() => setModalVisible(false)}
      animationIn="fadeIn"
      animationOut="fadeOut"
      backdropOpacity={0.5}
    >
      <View style={styles.modalContent}>
        <Text style={styles.modalTitle}>{modalTitle}</Text>
        <Text style={styles.modalMessage}>{modalMessage}</Text>
        <TouchableOpacity
          style={styles.modalButton}
          onPress={() => setModalVisible(false)}
        >
          <Text style={styles.modalButtonText}>OK</Text>
        </TouchableOpacity>
      </View>
    </Modal>
  </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  scrollContent: {
    padding: 20,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 32,
  },
  greeting: {
    fontSize: 14,
    marginBottom: 4,
  },
  name: {
    fontSize: 28,
    fontWeight: "bold",
  },
  signOutButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: "center",
    alignItems: "center",
  },
  section: {
    marginBottom: 32,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: "bold",
    marginBottom: 16,
  },
  actionsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  actionCard: {
    width: "48%",
    padding: 16,
    borderRadius: 16,
    gap: 8,
  },
  actionIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 4,
  },
  actionTitle: {
    fontSize: 16,
    fontWeight: "600",
  },
  actionDescription: {
    fontSize: 12,
  },
  overviewCard: {
    padding: 20,
    borderRadius: 16,
    gap: 16,
  },
  overviewItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
  },
  overviewText: {
    flex: 1,
    gap: 4,
  },
  overviewLabel: {
    fontSize: 14,
  },
  overviewValue: {
    fontSize: 18,
    fontWeight: "600",
  },
  divider: {
    height: 1,
  },
  infoText: {
    fontSize: 14,
    lineHeight: 20,
  },
  modalContent: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 24,
    alignItems: "center",
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "bold",
    marginBottom: 12,
    color: "#ef4444",
  },
  modalMessage: {
    fontSize: 16,
    textAlign: "center",
    marginBottom: 24,
    color: "#666",
  },
  modalButton: {
    backgroundColor: "#ef4444",
    paddingHorizontal: 32,
    paddingVertical: 12,
    borderRadius: 8,
    minWidth: 100,
  },
  modalButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
    textAlign: "center",
  },
});
