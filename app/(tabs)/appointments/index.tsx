import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  FlatList,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { bcctColors, bcctTypography } from '@/styles/bcctTheme';
import { supabase } from '@/lib/supabase';

const ORANGE = '#F97316';
const SCREEN_WIDTH = Dimensions.get('window').width;
const TIME_LABEL_WIDTH = 52;
const HOUR_HEIGHT = 64;
const START_HOUR = 6;
const END_HOUR = 22;

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

const DUTCH_DAYS = ['Zondag', 'Maandag', 'Dinsdag', 'Woensdag', 'Donderdag', 'Vrijdag', 'Zaterdag'];
const DUTCH_MONTHS = [
  'januari', 'februari', 'maart', 'april', 'mei', 'juni',
  'juli', 'augustus', 'september', 'oktober', 'november', 'december',
];

function formatDutchDate(date: Date): string {
  const day = DUTCH_DAYS[date.getDay()];
  const d = date.getDate();
  const month = DUTCH_MONTHS[date.getMonth()];
  return `${day} ${d} ${month}`;
}

function toDateString(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
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

type ViewMode = 'dag' | 'week' | 'lijst';

export default function AppointmentsScreen() {
  const router = useRouter();
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<ViewMode>('dag');
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchAppointments = useCallback(async (date: Date) => {
    const dateStr = toDateString(date);
    const nextDay = new Date(date);
    nextDay.setDate(nextDay.getDate() + 1);
    const nextDayStr = toDateString(nextDay);
    console.log('[Appointments] Fetching appointments for date:', dateStr);
    setLoading(true);
    setError(null);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setAppointments([]); return; }

      const { data, error } = await supabase
        .from('appointments')
        .select('*, client:profiles!appointments_client_id_fkey(id, full_name, avatar_url)')
        .eq('coach_id', user.id)
        .gte('start_time', `${dateStr}T00:00:00`)
        .lt('start_time', `${nextDayStr}T00:00:00`)
        .order('start_time');

      if (error) throw error;

      const mapped = (data ?? []).map((a: any) => ({
        ...a,
        client: a.client
          ? { id: a.client.id, name: a.client.full_name ?? 'Cliënt', avatar_url: a.client.avatar_url }
          : { id: '', name: 'Onbekend', avatar_url: null },
      }));
      console.log('[Appointments] Fetched', mapped.length, 'appointments');
      setAppointments(mapped);
    } catch (err: any) {
      console.error('[Appointments] Fetch error:', err);
      setError('Kon afspraken niet laden');
      setAppointments([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchAppointments(selectedDate);
    }, [selectedDate, fetchAppointments])
  );

  const goToPrevDay = () => {
    console.log('[Appointments] Navigate to previous day');
    const d = new Date(selectedDate);
    d.setDate(d.getDate() - 1);
    setSelectedDate(d);
  };

  const goToNextDay = () => {
    console.log('[Appointments] Navigate to next day');
    const d = new Date(selectedDate);
    d.setDate(d.getDate() + 1);
    setSelectedDate(d);
  };

  const goToToday = () => {
    console.log('[Appointments] Navigate to today');
    setSelectedDate(new Date());
  };

  const handleNewAppointment = () => {
    console.log('[Appointments] FAB pressed — navigate to appointment-form (create)');
    router.push('/(app)/appointment-form');
  };

  const handleAppointmentPress = (id: string) => {
    console.log('[Appointments] Appointment card pressed, id:', id);
    router.push({ pathname: '/(app)/appointment-detail', params: { appointmentId: id } });
  };

  const handleViewModeChange = (mode: ViewMode) => {
    console.log('[Appointments] View mode changed to:', mode);
    setViewMode(mode);
  };

  const dateLabel = formatDutchDate(selectedDate);
  const isToday = toDateString(selectedDate) === toDateString(new Date());

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Afspraken</Text>
        <TouchableOpacity style={styles.headerAddBtn} onPress={handleNewAppointment}>
          <Ionicons name="add" size={26} color={ORANGE} />
        </TouchableOpacity>
      </View>

      {/* Date Navigator */}
      <View style={styles.dateNav}>
        <TouchableOpacity style={styles.dateNavArrow} onPress={goToPrevDay}>
          <Ionicons name="chevron-back" size={22} color={bcctColors.textPrimary} />
        </TouchableOpacity>
        <View style={styles.dateNavCenter}>
          <Text style={styles.dateNavLabel}>{dateLabel}</Text>
          {!isToday && (
            <TouchableOpacity style={styles.todayBtn} onPress={goToToday}>
              <Text style={styles.todayBtnText}>Vandaag</Text>
            </TouchableOpacity>
          )}
        </View>
        <TouchableOpacity style={styles.dateNavArrow} onPress={goToNextDay}>
          <Ionicons name="chevron-forward" size={22} color={bcctColors.textPrimary} />
        </TouchableOpacity>
      </View>

      {/* View Toggle */}
      <View style={styles.segmentedControl}>
        {(['dag', 'week', 'lijst'] as ViewMode[]).map((mode) => {
          const label = mode === 'dag' ? 'Dag' : mode === 'week' ? 'Week' : 'Lijst';
          const isActive = viewMode === mode;
          return (
            <TouchableOpacity
              key={mode}
              style={[styles.segmentBtn, isActive && styles.segmentBtnActive]}
              onPress={() => handleViewModeChange(mode)}
            >
              <Text style={[styles.segmentBtnText, isActive && styles.segmentBtnTextActive]}>
                {label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Content */}
      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={ORANGE} />
        </View>
      ) : error ? (
        <View style={styles.centered}>
          <Ionicons name="alert-circle-outline" size={40} color={bcctColors.textSecondary} />
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={() => fetchAppointments(selectedDate)}>
            <Text style={styles.retryBtnText}>Opnieuw proberen</Text>
          </TouchableOpacity>
        </View>
      ) : viewMode === 'dag' ? (
        <DayView
          appointments={appointments}
          onAppointmentPress={handleAppointmentPress}
          onNewAppointment={handleNewAppointment}
        />
      ) : viewMode === 'lijst' ? (
        <ListView
          appointments={appointments}
          onAppointmentPress={handleAppointmentPress}
          onNewAppointment={handleNewAppointment}
        />
      ) : (
        <WeekView
          selectedDate={selectedDate}
          appointments={appointments}
          onAppointmentPress={handleAppointmentPress}
        />
      )}

      {/* FAB */}
      <TouchableOpacity style={styles.fab} onPress={handleNewAppointment} activeOpacity={0.85}>
        <Ionicons name="add" size={30} color="#fff" />
      </TouchableOpacity>
    </SafeAreaView>
  );
}

// ─── Day View ────────────────────────────────────────────────────────────────

interface DayViewProps {
  appointments: Appointment[];
  onAppointmentPress: (id: string) => void;
  onNewAppointment: () => void;
}

function DayView({ appointments, onAppointmentPress, onNewAppointment }: DayViewProps) {
  const hours = Array.from({ length: END_HOUR - START_HOUR }, (_, i) => START_HOUR + i);
  const timelineWidth = SCREEN_WIDTH - TIME_LABEL_WIDTH - 32;

  if (appointments.length === 0) {
    return <EmptyState onNewAppointment={onNewAppointment} />;
  }

  return (
    <ScrollView
      style={styles.timelineScroll}
      contentContainerStyle={styles.timelineContent}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.timelineContainer}>
        {/* Hour rows */}
        {hours.map((hour) => {
          const label = `${String(hour).padStart(2, '0')}:00`;
          return (
            <View key={hour} style={styles.hourRow}>
              <Text style={styles.hourLabel}>{label}</Text>
              <View style={styles.hourLine} />
            </View>
          );
        })}

        {/* Appointment cards overlaid */}
        <View style={[styles.appointmentsOverlay, { left: TIME_LABEL_WIDTH, width: timelineWidth }]}>
          {appointments.map((appt) => {
            const start = new Date(appt.start_time);
            const end = new Date(appt.end_time);
            const startHour = start.getHours() + start.getMinutes() / 60;
            const endHour = end.getHours() + end.getMinutes() / 60;
            const top = (startHour - START_HOUR) * HOUR_HEIGHT;
            const height = Math.max((endHour - startHour) * HOUR_HEIGHT, 32);
            const color = appt.color || ORANGE;
            const startLabel = formatTime(appt.start_time);
            const endLabel = formatTime(appt.end_time);
            const timeRange = `${startLabel} – ${endLabel}`;

            return (
              <TouchableOpacity
                key={appt.id}
                style={[styles.apptCard, { top, height, borderLeftColor: color }]}
                onPress={() => onAppointmentPress(appt.id)}
                activeOpacity={0.8}
              >
                <Text style={styles.apptClientName} numberOfLines={1}>
                  {appt.client?.name ?? 'Onbekend'}
                </Text>
                <Text style={styles.apptTimeRange}>{timeRange}</Text>
                {appt.title ? (
                  <Text style={styles.apptTitle} numberOfLines={1}>
                    {appt.title}
                  </Text>
                ) : null}
              </TouchableOpacity>
            );
          })}
        </View>
      </View>
      <View style={{ height: 120 }} />
    </ScrollView>
  );
}

// ─── List View ───────────────────────────────────────────────────────────────

interface ListViewProps {
  appointments: Appointment[];
  onAppointmentPress: (id: string) => void;
  onNewAppointment: () => void;
}

function ListView({ appointments, onAppointmentPress, onNewAppointment }: ListViewProps) {
  if (appointments.length === 0) {
    return <EmptyState onNewAppointment={onNewAppointment} />;
  }

  return (
    <FlatList
      data={appointments}
      keyExtractor={(item) => item.id}
      contentContainerStyle={styles.listContent}
      showsVerticalScrollIndicator={false}
      renderItem={({ item }) => {
        const color = item.color || ORANGE;
        const startLabel = formatTime(item.start_time);
        const endLabel = formatTime(item.end_time);
        const timeRange = `${startLabel} – ${endLabel}`;
        return (
          <TouchableOpacity
            style={styles.listRow}
            onPress={() => onAppointmentPress(item.id)}
            activeOpacity={0.75}
          >
            <View style={[styles.listDot, { backgroundColor: color }]} />
            <View style={styles.listRowContent}>
              <Text style={styles.listClientName}>{item.client?.name ?? 'Onbekend'}</Text>
              <Text style={styles.listTime}>{timeRange}</Text>
              {item.title ? <Text style={styles.listTitle}>{item.title}</Text> : null}
            </View>
            <Ionicons name="chevron-forward" size={18} color={bcctColors.textSecondary} />
          </TouchableOpacity>
        );
      }}
      ListFooterComponent={<View style={{ height: 120 }} />}
    />
  );
}

// ─── Week View ───────────────────────────────────────────────────────────────

interface WeekViewProps {
  selectedDate: Date;
  appointments: Appointment[];
  onAppointmentPress: (id: string) => void;
}

function WeekView({ selectedDate, appointments, onAppointmentPress }: WeekViewProps) {
  const startOfWeek = new Date(selectedDate);
  const dayOfWeek = startOfWeek.getDay();
  const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  startOfWeek.setDate(startOfWeek.getDate() + mondayOffset);

  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(startOfWeek);
    d.setDate(d.getDate() + i);
    return d;
  });

  const dayLabels = ['Ma', 'Di', 'Wo', 'Do', 'Vr', 'Za', 'Zo'];
  const todayStr = toDateString(new Date());
  const selectedStr = toDateString(selectedDate);

  return (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.weekContent}>
      <View style={styles.weekStrip}>
        {weekDays.map((day, idx) => {
          const dayStr = toDateString(day);
          const isToday = dayStr === todayStr;
          const isSelected = dayStr === selectedStr;
          const hasAppts = appointments.some(
            (a) => toDateString(new Date(a.start_time)) === dayStr
          );
          return (
            <View key={dayStr} style={styles.weekDayCol}>
              <Text style={styles.weekDayLabel}>{dayLabels[idx]}</Text>
              <View style={[styles.weekDayCircle, isSelected && styles.weekDayCircleSelected, isToday && styles.weekDayCircleToday]}>
                <Text style={[styles.weekDayNum, isSelected && styles.weekDayNumSelected]}>
                  {day.getDate()}
                </Text>
              </View>
              {hasAppts ? <View style={[styles.weekDot, { backgroundColor: isSelected ? '#fff' : ORANGE }]} /> : <View style={styles.weekDotPlaceholder} />}
            </View>
          );
        })}
      </View>

      {appointments.length === 0 ? (
        <View style={styles.weekEmptyState}>
          <Text style={styles.weekEmptyText}>Geen afspraken deze week</Text>
        </View>
      ) : (
        appointments.map((appt) => {
          const color = appt.color || ORANGE;
          const startLabel = formatTime(appt.start_time);
          const endLabel = formatTime(appt.end_time);
          const timeRange = `${startLabel} – ${endLabel}`;
          return (
            <TouchableOpacity
              key={appt.id}
              style={styles.listRow}
              onPress={() => onAppointmentPress(appt.id)}
              activeOpacity={0.75}
            >
              <View style={[styles.listDot, { backgroundColor: color }]} />
              <View style={styles.listRowContent}>
                <Text style={styles.listClientName}>{appt.client?.name ?? 'Onbekend'}</Text>
                <Text style={styles.listTime}>{timeRange}</Text>
                {appt.title ? <Text style={styles.listTitle}>{appt.title}</Text> : null}
              </View>
              <Ionicons name="chevron-forward" size={18} color={bcctColors.textSecondary} />
            </TouchableOpacity>
          );
        })
      )}
      <View style={{ height: 120 }} />
    </ScrollView>
  );
}

