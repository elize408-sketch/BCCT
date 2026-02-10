import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Database } from './types';
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = "https://qcirmbquzdbprjvqhqlj.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFjaXJtYnF1emRicHJqdnFocWxqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA3NTI2NzgsImV4cCI6MjA4NjMyODY3OH0.6pXSIChUM7xv4bcnAIR2LyyuhVbh4Tblg0RVwvXg7Eo";

// Import the supabase client like this:
// import { supabase } from "@/integrations/supabase/client";

export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
})
