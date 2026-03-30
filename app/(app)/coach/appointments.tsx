
import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
  TextInput,
  Alert,
  Platform,
  KeyboardAvoidingView,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import DateTimePicker from "@react-native-community/datetimepicker";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import { bcctColors, bcctTypography } from "@/styles/bcctTheme";
import { useRouter } from "expo-router";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Appointment {
  id: string;
  coach_id: string;
  client_id: string | null;
  title: string;
  notes: string | null;
  start_time: string;
  end_time: string;
  status: "scheduled" | "completed" | "cancelled";
  created_at: string;
  clientName?: string;
  clientAvatar?: string | null;
}

interface ClientOption {
  id: string;
  full_name: string;
  avatar_url: string | null;
}

// ─── Dutch locale helpers ─────────────────────────────────────────────────────

const DUTCH_DAYS = ["Zondag", "Maandag", "Dinsdag", "Woensdag", "Donderdag", "Vrijdag", "Zaterdag"];
const DUTCH_MONTHS = [
  "januari", "februari", "maart", "april", "mei", "juni",
  "juli", "augustus", "september", "oktober", "november", "december",
];

function formatDutchDate(date: Date): string {
  const day = DUTCH_DAYS[date.getDay()];
  const month = DUTCH_MONTHS[date.getMonth()];
  return `${day} ${date.getDate()} ${month}`;
}

