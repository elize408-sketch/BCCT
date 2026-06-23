import { useEffect } from 'react';
import { useRouter } from 'expo-router';

export default function PaywallScreen() {
  const router = useRouter();
  useEffect(() => {
    console.log('[Paywall] Paywall disabled — redirecting to /(app)/coach');
    router.replace('/(app)/coach');
  }, []);
  return null;
}
