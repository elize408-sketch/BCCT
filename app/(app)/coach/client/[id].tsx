
import React, { useState, useCallback, useRef, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Image,
  TextInput,
  ImageSourcePropType,
  Platform,
  Animated,
  KeyboardAvoidingView,
  Alert,
} from "react-native";
import Modal from "react-native-modal";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "@react-navigation/native";
import { useFocusEffect } from "@react-navigation/native";
import { useLocalSearchParams, useRouter, Stack } from "expo-router";
import { supabase } from "@/lib/supabase";
import { bcctColors, bcctTypography } from "@/styles/bcctTheme";
import { LinearGradient } from "expo-linear-gradient";
import DateTimePicker from "@react-native-community/datetimepicker";
import {
  Activity,
  BookOpen,
  CreditCard,
  Calendar,
  FileText,
} from "lucide-react-native";
import { AnimatedPressable } from "@/components/AnimatedPressable";
import { createAssignment, listAssignments, HomeworkAssignment } from "@/utils/homeworkApi";

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
  client_id: string;
  template_id: string | null;
  assigned_at: string | null;
  current_week: number | null;
  template: { id: string; name: string; description: string | null } | null;
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

// ─── Tab definition ───────────────────────────────────────────────────────────

type TabKey = "logs" | "huiswerk" | "betalingen" | "afspraken" | "notities";

const TABS: { key: TabKey; label: string }[] = [
  { key: "logs", label: "Dagelijkse logs" },
  { key: "huiswerk", label: "Huiswerk" },
  { key: "betalingen", label: "Betalingen" },
  { key: "afspraken", label: "Afspraken" },
  { key: "notities", label: "Notities" },
];

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

// ─── Skeleton loader ──────────────────────────────────────────────────────────

function SkeletonRow() {
  const opacity = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 0.7,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0.3,
          duration: 800,
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, [opacity]);

  return (
    <Animated.View style={[skeletonStyles.row, { opacity }]}>
      <View style={skeletonStyles.left}>
        <View style={[skeletonStyles.line, { width: "60%", height: 14 }]} />
        <View style={[skeletonStyles.line, { width: "35%", height: 11, marginTop: 6 }]} />
      </View>
      <View style={[skeletonStyles.line, { width: 52, height: 22, borderRadius: 11 }]} />
    </Animated.View>
  );
}

const skeletonStyles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(0,0,0,0.06)",
  },
  left: { flex: 1, gap: 0 },
  line: {
    backgroundColor: bcctColors.borderGray,
    borderRadius: 6,
  },
});

// ─── Animated list item ───────────────────────────────────────────────────────

function AnimatedListItem({
  index,
  children,
}: {
  index: number;
  children: React.ReactNode;
}) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(10)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: 300,
        delay: index * 60,
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        toValue: 0,
        duration: 300,
        delay: index * 60,
        useNativeDriver: true,
      }),
    ]).start();
  }, [index, opacity, translateY]);

  return (
    <Animated.View style={{ opacity, transform: [{ translateY }] }}>
      {children}
    </Animated.View>
  );
}

// ─── Empty state ──────────────────────────────────────────────────────────────

function EmptyState({
  icon,
  title,
  subtitle,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
}) {
  return (
    <View style={emptyStyles.container}>
      <View style={emptyStyles.iconCircle}>{icon}</View>
      <Text style={emptyStyles.title}>{title}</Text>
      <Text style={emptyStyles.subtitle}>{subtitle}</Text>
    </View>
  );
}

const emptyStyles = StyleSheet.create({
  container: {
    alignItems: "center",
    paddingVertical: 36,
    paddingHorizontal: 24,
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 20,
    backgroundColor: bcctColors.primaryOrange + "15",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
  },
  title: {
    fontSize: 17,
    fontWeight: "600",
    color: bcctColors.textPrimary,
    marginBottom: 6,
    textAlign: "center",
  },
  subtitle: {
    fontSize: 14,
    color: bcctColors.textSecondary,
    textAlign: "center",
    lineHeight: 20,
    maxWidth: 260,
  },
});

// ─── Badge ────────────────────────────────────────────────────────────────────

function Badge({
  label,
  bg,
  fg,
}: {
  label: string;
  bg: string;
  fg: string;
}) {
  return (
    <View style={[badgeStyles.pill, { backgroundColor: bg }]}>
      <Text style={[badgeStyles.text, { color: fg }]}>{label}</Text>
    </View>
  );
}

const badgeStyles = StyleSheet.create({
  pill: {
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 3,
    alignSelf: "flex-start",
  },
  text: {
    fontSize: 12,
    fontWeight: "600",
  },
});

// ─── Invoice status badge ─────────────────────────────────────────────────────

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

  return <Badge label={label} bg={bg} fg={fg} />;
}

// ─── CTA button ───────────────────────────────────────────────────────────────

function CtaButton({
  label,
  onPress,
}: {
  label: string;
  onPress: () => void;
}) {
  return (
    <AnimatedPressable onPress={onPress} style={ctaStyles.button}>
      <Text style={ctaStyles.text}>{label}</Text>
    </AnimatedPressable>
  );
}

const ctaStyles = StyleSheet.create({
  button: {
    marginTop: 16,
    backgroundColor: bcctColors.primaryOrange + "15",
    borderRadius: 12,
    height: 48,
    alignItems: "center",
    justifyContent: "center",
  },
  text: {
    fontSize: 15,
    fontWeight: "600",
    color: bcctColors.primaryOrange,
  },
});

// ─── Tab content sections ─────────────────────────────────────────────────────

function LogsTab({
  data,
  loading,
}: {
  data: CheckinResponse[];
  loading: boolean;
}) {
  if (loading) {
    return (
      <View style={tabContentStyles.container}>
        {[0, 1, 2, 3].map((i) => (
          <SkeletonRow key={i} />
        ))}
      </View>
    );
  }

  if (data.length === 0) {
    return (
      <EmptyState
        icon={<Activity size={28} color={bcctColors.primaryOrange} strokeWidth={2} />}
        title="Nog geen dagelijkse logs"
        subtitle="Logs verschijnen hier zodra de cliënt begint in te vullen"
      />
    );
  }

  return (
    <View style={tabContentStyles.container}>
      {data.map((r, i) => {
        const checkinTitle = r.checkins?.title ?? "Check-in";
        const scoreText = r.score != null ? `Score: ${r.score}` : null;
        const dateText = formatDate(r.created_at);
        return (
          <AnimatedListItem key={r.id} index={i}>
            <View style={tabContentStyles.row}>
              <View style={tabContentStyles.rowLeft}>
                <Text style={tabContentStyles.rowTitle} numberOfLines={1}>
                  {checkinTitle}
                </Text>
                <Text style={tabContentStyles.rowSub}>{dateText}</Text>
              </View>
              {scoreText ? (
                <Badge
                  label={scoreText}
                  bg={bcctColors.primaryOrange + "15"}
                  fg={bcctColors.primaryOrange}
                />
              ) : null}
            </View>
          </AnimatedListItem>
        );
      })}
    </View>
  );
}

