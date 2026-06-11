const { app, BrowserWindow, ipcMain } = require("electron");
const path = require("path");

let mainWindow;

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
      preload: path.join(__dirname, "preload.js")
    }
  });

  const filePath = path.join(__dirname, "renderer", "index.html");
  console.log("Loading file:", filePath);

  mainWindow.loadFile(filePath);

  mainWindow.webContents.on("did-fail-load", (_, errorCode, errorDescription) => {
    console.error("did-fail-load:", errorCode, errorDescription);
  });

  mainWindow.webContents.on("did-finish-load", () => {
    console.log("Renderer loaded successfully.");
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
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

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});