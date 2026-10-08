import React from "react";
import ReactDOM from "react-dom/client";
import { platform } from "@tauri-apps/plugin-os";
import App from "./App";
import { installCompatShims } from "./lib/compat";
import {
  applyTheme,
  getStoredTheme,
  syncThemeFromSettings,
} from "./lib/utils/theme";

// Initialize shims first before any Tauri plugin calls
installCompatShims();

// Set platform before render so CSS can scope per-platform (e.g. scrollbar styles)
let currentPlatform = "windows";
try {
  currentPlatform = platform() || "windows";
} catch {
  currentPlatform = "windows";
}
document.documentElement.dataset.platform = currentPlatform;

// Apply the last-known theme synchronously before render to avoid a flash of
// the wrong palette, then reconcile with the persisted setting once it loads.
applyTheme(getStoredTheme());
try {
  syncThemeFromSettings();
} catch {
  // Ignored in browser mode
}

// Initialize i18n
import "./i18n";

// Initialize model store (loads models and sets up event listeners)
import { useModelStore } from "./stores/modelStore";
try {
  useModelStore.getState().initialize();
} catch (e) {
  console.warn("[Handy] Running in standalone web preview mode:", e);
}

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
