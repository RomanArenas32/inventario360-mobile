import { View, Text, TouchableOpacity, ScrollView, ActivityIndicator } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useAuthContext } from '@/lib/auth-context';

type MeResponse = {
  tenants: { id: string; name: string; role: 'owner' | 'staff' }[];
};

export default function SelectTenantScreen() {
  const { signIn } = useAuthContext();

  const { data, isLoading } = useQuery({
    queryKey: ['me-tenants'],
    queryFn: () => api.get<MeResponse>('/auth/me'),
  });

  const tenants = data?.tenants ?? [];

  async function handleSelect(tenantId: string) {
    const res = await api.post<{ access_token: string }>('/auth/switch-tenant', { tenantId });
    signIn(res.access_token);
  }

  return (
    <View className="flex-1 bg-white px-6 pt-16">
      <Text className="text-2xl font-bold text-gray-900 mb-2">Elegí tu negocio</Text>
      <Text className="text-gray-500 mb-8">Tu cuenta tiene acceso a varios negocios.</Text>

      {isLoading ? (
        <ActivityIndicator color="#208AEF" />
      ) : (
        <ScrollView className="gap-3">
          {tenants.map((t) => (
            <TouchableOpacity
              key={t.id}
              className="border border-gray-200 rounded-xl px-4 py-4 flex-row items-center justify-between mb-3"
              onPress={() => void handleSelect(t.id)}
            >
              <View>
                <Text className="font-semibold text-gray-900">{t.name}</Text>
                <Text className="text-sm text-gray-500 mt-0.5">
                  {t.role === 'owner' ? 'Dueño' : 'Empleado'}
                </Text>
              </View>
              <Text className="text-gray-400 text-lg">›</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}
    </View>
  );
}
