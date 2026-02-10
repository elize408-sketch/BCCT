
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
} from 'react-native';
import { useTheme } from '@react-navigation/native';
import { useAuth } from '@/contexts/AuthContext';
import Modal from 'react-native-modal';
import { supabase } from '@/lib/supabase';

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
      showModal('Error', 'Please enter your name');
      return;
    }

    if (!phone.trim()) {
      showModal('Error', 'Please enter your phone number');
      return;
    }

    setLoading(true);

    try {
      const {
        data: { session: currentSession },
      } = await supabase.auth.getSession();

      if (!currentSession) {
        console.error('[Onboarding] No session found');
        showModal('Error', 'You are not logged in. Please sign in again.');
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
        showModal('Error', error.message || 'Failed to save profile. Please try again.');
      } else {
        console.log('[Onboarding] Profile saved successfully, redirecting based on role:', role);
        
        // Navigate based on role
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
      showModal('Error', 'An unexpected error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          <Text style={[styles.title, { color: colors.text }]}>Complete Your Profile</Text>
          <Text style={[styles.subtitle, { color: colors.text, opacity: 0.7 }]}>
            Tell us a bit about yourself
          </Text>
        </View>

        <View style={styles.form}>
          <View style={styles.inputGroup}>
            <Text style={[styles.label, { color: colors.text }]}>Full Name *</Text>
            <TextInput
              style={[styles.input, { backgroundColor: colors.card, color: colors.text, borderColor: colors.border }]}
              placeholder="Enter your full name"
              placeholderTextColor={colors.text + '80'}
              value={name}
              onChangeText={setName}
              autoCapitalize="words"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={[styles.label, { color: colors.text }]}>Phone Number *</Text>
            <TextInput
              style={[styles.input, { backgroundColor: colors.card, color: colors.text, borderColor: colors.border }]}
              placeholder="Enter your phone number"
              placeholderTextColor={colors.text + '80'}
              value={phone}
              onChangeText={setPhone}
              keyboardType="phone-pad"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={[styles.label, { color: colors.text }]}>Role *</Text>
            <View style={styles.roleButtons}>
              <TouchableOpacity
                style={[
                  styles.roleButton,
                  { borderColor: colors.border },
                  role === 'client' && { backgroundColor: colors.primary, borderColor: colors.primary },
                ]}
                onPress={() => setRole('client')}
              >
                <Text style={[styles.roleButtonText, { color: role === 'client' ? '#fff' : colors.text }]}>
                  Client
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.roleButton,
                  { borderColor: colors.border },
                  role === 'coach' && { backgroundColor: colors.primary, borderColor: colors.primary },
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
                  role === 'org_admin' && { backgroundColor: colors.primary, borderColor: colors.primary },
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
            <Text style={[styles.label, { color: colors.text }]}>Goals (Optional)</Text>
            <TextInput
              style={[
                styles.input,
                styles.textArea,
                { backgroundColor: colors.card, color: colors.text, borderColor: colors.border },
              ]}
              placeholder="What are your goals?"
              placeholderTextColor={colors.text + '80'}
              value={goals}
              onChangeText={setGoals}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />
          </View>

          <TouchableOpacity
            style={[styles.button, { backgroundColor: colors.primary }]}
            onPress={handleComplete}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonText}>Complete Profile</Text>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>

      <Modal isVisible={modalVisible} onBackdropPress={() => setModalVisible(false)}>
        <View style={[styles.modalContent, { backgroundColor: colors.card }]}>
          <Text style={[styles.modalTitle, { color: colors.text }]}>{modalTitle}</Text>
          <Text style={[styles.modalMessage, { color: colors.text }]}>{modalMessage}</Text>
          <TouchableOpacity
            style={[styles.modalButton, { backgroundColor: colors.primary }]}
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
  header: {
    marginBottom: 32,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
  },
  form: {
    gap: 20,
  },
  inputGroup: {
    gap: 8,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
  },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
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
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  roleButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  button: {
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginTop: 12,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  modalContent: {
    borderRadius: 12,
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
    marginBottom: 20,
  },
  modalButton: {
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 32,
  },
  modalButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
