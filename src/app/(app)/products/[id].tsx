import {
  View, Text, ScrollView, TouchableOpacity, Alert, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Pencil, Trash2, ArrowLeft, TrendingUp, AlertTriangle, Tag, BarChart2 } from 'lucide-react-native';
import { api } from '@/lib/api';
import { editStore } from '@/lib/edit-store';
import { useAuthContext } from '@/lib/auth-context';
import type { Product } from '@/lib/types';

function formatPrice(v: number | null | undefined) {
  if (v == null) return '—';
  return `$${v.toLocaleString('es-AR')}`;
}

function StockBadge({ product }: { product: Product }) {
  const isEmpty = product.stock === 0;
  const isLow = !isEmpty && product.minStock > 0 && product.stock <= product.minStock;

  const bg = isEmpty ? 'bg-red-100' : isLow ? 'bg-amber-100' : 'bg-green-100';
  const text = isEmpty ? 'text-red-700' : isLow ? 'text-amber-700' : 'text-green-700';
  const label = isEmpty ? 'Sin stock' : isLow ? 'Stock bajo' : 'En stock';

  return (
    <View className={`flex-row items-center gap-1.5 px-3 py-1 rounded-full ${bg}`}>
      {(isEmpty || isLow) && <AlertTriangle size={13} color={isEmpty ? '#B91C1C' : '#B45309'} />}
      <Text className={`text-sm font-semibold ${text}`}>{label}</Text>
    </View>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View className="flex-row justify-between py-3 border-b border-gray-100">
      <Text className="text-sm text-gray-400">{label}</Text>
      <Text className="text-sm font-medium text-gray-900">{value}</Text>
    </View>
  );
}

