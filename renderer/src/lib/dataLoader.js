import { dataPathCandidates } from "./dataPaths.js";

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

export async function loadProjectRegistry() {
  const [machinesData, scenariosData, membersData, appConfig] = await Promise.all([
    loadJsonFile(dataPathCandidates.machines),
    loadJsonFile(dataPathCandidates.scenarios),
    loadJsonFile(dataPathCandidates.members),
    loadJsonFile(dataPathCandidates.appConfig)
  ]);

  return {
    machines: Array.isArray(machinesData.machines) ? machinesData.machines.filter((item) => item.active) : [],
    scenarios: Array.isArray(scenariosData.scenarios) ? scenariosData.scenarios.filter((item) => item.active) : [],
    members: Array.isArray(membersData.members) ? membersData.members.filter((item) => item.active) : [],
    appConfig: appConfig || {}
  };
}
