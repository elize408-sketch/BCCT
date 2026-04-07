
import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Animated,
} from "react-native";
import Modal from "react-native-modal";
import { useTheme } from "@react-navigation/native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect } from "expo-router";
import { IconSymbol } from "@/components/IconSymbol";
import { useRouter, useLocalSearchParams } from "expo-router";
import { supabase } from "@/lib/supabase";
import { bcctColors, bcctTypography } from "@/styles/bcctTheme";
import { AnimatedPressable } from "@/components/AnimatedPressable";
import { useAuth } from "@/contexts/AuthContext";
import { listAssignments, HomeworkAssignment } from "@/utils/homeworkApi";

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

type TabKey = "overzicht" | "huiswerk";

// ─── Skeleton card ────────────────────────────────────────────────────────────
function SkeletonCard() {
  const opacity = useRef(new Animated.Value(0.4)).current;

  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.4, duration: 700, useNativeDriver: true }),
      ])
    );
    anim.start();
    return () => anim.stop();
  }, [opacity]);

  return (
    <Animated.View style={[styles.skeletonCard, { opacity }]}>
      <View style={styles.skeletonRow}>
        <View style={[styles.skeletonBlock, { width: "55%", height: 16 }]} />
        <View style={[styles.skeletonBlock, { width: 64, height: 22, borderRadius: 11 }]} />
      </View>
      <View style={[styles.skeletonBlock, { width: "90%", height: 13, marginTop: 10 }]} />
      <View style={[styles.skeletonBlock, { width: "70%", height: 13, marginTop: 6 }]} />
      <View style={[styles.skeletonDivider]} />
      <View style={styles.skeletonRow}>
        <View style={[styles.skeletonBlock, { width: 100, height: 13 }]} />
        <View style={[styles.skeletonBlock, { width: 80, height: 13 }]} />
      </View>
    </Animated.View>
  );
}

