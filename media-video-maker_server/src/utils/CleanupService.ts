import { FileDownloader } from './FileDownloader.js';
import { log } from '../logger.js';

export interface WebhookPayload {
  jobId: string;
  status: 'completed' | 'error' | 'cancelled';
  videoUrl?: string;
  downloadUrl?: string;
  error?: string;
  cleanupCompleted: boolean;
  timestamp: string;
}

export class CleanupService {
  private fileDownloader: FileDownloader;
  private webhookUrl?: string;

  constructor(webhookUrl?: string) {
    this.fileDownloader = new FileDownloader();
    this.webhookUrl = webhookUrl;
  }

  async cleanupAfterVideoCreation(jobId: string, videoPath: string): Promise<void> {
    try {
      log.info(`🧹 Автоочистка после создания видео для job ${jobId}`);
      
      // Очистка скачанных файлов
      await this.fileDownloader.cleanupDownloadedFiles(jobId);
      
      // Отправка webhook уведомления
      await this.notifyVideoReady(jobId, videoPath);
      
      log.info(`✅ Автоочистка завершена для job ${jobId}`);
      
    } catch (error: any) {
      log.error(`❌ Ошибка автоочистки для job ${jobId}: ${error.message}`);
      throw error;
    }
  }

  async cleanupOnError(jobId: string, error: string): Promise<void> {
    try {
      log.info(`🧹 Очистка при ошибке для job ${jobId}`);
      
      // Очистка скачанных файлов
      await this.fileDownloader.cleanupDownloadedFiles(jobId);
      
      // Отправка webhook уведомления об ошибке
      await this.notifyError(jobId, error);
      
      log.info(`✅ Очистка при ошибке завершена для job ${jobId}`);
      
    } catch (cleanupError: any) {
      log.error(`❌ Ошибка очистки при ошибке для job ${jobId}: ${cleanupError.message}`);
    }
  }

  async schedulePeriodicCleanup(): Promise<void> {
    try {
      log.info(`🧹 Запуск периодической очистки`);
      
      // Очистка файлов старше 24 часов
      await this.fileDownloader.cleanupOldFiles(24);
      
      log.info(`✅ Периодическая очистка завершена`);
      
    } catch (error: any) {
      log.error(`❌ Ошибка периодической очистки: ${error.message}`);
    }
  }

  async notifyVideoReady(jobId: string, videoPath: string): Promise<void> {
    if (!this.webhookUrl) {
      log.info(`📤 Webhook URL не настроен, пропускаем уведомление`);
      return;
    }

    try {
      const payload: WebhookPayload = {
        jobId,
        status: 'completed',
        videoUrl: `http://178.156.142.35:8080/${videoPath.split('/').pop()}`,
        downloadUrl: `http://178.156.142.35:8080/${videoPath.split('/').pop()}`,
        cleanupCompleted: true,
        timestamp: new Date().toISOString()
      };

      const response = await fetch(this.webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'MediaVideoMaker/1.0'
        },
        body: JSON.stringify(payload),
        // timeout: 10000
      });

      if (response.ok) {
        log.info(`📤 Webhook уведомление отправлено для job ${jobId}`);
      } else {
        log.warn(`⚠️ Webhook уведомление не отправлено: HTTP ${response.status}`);
      }

    } catch (error: any) {
      log.error(`❌ Ошибка отправки webhook для job ${jobId}: ${error.message}`);
    }
  }

  async notifyError(jobId: string, error: string): Promise<void> {
    if (!this.webhookUrl) {
      log.info(`📤 Webhook URL не настроен, пропускаем уведомление об ошибке`);
      return;
    }

    try {
      const payload: WebhookPayload = {
        jobId,
        status: 'error',
        error,
        cleanupCompleted: true,
        timestamp: new Date().toISOString()
      };

      const response = await fetch(this.webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'MediaVideoMaker/1.0'
        },
        body: JSON.stringify(payload),
        // timeout: 10000
      });

      if (response.ok) {
        log.info(`📤 Webhook уведомление об ошибке отправлено для job ${jobId}`);
      } else {
        log.warn(`⚠️ Webhook уведомление об ошибке не отправлено: HTTP ${response.status}`);
      }

    } catch (webhookError: any) {
      log.error(`❌ Ошибка отправки webhook об ошибке для job ${jobId}: ${webhookError.message}`);
    }
  }

  setWebhookUrl(url: string): void {
    this.webhookUrl = url;
    log.info(`📤 Webhook URL установлен: ${url}`);
  }
}
