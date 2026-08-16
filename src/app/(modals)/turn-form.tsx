import {
  View, Text, TextInput, ScrollView, TouchableOpacity, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { X, Clock, User } from 'lucide-react-native';
import { api } from '@/lib/api';

// ─── Constants ────────────────────────────────────────────────────────────────

const DURATIONS = [15, 30, 45, 60, 90, 120];

const inputCls =
  'bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-gray-900 text-base';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function defaultTime(): string {
  const now = new Date();
  const m = now.getMinutes();
  if (m < 30) {
    return `${now.getHours().toString().padStart(2, '0')}:30`;
  }
  const h = (now.getHours() + 1) % 24;
  return `${h.toString().padStart(2, '0')}:00`;
}

function isValidTime(t: string): boolean {
  return /^([01]?\d|2[0-3]):([0-5]\d)$/.test(t.trim());
}

function buildStartTime(dateStr: string, timeStr: string): string {
  const [year, month, day] = dateStr.split('-').map(Number);
  const [hours, mins] = timeStr.trim().split(':').map(Number);
  return new Date(year!, (month! - 1), day!, hours, mins).toISOString();
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function TurnFormScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { date } = useLocalSearchParams<{ date?: string }>();
  const dateKey = date ?? new Date().toISOString().split('T')[0]!;

  const [clientName, setClientName] = useState('');
  const [clientPhone, setClientPhone] = useState('');
  const [service, setService] = useState('');
  const [isQueue, setIsQueue] = useState(false);
  const [time, setTime] = useState(defaultTime);
  const [duration, setDuration] = useState(30);
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  async function handleSave() {
    if (!clientName.trim()) { setError('El nombre del cliente es obligatorio'); return; }
    if (!service.trim()) { setError('El servicio es obligatorio'); return; }
    if (!isQueue && !isValidTime(time)) { setError('El horario debe tener formato HH:MM (ej: 10:30)'); return; }

    setSubmitting(true);
    setError('');
    try {
      await api.post('/turns', {
        clientName: clientName.trim(),
        clientPhone: clientPhone.trim() || null,
        service: service.trim(),
        startTime: isQueue ? null : buildStartTime(dateKey, time),
        date: dateKey,
        duration,
        notes: notes.trim() || null,
      });
      await queryClient.invalidateQueries({ queryKey: ['turns', dateKey] });
      router.back();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar el turno');
    } finally {
      setSubmitting(false);
    }
  }

  // Format display date for header
  const displayDateStr = (() => {
    const d = new Date(dateKey + 'T12:00:00');
    const today = new Date();
    if (d.toDateString() === today.toDateString()) return 'Hoy';
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);
    if (d.toDateString() === tomorrow.toDateString()) return 'Mañana';
    return d.toLocaleDateString('es-AR', { weekday: 'short', day: 'numeric', month: 'short' });
  })();

  return (
    <SafeAreaView className="flex-1 bg-white" edges={['bottom']}>
      {/* Header */}
      <View className="flex-row items-center justify-between px-4 py-4 border-b border-gray-100">
        <TouchableOpacity
          onPress={() => router.back()}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <X size={22} color="#6B7280" />
        </TouchableOpacity>
        <View className="items-center">
          <Text className="text-base font-semibold text-gray-900">Nuevo turno</Text>
          <Text className="text-xs text-gray-400">{displayDateStr}</Text>
        </View>
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
        {/* Cliente */}
        <View className="mb-4">
          <Text className="text-sm font-medium text-gray-700 mb-1.5">
            Cliente <Text className="text-red-500">*</Text>
          </Text>
          <View className="flex-row items-center bg-gray-50 border border-gray-200 rounded-xl px-4 gap-3">
            <User size={16} color="#9CA3AF" />
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

        {/* Servicio */}
        <View className="mb-4">
          <Text className="text-sm font-medium text-gray-700 mb-1.5">
            Servicio <Text className="text-red-500">*</Text>
          </Text>
          <TextInput
            className={inputCls}
            value={service}
            onChangeText={setService}
            placeholder="Ej: Corte y barba, Coloración..."
            placeholderTextColor="#9CA3AF"
            returnKeyType="next"
          />
        </View>

        {/* Sin horario (cola) */}
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
              style={{
                marginTop: 2,
                marginLeft: isQueue ? 26 : 2,
              }}
            />
          </TouchableOpacity>
        </View>

        {/* Horario */}
        {!isQueue && (
          <View className="mb-4">
            <Text className="text-sm font-medium text-gray-700 mb-1.5">
              Horario <Text className="text-red-500">*</Text>
            </Text>
            <View className="flex-row items-center bg-gray-50 border border-gray-200 rounded-xl px-4 gap-3">
              <Clock size={16} color="#9CA3AF" />
              <TextInput
                className="flex-1 py-3 text-base text-gray-900"
                value={time}
                onChangeText={setTime}
                placeholder="10:30"
                placeholderTextColor="#9CA3AF"
                keyboardType="numbers-and-punctuation"
                maxLength={5}
              />
            </View>
            <Text className="text-xs text-gray-400 mt-1">Formato HH:MM en 24 hs (ej: 14:30)</Text>
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
                  duration === d
                    ? 'bg-blue-500 border-blue-500'
                    : 'bg-gray-50 border-gray-200'
                }`}
                activeOpacity={0.7}
              >
                <Text
                  className={`text-sm font-semibold ${
                    duration === d ? 'text-white' : 'text-gray-700'
                  }`}
                >
                  {d < 60 ? `${d} min` : `${d / 60}h`}
                </Text>
              </TouchableOpacity>
            ))}
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
        {error ? (
          <View className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 mb-4">
            <Text className="text-sm text-red-600">{error}</Text>
          </View>
        ) : null}

        <View className="h-8" />
      </ScrollView>
    </SafeAreaView>
  );
}
