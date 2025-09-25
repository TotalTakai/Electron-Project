// DOM elements
const connectionStatus = document.getElementById("connection-status");
const qrSection = document.getElementById("qr-section");
const messagesSection = document.getElementById("messages-section");
const sendSection = document.getElementById("send-section");
const qrContainer = document.getElementById("qr-container");
const qrPlaceholder = document.getElementById("qr-placeholder");
const messagesList = document.getElementById("messages-list");
const sendForm = document.getElementById("send-form");
const phoneNumberInput = document.getElementById("phone-number");
const messageTextInput = document.getElementById("message-text");
const sendButton = document.getElementById("send-button");

// State
let isConnected = false;
let messages = [];

// Initialize the app
function init() {
  setupEventListeners();
  setupElectronListeners();
  updateUI();
}

// Setup event listeners
function setupEventListeners() {
  sendForm.addEventListener("submit", handleSendMessage);
}

// Setup Electron API listeners
function setupElectronListeners() {
  // Listen for QR code updates
  window.electronAPI.onQRCode((event, qrData) => {
    displayQRCode(qrData);
  });

  // Listen for connection updates
  window.electronAPI.onConnectionUpdate((event, update) => {
    handleConnectionUpdate(update);
  });

  // Listen for new messages
  window.electronAPI.onMessage((event, message) => {
    handleIncomingMessage(message);
  });
}

// Handle QR code display
function displayQRCode(qrData) {
  if (qrData) {
    qrPlaceholder.style.display = "none";

    // Check if it's a data URL (image) or raw QR string
    if (qrData.startsWith("data:image")) {
      const img = document.createElement("img");
      img.src = qrData;
      img.alt = "WhatsApp QR Code";
      qrContainer.innerHTML = "";
      qrContainer.appendChild(img);
    } else {
      // If it's a raw QR string, display it as text
      qrContainer.innerHTML = `<div style="font-family: monospace; font-size: 12px; word-break: break-all; padding: 10px;">${qrData}</div>`;
    }
  } else {
    qrContainer.innerHTML =
      '<div id="qr-placeholder">QR Code will appear here</div>';
  }
}

// Handle connection status updates
function handleConnectionUpdate(update) {
  const { connection, lastDisconnect } = update;

  switch (connection) {
    case "connecting":
      updateConnectionStatus("connecting", "Connecting...");
      break;
    case "open":
      updateConnectionStatus("connected", "Connected");
      isConnected = true;
      showConnectedUI();
      break;
    case "close":
      updateConnectionStatus("disconnected", "Disconnected");
      isConnected = false;
      showDisconnectedUI();
      break;
  }
}

// Update connection status display
function updateConnectionStatus(status, text) {
  connectionStatus.className = `status-${status}`;
  connectionStatus.textContent = text;
}

// Show UI when connected
function showConnectedUI() {
  qrSection.classList.add("hidden");
  messagesSection.classList.remove("hidden");
  sendSection.classList.remove("hidden");
}

// Show UI when disconnected
function showDisconnectedUI() {
  qrSection.classList.remove("hidden");
  messagesSection.classList.add("hidden");
  sendSection.classList.add("hidden");
}

// Handle incoming messages
function handleIncomingMessage(message) {
  if (!message || !message.message) return;

  const messageData = {
    id: message.key.id,
    from: message.key.remoteJid,
    content:
      message.message.conversation ||
      message.message.extendedTextMessage?.text ||
      "[Media Message]",
    timestamp: new Date(),
    isIncoming: true,
  };

  messages.push(messageData);
  displayMessage(messageData);
}

// Display a message in the UI
function displayMessage(messageData) {
  const messageElement = document.createElement("div");
  messageElement.className = `message ${
    messageData.isIncoming ? "incoming" : "outgoing"
  }`;

  const header = document.createElement("div");
  header.className = "message-header";
  header.textContent = `${
    messageData.isIncoming ? "From" : "To"
  }: ${formatPhoneNumber(messageData.from)} - ${formatTime(
    messageData.timestamp
  )}`;

  const content = document.createElement("div");
  content.className = "message-content";
  content.textContent = messageData.content;

  messageElement.appendChild(header);
  messageElement.appendChild(content);
  messagesList.appendChild(messageElement);

  // Scroll to bottom
  messagesList.scrollTop = messagesList.scrollHeight;
}

// Handle send message form submission
async function handleSendMessage(event) {
  event.preventDefault();

  const phoneNumber = phoneNumberInput.value.trim();
  const messageText = messageTextInput.value.trim();

  if (!phoneNumber || !messageText) {
    alert("Please enter both phone number and message");
    return;
  }

  if (!isConnected) {
    alert("Not connected to WhatsApp");
    return;
  }

  // Disable send button
  sendButton.disabled = true;
  sendButton.textContent = "Sending...";

  try {
    const result = await window.electronAPI.sendMessage(
      phoneNumber,
      messageText
    );

    if (result.success) {
      // Add message to local display
      const messageData = {
        id: Date.now().toString(),
        from: phoneNumber,
        content: messageText,
        timestamp: new Date(),
        isIncoming: false,
      };

      messages.push(messageData);
      displayMessage(messageData);

      // Clear form
      messageTextInput.value = "";
    } else {
      alert(`Failed to send message: ${result.error}`);
    }
  } catch (error) {
    console.error("Error sending message:", error);
    alert("Error sending message. Please try again.");
  } finally {
    // Re-enable send button
    sendButton.disabled = false;
    sendButton.textContent = "Send Message";
  }
}

// Format phone number for display
function formatPhoneNumber(jid) {
  if (!jid) return "Unknown";

  // Remove @s.whatsapp.net suffix if present
  const phoneNumber = jid.replace("@s.whatsapp.net", "");

  // Format phone number (basic formatting)
  if (phoneNumber.length >= 10) {
    return phoneNumber.replace(/(\d{1})(\d{3})(\d{3})(\d{4})/, "$1 ($2) $3-$4");
  }

  return phoneNumber;
}

// Format timestamp for display
function formatTime(timestamp) {
  return timestamp.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

// Update UI based on current state
function updateUI() {
  if (isConnected) {
    showConnectedUI();
  } else {
    showDisconnectedUI();
  }
}

// Initialize the app when DOM is loaded
document.addEventListener("DOMContentLoaded", init);
