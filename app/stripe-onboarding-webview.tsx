
import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  View,
  StyleSheet,
  ActivityIndicator,
  Text,
  TouchableOpacity,
} from 'react-native';
import { WebView } from 'react-native-webview';
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
  const [onboardingUrl, setOnboardingUrl] = useState<string | null>(null);
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
      if (!res.ok) {
        console.warn('[StripeConnect] status sync non-ok:', res.status);
        return;
      }
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

  const handleOnboardingComplete = useCallback(async () => {
    console.log('[StripeConnect] Onboarding complete — syncing status');
    setCompleting(true);
    await syncStripeStatus();
    setCompleting(false);
    navigateAway();
  }, [syncStripeStatus, navigateAway]);

  useEffect(() => {
    let cancelled = false;

    const fetchOnboardingUrl = async () => {
      try {
        setLoading(true);
        setError(null);

        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.access_token) {
          throw new Error('Geen actieve sessie. Log opnieuw in.');
        }

        console.log('[Stripe] Fetching onboarding URL from backend...');
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

        const data = await res.json();
        console.log('[Stripe] Backend response keys:', Object.keys(data));

        const url: string | undefined =
          data.onboarding_url ?? data.account_link_url ?? data.url;

        if (!url) {
          console.error('[Stripe] No onboarding URL in response:', data);
          throw new Error(
            'De server heeft geen onboarding URL teruggegeven. Neem contact op met support.'
          );
        }

        console.log('[Stripe] Onboarding URL received:', url.substring(0, 50) + '...');

        if (!cancelled) {
          setOnboardingUrl(url);
          setLoading(false);
        }
      } catch (err: any) {
        console.error('[Stripe] fetchOnboardingUrl failed:', err?.message ?? err);
        if (!cancelled) {
          setError(err?.message || 'Stripe kon niet worden gestart. Probeer het opnieuw.');
          setLoading(false);
        }
      }
    };

    fetchOnboardingUrl();

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

      {/* Stripe onboarding in WebView */}
      {!loading && !error && onboardingUrl && (
        <WebView
          source={{ uri: onboardingUrl }}
          style={styles.webview}
          onNavigationStateChange={(navState) => {
            console.log('[StripeConnect] WebView navigating to:', navState.url.substring(0, 60));
            if (
              navState.url.includes('stripe-return') ||
              navState.url.includes('stripe-refresh') ||
              navState.url.includes('stripe_return') ||
              navState.url.includes('stripe_refresh')
            ) {
              console.log('[StripeConnect] Detected return/refresh URL — completing onboarding');
              handleOnboardingComplete();
            }
          }}
          onError={(syntheticEvent) => {
            const { nativeEvent } = syntheticEvent;
            console.error('[StripeConnect] WebView error:', nativeEvent);
            setError('De Stripe pagina kon niet worden geladen. Controleer je internetverbinding.');
          }}
          startInLoadingState
          renderLoading={() => (
            <View style={styles.webviewLoading}>
              <ActivityIndicator size="large" color={bcctColors.primaryOrange} />
            </View>
          )}
        />
      )}

      {/* Status sync overlay (after completion) */}
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
  webview: {
    flex: 1,
  },
  webviewLoading: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffffff',
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
