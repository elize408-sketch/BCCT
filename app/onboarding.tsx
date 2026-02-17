
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Image,
} from 'react-native';
import { useTheme } from '@react-navigation/native';
import { useAuth } from '@/contexts/AuthContext';
import Modal from 'react-native-modal';
import { supabase } from '@/lib/supabase';
import { LinearGradient } from 'expo-linear-gradient';
import { bcctColors, bcctTypography } from '@/styles/bcctTheme';

export default function OnboardingScreen() {
  const { session } = useAuth();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [role, setRole] = useState<'client' | 'coach' | 'org_admin'>('client');
  const [goals, setGoals] = useState('');
  const [loading, setLoading] = useState(false);
  const { colors } = useTheme();
  const router = useRouter();

  const [modalVisible, setModalVisible] = useState(false);
  const [modalTitle, setModalTitle] = useState('');
  const [modalMessage, setModalMessage] = useState('');

  const showModal = (title: string, message: string) => {
    setModalTitle(title);
    setModalMessage(message);
    setModalVisible(true);
  };

  const handleComplete = async () => {
    console.log('[Onboarding] Starting profile completion', { name, phone, role, goals });

    if (!name.trim()) {
      showModal('Fout', 'Voer je naam in');
      return;
    }

    if (!phone.trim()) {
      showModal('Fout', 'Voer je telefoonnummer in');
      return;
    }

    setLoading(true);

    try {
      const {
        data: { session: currentSession },
      } = await supabase.auth.getSession();

      if (!currentSession) {
        console.error('[Onboarding] No session found');
        showModal('Fout', 'Je bent niet ingelogd. Log opnieuw in.');
        router.replace('/auth');
        setLoading(false);
        return;
      }

      console.log('[Onboarding] Upserting profile for user:', currentSession.user.id);

      const { error } = await supabase.from('profiles').upsert({
        id: currentSession.user.id,
        full_name: name.trim(),
        phone: phone.trim(),
        role: role,
        goals: goals.trim() || null,
        onboarding_completed: true,
        updated_at: new Date().toISOString(),
      });

      if (error) {
        console.error('[Onboarding] Error saving profile:', error);
        showModal('Fout', error.message || 'Profiel opslaan mislukt. Probeer opnieuw.');
      } else {
        console.log('[Onboarding] Profile saved successfully, redirecting based on role:', role);
        
        if (role === 'client') {
          router.replace('/(app)/client');
        } else if (role === 'coach') {
          router.replace('/(app)/coach');
        } else if (role === 'org_admin') {
          router.replace('/(app)/org');
        }
      }
    } catch (error: any) {
      console.error('[Onboarding] Unexpected error:', error);
      showModal('Fout', 'Er is een onverwachte fout opgetreden. Probeer opnieuw.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Logo and Branding Header */}
        <View style={styles.brandingHeader}>
          <Image
            source={require('@/assets/images/1ac1fe99-d9d9-48ee-9ee0-6b721fbbfa04.png')}
            style={styles.logo}
            resizeMode="contain"
          />
          <Text style={[styles.welcomeText, { color: bcctColors.textSecondary }]}>
            Welkom bij
          </Text>
          <Text style={[styles.brandName, { color: colors.text }]}>
            B-Connected
          </Text>
          <Text style={[styles.brandSubtitle, { color: bcctColors.textSecondary }]}>
            Coaching & Training
          </Text>
        </View>

        <View style={styles.header}>
          <Text style={[styles.title, { color: colors.text }]}>Voltooi je profiel</Text>
          <Text style={[styles.subtitle, { color: bcctColors.textSecondary }]}>
            Vertel ons iets over jezelf
          </Text>
        </View>

        <View style={styles.form}>
          <View style={styles.inputGroup}>
            <Text style={[styles.label, { color: colors.text }]}>Volledige naam *</Text>
            <TextInput
              style={[styles.input, { backgroundColor: colors.card, color: colors.text, borderColor: colors.border }]}
              placeholder="Voer je volledige naam in"
              placeholderTextColor={bcctColors.textSecondary}
              value={name}
              onChangeText={setName}
              autoCapitalize="words"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={[styles.label, { color: colors.text }]}>Telefoonnummer *</Text>
            <TextInput
              style={[styles.input, { backgroundColor: colors.card, color: colors.text, borderColor: colors.border }]}
              placeholder="Voer je telefoonnummer in"
              placeholderTextColor={bcctColors.textSecondary}
              value={phone}
              onChangeText={setPhone}
              keyboardType="phone-pad"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={[styles.label, { color: colors.text }]}>Rol *</Text>
            <View style={styles.roleButtons}>
              <TouchableOpacity
                style={[
                  styles.roleButton,
                  { borderColor: colors.border },
                  role === 'client' && { backgroundColor: bcctColors.primaryBlue, borderColor: bcctColors.primaryBlue },
                ]}
                onPress={() => setRole('client')}
              >
                <Text style={[styles.roleButtonText, { color: role === 'client' ? '#fff' : colors.text }]}>
                  Cliënt
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.roleButton,
                  { borderColor: colors.border },
                  role === 'coach' && { backgroundColor: bcctColors.primaryBlue, borderColor: bcctColors.primaryBlue },
                ]}
                onPress={() => setRole('coach')}
              >
                <Text style={[styles.roleButtonText, { color: role === 'coach' ? '#fff' : colors.text }]}>
                  Coach
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.roleButton,
                  { borderColor: colors.border },
                  role === 'org_admin' && { backgroundColor: bcctColors.primaryBlue, borderColor: bcctColors.primaryBlue },
                ]}
                onPress={() => setRole('org_admin')}
              >
                <Text style={[styles.roleButtonText, { color: role === 'org_admin' ? '#fff' : colors.text }]}>
                  Org Admin
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Text style={[styles.label, { color: colors.text }]}>Doelen (Optioneel)</Text>
            <TextInput
              style={[
                styles.input,
                styles.textArea,
                { backgroundColor: colors.card, color: colors.text, borderColor: colors.border },
              ]}
              placeholder="Wat zijn je doelen?"
              placeholderTextColor={bcctColors.textSecondary}
              value={goals}
              onChangeText={setGoals}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />
          </View>

          <TouchableOpacity
            style={[styles.buttonContainer]}
            onPress={handleComplete}
            disabled={loading}
          >
            <LinearGradient
              colors={[bcctColors.primaryBlue, bcctColors.gradientTeal]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.button}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.buttonText}>Profiel voltooien</Text>
              )}
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </ScrollView>

      <Modal isVisible={modalVisible} onBackdropPress={() => setModalVisible(false)}>
        <View style={[styles.modalContent, { backgroundColor: colors.card }]}>
          <Text style={[styles.modalTitle, { color: colors.text }]}>{modalTitle}</Text>
          <Text style={[styles.modalMessage, { color: bcctColors.textSecondary }]}>{modalMessage}</Text>
          <TouchableOpacity
            style={[styles.modalButton, { backgroundColor: bcctColors.primaryBlue }]}
            onPress={() => setModalVisible(false)}
          >
            <Text style={styles.modalButtonText}>OK</Text>
          </TouchableOpacity>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
  },
  brandingHeader: {
    alignItems: 'center',
    marginBottom: 24,
  },
  logo: {
    width: 200,
    height: 60,
    marginBottom: 12,
  },
  welcomeText: {
    ...bcctTypography.small,
    marginBottom: 4,
  },
  brandName: {
    ...bcctTypography.h2,
    marginBottom: 4,
  },
  brandSubtitle: {
    ...bcctTypography.body,
  },
  header: {
    marginBottom: 32,
  },
  title: {
    ...bcctTypography.h1,
    marginBottom: 8,
  },
  subtitle: {
    ...bcctTypography.body,
  },
  form: {
    gap: 20,
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
    padding: 16,
    ...bcctTypography.body,
  },
  textArea: {
    minHeight: 100,
  },
  roleButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  roleButton: {
    flex: 1,
    borderWidth: 2,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  roleButtonText: {
    ...bcctTypography.bodyMedium,
  },
  buttonContainer: {
    borderRadius: 12,
    overflow: 'hidden',
    marginTop: 12,
  },
  button: {
    padding: 16,
    alignItems: 'center',
  },
  buttonText: {
    color: '#fff',
    ...bcctTypography.button,
  },
  modalContent: {
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
  },
  modalTitle: {
    ...bcctTypography.h3,
    marginBottom: 12,
  },
  modalMessage: {
    ...bcctTypography.body,
    textAlign: 'center',
    marginBottom: 20,
  },
  modalButton: {
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 32,
  },
  modalButtonText: {
    color: '#fff',
    ...bcctTypography.button,
  },
});
