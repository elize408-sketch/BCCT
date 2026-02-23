
import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from "react-native";
import Modal from "react-native-modal";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTheme } from "@react-navigation/native";
import { useAuth } from "@/contexts/AuthContext";
import { IconSymbol } from "@/components/IconSymbol";
import { useRouter } from "expo-router";
import { bcctColors, bcctTypography } from "@/styles/bcctTheme";
import { LinearGradient } from "expo-linear-gradient";

export default function CoachSettingsScreen() {
  const { colors } = useTheme();
  const { user, signOut } = useAuth();
  const router = useRouter();
  const [signingOut, setSigningOut] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [modalTitle, setModalTitle] = useState("");
  const [modalMessage, setModalMessage] = useState("");

  const showModal = (title: string, message: string) => {
    setModalTitle(title);
    setModalMessage(message);
    setModalVisible(true);
  };

  const handleSignOut = async () => {
    console.log("[Coach Settings] Sign out requested");
    setSigningOut(true);
    try {
      await signOut();
      console.log("[Coach Settings] Sign out successful");
      router.replace("/auth");
    } catch (error: any) {
      console.error("[Coach Settings] Sign out error", error);
      showModal("Fout", "Uitloggen mislukt");
    } finally {
      setSigningOut(false);
    }
  };

  const fullName = user?.user_metadata?.full_name || "Coach";
  const email = user?.email || "";

  const settingsOptions = [
    {
      id: "profile",
      title: "Profiel bewerken",
      icon: "edit" as const,
      onPress: () => showModal("Binnenkort", "Profiel bewerken komt binnenkort beschikbaar."),
    },
    {
      id: "notifications",
      title: "Notificaties",
      icon: "notifications" as const,
      onPress: () => showModal("Binnenkort", "Notificatie-instellingen komen binnenkort beschikbaar."),
    },
    {
      id: "privacy",
      title: "Privacy & Beveiliging",
      icon: "lock" as const,
      onPress: () => showModal("Binnenkort", "Privacy-instellingen komen binnenkort beschikbaar."),
    },
    {
      id: "help",
      title: "Help & Support",
      icon: "help" as const,
      onPress: () => showModal("Binnenkort", "Help & Support komt binnenkort beschikbaar."),
    },
  ];

  return (
    <>
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={["top"]}>
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <View style={styles.header}>
            <Text style={[styles.headerTitle, { color: colors.text }]}>Profiel</Text>
          </View>

          {/* Profile Card */}
          <View style={[styles.profileCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={[styles.avatarContainer, { backgroundColor: bcctColors.primaryOrange + "20" }]}>
              <IconSymbol
                ios_icon_name="person.fill"
                android_material_icon_name="person"
                size={40}
                color={bcctColors.primaryOrange}
              />
            </View>
            <View style={styles.profileInfo}>
              <Text style={[styles.profileName, { color: colors.text }]}>{fullName}</Text>
              <Text style={[styles.profileEmail, { color: bcctColors.textSecondary }]}>{email}</Text>
              <View style={styles.roleBadge}>
                <Text style={styles.roleBadgeText}>Coach</Text>
              </View>
            </View>
          </View>

          {/* Settings Options */}
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Instellingen</Text>
            <View style={styles.optionsList}>
              {settingsOptions.map((option) => (
                <React.Fragment key={option.id}>
                <TouchableOpacity
                  style={[styles.optionCard, { backgroundColor: colors.card, borderColor: colors.border }]}
                  onPress={option.onPress}
                  activeOpacity={0.7}
                >
                  <View style={[styles.optionIconContainer, { backgroundColor: bcctColors.primaryOrange + "20" }]}>
                    <IconSymbol
                      ios_icon_name="star"
                      android_material_icon_name={option.icon}
                      size={20}
                      color={bcctColors.primaryOrange}
                    />
                  </View>
                  <Text style={[styles.optionTitle, { color: colors.text }]}>{option.title}</Text>
                  <IconSymbol
                    ios_icon_name="chevron.right"
                    android_material_icon_name="chevron-right"
                    size={20}
                    color={bcctColors.textSecondary}
                  />
                </TouchableOpacity>
                </React.Fragment>
              ))}
            </View>
          </View>

          {/* Sign Out Button */}
          <TouchableOpacity
            onPress={handleSignOut}
            disabled={signingOut}
            activeOpacity={0.8}
          >
            <LinearGradient
              colors={["#EF4444", "#DC2626"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.signOutButton}
            >
              {signingOut ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <IconSymbol
                    ios_icon_name="arrow.right.square"
                    android_material_icon_name="logout"
                    size={20}
                    color="#fff"
                  />
                  <Text style={styles.signOutButtonText}>Uitloggen</Text>
                </>
              )}
            </LinearGradient>
          </TouchableOpacity>

          {/* Bottom padding for tab bar */}
          <View style={{ height: 100 }} />
        </ScrollView>
      </SafeAreaView>

      <Modal
        isVisible={modalVisible}
        onBackdropPress={() => setModalVisible(false)}
        onBackButtonPress={() => setModalVisible(false)}
        animationIn="fadeIn"
        animationOut="fadeOut"
        backdropOpacity={0.5}
      >
        <View style={[styles.modalContent, { backgroundColor: colors.card }]}>
          <Text style={[styles.modalTitle, { color: bcctColors.primaryOrange }]}>{modalTitle}</Text>
          <Text style={[styles.modalMessage, { color: bcctColors.textSecondary }]}>{modalMessage}</Text>
          <TouchableOpacity
            style={[styles.modalButton, { backgroundColor: bcctColors.primaryOrange }]}
            onPress={() => setModalVisible(false)}
          >
            <Text style={styles.modalButtonText}>OK</Text>
          </TouchableOpacity>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
  },
  header: {
    marginBottom: 24,
    marginTop: 8,
  },
  headerTitle: {
    ...bcctTypography.h1,
  },
  profileCard: {
    flexDirection: "row",
    padding: 20,
    borderRadius: 16,
    borderWidth: 1,
    gap: 16,
    marginBottom: 32,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  avatarContainer: {
    width: 72,
    height: 72,
    borderRadius: 36,
    justifyContent: "center",
    alignItems: "center",
  },
  profileInfo: {
    flex: 1,
    justifyContent: "center",
    gap: 4,
  },
  profileName: {
    ...bcctTypography.h3,
  },
  profileEmail: {
    ...bcctTypography.small,
  },
  roleBadge: {
    alignSelf: "flex-start",
    backgroundColor: bcctColors.primaryOrange,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    marginTop: 4,
  },
  roleBadgeText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "600",
  },
  section: {
    marginBottom: 32,
  },
  sectionTitle: {
    ...bcctTypography.h3,
    marginBottom: 16,
  },
  optionsList: {
    gap: 12,
  },
  optionCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    gap: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  optionIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
  },
  optionTitle: {
    flex: 1,
    ...bcctTypography.bodyMedium,
  },
  signOutButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 16,
    borderRadius: 16,
    gap: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  signOutButtonText: {
    color: "#fff",
    ...bcctTypography.button,
  },
  modalContent: {
    borderRadius: 20,
    padding: 24,
    alignItems: "center",
  },
  modalTitle: {
    ...bcctTypography.h3,
    marginBottom: 12,
  },
  modalMessage: {
    ...bcctTypography.body,
    textAlign: "center",
    marginBottom: 24,
  },
  modalButton: {
    borderRadius: 12,
    paddingHorizontal: 32,
    paddingVertical: 12,
    minWidth: 100,
  },
  modalButtonText: {
    color: "#fff",
    ...bcctTypography.button,
    textAlign: "center",
  },
});
