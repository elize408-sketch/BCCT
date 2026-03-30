import React, { useRef, useEffect } from "react";
import {
  Modal,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Animated,
  StyleSheet,
  Pressable,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { bcctColors } from "@/styles/bcctTheme";
import { useTips } from "@/contexts/TipsContext";
import type { TipStepId } from "@/utils/tipsStorage";

const ACCENT = bcctColors.primaryOrange;
const CARD_BG = "#FFFFFF";
const CARD_BG_DONE = "#F9FAFB";

interface TipData {
  id: TipStepId;
  icon: string;
  title: string;
  description: string;
}

const TIPS_DATA: TipData[] = [
  {
    id: "add_client",
    icon: "person-add-outline",
    title: "Voeg je eerste cliënt toe",
    description: "Ga naar Cliënten en voeg je eerste cliënt toe om te beginnen.",
  },
  {
    id: "plan_appointment",
    icon: "calendar-outline",
    title: "Plan je eerste afspraak",
    description: "Maak een afspraak aan om structuur te bieden aan je traject.",
  },
  {
    id: "create_module",
    icon: "albums-outline",
    title: "Gebruik modules voor structuur",
    description: "Modules helpen je een gestructureerd coachingtraject op te bouwen.",
  },
  {
    id: "use_chat",
    icon: "chatbubble-outline",
    title: "Start een chat met je cliënt",
    description: "Gebruik de chat om laagdrempelig contact te houden.",
  },
  {
    id: "ask_feedback",
    icon: "person-circle-outline",
    title: "Stel je profiel in",
    description: "Voeg een profielfoto en bio toe zodat cliënten je beter leren kennen.",
  },
];

interface TipRowProps {
  tip: TipData;
  completed: boolean;
  onToggle: () => void;
}

function TipRow({ tip, completed, onToggle }: TipRowProps) {
  const cardBg = completed ? CARD_BG_DONE : CARD_BG;
  const iconBg = completed ? "#D1FAE5" : "#FEF3E8";
  const iconColor = completed ? bcctColors.success : ACCENT;

  return (
    <TouchableOpacity
      style={[styles.tipRow, { backgroundColor: cardBg }]}
      onPress={onToggle}
      activeOpacity={0.7}
    >
      <View style={[styles.tipIconContainer, { backgroundColor: iconBg }]}>
        <Ionicons name={tip.icon as any} size={20} color={iconColor} />
      </View>
      <View style={styles.tipTextContainer}>
        <Text style={[styles.tipTitle, completed && styles.tipTitleDone]}>
          {tip.title}
        </Text>
        <Text style={styles.tipDescription}>{tip.description}</Text>
      </View>
      <View style={styles.checkContainer}>
        {completed ? (
          <Ionicons name="checkmark-circle" size={24} color={bcctColors.success} />
        ) : (
          <View style={styles.emptyCheck} />
        )}
      </View>
    </TouchableOpacity>
  );
}

interface TipsModalProps {
  visible: boolean;
  onClose: () => void;
}

export default function TipsModal({ visible, onClose }: TipsModalProps) {
  const { isComplete, toggleComplete, progress } = useTips();
  const slideAnim = useRef(new Animated.Value(500)).current;
  const backdropAnim = useRef(new Animated.Value(0)).current;

  const allDone = progress.completed === progress.total;
  const progressPercent = progress.total > 0 ? progress.completed / progress.total : 0;
  const progressLabel = `${progress.completed} van ${progress.total} tips voltooid`;

  useEffect(() => {
    if (visible) {
      console.log("[TipsModal] Opening tips modal");
      Animated.parallel([
        Animated.spring(slideAnim, {
          toValue: 0,
          useNativeDriver: true,
          damping: 22,
          stiffness: 220,
        }),
        Animated.timing(backdropAnim, {
          toValue: 1,
          duration: 250,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: 500,
          duration: 220,
          useNativeDriver: true,
        }),
        Animated.timing(backdropAnim, {
          toValue: 0,
          duration: 220,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible, slideAnim, backdropAnim]);

  const handleClose = () => {
    console.log("[TipsModal] Close button pressed");
    onClose();
  };

  const handleToggle = (id: TipStepId) => {
    const wasComplete = isComplete(id);
    console.log("[TipsModal] Tip toggled:", id, "was complete:", wasComplete);
    toggleComplete(id);
  };

  const backdropOpacity = backdropAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 0.5],
  });

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={handleClose}
      statusBarTranslucent
    >
      <View style={styles.overlay}>
        {/* Backdrop */}
        <Animated.View
          style={[styles.backdrop, { opacity: backdropOpacity }]}
          pointerEvents="box-none"
        >
          <Pressable style={StyleSheet.absoluteFill} onPress={handleClose} />
        </Animated.View>

        {/* Sheet */}
        <Animated.View
          style={[styles.sheet, { transform: [{ translateY: slideAnim }] }]}
        >
          {/* Handle */}
          <View style={styles.handle} />

          {/* Header */}
          <View style={styles.sheetHeader}>
            <View style={styles.headerTextGroup}>
              <Text style={styles.sheetTitle}>Tips voor coaches</Text>
              <Text style={styles.sheetSubtitle}>
                Haal meer uit je coaching praktijk
              </Text>
              <Text style={styles.progressLabel}>{progressLabel}</Text>
              {/* Progress bar */}
              <View style={styles.progressBarTrack}>
                <View
                  style={[
                    styles.progressBarFill,
                    { width: `${progressPercent * 100}%` as any },
                  ]}
                />
              </View>
            </View>
            <TouchableOpacity
              style={styles.closeButton}
              onPress={handleClose}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name="close" size={20} color={bcctColors.textSecondary} />
            </TouchableOpacity>
          </View>

          {/* Tips list */}
          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            {TIPS_DATA.map((tip) => (
              <TipRow
                key={tip.id}
                tip={tip}
                completed={isComplete(tip.id)}
                onToggle={() => handleToggle(tip.id)}
              />
            ))}

            {/* All done banner */}
            {allDone && (
              <View style={styles.allDoneBanner}>
                <Text style={styles.allDoneText}>
                  Je hebt alle tips voltooid!
                </Text>
              </View>
            )}
          </ScrollView>
        </Animated.View>
      </View>
    </Modal>
  );
}

export { TIPS_DATA };

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: "flex-end",
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "#000",
  },
  sheet: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: "85%",
    paddingBottom: 36,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 20,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#E5E7EB",
    alignSelf: "center",
    marginTop: 12,
    marginBottom: 4,
  },
  sheetHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
  },
  headerTextGroup: {
    flex: 1,
    marginRight: 12,
  },
  sheetTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: bcctColors.textPrimary,
    marginBottom: 2,
  },
  sheetSubtitle: {
    fontSize: 14,
    color: bcctColors.textSecondary,
    marginBottom: 10,
  },
  progressLabel: {
    fontSize: 12,
    color: bcctColors.textSecondary,
    marginBottom: 6,
  },
  progressBarTrack: {
    height: 6,
    borderRadius: 3,
    backgroundColor: "#E5E7EB",
    overflow: "hidden",
  },
  progressBarFill: {
    height: 6,
    borderRadius: 3,
    backgroundColor: ACCENT,
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#F3F4F6",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 2,
  },
  scrollView: {
    flexGrow: 0,
  },
  scrollContent: {
    padding: 16,
    gap: 10,
  },
  tipRow: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: "#F3F4F6",
  },
  tipIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
    flexShrink: 0,
  },
  tipTextContainer: {
    flex: 1,
  },
  tipTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: bcctColors.textPrimary,
    marginBottom: 3,
  },
  tipTitleDone: {
    color: bcctColors.textSecondary,
  },
  tipDescription: {
    fontSize: 12,
    color: "#6B7280",
    lineHeight: 18,
  },
  checkContainer: {
    marginLeft: 10,
    flexShrink: 0,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyCheck: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: "#D1D5DB",
  },
  allDoneBanner: {
    backgroundColor: "#D1FAE5",
    borderRadius: 12,
    padding: 14,
    alignItems: "center",
    marginTop: 4,
  },
  allDoneText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#065F46",
  },
});
