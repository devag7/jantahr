import * as React from 'react';
import { Animated, KeyboardAvoidingView, Modal, Platform, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Text } from './kit';
import { radius, space, useTheme } from './theme';

// ---------- toast: one short confirmation at the bottom, gone after 2.5 s ----------
type ToastKind = 'success' | 'error';
const ToastContext = React.createContext<(message: string, kind?: ToastKind) => void>(() => undefined);
export const useToast = () => React.useContext(ToastContext);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [toast, setToast] = React.useState<{ message: string; kind: ToastKind } | null>(null);
  const opacity = React.useRef(new Animated.Value(0)).current;
  const timer = React.useRef<ReturnType<typeof setTimeout>>(undefined);
  const show = React.useCallback((message: string, kind: ToastKind = 'success') => {
    void Haptics.notificationAsync(kind === 'success' ? Haptics.NotificationFeedbackType.Success : Haptics.NotificationFeedbackType.Error).catch(() => undefined);
    setToast({ message, kind });
    Animated.timing(opacity, { toValue: 1, duration: 160, useNativeDriver: true }).start();
    clearTimeout(timer.current);
    timer.current = setTimeout(() => Animated.timing(opacity, { toValue: 0, duration: 200, useNativeDriver: true }).start(() => setToast(null)), 2500);
  }, [opacity]);
  return (
    <ToastContext.Provider value={show}>
      {children}
      {toast && (
        <Animated.View pointerEvents="none" accessibilityLiveRegion="polite" style={[styles.toast, { opacity, bottom: insets.bottom + 72, backgroundColor: colors.text }]}>
          <Ionicons name={toast.kind === 'success' ? 'checkmark-circle' : 'alert-circle'} size={20} color={toast.kind === 'success' ? colors.success : colors.danger} />
          <Text style={{ color: colors.background, flexShrink: 1 }}>{toast.message}</Text>
        </Animated.View>
      )}
    </ToastContext.Provider>
  );
}

// ---------- sheet: a bottom panel for short tasks (a comment, a choice) ----------
export function Sheet({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: React.ReactNode }) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={open} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <Pressable style={[StyleSheet.absoluteFill, { backgroundColor: colors.overlay }]} onPress={onClose} accessibilityLabel="Close" />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.sheetWrap} pointerEvents="box-none">
        <View style={[styles.sheet, { backgroundColor: colors.background, paddingBottom: insets.bottom + space.lg }]} accessibilityViewIsModal>
          <View style={[styles.grabber, { backgroundColor: colors.border }]} />
          <Text variant="heading" accessibilityRole="header">{title}</Text>
          {children}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  toast: { position: 'absolute', left: space.lg, right: space.lg, borderRadius: radius.md, paddingVertical: space.md, paddingHorizontal: space.lg, flexDirection: 'row', alignItems: 'center', gap: space.sm },
  sheetWrap: { flex: 1, justifyContent: 'flex-end' },
  sheet: { borderTopLeftRadius: radius.lg + 6, borderTopRightRadius: radius.lg + 6, padding: space.xl, paddingTop: space.md, gap: space.lg },
  grabber: { alignSelf: 'center', width: 36, height: 5, borderRadius: 3, marginBottom: space.xs },
});
