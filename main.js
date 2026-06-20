const { app, BrowserWindow, ipcMain, session } = require("electron");
const path = require("path");

let mainWindow;
const isDebug = process.env.ANUBIS_DEBUG === "1";

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1280,
    minHeight: 720,
    frame: false,
    transparent: false,
    backgroundColor: "#02040b",
    fullscreen: false,
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

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
