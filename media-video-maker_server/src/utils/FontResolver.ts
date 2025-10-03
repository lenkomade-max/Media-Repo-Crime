import fs from "fs/promises";
import { log } from "../logger.js";

/**
 * Список возможных путей к шрифтам в порядке предпочтения
 */
const FONT_CANDIDATES = [
  // Linux (Debian/Ubuntu) - основной
  "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
  "/usr/share/fonts/dejavu/DejaVuSans.ttf",
  "/usr/share/fonts/TTF/DejaVuSans.ttf",
  
  // Linux - альтернативы
  "/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf",
  "/usr/share/fonts/liberation/LiberationSans-Regular.ttf",
  "/usr/share/fonts/truetype/noto/NotoSans-Regular.ttf",
  "/usr/share/fonts/noto/NotoSans-Regular.ttf",
  
  // macOS
  "/System/Library/Fonts/Helvetica.ttc",
  "/System/Library/Fonts/Arial.ttf",
  "/Library/Fonts/Arial.ttf",
  
  // Windows (если запускается через WSL)
  "/mnt/c/Windows/Fonts/arial.ttf",
  "/mnt/c/Windows/Fonts/calibri.ttf",
  
  // Fallback для докера
  "/app/fonts/DejaVuSans.ttf",
];

/**
 * Кэш найденного шрифта
 */
let cachedFontPath: string | null = null;

/**
 * Находит первый доступный шрифт из списка кандидатов
 */
export async function findAvailableFont(): Promise<string> {
  // Возвращаем кэшированный результат
  if (cachedFontPath) {
    return cachedFontPath;
  }
  
  // Проверяем переменную окружения
  const envFont = process.env.FONT_FILE;
  if (envFont) {
    try {
      await fs.access(envFont);
      log.info(`🔤 Font from ENV: ${envFont}`);
      cachedFontPath = envFont;
      return envFont;
    } catch {
      log.warn(`🔤 Font from ENV not found: ${envFont}`);
    }
  }
  
  // Перебираем кандидатов
  for (const fontPath of FONT_CANDIDATES) {
    try {
      await fs.access(fontPath);
      log.info(`🔤 Font found: ${fontPath}`);
      cachedFontPath = fontPath;
      return fontPath;
    } catch {
      // Продолжаем поиск
    }
  }
  
  // Критическая ошибка - шрифты не найдены
  log.error(`🔤 No fonts found! Checked ${FONT_CANDIDATES.length} candidates`);
  log.error(`🔤 Install fonts: apt-get install fonts-dejavu-core (Linux) or set FONT_FILE env variable`);
  
  // Возвращаем первый кандидат как fallback (пусть FFmpeg решает)
  const fallbackFont = FONT_CANDIDATES[0];
  log.warn(`🔤 Using fallback font: ${fallbackFont}`);
  return fallbackFont;
}

/**
 * Получить информацию о найденном шрифте
 */
export async function getFontInfo(): Promise<{ path: string; exists: boolean; size?: number }> {
  const fontPath = await findAvailableFont();
  
  try {
    const stats = await fs.stat(fontPath);
    return {
      path: fontPath,
      exists: true,
      size: stats.size
    };
  } catch {
    return {
      path: fontPath,
      exists: false
    };
  }
}

/**
 * Сбросить кэш шрифта (для тестирования)
 */
export function resetFontCache(): void {
  cachedFontPath = null;
}

/**
 * Проверить все кандидаты шрифтов (для диагностики)
 */
export async function diagnoseAllFonts(): Promise<{ path: string; available: boolean }[]> {
  const results: { path: string; available: boolean }[] = [];
  
  for (const fontPath of FONT_CANDIDATES) {
    try {
      await fs.access(fontPath);
      results.push({ path: fontPath, available: true });
    } catch {
      results.push({ path: fontPath, available: false });
    }
  }
  
  return results;
}
