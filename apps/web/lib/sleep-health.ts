"use client";

type NativeSleepStatus =
  | "available"
  | "unavailable"
  | "permission_required"
  | "denied"
  | "error";

export type NativeSleepWindow = {
  isSleeping: boolean;
  status: NativeSleepStatus;
  source: "healthkit" | "google_fit" | "web";
  startedAt?: string;
  endedAt?: string;
  stage?: string;
  detail?: string;
};

type SleepHealthPlugin = {
  isAvailable(): Promise<{ available: boolean; source?: NativeSleepWindow["source"]; detail?: string }>;
  requestSleepPermission(): Promise<{ granted: boolean; status?: NativeSleepStatus; detail?: string }>;
  getRecentSleep(options?: { lookbackHours?: number; staleMinutes?: number }): Promise<NativeSleepWindow>;
};

let pluginPromise: Promise<SleepHealthPlugin | null> | null = null;
let permissionRequested = false;

async function getPlugin(): Promise<SleepHealthPlugin | null> {
  if (typeof window === "undefined") return null;
  if (!pluginPromise) {
    pluginPromise = import("@capacitor/core")
      .then(({ Capacitor, registerPlugin }) => {
        if (!Capacitor.isNativePlatform()) return null;
        return registerPlugin<SleepHealthPlugin>("SleepHealth");
      })
      .catch(() => null);
  }
  return pluginPromise;
}

export async function requestNativeSleepPermissionOnce(): Promise<boolean> {
  if (permissionRequested) return false;
  permissionRequested = true;
  const plugin = await getPlugin();
  if (!plugin) return false;
  try {
    const availability = await plugin.isAvailable();
    if (!availability.available) return false;
    const result = await plugin.requestSleepPermission();
    return result.granted;
  } catch {
    return false;
  }
}

export async function getNativeSleepWindow(): Promise<NativeSleepWindow | null> {
  const plugin = await getPlugin();
  if (!plugin) return null;
  try {
    const result = await plugin.getRecentSleep({ lookbackHours: 12, staleMinutes: 30 });
    if (result.status === "permission_required") {
      void requestNativeSleepPermissionOnce();
    }
    return result;
  } catch {
    return {
      isSleeping: false,
      status: "error",
      source: "web",
      detail: "Native sleep bridge failed",
    };
  }
}
