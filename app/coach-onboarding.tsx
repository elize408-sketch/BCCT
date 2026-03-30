
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
import Constants from 'expo-constants';

const TOTAL_STEPS = 6;

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

function resolveImageSource(source: string | number | ImageSourcePropType | undefined): ImageSourcePropType {
  if (!source) return { uri: '' };
  if (typeof source === 'string') return { uri: source };
  return source as ImageSourcePropType;
}

async function uploadImageToStorage(uri: string, path: string): Promise<string> {
  const response = await fetch(uri);
  const blob = await response.blob();
  const arrayBuffer = await blob.arrayBuffer();
  const uint8Array = new Uint8Array(arrayBuffer);
  const ext = uri.split('.').pop()?.toLowerCase() ?? 'jpg';
  const contentType = ext === 'png' ? 'image/png' : 'image/jpeg';

  const { error: uploadError } = await supabase.storage
    .from('avatars')
    .upload(path, uint8Array, { contentType, upsert: true });

  if (uploadError) throw uploadError;

  const { data } = supabase.storage.from('avatars').getPublicUrl(path);
  return `${data.publicUrl}?t=${Date.now()}`;
}

export default function CoachOnboardingScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const { session, loading: authLoading } = useAuth();

  const [step, setStep] = useState(0);
  const slideAnim = useRef(new Animated.Value(0)).current;

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

  // Step 6 — Afronden
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');

  // Prefill from existing profile on mount
  useEffect(() => {
    if (!authLoading && !session) {
      console.log('[CoachOnboarding] No session, redirecting to auth');
      router.replace('/auth');
      return;
    }
    if (session) {
      prefillProfile();
    }
  }, [authLoading, session]);

  const prefillProfile = async () => {
    try {
      const supabaseUrl = Constants.expoConfig?.extra?.supabaseUrl;
      const { data: { session: currentSession } } = await supabase.auth.getSession();
      const token = currentSession?.access_token;
      if (!token || !supabaseUrl) return;

      console.log('[CoachOnboarding] Prefilling profile from API');
      const res = await fetch(`${supabaseUrl}/functions/v1/profiles-me`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return;
      const profile = await res.json();

      if (profile.company_name) setCompanyName(profile.company_name);
      if (profile.avatar_url) { setAvatarUrl(profile.avatar_url); setAvatarLocalUri(profile.avatar_url); }
      if (profile.company_logo_url) { setLogoUrl(profile.company_logo_url); setLogoLocalUri(profile.company_logo_url); }
      if (profile.coaching_types?.length) setSelectedTypes(profile.coaching_types);
      if (profile.calendar_provider) setCalendarProvider(profile.calendar_provider);
    } catch (err) {
      console.warn('[CoachOnboarding] Prefill failed (non-fatal):', err);
    }
  };

  const animateToStep = (nextStep: number) => {
    const direction = nextStep > step ? 1 : -1;
    slideAnim.setValue(direction * 400);
    setStep(nextStep);
    Animated.timing(slideAnim, {
      toValue: 0,
      duration: 280,
      useNativeDriver: true,
    }).start();
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

      const userId = session?.user?.id;
      if (!userId) throw new Error('Geen sessie');
      const url = await uploadImageToStorage(asset.uri, `${userId}/avatar.jpg`);
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

      const userId = session?.user?.id;
      if (!userId) throw new Error('Geen sessie');
      const url = await uploadImageToStorage(asset.uri, `${userId}/logo.jpg`);
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

  // ── Final save ──

  const handleFinish = async () => {
    console.log('[CoachOnboarding] Finish pressed — saving profile');
    setSaveError('');
    setSaving(true);

    try {
      const { data: { session: currentSession } } = await supabase.auth.getSession();
      const token = currentSession?.access_token;
      const supabaseUrl = Constants.expoConfig?.extra?.supabaseUrl;

      if (!token || !supabaseUrl) {
        throw new Error('Geen actieve sessie. Log opnieuw in.');
      }

      const finalTypes = selectedTypes.includes('Anders, namelijk…') && customType.trim()
        ? [...selectedTypes.filter(t => t !== 'Anders, namelijk…'), customType.trim()]
        : selectedTypes;

      const payload: Record<string, unknown> = {
        company_name: companyName.trim(),
        coaching_types: finalTypes,
        onboarding_completed: true,
        calendar_provider: calendarProvider ?? null,
      };
      if (avatarUrl) payload.avatar_url = avatarUrl;
      if (logoUrl) payload.company_logo_url = logoUrl;

      console.log('[CoachOnboarding] PATCH /functions/v1/profiles-me payload:', payload);

      const response = await fetch(`${supabaseUrl}/functions/v1/profiles-me`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const text = await response.text();
        console.error('[CoachOnboarding] PATCH error response:', text);
        throw new Error('Profiel opslaan mislukt. Probeer opnieuw.');
      }

      console.log('[CoachOnboarding] Profile saved successfully, navigating to dashboard');
      router.replace('/(tabs)');
    } catch (err: any) {
      console.error('[CoachOnboarding] Save error:', err.message);
      setSaveError(err.message || 'Er is een fout opgetreden. Probeer opnieuw.');
    } finally {
      setSaving(false);
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

  const stepLabel = `Stap ${step + 1} van ${TOTAL_STEPS}`;
  const progressWidth = `${((step + 1) / TOTAL_STEPS) * 100}%` as `${number}%`;
  const andersSelected = selectedTypes.includes('Anders, namelijk…');

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]} edges={['top', 'bottom']}>
      {/* Progress header */}
      <View style={styles.progressHeader}>
        <View style={styles.progressLabelRow}>
          <Text style={[styles.progressLabel, { color: bcctColors.textSecondary }]}>{stepLabel}</Text>
        </View>
        <View style={[styles.progressTrack, { backgroundColor: colors.border }]}>
          <Animated.View
            style={[styles.progressFill, { width: progressWidth, backgroundColor: bcctColors.primaryOrange }]}
          />
        </View>
      </View>

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={0}
      >
        <Animated.View style={[styles.flex, { transform: [{ translateX: slideAnim }] }]}>
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
                STEP 6 — Afronden
            ══════════════════════════════════════ */}
            {step === 5 && (
              <View style={[styles.stepContent, styles.finishStep]}>
                <View style={styles.checkmarkWrap}>
                  <Ionicons name="checkmark-circle" size={96} color={bcctColors.success} />
                </View>

                <Text style={[styles.finishTitle, { color: colors.text }]}>Je account is klaar!</Text>
                <Text style={[styles.finishEmoji]}>🎉</Text>
                <Text style={[styles.stepSubtitle, { color: bcctColors.textSecondary, textAlign: 'center' }]}>
                  Welkom bij BCCT Coaching. Je kunt nu beginnen met coachen.
                </Text>

                {!!saveError && (
                  <View style={styles.saveErrorBox}>
                    <Text style={styles.saveErrorText}>{saveError}</Text>
                  </View>
                )}

                <TouchableOpacity
                  style={[styles.primaryButtonContainer, saving && styles.buttonDisabled]}
                  onPress={handleFinish}
                  disabled={saving}
                  activeOpacity={0.9}
                >
                  <LinearGradient
                    colors={saving
                      ? [bcctColors.primaryOrangeDisabled, bcctColors.primaryOrangeDisabled]
                      : [bcctColors.primaryOrange, bcctColors.primaryOrangeDark]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.primaryButton}
                  >
                    {saving ? (
                      <ActivityIndicator color="#fff" />
                    ) : (
                      <Text style={styles.primaryButtonText}>Naar dashboard</Text>
                    )}
                  </LinearGradient>
                </TouchableOpacity>

                <BackButton onPress={handleBack} />
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
  chip: {
    borderWidth: 1.5,
    borderRadius: 24,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  chipText: {
    ...bcctTypography.small,
    fontWeight: '500',
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
});
