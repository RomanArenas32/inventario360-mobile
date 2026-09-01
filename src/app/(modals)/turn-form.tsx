import {
  View, Text, TextInput, ScrollView, TouchableOpacity, ActivityIndicator, Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState, useEffect } from 'react';
import { X, Clock, User, ChevronDown, ChevronLeft, ChevronRight, DollarSign } from 'lucide-react-native';
import { api } from '@/lib/api';
import { editStore } from '@/lib/edit-store';
import type { TeamMember } from '@/lib/types';

// ─── Constants ────────────────────────────────────────────────────────────────

const DURATIONS = [15, 30, 45, 60, 90, 120];

const SERVICE_CHIPS = [
  'Corte', 'Barba', 'Corte y barba', 'Coloración', 'Mechas',
  'Keratina', 'Manicura', 'Pedicura', 'Depilación', 'Tratamiento',
];

const INTERVALS = [10, 15, 30] as const;
type Interval = (typeof INTERVALS)[number];

function buildTimeSlots(interval: Interval): string[] {
  const total = (24 * 60) / interval;
  return Array.from({ length: total }, (_, i) => {
    const minutes = i * interval;
    const h = Math.floor(minutes / 60).toString().padStart(2, '0');
    const m = (minutes % 60).toString().padStart(2, '0');
    return `${h}:${m}`;
  });
}

const inputCls = 'bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-gray-900 text-base';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function defaultTime(): string {
  const now = new Date();
  const m = now.getMinutes();
  if (m < 30) return `${now.getHours().toString().padStart(2, '0')}:30`;
  const h = (now.getHours() + 1) % 24;
  return `${h.toString().padStart(2, '0')}:00`;
}

function toDateKey(d: Date): string {
  return d.toISOString().split('T')[0]!;
}

function dateLabel(dateKey: string): string {
  const d = new Date(dateKey + 'T12:00:00');
  const today = new Date();
  if (d.toDateString() === today.toDateString()) return 'Hoy';
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);
  if (d.toDateString() === tomorrow.toDateString()) return 'Mañana';
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  if (d.toDateString() === yesterday.toDateString()) return 'Ayer';
  return d.toLocaleDateString('es-AR', { weekday: 'short', day: 'numeric', month: 'short' });
}

function buildStartTime(dateStr: string, timeStr: string): string {
  const [year, month, day] = dateStr.split('-').map(Number);
  const [hours, mins] = timeStr.split(':').map(Number);
  return new Date(year!, month! - 1, day!, hours!, mins!).toISOString();
}

// ─── Time Picker Modal ─────────────────────────────────────────────────────────

