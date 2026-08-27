import { View, Text, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { CheckCircle } from 'lucide-react-native';
import { api, setToken, getToken, withSuppressUnauthorized } from '@/lib/api';
import { useAuthContext } from '@/lib/auth-context';
import type { Module } from '@/lib/types';

const ALL_MODULES: Module[] = ['products', 'stock', 'sales', 'turns'];

type RegisterTenantResponse = { ok: boolean; access_token: string };

const PLAN_FEATURES = [
  'Gestión de productos e inventario',
  'Registro de ventas',
  'Gestión de turnos',
  'Comparte tu negocio con tu equipo',
  'Hasta 2 usuarios de tu negocio',
];

export default function OnboardingPlanScreen() {
  const { name, modules: modulesParam } = useLocalSearchParams<{ name: string; modules: string }>();
  const selectedModules = modulesParam ? (modulesParam.split(',') as Module[]) : ALL_MODULES;
  const isAllModules = selectedModules.length === ALL_MODULES.length;
  const { signIn, signOut } = useAuthContext();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleStart() {
    setLoading(true);
    setError('');
    try {
      const storedToken = await getToken();
      console.log('[plan] token en SecureStore:', storedToken ? `${storedToken.slice(0, 30)}...` : 'NULL');
      if (!storedToken) {
        setError('Sin sesión activa. Cerrá y volvé a loguearte.');
        return;
      }
      const res = await withSuppressUnauthorized(() =>
        api.post<RegisterTenantResponse>('/auth/register-tenant', { name }),
      );
      // Set token first so the modules PATCH is authenticated
      await setToken(res.access_token);
      if (!isAllModules) {
        await api.patch('/tenants/staff-modules', { modules: selectedModules });
      }
      await signIn(res.access_token);
      // AuthGate detecta hasTenant=true y redirige a (app)
    } catch (err) {
      console.log('[plan] ERROR register-tenant:', err);
      setError(err instanceof Error ? err.message : 'No se pudo crear el negocio');
    } finally {
      setLoading(false);
    }
  }

  return (
    <View className="flex-1 bg-white px-6 pt-20 pb-10">
      <View className="flex-1">
        <View className="w-14 h-14 rounded-2xl bg-blue-100 items-center justify-center mb-6">
          <Text className="text-3xl">🚀</Text>
        </View>

        <Text className="text-3xl font-bold text-gray-900 mb-2">{name}</Text>
        <Text className="text-base text-gray-500 mb-8">
          Tu negocio está listo para arrancar con el plan básico.
        </Text>

        <View className="bg-blue-50 rounded-2xl p-5 mb-4">
          <View className="flex-row items-center justify-between mb-1">
            <Text className="text-lg font-bold text-blue-700">Plan Básico</Text>
            <View className="bg-blue-500 px-2.5 py-1 rounded-full">
              <Text className="text-xs font-semibold text-white">30 días gratis</Text>
            </View>
          </View>
          <Text className="text-sm text-blue-400 mb-4">Sin necesidad de tarjeta de crédito</Text>

          <View className="gap-3">
            {PLAN_FEATURES.map((feature) => (
              <View key={feature} className="flex-row items-center gap-2.5">
                <CheckCircle size={16} color="#3B82F6" />
                <Text className="text-sm text-gray-700">{feature}</Text>
              </View>
            ))}
          </View>
        </View>

        {error ? (
          <View className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 gap-3">
            <Text className="text-sm text-red-600">{error}</Text>
            <TouchableOpacity
              onPress={() => void signOut()}
              className="bg-red-100 border border-red-300 rounded-lg py-2.5 px-4 items-center"
              activeOpacity={0.7}
            >
              <Text className="text-sm font-semibold text-red-700">
                Cerrar sesión e intentar de nuevo
              </Text>
            </TouchableOpacity>
          </View>
        ) : null}
      </View>

      <TouchableOpacity
        onPress={() => void handleStart()}
        disabled={loading}
        className="bg-blue-500 rounded-xl py-4 items-center"
        activeOpacity={0.85}
      >
        {loading ? (
          <ActivityIndicator color="white" />
        ) : (
          <Text className="text-white font-semibold text-base">Empezar ahora</Text>
        )}
      </TouchableOpacity>
    </View>
  );
}
