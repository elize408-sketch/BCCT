
import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
} from "react-native";
import Modal from "react-native-modal";
import { useTheme } from "@react-navigation/native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "@/contexts/AuthContext";
import { IconSymbol } from "@/components/IconSymbol";
import { useRouter } from "expo-router";
import { supabase } from "@/lib/supabase";
import { bcctColors, bcctTypography, getSliderColor, getEnergyLabel, getStressLabel, getSleepLabel } from "@/styles/bcctTheme";

interface CheckinData {
  energy: number;
  stress: number;
  sleep: number;
}

interface ActionTile {
  id: string;
  title: string;
  ios_icon: string;
  android_icon: string;
  route: string | null;
}

const ACTION_TILES: ActionTile[] = [
  {
    id: "checkin",
    title: "Thema Check-in",
    ios_icon: "checkmark.circle",
    android_icon: "check-circle",
    route: "/(app)/client/checkin",
  },
  {
    id: "program",
    title: "Mijn Programma",
    ios_icon: "list.bullet",
    android_icon: "list",
    route: null,
  },
  {
    id: "chat",
    title: "Chat met Coach",
    ios_icon: "message",
    android_icon: "chat",
    route: null,
  },
  {
    id: "appointments",
    title: "Afspraken",
    ios_icon: "calendar",
    android_icon: "event",
    route: null,
  },
  {
    id: "mycoach",
    title: "Mijn Coach",
    ios_icon: "person.circle",
    android_icon: "person",
    route: "/(app)/client/settings",
  },
  {
    id: "profile",
    title: "Mijn Profiel",
    ios_icon: "person.crop.circle",
    android_icon: "account-circle",
    route: null,
  },
];

