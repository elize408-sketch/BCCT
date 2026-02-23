
import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  TextInput,
  Switch,
} from "react-native";
import Modal from "react-native-modal";
import { useTheme } from "@react-navigation/native";
import { SafeAreaView } from "react-native-safe-area-context";
import { IconSymbol } from "@/components/IconSymbol";
import { useRouter, useLocalSearchParams } from "expo-router";
import { supabase } from "@/lib/supabase";
import { bcctColors, bcctTypography } from "@/styles/bcctTheme";
import { LinearGradient } from "expo-linear-gradient";

interface ThemeItem {
  id: string;
  label: string;
  sort_order: number;
  is_active: boolean;
}

interface Theme {
  id: string;
  name: string;
  description: string;
}

export default function ThemeDetailScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const { id } = useLocalSearchParams();
  const [loading, setLoading] = useState(true);
  const [theme, setTheme] = useState<Theme | null>(null);
  const [items, setItems] = useState<ThemeItem[]>([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [modalTitle, setModalTitle] = useState("");
  const [modalMessage, setModalMessage] = useState("");
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [newItemLabel, setNewItemLabel] = useState("");
  const [creating, setCreating] = useState(false);

  const showModal = (title: string, message: string) => {
    setModalTitle(title);
    setModalMessage(message);
    setModalVisible(true);
  };

  useEffect(() => {
    if (id) {
      fetchThemeDetails();
    }
  }, [id]);

  const fetchThemeDetails = async () => {
    console.log("[Theme Detail] Fetching theme details for", id);
    try {
      const { data: themeData, error: themeError } = await supabase
        .from("themes")
        .select("*")
        .eq("id", id)
        .single();

      if (themeError) {
        console.error("[Theme Detail] Error fetching theme", themeError);
        showModal("Fout", "Kon thema niet laden");
        return;
      }

      setTheme(themeData);

      const { data: itemsData, error: itemsError } = await supabase
        .from("theme_items")
        .select("*")
        .eq("theme_id", id)
        .order("sort_order", { ascending: true });

      if (itemsError) {
        console.error("[Theme Detail] Error fetching items", itemsError);
        showModal("Fout", "Kon vragen niet laden");
        return;
      }

      console.log("[Theme Detail] Theme and items loaded", themeData, itemsData);
      setItems(itemsData || []);
    } catch (error: any) {
      console.error("[Theme Detail] Error fetching theme details", error);
      showModal("Fout", "Kon thema niet laden");
    } finally {
      setLoading(false);
    }
  };

  const createItem = async () => {
    if (!newItemLabel.trim()) {
      showModal("Fout", "Vul een label in voor de vraag");
      return;
    }

    console.log("[Theme Detail] Creating item", newItemLabel);
    setCreating(true);
    try {
      const maxSortOrder = items.length > 0 ? Math.max(...items.map(i => i.sort_order)) : 0;

      const { data, error } = await supabase
        .from("theme_items")
        .insert({
          theme_id: id,
          label: newItemLabel.trim(),
          type: "slider",
          min_value: 0,
          max_value: 100,
          sort_order: maxSortOrder + 1,
          is_active: true,
        })
        .select()
        .single();

      if (error) {
        console.error("[Theme Detail] Error creating item", error);
        showModal("Fout", "Kon vraag niet aanmaken");
        return;
      }

      console.log("[Theme Detail] Item created", data);
      setCreateModalVisible(false);
      setNewItemLabel("");
      fetchThemeDetails();
      showModal("Succes", "Vraag succesvol aangemaakt");
    } catch (error: any) {
      console.error("[Theme Detail] Error creating item", error);
      showModal("Fout", "Kon vraag niet aanmaken");
    } finally {
      setCreating(false);
    }
  };

  const toggleItemActive = async (itemId: string, currentActive: boolean) => {
    console.log("[Theme Detail] Toggling item active", itemId, !currentActive);
    try {
      const { error } = await supabase
        .from("theme_items")
        .update({ is_active: !currentActive })
        .eq("id", itemId);

      if (error) {
        console.error("[Theme Detail] Error toggling item", error);
        showModal("Fout", "Kon status niet wijzigen");
        return;
      }

      setItems(items.map(item =>
        item.id === itemId ? { ...item, is_active: !currentActive } : item
      ));
    } catch (error: any) {
      console.error("[Theme Detail] Error toggling item", error);
      showModal("Fout", "Kon status niet wijzigen");
    }
  };

  const deleteItem = async (itemId: string) => {
    console.log("[Theme Detail] Deleting item", itemId);
    try {
      const { error } = await supabase
        .from("theme_items")
        .delete()
        .eq("id", itemId);

      if (error) {
        console.error("[Theme Detail] Error deleting item", error);
        showModal("Fout", "Kon vraag niet verwijderen");
        return;
      }

      setItems(items.filter(item => item.id !== itemId));
      showModal("Succes", "Vraag verwijderd");
    } catch (error: any) {
      console.error("[Theme Detail] Error deleting item", error);
      showModal("Fout", "Kon vraag niet verwijderen");
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

  if (!theme) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={["top"]}>
        <View style={styles.errorContainer}>
          <Text style={[styles.errorText, { color: colors.text }]}>Thema niet gevonden</Text>
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
          <Text style={[styles.headerTitle, { color: colors.text }]}>{theme.name}</Text>
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
          {theme.description ? (
            <View style={[styles.descriptionCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Text style={[styles.descriptionText, { color: bcctColors.textSecondary }]}>
                {theme.description}
              </Text>
            </View>
          ) : null}

          <Text style={[styles.sectionTitle, { color: colors.text }]}>Vragen</Text>

          {items.length === 0 ? (
            <View style={styles.emptyState}>
              <IconSymbol
                ios_icon_name="list.bullet"
                android_material_icon_name="list"
                size={64}
                color={bcctColors.textSecondary}
              />
              <Text style={[styles.emptyTitle, { color: colors.text }]}>
                Geen vragen gevonden
              </Text>
              <Text style={[styles.emptyDescription, { color: bcctColors.textSecondary }]}>
                Voeg vragen toe aan dit thema
              </Text>
            </View>
          ) : (
            <View style={styles.itemsList}>
              {items.map((item, index) => {
                const orderText = `${index + 1}.`;
                return (
                  <View
                    key={item.id}
                    style={[styles.itemCard, { backgroundColor: colors.card, borderColor: colors.border }]}
                  >
                    <View style={styles.itemHeader}>
                      <Text style={[styles.itemOrder, { color: bcctColors.textSecondary }]}>
                        {orderText}
                      </Text>
                      <Text style={[styles.itemLabel, { color: colors.text }]}>{item.label}</Text>
                    </View>
                    <View style={styles.itemActions}>
                      <View style={styles.activeToggle}>
                        <Text style={[styles.activeLabel, { color: bcctColors.textSecondary }]}>
                          Actief
                        </Text>
                        <Switch
                          value={item.is_active}
                          onValueChange={() => toggleItemActive(item.id, item.is_active)}
                          trackColor={{ false: colors.border, true: bcctColors.primaryOrange }}
                          thumbColor="#fff"
                        />
                      </View>
                      <TouchableOpacity
                        style={styles.deleteButton}
                        onPress={() => deleteItem(item.id)}
                      >
                        <IconSymbol
                          ios_icon_name="trash"
                          android_material_icon_name="delete"
                          size={20}
                          color={bcctColors.error}
                        />
                      </TouchableOpacity>
                    </View>
                  </View>
                );
              })}
            </View>
          )}
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
          <Text style={[styles.modalTitle, { color: colors.text }]}>Nieuwe Vraag</Text>
          <TextInput
            style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.background }]}
            placeholder="Label (bijv. Belastbaarheid)"
            placeholderTextColor={bcctColors.textSecondary}
            value={newItemLabel}
            onChangeText={setNewItemLabel}
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
              onPress={createItem}
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
  addButton: {
    width: 40,
    height: 40,
    justifyContent: "center",
    alignItems: "center",
  },
  scrollContent: {
    padding: 20,
  },
  descriptionCard: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 24,
  },
  descriptionText: {
    ...bcctTypography.body,
  },
  sectionTitle: {
    ...bcctTypography.h3,
    marginBottom: 16,
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
  itemsList: {
    gap: 12,
  },
  itemCard: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    gap: 12,
  },
  itemHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  itemOrder: {
    ...bcctTypography.bodyMedium,
    minWidth: 30,
  },
  itemLabel: {
    ...bcctTypography.bodyMedium,
    flex: 1,
  },
  itemActions: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingLeft: 42,
  },
  activeToggle: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  activeLabel: {
    ...bcctTypography.body,
  },
  deleteButton: {
    padding: 8,
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
