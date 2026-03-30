
import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  useWindowDimensions,
} from "react-native";
import Modal from "react-native-modal";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "@/contexts/AuthContext";
import { useRouter } from "expo-router";
import { supabase } from "@/lib/supabase";
import { bcctColors, bcctTypography } from "@/styles/bcctTheme";
import { LinearGradient } from "expo-linear-gradient";
import { useSubscription } from "@/contexts/SubscriptionContext";
import { Ionicons } from "@expo/vector-icons";

interface DashboardStats {
  clientsCount: number;
  activeProgramsCount: number;
  todayAppointmentsCount: number;
}

const TIPS = [
  { icon: "👤", text: "Voeg je eerste cliënt toe via de Cliënten tab." },
  { icon: "📅", text: "Plan je eerste afspraak om structuur te bieden." },
  { icon: "📚", text: "Gebruik modules voor een gestructureerd traject." },
  { icon: "💬", text: "Stuur een bericht om de verbinding warm te houden." },
  { icon: "📊", text: "Check de inzichten om voortgang te meten." },
];

const formatDate = () => {
  const days = ["Zondag", "Maandag", "Dinsdag", "Woensdag", "Donderdag", "Vrijdag", "Zaterdag"];
  const months = [
    "januari", "februari", "maart", "april", "mei", "juni",
    "juli", "augustus", "september", "oktober", "november", "december",
  ];
  const now = new Date();
  return `${days[now.getDay()]} ${now.getDate()} ${months[now.getMonth()]}`;
};

const relativeTime = (dateStr: string) => {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins} min geleden`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} uur geleden`;
  const days = Math.floor(hours / 24);
  return `${days} dag${days !== 1 ? "en" : ""} geleden`;
};

const CARD_SHADOW = {
  shadowColor: "#000",
  shadowOffset: { width: 0, height: 2 },
  shadowOpacity: 0.06,
  shadowRadius: 8,
  elevation: 3,
};

