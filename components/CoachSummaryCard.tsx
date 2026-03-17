import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useMyCoaches } from '@/hooks/useMyCoaches';
import { bcctColors } from '@/styles/bcctTheme';

export default function CoachSummaryCard() {
  const { coaches, loading, error } = useMyCoaches();
  const router = useRouter();

  if (loading || error || coaches.length === 0) {
    return null;
  }

  const isSingle = coaches.length === 1;
  const cardTitle = isSingle ? 'Jouw coach' : 'Mijn coaches';
  const firstCoach = coaches[0];
  const secondCoach = coaches[1] ?? null;
  const coachCountLabel = String(coaches.length) + ' actieve coaches';
  const firstCoachName = firstCoach.full_name ?? 'Onbekende coach';
  const firstCoachOrg = firstCoach.organization ?? firstCoach.subtitle ?? null;
  const secondCoachName = secondCoach ? (secondCoach.full_name ?? 'Onbekende coach') : null;

  const handleAllesbekijken = () => {
    console.log('[CoachSummaryCard] Tapped "Alles bekijken" — navigating to profiel tab');
    router.push('/(tabs)/profiel');
  };

  return (
    <View style={styles.card}>
      <View style={styles.iconWrap}>
        <Ionicons
          name={isSingle ? 'person-circle-outline' : 'people-outline'}
          size={28}
          color={bcctColors.primaryOrange}
        />
      </View>

      <View style={styles.content}>
        <Text style={styles.cardTitle}>{cardTitle}</Text>

        {isSingle ? (
          <>
            <Text style={styles.coachName}>{firstCoachName}</Text>
            {firstCoachOrg !== null && (
              <Text style={styles.coachOrg}>{firstCoachOrg}</Text>
            )}
          </>
        ) : (
          <>
            <Text style={styles.coachCount}>{coachCountLabel}</Text>
            <Text style={styles.coachName}>{firstCoachName}</Text>
            {secondCoachName !== null && (
              <Text style={styles.coachName}>{secondCoachName}</Text>
            )}
          </>
        )}
      </View>

      {!isSingle && (
        <TouchableOpacity
          style={styles.allesButton}
          onPress={handleAllesbekijken}
          activeOpacity={0.7}
        >
          <Text style={styles.allesButtonText}>Alles bekijken</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginHorizontal: 16,
    marginBottom: 16,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#FFF4E8',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  content: {
    flex: 1,
    gap: 2,
  },
  cardTitle: {
    fontSize: 11,
    fontWeight: '600',
    color: bcctColors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  coachName: {
    fontSize: 15,
    fontWeight: '600',
    color: bcctColors.textPrimary,
  },
  coachOrg: {
    fontSize: 13,
    color: bcctColors.textSecondary,
  },
  coachCount: {
    fontSize: 13,
    color: bcctColors.textSecondary,
    marginBottom: 2,
  },
  allesButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: bcctColors.primaryOrange,
    marginLeft: 8,
  },
  allesButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: bcctColors.primaryOrange,
  },
});
