
import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  TouchableOpacity,
} from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { bcctColors } from '@/styles/bcctTheme';
import TimelineList, { TimelineItem } from '@/components/TimelineList';

export default function MijnReisScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [items, setItems] = useState<TimelineItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchItems = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError(null);
    try {
      console.log('[MijnReis] Fetching timeline items for client:', user.id);
      const { data, error: fetchError } = await supabase
        .from('client_timeline_items')
        .select('*')
        .eq('client_id', user.id)
        .order('order_index', { ascending: true });

      if (fetchError) {
        console.error('[MijnReis] Fetch error:', fetchError.message);
        setError('Kon de tijdlijn niet laden.');
        return;
      }
      console.log('[MijnReis] Fetched items:', data?.length ?? 0);
      setItems((data as TimelineItem[]) ?? []);
    } catch (e: any) {
      console.error('[MijnReis] fetchItems exception:', e);
      setError('Er is iets misgegaan.');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      fetchItems();
    }, [fetchItems])
  );

  const isEmpty = !loading && items.length === 0;

  return (
    <>
      <Stack.Screen
        options={{
          title: 'Mijn Reis',
          headerShown: true,
          headerLeft: () => (
            <TouchableOpacity
              onPress={() => {
                console.log('[MijnReis] Back button pressed');
                router.back();
              }}
              style={styles.backBtn}
            >
              <Ionicons name="chevron-back" size={24} color={bcctColors.primaryOrange} />
            </TouchableOpacity>
          ),
        }}
      />
      <SafeAreaView style={styles.safeArea} edges={['bottom']}>
        <View style={[styles.root, { backgroundColor: bcctColors.lightBackground }]}>
          {loading ? (
            <View style={styles.centered}>
              <ActivityIndicator size="large" color={bcctColors.primaryOrange} />
            </View>
          ) : error ? (
            <View style={styles.centered}>
              <Ionicons name="alert-circle-outline" size={40} color={bcctColors.error} />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : isEmpty ? (
            <View style={styles.centered}>
              <View style={styles.emptyIconCircle}>
                <Ionicons name="flag-outline" size={32} color={bcctColors.primaryOrange} />
              </View>
              <Text style={styles.emptyTitle}>Geen tijdlijn beschikbaar</Text>
              <Text style={styles.emptySubtitle}>
                Je coach heeft nog geen tijdlijn klaargezet.
              </Text>
            </View>
          ) : (
            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.scrollContent}
            >
              <Text style={styles.sectionHeader}>Jouw coachingtraject</Text>
              <TimelineList items={items} />
            </ScrollView>
          )}
        </View>
      </SafeAreaView>
    </>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: bcctColors.lightBackground,
  },
  root: {
    flex: 1,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  backBtn: {
    paddingHorizontal: 4,
  },
  scrollContent: {
    paddingTop: 16,
    paddingBottom: 40,
  },
  sectionHeader: {
    fontSize: 13,
    fontWeight: '600',
    color: bcctColors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    paddingHorizontal: 20,
    marginBottom: 8,
  },
  emptyIconCircle: {
    width: 72,
    height: 72,
    borderRadius: 22,
    backgroundColor: bcctColors.primaryOrange + '15',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: bcctColors.textPrimary,
    marginBottom: 8,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 14,
    color: bcctColors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
    maxWidth: 260,
  },
  errorText: {
    fontSize: 15,
    color: bcctColors.error,
    marginTop: 12,
    textAlign: 'center',
  },
});
