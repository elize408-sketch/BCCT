
import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from "react-native";
import { useTheme } from "@react-navigation/native";
import { SafeAreaView } from "react-native-safe-area-context";
import { IconSymbol } from "@/components/IconSymbol";

export default function ChatScreen() {
  const { colors } = useTheme();

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={["top"]}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          <Text style={[styles.title, { color: colors.text }]}>Chat met Coach</Text>
          <Text style={[styles.subtitle, { color: colors.text, opacity: 0.7 }]}>
            Blijf in contact met je coach
          </Text>
        </View>

        <View style={styles.section}>
          <View style={[styles.card, { backgroundColor: colors.card }]}>
            <View style={styles.cardHeader}>
              <IconSymbol
                ios_icon_name="message.fill"
                android_material_icon_name="chat"
                size={32}
                color="#10b981"
              />
              <Text style={[styles.cardTitle, { color: colors.text }]}>Berichten</Text>
            </View>
            <Text style={[styles.cardDescription, { color: colors.text, opacity: 0.7 }]}>
              Stuur berichten naar je coach en ontvang persoonlijke begeleiding.
            </Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={[styles.infoText, { color: colors.text, opacity: 0.6 }]}>
            Chat functionaliteit wordt binnenkort toegevoegd.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
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
  card: {
    padding: 24,
    borderRadius: 16,
    gap: 16,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
  },
  cardTitle: {
    fontSize: 20,
    fontWeight: "bold",
  },
  cardDescription: {
    fontSize: 16,
    lineHeight: 24,
  },
  infoText: {
    fontSize: 14,
    lineHeight: 20,
    textAlign: "center",
  },
});
