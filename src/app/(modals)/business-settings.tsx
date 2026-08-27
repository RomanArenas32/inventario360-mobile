import {
  View, Text, ScrollView, Switch, TouchableOpacity, TextInput,
  ActivityIndicator, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { X } from 'lucide-react-native';
import { api } from '@/lib/api';
import { useAuthContext } from '@/lib/auth-context';
import type { Module } from '@/lib/types';

// ─── Constants ────────────────────────────────────────────────────────────────

const BUSINESS_TYPE_LABELS: Record<string, string> = {
  almacen:            'Almacén',
  kiosco:             'Kiosco',
  ferreteria:         'Ferretería',
  barberia:           'Barbería',
  restaurante:        'Restaurante',
  tienda_ropa:        'Tienda de ropa',
  tienda_electronica: 'Tienda electrónica',
};

type ModuleDef = {
  id: Module;
  label: string;
  description: string;
};

const MODULES: ModuleDef[] = [
  { id: 'products',  label: 'Productos',  description: 'Catálogo, precios y categorías' },
  { id: 'stock',     label: 'Stock',      description: 'Inventario y movimientos' },
  { id: 'sales',     label: 'Ventas',     description: 'Registro de ventas y facturación' },
  { id: 'turns',     label: 'Turnos',     description: 'Agenda y gestión de reservas' },
  { id: 'services',  label: 'Servicios',  description: 'Catálogo de servicios con precios' },
];

// ─── Types ────────────────────────────────────────────────────────────────────

type TenantSettings = {
  name: string;
  businessType: string | null;
  staffModules: Module[] | null;
};

type NotificationSettings = {
  alertLowStock: boolean;
  alertNewSale: boolean;
  alertTurnAssigned: boolean;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

const ALL_MODULES: Module[] = MODULES.map((m) => m.id);

function toggleModule(current: Module[] | null, mod: Module): Module[] {
  const list = current ?? ALL_MODULES;
  if (list.includes(mod)) return list.filter((m) => m !== mod);
  return [...list, mod];
}

// ─── Section header ───────────────────────────────────────────────────────────

function SectionHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <View className="px-4 mt-6 mb-2">
      <Text className="text-xs font-semibold text-gray-400 uppercase tracking-wider">{title}</Text>
      {subtitle ? (
        <Text className="text-xs text-gray-400 mt-1 leading-4">{subtitle}</Text>
      ) : null}
    </View>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function BusinessSettingsScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { reloadUser } = useAuthContext();

  const { data: settings, isLoading: loadingSettings } = useQuery({
    queryKey: ['tenant-settings'],
    queryFn: () => api.get<TenantSettings>('/tenants/settings'),
  });

  const { data: notifSettings, isLoading: loadingNotif } = useQuery({
    queryKey: ['notification-settings'],
    queryFn: async () => {
      const data = await api.get<NotificationSettings | null>('/notification-settings');
      return data ?? { alertLowStock: true, alertNewSale: true, alertTurnAssigned: true };
    },
  });

  const isLoading = loadingSettings || loadingNotif;

  // ── Tenant settings local state ────────────────────────────────────────────

  const [name, setName] = useState<string | undefined>(undefined);
  const [staffModules, setStaffModules] = useState<Module[] | null | undefined>(undefined);

  // ── Notification settings local state ─────────────────────────────────────

  const [alertNewSale, setAlertNewSale] = useState<boolean | undefined>(undefined);
  const [alertTurnAssigned, setAlertTurnAssigned] = useState<boolean | undefined>(undefined);
  const [alertLowStock, setAlertLowStock] = useState<boolean | undefined>(undefined);

  const [saving, setSaving] = useState(false);

  // Effective values
  const effectiveName = name !== undefined ? name : (settings?.name ?? '');
  const effectiveModules = staffModules !== undefined ? staffModules : (settings?.staffModules ?? null);
  const effectiveAlertNewSale = alertNewSale !== undefined ? alertNewSale : (notifSettings?.alertNewSale ?? true);
  const effectiveAlertTurnAssigned = alertTurnAssigned !== undefined ? alertTurnAssigned : (notifSettings?.alertTurnAssigned ?? true);
  const effectiveAlertLowStock = alertLowStock !== undefined ? alertLowStock : (notifSettings?.alertLowStock ?? true);

  const hasChanges =
    name !== undefined ||
    staffModules !== undefined ||
    alertNewSale !== undefined ||
    alertTurnAssigned !== undefined ||
    alertLowStock !== undefined;

  const businessTypeLabel = settings?.businessType
    ? (BUSINESS_TYPE_LABELS[settings.businessType] ?? null)
    : null;

  function isModuleOn(mod: Module): boolean {
    if (effectiveModules === null) return true;
    return effectiveModules.includes(mod);
  }

  async function handleSave() {
    if (name !== undefined && !effectiveName.trim()) {
      Alert.alert('Error', 'El nombre del negocio no puede estar vacío');
      return;
    }
    setSaving(true);
    try {
      const tasks: Promise<unknown>[] = [];

      if (name !== undefined && effectiveName.trim() !== settings?.name) {
        tasks.push(api.patch('/tenants/settings', { name: effectiveName.trim() }));
      }
      if (staffModules !== undefined) {
        tasks.push(api.patch('/tenants/staff-modules', { modules: effectiveModules }));
      }
      if (alertNewSale !== undefined || alertTurnAssigned !== undefined || alertLowStock !== undefined) {
        const notifPatch: Partial<NotificationSettings> = {};
        if (alertNewSale !== undefined) notifPatch.alertNewSale = alertNewSale;
        if (alertTurnAssigned !== undefined) notifPatch.alertTurnAssigned = alertTurnAssigned;
        if (alertLowStock !== undefined) notifPatch.alertLowStock = alertLowStock;
        tasks.push(api.put('/notification-settings', notifPatch));
      }

      await Promise.all(tasks);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['tenant-settings'] }),
        queryClient.invalidateQueries({ queryKey: ['notification-settings'] }),
        reloadUser(),
      ]);
      router.back();
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'No se pudo guardar la configuración');
    } finally {
      setSaving(false);
    }
  }

  if (isLoading) {
    return (
      <SafeAreaView className="flex-1 bg-white items-center justify-center" edges={['bottom']}>
        <ActivityIndicator size="large" color="#208AEF" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-gray-50" edges={['bottom']}>
      {/* Header */}
      <View className="flex-row items-center justify-between px-4 py-4 border-b border-gray-100 bg-white">
        <TouchableOpacity
          onPress={() => router.back()}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <X size={22} color="#6B7280" />
        </TouchableOpacity>
        <Text className="text-base font-semibold text-gray-900">Configuración del negocio</Text>
        <TouchableOpacity
          onPress={() => void handleSave()}
          disabled={saving || !hasChanges}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          {saving ? (
            <ActivityIndicator size="small" color="#208AEF" />
          ) : (
            <Text className={`text-base font-semibold ${hasChanges ? 'text-blue-500' : 'text-gray-300'}`}>
              Guardar
            </Text>
          )}
        </TouchableOpacity>
      </View>

      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>

        {/* Nombre del negocio */}
        <SectionHeader title="Mi negocio" />
        <View className="bg-white border-t border-b border-gray-100 px-4 py-3.5">
          <View className="flex-row items-center justify-between mb-1.5">
            <Text className="text-xs text-gray-400">Nombre del negocio</Text>
            {businessTypeLabel ? (
              <View className="bg-gray-100 px-2 py-0.5 rounded-full">
                <Text className="text-xs text-gray-500 font-medium">{businessTypeLabel}</Text>
              </View>
            ) : null}
          </View>
          <TextInput
            className="text-sm font-medium text-gray-900"
            value={effectiveName}
            onChangeText={(v) => setName(v)}
            placeholder="Nombre de tu negocio"
            placeholderTextColor="#9CA3AF"
            autoCapitalize="words"
            returnKeyType="done"
          />
        </View>

        {/* Notificaciones */}
        <SectionHeader
          title="Notificaciones"
          subtitle="El equipo recibe una alerta en la app y un push cuando ocurre cada evento."
        />
        <View className="bg-white border-t border-b border-gray-100">
          <NotifRow
            label="Nueva venta registrada"
            description="Notifica a todos excepto quien realizó la venta"
            value={effectiveAlertNewSale}
            onChange={setAlertNewSale}
            last={false}
          />
          <NotifRow
            label="Turno asignado"
            description="Notifica al empleado asignado cuando otro le agrega un turno"
            value={effectiveAlertTurnAssigned}
            onChange={setAlertTurnAssigned}
            last={false}
          />
          <NotifRow
            label="Stock bajo"
            description="Notifica a todos cuando un producto baja del mínimo configurado"
            value={effectiveAlertLowStock}
            onChange={setAlertLowStock}
            last={true}
          />
        </View>

        {/* Módulos del staff */}
        <SectionHeader
          title="Módulos para el staff"
          subtitle="Controlá a qué secciones tienen acceso los empleados. Los dueños siempre tienen acceso total."
        />
        <View className="bg-white border-t border-b border-gray-100">
          {MODULES.map((mod, i) => {
            const enabled = isModuleOn(mod.id);
            return (
              <View
                key={mod.id}
                className={`flex-row items-center px-4 py-3.5 ${
                  i < MODULES.length - 1 ? 'border-b border-gray-100' : ''
                }`}
              >
                <View className="flex-1 mr-3">
                  <Text className="text-sm font-medium text-gray-900">{mod.label}</Text>
                  <Text className="text-xs text-gray-400 mt-0.5">{mod.description}</Text>
                </View>
                <Switch
                  value={enabled}
                  onValueChange={() => setStaffModules(toggleModule(effectiveModules, mod.id))}
                  trackColor={{ false: '#E5E7EB', true: '#93C5FD' }}
                  thumbColor={enabled ? '#208AEF' : '#F9FAFB'}
                  ios_backgroundColor="#E5E7EB"
                />
              </View>
            );
          })}
        </View>

        <View className="h-8" />
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Notification row ─────────────────────────────────────────────────────────

function NotifRow({
  label,
  description,
  value,
  onChange,
  last,
}: {
  label: string;
  description: string;
  value: boolean;
  onChange: (v: boolean) => void;
  last: boolean;
}) {
  return (
    <View className={`flex-row items-center px-4 py-3.5 ${last ? '' : 'border-b border-gray-100'}`}>
      <View className="flex-1 mr-3">
        <Text className="text-sm font-medium text-gray-900">{label}</Text>
        <Text className="text-xs text-gray-400 mt-0.5">{description}</Text>
      </View>
      <Switch
        value={value}
        onValueChange={onChange}
        trackColor={{ false: '#E5E7EB', true: '#93C5FD' }}
        thumbColor={value ? '#208AEF' : '#F9FAFB'}
        ios_backgroundColor="#E5E7EB"
      />
    </View>
  );
}
