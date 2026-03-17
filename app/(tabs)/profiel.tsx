import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useMyCoaches, CoachProfile } from '../../hooks/useMyCoaches';
import { bcctColors } from '@/styles/bcctTheme';

function CoachListItem({ coach }: { coach: CoachProfile }) {
  const coachName = coach.full_name ?? 'Onbekende coach';
  const startedAt = coach.started_at;
  const startedAtDate = startedAt
    ? new Date(startedAt).toLocaleDateString('nl-NL', { day: 'numeric', month: 'long', year: 'numeric' })
    : null;

  const handleBericht = () => {
    console.log('[ProfielScreen] Tapped "Bericht" for coach:', coach.coach_id, coachName);
    Alert.alert('Bericht', 'Chat functie komt binnenkort');
  };

  const handleBekijkProfiel = () => {
    console.log('[ProfielScreen] Tapped "Bekijk profiel" for coach:', coach.coach_id, coachName);
    Alert.alert('Profiel', 'Coach profiel komt binnenkort');
  };

  return (
    <View style={styles.coachItem}>
      <View style={styles.coachItemTop}>
        <View style={styles.coachAvatarWrap}>
          <Ionicons name="person-circle-outline" size={36} color="#4A90D9" />
        </View>
        <View style={styles.coachInfo}>
          <Text style={styles.coachName}>{coachName}</Text>
          {startedAtDate !== null && (
            <Text style={styles.coachOrg}>
              Gekoppeld sinds {startedAtDate}
            </Text>
          )}
          <View style={styles.statusRow}>
            <View style={styles.statusDot} />
            <Text style={styles.statusText}>Actief</Text>
          </View>
        </View>
        <View style={styles.activeBadge}>
          <Text style={styles.activeBadgeText}>Actief</Text>
        </View>
      </View>
      <View style={styles.coachActions}>
        <TouchableOpacity
          style={styles.outlineButton}
          onPress={handleBericht}
          activeOpacity={0.7}
        >
          <Text style={styles.outlineButtonText}>Bericht</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.outlineButton}
          onPress={handleBekijkProfiel}
          activeOpacity={0.7}
        >
          <Text style={styles.outlineButtonText}>Bekijk profiel</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

export default function ProfielScreen() {
  const { coaches, loading: coachesLoading, error } = useMyCoaches();

  console.log('[ProfielScreen] loading:', coachesLoading, 'error:', error?.message ?? null, 'coaches:', coaches.length);

  const hasCoaches = !coachesLoading && !error && coaches.length > 0;
  const showEmpty = !coachesLoading && coaches.length === 0;

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <Stack.Screen options={{ title: 'Profiel', headerShown: false }} />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
      >
        <Text style={styles.screenTitle}>Profiel</Text>

        {/* Mijn coaches sectie */}
        <View style={styles.section}>
          <Text style={styles.sectionHeader}>Mijn coaches</Text>

          <View style={styles.card}>
            {coachesLoading && (
              <View style={styles.emptyState}>
                <ActivityIndicator size="small" color="#4A90D9" />
                <Text style={styles.emptyText}>Coaches laden...</Text>
              </View>
            )}

            {showEmpty && (
              <View style={styles.emptyState}>
                <Ionicons name="person-outline" size={32} color="#D1D5DB" />
                <Text style={styles.emptyText}>Nog geen coaches gekoppeld</Text>
              </View>
            )}

            {hasCoaches && coaches.map((coach, index) => (
              <View key={coach.coach_client_id}>
                <CoachListItem coach={coach} />
                {index < coaches.length - 1 && <View style={styles.divider} />}
              </View>
            ))}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: bcctColors.lightBackground,
  },
  scroll: {
    flex: 1,
  },
  content: {
    paddingTop: 24,
    paddingBottom: 100,
    paddingHorizontal: 16,
  },
  screenTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: bcctColors.textPrimary,
    marginBottom: 24,
  },
  section: {
    marginBottom: 24,
  },
  sectionHeader: {
    fontSize: 13,
    fontWeight: '600',
    color: bcctColors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 10,
    marginLeft: 4,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
    overflow: 'hidden',
  },
  coachItem: {
    padding: 16,
  },
  coachItemTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  coachAvatarWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#EBF4FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  coachInfo: {
    flex: 1,
    gap: 2,
  },
  coachName: {
    fontSize: 16,
    fontWeight: '600',
    color: bcctColors.textPrimary,
  },
  coachOrg: {
    fontSize: 13,
    color: bcctColors.textSecondary,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    gap: 5,
  },
  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: bcctColors.success,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '500',
    color: bcctColors.success,
  },
  activeBadge: {
    backgroundColor: '#e8f5e9',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  activeBadgeText: {
    fontSize: 12,
    color: '#2e7d32',
    fontWeight: '600',
  },
  coachActions: {
    flexDirection: 'row',
    gap: 10,
  },
  outlineButton: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: bcctColors.borderGray,
    alignItems: 'center',
  },
  outlineButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: bcctColors.textPrimary,
  },
  divider: {
    height: 1,
    backgroundColor: bcctColors.borderGray,
    marginHorizontal: 16,
  },
  emptyState: {
    padding: 32,
    alignItems: 'center',
    gap: 10,
  },
  emptyText: {
    fontSize: 14,
    color: bcctColors.textSecondary,
    textAlign: 'center',
  },
});
