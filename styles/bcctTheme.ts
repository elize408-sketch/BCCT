
import { Theme } from '@react-navigation/native';
import { typography, bcctTypography as typographyScale } from '@/constants/typography';

// Connected Coaching & Training Brand Colors
export const bcctColors = {
  // Primary brand colors - UPDATED TO MATCH BRAND
  primaryOrange: '#F28C28', // Primary brand color
  primaryOrangeDark: '#E67E1F', // Darker orange for gradients
  primaryOrangeLight: '#F4A259', // Lighter orange for links
  primaryOrangeDisabled: '#F4C7A1', // Disabled state
  
  // Legacy colors (keeping for backwards compatibility)
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

// Re-export typography scale for backwards compatibility
export const bcctTypography = typographyScale;

// Extended Theme interface to include fonts property
interface BCCTTheme extends Theme {
  fonts: {
    regular: {
      fontFamily: string;
      fontWeight: 'normal';
    };
    medium: {
      fontFamily: string;
      fontWeight: '500';
    };
    bold: {
      fontFamily: string;
      fontWeight: 'bold';
    };
    heavy: {
      fontFamily: string;
      fontWeight: 'bold';
    };
  };
}

// Light theme for Connected Coaching & Training
export const BCCTLightTheme: BCCTTheme = {
  dark: false,
  colors: {
    primary: bcctColors.primaryOrange,
    background: bcctColors.lightBackground,
    card: bcctColors.cardBackground,
    text: bcctColors.textPrimary,
    border: bcctColors.borderGray,
    notification: bcctColors.error,
  },
  fonts: {
    regular: {
      fontFamily: typography.body,
      fontWeight: 'normal',
    },
    medium: {
      fontFamily: typography.body,
      fontWeight: '500',
    },
    bold: {
      fontFamily: typography.body,
      fontWeight: 'bold',
    },
    heavy: {
      fontFamily: typography.heading,
      fontWeight: 'bold',
    },
  },
};

// Dark theme for Connected Coaching & Training
export const BCCTDarkTheme: BCCTTheme = {
  dark: true,
  colors: {
    primary: bcctColors.primaryOrange,
    background: '#1F2937',
    card: '#374151',
    text: '#F9FAFB',
    border: '#4B5563',
    notification: bcctColors.error,
  },
  fonts: {
    regular: {
      fontFamily: typography.body,
      fontWeight: 'normal',
    },
    medium: {
      fontFamily: typography.body,
      fontWeight: '500',
    },
    bold: {
      fontFamily: typography.body,
      fontWeight: 'bold',
    },
    heavy: {
      fontFamily: typography.heading,
      fontWeight: 'bold',
    },
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
