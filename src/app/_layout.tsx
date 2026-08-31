import '../global.css';
import { useEffect } from 'react';
import { AppState } from 'react-native';
import * as WebBrowser from 'expo-web-browser';

WebBrowser.maybeCompleteAuthSession();
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
  const { isReady, isAuthed, activeTenantId, user } = useAuthContext();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (!isReady) return;
    void SplashScreen.hideAsync();

    const inAuth = segments[0] === '(auth)' || segments[0] === 'oauthredirect';
    const inOnboarding = segments[0] === '(auth)' && segments[1] === 'onboarding';
    const inSelectTenant = segments[0] === '(auth)' && segments[1] === 'select-tenant';
    const hasTenant = (user?.tenants.length ?? 0) > 0;

    if (!isAuthed) {
      router.replace('/(auth)/login');
    } else if (isAuthed && user !== null && !hasTenant && !inOnboarding) {
      router.replace('/(auth)/onboarding');
    } else if (isAuthed && hasTenant && !activeTenantId && !inSelectTenant) {
      router.replace('/(auth)/select-tenant');
    } else if (isAuthed && hasTenant && activeTenantId && inAuth) {
      router.replace('/(app)');
    } else if (isAuthed && !inAuth) {
      void registerPushToken();
    }
  }, [isReady, isAuthed, activeTenantId, user, segments]);

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
