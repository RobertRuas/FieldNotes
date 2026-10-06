import { Capacitor } from '@capacitor/core';

export type PhotoSource = 'camera' | 'photos';

/** Na PWA a foto entra pelo input do navegador. O plugin só roda no app nativo. */
export async function captureNativePhoto(source: PhotoSource): Promise<Blob | null> {
  if (!Capacitor.isNativePlatform()) return null;
  const { Camera, CameraResultType, CameraSource } = await import('@capacitor/camera');
  const photo = await Camera.getPhoto({
    quality: 80,
    allowEditing: false,
    resultType: CameraResultType.Uri,
    source: source === 'camera' ? CameraSource.Camera : CameraSource.Photos,
  });
  const path = photo.webPath ?? photo.path;
  if (!path) throw new Error('A câmera não devolveu um arquivo.');
  const response = await fetch(path);
  if (!response.ok) throw new Error('A câmera não devolveu um arquivo.');
  return response.blob();
}
