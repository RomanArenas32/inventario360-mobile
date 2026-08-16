import { Tabs } from 'expo-router';
import { LayoutDashboard, Package, BarChart2, Users, User, Bell, ShoppingCart, CalendarDays } from 'lucide-react-native';
import { useAuthContext } from '@/lib/auth-context';
import { useModules } from '@/lib/use-modules';
import { useQuery } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import { api } from '@/lib/api';

const RELOAD_INTERVAL_MS = 5 * 60 * 1000; // refresh at most every 5 min on foreground

export default function AppLayout() {
  const { reloadUser } = useAuthContext();
  const { isOwner, canProducts, canStock, canTurns, canSales } = useModules();
  const lastReloadRef = useRef<number>(Date.now());

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

  const hideProducts = !canProducts;
  const hideStock = !canStock;
  const hideTurns = !canTurns;

  const { data: unreadData } = useQuery({
    queryKey: ['notifications-unread'],
    queryFn: () => api.get<{ count: number }>('/notifications/unread-count'),
    refetchInterval: 60_000, // poll every minute
  });
  const unreadCount = unreadData?.count ?? 0;

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
    </Tabs>
  );
}
