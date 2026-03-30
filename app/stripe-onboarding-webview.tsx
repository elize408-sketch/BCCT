
import React, { useRef, useState, useCallback } from 'react';
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
import Constants from 'expo-constants';
import { supabase } from '@/lib/supabase';
import { bcctColors, bcctTypography } from '@/styles/bcctTheme';

const SUPABASE_URL = (Constants.expoConfig?.extra?.supabaseUrl as string) ?? '';
const SUPABASE_ANON_KEY = (Constants.expoConfig?.extra?.supabaseAnonKey as string) ?? '';
const STRIPE_STATUS_ENDPOINT = `${SUPABASE_URL}/functions/v1/stripe-connect-status`;

function buildHtml(secret: string, pubKey: string): string {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
  <title>Stripe Onboarding</title>
  <script src="https://connect-js.stripe.com/v1.0/connect.js"></script>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      background: #ffffff;
      min-height: 100vh;
    }
    #container {
      width: 100%;
      min-height: 100vh;
    }
    stripe-connect-account-onboarding {
      display: block;
      width: 100%;
    }
  </style>
</head>
<body>
  <div id="container"></div>
  <script>
    const stripe = StripeConnect.initialize({
      publishableKey: "${pubKey}",
      fetchClientSecret: async () => "${secret}",
      appearance: {
        overlays: 'dialog',
        variables: {
          colorPrimary: '#F97316',
          fontFamily: '-apple-system, BlinkMacSystemFont, Segoe UI, sans-serif',
          borderRadius: '8px',
        }
      }
    });

    const container = document.getElementById('container');
    const onboardingComponent = stripe.create('account_onboarding');

    onboardingComponent.setOnExit(() => {
      window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'EXIT' }));
    });

    onboardingComponent.setOnStepChange((stepChange) => {
      window.ReactNativeWebView.postMessage(JSON.stringify({
        type: 'STEP_CHANGE',
        step: stepChange.step
      }));
    });

    container.appendChild(onboardingComponent);
  </script>
</body>
</html>`;
}

export default function StripeOnboardingWebView() {
  const { clientSecret, publishableKey, stripeAccountId, returnTo } = useLocalSearchParams<{
    clientSecret: string;
    publishableKey: string;
    stripeAccountId: string;
    returnTo: string;
  }>();

  const insets = useSafeAreaInsets();
  const webViewRef = useRef<WebView>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [completing, setCompleting] = useState(false);

  const syncStripeStatus = useCallback(async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const accessToken = session?.access_token;
      console.log('[StripeWebView] POST stripe-connect-status to sync latest state');
      const statusRes = await fetch(STRIPE_STATUS_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
          'apikey': SUPABASE_ANON_KEY,
        },
      });
      const statusData = await statusRes.json();
      console.log('[StripeWebView] stripe-connect-status response:', statusData);
    } catch (e) {
      console.warn('[StripeWebView] stripe-connect-status sync failed (non-fatal):', e);
    }
  }, []);

  const navigateAway = useCallback(() => {
    if (returnTo === 'onboarding') {
      console.log('[StripeWebView] returnTo=onboarding — navigating to /(tabs)');
      router.replace('/(tabs)');
    } else {
      console.log('[StripeWebView] returnTo=billing — navigating to billing screen');
      router.replace('/(app)/coach/billing' as any);
    }
  }, [returnTo]);

  const handleMessage = useCallback(async (event: any) => {
    try {
      const message = JSON.parse(event.nativeEvent.data);
      console.log('[StripeWebView] Message from WebView:', message);

      if (message.type === 'EXIT') {
        setCompleting(true);
        await syncStripeStatus();
        setCompleting(false);
        navigateAway();
      } else if (message.type === 'STEP_CHANGE') {
        console.log('[StripeWebView] Step changed to:', message.step);
      }
    } catch (e) {
      // ignore parse errors
    }
  }, [syncStripeStatus, navigateAway]);

  const handleClose = useCallback(() => {
    console.log('[StripeWebView] Close button pressed');
    navigateAway();
  }, [navigateAway]);

  const handleWebViewError = useCallback((e: any) => {
    const desc = e.nativeEvent.description;
    console.error('[StripeWebView] WebView error:', desc);
    setError(desc);
  }, []);

  const html = buildHtml(clientSecret ?? '', publishableKey ?? '');

  const paddingTop = insets.top;

  return (
    <View style={[styles.container, { paddingTop }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={handleClose} style={styles.closeButton} activeOpacity={0.7}>
          <Text style={styles.closeText}>✕</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Stripe koppelen</Text>
        <View style={styles.closeButton} />
      </View>

      {/* WebView */}
      <WebView
        ref={webViewRef}
        source={{ html, baseUrl: 'https://connect-js.stripe.com' }}
        style={styles.webview}
        onLoadStart={() => {
          console.log('[StripeWebView] WebView load started');
          setLoading(true);
        }}
        onLoadEnd={() => {
          console.log('[StripeWebView] WebView load ended');
          setLoading(false);
        }}
        onError={handleWebViewError}
        onMessage={handleMessage}
        javaScriptEnabled
        domStorageEnabled
        originWhitelist={['*']}
        mixedContentMode="always"
        allowsInlineMediaPlayback
        mediaPlaybackRequiresUserAction={false}
        onShouldStartLoadWithRequest={(request) => {
          const url = request.url;
          const allowed =
            url.startsWith('about:') ||
            url === 'about:blank' ||
            url.startsWith('https://connect-js.stripe.com') ||
            url.startsWith('https://js.stripe.com') ||
            url.startsWith('https://stripe.com') ||
            url.startsWith('https://connect.stripe.com');
          if (!allowed) {
            console.log('[StripeWebView] Blocked navigation to:', url);
          }
          return allowed;
        }}
      />

      {/* Loading overlay */}
      {(loading || completing) && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color={bcctColors.primaryOrange} />
          <Text style={styles.loadingText}>
            {completing ? 'Status controleren...' : 'Stripe laden...'}
          </Text>
        </View>
      )}

      {/* Error state */}
      {error && (
        <View style={styles.errorContainer}>
          <Text style={styles.errorTitle}>Er is iets misgegaan</Text>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity onPress={handleClose} style={styles.errorButton} activeOpacity={0.9}>
            <Text style={styles.errorButtonText}>Sluiten</Text>
          </TouchableOpacity>
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
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
    backgroundColor: '#ffffff',
  },
  headerTitle: {
    ...bcctTypography.bodyMedium,
    color: '#111827',
  },
  closeButton: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeText: {
    fontSize: 16,
    color: bcctColors.textSecondary,
  },
  webview: {
    flex: 1,
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  loadingText: {
    ...bcctTypography.body,
    color: bcctColors.textSecondary,
  },
  errorContainer: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    gap: 12,
  },
  errorTitle: {
    ...bcctTypography.h3,
    color: bcctColors.textPrimary,
    textAlign: 'center',
  },
  errorText: {
    ...bcctTypography.body,
    color: bcctColors.error,
    textAlign: 'center',
  },
  errorButton: {
    backgroundColor: bcctColors.primaryOrange,
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 14,
    marginTop: 8,
  },
  errorButtonText: {
    color: '#ffffff',
    ...bcctTypography.button,
  },
});
