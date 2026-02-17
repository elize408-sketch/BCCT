
import React, { useEffect } from 'react';
import { View, ActivityIndicator, StyleSheet, Text } from 'react-native';
import { useRouter } from 'expo-router';
import { useTheme } from '@react-navigation/native';
import { supabase } from '@/lib/supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function AuthCallbackScreen() {
  const router = useRouter();
  const { colors } = useTheme();

  useEffect(() => {
    console.log('[AuthCallback] Processing auth callback');
    
    const handleAuthCallback = async () => {
      try {
        // Get the current session
        const { data: { session } } = await supabase.auth.getSession();
        
        if (session?.user) {
          console.log('[AuthCallback] User authenticated:', session.user.id);
          
          // Check if there's a pending role from social login
          const pendingRole = await AsyncStorage.getItem('pendingRole');
          
          if (pendingRole) {
            console.log('[AuthCallback] Found pending role:', pendingRole);
            
            // Check if profile already exists
            const { data: existingProfile } = await supabase
              .from('profiles')
              .select('id, role')
              .eq('id', session.user.id)
              .single();
            
            if (!existingProfile) {
              // Create profile with the selected role
              const profileData = {
                id: session.user.id,
                full_name: session.user.user_metadata?.full_name || null,
                role: pendingRole as 'client' | 'coach',
                onboarding_completed: false,
                created_at: new Date().toISOString(),
              };
              
              console.log('[AuthCallback] Creating profile:', profileData);
              
              const { error: profileError } = await supabase
                .from('profiles')
                .upsert(profileData);
              
              if (profileError) {
                console.error('[AuthCallback] Profile creation error:', profileError);
              } else {
                console.log('[AuthCallback] Profile created successfully');
              }
            } else {
              console.log('[AuthCallback] Profile already exists:', existingProfile);
            }
            
            // Clean up the pending role
            await AsyncStorage.removeItem('pendingRole');
          }
        }
        
        // Redirect to the app
        setTimeout(() => {
          router.replace('/(app)');
        }, 1000);
      } catch (error) {
        console.error('[AuthCallback] Error processing callback:', error);
        // Still redirect even if there's an error
        setTimeout(() => {
          router.replace('/(app)');
        }, 1000);
      }
    };
    
    handleAuthCallback();
  }, []);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ActivityIndicator size="large" color={colors.primary} />
      <Text style={[styles.text, { color: colors.text }]}>Completing sign in...</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
  },
  text: {
    fontSize: 16,
    marginTop: 16,
  },
});
