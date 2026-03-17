import React, { useCallback, useState } from "react";
import { Stack, useRouter } from "expo-router";
import { StyleSheet, View, Text, ScrollView, TouchableOpacity } from "react-native";
import { useTheme } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { HeaderRightButton, HeaderLeftButton } from "@/components/HeaderButtons";
import CoachSummaryCard from "@/components/CoachSummaryCard";
import { bcctColors } from "@/styles/bcctTheme";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";

export default function HomeScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { user } = useAuth();
  const [chatLoading, setChatLoading] = useState(false);

  const handleViewAllCoaches = () => {
    console.log("[HomeScreen] View all coaches pressed");
    router.push('/(tabs)/profiel');
  };

  const handleChatPress = useCallback(async () => {
    console.log("[HomeScreen] Quick action: Bericht sturen pressed");
    if (!user) {
      router.push('/(tabs)/chat');
      return;
    }

    setChatLoading(true);
    try {
      // Check user role
      const { data: profileData } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id);

      const userRole = profileData && profileData.length > 0 ? profileData[0].role : 'client';
      console.log("[HomeScreen] User role for chat navigation:", userRole);

      if (userRole === 'coach') {
        router.push('/(tabs)/chat');
        return;
      }

      // Client: check linked coaches
      const { data: coachLinks } = await supabase
        .from('coach_clients')
        .select('coach_id')
        .eq('client_id', user.id)
        .eq('status', 'active');

      const coaches = coachLinks ?? [];
      console.log("[HomeScreen] Linked coaches count:", coaches.length);

      if (coaches.length !== 1) {
        // 0 or multiple coaches → go to list
        router.push('/(tabs)/chat');
        return;
      }

      // Exactly 1 coach — find or create conversation
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
          router.push('/(tabs)/chat');
          return;
        }
        conversationId = newConv && newConv.length > 0 ? newConv[0].id : null;
      }

      if (conversationId) {
        // Fetch coach name for header
        const { data: coachProfile } = await supabase
          .from('profiles')
          .select('full_name')
          .eq('id', coachId);
        const coachName = coachProfile && coachProfile.length > 0 ? coachProfile[0].full_name : 'Coach';

        console.log("[HomeScreen] Navigating to conversation:", conversationId);
        router.push({
          pathname: '/chat/[id]',
          params: { id: conversationId, otherName: coachName },
        });
      } else {
        router.push('/(tabs)/chat');
      }
    } catch (err) {
      console.error("[HomeScreen] Error in handleChatPress:", err);
      router.push('/(tabs)/chat');
    } finally {
      setChatLoading(false);
    }
  }, [user, router]);

  const handleDocumentenPress = () => {
    console.log("[HomeScreen] Quick action: Documenten pressed");
    router.push('/(tabs)/documenten');
  };

  const handleProfielPress = () => {
    console.log("[HomeScreen] Quick action: Mijn profiel pressed");
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
      <ScrollView
        style={[styles.scroll, { backgroundColor: theme.colors.background }]}
        contentContainerStyle={styles.content}
      >
        {/* Greeting */}
        <View style={styles.header}>
          <Text style={[styles.greeting, { color: theme.colors.text }]}>
            Welkom terug
          </Text>
          <Text style={[styles.subtitle, { color: bcctColors.textSecondary }]}>
            Hier is je overzicht van vandaag
          </Text>
        </View>

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

        {/* Snelle Acties */}
        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Snelle Acties</Text>
          <View style={styles.actionsGrid}>
            <TouchableOpacity style={styles.actionBtn} onPress={handleChatPress} disabled={chatLoading}>
              <View style={styles.actionIcon}>
                <Ionicons name="chatbubble-outline" size={22} color="#4A90D9" />
              </View>
              <Text style={styles.actionLabel}>Bericht sturen</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionBtn} onPress={handleDocumentenPress}>
              <View style={styles.actionIcon}>
                <Ionicons name="document-text-outline" size={22} color="#4A90D9" />
              </View>
              <Text style={styles.actionLabel}>Documenten</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionBtn} onPress={handleProfielPress}>
              <View style={styles.actionIcon}>
                <Ionicons name="person-outline" size={22} color="#4A90D9" />
              </View>
              <Text style={styles.actionLabel}>Mijn profiel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  content: { paddingTop: 24, paddingBottom: 120 },
  header: { paddingHorizontal: 16, marginBottom: 16 },
  greeting: { fontSize: 26, fontWeight: "700", marginBottom: 4 },
  subtitle: { fontSize: 15 },
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
  actionsGrid: { flexDirection: 'row', gap: 10 },
  actionBtn: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: '#F5F9FF',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 8,
  },
  actionIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#EBF4FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  actionLabel: { fontSize: 12, fontWeight: '600', color: '#333', textAlign: 'center' },
});
