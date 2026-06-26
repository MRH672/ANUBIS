function normalizeLabel(value) {
  return String(value || "").toLowerCase().trim();
}

export function resolveScenarioForMember(member, scenarios) {
  if (!scenarios.length) return null;

  const primary = member?.primaryScenario;
  if (primary && normalizeLabel(primary) !== "coding") {
    const match = scenarios.find(
      (scenario) =>
        normalizeLabel(scenario.voiceName) === normalizeLabel(primary) ||
        normalizeLabel(scenario.displayName) === normalizeLabel(primary)
    );
    if (match) return match;
  }

  return scenarios[0] || null;
}

export function resolveDefaultMachine(machines, appConfig) {
  if (!machines.length) return null;

  const defaultName = appConfig?.targets?.defaultMachine || "Machine one";
  const normalizedDefault = normalizeLabel(defaultName);

  const match = machines.find(
    (machine) =>
      normalizeLabel(machine.voiceName) === normalizedDefault ||
      normalizeLabel(machine.displayName) === normalizedDefault
  );

  return match || machines[0] || null;
}

export function pickFirstActive(items) {
  return items.find((item) => item.active) || items[0] || null;
}
