import {
  View, Text, TextInput, TouchableOpacity, KeyboardAvoidingView,
  Platform, Modal, FlatList, Pressable,
} from 'react-native';
import { useState } from 'react';
import { useRouter } from 'expo-router';
import { useAuthContext } from '@/lib/auth-context';
import { ChevronDown } from 'lucide-react-native';

type Country = { flag: string; name: string; code: string };

const COUNTRIES: Country[] = [
  { flag: '🇦🇷', name: 'Argentina',   code: '+54'  },
  { flag: '🇧🇴', name: 'Bolivia',     code: '+591' },
  { flag: '🇧🇷', name: 'Brasil',      code: '+55'  },
  { flag: '🇨🇱', name: 'Chile',       code: '+56'  },
  { flag: '🇨🇴', name: 'Colombia',    code: '+57'  },
  { flag: '🇪🇨', name: 'Ecuador',     code: '+593' },
  { flag: '🇪🇸', name: 'España',      code: '+34'  },
  { flag: '🇲🇽', name: 'México',      code: '+52'  },
  { flag: '🇵🇦', name: 'Panamá',      code: '+507' },
  { flag: '🇵🇾', name: 'Paraguay',    code: '+595' },
  { flag: '🇵🇪', name: 'Perú',        code: '+51'  },
  { flag: '🇺🇾', name: 'Uruguay',     code: '+598' },
  { flag: '🇺🇸', name: 'USA',         code: '+1'   },
  { flag: '🇻🇪', name: 'Venezuela',   code: '+58'  },
];

export default function OnboardingNameScreen() {
  const router = useRouter();
  const { user } = useAuthContext();
  const [businessName, setBusinessName] = useState('');
  const [nameError, setNameError] = useState('');

  const [country, setCountry] = useState<Country>(COUNTRIES[0]);
  const [phoneNumber, setPhoneNumber] = useState('');
  const [pickerOpen, setPickerOpen] = useState(false);

  const firstName = user?.name?.split(' ')[0] ?? 'ahí';

  function handleContinue() {
    if (!businessName.trim()) {
      setNameError('El nombre del negocio es obligatorio');
      return;
    }
    const phone = phoneNumber.trim()
      ? `${country.code}${phoneNumber.trim()}`
      : '';
    router.push({
      pathname: '/(auth)/onboarding/modules',
      params: { name: businessName.trim(), phone },
    });
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

          {/* Business name */}
          <Text className="text-sm font-semibold text-gray-700 mb-2">
            ¿Cómo se llama tu negocio?
          </Text>
          <TextInput
            className="border border-gray-200 rounded-xl px-4 py-3.5 text-gray-900 bg-gray-50 text-base"
            placeholder="Ej: Ferretería El Tornillo"
            placeholderTextColor="#9CA3AF"
            value={businessName}
            onChangeText={(v) => { setBusinessName(v); setNameError(''); }}
            autoFocus
            autoCapitalize="words"
            returnKeyType="next"
          />
          {nameError ? (
            <Text className="text-sm text-red-500 mt-2">{nameError}</Text>
          ) : null}

          {/* Phone */}
          <Text className="text-sm font-semibold text-gray-700 mt-6 mb-2">
            Teléfono del negocio{' '}
            <Text className="font-normal text-gray-400">(opcional)</Text>
          </Text>
          <View className="flex-row gap-2">
            {/* Country picker trigger */}
            <TouchableOpacity
              onPress={() => setPickerOpen(true)}
              activeOpacity={0.7}
              className="flex-row items-center gap-1.5 border border-gray-200 rounded-xl px-3 py-3.5 bg-gray-50"
            >
              <Text className="text-xl">{country.flag}</Text>
              <Text className="text-sm font-medium text-gray-700">{country.code}</Text>
              <ChevronDown size={14} color="#9CA3AF" />
            </TouchableOpacity>

            {/* Number input */}
            <TextInput
              className="flex-1 border border-gray-200 rounded-xl px-4 py-3.5 text-gray-900 bg-gray-50 text-base"
              placeholder="Ej: 9 1234 5678"
              placeholderTextColor="#9CA3AF"
              value={phoneNumber}
              onChangeText={setPhoneNumber}
              keyboardType="phone-pad"
              returnKeyType="done"
              onSubmitEditing={handleContinue}
            />
          </View>
        </View>

        <TouchableOpacity
          onPress={handleContinue}
          className="bg-blue-500 rounded-xl py-4 items-center"
          activeOpacity={0.85}
        >
          <Text className="text-white font-semibold text-base">Continuar</Text>
        </TouchableOpacity>
      </View>

      {/* Country picker modal */}
      <Modal visible={pickerOpen} transparent animationType="slide">
        <Pressable
          className="flex-1 bg-black/40"
          onPress={() => setPickerOpen(false)}
        />
        <View className="bg-white rounded-t-2xl max-h-96">
          <View className="px-4 py-3 border-b border-gray-100 flex-row items-center justify-between">
            <Text className="text-base font-semibold text-gray-900">Seleccionar país</Text>
            <TouchableOpacity onPress={() => setPickerOpen(false)}>
              <Text className="text-sm text-blue-500 font-medium">Cerrar</Text>
            </TouchableOpacity>
          </View>
          <FlatList
            data={COUNTRIES}
            keyExtractor={(item) => item.code + item.name}
            renderItem={({ item }) => (
              <TouchableOpacity
                onPress={() => { setCountry(item); setPickerOpen(false); }}
                className={`flex-row items-center px-4 py-3.5 border-b border-gray-50 ${
                  item.code === country.code && item.name === country.name ? 'bg-blue-50' : ''
                }`}
                activeOpacity={0.7}
              >
                <Text className="text-2xl mr-3">{item.flag}</Text>
                <Text className="flex-1 text-sm text-gray-800">{item.name}</Text>
                <Text className="text-sm text-gray-400 font-medium">{item.code}</Text>
              </TouchableOpacity>
            )}
          />
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}
