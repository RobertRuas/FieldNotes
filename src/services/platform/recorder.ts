/** Gravação no navegador. No app nativo o MediaRecorder do WebView basta. */
export function recorderMime(): string {
  if (typeof MediaRecorder === 'undefined') return '';
  const candidates = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/aac'];
  return candidates.find((item) => MediaRecorder.isTypeSupported(item)) ?? '';
}

export async function openMicrophone(): Promise<{ recorder: MediaRecorder; stream: MediaStream; mimeType: string }> {
  if (typeof MediaRecorder === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
    throw new Error('Este aparelho não grava áudio aqui.');
  }
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  const mimeType = recorderMime();
  const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
  return { recorder, stream, mimeType: recorder.mimeType || mimeType || 'audio/webm' };
}

export function stopStream(stream: MediaStream | null): void {
  stream?.getTracks().forEach((track) => track.stop());
}
