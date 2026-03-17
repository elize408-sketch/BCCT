import React from "react";
import { StyleSheet, View, Text, ScrollView } from "react-native";
import { useTheme } from "@react-navigation/native";
import CoachSummaryCard from "@/components/CoachSummaryCard";
import { bcctColors } from "@/styles/bcctTheme";

export default function HomeScreen() {
  const theme = useTheme();

  return (
    <ScrollView
      style={[styles.scroll, { backgroundColor: theme.colors.background }]}
      contentContainerStyle={styles.content}
    >
      <View style={styles.header}>
        <Text style={[styles.greeting, { color: theme.colors.text }]}>
          Welkom terug
        </Text>
        <Text style={[styles.subtitle, { color: bcctColors.textSecondary }]}>
          Hier is je overzicht
        </Text>
      </View>

      <CoachSummaryCard />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
  },
  content: {
    paddingTop: 24,
    paddingBottom: 100,
  },
  header: {
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  greeting: {
    fontSize: 26,
    fontWeight: "700",
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 15,
  },
});
