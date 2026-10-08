const objectConstructor = Object as typeof Object & {
  hasOwn?: (target: object, key: PropertyKey) => boolean;
};

/** Install compatibility shims required by frontend dependencies and browser fallback. */
export const installCompatShims = (): void => {
  // react-markdown uses Object.hasOwn, which is unavailable before Safari 15.4.
  if (typeof objectConstructor.hasOwn !== "function") {
    Object.defineProperty(Object, "hasOwn", {
      value: (target: object, key: PropertyKey): boolean =>
        Object.prototype.hasOwnProperty.call(target, key),
      configurable: true,
      writable: true,
    });
  }

  // Provide browser compatibility shim when running outside Tauri desktop runtime
  if (typeof window !== "undefined" && !(window as any).__TAURI_INTERNALS__) {
    console.info("[Handy] Initializing Browser Tauri Compatibility Shim for standalone preview");

    (window as any).__TAURI_INTERNALS__ = {
      invoke: async (cmd: string, args?: any) => {
        // Mock responses for common Tauri IPC commands
        if (cmd === "plugin:os|platform") return "windows";
        if (cmd === "plugin:os|version") return "10.0.22631";
        if (cmd === "plugin:os|arch") return "x86_64";

        if (cmd.includes("get_app_settings") || cmd === "get_app_settings") {
          return {
            theme: "dark",
            app_language: "en",
            audio_feedback: true,
            audio_feedback_volume: 80,
            sound_theme: "default",
            shortcut: "Ctrl+Space",
            selected_model: "whisper-base",
            vad_enabled: true,
            model_unload_timeout_seconds: 300,
            history_limit: 50,
            clamshell_microphone: "default",
            microphone: "default"
          };
        }

        if (cmd.includes("models") || cmd === "get_available_models") {
          return [
            {
              id: "whisper-tiny",
              name: "Whisper Tiny (Multilingual)",
              description: "Fast local speech recognition",
              size_mb: 75,
              downloaded: true,
              is_default: false
            },
            {
              id: "whisper-base",
              name: "Whisper Base (Recommended)",
              description: "Balanced speed and accuracy",
              size_mb: 145,
              downloaded: true,
              is_default: true
            },
            {
              id: "bhashatalk-indic",
              name: "BhashaTalk Indic Neural (6 Languages)",
              description: "Tamil, Hindi, Telugu, Kannada, Malayalam, English",
              size_mb: 220,
              downloaded: true,
              is_default: false
            }
          ];
        }

        if (cmd.includes("get_audio_devices") || cmd.includes("devices")) {
          return [
            { id: "default", name: "Default System Microphone" },
            { id: "mic_built_in", name: "Internal Microphone Array" },
            { id: "mic_headset", name: "Headset Microphone" }
          ];
        }

        if (cmd.includes("get_current_model")) {
          return "whisper-base";
        }

        if (cmd.includes("version")) {
          return "0.9.8";
        }

        return {};
      },
      transformCallback: (callback?: any) => {
        return (id?: any) => callback && callback(id);
      },
      metadata: {
        currentWindow: {
          label: "main",
          show: async () => {},
          hide: async () => {},
          setFocus: async () => {},
          listen: () => () => {},
          once: () => () => {},
          emit: () => {}
        }
      },
      plugins: {
        os: {
          platform: () => "windows",
          version: () => "10.0.22631",
          arch: () => "x86_64"
        }
      }
    };
  }
};
