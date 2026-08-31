import {
  View, Text, TextInput, ScrollView, TouchableOpacity,
  Switch, Modal, FlatList, ActivityIndicator, StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState, useMemo, useRef } from 'react';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { ChevronDown, X, Check, Search, ScanLine } from 'lucide-react-native';
import { api } from '@/lib/api';
import { editStore } from '@/lib/edit-store';
import type { Category, Product } from '@/lib/types';

// ─── Form field ────────────────────────────────────────────────────────────────

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <View className="mb-4">
      <Text className="text-sm font-medium text-gray-700 mb-1.5">
        {label}
        {required && <Text className="text-red-500"> *</Text>}
      </Text>
      {children}
    </View>
  );
}

const inputCls = 'bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-gray-900 text-base';

// ─── Category picker ───────────────────────────────────────────────────────────

function CategoryPicker({
  value,
  onChange,
  categories,
}: {
  value: string;
  onChange: (id: string) => void;
  categories: Category[];
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const selected = categories.find((c) => c.id === value);

  const filtered = useMemo(() => {
    const all = [{ id: '', name: 'Sin categoría' }, ...categories];
    if (!search.trim()) return all;
    const q = search.trim().toLowerCase();
    return all.filter((c) => c.name.toLowerCase().includes(q));
  }, [categories, search]);

  function handleClose() {
    setSearch('');
    setOpen(false);
  }

  return (
    <>
      <TouchableOpacity
        onPress={() => setOpen(true)}
        className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 flex-row justify-between items-center"
      >
        <Text className={selected ? 'text-gray-900 text-base' : 'text-gray-400 text-base'}>
          {selected?.name ?? 'Sin categoría'}
        </Text>
        <ChevronDown size={16} color="#9CA3AF" />
      </TouchableOpacity>

      <Modal visible={open} animationType="slide" presentationStyle="pageSheet">
        <SafeAreaView className="flex-1 bg-white">
          <View className="px-4 py-4 border-b border-gray-100 flex-row justify-between items-center">
            <Text className="text-lg font-semibold text-gray-900">Categoría</Text>
            <TouchableOpacity onPress={handleClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <X size={20} color="#6B7280" />
            </TouchableOpacity>
          </View>

          {/* Buscador */}
          <View className="mx-4 my-3 flex-row items-center bg-gray-50 border border-gray-200 rounded-xl px-3 gap-2">
            <Search size={15} color="#9CA3AF" />
            <TextInput
              className="flex-1 py-2.5 text-gray-900 text-sm"
              placeholder="Buscar categoría..."
              placeholderTextColor="#9CA3AF"
              value={search}
              onChangeText={setSearch}
              autoFocus
              clearButtonMode="while-editing"
            />
          </View>

          <FlatList
            data={filtered}
            keyExtractor={(c) => c.id || 'none'}
            keyboardShouldPersistTaps="handled"
            renderItem={({ item }) => (
              <TouchableOpacity
                className="flex-row items-center justify-between px-4 py-4 border-b border-gray-100"
                onPress={() => { onChange(item.id); handleClose(); }}
              >
                <Text className="text-base text-gray-900">{item.name}</Text>
                {value === item.id && <Check size={18} color="#208AEF" />}
              </TouchableOpacity>
            )}
            ListEmptyComponent={
              <View className="items-center py-12">
                <Text className="text-gray-400 text-sm">Sin resultados para "{search}"</Text>
              </View>
            }
          />
        </SafeAreaView>
      </Modal>
    </>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

type FormState = {
  name: string;
  code: string;
  description: string;
  costPrice: string;
  salePrice: string;
  stock: string;
  minStock: string;
  categoryId: string;
  isActive: boolean;
};

function getInitialForm(product: Product | null): FormState {
  if (!product) return { name: '', code: '', description: '', costPrice: '', salePrice: '', stock: '0', minStock: '0', categoryId: '', isActive: true };
  return {
    name: product.name,
    code: product.code ?? '',
    description: product.description ?? '',
    costPrice: product.costPrice?.toString() ?? '',
    salePrice: product.salePrice?.toString() ?? '',
    stock: product.stock.toString(),
    minStock: product.minStock.toString(),
    categoryId: product.category?.id ?? '',
    isActive: product.isActive,
  };
}

export default function ProductFormScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();

  const product = editStore.getProduct();
  const isEditing = !!product;

  const [form, setForm] = useState<FormState>(() => getInitialForm(product));
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const [scannerOpen, setScannerOpen] = useState(false);
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const scannerBusy = useRef(false);

  async function handleOpenScanner() {
    if (!cameraPermission?.granted) {
      const result = await requestCameraPermission();
      if (!result.granted) return;
    }
    scannerBusy.current = false;
    setScannerOpen(true);
  }

  function handleCodeScanned({ data }: { data: string }) {
    if (scannerBusy.current) return;
    scannerBusy.current = true;
    setScannerOpen(false);
    setForm((f) => ({ ...f, code: data.trim() }));
  }

  const { data: categories = [] } = useQuery({
    queryKey: ['categories'],
    queryFn: () => api.get<Category[]>('/categories'),
  });

  function set(field: keyof FormState, value: string | boolean) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function handleSubmit() {
    if (!form.name.trim()) { setError('El nombre es obligatorio'); return; }
    setSubmitting(true);
    setError('');
    try {
      const body = {
        name: form.name.trim(),
        code: form.code.trim() || undefined,
        description: form.description.trim() || undefined,
        costPrice: form.costPrice ? parseFloat(form.costPrice) : undefined,
        salePrice: form.salePrice ? parseFloat(form.salePrice) : undefined,
        minStock: parseInt(form.minStock, 10) || 0,
        categoryId: form.categoryId || (isEditing ? null : undefined),
        isActive: form.isActive,
        ...(!isEditing && { stock: parseInt(form.stock, 10) || 0 }),
      };
      if (isEditing) {
        await api.patch(`/products/${product!.id}`, body);
      } else {
        await api.post('/products', body);
      }
      await queryClient.invalidateQueries({ queryKey: ['products'], refetchType: 'all' });
      editStore.clearProduct();
      router.back();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al guardar');
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
        <Text className="text-base font-semibold text-gray-900">
          {isEditing ? 'Editar producto' : 'Nuevo producto'}
        </Text>
        <TouchableOpacity onPress={() => void handleSubmit()} disabled={submitting}>
          {submitting ? (
            <ActivityIndicator size="small" color="#208AEF" />
          ) : (
            <Text className="text-blue-500 font-semibold text-base">Guardar</Text>
          )}
        </TouchableOpacity>
      </View>

      <ScrollView
        className="flex-1 px-4 pt-4"
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Field label="Nombre" required>
          <TextInput
            className={inputCls}
            value={form.name}
            onChangeText={(v) => set('name', v)}
            placeholder="Nombre del producto"
            placeholderTextColor="#9CA3AF"
          />
        </Field>

        <Field label="Código">
          <View className="flex-row gap-2">
            <TextInput
              className={`${inputCls} flex-1 font-mono`}
              value={form.code}
              onChangeText={(v) => set('code', v)}
              placeholder="Ej: 7790001"
              placeholderTextColor="#9CA3AF"
              autoCapitalize="none"
            />
            <TouchableOpacity
              onPress={() => void handleOpenScanner()}
              className="bg-gray-50 border border-gray-200 rounded-xl px-3.5 items-center justify-center"
              activeOpacity={0.7}
            >
              <ScanLine size={20} color="#208AEF" />
            </TouchableOpacity>
          </View>
        </Field>

        <Field label="Categoría">
          <CategoryPicker
            value={form.categoryId}
            onChange={(id) => set('categoryId', id)}
            categories={categories}
          />
        </Field>

        <View className="flex-row gap-3">
          <View className="flex-1">
            <Field label="Precio de costo">
              <TextInput
                className={inputCls}
                value={form.costPrice}
                onChangeText={(v) => set('costPrice', v)}
                placeholder="0.00"
                placeholderTextColor="#9CA3AF"
                keyboardType="decimal-pad"
              />
            </Field>
          </View>
          <View className="flex-1">
            <Field label="Precio de venta">
              <TextInput
                className={inputCls}
                value={form.salePrice}
                onChangeText={(v) => set('salePrice', v)}
                placeholder="0.00"
                placeholderTextColor="#9CA3AF"
                keyboardType="decimal-pad"
              />
            </Field>
          </View>
        </View>

        <View className="flex-row gap-3">
          {!isEditing && (
            <View className="flex-1">
              <Field label="Stock inicial">
                <TextInput
                  className={inputCls}
                  value={form.stock}
                  onChangeText={(v) => set('stock', v)}
                  keyboardType="number-pad"
                  placeholderTextColor="#9CA3AF"
                />
              </Field>
            </View>
          )}
          <View className="flex-1">
            <Field label="Stock mínimo">
              <TextInput
                className={inputCls}
                value={form.minStock}
                onChangeText={(v) => set('minStock', v)}
                keyboardType="number-pad"
                placeholderTextColor="#9CA3AF"
              />
            </Field>
          </View>
        </View>

        {isEditing && (
          <View className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 mb-4">
            <Text className="text-xs text-amber-700">
              Para modificar el stock actual usá la sección Stock → Registrar movimiento.
            </Text>
          </View>
        )}

        <Field label="Descripción">
          <TextInput
            className={`${inputCls} min-h-20`}
            value={form.description}
            onChangeText={(v) => set('description', v)}
            placeholder="Descripción opcional"
            placeholderTextColor="#9CA3AF"
            multiline
            numberOfLines={3}
            textAlignVertical="top"
          />
        </Field>

        {isEditing && (
          <View className="flex-row items-center justify-between bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 mb-4">
            <Text className="text-base text-gray-900">Producto activo</Text>
            <Switch
              value={form.isActive}
              onValueChange={(v) => set('isActive', v)}
              trackColor={{ false: '#E5E7EB', true: '#BFDBFE' }}
              thumbColor={form.isActive ? '#208AEF' : '#9CA3AF'}
            />
          </View>
        )}

        {error ? (
          <View className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 mb-4">
            <Text className="text-sm text-red-600">{error}</Text>
          </View>
        ) : null}

        <View className="h-8" />
      </ScrollView>

      {/* Inline barcode scanner */}
      <Modal visible={scannerOpen} animationType="slide" statusBarTranslucent>
        <View style={StyleSheet.absoluteFill}>
          <CameraView
            style={StyleSheet.absoluteFill}
            facing="back"
            barcodeScannerSettings={{ barcodeTypes: ['ean13', 'ean8', 'code128', 'code39', 'qr', 'upc_a', 'upc_e'] }}
            onBarcodeScanned={handleCodeScanned}
          />
          <SafeAreaView style={StyleSheet.absoluteFill} pointerEvents="box-none">
            <View className="flex-row justify-end px-4 pt-4">
              <TouchableOpacity
                onPress={() => setScannerOpen(false)}
                className="bg-black/50 rounded-full p-2"
                activeOpacity={0.8}
              >
                <X size={22} color="white" />
              </TouchableOpacity>
            </View>
            <View className="flex-1 items-center justify-center">
              <View style={scanStyles.viewfinder}>
                <View style={[scanStyles.corner, scanStyles.topLeft]} />
                <View style={[scanStyles.corner, scanStyles.topRight]} />
                <View style={[scanStyles.corner, scanStyles.bottomLeft]} />
                <View style={[scanStyles.corner, scanStyles.bottomRight]} />
              </View>
              <Text className="text-white text-sm mt-4 opacity-80">
                Apuntá al código de barras del producto
              </Text>
            </View>
          </SafeAreaView>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const VIEWFINDER = 240;
const CORNER = 24;
const THICKNESS = 3;

const scanStyles = StyleSheet.create({
  viewfinder: { width: VIEWFINDER, height: VIEWFINDER, position: 'relative' },
  corner: { position: 'absolute', width: CORNER, height: CORNER, borderColor: 'white' },
  topLeft:     { top: 0,    left: 0,  borderTopWidth: THICKNESS,    borderLeftWidth: THICKNESS,  borderTopLeftRadius: 4 },
  topRight:    { top: 0,    right: 0, borderTopWidth: THICKNESS,    borderRightWidth: THICKNESS, borderTopRightRadius: 4 },
  bottomLeft:  { bottom: 0, left: 0,  borderBottomWidth: THICKNESS, borderLeftWidth: THICKNESS,  borderBottomLeftRadius: 4 },
  bottomRight: { bottom: 0, right: 0, borderBottomWidth: THICKNESS, borderRightWidth: THICKNESS, borderBottomRightRadius: 4 },
});
