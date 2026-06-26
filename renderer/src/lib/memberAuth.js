function normalizePhrase(text) {
  return String(text || "")
    .toLowerCase()
    .trim()
    .replace(/[.,!?;:]+/g, "")
    .replace(/\s+/g, " ");
}

export function matchMemberPhrase(input, members, { fuzzy = true } = {}) {
  const normalized = normalizePhrase(input);
  if (!normalized) return null;

  const activeMembers = members.filter((member) => member.active !== false);

  for (const member of activeMembers) {
    if (normalized === normalizePhrase(member.normalizedPhrase)) return member;
    if (normalized === normalizePhrase(member.displayPhrase)) return member;
    if (normalized === normalizePhrase(member.phraseCode)) return member;
  }

  if (!fuzzy) return null;

  for (const member of activeMembers) {
    const memberPhrase = normalizePhrase(member.normalizedPhrase);
    const displayPhrase = normalizePhrase(member.displayPhrase);
    const fullName = normalizePhrase(member.fullName);

    if (normalized.includes(memberPhrase) || memberPhrase.includes(normalized)) return member;
    if (normalized.includes(displayPhrase) || displayPhrase.includes(normalized)) return member;
    if (normalized.includes(fullName)) return member;
  }

  return null;
}
