import { View, Text, TouchableOpacity, Alert, StyleSheet, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useRef, useState } from 'react';
import { X, ScanLine } from 'lucide-react-native';
import { api } from '@/lib/api';
import { editStore } from '@/lib/edit-store';
import type { Product } from '@/lib/types';

export default function ScanScreen() {
  const router = useRouter();
  const { mode } = useLocalSearchParams<{ mode?: string }>();
  const isProductMode = mode === 'product';
  const [permission, requestPermission] = useCameraPermissions();
  const scanning = useRef(false);
  const [loading, setLoading] = useState(false);

  async function handleBarcode({ data }: { data: string }) {
    if (scanning.current) return;
    scanning.current = true;
    setLoading(true);

    try {
      const product = await api.get<Product | null>(`/products/by-code?code=${encodeURIComponent(data)}`);

      if (product) {
        if (isProductMode) {
          router.replace(`/(app)/products/${product.id}` as never);
        } else {
          editStore.setStockProductId(product.id);
          router.replace('/(modals)/stock-movement' as never);
        }
      } else {
        Alert.alert(
          'Producto no encontrado',
          `No hay ningún producto con el código "${data}".`,
          [
            {
              text: 'Escanear otro',
              onPress: () => {
                setLoading(false);
                scanning.current = false;
              },
            },
            {
              text: 'Cerrar',
              style: 'cancel',
              onPress: () => router.back(),
            },
          ],
        );
      }
    } catch {
      Alert.alert('Error', 'No se pudo verificar el código. Intentá de nuevo.', [
        {
          text: 'OK',
          onPress: () => {
            setLoading(false);
            scanning.current = false;
          },
        },
      ]);
    }
  }

  if (!permission) {
    return <View className="flex-1 bg-black" />;
  }

  if (!permission.granted) {
    return (
      <SafeAreaView className="flex-1 bg-black items-center justify-center px-8">
        <ScanLine size={48} color="#9CA3AF" />
        <Text className="text-white text-lg font-semibold mt-4 text-center">
          Permiso de cámara requerido
        </Text>
        <Text className="text-gray-400 text-sm text-center mt-2">
          Necesitamos acceso a la cámara para escanear códigos de barras.
        </Text>
        <TouchableOpacity
          onPress={() => void requestPermission()}
          className="mt-6 bg-blue-500 px-6 py-3 rounded-xl"
          activeOpacity={0.8}
        >
          <Text className="text-white font-semibold">Conceder permiso</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => router.back()}
          className="mt-3 py-2"
          activeOpacity={0.7}
        >
          <Text className="text-gray-400">Cancelar</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  return (
    <View style={StyleSheet.absoluteFill}>
      <CameraView
        style={StyleSheet.absoluteFill}
        facing="back"
        barcodeScannerSettings={{ barcodeTypes: ['ean13', 'ean8', 'code128', 'code39', 'qr', 'upc_a', 'upc_e'] }}
        onBarcodeScanned={loading ? undefined : (e) => void handleBarcode(e)}
      />

      <SafeAreaView style={StyleSheet.absoluteFill} pointerEvents="box-none">
        {/* Close button */}
        <View className="flex-row justify-end px-4 pt-4">
          <TouchableOpacity
            onPress={() => router.back()}
            className="bg-black/50 rounded-full p-2"
            activeOpacity={0.8}
          >
            <X size={22} color="white" />
          </TouchableOpacity>
        </View>

        {/* Viewfinder */}
        <View className="flex-1 items-center justify-center">
          <View style={styles.viewfinder}>
            <View style={[styles.corner, styles.topLeft]} />
            <View style={[styles.corner, styles.topRight]} />
            <View style={[styles.corner, styles.bottomLeft]} />
            <View style={[styles.corner, styles.bottomRight]} />
          </View>

          {loading ? (
            <View className="mt-6 flex-row items-center gap-2">
              <ActivityIndicator color="white" size="small" />
              <Text className="text-white text-sm opacity-80">Buscando producto...</Text>
            </View>
          ) : (
            <Text className="text-white text-sm mt-4 opacity-80">
              Apuntá al código de barras del producto
            </Text>
          )}
        </View>
      </SafeAreaView>
    </View>
  );
}

const VIEWFINDER = 240;
const CORNER = 24;
const THICKNESS = 3;

const styles = StyleSheet.create({
  viewfinder: {
    width: VIEWFINDER,
    height: VIEWFINDER,
    position: 'relative',
  },
  corner: {
    position: 'absolute',
    width: CORNER,
    height: CORNER,
    borderColor: 'white',
  },
  topLeft:    { top: 0,    left: 0,  borderTopWidth: THICKNESS,    borderLeftWidth: THICKNESS,  borderTopLeftRadius: 4 },
  topRight:   { top: 0,    right: 0, borderTopWidth: THICKNESS,    borderRightWidth: THICKNESS, borderTopRightRadius: 4 },
  bottomLeft: { bottom: 0, left: 0,  borderBottomWidth: THICKNESS, borderLeftWidth: THICKNESS,  borderBottomLeftRadius: 4 },
  bottomRight:{ bottom: 0, right: 0, borderBottomWidth: THICKNESS, borderRightWidth: THICKNESS, borderBottomRightRadius: 4 },
});
