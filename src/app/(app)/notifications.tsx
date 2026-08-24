import {
  View,
  Text,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Alert,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useCallback, useState } from 'react';
import { useFocusRefresh } from '@/lib/use-focus-refresh';
import { AlertTriangle, Bell, CheckCheck, Package, Trash2, UserPlus } from 'lucide-react-native';
import { api } from '@/lib/api';
import { useAuthContext } from '@/lib/auth-context';

// ─── Types ────────────────────────────────────────────────────────────────────

type PendingInvitation = {
  id: string;
  tenantId: string;
  tenantName: string;
  role: 'owner' | 'staff';
  expiresAt: string;
};

type AppNotification = {
  id: string;
  type: string;
  title: string;
  body: string;
  read: boolean;
  data: Record<string, unknown> | null;
  createdAt: string;
};

// ─── Pending invitation card ──────────────────────────────────────────────────

function InvitationCard({
  item,
  onAccept,
  onDecline,
  accepting,
}: {
  item: PendingInvitation;
  onAccept: () => void;
  onDecline: () => void;
  accepting: boolean;
}) {
  const roleLabel = item.role === 'owner' ? 'Dueño' : 'Empleado';
  return (
    <View className="mx-4 mb-3 bg-blue-50 border border-blue-200 rounded-2xl p-4">
      <View className="flex-row items-center gap-3 mb-3">
        <View className="w-10 h-10 rounded-full bg-blue-100 items-center justify-center">
          <UserPlus size={18} color="#3B82F6" />
        </View>
        <View className="flex-1">
          <Text className="text-sm font-semibold text-gray-900">Invitación recibida</Text>
          <Text className="text-xs text-gray-500 mt-0.5">
            Te invitaron a unirte a{' '}
            <Text className="font-semibold text-gray-700">{item.tenantName}</Text>
            {' '}como{' '}
            <Text className="font-semibold text-gray-700">{roleLabel}</Text>
          </Text>
        </View>
      </View>
      <View className="flex-row gap-2">
        <TouchableOpacity
          onPress={onDecline}
          disabled={accepting}
          className="flex-1 border border-gray-300 rounded-xl py-2.5 items-center bg-white"
          activeOpacity={0.7}
        >
          <Text className="text-sm font-medium text-gray-600">Rechazar</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={onAccept}
          disabled={accepting}
          className="flex-1 bg-blue-500 rounded-xl py-2.5 items-center"
          activeOpacity={0.85}
        >
          {accepting ? (
            <ActivityIndicator size="small" color="white" />
          ) : (
            <Text className="text-sm font-semibold text-white">Aceptar</Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ─── Icon by notification type ────────────────────────────────────────────────

function NotificationIcon({ type, read }: { type: string; read: boolean }) {
  const base = read ? 'bg-gray-100' : 'bg-amber-100';
  const color = read ? '#9CA3AF' : '#D97706';

  if (type === 'low_stock') {
    return (
      <View className={`w-9 h-9 rounded-full items-center justify-center mr-3 mt-0.5 ${read ? 'bg-gray-100' : 'bg-orange-100'}`}>
        <Package size={16} color={read ? '#9CA3AF' : '#EA580C'} />
      </View>
    );
  }

  return (
    <View className={`w-9 h-9 rounded-full items-center justify-center mr-3 mt-0.5 ${base}`}>
      <AlertTriangle size={16} color={color} />
    </View>
  );
}

// ─── Notification row ─────────────────────────────────────────────────────────

function NotificationRow({
  item,
  onPress,
  onDelete,
}: {
  item: AppNotification;
  onPress: () => void;
  onDelete: () => void;
}) {
  const date = new Date(item.createdAt);
  const dateStr = date.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' });
  const timeStr = date.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.7}
      className={`flex-row items-start px-4 py-4 border-b border-gray-100 ${item.read ? '' : 'bg-blue-50/40'}`}
    >
      <NotificationIcon type={item.type} read={item.read} />

      {/* Content */}
      <View className="flex-1">
        <View className="flex-row items-center justify-between mb-0.5">
          <Text className={`text-sm font-semibold flex-1 mr-2 ${item.read ? 'text-gray-700' : 'text-gray-900'}`}>
            {item.title}
          </Text>
          {!item.read && <View className="w-2 h-2 rounded-full bg-blue-500" />}
        </View>
        <Text className="text-xs text-gray-500 leading-4">{item.body}</Text>
        <Text className="text-xs text-gray-400 mt-1.5">
          {dateStr} · {timeStr}
        </Text>
      </View>

      {/* Delete button */}
      <TouchableOpacity
        onPress={(e) => { e.stopPropagation(); onDelete(); }}
        className="ml-2 p-2 rounded-xl"
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        activeOpacity={0.7}
      >
        <Trash2 size={15} color="#D1D5DB" />
      </TouchableOpacity>
    </TouchableOpacity>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function NotificationsScreen() {
  const queryClient = useQueryClient();
  const { signIn, reloadUser } = useAuthContext();

  useFocusRefresh([['notifications'], ['notifications-unread'], ['invitations-mine']], 60_000);

  const [refreshing, setRefreshing] = useState(false);
  const [acceptingId, setAcceptingId] = useState<string | null>(null);

  const { data: notifications = [], isLoading: loadingNotifs } = useQuery({
    queryKey: ['notifications'],
    queryFn: () => api.get<AppNotification[]>('/notifications'),
  });

  const { data: invitations = [], isLoading: loadingInvitations } = useQuery({
    queryKey: ['invitations-mine'],
    queryFn: () => api.get<PendingInvitation[]>('/invitations/mine'),
  });

  const isLoading = loadingNotifs || loadingInvitations;

  function invalidate() {
    void queryClient.invalidateQueries({ queryKey: ['notifications'] });
    void queryClient.invalidateQueries({ queryKey: ['notifications-unread'] });
    void queryClient.invalidateQueries({ queryKey: ['invitations-mine'] });
  }

  const markReadMutation = useMutation({
    mutationFn: (id: string) => api.patch(`/notifications/${id}/read`, {}),
    onSuccess: invalidate,
  });

  const markAllMutation = useMutation({
    mutationFn: () => api.patch('/notifications/read-all', {}),
    onSuccess: invalidate,
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/notifications/${id}`),
    onSuccess: invalidate,
  });

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await queryClient.invalidateQueries({ queryKey: ['notifications'] });
    await queryClient.invalidateQueries({ queryKey: ['notifications-unread'] });
    await queryClient.invalidateQueries({ queryKey: ['invitations-mine'] });
    setRefreshing(false);
  }, [queryClient]);

  async function handleAcceptInvitation(inv: PendingInvitation) {
    setAcceptingId(inv.id);
    try {
      const res = await api.post<{ ok: boolean; access_token: string }>(
        `/invitations/${inv.id}/accept-mine`,
        {},
      );
      await signIn(res.access_token);
      await reloadUser();
      invalidate();
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'No se pudo aceptar la invitación');
    } finally {
      setAcceptingId(null);
    }
  }

  function handleDeclineInvitation(inv: PendingInvitation) {
    Alert.alert(
      'Rechazar invitación',
      `¿Seguro que querés rechazar la invitación de ${inv.tenantName}?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Rechazar',
          style: 'destructive',
          onPress: () => {
            // Mark as read/dismissed locally — no server action needed
            void queryClient.setQueryData<PendingInvitation[]>(
              ['invitations-mine'],
              (prev) => prev?.filter((i) => i.id !== inv.id) ?? [],
            );
          },
        },
      ],
    );
  }

  const unread = notifications.filter((n) => !n.read).length;

  function handlePress(item: AppNotification) {
    if (!item.read) markReadMutation.mutate(item.id);
  }

  function handleDelete(item: AppNotification) {
    Alert.alert(
      'Eliminar notificación',
      '¿Querés eliminar esta notificación?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: () => deleteMutation.mutate(item.id),
        },
      ],
    );
  }

  const isEmpty = invitations.length === 0 && notifications.length === 0;

  return (
    <SafeAreaView className="flex-1 bg-gray-50">
      {/* Header */}
      <View className="flex-row items-center justify-between px-4 pt-6 pb-3">
        <Text className="text-2xl font-bold text-gray-900">Notificaciones</Text>
        {unread > 0 && (
          <TouchableOpacity
            onPress={() => markAllMutation.mutate()}
            disabled={markAllMutation.isPending}
            className="flex-row items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-50"
            activeOpacity={0.7}
          >
            {markAllMutation.isPending ? (
              <ActivityIndicator size="small" color="#208AEF" />
            ) : (
              <CheckCheck size={14} color="#208AEF" />
            )}
            <Text className="text-xs font-medium text-blue-600">Marcar todo leído</Text>
          </TouchableOpacity>
        )}
      </View>

      {isLoading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#208AEF" />
        </View>
      ) : (
        <ScrollView
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => void onRefresh()}
              tintColor="#208AEF"
            />
          }
        >
          {/* Pending invitations */}
          {invitations.length > 0 && (
            <View className="pt-2 pb-1">
              {invitations.map((inv) => (
                <InvitationCard
                  key={inv.id}
                  item={inv}
                  accepting={acceptingId === inv.id}
                  onAccept={() => void handleAcceptInvitation(inv)}
                  onDecline={() => handleDeclineInvitation(inv)}
                />
              ))}
            </View>
          )}

          {/* Regular notifications */}
          {notifications.map((item) => (
            <NotificationRow
              key={item.id}
              item={item}
              onPress={() => handlePress(item)}
              onDelete={() => handleDelete(item)}
            />
          ))}

          {isEmpty && (
            <View className="items-center justify-center py-20">
              <Bell size={40} color="#D1D5DB" />
              <Text className="text-gray-400 mt-3 text-sm">Sin notificaciones</Text>
            </View>
          )}

          <View className="h-8" />
        </ScrollView>
      )}
    </SafeAreaView>
  );
}
