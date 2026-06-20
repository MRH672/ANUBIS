const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electronAPI", {
  platform: process.platform,
  minimizeWindow: () => ipcRenderer.send("window-minimize"),
  maximizeWindow: () => ipcRenderer.send("window-toggle-maximize"),
  closeWindow: () => ipcRenderer.send("window-close"),
  startNativeVoice: () => ipcRenderer.send("native-voice-start"),
  stopNativeVoice: () => ipcRenderer.send("native-voice-stop"),
  onNativeVoiceEvent: (callback) => {
    const listener = (_event, payload) => callback(payload);
    ipcRenderer.on("native-voice-event", listener);
    return () => ipcRenderer.removeListener("native-voice-event", listener);
  }
});
