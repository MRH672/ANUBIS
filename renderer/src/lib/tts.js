const PRONUNCIATION_RULES = [
  [/\bANUBIS\b/gi, "Anubis"],
  [/\bSQL Injection\b/gi, "S Q L Injection"],
  [/\bSQLI\b/g, "S Q L I"],
  [/\bSQL\b/g, "S Q L"],
  [/\bXSS\b/g, "X S S"],
  [/\bXXE Injection\b/gi, "X X E Injection"],
  [/\bXXE\b/g, "X X E"],
  [/\bOSCI\b/g, "O S C I"],
  [/\bOS Command Injection\b/gi, "O S Command Injection"],
  [/\bHTTP Request Smuggling\b/gi, "H T T P Request Smuggling"],
  [/\bWebSocket\b/gi, "Web Socket"],
  [/\bAccess Control\b/gi, "Access Control"],
  [/\bPath Traversal\b/gi, "Path Traversal"],
  [/\bshopnest\.com\b/gi, "shop nest dot com"]
];

const PREFERRED_VOICES = [
  "Microsoft Zira",
  "Microsoft Aria",
  "Microsoft Jenny",
  "Samantha",
  "Google US English",
  "Karen",
  "Moira",
  "Microsoft David",
  "Daniel"
];

let voicesReadyPromise = null;

export function prepareSpeechText(text) {
  let prepared = String(text || "").trim();
  if (!prepared) return "";

  for (const [pattern, replacement] of PRONUNCIATION_RULES) {
    prepared = prepared.replace(pattern, replacement);
  }

  prepared = prepared.replace(/\.\\s+/g, ". , ");
  prepared = prepared.replace(/;\\s+/g, "; , ");
  prepared = prepared.replace(/:\\s+/g, ": , ");

  return prepared;
}

export function ensureVoicesLoaded() {
  if (!window.speechSynthesis) {
    return Promise.resolve([]);
  }

  if (voicesReadyPromise) {
    return voicesReadyPromise;
  }

  voicesReadyPromise = new Promise((resolve) => {
    const readVoices = () => window.speechSynthesis.getVoices();

    const voices = readVoices();
    if (voices.length) {
      resolve(voices);
      return;
    }

    const onVoicesChanged = () => {
      window.speechSynthesis.removeEventListener("voiceschanged", onVoicesChanged);
      resolve(readVoices());
    };

    window.speechSynthesis.addEventListener("voiceschanged", onVoicesChanged);

    window.setTimeout(() => {
      window.speechSynthesis.removeEventListener("voiceschanged", onVoicesChanged);
      resolve(readVoices());
    }, 1200);
  });

  return voicesReadyPromise;
}

export function pickNarratorVoice(voices = []) {
  for (const preferredName of PREFERRED_VOICES) {
    const match = voices.find(
      (voice) => voice.name.includes(preferredName) && voice.lang.toLowerCase().startsWith("en")
    );
    if (match) return match;
  }

  return (
    voices.find((voice) => voice.lang.toLowerCase() === "en-us") ||
    voices.find((voice) => voice.lang.toLowerCase().startsWith("en")) ||
    null
  );
}

export async function speakCalm(text, options = {}) {
  if (!window.speechSynthesis) return;

  const {
    volume = 0.78,
    rate = 0.8,
    pitch = 1.15,
    lang = "en-US",
    onStart,
    onEnd
  } = options;

  const preparedText = prepareSpeechText(text);
  if (!preparedText) return;

  const voices = await ensureVoicesLoaded();

  return new Promise((resolve) => {
    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(preparedText);
    utterance.lang = lang;
    utterance.rate = rate;
    utterance.pitch = pitch;
    utterance.volume = Math.min(1, Math.max(0.05, volume));

    const voice = pickNarratorVoice(voices);
    if (voice) {
      utterance.voice = voice;
    }

    utterance.onstart = () => {
      onStart?.();
    };

    utterance.onend = () => {
      onEnd?.();
      resolve();
    };

    utterance.onerror = () => {
      onEnd?.();
      resolve();
    };

    window.speechSynthesis.speak(utterance);
  });
}

export function stopSpeech() {
  window.speechSynthesis?.cancel();
}