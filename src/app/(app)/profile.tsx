import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
  Modal,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuthContext } from '@/lib/auth-context';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
  User,
  Mail,
  Briefcase,
  LogOut,
  ChevronRight,
  Building2,
  Check,
  X,
  Lock,
  Settings,
} from 'lucide-react-native';
import { api } from '@/lib/api';
import type { TenantSummary } from '@/lib/types';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getInitials(name: string) {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return (parts[0] ?? '').slice(0, 2).toUpperCase();
  const first = (parts[0] ?? '')[0] ?? '';
  const last = (parts[parts.length - 1] ?? '')[0] ?? '';
  return (first + last).toUpperCase();
}

const inputCls =
  'bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-gray-900 text-base';

// ─── Info Row ─────────────────────────────────────────────────────────────────

function InfoRow({
  icon,
  label,
  value,
  onPress,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  onPress?: () => void;
}) {
  return (
    <TouchableOpacity
      className="flex-row items-center gap-3 py-3.5 border-b border-gray-100"
      onPress={onPress}
      disabled={!onPress}
      activeOpacity={onPress ? 0.6 : 1}
    >
      <View className="w-8 items-center">{icon}</View>
      <View className="flex-1">
        <Text className="text-xs text-gray-400 mb-0.5">{label}</Text>
        <Text className="text-sm font-medium text-gray-900">{value}</Text>
      </View>
      {onPress ? <ChevronRight size={16} color="#D1D5DB" /> : null}
    </TouchableOpacity>
  );
}

// ─── Edit name modal ──────────────────────────────────────────────────────────

