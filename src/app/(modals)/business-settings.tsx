import {
  View, Text, ScrollView, Switch, TouchableOpacity, TextInput,
  ActivityIndicator, Alert, KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, Stack } from 'expo-router';
import { useState, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { X, Puzzle, CheckCircle2 } from 'lucide-react-native';
import { api } from '@/lib/api';
import { useAuthContext } from '@/lib/auth-context';
import type { Module } from '@/lib/types';

// ─── Types ────────────────────────────────────────────────────────────────────

type Tab = 'negocio' | 'modulos' | 'notificaciones' | 'whatsapp' | 'integraciones';

type TenantSettings = {
  name: string;
  businessType: string | null;
  staffModules: Module[] | null;
};

type NotifSettings = {
  alertLowStock: boolean;
  alertNewSale: boolean;
  alertTurnAssigned: boolean;
  whatsappPhone: string | null;
  whatsappOptIn: boolean;
};

// ─── Constants ────────────────────────────────────────────────────────────────

const TABS: { id: Tab; label: string }[] = [
  { id: 'negocio',        label: 'Mi negocio' },
  { id: 'modulos',        label: 'Módulos del staff' },
  { id: 'notificaciones', label: 'Notificaciones' },
  { id: 'whatsapp',       label: 'WhatsApp' },
  { id: 'integraciones',  label: 'Integraciones' },
];

const BUSINESS_TYPE_LABELS: Record<string, string> = {
  almacen:            'Almacén',
  kiosco:             'Kiosco',
  ferreteria:         'Ferretería',
  barberia:           'Barbería',
  restaurante:        'Restaurante',
  tienda_ropa:        'Tienda de ropa',
  tienda_electronica: 'Tienda electrónica',
};

type ModuleDef = { id: Module; label: string; description: string };
const MODULES: ModuleDef[] = [
  { id: 'products', label: 'Productos',  description: 'Catálogo, precios y categorías' },
  { id: 'stock',    label: 'Stock',      description: 'Inventario y movimientos' },
  { id: 'sales',    label: 'Ventas',     description: 'Registro de ventas y facturación' },
  { id: 'turns',    label: 'Turnos',     description: 'Agenda y gestión de reservas' },
  { id: 'services', label: 'Servicios',  description: 'Catálogo de servicios con precios' },
];
const ALL_MODULES: Module[] = MODULES.map((m) => m.id);

const OTHER_INTEGRATIONS = [
  { id: 'mercadopago', name: 'MercadoPago', description: 'Procesá pagos y sincronizá ventas automáticamente.' },
  { id: 'tiendanube',  name: 'Tiendanube',  description: 'Sincronizá el stock con tu tienda online.' },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function toggleModule(current: Module[] | null, mod: Module): Module[] {
  const list = current ?? ALL_MODULES;
  if (list.includes(mod)) return list.filter((m) => m !== mod);
  return [...list, mod];
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function SectionHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <View className="px-4 pt-5 pb-3">
      <Text className="text-base font-semibold text-gray-900">{title}</Text>
      {subtitle ? (
        <Text className="text-xs text-gray-400 mt-1 leading-4">{subtitle}</Text>
      ) : null}
    </View>
  );
}

function RowSwitch({
  label,
  description,
  value,
  onChange,
  last = false,
}: {
  label: string;
  description?: string;
  value: boolean;
  onChange: (v: boolean) => void;
  last?: boolean;
}) {
  return (
    <View className={`flex-row items-center px-4 py-3.5 ${last ? '' : 'border-b border-gray-100'}`}>
      <View className="flex-1 mr-3">
        <Text className="text-sm font-medium text-gray-900">{label}</Text>
        {description ? (
          <Text className="text-xs text-gray-400 mt-0.5">{description}</Text>
        ) : null}
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

function SaveButton({
  label,
  onPress,
  saving,
  disabled,
}: {
  label: string;
  onPress: () => void;
  saving: boolean;
  disabled?: boolean;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={saving || disabled}
      activeOpacity={0.85}
      className={`mx-4 mt-4 py-3 rounded-2xl items-center ${
        saving || disabled ? 'bg-blue-200' : 'bg-blue-500'
      }`}
    >
      {saving ? (
        <ActivityIndicator size="small" color="white" />
      ) : (
        <Text className="text-white font-semibold text-sm">{label}</Text>
      )}
    </TouchableOpacity>
  );
}

// ─── Tab content sections ─────────────────────────────────────────────────────

function NegocioTab({
  settings,
}: {
  settings: TenantSettings | undefined;
}) {
  const queryClient = useQueryClient();
  const [name, setName] = useState<string | undefined>(undefined);
  const [saving, setSaving] = useState(false);

  const effectiveName = name !== undefined ? name : (settings?.name ?? '');
  const dirty = name !== undefined && name.trim() !== settings?.name;
  const typeLabel = settings?.businessType
    ? (BUSINESS_TYPE_LABELS[settings.businessType] ?? null)
    : null;

  async function handleSave() {
    if (!effectiveName.trim()) {
      Alert.alert('Error', 'El nombre del negocio no puede estar vacío');
      return;
    }
    setSaving(true);
    try {
      await api.patch('/tenants/settings', { name: effectiveName.trim() });
      void queryClient.invalidateQueries({ queryKey: ['tenant-settings'] });
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'No se pudo guardar');
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <SectionHeader
        title="Mi negocio"
        subtitle="Información básica visible para todo el equipo."
      />
      <View className="bg-white border-t border-b border-gray-100 px-4 py-3.5">
        <Text className="text-xs text-gray-400 mb-1.5">Nombre del negocio</Text>
        <TextInput
          className="text-sm font-medium text-gray-900"
          value={effectiveName}
          onChangeText={(v) => setName(v)}
          placeholder="Nombre de tu negocio"
          placeholderTextColor="#9CA3AF"
          autoCapitalize="words"
          returnKeyType="done"
        />
        {typeLabel ? (
          <View className="flex-row items-center gap-2 mt-3 pt-3 border-t border-gray-100">
            <Text className="text-xs text-gray-400">Tipo de negocio</Text>
            <View className="bg-gray-100 px-2 py-0.5 rounded-full">
              <Text className="text-xs text-gray-500 font-medium">{typeLabel}</Text>
            </View>
            <Text className="text-xs text-gray-300">· Configurado al iniciar</Text>
          </View>
        ) : null}
      </View>
      <SaveButton
        label="Guardar cambios"
        onPress={() => void handleSave()}
        saving={saving}
        disabled={!dirty}
      />
    </>
  );
}

function ModulosTab({
  settings,
}: {
  settings: TenantSettings | undefined;
}) {
  const queryClient = useQueryClient();
  const { reloadUser } = useAuthContext();
  const [staffModules, setStaffModules] = useState<Module[] | null | undefined>(undefined);
  const [saving, setSaving] = useState(false);

  const effective = staffModules !== undefined ? staffModules : (settings?.staffModules ?? null);
  const dirty = staffModules !== undefined;

  function isOn(mod: Module) {
    return effective === null || effective.includes(mod);
  }

  async function handleSave() {
    setSaving(true);
    try {
      await api.patch('/tenants/staff-modules', { modules: effective });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['tenant-settings'] }),
        reloadUser(),
      ]);
      setStaffModules(undefined);
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'No se pudo guardar');
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <SectionHeader
        title="Módulos del staff"
        subtitle="Controlá a qué secciones tienen acceso los empleados. Los dueños siempre tienen acceso total."
      />
      <View className="bg-white border-t border-b border-gray-100">
        {MODULES.map((mod, i) => (
          <RowSwitch
            key={mod.id}
            label={mod.label}
            description={mod.description}
            value={isOn(mod.id)}
            onChange={() => setStaffModules(toggleModule(effective, mod.id))}
            last={i === MODULES.length - 1}
          />
        ))}
      </View>
      <SaveButton
        label="Guardar módulos"
        onPress={() => void handleSave()}
        saving={saving}
        disabled={!dirty}
      />
    </>
  );
}

