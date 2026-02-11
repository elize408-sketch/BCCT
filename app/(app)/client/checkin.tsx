
import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from "react-native";
import { useTheme } from "@react-navigation/native";
import { SafeAreaView } from "react-native-safe-area-context";
import { IconSymbol } from "@/components/IconSymbol";

export default function CheckinScreen() {
  const { colors } = useTheme();
  const [loading, setLoading] = useState(false);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={["top"]}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          <Text style={[styles.title, { color: colors.text }]}>Dagelijkse Check-in</Text>
          <Text style={[styles.subtitle, { color: colors.text, opacity: 0.7 }]}>
            Hoe voel je je vandaag?
          </Text>
        </View>

        <View style={styles.section}>
          <View style={[styles.card, { backgroundColor: colors.card }]}>
            <View style={styles.cardHeader}>
              <IconSymbol
                ios_icon_name="heart.fill"
                android_material_icon_name="favorite"
                size={32}
                color="#ef4444"
              />
              <Text style={[styles.cardTitle, { color: colors.text }]}>Welzijn Check</Text>
            </View>
            <Text style={[styles.cardDescription, { color: colors.text, opacity: 0.7 }]}>
              Beantwoord een paar vragen over je stress, energie, slaap en stemming.
            </Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={[styles.infoText, { color: colors.text, opacity: 0.6 }]}>
            Check-in functionaliteit wordt binnenkort toegevoegd.
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
