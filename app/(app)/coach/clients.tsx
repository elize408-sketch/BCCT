
import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Share,
  TextInput,
} from "react-native";
import Modal from "react-native-modal";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTheme } from "@react-navigation/native";
import { IconSymbol } from "@/components/IconSymbol";
import { useRouter } from "expo-router";
import { supabase } from "@/lib/supabase";
import { bcctColors, bcctTypography } from "@/styles/bcctTheme";
import * as Clipboard from 'expo-clipboard';
import { LinearGradient } from "expo-linear-gradient";

interface Client {
  id: string;
  full_name: string;
  email: string;
  active_theme?: string;
}

interface ClientInvite {
  id: string;
  code: string;
  created_at: string;
  used_at: string | null;
  used_by: string | null;
}

export default function CoachClientsScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [clients, setClients] = useState<Client[]>([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [modalTitle, setModalTitle] = useState("");
  const [modalMessage, setModalMessage] = useState("");
  const [inviteCodeModalVisible, setInviteCodeModalVisible] = useState(false);
  const [generatedCode, setGeneratedCode] = useState("");
  const [generatingCode, setGeneratingCode] = useState(false);
  const [invites, setInvites] = useState<ClientInvite[]>([]);
  const [showInvitesList, setShowInvitesList] = useState(false);

  const showModal = (title: string, message: string) => {
    setModalTitle(title);
    setModalMessage(message);
    setModalVisible(true);
  };

  useEffect(() => {
    fetchClients();
    fetchInvites();
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

  const fetchInvites = async () => {
    console.log("[Coach Clients] Fetching invites");
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        console.error("[Coach Clients] No user found");
        return;
      }

      const { data: invitesData, error: invitesError } = await supabase
        .from('client_invites')
        .select('id, code, created_at, used_at, used_by')
        .eq('coach_id', user.id)
        .order('created_at', { ascending: false });

      if (invitesError) {
        console.error("[Coach Clients] Error fetching invites:", invitesError);
        return;
      }

      console.log("[Coach Clients] Invites loaded:", invitesData?.length || 0);
      setInvites(invitesData || []);
    } catch (error: any) {
      console.error("[Coach Clients] Error fetching invites:", error);
    }
  };

  const handleCreateInviteCode = async () => {
    console.log("[Coach Clients] Creating invite code");
    setGeneratingCode(true);
    try {
      const { data, error } = await supabase.rpc('create_client_invite', {
        p_expires_at: null,
      });

      if (error) {
        console.error("[Coach Clients] Error creating invite:", error);
        showModal("Fout", "Kon uitnodigingscode niet aanmaken");
        return;
      }

      console.log("[Coach Clients] Invite code created:", data);
      setGeneratedCode(data);
      setInviteCodeModalVisible(true);
      
      // Refresh invites list
      fetchInvites();
    } catch (error: any) {
      console.error("[Coach Clients] Error:", error);
      showModal("Fout", "Er is een fout opgetreden");
    } finally {
      setGeneratingCode(false);
    }
  };

  const handleCopyCode = async () => {
    console.log("[Coach Clients] Copying code to clipboard:", generatedCode);
    try {
      await Clipboard.setStringAsync(generatedCode);
      showModal("Gekopieerd", "Code is gekopieerd naar klembord");
    } catch (error: any) {
      console.error("[Coach Clients] Error copying code:", error);
      showModal("Fout", "Kon code niet kopiëren");
    }
  };

  const handleShareCode = async () => {
    console.log("[Coach Clients] Sharing code:", generatedCode);
    try {
      const result = await Share.share({
        message: `Gebruik deze code om je aan te melden als mijn cliënt: ${generatedCode}`,
        title: 'Coach uitnodigingscode',
      });

      if (result.action === Share.sharedAction) {
        console.log("[Coach Clients] Code shared successfully");
      }
    } catch (error: any) {
      console.error("[Coach Clients] Error sharing code:", error);
      showModal("Fout", "Kon code niet delen");
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
                Maak een uitnodigingscode om cliënten uit te nodigen.
              </Text>
              
              <TouchableOpacity
                style={styles.createInviteButtonContainer}
                onPress={handleCreateInviteCode}
                disabled={generatingCode}
                activeOpacity={0.9}
              >
                <LinearGradient
                  colors={generatingCode ? [bcctColors.primaryOrangeDisabled, bcctColors.primaryOrangeDisabled] : [bcctColors.primaryOrange, bcctColors.primaryOrangeDark]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.createInviteButton}
                >
                  {generatingCode ? (
                    <ActivityIndicator color="#fff" size="small" />
                  ) : (
                    <>
                      <IconSymbol
                        ios_icon_name="plus.circle.fill"
                        android_material_icon_name="add-circle"
                        size={20}
                        color="#fff"
                      />
                      <Text style={styles.createInviteButtonText}>Maak uitnodigingscode</Text>
                    </>
                  )}
                </LinearGradient>
              </TouchableOpacity>

              {invites.length > 0 && (
                <TouchableOpacity
                  style={styles.viewInvitesButton}
                  onPress={() => setShowInvitesList(true)}
                >
                  <Text style={[styles.viewInvitesButtonText, { color: bcctColors.primaryOrange }]}>
                    Bekijk uitnodigingen ({invites.length})
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          ) : (
            <>
              <TouchableOpacity
                style={styles.createInviteButtonContainer}
                onPress={handleCreateInviteCode}
                disabled={generatingCode}
                activeOpacity={0.9}
              >
                <LinearGradient
                  colors={generatingCode ? [bcctColors.primaryOrangeDisabled, bcctColors.primaryOrangeDisabled] : [bcctColors.primaryOrange, bcctColors.primaryOrangeDark]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.createInviteButton}
                >
                  {generatingCode ? (
                    <ActivityIndicator color="#fff" size="small" />
                  ) : (
                    <>
                      <IconSymbol
                        ios_icon_name="plus.circle.fill"
                        android_material_icon_name="add-circle"
                        size={20}
                        color="#fff"
                      />
                      <Text style={styles.createInviteButtonText}>Maak nieuwe uitnodigingscode</Text>
                    </>
                  )}
                </LinearGradient>
              </TouchableOpacity>

              {invites.length > 0 && (
                <TouchableOpacity
                  style={styles.viewInvitesButton}
                  onPress={() => setShowInvitesList(true)}
                >
                  <Text style={[styles.viewInvitesButtonText, { color: bcctColors.primaryOrange }]}>
                    Bekijk alle uitnodigingen ({invites.length})
                  </Text>
                </TouchableOpacity>
              )}

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
            </>
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

      <Modal
        isVisible={inviteCodeModalVisible}
        onBackdropPress={() => setInviteCodeModalVisible(false)}
        onBackButtonPress={() => setInviteCodeModalVisible(false)}
        animationIn="slideInUp"
        animationOut="slideOutDown"
        backdropOpacity={0.5}
      >
        <View style={[styles.inviteModalContent, { backgroundColor: colors.card }]}>
          <View style={[styles.inviteIconContainer, { backgroundColor: bcctColors.primaryOrange + "20" }]}>
            <IconSymbol
              ios_icon_name="checkmark.circle.fill"
              android_material_icon_name="check-circle"
              size={48}
              color={bcctColors.primaryOrange}
            />
          </View>
          
          <Text style={[styles.inviteModalTitle, { color: colors.text }]}>Uitnodigingscode aangemaakt</Text>
          <Text style={[styles.inviteModalSubtitle, { color: bcctColors.textSecondary }]}>
            Deel deze code met je cliënt
          </Text>

          <View style={[styles.codeContainer, { backgroundColor: colors.background, borderColor: colors.border }]}>
            <Text style={[styles.codeText, { color: bcctColors.primaryOrange }]}>{generatedCode}</Text>
          </View>

          <View style={styles.inviteActionsRow}>
            <TouchableOpacity
              style={[styles.inviteActionButton, { backgroundColor: colors.background, borderColor: colors.border }]}
              onPress={handleCopyCode}
              activeOpacity={0.7}
            >
              <IconSymbol
                ios_icon_name="doc.on.doc"
                android_material_icon_name="content-copy"
                size={20}
                color={bcctColors.primaryOrange}
              />
              <Text style={[styles.inviteActionButtonText, { color: colors.text }]}>Kopieer</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.inviteActionButtonPrimary}
              onPress={handleShareCode}
              activeOpacity={0.9}
            >
              <LinearGradient
                colors={[bcctColors.primaryOrange, bcctColors.primaryOrangeDark]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.inviteActionButtonGradient}
              >
                <IconSymbol
                  ios_icon_name="square.and.arrow.up"
                  android_material_icon_name="share"
                  size={20}
                  color="#fff"
                />
                <Text style={styles.inviteActionButtonTextPrimary}>Deel</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={styles.inviteCloseButton}
            onPress={() => setInviteCodeModalVisible(false)}
          >
            <Text style={[styles.inviteCloseButtonText, { color: bcctColors.textSecondary }]}>Sluiten</Text>
          </TouchableOpacity>
        </View>
      </Modal>

      <Modal
        isVisible={showInvitesList}
        onBackdropPress={() => setShowInvitesList(false)}
        onBackButtonPress={() => setShowInvitesList(false)}
        animationIn="slideInUp"
        animationOut="slideOutDown"
        backdropOpacity={0.5}
        style={styles.invitesListModal}
      >
        <View style={[styles.invitesListContent, { backgroundColor: colors.card }]}>
          <View style={styles.invitesListHeader}>
            <Text style={[styles.invitesListTitle, { color: colors.text }]}>Uitnodigingen</Text>
            <TouchableOpacity onPress={() => setShowInvitesList(false)}>
              <IconSymbol
                ios_icon_name="xmark.circle.fill"
                android_material_icon_name="cancel"
                size={28}
                color={bcctColors.textSecondary}
              />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.invitesListScroll} showsVerticalScrollIndicator={false}>
            {invites.map((invite) => {
              const isUsed = !!invite.used_at;
              const createdDate = new Date(invite.created_at).toLocaleDateString('nl-NL', {
                day: 'numeric',
                month: 'short',
                year: 'numeric',
              });
              const usedDate = invite.used_at
                ? new Date(invite.used_at).toLocaleDateString('nl-NL', {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric',
                  })
                : null;

              return (
                <React.Fragment key={invite.id}>
                <View style={[styles.inviteListItem, { backgroundColor: colors.background, borderColor: colors.border }]}>
                  <View style={styles.inviteListItemHeader}>
                    <Text style={[styles.inviteListItemCode, { color: colors.text }]}>{invite.code}</Text>
                    <View style={[styles.inviteStatusBadge, { backgroundColor: isUsed ? bcctColors.success + "20" : bcctColors.primaryOrange + "20" }]}>
                      <Text style={[styles.inviteStatusText, { color: isUsed ? bcctColors.success : bcctColors.primaryOrange }]}>
                        {isUsed ? 'Gebruikt' : 'Ongebruikt'}
                      </Text>
                    </View>
                  </View>
                  <Text style={[styles.inviteListItemDate, { color: bcctColors.textSecondary }]}>
                    Aangemaakt: {createdDate}
                  </Text>
                  {usedDate && (
                    <Text style={[styles.inviteListItemDate, { color: bcctColors.textSecondary }]}>
                      Gebruikt: {usedDate}
                    </Text>
                  )}
                </View>
                </React.Fragment>
              );
            })}
          </ScrollView>
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
  createInviteButtonContainer: {
    marginTop: 24,
    marginBottom: 16,
    borderRadius: 12,
    overflow: 'hidden',
  },
  createInviteButton: {
    height: 48,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  createInviteButtonText: {
    color: '#fff',
    ...bcctTypography.button,
  },
  viewInvitesButton: {
    alignItems: 'center',
    paddingVertical: 8,
    marginBottom: 16,
  },
  viewInvitesButtonText: {
    ...bcctTypography.bodyMedium,
    textDecorationLine: 'underline',
  },
  inviteModalContent: {
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
  },
  inviteIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  inviteModalTitle: {
    ...bcctTypography.h2,
    marginBottom: 8,
    textAlign: 'center',
  },
  inviteModalSubtitle: {
    ...bcctTypography.body,
    marginBottom: 20,
    textAlign: 'center',
  },
  codeContainer: {
    width: '100%',
    padding: 16,
    borderRadius: 12,
    borderWidth: 2,
    marginBottom: 20,
    alignItems: 'center',
  },
  codeText: {
    ...bcctTypography.h2,
    fontWeight: '700',
    letterSpacing: 2,
  },
  inviteActionsRow: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
    marginBottom: 16,
  },
  inviteActionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  inviteActionButtonText: {
    ...bcctTypography.bodyMedium,
  },
  inviteActionButtonPrimary: {
    flex: 1,
    borderRadius: 12,
    overflow: 'hidden',
  },
  inviteActionButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
  },
  inviteActionButtonTextPrimary: {
    color: '#fff',
    ...bcctTypography.bodyMedium,
  },
  inviteCloseButton: {
    paddingVertical: 8,
  },
  inviteCloseButtonText: {
    ...bcctTypography.body,
  },
  invitesListModal: {
    margin: 0,
    justifyContent: 'flex-end',
  },
  invitesListContent: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 24,
    maxHeight: '80%',
  },
  invitesListHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  invitesListTitle: {
    ...bcctTypography.h2,
  },
  invitesListScroll: {
    maxHeight: 400,
  },
  inviteListItem: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 12,
  },
  inviteListItemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  inviteListItemCode: {
    ...bcctTypography.bodyMedium,
    fontWeight: '600',
    letterSpacing: 1,
  },
  inviteStatusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  inviteStatusText: {
    ...bcctTypography.small,
    fontWeight: '600',
  },
  inviteListItemDate: {
    ...bcctTypography.small,
  },
});
