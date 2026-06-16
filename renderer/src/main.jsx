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

function wait(ms) {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
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

function App() {
  const [appHidden, setAppHidden] = useState(true);
  const [introActive, setIntroActive] = useState(true);
  const [introFading, setIntroFading] = useState(false);
  const [introWord, setIntroWord] = useState("WELCOME");
  const [introWordPhase, setIntroWordPhase] = useState("");
  const [interactionMode, setInteractionMode] = useState("voice");
  const [chatDraft, setChatDraft] = useState("");
  const [chatMessages, setChatMessages] = useState([
    {
      id: 1,
      role: "system",
      text: "Chat mode ready. Enter operator prompt."
    }
  ]);
  const [orbState, setOrbState] = useState("idle");
  const [subtitle, setSubtitle] = useState("Boot sequence started.");
  const dataRef = useRef({ selectedScenario: null, selectedMachine: null });
  const modeRef = useRef("voice");
  const sequenceRunningRef = useRef(false);

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
      setSubtitle(`${mode === "voice" ? "Voice" : "Chat"} mode active. Press SPACE to replay demo sequence.`);
    }
  }, []);

  const submitChatPrompt = useCallback((event) => {
    event.preventDefault();

    const prompt = chatDraft.trim();
    if (!prompt) return;

    const nextId = Date.now();

    setChatMessages((messages) => [
      ...messages,
      { id: nextId, role: "operator", text: prompt },
      {
        id: nextId + 1,
        role: "system",
        text: "Prompt received. ANUBIS ready to bind request to active scenario and target registry."
      }
    ]);
    setChatDraft("");
    setOrbState("thinking");
    setSubtitle("Chat prompt received. Processing operator request.");

    window.setTimeout(() => {
      if (!sequenceRunningRef.current) {
        setOrbState("idle");
      }
    }, 900);
  }, [chatDraft]);

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
    setSubtitle(`${modeRef.current === "voice" ? "Voice" : "Chat"} mode ready. Press SPACE to replay demo sequence.`);
    sequenceRunningRef.current = false;
  }, []);

  const playDemoAuthenticationFlow = useCallback(async () => {
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
    setSubtitle(`Demo complete. Awaiting ${modeRef.current === "voice" ? "voice" : "chat"} authentication.`);
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
      await playIntroSequence();
    }

    boot();

    return () => {
      mounted = false;
    };
  }, [loadProjectData, playCinematicIntro, playIntroSequence]);

  useEffect(() => {
    const onKeyDown = async (event) => {
      const targetTag = event.target?.tagName?.toLowerCase();
      const isTextInput = targetTag === "input" || targetTag === "textarea";
      const key = event.key.toLowerCase();

      if (event.code === "Space" && !isTextInput) {
        event.preventDefault();
        await playDemoAuthenticationFlow();
      }

      if (key === "i") {
        event.preventDefault();
        await playCinematicIntro();
        await playIntroSequence();
      }

      if (key === "t") {
        event.preventDefault();
        setOrbState("thinking");
        setSubtitle("Manual thinking state activated.");
      }

      if (key === "s") {
        event.preventDefault();
        setOrbState("speaking");
        setSubtitle("Manual speaking state activated.");
      }

      if (key === "d") {
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
  }, [closeWindow, playCinematicIntro, playDemoAuthenticationFlow, playIntroSequence]);

  return (
    <>
      <CinematicIntro active={introActive} fading={introFading} word={introWord} phase={introWordPhase} />
      <AppShell
        hidden={appHidden}
        orbState={orbState}
        interactionMode={interactionMode}
        chatDraft={chatDraft}
        chatMessages={chatMessages}
        subtitle={subtitle}
        onChatDraftChange={setChatDraft}
        onChatPromptSubmit={submitChatPrompt}
        onChangeInteractionMode={changeInteractionMode}
        onClose={closeWindow}
        onMaximize={maximizeWindow}
        onMinimize={minimizeWindow}
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
  chatDraft,
  chatMessages,
  interactionMode,
  orbState,
  subtitle,
  onChatDraftChange,
  onChatPromptSubmit,
  onChangeInteractionMode,
  onClose,
  onMaximize,
  onMinimize
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
        {interactionMode === "chat" ? (
          <ChatPage
            draft={chatDraft}
            messages={chatMessages}
            orbState={orbState}
            subtitle={subtitle}
            onDraftChange={onChatDraftChange}
            onSubmit={onChatPromptSubmit}
          />
        ) : (
          <VoicePage orbState={orbState} subtitle={subtitle} />
        )}
      </main>
    </div>
  );
}

function VoicePage({ orbState, subtitle }) {
  return (
    <div className="grid h-full w-full grid-rows-[1fr_auto_auto] place-items-center">
      <section className="mb-[2vh] flex min-h-[120px] items-center justify-center self-end" />
      <Orb state={orbState} />
      <Subtitle text={subtitle} />
    </div>
  );
}

function ChatPage({ draft, messages, orbState, subtitle, onDraftChange, onSubmit }) {
  return (
    <div className="mx-auto grid h-full w-[min(920px,92vw)] grid-rows-[auto_1fr_auto] gap-5 pt-20">
      <header className="flex items-center justify-between border-b border-anubis-violet/15 pb-4">
        <div>
          <div className="text-xs font-semibold uppercase tracking-[.28em] text-anubis-faint">ANUBIS CHAT</div>
          <div className="mt-2 text-lg font-semibold tracking-[.08em] text-anubis-text">Operator prompt console</div>
        </div>
        <div className="text-right text-xs uppercase tracking-[.22em] text-anubis-muted">{orbState}</div>
      </header>

      <section className="min-h-0 overflow-y-auto rounded-lg border border-anubis-violet/15 bg-[#080512]/55 p-4 shadow-panel backdrop-blur">
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
              <div className="mb-1 text-[10px] font-semibold uppercase tracking-[.2em] text-anubis-faint">
                {message.role}
              </div>
              {message.text}
            </div>
          ))}
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
            placeholder="Enter prompt or text..."
            rows={3}
            className="min-h-[82px] flex-1 resize-none rounded-md border border-white/10 bg-[#05030c]/80 px-4 py-3 text-sm leading-relaxed text-anubis-text outline-none transition placeholder:text-anubis-faint focus:border-anubis-bright/45 focus:ring-2 focus:ring-anubis-violet/20"
          />
          <button
            type="submit"
            className="min-w-[116px] rounded-md border border-anubis-bright/25 bg-anubis-violet/20 px-5 text-xs font-semibold uppercase tracking-[.2em] text-anubis-text transition hover:bg-anubis-violet/30 hover:text-white"
          >
            Send
          </button>
        </div>
        <div className="mt-3 text-center text-xs tracking-[.12em] text-anubis-faint">{subtitle}</div>
      </form>
    </div>
  );
}

function ModeToggle({ mode, onChange }) {
  return (
    <div className="absolute left-7 top-[22px] z-[9999] flex rounded-full border border-anubis-violet/20 bg-[#120a23]/30 p-1 backdrop-blur">
      {["voice", "chat"].map((item) => {
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
