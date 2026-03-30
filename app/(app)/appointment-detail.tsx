import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { bcctColors, bcctTypography } from '@/styles/bcctTheme';
import { apiGet, apiDelete } from '@/utils/api';

const ORANGE = '#F97316';

const DUTCH_DAYS = ['Zondag', 'Maandag', 'Dinsdag', 'Woensdag', 'Donderdag', 'Vrijdag', 'Zaterdag'];
const DUTCH_MONTHS = [
  'januari', 'februari', 'maart', 'april', 'mei', 'juni',
  'juli', 'augustus', 'september', 'oktober', 'november', 'december',
];

interface Client {
  id: string;
  name: string;
  avatar_url: string | null;
}

interface Appointment {
  id: string;
  coach_id: string;
  client_id: string;
  title: string | null;
  notes: string | null;
  location: string | null;
  start_time: string;
  end_time: string;
  color: string;
  created_at: string;
  client: Client;
}

function formatDutchFullDate(iso: string): string {
  const d = new Date(iso);
  const day = DUTCH_DAYS[d.getDay()];
  const date = d.getDate();
  const month = DUTCH_MONTHS[d.getMonth()];
  const year = d.getFullYear();
  return `${day} ${date} ${month} ${year}`;
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  const h = String(d.getHours()).padStart(2, '0');
  const m = String(d.getMinutes()).padStart(2, '0');
  return `${h}:${m}`;
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

export default function AppointmentDetailScreen() {
  const router = useRouter();
  const { appointmentId } = useLocalSearchParams<{ appointmentId: string }>();
  const [appointment, setAppointment] = useState<Appointment | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchAppointment = useCallback(async () => {
    if (!appointmentId) return;
    console.log('[AppointmentDetail] Fetching appointment id:', appointmentId);
    setLoading(true);
    setError(null);
    try {
      const data = await apiGet<Appointment>(`/api/appointments/${appointmentId}`);
      console.log('[AppointmentDetail] Fetched appointment:', data?.id);
      setAppointment(data);
    } catch (err: any) {
      console.error('[AppointmentDetail] Fetch error:', err);
      setError('Kon afspraak niet laden');
    } finally {
      setLoading(false);
    }
  }, [appointmentId]);

  useEffect(() => {
    fetchAppointment();
  }, [fetchAppointment]);

  const handleEdit = () => {
    console.log('[AppointmentDetail] Bewerken pressed, appointmentId:', appointmentId);
    router.push({ pathname: '/(app)/appointment-form', params: { appointmentId } });
  };

  const handleDelete = () => {
    console.log('[AppointmentDetail] Verwijderen pressed, appointmentId:', appointmentId);
    Alert.alert(
      'Afspraak verwijderen',
      'Weet je zeker dat je deze afspraak wilt verwijderen?',
      [
        { text: 'Annuleren', style: 'cancel' },
        {
          text: 'Verwijderen',
          style: 'destructive',
          onPress: async () => {
            console.log('[AppointmentDetail] Confirmed delete, appointmentId:', appointmentId);
            setDeleting(true);
            try {
              await apiDelete(`/api/appointments/${appointmentId}`);
              console.log('[AppointmentDetail] Appointment deleted successfully');
              router.back();
            } catch (err: any) {
              console.error('[AppointmentDetail] Delete error:', err);
              Alert.alert('Fout', 'Kon afspraak niet verwijderen. Probeer het opnieuw.');
            } finally {
              setDeleting(false);
            }
          },
        },
      ]
    );
  };

  const handleStartChat = () => {
    console.log('[AppointmentDetail] Start chat pressed for client:', appointment?.client?.id);
    router.push('/(tabs)/(chat)/');
  };

  const handleBack = () => {
    console.log('[AppointmentDetail] Back pressed');
    router.back();
  };

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

  if (error || !appointment) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <View style={styles.navBar}>
          <TouchableOpacity style={styles.backBtn} onPress={handleBack}>
            <Ionicons name="chevron-back" size={24} color={bcctColors.textPrimary} />
          </TouchableOpacity>
        </View>
        <View style={styles.centered}>
          <Ionicons name="alert-circle-outline" size={40} color={bcctColors.textSecondary} />
          <Text style={styles.errorText}>{error ?? 'Afspraak niet gevonden'}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={fetchAppointment}>
            <Text style={styles.retryBtnText}>Opnieuw proberen</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const clientName = appointment.client?.name ?? 'Onbekend';
  const initials = getInitials(clientName);
  const color = appointment.color || ORANGE;
  const dateLabel = formatDutchFullDate(appointment.start_time);
  const startTime = formatTime(appointment.start_time);
  const endTime = formatTime(appointment.end_time);
  const timeRange = `${startTime} – ${endTime}`;

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      {/* Nav bar */}
      <View style={styles.navBar}>
        <TouchableOpacity style={styles.backBtn} onPress={handleBack}>
          <Ionicons name="chevron-back" size={24} color={bcctColors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.navTitle}>Afspraak</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Client header */}
        <View style={styles.clientHeader}>
          <View style={[styles.avatar, { backgroundColor: color + '30' }]}>
            <Text style={[styles.avatarInitials, { color }]}>{initials}</Text>
          </View>
          <Text style={styles.clientName}>{clientName}</Text>
        </View>

        {/* Color accent bar */}
        <View style={[styles.colorBar, { backgroundColor: color }]} />

        {/* Detail card */}
        <View style={styles.card}>
          {/* Date */}
          <View style={styles.detailRow}>
            <View style={styles.detailIconWrap}>
              <Ionicons name="calendar-outline" size={20} color={ORANGE} />
            </View>
            <View style={styles.detailTextWrap}>
              <Text style={styles.detailLabel}>Datum</Text>
              <Text style={styles.detailValue}>{dateLabel}</Text>
            </View>
          </View>

          <View style={styles.divider} />

          {/* Time */}
          <View style={styles.detailRow}>
            <View style={styles.detailIconWrap}>
              <Ionicons name="time-outline" size={20} color={ORANGE} />
            </View>
            <View style={styles.detailTextWrap}>
              <Text style={styles.detailLabel}>Tijd</Text>
              <Text style={styles.detailValue}>{timeRange}</Text>
            </View>
          </View>

          {appointment.title ? (
            <>
              <View style={styles.divider} />
              <View style={styles.detailRow}>
                <View style={styles.detailIconWrap}>
                  <Ionicons name="document-text-outline" size={20} color={ORANGE} />
                </View>
                <View style={styles.detailTextWrap}>
                  <Text style={styles.detailLabel}>Titel</Text>
                  <Text style={styles.detailValue}>{appointment.title}</Text>
                </View>
              </View>
            </>
          ) : null}

          {appointment.location ? (
            <>
              <View style={styles.divider} />
              <View style={styles.detailRow}>
                <View style={styles.detailIconWrap}>
                  <Ionicons name="location-outline" size={20} color={ORANGE} />
                </View>
                <View style={styles.detailTextWrap}>
                  <Text style={styles.detailLabel}>Locatie</Text>
                  <Text style={styles.detailValue}>{appointment.location}</Text>
                </View>
              </View>
            </>
          ) : null}

          {appointment.notes ? (
            <>
              <View style={styles.divider} />
              <View style={styles.detailRow}>
                <View style={styles.detailIconWrap}>
                  <Ionicons name="create-outline" size={20} color={ORANGE} />
                </View>
                <View style={styles.detailTextWrap}>
                  <Text style={styles.detailLabel}>Notities</Text>
                  <Text style={styles.detailValue}>{appointment.notes}</Text>
                </View>
              </View>
            </>
          ) : null}
        </View>

        {/* Action buttons */}
        <TouchableOpacity style={styles.primaryBtn} onPress={handleEdit}>
          <Ionicons name="pencil-outline" size={18} color="#fff" />
          <Text style={styles.primaryBtnText}>Bewerken</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.secondaryBtn} onPress={handleStartChat}>
          <Ionicons name="chatbubble-outline" size={18} color={ORANGE} />
          <Text style={styles.secondaryBtnText}>Start chat met cliënt</Text>
        </TouchableOpacity>

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
    gap: 12,
  },
  errorText: {
    fontSize: 15,
    color: bcctColors.textSecondary,
    textAlign: 'center',
  },
  retryBtn: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: ORANGE,
  },
  retryBtnText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 16, paddingTop: 8 },
  clientHeader: {
    alignItems: 'center',
    paddingVertical: 24,
    gap: 12,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitials: {
    fontSize: 28,
    fontWeight: '700',
  },
  clientName: {
    fontSize: 24,
    fontWeight: '700',
    color: bcctColors.textPrimary,
    textAlign: 'center',
  },
  colorBar: {
    height: 4,
    borderRadius: 2,
    marginBottom: 16,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 4,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 14,
    gap: 12,
  },
  detailIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: ORANGE + '15',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  detailTextWrap: {
    flex: 1,
    paddingTop: 2,
  },
  detailLabel: {
    fontSize: 12,
    fontWeight: '500',
    color: bcctColors.textSecondary,
    marginBottom: 2,
  },
  detailValue: {
    fontSize: 15,
    fontWeight: '500',
    color: bcctColors.textPrimary,
    lineHeight: 22,
  },
  divider: {
    height: 1,
    backgroundColor: '#F3F4F6',
    marginHorizontal: 14,
  },
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: ORANGE,
    borderRadius: 14,
    paddingVertical: 15,
    marginBottom: 12,
  },
  primaryBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  secondaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#fff',
    borderRadius: 14,
    paddingVertical: 15,
    marginBottom: 12,
    borderWidth: 1.5,
    borderColor: ORANGE,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  secondaryBtnText: {
    color: ORANGE,
    fontSize: 16,
    fontWeight: '600',
  },
  deleteBtn: {
    alignItems: 'center',
    paddingVertical: 14,
  },
  deleteBtnText: {
    color: bcctColors.error,
    fontSize: 15,
    fontWeight: '600',
  },
});
