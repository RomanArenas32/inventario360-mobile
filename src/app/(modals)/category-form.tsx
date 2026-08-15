import {
  View, Text, TextInput, ScrollView,
  TouchableOpacity, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { X } from 'lucide-react-native';
import { api } from '@/lib/api';
import { editStore } from '@/lib/edit-store';

const inputCls = 'bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-gray-900 text-base';

export default function CategoryFormScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();

  const category = editStore.getCategory();
  const isEditing = !!category;

  const [name, setName] = useState(category?.name ?? '');
  const [description, setDescription] = useState(category?.description ?? '');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit() {
    if (!name.trim()) { setError('El nombre es obligatorio'); return; }
    setSubmitting(true);
    setError('');
    try {
      const body = {
        name: name.trim(),
        description: description.trim() || undefined,
      };
      if (isEditing) {
        await api.patch(`/categories/${category!.id}`, body);
      } else {
        await api.post('/categories', body);
      }
      await queryClient.invalidateQueries({ queryKey: ['categories'] });
      editStore.clearCategory();
      router.back();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al guardar');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <SafeAreaView className="flex-1 bg-white" edges={['bottom']}>
      {/* Header */}
      <View className="flex-row items-center justify-between px-4 py-4 border-b border-gray-100">
        <TouchableOpacity onPress={() => router.back()} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
          <X size={22} color="#6B7280" />
        </TouchableOpacity>
        <Text className="text-base font-semibold text-gray-900">
          {isEditing ? 'Editar categoría' : 'Nueva categoría'}
        </Text>
        <TouchableOpacity onPress={() => void handleSubmit()} disabled={submitting}>
          {submitting ? (
            <ActivityIndicator size="small" color="#208AEF" />
          ) : (
            <Text className="text-blue-500 font-semibold text-base">Guardar</Text>
          )}
        </TouchableOpacity>
      </View>

      <ScrollView className="flex-1 px-4 pt-4" keyboardShouldPersistTaps="handled">
        <View className="mb-4">
          <Text className="text-sm font-medium text-gray-700 mb-1.5">
            Nombre <Text className="text-red-500">*</Text>
          </Text>
          <TextInput
            className={inputCls}
            value={name}
            onChangeText={setName}
            placeholder="Nombre de la categoría"
            placeholderTextColor="#9CA3AF"
            autoFocus
          />
        </View>

        <View className="mb-4">
          <Text className="text-sm font-medium text-gray-700 mb-1.5">Descripción</Text>
          <TextInput
            className={`${inputCls} min-h-24`}
            value={description}
            onChangeText={setDescription}
            placeholder="Descripción opcional"
            placeholderTextColor="#9CA3AF"
            multiline
            numberOfLines={4}
            textAlignVertical="top"
          />
        </View>

        {error ? (
          <View className="bg-red-50 border border-red-200 rounded-xl px-4 py-3">
            <Text className="text-sm text-red-600">{error}</Text>
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}
