import { Stack } from 'expo-router';
import { bcctColors } from '@/styles/bcctTheme';

export default function ChatLayout() {
  return (
    <Stack
      screenOptions={{
        headerBackButtonDisplayMode: 'minimal',
        headerStyle: { backgroundColor: '#FFFFFF' },
        headerTintColor: bcctColors.primaryOrange,
        headerTitleStyle: {
          fontWeight: '600',
          color: bcctColors.textPrimary,
        },
        headerShadowVisible: true,
      }}
    />
  );
}
