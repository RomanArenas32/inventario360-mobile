import { View, Text, ScrollView, RefreshControl, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useState, useCallback } from 'react';
import { Package, CheckCircle2, AlertTriangle, Tag, ChevronRight } from 'lucide-react-native';
import { api } from '@/lib/api';
import { useAuthContext } from '@/lib/auth-context';
import type { Product, Category } from '@/lib/types';

// ─── Stat Card ────────────────────────────────────────────────────────────────

type StatCardProps = {
  label: string;
  value: number;
  icon: React.ReactNode;
  iconBg: string;
  valueColor: string;
};

function StatCard({ label, value, icon, iconBg, valueColor }: StatCardProps) {
  return (
    <View className="flex-1 bg-white rounded-2xl p-4 shadow-sm" style={{ minWidth: '45%' }}>
      <View className="flex-row items-start justify-between">
        <View className="flex-1">
          <Text className="text-xs text-gray-400 uppercase tracking-wide font-medium">{label}</Text>
          <Text className={`text-3xl font-bold mt-2 ${valueColor}`}>{value}</Text>
        </View>
        <View className={`p-2 rounded-xl ${iconBg}`}>{icon}</View>
      </View>
    </View>
  );
}

// ─── Low Stock Item ───────────────────────────────────────────────────────────

function LowStockItem({ product, onPress }: { product: Product; onPress: () => void }) {
  return (
    <TouchableOpacity
      className="flex-row items-center justify-between py-3 border-b border-gray-100"
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View className="flex-1">
        <Text className="text-sm font-medium text-gray-900" numberOfLines={1}>
          {product.name}
        </Text>
        <Text className="text-xs text-gray-400 mt-0.5">
          Stock: <Text className="text-amber-500 font-semibold">{product.stock}</Text>
          {' · '}Mínimo: {product.minStock}
        </Text>
      </View>
      <ChevronRight size={14} color="#D1D5DB" />
    </TouchableOpacity>
  );
}

// ─── Dashboard ────────────────────────────────────────────────────────────────

export default function DashboardScreen() {
  const { user } = useAuthContext();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);

  const { data: products = [] } = useQuery({
    queryKey: ['products'],
    queryFn: () => api.get<Product[]>('/products'),
  });

  const { data: lowStock = [] } = useQuery({
    queryKey: ['products', 'low-stock'],
    queryFn: () => api.get<Product[]>('/products/low-stock'),
  });

  const { data: categories = [] } = useQuery({
    queryKey: ['categories'],
    queryFn: () => api.get<Category[]>('/categories'),
  });

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await queryClient.invalidateQueries({ queryKey: ['products'] });
    await queryClient.invalidateQueries({ queryKey: ['categories'] });
    setRefreshing(false);
  }, [queryClient]);

  const active = products.filter((p) => p.isActive).length;

  const stats: StatCardProps[] = [
    {
      label: 'Productos',
      value: products.length,
      valueColor: 'text-blue-500',
      iconBg: 'bg-blue-50',
      icon: <Package size={18} color="#3B82F6" />,
    },
    {
      label: 'Activos',
      value: active,
      valueColor: 'text-green-500',
      iconBg: 'bg-green-50',
      icon: <CheckCircle2 size={18} color="#22C55E" />,
    },
    {
      label: 'Stock bajo',
      value: lowStock.length,
      valueColor: 'text-amber-500',
      iconBg: 'bg-amber-50',
      icon: <AlertTriangle size={18} color="#F59E0B" />,
    },
    {
      label: 'Categorías',
      value: categories.length,
      valueColor: 'text-purple-500',
      iconBg: 'bg-purple-50',
      icon: <Tag size={18} color="#A855F7" />,
    },
  ];

  const firstName = user?.name?.split(' ')[0] ?? 'Hola';

  return (
    <SafeAreaView className="flex-1 bg-gray-50">
      <ScrollView
        className="flex-1"
        contentContainerClassName="px-4 pt-6 pb-8"
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => void onRefresh()} tintColor="#208AEF" />
        }
      >
        {/* Header */}
        <View className="mb-6">
          <Text className="text-2xl font-bold text-gray-900">Hola, {firstName}</Text>
          {user?.tenantName ? (
            <Text className="text-sm text-gray-400 mt-0.5">{user.tenantName}</Text>
          ) : null}
        </View>

        {/* Stat cards — 2x2 grid */}
        <View className="flex-row gap-3 mb-3">
          <StatCard {...stats[0]!} />
          <StatCard {...stats[1]!} />
        </View>
        <View className="flex-row gap-3 mb-6">
          <StatCard {...stats[2]!} />
          <StatCard {...stats[3]!} />
        </View>

        {/* Alerta stock bajo */}
        {lowStock.length > 0 && (
          <View className="bg-amber-50 border border-amber-200 rounded-2xl p-4">
            <View className="flex-row items-center gap-2 mb-3">
              <AlertTriangle size={15} color="#D97706" />
              <Text className="text-sm font-semibold text-amber-800">
                {lowStock.length} producto{lowStock.length !== 1 ? 's' : ''} con stock bajo
              </Text>
            </View>

            {lowStock.slice(0, 5).map((p) => (
              <LowStockItem
                key={p.id}
                product={p}
                onPress={() => router.push('/stock/index' as never)}
              />
            ))}

            {lowStock.length > 5 && (
              <TouchableOpacity
                className="flex-row items-center justify-center mt-3 gap-1"
                onPress={() => router.push('/stock/index' as never)}
              >
                <Text className="text-xs text-amber-600 font-medium">
                  Ver {lowStock.length - 5} más en Stock
                </Text>
                <ChevronRight size={12} color="#D97706" />
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* Estado saludable */}
        {lowStock.length === 0 && products.length > 0 && (
          <View className="bg-green-50 border border-green-200 rounded-2xl px-4 py-3 flex-row items-center gap-2">
            <CheckCircle2 size={15} color="#16A34A" />
            <Text className="text-sm text-green-700 font-medium">Todo el stock en orden</Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