function EditNameModal({
  visible,
  initialName,
  onClose,
  onSaved,
}: {
  visible: boolean;
  initialName: string;
  onClose: () => void;
  onSaved: (name: string) => void;
}) {
  const [name, setName] = useState(initialName);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function handleSave() {
    if (!name.trim()) { setError('El nombre no puede estar vacío'); return; }
    setSaving(true);
    setError('');
    try {
      await api.patch('/users/me', { name: name.trim() });
      onSaved(name.trim());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <SafeAreaView className="flex-1 bg-white">
        <View className="flex-row items-center justify-between px-4 py-4 border-b border-gray-100">
          <TouchableOpacity onPress={onClose}>
            <X size={22} color="#6B7280" />
          </TouchableOpacity>
          <Text className="text-base font-semibold text-gray-900">Editar nombre</Text>
          <TouchableOpacity onPress={() => void handleSave()} disabled={saving}>
            {saving ? (
              <ActivityIndicator size="small" color="#208AEF" />
            ) : (
              <Text className="text-blue-500 font-semibold text-base">Guardar</Text>
            )}
          </TouchableOpacity>
        </View>
        <View className="px-4 pt-6">
          <Text className="text-sm font-medium text-gray-700 mb-1.5">Nombre completo</Text>
          <TextInput
            className={inputCls}
            value={name}
            onChangeText={setName}
            autoFocus
            returnKeyType="done"
            onSubmitEditing={() => void handleSave()}
          />
          {error ? (
            <Text className="text-red-500 text-sm mt-2">{error}</Text>
          ) : null}
        </View>
      </SafeAreaView>
    </Modal>
  );
}

// ─── Change password modal ────────────────────────────────────────────────────

function ChangePasswordModal({
  visible,
  onClose,
}: {
  visible: boolean;
  onClose: () => void;
}) {
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  function reset() {
    setCurrent(''); setNext(''); setConfirm(''); setError('');
  }

  async function handleSave() {
    if (!current.trim()) { setError('Ingresá tu contraseña actual'); return; }
    if (next.length < 8) { setError('La nueva contraseña debe tener al menos 8 caracteres'); return; }
    if (next !== confirm) { setError('Las contraseñas no coinciden'); return; }
    setSaving(true);
    setError('');
    try {
      await api.patch('/users/me/password', { currentPassword: current, newPassword: next });
      Alert.alert('Contraseña actualizada', 'Tu contraseña fue cambiada correctamente.');
      reset();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo cambiar la contraseña');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <SafeAreaView className="flex-1 bg-white">
        <View className="flex-row items-center justify-between px-4 py-4 border-b border-gray-100">
          <TouchableOpacity onPress={() => { reset(); onClose(); }}>
            <X size={22} color="#6B7280" />
          </TouchableOpacity>
          <Text className="text-base font-semibold text-gray-900">Cambiar contraseña</Text>
          <TouchableOpacity onPress={() => void handleSave()} disabled={saving}>
            {saving ? (
              <ActivityIndicator size="small" color="#208AEF" />
            ) : (
              <Text className="text-blue-500 font-semibold text-base">Guardar</Text>
            )}
          </TouchableOpacity>
        </View>
        <ScrollView className="flex-1 px-4 pt-6" keyboardShouldPersistTaps="handled">
          <View className="mb-4">
            <Text className="text-sm font-medium text-gray-700 mb-1.5">Contraseña actual</Text>
            <TextInput
              className={inputCls}
              value={current}
              onChangeText={setCurrent}
              secureTextEntry
              autoFocus
              placeholder="••••••••"
              placeholderTextColor="#9CA3AF"
            />
          </View>
          <View className="mb-4">
            <Text className="text-sm font-medium text-gray-700 mb-1.5">Nueva contraseña</Text>
            <TextInput
              className={inputCls}
              value={next}
              onChangeText={setNext}
              secureTextEntry
              placeholder="Mínimo 8 caracteres"
              placeholderTextColor="#9CA3AF"
            />
          </View>
          <View className="mb-4">
            <Text className="text-sm font-medium text-gray-700 mb-1.5">Confirmar contraseña</Text>
            <TextInput
              className={inputCls}
              value={confirm}
              onChangeText={setConfirm}
              secureTextEntry
              placeholder="Repetí la nueva contraseña"
              placeholderTextColor="#9CA3AF"
            />
          </View>
          {error ? (
            <View className="bg-red-50 border border-red-200 rounded-xl px-4 py-3">
              <Text className="text-sm text-red-600">{error}</Text>
            </View>
          ) : null}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

// ─── Switch business modal ────────────────────────────────────────────────────

function SwitchTenantModal({
  visible,
  tenants,
  activeTenantId,
  onClose,
  onSwitch,
}: {
  visible: boolean;
  tenants: TenantSummary[];
  activeTenantId: string | null;
  onClose: () => void;
  onSwitch: (id: string) => Promise<void>;
}) {
  const [switching, setSwitching] = useState<string | null>(null);

  async function handleSwitch(id: string) {
    if (id === activeTenantId) { onClose(); return; }
    setSwitching(id);
    try {
      await onSwitch(id);
      onClose();
    } catch {
      Alert.alert('Error', 'No se pudo cambiar de negocio. Intentá de nuevo.');
    } finally {
      setSwitching(null);
    }
  }

  const roleLabel = (role: string) => role === 'owner' ? 'Dueño' : 'Empleado';

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <SafeAreaView className="flex-1 bg-white">
        <View className="flex-row items-center justify-between px-4 py-4 border-b border-gray-100">
          <TouchableOpacity onPress={onClose}>
            <X size={22} color="#6B7280" />
          </TouchableOpacity>
          <Text className="text-base font-semibold text-gray-900">Cambiar negocio</Text>
          <View style={{ width: 22 }} />
        </View>

        {tenants.map((t) => {
          const isActive = t.id === activeTenantId;
          const isSwitching = switching === t.id;
          return (
            <TouchableOpacity
              key={t.id}
              className={`flex-row items-center px-4 py-4 border-b border-gray-100 ${isActive ? 'bg-blue-50' : ''}`}
              onPress={() => void handleSwitch(t.id)}
              disabled={!!switching}
              activeOpacity={0.7}
            >
              <View className="w-10 h-10 rounded-full bg-blue-100 items-center justify-center mr-3">
                <Text className="text-sm font-bold text-blue-600">
                  {t.name.slice(0, 2).toUpperCase()}
                </Text>
              </View>
              <View className="flex-1">
                <Text className="text-sm font-semibold text-gray-900">{t.name}</Text>
                <Text className="text-xs text-gray-400 mt-0.5">{roleLabel(t.role)}</Text>
              </View>
              {isSwitching ? (
                <ActivityIndicator size="small" color="#208AEF" />
              ) : isActive ? (
                <Check size={18} color="#208AEF" />
              ) : null}
            </TouchableOpacity>
          );
        })}
      </SafeAreaView>
    </Modal>
  );
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function ProfileSkeleton() {
  const box = 'bg-gray-200 rounded-lg';
  return (
    <SafeAreaView className="flex-1 bg-gray-50">
      <ScrollView className="flex-1" contentContainerClassName="px-4 pt-6 pb-8">
        <View className={`w-40 h-8 mb-6 ${box}`} />
        {/* Avatar */}
        <View className="items-center mb-6">
          <View className="w-20 h-20 rounded-full bg-gray-200 mb-3" />
          <View className={`w-32 h-5 mb-1 ${box}`} />
          <View className={`w-24 h-4 ${box}`} />
        </View>
        {/* Info card */}
        <View className="bg-white rounded-2xl px-4 shadow-sm mb-4">
          {[0, 1, 2].map((i) => (
            <View key={i} className="flex-row items-center gap-3 py-3.5 border-b border-gray-100">
              <View className="w-8 h-4 bg-gray-200 rounded" />
              <View className="flex-1 gap-1">
                <View className={`w-16 h-3 ${box}`} />
                <View className={`w-28 h-4 ${box}`} />
              </View>
            </View>
          ))}
        </View>
        {/* Actions card */}
        <View className="bg-white rounded-2xl px-4 shadow-sm mb-4">
          {[0, 1].map((i) => (
            <View key={i} className="flex-row items-center gap-3 py-3.5 border-b border-gray-100">
              <View className="w-8 h-4 bg-gray-200 rounded" />
              <View className={`flex-1 h-4 ${box}`} />
            </View>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function ProfileScreen() {
  const { user, tenantRole, activeTenantId, signOut, switchTenant, reloadUser } = useAuthContext();
  const router = useRouter();

  const [editNameVisible, setEditNameVisible] = useState(false);
  const [changePassVisible, setChangePassVisible] = useState(false);
  const [switchTenantVisible, setSwitchTenantVisible] = useState(false);
  const [displayName, setDisplayName] = useState(user?.name ?? '');

  async function handleLogout() {
    await signOut();
    router.replace('/(auth)/login');
  }

  if (!user) return <ProfileSkeleton />;

  const initials = displayName ? getInitials(displayName) : '?';
  const roleLabel =
    tenantRole === 'owner' ? 'Dueño' : tenantRole === 'staff' ? 'Empleado' : '—';
  const hasMultipleTenants = (user?.tenants.length ?? 0) > 1;

  return (
    <SafeAreaView className="flex-1 bg-gray-50">
      <ScrollView className="flex-1" contentContainerClassName="px-4 pt-6 pb-8">
        <Text className="text-2xl font-bold text-gray-900 mb-6">Perfil</Text>

        {/* Avatar */}
        <View className="items-center mb-6">
          <View className="w-20 h-20 rounded-full bg-blue-100 items-center justify-center mb-3">
            <Text className="text-2xl font-bold text-blue-600">{initials}</Text>
          </View>
          <Text className="text-lg font-semibold text-gray-900">{displayName || '—'}</Text>
          {user?.tenantName ? (
            <Text className="text-sm text-gray-400 mt-0.5">{user.tenantName}</Text>
          ) : null}
        </View>

        {/* Info card */}
        <View className="bg-white rounded-2xl px-4 shadow-sm mb-4">
          <InfoRow
            icon={<User size={16} color="#9CA3AF" />}
            label="Nombre"
            value={displayName || '—'}
            onPress={() => setEditNameVisible(true)}
          />
          <InfoRow
            icon={<Mail size={16} color="#9CA3AF" />}
            label="Email"
            value={user?.email ?? '—'}
          />
          <InfoRow
            icon={<Briefcase size={16} color="#9CA3AF" />}
            label="Rol"
            value={roleLabel}
          />
        </View>

        {/* Account actions */}
        <View className="bg-white rounded-2xl px-4 shadow-sm mb-4">
          <TouchableOpacity
            className="flex-row items-center gap-3 py-3.5 border-b border-gray-100"
            onPress={() => setChangePassVisible(true)}
            activeOpacity={0.6}
          >
            <View className="w-8 items-center">
              <Lock size={16} color="#9CA3AF" />
            </View>
            <Text className="flex-1 text-sm font-medium text-gray-900">Cambiar contraseña</Text>
            <ChevronRight size={16} color="#D1D5DB" />
          </TouchableOpacity>

          {hasMultipleTenants && (
            <TouchableOpacity
              className="flex-row items-center gap-3 py-3.5 border-b border-gray-100"
              onPress={() => setSwitchTenantVisible(true)}
              activeOpacity={0.6}
            >
              <View className="w-8 items-center">
                <Building2 size={16} color="#9CA3AF" />
              </View>
              <Text className="flex-1 text-sm font-medium text-gray-900">Cambiar negocio</Text>
              <ChevronRight size={16} color="#D1D5DB" />
            </TouchableOpacity>
          )}

          {tenantRole === 'owner' && (
            <TouchableOpacity
              className="flex-row items-center gap-3 py-3.5"
              onPress={() => router.push('/(modals)/business-settings' as never)}
              activeOpacity={0.6}
            >
              <View className="w-8 items-center">
                <Settings size={16} color="#9CA3AF" />
              </View>
              <Text className="flex-1 text-sm font-medium text-gray-900">Configuración del negocio</Text>
              <ChevronRight size={16} color="#D1D5DB" />
            </TouchableOpacity>
          )}
        </View>

        {/* Logout */}
        <TouchableOpacity
          className="bg-red-50 border border-red-200 rounded-2xl py-3.5 flex-row items-center justify-center gap-2"
          onPress={() => void handleLogout()}
          activeOpacity={0.8}
        >
          <LogOut size={16} color="#DC2626" />
          <Text className="text-red-600 font-semibold">Cerrar sesión</Text>
        </TouchableOpacity>

        {/* App version */}
        <Text className="text-center text-xs text-gray-300 mt-6">Inventario360 v1.0.0</Text>
      </ScrollView>

      {/* Modals */}
      <EditNameModal
        visible={editNameVisible}
        initialName={displayName}
        onClose={() => setEditNameVisible(false)}
        onSaved={(name) => { setDisplayName(name); setEditNameVisible(false); void reloadUser(); }}
      />
      <ChangePasswordModal
        visible={changePassVisible}
        onClose={() => setChangePassVisible(false)}
      />
      <SwitchTenantModal
        visible={switchTenantVisible}
        tenants={user?.tenants ?? []}
        activeTenantId={activeTenantId}
        onClose={() => setSwitchTenantVisible(false)}
        onSwitch={switchTenant}
      />
    </SafeAreaView>
  );
}