function HuiswerkTab({
  programs,
  themeAssignments,
  homeworkAssignments,
  loading,
  onNew,
}: {
  programs: ClientProgram[];
  themeAssignments: ThemeAssignment[];
  homeworkAssignments: HomeworkAssignment[];
  loading: boolean;
  onNew: () => void;
}) {
  console.log("[HuiswerkTab] Button rendered");
  const hasPrograms = programs.length > 0;
  const legacyItems = hasPrograms ? programs : themeAssignments;

  if (loading) {
    return (
      <View style={tabContentStyles.container}>
        {[0, 1, 2].map((i) => (
          <SkeletonRow key={i} />
        ))}
      </View>
    );
  }

  const hasAny = homeworkAssignments.length > 0 || legacyItems.length > 0;

  return (
    <View style={tabContentStyles.container}>
      {!hasAny ? (
        <EmptyState
          icon={<BookOpen size={28} color={bcctColors.primaryOrange} strokeWidth={2} />}
          title="Nog geen huiswerk"
          subtitle="Stuur huiswerk om te beginnen"
        />
      ) : (
        <>
          {homeworkAssignments.map((hw, i) => {
            const hwTitle = hw.subject;
            const hwDate = formatDate(hw.created_at);
            const hwStatus = hw.status ?? "open";
            return (
              <AnimatedListItem key={hw.id} index={i}>
                <View style={tabContentStyles.row}>
                  <View style={tabContentStyles.rowLeft}>
                    <Text style={tabContentStyles.rowTitle} numberOfLines={1}>
                      {hwTitle}
                    </Text>
                    <Text style={tabContentStyles.rowSub}>{hwDate}</Text>
                  </View>
                  <Badge
                    label={hwStatus}
                    bg={bcctColors.primaryOrange + "15"}
                    fg={bcctColors.primaryOrange}
                  />
                </View>
              </AnimatedListItem>
            );
          })}
          {legacyItems.map((item, i) => {
            const title = hasPrograms
              ? (item as ClientProgram).template?.name ?? "Programma"
              : (item as ThemeAssignment).themes?.title ?? "Thema";
            const dateText = hasPrograms
              ? formatDate((item as ClientProgram).assigned_at)
              : formatDate((item as ThemeAssignment).created_at);
            const weekText =
              hasPrograms && (item as ClientProgram).current_week != null
                ? `Week ${(item as ClientProgram).current_week}`
                : null;
            return (
              <AnimatedListItem key={item.id} index={homeworkAssignments.length + i}>
                <View style={tabContentStyles.row}>
                  <View style={tabContentStyles.rowLeft}>
                    <Text style={tabContentStyles.rowTitle} numberOfLines={1}>
                      {title}
                    </Text>
                    <Text style={tabContentStyles.rowSub}>{dateText}</Text>
                  </View>
                  {weekText ? (
                    <Badge
                      label={weekText}
                      bg={bcctColors.primaryOrange + "15"}
                      fg={bcctColors.primaryOrange}
                    />
                  ) : null}
                </View>
              </AnimatedListItem>
            );
          })}
        </>
      )}
      <CtaButton
        label="+ Huiswerk sturen"
        onPress={() => {
          console.log("[HuiswerkTab] Button pressed, opening modal");
          onNew();
        }}
      />
    </View>
  );
}

function BetalingenTab({
  data,
  loading,
  onOpenModal,
}: {
  data: Invoice[];
  loading: boolean;
  onOpenModal: () => void;
}) {
  console.log("[BetalingBtn] rendered");

  if (loading) {
    return (
      <View style={tabContentStyles.container}>
        {[0, 1, 2].map((i) => (
          <SkeletonRow key={i} />
        ))}
      </View>
    );
  }

  return (
    <View style={tabContentStyles.container}>
      {data.length === 0 ? (
        <EmptyState
          icon={<CreditCard size={28} color={bcctColors.primaryOrange} strokeWidth={2} />}
          title="Nog geen betalingen"
          subtitle="Betalingen verschijnen hier"
        />
      ) : (
        data.map((inv, i) => {
          const amountText = formatAmount(inv.amount);
          const dateText = formatDate(inv.created_at);
          const descText = inv.description ?? "Factuur";
          return (
            <AnimatedListItem key={inv.id} index={i}>
              <View style={tabContentStyles.row}>
                <View style={tabContentStyles.rowLeft}>
                  <Text style={tabContentStyles.rowTitle} numberOfLines={1}>
                    {descText}
                  </Text>
                  <Text style={tabContentStyles.rowSub}>{dateText}</Text>
                </View>
                <View style={tabContentStyles.rowRight}>
                  <Text style={tabContentStyles.amountText}>{amountText}</Text>
                  <InvoiceStatusBadge status={inv.status} />
                </View>
              </View>
            </AnimatedListItem>
          );
        })
      )}
      <CtaButton
        label="+ Betaling aanmaken"
        onPress={() => {
          console.log("[BetalingBtn] pressed");
          onOpenModal();
        }}
      />
    </View>
  );
}

// ─── Payment type options ─────────────────────────────────────────────────────

type PaymentType = "one_time" | "package" | "recurring_monthly";

const PAYMENT_TYPES: { key: PaymentType; label: string; subtitle: string; icon: string }[] = [
  { key: "one_time", label: "Eenmalig", subtitle: "Eenmalige betaling", icon: "💳" },
  { key: "package", label: "Pakket", subtitle: "Pakketprijs", icon: "📦" },
  { key: "recurring_monthly", label: "Maandelijks", subtitle: "Maandelijkse betaling", icon: "🔄" },
];

const BILLING_API = "https://qcirmbquzdbprjvqhqlj.supabase.co/functions/v1/billing-invoices";

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

// ─── Billing Modal ────────────────────────────────────────────────────────────

