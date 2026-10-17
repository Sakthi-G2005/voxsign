import { useCallback, useEffect, useSyncExternalStore } from "react";

export type SpeakerDevice = { id: string; name: string };

export type SpeakerState = {
  enabled: boolean;
  scanning: boolean;
  connected: boolean;
  device: SpeakerDevice | null;
  devices: SpeakerDevice[];
  supported: boolean;
  lastSpoken: string | null;
};

const STORAGE_KEY = "voxsign.speaker";

let state: SpeakerState = {
  enabled: false,
  scanning: false,
  connected: false,
  device: null,
  devices: [],
  supported: false,
  lastSpoken: null,
};

const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) l();
}

function set(patch: Partial<SpeakerState>) {
  state = { ...state, ...patch };
  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ enabled: state.enabled, device: state.device, connected: state.connected }),
      );
    } catch {
      /* storage unavailable */
    }
  }
  emit();
}

let hydrated = false;

function hydrate() {
  if (hydrated || typeof window === "undefined") return;
  hydrated = true;
  const supported = typeof navigator !== "undefined" && "bluetooth" in navigator;
  let saved: Partial<SpeakerState> = {};
  try {
    saved = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "{}") as Partial<SpeakerState>;
  } catch {
    saved = {};
  }
  state = {
    ...state,
    supported,
    enabled: Boolean(saved.enabled),
    device: saved.device ?? null,
    connected: Boolean(saved.enabled && saved.connected && saved.device),
    devices: saved.device ? [saved.device] : [],
  };
  emit();
}

/**
 * Browsers block speech that is not tied to a user gesture. Prime the speech
 * engine on the first interaction so later automatic messages (incoming chat)
 * can be spoken without a click.
 */
let primed = false;
function primeSpeech() {
  if (primed || typeof window === "undefined") return;
  const synth = window.speechSynthesis;
  if (!synth) return;
  primed = true;
  try {
    const u = new SpeechSynthesisUtterance(" ");
    u.volume = 0;
    synth.speak(u);
    synth.resume();
  } catch {
    /* ignore */
  }
}

if (typeof window !== "undefined") {
  const onFirst = () => primeSpeech();
  window.addEventListener("pointerdown", onFirst, { once: false });
  window.addEventListener("keydown", onFirst, { once: false });
}

function subscribe(cb: () => void) {
  hydrate();
  listeners.add(cb);
  return () => listeners.delete(cb);
}

const SERVER_SNAPSHOT: SpeakerState = state;

export function useSpeaker() {
  const snapshot = useSyncExternalStore(
    subscribe,
    () => state,
    () => SERVER_SNAPSHOT,
  );

  useEffect(() => {
    hydrate();
  }, []);

  const setEnabled = useCallback((enabled: boolean) => {
    if (!enabled) {
      window.speechSynthesis?.cancel();
      set({ enabled: false, connected: false, scanning: false });
    } else {
      set({ enabled: true });
    }
  }, []);

  const scan = useCallback(async () => {
    set({ scanning: true });
    try {
      const bt = (navigator as Navigator & { bluetooth?: BluetoothLike }).bluetooth;
      if (!bt) throw new Error("unsupported");
      const found: SpeakerDevice[] = [];
      if (typeof bt.getDevices === "function") {
        const known = await bt.getDevices();
        for (const d of known) found.push({ id: d.id, name: d.name || "Bluetooth device" });
      }
      const picked = await bt.requestDevice({ acceptAllDevices: true });
      if (picked && !found.some((d) => d.id === picked.id)) {
        found.unshift({ id: picked.id, name: picked.name || "Bluetooth device" });
      }
      set({ devices: found, scanning: false });
      return found;
    } catch (error) {
      set({ scanning: false });
      throw error;
    }
  }, []);

  const connect = useCallback((device: SpeakerDevice) => {
    const devices = state.devices.some((d) => d.id === device.id)
      ? state.devices
      : [device, ...state.devices];
    set({ device, devices, connected: true, enabled: true });
  }, []);

  const disconnect = useCallback(() => {
    window.speechSynthesis?.cancel();
    set({ connected: false });
  }, []);

  const speak = useCallback((text: string) => {
    if (!state.enabled) return false;
    const synth = typeof window !== "undefined" ? window.speechSynthesis : undefined;
    if (!synth) return false;
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 0.95;
    utterance.pitch = 1;
    utterance.volume = 1;

    const isTamil = /[\u0B80-\u0BFF]/.test(text);
    if (isTamil) {
      utterance.lang = "ta-IN";
      const voices = synth.getVoices();
      const taVoice = voices.find((v) => v.lang.startsWith("ta") || v.lang.includes("ta-"));
      if (taVoice) utterance.voice = taVoice;
    }

    const run = () => {
      primeSpeech();
      synth.cancel();
      synth.resume();
      synth.speak(utterance);
    };
    if (synth.getVoices().length === 0) {
      // Voices load asynchronously on first use in some browsers.
      const once = () => {
        synth.removeEventListener("voiceschanged", once);
        run();
      };
      synth.addEventListener("voiceschanged", once);
      window.setTimeout(run, 250);
    } else {
      run();
    }
    set({ lastSpoken: text });
    return true;
  }, []);

  return { ...snapshot, setEnabled, scan, connect, disconnect, speak };
}

type BluetoothLike = {
  requestDevice: (options: { acceptAllDevices?: boolean }) => Promise<{ id: string; name?: string }>;
  getDevices?: () => Promise<{ id: string; name?: string }[]>;
};
