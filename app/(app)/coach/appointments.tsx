
import React from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTheme } from "@react-navigation/native";
import { IconSymbol } from "@/components/IconSymbol";
import { bcctColors, bcctTypography } from "@/styles/bcctTheme";

export default function CoachAppointmentsScreen() {
  const { colors } = useTheme();

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={["top"]}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          <Text style={[styles.headerTitle, { color: colors.text }]}>Afspraken</Text>
        </View>

        <View style={styles.emptyState}>
          <View style={[styles.emptyIconContainer, { backgroundColor: bcctColors.primaryOrange + "20" }]}>
            <IconSymbol
              ios_icon_name="calendar"
              android_material_icon_name="event"
              size={48}
              color={bcctColors.primaryOrange}
            />
          </View>
          <Text style={[styles.emptyTitle, { color: colors.text }]}>Binnenkort beschikbaar</Text>
          <Text style={[styles.emptyText, { color: bcctColors.textSecondary }]}>
            Hier kun je binnenkort afspraken plannen en beheren met je cliënten.
          </Text>
        </View>

        {/* Bottom padding for tab bar */}
        <View style={{ height: 100 }} />
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
  },
  header: {
    marginBottom: 32,
    marginTop: 8,
  },
  headerTitle: {
    ...bcctTypography.h1,
  },
  emptyState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 80,
    gap: 16,
  },
  emptyIconContainer: {
    width: 96,
    height: 96,
    borderRadius: 48,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 8,
  },
  emptyTitle: {
    ...bcctTypography.h2,
  },
  emptyText: {
    ...bcctTypography.body,
    textAlign: "center",
    maxWidth: 280,
  },
});
