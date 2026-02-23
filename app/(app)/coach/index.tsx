
import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from "react-native";
import * as Clipboard from 'expo-clipboard';
import Modal from "react-native-modal";
import { useTheme } from "@react-navigation/native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "@/contexts/AuthContext";
import { IconSymbol } from "@/components/IconSymbol";
import { useRouter } from "expo-router";
import { supabase } from "@/lib/supabase";
import { bcctColors, bcctTypography } from "@/styles/bcctTheme";
import { LinearGradient } from "expo-linear-gradient";

interface DashboardStats {
  clientsCount: number;
  activeProgramsCount: number;
  todayAppointmentsCount: number;
}

export default function CoachDashboardScreen() {
  const { colors } = useTheme();
  const { user, session } = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<DashboardStats>({
    clientsCount: 0,
    activeProgramsCount: 0,
    todayAppointmentsCount: 0,
  });
  const [profile, setProfile] = useState<any>(null);
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
    console.log("[Coach Dashboard] Fetching dashboard data");
    try {
      if (!session?.user?.id) {
        console.error("[Coach Dashboard] No user session");
        return;
      }

      // Fetch profile with invite_code
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', session.user.id)
        .single();

      if (profileError) {
        console.error("[Coach Dashboard] Profile fetch error:", profileError);
      } else {
        console.log("[Coach Dashboard] Profile loaded:", profileData);
        setProfile(profileData);
      }

      // TODO: Fetch clients count from coach_clients table
      // Count rows where coach_id = auth.uid()
      const { count: clientsCount, error: clientsError } = await supabase
        .from('coach_clients')
        .select('*', { count: 'exact', head: true })
        .eq('coach_id', session.user.id);

      if (clientsError) {
        console.error("[Coach Dashboard] Clients count error:", clientsError);
      } else {
        console.log("[Coach Dashboard] Clients count:", clientsCount);
      }

      // TODO: Fetch active programs count
      // This requires joining coach_clients with client_programs
      // For now, we'll set to 0 and add a TODO comment
      const activeProgramsCount = 0;

      // TODO: Fetch today's appointments count
      // Count appointments where coach_id = auth.uid() and date = today
      const today = new Date().toISOString().split('T')[0];
      const { count: appointmentsCount, error: appointmentsError } = await supabase
        .from('appointments')
        .select('*', { count: 'exact', head: true })
        .eq('coach_id', session.user.id)
        .gte('scheduled_at', `${today}T00:00:00`)
        .lt('scheduled_at', `${today}T23:59:59`);

      if (appointmentsError) {
        console.error("[Coach Dashboard] Appointments count error:", appointmentsError);
      } else {
        console.log("[Coach Dashboard] Today's appointments count:", appointmentsCount);
      }

      setStats({
        clientsCount: clientsCount || 0,
        activeProgramsCount: activeProgramsCount,
        todayAppointmentsCount: appointmentsCount || 0,
      });
    } catch (error: any) {
      console.error("[Coach Dashboard] Error fetching dashboard data", error);
      showModal("Fout", "Kon dashboardgegevens niet laden");
    } finally {
      setLoading(false);
    }
  };

  const handleCopyInviteCode = async () => {
    if (!profile?.invite_code) {
      showModal("Geen code", "Je hebt nog geen coachcode. Neem contact op met support.");
      return;
    }

    try {
      await Clipboard.setStringAsync(profile.invite_code);
      showModal("Gekopieerd!", `Code ${profile.invite_code} is gekopieerd naar het klembord.`);
    } catch (error) {
      console.error("[Coach Dashboard] Copy error:", error);
      showModal("Fout", "Kon code niet kopiëren");
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={["top"]}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={bcctColors.primaryOrange} />
        </View>
      </SafeAreaView>
    );
  }

  const fullName = profile?.full_name || user?.user_metadata?.full_name || "Coach";
  const welcomeText = `Welkom terug, ${fullName}`;

  const clientsCountText = stats.clientsCount.toString();
  const activeProgramsCountText = stats.activeProgramsCount.toString();
  const todayAppointmentsCountText = stats.todayAppointmentsCount.toString();

  const todayStats = [
    { label: "Cliënten", value: clientsCountText, icon: "group" as const },
    { label: "Actieve programma's", value: activeProgramsCountText, icon: "school" as const },
    { label: "Afspraken vandaag", value: todayAppointmentsCountText, icon: "event" as const },
  ];

  const quickActions = [
    {
      id: "clients",
      title: "Cliënten",
      subtitle: "Bekijk en beheer je cliënten",
      icon: "group" as const,
      route: "/(app)/coach/clients" as const,
    },
    {
      id: "modules",
      title: "Modules",
      subtitle: "Beheer thema's en vragen",
      icon: "folder" as const,
      route: "/(app)/coach/modules" as const,
    },
    {
      id: "insights",
      title: "Inzichten",
      subtitle: "Bekijk grafieken en patronen",
      icon: "insights" as const,
      route: null,
    },
  ];

  return (
    <>
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={["top"]}>
        <ScrollView 
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <Text style={[styles.headerTitle, { color: colors.text }]}>Coach Dashboard</Text>
              <Text style={[styles.headerSubtitle, { color: bcctColors.textSecondary }]}>
                {welcomeText}
              </Text>
            </View>
            <TouchableOpacity
              style={[styles.settingsButton, { backgroundColor: colors.card, borderColor: colors.border }]}
              onPress={() => router.push("/(app)/coach/settings" as any)}
            >
              <IconSymbol
                ios_icon_name="gear"
                android_material_icon_name="settings"
                size={24}
                color={colors.text}
              />
            </TouchableOpacity>
          </View>

          {/* Vandaag Section */}
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Vandaag</Text>
            <View style={styles.statsRow}>
              {todayStats.map((stat, index) => (
                <React.Fragment key={index}>
                <View style={[styles.statCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                  <IconSymbol
                    ios_icon_name="star"
                    android_material_icon_name={stat.icon}
                    size={24}
                    color={bcctColors.primaryOrange}
                  />
                  <Text style={[styles.statValue, { color: colors.text }]}>{stat.value}</Text>
                  <Text style={[styles.statLabel, { color: bcctColors.textSecondary }]}>
                    {stat.label}
                  </Text>
                </View>
                </React.Fragment>
              ))}
            </View>
          </View>

          {/* Snelle Acties Section */}
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Snelle Acties</Text>
            <View style={styles.actionsList}>
              {quickActions.map((action) => (
                <React.Fragment key={action.id}>
                <TouchableOpacity
                  style={[styles.actionCard, { backgroundColor: colors.card, borderColor: colors.border }]}
                  onPress={() => {
                    if (action.route) {
                      router.push(action.route);
                    } else {
                      console.log("Action pressed:", action.id);
                      showModal("Binnenkort", "Deze functie komt binnenkort beschikbaar.");
                    }
                  }}
                  activeOpacity={0.7}
                >
                  <View style={[styles.actionIconContainer, { backgroundColor: bcctColors.primaryOrange + "20" }]}>
                    <IconSymbol
                      ios_icon_name="star"
                      android_material_icon_name={action.icon}
                      size={24}
                      color={bcctColors.primaryOrange}
                    />
                  </View>
                  <View style={styles.actionContent}>
                    <Text style={[styles.actionTitle, { color: colors.text }]}>{action.title}</Text>
                    <Text style={[styles.actionSubtitle, { color: bcctColors.textSecondary }]}>
                      {action.subtitle}
                    </Text>
                  </View>
                  <IconSymbol
                    ios_icon_name="chevron.right"
                    android_material_icon_name="chevron-right"
                    size={20}
                    color={bcctColors.textSecondary}
                  />
                </TouchableOpacity>
                </React.Fragment>
              ))}
            </View>
          </View>

          {/* Tip Card */}
          <View style={[styles.tipCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.tipHeader}>
              <IconSymbol
                ios_icon_name="lightbulb"
                android_material_icon_name="lightbulb"
                size={20}
                color={bcctColors.primaryOrange}
              />
              <Text style={[styles.tipTitle, { color: colors.text }]}>Tip</Text>
            </View>
            <Text style={[styles.tipText, { color: bcctColors.textSecondary }]}>
              Nodig een cliënt uit met een coachcode.
            </Text>
            <TouchableOpacity onPress={handleCopyInviteCode}>
              <LinearGradient
                colors={[bcctColors.primaryOrange, bcctColors.primaryOrangeDark]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.tipButton}
              >
                <Text style={styles.tipButtonText}>Kopieer coachcode</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>

          {/* Bottom padding for tab bar */}
          <View style={{ height: 100 }} />
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
    alignItems: "flex-start",
    marginBottom: 32,
    marginTop: 8,
  },
  headerLeft: {
    flex: 1,
  },
  headerTitle: {
    ...bcctTypography.h1,
    marginBottom: 4,
  },
  headerSubtitle: {
    ...bcctTypography.small,
  },
  settingsButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 1,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  section: {
    marginBottom: 32,
  },
  sectionTitle: {
    ...bcctTypography.h3,
    marginBottom: 16,
  },
  statsRow: {
    flexDirection: "row",
    gap: 12,
  },
  statCard: {
    flex: 1,
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
  statValue: {
    ...bcctTypography.h1,
  },
  statLabel: {
    ...bcctTypography.small,
    textAlign: "center",
  },
  actionsList: {
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
  actionIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: "center",
    alignItems: "center",
  },
  actionContent: {
    flex: 1,
    gap: 4,
  },
  actionTitle: {
    ...bcctTypography.bodyMedium,
  },
  actionSubtitle: {
    ...bcctTypography.small,
  },
  tipCard: {
    padding: 20,
    borderRadius: 16,
    borderWidth: 1,
    gap: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  tipHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  tipTitle: {
    ...bcctTypography.bodyMedium,
  },
  tipText: {
    ...bcctTypography.body,
  },
  tipButton: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 12,
    alignItems: "center",
  },
  tipButtonText: {
    color: "#fff",
    ...bcctTypography.button,
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
