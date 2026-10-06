import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';

// A interface ainda não chama a câmera. A captura entra numa fase seguinte.
export async function capturePhoto(): Promise<string> {
  const photo = await Camera.getPhoto({
    quality: 80,
    allowEditing: false,
    resultType: CameraResultType.Uri,
    source: CameraSource.Camera,
  });
  const path = photo.webPath ?? photo.path;
  if (!path) throw new Error('A câmera não devolveu um arquivo.');
  return path;
}
