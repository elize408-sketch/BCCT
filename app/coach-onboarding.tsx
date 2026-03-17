
import React, { useState, useEffect } from 'react';
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
  Alert,
  ScrollView,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useTheme } from '@react-navigation/native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import * as ImagePicker from 'expo-image-picker';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { bcctColors, bcctTypography } from '@/styles/bcctTheme';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const TOTAL_STEPS = 3;

export default function CoachOnboardingScreen() {
  // TEMPORARILY DISABLED — redirect immediately to avoid crash
  const router = useRouter();
  useEffect(() => { router.replace('/(tabs)'); }, []);
  return null;

  // eslint-disable-next-line no-unreachable
  const { session, loading: authLoading } = useAuth();
  const theme = useTheme();
  const colors = theme?.colors ?? {
    background: '#F7F9FC',
    card: '#FFFFFF',
    text: '#1F2937',
    border: '#E6EAF0',
    primary: '#F28C28',
    notification: '#EF4444',
  };

  // Redirect away if auth resolves with no session
  React.useEffect(() => {
    if (!authLoading && !session) {
      console.log('[CoachOnboarding] No session after auth resolved, redirecting to auth');
      setTimeout(() => {
        router.replace('/auth');
      }, 100);
    }
  }, [authLoading, session]);

  const [step, setStep] = useState(0);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [avatarUri, setAvatarUri] = useState<string | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);

  const translateX = useSharedValue(0);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  const goToStep = (nextStep: number) => {
    const direction = nextStep > step ? -1 : 1;
    translateX.value = withTiming(direction * SCREEN_WIDTH, {
      duration: 1,
      easing: Easing.linear,
    });
    setTimeout(() => {
      setStep(nextStep);
      translateX.value = -direction * SCREEN_WIDTH;
      translateX.value = withTiming(0, {
        duration: 300,
        easing: Easing.out(Easing.cubic),
      });
    }, 1);
  };

  // Step 1 → 2
  const handleStep1Next = () => {
    console.log('[CoachOnboarding] Step 1 next pressed', { firstName, lastName });
    if (!firstName.trim()) {
      Alert.alert('Verplicht veld', 'Voer je voornaam in.');
      return;
    }
    if (!lastName.trim()) {
      Alert.alert('Verplicht veld', 'Voer je achternaam in.');
      return;
    }
    goToStep(1);
  };

  // Step 2 → 3
  const handleStep2Next = () => {
    console.log('[CoachOnboarding] Step 2 next pressed', { hasAvatar: !!avatarUri });
    goToStep(2);
  };

  const handlePickImage = async () => {
    console.log('[CoachOnboarding] Pick image pressed');
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert(
        'Toestemming vereist',
        'Geef toegang tot je fotobibliotheek om een profielfoto te kiezen.'
      );
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
    });

    if (result.canceled || !result.assets?.[0]) {
      console.log('[CoachOnboarding] Image picker cancelled');
      return;
    }

    const asset = result.assets[0];
    console.log('[CoachOnboarding] Image selected:', asset.uri);
    setAvatarUri(asset.uri);
    await uploadAvatar(asset.uri);
  };

  const uploadAvatar = async (uri: string) => {
    const userId = session?.user?.id;
    if (!userId) return;

    setUploading(true);
    console.log('[CoachOnboarding] Uploading avatar to Supabase Storage');

    try {
      const response = await fetch(uri);
      const blob = await response.blob();
      const arrayBuffer = await blob.arrayBuffer();
      const uint8Array = new Uint8Array(arrayBuffer);

      const ext = uri.split('.').pop()?.toLowerCase() ?? 'jpg';
      const fileName = `${userId}/avatar.${ext}`;
      const contentType = ext === 'png' ? 'image/png' : 'image/jpeg';

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(fileName, uint8Array, { contentType, upsert: true });

      if (uploadError) throw uploadError;

      const { data } = supabase.storage.from('avatars').getPublicUrl(fileName);
      const publicUrl = `${data.publicUrl}?t=${Date.now()}`;
      console.log('[CoachOnboarding] Avatar uploaded, public URL:', publicUrl);
      setAvatarUrl(publicUrl);
    } catch (err: any) {
      console.error('[CoachOnboarding] Avatar upload error:', err.message);
      Alert.alert('Upload mislukt', 'Foto kon niet worden geüpload. Je kunt dit later aanpassen.');
      setAvatarUri(null);
    } finally {
      setUploading(false);
    }
  };

  // Step 3 → complete
  const handleComplete = async () => {
    console.log('[CoachOnboarding] Complete pressed', { firstName, lastName, companyName, hasAvatar: !!avatarUrl });

    if (!companyName.trim()) {
      Alert.alert('Verplicht veld', 'Voer je bedrijfsnaam in.');
      return;
    }

    const userId = session?.user?.id;
    if (!userId) {
      Alert.alert('Fout', 'Je bent niet ingelogd. Log opnieuw in.');
      setTimeout(() => {
        router.replace('/auth');
      }, 100);
      return;
    }

    setSaving(true);
    console.log('[CoachOnboarding] Saving profile to Supabase for user:', userId);

    try {
      const { error } = await supabase.from('profiles').upsert({
        id: userId,
        full_name: `${firstName.trim()} ${lastName.trim()}`,
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        company_name: companyName.trim(),
        avatar_url: avatarUrl ?? null,
        role: 'coach',
        onboarding_completed: true,
        updated_at: new Date().toISOString(),
      });

      if (error) {
        console.error('[CoachOnboarding] Error saving profile:', error);
        Alert.alert('Fout', error.message || 'Profiel opslaan mislukt. Probeer opnieuw.');
        return;
      }

      console.log('[CoachOnboarding] Profile saved, navigating to coach dashboard');
      setTimeout(() => {
        router.replace('/(app)/coach');
      }, 100);
    } catch (err: any) {
      console.error('[CoachOnboarding] Unexpected error:', err.message);
      Alert.alert('Fout', 'Er is een onverwachte fout opgetreden. Probeer opnieuw.');
    } finally {
      setSaving(false);
    }
  };

  // Guard: don't render until auth has resolved (or context not yet available)
  if (authLoading) {
    return (
      <SafeAreaView style={[styles.safeArea, { backgroundColor: colors?.background ?? '#F7F9FC' }]} edges={['top', 'bottom']}>
        <ActivityIndicator style={{ flex: 1 }} color={bcctColors.primaryOrange} />
      </SafeAreaView>
    );
  }

  const stepLabel = `${step + 1}/${TOTAL_STEPS}`;

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors?.background ?? '#F7F9FC' }]} edges={['top', 'bottom']}>
      {/* Progress bar */}
      <View style={styles.progressContainer}>
        <View style={styles.dotsRow}>
          {Array.from({ length: TOTAL_STEPS }).map((_, i) => {
            const isActive = i === step;
            const isDone = i < step;
            const dotBg = isActive || isDone ? bcctColors.primaryOrange : colors.border;
            return (
              <View
                key={i}
                style={[
                  styles.dot,
                  { backgroundColor: dotBg, width: isActive ? 24 : 8 },
                ]}
              />
            );
          })}
        </View>
        <Text style={[styles.stepLabel, { color: bcctColors.textSecondary }]}>{stepLabel}</Text>
      </View>

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={0}
      >
        <Animated.View style={[styles.flex, animatedStyle]}>
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {/* ── STEP 1: Naam ── */}
            {step === 0 && (
              <View style={styles.stepContent}>
                <Text style={[styles.title, { color: colors.text }]}>
                  Welkom! Hoe mogen we je noemen?
                </Text>
                <Text style={[styles.subtitle, { color: bcctColors.textSecondary }]}>
                  Vul je naam in zodat je klanten weten wie je bent.
                </Text>

                <View style={styles.form}>
                  <View style={styles.inputGroup}>
                    <Text style={[styles.label, { color: colors.text }]}>Voornaam</Text>
                    <TextInput
                      style={[styles.input, { backgroundColor: colors.card, color: colors.text, borderColor: colors.border }]}
                      placeholder="Voer je voornaam in"
                      placeholderTextColor={bcctColors.textSecondary}
                      value={firstName}
                      onChangeText={setFirstName}
                      autoCapitalize="words"
                      returnKeyType="next"
                    />
                  </View>

                  <View style={styles.inputGroup}>
                    <Text style={[styles.label, { color: colors.text }]}>Achternaam</Text>
                    <TextInput
                      style={[styles.input, { backgroundColor: colors.card, color: colors.text, borderColor: colors.border }]}
                      placeholder="Voer je achternaam in"
                      placeholderTextColor={bcctColors.textSecondary}
                      value={lastName}
                      onChangeText={setLastName}
                      autoCapitalize="words"
                      returnKeyType="done"
                    />
                  </View>
                </View>

                <TouchableOpacity
                  style={styles.buttonContainer}
                  onPress={handleStep1Next}
                  activeOpacity={0.9}
                >
                  <LinearGradient
                    colors={[bcctColors.primaryOrange, bcctColors.primaryOrangeDark]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.button}
                  >
                    <Text style={styles.buttonText}>Volgende</Text>
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            )}

            {/* ── STEP 2: Profielfoto ── */}
            {step === 1 && (
              <View style={styles.stepContent}>
                <Text style={[styles.title, { color: colors.text }]}>
                  Voeg een profielfoto toe
                </Text>
                <Text style={[styles.subtitle, { color: bcctColors.textSecondary }]}>
                  Een foto helpt je klanten je te herkennen.
                </Text>

                <View style={styles.avatarSection}>
                  <TouchableOpacity
                    style={[styles.avatarCircle, { borderColor: avatarUri ? bcctColors.primaryOrange : colors.border }]}
                    onPress={handlePickImage}
                    activeOpacity={0.8}
                    disabled={uploading}
                  >
                    {avatarUri ? (
                      <Image source={{ uri: avatarUri }} style={styles.avatarImage} />
                    ) : (
                      <View style={[styles.avatarPlaceholder, { backgroundColor: colors.card }]}>
                        <Text style={styles.avatarPlaceholderIcon}>👤</Text>
                      </View>
                    )}
                    {uploading ? (
                      <View style={styles.avatarOverlay}>
                        <ActivityIndicator color="#fff" />
                      </View>
                    ) : (
                      <View style={[styles.cameraBadge, { backgroundColor: bcctColors.primaryOrange }]}>
                        <Text style={styles.cameraBadgeIcon}>📷</Text>
                      </View>
                    )}
                  </TouchableOpacity>

                  <Text style={[styles.avatarHint, { color: bcctColors.textSecondary }]}>
                    Tik op de cirkel om een foto te kiezen
                  </Text>
                </View>

                <TouchableOpacity
                  style={styles.buttonContainer}
                  onPress={handleStep2Next}
                  activeOpacity={0.9}
                  disabled={uploading}
                >
                  <LinearGradient
                    colors={uploading
                      ? [bcctColors.primaryOrangeDisabled, bcctColors.primaryOrangeDisabled]
                      : [bcctColors.primaryOrange, bcctColors.primaryOrangeDark]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.button}
                  >
                    {uploading ? (
                      <ActivityIndicator color="#fff" />
                    ) : (
                      <Text style={styles.buttonText}>Volgende</Text>
                    )}
                  </LinearGradient>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.skipLink}
                  onPress={() => {
                    console.log('[CoachOnboarding] Skip photo pressed');
                    goToStep(2);
                  }}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.skipText, { color: bcctColors.textSecondary }]}>Overslaan</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* ── STEP 3: Bedrijfsnaam ── */}
            {step === 2 && (
              <View style={styles.stepContent}>
                <Text style={[styles.title, { color: colors.text }]}>
                  Wat is je bedrijfsnaam?
                </Text>
                <Text style={[styles.subtitle, { color: bcctColors.textSecondary }]}>
                  Dit wordt zichtbaar op je coachprofiel.
                </Text>

                <View style={styles.form}>
                  <View style={styles.inputGroup}>
                    <Text style={[styles.label, { color: colors.text }]}>Bedrijfsnaam</Text>
                    <TextInput
                      style={[styles.input, { backgroundColor: colors.card, color: colors.text, borderColor: colors.border }]}
                      placeholder="Voer je bedrijfsnaam in"
                      placeholderTextColor={bcctColors.textSecondary}
                      value={companyName}
                      onChangeText={setCompanyName}
                      autoCapitalize="words"
                      returnKeyType="done"
                    />
                  </View>
                </View>

                <TouchableOpacity
                  style={styles.buttonContainer}
                  onPress={handleComplete}
                  activeOpacity={0.9}
                  disabled={saving}
                >
                  <LinearGradient
                    colors={saving
                      ? [bcctColors.primaryOrangeDisabled, bcctColors.primaryOrangeDisabled]
                      : [bcctColors.primaryOrange, bcctColors.primaryOrangeDark]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.button}
                  >
                    {saving ? (
                      <ActivityIndicator color="#fff" />
                    ) : (
                      <Text style={styles.buttonText}>Start mijn account</Text>
                    )}
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            )}
          </ScrollView>
        </Animated.View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  flex: {
    flex: 1,
  },
  progressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 8,
  },
  dotsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  dot: {
    height: 8,
    borderRadius: 4,
  },
  stepLabel: {
    ...bcctTypography.small,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 32,
    paddingBottom: 40,
  },
  stepContent: {
    flex: 1,
  },
  title: {
    ...bcctTypography.h2,
    marginBottom: 10,
  },
  subtitle: {
    ...bcctTypography.body,
    marginBottom: 36,
  },
  form: {
    gap: 20,
    marginBottom: 36,
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
  avatarSection: {
    alignItems: 'center',
    marginBottom: 40,
    gap: 16,
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
  avatarPlaceholderIcon: {
    fontSize: 48,
  },
  avatarOverlay: {
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
  cameraBadgeIcon: {
    fontSize: 14,
  },
  avatarHint: {
    ...bcctTypography.small,
    textAlign: 'center',
  },
  buttonContainer: {
    borderRadius: 12,
    overflow: 'hidden',
  },
  button: {
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: {
    color: '#fff',
    ...bcctTypography.button,
  },
  skipLink: {
    alignItems: 'center',
    marginTop: 16,
    paddingVertical: 8,
  },
  skipText: {
    ...bcctTypography.small,
    textDecorationLine: 'underline',
  },
});
