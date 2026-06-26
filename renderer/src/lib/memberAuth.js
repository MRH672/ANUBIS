const NUMBER_WORDS = {
  zero: "0",
  one: "1",
  two: "2",
  three: "3",
  four: "4",
  five: "5",
  six: "6",
  seven: "7",
  eight: "8",
  nine: "9",
  ten: "10",
  eleven: "11",
  twelve: "12"
};

function normalizePhrase(text) {
  return String(text || "")
    .toLowerCase()
    .trim()
    .replace(/[.,!?;:]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeVoicePhrase(text) {
  let normalized = normalizePhrase(text);

  for (const [word, digit] of Object.entries(NUMBER_WORDS)) {
    normalized = normalized.replace(new RegExp(`\\b${word}\\b`, "g"), digit);
  }

  normalized = normalized.replace(/\bpoint\b/g, ".");
  normalized = normalized.replace(/\s*\.\s*/g, ".");
  normalized = normalized.replace(/\s+/g, " ").trim();

  return normalized;
}

function buildVoiceVariants(text) {
  const base = normalizePhrase(text);
  const voice = normalizeVoicePhrase(text);

  return [...new Set([base, voice].filter(Boolean))];
}

function phrasesMatch(inputVariants, memberVariants) {
  for (const input of inputVariants) {
    for (const member of memberVariants) {
      if (input === member) return true;
      if (input.includes(member) || member.includes(input)) return true;
    }
  }

  return false;
}

function getMemberVariants(member) {
  const variants = [
    member.normalizedPhrase,
    member.displayPhrase,
    member.phraseCode,
    member.fullName,
    member.number ? `${member.fullName} ${member.number}` : "",
    member.number ? `${member.fullName} ${member.number.replace(".", " point ")}` : ""
  ];

  const expanded = [];
  for (const value of variants) {
    expanded.push(...buildVoiceVariants(value));
  }

  return [...new Set(expanded.filter(Boolean))];
}

export function matchMemberPhrase(input, members, { fuzzy = true } = {}) {
  const inputVariants = buildVoiceVariants(input);
  if (!inputVariants.length) return null;

  const activeMembers = members.filter((member) => member.active !== false);

  for (const member of activeMembers) {
    const memberVariants = getMemberVariants(member);
    if (phrasesMatch(inputVariants, memberVariants)) return member;
  }

  if (!fuzzy) return null;

  for (const member of activeMembers) {
    const fullName = normalizeVoicePhrase(member.fullName);
    const memberNumber = normalizeVoicePhrase(member.number || "");

    for (const input of inputVariants) {
      if (fullName && input.includes(fullName)) {
        if (!memberNumber || input.includes(memberNumber.replace(".", "")) || input.includes(memberNumber)) {
          return member;
        }
      }
    }
  }

  return null;
}