export default function ProductDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { tenantRole } = useAuthContext();
  const isOwner = tenantRole === 'owner';

  const { data: product, isLoading } = useQuery({
    queryKey: ['product', id],
    queryFn: () => api.get<Product>(`/products/${id}`),
    initialData: () => {
      // Use cached list as initial data to avoid loading state
      const lists = queryClient.getQueriesData<Product[]>({ queryKey: ['products'] });
      for (const [, data] of lists) {
        const found = data?.find((p) => p.id === id);
        if (found) return found;
      }
    },
  });

  function handleEdit() {
    if (!product) return;
    editStore.setProduct(product);
    router.push('/(modals)/product-form' as never);
  }

  function handleStockMovement() {
    if (!product) return;
    editStore.setStockProductId(product.id);
    router.push('/(modals)/stock-movement' as never);
  }

  function handleDelete() {
    if (!product) return;
    Alert.alert(
      'Eliminar producto',
      `¿Eliminar "${product.name}"? Esta acción no se puede deshacer.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: () => {
            void api.delete(`/products/${product.id}`).then(() => {
              void queryClient.invalidateQueries({ queryKey: ['products'], refetchType: 'all' });
              router.back();
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

  if (!product) {
    return (
      <SafeAreaView className="flex-1 bg-gray-50 items-center justify-center px-8">
        <Text className="text-gray-400 text-center">Producto no encontrado</Text>
        <TouchableOpacity onPress={() => router.back()} className="mt-4">
          <Text className="text-blue-500 font-medium">Volver</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  const margin =
    product.costPrice && product.salePrice
      ? product.salePrice - product.costPrice
      : null;
  const marginPct =
    margin != null && product.costPrice
      ? ((margin / product.costPrice) * 100).toFixed(0)
      : null;

  return (
    <SafeAreaView className="flex-1 bg-gray-50">
      {/* Header */}
      <View className="flex-row items-center justify-between px-4 py-3 bg-white border-b border-gray-100">
        <TouchableOpacity
          onPress={() => router.back()}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <ArrowLeft size={22} color="#374151" />
        </TouchableOpacity>
        <Text className="text-base font-semibold text-gray-900" numberOfLines={1}>
          Detalle del producto
        </Text>
        {isOwner ? (
          <TouchableOpacity onPress={handleEdit} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Pencil size={19} color="#208AEF" />
          </TouchableOpacity>
        ) : (
          <View style={{ width: 22 }} />
        )}
      </View>

      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        {/* Hero card */}
        <View className="bg-white px-4 pt-5 pb-4 mb-3">
          <View className="flex-row items-start justify-between mb-2">
            <View className="flex-1 mr-4">
              <Text className="text-2xl font-bold text-gray-900" numberOfLines={2}>
                {product.name}
              </Text>
              {product.code ? (
                <Text className="text-sm text-gray-400 font-mono mt-1">{product.code}</Text>
              ) : null}
            </View>
            <Text className="text-3xl font-bold text-gray-900">
              {formatPrice(product.salePrice)}
            </Text>
          </View>

          <View className="flex-row items-center gap-2 mt-2">
            <StockBadge product={product} />
            {product.category && (
              <View className="flex-row items-center gap-1 bg-purple-50 px-3 py-1 rounded-full">
                <Tag size={11} color="#7C3AED" />
                <Text className="text-xs font-medium text-purple-600">{product.category.name}</Text>
              </View>
            )}
            {!product.isActive && (
              <View className="bg-gray-100 px-3 py-1 rounded-full">
                <Text className="text-xs font-medium text-gray-500">Inactivo</Text>
              </View>
            )}
          </View>
        </View>

        {/* Stock card */}
        <View className="bg-white px-4 py-4 mb-3">
          <Text className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
            Stock
          </Text>
          <View className="flex-row gap-3">
            <View className="flex-1 bg-gray-50 rounded-xl p-3 items-center">
              <Text className="text-2xl font-bold text-gray-900">{product.stock}</Text>
              <Text className="text-xs text-gray-400 mt-0.5">Actual</Text>
            </View>
            <View className="flex-1 bg-gray-50 rounded-xl p-3 items-center">
              <Text className="text-2xl font-bold text-gray-400">{product.minStock}</Text>
              <Text className="text-xs text-gray-400 mt-0.5">Mínimo</Text>
            </View>
          </View>
        </View>

        {/* Pricing card */}
        <View className="bg-white px-4 py-4 mb-3">
          <Text className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">
            Precios
          </Text>
          <InfoRow label="Precio de venta" value={formatPrice(product.salePrice)} />
          <InfoRow label="Precio de costo" value={formatPrice(product.costPrice)} />
          {margin != null && (
            <View className="flex-row justify-between py-3">
              <Text className="text-sm text-gray-400">Margen</Text>
              <View className="flex-row items-center gap-1.5">
                <TrendingUp size={13} color="#10B981" />
                <Text className="text-sm font-semibold text-green-600">
                  {formatPrice(margin)}{marginPct ? ` (${marginPct}%)` : ''}
                </Text>
              </View>
            </View>
          )}
        </View>

        {/* Description */}
        {product.description ? (
          <View className="bg-white px-4 py-4 mb-3">
            <Text className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
              Descripción
            </Text>
            <Text className="text-sm text-gray-700 leading-5">{product.description}</Text>
          </View>
        ) : null}

        {/* Actions */}
        {isOwner && (
          <View className="px-4 pb-8 gap-3">
            <TouchableOpacity
              onPress={handleStockMovement}
              className="bg-blue-500 rounded-xl py-3.5 flex-row items-center justify-center gap-2"
              activeOpacity={0.85}
            >
              <BarChart2 size={18} color="white" />
              <Text className="text-white font-semibold text-base">Registrar movimiento</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={handleDelete}
              className="border border-red-200 rounded-xl py-3.5 flex-row items-center justify-center gap-2"
              activeOpacity={0.85}
            >
              <Trash2 size={16} color="#EF4444" />
              <Text className="text-red-500 font-semibold text-base">Eliminar producto</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
