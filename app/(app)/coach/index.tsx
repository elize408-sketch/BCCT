
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
import { bcctColors, bcctTypography } from "@/styles/bcctTheme";

interface CoachClient {
  id: string;
  name: string;
  status: string;
  alerts?: string[];
}

export default function CoachDashboardScreen() {
  const { colors } = useTheme();
  const { user, signOut } = useAuth();
  const router = useRouter();
  const [signingOut, setSigningOut] = useState(false);
  const [loading, setLoading] = useState(true);
  const [clients, setClients] = useState<CoachClient[]>([]);
  const [programs, setPrograms] = useState<any[]>([]);
  const [appointments, setAppointments] = useState<any[]>([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [modalTitle, setModalTitle] = useState("");
  const [modalMessage, setModalMessage] = useState("");

  const showModal = (title: string, message: string) => {
    setModalTitle(title);
    setModalMessage(message);
    setModalVisible(true);
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    console.log("[Coach] Fetching dashboard data");
    try {
      const clientsData = await authenticatedGet<CoachClient[]>("/api/coach/clients");
      console.log("[Coach] Clients loaded", clientsData);
      setClients(clientsData);

      const programsData = await authenticatedGet<any[]>("/api/coach/programs");
      console.log("[Coach] Programs loaded", programsData);
      setPrograms(programsData);

      const appointmentsData = await authenticatedGet<any[]>("/api/coach/appointments");
      console.log("[Coach] Appointments loaded", appointmentsData);
      setAppointments(appointmentsData);
    } catch (error: any) {
      console.error("[Coach] Error fetching dashboard data", error);
      showModal("Fout", "Kon dashboardgegevens niet laden");
    } finally {
      setLoading(false);
    }
  };

  const handleSignOut = async () => {
    console.log("[Coach] Sign out requested");
    setSigningOut(true);
    try {
      await signOut();
      console.log("[Coach] Sign out successful");
      router.replace("/auth");
    } catch (error: any) {
      console.error("[Coach] Sign out error", error);
      showModal("Fout", "Uitloggen mislukt");
    } finally {
      setSigningOut(false);
    }
  };

  const activeClients = clients.filter(c => c.status === "active").length;
  const clientsWithAlerts = clients.filter(c => c.alerts && c.alerts.length > 0).length;

  const activeClientsText = activeClients.toString();
  const clientsWithAlertsText = clientsWithAlerts.toString();
  const programsCountText = programs.length.toString();
  const appointmentsCountText = appointments.length.toString();

  const stats = [
    { label: "Actieve Cliënten", value: activeClientsText, icon: "person" as const, color: "#6366f1" },
    { label: "Waarschuwingen", value: clientsWithAlertsText, icon: "warning" as const, color: "#ef4444" },
    { label: "Programma's", value: programsCountText, icon: "school" as const, color: "#10b981" },
    { label: "Afspraken", value: appointmentsCountText, icon: "calendar-today" as const, color: "#f59e0b" },
  ];

  const quickActions = [
    {
      id: "clients",
      title: "Bekijk Cliënten",
      description: "Beheer je cliëntenlijst",
      icon: "group" as const,
      route: "/(app)/coach/clients" as const,
    },
    {
      id: "modules",
      title: "Modules",
      description: "Beheer thema's en vragen",
      icon: "folder" as const,
      route: "/(app)/coach/modules" as const,
    },
    {
      id: "programs",
      title: "Programma's",
      description: "Maak en beheer programma's",
      icon: "school" as const,
      route: null,
    },
    {
      id: "appointments",
      title: "Afspraken",
      description: "Plan en beheer sessies",
      icon: "event" as const,
      route: null,
    },
  ];

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={["top"]}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={bcctColors.primaryOrange} />
        </View>
      </SafeAreaView>
    );
  }

  const greetingText = "Coach Dashboard";
  const userName = user?.name || "Welkom";

  return (
    <>
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={["top"]}>
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <View style={styles.header}>
            <View>
              <Text style={[styles.greeting, { color: bcctColors.textSecondary }]}>{greetingText}</Text>
              <Text style={[styles.name, { color: colors.text }]}>{userName}</Text>
            </View>
            <TouchableOpacity
              style={[styles.signOutButton, { backgroundColor: colors.card, borderColor: colors.border }]}
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
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Overzicht</Text>
          <View style={styles.statsGrid}>
            {stats.map((stat, index) => (
              <View key={index} style={[styles.statCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <View style={[styles.statIcon, { backgroundColor: stat.color + "20" }]}>
                  <IconSymbol
                    ios_icon_name="star"
                    android_material_icon_name={stat.icon}
                    size={24}
                    color={stat.color}
                  />
                </View>
                <Text style={[styles.statValue, { color: colors.text }]}>{stat.value}</Text>
                <Text style={[styles.statLabel, { color: bcctColors.textSecondary }]}>
                  {stat.label}
                </Text>
              </View>
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Snelle Acties</Text>
          <View style={styles.actionsGrid}>
            {quickActions.map((action) => (
              <TouchableOpacity
                key={action.id}
                style={[styles.actionCard, { backgroundColor: colors.card, borderColor: colors.border }]}
                onPress={() => {
                  if (action.route) {
                    router.push(action.route);
                  } else {
                    console.log("Action pressed:", action.id);
                  }
                }}
              >
                <IconSymbol
                  ios_icon_name="star"
                  android_material_icon_name={action.icon}
                  size={28}
                  color={bcctColors.primaryOrange}
                />
                <View style={styles.actionContent}>
                  <Text style={[styles.actionTitle, { color: colors.text }]}>{action.title}</Text>
                  <Text style={[styles.actionDescription, { color: bcctColors.textSecondary }]}>
                    {action.description}
                  </Text>
                </View>
                <IconSymbol
                  ios_icon_name="chevron.right"
                  android_material_icon_name="chevron-right"
                  size={20}
                  color={colors.text}
                  style={{ opacity: 0.4 }}
                />
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={[styles.infoText, { color: bcctColors.textSecondary }]}>
            Dit is je coach dashboard. Beheer je cliënten, maak programma&apos;s, plan afspraken,
            en monitor de voortgang van cliënten.
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
      <View style={[styles.modalContent, { backgroundColor: colors.card }]}>
        <Text style={[styles.modalTitle, { color: bcctColors.primaryOrange }]}>{modalTitle}</Text>
        <Text style={[styles.modalMessage, { color: bcctColors.textSecondary }]}>{modalMessage}</Text>
        <TouchableOpacity
          style={[styles.modalButton, { backgroundColor: bcctColors.primaryOrange }]}
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
    marginTop: 20,
  },
  greeting: {
    ...bcctTypography.small,
    marginBottom: 4,
  },
  name: {
    ...bcctTypography.h1,
  },
  signOutButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  section: {
    marginBottom: 32,
  },
  sectionTitle: {
    ...bcctTypography.h3,
    marginBottom: 16,
  },
  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  statCard: {
    width: "48%",
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: "center",
    gap: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  statIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: "center",
    alignItems: "center",
  },
  statValue: {
    ...bcctTypography.h1,
  },
  statLabel: {
    ...bcctTypography.small,
    textAlign: "center",
  },
  actionsGrid: {
    gap: 12,
  },
  actionCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    gap: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  actionContent: {
    flex: 1,
    gap: 4,
  },
  actionTitle: {
    ...bcctTypography.bodyMedium,
  },
  actionDescription: {
    ...bcctTypography.small,
  },
  infoText: {
    ...bcctTypography.body,
    lineHeight: 24,
  },
  modalContent: {
    borderRadius: 20,
    padding: 24,
    alignItems: "center",
  },
  modalTitle: {
    ...bcctTypography.h3,
    marginBottom: 12,
  },
  modalMessage: {
    ...bcctTypography.body,
    textAlign: "center",
    marginBottom: 24,
  },
  modalButton: {
    borderRadius: 12,
    paddingHorizontal: 32,
    paddingVertical: 12,
    minWidth: 100,
  },
  modalButtonText: {
    color: "#fff",
    ...bcctTypography.button,
    textAlign: "center",
  },
});
