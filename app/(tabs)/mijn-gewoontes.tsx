import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  TouchableOpacity,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Switch,
} from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { bcctColors } from '@/styles/bcctTheme';

interface Habit {
  id: string;
  coach_id: string | null;
  client_id: string;
  created_by: string;
  title: string;
  description: string | null;
  frequency_type: 'daily' | 'weekly_count' | 'specific_days';
  target_per_week: number | null;
  days_of_week: number[] | null;
  start_date: string | null;
  end_date: string | null;
  is_active: boolean;
  created_at: string;
}

interface HabitLog {
  id: string;
  habit_id: string;
  log_date: string;
  completed_at: string;
  notes: string | null;
}

const DAY_LABELS = ['Zo', 'Ma', 'Di', 'Wo', 'Do', 'Vr', 'Za'];
const DAY_NAMES = ['Zondag', 'Maandag', 'Dinsdag', 'Woensdag', 'Donderdag', 'Vrijdag', 'Zaterdag'];

function getTodayString(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function getStreakCount(logs: HabitLog[], habit: Habit): number {
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

function getWeeklyProgress(logs: HabitLog[]): number {
  const today = new Date();
  const dayOfWeek = today.getDay();
  const monday = new Date(today);
  monday.setDate(today.getDate() - ((dayOfWeek + 6) % 7));
  monday.setHours(0, 0, 0, 0);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  sunday.setHours(23, 59, 59, 999);
  return logs.filter((l) => {
    const d = new Date(l.log_date);
    return d >= monday && d <= sunday;
  }).length;
}

export default function MijnGewoontesScreen() {
  const router = useRouter();
  const { user } = useAuth();

  const [habits, setHabits] = useState<Habit[]>([]);
  const [logs, setLogs] = useState<HabitLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  // Modal state
  const [modalVisible, setModalVisible] = useState(false);
  const [saving, setSaving] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newFrequency, setNewFrequency] = useState<'daily' | 'weekly_count' | 'specific_days'>('daily');
  const [newTargetPerWeek, setNewTargetPerWeek] = useState('5');
  const [newDaysOfWeek, setNewDaysOfWeek] = useState<number[]>([1, 2, 3, 4, 5]);

  const fetchData = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError(null);
    console.log('[MijnGewoontes] Fetching habits and logs for client:', user.id);
    try {
      const [habitsRes, logsRes] = await Promise.all([
        supabase
          .from('client_habits')
          .select('*')
          .eq('client_id', user.id)
          .eq('is_active', true)
          .order('created_at', { ascending: true }),
        supabase
          .from('client_habit_logs')
          .select('*')
          .in(
            'habit_id',
            // We'll refetch after we have habit IDs — use a broad fetch here
            ['00000000-0000-0000-0000-000000000000']
          ),
      ]);

      if (habitsRes.error) {
        console.error('[MijnGewoontes] Habits fetch error:', habitsRes.error.message);
        setError('Kon gewoontes niet laden.');
        return;
      }

      const fetchedHabits = (habitsRes.data as Habit[]) ?? [];
      console.log('[MijnGewoontes] Fetched habits:', fetchedHabits.length);
      setHabits(fetchedHabits);

      if (fetchedHabits.length > 0) {
        const habitIds = fetchedHabits.map((h) => h.id);
        const { data: logsData, error: logsError } = await supabase
          .from('client_habit_logs')
          .select('*')
          .in('habit_id', habitIds);

        if (logsError) {
          console.error('[MijnGewoontes] Logs fetch error:', logsError.message);
        } else {
          console.log('[MijnGewoontes] Fetched logs:', logsData?.length ?? 0);
          setLogs((logsData as HabitLog[]) ?? []);
        }
      } else {
        setLogs([]);
      }
    } catch (e: any) {
      console.error('[MijnGewoontes] fetchData exception:', e);
      setError('Er is iets misgegaan.');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      fetchData();
    }, [fetchData])
  );

  const today = getTodayString();

  const isCompletedToday = (habitId: string): boolean => {
    return logs.some((l) => l.habit_id === habitId && l.log_date === today);
  };

  const toggleToday = async (habit: Habit) => {
    if (!user || togglingId) return;
    setTogglingId(habit.id);
    const completed = isCompletedToday(habit.id);
    console.log('[MijnGewoontes] Toggle habit:', habit.id, 'completed today:', completed);
    try {
      if (completed) {
        const { error } = await supabase
          .from('client_habit_logs')
          .delete()
          .eq('habit_id', habit.id)
          .eq('log_date', today);
        if (error) {
          console.error('[MijnGewoontes] Delete log error:', error.message);
        } else {
          setLogs((prev) => prev.filter((l) => !(l.habit_id === habit.id && l.log_date === today)));
        }
      } else {
        const { data, error } = await supabase
          .from('client_habit_logs')
          .insert({ habit_id: habit.id, log_date: today, completed_at: new Date().toISOString() })
          .select()
          .single();
        if (error) {
          console.error('[MijnGewoontes] Insert log error:', error.message);
        } else {
          setLogs((prev) => [...prev, data as HabitLog]);
        }
      }
    } catch (e: any) {
      console.error('[MijnGewoontes] toggleToday exception:', e);
    } finally {
      setTogglingId(null);
    }
  };

  const openModal = () => {
    console.log('[MijnGewoontes] Open new habit modal');
    setNewTitle('');
    setNewDescription('');
    setNewFrequency('daily');
    setNewTargetPerWeek('5');
    setNewDaysOfWeek([1, 2, 3, 4, 5]);
    setModalVisible(true);
  };

  const closeModal = () => {
    console.log('[MijnGewoontes] Close new habit modal');
    setModalVisible(false);
  };

  const toggleDay = (day: number) => {
    setNewDaysOfWeek((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]
    );
  };

  const saveHabit = async () => {
    if (!user || !newTitle.trim()) return;
    setSaving(true);
    console.log('[MijnGewoontes] Saving new habit:', newTitle.trim());
    try {
      const { data: link } = await supabase
        .from('coach_clients')
        .select('coach_id')
        .eq('client_id', user.id)
        .eq('status', 'active')
        .maybeSingle();
      const coachId = link?.coach_id ?? null;

      const payload: Record<string, unknown> = {
        client_id: user.id,
        created_by: user.id,
        coach_id: coachId,
        title: newTitle.trim(),
        description: newDescription.trim() || null,
        frequency_type: newFrequency,
        is_active: true,
      };

      if (newFrequency === 'weekly_count') {
        payload.target_per_week = parseInt(newTargetPerWeek, 10) || 3;
      } else if (newFrequency === 'specific_days') {
        payload.days_of_week = newDaysOfWeek;
      }

      const { error } = await supabase.from('client_habits').insert(payload);
      if (error) {
        console.error('[MijnGewoontes] Insert habit error:', error.message);
      } else {
        console.log('[MijnGewoontes] Habit saved successfully');
        setModalVisible(false);
        await fetchData();
      }
    } catch (e: any) {
      console.error('[MijnGewoontes] saveHabit exception:', e);
    } finally {
      setSaving(false);
    }
  };

  const isEmpty = !loading && habits.length === 0;

  return (
    <>
      <Stack.Screen
        options={{
          title: 'Mijn Gewoontes',
          headerShown: true,
          headerLeft: () => (
            <TouchableOpacity
              onPress={() => {
                console.log('[MijnGewoontes] Back button pressed');
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
          ) : isEmpty ? (
            <View style={styles.centered}>
              <View style={styles.emptyIconCircle}>
                <Ionicons name="repeat-outline" size={32} color={bcctColors.primaryOrange} />
              </View>
              <Text style={styles.emptyTitle}>Nog geen gewoontes</Text>
              <Text style={styles.emptySubtitle}>
                Maak een kleine gewoonte aan om vandaag mee te starten.
              </Text>
              <TouchableOpacity style={styles.primaryBtn} onPress={openModal}>
                <Text style={styles.primaryBtnText}>+ Nieuwe gewoonte</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.scrollContent}
            >
              <Text style={styles.sectionHeader}>Vandaag</Text>
              {habits.map((habit) => {
                const completed = isCompletedToday(habit.id);
                const toggling = togglingId === habit.id;
                const habitLogs = logs.filter((l) => l.habit_id === habit.id);
                const streak = getStreakCount(habitLogs, habit);
                const weeklyDone = getWeeklyProgress(habitLogs);
                const weeklyTarget =
                  habit.frequency_type === 'daily'
                    ? 7
                    : habit.frequency_type === 'weekly_count'
                    ? habit.target_per_week ?? 3
                    : (habit.days_of_week ?? []).length;
                const weeklyProgress = Math.min(weeklyDone / Math.max(weeklyTarget, 1), 1);
                const weeklyProgressPct = Math.round(weeklyProgress * 100);

                return (
                  <View key={habit.id} style={[styles.habitCard, completed && styles.habitCardDone]}>
                    <View style={styles.habitCardTop}>
                      <View style={styles.habitInfo}>
                        <Text style={styles.habitTitle}>{habit.title}</Text>
                        {habit.description ? (
                          <Text style={styles.habitDesc} numberOfLines={2}>
                            {habit.description}
                          </Text>
                        ) : null}
                      </View>
                      <TouchableOpacity
                        onPress={() => toggleToday(habit)}
                        disabled={toggling}
                        style={[styles.checkBtn, completed && styles.checkBtnDone]}
                        accessibilityLabel={completed ? 'Markeer als niet gedaan' : 'Markeer als gedaan'}
                      >
                        {toggling ? (
                          <ActivityIndicator size="small" color="#fff" />
                        ) : (
                          <Ionicons
                            name={completed ? 'checkmark' : 'checkmark-outline'}
                            size={22}
                            color={completed ? '#fff' : bcctColors.primaryOrange}
                          />
                        )}
                      </TouchableOpacity>
                    </View>
                    <View style={styles.habitStats}>
                      <View style={styles.statChip}>
                        <Ionicons name="flame-outline" size={14} color={bcctColors.primaryOrange} />
                        <Text style={styles.statChipText}>{streak} dag streak</Text>
                      </View>
                      <View style={styles.weeklyBar}>
                        <Text style={styles.weeklyLabel}>
                          {weeklyDone}/{weeklyTarget} deze week
                        </Text>
                        <View style={styles.progressTrack}>
                          <View style={[styles.progressFill, { width: `${weeklyProgressPct}%` }]} />
                        </View>
                      </View>
                    </View>
                  </View>
                );
              })}

              <TouchableOpacity style={styles.addBtn} onPress={openModal}>
                <Ionicons name="add-circle-outline" size={20} color={bcctColors.primaryOrange} />
                <Text style={styles.addBtnText}>+ Nieuwe gewoonte</Text>
              </TouchableOpacity>
            </ScrollView>
          )}
        </View>
      </SafeAreaView>

      {/* New habit modal */}
      <Modal
        visible={modalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={closeModal}
      >
        <KeyboardAvoidingView
          style={styles.modalWrapper}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <View style={styles.sheet}>
            <View style={styles.dragHandle} />
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Nieuwe gewoonte</Text>
              <TouchableOpacity onPress={closeModal}>
                <Ionicons name="close" size={24} color={bcctColors.textSecondary} />
              </TouchableOpacity>
            </View>
            <ScrollView
              style={styles.modalScroll}
              contentContainerStyle={styles.modalScrollContent}
              keyboardShouldPersistTaps="handled"
            >
              <Text style={styles.fieldLabel}>Naam *</Text>
              <TextInput
                style={styles.textInput}
                placeholder="bijv. 10 minuten mediteren"
                placeholderTextColor={bcctColors.textSecondary}
                value={newTitle}
                onChangeText={setNewTitle}
              />

              <Text style={styles.fieldLabel}>Beschrijving</Text>
              <TextInput
                style={[styles.textInput, styles.textArea]}
                placeholder="Optionele beschrijving..."
                placeholderTextColor={bcctColors.textSecondary}
                value={newDescription}
                onChangeText={setNewDescription}
                multiline
                numberOfLines={3}
              />

              <Text style={styles.fieldLabel}>Frequentie</Text>
              <View style={styles.freqRow}>
                {(['daily', 'weekly_count', 'specific_days'] as const).map((f) => {
                  const label =
                    f === 'daily' ? 'Dagelijks' : f === 'weekly_count' ? 'X per week' : 'Vaste dagen';
                  const active = newFrequency === f;
                  return (
                    <TouchableOpacity
                      key={f}
                      style={[styles.freqChip, active && styles.freqChipActive]}
                      onPress={() => {
                        console.log('[MijnGewoontes] Frequency selected:', f);
                        setNewFrequency(f);
                      }}
                    >
                      <Text style={[styles.freqChipText, active && styles.freqChipTextActive]}>
                        {label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {newFrequency === 'weekly_count' && (
                <>
                  <Text style={styles.fieldLabel}>Doel per week</Text>
                  <TextInput
                    style={styles.textInput}
                    placeholder="bijv. 3"
                    placeholderTextColor={bcctColors.textSecondary}
                    value={newTargetPerWeek}
                    onChangeText={setNewTargetPerWeek}
                    keyboardType="number-pad"
                  />
                </>
              )}

              {newFrequency === 'specific_days' && (
                <>
                  <Text style={styles.fieldLabel}>Dagen</Text>
                  <View style={styles.daysRow}>
                    {DAY_LABELS.map((label, idx) => {
                      const active = newDaysOfWeek.includes(idx);
                      return (
                        <TouchableOpacity
                          key={idx}
                          style={[styles.dayChip, active && styles.dayChipActive]}
                          onPress={() => toggleDay(idx)}
                        >
                          <Text style={[styles.dayChipText, active && styles.dayChipTextActive]}>
                            {label}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </>
              )}
            </ScrollView>

            <View style={styles.modalFooter}>
              <TouchableOpacity style={styles.cancelBtn} onPress={closeModal}>
                <Text style={styles.cancelBtnText}>Annuleren</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.saveBtn, (!newTitle.trim() || saving) && styles.saveBtnDisabled]}
                onPress={saveHabit}
                disabled={!newTitle.trim() || saving}
              >
                {saving ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.saveBtnText}>Opslaan</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
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
  sectionHeader: {
    fontSize: 13,
    fontWeight: '600',
    color: bcctColors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 10,
  },
  habitCard: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  habitCardDone: {
    borderLeftWidth: 4,
    borderLeftColor: bcctColors.primaryOrange,
  },
  habitCardTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  habitInfo: {
    flex: 1,
    marginRight: 10,
  },
  habitTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: bcctColors.textPrimary,
    marginBottom: 2,
  },
  habitDesc: {
    fontSize: 13,
    color: bcctColors.textSecondary,
    lineHeight: 18,
  },
  checkBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: bcctColors.primaryOrange,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
  },
  checkBtnDone: {
    backgroundColor: bcctColors.primaryOrange,
    borderColor: bcctColors.primaryOrange,
  },
  habitStats: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  statChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: bcctColors.primaryOrange + '15',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  statChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: bcctColors.primaryOrange,
  },
  weeklyBar: {
    flex: 1,
  },
  weeklyLabel: {
    fontSize: 11,
    color: bcctColors.textSecondary,
    marginBottom: 4,
  },
  progressTrack: {
    height: 6,
    backgroundColor: bcctColors.borderGray,
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: 6,
    backgroundColor: bcctColors.primaryOrange,
    borderRadius: 3,
  },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: bcctColors.primaryOrange,
    borderStyle: 'dashed',
    marginTop: 4,
  },
  addBtnText: {
    fontSize: 15,
    fontWeight: '600',
    color: bcctColors.primaryOrange,
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
    marginBottom: 24,
  },
  primaryBtn: {
    backgroundColor: bcctColors.primaryOrange,
    borderRadius: 12,
    height: 52,
    paddingHorizontal: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryBtnText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },
  errorText: {
    fontSize: 15,
    color: bcctColors.error,
    marginTop: 12,
    textAlign: 'center',
  },
  // Modal
  modalWrapper: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    flex: 1,
    overflow: 'hidden',
  },
  dragHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: bcctColors.borderGray,
    alignSelf: 'center',
    marginTop: 10,
    marginBottom: 6,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: bcctColors.borderGray,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: bcctColors.textPrimary,
  },
  modalScroll: {
    flex: 1,
  },
  modalScrollContent: {
    padding: 20,
    paddingBottom: 8,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: bcctColors.textSecondary,
    marginBottom: 6,
    marginTop: 14,
  },
  textInput: {
    backgroundColor: bcctColors.lightBackground,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: bcctColors.textPrimary,
    borderWidth: 1,
    borderColor: bcctColors.borderGray,
  },
  textArea: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  freqRow: {
    flexDirection: 'row',
    gap: 8,
  },
  freqChip: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: bcctColors.borderGray,
    alignItems: 'center',
  },
  freqChipActive: {
    borderColor: bcctColors.primaryOrange,
    backgroundColor: bcctColors.primaryOrange + '15',
  },
  freqChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: bcctColors.textSecondary,
  },
  freqChipTextActive: {
    color: bcctColors.primaryOrange,
  },
  daysRow: {
    flexDirection: 'row',
    gap: 6,
  },
  dayChip: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: bcctColors.borderGray,
    alignItems: 'center',
  },
  dayChipActive: {
    borderColor: bcctColors.primaryOrange,
    backgroundColor: bcctColors.primaryOrange,
  },
  dayChipText: {
    fontSize: 11,
    fontWeight: '600',
    color: bcctColors.textSecondary,
  },
  dayChipTextActive: {
    color: '#fff',
  },
  modalFooter: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: bcctColors.borderGray,
  },
  cancelBtn: {
    flex: 1,
    height: 50,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: bcctColors.borderGray,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelBtnText: {
    fontSize: 15,
    fontWeight: '600',
    color: bcctColors.textSecondary,
  },
  saveBtn: {
    flex: 2,
    height: 50,
    borderRadius: 12,
    backgroundColor: bcctColors.primaryOrange,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveBtnDisabled: {
    opacity: 0.5,
  },
  saveBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#fff',
  },
});
