import { Stack } from 'expo-router';
import { bcctColors } from '@/styles/bcctTheme';

export default function ChatStackLayout() {
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
    >
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="[id]" />
    </Stack>
  );
}
