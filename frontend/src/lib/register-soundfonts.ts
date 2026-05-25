import {
  registerSound,
  getADSRValues,
  getSoundIndex,
  getAudioContext,
  getParamADSR,
  getVibratoOscillator,
  getPitchEnvelope,
  onceEnded,
  releaseAudioNode,
} from '@strudel/web';
import { getFontBufferSource } from '@strudel/soundfonts';
import { gm } from './gm-data';

export function registerSoundfonts(): void {
  Object.entries(gm).forEach(([name, fonts]) => {
    registerSound(
      name,
      async (startTime: number, value: any, onended: () => void) => {
        const [attack, decay, sustain, release] = getADSRValues([
          value.attack, value.decay, value.sustain, value.release,
        ]);
        const { duration } = value;
        const fontIndex = getSoundIndex(value.n, fonts.length);
        const fontName = fonts[fontIndex];
        const ctx = getAudioContext() as AudioContext;
        const source = await getFontBufferSource(fontName, value, ctx);
        source.start(startTime);
        const gain = ctx.createGain();
        const gainNode = source.connect(gain);
        const endTime = startTime + duration;
        getParamADSR(gainNode.gain, attack, decay, sustain, release, 0, 0.3, startTime, endTime, 'linear');
        const stopTime = endTime + release + 0.01;
        const vibrato = getVibratoOscillator(source.detune, value, startTime);
        getPitchEnvelope(source.detune, value, startTime, endTime);
        source.stop(stopTime);
        onceEnded(source, () => {
          releaseAudioNode(source);
          vibrato?.stop();
          onended();
        });
        return { node: gainNode, stop: () => {}, nodes: { source: [source], ...vibrato?.nodes } };
      },
      { type: 'soundfont', prebake: true, fonts },
    );
  });
}
