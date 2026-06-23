import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  ActivityIndicator,
  Alert,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { bcctColors } from '@/styles/bcctTheme';
import { supabase } from '@/lib/supabase';

const ORANGE = '#F97316';

interface Client {
  id: string;
  name: string;
  avatar_url: string | null;
}

interface Appointment {
  id: string;
  client_id: string;
  title: string | null;
  notes: string | null;
  location: string | null;
  start_time: string;
  end_time: string;
  color: string;
  client: Client;
}

function nextFullHour(): Date {
  const d = new Date();
  d.setMinutes(0, 0, 0);
  d.setHours(d.getHours() + 1);
  return d;
}

function addHour(d: Date): Date {
  const copy = new Date(d);
  copy.setHours(copy.getHours() + 1);
  return copy;
}

function formatTime(d: Date): string {
  const h = String(d.getHours()).padStart(2, '0');
  const m = String(d.getMinutes()).padStart(2, '0');
  return `${h}:${m}`;
}

function formatDate(d: Date): string {
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${day}-${month}-${year}`;
}

function combineDateAndTime(date: Date, time: Date): Date {
  const result = new Date(date);
  result.setHours(time.getHours(), time.getMinutes(), 0, 0);
  return result;
}

export default function AppointmentFormScreen() {
  const router = useRouter();
  const { appointmentId } = useLocalSearchParams<{ appointmentId?: string }>();
  const isEdit = !!appointmentId;

  const [clients, setClients] = useState<Client[]>([]);
  const [clientsLoading, setClientsLoading] = useState(true);
  const [selectedClientId, setSelectedClientId] = useState<string>('');
  const [showClientPicker, setShowClientPicker] = useState(false);

  const [date, setDate] = useState(new Date());
  const [startTime, setStartTime] = useState(nextFullHour());
  const [endTime, setEndTime] = useState(addHour(nextFullHour()));
  const [title, setTitle] = useState('');
  const [notes, setNotes] = useState('');
  const [location, setLocation] = useState('');

  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker] = useState(false);

  const [loading, setLoading] = useState(isEdit);
  const [submitting, setSubmitting] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Fetch active linked clients via two-step Supabase query
  useEffect(() => {
    const fetchClients = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          console.error('[NewAppointment] No authenticated user');
          setClientsLoading(false);
          return;
        }

        const coachProfileId = user.id;
        console.log('[NewAppointment] coach id:', coachProfileId);

        // Step 1: get active client IDs for this coach
        const { data: coachClients, error: coachClientsError } = await supabase
          .from('coach_clients')
          .select('client_id')
          .eq('coach_id', coachProfileId)
          .eq('status', 'active');

        if (coachClientsError) {
          console.error('[NewAppointment] Error fetching coach_clients:', coachClientsError);
          setClientsLoading(false);
          return;
        }

        console.log('[NewAppointment] coach_clients rows:', coachClients?.length ?? 0);

        if (!coachClients || coachClients.length === 0) {
          console.log('[NewAppointment] No active clients found');
          setClients([]);
          setClientsLoading(false);
          return;
        }

        const clientIds = coachClients.map((r) => r.client_id);
        console.log('[NewAppointment] client_ids:', clientIds);

        // Step 2: fetch profiles for those IDs
        const { data: profiles, error: profilesError } = await supabase
          .from('profiles')
          .select('id, full_name, avatar_url, phone, role')
          .in('id', clientIds);

        if (profilesError) {
          console.error('[NewAppointment] Error fetching profiles:', profilesError);
          setClientsLoading(false);
          return;
        }

        console.log('[NewAppointment] profiles fetched:', profiles);

        const options = (profiles ?? []).map((p) => ({
          id: p.id,
          name: p.full_name || 'Cliënt',
          avatar_url: p.avatar_url ?? null,
        }));

        console.log('[NewAppointment] dropdown options:', options);
        setClients(options);
      } catch (err) {
        console.error('[NewAppointment] Unexpected error fetching clients:', err);
      } finally {
        setClientsLoading(false);
      }
    };

    fetchClients();
  }, []);

  // Fetch appointment for edit mode
  useEffect(() => {
    if (!isEdit) return;
    console.log('[AppointmentForm] Edit mode — fetching appointment:', appointmentId);
    supabase
      .from('appointments')
      .select('*')
      .eq('id', appointmentId)
      .single()
      .then(({ data, error }) => {
        if (error || !data) { Alert.alert('Fout', 'Kon afspraak niet laden'); return; }
        console.log('[AppointmentForm] Loaded appointment for edit:', data?.id);
        setSelectedClientId(data.client_id);
        setTitle(data.title ?? '');
        setNotes(data.notes ?? '');
        setLocation(data.location ?? '');
        const start = new Date(data.start_time);
        const end = new Date(data.end_time);
        setDate(start);
        setStartTime(start);
        setEndTime(end);
      })
      .finally(() => setLoading(false));
  }, [appointmentId, isEdit]);

  const selectedClient = clients.find((c) => c.id === selectedClientId);

  const handleSubmit = async () => {
    if (!selectedClientId) {
      Alert.alert('Verplicht veld', 'Selecteer een cliënt');
      return;
    }

    const startDateTime = combineDateAndTime(date, startTime);
    const endDateTime = combineDateAndTime(date, endTime);

    if (endDateTime <= startDateTime) {
      Alert.alert('Ongeldige tijd', 'Eindtijd moet na starttijd liggen');
      return;
    }

    const payload = {
      client_id: selectedClientId,
      start_time: startDateTime.toISOString(),
      end_time: endDateTime.toISOString(),
      title: title.trim() || null,
      notes: notes.trim() || null,
      location: location.trim() || null,
    };

    console.log('[AppointmentForm] Submitting appointment, isEdit:', isEdit, 'payload:', payload);
    setSubmitting(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');
      if (isEdit) {
        const { error } = await supabase.from('appointments').update(payload).eq('id', appointmentId);
        if (error) throw error;
        console.log('[AppointmentForm] Appointment updated successfully');
      } else {
        const { error } = await supabase.from('appointments').insert({ ...payload, coach_id: user.id });
        if (error) throw error;
        console.log('[AppointmentForm] Appointment created successfully');
      }
      router.back();
    } catch (err: any) {
      console.error('[AppointmentForm] Submit error:', err);
      const msg = String(err?.message ?? '');
      if (msg.includes('409') || msg.toLowerCase().includes('conflict')) {
        Alert.alert('Conflict', 'Er is al een afspraak op dit tijdstip');
      } else {
        Alert.alert('Fout', 'Kon afspraak niet opslaan. Probeer het opnieuw.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = () => {
    console.log('[AppointmentForm] Delete pressed, appointmentId:', appointmentId);
    Alert.alert(
      'Afspraak verwijderen',
      'Weet je zeker dat je deze afspraak wilt verwijderen?',
      [
        { text: 'Annuleren', style: 'cancel' },
        {
          text: 'Verwijderen',
          style: 'destructive',
          onPress: async () => {
            console.log('[AppointmentForm] Confirmed delete, appointmentId:', appointmentId);
            setDeleting(true);
            try {
              const { error } = await supabase.from('appointments').delete().eq('id', appointmentId);
              if (error) throw error;
              console.log('[AppointmentForm] Appointment deleted successfully');
              router.back();
            } catch (err: any) {
              console.error('[AppointmentForm] Delete error:', err);
              Alert.alert('Fout', 'Kon afspraak niet verwijderen. Probeer het opnieuw.');
            } finally {
              setDeleting(false);
            }
          },
        },
      ]
    );
  };

  const handleBack = () => {
    console.log('[AppointmentForm] Back pressed');
    router.back();
  };

  const handleClientSelect = (clientId: string) => {
    console.log('[AppointmentForm] Client selected:', clientId);
    setSelectedClientId(clientId);
    setShowClientPicker(false);
  };

  const handleDateChange = (_: any, selected?: Date) => {
    setShowDatePicker(Platform.OS === 'ios');
    if (selected) {
      console.log('[AppointmentForm] Date changed:', selected.toISOString());
      setDate(selected);
    }
  };

  const handleStartTimeChange = (_: any, selected?: Date) => {
    setShowStartPicker(Platform.OS === 'ios');
    if (selected) {
      console.log('[AppointmentForm] Start time changed:', selected.toISOString());
      setStartTime(selected);
      const newEnd = addHour(selected);
      if (newEnd > endTime) setEndTime(newEnd);
    }
  };

  const handleEndTimeChange = (_: any, selected?: Date) => {
    setShowEndPicker(Platform.OS === 'ios');
    if (selected) {
      console.log('[AppointmentForm] End time changed:', selected.toISOString());
      setEndTime(selected);
    }
  };

  const screenTitle = isEdit ? 'Afspraak bewerken' : 'Nieuwe afspraak';
  const dateLabel = formatDate(date);
  const startLabel = formatTime(startTime);
  const endLabel = formatTime(endTime);

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <View style={styles.navBar}>
          <TouchableOpacity style={styles.backBtn} onPress={handleBack}>
            <Ionicons name="chevron-back" size={24} color={bcctColors.textPrimary} />
          </TouchableOpacity>
        </View>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={ORANGE} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      {/* Nav bar */}
      <View style={styles.navBar}>
        <TouchableOpacity style={styles.backBtn} onPress={handleBack}>
          <Ionicons name="chevron-back" size={24} color={bcctColors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.navTitle}>{screenTitle}</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Client picker */}
        <Text style={styles.fieldLabel}>
          Cliënt
          <Text style={styles.required}> *</Text>
        </Text>
        <TouchableOpacity
          style={styles.pickerBtn}
          onPress={() => {
            console.log('[AppointmentForm] Client picker opened');
            setShowClientPicker(!showClientPicker);
          }}
        >
          {clientsLoading ? (
            <ActivityIndicator size="small" color={ORANGE} />
          ) : (
            <Text style={[styles.pickerBtnText, !selectedClient && styles.pickerBtnPlaceholder]}>
              {selectedClient ? selectedClient.name : 'Selecteer een cliënt'}
            </Text>
          )}
          <Ionicons name={showClientPicker ? 'chevron-up' : 'chevron-down'} size={18} color={bcctColors.textSecondary} />
        </TouchableOpacity>

        {showClientPicker && (
          <View style={styles.clientDropdown}>
            {clients.length === 0 ? (
              <Text style={styles.dropdownEmpty}>Geen gekoppelde cliënten</Text>
            ) : (
              clients.map((client) => {
                const isSelected = client.id === selectedClientId;
                return (
                  <TouchableOpacity
                    key={client.id}
                    style={[styles.dropdownItem, isSelected && styles.dropdownItemSelected]}
                    onPress={() => handleClientSelect(client.id)}
                  >
                    <Text style={[styles.dropdownItemText, isSelected && styles.dropdownItemTextSelected]}>
                      {client.name}
                    </Text>
                    {isSelected && <Ionicons name="checkmark" size={18} color={ORANGE} />}
                  </TouchableOpacity>
                );
              })
            )}
          </View>
        )}

        {/* Date */}
        <Text style={styles.fieldLabel}>Datum</Text>
        <TouchableOpacity
          style={styles.pickerBtn}
          onPress={() => {
            console.log('[AppointmentForm] Date picker opened');
            setShowDatePicker(true);
          }}
        >
          <Text style={styles.pickerBtnText}>{dateLabel}</Text>
          <Ionicons name="calendar-outline" size={18} color={bcctColors.textSecondary} />
        </TouchableOpacity>
        {showDatePicker && (
          <DateTimePicker
            value={date}
            mode="date"
            display={Platform.OS === 'ios' ? 'inline' : 'default'}
            onChange={handleDateChange}
            minimumDate={new Date(2020, 0, 1)}
          />
        )}

        {/* Start time */}
        <Text style={styles.fieldLabel}>Starttijd</Text>
        <TouchableOpacity
          style={styles.pickerBtn}
          onPress={() => {
            console.log('[AppointmentForm] Start time picker opened');
            setShowStartPicker(true);
          }}
        >
          <Text style={styles.pickerBtnText}>{startLabel}</Text>
          <Ionicons name="time-outline" size={18} color={bcctColors.textSecondary} />
        </TouchableOpacity>
        {showStartPicker && (
          <DateTimePicker
            value={startTime}
            mode="time"
            is24Hour
            display={Platform.OS === 'ios' ? 'spinner' : 'default'}
            onChange={handleStartTimeChange}
          />
        )}

        {/* End time */}
        <Text style={styles.fieldLabel}>Eindtijd</Text>
        <TouchableOpacity
          style={styles.pickerBtn}
          onPress={() => {
            console.log('[AppointmentForm] End time picker opened');
            setShowEndPicker(true);
          }}
        >
          <Text style={styles.pickerBtnText}>{endLabel}</Text>
          <Ionicons name="time-outline" size={18} color={bcctColors.textSecondary} />
        </TouchableOpacity>
        {showEndPicker && (
          <DateTimePicker
            value={endTime}
            mode="time"
            is24Hour
            display={Platform.OS === 'ios' ? 'spinner' : 'default'}
            onChange={handleEndTimeChange}
          />
        )}

        {/* Title */}
        <Text style={styles.fieldLabel}>Titel (optioneel)</Text>
        <TextInput
          style={styles.textInput}
          value={title}
          onChangeText={setTitle}
          placeholder="Bijv. Intake gesprek"
          placeholderTextColor={bcctColors.textSecondary}
          returnKeyType="next"
          onFocus={() => console.log('[AppointmentForm] Title field focused')}
        />

        {/* Notes */}
        <Text style={styles.fieldLabel}>Notities (optioneel)</Text>
        <TextInput
          style={[styles.textInput, styles.textArea]}
          value={notes}
          onChangeText={setNotes}
          placeholder="Voeg notities toe..."
          placeholderTextColor={bcctColors.textSecondary}
          multiline
          numberOfLines={4}
          textAlignVertical="top"
          onFocus={() => console.log('[AppointmentForm] Notes field focused')}
        />

        {/* Location */}
        <Text style={styles.fieldLabel}>Locatie (optioneel)</Text>
        <TextInput
          style={styles.textInput}
          value={location}
          onChangeText={setLocation}
          placeholder="Bijv. Online / Kantoor Amsterdam"
          placeholderTextColor={bcctColors.textSecondary}
          returnKeyType="done"
          onFocus={() => console.log('[AppointmentForm] Location field focused')}
        />

        {/* Submit */}
        <TouchableOpacity
          style={[styles.submitBtn, submitting && styles.submitBtnDisabled]}
          onPress={handleSubmit}
          disabled={submitting}
        >
          {submitting ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Text style={styles.submitBtnText}>Opslaan afspraak</Text>
          )}
        </TouchableOpacity>

        {/* Delete (edit mode only) */}
        {isEdit && (
          <TouchableOpacity
            style={styles.deleteBtn}
            onPress={handleDelete}
            disabled={deleting}
          >
            {deleting ? (
              <ActivityIndicator size="small" color={bcctColors.error} />
            ) : (
              <Text style={styles.deleteBtnText}>Verwijderen</Text>
            )}
          </TouchableOpacity>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: bcctColors.lightBackground,
  },
  navBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  navTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: bcctColors.textPrimary,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scroll: { flex: 1 },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  fieldLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: bcctColors.textPrimary,
    marginBottom: 6,
    marginTop: 16,
  },
  required: {
    color: bcctColors.error,
  },
  pickerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: bcctColors.borderGray,
  },
  pickerBtnText: {
    fontSize: 15,
    color: bcctColors.textPrimary,
    fontWeight: '500',
  },
  pickerBtnPlaceholder: {
    color: bcctColors.textSecondary,
    fontWeight: '400',
  },
  clientDropdown: {
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: bcctColors.borderGray,
    marginTop: 4,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 4,
  },
  dropdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 13,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  dropdownItemSelected: {
    backgroundColor: ORANGE + '10',
  },
  dropdownItemText: {
    fontSize: 15,
    color: bcctColors.textPrimary,
  },
  dropdownItemTextSelected: {
    fontWeight: '600',
    color: ORANGE,
  },
  dropdownEmpty: {
    padding: 14,
    fontSize: 14,
    color: bcctColors.textSecondary,
    textAlign: 'center',
  },
  textInput: {
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 14,
    fontSize: 15,
    color: bcctColors.textPrimary,
    borderWidth: 1,
    borderColor: bcctColors.borderGray,
  },
  textArea: {
    minHeight: 100,
    paddingTop: 12,
  },
  submitBtn: {
    backgroundColor: ORANGE,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 28,
    shadowColor: ORANGE,
    shadowOpacity: 0.3,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  submitBtnDisabled: {
    opacity: 0.7,
  },
  submitBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  deleteBtn: {
    alignItems: 'center',
    paddingVertical: 16,
    marginTop: 8,
  },
  deleteBtnText: {
    color: bcctColors.error,
    fontSize: 15,
    fontWeight: '600',
  },
});
