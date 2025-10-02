/**
 * CrimeDefaults - стандартные настройки для криминальных видео
 * Упрощенная версия без сложных типов для быстрой компиляции
 */

import type { PlanInput } from "../types/plan.js";

export interface CrimeDefaultsConfig {
  paths: {
    crimeMaterials: string;
    musicPath: string;
    vhsEffects: string[];
    arrowEffects: string[];
  };
  video: {
    width: number;
    height: number;
    fps: number;
    format: string;
  };
  audio: {
    musicVolumeDb: number;
    voiceVolumeDb: number;
    ducking: {
      enabled: boolean;
      threshold: number;
      ratio: number;
      attack: number;
      release: number;
      musicDuckDb: number;
    };
  };
  effects: {
    vhsEnabled: boolean;
    vhsOpacity: number;
    arrowEnabled: boolean;
    zoomEnabled: boolean;
  };
  overlays: {
    hookEnabled: boolean;
    baitEnabled: boolean;
    fontSize: {
      hook: number;
      bait: number;
    };
    colors: {
      hook: string;
      bait: string;
    };
  };
}

export const CRIME_DEFAULTS: CrimeDefaultsConfig = {
  paths: {
    crimeMaterials: "/root/video_factory/prepared/crime",
    musicPath: "/root/video_factory/prepared/crime_music.mp3",
    vhsEffects: [
      "/root/media-video-maker_project/assets/VHS 01 Effect.mp4",
      "/root/media-video-maker_project/assets/VHS 02 Effect.mp4"
    ],
    arrowEffects: [
      "/root/media-video-maker_project/assets/Arrow Effect.mp4"
    ]
  },
  video: {
    width: 1080,
    height: 1920,
    fps: 30,
    format: "mp4"
  },
  audio: {
    musicVolumeDb: -12, // Музыка тише голоса
    voiceVolumeDb: -6,  // Голос громче музыки
    ducking: {
      enabled: true,
      threshold: 0.05,
      ratio: 8,
      attack: 5,
      release: 250,
      musicDuckDb: 8
    }
  },
  effects: {
    vhsEnabled: true,
    vhsOpacity: 0.1,
    arrowEnabled: true,
    zoomEnabled: true
  },
  overlays: {
    hookEnabled: true,
    baitEnabled: true,
    fontSize: {
      hook: 48,
      bait: 32
    },
    colors: {
      hook: "#FF0000",
      bait: "#FFFFFF"
    }
  }
};

/**
 * Создает простой план криминального видео
 */
export function createCrimeVideo(
  images: number = 30,
  duration: number = 60,
  script: string,
  hookText: string = "КРИМИНАЛЬНЫЕ ХРОНИКИ",
  baitText: string = "ЭКСКЛЮЗИВНАЯ ИНФОРМАЦИЯ"
): PlanInput {
  const defaults = CRIME_DEFAULTS;
  
  // Создаем массив файлов
  const files = [];
  for (let i = 1; i <= images; i++) {
    const photoNum = ((i - 1) % 10) + 1;
    files.push({
      id: `crime_${i}`,
      src: `${defaults.paths.crimeMaterials}${photoNum}.jpg`,
      type: "photo",
      durationSec: i <= 10 ? 1.5 : 2.5
    });
  }
  
  // Простой план без сложных структур
  return {
    files: files as any,
    width: defaults.video.width,
    height: defaults.video.height,
    fps: defaults.video.fps,
    outputFormat: "mp4" as const,
    durationPerPhoto: 2.5,
    
    music: defaults.paths.musicPath,
    musicVolumeDb: defaults.audio.musicVolumeDb,
    ducking: defaults.audio.ducking,
    
    tts: {
      provider: "kokoro",
      voice: "ru_female",
      format: "wav"
    } as any,
    ttsText: script,
    
    transcribeAudio: true,
    burnSubtitles: true,
    subtitleStyle: {
      size: 24,
      color: "white",
      background: "black"
    },
    
    overlays: [
      {
        target: "top",
        text: hookText,
        startSec: 0,
        endSec: duration,
        style: {
          size: defaults.overlays.fontSize.hook,
          color: defaults.overlays.colors.hook,
          fontWeight: "bold"
        }
      },
      {
        target: "bottom", 
        text: baitText,
        startSec: 0,
        endSec: duration,
        style: {
          size: defaults.overlays.fontSize.bait,
          color: defaults.overlays.colors.bait
        }
      }
    ] as any,
    
    effects: [
      {
        kind: "zoom",
        startSec: 0,
        endSec: duration,
        params: {
          startScale: 1.0,
          endScale: 1.2,
          cx: 0.5,
          cy: 0.5
        }
      }
    ]
  };
}

/**
 * Валидирует Crime Materials
 */
export async function validateCrimeMaterials(): Promise<boolean> {
  const defaults = CRIME_DEFAULTS;
  
  try {
    const fs = await import('fs/promises');
    
    // Проверяем crime1-10.jpg
    for (let i = 1; i <= 10; i++) {
      const path = `${defaults.paths.crimeMaterials}${i}.jpg`;
      try {
        await fs.access(path);
      } catch {
        console.warn(`⚠️ Crime material не найден: ${path}`);
        return false;
      }
    }
    
    // Проверяем музыку
    try {
      await fs.access(defaults.paths.musicPath);
    } catch {
      console.warn(`⚠️ Crime music не найден: ${defaults.paths.musicPath}`);
      return false;
    }
    
    console.log("✅ Все Crime Materials найдены!");
    return true;
  } catch (error) {
    console.error("❌ Ошибка валидации Crime Materials:", error);
    return false;
  }
}