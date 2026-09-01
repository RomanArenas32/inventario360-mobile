import {
  View, Text, TextInput, FlatList, TouchableOpacity,
  ActivityIndicator, StyleSheet, Alert, Animated, Modal, ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState, useRef, useMemo, useEffect } from 'react';
import { X, Search, ScanLine, ShoppingCart, CheckCircle, CalendarDays, ChevronLeft, ChevronRight, Scissors, Plus, Minus, PenLine } from 'lucide-react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { api } from '@/lib/api';
import type { Product, PaymentMethod } from '@/lib/types';

type CatalogService = {
  id: string;
  name: string;
  description: string | null;
  price: number;
  duration: number | null;
  isActive: boolean;
};

// ─── Constants ────────────────────────────────────────────────────────────────

const PAYMENT_METHODS: { value: PaymentMethod; label: string }[] = [
  { value: 'cash',     label: 'Efectivo' },
  { value: 'card',     label: 'Tarjeta' },
  { value: 'transfer', label: 'Transferencia' },
];

const PM_COLORS: Record<PaymentMethod, string> = {
  cash:     '#16A34A',
  card:     '#2563EB',
  transfer: '#7C3AED',
};

type ProductCartItem = { kind: 'product'; product: Product; quantity: number };
type ServiceCartItem = { kind: 'service'; id: string; description: string; unitPrice: number; quantity: number };
type CartEntry = ProductCartItem | ServiceCartItem;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatCurrency(v: number) {
  return `$${Math.round(v).toLocaleString('es-AR')}`;
}

function entryKey(e: CartEntry): string {
  return e.kind === 'product' ? `p-${e.product.id}` : `s-${e.id}`;
}

// ─── Success overlay ──────────────────────────────────────────────────────────

function SuccessOverlay({
  total,
  itemCount,
  paymentMethod,
  customDate,
}: {
  total: number;
  itemCount: number;
  paymentMethod: PaymentMethod;
  customDate?: Date;
}) {
  const opacity = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.85)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(scale, { toValue: 1, useNativeDriver: true, tension: 80, friction: 8 }),
      Animated.timing(opacity, { toValue: 1, duration: 220, useNativeDriver: true }),
    ]).start();
  }, []);

  const pmLabel = PAYMENT_METHODS.find((p) => p.value === paymentMethod)?.label ?? '';
  const color = PM_COLORS[paymentMethod];

  return (
    <Animated.View
      style={[StyleSheet.absoluteFill, { opacity }]}
      className="bg-white items-center justify-center px-8"
    >
      <Animated.View style={{ transform: [{ scale }] }} className="items-center">
        <View className="w-24 h-24 rounded-full bg-green-50 items-center justify-center mb-5">
          <CheckCircle size={56} color="#16A34A" />
        </View>
        <Text className="text-2xl font-bold text-gray-900 mb-1">¡Venta registrada!</Text>
        <Text className="text-4xl font-bold text-gray-900 mb-4">{formatCurrency(total)}</Text>
        <View className="flex-row items-center gap-3 flex-wrap justify-center">
          <View className="px-3 py-1.5 rounded-full" style={{ backgroundColor: color + '18' }}>
            <Text className="text-sm font-semibold" style={{ color }}>{pmLabel}</Text>
          </View>
          <Text className="text-sm text-gray-400">
            {itemCount} ítem{itemCount !== 1 ? 's' : ''}
          </Text>
          {customDate && (
            <View className="bg-amber-50 px-3 py-1.5 rounded-full">
              <Text className="text-xs font-semibold text-amber-700">
                {customDate.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' })}
              </Text>
            </View>
          )}
        </View>
      </Animated.View>
    </Animated.View>
  );
}

// ─── Product cart row ─────────────────────────────────────────────────────────

