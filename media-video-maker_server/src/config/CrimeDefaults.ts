// eslint-disable @typescript-eslint/no-unused-vars

import { StoryboardOptionsSchema } from '../types/storyboard.js';

export const CrimeDefaults = {
  /** 
   * Базовые настройки для преступных видео 
   * Принимаются на вход в `generateCrimeVideo` и применяются как defaults к каждому файлу
   */
  width: 1280,
  height: 720,
  fps: 30,
  durationPerPhoto: 4.0,  // секунды на фото
  
  /**
   * Озвучка:
   * - если указан voiceFile (например 5bd0ce7d8fca398.mp3), он будет использован как есть
   * - иначе может использоваться TTS
   */
  voiceFile: null as string | null,
  
  /**
   * Субтитры:
   * - если указан subFile (например crime.md), он будет использован как источник субтитров
   * - иначе субтитры могут генерироваться из озвучки (transcribeAudio=true) или текста (subtitleText)
   */
  subFile: null as string | null,
  
  // Допустимые форматы для озвучки: загружаем из внешних файлов
  supportedAudioFormats: [".mp3", ".wav", ".aac", ".ogg", ".m4a", ".flac", ".mp4", ".avi", ".mov", ".mkv"],
  
  subtitleStyle: {
    FontSize: 24,
    PrimaryColour: "&HFFFFFF", // белый
    OutlineColour: "&H000000", // чёрный
    Bold: true
  },
  
  // Типичные параметры кодирования видео для оптимизации
  encoding: {
    format: "libx264",  // H264 для максимальной совместимости
    preset: "medium",   // баланс скорости/качества
    crf: 23,           // качество (0=lossless, 23=default, 51=worst)
    pixfmt: "yuv420p"   // гарантирует совместимость с медиаплеерами
  },
  
  /** Базовые настройки аудио кодирования */
  audioSettings: {
    codec: "libmp3lame",     // MP3 кодек для максимальной совместимости 
    bitrate: "128k",         // 128 кбит/с — хорошее качество для речи и музыки
    channels: 2,             // стерео
    sampleRate: 44100        // 44.1 кГц стандартная частота дискретизации
  },
    
    tts: {
      provider: "kokoro",
    endpoint: "http://178.156.142.35:11402/v1/tts",
    voice: "en-US-Standard-A",
      format: "wav"
  },

  cleanup: {
    autoCleanDownloads: true,  // автоматическая очистка скачанных файлов
    autoCleanOutputs: false,   // НЕ удалять готовые видео автоматически
    cleanupAfterSec: 3600     // очистка через час после завершения задач
  },

  /** Webhook уведомления о статусе задач */
  webhooks: {
    enabled: false,
    url: null as string | null,
    // Можно расширить auth, retry policy и т.д.
  },
  // Дополнительные безопасные defaults
  concurrentJobs: 3,          // максимум одновременных заданий
  maxJobDurationSec: 1800,    // 30 минут максимум на задание
  apiRequestTimeout: 180000,   // 3 минуты timeout для внешних API
  uploadMaxSize: 10 * 1024 * 1024, // 10MB максимум размер файла
  
  /** Источники текста для субтитров и озвучки */
  textSources: {
    customText: null as string | null,
    transcribeAudio: false,   // транскрибировать ли аудиодорожку в субтитры
    subtitleText: null as string | null,  // явно заданный текст субтитров
  },

  // Совместимость со старым интерфейсом: если передаётся только текст,
  // создаём синтаксически корректную структуру plan  
  legacyTextFallback: true
};