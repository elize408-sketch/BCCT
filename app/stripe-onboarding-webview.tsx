
import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  View,
  StyleSheet,
  ActivityIndicator,
  Text,
  TouchableOpacity,
} from 'react-native';
import { ConnectComponentsProvider, ConnectAccountOnboarding, loadConnectAndInitialize } from '@stripe/stripe-react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '@/lib/supabase';
import { bcctColors } from '@/styles/bcctTheme';
import Constants from 'expo-constants';

const SUPABASE_URL = (Constants.expoConfig?.extra?.supabaseUrl as string) ?? '';
const SUPABASE_ANON_KEY = (Constants.expoConfig?.extra?.supabaseAnonKey as string) ?? '';
const STRIPE_STATUS_ENDPOINT = `${SUPABASE_URL}/functions/v1/stripe-connect-status`;
const STRIPE_ACCOUNT_SESSION_ENDPOINT = `${SUPABASE_URL}/functions/v1/stripe-connect-create`;

export default function StripeOnboardingWebView() {
  const { returnTo } = useLocalSearchParams<{ returnTo: string }>();

  const insets = useSafeAreaInsets();
  const [connectInstance, setConnectInstance] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [completing, setCompleting] = useState(false);
  const hasNavigated = useRef(false);

  const navigateAway = useCallback(() => {
    if (hasNavigated.current) return;
    hasNavigated.current = true;
    if (returnTo === 'onboarding') {
      console.log('[StripeConnect] returnTo=onboarding — navigating to /(tabs)');
      router.replace('/(tabs)');
    } else {
      console.log('[StripeConnect] returnTo=billing — navigating to billing screen');
      router.replace('/(app)/coach/billing' as any);
    }
  }, [returnTo]);

  const syncStripeStatus = useCallback(async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) return;
      console.log('[StripeConnect] POST stripe-connect-status to sync latest state');
      const res = await fetch(STRIPE_STATUS_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
          apikey: SUPABASE_ANON_KEY,
        },
      });
      const data = await res.json();
      console.log('[StripeConnect] status synced:', data);
    } catch (e) {
      console.warn('[StripeConnect] status sync failed (non-fatal):', e);
    }
  }, []);

  const handleClose = useCallback(() => {
    console.log('[StripeConnect] Close button pressed');
    navigateAway();
  }, [navigateAway]);

  const handleExit = useCallback(async () => {
    console.log('[StripeConnect] ConnectAccountOnboarding onExit called');
    setCompleting(true);
    await syncStripeStatus();
    setCompleting(false);
    navigateAway();
  }, [syncStripeStatus, navigateAway]);

  useEffect(() => {
    let cancelled = false;

    const initStripeConnect = async () => {
      try {
        setLoading(true);
        setError(null);

        const publishableKey = process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? '';
        console.log('[Stripe] publishableKey exists:', !!publishableKey);

        if (!publishableKey) {
          throw new Error('Stripe publishable key is niet geconfigureerd.');
        }

        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.access_token) {
          throw new Error('Geen actieve sessie. Log opnieuw in.');
        }

        const fetchClientSecret = async (): Promise<string> => {
          console.log('[Stripe] Fetching client_secret from backend...');
          const res = await fetch(STRIPE_ACCOUNT_SESSION_ENDPOINT, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${session.access_token}`,
              apikey: SUPABASE_ANON_KEY,
            },
          });

          if (!res.ok) {
            const text = await res.text();
            console.error('[Stripe] Backend error:', res.status, text);
            throw new Error(`Backend fout (${res.status}): ${text}`);
          }

          const response = await res.json();
          console.log('[Stripe] backend response received:', response);

          if (!response.client_secret) {
            console.error('[Stripe] No client_secret in response:', response);
            throw new Error('Geen client_secret ontvangen van de server.');
          }

          console.log('[Stripe] client_secret exists');
          return response.client_secret as string;
        };

        console.log('[Stripe] Calling loadConnectAndInitialize...');
        const instance = await loadConnectAndInitialize({
          publishableKey,
          fetchClientSecret,
          appearance: {
            overlays: 'dialog',
            variables: {
              colorPrimary: '#F97316',
              fontFamily: '-apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif',
              borderRadius: '8px',
              spacingUnit: '4px',
            },
          },
          locale: 'nl-NL',
        });

        console.log('[Stripe] loadConnectAndInitialize success');

        if (!cancelled) {
          setConnectInstance(instance);
          setLoading(false);
        }
      } catch (err: any) {
        console.error('[Stripe] loadConnectAndInitialize failed:', err?.message ?? err);
        if (!cancelled) {
          setError(err?.message || 'Stripe kon niet worden gestart. Probeer het opnieuw.');
          setLoading(false);
        }
      }
    };

    initStripeConnect();

    return () => {
      cancelled = true;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={handleClose} style={styles.closeButton} activeOpacity={0.7}>
          <Text style={styles.closeText}>✕</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Stripe koppelen</Text>
        <View style={styles.closeButton} />
      </View>

      {/* Loading state */}
      {loading && !error && (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={bcctColors.primaryOrange} />
          <Text style={styles.loadingText}>Stripe laden...</Text>
        </View>
      )}

      {/* Error state */}
      {!!error && (
        <View style={styles.centered}>
          <Text style={styles.errorTitle}>Er is iets misgegaan</Text>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity onPress={handleClose} style={styles.errorButton} activeOpacity={0.9}>
            <Text style={styles.errorButtonText}>Sluiten</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Stripe Connect Embedded Onboarding */}
      {!loading && !error && connectInstance && (
        <ConnectComponentsProvider connectInstance={connectInstance}>
          <ConnectAccountOnboarding
            onExit={handleExit}
          />
        </ConnectComponentsProvider>
      )}

      {/* Status sync overlay (after EXIT) */}
      {completing && (
        <View style={styles.completingOverlay}>
          <ActivityIndicator size="large" color={bcctColors.primaryOrange} />
          <Text style={styles.loadingText}>Status controleren...</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e5e7eb',
    backgroundColor: '#ffffff',
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },
  closeButton: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeText: {
    fontSize: 18,
    color: '#6b7280',
    lineHeight: 22,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    gap: 12,
  },
  loadingText: {
    fontSize: 14,
    color: '#6b7280',
    marginTop: 8,
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
    textAlign: 'center',
  },
  errorText: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
    lineHeight: 20,
  },
  errorButton: {
    marginTop: 8,
    backgroundColor: bcctColors.primaryOrange,
    paddingHorizontal: 28,
    paddingVertical: 12,
    borderRadius: 10,
  },
  errorButtonText: {
    color: '#ffffff',
    fontWeight: '600',
    fontSize: 15,
  },
  completingOverlay: {
    ...StyleSheet.absoluteFillObject,
    top: 61,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
});
