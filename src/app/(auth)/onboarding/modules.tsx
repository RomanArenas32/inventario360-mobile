import { View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { useState } from 'react';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Check } from 'lucide-react-native';
import type { Module } from '@/lib/types';

type ModuleDef = {
  id: Module;
  icon: string;
  label: string;
  description: string;
};

const MODULES: ModuleDef[] = [
  { id: 'products',  icon: '📦', label: 'Productos',  description: 'Catálogo de productos y precios' },
  { id: 'stock',     icon: '📊', label: 'Stock',      description: 'Control de inventario y movimientos' },
  { id: 'sales',     icon: '💰', label: 'Ventas',     description: 'Registro de ventas y cobros' },
  { id: 'turns',     icon: '📅', label: 'Turnos',     description: 'Agenda y gestión de reservas' },
  { id: 'services',  icon: '✂️', label: 'Servicios',  description: 'Catálogo de servicios con precios' },
];

const ALL_MODULE_IDS = MODULES.map((m) => m.id);

export default function OnboardingModulesScreen() {
  const router = useRouter();
  const { name } = useLocalSearchParams<{ name: string }>();
  const [selected, setSelected] = useState<Module[]>(ALL_MODULE_IDS);

  function toggle(id: Module) {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((m) => m !== id) : [...prev, id],
    );
  }

  function handleContinue() {
    router.push({
      pathname: '/(auth)/onboarding/plan',
      params: { name, modules: selected.join(',') },
    });
  }

  return (
    <View className="flex-1 bg-white px-6 pt-20 pb-10">
      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        <Text className="text-3xl font-bold text-gray-900 mb-2">
          ¿Qué usás en tu negocio?
        </Text>
        <Text className="text-base text-gray-500 mb-8">
          Activá los módulos que necesitás. Podés cambiarlos en cualquier momento.
        </Text>

        <View className="gap-3">
          {MODULES.map((mod) => {
            const isSelected = selected.includes(mod.id);
            return (
              <TouchableOpacity
                key={mod.id}
                onPress={() => toggle(mod.id)}
                activeOpacity={0.8}
                className={`flex-row items-center p-4 rounded-2xl border-2 ${
                  isSelected
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200 bg-white'
                }`}
              >
                <Text className="text-2xl mr-4">{mod.icon}</Text>
                <View className="flex-1">
                  <Text
                    className={`text-base font-semibold ${
                      isSelected ? 'text-blue-700' : 'text-gray-700'
                    }`}
                  >
                    {mod.label}
                  </Text>
                  <Text className="text-sm text-gray-400 mt-0.5">{mod.description}</Text>
                </View>
                <View
                  className={`w-6 h-6 rounded-full items-center justify-center ${
                    isSelected ? 'bg-blue-500' : 'bg-gray-200'
                  }`}
                >
                  {isSelected ? <Check size={13} color="white" strokeWidth={3} /> : null}
                </View>
              </TouchableOpacity>
            );
          })}
        </View>

        <View className="h-6" />
      </ScrollView>

      <TouchableOpacity
        onPress={handleContinue}
        disabled={selected.length === 0}
        className={`rounded-xl py-4 items-center ${selected.length === 0 ? 'bg-gray-200' : 'bg-blue-500'}`}
        activeOpacity={0.85}
      >
        <Text className={`font-semibold text-base ${selected.length === 0 ? 'text-gray-400' : 'text-white'}`}>
          Continuar
        </Text>
      </TouchableOpacity>
    </View>
  );
}
