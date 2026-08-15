import {
  View,
  Text,
  FlatList,
  ActivityIndicator,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useInfiniteQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { ArrowLeft, TrendingUp, TrendingDown, Sliders } from 'lucide-react-native';
import { api } from '@/lib/api';
import type { StockMovement, StockMovementType, PaginatedResult } from '@/lib/types';

// ─── Badge ────────────────────────────────────────────────────────────────────

const TYPE_META: Record<StockMovementType, { label: string; bg: string; text: string; Icon: typeof TrendingUp }> = {
  entry:      { label: 'Entrada',  bg: '#F0FDF4', text: '#16A34A', Icon: TrendingUp },
  exit:       { label: 'Salida',   bg: '#FFF1F2', text: '#DC2626', Icon: TrendingDown },
  adjustment: { label: 'Ajuste',   bg: '#EFF6FF', text: '#2563EB', Icon: Sliders },
};

function TypeBadge({ type }: { type: StockMovementType }) {
  const meta = TYPE_META[type];
  const Icon = meta.Icon;
  return (
    <View
      className="flex-row items-center gap-1 px-2 py-0.5 rounded-full"
      style={{ backgroundColor: meta.bg }}
    >
      <Icon size={11} color={meta.text} />
      <Text className="text-xs font-semibold" style={{ color: meta.text }}>
        {meta.label}
      </Text>
    </View>
  );
}

// ─── Movement row ─────────────────────────────────────────────────────────────

function MovementRow({ item }: { item: StockMovement }) {
  const date = new Date(item.createdAt);
  const dateStr = date.toLocaleDateString('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
  });
  const timeStr = date.toLocaleTimeString('es-AR', {
    hour: '2-digit',
    minute: '2-digit',
  });

  const delta =
    item.type === 'entry'
      ? `+${item.quantity}`
      : item.type === 'exit'
      ? `-${item.quantity}`
      : `=${item.quantity}`;

  return (
    <View className="px-4 py-3.5 border-b border-gray-100">
      <View className="flex-row items-start justify-between mb-1.5">
        <View className="flex-1 mr-2">
          <Text className="text-sm font-semibold text-gray-900" numberOfLines={1}>
            {item.product.name}
          </Text>
          {item.product.code ? (
            <Text className="text-xs text-gray-400 font-mono mt-0.5">{item.product.code}</Text>
          ) : null}
        </View>
        <Text className="text-sm font-bold text-gray-900">{delta}</Text>
      </View>

      <View className="flex-row items-center gap-2 flex-wrap">
        <TypeBadge type={item.type} />
        <Text className="text-xs text-gray-400">
          {item.stockBefore} → {item.stockAfter}
        </Text>
        {item.reason ? (
          <Text className="text-xs text-gray-500 flex-1" numberOfLines={1}>
            · {item.reason}
          </Text>
        ) : null}
      </View>

      <View className="flex-row items-center justify-between mt-1.5">
        <Text className="text-xs text-gray-400">{item.user.name}</Text>
        <Text className="text-xs text-gray-400">
          {dateStr} {timeStr}
        </Text>
      </View>
    </View>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

const LIMIT = 20;

export default function StockHistoryScreen() {
  const router = useRouter();

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading } =
    useInfiniteQuery({
      queryKey: ['stock-movements'],
      queryFn: ({ pageParam = 0 }) =>
        api.get<PaginatedResult<StockMovement>>(
          `/stock-movements?limit=${LIMIT}&offset=${pageParam as number}`,
        ),
      initialPageParam: 0,
      getNextPageParam: (last) =>
        last.hasMore ? last.offset + last.limit : undefined,
    });

  const movements = data?.pages.flatMap((p) => p.data) ?? [];

  return (
    <SafeAreaView className="flex-1 bg-gray-50">
      {/* Header */}
      <View className="flex-row items-center gap-3 px-4 py-4 border-b border-gray-100 bg-white">
        <TouchableOpacity
          onPress={() => router.back()}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <ArrowLeft size={22} color="#374151" />
        </TouchableOpacity>
        <Text className="text-lg font-semibold text-gray-900">Historial de movimientos</Text>
      </View>

      {isLoading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#208AEF" />
        </View>
      ) : (
        <FlatList
          data={movements}
          keyExtractor={(m) => m.id}
          renderItem={({ item }) => <MovementRow item={item} />}
          onEndReached={() => {
            if (hasNextPage && !isFetchingNextPage) {
              void fetchNextPage();
            }
          }}
          onEndReachedThreshold={0.3}
          ListFooterComponent={
            isFetchingNextPage ? (
              <View className="py-4 items-center">
                <ActivityIndicator size="small" color="#208AEF" />
              </View>
            ) : movements.length > 0 && !hasNextPage ? (
              <View className="py-4 items-center">
                <Text className="text-xs text-gray-400">No hay más movimientos</Text>
              </View>
            ) : null
          }
          ListEmptyComponent={
            <View className="flex-1 items-center justify-center py-20">
              <Text className="text-gray-400 text-sm">Sin movimientos registrados</Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}
