import {
  View, Text, TextInput, ScrollView, TouchableOpacity,
  Modal, FlatList, ActivityIndicator, StyleSheet, Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState, useMemo, useRef, useEffect } from 'react';
import { X, Check, ChevronDown, AlertTriangle, ScanLine, Search, CheckCircle } from 'lucide-react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { api } from '@/lib/api';
import { editStore } from '@/lib/edit-store';
import type { Product, StockMovementType } from '@/lib/types';

const inputCls = 'bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-gray-900 text-base';

// ─── Tipos ────────────────────────────────────────────────────────────────────

type TypeOption = { value: StockMovementType; label: string; desc: string; color: string; bg: string };

const TYPES: TypeOption[] = [
  { value: 'entry',      label: 'Entrada',  desc: 'suma al stock',     color: '#16A34A', bg: '#F0FDF4' },
  { value: 'exit',       label: 'Salida',   desc: 'resta del stock',   color: '#DC2626', bg: '#FFF1F2' },
  { value: 'adjustment', label: 'Ajuste',   desc: 'establece el total real', color: '#2563EB', bg: '#EFF6FF' },
];

const QUICK_REASONS: Record<StockMovementType, string[]> = {
  entry:      ['Compra a proveedor', 'Devolución de cliente', 'Transferencia'],
  exit:       ['Merma / vencimiento', 'Transferencia', 'Pérdida'],
  adjustment: ['Conteo físico', 'Corrección de error'],
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function computeResult(type: StockMovementType, current: number, qty: number): number | null {
  if (isNaN(qty) || qty < 0) return null;
  if (type === 'entry') return current + qty;
  if (type === 'exit') return Math.max(0, current - qty);
  if (type === 'adjustment') return qty;
  return null;
}

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
  const [search, setSearch] = useState('');
  const [scanMode, setScanMode] = useState(false);
  const [permission, requestPermission] = useCameraPermissions();
  const [scanError, setScanError] = useState('');

  const selected = products.find((p) => p.id === value);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return products.filter((p) => p.isActive);
    return products.filter(
      (p) => p.isActive && (
        p.name.toLowerCase().includes(q) ||
        (p.code ?? '').toLowerCase().includes(q)
      ),
    );
  }, [products, search]);

  function handleClose() {
    setOpen(false);
    setSearch('');
    setScanMode(false);
    setScanError('');
  }

  function handleBarcode({ data }: { data: string }) {
    const found = products.find((p) => p.code === data && p.isActive);
    if (found) {
      onChange(found.id);
      handleClose();
    } else {
      setScanError(`Sin producto con código ${data}`);
    }
  }

  async function activateScan() {
    if (!permission?.granted) await requestPermission();
    setScanMode(true);
    setScanError('');
  }

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
          {/* Header */}
          <View className="px-4 py-4 border-b border-gray-100 flex-row justify-between items-center">
            <Text className="text-lg font-semibold text-gray-900">Producto</Text>
            <TouchableOpacity onPress={handleClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <X size={20} color="#6B7280" />
            </TouchableOpacity>
          </View>

          {/* Search + Scan row */}
          <View className="px-4 py-3 border-b border-gray-100 flex-row items-center gap-2">
            <View className="flex-1 flex-row items-center bg-gray-50 border border-gray-200 rounded-xl px-3 gap-2">
              <Search size={15} color="#9CA3AF" />
              <TextInput
                className="flex-1 py-2.5 text-sm text-gray-900"
                placeholder="Buscar por nombre o código..."
                placeholderTextColor="#9CA3AF"
                value={search}
                onChangeText={(t) => { setSearch(t); setScanMode(false); }}
                autoCorrect={false}
                clearButtonMode="while-editing"
              />
            </View>
            <TouchableOpacity
              onPress={() => (scanMode ? setScanMode(false) : void activateScan())}
              className={`p-2.5 rounded-xl border ${scanMode ? 'bg-blue-500 border-blue-500' : 'bg-gray-50 border-gray-200'}`}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <ScanLine size={18} color={scanMode ? 'white' : '#6B7280'} />
            </TouchableOpacity>
          </View>

          {/* Inline scanner */}
          {scanMode && (
            <View style={{ height: 180 }} className="border-b border-gray-100">
              {permission?.granted ? (
                <>
                  <CameraView
                    style={StyleSheet.absoluteFill}
                    facing="back"
                    barcodeScannerSettings={{
                      barcodeTypes: ['ean13', 'ean8', 'code128', 'code39', 'qr', 'upc_a', 'upc_e'],
                    }}
                    onBarcodeScanned={handleBarcode}
                  />
                  <View className="absolute inset-0 items-center justify-center">
                    <View style={styles.scanFrame} />
                  </View>
                  {scanError ? (
                    <View className="absolute bottom-3 left-4 right-4 bg-red-500 rounded-xl px-3 py-2">
                      <Text className="text-white text-xs text-center font-medium">{scanError}</Text>
                    </View>
                  ) : null}
                </>
              ) : (
                <View className="flex-1 items-center justify-center bg-gray-100">
                  <Text className="text-sm text-gray-500">Sin permiso de cámara</Text>
                </View>
              )}
            </View>
          )}

          {/* Product list */}
          <FlatList
            data={filtered}
            keyExtractor={(p) => p.id}
            keyboardShouldPersistTaps="handled"
            renderItem={({ item }) => (
              <TouchableOpacity
                className="flex-row items-center px-4 py-3.5 border-b border-gray-100"
                onPress={() => { onChange(item.id); handleClose(); }}
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
            ListEmptyComponent={
              <View className="items-center justify-center py-16">
                <Text className="text-sm text-gray-400">Sin resultados para "{search}"</Text>
              </View>
            }
          />
        </SafeAreaView>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  scanFrame: {
    width: 200,
    height: 100,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.8)',
    borderRadius: 8,
  },
});

