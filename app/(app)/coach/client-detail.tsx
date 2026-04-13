
import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Animated,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Linking,
} from "react-native";
import Modal from "react-native-modal";
import { useTheme } from "@react-navigation/native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect } from "expo-router";
import { IconSymbol } from "@/components/IconSymbol";
import { useRouter, useLocalSearchParams } from "expo-router";
import { supabase } from "@/lib/supabase";
import { bcctColors, bcctTypography } from "@/styles/bcctTheme";
import { AnimatedPressable } from "@/components/AnimatedPressable";
import { useAuth } from "@/contexts/AuthContext";
import { listAssignments, createAssignment, HomeworkAssignment } from "@/utils/homeworkApi";

// ─── Types ────────────────────────────────────────────────────────────────────

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

interface Invoice {
  id: string;
  created_at: string;
  amount: number | null;
  status: string | null;
  due_date: string | null;
  description: string | null;
  title: string | null;
  type: string | null;
  stripe_payment_link: string | null;
}

type PaymentType = "one_time" | "package" | "recurring_monthly";

interface Appointment {
  id: string;
  title: string | null;
  start_time: string | null;
  end_time: string | null;
  status: string | null;
  notes: string | null;
}

type TabKey = "overzicht" | "huiswerk" | "betalingen" | "afspraken";

// ─── Helpers ──────────────────────────────────────────────────────────────────

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

