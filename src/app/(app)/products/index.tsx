import {
  View, Text, FlatList, TextInput, TouchableOpacity,
  Alert, RefreshControl, ActivityIndicator,
} from 'react-native';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useState, useCallback, useMemo } from 'react';
import { useFocusRefresh } from '@/lib/use-focus-refresh';
import { Search, Plus, Pencil, Trash2, AlertTriangle, Tag, ScanLine, X } from 'lucide-react-native';
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

type StockFilter = 'all' | 'low' | 'empty';

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
  onPress,
  onEdit,
  onDelete,
}: {
  product: Product;
  isOwner: boolean;
  onPress: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const isEmpty = product.stock === 0;
  const isLow = !isEmpty && product.minStock > 0 && product.stock <= product.minStock;
  const stockColor = isEmpty ? '#EF4444' : isLow ? '#F59E0B' : '#10B981';

  return (
    <TouchableOpacity
      onPress={onPress}
      className="bg-white rounded-2xl p-4 mb-3 shadow-sm"
      activeOpacity={0.72}
    >
      {/* Row 1: name + sale price */}
      <View className="flex-row items-start justify-between mb-2">
        <View className="flex-1 mr-3">
          <Text className="text-base font-semibold text-gray-900" numberOfLines={1}>
            {product.name}
          </Text>
          {product.code ? (
            <Text className="text-xs text-gray-400 font-mono mt-0.5">{product.code}</Text>
          ) : null}
        </View>
        <Text className="text-xl font-bold text-gray-900">{formatPrice(product.salePrice)}</Text>
      </View>

      {/* Row 2: category + stock */}
      <View className="flex-row items-center justify-between">
        <View className="flex-row items-center gap-2">
          {product.category ? (
            <View className="flex-row items-center gap-1 bg-purple-50 px-2 py-0.5 rounded-full">
              <Tag size={10} color="#7C3AED" />
              <Text className="text-xs text-purple-600">{product.category.name}</Text>
            </View>
          ) : null}
        </View>

        <View className="flex-row items-center gap-1.5">
          {(isEmpty || isLow) && <AlertTriangle size={12} color={stockColor} />}
          <Text className="text-sm font-bold" style={{ color: stockColor }}>
            {isEmpty ? 'Sin stock' : `${product.stock} en stock`}
          </Text>
        </View>
      </View>

      {/* Row 3: actions (owner only) */}
      {isOwner && (
        <View className="flex-row justify-end gap-1 mt-3 pt-2.5 border-t border-gray-50">
          <TouchableOpacity
            onPress={onEdit}
            className="p-2 rounded-xl bg-gray-50"
            hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
          >
            <Pencil size={14} color="#6B7280" />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={onDelete}
            className="p-2 rounded-xl bg-gray-50"
            hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
          >
            <Trash2 size={14} color="#EF4444" />
          </TouchableOpacity>
        </View>
      )}
    </TouchableOpacity>
  );
}

// ─── Category Card ────────────────────────────────────────────────────────────

