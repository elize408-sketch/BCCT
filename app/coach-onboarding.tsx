
import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Image,
  ScrollView,
  Animated,
  ImageSourcePropType,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useTheme } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { bcctColors, bcctTypography } from '@/styles/bcctTheme';

const TOTAL_STEPS = 10;

const BRAND_COLORS = [
  '#000000',
  '#1a1a2e',
  '#16213e',
  '#0f3460',
  '#533483',
  '#e94560',
  '#f5a623',
  '#2ecc71',
];

const COACHING_TYPES = [
  'Burn-out coaching',
  'Stresscoaching',
  'Loopbaancoaching',
  'Life coaching',
  'Mindset coaching',
  'ADHD coaching',
  'Autisme / HSP coaching',
  'Teamcoaching',
  'Leiderschapscoaching',
  'Gezinscoaching',
  'Anders, namelijk…',
];

const CALENDAR_OPTIONS = [
  { key: 'google', label: 'Google Calendar', icon: 'logo-google' as const },
  { key: 'apple', label: 'Apple Calendar', icon: 'logo-apple' as const },
  { key: 'outlook', label: 'Outlook', icon: 'mail-outline' as const },
];

const COACHING_FORMAT_OPTIONS = [
  { label: '1-op-1 coaching', value: '1-op-1' },
  { label: 'Groepscoaching', value: 'groep' },
  { label: 'Beide', value: 'beide' },
];

const REVENUE_MODEL_OPTIONS = [
  { label: 'Per sessie', value: 'per_sessie' },
  { label: 'Trajectprijs', value: 'trajectprijs' },
  { label: 'Abonnement', value: 'abonnement' },
];

const ACTIVE_CLIENT_RANGE_OPTIONS = [
  { label: '1–5', value: '1-5' },
  { label: '6–10', value: '6-10' },
  { label: '11–25', value: '11-25' },
  { label: '26–50', value: '26-50' },
  { label: '50+', value: '50+' },
];

const PRIMARY_GOALS_OPTIONS = [
  { label: 'Cliëntcontact', value: 'cliëntcontact' },
  { label: 'Afspraken plannen', value: 'afspraken plannen' },
  { label: 'Facturatie', value: 'facturatie' },
  { label: 'Voortgang bijhouden', value: 'voortgang bijhouden' },
  { label: 'Documenten delen', value: 'documenten delen' },
  { label: 'Administratie', value: 'administratie' },
  { label: 'Structuur in mijn praktijk', value: 'structuur in mijn praktijk' },
];

function resolveImageSource(source: string | number | ImageSourcePropType | undefined): ImageSourcePropType {
  if (!source) return { uri: '' };
  if (typeof source === 'string') return { uri: source };
  return source as ImageSourcePropType;
}

async function uploadImageToStorage(uri: string, bucket: string, path: string): Promise<string> {
  console.log(`[uploadImageToStorage] Uploading to bucket="${bucket}" path="${path}"`);
  const response = await fetch(uri);
  const blob = await response.blob();

  const { error: uploadError } = await supabase.storage
    .from(bucket)
    .upload(path, blob, { contentType: 'image/jpeg', upsert: true });

  if (uploadError) throw uploadError;

  const { data } = supabase.storage.from(bucket).getPublicUrl(path);
  console.log(`[uploadImageToStorage] Public URL: ${data.publicUrl}`);
  return data.publicUrl;
}

