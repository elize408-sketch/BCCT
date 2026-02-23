
import React from "react";
import { View, StyleSheet, Platform } from "react-native";
import { Tabs } from "expo-router";
import { IconSymbol } from "@/components/IconSymbol";
import { bcctColors } from "@/styles/bcctTheme";
import { useTheme } from "@react-navigation/native";
import { BlurView } from "expo-blur";

export default function CoachLayout() {
  const { colors, dark } = useTheme();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: "#FFFFFF",
        tabBarInactiveTintColor: "#8E8E93",
        tabBarStyle: {
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
          height: 80,
          borderTopWidth: 1,
          borderTopColor: colors.border,
          backgroundColor: dark ? "rgba(28, 28, 30, 0.95)" : "rgba(255, 255, 255, 0.95)",
          ...Platform.select({
            ios: {
              shadowColor: "#000",
              shadowOffset: { width: 0, height: -2 },
              shadowOpacity: 0.1,
              shadowRadius: 8,
            },
            android: {
              elevation: 8,
            },
          }),
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: "500",
          marginTop: 4,
        },
        tabBarItemStyle: {
          paddingVertical: 8,
        },
        tabBarBackground: () => (
          Platform.OS === 'ios' ? (
            <BlurView
              intensity={80}
              style={StyleSheet.absoluteFill}
            />
          ) : null
        ),
        tabBarIconStyle: {
          marginTop: 4,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Home",
          tabBarIcon: ({ color, focused }) => (
            <View style={[
              styles.iconContainer,
              focused && { backgroundColor: bcctColors.primaryOrange }
            ]}>
              <IconSymbol
                ios_icon_name="house.fill"
                android_material_icon_name="home"
                size={24}
                color={focused ? "#FFFFFF" : color}
              />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="clients"
        options={{
          title: "Cliënten",
          tabBarIcon: ({ color, focused }) => (
            <View style={[
              styles.iconContainer,
              focused && { backgroundColor: bcctColors.primaryOrange }
            ]}>
              <IconSymbol
                ios_icon_name="person.2.fill"
                android_material_icon_name="group"
                size={24}
                color={focused ? "#FFFFFF" : color}
              />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="modules"
        options={{
          title: "Modules",
          tabBarIcon: ({ color, focused }) => (
            <View style={[
              styles.iconContainer,
              focused && { backgroundColor: bcctColors.primaryOrange }
            ]}>
              <IconSymbol
                ios_icon_name="folder.fill"
                android_material_icon_name="folder"
                size={24}
                color={focused ? "#FFFFFF" : color}
              />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="appointments"
        options={{
          title: "Afspraken",
          tabBarIcon: ({ color, focused }) => (
            <View style={[
              styles.iconContainer,
              focused && { backgroundColor: bcctColors.primaryOrange }
            ]}>
              <IconSymbol
                ios_icon_name="calendar"
                android_material_icon_name="event"
                size={24}
                color={focused ? "#FFFFFF" : color}
              />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: "Profiel",
          tabBarIcon: ({ color, focused }) => (
            <View style={[
              styles.iconContainer,
              focused && { backgroundColor: bcctColors.primaryOrange }
            ]}>
              <IconSymbol
                ios_icon_name="person.fill"
                android_material_icon_name="person"
                size={24}
                color={focused ? "#FFFFFF" : color}
              />
            </View>
          ),
        }}
      />
      {/* Hidden screens that shouldn't appear in tabs */}
      <Tabs.Screen
        name="theme-detail"
        options={{
          href: null, // Hide from tab bar
        }}
      />
      <Tabs.Screen
        name="client-detail"
        options={{
          href: null, // Hide from tab bar
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
  },
});
