import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useRouter } from 'expo-router';
import { MessageCircle } from 'lucide-react-native';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { bcctColors } from '@/styles/bcctTheme';

interface ConversationRow {
  conversationId: string | null;
  otherId: string;
  otherName: string;
  otherAvatar: string | null;
  lastMessage: string | null;
  lastMessageAt: string | null;
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
  return date.toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' });
}

export default function ChatListScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const [rows, setRows] = useState<ConversationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [role, setRole] = useState<'coach' | 'client' | null>(null);

  const loadData = useCallback(async () => {
    if (!user) return;
    console.log('[ChatList] Loading conversations for user:', user.id);
    setLoading(true);

    try {
      // 1. Fetch role
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id);

      if (profileError) {
        console.error('[ChatList] Error fetching profile:', profileError);
        setLoading(false);
        return;
      }

      const userRole: 'coach' | 'client' = profileData && profileData.length > 0
        ? profileData[0].role
        : 'client';
      setRole(userRole);
      console.log('[ChatList] User role:', userRole);

      if (userRole === 'client') {
        // 2a. Get linked coaches
        const { data: coachLinks, error: coachLinksError } = await supabase
          .from('coach_clients')
          .select('coach_id')
          .eq('client_id', user.id)
          .eq('status', 'active');

        if (coachLinksError) {
          console.error('[ChatList] Error fetching coach links:', coachLinksError);
          setLoading(false);
          return;
        }

        console.log('[ChatList] Coach links found:', coachLinks?.length ?? 0);

        if (!coachLinks || coachLinks.length === 0) {
          setRows([]);
          setLoading(false);
          return;
        }

        const coachIds = coachLinks.map((l) => l.coach_id);

        // 3a. Fetch coach profiles + existing conversations in parallel
        const [profilesResult, convsResult] = await Promise.all([
          supabase.from('profiles').select('id, full_name, avatar_url').in('id', coachIds),
          supabase
            .from('conversations')
            .select('id, coach_id')
            .eq('client_id', user.id)
            .in('coach_id', coachIds),
        ]);

        if (profilesResult.error) {
          console.error('[ChatList] Error fetching coach profiles:', profilesResult.error);
        }
        if (convsResult.error) {
          console.error('[ChatList] Error fetching conversations:', convsResult.error);
        }

        const coachProfiles = profilesResult.data ?? [];
        const existingConvs = convsResult.data ?? [];

        // 4a. For each conversation that exists, fetch last message
        const convIds = existingConvs.map((c) => c.id);
        let lastMessages: Record<string, { body: string; created_at: string }> = {};

        if (convIds.length > 0) {
          const lastMsgPromises = convIds.map((cid) =>
            supabase
              .from('messages')
              .select('body, created_at')
              .eq('conversation_id', cid)
              .order('created_at', { ascending: false })
              .limit(1)
              .then(({ data }) => ({ cid, data }))
          );
          const results = await Promise.all(lastMsgPromises);
          results.forEach(({ cid, data }) => {
            if (data && data.length > 0) {
              lastMessages[cid] = data[0];
            }
          });
          console.log('[ChatList] Last messages fetched for', Object.keys(lastMessages).length, 'conversations');
        }

        const built: ConversationRow[] = coachProfiles.map((coach) => {
          const conv = existingConvs.find((c) => c.coach_id === coach.id);
          const lastMsg = conv ? lastMessages[conv.id] : null;
          return {
            conversationId: conv ? conv.id : null,
            otherId: coach.id,
            otherName: coach.full_name ?? 'Coach',
            otherAvatar: coach.avatar_url ?? null,
            lastMessage: lastMsg ? lastMsg.body : null,
            lastMessageAt: lastMsg ? lastMsg.created_at : null,
          };
        });

        setRows(built);
      } else {
        // 2b. Coach: fetch all conversations
        const { data: convs, error: convsError } = await supabase
          .from('conversations')
          .select('id, client_id')
          .eq('coach_id', user.id);

        if (convsError) {
          console.error('[ChatList] Error fetching coach conversations:', convsError);
          setLoading(false);
          return;
        }

        console.log('[ChatList] Conversations found for coach:', convs?.length ?? 0);

        if (!convs || convs.length === 0) {
          setRows([]);
          setLoading(false);
          return;
        }

        const clientIds = convs.map((c) => c.client_id);

        // 3b. Fetch client profiles + last messages in parallel
        const [profilesResult, ...lastMsgResults] = await Promise.all([
          supabase.from('profiles').select('id, full_name, avatar_url').in('id', clientIds),
          ...convs.map((conv) =>
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

        const built: ConversationRow[] = convs.map((conv) => {
          const client = clientProfiles.find((p) => p.id === conv.client_id);
          const lastMsg = lastMessages[conv.id];
          return {
            conversationId: conv.id,
            otherId: conv.client_id,
            otherName: client?.full_name ?? 'Cliënt',
            otherAvatar: client?.avatar_url ?? null,
            lastMessage: lastMsg ? lastMsg.body : null,
            lastMessageAt: lastMsg ? lastMsg.created_at : null,
          };
        });

        // Sort by most recent message
        built.sort((a, b) => {
          if (!a.lastMessageAt) return 1;
          if (!b.lastMessageAt) return -1;
          return new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime();
        });

        setRows(built);
      }
    } catch (err) {
      console.error('[ChatList] Unexpected error:', err);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleRowPress = async (row: ConversationRow) => {
    console.log('[ChatList] Row pressed:', row.otherName, 'conversationId:', row.conversationId);

    if (row.conversationId) {
      router.push({
        pathname: '/chat/[id]',
        params: { id: row.conversationId, otherName: row.otherName },
      });
      return;
    }

    // Client with no conversation yet — create one
    if (!user) return;
    console.log('[ChatList] Creating new conversation with coach:', row.otherId);

    try {
      const { data: newConv, error } = await supabase
        .from('conversations')
        .insert({ coach_id: row.otherId, client_id: user.id, org_id: null })
        .select('id');

      if (error) {
        console.error('[ChatList] Error creating conversation:', error);
        return;
      }

      const newId = newConv && newConv.length > 0 ? newConv[0].id : null;
      if (!newId) {
        console.error('[ChatList] No id returned from conversation insert');
        return;
      }

      console.log('[ChatList] Conversation created:', newId);
      router.push({
        pathname: '/chat/[id]',
        params: { id: newId, otherName: row.otherName },
      });
    } catch (err) {
      console.error('[ChatList] Unexpected error creating conversation:', err);
    }
  };

  const renderItem = ({ item }: { item: ConversationRow }) => {
    const initials = getInitials(item.otherName);
    const timeLabel = formatConversationTime(item.lastMessageAt);
    const hasConversation = item.conversationId !== null;
    const previewText = item.lastMessage ?? (hasConversation ? 'Geen berichten' : 'Start gesprek');
    const isPlaceholder = !item.lastMessage;

    return (
      <TouchableOpacity
        style={styles.row}
        onPress={() => handleRowPress(item)}
        activeOpacity={0.7}
      >
        <View style={styles.avatarContainer}>
          {item.otherAvatar ? (
            <Image source={{ uri: item.otherAvatar }} style={styles.avatar} />
          ) : (
            <View style={styles.avatarFallback}>
              <Text style={styles.avatarInitials}>{initials}</Text>
            </View>
          )}
        </View>
        <View style={styles.rowContent}>
          <View style={styles.rowTop}>
            <Text style={styles.rowName} numberOfLines={1}>{item.otherName}</Text>
            {timeLabel ? (
              <Text style={styles.rowTime}>{timeLabel}</Text>
            ) : null}
          </View>
          <Text
            style={[styles.rowPreview, isPlaceholder && styles.rowPreviewPlaceholder]}
            numberOfLines={1}
          >
            {previewText}
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

  const listHeader = (
    <View style={styles.listHeader}>
      <Text style={styles.screenTitle}>Chat</Text>
    </View>
  );

  const emptyComponent = (
    <View style={styles.emptyContainer}>
      <MessageCircle size={52} color={bcctColors.borderGray} strokeWidth={1.5} />
      <Text style={styles.emptyTitle}>Geen gesprekken</Text>
      <Text style={styles.emptySubtitle}>
        {role === 'coach'
          ? 'Je hebt nog geen actieve gesprekken met cliënten.'
          : 'Je bent nog niet gekoppeld aan een coach.'}
      </Text>
    </View>
  );

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <Stack.Screen options={{ headerShown: false }} />
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={bcctColors.primaryOrange} />
        </View>
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(item) => item.otherId}
          renderItem={renderItem}
          ListHeaderComponent={listHeader}
          ListEmptyComponent={emptyComponent}
          contentInsetAdjustmentBehavior="automatic"
          contentContainerStyle={rows.length === 0 ? styles.emptyList : undefined}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
        />
      )}
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
    justifyContent: 'center',
    alignItems: 'center',
  },
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
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
  },
  avatarFallback: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: bcctColors.primaryOrange,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarInitials: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
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
  rowPreviewPlaceholder: {
    color: bcctColors.primaryOrange,
    fontStyle: 'italic',
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
    paddingBottom: 80,
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
