
import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Linking,
  KeyboardAvoidingView,
  Platform,
  Image,
  ImageSourcePropType,
} from 'react-native';
import Modal from 'react-native-modal';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '@react-navigation/native';
import { useFocusEffect } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import { router } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { bcctColors, bcctTypography } from '@/styles/bcctTheme';

// ─── Types ────────────────────────────────────────────────────────────────────

interface CoachProfile {
  stripe_account_id: string | null;
  stripe_charges_enabled: boolean | null;
  stripe_payouts_enabled: boolean | null;
  stripe_onboarding_completed: boolean | null;
  business_name: string | null;
  logo_url: string | null;
  primary_color: string | null;
  invoice_footer: string | null;
  kvk: string | null;
  btw_number: string | null;
  iban: string | null;
}

interface Client {
  id: string;
  full_name: string | null;
  stripe_email: string | null;
}

interface FormErrors {
  client?: string;
  amount?: string;
  clientEmail?: string;
  description?: string;
}

function resolveImageSource(source: string | number | ImageSourcePropType | undefined): ImageSourcePropType {
  if (!source) return { uri: '' };
  if (typeof source === 'string') return { uri: source };
  return source as ImageSourcePropType;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const SUPABASE_URL = Constants.expoConfig?.extra?.supabaseUrl as string;
const SUPABASE_ANON_KEY = Constants.expoConfig?.extra?.supabaseAnonKey as string;
const CHECKOUT_ENDPOINT = `${SUPABASE_URL}/functions/v1/billing-checkout-session`;
const STRIPE_STATUS_ENDPOINT = `${SUPABASE_URL}/functions/v1/stripe-connect-status`;

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function CoachBillingScreen() {
  const { colors } = useTheme();
  const { user } = useAuth();

  const [loadingProfile, setLoadingProfile] = useState(true);
  const [profile, setProfile] = useState<CoachProfile | null>(null);
  const [stripeConnectLoading] = useState(false);
  const [stripeConnectError] = useState<string | null>(null);
  const [clients, setClients] = useState<Client[]>([]);
  const [loadingClients, setLoadingClients] = useState(false);

  // Form state
  const [formVisible, setFormVisible] = useState(false);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [clientPickerVisible, setClientPickerVisible] = useState(false);
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [clientEmail, setClientEmail] = useState('');
  const [errors, setErrors] = useState<FormErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const [successVisible, setSuccessVisible] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // ─── Data loading ──────────────────────────────────────────────────────────

  const loadProfile = useCallback(async () => {
    if (!user) return;
    console.log('[Billing] Loading coach profile for user:', user.id);
    setLoadingProfile(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const { data, error } = await supabase
        .from('profiles')
        .select('stripe_account_id, stripe_charges_enabled, stripe_payouts_enabled, stripe_onboarding_completed, business_name, logo_url, primary_color, invoice_footer, kvk, btw_number, iban')
        .eq('id', session.user.id)
        .single();

      if (error) {
        console.error('[Billing] Error loading profile:', error);
      } else {
        console.log('[Billing] Profile loaded — stripe_account_id:', data?.stripe_account_id ?? 'none', '| charges_enabled:', data?.stripe_charges_enabled, '| payouts_enabled:', data?.stripe_payouts_enabled, '| onboarding_completed:', data?.stripe_onboarding_completed);
        setProfile(data as CoachProfile);
      }
    } catch (err) {
      console.error('[Billing] Unexpected error loading profile:', err);
    } finally {
      setLoadingProfile(false);
    }
  }, [user]);

  const loadClients = useCallback(async () => {
    if (!user) return;
    console.log('[Billing] Fetching clients for coach:', user.id);
    setLoadingClients(true);
    try {
      const { data: coachClients, error: ccError } = await supabase
        .from('coach_clients')
        .select('client_id')
        .eq('coach_id', user.id);

      console.log('[Billing] coach_clients result:', coachClients, ccError);

      if (ccError) {
        console.error('[Billing] Error fetching coach_clients:', ccError);
        setLoadingClients(false);
        return;
      }

      if (!coachClients || coachClients.length === 0) {
        console.log('[Billing] No clients found');
        setClients([]);
        setLoadingClients(false);
        return;
      }

      const clientIds = coachClients.map((c) => c.client_id);
      const { data: profilesData, error: pError } = await supabase
        .from('profiles')
        .select('id, full_name, stripe_email')
        .in('id', clientIds);

      console.log('[Billing] profiles result:', profilesData, pError);

      if (pError) {
        console.error('[Billing] Error fetching profiles:', pError);
      } else {
        console.log('[Billing] Clients loaded:', profilesData?.length ?? 0);
        setClients(profilesData ?? []);
      }
    } catch (err) {
      console.error('[Billing] Unexpected error loading clients:', err);
    } finally {
      setLoadingClients(false);
    }
  }, [user]);

  useEffect(() => {
    loadClients();
  }, [loadClients]);

  // Reload profile every time the screen comes into focus (picks up Stripe status changes)
  useFocusEffect(
    useCallback(() => {
      loadProfile();
    }, [loadProfile])
  );

  // ─── Stripe Connect handler ────────────────────────────────────────────────

  const handleCreateStripeAccount = () => {
    console.log('[Billing] Stripe koppelen/doorgaan pressed — navigating to onboarding WebView');
    router.push({
      pathname: '/stripe-onboarding-webview',
      params: { returnTo: 'billing' },
    });
  };

  // ─── Form helpers ──────────────────────────────────────────────────────────

  const openForm = () => {
    console.log('[Billing] Opening Factuur maken form');
    setSelectedClient(null);
    setAmount('');
    setDescription('');
    setClientEmail('');
    setErrors({});
    setSubmitError(null);
    setFormVisible(true);
  };

  const closeForm = () => {
    console.log('[Billing] Closing Factuur maken form');
    setFormVisible(false);
  };

  const handleSelectClient = (client: Client) => {
    console.log('[Billing] Client selected:', client.id, client.full_name);
    setSelectedClient(client);
    setClientEmail(client.stripe_email ?? '');
    setClientPickerVisible(false);
    setErrors((prev) => ({ ...prev, client: undefined, clientEmail: undefined }));
  };

  const validate = (): boolean => {
    const newErrors: FormErrors = {};
    if (!selectedClient) newErrors.client = 'Selecteer een cliënt';
    const parsedAmount = parseFloat(amount);
    if (!amount || isNaN(parsedAmount) || parsedAmount <= 0) {
      newErrors.amount = 'Voer een geldig bedrag in (> 0)';
    }
    if (!clientEmail || !clientEmail.includes('@')) {
      newErrors.clientEmail = 'Voer een geldig e-mailadres in';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    console.log('[Billing] Factuur sturen pressed');
    if (!validate()) {
      console.log('[Billing] Validation failed:', errors);
      return;
    }

    const coachId = user!.id;
    const parsedAmount = parseFloat(amount);
    const payload = {
      coachId,
      amount: parsedAmount,
      clientEmail: clientEmail.trim(),
      description: description.trim() || 'Coaching sessie',
    };

    console.log('[Billing] POST billing-checkout-session:', payload);
    setSubmitting(true);
    setSubmitError(null);

    try {
      const response = await fetch(CHECKOUT_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errText = await response.text();
        console.error('[Billing] Checkout session error:', response.status, errText);
        setSubmitError(`Fout (${response.status}): ${errText || 'Onbekende fout'}`);
        return;
      }

      const data = await response.json();
      console.log('[Billing] Checkout session response:', data);

      if (data.url) {
        console.log('[Billing] Opening Stripe Checkout URL:', data.url);
        setFormVisible(false);
        setSuccessVisible(true);
        await Linking.openURL(data.url);
      } else {
        console.error('[Billing] No URL in response:', data);
        setSubmitError('Geen betaallink ontvangen. Probeer opnieuw.');
      }
    } catch (err: any) {
      console.error('[Billing] Network error:', err);
      setSubmitError('Netwerkfout. Controleer je verbinding en probeer opnieuw.');
    } finally {
      setSubmitting(false);
    }
  };

  // ─── Render ────────────────────────────────────────────────────────────────

  if (loadingProfile) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
        <View style={[styles.header, { borderBottomColor: colors.border }]}>
          <Text style={[styles.headerTitle, { color: colors.text }]}>Facturatie</Text>
        </View>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={bcctColors.primaryOrange} />
        </View>
      </SafeAreaView>
    );
  }

  const accentColor = profile?.primary_color || bcctColors.primaryOrange;
  const accentColorDark = profile?.primary_color || bcctColors.primaryOrangeDark;
  const accentColorDisabled = profile?.primary_color ? profile.primary_color + '80' : bcctColors.primaryOrangeDisabled;

  const stripeFullyConnected =
    !!profile?.stripe_account_id &&
    !!profile?.stripe_onboarding_completed &&
    !!profile?.stripe_charges_enabled &&
    !!profile?.stripe_payouts_enabled;

  const stripeIncomplete =
    !!profile?.stripe_account_id &&
    (!profile?.stripe_onboarding_completed || !profile?.stripe_charges_enabled || !profile?.stripe_payouts_enabled);

  const selectedClientName = selectedClient ? (selectedClient.full_name ?? 'Cliënt') : null;
  const selectedClientEmail = selectedClient ? (selectedClient.stripe_email ?? '') : null;

  const chargesDisabled = !profile?.stripe_charges_enabled;
  const payoutsDisabled = !profile?.stripe_payouts_enabled;

  // State 1: No Stripe account at all
  if (!profile?.stripe_account_id) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
        <View style={[styles.header, { borderBottomColor: colors.border }]}>
          <Text style={[styles.headerTitle, { color: colors.text }]}>Facturatie</Text>
        </View>
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          <View style={styles.emptyState}>
            <View style={[styles.emptyIconWrap, { backgroundColor: accentColor + '18' }]}>
              <Ionicons name="card-outline" size={48} color={accentColor} />
            </View>
            <Text style={[styles.emptyTitle, { color: colors.text }]}>Stripe nog niet gekoppeld</Text>
            <Text style={[styles.emptySub, { color: bcctColors.textSecondary }]}>
              Koppel eerst je Stripe account om betalingen te ontvangen.
            </Text>
            {!!stripeConnectError && (
              <View style={styles.connectErrorBox}>
                <Ionicons name="alert-circle-outline" size={16} color={bcctColors.error} />
                <Text style={styles.connectErrorText}>{stripeConnectError}</Text>
              </View>
            )}
            <TouchableOpacity
              style={[styles.stripeButtonContainer, stripeConnectLoading && styles.stripeButtonDisabled]}
              activeOpacity={0.9}
              disabled={stripeConnectLoading}
              onPress={handleCreateStripeAccount}
            >
              <LinearGradient
                colors={stripeConnectLoading
                  ? [accentColorDisabled, accentColorDisabled]
                  : [accentColor, accentColorDark]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.stripeButton}
              >
                {stripeConnectLoading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <>
                    <Ionicons name="link-outline" size={20} color="#fff" />
                    <Text style={styles.stripeButtonText}>Stripe koppelen</Text>
                  </>
                )}
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // State 2: Account exists but onboarding/charges/payouts not complete
  if (stripeIncomplete) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
        <View style={[styles.header, { borderBottomColor: colors.border }]}>
          <Text style={[styles.headerTitle, { color: colors.text }]}>Facturatie</Text>
        </View>
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          <View style={styles.emptyState}>
            <View style={[styles.emptyIconWrap, { backgroundColor: bcctColors.accentOrange + '18' }]}>
              <Ionicons name="warning-outline" size={48} color={bcctColors.accentOrange} />
            </View>
            <Text style={[styles.emptyTitle, { color: colors.text }]}>Maak je Stripe account af</Text>
            <Text style={[styles.emptySub, { color: bcctColors.textSecondary }]}>
              Rond je Stripe onboarding af om betalingen en uitbetalingen te activeren.
            </Text>
            {(chargesDisabled || payoutsDisabled) && (
              <View style={styles.statusInfoBox}>
                {chargesDisabled && (
                  <View style={styles.statusInfoRow}>
                    <Ionicons name="close-circle-outline" size={16} color={bcctColors.error} />
                    <Text style={[styles.statusInfoText, { color: bcctColors.error }]}>Betalingen ontvangen: niet actief</Text>
                  </View>
                )}
                {payoutsDisabled && (
                  <View style={styles.statusInfoRow}>
                    <Ionicons name="close-circle-outline" size={16} color={bcctColors.error} />
                    <Text style={[styles.statusInfoText, { color: bcctColors.error }]}>Uitbetalingen: niet actief</Text>
                  </View>
                )}
              </View>
            )}
            {!!stripeConnectError && (
              <View style={styles.connectErrorBox}>
                <Ionicons name="alert-circle-outline" size={16} color={bcctColors.error} />
                <Text style={styles.connectErrorText}>{stripeConnectError}</Text>
              </View>
            )}
            <TouchableOpacity
              style={[styles.stripeButtonContainer, stripeConnectLoading && styles.stripeButtonDisabled]}
              activeOpacity={0.9}
              disabled={stripeConnectLoading}
              onPress={handleCreateStripeAccount}
            >
              <LinearGradient
                colors={stripeConnectLoading
                  ? [accentColorDisabled, accentColorDisabled]
                  : [accentColor, accentColorDark]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.stripeButton}
              >
                {stripeConnectLoading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <>
                    <Ionicons name="arrow-forward-circle-outline" size={20} color="#fff" />
                    <Text style={styles.stripeButtonText}>Onboarding hervatten</Text>
                  </>
                )}
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // State 3: Fully connected — show real billing UI
  void stripeFullyConnected;

  return (
    <>
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
        <View style={[styles.header, { borderBottomColor: colors.border }]}>
          <Text style={[styles.headerTitle, { color: colors.text }]}>Facturatie</Text>
        </View>

        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          {/* Connected badge + business info card */}
          <View style={[styles.infoCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            {profile?.logo_url ? (
              <Image source={resolveImageSource(profile.logo_url)} style={styles.businessLogo} />
            ) : (
              <View style={[styles.infoCardIcon, { backgroundColor: accentColor + '18' }]}>
                <Ionicons name="card-outline" size={28} color={accentColor} />
              </View>
            )}
            <View style={styles.infoCardText}>
              {profile?.business_name ? (
                <Text style={[styles.infoCardTitle, { color: colors.text }]}>{profile.business_name}</Text>
              ) : (
                <Text style={[styles.infoCardTitle, { color: colors.text }]}>Stripe gekoppeld</Text>
              )}
              <Text style={[styles.infoCardSub, { color: bcctColors.textSecondary }]}>
                Stuur betaallinks rechtstreeks naar je cliënten.
              </Text>
            </View>
            <View style={[styles.connectedBadge, { backgroundColor: bcctColors.success + '15', borderRadius: 20, paddingHorizontal: 8, paddingVertical: 4, flexDirection: 'row', alignItems: 'center', gap: 4 }]}>
              <Ionicons name="checkmark-circle" size={14} color={bcctColors.success} />
              <Text style={[styles.connectedBadgeText, { color: bcctColors.success }]}>Verbonden</Text>
            </View>
          </View>

          {/* Business details block */}
          {(profile?.kvk || profile?.btw_number || profile?.iban) && (
            <View style={[styles.businessDetailsCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Text style={[styles.businessDetailsTitle, { color: colors.text }]}>Bedrijfsgegevens</Text>
              {profile?.kvk ? (
                <View style={styles.businessDetailRow}>
                  <Text style={[styles.businessDetailLabel, { color: bcctColors.textSecondary }]}>KVK</Text>
                  <Text style={[styles.businessDetailValue, { color: colors.text }]}>{profile.kvk}</Text>
                </View>
              ) : null}
              {profile?.btw_number ? (
                <View style={styles.businessDetailRow}>
                  <Text style={[styles.businessDetailLabel, { color: bcctColors.textSecondary }]}>BTW</Text>
                  <Text style={[styles.businessDetailValue, { color: colors.text }]}>{profile.btw_number}</Text>
                </View>
              ) : null}
              {profile?.iban ? (
                <View style={styles.businessDetailRow}>
                  <Text style={[styles.businessDetailLabel, { color: bcctColors.textSecondary }]}>IBAN</Text>
                  <Text style={[styles.businessDetailValue, { color: colors.text }]}>{profile.iban}</Text>
                </View>
              ) : null}
            </View>
          )}

          {/* CTA */}
          <TouchableOpacity
            style={styles.ctaButtonContainer}
            onPress={openForm}
            activeOpacity={0.9}
          >
            <LinearGradient
              colors={[accentColor, accentColorDark]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.ctaButton}
            >
              <Ionicons name="receipt-outline" size={22} color="#fff" />
              <Text style={styles.ctaButtonText}>Nieuwe factuur</Text>
            </LinearGradient>
          </TouchableOpacity>

          <View style={{ height: 100 }} />
        </ScrollView>
      </SafeAreaView>

      {/* ── Factuur maken modal ─────────────────────────────────────────────── */}
      <Modal
        isVisible={formVisible}
        onBackdropPress={closeForm}
        onBackButtonPress={closeForm}
        animationIn="slideInUp"
        animationOut="slideOutDown"
        backdropOpacity={0.45}
        style={styles.bottomModal}
        avoidKeyboard
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.modalWrapper}
        >
          <View style={[styles.modalSheet, { backgroundColor: colors.card }]}>
            {/* Handle */}
            <View style={[styles.handle, { backgroundColor: colors.border }]} />

            {/* Header */}
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>Factuur maken</Text>
              <TouchableOpacity onPress={closeForm} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Ionicons name="close-circle" size={28} color={bcctColors.textSecondary} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              {/* Client selector */}
              <View style={styles.fieldGroup}>
                <Text style={[styles.fieldLabel, { color: colors.text }]}>Cliënt</Text>
                <TouchableOpacity
                  style={[
                    styles.pickerButton,
                    { backgroundColor: colors.background, borderColor: errors.client ? bcctColors.error : colors.border },
                  ]}
                  onPress={() => {
                    console.log('[Billing] Client picker opened');
                    setClientPickerVisible(true);
                  }}
                  activeOpacity={0.7}
                >
                  {selectedClientName ? (
                    <View style={styles.pickerSelected}>
                      <View style={[styles.pickerAvatar, { backgroundColor: bcctColors.primaryOrange + '20' }]}>
                        <Ionicons name="person" size={16} color={bcctColors.primaryOrange} />
                      </View>
                      <View>
                        <Text style={[styles.pickerSelectedName, { color: colors.text }]}>{selectedClientName}</Text>
                        <Text style={[styles.pickerSelectedEmail, { color: bcctColors.textSecondary }]}>{selectedClientEmail}</Text>
                      </View>
                    </View>
                  ) : (
                    <Text style={[styles.pickerPlaceholder, { color: bcctColors.textSecondary }]}>
                      {loadingClients ? 'Cliënten laden...' : 'Selecteer een cliënt'}
                    </Text>
                  )}
                  <Ionicons name="chevron-down" size={18} color={bcctColors.textSecondary} />
                </TouchableOpacity>
                {errors.client ? <Text style={styles.errorText}>{errors.client}</Text> : null}
              </View>

              {/* Amount */}
              <View style={styles.fieldGroup}>
                <Text style={[styles.fieldLabel, { color: colors.text }]}>Bedrag (€)</Text>
                <View style={[
                  styles.inputRow,
                  { backgroundColor: colors.background, borderColor: errors.amount ? bcctColors.error : colors.border },
                ]}>
                  <Text style={[styles.currencySymbol, { color: bcctColors.textSecondary }]}>€</Text>
                  <TextInput
                    style={[styles.input, { color: colors.text }]}
                    placeholder="75.00"
                    placeholderTextColor={bcctColors.textSecondary}
                    keyboardType="decimal-pad"
                    value={amount}
                    onChangeText={(v) => {
                      setAmount(v);
                      setErrors((prev) => ({ ...prev, amount: undefined }));
                    }}
                  />
                </View>
                {errors.amount ? <Text style={styles.errorText}>{errors.amount}</Text> : null}
              </View>

              {/* Description */}
              <View style={styles.fieldGroup}>
                <Text style={[styles.fieldLabel, { color: colors.text }]}>Omschrijving</Text>
                <TextInput
                  style={[
                    styles.inputField,
                    { backgroundColor: colors.background, borderColor: colors.border, color: colors.text },
                  ]}
                  placeholder="Coaching sessie"
                  placeholderTextColor={bcctColors.textSecondary}
                  value={description}
                  onChangeText={setDescription}
                  returnKeyType="next"
                />
              </View>

              {/* Client email */}
              <View style={styles.fieldGroup}>
                <Text style={[styles.fieldLabel, { color: colors.text }]}>E-mail cliënt</Text>
                <TextInput
                  style={[
                    styles.inputField,
                    {
                      backgroundColor: colors.background,
                      borderColor: errors.clientEmail ? bcctColors.error : colors.border,
                      color: colors.text,
                    },
                  ]}
                  placeholder="cliënt@email.com"
                  placeholderTextColor={bcctColors.textSecondary}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  value={clientEmail}
                  onChangeText={(v) => {
                    setClientEmail(v);
                    setErrors((prev) => ({ ...prev, clientEmail: undefined }));
                  }}
                />
                {errors.clientEmail ? <Text style={styles.errorText}>{errors.clientEmail}</Text> : null}
              </View>

              {/* Submit error */}
              {submitError ? (
                <View style={styles.submitErrorBox}>
                  <Ionicons name="alert-circle-outline" size={18} color={bcctColors.error} />
                  <Text style={styles.submitErrorText}>{submitError}</Text>
                </View>
              ) : null}

              {/* Actions */}
              <View style={styles.actionsRow}>
                <TouchableOpacity
                  style={[styles.cancelButton, { borderColor: colors.border }]}
                  onPress={closeForm}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.cancelButtonText, { color: bcctColors.textSecondary }]}>Annuleren</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.submitButtonContainer, submitting && styles.submitButtonDisabled]}
                  onPress={handleSubmit}
                  disabled={submitting}
                  activeOpacity={0.9}
                >
                  <LinearGradient
                    colors={submitting
                      ? [bcctColors.primaryOrangeDisabled, bcctColors.primaryOrangeDisabled]
                      : [bcctColors.primaryOrange, bcctColors.primaryOrangeDark]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.submitButton}
                  >
                    {submitting ? (
                      <>
                        <ActivityIndicator size="small" color="#fff" />
                        <Text style={styles.submitButtonText}>Bezig...</Text>
                      </>
                    ) : (
                      <>
                        <Ionicons name="send-outline" size={18} color="#fff" />
                        <Text style={styles.submitButtonText}>Factuur sturen</Text>
                      </>
                    )}
                  </LinearGradient>
                </TouchableOpacity>
              </View>

              <View style={{ height: 24 }} />
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ── Client picker modal ─────────────────────────────────────────────── */}
      <Modal
        isVisible={clientPickerVisible}
        onBackdropPress={() => setClientPickerVisible(false)}
        onBackButtonPress={() => setClientPickerVisible(false)}
        animationIn="slideInUp"
        animationOut="slideOutDown"
        backdropOpacity={0.45}
        style={styles.bottomModal}
      >
        <View style={[styles.pickerSheet, { backgroundColor: colors.card }]}>
          <View style={[styles.handle, { backgroundColor: colors.border }]} />
          <View style={styles.pickerSheetHeader}>
            <Text style={[styles.pickerSheetTitle, { color: colors.text }]}>Selecteer cliënt</Text>
            <TouchableOpacity onPress={() => setClientPickerVisible(false)}>
              <Ionicons name="close-circle" size={28} color={bcctColors.textSecondary} />
            </TouchableOpacity>
          </View>

          {loadingClients ? (
            <View style={styles.pickerLoading}>
              <ActivityIndicator size="large" color={bcctColors.primaryOrange} />
            </View>
          ) : clients.length === 0 ? (
            <View style={styles.pickerEmpty}>
              <Ionicons name="people-outline" size={40} color={bcctColors.textSecondary} />
              <Text style={[styles.pickerEmptyText, { color: bcctColors.textSecondary }]}>
                Geen cliënten gevonden
              </Text>
            </View>
          ) : (
            <ScrollView showsVerticalScrollIndicator={false}>
              {clients.map((client) => {
                const isSelected = selectedClient?.id === client.id;
                return (
                  <TouchableOpacity
                    key={client.id}
                    style={[
                      styles.clientRow,
                      { borderColor: colors.border },
                      isSelected && { backgroundColor: bcctColors.primaryOrange + '12' },
                    ]}
                    onPress={() => handleSelectClient(client)}
                    activeOpacity={0.7}
                  >
                    <View style={[styles.clientRowAvatar, { backgroundColor: bcctColors.primaryOrange + '20' }]}>
                      <Ionicons name="person" size={20} color={bcctColors.primaryOrange} />
                    </View>
                    <View style={styles.clientRowInfo}>
                      <Text style={[styles.clientRowName, { color: colors.text }]}>{client.full_name ?? 'Cliënt'}</Text>
                      <Text style={[styles.clientRowEmail, { color: bcctColors.textSecondary }]}>{client.stripe_email ?? ''}</Text>
                    </View>
                    {isSelected && (
                      <Ionicons name="checkmark-circle" size={22} color={bcctColors.primaryOrange} />
                    )}
                  </TouchableOpacity>
                );
              })}
              <View style={{ height: 24 }} />
            </ScrollView>
          )}
        </View>
      </Modal>

      {/* ── Success modal ───────────────────────────────────────────────────── */}
      <Modal
        isVisible={successVisible}
        onBackdropPress={() => setSuccessVisible(false)}
        onBackButtonPress={() => setSuccessVisible(false)}
        animationIn="fadeIn"
        animationOut="fadeOut"
        backdropOpacity={0.5}
      >
        <View style={[styles.successModal, { backgroundColor: colors.card }]}>
          <View style={[styles.successIconWrap, { backgroundColor: bcctColors.success + '18' }]}>
            <Ionicons name="checkmark-circle" size={56} color={bcctColors.success} />
          </View>
          <Text style={[styles.successTitle, { color: colors.text }]}>Betaallink verstuurd!</Text>
          <Text style={[styles.successSub, { color: bcctColors.textSecondary }]}>
            De Stripe Checkout pagina is geopend. De cliënt ontvangt een betaalbevestiging per e-mail.
          </Text>
          <TouchableOpacity
            style={[styles.successButton, { backgroundColor: bcctColors.primaryOrange }]}
            onPress={() => setSuccessVisible(false)}
          >
            <Text style={styles.successButtonText}>Sluiten</Text>
          </TouchableOpacity>
        </View>
      </Modal>
    </>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 16,
    borderBottomWidth: 1,
    backgroundColor: '#FFFFFF',
  },
  headerTitle: {
    ...bcctTypography.h2,
  },
  scrollContent: {
    padding: 20,
  },

  // Info card
  infoCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 20,
    gap: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  infoCardIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: bcctColors.primaryOrange + '18',
    justifyContent: 'center',
    alignItems: 'center',
  },
  infoCardText: {
    flex: 1,
  },
  infoCardTitle: {
    ...bcctTypography.bodyMedium,
    marginBottom: 2,
  },
  infoCardSub: {
    ...bcctTypography.small,
  },
  connectedBadge: {
    padding: 4,
  },
  connectedBadgeText: {
    ...bcctTypography.small,
    fontWeight: '600',
  },

  // Business logo
  businessLogo: {
    width: 48,
    height: 48,
    borderRadius: 10,
    resizeMode: 'contain',
  },

  // Business details card
  businessDetailsCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  businessDetailsTitle: {
    ...bcctTypography.label,
    marginBottom: 12,
  },
  businessDetailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: bcctColors.borderGray,
  },
  businessDetailLabel: {
    ...bcctTypography.small,
    flex: 1,
  },
  businessDetailValue: {
    ...bcctTypography.bodyMedium,
    flex: 2,
    textAlign: 'right',
  },

  // Status info box (incomplete state)
  statusInfoBox: {
    width: '100%',
    backgroundColor: bcctColors.error + '0D',
    borderRadius: 12,
    padding: 12,
    gap: 8,
  },
  statusInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  statusInfoText: {
    ...bcctTypography.small,
    flex: 1,
  },

  // CTA
  ctaButtonContainer: {
    borderRadius: 18,
    overflow: 'hidden',
  },
  ctaButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 16,
    paddingHorizontal: 24,
  },
  ctaButtonText: {
    color: '#fff',
    ...bcctTypography.button,
    fontSize: 17,
  },

  // Empty state
  emptyState: {
    alignItems: 'center',
    paddingVertical: 60,
    gap: 16,
  },
  emptyIconWrap: {
    width: 96,
    height: 96,
    borderRadius: 48,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  emptyTitle: {
    ...bcctTypography.h3,
    textAlign: 'center',
  },
  emptySub: {
    ...bcctTypography.body,
    textAlign: 'center',
    maxWidth: 280,
  },
  stripeButtonContainer: {
    borderRadius: 18,
    overflow: 'hidden',
    marginTop: 8,
    width: '100%',
  },
  stripeButtonDisabled: {
    opacity: 0.7,
  },
  stripeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 14,
    paddingHorizontal: 24,
  },
  stripeButtonText: {
    color: '#fff',
    ...bcctTypography.button,
  },
  connectErrorBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: bcctColors.error + '12',
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
    width: '100%',
  },
  connectErrorText: {
    color: bcctColors.error,
    ...bcctTypography.small,
    flex: 1,
  },

  // Bottom modal
  bottomModal: {
    margin: 0,
    justifyContent: 'flex-end',
  },
  modalWrapper: {
    width: '100%',
  },
  modalSheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 12,
    maxHeight: '92%',
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 16,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  modalTitle: {
    ...bcctTypography.h3,
  },

  // Form fields
  fieldGroup: {
    marginBottom: 20,
  },
  fieldLabel: {
    ...bcctTypography.label,
    marginBottom: 8,
  },
  pickerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    minHeight: 52,
  },
  pickerSelected: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  pickerAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  pickerSelectedName: {
    ...bcctTypography.bodyMedium,
  },
  pickerSelectedEmail: {
    ...bcctTypography.small,
  },
  pickerPlaceholder: {
    ...bcctTypography.body,
    flex: 1,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    height: 52,
  },
  currencySymbol: {
    ...bcctTypography.bodyMedium,
    marginRight: 6,
  },
  input: {
    flex: 1,
    ...bcctTypography.body,
    paddingVertical: 0,
  },
  inputField: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    height: 52,
    ...bcctTypography.body,
  },
  errorText: {
    color: bcctColors.error,
    ...bcctTypography.small,
    marginTop: 4,
  },
  submitErrorBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: bcctColors.error + '12',
    borderRadius: 10,
    padding: 12,
    marginBottom: 16,
  },
  submitErrorText: {
    color: bcctColors.error,
    ...bcctTypography.small,
    flex: 1,
  },

  // Actions
  actionsRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  cancelButton: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButtonText: {
    ...bcctTypography.button,
  },
  submitButtonContainer: {
    flex: 2,
    borderRadius: 14,
    overflow: 'hidden',
  },
  submitButtonDisabled: {
    opacity: 0.7,
  },
  submitButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
  },
  submitButtonText: {
    color: '#fff',
    ...bcctTypography.button,
  },

  // Client picker sheet
  pickerSheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 12,
    maxHeight: '70%',
  },
  pickerSheetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  pickerSheetTitle: {
    ...bcctTypography.h3,
  },
  pickerLoading: {
    paddingVertical: 40,
    alignItems: 'center',
  },
  pickerEmpty: {
    paddingVertical: 40,
    alignItems: 'center',
    gap: 12,
  },
  pickerEmptyText: {
    ...bcctTypography.body,
  },
  clientRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    gap: 12,
    borderRadius: 8,
    paddingHorizontal: 4,
  },
  clientRowAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  clientRowInfo: {
    flex: 1,
  },
  clientRowName: {
    ...bcctTypography.bodyMedium,
  },
  clientRowEmail: {
    ...bcctTypography.small,
  },

  // Success modal
  successModal: {
    borderRadius: 24,
    padding: 28,
    alignItems: 'center',
    marginHorizontal: 24,
  },
  successIconWrap: {
    width: 88,
    height: 88,
    borderRadius: 44,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  successTitle: {
    ...bcctTypography.h3,
    marginBottom: 8,
    textAlign: 'center',
  },
  successSub: {
    ...bcctTypography.body,
    textAlign: 'center',
    marginBottom: 24,
  },
  successButton: {
    borderRadius: 14,
    paddingHorizontal: 40,
    paddingVertical: 14,
  },
  successButtonText: {
    color: '#fff',
    ...bcctTypography.button,
  },
});
