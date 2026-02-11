
import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  TextInput,
} from "react-native";
import Modal from "react-native-modal";
import { useTheme } from "@react-navigation/native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "@/contexts/AuthContext";
import { IconSymbol } from "@/components/IconSymbol";
import { useRouter } from "expo-router";
import { authenticatedGet } from "@/utils/api";
import { supabase } from "@/lib/supabase";
import Slider from "@react-native-community/slider";

interface HomeData {
  checkinStatus: string | null;
  currentWeek: any | null;
  nextTask: any | null;
  nextAppointment: any | null;
  unreadChatCount: number;
}

interface CheckinData {
  id?: string;
  feeling_text: string;
  energy: number;
  stress: number;
  sleep: number;
  locked_energy: boolean;
  locked_stress: boolean;
  locked_sleep: boolean;
}

interface BatterySliderProps {
  label: string;
  value: number;
  locked: boolean;
  onValueChange: (value: number) => void;
  onLockToggle: () => void;
  colors: any;
}

function BatterySlider({ label, value, locked, onValueChange, onLockToggle, colors }: BatterySliderProps) {
  const getBatteryColor = (val: number) => {
    if (val <= 33) return "#10b981"; // groen
    if (val <= 66) return "#f59e0b"; // geel
    return "#ef4444"; // rood
  };

  const batteryColor = getBatteryColor(value);
  const valueLabel = `${label}: ${value}`;

  return (
    <View style={styles.batterySliderContainer}>
      <View style={styles.batterySliderHeader}>
        <View style={styles.batteryIconContainer}>
          <View style={[styles.batteryIcon, { borderColor: colors.text }]}>
            <View
              style={[
                styles.batteryFill,
                {
                  width: `${value}%`,
                  backgroundColor: batteryColor,
                },
              ]}
            />
          </View>
          <View style={[styles.batteryTip, { backgroundColor: colors.text }]} />
        </View>
        <Text style={[styles.batteryLabel, { color: colors.text }]}>{valueLabel}</Text>
        <TouchableOpacity
          style={[styles.lockButton, locked && styles.lockButtonActive]}
          onPress={onLockToggle}
        >
          <IconSymbol
            ios_icon_name={locked ? "lock.fill" : "lock.open"}
            android_material_icon_name={locked ? "lock" : "lock-open"}
            size={20}
            color={locked ? "#ef4444" : colors.text}
          />
        </TouchableOpacity>
      </View>
      <Slider
        style={styles.slider}
        minimumValue={0}
        maximumValue={100}
        step={1}
        value={value}
        onValueChange={onValueChange}
        minimumTrackTintColor={batteryColor}
        maximumTrackTintColor={colors.border}
        thumbTintColor={batteryColor}
        disabled={locked}
      />
    </View>
  );
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

  // Check-in state
  const [checkinExpanded, setCheckinExpanded] = useState(true);
  const [checkinSaving, setCheckinSaving] = useState(false);
  const [checkinData, setCheckinData] = useState<CheckinData>({
    feeling_text: "",
    energy: 50,
    stress: 50,
    sleep: 50,
    locked_energy: false,
    locked_stress: false,
    locked_sleep: false,
  });
  const [todayCheckinSaved, setTodayCheckinSaved] = useState(false);

  const showModal = (title: string, message: string) => {
    setModalTitle(title);
    setModalMessage(message);
    setModalVisible(true);
  };

  useEffect(() => {
    fetchHomeData();
    fetchTodayCheckin();
  }, []);

  const fetchHomeData = async () => {
    console.log("[Client] Fetching home data from GET /api/client/home");
    try {
      const data = await authenticatedGet<HomeData>("/api/client/home");
      console.log("[Client] Home data loaded", data);
      setHomeData(data);
    } catch (error: any) {
      console.error("[Client] Error fetching home data", error);
      showModal("Fout", "Kon thuisgegevens niet laden");
    } finally {
      setLoading(false);
    }
  };

  const fetchTodayCheckin = async () => {
    console.log("[Client] Fetching today's check-in");
    try {
      const today = new Date().toISOString().split("T")[0];
      const { data: session } = await supabase.auth.getSession();
      
      if (!session?.session?.user) {
        console.error("[Client] No user session found");
        return;
      }

      const { data, error } = await supabase
        .from("checkins")
        .select("*")
        .eq("user_id", session.session.user.id)
        .eq("date", today)
        .single();

      if (error && error.code !== "PGRST116") {
        console.error("[Client] Error fetching today's check-in", error);
        return;
      }

      if (data) {
        console.log("[Client] Today's check-in found", data);
        setCheckinData({
          id: data.id,
          feeling_text: data.feeling_text || "",
          energy: data.energy,
          stress: data.stress,
          sleep: data.sleep,
          locked_energy: data.locked_energy,
          locked_stress: data.locked_stress,
          locked_sleep: data.locked_sleep,
        });
        setTodayCheckinSaved(true);
        setCheckinExpanded(false);
      }
    } catch (error: any) {
      console.error("[Client] Error fetching today's check-in", error);
    }
  };

  const saveCheckin = async () => {
    console.log("[Client] Saving check-in", checkinData);
    setCheckinSaving(true);
    try {
      const today = new Date().toISOString().split("T")[0];
      const { data: session } = await supabase.auth.getSession();
      
      if (!session?.session?.user) {
        showModal("Fout", "Je bent niet ingelogd");
        return;
      }

      const upsertData = {
        user_id: session.session.user.id,
        date: today,
        feeling_text: checkinData.feeling_text,
        energy: checkinData.energy,
        stress: checkinData.stress,
        sleep: checkinData.sleep,
        locked_energy: checkinData.locked_energy,
        locked_stress: checkinData.locked_stress,
        locked_sleep: checkinData.locked_sleep,
        mood: 5, // Default value for existing column
      };

      const { data, error } = await supabase
        .from("checkins")
        .upsert(upsertData, {
          onConflict: "user_id,date",
        })
        .select()
        .single();

      if (error) {
        console.error("[Client] Error saving check-in", error);
        showModal("Fout", "Kon check-in niet opslaan");
        return;
      }

      console.log("[Client] Check-in saved successfully", data);
      setTodayCheckinSaved(true);
      setCheckinExpanded(false);
      showModal("Opgeslagen ✓", "Je check-in is succesvol opgeslagen");
    } catch (error: any) {
      console.error("[Client] Error saving check-in", error);
      showModal("Fout", "Kon check-in niet opslaan");
    } finally {
      setCheckinSaving(false);
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
      showModal("Fout", "Uitloggen mislukt");
    } finally {
      setSigningOut(false);
    }
  };

  const quickActions = [
    {
      id: "checkin",
      title: "Dagelijkse Check-in",
      description: "Log je stress, energie, slaap & stemming",
      icon: "favorite" as const,
      color: "#ef4444",
    },
    {
      id: "program",
      title: "Mijn Programma",
      description: "Ga verder met je coachingtraject",
      icon: "school" as const,
      color: "#6366f1",
    },
    {
      id: "chat",
      title: "Chat met Coach",
      description: "Stuur een bericht naar je coach",
      icon: "chat" as const,
      color: "#10b981",
    },
    {
      id: "appointments",
      title: "Afspraken",
      description: "Bekijk aankomende sessies",
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
              <Text style={[styles.greeting, { color: colors.text, opacity: 0.7 }]}>Welkom terug</Text>
              <Text style={[styles.name, { color: colors.text }]}>{user?.name || "Cliënt"}</Text>
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

          {/* Check-in Card */}
          <View style={[styles.checkinCard, { backgroundColor: colors.card }]}>
            {todayCheckinSaved && !checkinExpanded ? (
              <TouchableOpacity
                style={styles.checkinCollapsed}
                onPress={() => setCheckinExpanded(true)}
              >
                <View style={styles.checkinCollapsedHeader}>
                  <IconSymbol
                    ios_icon_name="checkmark.circle.fill"
                    android_material_icon_name="check-circle"
                    size={24}
                    color="#10b981"
                  />
                  <Text style={[styles.checkinCollapsedTitle, { color: colors.text }]}>
                    Vandaag opgeslagen
                  </Text>
                </View>
                <View style={styles.checkinCollapsedValues}>
                  <Text style={[styles.checkinCollapsedValue, { color: colors.text }]}>
                    Energie: {checkinData.energy}
                  </Text>
                  <Text style={[styles.checkinCollapsedValue, { color: colors.text }]}>
                    Stress: {checkinData.stress}
                  </Text>
                  <Text style={[styles.checkinCollapsedValue, { color: colors.text }]}>
                    Slaap: {checkinData.sleep}
                  </Text>
                </View>
              </TouchableOpacity>
            ) : (
              <>
                <Text style={[styles.checkinTitle, { color: colors.text }]}>
                  Hoe voel je je vandaag?
                </Text>
                <TextInput
                  style={[styles.checkinInput, { color: colors.text, borderColor: colors.border }]}
                  placeholder="Typ hier hoe je je voelt…"
                  placeholderTextColor={colors.text + "80"}
                  value={checkinData.feeling_text}
                  onChangeText={(text) =>
                    setCheckinData({ ...checkinData, feeling_text: text })
                  }
                  maxLength={250}
                  multiline
                />
                <Text style={[styles.charCount, { color: colors.text, opacity: 0.5 }]}>
                  {checkinData.feeling_text.length}/250
                </Text>

                <BatterySlider
                  label="Energie"
                  value={checkinData.energy}
                  locked={checkinData.locked_energy}
                  onValueChange={(value) =>
                    setCheckinData({ ...checkinData, energy: Math.round(value) })
                  }
                  onLockToggle={() =>
                    setCheckinData({
                      ...checkinData,
                      locked_energy: !checkinData.locked_energy,
                    })
                  }
                  colors={colors}
                />

                <BatterySlider
                  label="Stress"
                  value={checkinData.stress}
                  locked={checkinData.locked_stress}
                  onValueChange={(value) =>
                    setCheckinData({ ...checkinData, stress: Math.round(value) })
                  }
                  onLockToggle={() =>
                    setCheckinData({
                      ...checkinData,
                      locked_stress: !checkinData.locked_stress,
                    })
                  }
                  colors={colors}
                />

                <BatterySlider
                  label="Slaap"
                  value={checkinData.sleep}
                  locked={checkinData.locked_sleep}
                  onValueChange={(value) =>
                    setCheckinData({ ...checkinData, sleep: Math.round(value) })
                  }
                  onLockToggle={() =>
                    setCheckinData({
                      ...checkinData,
                      locked_sleep: !checkinData.locked_sleep,
                    })
                  }
                  colors={colors}
                />

                <TouchableOpacity
                  style={[
                    styles.saveButton,
                    checkinSaving && styles.saveButtonDisabled,
                  ]}
                  onPress={saveCheckin}
                  disabled={checkinSaving}
                >
                  {checkinSaving ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={styles.saveButtonText}>Check-in opslaan</Text>
                  )}
                </TouchableOpacity>
              </>
            )}
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
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Overzicht van Vandaag</Text>
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
                  {homeData?.checkinStatus || "Niet voltooid"}
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
                  Volgende Afspraak
                </Text>
                <Text style={[styles.overviewValue, { color: colors.text }]}>
                  {homeData?.nextAppointment ? "Ingepland" : "Geen aankomende"}
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
                      Ongelezen Berichten
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
            Dit is je cliënt dashboard. Voltooi je dagelijkse check-in, werk aan je programmataken,
            en blijf in contact met je coach.
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
    marginBottom: 24,
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
  checkinCard: {
    padding: 20,
    borderRadius: 16,
    marginBottom: 32,
  },
  checkinTitle: {
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 12,
  },
  checkinInput: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    fontSize: 16,
    minHeight: 80,
    textAlignVertical: "top",
    marginBottom: 4,
  },
  charCount: {
    fontSize: 12,
    textAlign: "right",
    marginBottom: 16,
  },
  batterySliderContainer: {
    marginBottom: 20,
  },
  batterySliderHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
    gap: 12,
  },
  batteryIconContainer: {
    flexDirection: "row",
    alignItems: "center",
  },
  batteryIcon: {
    width: 32,
    height: 16,
    borderWidth: 2,
    borderRadius: 3,
    overflow: "hidden",
    position: "relative",
  },
  batteryFill: {
    height: "100%",
    borderRadius: 1,
  },
  batteryTip: {
    width: 3,
    height: 8,
    borderTopRightRadius: 2,
    borderBottomRightRadius: 2,
    marginLeft: -1,
  },
  batteryLabel: {
    fontSize: 16,
    fontWeight: "600",
    flex: 1,
  },
  lockButton: {
    padding: 8,
    borderRadius: 8,
  },
  lockButtonActive: {
    backgroundColor: "#ef444420",
  },
  slider: {
    width: "100%",
    height: 40,
  },
  saveButton: {
    backgroundColor: "#6366f1",
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
    marginTop: 8,
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  checkinCollapsed: {
    gap: 12,
  },
  checkinCollapsedHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  checkinCollapsedTitle: {
    fontSize: 18,
    fontWeight: "bold",
  },
  checkinCollapsedValues: {
    flexDirection: "row",
    gap: 16,
    paddingLeft: 36,
  },
  checkinCollapsedValue: {
    fontSize: 14,
    fontWeight: "500",
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
