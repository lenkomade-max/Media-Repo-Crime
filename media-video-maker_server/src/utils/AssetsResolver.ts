import fs from "fs/promises";
import path from "path";
import { log } from "../logger.js";

/**
 * Получить путь к ASSETS_DIR с fallback
 */
export function getAssetsDir(): string {
  return process.env.ASSETS_DIR || 
         process.env.PROJECT_ROOT || 
         "/root/media-video-maker_project";
}

/**
 * Получить путь к CRIME MATERIAL директории
 */
export function getCrimeMaterialDir(): string {
  return process.env.CRIME_MATERIAL_DIR || "/root/CRIME MATERIAL";
}

/**
 * Резолвинг пути к ассету
 */
export function resolveAssetPath(...segments: string[]): string {
  const assetsDir = getAssetsDir();
  return path.join(assetsDir, "assets", ...segments);
}

/**
 * Резолвинг пути к материалу
 */
export function resolveCrimeMaterialPath(filename: string): string {
  const crimeDir = getCrimeMaterialDir();
  return path.join(crimeDir, filename);
}

/**
 * Проверка существования ассета
 */
export async function checkAssetExists(assetPath: string): Promise<{ exists: boolean; fullPath: string; size?: number }> {
  try {
    const stats = await fs.stat(assetPath);
    return {
      exists: true,
      fullPath: assetPath,
      size: stats.size
    };
  } catch {
    return {
      exists: false,
      fullPath: assetPath
    };
  }
}

/**
 * Найти VHS эффекты
 */
export async function findVHSEffects(): Promise<string[]> {
  const vhsEffects: string[] = [];
  const assetsDir = getAssetsDir();
  
  const candidates = [
    path.join(assetsDir, "assets", "VHS 01 Effect.mp4"),
    path.join(assetsDir, "assets", "VHS 02 Effect.mp4"),
    path.join(assetsDir, "VHS 01 Effect.mp4"),
    path.join(assetsDir, "VHS 02 Effect.mp4"),
    // Поиск в различных локациях
    "/app/assets/VHS 01 Effect.mp4",
    "/app/assets/VHS 02 Effect.mp4"
  ];
  
  for (const candidate of candidates) {
    const check = await checkAssetExists(candidate);
    if (check.exists && !vhsEffects.includes(candidate)) {
      vhsEffects.push(candidate);
      log.info(`🎬 Found VHS effect: ${candidate} (${check.size} bytes)`);
    }
  }
  
  return vhsEffects;
}

/**
 * Информация о директориях проекта
 */
export async function getProjectInfo(): Promise<{
  assetsDir: string;
  crimeMaterialDir: string;
  vhsEffects: string[];
  assetsExists: boolean;
  crimeExists: boolean;
}> {
  const assetsDir = getAssetsDir();
  const crimeMaterialDir = getCrimeMaterialDir();
  
  const assetsCheck = await checkAssetExists(path.join(assetsDir, "assets"));
  const crimeCheck = await checkAssetExists(crimeMaterialDir);
  const vhsEffects = await findVHSEffects();
  
  return {
    assetsDir,
    crimeMaterialDir,
    vhsEffects,
    assetsExists: assetsCheck.exists,
    crimeExists: crimeCheck.exists
  };
}

/**
 * Получить все пути для диагностики
 */
export function getDiagnosticPaths() {
  return {
    ASSETS_DIR: process.env.ASSETS_DIR || "not set",
    PROJECT_ROOT: process.env.PROJECT_ROOT || "not set", 
    CRIME_MATERIAL_DIR: process.env.CRIME_MATERIAL_DIR || "not set",
    computed: {
      assetsDir: getAssetsDir(),
      crimeMaterialDir: getCrimeMaterialDir(),
      assetsPaths: [
        resolveAssetPath("VHS 01 Effect.mp4"),
        resolveAssetPath("VHS 02 Effect.mp4")
      ]
    }
  };
}
