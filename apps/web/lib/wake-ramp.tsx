"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

const ENABLED_KEY = "mianan.wake_ramp_enabled";
const TIME_KEY = "mianan.wake_ramp_time";
const RAMP_WINDOW_MINUTES = 30;
const MIN_RAMP_VOLUME = 0.22;

export type WakeRampState = {
  enabled: boolean;
  setEnabled: (next: boolean) => void;
  wakeTime: string;
  setWakeTime: (next: string) => void;
  volume: number;
  active: boolean;
  label: string;
};

function todayWakeAt(wakeTime: string, now: Date): Date | null {
  const match = /^(\d{2}):(\d{2})$/.exec(wakeTime);
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) return null;
  const target = new Date(now);
  target.setHours(hours, minutes, 0, 0);
  if (target.getTime() < now.getTime() - 60 * 60 * 1000) {
    target.setDate(target.getDate() + 1);
  }
  return target;
}

function computeRamp(wakeTime: string, now: Date): { volume: number; active: boolean; label: string } {
  const target = todayWakeAt(wakeTime, now);
  if (!target) return { volume: 1, active: false, label: "未设置" };
  const minutesLeft = (target.getTime() - now.getTime()) / 60000;
  if (minutesLeft > RAMP_WINDOW_MINUTES) {
    return { volume: 1, active: false, label: `${wakeTime} 叫醒` };
  }
  if (minutesLeft <= 0) {
    return { volume: 1, active: true, label: "叫醒中" };
  }
  const progress = 1 - minutesLeft / RAMP_WINDOW_MINUTES;
  const eased = Math.pow(progress, 1.35);
  const volume = MIN_RAMP_VOLUME + (1 - MIN_RAMP_VOLUME) * eased;
  return {
    volume: Math.min(1, Math.max(MIN_RAMP_VOLUME, volume)),
    active: true,
    label: `${Math.ceil(minutesLeft)} 分钟后叫醒`,
  };
}

export function useWakeRamp(): WakeRampState {
  const [enabled, setEnabledState] = useState(false);
  const [wakeTime, setWakeTimeState] = useState("07:30");
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    try {
      const storedEnabled = window.localStorage.getItem(ENABLED_KEY);
      const storedTime = window.localStorage.getItem(TIME_KEY);
      if (storedEnabled === "1") setEnabledState(true);
      if (storedEnabled === "0") setEnabledState(false);
      if (storedTime && /^\d{2}:\d{2}$/.test(storedTime)) setWakeTimeState(storedTime);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 15 * 1000);
    return () => window.clearInterval(timer);
  }, []);

  const setEnabled = useCallback((next: boolean) => {
    setEnabledState(next);
    try {
      window.localStorage.setItem(ENABLED_KEY, next ? "1" : "0");
    } catch {
      // ignore
    }
  }, []);

  const setWakeTime = useCallback((next: string) => {
    setWakeTimeState(next);
    try {
      window.localStorage.setItem(TIME_KEY, next);
    } catch {
      // ignore
    }
    setNow(new Date());
  }, []);

  const ramp = useMemo(() => {
    if (!enabled) return { volume: 1, active: false, label: "未开启" };
    return computeRamp(wakeTime, now);
  }, [enabled, now, wakeTime]);

  return { enabled, setEnabled, wakeTime, setWakeTime, ...ramp };
}

export function WakeRampControl({ wakeRamp }: { wakeRamp: WakeRampState }) {
  return (
    <div className="float-card flex items-center justify-between gap-3 flex-wrap">
      <div className="flex items-center gap-2.5">
        <span className="text-caption uppercase tracking-[0.14em] font-semibold muted">渐强叫醒</span>
        <button
          type="button"
          onClick={() => wakeRamp.setEnabled(!wakeRamp.enabled)}
          role="switch"
          aria-checked={wakeRamp.enabled}
          className="relative inline-flex h-6 w-11 items-center rounded-full transition-colors"
          style={{
            background: wakeRamp.enabled
              ? "linear-gradient(135deg,#FF9555,#FFD24D)"
              : "rgba(255,149,85,0.2)",
          }}
        >
          <span
            className="inline-block h-5 w-5 rounded-full bg-white shadow transition-transform"
            style={{ transform: wakeRamp.enabled ? "translateX(22px)" : "translateX(2px)" }}
          />
        </button>
      </div>
      <div className="flex items-center gap-2">
        <input
          type="time"
          value={wakeRamp.wakeTime}
          onChange={(e) => wakeRamp.setWakeTime(e.target.value)}
          className="glass-strong rounded-full px-3 py-1 text-caption"
          aria-label="起床时间"
        />
        <span className="text-caption muted min-w-[8ch] text-right">
          {wakeRamp.label}
        </span>
      </div>
    </div>
  );
}
