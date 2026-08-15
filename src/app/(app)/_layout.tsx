import { Tabs } from 'expo-router';
import { LayoutDashboard, Package, BarChart2, Users, User, Bell } from 'lucide-react-native';
import { useAuthContext } from '@/lib/auth-context';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { Module } from '@/lib/types';

function canSeeModule(module: Module, staffModules: Module[] | null): boolean {
  if (staffModules === null) return true;
  return staffModules.includes(module);
}

export default function AppLayout() {
  const { user, tenantRole } = useAuthContext();
  const staffModules = user?.staffModules ?? null;
  const isOwner = tenantRole === 'owner';

  const hideProducts = !canSeeModule('products', staffModules) && !canSeeModule('categories', staffModules);
  const hideStock = !canSeeModule('stock', staffModules);

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
        name="products/index"
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
      <Tabs.Screen name="products/[id]" options={{ href: null }} />
      <Tabs.Screen name="stock/history" options={{ href: null }} />
    </Tabs>
  );
}