function BillingModal({
  visible,
  clientId,
  coachId,
  onClose,
  onCreated,
}: {
  visible: boolean;
  clientId: string;
  coachId: string;
  onClose: () => void;
  onCreated: () => void;
}) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [stripeEnabled, setStripeEnabled] = useState(false);
  const [step, setStep] = useState<1 | 2>(1);
  const [selectedType, setSelectedType] = useState<PaymentType>("one_time");

  const [title, setTitle] = useState("");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [titleError, setTitleError] = useState("");
  const [amountError, setAmountError] = useState("");
  const [submitError, setSubmitError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState("");

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
    console.log("[BetalingBtn] modal open:", false);
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
      setSubmitError(msg);
    } finally {
      setSubmitting(false);
    }
  }, [title, amount, description, dueDate, startDate, endDate, selectedType, clientId, resetForm, onClose, onCreated]);

  const stripeNoteText = stripeEnabled
    ? "Betaling wordt aangemaakt met Stripe betaallink"
    : "Betaling wordt opgeslagen als concept (Stripe nog niet gekoppeld)";

  const footerPadding = Math.max(insets.bottom, 16);
  const selectedTypeLabel = PAYMENT_TYPES.find((p) => p.key === selectedType)?.label ?? "Betaling";

  return (
    <Modal
      isVisible={visible}
      onBackdropPress={handleClose}
      onBackButtonPress={handleClose}
      animationIn="slideInUp"
      animationOut="slideOutDown"
      backdropOpacity={0.5}
      style={billingModalStyles.modal}
      avoidKeyboard
      useNativeDriver
      hideModalContentWhileAnimating
    >
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <View style={[billingModalStyles.sheet, { backgroundColor: colors.card, paddingBottom: footerPadding }]}>
          <View style={billingModalStyles.handle} />

          {step === 1 ? (
            <>
              <View style={billingModalStyles.header}>
                <Text style={[billingModalStyles.title, { color: colors.text }]}>Betaling aanmaken</Text>
                <AnimatedPressable onPress={handleClose} style={billingModalStyles.closeBtn}>
                  <Text style={[billingModalStyles.closeBtnText, { color: bcctColors.textSecondary }]}>✕</Text>
                </AnimatedPressable>
              </View>
              <Text style={[billingModalStyles.subtitle, { color: bcctColors.textSecondary }]}>
                Kies het type betaling
              </Text>
              <View style={billingModalStyles.typeCards}>
                {PAYMENT_TYPES.map((pt) => {
                  const isSelected = selectedType === pt.key;
                  return (
                    <AnimatedPressable
                      key={pt.key}
                      style={[
                        billingModalStyles.typeCard,
                        {
                          borderColor: isSelected ? bcctColors.primaryOrange : colors.border,
                          backgroundColor: isSelected ? bcctColors.primaryOrange + "10" : colors.background,
                        },
                      ]}
                      onPress={() => handleTypeSelect(pt.key)}
                    >
                      <Text style={billingModalStyles.typeCardIcon}>{pt.icon}</Text>
                      <View style={billingModalStyles.typeCardText}>
                        <Text style={[billingModalStyles.typeCardLabel, { color: colors.text }]}>{pt.label}</Text>
                        <Text style={[billingModalStyles.typeCardSub, { color: bcctColors.textSecondary }]}>{pt.subtitle}</Text>
                      </View>
                      {isSelected ? (
                        <View style={[billingModalStyles.typeCardCheck, { backgroundColor: bcctColors.primaryOrange }]}>
                          <Text style={billingModalStyles.typeCardCheckMark}>✓</Text>
                        </View>
                      ) : null}
                    </AnimatedPressable>
                  );
                })}
              </View>
            </>
          ) : (
            <>
              <View style={billingModalStyles.header}>
                <AnimatedPressable onPress={handleBack} disabled={submitting}>
                  <Text style={[billingModalStyles.backLink, { color: bcctColors.primaryOrange }]}>← Terug</Text>
                </AnimatedPressable>
                <Text style={[billingModalStyles.title, { color: colors.text }]}>{selectedTypeLabel}</Text>
                <AnimatedPressable onPress={handleClose} style={billingModalStyles.closeBtn} disabled={submitting}>
                  <Text style={[billingModalStyles.closeBtnText, { color: bcctColors.textSecondary }]}>✕</Text>
                </AnimatedPressable>
              </View>

              <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
                <Text style={[billingModalStyles.label, { color: bcctColors.textSecondary }]}>Titel *</Text>
                <TextInput
                  style={[billingModalStyles.input, { color: colors.text, borderColor: titleError ? bcctColors.error : colors.border, backgroundColor: colors.background }]}
                  placeholder="bijv. Sessie november"
                  placeholderTextColor={bcctColors.textSecondary}
                  value={title}
                  onChangeText={(t) => { setTitle(t); if (t.trim()) setTitleError(""); }}
                  editable={!submitting}
                  returnKeyType="next"
                />
                {titleError ? <Text style={billingModalStyles.fieldError}>{titleError}</Text> : null}

                <Text style={[billingModalStyles.label, { color: bcctColors.textSecondary }]}>Bedrag (€) *</Text>
                <TextInput
                  style={[billingModalStyles.input, { color: colors.text, borderColor: amountError ? bcctColors.error : colors.border, backgroundColor: colors.background }]}
                  placeholder="bijv. 75,00"
                  placeholderTextColor={bcctColors.textSecondary}
                  value={amount}
                  onChangeText={(t) => { setAmount(t); if (t.trim()) setAmountError(""); }}
                  keyboardType="decimal-pad"
                  editable={!submitting}
                  returnKeyType="next"
                />
                {amountError ? <Text style={billingModalStyles.fieldError}>{amountError}</Text> : null}

                <Text style={[billingModalStyles.label, { color: bcctColors.textSecondary }]}>Omschrijving (optioneel)</Text>
                <TextInput
                  style={[billingModalStyles.input, billingModalStyles.textArea, { color: colors.text, borderColor: colors.border, backgroundColor: colors.background }]}
                  placeholder="Beschrijving van de betaling..."
                  placeholderTextColor={bcctColors.textSecondary}
                  value={description}
                  onChangeText={setDescription}
                  multiline
                  numberOfLines={3}
                  textAlignVertical="top"
                  editable={!submitting}
                />

                {(selectedType === "one_time" || selectedType === "package") ? (
                  <>
                    <Text style={[billingModalStyles.label, { color: bcctColors.textSecondary }]}>Vervaldatum (optioneel, DD-MM-YYYY)</Text>
                    <TextInput
                      style={[billingModalStyles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.background }]}
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
                    <Text style={[billingModalStyles.label, { color: bcctColors.textSecondary }]}>Startdatum (optioneel, DD-MM-YYYY)</Text>
                    <TextInput
                      style={[billingModalStyles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.background }]}
                      placeholder="bijv. 01-01-2025"
                      placeholderTextColor={bcctColors.textSecondary}
                      value={startDate}
                      onChangeText={setStartDate}
                      keyboardType="numbers-and-punctuation"
                      editable={!submitting}
                      returnKeyType="next"
                    />
                    <Text style={[billingModalStyles.label, { color: bcctColors.textSecondary }]}>Einddatum (optioneel, DD-MM-YYYY)</Text>
                    <TextInput
                      style={[billingModalStyles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.background }]}
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

                <View style={[billingModalStyles.stripeNote, { marginTop: 16 }]}>
                  <Text style={[billingModalStyles.stripeNoteText, { color: bcctColors.textSecondary }]}>
                    {stripeNoteText}
                  </Text>
                </View>

                {submitError ? (
                  <View style={billingModalStyles.errorBox}>
                    <Text style={billingModalStyles.errorText}>{submitError}</Text>
                  </View>
                ) : null}

                {successMsg ? (
                  <View style={billingModalStyles.successBox}>
                    <Text style={billingModalStyles.successText}>{successMsg}</Text>
                  </View>
                ) : null}

                <AnimatedPressable
                  style={[billingModalStyles.submitBtn, { opacity: submitting ? 0.6 : 1 }]}
                  onPress={handleSubmit}
                  disabled={submitting}
                >
                  <LinearGradient
                    colors={[bcctColors.primaryOrange, bcctColors.primaryOrangeDark]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={billingModalStyles.submitBtnGradient}
                  >
                    {submitting ? (
                      <ActivityIndicator color="#fff" size="small" />
                    ) : (
                      <Text style={billingModalStyles.submitBtnText}>Aanmaken</Text>
                    )}
                  </LinearGradient>
                </AnimatedPressable>

                <AnimatedPressable
                  style={[billingModalStyles.cancelBtn, { borderColor: colors.border }]}
                  onPress={handleClose}
                  disabled={submitting}
                >
                  <Text style={[billingModalStyles.cancelBtnText, { color: bcctColors.textSecondary }]}>Annuleren</Text>
                </AnimatedPressable>

                <View style={{ height: 24 }} />
              </ScrollView>
            </>
          )}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const billingModalStyles = StyleSheet.create({
  modal: { justifyContent: "flex-end", margin: 0 },
  sheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 12,
    paddingHorizontal: 24,
    maxHeight: "92%",
  },
  handle: {
    width: 40,
    height: 4,
    backgroundColor: "#ccc",
    borderRadius: 2,
    alignSelf: "center",
    marginBottom: 20,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  title: { ...bcctTypography.h3, flex: 1, textAlign: "center" },
  subtitle: { ...bcctTypography.body, marginBottom: 16 },
  closeBtn: { padding: 4 },
  closeBtnText: { fontSize: 18, fontWeight: "600" },
  backLink: { fontSize: 15, fontWeight: "500" },
  typeCards: { gap: 10, marginBottom: 8 },
  typeCard: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1.5,
    borderRadius: 14,
    padding: 14,
    gap: 12,
  },
  typeCardIcon: { fontSize: 24 },
  typeCardText: { flex: 1 },
  typeCardLabel: { ...bcctTypography.bodyMedium },
  typeCardSub: { fontSize: 13, lineHeight: 18 },
  typeCardCheck: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
  },
  typeCardCheckMark: { color: "#fff", fontSize: 13, fontWeight: "700" },
  label: { ...bcctTypography.label, marginBottom: 6 },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    ...bcctTypography.body,
    marginBottom: 16,
  },
  textArea: { minHeight: 80, paddingTop: 12 },
  fieldError: { color: bcctColors.error, fontSize: 12, marginTop: -12, marginBottom: 12 },
  stripeNote: {
    borderRadius: 10,
    backgroundColor: bcctColors.primaryOrange + "10",
    padding: 12,
    marginBottom: 16,
  },
  stripeNoteText: { fontSize: 13, lineHeight: 18 },
  errorBox: {
    backgroundColor: bcctColors.error + "15",
    borderRadius: 10,
    padding: 12,
    marginBottom: 12,
  },
  errorText: { color: bcctColors.error, fontSize: 13 },
  successBox: {
    backgroundColor: bcctColors.success + "15",
    borderRadius: 10,
    padding: 12,
    marginBottom: 12,
  },
  successText: { color: bcctColors.success, fontSize: 13, fontWeight: "600" },
  submitBtn: { borderRadius: 12, overflow: "hidden", marginBottom: 10 },
  submitBtnGradient: {
    minHeight: 48,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 13,
  },
  submitBtnText: { color: "#fff", ...bcctTypography.button },
  cancelBtn: {
    minHeight: 48,
    borderWidth: 1,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 13,
  },
  cancelBtnText: { ...bcctTypography.bodyMedium },
});

