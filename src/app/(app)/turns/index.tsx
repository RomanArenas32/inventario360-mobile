import {
  View, Text, FlatList, TouchableOpacity, RefreshControl, Alert,
  ActivityIndicator, Modal, Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState, useCallback, useMemo, useEffect } from 'react';
import { useFocusRefresh } from '@/lib/use-focus-refresh';
import { Plus, ChevronLeft, ChevronRight, Clock, CalendarDays, History, Pencil } from 'lucide-react-native';
import { api } from '@/lib/api';
import { editStore } from '@/lib/edit-store';
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

function isToday(d: Date): boolean {
  return d.toDateString() === new Date().toDateString();
}

// ─── Time remaining hook ───────────────────────────────────────────────────────

function useTimeRemaining(turn: Turn | null): string | null {
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    if (!turn || turn.status !== 'in_progress' || !turn.startTime) return;
    const interval = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(interval);
  }, [turn?.id, turn?.status]);

  if (!turn?.startTime || turn.status !== 'in_progress') return null;
  const endTime = new Date(turn.startTime).getTime() + turn.duration * 60_000;
  const remaining = Math.round((endTime - now) / 60_000);
  if (remaining <= 0) return 'Tiempo cumplido';
  return `${remaining} min restantes`;
}

// ─── Chip ─────────────────────────────────────────────────────────────────────

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

// ─── Hero card (next / active turn) ───────────────────────────────────────────

