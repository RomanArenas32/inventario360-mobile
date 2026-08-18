import {
  View,
  Text,
  FlatList,
  TextInput,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useState, useCallback, useMemo } from 'react';
import { useFocusRefresh } from '@/lib/use-focus-refresh';
import {
  Search,
  ScanLine,
  Plus,
  History,
  Package,
} from 'lucide-react-native';
import { api } from '@/lib/api';
import { editStore } from '@/lib/edit-store';
import { useAuthContext } from '@/lib/auth-context';
import type { Product } from '@/lib/types';

// ─── Product row ──────────────────────────────────────────────────────────────

type StockLevel = 'ok' | 'low' | 'empty';

function getStockLevel(p: Product): StockLevel {
  if (p.stock === 0) return 'empty';
  if (p.minStock > 0 && p.stock <= p.minStock) return 'low';
  return 'ok';
}

const LEVEL_STYLES: Record<StockLevel, { badge: string; text: string; border: string }> = {
  ok:    { badge: 'bg-green-100',  text: 'text-green-700',  border: 'border-transparent' },
  low:   { badge: 'bg-amber-100',  text: 'text-amber-700',  border: 'border-amber-200' },
  empty: { badge: 'bg-red-100',    text: 'text-red-700',    border: 'border-red-200' },
};

function ProductRow({
  product,
  onPressDetail,
  onPressMovement,
}: {
  product: Product;
  onPressDetail: () => void;
  onPressMovement: () => void;
}) {
  const level = getStockLevel(product);
  const s = LEVEL_STYLES[level];
  const isHighlighted = level !== 'ok';

  return (
    <TouchableOpacity
      onPress={onPressDetail}
      activeOpacity={0.7}
      className={`flex-row items-center px-4 py-3.5 border-b border-gray-100 bg-white ${isHighlighted ? 'border-l-4 ' + s.border : ''}`}
    >
      <View className="flex-1 mr-3">
        <Text className="text-sm font-medium text-gray-900" numberOfLines={1}>
          {product.name}
        </Text>
        {product.code ? (
          <Text className="text-xs text-gray-400 font-mono mt-0.5">{product.code}</Text>
        ) : null}
        {product.category ? (
          <Text className="text-xs text-gray-400 mt-0.5">{product.category.name}</Text>
        ) : null}
      </View>
      <View className="flex-row items-center gap-2">
        <View className={`px-2.5 py-1 rounded-lg ${s.badge}`}>
          <Text className={`text-sm font-bold ${s.text}`}>{product.stock}</Text>
        </View>
        <TouchableOpacity
          onPress={onPressMovement}
          hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}
          className="w-8 h-8 bg-blue-50 rounded-full items-center justify-center"
          activeOpacity={0.7}
        >
          <Plus size={16} color="#208AEF" />
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );
}

// ─── Filter chip ──────────────────────────────────────────────────────────────

