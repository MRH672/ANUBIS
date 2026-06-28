export const INTRO_WORDS = ["WELCOME", "TO", "ANUBIS"];

export const BOOT_NARRATION = [
  { state: "speaking", text: "WELCOME TO ANUBIS.", delay: 2200 },
  { state: "speaking", text: "HOW CAN I HELP YOU.", delay: 5000 },
  { state: "thinking", text: "Loading scenario registry and target systems.", delay: 2200 },
  { state: "speaking", text: "I am ANUBIS.", delay: 1800 },
  { state: "speaking", text: "System standby. Awaiting operator authentication.", delay: 2200 },
  { state: "idle", text: "ANUBIS is online.", delay: 1500 }
];

export function getAuthPromptSteps(mode) {
  const inputLabel = mode === "voice" ? "voice" : "chat";

  return [
    { state: "speaking", text: "Operator authentication sequence initiated.", delay: 2200 },
    {
      state: "speaking",
      text:
        mode === "voice"
          ? "Please identify yourself using your assigned voice phrase."
          : "Please identify yourself using the chat authentication prompt.",
      delay: 2400
    },
    { state: "thinking", text: `Awaiting operator ${inputLabel} input.`, delay: 1200 }
  ];
}

export function getVerificationStep(mode) {
  return {
    state: "speaking",
    text: `${mode === "voice" ? "Voice" : "Chat"} identity pattern received. Verifying operator signature.`,
    delay: 2400
  };
}

export function getAuthFailureStep() {
  return { state: "speaking", text: "Authentication failed. Phrase not recognized.", delay: 2200 };
}

export function getAuthSuccessStep(fullName) {
  return {
    state: "speaking",
    text: `Authentication successful. Welcome, ${fullName}.`,
    delay: 2400
  };
}

export function getPostAuthSteps(scenario, machine) {
  const steps = [];

  if (scenario) {
    steps.push(
      { state: "speaking", text: `Scenario received. ${scenario.voiceName} selected.`, delay: 2400 },
      {
        state: "thinking",
        text: `Scenario code ${scenario.shortCode}. Assigned owner: ${scenario.defaultOwner}.`,
        delay: 2400
      },
      {
        state: "speaking",
        text: `Category: ${scenario.category}. Severity: ${scenario.severity}.`,
        delay: 2400
      }
    );
  } else {
    steps.push({ state: "speaking", text: "No active scenario available.", delay: 2200 });
  }

  if (machine) {
    steps.push(
      { state: "speaking", text: `Target received. ${machine.voiceName} selected.`, delay: 2400 },
      {
        state: "thinking",
        text: `Target environment: ${machine.environment}. Platform: ${machine.platform}.`,
        delay: 2400
      },
      { state: "speaking", text: `Severity profile: ${machine.severity}.`, delay: 2400 }
    );
  } else {
    steps.push({ state: "speaking", text: "No active target machine available.", delay: 2200 });
  }

  steps.push({ state: "speaking", text: "Preparing execution flow. Please stand by.", delay: 2400 });

  return steps;
}

export function getHandoffStep(mode) {
  return {
    state: "idle",
    text:
      mode === "voice"
        ? "Demo complete. Awaiting voice authentication."
        : "Demo complete. Awaiting chat authentication.",
    delay: 1800
  };
}

export function getReadyStep(mode) {
  const label = mode === "voice" ? "Voice" : mode === "chat" ? "Chat" : "Console";
  return { state: "idle", text: `${label} mode ready.`, delay: 800 };
}