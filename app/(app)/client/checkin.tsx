
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
import { supabase } from "@/lib/supabase";
import Slider from "@react-native-community/slider";
import { LinearGradient } from "expo-linear-gradient";
import { bcctColors, bcctTypography } from "@/styles/bcctTheme";

interface ThemeItem {
  id: string;
  label: string;
  sort_order: number;
}

interface SliderValue {
  theme_item_id: string;
  value: number;
}

export default function ClientCheckinScreen() {
  const { colors } = useTheme();
  const { user } = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTheme, setActiveTheme] = useState<any>(null);
  const [themeItems, setThemeItems] = useState<ThemeItem[]>([]);
  const [sliderValues, setSliderValues] = useState<SliderValue[]>([]);
  const [feelingText, setFeelingText] = useState("");
  const [modalVisible, setModalVisible] = useState(false);
  const [modalTitle, setModalTitle] = useState("");
  const [modalMessage, setModalMessage] = useState("");

  const showModal = (title: string, message: string) => {
    setModalTitle(title);
    setModalMessage(message);
    setModalVisible(true);
  };

  useEffect(() => {
    fetchActiveTheme();
  }, []);

  const fetchActiveTheme = async () => {
    console.log("[Client Checkin] Fetching active theme");
    try {
      const { data: session } = await supabase.auth.getSession();
      if (!session?.session?.user) {
        console.error("[Client Checkin] No user session");
        return;
      }

      const { data: assignment, error: assignmentError } = await supabase
        .from("client_theme_assignments")
        .select("*, themes(*)")
        .eq("client_id", session.session.user.id)
        .eq("active", true)
        .single();

      if (assignmentError && assignmentError.code !== "PGRST116") {
        console.error("[Client Checkin] Error fetching assignment", assignmentError);
        showModal("Fout", "Kon actief thema niet laden");
        return;
      }

      if (!assignment) {
        console.log("[Client Checkin] No active theme assigned");
        setLoading(false);
        return;
      }

      console.log("[Client Checkin] Active theme found", assignment);
      setActiveTheme(assignment.themes);

      const { data: items, error: itemsError } = await supabase
        .from("theme_items")
        .select("*")
        .eq("theme_id", assignment.theme_id)
        .eq("is_active", true)
        .order("sort_order", { ascending: true });

      if (itemsError) {
        console.error("[Client Checkin] Error fetching items", itemsError);
        showModal("Fout", "Kon vragen niet laden");
        return;
      }

      console.log("[Client Checkin] Theme items loaded", items);
      setThemeItems(items || []);
      setSliderValues((items || []).map(item => ({
        theme_item_id: item.id,
        value: 50,
      })));

      await fetchTodayCheckin(session.session.user.id);
    } catch (error: any) {
      console.error("[Client Checkin] Error fetching active theme", error);
      showModal("Fout", "Kon actief thema niet laden");
    } finally {
      setLoading(false);
    }
  };

  const fetchTodayCheckin = async (userId: string) => {
    console.log("[Client Checkin] Fetching today's check-in");
    try {
      const today = new Date().toISOString().split("T")[0];

      const { data: checkin, error: checkinError } = await supabase
        .from("checkins")
        .select("*")
        .eq("user_id", userId)
        .eq("date", today)
        .single();

      if (checkinError && checkinError.code !== "PGRST116") {
        console.error("[Client Checkin] Error fetching checkin", checkinError);
        return;
      }

      if (!checkin) {
        console.log("[Client Checkin] No checkin found for today");
        return;
      }

      console.log("[Client Checkin] Today's checkin found", checkin);
      setFeelingText(checkin.feeling_text || "");

      const { data: responses, error: responsesError } = await supabase
        .from("checkin_responses")
        .select("*")
        .eq("checkin_id", checkin.id);

      if (responsesError) {
        console.error("[Client Checkin] Error fetching responses", responsesError);
        return;
      }

      if (responses && responses.length > 0) {
        console.log("[Client Checkin] Responses loaded", responses);
        setSliderValues(responses.map(r => ({
          theme_item_id: r.theme_item_id,
          value: r.value_int,
        })));
      }
    } catch (error: any) {
      console.error("[Client Checkin] Error fetching today's checkin", error);
    }
  };

  const saveCheckin = async () => {
    console.log("[Client Checkin] Saving check-in");
    setSaving(true);
    try {
      const { data: session } = await supabase.auth.getSession();
      if (!session?.session?.user) {
        showModal("Fout", "Je bent niet ingelogd");
        return;
      }

      const today = new Date().toISOString().split("T")[0];

      const { data: checkin, error: checkinError } = await supabase
        .from("checkins")
        .upsert({
          user_id: session.session.user.id,
          date: today,
          feeling_text: feelingText,
          energy: 50,
          stress: 50,
          sleep: 50,
          mood: 5,
        }, {
          onConflict: "user_id,date",
        })
        .select()
        .single();

      if (checkinError) {
        console.error("[Client Checkin] Error saving checkin", checkinError);
        showModal("Fout", "Kon check-in niet opslaan");
        return;
      }

      console.log("[Client Checkin] Checkin saved", checkin);

      const { error: deleteError } = await supabase
        .from("checkin_responses")
        .delete()
        .eq("checkin_id", checkin.id);

      if (deleteError) {
        console.error("[Client Checkin] Error deleting old responses", deleteError);
      }

      const responses = sliderValues.map(sv => ({
        checkin_id: checkin.id,
        theme_item_id: sv.theme_item_id,
        value_int: sv.value,
      }));

      const { error: responsesError } = await supabase
        .from("checkin_responses")
        .insert(responses);

      if (responsesError) {
        console.error("[Client Checkin] Error saving responses", responsesError);
        showModal("Fout", "Kon antwoorden niet opslaan");
        return;
      }

      console.log("[Client Checkin] Check-in saved successfully");
      showModal("Opgeslagen ✓", "Je check-in is succesvol opgeslagen");
      router.back();
    } catch (error: any) {
      console.error("[Client Checkin] Error saving check-in", error);
      showModal("Fout", "Kon check-in niet opslaan");
    } finally {
      setSaving(false);
    }
  };

  const updateSliderValue = (themeItemId: string, value: number) => {
    setSliderValues(sliderValues.map(sv =>
      sv.theme_item_id === themeItemId ? { ...sv, value: Math.round(value) } : sv
    ));
  };

  const getSliderValue = (themeItemId: string) => {
    const sv = sliderValues.find(s => s.theme_item_id === themeItemId);
    return sv ? sv.value : 50;
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

  if (!activeTheme) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={["top"]}>
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.back()}
          >
            <IconSymbol
              ios_icon_name="chevron.left"
              android_material_icon_name="arrow-back"
              size={24}
              color={colors.text}
            />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.text }]}>Check-in</Text>
          <View style={styles.placeholder} />
        </View>
        <View style={styles.emptyState}>
          <IconSymbol
            ios_icon_name="exclamationmark.circle"
            android_material_icon_name="info"
            size={64}
            color={bcctColors.textSecondary}
          />
          <Text style={[styles.emptyTitle, { color: colors.text }]}>
            Geen actief thema
          </Text>
          <Text style={[styles.emptyDescription, { color: bcctColors.textSecondary }]}>
            Je coach heeft nog geen thema gekoppeld.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <>
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={["top"]}>
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.back()}
          >
            <IconSymbol
              ios_icon_name="chevron.left"
              android_material_icon_name="arrow-back"
              size={24}
              color={colors.text}
            />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.text }]}>Check-in</Text>
          <View style={styles.placeholder} />
        </View>

        <ScrollView contentContainerStyle={styles.scrollContent}>
          <View style={[styles.themeCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.themeLabel, { color: bcctColors.textSecondary }]}>Actief thema</Text>
            <Text style={[styles.themeName, { color: colors.text }]}>{activeTheme.name}</Text>
          </View>

          <Text style={[styles.questionTitle, { color: colors.text }]}>
            Hoe voel je je vandaag?
          </Text>
          <TextInput
            style={[styles.textInput, { color: colors.text, borderColor: colors.border, backgroundColor: colors.background }]}
            placeholder="Typ hier hoe je je voelt…"
            placeholderTextColor={bcctColors.textSecondary}
            value={feelingText}
            onChangeText={setFeelingText}
            maxLength={250}
            multiline
          />
          <Text style={[styles.charCount, { color: bcctColors.textSecondary }]}>
            {feelingText.length}/250
          </Text>

          <Text style={[styles.sectionTitle, { color: colors.text }]}>Vragen</Text>

          {themeItems.map((item) => {
            const value = getSliderValue(item.id);
            const valueText = `${value}`;
            return (
              <View key={item.id} style={styles.sliderContainer}>
                <View style={styles.sliderHeader}>
                  <Text style={[styles.sliderLabel, { color: colors.text }]}>{item.label}</Text>
                  <Text style={[styles.sliderValue, { color: bcctColors.primaryOrange }]}>{valueText}</Text>
                </View>
                <View style={[styles.sliderTrack, { backgroundColor: colors.border }]}>
                  <View
                    style={[
                      styles.sliderFill,
                      {
                        width: `${value}%`,
                        backgroundColor: bcctColors.primaryOrange,
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
                  onValueChange={(v) => updateSliderValue(item.id, v)}
                  minimumTrackTintColor="transparent"
                  maximumTrackTintColor="transparent"
                  thumbTintColor={bcctColors.primaryOrange}
                />
              </View>
            );
          })}

          <TouchableOpacity
            style={styles.saveButtonContainer}
            onPress={saveCheckin}
            disabled={saving}
            activeOpacity={0.9}
          >
            <LinearGradient
              colors={saving ? [bcctColors.primaryOrangeDisabled, bcctColors.primaryOrangeDisabled] : [bcctColors.primaryOrange, bcctColors.primaryOrangeDark]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.saveButton}
            >
              {saving ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.saveButtonText}>Check-in opslaan</Text>
              )}
            </LinearGradient>
          </TouchableOpacity>
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
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: "center",
    alignItems: "center",
  },
  headerTitle: {
    ...bcctTypography.h2,
    flex: 1,
    textAlign: "center",
  },
  placeholder: {
    width: 40,
  },
  scrollContent: {
    padding: 20,
  },
  themeCard: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 24,
  },
  themeLabel: {
    ...bcctTypography.small,
    marginBottom: 4,
  },
  themeName: {
    ...bcctTypography.h3,
  },
  questionTitle: {
    ...bcctTypography.h3,
    marginBottom: 12,
  },
  textInput: {
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
    marginBottom: 24,
  },
  sectionTitle: {
    ...bcctTypography.h3,
    marginBottom: 16,
  },
  sliderContainer: {
    marginBottom: 24,
  },
  sliderHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  sliderLabel: {
    ...bcctTypography.bodyMedium,
  },
  sliderValue: {
    ...bcctTypography.h3,
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
    overflow: "hidden",
    marginTop: 16,
  },
  saveButton: {
    paddingVertical: 14,
    alignItems: "center",
  },
  saveButtonText: {
    color: "#FFFFFF",
    ...bcctTypography.button,
  },
  emptyState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 60,
    gap: 16,
  },
  emptyTitle: {
    ...bcctTypography.h3,
  },
  emptyDescription: {
    ...bcctTypography.body,
    textAlign: "center",
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
