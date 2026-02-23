
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
import { LinearGradient } from "expo-linear-gradient";
import { bcctColors, bcctTypography, getSliderColor, getStressLabel, getSleepLabel, getEnergyLabel } from "@/styles/bcctTheme";

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

interface SliderProps {
  label: string;
  value: number;
  locked: boolean;
  onValueChange: (value: number) => void;
  onLockToggle: () => void;
  type: 'energy' | 'stress' | 'sleep';
  colors: any;
}

function CustomSlider({ label, value, locked, onValueChange, onLockToggle, type, colors }: SliderProps) {
  const sliderColor = getSliderColor(value, type);
  
  let textLabel = '';
  if (type === 'stress') {
    textLabel = getStressLabel(value);
  } else if (type === 'sleep') {
    textLabel = getSleepLabel(value);
  } else if (type === 'energy') {
    textLabel = getEnergyLabel(value);
  }

  const valueText = `${label}: ${value}`;

  return (
    <View style={styles.sliderContainer}>
      <View style={styles.sliderHeader}>
        <Text style={[styles.sliderLabel, { color: colors.text }]}>{valueText}</Text>
        <Text style={[styles.sliderTextLabel, { color: sliderColor }]}>{textLabel}</Text>
        <TouchableOpacity
          style={[styles.lockButton, locked && styles.lockButtonActive]}
          onPress={onLockToggle}
        >
          <IconSymbol
            ios_icon_name={locked ? "lock.fill" : "lock.open"}
            android_material_icon_name={locked ? "lock" : "lock-open"}
            size={20}
            color={locked ? bcctColors.error : colors.text}
          />
        </TouchableOpacity>
      </View>
      <View style={[styles.sliderTrack, { backgroundColor: colors.border }]}>
        <View
          style={[
            styles.sliderFill,
            {
              width: `${value}%`,
              backgroundColor: sliderColor,
            },
          ]}
        />
      </View>
      <Slider
        style={styles.slider}
        minimumValue={0}
        maximumValue={100}
        step={1}
        value={value}
        onValueChange={onValueChange}
        minimumTrackTintColor="transparent"
        maximumTrackTintColor="transparent"
        thumbTintColor={sliderColor}
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
        mood: 5,
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
      title: "Thema Check-in",
      description: "Vul je dagelijkse thema check-in in",
      icon: "favorite" as const,
      color: bcctColors.error,
      route: "/(app)/client/checkin" as const,
    },
    {
      id: "program",
      title: "Mijn Programma",
      description: "Ga verder met je coachingtraject",
      icon: "school" as const,
      color: bcctColors.primaryOrange,
      route: null,
    },
    {
      id: "chat",
      title: "Chat met Coach",
      description: "Stuur een bericht naar je coach",
      icon: "chat" as const,
      color: bcctColors.gradientTeal,
      route: null,
    },
    {
      id: "appointments",
      title: "Afspraken",
      description: "Bekijk aankomende sessies",
      icon: "calendar-today" as const,
      color: bcctColors.primaryOrangeLight,
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

  const greetingText = "Welkom terug";
  const userName = user?.name || "Cliënt";

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

          <View style={[styles.checkinCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
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
                    color={bcctColors.success}
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
                  style={[styles.checkinInput, { color: colors.text, borderColor: colors.border, backgroundColor: colors.background }]}
                  placeholder="Typ hier hoe je je voelt…"
                  placeholderTextColor={bcctColors.textSecondary}
                  value={checkinData.feeling_text}
                  onChangeText={(text) =>
                    setCheckinData({ ...checkinData, feeling_text: text })
                  }
                  maxLength={250}
                  multiline
                />
                <Text style={[styles.charCount, { color: bcctColors.textSecondary }]}>
                  {checkinData.feeling_text.length}/250
                </Text>

                <CustomSlider
                  label="Energie"
                  value={checkinData.energy}
                  locked={checkinData.locked_energy}
                  type="energy"
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

                <CustomSlider
                  label="Stress"
                  value={checkinData.stress}
                  locked={checkinData.locked_stress}
                  type="stress"
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

                <CustomSlider
                  label="Slaap"
                  value={checkinData.sleep}
                  locked={checkinData.locked_sleep}
                  type="sleep"
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
                  style={[styles.saveButtonContainer]}
                  onPress={saveCheckin}
                  disabled={checkinSaving}
                  activeOpacity={0.9}
                >
                  <LinearGradient
                    colors={checkinSaving ? [bcctColors.primaryOrangeDisabled, bcctColors.primaryOrangeDisabled] : [bcctColors.primaryOrange, bcctColors.primaryOrangeDark]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={[styles.saveButton, checkinSaving && styles.saveButtonDisabled]}
                  >
                    {checkinSaving ? (
                      <ActivityIndicator color="#fff" />
                    ) : (
                      <Text style={styles.saveButtonText}>Check-in opslaan</Text>
                    )}
                  </LinearGradient>
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
                style={[styles.actionCard, { backgroundColor: colors.card, borderColor: colors.border }]}
                onPress={() => {
                  if (action.route) {
                    router.push(action.route);
                  } else {
                    console.log("Action pressed:", action.id);
                  }
                }}
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
                <Text style={[styles.actionDescription, { color: bcctColors.textSecondary }]}>
                  {action.description}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Overzicht van Vandaag</Text>
          <View style={[styles.overviewCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.overviewItem}>
              <IconSymbol
                ios_icon_name="checkmark.circle"
                android_material_icon_name="check-circle"
                size={24}
                color={bcctColors.success}
              />
              <View style={styles.overviewText}>
                <Text style={[styles.overviewLabel, { color: bcctColors.textSecondary }]}>
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
                color={bcctColors.primaryOrange}
              />
              <View style={styles.overviewText}>
                <Text style={[styles.overviewLabel, { color: bcctColors.textSecondary }]}>
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
                    color={bcctColors.primaryOrangeLight}
                  />
                  <View style={styles.overviewText}>
                    <Text style={[styles.overviewLabel, { color: bcctColors.textSecondary }]}>
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
          <Text style={[styles.infoText, { color: bcctColors.textSecondary }]}>
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
    marginBottom: 24,
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
  checkinCard: {
    padding: 20,
    borderRadius: 20,
    borderWidth: 1,
    marginBottom: 32,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  checkinTitle: {
    ...bcctTypography.h3,
    marginBottom: 12,
  },
  checkinInput: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    ...bcctTypography.body,
    minHeight: 80,
    textAlignVertical: "top",
    marginBottom: 4,
  },
  charCount: {
    ...bcctTypography.small,
    textAlign: "right",
    marginBottom: 16,
  },
  sliderContainer: {
    marginBottom: 20,
  },
  sliderHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
    gap: 12,
  },
  sliderLabel: {
    ...bcctTypography.bodyMedium,
    flex: 1,
  },
  sliderTextLabel: {
    ...bcctTypography.smallMedium,
  },
  lockButton: {
    padding: 8,
    borderRadius: 8,
  },
  lockButtonActive: {
    backgroundColor: bcctColors.error + "20",
  },
  sliderTrack: {
    height: 8,
    borderRadius: 4,
    overflow: "hidden",
    marginBottom: -40,
  },
  sliderFill: {
    height: "100%",
    borderRadius: 4,
  },
  slider: {
    width: "100%",
    height: 40,
  },
  saveButtonContainer: {
    borderRadius: 12,
    overflow: 'hidden',
    marginTop: 8,
  },
  saveButton: {
    paddingVertical: 14,
    alignItems: "center",
  },
  saveButtonDisabled: {
    opacity: 0.7,
  },
  saveButtonText: {
    color: "#FFFFFF",
    ...bcctTypography.button,
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
    ...bcctTypography.h3,
  },
  checkinCollapsedValues: {
    flexDirection: "row",
    gap: 16,
    paddingLeft: 36,
  },
  checkinCollapsedValue: {
    ...bcctTypography.bodyMedium,
  },
  section: {
    marginBottom: 32,
  },
  sectionTitle: {
    ...bcctTypography.h3,
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
    borderRadius: 20,
    borderWidth: 1,
    gap: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
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
    ...bcctTypography.bodyMedium,
  },
  actionDescription: {
    ...bcctTypography.small,
  },
  overviewCard: {
    padding: 20,
    borderRadius: 20,
    borderWidth: 1,
    gap: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
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
    ...bcctTypography.small,
  },
  overviewValue: {
    ...bcctTypography.h3,
  },
  divider: {
    height: 1,
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