function NotificacionesTab({
  notifSettings,
}: {
  notifSettings: NotifSettings | undefined;
}) {
  const queryClient = useQueryClient();
  const [local, setLocal] = useState<Partial<Pick<NotifSettings, 'alertLowStock' | 'alertNewSale' | 'alertTurnAssigned'>>>({});
  const [saving, setSaving] = useState(false);

  const dirty = Object.keys(local).length > 0;

  function val(key: 'alertLowStock' | 'alertNewSale' | 'alertTurnAssigned'): boolean {
    return local[key] !== undefined ? (local[key] as boolean) : (notifSettings?.[key] ?? true);
  }

  function set(key: 'alertLowStock' | 'alertNewSale' | 'alertTurnAssigned', v: boolean) {
    setLocal((prev) => ({ ...prev, [key]: v }));
  }

  async function handleSave() {
    setSaving(true);
    try {
      await api.put('/notification-settings', local);
      void queryClient.invalidateQueries({ queryKey: ['notification-settings'] });
      setLocal({});
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'No se pudo guardar');
    } finally {
      setSaving(false);
    }
  }

  const ROWS: { key: 'alertNewSale' | 'alertTurnAssigned' | 'alertLowStock'; label: string; desc: string }[] = [
    { key: 'alertNewSale',      label: 'Nueva venta registrada',  desc: 'Notifica a todos excepto quien realizó la venta' },
    { key: 'alertTurnAssigned', label: 'Turno asignado',          desc: 'Notifica al empleado asignado cuando otro le agrega un turno' },
    { key: 'alertLowStock',     label: 'Stock bajo',              desc: 'Notifica cuando un producto baja del mínimo configurado' },
  ];

  return (
    <>
      <SectionHeader
        title="Notificaciones push"
        subtitle="El equipo recibe una alerta en la app cuando ocurre cada evento."
      />
      <View className="bg-white border-t border-b border-gray-100">
        {ROWS.map((row, i) => (
          <RowSwitch
            key={row.key}
            label={row.label}
            description={row.desc}
            value={val(row.key)}
            onChange={(v) => set(row.key, v)}
            last={i === ROWS.length - 1}
          />
        ))}
      </View>
      <SaveButton
        label="Guardar notificaciones"
        onPress={() => void handleSave()}
        saving={saving}
        disabled={!dirty}
      />
    </>
  );
}

