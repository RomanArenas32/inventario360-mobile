import {
  View, Text, TextInput, ScrollView, TouchableOpacity,
  Modal, FlatList, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { X, Check, ChevronDown, AlertTriangle } from 'lucide-react-native';
import { api } from '@/lib/api';
import { editStore } from '@/lib/edit-store';
import type { Product, StockMovementType } from '@/lib/types';

const inputCls = 'bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-gray-900 text-base';

// ─── Tipos ────────────────────────────────────────────────────────────────────

type TypeOption = { value: StockMovementType; label: string; desc: string; color: string; bg: string };

const TYPES: TypeOption[] = [
  { value: 'entry',      label: 'Entrada',  desc: 'suma al stock',     color: '#16A34A', bg: '#F0FDF4' },
  { value: 'exit',       label: 'Salida',   desc: 'resta del stock',   color: '#DC2626', bg: '#FFF1F2' },
  { value: 'adjustment', label: 'Ajuste',   desc: 'establece el real', color: '#2563EB', bg: '#EFF6FF' },
];

const QUICK_REASONS: Record<StockMovementType, string[]> = {
  entry:      ['Compra a proveedor', 'Devolución de cliente', 'Transferencia'],
  exit:       ['Venta', 'Merma / vencimiento', 'Transferencia', 'Pérdida'],
  adjustment: ['Conteo físico', 'Corrección de error'],
};

// ─── Product picker ────────────────────────────────────────────────────────────

function ProductPicker({
  value,
  onChange,
  products,
}: {
  value: string;
  onChange: (id: string) => void;
  products: Product[];
}) {
  const [open, setOpen] = useState(false);
  const selected = products.find((p) => p.id === value);

  return (
    <>
      <TouchableOpacity
        onPress={() => setOpen(true)}
        className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 flex-row justify-between items-center"
      >
        <View className="flex-1 mr-2">
          <Text className={selected ? 'text-gray-900 text-base' : 'text-gray-400 text-base'} numberOfLines={1}>
            {selected ? selected.name : 'Seleccioná un producto'}
          </Text>
          {selected?.code ? (
            <Text className="text-xs text-gray-400 font-mono mt-0.5">{selected.code}</Text>
          ) : null}
        </View>
        <ChevronDown size={16} color="#9CA3AF" />
      </TouchableOpacity>

      <Modal visible={open} animationType="slide" presentationStyle="pageSheet">
        <SafeAreaView className="flex-1 bg-white">
          <View className="px-4 py-4 border-b border-gray-100 flex-row justify-between items-center">
            <Text className="text-lg font-semibold text-gray-900">Producto</Text>
            <TouchableOpacity onPress={() => setOpen(false)}>
              <X size={20} color="#6B7280" />
            </TouchableOpacity>
          </View>
          <FlatList
            data={products.filter((p) => p.isActive)}
            keyExtractor={(p) => p.id}
            renderItem={({ item }) => (
              <TouchableOpacity
                className="flex-row items-center px-4 py-3.5 border-b border-gray-100"
                onPress={() => { onChange(item.id); setOpen(false); }}
              >
                <View className="flex-1">
                  <Text className="text-base text-gray-900">{item.name}</Text>
                  {item.code ? (
                    <Text className="text-xs text-gray-400 font-mono mt-0.5">{item.code}</Text>
                  ) : null}
                </View>
                <View className="flex-row items-center gap-3">
                  <Text className="text-sm text-gray-500">Stock: {item.stock}</Text>
                  {value === item.id && <Check size={18} color="#208AEF" />}
                </View>
              </TouchableOpacity>
            )}
          />
        </SafeAreaView>
      </Modal>
    </>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function StockMovementScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();

  const initialProductId = editStore.getStockProductId() ?? '';

  const [productId, setProductId] = useState(initialProductId);
  const [type, setType] = useState<StockMovementType>('entry');
  const [quantity, setQuantity] = useState('1');
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const { data: products = [] } = useQuery({
    queryKey: ['products'],
    queryFn: () => api.get<Product[]>('/products'),
  });

  const selected = products.find((p) => p.id === productId);
  const isLow = selected ? selected.minStock > 0 && selected.stock <= selected.minStock : false;

  async function handleSubmit() {
    const qty = Number(quantity);
    if (!productId) { setError('Seleccioná un producto'); return; }
    if (!Number.isInteger(qty) || qty < 0) { setError('La cantidad debe ser un número entero válido'); return; }
    if (type !== 'adjustment' && qty < 1) { setError('La cantidad debe ser mayor que cero'); return; }

    setSubmitting(true);
    setError('');
    try {
      await api.post('/stock-movements', {
        productId,
        type,
        quantity: qty,
        reason: reason.trim() || null,
      });
      await queryClient.invalidateQueries({ queryKey: ['products'], refetchType: 'all' });
      await queryClient.invalidateQueries({ queryKey: ['stock-movements'], refetchType: 'all' });
      editStore.clearStockProductId();
      router.back();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo registrar el movimiento');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <SafeAreaView className="flex-1 bg-white" edges={['bottom']}>
      {/* Header */}
      <View className="flex-row items-center justify-between px-4 py-4 border-b border-gray-100">
        <TouchableOpacity onPress={() => router.back()} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
          <X size={22} color="#6B7280" />
        </TouchableOpacity>
        <Text className="text-base font-semibold text-gray-900">Registrar movimiento</Text>
        <TouchableOpacity onPress={() => void handleSubmit()} disabled={submitting}>
          {submitting ? (
            <ActivityIndicator size="small" color="#208AEF" />
          ) : (
            <Text className="text-blue-500 font-semibold text-base">Registrar</Text>
          )}
        </TouchableOpacity>
      </View>

      <ScrollView className="flex-1 px-4 pt-4" keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>

        {/* Producto */}
        <View className="mb-4">
          <Text className="text-sm font-medium text-gray-700 mb-1.5">
            Producto <Text className="text-red-500">*</Text>
          </Text>
          <ProductPicker value={productId} onChange={setProductId} products={products} />
        </View>

        {/* Stock info del producto seleccionado */}
        {selected && (
          <View className={`rounded-xl px-4 py-3 mb-4 flex-row items-center gap-2 ${isLow ? 'bg-amber-50 border border-amber-200' : 'bg-gray-50 border border-gray-200'}`}>
            {isLow && <AlertTriangle size={14} color="#D97706" />}
            <Text className={`text-sm ${isLow ? 'text-amber-700' : 'text-gray-600'}`}>
              Stock actual:{' '}
              <Text className={`font-bold ${isLow ? 'text-amber-600' : 'text-gray-900'}`}>
                {selected.stock}
              </Text>
              {selected.minStock > 0 && (
                <Text className="text-gray-400"> · mínimo {selected.minStock}</Text>
              )}
            </Text>
          </View>
        )}

        {/* Tipo de movimiento */}
        <View className="mb-4">
          <Text className="text-sm font-medium text-gray-700 mb-2">
            Tipo <Text className="text-red-500">*</Text>
          </Text>
          <View className="gap-2">
            {TYPES.map((t) => (
              <TouchableOpacity
                key={t.value}
                onPress={() => setType(t.value)}
                className={`flex-row items-center px-4 py-3 rounded-xl border ${
                  type === t.value ? 'border-2' : 'border border-gray-200 bg-gray-50'
                }`}
                style={type === t.value ? { borderColor: t.color, backgroundColor: t.bg } : {}}
              >
                <View className="flex-1">
                  <Text className="text-sm font-semibold" style={{ color: type === t.value ? t.color : '#374151' }}>
                    {t.label}
                  </Text>
                  <Text className="text-xs text-gray-400 mt-0.5">{t.desc}</Text>
                </View>
                {type === t.value && <Check size={16} color={t.color} />}
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Cantidad */}
        <View className="mb-4">
          <Text className="text-sm font-medium text-gray-700 mb-1.5">
            {type === 'adjustment' ? 'Stock contado' : 'Cantidad'}{' '}
            <Text className="text-red-500">*</Text>
          </Text>
          <TextInput
            className={inputCls}
            value={quantity}
            onChangeText={setQuantity}
            keyboardType="number-pad"
            placeholderTextColor="#9CA3AF"
          />
          {type === 'adjustment' && selected && (
            <Text className="text-xs text-gray-400 mt-1.5">
              El stock pasará de {selected.stock} a {Number(quantity) || 0}
            </Text>
          )}
        </View>

        {/* Motivo */}
        <View className="mb-4">
          <Text className="text-sm font-medium text-gray-700 mb-2">
            Motivo{' '}
            <Text className="text-xs text-gray-400 font-normal">(opcional)</Text>
          </Text>

          {/* Quick reasons */}
          <View className="flex-row flex-wrap gap-2 mb-2">
            {QUICK_REASONS[type].map((r) => (
              <TouchableOpacity
                key={r}
                onPress={() => setReason(r)}
                className={`px-3 py-1.5 rounded-full border ${
                  reason === r
                    ? 'bg-blue-500 border-blue-500'
                    : 'bg-gray-50 border-gray-200'
                }`}
                activeOpacity={0.7}
              >
                <Text className={`text-xs font-medium ${reason === r ? 'text-white' : 'text-gray-600'}`}>
                  {r}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <TextInput
            className={`${inputCls} min-h-20`}
            value={reason}
            onChangeText={setReason}
            placeholder="O escribí el motivo..."
            placeholderTextColor="#9CA3AF"
            multiline
            numberOfLines={3}
            textAlignVertical="top"
            maxLength={255}
          />
        </View>

        {error ? (
          <View className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 mb-4">
            <Text className="text-sm text-red-600">{error}</Text>
          </View>
        ) : null}

        <View className="h-8" />
      </ScrollView>
    </SafeAreaView>
  );
}