// ─── Empty State ─────────────────────────────────────────────────────────────

function EmptyState({ onNewAppointment }: { onNewAppointment: () => void }) {
  return (
    <View style={styles.emptyState}>
      <View style={styles.emptyIconWrap}>
        <Ionicons name="calendar-outline" size={48} color={ORANGE} />
      </View>
      <Text style={styles.emptyTitle}>Geen afspraken vandaag</Text>
      <Text style={styles.emptySubtitle}>Plan je eerste sessie met een cliënt</Text>
      <TouchableOpacity style={styles.emptyBtn} onPress={onNewAppointment}>
        <Text style={styles.emptyBtnText}>Nieuwe afspraak</Text>
      </TouchableOpacity>
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: bcctColors.lightBackground,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 12,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: bcctColors.textPrimary,
  },
  headerAddBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FFF7ED',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dateNav: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingBottom: 12,
  },
  dateNavArrow: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  dateNavCenter: {
    flex: 1,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 10,
  },
  dateNavLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: bcctColors.textPrimary,
  },
  todayBtn: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: ORANGE + '20',
  },
  todayBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: ORANGE,
  },
  segmentedControl: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginBottom: 12,
    backgroundColor: '#E5E7EB',
    borderRadius: 10,
    padding: 3,
  },
  segmentBtn: {
    flex: 1,
    paddingVertical: 7,
    borderRadius: 8,
    alignItems: 'center',
  },
  segmentBtnActive: {
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  segmentBtnText: {
    fontSize: 14,
    fontWeight: '500',
    color: bcctColors.textSecondary,
  },
  segmentBtnTextActive: {
    color: bcctColors.textPrimary,
    fontWeight: '600',
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
  // Timeline
  timelineScroll: {
    flex: 1,
  },
  timelineContent: {
    paddingHorizontal: 16,
  },
  timelineContainer: {
    position: 'relative',
  },
  hourRow: {
    height: HOUR_HEIGHT,
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingTop: 0,
  },
  hourLabel: {
    width: TIME_LABEL_WIDTH,
    fontSize: 12,
    color: bcctColors.textSecondary,
    fontWeight: '500',
    paddingTop: 2,
  },
  hourLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#E5E7EB',
    marginTop: 8,
  },
  appointmentsOverlay: {
    position: 'absolute',
    top: 0,
    bottom: 0,
  },
  apptCard: {
    position: 'absolute',
    left: 4,
    right: 0,
    borderRadius: 8,
    backgroundColor: '#fff',
    borderLeftWidth: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
    overflow: 'hidden',
  },
  apptClientName: {
    fontSize: 13,
    fontWeight: '700',
    color: bcctColors.textPrimary,
  },
  apptTimeRange: {
    fontSize: 11,
    color: bcctColors.textSecondary,
    marginTop: 1,
  },
  apptTitle: {
    fontSize: 11,
    color: bcctColors.textSecondary,
    marginTop: 2,
  },
  // List
  listContent: {
    paddingHorizontal: 16,
    paddingTop: 4,
  },
  listRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
    gap: 12,
  },
  listDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    flexShrink: 0,
  },
  listRowContent: {
    flex: 1,
  },
  listClientName: {
    fontSize: 15,
    fontWeight: '700',
    color: bcctColors.textPrimary,
  },
  listTime: {
    fontSize: 13,
    color: bcctColors.textSecondary,
    marginTop: 2,
  },
  listTitle: {
    fontSize: 13,
    color: bcctColors.textSecondary,
    marginTop: 2,
  },
  // Week
  weekContent: {
    paddingHorizontal: 16,
    paddingTop: 4,
  },
  weekStrip: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  weekDayCol: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
  },
  weekDayLabel: {
    fontSize: 11,
    fontWeight: '500',
    color: bcctColors.textSecondary,
  },
  weekDayCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  weekDayCircleSelected: {
    backgroundColor: ORANGE,
  },
  weekDayCircleToday: {
    borderWidth: 2,
    borderColor: ORANGE,
  },
  weekDayNum: {
    fontSize: 14,
    fontWeight: '600',
    color: bcctColors.textPrimary,
  },
  weekDayNumSelected: {
    color: '#fff',
  },
  weekDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  weekDotPlaceholder: {
    width: 6,
    height: 6,
  },
  weekEmptyState: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  weekEmptyText: {
    fontSize: 15,
    color: bcctColors.textSecondary,
  },
  // Empty state
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    paddingBottom: 80,
    gap: 12,
  },
  emptyIconWrap: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: ORANGE + '18',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: bcctColors.textPrimary,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 15,
    color: bcctColors.textSecondary,
    textAlign: 'center',
  },
  emptyBtn: {
    marginTop: 8,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: ORANGE,
  },
  emptyBtnText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 15,
  },
  // FAB
  fab: {
    position: 'absolute',
    bottom: 100,
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: ORANGE,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
});