function WhatsAppTab({
  notifSettings,
}: {
  notifSettings: NotifSettings | undefined;
}) {
  const queryClient = useQueryClient();
  const [phone, setPhone] = useState<string | undefined>(undefined);
  const [optIn, setOptIn] = useState<boolean | undefined>(undefined);
  const [alertLowStock, setAlertLowStock] = useState<boolean | undefined>(undefined);
  const [saving, setSaving] = useState(false);

  const effectivePhone = phone !== undefined ? phone : (notifSettings?.whatsappPhone ?? '');
  const effectiveOptIn = optIn !== undefined ? optIn : (notifSettings?.whatsappOptIn ?? false);
  const effectiveAlertLowStock = alertLowStock !== undefined ? alertLowStock : (notifSettings?.alertLowStock ?? true);

  const dirty = phone !== undefined || optIn !== undefined || alertLowStock !== undefined;
  const isConnected = Boolean(notifSettings?.whatsappPhone && notifSettings?.whatsappOptIn);

  async function handleSave() {
    setSaving(true);
    try {
      await api.put('/notification-settings', {
        whatsappPhone: effectivePhone.trim() || null,
        whatsappOptIn: effectiveOptIn,
        alertLowStock: effectiveAlertLowStock,
      });
      void queryClient.invalidateQueries({ queryKey: ['notification-settings'] });
      setPhone(undefined);
      setOptIn(undefined);
      setAlertLowStock(undefined);
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'No se pudo guardar');
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <SectionHeader
        title="WhatsApp"
        subtitle="Recibí alertas importantes directo en tu WhatsApp. Requerimos tu consentimiento explícito según las políticas de Meta."
      />

      {/* Conexión */}
      <View className="bg-white border-t border-b border-gray-100 px-4 py-4">
        {isConnected ? (
          <View className="flex-row items-center gap-1.5 mb-4">
            <CheckCircle2 size={14} color="#16A34A" />
            <Text className="text-xs font-semibold text-green-700">Conectado</Text>
          </View>
        ) : null}

        {/* Phone input */}
        <Text className="text-xs text-gray-400 mb-1.5">Número de WhatsApp</Text>
        <View className="flex-row items-center gap-2 border border-gray-200 rounded-xl overflow-hidden">
          <View className="bg-gray-50 px-3 py-3 border-r border-gray-200">
            <Text className="text-sm font-medium text-gray-700">+54</Text>
          </View>
          <TextInput
            className="flex-1 px-3 py-3 text-sm text-gray-900"
            value={effectivePhone.replace(/^\+54/, '')}
            onChangeText={(v) => setPhone(v ? `+54${v}` : '')}
            placeholder="11 2345-6789"
            placeholderTextColor="#9CA3AF"
            keyboardType="phone-pad"
            returnKeyType="done"
          />
        </View>

        {/* Opt-in */}
        <TouchableOpacity
          className="flex-row items-start gap-3 mt-4"
          onPress={() => setOptIn(!effectiveOptIn)}
          activeOpacity={0.7}
        >
          <View
            className={`w-5 h-5 rounded border-2 items-center justify-center mt-0.5 ${
              effectiveOptIn ? 'bg-blue-500 border-blue-500' : 'border-gray-300 bg-white'
            }`}
          >
            {effectiveOptIn ? (
              <Text className="text-white text-xs font-bold">✓</Text>
            ) : null}
          </View>
          <View className="flex-1">
            <Text className="text-sm font-medium text-gray-900">Acepto recibir alertas por WhatsApp</Text>
            <Text className="text-xs text-gray-400 mt-0.5">
              Requerido por Meta. Solo recibirás notificaciones de Inventario360.
            </Text>
          </View>
        </TouchableOpacity>
      </View>

      {/* Alertas vía WA — solo si optIn */}
      {effectiveOptIn && (
        <>
          <View className="px-4 pt-4 pb-2">
            <Text className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Alertas vía WhatsApp</Text>
          </View>
          <View className="bg-white border-t border-b border-gray-100">
            <RowSwitch
              label="Stock bajo"
              description="Cuando un producto cae al mínimo configurado"
              value={effectiveAlertLowStock}
              onChange={setAlertLowStock}
              last
            />
          </View>
        </>
      )}

      <SaveButton
        label="Guardar"
        onPress={() => void handleSave()}
        saving={saving}
        disabled={!dirty}
      />
    </>
  );
}

