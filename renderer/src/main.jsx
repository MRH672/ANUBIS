import React, { useCallback, useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";

const introWords = ["WELCOME", "TO", "ANUBIS"];

const introMessages = [
  { state: "speaking", text: "WELCOME TO ANUBIS.", delay: 2200 },
  { state: "thinking", text: "Loading scenario registry and target systems.", delay: 2200 },
  { state: "speaking", text: "I am ANUBIS.", delay: 1800 },
  { state: "speaking", text: "System standby. Awaiting operator authentication.", delay: 2200 },
  { state: "idle", text: "ANUBIS is online.", delay: 1500 }
];

const dataPathCandidates = {
  machines: ["../../data/machines.json", "/data/machines.json", "../data/machines.json"],
  scenarios: ["../../data/scenarios.json", "/data/scenarios.json", "../data/scenarios.json"]
};

const scanTarget = "shopnest.com";
const scanModuleOptions = [
  { id: "sqli", label: "SQL Injection" },
  { id: "xss", label: "XSS" },
  { id: "osci", label: "Command Injection" },
  { id: "xml", label: "XXE" },
  { id: "path", label: "Path Traversal" },
  { id: "access", label: "Access Control" },
  { id: "websocket", label: "WebSocket" }
];

const moduleAliases = [
  ["sql injection", "sqli"],
  ["sqli", "sqli"],
  ["sql", "sqli"],
  ["cross site scripting", "xss"],
  ["cross-site scripting", "xss"],
  ["xss", "xss"],
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
    xss: {
      severity: "medium",
      name: "Reflected Input Rendering",
      matched_at: `https://${targetUrl}/search?q=operator`,
      type: "xss",
      evidence: {
        parameter: "q",
        response: "Search term rendered without output encoding in page content."
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

function buildScanReport({ modules, targetUrl }) {
  const uniqueModules = modules.includes("all") ? scanModuleOptions.map((module) => module.id) : modules;

  return {
    target: targetUrl,
    captured_request_count: 24 + uniqueModules.length * 7,
    modules: uniqueModules.map((moduleId) => getModuleLabel(moduleId)),
    confirmed_findings: uniqueModules.map((moduleId) => buildFinding(moduleId, targetUrl)),
    warnings: [],
    timestamp: new Date().toISOString()
  };
}

async function loadJsonFile(paths) {
  let lastError;

  for (const path of paths) {
    try {
      const response = await fetch(path);
      if (response.ok) return response.json();
      lastError = new Error(`Failed to load ${path} - ${response.status}`);
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError;
}

function pickFirstActive(items) {
  return items.find((item) => item.active) || null;
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

  return {
    command: text,
    target_url: scanTarget,
    modules: modules.length ? modules : ["all"]
  };
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
    return saved ? JSON.parse(saved) : ["xss"];
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
  const dataRef = useRef({ selectedScenario: null, selectedMachine: null });
  const modeRef = useRef("voice");
  const audioContextRef = useRef(null);
  const analyserFrameRef = useRef(null);
  const micStreamRef = useRef(null);
  const recognitionRef = useRef(null);
  const sequenceRunningRef = useRef(false);
  const voiceTimeoutRef = useRef(null);
  const voiceMutedRef = useRef(voiceMuted);
  const voiceVolumeRef = useRef(voiceVolume);

  useEffect(() => {
    voiceMutedRef.current = voiceMuted;
    window.localStorage.setItem("anubis:voiceMuted", String(voiceMuted));
    if (voiceMuted) {
      window.speechSynthesis?.cancel();
    }
  }, [voiceMuted]);

  useEffect(() => {
    voiceVolumeRef.current = voiceVolume;
    window.localStorage.setItem("anubis:voiceVolume", String(voiceVolume));
  }, [voiceVolume]);

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
    modeRef.current = mode;
    setInteractionMode(mode);

    if (!sequenceRunningRef.current) {
      setOrbState("idle");
      const label = mode === "voice" ? "Voice" : mode === "chat" ? "Chat" : mode === "reports" ? "Reports" : "Settings";
      setSubtitle(`${label} mode active.`);
    }
  }, []);

  const refreshAudioInputDevices = useCallback(async () => {
    if (!navigator.mediaDevices?.enumerateDevices) {
      setSubtitle("Audio device enumeration unavailable.");
      return;
    }

    try {
      const permissionStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      permissionStream.getTracks().forEach((track) => track.stop());
    } catch (error) {
      const message = formatVoiceError(error.name || "microphone", error.message);
      console.error(message, error);
      setVoiceError(message);
      setSubtitle(message);
      return;
    }

    const devices = await navigator.mediaDevices.enumerateDevices();
    const inputs = devices.filter((device) => device.kind === "audioinput");
    setAudioInputDevices(inputs);

    if (inputs.length && !inputs.some((device) => device.deviceId === selectedMicId)) {
      setSelectedMicId(inputs[0].deviceId);
      window.localStorage.setItem("anubis:selectedMicId", inputs[0].deviceId);
    }

    setSubtitle(inputs.length ? "Microphone devices refreshed." : "No microphone input devices found.");
  }, [selectedMicId]);

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

  const speakVoiceStep = useCallback((text) => {
    if (voiceMutedRef.current || !window.speechSynthesis) return;

    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "en-US";
    utterance.rate = 0.92;
    utterance.pitch = 0.85;
    utterance.volume = voiceVolumeRef.current;
    window.speechSynthesis.speak(utterance);
  }, []);

  const sendOperatorCommand = useCallback(async (prompt, source = "chat") => {
    const commandText = prompt.trim();
    if (!commandText) return;

    const interpreted = interpretOperatorCommand(commandText);
    const targetUrl = scanTarget;
    const modules = selectedScanModules.length ? selectedScanModules : interpreted.modules;
    const messageId = Date.now();
    const moduleLabels = modules.map(getModuleLabel);
    const moduleLabel = moduleLabels.join(", ");
    const stepIdBase = messageId + 100;

    setChatMessages((messages) => [
      ...messages,
      { id: messageId, role: "operator", text: commandText },
      {
        id: messageId + 1,
        role: "system",
        text: `Accepted ${source} command. Target: ${targetUrl}. Modules: ${moduleLabel}.`,
        active: true
      }
    ]);
    setOrbState("thinking");
    setSubtitle(`Target: ${targetUrl}. Modules: ${moduleLabel}.`);
    if (source === "voice") {
      speakVoiceStep(`Accepted command. Target ${targetUrl}. Modules ${moduleLabel}.`);
    }

    const steps = [
      `Preparing scan workspace for ${targetUrl}.`,
      `Loading modules: ${moduleLabel}.`,
      `Crawling target application routes for ${targetUrl}.`,
      ...moduleLabels.map((label) => `Test ${label} on ${targetUrl}.`),
      `Validating collected evidence for ${targetUrl}.`,
      `Preparing operator summary for ${targetUrl}.`
    ];

    for (const [index, step] of steps.entries()) {
      const activeId = stepIdBase + index;
      setChatMessages((messages) => [
        ...messages,
        { id: activeId, role: "system", text: step, active: true }
      ]);
      setSubtitle(step);
      if (source === "voice") {
        speakVoiceStep(step);
      }
      await wait(randomDelay(scanDelayRange.min, scanDelayRange.max));
      setChatMessages((messages) =>
        messages.map((message) => (message.id === activeId ? { ...message, active: false } : message))
      );
    }

    setChatMessages((messages) =>
      messages.map((message) => (message.id === messageId + 1 ? { ...message, active: false } : message))
    );
    const report = buildScanReport({ modules, targetUrl });
    setLatestReport(report);
    modeRef.current = "reports";
    setInteractionMode("reports");
    setSubtitle(`Report ready for ${targetUrl}.`);
    if (source === "voice") {
      speakVoiceStep(`Report ready for ${targetUrl}.`);
    }
    setChatMessages((messages) => [
      ...messages,
      { id: Date.now() + Math.random(), role: "system", text: `Report ready for ${targetUrl}.` }
    ]);
    setOrbState("idle");
  }, [scanDelayRange.max, scanDelayRange.min, selectedScanModules, speakVoiceStep]);

  const submitChatPrompt = useCallback((event) => {
    event.preventDefault();

    const prompt = chatDraft.trim();
    if (!prompt) return;

    sendOperatorCommand(prompt, "chat");
    setCommandHistory((history) => [prompt, ...history.filter((item) => item !== prompt)].slice(0, 30));
    setHistoryIndex(-1);
    setChatDraft("");
  }, [chatDraft, sendOperatorCommand]);

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

  const armVoiceTimeout = useCallback(() => {
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
    }, 10000);
  }, [stopVoiceInput]);

  const changeSelectedMic = useCallback((deviceId) => {
    stopVoiceInput();
    setSelectedMicId(deviceId);
    window.localStorage.setItem("anubis:selectedMicId", deviceId);
    setSubtitle("Microphone input changed.");
  }, [stopVoiceInput]);

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
      if (hasNativeVoice()) {
        window.electronAPI.stopNativeVoice();
      }
      return;
    }

    let stream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: selectedMicId ? { deviceId: { exact: selectedMicId } } : true
      });
    } catch {
      setSubtitle("Microphone permission denied or unavailable.");
      return;
    }

    micStreamRef.current = stream;
    startAudioMeter(stream);

    setIsListening(true);
    setVoiceError("");
    setVoiceTranscript("");
    setOrbState("thinking");
    setSubtitle("Listening for operator command.");
    armVoiceTimeout();

    if (hasNativeVoice()) {
      setSubtitle("Recording selected microphone for 6 seconds.");
      try {
        const wavBuffer = await recordWavFromStream(stream, 6000);
        if (voiceTimeoutRef.current) {
          clearTimeout(voiceTimeoutRef.current);
          voiceTimeoutRef.current = null;
        }
        setSubtitle("Transcribing selected microphone recording.");
        const result = await window.electronAPI.transcribeNativeVoice(wavBuffer);
        const transcriptPayload = result.payloads?.find((payload) => payload.type === "result");
        const errorPayload = result.payloads?.find((payload) => payload.type === "error");

        if (transcriptPayload?.text) {
          const text = transcriptPayload.text.trim();
          setVoiceTranscript(text);
          setSubtitle(`Understood: ${text}`);
          sendOperatorCommand(text, "voice");
        } else {
          const message = `Native voice failed: ${errorPayload?.message || result.stderr || "no speech captured from selected microphone"}.`;
          setVoiceError(message);
          setSubtitle(message);
          setChatMessages((messages) => [
            ...messages,
            { id: Date.now() + Math.random(), role: "system", text: message }
          ]);
        }
      } catch (error) {
        const message = `Native voice failed: ${error.message || "selected microphone recording failed"}.`;
        setVoiceError(message);
        setSubtitle(message);
      } finally {
        stopVoiceInput(false);
        setOrbState("idle");
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
        sendOperatorCommand(finalTranscript.trim(), "voice");
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
  }, [armVoiceTimeout, isListening, selectedMicId, sendOperatorCommand, startAudioMeter, stopVoiceInput]);

  const loadProjectData = useCallback(async () => {
    try {
      const [machinesData, scenariosData] = await Promise.all([
        loadJsonFile(dataPathCandidates.machines),
        loadJsonFile(dataPathCandidates.scenarios)
      ]);

      const machines = Array.isArray(machinesData.machines)
        ? machinesData.machines.filter((item) => item.active)
        : [];
      const scenarios = Array.isArray(scenariosData.scenarios)
        ? scenariosData.scenarios.filter((item) => item.active)
        : [];

      dataRef.current = {
        selectedScenario: pickFirstActive(scenarios),
        selectedMachine: pickFirstActive(machines)
      };

      console.log("Machines loaded:", machines);
      console.log("Scenarios loaded:", scenarios);
      console.log("Selected scenario:", dataRef.current.selectedScenario);
      console.log("Selected machine:", dataRef.current.selectedMachine);
    } catch (error) {
      console.error("Data loading error:", error);
      setSubtitle("Warning: failed to load ANUBIS data registry.");
    }
  }, []);

  const playCinematicWord = useCallback(async (word, hold = 1000) => {
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

    await wait(400);

    for (const word of introWords) {
      await playCinematicWord(word, 1100);
      await wait(180);
    }

    setIntroFading(true);
    await wait(900);

    setIntroActive(false);
    setIntroFading(false);
    setAppHidden(false);
  }, [playCinematicWord]);

  const playIntroSequence = useCallback(async () => {
    if (sequenceRunningRef.current) return;
    sequenceRunningRef.current = true;

    for (const step of introMessages) {
      setOrbState(step.state);
      setSubtitle(step.text);
      await wait(step.delay);
    }

    const { selectedScenario, selectedMachine } = dataRef.current;

    if (selectedScenario) {
      setOrbState("speaking");
      setSubtitle(`Scenario registry online: ${selectedScenario.displayName} [${selectedScenario.shortCode}].`);
      await wait(2300);

      setOrbState("thinking");
      setSubtitle(`Category: ${selectedScenario.category}. Severity: ${selectedScenario.severity}.`);
      await wait(2200);

      setOrbState("speaking");
      setSubtitle(`Scenario owner assigned: ${selectedScenario.defaultOwner}.`);
      await wait(2200);
    }

    if (selectedMachine) {
      setOrbState("speaking");
      setSubtitle(`Target registry online: ${selectedMachine.displayName} [${selectedMachine.shortCode}].`);
      await wait(2300);

      setOrbState("thinking");
      setSubtitle(`Environment: ${selectedMachine.environment}. Platform: ${selectedMachine.platform}.`);
      await wait(2200);
    }

    setOrbState("idle");
    setSubtitle(`${modeRef.current === "voice" ? "Voice" : "Chat"} mode ready.`);
    sequenceRunningRef.current = false;
  }, []);

  const playAuthenticationFlow = useCallback(async () => {
    if (sequenceRunningRef.current) return;
    sequenceRunningRef.current = true;

    setOrbState("speaking");
    setSubtitle("Operator authentication sequence initiated.");
    await wait(2200);

    setOrbState("speaking");
    setSubtitle(
      modeRef.current === "voice"
        ? "Please identify yourself using your assigned voice phrase."
        : "Please identify yourself using the chat authentication prompt."
    );
    await wait(2400);

    setOrbState("thinking");
    setSubtitle(`Awaiting operator ${modeRef.current === "voice" ? "voice" : "chat"} input.`);
    await wait(1800);

    setOrbState("speaking");
    setSubtitle(`${modeRef.current === "voice" ? "Voice" : "Chat"} identity pattern received. Verifying operator signature.`);
    await wait(2400);

    setOrbState("speaking");
    setSubtitle("Authentication successful. Welcome, Hassan Hesham.");
    await wait(2400);

    const { selectedScenario, selectedMachine } = dataRef.current;

    if (selectedScenario) {
      setOrbState("speaking");
      setSubtitle(`Scenario received. ${selectedScenario.voiceName} selected.`);
      await wait(2400);

      setOrbState("thinking");
      setSubtitle(`Scenario code ${selectedScenario.shortCode}. Assigned owner: ${selectedScenario.defaultOwner}.`);
      await wait(2400);
    } else {
      setOrbState("speaking");
      setSubtitle("No active scenario available.");
      await wait(2200);
    }

    if (selectedMachine) {
      setOrbState("speaking");
      setSubtitle(`Target received. ${selectedMachine.voiceName} selected.`);
      await wait(2400);

      setOrbState("thinking");
      setSubtitle(`Target environment: ${selectedMachine.environment}. Severity profile: ${selectedMachine.severity}.`);
      await wait(2400);
    } else {
      setOrbState("speaking");
      setSubtitle("No active target machine available.");
      await wait(2200);
    }

    setOrbState("speaking");
    setSubtitle("Preparing execution flow. Please stand by.");
    await wait(2400);

    setOrbState("idle");
    setSubtitle(`Sequence complete. Awaiting ${modeRef.current === "voice" ? "voice" : "chat"} authentication.`);
    sequenceRunningRef.current = false;
  }, []);

  useEffect(() => {
    let mounted = true;

    async function boot() {
      setOrbState("idle");
      setSubtitle("Boot sequence started.");
      await loadProjectData();
      if (!mounted) return;
      await playCinematicIntro();
      if (!mounted) return;
      await wait(300);
      if (!mounted) return;
      setOrbState("idle");
      setSubtitle(`${modeRef.current === "voice" ? "Voice" : "Chat"} mode ready.`);
    }

    boot();

    return () => {
      mounted = false;
    };
  }, [loadProjectData, playCinematicIntro, playIntroSequence]);

  useEffect(() => {
    return () => {
      window.electronAPI?.stopNativeVoice?.();
      window.speechSynthesis?.cancel();
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
          setSubtitle(`Hearing: ${text.trim()}`);
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
          sendOperatorCommand(text.trim(), "voice");
        }
        window.electronAPI?.stopNativeVoice?.();
        stopVoiceInput(false);
        return;
      }

      if (payload.type === "listening" || payload.type === "starting") {
        setIsListening(true);
        setVoiceError("");
        setSubtitle("Windows speech recognizer listening.");
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
  }, [armVoiceTimeout, sendOperatorCommand, stopVoiceInput]);

  useEffect(() => {
    const onKeyDown = async (event) => {
      const targetTag = event.target?.tagName?.toLowerCase();
      const isTextInput = targetTag === "input" || targetTag === "textarea";
      const key = event.key.toLowerCase();

      if (event.ctrlKey && key === "a" && !isTextInput) {
        event.preventDefault();
        modeRef.current = "voice";
        setInteractionMode("voice");
        startVoiceCommand();
        return;
      }

      if (key === "t" && modeRef.current === "voice") {
        event.preventDefault();
        setOrbState("thinking");
        setSubtitle("Manual thinking state activated.");
      }

      if (key === "s" && modeRef.current === "voice") {
        event.preventDefault();
        setOrbState("speaking");
        setSubtitle("Manual speaking state activated.");
      }

      if (key === "d" && modeRef.current === "voice") {
        event.preventDefault();
        setOrbState("idle");
        setSubtitle("Manual idle state activated.");
      }

      if (event.key === "Escape") {
        event.preventDefault();
        closeWindow();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [closeWindow, playAuthenticationFlow, playCinematicIntro, playIntroSequence, startVoiceCommand]);

  return (
    <>
      <CinematicIntro active={introActive} fading={introFading} word={introWord} phase={introWordPhase} />
      <AppShell
        hidden={appHidden}
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
        onVoiceCommandStart={startVoiceCommand}
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

      <ModeToggle mode={interactionMode} onChange={onChangeInteractionMode} />

      <BackgroundLayer />

      <main className="relative z-[2] h-full w-full px-[4vw] pb-[5vh] pt-[4vh]">
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
            onDraftChange={onChatDraftChange}
            onHistoryNavigate={onCommandHistoryNavigate}
            onSubmit={onChatPromptSubmit}
          />
        ) : (
          <VoicePage
            isListening={isListening}
            orbState={orbState}
            subtitle={subtitle}
            transcript={voiceTranscript}
            voiceLevel={voiceLevel}
            voiceError={voiceError}
            voiceMuted={voiceMuted}
            voiceVolume={voiceVolume}
            onVoiceMuteToggle={onVoiceMuteToggle}
            onVoiceVolumeChange={onVoiceVolumeChange}
            onVoiceCommandStart={onVoiceCommandStart}
          />
        )}
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
  subtitle,
  transcript,
  voiceLevel,
  voiceError,
  voiceMuted,
  voiceVolume,
  onVoiceCommandStart,
  onVoiceMuteToggle,
  onVoiceVolumeChange
}) {
  return (
    <div className="grid h-full w-full grid-rows-[1fr_auto_auto] place-items-center">
      <section className="mb-[2vh] flex min-h-[120px] items-center justify-center self-end" />
      <Orb state={orbState} />
      <div className="mt-1 flex w-[min(640px,90vw)] flex-col items-center gap-3">
        <div className="flex flex-wrap items-center justify-center gap-3">
          <button
            type="button"
            onClick={onVoiceCommandStart}
            className={[
              "h-10 rounded-full border px-5 text-xs font-semibold uppercase tracking-[.2em] transition",
              isListening
                ? "border-anubis-bright/40 bg-anubis-violet/25 text-white"
                : "border-anubis-violet/20 bg-[#120a23]/40 text-anubis-muted hover:bg-anubis-violet/15 hover:text-anubis-bright"
            ].join(" ")}
          >
            {isListening ? "Listening" : "Voice command"}
          </button>
          <button
            type="button"
            onClick={onVoiceMuteToggle}
            aria-pressed={voiceMuted}
            className={[
              "h-10 rounded-full border px-5 text-xs font-semibold uppercase tracking-[.2em] transition",
              voiceMuted
                ? "border-red-300/30 bg-red-500/10 text-red-100"
                : "border-anubis-bright/25 bg-anubis-violet/20 text-anubis-text hover:bg-anubis-violet/30 hover:text-white"
            ].join(" ")}
          >
            {voiceMuted ? "Muted" : "Voice on"}
          </button>
        </div>
        <label className="flex w-full items-center gap-3 rounded-lg border border-anubis-violet/15 bg-[#080512]/55 px-4 py-3 text-xs font-semibold uppercase tracking-[.16em] text-anubis-faint shadow-panel">
          Volume
          <input
            type="range"
            min="0"
            max="1"
            step="0.05"
            value={voiceVolume}
            onChange={(event) => onVoiceVolumeChange(Number(event.target.value))}
            className="h-2 flex-1 accent-anubis-bright"
          />
          <span className="w-10 text-right text-anubis-text">{Math.round(voiceVolume * 100)}%</span>
        </label>
        <div className="flex min-h-[58px] w-full items-center justify-center rounded-lg border border-anubis-violet/15 bg-[#080512]/55 px-4 py-3 text-center text-sm leading-relaxed text-anubis-text shadow-panel">
          {transcript || (isListening ? "Listening..." : "Awaiting voice command.")}
        </div>
        {voiceError ? (
          <div className="max-w-full rounded-md border border-red-300/20 bg-red-500/10 px-3 py-2 text-center text-xs leading-relaxed text-red-100">
            {voiceError}
          </div>
        ) : null}
        <div className="h-2 w-full overflow-hidden rounded-full bg-white/10">
          <div
            className="h-full rounded-full bg-anubis-bright transition-[width]"
            style={{ width: `${voiceLevel}%` }}
          />
        </div>
      </div>
      <Subtitle text={subtitle} />
    </div>
  );
}

