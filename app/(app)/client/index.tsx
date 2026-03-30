
import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Animated,
  ScrollView,
} from "react-native";
import Modal from "react-native-modal";
import { useTheme } from "@react-navigation/native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "@/contexts/AuthContext";
import { IconSymbol } from "@/components/IconSymbol";
import { useRouter } from "expo-router";
import { supabase } from "@/lib/supabase";
import Slider from "@react-native-community/slider";
import { Send } from "lucide-react-native";
import { bcctColors, bcctTypography, getSliderColor, getEnergyLabel, getStressLabel, getSleepLabel } from "@/styles/bcctTheme";

interface CheckinData {
  energy: number;
  stress: number;
  sleep: number;
}

interface ActionTile {
  id: string;
  title: string;
  subtitle: string;
  ios_icon: string;
  android_icon: string;
  route: string | null;
}

const ACTION_TILES: ActionTile[] = [
  {
    id: "checkin",
    title: "Thema Check-in",
    subtitle: "Vul je dagelijkse check-in in",
    ios_icon: "checkmark.circle",
    android_icon: "check-circle",
    route: "/(app)/client/checkin",
  },
  {
    id: "program",
    title: "Mijn Programma",
    subtitle: "Bekijk je trainingsplan",
    ios_icon: "list.bullet",
    android_icon: "list",
    route: null,
  },
  {
    id: "chat",
    title: "Chat met Coach",
    subtitle: "Stuur een bericht",
    ios_icon: "message",
    android_icon: "chat",
    route: null,
  },
  {
    id: "appointments",
    title: "Afspraken",
    subtitle: "Jouw geplande sessies",
    ios_icon: "calendar",
    android_icon: "event",
    route: null,
  },
  {
    id: "mycoach",
    title: "Mijn Coach",
    subtitle: "Profiel & contact",
    ios_icon: "person.circle",
    android_icon: "person",
    route: "/(app)/client/settings",
  },
  {
    id: "profile",
    title: "Mijn Profiel",
    subtitle: "Instellingen & gegevens",
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

  // Inline edit state
  const [editExpanded, setEditExpanded] = useState(false);
  const [editEnergy, setEditEnergy] = useState(50);
  const [editStress, setEditStress] = useState(50);
  const [editSleep, setEditSleep] = useState(50);
  const [saving, setSaving] = useState(false);
  const [sending, setSending] = useState(false);

  const expandAnim = useRef(new Animated.Value(0)).current;

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
        const loaded: CheckinData = { energy: data.energy, stress: data.stress, sleep: data.sleep };
        setCheckinData(loaded);
        setTodayCheckinSaved(true);
        setEditEnergy(data.energy);
        setEditStress(data.stress);
        setEditSleep(data.sleep);
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

  const toggleEdit = () => {
    const toExpand = !editExpanded;
    console.log("[Client] Check-in card edit toggled:", toExpand ? "expanded" : "collapsed");
    setEditExpanded(toExpand);
    Animated.spring(expandAnim, {
      toValue: toExpand ? 1 : 0,
      useNativeDriver: false,
      tension: 60,
      friction: 10,
    }).start();
  };

  const saveInlineCheckin = async () => {
    console.log("[Client] Saving inline check-in — energy:", editEnergy, "stress:", editStress, "sleep:", editSleep);
    setSaving(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData?.session?.user) {
        showModal("Fout", "Je bent niet ingelogd");
        return;
      }
      const today = new Date().toISOString().split("T")[0];

      const { error } = await supabase
        .from("checkins")
        .upsert(
          {
            user_id: sessionData.session.user.id,
            date: today,
            energy: editEnergy,
            stress: editStress,
            sleep: editSleep,
            mood: 5,
          },
          { onConflict: "user_id,date" }
        );

      if (error) {
        console.error("[Client] Error saving inline check-in", error);
        showModal("Fout", "Kon check-in niet opslaan");
        return;
      }

      console.log("[Client] Inline check-in saved successfully");
      setCheckinData({ energy: editEnergy, stress: editStress, sleep: editSleep });
      setTodayCheckinSaved(true);
      toggleEdit();
    } catch (err: any) {
      console.error("[Client] Unexpected error saving inline check-in", err);
      showModal("Fout", "Kon check-in niet opslaan");
    } finally {
      setSaving(false);
    }
  };

  const sendToCoach = async () => {
    const energy = checkinData?.energy ?? editEnergy;
    const stress = checkinData?.stress ?? editStress;
    const sleep = checkinData?.sleep ?? editSleep;

    const energyScaled = Math.round(energy / 10);
    const stressScaled = Math.round(stress / 10);
    const sleepScaled = Math.round(sleep / 10);

    const messageBody = `📊 Check-in van vandaag:\n• Energie: ${energyScaled}/10\n• Stress: ${stressScaled}/10\n• Slaap: ${sleepScaled}/10`;

    console.log("[Client] Stuur naar coach pressed — message:", messageBody);
    setSending(true);

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData?.session?.user) {
        showModal("Fout", "Je bent niet ingelogd");
        return;
      }
      const userId = sessionData.session.user.id;

      // Find or create conversation with coach
      const { data: existingConvs, error: convError } = await supabase
        .from("conversations")
        .select("id")
        .eq("client_id", userId)
        .limit(1);

      if (convError) {
        console.error("[Client] Error fetching conversations for send-to-coach", convError);
        showModal("Fout", "Kon gesprek niet vinden");
        return;
      }

      let conversationId: string | null = null;

      if (existingConvs && existingConvs.length > 0) {
        conversationId = existingConvs[0].id;
        console.log("[Client] Using existing conversation:", conversationId);
      } else {
        // No conversation yet — find linked coach and create one
        const { data: coachLinks, error: coachError } = await supabase
          .from("coach_clients")
          .select("coach_id")
          .eq("client_id", userId)
          .eq("status", "active")
          .limit(1);

        if (coachError || !coachLinks || coachLinks.length === 0) {
          console.warn("[Client] No linked coach found for send-to-coach");
          showModal("Geen coach", "Je hebt nog geen gekoppelde coach. Ga naar Chat om een gesprek te starten.");
          return;
        }

        const coachId = coachLinks[0].coach_id;
        console.log("[Client] Creating new conversation with coach:", coachId);

        const { data: newConv, error: insertError } = await supabase
          .from("conversations")
          .insert({ coach_id: coachId, client_id: userId })
          .select("id")
          .single();

        if (insertError || !newConv) {
          console.error("[Client] Error creating conversation", insertError);
          showModal("Fout", "Kon gesprek niet aanmaken");
          return;
        }

        conversationId = newConv.id;
        console.log("[Client] New conversation created:", conversationId);
      }

      // Send the message
      console.log("[Client] Sending check-in message to conversation:", conversationId);
      const { error: msgError } = await supabase
        .from("messages")
        .insert({
          conversation_id: conversationId,
          sender_id: userId,
          body: messageBody,
          created_at: new Date().toISOString(),
        });

      if (msgError) {
        console.error("[Client] Error sending check-in message", msgError);
        showModal("Fout", "Kon bericht niet versturen");
        return;
      }

      console.log("[Client] Check-in message sent successfully");
      showModal("Verstuurd ✓", "Je check-in is naar je coach gestuurd.");
    } catch (err: any) {
      console.error("[Client] Unexpected error in sendToCoach", err);
      showModal("Fout", "Kon bericht niet versturen");
    } finally {
      setSending(false);
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

  const energyLabel = getEnergyLabel(editEnergy);
  const stressLabel = getStressLabel(editStress);
  const sleepLabel = getSleepLabel(editSleep);

  const energyColor = getSliderColor(editEnergy, "energy");
  const stressColor = getSliderColor(editStress, "stress");
  const sleepColor = getSliderColor(editSleep, "sleep");

  const editButtonLabel = editExpanded ? "Sluiten" : "Aanpassen";

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
        <View style={[styles.checkinCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          {/* Card header */}
          <View style={styles.checkinCardHeader}>
            <View style={styles.checkinCardHeaderLeft}>
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
            {todayCheckinSaved && !checkinLoading && (
              <TouchableOpacity
                style={styles.editButton}
                onPress={toggleEdit}
                activeOpacity={0.7}
              >
                <Text style={styles.editButtonText}>{editButtonLabel}</Text>
              </TouchableOpacity>
            )}
          </View>

          {checkinLoading ? (
            <ActivityIndicator size="small" color={bcctColors.primaryOrange} style={{ marginTop: 12 }} />
          ) : todayCheckinSaved && checkinData ? (
            <>
              {/* Static metric bars (collapsed view) */}
              {!editExpanded && (
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
              )}

              {/* Expanded inline sliders */}
              {editExpanded && (
                <View style={styles.slidersContainer}>
                  {/* Energie slider */}
                  <View style={styles.sliderRow}>
                    <View style={styles.sliderLabelRow}>
                      <Text style={[styles.sliderName, { color: colors.text }]}>Energie</Text>
                      <Text style={[styles.sliderValueText, { color: energyColor }]}>{energyLabel}</Text>
                    </View>
                    <View style={[styles.sliderTrack, { backgroundColor: colors.border }]}>
                      <View
                        style={[
                          styles.sliderFill,
                          { width: `${editEnergy}%` as any, backgroundColor: energyColor },
                        ]}
                      />
                    </View>
                    <Slider
                      style={styles.slider}
                      minimumValue={0}
                      maximumValue={100}
                      step={1}
                      value={editEnergy}
                      onValueChange={(v) => {
                        setEditEnergy(Math.round(v));
                      }}
                      minimumTrackTintColor="transparent"
                      maximumTrackTintColor="transparent"
                      thumbTintColor={energyColor}
                    />
                  </View>

                  {/* Stress slider */}
                  <View style={styles.sliderRow}>
                    <View style={styles.sliderLabelRow}>
                      <Text style={[styles.sliderName, { color: colors.text }]}>Stress</Text>
                      <Text style={[styles.sliderValueText, { color: stressColor }]}>{stressLabel}</Text>
                    </View>
                    <View style={[styles.sliderTrack, { backgroundColor: colors.border }]}>
                      <View
                        style={[
                          styles.sliderFill,
                          { width: `${editStress}%` as any, backgroundColor: stressColor },
                        ]}
                      />
                    </View>
                    <Slider
                      style={styles.slider}
                      minimumValue={0}
                      maximumValue={100}
                      step={1}
                      value={editStress}
                      onValueChange={(v) => {
                        setEditStress(Math.round(v));
                      }}
                      minimumTrackTintColor="transparent"
                      maximumTrackTintColor="transparent"
                      thumbTintColor={stressColor}
                    />
                  </View>

                  {/* Slaap slider */}
                  <View style={styles.sliderRow}>
                    <View style={styles.sliderLabelRow}>
                      <Text style={[styles.sliderName, { color: colors.text }]}>Slaap</Text>
                      <Text style={[styles.sliderValueText, { color: sleepColor }]}>{sleepLabel}</Text>
                    </View>
                    <View style={[styles.sliderTrack, { backgroundColor: colors.border }]}>
                      <View
                        style={[
                          styles.sliderFill,
                          { width: `${editSleep}%` as any, backgroundColor: sleepColor },
                        ]}
                      />
                    </View>
                    <Slider
                      style={styles.slider}
                      minimumValue={0}
                      maximumValue={100}
                      step={1}
                      value={editSleep}
                      onValueChange={(v) => {
                        setEditSleep(Math.round(v));
                      }}
                      minimumTrackTintColor="transparent"
                      maximumTrackTintColor="transparent"
                      thumbTintColor={sleepColor}
                    />
                  </View>

                  {/* Save button */}
                  <TouchableOpacity
                    style={[styles.saveButton, saving && styles.saveButtonDisabled]}
                    onPress={saveInlineCheckin}
                    disabled={saving}
                    activeOpacity={0.8}
                  >
                    {saving ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <Text style={styles.saveButtonText}>Opslaan</Text>
                    )}
                  </TouchableOpacity>
                </View>
              )}

              {/* Send to coach button — always visible when check-in exists */}
              {!editExpanded && (
                <TouchableOpacity
                  style={[styles.sendButton, sending && styles.sendButtonDisabled]}
                  onPress={sendToCoach}
                  disabled={sending}
                  activeOpacity={0.8}
                >
                  {sending ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <>
                      <Send size={14} color="#fff" strokeWidth={2.5} />
                      <Text style={styles.sendButtonText}>Stuur naar coach</Text>
                    </>
                  )}
                </TouchableOpacity>
              )}
            </>
          ) : (
            <TouchableOpacity
              onPress={() => {
                console.log("[Client] Check-in empty state tapped, navigating to checkin");
                router.push("/(app)/client/checkin");
              }}
              activeOpacity={0.75}
            >
              <Text style={[styles.checkinEmptyText, { color: bcctColors.textSecondary }]}>
                Nog niet ingevuld vandaag — tik om in te vullen
              </Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Action grid — 2 columns × 3 rows */}
        <View style={styles.grid}>
          {ACTION_TILES.map((tile) => (
            <TouchableOpacity
              key={tile.id}
              style={[styles.tile, { backgroundColor: colors.card }]}
              onPress={() => handleTilePress(tile)}
              activeOpacity={0.7}
            >
              <View style={styles.tileIconRow}>
                <IconSymbol
                  ios_icon_name={tile.ios_icon}
                  android_material_icon_name={tile.android_icon}
                  size={20}
                  color={bcctColors.textSecondary}
                />
                <Text style={[styles.tileLabel, { color: colors.text }]}>{tile.title}</Text>
              </View>
              <Text style={[styles.tileSubtitle, { color: bcctColors.textSecondary }]}>{tile.subtitle}</Text>
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
  checkinCardHeaderLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  checkinCardLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: "#9AA5B4",
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  editButton: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: bcctColors.primaryOrange + "18",
  },
  editButtonText: {
    fontSize: 12,
    fontWeight: "600",
    color: bcctColors.primaryOrange,
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
  // Inline sliders
  slidersContainer: {
    gap: 4,
  },
  sliderRow: {
    marginBottom: 4,
  },
  sliderLabelRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
  },
  sliderName: {
    fontSize: 13,
    fontWeight: "600",
  },
  sliderValueText: {
    fontSize: 13,
    fontWeight: "700",
  },
  sliderTrack: {
    height: 6,
    borderRadius: 3,
    overflow: "hidden",
    marginBottom: -34,
    marginHorizontal: 2,
  },
  sliderFill: {
    height: "100%",
    borderRadius: 3,
  },
  slider: {
    width: "100%",
    height: 34,
  },
  saveButton: {
    marginTop: 10,
    backgroundColor: bcctColors.primaryOrange,
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  saveButtonDisabled: {
    backgroundColor: bcctColors.primaryOrangeDisabled,
  },
  saveButtonText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "700",
  },
  // Send to coach button
  sendButton: {
    marginTop: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: bcctColors.primaryOrange,
    borderRadius: 10,
    paddingVertical: 9,
  },
  sendButtonDisabled: {
    backgroundColor: bcctColors.primaryOrangeDisabled,
  },
  sendButtonText: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "700",
  },
  // Grid
  grid: {
    flex: 1,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    alignContent: "flex-start",
  },
  tile: {
    width: "47.5%",
    flex: 0,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.07)",
    paddingHorizontal: 14,
    paddingVertical: 14,
    justifyContent: "flex-start",
    alignItems: "flex-start",
    gap: 6,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  tileIconRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
  },
  tileLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: bcctColors.textPrimary,
    flexShrink: 1,
  },
  tileSubtitle: {
    fontSize: 11,
    fontWeight: "400",
    lineHeight: 15,
    paddingLeft: 1,
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
