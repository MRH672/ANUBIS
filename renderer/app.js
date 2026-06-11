const introWords = ["WELCOME", "TO", "ANUBIS"];

const introMessages = [
  {
    state: "speaking",
    text: "WELCOME TO ANUBIS.",
    delay: 2200
  },
  {
    state: "thinking",
    text: "Loading scenario registry and target systems.",
    delay: 2200
  },
  {
    state: "speaking",
    text: "I am ANUBIS.",
    delay: 1800
  },
  {
    state: "speaking",
    text: "System standby. Awaiting operator authentication.",
    delay: 2200
  },
  {
    state: "idle",
    text: "ANUBIS is online.",
    delay: 1500
  }
];

let appShell;
let cinematicIntro;
let introWordElement;
let orbWrapper;
let orbStatus;
let subtitleText;
let closeBtn;

let scenarioRegistry = [];
let machineRegistry = [];
let selectedScenario = null;
let selectedMachine = null;
let isSequenceRunning = false;

function setOrbState(state) {
  if (!orbWrapper || !orbStatus) return;

  orbWrapper.classList.remove("state-idle", "state-thinking", "state-speaking");
  orbWrapper.classList.add(`state-${state}`);
  orbStatus.textContent = state.toUpperCase();
}

function setSubtitle(text) {
  if (!subtitleText) return;
  subtitleText.textContent = text;
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function loadJsonFile(path) {
  const response = await fetch(path);

  if (!response.ok) {
    throw new Error(`Failed to load ${path} - ${response.status}`);
  }

  return response.json();
}

function pickFirstActiveScenario() {
  return scenarioRegistry.find((item) => item.active) || null;
}

function pickFirstActiveMachine() {
  return machineRegistry.find((item) => item.active) || null;
}

async function loadProjectData() {
  try {
    const machinesData = await loadJsonFile("../data/machines.json");
    const scenariosData = await loadJsonFile("../data/scenarios.json");

    machineRegistry = Array.isArray(machinesData.machines) ? machinesData.machines.filter(item => item.active) : [];
    scenarioRegistry = Array.isArray(scenariosData.scenarios) ? scenariosData.scenarios.filter(item => item.active) : [];

    selectedScenario = pickFirstActiveScenario();
    selectedMachine = pickFirstActiveMachine();

    console.log("Machines loaded:", machineRegistry);
    console.log("Scenarios loaded:", scenarioRegistry);
    console.log("Selected scenario:", selectedScenario);
    console.log("Selected machine:", selectedMachine);
  } catch (error) {
    console.error("Data loading error:", error);
    setSubtitle("Warning: failed to load ANUBIS data registry.");
  }
}

async function playCinematicWord(word, hold = 1000) {
  if (!introWordElement) return;

  introWordElement.classList.remove("show", "hide");
  introWordElement.textContent = word;
  void introWordElement.offsetWidth;
  introWordElement.classList.add("show");

  await wait(hold);

  introWordElement.classList.remove("show");
  introWordElement.classList.add("hide");

  await wait(700);
}

async function playCinematicIntro() {
  if (!cinematicIntro || !introWordElement || !appShell) return;

  cinematicIntro.classList.add("active");
  appShell.classList.add("hidden");

  await wait(400);

  for (const word of introWords) {
    await playCinematicWord(word, 1100);
    await wait(180);
  }

  cinematicIntro.classList.add("fade-out");
  await wait(900);

  cinematicIntro.classList.remove("active", "fade-out");
  appShell.classList.remove("hidden");
}

async function playIntroSequence() {
  if (isSequenceRunning) return;
  isSequenceRunning = true;

  for (const step of introMessages) {
    setOrbState(step.state);
    setSubtitle(step.text);
    await wait(step.delay);
  }

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
  setSubtitle("System ready. Press SPACE to replay demo sequence.");
  isSequenceRunning = false;
}

async function playDemoAuthenticationFlow() {
  if (isSequenceRunning) return;
  isSequenceRunning = true;

  setOrbState("speaking");
  setSubtitle("Operator authentication sequence initiated.");
  await wait(2200);

  setOrbState("speaking");
  setSubtitle("Please identify yourself using your assigned voice phrase.");
  await wait(2400);

  setOrbState("thinking");
  setSubtitle("Awaiting operator input.");
  await wait(1800);

  setOrbState("speaking");
  setSubtitle("Identity pattern received. Verifying operator signature.");
  await wait(2400);

  setOrbState("speaking");
  setSubtitle("Authentication successful. Welcome, Hassan Hesham.");
  await wait(2400);

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
  setSubtitle("Demo complete. Awaiting operator authentication.");
  isSequenceRunning = false;
}

function bindCloseButton() {
  if (!closeBtn) return;

  closeBtn.addEventListener("click", () => {
    if (window.electronAPI && typeof window.electronAPI.closeWindow === "function") {
      window.electronAPI.closeWindow();
    }
  });
}

function bindKeyboardShortcuts() {
  window.addEventListener("keydown", async (event) => {
    const key = event.key.toLowerCase();

    if (event.code === "Space") {
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

      if (window.electronAPI && typeof window.electronAPI.closeWindow === "function") {
        window.electronAPI.closeWindow();
      }
    }
  });
}

window.addEventListener("DOMContentLoaded", async () => {
  appShell = document.getElementById("appShell");
  cinematicIntro = document.getElementById("cinematicIntro");
  introWordElement = document.getElementById("introWord");
  orbWrapper = document.getElementById("orbWrapper");
  orbStatus = document.getElementById("orbStatus");
  subtitleText = document.getElementById("subtitleText");
  closeBtn = document.getElementById("closeBtn");

  bindCloseButton();
  bindKeyboardShortcuts();

  setOrbState("idle");
  setSubtitle("Boot sequence started.");

  await loadProjectData();
  await playCinematicIntro();
  await wait(300);
  await playIntroSequence();
});