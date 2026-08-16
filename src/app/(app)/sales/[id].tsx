import {
  View, Text, ScrollView, TouchableOpacity, Alert, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, TrendingUp } from 'lucide-react-native';
import { api } from '@/lib/api';
import type { Sale, PaymentMethod } from '@/lib/types';

// ─── Constants ────────────────────────────────────────────────────────────────

const PM_META: Record<PaymentMethod, { label: string; bg: string; text: string }> = {
  cash:     { label: 'Efectivo',      bg: '#F0FDF4', text: '#16A34A' },
  card:     { label: 'Tarjeta',       bg: '#EFF6FF', text: '#2563EB' },
  transfer: { label: 'Transferencia', bg: '#F5F3FF', text: '#7C3AED' },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatCurrency(v: number) {
  return `$${Math.round(v).toLocaleString('es-AR')}`;
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function SaleDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();

  const { data: sale, isLoading } = useQuery({
    queryKey: ['sale', id],
    // Backend: GET /sales/:id
    queryFn: () => api.get<Sale>(`/sales/${id}`),
    initialData: () => {
      // Try to find in paginated cache
      const pages = queryClient.getQueriesData<{ pages: { data: Sale[] }[] }>({ queryKey: ['sales'] });
      for (const [, q] of pages) {
        const found = q?.pages?.flatMap((p) => p.data).find((s) => s.id === id);
        if (found) return found;
      }
    },
  });

  function handleRefund() {
    if (!sale) return;
    Alert.alert(
      'Devolver venta',
      `¿Confirmar la devolución de esta venta por ${formatCurrency(sale.total)}? El stock de los productos se restaurará.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Confirmar devolución',
          style: 'destructive',
          onPress: () => {
            void api.post(`/sales/${sale.id}/refund`, {}).then(async () => {
              await queryClient.invalidateQueries({ queryKey: ['sale', id] });
              await queryClient.invalidateQueries({ queryKey: ['sales'], refetchType: 'all' });
              await queryClient.invalidateQueries({ queryKey: ['sales-summary'], refetchType: 'all' });
              await queryClient.invalidateQueries({ queryKey: ['products'], refetchType: 'all' });
            });
          },
        },
      ],
    );
  }

  if (isLoading) {
    return (
      <SafeAreaView className="flex-1 bg-gray-50 items-center justify-center">
        <ActivityIndicator color="#208AEF" />
      </SafeAreaView>
    );
  }

  if (!sale) {
    return (
      <SafeAreaView className="flex-1 bg-gray-50 items-center justify-center px-8">
        <Text className="text-gray-400 text-center">Venta no encontrada</Text>
        <TouchableOpacity onPress={() => router.back()} className="mt-4">
          <Text className="text-blue-500 font-medium">Volver</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  const pm = PM_META[sale.paymentMethod];
  const date = new Date(sale.createdAt);
  const dateStr = date.toLocaleDateString('es-AR', { day: '2-digit', month: 'long', year: 'numeric' });
  const timeStr = date.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
  const isRefunded = !!sale.refundedAt;

  return (
    <SafeAreaView className="flex-1 bg-gray-50">
      {/* Header */}
      <View className="flex-row items-center justify-between px-4 py-3 bg-white border-b border-gray-100">
        <TouchableOpacity onPress={() => router.back()} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <ArrowLeft size={22} color="#374151" />
        </TouchableOpacity>
        <Text className="text-base font-semibold text-gray-900">Detalle de venta</Text>
        <View style={{ width: 22 }} />
      </View>

      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        {/* Hero card */}
        <View className="bg-white px-4 pt-5 pb-4 mb-3">
          <View className="flex-row items-start justify-between mb-3">
            <View className="flex-1">
              <Text className="text-2xl font-bold text-gray-900">{formatCurrency(sale.total)}</Text>
              <Text className="text-sm text-gray-400 mt-0.5">{dateStr} · {timeStr}</Text>
              <Text className="text-xs text-gray-400 mt-0.5">{sale.user.name}</Text>
            </View>
            <View className="items-end gap-2">
              <View className="px-3 py-1 rounded-full" style={{ backgroundColor: pm.bg }}>
                <Text className="text-sm font-semibold" style={{ color: pm.text }}>{pm.label}</Text>
              </View>
              {isRefunded && (
                <View className="bg-gray-100 px-3 py-1 rounded-full">
                  <Text className="text-xs font-medium text-gray-500">Devuelta</Text>
                </View>
              )}
            </View>
          </View>

          {sale.profit != null && (
            <View className="flex-row items-center gap-1.5 bg-green-50 px-3 py-2 rounded-xl self-start">
              <TrendingUp size={13} color="#16A34A" />
              <Text className="text-sm font-semibold text-green-700">
                Ganancia: {formatCurrency(sale.profit)}
              </Text>
            </View>
          )}
        </View>

        {/* Items */}
        <View className="bg-white px-4 py-4 mb-3">
          <Text className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
            Artículos · {sale.itemCount}
          </Text>
          {sale.items.map((item, i) => (
            <View
              key={item.id}
              className={`flex-row items-center py-3 ${i < sale.items.length - 1 ? 'border-b border-gray-100' : ''}`}
            >
              <View className="flex-1 mr-3">
                <Text className="text-sm font-medium text-gray-900" numberOfLines={1}>
                  {item.product.name}
                </Text>
                {item.product.code ? (
                  <Text className="text-xs text-gray-400 font-mono mt-0.5">{item.product.code}</Text>
                ) : null}
              </View>
              <View className="items-end">
                <Text className="text-sm font-bold text-gray-900">
                  {formatCurrency(item.quantity * item.unitPrice)}
                </Text>
                <Text className="text-xs text-gray-400 mt-0.5">
                  {item.quantity} × {formatCurrency(item.unitPrice)}
                </Text>
              </View>
            </View>
          ))}

          {/* Total row */}
          <View className="flex-row justify-between pt-3 mt-1 border-t border-gray-200">
            <Text className="text-sm font-semibold text-gray-900">Total</Text>
            <Text className="text-base font-bold text-gray-900">{formatCurrency(sale.total)}</Text>
          </View>
        </View>

        {/* Notes */}
        {sale.notes ? (
          <View className="bg-white px-4 py-4 mb-3">
            <Text className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
              Notas
            </Text>
            <Text className="text-sm text-gray-700 leading-5">{sale.notes}</Text>
          </View>
        ) : null}

        {/* Refund */}
        {!isRefunded && (
          <View className="px-4 pb-8">
            <TouchableOpacity
              onPress={handleRefund}
              className="border border-red-200 rounded-xl py-3.5 flex-row items-center justify-center"
              activeOpacity={0.85}
            >
              <Text className="text-red-500 font-semibold">Devolver venta</Text>
            </TouchableOpacity>
            <Text className="text-xs text-gray-400 text-center mt-2">
              El stock de los productos se restaurará automáticamente.
            </Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
