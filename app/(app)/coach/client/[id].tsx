
import React, { useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Image,
  TextInput,
  ImageSourcePropType,
  Platform,
} from "react-native";
import Modal from "react-native-modal";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTheme } from "@react-navigation/native";
import { useFocusEffect } from "@react-navigation/native";
import { useLocalSearchParams, useRouter, Stack } from "expo-router";
import { supabase } from "@/lib/supabase";
import { bcctColors, bcctTypography } from "@/styles/bcctTheme";
import { LinearGradient } from "expo-linear-gradient";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Profile {
  id: string;
  full_name: string;
  phone: string | null;
  avatar_url: string | null;
  onboarding_completed: boolean | null;
  created_at: string;
}

interface CoachLink {
  id: string;
  created_at: string;
  status: string;
}

interface CheckinResponse {
  id: string;
  created_at: string;
  checkin_id: string;
  answers: any;
  score: number | null;
  checkins: { title: string } | null;
}

interface ClientProgram {
  id: string;
  created_at: string;
  status: string | null;
  programs: { title: string; description: string | null } | null;
}

interface ThemeAssignment {
  id: string;
  created_at: string;
  status: string | null;
  themes: { title: string } | null;
}

interface Invoice {
  id: string;
  created_at: string;
  amount: number | null;
  status: string | null;
  due_date: string | null;
  description: string | null;
}

interface Appointment {
  id: string;
  title: string | null;
  start_time: string | null;
  end_time: string | null;
  status: string | null;
  notes: string | null;
}

