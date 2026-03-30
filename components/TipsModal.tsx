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
const CARD_BG = "#FFF7ED";
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
    title: "Nodig je eerste cliënt uit",
    description:
      "Ga naar het tabblad Cliënten en stuur een uitnodiging. Je cliënt ontvangt een e-mail om de app te downloaden.",
  },
  {
    id: "plan_appointment",
    icon: "calendar-outline",
    title: "Plan je eerste afspraak",
    description:
      "Gebruik de agenda om een sessie in te plannen en je week goed voor te bereiden.",
  },
  {
    id: "use_chat",
    icon: "chatbubble-outline",
    title: "Stuur je eerste bericht",
    description:
      "Blijf in contact met je cliënten via de ingebouwde chat voor snelle communicatie.",
  },
  {
    id: "create_module",
    icon: "albums-outline",
    title: "Gebruik modules voor structuur",
    description:
      "Maak modules aan om je coaching programma overzichtelijk te structureren.",
  },
  {
    id: "ask_feedback",
    icon: "star-outline",
    title: "Vraag om feedback",
    description:
      "Vraag je cliënten regelmatig om feedback om je coaching continu te verbeteren.",
  },
];

interface TipCardProps {
  tip: TipData;
  completed: boolean;
}

function TipCard({ tip, completed }: TipCardProps) {
  const cardBg = completed ? CARD_BG_DONE : CARD_BG;
  const iconBg = completed ? "#D1FAE5" : "#FEE9D1";
  const iconColor = completed ? bcctColors.success : ACCENT;

  return (
    <View style={[styles.tipCard, { backgroundColor: cardBg }]}>
      <View style={[styles.tipIconContainer, { backgroundColor: iconBg }]}>
        <Ionicons name={tip.icon as any} size={22} color={iconColor} />
      </View>
      <View style={styles.tipTextContainer}>
        <Text style={[styles.tipTitle, completed && styles.tipTitleDone]}>
          {tip.title}
        </Text>
        <Text style={styles.tipDescription}>{tip.description}</Text>
      </View>
      {completed && (
        <Ionicons
          name="checkmark-circle"
          size={22}
          color={bcctColors.success}
          style={styles.checkIcon}
        />
      )}
    </View>
  );
}

interface TipsModalProps {
  visible: boolean;
  onClose: () => void;
}

export default function TipsModal({ visible, onClose }: TipsModalProps) {
  const { isComplete, progress } = useTips();
  const slideAnim = useRef(new Animated.Value(400)).current;
  const backdropAnim = useRef(new Animated.Value(0)).current;

  const allDone = progress.completed === progress.total;
  const progressPercent = progress.total > 0 ? progress.completed / progress.total : 0;
  const progressLabel = `${progress.completed} van ${progress.total} stappen voltooid`;

  useEffect(() => {
    if (visible) {
      console.log("[TipsModal] Opening tips modal");
      Animated.parallel([
        Animated.spring(slideAnim, {
          toValue: 0,
          useNativeDriver: true,
          damping: 20,
          stiffness: 200,
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
          toValue: 400,
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
          style={[
            styles.sheet,
            { transform: [{ translateY: slideAnim }] },
          ]}
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
                <Animated.View
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
              <TipCard key={tip.id} tip={tip} completed={isComplete(tip.id)} />
            ))}

            {/* All done banner */}
            {allDone && (
              <View style={styles.allDoneBanner}>
                <Text style={styles.allDoneText}>
                  🎉 Je hebt alle stappen voltooid!
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
    paddingBottom: 32,
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
    marginBottom: 8,
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
    gap: 12,
  },
  tipCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    borderRadius: 12,
    padding: 14,
    shadowColor: ACCENT,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  tipIconContainer: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
    flexShrink: 0,
  },
  tipTextContainer: {
    flex: 1,
  },
  tipTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: bcctColors.textPrimary,
    marginBottom: 4,
  },
  tipTitleDone: {
    color: bcctColors.textSecondary,
  },
  tipDescription: {
    fontSize: 13,
    color: "#6B7280",
    lineHeight: 19,
  },
  checkIcon: {
    marginLeft: 8,
    alignSelf: "center",
    flexShrink: 0,
  },
  allDoneBanner: {
    backgroundColor: "#D1FAE5",
    borderRadius: 12,
    padding: 14,
    alignItems: "center",
    marginTop: 4,
  },
  allDoneText: {
    fontSize: 15,
    fontWeight: "700",
    color: "#065F46",
  },
});
