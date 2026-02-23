
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
import { bcctColors, bcctTypography } from "@/styles/bcctTheme";
import { LinearGradient } from "expo-linear-gradient";

interface Theme {
  id: string;
  name: string;
  description: string;
  created_at: string;
  item_count?: number;
}

export default function CoachModulesScreen() {
  const { colors } = useTheme();
  const { user } = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [themes, setThemes] = useState<Theme[]>([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [modalTitle, setModalTitle] = useState("");
  const [modalMessage, setModalMessage] = useState("");
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [newThemeName, setNewThemeName] = useState("");
  const [newThemeDescription, setNewThemeDescription] = useState("");
  const [creating, setCreating] = useState(false);

  const showModal = (title: string, message: string) => {
    setModalTitle(title);
    setModalMessage(message);
    setModalVisible(true);
  };

  useEffect(() => {
    fetchThemes();
  }, []);

  const fetchThemes = async () => {
    console.log("[Coach Modules] Fetching themes");
    try {
      const { data: session } = await supabase.auth.getSession();
      if (!session?.session?.user) {
        console.error("[Coach Modules] No user session");
        return;
      }

      const { data, error } = await supabase
        .from("themes")
        .select("*, theme_items(count)")
        .eq("created_by", session.session.user.id)
        .order("created_at", { ascending: false });

      if (error) {
        console.error("[Coach Modules] Error fetching themes", error);
        showModal("Fout", "Kon thema's niet laden");
        return;
      }

      const themesWithCount = data.map((theme: any) => ({
        ...theme,
        item_count: theme.theme_items?.[0]?.count || 0,
      }));

      console.log("[Coach Modules] Themes loaded", themesWithCount);
      setThemes(themesWithCount);
    } catch (error: any) {
      console.error("[Coach Modules] Error fetching themes", error);
      showModal("Fout", "Kon thema's niet laden");
    } finally {
      setLoading(false);
    }
  };

  const createTheme = async () => {
    if (!newThemeName.trim()) {
      showModal("Fout", "Vul een naam in voor het thema");
      return;
    }

    console.log("[Coach Modules] Creating theme", newThemeName);
    setCreating(true);
    try {
      const { data: session } = await supabase.auth.getSession();
      if (!session?.session?.user) {
        showModal("Fout", "Je bent niet ingelogd");
        return;
      }

      const { data, error } = await supabase
        .from("themes")
        .insert({
          name: newThemeName.trim(),
          description: newThemeDescription.trim(),
          created_by: session.session.user.id,
        })
        .select()
        .single();

      if (error) {
        console.error("[Coach Modules] Error creating theme", error);
        showModal("Fout", "Kon thema niet aanmaken");
        return;
      }

      console.log("[Coach Modules] Theme created", data);
      setCreateModalVisible(false);
      setNewThemeName("");
      setNewThemeDescription("");
      fetchThemes();
      showModal("Succes", "Thema succesvol aangemaakt");
    } catch (error: any) {
      console.error("[Coach Modules] Error creating theme", error);
      showModal("Fout", "Kon thema niet aanmaken");
    } finally {
      setCreating(false);
    }
  };

  const seedDefaultThemes = async () => {
    console.log("[Coach Modules] Seeding default themes");
    setLoading(true);
    try {
      const { data: session } = await supabase.auth.getSession();
      if (!session?.session?.user) {
        showModal("Fout", "Je bent niet ingelogd");
        return;
      }

      const defaultThemes = [
        {
          name: "Burn-out",
          description: "Module voor burn-out begeleiding",
          items: ["Belastbaarheid", "Herstel", "Werkdruk", "Energieverlies"],
        },
        {
          name: "Angst/paniek",
          description: "Module voor angst en paniek begeleiding",
          items: ["Angstintensiteit", "Vermijding", "Lichamelijke spanning", "Veiligheidsgevoel"],
        },
        {
          name: "HSP/Autisme",
          description: "Module voor HSP en autisme begeleiding",
          items: ["Prikkelbelasting", "Sociale energie", "Structuur/voorspelbaarheid", "Hersteltijd"],
        },
        {
          name: "ADHD",
          description: "Module voor ADHD begeleiding",
          items: ["Focus", "Afleiding", "Taakstart", "Impulsiviteit"],
        },
      ];

      for (const theme of defaultThemes) {
        const { data: themeData, error: themeError } = await supabase
          .from("themes")
          .insert({
            name: theme.name,
            description: theme.description,
            created_by: session.session.user.id,
          })
          .select()
          .single();

        if (themeError) {
          console.error("[Coach Modules] Error creating theme", themeError);
          continue;
        }

        const items = theme.items.map((label, index) => ({
          theme_id: themeData.id,
          label,
          type: "slider",
          min_value: 0,
          max_value: 100,
          sort_order: index + 1,
          is_active: true,
        }));

        const { error: itemsError } = await supabase
          .from("theme_items")
          .insert(items);

        if (itemsError) {
          console.error("[Coach Modules] Error creating theme items", itemsError);
        }
      }

      console.log("[Coach Modules] Default themes seeded");
      fetchThemes();
      showModal("Succes", "Standaard thema's zijn aangemaakt");
    } catch (error: any) {
      console.error("[Coach Modules] Error seeding themes", error);
      showModal("Fout", "Kon standaard thema's niet aanmaken");
    } finally {
      setLoading(false);
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
          <Text style={[styles.headerTitle, { color: colors.text }]}>Modules</Text>
          <TouchableOpacity
            style={styles.addButton}
            onPress={() => setCreateModalVisible(true)}
          >
            <IconSymbol
              ios_icon_name="plus"
              android_material_icon_name="add"
              size={24}
              color={bcctColors.primaryOrange}
            />
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={styles.scrollContent}>
          {themes.length === 0 ? (
            <View style={styles.emptyState}>
              <IconSymbol
                ios_icon_name="folder"
                android_material_icon_name="folder"
                size={64}
                color={bcctColors.textSecondary}
              />
              <Text style={[styles.emptyTitle, { color: colors.text }]}>
                Geen modules gevonden
              </Text>
              <Text style={[styles.emptyDescription, { color: bcctColors.textSecondary }]}>
                Maak je eerste module aan of laad standaard modules
              </Text>
              <TouchableOpacity
                style={styles.seedButtonContainer}
                onPress={seedDefaultThemes}
              >
                <LinearGradient
                  colors={[bcctColors.primaryOrange, bcctColors.primaryOrangeDark]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.seedButton}
                >
                  <Text style={styles.seedButtonText}>Laad Standaard Modules</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.themesList}>
              {themes.map((theme) => {
                const itemCountText = `${theme.item_count || 0} vragen`;
                return (
                  <TouchableOpacity
                    key={theme.id}
                    style={[styles.themeCard, { backgroundColor: colors.card, borderColor: colors.border }]}
                    onPress={() => router.push(`/(app)/coach/theme-detail?id=${theme.id}`)}
                  >
                    <View style={styles.themeHeader}>
                      <View style={[styles.themeIcon, { backgroundColor: bcctColors.primaryOrange + "20" }]}>
                        <IconSymbol
                          ios_icon_name="folder"
                          android_material_icon_name="folder"
                          size={28}
                          color={bcctColors.primaryOrange}
                        />
                      </View>
                      <View style={styles.themeContent}>
                        <Text style={[styles.themeName, { color: colors.text }]}>{theme.name}</Text>
                        {theme.description ? (
                          <Text style={[styles.themeDescription, { color: bcctColors.textSecondary }]}>
                            {theme.description}
                          </Text>
                        ) : null}
                        <Text style={[styles.themeItemCount, { color: bcctColors.textSecondary }]}>
                          {itemCountText}
                        </Text>
                      </View>
                      <IconSymbol
                        ios_icon_name="chevron.right"
                        android_material_icon_name="chevron-right"
                        size={20}
                        color={colors.text}
                        style={{ opacity: 0.4 }}
                      />
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}

          {/* Bottom padding for tab bar */}
          <View style={{ height: 100 }} />
        </ScrollView>
      </SafeAreaView>

      <Modal
        isVisible={createModalVisible}
        onBackdropPress={() => setCreateModalVisible(false)}
        onBackButtonPress={() => setCreateModalVisible(false)}
        animationIn="fadeIn"
        animationOut="fadeOut"
        backdropOpacity={0.5}
      >
        <View style={[styles.modalContent, { backgroundColor: colors.card }]}>
          <Text style={[styles.modalTitle, { color: colors.text }]}>Nieuw Thema</Text>
          <TextInput
            style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.background }]}
            placeholder="Naam"
            placeholderTextColor={bcctColors.textSecondary}
            value={newThemeName}
            onChangeText={setNewThemeName}
          />
          <TextInput
            style={[styles.input, styles.textArea, { color: colors.text, borderColor: colors.border, backgroundColor: colors.background }]}
            placeholder="Beschrijving (optioneel)"
            placeholderTextColor={bcctColors.textSecondary}
            value={newThemeDescription}
            onChangeText={setNewThemeDescription}
            multiline
          />
          <View style={styles.modalButtons}>
            <TouchableOpacity
              style={[styles.modalButton, styles.cancelButton, { borderColor: colors.border }]}
              onPress={() => setCreateModalVisible(false)}
            >
              <Text style={[styles.cancelButtonText, { color: colors.text }]}>Annuleren</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.modalButtonContainer}
              onPress={createTheme}
              disabled={creating}
            >
              <LinearGradient
                colors={creating ? [bcctColors.primaryOrangeDisabled, bcctColors.primaryOrangeDisabled] : [bcctColors.primaryOrange, bcctColors.primaryOrangeDark]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.createButton}
              >
                {creating ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.createButtonText}>Aanmaken</Text>
                )}
              </LinearGradient>
            </TouchableOpacity>
          </View>
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
  addButton: {
    width: 40,
    height: 40,
    justifyContent: "center",
    alignItems: "center",
  },
  scrollContent: {
    padding: 20,
  },
  emptyState: {
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
  seedButtonContainer: {
    borderRadius: 12,
    overflow: "hidden",
    marginTop: 16,
  },
  seedButton: {
    paddingVertical: 14,
    paddingHorizontal: 32,
    alignItems: "center",
  },
  seedButtonText: {
    color: "#FFFFFF",
    ...bcctTypography.button,
  },
  themesList: {
    gap: 12,
  },
  themeCard: {
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  themeHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
  },
  themeIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: "center",
    alignItems: "center",
  },
  themeContent: {
    flex: 1,
    gap: 4,
  },
  themeName: {
    ...bcctTypography.h3,
  },
  themeDescription: {
    ...bcctTypography.body,
  },
  themeItemCount: {
    ...bcctTypography.small,
  },
  modalContent: {
    borderRadius: 20,
    padding: 24,
    gap: 16,
  },
  modalTitle: {
    ...bcctTypography.h3,
    textAlign: "center",
  },
  modalMessage: {
    ...bcctTypography.body,
    textAlign: "center",
  },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    ...bcctTypography.body,
  },
  textArea: {
    minHeight: 80,
    textAlignVertical: "top",
  },
  modalButtons: {
    flexDirection: "row",
    gap: 12,
    marginTop: 8,
  },
  modalButton: {
    flex: 1,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
  },
  cancelButton: {
    borderWidth: 1,
  },
  cancelButtonText: {
    ...bcctTypography.button,
  },
  modalButtonContainer: {
    flex: 1,
    borderRadius: 12,
    overflow: "hidden",
  },
  createButton: {
    paddingVertical: 14,
    alignItems: "center",
  },
  createButtonText: {
    color: "#FFFFFF",
    ...bcctTypography.button,
  },
  modalButtonText: {
    color: "#fff",
    ...bcctTypography.button,
  },
});
