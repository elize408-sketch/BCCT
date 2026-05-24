import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { bcctColors } from '@/styles/bcctTheme';
import { SCORE_FIELDS, LifeWheelScores } from '@/components/LifeWheelView';

interface Props {
  initialScores?: Partial<LifeWheelScores>;
  initialNotes?: string;
  saving: boolean;
  onCancel: () => void;
  onSave: (scores: LifeWheelScores, notes: string) => void;
  cancelLabel?: string;
  saveLabel?: string;
}

const SCORE_OPTIONS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

export default function LifeWheelForm({
  initialScores = {},
  initialNotes = '',
  saving,
  onCancel,
  onSave,
  cancelLabel = 'Annuleren',
  saveLabel = 'Opslaan',
}: Props) {
  const [scores, setScores] = useState<Partial<LifeWheelScores>>(initialScores);
  const [notes, setNotes] = useState(initialNotes);
  const [validationError, setValidationError] = useState('');

  const handleScoreSelect = (key: keyof LifeWheelScores, value: number) => {
    console.log('[LifeWheelForm] Score selected:', key, value);
    setScores((prev) => ({ ...prev, [key]: value }));
    setValidationError('');
  };

  const handleSavePress = () => {
    console.log('[LifeWheelForm] Save pressed, scores:', scores);
    const allFilled = SCORE_FIELDS.every((f) => {
      const v = scores[f.key];
      return typeof v === 'number' && v >= 1 && v <= 10;
    });
    if (!allFilled) {
      setValidationError('Vul alle velden in');
      console.warn('[LifeWheelForm] Validation failed — not all scores filled');
      return;
    }
    onSave(scores as LifeWheelScores, notes);
  };

  const handleCancelPress = () => {
    console.log('[LifeWheelForm] Cancel pressed');
    onCancel();
  };

  return (
    <KeyboardAvoidingView
      style={styles.wrapper}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {SCORE_FIELDS.map((field) => {
          const selected = scores[field.key];
          return (
            <View key={field.key} style={styles.fieldBlock}>
              <Text style={styles.fieldLabel}>{field.label}</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.pillRow}
              >
                {SCORE_OPTIONS.map((val) => {
                  const isSelected = selected === val;
                  const pillStyle = isSelected ? styles.pillSelected : styles.pillUnselected;
                  const textStyle = isSelected ? styles.pillTextSelected : styles.pillTextUnselected;
                  return (
                    <Pressable
                      key={val}
                      style={[styles.pill, pillStyle]}
                      onPress={() => handleScoreSelect(field.key, val)}
                    >
                      <Text style={[styles.pillText, textStyle]}>{val}</Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
            </View>
          );
        })}

        <View style={styles.notesBlock}>
          <Text style={styles.fieldLabel}>Notities</Text>
          <TextInput
            style={styles.notesInput}
            placeholder="Optionele notities..."
            placeholderTextColor={bcctColors.textSecondary}
            value={notes}
            onChangeText={setNotes}
            multiline
            numberOfLines={4}
            textAlignVertical="top"
            editable={!saving}
          />
        </View>

        {validationError.length > 0 && (
          <Text style={styles.errorText}>{validationError}</Text>
        )}
      </ScrollView>

      {/* Sticky footer */}
      <View style={styles.footer}>
        <Pressable
          style={styles.cancelBtn}
          onPress={handleCancelPress}
          disabled={saving}
        >
          <Text style={styles.cancelBtnText}>{cancelLabel}</Text>
        </Pressable>
        <Pressable
          style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
          onPress={handleSavePress}
          disabled={saving}
        >
          <LinearGradient
            colors={[bcctColors.primaryOrange, bcctColors.primaryOrangeDark]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.saveBtnGradient}
          >
            {saving ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={styles.saveBtnText}>{saveLabel}</Text>
            )}
          </LinearGradient>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    flex: 1,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 16,
  },
  fieldBlock: {
    marginBottom: 20,
  },
  fieldLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: bcctColors.textPrimary,
    marginBottom: 10,
  },
  pillRow: {
    flexDirection: 'row',
    gap: 8,
    paddingRight: 4,
  },
  pill: {
    minWidth: 36,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pillUnselected: {
    borderWidth: 1,
    borderColor: bcctColors.borderGray,
    backgroundColor: '#fff',
  },
  pillSelected: {
    backgroundColor: bcctColors.primaryOrange,
    borderWidth: 1,
    borderColor: bcctColors.primaryOrange,
  },
  pillText: {
    fontSize: 14,
    fontWeight: '600',
  },
  pillTextUnselected: {
    color: bcctColors.textPrimary,
  },
  pillTextSelected: {
    color: '#fff',
  },
  notesBlock: {
    marginBottom: 8,
  },
  notesInput: {
    backgroundColor: bcctColors.lightBackground,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: bcctColors.borderGray,
    padding: 12,
    fontSize: 16,
    color: bcctColors.textPrimary,
    minHeight: 96,
  },
  errorText: {
    fontSize: 13,
    color: bcctColors.error,
    marginTop: 8,
    textAlign: 'center',
  },
  footer: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: bcctColors.borderGray,
    backgroundColor: '#fff',
  },
  cancelBtn: {
    flex: 1,
    height: 52,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: bcctColors.primaryOrange,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelBtnText: {
    fontSize: 15,
    fontWeight: '600',
    color: bcctColors.primaryOrange,
  },
  saveBtn: {
    flex: 1,
    borderRadius: 12,
    overflow: 'hidden',
    height: 52,
  },
  saveBtnDisabled: {
    opacity: 0.6,
  },
  saveBtnGradient: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveBtnText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },
});
