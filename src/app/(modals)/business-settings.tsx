import {
  View, Text, ScrollView, Switch, TouchableOpacity,
  ActivityIndicator, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { X, Check } from 'lucide-react-native';
import { api } from '@/lib/api';
import { useAuthContext } from '@/lib/auth-context';
import type { Module } from '@/lib/types';

// ─── Constants ────────────────────────────────────────────────────────────────

const BUSINESS_TYPES = [
  { value: 'almacen',             label: 'Almacén' },
  { value: 'kiosco',              label: 'Kiosco' },
  { value: 'ferreteria',          label: 'Ferretería' },
  { value: 'barberia',            label: 'Barbería' },
  { value: 'restaurante',         label: 'Restaurante' },
  { value: 'tienda_ropa',         label: 'Tienda de ropa' },
  { value: 'tienda_electronica',  label: 'Tienda electrónica' },
];

type ModuleDef = {
  id: Module;
  label: string;
  description: string;
  available: boolean;
};

const MODULES: ModuleDef[] = [
  { id: 'products',   label: 'Productos', description: 'Catálogo, precios y categorías',   available: true },
  { id: 'stock',      label: 'Stock',     description: 'Inventario y movimientos',          available: true },
  { id: 'sales',      label: 'Ventas',    description: 'Registro de ventas y facturación',  available: true },
  { id: 'turns',      label: 'Turnos',    description: 'Agenda y gestión de reservas',      available: true },
];

// ─── Types ────────────────────────────────────────────────────────────────────

// Backend: GET /tenants/settings
type TenantSettings = {
  name: string;
  businessType: string | null;
  staffModules: Module[] | null; // null = todos los módulos habilitados
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

const ALL_AVAILABLE: Module[] = MODULES.filter((m) => m.available).map((m) => m.id);

function toggleModule(current: Module[] | null, mod: Module): Module[] {
  // null = todos habilitados
  const list = current ?? ALL_AVAILABLE;
  if (list.includes(mod)) {
    return list.filter((m) => m !== mod);
  }
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

  const { data: settings, isLoading } = useQuery({
    queryKey: ['tenant-settings'],
    // Backend: GET /tenants/settings → { name, businessType, staffModules }
    queryFn: () => api.get<TenantSettings>('/tenants/settings'),
  });

  // Local overrides — null means "no change yet"
  const [businessType, setBusinessType] = useState<string | null | undefined>(undefined);
  const [staffModules, setStaffModules] = useState<Module[] | null | undefined>(undefined);
  const [saving, setSaving] = useState(false);

  // Effective values: local override → loaded settings
  const effectiveBizType = businessType !== undefined ? businessType : (settings?.businessType ?? null);
  const effectiveModules = staffModules !== undefined ? staffModules : (settings?.staffModules ?? null);

  const hasChanges = businessType !== undefined || staffModules !== undefined;

  function isModuleOn(mod: Module): boolean {
    if (effectiveModules === null) return true;
    return effectiveModules.includes(mod);
  }

  async function handleSave() {
    setSaving(true);
    try {
      const tasks: Promise<unknown>[] = [];

      if (businessType !== undefined && businessType !== settings?.businessType) {
        // Backend: PATCH /tenants/settings { businessType }
        tasks.push(api.patch('/tenants/settings', { businessType: effectiveBizType }));
      }
      if (staffModules !== undefined) {
        // Backend: PATCH /tenants/staff-modules { modules: Module[] | null }
        tasks.push(api.patch('/tenants/staff-modules', { modules: effectiveModules }));
      }

      await Promise.all(tasks);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['tenant-settings'] }),
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

        {/* Negocio info (solo lectura) */}
        {settings?.name ? (
          <>
            <SectionHeader title="Mi negocio" />
            <View className="bg-white border-t border-b border-gray-100 px-4 py-3.5">
              <Text className="text-xs text-gray-400 mb-0.5">Nombre</Text>
              <Text className="text-sm font-medium text-gray-900">{settings.name}</Text>
            </View>
          </>
        ) : null}

        {/* Tipo de negocio */}
        <SectionHeader
          title="Tipo de negocio"
          subtitle="Afecta sugerencias y configuración por defecto de la app."
        />
        <View className="bg-white border-t border-b border-gray-100">
          {BUSINESS_TYPES.map((bt, i) => {
            const selected = effectiveBizType === bt.value;
            return (
              <TouchableOpacity
                key={bt.value}
                onPress={() => setBusinessType(bt.value)}
                className={`flex-row items-center justify-between px-4 py-3.5 ${
                  i < BUSINESS_TYPES.length - 1 ? 'border-b border-gray-100' : ''
                }`}
                activeOpacity={0.6}
              >
                <Text className={`text-sm ${selected ? 'text-blue-500 font-semibold' : 'text-gray-900'}`}>
                  {bt.label}
                </Text>
                {selected ? <Check size={16} color="#208AEF" /> : null}
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Módulos del staff */}
        <SectionHeader
          title="Módulos activos"
          subtitle="Activá solo los módulos que usás. Los desactivados desaparecen del menú para todos."
        />
        <View className="bg-white border-t border-b border-gray-100">
          {MODULES.map((mod, i) => {
            const enabled = mod.available ? isModuleOn(mod.id) : false;
            return (
              <View
                key={mod.id}
                className={`flex-row items-center px-4 py-3.5 ${
                  i < MODULES.length - 1 ? 'border-b border-gray-100' : ''
                } ${!mod.available ? 'opacity-40' : ''}`}
              >
                <View className="flex-1 mr-3">
                  <View className="flex-row items-center gap-2">
                    <Text className="text-sm font-medium text-gray-900">{mod.label}</Text>
                    {!mod.available && (
                      <View className="bg-gray-100 px-2 py-0.5 rounded-full">
                        <Text className="text-xs text-gray-400">Próximamente</Text>
                      </View>
                    )}
                  </View>
                  <Text className="text-xs text-gray-400 mt-0.5">{mod.description}</Text>
                </View>
                <Switch
                  value={enabled}
                  onValueChange={() => {
                    if (!mod.available) return;
                    setStaffModules(toggleModule(effectiveModules, mod.id));
                  }}
                  disabled={!mod.available}
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