function CategoryCard({
  category,
  productCount,
  isOwner,
  onPress,
  onEdit,
  onDelete,
}: {
  category: Category;
  productCount: number;
  isOwner: boolean;
  onPress: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      className="bg-white rounded-2xl px-4 py-3.5 mb-3 shadow-sm"
      activeOpacity={0.72}
    >
      <View className="flex-row items-center">
        <View className="flex-1 mr-3">
          <Text className="text-base font-semibold text-gray-900">{category.name}</Text>
          {category.description ? (
            <Text className="text-sm text-gray-400 mt-0.5" numberOfLines={1}>
              {category.description}
            </Text>
          ) : null}
        </View>

        {/* Product count badge */}
        <View className={`px-2.5 py-1 rounded-full mr-2 ${productCount === 0 ? 'bg-gray-100' : 'bg-blue-50'}`}>
          <Text className={`text-xs font-semibold ${productCount === 0 ? 'text-gray-400' : 'text-blue-600'}`}>
            {productCount === 0 ? 'Vacía' : `${productCount} prod.`}
          </Text>
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
    </TouchableOpacity>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function ProductsScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { tenantRole } = useAuthContext();
  const isOwner = tenantRole === 'owner';

  useFocusRefresh([['products'], ['categories']]);

  const [activeTab, setActiveTab] = useState<CatalogTab>('products');

  // Products state
  const [productSearch, setProductSearch] = useState('');
  const [stockFilter, setStockFilter] = useState<StockFilter>('all');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [refreshingProducts, setRefreshingProducts] = useState(false);

  // Categories state
  const [categorySearch, setCategorySearch] = useState('');
  const [refreshingCategories, setRefreshingCategories] = useState(false);

  // Delete confirm state
  const [deleteProduct, setDeleteProduct] = useState<Product | null>(null);
  const [deleteCategory, setDeleteCategory] = useState<Category | null>(null);
  const [deleting, setDeleting] = useState(false);

  const { data: products = [], isLoading: loadingProducts } = useQuery({
    queryKey: ['products', { productSearch, stockFilter }],
    queryFn: () => {
      const params = new URLSearchParams();
      if (productSearch) params.set('search', productSearch);
      if (stockFilter !== 'all') params.set('stock', stockFilter);
      const qs = params.toString();
      return api.get<Product[]>(`/products${qs ? `?${qs}` : ''}`);
    },
  });

  // Query sin filtros para contar productos por categoría
  const { data: allProducts = [] } = useQuery({
    queryKey: ['products', { productSearch: '', stockFilter: 'all' }],
    queryFn: () => api.get<Product[]>('/products'),
  });

  const productCountByCategory = useMemo(() => {
    const map: Record<string, number> = {};
    for (const p of allProducts) {
      if (p.category?.id) {
        map[p.category.id] = (map[p.category.id] ?? 0) + 1;
      }
    }
    return map;
  }, [allProducts]);

  const uncategorizedCount = useMemo(
    () => allProducts.filter((p) => !p.category?.id).length,
    [allProducts],
  );

  // Filtro de categoría aplicado client-side
  // categoryFilter === '__none__' → sin categoría
  const displayedProducts = useMemo(() => {
    if (!categoryFilter) return products;
    if (categoryFilter === '__none__') return products.filter((p) => !p.category?.id);
    return products.filter((p) => p.category?.id === categoryFilter);
  }, [products, categoryFilter]);

  const { data: categories = [], isLoading: loadingCategories } = useQuery({
    queryKey: ['categories', { categorySearch }],
    queryFn: () => {
      const qs = categorySearch ? `?search=${encodeURIComponent(categorySearch)}` : '';
      return api.get<Category[]>(`/categories${qs}`);
    },
  });

  const activeCategoryName = useMemo(() => {
    if (categoryFilter === '__none__') return 'Sin categoría';
    return categories.find((c) => c.id === categoryFilter)?.name ?? '';
  }, [categories, categoryFilter]);

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

  async function handleDeleteProduct() {
    if (!deleteProduct) return;
    setDeleting(true);
    try {
      await api.delete(`/products/${deleteProduct.id}`);
      void queryClient.invalidateQueries({ queryKey: ['products'] });
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'No se pudo eliminar');
    } finally {
      setDeleting(false);
      setDeleteProduct(null);
    }
  }

  async function handleDeleteCategory() {
    if (!deleteCategory) return;
    setDeleting(true);
    try {
      await api.delete(`/categories/${deleteCategory.id}`);
      void queryClient.invalidateQueries({ queryKey: ['categories'] });
      void queryClient.invalidateQueries({ queryKey: ['products'] });
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'No se pudo eliminar');
    } finally {
      setDeleting(false);
      setDeleteCategory(null);
    }
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
          {/* Search + scan */}
          <View className="mx-4 mt-3 mb-3 flex-row items-center gap-2">
            <View className="flex-1 flex-row items-center bg-white border border-gray-200 rounded-xl px-3 gap-2">
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
            <TouchableOpacity
              onPress={() => router.push({ pathname: '/(modals)/scan', params: { mode: 'product' } } as never)}
              className="bg-white border border-gray-200 rounded-xl p-2.5"
              activeOpacity={0.8}
            >
              <ScanLine size={20} color="#6B7280" />
            </TouchableOpacity>
          </View>

          {/* Filters */}
          <View className="mb-3">
            <FlatList
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ paddingHorizontal: 16 }}
              data={[
                { key: 'all', label: 'Todos', onPress: () => setStockFilter('all'), active: stockFilter === 'all' },
                { key: 'low', label: 'Stock bajo', onPress: () => setStockFilter('low'), active: stockFilter === 'low' },
                { key: 'empty', label: 'Sin stock', onPress: () => setStockFilter('empty'), active: stockFilter === 'empty' },
                ...(uncategorizedCount > 0
                  ? [{ key: 'no-cat', label: `Sin categoría (${uncategorizedCount})`, onPress: () => setCategoryFilter('__none__'), active: categoryFilter === '__none__' }]
                  : []),
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

          {/* Banner de filtro por categoría */}
          {categoryFilter ? (
            <View className="mx-4 mb-2 flex-row items-center bg-blue-50 border border-blue-200 rounded-xl px-3 py-2 gap-2">
              <Tag size={13} color="#3B82F6" />
              <Text className="flex-1 text-sm text-blue-700 font-medium">{activeCategoryName}</Text>
              <TouchableOpacity onPress={() => setCategoryFilter('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <X size={15} color="#3B82F6" />
              </TouchableOpacity>
            </View>
          ) : null}

          {loadingProducts ? (
            <View className="flex-1 items-center justify-center">
              <ActivityIndicator color="#208AEF" />
            </View>
          ) : (
            <FlatList
              data={displayedProducts}
              keyExtractor={(p) => p.id}
              contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24 }}
              refreshControl={
                <RefreshControl refreshing={refreshingProducts} onRefresh={() => void onRefreshProducts()} tintColor="#208AEF" />
              }
              ListEmptyComponent={
                <View className="items-center py-16">
                  <Text className="text-gray-400 text-sm">
                    {productSearch || stockFilter !== 'all' || categoryFilter
                      ? 'No se encontraron productos con ese criterio.'
                      : 'No hay productos. Agregá el primero.'}
                  </Text>
                </View>
              }
              renderItem={({ item }) => (
                <ProductCard
                  product={item}
                  isOwner={isOwner}
                  onPress={() => router.push(`/(app)/products/${item.id}` as never)}
                  onEdit={() => openEditProduct(item)}
                  onDelete={() => setDeleteProduct(item)}
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
                  productCount={productCountByCategory[item.id] ?? 0}
                  isOwner={isOwner}
                  onPress={() => {
                    setCategoryFilter(item.id);
                    setActiveTab('products');
                  }}
                  onEdit={() => openEditCategory(item)}
                  onDelete={() => setDeleteCategory(item)}
                />
              )}
            />
          )}
        </>
      )}
      <ConfirmDialog
        visible={!!deleteProduct}
        title="Eliminar producto"
        message={deleteProduct ? `¿Eliminar "${deleteProduct.name}"? Esta acción no se puede deshacer.` : undefined}
        confirmLabel="Eliminar"
        destructive
        loading={deleting}
        onConfirm={() => void handleDeleteProduct()}
        onCancel={() => setDeleteProduct(null)}
      />

      <ConfirmDialog
        visible={!!deleteCategory}
        title="Eliminar categoría"
        message={deleteCategory ? `¿Eliminar "${deleteCategory.name}"? Los productos quedarán sin categoría.` : undefined}
        confirmLabel="Eliminar"
        destructive
        loading={deleting}
        onConfirm={() => void handleDeleteCategory()}
        onCancel={() => setDeleteCategory(null)}
      />
    </SafeAreaView>
  );
}
