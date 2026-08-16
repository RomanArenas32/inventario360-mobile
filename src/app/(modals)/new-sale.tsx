import {
  View, Text, TextInput, FlatList, TouchableOpacity,
  ActivityIndicator, StyleSheet, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState, useRef, useMemo } from 'react';
import { X, Search, ScanLine, ShoppingCart } from 'lucide-react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { api } from '@/lib/api';
import type { Product, PaymentMethod } from '@/lib/types';

// ─── Constants ────────────────────────────────────────────────────────────────

const PAYMENT_METHODS: { value: PaymentMethod; label: string }[] = [
  { value: 'cash',     label: 'Efectivo' },
  { value: 'card',     label: 'Tarjeta' },
  { value: 'transfer', label: 'Transferencia' },
];

// ─── Types ────────────────────────────────────────────────────────────────────

type CartItem = { product: Product; quantity: number };

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatCurrency(v: number) {
  return `$${Math.round(v).toLocaleString('es-AR')}`;
}

// ─── Cart item row ─────────────────────────────────────────────────────────────

function CartRow({
  item,
  onIncrease,
  onDecrease,
}: {
  item: CartItem;
  onIncrease: () => void;
  onDecrease: () => void;
}) {
  const subtotal = item.quantity * (item.product.salePrice ?? 0);
  return (
    <View className="flex-row items-center px-4 py-3 border-b border-gray-100">
      <View className="flex-1 mr-3">
        <Text className="text-sm font-medium text-gray-900" numberOfLines={1}>
          {item.product.name}
        </Text>
        <Text className="text-xs text-gray-400 mt-0.5">
          {item.product.salePrice ? `${formatCurrency(item.product.salePrice)} c/u` : 'Sin precio'}
        </Text>
      </View>
      <View className="flex-row items-center gap-2 mr-3">
        <TouchableOpacity
          onPress={onDecrease}
          className="w-7 h-7 rounded-full bg-gray-100 items-center justify-center"
          activeOpacity={0.7}
        >
          <Text className="text-base font-semibold text-gray-700 leading-none">−</Text>
        </TouchableOpacity>
        <Text className="text-sm font-bold text-gray-900 w-5 text-center">{item.quantity}</Text>
        <TouchableOpacity
          onPress={onIncrease}
          className="w-7 h-7 rounded-full bg-gray-100 items-center justify-center"
          activeOpacity={0.7}
        >
          <Text className="text-base font-semibold text-gray-700 leading-none">+</Text>
        </TouchableOpacity>
      </View>
      <Text className="text-sm font-bold text-gray-900 w-16 text-right">
        {formatCurrency(subtotal)}
      </Text>
    </View>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function NewSaleScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [permission, requestPermission] = useCameraPermissions();

  const [search, setSearch] = useState('');
  const [scanMode, setScanMode] = useState(false);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const scanning = useRef(false);

  const { data: products = [] } = useQuery({
    queryKey: ['products'],
    queryFn: () => api.get<Product[]>('/products'),
  });

  // ─── Cart operations ────────────────────────────────────────────────────────

  function addToCart(product: Product) {
    setCart((prev) => {
      const found = prev.find((i) => i.product.id === product.id);
      if (found) {
        return prev.map((i) =>
          i.product.id === product.id ? { ...i, quantity: i.quantity + 1 } : i,
        );
      }
      return [...prev, { product, quantity: 1 }];
    });
    setSearch('');
    setScanMode(false);
  }

  function changeQty(productId: string, delta: number) {
    setCart((prev) => {
      return prev
        .map((i) => i.product.id === productId ? { ...i, quantity: i.quantity + delta } : i)
        .filter((i) => i.quantity > 0);
    });
  }

  const total = cart.reduce((sum, i) => sum + i.quantity * (i.product.salePrice ?? 0), 0);
  const totalItems = cart.reduce((sum, i) => sum + i.quantity, 0);

  // ─── Search results ─────────────────────────────────────────────────────────

  const searchResults = useMemo(() => {
    if (!search.trim()) return [];
    const q = search.trim().toLowerCase();
    return products
      .filter(
        (p) =>
          p.isActive &&
          (p.name.toLowerCase().includes(q) || (p.code?.toLowerCase().includes(q) ?? false)),
      )
      .slice(0, 7);
  }, [products, search]);

  // ─── Barcode scanner ────────────────────────────────────────────────────────

  async function activateScan() {
    if (!permission?.granted) {
      const result = await requestPermission();
      if (!result.granted) {
        Alert.alert('Permiso requerido', 'Necesitamos acceso a la cámara para escanear.');
        return;
      }
    }
    setScanMode(true);
    setSearch('');
  }

  function handleBarcode({ data }: { data: string }) {
    if (scanning.current) return;
    scanning.current = true;
    const product = products.find(
      (p) =>
        p.isActive &&
        p.code?.trim().toLowerCase() === data.trim().toLowerCase(),
    );
    if (product) {
      addToCart(product);
      scanning.current = false;
    } else {
      Alert.alert(
        'Código no encontrado',
        `No hay producto con código "${data}".`,
        [{ text: 'OK', onPress: () => { scanning.current = false; } }],
      );
    }
  }

  // ─── Submit ─────────────────────────────────────────────────────────────────

  async function handleConfirm() {
    if (cart.length === 0) return;
    setSubmitting(true);
    setError('');
    try {
      await api.post('/sales', {
        items: cart.map((i) => ({ productId: i.product.id, quantity: i.quantity })),
        paymentMethod,
      });
      await queryClient.invalidateQueries({ queryKey: ['sales'], refetchType: 'all' });
      await queryClient.invalidateQueries({ queryKey: ['sales-summary'], refetchType: 'all' });
      await queryClient.invalidateQueries({ queryKey: ['products'], refetchType: 'all' });
      router.back();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo registrar la venta');
    } finally {
      setSubmitting(false);
    }
  }

  const canConfirm = cart.length > 0 && !submitting;

  // ─── Render ─────────────────────────────────────────────────────────────────

  return (
    <SafeAreaView className="flex-1 bg-white" edges={['bottom']}>
      {/* Header */}
      <View className="flex-row items-center justify-between px-4 py-4 border-b border-gray-100">
        <TouchableOpacity
          onPress={() => router.back()}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <X size={22} color="#6B7280" />
        </TouchableOpacity>
        <Text className="text-base font-semibold text-gray-900">Nueva venta</Text>
        <TouchableOpacity
          onPress={() => void handleConfirm()}
          disabled={!canConfirm}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          {submitting ? (
            <ActivityIndicator size="small" color="#208AEF" />
          ) : (
            <Text className={`text-base font-semibold ${canConfirm ? 'text-blue-500' : 'text-gray-300'}`}>
              Confirmar
            </Text>
          )}
        </TouchableOpacity>
      </View>

      {/* Search bar */}
      <View className="px-4 py-3 border-b border-gray-100">
        <View className="flex-row items-center bg-gray-50 border border-gray-200 rounded-xl px-3 gap-2">
          <Search size={15} color="#9CA3AF" />
          <TextInput
            className="flex-1 py-2.5 text-sm text-gray-900"
            placeholder="Buscar producto..."
            placeholderTextColor="#9CA3AF"
            value={search}
            onChangeText={(t) => { setSearch(t); if (t) setScanMode(false); }}
            clearButtonMode="while-editing"
            autoCorrect={false}
          />
          {!search && (
            <TouchableOpacity
              onPress={() => (scanMode ? setScanMode(false) : void activateScan())}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <ScanLine size={18} color={scanMode ? '#208AEF' : '#9CA3AF'} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Inline scanner */}
      {scanMode && !search && (
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
            </>
          ) : (
            <View className="flex-1 items-center justify-center bg-gray-100">
              <Text className="text-sm text-gray-500">Sin permiso de cámara</Text>
            </View>
          )}
        </View>
      )}

      {/* Search results */}
      {searchResults.length > 0 && (
        <View
          className="border-b border-gray-200 bg-white"
          style={{ maxHeight: 240 }}
        >
          <FlatList
            data={searchResults}
            keyExtractor={(p) => p.id}
            keyboardShouldPersistTaps="handled"
            renderItem={({ item }) => (
              <TouchableOpacity
                className="flex-row items-center px-4 py-3 border-b border-gray-100"
                onPress={() => addToCart(item)}
                activeOpacity={0.7}
              >
                <View className="flex-1 mr-3">
                  <Text className="text-sm font-medium text-gray-900" numberOfLines={1}>
                    {item.name}
                  </Text>
                  {item.code ? (
                    <Text className="text-xs text-gray-400 font-mono mt-0.5">{item.code}</Text>
                  ) : null}
                </View>
                <View className="items-end">
                  <Text className="text-sm font-semibold text-gray-900">
                    {item.salePrice ? formatCurrency(item.salePrice) : '—'}
                  </Text>
                  <Text className="text-xs text-gray-400 mt-0.5">Stock: {item.stock}</Text>
                </View>
              </TouchableOpacity>
            )}
          />
        </View>
      )}

      {/* Cart */}
      <FlatList
        data={cart}
        keyExtractor={(i) => i.product.id}
        keyboardShouldPersistTaps="handled"
        style={{ flex: 1 }}
        ListHeaderComponent={
          cart.length > 0 ? (
            <View className="px-4 py-2 bg-gray-50 border-b border-gray-100 flex-row justify-between">
              <Text className="text-xs text-gray-500 font-medium uppercase tracking-wide">
                Carrito
              </Text>
              <Text className="text-xs text-gray-500 font-medium uppercase tracking-wide">
                {totalItems} ítem{totalItems !== 1 ? 's' : ''}
              </Text>
            </View>
          ) : null
        }
        ListEmptyComponent={
          <View className="flex-1 items-center justify-center py-14">
            <ShoppingCart size={38} color="#E5E7EB" />
            <Text className="text-gray-400 text-sm mt-3 text-center px-8">
              Buscá productos arriba o escaneá un código de barras
            </Text>
          </View>
        }
        renderItem={({ item }) => (
          <CartRow
            item={item}
            onIncrease={() => changeQty(item.product.id, 1)}
            onDecrease={() => changeQty(item.product.id, -1)}
          />
        )}
      />

      {/* Payment + Total + Confirm */}
      <View className="border-t border-gray-100 px-4 pt-3 pb-4 bg-white">
        {/* Payment method */}
        <View className="flex-row gap-2 mb-3">
          {PAYMENT_METHODS.map((pm) => (
            <TouchableOpacity
              key={pm.value}
              onPress={() => setPaymentMethod(pm.value)}
              className={`flex-1 py-2.5 rounded-xl border items-center ${
                paymentMethod === pm.value
                  ? 'bg-blue-500 border-blue-500'
                  : 'bg-white border-gray-200'
              }`}
              activeOpacity={0.7}
            >
              <Text
                className={`text-xs font-semibold ${
                  paymentMethod === pm.value ? 'text-white' : 'text-gray-600'
                }`}
              >
                {pm.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Error */}
        {error ? (
          <View className="bg-red-50 border border-red-200 rounded-xl px-3 py-2 mb-3">
            <Text className="text-xs text-red-600">{error}</Text>
          </View>
        ) : null}

        {/* Total + Confirm */}
        <View className="flex-row items-center gap-3">
          <View>
            <Text className="text-xs text-gray-400">Total</Text>
            <Text className="text-2xl font-bold text-gray-900">{formatCurrency(total)}</Text>
          </View>
          <TouchableOpacity
            onPress={() => void handleConfirm()}
            disabled={!canConfirm}
            className={`flex-1 py-4 rounded-2xl items-center ${
              canConfirm ? 'bg-blue-500' : 'bg-gray-200'
            }`}
            activeOpacity={0.85}
          >
            {submitting ? (
              <ActivityIndicator size="small" color="white" />
            ) : (
              <Text className={`text-base font-bold ${canConfirm ? 'text-white' : 'text-gray-400'}`}>
                Confirmar venta
              </Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
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
