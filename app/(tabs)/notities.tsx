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
} from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { bcctColors } from '@/styles/bcctTheme';

interface Note {
  id: string;
  coach_id: string | null;
  client_id: string;
  created_by: string;
  title: string | null;
  content: string;
  is_private: boolean;
  created_at: string;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('nl-NL', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export default function NotitiesScreen() {
  const router = useRouter();
  const { user } = useAuth();

  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modal state
  const [modalVisible, setModalVisible] = useState(false);
  const [saving, setSaving] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newContent, setNewContent] = useState('');

  const fetchNotes = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError(null);
    console.log('[Notities] Fetching notes for client:', user.id);
    try {
      const { data, error: fetchError } = await supabase
        .from('client_notes')
        .select('*')
        .eq('client_id', user.id)
        .eq('is_private', false)
        .order('created_at', { ascending: false });

      if (fetchError) {
        console.error('[Notities] Fetch error:', fetchError.message);
        setError('Kon notities niet laden.');
        return;
      }
      console.log('[Notities] Fetched notes:', data?.length ?? 0);
      setNotes((data as Note[]) ?? []);
    } catch (e: any) {
      console.error('[Notities] fetchNotes exception:', e);
      setError('Er is iets misgegaan.');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      fetchNotes();
    }, [fetchNotes])
  );

  const openModal = () => {
    console.log('[Notities] Open new reflection modal');
    setNewTitle('');
    setNewContent('');
    setModalVisible(true);
  };

  const closeModal = () => {
    console.log('[Notities] Close new reflection modal');
    setModalVisible(false);
  };

  const saveNote = async () => {
    if (!user || !newContent.trim()) return;
    setSaving(true);
    console.log('[Notities] Saving new reflection');
    try {
      const { data: link } = await supabase
        .from('coach_clients')
        .select('coach_id')
        .eq('client_id', user.id)
        .eq('status', 'active')
        .maybeSingle();
      const coachId = link?.coach_id ?? null;

      const payload = {
        client_id: user.id,
        created_by: user.id,
        coach_id: coachId,
        title: newTitle.trim() || null,
        content: newContent.trim(),
        is_private: false,
      };

      const { error } = await supabase.from('client_notes').insert(payload);
      if (error) {
        console.error('[Notities] Insert error:', error.message);
      } else {
        console.log('[Notities] Reflection saved successfully');
        setModalVisible(false);
        await fetchNotes();
      }
    } catch (e: any) {
      console.error('[Notities] saveNote exception:', e);
    } finally {
      setSaving(false);
    }
  };

  const coachNotes = notes.filter((n) => n.created_by !== user?.id);
  const myNotes = notes.filter((n) => n.created_by === user?.id);
  const isEmpty = !loading && notes.length === 0;

  return (
    <>
      <Stack.Screen
        options={{
          title: 'Notities',
          headerShown: true,
          headerLeft: () => (
            <TouchableOpacity
              onPress={() => {
                console.log('[Notities] Back button pressed');
                router.back();
              }}
              style={styles.backBtn}
            >
              <Ionicons name="chevron-back" size={24} color={bcctColors.primaryOrange} />
            </TouchableOpacity>
          ),
          headerRight: () => (
            <TouchableOpacity
              onPress={openModal}
              style={styles.headerAddBtn}
            >
              <Ionicons name="add" size={26} color={bcctColors.primaryOrange} />
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
                <Ionicons name="document-text-outline" size={32} color={bcctColors.primaryOrange} />
              </View>
              <Text style={styles.emptyTitle}>Nog geen notities</Text>
              <Text style={styles.emptySubtitle}>
                Je coach heeft nog geen notities gedeeld en je hebt zelf nog geen reflecties opgeschreven.
              </Text>
              <TouchableOpacity style={styles.primaryBtn} onPress={openModal}>
                <Text style={styles.primaryBtnText}>+ Nieuwe reflectie</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.scrollContent}
            >
              {coachNotes.length > 0 && (
                <View style={styles.section}>
                  <Text style={styles.sectionHeader}>Van je coach</Text>
                  {coachNotes.map((note) => {
                    const dateDisplay = formatDate(note.created_at);
                    return (
                      <View key={note.id} style={[styles.noteCard, styles.coachNoteCard]}>
                        <View style={styles.noteCardHeader}>
                          {note.title ? (
                            <Text style={styles.noteTitle}>{note.title}</Text>
                          ) : null}
                          <Text style={styles.noteDate}>{dateDisplay}</Text>
                        </View>
                        <Text style={styles.noteContent}>{note.content}</Text>
                      </View>
                    );
                  })}
                </View>
              )}

              {myNotes.length > 0 && (
                <View style={styles.section}>
                  <Text style={styles.sectionHeader}>Mijn reflecties</Text>
                  {myNotes.map((note) => {
                    const dateDisplay = formatDate(note.created_at);
                    return (
                      <View key={note.id} style={styles.noteCard}>
                        <View style={styles.noteCardHeader}>
                          {note.title ? (
                            <Text style={styles.noteTitle}>{note.title}</Text>
                          ) : null}
                          <Text style={styles.noteDate}>{dateDisplay}</Text>
                        </View>
                        <Text style={styles.noteContent}>{note.content}</Text>
                      </View>
                    );
                  })}
                </View>
              )}

              <TouchableOpacity style={styles.addBtn} onPress={openModal}>
                <Ionicons name="add-circle-outline" size={20} color={bcctColors.primaryOrange} />
                <Text style={styles.addBtnText}>+ Nieuwe reflectie</Text>
              </TouchableOpacity>
            </ScrollView>
          )}
        </View>
      </SafeAreaView>

      {/* New reflection modal */}
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
              <Text style={styles.modalTitle}>Nieuwe reflectie</Text>
              <TouchableOpacity onPress={closeModal}>
                <Ionicons name="close" size={24} color={bcctColors.textSecondary} />
              </TouchableOpacity>
            </View>
            <ScrollView
              style={styles.modalScroll}
              contentContainerStyle={styles.modalScrollContent}
              keyboardShouldPersistTaps="handled"
            >
              <Text style={styles.fieldLabel}>Titel (optioneel)</Text>
              <TextInput
                style={styles.textInput}
                placeholder="bijv. Inzicht van vandaag"
                placeholderTextColor={bcctColors.textSecondary}
                value={newTitle}
                onChangeText={setNewTitle}
              />

              <Text style={styles.fieldLabel}>Reflectie *</Text>
              <TextInput
                style={[styles.textInput, styles.textArea]}
                placeholder="Schrijf hier je gedachten, inzichten of reflecties..."
                placeholderTextColor={bcctColors.textSecondary}
                value={newContent}
                onChangeText={setNewContent}
                multiline
                numberOfLines={6}
                textAlignVertical="top"
              />
            </ScrollView>

            <View style={styles.modalFooter}>
              <TouchableOpacity style={styles.cancelBtn} onPress={closeModal}>
                <Text style={styles.cancelBtnText}>Annuleren</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.saveBtn, (!newContent.trim() || saving) && styles.saveBtnDisabled]}
                onPress={saveNote}
                disabled={!newContent.trim() || saving}
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
  headerAddBtn: {
    paddingHorizontal: 8,
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
  noteCard: {
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
  coachNoteCard: {
    borderLeftWidth: 3,
    borderLeftColor: bcctColors.primaryOrange,
  },
  noteCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  noteTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: bcctColors.textPrimary,
    flex: 1,
    marginRight: 8,
  },
  noteDate: {
    fontSize: 12,
    color: bcctColors.textSecondary,
  },
  noteContent: {
    fontSize: 14,
    color: bcctColors.textPrimary,
    lineHeight: 21,
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
    maxWidth: 280,
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
    minHeight: 140,
    textAlignVertical: 'top',
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
