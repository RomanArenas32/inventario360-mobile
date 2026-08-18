import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useCallback, useState } from 'react';
import { useFocusRefresh } from '@/lib/use-focus-refresh';
import { AlertTriangle, Bell, CheckCheck, Package, Trash2 } from 'lucide-react-native';
import { api } from '@/lib/api';

// ─── Types ────────────────────────────────────────────────────────────────────

type AppNotification = {
  id: string;
  type: string;
  title: string;
  body: string;
  read: boolean;
  data: Record<string, unknown> | null;
  createdAt: string;
};

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

  useFocusRefresh([['notifications'], ['notifications-unread']], 60_000);

  const [refreshing, setRefreshing] = useState(false);

  const { data: notifications = [], isLoading } = useQuery({
    queryKey: ['notifications'],
    queryFn: () => api.get<AppNotification[]>('/notifications'),
  });

  function invalidate() {
    void queryClient.invalidateQueries({ queryKey: ['notifications'] });
    void queryClient.invalidateQueries({ queryKey: ['notifications-unread'] });
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
    setRefreshing(false);
  }, [queryClient]);

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
        <FlatList
          data={notifications}
          keyExtractor={(n) => n.id}
          renderItem={({ item }) => (
            <NotificationRow
              item={item}
              onPress={() => handlePress(item)}
              onDelete={() => handleDelete(item)}
            />
          )}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => void onRefresh()}
              tintColor="#208AEF"
            />
          }
          ListEmptyComponent={
            <View className="items-center justify-center py-20">
              <Bell size={40} color="#D1D5DB" />
              <Text className="text-gray-400 mt-3 text-sm">Sin notificaciones</Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}
