import {
  View, Text, TouchableOpacity, ScrollView, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Building2, ChevronRight } from 'lucide-react-native';
import { api } from '@/lib/api';
import { useAuthContext } from '@/lib/auth-context';

type MeResponse = {
  tenants: { id: string; name: string; role: 'owner' | 'staff' }[];
};

const AVATAR_COLORS = [
  { bg: 'bg-blue-100',   text: 'text-blue-600'   },
  { bg: 'bg-violet-100', text: 'text-violet-600'  },
  { bg: 'bg-emerald-100',text: 'text-emerald-600' },
  { bg: 'bg-amber-100',  text: 'text-amber-600'   },
  { bg: 'bg-rose-100',   text: 'text-rose-600'    },
];

function getColor(index: number) {
  return AVATAR_COLORS[index % AVATAR_COLORS.length]!;
}

function getInitials(name: string) {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return (parts[0] ?? '').slice(0, 2).toUpperCase();
  return ((parts[0]?.[0] ?? '') + (parts[parts.length - 1]?.[0] ?? '')).toUpperCase();
}

export default function SelectTenantScreen() {
  const { signIn } = useAuthContext();
  const [selecting, setSelecting] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['me-tenants'],
    queryFn: () => api.get<MeResponse>('/auth/me'),
  });

  const tenants = data?.tenants ?? [];

  async function handleSelect(tenantId: string) {
    if (selecting) return;
    setSelecting(tenantId);
    try {
      const res = await api.post<{ access_token: string }>('/auth/switch-tenant', { tenantId });
      await signIn(res.access_token);
    } finally {
      setSelecting(null);
    }
  }

  return (
    <SafeAreaView className="flex-1 bg-gray-50">
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingHorizontal: 24, paddingTop: 48, paddingBottom: 32 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Header icon */}
        <View className="w-14 h-14 rounded-2xl bg-blue-100 items-center justify-center mb-6">
          <Building2 size={26} color="#208AEF" />
        </View>

        <Text className="text-3xl font-bold text-gray-900 mb-2">
          ¿A qué negocio entrás?
        </Text>
        <Text className="text-base text-gray-400 mb-10">
          Tu cuenta tiene acceso a varios negocios.
        </Text>

        {isLoading ? (
          <View className="items-center py-12">
            <ActivityIndicator size="large" color="#208AEF" />
          </View>
        ) : (
          <View className="gap-3">
            {tenants.map((t, i) => {
              const color = getColor(i);
              const isSelecting = selecting === t.id;
              const disabled = !!selecting;

              return (
                <TouchableOpacity
                  key={t.id}
                  onPress={() => void handleSelect(t.id)}
                  disabled={disabled}
                  activeOpacity={0.75}
                  className={`bg-white rounded-2xl px-4 py-4 flex-row items-center shadow-sm border border-gray-100 ${
                    disabled && !isSelecting ? 'opacity-50' : ''
                  }`}
                >
                  {/* Avatar */}
                  <View className={`w-12 h-12 rounded-xl ${color.bg} items-center justify-center mr-4`}>
                    <Text className={`text-base font-bold ${color.text}`}>
                      {getInitials(t.name)}
                    </Text>
                  </View>

                  {/* Info */}
                  <View className="flex-1">
                    <Text className="text-base font-semibold text-gray-900" numberOfLines={1}>
                      {t.name}
                    </Text>
                    <View className="flex-row items-center mt-1">
                      <View className={`px-2 py-0.5 rounded-full ${
                        t.role === 'owner' ? 'bg-blue-50' : 'bg-gray-100'
                      }`}>
                        <Text className={`text-xs font-medium ${
                          t.role === 'owner' ? 'text-blue-600' : 'text-gray-500'
                        }`}>
                          {t.role === 'owner' ? 'Dueño' : 'Empleado'}
                        </Text>
                      </View>
                    </View>
                  </View>

                  {/* Action */}
                  {isSelecting ? (
                    <ActivityIndicator size="small" color="#208AEF" />
                  ) : (
                    <ChevronRight size={18} color="#D1D5DB" />
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        <Text className="text-center text-xs text-gray-300 mt-10">
          Podés cambiar de negocio en cualquier momento desde tu perfil.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}
