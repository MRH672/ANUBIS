import React, { useCallback, useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { Mic, Volume2, VolumeX } from "lucide-react";
import {
  BOOT_NARRATION,
  getAuthFailureStep,
  getAuthPromptSteps,
  getAuthSuccessStep,
  getVerificationStep,
  INTRO_WORDS
} from "./lib/bootDialogue.js";
import { loadProjectRegistry } from "./lib/dataLoader.js";
import { matchMemberPhrase } from "./lib/memberAuth.js";
import { ensureVoicesLoaded, speakCalm, stopSpeech } from "./lib/tts.js";
import "./styles.css";

const defaultScanTarget = "shopnest.com";
const projectIntroductionSentences = [
  "ANUBIS is our graduation project: an intelligent desktop cybersecurity assistant.",
  "Built with Electron and React, it supports natural operator interaction through voice and chat.",
  "Operators select a website and security modules while the orb shows execution status in real time.",
  "A secure preload bridge separates the interface from privileged desktop operations.",
  "A WebSocket-ready execution layer supports backend progress events and final results.",
  "The platform combines cybersecurity orchestration, desktop engineering, and human-computer interaction.",
  "Its modular design supports future automation, analytics, and more advanced assistance."
];

const scanModuleOptions = [
  { id: "sqli", label: "SQL Injection" },
  { id: "osci", label: "OS Command Injection" },
  { id: "reflected-xss", label: "Reflected XSS" },
  { id: "stored-xss", label: "Stored XSS" },
  { id: "information", label: "Information Disclosure" },
  { id: "xml", label: "XXE Injection" },
  { id: "path", label: "Path Traversal" },
  { id: "access", label: "Access Control" },
  { id: "smuggling", label: "HTTP Request Smuggling" },
  { id: "websocket", label: "WebSocket Analysis" }
];

const digitAttackProfiles = {
  "1": { memberName: "Aya Magid", moduleId: "sqli", vulnerability: "SQL Injection" },
  "2": { memberName: "Alyaa", moduleId: "osci", vulnerability: "OS Command Injection" },
  "3": { memberName: "Farha Elsayed", moduleId: "reflected-xss", vulnerability: "Reflected XSS" },
  "4": { memberName: "Mohamed Reda", moduleId: "stored-xss", vulnerability: "Stored XSS" },
  "5": { memberName: "Nouran Mohamed", moduleId: "information", vulnerability: "Information Disclosure" },
  "6": { memberName: "Nourhan Mohamed", moduleId: "xml", vulnerability: "XXE Injection" },
  "7": { memberName: "Ali Mohamed", moduleId: "path", vulnerability: "Path Traversal" },
  "8": { memberName: "Ziad Ashraf", moduleId: "access", vulnerability: "Access Control" },
  "9": { memberName: "Ziad Ashish", moduleId: "smuggling", vulnerability: "HTTP Request Smuggling" },
  "0": { memberName: "Ahmed Taher", moduleId: "websocket", vulnerability: "WebSocket Analysis" }
};

const authOperatorKeys = {
  q: "Marceleno",
  w: "Aya",
  e: "Alyaa",
  r: "Farha",
  t: "Mohamed",
  y: "Nouran",
  u: "Nourhan",
  i: "Ali",
  o: "Ziad Ashraf",
  p: "Ziad Ashish",
  m: "Mariem",
  a: "Afaf",
  h: "Hasaneen",
  s: "Ahmed"
};

const moduleAliases = [
  ["stored xss", "stored-xss"],
  ["stored cross site scripting", "stored-xss"],
  ["reflected xss", "reflected-xss"],
  ["reflected cross site scripting", "reflected-xss"],
  ["information disclosure", "information"],
  ["information", "information"],
  ["request smuggling", "smuggling"],
  ["http smuggling", "smuggling"],
  ["smuggling", "smuggling"],
  ["sql injection", "sqli"],
  ["sqli", "sqli"],
  ["sql", "sqli"],
  ["cross site scripting", "reflected-xss"],
  ["cross-site scripting", "reflected-xss"],
  ["xss", "reflected-xss"],
  ["command injection", "osci"],
  ["os command", "osci"],
  ["cmdi", "osci"],
  ["osci", "osci"],
  ["xxe", "xml"],
  ["xml", "xml"],
  ["path traversal", "path"],
  ["traversal", "path"],
  ["lfi", "path"],
  ["access control", "access"],
  ["authorization", "access"],
  ["idor", "access"],
  ["websocket", "websocket"],
  ["socket", "websocket"]
];

function wait(ms) {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

function clampDelay(value, fallback) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.min(30000, Math.max(500, Math.round(number)));
}

function randomDelay(min, max) {
  const low = Math.min(min, max);
  const high = Math.max(min, max);
  return Math.floor(Math.random() * (high - low + 1)) + low;
}

function getModuleLabel(moduleId) {
  return scanModuleOptions.find((module) => module.id === moduleId)?.label || moduleId.toUpperCase();
}

function buildFinding(moduleId, targetUrl) {
  const findingMap = {
    websocket: {
      severity: "high",
      name: "Live Order Updates Exposure",
      matched_at: `wss://${targetUrl}/orders/live`,
      type: "websocket",
      evidence: {
        request: { type: "order_status", order: 1002 },
        response: "{\"type\":\"order_status\",\"order\":1002,\"status\":\"processing\",\"total\":64.98,\"customer\":\"alice\"}"
      }
    },
    "reflected-xss": {
      severity: "medium",
      name: "Reflected Input Rendering",
      matched_at: `https://${targetUrl}/search?q=operator`,
      type: "reflected-xss",
      evidence: {
        parameter: "q",
        response: "Search term rendered without output encoding in page content."
      }
    },
    "stored-xss": {
      severity: "high",
      name: "Stored Input Rendering",
      matched_at: `https://${targetUrl}/comments`,
      type: "stored-xss",
      evidence: {
        parameter: "comment",
        response: "Stored user content rendered without output encoding."
      }
    },
    information: {
      severity: "medium",
      name: "Sensitive Information Disclosure",
      matched_at: `https://${targetUrl}/debug`,
      type: "information-disclosure",
      evidence: {
        response: "Application metadata and internal details exposed to an unauthenticated user."
      }
    },
    sqli: {
      severity: "high",
      name: "Product Filter Injection",
      matched_at: `https://${targetUrl}/products?category=electronics`,
      type: "sqli",
      evidence: {
        parameter: "category",
        response: "Boolean response difference confirmed on product listing filter."
      }
    },
    osci: {
      severity: "critical",
      name: "Command Parameter Execution",
      matched_at: `https://${targetUrl}/tools/diagnostics`,
      type: "command-injection",
      evidence: {
        parameter: "host",
        response: "Command execution behavior confirmed by delayed response timing."
      }
    },
    xml: {
      severity: "high",
      name: "XML External Entity Processing",
      matched_at: `https://${targetUrl}/api/import`,
      type: "xxe",
      evidence: {
        parameter: "xml",
        response: "External entity expansion behavior observed during XML import."
      }
    },
    path: {
      severity: "high",
      name: "Path Traversal Read",
      matched_at: `https://${targetUrl}/download?file=invoice.pdf`,
      type: "path-traversal",
      evidence: {
        parameter: "file",
        response: "Parent directory traversal changed file resolution path."
      }
    },
    access: {
      severity: "medium",
      name: "Object Access Control Gap",
      matched_at: `https://${targetUrl}/orders/1002`,
      type: "access-control",
      evidence: {
        parameter: "order",
        response: "Order object returned without ownership validation."
      }
    },
    smuggling: {
      severity: "critical",
      name: "HTTP Request Parsing Desynchronization",
      matched_at: `https://${targetUrl}/`,
      type: "http-request-smuggling",
      evidence: {
        response: "Front-end and back-end request boundary interpretation differed during the attack run."
      }
    }
  };

  return findingMap[moduleId] || {
    severity: "info",
    name: `${getModuleLabel(moduleId)} Review`,
    matched_at: `https://${targetUrl}/`,
    type: moduleId,
    evidence: {
      response: "Module completed review for target application."
    }
  };
}

function buildScanReport({ modules, targetUrl, memberName = "" }) {
  const uniqueModules = modules.includes("all") ? scanModuleOptions.map((module) => module.id) : modules;

  return {
    target: targetUrl,
    assigned_member: memberName,
    captured_request_count: 24 + uniqueModules.length * 7,
    modules: uniqueModules.map((moduleId) => getModuleLabel(moduleId)),
    confirmed_findings: uniqueModules.map((moduleId) => ({
      ...buildFinding(moduleId, targetUrl),
      assigned_member: memberName
    })),
    warnings: [],
    timestamp: new Date().toISOString()
  };
}

function getSpeechRecognition() {
  return window.SpeechRecognition || window.webkitSpeechRecognition || null;
}

function hasNativeVoice() {
  return window.electronAPI?.platform === "win32" && typeof window.electronAPI.transcribeNativeVoice === "function";
}

function encodeWav(samples, sampleRate) {
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);

  const writeString = (offset, value) => {
    for (let index = 0; index < value.length; index += 1) {
      view.setUint8(offset + index, value.charCodeAt(index));
    }
  };

  writeString(0, "RIFF");
  view.setUint32(4, 36 + samples.length * 2, true);
  writeString(8, "WAVE");
  writeString(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeString(36, "data");
  view.setUint32(40, samples.length * 2, true);

  let offset = 44;
  for (const sample of samples) {
    const clamped = Math.max(-1, Math.min(1, sample));
    view.setInt16(offset, clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff, true);
    offset += 2;
  }

  return buffer;
}

async function recordWavFromStream(stream, durationMs = 6000) {
  const AudioContext = window.AudioContext || window.webkitAudioContext;
  if (!AudioContext) {
    throw new Error("AudioContext unavailable.");
  }

  const audioContext = new AudioContext();
  const source = audioContext.createMediaStreamSource(stream);
  const silentGain = audioContext.createGain();
  const samples = [];
  const workletSource = `
    class AnubisRecorder extends AudioWorkletProcessor {
      process(inputs) {
        const input = inputs[0] && inputs[0][0];
        if (input) {
          this.port.postMessage(input.slice(0));
        }
        return true;
      }
    }
    registerProcessor("anubis-recorder", AnubisRecorder);
  `;
  const workletUrl = URL.createObjectURL(new Blob([workletSource], { type: "application/javascript" }));

  try {
    await audioContext.audioWorklet.addModule(workletUrl);
    const recorderNode = new AudioWorkletNode(audioContext, "anubis-recorder");
    silentGain.gain.value = 0;
    recorderNode.port.onmessage = (event) => {
      samples.push(...event.data);
    };

    source.connect(recorderNode);
    recorderNode.connect(silentGain);
    silentGain.connect(audioContext.destination);

    await wait(durationMs);

    source.disconnect();
    recorderNode.disconnect();
    silentGain.disconnect();
    recorderNode.port.close();

    return encodeWav(Float32Array.from(samples), audioContext.sampleRate);
  } finally {
    URL.revokeObjectURL(workletUrl);
    await audioContext.close();
  }
}

function interpretOperatorCommand(text) {
  const lowered = text.toLowerCase();
  const modules = [];

  for (const [phrase, moduleName] of moduleAliases) {
    if (lowered.includes(phrase) && !modules.includes(moduleName)) {
      modules.push(moduleName);
    }
  }

  if (modules.includes("stored-xss") && !lowered.includes("reflected")) {
    const reflectedIndex = modules.indexOf("reflected-xss");
    if (reflectedIndex >= 0) modules.splice(reflectedIndex, 1);
  }

  return {
    command: text,
    target_url: defaultScanTarget,
    modules: modules.length ? modules : ["all"]
  };
}

function normalizeTargetInput(value) {
  const trimmed = String(value || "").trim();
  if (!trimmed) return "";

  try {
    const url = new URL(trimmed.includes("://") ? trimmed : `https://${trimmed}`);
    return `${url.host}${url.pathname === "/" ? "" : url.pathname}`.replace(/\/$/, "");
  } catch {
    return "";
  }
}

function getMicLabel(devices, deviceId) {
  if (!deviceId) return "System default microphone";
  const device = devices.find((item) => item.deviceId === deviceId);
  if (device?.label) return device.label;
  const index = devices.findIndex((item) => item.deviceId === deviceId);
  return index >= 0 ? `Microphone ${index + 1}` : "Selected microphone";
}

async function acquireMicStream(selectedMicId) {
  if (selectedMicId) {
    try {
      return await navigator.mediaDevices.getUserMedia({
        audio: { deviceId: { exact: selectedMicId } }
      });
    } catch {
      try {
        return await navigator.mediaDevices.getUserMedia({
          audio: { deviceId: { ideal: selectedMicId } }
        });
      } catch {
        // fall back to default device
      }
    }
  }

  return navigator.mediaDevices.getUserMedia({ audio: true });
}

function formatVoiceError(errorName, detail = "") {
  const reasons = {
    "not-allowed": "microphone permission blocked",
    "service-not-allowed": "speech service blocked by runtime",
    "no-speech": "no speech detected",
    "audio-capture": "no microphone audio captured",
    network: "speech service network/backend unavailable",
    aborted: "speech recognition aborted"
  };
  return `Voice interpreter failed: ${reasons[errorName] || errorName || "unknown error"}${detail ? ` (${detail})` : ""}.`;
}

function App() {
  const [appHidden, setAppHidden] = useState(true);
  const [introActive, setIntroActive] = useState(true);
  const [introFading, setIntroFading] = useState(false);
  const [introWord, setIntroWord] = useState("WELCOME");
  const [introWordPhase, setIntroWordPhase] = useState("");
  const [interactionMode, setInteractionMode] = useState("voice");
  const [audioInputDevices, setAudioInputDevices] = useState([]);
  const [chatDraft, setChatDraft] = useState("");
  const [commandHistory, setCommandHistory] = useState([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [chatMessages, setChatMessages] = useState([
    {
      id: 1,
      role: "system",
      text: "Command console ready."
    }
  ]);
  const [isListening, setIsListening] = useState(false);
  const [voiceLevel, setVoiceLevel] = useState(0);
  const [voiceError, setVoiceError] = useState("");
  const [voiceTranscript, setVoiceTranscript] = useState("");
  const [voiceMuted, setVoiceMuted] = useState(() => window.localStorage.getItem("anubis:voiceMuted") === "true");
  const [voiceVolume, setVoiceVolume] = useState(() => {
    const saved = Number(window.localStorage.getItem("anubis:voiceVolume"));
    return Number.isFinite(saved) ? Math.min(1, Math.max(0, saved)) : 0.9;
  });
  const [orbState, setOrbState] = useState("idle");
  const [selectedMicId, setSelectedMicId] = useState(() => window.localStorage.getItem("anubis:selectedMicId") || "");
  const [selectedScanModules, setSelectedScanModules] = useState(() => {
    const saved = window.localStorage.getItem("anubis:selectedScanModules");
    if (!saved) return ["sqli"];

    try {
      const parsed = JSON.parse(saved);
      const migrated = parsed.map((moduleId) => (moduleId === "xss" ? "reflected-xss" : moduleId));
      const valid = migrated.filter((moduleId) => scanModuleOptions.some((option) => option.id === moduleId));
      return valid.length ? valid : ["sqli"];
    } catch {
      return ["sqli"];
    }
  });
  const [scanDelayRange, setScanDelayRange] = useState(() => {
    const saved = window.localStorage.getItem("anubis:scanDelayRange");
    if (!saved) return { min: 1800, max: 5200 };

    try {
      const parsed = JSON.parse(saved);
      return {
        min: clampDelay(parsed.min, 1800),
        max: clampDelay(parsed.max, 5200)
      };
    } catch {
      return { min: 1800, max: 5200 };
    }
  });
  const [latestReport, setLatestReport] = useState(null);
  const [subtitle, setSubtitle] = useState("Boot sequence started.");
  const [bootComplete, setBootComplete] = useState(false);
  const [bootPhase, setBootPhase] = useState("loading");
  const [awaitingAuthInput, setAwaitingAuthInput] = useState(false);
  const [awaitingWebsiteInput, setAwaitingWebsiteInput] = useState(false);
  const [awaitingModulesInput, setAwaitingModulesInput] = useState(false);
  const [selectedTarget, setSelectedTarget] = useState("");
  const [authenticatedMember, setAuthenticatedMember] = useState(null);
  const dataRef = useRef({
    members: [],
    scenarios: [],
    appConfig: {},
    authenticatedMember: null
  });
  const modeRef = useRef("voice");
  const audioContextRef = useRef(null);
  const analyserFrameRef = useRef(null);
  const micStreamRef = useRef(null);
  const recognitionRef = useRef(null);
  const sequenceRunningRef = useRef(false);
  const authRetriesRef = useRef(0);
  const bootAbortRef = useRef(false);
  const skipIntroRef = useRef(false);
  const awaitingAuthInputRef = useRef(false);
  const awaitingWebsiteInputRef = useRef(false);
  const awaitingModulesInputRef = useRef(false);
  const pendingAttackProfileRef = useRef(null);
  const bootPhaseRef = useRef("loading");
  const bootCompleteRef = useRef(false);
  const startVoiceCommandRef = useRef(null);
  const handleAuthSubmitRef = useRef(null);
  const voiceTimeoutRef = useRef(null);
  const voiceMutedRef = useRef(voiceMuted);
  const voiceVolumeRef = useRef(voiceVolume);
  const speechTokenRef = useRef(0);

  useEffect(() => {
    voiceMutedRef.current = voiceMuted;
    window.localStorage.setItem("anubis:voiceMuted", String(voiceMuted));
    if (voiceMuted) {
      stopSpeech();
    }
  }, [voiceMuted]);

  useEffect(() => {
    voiceVolumeRef.current = voiceVolume;
    window.localStorage.setItem("anubis:voiceVolume", String(voiceVolume));
  }, [voiceVolume]);

  useEffect(() => {
    awaitingAuthInputRef.current = awaitingAuthInput;
  }, [awaitingAuthInput]);

  useEffect(() => {
    awaitingWebsiteInputRef.current = awaitingWebsiteInput;
  }, [awaitingWebsiteInput]);

  useEffect(() => {
    awaitingModulesInputRef.current = awaitingModulesInput;
  }, [awaitingModulesInput]);

  useEffect(() => {
    bootPhaseRef.current = bootPhase;
  }, [bootPhase]);

  useEffect(() => {
    bootCompleteRef.current = bootComplete;
  }, [bootComplete]);

  const closeWindow = useCallback(() => {
    if (window.electronAPI && typeof window.electronAPI.closeWindow === "function") {
      window.electronAPI.closeWindow();
    }
  }, []);

  const minimizeWindow = useCallback(() => {
    if (window.electronAPI && typeof window.electronAPI.minimizeWindow === "function") {
      window.electronAPI.minimizeWindow();
    }
  }, []);

  const maximizeWindow = useCallback(() => {
    if (window.electronAPI && typeof window.electronAPI.maximizeWindow === "function") {
      window.electronAPI.maximizeWindow();
    }
  }, []);

  const changeInteractionMode = useCallback((mode) => {
    const settingsAllowedDuringSetup =
      awaitingAuthInputRef.current ||
      awaitingWebsiteInputRef.current ||
      awaitingModulesInputRef.current;

    if (!bootComplete && mode === "reports") {
      return;
    }

    if (!bootComplete && mode === "settings" && !settingsAllowedDuringSetup) {
      return;
    }

    modeRef.current = mode;
    setInteractionMode(mode);

    if (!sequenceRunningRef.current && (bootComplete || mode === "settings")) {
      setOrbState("idle");
      if (
        mode === "voice" &&
        bootPhaseRef.current === "function_ready" &&
        dataRef.current.authenticatedMember
      ) {
        setSubtitle(`How can I help you, ${dataRef.current.authenticatedMember.fullName}?`);
      } else {
        const label = mode === "voice" ? "Voice" : mode === "chat" ? "Chat" : mode === "reports" ? "Reports" : "Settings";
        setSubtitle(`${label} mode active.`);
      }
    }
  }, [bootComplete]);

  const refreshAudioInputDevices = useCallback(async ({ updateSubtitle = true } = {}) => {
    if (!navigator.mediaDevices?.enumerateDevices) {
      if (updateSubtitle) setSubtitle("Audio device enumeration unavailable.");
      return [];
    }

    try {
      const permissionStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      permissionStream.getTracks().forEach((track) => track.stop());
    } catch (error) {
      const message = formatVoiceError(error.name || "microphone", error.message);
      console.error(message, error);
      setVoiceError(message);
      if (updateSubtitle) setSubtitle(message);
      return [];
    }

    const devices = await navigator.mediaDevices.enumerateDevices();
    const inputs = devices.filter((device) => device.kind === "audioinput");
    setAudioInputDevices(inputs);

    if (inputs.length && !inputs.some((device) => device.deviceId === selectedMicId)) {
      setSelectedMicId(inputs[0].deviceId);
      window.localStorage.setItem("anubis:selectedMicId", inputs[0].deviceId);
    }

    if (updateSubtitle) {
      setSubtitle(inputs.length ? "Microphone devices refreshed." : "No microphone input devices found.");
    }

    return inputs;
  }, [selectedMicId]);

  useEffect(() => {
    if (appHidden) return undefined;
    refreshAudioInputDevices({ updateSubtitle: false });
    return undefined;
  }, [appHidden, refreshAudioInputDevices]);

  const toggleScanModule = useCallback((moduleId) => {
    setSelectedScanModules((modules) => {
      const nextModules = modules.includes(moduleId)
        ? modules.filter((item) => item !== moduleId)
        : [...modules, moduleId];
      const normalized = nextModules.length ? nextModules : [moduleId];
      window.localStorage.setItem("anubis:selectedScanModules", JSON.stringify(normalized));
      return normalized;
    });
  }, []);

  const changeScanDelayRange = useCallback((field, value) => {
    setScanDelayRange((range) => {
      const nextRange = {
        ...range,
        [field]: clampDelay(value, field === "min" ? 1800 : 5200)
      };
      window.localStorage.setItem("anubis:scanDelayRange", JSON.stringify(nextRange));
      return nextRange;
    });
  }, []);

  const isNarrationEnabled = useCallback(() => {
    const config = dataRef.current.appConfig || {};
    return config.voice?.ttsEnabled !== false && !voiceMutedRef.current && Boolean(window.speechSynthesis);
  }, []);

  const isSubtitleEnabled = useCallback(() => {
    const config = dataRef.current.appConfig || {};
    return config.ui?.subtitleEnabled !== false;
  }, []);

  const getCalmSpeechVolume = useCallback(() => {
    return Math.min(0.82, Math.max(0.35, voiceVolumeRef.current * 0.72));
  }, []);

  const speakNarration = useCallback(
    async (text, afterEndState = "thinking") => {
      if (!isNarrationEnabled()) return;

      const speechToken = speechTokenRef.current + 1;
      speechTokenRef.current = speechToken;

      await speakCalm(text, {
        volume: getCalmSpeechVolume(),
        rate: 0.8,
        pitch: 0.94,
        onStart: () => {
          if (speechTokenRef.current === speechToken) {
            setOrbState("speaking");
          }
        },
        onEnd: () => {
          if (speechTokenRef.current === speechToken) {
            setOrbState(afterEndState);
          }
        }
      });
    },
    [getCalmSpeechVolume, isNarrationEnabled]
  );

  const playDialogueStep = useCallback(
    async (step, { speak = true } = {}) => {
      if (bootAbortRef.current) return;

      const nextState = step.state || "idle";
      setOrbState(nextState);

      if (isSubtitleEnabled()) {
        setSubtitle(step.text);
      }

      const shouldSpeak = speak && isNarrationEnabled();

      if (shouldSpeak) {
        await speakNarration(step.text, nextState === "speaking" ? "speaking" : nextState);
        await wait(450);
        return;
      }

      await wait(step.delay || 1800);
    },
    [isNarrationEnabled, isSubtitleEnabled, speakNarration]
  );

  const beginWebsiteSelection = useCallback(() => {
    setBootPhase("website_waiting");
    setAwaitingWebsiteInput(true);
    sequenceRunningRef.current = false;
    setOrbState("thinking");
    setSubtitle("Authentication complete. What website should I attack?");
    setChatMessages((messages) => [
      ...messages.map((message) => (message.active ? { ...message, active: false } : message)),
      {
        id: Date.now(),
        role: "system",
        text: "Authentication complete. Enter the website to attack, or press Ctrl+Space."
      }
    ]);
    if (isNarrationEnabled()) {
      void speakNarration("Authentication complete. What website should I attack?", "thinking");
    }
  }, [isNarrationEnabled, speakNarration]);

  const enterFunctionReadyState = useCallback((member, targetMode = "voice") => {
    const operator = member || dataRef.current.authenticatedMember;
    const operatorName = operator?.fullName || "Operator";
    const prompt = `How can I help you, ${operatorName}?`;

    setBootComplete(true);
    setBootPhase("function_ready");
    setAwaitingAuthInput(false);
    setAwaitingWebsiteInput(false);
    setAwaitingModulesInput(false);
    setSelectedTarget("");
    awaitingWebsiteInputRef.current = false;
    awaitingModulesInputRef.current = false;
    pendingAttackProfileRef.current = null;
    sequenceRunningRef.current = false;
    modeRef.current = targetMode;
    setInteractionMode(targetMode);
    setSubtitle(prompt);

    if (targetMode === "chat") {
      setOrbState("idle");
      setChatMessages((messages) => [
        ...messages.map((message) => (message.active ? { ...message, active: false } : message)),
        { id: Date.now(), role: "system", text: prompt }
      ]);
    } else if (isNarrationEnabled()) {
      setOrbState("speaking");
      void speakNarration(prompt, "idle");
    } else {
      setOrbState("idle");
    }
  }, [isNarrationEnabled, speakNarration]);

  const presentProjectIntroduction = useCallback(async () => {
    if (sequenceRunningRef.current) return;

    sequenceRunningRef.current = true;
    setOrbState("speaking");

    try {
      for (const [index, sentence] of projectIntroductionSentences.entries()) {
        setSubtitle(sentence);

        if (isNarrationEnabled()) {
          const finalState = index === projectIntroductionSentences.length - 1 ? "idle" : "speaking";
          await speakNarration(sentence, finalState);
        } else {
          await wait(2200);
        }
      }
    } finally {
      sequenceRunningRef.current = false;
      setOrbState("idle");
      const operatorName = dataRef.current.authenticatedMember?.fullName || "Operator";
      setSubtitle(`How can I help you, ${operatorName}?`);
    }
  }, [isNarrationEnabled, speakNarration]);

  const handleAuthSubmit = useCallback(
    async (phrase, source = "chat") => {
      if (!awaitingAuthInputRef.current || bootPhaseRef.current !== "auth_waiting") return;

      const trimmed = phrase.trim();
      if (!trimmed) return;

      setAwaitingAuthInput(false);
      setBootPhase("auth_verifying");
      sequenceRunningRef.current = true;

      if (source === "chat") {
        setChatMessages((messages) => [
          ...messages,
          { id: Date.now(), role: "operator", text: trimmed },
          { id: Date.now() + 1, role: "system", text: "Verifying operator identity signature.", active: true }
        ]);
      }

      await playDialogueStep(getVerificationStep(source), { speak: source !== "chat" });

      const { members, appConfig } = dataRef.current;
      const phraseRequired = appConfig?.authentication?.phraseRequired !== false;
      const fuzzy = appConfig?.voice?.fuzzyRecognition !== false;
      const retryLimit = Number(appConfig?.voice?.retryLimit) || 2;
      const welcomeByName = appConfig?.authentication?.welcomeMemberByName !== false;

      let member = null;
      if (phraseRequired) {
        member = matchMemberPhrase(trimmed, members, { fuzzy });
      }

      if (phraseRequired && !member) {
        authRetriesRef.current += 1;

        await playDialogueStep(getAuthFailureStep(), { speak: source !== "chat" });

        setChatMessages((messages) =>
          messages.map((message) => (message.active ? { ...message, active: false } : message)).concat({
            id: Date.now() + 2,
            role: "system",
            text:
              authRetriesRef.current < retryLimit
                ? `Authentication failed. Retry ${authRetriesRef.current} of ${retryLimit}.`
                : "Maximum authentication retries reached. Please contact the demo operator."
          })
        );

        if (authRetriesRef.current < retryLimit) {
          setBootPhase("auth_waiting");
          setAwaitingAuthInput(true);
          sequenceRunningRef.current = false;
          setOrbState("thinking");
          setSubtitle(`Awaiting operator ${source === "voice" ? "voice" : "chat"} input.`);

          return;
        }

        setBootPhase("auth_waiting");
        setAwaitingAuthInput(true);
        sequenceRunningRef.current = false;
        setOrbState("thinking");
        setSubtitle(`Awaiting operator ${source === "voice" ? "voice" : "chat"} input.`);

        return;
      }

      const resolvedMember = member || { fullName: "Operator" };
      dataRef.current.authenticatedMember = resolvedMember;
      setAuthenticatedMember(resolvedMember);

      if (welcomeByName) {
        await playDialogueStep(getAuthSuccessStep(resolvedMember.fullName), { speak: source !== "chat" });
      }

      enterFunctionReadyState(resolvedMember, source === "chat" ? "chat" : "voice");
    },
    [enterFunctionReadyState, playDialogueStep]
  );

  useEffect(() => {
    handleAuthSubmitRef.current = handleAuthSubmit;
  }, [handleAuthSubmit]);

  const executeScan = useCallback(async ({
    commandText,
    targetUrl,
    modules,
    source = "chat",
    memberName = ""
  }) => {
    const messageId = Date.now();
    const moduleLabels = modules.map(getModuleLabel);
    const moduleLabel = moduleLabels.join(", ");
    const stepIdBase = messageId + 100;

    if (source === "chat") {
      setChatMessages((messages) => [
        ...messages,
        { id: messageId, role: "operator", text: commandText },
        {
          id: messageId + 1,
          role: "system",
          text: `Attack accepted. Website: ${targetUrl}. Modules: ${moduleLabel}.`,
          active: true
        }
      ]);
    }
    setOrbState("thinking");
    setSubtitle(
      memberName
        ? `Attack target: ${targetUrl}. Script owner: ${memberName}.`
        : `Attack target: ${targetUrl}. Modules: ${moduleLabel}.`
    );
    if (source === "voice") {
      setVoiceTranscript(
        memberName
          ? `Attack ${targetUrl} using ${memberName}'s script.`
          : `Attack ${targetUrl} using ${moduleLabel}.`
      );
    }

    const steps = memberName
      ? [
          `Starting attack against ${targetUrl}.`,
          `Crawling ${targetUrl} and mapping application routes.`,
          `Executing the security script prepared by ${memberName}.`,
          `Analyzing responses and validating collected evidence.`,
          `${memberName}'s script found ${moduleLabel} on ${targetUrl}.`,
          `Preparing the final security report for ${targetUrl}.`
        ]
      : [
          `Preparing attack workspace for ${targetUrl}.`,
          `Loading attack modules: ${moduleLabel}.`,
          `Mapping application routes for ${targetUrl}.`,
          ...moduleLabels.map((label) => `Attacking ${targetUrl} with ${label}.`),
          `Validating attack evidence for ${targetUrl}.`,
          `Preparing security report for ${targetUrl}.`
        ];

    for (const [index, step] of steps.entries()) {
      const activeId = stepIdBase + index;
      if (source === "chat") {
        setChatMessages((messages) => [
          ...messages,
          { id: activeId, role: "system", text: step, active: true }
        ]);
      }
      setSubtitle(step);
      if (source !== "chat" && isNarrationEnabled()) {
        await speakNarration(step, "thinking");
        await wait(350);
      } else {
        await wait(randomDelay(scanDelayRange.min, scanDelayRange.max));
      }
      if (source === "chat") {
        setChatMessages((messages) =>
          messages.map((message) => (message.id === activeId ? { ...message, active: false } : message))
        );
      }
    }

    if (source === "chat") {
      setChatMessages((messages) =>
        messages.map((message) => (message.id === messageId + 1 ? { ...message, active: false } : message))
      );
    }
    const report = buildScanReport({ modules, targetUrl, memberName });
    setLatestReport(report);
    modeRef.current = "reports";
    setInteractionMode("reports");
    setSubtitle(`Report ready for ${targetUrl}.`);
    if (source !== "chat" && isNarrationEnabled()) {
      await speakNarration(`Report ready for ${targetUrl}.`, "idle");
    }
    if (source === "chat") {
      setChatMessages((messages) => [
        ...messages,
        { id: Date.now() + Math.random(), role: "system", text: `Report ready for ${targetUrl}.` }
      ]);
    }

    const operatorName = dataRef.current.authenticatedMember?.fullName || "Operator";
    const helpPrompt = `How can I help you, ${operatorName}?`;
    setBootPhase("function_ready");
    setSubtitle(helpPrompt);
    if (source === "chat") {
      setChatMessages((messages) => [
        ...messages,
        { id: Date.now() + Math.random(), role: "system", text: helpPrompt }
      ]);
      setOrbState("idle");
    } else if (isNarrationEnabled()) {
      await speakNarration(helpPrompt, "idle");
    } else {
      setOrbState("idle");
    }
  }, [isNarrationEnabled, scanDelayRange.max, scanDelayRange.min, speakNarration]);

  const handleWebsiteSubmit = useCallback(async (website, source = "chat") => {
    if (!awaitingWebsiteInputRef.current || bootPhaseRef.current !== "website_waiting") return;

    const targetUrl = normalizeTargetInput(website);
    if (!targetUrl) {
      setSubtitle("Website not recognized. Enter a hostname or URL.");
      return;
    }

    const attackProfile = pendingAttackProfileRef.current;

    setSelectedTarget(targetUrl);
    setAwaitingWebsiteInput(false);
    awaitingWebsiteInputRef.current = false;

    if (attackProfile) {
      setAwaitingModulesInput(false);
      setBootComplete(true);
      setBootPhase("attacking");
      sequenceRunningRef.current = true;

      const announcement = `Attack on ${targetUrl} is starting. ${attackProfile.memberName}'s script is ready.`;
      setSubtitle(announcement);
      if (source !== "chat" && isNarrationEnabled()) {
        await speakNarration(announcement, "thinking");
      }

      await executeScan({
        commandText: `Attack ${targetUrl} using ${attackProfile.vulnerability}`,
        targetUrl,
        modules: [attackProfile.moduleId],
        source,
        memberName: attackProfile.memberName
      });

      pendingAttackProfileRef.current = null;
      sequenceRunningRef.current = false;
      setBootPhase("function_ready");
      return;
    }

    setAwaitingModulesInput(true);
    setBootPhase("modules_waiting");
    setOrbState("thinking");
    setSubtitle(`Target accepted: ${targetUrl}. What modules should I run?`);
    if (source === "chat") {
      setChatMessages((messages) => [
        ...messages,
        { id: Date.now(), role: "operator", text: website.trim() },
        {
          id: Date.now() + 1,
          role: "system",
          text: `Target accepted: ${targetUrl}. Enter modules such as SQL, stored XSS, XXE, or all.`
        }
      ]);
    }
    if (source !== "chat" && isNarrationEnabled()) {
      void speakNarration(`Target accepted. What modules should I run?`, "thinking");
    }
  }, [executeScan, isNarrationEnabled, speakNarration]);

  const handleModulesSubmit = useCallback(async (moduleText, source = "chat") => {
    if (!awaitingModulesInputRef.current || bootPhaseRef.current !== "modules_waiting") return;

    const interpreted = interpretOperatorCommand(moduleText);
    const requestedAll = /\ball\b/i.test(moduleText);
    const modules = requestedAll
      ? scanModuleOptions.map((module) => module.id)
      : interpreted.modules.filter((moduleId) => moduleId !== "all");

    if (!modules.length) {
      setSubtitle("Modules not recognized. Try SQL, command, XSS, information, XXE, path, access, smuggling, WebSocket, or all.");
      return;
    }

    setAwaitingModulesInput(false);
    setBootComplete(true);
    setBootPhase("complete");
    sequenceRunningRef.current = true;
    await executeScan({
      commandText: moduleText.trim(),
      targetUrl: selectedTarget || defaultScanTarget,
      modules,
      source
    });
    sequenceRunningRef.current = false;
  }, [executeScan, selectedTarget]);

  const sendOperatorCommand = useCallback(async (prompt, source = "chat") => {
    if (!bootComplete) return;

    const commandText = prompt.trim();
    if (!commandText) return;

    const interpreted = interpretOperatorCommand(commandText);
    const modules = interpreted.modules.includes("all") ? selectedScanModules : interpreted.modules;
    await executeScan({
      commandText,
      targetUrl: selectedTarget || defaultScanTarget,
      modules,
      source
    });
  }, [bootComplete, executeScan, selectedScanModules, selectedTarget]);

  const submitChatPrompt = useCallback(
    (event) => {
      event.preventDefault();

      const prompt = chatDraft.trim();
      if (!prompt) return;

      if (awaitingAuthInput) {
        handleAuthSubmit(prompt, "chat");
        setChatDraft("");
        return;
      }

      if (awaitingWebsiteInput) {
        handleWebsiteSubmit(prompt, "chat");
        setChatDraft("");
        return;
      }

      if (awaitingModulesInput) {
        handleModulesSubmit(prompt, "chat");
        setChatDraft("");
        return;
      }

      sendOperatorCommand(prompt, "chat");
      setCommandHistory((history) => [prompt, ...history.filter((item) => item !== prompt)].slice(0, 30));
      setHistoryIndex(-1);
      setChatDraft("");
    },
    [
      awaitingAuthInput,
      awaitingModulesInput,
      awaitingWebsiteInput,
      chatDraft,
      handleAuthSubmit,
      handleModulesSubmit,
      handleWebsiteSubmit,
      sendOperatorCommand
    ]
  );

  const navigateCommandHistory = useCallback((direction) => {
    if (!commandHistory.length) return;

    setHistoryIndex((currentIndex) => {
      const nextIndex =
        direction === "up"
          ? Math.min(currentIndex + 1, commandHistory.length - 1)
          : Math.max(currentIndex - 1, -1);
      setChatDraft(nextIndex === -1 ? "" : commandHistory[nextIndex]);
      return nextIndex;
    });
  }, [commandHistory]);

  const stopVoiceInput = useCallback((stopRecognition = true) => {
    if (voiceTimeoutRef.current) {
      clearTimeout(voiceTimeoutRef.current);
      voiceTimeoutRef.current = null;
    }

    if (analyserFrameRef.current) {
      cancelAnimationFrame(analyserFrameRef.current);
      analyserFrameRef.current = null;
    }

    micStreamRef.current?.getTracks().forEach((track) => track.stop());
    micStreamRef.current = null;
    audioContextRef.current?.close();
    audioContextRef.current = null;
    if (stopRecognition) {
      recognitionRef.current?.stop();
    }
    recognitionRef.current = null;
    setIsListening(false);
    setVoiceLevel(0);
  }, []);

  const armVoiceTimeout = useCallback((timeoutMs = 10000) => {
    if (voiceTimeoutRef.current) {
      clearTimeout(voiceTimeoutRef.current);
    }

    voiceTimeoutRef.current = window.setTimeout(() => {
      const message = "No voice command detected. Stopped listening.";
      setVoiceError(message);
      setSubtitle(message);
      window.electronAPI?.stopNativeVoice?.();
      stopVoiceInput(false);
      setOrbState("idle");
    }, timeoutMs);
  }, [stopVoiceInput]);

  const changeSelectedMic = useCallback(
    (deviceId) => {
      stopVoiceInput();
      window.electronAPI?.stopNativeVoice?.();
      setSelectedMicId(deviceId);
      window.localStorage.setItem("anubis:selectedMicId", deviceId);
      const label = getMicLabel(audioInputDevices, deviceId);
      setSubtitle(`Microphone input changed: ${label}.`);
      setVoiceError("");
    },
    [audioInputDevices, stopVoiceInput]
  );

  const startAudioMeter = useCallback((stream) => {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;

    const audioContext = new AudioContext();
    const analyser = audioContext.createAnalyser();
    const source = audioContext.createMediaStreamSource(stream);
    const data = new Uint8Array(analyser.frequencyBinCount);

    analyser.fftSize = 256;
    source.connect(analyser);
    audioContextRef.current = audioContext;

    const tick = () => {
      analyser.getByteTimeDomainData(data);
      const peak = data.reduce((max, value) => Math.max(max, Math.abs(value - 128)), 0);
      setVoiceLevel(Math.min(100, Math.round((peak / 128) * 100)));
      analyserFrameRef.current = requestAnimationFrame(tick);
    };

    tick();
  }, []);

  const startVoiceCommand = useCallback(async () => {
    if (isListening || recognitionRef.current) {
      stopVoiceInput();
      window.electronAPI?.stopNativeVoice?.();
      return;
    }

    const authCapture = awaitingAuthInputRef.current && bootPhaseRef.current === "auth_waiting";
    const setupCapture =
      authCapture || awaitingWebsiteInputRef.current || awaitingModulesInputRef.current;
    const recordDurationMs = setupCapture ? 8000 : 6000;
    const listenTimeoutMs = setupCapture ? 25000 : 12000;

    let stream;
    try {
      stream = await acquireMicStream(selectedMicId);
    } catch {
      setSubtitle("Microphone permission denied or unavailable.");
      setVoiceError("Microphone permission denied or unavailable.");
      return;
    }

    const activeMicLabel = getMicLabel(audioInputDevices, selectedMicId);

    micStreamRef.current = stream;
    startAudioMeter(stream);

    setIsListening(true);
    setVoiceError("");
    setVoiceTranscript("");
    setOrbState("thinking");
    setSubtitle(
      authCapture
        ? `Listening on ${activeMicLabel}. Speak your authentication phrase.`
        : awaitingWebsiteInputRef.current
          ? `Listening on ${activeMicLabel}. State the website.`
          : awaitingModulesInputRef.current
            ? `Listening on ${activeMicLabel}. State the modules.`
        : `Listening on ${activeMicLabel}. Speak your command.`
    );
    armVoiceTimeout(listenTimeoutMs);

    if (hasNativeVoice()) {
      setSubtitle(`Recording ${recordDurationMs / 1000}s from ${activeMicLabel}...`);
      try {
        const wavBuffer = await recordWavFromStream(stream, recordDurationMs);
        if (voiceTimeoutRef.current) {
          clearTimeout(voiceTimeoutRef.current);
          voiceTimeoutRef.current = null;
        }
        setSubtitle(`Transcribing audio from ${activeMicLabel}.`);
        const result = await window.electronAPI.transcribeNativeVoice(wavBuffer);
        const transcriptPayload = result.payloads?.find((payload) => payload.type === "result");
        const errorPayload = result.payloads?.find((payload) => payload.type === "error");

        if (transcriptPayload?.text) {
          const text = transcriptPayload.text.trim();
          setVoiceTranscript(text);
          setSubtitle(`Understood: ${text}`);
          if (authCapture) {
            await handleAuthSubmitRef.current?.(text, "voice");
          } else if (awaitingWebsiteInputRef.current) {
            handleWebsiteSubmit(text, "voice");
          } else if (awaitingModulesInputRef.current) {
            await handleModulesSubmit(text, "voice");
          } else {
            sendOperatorCommand(text, "voice");
          }
        } else {
          const message = `Voice capture failed on ${activeMicLabel}: ${errorPayload?.message || result.stderr || "no speech detected"}. Try Settings to pick another microphone.`;
          setVoiceError(message);
          setSubtitle(message);
          setChatMessages((messages) => [
            ...messages,
            { id: Date.now() + Math.random(), role: "system", text: message }
          ]);
        }
      } catch (error) {
        const message = `Voice capture failed on ${activeMicLabel}: ${error.message || "recording failed"}.`;
        setVoiceError(message);
        setSubtitle(message);
      } finally {
        stopVoiceInput(false);
        if (!sequenceRunningRef.current) {
          setOrbState("idle");
        }
      }
      return;
    }

    const SpeechRecognition = getSpeechRecognition();
    if (!SpeechRecognition) {
      const message = "Speech recognition unavailable in this browser runtime.";
      setVoiceError(message);
      setSubtitle(message);
      stopVoiceInput();
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = "en-US";
    recognition.interimResults = true;
    recognition.continuous = false;
    recognitionRef.current = recognition;

    recognition.onresult = (event) => {
      let transcript = "";
      let finalTranscript = "";

      for (const result of event.results) {
        const text = result[0]?.transcript || "";
        transcript += text;
        if (result.isFinal) {
          finalTranscript += text;
        }
      }

      const cleanedTranscript = transcript.trim();
      setVoiceTranscript(cleanedTranscript);
      if (cleanedTranscript) {
        setSubtitle(`Heard: ${cleanedTranscript}`);
        armVoiceTimeout();
      }

      if (finalTranscript.trim()) {
        if (voiceTimeoutRef.current) {
          clearTimeout(voiceTimeoutRef.current);
          voiceTimeoutRef.current = null;
        }
        setSubtitle(`Understood: ${finalTranscript.trim()}`);
        if (authCapture) {
          handleAuthSubmitRef.current?.(finalTranscript.trim(), "voice");
        } else if (awaitingWebsiteInputRef.current) {
          handleWebsiteSubmit(finalTranscript.trim(), "voice");
        } else if (awaitingModulesInputRef.current) {
          handleModulesSubmit(finalTranscript.trim(), "voice");
        } else {
          sendOperatorCommand(finalTranscript.trim(), "voice");
        }
      }
    };

    recognition.onerror = (event) => {
      const message = formatVoiceError(event.error, event.message);
      console.error(message, event);
      setVoiceError(message);
      setSubtitle(message);
      setChatMessages((messages) => [
        ...messages,
        { id: Date.now() + Math.random(), role: "system", text: message }
      ]);
      setOrbState("idle");
      stopVoiceInput();
    };

    recognition.onend = () => {
      stopVoiceInput(false);
      if (!sequenceRunningRef.current) {
        setOrbState("idle");
      }
    };

    recognition.start();
  }, [
    armVoiceTimeout,
    audioInputDevices,
    handleModulesSubmit,
    handleWebsiteSubmit,
    isListening,
    selectedMicId,
    sendOperatorCommand,
    startAudioMeter,
    stopVoiceInput
  ]);

  useEffect(() => {
    startVoiceCommandRef.current = startVoiceCommand;
  }, [startVoiceCommand]);

  const handleVoicePrimaryAction = useCallback(() => {
    if (authenticatedMember && bootComplete && !sequenceRunningRef.current) {
      window.electronAPI?.stopNativeVoice?.();
      stopVoiceInput();
      stopSpeech();
      setAwaitingAuthInput(false);
      setAwaitingModulesInput(false);
      setSelectedTarget("");
      setVoiceTranscript("");
      setVoiceError("");
      modeRef.current = "voice";
      setInteractionMode("voice");
      enterFunctionReadyState(authenticatedMember);
      return;
    }

    startVoiceCommand();
  }, [authenticatedMember, bootComplete, enterFunctionReadyState, startVoiceCommand, stopVoiceInput]);

  const logoutOperator = useCallback(async (targetMode = "voice") => {
    if (!dataRef.current.authenticatedMember || sequenceRunningRef.current) return;

    sequenceRunningRef.current = true;
    window.electronAPI?.stopNativeVoice?.();
    stopVoiceInput();
    stopSpeech();

    dataRef.current.authenticatedMember = null;
    setAuthenticatedMember(null);
    setBootComplete(false);
    setAwaitingAuthInput(false);
    setAwaitingWebsiteInput(false);
    setAwaitingModulesInput(false);
    awaitingAuthInputRef.current = false;
    awaitingWebsiteInputRef.current = false;
    awaitingModulesInputRef.current = false;
    pendingAttackProfileRef.current = null;
    setSelectedTarget("");
    setVoiceTranscript("");
    setVoiceError("");
    modeRef.current = targetMode;
    setInteractionMode(targetMode);
    setBootPhase("auth_prompt");
    bootPhaseRef.current = "auth_prompt";

    const prompt =
      targetMode === "chat"
        ? "Please identify yourself using the chat authentication prompt."
        : "Please identify yourself using your assigned voice phrase.";
    setOrbState("speaking");
    setSubtitle(prompt);
    if (targetMode === "chat") {
      setOrbState("idle");
      setChatMessages((messages) => [
        ...messages,
        { id: Date.now(), role: "system", text: "Operator logged out. Please identify yourself in Chat." }
      ]);
    } else if (isNarrationEnabled()) {
      await speakNarration(prompt, "thinking");
    } else {
      await wait(1200);
    }

    setBootPhase("auth_waiting");
    bootPhaseRef.current = "auth_waiting";
    setAwaitingAuthInput(true);
    awaitingAuthInputRef.current = true;
    sequenceRunningRef.current = false;
    setOrbState("thinking");
    setSubtitle(`Awaiting operator ${targetMode === "chat" ? "chat" : "voice"} input.`);
  }, [isNarrationEnabled, speakNarration, stopVoiceInput]);

  const selectAttackProfile = useCallback(async (profile, profileKey, targetMode = "voice") => {
    if (!profile || bootPhaseRef.current !== "function_ready") return;

    if (targetMode === "voice") {
      stopSpeech();
    }
    pendingAttackProfileRef.current = profile;
    bootPhaseRef.current = "website_waiting";
    awaitingWebsiteInputRef.current = true;
    setBootComplete(false);
    setBootPhase("website_waiting");
    setAwaitingWebsiteInput(true);
    setAwaitingModulesInput(false);
    setSelectedTarget("");

    const prompt = `Attack profile ${profileKey} selected. What website should I attack?`;
    setSubtitle(prompt);
    if (targetMode === "chat") {
      setOrbState("thinking");
      setChatMessages((messages) => [
        ...messages,
        { id: Date.now(), role: "system", text: prompt }
      ]);
    } else {
      setOrbState("speaking");
      if (isNarrationEnabled()) {
        await speakNarration(prompt, "thinking");
      } else {
        setOrbState("thinking");
      }
    }
  }, [isNarrationEnabled, speakNarration]);

  const handleChatFunctionKey = useCallback((key) => {
    const normalizedKey = String(key || "").toLowerCase();

    if (
      awaitingAuthInputRef.current &&
      bootPhaseRef.current === "auth_waiting" &&
      authOperatorKeys[normalizedKey]
    ) {
      void handleAuthSubmit(authOperatorKeys[normalizedKey], "chat");
      return true;
    }

    if (
      normalizedKey === "l" &&
      dataRef.current.authenticatedMember &&
      !sequenceRunningRef.current
    ) {
      void logoutOperator("chat");
      return true;
    }

    const profile = digitAttackProfiles[normalizedKey];
    if (
      profile &&
      bootPhaseRef.current === "function_ready" &&
      dataRef.current.authenticatedMember
    ) {
      void selectAttackProfile(profile, normalizedKey, "chat");
      return true;
    }

    return false;
  }, [handleAuthSubmit, logoutOperator, selectAttackProfile]);

  const loadProjectData = useCallback(async () => {
    try {
      const registry = await loadProjectRegistry();

      dataRef.current = {
        members: registry.members,
        scenarios: registry.scenarios,
        appConfig: registry.appConfig,
        authenticatedMember: null
      };

      console.log("Registry loaded:", dataRef.current);
    } catch (error) {
      console.error("Data loading error:", error);
      setSubtitle("Warning: failed to load ANUBIS data registry.");
    }
  }, []);

  const playCinematicWord = useCallback(async (word, hold = 1000) => {
    if (skipIntroRef.current) return;

    setIntroWordPhase("");
    setIntroWord(word);
    await wait(20);
    setIntroWordPhase("show");
    await wait(hold);
    setIntroWordPhase("hide");
    await wait(700);
  }, []);

  const playCinematicIntro = useCallback(async () => {
    setIntroActive(true);
    setIntroFading(false);
    setAppHidden(true);
    skipIntroRef.current = false;

    const delayBeforeStart = Number(dataRef.current.appConfig?.intro?.delayBeforeStartMs) || 400;
    await wait(delayBeforeStart);

    if (skipIntroRef.current) {
      setIntroActive(false);
      setIntroFading(false);
      setAppHidden(false);
      return;
    }

    for (const word of INTRO_WORDS) {
      if (skipIntroRef.current) break;
      await playCinematicWord(word, 1100);
      await wait(180);
    }

    setIntroFading(true);
    await wait(skipIntroRef.current ? 0 : 900);

    setIntroActive(false);
    setIntroFading(false);
    setAppHidden(false);
  }, [playCinematicWord]);

  const startAuthenticationPhase = useCallback(async () => {
    const appConfig = dataRef.current.appConfig || {};
    const authEnabled = appConfig.authentication?.enabled !== false;

    if (!authEnabled) {
      const operator = { fullName: "Operator" };
      dataRef.current.authenticatedMember = operator;
      setAuthenticatedMember(operator);
      enterFunctionReadyState(operator);
      return;
    }

    setBootPhase("auth_prompt");
    for (const step of getAuthPromptSteps(modeRef.current)) {
      await playDialogueStep(step, { speak: modeRef.current !== "chat" });
    }

    setBootPhase("auth_waiting");
    setAwaitingAuthInput(true);
    sequenceRunningRef.current = false;
    setOrbState("thinking");
    setSubtitle(`Awaiting operator ${modeRef.current === "voice" ? "voice" : "chat"} input.`);

    if (modeRef.current === "chat") {
      setChatMessages((messages) => [
        ...messages,
        {
          id: Date.now(),
          role: "system",
          text: "Enter your assigned authentication phrase in the chat prompt below."
        }
      ]);
    }
  }, [enterFunctionReadyState, playDialogueStep]);

  const runFullBootSequence = useCallback(async () => {
    if (sequenceRunningRef.current) return;
    sequenceRunningRef.current = true;
    bootAbortRef.current = false;
    authRetriesRef.current = 0;

    setBootPhase("loading");
    setBootComplete(false);
    setAwaitingAuthInput(false);
    setAwaitingWebsiteInput(false);
    setAwaitingModulesInput(false);
    setSelectedTarget("");
    setAuthenticatedMember(null);
    setOrbState("idle");
    setSubtitle("Boot sequence started.");

    await loadProjectData();
    if (bootAbortRef.current) return;

    const appConfig = dataRef.current.appConfig || {};
    const introEnabled = appConfig.intro?.enabled !== false;
    const autoPlayIntro = appConfig.intro?.autoPlayOnLaunch !== false;

    if (introEnabled && autoPlayIntro) {
      setBootPhase("cinematic_words");
      await playCinematicIntro();
    } else {
      setAppHidden(false);
    }

    if (bootAbortRef.current) return;

    setBootPhase("boot_narration");
    for (const step of BOOT_NARRATION) {
      await playDialogueStep(step, { speak: true });
    }

    if (bootAbortRef.current) return;

    await startAuthenticationPhase();
  }, [loadProjectData, playCinematicIntro, playDialogueStep, startAuthenticationPhase]);

  useEffect(() => {
    if (!awaitingAuthInput || bootPhase !== "auth_waiting") return;
    setSubtitle(`Awaiting operator ${interactionMode === "voice" ? "voice" : "chat"} input.`);
  }, [awaitingAuthInput, bootPhase, interactionMode]);

  useEffect(() => {
    let mounted = true;

    async function boot() {
      if (!mounted) return;
      await runFullBootSequence();
    }

    boot();

    return () => {
      mounted = false;
      bootAbortRef.current = true;
    };
  }, [runFullBootSequence]);

  useEffect(() => {
    ensureVoicesLoaded();
  }, []);

  useEffect(() => {
    return () => {
      window.electronAPI?.stopNativeVoice?.();
      stopSpeech();
      stopVoiceInput();
    };
  }, [stopVoiceInput]);

  useEffect(() => {
    if (typeof window.electronAPI?.onNativeVoiceEvent !== "function") return undefined;

    return window.electronAPI.onNativeVoiceEvent((payload) => {
      if (payload.type === "partial") {
        const text = payload.text || "";
        setVoiceTranscript(text);
        if (text.trim()) {
          setSubtitle(
            awaitingAuthInputRef.current
              ? `Hearing authentication phrase: ${text.trim()}`
              : `Hearing: ${text.trim()}`
          );
          armVoiceTimeout();
        }
        return;
      }

      if (payload.type === "result") {
        const text = payload.text || "";
        setVoiceTranscript(text);
        if (text.trim()) {
          if (voiceTimeoutRef.current) {
            clearTimeout(voiceTimeoutRef.current);
            voiceTimeoutRef.current = null;
          }
          setSubtitle(`Understood: ${text.trim()}`);
          if (awaitingAuthInputRef.current && bootPhaseRef.current === "auth_waiting") {
            handleAuthSubmitRef.current?.(text.trim(), "voice");
          } else if (awaitingWebsiteInputRef.current) {
            handleWebsiteSubmit(text.trim(), "voice");
          } else if (awaitingModulesInputRef.current) {
            handleModulesSubmit(text.trim(), "voice");
          } else if (bootCompleteRef.current) {
            sendOperatorCommand(text.trim(), "voice");
          }
        }
        window.electronAPI?.stopNativeVoice?.();
        stopVoiceInput(false);
        return;
      }

      if (payload.type === "listening" || payload.type === "starting") {
        setIsListening(true);
        setVoiceError("");
        setSubtitle(
          awaitingAuthInputRef.current
            ? "Windows speech recognizer listening for authentication phrase."
            : "Windows speech recognizer listening."
        );
        armVoiceTimeout();
        return;
      }

      if (payload.type === "error") {
        const message = `Native voice failed: ${payload.message || "unknown error"}.`;
        console.error(message, payload);
        setVoiceError(message);
        setSubtitle(message);
        setChatMessages((messages) => [
          ...messages,
          { id: Date.now() + Math.random(), role: "system", text: message }
        ]);
        stopVoiceInput(false);
        setOrbState("idle");
        return;
      }

      if (payload.type === "stopped") {
        stopVoiceInput(false);
        if (!sequenceRunningRef.current) {
          setOrbState("idle");
        }
      }
    });
  }, [armVoiceTimeout, handleModulesSubmit, handleWebsiteSubmit, sendOperatorCommand, stopVoiceInput]);

  useEffect(() => {
    const onKeyDown = async (event) => {
      const targetTag = event.target?.tagName?.toLowerCase();
      const isTextInput = targetTag === "input" || targetTag === "textarea";
      const key = event.key.toLowerCase();
      const shortcutsEnabled = dataRef.current.appConfig?.testing?.keyboardShortcutsEnabled !== false;

      if (!shortcutsEnabled) return;

      if (event.ctrlKey && event.shiftKey && key === "i" && introActive) {
        event.preventDefault();
        skipIntroRef.current = true;
        setIntroActive(false);
        setIntroFading(false);
        setAppHidden(false);
        return;
      }

      if (event.key === "Escape") {
        event.preventDefault();
        closeWindow();
        return;
      }

      if (modeRef.current !== "voice") return;

      if (
        key === "l" &&
        !event.ctrlKey &&
        !event.altKey &&
        !event.metaKey &&
        !isTextInput &&
        dataRef.current.authenticatedMember
      ) {
        event.preventDefault();
        await logoutOperator();
        return;
      }

      const authOperator = authOperatorKeys[key];
      if (
        authOperator &&
        !event.ctrlKey &&
        !event.altKey &&
        !event.metaKey &&
        !isTextInput &&
        awaitingAuthInputRef.current &&
        bootPhaseRef.current === "auth_waiting"
      ) {
        event.preventDefault();
        await handleAuthSubmit(authOperator, "keybind");
        return;
      }

      if (
        event.key === "ArrowUp" &&
        bootPhaseRef.current === "function_ready" &&
        dataRef.current.authenticatedMember
      ) {
        event.preventDefault();
        stopSpeech();
        await presentProjectIntroduction();
        return;
      }

      const attackProfile = digitAttackProfiles[event.key];
      if (
        attackProfile &&
        !isTextInput &&
        bootPhaseRef.current === "function_ready" &&
        dataRef.current.authenticatedMember
      ) {
        event.preventDefault();
        await selectAttackProfile(attackProfile, event.key, "voice");
        return;
      }

      if (event.ctrlKey && event.code === "Space") {
        event.preventDefault();
        const demoConfig = dataRef.current.appConfig?.testing || {};

        if (awaitingAuthInputRef.current) {
          const phrase =
            demoConfig.demoAuthPhrase ||
            dataRef.current.members[0]?.displayPhrase ||
            dataRef.current.members[0]?.fullName;
          if (phrase) await handleAuthSubmit(phrase, "keybind");
          return;
        }

        if (awaitingWebsiteInputRef.current) {
          await handleWebsiteSubmit(demoConfig.demoWebsite || defaultScanTarget, "keybind");
          return;
        }

        if (awaitingModulesInputRef.current) {
          const moduleText = selectedScanModules.map(getModuleLabel).join(", ");
          await handleModulesSubmit(moduleText, "keybind");
        }
        return;
      }

      if (event.ctrlKey && key === "a" && !isTextInput) {
        event.preventDefault();
        modeRef.current = "voice";
        setInteractionMode("voice");
        startVoiceCommand();
        return;
      }

      if (key === "t" && modeRef.current === "voice" && bootComplete) {
        event.preventDefault();
        setOrbState("thinking");
        setSubtitle("Manual thinking state activated.");
      }

      if (key === "s" && modeRef.current === "voice" && bootComplete) {
        event.preventDefault();
        setOrbState("speaking");
        setSubtitle("Manual speaking state activated.");
      }

      if (key === "d" && modeRef.current === "voice" && bootComplete) {
        event.preventDefault();
        setOrbState("idle");
        setSubtitle("Manual idle state activated.");
      }

    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [
    bootComplete,
    closeWindow,
    handleAuthSubmit,
    handleModulesSubmit,
    handleWebsiteSubmit,
    introActive,
    logoutOperator,
    presentProjectIntroduction,
    selectedScanModules,
    selectAttackProfile,
    startVoiceCommand
  ]);

  return (
    <>
      <CinematicIntro active={introActive} fading={introFading} word={introWord} phase={introWordPhase} />
      <AppShell
        hidden={appHidden}
        bootComplete={bootComplete}
        awaitingAuthInput={awaitingAuthInput}
        awaitingWebsiteInput={awaitingWebsiteInput}
        awaitingModulesInput={awaitingModulesInput}
        authenticatedMember={authenticatedMember}
        audioInputDevices={audioInputDevices}
        orbState={orbState}
        selectedMicId={selectedMicId}
        selectedScanModules={selectedScanModules}
        scanDelayRange={scanDelayRange}
        interactionMode={interactionMode}
        latestReport={latestReport}
        chatDraft={chatDraft}
        chatMessages={chatMessages}
        commandHistory={commandHistory}
        historyIndex={historyIndex}
        subtitle={subtitle}
        isListening={isListening}
        voiceLevel={voiceLevel}
        voiceError={voiceError}
        voiceTranscript={voiceTranscript}
        voiceMuted={voiceMuted}
        voiceVolume={voiceVolume}
        onChatDraftChange={setChatDraft}
        onChatFunctionKey={handleChatFunctionKey}
        onCommandHistoryNavigate={navigateCommandHistory}
        onChatPromptSubmit={submitChatPrompt}
        onChangeInteractionMode={changeInteractionMode}
        onMicChange={changeSelectedMic}
        onMicRefresh={refreshAudioInputDevices}
        onModuleToggle={toggleScanModule}
        onScanDelayRangeChange={changeScanDelayRange}
        onVoiceMuteToggle={() => setVoiceMuted((muted) => !muted)}
        onVoiceVolumeChange={setVoiceVolume}
        onClose={closeWindow}
        onMaximize={maximizeWindow}
        onMinimize={minimizeWindow}
        onVoiceCommandStart={handleVoicePrimaryAction}
      />
    </>
  );
}

function CinematicIntro({ active, fading, word, phase }) {
  return (
    <div
      className={[
        "fixed inset-0 z-[10000] flex items-center justify-center bg-[radial-gradient(circle_at_center,rgba(152,104,255,.34)_0%,rgba(143,81,255,.18)_14%,rgba(10,6,30,.94)_42%,#02030a_100%)] transition-[opacity,visibility] duration-700",
        active && !fading ? "visible opacity-100" : "invisible opacity-0"
      ].join(" ")}
    >
      <div
        className={[
          "text-center text-[clamp(48px,7vw,92px)] font-bold uppercase tracking-[.28em] text-white opacity-0 [text-shadow:0_0_10px_rgba(255,255,255,.2),0_0_30px_rgba(177,126,255,.35),0_0_60px_rgba(177,126,255,.18)]",
          phase === "show" ? "animate-cinematicWordIn" : "",
          phase === "hide" ? "animate-cinematicWordOut" : ""
        ].join(" ")}
      >
        {word}
      </div>
    </div>
  );
}

function AppShell({
  hidden,
  bootComplete,
  awaitingAuthInput,
  awaitingWebsiteInput,
  awaitingModulesInput,
  authenticatedMember,
  audioInputDevices,
  chatDraft,
  chatMessages,
  commandHistory,
  historyIndex,
  interactionMode,
  latestReport,
  isListening,
  orbState,
  selectedMicId,
  selectedScanModules,
  scanDelayRange,
  subtitle,
  voiceTranscript,
  voiceLevel,
  voiceError,
  voiceMuted,
  voiceVolume,
  onChatDraftChange,
  onChatFunctionKey,
  onCommandHistoryNavigate,
  onChatPromptSubmit,
  onChangeInteractionMode,
  onMicChange,
  onMicRefresh,
  onModuleToggle,
  onScanDelayRangeChange,
  onVoiceMuteToggle,
  onVoiceVolumeChange,
  onClose,
  onMaximize,
  onMinimize,
  onVoiceCommandStart
}) {
  return (
    <div
      className={[
        "relative h-full w-full overflow-hidden bg-[radial-gradient(circle_at_center,rgba(155,108,255,.09)_0%,rgba(155,108,255,.04)_18%,transparent_42%),radial-gradient(circle_at_center,rgba(196,166,255,.04)_0%,transparent_58%),linear-gradient(180deg,#04030b_0%,#02020a_100%)] transition-opacity duration-700",
        hidden ? "pointer-events-none opacity-0" : "opacity-100"
      ].join(" ")}
    >
      <div className="absolute right-7 top-[22px] z-[9999] flex items-center gap-2">
        <WindowControlButton label="Minimize application" onClick={onMinimize}>
          -
        </WindowControlButton>
        <WindowControlButton label="Maximize application" onClick={onMaximize}>
          □
        </WindowControlButton>
        <WindowControlButton label="Close application" onClick={onClose} danger>
          &times;
        </WindowControlButton>
      </div>

      <ModeToggle
        mode={interactionMode}
        bootComplete={bootComplete}
        setupActive={awaitingAuthInput || awaitingWebsiteInput || awaitingModulesInput}
        onChange={onChangeInteractionMode}
      />

      <BackgroundLayer />

      <main className="relative z-[2] grid h-full w-full grid-rows-[1fr_auto] px-[4vw] pb-[3vh] pt-[4vh]">
        <div className="min-h-0 overflow-hidden">
        {interactionMode === "settings" ? (
          <SettingsPage
            audioInputDevices={audioInputDevices}
            selectedMicId={selectedMicId}
            selectedScanModules={selectedScanModules}
            scanDelayRange={scanDelayRange}
            subtitle={subtitle}
            onMicChange={onMicChange}
            onMicRefresh={onMicRefresh}
            onModuleToggle={onModuleToggle}
            onScanDelayRangeChange={onScanDelayRangeChange}
          />
        ) : interactionMode === "reports" ? (
          <ReportsPage report={latestReport} />
        ) : interactionMode === "chat" ? (
          <ChatPage
            draft={chatDraft}
            messages={chatMessages}
            commandHistory={commandHistory}
            historyIndex={historyIndex}
            subtitle={subtitle}
            awaitingAuthInput={awaitingAuthInput}
            awaitingWebsiteInput={awaitingWebsiteInput}
            awaitingModulesInput={awaitingModulesInput}
            onDraftChange={onChatDraftChange}
            onFunctionKey={onChatFunctionKey}
            onHistoryNavigate={onCommandHistoryNavigate}
            onSubmit={onChatPromptSubmit}
          />
        ) : (
          <VoicePage
            isListening={isListening}
            orbState={orbState}
            voiceLevel={voiceLevel}
            voiceError={voiceError}
            voiceMuted={voiceMuted}
            voiceVolume={voiceVolume}
            awaitingAuthInput={awaitingAuthInput}
            awaitingWebsiteInput={awaitingWebsiteInput}
            awaitingModulesInput={awaitingModulesInput}
            bootComplete={bootComplete}
            authenticatedMember={authenticatedMember}
            onVoiceMuteToggle={onVoiceMuteToggle}
            onVoiceVolumeChange={onVoiceVolumeChange}
            onVoiceCommandStart={onVoiceCommandStart}
          />
        )}
        </div>
        <Subtitle text={subtitle} />
      </main>
    </div>
  );
}

function SettingsPage({
  audioInputDevices,
  selectedMicId,
  selectedScanModules,
  scanDelayRange,
  subtitle,
  onMicChange,
  onMicRefresh,
  onModuleToggle,
  onScanDelayRangeChange
}) {
  useEffect(() => {
    onMicRefresh();
  }, [onMicRefresh]);

  return (
    <div className="mx-auto flex h-full w-[min(760px,92vw)] flex-col gap-5 pt-24">
      <header className="border-b border-anubis-violet/15 pb-4">
        <div className="text-xs font-semibold uppercase tracking-[.28em] text-anubis-faint">ANUBIS SETTINGS</div>
        <div className="mt-2 text-lg font-semibold tracking-[.08em] text-anubis-text">Input devices</div>
      </header>

      <section className="rounded-lg border border-anubis-violet/15 bg-[#080512]/55 p-5 shadow-panel backdrop-blur">
        <div className="mb-3 text-xs font-semibold uppercase tracking-[.2em] text-anubis-faint">Microphone</div>
        <div className="flex gap-3">
          <select
            value={selectedMicId}
            onChange={(event) => onMicChange(event.target.value)}
            className="h-11 flex-1 rounded-md border border-white/10 bg-[#05030c]/90 px-3 text-sm text-anubis-text outline-none focus:border-anubis-bright/45 focus:ring-2 focus:ring-anubis-violet/20"
          >
            {audioInputDevices.length ? (
              audioInputDevices.map((device, index) => (
                <option key={device.deviceId} value={device.deviceId}>
                  {device.label || `Microphone ${index + 1}`}
                </option>
              ))
            ) : (
              <option value="">No microphone detected</option>
            )}
          </select>
          <button
            type="button"
            onClick={onMicRefresh}
            className="min-w-[118px] rounded-md border border-anubis-bright/25 bg-anubis-violet/20 px-4 text-xs font-semibold uppercase tracking-[.18em] text-anubis-text transition hover:bg-anubis-violet/30 hover:text-white"
          >
            Refresh
          </button>
        </div>
        <div className="mt-4 text-xs leading-relaxed tracking-[.08em] text-anubis-faint">{subtitle}</div>
      </section>

      <section className="rounded-lg border border-anubis-violet/15 bg-[#080512]/55 p-5 shadow-panel backdrop-blur">
        <div className="mb-3 text-xs font-semibold uppercase tracking-[.2em] text-anubis-faint">Scan modules</div>
        <div className="grid grid-cols-2 gap-3">
          {scanModuleOptions.map((module) => {
            const active = selectedScanModules.includes(module.id);

            return (
              <button
                key={module.id}
                type="button"
                onClick={() => onModuleToggle(module.id)}
                aria-pressed={active}
                className={[
                  "rounded-md border px-4 py-3 text-left text-xs font-semibold uppercase tracking-[.14em] transition",
                  active
                    ? "border-anubis-bright/35 bg-anubis-violet/20 text-anubis-text"
                    : "border-white/10 bg-white/[.03] text-anubis-faint hover:border-anubis-violet/25 hover:text-anubis-bright"
                ].join(" ")}
              >
                {module.label}
              </button>
            );
          })}
        </div>
      </section>

      <section className="rounded-lg border border-anubis-violet/15 bg-[#080512]/55 p-5 shadow-panel backdrop-blur">
        <div className="mb-3 text-xs font-semibold uppercase tracking-[.2em] text-anubis-faint">Step delay</div>
        <div className="grid grid-cols-2 gap-3">
          <label className="flex flex-col gap-2 text-xs font-semibold uppercase tracking-[.14em] text-anubis-faint">
            Min ms
            <input
              type="number"
              min="500"
              max="30000"
              step="100"
              value={scanDelayRange.min}
              onChange={(event) => onScanDelayRangeChange("min", event.target.value)}
              className="h-11 rounded-md border border-white/10 bg-[#05030c]/90 px-3 text-sm text-anubis-text outline-none focus:border-anubis-bright/45 focus:ring-2 focus:ring-anubis-violet/20"
            />
          </label>
          <label className="flex flex-col gap-2 text-xs font-semibold uppercase tracking-[.14em] text-anubis-faint">
            Max ms
            <input
              type="number"
              min="500"
              max="30000"
              step="100"
              value={scanDelayRange.max}
              onChange={(event) => onScanDelayRangeChange("max", event.target.value)}
              className="h-11 rounded-md border border-white/10 bg-[#05030c]/90 px-3 text-sm text-anubis-text outline-none focus:border-anubis-bright/45 focus:ring-2 focus:ring-anubis-violet/20"
            />
          </label>
        </div>
      </section>
    </div>
  );
}

function VoicePage({
  isListening,
  orbState,
  voiceLevel,
  voiceError,
  voiceMuted,
  voiceVolume,
  awaitingAuthInput,
  awaitingWebsiteInput,
  awaitingModulesInput,
  bootComplete,
  authenticatedMember,
  onVoiceCommandStart,
  onVoiceMuteToggle,
  onVoiceVolumeChange
}) {
  const showMicWarning = isListening && voiceLevel < 3;

  return (
    <div className="grid h-full w-full grid-rows-[1fr_auto] place-items-center">
      <section className="mb-[2vh] flex min-h-[120px] items-center justify-center self-end" />
      <Orb state={orbState} />
      <div className="mt-1 flex w-[min(640px,90vw)] flex-col items-center gap-3">
        <div className="flex flex-wrap items-center justify-center gap-3">
          <button
            type="button"
            onClick={onVoiceCommandStart}
            className={[
              "flex h-10 items-center rounded-full border px-5 text-xs font-semibold uppercase tracking-[.2em] transition",
              isListening
                ? "border-anubis-bright/40 bg-anubis-violet/25 text-white"
                : "border-anubis-violet/20 bg-[#120a23]/40 text-anubis-muted hover:bg-anubis-violet/15 hover:text-anubis-bright"
            ].join(" ")}
          >
            <Mic className="mr-2 h-4 w-4" aria-hidden="true" />
            {isListening
              ? "Listening"
              : awaitingAuthInput
                ? "Auth phrase"
                : awaitingWebsiteInput
                  ? "Website"
                  : awaitingModulesInput
                    ? "Modules"
                    : authenticatedMember && bootComplete
                      ? "Start again"
                      : "Voice command"}
          </button>
          <div className="group relative">
            <button
              type="button"
              onClick={onVoiceMuteToggle}
              aria-pressed={voiceMuted}
              aria-label={voiceMuted ? "Unmute voice" : "Mute voice"}
              title={voiceMuted ? "Unmute voice" : "Mute voice"}
              className={[
                "flex h-10 w-10 items-center justify-center rounded-full border transition",
                voiceMuted
                  ? "border-red-300/30 bg-red-500/10 text-red-100"
                  : "border-anubis-violet/20 bg-[#120a23]/40 text-anubis-muted hover:bg-anubis-violet/15 hover:text-anubis-bright"
              ].join(" ")}
            >
              {voiceMuted || voiceVolume === 0 ? (
                <VolumeX className="h-4 w-4" aria-hidden="true" />
              ) : (
                <Volume2 className="h-4 w-4" aria-hidden="true" />
              )}
            </button>
            <div className="pointer-events-none absolute bottom-12 left-1/2 flex h-40 w-12 -translate-x-1/2 flex-col items-center justify-center rounded-full border border-anubis-violet/20 bg-[#080512]/95 py-4 opacity-0 shadow-panel backdrop-blur transition delay-500 duration-200 group-hover:pointer-events-auto group-hover:opacity-100 group-hover:delay-0 group-focus-within:pointer-events-auto group-focus-within:opacity-100 group-focus-within:delay-0">
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={voiceVolume}
                onChange={(event) => onVoiceVolumeChange(Number(event.target.value))}
                aria-label="Voice volume level"
                className="vertical-volume h-28 accent-anubis-bright"
              />
            </div>
          </div>
        </div>
        {authenticatedMember ? (
          <div className="text-center text-xs uppercase tracking-[.16em] text-anubis-faint">
            Operator: {authenticatedMember.fullName}
          </div>
        ) : null}
        {voiceError ? (
          <div className="max-w-full rounded-md border border-red-300/20 bg-red-500/10 px-3 py-2 text-center text-xs leading-relaxed text-red-100">
            {voiceError}
          </div>
        ) : null}
        {showMicWarning ? (
          <div className="max-w-full rounded-md border border-yellow-300/20 bg-yellow-500/10 px-3 py-2 text-center text-xs leading-relaxed text-yellow-100">
            No audio detected. Open the Settings tab to choose your microphone.
          </div>
        ) : null}
        <div className="h-2 w-full overflow-hidden rounded-full bg-white/10">
          <div
            className="h-full rounded-full bg-anubis-bright transition-[width]"
            style={{ width: `${voiceLevel}%` }}
          />
        </div>
      </div>
    </div>
  );
}

function ChatPage({
  commandHistory,
  draft,
  historyIndex,
  messages,
  subtitle,
  awaitingAuthInput,
  awaitingWebsiteInput,
  awaitingModulesInput,
  onDraftChange,
  onFunctionKey,
  onHistoryNavigate,
  onSubmit
}) {
  const messagesEndRef = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages]);

  const handlePromptKeyDown = (event) => {
    if (
      !draft.trim() &&
      !event.ctrlKey &&
      !event.altKey &&
      !event.metaKey &&
      onFunctionKey(event.key)
    ) {
      event.preventDefault();
      return;
    }

    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      onSubmit(event);
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      onHistoryNavigate("up");
      return;
    }

    if (event.key === "ArrowDown") {
      event.preventDefault();
      onHistoryNavigate("down");
    }
  };

  return (
    <div className="mx-auto grid h-full w-[min(920px,92vw)] grid-rows-[auto_1fr_auto] gap-5 pt-20">
      <header className="flex items-center justify-between border-b border-anubis-violet/15 pb-4">
        <div>
          <div className="text-xs font-semibold uppercase tracking-[.28em] text-anubis-faint">ANUBIS CHAT</div>
          <div className="mt-2 text-lg font-semibold tracking-[.08em] text-anubis-text">Operator prompt console</div>
        </div>
      </header>

      <section className="chat-scrollbar min-h-0 overflow-y-auto rounded-lg border border-anubis-violet/15 bg-[#080512]/55 p-4 shadow-panel backdrop-blur">
        <div className="flex flex-col gap-3">
          {messages.map((message) => (
            <div
              key={message.id}
              className={[
                "max-w-[82%] rounded-lg border px-4 py-3 text-sm leading-relaxed",
                message.role === "operator"
                  ? "ml-auto border-anubis-bright/25 bg-anubis-violet/15 text-anubis-text"
                  : "border-white/10 bg-white/[.04] text-anubis-muted"
              ].join(" ")}
            >
              <div className="mb-1 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[.2em] text-anubis-faint">
                {message.active ? <span className="scan-spinner" aria-hidden="true" /> : null}
                <span>{message.role}</span>
              </div>
              {message.text}
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>
      </section>

      <form onSubmit={onSubmit} className="rounded-lg border border-anubis-violet/20 bg-[#100a1e]/60 p-3 shadow-panel backdrop-blur">
        <label htmlFor="chatPrompt" className="sr-only">
          Chat prompt
        </label>
        <div className="flex gap-3">
          <textarea
            id="chatPrompt"
            value={draft}
            onChange={(event) => onDraftChange(event.target.value)}
            onKeyDown={handlePromptKeyDown}
            placeholder={
              awaitingAuthInput
                ? "Enter your assigned authentication phrase..."
                : awaitingWebsiteInput
                  ? "Enter website hostname or URL..."
                  : awaitingModulesInput
                    ? "Enter modules: SQL, stored XSS, XXE, all..."
                    : "Enter prompt or text..."
            }
            rows={2}
            className="min-h-[52px] flex-1 resize-none rounded-md border border-white/10 bg-[#05030c]/80 px-4 py-2 text-sm leading-relaxed text-anubis-text outline-none transition placeholder:text-anubis-faint focus:border-anubis-bright/45 focus:ring-2 focus:ring-anubis-violet/20"
          />
          <button
            type="submit"
            className="min-w-[116px] rounded-md border border-anubis-bright/25 bg-anubis-violet/20 px-5 text-xs font-semibold uppercase tracking-[.2em] text-anubis-text transition hover:bg-anubis-violet/30 hover:text-white"
          >
            {awaitingAuthInput ? "Authenticate" : awaitingWebsiteInput ? "Set target" : awaitingModulesInput ? "Run modules" : "Send"}
          </button>
        </div>
        <div className="mt-3 flex items-center justify-between gap-3 text-xs tracking-[.12em] text-anubis-faint">
          <span>{subtitle}</span>
          <span>
            {commandHistory.length
              ? `History ${historyIndex >= 0 ? historyIndex + 1 : 0}/${commandHistory.length}`
              : "History empty"}
          </span>
        </div>
      </form>
    </div>
  );
}

function formatReportTime(value) {
  if (!value) return "Unknown";
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
}

function formatEvidenceValue(value) {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value;
  return JSON.stringify(value, null, 2);
}

function SeverityBadge({ severity }) {
  const normalized = String(severity || "info").toLowerCase();
  const className = {
    critical: "border-red-300/30 bg-red-500/15 text-red-100",
    high: "border-orange-300/30 bg-orange-500/15 text-orange-100",
    medium: "border-yellow-300/30 bg-yellow-500/15 text-yellow-100",
    low: "border-emerald-300/30 bg-emerald-500/15 text-emerald-100",
    info: "border-anubis-bright/25 bg-anubis-violet/15 text-anubis-bright"
  }[normalized] || "border-anubis-bright/25 bg-anubis-violet/15 text-anubis-bright";

  return (
    <span className={["rounded-full border px-3 py-1 text-[10px] font-semibold uppercase tracking-[.18em]", className].join(" ")}>
      {normalized}
    </span>
  );
}

function ReportsPage({ report }) {
  const findings = report?.confirmed_findings || [];

  return (
    <div className="mx-auto grid h-full w-[min(1040px,94vw)] grid-rows-[auto_auto_1fr] gap-5 pt-20">
      <header className="flex items-end justify-between border-b border-anubis-violet/15 pb-4">
        <div>
          <div className="text-xs font-semibold uppercase tracking-[.28em] text-anubis-faint">ANUBIS REPORTS</div>
          <div className="mt-2 text-lg font-semibold tracking-[.08em] text-anubis-text">Final attack report</div>
        </div>
        {report ? (
          <div className="text-right text-xs uppercase tracking-[.16em] text-anubis-faint">{formatReportTime(report.timestamp)}</div>
        ) : null}
      </header>

      {report ? (
        <>
          <section className="grid grid-cols-5 gap-3">
            <ReportMetric label="Target" value={report.target} />
            <ReportMetric label="Assigned member" value={report.assigned_member || "General"} />
            <ReportMetric label="Requests" value={report.captured_request_count} />
            <ReportMetric label="Findings" value={findings.length} />
            <ReportMetric label="Modules" value={report.modules?.join(", ") || "None"} />
          </section>

          <section className="chat-scrollbar min-h-0 overflow-y-auto rounded-lg border border-anubis-violet/15 bg-[#080512]/55 p-4 shadow-panel backdrop-blur">
            {findings.length ? (
              <div className="flex flex-col gap-4">
                {findings.map((finding, index) => (
                  <article key={`${finding.name}-${index}`} className="rounded-lg border border-white/10 bg-white/[.04] p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <div className="text-base font-semibold tracking-[.04em] text-anubis-text">{finding.name}</div>
                        <div className="mt-1 text-xs uppercase tracking-[.14em] text-anubis-faint">
                          {finding.type} / {finding.assigned_member || "General"} / {finding.matched_at}
                        </div>
                      </div>
                      <SeverityBadge severity={finding.severity} />
                    </div>

                    {finding.evidence ? (
                      <div className="mt-4 grid gap-3">
                        {Object.entries(finding.evidence).map(([key, value]) => (
                          <div key={key} className="rounded-md border border-white/10 bg-[#05030c]/70 p-3">
                            <div className="mb-2 text-[10px] font-semibold uppercase tracking-[.18em] text-anubis-faint">
                              {key.replaceAll("_", " ")}
                            </div>
                            <pre className="whitespace-pre-wrap break-words text-xs leading-relaxed text-anubis-muted">
                              {formatEvidenceValue(value)}
                            </pre>
                          </div>
                        ))}
                      </div>
                    ) : null}
                  </article>
                ))}
              </div>
            ) : (
              <div className="flex h-full min-h-[260px] items-center justify-center text-sm uppercase tracking-[.18em] text-anubis-faint">
                No confirmed vulnerabilities.
              </div>
            )}
          </section>
        </>
      ) : (
        <section className="flex min-h-[420px] items-center justify-center rounded-lg border border-anubis-violet/15 bg-[#080512]/55 p-6 text-center text-sm uppercase tracking-[.18em] text-anubis-faint shadow-panel backdrop-blur">
          No report available.
        </section>
      )}
    </div>
  );
}

function ReportMetric({ label, value }) {
  return (
    <div className="min-h-[92px] rounded-lg border border-anubis-violet/15 bg-[#080512]/55 p-4 shadow-panel backdrop-blur">
      <div className="text-[10px] font-semibold uppercase tracking-[.2em] text-anubis-faint">{label}</div>
      <div className="mt-3 break-words text-sm font-semibold tracking-[.04em] text-anubis-text">{value}</div>
    </div>
  );
}

function ModeToggle({ mode, bootComplete, setupActive, onChange }) {
  return (
    <div className="absolute left-7 top-[22px] z-[9999] flex rounded-full border border-anubis-violet/20 bg-[#120a23]/30 p-1 backdrop-blur">
      {["voice", "chat", "reports", "settings"].map((item) => {
        const active = mode === item;
        const locked =
          (!bootComplete && item === "reports") ||
          (!bootComplete && item === "settings" && !setupActive);

        return (
          <button
            key={item}
            type="button"
            onClick={() => onChange(item)}
            disabled={locked}
            aria-pressed={active}
            aria-disabled={locked}
            title={locked ? "Complete authentication to unlock this mode." : item}
            className={[
              "h-9 min-w-[82px] rounded-full px-4 text-xs font-semibold uppercase tracking-[.18em] transition",
              locked ? "cursor-not-allowed opacity-35" : "",
              active
                ? "bg-anubis-violet/25 text-anubis-text shadow-[0_0_18px_rgba(155,108,255,.16)]"
                : "text-anubis-faint hover:bg-anubis-violet/10 hover:text-anubis-bright"
            ].join(" ")}
          >
            {item}
          </button>
        );
      })}
    </div>
  );
}

function WindowControlButton({ children, danger = false, label, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className={[
        "flex h-[42px] w-[42px] items-center justify-center rounded-full border border-white/10 bg-[#120a23]/30 text-xl leading-none text-anubis-faint backdrop-blur transition hover:scale-105 hover:border-anubis-bright/30 hover:bg-anubis-violet/10 hover:text-anubis-bright",
        danger ? "hover:border-red-300/40 hover:bg-red-500/10 hover:text-red-200" : ""
      ].join(" ")}
    >
      {children}
    </button>
  );
}

function BackgroundLayer() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(155,108,255,.1)_0%,rgba(155,108,255,.04)_18%,transparent_45%),radial-gradient(circle_at_center,rgba(196,166,255,.08)_0%,transparent_60%)] opacity-95 blur-lg" />
      <div className="absolute inset-0 bg-[linear-gradient(rgba(155,108,255,.02)_1px,transparent_1px),linear-gradient(90deg,rgba(155,108,255,.02)_1px,transparent_1px)] bg-[size:80px_80px] opacity-50 [mask-image:radial-gradient(circle_at_center,black_20%,transparent_75%)]" />
      <div className="particles absolute inset-0" />
    </div>
  );
}

function Orb({ state }) {
  const stateClass = {
    idle: "",
    thinking: "scale-[.985]",
    speaking: "scale-[1.03]"
  }[state];

  const coreClass = {
    idle: "animate-orbIdle shadow-orb",
    thinking:
      "animate-orbThinking [box-shadow:inset_-18px_-24px_46px_rgba(155,108,255,.18),inset_18px_16px_32px_rgba(255,255,255,.1),0_0_38px_rgba(155,108,255,.3),0_0_100px_rgba(155,108,255,.22),0_0_200px_rgba(155,108,255,.16)]",
    speaking:
      "animate-orbSpeaking [box-shadow:inset_-18px_-24px_50px_rgba(196,166,255,.18),inset_18px_16px_36px_rgba(255,255,255,.12),0_0_42px_rgba(196,166,255,.34),0_0_120px_rgba(155,108,255,.28),0_0_230px_rgba(155,108,255,.2)]"
  }[state];

  return (
    <section className="flex min-h-[420px] flex-col items-center justify-center gap-7">
      <div
        className={[
          "relative flex h-[260px] w-[260px] items-center justify-center transition-[transform,filter] duration-700",
          stateClass
        ].join(" ")}
      >
        <div className="absolute h-[380px] w-[380px] animate-slowPulse rounded-full border border-anubis-violet/10 shadow-[0_0_44px_rgba(155,108,255,.08)]" />
        <div className="absolute h-[315px] w-[315px] animate-slowPulseReverse rounded-full border border-anubis-violet/10 shadow-[0_0_44px_rgba(155,108,255,.08)]" />
        <div
          className={[
            "orb-core relative h-[260px] w-[260px] overflow-hidden rounded-full bg-[radial-gradient(circle_at_38%_32%,rgba(255,255,255,.96)_0%,rgba(228,214,255,.9)_10%,rgba(196,166,255,.62)_24%,rgba(155,108,255,.34)_42%,rgba(68,33,125,.44)_60%,rgba(12,7,24,.88)_100%),linear-gradient(135deg,rgba(196,166,255,.22),rgba(14,8,26,.18))]",
            coreClass
          ].join(" ")}
        >
          <div className="absolute left-[20%] top-[18%] h-[42%] w-[42%] rounded-full bg-[radial-gradient(circle,rgba(255,255,255,.6)_0%,rgba(255,255,255,.08)_58%,transparent_75%)] blur-xl" />
          <div className="absolute inset-[18%] rounded-full bg-[radial-gradient(circle,rgba(196,166,255,.18)_0%,transparent_70%)] blur-2xl" />
        </div>
      </div>

      <div className="min-w-[120px] text-center text-sm uppercase tracking-[.35em] text-anubis-muted [text-shadow:0_0_14px_rgba(155,108,255,.18)]">
        {state}
      </div>
    </section>
  );
}

function Subtitle({ text }) {
  return (
    <section className="flex w-full justify-center pb-[1vh] pt-[1.5vh]" aria-live="polite" aria-atomic="true">
      <div className="flex h-[84px] w-[min(860px,92vw)] items-center justify-center overflow-hidden rounded-full border border-anubis-violet/25 bg-[linear-gradient(180deg,rgba(16,10,30,.72),rgba(10,6,22,.48))] px-8 py-3 shadow-[0_0_32px_rgba(155,108,255,.12)] backdrop-blur-md">
        <p className="overflow-hidden text-center text-[clamp(14px,1vw,18px)] font-medium leading-snug tracking-[.03em] text-anubis-text [display:-webkit-box] [-webkit-box-orient:vertical] [-webkit-line-clamp:2] [text-shadow:0_0_18px_rgba(196,166,255,.16)]">
          {text}
        </p>
      </div>
    </section>
  );
}

createRoot(document.getElementById("root")).render(<App />);
