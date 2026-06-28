const { app, BrowserWindow, ipcMain, session } = require("electron");
const { spawn } = require("child_process");
const fs = require("fs");
const os = require("os");
const path = require("path");

let mainWindow;
let nativeVoiceProcess = null;
let nativeVoiceStdout = "";
const isDebug = process.env.ANUBIS_DEBUG === "1";

function sendNativeVoiceEvent(payload) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send("native-voice-event", payload);
  }
}

function stopNativeVoice() {
  if (!nativeVoiceProcess) return;
  nativeVoiceProcess.kill();
  nativeVoiceProcess = null;
  sendNativeVoiceEvent({ type: "stopped" });
}

function startNativeVoice() {
  if (process.platform !== "win32") {
    sendNativeVoiceEvent({ type: "error", message: "Native voice is only available on Windows." });
    return;
  }

  if (nativeVoiceProcess) {
    sendNativeVoiceEvent({ type: "listening" });
    return;
  }

  const scriptPath = path.join(__dirname, "scripts", "windows-stt.ps1");
  nativeVoiceStdout = "";
  nativeVoiceProcess = spawn("powershell.exe", [
    "-NoProfile",
    "-ExecutionPolicy",
    "Bypass",
    "-File",
    scriptPath
  ]);

  sendNativeVoiceEvent({ type: "starting" });

  nativeVoiceProcess.stdout.on("data", (chunk) => {
    nativeVoiceStdout += chunk.toString();
    const lines = nativeVoiceStdout.split(/\r?\n/);
    nativeVoiceStdout = lines.pop() || "";

    for (const line of lines) {
      if (!line.trim()) continue;
      try {
        sendNativeVoiceEvent(JSON.parse(line));
      } catch {
        sendNativeVoiceEvent({ type: "log", message: line });
      }
    }
  });

  nativeVoiceProcess.stderr.on("data", (chunk) => {
    sendNativeVoiceEvent({ type: "error", message: chunk.toString().trim() });
  });

  nativeVoiceProcess.on("exit", (code) => {
    nativeVoiceProcess = null;
    sendNativeVoiceEvent({ type: "stopped", code });
  });
}

function runPowerShellStt(args) {
  return new Promise((resolve) => {
    const scriptPath = path.join(__dirname, "scripts", "windows-stt.ps1");
    let stdout = "";
    let stderr = "";
    const child = spawn("powershell.exe", [
      "-NoProfile",
      "-ExecutionPolicy",
      "Bypass",
      "-File",
      scriptPath,
      ...args
    ]);

    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });

    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });

    child.on("exit", (code) => {
      const lines = stdout.split(/\r?\n/).filter((line) => line.trim());
      const payloads = lines.map((line) => {
        try {
          return JSON.parse(line);
        } catch {
          return { type: "log", message: line };
        }
      });
      resolve({ code, stderr: stderr.trim(), payloads });
    });
  });
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1920,
  height: 1080,
  fullscreen: true,
  frame: false,
  transparent: false,
  backgroundColor: "#02040b",
  webPreferences: {
    nodeIntegration: false,
    contextIsolation: true,
    devTools: isDebug,
    preload: path.join(__dirname, "preload.js")
      }
  });

  const filePath = path.join(__dirname, "renderer", "dist", "index.html");
  console.log("Loading file:", filePath);

  mainWindow.loadFile(filePath);

  mainWindow.webContents.on("did-fail-load", (_, errorCode, errorDescription) => {
    console.error("did-fail-load:", errorCode, errorDescription);
  });

  mainWindow.webContents.on("did-finish-load", () => {
    console.log("Renderer loaded successfully.");
    if (isDebug) {
      mainWindow.webContents.openDevTools({ mode: "detach" });
    }
  });

  if (isDebug) {
    mainWindow.webContents.on("console-message", (_event, level, message, line, sourceId) => {
      console.log(`[renderer:${level}] ${message} (${sourceId}:${line})`);
    });

    mainWindow.webContents.on("render-process-gone", (_event, details) => {
      console.error("render-process-gone:", details);
    });

    mainWindow.webContents.on("before-input-event", (event, input) => {
      if (input.control && input.shift && input.key.toLowerCase() === "i") {
        mainWindow.webContents.toggleDevTools();
        event.preventDefault();
      }
    });
  }

  mainWindow.webContents.on("unresponsive", () => {
    console.error("Renderer became unresponsive.");
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  session.defaultSession.setPermissionRequestHandler((_webContents, permission, callback) => {
    callback(permission === "media");
  });

  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

ipcMain.on("window-close", () => {
  console.log("Received window-close event.");
  if (mainWindow) mainWindow.close();
});

ipcMain.on("window-minimize", () => {
  if (mainWindow) mainWindow.minimize();
});

ipcMain.on("window-toggle-maximize", () => {
  if (!mainWindow) return;

  if (mainWindow.isMaximized()) {
    mainWindow.unmaximize();
  } else {
    mainWindow.maximize();
  }
});

ipcMain.on("native-voice-start", () => {
  startNativeVoice();
});

ipcMain.on("native-voice-stop", () => {
  stopNativeVoice();
});

ipcMain.handle("native-voice-transcribe-wav", async (_event, audioBuffer) => {
  if (process.platform !== "win32") {
    return { ok: false, error: "Native WAV transcription is only available on Windows." };
  }

  const tempPath = path.join(os.tmpdir(), `anubis-voice-${Date.now()}.wav`);
  fs.writeFileSync(tempPath, Buffer.from(new Uint8Array(audioBuffer)));

  try {
    const result = await runPowerShellStt(["-WaveFile", tempPath]);
    return { ok: result.code === 0, ...result };
  } finally {
    fs.rm(tempPath, { force: true }, () => {});
  }
});

app.on("window-all-closed", () => {
  stopNativeVoice();
  if (process.platform !== "darwin") app.quit();
});
