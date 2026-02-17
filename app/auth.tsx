
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
  Image,
} from 'react-native';
import Modal from 'react-native-modal';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'expo-router';
import { useTheme } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { bcctColors, bcctTypography } from '@/styles/bcctTheme';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';

type Mode = 'signin' | 'signup';

export default function AuthScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const { signInWithPassword, signUpWithPassword, signInWithGoogle, signInWithApple, loading: authLoading, selectedRole, setSelectedRole } = useAuth();

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
        <ActivityIndicator size="large" color={bcctColors.primaryBlue} />
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
        setMode('signin');
        setPassword('');
        setConfirmPassword('');
      } else {
        console.log('[Auth] Signing in user with role:', selectedRole);
        await signInWithPassword(email, password, selectedRole);
      }
    } catch (error: any) {
      console.error('[Auth] Error:', error);
      
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
  const secondaryTextColor = bcctColors.textSecondary;

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
        <View style={styles.content}>
          {/* Logo and Branding Header */}
          <View style={styles.brandingHeader}>
            <Image
              source={require('@/assets/images/1ac1fe99-d9d9-48ee-9ee0-6b721fbbfa04.png')}
              style={styles.logo}
              resizeMode="contain"
            />
            <Text style={[styles.welcomeText, { color: secondaryTextColor }]}>
              Welkom bij
            </Text>
          </View>

          {/* Role Selector - Only show on signin mode */}
          {mode === 'signin' && (
            <View style={styles.roleContainer}>
              <View style={[styles.roleSelector, { backgroundColor: bcctColors.borderGray }]}>
                <TouchableOpacity
                  style={[
                    styles.roleButton,
                    selectedRole === 'client' && styles.roleButtonActive,
                  ]}
                  onPress={() => setSelectedRole('client')}
                >
                  {selectedRole === 'client' ? (
                    <LinearGradient
                      colors={[bcctColors.primaryBlue, bcctColors.gradientTeal]}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                      style={styles.roleButtonGradient}
                    >
                      <Text style={styles.roleButtonTextActive}>Cliënt</Text>
                    </LinearGradient>
                  ) : (
                    <Text style={[styles.roleButtonText, { color: bcctColors.primaryBlue }]}>Cliënt</Text>
                  )}
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.roleButton,
                    selectedRole === 'coach' && styles.roleButtonActive,
                  ]}
                  onPress={() => setSelectedRole('coach')}
                >
                  {selectedRole === 'coach' ? (
                    <LinearGradient
                      colors={[bcctColors.primaryBlue, bcctColors.gradientTeal]}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                      style={styles.roleButtonGradient}
                    >
                      <Text style={styles.roleButtonTextActive}>Coach</Text>
                    </LinearGradient>
                  ) : (
                    <Text style={[styles.roleButtonText, { color: bcctColors.primaryBlue }]}>Coach</Text>
                  )}
                </TouchableOpacity>
              </View>
              <Text style={[styles.roleHelperText, { color: secondaryTextColor }]}>
                Log in als cliënt of coach
              </Text>
            </View>
          )}

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
            style={[styles.primaryButtonContainer, loading && styles.buttonDisabled]}
            onPress={handleEmailAuth}
            disabled={loading}
          >
            <LinearGradient
              colors={[bcctColors.primaryBlue, bcctColors.gradientTeal]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.primaryButton}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.primaryButtonText}>{modeButtonText}</Text>
              )}
            </LinearGradient>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.switchModeButton}
            onPress={() => {
              setMode(mode === 'signup' ? 'signin' : 'signup');
              setPassword('');
              setConfirmPassword('');
            }}
          >
            <Text style={[styles.switchModeText, { color: secondaryTextColor }]}>
              {mode === 'signup' ? 'Heb je al een account? ' : 'Nog geen account? '}
            </Text>
            <Text style={[styles.switchModeTextAccent, { color: bcctColors.gradientTeal }]}>
              {mode === 'signup' ? 'Inloggen' : 'Registreren'}
            </Text>
          </TouchableOpacity>

          <View style={styles.divider}>
            <View style={[styles.dividerLine, { backgroundColor: inputBorderColor }]} />
            <Text style={[styles.dividerText, { color: secondaryTextColor }]}>of</Text>
            <View style={[styles.dividerLine, { backgroundColor: inputBorderColor }]} />
          </View>

          {/* Social Login Icons */}
          <View style={styles.socialIconsContainer}>
            <TouchableOpacity
              style={[
                styles.socialIconButton,
                {
                  backgroundColor: inputBackgroundColor,
                  borderColor: inputBorderColor,
                },
              ]}
              onPress={() => handleSocialAuth('google')}
              disabled={loading}
            >
              <MaterialIcons name="g-translate" size={28} color="#DB4437" />
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.socialIconButton,
                {
                  backgroundColor: inputBackgroundColor,
                  borderColor: inputBorderColor,
                },
              ]}
              onPress={() => handleSocialAuth('apple')}
              disabled={loading}
            >
              <MaterialIcons name="apple" size={28} color={colors.text} />
            </TouchableOpacity>
          </View>
        </View>
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
          <Text style={[styles.modalTitle, { color: modalType === 'error' ? bcctColors.error : bcctColors.success }]}>{modalTitle}</Text>
          <Text style={[styles.modalMessage, { color: secondaryTextColor }]}>{modalMessage}</Text>
          <TouchableOpacity
            style={[styles.modalButton, { backgroundColor: modalType === 'error' ? bcctColors.error : bcctColors.success }]}
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
  content: {
    flex: 1,
    padding: 24,
    justifyContent: 'center',
  },
  brandingHeader: {
    alignItems: 'center',
    marginBottom: 20,
  },
  logo: {
    width: 240,
    height: 72,
    marginBottom: 8,
  },
  welcomeText: {
    ...bcctTypography.small,
  },
  roleContainer: {
    marginBottom: 20,
  },
  roleSelector: {
    flexDirection: 'row',
    borderRadius: 22,
    padding: 4,
    marginBottom: 8,
  },
  roleButton: {
    flex: 1,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 20,
  },
  roleButtonActive: {
    overflow: 'hidden',
  },
  roleButtonGradient: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  roleButtonText: {
    ...bcctTypography.bodyMedium,
  },
  roleButtonTextActive: {
    ...bcctTypography.bodyMedium,
    color: '#fff',
  },
  roleHelperText: {
    ...bcctTypography.small,
    textAlign: 'center',
  },
  title: {
    ...bcctTypography.h2,
    marginBottom: 20,
    textAlign: 'center',
  },
  input: {
    height: 48,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 16,
    marginBottom: 12,
    ...bcctTypography.body,
  },
  primaryButtonContainer: {
    marginTop: 8,
    borderRadius: 12,
    overflow: 'hidden',
  },
  primaryButton: {
    height: 48,
    justifyContent: 'center',
    alignItems: 'center',
  },
  primaryButtonText: {
    color: '#fff',
    ...bcctTypography.button,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  switchModeButton: {
    marginTop: 12,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
  },
  switchModeText: {
    ...bcctTypography.small,
  },
  switchModeTextAccent: {
    ...bcctTypography.small,
    fontWeight: '600',
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 16,
  },
  dividerLine: {
    flex: 1,
    height: 1,
  },
  dividerText: {
    marginHorizontal: 12,
    ...bcctTypography.small,
  },
  socialIconsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
  },
  socialIconButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
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
    marginBottom: 24,
  },
  modalButton: {
    paddingHorizontal: 32,
    paddingVertical: 12,
    borderRadius: 12,
    minWidth: 100,
  },
  modalButtonText: {
    color: '#fff',
    ...bcctTypography.button,
    textAlign: 'center',
  },
});