function IntegracionesTab() {
  return (
    <>
      <SectionHeader
        title="Integraciones"
        subtitle="Conectá Inventario360 con otras plataformas. Más integraciones en camino."
      />
      <View className="bg-white border-t border-b border-gray-100">
        {OTHER_INTEGRATIONS.map((int, i) => (
          <View
            key={int.id}
            className={`flex-row items-center px-4 py-4 opacity-50 ${
              i < OTHER_INTEGRATIONS.length - 1 ? 'border-b border-gray-100' : ''
            }`}
          >
            <View className="w-9 h-9 rounded-xl bg-gray-100 items-center justify-center mr-3">
              <Puzzle size={16} color="#9CA3AF" />
            </View>
            <View className="flex-1">
              <Text className="text-sm font-medium text-gray-900">{int.name}</Text>
              <Text className="text-xs text-gray-400 mt-0.5">{int.description}</Text>
            </View>
            <View className="bg-gray-100 px-2.5 py-1 rounded-full">
              <Text className="text-xs text-gray-500 font-medium">Próximamente</Text>
            </View>
          </View>
        ))}
      </View>
    </>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function BusinessSettingsScreen() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<Tab>('negocio');
  const tabScrollRef = useRef<ScrollView>(null);

  const { data: settings, isLoading: loadingSettings } = useQuery({
    queryKey: ['tenant-settings'],
    queryFn: () => api.get<TenantSettings>('/tenants/settings'),
  });

  const { data: notifSettings, isLoading: loadingNotif } = useQuery({
    queryKey: ['notification-settings'],
    queryFn: async () => {
      const data = await api.get<NotifSettings | null>('/notification-settings');
      return data ?? { alertLowStock: true, alertNewSale: true, alertTurnAssigned: true, whatsappPhone: null, whatsappOptIn: false };
    },
  });

  const isLoading = loadingSettings || loadingNotif;

  if (isLoading) {
    return (
      <SafeAreaView className="flex-1 bg-white items-center justify-center" edges={['top', 'bottom']}>
        <ActivityIndicator size="large" color="#208AEF" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-gray-50" edges={['top', 'bottom']}>
      <Stack.Screen options={{ headerShown: false }} />
      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* Header */}
        <View className="flex-row items-center justify-between px-4 py-4 border-b border-gray-100 bg-white">
          <TouchableOpacity
            onPress={() => router.back()}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <X size={22} color="#6B7280" />
          </TouchableOpacity>
          <Text className="text-base font-semibold text-gray-900">Configuración</Text>
          <View style={{ width: 22 }} />
        </View>

        {/* Tab bar */}
        <View className="bg-white border-b border-gray-100">
          <ScrollView
            ref={tabScrollRef}
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: 12 }}
          >
            {TABS.map((tab) => {
              const isActive = activeTab === tab.id;
              return (
                <TouchableOpacity
                  key={tab.id}
                  onPress={() => setActiveTab(tab.id)}
                  activeOpacity={0.7}
                  className="px-3 py-3"
                >
                  <Text
                    className={`text-sm font-medium ${isActive ? 'text-blue-500' : 'text-gray-400'}`}
                  >
                    {tab.label}
                  </Text>
                  {isActive && (
                    <View className="absolute bottom-0 left-3 right-3 h-0.5 bg-blue-500 rounded-full" />
                  )}
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        {/* Content */}
        <ScrollView
          className="flex-1"
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ paddingBottom: 32 }}
        >
          {activeTab === 'negocio' && <NegocioTab settings={settings} />}
          {activeTab === 'modulos' && <ModulosTab settings={settings} />}
          {activeTab === 'notificaciones' && <NotificacionesTab notifSettings={notifSettings} />}
          {activeTab === 'whatsapp' && <WhatsAppTab notifSettings={notifSettings} />}
          {activeTab === 'integraciones' && <IntegracionesTab />}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
