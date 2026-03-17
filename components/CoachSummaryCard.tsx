import React from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { useMyCoaches, CoachProfile } from '@/hooks/useMyCoaches';

// Soft palette — cycles through based on first letter
const AVATAR_COLORS = [
  { bg: '#D6E8FF', text: '#1A4A8A' },
  { bg: '#D6F0E8', text: '#1A6A4A' },
  { bg: '#F0E0FF', text: '#5A1A8A' },
  { bg: '#FFE8D6', text: '#8A3A1A' },
  { bg: '#FFF0D6', text: '#8A5A1A' },
  { bg: '#E8D6FF', text: '#3A1A8A' },
  { bg: '#D6F0FF', text: '#1A5A8A' },
];

function getAvatarColor(name: string | null) {
  if (!name) return AVATAR_COLORS[0];
  const index = name.charCodeAt(0) % AVATAR_COLORS.length;
  return AVATAR_COLORS[index];
}

function getInitial(name: string | null): string {
  if (!name) return '?';
  return name.trim().charAt(0).toUpperCase();
}

function formatDate(iso: string | null): string | null {
  if (!iso) return null;
  return new Date(iso).toLocaleDateString('nl-NL', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

function CoachAvatar({ coach, size = 44 }: { coach: CoachProfile; size?: number }) {
  const color = getAvatarColor(coach.full_name);
  const initial = getInitial(coach.full_name);

  if (coach.avatar_url) {
    return (
      <Image
        source={{ uri: coach.avatar_url }}
        style={{
          width: size,
          height: size,
          borderRadius: size / 2,
        }}
        resizeMode="cover"
      />
    );
  }

  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: color.bg,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Text
        style={{
          fontSize: size * 0.4,
          fontWeight: '700',
          color: color.text,
          letterSpacing: 0,
        }}
      >
        {initial}
      </Text>
    </View>
  );
}

interface Props {
  onViewAll?: () => void;
}

export function CoachSummaryCard({ onViewAll }: Props) {
  const { coaches, loading } = useMyCoaches();

  console.log('[CoachSummaryCard] render — loading:', loading, 'coaches count:', coaches.length);

  const title = coaches.length === 1 ? 'Jouw coach' : 'Mijn coaches';
  const visible = coaches.slice(0, 2);
  const hasMore = coaches.length > 2;

  return (
    <View style={styles.card}>
      {/* Header row */}
      <Text style={styles.sectionLabel}>{loading ? 'Mijn coaches' : title}</Text>

      {loading ? (
        <View style={styles.loadingRow}>
          <ActivityIndicator size="small" color="#4A90D9" />
          <Text style={styles.loadingText}>Laden…</Text>
        </View>
      ) : coaches.length === 0 ? (
        <Text style={styles.emptyText}>Nog geen coaches gekoppeld</Text>
      ) : (
        <>
          {visible.map((coach, index) => {
            const dateStr = formatDate(coach.started_at);
            const isNotLast = index < visible.length - 1;
            const coachName = coach.full_name ?? 'Coach';
            return (
              <View
                key={coach.coach_client_key}
                style={[
                  styles.coachRow,
                  isNotLast && styles.coachRowDivider,
                ]}
              >
                <CoachAvatar coach={coach} size={44} />
                <View style={styles.coachInfo}>
                  <Text style={styles.coachName}>{coachName}</Text>
                  {dateStr ? (
                    <Text style={styles.coachSub}>Gekoppeld sinds {dateStr}</Text>
                  ) : null}
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
              <Text style={styles.viewAllText}>Bekijk alle coaches →</Text>
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
    paddingHorizontal: 20,
    paddingVertical: 18,
    marginHorizontal: 0,
    marginBottom: 32,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 10,
    elevation: 3,
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#9AA5B4',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 14,
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
  },
  loadingText: {
    fontSize: 14,
    color: '#9AA5B4',
  },
  emptyText: {
    fontSize: 14,
    color: '#B0BAC5',
    paddingVertical: 8,
  },
  coachRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
  },
  coachRowDivider: {
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  coachInfo: {
    flex: 1,
    marginLeft: 14,
  },
  coachName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 2,
  },
  coachSub: {
    fontSize: 13,
    color: '#9AA5B4',
    fontWeight: '400',
  },
  viewAllBtn: {
    marginTop: 12,
    alignSelf: 'flex-start',
  },
  viewAllText: {
    fontSize: 14,
    color: '#4A90D9',
    fontWeight: '600',
  },
});
