
import { ExpoConfig, ConfigContext } from 'expo/config';

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: 'BCCT Coaching',
  slug: 'BCCT Coaching',
  version: '1.0.0',
  orientation: 'portrait',
  icon: './assets/images/app-icon-cws.png',
  userInterfaceStyle: 'automatic',
  newArchEnabled: true,
  splash: {
    image: './assets/images/app-icon-cws.png',
    resizeMode: 'contain',
    backgroundColor: '#6366f1',
  },
  ios: {
    supportsTablet: true,
    bundleIdentifier: 'com.bcct.coaching',
    infoPlist: {
      ITSAppUsesNonExemptEncryption: false,
    },
  },
  android: {
    adaptiveIcon: {
      foregroundImage: './assets/images/app-icon-cws.png',
      backgroundColor: '#6366f1',
    },
    edgeToEdgeEnabled: true,
    package: 'com.bcct.coaching',
  },
  web: {
    favicon: './assets/images/final_quest_240x240.png',
    bundler: 'metro',
  },
  plugins: ['expo-font', 'expo-router', 'expo-web-browser'],
  scheme: 'bcct-coaching',
  experiments: {
    typedRoutes: true,
  },
  extra: {
    router: {},
    backendUrl: process.env.EXPO_PUBLIC_BACKEND_URL || 'https://9d3pmqrp3gv25b684c4ghga3v4fg533z.app.specular.dev',
    supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL,
    supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
  },
});
