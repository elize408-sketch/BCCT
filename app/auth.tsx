
import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Platform,
  KeyboardAvoidingView,
  ScrollView,
} from 'react-native';
import Modal from 'react-native-modal';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'expo-router';
import { useTheme } from '@react-navigation/native';

type Mode = 'signin' | 'signup';

export default function AuthScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const { signInWithPassword, signUpWithPassword, signInWithGoogle, signInWithApple, loading: authLoading } = useAuth();

  const [mode, setMode] = useState<Mode>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [modalTitle, setModalTitle] = useState('');
  const [modalMessage, setModalMessage] = useState('');
  const [modalType, setModalType] = useState<'success' | 'error'>('error');

  const showModal = (title: string, message: string, type: 'success' | 'error' = 'error') => {
    setModalTitle(title);
    setModalMessage(message);
    setModalType(type);
    setModalVisible(true);
  };

  if (authLoading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  const handleEmailAuth = async () => {
    console.log('[Auth] handleEmailAuth called, mode:', mode);
    
    if (!email) {
      showModal('Fout', 'Voer je e-mailadres in');
      return;
    }

    if (!password) {
      showModal('Fout', 'Voer een wachtwoord in');
      return;
    }

    // Validation for sign up
    if (mode === 'signup') {
      if (password.length < 6) {
        showModal('Fout', 'Wachtwoord moet minimaal 6 tekens bevatten');
        return;
      }

      if (password !== confirmPassword) {
        showModal('Fout', 'Wachtwoorden komen niet overeen');
        return;
      }
    }

    setLoading(true);
    try {
      if (mode === 'signup') {
        console.log('[Auth] Signing up user');
        await signUpWithPassword(email, password, name);
        showModal(
          'Gelukt',
          'Account succesvol aangemaakt! Je kunt nu inloggen.',
          'success'
        );
        // Switch to sign in mode after successful signup
        setMode('signin');
        setPassword('');
        setConfirmPassword('');
      } else {
        console.log('[Auth] Signing in user');
        await signInWithPassword(email, password);
        // Navigation will be handled by auth state change
      }
    } catch (error: any) {
      console.error('[Auth] Error:', error);
      
      // Handle specific error messages
      let errorMessage = error.message || 'Authenticatie mislukt';
      
      if (errorMessage.includes('Invalid login credentials')) {
        errorMessage = 'Ongeldig e-mailadres of wachtwoord';
      } else if (errorMessage.includes('User already registered')) {
        errorMessage = 'Er bestaat al een account met dit e-mailadres';
      } else if (errorMessage.includes('Password should be at least 6 characters')) {
        errorMessage = 'Wachtwoord moet minimaal 6 tekens bevatten';
      }
      
      showModal('Fout', errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleSocialAuth = async (provider: 'google' | 'apple') => {
    console.log('[Auth] Social auth initiated:', provider);
    setLoading(true);
    try {
      if (provider === 'google') {
        await signInWithGoogle();
      } else if (provider === 'apple') {
        await signInWithApple();
      }
    } catch (error: any) {
      console.error('[Auth] Social auth error:', error);
      showModal('Fout', error.message || 'Authenticatie mislukt');
    } finally {
      setLoading(false);
    }
  };

  const inputBackgroundColor = colors.card;
  const inputTextColor = colors.text;
  const inputBorderColor = colors.border;
  const secondaryTextColor = colors.text + '99';

  const modeTitle = mode === 'signup' ? 'Account Aanmaken' : 'Inloggen';
  const modeButtonText = mode === 'signup' ? 'Registreren' : 'Inloggen';
  const switchModeText = mode === 'signup' 
    ? 'Heb je al een account? Inloggen' 
    : 'Nog geen account? Registreren';

  return (
    <>
      <KeyboardAvoidingView
        style={[styles.container, { backgroundColor: colors.background }]}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <View style={styles.content}>
            <Text style={[styles.title, { color: colors.text }]}>{modeTitle}</Text>

            {mode === 'signup' && (
              <TextInput
                style={[
                  styles.input,
                  {
                    backgroundColor: inputBackgroundColor,
                    borderColor: inputBorderColor,
                    color: inputTextColor,
                  },
                ]}
                placeholder="Naam (optioneel)"
                placeholderTextColor={secondaryTextColor}
                value={name}
                onChangeText={setName}
                autoCapitalize="words"
              />
            )}

            <TextInput
              style={[
                styles.input,
                {
                  backgroundColor: inputBackgroundColor,
                  borderColor: inputBorderColor,
                  color: inputTextColor,
                },
              ]}
              placeholder="E-mailadres"
              placeholderTextColor={secondaryTextColor}
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
            />

            <TextInput
              style={[
                styles.input,
                {
                  backgroundColor: inputBackgroundColor,
                  borderColor: inputBorderColor,
                  color: inputTextColor,
                },
              ]}
              placeholder="Wachtwoord"
              placeholderTextColor={secondaryTextColor}
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoCapitalize="none"
            />

            {mode === 'signup' && (
              <TextInput
                style={[
                  styles.input,
                  {
                    backgroundColor: inputBackgroundColor,
                    borderColor: inputBorderColor,
                    color: inputTextColor,
                  },
                ]}
                placeholder="Bevestig wachtwoord"
                placeholderTextColor={secondaryTextColor}
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                secureTextEntry
                autoCapitalize="none"
              />
            )}

            <TouchableOpacity
              style={[styles.primaryButton, { backgroundColor: colors.primary }, loading && styles.buttonDisabled]}
              onPress={handleEmailAuth}
              disabled={loading}
            >
              {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryButtonText}>{modeButtonText}</Text>}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.switchModeButton}
              onPress={() => {
                setMode(mode === 'signup' ? 'signin' : 'signup');
                setPassword('');
                setConfirmPassword('');
              }}
            >
              <Text style={[styles.switchModeText, { color: colors.primary }]}>
                {switchModeText}
              </Text>
            </TouchableOpacity>

            <View style={styles.divider}>
              <View style={[styles.dividerLine, { backgroundColor: inputBorderColor }]} />
              <Text style={[styles.dividerText, { color: secondaryTextColor }]}>of ga verder met</Text>
              <View style={[styles.dividerLine, { backgroundColor: inputBorderColor }]} />
            </View>

            <TouchableOpacity
              style={[
                styles.socialButton,
                {
                  backgroundColor: inputBackgroundColor,
                  borderColor: inputBorderColor,
                },
              ]}
              onPress={() => handleSocialAuth('google')}
              disabled={loading}
            >
              <Text style={[styles.socialButtonText, { color: colors.text }]}>Doorgaan met Google</Text>
            </TouchableOpacity>

            {Platform.OS === 'ios' && (
              <TouchableOpacity
                style={[styles.socialButton, styles.appleButton]}
                onPress={() => handleSocialAuth('apple')}
                disabled={loading}
              >
                <Text style={[styles.socialButtonText, styles.appleButtonText]}>Doorgaan met Apple</Text>
              </TouchableOpacity>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      <Modal
        isVisible={modalVisible}
        onBackdropPress={() => setModalVisible(false)}
        onBackButtonPress={() => setModalVisible(false)}
        animationIn="fadeIn"
        animationOut="fadeOut"
        backdropOpacity={0.5}
      >
        <View style={[styles.modalContent, { backgroundColor: colors.card }]}>
          <Text style={[styles.modalTitle, { color: modalType === 'error' ? '#ef4444' : '#10b981' }]}>{modalTitle}</Text>
          <Text style={[styles.modalMessage, { color: secondaryTextColor }]}>{modalMessage}</Text>
          <TouchableOpacity
            style={[styles.modalButton, { backgroundColor: modalType === 'error' ? '#ef4444' : '#10b981' }]}
            onPress={() => setModalVisible(false)}
          >
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollContent: {
    flexGrow: 1,
  },
  content: {
    flex: 1,
    padding: 24,
    justifyContent: 'center',
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    marginBottom: 32,
    textAlign: 'center',
  },
  input: {
    height: 50,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 16,
    marginBottom: 16,
    fontSize: 16,
  },
  primaryButton: {
    height: 50,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  switchModeButton: {
    marginTop: 16,
    alignItems: 'center',
  },
  switchModeText: {
    fontSize: 14,
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 24,
  },
  dividerLine: {
    flex: 1,
    height: 1,
  },
  dividerText: {
    marginHorizontal: 12,
    fontSize: 14,
  },
  socialButton: {
    height: 50,
    borderWidth: 1,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  socialButtonText: {
    fontSize: 16,
    fontWeight: '500',
  },
  appleButton: {
    backgroundColor: '#000',
    borderColor: '#000',
  },
  appleButtonText: {
    color: '#fff',
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
