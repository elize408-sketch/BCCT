
import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { bcctColors } from '@/styles/bcctTheme';

export interface TimelineItem {
  id: string;
  coach_id: string;
  client_id: string;
  title: string;
  description: string | null;
  status: 'todo' | 'active' | 'completed' | 'skipped';
  item_type: string | null;
  due_date: string | null;
  completed_at: string | null;
  order_index: number;
  created_at: string;
  updated_at: string;
}

interface Props {
  items: TimelineItem[];
  onItemPress?: (item: TimelineItem) => void;
  onItemLongPress?: (item: TimelineItem) => void;
}

function formatDueDate(iso: string | null | undefined): string {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('nl-NL', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function StatusDot({ status }: { status: TimelineItem['status'] }) {
  if (status === 'completed') {
    return (
      <View style={[dotStyles.dot, dotStyles.completed]}>
        <Ionicons name="checkmark" size={12} color="#fff" />
      </View>
    );
  }
  if (status === 'active') {
    return (
      <View style={[dotStyles.dot, dotStyles.active]}>
        <View style={dotStyles.activeInnerRing} />
      </View>
    );
  }
  if (status === 'skipped') {
    return <View style={[dotStyles.dot, dotStyles.skipped]} />;
  }
  // todo
  return <View style={[dotStyles.dot, dotStyles.todo]} />;
}

const dotStyles = StyleSheet.create({
  dot: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
  completed: {
    backgroundColor: bcctColors.success,
  },
  active: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: bcctColors.primaryOrange,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activeInnerRing: {
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.8)',
  },
  skipped: {
    backgroundColor: '#C7C7CC',
  },
  todo: {
    backgroundColor: 'transparent',
    borderWidth: 2,
    borderColor: bcctColors.borderGray,
  },
});

export default function TimelineList({ items, onItemPress, onItemLongPress }: Props) {
  // Find the first active item index for the "Huidige stap" label
  const firstActiveIndex = items.findIndex((item) => item.status === 'active');

  return (
    <View style={styles.container}>
      {items.map((item, index) => {
        const isLast = index === items.length - 1;
        const isFirstActive = index === firstActiveIndex;
        const dueDateText = formatDueDate(item.due_date);
        const hasDescription = !!item.description;
        const hasDueDate = !!item.due_date;

        const cardContent = (
          <View style={styles.card}>
            {isFirstActive ? (
              <Text style={styles.currentStepLabel}>HUIDIGE STAP</Text>
            ) : null}
            <Text style={styles.cardTitle}>{item.title}</Text>
            {hasDescription ? (
              <Text style={styles.cardDescription}>{item.description}</Text>
            ) : null}
            {hasDueDate ? (
              <Text style={styles.cardDueDate}>{dueDateText}</Text>
            ) : null}
          </View>
        );

        return (
          <View key={item.id} style={styles.row}>
            {/* Left column: dot + connector line */}
            <View style={styles.leftCol}>
              <StatusDot status={item.status} />
              {!isLast ? <View style={styles.connector} /> : null}
            </View>

            {/* Right column: card */}
            <View style={styles.rightCol}>
              {onItemPress || onItemLongPress ? (
                <Pressable
                  onPress={() => {
                    console.log('[TimelineList] Item pressed:', item.id, item.title);
                    onItemPress?.(item);
                  }}
                  onLongPress={() => {
                    console.log('[TimelineList] Item long-pressed:', item.id, item.title);
                    onItemLongPress?.(item);
                  }}
                  style={({ pressed }) => [
                    styles.cardPressable,
                    pressed && styles.cardPressed,
                  ]}
                >
                  {cardContent}
                </Pressable>
              ) : (
                cardContent
              )}
            </View>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 8,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  leftCol: {
    width: 32,
    alignItems: 'center',
    paddingTop: 14,
  },
  connector: {
    width: 2,
    flex: 1,
    minHeight: 20,
    backgroundColor: bcctColors.borderGray,
    marginTop: 2,
  },
  rightCol: {
    flex: 1,
    paddingBottom: 8,
  },
  cardPressable: {
    borderRadius: 12,
  },
  cardPressed: {
    opacity: 0.75,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    marginLeft: 8,
    marginTop: 6,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: bcctColors.borderGray,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  currentStepLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: bcctColors.primaryOrange,
    marginBottom: 4,
    letterSpacing: 0.5,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: bcctColors.textPrimary,
    lineHeight: 22,
  },
  cardDescription: {
    fontSize: 14,
    color: bcctColors.textSecondary,
    marginTop: 4,
    lineHeight: 20,
  },
  cardDueDate: {
    fontSize: 12,
    color: bcctColors.textSecondary,
    marginTop: 6,
  },
});
