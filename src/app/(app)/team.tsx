import {
  View,
  Text,
  FlatList,
  TextInput,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Modal,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState, useCallback, useMemo } from 'react';
import { Search, Users, UserPlus, X } from 'lucide-react-native';
import { api } from '@/lib/api';
import { useAuthContext } from '@/lib/auth-context';
import type { TeamMember } from '@/lib/types';

// ─── Member card ──────────────────────────────────────────────────────────────

function getInitials(name: string) {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return (parts[0] ?? '').slice(0, 2).toUpperCase();
  const first = (parts[0] ?? '')[0] ?? '';
  const last = (parts[parts.length - 1] ?? '')[0] ?? '';
  return (first + last).toUpperCase();
}

function MemberRow({ member }: { member: TeamMember }) {
  const initials = getInitials(member.name);
  const isOwner = member.role === 'owner';

  return (
    <View className="flex-row items-center px-4 py-3.5 border-b border-gray-100">
      {/* Avatar */}
      <View
        className={`w-10 h-10 rounded-full items-center justify-center mr-3 ${
          isOwner ? 'bg-blue-100' : 'bg-gray-100'
        }`}
      >
        <Text
          className={`text-sm font-bold ${isOwner ? 'text-blue-600' : 'text-gray-600'}`}
        >
          {initials}
        </Text>
      </View>

      {/* Info */}
      <View className="flex-1">
        <Text className="text-sm font-semibold text-gray-900">{member.name}</Text>
        <Text className="text-xs text-gray-400 mt-0.5">{member.email}</Text>
      </View>

      {/* Role + status */}
      <View className="items-end gap-1">
        <View
          className={`px-2 py-0.5 rounded-full ${
            isOwner ? 'bg-blue-100' : 'bg-gray-100'
          }`}
        >
          <Text
            className={`text-xs font-semibold ${
              isOwner ? 'text-blue-700' : 'text-gray-600'
            }`}
          >
            {isOwner ? 'Dueño' : 'Empleado'}
          </Text>
        </View>
        {!member.isActive && (
          <View className="px-2 py-0.5 rounded-full bg-amber-100">
            <Text className="text-xs font-semibold text-amber-700">Inactivo</Text>
          </View>
        )}
      </View>
    </View>
  );
}

// ─── Add Member Modal ─────────────────────────────────────────────────────────

