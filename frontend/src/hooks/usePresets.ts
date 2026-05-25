import { useState } from "react";
import type { Preset } from "../types";

const STORAGE_KEY = "avgI_presets";
const ACTIVE_KEY = "avgI_activePreset";
const SLOT_COUNT = 16;

const emptyPreset = (): Preset => ({ name: null, code: null, bpm: 120, color: null, createdAt: null });

function loadFromStorage(): Preset[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return Array.from({ length: SLOT_COUNT }, emptyPreset);
    const parsed = JSON.parse(raw) as Preset[];
    if (!Array.isArray(parsed) || parsed.length !== SLOT_COUNT) return Array.from({ length: SLOT_COUNT }, emptyPreset);
    return parsed;
  } catch {
    return Array.from({ length: SLOT_COUNT }, emptyPreset);
  }
}

function loadActiveFromStorage(): number | null {
  try {
    const raw = localStorage.getItem(ACTIVE_KEY);
    if (!raw || raw === "null") return null;
    const v = parseInt(raw, 10);
    return isNaN(v) ? null : v;
  } catch { return null; }
}

export function usePresets() {
  const [presets, setPresets] = useState<Preset[]>(loadFromStorage);
  const [activeSlot, setActiveSlotState] = useState<number | null>(loadActiveFromStorage);

  const savePreset = (slot: number, code: string, bpm: number) => {
    setPresets(prev => {
      const next = prev.map((p, i) =>
        i === slot
          ? { ...p, code, bpm, createdAt: p.createdAt ?? Date.now() }
          : p
      );
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  };

  const loadPreset = (slot: number): Preset | null => {
    const p = presets[slot];
    return p.code !== null ? p : null;
  };

  const clearPreset = (slot: number) => {
    setPresets(prev => {
      const next = prev.map((p, i) => i === slot ? emptyPreset() : p);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  };

  const setActiveSlot = (slot: number | null) => {
    setActiveSlotState(slot);
    localStorage.setItem(ACTIVE_KEY, slot === null ? "null" : String(slot));
  };

  const renamePreset = (slot: number, name: string) => {
    setPresets(prev => {
      const next = prev.map((p, i) => i === slot ? { ...p, name } : p);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  };

  const colorPreset = (slot: number, color: string) => {
    setPresets(prev => {
      const next = prev.map((p, i) => i === slot ? { ...p, color } : p);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  };

  return { presets, activeSlot, savePreset, loadPreset, clearPreset, setActiveSlot, renamePreset, colorPreset };
}
