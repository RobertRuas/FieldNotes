const FALLBACK_LANG = 'pt-BR';

function accessibilityLang(): string {
  const declared = document.documentElement.lang.trim();
  return declared || FALLBACK_LANG;
}

function languagePrefix(lang: string): string {
  return lang.toLowerCase().split('-')[0] ?? lang.toLowerCase();
}

function voiceFor(voices: readonly SpeechSynthesisVoice[], lang: string): SpeechSynthesisVoice | undefined {
  const wanted = lang.toLowerCase();
  const prefix = languagePrefix(lang);
  return (
    voices.find((voice) => voice.lang.toLowerCase() === wanted) ??
    voices.find((voice) => languagePrefix(voice.lang) === prefix)
  );
}

function voicesOf(synth: SpeechSynthesis): Promise<SpeechSynthesisVoice[]> {
  const ready = synth.getVoices();
  if (ready.length > 0) return Promise.resolve(ready);
  return new Promise((resolve) => {
    const finish = (): void => {
      synth.removeEventListener('voiceschanged', finish);
      resolve(synth.getVoices());
    };
    synth.addEventListener('voiceschanged', finish);
    window.setTimeout(finish, 500);
  });
}

export async function speakAloud(text: string): Promise<boolean> {
  const synth = window.speechSynthesis;
  const spoken = text.replace(/\s+/g, ' ').trim();
  if (!synth || !spoken) return false;
  const lang = accessibilityLang();
  const voices = await voicesOf(synth);
  const utterance = new SpeechSynthesisUtterance(spoken);
  utterance.lang = lang;
  const voice = voiceFor(voices, lang);
  if (voice) utterance.voice = voice;
  synth.cancel();
  synth.speak(utterance);
  return true;
}

export function stopSpeaking(): void {
  window.speechSynthesis?.cancel();
}
