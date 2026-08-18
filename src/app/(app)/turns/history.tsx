import {
  View, Text, TextInput, FlatList, TouchableOpacity, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useInfiniteQuery } from '@tanstack/react-query';
import { useState, useMemo } from 'react';
import { ArrowLeft, Search, X } from 'lucide-react-native';
import { api } from '@/lib/api';
import type { Turn, TurnStatus, PaginatedResult } from '@/lib/types';

// ─── Constants ────────────────────────────────────────────────────────────────

const STATUS_META: Record<TurnStatus, { label: string; color: string }> = {
  pending:     { label: 'Pendiente',     color: '#2563EB' },
  in_progress: { label: 'En curso',      color: '#D97706' },
  done:        { label: 'Completado',    color: '#16A34A' },
  cancelled:   { label: 'Cancelado',     color: '#DC2626' },
  no_show:     { label: 'No apareció',   color: '#6B7280' },
};

const LIMIT = 30;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00');
  const today = new Date();
  if (d.toDateString() === today.toDateString()) return 'Hoy';
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  if (d.toDateString() === yesterday.toDateString()) return 'Ayer';
  return d.toLocaleDateString('es-AR', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
}

function formatTime(iso: string | null): string {
  if (!iso) return 'Cola';
  return new Date(iso).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
}

// Inline debounce
function useDebounce<T>(value: T, ms = 400): T {
  const [debounced, setDebounced] = useState(value);
  useMemo(() => {
    const t = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return debounced;
}

// ─── Turn history row ─────────────────────────────────────────────────────────

function TurnHistoryRow({ turn }: { turn: Turn }) {
  const sm = STATUS_META[turn.status];

  return (
    <View className="flex-row items-start px-4 py-3.5 border-b border-gray-100 bg-white">
      {/* Date column */}
      <View className="w-24 mr-3">
        <Text className="text-xs font-semibold text-gray-500">{formatDate(turn.date)}</Text>
        <Text className="text-xs text-gray-400 mt-0.5">{formatTime(turn.startTime)}</Text>
      </View>

      {/* Info */}
      <View className="flex-1 mr-2">
        <Text className="text-sm font-semibold text-gray-900">{turn.clientName}</Text>
        <Text className="text-xs text-gray-500 mt-0.5">{turn.service}</Text>
        {turn.assignedUser && (
          <Text className="text-xs text-gray-400 mt-0.5">{turn.assignedUser.name}</Text>
        )}
        {turn.price != null && (
          <Text className="text-xs text-green-600 font-semibold mt-0.5">
            ${Number(turn.price).toLocaleString('es-AR')}
          </Text>
        )}
      </View>

      {/* Status */}
      <Text className="text-xs font-semibold" style={{ color: sm.color }}>{sm.label}</Text>
    </View>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function TurnHistoryScreen() {
  const router = useRouter();
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 400);

  function buildUrl(offset: number) {
    const params = new URLSearchParams({ limit: String(LIMIT), offset: String(offset) });
    if (debouncedSearch.trim()) params.set('search', debouncedSearch.trim());
    return `/turns/history?${params.toString()}`;
  }

  const {
    data,
    isLoading,
    isFetchingNextPage,
    fetchNextPage,
    hasNextPage,
  } = useInfiniteQuery({
    queryKey: ['turns-history', debouncedSearch],
    queryFn: ({ pageParam = 0 }) => api.get<PaginatedResult<Turn>>(buildUrl(pageParam as number)),
    getNextPageParam: (last) =>
      last.hasMore ? last.offset + last.data.length : undefined,
    initialPageParam: 0,
  });

  const allTurns = useMemo(
    () => data?.pages.flatMap((p) => p.data) ?? [],
    [data],
  );

  const total = data?.pages[0]?.total ?? 0;

  return (
    <SafeAreaView className="flex-1 bg-gray-50">
      {/* Header */}
      <View className="px-4 pt-5 pb-3">
        <View className="flex-row items-center gap-3 mb-4">
          <TouchableOpacity
            onPress={() => router.back()}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <ArrowLeft size={22} color="#374151" />
          </TouchableOpacity>
          <Text className="text-2xl font-bold text-gray-900">Historial de turnos</Text>
        </View>

        {/* Search */}
        <View className="flex-row items-center bg-white border border-gray-200 rounded-xl px-3 gap-2 mb-2">
          <Search size={16} color="#9CA3AF" />
          <TextInput
            className="flex-1 py-3 text-sm text-gray-900"
            value={search}
            onChangeText={setSearch}
            placeholder="Buscar por cliente, servicio o teléfono..."
            placeholderTextColor="#9CA3AF"
            returnKeyType="search"
            autoCorrect={false}
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <X size={16} color="#9CA3AF" />
            </TouchableOpacity>
          )}
        </View>

        {/* Counter */}
        {!isLoading && (
          <Text className="text-xs text-gray-400">
            {total === 0
              ? 'Sin resultados'
              : `${total} turno${total !== 1 ? 's' : ''}${debouncedSearch ? ' encontrados' : ''}`}
          </Text>
        )}
      </View>

      {isLoading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#208AEF" />
        </View>
      ) : (
        <FlatList
          data={allTurns}
          keyExtractor={(t) => t.id}
          renderItem={({ item }) => <TurnHistoryRow turn={item} />}
          onEndReached={() => {
            if (hasNextPage && !isFetchingNextPage) void fetchNextPage();
          }}
          onEndReachedThreshold={0.4}
          ListFooterComponent={
            isFetchingNextPage ? (
              <View className="py-4 items-center">
                <ActivityIndicator size="small" color="#208AEF" />
              </View>
            ) : null
          }
          ListEmptyComponent={
            <View className="items-center justify-center py-20 px-8">
              <Search size={40} color="#D1D5DB" />
              <Text className="text-gray-400 mt-3 text-sm text-center">
                {debouncedSearch
                  ? `Sin turnos que coincidan con "${debouncedSearch}"`
                  : 'No hay turnos registrados aún'}
              </Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}
