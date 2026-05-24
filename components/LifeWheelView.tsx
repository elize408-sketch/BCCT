import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { bcctColors } from '@/styles/bcctTheme';

export interface LifeWheelScores {
  health: number;
  work_score: number;
  finance_score: number;
  relationship_score: number;
  family_score: number;
  personal_growth_score: number;
  social_score: number;
  mental_health_score: number;
}

export const SCORE_FIELDS: { key: keyof LifeWheelScores; label: string }[] = [
  { key: 'health', label: 'Gezondheid' },
  { key: 'work_score', label: 'Werk' },
  { key: 'finance_score', label: 'Financiën' },
  { key: 'relationship_score', label: 'Relatie' },
  { key: 'family_score', label: 'Gezin' },
  { key: 'personal_growth_score', label: 'Persoonlijke groei' },
  { key: 'social_score', label: 'Sociale contacten' },
  { key: 'mental_health_score', label: 'Mentale gezondheid' },
];

export function calculateLifeWheelAverage(scores: LifeWheelScores): number {
  const values = SCORE_FIELDS.map((f) => scores[f.key] ?? 0);
  const sum = values.reduce((a, b) => a + b, 0);
  return Math.round((sum / values.length) * 10) / 10;
}

interface Props {
  scores: LifeWheelScores;
  showAverage?: boolean;
}

export default function LifeWheelView({ scores, showAverage = true }: Props) {
  const average = calculateLifeWheelAverage(scores);
  const averageDisplay = String(average);

  return (
    <View style={styles.container}>
      {showAverage && (
        <>
          <View style={styles.averageRow}>
            <Text style={styles.averageLabel}>Gemiddelde score</Text>
            <Text style={styles.averageValue}>{averageDisplay}</Text>
          </View>
          <View style={styles.divider} />
        </>
      )}
      {SCORE_FIELDS.map((field) => {
        const score = scores[field.key] ?? 0;
        const badgeText = score + '/10';
        const barWidth = (score / 10) * 100;
        const barWidthStr = barWidth + '%';

        return (
          <View key={field.key} style={styles.fieldRow}>
            <View style={styles.labelRow}>
              <Text style={styles.fieldLabel}>{field.label}</Text>
              <View style={styles.scoreBadge}>
                <Text style={styles.scoreBadgeText}>{badgeText}</Text>
              </View>
            </View>
            <View style={styles.barTrack}>
              <View style={[styles.barFill, { width: barWidthStr as any }]} />
            </View>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingVertical: 4,
  },
  averageRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  averageLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: bcctColors.textSecondary,
  },
  averageValue: {
    fontSize: 28,
    fontWeight: '800',
    color: bcctColors.primaryOrange,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: bcctColors.borderGray,
    marginBottom: 14,
  },
  fieldRow: {
    marginBottom: 14,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  fieldLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: bcctColors.textPrimary,
  },
  scoreBadge: {
    backgroundColor: bcctColors.primaryOrangeLight + '25',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 12,
  },
  scoreBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: bcctColors.primaryOrange,
  },
  barTrack: {
    height: 8,
    borderRadius: 4,
    backgroundColor: bcctColors.borderGray,
    overflow: 'hidden',
  },
  barFill: {
    height: 8,
    borderRadius: 4,
    backgroundColor: bcctColors.primaryOrange,
  },
});
