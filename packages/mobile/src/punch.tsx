import * as React from 'react';
import { Alert, Modal, Pressable, Text, View } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as Location from 'expo-location';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from './api';
import { Ionicons } from '@expo/vector-icons';
import { Body, Button, Card, Muted, SectionLabel, humanize, type, useTheme } from './theme';
import type { PunchStatus } from './types';

const clock = (s: number) => [Math.floor(s / 3600), Math.floor((s % 3600) / 60), s % 60].map((x) => String(x).padStart(2, '0')).join(':');

/** Check in/out with GPS (for geo-fenced offices) and an optional selfie. */
export function PunchCard({ status }: { status: PunchStatus }) {
  const t = useTheme();
  const qc = useQueryClient();
  const [tick, setTick] = React.useState(0);
  const [selfie, setSelfie] = React.useState(false);
  const [camera, setCamera] = React.useState(false);
  const [permission, requestPermission] = useCameraPermissions();
  const camRef = React.useRef<CameraView>(null);

  React.useEffect(() => {
    setTick(0);
    if (!status.checkedIn) return;
    const id = setInterval(() => setTick((x) => x + 1), 1000);
    return () => clearInterval(id);
  }, [status.checkedIn, status.elapsedSeconds]);

  const punch = useMutation({
    mutationFn: async (photo?: string) => {
      let coords: { latitude?: number; longitude?: number } = {};
      const perm = await Location.requestForegroundPermissionsAsync();
      if (perm.granted) {
        const p = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        coords = { latitude: p.coords.latitude, longitude: p.coords.longitude };
      }
      return api<PunchStatus>('/attendance/punch', { method: 'POST', body: { ...coords, source: 'MOBILE', ...(photo ? { selfie: photo } : {}) } });
    },
    onSuccess: () => qc.invalidateQueries(),
    onError: (e) => Alert.alert('Could not mark attendance', e instanceof Error ? e.message : 'Try again'),
  });

  const onPress = async () => {
    if (!selfie) return punch.mutate(undefined);
    if (!permission?.granted && !(await requestPermission()).granted) return Alert.alert('Camera permission needed', 'Allow camera access or turn off the selfie option.');
    setCamera(true);
  };
  const capture = async () => {
    const photo = await camRef.current?.takePictureAsync({ base64: true, quality: 0.4, skipProcessing: true });
    setCamera(false);
    if (photo?.base64) punch.mutate(`data:image/jpeg;base64,${photo.base64}`);
  };

  return (
    <Card>
      <SectionLabel>Today</SectionLabel>
      <Text style={[type.largeTitle, { color: t.text, fontVariant: ['tabular-nums'], marginVertical: 4 }]}>{clock(status.elapsedSeconds + (status.checkedIn ? tick : 0))}</Text>
      <Body style={{ marginBottom: 12 }}>{status.attendance ? `${humanize(status.attendance.status)}${status.attendance.lateEntry ? ' · late' : ''}` : 'Not checked in yet'}</Body>
      <Button title={status.checkedIn ? 'Check out' : 'Check in'} variant="primary" onPress={onPress} loading={punch.isPending} />
      <Pressable onPress={() => setSelfie((s) => !s)} style={{ flexDirection: 'row', alignItems: 'center', marginTop: 12, minHeight: 44 }} accessibilityRole="checkbox" accessibilityState={{ checked: selfie }}>
        <View style={{ width: 22, height: 22, borderRadius: 6, borderWidth: 1.5, borderColor: selfie ? t.primary : t.input, backgroundColor: selfie ? t.primary : 'transparent', marginRight: 10, alignItems: 'center', justifyContent: 'center' }}>{selfie && <Ionicons name="checkmark" size={16} color={t.onPrimary} />}</View>
        <Muted>Attach a selfie</Muted>
      </Pressable>
      <Modal visible={camera} animationType="slide" onRequestClose={() => setCamera(false)}>
        <View style={{ flex: 1, backgroundColor: '#000' }}>
          <CameraView ref={camRef} style={{ flex: 1 }} facing="front" />
          <View style={{ padding: 20, flexDirection: 'row', gap: 12 }}>
            <View style={{ flex: 1 }}><Button title="Cancel" variant="outline" onPress={() => setCamera(false)} /></View>
            <View style={{ flex: 1 }}><Button title="Capture" onPress={capture} /></View>
          </View>
        </View>
      </Modal>
    </Card>
  );
}
