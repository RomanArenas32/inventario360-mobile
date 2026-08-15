import {
  View, Text, TextInput, ScrollView, TouchableOpacity,
  Switch, Modal, FlatList, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { ChevronDown, X, Check } from 'lucide-react-native';
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
  const selected = categories.find((c) => c.id === value);

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
            <TouchableOpacity onPress={() => setOpen(false)}>
              <X size={20} color="#6B7280" />
            </TouchableOpacity>
          </View>

          <FlatList
            data={[{ id: '', name: 'Sin categoría' }, ...categories]}
            keyExtractor={(c) => c.id || 'none'}
            renderItem={({ item }) => (
              <TouchableOpacity
                className="flex-row items-center justify-between px-4 py-4 border-b border-gray-100"
                onPress={() => { onChange(item.id); setOpen(false); }}
              >
                <Text className="text-base text-gray-900">{item.name}</Text>
                {value === item.id && <Check size={18} color="#208AEF" />}
              </TouchableOpacity>
            )}
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
      await queryClient.invalidateQueries({ queryKey: ['products'] });
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
          <TextInput
            className={`${inputCls} font-mono`}
            value={form.code}
            onChangeText={(v) => set('code', v)}
            placeholder="Ej: 7790001"
            placeholderTextColor="#9CA3AF"
            autoCapitalize="none"
          />
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

        <View className="flex-row items-center justify-between bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 mb-4">
          <Text className="text-base text-gray-900">Producto activo</Text>
          <Switch
            value={form.isActive}
            onValueChange={(v) => set('isActive', v)}
            trackColor={{ false: '#E5E7EB', true: '#BFDBFE' }}
            thumbColor={form.isActive ? '#208AEF' : '#9CA3AF'}
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
