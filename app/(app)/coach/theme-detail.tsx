
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
  FlatList,
  Image,
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

interface Client {
  id: string;
  client_id: string;
  full_name: string;
  avatar_url: string | null;
}

function getInitials(name: string): string {
  const parts = String(name || "").trim().split(" ");
  if (parts.length === 0 || !parts[0]) return "?";
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
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

  // Assign flow state
  const [assignModalVisible, setAssignModalVisible] = useState(false);
  const [clients, setClients] = useState<Client[]>([]);
  const [clientsLoading, setClientsLoading] = useState(false);
  const [clientsError, setClientsError] = useState(false);
  const [assigning, setAssigning] = useState(false);

  const showModal = (title: string, message: string) => {
    setModalTitle(title);
    setModalMessage(message);
    setModalVisible(true);
  };

  useEffect(() => {
    if (id) {
      fetchThemeDetails();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  const openAssignModal = async () => {
    console.log("[Theme Detail] Opening assign modal for theme", id);
    setAssignModalVisible(true);
    setClientsLoading(true);
    setClientsError(false);
    setClients([]);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) {
        console.error("[Theme Detail] No session found for assign");
        setClientsError(true);
        return;
      }
      const userId = session.user.id;

      console.log("[Theme Detail] Fetching coach_clients for user", userId);
      const { data: coachClients, error: ccError } = await supabase
        .from("coach_clients")
        .select("id, client_id")
        .eq("coach_id", userId)
        .eq("status", "active");

      if (ccError) {
        console.error("[Theme Detail] Error fetching coach_clients", ccError);
        setClientsError(true);
        return;
      }

      if (!coachClients || coachClients.length === 0) {
        console.log("[Theme Detail] No active clients found");
        setClients([]);
        return;
      }

      const clientIds = coachClients.map(cc => cc.client_id);
      console.log("[Theme Detail] Fetching profiles for client_ids", clientIds);
      const { data: profiles, error: profilesError } = await supabase
        .from("profiles")
        .select("id, full_name, avatar_url")
        .in("id", clientIds);

      if (profilesError) {
        console.error("[Theme Detail] Error fetching profiles", profilesError);
        setClientsError(true);
        return;
      }

      const merged = coachClients.map(cc => {
        const profile = profiles?.find(p => p.id === cc.client_id);
        return {
          id: cc.id,
          client_id: cc.client_id,
          full_name: profile?.full_name ?? "Onbekend",
          avatar_url: profile?.avatar_url ?? null,
        };
      });

      console.log("[Theme Detail] Clients loaded", merged);
      setClients(merged);
    } catch (error: any) {
      console.error("[Theme Detail] Error fetching clients", error);
      setClientsError(true);
    } finally {
      setClientsLoading(false);
    }
  };

  const handleAssignToClient = async (client: Client) => {
    console.log("[Theme Detail] Assigning theme", id, "to client", client.client_id, client.full_name);
    setAssignModalVisible(false);
    setAssigning(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) {
        console.error("[Theme Detail] No session for assign-module");
        showModal("Fout", "Kon module niet toewijzen. Probeer het opnieuw.");
        return;
      }

      // Check for duplicate assignment
      console.log("[Theme Detail] Checking for existing assignment", { client_id: client.client_id, template_id: id });
      const { data: existing } = await supabase
        .from("client_programs")
        .select("id")
        .eq("client_id", client.client_id)
        .eq("template_id", id)
        .maybeSingle();

      if (existing) {
        console.warn("[Theme Detail] Module already assigned to", client.full_name);
        showModal("Al toegewezen", `Deze module is al toegewezen aan ${client.full_name}`);
        return;
      }

      console.log("[Theme Detail] Inserting client_programs row");
      const { error: insertError } = await supabase
        .from("client_programs")
        .insert({
          client_id: client.client_id,
          template_id: id,
          assigned_by: session.user.id,
          assigned_at: new Date().toISOString(),
          current_week: 1,
        });

      if (insertError) {
        console.error("[Theme Detail] Insert error", insertError);
        showModal("Fout", "Kon module niet toewijzen. Probeer het opnieuw.");
        return;
      }

      console.log("[Theme Detail] Module assigned successfully to", client.full_name);
      showModal("Toegewezen ✓", `Module toegewezen aan ${client.full_name}`);
    } catch (error: any) {
      console.error("[Theme Detail] assign-module exception", error);
      showModal("Fout", "Kon module niet toewijzen. Probeer het opnieuw.");
    } finally {
      setAssigning(false);
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
            onPress={() => {
              console.log("[Theme Detail] Back button pressed");
              router.back();
            }}
          >
            <IconSymbol
              ios_icon_name="chevron.left"
              android_material_icon_name="arrow-back"
              size={24}
              color={colors.text}
            />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.text }]}>{theme.name}</Text>
          <View style={styles.headerActions}>
            <TouchableOpacity
              style={styles.headerActionButton}
              onPress={openAssignModal}
            >
              <IconSymbol
                ios_icon_name="person.badge.plus"
                android_material_icon_name="person_add"
                size={24}
                color={bcctColors.primaryOrange}
              />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.headerActionButton}
              onPress={() => {
                console.log("[Theme Detail] Add question button pressed");
                setCreateModalVisible(true);
              }}
            >
              <IconSymbol
                ios_icon_name="plus"
                android_material_icon_name="add"
                size={24}
                color={bcctColors.primaryOrange}
              />
            </TouchableOpacity>
          </View>
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

          {/* Bottom padding for tab bar */}
          <View style={{ height: 100 }} />
        </ScrollView>

        {assigning ? (
          <View style={styles.assigningOverlay}>
            <ActivityIndicator size="large" color={bcctColors.primaryOrange} />
          </View>
        ) : null}
      </SafeAreaView>

      {/* Assign to client modal */}
      <Modal
        isVisible={assignModalVisible}
        onBackdropPress={() => setAssignModalVisible(false)}
        onBackButtonPress={() => setAssignModalVisible(false)}
        animationIn="slideInUp"
        animationOut="slideOutDown"
        backdropOpacity={0.5}
        style={styles.bottomModal}
      >
        <View style={[styles.assignModalContainer, { backgroundColor: colors.card }]}>
          <View style={[styles.modalHandle, { backgroundColor: colors.border }]} />
          <Text style={[styles.assignModalTitle, { color: colors.text }]}>
            Toewijzen aan cliënt
          </Text>

          {clientsLoading ? (
            <View style={styles.clientsLoadingContainer}>
              <ActivityIndicator size="large" color={bcctColors.primaryOrange} />
            </View>
          ) : clientsError ? (
            <View style={styles.clientsEmptyContainer}>
              <Text style={[styles.clientsEmptyText, { color: bcctColors.error }]}>
                Kon cliënten niet laden. Probeer het opnieuw.
              </Text>
              <TouchableOpacity
                style={[styles.goToClientsButton, { borderColor: bcctColors.error }]}
                onPress={() => {
                  console.log("[Theme Detail] Retry fetch clients pressed");
                  openAssignModal();
                }}
              >
                <Text style={[styles.goToClientsText, { color: bcctColors.error }]}>
                  Opnieuw proberen
                </Text>
              </TouchableOpacity>
            </View>
          ) : clients.length === 0 ? (
            <View style={styles.clientsEmptyContainer}>
              <Text style={[styles.clientsEmptyText, { color: bcctColors.textSecondary }]}>
                Je hebt nog geen gekoppelde cliënten om deze module aan toe te wijzen.
              </Text>
              <TouchableOpacity
                style={[styles.goToClientsButton, { borderColor: bcctColors.primaryOrange }]}
                onPress={() => {
                  console.log("[Theme Detail] Navigate to clients pressed");
                  setAssignModalVisible(false);
                  router.push("/(app)/coach/clients");
                }}
              >
                <Text style={[styles.goToClientsText, { color: bcctColors.primaryOrange }]}>
                  Ga naar cliënten
                </Text>
              </TouchableOpacity>
            </View>
          ) : (
            <FlatList
              data={clients}
              keyExtractor={(item) => item.id}
              style={styles.clientsList}
              renderItem={({ item }) => {
                const initials = getInitials(item.full_name);
                return (
                  <TouchableOpacity
                    style={[styles.clientRow, { borderBottomColor: colors.border }]}
                    onPress={() => handleAssignToClient(item)}
                  >
                    {item.avatar_url ? (
                      <Image
                        source={{ uri: item.avatar_url }}
                        style={styles.clientAvatar}
                      />
                    ) : (
                      <View style={styles.clientAvatarPlaceholder}>
                        <Text style={styles.clientAvatarInitials}>{initials}</Text>
                      </View>
                    )}
                    <Text style={[styles.clientName, { color: colors.text }]}>
                      {item.full_name}
                    </Text>
                  </TouchableOpacity>
                );
              }}
            />
          )}

          <TouchableOpacity
            style={[styles.cancelAssignButton, { borderColor: colors.border }]}
            onPress={() => {
              console.log("[Theme Detail] Assign modal cancelled");
              setAssignModalVisible(false);
            }}
          >
            <Text style={[styles.cancelAssignText, { color: colors.text }]}>Annuleren</Text>
          </TouchableOpacity>
        </View>
      </Modal>

      {/* Create question modal */}
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

      {/* Info / feedback modal */}
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
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  headerActionButton: {
    width: 40,
    height: 40,
    justifyContent: "center",
    alignItems: "center",
  },
  // kept for backward compat (unused but avoids any stale ref issues)
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
  assigningOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.15)",
  },
  // Assign modal
  bottomModal: {
    justifyContent: "flex-end",
    margin: 0,
  },
  assignModalContainer: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 20,
    paddingBottom: 40,
    maxHeight: "80%",
  },
  modalHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    alignSelf: "center",
    marginBottom: 16,
  },
  assignModalTitle: {
    ...bcctTypography.h3,
    textAlign: "center",
    marginBottom: 8,
    paddingHorizontal: 20,
  },
  clientsLoadingContainer: {
    paddingVertical: 48,
    alignItems: "center",
  },
  clientsEmptyContainer: {
    paddingVertical: 32,
    paddingHorizontal: 24,
    alignItems: "center",
    gap: 16,
  },
  clientsEmptyText: {
    ...bcctTypography.body,
    textAlign: "center",
  },
  goToClientsButton: {
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 24,
  },
  goToClientsText: {
    ...bcctTypography.button,
  },
  clientsList: {
    flexGrow: 0,
  },
  clientRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
  },
  clientAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
  },
  clientAvatarPlaceholder: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: bcctColors.primaryOrange + "20",
    justifyContent: "center",
    alignItems: "center",
  },
  clientAvatarInitials: {
    ...bcctTypography.bodyMedium,
    color: bcctColors.primaryOrange,
  },
  clientName: {
    ...bcctTypography.bodyMedium,
    flex: 1,
  },
  cancelAssignButton: {
    marginHorizontal: 20,
    marginTop: 12,
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
  },
  cancelAssignText: {
    ...bcctTypography.button,
  },
  // Create question modal
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
