import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Image,
  ImageSourcePropType,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useRouter } from 'expo-router';
import { MessageCircle } from 'lucide-react-native';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { bcctColors } from '@/styles/bcctTheme';

// ─── Types ────────────────────────────────────────────────────────────────────

interface ConversationRow {
  conversationId: string;
  otherId: string;
  otherName: string;
  otherAvatar: string | null;
  lastMessage: string | null;
  lastMessageAt: string | null;
}

interface LinkedCoach {
  coachId: string;
  name: string;
  avatarUrl: string | null;
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

function formatConversationTime(isoString: string | null): string {
  if (!isoString) return '';
  const date = new Date(isoString);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today.getTime() - 86400000);
  const msgDay = new Date(date.getFullYear(), date.getMonth(), date.getDate());

  if (msgDay.getTime() === today.getTime()) {
    return date.toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' });
  }
  if (msgDay.getTime() === yesterday.getTime()) {
    return 'Gisteren';
  }
  return date.toLocaleDateString('nl-NL', { day: '2-digit', month: '2-digit' });
}

// ─── Avatar component ─────────────────────────────────────────────────────────

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

export default function ChatListScreen() {
  const { user } = useAuth();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [role, setRole] = useState<'coach' | 'client' | null>(null);

  // Client state
  const [linkedCoaches, setLinkedCoaches] = useState<LinkedCoach[]>([]);
  const [conversations, setConversations] = useState<ConversationRow[]>([]);

  // Per-coach loading state for "Start gesprek" buttons
  const [startingConvFor, setStartingConvFor] = useState<string | null>(null);

  // ── Data loading ────────────────────────────────────────────────────────────

  const loadData = useCallback(async () => {
    if (!user) return;
    console.log('[ChatList] Loading data for user:', user.id);
    setLoading(true);
    setError(null);

    try {
      // 1. Fetch role
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id);

      if (profileError) {
        console.error('[ChatList] Error fetching profile:', profileError);
        setError('Kon profiel niet laden.');
        setLoading(false);
        return;
      }

      const userRole: 'coach' | 'client' =
        profileData && profileData.length > 0 ? profileData[0].role : 'client';
      setRole(userRole);
      console.log('[ChatList] User role:', userRole);

      if (userRole === 'client') {
        await loadClientData(user.id);
      } else {
        await loadCoachData(user.id);
      }
    } catch (err) {
      console.error('[ChatList] Unexpected error:', err);
      setError('Er is een fout opgetreden.');
    } finally {
      setLoading(false);
    }
  }, [user]);

  const loadClientData = async (userId: string) => {
    // Fetch linked coaches + existing conversations in parallel
    const [coachLinksResult, convsResult] = await Promise.all([
      supabase
        .from('coach_clients')
        .select('coach_id')
        .eq('client_id', userId)
        .eq('status', 'active'),
      supabase
        .from('conversations')
        .select('id, coach_id')
        .eq('client_id', userId),
    ]);

    if (coachLinksResult.error) {
      console.error('[ChatList] Error fetching coach links:', coachLinksResult.error);
    }
    if (convsResult.error) {
      console.error('[ChatList] Error fetching conversations:', convsResult.error);
    }

    const coachLinks = coachLinksResult.data ?? [];
    const existingConvs = convsResult.data ?? [];
    console.log('[ChatList] Coach links:', coachLinks.length, 'Conversations:', existingConvs.length);

    // Fetch coach profiles
    const coachIds = coachLinks.map((l) => l.coach_id);
    let coachProfiles: { id: string; full_name: string | null; avatar_url: string | null }[] = [];

    if (coachIds.length > 0) {
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('id, full_name, avatar_url')
        .in('id', coachIds);

      if (profilesError) {
        console.error('[ChatList] Error fetching coach profiles:', profilesError);
      }
      coachProfiles = profiles ?? [];
    }

    setLinkedCoaches(
      coachProfiles.map((p) => ({
        coachId: p.id,
        name: p.full_name ?? 'Coach',
        avatarUrl: p.avatar_url ?? null,
      }))
    );

    // If no conversations, stop here — empty state will show linked coaches
    if (existingConvs.length === 0) {
      setConversations([]);
      return;
    }

    // Fetch last message for each conversation
    const convIds = existingConvs.map((c) => c.id);
    const lastMsgResults = await Promise.all(
      convIds.map((cid) =>
        supabase
          .from('messages')
          .select('body, created_at')
          .eq('conversation_id', cid)
          .order('created_at', { ascending: false })
          .limit(1)
          .then(({ data }) => ({ cid, data }))
      )
    );

    const lastMessages: Record<string, { body: string; created_at: string }> = {};
    lastMsgResults.forEach(({ cid, data }) => {
      if (data && data.length > 0) lastMessages[cid] = data[0];
    });
    console.log('[ChatList] Last messages fetched for', Object.keys(lastMessages).length, 'conversations');

    const built: ConversationRow[] = existingConvs.map((conv) => {
      const coach = coachProfiles.find((p) => p.id === conv.coach_id);
      const lastMsg = lastMessages[conv.id];
      return {
        conversationId: conv.id,
        otherId: conv.coach_id,
        otherName: coach?.full_name ?? 'Coach',
        otherAvatar: coach?.avatar_url ?? null,
        lastMessage: lastMsg?.body ?? null,
        lastMessageAt: lastMsg?.created_at ?? null,
      };
    });

    built.sort((a, b) => {
      if (!a.lastMessageAt) return 1;
      if (!b.lastMessageAt) return -1;
      return new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime();
    });

    setConversations(built);
  };

  const loadCoachData = async (userId: string) => {
    const { data: convs, error: convsError } = await supabase
      .from('conversations')
      .select('id, client_id')
      .eq('coach_id', userId);

    if (convsError) {
      console.error('[ChatList] Error fetching coach conversations:', convsError);
      setConversations([]);
      return;
    }

    const convList = convs ?? [];
    console.log('[ChatList] Conversations found for coach:', convList.length);

    if (convList.length === 0) {
      setConversations([]);
      return;
    }

    const clientIds = convList.map((c) => c.client_id);

    const [profilesResult, ...lastMsgResults] = await Promise.all([
      supabase.from('profiles').select('id, full_name, avatar_url').in('id', clientIds),
      ...convList.map((conv) =>
        supabase
          .from('messages')
          .select('body, created_at')
          .eq('conversation_id', conv.id)
          .order('created_at', { ascending: false })
          .limit(1)
          .then(({ data }) => ({ cid: conv.id, data }))
      ),
    ]);

    if (profilesResult.error) {
      console.error('[ChatList] Error fetching client profiles:', profilesResult.error);
    }

    const clientProfiles = profilesResult.data ?? [];
    const lastMessages: Record<string, { body: string; created_at: string }> = {};
    lastMsgResults.forEach((r) => {
      const result = r as { cid: string; data: { body: string; created_at: string }[] | null };
      if (result.data && result.data.length > 0) {
        lastMessages[result.cid] = result.data[0];
      }
    });

    const built: ConversationRow[] = convList.map((conv) => {
      const client = clientProfiles.find((p) => p.id === conv.client_id);
      const lastMsg = lastMessages[conv.id];
      return {
        conversationId: conv.id,
        otherId: conv.client_id,
        otherName: client?.full_name ?? 'Cliënt',
        otherAvatar: client?.avatar_url ?? null,
        lastMessage: lastMsg?.body ?? null,
        lastMessageAt: lastMsg?.created_at ?? null,
      };
    });

    built.sort((a, b) => {
      if (!a.lastMessageAt) return 1;
      if (!b.lastMessageAt) return -1;
      return new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime();
    });

    setConversations(built);
  };

  useEffect(() => {
    loadData();
  }, [loadData]);

  // ── Handlers ─────────────────────────────────────────────────────────────────

  const handleConversationPress = (row: ConversationRow) => {
    console.log('[ChatList] Opening conversation:', row.conversationId, 'with:', row.otherName);
    router.push({
      pathname: '/(tabs)/(chat)/[id]',
      params: { id: row.conversationId, otherName: row.otherName },
    });
  };

  const handleStartConversation = async (coach: LinkedCoach) => {
    if (!user) return;
    console.log('[ChatList] Start gesprek pressed for coach:', coach.coachId, coach.name);
    setStartingConvFor(coach.coachId);

    try {
      // Check if conversation already exists
      const { data: existing, error: checkError } = await supabase
        .from('conversations')
        .select('id')
        .eq('coach_id', coach.coachId)
        .eq('client_id', user.id);

      if (checkError) {
        console.error('[ChatList] Error checking existing conversation:', checkError);
        setStartingConvFor(null);
        return;
      }

      if (existing && existing.length > 0) {
        console.log('[ChatList] Existing conversation found:', existing[0].id);
        router.push({
          pathname: '/(tabs)/(chat)/[id]',
          params: { id: existing[0].id, otherName: coach.name },
        });
        setStartingConvFor(null);
        return;
      }

      // Create new conversation
      console.log('[ChatList] Creating new conversation with coach:', coach.coachId);
      const { data: newConv, error: insertError } = await supabase
        .from('conversations')
        .insert({ coach_id: coach.coachId, client_id: user.id })
        .select('id');

      if (insertError) {
        console.error('[ChatList] Error creating conversation:', insertError);
        setStartingConvFor(null);
        return;
      }

      const newId = newConv && newConv.length > 0 ? newConv[0].id : null;
      if (!newId) {
        console.error('[ChatList] No id returned from conversation insert');
        setStartingConvFor(null);
        return;
      }

      console.log('[ChatList] Conversation created:', newId);
      router.push({
        pathname: '/(tabs)/(chat)/[id]',
        params: { id: newId, otherName: coach.name },
      });
    } catch (err) {
      console.error('[ChatList] Unexpected error starting conversation:', err);
    } finally {
      setStartingConvFor(null);
    }
  };

  // ── Render helpers ────────────────────────────────────────────────────────────

  const renderConversationItem = ({ item }: { item: ConversationRow }) => {
    const timeLabel = formatConversationTime(item.lastMessageAt);
    const previewText = item.lastMessage ?? 'Nog geen berichten';
    const isNoMessages = !item.lastMessage;

    return (
      <TouchableOpacity
        style={styles.row}
        onPress={() => handleConversationPress(item)}
        activeOpacity={0.7}
      >
        <View style={styles.avatarContainer}>
          <Avatar name={item.otherName} avatarUrl={item.otherAvatar} size={50} />
        </View>
        <View style={styles.rowContent}>
          <View style={styles.rowTop}>
            <Text style={styles.rowName} numberOfLines={1}>
              {item.otherName}
            </Text>
            {timeLabel ? <Text style={styles.rowTime}>{timeLabel}</Text> : null}
          </View>
          <Text
            style={[styles.rowPreview, isNoMessages && styles.rowPreviewEmpty]}
            numberOfLines={1}
          >
            {previewText}
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

  const renderCoachCard = (coach: LinkedCoach) => {
    const isStarting = startingConvFor === coach.coachId;
    const coachLabel = 'Coach';

    return (
      <View key={coach.coachId} style={styles.coachCard}>
        <View style={styles.coachCardLeft}>
          <Avatar name={coach.name} avatarUrl={coach.avatarUrl} size={48} />
          <View style={styles.coachCardInfo}>
            <Text style={styles.coachCardName} numberOfLines={1}>
              {coach.name}
            </Text>
            <Text style={styles.coachCardRole}>{coachLabel}</Text>
          </View>
        </View>
        <TouchableOpacity
          style={[styles.startButton, isStarting && styles.startButtonDisabled]}
          onPress={() => handleStartConversation(coach)}
          disabled={isStarting}
          activeOpacity={0.8}
        >
          {isStarting ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <Text style={styles.startButtonText}>Start gesprek</Text>
          )}
        </TouchableOpacity>
      </View>
    );
  };

  // ── Screens ───────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={bcctColors.primaryOrange} />
        </View>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={styles.loadingContainer}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      </SafeAreaView>
    );
  }

  // Client with no conversations yet → show linked coaches empty state
  const showClientEmptyState = role === 'client' && conversations.length === 0;

  if (showClientEmptyState) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <Stack.Screen options={{ headerShown: false }} />
        <ScrollView
          contentInsetAdjustmentBehavior="automatic"
          contentContainerStyle={styles.emptyScrollContent}
        >
          <View style={styles.emptyHeader}>
            <Text style={styles.emptyTitle}>Start een gesprek</Text>
            <Text style={styles.emptySubtitle}>
              Je kunt hier direct contact opnemen met je coach.
            </Text>
          </View>

          {linkedCoaches.length > 0 ? (
            <View style={styles.coachCardList}>
              {linkedCoaches.map(renderCoachCard)}
            </View>
          ) : (
            <View style={styles.noCoachContainer}>
              <MessageCircle size={48} color={bcctColors.borderGray} strokeWidth={1.5} />
              <Text style={styles.noCoachText}>
                Je hebt nog geen gekoppelde coach. Neem contact op met je organisatie.
              </Text>
            </View>
          )}
        </ScrollView>
      </SafeAreaView>
    );
  }

  // Conversation list (client with conversations, or coach)
  const listHeader = (
    <View style={styles.listHeader}>
      <Text style={styles.screenTitle}>Chat</Text>
    </View>
  );

  const emptyComponent = (
    <View style={styles.listEmptyContainer}>
      <MessageCircle size={52} color={bcctColors.borderGray} strokeWidth={1.5} />
      <Text style={styles.listEmptyTitle}>Geen gesprekken gevonden</Text>
      <Text style={styles.listEmptySubtitle}>
        {role === 'coach'
          ? 'Je hebt nog geen actieve gesprekken met cliënten.'
          : 'Je hebt nog geen gesprekken.'}
      </Text>
    </View>
  );

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <Stack.Screen options={{ headerShown: false }} />
      <FlatList
        data={conversations}
        keyExtractor={(item) => item.conversationId}
        renderItem={renderConversationItem}
        ListHeaderComponent={listHeader}
        ListEmptyComponent={emptyComponent}
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={conversations.length === 0 ? styles.emptyList : undefined}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
      />
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: bcctColors.lightBackground,
  },
  loadingContainer: {
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

  // ── Conversation list ──────────────────────────────────────────────────────
  listHeader: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 12,
    backgroundColor: bcctColors.lightBackground,
  },
  screenTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: bcctColors.textPrimary,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  avatarContainer: {
    marginRight: 12,
  },
  rowContent: {
    flex: 1,
  },
  rowTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 3,
  },
  rowName: {
    fontSize: 16,
    fontWeight: '600',
    color: bcctColors.textPrimary,
    flex: 1,
    marginRight: 8,
  },
  rowTime: {
    fontSize: 12,
    color: bcctColors.textSecondary,
  },
  rowPreview: {
    fontSize: 14,
    color: bcctColors.textSecondary,
  },
  rowPreviewEmpty: {
    fontStyle: 'italic',
    color: bcctColors.primaryOrangeLight,
  },
  separator: {
    height: 1,
    backgroundColor: bcctColors.borderGray,
    marginLeft: 78,
  },
  emptyList: {
    flex: 1,
  },
  listEmptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
    paddingBottom: 80,
    gap: 12,
  },
  listEmptyTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: bcctColors.textPrimary,
  },
  listEmptySubtitle: {
    fontSize: 15,
    color: bcctColors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
  },

  // ── Client empty state ─────────────────────────────────────────────────────
  emptyScrollContent: {
    paddingBottom: 40,
  },
  emptyHeader: {
    paddingHorizontal: 20,
    paddingTop: 28,
    paddingBottom: 24,
  },
  emptyTitle: {
    fontSize: 26,
    fontWeight: '700',
    color: bcctColors.textPrimary,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 15,
    color: bcctColors.textSecondary,
    lineHeight: 22,
  },
  coachCardList: {
    paddingHorizontal: 16,
    gap: 12,
  },
  coachCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 6,
    elevation: 2,
  },
  coachCardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 12,
  },
  coachCardInfo: {
    marginLeft: 12,
    flex: 1,
  },
  coachCardName: {
    fontSize: 16,
    fontWeight: '600',
    color: bcctColors.textPrimary,
    marginBottom: 2,
  },
  coachCardRole: {
    fontSize: 13,
    color: bcctColors.textSecondary,
  },
  startButton: {
    backgroundColor: bcctColors.primaryOrange,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 9,
    minWidth: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  startButtonDisabled: {
    backgroundColor: bcctColors.primaryOrangeDisabled,
  },
  startButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
  },
  noCoachContainer: {
    alignItems: 'center',
    paddingHorizontal: 32,
    paddingTop: 48,
    gap: 16,
  },
  noCoachText: {
    fontSize: 15,
    color: bcctColors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
  },
});
