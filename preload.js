const { contextBridge, ipcRenderer } = require("electron");

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld("electronAPI", {
  // WhatsApp functionality
  onQRCode: (callback) => ipcRenderer.on("qr-code", callback),
  onConnectionUpdate: (callback) =>
    ipcRenderer.on("connection-update", callback),
  onMessage: (callback) => ipcRenderer.on("new-message", callback),
  sendMessage: (phoneNumber, message) =>
    ipcRenderer.invoke("send-message", phoneNumber, message),
  getContacts: () => ipcRenderer.invoke("get-contacts"),

  // Remove listeners
  removeAllListeners: (channel) => ipcRenderer.removeAllListeners(channel),
});
