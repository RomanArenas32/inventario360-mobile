import {
  View, Text, TouchableOpacity, TextInput, Alert,
  ActivityIndicator, ScrollView, RefreshControl, Modal,
  KeyboardAvoidingView, Platform,
} from 'react-native';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState, useCallback } from 'react';
import { Plus, Pencil, Trash2, Clock, X, ChevronRight } from 'lucide-react-native';
import { api } from '@/lib/api';
import { useModules } from '@/lib/use-modules';

// ─── Types ────────────────────────────────────────────────────────────────────

type Service = {
  id: string;
  name: string;
  description: string | null;
  price: number;
  duration: number | null;
  isActive: boolean;
};

type ServiceForm = {
  name: string;
  description: string;
  price: string;
  duration: string;
  isActive: boolean;
};

const emptyForm: ServiceForm = {
  name: '', description: '', price: '', duration: '', isActive: true,
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatPrice(n: number) {
  return `$${Math.round(n).toLocaleString('es-AR')}`;
}

function formatDuration(min: number | null) {
  if (!min) return null;
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m > 0 ? `${h}h ${m}min` : `${h}h`;
}

// ─── Service Form Modal ───────────────────────────────────────────────────────

function ServiceFormModal({
  visible,
  initial,
  onClose,
  onSave,
  saving,
}: {
  visible: boolean;
  initial: ServiceForm;
  onClose: () => void;
  onSave: (form: ServiceForm) => void;
  saving: boolean;
}) {
  const [form, setForm] = useState<ServiceForm>(initial);

  // Reset form when modal opens
  const handleOpen = () => setForm(initial);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onShow={handleOpen}
    >
      <SafeAreaView className="flex-1 bg-white" edges={['top', 'bottom']}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          className="flex-1"
        >
          {/* Header */}
          <View className="flex-row items-center justify-between px-4 py-4 border-b border-gray-100">
            <TouchableOpacity onPress={onClose}>
              <X size={22} color="#6B7280" />
            </TouchableOpacity>
            <Text className="text-base font-semibold text-gray-900">
              {initial.name ? 'Editar servicio' : 'Nuevo servicio'}
            </Text>
            <TouchableOpacity onPress={() => onSave(form)} disabled={saving || !form.name.trim()}>
              {saving ? (
                <ActivityIndicator size="small" color="#208AEF" />
              ) : (
                <Text className={`text-base font-semibold ${form.name.trim() ? 'text-blue-500' : 'text-gray-300'}`}>
                  Guardar
                </Text>
              )}
            </TouchableOpacity>
          </View>

          <ScrollView className="flex-1 px-4 pt-5" keyboardShouldPersistTaps="handled">
            {/* Name */}
            <View className="mb-4">
              <Text className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
                Nombre *
              </Text>
              <TextInput
                className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-gray-900 text-base"
                value={form.name}
                onChangeText={(v) => setForm({ ...form, name: v })}
                placeholder="Ej: Corte de cabello"
                placeholderTextColor="#9CA3AF"
                autoFocus
                autoCapitalize="sentences"
              />
            </View>

            {/* Price */}
            <View className="mb-4">
              <Text className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
                Precio
              </Text>
              <TextInput
                className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-gray-900 text-base"
                value={form.price}
                onChangeText={(v) => setForm({ ...form, price: v.replace(/[^0-9.]/g, '') })}
                placeholder="0"
                placeholderTextColor="#9CA3AF"
                keyboardType="decimal-pad"
              />
            </View>

            {/* Duration */}
            <View className="mb-4">
              <Text className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
                Duración (minutos)
              </Text>
              <TextInput
                className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-gray-900 text-base"
                value={form.duration}
                onChangeText={(v) => setForm({ ...form, duration: v.replace(/[^0-9]/g, '') })}
                placeholder="Ej: 30"
                placeholderTextColor="#9CA3AF"
                keyboardType="number-pad"
              />
            </View>

            {/* Description */}
            <View className="mb-4">
              <Text className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
                Descripción
              </Text>
              <TextInput
                className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-gray-900 text-base"
                value={form.description}
                onChangeText={(v) => setForm({ ...form, description: v })}
                placeholder="Descripción opcional"
                placeholderTextColor="#9CA3AF"
                multiline
                numberOfLines={3}
                style={{ minHeight: 80, textAlignVertical: 'top' }}
              />
            </View>

            {/* Active toggle */}
            <TouchableOpacity
              className="flex-row items-center justify-between bg-gray-50 border border-gray-200 rounded-xl px-4 py-3.5 mb-8"
              onPress={() => setForm({ ...form, isActive: !form.isActive })}
              activeOpacity={0.7}
            >
              <Text className="text-base text-gray-900">Servicio activo</Text>
              <View
                className={`w-11 h-6 rounded-full ${form.isActive ? 'bg-blue-500' : 'bg-gray-300'}`}
                style={{ justifyContent: 'center', paddingHorizontal: 2 }}
              >
                <View
                  className="w-5 h-5 rounded-full bg-white shadow"
                  style={{ transform: [{ translateX: form.isActive ? 20 : 0 }] }}
                />
              </View>
            </TouchableOpacity>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function ServicesScreen() {
  const queryClient = useQueryClient();
  const { isOwner } = useModules();

  const [search, setSearch] = useState('');
  const [modalVisible, setModalVisible] = useState(false);
  const [editing, setEditing] = useState<Service | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Service | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const { data: services = [], isLoading } = useQuery({
    queryKey: ['services', search],
    queryFn: () =>
      api.get<Service[]>(`/services${search ? `?search=${encodeURIComponent(search)}` : ''}`),
  });

  function invalidate() {
    void queryClient.invalidateQueries({ queryKey: ['services'] });
  }

  const createMutation = useMutation({
    mutationFn: (data: object) => api.post<Service>('/services', data),
    onSuccess: () => { invalidate(); setModalVisible(false); },
    onError: (err) => Alert.alert('Error', err instanceof Error ? err.message : 'No se pudo crear el servicio'),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: object }) =>
      api.patch<Service>(`/services/${id}`, data),
    onSuccess: () => { invalidate(); setModalVisible(false); setEditing(null); },
    onError: (err) => Alert.alert('Error', err instanceof Error ? err.message : 'No se pudo actualizar'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/services/${id}`),
    onSuccess: () => { invalidate(); setDeleteTarget(null); },
    onError: (err) => { setDeleteTarget(null); Alert.alert('Error', err instanceof Error ? err.message : 'No se pudo eliminar'); },
  });

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await queryClient.invalidateQueries({ queryKey: ['services'] });
    setRefreshing(false);
  }, [queryClient]);

  function handleSave(form: ServiceForm) {
    const payload = {
      name: form.name.trim(),
      description: form.description.trim() || null,
      price: parseFloat(form.price) || 0,
      duration: form.duration ? parseInt(form.duration, 10) : null,
      isActive: form.isActive,
    };
    if (editing) {
      updateMutation.mutate({ id: editing.id, data: payload });
    } else {
      createMutation.mutate(payload);
    }
  }

  function handleDelete(service: Service) {
    setDeleteTarget(service);
  }

  function openCreate() {
    setEditing(null);
    setModalVisible(true);
  }

  function openEdit(service: Service) {
    setEditing(service);
    setModalVisible(true);
  }

  const initialForm: ServiceForm = editing
    ? {
        name: editing.name,
        description: editing.description ?? '',
        price: editing.price > 0 ? String(editing.price) : '',
        duration: editing.duration ? String(editing.duration) : '',
        isActive: editing.isActive,
      }
    : emptyForm;

  const isSaving = createMutation.isPending || updateMutation.isPending;

  return (
    <SafeAreaView className="flex-1 bg-gray-50">
      {/* Header */}
      <View className="flex-row items-center justify-between px-4 pt-6 pb-3">
        <Text className="text-2xl font-bold text-gray-900">Servicios</Text>
        {isOwner && (
          <TouchableOpacity
            onPress={openCreate}
            className="w-9 h-9 rounded-full bg-blue-500 items-center justify-center"
            activeOpacity={0.8}
          >
            <Plus size={20} color="white" />
          </TouchableOpacity>
        )}
      </View>

      {/* Search */}
      <View className="px-4 mb-3">
        <TextInput
          className="bg-white border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-gray-900"
          placeholder="Buscar servicio..."
          placeholderTextColor="#9CA3AF"
          value={search}
          onChangeText={setSearch}
          returnKeyType="search"
        />
      </View>

      {isLoading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#208AEF" />
        </View>
      ) : (
        <ScrollView
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => void onRefresh()} tintColor="#208AEF" />
          }
        >
          {services.length === 0 ? (
            <View className="items-center justify-center py-20 px-6">
              <Text className="text-4xl mb-3">✂️</Text>
              <Text className="text-gray-500 text-sm text-center">
                {search ? 'Sin resultados para tu búsqueda' : 'Todavía no hay servicios cargados'}
              </Text>
              {isOwner && !search && (
                <TouchableOpacity
                  onPress={openCreate}
                  className="mt-4 bg-blue-500 rounded-xl px-5 py-2.5"
                  activeOpacity={0.8}
                >
                  <Text className="text-white font-semibold text-sm">+ Nuevo servicio</Text>
                </TouchableOpacity>
              )}
            </View>
          ) : (
            <View className="px-4 gap-2 pb-8">
              {services.map((svc) => {
                const dur = formatDuration(svc.duration);
                return (
                  <TouchableOpacity
                    key={svc.id}
                    onPress={() => isOwner && openEdit(svc)}
                    activeOpacity={isOwner ? 0.7 : 1}
                    className={`bg-white rounded-2xl px-4 py-3.5 border border-gray-100 flex-row items-center gap-3 ${!svc.isActive ? 'opacity-50' : ''}`}
                  >
                    <View className="flex-1">
                      <View className="flex-row items-center gap-2 mb-0.5">
                        <Text className="text-sm font-semibold text-gray-900">{svc.name}</Text>
                        {!svc.isActive && (
                          <View className="bg-gray-100 px-1.5 py-0.5 rounded">
                            <Text className="text-xs text-gray-400">Inactivo</Text>
                          </View>
                        )}
                      </View>
                      {svc.description ? (
                        <Text className="text-xs text-gray-400 mb-1" numberOfLines={1}>
                          {svc.description}
                        </Text>
                      ) : null}
                      <View className="flex-row items-center gap-3">
                        <Text className="text-base font-bold text-blue-600">
                          {formatPrice(svc.price)}
                        </Text>
                        {dur ? (
                          <View className="flex-row items-center gap-1">
                            <Clock size={11} color="#9CA3AF" />
                            <Text className="text-xs text-gray-400">{dur}</Text>
                          </View>
                        ) : null}
                      </View>
                    </View>
                    {isOwner && (
                      <View className="flex-row items-center gap-1">
                        <TouchableOpacity
                          onPress={() => handleDelete(svc)}
                          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                          className="p-2"
                        >
                          <Trash2 size={15} color="#D1D5DB" />
                        </TouchableOpacity>
                        <ChevronRight size={14} color="#D1D5DB" />
                      </View>
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
          )}
        </ScrollView>
      )}

      <ServiceFormModal
        visible={modalVisible}
        initial={initialForm}
        onClose={() => { setModalVisible(false); setEditing(null); }}
        onSave={handleSave}
        saving={isSaving}
      />

      <ConfirmDialog
        visible={!!deleteTarget}
        title="Eliminar servicio"
        message={deleteTarget ? `¿Eliminar "${deleteTarget.name}"?` : undefined}
        confirmLabel="Eliminar"
        destructive
        loading={deleteMutation.isPending}
        onConfirm={() => {
          if (deleteTarget) deleteMutation.mutate(deleteTarget.id);
        }}
        onCancel={() => setDeleteTarget(null)}
      />
    </SafeAreaView>
  );
}
