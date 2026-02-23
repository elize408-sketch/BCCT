
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
import { useRouter } from "expo-router";
import { supabase } from "@/lib/supabase";
import { bcctColors, bcctTypography } from "@/styles/bcctTheme";

interface Client {
  id: string;
  full_name: string;
  email: string;
  active_theme?: string;
}

export default function CoachClientsScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [clients, setClients] = useState<Client[]>([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [modalTitle, setModalTitle] = useState("");
  const [modalMessage, setModalMessage] = useState("");

  const showModal = (title: string, message: string) => {
    setModalTitle(title);
    setModalMessage(message);
    setModalVisible(true);
  };

  useEffect(() => {
    fetchClients();
  }, []);

  const fetchClients = async () => {
    console.log("[Coach Clients] Fetching clients");
    try {
      const { data: session } = await supabase.auth.getSession();
      if (!session?.session?.user) {
        console.error("[Coach Clients] No user session");
        return;
      }

      const { data: coachClients, error: coachClientsError } = await supabase
        .from("coach_clients")
        .select("client_id")
        .eq("coach_id", session.session.user.id);

      if (coachClientsError) {
        console.error("[Coach Clients] Error fetching coach_clients", coachClientsError);
        showModal("Fout", "Kon cliënten niet laden");
        return;
      }

      if (!coachClients || coachClients.length === 0) {
        console.log("[Coach Clients] No clients found");
        setLoading(false);
        return;
      }

      const clientIds = coachClients.map(cc => cc.client_id);

      const { data: profiles, error: profilesError } = await supabase
        .from("profiles")
        .select("id, full_name, email")
        .in("id", clientIds);

      if (profilesError) {
        console.error("[Coach Clients] Error fetching profiles", profilesError);
        showModal("Fout", "Kon cliënten niet laden");
        return;
      }

      const { data: assignments, error: assignmentsError } = await supabase
        .from("client_theme_assignments")
        .select("client_id, themes(name)")
        .in("client_id", clientIds)
        .eq("active", true);

      if (assignmentsError) {
        console.error("[Coach Clients] Error fetching assignments", assignmentsError);
      }

      const clientsWithThemes = (profiles || []).map(profile => {
        const assignment = assignments?.find(a => a.client_id === profile.id);
        return {
          ...profile,
          active_theme: assignment?.themes?.name,
        };
      });

      console.log("[Coach Clients] Clients loaded", clientsWithThemes);
      setClients(clientsWithThemes);
    } catch (error: any) {
      console.error("[Coach Clients] Error fetching clients", error);
      showModal("Fout", "Kon cliënten niet laden");
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
          <Text style={[styles.headerTitle, { color: colors.text }]}>Cliënten</Text>
          <View style={styles.placeholder} />
        </View>

        <ScrollView contentContainerStyle={styles.scrollContent}>
          {clients.length === 0 ? (
            <View style={styles.emptyState}>
              <IconSymbol
                ios_icon_name="person"
                android_material_icon_name="person"
                size={64}
                color={bcctColors.textSecondary}
              />
              <Text style={[styles.emptyTitle, { color: colors.text }]}>
                Geen cliënten gevonden
              </Text>
              <Text style={[styles.emptyDescription, { color: bcctColors.textSecondary }]}>
                Je hebt nog geen cliënten toegewezen
              </Text>
            </View>
          ) : (
            <View style={styles.clientsList}>
              {clients.map((client) => {
                const themeText = client.active_theme || "Geen thema";
                return (
                  <TouchableOpacity
                    key={client.id}
                    style={[styles.clientCard, { backgroundColor: colors.card, borderColor: colors.border }]}
                    onPress={() => router.push(`/(app)/coach/client-detail?id=${client.id}`)}
                  >
                    <View style={[styles.clientAvatar, { backgroundColor: bcctColors.primaryOrange + "20" }]}>
                      <IconSymbol
                        ios_icon_name="person"
                        android_material_icon_name="person"
                        size={28}
                        color={bcctColors.primaryOrange}
                      />
                    </View>
                    <View style={styles.clientContent}>
                      <Text style={[styles.clientName, { color: colors.text }]}>{client.full_name}</Text>
                      <Text style={[styles.clientEmail, { color: bcctColors.textSecondary }]}>
                        {client.email}
                      </Text>
                      <Text style={[styles.clientTheme, { color: bcctColors.textSecondary }]}>
                        {themeText}
                      </Text>
                    </View>
                    <IconSymbol
                      ios_icon_name="chevron.right"
                      android_material_icon_name="chevron-right"
                      size={20}
                      color={colors.text}
                      style={{ opacity: 0.4 }}
                    />
                  </TouchableOpacity>
                );
              })}
            </View>
          )}
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
  clientsList: {
    gap: 12,
  },
  clientCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    gap: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  clientAvatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: "center",
    alignItems: "center",
  },
  clientContent: {
    flex: 1,
    gap: 4,
  },
  clientName: {
    ...bcctTypography.h3,
  },
  clientEmail: {
    ...bcctTypography.body,
  },
  clientTheme: {
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
