import { Tabs } from 'expo-router';
import { LayoutDashboard, Package, BarChart2, Users, User, Bell, ShoppingCart, CalendarDays } from 'lucide-react-native';
import { useAuthContext } from '@/lib/auth-context';
import { useModules } from '@/lib/use-modules';
import { useQuery } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';
import { AppState, Platform } from 'react-native';
import { api } from '@/lib/api';
import * as Notifications from 'expo-notifications';

const RELOAD_INTERVAL_MS = 5 * 60 * 1000; // refresh at most every 5 min on foreground

export default function AppLayout() {
  const { reloadUser } = useAuthContext();
  const { isOwner, canProducts, canStock, canTurns, canSales } = useModules();
  const lastReloadRef = useRef<number>(Date.now());
  const pushRegistered = useRef(false);

  // Refresh staffModules when app comes to foreground (so staff sees updated modules)
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active' && Date.now() - lastReloadRef.current > RELOAD_INTERVAL_MS) {
        lastReloadRef.current = Date.now();
        void reloadUser();
      }
    });
    return () => sub.remove();
  }, [reloadUser]);

  // Register Expo push token once per session
  useEffect(() => {
    if (pushRegistered.current || Platform.OS === 'web') return;
    pushRegistered.current = true;

    async function registerPushToken() {
      try {
        const { status: existing } = await Notifications.getPermissionsAsync();
        let status = existing;
        if (existing !== 'granted') {
          const { status: requested } = await Notifications.requestPermissionsAsync();
          status = requested;
        }
        if (status !== 'granted') return;

        const token = await Notifications.getExpoPushTokenAsync({
          projectId: '5a1a6bda-2436-4d03-8e34-48d42b716b62',
        });
        if (token.data) {
          await api.post('/users/me/push-token', { token: token.data });
        }
      } catch {
        // Non-critical — silently ignore push token errors
      }
    }

    void registerPushToken();
  }, []);

  const hideProducts = !canProducts;
  const hideStock = !canStock;
  const hideTurns = !canTurns;

  const { data: unreadData } = useQuery({
    queryKey: ['notifications-unread'],
    queryFn: () => api.get<{ count: number }>('/notifications/unread-count'),
    refetchInterval: 60_000,
  });

  const { data: invitations = [] } = useQuery({
    queryKey: ['invitations-mine'],
    queryFn: () => api.get<{ id: string }[]>('/invitations/mine'),
    refetchInterval: 60_000,
  });

  const unreadCount = (unreadData?.count ?? 0) + invitations.length;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: '#208AEF',
        tabBarInactiveTintColor: '#9CA3AF',
        tabBarStyle: { borderTopColor: '#F3F4F6' },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '500' },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Dashboard',
          tabBarIcon: ({ color, size }) => <LayoutDashboard size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="products"
        options={{
          title: 'Productos',
          href: hideProducts ? null : undefined,
          tabBarIcon: ({ color, size }) => <Package size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="stock/index"
        options={{
          title: 'Stock',
          href: hideStock ? null : undefined,
          tabBarIcon: ({ color, size }) => <BarChart2 size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="sales"
        options={{
          title: 'Ventas',
          href: canSales ? undefined : null,
          tabBarIcon: ({ color, size }) => <ShoppingCart size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="turns"
        options={{
          title: 'Turnos',
          href: hideTurns ? null : undefined,
          tabBarIcon: ({ color, size }) => <CalendarDays size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="notifications"
        options={{
          title: 'Alertas',
          tabBarBadge: unreadCount > 0 ? unreadCount : undefined,
          tabBarBadgeStyle: { fontSize: 10, minWidth: 16, height: 16 },
          tabBarIcon: ({ color, size }) => <Bell size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="team"
        options={{
          title: 'Equipo',
          href: isOwner ? undefined : null,
          tabBarIcon: ({ color, size }) => <Users size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Perfil',
          tabBarIcon: ({ color, size }) => <User size={size} color={color} />,
        }}
      />

      {/* Pantallas sin tab */}
      <Tabs.Screen name="categories/index" options={{ href: null }} />
      <Tabs.Screen name="stock/history" options={{ href: null }} />
      <Tabs.Screen name="turns/history" options={{ href: null }} />
    </Tabs>
  );
}