export default function CoachDashboardScreen() {
  const { user, session } = useAuth();
  const router = useRouter();
  const { isSubscribed } = useSubscription();
  const { width } = useWindowDimensions();

  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<DashboardStats>({
    clientsCount: 0,
    activeProgramsCount: 0,
    todayAppointmentsCount: 0,
  });
  const [profile, setProfile] = useState<any>(null);
  const [todayAppointments, setTodayAppointments] = useState<
    { id: string; time: string; clientName: string }[]
  >([]);
  const [recentActivity, setRecentActivity] = useState<
    { icon: string; text: string; time: string }[]
  >([]);
  const [tipIndex, setTipIndex] = useState(0);
  const [modalVisible, setModalVisible] = useState(false);
  const [modalTitle, setModalTitle] = useState("");
  const [modalMessage, setModalMessage] = useState("");

  const tileWidth = (width - 52) / 2;
  const currentDate = formatDate();
  const currentTip = TIPS[tipIndex];

  const showModal = (title: string, message: string) => {
    setModalTitle(title);
    setModalMessage(message);
    setModalVisible(true);
  };

  useEffect(() => {
    setTipIndex(Math.floor(Math.random() * TIPS.length));
    fetchDashboardData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchDashboardData = async () => {
    console.log("[Coach Dashboard] Fetching dashboard data");
    try {
      if (!session?.user?.id) {
        console.error("[Coach Dashboard] No user session");
        return;
      }

      const userId = session.user.id;

      // Fetch profile
      const { data: profileData, error: profileError } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", userId)
        .single();

      if (profileError) {
        console.error("[Coach Dashboard] Profile fetch error:", profileError);
      } else {
        console.log("[Coach Dashboard] Profile loaded:", profileData?.full_name);
        setProfile(profileData);
      }

      // Fetch clients count
      const { count: clientsCount, error: clientsError } = await supabase
        .from("coach_clients")
        .select("*", { count: "exact", head: true })
        .eq("coach_id", userId);

      if (clientsError) {
        console.error("[Coach Dashboard] Clients count error:", clientsError);
      } else {
        console.log("[Coach Dashboard] Clients count:", clientsCount);
      }

      // Fetch today's appointments
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      const todayEnd = new Date();
      todayEnd.setHours(23, 59, 59, 999);

      const { data: todayApptData, error: todayApptError } = await supabase
        .from("appointments")
        .select("id, starts_at, client_id")
        .eq("coach_id", userId)
        .gte("starts_at", todayStart.toISOString())
        .lte("starts_at", todayEnd.toISOString());

      if (todayApptError) {
        console.error("[Coach Dashboard] Today appointments error:", todayApptError);
      } else {
        console.log("[Coach Dashboard] Today appointments:", todayApptData?.length);
      }

      // Fetch total appointments count
      const { count: appointmentsCount, error: appointmentsError } = await supabase
        .from("appointments")
        .select("*", { count: "exact", head: true })
        .eq("coach_id", userId)
        .gte("starts_at", new Date().toISOString());

      if (appointmentsError) {
        console.error("[Coach Dashboard] Appointments count error:", appointmentsError);
      } else {
        console.log("[Coach Dashboard] Upcoming appointments count:", appointmentsCount);
      }

      setStats({
        clientsCount: clientsCount || 0,
        activeProgramsCount: 0,
        todayAppointmentsCount: todayApptData?.length || 0,
      });

      // Build today's appointments with client names
      if (todayApptData && todayApptData.length > 0) {
        const clientIds = todayApptData.map((a: any) => a.client_id).filter(Boolean);
        let clientMap: Record<string, string> = {};

        if (clientIds.length > 0) {
          const { data: clientProfiles } = await supabase
            .from("profiles")
            .select("id, full_name")
            .in("id", clientIds);

          if (clientProfiles) {
            clientProfiles.forEach((p: any) => {
              clientMap[p.id] = p.full_name || "Onbekend";
            });
          }
        }

        const formatted = todayApptData.map((a: any) => {
          const d = new Date(a.starts_at);
          const hh = String(d.getHours()).padStart(2, "0");
          const mm = String(d.getMinutes()).padStart(2, "0");
          return {
            id: a.id,
            time: `${hh}:${mm}`,
            clientName: clientMap[a.client_id] || "Cliënt",
          };
        });
        setTodayAppointments(formatted);
      }

      // Fetch recent activity: last 2 coach_clients + last 1 appointment
      const { data: recentClients, error: recentClientsError } = await supabase
        .from("coach_clients")
        .select("client_id, created_at")
        .eq("coach_id", userId)
        .order("created_at", { ascending: false })
        .limit(2);

      if (recentClientsError) {
        console.error("[Coach Dashboard] Recent clients error:", recentClientsError);
      }

      const { data: recentAppt, error: recentApptError } = await supabase
        .from("appointments")
        .select("id, created_at")
        .eq("coach_id", userId)
        .order("created_at", { ascending: false })
        .limit(1);

      if (recentApptError) {
        console.error("[Coach Dashboard] Recent appointment error:", recentApptError);
      }

      const activity: { icon: string; text: string; time: string }[] = [];

      if (recentClients && recentClients.length > 0) {
        const recentClientIds = recentClients.map((c: any) => c.client_id).filter(Boolean);
        let recentClientMap: Record<string, string> = {};

        if (recentClientIds.length > 0) {
          const { data: rcProfiles } = await supabase
            .from("profiles")
            .select("id, full_name")
            .in("id", recentClientIds);

          if (rcProfiles) {
            rcProfiles.forEach((p: any) => {
              recentClientMap[p.id] = p.full_name || "Onbekend";
            });
          }
        }

        recentClients.slice(0, 2).forEach((c: any) => {
          activity.push({
            icon: "person-add-outline",
            text: `Nieuwe cliënt: ${recentClientMap[c.client_id] || "Onbekend"}`,
            time: relativeTime(c.created_at),
          });
        });
      }

      if (recentAppt && recentAppt.length > 0) {
        activity.push({
          icon: "calendar-outline",
          text: "Afspraak gepland",
          time: relativeTime(recentAppt[0].created_at),
        });
      }

      setRecentActivity(activity);
    } catch (error: any) {
      console.error("[Coach Dashboard] Error fetching dashboard data", error);
      showModal("Fout", "Kon dashboardgegevens niet laden");
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={["top"]}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={bcctColors.primaryOrange} />
        </View>
      </SafeAreaView>
    );
  }

  if (!isSubscribed) {
    return (
      <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
        <View style={gateStyles.container}>
          <View style={gateStyles.iconWrap}>
            <Text style={gateStyles.iconText}>🔒</Text>
          </View>
          <Text style={gateStyles.title}>Je hebt een actief abonnement nodig</Text>
          <Text style={gateStyles.subtitle}>Activeer je Pro Plan om de app te gebruiken.</Text>
          <TouchableOpacity
            onPress={() => {
              console.log("[CoachDashboard] Subscription gate — activate subscription pressed");
              router.push("/paywall");
            }}
            style={gateStyles.button}
            activeOpacity={0.9}
          >
            <Text style={gateStyles.buttonText}>Abonnement activeren</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const rawName = profile?.full_name || user?.user_metadata?.full_name || "Coach";
  const firstName = rawName.split(" ")[0];
  const clientsCountText = String(stats.clientsCount);
  const activeProgramsCountText = String(stats.activeProgramsCount);
  const todayAppointmentsCountText = String(stats.todayAppointmentsCount);

  return (
    <>
      <SafeAreaView style={styles.container} edges={["top"]}>
        <ScrollView showsVerticalScrollIndicator={false}>

          {/* A. Top section */}
          <View style={styles.topSection}>
            <View style={styles.topLeft}>
              <Text style={styles.greeting}>
                Welkom terug, {firstName}
              </Text>
              <Text style={styles.dateText}>{currentDate}</Text>
            </View>
            <TouchableOpacity
              style={styles.bellButton}
              onPress={() => {
                console.log("[CoachDashboard] Notification bell pressed");
                showModal("Notificaties", "Notificaties komen binnenkort");
              }}
              activeOpacity={0.7}
            >
              <Ionicons name="notifications-outline" size={24} color={bcctColors.textSecondary} />
            </TouchableOpacity>
          </View>

          {/* B. Stats cards row */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.statsScroll}
          >
            <TouchableOpacity
              style={styles.statCard}
              onPress={() => {
                console.log("[CoachDashboard] Stats card Cliënten pressed");
                router.push("/(app)/coach/clients");
              }}
              activeOpacity={0.8}
            >
              <Ionicons name="people-outline" size={22} color={bcctColors.primaryOrange} />
              <Text style={styles.statNumber}>{clientsCountText}</Text>
              <Text style={styles.statLabel}>Cliënten</Text>
              <Text style={styles.statSub}>+2 deze week</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.statCard}
              onPress={() => {
                console.log("[CoachDashboard] Stats card Programma's pressed");
                router.push("/(app)/coach/modules");
              }}
              activeOpacity={0.8}
            >
              <Ionicons name="book-outline" size={22} color={bcctColors.primaryOrange} />
              <Text style={styles.statNumber}>{activeProgramsCountText}</Text>
              <Text style={styles.statLabel}>Programma's</Text>
              <Text style={styles.statSub}>3 actief</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.statCard}
              onPress={() => {
                console.log("[CoachDashboard] Stats card Afspraken pressed");
                router.push("/(app)/coach/appointments");
              }}
              activeOpacity={0.8}
            >
              <Ionicons name="calendar-outline" size={22} color={bcctColors.primaryOrange} />
              <Text style={styles.statNumber}>{todayAppointmentsCountText}</Text>
              <Text style={styles.statLabel}>Afspraken</Text>
              <Text style={styles.statSub}>Vandaag</Text>
            </TouchableOpacity>
          </ScrollView>

          {/* C. Vandaag te doen */}
          <Text style={styles.sectionHeader}>Vandaag te doen</Text>

          {todayAppointments.length === 0 ? (
            <View style={[styles.emptyCard, CARD_SHADOW]}>
              <Text style={styles.emptyEmoji}>🗓️</Text>
              <Text style={styles.emptyTitle}>Geen afspraken vandaag</Text>
              <Text style={styles.emptySubtitle}>Geniet van je vrije dag!</Text>
            </View>
          ) : (
            todayAppointments.map((appt) => {
              const sessionLabel = `Sessie starten voor ${appt.clientName}`;
              return (
                <View key={appt.id} style={[styles.apptCard, CARD_SHADOW]}>
                  <View style={styles.apptLeft}>
                    <View style={styles.apptDot} />
                    <View style={styles.apptInfo}>
                      <Text style={styles.apptName}>{appt.clientName}</Text>
                      <Text style={styles.apptTime}>{appt.time}</Text>
                    </View>
                  </View>
                  <View style={styles.apptActions}>
                    <TouchableOpacity
                      style={styles.pillOrange}
                      onPress={() => {
                        console.log("[CoachDashboard] Start sessie pressed for:", appt.clientName);
                        showModal("Sessie starten", sessionLabel);
                      }}
                      activeOpacity={0.8}
                    >
                      <Text style={styles.pillOrangeText}>Start sessie</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.pillOutline}
                      onPress={() => {
                        console.log("[CoachDashboard] Bericht pressed for:", appt.clientName);
                        router.push("/(app)/coach/clients");
                      }}
                      activeOpacity={0.8}
                    >
                      <Text style={styles.pillOutlineText}>Bericht</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })
          )}

          {/* D. Snel starten */}
          <Text style={styles.sectionHeader}>Snel starten</Text>
          <View style={styles.gridContainer}>
            <TouchableOpacity
              style={[styles.actionTile, { width: tileWidth }, CARD_SHADOW]}
              onPress={() => {
                console.log("[CoachDashboard] Quick action Cliënten pressed");
                router.push("/(app)/coach/clients");
              }}
              activeOpacity={0.8}
            >
              <View style={styles.actionIconCircle}>
                <Ionicons name="people-outline" size={20} color={bcctColors.primaryOrange} />
              </View>
              <Text style={styles.actionLabel}>Cliënten</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.actionTile, { width: tileWidth }, CARD_SHADOW]}
              onPress={() => {
                console.log("[CoachDashboard] Quick action Modules pressed");
                router.push("/(app)/coach/modules");
              }}
              activeOpacity={0.8}
            >
              <View style={styles.actionIconCircle}>
                <Ionicons name="book-outline" size={20} color={bcctColors.primaryOrange} />
              </View>
              <Text style={styles.actionLabel}>Modules</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.actionTile, { width: tileWidth }, CARD_SHADOW]}
              onPress={() => {
                console.log("[CoachDashboard] Quick action Inzichten pressed");
                showModal("Inzichten", "Binnenkort beschikbaar");
              }}
              activeOpacity={0.8}
            >
              <View style={styles.actionIconCircle}>
                <Ionicons name="bar-chart-outline" size={20} color={bcctColors.primaryOrange} />
              </View>
              <Text style={styles.actionLabel}>Inzichten</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.actionTile, { width: tileWidth }, CARD_SHADOW]}
              onPress={() => {
                console.log("[CoachDashboard] Quick action Nieuwe cliënt pressed");
                router.push("/(app)/coach/clients");
              }}
              activeOpacity={0.8}
            >
              <View style={styles.actionIconCircle}>
                <Ionicons name="person-add-outline" size={20} color={bcctColors.primaryOrange} />
              </View>
              <Text style={styles.actionLabel}>+ Nieuwe cliënt</Text>
            </TouchableOpacity>
          </View>

          {/* E. Recente activiteit */}
          <Text style={styles.sectionHeader}>Recente activiteit</Text>
          <View style={[styles.activityCard, CARD_SHADOW]}>
            {recentActivity.length === 0 ? (
              <Text style={styles.activityEmpty}>Nog geen activiteit</Text>
            ) : (
              recentActivity.map((item, index) => {
                const isLast = index === recentActivity.length - 1;
                return (
                  <View key={index}>
                    <View style={styles.activityRow}>
                      <View style={styles.activityIconCircle}>
                        <Ionicons
                          name={item.icon as any}
                          size={16}
                          color={bcctColors.textSecondary}
                        />
                      </View>
                      <View style={styles.activityTextCol}>
                        <Text style={styles.activityText}>{item.text}</Text>
                        <Text style={styles.activityTime}>{item.time}</Text>
                      </View>
                    </View>
                    {!isLast && <View style={styles.activityDivider} />}
                  </View>
                );
              })
            )}
          </View>

          {/* F. Tip card */}
          <LinearGradient
            colors={["#F28C28", "#E67E1F"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.tipCard}
          >
            <View style={styles.tipRow}>
              <Text style={styles.tipEmoji}>{currentTip.icon}</Text>
              <Text style={styles.tipText}>{currentTip.text}</Text>
            </View>
            <TouchableOpacity
              style={styles.tipNext}
              onPress={() => {
                console.log("[CoachDashboard] Volgende tip pressed");
                setTipIndex((prev) => (prev + 1) % TIPS.length);
              }}
              activeOpacity={0.8}
            >
              <Text style={styles.tipNextText}>Volgende tip →</Text>
            </TouchableOpacity>
          </LinearGradient>

          {/* G. Bottom padding */}
          <View style={{ height: 120 }} />
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
            onPress={() => {
              console.log("[CoachDashboard] Modal OK pressed");
              setModalVisible(false);
            }}
          >
            <Text style={styles.modalButtonText}>OK</Text>
          </TouchableOpacity>
        </View>
      </Modal>
    </>
  );
}