function CartRow({
  item,
  onIncrease,
  onDecrease,
  onSetQty,
  stockWarning,
}: {
  item: ProductCartItem;
  onIncrease: () => void;
  onDecrease: () => void;
  onSetQty: (qty: number) => void;
  stockWarning: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [qtyText, setQtyText] = useState(String(item.quantity));
  const subtotal = item.quantity * (item.product.salePrice ?? 0);
  const atLimit = item.quantity >= item.product.stock;

  function commitQty() {
    const n = parseInt(qtyText, 10);
    if (n > 0 && Number.isInteger(n)) {
      onSetQty(Math.min(n, item.product.stock));
    } else {
      setQtyText(String(item.quantity));
    }
    setEditing(false);
  }

  return (
    <View className="border-b border-gray-100">
      <View className="flex-row items-center px-4 py-3">
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

          <TouchableOpacity
            onPress={() => { setEditing(true); setQtyText(String(item.quantity)); }}
            activeOpacity={0.6}
            hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
          >
            {editing ? (
              <TextInput
                autoFocus
                value={qtyText}
                onChangeText={setQtyText}
                onBlur={commitQty}
                onSubmitEditing={commitQty}
                keyboardType="number-pad"
                className="text-sm font-bold text-gray-900 text-center border-b border-blue-400 w-8"
              />
            ) : (
              <Text className="text-sm font-bold text-gray-900 w-8 text-center underline decoration-dotted">
                {item.quantity}
              </Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            onPress={onIncrease}
            disabled={atLimit}
            className={`w-7 h-7 rounded-full items-center justify-center ${atLimit ? 'bg-gray-50' : 'bg-gray-100'}`}
            activeOpacity={0.7}
          >
            <Text className={`text-base font-semibold leading-none ${atLimit ? 'text-gray-300' : 'text-gray-700'}`}>+</Text>
          </TouchableOpacity>
        </View>
        <Text className="text-sm font-bold text-gray-900 w-16 text-right">
          {formatCurrency(subtotal)}
        </Text>
      </View>

      {stockWarning && (
        <View className="mx-4 mb-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-1.5">
          <Text className="text-xs text-amber-700 font-medium">
            Stock máximo: {item.product.stock} unidad{item.product.stock !== 1 ? 'es' : ''}
          </Text>
        </View>
      )}
    </View>
  );
}

// ─── Service cart row ─────────────────────────────────────────────────────────

function ServiceRow({
  item,
  onIncrease,
  onDecrease,
  onRemove,
}: {
  item: ServiceCartItem;
  onIncrease: () => void;
  onDecrease: () => void;
  onRemove: () => void;
}) {
  const subtotal = item.quantity * item.unitPrice;

  return (
    <View className="border-b border-gray-100">
      <View className="flex-row items-center px-4 py-3">
        <View className="w-6 h-6 rounded-full bg-purple-100 items-center justify-center mr-3">
          <Scissors size={12} color="#7C3AED" />
        </View>
        <View className="flex-1 mr-3">
          <Text className="text-sm font-medium text-gray-900" numberOfLines={1}>
            {item.description}
          </Text>
          <Text className="text-xs text-purple-500 mt-0.5">
            {formatCurrency(item.unitPrice)} c/u · Servicio
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
          <Text className="text-sm font-bold text-gray-900 w-8 text-center">{item.quantity}</Text>
          <TouchableOpacity
            onPress={onIncrease}
            className="w-7 h-7 rounded-full bg-gray-100 items-center justify-center"
            activeOpacity={0.7}
          >
            <Text className="text-base font-semibold text-gray-700 leading-none">+</Text>
          </TouchableOpacity>
        </View>
        <View className="items-end">
          <Text className="text-sm font-bold text-gray-900 w-16 text-right">
            {formatCurrency(subtotal)}
          </Text>
          <TouchableOpacity onPress={onRemove} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} className="mt-1">
            <Text className="text-xs text-red-400">quitar</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

// ─── Add service modal ────────────────────────────────────────────────────────

function AddServiceModal({
  visible,
  onClose,
  onAdd,
}: {
  visible: boolean;
  onClose: () => void;
  onAdd: (item: Omit<ServiceCartItem, 'kind'>) => void;
}) {
  const [mode, setMode] = useState<'catalog' | 'manual'>('catalog');
  const [search, setSearch] = useState('');
  // Manual form
  const [desc, setDesc] = useState('');
  const [price, setPrice] = useState('');
  const [qty, setQty] = useState(1);
  const [error, setError] = useState('');

  const { data: services = [], isLoading } = useQuery({
    queryKey: ['services'],
    queryFn: () => api.get<CatalogService[]>('/services'),
    enabled: visible,
  });

  const activeServices = useMemo(
    () => services.filter((s) => s.isActive),
    [services],
  );

  const filtered = useMemo(() => {
    if (!search.trim()) return activeServices;
    const q = search.trim().toLowerCase();
    return activeServices.filter((s) => s.name.toLowerCase().includes(q));
  }, [activeServices, search]);

  function reset() {
    setMode('catalog');
    setSearch('');
    setDesc('');
    setPrice('');
    setQty(1);
    setError('');
  }

  function handleClose() { reset(); onClose(); }

  function handleSelectFromCatalog(svc: CatalogService) {
    onAdd({ id: String(Date.now()), description: svc.name, unitPrice: svc.price, quantity: 1 });
    reset();
    onClose();
  }

  function handleAddManual() {
    if (!desc.trim()) { setError('Ingresá una descripción'); return; }
    const p = parseFloat(price.replace(',', '.'));
    if (!price.trim() || isNaN(p) || p < 0) { setError('Ingresá un precio válido'); return; }
    onAdd({ id: String(Date.now()), description: desc.trim(), unitPrice: p, quantity: qty });
    reset();
    onClose();
  }

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onShow={() => setMode('catalog')}>
      <SafeAreaView className="flex-1 bg-white" edges={['top', 'bottom']}>
        {/* Header */}
        <View className="flex-row items-center justify-between px-4 py-4 border-b border-gray-100">
          <TouchableOpacity onPress={handleClose}>
            <X size={22} color="#6B7280" />
          </TouchableOpacity>
          <Text className="text-base font-semibold text-gray-900">Agregar servicio</Text>
          {mode === 'manual' ? (
            <TouchableOpacity onPress={handleAddManual}>
              <Text className="text-blue-500 font-semibold text-base">Agregar</Text>
            </TouchableOpacity>
          ) : (
            <View style={{ width: 60 }} />
          )}
        </View>

        {/* Mode toggle */}
        <View className="flex-row px-4 pt-3 pb-2 gap-2">
          <TouchableOpacity
            onPress={() => setMode('catalog')}
            className={`flex-1 py-2 rounded-xl items-center border ${mode === 'catalog' ? 'bg-purple-50 border-purple-200' : 'bg-gray-50 border-gray-200'}`}
            activeOpacity={0.7}
          >
            <Text className={`text-xs font-semibold ${mode === 'catalog' ? 'text-purple-700' : 'text-gray-500'}`}>
              Del catálogo
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setMode('manual')}
            className={`flex-1 py-2 rounded-xl items-center border ${mode === 'manual' ? 'bg-purple-50 border-purple-200' : 'bg-gray-50 border-gray-200'}`}
            activeOpacity={0.7}
          >
            <Text className={`text-xs font-semibold ${mode === 'manual' ? 'text-purple-700' : 'text-gray-500'}`}>
              Personalizado
            </Text>
          </TouchableOpacity>
        </View>

        {mode === 'catalog' ? (
          <>
            {/* Search */}
            <View className="px-4 pb-2">
              <View className="flex-row items-center bg-gray-50 border border-gray-200 rounded-xl px-3 gap-2">
                <Search size={14} color="#9CA3AF" />
                <TextInput
                  className="flex-1 py-2.5 text-sm text-gray-900"
                  placeholder="Buscar servicio..."
                  placeholderTextColor="#9CA3AF"
                  value={search}
                  onChangeText={setSearch}
                  autoCorrect={false}
                />
              </View>
            </View>

            {isLoading ? (
              <View className="flex-1 items-center justify-center">
                <ActivityIndicator size="large" color="#7C3AED" />
              </View>
            ) : filtered.length === 0 ? (
              <View className="flex-1 items-center justify-center px-8">
                <Scissors size={36} color="#E5E7EB" />
                <Text className="text-gray-400 text-sm mt-3 text-center">
                  {search ? 'Sin resultados' : 'No hay servicios en el catálogo'}
                </Text>
                <TouchableOpacity
                  onPress={() => { setSearch(''); setMode('manual'); }}
                  className="mt-4 bg-purple-50 border border-purple-200 px-5 py-2.5 rounded-xl"
                  activeOpacity={0.7}
                >
                  <Text className="text-purple-700 text-xs font-semibold">Agregar uno personalizado</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <FlatList
                data={filtered}
                keyExtractor={(s) => s.id}
                keyboardShouldPersistTaps="handled"
                contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 16 }}
                renderItem={({ item: svc }) => (
                  <TouchableOpacity
                    onPress={() => handleSelectFromCatalog(svc)}
                    activeOpacity={0.7}
                    className="flex-row items-center py-3.5 border-b border-gray-100"
                  >
                    <View className="w-9 h-9 rounded-xl bg-purple-50 items-center justify-center mr-3">
                      <Scissors size={16} color="#7C3AED" />
                    </View>
                    <View className="flex-1">
                      <Text className="text-sm font-semibold text-gray-900">{svc.name}</Text>
                      {svc.description ? (
                        <Text className="text-xs text-gray-400 mt-0.5" numberOfLines={1}>{svc.description}</Text>
                      ) : null}
                    </View>
                    <Text className="text-sm font-bold text-purple-600 ml-3">
                      ${Math.round(svc.price).toLocaleString('es-AR')}
                    </Text>
                  </TouchableOpacity>
                )}
                ListFooterComponent={
                  <TouchableOpacity
                    onPress={() => setMode('manual')}
                    className="flex-row items-center gap-2 py-3.5 mt-1"
                    activeOpacity={0.7}
                  >
                    <PenLine size={14} color="#9CA3AF" />
                    <Text className="text-sm text-gray-400">Agregar servicio personalizado</Text>
                  </TouchableOpacity>
                }
              />
            )}
          </>
        ) : (
          <ScrollView className="flex-1 px-4 pt-4" keyboardShouldPersistTaps="handled">
            <View className="mb-4">
              <Text className="text-sm font-medium text-gray-700 mb-1.5">Descripción</Text>
              <TextInput
                className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-gray-900 text-base"
                value={desc}
                onChangeText={setDesc}
                placeholder="Ej: Corte de cabello, Manicura..."
                placeholderTextColor="#9CA3AF"
                autoFocus
                autoCapitalize="sentences"
                maxLength={200}
              />
            </View>

            <View className="mb-4">
              <Text className="text-sm font-medium text-gray-700 mb-1.5">Precio unitario</Text>
              <View className="flex-row items-center bg-gray-50 border border-gray-200 rounded-xl px-4">
                <Text className="text-gray-400 mr-1">$</Text>
                <TextInput
                  className="flex-1 py-3 text-gray-900 text-base"
                  value={price}
                  onChangeText={setPrice}
                  placeholder="0"
                  placeholderTextColor="#9CA3AF"
                  keyboardType="decimal-pad"
                />
              </View>
            </View>

            <View className="mb-4">
              <Text className="text-sm font-medium text-gray-700 mb-1.5">Cantidad</Text>
              <View className="flex-row items-center gap-4">
                <TouchableOpacity
                  onPress={() => setQty((q) => Math.max(1, q - 1))}
                  className="w-10 h-10 rounded-full bg-gray-100 items-center justify-center"
                  activeOpacity={0.7}
                >
                  <Minus size={16} color="#374151" />
                </TouchableOpacity>
                <Text className="text-lg font-bold text-gray-900 w-8 text-center">{qty}</Text>
                <TouchableOpacity
                  onPress={() => setQty((q) => q + 1)}
                  className="w-10 h-10 rounded-full bg-gray-100 items-center justify-center"
                  activeOpacity={0.7}
                >
                  <Plus size={16} color="#374151" />
                </TouchableOpacity>
              </View>
            </View>

            {error ? (
              <View className="bg-red-50 border border-red-200 rounded-xl px-4 py-3">
                <Text className="text-sm text-red-600">{error}</Text>
              </View>
            ) : null}
          </ScrollView>
        )}
      </SafeAreaView>
    </Modal>
  );
}