function AddMemberModal({ visible, onClose, onSuccess }: {
  visible: boolean;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [role, setRole] = useState<'staff' | 'owner'>('staff');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  function reset() {
    setEmail('');
    setName('');
    setRole('staff');
    setError('');
  }

  function handleClose() {
    reset();
    onClose();
  }

  async function handleSubmit() {
    if (!email.trim()) {
      setError('El email es obligatorio');
      return;
    }
    setLoading(true);
    setError('');
    try {
      await api.post('/tenants/members', {
        email: email.trim().toLowerCase(),
        name: name.trim() || undefined,
        role,
      });
      reset();
      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al enviar invitación');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={handleClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        className="flex-1 bg-white"
      >
        {/* Header */}
        <View className="flex-row items-center justify-between px-4 pt-6 pb-4 border-b border-gray-100">
          <Text className="text-lg font-bold text-gray-900">Agregar miembro</Text>
          <TouchableOpacity onPress={handleClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <X size={22} color="#6B7280" />
          </TouchableOpacity>
        </View>

        <ScrollView className="flex-1 px-4 pt-5" keyboardShouldPersistTaps="handled">
          <Text className="text-sm text-gray-500 mb-5">
            Se enviará una invitación por email. El usuario deberá aceptarla para unirse al equipo.
          </Text>

          {/* Email */}
          <View className="mb-4">
            <Text className="text-sm font-medium text-gray-700 mb-1.5">Email *</Text>
            <TextInput
              className="border border-gray-200 rounded-xl px-4 py-3 text-gray-900 bg-gray-50 text-sm"
              placeholder="email@ejemplo.com"
              placeholderTextColor="#9CA3AF"
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
              autoComplete="email"
              autoCorrect={false}
            />
          </View>

          {/* Name */}
          <View className="mb-4">
            <Text className="text-sm font-medium text-gray-700 mb-1.5">
              Nombre <Text className="text-gray-400 font-normal">(opcional)</Text>
            </Text>
            <TextInput
              className="border border-gray-200 rounded-xl px-4 py-3 text-gray-900 bg-gray-50 text-sm"
              placeholder="Nombre del miembro"
              placeholderTextColor="#9CA3AF"
              value={name}
              onChangeText={setName}
              autoComplete="name"
            />
          </View>

          {/* Role */}
          <View className="mb-6">
            <Text className="text-sm font-medium text-gray-700 mb-2">Rol</Text>
            <View className="flex-row gap-3">
              <TouchableOpacity
                onPress={() => setRole('staff')}
                className={`flex-1 py-3 rounded-xl border items-center ${
                  role === 'staff' ? 'bg-blue-50 border-blue-400' : 'bg-gray-50 border-gray-200'
                }`}
              >
                <Text className={`text-sm font-semibold ${role === 'staff' ? 'text-blue-600' : 'text-gray-500'}`}>
                  Empleado
                </Text>
                <Text className={`text-xs mt-0.5 ${role === 'staff' ? 'text-blue-400' : 'text-gray-400'}`}>
                  Acceso limitado
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => setRole('owner')}
                className={`flex-1 py-3 rounded-xl border items-center ${
                  role === 'owner' ? 'bg-blue-50 border-blue-400' : 'bg-gray-50 border-gray-200'
                }`}
              >
                <Text className={`text-sm font-semibold ${role === 'owner' ? 'text-blue-600' : 'text-gray-500'}`}>
                  Dueño
                </Text>
                <Text className={`text-xs mt-0.5 ${role === 'owner' ? 'text-blue-400' : 'text-gray-400'}`}>
                  Acceso total
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {error ? (
            <View className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 mb-4">
              <Text className="text-sm text-red-600">{error}</Text>
            </View>
          ) : null}

          <TouchableOpacity
            onPress={() => void handleSubmit()}
            disabled={loading}
            className="bg-blue-500 rounded-xl py-3.5 items-center mb-6"
            activeOpacity={0.85}
          >
            {loading ? (
              <ActivityIndicator color="white" />
            ) : (
              <Text className="text-white font-semibold text-base">Enviar invitación</Text>
            )}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

type PendingInvitation = {
  invitationId: string;
  email: string;
  name: string;
  role: 'staff' | 'owner';
  sentAt: string;
  expiresAt: string;
};

export default function TeamScreen() {
  const queryClient = useQueryClient();
  const { tenantRole } = useAuthContext();
  const isOwner = tenantRole === 'owner';
  const [search, setSearch] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);

  const { data: members = [], isLoading } = useQuery({
    queryKey: ['team-members'],
    queryFn: () => api.get<TeamMember[]>('/tenants/members'),
  });

  const { data: pending = [] } = useQuery({
    queryKey: ['team-invitations-pending'],
    queryFn: () => api.get<PendingInvitation[]>('/tenants/invitations/pending'),
    enabled: isOwner,
  });

  const filtered = useMemo(() => {
    if (!search.trim()) return members;
    const q = search.trim().toLowerCase();
    return members.filter(
      (m) =>
        m.name.toLowerCase().includes(q) ||
        m.email.toLowerCase().includes(q),
    );
  }, [members, search]);

  const ownerCount = members.filter((m) => m.role === 'owner').length;
  const staffCount = members.filter((m) => m.role === 'staff').length;

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['team-members'] }),
      queryClient.invalidateQueries({ queryKey: ['team-invitations-pending'] }),
    ]);
    setRefreshing(false);
  }, [queryClient]);

  function handleInviteSuccess() {
    setShowAddModal(false);
    void queryClient.invalidateQueries({ queryKey: ['team-invitations-pending'] });
    Alert.alert('Invitación enviada', 'El miembro recibirá un email para unirse al equipo.');
  }

  function confirmRevoke(inv: PendingInvitation) {
    Alert.alert(
      'Revocar invitación',
      `¿Cancelar la invitación a ${inv.email}?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Revocar',
          style: 'destructive',
          onPress: () => {
            void api.delete(`/tenants/invitations/pending/${inv.invitationId}`).then(() => {
              void queryClient.invalidateQueries({ queryKey: ['team-invitations-pending'] });
            });
          },
        },
      ],
    );
  }

  const pendingSection = isOwner && pending.length > 0 ? (
    <View className="mt-2">
      <View className="flex-row items-center justify-between px-4 py-2">
        <Text className="text-xs font-semibold text-gray-400 tracking-wider uppercase">
          Invitaciones pendientes
        </Text>
        <Text className="text-xs text-gray-400">{pending.length}</Text>
      </View>
      {pending.map((inv) => (
        <View
          key={inv.invitationId}
          className="flex-row items-center px-4 py-3.5 border-b border-gray-100"
        >
          {/* Icon */}
          <View className="w-10 h-10 rounded-full bg-amber-100 items-center justify-center mr-3">
            <Text className="text-sm font-bold text-amber-600">@</Text>
          </View>

          {/* Info */}
          <View className="flex-1">
            <Text className="text-sm font-semibold text-gray-900">{inv.name}</Text>
            <Text className="text-xs text-gray-400 mt-0.5">{inv.email}</Text>
          </View>

          {/* Role + status + revoke */}
          <View className="items-end gap-1.5">
            <View className="px-2 py-0.5 rounded-full bg-amber-100">
              <Text className="text-xs font-semibold text-amber-700">Pendiente</Text>
            </View>
            <Text className="text-xs text-gray-400">
              {inv.role === 'owner' ? 'Dueño' : 'Empleado'}
            </Text>
          </View>

          <TouchableOpacity
            onPress={() => confirmRevoke(inv)}
            className="ml-3 p-2 rounded-xl bg-gray-50"
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <X size={14} color="#EF4444" />
          </TouchableOpacity>
        </View>
      ))}
    </View>
  ) : null;

  return (
    <SafeAreaView className="flex-1 bg-gray-50">
      <AddMemberModal
        visible={showAddModal}
        onClose={() => setShowAddModal(false)}
        onSuccess={handleInviteSuccess}
      />

      {/* Header */}
      <View className="px-4 pt-6 pb-3">
        <View className="flex-row items-center justify-between mb-1">
          <Text className="text-2xl font-bold text-gray-900">Equipo</Text>
          {isOwner && (
            <TouchableOpacity
              onPress={() => setShowAddModal(true)}
              className="flex-row items-center gap-1.5 bg-blue-500 px-3 py-2 rounded-xl"
              activeOpacity={0.85}
            >
              <UserPlus size={15} color="white" />
              <Text className="text-white text-sm font-semibold">Agregar</Text>
            </TouchableOpacity>
          )}
        </View>
        {members.length > 0 && (
          <Text className="text-sm text-gray-400 mb-4">
            {ownerCount} dueño{ownerCount !== 1 ? 's' : ''} · {staffCount} empleado{staffCount !== 1 ? 's' : ''}
          </Text>
        )}

        {/* Search */}
        <View className="flex-row items-center bg-white border border-gray-200 rounded-xl px-3">
          <Search size={16} color="#9CA3AF" />
          <TextInput
            className="flex-1 py-2.5 px-2 text-sm text-gray-900"
            placeholder="Buscar por nombre o email..."
            placeholderTextColor="#9CA3AF"
            value={search}
            onChangeText={setSearch}
            clearButtonMode="while-editing"
          />
        </View>
      </View>

      {isLoading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#208AEF" />
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(m) => m.membershipId}
          renderItem={({ item }) => <MemberRow member={item} />}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => void onRefresh()}
              tintColor="#208AEF"
            />
          }
          ListEmptyComponent={
            <View className="items-center justify-center py-20">
              <Users size={40} color="#D1D5DB" />
              <Text className="text-gray-400 mt-3 text-sm">
                {search ? 'Sin resultados' : 'No hay miembros en el equipo'}
              </Text>
            </View>
          }
          ListFooterComponent={pendingSection}
        />
      )}

    </SafeAreaView>
  );
}
