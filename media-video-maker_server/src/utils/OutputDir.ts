import fs from "fs/promises";
import path from "path";
import { log } from "../logger.js";

/**
 * Получить путь к OUTPUT_DIR с fallback
 */
export function getOutputDir(): string {
  return process.env.OUTPUT_DIR || "/app/output";
}

/**
 * Информация о OUTPUT_DIR
 */
export interface OutputDirInfo {
  path: string;
  exists: boolean;
  permissions?: string;
  writable: boolean;
  size?: string;
  error?: string;
}

/**
 * Проверить состояние OUTPUT_DIR
 */
export async function checkOutputDir(): Promise<OutputDirInfo> {
  const outputDir = getOutputDir();
  
  try {
    const stats = await fs.stat(outputDir);
    const permissions = '0' + (stats.mode & parseInt('777', 8)).toString(8);
    
    // Проверка записи через создание тестового файла
    let writable = false;
    try {
      const testFile = path.join(outputDir, `.write_test_${Date.now()}`);
      await fs.writeFile(testFile, "test");
      await fs.unlink(testFile);
      writable = true;
    } catch {
      writable = false;
    }
    
    // Подсчет размера
    let size = "unknown";
    try {
      const { stdout } = await import("execa").then(m => m.execa("du", ["-sh", outputDir]));
      size = stdout.split("\t")[0];
    } catch {
      // Игнорируем ошибки du
    }
    
    return {
      path: outputDir,
      exists: true,
      permissions,
      writable,
      size,
    };
    
  } catch (error: any) {
    return {
      path: outputDir,
      exists: false,
      writable: false,
      error: error.message,
    };
  }
}

/**
 * Создать OUTPUT_DIR если не существует
 */
export async function ensureOutputDir(): Promise<OutputDirInfo> {
  const outputDir = getOutputDir();
  const startTime = Date.now();
  
  try {
    log.info(`📂 Ensuring OUTPUT_DIR: ${outputDir}`);
    
    // Проверяем текущее состояние
    let info = await checkOutputDir();
    
    if (!info.exists) {
      log.info(`📂 Creating OUTPUT_DIR: ${outputDir}`);
      
      // Создаем директорию рекурсивно
      await fs.mkdir(outputDir, { recursive: true, mode: 0o755 });
      
      // Повторная проверка
      info = await checkOutputDir();
      
      if (info.exists) {
        log.info(`✅ OUTPUT_DIR created: ${outputDir} (${Date.now() - startTime}ms)`);
      } else {
        log.error(`❌ OUTPUT_DIR creation failed: ${outputDir}`);
      }
    } else {
      log.info(`✅ OUTPUT_DIR exists: ${outputDir} (permissions: ${info.permissions})`);
    }
    
    // Проверяем права записи
    if (info.exists && !info.writable) {
      log.error(`❌ OUTPUT_DIR not writable: ${outputDir} (permissions: ${info.permissions})`);
      log.error(`💡 Fix permissions: chmod 755 ${outputDir}`);
    }
    
    return info;
    
  } catch (error: any) {
    log.error(`❌ OUTPUT_DIR setup failed (${Date.now() - startTime}ms): ${error.message}`);
    
    return {
      path: outputDir,
      exists: false,
      writable: false,
      error: error.message,
    };
  }
}

/**
 * Очистить старые файлы в OUTPUT_DIR
 */
export async function cleanupOutputDir(maxAgeHours: number = 24): Promise<{ deleted: number; errors: number }> {
  const outputDir = getOutputDir();
  const cutoffTime = Date.now() - (maxAgeHours * 60 * 60 * 1000);
  
  let deleted = 0;
  let errors = 0;
  
  try {
    log.info(`🧹 Cleaning OUTPUT_DIR: ${outputDir} (older than ${maxAgeHours}h)`);
    
    const info = await checkOutputDir();
    if (!info.exists) {
      log.warn(`⚠️  OUTPUT_DIR doesn't exist: ${outputDir}`);
      return { deleted, errors };
    }
    
    const entries = await fs.readdir(outputDir);
    
    for (const entry of entries) {
      try {
        const filePath = path.join(outputDir, entry);
        const stats = await fs.stat(filePath);
        
        if (stats.mtime.getTime() < cutoffTime) {
          await fs.unlink(filePath);
          deleted++;
          log.debug(`🗑️  Deleted old file: ${entry}`);
        }
        
      } catch (error: any) {
        errors++;
        log.warn(`⚠️  Error cleaning file ${entry}: ${error.message}`);
      }
    }
    
    log.info(`🧹 OUTPUT_DIR cleanup complete: ${deleted} deleted, ${errors} errors`);
    
  } catch (error: any) {
    log.error(`❌ OUTPUT_DIR cleanup failed: ${error.message}`);
    errors++;
  }
  
  return { deleted, errors };
}

/**
 * Получить список файлов в OUTPUT_DIR
 */
export async function listOutputDirFiles(): Promise<{ name: string; size: number; modified: Date }[]> {
  const outputDir = getOutputDir();
  
  try {
    const entries = await fs.readdir(outputDir);
    const files: { name: string; size: number; modified: Date }[] = [];
    
    for (const entry of entries) {
      try {
        const filePath = path.join(outputDir, entry);
        const stats = await fs.stat(filePath);
        
        if (stats.isFile()) {
          files.push({
            name: entry,
            size: stats.size,
            modified: stats.mtime,
          });
        }
      } catch {
        // Игнорируем ошибки отдельных файлов
      }
    }
    
    return files.sort((a, b) => b.modified.getTime() - a.modified.getTime());
    
  } catch (error: any) {
    log.error(`❌ Failed to list OUTPUT_DIR: ${error.message}`);
    return [];
  }
}
