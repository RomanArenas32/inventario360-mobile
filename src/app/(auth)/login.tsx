import { View, Text, TextInput, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useState, useEffect } from 'react';
import { useRouter } from 'expo-router';
import * as Google from 'expo-auth-session/providers/google';
import * as WebBrowser from 'expo-web-browser';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import { api } from '@/lib/api';
import { useAuthContext } from '@/lib/auth-context';
import type { Membership } from '@/lib/types';

// Required for expo-auth-session to complete the redirect on iOS/Android
WebBrowser.maybeCompleteAuthSession();

type LoginResponse = {
  access_token: string;
  memberships: Membership[];
};

// En Expo Go (storeClient) Google OAuth no puede funcionar porque
// Google rechaza el redirect URI exp:// que usa el simulador.
// Se necesita un development build o production build.
const isExpoGo =
  Constants.executionEnvironment === ExecutionEnvironment.StoreClient;

const iosClientId = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID || undefined;
const androidClientId = process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID || undefined;
const webClientId = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID || undefined;

const googleEnabled = !!(iosClientId || androidClientId || webClientId);

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function LoginScreen() {
  const router = useRouter();
  const { signIn } = useAuthContext();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState('');

  const [, response, promptGoogleAsync] = Google.useAuthRequest(
    {
      iosClientId,
      androidClientId,
      webClientId,
      // clientId como fallback cuando no hay platform-specific ID configurado
      clientId: iosClientId ?? androidClientId ?? webClientId,
    },
    { preferLocalhost: true },
  );

  useEffect(() => {
    if (response?.type !== 'success') return;
    const accessToken = response.authentication?.accessToken;
    if (!accessToken) {
      setError('No se pudo obtener el token de Google');
      return;
    }
    void handleGoogleLogin(accessToken);
  }, [response]);

  async function handleLogin() {
    if (!email.trim() || !password) return;
    setLoading(true);
    setError('');
    try {
      const res = await api.post<LoginResponse>('/auth/login', {
        email: email.trim(),
        password,
      });
      if (res.memberships.length > 1) {
        signIn(res.access_token);
        router.replace('/(auth)/select-tenant');
        return;
      }
      signIn(res.access_token);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al iniciar sesión');
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogleLogin(accessToken: string) {
    setGoogleLoading(true);
    setError('');
    try {
      const res = await api.post<LoginResponse>('/auth/google/mobile', { accessToken });
      if (res.memberships.length > 1) {
        signIn(res.access_token);
        router.replace('/(auth)/select-tenant');
        return;
      }
      signIn(res.access_token);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al iniciar sesión con Google');
    } finally {
      setGoogleLoading(false);
    }
  }

  function handleGooglePress() {
    if (isExpoGo) {
      setError(
        'Google login no está disponible en Expo Go. Usá email y contraseña, o creá un development build con: eas build --profile development --platform ios',
      );
      return;
    }
    void promptGoogleAsync();
  }

  return (
    <View className="flex-1 bg-white justify-center px-6">
      <Text className="text-3xl font-bold text-gray-900 mb-2">Inventario360</Text>
      <Text className="text-gray-500 mb-8">Ingresá a tu cuenta</Text>

      <View className="gap-4">
        <View>
          <Text className="text-sm font-medium text-gray-700 mb-1.5">Email</Text>
          <TextInput
            className="border border-gray-200 rounded-xl px-4 py-3 text-gray-900 bg-gray-50"
            placeholder="tu@email.com"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            autoComplete="email"
          />
        </View>

        <View>
          <Text className="text-sm font-medium text-gray-700 mb-1.5">Contraseña</Text>
          <TextInput
            className="border border-gray-200 rounded-xl px-4 py-3 text-gray-900 bg-gray-50"
            placeholder="••••••••"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoComplete="password"
          />
        </View>

        {error ? (
          <View className="bg-red-50 border border-red-200 rounded-xl px-4 py-3">
            <Text className="text-sm text-red-600">{error}</Text>
          </View>
        ) : null}

        <TouchableOpacity
          className="bg-primary rounded-xl py-3.5 items-center mt-2"
          onPress={() => void handleLogin()}
          disabled={loading || googleLoading}
          activeOpacity={0.85}
        >
          {loading ? (
            <ActivityIndicator color="white" />
          ) : (
            <Text className="text-white font-semibold text-base">Ingresar</Text>
          )}
        </TouchableOpacity>

        {googleEnabled && (
          <>
            <View className="flex-row items-center gap-3 my-1">
              <View className="flex-1 h-px bg-gray-200" />
              <Text className="text-xs text-gray-400">o</Text>
              <View className="flex-1 h-px bg-gray-200" />
            </View>

            <TouchableOpacity
              className={`border rounded-xl py-3.5 flex-row items-center justify-center gap-2 ${
                isExpoGo
                  ? 'border-gray-100 bg-gray-50'
                  : 'border-gray-200 bg-white'
              }`}
              onPress={handleGooglePress}
              disabled={loading || googleLoading}
              activeOpacity={0.8}
            >
              {googleLoading ? (
                <ActivityIndicator size="small" color="#4285F4" />
              ) : (
                <>
                  <Text
                    style={{
                      fontSize: 15,
                      fontWeight: '700',
                      color: isExpoGo ? '#9CA3AF' : '#4285F4',
                      lineHeight: 18,
                    }}
                  >
                    G
                  </Text>
                  <Text
                    className={`font-semibold text-base ${
                      isExpoGo ? 'text-gray-400' : 'text-gray-700'
                    }`}
                  >
                    Continuar con Google
                    {isExpoGo ? ' (dev build requerido)' : ''}
                  </Text>
                </>
              )}
            </TouchableOpacity>
          </>
        )}
      </View>
    </View>
  );
}
