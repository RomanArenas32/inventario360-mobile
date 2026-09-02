import { Modal, View, Text, TouchableOpacity, ActivityIndicator } from 'react-native';

type Props = {
  visible: boolean;
  title: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

export function ConfirmDialog({
  visible,
  title,
  message,
  confirmLabel = 'Confirmar',
  cancelLabel = 'Cancelar',
  destructive = false,
  loading = false,
  onConfirm,
  onCancel,
}: Props) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onCancel}
    >
      <View
        className="flex-1 items-center justify-center px-8"
        style={{ backgroundColor: 'rgba(0,0,0,0.45)' }}
      >
        <View className="bg-white rounded-3xl w-full overflow-hidden">
          {/* Body */}
          <View className="px-6 pt-6 pb-5">
            <Text className="text-base font-bold text-gray-900 mb-1.5">{title}</Text>
            {message ? (
              <Text className="text-sm text-gray-500 leading-5">{message}</Text>
            ) : null}
          </View>

          {/* Divider */}
          <View className="h-px bg-gray-100" />

          {/* Buttons */}
          <View className="flex-row">
            <TouchableOpacity
              onPress={onCancel}
              disabled={loading}
              activeOpacity={0.6}
              className="flex-1 py-4 items-center border-r border-gray-100"
            >
              <Text className="text-sm font-semibold text-gray-500">{cancelLabel}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={onConfirm}
              disabled={loading}
              activeOpacity={0.6}
              className="flex-1 py-4 items-center"
            >
              {loading ? (
                <ActivityIndicator size="small" color={destructive ? '#DC2626' : '#208AEF'} />
              ) : (
                <Text
                  className="text-sm font-bold"
                  style={{ color: destructive ? '#DC2626' : '#208AEF' }}
                >
                  {confirmLabel}
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}
