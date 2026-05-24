import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { bcctColors } from '@/styles/bcctTheme';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';

interface Props {
  onConnected: () => void;
}

export default function CoachConnectCard({ onConnected }: Props) {
  const { user } = useAuth();
  const [code, setCode] = useState('');
  const [focused, setFocused] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  console.log('[CoachConnectCard] Render — code:', code, 'loading:', loading);

  const handleChangeCode = (text: string) => {
    const uppercased = text.toUpperCase().replace(/\s/g, '');
    setCode(uppercased);
    if (error) setError('');
  };

  const handleConnect = async () => {
    console.log('[CoachConnectCard] "Coach koppelen" pressed — code:', code);

    const trimmed = code.trim().toUpperCase();

    if (!trimmed) {
      setError('Voer een coachcode in');
      return;
    }

    if (!user) {
      setError('Niet ingelogd');
      return;
    }

    setLoading(true);
    setError('');

    try {
      console.log('[CoachConnectCard] Calling link_client_to_coach_by_code RPC with code:', trimmed);
      const { data, error: rpcError } = await supabase.rpc('link_client_to_coach_by_code', {
        p_code: trimmed,
      });

      console.log('[CoachConnectCard] RPC result — data:', data, 'error:', rpcError);

      if (rpcError) {
        console.error('[CoachConnectCard] RPC error:', rpcError);
        setError('Kon niet koppelen, probeer opnieuw');
        return;
      }

      // RPC returns jsonb: { success: boolean, message: string, coach_name?: string, ... }
      const result = (data ?? {}) as {
        success?: boolean;
        message?: string;
        coach_name?: string | null;
        already_linked?: boolean;
      };

      if (!result.success) {
        console.warn('[CoachConnectCard] Link failed:', result.message);
        setError(result.message || 'Kon niet koppelen');
        return;
      }

      const coachName = result.coach_name ?? 'je coach';
      console.log('[CoachConnectCard] Success — linked to coach:', coachName);

      Alert.alert(
        'Gekoppeld!',
        `Je bent gekoppeld aan ${coachName}.`,
        [{ text: 'OK', onPress: onConnected }],
      );
    } finally {
      setLoading(false);
    }
  };

  const handleNoCode = () => {
    console.log('[CoachConnectCard] "Nog geen coachcode ontvangen?" pressed');
    Alert.alert(
      'Geen coachcode',
      "Vraag je coach naar zijn/haar persoonlijke coachcode. Deze vind je in zijn/haar app onder 'Cliënten'.",
    );
  };

  const inputBorderColor = error
    ? '#D32F2F'
    : focused
    ? bcctColors.primaryOrange
    : '#E5E5EA';

  const buttonOpacity = loading ? 0.7 : 1;

  return (
    <View style={styles.card}>
      {/* Icon accent */}
      <View style={styles.iconCircle}>
        <Ionicons name="link" size={24} color={bcctColors.primaryOrange} />
      </View>

      <Text style={styles.title}>Koppel je coach</Text>
      <Text style={styles.subtitle}>
        Voer de coachcode in die je van je coach hebt ontvangen.
      </Text>

      {/* Input */}
      <TextInput
        style={[styles.input, { borderColor: inputBorderColor }]}
        placeholder="Bijv. COACHINGBYE-1D77EF"
        placeholderTextColor="#AEAEB2"
        value={code}
        onChangeText={handleChangeCode}
        autoCapitalize="characters"
        autoCorrect={false}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        editable={!loading}
      />

      {error ? <Text style={styles.errorText}>{error}</Text> : null}

      {/* Primary button */}
      <TouchableOpacity
        style={[styles.primaryButton, { opacity: buttonOpacity }]}
        onPress={handleConnect}
        disabled={loading}
        activeOpacity={0.85}
      >
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.primaryButtonText}>Coach koppelen</Text>
        )}
      </TouchableOpacity>

      {/* Secondary link */}
      <TouchableOpacity onPress={handleNoCode} style={styles.secondaryLink} activeOpacity={0.7}>
        <Text style={styles.secondaryLinkText}>Nog geen coachcode ontvangen?</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 20,
    marginHorizontal: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#FEF0E0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1a1a1a',
    marginTop: 12,
  },
  subtitle: {
    fontSize: 14,
    color: bcctColors.textSecondary,
    marginTop: 4,
    marginBottom: 16,
    lineHeight: 20,
  },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 14,
    fontSize: 16,
    letterSpacing: 1,
    fontWeight: '600',
    color: '#1a1a1a',
  },
  errorText: {
    color: '#D32F2F',
    fontSize: 13,
    marginTop: 6,
  },
  primaryButton: {
    height: 52,
    backgroundColor: bcctColors.primaryOrange,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 16,
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  secondaryLink: {
    alignItems: 'center',
    padding: 8,
    marginTop: 8,
  },
  secondaryLinkText: {
    color: bcctColors.primaryOrange,
    fontSize: 14,
    fontWeight: '600',
  },
});
