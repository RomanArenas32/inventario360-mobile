import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useCallback, useState } from 'react';
import { AlertTriangle, Bell, CheckCheck } from 'lucide-react-native';
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

// ─── Notification row ─────────────────────────────────────────────────────────

function NotificationRow({
  item,
  onPress,
}: {
  item: AppNotification;
  onPress: () => void;
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
      {/* Icon */}
      <View
        className={`w-9 h-9 rounded-full items-center justify-center mr-3 mt-0.5 ${item.read ? 'bg-gray-100' : 'bg-amber-100'}`}
      >
        <AlertTriangle size={16} color={item.read ? '#9CA3AF' : '#D97706'} />
      </View>

      {/* Content */}
      <View className="flex-1">
        <View className="flex-row items-center justify-between mb-0.5">
          <Text className={`text-sm font-semibold ${item.read ? 'text-gray-700' : 'text-gray-900'}`}>
            {item.title}
          </Text>
          {!item.read && (
            <View className="w-2 h-2 rounded-full bg-blue-500 ml-2" />
          )}
        </View>
        <Text className="text-xs text-gray-500 leading-4">{item.body}</Text>
        <Text className="text-xs text-gray-400 mt-1.5">
          {dateStr} · {timeStr}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function NotificationsScreen() {
  const queryClient = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);

  const { data: notifications = [], isLoading } = useQuery({
    queryKey: ['notifications'],
    queryFn: () => api.get<AppNotification[]>('/notifications'),
  });

  const markReadMutation = useMutation({
    mutationFn: (id: string) => api.patch(`/notifications/${id}/read`, {}),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['notifications'] });
      void queryClient.invalidateQueries({ queryKey: ['notifications-unread'] });
    },
  });

  const markAllMutation = useMutation({
    mutationFn: () => api.patch('/notifications/read-all', {}),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['notifications'] });
      void queryClient.invalidateQueries({ queryKey: ['notifications-unread'] });
    },
  });

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await queryClient.invalidateQueries({ queryKey: ['notifications'] });
    await queryClient.invalidateQueries({ queryKey: ['notifications-unread'] });
    setRefreshing(false);
  }, [queryClient]);

  const unread = notifications.filter((n) => !n.read).length;

  function handlePress(item: AppNotification) {
    if (!item.read) {
      markReadMutation.mutate(item.id);
    }
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
            <NotificationRow item={item} onPress={() => handlePress(item)} />
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