// ─── Relative date helper ─────────────────────────────────────────────────────
function relativeDate(isoString: string): string {
  const now = new Date();
  const date = new Date(isoString);
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return "Vandaag";
  if (diffDays === 1) return "Gisteren";
  if (diffDays < 7) return `${diffDays} dagen geleden`;
  if (diffDays < 14) return "1 week geleden";
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} weken geleden`;
  return `${Math.floor(diffDays / 30)} maanden geleden`;
}

function formatDeadline(deadline: string | null): string {
  if (!deadline) return "Geen deadline";
  const date = new Date(deadline);
  const day = String(date.getDate()).padStart(2, "0");
  const months = ["jan", "feb", "mrt", "apr", "mei", "jun", "jul", "aug", "sep", "okt", "nov", "dec"];
  return `${day} ${months[date.getMonth()]} ${date.getFullYear()}`;
}

// ─── Homework card ────────────────────────────────────────────────────────────
function HomeworkCard({ item, index }: { item: HomeworkAssignment; index: number }) {
  const { colors } = useTheme();
  const translateY = useRef(new Animated.Value(24)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(translateY, {
        toValue: 0,
        duration: 320,
        delay: index * 80,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 1,
        duration: 320,
        delay: index * 80,
        useNativeDriver: true,
      }),
    ]).start();
  }, [translateY, opacity, index]);

  const statusLabel = item.status === "sent" ? "Verstuurd" : item.status;
  const deadlineText = formatDeadline(item.deadline);
  const relDate = relativeDate(item.created_at);
  const fileCount = item.file_count ?? 0;
  const fileLabel = fileCount === 1 ? "1 bijlage" : `${fileCount} bijlagen`;
  const hasFiles = fileCount > 0;

  return (
    <Animated.View style={{ transform: [{ translateY }], opacity }}>
      <View style={[styles.hwCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={styles.hwCardHeader}>
          <Text style={[styles.hwSubject, { color: colors.text }]} numberOfLines={1}>
            {item.subject}
          </Text>
          <View style={styles.hwStatusBadge}>
            <Text style={styles.hwStatusText}>{statusLabel}</Text>
          </View>
        </View>
        <Text style={[styles.hwMessage, { color: bcctColors.textSecondary }]} numberOfLines={2}>
          {item.message}
        </Text>
        <View style={styles.hwDivider} />
        <View style={styles.hwFooter}>
          <View style={styles.hwFooterLeft}>
            <Text style={styles.hwFooterIcon}>📅</Text>
            <Text style={[styles.hwFooterText, { color: item.deadline ? colors.text : bcctColors.textSecondary }]}>
              {deadlineText}
            </Text>
          </View>
          {hasFiles ? (
            <View style={styles.hwFooterRight}>
              <Text style={styles.hwFooterIcon}>📎</Text>
              <Text style={[styles.hwFooterText, { color: bcctColors.textSecondary }]}>
                {fileLabel}
              </Text>
            </View>
          ) : null}
        </View>
        <Text style={[styles.hwRelDate, { color: bcctColors.textSecondary }]}>{relDate}</Text>
      </View>
    </Animated.View>
  );
}

// ─── Huiswerk tab ─────────────────────────────────────────────────────────────
function HuiswerkTab({ clientId, clientName }: { clientId: string; clientName: string }) {
  const { colors } = useTheme();
  const router = useRouter();
  const { session } = useAuth();
  const [assignments, setAssignments] = useState<HomeworkAssignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadAssignments = useCallback(async () => {
    const token = session?.access_token;
    if (!token) return;
    console.log("[HuiswerkTab] Loading assignments for client:", clientId);
    setLoading(true);
    setError("");
    try {
      const data = await listAssignments(token, clientId);
      setAssignments(data);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Kon huiswerk niet laden";
      console.error("[HuiswerkTab] Error loading assignments:", msg);
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [clientId, session]);

  useFocusEffect(
    useCallback(() => {
      loadAssignments();
    }, [loadAssignments])
  );

  const handleSendHomework = useCallback(() => {
    console.log("[HuiswerkTab] + Huiswerk sturen pressed — clientId:", clientId);
    router.push({
      pathname: "/(app)/homework-compose",
      params: { clientId, clientName },
    });
  }, [router, clientId, clientName]);

  return (
    <View style={styles.hwTabContainer}>
      {/* Send button */}
      <AnimatedPressable
        style={[styles.sendHwBtn, { backgroundColor: bcctColors.primaryOrange }]}
        onPress={handleSendHomework}
      >
        <Text style={styles.sendHwBtnText}>+ Huiswerk sturen</Text>
      </AnimatedPressable>

      {/* Loading skeletons */}
      {loading ? (
        <View style={styles.hwList}>
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </View>
      ) : error ? (
        <View style={styles.hwEmptyState}>
          <Text style={[styles.hwEmptyTitle, { color: bcctColors.error }]}>{error}</Text>
        </View>
      ) : assignments.length === 0 ? (
        <View style={styles.hwEmptyState}>
          <View style={[styles.hwEmptyIconCircle, { backgroundColor: bcctColors.primaryOrange + "18" }]}>
            <Text style={styles.hwEmptyIcon}>📖</Text>
          </View>
          <Text style={[styles.hwEmptyTitle, { color: colors.text }]}>Nog geen huiswerk</Text>
          <Text style={[styles.hwEmptySubtitle, { color: bcctColors.textSecondary }]}>
            Stuur huiswerk om je cliënt op weg te helpen
          </Text>
          <AnimatedPressable
            style={[styles.hwEmptyCta, { backgroundColor: bcctColors.primaryOrange }]}
            onPress={handleSendHomework}
          >
            <Text style={styles.hwEmptyCtaText}>+ Huiswerk sturen</Text>
          </AnimatedPressable>
        </View>
      ) : (
        <ScrollView
          style={styles.hwList}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 120 }}
        >
          {assignments.map((item, index) => (
            <HomeworkCard key={item.id} item={item} index={index} />
          ))}
        </ScrollView>
      )}
    </View>
  );
}

// ─── Main screen ──────────────────────────────────────────────────────────────
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
  const [activeTab, setActiveTab] = useState<TabKey>("overzicht");

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
    } catch (error: unknown) {
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
    } catch (error: unknown) {
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
    } catch (error: unknown) {
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
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
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

        {/* Client card */}
        <View style={[styles.clientCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={[styles.clientAvatar, { backgroundColor: bcctColors.primaryOrange + "20" }]}>
            <IconSymbol
              ios_icon_name="person"
              android_material_icon_name="person"
              size={40}
              color={bcctColors.primaryOrange}
            />
          </View>
          <View style={styles.clientInfo}>
            <Text style={[styles.clientName, { color: colors.text }]}>{client.full_name}</Text>
            <Text style={[styles.clientEmail, { color: bcctColors.textSecondary }]}>{client.email}</Text>
          </View>
        </View>

        {/* Tab bar */}
        <View style={[styles.tabBar, { borderBottomColor: colors.border }]}>
          {(["overzicht", "huiswerk"] as TabKey[]).map(tab => {
            const isActive = activeTab === tab;
            const label = tab === "overzicht" ? "Overzicht" : "Huiswerk";
            return (
              <AnimatedPressable
                key={tab}
                style={styles.tabItem}
                onPress={() => {
                  console.log("[Client Detail] Tab pressed:", tab);
                  setActiveTab(tab);
                }}
              >
                <Text style={[styles.tabLabel, { color: isActive ? bcctColors.primaryOrange : bcctColors.textSecondary }]}>
                  {label}
                </Text>
                {isActive ? (
                  <View style={[styles.tabIndicator, { backgroundColor: bcctColors.primaryOrange }]} />
                ) : null}
              </AnimatedPressable>
            );
          })}
        </View>

        {/* Tab content */}
        {activeTab === "overzicht" ? (
          <ScrollView contentContainerStyle={styles.scrollContent}>
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
            <View style={{ height: 100 }} />
          </ScrollView>
        ) : (
          <HuiswerkTab
            clientId={String(id)}
            clientName={client.full_name}
          />
        )}
      </SafeAreaView>

      {/* Theme picker modal */}
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
                      isActive && { borderColor: bcctColors.primaryOrange, backgroundColor: bcctColors.primaryOrange + "10" },
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

      {/* Info modal */}
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
  clientCard: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: 20,
    marginBottom: 16,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
    gap: 14,
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
    gap: 2,
  },
  clientName: {
    ...bcctTypography.h3,
  },
  clientEmail: {
    ...bcctTypography.small,
  },
  // Tab bar
  tabBar: {
    flexDirection: "row",
    borderBottomWidth: 1,
    marginHorizontal: 20,
    marginBottom: 4,
  },
  tabItem: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 10,
    position: "relative",
  },
  tabLabel: {
    ...bcctTypography.bodyMedium,
  },
  tabIndicator: {
    position: "absolute",
    bottom: 0,
    left: "15%",
    right: "15%",
    height: 2,
    borderRadius: 1,
  },
  // Overzicht tab
  scrollContent: {
    padding: 20,
    paddingTop: 16,
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
  // Huiswerk tab
  hwTabContainer: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  sendHwBtn: {
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
    marginBottom: 20,
    shadowColor: bcctColors.primaryOrange,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  sendHwBtnText: {
    color: "#fff",
    ...bcctTypography.button,
  },
  hwList: {
    flex: 1,
  },
  hwEmptyState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingBottom: 60,
    gap: 12,
  },
  hwEmptyIconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  hwEmptyIcon: {
    fontSize: 32,
  },
  hwEmptyTitle: {
    ...bcctTypography.h3,
    textAlign: "center",
  },
  hwEmptySubtitle: {
    ...bcctTypography.body,
    textAlign: "center",
    paddingHorizontal: 24,
  },
  hwEmptyCta: {
    marginTop: 8,
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 28,
  },
  hwEmptyCtaText: {
    color: "#fff",
    ...bcctTypography.button,
  },
  // Homework card
  hwCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    marginBottom: 14,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  hwCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    marginBottom: 8,
  },
  hwSubject: {
    ...bcctTypography.bodyMedium,
    flex: 1,
  },
  hwStatusBadge: {
    backgroundColor: bcctColors.success + "22",
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  hwStatusText: {
    color: bcctColors.success,
    fontSize: 12,
    fontWeight: "600",
    lineHeight: 18,
  },
  hwMessage: {
    ...bcctTypography.small,
    lineHeight: 20,
  },
  hwDivider: {
    height: 1,
    backgroundColor: bcctColors.borderGray,
    marginVertical: 12,
  },
  hwFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  hwFooterLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  hwFooterRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  hwFooterIcon: {
    fontSize: 14,
  },
  hwFooterText: {
    fontSize: 13,
    lineHeight: 18,
  },
  hwRelDate: {
    fontSize: 12,
    lineHeight: 16,
    marginTop: 2,
  },
  // Skeleton
  skeletonCard: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: bcctColors.borderGray,
    backgroundColor: "#fff",
    padding: 16,
    marginBottom: 14,
  },
  skeletonRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  skeletonBlock: {
    backgroundColor: bcctColors.borderGray,
    borderRadius: 6,
    height: 14,
  },
  skeletonDivider: {
    height: 1,
    backgroundColor: bcctColors.borderGray,
    marginVertical: 12,
  },
  // Modals
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
