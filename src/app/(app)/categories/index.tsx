import {
  View, Text, FlatList, TextInput, TouchableOpacity,
  Alert, RefreshControl, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useState, useCallback } from 'react';
import { Search, Plus, Pencil, Trash2 } from 'lucide-react-native';
import { api } from '@/lib/api';
import { editStore } from '@/lib/edit-store';
import { useAuthContext } from '@/lib/auth-context';
import type { Category } from '@/lib/types';

function CategoryCard({
  category,
  isOwner,
  onEdit,
  onDelete,
}: {
  category: Category;
  isOwner: boolean;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <View className="bg-white rounded-2xl px-4 py-3.5 mb-3 shadow-sm flex-row items-center">
      <View className="flex-1 mr-3">
        <Text className="text-base font-semibold text-gray-900">{category.name}</Text>
        {category.description ? (
          <Text className="text-sm text-gray-400 mt-0.5" numberOfLines={1}>
            {category.description}
          </Text>
        ) : null}
      </View>
      {isOwner && (
        <View className="flex-row gap-1">
          <TouchableOpacity
            onPress={onEdit}
            className="p-2 rounded-xl bg-gray-50"
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Pencil size={14} color="#6B7280" />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={onDelete}
            className="p-2 rounded-xl bg-gray-50"
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Trash2 size={14} color="#EF4444" />
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

export default function CategoriesScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { tenantRole } = useAuthContext();
  const isOwner = tenantRole === 'owner';

  const [search, setSearch] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const { data: categories = [], isLoading } = useQuery({
    queryKey: ['categories', { search }],
    queryFn: () => {
      const qs = search ? `?search=${encodeURIComponent(search)}` : '';
      return api.get<Category[]>(`/categories${qs}`);
    },
  });

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await queryClient.invalidateQueries({ queryKey: ['categories'] });
    setRefreshing(false);
  }, [queryClient]);

  function openNew() {
    editStore.clearCategory();
    router.push('/(modals)/category-form' as never);
  }

  function openEdit(category: Category) {
    editStore.setCategory(category);
    router.push('/(modals)/category-form' as never);
  }

  function confirmDelete(category: Category) {
    Alert.alert(
      'Eliminar categoría',
      `¿Eliminar "${category.name}"? Los productos con esta categoría quedarán sin categoría.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: () => {
            void api.delete(`/categories/${category.id}`).then(() => {
              void queryClient.invalidateQueries({ queryKey: ['categories'] });
              void queryClient.invalidateQueries({ queryKey: ['products'] });
            });
          },
        },
      ],
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-gray-50">
      {/* Header */}
      <View className="flex-row items-center justify-between px-4 pt-4 pb-3">
        <View>
          <Text className="text-2xl font-bold text-gray-900">Categorías</Text>
          <Text className="text-sm text-gray-400 mt-0.5">
            {categories.length} {categories.length === 1 ? 'categoría' : 'categorías'}
          </Text>
        </View>
        {isOwner && (
          <TouchableOpacity
            onPress={openNew}
            className="bg-blue-500 w-10 h-10 rounded-full items-center justify-center shadow-sm"
          >
            <Plus size={20} color="white" />
          </TouchableOpacity>
        )}
      </View>

      {/* Search */}
      <View className="mx-4 mb-4 flex-row items-center bg-white border border-gray-200 rounded-xl px-3 gap-2">
        <Search size={16} color="#9CA3AF" />
        <TextInput
          className="flex-1 py-2.5 text-gray-900 text-sm"
          placeholder="Buscar categoría..."
          placeholderTextColor="#9CA3AF"
          value={search}
          onChangeText={setSearch}
          clearButtonMode="while-editing"
        />
      </View>

      {isLoading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color="#208AEF" />
        </View>
      ) : (
        <FlatList
          data={categories}
          keyExtractor={(c) => c.id}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24 }}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => void onRefresh()} tintColor="#208AEF" />
          }
          ListEmptyComponent={
            <View className="items-center py-16">
              <Text className="text-gray-400 text-sm">
                {search ? 'No se encontraron categorías.' : 'No hay categorías. Creá la primera.'}
              </Text>
            </View>
          }
          renderItem={({ item }) => (
            <CategoryCard
              category={item}
              isOwner={isOwner}
              onEdit={() => openEdit(item)}
              onDelete={() => confirmDelete(item)}
            />
          )}
        />
      )}
    </SafeAreaView>
  );
}
