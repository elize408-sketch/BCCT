import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  Platform,
  TouchableOpacity,
} from 'react-native';
import { Stack, useRouter, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import DateTimePicker from '@react-native-community/datetimepicker';
import * as DocumentPicker from 'expo-document-picker';
import { useTheme } from '@react-navigation/native';
import { bcctColors, bcctTypography } from '@/styles/bcctTheme';
import { AnimatedPressable } from '@/components/AnimatedPressable';
import { useAuth } from '@/contexts/AuthContext';
import { createAssignment, uploadAssignmentFile } from '@/utils/homeworkApi';

interface LocalFile {
  uri: string;
  name: string;
  type: string;
  size: number;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(date: Date): string {
  const day = String(date.getDate()).padStart(2, '0');
  const months = ['jan', 'feb', 'mrt', 'apr', 'mei', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dec'];
  const month = months[date.getMonth()];
  const year = date.getFullYear();
  return `${day} ${month} ${year}`;
}

export default function HomeworkComposeScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const { session } = useAuth();
  const params = useLocalSearchParams<{ clientId: string; clientName: string }>();
  const clientId = params.clientId ?? '';
  const clientName = params.clientName ?? 'Cliënt';

  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [deadline, setDeadline] = useState<Date | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [files, setFiles] = useState<LocalFile[]>([]);

  const [subjectError, setSubjectError] = useState('');
  const [messageError, setMessageError] = useState('');
  const [sendError, setSendError] = useState('');
  const [sending, setSending] = useState(false);
  const [successVisible, setSuccessVisible] = useState(false);

  const deadlineDisplay = deadline ? formatDate(deadline) : 'Geen deadline';

  const handleCancel = useCallback(() => {
    console.log('[HomeworkCompose] Annuleren pressed');
    router.back();
  }, [router]);

  const handleSubjectBlur = useCallback(() => {
    if (!subject.trim()) {
      setSubjectError('Onderwerp is verplicht');
    } else {
      setSubjectError('');
    }
  }, [subject]);

  const handleMessageBlur = useCallback(() => {
    if (!message.trim()) {
      setMessageError('Bericht is verplicht');
    } else {
      setMessageError('');
    }
  }, [message]);

  const handlePickFile = useCallback(async () => {
    console.log('[HomeworkCompose] Bijlage toevoegen pressed');
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: '*/*',
        copyToCacheDirectory: true,
        multiple: false,
      });
      if (result.canceled) {
        console.log('[HomeworkCompose] Document picker cancelled');
        return;
      }
      const asset = result.assets[0];
      console.log('[HomeworkCompose] File picked:', asset.name, 'size:', asset.size);
      setFiles(prev => [
        ...prev,
        {
          uri: asset.uri,
          name: asset.name,
          type: asset.mimeType ?? 'application/octet-stream',
          size: asset.size ?? 0,
        },
      ]);
    } catch (err) {
      console.error('[HomeworkCompose] Document picker error:', err);
    }
  }, []);

  const handleRemoveFile = useCallback((index: number) => {
    console.log('[HomeworkCompose] Remove file at index:', index);
    setFiles(prev => prev.filter((_, i) => i !== index));
  }, []);

  const handleDateChange = useCallback((_: unknown, selectedDate?: Date) => {
    if (Platform.OS === 'android') {
      setShowDatePicker(false);
    }
    if (selectedDate) {
      console.log('[HomeworkCompose] Deadline selected:', selectedDate.toISOString());
      setDeadline(selectedDate);
    }
  }, []);

  const handleSend = useCallback(async () => {
    console.log('[HomeworkCompose] Versturen pressed — subject:', subject, 'files:', files.length);

    let hasError = false;
    if (!subject.trim()) {
      setSubjectError('Onderwerp is verplicht');
      hasError = true;
    }
    if (!message.trim()) {
      setMessageError('Bericht is verplicht');
      hasError = true;
    }
    if (hasError) return;

    const token = session?.access_token;
    if (!token) {
      setSendError('Niet ingelogd. Probeer opnieuw.');
      return;
    }

    setSending(true);
    setSendError('');

    try {
      const deadlineIso = deadline ? deadline.toISOString().split('T')[0] : null;
      console.log('[HomeworkCompose] Creating assignment for client:', clientId);
      const assignment = await createAssignment(token, {
        client_id: clientId,
        subject: subject.trim(),
        message: message.trim(),
        deadline: deadlineIso,
      });

      console.log('[HomeworkCompose] Assignment created:', assignment.id, '— uploading', files.length, 'files');
      for (const file of files) {
        await uploadAssignmentFile(token, assignment.id, file);
      }

      console.log('[HomeworkCompose] All done — showing success');
      setSuccessVisible(true);
      setTimeout(() => {
        router.back();
      }, 800);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Er is een fout opgetreden';
      console.error('[HomeworkCompose] Send error:', msg);
      setSendError(msg);
      setSending(false);
    }
  }, [subject, message, deadline, files, session, clientId, router]);

  const isSendDisabled = sending || successVisible;

  return (
    <>
      <Stack.Screen
        options={{
          title: 'Huiswerk sturen',
          presentation: 'modal',
          headerLeft: () => (
            <TouchableOpacity onPress={handleCancel} style={styles.headerBtn}>
              <Text style={[styles.headerBtnText, { color: bcctColors.primaryOrange }]}>
                Annuleren
              </Text>
            </TouchableOpacity>
          ),
          headerRight: () => (
            <TouchableOpacity
              onPress={handleSend}
              disabled={isSendDisabled}
              style={styles.headerBtn}
            >
              <Text
                style={[
                  styles.headerBtnText,
                  { color: isSendDisabled ? bcctColors.primaryOrangeDisabled : bcctColors.primaryOrange },
                  styles.headerBtnBold,
                ]}
              >
                {sending ? 'Bezig...' : 'Versturen'}
              </Text>
            </TouchableOpacity>
          ),
        }}
      />

      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['bottom']}>
        {successVisible && (
          <View style={styles.successBanner}>
            <Text style={styles.successText}>Huiswerk verstuurd ✓</Text>
          </View>
        )}

        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Text style={[styles.recipientLabel, { color: bcctColors.textSecondary }]}>
            Aan: <Text style={{ color: colors.text }}>{clientName}</Text>
          </Text>

          {/* Onderwerp */}
          <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.fieldLabel, { color: bcctColors.textSecondary }]}>Onderwerp *</Text>
            <TextInput
              style={[styles.textInput, { color: colors.text }]}
              placeholder="bijv. Ademhalingsoefening"
              placeholderTextColor={bcctColors.textSecondary}
              value={subject}
              onChangeText={text => {
                setSubject(text);
                if (text.trim()) setSubjectError('');
              }}
              onBlur={handleSubjectBlur}
              returnKeyType="next"
              editable={!isSendDisabled}
            />
            {subjectError ? (
              <Text style={styles.errorText}>{subjectError}</Text>
            ) : null}
          </View>

          {/* Bericht */}
          <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.fieldLabel, { color: bcctColors.textSecondary }]}>Bericht *</Text>
            <TextInput
              style={[styles.textInput, styles.textArea, { color: colors.text }]}
              placeholder="Schrijf hier de instructies voor je cliënt..."
              placeholderTextColor={bcctColors.textSecondary}
              value={message}
              onChangeText={text => {
                setMessage(text);
                if (text.trim()) setMessageError('');
              }}
              onBlur={handleMessageBlur}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
              editable={!isSendDisabled}
            />
            {messageError ? (
              <Text style={styles.errorText}>{messageError}</Text>
            ) : null}
          </View>

          {/* Deadline */}
          <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.fieldLabel, { color: bcctColors.textSecondary }]}>Deadline (optioneel)</Text>
            <View style={styles.deadlineRow}>
              <AnimatedPressable
                style={styles.deadlineTrigger}
                onPress={() => {
                  console.log('[HomeworkCompose] Deadline picker opened');
                  setShowDatePicker(true);
                }}
              >
                <Text style={[styles.deadlineText, { color: deadline ? colors.text : bcctColors.textSecondary }]}>
                  {deadlineDisplay}
                </Text>
              </AnimatedPressable>
              {deadline ? (
                <AnimatedPressable
                  onPress={() => {
                    console.log('[HomeworkCompose] Deadline cleared');
                    setDeadline(null);
                  }}
                  style={styles.clearBtn}
                >
                  <Text style={[styles.clearBtnText, { color: bcctColors.textSecondary }]}>✕</Text>
                </AnimatedPressable>
              ) : null}
            </View>

            {showDatePicker && (
              <DateTimePicker
                value={deadline ?? new Date()}
                mode="date"
                display={Platform.OS === 'ios' ? 'inline' : 'default'}
                minimumDate={new Date()}
                onChange={handleDateChange}
                locale="nl-NL"
              />
            )}
            {Platform.OS === 'ios' && showDatePicker && (
              <AnimatedPressable
                style={[styles.dateConfirmBtn, { backgroundColor: bcctColors.primaryOrange }]}
                onPress={() => {
                  console.log('[HomeworkCompose] Date picker confirmed');
                  setShowDatePicker(false);
                }}
              >
                <Text style={styles.dateConfirmText}>Bevestigen</Text>
              </AnimatedPressable>
            )}
          </View>

          {/* Bijlagen */}
          <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.fieldLabel, { color: bcctColors.textSecondary }]}>Bijlagen (optioneel)</Text>

            {files.map((file, index) => {
              const sizeDisplay = formatFileSize(file.size);
              return (
                <View key={index} style={[styles.fileChip, { borderColor: colors.border, backgroundColor: bcctColors.lightBackground }]}>
                  <Text style={styles.fileIcon}>📎</Text>
                  <View style={styles.fileInfo}>
                    <Text style={[styles.fileName, { color: colors.text }]} numberOfLines={1}>
                      {file.name}
                    </Text>
                    <Text style={[styles.fileSize, { color: bcctColors.textSecondary }]}>
                      {sizeDisplay}
                    </Text>
                  </View>
                  <AnimatedPressable
                    onPress={() => handleRemoveFile(index)}
                    style={styles.fileRemoveBtn}
                  >
                    <Text style={[styles.fileRemoveText, { color: bcctColors.textSecondary }]}>✕</Text>
                  </AnimatedPressable>
                </View>
              );
            })}

            <AnimatedPressable
              style={[styles.addFileBtn, { borderColor: bcctColors.primaryOrange }]}
              onPress={handlePickFile}
              disabled={isSendDisabled}
            >
              <Text style={styles.addFileIcon}>📎</Text>
              <Text style={[styles.addFileBtnText, { color: bcctColors.primaryOrange }]}>
                Bijlage toevoegen
              </Text>
            </AnimatedPressable>
          </View>

          {sendError ? (
            <View style={styles.sendErrorContainer}>
              <Text style={styles.errorText}>{sendError}</Text>
            </View>
          ) : null}

          <View style={{ height: 40 }} />
        </ScrollView>
      </SafeAreaView>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingTop: 12,
  },
  headerBtn: {
    paddingHorizontal: 4,
    paddingVertical: 8,
  },
  headerBtnText: {
    fontSize: 16,
    lineHeight: 22,
  },
  headerBtnBold: {
    fontWeight: '600',
  },
  successBanner: {
    backgroundColor: bcctColors.success,
    paddingVertical: 12,
    paddingHorizontal: 20,
    alignItems: 'center',
  },
  successText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  recipientLabel: {
    ...bcctTypography.small,
    marginBottom: 16,
  },
  card: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  fieldLabel: {
    ...bcctTypography.label,
    marginBottom: 10,
  },
  textInput: {
    ...bcctTypography.body,
    paddingVertical: 0,
  },
  textArea: {
    minHeight: 96,
    paddingTop: 2,
  },
  errorText: {
    color: bcctColors.error,
    fontSize: 13,
    lineHeight: 18,
    marginTop: 6,
  },
  deadlineRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  deadlineTrigger: {
    flex: 1,
    paddingVertical: 4,
  },
  deadlineText: {
    ...bcctTypography.body,
  },
  clearBtn: {
    padding: 8,
  },
  clearBtnText: {
    fontSize: 16,
  },
  dateConfirmBtn: {
    marginTop: 12,
    borderRadius: 12,
    paddingVertical: 10,
    alignItems: 'center',
  },
  dateConfirmText: {
    color: '#fff',
    ...bcctTypography.button,
  },
  fileChip: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 10,
    gap: 10,
  },
  fileIcon: {
    fontSize: 18,
  },
  fileInfo: {
    flex: 1,
    gap: 2,
  },
  fileName: {
    ...bcctTypography.smallMedium,
  },
  fileSize: {
    fontSize: 12,
    lineHeight: 16,
  },
  fileRemoveBtn: {
    padding: 4,
  },
  fileRemoveText: {
    fontSize: 15,
  },
  addFileBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    paddingVertical: 12,
    gap: 8,
    marginTop: 4,
  },
  addFileIcon: {
    fontSize: 16,
  },
  addFileBtnText: {
    ...bcctTypography.bodyMedium,
  },
  sendErrorContainer: {
    marginTop: 4,
    marginBottom: 8,
  },
});
