
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
import { IconSymbol } from "@/components/IconSymbol";
import { useRouter, useLocalSearchParams } from "expo-router";
import { supabase } from "@/lib/supabase";
import { bcctColors, bcctTypography } from "@/styles/bcctTheme";
import { LinearGradient } from "expo-linear-gradient";

interface Client {
  id: string;
  full_name: string;
  email: string;
}

interface Theme {
  id: string;
  name: string;
  description: string;
}

export default function ClientDetailScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const { id } = useLocalSearchParams();
  const [loading, setLoading] = useState(true);
  const [client, setClient] = useState<Client | null>(null);
  const [themes, setThemes] = useState<Theme[]>([]);
  const [activeThemeId, setActiveThemeId] = useState<string | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [modalTitle, setModalTitle] = useState("");
  const [modalMessage, setModalMessage] = useState("");
  const [themeModalVisible, setThemeModalVisible] = useState(false);
  const [saving, setSaving] = useState(false);

  const showModal = (title: string, message: string) => {
    setModalTitle(title);
    setModalMessage(message);
    setModalVisible(true);
  };

  useEffect(() => {
    if (id) {
      fetchClientDetails();
      fetchThemes();
    }
  }, [id]);

  const fetchClientDetails = async () => {
    console.log("[Client Detail] Fetching client details for", id);
    try {
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("id, full_name, email")
        .eq("id", id)
        .single();

      if (profileError) {
        console.error("[Client Detail] Error fetching profile", profileError);
        showModal("Fout", "Kon cliënt niet laden");
        return;
      }

      setClient(profile);

      const { data: assignment, error: assignmentError } = await supabase
        .from("client_theme_assignments")
        .select("theme_id")
        .eq("client_id", id)
        .eq("active", true)
        .single();

      if (assignmentError && assignmentError.code !== "PGRST116") {
        console.error("[Client Detail] Error fetching assignment", assignmentError);
      }

      if (assignment) {
        console.log("[Client Detail] Active theme found", assignment.theme_id);
        setActiveThemeId(assignment.theme_id);
      }
    } catch (error: any) {
      console.error("[Client Detail] Error fetching client details", error);
      showModal("Fout", "Kon cliënt niet laden");
    } finally {
      setLoading(false);
    }
  };

  const fetchThemes = async () => {
    console.log("[Client Detail] Fetching themes");
    try {
      const { data: session } = await supabase.auth.getSession();
      if (!session?.session?.user) {
        console.error("[Client Detail] No user session");
        return;
      }

      const { data, error } = await supabase
        .from("themes")
        .select("id, name, description")
        .eq("created_by", session.session.user.id)
        .order("name", { ascending: true });

      if (error) {
        console.error("[Client Detail] Error fetching themes", error);
        showModal("Fout", "Kon thema's niet laden");
        return;
      }

      console.log("[Client Detail] Themes loaded", data);
      setThemes(data || []);
    } catch (error: any) {
      console.error("[Client Detail] Error fetching themes", error);
      showModal("Fout", "Kon thema's niet laden");
    }
  };

  const assignTheme = async (themeId: string) => {
    console.log("[Client Detail] Assigning theme", themeId, "to client", id);
    setSaving(true);
    try {
      const { error: deactivateError } = await supabase
        .from("client_theme_assignments")
        .update({ active: false })
        .eq("client_id", id)
        .eq("active", true);

      if (deactivateError) {
        console.error("[Client Detail] Error deactivating old assignments", deactivateError);
      }

      const { error: insertError } = await supabase
        .from("client_theme_assignments")
        .insert({
          client_id: id,
          theme_id: themeId,
          active: true,
          start_date: new Date().toISOString().split("T")[0],
        });

      if (insertError) {
        console.error("[Client Detail] Error assigning theme", insertError);
        showModal("Fout", "Kon thema niet toewijzen");
        return;
      }

      console.log("[Client Detail] Theme assigned successfully");
      setActiveThemeId(themeId);
      setThemeModalVisible(false);
      showModal("Succes", "Thema succesvol toegewezen");
    } catch (error: any) {
      console.error("[Client Detail] Error assigning theme", error);
      showModal("Fout", "Kon thema niet toewijzen");
    } finally {
      setSaving(false);
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

  if (!client) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={["top"]}>
        <View style={styles.errorContainer}>
          <Text style={[styles.errorText, { color: colors.text }]}>Cliënt niet gevonden</Text>
        </View>
      </SafeAreaView>
    );
  }

  const activeTheme = themes.find(t => t.id === activeThemeId);
  const activeThemeText = activeTheme ? activeTheme.name : "Geen thema toegewezen";

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
          <Text style={[styles.headerTitle, { color: colors.text }]}>Cliënt Detail</Text>
          <View style={styles.placeholder} />
        </View>

        <ScrollView contentContainerStyle={styles.scrollContent}>
          <View style={[styles.clientCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={[styles.clientAvatar, { backgroundColor: bcctColors.primaryOrange + "20" }]}>
              <IconSymbol
                ios_icon_name="person"
                android_material_icon_name="person"
                size={48}
                color={bcctColors.primaryOrange}
              />
            </View>
            <Text style={[styles.clientName, { color: colors.text }]}>{client.full_name}</Text>
            <Text style={[styles.clientEmail, { color: bcctColors.textSecondary }]}>
              {client.email}
            </Text>
          </View>

          <View style={[styles.themeCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.themeHeader}>
              <Text style={[styles.themeLabel, { color: bcctColors.textSecondary }]}>Actief Thema</Text>
              <TouchableOpacity
                style={styles.changeButton}
                onPress={() => setThemeModalVisible(true)}
              >
                <Text style={[styles.changeButtonText, { color: bcctColors.primaryOrange }]}>
                  Wijzigen
                </Text>
              </TouchableOpacity>
            </View>
            <Text style={[styles.themeName, { color: colors.text }]}>{activeThemeText}</Text>
            {activeTheme?.description ? (
              <Text style={[styles.themeDescription, { color: bcctColors.textSecondary }]}>
                {activeTheme.description}
              </Text>
            ) : null}
          </View>

          {/* Bottom padding for tab bar */}
          <View style={{ height: 100 }} />
        </ScrollView>
      </SafeAreaView>

      <Modal
        isVisible={themeModalVisible}
        onBackdropPress={() => setThemeModalVisible(false)}
        onBackButtonPress={() => setThemeModalVisible(false)}
        animationIn="slideInUp"
        animationOut="slideOutDown"
        backdropOpacity={0.5}
        style={styles.bottomModal}
      >
        <View style={[styles.themeModalContent, { backgroundColor: colors.card }]}>
          <View style={styles.modalHandle} />
          <Text style={[styles.modalTitle, { color: colors.text }]}>Selecteer Thema</Text>
          <ScrollView style={styles.themesList}>
            {themes.length === 0 ? (
              <View style={styles.emptyThemes}>
                <Text style={[styles.emptyText, { color: bcctColors.textSecondary }]}>
                  Geen thema&apos;s beschikbaar. Maak eerst een thema aan.
                </Text>
              </View>
            ) : (
              themes.map((theme) => {
                const isActive = theme.id === activeThemeId;
                return (
                  <TouchableOpacity
                    key={theme.id}
                    style={[
                      styles.themeOption,
                      { borderColor: colors.border },
                      isActive && { borderColor: bcctColors.primaryOrange, backgroundColor: bcctColors.primaryOrange + "10" }
                    ]}
                    onPress={() => assignTheme(theme.id)}
                    disabled={saving}
                  >
                    <View style={styles.themeOptionContent}>
                      <Text style={[styles.themeOptionName, { color: colors.text }]}>{theme.name}</Text>
                      {theme.description ? (
                        <Text style={[styles.themeOptionDescription, { color: bcctColors.textSecondary }]}>
                          {theme.description}
                        </Text>
                      ) : null}
                    </View>
                    {isActive ? (
                      <IconSymbol
                        ios_icon_name="checkmark.circle.fill"
                        android_material_icon_name="check-circle"
                        size={24}
                        color={bcctColors.primaryOrange}
                      />
                    ) : null}
                  </TouchableOpacity>
                );
              })
            )}
          </ScrollView>
        </View>
      </Modal>

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
  errorContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  errorText: {
    ...bcctTypography.h3,
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
  clientCard: {
    padding: 24,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: "center",
    marginBottom: 24,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  clientAvatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
  },
  clientName: {
    ...bcctTypography.h2,
    marginBottom: 4,
  },
  clientEmail: {
    ...bcctTypography.body,
  },
  themeCard: {
    padding: 20,
    borderRadius: 20,
    borderWidth: 1,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  themeHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  themeLabel: {
    ...bcctTypography.small,
  },
  changeButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  changeButtonText: {
    ...bcctTypography.bodyMedium,
  },
  themeName: {
    ...bcctTypography.h3,
    marginBottom: 8,
  },
  themeDescription: {
    ...bcctTypography.body,
  },
  bottomModal: {
    justifyContent: "flex-end",
    margin: 0,
  },
  themeModalContent: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 24,
    maxHeight: "80%",
  },
  modalHandle: {
    width: 40,
    height: 4,
    backgroundColor: "#ccc",
    borderRadius: 2,
    alignSelf: "center",
    marginBottom: 16,
  },
  themesList: {
    marginTop: 16,
  },
  emptyThemes: {
    padding: 24,
    alignItems: "center",
  },
  emptyText: {
    ...bcctTypography.body,
    textAlign: "center",
  },
  themeOption: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 12,
    gap: 12,
  },
  themeOptionContent: {
    flex: 1,
    gap: 4,
  },
  themeOptionName: {
    ...bcctTypography.bodyMedium,
  },
  themeOptionDescription: {
    ...bcctTypography.small,
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
