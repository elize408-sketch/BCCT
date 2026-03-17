import React from "react";
import { StyleSheet, View, Text, ScrollView, TouchableOpacity } from "react-native";
import { useTheme } from "@react-navigation/native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import CoachSummaryCard from "@/components/CoachSummaryCard";
import { bcctColors } from "@/styles/bcctTheme";

export default function HomeScreen() {
  const theme = useTheme();
  const router = useRouter();

  const handleViewAllCoaches = () => {
    console.log("[HomeScreen] View all coaches pressed");
    router.push('/(tabs)/profiel');
  };

  const handleChatPress = () => {
    console.log("[HomeScreen] Quick action: Bericht sturen pressed");
    router.push('/(tabs)/chat');
  };

  const handleDocumentenPress = () => {
    console.log("[HomeScreen] Quick action: Documenten pressed");
    router.push('/(tabs)/documenten');
  };

  const handleProfielPress = () => {
    console.log("[HomeScreen] Quick action: Mijn profiel pressed");
    router.push('/(tabs)/profiel');
  };

  return (
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
          <TouchableOpacity style={styles.actionBtn} onPress={handleChatPress}>
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
