import { View, Text, TextInput, TouchableOpacity, ActivityIndicator, Image, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { useState, useEffect } from 'react';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Google from 'expo-auth-session/providers/google';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import { api } from '@/lib/api';
import { useAuthContext } from '@/lib/auth-context';
import type { Membership } from '@/lib/types';

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

function friendlyError(err: unknown, fallback: string): string {
  const msg = err instanceof Error ? err.message : '';
  if (!msg || msg.toLowerCase().includes('could not connect') || msg.toLowerCase().includes('fetch failed') || msg.toLowerCase().includes('network')) {
    return 'No se pudo conectar con el servidor. Verificá tu conexión.';
  }
  return msg || fallback;
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function LoginScreen() {
  const router = useRouter();
  const { signIn } = useAuthContext();

  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState('');

  const [, response, promptGoogleAsync] = Google.useAuthRequest({
    iosClientId: iosClientId ?? '',
    androidClientId: androidClientId ?? '',
    webClientId: webClientId ?? '',
    clientId: iosClientId ?? androidClientId ?? webClientId ?? '',
  });

  useEffect(() => {
    if (response?.type !== 'success') return;
    const accessToken = response.authentication?.accessToken;
    if (!accessToken) {
      setError('No se pudo obtener el token de Google');
      return;
    }
    void handleGoogleLogin(accessToken);
  }, [response]);

  function switchMode(next: 'login' | 'signup') {
    setMode(next);
    setError('');
    setName('');
    setPassword('');
  }

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
        await signIn(res.access_token);
        router.replace('/(auth)/select-tenant');
        return;
      }
      await signIn(res.access_token);
    } catch (err) {
      setError(friendlyError(err, 'Error al iniciar sesión'));
    } finally {
      setLoading(false);
    }
  }

  async function handleSignup() {
    if (!name.trim() || !email.trim() || !password) return;
    setLoading(true);
    setError('');
    try {
      const res = await api.post<LoginResponse>('/auth/signup', {
        name: name.trim(),
        email: email.trim(),
        password,
      });
      await signIn(res.access_token);
    } catch (err) {
      setError(friendlyError(err, 'Error al crear la cuenta'));
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
        await signIn(res.access_token);
        router.replace('/(auth)/select-tenant');
        return;
      }
      await signIn(res.access_token);
    } catch (err) {
      setError(friendlyError(err, 'Error al iniciar sesión con Google'));
    } finally {
      setGoogleLoading(false);
    }
  }

  async function handleGooglePress() {
    if (isExpoGo) {
      setError(
        'Google login no está disponible en Expo Go. Usá email y contraseña, o creá un development build con: eas build --profile development --platform ios',
      );
      return;
    }
    try {
      await promptGoogleAsync();
    } catch (err) {
      setError('No se pudo iniciar sesión con Google. Intentá de nuevo.');
    }
  }

  const isSignup = mode === 'signup';

  return (
    <SafeAreaView className="flex-1 bg-white">
      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={{ flexGrow: 1 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Logo */}
          <View className="items-center justify-center pt-16 pb-10">
            <Image
              source={require('../../../assets/images/marca1.png')}
              style={{ width: 200, height: 200 }}
              resizeMode="contain"
            />
          </View>

          {/* Form */}
          <View className="flex-1 px-6">
            <Text className="text-2xl font-bold text-gray-900 mb-1">
              {isSignup ? 'Crear cuenta' : 'Bienvenido'}
            </Text>
            <Text className="text-sm text-gray-400 mb-8">
              {isSignup
                ? 'Completá tus datos para registrarte'
                : 'Ingresá a tu cuenta para continuar'}
            </Text>

            <View className="gap-4">
              {isSignup && (
                <View>
                  <Text className="text-sm font-medium text-gray-700 mb-1.5">Nombre</Text>
                  <TextInput
                    className="border border-gray-200 rounded-xl px-4 py-3.5 text-gray-900 bg-gray-50 text-base"
                    placeholder="Tu nombre"
                    placeholderTextColor="#9CA3AF"
                    value={name}
                    onChangeText={setName}
                    autoCapitalize="words"
                    autoComplete="name"
                  />
                </View>
              )}

              <View>
                <Text className="text-sm font-medium text-gray-700 mb-1.5">Email</Text>
                <TextInput
                  className="border border-gray-200 rounded-xl px-4 py-3.5 text-gray-900 bg-gray-50 text-base"
                  placeholder="tu@email.com"
                  placeholderTextColor="#9CA3AF"
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
                  className="border border-gray-200 rounded-xl px-4 py-3.5 text-gray-900 bg-gray-50 text-base"
                  placeholder="••••••••"
                  placeholderTextColor="#9CA3AF"
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry
                  autoComplete={isSignup ? 'new-password' : 'password'}
                />
              </View>

              {error ? (
                <View className="bg-red-50 border border-red-200 rounded-xl px-4 py-3">
                  <Text className="text-sm text-red-600">{error}</Text>
                </View>
              ) : null}

              <TouchableOpacity
                className="bg-blue-500 rounded-xl py-4 items-center mt-1"
                onPress={() => void (isSignup ? handleSignup() : handleLogin())}
                disabled={loading || googleLoading}
                activeOpacity={0.85}
              >
                {loading ? (
                  <ActivityIndicator color="white" />
                ) : (
                  <Text className="text-white font-semibold text-base">
                    {isSignup ? 'Crear cuenta' : 'Ingresar'}
                  </Text>
                )}
              </TouchableOpacity>

              {/* Mode toggle */}
              <TouchableOpacity
                onPress={() => switchMode(isSignup ? 'login' : 'signup')}
                disabled={loading || googleLoading}
                className="items-center py-2"
                activeOpacity={0.7}
              >
                <Text className="text-sm text-gray-500">
                  {isSignup ? '¿Ya tenés cuenta? ' : '¿No tenés cuenta? '}
                  <Text className="text-blue-500 font-semibold">
                    {isSignup ? 'Ingresar' : 'Crear cuenta'}
                  </Text>
                </Text>
              </TouchableOpacity>

              {!isSignup && googleEnabled && (
                <>
                  <View className="flex-row items-center gap-3 my-1">
                    <View className="flex-1 h-px bg-gray-200" />
                    <Text className="text-xs text-gray-400">o</Text>
                    <View className="flex-1 h-px bg-gray-200" />
                  </View>

                  <TouchableOpacity
                    className={`border rounded-xl py-4 flex-row items-center justify-center gap-2.5 ${
                      isExpoGo ? 'border-gray-100 bg-gray-50' : 'border-gray-200 bg-white'
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
                            fontSize: 16,
                            fontWeight: '700',
                            color: isExpoGo ? '#9CA3AF' : '#4285F4',
                            lineHeight: 20,
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

            <View className="h-8" />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
