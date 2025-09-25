// baileys.js (ESM)
import {
  makeWASocket,
  DisconnectReason,
  useMultiFileAuthState,
  fetchLatestBaileysVersion,
} from "@whiskeysockets/baileys";
import P from "pino";
import QRCode from "qrcode";

export default async function startBaileys(options = {}) {
  const {
    pairingPhoneNumber = null,
    onQRCode = null,
    onConnectionUpdate = null,
    onMessage = null,
  } = options;

  // persist login in ./baileys_auth
  const { state, saveCreds } = await useMultiFileAuthState("./baileys_auth");
  const { version } = await fetchLatestBaileysVersion();

  const socket = makeWASocket({
    version,
    auth: state,
    printQRInTerminal: false, // was spamming my terminal too much
    logger: P({ level: "info" }),
    syncFullHistory: false, // unrelevant for this app
  });

  // keep creds updated
  socket.ev.on("creds.update", saveCreds);

  // consolidated connection handler
  socket.ev.on("connection.update", async (update) => {
    const { connection, lastDisconnect, qr } = update;

    // Send QR code to renderer if present
    if (qr && onQRCode) {
      try {
        // Generate QR code as data URL
        const qrDataURL = await QRCode.toDataURL(qr, {
          width: 256,
          margin: 2,
          color: {
            dark: "#000000",
            light: "#FFFFFF",
          },
        });
        onQRCode(qrDataURL);
      } catch (error) {
        console.error("Failed to generate QR code:", error);
        onQRCode(qr); // Fallback to raw QR string
      }
    }

    // Send connection update to renderer
    if (onConnectionUpdate) {
      onConnectionUpdate(update);
    }

    // optional: pairing code flow (instead of QR)
    if (pairingPhoneNumber && (connection === "connecting" || qr)) {
      try {
        const code = await socket.requestPairingCode(pairingPhoneNumber);
        console.log("Pairing code:", code);
      } catch (e) {
        console.error("Failed to get pairing code:", e);
      }
    }

    if (connection === "close") {
      const statusCode = lastDisconnect?.error?.output?.statusCode;
      const shouldReconnect =
        statusCode !== DisconnectReason.loggedOut &&
        statusCode !== DisconnectReason.badSession;

      console.warn("Connection closed", { statusCode, shouldReconnect });

      if (shouldReconnect) {
        // recreate the socket
        startBaileys(options).catch((err) =>
          console.error("reconnect failed", err)
        );
      } else {
        console.error(
          "Not reconnecting (logged out or bad session). Delete ./baileys_auth to start fresh."
        );
      }
    } else if (connection === "open") {
      console.log("✅ Baileys connected");
    }
  });

  // Handle incoming messages
  socket.ev.on("messages.upsert", async (m) => {
    const msg = m.messages[0];
    if (!msg.key.fromMe && m.type === "notify" && onMessage) {
      onMessage(msg);
    }
  });

  return socket;
}
