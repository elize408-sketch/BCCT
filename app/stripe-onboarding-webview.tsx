
import React, { useRef, useState, useCallback } from 'react';
import {
  View,
  StyleSheet,
  ActivityIndicator,
  Text,
  TouchableOpacity,
  Platform,
} from 'react-native';
import { WebView, WebViewNavigation } from 'react-native-webview';
import { useLocalSearchParams, router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Constants from 'expo-constants';
import { supabase } from '@/lib/supabase';
import { bcctColors } from '@/styles/bcctTheme';

const SUPABASE_URL = (Constants.expoConfig?.extra?.supabaseUrl as string) ?? '';
const SUPABASE_ANON_KEY = (Constants.expoConfig?.extra?.supabaseAnonKey as string) ?? '';
const STRIPE_STATUS_ENDPOINT = `${SUPABASE_URL}/functions/v1/stripe-connect-status`;

function buildHtml(secret: string, pubKey: string): string {
  // Escape values to prevent XSS / injection in the HTML template
  const safeSecret = secret.replace(/['"\\]/g, '');
  const safePubKey = pubKey.replace(/['"\\]/g, '');

  return `<!DOCTYPE html>
<html lang="nl">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
  <title>Stripe Onboarding</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    html, body {
      width: 100%;
      min-height: 100vh;
      background: #ffffff;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      -webkit-text-size-adjust: 100%;
    }
    #stripe-container {
      width: 100%;
      padding: 0;
    }
    #loading {
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 200px;
      color: #6b7280;
      font-size: 14px;
    }
    #error-msg {
      display: none;
      padding: 16px;
      color: #ef4444;
      font-size: 14px;
      text-align: center;
    }
  </style>
</head>
<body>
  <div id="loading">Stripe laden...</div>
  <div id="error-msg"></div>
  <div id="stripe-container"></div>

  <script>
    (function() {
      function postToRN(data) {
        try {
          if (window.ReactNativeWebView) {
            window.ReactNativeWebView.postMessage(JSON.stringify(data));
          }
        } catch(e) {}
      }

      function showError(msg) {
        document.getElementById('loading').style.display = 'none';
        var el = document.getElementById('error-msg');
        el.style.display = 'block';
        el.textContent = msg;
        postToRN({ type: 'ERROR', message: msg });
      }

      var script = document.createElement('script');
      script.src = 'https://connect-js.stripe.com/v1.0/connect.js';
      script.onload = function() {
        try {
          console.log('[Stripe] connect.js loaded, initializing...');
          document.getElementById('loading').style.display = 'none';

          var stripeConnect = StripeConnect.initialize({
            publishableKey: '${safePubKey}',
            clientSecret: '${safeSecret}',
            appearance: {
              overlays: 'dialog',
              variables: {
                colorPrimary: '#F97316',
                fontFamily: '-apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif',
                borderRadius: '8px',
                spacingUnit: '4px',
              }
            },
            locale: 'nl-NL',
            onLoadError: function(loadError) {
              console.error('[Stripe] Load error:', JSON.stringify(loadError));
              postToRN({ type: 'ERROR', message: (loadError && loadError.error && loadError.error.message) || 'Stripe kon niet laden' });
            },
            onLoaderStart: function() {
              console.log('[Stripe] Loader started');
            },
          });

          var accountOnboarding = stripeConnect.create('account_onboarding');

          accountOnboarding.setOnExit(function() {
            postToRN({ type: 'EXIT' });
          });

          accountOnboarding.setOnStepChange(function(stepChange) {
            postToRN({ type: 'STEP_CHANGE', step: stepChange && stepChange.step });
          });

          var container = document.getElementById('stripe-container');
          container.appendChild(accountOnboarding);
          console.log('[Stripe] Embedded onboarding mounted successfully');
          postToRN({ type: 'MOUNTED' });
        } catch(e) {
          console.error('[Stripe] Init error:', e.message);
          showError('Initialisatie mislukt: ' + e.message);
        }
      };
      script.onerror = function() {
        console.error('[Stripe] Failed to load connect.js');
        showError('Stripe script kon niet worden geladen. Controleer je internetverbinding.');
      };
      document.head.appendChild(script);
    })();
  </script>
</body>
</html>`;
}

export default function StripeOnboardingWebView() {
  const { clientSecret, publishableKey, stripeAccountId, returnTo } =
    useLocalSearchParams<{
      clientSecret: string;
      publishableKey: string;
      stripeAccountId: string;
      returnTo: string;
    }>();

  const insets = useSafeAreaInsets();
  const webViewRef = useRef<WebView>(null);
  const [webViewLoading, setWebViewLoading] = useState(true);
  const [completing, setCompleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Track whether we've already navigated away to prevent double-navigation
  const hasNavigated = useRef(false);

  const syncStripeStatus = useCallback(async () => {
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.access_token) return;
      console.log('[StripeWebView] POST stripe-connect-status to sync latest state');
      const res = await fetch(STRIPE_STATUS_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
          apikey: SUPABASE_ANON_KEY,
        },
      });
      const data = await res.json();
      console.log('[StripeWebView] status synced:', data);
    } catch (e) {
      console.warn('[StripeWebView] status sync failed (non-fatal):', e);
    }
  }, []);

  const navigateAway = useCallback(() => {
    if (hasNavigated.current) return;
    hasNavigated.current = true;
    if (returnTo === 'onboarding') {
      console.log('[StripeWebView] returnTo=onboarding — navigating to /(tabs)');
      router.replace('/(tabs)');
    } else {
      console.log('[StripeWebView] returnTo=billing — navigating to billing screen');
      router.replace('/(app)/coach/billing' as any);
    }
  }, [returnTo]);

  const handleMessage = useCallback(
    async (event: any) => {
      try {
        const message = JSON.parse(event.nativeEvent.data);
        console.log('[Stripe] WebView message received:', message.type);

        if (message.type === 'MOUNTED') {
          setWebViewLoading(false);
        } else if (message.type === 'EXIT') {
          setCompleting(true);
          await syncStripeStatus();
          setCompleting(false);
          navigateAway();
        } else if (message.type === 'ERROR') {
          setError(message.message || 'Er is iets misgegaan');
        } else if (message.type === 'STEP_CHANGE') {
          console.log('[StripeWebView] step:', message.step);
        }
      } catch (e) {
        // ignore JSON parse errors
      }
    },
    [syncStripeStatus, navigateAway]
  );

  // Allow ALL navigation inside the WebView — Stripe needs to open OAuth flows,
  // identity verification pages, and other external URLs. Blocking them breaks onboarding.
  // We only intercept the app's own deep link scheme to handle completion.
  const handleShouldStartLoad = useCallback(
    (request: WebViewNavigation) => {
      const url = request.url ?? '';
      // If Stripe redirects back to our app scheme, handle it natively
      if (url.startsWith('bcct-coaching://') || url.startsWith('exp://')) {
        console.log('[StripeWebView] Intercepted app deep link, navigating away:', url);
        navigateAway();
        return false;
      }
      // Allow everything else — Stripe needs full navigation freedom
      return true;
    },
    [navigateAway]
  );

  const handleClose = useCallback(() => {
    console.log('[StripeWebView] Close button pressed');
    navigateAway();
  }, [navigateAway]);

  if (!clientSecret || !publishableKey) {
    console.log('[Stripe] Missing publishableKey or clientSecret');
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <TouchableOpacity onPress={handleClose} style={styles.closeButton} activeOpacity={0.7}>
            <Text style={styles.closeText}>✕</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Stripe koppelen</Text>
          <View style={styles.closeButton} />
        </View>
        <View style={styles.errorContainer}>
          <Text style={styles.errorTitle}>Configuratie ontbreekt</Text>
          <Text style={styles.errorText}>
            Stripe kon niet worden gestart. Probeer het opnieuw.
          </Text>
          <TouchableOpacity onPress={handleClose} style={styles.errorButton} activeOpacity={0.9}>
            <Text style={styles.errorButtonText}>Sluiten</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  console.log('[Stripe] publishableKey exists:', !!publishableKey);
  console.log('[Stripe] clientSecret exists:', !!clientSecret);

  const html = buildHtml(clientSecret, publishableKey);

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

      {/* WebView — allow all navigation so Stripe OAuth/verification flows work */}
      <WebView
        ref={webViewRef}
        source={{ html }}
        style={styles.webview}
        onLoadStart={() => {
          console.log('[StripeWebView] WebView load started');
          setWebViewLoading(true);
        }}
        onLoadEnd={() => {
          console.log('[StripeWebView] WebView load ended');
          setWebViewLoading(false);
        }}
        onError={(e) => {
          console.error('[StripeWebView] WebView error:', e.nativeEvent);
          setError(e.nativeEvent.description || 'WebView fout');
        }}
        onHttpError={(e) => {
          console.warn('[StripeWebView] HTTP error:', e.nativeEvent.statusCode, e.nativeEvent.url);
        }}
        onMessage={handleMessage}
        onShouldStartLoadWithRequest={handleShouldStartLoad}
        javaScriptEnabled
        domStorageEnabled
        originWhitelist={['*']}
        mixedContentMode="always"
        allowsInlineMediaPlayback
        mediaPlaybackRequiresUserAction={false}
        // Allow Stripe to open camera/files for identity verification
        allowsProtectedMedia
        // Needed for Stripe's popup dialogs
        setSupportMultipleWindows={false}
        // iOS: allow Stripe to open links in Safari when needed
        {...(Platform.OS === 'ios' ? {} : {})}
      />

      {/* Initial WebView loading overlay */}
      {webViewLoading && !error && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color={bcctColors.primaryOrange} />
          <Text style={styles.loadingText}>Stripe laden...</Text>
        </View>
      )}

      {/* Status sync overlay (after EXIT) */}
      {completing && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color={bcctColors.primaryOrange} />
          <Text style={styles.loadingText}>Status controleren...</Text>
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
  webview: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    top: 61, // below header
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  loadingText: {
    fontSize: 14,
    color: '#6b7280',
    marginTop: 8,
  },
  errorContainer: {
    ...StyleSheet.absoluteFillObject,
    top: 61,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    gap: 12,
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
});
