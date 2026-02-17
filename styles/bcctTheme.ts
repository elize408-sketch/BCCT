
import { Theme } from '@react-navigation/native';

// Connected Coaching & Training Brand Colors
export const bcctColors = {
  // Primary brand colors
  primaryBlue: '#243B5A',
  gradientTeal: '#2F8F8B',
  gradientGreen: '#4BAF7A',
  accentOrange: '#F59E0B',
  
  // Backgrounds
  lightBackground: '#F7F9FC',
  cardBackground: '#FFFFFF',
  
  // Borders & Subtle
  borderGray: '#E6EAF0',
  
  // Text
  textPrimary: '#1F2937',
  textSecondary: '#6B7280',
  
  // Status colors
  error: '#EF4444',
  success: '#22C55E',
};

// Typography scale
export const bcctTypography = {
  // Baloo (Headings)
  h1: {
    fontFamily: 'Baloo2_700Bold',
    fontSize: 32,
    lineHeight: 40,
  },
  h2: {
    fontFamily: 'Baloo2_700Bold',
    fontSize: 24,
    lineHeight: 32,
  },
  h3: {
    fontFamily: 'Baloo2_600SemiBold',
    fontSize: 20,
    lineHeight: 28,
  },
  button: {
    fontFamily: 'Baloo2_600SemiBold',
    fontSize: 16,
    lineHeight: 24,
  },
  
  // Poppins (Body)
  body: {
    fontFamily: 'Poppins_400Regular',
    fontSize: 16,
    lineHeight: 24,
  },
  bodyMedium: {
    fontFamily: 'Poppins_500Medium',
    fontSize: 16,
    lineHeight: 24,
  },
  bodySemiBold: {
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 16,
    lineHeight: 24,
  },
  small: {
    fontFamily: 'Poppins_400Regular',
    fontSize: 14,
    lineHeight: 20,
  },
  smallMedium: {
    fontFamily: 'Poppins_500Medium',
    fontSize: 14,
    lineHeight: 20,
  },
  label: {
    fontFamily: 'Poppins_500Medium',
    fontSize: 14,
    lineHeight: 20,
  },
};

// Light theme for Connected Coaching & Training
export const BCCTLightTheme: Theme = {
  dark: false,
  colors: {
    primary: bcctColors.primaryBlue,
    background: bcctColors.lightBackground,
    card: bcctColors.cardBackground,
    text: bcctColors.textPrimary,
    border: bcctColors.borderGray,
    notification: bcctColors.error,
  },
};

// Dark theme for Connected Coaching & Training
export const BCCTDarkTheme: Theme = {
  dark: true,
  colors: {
    primary: bcctColors.gradientTeal,
    background: '#1F2937',
    card: '#374151',
    text: '#F9FAFB',
    border: '#4B5563',
    notification: bcctColors.error,
  },
};

// Helper function to get slider color based on value and type
export const getSliderColor = (value: number, type: 'energy' | 'stress' | 'sleep') => {
  if (type === 'stress') {
    // Stress: 0 = green (good), 100 = red (bad)
    if (value <= 33) return bcctColors.success;
    if (value <= 66) return bcctColors.accentOrange;
    return bcctColors.error;
  } else {
    // Energy & Sleep: 0 = red (bad), 100 = green (good)
    if (value <= 33) return bcctColors.error;
    if (value <= 66) return bcctColors.accentOrange;
    return bcctColors.success;
  }
};

// Helper function to get text labels for sliders
export const getStressLabel = (value: number) => {
  if (value <= 33) return 'Rustig';
  if (value <= 66) return 'Spanning';
  return 'Hoog';
};

export const getSleepLabel = (value: number) => {
  if (value <= 33) return 'Slecht';
  if (value <= 66) return 'Oké';
  return 'Goed';
};

export const getEnergyLabel = (value: number) => {
  if (value <= 33) return 'Laag';
  if (value <= 66) return 'Gemiddeld';
  return 'Hoog';
};
