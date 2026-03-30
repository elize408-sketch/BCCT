
import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import Constants from 'expo-constants';
import { supabase } from '@/lib/supabase';
import { bcctColors, bcctTypography } from '@/styles/bcctTheme';

const SUPABASE_URL = Constants.expoConfig?.extra?.supabaseUrl as string;
const STRIPE_STATUS_ENDPOINT = `${SUPABASE_URL}/functions/v1/stripe-connect-status`;
const STRIPE_CREATE_ENDPOINT = `${SUPABASE_URL}/functions/v1/stripe-connect-create`;

type ScreenState = 'loading' | 'success' | 'incomplete' | 'expired' | 'error';

export default function StripeReturnScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ refresh?: string }>();

  const isRefresh = params.refresh === 'true';

  const [screenState, setScreenState] = useState<ScreenState>(isRefresh ? 'expired' : 'loading');
  const [retryLoading, setRetryLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    if (!isRefresh) {
      fetchStripeStatus();
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const fetchStripeStatus = async () => {
    console.log('[StripeReturn] Fetching Stripe status on mount');
    setScreenState('loading');

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        console.warn('[StripeReturn] No session found');
        setErrorMessage('Geen actieve sessie. Log opnieuw in.');
        setScreenState('error');
        return;
      }

      console.log('[StripeReturn] POST stripe-connect-status');
      const response = await fetch(STRIPE_STATUS_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
      });

      if (!response.ok) {
        const errText = await response.text();
        console.error('[StripeReturn] stripe-connect-status error:', response.status, errText);
        setErrorMessage(`Fout (${response.status}): ${errText || 'Onbekende fout'}`);
        setScreenState('error');
        return;
      }

      const data = await response.json();
      console.log('[StripeReturn] stripe-connect-status response:', data);

      if (data.onboarding_completed) {
        setScreenState('success');
      } else {
        setScreenState('incomplete');
      }
    } catch (err: any) {
      console.error('[StripeReturn] Unexpected error:', err.message);
      setErrorMessage('Netwerkfout. Controleer je verbinding en probeer opnieuw.');
      setScreenState('error');
    }
  };

  const handleRetryCreate = async () => {
    console.log('[StripeReturn] Retry Stripe connect pressed');
    setRetryLoading(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setErrorMessage('Geen actieve sessie. Log opnieuw in.');
        setScreenState('error');
        return;
      }

      console.log('[StripeReturn] POST stripe-connect-create (retry)');
      const response = await fetch(STRIPE_CREATE_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
      });

      const data = await response.json();
      if (!response.ok) {
        console.error('[StripeReturn] stripe-connect-create retry error:', response.status, data);
        setErrorMessage(data.error || `Fout (${response.status})`);
        setScreenState('error');
        return;
      }

      console.log('[StripeReturn] stripe-connect-create retry response — navigating to WebView');
      router.replace({
        pathname: '/stripe-onboarding-webview',
        params: {
          clientSecret: data.client_secret,
          publishableKey: data.publishable_key,
          stripeAccountId: data.stripe_account_id,
          returnTo: 'billing',
        },
      } as any);
    } catch (err: any) {
      console.error('[StripeReturn] Retry error:', err.message);
      setErrorMessage('Netwerkfout. Controleer je verbinding en probeer opnieuw.');
      setScreenState('error');
    } finally {
      setRetryLoading(false);
    }
  };

  const handleToDashboard = () => {
    console.log('[StripeReturn] Naar dashboard pressed');
    router.replace('/(app)/coach/billing' as any);
  };

  if (screenState === 'loading') {
    return (
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={bcctColors.primaryOrange} />
          <Text style={styles.loadingText}>Stripe status ophalen...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (screenState === 'success') {
    return (
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <View style={styles.content}>
          <View style={[styles.iconWrap, { backgroundColor: bcctColors.success + '18' }]}>
            <Ionicons name="checkmark-circle" size={72} color={bcctColors.success} />
          </View>
          <Text style={styles.title}>Stripe account gekoppeld!</Text>
          <Text style={styles.subtitle}>
            Je kunt nu betalingen ontvangen van cliënten.
          </Text>
          <TouchableOpacity
            style={styles.buttonContainer}
            onPress={handleToDashboard}
            activeOpacity={0.9}
          >
            <LinearGradient
              colors={[bcctColors.primaryOrange, bcctColors.primaryOrangeDark]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.button}
            >
              <Text style={styles.buttonText}>Naar dashboard</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  if (screenState === 'incomplete') {
    return (
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <View style={styles.content}>
          <View style={[styles.iconWrap, { backgroundColor: bcctColors.accentOrange + '18' }]}>
            <Ionicons name="warning-outline" size={72} color={bcctColors.accentOrange} />
          </View>
          <Text style={styles.title}>Stripe nog niet volledig</Text>
          <Text style={styles.subtitle}>
            Je Stripe account is nog niet volledig ingesteld. Controleer je Stripe dashboard.
          </Text>
          <TouchableOpacity
            style={[styles.buttonContainer, retryLoading && styles.buttonDisabled]}
            onPress={handleRetryCreate}
            disabled={retryLoading}
            activeOpacity={0.9}
          >
            <LinearGradient
              colors={retryLoading
                ? [bcctColors.primaryOrangeDisabled, bcctColors.primaryOrangeDisabled]
                : [bcctColors.primaryOrange, bcctColors.primaryOrangeDark]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.button}
            >
              {retryLoading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.buttonText}>Opnieuw proberen</Text>
              )}
            </LinearGradient>
          </TouchableOpacity>
          <TouchableOpacity style={styles.skipLink} onPress={handleToDashboard} activeOpacity={0.7}>
            <Text style={styles.skipText}>Naar dashboard</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  if (screenState === 'expired') {
    return (
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <View style={styles.content}>
          <View style={[styles.iconWrap, { backgroundColor: bcctColors.error + '18' }]}>
            <Ionicons name="time-outline" size={72} color={bcctColors.error} />
          </View>
          <Text style={styles.title}>Stripe link verlopen</Text>
          <Text style={styles.subtitle}>
            Je Stripe link is verlopen. Tik om opnieuw te starten.
          </Text>
          <TouchableOpacity
            style={[styles.buttonContainer, retryLoading && styles.buttonDisabled]}
            onPress={handleRetryCreate}
            disabled={retryLoading}
            activeOpacity={0.9}
          >
            <LinearGradient
              colors={retryLoading
                ? [bcctColors.primaryOrangeDisabled, bcctColors.primaryOrangeDisabled]
                : [bcctColors.primaryOrange, bcctColors.primaryOrangeDark]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.button}
            >
              {retryLoading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.buttonText}>Opnieuw starten</Text>
              )}
            </LinearGradient>
          </TouchableOpacity>
          <TouchableOpacity style={styles.skipLink} onPress={handleToDashboard} activeOpacity={0.7}>
            <Text style={styles.skipText}>Naar dashboard</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // error state
  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.content}>
        <View style={[styles.iconWrap, { backgroundColor: bcctColors.error + '18' }]}>
          <Ionicons name="alert-circle-outline" size={72} color={bcctColors.error} />
        </View>
        <Text style={styles.title}>Er is iets misgegaan</Text>
        <Text style={styles.subtitle}>{errorMessage || 'Onbekende fout. Probeer opnieuw.'}</Text>
        <TouchableOpacity
          style={styles.buttonContainer}
          onPress={fetchStripeStatus}
          activeOpacity={0.9}
        >
          <LinearGradient
            colors={[bcctColors.primaryOrange, bcctColors.primaryOrangeDark]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.button}
          >
            <Text style={styles.buttonText}>Opnieuw proberen</Text>
          </LinearGradient>
        </TouchableOpacity>
        <TouchableOpacity style={styles.skipLink} onPress={handleToDashboard} activeOpacity={0.7}>
          <Text style={styles.skipText}>Naar dashboard</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: bcctColors.lightBackground,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
  },
  loadingText: {
    ...bcctTypography.body,
    color: bcctColors.textSecondary,
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    gap: 16,
  },
  iconWrap: {
    width: 120,
    height: 120,
    borderRadius: 60,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  title: {
    ...bcctTypography.h2,
    color: bcctColors.textPrimary,
    textAlign: 'center',
  },
  subtitle: {
    ...bcctTypography.body,
    color: bcctColors.textSecondary,
    textAlign: 'center',
    marginBottom: 8,
  },
  buttonContainer: {
    borderRadius: 14,
    overflow: 'hidden',
    width: '100%',
  },
  buttonDisabled: {
    opacity: 0.7,
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
    paddingVertical: 12,
    alignItems: 'center',
  },
  skipText: {
    ...bcctTypography.small,
    color: bcctColors.textSecondary,
    textDecorationLine: 'underline',
  },
  accentOrange: bcctColors.accentOrange,
});
