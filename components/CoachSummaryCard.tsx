import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useMyCoaches } from '../hooks/useMyCoaches';

interface Props {
  onViewAll?: () => void;
}

export function CoachSummaryCard({ onViewAll }: Props) {
  const { coaches, loading } = useMyCoaches();

  console.log('[CoachSummaryCard] loading:', loading, 'coaches:', coaches.length);

  if (loading) {
    return (
      <View style={styles.card}>
        <ActivityIndicator size="small" color="#4A90D9" />
      </View>
    );
  }

  if (coaches.length === 0) {
    return null;
  }

  const isSingle = coaches.length === 1;
  const title = isSingle ? 'Jouw coach' : 'Mijn coaches';
  const displayedCoaches = coaches.slice(0, 2);
  const coachName = coaches[0].full_name ?? 'Coach';
  const startedAt = coaches[0].started_at;
  const startedAtDate = startedAt
    ? new Date(startedAt).toLocaleDateString('nl-NL', { day: 'numeric', month: 'long', year: 'numeric' })
    : null;
  const coachCountLabel = String(coaches.length) + ' actieve coaches';

  const handleViewAll = () => {
    console.log('[CoachSummaryCard] Tapped "Alles bekijken"');
    if (onViewAll) onViewAll();
  };

  return (
    <View style={styles.card}>
      <View style={styles.row}>
        <View style={styles.iconWrap}>
          <Ionicons name="person-circle-outline" size={28} color="#4A90D9" />
        </View>
        <View style={styles.content}>
          <Text style={styles.title}>{title}</Text>
          {isSingle ? (
            <>
              <Text style={styles.name}>{coachName}</Text>
              {startedAtDate !== null && (
                <Text style={styles.sub}>
                  Gekoppeld sinds {startedAtDate}
                </Text>
              )}
            </>
          ) : (
            <>
              <Text style={styles.sub}>{coachCountLabel}</Text>
              {displayedCoaches.map(c => (
                <Text key={c.coach_client_id} style={styles.name}>{c.full_name ?? 'Coach'}</Text>
              ))}
              {onViewAll && (
                <TouchableOpacity onPress={handleViewAll} style={styles.viewAllBtn}>
                  <Text style={styles.viewAllText}>Alles bekijken</Text>
                </TouchableOpacity>
              )}
            </>
          )}
        </View>
      </View>
    </View>
  );
}

// Keep default export for backward compatibility with existing imports
export default CoachSummaryCard;

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    marginHorizontal: 16,
    marginVertical: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  row: { flexDirection: 'row', alignItems: 'flex-start' },
  iconWrap: { marginRight: 12, marginTop: 2 },
  content: { flex: 1 },
  title: { fontSize: 13, fontWeight: '600', color: '#888', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 },
  name: { fontSize: 16, fontWeight: '700', color: '#1a1a1a', marginBottom: 2 },
  sub: { fontSize: 13, color: '#888', marginBottom: 4 },
  viewAllBtn: { marginTop: 8 },
  viewAllText: { fontSize: 14, color: '#4A90D9', fontWeight: '600' },
});
