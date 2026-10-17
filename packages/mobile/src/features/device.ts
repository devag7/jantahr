import { Alert, Linking } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as Location from 'expo-location';
import type { LocalFile } from '@/lib/files';

const askSettings = (what: string) => Alert.alert(`${what} is off for JantaHR`, `Allow it in Settings to use this.`, [
  { text: 'Not now', style: 'cancel' }, { text: 'Open Settings', onPress: () => void Linking.openSettings() },
]);

/**
 * The phone's position for a check-in, or null (permission refused, location off, or no fix in 10 s). Offices with
 * a geo-fence refuse a check-in without it; the API says so in its error.
 */
export async function currentPosition(): Promise<{ latitude: number; longitude: number } | null> {
  const perm = await Location.requestForegroundPermissionsAsync();
  if (!perm.granted) return null;
  try {
    const fix = await Promise.race([
      Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High }),
      new Promise<null>((r) => setTimeout(() => r(null), 10_000)),
    ]);
    const pos = fix ?? (await Location.getLastKnownPositionAsync());
    return pos ? { latitude: pos.coords.latitude, longitude: pos.coords.longitude } : null;
  } catch {
    return null;
  }
}

async function cameraAllowed() {
  const perm = await ImagePicker.requestCameraPermissionsAsync();
  if (!perm.granted) askSettings('The camera');
  return perm.granted;
}

/** A front-camera photo for the check-in, as the web sends it: 480 px wide JPEG in a data URL. */
export async function takeSelfie(): Promise<string | null> {
  if (!(await cameraAllowed())) return null;
  const shot = await ImagePicker.launchCameraAsync({ cameraType: ImagePicker.CameraType.front, mediaTypes: ['images'], quality: 0.8 });
  if (shot.canceled || !shot.assets[0]) return null;
  const image = await ImageManipulator.manipulate(shot.assets[0].uri).resize({ width: 480 }).renderAsync();
  const saved = await image.saveAsync({ base64: true, compress: 0.7, format: SaveFormat.JPEG });
  return saved.base64 ? `data:image/jpeg;base64,${saved.base64}` : null;
}

/** A receipt photo (or one from the gallery picker, which needs no permission), shrunk to 1600 px. */
export async function pickReceipt(source: 'camera' | 'library'): Promise<LocalFile | null> {
  if (source === 'camera' && !(await cameraAllowed())) return null;
  const opts: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], quality: 0.8 };
  const result = source === 'camera' ? await ImagePicker.launchCameraAsync(opts) : await ImagePicker.launchImageLibraryAsync(opts);
  if (result.canceled || !result.assets[0]) return null;
  const a = result.assets[0];
  const image = await ImageManipulator.manipulate(a.uri).resize(a.width > a.height ? { width: Math.min(1600, a.width) } : { height: Math.min(1600, a.height) }).renderAsync();
  const saved = await image.saveAsync({ compress: 0.75, format: SaveFormat.JPEG });
  return { uri: saved.uri, name: `receipt-${Date.now()}.jpg`, mimeType: 'image/jpeg' };
}
