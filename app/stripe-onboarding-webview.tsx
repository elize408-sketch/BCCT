
import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  View,
  StyleSheet,
  ActivityIndicator,
  Text,
  TouchableOpacity,
} from 'react-native';
import { WebView } from 'react-native-webview';
import type { WebViewNavigation, ShouldStartLoadRequest } from 'react-native-webview/lib/WebViewTypes';
import { useLocalSearchParams, router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '@/lib/supabase';
import { bcctColors } from '@/styles/bcctTheme';
import Constants from 'expo-constants';

const SUPABASE_URL = (Constants.expoConfig?.extra?.supabaseUrl as string) ?? '';
const SUPABASE_ANON_KEY = (Constants.expoConfig?.extra?.supabaseAnonKey as string) ?? '';
const STRIPE_STATUS_ENDPOINT = `${SUPABASE_URL}/functions/v1/stripe-connect-status`;
const STRIPE_ACCOUNT_SESSION_ENDPOINT = `${SUPABASE_URL}/functions/v1/stripe-connect-create`;

const IOS_USER_AGENT =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';

// URL fragments that indicate Stripe is redirecting back to the app
const RETURN_URL_PATTERNS = ['stripe-return', 'stripe_return'];
const REFRESH_URL_PATTERNS = ['stripe-refresh', 'stripe_refresh'];

export default function StripeOnboardingWebView() {
  const { returnTo } = useLocalSearchParams<{ returnTo: string }>();

  const insets = useSafeAreaInsets();
  const [onboardingUrl, setOnboardingUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [webViewLoading, setWebViewLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [completing, setCompleting] = useState(false);
  const [fetchKey, setFetchKey] = useState(0);
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

  const handleRefresh = useCallback(() => {
    console.log('[StripeConnect] Refresh URL detected — re-fetching onboarding URL');
    hasNavigated.current = false;
    setOnboardingUrl(null);
    setError(null);
    setFetchKey((k) => k + 1); // triggers the fetch useEffect to re-run
  }, []);

  // Intercept navigation requests so return/refresh deep-link URLs never
  // actually load in the WebView (they're not real web pages and cause -1003).
  const onShouldStartLoadWithRequest = useCallback(
    (request: ShouldStartLoadRequest): boolean => {
      const url = request.url;
      console.log('[StripeConnect] onShouldStartLoadWithRequest:', url.substring(0, 80));

      // Intercept return URL — onboarding finished
      if (RETURN_URL_PATTERNS.some((p) => url.includes(p))) {
        console.log('[StripeConnect] Return URL intercepted — completing onboarding');
        handleOnboardingComplete();
        return false; // prevent WebView from loading this URL
      }

      // Intercept refresh URL — link expired, need a new one
      if (REFRESH_URL_PATTERNS.some((p) => url.includes(p))) {
        console.log('[StripeConnect] Refresh URL intercepted — refreshing onboarding URL');
        handleRefresh();
        return false; // prevent WebView from loading this URL
      }

      // Allow all stripe.com domains explicitly
      if (url.includes('stripe.com')) {
        return true;
      }

      // Allow everything else by default
      return true;
    },
    [handleOnboardingComplete, handleRefresh]
  );

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
  }, [fetchKey]); // eslint-disable-line react-hooks/exhaustive-deps

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

      {/* Initial loading state (fetching URL from backend) */}
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
        <View style={styles.webviewContainer}>
          <WebView
            source={{ uri: onboardingUrl }}
            style={styles.webview}
            // iOS compatibility
            userAgent={IOS_USER_AGENT}
            // Required props for Stripe to work inside a WebView
            javaScriptEnabled={true}
            domStorageEnabled={true}
            sharedCookiesEnabled={true}
            thirdPartyCookiesEnabled={true}
            startInLoadingState={true}
            allowsInlineMediaPlayback={true}
            originWhitelist={['*']}
            mixedContentMode="always"
            // Navigation interception — must return false for return/refresh URLs
            onShouldStartLoadWithRequest={onShouldStartLoadWithRequest}
            // Loading indicator
            onLoadStart={() => {
              console.log('[StripeConnect] WebView load started');
              setWebViewLoading(true);
            }}
            onLoadEnd={() => {
              console.log('[StripeConnect] WebView load ended');
              setWebViewLoading(false);
            }}
            // Navigation state logging (kept for debugging, interception handled above)
            onNavigationStateChange={(navState: WebViewNavigation) => {
              console.log('[StripeConnect] WebView navigating to:', navState.url.substring(0, 80));
            }}
            // Error logging
            onError={(e) => {
              console.log('Stripe WebView error:', e.nativeEvent);
              setError('De Stripe pagina kon niet worden geladen. Controleer je internetverbinding.');
            }}
            onHttpError={(e) => {
              console.log('Stripe HTTP error:', e.nativeEvent);
            }}
          />

          {/* In-WebView loading overlay */}
          {webViewLoading && (
            <View style={styles.webviewLoading}>
              <ActivityIndicator size="large" color={bcctColors.primaryOrange} />
            </View>
          )}
        </View>
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
  webviewContainer: {
    flex: 1,
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
