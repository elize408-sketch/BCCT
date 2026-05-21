
import React, { useState, useEffect } from "react";
import {
  ScrollView,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useAuth } from "@/contexts/AuthContext";
import { AvatarUpload } from "@/components/AvatarUpload";
import { supabase } from "@/lib/supabase";
import { bcctColors, bcctTypography } from "@/styles/bcctTheme";
import { LinearGradient } from "expo-linear-gradient";
import { IconSymbol } from "@/components/IconSymbol";

// ─── Helper components ────────────────────────────────────────────────────────

function SectionHeader({ title }: { title: string }) {
  return (
    <View style={styles.sectionHeaderStyle}>
      <Text style={styles.sectionHeaderText}>{title}</Text>
    </View>
  );
}

function FormField({
  label,
  value,
  onChangeText,
  placeholder,
  multiline,
  keyboardType,
  autoCapitalize,
}: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  placeholder?: string;
  multiline?: boolean;
  keyboardType?: any;
  autoCapitalize?: any;
}) {
  const inputStyle = multiline
    ? [styles.fieldInput, { height: 88, textAlignVertical: "top" as const }]
    : styles.fieldInput;

  return (
    <View style={styles.fieldContainer}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        style={inputStyle}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={bcctColors.textSecondary}
        multiline={multiline}
        keyboardType={keyboardType}
        autoCapitalize={autoCapitalize ?? "sentences"}
      />
    </View>
  );
}

// ─── Main screen ──────────────────────────────────────────────────────────────

