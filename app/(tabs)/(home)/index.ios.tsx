import React, { useCallback, useState, useEffect } from "react";
import { Stack, useRouter } from "expo-router";
import { StyleSheet, View, Text, ScrollView, TouchableOpacity } from "react-native";
import { useTheme } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { HeaderRightButton, HeaderLeftButton } from "@/components/HeaderButtons";
import CoachSummaryCard from "@/components/CoachSummaryCard";
import CoachConnectCard from "@/components/CoachConnectCard";
import { bcctColors } from "@/styles/bcctTheme";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import { useMyCoaches } from "@/hooks/useMyCoaches";

export default function HomeScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { user } = useAuth();
  const { coaches, loading: coachesLoading } = useMyCoaches();
  const [chatLoading, setChatLoading] = useState(false);
  const [firstName, setFirstName] = useState('Cliënt');

  useEffect(() => {
    if (!user) return;
    console.log('[HomeScreen] Fetching profile for first name, user:', user.id);
    supabase
      .from('profiles')
      .select('full_name')
      .eq('id', user.id)
      .single()
      .then(({ data, error }) => {
        if (error) {
          console.warn('[HomeScreen] Could not fetch profile full_name:', error.message);
          return;
        }
        const raw: string = data?.full_name ?? '';
        const first = raw.trim().split(' ')[0] || 'Cliënt';
        console.log('[HomeScreen] Resolved first name:', first);
        setFirstName(first);
      });
  }, [user]);

  const handleViewAllCoaches = () => {
    console.log("[HomeScreen] View all coaches pressed");
    router.push('/(tabs)/profiel');
  };

  const handleChatPress = useCallback(async () => {
    console.log("[HomeScreen] Quick action: Bericht sturen pressed");
    if (!user) {
      router.push('/(tabs)/(chat)/');
      return;
    }

    setChatLoading(true);
    try {
      const { data: coachLinks } = await supabase
        .from('coach_clients')
        .select('coach_id')
        .eq('client_id', user.id)
        .eq('status', 'active');

      const coaches = coachLinks ?? [];
      console.log("[HomeScreen] Linked coaches count:", coaches.length);

      if (coaches.length !== 1) {
        router.push('/(tabs)/(chat)/');
        return;
      }

      const coachId = coaches[0].coach_id;
      const { data: convData } = await supabase
        .from('conversations')
        .select('id')
        .eq('coach_id', coachId)
        .eq('client_id', user.id);

      let conversationId: string | null = convData && convData.length > 0 ? convData[0].id : null;

      if (!conversationId) {
        console.log("[HomeScreen] Creating new conversation with coach:", coachId);
        const { data: newConv, error: insertError } = await supabase
          .from('conversations')
          .insert({ coach_id: coachId, client_id: user.id, org_id: null })
          .select('id');

        if (insertError) {
          console.error("[HomeScreen] Error creating conversation:", insertError);
          router.push('/(tabs)/(chat)/');
          return;
        }
        conversationId = newConv && newConv.length > 0 ? newConv[0].id : null;
      }

      if (conversationId) {
        const { data: coachProfile } = await supabase
          .from('profiles')
          .select('full_name')
          .eq('id', coachId);
        const coachName = coachProfile && coachProfile.length > 0 ? coachProfile[0].full_name : 'Coach';

        console.log("[HomeScreen] Navigating to conversation:", conversationId);
        router.push({
          pathname: '/(tabs)/(chat)/[id]',
          params: { id: conversationId, otherName: coachName },
        });
      } else {
        router.push('/(tabs)/(chat)/');
      }
    } catch (err) {
      console.error("[HomeScreen] Error in handleChatPress:", err);
      router.push('/(tabs)/(chat)/');
    } finally {
      setChatLoading(false);
    }
  }, [user, router]);

  const handleThemaCheckinPress = () => {
    console.log("[HomeScreen] Quick action: Thema Check-in pressed");
  };

  const handleMijnProgrammaPress = () => {
    console.log("[HomeScreen] Quick action: Mijn Programma pressed");
  };

  const handleMijnCoachPress = () => {
    console.log("[HomeScreen] Quick action: Mijn Coach pressed");
    router.push('/(tabs)/profiel');
  };

  const handleProfielPress = () => {
    console.log("[HomeScreen] Quick action: Mijn Profiel pressed");
    router.push('/(tabs)/profiel');
  };

  return (
    <>
      <Stack.Screen
        options={{
          title: "Home",
          headerRight: () => <HeaderRightButton />,
          headerLeft: () => <HeaderLeftButton />,
        }}
      />
      <View style={[styles.root, { backgroundColor: theme.colors.background }]}>
        {/* Scrollable top section */}
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          scrollEnabled={false}
        >
          {/* Greeting */}
          <View style={styles.header}>
            <Text style={[styles.greeting, { color: theme.colors.text }]}>
              Welkom terug
            </Text>
            <Text style={[styles.name, { color: theme.colors.text }]}>
              {firstName}
            </Text>
            <Text style={[styles.subtitle, { color: bcctColors.textSecondary }]}>
              Hier is je overzicht van vandaag
            </Text>
          </View>

          {/* Coach connect card — shown only when no coach is linked */}
          {!coachesLoading && coaches.length === 0 && (
            <CoachConnectCard
              onConnected={() => {
                console.log('[HomeScreen] Coach connected, refreshing');
                router.replace('/(tabs)/(home)');
              }}
            />
          )}

          {/* Coaches blok */}
          <CoachSummaryCard onViewAll={handleViewAllCoaches} />

          {/* Overzicht van Vandaag */}
          <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>Overzicht van Vandaag</Text>
            <View style={styles.statsRow}>
              <View style={styles.statItem}>
                <Ionicons name="fitness-outline" size={22} color="#4A90D9" />
                <Text style={styles.statValue}>0</Text>
                <Text style={styles.statLabel}>Trainingen</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statItem}>
                <Ionicons name="nutrition-outline" size={22} color="#4A90D9" />
                <Text style={styles.statValue}>0</Text>
                <Text style={styles.statLabel}>Maaltijden</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statItem}>
                <Ionicons name="checkmark-circle-outline" size={22} color="#4A90D9" />
                <Text style={styles.statValue}>0</Text>
                <Text style={styles.statLabel}>Taken</Text>
              </View>
            </View>
          </View>
        </ScrollView>

        {/* Snelle Acties — fills remaining space */}
        <View style={styles.actionsCard}>
          <Text style={styles.sectionTitle}>Snelle Acties</Text>
          <View style={styles.actionsGrid}>
            {/* Row 1 */}
            <View style={styles.actionsRow}>
              <TouchableOpacity style={styles.actionBtn} onPress={handleThemaCheckinPress}>
                <View style={styles.actionIcon}>
                  <Ionicons name="checkmark-done-outline" size={24} color="#4A90D9" />
                </View>
                <Text style={styles.actionLabel}>Thema Check-in</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.actionBtn} onPress={handleMijnProgrammaPress}>
                <View style={styles.actionIcon}>
                  <Ionicons name="list-outline" size={24} color="#4A90D9" />
                </View>
                <Text style={styles.actionLabel}>Mijn Programma</Text>
              </TouchableOpacity>
            </View>
            {/* Row 2 */}
            <View style={styles.actionsRow}>
              <TouchableOpacity style={styles.actionBtn} onPress={handleChatPress} disabled={chatLoading}>
                <View style={styles.actionIcon}>
                  <Ionicons name="chatbubble-outline" size={24} color="#4A90D9" />
                </View>
                <Text style={styles.actionLabel}>Chat met Coach</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.actionBtn} onPress={handleMijnCoachPress}>
                <View style={styles.actionIcon}>
                  <Ionicons name="person-circle-outline" size={24} color="#4A90D9" />
                </View>
                <Text style={styles.actionLabel}>Mijn Coach</Text>
              </TouchableOpacity>
            </View>
            {/* Row 3 */}
            <View style={styles.actionsRow}>
              <TouchableOpacity style={styles.actionBtn} onPress={handleProfielPress}>
                <View style={styles.actionIcon}>
                  <Ionicons name="person-outline" size={24} color="#4A90D9" />
                </View>
                <Text style={styles.actionLabel}>Mijn Profiel</Text>
              </TouchableOpacity>
              <View style={[styles.actionBtn, { backgroundColor: 'transparent', elevation: 0, shadowOpacity: 0 }]} />
            </View>
          </View>
        </View>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  scroll: { flexShrink: 0 },
  scrollContent: { paddingTop: 24 },
  header: { paddingHorizontal: 16, marginBottom: 16 },
  greeting: { fontSize: 26, fontWeight: "700", marginBottom: 2 },
  name: { fontSize: 32, fontWeight: "800", marginBottom: 4 },
  subtitle: { fontSize: 15, marginBottom: 12 },
  sectionCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    marginHorizontal: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1a1a1a',
    marginBottom: 14,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
  },
  statItem: { alignItems: 'center', flex: 1 },
  statValue: { fontSize: 22, fontWeight: '700', color: '#1a1a1a', marginTop: 6 },
  statLabel: { fontSize: 12, color: '#888', marginTop: 2 },
  statDivider: { width: 1, height: 40, backgroundColor: '#f0f0f0' },
  actionsCard: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    marginHorizontal: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  actionsGrid: {
    flex: 1,
    gap: 10,
  },
  actionsRow: {
    flex: 1,
    flexDirection: 'row',
    gap: 10,
  },
  actionBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F5F9FF',
    borderRadius: 12,
    paddingVertical: 18,
    paddingHorizontal: 8,
    minHeight: 100,
  },
  actionIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#EBF4FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 7,
  },
  actionLabel: { fontSize: 12, fontWeight: '600', color: '#333', textAlign: 'center' },
});
