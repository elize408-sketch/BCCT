
import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import Modal from 'react-native-modal';
import { useRouter } from 'expo-router';
import { useTheme } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';

export default function OnboardingScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const { session } = useAuth();
  const [loading, setLoading] = useState(false);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [role, setRole] = useState<'client' | 'coach' | 'org_admin'>('client');
  const [goals, setGoals] = useState('');
  const [modalVisible, setModalVisible] = useState(false);
  const [modalTitle, setModalTitle] = useState('');
  const [modalMessage, setModalMessage] = useState('');

  const showModal = (title: string, message: string) => {
    setModalTitle(title);
    setModalMessage(message);
    setModalVisible(true);
  };

  const handleComplete = async () => {
    console.log('[Onboarding] Starting profile setup', { name, phone, role });

    if (!name.trim()) {
      showModal('Error', 'Please enter your name');
      return;
    }

    // CRITICAL: Check session before database operation
    const {
      data: { session: currentSession },
    } = await supabase.auth.getSession();

    if (!currentSession) {
      console.error('[Onboarding] No session found');
      showModal('Error', 'You are not logged in. Please sign in again.');
      router.replace('/auth');
      return;
    }

    console.log('[Onboarding] Session verified, user ID:', currentSession.user.id);

    setLoading(true);
    try {
      // UPSERT profile using Supabase client directly
      const { error } = await supabase.from('profiles').upsert({
        id: currentSession.user.id,
        full_name: name.trim(),
        phone: phone.trim() || null,
        role: role,
        goals: goals.trim() || null,
        onboarding_completed: true,
      });

      if (error) {
        console.error('[Onboarding] Supabase error:', error);
        throw error;
      }

      console.log('[Onboarding] Profile saved successfully, redirecting to app');
      router.replace('/(app)');
    } catch (error: any) {
      console.error('[Onboarding] Error saving profile', error);
      showModal('Error', error.message || 'Failed to save profile. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const roleOptions = [
    { value: 'client', label: 'Client', description: 'I want coaching' },
    { value: 'coach', label: 'Coach', description: 'I provide coaching' },
    { value: 'org_admin', label: 'Organization Admin', description: 'I manage an organization' },
  ] as const;

  const secondaryTextColor = colors.text + '99';

  return (
    <>
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <View style={styles.header}>
            <Text style={[styles.title, { color: colors.text }]}>Welcome to BCCT</Text>
            <Text style={[styles.subtitle, { color: secondaryTextColor }]}>Let&apos;s set up your profile</Text>
          </View>

          <View style={styles.form}>
            <View style={styles.inputGroup}>
              <Text style={[styles.label, { color: colors.text }]}>Name *</Text>
              <TextInput
                style={[styles.input, { backgroundColor: colors.card, color: colors.text, borderColor: colors.border }]}
                value={name}
                onChangeText={setName}
                placeholder="Enter your name"
                placeholderTextColor={secondaryTextColor}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={[styles.label, { color: colors.text }]}>Phone</Text>
              <TextInput
                style={[styles.input, { backgroundColor: colors.card, color: colors.text, borderColor: colors.border }]}
                value={phone}
                onChangeText={setPhone}
                placeholder="Enter your phone number"
                placeholderTextColor={secondaryTextColor}
                keyboardType="phone-pad"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={[styles.label, { color: colors.text }]}>I am a *</Text>
              {roleOptions.map((option) => {
                const isSelected = role === option.value;
                return (
                  <TouchableOpacity
                    key={option.value}
                    style={[
                      styles.roleOption,
                      { backgroundColor: colors.card, borderColor: isSelected ? colors.primary : colors.border },
                      isSelected && { borderWidth: 2 },
                    ]}
                    onPress={() => setRole(option.value)}
                  >
                    <View style={styles.roleContent}>
                      <Text style={[styles.roleLabel, { color: colors.text }]}>{option.label}</Text>
                      <Text style={[styles.roleDescription, { color: secondaryTextColor }]}>{option.description}</Text>
                    </View>
                    <View
                      style={[
                        styles.radio,
                        { borderColor: isSelected ? colors.primary : colors.border },
                        isSelected && { backgroundColor: colors.primary },
                      ]}
                    />
                  </TouchableOpacity>
                );
              })}
            </View>

            {role === 'client' && (
              <View style={styles.inputGroup}>
                <Text style={[styles.label, { color: colors.text }]}>Goals</Text>
                <TextInput
                  style={[styles.textArea, { backgroundColor: colors.card, color: colors.text, borderColor: colors.border }]}
                  value={goals}
                  onChangeText={setGoals}
                  placeholder="What do you want to achieve?"
                  placeholderTextColor={secondaryTextColor}
                  multiline
                  numberOfLines={4}
                  textAlignVertical="top"
                />
              </View>
            )}

            <TouchableOpacity
              style={[styles.button, { backgroundColor: colors.primary }]}
              onPress={handleComplete}
              disabled={loading}
            >
              {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Complete Setup</Text>}
            </TouchableOpacity>
          </View>
        </ScrollView>
      </SafeAreaView>

      <Modal
        isVisible={modalVisible}
        onBackdropPress={() => setModalVisible(false)}
        onBackButtonPress={() => setModalVisible(false)}
        animationIn="fadeIn"
        animationOut="fadeOut"
        backdropOpacity={0.5}
      >
        <View style={[styles.modalContent, { backgroundColor: colors.card }]}>
          <Text style={[styles.modalTitle, { color: '#ef4444' }]}>{modalTitle}</Text>
          <Text style={[styles.modalMessage, { color: secondaryTextColor }]}>{modalMessage}</Text>
          <TouchableOpacity style={[styles.modalButton, { backgroundColor: '#ef4444' }]} onPress={() => setModalVisible(false)}>
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
  scrollContent: {
    padding: 24,
  },
  header: {
    marginBottom: 32,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
  },
  form: {
    gap: 24,
  },
  inputGroup: {
    gap: 8,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
  },
  input: {
    height: 48,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 16,
    fontSize: 16,
  },
  textArea: {
    minHeight: 100,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
  },
  roleOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 12,
  },
  roleContent: {
    flex: 1,
    gap: 4,
  },
  roleLabel: {
    fontSize: 16,
    fontWeight: '600',
  },
  roleDescription: {
    fontSize: 14,
  },
  radio: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
  },
  button: {
    height: 56,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  modalContent: {
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  modalMessage: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 24,
  },
  modalButton: {
    paddingHorizontal: 32,
    paddingVertical: 12,
    borderRadius: 8,
    minWidth: 100,
  },
  modalButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
});