export default function CoachOnboardingScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const { session, loading: authLoading } = useAuth();

  const [step, setStep] = useState(0);

  // Animation refs
  const opacityAnim = useRef(new Animated.Value(1)).current;
  const translateAnim = useRef(new Animated.Value(0)).current;
  const progressAnim = useRef(new Animated.Value((1 / TOTAL_STEPS) * 100)).current;

  // Step 1 — Bedrijfsinformatie
  const [companyName, setCompanyName] = useState('');
  const [website, setWebsite] = useState('');
  const [tagline, setTagline] = useState('');
  const [step1Error, setStep1Error] = useState('');

  // Step 2 — Profielfoto
  const [avatarLocalUri, setAvatarLocalUri] = useState<string | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [avatarError, setAvatarError] = useState('');

  // Step 3 — Bedrijfslogo
  const [logoLocalUri, setLogoLocalUri] = useState<string | null>(null);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [logoUploading, setLogoUploading] = useState(false);
  const [logoError, setLogoError] = useState('');

  // Step 4 — Type coaching
  const [selectedTypes, setSelectedTypes] = useState<string[]>([]);
  const [customType, setCustomType] = useState('');
  const [step4Error, setStep4Error] = useState('');

  // Step 5 — Agenda
  const [calendarProvider, setCalendarProvider] = useState<string | null>(null);

  // Step 6 — Werkwijze & Verdienmodel
  const [coachingFormat, setCoachingFormat] = useState<string>('');
  const [revenueModels, setRevenueModels] = useState<string[]>([]);
  const [activeClientRange, setActiveClientRange] = useState<string>('');
  const [primaryGoals, setPrimaryGoals] = useState<string[]>([]);
  const [step6Error, setStep6Error] = useState('');

  // Step 7 — Afronden
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');

  // Step 7 (new) — Bedrijfsgegevens
  const [businessName, setBusinessName] = useState('');
  const [kvk, setKvk] = useState('');
  const [btwNumber, setBtwNumber] = useState('');
  const [iban, setIban] = useState('');
  const [stepBizError, setStepBizError] = useState('');
  const [stepBizSaving, setStepBizSaving] = useState(false);

  // Step 8 (new) — Adres
  const [address, setAddress] = useState('');
  const [postalCode, setPostalCode] = useState('');
  const [city, setCity] = useState('');
  const [country, setCountry] = useState('NL');
  const [stepAddrSaving, setStepAddrSaving] = useState(false);
  const [stepAddrError, setStepAddrError] = useState('');

  // Step 9 (new) — Huisstijl
  const [brandLogoLocalUri, setBrandLogoLocalUri] = useState<string | null>(null);
  const [brandLogoUrl, setBrandLogoUrl] = useState<string | null>(null);
  const [brandLogoUploading, setBrandLogoUploading] = useState(false);
  const [brandLogoError, setBrandLogoError] = useState('');
  const [primaryColor, setPrimaryColor] = useState<string>('#0f3460');
  const [invoiceFooter, setInvoiceFooter] = useState('');
  const [stepBrandSaving, setStepBrandSaving] = useState(false);
  const [stepBrandError, setStepBrandError] = useState('');

  // Step 10 — Stripe Connect
  const [stripeError] = useState('');
  const [stripeLoading, setStripeLoading] = useState(false);

  // Session guard + prefill on mount
  useEffect(() => {
    const checkSession = async () => {
      console.log('[CoachOnboarding] Checking session on mount');
      const { data: { session: currentSession } } = await supabase.auth.getSession();

      if (!currentSession) {
        console.log('[CoachOnboarding] No session found, redirecting to auth');
        router.replace('/auth');
        return;
      }

      console.log('[CoachOnboarding] Session valid, prefilling profile for user:', currentSession.user.id);
      try {
        const { data: profile, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', currentSession.user.id)
          .single();

        if (error) {
          console.warn('[CoachOnboarding] Prefill query error (non-fatal):', error.message);
          return;
        }

        if (profile) {
          if (profile.company_name) setCompanyName(profile.company_name);
          if (profile.avatar_url) { setAvatarUrl(profile.avatar_url); setAvatarLocalUri(profile.avatar_url); }
          if (profile.company_logo_url) { setLogoUrl(profile.company_logo_url); setLogoLocalUri(profile.company_logo_url); }
          if (profile.coaching_types?.length) setSelectedTypes(profile.coaching_types);
          if (profile.calendar_provider) setCalendarProvider(profile.calendar_provider);
          setCoachingFormat(profile.coaching_format ?? '');
          // Prefill billing_methods array; fall back to legacy revenue_model string
          if (Array.isArray(profile.billing_methods) && profile.billing_methods.length > 0) {
            setRevenueModels(profile.billing_methods);
          } else if (profile.revenue_model) {
            setRevenueModels([profile.revenue_model]);
          }
          setActiveClientRange(profile.active_client_range ?? '');
          setPrimaryGoals(profile.primary_goals ?? []);
          // New fields
          if (profile.business_name) setBusinessName(profile.business_name);
          if (profile.kvk) setKvk(profile.kvk);
          if (profile.btw_number) setBtwNumber(profile.btw_number);
          if (profile.iban) setIban(profile.iban);
          if (profile.address) setAddress(profile.address);
          if (profile.postal_code) setPostalCode(profile.postal_code);
          if (profile.city) setCity(profile.city);
          if (profile.country) setCountry(profile.country);
          if (profile.logo_url) { setBrandLogoUrl(profile.logo_url); setBrandLogoLocalUri(profile.logo_url); }
          if (profile.primary_color) setPrimaryColor(profile.primary_color);
          if (profile.invoice_footer) setInvoiceFooter(profile.invoice_footer);
          console.log('[CoachOnboarding] Profile prefilled successfully');
        }
      } catch (err) {
        console.warn('[CoachOnboarding] Prefill failed (non-fatal):', err);
      }
    };

    checkSession();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const animateToStep = (nextStep: number) => {
    const direction = nextStep > step ? 1 : -1;
    const outX = direction * -30;
    const inX = direction * 30;

    // Animate progress bar
    Animated.timing(progressAnim, {
      toValue: ((nextStep + 1) / TOTAL_STEPS) * 100,
      duration: 300,
      useNativeDriver: false,
    }).start();

    // Fade + slide out
    Animated.parallel([
      Animated.timing(opacityAnim, {
        toValue: 0,
        duration: 110,
        useNativeDriver: true,
      }),
      Animated.timing(translateAnim, {
        toValue: outX,
        duration: 110,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setStep(nextStep);
      translateAnim.setValue(inX);
      // Fade + slide in
      Animated.parallel([
        Animated.timing(opacityAnim, {
          toValue: 1,
          duration: 220,
          useNativeDriver: true,
        }),
        Animated.timing(translateAnim, {
          toValue: 0,
          duration: 220,
          useNativeDriver: true,
        }),
      ]).start();
    });
  };

  // ── Step navigation handlers ──

  const handleStep1Next = () => {
    console.log('[CoachOnboarding] Step 1 next pressed', { companyName, website, tagline });
    if (!companyName.trim()) {
      setStep1Error('Bedrijfsnaam is verplicht.');
      return;
    }
    setStep1Error('');
    animateToStep(1);
  };

  const handleStep2Next = () => {
    console.log('[CoachOnboarding] Step 2 next pressed', { hasAvatar: !!avatarUrl });
    animateToStep(2);
  };

  const handleStep3Next = () => {
    console.log('[CoachOnboarding] Step 3 next pressed', { hasLogo: !!logoUrl });
    animateToStep(3);
  };

  const handleStep4Next = () => {
    console.log('[CoachOnboarding] Step 4 next pressed', { selectedTypes });
    if (selectedTypes.length === 0) {
      setStep4Error('Kies minimaal één type coaching.');
      return;
    }
    setStep4Error('');
    animateToStep(4);
  };

  const handleStep5Next = () => {
    console.log('[CoachOnboarding] Step 5 next pressed', { calendarProvider });
    animateToStep(5);
  };

  const handleStep6Next = () => {
    console.log('[CoachOnboarding] Step 6 next pressed', { coachingFormat, revenueModels, activeClientRange, primaryGoals });
    if (!coachingFormat || revenueModels.length === 0) {
      setStep6Error('Vul werkwijze en verdienmodel in om verder te gaan.');
      return;
    }
    setStep6Error('');
    animateToStep(6);
  };

  const handleStep6BizNext = async () => {
    console.log('[CoachOnboarding] Step 6 (Bedrijfsgegevens) next pressed', { businessName, kvk, btwNumber, iban });
    if (!businessName.trim()) {
      setStepBizError('Bedrijfsnaam is verplicht.');
      return;
    }
    setStepBizError('');
    setStepBizSaving(true);
    try {
      const { data: { session: currentSession } } = await supabase.auth.getSession();
      if (!currentSession) throw new Error('Geen sessie');
      const payload: Record<string, string> = { business_name: businessName.trim() };
      if (kvk.trim()) payload.kvk = kvk.trim();
      if (btwNumber.trim()) payload.btw_number = btwNumber.trim();
      if (iban.trim()) payload.iban = iban.trim();
      console.log('[CoachOnboarding] Saving bedrijfsgegevens:', payload);
      const { error } = await supabase.from('profiles').update(payload).eq('id', currentSession.user.id);
      if (error) throw error;
      animateToStep(7);
    } catch (err: any) {
      console.error('[CoachOnboarding] Bedrijfsgegevens save error:', err.message);
      setStepBizError(err.message || 'Opslaan mislukt. Probeer opnieuw.');
    } finally {
      setStepBizSaving(false);
    }
  };

  const handleStep7AddrNext = async () => {
    console.log('[CoachOnboarding] Step 7 (Adres) next pressed', { address, postalCode, city, country });
    setStepAddrError('');
    setStepAddrSaving(true);
    try {
      const { data: { session: currentSession } } = await supabase.auth.getSession();
      if (!currentSession) throw new Error('Geen sessie');
      const payload: Record<string, string> = {};
      if (address.trim()) payload.address = address.trim();
      if (postalCode.trim()) payload.postal_code = postalCode.trim();
      if (city.trim()) payload.city = city.trim();
      if (country.trim()) payload.country = country.trim();
      console.log('[CoachOnboarding] Saving adres:', payload);
      if (Object.keys(payload).length > 0) {
        const { error } = await supabase.from('profiles').update(payload).eq('id', currentSession.user.id);
        if (error) throw error;
      }
      animateToStep(8);
    } catch (err: any) {
      console.error('[CoachOnboarding] Adres save error:', err.message);
      setStepAddrError(err.message || 'Opslaan mislukt. Probeer opnieuw.');
    } finally {
      setStepAddrSaving(false);
    }
  };

  const handleStep8BrandNext = async () => {
    console.log('[CoachOnboarding] Step 8 (Huisstijl) next pressed', { brandLogoUrl, primaryColor, invoiceFooter });
    setStepBrandError('');
    setStepBrandSaving(true);
    try {
      const { data: { session: currentSession } } = await supabase.auth.getSession();
      if (!currentSession) throw new Error('Geen sessie');
      const payload: Record<string, string> = { primary_color: primaryColor };
      if (brandLogoUrl) payload.logo_url = brandLogoUrl;
      if (invoiceFooter.trim()) payload.invoice_footer = invoiceFooter.trim();
      console.log('[CoachOnboarding] Saving huisstijl:', payload);
      const { error } = await supabase.from('profiles').update(payload).eq('id', currentSession.user.id);
      if (error) throw error;
      animateToStep(9);
    } catch (err: any) {
      console.error('[CoachOnboarding] Huisstijl save error:', err.message);
      setStepBrandError(err.message || 'Opslaan mislukt. Probeer opnieuw.');
    } finally {
      setStepBrandSaving(false);
    }
  };

  const pickBrandLogo = async () => {
    console.log('[CoachOnboarding] Pick brand logo pressed');
    setBrandLogoError('');
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        setBrandLogoError('Geef toegang tot je fotobibliotheek om een logo te kiezen.');
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });
      if (result.canceled || !result.assets?.[0]) return;
      const asset = result.assets[0];
      setBrandLogoLocalUri(asset.uri);
      setBrandLogoUploading(true);
      console.log('[CoachOnboarding] Uploading brand logo:', asset.uri);
      const { data: { session: currentSession } } = await supabase.auth.getSession();
      const userId = currentSession?.user?.id;
      if (!userId) throw new Error('Geen sessie');
      const url = await uploadImageToStorage(asset.uri, 'company-logos', `${userId}/brand-logo.jpg`);
      setBrandLogoUrl(url);
      console.log('[CoachOnboarding] Brand logo uploaded:', url);
    } catch (err: any) {
      console.error('[CoachOnboarding] Brand logo upload error:', err.message);
      setBrandLogoError('Logo kon niet worden geüpload. Probeer opnieuw.');
      setBrandLogoLocalUri(null);
    } finally {
      setBrandLogoUploading(false);
    }
  };

  const handleBack = () => {
    console.log('[CoachOnboarding] Back pressed from step', step);
    animateToStep(step - 1);
  };

  // ── Image upload helpers ──

  const pickAvatar = async () => {
    console.log('[CoachOnboarding] Pick avatar pressed');
    setAvatarError('');
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        setAvatarError('Geef toegang tot je fotobibliotheek om een foto te kiezen.');
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.7,
      });
      if (result.canceled || !result.assets?.[0]) return;

      const asset = result.assets[0];
      setAvatarLocalUri(asset.uri);
      setAvatarUploading(true);
      console.log('[CoachOnboarding] Uploading avatar:', asset.uri);

      const { data: { session: currentSession } } = await supabase.auth.getSession();
      const userId = currentSession?.user?.id;
      if (!userId) throw new Error('Geen sessie');
      const url = await uploadImageToStorage(asset.uri, 'avatars', `${userId}/avatar.jpg`);
      setAvatarUrl(url);
      console.log('[CoachOnboarding] Avatar uploaded:', url);
    } catch (err: any) {
      console.error('[CoachOnboarding] Avatar upload error:', err.message);
      setAvatarError('Foto kon niet worden geüpload. Probeer opnieuw.');
      setAvatarLocalUri(null);
    } finally {
      setAvatarUploading(false);
    }
  };

  const pickLogo = async () => {
    console.log('[CoachOnboarding] Pick logo pressed');
    setLogoError('');
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        setLogoError('Geef toegang tot je fotobibliotheek om een logo te kiezen.');
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });
      if (result.canceled || !result.assets?.[0]) return;

      const asset = result.assets[0];
      setLogoLocalUri(asset.uri);
      setLogoUploading(true);
      console.log('[CoachOnboarding] Uploading logo:', asset.uri);

      const { data: { session: currentSession } } = await supabase.auth.getSession();
      const userId = currentSession?.user?.id;
      if (!userId) throw new Error('Geen sessie');
      const url = await uploadImageToStorage(asset.uri, 'company-logos', `${userId}/logo.jpg`);
      setLogoUrl(url);
      console.log('[CoachOnboarding] Logo uploaded:', url);
    } catch (err: any) {
      console.error('[CoachOnboarding] Logo upload error:', err.message);
      setLogoError('Logo kon niet worden geüpload. Probeer opnieuw.');
      setLogoLocalUri(null);
    } finally {
      setLogoUploading(false);
    }
  };

  // ── Coaching type toggle ──

  const toggleType = (type: string) => {
    console.log('[CoachOnboarding] Toggle coaching type:', type);
    setStep4Error('');
    setSelectedTypes(prev =>
      prev.includes(type) ? prev.filter(t => t !== type) : [...prev, type]
    );
  };

  // Log when Step 6 is active
  useEffect(() => {
    if (step === 5) {
      console.log('[CoachOnboarding] Step 6 rendered, revenueModels:', revenueModels);
    }
  }, [step, revenueModels]);

  // ── Revenue model toggle ──

  const toggleRevenueModel = (value: string) => {
    console.log('[CoachOnboarding] Toggle revenue model:', value);
    setRevenueModels(prev =>
      prev.includes(value) ? prev.filter(v => v !== value) : [...prev, value]
    );
    setStep6Error('');
  };

  // ── Primary goals toggle ──

  const toggleGoal = (value: string) => {
    console.log('[CoachOnboarding] Toggle primary goal:', value);
    setPrimaryGoals(prev =>
      prev.includes(value) ? prev.filter(g => g !== value) : [...prev, value]
    );
  };

  // ── Final save ──

  const handleFinish = async () => {
    console.log('[CoachOnboarding] Finish pressed — saving profile');
    setSaveError('');
    setSaving(true);

    try {
      const { data: { session: currentSession } } = await supabase.auth.getSession();

      if (!currentSession) {
        setSaveError('Geen actieve sessie gevonden. Log opnieuw in.');
        setSaving(false);
        return;
      }

      const userId = currentSession.user.id;

      const finalTypes = selectedTypes.includes('Anders, namelijk…') && customType.trim()
        ? [...selectedTypes.filter(t => t !== 'Anders, namelijk…'), customType.trim()]
        : selectedTypes;

      const updatePayload = {
        company_name: companyName.trim() || null,
        company_logo_url: logoUrl || null,
        coaching_types: finalTypes.length > 0 ? finalTypes : null,
        calendar_provider: calendarProvider || null,
        calendar_connected: false,
        avatar_url: avatarUrl || null,
        coaching_format: coachingFormat || null,
        billing_methods: revenueModels.length > 0 ? revenueModels : null,
        revenue_model: revenueModels[0] || null, // keep legacy column populated with first selection
        active_client_range: activeClientRange || null,
        primary_goals: primaryGoals.length > 0 ? primaryGoals : null,
      };

      console.log('[CoachOnboarding] Supabase update payload for user', userId, ':', updatePayload);

      const { error } = await supabase
        .from('profiles')
        .update(updatePayload)
        .eq('id', userId);

      if (error) throw error;

      console.log('[CoachOnboarding] Profile saved successfully, advancing to Bedrijfsgegevens step');
      animateToStep(6);
    } catch (err: any) {
      console.error('[CoachOnboarding] Save error:', err.message);
      setSaveError(err.message || 'Er is een fout opgetreden. Probeer opnieuw.');
    } finally {
      setSaving(false);
    }
  };

  const handleStripeConnect = async () => {
    console.log('[CoachOnboarding] Stripe koppelen pressed — navigating to Stripe Connect screen');
    setStripeLoading(true);
    try {
      router.push({
        pathname: '/stripe-onboarding-webview',
        params: { returnTo: 'onboarding' },
      });
    } finally {
      setStripeLoading(false);
    }
  };



  // ── Loading guard ──

  if (authLoading) {
    return (
      <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]} edges={['top', 'bottom']}>
        <ActivityIndicator style={{ flex: 1 }} color={bcctColors.primaryOrange} />
      </SafeAreaView>
    );
  }

  // ── Derived values for display ──

  const stepLabel = `Stap ${Math.min(step + 1, TOTAL_STEPS)} van ${TOTAL_STEPS}`;
  const andersSelected = selectedTypes.includes('Anders, namelijk…');

  const progressWidth = progressAnim.interpolate({
    inputRange: [0, 100],
    outputRange: ['0%', '100%'],
  });

  const isCompletionScreen = step === 10;

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]} edges={['top', 'bottom']}>
      {/* Progress header — hidden on final completion screen */}
      {!isCompletionScreen && (
        <View style={styles.progressHeader}>
          <View style={styles.progressLabelRow}>
            <Text style={[styles.progressLabel, { color: bcctColors.textSecondary }]}>{stepLabel}</Text>
          </View>
          <View style={[styles.progressTrack, { backgroundColor: bcctColors.borderGray }]}>
            <Animated.View
              style={[styles.progressFill, { width: progressWidth, backgroundColor: bcctColors.primaryOrange }]}
            />
          </View>
        </View>
      )}

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={0}
      >
        <Animated.View
          style={[
            styles.flex,
            {
              opacity: opacityAnim,
              transform: [{ translateX: translateAnim }],
            },
          ]}
        >
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >

            {/* ══════════════════════════════════════
                STEP 1 — Bedrijfsinformatie
            ══════════════════════════════════════ */}
            {step === 0 && (
              <View style={styles.stepContent}>
                <Text style={[styles.stepTitle, { color: colors.text }]}>Bedrijfsinformatie</Text>
                <Text style={[styles.stepSubtitle, { color: bcctColors.textSecondary }]}>
                  Vertel ons over je praktijk of bedrijf.
                </Text>

                <View style={styles.form}>
                  <View style={styles.inputGroup}>
                    <Text style={[styles.label, { color: colors.text }]}>
                      Bedrijfsnaam <Text style={{ color: bcctColors.error }}>*</Text>
                    </Text>
                    <TextInput
                      style={[styles.input, { backgroundColor: colors.card, color: colors.text, borderColor: step1Error ? bcctColors.error : colors.border }]}
                      placeholder="Bijv. Coaching by Patricia"
                      placeholderTextColor={bcctColors.textSecondary}
                      value={companyName}
                      onChangeText={v => { setCompanyName(v); setStep1Error(''); }}
                      autoCapitalize="words"
                      returnKeyType="next"
                    />
                    {!!step1Error && (
                      <Text style={styles.fieldError}>{step1Error}</Text>
                    )}
                  </View>

                  <View style={styles.inputGroup}>
                    <Text style={[styles.label, { color: colors.text }]}>Website</Text>
                    <TextInput
                      style={[styles.input, { backgroundColor: colors.card, color: colors.text, borderColor: colors.border }]}
                      placeholder="https://www.jouwwebsite.nl"
                      placeholderTextColor={bcctColors.textSecondary}
                      value={website}
                      onChangeText={setWebsite}
                      keyboardType="url"
                      autoCapitalize="none"
                      autoCorrect={false}
                      returnKeyType="next"
                    />
                  </View>

                  <View style={styles.inputGroup}>
                    <Text style={[styles.label, { color: colors.text }]}>Tagline / praktijknaam</Text>
                    <TextInput
                      style={[styles.input, { backgroundColor: colors.card, color: colors.text, borderColor: colors.border }]}
                      placeholder="Bijv. Jouw gids naar balans"
                      placeholderTextColor={bcctColors.textSecondary}
                      value={tagline}
                      onChangeText={setTagline}
                      autoCapitalize="sentences"
                      returnKeyType="done"
                    />
                  </View>
                </View>

                <PrimaryButton label="Volgende" onPress={handleStep1Next} />
              </View>
            )}

            {/* ══════════════════════════════════════
                STEP 2 — Profielfoto
            ══════════════════════════════════════ */}
            {step === 1 && (
              <View style={styles.stepContent}>
                <Text style={[styles.stepTitle, { color: colors.text }]}>Jouw profielfoto</Text>
                <Text style={[styles.stepSubtitle, { color: bcctColors.textSecondary }]}>
                  Zo herkennen cliënten jou.
                </Text>

                <View style={styles.imagePickerSection}>
                  <TouchableOpacity
                    style={[styles.avatarCircle, { borderColor: avatarLocalUri ? bcctColors.primaryOrange : colors.border }]}
                    onPress={pickAvatar}
                    activeOpacity={0.8}
                    disabled={avatarUploading}
                  >
                    {avatarLocalUri ? (
                      <Image source={resolveImageSource(avatarLocalUri)} style={styles.avatarImage} />
                    ) : (
                      <View style={[styles.avatarPlaceholder, { backgroundColor: colors.card }]}>
                        <Ionicons name="person-outline" size={48} color={bcctColors.textSecondary} />
                      </View>
                    )}
                    {avatarUploading ? (
                      <View style={styles.imageOverlay}>
                        <ActivityIndicator color="#fff" />
                      </View>
                    ) : (
                      <View style={[styles.cameraBadge, { backgroundColor: bcctColors.primaryOrange }]}>
                        <Ionicons name="camera" size={14} color="#fff" />
                      </View>
                    )}
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.uploadButton, { borderColor: bcctColors.primaryOrange }]}
                    onPress={pickAvatar}
                    disabled={avatarUploading}
                    activeOpacity={0.8}
                  >
                    {avatarUploading ? (
                      <ActivityIndicator size="small" color={bcctColors.primaryOrange} />
                    ) : (
                      <Text style={[styles.uploadButtonText, { color: bcctColors.primaryOrange }]}>
                        Foto uploaden
                      </Text>
                    )}
                  </TouchableOpacity>

                  {!!avatarError && <Text style={styles.fieldError}>{avatarError}</Text>}
                </View>

                <PrimaryButton label="Volgende" onPress={handleStep2Next} disabled={avatarUploading} />
                <SkipLink onPress={() => { console.log('[CoachOnboarding] Skip avatar pressed'); animateToStep(2); }} />
                <BackButton onPress={handleBack} />
              </View>
            )}

            {/* ══════════════════════════════════════
                STEP 3 — Bedrijfslogo
            ══════════════════════════════════════ */}
            {step === 2 && (
              <View style={styles.stepContent}>
                <Text style={[styles.stepTitle, { color: colors.text }]}>Bedrijfslogo</Text>
                <Text style={[styles.stepSubtitle, { color: bcctColors.textSecondary }]}>
                  Optioneel — verschijnt op jouw coachprofiel.
                </Text>

                <View style={styles.imagePickerSection}>
                  <TouchableOpacity
                    style={[styles.logoCircle, { borderColor: logoLocalUri ? bcctColors.primaryOrange : colors.border, backgroundColor: colors.card }]}
                    onPress={pickLogo}
                    activeOpacity={0.8}
                    disabled={logoUploading}
                  >
                    {logoLocalUri ? (
                      <Image source={resolveImageSource(logoLocalUri)} style={styles.logoImage} />
                    ) : (
                      <Ionicons name="business-outline" size={48} color={bcctColors.textSecondary} />
                    )}
                    {logoUploading && (
                      <View style={styles.imageOverlay}>
                        <ActivityIndicator color="#fff" />
                      </View>
                    )}
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.uploadButton, { borderColor: bcctColors.primaryOrange }]}
                    onPress={pickLogo}
                    disabled={logoUploading}
                    activeOpacity={0.8}
                  >
                    {logoUploading ? (
                      <ActivityIndicator size="small" color={bcctColors.primaryOrange} />
                    ) : (
                      <Text style={[styles.uploadButtonText, { color: bcctColors.primaryOrange }]}>
                        Logo uploaden
                      </Text>
                    )}
                  </TouchableOpacity>

                  {!!logoError && <Text style={styles.fieldError}>{logoError}</Text>}
                </View>

                <PrimaryButton label="Volgende" onPress={handleStep3Next} disabled={logoUploading} />
                <SkipLink onPress={() => { console.log('[CoachOnboarding] Skip logo pressed'); animateToStep(3); }} />
                <BackButton onPress={handleBack} />
              </View>
            )}

            {/* ══════════════════════════════════════
                STEP 4 — Type coaching
            ══════════════════════════════════════ */}
            {step === 3 && (
              <View style={styles.stepContent}>
                <Text style={[styles.stepTitle, { color: colors.text }]}>Wat voor coaching bied jij aan?</Text>
                <Text style={[styles.stepSubtitle, { color: bcctColors.textSecondary }]}>
                  Kies één of meerdere.
                </Text>

                <View style={styles.chipsContainer}>
                  {COACHING_TYPES.map(type => {
                    const isSelected = selectedTypes.includes(type);
                    return (
                      <TouchableOpacity
                        key={type}
                        style={[
                          styles.chip,
                          {
                            backgroundColor: isSelected ? bcctColors.primaryOrange : colors.card,
                            borderColor: isSelected ? bcctColors.primaryOrange : colors.border,
                          },
                        ]}
                        onPress={() => toggleType(type)}
                        activeOpacity={0.8}
                      >
                        <Text style={[styles.chipText, { color: isSelected ? '#fff' : colors.text }]}>
                          {type}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                {andersSelected && (
                  <View style={[styles.inputGroup, { marginTop: 12 }]}>
                    <Text style={[styles.label, { color: colors.text }]}>Omschrijf je coaching</Text>
                    <TextInput
                      style={[styles.input, { backgroundColor: colors.card, color: colors.text, borderColor: colors.border }]}
                      placeholder="Bijv. Rouwverwerking coaching"
                      placeholderTextColor={bcctColors.textSecondary}
                      value={customType}
                      onChangeText={setCustomType}
                      autoCapitalize="sentences"
                      returnKeyType="done"
                    />
                  </View>
                )}

                {!!step4Error && <Text style={[styles.fieldError, { marginBottom: 8 }]}>{step4Error}</Text>}

                <PrimaryButton label="Volgende" onPress={handleStep4Next} />
                <BackButton onPress={handleBack} />
              </View>
            )}

            {/* ══════════════════════════════════════
                STEP 5 — Agenda koppelen
            ══════════════════════════════════════ */}
            {step === 4 && (
              <View style={styles.stepContent}>
                <Text style={[styles.stepTitle, { color: colors.text }]}>Koppel je agenda</Text>
                <Text style={[styles.stepSubtitle, { color: bcctColors.textSecondary }]}>
                  Zo kunnen cliënten direct een afspraak inplannen.
                </Text>

                <View style={styles.calendarOptions}>
                  {CALENDAR_OPTIONS.map(option => {
                    const isSelected = calendarProvider === option.key;
                    return (
                      <TouchableOpacity
                        key={option.key}
                        style={[
                          styles.calendarCard,
                          {
                            backgroundColor: colors.card,
                            borderColor: isSelected ? bcctColors.primaryOrange : colors.border,
                          },
                        ]}
                        onPress={() => {
                          console.log('[CoachOnboarding] Calendar option selected:', option.key);
                          setCalendarProvider(isSelected ? null : option.key);
                        }}
                        activeOpacity={0.8}
                      >
                        <View style={[styles.calendarIconWrap, { backgroundColor: isSelected ? `${bcctColors.primaryOrange}18` : `${colors.border}60` }]}>
                          <Ionicons name={option.icon} size={24} color={isSelected ? bcctColors.primaryOrange : bcctColors.textSecondary} />
                        </View>
                        <Text style={[styles.calendarLabel, { color: colors.text }]}>{option.label}</Text>
                        <View style={styles.comingSoonBadge}>
                          <Text style={styles.comingSoonText}>Binnenkort</Text>
                        </View>
                        {isSelected && (
                          <Ionicons name="checkmark-circle" size={20} color={bcctColors.primaryOrange} style={{ marginLeft: 4 }} />
                        )}
                      </TouchableOpacity>
                    );
                  })}
                </View>

                <PrimaryButton label="Volgende" onPress={handleStep5Next} />
                <SkipLink onPress={() => { console.log('[CoachOnboarding] Skip calendar pressed'); setCalendarProvider(null); animateToStep(5); }} />
                <BackButton onPress={handleBack} />
              </View>
            )}

            {/* ══════════════════════════════════════
                STEP 6 — Werkwijze & Verdienmodel
            ══════════════════════════════════════ */}
            {step === 5 && (
              <View style={styles.stepContent}>
                <Text style={[styles.stepTitle, { color: colors.text }]}>Hoe werk jij met cliënten?</Text>
                <Text style={[styles.stepSubtitle, { color: bcctColors.textSecondary }]}>
                  Dit helpt ons de app op jou af te stemmen.
                </Text>

                {/* Vraag 1 — Werkwijze */}
                <View style={styles.questionBlock}>
                  <Text style={[styles.label, { color: colors.text }]}>
                    Hoe coach jij? <Text style={{ color: bcctColors.error }}>*</Text>
                  </Text>
                  <View style={styles.chipsRow}>
                    {COACHING_FORMAT_OPTIONS.map(opt => {
                      const isSelected = coachingFormat === opt.value;
                      return (
                        <TouchableOpacity
                          key={opt.value}
                          style={[
                            styles.chip,
                            {
                              backgroundColor: isSelected ? bcctColors.primaryOrange : '#fff',
                              borderColor: isSelected ? bcctColors.primaryOrange : bcctColors.borderGray,
                            },
                          ]}
                          onPress={() => {
                            console.log('[CoachOnboarding] Coaching format selected:', opt.value);
                            setCoachingFormat(opt.value);
                            setStep6Error('');
                          }}
                          activeOpacity={0.8}
                        >
                          <Text style={[styles.chipText, { color: isSelected ? '#fff' : bcctColors.textPrimary }]}>
                            {opt.label}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>

                {/* Vraag 2 — Verdienmodel */}
                <View style={styles.questionBlock}>
                  <Text style={[styles.label, { color: colors.text }]}>
                    Hoe factureer jij? (meerdere mogelijk) <Text style={{ color: bcctColors.error }}>*</Text>
                  </Text>
                  <View style={styles.chipsRow}>
                    {REVENUE_MODEL_OPTIONS.map(opt => {
                      const isSelected = revenueModels.includes(opt.value);
                      return (
                        <TouchableOpacity
                          key={opt.value}
                          style={[
                            styles.chip,
                            {
                              backgroundColor: isSelected ? bcctColors.primaryOrange : '#fff',
                              borderColor: isSelected ? bcctColors.primaryOrange : bcctColors.borderGray,
                            },
                          ]}
                          onPress={() => toggleRevenueModel(opt.value)}
                          activeOpacity={0.8}
                        >
                          <Text style={[styles.chipText, { color: isSelected ? '#fff' : bcctColors.textPrimary }]}>
                            {opt.label}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>

                {/* Vraag 3 — Actieve cliënten */}
                <View style={styles.questionBlock}>
                  <Text style={[styles.label, { color: colors.text }]}>
                    Hoeveel actieve cliënten heb je gemiddeld?
                  </Text>
                  <View style={styles.chipsRow}>
                    {ACTIVE_CLIENT_RANGE_OPTIONS.map(opt => {
                      const isSelected = activeClientRange === opt.value;
                      return (
                        <TouchableOpacity
                          key={opt.value}
                          style={[
                            styles.chip,
                            {
                              backgroundColor: isSelected ? bcctColors.primaryOrange : '#fff',
                              borderColor: isSelected ? bcctColors.primaryOrange : bcctColors.borderGray,
                            },
                          ]}
                          onPress={() => {
                            console.log('[CoachOnboarding] Active client range selected:', opt.value);
                            setActiveClientRange(isSelected ? '' : opt.value);
                          }}
                          activeOpacity={0.8}
                        >
                          <Text style={[styles.chipText, { color: isSelected ? '#fff' : bcctColors.textPrimary }]}>
                            {opt.label}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>

                {/* Vraag 4 — Doelen */}
                <View style={styles.questionBlock}>
                  <Text style={[styles.label, { color: colors.text }]}>
                    Wat wil je verbeteren met deze app?
                  </Text>
                  <View style={styles.chipsRow}>
                    {PRIMARY_GOALS_OPTIONS.map(opt => {
                      const isSelected = primaryGoals.includes(opt.value);
                      return (
                        <TouchableOpacity
                          key={opt.value}
                          style={[
                            styles.chip,
                            {
                              backgroundColor: isSelected ? bcctColors.primaryOrange : '#fff',
                              borderColor: isSelected ? bcctColors.primaryOrange : bcctColors.borderGray,
                            },
                          ]}
                          onPress={() => toggleGoal(opt.value)}
                          activeOpacity={0.8}
                        >
                          <Text style={[styles.chipText, { color: isSelected ? '#fff' : bcctColors.textPrimary }]}>
                            {opt.label}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>

                {!!step6Error && (
                  <Text style={[styles.fieldError, { marginBottom: 12 }]}>{step6Error}</Text>
                )}

                <PrimaryButton label="Volgende" onPress={handleStep6Next} />
                <BackButton onPress={handleBack} />
              </View>
            )}

            {/* ══════════════════════════════════════
                STEP 7 — Bedrijfsgegevens
            ══════════════════════════════════════ */}
            {step === 6 && (
              <View style={styles.stepContent}>
                <Text style={[styles.stepTitle, { color: colors.text }]}>Bedrijfsgegevens</Text>
                <Text style={[styles.stepSubtitle, { color: bcctColors.textSecondary }]}>
                  Deze gegevens worden gebruikt op facturen en in je profiel.
                </Text>

                <View style={styles.form}>
                  <View style={styles.inputGroup}>
                    <Text style={[styles.label, { color: colors.text }]}>
                      Bedrijfsnaam <Text style={{ color: bcctColors.error }}>*</Text>
                    </Text>
                    <TextInput
                      style={[styles.input, { backgroundColor: colors.card, color: colors.text, borderColor: stepBizError ? bcctColors.error : colors.border }]}
                      placeholder="Bijv. Coaching by Patricia"
                      placeholderTextColor={bcctColors.textSecondary}
                      value={businessName}
                      onChangeText={v => { setBusinessName(v); setStepBizError(''); }}
                      autoCapitalize="words"
                      returnKeyType="next"
                    />
                    {!!stepBizError && <Text style={styles.fieldError}>{stepBizError}</Text>}
                  </View>

                  <View style={styles.inputGroup}>
                    <Text style={[styles.label, { color: colors.text }]}>KVK-nummer</Text>
                    <TextInput
                      style={[styles.input, { backgroundColor: colors.card, color: colors.text, borderColor: colors.border }]}
                      placeholder="12345678"
                      placeholderTextColor={bcctColors.textSecondary}
                      value={kvk}
                      onChangeText={setKvk}
                      keyboardType="numeric"
                      returnKeyType="next"
                    />
                  </View>

                  <View style={styles.inputGroup}>
                    <Text style={[styles.label, { color: colors.text }]}>BTW-nummer</Text>
                    <TextInput
                      style={[styles.input, { backgroundColor: colors.card, color: colors.text, borderColor: colors.border }]}
                      placeholder="NL000000000B01"
                      placeholderTextColor={bcctColors.textSecondary}
                      value={btwNumber}
                      onChangeText={setBtwNumber}
                      autoCapitalize="characters"
                      autoCorrect={false}
                      returnKeyType="next"
                    />
                  </View>

                  <View style={styles.inputGroup}>
                    <Text style={[styles.label, { color: colors.text }]}>IBAN</Text>
                    <TextInput
                      style={[styles.input, { backgroundColor: colors.card, color: colors.text, borderColor: colors.border }]}
                      placeholder="NL00 BANK 0000 0000 00"
                      placeholderTextColor={bcctColors.textSecondary}
                      value={iban}
                      onChangeText={setIban}
                      autoCapitalize="characters"
                      autoCorrect={false}
                      returnKeyType="done"
                    />
                  </View>
                </View>

                <PrimaryButton label="Volgende" onPress={handleStep6BizNext} disabled={stepBizSaving} />
                <SkipLink onPress={() => { console.log('[CoachOnboarding] Skip bedrijfsgegevens pressed'); animateToStep(7); }} />
                <BackButton onPress={handleBack} />
              </View>
            )}

            {/* ══════════════════════════════════════
                STEP 8 — Adres
            ══════════════════════════════════════ */}
            {step === 7 && (
              <View style={styles.stepContent}>
                <Text style={[styles.stepTitle, { color: colors.text }]}>Adres</Text>
                <Text style={[styles.stepSubtitle, { color: bcctColors.textSecondary }]}>
                  Optioneel — verschijnt op facturen als bedrijfsadres.
                </Text>

                <View style={styles.form}>
                  <View style={styles.inputGroup}>
                    <Text style={[styles.label, { color: colors.text }]}>Straat + huisnummer</Text>
                    <TextInput
                      style={[styles.input, { backgroundColor: colors.card, color: colors.text, borderColor: colors.border }]}
                      placeholder="Bijv. Keizersgracht 123"
                      placeholderTextColor={bcctColors.textSecondary}
                      value={address}
                      onChangeText={setAddress}
                      autoCapitalize="words"
                      returnKeyType="next"
                    />
                  </View>

                  <View style={styles.addrRow}>
                    <View style={[styles.inputGroup, { flex: 1 }]}>
                      <Text style={[styles.label, { color: colors.text }]}>Postcode</Text>
                      <TextInput
                        style={[styles.input, { backgroundColor: colors.card, color: colors.text, borderColor: colors.border }]}
                        placeholder="1234 AB"
                        placeholderTextColor={bcctColors.textSecondary}
                        value={postalCode}
                        onChangeText={setPostalCode}
                        autoCapitalize="characters"
                        autoCorrect={false}
                        returnKeyType="next"
                      />
                    </View>
                    <View style={[styles.inputGroup, { flex: 2 }]}>
                      <Text style={[styles.label, { color: colors.text }]}>Stad</Text>
                      <TextInput
                        style={[styles.input, { backgroundColor: colors.card, color: colors.text, borderColor: colors.border }]}
                        placeholder="Amsterdam"
                        placeholderTextColor={bcctColors.textSecondary}
                        value={city}
                        onChangeText={setCity}
                        autoCapitalize="words"
                        returnKeyType="next"
                      />
                    </View>
                  </View>

                  <View style={styles.inputGroup}>
                    <Text style={[styles.label, { color: colors.text }]}>Land</Text>
                    <TextInput
                      style={[styles.input, { backgroundColor: colors.card, color: colors.text, borderColor: colors.border }]}
                      placeholder="NL"
                      placeholderTextColor={bcctColors.textSecondary}
                      value={country}
                      onChangeText={setCountry}
                      autoCapitalize="characters"
                      autoCorrect={false}
                      returnKeyType="done"
                    />
                  </View>
                </View>

                {!!stepAddrError && <Text style={[styles.fieldError, { marginBottom: 12 }]}>{stepAddrError}</Text>}

                <PrimaryButton label="Volgende" onPress={handleStep7AddrNext} disabled={stepAddrSaving} />
                <SkipLink onPress={() => { console.log('[CoachOnboarding] Skip adres pressed'); animateToStep(8); }} />
                <BackButton onPress={handleBack} />
              </View>
            )}

            {/* ══════════════════════════════════════
                STEP 9 — Huisstijl
            ══════════════════════════════════════ */}
            {step === 8 && (
              <View style={styles.stepContent}>
                <Text style={[styles.stepTitle, { color: colors.text }]}>Huisstijl</Text>
                <Text style={[styles.stepSubtitle, { color: bcctColors.textSecondary }]}>
                  Personaliseer je facturen en profiel met jouw branding.
                </Text>

                {/* Logo upload */}
                <View style={styles.inputGroup}>
                  <Text style={[styles.label, { color: colors.text }]}>Logo</Text>
                  <View style={styles.brandLogoRow}>
                    <TouchableOpacity
                      style={[styles.brandLogoBox, { borderColor: brandLogoLocalUri ? bcctColors.primaryOrange : colors.border, backgroundColor: colors.card }]}
                      onPress={pickBrandLogo}
                      disabled={brandLogoUploading}
                      activeOpacity={0.8}
                    >
                      {brandLogoLocalUri ? (
                        <Image source={resolveImageSource(brandLogoLocalUri)} style={styles.brandLogoImage} />
                      ) : (
                        <Ionicons name="image-outline" size={32} color={bcctColors.textSecondary} />
                      )}
                      {brandLogoUploading && (
                        <View style={[styles.imageOverlay, { borderRadius: 12 }]}>
                          <ActivityIndicator color="#fff" />
                        </View>
                      )}
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.uploadButton, { borderColor: bcctColors.primaryOrange }]}
                      onPress={pickBrandLogo}
                      disabled={brandLogoUploading}
                      activeOpacity={0.8}
                    >
                      {brandLogoUploading ? (
                        <ActivityIndicator size="small" color={bcctColors.primaryOrange} />
                      ) : (
                        <Text style={[styles.uploadButtonText, { color: bcctColors.primaryOrange }]}>
                          Logo uploaden
                        </Text>
                      )}
                    </TouchableOpacity>
                  </View>
                  {!!brandLogoError && <Text style={styles.fieldError}>{brandLogoError}</Text>}
                </View>

                {/* Color picker */}
                <View style={[styles.inputGroup, { marginTop: 24 }]}>
                  <Text style={[styles.label, { color: colors.text }]}>Primaire kleur</Text>
                  <View style={styles.colorSwatchRow}>
                    {BRAND_COLORS.map(color => {
                      const isSelected = primaryColor === color;
                      return (
                        <TouchableOpacity
                          key={color}
                          style={[
                            styles.colorSwatch,
                            { backgroundColor: color },
                            isSelected && styles.colorSwatchSelected,
                          ]}
                          onPress={() => {
                            console.log('[CoachOnboarding] Primary color selected:', color);
                            setPrimaryColor(color);
                          }}
                          activeOpacity={0.8}
                        >
                          {isSelected && (
                            <Ionicons name="checkmark" size={16} color="#fff" />
                          )}
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                  <View style={[styles.colorPreviewBar, { backgroundColor: primaryColor }]} />
                </View>

                {/* Invoice footer */}
                <View style={[styles.inputGroup, { marginTop: 24 }]}>
                  <Text style={[styles.label, { color: colors.text }]}>Factuurvoetnoot</Text>
                  <TextInput
                    style={[styles.input, styles.textArea, { backgroundColor: colors.card, color: colors.text, borderColor: colors.border }]}
                    placeholder="Bijv. Bedankt voor uw vertrouwen. Betaling binnen 14 dagen."
                    placeholderTextColor={bcctColors.textSecondary}
                    value={invoiceFooter}
                    onChangeText={setInvoiceFooter}
                    multiline
                    numberOfLines={3}
                    autoCapitalize="sentences"
                    returnKeyType="default"
                  />
                </View>

                {!!stepBrandError && <Text style={[styles.fieldError, { marginTop: 8, marginBottom: 4 }]}>{stepBrandError}</Text>}

                <View style={{ marginTop: 32 }}>
                  <PrimaryButton label="Volgende" onPress={handleStep8BrandNext} disabled={stepBrandSaving || brandLogoUploading} />
                  <SkipLink onPress={() => { console.log('[CoachOnboarding] Skip huisstijl pressed'); animateToStep(9); }} />
                  <BackButton onPress={handleBack} />
                </View>
              </View>
            )}

            {/* ══════════════════════════════════════
                STEP 10 — Stripe Connect
            ══════════════════════════════════════ */}
            {step === 9 && (
              <View style={[styles.stepContent, styles.stripeStep]}>
                <View style={[styles.stripeIconWrap, { backgroundColor: bcctColors.primaryOrange + '18' }]}>
                  <Ionicons name="card-outline" size={56} color={bcctColors.primaryOrange} />
                </View>

                <Text style={[styles.finishTitle, { color: colors.text }]}>Koppel je Stripe account</Text>
                <Text style={[styles.stepSubtitle, { color: bcctColors.textSecondary, textAlign: 'center' }]}>
                  Ontvang betalingen van cliënten en stuur eenvoudig betaallinks of facturen.
                </Text>

                {!!stripeError && (
                  <View style={styles.saveErrorBox}>
                    <Text style={styles.saveErrorText}>{stripeError}</Text>
                  </View>
                )}

                <TouchableOpacity
                  style={[styles.primaryButtonContainer, stripeLoading && styles.buttonDisabled]}
                  onPress={handleStripeConnect}
                  disabled={stripeLoading}
                  activeOpacity={0.9}
                >
                  <LinearGradient
                    colors={stripeLoading
                      ? [bcctColors.primaryOrangeDisabled, bcctColors.primaryOrangeDisabled]
                      : [bcctColors.primaryOrange, bcctColors.primaryOrangeDark]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.primaryButton}
                  >
                    {stripeLoading ? (
                      <>
                        <ActivityIndicator color="#fff" />
                        <Text style={styles.primaryButtonText}>Bezig...</Text>
                      </>
                    ) : (
                      <Text style={styles.primaryButtonText}>Stripe koppelen</Text>
                    )}
                  </LinearGradient>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.skipLink}
                  onPress={() => { console.log('[CoachOnboarding] Later instellen pressed — advancing to completion'); animateToStep(10); }}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.skipText, { color: bcctColors.textSecondary }]}>Later instellen</Text>
                </TouchableOpacity>
                <BackButton onPress={handleBack} />
              </View>
            )}

            {/* ══════════════════════════════════════
                STEP 10 (index 10) — Alles staat klaar
            ══════════════════════════════════════ */}
            {step === 10 && (
              <View style={[styles.stepContent, styles.finishStep]}>
                <View style={[styles.stripeIconWrap, { backgroundColor: bcctColors.primaryOrange + '18', marginBottom: 24 }]}>
                  <Ionicons name="rocket-outline" size={56} color={bcctColors.primaryOrange} />
                </View>

                <Text style={[styles.finishTitle, { color: colors.text }]}>Alles staat klaar</Text>
                <Text style={styles.finishEmoji}>🚀</Text>
                <Text style={[styles.stepSubtitle, { color: bcctColors.textSecondary, textAlign: 'center' }]}>
                  Je kunt nu starten met coachen en betalingen ontvangen.
                </Text>

                <PrimaryButton
                  label="Naar dashboard"
                  onPress={async () => {
                    console.log('[CoachOnboarding] Naar dashboard pressed — persisting onboarding_completed');
                    try {
                      const { data: { session: currentSession } } = await supabase.auth.getSession();
                      if (currentSession?.user?.id) {
                        const { error } = await supabase
                          .from('profiles')
                          .update({
                            onboarding_completed: true,
                            role: 'coach',
                            updated_at: new Date().toISOString(),
                          })
                          .eq('id', currentSession.user.id);
                        if (error) {
                          console.error('[CoachOnboarding] Failed to mark onboarding_completed:', error.message);
                        } else {
                          console.log('[CoachOnboarding] onboarding_completed=true saved for user:', currentSession.user.id);
                        }
                      }
                    } catch (err: any) {
                      console.error('[CoachOnboarding] Error persisting onboarding_completed:', err.message);
                    }
                    router.replace('/(app)/coach');
                  }}
                />
              </View>
            )}

          </ScrollView>
        </Animated.View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ── Shared sub-components ──

function PrimaryButton({ label, onPress, disabled }: { label: string; onPress: () => void; disabled?: boolean }) {
  return (
    <TouchableOpacity
      style={[styles.primaryButtonContainer, disabled && styles.buttonDisabled]}
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.9}
    >
      <LinearGradient
        colors={disabled
          ? [bcctColors.primaryOrangeDisabled, bcctColors.primaryOrangeDisabled]
          : [bcctColors.primaryOrange, bcctColors.primaryOrangeDark]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={styles.primaryButton}
      >
        <Text style={styles.primaryButtonText}>{label}</Text>
      </LinearGradient>
    </TouchableOpacity>
  );
}

function SkipLink({ onPress }: { onPress: () => void }) {
  return (
    <TouchableOpacity style={styles.skipLink} onPress={onPress} activeOpacity={0.7}>
      <Text style={[styles.skipText, { color: bcctColors.textSecondary }]}>Overslaan</Text>
    </TouchableOpacity>
  );
}

function BackButton({ onPress }: { onPress: () => void }) {
  return (
    <TouchableOpacity style={styles.backButton} onPress={onPress} activeOpacity={0.7}>
      <Ionicons name="chevron-back" size={16} color={bcctColors.textSecondary} />
      <Text style={[styles.backText, { color: bcctColors.textSecondary }]}>Terug</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  flex: { flex: 1 },

  progressHeader: {
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 12,
    gap: 8,
  },
  progressLabelRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  progressLabel: {
    ...bcctTypography.small,
  },
  progressTrack: {
    height: 4,
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: 4,
    borderRadius: 2,
  },

  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 48,
  },
  stepContent: {
    flex: 1,
  },
  stepTitle: {
    ...bcctTypography.h2,
    marginBottom: 8,
  },
  stepSubtitle: {
    ...bcctTypography.body,
    marginBottom: 32,
  },

  form: {
    gap: 20,
    marginBottom: 32,
  },
  inputGroup: {
    gap: 8,
  },
  label: {
    ...bcctTypography.label,
  },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    ...bcctTypography.body,
  },
  fieldError: {
    ...bcctTypography.small,
    color: bcctColors.error,
    marginTop: 4,
  },

  imagePickerSection: {
    alignItems: 'center',
    gap: 20,
    marginBottom: 32,
  },
  avatarCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 2,
    overflow: 'visible',
    position: 'relative',
  },
  avatarImage: {
    width: 120,
    height: 120,
    borderRadius: 60,
  },
  avatarPlaceholder: {
    width: 120,
    height: 120,
    borderRadius: 60,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoCircle: {
    width: 120,
    height: 120,
    borderRadius: 16,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  logoImage: {
    width: 120,
    height: 120,
    resizeMode: 'contain',
  },
  imageOverlay: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 60,
    backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cameraBadge: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#fff',
  },
  uploadButton: {
    borderWidth: 1.5,
    borderRadius: 12,
    paddingHorizontal: 24,
    paddingVertical: 12,
    minWidth: 160,
    alignItems: 'center',
  },
  uploadButtonText: {
    ...bcctTypography.bodyMedium,
  },

  chipsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 24,
  },
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 10,
  },
  chip: {
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  chipText: {
    ...bcctTypography.small,
    fontWeight: '500',
  },

  questionBlock: {
    marginBottom: 28,
  },

  calendarOptions: {
    gap: 12,
    marginBottom: 32,
  },
  calendarCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderRadius: 14,
    padding: 16,
    gap: 12,
  },
  calendarIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  calendarLabel: {
    ...bcctTypography.bodyMedium,
    flex: 1,
  },
  comingSoonBadge: {
    backgroundColor: `${bcctColors.primaryOrange}22`,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  comingSoonText: {
    ...bcctTypography.small,
    color: bcctColors.primaryOrange,
    fontWeight: '600',
    fontSize: 11,
  },

  finishStep: {
    alignItems: 'center',
    paddingTop: 32,
  },
  checkmarkWrap: {
    marginBottom: 16,
  },
  finishTitle: {
    ...bcctTypography.h1,
    textAlign: 'center',
  },
  finishEmoji: {
    fontSize: 36,
    marginBottom: 12,
    textAlign: 'center',
  },
  saveErrorBox: {
    backgroundColor: `${bcctColors.error}18`,
    borderRadius: 10,
    padding: 12,
    marginBottom: 16,
    width: '100%',
  },
  saveErrorText: {
    ...bcctTypography.small,
    color: bcctColors.error,
    textAlign: 'center',
  },

  primaryButtonContainer: {
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 4,
    width: '100%',
  },
  primaryButton: {
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonText: {
    color: '#fff',
    ...bcctTypography.button,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  skipLink: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  skipText: {
    ...bcctTypography.small,
    textDecorationLine: 'underline',
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    gap: 4,
  },
  backText: {
    ...bcctTypography.small,
  },

  // Address row
  addrRow: {
    flexDirection: 'row',
    gap: 12,
  },

  // Brand logo
  brandLogoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  brandLogoBox: {
    width: 88,
    height: 88,
    borderRadius: 12,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  brandLogoImage: {
    width: 88,
    height: 88,
    resizeMode: 'contain',
  },

  // Color picker
  colorSwatchRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 10,
  },
  colorSwatch: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  colorSwatchSelected: {
    borderWidth: 3,
    borderColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  colorPreviewBar: {
    height: 6,
    borderRadius: 3,
    marginTop: 14,
  },

  // Multiline text area
  textArea: {
    minHeight: 88,
    paddingTop: 14,
    textAlignVertical: 'top',
  },

  // Stripe step
  stripeStep: {
    alignItems: 'center',
    paddingTop: 32,
  },
  stripeIconWrap: {
    width: 104,
    height: 104,
    borderRadius: 52,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  stripeInfoBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    borderRadius: 12,
    padding: 14,
    marginBottom: 20,
    width: '100%',
  },
  stripeInfoText: {
    ...bcctTypography.small,
    flex: 1,
    lineHeight: 20,
  },
});
