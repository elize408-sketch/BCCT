import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Image,
  Pressable,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Send, ChevronLeft } from 'lucide-react-native';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { bcctColors } from '@/styles/bcctTheme';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Message {
  id: string;
  conversation_id: string;
  sender_id: string;
  body: string;
  created_at: string;
  read_at: string | null;
}

interface SenderProfile {
  id: string;
  full_name: string;
  avatar_url: string | null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatMessageTime(isoString: string): string {
  return new Date(isoString).toLocaleTimeString('nl-NL', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

function getInitials(name: string): string {
  const parts = name.trim().split(' ');
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
}

// ─── Main screen ──────────────────────────────────────────────────────────────

export default function CoachChatDetailScreen() {
  const { conversationId, otherName } = useLocalSearchParams<{
    conversationId: string;
    otherName?: string;
  }>();
  const { user } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [messages, setMessages] = useState<Message[]>([]);
  const [profiles, setProfiles] = useState<Record<string, SenderProfile>>({});
  const [loading, setLoading] = useState(true);
  const [inputText, setInputText] = useState('');
  const [sending, setSending] = useState(false);

  const flatListRef = useRef<FlatList>(null);

  const headerTitle = otherName ?? 'Chat';

  // Input bar bottom padding = safe area bottom only (no FloatingTabBar)
  const inputBarBottomPadding = insets.bottom + 8;

  // ── Load messages ─────────────────────────────────────────────────────────

  const loadMessages = useCallback(async () => {
    if (!conversationId || !user) return;
    console.log('[CoachChatDetail] Loading messages for conversation:', conversationId);

    const { data, error } = await supabase
      .from('messages')
      .select('*')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('[CoachChatDetail] Error fetching messages:', error);
      setLoading(false);
      return;
    }

    const msgs: Message[] = data ?? [];
    console.log('[CoachChatDetail] Messages loaded:', msgs.length);
    setMessages(msgs);

    // Fetch profiles for unique senders
    const senderIds = [...new Set(msgs.map((m) => m.sender_id))];
    if (senderIds.length > 0) {
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('id, full_name, avatar_url')
        .in('id', senderIds);

      if (profileError) {
        console.error('[CoachChatDetail] Error fetching sender profiles:', profileError);
      } else {
        const profileMap: Record<string, SenderProfile> = {};
        (profileData ?? []).forEach((p) => {
          profileMap[p.id] = p;
        });
        setProfiles(profileMap);
      }
    }

    setLoading(false);

    // Mark messages as read
    const unreadIds = msgs
      .filter((m) => m.sender_id !== user.id && !m.read_at)
      .map((m) => m.id);

    if (unreadIds.length > 0) {
      console.log('[CoachChatDetail] Marking', unreadIds.length, 'messages as read');
      const { error: readError } = await supabase
        .from('messages')
        .update({ read_at: new Date().toISOString() })
        .in('id', unreadIds);

      if (readError) {
        console.error('[CoachChatDetail] Error marking messages as read:', readError);
      }
    }
  }, [conversationId, user]);

  useEffect(() => {
    loadMessages();
  }, [loadMessages]);

  // ── Realtime subscription ─────────────────────────────────────────────────

  useEffect(() => {
    if (!conversationId) return;
    console.log('[CoachChatDetail] Subscribing to realtime for conversation:', conversationId);

    const channel = supabase
      .channel(`coach-messages:${conversationId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          console.log('[CoachChatDetail] Realtime new message received');
          const newMsg = payload.new as Message;
          setMessages((prev) => {
            const exists = prev.some((m) => m.id === newMsg.id);
            if (exists) return prev;
            return [...prev, newMsg];
          });

          // Fetch profile if unknown sender
          setProfiles((prev) => {
            if (!prev[newMsg.sender_id]) {
              supabase
                .from('profiles')
                .select('id, full_name, avatar_url')
                .eq('id', newMsg.sender_id)
                .then(({ data }) => {
                  if (data && data.length > 0) {
                    setProfiles((p) => ({ ...p, [data[0].id]: data[0] }));
                  }
                });
            }
            return prev;
          });

          setTimeout(() => {
            flatListRef.current?.scrollToEnd({ animated: true });
          }, 100);
        }
      )
      .subscribe();

    return () => {
      console.log('[CoachChatDetail] Unsubscribing from realtime');
      supabase.removeChannel(channel);
    };
  }, [conversationId]);

  // ── Send message ──────────────────────────────────────────────────────────

  const handleSend = async () => {
    const body = inputText.trim();
    if (!body || !user || !conversationId || sending) return;

    console.log('[CoachChatDetail] Send button pressed, conversation:', conversationId, 'body length:', body.length);
    setSending(true);
    setInputText('');

    const { data, error } = await supabase
      .from('messages')
      .insert({
        conversation_id: conversationId,
        sender_id: user.id,
        body,
        created_at: new Date().toISOString(),
      })
      .select('*');

    if (error) {
      console.error('[CoachChatDetail] Error sending message:', error);
      setInputText(body);
      setSending(false);
      return;
    }

    console.log('[CoachChatDetail] Message sent successfully');
    if (data && data.length > 0) {
      setMessages((prev) => {
        const exists = prev.some((m) => m.id === data[0].id);
        if (exists) return prev;
        return [...prev, data[0] as Message];
      });
    }

    setSending(false);
    setTimeout(() => {
      flatListRef.current?.scrollToEnd({ animated: true });
    }, 100);
  };

  // ── Render message ────────────────────────────────────────────────────────

  const renderMessage = ({ item, index }: { item: Message; index: number }) => {
    const isOwn = item.sender_id === user?.id;
    const timeLabel = formatMessageTime(item.created_at);
    const senderProfile = profiles[item.sender_id];
    const senderName = senderProfile?.full_name ?? 'Onbekend';
    const initials = getInitials(senderName);

    const prevItem = index > 0 ? messages[index - 1] : null;
    const showSenderName = !isOwn && (!prevItem || prevItem.sender_id !== item.sender_id);

    return (
      <View style={[styles.messageRow, isOwn ? styles.messageRowOwn : styles.messageRowOther]}>
        {!isOwn && (
          <View style={styles.senderAvatarContainer}>
            {showSenderName ? (
              senderProfile?.avatar_url ? (
                <Image source={{ uri: senderProfile.avatar_url }} style={styles.senderAvatar} />
              ) : (
                <View style={styles.senderAvatarFallback}>
                  <Text style={styles.senderAvatarInitials}>{initials}</Text>
                </View>
              )
            ) : (
              <View style={styles.senderAvatarSpacer} />
            )}
          </View>
        )}
        <View style={[styles.bubbleWrapper, isOwn ? styles.bubbleWrapperOwn : styles.bubbleWrapperOther]}>
          {showSenderName && !isOwn ? (
            <Text style={styles.senderName}>{senderName}</Text>
          ) : null}
          <View style={[styles.bubble, isOwn ? styles.bubbleOwn : styles.bubbleOther]}>
            <Text style={[styles.bubbleText, isOwn ? styles.bubbleTextOwn : styles.bubbleTextOther]}>
              {item.body}
            </Text>
          </View>
          <Text style={[styles.timeLabel, isOwn ? styles.timeLabelOwn : styles.timeLabelOther]}>
            {timeLabel}
          </Text>
        </View>
      </View>
    );
  };

  const emptyComponent = (
    <View style={styles.emptyContainer}>
      <Text style={styles.emptyText}>Stuur een eerste bericht</Text>
    </View>
  );

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable
          onPress={() => {
            console.log('[CoachChatDetail] Back button pressed');
            router.back();
          }}
          style={styles.backButton}
          hitSlop={8}
        >
          <ChevronLeft size={28} color={bcctColors.primaryOrange} strokeWidth={2} />
        </Pressable>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {headerTitle}
        </Text>
        <View style={styles.headerRight} />
      </View>

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={0}
      >
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={bcctColors.primaryOrange} />
          </View>
        ) : (
          <FlatList
            ref={flatListRef}
            data={messages}
            keyExtractor={(item) => item.id}
            renderItem={renderMessage}
            ListEmptyComponent={emptyComponent}
            style={styles.flex}
            contentContainerStyle={[
              styles.messageList,
              { paddingBottom: 16 },
              messages.length === 0 && styles.messageListEmpty,
            ]}
            onContentSizeChange={() => {
              if (messages.length > 0) {
                flatListRef.current?.scrollToEnd({ animated: false });
              }
            }}
          />
        )}

        <View style={[styles.inputBar, { paddingBottom: inputBarBottomPadding }]}>
          <TextInput
            style={styles.textInput}
            value={inputText}
            onChangeText={setInputText}
            placeholder="Typ een bericht..."
            placeholderTextColor={bcctColors.textSecondary}
            multiline
            maxLength={2000}
            returnKeyType="default"
          />
          <TouchableOpacity
            style={[styles.sendButton, (!inputText.trim() || sending) && styles.sendButtonDisabled]}
            onPress={handleSend}
            disabled={!inputText.trim() || sending}
            activeOpacity={0.8}
          >
            {sending ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Send size={20} color="#FFFFFF" strokeWidth={2} />
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: bcctColors.lightBackground,
  },
  flex: {
    flex: 1,
    backgroundColor: bcctColors.lightBackground,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Header
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

  // Messages
  messageList: {
    paddingHorizontal: 12,
    paddingTop: 12,
  },
  messageListEmpty: {
    flex: 1,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 15,
    color: bcctColors.textSecondary,
    fontStyle: 'italic',
  },
  messageRow: {
    flexDirection: 'row',
    marginBottom: 4,
    alignItems: 'flex-end',
  },
  messageRowOwn: {
    justifyContent: 'flex-end',
  },
  messageRowOther: {
    justifyContent: 'flex-start',
  },
  senderAvatarContainer: {
    marginRight: 6,
    marginBottom: 18,
  },
  senderAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
  },
  senderAvatarFallback: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: bcctColors.primaryOrange,
    justifyContent: 'center',
    alignItems: 'center',
  },
  senderAvatarInitials: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
  senderAvatarSpacer: {
    width: 28,
    height: 28,
  },
  bubbleWrapper: {
    maxWidth: '75%',
  },
  bubbleWrapperOwn: {
    alignItems: 'flex-end',
  },
  bubbleWrapperOther: {
    alignItems: 'flex-start',
  },
  senderName: {
    fontSize: 12,
    fontWeight: '600',
    color: bcctColors.textSecondary,
    marginBottom: 3,
    marginLeft: 4,
  },
  bubble: {
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  bubbleOwn: {
    backgroundColor: bcctColors.primaryOrange,
    borderBottomRightRadius: 4,
  },
  bubbleOther: {
    backgroundColor: '#FFFFFF',
    borderBottomLeftRadius: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
    elevation: 1,
  },
  bubbleText: {
    fontSize: 15,
    lineHeight: 21,
  },
  bubbleTextOwn: {
    color: '#FFFFFF',
  },
  bubbleTextOther: {
    color: bcctColors.textPrimary,
  },
  timeLabel: {
    fontSize: 11,
    color: bcctColors.textSecondary,
    marginTop: 3,
    marginHorizontal: 4,
  },
  timeLabelOwn: {
    textAlign: 'right',
  },
  timeLabelOther: {
    textAlign: 'left',
  },

  // Input bar
  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 12,
    paddingTop: 10,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: bcctColors.borderGray,
    gap: 8,
  },
  textInput: {
    flex: 1,
    minHeight: 40,
    maxHeight: 120,
    backgroundColor: bcctColors.lightBackground,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'ios' ? 10 : 8,
    paddingBottom: Platform.OS === 'ios' ? 10 : 8,
    fontSize: 15,
    color: bcctColors.textPrimary,
    borderWidth: 1,
    borderColor: bcctColors.borderGray,
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: bcctColors.primaryOrange,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendButtonDisabled: {
    backgroundColor: bcctColors.primaryOrangeDisabled,
  },
});