const gateStyles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 32,
    gap: 16,
  },
  iconWrap: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: `${bcctColors.primaryOrange}18`,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  iconText: { fontSize: 36 },
  title: {
    ...bcctTypography.h2,
    color: bcctColors.textPrimary,
    textAlign: "center",
  },
  subtitle: {
    ...bcctTypography.body,
    color: bcctColors.textSecondary,
    textAlign: "center",
  },
  button: {
    marginTop: 8,
    backgroundColor: bcctColors.primaryOrange,
    paddingVertical: 15,
    paddingHorizontal: 32,
    borderRadius: 14,
    shadowColor: bcctColors.primaryOrange,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 6,
  },
  buttonText: {
    color: "#fff",
    ...bcctTypography.button,
  },
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: bcctColors.lightBackground,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },

  // A. Top section
  topSection: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 8,
  },
  topLeft: { flex: 1 },
  greeting: {
    fontSize: 22,
    fontWeight: "700",
    color: bcctColors.textPrimary,
    marginBottom: 2,
  },
  dateText: {
    fontSize: 14,
    color: bcctColors.textSecondary,
  },
  bellButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: bcctColors.cardBackground,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },

  // B. Stats
  statsScroll: {
    paddingHorizontal: 20,
    paddingTop: 16,
    gap: 12,
  },
  statCard: {
    width: 140,
    backgroundColor: bcctColors.cardBackground,
    borderRadius: 16,
    padding: 16,
    alignItems: "flex-start",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  statNumber: {
    fontSize: 28,
    fontWeight: "700",
    color: bcctColors.textPrimary,
    marginTop: 8,
  },
  statLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: bcctColors.textPrimary,
    marginTop: 2,
  },
  statSub: {
    fontSize: 11,
    color: bcctColors.textSecondary,
    marginTop: 2,
  },

  // Section header
  sectionHeader: {
    fontSize: 17,
    fontWeight: "700",
    color: bcctColors.textPrimary,
    paddingHorizontal: 20,
    marginTop: 24,
    marginBottom: 12,
  },

  // C. Today appointments
  emptyCard: {
    backgroundColor: bcctColors.cardBackground,
    borderRadius: 16,
    padding: 20,
    marginHorizontal: 20,
    alignItems: "center",
  },
  emptyEmoji: { fontSize: 28, marginBottom: 8 },
  emptyTitle: {
    fontSize: 15,
    color: bcctColors.textSecondary,
    fontWeight: "500",
  },
  emptySubtitle: {
    fontSize: 13,
    color: bcctColors.textSecondary,
    marginTop: 4,
  },
  apptCard: {
    backgroundColor: bcctColors.cardBackground,
    borderRadius: 16,
    padding: 16,
    marginHorizontal: 20,
    marginBottom: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  apptLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  apptDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: bcctColors.primaryOrange,
    marginRight: 10,
  },
  apptInfo: { flex: 1 },
  apptName: {
    fontSize: 15,
    fontWeight: "700",
    color: bcctColors.textPrimary,
  },
  apptTime: {
    fontSize: 13,
    color: bcctColors.textSecondary,
    marginTop: 2,
  },
  apptActions: {
    flexDirection: "row",
    gap: 6,
  },
  pillOrange: {
    backgroundColor: bcctColors.primaryOrange,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
  },
  pillOrangeText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "600",
  },
  pillOutline: {
    borderWidth: 1,
    borderColor: bcctColors.primaryOrange,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
  },
  pillOutlineText: {
    color: bcctColors.primaryOrange,
    fontSize: 12,
    fontWeight: "600",
  },

  // D. Quick actions grid
  gridContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    paddingHorizontal: 20,
  },
  actionTile: {
    backgroundColor: bcctColors.cardBackground,
    borderRadius: 16,
    padding: 16,
  },
  actionIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#FFF3E8",
    alignItems: "center",
    justifyContent: "center",
  },
  actionLabel: {
    fontSize: 14,
    fontWeight: "700",
    color: bcctColors.textPrimary,
    marginTop: 8,
  },

  // E. Recent activity
  activityCard: {
    backgroundColor: bcctColors.cardBackground,
    borderRadius: 16,
    marginHorizontal: 20,
    overflow: "hidden",
  },
  activityEmpty: {
    fontSize: 14,
    color: bcctColors.textSecondary,
    textAlign: "center",
    padding: 20,
  },
  activityRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
  },
  activityIconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#F3F4F6",
    alignItems: "center",
    justifyContent: "center",
  },
  activityTextCol: {
    flex: 1,
    marginLeft: 12,
  },
  activityText: {
    fontSize: 14,
    color: bcctColors.textPrimary,
  },
  activityTime: {
    fontSize: 12,
    color: bcctColors.textSecondary,
    marginTop: 2,
  },
  activityDivider: {
    height: 1,
    backgroundColor: "#F3F4F6",
    marginHorizontal: 16,
  },

  // F. Tip card
  tipCard: {
    borderRadius: 16,
    padding: 20,
    marginHorizontal: 20,
    marginTop: 24,
  },
  tipRow: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  tipEmoji: { fontSize: 24 },
  tipText: {
    fontSize: 14,
    color: "#fff",
    flex: 1,
    marginLeft: 10,
    lineHeight: 20,
  },
  tipNext: {
    alignSelf: "flex-end",
    marginTop: 12,
  },
  tipNextText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "600",
  },

  // Modal
  modalContent: {
    backgroundColor: bcctColors.cardBackground,
    borderRadius: 20,
    padding: 24,
    alignItems: "center",
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: bcctColors.primaryOrange,
    marginBottom: 12,
  },
  modalMessage: {
    fontSize: 15,
    color: bcctColors.textSecondary,
    textAlign: "center",
    marginBottom: 24,
  },
  modalButton: {
    backgroundColor: bcctColors.primaryOrange,
    borderRadius: 12,
    paddingHorizontal: 32,
    paddingVertical: 12,
    minWidth: 100,
  },
  modalButtonText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 15,
    textAlign: "center",
  },
});
