import {
  View, Text, FlatList, TouchableOpacity, ActivityIndicator, RefreshControl, ScrollView, TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useQuery, useInfiniteQuery, useQueryClient } from '@tanstack/react-query';
import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { useFocusRefresh } from '@/lib/use-focus-refresh';
import { Plus, ShoppingCart, BarChart2, Search, X } from 'lucide-react-native';
import { api } from '@/lib/api';
import type { Sale, SalesSummary, TopProduct, PaymentMethod, PaginatedResult } from '@/lib/types';

// ─── Constants ────────────────────────────────────────────────────────────────

type Period = 'today' | 'yesterday' | 'week' | 'last_week' | 'month' | 'last_month';

const PERIOD_OPTIONS: { key: Period; label: string }[] = [
  { key: 'today',      label: 'Hoy' },
  { key: 'yesterday',  label: 'Ayer' },
  { key: 'week',       label: 'Esta sem.' },
  { key: 'last_week',  label: 'Sem. ant.' },
  { key: 'month',      label: 'Este mes' },
  { key: 'last_month', label: 'Mes ant.' },
];

const PM_META: Record<PaymentMethod, { label: string; bg: string; text: string }> = {
  cash:     { label: 'Efectivo',      bg: '#F0FDF4', text: '#16A34A' },
  card:     { label: 'Tarjeta',       bg: '#EFF6FF', text: '#2563EB' },
  transfer: { label: 'Transferencia', bg: '#F5F3FF', text: '#7C3AED' },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatCurrency(v: number) {
  return `$${Math.round(v).toLocaleString('es-AR')}`;
}

function formatTime(dateStr: string) {
  return new Date(dateStr).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function Chip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      className={`px-3.5 py-1.5 rounded-full border mr-2 ${active ? 'bg-blue-500 border-blue-500' : 'bg-white border-gray-200'}`}
      activeOpacity={0.7}
    >
      <Text className={`text-xs font-medium ${active ? 'text-white' : 'text-gray-600'}`}>{label}</Text>
    </TouchableOpacity>
  );
}

function StatCard({
  label, value, green, small,
}: { label: string; value: string; green?: boolean; small?: boolean }) {
  return (
    <View className={`flex-1 rounded-2xl p-3.5 border ${green ? 'bg-green-50 border-green-100' : 'bg-white border-gray-100'}`}>
      <Text className={`text-xs font-medium mb-1 ${green ? 'text-green-500' : 'text-gray-400'}`}>{label}</Text>
      <Text className={`font-bold ${small ? 'text-base' : 'text-xl'} ${green ? 'text-green-700' : 'text-gray-900'}`}>
        {value}
      </Text>
    </View>
  );
}