function formatDateTime(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  const day = String(d.getDate()).padStart(2, "0");
  const months = ["jan", "feb", "mrt", "apr", "mei", "jun", "jul", "aug", "sep", "okt", "nov", "dec"];
  const time = `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  return `${day} ${months[d.getMonth()]} ${d.getFullYear()} ${time}`;
}

function formatAmount(amount: number | null): string {
  const num = Number(amount);
  if (isNaN(num)) return "—";
  return `€${num.toFixed(2)}`;
}

function isTableMissingError(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  return error.code === "42P01" || (error.message?.includes("does not exist") ?? false);
}

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
      <View style={styles.skeletonDivider} />
      <View style={styles.skeletonRow}>
        <View style={[styles.skeletonBlock, { width: 100, height: 13 }]} />
        <View style={[styles.skeletonBlock, { width: 80, height: 13 }]} />
      </View>
    </Animated.View>
  );
}

// ─── Homework card ────────────────────────────────────────────────────────────

function HomeworkCard({ item, index }: { item: HomeworkAssignment; index: number }) {
  const { colors } = useTheme();
  const translateY = useRef(new Animated.Value(24)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(translateY, { toValue: 0, duration: 320, delay: index * 80, useNativeDriver: true }),
      Animated.timing(opacity, { toValue: 1, duration: 320, delay: index * 80, useNativeDriver: true }),
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
  const { session } = useAuth();
  const [assignments, setAssignments] = useState<HomeworkAssignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Modal state
  const [modalVisible, setModalVisible] = useState(false);
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [deadline, setDeadline] = useState("");
  const [subjectError, setSubjectError] = useState("");
  const [messageError, setMessageError] = useState("");
  const [submitError, setSubmitError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState("");

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

  const openModal = useCallback(() => {
    console.log("[Huiswerk] Button pressed");
    console.log("[Huiswerk] Opening modal");
    setSubject("");
    setMessage("");
    setDeadline("");
    setSubjectError("");
    setMessageError("");
    setSubmitError("");
    setSuccessMsg("");
    setModalVisible(true);
    console.log("[Huiswerk] Modal opened successfully");
  }, []);

  const parseDeadlineNL = (value: string): string | null => {
    const trimmed = value.trim();
    if (!trimmed) return null;
    // Accept DD-MM-YYYY
    const parts = trimmed.split("-");
    if (parts.length === 3) {
      const [day, month, year] = parts.map(Number);
      if (!isNaN(day) && !isNaN(month) && !isNaN(year)) {
        return new Date(year, month - 1, day).toISOString().split("T")[0];
      }
    }
    return trimmed;
  };

  const handleSubmit = useCallback(async () => {
    let hasError = false;
    if (!subject.trim()) { setSubjectError("Onderwerp is verplicht"); hasError = true; }
    if (!message.trim()) { setMessageError("Beschrijving is verplicht"); hasError = true; }
    if (hasError) return;

    const token = session?.access_token;
    if (!token) {
      setSubmitError("Niet ingelogd");
      return;
    }

    const deadlineValue = parseDeadlineNL(deadline);
    const payload = { client_id: clientId, subject: subject.trim(), message: message.trim(), deadline: deadlineValue };
    console.log("[Huiswerk] Submit payload:", { subject: payload.subject, message: payload.message, deadline: payload.deadline, clientId });

    setSubmitting(true);
    setSubmitError("");

    try {
      await createAssignment(token, payload);
      console.log("[Huiswerk] Save success");
      setSuccessMsg("Huiswerk verstuurd ✓");
      setTimeout(() => {
        setModalVisible(false);
        loadAssignments();
      }, 900);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Er is een fout opgetreden";
      console.log("[Huiswerk] Save error:", msg);
      setSubmitError(msg);
    } finally {
      setSubmitting(false);
    }
  }, [subject, message, deadline, clientId, session, loadAssignments]);

  return (
    <View style={styles.tabContent}>
      <AnimatedPressable
        style={[styles.actionBtn, { backgroundColor: bcctColors.primaryOrange }]}
        onPress={openModal}
      >
        <Text style={styles.actionBtnText}>+ Huiswerk sturen</Text>
      </AnimatedPressable>

      {loading ? (
        <View style={styles.listContainer}>
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </View>
      ) : error ? (
        <View style={styles.emptyState}>
          <Text style={[styles.emptyTitle, { color: bcctColors.error }]}>{error}</Text>
        </View>
      ) : assignments.length === 0 ? (
        <View style={styles.emptyState}>
          <View style={[styles.emptyIconCircle, { backgroundColor: bcctColors.primaryOrange + "18" }]}>
            <Text style={styles.emptyIcon}>📖</Text>
          </View>
          <Text style={[styles.emptyTitle, { color: colors.text }]}>Nog geen huiswerk</Text>
          <Text style={[styles.emptySubtitle, { color: bcctColors.textSecondary }]}>
            Stuur huiswerk om je cliënt op weg te helpen
          </Text>
        </View>
      ) : (
        <ScrollView
          style={styles.listContainer}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 120 }}
        >
          {assignments.map((item, index) => (
            <HomeworkCard key={item.id} item={item} index={index} />
          ))}
        </ScrollView>
      )}

      {/* Homework compose modal */}
      <Modal
        isVisible={modalVisible}
        onBackdropPress={() => !submitting && setModalVisible(false)}
        onBackButtonPress={() => !submitting && setModalVisible(false)}
        animationIn="slideInUp"
        animationOut="slideOutDown"
        backdropOpacity={0.5}
        style={styles.bottomModal}
        avoidKeyboard
      >
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined}>
          <View style={[styles.formModalContent, { backgroundColor: colors.card }]}>
            <View style={styles.modalHandle} />
            <View style={styles.formModalHeader}>
              <Text style={[styles.formModalTitle, { color: colors.text }]}>Huiswerk sturen</Text>
              <TouchableOpacity
                onPress={() => !submitting && setModalVisible(false)}
                style={styles.modalCloseBtn}
                disabled={submitting}
              >
                <Text style={[styles.modalCloseBtnText, { color: bcctColors.textSecondary }]}>✕</Text>
              </TouchableOpacity>
            </View>

            {/* Client (read-only) */}
            <View style={styles.formNote}>
              <Text style={[styles.formNoteText, { color: bcctColors.textSecondary }]}>
                Aan: {clientName}
              </Text>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              {/* Onderwerp */}
              <Text style={[styles.fieldLabel, { color: bcctColors.textSecondary }]}>Onderwerp *</Text>
              <TextInput
                style={[styles.formInput, { color: colors.text, borderColor: subjectError ? bcctColors.error : colors.border, backgroundColor: colors.background }]}
                placeholder="bijv. Ademhalingsoefening"
                placeholderTextColor={bcctColors.textSecondary}
                value={subject}
                onChangeText={(t) => { setSubject(t); if (t.trim()) setSubjectError(""); }}
                editable={!submitting}
                returnKeyType="next"
              />
              {subjectError ? <Text style={styles.fieldError}>{subjectError}</Text> : null}

              {/* Beschrijving */}
              <Text style={[styles.fieldLabel, { color: bcctColors.textSecondary }]}>Beschrijving *</Text>
              <TextInput
                style={[styles.formInput, styles.hwTextArea, { color: colors.text, borderColor: messageError ? bcctColors.error : colors.border, backgroundColor: colors.background }]}
                placeholder="Beschrijf het huiswerk..."
                placeholderTextColor={bcctColors.textSecondary}
                value={message}
                onChangeText={(t) => { setMessage(t); if (t.trim()) setMessageError(""); }}
                multiline
                numberOfLines={5}
                textAlignVertical="top"
                editable={!submitting}
              />
              {messageError ? <Text style={styles.fieldError}>{messageError}</Text> : null}

              {/* Deadline */}
              <Text style={[styles.fieldLabel, { color: bcctColors.textSecondary }]}>Deadline (optioneel, DD-MM-YYYY)</Text>
              <TextInput
                style={[styles.formInput, { color: colors.text, borderColor: colors.border, backgroundColor: colors.background }]}
                placeholder="bijv. 25-12-2025"
                placeholderTextColor={bcctColors.textSecondary}
                value={deadline}
                onChangeText={setDeadline}
                keyboardType="numbers-and-punctuation"
                editable={!submitting}
                returnKeyType="done"
              />

              {submitError ? (
                <View style={styles.submitErrorBox}>
                  <Text style={styles.submitErrorText}>{submitError}</Text>
                </View>
              ) : null}

              {successMsg ? (
                <View style={styles.successBox}>
                  <Text style={styles.successText}>{successMsg}</Text>
                </View>
              ) : null}

              <TouchableOpacity
                style={[styles.submitBtn, { backgroundColor: submitting ? bcctColors.primaryOrangeDisabled : bcctColors.primaryOrange }]}
                onPress={handleSubmit}
                disabled={submitting}
              >
                {submitting ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={styles.submitBtnText}>Opslaan</Text>
                )}
              </TouchableOpacity>

              <View style={{ height: 24 }} />
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

// ─── Betalingen tab ───────────────────────────────────────────────────────────

const BILLING_API = "https://qcirmbquzdbprjvqhqlj.supabase.co/functions/v1/billing-invoices";

const PAYMENT_TYPES: { key: PaymentType; label: string; subtitle: string; icon: string }[] = [
  { key: "one_time", label: "Eenmalig", subtitle: "Eenmalige betaling", icon: "💳" },
  { key: "package", label: "Pakket", subtitle: "Pakketprijs", icon: "📦" },
  { key: "recurring_monthly", label: "Maandelijks", subtitle: "Maandelijkse betaling", icon: "🔄" },
];

function invoiceStatusColor(status: string | null): string {
  if (status === "paid") return bcctColors.success;
  if (status === "draft") return bcctColors.textSecondary;
  if (status === "cancelled") return bcctColors.error;
  if (status === "open") return "#3B82F6";
  return bcctColors.primaryOrange;
}

function invoiceStatusLabel(status: string | null): string {
  if (status === "paid") return "Betaald";
  if (status === "draft") return "Concept";
  if (status === "cancelled") return "Geannuleerd";
  if (status === "open") return "Open";
  return status ?? "—";
}

function invoiceTypeLabel(type: string | null): string {
  if (type === "one_time") return "Eenmalig";
  if (type === "package") return "Pakket";
  if (type === "recurring_monthly") return "Maandelijks";
  return "";
}

function invoiceTypeColor(type: string | null): string {
  if (type === "one_time") return "#8B5CF6";
  if (type === "package") return "#F59E0B";
  if (type === "recurring_monthly") return "#3B82F6";
  return bcctColors.textSecondary;
}

function parseDateNL(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parts = trimmed.split("-");
  if (parts.length === 3) {
    const [day, month, year] = parts.map(Number);
    if (!isNaN(day) && !isNaN(month) && !isNaN(year) && year > 1000) {
      const mm = String(month).padStart(2, "0");
      const dd = String(day).padStart(2, "0");
      return `${year}-${mm}-${dd}`;
    }
  }
  return null;
}

function formatAmountEuro(amount: number | null): string {
  const num = Number(amount);
  if (isNaN(num)) return "—";
  return `€ ${num.toFixed(2).replace(".", ",")}`;
}

interface BetalingenTabProps {
  clientId: string;
  coachId: string;
  onOpenModal: () => void;
  invoices: Invoice[];
  loading: boolean;
}

function BetalingenTab({ clientId, coachId, onOpenModal, invoices, loading }: BetalingenTabProps) {
  const { colors } = useTheme();

  console.log("[BillingTab] Button rendered");

  return (
    <View style={styles.tabContent}>
      <AnimatedPressable
        style={[styles.actionBtn, { backgroundColor: bcctColors.primaryOrange }]}
        onPress={() => {
          console.log("[BillingTab] Button pressed, opening modal");
          onOpenModal();
        }}
      >
        <Text style={styles.actionBtnText}>+ Betaling aanmaken</Text>
      </AnimatedPressable>

      {loading ? (
        <View style={styles.listContainer}>
          <SkeletonCard />
          <SkeletonCard />
        </View>
      ) : invoices.length === 0 ? (
        <View style={styles.emptyState}>
          <View style={[styles.emptyIconCircle, { backgroundColor: bcctColors.primaryOrange + "18" }]}>
            <Text style={styles.emptyIcon}>💳</Text>
          </View>
          <Text style={[styles.emptyTitle, { color: colors.text }]}>Nog geen betalingen</Text>
          <Text style={[styles.emptySubtitle, { color: bcctColors.textSecondary }]}>
            Maak een betaling aan voor deze cliënt
          </Text>
        </View>
      ) : (
        <ScrollView
          style={styles.listContainer}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 120 }}
        >
          {invoices.map((inv) => {
            const amountText = formatAmountEuro(inv.amount);
            const dateText = relativeDate(inv.created_at);
            const sLabel = invoiceStatusLabel(inv.status);
            const sColor = invoiceStatusColor(inv.status);
            const tLabel = invoiceTypeLabel(inv.type);
            const tColor = invoiceTypeColor(inv.type);
            const invTitle = inv.title ?? inv.description ?? "Betaling";
            const hasPayLink = !!inv.stripe_payment_link;
            return (
              <View
                key={inv.id}
                style={[styles.listCard, { backgroundColor: colors.card, borderColor: colors.border }]}
              >
                <View style={styles.listCardRow}>
                  <Text style={[styles.listCardTitle, { color: colors.text }]} numberOfLines={1}>
                    {invTitle}
                  </Text>
                  <View style={[styles.statusBadge, { backgroundColor: sColor + "22" }]}>
                    <Text style={[styles.statusBadgeText, { color: sColor }]}>{sLabel}</Text>
                  </View>
                </View>
                <View style={styles.invCardMeta}>
                  <Text style={[styles.listCardAmount, { color: bcctColors.primaryOrange }]}>
                    {amountText}
                  </Text>
                  {tLabel ? (
                    <View style={[styles.typeBadge, { backgroundColor: tColor + "18" }]}>
                      <Text style={[styles.typeBadgeText, { color: tColor }]}>{tLabel}</Text>
                    </View>
                  ) : null}
                </View>
                <View style={styles.invCardFooter}>
                  <Text style={[styles.listCardDate, { color: bcctColors.textSecondary }]}>
                    {dateText}
                  </Text>
                  {hasPayLink ? (
                    <TouchableOpacity
                      style={styles.payLinkBtn}
                      onPress={() => {
                        console.log("[Betaling] Opening payment link:", inv.stripe_payment_link);
                        Linking.openURL(inv.stripe_payment_link!);
                      }}
                    >
                      <Text style={styles.payLinkBtnText}>Betaallink</Text>
                    </TouchableOpacity>
                  ) : null}
                </View>
              </View>
            );
          })}
        </ScrollView>
      )}
    </View>
  );
}

// ─── Billing modal (root-level to avoid iOS clipping) ─────────────────────────

interface BillingModalProps {
  visible: boolean;
  clientId: string;
  coachId: string;
  onClose: () => void;
  onCreated: () => void;
}

function BillingModal({ visible, clientId, coachId, onClose, onCreated }: BillingModalProps) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [stripeEnabled, setStripeEnabled] = useState(false);
  const [step, setStep] = useState<1 | 2>(1);
  const [selectedType, setSelectedType] = useState<PaymentType>("one_time");

  // Form fields
  const [title, setTitle] = useState("");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [notes, setNotes] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  // Validation
  const [titleError, setTitleError] = useState("");
  const [amountError, setAmountError] = useState("");
  const [submitError, setSubmitError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState("");

  // Check Stripe status when modal opens
  useEffect(() => {
    if (!visible) return;
    supabase
      .from("profiles")
      .select("stripe_charges_enabled")
      .eq("id", coachId)
      .single()
      .then(({ data }) => setStripeEnabled(data?.stripe_charges_enabled === true))
      .catch(() => setStripeEnabled(false));
  }, [visible, coachId]);

  const resetForm = useCallback(() => {
    setStep(1);
    setSelectedType("one_time");
    setTitle("");
    setAmount("");
    setDescription("");
    setNotes("");
    setDueDate("");
    setStartDate("");
    setEndDate("");
    setTitleError("");
    setAmountError("");
    setSubmitError("");
    setSuccessMsg("");
  }, []);

  const handleClose = useCallback(() => {
    if (submitting) return;
    console.log("[BillingTab] Modal state changed:", false);
    resetForm();
    onClose();
  }, [submitting, resetForm, onClose]);

  const handleTypeSelect = useCallback((type: PaymentType) => {
    console.log("[Betaling] Type selected:", type);
    setSelectedType(type);
    setStep(2);
  }, []);

  const handleBack = useCallback(() => {
    setStep(1);
    setTitleError("");
    setAmountError("");
    setSubmitError("");
  }, []);

  const handleSubmit = useCallback(async () => {
    let hasError = false;
    if (!title.trim()) { setTitleError("Titel is verplicht"); hasError = true; }
    const parsedAmount = parseFloat(amount.replace(",", "."));
    if (!amount.trim() || isNaN(parsedAmount) || parsedAmount <= 0) {
      setAmountError("Voer een geldig bedrag in (groter dan 0)");
      hasError = true;
    }
    if (hasError) return;

    const payload: Record<string, unknown> = {
      client_id: clientId,
      title: title.trim(),
      description: description.trim() || undefined,
      notes: notes.trim() || undefined,
      amount: parsedAmount,
      currency: "eur",
      type: selectedType,
    };

    if (selectedType === "one_time" || selectedType === "package") {
      const due = parseDateNL(dueDate);
      if (due) payload.due_date = due;
    } else if (selectedType === "recurring_monthly") {
      const start = parseDateNL(startDate);
      const end = parseDateNL(endDate);
      if (start) payload.start_date = start;
      if (end) payload.end_date = end;
    }

    console.log("[Betaling] Submit pressed, payload:", payload);
    setSubmitting(true);
    setSubmitError("");

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) {
        setSubmitError("Niet ingelogd");
        return;
      }

      const res = await fetch(BILLING_API, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      const responseText = await res.text();
      console.log("[Betaling] API response:", res.status, responseText);

      if (!res.ok) {
        let errMsg = `Fout ${res.status}`;
        try {
          const errJson = JSON.parse(responseText);
          errMsg = errJson.error ?? errJson.message ?? errMsg;
        } catch {
          errMsg = responseText || errMsg;
        }
        console.error("[Betaling] Error creating invoice:", errMsg);
        setSubmitError(errMsg);
        return;
      }

      console.log("[Betaling] Invoice created successfully");
      setSuccessMsg("Betaling aangemaakt ✓");
      setTimeout(() => {
        resetForm();
        onClose();
        onCreated();
      }, 900);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Er is een fout opgetreden";
      console.error("[Betaling] Error creating invoice:", msg);
      setSubmitError(msg);
    } finally {
      setSubmitting(false);
    }
  }, [title, amount, description, notes, dueDate, startDate, endDate, selectedType, clientId, resetForm, onClose, onCreated]);

  const stripeNoteText = stripeEnabled
    ? "Betaling wordt aangemaakt met Stripe betaallink"
    : "Betaling wordt opgeslagen als concept (Stripe nog niet gekoppeld)";

  const footerPadding = Math.max(insets.bottom, 16);
  const selectedTypeLabel = PAYMENT_TYPES.find(p => p.key === selectedType)?.label ?? "Betaling";

  return (
    <Modal
      isVisible={visible}
      onBackdropPress={handleClose}
      onBackButtonPress={handleClose}
      animationIn="slideInUp"
      animationOut="slideOutDown"
      backdropOpacity={0.5}
      style={styles.bottomModal}
      avoidKeyboard
      useNativeDriver
      hideModalContentWhileAnimating
    >
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <View style={[styles.formModalContent, { backgroundColor: colors.card, paddingBottom: footerPadding }]}>
          <View style={styles.modalHandle} />

          {/* ── Step 1: Type selector ── */}
          {step === 1 ? (
            <>
              <View style={styles.formModalHeader}>
                <Text style={[styles.formModalTitle, { color: colors.text }]}>Betaling aanmaken</Text>
                <TouchableOpacity onPress={handleClose} style={styles.modalCloseBtn}>
                  <Text style={[styles.modalCloseBtnText, { color: bcctColors.textSecondary }]}>✕</Text>
                </TouchableOpacity>
              </View>
              <Text style={[styles.stepSubtitle, { color: bcctColors.textSecondary }]}>
                Kies het type betaling
              </Text>
              <View style={styles.typeCardsContainer}>
                {PAYMENT_TYPES.map((pt) => {
                  const isSelected = selectedType === pt.key;
                  return (
                    <TouchableOpacity
                      key={pt.key}
                      style={[
                        styles.typeCard,
                        {
                          borderColor: isSelected ? bcctColors.primaryOrange : colors.border,
                          backgroundColor: isSelected ? bcctColors.primaryOrange + "10" : colors.background,
                        },
                      ]}
                      onPress={() => handleTypeSelect(pt.key)}
                      activeOpacity={0.75}
                    >
                      <Text style={styles.typeCardIcon}>{pt.icon}</Text>
                      <View style={styles.typeCardText}>
                        <Text style={[styles.typeCardLabel, { color: colors.text }]}>{pt.label}</Text>
                        <Text style={[styles.typeCardSubtitle, { color: bcctColors.textSecondary }]}>{pt.subtitle}</Text>
                      </View>
                      {isSelected ? (
                        <View style={[styles.typeCardCheck, { backgroundColor: bcctColors.primaryOrange }]}>
                          <Text style={styles.typeCardCheckMark}>✓</Text>
                        </View>
                      ) : null}
                    </TouchableOpacity>
                  );
                })}
              </View>
            </>
          ) : (
            /* ── Step 2: Form ── */
            <>
              <View style={styles.formModalHeader}>
                <TouchableOpacity onPress={handleBack} style={styles.backLink} disabled={submitting}>
                  <Text style={[styles.backLinkText, { color: bcctColors.primaryOrange }]}>← Terug</Text>
                </TouchableOpacity>
                <Text style={[styles.formModalTitle, { color: colors.text }]}>
                  {selectedTypeLabel}
                </Text>
                <TouchableOpacity
                  onPress={handleClose}
                  style={styles.modalCloseBtn}
                  disabled={submitting}
                >
                  <Text style={[styles.modalCloseBtnText, { color: bcctColors.textSecondary }]}>✕</Text>
                </TouchableOpacity>
              </View>

              <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
                {/* Titel */}
                <Text style={[styles.fieldLabel, { color: bcctColors.textSecondary }]}>Titel *</Text>
                <TextInput
                  style={[styles.formInput, { color: colors.text, borderColor: titleError ? bcctColors.error : colors.border, backgroundColor: colors.background }]}
                  placeholder="bijv. Sessie november"
                  placeholderTextColor={bcctColors.textSecondary}
                  value={title}
                  onChangeText={(t) => { setTitle(t); if (t.trim()) setTitleError(""); }}
                  editable={!submitting}
                  returnKeyType="next"
                />
                {titleError ? <Text style={styles.fieldError}>{titleError}</Text> : null}

                {/* Bedrag */}
                <Text style={[styles.fieldLabel, { color: bcctColors.textSecondary }]}>Bedrag (€) *</Text>
                <TextInput
                  style={[styles.formInput, { color: colors.text, borderColor: amountError ? bcctColors.error : colors.border, backgroundColor: colors.background }]}
                  placeholder="bijv. 75,00"
                  placeholderTextColor={bcctColors.textSecondary}
                  value={amount}
                  onChangeText={(t) => { setAmount(t); if (t.trim()) setAmountError(""); }}
                  keyboardType="decimal-pad"
                  editable={!submitting}
                  returnKeyType="next"
                />
                {amountError ? <Text style={styles.fieldError}>{amountError}</Text> : null}

                {/* Omschrijving */}
                <Text style={[styles.fieldLabel, { color: bcctColors.textSecondary }]}>Omschrijving (optioneel)</Text>
                <TextInput
                  style={[styles.formInput, styles.formTextArea, { color: colors.text, borderColor: colors.border, backgroundColor: colors.background }]}
                  placeholder="Beschrijving van de betaling..."
                  placeholderTextColor={bcctColors.textSecondary}
                  value={description}
                  onChangeText={setDescription}
                  multiline
                  numberOfLines={3}
                  textAlignVertical="top"
                  editable={!submitting}
                />

                {/* Interne notitie */}
                <Text style={[styles.fieldLabel, { color: bcctColors.textSecondary }]}>Interne notitie (optioneel)</Text>
                <TextInput
                  style={[styles.formInput, { color: colors.text, borderColor: colors.border, backgroundColor: colors.background }]}
                  placeholder="Alleen zichtbaar voor jou..."
                  placeholderTextColor={bcctColors.textSecondary}
                  value={notes}
                  onChangeText={setNotes}
                  editable={!submitting}
                  returnKeyType="next"
                />

                {/* Type-specific date fields */}
                {(selectedType === "one_time" || selectedType === "package") ? (
                  <>
                    <Text style={[styles.fieldLabel, { color: bcctColors.textSecondary }]}>Vervaldatum (optioneel, DD-MM-YYYY)</Text>
                    <TextInput
                      style={[styles.formInput, { color: colors.text, borderColor: colors.border, backgroundColor: colors.background }]}
                      placeholder="bijv. 31-12-2025"
                      placeholderTextColor={bcctColors.textSecondary}
                      value={dueDate}
                      onChangeText={setDueDate}
                      keyboardType="numbers-and-punctuation"
                      editable={!submitting}
                      returnKeyType="done"
                    />
                  </>
                ) : null}

                {selectedType === "recurring_monthly" ? (
                  <>
                    <Text style={[styles.fieldLabel, { color: bcctColors.textSecondary }]}>Startdatum (optioneel, DD-MM-YYYY)</Text>
                    <TextInput
                      style={[styles.formInput, { color: colors.text, borderColor: colors.border, backgroundColor: colors.background }]}
                      placeholder="bijv. 01-01-2025"
                      placeholderTextColor={bcctColors.textSecondary}
                      value={startDate}
                      onChangeText={setStartDate}
                      keyboardType="numbers-and-punctuation"
                      editable={!submitting}
                      returnKeyType="next"
                    />
                    <Text style={[styles.fieldLabel, { color: bcctColors.textSecondary }]}>Einddatum (optioneel, DD-MM-YYYY)</Text>
                    <TextInput
                      style={[styles.formInput, { color: colors.text, borderColor: colors.border, backgroundColor: colors.background }]}
                      placeholder="bijv. 31-12-2025"
                      placeholderTextColor={bcctColors.textSecondary}
                      value={endDate}
                      onChangeText={setEndDate}
                      keyboardType="numbers-and-punctuation"
                      editable={!submitting}
                      returnKeyType="done"
                    />
                  </>
                ) : null}

                {/* Stripe note */}
                <View style={[styles.formNote, { marginTop: 16 }]}>
                  <Text style={[styles.formNoteText, { color: bcctColors.textSecondary }]}>
                    {stripeNoteText}
                  </Text>
                </View>

                {submitError ? (
                  <View style={styles.submitErrorBox}>
                    <Text style={styles.submitErrorText}>{submitError}</Text>
                  </View>
                ) : null}

                {successMsg ? (
                  <View style={styles.successBox}>
                    <Text style={styles.successText}>{successMsg}</Text>
                  </View>
                ) : null}

                <TouchableOpacity
                  style={[styles.submitBtn, { backgroundColor: submitting ? bcctColors.primaryOrangeDisabled : bcctColors.primaryOrange }]}
                  onPress={handleSubmit}
                  disabled={submitting}
                >
                  {submitting ? (
                    <ActivityIndicator color="#fff" size="small" />
                  ) : (
                    <Text style={styles.submitBtnText}>Aanmaken</Text>
                  )}
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.cancelBtn, { borderColor: colors.border }]}
                  onPress={handleClose}
                  disabled={submitting}
                >
                  <Text style={[styles.cancelBtnText, { color: colors.text }]}>Annuleren</Text>
                </TouchableOpacity>

                <View style={{ height: 24 }} />
              </ScrollView>
            </>
          )}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ─── Afspraken tab ────────────────────────────────────────────────────────────

function AfsprakenTab({ clientId, clientName, coachId }: { clientId: string; clientName: string; coachId: string }) {
  const { colors } = useTheme();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal state
  const [modalVisible, setModalVisible] = useState(false);
  const [apptTitle, setApptTitle] = useState("");
  const [apptDate, setApptDate] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [apptNotes, setApptNotes] = useState("");
  const [titleError, setTitleError] = useState("");
  const [dateError, setDateError] = useState("");
  const [startError, setStartError] = useState("");
  const [endError, setEndError] = useState("");
  const [submitError, setSubmitError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState("");

  const loadAppointments = useCallback(async () => {
    console.log("[AfsprakenTab] Loading appointments for client:", clientId);
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("appointments")
        .select("id, title, start_time, end_time, status, notes")
        .eq("client_id", clientId)
        .eq("coach_id", coachId)
        .order("start_time", { ascending: false })
        .limit(20);

      if (error) {
        if (isTableMissingError(error)) {
          console.warn("[AfsprakenTab] appointments table missing");
          setAppointments([]);
          return;
        }
        console.error("[AfsprakenTab] Error loading appointments:", error.message);
        return;
      }
      console.log("[AfsprakenTab] Loaded", data?.length ?? 0, "appointments");
      setAppointments((data as Appointment[]) ?? []);
    } finally {
      setLoading(false);
    }
  }, [clientId, coachId]);

  useFocusEffect(
    useCallback(() => {
      loadAppointments();
    }, [loadAppointments])
  );

  const openModal = useCallback(() => {
    console.log("[ClientDetail] Nieuwe afspraak pressed, clientId:", clientId);
    setApptTitle("");
    setApptDate("");
    setStartTime("");
    setEndTime("");
    setApptNotes("");
    setTitleError("");
    setDateError("");
    setStartError("");
    setEndError("");
    setSubmitError("");
    setSuccessMsg("");
    setModalVisible(true);
    console.log("[ClientDetail] Afspraak modal opened");
  }, [clientId]);

  const parseDateTimeNL = (date: string, time: string): Date | null => {
    // date: DD-MM-YYYY, time: HH:MM
    const dateParts = date.trim().split("-");
    const timeParts = time.trim().split(":");
    if (dateParts.length !== 3 || timeParts.length !== 2) return null;
    const [day, month, year] = dateParts.map(Number);
    const [hours, minutes] = timeParts.map(Number);
    if ([day, month, year, hours, minutes].some(isNaN)) return null;
    return new Date(year, month - 1, day, hours, minutes, 0);
  };

  const handleSubmit = useCallback(async () => {
    let hasError = false;
    if (!apptTitle.trim()) { setTitleError("Titel is verplicht"); hasError = true; }
    if (!apptDate.trim()) { setDateError("Datum is verplicht (DD-MM-YYYY)"); hasError = true; }
    if (!startTime.trim()) { setStartError("Starttijd is verplicht (HH:MM)"); hasError = true; }
    if (!endTime.trim()) { setEndError("Eindtijd is verplicht (HH:MM)"); hasError = true; }
    if (hasError) return;

    const startDt = parseDateTimeNL(apptDate, startTime);
    const endDt = parseDateTimeNL(apptDate, endTime);

    if (!startDt) { setDateError("Ongeldige datum of starttijd"); return; }
    if (!endDt) { setEndError("Ongeldige eindtijd"); return; }
    if (endDt <= startDt) { setEndError("Eindtijd moet na starttijd zijn"); return; }

    const payload = {
      coach_id: coachId,
      client_id: clientId,
      title: apptTitle.trim(),
      start_time: startDt.toISOString(),
      end_time: endDt.toISOString(),
      notes: apptNotes.trim() || null,
      status: "scheduled",
    };
    console.log("[ClientDetail] Afspraak submit payload:", payload);
    setSubmitting(true);
    setSubmitError("");

    try {
      const { data, error } = await supabase.from("appointments").insert(payload).select().single();
      if (error) {
        console.error("[ClientDetail] Afspraak insert error:", error.message);
        setSubmitError(error.message);
        return;
      }
      console.log("[ClientDetail] Afspraak insert result:", data);
      setSuccessMsg("Afspraak aangemaakt ✓");
      setTimeout(() => {
        setModalVisible(false);
        loadAppointments();
      }, 900);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Er is een fout opgetreden";
      console.error("[ClientDetail] Afspraak unexpected error:", msg);
      setSubmitError(msg);
    } finally {
      setSubmitting(false);
    }
  }, [apptTitle, apptDate, startTime, endTime, apptNotes, coachId, clientId, loadAppointments]);

  const apptStatusLabel = (status: string | null) => {
    if (status === "scheduled") return "Gepland";
    if (status === "completed") return "Afgerond";
    if (status === "cancelled") return "Geannuleerd";
    return status ?? "—";
  };

  const apptStatusColor = (status: string | null) => {
    if (status === "completed") return bcctColors.success;
    if (status === "cancelled") return bcctColors.error;
    return bcctColors.primaryOrange;
  };

  return (
    <View style={styles.tabContent}>
      <AnimatedPressable
        style={[styles.actionBtn, { backgroundColor: bcctColors.primaryOrange }]}
        onPress={openModal}
      >
        <Text style={styles.actionBtnText}>+ Nieuwe afspraak</Text>
      </AnimatedPressable>

      {loading ? (
        <View style={styles.listContainer}>
          <SkeletonCard />
          <SkeletonCard />
        </View>
      ) : appointments.length === 0 ? (
        <View style={styles.emptyState}>
          <View style={[styles.emptyIconCircle, { backgroundColor: bcctColors.primaryOrange + "18" }]}>
            <Text style={styles.emptyIcon}>📅</Text>
          </View>
          <Text style={[styles.emptyTitle, { color: colors.text }]}>Nog geen afspraken</Text>
          <Text style={[styles.emptySubtitle, { color: bcctColors.textSecondary }]}>
            Plan een afspraak met deze cliënt
          </Text>
        </View>
      ) : (
        <ScrollView
          style={styles.listContainer}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 120 }}
        >
          {appointments.map((appt) => {
            const startText = formatDateTime(appt.start_time);
            const endText = appt.end_time
              ? `${String(new Date(appt.end_time).getHours()).padStart(2, "0")}:${String(new Date(appt.end_time).getMinutes()).padStart(2, "0")}`
              : null;
            const sLabel = apptStatusLabel(appt.status);
            const sColor = apptStatusColor(appt.status);
            const apptTitleText = appt.title ?? "Afspraak";
            return (
              <View
                key={appt.id}
                style={[styles.listCard, { backgroundColor: colors.card, borderColor: colors.border }]}
              >
                <View style={styles.listCardRow}>
                  <Text style={[styles.listCardTitle, { color: colors.text }]} numberOfLines={1}>
                    {apptTitleText}
                  </Text>
                  <View style={[styles.statusBadge, { backgroundColor: sColor + "22" }]}>
                    <Text style={[styles.statusBadgeText, { color: sColor }]}>{sLabel}</Text>
                  </View>
                </View>
                <View style={styles.listCardMeta}>
                  <Text style={[styles.listCardDate, { color: bcctColors.textSecondary }]}>
                    {startText}
                  </Text>
                  {endText ? (
                    <Text style={[styles.listCardDate, { color: bcctColors.textSecondary }]}>
                      {endText}
                    </Text>
                  ) : null}
                </View>
              </View>
            );
          })}
        </ScrollView>
      )}

      {/* Appointment creation modal */}
      <Modal
        isVisible={modalVisible}
        onBackdropPress={() => !submitting && setModalVisible(false)}
        onBackButtonPress={() => !submitting && setModalVisible(false)}
        animationIn="slideInUp"
        animationOut="slideOutDown"
        backdropOpacity={0.5}
        style={styles.bottomModal}
        avoidKeyboard
      >
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined}>
          <View style={[styles.formModalContent, { backgroundColor: colors.card }]}>
            <View style={styles.modalHandle} />
            <View style={styles.formModalHeader}>
              <Text style={[styles.formModalTitle, { color: colors.text }]}>Nieuwe afspraak</Text>
              <TouchableOpacity
                onPress={() => !submitting && setModalVisible(false)}
                style={styles.modalCloseBtn}
                disabled={submitting}
              >
                <Text style={[styles.modalCloseBtnText, { color: bcctColors.textSecondary }]}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              {/* Cliënt (read-only) */}
              <Text style={[styles.fieldLabel, { color: bcctColors.textSecondary }]}>Cliënt</Text>
              <View style={[styles.formInputReadOnly, { borderColor: colors.border, backgroundColor: colors.background }]}>
                <Text style={[styles.formInputReadOnlyText, { color: bcctColors.textSecondary }]}>
                  {clientName}
                </Text>
              </View>

              {/* Titel */}
              <Text style={[styles.fieldLabel, { color: bcctColors.textSecondary }]}>Titel *</Text>
              <TextInput
                style={[styles.formInput, { color: colors.text, borderColor: titleError ? bcctColors.error : colors.border, backgroundColor: colors.background }]}
                placeholder="bijv. Intake gesprek"
                placeholderTextColor={bcctColors.textSecondary}
                value={apptTitle}
                onChangeText={(t) => { setApptTitle(t); if (t.trim()) setTitleError(""); }}
                editable={!submitting}
                returnKeyType="next"
              />
              {titleError ? <Text style={styles.fieldError}>{titleError}</Text> : null}

              {/* Datum */}
              <Text style={[styles.fieldLabel, { color: bcctColors.textSecondary }]}>Datum * (DD-MM-YYYY)</Text>
              <TextInput
                style={[styles.formInput, { color: colors.text, borderColor: dateError ? bcctColors.error : colors.border, backgroundColor: colors.background }]}
                placeholder="bijv. 25-12-2025"
                placeholderTextColor={bcctColors.textSecondary}
                value={apptDate}
                onChangeText={(t) => { setApptDate(t); if (t.trim()) setDateError(""); }}
                keyboardType="numbers-and-punctuation"
                editable={!submitting}
                returnKeyType="next"
              />
              {dateError ? <Text style={styles.fieldError}>{dateError}</Text> : null}

              {/* Tijden */}
              <View style={styles.timeRow}>
                <View style={styles.timeField}>
                  <Text style={[styles.fieldLabel, { color: bcctColors.textSecondary }]}>Starttijd * (HH:MM)</Text>
                  <TextInput
                    style={[styles.formInput, { color: colors.text, borderColor: startError ? bcctColors.error : colors.border, backgroundColor: colors.background }]}
                    placeholder="09:00"
                    placeholderTextColor={bcctColors.textSecondary}
                    value={startTime}
                    onChangeText={(t) => { setStartTime(t); if (t.trim()) setStartError(""); }}
                    keyboardType="numbers-and-punctuation"
                    editable={!submitting}
                    returnKeyType="next"
                  />
                  {startError ? <Text style={styles.fieldError}>{startError}</Text> : null}
                </View>
                <View style={styles.timeField}>
                  <Text style={[styles.fieldLabel, { color: bcctColors.textSecondary }]}>Eindtijd * (HH:MM)</Text>
                  <TextInput
                    style={[styles.formInput, { color: colors.text, borderColor: endError ? bcctColors.error : colors.border, backgroundColor: colors.background }]}
                    placeholder="10:00"
                    placeholderTextColor={bcctColors.textSecondary}
                    value={endTime}
                    onChangeText={(t) => { setEndTime(t); if (t.trim()) setEndError(""); }}
                    keyboardType="numbers-and-punctuation"
                    editable={!submitting}
                    returnKeyType="next"
                  />
                  {endError ? <Text style={styles.fieldError}>{endError}</Text> : null}
                </View>
              </View>

              {/* Notities */}
              <Text style={[styles.fieldLabel, { color: bcctColors.textSecondary }]}>Notities (optioneel)</Text>
              <TextInput
                style={[styles.formInput, styles.formTextArea, { color: colors.text, borderColor: colors.border, backgroundColor: colors.background }]}
                placeholder="Eventuele opmerkingen..."
                placeholderTextColor={bcctColors.textSecondary}
                value={apptNotes}
                onChangeText={setApptNotes}
                multiline
                numberOfLines={3}
                textAlignVertical="top"
                editable={!submitting}
              />

              {submitError ? (
                <View style={styles.submitErrorBox}>
                  <Text style={styles.submitErrorText}>{submitError}</Text>
                </View>
              ) : null}

              {successMsg ? (
                <View style={styles.successBox}>
                  <Text style={styles.successText}>{successMsg}</Text>
                </View>
              ) : null}

              <TouchableOpacity
                style={[styles.submitBtn, { backgroundColor: submitting ? bcctColors.primaryOrangeDisabled : bcctColors.primaryOrange }]}
                onPress={handleSubmit}
                disabled={submitting}
              >
                {submitting ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={styles.submitBtnText}>Afspraak aanmaken</Text>
                )}
              </TouchableOpacity>

              <View style={{ height: 24 }} />
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

// ─── Main screen ──────────────────────────────────────────────────────────────

export default function ClientDetailScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const { id } = useLocalSearchParams();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [client, setClient] = useState<Client | null>(null);
  const [themes, setThemes] = useState<Theme[]>([]);
  const [activeThemeId, setActiveThemeId] = useState<string | null>(null);
  const [infoModalVisible, setInfoModalVisible] = useState(false);
  const [infoModalTitle, setInfoModalTitle] = useState("");
  const [infoModalMessage, setInfoModalMessage] = useState("");
  const [themeModalVisible, setThemeModalVisible] = useState(false);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<TabKey>("overzicht");

  const coachId = user?.id ?? "";
  const clientId = String(id ?? "");

  // Billing state (lifted to root to avoid iOS modal clipping)
  const [billingModalVisible, setBillingModalVisible] = useState(false);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [invoicesLoading, setInvoicesLoading] = useState(true);

  const loadInvoices = useCallback(async () => {
    console.log("[Betaling] Refreshing payment list");
    setInvoicesLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) {
        console.warn("[Betaling] No session token, skipping invoice load");
        setInvoices([]);
        return;
      }
      const url = `${BILLING_API}?client_id=${clientId}`;
      const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) {
        const errText = await res.text();
        console.error("[Betaling] GET invoices error:", res.status, errText);
        setInvoices([]);
        return;
      }
      const json = await res.json();
      const list: Invoice[] = json.invoices ?? [];
      console.log("[Betaling] Payment list refreshed, count:", list.length);
      setInvoices(list);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Onbekende fout";
      console.error("[Betaling] Error loading invoices:", msg);
      setInvoices([]);
    } finally {
      setInvoicesLoading(false);
    }
  }, [clientId]);

  const openBillingModal = useCallback(() => {
    console.log("[BillingTab] Button pressed, opening modal");
    console.log("[BillingTab] Modal state changed:", true);
    setBillingModalVisible(true);
  }, []);

  const closeBillingModal = useCallback(() => {
    console.log("[BillingTab] Modal state changed:", false);
    setBillingModalVisible(false);
  }, []);

  const showInfoModal = (title: string, message: string) => {
    setInfoModalTitle(title);
    setInfoModalMessage(message);
    setInfoModalVisible(true);
  };

  useEffect(() => {
    if (id) {
      fetchClientDetails();
      fetchThemes();
      loadInvoices();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const fetchClientDetails = async () => {
    console.log("[ClientDetail] Fetching client details for", id);
    try {
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("id, full_name, email")
        .eq("id", id)
        .single();

      if (profileError) {
        console.error("[ClientDetail] Error fetching profile", profileError);
        showInfoModal("Fout", "Kon cliënt niet laden");
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
        console.error("[ClientDetail] Error fetching assignment", assignmentError);
      }

      if (assignment) {
        console.log("[ClientDetail] Active theme found", assignment.theme_id);
        setActiveThemeId(assignment.theme_id);
      }
    } catch (error: unknown) {
      console.error("[ClientDetail] Error fetching client details", error);
      showInfoModal("Fout", "Kon cliënt niet laden");
    } finally {
      setLoading(false);
    }
  };

  const fetchThemes = async () => {
    console.log("[ClientDetail] Fetching themes");
    try {
      const { data: session } = await supabase.auth.getSession();
      if (!session?.session?.user) {
        console.error("[ClientDetail] No user session");
        return;
      }

      const { data, error } = await supabase
        .from("themes")
        .select("id, name, description")
        .eq("created_by", session.session.user.id)
        .order("name", { ascending: true });

      if (error) {
        console.error("[ClientDetail] Error fetching themes", error);
        showInfoModal("Fout", "Kon thema's niet laden");
        return;
      }

      console.log("[ClientDetail] Themes loaded", data);
      setThemes(data || []);
    } catch (error: unknown) {
      console.error("[ClientDetail] Error fetching themes", error);
      showInfoModal("Fout", "Kon thema's niet laden");
    }
  };

  const assignTheme = async (themeId: string) => {
    console.log("[ClientDetail] Assigning theme", themeId, "to client", id);
    setSaving(true);
    try {
      const { error: deactivateError } = await supabase
        .from("client_theme_assignments")
        .update({ active: false })
        .eq("client_id", id)
        .eq("active", true);

      if (deactivateError) {
        console.error("[ClientDetail] Error deactivating old assignments", deactivateError);
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
        console.error("[ClientDetail] Error assigning theme", insertError);
        showInfoModal("Fout", "Kon thema niet toewijzen");
        return;
      }

      console.log("[ClientDetail] Theme assigned successfully");
      setActiveThemeId(themeId);
      setThemeModalVisible(false);
      showInfoModal("Succes", "Thema succesvol toegewezen");
    } catch (error: unknown) {
      console.error("[ClientDetail] Error assigning theme", error);
      showInfoModal("Fout", "Kon thema niet toewijzen");
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

  const TABS: { key: TabKey; label: string }[] = [
    { key: "overzicht", label: "Overzicht" },
    { key: "huiswerk", label: "Huiswerk" },
    { key: "betalingen", label: "Betalingen" },
    { key: "afspraken", label: "Afspraken" },
  ];

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
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={[styles.tabBar, { borderBottomColor: colors.border }]}
          contentContainerStyle={styles.tabBarContent}
        >
          {TABS.map(tab => {
            const isActive = activeTab === tab.key;
            return (
              <AnimatedPressable
                key={tab.key}
                style={styles.tabItem}
                onPress={() => {
                  console.log("[ClientDetail] Tab pressed:", tab.key);
                  setActiveTab(tab.key);
                }}
              >
                <Text style={[styles.tabLabel, { color: isActive ? bcctColors.primaryOrange : bcctColors.textSecondary }]}>
                  {tab.label}
                </Text>
                {isActive ? (
                  <View style={[styles.tabIndicator, { backgroundColor: bcctColors.primaryOrange }]} />
                ) : null}
              </AnimatedPressable>
            );
          })}
        </ScrollView>

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
        ) : activeTab === "huiswerk" ? (
          <HuiswerkTab clientId={clientId} clientName={client.full_name} />
        ) : activeTab === "betalingen" ? (
          <BetalingenTab
            clientId={clientId}
            coachId={coachId}
            onOpenModal={openBillingModal}
            invoices={invoices}
            loading={invoicesLoading}
          />
        ) : (
          <AfsprakenTab clientId={clientId} clientName={client.full_name} coachId={coachId} />
        )}
      </SafeAreaView>

      {/* Billing modal (root-level for iOS) */}
      <BillingModal
        visible={billingModalVisible}
        clientId={clientId}
        coachId={coachId}
        onClose={closeBillingModal}
        onCreated={loadInvoices}
      />

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
        isVisible={infoModalVisible}
        onBackdropPress={() => setInfoModalVisible(false)}
        onBackButtonPress={() => setInfoModalVisible(false)}
        animationIn="fadeIn"
        animationOut="fadeOut"
        backdropOpacity={0.5}
      >
        <View style={[styles.modalContent, { backgroundColor: colors.card }]}>
          <Text style={[styles.modalTitle, { color: bcctColors.primaryOrange }]}>{infoModalTitle}</Text>
          <Text style={[styles.modalMessage, { color: bcctColors.textSecondary }]}>{infoModalMessage}</Text>
          <TouchableOpacity
            style={[styles.modalButton, { backgroundColor: bcctColors.primaryOrange }]}
            onPress={() => setInfoModalVisible(false)}
          >
            <Text style={styles.modalButtonText}>OK</Text>
          </TouchableOpacity>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  loadingContainer: { flex: 1, justifyContent: "center", alignItems: "center" },
  errorContainer: { flex: 1, justifyContent: "center", alignItems: "center" },
  errorText: { ...bcctTypography.h3 },

  // Header
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  backButton: { width: 40, height: 40, justifyContent: "center", alignItems: "center" },
  headerTitle: { ...bcctTypography.h2, flex: 1, textAlign: "center" },
  placeholder: { width: 40 },

  // Client card
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
  clientInfo: { flex: 1, gap: 2 },
  clientName: { ...bcctTypography.h3 },
  clientEmail: { ...bcctTypography.small },

  // Tab bar
  tabBar: {
    borderBottomWidth: 1,
    marginHorizontal: 20,
    marginBottom: 4,
    flexGrow: 0,
  },
  tabBarContent: {
    flexDirection: "row",
  },
  tabItem: {
    alignItems: "center",
    paddingVertical: 10,
    paddingHorizontal: 14,
    position: "relative",
  },
  tabLabel: { ...bcctTypography.bodyMedium },
  tabIndicator: {
    position: "absolute",
    bottom: 0,
    left: "10%",
    right: "10%",
    height: 2,
    borderRadius: 1,
  },

  // Tab content shared
  tabContent: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  actionBtn: {
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
  actionBtnText: { color: "#fff", ...bcctTypography.button },
  listContainer: { flex: 1 },

  // Empty state
  emptyState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingBottom: 60,
    gap: 12,
  },
  emptyIconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  emptyIcon: { fontSize: 32 },
  emptyTitle: { ...bcctTypography.h3, textAlign: "center" },
  emptySubtitle: { ...bcctTypography.body, textAlign: "center", paddingHorizontal: 24 },

  // List cards (invoices / appointments)
  listCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
    gap: 8,
  },
  listCardRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  listCardTitle: { ...bcctTypography.bodyMedium, flex: 1 },
  listCardMeta: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  listCardAmount: { ...bcctTypography.bodyMedium },
  listCardDate: { fontSize: 13, lineHeight: 18 },
  statusBadge: {
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  statusBadgeText: { fontSize: 12, fontWeight: "600", lineHeight: 18 },

  // Overzicht tab
  scrollContent: { padding: 20, paddingTop: 16 },
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
  themeLabel: { ...bcctTypography.small },
  changeButton: { paddingHorizontal: 12, paddingVertical: 6 },
  changeButtonText: { ...bcctTypography.bodyMedium },
  themeName: { ...bcctTypography.h3, marginBottom: 8 },
  themeDescription: { ...bcctTypography.body },

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
  hwSubject: { ...bcctTypography.bodyMedium, flex: 1 },
  hwStatusBadge: {
    backgroundColor: bcctColors.success + "22",
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  hwStatusText: { color: bcctColors.success, fontSize: 12, fontWeight: "600", lineHeight: 18 },
  hwMessage: { ...bcctTypography.small, lineHeight: 20 },
  hwDivider: { height: 1, backgroundColor: bcctColors.borderGray, marginVertical: 12 },
  hwFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  hwFooterLeft: { flexDirection: "row", alignItems: "center", gap: 6 },
  hwFooterRight: { flexDirection: "row", alignItems: "center", gap: 6 },
  hwFooterIcon: { fontSize: 14 },
  hwFooterText: { fontSize: 13, lineHeight: 18 },
  hwRelDate: { fontSize: 12, lineHeight: 16, marginTop: 2 },

  // Skeleton
  skeletonCard: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: bcctColors.borderGray,
    backgroundColor: "#fff",
    padding: 16,
    marginBottom: 14,
  },
  skeletonRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  skeletonBlock: { backgroundColor: bcctColors.borderGray, borderRadius: 6, height: 14 },
  skeletonDivider: { height: 1, backgroundColor: bcctColors.borderGray, marginVertical: 12 },

  // Bottom modals
  bottomModal: { justifyContent: "flex-end", margin: 0 },
  modalHandle: {
    width: 40,
    height: 4,
    backgroundColor: "#ccc",
    borderRadius: 2,
    alignSelf: "center",
    marginBottom: 16,
  },

  // Theme modal
  themeModalContent: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 24,
    maxHeight: "80%",
  },
  themesList: { marginTop: 16 },
  emptyThemes: { padding: 24, alignItems: "center" },
  emptyText: { ...bcctTypography.body, textAlign: "center" },
  themeOption: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 12,
    gap: 12,
  },
  themeOptionContent: { flex: 1, gap: 4 },
  themeOptionName: { ...bcctTypography.bodyMedium },
  themeOptionDescription: { ...bcctTypography.small },

  // Form modals (payment + appointment)
  formModalContent: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    maxHeight: "90%",
  },
  formModalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  formModalTitle: { ...bcctTypography.h3 },
  modalCloseBtn: { padding: 8 },
  modalCloseBtnText: { fontSize: 18, lineHeight: 22 },
  formNote: {
    backgroundColor: bcctColors.primaryOrange + "12",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 16,
  },
  formNoteText: { fontSize: 13, lineHeight: 18 },
  fieldLabel: { ...bcctTypography.label, marginBottom: 6, marginTop: 12 },
  formInput: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    ...bcctTypography.body,
  },
  formTextArea: { minHeight: 80, paddingTop: 12 },
  hwTextArea: { minHeight: 120, paddingTop: 12 },
  formInputReadOnly: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  formInputReadOnlyText: { ...bcctTypography.body },
  timeRow: { flexDirection: "row", gap: 12 },
  timeField: { flex: 1 },
  fieldError: { color: bcctColors.error, fontSize: 12, lineHeight: 18, marginTop: 4 },
  submitErrorBox: {
    backgroundColor: bcctColors.error + "15",
    borderRadius: 10,
    padding: 12,
    marginTop: 12,
  },
  submitErrorText: { color: bcctColors.error, fontSize: 13, lineHeight: 18 },
  successBox: {
    backgroundColor: bcctColors.success + "15",
    borderRadius: 10,
    padding: 12,
    marginTop: 12,
  },
  successText: { color: bcctColors.success, fontSize: 13, fontWeight: "600", lineHeight: 18 },
  submitBtn: {
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: "center",
    marginTop: 20,
    shadowColor: bcctColors.primaryOrange,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  submitBtnText: { color: "#fff", ...bcctTypography.button },

  // Info modal
  modalContent: { borderRadius: 20, padding: 24, alignItems: "center" },
  modalTitle: { ...bcctTypography.h3, marginBottom: 12 },
  modalMessage: { ...bcctTypography.body, textAlign: "center", marginBottom: 24 },
  modalButton: {
    borderRadius: 12,
    paddingHorizontal: 32,
    paddingVertical: 12,
    minWidth: 100,
  },
  modalButtonText: { color: "#fff", ...bcctTypography.button, textAlign: "center" },

  // Betaling modal — step subtitle
  stepSubtitle: {
    ...bcctTypography.body,
    marginBottom: 16,
    marginTop: 4,
  },

  // Type selector cards
  typeCardsContainer: { gap: 12, paddingBottom: 8 },
  typeCard: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1.5,
    borderRadius: 12,
    padding: 16,
    gap: 14,
  },
  typeCardIcon: { fontSize: 26 },
  typeCardText: { flex: 1, gap: 2 },
  typeCardLabel: { ...bcctTypography.bodyMedium },
  typeCardSubtitle: { ...bcctTypography.small },
  typeCardCheck: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  typeCardCheckMark: { color: "#fff", fontSize: 13, fontWeight: "700" },

  // Back link in step 2 header
  backLink: { paddingVertical: 4, paddingRight: 8 },
  backLinkText: { ...bcctTypography.bodyMedium },

  // Cancel button
  cancelBtn: {
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 12,
    borderWidth: 1,
    minHeight: 48,
    justifyContent: "center",
  },
  cancelBtnText: { ...bcctTypography.button },

  // Invoice card meta rows
  invCardMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  invCardFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 2,
  },

  // Type badge (Eenmalig / Pakket / Maandelijks)
  typeBadge: {
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  typeBadgeText: { fontSize: 11, fontWeight: "600", lineHeight: 18 },

  // Payment link button
  payLinkBtn: {
    backgroundColor: bcctColors.primaryOrange + "18",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  payLinkBtnText: { color: bcctColors.primaryOrange, fontSize: 12, fontWeight: "600" },
});
