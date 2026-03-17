import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  StyleSheet,
  Image,
  ImageSourcePropType,
} from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { ArrowLeft, Send } from 'lucide-react-native';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { bcctColors } from '@/styles/bcctTheme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

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

function resolveImageSource(
  source: string | number | ImageSourcePropType | undefined
): ImageSourcePropType {
  if (!source) return { uri: '' };
  if (typeof source === 'string') return { uri: source };
  return source as ImageSourcePropType;
}

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

export default function ClientChatDetailScreen() {
  const { id, otherName } = useLocalSearchParams<{ id: string; otherName?: string }>();
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

  // ── Load messages ────────────────────────────────────────────────────────────

  const loadMessages = useCallback(async () => {
    if (!id || !user) return;
    console.log('[ClientChatDetail] Loading messages for conversation:', id);

    const { data, error } = await supabase
      .from('messages')
      .select('id, sender_id, body, created_at, read_at, conversation_id')
      .eq('conversation_id', id)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('[ClientChatDetail] Error fetching messages:', error);
      setLoading(false);
      return;
    }

    const msgs: Message[] = data ?? [];
    console.log('[ClientChatDetail] Messages loaded:', msgs.length);
    setMessages(msgs);

    // Fetch profiles for unique senders
    const senderIds = [...new Set(msgs.map((m) => m.sender_id))];
    if (senderIds.length > 0) {
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('id, full_name, avatar_url')
        .in('id', senderIds);

      if (profileError) {
        console.error('[ClientChatDetail] Error fetching sender profiles:', profileError);
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
    console.log('[ClientChatDetail] Marking unread messages as read');
    const { error: readError } = await supabase
      .from('messages')
      .update({ read_at: new Date().toISOString() })
      .eq('conversation_id', id)
      .neq('sender_id', user.id)
      .is('read_at', null);

    if (readError) {
      console.error('[ClientChatDetail] Error marking messages as read:', readError);
    }
  }, [id, user]);

  useEffect(() => {
    loadMessages();
  }, [loadMessages]);

  // ── Realtime subscription ────────────────────────────────────────────────────

  useEffect(() => {
    if (!id) return;
    console.log('[ClientChatDetail] Subscribing to realtime for conversation:', id);

    const channel = supabase
      .channel(`client-chat-detail:${id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${id}`,
        },
        (payload) => {
          console.log('[ClientChatDetail] Realtime new message received');
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
      console.log('[ClientChatDetail] Unsubscribing from realtime');
      supabase.removeChannel(channel);
    };
  }, [id]);

  // ── Send message ─────────────────────────────────────────────────────────────

  const handleSend = async () => {
    const body = inputText.trim();
    if (!body || !user || !id || sending) return;

    console.log('[ClientChatDetail] Send button pressed — conversation:', id, 'body length:', body.length);
    setSending(true);
    setInputText('');

    const { data, error } = await supabase
      .from('messages')
      .insert({
        conversation_id: id,
        sender_id: user.id,
        body,
        created_at: new Date().toISOString(),
      })
      .select('id, sender_id, body, created_at, read_at, conversation_id');

    if (error) {
      console.error('[ClientChatDetail] Error sending message:', error);
      setInputText(body);
      setSending(false);
      return;
    }

    console.log('[ClientChatDetail] Message sent successfully');
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

  // ── Render message ────────────────────────────────────────────────────────────

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
                <Image
                  source={resolveImageSource(senderProfile.avatar_url)}
                  style={styles.senderAvatar}
                />
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

  // ── Layout values ─────────────────────────────────────────────────────────────

  // FloatingTabBar: 8 paddingTop + 40 icon + 14 label + safeBottom ≈ 70px
  // We add that as bottom padding on the input bar so it sits above the tab bar.
  const TAB_BAR_HEIGHT = 70;
  const inputBarBottomPadding = TAB_BAR_HEIGHT + insets.bottom;
  // keyboardVerticalOffset = header height only (tab bar is handled by padding)
  const keyboardOffset = Platform.OS === 'ios' ? 90 : 0;

  // ── Empty state ───────────────────────────────────────────────────────────────

  const emptyComponent = (
    <View style={styles.emptyContainer}>
      <Text style={styles.emptyText}>
        Stuur een eerste bericht om het gesprek te starten
      </Text>
    </View>
  );

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <>
      <Stack.Screen
        options={{
          headerShown: true,
          title: headerTitle,
          headerLeft: () => (
            <TouchableOpacity
              onPress={() => {
                console.log('[ClientChatDetail] Back button pressed');
                router.back();
              }}
              style={styles.backButton}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <ArrowLeft size={22} color={bcctColors.primaryOrange} />
            </TouchableOpacity>
          ),
          headerStyle: { backgroundColor: '#FFFFFF' },
          headerTitleStyle: { fontWeight: '600', color: bcctColors.textPrimary },
          headerShadowVisible: true,
        }}
      />
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={keyboardOffset}
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
            contentContainerStyle={[
              styles.messageList,
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
    </>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  flex: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  backButton: {
    paddingLeft: 4,
  },
  messageList: {
    paddingHorizontal: 12,
    paddingTop: 12,
    paddingBottom: 16,
  },
  messageListEmpty: {
    flex: 1,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  emptyText: {
    fontSize: 15,
    color: '#999999',
    fontStyle: 'italic',
    textAlign: 'center',
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
    color: '#888888',
    marginBottom: 3,
    marginLeft: 4,
  },
  bubble: {
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  bubbleOwn: {
    backgroundColor: bcctColors.primaryOrange,
    borderBottomRightRadius: 4,
  },
  bubbleOther: {
    backgroundColor: '#F0F0F0',
    borderBottomLeftRadius: 4,
  },
  bubbleText: {
    fontSize: 15,
    lineHeight: 21,
  },
  bubbleTextOwn: {
    color: '#FFFFFF',
  },
  bubbleTextOther: {
    color: '#1A1A1A',
  },
  timeLabel: {
    fontSize: 11,
    color: '#999999',
    marginTop: 3,
    marginHorizontal: 4,
  },
  timeLabelOwn: {
    textAlign: 'right',
  },
  timeLabelOther: {
    textAlign: 'left',
  },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 12,
    paddingTop: 10,
    backgroundColor: '#FFFFFF',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#E0E0E0',
    gap: 8,
  },
  textInput: {
    flex: 1,
    minHeight: 40,
    maxHeight: 120,
    backgroundColor: '#F5F5F5',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'ios' ? 10 : 8,
    paddingBottom: Platform.OS === 'ios' ? 10 : 8,
    fontSize: 15,
    color: '#1A1A1A',
    borderWidth: 1,
    borderColor: '#E0E0E0',
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