function Chip({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      className={`px-3.5 py-1.5 rounded-full border mr-2 ${
        active ? 'bg-blue-500 border-blue-500' : 'bg-white border-gray-200'
      }`}
      activeOpacity={0.7}
    >
      <Text className={`text-xs font-medium ${active ? 'text-white' : 'text-gray-600'}`}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

type FilterKey = 'all' | 'low' | 'empty';

export default function StockScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { tenantRole } = useAuthContext();
  const isOwner = tenantRole === 'owner';

  useFocusRefresh([['products']]);

  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<FilterKey>('all');
  const [refreshing, setRefreshing] = useState(false);

  const { data: products = [], isLoading } = useQuery({
    queryKey: ['products'],
    queryFn: () => api.get<Product[]>('/products'),
  });

  const activeProducts = useMemo(() => products.filter((p) => p.isActive), [products]);

  const filtered = useMemo(() => {
    let list = activeProducts;

    if (filter === 'low') {
      list = list.filter((p) => {
        const l = getStockLevel(p);
        return l === 'low' || l === 'empty';
      });
    } else if (filter === 'empty') {
      list = list.filter((p) => getStockLevel(p) === 'empty');
    }

    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          (p.code?.toLowerCase().includes(q) ?? false),
      );
    }

    return list.sort((a, b) => {
      const order: Record<StockLevel, number> = { empty: 0, low: 1, ok: 2 };
      return order[getStockLevel(a)] - order[getStockLevel(b)];
    });
  }, [activeProducts, search, filter]);

  const lowCount = useMemo(
    () => activeProducts.filter((p) => getStockLevel(p) !== 'ok').length,
    [activeProducts],
  );
  const emptyCount = useMemo(
    () => activeProducts.filter((p) => p.stock === 0).length,
    [activeProducts],
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await queryClient.invalidateQueries({ queryKey: ['products'] });
    setRefreshing(false);
  }, [queryClient]);

  function openMovement(productId?: string) {
    if (productId) {
      editStore.setStockProductId(productId);
    } else {
      editStore.clearStockProductId();
    }
    router.push('/(modals)/stock-movement' as never);
  }

  function openDetail(productId: string) {
    router.push(`/(app)/products/${productId}` as never);
  }

  function openScan() {
    router.push('/(modals)/scan' as never);
  }

  return (
    <SafeAreaView className="flex-1 bg-gray-50">
      {/* Header */}
      <View className="px-4 pt-6 pb-3">
        <View className="flex-row items-center justify-between mb-4">
          <Text className="text-2xl font-bold text-gray-900">Stock</Text>
          <View className="flex-row items-center gap-3">
            <TouchableOpacity
              onPress={() => router.push('/stock/history' as never)}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <History size={20} color="#6B7280" />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={openScan}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <ScanLine size={20} color="#6B7280" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Stats */}
        <View className="flex-row gap-2 mb-4">
          <View className="flex-1 bg-white border border-gray-200 rounded-xl py-3 items-center">
            <Text className="text-xl font-bold text-gray-900">{activeProducts.length}</Text>
            <Text className="text-xs text-gray-400 mt-0.5">Productos</Text>
          </View>
          <View className={`flex-1 border rounded-xl py-3 items-center ${lowCount > 0 ? 'bg-amber-50 border-amber-200' : 'bg-white border-gray-200'}`}>
            <Text className={`text-xl font-bold ${lowCount > 0 ? 'text-amber-600' : 'text-gray-300'}`}>
              {lowCount}
            </Text>
            <Text className={`text-xs mt-0.5 ${lowCount > 0 ? 'text-amber-500' : 'text-gray-400'}`}>
              Stock bajo
            </Text>
          </View>
          <View className={`flex-1 border rounded-xl py-3 items-center ${emptyCount > 0 ? 'bg-red-50 border-red-200' : 'bg-white border-gray-200'}`}>
            <Text className={`text-xl font-bold ${emptyCount > 0 ? 'text-red-600' : 'text-gray-300'}`}>
              {emptyCount}
            </Text>
            <Text className={`text-xs mt-0.5 ${emptyCount > 0 ? 'text-red-500' : 'text-gray-400'}`}>
              Sin stock
            </Text>
          </View>
        </View>

        {/* Search */}
        <View className="flex-row items-center bg-white border border-gray-200 rounded-xl px-3 mb-3">
          <Search size={16} color="#9CA3AF" />
          <TextInput
            className="flex-1 py-2.5 px-2 text-sm text-gray-900"
            placeholder="Buscar por nombre o código..."
            placeholderTextColor="#9CA3AF"
            value={search}
            onChangeText={setSearch}
            clearButtonMode="while-editing"
          />
        </View>

        {/* Filter chips */}
        <View className="flex-row">
          <Chip label="Todos" active={filter === 'all'} onPress={() => setFilter('all')} />
          <Chip
            label={`Stock bajo${lowCount > 0 ? ` (${lowCount})` : ''}`}
            active={filter === 'low'}
            onPress={() => setFilter('low')}
          />
          <Chip
            label={`Sin stock${emptyCount > 0 ? ` (${emptyCount})` : ''}`}
            active={filter === 'empty'}
            onPress={() => setFilter('empty')}
          />
        </View>
      </View>

      {/* List */}
      {isLoading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#208AEF" />
        </View>
      ) : <FlatList
        data={filtered}
        keyExtractor={(p) => p.id}
        renderItem={({ item }) => (
          <ProductRow
            product={item}
            onPressDetail={() => openDetail(item.id)}
            onPressMovement={() => openMovement(item.id)}
          />
        )}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => void onRefresh()}
            tintColor="#208AEF"
          />
        }
        ListHeaderComponent={
          filtered.length > 0 ? (
            <View className="px-4 py-2 bg-gray-100 flex-row justify-between">
              <Text className="text-xs text-gray-500 font-medium uppercase tracking-wide">
                Producto
              </Text>
              <Text className="text-xs text-gray-500 font-medium uppercase tracking-wide mr-9">
                Stock
              </Text>
            </View>
          ) : null
        }
        ListEmptyComponent={
          <View className="items-center justify-center py-20">
            <Package size={40} color="#D1D5DB" />
            <Text className="text-gray-400 mt-3 text-sm">
              {search || filter !== 'all'
                ? 'Sin resultados para esta búsqueda'
                : 'No hay productos activos'}
            </Text>
          </View>
        }
      />}

      {/* FAB — only for owners */}
      {isOwner && (
        <TouchableOpacity
          onPress={() => openMovement()}
          className="absolute bottom-8 right-6 bg-blue-500 w-14 h-14 rounded-full items-center justify-center shadow-lg"
          activeOpacity={0.85}
          style={{ elevation: 4 }}
        >
          <Plus size={26} color="white" />
        </TouchableOpacity>
      )}
    </SafeAreaView>
  );
}
