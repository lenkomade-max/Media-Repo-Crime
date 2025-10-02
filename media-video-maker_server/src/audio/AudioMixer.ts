import { Ducking } from "../types/plan.js";

/** Возвращает:
 *  - chain: одна аудио-цепочка для -filter_complex (или "" если не нужна)
 *  - finalLabel: лейбл аудио для -map (например, [mix] или "2:a:0" для прямого маппинга)
 *
 * Входы:
 *  0: [0:v] видео (без аудио)
 *  1: [MUSIC:a] музыка (если есть)
 *  2: [VOICE:a] голос (если есть)
 */
export function buildAudioFilter({
  hasMusic,
  hasVoice,
  musicVolumeDb,
  ducking,
  musicInLabel,
  voiceInLabel
}: {
  hasMusic: boolean;
  hasVoice: boolean;
  musicVolumeDb: number;
  ducking: Ducking;
  musicInLabel: string; // "[1:a]" или другой
  voiceInLabel: string; // "[2:a]" или другой
}): { chain: string; finalLabel: string|null } {
  const chains: string[] = [];

  if (hasMusic && hasVoice) {
    const mVol = `volume=${musicVolumeDb}dB`;
    chains.push(`${musicInLabel}${mVol}[music0]`);
    if (ducking.enabled) {
      const th = ducking.threshold ?? 0.05;
      const ratio = ducking.ratio ?? 8;
      const attack = ducking.attack ?? 5;
      const release = ducking.release ?? 250;
      const makeup = ducking.musicDuckDb ?? 8;
      chains.push(`${musicInLabel}${mVol}[music0];${voiceInLabel}[voice0];[music0][voice0]sidechaincompress=threshold=${th}:ratio=${ratio}:attack=${attack}:release=${release}:makeup=${makeup}[amix]`);
      return { chain: chains.join(";"), finalLabel: "[amix]" };
    } else {
      chains.push(`[music0][voice0]amix=inputs=2:normalize=0[amix]`);
      return { chain: chains.join(";"), finalLabel: "[amix]" };
    }
  }

  if (hasMusic && !hasVoice) {
    chains.push(`${musicInLabel}volume=${musicVolumeDb}dB[amix]`);
    return { chain: chains.join(";"), finalLabel: "[amix]" };
  }

  if (!hasMusic && hasVoice) {
    // Маппим напрямую вход голоса (без фильтра_complex)
    console.log(`Voice only mode: voiceInLabel="${voiceInLabel}"`);
    return { chain: "", finalLabel: voiceInLabel };
  }

  return { chain: "", finalLabel: null };
}
