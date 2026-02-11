
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

interface Organization {
  id: string;
  name: string;
}

interface OrgStats {
  memberCount: number;
  coachCount: number;
  clientCount: number;
  totalCheckinsCount: number;
  totalAppointmentsCount: number;
}

export default function OrgAdminDashboardScreen() {
  const { colors } = useTheme();
  const { user, signOut } = useAuth();
  const router = useRouter();
  const [signingOut, setSigningOut] = useState(false);
  const [loading, setLoading] = useState(true);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [orgStats, setOrgStats] = useState<OrgStats | null>(null);
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
    console.log("[OrgAdmin] Fetching dashboard data");
    try {
      // Fetch organizations
      const orgsData = await authenticatedGet<Organization[]>("/api/org/organizations");
      console.log("[OrgAdmin] Organizations loaded", orgsData);
      setOrganizations(orgsData);

      // Fetch stats for first organization if available
      if (orgsData.length > 0) {
        const statsData = await authenticatedGet<OrgStats>(`/api/org/organizations/${orgsData[0].id}/stats`);
        console.log("[OrgAdmin] Stats loaded", statsData);
        setOrgStats(statsData);
      }
    } catch (error: any) {
      console.error("[OrgAdmin] Error fetching dashboard data", error);
      showModal("Fout", "Kon dashboardgegevens niet laden");
    } finally {
      setLoading(false);
    }
  };

  const handleSignOut = async () => {
    console.log("[OrgAdmin] Sign out requested");
    setSigningOut(true);
    try {
      await signOut();
      console.log("[OrgAdmin] Sign out successful");
      router.replace("/auth");
    } catch (error: any) {
      console.error("[OrgAdmin] Sign out error", error);
      showModal("Fout", "Uitloggen mislukt");
    } finally {
      setSigningOut(false);
    }
  };

  const stats = [
    { label: "Organisaties", value: organizations.length.toString(), icon: "business" as const, color: "#6366f1" },
    { label: "Totaal Leden", value: orgStats?.memberCount.toString() || "0", icon: "group" as const, color: "#10b981" },
    { label: "Actieve Coaches", value: orgStats?.coachCount.toString() || "0", icon: "person" as const, color: "#f59e0b" },
    { label: "Actieve Cliënten", value: orgStats?.clientCount.toString() || "0", icon: "people" as const, color: "#ef4444" },
  ];

  const quickActions = [
    {
      id: "organizations",
      title: "Organisaties",
      description: "Beheer organisaties",
      icon: "business" as const,
    },
    {
      id: "members",
      title: "Leden",
      description: "Bekijk en beheer leden",
      icon: "group" as const,
    },
    {
      id: "stats",
      title: "Statistieken",
      description: "Bekijk geaggregeerde gegevens",
      icon: "bar-chart" as const,
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
              <Text style={[styles.greeting, { color: colors.text, opacity: 0.7 }]}>Admin Dashboard</Text>
              <Text style={[styles.name, { color: colors.text }]}>{user?.name || "Organisatie"}</Text>
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
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Overzicht</Text>
          <View style={styles.statsGrid}>
            {stats.map((stat, index) => (
              <View key={index} style={[styles.statCard, { backgroundColor: colors.card }]}>
                <View style={[styles.statIcon, { backgroundColor: stat.color + "20" }]}>
                  <IconSymbol
                    ios_icon_name="star"
                    android_material_icon_name={stat.icon}
                    size={24}
                    color={stat.color}
                  />
                </View>
                <Text style={[styles.statValue, { color: colors.text }]}>{stat.value}</Text>
                <Text style={[styles.statLabel, { color: colors.text, opacity: 0.6 }]}>
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
                style={[styles.actionCard, { backgroundColor: colors.card }]}
                onPress={() => console.log("Action pressed:", action.id)}
              >
                <IconSymbol
                  ios_icon_name="star"
                  android_material_icon_name={action.icon}
                  size={28}
                  color={colors.primary}
                />
                <View style={styles.actionContent}>
                  <Text style={[styles.actionTitle, { color: colors.text }]}>{action.title}</Text>
                  <Text style={[styles.actionDescription, { color: colors.text, opacity: 0.6 }]}>
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

        <View style={[styles.privacyNotice, { backgroundColor: colors.primary + "20" }]}>
          <IconSymbol
            ios_icon_name="lock.shield"
            android_material_icon_name="lock"
            size={24}
            color={colors.primary}
          />
          <Text style={[styles.privacyText, { color: colors.text }]}>
            Privacy Beschermd: Je kunt alleen geaggregeerde statistieken bekijken. Individuele cliëntgegevens zijn niet toegankelijk.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={[styles.infoText, { color: colors.text, opacity: 0.6 }]}>
            Dit is je organisatie admin dashboard. Beheer organisaties, leden, en bekijk
            privacy-beschermde geaggregeerde statistieken.
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
  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  statCard: {
    width: "48%",
    padding: 16,
    borderRadius: 16,
    alignItems: "center",
    gap: 8,
  },
  statIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: "center",
    alignItems: "center",
  },
  statValue: {
    fontSize: 28,
    fontWeight: "bold",
  },
  statLabel: {
    fontSize: 12,
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
    gap: 16,
  },
  actionContent: {
    flex: 1,
    gap: 4,
  },
  actionTitle: {
    fontSize: 16,
    fontWeight: "600",
  },
  actionDescription: {
    fontSize: 14,
  },
  privacyNotice: {
    flexDirection: "row",
    padding: 16,
    borderRadius: 12,
    gap: 12,
    marginBottom: 24,
  },
  privacyText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
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
