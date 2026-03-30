import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Image,
  ImageSourcePropType,
  Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ChevronLeft, UserRound } from 'lucide-react-native';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { bcctColors } from '@/styles/bcctTheme';

// ─── Types ────────────────────────────────────────────────────────────────────

interface ClientRow {
  id: string;
  full_name: string;
  avatar_url: string | null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function resolveImageSource(
  source: string | number | ImageSourcePropType | undefined
): ImageSourcePropType {
  if (!source) return { uri: '' };
  if (typeof source === 'string') return { uri: source };
  return source as ImageSourcePropType;
}

function getInitials(name: string): string {
  const parts = name.trim().split(' ');
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
}

// ─── Avatar ───────────────────────────────────────────────────────────────────

function Avatar({ name, avatarUrl, size }: { name: string; avatarUrl: string | null; size: number }) {
  const initials = getInitials(name);
  const borderRadius = size / 2;

  if (avatarUrl) {
    return (
      <Image
        source={resolveImageSource(avatarUrl)}
        style={{ width: size, height: size, borderRadius }}
      />
    );
  }

  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius,
        backgroundColor: bcctColors.primaryOrange,
        justifyContent: 'center',
        alignItems: 'center',
      }}
    >
      <Text style={{ color: '#FFFFFF', fontSize: size * 0.36, fontWeight: '700' }}>
        {initials}
      </Text>
    </View>
  );
}

// ─── Main screen ──────────────────────────────────────────────────────────────

