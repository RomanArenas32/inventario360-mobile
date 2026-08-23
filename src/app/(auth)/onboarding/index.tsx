import { View, Text, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform } from 'react-native';
import { useState } from 'react';
import { useRouter } from 'expo-router';
import { useAuthContext } from '@/lib/auth-context';

export default function OnboardingNameScreen() {
  const router = useRouter();
  const { user } = useAuthContext();
  const [businessName, setBusinessName] = useState('');
  const [error, setError] = useState('');

  const firstName = user?.name?.split(' ')[0] ?? 'ahí';

  function handleContinue() {
    if (!businessName.trim()) {
      setError('El nombre del negocio es obligatorio');
      return;
    }
    router.push({ pathname: '/(auth)/onboarding/plan', params: { name: businessName.trim() } });
  }

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-white"
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View className="flex-1 px-6 pt-20 pb-10">
        <View className="flex-1">
          <Text className="text-3xl font-bold text-gray-900 mb-2">
            Hola, {firstName} 👋
          </Text>
          <Text className="text-base text-gray-500 mb-10">
            Vamos a configurar tu negocio. Solo te llevará un minuto.
          </Text>

          <Text className="text-sm font-semibold text-gray-700 mb-2">
            ¿Cómo se llama tu negocio?
          </Text>
          <TextInput
            className="border border-gray-200 rounded-xl px-4 py-3.5 text-gray-900 bg-gray-50 text-base"
            placeholder="Ej: Ferretería El Tornillo"
            placeholderTextColor="#9CA3AF"
            value={businessName}
            onChangeText={(v) => { setBusinessName(v); setError(''); }}
            autoFocus
            autoCapitalize="words"
            returnKeyType="done"
            onSubmitEditing={handleContinue}
          />
          {error ? (
            <Text className="text-sm text-red-500 mt-2">{error}</Text>
          ) : null}
        </View>

        <TouchableOpacity
          onPress={handleContinue}
          className="bg-blue-500 rounded-xl py-4 items-center"
          activeOpacity={0.85}
        >
          <Text className="text-white font-semibold text-base">Continuar</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}
