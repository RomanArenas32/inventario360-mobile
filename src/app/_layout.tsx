import '../global.css';
import { useEffect } from 'react';
import { AppState } from 'react-native';
import { Stack, useRouter, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { QueryClient, QueryClientProvider, focusManager } from '@tanstack/react-query';
import { StatusBar } from 'expo-status-bar';
import { AuthProvider, useAuthContext } from '@/lib/auth-context';
import { registerPushToken } from '@/lib/push-notifications';

SplashScreen.preventAutoHideAsync();

// Integrar AppState con TanStack Query para refetch al volver al app
AppState.addEventListener('change', (state) => {
  focusManager.setFocused(state === 'active');
});

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 30_000,
    },
  },
});

function AuthGate() {
  const { isReady, isAuthed } = useAuthContext();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (!isReady) return;
    void SplashScreen.hideAsync();

    const inAuth = segments[0] === '(auth)';
    if (!isAuthed && !inAuth) {
      router.replace('/(auth)/login');
    } else if (isAuthed && inAuth) {
      router.replace('/(app)');
    } else if (isAuthed && !inAuth) {
      void registerPushToken();
    }
  }, [isReady, isAuthed, segments]);

  if (!isReady) return null;

  return (
    <>
      <StatusBar style="auto" />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(app)" />
        <Stack.Screen name="(modals)" options={{ presentation: 'modal' }} />
      </Stack>
    </>
  );
}

export default function RootLayout() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <AuthGate />
      </AuthProvider>
    </QueryClientProvider>
  );
}
