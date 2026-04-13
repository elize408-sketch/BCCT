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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { MessageCircle, Plus } from 'lucide-react-native';
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

export default function CoachChatListScreen() {
  const { user } = useAuth();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [conversations, setConversations] = useState<ConversationRow[]>([]);

  // ── Data loading ─────────────────────────────────────────────────────────────

  const loadData = useCallback(async () => {
    if (!user) return;
    console.log('[CoachChat] Loading conversations for coach:', user.id);
    setLoading(true);
    setError(null);

    try {
      const { data: convs, error: convsError } = await supabase
        .from('conversations')
        .select('id, client_id')
        .eq('coach_id', user.id);

      if (convsError) {
        console.error('[CoachChat] Error fetching conversations:', convsError);
        setError('Kon gesprekken niet laden.');
        setLoading(false);
        return;
      }

      const convList = convs ?? [];
      console.log('[CoachChat] Conversations found:', convList.length);

      if (convList.length === 0) {
        setConversations([]);
        setLoading(false);
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
        console.error('[CoachChat] Error fetching client profiles:', profilesResult.error);
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
    } catch (err) {
      console.error('[CoachChat] Unexpected error:', err);
      setError('Er is een fout opgetreden.');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // ── Realtime subscription ─────────────────────────────────────────────────

  useEffect(() => {
    if (!user?.id) return;

    console.log('[Chat] Creating realtime channel for user:', user.id);
    console.log('[Chat] Attaching postgres_changes listeners');

    const channelName = `coach-conversations:${user.id}`;

    console.log('[Chat] Calling subscribe()');
    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'messages' },
        () => {
          console.log('[Chat] Realtime message change — reloading conversations');
          loadData();
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'conversations' },
        () => {
          console.log('[Chat] Realtime conversation change — reloading conversations');
          loadData();
        }
      )
      .subscribe((status) => {
        console.log('[Chat] Channel status:', status);
      });

    return () => {
      console.log('[Chat] Cleanup: removing channel');
      supabase.removeChannel(channel);
    };
  }, [user?.id, loadData]);

  // ── Handlers ─────────────────────────────────────────────────────────────────

  const handleConversationPress = (row: ConversationRow) => {
    console.log('[CoachChat] Opening conversation:', row.conversationId, 'with:', row.otherName);
    router.push(
      ('/(app)/coach/chat-detail?conversationId=' + row.conversationId + '&otherName=' + encodeURIComponent(row.otherName)) as any
    );
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

  // ── Screens ───────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={bcctColors.primaryOrange} />
        </View>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <View style={styles.loadingContainer}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      </SafeAreaView>
    );
  }

  const handleNewChat = () => {
    console.log('[CoachChat] "+" button pressed — opening new chat picker');
    router.push('/(app)/coach/new-chat' as any);
  };

  const listHeader = (
    <View style={styles.listHeader}>
      <Text style={styles.screenTitle}>Chat</Text>
      <TouchableOpacity
        style={styles.newChatButton}
        onPress={handleNewChat}
        activeOpacity={0.7}
        hitSlop={8}
      >
        <Plus size={22} color={bcctColors.primaryOrange} strokeWidth={2.5} />
      </TouchableOpacity>
    </View>
  );

  const emptyComponent = (
    <View style={styles.listEmptyContainer}>
      <MessageCircle size={52} color={bcctColors.borderGray} strokeWidth={1.5} />
      <Text style={styles.listEmptyTitle}>Geen gesprekken</Text>
      <Text style={styles.listEmptySubtitle}>
        Je hebt nog geen actieve gesprekken met cliënten.
      </Text>
    </View>
  );

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <FlatList
        data={conversations}
        keyExtractor={(item) => item.conversationId}
        renderItem={renderConversationItem}
        ListHeaderComponent={listHeader}
        ListEmptyComponent={emptyComponent}
        contentContainerStyle={[
          conversations.length === 0 ? styles.emptyList : undefined,
          { paddingBottom: 100 },
        ]}
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 12,
    backgroundColor: bcctColors.lightBackground,
  },
  screenTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: bcctColors.textPrimary,
  },
  newChatButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: bcctColors.primaryOrange + '18',
    justifyContent: 'center',
    alignItems: 'center',
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
});
