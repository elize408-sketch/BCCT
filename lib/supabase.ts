import "react-native-url-polyfill/auto";
import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;

// Storage die werkt op Web + Mobile
const storage =
  Platform.OS === "web"
    ? {
        getItem: (key: string) => Promise.resolve(localStorage.getItem(key)),
        setItem: (key: string, value: string) => {
          localStorage.setItem(key, value);
          return Promise.resolve();
        },
        removeItem: (key: string) => {
          localStorage.removeItem(key);
          return Promise.resolve();
        },
      }
    : AsyncStorage;

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: storage as any,
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false,
  },
});
