import * as React from 'react';
import { AccessibilityInfo, Animated, KeyboardAvoidingView, Modal, Platform, Pressable, StyleSheet, View } from 'react-native';
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
        <Animated.View pointerEvents="none" accessibilityLiveRegion="polite" style={[styles.toast, { opacity, bottom: insets.bottom + 96, backgroundColor: colors.text }]}>
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
  // the scrim fades in while the sheet rises (Material's bottom sheet), rather than the whole layer sliding up
  const rise = React.useRef(new Animated.Value(400)).current;
  React.useEffect(() => {
    if (!open) return;
    rise.setValue(400);
    // with Android's "Remove animations" on, the sheet is simply there
    void AccessibilityInfo.isReduceMotionEnabled().then((reduce) => {
      if (reduce) rise.setValue(0);
      else Animated.spring(rise, { toValue: 0, useNativeDriver: true, damping: 22, stiffness: 220, mass: 0.9 }).start();
    });
  }, [open, rise]);
  return (
    <Modal visible={open} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent navigationBarTranslucent>
      <Pressable style={[StyleSheet.absoluteFill, { backgroundColor: colors.overlay }]} onPress={onClose} accessibilityLabel="Close" />
      <KeyboardAvoidingView behavior="padding" style={styles.sheetWrap} pointerEvents="box-none">
        <Animated.View style={[styles.sheet, { backgroundColor: colors.background, paddingBottom: insets.bottom + space.lg, transform: [{ translateY: rise }] }]} accessibilityViewIsModal>
          <View style={[styles.grabber, { backgroundColor: colors.border }]} />
          <Text variant="heading" accessibilityRole="header">{title}</Text>
          {children}
        </Animated.View>
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