function TimePickerModal({
  visible,
  selected,
  onSelect,
  onClose,
}: {
  visible: boolean;
  selected: string;
  onSelect: (t: string) => void;
  onClose: () => void;
}) {
  const [interval, setInterval] = useState<Interval>(30);
  const slots = buildTimeSlots(interval);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View className="flex-1 justify-end" style={{ backgroundColor: 'rgba(0,0,0,0.4)' }}>
        <SafeAreaView className="bg-white rounded-t-3xl" edges={['bottom']}>
          <View className="flex-row items-center justify-between px-4 py-4 border-b border-gray-100">
            <Text className="text-base font-semibold text-gray-900">Seleccionar horario</Text>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <X size={20} color="#6B7280" />
            </TouchableOpacity>
          </View>
          {/* Interval selector */}
          <View className="flex-row gap-2 px-4 py-3 border-b border-gray-100">
            {INTERVALS.map((iv) => (
              <TouchableOpacity
                key={iv}
                onPress={() => setInterval(iv)}
                className={`px-3 py-1.5 rounded-full border ${
                  interval === iv ? 'bg-blue-500 border-blue-500' : 'bg-gray-50 border-gray-200'
                }`}
                activeOpacity={0.7}
              >
                <Text className={`text-xs font-semibold ${interval === iv ? 'text-white' : 'text-gray-600'}`}>
                  {iv} min
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          <ScrollView className="max-h-72" showsVerticalScrollIndicator={false}>
            <View className="flex-row flex-wrap px-4 py-3 gap-2">
              {slots.map((slot) => (
                <TouchableOpacity
                  key={slot}
                  onPress={() => { onSelect(slot); onClose(); }}
                  className={`px-4 py-2.5 rounded-xl border ${
                    selected === slot ? 'bg-blue-500 border-blue-500' : 'bg-gray-50 border-gray-200'
                  }`}
                  activeOpacity={0.7}
                >
                  <Text className={`text-sm font-semibold ${selected === slot ? 'text-white' : 'text-gray-700'}`}>
                    {slot}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            <View className="h-4" />
          </ScrollView>
        </SafeAreaView>
      </View>
    </Modal>
  );
}

// ─── Professional Picker Modal ─────────────────────────────────────────────────

function ProfessionalPickerModal({
  visible,
  selectedId,
  onSelect,
  onClose,
}: {
  visible: boolean;
  selectedId: string | null;
  onSelect: (id: string | null, name: string | null) => void;
  onClose: () => void;
}) {
  const { data: members = [] } = useQuery({
    queryKey: ['team-members'],
    queryFn: () => api.get<TeamMember[]>('/tenants/members'),
    enabled: visible,
    retry: false,
    staleTime: 5 * 60_000,
  });

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View className="flex-1 justify-end" style={{ backgroundColor: 'rgba(0,0,0,0.4)' }}>
        <SafeAreaView className="bg-white rounded-t-3xl" edges={['bottom']}>
          <View className="flex-row items-center justify-between px-4 py-4 border-b border-gray-100">
            <Text className="text-base font-semibold text-gray-900">Asignar profesional</Text>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <X size={20} color="#6B7280" />
            </TouchableOpacity>
          </View>
          <ScrollView className="max-h-72" showsVerticalScrollIndicator={false}>
            {/* No assignment option */}
            <TouchableOpacity
              onPress={() => { onSelect(null, null); onClose(); }}
              className={`flex-row items-center px-4 py-3.5 border-b border-gray-100 ${!selectedId ? 'bg-blue-50' : ''}`}
              activeOpacity={0.7}
            >
              <View className="w-8 h-8 rounded-full bg-gray-200 items-center justify-center mr-3">
                <User size={14} color="#9CA3AF" />
              </View>
              <Text className={`flex-1 text-sm font-medium ${!selectedId ? 'text-blue-600' : 'text-gray-700'}`}>
                Sin asignar
              </Text>
              {!selectedId && <Text className="text-blue-500 text-lg leading-none">✓</Text>}
            </TouchableOpacity>

            {members.filter((m) => m.isActive).map((m) => (
              <TouchableOpacity
                key={m.userId}
                onPress={() => { onSelect(m.userId, m.name); onClose(); }}
                className={`flex-row items-center px-4 py-3.5 border-b border-gray-100 ${selectedId === m.userId ? 'bg-blue-50' : ''}`}
                activeOpacity={0.7}
              >
                <View className="w-8 h-8 rounded-full bg-blue-100 items-center justify-center mr-3">
                  <Text className="text-blue-600 text-xs font-bold">
                    {m.name.charAt(0).toUpperCase()}
                  </Text>
                </View>
                <View className="flex-1">
                  <Text className={`text-sm font-medium ${selectedId === m.userId ? 'text-blue-600' : 'text-gray-900'}`}>
                    {m.name}
                  </Text>
                  <Text className="text-xs text-gray-400 capitalize">{m.role}</Text>
                </View>
                {selectedId === m.userId && <Text className="text-blue-500 text-lg leading-none">✓</Text>}
              </TouchableOpacity>
            ))}
            <View className="h-4" />
          </ScrollView>
        </SafeAreaView>
      </View>
    </Modal>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function TurnFormScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { date, edit } = useLocalSearchParams<{ date?: string; edit?: string }>();
  const isEditing = edit === '1';

  // In edit mode, pull the turn from the in-memory store
  const existingTurn = isEditing ? editStore.getTurn() : null;

  // Date state — editable (for reschedule)
  const [selectedDate, setSelectedDate] = useState(() => {
    if (existingTurn?.date) return new Date(existingTurn.date + 'T12:00:00');
    if (date) return new Date(date + 'T12:00:00');
    return new Date();
  });
  const dateKey = toDateKey(selectedDate);

  // Form state
  const [clientName, setClientName] = useState(existingTurn?.clientName ?? '');
  const [clientPhone, setClientPhone] = useState(existingTurn?.clientPhone ?? '');
  const [service, setService] = useState(existingTurn?.service ?? '');
  const [isQueue, setIsQueue] = useState(!existingTurn?.startTime);
  const [time, setTime] = useState(() => {
    if (existingTurn?.startTime) {
      const d = new Date(existingTurn.startTime);
      return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
    }
    return defaultTime();
  });
  const [duration, setDuration] = useState(existingTurn?.duration ?? 30);
  const [price, setPrice] = useState(existingTurn?.price != null ? String(existingTurn.price) : '');
  const [notes, setNotes] = useState(existingTurn?.notes ?? '');
  const [assignedUserId, setAssignedUserId] = useState<string | null>(
    existingTurn?.assignedUser?.id ?? null,
  );
  const [assignedUserName, setAssignedUserName] = useState<string | null>(
    existingTurn?.assignedUser?.name ?? null,
  );

  // UI state
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [showProfPicker, setShowProfPicker] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [touched, setTouched] = useState(false);

  function shiftDay(delta: number) {
    setSelectedDate((d) => {
      const next = new Date(d);
      next.setDate(next.getDate() + delta);
      return next;
    });
  }

  const clientNameError = touched && !clientName.trim() ? 'El nombre del cliente es obligatorio' : '';
  const serviceError = touched && !service.trim() ? 'El servicio es obligatorio' : '';

  async function handleSave() {
    setTouched(true);
    if (!clientName.trim() || !service.trim()) return;

    setSubmitting(true);
    setError('');
    try {
      const body = {
        clientName: clientName.trim(),
        clientPhone: clientPhone.trim() || null,
        service: service.trim(),
        startTime: isQueue ? null : buildStartTime(dateKey, time),
        date: dateKey,
        duration,
        notes: notes.trim() || null,
        assignedUserId: assignedUserId ?? null,
        price: price ? parseFloat(price) : null,
      };

      if (isEditing && existingTurn) {
        await api.patch(`/turns/${existingTurn.id}`, body);
      } else {
        await api.post('/turns', body);
      }

      editStore.clearTurn();
      await queryClient.invalidateQueries({ queryKey: ['turns'] });
      router.back();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar el turno');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <SafeAreaView className="flex-1 bg-white" edges={['top', 'bottom']}>
      {/* Header */}
      <View className="flex-row items-center justify-between px-4 py-4 border-b border-gray-100">
        <TouchableOpacity
          onPress={() => { editStore.clearTurn(); router.back(); }}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <X size={22} color="#6B7280" />
        </TouchableOpacity>
        <Text className="text-base font-semibold text-gray-900">
          {isEditing ? 'Editar turno' : 'Nuevo turno'}
        </Text>
        <TouchableOpacity
          onPress={() => void handleSave()}
          disabled={submitting}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          {submitting ? (
            <ActivityIndicator size="small" color="#208AEF" />
          ) : (
            <Text className="text-blue-500 font-semibold text-base">Guardar</Text>
          )}
        </TouchableOpacity>
      </View>

      <ScrollView
        className="flex-1 px-4 pt-4"
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Date navigator */}
        <View className="flex-row items-center justify-between bg-gray-50 border border-gray-200 rounded-xl px-2 py-2 mb-4">
          <TouchableOpacity
            onPress={() => shiftDay(-1)}
            className="p-1.5"
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <ChevronLeft size={18} color="#6B7280" />
          </TouchableOpacity>
          <Text className="text-sm font-semibold text-gray-900">{dateLabel(dateKey)}</Text>
          <TouchableOpacity
            onPress={() => shiftDay(1)}
            className="p-1.5"
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <ChevronRight size={18} color="#6B7280" />
          </TouchableOpacity>
        </View>

        {/* Cliente */}
        <View className="mb-4">
          <Text className="text-sm font-medium text-gray-700 mb-1.5">
            Cliente <Text className="text-red-500">*</Text>
          </Text>
          <View className={`flex-row items-center bg-gray-50 border rounded-xl px-4 gap-3 ${clientNameError ? 'border-red-400' : 'border-gray-200'}`}>
            <User size={16} color={clientNameError ? '#F87171' : '#9CA3AF'} />
            <TextInput
              className="flex-1 py-3 text-base text-gray-900"
              value={clientName}
              onChangeText={setClientName}
              placeholder="Nombre del cliente"
              placeholderTextColor="#9CA3AF"
              autoCapitalize="words"
              returnKeyType="next"
            />
          </View>
          {!!clientNameError && (
            <Text className="text-xs text-red-500 mt-1 ml-1">{clientNameError}</Text>
          )}
        </View>

        {/* Teléfono */}
        <View className="mb-4">
          <Text className="text-sm font-medium text-gray-700 mb-1.5">
            Teléfono{' '}
            <Text className="text-xs text-gray-400 font-normal">(opcional)</Text>
          </Text>
          <TextInput
            className={inputCls}
            value={clientPhone}
            onChangeText={setClientPhone}
            placeholder="+54 9 11 1234-5678"
            placeholderTextColor="#9CA3AF"
            keyboardType="phone-pad"
          />
        </View>

        {/* Servicio + chips */}
        <View className="mb-4">
          <Text className="text-sm font-medium text-gray-700 mb-1.5">
            Servicio <Text className="text-red-500">*</Text>
          </Text>
          <TextInput
            className={`bg-gray-50 border rounded-xl px-4 py-3 text-gray-900 text-base ${serviceError ? 'border-red-400' : 'border-gray-200'}`}
            value={service}
            onChangeText={setService}
            placeholder="Ej: Corte y barba, Coloración..."
            placeholderTextColor="#9CA3AF"
            returnKeyType="next"
          />
          {!!serviceError && (
            <Text className="text-xs text-red-500 mt-1 ml-1">{serviceError}</Text>
          )}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mt-2">
            <View className="flex-row gap-2 pr-2">
              {SERVICE_CHIPS.map((s) => (
                <TouchableOpacity
                  key={s}
                  onPress={() => setService(s)}
                  className={`px-3 py-1.5 rounded-full border ${
                    service === s ? 'bg-blue-500 border-blue-500' : 'bg-gray-50 border-gray-200'
                  }`}
                  activeOpacity={0.7}
                >
                  <Text className={`text-xs font-medium ${service === s ? 'text-white' : 'text-gray-600'}`}>
                    {s}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>
        </View>

        {/* Sin horario toggle */}
        <View className="mb-4 flex-row items-center justify-between bg-gray-50 border border-gray-200 rounded-xl px-4 py-3.5">
          <View>
            <Text className="text-sm font-medium text-gray-900">Sin horario (cola de espera)</Text>
            <Text className="text-xs text-gray-400 mt-0.5">El cliente espera su turno en orden</Text>
          </View>
          <TouchableOpacity
            onPress={() => setIsQueue((v) => !v)}
            className={`w-12 h-6 rounded-full ${isQueue ? 'bg-blue-500' : 'bg-gray-300'}`}
            activeOpacity={0.8}
          >
            <View
              className="w-5 h-5 rounded-full bg-white shadow-sm"
              style={{ marginTop: 2, marginLeft: isQueue ? 26 : 2 }}
            />
          </TouchableOpacity>
        </View>

        {/* Horario — tap-to-pick */}
        {!isQueue && (
          <View className="mb-4">
            <Text className="text-sm font-medium text-gray-700 mb-1.5">
              Horario <Text className="text-red-500">*</Text>
            </Text>
            <TouchableOpacity
              onPress={() => setShowTimePicker(true)}
              className="flex-row items-center bg-gray-50 border border-gray-200 rounded-xl px-4 py-3.5 gap-3"
              activeOpacity={0.7}
            >
              <Clock size={16} color="#9CA3AF" />
              <Text className="flex-1 text-base text-gray-900">{time}</Text>
              <ChevronDown size={16} color="#9CA3AF" />
            </TouchableOpacity>
          </View>
        )}

        {/* Duración */}
        <View className="mb-4">
          <Text className="text-sm font-medium text-gray-700 mb-2">Duración</Text>
          <View className="flex-row flex-wrap gap-2">
            {DURATIONS.map((d) => (
              <TouchableOpacity
                key={d}
                onPress={() => setDuration(d)}
                className={`px-3.5 py-2 rounded-xl border ${
                  duration === d ? 'bg-blue-500 border-blue-500' : 'bg-gray-50 border-gray-200'
                }`}
                activeOpacity={0.7}
              >
                <Text className={`text-sm font-semibold ${duration === d ? 'text-white' : 'text-gray-700'}`}>
                  {d < 60 ? `${d} min` : `${d / 60}h`}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Profesional */}
        <View className="mb-4">
          <Text className="text-sm font-medium text-gray-700 mb-1.5">
            Profesional{' '}
            <Text className="text-xs text-gray-400 font-normal">(opcional)</Text>
          </Text>
          <TouchableOpacity
            onPress={() => setShowProfPicker(true)}
            className="flex-row items-center bg-gray-50 border border-gray-200 rounded-xl px-4 py-3.5 gap-3"
            activeOpacity={0.7}
          >
            <User size={16} color="#9CA3AF" />
            <Text className={`flex-1 text-base ${assignedUserName ? 'text-gray-900' : 'text-gray-400'}`}>
              {assignedUserName ?? 'Sin asignar'}
            </Text>
            <ChevronDown size={16} color="#9CA3AF" />
          </TouchableOpacity>
        </View>

        {/* Precio */}
        <View className="mb-4">
          <Text className="text-sm font-medium text-gray-700 mb-1.5">
            Precio{' '}
            <Text className="text-xs text-gray-400 font-normal">(opcional)</Text>
          </Text>
          <View className="flex-row items-center bg-gray-50 border border-gray-200 rounded-xl px-4 gap-3">
            <DollarSign size={16} color="#9CA3AF" />
            <TextInput
              className="flex-1 py-3 text-base text-gray-900"
              value={price}
              onChangeText={setPrice}
              placeholder="0.00"
              placeholderTextColor="#9CA3AF"
              keyboardType="decimal-pad"
            />
          </View>
        </View>

        {/* Notas */}
        <View className="mb-4">
          <Text className="text-sm font-medium text-gray-700 mb-1.5">
            Notas{' '}
            <Text className="text-xs text-gray-400 font-normal">(opcional)</Text>
          </Text>
          <TextInput
            className={`${inputCls} min-h-16`}
            value={notes}
            onChangeText={setNotes}
            placeholder="Preferencias, alergias, detalles del servicio..."
            placeholderTextColor="#9CA3AF"
            multiline
            numberOfLines={3}
            textAlignVertical="top"
            maxLength={300}
          />
        </View>

        {/* Error */}
        {!!error && (
          <View className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 mb-4">
            <Text className="text-sm text-red-600">{error}</Text>
          </View>
        )}

        <View className="h-8" />
      </ScrollView>

      <TimePickerModal
        visible={showTimePicker}
        selected={time}
        onSelect={setTime}
        onClose={() => setShowTimePicker(false)}
      />
      <ProfessionalPickerModal
        visible={showProfPicker}
        selectedId={assignedUserId}
        onSelect={(id, name) => { setAssignedUserId(id); setAssignedUserName(name); }}
        onClose={() => setShowProfPicker(false)}
      />
    </SafeAreaView>
  );
}
