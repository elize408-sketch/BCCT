
import { Platform } from "react-native";

/**
 * Typography configuration using system fonts
 * This ensures the app works reliably across iOS, Android, and Web
 * without requiring custom font loading that can cause crashes
 */
export const typography = {
  // Font families
  heading: Platform.select({
    ios: "System",
    android: "Roboto",
    default: "System",
  }),
  body: Platform.select({
    ios: "System",
    android: "Roboto",
    default: "System",
  }),
  mono: Platform.select({
    ios: "Menlo",
    android: "monospace",
    default: "monospace",
  }),
  
  // Font weights
  weights: {
    regular: "400" as const,
    medium: "500" as const,
    semibold: "600" as const,
    bold: "700" as const,
  },
};

/**
 * Typography scale using system fonts
 * Replaces Baloo and Poppins with reliable system fonts
 */
export const bcctTypography = {
  // Headings (previously Baloo)
  h1: {
    fontFamily: typography.heading,
    fontSize: 32,
    lineHeight: 40,
    fontWeight: typography.weights.bold,
  },
  h2: {
    fontFamily: typography.heading,
    fontSize: 24,
    lineHeight: 32,
    fontWeight: typography.weights.bold,
  },
  h3: {
    fontFamily: typography.heading,
    fontSize: 20,
    lineHeight: 28,
    fontWeight: typography.weights.semibold,
  },
  button: {
    fontFamily: typography.heading,
    fontSize: 16,
    lineHeight: 24,
    fontWeight: typography.weights.semibold,
  },
  
  // Body text (previously Poppins)
  body: {
    fontFamily: typography.body,
    fontSize: 16,
    lineHeight: 24,
    fontWeight: typography.weights.regular,
  },
  bodyMedium: {
    fontFamily: typography.body,
    fontSize: 16,
    lineHeight: 24,
    fontWeight: typography.weights.medium,
  },
  bodySemiBold: {
    fontFamily: typography.body,
    fontSize: 16,
    lineHeight: 24,
    fontWeight: typography.weights.semibold,
  },
  small: {
    fontFamily: typography.body,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: typography.weights.regular,
  },
  smallMedium: {
    fontFamily: typography.body,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: typography.weights.medium,
  },
  label: {
    fontFamily: typography.body,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: typography.weights.medium,
  },
};