export default function ClientHomeScreen() {
  const { colors } = useTheme();
  const { user } = useAuth();
  const router = useRouter();
  const [sessionLoading, setSessionLoading] = useState(true);
  const [checkinLoading, setCheckinLoading] = useState(true);
  const [todayCheckinSaved, setTodayCheckinSaved] = useState(false);
  const [checkinData, setCheckinData] = useState<CheckinData | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [modalTitle, setModalTitle] = useState("");
  const [modalMessage, setModalMessage] = useState("");

  const showModal = (title: string, message: string) => {
    setModalTitle(title);
    setModalMessage(message);
    setModalVisible(true);
  };

  useEffect(() => {
    const checkSession = async () => {
      console.log("[Client] Checking session before loading home data");
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        console.warn("[Client] No active session found, redirecting to /auth");
        router.replace("/auth");
        return;
      }
      console.log("[Client] Session confirmed for user:", session.user.id);
      setSessionLoading(false);
    };
    checkSession();
  }, []);

  useEffect(() => {
    if (!sessionLoading) {
      fetchTodayCheckin();
    }
  }, [sessionLoading]);

  const fetchTodayCheckin = async () => {
    console.log("[Client] Fetching today's check-in");
    try {
      const today = new Date().toISOString().split("T")[0];
      const { data: sessionData } = await supabase.auth.getSession();

      if (!sessionData?.session?.user) {
        console.error("[Client] No user session found");
        return;
      }

      const { data, error } = await supabase
        .from("checkins")
        .select("energy, stress, sleep")
        .eq("user_id", sessionData.session.user.id)
        .eq("date", today)
        .single();

      if (error && error.code !== "PGRST116") {
        console.error("[Client] Error fetching today's check-in", error);
        return;
      }

      if (data) {
        console.log("[Client] Today's check-in found", data);
        setCheckinData({ energy: data.energy, stress: data.stress, sleep: data.sleep });
        setTodayCheckinSaved(true);
      }
    } catch (error: any) {
      console.error("[Client] Error fetching today's check-in", error);
    } finally {
      setCheckinLoading(false);
    }
  };

  const handleTilePress = (tile: ActionTile) => {
    console.log("[Client] Action tile pressed:", tile.id);
    if (tile.route) {
      router.push(tile.route as any);
    } else {
      showModal("Binnenkort beschikbaar", `${tile.title} is binnenkort beschikbaar.`);
    }
  };

  if (sessionLoading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={["top"]}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={bcctColors.primaryOrange} />
        </View>
      </SafeAreaView>
    );
  }

  const greetingText = "Welkom terug";
  const userName = user?.name || "Cliënt";

  const energyValue = checkinData?.energy ?? 0;
  const stressValue = checkinData?.stress ?? 0;
  const sleepValue = checkinData?.sleep ?? 0;

  const checkinStatusText = todayCheckinSaved ? "Vandaag opgeslagen" : "Nog niet ingevuld";
  const checkinStatusColor = todayCheckinSaved ? bcctColors.success : bcctColors.textSecondary;

  return (
    <>
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={["top"]}>
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={[styles.greeting, { color: bcctColors.textSecondary }]}>{greetingText}</Text>
            <Text style={[styles.name, { color: colors.text }]}>{userName}</Text>
          </View>
        </View>

        {/* Check-in summary card */}
        <TouchableOpacity
          style={[styles.checkinCard, { backgroundColor: colors.card, borderColor: colors.border }]}
          onPress={() => {
            console.log("[Client] Check-in card pressed, navigating to checkin");
            router.push("/(app)/client/checkin");
          }}
          activeOpacity={0.75}
        >
          {/* Card header */}
          <View style={styles.checkinCardHeader}>
            <Text style={styles.checkinCardLabel}>Vandaag opgeslagen</Text>
            {todayCheckinSaved && (
              <IconSymbol
                ios_icon_name="checkmark.circle.fill"
                android_material_icon_name="check-circle"
                size={18}
                color={bcctColors.success}
              />
            )}
          </View>

          {checkinLoading ? (
            <ActivityIndicator size="small" color={bcctColors.primaryOrange} style={{ marginTop: 12 }} />
          ) : todayCheckinSaved && checkinData ? (
            <View style={styles.checkinMetrics}>
              {/* Energie */}
              <View style={styles.checkinMetricRow}>
                <Text style={[styles.checkinMetricName, { color: bcctColors.textSecondary }]}>Energie</Text>
                <View style={styles.checkinMetricRight}>
                  <View style={[styles.checkinMetricBar, { backgroundColor: bcctColors.borderGray }]}>
                    <View
                      style={[
                        styles.checkinMetricFill,
                        {
                          width: `${energyValue}%` as any,
                          backgroundColor: getSliderColor(energyValue, "energy"),
                        },
                      ]}
                    />
                  </View>
                  <Text style={[styles.checkinMetricLabel, { color: getSliderColor(energyValue, "energy") }]}>
                    {getEnergyLabel(energyValue)}
                  </Text>
                </View>
              </View>

              {/* Stress */}
              <View style={styles.checkinMetricRow}>
                <Text style={[styles.checkinMetricName, { color: bcctColors.textSecondary }]}>Stress</Text>
                <View style={styles.checkinMetricRight}>
                  <View style={[styles.checkinMetricBar, { backgroundColor: bcctColors.borderGray }]}>
                    <View
                      style={[
                        styles.checkinMetricFill,
                        {
                          width: `${stressValue}%` as any,
                          backgroundColor: getSliderColor(stressValue, "stress"),
                        },
                      ]}
                    />
                  </View>
                  <Text style={[styles.checkinMetricLabel, { color: getSliderColor(stressValue, "stress") }]}>
                    {getStressLabel(stressValue)}
                  </Text>
                </View>
              </View>

              {/* Slaap */}
              <View style={styles.checkinMetricRow}>
                <Text style={[styles.checkinMetricName, { color: bcctColors.textSecondary }]}>Slaap</Text>
                <View style={styles.checkinMetricRight}>
                  <View style={[styles.checkinMetricBar, { backgroundColor: bcctColors.borderGray }]}>
                    <View
                      style={[
                        styles.checkinMetricFill,
                        {
                          width: `${sleepValue}%` as any,
                          backgroundColor: getSliderColor(sleepValue, "sleep"),
                        },
                      ]}
                    />
                  </View>
                  <Text style={[styles.checkinMetricLabel, { color: getSliderColor(sleepValue, "sleep") }]}>
                    {getSleepLabel(sleepValue)}
                  </Text>
                </View>
              </View>
            </View>
          ) : (
            <Text style={[styles.checkinEmptyText, { color: bcctColors.textSecondary }]}>
              Nog niet ingevuld vandaag — tik om in te vullen
            </Text>
          )}
        </TouchableOpacity>

        {/* Action grid — 2 columns × 3 rows */}
        <View style={styles.grid}>
          {ACTION_TILES.map((tile) => (
            <TouchableOpacity
              key={tile.id}
              style={[styles.tile, { backgroundColor: colors.card, borderColor: colors.border }]}
              onPress={() => handleTilePress(tile)}
              activeOpacity={0.75}
            >
              <View style={[styles.tileIconWrap, { backgroundColor: bcctColors.primaryOrange + "15" }]}>
                <IconSymbol
                  ios_icon_name={tile.ios_icon}
                  android_material_icon_name={tile.android_icon}
                  size={26}
                  color={bcctColors.primaryOrange}
                />
              </View>
              <Text style={[styles.tileLabel, { color: colors.text }]}>{tile.title}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </SafeAreaView>

      <Modal
        isVisible={modalVisible}
        onBackdropPress={() => setModalVisible(false)}
        onBackButtonPress={() => setModalVisible(false)}
        animationIn="fadeIn"
        animationOut="fadeOut"
        backdropOpacity={0.4}
      >
        <View style={[styles.modalContent, { backgroundColor: colors.card }]}>
          <Text style={[styles.modalTitle, { color: bcctColors.primaryOrange }]}>{modalTitle}</Text>
          <Text style={[styles.modalMessage, { color: bcctColors.textSecondary }]}>{modalMessage}</Text>
          <TouchableOpacity
            style={[styles.modalButton, { backgroundColor: bcctColors.primaryOrange }]}
            onPress={() => {
              console.log("[Client] Modal dismissed");
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

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 20,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 16,
    marginBottom: 20,
  },
  greeting: {
    ...bcctTypography.small,
    marginBottom: 2,
  },
  name: {
    ...bcctTypography.h1,
  },
  checkinCard: {
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 18,
    paddingVertical: 16,
    marginBottom: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 1,
  },
  checkinCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 14,
  },
  checkinCardLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: "#9AA5B4",
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  checkinMetrics: {
    gap: 10,
  },
  checkinMetricRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  checkinMetricName: {
    ...bcctTypography.body,
    width: 60,
  },
  checkinMetricRight: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginLeft: 8,
  },
  checkinMetricBar: {
    flex: 1,
    height: 6,
    borderRadius: 3,
    overflow: "hidden",
  },
  checkinMetricFill: {
    height: "100%",
    borderRadius: 3,
  },
  checkinMetricLabel: {
    fontSize: 12,
    fontWeight: "600",
    width: 60,
    textAlign: "right",
  },
  checkinEmptyText: {
    ...bcctTypography.body,
    marginTop: 4,
    marginBottom: 4,
  },
  grid: {
    flex: 1,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    alignContent: "flex-start",
  },
  tile: {
    width: "47.5%",
    flex: 0,
    aspectRatio: 1.15,
    borderRadius: 18,
    borderWidth: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 1,
  },
  tileIconWrap: {
    width: 52,
    height: 52,
    borderRadius: 26,
    justifyContent: "center",
    alignItems: "center",
  },
  tileLabel: {
    ...bcctTypography.bodyMedium,
    textAlign: "center",
    paddingHorizontal: 8,
  },
  modalContent: {
    borderRadius: 20,
    padding: 24,
    alignItems: "center",
  },
  modalTitle: {
    ...bcctTypography.h3,
    marginBottom: 10,
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
