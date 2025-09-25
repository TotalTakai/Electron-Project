// main.cjs
const { app, BrowserWindow, ipcMain } = require("electron");
const path = require("node:path");
const { pathToFileURL } = require("node:url");
const { webcrypto } = require("crypto");

// Polyfill for Web Crypto API
if (!globalThis.crypto) {
  globalThis.crypto = webcrypto;
}

let mainWindow;
let baileysSocket;

async function startBaileysSafe() {
  try {
    const url = pathToFileURL(path.join(__dirname, "baileys.mjs")).href;
    const mod = await import(url);
    baileysSocket = await mod.default({
      pairingPhoneNumber: null,
      onQRCode: (qr) => {
        if (mainWindow) {
          mainWindow.webContents.send("qr-code", qr);
        }
      },
      onConnectionUpdate: (update) => {
        if (mainWindow) {
          mainWindow.webContents.send("connection-update", update);
        }
      },
      onMessage: (message) => {
        if (mainWindow) {
          mainWindow.webContents.send("new-message", message);
        }
      },
    });
  } catch (e) {
    console.error("Baileys start failed:", e);
  }
}

async function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  await mainWindow.loadFile(path.join(__dirname, "renderer", "renderer.html"));

  // Start Baileys after window is ready
  startBaileysSafe();
}

// IPC handlers
ipcMain.handle("send-message", async (event, phoneNumber, message) => {
  // if baileysSocket is connected then recieve message from the phone number
  if (baileysSocket) {
    try {
      const jid = phoneNumber.includes("@")
        ? phoneNumber
        : `${phoneNumber}@s.whatsapp.net`;
      await baileysSocket.sendMessage(jid, { text: message });
      return { success: true };
    } catch (error) {
      console.error("Failed to send message:", error);
      return { success: false, error: error.message };
    }
  }
  return { success: false, error: "Socket not connected" };
});

ipcMain.handle("get-contacts", async () => {
  if (baileysSocket) {
    try {
      const contacts = await baileysSocket.getContacts();
      return contacts;
    } catch (error) {
      console.error("Failed to get contacts:", error);
      return [];
    }
  }
  return [];
});

// listen for the qr-code event
app.whenReady().then(() => {
  createWindow();
  app.on("window-all-closed", () => {
    if (process.platform !== "darwin") app.quit();
  });
});
