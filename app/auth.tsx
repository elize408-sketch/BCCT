
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
import AntDesign from '@expo/vector-icons/AntDesign';
import { supabase } from '@/lib/supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';

type Mode = 'signin' | 'signup';

export default function AuthScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const { signInWithPassword, signInWithGoogle, signInWithApple, loading: authLoading } = useAuth();

  const [mode, setMode] = useState<Mode>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [name, setName] = useState('');
  const [signupInviteCode, setSignupInviteCode] = useState('');
  const [loginInviteCode, setLoginInviteCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [modalTitle, setModalTitle] = useState('');
  const [modalMessage, setModalMessage] = useState('');
  const [modalType, setModalType] = useState<'success' | 'error'>('error');
  const [selectedRole, setSelectedRole] = useState<'client' | 'coach'>('client');

  const showModal = (title: string, message: string, type: 'success' | 'error' = 'error') => {
    setModalTitle(title);
    setModalMessage(message);
    setModalType(type);
    setModalVisible(true);
  };

  if (authLoading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={bcctColors.primaryOrange} />
      </View>
    );
  }

  const handleEmailAuth = async () => {
    console.log('[Auth] handleEmailAuth called, mode:', mode, 'role:', selectedRole, 'inviteCode:', inviteCode ? 'provided' : 'empty');
    
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
        console.log('[Auth] Signing up user with role:', selectedRole, 'inviteCode:', signupInviteCode ? 'provided' : 'empty');
        
        // Validate invite code for clients
        if (selectedRole === 'client' && !signupInviteCode.trim()) {
          showModal('Fout', 'Coachcode is verplicht voor cliënten');
          setLoading(false);
          return;
        }
        
        // Step 1: Sign up with Supabase Auth
        const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
          email,
          password,
        });

        if (signUpError) {
          console.error('[Auth] Sign up error:', signUpError);
          throw signUpError;
        }

        if (!signUpData.user) {
          throw new Error('Signup failed - no user returned');
        }

        console.log('[Auth] User signed up successfully:', signUpData.user.id);

        // Step 2: Create profile with selected role
        const profileData = {
          id: signUpData.user.id,
          full_name: name || null,
          role: selectedRole,
          onboarding_completed: false,
          created_at: new Date().toISOString(),
        };

        console.log('[Auth] Creating profile:', profileData);

        const { error: profileError } = await supabase
          .from('profiles')
          .upsert(profileData);

        if (profileError) {
          console.error('[Auth] Profile creation error:', profileError);
          showModal('Waarschuwing', 'Account aangemaakt, maar profiel kon niet worden opgeslagen. Probeer opnieuw in te loggen.');
        } else {
          console.log('[Auth] Profile created successfully');
        }

        // Step 3: Claim invite code if client
        if (selectedRole === 'client' && signupInviteCode.trim()) {
          console.log('[Auth] Claiming invite code during signup:', signupInviteCode.trim());
          
          try {
            const { data: claimData, error: claimError } = await supabase.rpc('claim_client_invite', {
              p_code: signupInviteCode.trim().toUpperCase(),
            });

            if (claimError) {
              console.error('[Auth] Claim invite error:', claimError);
              
              // Delete the user account since invite claim failed
              await supabase.auth.signOut();
              
              throw new Error('Coachcode ongeldig of verlopen. Controleer de code en probeer opnieuw.');
            }

            console.log('[Auth] Invite claimed successfully during signup:', claimData);
          } catch (claimErr: any) {
            console.error('[Auth] Invite claim failed:', claimErr);
            setLoading(false);
            showModal('Fout', claimErr.message || 'Coachcode ongeldig of verlopen');
            return;
          }
        }

        showModal(
          'Gelukt',
          'Account succesvol aangemaakt! Je kunt nu inloggen.',
          'success'
        );
        setMode('signin');
        setPassword('');
        setConfirmPassword('');
        setSignupInviteCode('');
      } else {
        // Sign in mode
        console.log('[Auth] Signing in user with role:', selectedRole);
        
        // Step 1: Sign in with Supabase Auth
        const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (signInError) {
          console.error('[Auth] Sign in error:', signInError);
          throw signInError;
        }

        if (!signInData.user) {
          throw new Error('Sign in failed - no user returned');
        }

        console.log('[Auth] User signed in successfully:', signInData.user.id);

        // Step 2: Ensure profile exists (upsert without overwriting role if user chose Coach)
        const existingProfileQuery = await supabase
          .from('profiles')
          .select('role')
          .eq('id', signInData.user.id)
          .single();

        const existingRole = existingProfileQuery.data?.role;
        console.log('[Auth] Existing profile role:', existingRole);

        // Only set role if profile doesn't exist OR if user chose client
        const profileData: any = {
          id: signInData.user.id,
          created_at: new Date().toISOString(),
        };

        // Don't overwrite role if user chose Coach and profile already exists
        if (!existingRole || selectedRole === 'client') {
          profileData.role = selectedRole;
        }

        console.log('[Auth] Upserting profile:', profileData);

        const { error: profileError } = await supabase
          .from('profiles')
          .upsert(profileData, { onConflict: 'id' });

        if (profileError) {
          console.error('[Auth] Profile upsert error:', profileError);
        }

        // Step 3: Claim invite code if provided and role is client (optional on login)
        if (selectedRole === 'client' && loginInviteCode.trim()) {
          console.log('[Auth] Claiming invite code on login:', loginInviteCode.trim());
          
          try {
            const { data: claimData, error: claimError } = await supabase.rpc('claim_client_invite', {
              p_code: loginInviteCode.trim().toUpperCase(),
            });

            if (claimError) {
              console.error('[Auth] Claim invite error:', claimError);
              
              // Check for specific error messages
              if (claimError.message.includes('Invalid invite code') || claimError.message.includes('not found')) {
                throw new Error('Code ongeldig. Controleer de code van je coach.');
              }
              
              throw claimError;
            }

            console.log('[Auth] Invite claimed successfully on login:', claimData);
          } catch (claimErr: any) {
            console.error('[Auth] Invite claim failed:', claimErr);
            
            // Show user-friendly error but don't block login
            showModal('Fout', claimErr.message || 'Code kon niet worden gekoppeld. Neem contact op met je coach.');
            setLoading(false);
            return;
          }
        }

        // Step 4: Fetch fresh profile and route to correct home
        console.log('[Auth] Fetching fresh profile for routing...');
        const { data: freshProfile } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', signInData.user.id)
          .single();

        const finalRole = freshProfile?.role || selectedRole;
        console.log('[Auth] Final role for routing:', finalRole);

        // Route based on role
        if (finalRole === 'coach') {
          console.log('[Auth] Routing to coach home');
          router.replace('/(app)/coach');
        } else {
          console.log('[Auth] Routing to client home');
          router.replace('/(app)/client');
        }
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
    const inviteCodeToUse = mode === 'signup' ? signupInviteCode : loginInviteCode;
    console.log('[Auth] Social auth initiated:', provider, 'with role:', selectedRole, 'mode:', mode, 'inviteCode:', inviteCodeToUse ? 'provided' : 'empty');
    
    // Validate invite code for client signup
    if (mode === 'signup' && selectedRole === 'client' && !inviteCodeToUse.trim()) {
      showModal('Fout', 'Coachcode is verplicht voor cliënten');
      return;
    }
    
    // Store selected role and invite code in AsyncStorage before OAuth redirect
    await AsyncStorage.setItem('pendingRole', selectedRole);
    await AsyncStorage.setItem('pendingMode', mode);
    if (inviteCodeToUse.trim()) {
      await AsyncStorage.setItem('pendingInviteCode', inviteCodeToUse.trim().toUpperCase());
    }
    
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
  
  const roleText = mode === 'signup' 
    ? (selectedRole === 'client' ? 'Registreer als Cliënt' : 'Registreer als Coach')
    : (selectedRole === 'client' ? 'Log in als cliënt' : 'Log in als coach');

  const showSignupInviteCodeInput = mode === 'signup' && selectedRole === 'client';
  const showLoginInviteCodeInput = mode === 'signin' && selectedRole === 'client';

  return (
    <>
      <KeyboardAvoidingView
        style={[styles.container, { backgroundColor: colors.background }]}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={styles.content}>
          <View style={styles.brandingHeader}>
            <Text style={[styles.welcomeText, { color: secondaryTextColor }]}>
              Welkom bij
            </Text>
            <Image
              source={require('@/assets/images/8197d584-e819-49fe-80a6-96a6acac58fb.png')}
              style={styles.logo}
              resizeMode="contain"
            />
          </View>

          <View style={styles.roleContainer}>
            <View style={styles.roleSelector}>
              <TouchableOpacity
                style={[
                  styles.roleCard,
                  { backgroundColor: colors.card, borderColor: selectedRole === 'client' ? 'transparent' : `${bcctColors.primaryOrange}33` },
                  selectedRole === 'client' && styles.roleCardActive,
                ]}
                onPress={() => setSelectedRole('client')}
              >
                {selectedRole === 'client' ? (
                  <LinearGradient
                    colors={[bcctColors.primaryOrange, bcctColors.primaryOrangeDark]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.roleCardGradient}
                  >
                    <Text style={styles.roleCardTextActive}>Cliënt</Text>
                  </LinearGradient>
                ) : (
                  <Text style={[styles.roleCardText, { color: colors.text }]}>Cliënt</Text>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.roleCard,
                  { backgroundColor: colors.card, borderColor: selectedRole === 'coach' ? 'transparent' : `${bcctColors.primaryOrange}33` },
                  selectedRole === 'coach' && styles.roleCardActive,
                ]}
                onPress={() => setSelectedRole('coach')}
              >
                {selectedRole === 'coach' ? (
                  <LinearGradient
                    colors={[bcctColors.primaryOrange, bcctColors.primaryOrangeDark]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.roleCardGradient}
                  >
                    <Text style={styles.roleCardTextActive}>Coach</Text>
                  </LinearGradient>
                ) : (
                  <Text style={[styles.roleCardText, { color: colors.text }]}>Coach</Text>
                )}
              </TouchableOpacity>
            </View>
            <Text style={[styles.roleHelperText, { color: secondaryTextColor }]}>
              {roleText}
            </Text>
          </View>

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

          {showSignupInviteCodeInput && (
            <View style={styles.inviteCodeContainer}>
              <Text style={[styles.inviteCodeLabel, { color: secondaryTextColor }]}>
                Coachcode *
              </Text>
              <TextInput
                style={[
                  styles.input,
                  styles.inviteCodeInput,
                  {
                    backgroundColor: inputBackgroundColor,
                    borderColor: inputBorderColor,
                    color: inputTextColor,
                  },
                ]}
                placeholder="Bijv. COACH-PATRICIA"
                placeholderTextColor={secondaryTextColor}
                value={signupInviteCode}
                onChangeText={setSignupInviteCode}
                autoCapitalize="characters"
                autoCorrect={false}
                maxLength={40}
              />
              <Text style={[styles.inviteCodeHelper, { color: secondaryTextColor }]}>
                Vraag je coach om een uitnodigingscode
              </Text>
            </View>
          )}

          {showLoginInviteCodeInput && (
            <View style={styles.inviteCodeContainer}>
              <Text style={[styles.inviteCodeLabel, { color: secondaryTextColor }]}>
                Coachcode (optioneel)
              </Text>
              <TextInput
                style={[
                  styles.input,
                  styles.inviteCodeInput,
                  {
                    backgroundColor: inputBackgroundColor,
                    borderColor: inputBorderColor,
                    color: inputTextColor,
                  },
                ]}
                placeholder="Bijv. COACH-PATRICIA"
                placeholderTextColor={secondaryTextColor}
                value={loginInviteCode}
                onChangeText={setLoginInviteCode}
                autoCapitalize="characters"
                autoCorrect={false}
                maxLength={40}
              />
              <Text style={[styles.inviteCodeHelper, { color: secondaryTextColor }]}>
                Met deze code word je gekoppeld aan je coach
              </Text>
            </View>
          )}

          <TouchableOpacity
            style={[styles.primaryButtonContainer, loading && styles.buttonDisabled]}
            onPress={handleEmailAuth}
            disabled={loading}
            activeOpacity={0.9}
          >
            <LinearGradient
              colors={loading ? [bcctColors.primaryOrangeDisabled, bcctColors.primaryOrangeDisabled] : [bcctColors.primaryOrange, bcctColors.primaryOrangeDark]}
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
              setSignupInviteCode('');
              setLoginInviteCode('');
            }}
          >
            <Text style={[styles.switchModeText, { color: secondaryTextColor }]}>
              {mode === 'signup' ? 'Heb je al een account? ' : 'Nog geen account? '}
            </Text>
            <Text style={[styles.switchModeTextAccent, { color: bcctColors.primaryOrangeLight }]}>
              {mode === 'signup' ? 'Inloggen' : 'Registreren'}
            </Text>
          </TouchableOpacity>

          <View style={styles.divider}>
            <View style={[styles.dividerLine, { backgroundColor: inputBorderColor }]} />
            <Text style={[styles.dividerText, { color: secondaryTextColor }]}>of</Text>
            <View style={[styles.dividerLine, { backgroundColor: inputBorderColor }]} />
          </View>

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
              <AntDesign name="google" size={28} color="#DB4437" />
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
              <AntDesign name="apple" size={28} color={colors.text} />
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
    marginBottom: 16,
  },
  welcomeText: {
    ...bcctTypography.small,
    marginBottom: 8,
  },
  logo: {
    width: 240,
    height: 72,
  },
  roleContainer: {
    marginBottom: 16,
  },
  roleSelector: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 8,
  },
  roleCard: {
    flex: 1,
    height: 45,
    borderRadius: 16,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  roleCardActive: {
    overflow: 'hidden',
    borderWidth: 0,
  },
  roleCardGradient: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  roleCardText: {
    ...bcctTypography.bodyMedium,
  },
  roleCardTextActive: {
    ...bcctTypography.bodyMedium,
    color: '#FFFFFF',
  },
  roleHelperText: {
    ...bcctTypography.small,
    textAlign: 'center',
  },
  title: {
    ...bcctTypography.h2,
    marginBottom: 16,
    textAlign: 'center',
  },
  input: {
    height: 48,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 16,
    marginBottom: 10,
    ...bcctTypography.body,
  },
  inviteCodeContainer: {
    marginBottom: 4,
  },
  inviteCodeInput: {
    marginBottom: 4,
  },
  inviteCodeLabel: {
    ...bcctTypography.small,
    marginBottom: 6,
    marginLeft: 4,
    fontWeight: '600',
  },
  inviteCodeHelper: {
    ...bcctTypography.small,
    fontSize: 11,
    marginBottom: 8,
    marginLeft: 4,
  },
  primaryButtonContainer: {
    marginTop: 6,
    borderRadius: 12,
    overflow: 'hidden',
  },
  primaryButton: {
    height: 48,
    justifyContent: 'center',
    alignItems: 'center',
  },
  primaryButtonText: {
    color: '#FFFFFF',
    ...bcctTypography.button,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  switchModeButton: {
    marginTop: 10,
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
    marginVertical: 14,
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