function AfsprakenTab({
  data,
  loading,
  onNew,
}: {
  data: Appointment[];
  loading: boolean;
  onNew: () => void;
}) {
  if (loading) {
    return (
      <View style={tabContentStyles.container}>
        {[0, 1, 2].map((i) => (
          <SkeletonRow key={i} />
        ))}
      </View>
    );
  }

  return (
    <View style={tabContentStyles.container}>
      {data.length === 0 ? (
        <EmptyState
          icon={<Calendar size={28} color={bcctColors.primaryOrange} strokeWidth={2} />}
          title="Nog geen afspraken"
          subtitle="Plan een afspraak in met deze cliënt"
        />
      ) : (
        data.map((apt, i) => {
          const aptTitle = apt.title ?? "Afspraak";
          const aptDate = formatDate(apt.start_time);
          const aptTimeStart = formatTime(apt.start_time);
          const aptTimeEnd = formatTime(apt.end_time);
          const timeRange = apt.end_time
            ? `${aptTimeStart} – ${aptTimeEnd}`
            : aptTimeStart;
          const dateTimeText = `${aptDate} · ${timeRange}`;
          return (
            <AnimatedListItem key={apt.id} index={i}>
              <View style={tabContentStyles.row}>
                <View style={tabContentStyles.rowLeft}>
                  <Text style={tabContentStyles.rowTitle} numberOfLines={1}>
                    {aptTitle}
                  </Text>
                  <Text style={tabContentStyles.rowSub}>{dateTimeText}</Text>
                </View>
                {apt.status ? (
                  <Badge
                    label={apt.status}
                    bg={bcctColors.primaryOrange + "15"}
                    fg={bcctColors.primaryOrange}
                  />
                ) : null}
              </View>
            </AnimatedListItem>
          );
        })
      )}
      <CtaButton label="+ Nieuwe afspraak" onPress={onNew} />
    </View>
  );
}

function NotitiesTab({
  data,
  loading,
  onNew,
}: {
  data: CoachNote[];
  loading: boolean;
  onNew: () => void;
}) {
  if (loading) {
    return (
      <View style={tabContentStyles.container}>
        {[0, 1, 2].map((i) => (
          <SkeletonRow key={i} />
        ))}
      </View>
    );
  }

  return (
    <View style={tabContentStyles.container}>
      {data.length === 0 ? (
        <EmptyState
          icon={<FileText size={28} color={bcctColors.primaryOrange} strokeWidth={2} />}
          title="Nog geen notities"
          subtitle="Voeg een notitie toe over deze cliënt"
        />
      ) : (
        data.map((note, i) => {
          const noteTitleText = note.title ?? "Notitie";
          const preview =
            (note.content ?? "").length > 80
              ? (note.content ?? "").slice(0, 80) + "…"
              : (note.content ?? "");
          const dateText = formatDate(note.created_at);
          return (
            <AnimatedListItem key={note.id} index={i}>
              <View style={tabContentStyles.row}>
                <View style={tabContentStyles.rowLeft}>
                  <Text style={tabContentStyles.rowTitle} numberOfLines={1}>
                    {noteTitleText}
                  </Text>
                  {preview ? (
                    <Text
                      style={tabContentStyles.rowPreview}
                      numberOfLines={2}
                    >
                      {preview}
                    </Text>
                  ) : null}
                  <Text style={tabContentStyles.rowSub}>{dateText}</Text>
                </View>
              </View>
            </AnimatedListItem>
          );
        })
      )}
      <CtaButton label="+ Nieuwe notitie" onPress={onNew} />
    </View>
  );
}

const tabContentStyles = StyleSheet.create({
  container: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 8,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(0,0,0,0.07)",
    gap: 12,
  },
  rowLeft: {
    flex: 1,
    gap: 3,
  },
  rowRight: {
    alignItems: "flex-end",
    gap: 4,
  },
  rowTitle: {
    fontSize: 15,
    fontWeight: "500",
    color: bcctColors.textPrimary,
    lineHeight: 20,
  },
  rowSub: {
    fontSize: 13,
    color: bcctColors.textSecondary,
    lineHeight: 18,
  },
  rowPreview: {
    fontSize: 13,
    color: bcctColors.textSecondary,
    lineHeight: 18,
  },
  amountText: {
    fontSize: 15,
    fontWeight: "700",
    color: bcctColors.textPrimary,
  },
});

