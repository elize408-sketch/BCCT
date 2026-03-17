import React from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useMyCoaches } from '../hooks/useMyCoaches';

interface Props {
  onViewAll?: () => void;
}

export function CoachSummaryCard({ onViewAll }: Props) {
  const { coaches, loading } = useMyCoaches();

  console.log('[CoachSummaryCard] render — loading:', loading, 'coaches count:', coaches.length);

  const title = coaches.length === 1 ? 'Jouw coach' : 'Mijn coaches';
  const visible = coaches.slice(0, 2);
  const hasMore = coaches.length > 2;

  const formatDate = (iso: string | null) => {
    if (!iso) return null;
    return new Date(iso).toLocaleDateString('nl-NL', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  };

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Ionicons name="people-outline" size={20} color="#4A90D9" style={{ marginRight: 8 }} />
        <Text style={styles.cardTitle}>{loading ? 'Mijn coaches' : title}</Text>
      </View>

      {loading ? (
        <View style={styles.loadingRow}>
          <ActivityIndicator size="small" color="#4A90D9" />
          <Text style={styles.loadingText}>Coaches laden...</Text>
        </View>
      ) : coaches.length === 0 ? (
        <Text style={styles.emptyText}>Nog geen coaches gekoppeld</Text>
      ) : (
        <>
          {visible.map((coach, index) => {
            const dateLabel = formatDate(coach.started_at);
            const coachName = coach.full_name ?? 'Coach';
            const isNotLast = index < visible.length - 1;
            return (
              <View
                key={coach.coach_client_key}
                style={[styles.coachRow, isNotLast && styles.coachRowBorder]}
              >
                {coach.avatar_url ? (
                  <Image
                    source={{ uri: coach.avatar_url }}
                    style={styles.avatarImage}
                    resizeMode="cover"
                  />
                ) : (
                  <View style={styles.avatar}>
                    <Ionicons name="person-outline" size={18} color="#4A90D9" />
                  </View>
                )}
                <View style={styles.coachInfo}>
                  <Text style={styles.coachName}>{coachName}</Text>
                  {dateLabel !== null && (
                    <Text style={styles.coachSub}>
                      Gekoppeld sinds {dateLabel}
                    </Text>
                  )}
                </View>
              </View>
            );
          })}
          {hasMore && onViewAll && (
            <TouchableOpacity
              onPress={() => {
                console.log('[CoachSummaryCard] Tapped "Bekijk alle coaches"');
                onViewAll();
              }}
              style={styles.viewAllBtn}
            >
              <Text style={styles.viewAllText}>Bekijk alle coaches</Text>
            </TouchableOpacity>
          )}
        </>
      )}
    </View>
  );
}

export default CoachSummaryCard;

const styles = StyleSheet.create({
  card: {
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1a1a1a',
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    gap: 8,
  },
  loadingText: {
    fontSize: 13,
    color: '#888',
  },
  emptyText: {
    fontSize: 14,
    color: '#aaa',
    textAlign: 'center',
    paddingVertical: 12,
  },
  coachRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
  },
  coachRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#EBF4FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  avatarImage: {
    width: 36,
    height: 36,
    borderRadius: 18,
    marginRight: 12,
  },
  coachInfo: {
    flex: 1,
  },
  coachName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1a1a1a',
  },
  coachSub: {
    fontSize: 13,
    color: '#888',
    marginTop: 2,
  },
  viewAllBtn: {
    marginTop: 10,
    alignItems: 'center',
  },
  viewAllText: {
    fontSize: 14,
    color: '#4A90D9',
    fontWeight: '600',
  },
});
