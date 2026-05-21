
// NOTE: This component uploads to the 'avatars' Supabase Storage bucket.
// Ensure the bucket named 'avatars' exists in your Supabase project with public access enabled.

import React, { useState } from 'react';
import {
  View,
  Image,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { decode } from 'base64-arraybuffer';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';

interface Props {
  avatarUrl: string | null;
  userId: string;
  size?: number;
  onUploaded: (url: string) => void;
}

export function AvatarUpload({ avatarUrl, userId, size = 90, onUploaded }: Props) {
  const [uploading, setUploading] = useState(false);
  const [localUri, setLocalUri] = useState<string | null>(null);

  const displayUrl = localUri ?? avatarUrl;

  const pickAndUpload = async () => {
    console.log('[AvatarUpload] Pick and upload triggered for userId:', userId);
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Toestemming vereist', 'Geef toegang tot je fotobibliotheek om een profielfoto te kiezen.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.7,
      });

      if (result.canceled || !result.assets?.[0]) {
        console.log('[AvatarUpload] Image picker cancelled');
        return;
      }

      const asset = result.assets[0];
      setLocalUri(asset.uri);
      setUploading(true);
      console.log('[AvatarUpload] Uploading image:', asset.uri);

      const ext = asset.uri.split('.').pop()?.toLowerCase() ?? 'jpg';
      const fileName = `${userId}/avatar.${ext}`;
      const contentType = ext === 'png' ? 'image/png' : 'image/jpeg';

      const base64 = await FileSystem.readAsStringAsync(asset.uri, {
        encoding: 'base64' as FileSystem.EncodingType,
      });

      console.log('[AvatarUpload] Uploading to Supabase Storage bucket "avatars", file:', fileName);
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(fileName, decode(base64), {
          contentType,
          upsert: true,
        });

      if (uploadError) throw uploadError;

      console.log('[AvatarUpload] upload complete, filePath:', fileName);

      const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(fileName);
      console.log('[AvatarUpload] publicUrl:', publicUrl);

      // Save the clean URL (no cache-buster) to the DB so it stays stable across sessions
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ avatar_url: publicUrl })
        .eq('id', userId);

      if (updateError) {
        console.error('[AvatarUpload] profile update error:', updateError);
        throw updateError;
      }

      console.log('[AvatarUpload] avatar_url saved to profile');

      // Add cache-buster only for the in-memory display URL so React Native reloads the image
      const displayUrl = `${publicUrl}?t=${Date.now()}`;
      setLocalUri(displayUrl);
      onUploaded(displayUrl);
    } catch (err: any) {
      console.error('[AvatarUpload] error:', err.message);
      Alert.alert('Upload mislukt', 'Probeer het opnieuw.');
      setLocalUri(null);
    } finally {
      setUploading(false);
    }
  };

  const containerStyle = { width: size, height: size, borderRadius: size / 2 };
  const iconSize = size * 0.4;

  return (
    <TouchableOpacity
      onPress={pickAndUpload}
      style={[styles.container, containerStyle]}
      disabled={uploading}
      activeOpacity={0.8}
    >
      {displayUrl ? (
        <Image
          source={{ uri: displayUrl }}
          style={[styles.image, containerStyle]}
        />
      ) : (
        <View style={[styles.placeholder, containerStyle]}>
          <Ionicons name="person-outline" size={iconSize} color="#4A90D9" />
        </View>
      )}
      {uploading ? (
        <View style={[styles.overlay, { borderRadius: size / 2 }]}>
          <ActivityIndicator color="#fff" />
        </View>
      ) : (
        <View style={styles.editBadge}>
          <Ionicons name="camera" size={12} color="#fff" />
        </View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'relative',
  },
  image: {
    resizeMode: 'cover',
  },
  placeholder: {
    backgroundColor: '#EBF4FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  editBadge: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    backgroundColor: '#4A90D9',
    borderRadius: 10,
    width: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#fff',
  },
});
