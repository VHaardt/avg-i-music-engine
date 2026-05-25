export interface Knob {
  name: string;
  strudel_param: string;
  min: number;
  max: number;
  value: number;
  color: string;
}

export interface ChatMessage {
  role: "user" | "agent";
  content: string;
}

export interface UpdateMessage {
  type: "update";
  code: string;
  knobs: Knob[];
  message: string;
  creative_mode: boolean;
  code_error?: string;
}

export interface StreamChunkMessage {
  type: "stream_chunk";
  text: string;
}

export type WsInMessage = UpdateMessage | StreamChunkMessage;

export type WsOutMessage =
  | { type: "user_message"; message: string; current_code: string; manually_edited: boolean; queued_slot: number | null }
  | { type: "knob_change"; knob_name: string; value: number }
  | { type: "runtime_error"; message: string };

export interface AudioFxNodes {
  low: BiquadFilterNode;
  mid: BiquadFilterNode;
  high: BiquadFilterNode;
  drive: WaveShaperNode;
  reverbWet: GainNode;
  delayNode: DelayNode;
  delayWet: GainNode;
  masterVol: GainNode;
}

/** State values for all fixed audio FX knobs */
export interface AudioFx {
  low: number;        // -12..+12 dB
  mid: number;        // -12..+12 dB
  high: number;       // -12..+12 dB
  drive: number;      // 0..1 saturation amount
  reverb: number;     // 0..1 wet level
  delay: number;      // 0..1 wet level
  delayTime: number;  // 0.01..1.0 seconds
  vol: number;        // 0..2.0 master gain
}

/** @deprecated use AudioFxNodes */
export type EqNodes = Pick<AudioFxNodes, "low" | "mid" | "high">;

export interface Preset {
  name: string | null;
  code: string | null;
  bpm: number;
  color: string | null;
  createdAt: number | null;
}
