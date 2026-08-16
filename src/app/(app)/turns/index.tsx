import {
  View, Text, FlatList, TouchableOpacity, RefreshControl, Alert, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState, useCallback, useMemo } from 'react';
import { useFocusRefresh } from '@/lib/use-focus-refresh';
import { Plus, ChevronLeft, ChevronRight, Clock, CalendarDays } from 'lucide-react-native';
import { api } from '@/lib/api';
import type { Turn, TurnStatus } from '@/lib/types';

// ─── Constants ────────────────────────────────────────────────────────────────

const STATUS_META: Record<TurnStatus, { label: string; bg: string; text: string }> = {
  pending:     { label: 'Pendiente',        bg: '#EFF6FF', text: '#2563EB' },
  in_progress: { label: 'En curso',         bg: '#FFFBEB', text: '#D97706' },
  done:        { label: 'Completado',        bg: '#F0FDF4', text: '#16A34A' },
  cancelled:   { label: 'Cancelado',         bg: '#FEF2F2', text: '#DC2626' },
  no_show:     { label: 'No se presentó',    bg: '#F9FAFB', text: '#6B7280' },
};

type Filter = 'all' | 'pending' | 'in_progress' | 'done';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function toDateKey(d: Date): string {
  return d.toISOString().split('T')[0]!;
}

function displayDate(d: Date): string {
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return 'Hoy';
  if (d.toDateString() === tomorrow.toDateString()) return 'Mañana';
  if (d.toDateString() === yesterday.toDateString()) return 'Ayer';
  return d.toLocaleDateString('es-AR', { weekday: 'short', day: 'numeric', month: 'short' });
}

