
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
import { useTheme } from "@react-navigation/native";
import { SafeAreaView } from "react-native-safe-area-context";
import { IconSymbol } from "@/components/IconSymbol";
import { useAuth } from "@/contexts/AuthContext";
import { useRouter } from "expo-router";

export default function SettingsScreen() {
  const { colors } = useTheme();
  const { user, signOut } = useAuth();
  const router = useRouter();
  const [signingOut, setSigningOut] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [modalTitle, setModalTitle] = useState("");
  const [modalMessage, setModalMessage] = useState("");
  const [confirmSignOutVisible, setConfirmSignOutVisible] = useState(false);

  const showModal = (title: string, message: string) => {
    setModalTitle(title);
    setModalMessage(message);
    setModalVisible(true);
  };

  const handleSignOut = async () => {
    console.log("[Settings] Sign out requested");
    setConfirmSignOutVisible(false);
    setSigningOut(true);
    try {
      await signOut();
      console.log("[Settings] Sign out successful");
      router.replace("/auth");
    } catch (error: any) {
      console.error("[Settings] Sign out error", error);
      showModal("Fout", "Uitloggen mislukt");
    } finally {
      setSigningOut(false);
    }
  };

  const settingsOptions = [
    {
      id: "profile",
      title: "Profiel Bewerken",
      icon: "person" as const,
      color: "#6366f1",
    },
    {
      id: "notifications",
      title: "Notificaties",
      icon: "notifications" as const,
      color: "#f59e0b",
    },
    {
      id: "privacy",
      title: "Privacy & Beveiliging",
      icon: "lock" as const,
      color: "#10b981",
    },
    {
      id: "help",
      title: "Help & Ondersteuning",
      icon: "help" as const,
      color: "#8b5cf6",
    },
  ];

  return (
    <>
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={["top"]}>
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <View style={styles.header}>
            <Text style={[styles.title, { color: colors.text }]}>Instellingen</Text>
            <Text style={[styles.subtitle, { color: colors.text, opacity: 0.7 }]}>
              Beheer je profiel en voorkeuren
            </Text>
          </View>

          <View style={styles.section}>
            <View style={[styles.profileCard, { backgroundColor: colors.card }]}>
              <View style={[styles.avatar, { backgroundColor: colors.primary + "20" }]}>
                <IconSymbol
                  ios_icon_name="person.fill"
                  android_material_icon_name="person"
                  size={32}
                  color={colors.primary}
                />
              </View>
              <View style={styles.profileInfo}>
                <Text style={[styles.profileName, { color: colors.text }]}>
                  {user?.name || "Cliënt"}
                </Text>
                <Text style={[styles.profileEmail, { color: colors.text, opacity: 0.7 }]}>
                  {user?.email || ""}
                </Text>
              </View>
            </View>
          </View>

          <View style={styles.section}>
            {settingsOptions.map((option) => (
              <TouchableOpacity
                key={option.id}
                style={[styles.settingItem, { backgroundColor: colors.card }]}
                onPress={() => console.log("Setting pressed:", option.id)}
              >
                <View style={[styles.settingIcon, { backgroundColor: option.color + "20" }]}>
                  <IconSymbol
                    ios_icon_name="star"
                    android_material_icon_name={option.icon}
                    size={24}
                    color={option.color}
                  />
                </View>
                <Text style={[styles.settingTitle, { color: colors.text }]}>{option.title}</Text>
                <IconSymbol
                  ios_icon_name="chevron.right"
                  android_material_icon_name="arrow-forward"
                  size={20}
                  color={colors.text}
                  style={{ opacity: 0.5 }}
                />
              </TouchableOpacity>
            ))}
          </View>

          <View style={styles.section}>
            <TouchableOpacity
              style={[styles.signOutButton, { backgroundColor: "#ef4444" }]}
              onPress={() => setConfirmSignOutVisible(true)}
              disabled={signingOut}
            >
              {signingOut ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <IconSymbol
                    ios_icon_name="arrow.right.square"
                    android_material_icon_name="logout"
                    size={24}
                    color="#fff"
                  />
                  <Text style={styles.signOutText}>Uitloggen</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
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
        <View style={styles.modalContent}>
          <Text style={styles.modalTitle}>{modalTitle}</Text>
          <Text style={styles.modalMessage}>{modalMessage}</Text>
          <TouchableOpacity
            style={styles.modalButton}
            onPress={() => setModalVisible(false)}
          >
            <Text style={styles.modalButtonText}>OK</Text>
          </TouchableOpacity>
        </View>
      </Modal>

      <Modal
        isVisible={confirmSignOutVisible}
        onBackdropPress={() => setConfirmSignOutVisible(false)}
        onBackButtonPress={() => setConfirmSignOutVisible(false)}
        animationIn="fadeIn"
        animationOut="fadeOut"
        backdropOpacity={0.5}
      >
        <View style={styles.modalContent}>
          <Text style={styles.modalTitle}>Uitloggen</Text>
          <Text style={styles.modalMessage}>Weet je zeker dat je wilt uitloggen?</Text>
          <View style={styles.modalButtons}>
            <TouchableOpacity
              style={[styles.modalButton, { backgroundColor: "#6b7280" }]}
              onPress={() => setConfirmSignOutVisible(false)}
            >
              <Text style={styles.modalButtonText}>Annuleren</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.modalButton, { backgroundColor: "#ef4444" }]}
              onPress={handleSignOut}
            >
              <Text style={styles.modalButtonText}>Uitloggen</Text>
            </TouchableOpacity>
          </View>
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
    paddingBottom: 100,
  },
  header: {
    marginBottom: 32,
  },
  title: {
    fontSize: 32,
    fontWeight: "bold",
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
  },
  section: {
    marginBottom: 24,
  },
  profileCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: 20,
    borderRadius: 16,
    gap: 16,
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: "center",
    alignItems: "center",
  },
  profileInfo: {
    flex: 1,
    gap: 4,
  },
  profileName: {
    fontSize: 20,
    fontWeight: "bold",
  },
  profileEmail: {
    fontSize: 14,
  },
  settingItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    borderRadius: 12,
    marginBottom: 8,
    gap: 16,
  },
  settingIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: "center",
    alignItems: "center",
  },
  settingTitle: {
    flex: 1,
    fontSize: 16,
    fontWeight: "500",
  },
  signOutButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
    borderRadius: 12,
    gap: 12,
  },
  signOutText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  modalContent: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 24,
    alignItems: "center",
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "bold",
    marginBottom: 12,
    color: "#ef4444",
  },
  modalMessage: {
    fontSize: 16,
    textAlign: "center",
    marginBottom: 24,
    color: "#666",
  },
  modalButton: {
    backgroundColor: "#ef4444",
    paddingHorizontal: 32,
    paddingVertical: 12,
    borderRadius: 8,
    minWidth: 100,
  },
  modalButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
    textAlign: "center",
  },
  modalButtons: {
    flexDirection: "row",
    gap: 12,
  },
});
