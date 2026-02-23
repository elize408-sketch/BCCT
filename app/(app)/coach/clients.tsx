
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
import { SafeAreaView } from "react-native-safe-area-context";
import { useTheme } from "@react-navigation/native";
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
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        console.error("[Coach Clients] No user found");
        return;
      }

      const { data: coachClients, error: coachClientsError } = await supabase
        .from('coach_clients')
        .select('client_id')
        .eq('coach_id', user.id);

      if (coachClientsError) {
        console.error("[Coach Clients] Error fetching coach_clients:", coachClientsError);
        showModal("Fout", "Kon cliënten niet laden");
        return;
      }

      if (!coachClients || coachClients.length === 0) {
        console.log("[Coach Clients] No clients found");
        setClients([]);
        return;
      }

      const clientIds = coachClients.map(cc => cc.client_id);

      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('id, full_name, email')
        .in('id', clientIds);

      if (profilesError) {
        console.error("[Coach Clients] Error fetching profiles:", profilesError);
        showModal("Fout", "Kon cliëntgegevens niet laden");
        return;
      }

      const { data: assignments, error: assignmentsError } = await supabase
        .from('client_theme_assignments')
        .select('client_id, theme_id, themes(name)')
        .in('client_id', clientIds)
        .eq('active', true);

      if (assignmentsError) {
        console.error("[Coach Clients] Error fetching assignments:", assignmentsError);
      }

      const clientsWithThemes = profiles?.map(profile => ({
        ...profile,
        active_theme: assignments?.find(a => a.client_id === profile.id)?.themes?.name || undefined,
      })) || [];

      console.log("[Coach Clients] Clients loaded:", clientsWithThemes.length);
      setClients(clientsWithThemes);
    } catch (error: any) {
      console.error("[Coach Clients] Error:", error);
      showModal("Fout", "Er is een fout opgetreden");
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
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <View style={styles.header}>
            <Text style={[styles.headerTitle, { color: colors.text }]}>Cliënten</Text>
          </View>

          {clients.length === 0 ? (
            <View style={styles.emptyState}>
              <View style={[styles.emptyIconContainer, { backgroundColor: bcctColors.primaryOrange + "20" }]}>
                <IconSymbol
                  ios_icon_name="person.2"
                  android_material_icon_name="group"
                  size={48}
                  color={bcctColors.primaryOrange}
                />
              </View>
              <Text style={[styles.emptyTitle, { color: colors.text }]}>Nog geen cliënten</Text>
              <Text style={[styles.emptyText, { color: bcctColors.textSecondary }]}>
                Deel je coachcode om cliënten uit te nodigen.
              </Text>
            </View>
          ) : (
            <View style={styles.clientsList}>
              {clients.map((client) => (
                <React.Fragment key={client.id}>
                <TouchableOpacity
                  style={[styles.clientCard, { backgroundColor: colors.card, borderColor: colors.border }]}
                  onPress={() => router.push(`/(app)/coach/client-detail?id=${client.id}` as any)}
                  activeOpacity={0.7}
                >
                  <View style={[styles.clientAvatar, { backgroundColor: bcctColors.primaryOrange + "20" }]}>
                    <IconSymbol
                      ios_icon_name="person.fill"
                      android_material_icon_name="person"
                      size={24}
                      color={bcctColors.primaryOrange}
                    />
                  </View>
                  <View style={styles.clientInfo}>
                    <Text style={[styles.clientName, { color: colors.text }]}>{client.full_name}</Text>
                    <Text style={[styles.clientEmail, { color: bcctColors.textSecondary }]}>
                      {client.email}
                    </Text>
                    {client.active_theme && (
                      <View style={styles.themeBadge}>
                        <Text style={styles.themeBadgeText}>{client.active_theme}</Text>
                      </View>
                    )}
                  </View>
                  <IconSymbol
                    ios_icon_name="chevron.right"
                    android_material_icon_name="chevron-right"
                    size={20}
                    color={bcctColors.textSecondary}
                  />
                </TouchableOpacity>
                </React.Fragment>
              ))}
            </View>
          )}

          {/* Bottom padding for tab bar */}
          <View style={{ height: 100 }} />
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
    marginBottom: 24,
    marginTop: 8,
  },
  headerTitle: {
    ...bcctTypography.h1,
  },
  emptyState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 80,
    gap: 16,
  },
  emptyIconContainer: {
    width: 96,
    height: 96,
    borderRadius: 48,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 8,
  },
  emptyTitle: {
    ...bcctTypography.h2,
  },
  emptyText: {
    ...bcctTypography.body,
    textAlign: "center",
    maxWidth: 280,
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
  clientInfo: {
    flex: 1,
    gap: 4,
  },
  clientName: {
    ...bcctTypography.bodyMedium,
  },
  clientEmail: {
    ...bcctTypography.small,
  },
  themeBadge: {
    alignSelf: "flex-start",
    backgroundColor: bcctColors.primaryOrange + "30",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
    marginTop: 4,
  },
  themeBadgeText: {
    color: bcctColors.primaryOrange,
    fontSize: 11,
    fontWeight: "600",
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
