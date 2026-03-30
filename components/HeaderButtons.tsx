import React from "react";
import { Pressable, StyleSheet, Alert, View } from "react-native";
import { IconSymbol } from "@/components/IconSymbol";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "@react-navigation/native";

interface HeaderRightButtonProps {
  onTipsPress?: () => void;
}

export function HeaderRightButton({ onTipsPress }: HeaderRightButtonProps) {
  const theme = useTheme();

  const handleAvatarPress = () => {
    console.log("[HeaderButtons] User avatar pressed");
    Alert.alert("Not Implemented", "This feature is not implemented yet");
  };

  const handleTipsPress = () => {
    console.log("[HeaderButtons] Tips lightbulb icon pressed");
    onTipsPress?.();
  };

  return (
    <View style={styles.rightGroup}>
      <Pressable onPress={handleTipsPress} style={styles.headerButtonContainer}>
        <Ionicons name="bulb-outline" size={22} color={theme.colors.primary} />
      </Pressable>
      <Pressable onPress={handleAvatarPress} style={styles.headerButtonContainer}>
        <IconSymbol ios_icon_name="plus" android_material_icon_name="add" color={theme.colors.primary} />
      </Pressable>
    </View>
  );
}

export function HeaderLeftButton() {
  const theme = useTheme();

  return (
    <Pressable
      onPress={() => Alert.alert("Not Implemented", "This feature is not implemented yet")}
      style={styles.headerButtonContainer}
    >
      <IconSymbol ios_icon_name="gear" android_material_icon_name="settings" color={theme.colors.primary} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  rightGroup: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  headerButtonContainer: {
    padding: 6,
  },
});