function formatTime(iso: string | null): string {
  if (!iso) return 'Cola';
  return new Date(iso).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
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

function NextTurnCard({ turn, onStart }: { turn: Turn; onStart: () => void }) {
  const isActive = turn.status === 'in_progress';
  return (
    <View className={`mx-4 mb-4 rounded-2xl p-4 ${isActive ? 'bg-amber-500' : 'bg-blue-500'}`}>
      <Text className={`text-xs font-semibold mb-1 ${isActive ? 'text-amber-100' : 'text-blue-100'}`}>
        {isActive ? '▶ EN CURSO' : '⏱ PRÓXIMO TURNO'}
      </Text>
      <Text className="text-white text-xl font-bold">{turn.clientName}</Text>
      <Text className={`mt-0.5 ${isActive ? 'text-amber-100' : 'text-blue-100'}`}>{turn.service}</Text>
      <View className="flex-row items-center gap-4 mt-2">
        <View className="flex-row items-center gap-1">
          <Clock size={12} color="rgba(255,255,255,0.8)" />
          <Text className="text-white text-sm opacity-90">{formatTime(turn.startTime)}</Text>
        </View>
        <Text className="text-white text-sm opacity-90">{turn.duration} min</Text>
        {turn.assignedUser && (
          <Text className="text-white text-sm opacity-90">{turn.assignedUser.name}</Text>
        )}
      </View>
      {turn.status === 'pending' && (
        <TouchableOpacity
          onPress={onStart}
          className="bg-white mt-3 py-2.5 rounded-xl items-center"
          activeOpacity={0.85}
        >
          <Text className="text-blue-500 font-bold">Iniciar turno</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

function TurnRow({ turn, onPress }: { turn: Turn; onPress: () => void }) {
  const sm = STATUS_META[turn.status];
  const isActionable = turn.status === 'pending' || turn.status === 'in_progress';

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={!isActionable}
      activeOpacity={isActionable ? 0.7 : 1}
      className={`flex-row items-center px-4 py-3.5 border-b border-gray-100 bg-white ${
        turn.status === 'cancelled' || turn.status === 'no_show' ? 'opacity-45' : ''
      }`}
    >
      {/* Time column */}
      <View className="w-12 mr-3 items-center">
        {turn.startTime ? (
          <>
            <Text className="text-sm font-bold text-gray-900">{formatTime(turn.startTime)}</Text>
            <Text className="text-xs text-gray-400">{turn.duration}m</Text>
          </>
        ) : (
          <View className="bg-gray-100 px-1.5 py-0.5 rounded">
            <Text className="text-xs text-gray-500 font-medium">Cola</Text>
          </View>
        )}
      </View>

      {/* Info */}
      <View className="flex-1 mr-2">
        <Text className="text-sm font-semibold text-gray-900">{turn.clientName}</Text>
        <Text className="text-xs text-gray-500 mt-0.5">{turn.service}</Text>
        {turn.assignedUser && (
          <Text className="text-xs text-gray-400 mt-0.5">{turn.assignedUser.name}</Text>
        )}
      </View>

      {/* Status badge */}
      <View className="px-2.5 py-1 rounded-full" style={{ backgroundColor: sm.bg }}>
        <Text className="text-xs font-semibold" style={{ color: sm.text }}>{sm.label}</Text>
      </View>
    </TouchableOpacity>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function TurnsScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();

  const [selectedDate, setSelectedDate] = useState(new Date());
  const [filter, setFilter] = useState<Filter>('all');
  const [refreshing, setRefreshing] = useState(false);

  const dateKey = toDateKey(selectedDate);

  useFocusRefresh([['turns', dateKey]]);

  const { data: turns = [], isLoading } = useQuery({
    queryKey: ['turns', dateKey],
    // Backend: GET /turns?date=YYYY-MM-DD
    queryFn: () => api.get<Turn[]>(`/turns?date=${dateKey}`),
  });

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await queryClient.invalidateQueries({ queryKey: ['turns', dateKey] });
    setRefreshing(false);
  }, [queryClient, dateKey]);

  // Next/active turn for the hero card
  const heroTurn = useMemo(() => {
    const active = turns.find((t) => t.status === 'in_progress');
    if (active) return active;
    const now = Date.now() - 5 * 60_000; // 5 min buffer
    return (
      turns
        .filter((t) => t.status === 'pending' && t.startTime && new Date(t.startTime).getTime() > now)
        .sort((a, b) => new Date(a.startTime!).getTime() - new Date(b.startTime!).getTime())[0] ?? null
    );
  }, [turns]);

  // Filtered list
  const filtered = useMemo(() => {
    if (filter === 'all') return turns;
    if (filter === 'done') return turns.filter((t) => t.status === 'done' || t.status === 'cancelled' || t.status === 'no_show');
    return turns.filter((t) => t.status === filter);
  }, [turns, filter]);

  function shiftDay(delta: number) {
    setSelectedDate((d) => {
      const next = new Date(d);
      next.setDate(next.getDate() + delta);
      return next;
    });
  }

  // ─── Status actions ────────────────────────────────────────────────────────

  async function updateStatus(turn: Turn, status: TurnStatus) {
    try {
      await api.patch(`/turns/${turn.id}`, { status });
      await queryClient.invalidateQueries({ queryKey: ['turns', dateKey] });
      if (status === 'done') {
        Alert.alert(
          'Turno completado',
          `¿Registrar una venta por el servicio de ${turn.clientName}?`,
          [
            { text: 'No, gracias' },
            {
              text: 'Registrar venta',
              onPress: () => router.push('/(modals)/new-sale' as never),
            },
          ],
        );
      }
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'No se pudo actualizar el turno');
    }
  }

  function handleTurnPress(turn: Turn) {
    if (turn.status === 'done' || turn.status === 'cancelled' || turn.status === 'no_show') return;

    const actions: { text: string; style?: 'cancel' | 'destructive'; onPress?: () => void }[] = [];

    if (turn.status === 'pending') {
      actions.push({ text: 'Iniciar turno', onPress: () => void updateStatus(turn, 'in_progress') });
      actions.push({ text: 'No se presentó', onPress: () => void updateStatus(turn, 'no_show') });
    }
    if (turn.status === 'in_progress') {
      actions.push({ text: '✓ Completar', onPress: () => void updateStatus(turn, 'done') });
    }
    actions.push({
      text: 'Cancelar turno',
      style: 'destructive',
      onPress: () => void updateStatus(turn, 'cancelled'),
    });
    actions.push({ text: 'Cerrar', style: 'cancel' });

    Alert.alert(turn.clientName, turn.service, actions);
  }

  const pendingCount = turns.filter((t) => t.status === 'pending').length;
  const inProgressCount = turns.filter((t) => t.status === 'in_progress').length;
  const doneCount = turns.filter((t) => t.status === 'done').length;

  return (
    <SafeAreaView className="flex-1 bg-gray-50">
      {/* Header */}
      <View className="px-4 pt-6 pb-3">
        <View className="flex-row items-center justify-between mb-4">
          <Text className="text-2xl font-bold text-gray-900">Turnos</Text>
          <TouchableOpacity
            onPress={() => router.push(`/(modals)/turn-form?date=${dateKey}` as never)}
            className="flex-row items-center gap-1.5 bg-blue-500 px-3.5 py-2 rounded-xl"
            activeOpacity={0.85}
          >
            <Plus size={16} color="white" />
            <Text className="text-white font-semibold text-sm">Nuevo</Text>
          </TouchableOpacity>
        </View>

        {/* Date navigator */}
        <View className="flex-row items-center justify-between bg-white border border-gray-200 rounded-2xl px-2 py-1 mb-4">
          <TouchableOpacity
            onPress={() => shiftDay(-1)}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            className="p-2"
          >
            <ChevronLeft size={18} color="#6B7280" />
          </TouchableOpacity>
          <View className="flex-row items-center gap-1.5">
            <CalendarDays size={14} color="#6B7280" />
            <Text className="text-sm font-semibold text-gray-900">{displayDate(selectedDate)}</Text>
          </View>
          <TouchableOpacity
            onPress={() => shiftDay(1)}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            className="p-2"
          >
            <ChevronRight size={18} color="#6B7280" />
          </TouchableOpacity>
        </View>

        {/* Filter chips */}
        <View className="flex-row">
          <Chip label="Todos" active={filter === 'all'} onPress={() => setFilter('all')} />
          <Chip
            label={`Pendientes${pendingCount > 0 ? ` (${pendingCount})` : ''}`}
            active={filter === 'pending'}
            onPress={() => setFilter('pending')}
          />
          {inProgressCount > 0 && (
            <Chip
              label={`En curso (${inProgressCount})`}
              active={filter === 'in_progress'}
              onPress={() => setFilter('in_progress')}
            />
          )}
          <Chip
            label={`Completados${doneCount > 0 ? ` (${doneCount})` : ''}`}
            active={filter === 'done'}
            onPress={() => setFilter('done')}
          />
        </View>
      </View>

      {isLoading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#208AEF" />
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(t) => t.id}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => void onRefresh()} tintColor="#208AEF" />
          }
          ListHeaderComponent={
            heroTurn && filter === 'all' ? (
              <NextTurnCard
                turn={heroTurn}
                onStart={() => void updateStatus(heroTurn, 'in_progress')}
              />
            ) : null
          }
          renderItem={({ item }) => (
            <TurnRow turn={item} onPress={() => handleTurnPress(item)} />
          )}
          ListEmptyComponent={
            <View className="items-center justify-center py-20">
              <CalendarDays size={40} color="#D1D5DB" />
              <Text className="text-gray-400 mt-3 text-sm text-center px-8">
                {filter !== 'all'
                  ? 'Sin turnos con ese estado'
                  : `Sin turnos para ${displayDate(selectedDate).toLowerCase()}`}
              </Text>
              <TouchableOpacity
                onPress={() => router.push(`/(modals)/turn-form?date=${dateKey}` as never)}
                className="mt-4 bg-blue-500 px-5 py-2.5 rounded-xl"
                activeOpacity={0.85}
              >
                <Text className="text-white font-semibold text-sm">Agregar turno</Text>
              </TouchableOpacity>
            </View>
          }
        />
      )}

      {/* FAB */}
      <TouchableOpacity
        onPress={() => router.push(`/(modals)/turn-form?date=${dateKey}` as never)}
        className="absolute bottom-8 right-6 bg-blue-500 w-14 h-14 rounded-full items-center justify-center shadow-lg"
        activeOpacity={0.85}
        style={{ elevation: 4 }}
      >
        <Plus size={26} color="white" />
      </TouchableOpacity>
    </SafeAreaView>
  );
}
