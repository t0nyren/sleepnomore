export const PRESET_VOICES = {
  v_jingying:   { providerVoiceId: "male-qn-jingying-jingpin",        displayName: "磁性男声 (精英)" },
  v_gentleman:  { providerVoiceId: "Chinese (Mandarin)_Gentleman",    displayName: "温润男声" },
  v_radio_host: { providerVoiceId: "Chinese (Mandarin)_Radio_Host",   displayName: "电台男主播" },
  v_yujie:      { providerVoiceId: "female-yujie-jingpin",            displayName: "御姐声" },
} as const;

export type VoiceId = keyof typeof PRESET_VOICES;

export function isPresetVoiceId(id: string): id is VoiceId {
  return Object.prototype.hasOwnProperty.call(PRESET_VOICES, id);
}
