import { View, Text, ScrollView, RefreshControl, TouchableOpacity, Image, Alert, ActivityIndicator, type ViewStyle } from 'react-native';
import LogoColor from '../../../assets/images/logo-color.svg';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useState, useCallback, useMemo } from 'react';
import { useFocusRefresh } from '@/lib/use-focus-refresh';
import {
  AlertTriangle, ScanLine, BarChart2,
  TrendingUp, TrendingDown, Sliders, Bell, ChevronRight, CheckCircle2,
  ShoppingCart, CalendarDays, Clock, Settings2, LineChart, UserPlus,
  Package, Scissors,
} from 'lucide-react-native';
import { api } from '@/lib/api';
import { useAuthContext } from '@/lib/auth-context';
import { useModules } from '@/lib/use-modules';
import { editStore } from '@/lib/edit-store';
import type { Product, StockMovement, StockMovementType, PaginatedResult, Turn, SalesSummary, TurnStatus } from '@/lib/types';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatCurrency(v: number): string {
  return `$${Math.round(v).toLocaleString('es-AR')}`;
}

function formatTimeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return 'ahora';
  if (mins < 60) return `hace ${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `hace ${hrs}h`;
  return `hace ${Math.floor(hrs / 24)}d`;
}

function formatTime(iso: string | null): string {
  if (!iso) return 'Cola';
  return new Date(iso).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
}

function pctDiff(today: number, yesterday: number): number | null {
  if (yesterday === 0) return today > 0 ? 100 : null;
  return Math.round(((today - yesterday) / yesterday) * 100);
}

// ─── Types ────────────────────────────────────────────────────────────────────

type AppNotification = {
  id: string;
  title: string;
  body: string;
  read: boolean;
  createdAt: string;
};

const MOVEMENT_META: Record<StockMovementType, { delta: (q: number) => string; color: string; Icon: typeof TrendingUp }> = {
  entry:      { delta: (q) => `+${q}`, color: '#16A34A', Icon: TrendingUp },
  exit:       { delta: (q) => `-${q}`, color: '#DC2626', Icon: TrendingDown },
  adjustment: { delta: (q) => `=${q}`, color: '#2563EB', Icon: Sliders },
};

// ─── Sub-components ───────────────────────────────────────────────────────────

function QuickAction({
  icon,
  label,
  onPress,
  primary = false,
}: {
  icon: React.ReactNode;
  label: string;
  onPress: () => void;
  primary?: boolean;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.75}
      className={`flex-1 items-center justify-center py-3.5 rounded-2xl gap-1.5 ${
        primary ? 'bg-blue-500' : 'bg-white border border-gray-200'
      }`}
    >
      {icon}
      <Text className={`text-xs font-semibold ${primary ? 'text-white' : 'text-gray-700'}`}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

function AlertProductItem({
  product,
  variant,
  onPress,
}: {
  product: Product;
  variant: 'empty' | 'low';
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      className="flex-row items-center justify-between py-3 border-b border-gray-100"
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View className="flex-1 mr-2">
        <Text className="text-sm font-medium text-gray-900" numberOfLines={1}>
          {product.name}
        </Text>
        {variant === 'empty' ? (
          <Text className="text-xs text-red-500 font-medium mt-0.5">Sin stock</Text>
        ) : (
          <Text className="text-xs text-gray-400 mt-0.5">
            Stock: <Text className="text-amber-500 font-semibold">{product.stock}</Text>
            {' · '}mínimo {product.minStock}
          </Text>
        )}
      </View>
      <ChevronRight size={14} color="#D1D5DB" />
    </TouchableOpacity>
  );
}

function ActivityRow({ item }: { item: StockMovement }) {
  const meta = MOVEMENT_META[item.type];
  const Icon = meta.Icon;
  const typeLabel = item.type === 'entry' ? 'Entrada' : item.type === 'exit' ? 'Salida' : 'Ajuste';

  return (
    <View className="flex-row items-center py-3 border-b border-gray-100">
      <View
        className="w-8 h-8 rounded-full items-center justify-center mr-3 flex-shrink-0"
        style={{ backgroundColor: meta.color + '18' }}
      >
        <Icon size={14} color={meta.color} />
      </View>
      <View className="flex-1 mr-2">
        <Text className="text-sm font-medium text-gray-900" numberOfLines={1}>
          {item.product.name}
        </Text>
        <Text className="text-xs text-gray-400 mt-0.5" numberOfLines={1}>
          {item.reason || typeLabel} · {item.user.name}
        </Text>
      </View>
      <View className="items-end">
        <Text className="text-sm font-bold" style={{ color: meta.color }}>
          {meta.delta(item.quantity)}
        </Text>
        <Text className="text-xs text-gray-400 mt-0.5">{formatTimeAgo(item.createdAt)}</Text>
      </View>
    </View>
  );
}

// ─── SalesWidget ──────────────────────────────────────────────────────────────

function VsYesterday({ pct }: { pct: number | null }) {
  if (pct === null) return null;
  const up = pct >= 0;
  return (
    <View className={`flex-row items-center gap-0.5 mt-1 ${up ? '' : ''}`}>
      {up ? <TrendingUp size={11} color="#16A34A" /> : <TrendingDown size={11} color="#DC2626" />}
      <Text className={`text-xs font-semibold ${up ? 'text-green-600' : 'text-red-500'}`}>
        {up ? '+' : ''}{pct}% vs ayer
      </Text>
    </View>
  );
}

function SalesWidget({
  summary,
  yesterdaySummary,
  onNewSale,
  onViewAll,
  onViewStats,
}: {
  summary: SalesSummary | undefined;
  yesterdaySummary: SalesSummary | undefined;
  onNewSale: () => void;
  onViewAll: () => void;
  onViewStats: () => void;
}) {
  const totalPct = summary && yesterdaySummary
    ? pctDiff(summary.total, yesterdaySummary.total)
    : null;

  const hasSales = (summary?.count ?? 0) > 0;
  const showProfit = hasSales && (summary?.profit ?? 0) > 0;

  return (
    <View className="bg-white rounded-2xl overflow-hidden mb-5 border border-gray-100">
      <View className="flex-row items-center justify-between px-4 pt-3.5 pb-3 border-b border-gray-100">
        <View className="flex-row items-center gap-2">
          <ShoppingCart size={13} color="#208AEF" />
          <Text className="text-xs font-semibold text-gray-700 uppercase tracking-wide">Ventas hoy</Text>
        </View>
        <View className="flex-row items-center gap-3">
          <TouchableOpacity onPress={onViewStats} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <LineChart size={15} color="#9CA3AF" />
          </TouchableOpacity>
          <TouchableOpacity onPress={onViewAll} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Text className="text-xs text-blue-500 font-medium">Ver todas</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View className="flex-row px-4 py-3.5 gap-3">
        {/* Facturado */}
        <View className="flex-1">
          <Text className="text-xs text-gray-400 font-medium">Facturado</Text>
          <Text className="text-xl font-bold text-gray-900 mt-0.5">
            {summary ? formatCurrency(summary.total) : '—'}
          </Text>
          <VsYesterday pct={totalPct} />
        </View>

        {/* Ventas */}
        <View className="flex-1">
          <Text className="text-xs text-gray-400 font-medium">Ventas</Text>
          <Text className="text-xl font-bold text-gray-900 mt-0.5">
            {summary?.count ?? '—'}
          </Text>
          {(summary?.avgTicket ?? 0) > 0 && (
            <Text className="text-xs text-gray-400 mt-1">
              prom. {formatCurrency(summary!.avgTicket)}
            </Text>
          )}
        </View>

        {/* Ganancia */}
        <View className="flex-1">
          <Text className="text-xs text-gray-400 font-medium">Ganancia</Text>
          <Text className={`text-xl font-bold mt-0.5 ${showProfit ? 'text-green-600' : 'text-gray-300'}`}>
            {summary ? (showProfit ? formatCurrency(summary.profit) : '—') : '—'}
          </Text>
        </View>
      </View>

      <TouchableOpacity
        onPress={onNewSale}
        className="mx-4 mb-3.5 bg-blue-500 rounded-xl py-2.5 items-center"
        activeOpacity={0.85}
      >
        <Text className="text-white font-semibold text-sm">+ Nueva venta</Text>
      </TouchableOpacity>
    </View>
  );
}

// ─── TurnsWidget ──────────────────────────────────────────────────────────────

function TurnsWidget({
  turns,
  todayKey,
  onNewTurn,
  onViewAll,
  onUpdateStatus,
}: {
  turns: Turn[];
  todayKey: string;
  onNewTurn: () => void;
  onViewAll: () => void;
  onUpdateStatus: (turn: Turn, status: TurnStatus) => Promise<void>;
}) {
  const heroTurn = useMemo(() => {
    const active = turns.find((t) => t.status === 'in_progress');
    if (active) return active;
    const now = Date.now() - 5 * 60_000;
    return (
      turns
        .filter((t) => t.status === 'pending' && t.startTime && new Date(t.startTime).getTime() > now)
        .sort((a, b) => new Date(a.startTime!).getTime() - new Date(b.startTime!).getTime())[0] ?? null
    );
  }, [turns]);

  const pendingCount = turns.filter((t) => t.status === 'pending').length;
  const inProgressCount = turns.filter((t) => t.status === 'in_progress').length;
  const doneCount = turns.filter((t) => t.status === 'done').length;
  const totalCount = turns.length;

  const isActive = heroTurn?.status === 'in_progress';

  return (
    <View className="mb-5">
      {/* Hero turn */}
      {heroTurn && (
        <View className={`rounded-2xl p-4 mb-3 ${isActive ? 'bg-amber-500' : 'bg-blue-500'}`}>
          <View className="flex-row items-center justify-between mb-2">
            <Text className={`text-xs font-semibold ${isActive ? 'text-amber-100' : 'text-blue-100'}`}>
              {isActive ? '▶ EN CURSO' : '⏱ PRÓXIMO TURNO'}
            </Text>
            <TouchableOpacity onPress={onViewAll} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Text className="text-xs text-white/70 font-medium">Ver agenda</Text>
            </TouchableOpacity>
          </View>
          <Text className="text-white text-xl font-bold">{heroTurn.clientName}</Text>
          <Text className={`mt-0.5 ${isActive ? 'text-amber-100' : 'text-blue-100'}`}>{heroTurn.service}</Text>
          <View className="flex-row items-center gap-4 mt-2 flex-wrap">
            <View className="flex-row items-center gap-1">
              <Clock size={12} color="rgba(255,255,255,0.8)" />
              <Text className="text-white text-sm opacity-90">{formatTime(heroTurn.startTime)}</Text>
            </View>
            <Text className="text-white text-sm opacity-90">{heroTurn.duration} min</Text>
            {totalCount > 1 && (
              <View className="bg-white/20 px-2 py-0.5 rounded-full">
                <Text className="text-white text-xs font-semibold">
                  {doneCount}/{totalCount} completados
                </Text>
              </View>
            )}
          </View>

          {/* Action buttons */}
          <View className="flex-row gap-2 mt-3">
            {heroTurn.status === 'pending' && (
              <TouchableOpacity
                onPress={() => void onUpdateStatus(heroTurn, 'in_progress')}
                className="flex-1 bg-white py-2.5 rounded-xl items-center"
                activeOpacity={0.85}
              >
                <Text className="text-blue-500 font-bold text-sm">▶  Iniciar turno</Text>
              </TouchableOpacity>
            )}
            {heroTurn.status === 'in_progress' && (
              <TouchableOpacity
                onPress={() => void onUpdateStatus(heroTurn, 'done')}
                className="flex-1 bg-white py-2.5 rounded-xl items-center"
                activeOpacity={0.85}
              >
                <Text className="text-amber-600 font-bold text-sm">✓  Completar turno</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      )}

      {/* Day summary row */}
      {totalCount > 0 && (
        <View className="flex-row gap-2 mb-3">
          {pendingCount > 0 && (
            <View className="flex-row items-center gap-1 bg-blue-50 px-2.5 py-1 rounded-full">
              <View className="w-1.5 h-1.5 rounded-full bg-blue-400" />
              <Text className="text-xs font-medium text-blue-600">{pendingCount} pendiente{pendingCount !== 1 ? 's' : ''}</Text>
            </View>
          )}
          {inProgressCount > 0 && (
            <View className="flex-row items-center gap-1 bg-amber-50 px-2.5 py-1 rounded-full">
              <View className="w-1.5 h-1.5 rounded-full bg-amber-400" />
              <Text className="text-xs font-medium text-amber-600">En curso</Text>
            </View>
          )}
          {doneCount > 0 && (
            <View className="flex-row items-center gap-1 bg-green-50 px-2.5 py-1 rounded-full">
              <View className="w-1.5 h-1.5 rounded-full bg-green-400" />
              <Text className="text-xs font-medium text-green-600">{doneCount} listo{doneCount !== 1 ? 's' : ''}</Text>
            </View>
          )}
        </View>
      )}

      {/* Quick actions row */}
      <View className="flex-row gap-2.5">
        <TouchableOpacity
          onPress={onNewTurn}
          className="flex-1 bg-white border border-gray-200 rounded-xl py-2.5 items-center"
          activeOpacity={0.8}
        >
          <Text className="text-sm font-semibold text-gray-700">+ Nuevo turno</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={onViewAll}
          className="flex-1 bg-white border border-gray-200 rounded-xl py-2.5 items-center"
          activeOpacity={0.8}
        >
          <Text className="text-sm font-semibold text-gray-700">Ver agenda completa</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ─── Dashboard ────────────────────────────────────────────────────────────────

export default function DashboardScreen() {
  const { user } = useAuthContext();
  const { isOwner, canProducts, canStock, canTurns, canSales, canServices } = useModules();
  const router = useRouter();
  const queryClient = useQueryClient();

  const todayKey = useMemo(() => new Date().toISOString().split('T')[0]!, []);

  useFocusRefresh([
    ['products'],
    ['notifications'],
    ['invitations-mine'],
    ...(canStock ? [['stock-movements-recent']] : []),
    ...(canSales ? [['sales-summary', 'today'], ['sales-summary', 'yesterday']] : []),
    ...(canTurns ? [['turns', todayKey]] : []),
  ]);

  const [refreshing, setRefreshing] = useState(false);

  const { data: products = [], isLoading: loadingProducts } = useQuery({
    queryKey: ['products'],
    queryFn: () => api.get<Product[]>('/products'),
    enabled: canProducts,
  });

  const { data: recentData } = useQuery({
    queryKey: ['stock-movements-recent'],
    queryFn: () => api.get<PaginatedResult<StockMovement>>('/stock-movements?limit=5&offset=0'),
    enabled: isOwner && canStock,
  });

  const { data: notifications = [] } = useQuery({
    queryKey: ['notifications'],
    queryFn: () => api.get<AppNotification[]>('/notifications'),
  });

  const { data: pendingInvitations = [] } = useQuery({
    queryKey: ['invitations-mine'],
    queryFn: () => api.get<{ id: string; tenantName: string; role: string }[]>('/invitations/mine'),
  });

  const { data: salesSummary } = useQuery({
    queryKey: ['sales-summary', 'today'],
    queryFn: () => api.get<SalesSummary>('/sales/summary?period=today'),
    enabled: canSales,
  });

  const { data: yesterdaySummary } = useQuery({
    queryKey: ['sales-summary', 'yesterday'],
    queryFn: () => api.get<SalesSummary>('/sales/summary?period=yesterday'),
    enabled: canSales,
  });

  const { data: todayTurns = [], refetch: refetchTurns } = useQuery({
    queryKey: ['turns', todayKey],
    queryFn: () => api.get<Turn[]>(`/turns?date=${todayKey}`),
    enabled: canTurns,
  });

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['products'] }),
      queryClient.invalidateQueries({ queryKey: ['notifications'] }),
      queryClient.invalidateQueries({ queryKey: ['stock-movements-recent'] }),
      canSales ? queryClient.invalidateQueries({ queryKey: ['sales-summary'] }) : Promise.resolve(),
      canTurns ? queryClient.invalidateQueries({ queryKey: ['turns', todayKey] }) : Promise.resolve(),
    ]);
    setRefreshing(false);
  }, [queryClient, canSales, canTurns, todayKey]);

  // ─── Turn status update ──────────────────────────────────────────────────

  async function handleTurnStatus(turn: Turn, status: TurnStatus) {
    // Optimistic update — instant UI response before API roundtrip
    queryClient.setQueryData<Turn[]>(['turns', todayKey], (prev) =>
      prev?.map((t) => t.id === turn.id ? { ...t, status } : t) ?? [],
    );
    try {
      await api.patch(`/turns/${turn.id}`, { status });
      void queryClient.invalidateQueries({ queryKey: ['turns', todayKey] });
      if (status === 'done') {
        Alert.alert(
          'Turno completado',
          `¿Registrar una venta por el servicio de ${turn.clientName}?`,
          [
            { text: 'No, gracias' },
            {
              text: 'Registrar venta',
              onPress: () => {
                const base = '/(modals)/new-sale';
                const query = turn.price
                  ? `?service=${encodeURIComponent(turn.service)}&servicePrice=${turn.price}`
                  : '';
                router.push(`${base}${query}` as never);
              },
            },
          ],
        );
      }
    } catch (err) {
      // Rollback on error
      void queryClient.invalidateQueries({ queryKey: ['turns', todayKey] });
      Alert.alert('Error', err instanceof Error ? err.message : 'No se pudo actualizar el turno');
    }
  }

  // ─── Derived values ──────────────────────────────────────────────────────

  const activeProducts = useMemo(() => products.filter((p) => p.isActive), [products]);
  const sinStock = useMemo(() => activeProducts.filter((p) => p.stock === 0), [activeProducts]);
  const stockBajo = useMemo(
    () => activeProducts.filter((p) => p.stock > 0 && p.minStock > 0 && p.stock <= p.minStock),
    [activeProducts],
  );
  const inventoryValue = useMemo(
    () => activeProducts.filter((p) => p.costPrice != null).reduce((s, p) => s + p.stock * (p.costPrice ?? 0), 0),
    [activeProducts],
  );
  const hasInventoryValue = activeProducts.some((p) => p.costPrice != null);

  const unreadNotifications = useMemo(
    () => notifications.filter((n) => !n.read).slice(0, 2),
    [notifications],
  );

  const movements = recentData?.data ?? [];

  const firstName = user?.name?.split(' ')[0] ?? 'Hola';
  const todayRaw = new Date().toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' });
  const todayStr = todayRaw.charAt(0).toUpperCase() + todayRaw.slice(1);

  function openMovement() {
    editStore.clearStockProductId();
    router.push('/(modals)/stock-movement' as never);
  }

  const allGood = canStock && sinStock.length === 0 && stockBajo.length === 0 && activeProducts.length > 0;
  const noModules = !canProducts && !canStock && !canTurns && !canSales && !canServices;
  const isServiceBusiness = canTurns;

  const MODULE_STRIP = [
    {
      label: 'Productos',
      icon: <Package size={22} color="#208AEF" />,
      bg: '#EFF6FF' as ViewStyle['backgroundColor'],
      route: '/(app)/products',
      visible: canProducts,
    },
    {
      label: 'Stock',
      icon: <BarChart2 size={22} color="#7C3AED" />,
      bg: '#F5F3FF' as ViewStyle['backgroundColor'],
      route: '/(app)/stock/index',
      visible: canStock,
    },
    {
      label: 'Ventas',
      icon: <ShoppingCart size={22} color="#059669" />,
      bg: '#ECFDF5' as ViewStyle['backgroundColor'],
      route: '/(app)/sales',
      visible: canSales,
    },
    {
      label: 'Turnos',
      icon: <CalendarDays size={22} color="#D97706" />,
      bg: '#FFFBEB' as ViewStyle['backgroundColor'],
      route: '/(app)/turns',
      visible: canTurns,
    },
    {
      label: 'Servicios',
      icon: <Scissors size={22} color="#DB2777" />,
      bg: '#FDF2F8' as ViewStyle['backgroundColor'],
      route: '/(app)/services/index',
      visible: canServices,
    },
  ].filter((m) => m.visible);

  return (
    <SafeAreaView className="flex-1 bg-gray-50">
      {/* Header — fijo, no hace scroll */}
      <View className="flex-row items-center justify-between px-4 pt-5 pb-3 bg-gray-50">
        <View className="flex-row items-center gap-2.5">
          <LogoColor width={48} height={48} />
          <View>
            <Text className="text-xl font-bold text-gray-900">Hola, {firstName}</Text>
            <Text className="text-xs text-gray-400 mt-0.5">
              {user?.tenantName ? user.tenantName : todayStr}
            </Text>
          </View>
        </View>
        {isOwner && (
          <TouchableOpacity
            onPress={() => router.push('/(modals)/business-settings' as never)}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            className="p-2 bg-white rounded-xl border border-gray-200"
            activeOpacity={0.7}
          >
            <Settings2 size={18} color="#6B7280" />
          </TouchableOpacity>
        )}
      </View>

      {/* Strip de módulos — fijo, no hace scroll vertical */}
      {!noModules && MODULE_STRIP.length > 0 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          className="bg-gray-50 border-b border-gray-100"
          style={{ flexGrow: 0, flexShrink: 0 }}
          contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 10, gap: 10 }}
        >
          {MODULE_STRIP.map((mod) => (
            <TouchableOpacity
              key={mod.label}
              onPress={() => router.push(mod.route as never)}
              activeOpacity={0.75}
              className="items-center gap-1.5"
            >
              <View
                className="w-14 h-14 rounded-2xl items-center justify-center"
                style={{ backgroundColor: mod.bg }}
              >
                {mod.icon}
              </View>
              <Text className="text-xs font-medium text-gray-600">{mod.label}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      <ScrollView
        className="flex-1 bg-gray-50"
        contentContainerClassName="px-4 pt-5 pb-10"
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => void onRefresh()} tintColor="#208AEF" />
        }
      >

        {/* Loading state */}
        {loadingProducts && canProducts && (
          <View className="items-center justify-center py-16">
            <ActivityIndicator size="large" color="#208AEF" />
          </View>
        )}

        {/* Empty state — no modules */}
        {!loadingProducts && noModules && (
          <View className="items-center justify-center py-16">
            <Image
              source={require('../../../assets/images/marca1.png')}
              style={{ width: 220, height: 220 }}
              resizeMode="contain"
            />
            <Text className="text-lg font-bold text-gray-800 mt-4 text-center">Sin módulos activos</Text>
            <Text className="text-sm text-gray-400 mt-2 text-center px-8 leading-5">
              Activá los módulos que usás para ver tu negocio de un vistazo.
            </Text>
            {isOwner && (
              <TouchableOpacity
                onPress={() => router.push('/(modals)/business-settings' as never)}
                className="mt-6 bg-blue-500 px-8 py-3 rounded-2xl"
                activeOpacity={0.85}
              >
                <Text className="text-white font-semibold text-sm">Configurar módulos</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* SERVICE BUSINESSES: Turns widget — solo si hay turnos o hay hero */}
        {!loadingProducts && !noModules && isServiceBusiness && todayTurns.length > 0 && (
          <TurnsWidget
            turns={todayTurns}
            todayKey={todayKey}
            onNewTurn={() => router.push(`/(modals)/turn-form?date=${todayKey}` as never)}
            onViewAll={() => router.push('/(app)/turns' as never)}
            onUpdateStatus={handleTurnStatus}
          />
        )}

        {/* Stats bar — tappables */}
        {!loadingProducts && !noModules && canProducts && (
          <View className="flex-row gap-2.5 mb-5">
            <TouchableOpacity
              className="flex-1 bg-white rounded-2xl p-3.5 border border-gray-100"
              onPress={() => router.push('/(app)/products' as never)}
              activeOpacity={0.7}
            >
              <Text className="text-xs text-gray-400 font-medium mb-1">Productos</Text>
              <Text className="text-2xl font-bold text-gray-900">{activeProducts.length}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              className={`flex-1 rounded-2xl p-3.5 border ${
                sinStock.length > 0 ? 'bg-red-50 border-red-200' : 'bg-white border-gray-100'
              }`}
              onPress={() => router.push('/(app)/stock/index' as never)}
              activeOpacity={0.7}
            >
              <Text className={`text-xs font-medium mb-1 ${sinStock.length > 0 ? 'text-red-400' : 'text-gray-400'}`}>
                Sin stock
              </Text>
              <Text className={`text-2xl font-bold ${sinStock.length > 0 ? 'text-red-600' : 'text-gray-300'}`}>
                {sinStock.length}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              className={`flex-1 rounded-2xl p-3.5 border ${
                stockBajo.length > 0 ? 'bg-amber-50 border-amber-200' : 'bg-white border-gray-100'
              }`}
              onPress={() => router.push('/(app)/stock/index' as never)}
              activeOpacity={0.7}
            >
              <Text className={`text-xs font-medium mb-1 ${stockBajo.length > 0 ? 'text-amber-400' : 'text-gray-400'}`}>
                Stock bajo
              </Text>
              <Text className={`text-2xl font-bold ${stockBajo.length > 0 ? 'text-amber-500' : 'text-gray-300'}`}>
                {stockBajo.length}
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Valor del inventario — owner only, tappable */}
        {!loadingProducts && !noModules && isOwner && canProducts && hasInventoryValue && (
          <TouchableOpacity
            className="bg-white rounded-2xl px-4 py-3.5 mb-5 border border-gray-100 flex-row items-center justify-between"
            onPress={() => router.push('/(app)/products' as never)}
            activeOpacity={0.7}
          >
            <View>
              <Text className="text-xs text-gray-400 font-medium">Valor del inventario</Text>
              <Text className="text-xl font-bold text-gray-900 mt-0.5">{formatCurrency(inventoryValue)}</Text>
            </View>
            <View className="flex-row items-center gap-2">
              <View className="bg-blue-50 px-3 py-1.5 rounded-xl">
                <Text className="text-xs text-blue-500 font-medium">a precio de costo</Text>
              </View>
              <ChevronRight size={14} color="#D1D5DB" />
            </View>
          </TouchableOpacity>
        )}

        {/* Acciones rápidas */}
        {!loadingProducts && !noModules && (canProducts || canStock || canTurns || canSales) && (
          <View className="flex-row gap-2.5 mb-5">
            {canSales && (
              <QuickAction
                icon={<ShoppingCart size={20} color="white" />}
                label="Venta"
                onPress={() => router.push('/(modals)/new-sale' as never)}
                primary
              />
            )}
            {canTurns && (
              <QuickAction
                icon={<CalendarDays size={20} color="#208AEF" />}
                label="Turno"
                onPress={() => router.push(`/(modals)/turn-form?date=${todayKey}` as never)}
              />
            )}
            {canStock && (
              <QuickAction
                icon={<BarChart2 size={20} color="#208AEF" />}
                label="Movimiento"
                onPress={openMovement}
              />
            )}
            {canProducts && (
              <QuickAction
                icon={<ScanLine size={20} color="#208AEF" />}
                label="Escanear"
                onPress={() => router.push('/(modals)/scan?mode=product' as never)}
              />
            )}
          </View>
        )}

        {/* Sales widget */}
        {!loadingProducts && !noModules && canSales && (
          <SalesWidget
            summary={salesSummary}
            yesterdaySummary={yesterdaySummary}
            onNewSale={() => router.push('/(modals)/new-sale' as never)}
            onViewAll={() => router.push('/(app)/sales' as never)}
            onViewStats={() => router.push('/(app)/sales/stats' as never)}
          />
        )}

        {/* Invitaciones pendientes */}
        {pendingInvitations.length > 0 && (
          <TouchableOpacity
            onPress={() => router.push('/(app)/notifications' as never)}
            activeOpacity={0.85}
            className="bg-blue-50 border border-blue-200 rounded-2xl px-4 py-3.5 mb-4 flex-row items-center gap-3"
          >
            <View className="w-9 h-9 rounded-full bg-blue-100 items-center justify-center shrink-0">
              <UserPlus size={16} color="#3B82F6" />
            </View>
            <View className="flex-1">
              <Text className="text-sm font-semibold text-gray-900">
                {pendingInvitations.length === 1
                  ? `Invitación de ${pendingInvitations[0].tenantName}`
                  : `${pendingInvitations.length} invitaciones pendientes`}
              </Text>
              <Text className="text-xs text-blue-600 mt-0.5">Toca para ver y aceptar</Text>
            </View>
            <ChevronRight size={14} color="#93C5FD" />
          </TouchableOpacity>
        )}

        {/* Notificaciones no leídas */}
        {!loadingProducts && !noModules && unreadNotifications.length > 0 && (
          <View className="bg-white rounded-2xl overflow-hidden mb-5 border border-blue-100">
            <View className="flex-row items-center justify-between px-4 pt-3.5 pb-2">
              <View className="flex-row items-center gap-2">
                <Bell size={13} color="#208AEF" />
                <Text className="text-xs font-semibold text-gray-700 uppercase tracking-wide">Sin leer</Text>
              </View>
              <TouchableOpacity
                onPress={() => router.push('/(app)/notifications' as never)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Text className="text-xs text-blue-500 font-medium">Ver todas</Text>
              </TouchableOpacity>
            </View>
            {unreadNotifications.map((n, i) => (
              <View
                key={n.id}
                className={`px-4 py-3 bg-blue-50/40 ${
                  i < unreadNotifications.length - 1 ? 'border-b border-blue-100' : ''
                }`}
              >
                <Text className="text-sm font-semibold text-gray-900" numberOfLines={1}>{n.title}</Text>
                <Text className="text-xs text-gray-500 mt-0.5 leading-4" numberOfLines={2}>{n.body}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Sin stock — urgente */}
        {!loadingProducts && !noModules && canStock && sinStock.length > 0 && (
          <View className="bg-white rounded-2xl overflow-hidden mb-3 border border-red-100">
            <View className="flex-row items-center justify-between px-4 pt-3.5 pb-2">
              <View className="flex-row items-center gap-2">
                <AlertTriangle size={13} color="#DC2626" />
                <Text className="text-xs font-semibold text-red-700 uppercase tracking-wide">
                  Sin stock · {sinStock.length}
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => router.push('/(app)/stock/index' as never)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Text className="text-xs text-red-500 font-medium">Ver todos</Text>
              </TouchableOpacity>
            </View>
            <View className="px-4">
              {sinStock.slice(0, 4).map((p) => (
                <AlertProductItem
                  key={p.id}
                  product={p}
                  variant="empty"
                  onPress={() => router.push(`/(app)/products/${p.id}` as never)}
                />
              ))}
              {sinStock.length > 4 && (
                <TouchableOpacity
                  className="flex-row items-center justify-center py-3 gap-1"
                  onPress={() => router.push('/(app)/stock/index' as never)}
                >
                  <Text className="text-xs text-red-500 font-medium">Ver {sinStock.length - 4} más</Text>
                  <ChevronRight size={12} color="#EF4444" />
                </TouchableOpacity>
              )}
            </View>
          </View>
        )}

        {/* Stock bajo */}
        {!loadingProducts && !noModules && canStock && stockBajo.length > 0 && (
          <View className="bg-white rounded-2xl overflow-hidden mb-5 border border-amber-100">
            <View className="flex-row items-center justify-between px-4 pt-3.5 pb-2">
              <View className="flex-row items-center gap-2">
                <AlertTriangle size={13} color="#D97706" />
                <Text className="text-xs font-semibold text-amber-700 uppercase tracking-wide">
                  Stock bajo · {stockBajo.length}
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => router.push('/(app)/stock/index' as never)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Text className="text-xs text-amber-600 font-medium">Ver todos</Text>
              </TouchableOpacity>
            </View>
            <View className="px-4">
              {stockBajo.slice(0, 4).map((p) => (
                <AlertProductItem
                  key={p.id}
                  product={p}
                  variant="low"
                  onPress={() => router.push(`/(app)/products/${p.id}` as never)}
                />
              ))}
              {stockBajo.length > 4 && (
                <TouchableOpacity
                  className="flex-row items-center justify-center py-3 gap-1"
                  onPress={() => router.push('/(app)/stock/index' as never)}
                >
                  <Text className="text-xs text-amber-600 font-medium">Ver {stockBajo.length - 4} más</Text>
                  <ChevronRight size={12} color="#D97706" />
                </TouchableOpacity>
              )}
            </View>
          </View>
        )}

        {/* Estado saludable */}
        {!loadingProducts && !noModules && allGood && (
          <View className="bg-green-50 border border-green-200 rounded-2xl px-4 py-3 flex-row items-center gap-2 mb-5">
            <CheckCircle2 size={15} color="#16A34A" />
            <Text className="text-sm text-green-700 font-medium">Todo el stock en orden</Text>
          </View>
        )}

        {/* Actividad reciente — solo owner */}
        {!loadingProducts && !noModules && isOwner && canStock && movements.length > 0 && (
          <View className="bg-white rounded-2xl overflow-hidden border border-gray-100">
            <View className="flex-row items-center justify-between px-4 pt-3.5 pb-2">
              <Text className="text-xs font-semibold text-gray-700 uppercase tracking-wide">
                Actividad reciente
              </Text>
              <TouchableOpacity
                onPress={() => router.push('/(app)/stock/history' as never)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Text className="text-xs text-blue-500 font-medium">Ver historial</Text>
              </TouchableOpacity>
            </View>
            <View className="px-4">
              {movements.map((m) => (
                <ActivityRow key={m.id} item={m} />
              ))}
            </View>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
