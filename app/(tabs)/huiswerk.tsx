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

interface Assignment {
  id: string;
  coach_id: string | null;
  client_id: string;
  title: string;
  description: string | null;
  status: 'assigned' | 'in_progress' | 'submitted' | 'reviewed';
  due_date: string | null;
  submitted_at: string | null;
  created_at: string;
}

const STATUS_LABELS: Record<Assignment['status'], string> = {
  assigned: 'Open',
  in_progress: 'In behandeling',
  submitted: 'Ingeleverd',
  reviewed: 'Beoordeeld',
};

const STATUS_ORDER: Assignment['status'][] = ['assigned', 'in_progress', 'submitted', 'reviewed'];

function formatDate(iso: string | null | undefined): string {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('nl-NL', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function isOverdue(due: string | null): boolean {
  if (!due) return false;
  return new Date(due) < new Date();
}

export default function HuiswerkScreen() {
  const router = useRouter();
  const { user } = useAuth();

  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [submittingId, setSubmittingId] = useState<string | null>(null);

  const fetchAssignments = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError(null);
    console.log('[Huiswerk] Fetching assignments for client:', user.id);
    try {
      const { data, error: fetchError } = await supabase
        .from('client_homework_assignments')
        .select('*')
        .eq('client_id', user.id)
        .order('due_date', { ascending: true });

      if (fetchError) {
        console.error('[Huiswerk] Fetch error:', fetchError.message);
        setError('Kon huiswerk niet laden.');
        return;
      }
      console.log('[Huiswerk] Fetched assignments:', data?.length ?? 0);
      setAssignments((data as Assignment[]) ?? []);
    } catch (e: any) {
      console.error('[Huiswerk] fetchAssignments exception:', e);
      setError('Er is iets misgegaan.');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      fetchAssignments();
    }, [fetchAssignments])
  );

  const toggleExpand = (id: string) => {
    console.log('[Huiswerk] Toggle expand assignment:', id);
    setExpandedId((prev) => (prev === id ? null : id));
  };

  const markSubmitted = async (assignment: Assignment) => {
    if (submittingId) return;
    setSubmittingId(assignment.id);
    console.log('[Huiswerk] Marking assignment as submitted:', assignment.id);
    try {
      const { error } = await supabase
        .from('client_homework_assignments')
        .update({ status: 'submitted', submitted_at: new Date().toISOString() })
        .eq('id', assignment.id);

      if (error) {
        console.error('[Huiswerk] Update error:', error.message);
      } else {
        console.log('[Huiswerk] Assignment submitted successfully');
        setAssignments((prev) =>
          prev.map((a) =>
            a.id === assignment.id
              ? { ...a, status: 'submitted', submitted_at: new Date().toISOString() }
              : a
          )
        );
        setExpandedId(null);
      }
    } catch (e: any) {
      console.error('[Huiswerk] markSubmitted exception:', e);
    } finally {
      setSubmittingId(null);
    }
  };

  const isEmpty = !loading && assignments.length === 0;

  const grouped = STATUS_ORDER.reduce<Record<string, Assignment[]>>((acc, status) => {
    acc[status] = assignments.filter((a) => a.status === status);
    return acc;
  }, {} as Record<string, Assignment[]>);

  return (
    <>
      <Stack.Screen
        options={{
          title: 'Huiswerk',
          headerShown: true,
          headerLeft: () => (
            <TouchableOpacity
              onPress={() => {
                console.log('[Huiswerk] Back button pressed');
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
                <Ionicons name="book-outline" size={32} color={bcctColors.primaryOrange} />
              </View>
              <Text style={styles.emptyTitle}>Nog geen huiswerk</Text>
              <Text style={styles.emptySubtitle}>
                Je coach heeft nog geen opdrachten klaargezet.
              </Text>
            </View>
          ) : (
            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.scrollContent}
            >
              {STATUS_ORDER.map((status) => {
                const items = grouped[status];
                if (!items || items.length === 0) return null;
                return (
                  <View key={status} style={styles.section}>
                    <Text style={styles.sectionHeader}>{STATUS_LABELS[status]}</Text>
                    {items.map((assignment) => {
                      const expanded = expandedId === assignment.id;
                      const overdue = isOverdue(assignment.due_date) && status !== 'submitted' && status !== 'reviewed';
                      const dueDateDisplay = formatDate(assignment.due_date);
                      const canSubmit = status === 'assigned' || status === 'in_progress';
                      const submitting = submittingId === assignment.id;

                      return (
                        <TouchableOpacity
                          key={assignment.id}
                          style={styles.card}
                          onPress={() => toggleExpand(assignment.id)}
                          activeOpacity={0.8}
                        >
                          <View style={styles.cardHeader}>
                            <View style={styles.cardTitleRow}>
                              <Text style={styles.cardTitle} numberOfLines={expanded ? undefined : 2}>
                                {assignment.title}
                              </Text>
                              {overdue && (
                                <View style={styles.overdueChip}>
                                  <Text style={styles.overdueChipText}>Te laat</Text>
                                </View>
                              )}
                            </View>
                            <Ionicons
                              name={expanded ? 'chevron-up' : 'chevron-down'}
                              size={18}
                              color={bcctColors.textSecondary}
                            />
                          </View>

                          {assignment.description && !expanded ? (
                            <Text style={styles.cardDesc} numberOfLines={2}>
                              {assignment.description}
                            </Text>
                          ) : null}

                          {dueDateDisplay ? (
                            <View style={styles.dueDateRow}>
                              <Ionicons
                                name="calendar-outline"
                                size={13}
                                color={overdue ? bcctColors.error : bcctColors.textSecondary}
                              />
                              <Text
                                style={[
                                  styles.dueDateText,
                                  overdue && styles.dueDateOverdue,
                                ]}
                              >
                                {dueDateDisplay}
                              </Text>
                            </View>
                          ) : null}

                          {expanded && (
                            <View style={styles.expandedContent}>
                              {assignment.description ? (
                                <Text style={styles.fullDesc}>{assignment.description}</Text>
                              ) : null}
                              {canSubmit && (
                                <TouchableOpacity
                                  style={[styles.submitBtn, submitting && styles.submitBtnDisabled]}
                                  onPress={() => markSubmitted(assignment)}
                                  disabled={submitting}
                                >
                                  {submitting ? (
                                    <ActivityIndicator size="small" color="#fff" />
                                  ) : (
                                    <Text style={styles.submitBtnText}>Markeer als ingeleverd</Text>
                                  )}
                                </TouchableOpacity>
                              )}
                            </View>
                          )}
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                );
              })}
            </ScrollView>
          )}
        </View>
      </SafeAreaView>
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
  section: {
    marginBottom: 20,
  },
  sectionHeader: {
    fontSize: 13,
    fontWeight: '600',
    color: bcctColors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 10,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 8,
    marginBottom: 4,
  },
  cardTitleRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: bcctColors.textPrimary,
    flexShrink: 1,
  },
  overdueChip: {
    backgroundColor: bcctColors.error + '20',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  overdueChipText: {
    fontSize: 11,
    fontWeight: '700',
    color: bcctColors.error,
  },
  cardDesc: {
    fontSize: 13,
    color: bcctColors.textSecondary,
    lineHeight: 18,
    marginBottom: 6,
  },
  dueDateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
  dueDateText: {
    fontSize: 12,
    color: bcctColors.textSecondary,
  },
  dueDateOverdue: {
    color: bcctColors.error,
    fontWeight: '600',
  },
  expandedContent: {
    marginTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: bcctColors.borderGray,
    paddingTop: 12,
  },
  fullDesc: {
    fontSize: 14,
    color: bcctColors.textPrimary,
    lineHeight: 22,
    marginBottom: 14,
  },
  submitBtn: {
    backgroundColor: bcctColors.primaryOrange,
    borderRadius: 10,
    height: 46,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitBtnDisabled: {
    opacity: 0.6,
  },
  submitBtnText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
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
  },
  errorText: {
    fontSize: 15,
    color: bcctColors.error,
    marginTop: 12,
    textAlign: 'center',
  },
});
