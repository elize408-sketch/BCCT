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
import { calculateLifeWheelAverage, LifeWheelScores } from '@/components/LifeWheelView';

interface HomeworkStats {
  assigned: number;
  in_progress: number;
  submitted: number;
  reviewed: number;
  total: number;
}

interface HabitStreak {
  maxStreak: number;
  activeHabits: number;
}

interface TimelineStats {
  completed: number;
  total: number;
}

interface LifeWheelStat {
  average: number | null;
  date: string | null;
}

interface CheckIn {
  id: string;
  created_at: string;
  energy_level?: number | null;
  stress_level?: number | null;
  sleep_quality?: number | null;
  mood?: number | null;
  notes?: string | null;
}

function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('nl-NL', {
    day: 'numeric',
    month: 'short',
  });
}

function getTodayString(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function computeMaxStreak(logs: { habit_id: string; log_date: string }[]): number {
  if (!logs.length) return 0;
  const sorted = [...logs].sort((a, b) => b.log_date.localeCompare(a.log_date));
  let streak = 0;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  let cursor = new Date(today);
  for (const log of sorted) {
    const logDate = new Date(log.log_date);
    logDate.setHours(0, 0, 0, 0);
    const diff = Math.round((cursor.getTime() - logDate.getTime()) / 86400000);
    if (diff === 0 || diff === 1) {
      streak++;
      cursor = logDate;
    } else {
      break;
    }
  }
  return streak;
}

export default function VoortgangScreen() {
  const router = useRouter();
  const { user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [homeworkStats, setHomeworkStats] = useState<HomeworkStats | null>(null);
  const [habitStreak, setHabitStreak] = useState<HabitStreak | null>(null);
  const [timelineStats, setTimelineStats] = useState<TimelineStats | null>(null);
  const [lifeWheelStat, setLifeWheelStat] = useState<LifeWheelStat | null>(null);
  const [checkIns, setCheckIns] = useState<CheckIn[]>([]);

  const fetchAll = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError(null);
    console.log('[Voortgang] Fetching all progress data for client:', user.id);

    try {
      const [hwRes, habitsRes, timelineRes, lwRes, checkInRes] = await Promise.all([
        supabase
          .from('client_homework_assignments')
          .select('status')
          .eq('client_id', user.id),
        supabase
          .from('client_habits')
          .select('id')
          .eq('client_id', user.id)
          .eq('is_active', true),
        supabase
          .from('client_timeline_items')
          .select('status')
          .eq('client_id', user.id),
        supabase
          .from('life_wheel_assessments')
          .select('health, work_score, finance_score, relationship_score, family_score, personal_growth_score, social_score, mental_health_score, created_at')
          .eq('client_id', user.id)
          .order('created_at', { ascending: false })
          .limit(1),
        supabase
          .from('daily_checkins')
          .select('*')
          .eq('client_id', user.id)
          .order('created_at', { ascending: false })
          .limit(7),
      ]);

      // Homework
      if (hwRes.error) {
        console.error('[Voortgang] Homework fetch error:', hwRes.error.message);
      } else {
        const hw = hwRes.data ?? [];
        const stats: HomeworkStats = {
          assigned: hw.filter((a) => a.status === 'assigned').length,
          in_progress: hw.filter((a) => a.status === 'in_progress').length,
          submitted: hw.filter((a) => a.status === 'submitted').length,
          reviewed: hw.filter((a) => a.status === 'reviewed').length,
          total: hw.length,
        };
        console.log('[Voortgang] Homework stats:', stats);
        setHomeworkStats(stats);
      }

      // Habits + logs
      if (habitsRes.error) {
        console.error('[Voortgang] Habits fetch error:', habitsRes.error.message);
      } else {
        const habits = habitsRes.data ?? [];
        const activeCount = habits.length;
        let maxStreak = 0;
        if (habits.length > 0) {
          const habitIds = habits.map((h) => h.id);
          const { data: logsData } = await supabase
            .from('client_habit_logs')
            .select('habit_id, log_date')
            .in('habit_id', habitIds);
          maxStreak = computeMaxStreak(logsData ?? []);
        }
        console.log('[Voortgang] Habit streak:', maxStreak, 'active habits:', activeCount);
        setHabitStreak({ maxStreak, activeHabits: activeCount });
      }

      // Timeline
      if (timelineRes.error) {
        console.error('[Voortgang] Timeline fetch error:', timelineRes.error.message);
      } else {
        const items = timelineRes.data ?? [];
        const completed = items.filter((i) => i.status === 'completed').length;
        console.log('[Voortgang] Timeline:', completed, '/', items.length);
        setTimelineStats({ completed, total: items.length });
      }

      // Life wheel
      if (lwRes.error) {
        console.error('[Voortgang] Life wheel fetch error:', lwRes.error.message);
      } else {
        const lw = lwRes.data?.[0] ?? null;
        if (lw) {
          const scores: LifeWheelScores = {
            health: lw.health,
            work_score: lw.work_score,
            finance_score: lw.finance_score,
            relationship_score: lw.relationship_score,
            family_score: lw.family_score,
            personal_growth_score: lw.personal_growth_score,
            social_score: lw.social_score,
            mental_health_score: lw.mental_health_score,
          };
          const avg = calculateLifeWheelAverage(scores);
          console.log('[Voortgang] Life wheel avg:', avg);
          setLifeWheelStat({ average: avg, date: lw.created_at });
        } else {
          setLifeWheelStat({ average: null, date: null });
        }
      }

      // Check-ins
      if (checkInRes.error) {
        console.warn('[Voortgang] Check-ins fetch error (table may not exist):', checkInRes.error.message);
        setCheckIns([]);
      } else {
        console.log('[Voortgang] Check-ins fetched:', checkInRes.data?.length ?? 0);
        setCheckIns((checkInRes.data as CheckIn[]) ?? []);
      }
    } catch (e: any) {
      console.error('[Voortgang] fetchAll exception:', e);
      setError('Er is iets misgegaan bij het laden van je voortgang.');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      fetchAll();
    }, [fetchAll])
  );

  const hwCompleted = homeworkStats ? homeworkStats.submitted + homeworkStats.reviewed : 0;
  const hwTotal = homeworkStats?.total ?? 0;
  const hwPct = hwTotal > 0 ? Math.round((hwCompleted / hwTotal) * 100) : 0;
  const hwPctDisplay = String(hwPct);

  const timelinePct =
    timelineStats && timelineStats.total > 0
      ? Math.round((timelineStats.completed / timelineStats.total) * 100)
      : 0;
  const timelinePctDisplay = String(timelinePct);

  const lwAvgDisplay = lifeWheelStat?.average != null ? String(lifeWheelStat.average) : null;
  const lwDateDisplay = lifeWheelStat?.date ? formatDate(lifeWheelStat.date) : null;

  return (
    <>
      <Stack.Screen
        options={{
          title: 'Voortgang',
          headerShown: true,
          headerLeft: () => (
            <TouchableOpacity
              onPress={() => {
                console.log('[Voortgang] Back button pressed');
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
        <View style={styles.root}>
          {loading ? (
            <View style={styles.centered}>
              <ActivityIndicator size="large" color={bcctColors.primaryOrange} />
            </View>
          ) : error ? (
            <View style={styles.centered}>
              <Ionicons name="alert-circle-outline" size={40} color={bcctColors.error} />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : (
            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.scrollContent}
            >
              {/* Homework card */}
              <View style={styles.card}>
                <View style={styles.cardHeader}>
                  <View style={styles.cardIconCircle}>
                    <Ionicons name="book-outline" size={20} color={bcctColors.primaryOrange} />
                  </View>
                  <Text style={styles.cardTitle}>Huiswerk</Text>
                </View>
                {hwTotal === 0 ? (
                  <Text style={styles.emptyCardText}>Nog geen opdrachten</Text>
                ) : (
                  <>
                    <View style={styles.statRow}>
                      <StatPill label="Open" value={String(homeworkStats?.assigned ?? 0)} />
                      <StatPill label="Bezig" value={String(homeworkStats?.in_progress ?? 0)} />
                      <StatPill label="Ingeleverd" value={String(homeworkStats?.submitted ?? 0)} />
                      <StatPill label="Beoordeeld" value={String(homeworkStats?.reviewed ?? 0)} />
                    </View>
                    <View style={styles.progressSection}>
                      <View style={styles.progressLabelRow}>
                        <Text style={styles.progressLabel}>Voltooiing</Text>
                        <Text style={styles.progressPct}>{hwPctDisplay}%</Text>
                      </View>
                      <View style={styles.progressTrack}>
                        <View style={[styles.progressFill, { width: `${hwPct}%` }]} />
                      </View>
                    </View>
                  </>
                )}
              </View>

              {/* Habits card */}
              <View style={styles.card}>
                <View style={styles.cardHeader}>
                  <View style={styles.cardIconCircle}>
                    <Ionicons name="repeat-outline" size={20} color={bcctColors.primaryOrange} />
                  </View>
                  <Text style={styles.cardTitle}>Gewoontes</Text>
                </View>
                {habitStreak === null || habitStreak.activeHabits === 0 ? (
                  <Text style={styles.emptyCardText}>Nog geen actieve gewoontes</Text>
                ) : (
                  <View style={styles.statRow}>
                    <StatPill label="Actief" value={String(habitStreak.activeHabits)} />
                    <StatPill label="Langste streak" value={`${habitStreak.maxStreak} dagen`} />
                  </View>
                )}
              </View>

              {/* Timeline card */}
              <View style={styles.card}>
                <View style={styles.cardHeader}>
                  <View style={styles.cardIconCircle}>
                    <Ionicons name="flag-outline" size={20} color={bcctColors.primaryOrange} />
                  </View>
                  <Text style={styles.cardTitle}>Tijdlijn</Text>
                </View>
                {timelineStats === null || timelineStats.total === 0 ? (
                  <Text style={styles.emptyCardText}>Nog geen tijdlijn beschikbaar</Text>
                ) : (
                  <View style={styles.progressSection}>
                    <View style={styles.progressLabelRow}>
                      <Text style={styles.progressLabel}>
                        {timelineStats.completed} van {timelineStats.total} fases voltooid
                      </Text>
                      <Text style={styles.progressPct}>{timelinePctDisplay}%</Text>
                    </View>
                    <View style={styles.progressTrack}>
                      <View style={[styles.progressFill, { width: `${timelinePct}%` }]} />
                    </View>
                  </View>
                )}
              </View>

              {/* Life wheel card */}
              <View style={styles.card}>
                <View style={styles.cardHeader}>
                  <View style={styles.cardIconCircle}>
                    <Ionicons name="leaf-outline" size={20} color={bcctColors.primaryOrange} />
                  </View>
                  <Text style={styles.cardTitle}>Levenswiel</Text>
                </View>
                {lifeWheelStat === null || lifeWheelStat.average === null ? (
                  <Text style={styles.emptyCardText}>Nog geen meting gedaan</Text>
                ) : (
                  <View style={styles.lwRow}>
                    <Text style={styles.lwScore}>{lwAvgDisplay}</Text>
                    <Text style={styles.lwLabel}>gemiddelde score</Text>
                    {lwDateDisplay ? (
                      <Text style={styles.lwDate}>Laatste meting: {lwDateDisplay}</Text>
                    ) : null}
                  </View>
                )}
              </View>

              {/* Check-ins card */}
              <View style={styles.card}>
                <View style={styles.cardHeader}>
                  <View style={styles.cardIconCircle}>
                    <Ionicons name="pulse-outline" size={20} color={bcctColors.primaryOrange} />
                  </View>
                  <Text style={styles.cardTitle}>Check-ins</Text>
                </View>
                {checkIns.length === 0 ? (
                  <Text style={styles.emptyCardText}>Nog geen check-ins</Text>
                ) : (
                  <View style={styles.checkInList}>
                    {checkIns.map((ci) => {
                      const dateDisplay = formatDate(ci.created_at);
                      const energyDisplay = ci.energy_level != null ? String(ci.energy_level) : null;
                      const stressDisplay = ci.stress_level != null ? String(ci.stress_level) : null;
                      const sleepDisplay = ci.sleep_quality != null ? String(ci.sleep_quality) : null;
                      const moodDisplay = ci.mood != null ? String(ci.mood) : null;
                      return (
                        <View key={ci.id} style={styles.checkInRow}>
                          <Text style={styles.checkInDate}>{dateDisplay}</Text>
                          <View style={styles.checkInMetrics}>
                            {energyDisplay ? (
                              <View style={styles.metricChip}>
                                <Ionicons name="flash-outline" size={12} color={bcctColors.primaryOrange} />
                                <Text style={styles.metricChipText}>{energyDisplay}</Text>
                              </View>
                            ) : null}
                            {stressDisplay ? (
                              <View style={styles.metricChip}>
                                <Ionicons name="alert-outline" size={12} color={bcctColors.primaryOrange} />
                                <Text style={styles.metricChipText}>{stressDisplay}</Text>
                              </View>
                            ) : null}
                            {sleepDisplay ? (
                              <View style={styles.metricChip}>
                                <Ionicons name="moon-outline" size={12} color={bcctColors.primaryOrange} />
                                <Text style={styles.metricChipText}>{sleepDisplay}</Text>
                              </View>
                            ) : null}
                            {moodDisplay ? (
                              <View style={styles.metricChip}>
                                <Ionicons name="happy-outline" size={12} color={bcctColors.primaryOrange} />
                                <Text style={styles.metricChipText}>{moodDisplay}</Text>
                              </View>
                            ) : null}
                          </View>
                        </View>
                      );
                    })}
                  </View>
                )}
              </View>
            </ScrollView>
          )}
        </View>
      </SafeAreaView>
    </>
  );
}

function StatPill({ label, value }: { label: string; value: string }) {
  return (
    <View style={pillStyles.pill}>
      <Text style={pillStyles.value}>{value}</Text>
      <Text style={pillStyles.label}>{label}</Text>
    </View>
  );
}

const pillStyles = StyleSheet.create({
  pill: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: bcctColors.primaryOrange + '12',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 4,
  },
  value: {
    fontSize: 18,
    fontWeight: '800',
    color: bcctColors.primaryOrange,
    marginBottom: 2,
  },
  label: {
    fontSize: 11,
    color: bcctColors.textSecondary,
    fontWeight: '500',
    textAlign: 'center',
  },
});

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: bcctColors.lightBackground,
  },
  root: {
    flex: 1,
    backgroundColor: bcctColors.lightBackground,
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
    paddingHorizontal: 16,
    paddingBottom: 40,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 14,
  },
  cardIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: bcctColors.primaryOrange + '15',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: bcctColors.textPrimary,
  },
  emptyCardText: {
    fontSize: 14,
    color: bcctColors.textSecondary,
    fontStyle: 'italic',
  },
  statRow: {
    flexDirection: 'row',
    gap: 8,
  },
  progressSection: {
    marginTop: 4,
  },
  progressLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  progressLabel: {
    fontSize: 13,
    color: bcctColors.textSecondary,
  },
  progressPct: {
    fontSize: 13,
    fontWeight: '700',
    color: bcctColors.primaryOrange,
  },
  progressTrack: {
    height: 8,
    backgroundColor: bcctColors.borderGray,
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: 8,
    backgroundColor: bcctColors.primaryOrange,
    borderRadius: 4,
  },
  lwRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flexWrap: 'wrap',
  },
  lwScore: {
    fontSize: 36,
    fontWeight: '800',
    color: bcctColors.primaryOrange,
  },
  lwLabel: {
    fontSize: 14,
    color: bcctColors.textSecondary,
    flex: 1,
  },
  lwDate: {
    fontSize: 12,
    color: bcctColors.textSecondary,
    width: '100%',
    marginTop: 4,
  },
  checkInList: {
    gap: 8,
  },
  checkInRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: bcctColors.borderGray,
  },
  checkInDate: {
    fontSize: 13,
    fontWeight: '600',
    color: bcctColors.textPrimary,
    minWidth: 70,
  },
  checkInMetrics: {
    flexDirection: 'row',
    gap: 6,
    flexWrap: 'wrap',
    justifyContent: 'flex-end',
  },
  metricChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: bcctColors.primaryOrange + '12',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
  },
  metricChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: bcctColors.primaryOrange,
  },
  errorText: {
    fontSize: 15,
    color: bcctColors.error,
    marginTop: 12,
    textAlign: 'center',
  },
});
