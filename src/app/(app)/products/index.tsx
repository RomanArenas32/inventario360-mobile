import {
  View, Text, FlatList, TextInput, TouchableOpacity,
  Alert, RefreshControl, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useState, useCallback } from 'react';
import { Search, Plus, Pencil, Trash2, AlertTriangle, Tag } from 'lucide-react-native';
import { api } from '@/lib/api';
import { editStore } from '@/lib/edit-store';
import { useAuthContext } from '@/lib/auth-context';
import type { Product, Category } from '@/lib/types';

type CatalogTab = 'products' | 'categories';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatPrice(v: number | null) {
  if (v == null) return '—';
  return `$${v.toLocaleString('es-AR')}`;
}

type StatusFilter = 'all' | 'active' | 'inactive';
type StockFilter = 'all' | 'low' | 'ok';

// ─── Filter Chip ──────────────────────────────────────────────────────────────

function Chip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      className={`px-3 py-1.5 rounded-full border mr-2 ${
        active ? 'bg-blue-500 border-blue-500' : 'bg-white border-gray-200'
      }`}
    >
      <Text className={`text-xs font-medium ${active ? 'text-white' : 'text-gray-600'}`}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

// ─── Product Card ─────────────────────────────────────────────────────────────

function ProductCard({
  product,
  isOwner,
  onEdit,
  onDelete,
}: {
  product: Product;
  isOwner: boolean;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const isLow = product.minStock > 0 && product.stock <= product.minStock;

  return (
    <View className="bg-white rounded-2xl p-4 mb-3 shadow-sm">
      {/* Row 1: name + code */}
      <View className="flex-row items-start justify-between mb-2">
        <View className="flex-1 mr-2">
          <Text className="text-base font-semibold text-gray-900" numberOfLines={1}>
            {product.name}
          </Text>
          {product.code ? (
            <Text className="text-xs text-gray-400 font-mono mt-0.5">{product.code}</Text>
          ) : null}
        </View>
        <View
          className={`px-2 py-0.5 rounded-full ${
            product.isActive ? 'bg-green-100' : 'bg-gray-100'
          }`}
        >
          <Text
            className={`text-xs font-medium ${
              product.isActive ? 'text-green-700' : 'text-gray-500'
            }`}
          >
            {product.isActive ? 'Activo' : 'Inactivo'}
          </Text>
        </View>
      </View>

      {/* Row 2: category + prices */}
      <View className="flex-row items-center gap-3 mb-2">
        {product.category ? (
          <View className="bg-purple-50 px-2 py-0.5 rounded-full">
            <Text className="text-xs text-purple-600">{product.category.name}</Text>
          </View>
        ) : null}
        <Text className="text-xs text-gray-400">
          Costo: <Text className="text-gray-600">{formatPrice(product.costPrice)}</Text>
        </Text>
        <Text className="text-xs text-gray-400">
          Venta: <Text className="text-gray-700 font-medium">{formatPrice(product.salePrice)}</Text>
        </Text>
      </View>

      {/* Row 3: stock + actions */}
      <View className="flex-row items-center justify-between">
        <View className="flex-row items-center gap-1.5">
          {isLow && <AlertTriangle size={13} color="#F59E0B" />}
          <Text className={`text-sm font-semibold ${isLow ? 'text-amber-500' : 'text-gray-700'}`}>
            Stock: {product.stock}
          </Text>
          {product.minStock > 0 && (
            <Text className="text-xs text-gray-400">/ mín {product.minStock}</Text>
          )}
        </View>

        {isOwner && (
          <View className="flex-row gap-1">
            <TouchableOpacity
              onPress={onEdit}
              className="p-2 rounded-xl bg-gray-50"
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Pencil size={14} color="#6B7280" />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={onDelete}
              className="p-2 rounded-xl bg-gray-50"
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Trash2 size={14} color="#EF4444" />
            </TouchableOpacity>
          </View>
        )}
      </View>
    </View>
  );
}

// ─── Category Card ────────────────────────────────────────────────────────────

function CategoryCard({
  category,
  isOwner,
  onEdit,
  onDelete,
}: {
  category: Category;
  isOwner: boolean;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <View className="bg-white rounded-2xl px-4 py-3.5 mb-3 shadow-sm flex-row items-center">
      <View className="flex-1 mr-3">
        <Text className="text-base font-semibold text-gray-900">{category.name}</Text>
        {category.description ? (
          <Text className="text-sm text-gray-400 mt-0.5" numberOfLines={1}>
            {category.description}
          </Text>
        ) : null}
      </View>
      {isOwner && (
        <View className="flex-row gap-1">
          <TouchableOpacity
            onPress={onEdit}
            className="p-2 rounded-xl bg-gray-50"
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Pencil size={14} color="#6B7280" />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={onDelete}
            className="p-2 rounded-xl bg-gray-50"
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Trash2 size={14} color="#EF4444" />
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function ProductsScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { tenantRole } = useAuthContext();
  const isOwner = tenantRole === 'owner';

  const [activeTab, setActiveTab] = useState<CatalogTab>('products');

  // Products state
  const [productSearch, setProductSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [stockFilter, setStockFilter] = useState<StockFilter>('all');
  const [refreshingProducts, setRefreshingProducts] = useState(false);

  // Categories state
  const [categorySearch, setCategorySearch] = useState('');
  const [refreshingCategories, setRefreshingCategories] = useState(false);

  const { data: products = [], isLoading: loadingProducts } = useQuery({
    queryKey: ['products', { productSearch, statusFilter, stockFilter }],
    queryFn: () => {
      const params = new URLSearchParams();
      if (productSearch) params.set('search', productSearch);
      if (statusFilter !== 'all') params.set('isActive', String(statusFilter === 'active'));
      if (stockFilter !== 'all') params.set('stock', stockFilter);
      const qs = params.toString();
      return api.get<Product[]>(`/products${qs ? `?${qs}` : ''}`);
    },
  });

  const { data: categories = [], isLoading: loadingCategories } = useQuery({
    queryKey: ['categories', { categorySearch }],
    queryFn: () => {
      const qs = categorySearch ? `?search=${encodeURIComponent(categorySearch)}` : '';
      return api.get<Category[]>(`/categories${qs}`);
    },
  });

  const onRefreshProducts = useCallback(async () => {
    setRefreshingProducts(true);
    await queryClient.invalidateQueries({ queryKey: ['products'] });
    setRefreshingProducts(false);
  }, [queryClient]);

  const onRefreshCategories = useCallback(async () => {
    setRefreshingCategories(true);
    await queryClient.invalidateQueries({ queryKey: ['categories'] });
    setRefreshingCategories(false);
  }, [queryClient]);

  function openNewProduct() {
    editStore.clearProduct();
    router.push('/(modals)/product-form' as never);
  }

  function openEditProduct(product: Product) {
    editStore.setProduct(product);
    router.push('/(modals)/product-form' as never);
  }

  function openNewCategory() {
    editStore.clearCategory();
    router.push('/(modals)/category-form' as never);
  }

  function openEditCategory(category: Category) {
    editStore.setCategory(category);
    router.push('/(modals)/category-form' as never);
  }

  function confirmDeleteProduct(product: Product) {
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
              void queryClient.invalidateQueries({ queryKey: ['products'] });
            });
          },
        },
      ],
    );
  }

  function confirmDeleteCategory(category: Category) {
    Alert.alert(
      'Eliminar categoría',
      `¿Eliminar "${category.name}"? Los productos con esta categoría quedarán sin categoría.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: () => {
            void api.delete(`/categories/${category.id}`).then(() => {
              void queryClient.invalidateQueries({ queryKey: ['categories'] });
              void queryClient.invalidateQueries({ queryKey: ['products'] });
            });
          },
        },
      ],
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-gray-50">
      {/* Header */}
      <View className="px-4 pt-4 pb-2">
        <View className="flex-row items-center justify-between mb-3">
          <View>
            <Text className="text-2xl font-bold text-gray-900">Productos</Text>
            <Text className="text-sm text-gray-400 mt-0.5">Gestioná tu catálogo y categorías</Text>
          </View>
          {isOwner && (
            <TouchableOpacity
              onPress={activeTab === 'products' ? openNewProduct : openNewCategory}
              className="bg-blue-500 w-10 h-10 rounded-full items-center justify-center shadow-sm"
            >
              <Plus size={20} color="white" />
            </TouchableOpacity>
          )}
        </View>

        {/* Tab switcher */}
        <View className="flex-row border-b border-gray-200">
          <TouchableOpacity
            onPress={() => setActiveTab('products')}
            className={`flex-row items-center gap-1.5 pb-2.5 mr-6 border-b-2 ${
              activeTab === 'products' ? 'border-blue-500' : 'border-transparent'
            }`}
          >
            <Text
              className={`text-sm font-semibold ${
                activeTab === 'products' ? 'text-blue-500' : 'text-gray-400'
              }`}
            >
              Productos
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setActiveTab('categories')}
            className={`flex-row items-center gap-1.5 pb-2.5 border-b-2 ${
              activeTab === 'categories' ? 'border-blue-500' : 'border-transparent'
            }`}
          >
            <Tag
              size={13}
              color={activeTab === 'categories' ? '#3B82F6' : '#9CA3AF'}
            />
            <Text
              className={`text-sm font-semibold ${
                activeTab === 'categories' ? 'text-blue-500' : 'text-gray-400'
              }`}
            >
              Categorías
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* ── Products tab ─────────────────────────────────────────────────────── */}
      {activeTab === 'products' && (
        <>
          {/* Search */}
          <View className="mx-4 mt-3 mb-3 flex-row items-center bg-white border border-gray-200 rounded-xl px-3 gap-2">
            <Search size={16} color="#9CA3AF" />
            <TextInput
              className="flex-1 py-2.5 text-gray-900 text-sm"
              placeholder="Buscar por nombre o código..."
              placeholderTextColor="#9CA3AF"
              value={productSearch}
              onChangeText={setProductSearch}
              clearButtonMode="while-editing"
            />
          </View>

          {/* Filters */}
          <View className="mb-3">
            <FlatList
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ paddingHorizontal: 16 }}
              data={[
                { key: 'all-s', label: 'Todos', onPress: () => setStatusFilter('all'), active: statusFilter === 'all' },
                { key: 'active', label: 'Activos', onPress: () => setStatusFilter('active'), active: statusFilter === 'active' },
                { key: 'inactive', label: 'Inactivos', onPress: () => setStatusFilter('inactive'), active: statusFilter === 'inactive' },
                { key: 'sep', label: '|', onPress: () => {}, active: false },
                { key: 'all-st', label: 'Todo stock', onPress: () => setStockFilter('all'), active: stockFilter === 'all' },
                { key: 'low', label: 'Stock bajo', onPress: () => setStockFilter('low'), active: stockFilter === 'low' },
                { key: 'ok', label: 'Stock OK', onPress: () => setStockFilter('ok'), active: stockFilter === 'ok' },
              ]}
              keyExtractor={(item) => item.key}
              renderItem={({ item }) =>
                item.key === 'sep' ? (
                  <View className="w-px bg-gray-200 mx-1 my-1.5" />
                ) : (
                  <Chip label={item.label} active={item.active} onPress={item.onPress} />
                )
              }
            />
          </View>

          {loadingProducts ? (
            <View className="flex-1 items-center justify-center">
              <ActivityIndicator color="#208AEF" />
            </View>
          ) : (
            <FlatList
              data={products}
              keyExtractor={(p) => p.id}
              contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24 }}
              refreshControl={
                <RefreshControl refreshing={refreshingProducts} onRefresh={() => void onRefreshProducts()} tintColor="#208AEF" />
              }
              ListEmptyComponent={
                <View className="items-center py-16">
                  <Text className="text-gray-400 text-sm">
                    {productSearch || statusFilter !== 'all' || stockFilter !== 'all'
                      ? 'No se encontraron productos con ese criterio.'
                      : 'No hay productos. Agregá el primero.'}
                  </Text>
                </View>
              }
              renderItem={({ item }) => (
                <ProductCard
                  product={item}
                  isOwner={isOwner}
                  onEdit={() => openEditProduct(item)}
                  onDelete={() => confirmDeleteProduct(item)}
                />
              )}
            />
          )}
        </>
      )}

      {/* ── Categories tab ───────────────────────────────────────────────────── */}
      {activeTab === 'categories' && (
        <>
          {/* Search */}
          <View className="mx-4 mt-3 mb-4 flex-row items-center bg-white border border-gray-200 rounded-xl px-3 gap-2">
            <Search size={16} color="#9CA3AF" />
            <TextInput
              className="flex-1 py-2.5 text-gray-900 text-sm"
              placeholder="Buscar categoría..."
              placeholderTextColor="#9CA3AF"
              value={categorySearch}
              onChangeText={setCategorySearch}
              clearButtonMode="while-editing"
            />
          </View>

          {loadingCategories ? (
            <View className="flex-1 items-center justify-center">
              <ActivityIndicator color="#208AEF" />
            </View>
          ) : (
            <FlatList
              data={categories}
              keyExtractor={(c) => c.id}
              contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24 }}
              refreshControl={
                <RefreshControl refreshing={refreshingCategories} onRefresh={() => void onRefreshCategories()} tintColor="#208AEF" />
              }
              ListEmptyComponent={
                <View className="items-center py-16">
                  <Text className="text-gray-400 text-sm">
                    {categorySearch ? 'No se encontraron categorías.' : 'No hay categorías. Creá la primera.'}
                  </Text>
                </View>
              }
              renderItem={({ item }) => (
                <CategoryCard
                  category={item}
                  isOwner={isOwner}
                  onEdit={() => openEditCategory(item)}
                  onDelete={() => confirmDeleteCategory(item)}
                />
              )}
            />
          )}
        </>
      )}
    </SafeAreaView>
  );
}
