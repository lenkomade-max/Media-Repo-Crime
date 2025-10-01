// 🧰 filesystem helpers
import fs from "fs-extra";
import path from "path";
import { log } from "../logger.js";

/**
 * Проверяет существование файла
 */
export async function validateFileExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}