function PaymentBreakdown({ byPaymentMethod }: { byPaymentMethod: SalesSummary['byPaymentMethod'] }) {
  const methods = (Object.keys(byPaymentMethod) as PaymentMethod[]).filter(
    (m) => byPaymentMethod[m] > 0,
  );
  if (methods.length === 0) return null;

  return (
    <View className="flex-row gap-2 mt-2.5">
      {methods.map((m) => {
        const meta = PM_META[m];
        return (
          <View
            key={m}
            className="flex-1 rounded-xl px-2.5 py-2 items-center"
            style={{ backgroundColor: meta.bg }}
          >
            <Text className="text-xs font-medium mb-0.5" style={{ color: meta.text }}>{meta.label}</Text>
            <Text className="text-sm font-bold" style={{ color: meta.text }}>
              {formatCurrency(byPaymentMethod[m])}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

function TopProductsSection({ products }: { products: TopProduct[] }) {
  if (products.length === 0) return null;

  return (
    <View className="mx-4 mt-3 mb-1">
      <Text className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
        Más vendidos
      </Text>
      {products.map((p, i) => (
        <View key={p.productId} className="flex-row items-center py-2.5 border-b border-gray-100">
          <View
            className="w-6 h-6 rounded-full items-center justify-center mr-3"
            style={{ backgroundColor: i === 0 ? '#FEF3C7' : i === 1 ? '#F3F4F6' : '#FFF7ED' }}
          >
            <Text
              className="text-xs font-bold"
              style={{ color: i === 0 ? '#D97706' : i === 1 ? '#6B7280' : '#C2410C' }}
            >
              {i + 1}
            </Text>
          </View>
          <Text className="flex-1 text-sm font-medium text-gray-900" numberOfLines={1}>
            {p.name}
          </Text>
          <View className="items-end ml-2">
            <Text className="text-sm font-bold text-gray-900">{formatCurrency(p.revenue)}</Text>
            <Text className="text-xs text-gray-400">{p.qty} unid.</Text>
          </View>
        </View>
      ))}
    </View>
  );
}

function SaleRow({ sale, onPress }: { sale: Sale; onPress: () => void }) {
  const pm = PM_META[sale.paymentMethod];
  const firstItem = sale.items[0];
  const preview = firstItem
    ? sale.itemCount > 1
      ? `${firstItem.product.name} y ${sale.itemCount - 1} más`
      : firstItem.product.name
    : `${sale.itemCount} producto${sale.itemCount !== 1 ? 's' : ''}`;

  const isRefunded = !!sale.refundedAt;

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.7}
      className={`flex-row items-center px-4 py-3.5 border-b border-gray-100 bg-white ${isRefunded ? 'opacity-50' : ''}`}
    >
      <View className="flex-1 mr-3">
        <View className="flex-row items-center gap-2 mb-1">
          <Text className="text-xs text-gray-400 font-mono">#{String(sale.saleNumber).padStart(4, '0')}</Text>
          <Text className="text-xs text-gray-300">·</Text>
          <Text className="text-xs text-gray-400">{formatTime(sale.createdAt)}</Text>
          <View className="px-2 py-0.5 rounded-full" style={{ backgroundColor: pm.bg }}>
            <Text className="text-xs font-medium" style={{ color: pm.text }}>{pm.label}</Text>
          </View>
          {isRefunded && (
            <View className="bg-gray-100 px-2 py-0.5 rounded-full">
              <Text className="text-xs text-gray-400">Devuelta</Text>
            </View>
          )}
        </View>
        <Text className="text-sm text-gray-600" numberOfLines={1}>{preview}</Text>
      </View>
      <Text className="text-base font-bold text-gray-900">{formatCurrency(sale.total)}</Text>
    </TouchableOpacity>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

const LIMIT = 20;

type PmFilter = PaymentMethod | 'all';

const PM_FILTER_OPTIONS: { key: PmFilter; label: string }[] = [
  { key: 'all',      label: 'Todos' },
  { key: 'cash',     label: 'Efectivo' },
  { key: 'card',     label: 'Tarjeta' },
  { key: 'transfer', label: 'Transferencia' },
];

function useDebounce(value: string, delay: number) {
  const [debounced, setDebounced] = useState(value);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setDebounced(value), delay);
    return () => { if (timer.current) clearTimeout(timer.current); };
  }, [value, delay]);
  return debounced;
}

export default function SalesScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [period, setPeriod] = useState<Period>('today');
  const [pmFilter, setPmFilter] = useState<PmFilter>('all');
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 350);
  const [refreshing, setRefreshing] = useState(false);

  useFocusRefresh([
    ['sales-summary', period],
    ['sales', period],
    ['sales-top', period],
  ]);

  const { data: summary } = useQuery({
    queryKey: ['sales-summary', period],
    queryFn: () => api.get<SalesSummary>(`/sales/summary?period=${period}`),
  });

  const { data: topProducts = [] } = useQuery({
    queryKey: ['sales-top', period],
    queryFn: () => api.get<TopProduct[]>(`/sales/top-products?period=${period}&limit=5`),
  });

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading } = useInfiniteQuery({
    queryKey: ['sales', period, pmFilter, debouncedSearch],
    queryFn: ({ pageParam = 0 }) => {
      const params = new URLSearchParams({
        limit: String(LIMIT),
        offset: String(pageParam as number),
        period,
      });
      if (pmFilter !== 'all') params.set('paymentMethod', pmFilter);
      if (debouncedSearch.trim()) params.set('search', debouncedSearch.trim());
      return api.get<PaginatedResult<Sale>>(`/sales?${params.toString()}`);
    },
    initialPageParam: 0,
    getNextPageParam: (last) => (last.hasMore ? last.offset + last.limit : undefined),
  });

  const sales = useMemo(() => data?.pages.flatMap((p) => p.data) ?? [], [data]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['sales-summary', period] }),
      queryClient.invalidateQueries({ queryKey: ['sales', period] }),
      queryClient.invalidateQueries({ queryKey: ['sales-top', period] }),
    ]);
    setRefreshing(false);
  }, [queryClient, period]);

  return (
    <SafeAreaView className="flex-1 bg-gray-50">
      {/* Header */}
      <View className="px-4 pt-6 pb-3">
        <View className="flex-row items-center justify-between mb-4">
          <Text className="text-2xl font-bold text-gray-900">Ventas</Text>
          <TouchableOpacity
            onPress={() => router.push('/(app)/sales/stats' as never)}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <BarChart2 size={22} color="#6B7280" />
          </TouchableOpacity>
        </View>

        {/* Period chips — horizontal scroll */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          className="mb-4"
          contentContainerStyle={{ paddingRight: 16 }}
        >
          {PERIOD_OPTIONS.map((opt) => (
            <Chip
              key={opt.key}
              label={opt.label}
              active={period === opt.key}
              onPress={() => setPeriod(opt.key)}
            />
          ))}
        </ScrollView>

        {/* Summary — 2 rows */}
        <View className="flex-row gap-2.5 mb-2.5">
          <StatCard label="Facturado" value={summary ? formatCurrency(summary.total) : '—'} />
          <StatCard label="Ventas" value={summary?.count != null ? String(summary.count) : '—'} />
        </View>
        <View className="flex-row gap-2.5">
          <StatCard
            label="Ganancia"
            value={summary?.profit != null ? formatCurrency(summary.profit) : '—'}
            green
          />
          <StatCard
            label="Ticket prom."
            value={summary?.avgTicket ? formatCurrency(summary.avgTicket) : '—'}
            small
          />
        </View>

        {/* Payment method breakdown */}
        {summary && <PaymentBreakdown byPaymentMethod={summary.byPaymentMethod} />}

        {/* Search bar */}
        <View className="flex-row items-center bg-white border border-gray-200 rounded-xl px-3 mt-3 gap-2">
          <Search size={14} color="#9CA3AF" />
          <TextInput
            className="flex-1 py-2.5 text-sm text-gray-900"
            placeholder="Buscar por producto..."
            placeholderTextColor="#9CA3AF"
            value={search}
            onChangeText={setSearch}
            clearButtonMode="while-editing"
            autoCorrect={false}
          />
          {search ? (
            <TouchableOpacity onPress={() => setSearch('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <X size={14} color="#9CA3AF" />
            </TouchableOpacity>
          ) : null}
        </View>

        {/* Payment method filter */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mt-2" contentContainerStyle={{ paddingRight: 4 }}>
          {PM_FILTER_OPTIONS.map((opt) => (
            <TouchableOpacity
              key={opt.key}
              onPress={() => setPmFilter(opt.key)}
              className={`px-3 py-1.5 rounded-full border mr-2 ${pmFilter === opt.key ? 'bg-blue-500 border-blue-500' : 'bg-white border-gray-200'}`}
              activeOpacity={0.7}
            >
              <Text className={`text-xs font-medium ${pmFilter === opt.key ? 'text-white' : 'text-gray-600'}`}>
                {opt.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Sales list */}
      {isLoading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#208AEF" />
        </View>
      ) : (
        <FlatList
          data={sales}
          keyExtractor={(s) => s.id}
          renderItem={({ item }) => (
            <SaleRow
              sale={item}
              onPress={() => router.push(`/(app)/sales/${item.id}` as never)}
            />
          )}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => void onRefresh()}
              tintColor="#208AEF"
            />
          }
          onEndReached={() => {
            if (hasNextPage && !isFetchingNextPage) void fetchNextPage();
          }}
          onEndReachedThreshold={0.3}
          ListHeaderComponent={
            <>
              {topProducts.length > 0 && <TopProductsSection products={topProducts} />}
              {sales.length > 0 && (
                <View className="px-4 py-2 bg-gray-100 flex-row justify-between mt-3">
                  <Text className="text-xs text-gray-500 font-medium uppercase tracking-wide">Venta</Text>
                  <Text className="text-xs text-gray-500 font-medium uppercase tracking-wide">Total</Text>
                </View>
              )}
            </>
          }
          ListFooterComponent={
            isFetchingNextPage ? (
              <View className="py-4 items-center">
                <ActivityIndicator size="small" color="#208AEF" />
              </View>
            ) : sales.length > 0 && !hasNextPage ? (
              <View className="py-4 items-center">
                <Text className="text-xs text-gray-400">No hay más ventas</Text>
              </View>
            ) : null
          }
          ListEmptyComponent={
            <View className="items-center justify-center py-16 px-8">
              <ShoppingCart size={40} color="#D1D5DB" />
              <Text className="text-gray-400 mt-3 text-sm text-center">
                {search || pmFilter !== 'all'
                  ? 'Sin resultados para esta búsqueda'
                  : `Sin ventas ${PERIOD_OPTIONS.find((o) => o.key === period)?.label.toLowerCase() ?? ''}`}
              </Text>
              {!search && pmFilter === 'all' && (
                <TouchableOpacity
                  onPress={() => router.push('/(modals)/new-sale' as never)}
                  className="mt-4 bg-blue-500 px-5 py-2.5 rounded-full"
                  activeOpacity={0.8}
                >
                  <Text className="text-white text-sm font-semibold">Registrar venta</Text>
                </TouchableOpacity>
              )}
            </View>
          }
        />
      )}

      {/* FAB */}
      <TouchableOpacity
        onPress={() => router.push('/(modals)/new-sale' as never)}
        className="absolute bottom-8 right-6 bg-blue-500 w-14 h-14 rounded-full items-center justify-center shadow-lg"
        activeOpacity={0.85}
        style={{ elevation: 4 }}
      >
        <Plus size={26} color="white" />
      </TouchableOpacity>
    </SafeAreaView>
  );
}
