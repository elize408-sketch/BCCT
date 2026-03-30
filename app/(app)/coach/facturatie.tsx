
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { bcctColors } from '@/styles/bcctTheme';

export default function FacturatieScreen() {
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.emoji}>🧾</Text>
        <Text style={styles.title}>Facturatie</Text>
        <Text style={styles.subtitle}>Binnenkort beschikbaar</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: bcctColors.lightBackground },
  content: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emoji: { fontSize: 48, marginBottom: 16 },
  title: { fontSize: 22, fontWeight: '700', color: bcctColors.textPrimary, marginBottom: 8 },
  subtitle: { fontSize: 15, color: bcctColors.textSecondary },
});