export default function EditProfileScreen() {
  const router = useRouter();
  const { user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);

  // Personal
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");

  // Business
  const [businessName, setBusinessName] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [coachingTypes, setCoachingTypes] = useState("");
  const [coachingFormat, setCoachingFormat] = useState("");
  const [revenueModel, setRevenueModel] = useState("");
  const [activeClientRange, setActiveClientRange] = useState("");
  const [primaryGoals, setPrimaryGoals] = useState("");

  // Invoice
  const [kvk, setKvk] = useState("");
  const [btwNumber, setBtwNumber] = useState("");
  const [iban, setIban] = useState("");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [postalCode, setPostalCode] = useState("");
  const [country, setCountry] = useState("NL");
  const [invoiceFooter, setInvoiceFooter] = useState("");

  // Branding
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [primaryColor, setPrimaryColor] = useState("");

  // ─── Load profile ───────────────────────────────────────────────────────────

  useEffect(() => {
    if (!user?.id) return;
    console.log("[EditProfile] Loading profile for user:", user.id);
    supabase
      .from("profiles")
      .select(
        "full_name, phone, avatar_url, business_name, company_name, coaching_types, coaching_format, revenue_model, active_client_range, primary_goals, kvk, btw_number, iban, address, city, postal_code, country, invoice_footer, logo_url, primary_color"
      )
      .eq("id", user.id)
      .single()
      .then(({ data, error }) => {
        if (error) {
          console.error("[EditProfile] Load error:", error);
          setLoading(false);
          return;
        }
        if (data) {
          console.log("[EditProfile] Profile loaded:", data);
          setFullName(data.full_name ?? "");
          setPhone(data.phone ?? "");
          setAvatarUrl(data.avatar_url ?? null);
          setBusinessName(data.business_name ?? "");
          setCompanyName(data.company_name ?? "");
          const ct = data.coaching_types;
          setCoachingTypes(Array.isArray(ct) ? ct.join(", ") : (ct ?? ""));
          setCoachingFormat(data.coaching_format ?? "");
          setRevenueModel(data.revenue_model ?? "");
          setActiveClientRange(data.active_client_range ?? "");
          const pg = data.primary_goals;
          setPrimaryGoals(Array.isArray(pg) ? pg.join(", ") : (pg ?? ""));
          setKvk(data.kvk ?? "");
          setBtwNumber(data.btw_number ?? "");
          setIban(data.iban ?? "");
          setAddress(data.address ?? "");
          setCity(data.city ?? "");
          setPostalCode(data.postal_code ?? "");
          setCountry(data.country ?? "NL");
          setInvoiceFooter(data.invoice_footer ?? "");
          setLogoUrl(data.logo_url ?? null);
          setPrimaryColor(data.primary_color ?? "");
        }
        setLoading(false);
      });
  }, [user?.id]);

  // ─── Save handler ───────────────────────────────────────────────────────────

  const handleSave = async () => {
    console.log("[EditProfile] Save pressed");
    setSaving(true);
    try {
      const updates: Record<string, any> = {
        full_name: fullName.trim() || null,
        phone: phone.trim() || null,
        business_name: businessName.trim() || null,
        company_name: companyName.trim() || null,
        coaching_format: coachingFormat.trim() || null,
        revenue_model: revenueModel.trim() || null,
        active_client_range: activeClientRange.trim() || null,
        kvk: kvk.trim() || null,
        btw_number: btwNumber.trim() || null,
        iban: iban.trim() || null,
        address: address.trim() || null,
        city: city.trim() || null,
        postal_code: postalCode.trim() || null,
        country: country.trim() || "NL",
        invoice_footer: invoiceFooter.trim() || null,
        primary_color: primaryColor.trim() || null,
      };

      const ctArr = coachingTypes
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      if (ctArr.length > 0) updates.coaching_types = ctArr;

      const pgArr = primaryGoals
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      if (pgArr.length > 0) updates.primary_goals = pgArr;

      console.log("[EditProfile] Saving updates:", updates);
      const { error } = await supabase
        .from("profiles")
        .update(updates)
        .eq("id", user!.id);

      if (error) throw error;
      console.log("[EditProfile] Save successful");
      Alert.alert("Opgeslagen", "Je profiel is bijgewerkt.", [
        { text: "OK", onPress: () => router.back() },
      ]);
    } catch (err: any) {
      console.error("[EditProfile] Save error:", err.message);
      Alert.alert("Fout", "Opslaan mislukt. Probeer het opnieuw.");
    } finally {
      setSaving(false);
    }
  };

  const handleAvatarUploaded = (url: string) => {
    console.log("[EditProfile] Avatar uploaded:", url);
    setAvatarUrl(url);
  };

  const handleLogoUploaded = (url: string) => {
    console.log("[EditProfile] Logo uploaded:", url);
    setLogoUrl(url);
    const base = url.split("?")[0];
    supabase
      .from("profiles")
      .update({ logo_url: base })
      .eq("id", user!.id)
      .then(({ error }) => {
        if (error) console.error("[EditProfile] logo_url save error:", error);
      });
  };

  const logoUserId = (user?.id ?? "") + "_logo";

  // ─── Render ─────────────────────────────────────────────────────────────────

  return (
    <SafeAreaView edges={["top"]} style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1 }}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => {
              console.log("[EditProfile] Back pressed");
              router.back();
            }}
            style={styles.backButton}
          >
            <IconSymbol
              ios_icon_name="chevron.left"
              android_material_icon_name="arrow-back"
              size={24}
              color={bcctColors.primaryOrange}
            />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Profiel bewerken</Text>
          <View style={{ width: 40 }} />
        </View>

        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={bcctColors.primaryOrange} />
          </View>
        ) : (
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
          >
            {/* Avatar */}
            <View style={styles.avatarSection}>
              <AvatarUpload
                avatarUrl={avatarUrl}
                userId={user!.id}
                size={90}
                onUploaded={handleAvatarUploaded}
              />
              <Text style={styles.avatarHint}>Tik om foto te wijzigen</Text>
            </View>

            {/* Section 1: Persoonlijk */}
            <SectionHeader title="Persoonlijk" />
            <FormField
              label="Naam"
              value={fullName}
              onChangeText={setFullName}
              placeholder="Jouw volledige naam"
            />
            <FormField
              label="Telefoonnummer"
              value={phone}
              onChangeText={setPhone}
              placeholder="+31 6 12345678"
              keyboardType="phone-pad"
            />

            {/* Section 2: Praktijk */}
            <SectionHeader title="Praktijk" />
            <FormField
              label="Bedrijfsnaam"
              value={businessName}
              onChangeText={setBusinessName}
              placeholder="Naam van je bedrijf"
            />
            <FormField
              label="Praktijknaam"
              value={companyName}
              onChangeText={setCompanyName}
              placeholder="Praktijknaam of tagline"
            />
            <FormField
              label="Coachingtypes"
              value={coachingTypes}
              onChangeText={setCoachingTypes}
              placeholder="bijv. life coaching, business coaching"
            />
            <FormField
              label="Coachvorm"
              value={coachingFormat}
              onChangeText={setCoachingFormat}
              placeholder="bijv. online, in-person"
            />
            <FormField
              label="Verdienmodel"
              value={revenueModel}
              onChangeText={setRevenueModel}
              placeholder="bijv. per sessie, abonnement"
            />
            <FormField
              label="Gemiddeld aantal cliënten"
              value={activeClientRange}
              onChangeText={setActiveClientRange}
              placeholder="bijv. 5-10"
            />
            <FormField
              label="Doelen met de app"
              value={primaryGoals}
              onChangeText={setPrimaryGoals}
              placeholder="bijv. groei, structuur"
              multiline
            />

            {/* Section 3: Facturatiegegevens */}
            <SectionHeader title="Facturatiegegevens" />
            <FormField
              label="KVK-nummer"
              value={kvk}
              onChangeText={setKvk}
              placeholder="12345678"
              keyboardType="numeric"
            />
            <FormField
              label="BTW-nummer"
              value={btwNumber}
              onChangeText={setBtwNumber}
              placeholder="NL123456789B01"
            />
            <FormField
              label="IBAN"
              value={iban}
              onChangeText={setIban}
              placeholder="NL00 BANK 0000 0000 00"
              autoCapitalize="characters"
            />
            <FormField
              label="Adres"
              value={address}
              onChangeText={setAddress}
              placeholder="Straatnaam 1"
            />
            <FormField
              label="Plaats"
              value={city}
              onChangeText={setCity}
              placeholder="Amsterdam"
            />
            <FormField
              label="Postcode"
              value={postalCode}
              onChangeText={setPostalCode}
              placeholder="1234 AB"
              autoCapitalize="characters"
            />
            <FormField
              label="Land"
              value={country}
              onChangeText={setCountry}
              placeholder="NL"
              autoCapitalize="characters"
            />
            <FormField
              label="Factuur footer"
              value={invoiceFooter}
              onChangeText={setInvoiceFooter}
              placeholder="Betalingstermijn 14 dagen..."
              multiline
            />

            {/* Section 4: Branding */}
            <SectionHeader title="Branding" />
            <View style={styles.logoSection}>
              <Text style={styles.fieldLabel}>Bedrijfslogo</Text>
              <AvatarUpload
                avatarUrl={logoUrl}
                userId={logoUserId}
                size={72}
                onUploaded={handleLogoUploaded}
              />
              <Text style={styles.avatarHint}>Tik om logo te wijzigen</Text>
            </View>
            <FormField
              label="Primaire kleur (hex)"
              value={primaryColor}
              onChangeText={setPrimaryColor}
              placeholder="#F28C28"
              autoCapitalize="none"
            />

            {/* Save button */}
            <TouchableOpacity
              onPress={handleSave}
              disabled={saving}
              activeOpacity={0.8}
              style={{ marginTop: 32, marginBottom: 40 }}
            >
              <LinearGradient
                colors={[bcctColors.primaryOrange, bcctColors.primaryOrangeDark]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.saveButton}
              >
                {saving ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.saveButtonText}>Opslaan</Text>
                )}
              </LinearGradient>
            </TouchableOpacity>
          </ScrollView>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F7F9FC",
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
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: bcctColors.borderGray,
    backgroundColor: "#fff",
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: "center",
    alignItems: "center",
  },
  headerTitle: {
    ...bcctTypography.h3,
    color: bcctColors.textPrimary,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  avatarSection: {
    alignItems: "center",
    marginBottom: 28,
  },
  avatarHint: {
    marginTop: 8,
    fontSize: 13,
    color: bcctColors.textSecondary,
  },
  sectionHeaderStyle: {
    marginTop: 28,
    marginBottom: 12,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: bcctColors.borderGray,
  },
  sectionHeaderText: {
    ...bcctTypography.h3,
    color: bcctColors.textPrimary,
  },
  fieldContainer: {
    marginBottom: 16,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: bcctColors.textSecondary,
    marginBottom: 6,
  },
  fieldInput: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: bcctColors.borderGray,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: bcctColors.textPrimary,
    minHeight: 48,
  },
  logoSection: {
    alignItems: "flex-start",
    marginBottom: 16,
  },
  saveButton: {
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  saveButtonText: {
    color: "#fff",
    ...bcctTypography.button,
  },
});