export default function NewChatScreen() {
  const { user } = useAuth();
  const router = useRouter();

  const [clients, setClients] = useState<ClientRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selecting, setSelecting] = useState<string | null>(null);

  // ── Load clients linked to this coach ─────────────────────────────────────

  const loadClients = useCallback(async () => {
    if (!user) return;
    console.log('[NewChat] Loading clients for coach:', user.id);
    setLoading(true);
    setError(null);

    try {
      const { data: coachClients, error: ccError } = await supabase
        .from('coach_clients')
        .select('client_id')
        .eq('coach_id', user.id);

      if (ccError) {
        console.error('[NewChat] Error fetching coach_clients:', ccError);
        setError('Kon cliënten niet laden.');
        setLoading(false);
        return;
      }

      const clientIds = (coachClients ?? []).map((r) => r.client_id);
      console.log('[NewChat] Client IDs found:', clientIds.length);

      if (clientIds.length === 0) {
        setClients([]);
        setLoading(false);
        return;
      }

      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('id, full_name, avatar_url')
        .in('id', clientIds);

      if (profilesError) {
        console.error('[NewChat] Error fetching profiles:', profilesError);
        setError('Kon cliëntgegevens niet laden.');
        setLoading(false);
        return;
      }

      const rows: ClientRow[] = (profiles ?? []).map((p) => ({
        id: p.id,
        full_name: p.full_name ?? 'Cliënt',
        avatar_url: p.avatar_url ?? null,
      }));

      rows.sort((a, b) => a.full_name.localeCompare(b.full_name, 'nl'));
      console.log('[NewChat] Clients loaded:', rows.length);
      setClients(rows);
    } catch (err) {
      console.error('[NewChat] Unexpected error loading clients:', err);
      setError('Er is een fout opgetreden.');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    loadClients();
  }, [loadClients]);

  // ── Select client → find or create conversation ───────────────────────────

  const handleSelectClient = async (client: ClientRow) => {
    if (!user || selecting) return;
    console.log('[NewChat] Client selected:', client.id, client.full_name);
    setSelecting(client.id);

    try {
      // STEP 1 — Check if conversation already exists
      console.log('[NewChat] Checking for existing conversation between coach:', user.id, 'and client:', client.id);
      const { data: existing, error: existingError } = await supabase
        .from('conversations')
        .select('id')
        .eq('coach_id', user.id)
        .eq('client_id', client.id)
        .limit(1);

      if (existingError) {
        console.error('[NewChat] Error checking existing conversation:', existingError);
        setSelecting(null);
        return;
      }

      let conversationId: string;

      if (existing && existing.length > 0) {
        // STEP 2 — Conversation exists → reuse it
        conversationId = existing[0].id;
        console.log('[NewChat] Existing conversation found:', conversationId);
      } else {
        // STEP 3 — No conversation → create one
        console.log('[NewChat] No existing conversation — creating new one');

        // Fetch org_id from coach profile
        const { data: coachProfile, error: profileError } = await supabase
          .from('profiles')
          .select('org_id')
          .eq('id', user.id)
          .single();

        if (profileError) {
          console.warn('[NewChat] Could not fetch coach org_id:', profileError);
        }

        const orgId = coachProfile?.org_id ?? null;

        const { data: inserted, error: insertError } = await supabase
          .from('conversations')
          .insert({
            coach_id: user.id,
            client_id: client.id,
            org_id: orgId,
          })
          .select('id')
          .single();

        if (insertError || !inserted) {
          console.error('[NewChat] Error creating conversation:', insertError);
          setSelecting(null);
          return;
        }

        conversationId = inserted.id;
        console.log('[NewChat] New conversation created:', conversationId);
      }

      // STEP 4 — Navigate to chat detail
      console.log('[NewChat] Navigating to chat-detail, conversationId:', conversationId, 'otherName:', client.full_name);
      router.replace(
        ('/(app)/coach/chat-detail?conversationId=' +
          conversationId +
          '&otherName=' +
          encodeURIComponent(client.full_name)) as any
      );
    } catch (err) {
      console.error('[NewChat] Unexpected error selecting client:', err);
      setSelecting(null);
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────

  const renderClient = ({ item }: { item: ClientRow }) => {
    const isSelecting = selecting === item.id;

    return (
      <TouchableOpacity
        style={styles.row}
        onPress={() => handleSelectClient(item)}
        activeOpacity={0.7}
        disabled={!!selecting}
      >
        <View style={styles.avatarContainer}>
          <Avatar name={item.full_name} avatarUrl={item.avatar_url} size={48} />
        </View>
        <Text style={styles.clientName} numberOfLines={1}>
          {item.full_name}
        </Text>
        {isSelecting ? (
          <ActivityIndicator size="small" color={bcctColors.primaryOrange} />
        ) : null}
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable
          onPress={() => {
            console.log('[NewChat] Back button pressed');
            router.back();
          }}
          style={styles.backButton}
          hitSlop={8}
        >
          <ChevronLeft size={28} color={bcctColors.primaryOrange} strokeWidth={2} />
        </Pressable>
        <Text style={styles.headerTitle}>Nieuwe chat</Text>
        <View style={styles.headerRight} />
      </View>

      {/* Subtitle */}
      <View style={styles.subtitleContainer}>
        <Text style={styles.subtitle}>Kies een cliënt</Text>
      </View>

      {/* Content */}
      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={bcctColors.primaryOrange} />
        </View>
      ) : error ? (
        <View style={styles.centered}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : (
        <FlatList
          data={clients}
          keyExtractor={(item) => item.id}
          renderItem={renderClient}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          contentContainerStyle={[
            clients.length === 0 ? styles.emptyList : undefined,
            { paddingBottom: 40 },
          ]}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <UserRound size={52} color={bcctColors.borderGray} strokeWidth={1.5} />
              <Text style={styles.emptyTitle}>Geen cliënten</Text>
              <Text style={styles.emptySubtitle}>
                Je hebt nog geen cliënten gekoppeld aan je account.
              </Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: bcctColors.lightBackground,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: bcctColors.borderGray,
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    flex: 1,
    fontSize: 17,
    fontWeight: '700',
    color: bcctColors.textPrimary,
    textAlign: 'center',
    marginHorizontal: 8,
  },
  headerRight: {
    width: 40,
  },
  subtitleContainer: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 8,
  },
  subtitle: {
    fontSize: 13,
    fontWeight: '600',
    color: bcctColors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorText: {
    fontSize: 15,
    color: bcctColors.error,
    textAlign: 'center',
    paddingHorizontal: 32,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  avatarContainer: {
    marginRight: 14,
  },
  clientName: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    color: bcctColors.textPrimary,
  },
  separator: {
    height: 1,
    backgroundColor: bcctColors.borderGray,
    marginLeft: 78,
  },
  emptyList: {
    flex: 1,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
    paddingTop: 80,
    gap: 12,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: bcctColors.textPrimary,
  },
  emptySubtitle: {
    fontSize: 15,
    color: bcctColors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
  },
});