// ─── Homework Modal ───────────────────────────────────────────────────────────

function HomeworkModal({
  visible,
  subject,
  message,
  deadline,
  showDatePicker,
  saving,
  colors,
  onChangeSubject,
  onChangeMessage,
  onToggleDatePicker,
  onChangeDeadline,
  onClearDeadline,
  onCancel,
  onSave,
}: {
  visible: boolean;
  subject: string;
  message: string;
  deadline: Date | null;
  showDatePicker: boolean;
  saving: boolean;
  colors: { card: string; background: string; text: string; border: string };
  onChangeSubject: (v: string) => void;
  onChangeMessage: (v: string) => void;
  onToggleDatePicker: () => void;
  onChangeDeadline: (date: Date) => void;
  onClearDeadline: () => void;
  onCancel: () => void;
  onSave: () => void;
}) {
  const insets = useSafeAreaInsets();
  const isSaveDisabled = saving || !subject.trim() || !message.trim();
  const footerPaddingBottom = Math.max(insets.bottom, 16);
  const deadlineLabel = deadline
    ? deadline.toLocaleDateString("nl-NL", { day: "numeric", month: "short", year: "numeric" })
    : "Geen deadline";

  return (
    <Modal
      isVisible={visible}
      onBackdropPress={onCancel}
      onBackButtonPress={onCancel}
      animationIn="slideInUp"
      animationOut="slideOutDown"
      backdropOpacity={0.5}
      style={hwModalStyles.modal}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={hwModalStyles.kavWrapper}
      >
        <View style={[hwModalStyles.sheet, { backgroundColor: colors.card }]}>
          {/* Handle */}
          <View style={hwModalStyles.handle} />

          {/* Header */}
          <Text style={[hwModalStyles.title, { color: colors.text }]}>
            Huiswerk sturen
          </Text>

          {/* Scrollable form */}
          <ScrollView
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={hwModalStyles.scrollContent}
          >
            {/* Onderwerp */}
            <Text style={[hwModalStyles.label, { color: bcctColors.textSecondary }]}>
              Onderwerp *
            </Text>
            <TextInput
              style={[
                hwModalStyles.input,
                {
                  backgroundColor: colors.background,
                  color: colors.text,
                  borderColor: colors.border,
                },
              ]}
              placeholder="Bijv. Ademhalingsoefening"
              placeholderTextColor={bcctColors.textSecondary}
              value={subject}
              onChangeText={onChangeSubject}
              returnKeyType="next"
              editable={!saving}
            />

            {/* Tekst */}
            <Text style={[hwModalStyles.label, { color: bcctColors.textSecondary }]}>
              Tekst *
            </Text>
            <TextInput
              style={[
                hwModalStyles.input,
                hwModalStyles.textArea,
                {
                  backgroundColor: colors.background,
                  color: colors.text,
                  borderColor: colors.border,
                },
              ]}
              placeholder="Beschrijf het huiswerk..."
              placeholderTextColor={bcctColors.textSecondary}
              value={message}
              onChangeText={onChangeMessage}
              multiline
              numberOfLines={5}
              textAlignVertical="top"
              editable={!saving}
            />

            {/* Deadline */}
            <Text style={[hwModalStyles.label, { color: bcctColors.textSecondary }]}>
              Deadline (optioneel)
            </Text>
            <View style={hwModalStyles.deadlineRow}>
              <AnimatedPressable
                style={[
                  hwModalStyles.deadlineBtn,
                  {
                    backgroundColor: colors.background,
                    borderColor: colors.border,
                  },
                ]}
                onPress={onToggleDatePicker}
                disabled={saving}
              >
                <Calendar size={16} color={bcctColors.primaryOrange} strokeWidth={2} />
                <Text style={[hwModalStyles.deadlineBtnText, { color: deadline ? colors.text : bcctColors.textSecondary }]}>
                  {deadlineLabel}
                </Text>
              </AnimatedPressable>
              {deadline ? (
                <AnimatedPressable
                  style={hwModalStyles.clearDeadlineBtn}
                  onPress={onClearDeadline}
                  disabled={saving}
                >
                  <Text style={hwModalStyles.clearDeadlineBtnText}>Wissen</Text>
                </AnimatedPressable>
              ) : null}
            </View>

            {showDatePicker ? (
              <DateTimePicker
                value={deadline ?? new Date()}
                mode="date"
                display={Platform.OS === "ios" ? "inline" : "default"}
                minimumDate={new Date()}
                onChange={(_event, date) => {
                  if (date) onChangeDeadline(date);
                }}
                style={hwModalStyles.datePicker}
              />
            ) : null}

            {/* Bijlagen placeholder */}
            <Text style={[hwModalStyles.label, { color: bcctColors.textSecondary }]}>
              Bijlagen (optioneel)
            </Text>
            <View
              style={[
                hwModalStyles.attachmentPlaceholder,
                { backgroundColor: colors.background, borderColor: colors.border },
              ]}
            >
              <Text style={[hwModalStyles.attachmentPlaceholderText, { color: bcctColors.textSecondary }]}>
                Bijlagen toevoegen — binnenkort beschikbaar
              </Text>
            </View>
          </ScrollView>

          {/* Footer */}
          <View style={[hwModalStyles.footer, { paddingBottom: footerPaddingBottom }]}>
            <AnimatedPressable
              style={[hwModalStyles.cancelBtn, { borderColor: colors.border }]}
              onPress={onCancel}
              disabled={saving}
            >
              <Text style={[hwModalStyles.cancelBtnText, { color: bcctColors.textSecondary }]}>
                Annuleren
              </Text>
            </AnimatedPressable>

            <AnimatedPressable
              style={[hwModalStyles.saveBtn, { opacity: isSaveDisabled ? 0.5 : 1 }]}
              onPress={onSave}
              disabled={isSaveDisabled}
            >
              <LinearGradient
                colors={[bcctColors.primaryOrange, bcctColors.primaryOrangeDark]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={hwModalStyles.saveBtnGradient}
              >
                {saving ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={hwModalStyles.saveBtnText}>Versturen</Text>
                )}
              </LinearGradient>
            </AnimatedPressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const hwModalStyles = StyleSheet.create({
  modal: {
    justifyContent: "flex-end",
    margin: 0,
  },
  kavWrapper: {
    width: "100%",
  },
  sheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 12,
    paddingHorizontal: 24,
    maxHeight: "92%",
  },
  handle: {
    width: 40,
    height: 4,
    backgroundColor: "#ccc",
    borderRadius: 2,
    alignSelf: "center",
    marginBottom: 20,
  },
  title: {
    ...bcctTypography.h3,
    marginBottom: 20,
  },
  scrollContent: {
    paddingBottom: 8,
  },
  label: {
    ...bcctTypography.label,
    marginBottom: 6,
  },
  input: {
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
  deadlineRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 16,
  },
  deadlineBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  deadlineBtnText: {
    ...bcctTypography.body,
  },
  clearDeadlineBtn: {
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  clearDeadlineBtnText: {
    fontSize: 14,
    color: bcctColors.error,
    fontWeight: "500",
  },
  datePicker: {
    marginBottom: 16,
  },
  attachmentPlaceholder: {
    borderWidth: 1,
    borderRadius: 12,
    borderStyle: "dashed",
    paddingHorizontal: 14,
    paddingVertical: 16,
    alignItems: "center",
    marginBottom: 16,
  },
  attachmentPlaceholderText: {
    fontSize: 14,
    fontStyle: "italic",
  },
  footer: {
    flexDirection: "row",
    gap: 12,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "rgba(0,0,0,0.08)",
  },
  cancelBtn: {
    flex: 1,
    minHeight: 48,
    borderWidth: 1,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 13,
  },
  cancelBtnText: {
    ...bcctTypography.bodyMedium,
  },
  saveBtn: {
    flex: 1,
    minHeight: 48,
    borderRadius: 12,
    overflow: "hidden",
  },
  saveBtnGradient: {
    flex: 1,
    minHeight: 48,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 13,
  },
  saveBtnText: {
    color: "#fff",
    ...bcctTypography.button,
  },
});

// ─── Note Modal ───────────────────────────────────────────────────────────────

function NoteModal({
  visible,
  noteTitle,
  noteContent,
  savingNote,
  colors,
  onChangeTitle,
  onChangeContent,
  onCancel,
  onSave,
}: {
  visible: boolean;
  noteTitle: string;
  noteContent: string;
  savingNote: boolean;
  colors: { card: string; background: string; text: string; border: string };
  onChangeTitle: (v: string) => void;
  onChangeContent: (v: string) => void;
  onCancel: () => void;
  onSave: () => void;
}) {
  const insets = useSafeAreaInsets();
  const isSaveDisabled = savingNote || !noteContent.trim();
  const footerPaddingBottom = Math.max(insets.bottom, 16);

  return (
    <Modal
      isVisible={visible}
      onBackdropPress={onCancel}
      onBackButtonPress={onCancel}
      animationIn="slideInUp"
      animationOut="slideOutDown"
      backdropOpacity={0.5}
      style={noteModalStyles.modal}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={noteModalStyles.kavWrapper}
      >
        <View style={[noteModalStyles.sheet, { backgroundColor: colors.card }]}>
          {/* Handle */}
          <View style={noteModalStyles.handle} />

          {/* Header */}
          <Text style={[noteModalStyles.title, { color: colors.text }]}>
            Nieuwe notitie
          </Text>

          {/* Scrollable form */}
          <ScrollView
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={noteModalStyles.scrollContent}
          >
            <Text style={[noteModalStyles.label, { color: bcctColors.textSecondary }]}>
              Titel (optioneel)
            </Text>
            <TextInput
              style={[
                noteModalStyles.input,
                {
                  backgroundColor: colors.background,
                  color: colors.text,
                  borderColor: colors.border,
                },
              ]}
              placeholder="Bijv. Sessie samenvatting"
              placeholderTextColor={bcctColors.textSecondary}
              value={noteTitle}
              onChangeText={onChangeTitle}
              returnKeyType="next"
              editable={!savingNote}
            />

            <Text style={[noteModalStyles.label, { color: bcctColors.textSecondary }]}>
              Inhoud
            </Text>
            <TextInput
              style={[
                noteModalStyles.input,
                noteModalStyles.textArea,
                {
                  backgroundColor: colors.background,
                  color: colors.text,
                  borderColor: colors.border,
                },
              ]}
              placeholder="Schrijf hier je notitie..."
              placeholderTextColor={bcctColors.textSecondary}
              value={noteContent}
              onChangeText={onChangeContent}
              multiline
              numberOfLines={5}
              textAlignVertical="top"
              editable={!savingNote}
            />
          </ScrollView>

          {/* Footer — anchored outside scroll, safe area aware */}
          <View style={[noteModalStyles.footer, { paddingBottom: footerPaddingBottom }]}>
            <AnimatedPressable
              style={[noteModalStyles.cancelBtn, { borderColor: colors.border }]}
              onPress={onCancel}
              disabled={savingNote}
            >
              <Text style={[noteModalStyles.cancelBtnText, { color: bcctColors.textSecondary }]}>
                Annuleren
              </Text>
            </AnimatedPressable>

            <AnimatedPressable
              style={[
                noteModalStyles.saveBtn,
                { opacity: isSaveDisabled ? 0.5 : 1 },
              ]}
              onPress={onSave}
              disabled={isSaveDisabled}
            >
              <LinearGradient
                colors={[bcctColors.primaryOrange, bcctColors.primaryOrangeDark]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={noteModalStyles.saveBtnGradient}
              >
                {savingNote ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={noteModalStyles.saveBtnText}>Opslaan</Text>
                )}
              </LinearGradient>
            </AnimatedPressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const noteModalStyles = StyleSheet.create({
  modal: {
    justifyContent: "flex-end",
    margin: 0,
  },
  kavWrapper: {
    width: "100%",
  },
  sheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 12,
    paddingHorizontal: 24,
    maxHeight: "90%",
  },
  handle: {
    width: 40,
    height: 4,
    backgroundColor: "#ccc",
    borderRadius: 2,
    alignSelf: "center",
    marginBottom: 20,
  },
  title: {
    ...bcctTypography.h3,
    marginBottom: 20,
  },
  scrollContent: {
    paddingBottom: 8,
  },
  label: {
    ...bcctTypography.label,
    marginBottom: 6,
  },
  input: {
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
  footer: {
    flexDirection: "row",
    gap: 12,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "rgba(0,0,0,0.08)",
  },
  cancelBtn: {
    flex: 1,
    minHeight: 48,
    borderWidth: 1,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 13,
  },
  cancelBtnText: {
    ...bcctTypography.bodyMedium,
  },
  saveBtn: {
    flex: 1,
    minHeight: 48,
    borderRadius: 12,
    overflow: "hidden",
  },
  saveBtnGradient: {
    flex: 1,
    minHeight: 48,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 13,
  },
  saveBtnText: {
    color: "#fff",
    ...bcctTypography.button,
  },
});

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

  // Tab state
  const [activeTab, setActiveTab] = useState<TabKey>("logs");

  // Note modal state
  const [noteModalVisible, setNoteModalVisible] = useState(false);
  const [noteTitle, setNoteTitle] = useState("");
  const [noteContent, setNoteContent] = useState("");
  const [savingNote, setSavingNote] = useState(false);

  // Homework modal state
  const [hwModalVisible, setHwModalVisible] = useState(false);
  const [hwSubject, setHwSubject] = useState("");
  const [hwMessage, setHwMessage] = useState("");
  const [hwDeadline, setHwDeadline] = useState<Date | null>(null);
  const [hwShowDatePicker, setHwShowDatePicker] = useState(false);
  const [savingHw, setSavingHw] = useState(false);
  const [homeworkAssignments, setHomeworkAssignments] = useState<HomeworkAssignment[]>([]);

  // Billing modal state (lifted to root to avoid iOS modal clipping)
  const [billingModalVisible, setBillingModalVisible] = useState(false);

  const openBillingModal = useCallback(() => {
    console.log("[BetalingBtn] pressed");
    console.log("[BetalingBtn] modal open:", true);
    setBillingModalVisible(true);
  }, []);

  const closeBillingModal = useCallback(() => {
    console.log("[BetalingBtn] modal open:", false);
    setBillingModalVisible(false);
  }, []);

  // ── Fetch all data ──────────────────────────────────────────────────────────

  const loadAll = useCallback(async () => {
    if (!clientId) return;
    setLoading(true);
    setAccessDenied(false);

    try {
      // Get authenticated user
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        setAccessDenied(true);
        setLoading(false);
        return;
      }
      const coachId = user.id;
      setCoachProfileId(coachId);

      console.log("[ClientDetail] coach profile id:", coachId);
      console.log("[ClientDetail] client id from params:", clientId);

      // Verify active link — use .limit(1) so a missing row returns [] instead of an error
      const { data: accessRows, error: accessError } = await supabase
        .from("coach_clients")
        .select("coach_id")
        .eq("coach_id", coachId)
        .eq("client_id", clientId)
        .eq("status", "active")
        .limit(1);

      console.log("[ClientDetail] access check result count:", accessRows?.length ?? 0);
      const hasAccess = !accessError && accessRows && accessRows.length > 0;
      console.log("[ClientDetail] access granted:", hasAccess);

      if (accessError) {
        console.error("[ClientDetail] access check query error:", accessError.message);
        setAccessDenied(true);
        setLoading(false);
        return;
      }

      if (!hasAccess) {
        console.warn("[ClientDetail] no active coach_clients row found — access denied");
        setAccessDenied(true);
        setLoading(false);
        return;
      }

      // Fetch the link metadata (created_at, status) for display
      const { data: linkRows } = await supabase
        .from("coach_clients")
        .select("created_at, status")
        .eq("coach_id", coachId)
        .eq("client_id", clientId)
        .limit(1);
      const linkRow = linkRows?.[0] ?? null;
      setLink(
        linkRow
          ? { id: clientId, created_at: linkRow.created_at, status: linkRow.status }
          : null
      );

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
        fetchHomeworkAssignments(clientId),
      ]);
    } catch (err: any) {
      console.error("[ClientDetail] loadAll error:", err);
    } finally {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientId]);

  useFocusEffect(
    useCallback(() => {
      let isActive = true;

      const run = async () => {
        if (!isActive) return;
        await loadAll();
      };

      run();

      return () => {
        isActive = false;
      };
    }, [loadAll])
  );

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
      const { data: clientPrograms, error: programsError } = await supabase
        .from("client_programs")
        .select("id, client_id, template_id, assigned_at, current_week")
        .eq("client_id", cid);

      if (programsError) {
        if (isTableMissingError(programsError)) return;
        console.error("[ClientDetail] client_programs error:", programsError.message);
        return;
      }

      if (!clientPrograms || clientPrograms.length === 0) {
        console.log("[ClientDetail] client_programs: 0");
        setPrograms([]);
        return;
      }

      const templateIds = clientPrograms
        .map((p) => p.template_id)
        .filter(Boolean) as string[];

      let templates: { id: string; name: string; description: string | null }[] = [];
      if (templateIds.length > 0) {
        const { data: tplData } = await supabase
          .from("program_templates")
          .select("id, name, description")
          .in("id", templateIds);
        templates = tplData ?? [];
      }

      const homework: ClientProgram[] = clientPrograms.map((p) => ({
        ...p,
        template: templates.find((t) => t.id === p.template_id) ?? null,
      }));

      console.log("[ClientDetail] client_programs:", homework.length);
      setPrograms(homework);
    } catch (e: any) {
      console.error("[ClientDetail] fetchPrograms exception:", e);
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

  // ── Homework fetcher ────────────────────────────────────────────────────────

  const fetchHomeworkAssignments = async (cid: string) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) {
        console.warn("[HuiswerkTab] No auth token, skipping homework fetch");
        return;
      }
      const data = await listAssignments(token, cid);
      console.log("[ClientDetail] homework assignments:", data.length);
      setHomeworkAssignments(data);
    } catch (e: any) {
      console.error("[ClientDetail] fetchHomeworkAssignments exception:", e);
    }
  };

  // ── Homework modal handlers ─────────────────────────────────────────────────

  const openHwModal = useCallback(() => {
    console.log("[HuiswerkTab] Modal state changed:", true);
    setHwSubject("");
    setHwMessage("");
    setHwDeadline(null);
    setHwShowDatePicker(false);
    setHwModalVisible(true);
  }, []);

  const closeHwModal = useCallback(() => {
    console.log("[HuiswerkTab] Modal state changed:", false);
    setHwModalVisible(false);
    setHwShowDatePicker(false);
  }, []);

  const handleSaveHw = async () => {
    if (!hwSubject.trim() || !hwMessage.trim() || !clientId) return;
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;
    if (!token) {
      console.warn("[HuiswerkTab] No auth token, cannot send homework");
      Alert.alert("Fout", "Je bent niet ingelogd. Probeer opnieuw.");
      return;
    }
    const deadlineStr = hwDeadline
      ? hwDeadline.toISOString().split("T")[0]
      : null;
    const payload = {
      client_id: clientId,
      subject: hwSubject.trim(),
      message: hwMessage.trim(),
      deadline: deadlineStr,
    };
    console.log("[HuiswerkTab] Sending homework, payload:", payload);
    setSavingHw(true);
    try {
      await createAssignment(token, payload);
      console.log("[HuiswerkTab] Homework sent successfully");
      setHwModalVisible(false);
      setHwShowDatePicker(false);
      await fetchHomeworkAssignments(clientId);
      Alert.alert("Verstuurd", "Het huiswerk is succesvol verstuurd.");
    } catch (e: any) {
      console.error("[HuiswerkTab] Send homework error:", e);
      Alert.alert("Fout", e?.message ?? "Er is iets misgegaan. Probeer opnieuw.");
    } finally {
      setSavingHw(false);
    }
  };

  // ── Note creation ───────────────────────────────────────────────────────────

  const openNoteModal = useCallback(() => {
    console.log("[Notes] Modal opened");
    setNoteTitle("");
    setNoteContent("");
    setNoteModalVisible(true);
  }, []);

  const closeNoteModal = useCallback(() => {
    console.log("[Notes] Modal closed / cancelled");
    setNoteTitle("");
    setNoteContent("");
    setNoteModalVisible(false);
  }, []);

  const handleSaveNote = async () => {
    if (!noteContent.trim() || !coachProfileId || !clientId) return;
    const payload = {
      coach_id: coachProfileId,
      client_id: clientId,
      title: noteTitle.trim() || null,
      content: noteContent.trim(),
    };
    console.log("[Notes] Save pressed, payload:", payload);
    setSavingNote(true);
    try {
      const { error } = await supabase.from("coach_notes").insert(payload);
      if (error) {
        console.error("[Notes] Save error:", error.message);
        return;
      }
      console.log("[Notes] Save success");
      setNoteTitle("");
      setNoteContent("");
      setNoteModalVisible(false);
      await fetchNotes(clientId, coachProfileId);
    } catch (e: any) {
      console.error("[Notes] Save error:", e);
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
  const onboardingIncomplete =
    profile !== null && profile.onboarding_completed === false;

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
        showsVerticalScrollIndicator={false}
      >
        {/* ── Profile header ── */}
        <View style={[styles.profileHeader, { backgroundColor: colors.card }]}>
          {/* Avatar */}
          <View style={styles.avatarCircle}>
            {profile?.avatar_url ? (
              <Image
                source={resolveImageSource(profile.avatar_url)}
                style={styles.avatarImage}
              />
            ) : (
              <Text style={styles.avatarInitials}>{initials}</Text>
            )}
          </View>

          {/* Info */}
          <View style={styles.profileInfo}>
            <Text style={styles.profileName} numberOfLines={1}>
              {displayName}
            </Text>

            <View style={styles.badgesRow}>
              <Badge
                label="Actief"
                bg={bcctColors.success + "20"}
                fg={bcctColors.success}
              />
              {onboardingIncomplete ? (
                <Badge
                  label="Onboarding niet voltooid"
                  bg={bcctColors.accentOrange + "20"}
                  fg={bcctColors.accentOrange}
                />
              ) : null}
            </View>

            <Text style={styles.linkedSince}>
              {"Gekoppeld sinds "}
              {linkedSince}
            </Text>
          </View>
        </View>

        {/* ── Tab bar ── */}
        <View style={[styles.tabBarWrapper, { backgroundColor: colors.card }]}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.tabBarContent}
          >
            {TABS.map((tab) => {
              const isActive = activeTab === tab.key;
              return (
                <AnimatedPressable
                  key={tab.key}
                  onPress={() => {
                    console.log("[ClientDetail] Tab pressed:", tab.key);
                    setActiveTab(tab.key);
                  }}
                  style={[
                    styles.tabItem,
                    isActive && styles.tabItemActive,
                  ]}
                >
                  <Text
                    style={[
                      styles.tabLabel,
                      isActive ? styles.tabLabelActive : styles.tabLabelInactive,
                    ]}
                  >
                    {tab.label}
                  </Text>
                </AnimatedPressable>
              );
            })}
          </ScrollView>
        </View>

        {/* ── Tab content card ── */}
        <View
          style={[
            styles.contentCard,
            { backgroundColor: colors.card, borderColor: colors.border },
          ]}
        >
          {activeTab === "logs" && (
            <LogsTab data={checkinResponses} loading={false} />
          )}
          {activeTab === "huiswerk" && (
            <HuiswerkTab
              programs={programs}
              themeAssignments={themeAssignments}
              homeworkAssignments={homeworkAssignments}
              loading={false}
              onNew={openHwModal}
            />
          )}
          {activeTab === "betalingen" && (
            <BetalingenTab data={invoices} loading={false} onOpenModal={openBillingModal} />
          )}
          {activeTab === "afspraken" && (
            <AfsprakenTab
              data={appointments}
              loading={false}
              onNew={() => {
                console.log(
                  "[ClientDetail] Nieuwe afspraak pressed, navigating to appointment-form"
                );
                router.push("/(app)/coach/appointment-form" as any);
              }}
            />
          )}
          {activeTab === "notities" && (
            <NotitiesTab
              data={notes}
              loading={false}
              onNew={openNoteModal}
            />
          )}
        </View>

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* ── Note modal ── */}
      <NoteModal
        visible={noteModalVisible}
        noteTitle={noteTitle}
        noteContent={noteContent}
        savingNote={savingNote}
        colors={colors}
        onChangeTitle={setNoteTitle}
        onChangeContent={setNoteContent}
        onCancel={closeNoteModal}
        onSave={handleSaveNote}
      />

      {/* ── Homework modal ── */}
      <HomeworkModal
        visible={hwModalVisible}
        subject={hwSubject}
        message={hwMessage}
        deadline={hwDeadline}
        showDatePicker={hwShowDatePicker}
        saving={savingHw}
        colors={colors}
        onChangeSubject={setHwSubject}
        onChangeMessage={setHwMessage}
        onToggleDatePicker={() => setHwShowDatePicker((v) => !v)}
        onChangeDeadline={(date) => {
          setHwDeadline(date);
          setHwShowDatePicker(false);
        }}
        onClearDeadline={() => {
          setHwDeadline(null);
          setHwShowDatePicker(false);
        }}
        onCancel={closeHwModal}
        onSave={handleSaveHw}
      />

      {/* ── Billing modal (root-level to avoid iOS clipping) ── */}
      <BillingModal
        visible={billingModalVisible}
        clientId={clientId ?? ""}
        coachId={coachProfileId ?? ""}
        onClose={closeBillingModal}
        onCreated={() => {
          if (clientId && coachProfileId) {
            fetchInvoices(clientId, coachProfileId);
          }
        }}
      />
    </>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

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

  // Profile header
  profileHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 16,
    gap: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(0,0,0,0.08)",
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.06,
        shadowRadius: 4,
      },
      android: { elevation: 2 },
    }),
  },
  avatarCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: bcctColors.primaryOrange + "20",
    justifyContent: "center",
    alignItems: "center",
    overflow: "hidden",
    flexShrink: 0,
  },
  avatarImage: {
    width: 56,
    height: 56,
    borderRadius: 28,
  },
  avatarInitials: {
    fontSize: 20,
    fontWeight: "700",
    color: bcctColors.primaryOrange,
  },
  profileInfo: {
    flex: 1,
    gap: 5,
  },
  profileName: {
    fontSize: 20,
    fontWeight: "700",
    color: bcctColors.textPrimary,
    letterSpacing: -0.3,
    lineHeight: 26,
  },
  badgesRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  linkedSince: {
    fontSize: 13,
    color: bcctColors.textSecondary,
    lineHeight: 18,
  },

  // Tab bar
  tabBarWrapper: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(0,0,0,0.08)",
  },
  tabBarContent: {
    paddingHorizontal: 4,
    flexDirection: "row",
  },
  tabItem: {
    paddingHorizontal: 16,
    height: 44,
    justifyContent: "center",
    alignItems: "center",
    borderBottomWidth: 2,
    borderBottomColor: "transparent",
  },
  tabItemActive: {
    borderBottomColor: bcctColors.primaryOrange,
  },
  tabLabel: {
    fontSize: 14,
    fontWeight: "600",
  },
  tabLabelActive: {
    color: bcctColors.primaryOrange,
  },
  tabLabelInactive: {
    color: bcctColors.textSecondary,
  },

  // Content card
  contentCard: {
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 16,
    borderWidth: 1,
    overflow: "hidden",
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.06,
        shadowRadius: 4,
      },
      android: { elevation: 1 },
    }),
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
    justifyContent: "center",
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
    justifyContent: "center",
  },
  noteModalSaveText: {
    color: "#fff",
    ...bcctTypography.button,
  },
});
