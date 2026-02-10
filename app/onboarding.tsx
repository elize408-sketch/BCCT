
import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from "react-native";
import Modal from "react-native-modal";
import { useRouter } from "expo-router";
import { useTheme } from "@react-navigation/native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "@/contexts/AuthContext";
import { authenticatedPut } from "@/utils/api";

export default function OnboardingScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [role, setRole] = useState<"client" | "coach" | "org_admin">("client");
  const [goals, setGoals] = useState("");
  const [modalVisible, setModalVisible] = useState(false);
  const [modalTitle, setModalTitle] = useState("");
  const [modalMessage, setModalMessage] = useState("");

  const showModal = (title: string, message: string) => {
    setModalTitle(title);
    setModalMessage(message);
    setModalVisible(true);
  };

  const handleComplete = async () => {
    console.log("[Onboarding] Starting profile setup", { name, phone, role });
    
    if (!name.trim()) {
      showModal("Error", "Please enter your name");
      return;
    }

    setLoading(true);
    try {
      console.log("[Onboarding] Calling PUT /api/profile");
      
      // Backend Integration: PUT /api/profile with { name, phone, goals }
      // Note: role is not included in the update as it's set during account creation
      const profileData: any = {
        name: name.trim(),
      };
      
      if (phone.trim()) {
        profileData.phone = phone.trim();
      }
      
      if (goals.trim()) {
        profileData.goals = goals.trim();
      }
      
      await authenticatedPut("/api/profile", profileData);
      
      console.log("[Onboarding] Profile saved successfully, redirecting to app");
      router.replace("/(app)");
    } catch (error: any) {
      console.error("[Onboarding] Error saving profile", error);
      showModal("Error", error.message || "Failed to save profile. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const roleOptions = [
    { value: "client", label: "Client", description: "I want coaching" },
    { value: "coach", label: "Coach", description: "I provide coaching" },
    { value: "org_admin", label: "Organization Admin", description: "I manage an organization" },
  ] as const;

  return (
    <>
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <View style={styles.header}>
            <Text style={[styles.title, { color: colors.text }]}>Welcome to BCCT</Text>
            <Text style={[styles.subtitle, { color: colors.text, opacity: 0.7 }]}>
              Let&apos;s set up your profile
            </Text>
          </View>

        <View style={styles.form}>
          <View style={styles.inputGroup}>
            <Text style={[styles.label, { color: colors.text }]}>Name *</Text>
            <TextInput
              style={[styles.input, { backgroundColor: colors.card, color: colors.text, borderColor: colors.border }]}
              value={name}
              onChangeText={setName}
              placeholder="Enter your name"
              placeholderTextColor={colors.text + "80"}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={[styles.label, { color: colors.text }]}>Phone</Text>
            <TextInput
              style={[styles.input, { backgroundColor: colors.card, color: colors.text, borderColor: colors.border }]}
              value={phone}
              onChangeText={setPhone}
              placeholder="Enter your phone number"
              placeholderTextColor={colors.text + "80"}
              keyboardType="phone-pad"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={[styles.label, { color: colors.text }]}>I am a *</Text>
            {roleOptions.map((option) => {
              const isSelected = role === option.value;
              return (
                <TouchableOpacity
                  key={option.value}
                  style={[
                    styles.roleOption,
                    { backgroundColor: colors.card, borderColor: isSelected ? colors.primary : colors.border },
                    isSelected && { borderWidth: 2 },
                  ]}
                  onPress={() => setRole(option.value)}
                >
                  <View style={styles.roleContent}>
                    <Text style={[styles.roleLabel, { color: colors.text }]}>{option.label}</Text>
                    <Text style={[styles.roleDescription, { color: colors.text, opacity: 0.6 }]}>
                      {option.description}
                    </Text>
                  </View>
                  <View
                    style={[
                      styles.radio,
                      { borderColor: isSelected ? colors.primary : colors.border },
                      isSelected && { backgroundColor: colors.primary },
                    ]}
                  />
                </TouchableOpacity>
              );
            })}
          </View>

          {role === "client" && (
            <View style={styles.inputGroup}>
              <Text style={[styles.label, { color: colors.text }]}>Goals</Text>
              <TextInput
                style={[styles.textArea, { backgroundColor: colors.card, color: colors.text, borderColor: colors.border }]}
                value={goals}
                onChangeText={setGoals}
                placeholder="What do you want to achieve?"
                placeholderTextColor={colors.text + "80"}
                multiline
                numberOfLines={4}
                textAlignVertical="top"
              />
            </View>
          )}

          <TouchableOpacity
            style={[styles.button, { backgroundColor: colors.primary }]}
            onPress={handleComplete}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonText}>Complete Setup</Text>
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
  </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    padding: 24,
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
  form: {
    gap: 24,
  },
  inputGroup: {
    gap: 8,
  },
  label: {
    fontSize: 14,
    fontWeight: "600",
  },
  input: {
    height: 48,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 16,
    fontSize: 16,
  },
  textArea: {
    minHeight: 100,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
  },
  roleOption: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 12,
  },
  roleContent: {
    flex: 1,
    gap: 4,
  },
  roleLabel: {
    fontSize: 16,
    fontWeight: "600",
  },
  roleDescription: {
    fontSize: 14,
  },
  radio: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
  },
  button: {
    height: 56,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 8,
  },
  buttonText: {
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
});