interface CoachNote {
  id: string;
  created_at: string;
  updated_at: string | null;
  content: string | null;
  title: string | null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function resolveImageSource(
  source: string | number | ImageSourcePropType | undefined
): ImageSourcePropType {
  if (!source) return { uri: "" };
  if (typeof source === "string") return { uri: source };
  return source as ImageSourcePropType;
}

function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("nl-NL", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function formatTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleTimeString("nl-NL", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatAmount(amount: number | null | undefined): string {
  const num = Number(amount);
  if (isNaN(num)) return "—";
  return `€${num.toFixed(2)}`;
}

function isTableMissingError(error: any): boolean {
  return error?.code === "42P01" || error?.message?.includes("does not exist");
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function SectionHeader({ title, icon }: { title: string; icon: string }) {
  return (
    <View style={sectionStyles.header}>
      <View style={sectionStyles.leftBorder} />
      <Text style={sectionStyles.icon}>{icon}</Text>
      <Text style={sectionStyles.title}>{title}</Text>
    </View>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <View style={sectionStyles.emptyState}>
      <Text style={sectionStyles.emptyText}>{message}</Text>
    </View>
  );
}

function InvoiceStatusBadge({ status }: { status: string | null }) {
  const s = (status ?? "").toLowerCase();
  let bg = bcctColors.textSecondary + "20";
  let fg = bcctColors.textSecondary;
  let label = status ?? "—";

  if (s === "betaald" || s === "paid") {
    bg = bcctColors.success + "20";
    fg = bcctColors.success;
    label = "Betaald";
  } else if (s === "openstaand" || s === "open" || s === "pending") {
    bg = bcctColors.accentOrange + "20";
    fg = bcctColors.accentOrange;
    label = "Openstaand";
  } else if (s === "mislukt" || s === "failed" || s === "overdue") {
    bg = bcctColors.error + "20";
    fg = bcctColors.error;
    label = "Mislukt";
  }

  return (
    <View style={[sectionStyles.badge, { backgroundColor: bg }]}>
      <Text style={[sectionStyles.badgeText, { color: fg }]}>{label}</Text>
    </View>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function ClientDetailScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const { id: clientId } = useLocalSearchParams<{ id: string }>();

  // Data state
  const [loading, setLoading] = useState(true);
  const [accessDenied, setAccessDenied] = useState(false);
  const [coachProfileId, setCoachProfileId] = useState<string | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [link, setLink] = useState<CoachLink | null>(null);
  const [checkinResponses, setCheckinResponses] = useState<CheckinResponse[]>([]);
  const [programs, setPrograms] = useState<ClientProgram[]>([]);
  const [themeAssignments, setThemeAssignments] = useState<ThemeAssignment[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [notes, setNotes] = useState<CoachNote[]>([]);

  // Note modal state
  const [noteModalVisible, setNoteModalVisible] = useState(false);
  const [noteTitle, setNoteTitle] = useState("");
  const [noteContent, setNoteContent] = useState("");
  const [savingNote, setSavingNote] = useState(false);

  // ── Fetch all data ──────────────────────────────────────────────────────────

  const loadAll = useCallback(async () => {
    if (!clientId) return;
    setLoading(true);

    try {
      // Get authenticated user
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        setAccessDenied(true);
        return;
      }
      const coachId = user.id;
      setCoachProfileId(coachId);

      console.log("[ClientDetail] coach id:", coachId);
      console.log("[ClientDetail] client id:", clientId);

      // Verify active link
      const { data: linkData, error: linkError } = await supabase
        .from("coach_clients")
        .select("id, created_at, status")
        .eq("coach_id", coachId)
        .eq("client_id", clientId)
        .eq("status", "active")
        .single();

      console.log("[ClientDetail] link verified:", linkData);

      if (linkError || !linkData) {
        setAccessDenied(true);
        setLoading(false);
        return;
      }
      setLink(linkData);

      // Fetch profile
      const { data: profileData } = await supabase
        .from("profiles")
        .select("id, full_name, phone, avatar_url, onboarding_completed, created_at")
        .eq("id", clientId)
        .single();
      setProfile(profileData ?? null);

      // Parallel fetches — each wrapped in try/catch
      await Promise.all([
        fetchCheckins(clientId),
        fetchPrograms(clientId),
        fetchInvoices(clientId, coachId),
        fetchAppointments(clientId, coachId),
        fetchNotes(clientId, coachId),
      ]);
    } catch (err: any) {
      console.error("[ClientDetail] loadAll error:", err);
    } finally {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientId]);

  useFocusEffect(loadAll);

  // ── Section fetchers ────────────────────────────────────────────────────────

  const fetchCheckins = async (cid: string) => {
    try {
      const { data, error } = await supabase
        .from("checkin_responses")
        .select("id, created_at, checkin_id, answers, score, checkins(title)")
        .eq("client_id", cid)
        .order("created_at", { ascending: false })
        .limit(10);

      if (error) {
        if (isTableMissingError(error)) return;
        console.error("[ClientDetail] checkin_responses error:", error.message);
        return;
      }
      console.log("[ClientDetail] checkin_responses:", data?.length ?? 0);
      setCheckinResponses((data as CheckinResponse[]) ?? []);
    } catch (e: any) {
      console.error("[ClientDetail] fetchCheckins exception:", e);
    }
  };

  const fetchPrograms = async (cid: string) => {
    try {
      const { data, error } = await supabase
        .from("client_programs")
        .select("id, created_at, status, programs(title, description)")
        .eq("client_id", cid)
        .order("created_at", { ascending: false })
        .limit(10);

      if (error) {
        if (isTableMissingError(error)) {
          // Fallback to theme assignments
          await fetchThemeAssignments(cid);
          return;
        }
        console.error("[ClientDetail] client_programs error:", error.message);
        await fetchThemeAssignments(cid);
        return;
      }
      console.log("[ClientDetail] client_programs:", data?.length ?? 0);
      setPrograms((data as ClientProgram[]) ?? []);
    } catch (e: any) {
      console.error("[ClientDetail] fetchPrograms exception:", e);
      await fetchThemeAssignments(cid);
    }
  };

  const fetchThemeAssignments = async (cid: string) => {
    try {
      const { data, error } = await supabase
        .from("client_theme_assignments")
        .select("id, created_at, status, themes(title)")
        .eq("client_id", cid)
        .limit(10);

      if (error) {
        if (isTableMissingError(error)) return;
        console.error("[ClientDetail] client_theme_assignments error:", error.message);
        return;
      }
      setThemeAssignments((data as ThemeAssignment[]) ?? []);
    } catch (e: any) {
      console.error("[ClientDetail] fetchThemeAssignments exception:", e);
    }
  };

  const fetchInvoices = async (cid: string, _coachId: string) => {
    try {
      const { data, error } = await supabase
        .from("invoices")
        .select("id, created_at, amount, status, due_date, description")
        .eq("client_id", cid)
        .order("created_at", { ascending: false })
        .limit(10);

      if (error) {
        if (isTableMissingError(error)) return;
        console.error("[ClientDetail] invoices error:", error.message);
        return;
      }
      console.log("[ClientDetail] invoices:", data?.length ?? 0);
      setInvoices((data as Invoice[]) ?? []);
    } catch (e: any) {
      console.error("[ClientDetail] fetchInvoices exception:", e);
    }
  };

  const fetchAppointments = async (cid: string, coachId: string) => {
    try {
      const { data, error } = await supabase
        .from("appointments")
        .select("id, title, start_time, end_time, status, notes")
        .eq("client_id", cid)
        .eq("coach_id", coachId)
        .order("start_time", { ascending: false })
        .limit(10);

      if (error) {
        if (isTableMissingError(error)) return;
        console.error("[ClientDetail] appointments error:", error.message);
        return;
      }
      console.log("[ClientDetail] appointments:", data?.length ?? 0);
      setAppointments((data as Appointment[]) ?? []);
    } catch (e: any) {
      console.error("[ClientDetail] fetchAppointments exception:", e);
    }
  };

  const fetchNotes = async (cid: string, coachId: string) => {
    try {
      const { data, error } = await supabase
        .from("coach_notes")
        .select("id, created_at, updated_at, content, title")
        .eq("coach_id", coachId)
        .eq("client_id", cid)
        .order("created_at", { ascending: false });

      if (error) {
        if (isTableMissingError(error)) return;
        console.error("[ClientDetail] coach_notes error:", error.message);
        return;
      }
      console.log("[ClientDetail] coach_notes:", data?.length ?? 0);
      setNotes((data as CoachNote[]) ?? []);
    } catch (e: any) {
      console.error("[ClientDetail] fetchNotes exception:", e);
    }
  };

  // ── Note creation ───────────────────────────────────────────────────────────

  const handleSaveNote = async () => {
    if (!noteContent.trim() || !coachProfileId || !clientId) return;
    console.log("[ClientDetail] Saving note for client:", clientId);
    setSavingNote(true);
    try {
      const { error } = await supabase.from("coach_notes").insert({
        coach_id: coachProfileId,
        client_id: clientId,
        title: noteTitle.trim() || null,
        content: noteContent.trim(),
      });
      if (error) {
        console.error("[ClientDetail] Error saving note:", error.message);
        return;
      }
      console.log("[ClientDetail] Note saved successfully");
      setNoteTitle("");
      setNoteContent("");
      setNoteModalVisible(false);
      await fetchNotes(clientId, coachProfileId);
    } catch (e: any) {
      console.error("[ClientDetail] handleSaveNote exception:", e);
    } finally {
      setSavingNote(false);
    }
  };

  // ── Derived display values ──────────────────────────────────────────────────

  const displayName =
    profile?.full_name?.trim() ? profile.full_name : "Cliënt";
  const initials = displayName
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
  const linkedSince = link ? formatDate(link.created_at) : "—";
  const onboardingLabel =
    profile?.onboarding_completed
      ? "Onboarding voltooid"
      : "Onboarding niet voltooid";
  const onboardingColor =
    profile?.onboarding_completed ? bcctColors.success : bcctColors.accentOrange;

  const homeworkItems = programs.length > 0 ? programs : themeAssignments;
  const hasPrograms = programs.length > 0;

  // ── Loading / access denied ─────────────────────────────────────────────────

  if (loading) {
    return (
      <SafeAreaView
        style={[styles.container, { backgroundColor: colors.background }]}
        edges={["bottom"]}
      >
        <Stack.Screen options={{ title: "Cliënt", headerBackTitle: "Terug" }} />
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={bcctColors.primaryOrange} />
        </View>
      </SafeAreaView>
    );
  }

  if (accessDenied) {
    return (
      <SafeAreaView
        style={[styles.container, { backgroundColor: colors.background }]}
        edges={["bottom"]}
      >
        <Stack.Screen options={{ title: "Geen toegang", headerBackTitle: "Terug" }} />
        <View style={styles.centered}>
          <Text style={styles.accessDeniedIcon}>🔒</Text>
          <Text style={[styles.accessDeniedTitle, { color: colors.text }]}>
            Geen toegang
          </Text>
          <Text style={[styles.accessDeniedSub, { color: bcctColors.textSecondary }]}>
            Deze cliënt is niet aan jouw account gekoppeld.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <>
      <Stack.Screen
        options={{ title: displayName, headerBackTitle: "Terug" }}
      />

      <ScrollView
        style={[styles.container, { backgroundColor: colors.background }]}
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={styles.scrollContent}
      >
        {/* ── Hero card ── */}
        <View style={[styles.heroCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={[styles.avatarCircle, { backgroundColor: bcctColors.primaryOrange + "20" }]}>
            {profile?.avatar_url ? (
              <Image
                source={resolveImageSource(profile.avatar_url)}
                style={styles.avatarImage}
              />
            ) : (
              <Text style={styles.avatarInitials}>{initials}</Text>
            )}
          </View>

          <Text style={[styles.heroName, { color: colors.text }]}>{displayName}</Text>

          {profile?.phone ? (
            <Text style={[styles.heroPhone, { color: bcctColors.textSecondary }]}>
              {profile.phone}
            </Text>
          ) : null}

          <View style={styles.heroBadgesRow}>
            <View style={[styles.badge, { backgroundColor: bcctColors.success + "20" }]}>
              <Text style={[styles.badgeText, { color: bcctColors.success }]}>Actief</Text>
            </View>
            <View style={[styles.badge, { backgroundColor: onboardingColor + "20" }]}>
              <Text style={[styles.badgeText, { color: onboardingColor }]}>
                {onboardingLabel}
              </Text>
            </View>
          </View>

          <Text style={[styles.heroMeta, { color: bcctColors.textSecondary }]}>
            Gekoppeld sinds {linkedSince}
          </Text>
        </View>

        {/* ── Section 1: Dagelijkse logs ── */}
        <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <SectionHeader title="Dagelijkse logs" icon="📋" />
          {checkinResponses.length === 0 ? (
            <EmptyState message="Nog geen logs" />
          ) : (
            checkinResponses.map((r) => {
              const checkinTitle = r.checkins?.title ?? "Check-in";
              const scoreText = r.score != null ? `Score: ${r.score}` : null;
              const dateText = formatDate(r.created_at);
              return (
                <View
                  key={r.id}
                  style={[styles.listItem, { borderBottomColor: colors.border }]}
                >
                  <View style={styles.listItemLeft}>
                    <Text style={[styles.listItemTitle, { color: colors.text }]}>
                      {checkinTitle}
                    </Text>
                    <Text style={[styles.listItemSub, { color: bcctColors.textSecondary }]}>
                      {dateText}
                    </Text>
                  </View>
                  {scoreText ? (
                    <View style={[styles.badge, { backgroundColor: bcctColors.primaryOrange + "20" }]}>
                      <Text style={[styles.badgeText, { color: bcctColors.primaryOrange }]}>
                        {scoreText}
                      </Text>
                    </View>
                  ) : null}
                </View>
              );
            })
          )}
        </View>

        {/* ── Section 2: Huiswerk ── */}
        <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <SectionHeader title="Huiswerk" icon="📚" />
          {homeworkItems.length === 0 ? (
            <EmptyState message="Nog geen huiswerk" />
          ) : (
            homeworkItems.map((item) => {
              const title = hasPrograms
                ? (item as ClientProgram).programs?.title ?? "Programma"
                : (item as ThemeAssignment).themes?.title ?? "Thema";
              const statusText = item.status ?? "—";
              const dateText = formatDate(item.created_at);
              return (
                <View
                  key={item.id}
                  style={[styles.listItem, { borderBottomColor: colors.border }]}
                >
                  <View style={styles.listItemLeft}>
                    <Text style={[styles.listItemTitle, { color: colors.text }]}>
                      {title}
                    </Text>
                    <Text style={[styles.listItemSub, { color: bcctColors.textSecondary }]}>
                      {dateText}
                    </Text>
                  </View>
                  <View style={[styles.badge, { backgroundColor: bcctColors.primaryOrange + "15" }]}>
                    <Text style={[styles.badgeText, { color: bcctColors.primaryOrange }]}>
                      {statusText}
                    </Text>
                  </View>
                </View>
              );
            })
          )}
          <TouchableOpacity
            style={[styles.ctaButton, { borderColor: bcctColors.primaryOrange }]}
            onPress={() => console.log("[ClientDetail] Huiswerk sturen pressed")}
            activeOpacity={0.7}
          >
            <Text style={[styles.ctaButtonText, { color: bcctColors.primaryOrange }]}>
              + Huiswerk sturen
            </Text>
          </TouchableOpacity>
        </View>

        {/* ── Section 3: Betalingen ── */}
        <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <SectionHeader title="Betalingen" icon="💳" />
          {invoices.length === 0 ? (
            <EmptyState message="Nog geen betalingen" />
          ) : (
            invoices.map((inv) => {
              const amountText = formatAmount(inv.amount);
              const dateText = formatDate(inv.created_at);
              const descText = inv.description ?? "Factuur";
              return (
                <View
                  key={inv.id}
                  style={[styles.listItem, { borderBottomColor: colors.border }]}
                >
                  <View style={styles.listItemLeft}>
                    <Text style={[styles.listItemTitle, { color: colors.text }]}>
                      {descText}
                    </Text>
                    <Text style={[styles.listItemSub, { color: bcctColors.textSecondary }]}>
                      {dateText}
                    </Text>
                  </View>
                  <View style={styles.listItemRight}>
                    <Text style={[styles.amountText, { color: colors.text }]}>
                      {amountText}
                    </Text>
                    <InvoiceStatusBadge status={inv.status} />
                  </View>
                </View>
              );
            })
          )}
          <TouchableOpacity
            style={[styles.ctaButton, { borderColor: bcctColors.primaryOrange }]}
            onPress={() => console.log("[ClientDetail] Betaling aanmaken pressed")}
            activeOpacity={0.7}
          >
            <Text style={[styles.ctaButtonText, { color: bcctColors.primaryOrange }]}>
              + Betaling aanmaken
            </Text>
          </TouchableOpacity>
        </View>

        {/* ── Section 4: Afspraken ── */}
        <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <SectionHeader title="Afspraken" icon="📅" />
          {appointments.length === 0 ? (
            <EmptyState message="Nog geen afspraken" />
          ) : (
            appointments.map((apt) => {
              const aptTitle = apt.title ?? "Afspraak";
              const aptDate = formatDate(apt.start_time);
              const aptTimeStart = formatTime(apt.start_time);
              const aptTimeEnd = formatTime(apt.end_time);
              const timeRange = apt.end_time
                ? `${aptTimeStart} – ${aptTimeEnd}`
                : aptTimeStart;
              return (
                <View
                  key={apt.id}
                  style={[styles.listItem, { borderBottomColor: colors.border }]}
                >
                  <View style={styles.listItemLeft}>
                    <Text style={[styles.listItemTitle, { color: colors.text }]}>
                      {aptTitle}
                    </Text>
                    <Text style={[styles.listItemSub, { color: bcctColors.textSecondary }]}>
                      {aptDate}
                    </Text>
                    <Text style={[styles.listItemSub, { color: bcctColors.textSecondary }]}>
                      {timeRange}
                    </Text>
                  </View>
                  {apt.status ? (
                    <View style={[styles.badge, { backgroundColor: bcctColors.primaryOrange + "15" }]}>
                      <Text style={[styles.badgeText, { color: bcctColors.primaryOrange }]}>
                        {apt.status}
                      </Text>
                    </View>
                  ) : null}
                </View>
              );
            })
          )}
          <TouchableOpacity
            style={styles.ctaPrimaryButton}
            onPress={() => {
              console.log("[ClientDetail] Nieuwe afspraak pressed, navigating to appointment-form");
              router.push("/(app)/coach/appointment-form" as any);
            }}
            activeOpacity={0.85}
          >
            <LinearGradient
              colors={[bcctColors.primaryOrange, bcctColors.primaryOrangeDark]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.ctaPrimaryGradient}
            >
              <Text style={styles.ctaPrimaryText}>+ Nieuwe afspraak</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>

        {/* ── Section 5: Notities ── */}
        <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <SectionHeader title="Notities" icon="📝" />
          {notes.length === 0 ? (
            <EmptyState message="Nog geen notities" />
          ) : (
            notes.map((note) => {
              const noteTitle = note.title ?? "Notitie";
              const preview =
                (note.content ?? "").length > 80
                  ? (note.content ?? "").slice(0, 80) + "…"
                  : (note.content ?? "");
              const dateText = formatDate(note.created_at);
              return (
                <View
                  key={note.id}
                  style={[styles.listItem, { borderBottomColor: colors.border }]}
                >
                  <View style={styles.listItemLeft}>
                    <Text style={[styles.listItemTitle, { color: colors.text }]}>
                      {noteTitle}
                    </Text>
                    {preview ? (
                      <Text style={[styles.listItemPreview, { color: bcctColors.textSecondary }]}>
                        {preview}
                      </Text>
                    ) : null}
                    <Text style={[styles.listItemSub, { color: bcctColors.textSecondary }]}>
                      {dateText}
                    </Text>
                  </View>
                </View>
              );
            })
          )}
          <TouchableOpacity
            style={styles.ctaPrimaryButton}
            onPress={() => {
              console.log("[ClientDetail] Nieuwe notitie pressed");
              setNoteModalVisible(true);
            }}
            activeOpacity={0.85}
          >
            <LinearGradient
              colors={[bcctColors.primaryOrange, bcctColors.primaryOrangeDark]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.ctaPrimaryGradient}
            >
              <Text style={styles.ctaPrimaryText}>+ Nieuwe notitie</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* ── Note modal ── */}
      <Modal
        isVisible={noteModalVisible}
        onBackdropPress={() => setNoteModalVisible(false)}
        onBackButtonPress={() => setNoteModalVisible(false)}
        animationIn="slideInUp"
        animationOut="slideOutDown"
        backdropOpacity={0.5}
        style={styles.bottomModal}
        avoidKeyboard
      >
        <View style={[styles.noteModalContent, { backgroundColor: colors.card }]}>
          <View style={styles.modalHandle} />
          <Text style={[styles.noteModalTitle, { color: colors.text }]}>
            Nieuwe notitie
          </Text>

          <Text style={[styles.inputLabel, { color: bcctColors.textSecondary }]}>
            Titel (optioneel)
          </Text>
          <TextInput
            style={[
              styles.textInput,
              { backgroundColor: colors.background, color: colors.text, borderColor: colors.border },
            ]}
            placeholder="Bijv. Sessie samenvatting"
            placeholderTextColor={bcctColors.textSecondary}
            value={noteTitle}
            onChangeText={setNoteTitle}
            returnKeyType="next"
          />

          <Text style={[styles.inputLabel, { color: bcctColors.textSecondary }]}>
            Inhoud
          </Text>
          <TextInput
            style={[
              styles.textInput,
              styles.textArea,
              { backgroundColor: colors.background, color: colors.text, borderColor: colors.border },
            ]}
            placeholder="Schrijf hier je notitie..."
            placeholderTextColor={bcctColors.textSecondary}
            value={noteContent}
            onChangeText={setNoteContent}
            multiline
            numberOfLines={5}
            textAlignVertical="top"
          />

          <View style={styles.noteModalActions}>
            <TouchableOpacity
              style={[styles.noteModalCancel, { borderColor: colors.border }]}
              onPress={() => {
                console.log("[ClientDetail] Note modal cancelled");
                setNoteModalVisible(false);
              }}
              activeOpacity={0.7}
            >
              <Text style={[styles.noteModalCancelText, { color: bcctColors.textSecondary }]}>
                Annuleren
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.noteModalSave, { opacity: savingNote || !noteContent.trim() ? 0.5 : 1 }]}
              onPress={handleSaveNote}
              disabled={savingNote || !noteContent.trim()}
              activeOpacity={0.85}
            >
              <LinearGradient
                colors={[bcctColors.primaryOrange, bcctColors.primaryOrangeDark]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.noteModalSaveGradient}
              >
                {savingNote ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={styles.noteModalSaveText}>Opslaan</Text>
                )}
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const sectionStyles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
    gap: 8,
  },
  leftBorder: {
    width: 4,
    height: 20,
    borderRadius: 2,
    backgroundColor: bcctColors.primaryOrange,
  },
  icon: {
    fontSize: 16,
  },
  title: {
    ...bcctTypography.bodySemiBold,
    color: bcctColors.textPrimary,
    flex: 1,
  },
  emptyState: {
    paddingVertical: 20,
    alignItems: "center",
  },
  emptyText: {
    ...bcctTypography.small,
    color: bcctColors.textSecondary,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    alignSelf: "flex-start",
  },
  badgeText: {
    fontSize: 12,
    fontWeight: "600",
  },
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 32,
  },
  scrollContent: {
    padding: 16,
    gap: 16,
  },

  // Hero card
  heroCard: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 24,
    alignItems: "center",
    gap: 8,
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.08,
        shadowRadius: 6,
      },
      android: { elevation: 2 },
    }),
  },
  avatarCircle: {
    width: 88,
    height: 88,
    borderRadius: 44,
    justifyContent: "center",
    alignItems: "center",
    overflow: "hidden",
    marginBottom: 4,
  },
  avatarImage: {
    width: 88,
    height: 88,
    borderRadius: 44,
  },
  avatarInitials: {
    fontSize: 28,
    fontWeight: "700",
    color: bcctColors.primaryOrange,
  },
  heroName: {
    ...bcctTypography.h2,
    textAlign: "center",
  },
  heroPhone: {
    ...bcctTypography.small,
  },
  heroBadgesRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 4,
    flexWrap: "wrap",
    justifyContent: "center",
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: "600",
  },
  heroMeta: {
    ...bcctTypography.small,
    marginTop: 4,
  },

  // Section card
  section: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.08,
        shadowRadius: 4,
      },
      android: { elevation: 1 },
    }),
  },

  // List items
  listItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 12,
  },
  listItemLeft: {
    flex: 1,
    gap: 2,
  },
  listItemRight: {
    alignItems: "flex-end",
    gap: 4,
  },
  listItemTitle: {
    ...bcctTypography.bodyMedium,
  },
  listItemSub: {
    ...bcctTypography.small,
  },
  listItemPreview: {
    ...bcctTypography.small,
    lineHeight: 18,
  },
  amountText: {
    ...bcctTypography.bodyMedium,
    fontWeight: "700",
  },

  // CTA buttons
  ctaButton: {
    marginTop: 12,
    borderWidth: 1.5,
    borderRadius: 12,
    paddingVertical: 10,
    alignItems: "center",
  },
  ctaButtonText: {
    ...bcctTypography.bodyMedium,
  },
  ctaPrimaryButton: {
    marginTop: 12,
    borderRadius: 12,
    overflow: "hidden",
  },
  ctaPrimaryGradient: {
    paddingVertical: 12,
    alignItems: "center",
  },
  ctaPrimaryText: {
    color: "#fff",
    ...bcctTypography.button,
  },

  // Access denied
  accessDeniedIcon: {
    fontSize: 48,
    marginBottom: 16,
  },
  accessDeniedTitle: {
    ...bcctTypography.h2,
    marginBottom: 8,
    textAlign: "center",
  },
  accessDeniedSub: {
    ...bcctTypography.body,
    textAlign: "center",
  },

  // Note modal
  bottomModal: {
    justifyContent: "flex-end",
    margin: 0,
  },
  noteModalContent: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: 40,
  },
  modalHandle: {
    width: 40,
    height: 4,
    backgroundColor: "#ccc",
    borderRadius: 2,
    alignSelf: "center",
    marginBottom: 20,
  },
  noteModalTitle: {
    ...bcctTypography.h3,
    marginBottom: 20,
  },
  inputLabel: {
    ...bcctTypography.label,
    marginBottom: 6,
  },
  textInput: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    ...bcctTypography.body,
    marginBottom: 16,
  },
  textArea: {
    minHeight: 120,
    paddingTop: 12,
  },
  noteModalActions: {
    flexDirection: "row",
    gap: 12,
    marginTop: 4,
  },
  noteModalCancel: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
  },
  noteModalCancelText: {
    ...bcctTypography.bodyMedium,
  },
  noteModalSave: {
    flex: 1,
    borderRadius: 12,
    overflow: "hidden",
  },
  noteModalSaveGradient: {
    paddingVertical: 12,
    alignItems: "center",
  },
  noteModalSaveText: {
    color: "#fff",
    ...bcctTypography.button,
  },
});
