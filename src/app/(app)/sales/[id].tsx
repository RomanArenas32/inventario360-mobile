import {
  View, Text, ScrollView, TouchableOpacity, Alert, ActivityIndicator,
  Share, Modal, TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { ArrowLeft, TrendingUp, Share2, X, Minus, Plus } from 'lucide-react-native';
import { api } from '@/lib/api';
import type { Sale, SaleItem, PaymentMethod } from '@/lib/types';

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
  const [showPartialRefund, setShowPartialRefund] = useState(false);
  const [refundQtys, setRefundQtys] = useState<Record<string, number>>({});
  const [refunding, setRefunding] = useState(false);

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

  async function invalidateSales() {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['sale', id] }),
      queryClient.invalidateQueries({ queryKey: ['sales'], refetchType: 'all' }),
      queryClient.invalidateQueries({ queryKey: ['sales-summary'], refetchType: 'all' }),
      queryClient.invalidateQueries({ queryKey: ['sales-monthly-chart'], refetchType: 'all' }),
      queryClient.invalidateQueries({ queryKey: ['sales-monthly-summary'], refetchType: 'all' }),
      queryClient.invalidateQueries({ queryKey: ['products'], refetchType: 'all' }),
    ]);
  }

  function handleRefund() {
    if (!sale) return;
    Alert.alert(
      'Devolver venta completa',
      `¿Confirmar la devolución de ${formatCurrency(sale.total)}? El stock se restaurará.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Confirmar',
          style: 'destructive',
          onPress: () => {
            void api.post(`/sales/${sale.id}/refund`, {}).then(invalidateSales);
          },
        },
      ],
    );
  }

  async function handlePartialRefund() {
    if (!sale) return;
    const items = Object.entries(refundQtys)
      .filter(([, qty]) => qty > 0)
      .map(([saleItemId, quantity]) => ({ saleItemId, quantity }));

    if (items.length === 0) return;
    setRefunding(true);
    try {
      await api.post(`/sales/${sale.id}/partial-refund`, { items });
      await invalidateSales();
      setShowPartialRefund(false);
      setRefundQtys({});
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'No se pudo procesar la devolución');
    } finally {
      setRefunding(false);
    }
  }

  function handleShare() {
    if (!sale) return;
    const pm = PM_META[sale.paymentMethod];
    const lines = [
      `Venta #${String(sale.saleNumber).padStart(4, '0')}`,
      `Fecha: ${new Date(sale.createdAt).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' })} ${new Date(sale.createdAt).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}`,
      ``,
      ...sale.items.map((i) => `  ${i.product?.name ?? i.description ?? 'Servicio'} x${i.quantity}  ${formatCurrency(i.quantity * i.unitPrice)}`),
      ``,
      sale.discount > 0 ? `Subtotal: ${formatCurrency(sale.total + sale.discount)}` : '',
      sale.discount > 0 ? `Descuento: -${formatCurrency(sale.discount)}` : '',
      `Total: ${formatCurrency(sale.total)}`,
      `Pago: ${pm.label}`,
    ].filter((l) => l !== '');
    void Share.share({ message: lines.join('\n') });
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
  const marginPct = sale.profit != null && sale.total > 0
    ? Math.round((sale.profit / sale.total) * 100)
    : null;
  const productItems = sale.items.filter((i) => !!i.productId);
  const hasPartialRefund = productItems.some((i) => (i.refundedQuantity ?? 0) > 0);
  const allRefunded = productItems.length > 0 && productItems.every((i) => (i.refundedQuantity ?? 0) >= i.quantity);

  return (
    <SafeAreaView className="flex-1 bg-gray-50">
      {/* Header */}
      <View className="flex-row items-center justify-between px-4 py-3 bg-white border-b border-gray-100">
        <TouchableOpacity onPress={() => router.back()} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <ArrowLeft size={22} color="#374151" />
        </TouchableOpacity>
        <Text className="text-base font-semibold text-gray-900">
          #{String(sale.saleNumber).padStart(4, '0')}
        </Text>
        <TouchableOpacity onPress={handleShare} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Share2 size={20} color="#6B7280" />
        </TouchableOpacity>
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

          <View className="flex-row gap-2 flex-wrap mt-1">
            {sale.profit != null && (
              <View className="flex-row items-center gap-1.5 bg-green-50 px-3 py-2 rounded-xl">
                <TrendingUp size={13} color="#16A34A" />
                <Text className="text-sm font-semibold text-green-700">
                  Ganancia: {formatCurrency(sale.profit)}
                  {marginPct !== null ? ` · ${marginPct}%` : ''}
                </Text>
              </View>
            )}
            {sale.discount > 0 && (
              <View className="bg-amber-50 px-3 py-2 rounded-xl">
                <Text className="text-sm font-semibold text-amber-700">
                  Descuento: −{formatCurrency(sale.discount)}
                </Text>
              </View>
            )}
          </View>
        </View>

        {/* Items */}
        <View className="bg-white px-4 py-4 mb-3">
          <Text className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
            Artículos · {sale.itemCount}
          </Text>
          {sale.items.map((item, i) => {
            const refunded = item.refundedQuantity ?? 0;
            const isItemRefunded = refunded >= item.quantity;
            return (
              <View
                key={item.id}
                className={`flex-row items-center py-3 ${i < sale.items.length - 1 ? 'border-b border-gray-100' : ''} ${isItemRefunded ? 'opacity-50' : ''}`}
              >
                <View className="flex-1 mr-3">
                  <Text className="text-sm font-medium text-gray-900" numberOfLines={1}>
                    {item.product?.name ?? item.description ?? 'Servicio'}
                  </Text>
                  {item.product?.code ? (
                    <Text className="text-xs text-gray-400 font-mono mt-0.5">{item.product.code}</Text>
                  ) : !item.productId ? (
                    <Text className="text-xs text-purple-400 mt-0.5">Servicio</Text>
                  ) : null}
                  {refunded > 0 && (
                    <Text className="text-xs text-red-400 mt-0.5">
                      {isItemRefunded ? 'Devuelto' : `${refunded} devuelto${refunded !== 1 ? 's' : ''}`}
                    </Text>
                  )}
                </View>
                <View className="items-end">
                  <Text className={`text-sm font-bold ${isItemRefunded ? 'line-through text-gray-400' : 'text-gray-900'}`}>
                    {formatCurrency(item.quantity * item.unitPrice)}
                  </Text>
                  <Text className="text-xs text-gray-400 mt-0.5">
                    {item.quantity} × {formatCurrency(item.unitPrice)}
                  </Text>
                </View>
              </View>
            );
          })}

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

        {/* Refund options */}
        {!isRefunded && !allRefunded && (
          <View className="px-4 pb-8 gap-2">
            <TouchableOpacity
              onPress={() => {
                setRefundQtys({});
                setShowPartialRefund(true);
              }}
              className="border border-amber-200 bg-amber-50 rounded-xl py-3.5 items-center"
              activeOpacity={0.85}
            >
              <Text className="text-amber-700 font-semibold">Devolución parcial</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={handleRefund}
              className="border border-red-200 rounded-xl py-3.5 items-center"
              activeOpacity={0.85}
            >
              <Text className="text-red-500 font-semibold">Devolver todo</Text>
            </TouchableOpacity>
            <Text className="text-xs text-gray-400 text-center">
              El stock se restaurará automáticamente.
            </Text>
          </View>
        )}
        {(isRefunded || allRefunded) && (
          <View className="px-4 pb-8">
            <View className="bg-gray-100 rounded-xl py-3.5 items-center">
              <Text className="text-gray-400 font-medium text-sm">Venta devuelta</Text>
            </View>
          </View>
        )}
      </ScrollView>
      {/* Partial refund modal */}
      <Modal visible={showPartialRefund} animationType="slide" presentationStyle="pageSheet">
        <SafeAreaView className="flex-1 bg-white">
          <View className="flex-row items-center justify-between px-4 py-4 border-b border-gray-100">
            <TouchableOpacity onPress={() => setShowPartialRefund(false)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <X size={20} color="#6B7280" />
            </TouchableOpacity>
            <Text className="text-base font-semibold text-gray-900">Devolución parcial</Text>
            <View style={{ width: 20 }} />
          </View>

          <ScrollView className="flex-1 px-4 pt-3">
            <Text className="text-xs text-gray-400 mb-4">
              Seleccioná las cantidades a devolver por producto.
            </Text>
            {sale.items.map((item) => {
              // Service items can't be refunded by quantity
              if (!item.productId) return null;
              const alreadyRefunded = item.refundedQuantity ?? 0;
              const available = item.quantity - alreadyRefunded;
              if (available <= 0) return null;
              const qty = refundQtys[item.id] ?? 0;
              return (
                <View key={item.id} className="flex-row items-center py-3 border-b border-gray-100">
                  <View className="flex-1 mr-3">
                    <Text className="text-sm font-medium text-gray-900" numberOfLines={1}>{item.product?.name ?? item.description ?? 'Producto'}</Text>
                    <Text className="text-xs text-gray-400 mt-0.5">Disponibles: {available}</Text>
                  </View>
                  <View className="flex-row items-center gap-2">
                    <TouchableOpacity
                      onPress={() => setRefundQtys((p) => ({ ...p, [item.id]: Math.max(0, (p[item.id] ?? 0) - 1) }))}
                      className="w-8 h-8 rounded-full bg-gray-100 items-center justify-center"
                      disabled={qty === 0}
                      activeOpacity={0.7}
                    >
                      <Minus size={14} color={qty === 0 ? '#D1D5DB' : '#374151'} />
                    </TouchableOpacity>
                    <Text className="text-sm font-bold text-gray-900 w-6 text-center">{qty}</Text>
                    <TouchableOpacity
                      onPress={() => setRefundQtys((p) => ({ ...p, [item.id]: Math.min(available, (p[item.id] ?? 0) + 1) }))}
                      className="w-8 h-8 rounded-full bg-gray-100 items-center justify-center"
                      disabled={qty >= available}
                      activeOpacity={0.7}
                    >
                      <Plus size={14} color={qty >= available ? '#D1D5DB' : '#374151'} />
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })}
          </ScrollView>

          <View className="px-4 pb-4 pt-3 border-t border-gray-100">
            <TouchableOpacity
              onPress={() => void handlePartialRefund()}
              disabled={refunding || Object.values(refundQtys).every((q) => q === 0)}
              className={`py-4 rounded-2xl items-center ${
                refunding || Object.values(refundQtys).every((q) => q === 0)
                  ? 'bg-gray-200'
                  : 'bg-amber-500'
              }`}
              activeOpacity={0.85}
            >
              {refunding ? (
                <ActivityIndicator size="small" color="white" />
              ) : (
                <Text className={`font-bold text-base ${Object.values(refundQtys).every((q) => q === 0) ? 'text-gray-400' : 'text-white'}`}>
                  Confirmar devolución
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}
