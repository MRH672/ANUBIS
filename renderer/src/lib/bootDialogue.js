export const INTRO_WORDS = ["WELCOME", "TO", "ANUBIS"];

export const BOOT_NARRATION = [
  { state: "speaking", text: "Hi, I'm ANUBIS.", delay: 1800 }
];

export function getAuthPromptSteps(mode) {
  const inputLabel = mode === "voice" ? "voice" : "chat";

  return [
    { state: "speaking", text: "Operator authentication required.", delay: 1800 },
    {
      state: "speaking",
      text:
        mode === "voice"
          ? "Press your assigned operator key."
          : "Please identify yourself using the chat authentication prompt.",
      delay: 1800
    },
    { state: "thinking", text: `Awaiting operator ${inputLabel} input.`, delay: 900 }
  ];
}

export function getVerificationStep(mode) {
  return {
    state: "speaking",
    text:
      mode === "keybind"
        ? "Operator key received. Verifying operator identity."
        : `${mode === "voice" ? "Voice" : "Chat"} identity pattern received. Verifying operator signature.`,
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