function NextTurnCard({
  turn,
  onStart,
}: {
  turn: Turn;
  onStart: () => void;
}) {
  const isActive = turn.status === 'in_progress';
  const timeRemaining = useTimeRemaining(isActive ? turn : null);

  return (
    <View className={`mx-4 mb-4 rounded-2xl p-4 ${isActive ? 'bg-amber-500' : 'bg-blue-500'}`}>
      <Text className={`text-xs font-semibold mb-1 ${isActive ? 'text-amber-100' : 'text-blue-100'}`}>
        {isActive ? '▶ EN CURSO' : '⏱ PRÓXIMO TURNO'}
      </Text>
      <Text className="text-white text-xl font-bold">{turn.clientName}</Text>
      <Text className={`mt-0.5 ${isActive ? 'text-amber-100' : 'text-blue-100'}`}>{turn.service}</Text>
      <View className="flex-row items-center gap-4 mt-2 flex-wrap">
        <View className="flex-row items-center gap-1">
          <Clock size={12} color="rgba(255,255,255,0.8)" />
          <Text className="text-white text-sm opacity-90">{formatTime(turn.startTime)}</Text>
        </View>
        <Text className="text-white text-sm opacity-90">{turn.duration} min</Text>
        {turn.assignedUser && (
          <Text className="text-white text-sm opacity-90">{turn.assignedUser.name}</Text>
        )}
        {timeRemaining && (
          <Text className="text-white text-xs font-semibold opacity-90">⏳ {timeRemaining}</Text>
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

// ─── Turn row ─────────────────────────────────────────────────────────────────

function TurnRow({
  turn,
  queuePos,
  onPress,
}: {
  turn: Turn;
  queuePos?: number;
  onPress: () => void;
}) {
  const sm = STATUS_META[turn.status];
  const isPast = turn.status === 'done' || turn.status === 'cancelled' || turn.status === 'no_show';

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.7}
      className={`flex-row items-center px-4 py-3.5 border-b border-gray-100 bg-white ${isPast ? 'opacity-50' : ''}`}
    >
      {/* Time / queue column */}
      <View className="w-14 mr-3 items-center">
        {turn.startTime ? (
          <>
            <Text className="text-sm font-bold text-gray-900">{formatTime(turn.startTime)}</Text>
            <Text className="text-xs text-gray-400">{turn.duration}m</Text>
          </>
        ) : (
          <View className="bg-gray-100 px-1.5 py-0.5 rounded">
            <Text className="text-xs text-gray-500 font-medium">
              {queuePos != null ? `#${queuePos}` : 'Cola'}
            </Text>
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
        {turn.price != null && (
          <Text className="text-xs text-green-600 font-semibold mt-0.5">
            ${Number(turn.price).toLocaleString('es-AR')}
          </Text>
        )}
      </View>

      {/* Status badge */}
      <View className="px-2.5 py-1 rounded-full" style={{ backgroundColor: sm.bg }}>
        <Text className="text-xs font-semibold" style={{ color: sm.text }}>{sm.label}</Text>
      </View>
    </TouchableOpacity>
  );
}

// ─── Action Sheet ─────────────────────────────────────────────────────────────

type ActionItem = {
  label: string;
  style?: 'default' | 'destructive' | 'cancel';
  onPress: () => void;
};

function ActionSheet({
  visible,
  title,
  subtitle,
  actions,
  onClose,
}: {
  visible: boolean;
  title: string;
  subtitle?: string;
  actions: ActionItem[];
  onClose: () => void;
}) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableOpacity
        className="flex-1"
        style={{ backgroundColor: 'rgba(0,0,0,0.4)' }}
        activeOpacity={1}
        onPress={onClose}
      >
        <View className="flex-1 justify-end">
          <SafeAreaView className="bg-white rounded-t-3xl" edges={['bottom']}>
            {/* Handle */}
            <View className="items-center pt-3 pb-1">
              <View className="w-10 h-1 rounded-full bg-gray-300" />
            </View>

            {/* Title */}
            <View className="px-4 py-3 border-b border-gray-100">
              <Text className="text-base font-bold text-gray-900">{title}</Text>
              {subtitle ? (
                <Text className="text-xs text-gray-500 mt-0.5">{subtitle}</Text>
              ) : null}
            </View>

            {/* Actions */}
            {actions.map((a, i) => (
              <TouchableOpacity
                key={i}
                onPress={() => { onClose(); a.onPress(); }}
                className={`px-4 py-4 border-b border-gray-50 ${a.style === 'cancel' ? 'mt-2' : ''}`}
                activeOpacity={0.7}
              >
                <Text
                  className={`text-base font-medium ${
                    a.style === 'destructive'
                      ? 'text-red-500'
                      : a.style === 'cancel'
                      ? 'text-gray-400'
                      : 'text-gray-900'
                  }`}
                >
                  {a.label}
                </Text>
              </TouchableOpacity>
            ))}
            <View className="h-2" />
          </SafeAreaView>
        </View>
      </TouchableOpacity>
    </Modal>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function TurnsScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();

  const [selectedDate, setSelectedDate] = useState(new Date());
  const [filter, setFilter] = useState<Filter>('all');
  const [refreshing, setRefreshing] = useState(false);
  const [actionTurn, setActionTurn] = useState<Turn | null>(null);

  const dateKey = toDateKey(selectedDate);

  useFocusRefresh([['turns', dateKey]]);

  const { data: turns = [], isLoading } = useQuery({
    queryKey: ['turns', dateKey],
    queryFn: () => api.get<Turn[]>(`/turns?date=${dateKey}`),
  });

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await queryClient.invalidateQueries({ queryKey: ['turns', dateKey] });
    setRefreshing(false);
  }, [queryClient, dateKey]);

  // Next/active hero turn
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

  // Queue position map (only queue turns, in creation order)
  const queuePositions = useMemo(() => {
    const queueTurns = turns.filter((t) => !t.startTime);
    const map = new Map<string, number>();
    queueTurns.forEach((t, i) => map.set(t.id, i + 1));
    return map;
  }, [turns]);

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

  function goToToday() {
    setSelectedDate(new Date());
  }

  // ─── Status update ────────────────────────────────────────────────────────

  async function updateStatus(turn: Turn, status: TurnStatus) {
    // Optimistic update — instant UI response before API roundtrip
    queryClient.setQueryData<Turn[]>(['turns', dateKey], (prev) =>
      prev?.map((t) => t.id === turn.id ? { ...t, status } : t) ?? [],
    );
    try {
      await api.patch(`/turns/${turn.id}`, { status });
      void queryClient.invalidateQueries({ queryKey: ['turns', dateKey] });
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
      void queryClient.invalidateQueries({ queryKey: ['turns', dateKey] });
      Alert.alert('Error', err instanceof Error ? err.message : 'No se pudo actualizar el turno');
    }
  }

  // ─── WhatsApp ─────────────────────────────────────────────────────────────

  function openWhatsApp(turn: Turn) {
    if (!turn.clientPhone) return;
    const phone = turn.clientPhone.replace(/\D/g, '');
    const msg = encodeURIComponent(
      `Hola ${turn.clientName}, te recordamos tu turno para ${turn.service}${turn.startTime ? ` a las ${formatTime(turn.startTime)}` : ''}.`,
    );
    void Linking.openURL(`whatsapp://send?phone=${phone}&text=${msg}`);
  }

  // ─── Edit turn ────────────────────────────────────────────────────────────

  function openEdit(turn: Turn) {
    editStore.setTurn(turn);
    router.push(`/(modals)/turn-form?date=${turn.date}&edit=1` as never);
  }

  // ─── Action sheet for a turn ──────────────────────────────────────────────

  function buildActions(turn: Turn): ActionItem[] {
    const actions: ActionItem[] = [];

    if (turn.status === 'pending') {
      actions.push({ label: '▶  Iniciar turno', onPress: () => void updateStatus(turn, 'in_progress') });
      actions.push({ label: '✗  No se presentó', onPress: () => void updateStatus(turn, 'no_show') });
    }
    if (turn.status === 'in_progress') {
      actions.push({ label: '✓  Completar turno', onPress: () => void updateStatus(turn, 'done') });
    }

    actions.push({ label: '✏  Editar turno', onPress: () => openEdit(turn) });

    if (turn.clientPhone) {
      actions.push({ label: '📱 Recordatorio por WhatsApp', onPress: () => openWhatsApp(turn) });
    }

    if (turn.status !== 'cancelled' && turn.status !== 'done' && turn.status !== 'no_show') {
      actions.push({ label: 'Cancelar turno', style: 'destructive', onPress: () => void updateStatus(turn, 'cancelled') });
    }

    actions.push({ label: 'Cerrar', style: 'cancel', onPress: () => {} });
    return actions;
  }

  const pendingCount = turns.filter((t) => t.status === 'pending').length;
  const inProgressCount = turns.filter((t) => t.status === 'in_progress').length;
  const doneCount = turns.filter((t) => t.status === 'done').length;

  return (
    <SafeAreaView className="flex-1 bg-gray-50">
      {/* Header */}
      <View className="px-4 pt-6 pb-3">
        <View className="flex-row items-center justify-between mb-4">
          <View className="flex-row items-center gap-3">
            <Text className="text-2xl font-bold text-gray-900">Turnos</Text>
            {!isToday(selectedDate) && (
              <TouchableOpacity
                onPress={goToToday}
                className="bg-blue-100 px-2.5 py-1 rounded-full"
                activeOpacity={0.7}
              >
                <Text className="text-blue-600 text-xs font-semibold">Hoy</Text>
              </TouchableOpacity>
            )}
          </View>
          <View className="flex-row items-center gap-2">
            <TouchableOpacity
              onPress={() => router.push('/(app)/turns/history' as never)}
              className="p-2"
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <History size={20} color="#6B7280" />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => router.push(`/(modals)/turn-form?date=${dateKey}` as never)}
              className="flex-row items-center gap-1.5 bg-blue-500 px-3.5 py-2 rounded-xl"
              activeOpacity={0.85}
            >
              <Plus size={16} color="white" />
              <Text className="text-white font-semibold text-sm">Nuevo</Text>
            </TouchableOpacity>
          </View>
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
          <TouchableOpacity
            onPress={goToToday}
            className="flex-row items-center gap-1.5"
            activeOpacity={0.7}
          >
            <CalendarDays size={14} color="#6B7280" />
            <Text className="text-sm font-semibold text-gray-900">{displayDate(selectedDate)}</Text>
          </TouchableOpacity>
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
            label={`Finalizados${doneCount > 0 ? ` (${doneCount})` : ''}`}
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
          extraData={turns}
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
            <TurnRow
              turn={item}
              queuePos={queuePositions.get(item.id)}
              onPress={() => setActionTurn(item)}
            />
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

      {/* Action sheet */}
      {actionTurn && (
        <ActionSheet
          visible={!!actionTurn}
          title={actionTurn.clientName}
          subtitle={`${actionTurn.service}${actionTurn.startTime ? ` · ${formatTime(actionTurn.startTime)}` : ' · Cola'}`}
          actions={buildActions(actionTurn)}
          onClose={() => setActionTurn(null)}
        />
      )}
    </SafeAreaView>
  );
}
