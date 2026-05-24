import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  TouchableOpacity,
  Modal,
  KeyboardAvoidingView,
  Platform,
  useWindowDimensions,
} from 'react-native';
import { Stack, useRouter, useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { bcctColors } from '@/styles/bcctTheme';
import LifeWheelView, { LifeWheelScores, calculateLifeWheelAverage } from '@/components/LifeWheelView';
import LifeWheelForm from '@/components/LifeWheelForm';

interface Assessment {
  id: string;
  coach_id: string | null;
  client_id: string;
  health: number;
  work_score: number;
  finance_score: number;
  relationship_score: number;
  family_score: number;
  personal_growth_score: number;
  social_score: number;
  mental_health_score: number;
  notes: string | null;
  created_at: string;
}

function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('nl-NL', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function assessmentToScores(a: Assessment): LifeWheelScores {
  return {
    health: a.health,
    work_score: a.work_score,
    finance_score: a.finance_score,
    relationship_score: a.relationship_score,
    family_score: a.family_score,
    personal_growth_score: a.personal_growth_score,
    social_score: a.social_score,
    mental_health_score: a.mental_health_score,
  };
}

export default function MijnGroeiScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const { height: screenHeight } = useWindowDimensions();

  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [loading, setLoading] = useState(true);
  const [addModalVisible, setAddModalVisible] = useState(false);
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [selectedAssessment, setSelectedAssessment] = useState<Assessment | null>(null);
  const [saving, setSaving] = useState(false);

  const fetchAssessments = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    console.log('[MijnGroei] Fetching assessments for client:', user.id);
    try {
      const { data, error } = await supabase
        .from('life_wheel_assessments')
        .select('*')
        .eq('client_id', user.id)
        .order('created_at', { ascending: false });

      if (error) {
        if (error.code === '42501' || error.message?.includes('row-level security')) {
          console.error('[MijnGroei] RLS error — check policies:', error.message);
        } else {
          console.error('[MijnGroei] Fetch error:', error.message);
        }
        return;
      }
      console.log('[MijnGroei] Fetched assessments:', data?.length ?? 0);
      setAssessments((data as Assessment[]) ?? []);
    } catch (e: any) {
      console.error('[MijnGroei] fetchAssessments exception:', e);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      fetchAssessments();
    }, [fetchAssessments])
  );

  const openAddModal = () => {
    console.log('[MijnGroei] Open add modal');
    setAddModalVisible(true);
  };

  const closeAddModal = () => {
    console.log('[MijnGroei] Close add modal');
    setAddModalVisible(false);
  };

  const openDetailModal = (assessment: Assessment) => {
    console.log('[MijnGroei] Open detail modal for assessment:', assessment.id);
    setSelectedAssessment(assessment);
    setDetailModalVisible(true);
  };

  const closeDetailModal = () => {
    console.log('[MijnGroei] Close detail modal');
    setDetailModalVisible(false);
    setSelectedAssessment(null);
  };

  const handleSave = async (scores: LifeWheelScores, notes: string) => {
    if (!user) return;
    console.log('[MijnGroei] Save start, scores:', scores);
    setSaving(true);
    try {
      const { data: link } = await supabase
        .from('coach_clients')
        .select('coach_id')
        .eq('client_id', user.id)
        .eq('status', 'active')
        .maybeSingle();
      const coachId = link?.coach_id ?? null;

      const payload = {
        coach_id: coachId,
        client_id: user.id,
        ...scores,
        notes: notes.trim() || null,
      };

      const { error } = await supabase.from('life_wheel_assessments').insert(payload);
      if (error) {
        if (error.code === '42501' || error.message?.includes('row-level security')) {
          console.error('[MijnGroei] RLS error on insert — check policies:', error.message);
        } else {
          console.error('[MijnGroei] Insert error:', error.message);
        }
        return;
      }
      console.log('[MijnGroei] Assessment saved successfully');
      setAddModalVisible(false);
      await fetchAssessments();
    } catch (e: any) {
      console.error('[MijnGroei] handleSave exception:', e);
    } finally {
      setSaving(false);
    }
  };

  const sheetHeight = screenHeight * 0.88;

  const latest = assessments[0] ?? null;
  const history = assessments.slice(1);

  const latestScores = latest ? assessmentToScores(latest) : null;
  const latestDate = latest ? formatDate(latest.created_at) : null;
  const latestAvg = latestScores ? String(calculateLifeWheelAverage(latestScores)) : null;

  const selectedScores = selectedAssessment ? assessmentToScores(selectedAssessment) : null;
  const selectedDate = selectedAssessment ? formatDate(selectedAssessment.created_at) : null;

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <Stack.Screen options={{ title: 'Mijn Groei', headerShown: true }} />

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={bcctColors.primaryOrange} />
        </View>
      ) : assessments.length === 0 ? (
        <View style={styles.emptyContainer}>
          <View style={styles.emptyIconCircle}>
            <Ionicons name="leaf-outline" size={32} color={bcctColors.primaryOrange} />
          </View>
          <Text style={styles.emptyTitle}>Je hebt nog geen levenswiel ingevuld</Text>
          <Text style={styles.emptySubtitle}>
            Geef per levensgebied een score van 1 tot 10.
          </Text>
          <TouchableOpacity style={styles.primaryBtn} onPress={openAddModal}>
            <Text style={styles.primaryBtnText}>Levenswiel invullen</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Latest card */}
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Text style={styles.cardTitle}>Laatste meting</Text>
              <Text style={styles.cardDate}>{latestDate}</Text>
            </View>
            {latestScores && <LifeWheelView scores={latestScores} showAverage />}
            {latest?.notes ? (
              <Text style={styles.notesPreview} numberOfLines={2}>
                {latest.notes}
              </Text>
            ) : null}
          </View>

          {/* New measurement button */}
          <TouchableOpacity style={styles.primaryBtn} onPress={openAddModal}>
            <Text style={styles.primaryBtnText}>+ Nieuwe meting</Text>
          </TouchableOpacity>

          {/* History */}
          {history.length > 0 && (
            <View style={styles.historySection}>
              <Text style={styles.sectionHeader}>Geschiedenis</Text>
              {history.map((item) => {
                const itemScores = assessmentToScores(item);
                const avg = calculateLifeWheelAverage(itemScores);
                const avgDisplay = String(avg);
                const dateDisplay = formatDate(item.created_at);
                return (
                  <TouchableOpacity
                    key={item.id}
                    style={styles.historyCard}
                    onPress={() => openDetailModal(item)}
                  >
                    <View style={styles.historyCardLeft}>
                      <Text style={styles.historyDate}>{dateDisplay}</Text>
                      {item.notes ? (
                        <Text style={styles.historyNotes} numberOfLines={1}>
                          {item.notes}
                        </Text>
                      ) : null}
                    </View>
                    <Text style={styles.historyAvg}>{avgDisplay}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}
        </ScrollView>
      )}

      {/* Add modal */}
      <Modal
        visible={addModalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={closeAddModal}
      >
        <KeyboardAvoidingView
          style={styles.modalWrapper}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <View style={[styles.sheet, { height: sheetHeight }]}>
            <View style={styles.dragHandle} />
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Nieuwe meting</Text>
            </View>
            <LifeWheelForm
              saving={saving}
              onCancel={closeAddModal}
              onSave={handleSave}
            />
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Detail modal */}
      <Modal
        visible={detailModalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={closeDetailModal}
      >
        <View style={[styles.sheet, { height: sheetHeight }]}>
          <View style={styles.dragHandle} />
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Meting</Text>
            <Text style={styles.modalSubtitle}>{selectedDate}</Text>
          </View>
          <ScrollView
            style={styles.detailScroll}
            contentContainerStyle={styles.detailScrollContent}
            showsVerticalScrollIndicator={false}
          >
            {selectedScores && <LifeWheelView scores={selectedScores} showAverage />}
            {selectedAssessment?.notes ? (
              <View style={styles.detailNotesBlock}>
                <Text style={styles.detailNotesLabel}>Notities</Text>
                <Text style={styles.detailNotesText}>{selectedAssessment.notes}</Text>
              </View>
            ) : null}
          </ScrollView>
          <View style={styles.detailFooter}>
            <TouchableOpacity style={styles.primaryBtn} onPress={closeDetailModal}>
              <Text style={styles.primaryBtnText}>Sluiten</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: bcctColors.lightBackground,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  emptyIconCircle: {
    width: 72,
    height: 72,
    borderRadius: 22,
    backgroundColor: bcctColors.primaryOrange + '15',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: bcctColors.textPrimary,
    textAlign: 'center',
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    color: bcctColors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 28,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
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
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: bcctColors.textPrimary,
  },
  cardDate: {
    fontSize: 13,
    color: bcctColors.textSecondary,
  },
  notesPreview: {
    fontSize: 13,
    color: bcctColors.textSecondary,
    marginTop: 12,
    lineHeight: 18,
  },
  primaryBtn: {
    backgroundColor: bcctColors.primaryOrange,
    borderRadius: 12,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  primaryBtnText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },
  historySection: {
    marginTop: 4,
  },
  sectionHeader: {
    fontSize: 16,
    fontWeight: '700',
    color: bcctColors.textPrimary,
    marginBottom: 10,
  },
  historyCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 2,
  },
  historyCardLeft: {
    flex: 1,
    gap: 3,
  },
  historyDate: {
    fontSize: 14,
    fontWeight: '600',
    color: bcctColors.textPrimary,
  },
  historyNotes: {
    fontSize: 13,
    color: bcctColors.textSecondary,
  },
  historyAvg: {
    fontSize: 18,
    fontWeight: '800',
    color: bcctColors.primaryOrange,
    marginLeft: 12,
  },
  modalWrapper: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    overflow: 'hidden',
    flex: 1,
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
  modalSubtitle: {
    fontSize: 13,
    color: bcctColors.textSecondary,
    marginTop: 2,
  },
  detailScroll: {
    flex: 1,
  },
  detailScrollContent: {
    padding: 20,
    paddingBottom: 16,
  },
  detailNotesBlock: {
    marginTop: 16,
    padding: 14,
    backgroundColor: bcctColors.lightBackground,
    borderRadius: 10,
  },
  detailNotesLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: bcctColors.textSecondary,
    marginBottom: 6,
  },
  detailNotesText: {
    fontSize: 15,
    color: bcctColors.textPrimary,
    lineHeight: 22,
  },
  detailFooter: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: bcctColors.borderGray,
  },
});