function ChatPage({
  commandHistory,
  draft,
  historyIndex,
  messages,
  subtitle,
  onDraftChange,
  onHistoryNavigate,
  onSubmit
}) {
  const messagesEndRef = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages]);

  const handlePromptKeyDown = (event) => {
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
            placeholder="Enter prompt or text..."
            rows={2}
            className="min-h-[52px] flex-1 resize-none rounded-md border border-white/10 bg-[#05030c]/80 px-4 py-2 text-sm leading-relaxed text-anubis-text outline-none transition placeholder:text-anubis-faint focus:border-anubis-bright/45 focus:ring-2 focus:ring-anubis-violet/20"
          />
          <button
            type="submit"
            className="min-w-[116px] rounded-md border border-anubis-bright/25 bg-anubis-violet/20 px-5 text-xs font-semibold uppercase tracking-[.2em] text-anubis-text transition hover:bg-anubis-violet/30 hover:text-white"
          >
            Send
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
          <div className="mt-2 text-lg font-semibold tracking-[.08em] text-anubis-text">Final scan report</div>
        </div>
        {report ? (
          <div className="text-right text-xs uppercase tracking-[.16em] text-anubis-faint">{formatReportTime(report.timestamp)}</div>
        ) : null}
      </header>

      {report ? (
        <>
          <section className="grid grid-cols-4 gap-3">
            <ReportMetric label="Target" value={report.target} />
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
                          {finding.type} / {finding.matched_at}
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

function ModeToggle({ mode, onChange }) {
  return (
    <div className="absolute left-7 top-[22px] z-[9999] flex rounded-full border border-anubis-violet/20 bg-[#120a23]/30 p-1 backdrop-blur">
      {["voice", "chat", "reports", "settings"].map((item) => {
        const active = mode === item;

        return (
          <button
            key={item}
            type="button"
            onClick={() => onChange(item)}
            aria-pressed={active}
            className={[
              "h-9 min-w-[82px] rounded-full px-4 text-xs font-semibold uppercase tracking-[.18em] transition",
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
    <section className="mt-[2.5vh] flex w-full justify-center self-start" aria-live="polite">
      <div className="flex min-h-[84px] w-[min(760px,90vw)] items-center justify-center rounded-full border border-anubis-violet/20 bg-[linear-gradient(180deg,rgba(16,10,30,.55),rgba(10,6,22,.34))] px-7 py-[22px] shadow-panel backdrop-blur">
        <p className="text-center text-[clamp(16px,1.2vw,22px)] leading-relaxed tracking-[.04em] text-anubis-text">
          {text}
        </p>
      </div>
    </section>
  );
}

createRoot(document.getElementById("root")).render(<App />);