function formatTime(dateStr: string): string {
  const d = new Date(dateStr);
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${hh}:${mm}`;
}

function formatTimeRange(start: string, end: string): string {
  return `${formatTime(start)} – ${formatTime(end)}`;
}

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function endOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
}

// ─── Card shadow ──────────────────────────────────────────────────────────────

const CARD_SHADOW = {
  shadowColor: "#000",
  shadowOffset: { width: 0, height: 2 },
  shadowOpacity: 0.06,
  shadowRadius: 8,
  elevation: 3,
};

// ─── Avatar initial helper ────────────────────────────────────────────────────

function avatarInitial(name: string): string {
  return name ? name.charAt(0).toUpperCase() : "?";
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function CoachAppointmentsScreen() {
  const { user } = useAuth();
  const router = useRouter();

  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [clients, setClients] = useState<ClientOption[]>([]);

  // Create / Edit modal
  const [createVisible, setCreateVisible] = useState(false);
  const [editingAppointment, setEditingAppointment] = useState<Appointment | null>(null);

  // Detail modal
  const [detailAppointment, setDetailAppointment] = useState<Appointment | null>(null);
  const [detailVisible, setDetailVisible] = useState(false);

  // Form state
  const [formTitle, setFormTitle] = useState("");
  const [formClientId, setFormClientId] = useState<string | null>(null);
  const [formDate, setFormDate] = useState<Date>(new Date());
  const [formStartTime, setFormStartTime] = useState<Date>(new Date());
  const [formEndTime, setFormEndTime] = useState<Date>(new Date());
  const [formNotes, setFormNotes] = useState("");
  const [formSaving, setFormSaving] = useState(false);

  // Date/time picker visibility (Android needs explicit show)
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker] = useState(false);

  // Client selector sheet
  const [clientSelectorVisible, setClientSelectorVisible] = useState(false);

  // ── Fetch appointments for selected date ──────────────────────────────────

  const fetchAppointments = useCallback(async () => {
    if (!user?.id) return;
    console.log("[Appointments] Fetching appointments for date:", selectedDate.toDateString());
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("appointments")
        .select("*")
        .eq("coach_id", user.id)
        .gte("start_time", startOfDay(selectedDate).toISOString())
        .lte("start_time", endOfDay(selectedDate).toISOString())
        .order("start_time", { ascending: true });

      if (error) {
        console.error("[Appointments] Fetch error:", error);
        Alert.alert("Fout", "Kon afspraken niet laden.");
        setLoading(false);
        return;
      }

      console.log("[Appointments] Fetched", data?.length ?? 0, "appointments");

      // Enrich with client names
      const appts: Appointment[] = data ?? [];
      const clientIds = appts.map((a) => a.client_id).filter(Boolean) as string[];

      let clientMap: Record<string, { name: string; avatar: string | null }> = {};
      if (clientIds.length > 0) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, full_name, avatar_url")
          .in("id", clientIds);
        if (profiles) {
          profiles.forEach((p: any) => {
            clientMap[p.id] = { name: p.full_name || "Onbekend", avatar: p.avatar_url ?? null };
          });
        }
      }

      const enriched = appts.map((a) => ({
        ...a,
        clientName: a.client_id ? (clientMap[a.client_id]?.name ?? "Onbekend") : undefined,
        clientAvatar: a.client_id ? (clientMap[a.client_id]?.avatar ?? null) : null,
      }));

      setAppointments(enriched);
    } catch (err: any) {
      console.error("[Appointments] Unexpected error:", err);
      Alert.alert("Fout", "Er is een onverwachte fout opgetreden.");
    } finally {
      setLoading(false);
    }
  }, [user?.id, selectedDate]);

  // ── Fetch coach's clients ─────────────────────────────────────────────────

  const fetchClients = useCallback(async () => {
    if (!user?.id) return;
    console.log("[Appointments] Fetching clients for coach:", user.id);
    try {
      const { data: links, error: linksError } = await supabase
        .from("coach_clients")
        .select("client_id")
        .eq("coach_id", user.id);

      if (linksError) {
        console.error("[Appointments] Coach clients fetch error:", linksError);
        return;
      }

      const ids = (links ?? []).map((l: any) => l.client_id).filter(Boolean);
      if (ids.length === 0) {
        setClients([]);
        return;
      }

      const { data: profiles, error: profilesError } = await supabase
        .from("profiles")
        .select("id, full_name, avatar_url")
        .in("id", ids);

      if (profilesError) {
        console.error("[Appointments] Profiles fetch error:", profilesError);
        return;
      }

      const clientList: ClientOption[] = (profiles ?? []).map((p: any) => ({
        id: p.id,
        full_name: p.full_name || "Onbekend",
        avatar_url: p.avatar_url ?? null,
      }));

      console.log("[Appointments] Loaded", clientList.length, "clients");
      setClients(clientList);
    } catch (err: any) {
      console.error("[Appointments] Unexpected clients error:", err);
    }
  }, [user?.id]);

  useEffect(() => {
    fetchAppointments();
  }, [fetchAppointments]);

  useEffect(() => {
    fetchClients();
  }, [fetchClients]);

  // ── Date navigation ───────────────────────────────────────────────────────

  const goToPrevDay = () => {
    console.log("[Appointments] Navigate to previous day");
    const d = new Date(selectedDate);
    d.setDate(d.getDate() - 1);
    setSelectedDate(d);
  };

  const goToNextDay = () => {
    console.log("[Appointments] Navigate to next day");
    const d = new Date(selectedDate);
    d.setDate(d.getDate() + 1);
    setSelectedDate(d);
  };

  const goToToday = () => {
    console.log("[Appointments] Navigate to today");
    setSelectedDate(new Date());
  };

  // ── Open create modal ─────────────────────────────────────────────────────

  const openCreate = () => {
    console.log("[Appointments] Open create appointment modal");
    const now = new Date();
    const start = new Date(selectedDate);
    start.setHours(now.getHours(), 0, 0, 0);
    const end = new Date(start);
    end.setHours(start.getHours() + 1);

    setEditingAppointment(null);
    setFormTitle("");
    setFormClientId(null);
    setFormDate(new Date(selectedDate));
    setFormStartTime(start);
    setFormEndTime(end);
    setFormNotes("");
    setCreateVisible(true);
  };

  // ── Open edit modal ───────────────────────────────────────────────────────

  const openEdit = (appt: Appointment) => {
    console.log("[Appointments] Open edit appointment:", appt.id);
    setDetailVisible(false);
    setEditingAppointment(appt);
    setFormTitle(appt.title);
    setFormClientId(appt.client_id);
    setFormDate(new Date(appt.start_time));
    setFormStartTime(new Date(appt.start_time));
    setFormEndTime(new Date(appt.end_time));
    setFormNotes(appt.notes ?? "");
    setCreateVisible(true);
  };

  // ── Save appointment ──────────────────────────────────────────────────────

  const saveAppointment = async () => {
    if (!formTitle.trim()) {
      Alert.alert("Verplicht veld", "Voer een titel in voor de afspraak.");
      return;
    }
    if (!user?.id) return;

    // Combine date + time
    const startDt = new Date(formDate);
    startDt.setHours(formStartTime.getHours(), formStartTime.getMinutes(), 0, 0);
    const endDt = new Date(formDate);
    endDt.setHours(formEndTime.getHours(), formEndTime.getMinutes(), 0, 0);

    if (endDt <= startDt) {
      Alert.alert("Ongeldige tijd", "Eindtijd moet na begintijd liggen.");
      return;
    }

    console.log("[Appointments] Saving appointment, editing:", editingAppointment?.id ?? "new");
    setFormSaving(true);

    try {
      const payload = {
        coach_id: user.id,
        client_id: formClientId || null,
        title: formTitle.trim(),
        notes: formNotes.trim() || null,
        start_time: startDt.toISOString(),
        end_time: endDt.toISOString(),
        status: "scheduled" as const,
      };

      if (editingAppointment) {
        const { error } = await supabase
          .from("appointments")
          .update(payload)
          .eq("id", editingAppointment.id);
        if (error) throw error;
        console.log("[Appointments] Appointment updated:", editingAppointment.id);
      } else {
        const { error } = await supabase.from("appointments").insert(payload);
        if (error) throw error;
        console.log("[Appointments] Appointment created");
      }

      setCreateVisible(false);
      setEditingAppointment(null);
      fetchAppointments();
    } catch (err: any) {
      console.error("[Appointments] Save error:", err);
      Alert.alert("Fout", "Kon afspraak niet opslaan. Probeer opnieuw.");
    } finally {
      setFormSaving(false);
    }
  };

  // ── Delete appointment ────────────────────────────────────────────────────

  const deleteAppointment = (appt: Appointment) => {
    console.log("[Appointments] Delete pressed for appointment:", appt.id);
    Alert.alert(
      "Afspraak verwijderen",
      `Weet je zeker dat je "${appt.title}" wilt verwijderen?`,
      [
        { text: "Annuleren", style: "cancel" },
        {
          text: "Verwijderen",
          style: "destructive",
          onPress: async () => {
            console.log("[Appointments] Confirming delete:", appt.id);
            try {
              const { error } = await supabase
                .from("appointments")
                .delete()
                .eq("id", appt.id);
              if (error) throw error;
              console.log("[Appointments] Appointment deleted:", appt.id);
              setDetailVisible(false);
              fetchAppointments();
            } catch (err: any) {
              console.error("[Appointments] Delete error:", err);
              Alert.alert("Fout", "Kon afspraak niet verwijderen.");
            }
          },
        },
      ]
    );
  };

  // ── Open detail ───────────────────────────────────────────────────────────

  const openDetail = (appt: Appointment) => {
    console.log("[Appointments] Open detail for appointment:", appt.id);
    setDetailAppointment(appt);
    setDetailVisible(true);
  };

  // ── Start chat ────────────────────────────────────────────────────────────

  const startChat = (appt: Appointment) => {
    const clientName = appt.clientName ?? "cliënt";
    console.log("[Appointments] Start chat pressed for:", clientName);
    try {
      router.push("/(app)/coach/chat" as any);
    } catch {
      Alert.alert("Chat openen", `Chat openen met ${clientName}`);
    }
  };

  // ── Selected client name ──────────────────────────────────────────────────

  const selectedClientName = formClientId
    ? (clients.find((c) => c.id === formClientId)?.full_name ?? "Onbekend")
    : "Geen cliënt";

  const isToday = isSameDay(selectedDate, new Date());
  const dateLabel = formatDutchDate(selectedDate);

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      {/* ── Header ── */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Afspraken</Text>
        <TouchableOpacity
          style={styles.addButton}
          onPress={() => {
            console.log("[Appointments] + button pressed");
            openCreate();
          }}
          activeOpacity={0.8}
        >
          <Ionicons name="add" size={22} color="#fff" />
        </TouchableOpacity>
      </View>

      {/* ── Date navigation bar ── */}
      <View style={styles.dateBar}>
        <TouchableOpacity style={styles.arrowBtn} onPress={goToPrevDay} activeOpacity={0.7}>
          <Ionicons name="chevron-back" size={20} color={bcctColors.textPrimary} />
        </TouchableOpacity>

        <View style={styles.dateLabelWrap}>
          <Text style={styles.dateLabel}>{dateLabel}</Text>
        </View>

        <TouchableOpacity style={styles.arrowBtn} onPress={goToNextDay} activeOpacity={0.7}>
          <Ionicons name="chevron-forward" size={20} color={bcctColors.textPrimary} />
        </TouchableOpacity>

        {!isToday && (
          <TouchableOpacity style={styles.todayBtn} onPress={goToToday} activeOpacity={0.8}>
            <Text style={styles.todayBtnText}>Vandaag</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* ── Appointment list ── */}
      {loading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={bcctColors.primaryOrange} />
        </View>
      ) : appointments.length === 0 ? (
        <View style={styles.emptyWrap}>
          <View style={styles.emptyIconCircle}>
            <Ionicons name="calendar-outline" size={40} color={bcctColors.primaryOrange} />
          </View>
          <Text style={styles.emptyTitle}>Geen afspraken</Text>
          <Text style={styles.emptySubtitle}>Plan je eerste afspraak</Text>
          <TouchableOpacity
            style={styles.emptyCtaBtn}
            onPress={() => {
              console.log("[Appointments] Nieuwe afspraak (empty state) pressed");
              openCreate();
            }}
            activeOpacity={0.8}
          >
            <Text style={styles.emptyCtaText}>Nieuwe afspraak</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.listContent}>
          {appointments.map((appt) => {
            const timeRange = formatTimeRange(appt.start_time, appt.end_time);
            const clientLabel = appt.clientName ?? "Geen cliënt";
            const notesPreview = appt.notes ? appt.notes.slice(0, 60) : "";
            const initial = avatarInitial(clientLabel);

            return (
              <TouchableOpacity
                key={appt.id}
                style={[styles.apptCard, CARD_SHADOW]}
                onPress={() => openDetail(appt)}
                activeOpacity={0.85}
              >
                <View style={styles.apptTimeCol}>
                  <Text style={styles.apptTime}>{timeRange}</Text>
                  <View style={styles.apptDot} />
                </View>
                <View style={styles.apptBody}>
                  <View style={styles.apptAvatarRow}>
                    <View style={styles.apptAvatar}>
                      <Text style={styles.apptAvatarText}>{initial}</Text>
                    </View>
                    <View style={styles.apptMeta}>
                      <Text style={styles.apptTitle}>{appt.title}</Text>
                      <Text style={styles.apptClient}>{clientLabel}</Text>
                    </View>
                  </View>
                  {notesPreview.length > 0 && (
                    <Text style={styles.apptNotes} numberOfLines={2}>
                      {notesPreview}
                    </Text>
                  )}
                </View>
                <Ionicons name="chevron-forward" size={16} color={bcctColors.textSecondary} />
              </TouchableOpacity>
            );
          })}
          <View style={{ height: 120 }} />
        </ScrollView>
      )}

      {/* ── Create / Edit Modal ── */}
      <Modal
        visible={createVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => {
          console.log("[Appointments] Create modal dismissed");
          setCreateVisible(false);
        }}
      >
        <KeyboardAvoidingView
          style={styles.modalContainer}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <View style={styles.modalHandle} />
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>
              {editingAppointment ? "Afspraak bewerken" : "Nieuwe afspraak"}
            </Text>
            <TouchableOpacity
              onPress={() => {
                console.log("[Appointments] Create modal close pressed");
                setCreateVisible(false);
              }}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name="close" size={22} color={bcctColors.textSecondary} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalScroll} keyboardShouldPersistTaps="handled">
            {/* Title */}
            <Text style={styles.fieldLabel}>Titel</Text>
            <TextInput
              style={styles.textInput}
              placeholder="Afspraak titel"
              placeholderTextColor={bcctColors.textSecondary}
              value={formTitle}
              onChangeText={setFormTitle}
            />

            {/* Client selector */}
            <Text style={styles.fieldLabel}>Cliënt</Text>
            <TouchableOpacity
              style={styles.selectorBtn}
              onPress={() => {
                console.log("[Appointments] Client selector opened");
                setClientSelectorVisible(true);
              }}
              activeOpacity={0.8}
            >
              <Text style={[styles.selectorText, !formClientId && styles.selectorPlaceholder]}>
                {selectedClientName}
              </Text>
              <Ionicons name="chevron-down" size={16} color={bcctColors.textSecondary} />
            </TouchableOpacity>

            {/* Date */}
            <Text style={styles.fieldLabel}>Datum</Text>
            {Platform.OS === "ios" ? (
              <DateTimePicker
                value={formDate}
                mode="date"
                display="compact"
                onChange={(_e, date) => {
                  if (date) {
                    console.log("[Appointments] Date changed:", date.toDateString());
                    setFormDate(date);
                  }
                }}
                style={styles.iosPicker}
              />
            ) : (
              <>
                <TouchableOpacity
                  style={styles.selectorBtn}
                  onPress={() => {
                    console.log("[Appointments] Android date picker opened");
                    setShowDatePicker(true);
                  }}
                  activeOpacity={0.8}
                >
                  <Text style={styles.selectorText}>{formatDutchDate(formDate)}</Text>
                  <Ionicons name="calendar-outline" size={16} color={bcctColors.textSecondary} />
                </TouchableOpacity>
                {showDatePicker && (
                  <DateTimePicker
                    value={formDate}
                    mode="date"
                    display="default"
                    onChange={(_e, date) => {
                      setShowDatePicker(false);
                      if (date) {
                        console.log("[Appointments] Android date selected:", date.toDateString());
                        setFormDate(date);
                      }
                    }}
                  />
                )}
              </>
            )}

            {/* Start time */}
            <Text style={styles.fieldLabel}>Begintijd</Text>
            {Platform.OS === "ios" ? (
              <DateTimePicker
                value={formStartTime}
                mode="time"
                display="compact"
                minuteInterval={15}
                onChange={(_e, date) => {
                  if (date) {
                    console.log("[Appointments] Start time changed:", date.toTimeString());
                    setFormStartTime(date);
                  }
                }}
                style={styles.iosPicker}
              />
            ) : (
              <>
                <TouchableOpacity
                  style={styles.selectorBtn}
                  onPress={() => {
                    console.log("[Appointments] Android start time picker opened");
                    setShowStartPicker(true);
                  }}
                  activeOpacity={0.8}
                >
                  <Text style={styles.selectorText}>{formatTime(formStartTime.toISOString())}</Text>
                  <Ionicons name="time-outline" size={16} color={bcctColors.textSecondary} />
                </TouchableOpacity>
                {showStartPicker && (
                  <DateTimePicker
                    value={formStartTime}
                    mode="time"
                    display="default"
                    minuteInterval={15}
                    onChange={(_e, date) => {
                      setShowStartPicker(false);
                      if (date) {
                        console.log("[Appointments] Android start time selected:", date.toTimeString());
                        setFormStartTime(date);
                      }
                    }}
                  />
                )}
              </>
            )}

            {/* End time */}
            <Text style={styles.fieldLabel}>Eindtijd</Text>
            {Platform.OS === "ios" ? (
              <DateTimePicker
                value={formEndTime}
                mode="time"
                display="compact"
                minuteInterval={15}
                onChange={(_e, date) => {
                  if (date) {
                    console.log("[Appointments] End time changed:", date.toTimeString());
                    setFormEndTime(date);
                  }
                }}
                style={styles.iosPicker}
              />
            ) : (
              <>
                <TouchableOpacity
                  style={styles.selectorBtn}
                  onPress={() => {
                    console.log("[Appointments] Android end time picker opened");
                    setShowEndPicker(true);
                  }}
                  activeOpacity={0.8}
                >
                  <Text style={styles.selectorText}>{formatTime(formEndTime.toISOString())}</Text>
                  <Ionicons name="time-outline" size={16} color={bcctColors.textSecondary} />
                </TouchableOpacity>
                {showEndPicker && (
                  <DateTimePicker
                    value={formEndTime}
                    mode="time"
                    display="default"
                    minuteInterval={15}
                    onChange={(_e, date) => {
                      setShowEndPicker(false);
                      if (date) {
                        console.log("[Appointments] Android end time selected:", date.toTimeString());
                        setFormEndTime(date);
                      }
                    }}
                  />
                )}
              </>
            )}

            {/* Notes */}
            <Text style={styles.fieldLabel}>Notities</Text>
            <TextInput
              style={[styles.textInput, styles.notesInput]}
              placeholder="Notities..."
              placeholderTextColor={bcctColors.textSecondary}
              value={formNotes}
              onChangeText={setFormNotes}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />

            {/* Actions */}
            <TouchableOpacity
              style={[styles.saveBtn, formSaving && styles.saveBtnDisabled]}
              onPress={() => {
                console.log("[Appointments] Opslaan pressed");
                saveAppointment();
              }}
              activeOpacity={0.85}
              disabled={formSaving}
            >
              {formSaving ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text style={styles.saveBtnText}>Opslaan</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.cancelBtn}
              onPress={() => {
                console.log("[Appointments] Annuleren pressed");
                setCreateVisible(false);
              }}
              activeOpacity={0.8}
            >
              <Text style={styles.cancelBtnText}>Annuleren</Text>
            </TouchableOpacity>

            <View style={{ height: 40 }} />
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>

      {/* ── Client selector sheet ── */}
      <Modal
        visible={clientSelectorVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setClientSelectorVisible(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHandle} />
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Selecteer cliënt</Text>
            <TouchableOpacity
              onPress={() => {
                console.log("[Appointments] Client selector closed");
                setClientSelectorVisible(false);
              }}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name="close" size={22} color={bcctColors.textSecondary} />
            </TouchableOpacity>
          </View>
          <ScrollView>
            {/* No client option */}
            <TouchableOpacity
              style={[
                styles.clientRow,
                !formClientId && styles.clientRowSelected,
              ]}
              onPress={() => {
                console.log("[Appointments] Client deselected (geen cliënt)");
                setFormClientId(null);
                setClientSelectorVisible(false);
              }}
              activeOpacity={0.8}
            >
              <View style={[styles.clientAvatar, { backgroundColor: "#E5E7EB" }]}>
                <Ionicons name="person-outline" size={18} color={bcctColors.textSecondary} />
              </View>
              <Text style={styles.clientName}>Geen cliënt</Text>
              {!formClientId && (
                <Ionicons name="checkmark" size={18} color={bcctColors.primaryOrange} />
              )}
            </TouchableOpacity>

            {clients.length === 0 ? (
              <View style={styles.noClientsWrap}>
                <Text style={styles.noClientsText}>Geen cliënten gevonden</Text>
              </View>
            ) : (
              clients.map((c) => {
                const isSelected = formClientId === c.id;
                const initial = avatarInitial(c.full_name);
                return (
                  <TouchableOpacity
                    key={c.id}
                    style={[styles.clientRow, isSelected && styles.clientRowSelected]}
                    onPress={() => {
                      console.log("[Appointments] Client selected:", c.full_name);
                      setFormClientId(c.id);
                      setClientSelectorVisible(false);
                    }}
                    activeOpacity={0.8}
                  >
                    <View style={styles.clientAvatar}>
                      <Text style={styles.clientAvatarText}>{initial}</Text>
                    </View>
                    <Text style={styles.clientName}>{c.full_name}</Text>
                    {isSelected && (
                      <Ionicons name="checkmark" size={18} color={bcctColors.primaryOrange} />
                    )}
                  </TouchableOpacity>
                );
              })
            )}
            <View style={{ height: 60 }} />
          </ScrollView>
        </View>
      </Modal>

      {/* ── Detail Modal ── */}
      <Modal
        visible={detailVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => {
          console.log("[Appointments] Detail modal dismissed");
          setDetailVisible(false);
        }}
      >
        {detailAppointment && (
          <View style={styles.modalContainer}>
            <View style={styles.modalHandle} />
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Afspraak details</Text>
              <TouchableOpacity
                onPress={() => {
                  console.log("[Appointments] Detail modal close pressed");
                  setDetailVisible(false);
                }}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons name="close" size={22} color={bcctColors.textSecondary} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalScroll}>
              {/* Client avatar + name */}
              <View style={styles.detailClientRow}>
                <View style={styles.detailAvatar}>
                  <Text style={styles.detailAvatarText}>
                    {avatarInitial(detailAppointment.clientName ?? "?")}
                  </Text>
                </View>
                <View>
                  <Text style={styles.detailClientName}>
                    {detailAppointment.clientName ?? "Geen cliënt"}
                  </Text>
                  <Text style={styles.detailClientSub}>Cliënt</Text>
                </View>
              </View>

              {/* Date & time */}
              <View style={styles.detailRow}>
                <Ionicons name="calendar-outline" size={18} color={bcctColors.primaryOrange} />
                <Text style={styles.detailRowText}>
                  {formatDutchDate(new Date(detailAppointment.start_time))}
                </Text>
              </View>
              <View style={styles.detailRow}>
                <Ionicons name="time-outline" size={18} color={bcctColors.primaryOrange} />
                <Text style={styles.detailRowText}>
                  {formatTimeRange(detailAppointment.start_time, detailAppointment.end_time)}
                </Text>
              </View>

              {/* Title */}
              <View style={styles.detailSection}>
                <Text style={styles.detailSectionLabel}>Titel</Text>
                <Text style={styles.detailSectionValue}>{detailAppointment.title}</Text>
              </View>

              {/* Notes */}
              {detailAppointment.notes ? (
                <View style={styles.detailSection}>
                  <Text style={styles.detailSectionLabel}>Notities</Text>
                  <Text style={styles.detailSectionValue}>{detailAppointment.notes}</Text>
                </View>
              ) : null}

              {/* Action buttons */}
              <View style={styles.detailActions}>
                <TouchableOpacity
                  style={styles.detailActionBtn}
                  onPress={() => {
                    console.log("[Appointments] Bewerken pressed for:", detailAppointment.id);
                    openEdit(detailAppointment);
                  }}
                  activeOpacity={0.8}
                >
                  <Ionicons name="create-outline" size={18} color={bcctColors.primaryOrange} />
                  <Text style={styles.detailActionText}>Bewerken</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.detailActionBtn, styles.detailActionDanger]}
                  onPress={() => deleteAppointment(detailAppointment)}
                  activeOpacity={0.8}
                >
                  <Ionicons name="trash-outline" size={18} color={bcctColors.error} />
                  <Text style={[styles.detailActionText, { color: bcctColors.error }]}>
                    Verwijderen
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.detailActionBtn, styles.detailActionChat]}
                  onPress={() => startChat(detailAppointment)}
                  activeOpacity={0.8}
                >
                  <Ionicons name="chatbubble-outline" size={18} color="#fff" />
                  <Text style={[styles.detailActionText, { color: "#fff" }]}>Start chat</Text>
                </TouchableOpacity>
              </View>

              <View style={{ height: 60 }} />
            </ScrollView>
          </View>
        )}
      </Modal>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: bcctColors.lightBackground,
  },

  // Header
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 12,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: "700",
    color: bcctColors.textPrimary,
  },
  addButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: bcctColors.primaryOrange,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: bcctColors.primaryOrange,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },

  // Date bar
  dateBar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: bcctColors.cardBackground,
    borderBottomWidth: 1,
    borderBottomColor: bcctColors.borderGray,
    gap: 4,
  },
  arrowBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F3F4F6",
  },
  dateLabelWrap: {
    flex: 1,
    alignItems: "center",
  },
  dateLabel: {
    fontSize: 15,
    fontWeight: "600",
    color: bcctColors.textPrimary,
  },
  todayBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
    backgroundColor: `${bcctColors.primaryOrange}18`,
  },
  todayBtnText: {
    fontSize: 13,
    fontWeight: "600",
    color: bcctColors.primaryOrange,
  },

  // Loading / empty
  loadingWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
    gap: 12,
  },
  emptyIconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: `${bcctColors.primaryOrange}18`,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: bcctColors.textPrimary,
  },
  emptySubtitle: {
    fontSize: 14,
    color: bcctColors.textSecondary,
  },
  emptyCtaBtn: {
    marginTop: 8,
    backgroundColor: bcctColors.primaryOrange,
    paddingVertical: 12,
    paddingHorizontal: 28,
    borderRadius: 20,
    shadowColor: bcctColors.primaryOrange,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  emptyCtaText: {
    fontSize: 15,
    fontWeight: "700",
    color: "#fff",
  },

  // Appointment list
  listContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  apptCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: bcctColors.cardBackground,
    borderRadius: 16,
    padding: 14,
    marginBottom: 10,
  },
  apptTimeCol: {
    alignItems: "center",
    marginRight: 12,
    width: 72,
  },
  apptTime: {
    fontSize: 12,
    fontWeight: "600",
    color: bcctColors.primaryOrange,
    textAlign: "center",
  },
  apptDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: bcctColors.primaryOrange,
    marginTop: 6,
  },
  apptBody: {
    flex: 1,
  },
  apptAvatarRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  apptAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: `${bcctColors.primaryOrange}22`,
    alignItems: "center",
    justifyContent: "center",
  },
  apptAvatarText: {
    fontSize: 14,
    fontWeight: "700",
    color: bcctColors.primaryOrange,
  },
  apptMeta: {
    flex: 1,
  },
  apptTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: bcctColors.textPrimary,
  },
  apptClient: {
    fontSize: 12,
    color: bcctColors.textSecondary,
    marginTop: 1,
  },
  apptNotes: {
    fontSize: 12,
    color: bcctColors.textSecondary,
    marginTop: 6,
    lineHeight: 17,
  },

  // Modal shared
  modalContainer: {
    flex: 1,
    backgroundColor: bcctColors.cardBackground,
  },
  modalHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#E5E7EB",
    alignSelf: "center",
    marginTop: 12,
    marginBottom: 4,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: bcctColors.borderGray,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: bcctColors.textPrimary,
  },
  modalScroll: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 16,
  },

  // Form fields
  fieldLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: bcctColors.textSecondary,
    marginBottom: 6,
    marginTop: 16,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  textInput: {
    backgroundColor: "#F9FAFB",
    borderWidth: 1,
    borderColor: bcctColors.borderGray,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: bcctColors.textPrimary,
  },
  notesInput: {
    minHeight: 100,
    paddingTop: 12,
  },
  selectorBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#F9FAFB",
    borderWidth: 1,
    borderColor: bcctColors.borderGray,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  selectorText: {
    fontSize: 15,
    color: bcctColors.textPrimary,
  },
  selectorPlaceholder: {
    color: bcctColors.textSecondary,
  },
  iosPicker: {
    alignSelf: "flex-start",
    marginLeft: -4,
  },

  // Save / cancel
  saveBtn: {
    marginTop: 24,
    backgroundColor: bcctColors.primaryOrange,
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: "center",
    shadowColor: bcctColors.primaryOrange,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 5,
  },
  saveBtnDisabled: {
    opacity: 0.6,
  },
  saveBtnText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#fff",
  },
  cancelBtn: {
    marginTop: 12,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
    borderWidth: 1,
    borderColor: bcctColors.borderGray,
  },
  cancelBtnText: {
    fontSize: 15,
    fontWeight: "600",
    color: bcctColors.textSecondary,
  },

  // Client selector
  clientRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
    gap: 12,
  },
  clientRowSelected: {
    backgroundColor: `${bcctColors.primaryOrange}0A`,
  },
  clientAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: `${bcctColors.primaryOrange}22`,
    alignItems: "center",
    justifyContent: "center",
  },
  clientAvatarText: {
    fontSize: 16,
    fontWeight: "700",
    color: bcctColors.primaryOrange,
  },
  clientName: {
    flex: 1,
    fontSize: 15,
    fontWeight: "500",
    color: bcctColors.textPrimary,
  },
  noClientsWrap: {
    padding: 32,
    alignItems: "center",
  },
  noClientsText: {
    fontSize: 14,
    color: bcctColors.textSecondary,
  },

  // Detail modal
  detailClientRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
    marginBottom: 8,
  },
  detailAvatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: `${bcctColors.primaryOrange}22`,
    alignItems: "center",
    justifyContent: "center",
  },
  detailAvatarText: {
    fontSize: 20,
    fontWeight: "700",
    color: bcctColors.primaryOrange,
  },
  detailClientName: {
    fontSize: 17,
    fontWeight: "700",
    color: bcctColors.textPrimary,
  },
  detailClientSub: {
    fontSize: 13,
    color: bcctColors.textSecondary,
    marginTop: 2,
  },
  detailRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 10,
  },
  detailRowText: {
    fontSize: 15,
    color: bcctColors.textPrimary,
  },
  detailSection: {
    marginTop: 16,
  },
  detailSectionLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: bcctColors.textSecondary,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  detailSectionValue: {
    fontSize: 15,
    color: bcctColors.textPrimary,
    lineHeight: 22,
  },
  detailActions: {
    marginTop: 28,
    gap: 10,
  },
  detailActionBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: bcctColors.borderGray,
    backgroundColor: bcctColors.cardBackground,
  },
  detailActionDanger: {
    borderColor: `${bcctColors.error}40`,
    backgroundColor: `${bcctColors.error}08`,
  },
  detailActionChat: {
    borderColor: bcctColors.primaryOrange,
    backgroundColor: bcctColors.primaryOrange,
  },
  detailActionText: {
    fontSize: 15,
    fontWeight: "600",
    color: bcctColors.textPrimary,
  },
});