// ─── Calendar picker ─────────────────────────────────────────────────────────

const MONTH_NAMES = [
  'Enero','Febrero','Marzo','Abril','Mayo','Junio',
  'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre',
];
const DAY_NAMES = ['L','M','X','J','V','S','D'];

function isSameDay(a: Date, b: Date) {
  return a.getDate() === b.getDate() && a.getMonth() === b.getMonth() && a.getFullYear() === b.getFullYear();
}

function CalendarPicker({
  value,
  onChange,
}: {
  value: Date;
  onChange: (d: Date) => void;
}) {
  const [open, setOpen] = useState(false);
  const today = new Date();
  today.setHours(23, 59, 59, 999);

  const [viewYear, setViewYear]   = useState(value.getFullYear());
  const [viewMonth, setViewMonth] = useState(value.getMonth());

  function prevMonth() {
    if (viewMonth === 0) { setViewMonth(11); setViewYear((y) => y - 1); }
    else setViewMonth((m) => m - 1);
  }
  function nextMonth() {
    const limit = today.getMonth() === viewMonth && today.getFullYear() === viewYear;
    if (limit) return;
    if (viewMonth === 11) { setViewMonth(0); setViewYear((y) => y + 1); }
    else setViewMonth((m) => m + 1);
  }

  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const firstDow = new Date(viewYear, viewMonth, 1).getDay();
  const offset = (firstDow + 6) % 7;
  const cells: (number | null)[] = [
    ...Array(offset).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  const isToday    = (day: number) => isSameDay(new Date(viewYear, viewMonth, day), new Date());
  const isSelected = (day: number) => isSameDay(new Date(viewYear, viewMonth, day), value);
  const isFuture   = (day: number) => new Date(viewYear, viewMonth, day) > today;

  const atNextLimit = viewYear === today.getFullYear() && viewMonth === today.getMonth();

  const displayLabel = isSameDay(value, new Date())
    ? 'Hoy'
    : value.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' });

  return (
    <>
      <TouchableOpacity
        onPress={() => { setViewYear(value.getFullYear()); setViewMonth(value.getMonth()); setOpen(true); }}
        className="flex-row items-center gap-1.5 px-3 py-2 rounded-xl bg-gray-50 border border-gray-200"
        activeOpacity={0.7}
      >
        <CalendarDays size={14} color={isSameDay(value, new Date()) ? '#9CA3AF' : '#2563EB'} />
        <Text
          className="text-xs font-semibold"
          style={{ color: isSameDay(value, new Date()) ? '#6B7280' : '#2563EB' }}
        >
          {displayLabel}
        </Text>
      </TouchableOpacity>

      <Modal visible={open} transparent animationType="fade">
        <TouchableOpacity
          className="flex-1 bg-black/50"
          activeOpacity={1}
          onPress={() => setOpen(false)}
        />
        <View className="absolute bottom-0 left-0 right-0 bg-white rounded-t-3xl pb-8">
          <View className="flex-row items-center justify-between px-5 pt-5 pb-3 border-b border-gray-100">
            <Text className="text-base font-semibold text-gray-900">Fecha de la venta</Text>
            <TouchableOpacity onPress={() => setOpen(false)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <X size={20} color="#6B7280" />
            </TouchableOpacity>
          </View>

          <View className="flex-row items-center justify-between px-5 py-3">
            <TouchableOpacity onPress={prevMonth} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <ChevronLeft size={22} color="#374151" />
            </TouchableOpacity>
            <Text className="text-sm font-bold text-gray-900">
              {MONTH_NAMES[viewMonth]} {viewYear}
            </Text>
            <TouchableOpacity
              onPress={nextMonth}
              disabled={atNextLimit}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <ChevronRight size={22} color={atNextLimit ? '#D1D5DB' : '#374151'} />
            </TouchableOpacity>
          </View>

          <View className="flex-row px-4 pb-1">
            {DAY_NAMES.map((d) => (
              <Text key={d} className="flex-1 text-center text-xs font-semibold text-gray-400">{d}</Text>
            ))}
          </View>

          <View className="px-4 pb-4">
            {Array.from({ length: cells.length / 7 }, (_, row) => (
              <View key={row} className="flex-row">
                {cells.slice(row * 7, row * 7 + 7).map((day, col) => {
                  if (!day) return <View key={col} className="flex-1 h-9" />;
                  const selected = isSelected(day);
                  const future = isFuture(day);
                  const todayMark = isToday(day);
                  return (
                    <TouchableOpacity
                      key={col}
                      onPress={() => {
                        if (future) return;
                        onChange(new Date(viewYear, viewMonth, day, 12, 0, 0, 0));
                        setOpen(false);
                      }}
                      disabled={future}
                      className="flex-1 h-9 items-center justify-center"
                      activeOpacity={0.7}
                    >
                      <View
                        className={`w-8 h-8 rounded-full items-center justify-center ${
                          selected ? 'bg-blue-500' : todayMark ? 'bg-blue-50' : ''
                        }`}
                      >
                        <Text
                          className={`text-sm font-medium ${
                            future   ? 'text-gray-300' :
                            selected ? 'text-white font-bold' :
                            todayMark ? 'text-blue-600 font-semibold' :
                            'text-gray-800'
                          }`}
                        >
                          {day}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>
            ))}
          </View>

          {!isSameDay(value, new Date()) && (
            <TouchableOpacity
              onPress={() => { onChange(new Date()); setOpen(false); }}
              className="mx-5 py-3 rounded-xl bg-gray-100 items-center mb-2"
              activeOpacity={0.7}
            >
              <Text className="text-sm font-semibold text-gray-700">Volver a Hoy</Text>
            </TouchableOpacity>
          )}
        </View>
      </Modal>
    </>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function NewSaleScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [permission, requestPermission] = useCameraPermissions();

  const params = useLocalSearchParams<{ service?: string; servicePrice?: string }>();

  const [search, setSearch] = useState('');
  const [scanMode, setScanMode] = useState(false);
  const [cart, setCart] = useState<ProductCartItem[]>([]);
  const [serviceItems, setServiceItems] = useState<ServiceCartItem[]>([]);
  const [showAddService, setShowAddService] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash');
  const [saleDate, setSaleDate] = useState<Date>(new Date());
  const [discountPct, setDiscountPct] = useState('');
  const [surchargePct, setSurchargePct] = useState('');
  const [notes, setNotes] = useState('');
  const [received, setReceived] = useState('');
  const [showNotes, setShowNotes] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [stockWarningId, setStockWarningId] = useState<string | null>(null);
  const [successData, setSuccessData] = useState<{ total: number; itemCount: number; paymentMethod: PaymentMethod; isCustomDate: boolean } | null>(null);
  const scanning = useRef(false);

  // Pre-fill service item from turn params
  useEffect(() => {
    if (params.service && params.servicePrice) {
      const price = parseFloat(params.servicePrice);
      if (!isNaN(price) && price > 0) {
        setServiceItems([{ kind: 'service', id: String(Date.now()), description: params.service, unitPrice: price, quantity: 1 }]);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const { data: products = [] } = useQuery({
    queryKey: ['products'],
    queryFn: () => api.get<Product[]>('/products'),
  });

  // ─── Cart operations ────────────────────────────────────────────────────────

  function doAddToCart(product: Product) {
    setCart((prev) => {
      const found = prev.find((i) => i.product.id === product.id);
      if (found) {
        if (found.quantity >= product.stock) {
          setStockWarningId(product.id);
          setTimeout(() => setStockWarningId(null), 2500);
          return prev;
        }
        return prev.map((i) =>
          i.product.id === product.id ? { ...i, quantity: i.quantity + 1 } : i,
        );
      }
      return [...prev, { kind: 'product', product, quantity: 1 }];
    });
    setSearch('');
  }

  function addToCart(product: Product) {
    if (!product.salePrice) {
      Alert.alert(
        'Sin precio de venta',
        `"${product.name}" no tiene precio configurado. Se sumará $0 al total.`,
        [
          { text: 'Cancelar', style: 'cancel' },
          { text: 'Agregar igual', onPress: () => doAddToCart(product) },
        ],
      );
      return;
    }
    doAddToCart(product);
  }

  function increaseQty(productId: string) {
    setCart((prev) => {
      const item = prev.find((i) => i.product.id === productId);
      if (item && item.quantity >= item.product.stock) {
        setStockWarningId(productId);
        setTimeout(() => setStockWarningId(null), 2500);
        return prev;
      }
      return prev.map((i) =>
        i.product.id === productId ? { ...i, quantity: i.quantity + 1 } : i,
      );
    });
  }

  function decreaseQty(productId: string) {
    setCart((prev) =>
      prev
        .map((i) => i.product.id === productId ? { ...i, quantity: i.quantity - 1 } : i)
        .filter((i) => i.quantity > 0),
    );
  }

  function setQty(productId: string, qty: number) {
    setCart((prev) =>
      prev
        .map((i) => i.product.id === productId ? { ...i, quantity: qty } : i)
        .filter((i) => i.quantity > 0),
    );
  }

  function addServiceItem(item: Omit<ServiceCartItem, 'kind'>) {
    setServiceItems((prev) => [...prev, { kind: 'service', ...item }]);
  }

  function removeServiceItem(id: string) {
    setServiceItems((prev) => prev.filter((i) => i.id !== id));
  }

  function increaseServiceQty(id: string) {
    setServiceItems((prev) => prev.map((i) => i.id === id ? { ...i, quantity: i.quantity + 1 } : i));
  }

  function decreaseServiceQty(id: string) {
    setServiceItems((prev) =>
      prev
        .map((i) => i.id === id ? { ...i, quantity: i.quantity - 1 } : i)
        .filter((i) => i.quantity > 0),
    );
  }

  const productSubtotal = cart.reduce((sum, i) => sum + i.quantity * (i.product.salePrice ?? 0), 0);
  const serviceSubtotal = serviceItems.reduce((sum, i) => sum + i.quantity * i.unitPrice, 0);
  const subtotal = productSubtotal + serviceSubtotal;
  const discountNum = Math.min(100, Math.max(0, parseFloat(discountPct) || 0));
  const surchargeNum = Math.min(100, Math.max(0, parseFloat(surchargePct) || 0));
  const discountAmount = discountNum > 0 ? Math.round(subtotal * discountNum) / 100 : 0;
  const surchargeAmount = surchargeNum > 0 ? Math.round(subtotal * surchargeNum) / 100 : 0;
  const total = subtotal - discountAmount + surchargeAmount;
  const totalItems = cart.reduce((sum, i) => sum + i.quantity, 0) + serviceItems.reduce((sum, i) => sum + i.quantity, 0);
  const receivedNum = parseFloat(received) || 0;
  const change = paymentMethod === 'cash' && receivedNum > 0 ? receivedNum - total : null;

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
      .slice(0, 10);
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
      (p) => p.isActive && p.code?.trim().toLowerCase() === data.trim().toLowerCase(),
    );
    if (product) {
      addToCart(product);
      setTimeout(() => { scanning.current = false; }, 1000);
    } else {
      Alert.alert(
        'Código no encontrado',
        `No hay producto con código "${data}".`,
        [{ text: 'OK', onPress: () => { scanning.current = false; } }],
      );
    }
  }

  // ─── Close with confirmation ─────────────────────────────────────────────────

  function handleClose() {
    if (cart.length === 0 && serviceItems.length === 0) { router.back(); return; }
    Alert.alert(
      'Descartar venta',
      '¿Salir? Se perderán los ítems del carrito.',
      [
        { text: 'Seguir cargando', style: 'cancel' },
        { text: 'Descartar', style: 'destructive', onPress: () => router.back() },
      ],
    );
  }

  // ─── Submit ─────────────────────────────────────────────────────────────────

  async function handleConfirm() {
    if (cart.length === 0 && serviceItems.length === 0) return;
    setSubmitting(true);
    setError('');
    try {
      const today = new Date();
      const isCustomDate = !isSameDay(saleDate, today);
      await api.post('/sales', {
        items: [
          ...cart.map((i) => ({ productId: i.product.id, quantity: i.quantity })),
          ...serviceItems.map((i) => ({ description: i.description, unitPrice: i.unitPrice, quantity: i.quantity })),
        ],
        paymentMethod,
        ...(discountNum > 0 ? { discountPct: discountNum } : {}),
        ...(surchargeNum > 0 ? { surchargePct: surchargeNum } : {}),
        ...(notes.trim() ? { notes: notes.trim() } : {}),
        ...(isCustomDate ? { customDate: saleDate.toISOString() } : {}),
      });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['sales'], refetchType: 'all' }),
        queryClient.invalidateQueries({ queryKey: ['sales-summary'], refetchType: 'all' }),
        queryClient.invalidateQueries({ queryKey: ['sales-top'], refetchType: 'all' }),
        queryClient.invalidateQueries({ queryKey: ['sales-monthly-chart'], refetchType: 'all' }),
        queryClient.invalidateQueries({ queryKey: ['sales-monthly-summary'], refetchType: 'all' }),
        queryClient.invalidateQueries({ queryKey: ['products'], refetchType: 'all' }),
        queryClient.invalidateQueries({ queryKey: ['stock-movements-recent'], refetchType: 'all' }),
      ]);
      setSuccessData({ total, itemCount: totalItems, paymentMethod, isCustomDate: !isSameDay(saleDate, new Date()) });
      setTimeout(() => router.back(), 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo registrar la venta');
      setSubmitting(false);
    }
  }

  const canConfirm = (cart.length > 0 || serviceItems.length > 0) && !submitting && !successData;

  // Combined data for the FlatList
  const allEntries: CartEntry[] = [
    ...cart,
    ...serviceItems,
  ];

  // ─── Render ─────────────────────────────────────────────────────────────────

  return (
    <SafeAreaView className="flex-1 bg-white" edges={['top', 'bottom']}>
      {/* Header */}
      <View className="flex-row items-center justify-between px-4 py-4 border-b border-gray-100">
        <TouchableOpacity
          onPress={handleClose}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <X size={22} color="#6B7280" />
        </TouchableOpacity>
        <Text className="text-base font-semibold text-gray-900">Nueva venta</Text>
        <View style={{ width: 22 }} />
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
              <View className="absolute bottom-2 left-0 right-0 items-center">
                <View className="bg-black/40 px-3 py-1 rounded-full">
                  <Text className="text-white text-xs">Apuntá al código de barras</Text>
                </View>
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
        <View className="border-b border-gray-200 bg-white" style={{ maxHeight: 240 }}>
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
                  {item.salePrice ? (
                    <Text className="text-sm font-semibold text-gray-900">{formatCurrency(item.salePrice)}</Text>
                  ) : (
                    <View className="bg-amber-100 px-2 py-0.5 rounded-full">
                      <Text className="text-xs text-amber-700 font-medium">Sin precio</Text>
                    </View>
                  )}
                  <Text className="text-xs text-gray-400 mt-0.5">Stock: {item.stock}</Text>
                </View>
              </TouchableOpacity>
            )}
          />
        </View>
      )}

      {/* Cart */}
      <FlatList
        data={allEntries}
        keyExtractor={entryKey}
        keyboardShouldPersistTaps="handled"
        style={{ flex: 1 }}
        ListHeaderComponent={
          allEntries.length > 0 ? (
            <View className="px-4 py-2 bg-gray-50 border-b border-gray-100 flex-row justify-between">
              <Text className="text-xs text-gray-500 font-medium uppercase tracking-wide">Carrito</Text>
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
        ListFooterComponent={
          <TouchableOpacity
            onPress={() => setShowAddService(true)}
            className="flex-row items-center gap-2 px-4 py-3.5 border-t border-gray-100"
            activeOpacity={0.7}
          >
            <View className="w-6 h-6 rounded-full bg-purple-100 items-center justify-center">
              <Scissors size={12} color="#7C3AED" />
            </View>
            <Text className="text-sm text-purple-600 font-medium">Agregar servicio</Text>
          </TouchableOpacity>
        }
        renderItem={({ item: entry }) => {
          if (entry.kind === 'product') {
            return (
              <CartRow
                item={entry}
                onIncrease={() => increaseQty(entry.product.id)}
                onDecrease={() => decreaseQty(entry.product.id)}
                onSetQty={(qty) => setQty(entry.product.id, qty)}
                stockWarning={stockWarningId === entry.product.id}
              />
            );
          }
          return (
            <ServiceRow
              item={entry}
              onIncrease={() => increaseServiceQty(entry.id)}
              onDecrease={() => decreaseServiceQty(entry.id)}
              onRemove={() => removeServiceItem(entry.id)}
            />
          );
        }}
      />

      {/* Payment + Total + Confirm */}
      <View className="border-t border-gray-100 px-4 pt-3 pb-4 bg-white">

        {/* Payment method */}
        <View className="flex-row gap-2 mb-3">
          {PAYMENT_METHODS.map((pm) => (
            <TouchableOpacity
              key={pm.value}
              onPress={() => { setPaymentMethod(pm.value); setReceived(''); }}
              className={`flex-1 py-2.5 rounded-xl border items-center ${
                paymentMethod === pm.value ? 'bg-blue-500 border-blue-500' : 'bg-white border-gray-200'
              }`}
              activeOpacity={0.7}
            >
              <Text className={`text-xs font-semibold ${paymentMethod === pm.value ? 'text-white' : 'text-gray-600'}`}>
                {pm.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Cash calculator */}
        {paymentMethod === 'cash' && (
          <View className="bg-gray-50 border border-gray-200 rounded-2xl px-4 py-3 mb-3">
            <Text className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Efectivo recibido</Text>
            <View className="flex-row items-center gap-3">
              <View className="flex-1 flex-row items-center bg-white border border-gray-200 rounded-xl px-3">
                <Text className="text-base font-semibold text-gray-400 mr-1">$</Text>
                <TextInput
                  className="flex-1 py-2.5 text-xl font-bold text-gray-900"
                  value={received}
                  onChangeText={setReceived}
                  keyboardType="decimal-pad"
                  placeholder="0"
                  placeholderTextColor="#D1D5DB"
                />
              </View>
              {change !== null && (
                <View className={`items-center px-4 py-2 rounded-xl ${change >= 0 ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
                  <Text className="text-xs text-gray-400 mb-0.5">Vuelto</Text>
                  <Text className={`text-lg font-bold ${change >= 0 ? 'text-green-700' : 'text-red-600'}`}>
                    {formatCurrency(Math.abs(change))}
                  </Text>
                </View>
              )}
            </View>
          </View>
        )}

        {/* Descuento + Recargo */}
        <View className="flex-row gap-2 mb-3">
          <View className="flex-1 bg-gray-50 border border-gray-200 rounded-xl px-3 py-2">
            <Text className="text-xs text-gray-400 mb-1">Descuento %</Text>
            <View className="flex-row items-center">
              <TextInput
                className="flex-1 text-sm font-bold text-gray-900"
                value={discountPct}
                onChangeText={(t) => { if (/^\d{0,3}$/.test(t)) setDiscountPct(t); }}
                keyboardType="number-pad"
                placeholder="0"
                placeholderTextColor="#9CA3AF"
              />
              <Text className="text-xs text-gray-400">%</Text>
            </View>
            {discountAmount > 0 && (
              <Text className="text-xs font-semibold text-green-600 mt-0.5">−{formatCurrency(discountAmount)}</Text>
            )}
          </View>
          <View className="flex-1 bg-gray-50 border border-gray-200 rounded-xl px-3 py-2">
            <Text className="text-xs text-gray-400 mb-1">Recargo %</Text>
            <View className="flex-row items-center">
              <TextInput
                className="flex-1 text-sm font-bold text-gray-900"
                value={surchargePct}
                onChangeText={(t) => { if (/^\d{0,3}$/.test(t)) setSurchargePct(t); }}
                keyboardType="number-pad"
                placeholder="0"
                placeholderTextColor="#9CA3AF"
              />
              <Text className="text-xs text-gray-400">%</Text>
            </View>
            {surchargeAmount > 0 && (
              <Text className="text-xs font-semibold text-orange-500 mt-0.5">+{formatCurrency(surchargeAmount)}</Text>
            )}
          </View>
        </View>

        {/* Date + Notes */}
        <View className="flex-row items-center gap-2 mb-3">
          <CalendarPicker value={saleDate} onChange={setSaleDate} />
          <TouchableOpacity
            onPress={() => setShowNotes((v) => !v)}
            className={`flex-row items-center gap-1.5 px-3 py-2 rounded-xl border ${showNotes || notes.trim() ? 'bg-blue-50 border-blue-200' : 'bg-gray-50 border-gray-200'}`}
            activeOpacity={0.7}
          >
            <Text className={`text-xs font-semibold ${showNotes || notes.trim() ? 'text-blue-600' : 'text-gray-500'}`}>
              {notes.trim() ? '• Notas' : 'Notas'}
            </Text>
          </TouchableOpacity>
        </View>

        {showNotes && (
          <TextInput
            className="bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-900 mb-3"
            value={notes}
            onChangeText={setNotes}
            placeholder="Observaciones de la venta..."
            placeholderTextColor="#9CA3AF"
            multiline
            numberOfLines={2}
            textAlignVertical="top"
            maxLength={255}
          />
        )}

        {error ? (
          <View className="bg-red-50 border border-red-200 rounded-xl px-3 py-2 mb-3">
            <Text className="text-xs text-red-600">{error}</Text>
          </View>
        ) : null}

        <View className="flex-row items-center gap-3">
          <View>
            <Text className="text-xs text-gray-400">
              {discountAmount > 0 && surchargeAmount === 0 ? 'Con descuento' :
               surchargeAmount > 0 && discountAmount === 0 ? 'Con recargo' :
               discountAmount > 0 && surchargeAmount > 0 ? 'Con ajustes' : 'Total'}
            </Text>
            <Text className="text-2xl font-bold text-gray-900">{formatCurrency(total)}</Text>
            {(discountAmount > 0 || surchargeAmount > 0) && (
              <Text className="text-xs text-gray-400 line-through">{formatCurrency(subtotal)}</Text>
            )}
          </View>
          <TouchableOpacity
            onPress={() => void handleConfirm()}
            disabled={!canConfirm}
            className={`flex-1 py-4 rounded-2xl items-center ${canConfirm ? 'bg-blue-500' : 'bg-gray-200'}`}
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

      {/* Add service modal */}
      <AddServiceModal
        visible={showAddService}
        onClose={() => setShowAddService(false)}
        onAdd={addServiceItem}
      />

      {/* Success overlay */}
      {successData && (
        <SuccessOverlay
          total={successData.total}
          itemCount={successData.itemCount}
          paymentMethod={successData.paymentMethod}
          customDate={successData.isCustomDate ? saleDate : undefined}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  scanFrame: {
    width: 220,
    height: 100,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.8)',
    borderRadius: 8,
  },
});