// ─── Success overlay ──────────────────────────────────────────────────────────

function SuccessOverlay({
  typeLabel,
  typeColor,
  typeBg,
  productName,
  resultStock,
}: {
  typeLabel: string;
  typeColor: string;
  typeBg: string;
  productName: string;
  resultStock: number | null;
}) {
  const opacity = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.85)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(scale, { toValue: 1, useNativeDriver: true, tension: 80, friction: 8 }),
      Animated.timing(opacity, { toValue: 1, duration: 220, useNativeDriver: true }),
    ]).start();
  }, []);

  return (
    <Animated.View
      style={{ opacity, transform: [{ scale }] }}
      className="absolute inset-0 bg-white items-center justify-center px-8"
    >
      <View className="items-center">
        <View className="w-20 h-20 rounded-full bg-green-100 items-center justify-center mb-5">
          <CheckCircle size={44} color="#16A34A" />
        </View>
        <Text className="text-2xl font-bold text-gray-900 mb-2 text-center">¡Movimiento registrado!</Text>
        <View
          className="px-4 py-1.5 rounded-full mb-4"
          style={{ backgroundColor: typeBg }}
        >
          <Text className="text-sm font-semibold" style={{ color: typeColor }}>{typeLabel}</Text>
        </View>
        <Text className="text-base text-gray-600 text-center mb-1">{productName}</Text>
        {resultStock != null && (
          <Text className="text-sm text-gray-400">
            Stock actualizado:{' '}
            <Text className="font-bold text-gray-700">{resultStock}</Text>
          </Text>
        )}
      </View>
    </Animated.View>
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
  const [showSuccess, setShowSuccess] = useState(false);

  const { data: products = [] } = useQuery({
    queryKey: ['products'],
    queryFn: () => api.get<Product[]>('/products'),
  });

  const selected = products.find((p) => p.id === productId);
  const isLow = selected ? selected.minStock > 0 && selected.stock <= selected.minStock : false;

  const qty = parseInt(quantity, 10);
  const resultStock = selected ? computeResult(type, selected.stock, qty) : null;
  const resultDelta = resultStock != null && selected ? resultStock - selected.stock : null;

  async function handleSubmit() {
    const qtyNum = Number(quantity);
    if (!productId) { setError('Seleccioná un producto'); return; }
    if (!Number.isInteger(qtyNum) || qtyNum < 0) { setError('La cantidad debe ser un número entero válido'); return; }
    if (type !== 'adjustment' && qtyNum < 1) { setError('La cantidad debe ser mayor que cero'); return; }

    setSubmitting(true);
    setError('');
    try {
      await api.post('/stock-movements', {
        productId,
        type,
        quantity: qtyNum,
        reason: reason.trim() || null,
      });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['products'], refetchType: 'all' }),
        queryClient.invalidateQueries({ queryKey: ['stock-movements'], refetchType: 'all' }),
        queryClient.invalidateQueries({ queryKey: ['stock-movements-recent'], refetchType: 'all' }),
      ]);
      editStore.clearStockProductId();
      setShowSuccess(true);
      setTimeout(() => router.back(), 1800);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo registrar el movimiento');
    } finally {
      setSubmitting(false);
    }
  }

  const selectedType = TYPES.find((t) => t.value === type)!;

  return (
    <View className="flex-1">
    <SafeAreaView className="flex-1 bg-white" edges={['bottom']}>
      {/* Header */}
      <View className="flex-row items-center justify-between px-4 py-4 border-b border-gray-100">
        <TouchableOpacity onPress={() => router.back()} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
          <X size={22} color="#6B7280" />
        </TouchableOpacity>
        <Text className="text-base font-semibold text-gray-900">Registrar movimiento</Text>
        <View style={{ width: 22 }} />
      </View>

      <ScrollView className="flex-1 px-4 pt-4" keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>

        {/* Producto */}
        <View className="mb-4">
          <Text className="text-sm font-medium text-gray-700 mb-1.5">
            Producto <Text className="text-red-500">*</Text>
          </Text>
          <ProductPicker value={productId} onChange={setProductId} products={products} />
        </View>

        {/* Stock info + preview del resultado */}
        {selected && (
          <View className={`rounded-xl px-4 py-3 mb-4 ${isLow ? 'bg-amber-50 border border-amber-200' : 'bg-gray-50 border border-gray-200'}`}>
            <View className="flex-row items-center gap-2">
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
            {resultStock != null && resultStock !== selected.stock && (
              <View className="flex-row items-center gap-1.5 mt-2 pt-2 border-t border-gray-200">
                <Text className="text-xs text-gray-500">
                  Quedará en{' '}
                  <Text className="font-bold text-gray-900">{resultStock}</Text>
                </Text>
                {resultDelta != null && (
                  <Text
                    className="text-xs font-semibold"
                    style={{ color: resultDelta > 0 ? '#16A34A' : resultDelta < 0 ? '#DC2626' : '#2563EB' }}
                  >
                    ({resultDelta > 0 ? '+' : ''}{resultDelta})
                  </Text>
                )}
                {resultStock < (selected.minStock ?? 0) && (
                  <View className="bg-amber-100 px-2 py-0.5 rounded-full ml-1">
                    <Text className="text-xs text-amber-700 font-medium">bajo mínimo</Text>
                  </View>
                )}
              </View>
            )}
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
            {type === 'adjustment' ? 'Stock contado (total real)' : 'Cantidad'}{' '}
            <Text className="text-red-500">*</Text>
          </Text>
          <TextInput
            className={inputCls}
            value={quantity}
            onChangeText={setQuantity}
            keyboardType="number-pad"
            placeholderTextColor="#9CA3AF"
          />
        </View>

        {/* Motivo */}
        <View className="mb-4">
          <Text className="text-sm font-medium text-gray-700 mb-2">
            Motivo{' '}
            <Text className="text-xs text-gray-400 font-normal">(opcional)</Text>
          </Text>
          <View className="flex-row flex-wrap gap-2 mb-2">
            {QUICK_REASONS[type].map((r) => (
              <TouchableOpacity
                key={r}
                onPress={() => setReason(reason === r ? '' : r)}
                className={`px-3 py-1.5 rounded-full border ${
                  reason === r ? 'bg-blue-500 border-blue-500' : 'bg-gray-50 border-gray-200'
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

        <View className="h-4" />
      </ScrollView>

      {/* Primary action button */}
      <View className="px-4 pb-2 pt-3 border-t border-gray-100 bg-white">
        <TouchableOpacity
          onPress={() => void handleSubmit()}
          disabled={submitting || !productId}
          className={`py-4 rounded-2xl items-center ${submitting || !productId ? 'bg-gray-200' : 'bg-blue-500'}`}
          activeOpacity={0.85}
        >
          {submitting ? (
            <ActivityIndicator size="small" color="white" />
          ) : (
            <Text className={`font-bold text-base ${submitting || !productId ? 'text-gray-400' : 'text-white'}`}>
              Registrar movimiento
            </Text>
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
    {showSuccess && (
      <SuccessOverlay
        typeLabel={selectedType.label}
        typeColor={selectedType.color}
        typeBg={selectedType.bg}
        productName={selected?.name ?? ''}
        resultStock={resultStock}
      />
    )}
    </View>
  );
}
