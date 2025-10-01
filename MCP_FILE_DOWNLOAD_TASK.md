# ЗАДАЧА: Добавить поддержку скачивания файлов по URL в MCP API

## КОНТЕКСТ ПРОЕКТА
Media Video Maker - система для создания видео из фото/видео с эффектами, озвучкой и субтитрами. Работает через MCP API на порту 4123.

## ПРОБЛЕМА
Сейчас MCP API принимает только JSON с путями к локальным файлам в папке `assets/`. Нет возможности передать URL файла для автоматического скачивания.

## ТЕКУЩАЯ АРХИТЕКТУРА

### Структура проекта:
```
/root/media-video-maker_project/
├── src/
│   ├── media-server.ts          # Основной API сервер
│   ├── types/plan.ts            # Схемы валидации
│   ├── pipeline/
│   │   ├── MediaCreator.ts      # Главный обработчик
│   │   ├── MediaProcessor.ts    # Обработка медиа
│   │   ├── ConcatPlanBuilder.ts # Планирование
│   │   ├── OverlayRenderer.ts   # Оверлеи
│   │   └── VideoOverlayRenderer.ts
│   ├── audio/
│   │   ├── TTSService.ts        # TTS сервис
│   │   └── AudioMixer.ts        # Микширование
│   ├── effects/
│   │   └── EffectsProcessor.ts  # Обработка эффектов
│   ├── utils/
│   │   ├── ffmpeg.ts           # FFmpeg утилиты
│   │   ├── ffprobe.ts          # FFprobe утилиты
│   │   ├── fs.ts               # Файловая система
│   │   └── id.ts               # Генерация ID
│   ├── server/
│   │   ├── mcp-server.ts        # MCP сервер
│   │   ├── mcp.ts              # MCP инструменты
│   │   └── rest.ts             # REST API
│   ├── storyboard/
│   │   └── StoryboardAdapter.ts
│   ├── subtitles/
│   │   └── SubtitlesStyler.ts
│   ├── config/
│   │   └── Defaults.ts
│   ├── logger.ts               # Логирование
│   └── types.d.ts              # Типы
├── assets/                      # Локальные файлы
│   ├── CRIME_MATERIAL/         # 123 фото для тестов
│   ├── background_music.mp3    # Фоновая музыка
│   ├── VHS 01 Effect.mp4       # VHS эффекты
│   ├── VHS 02 Effect.mp4
│   ├── overlay_arrow.mov       # Оверлеи
│   └── *.wav, *.srt           # TTS файлы
└── dist/                       # Скомпилированный код
```

### Текущий API endpoint:
```
POST /api/create-video
Content-Type: application/json

{
  "files": [
    {"id": "img1", "src": "assets/CRIME_MATERIAL/image1.jpg", "type": "photo"}
  ],
  "output": "video.mp4",
  "duration": 60,
  "resolution": "1080x1920"
}
```

### Зависимости:
- express, zod, execa, fs-extra, form-data, uuid

## ЗАДАЧА

### 1. Добавить поддержку URL в схему
В `src/types/plan.ts` расширить схемы для всех типов файлов:

**MediaFileSchema (фото/видео):**
```typescript
export const MediaFileSchema = z.object({
  id: z.string(),
  src: z.string(), // Может быть путь или URL
  type: z.enum(["photo", "video"]).default("photo"),
  download: z.boolean().optional(), // Флаг для скачивания
  // ... остальные поля
});
```

**TTSOptionsSchema (озвучка):**
```typescript
export const TTSOptionsSchema = z.object({
  provider: z.enum(["kokoro", "openai", "none"]).default("none"),
  endpoint: z.string().optional(),
  voice: z.string().default("alloy"),
  model: z.string().default("gpt-4o-mini-tts"),
  format: z.enum(["mp3", "wav"]).default("mp3"),
  speed: z.number().default(1.0),
  // ДОБАВИТЬ:
  download: z.boolean().optional(), // Для внешних TTS файлов
});
```

**PlanInputSchema (музыка):**
```typescript
export const PlanInputSchema = z.object({
  files: z.array(MediaFileSchema).nonempty(),
  music: z.string().optional(), // Может быть URL
  musicDownload: z.boolean().optional(), // Флаг для скачивания музыки
  // ... остальные поля
});
```

### 2. Создать сервис скачивания
Создать `src/utils/FileDownloader.ts`:
```typescript
export class FileDownloader {
  // Основные методы
  async downloadFile(url: string, targetPath: string): Promise<string>
  async isUrl(src: string): boolean
  async ensureFileExists(src: string): Promise<string>
  
  // Специализированные методы
  async downloadImage(url: string, id: string): Promise<string>
  async downloadVideo(url: string, id: string): Promise<string>
  async downloadAudio(url: string, id: string): Promise<string>
  
  // Валидация и безопасность
  async validateUrl(url: string): Promise<boolean>
  async getFileType(url: string): Promise<'image' | 'video' | 'audio' | 'unknown'>
  async checkFileSize(url: string): Promise<number>
  
  // Очистка и управление
  async cleanupDownloadedFiles(jobId: string): Promise<void>
  async cleanupOldFiles(maxAgeHours: number): Promise<void>
  async getDownloadedFilesList(jobId: string): Promise<string[]>
}
```

### 2.1. Создать сервис очистки
Создать `src/utils/CleanupService.ts`:
```typescript
export class CleanupService {
  // Автоочистка после успешного создания видео
  async cleanupAfterVideoCreation(jobId: string): Promise<void>
  
  // Периодическая очистка старых файлов
  async schedulePeriodicCleanup(): Promise<void>
  
  // Очистка при ошибках
  async cleanupOnError(jobId: string): Promise<void>
  
  // Webhook уведомления
  async notifyVideoReady(jobId: string, videoPath: string): Promise<void>
}
```

### 3. Интегрировать в MediaCreator
В `src/pipeline/MediaCreator.ts` добавить логику:
- **Фото/видео:** Проверка URL → скачивание в `assets/downloads/images/` → обновление путей
- **Музыка:** Проверка URL → скачивание в `assets/downloads/audio/` → обновление пути
- **TTS файлы:** Проверка URL → скачивание в `assets/downloads/tts/` → обновление пути
- **Оверлеи:** Проверка URL → скачивание в `assets/downloads/overlays/` → обновление путей
- **Автоочистка:** После успешного создания видео → удаление всех скачанных файлов
- **Webhook:** Отправка уведомления в n8n о готовности видео

### 4. Добавить endpoint для загрузки
В `src/media-server.ts`:
```typescript
app.post("/api/upload", upload.single('file'), (req, res) => {
  // Сохранение файла в assets/
  // Возврат пути к файлу
});
```

## ТРЕБОВАНИЯ

### Функциональность:
1. ✅ **Фото/видео:** Поддержка URL в JSON запросах
2. ✅ **Музыка:** Скачивание фоновой музыки по URL
3. ✅ **TTS файлы:** Скачивание готовых озвучек по URL
4. ✅ **Оверлеи:** Скачивание эффектов и графики по URL
5. ✅ **Валидация:** URL и типов файлов
6. ✅ **Обработка ошибок:** Скачивания и валидации
7. ✅ **Кэширование:** Скачанных файлов
8. ✅ **Автоочистка:** Удаление скачанных файлов после успешного создания видео
9. ✅ **Webhook уведомления:** Отправка статуса в n8n/внешние сервисы

### Безопасность:
- **URL валидация:** Только http/https
- **MIME типы:** Проверка для каждого типа файла
- **Размер файлов:** Ограничения по типам
  - Фото: до 50MB
  - Видео: до 500MB  
  - Аудио: до 100MB
- **Изоляция:** Файлы в папке downloads/ по типам

### Производительность:
- Параллельное скачивание
- Прогресс скачивания
- Таймауты и retry логика

## ПРИМЕР ИСПОЛЬЗОВАНИЯ

### До (не работает):
```json
{
  "files": [
    {"id": "img1", "src": "https://example.com/image.jpg", "type": "photo"}
  ]
}
```

### После (должно работать):
```json
{
  "files": [
    {"id": "img1", "src": "https://example.com/image.jpg", "type": "photo", "download": true},
    {"id": "vid1", "src": "https://example.com/video.mp4", "type": "video", "download": true}
  ],
  "music": "https://example.com/background.mp3",
  "musicDownload": true,
  "tts": {
    "provider": "none",
    "download": true
  },
  "voiceFile": "https://example.com/voiceover.wav"
}
```

## ФАЙЛЫ ДЛЯ ИЗМЕНЕНИЯ

1. `src/types/plan.ts` - расширить схему
2. `src/utils/FileDownloader.ts` - новый сервис (создать)
3. `src/utils/CleanupService.ts` - новый сервис очистки (создать)
4. `src/pipeline/MediaCreator.ts` - интеграция скачивания и очистки
5. `src/media-server.ts` - новый endpoint для загрузки
6. `package.json` - добавить зависимости (multer, node-fetch)
7. `src/utils/fs.ts` - возможно расширить утилиты

## СЕРВЕР И ПУТИ

### Сервер: 178.156.142.35
### Пути на сервере:
- Проект: `/root/media-video-maker_project/`
- API: `http://178.156.142.35:4123/api/create-video`
- Логи: `/root/media-video-maker_project/server_new.log`
- Вывод: `/app/output/`
- Ассеты: `/root/media-video-maker_project/assets/`

### Команды для работы:
```bash
# Подключение к серверу
ssh -o StrictHostKeyChecking=no root@178.156.142.35

# Переход в проект
cd /root/media-video-maker_project

# Сборка проекта
npm run build

# Запуск сервера
node dist/media-server.js > server_new.log 2>&1 &

# Проверка статуса
curl http://localhost:4123/health
```

## КРИТЕРИИ УСПЕХА

1. ✅ JSON с URL принимается без ошибок
2. ✅ Файлы скачиваются в assets/downloads/
3. ✅ Видео создается успешно
4. ✅ **Автоочистка:** Скачанные файлы удаляются после создания видео
5. ✅ **Webhook:** n8n получает уведомление о готовности видео
6. ✅ **Периодическая очистка:** Старые файлы удаляются автоматически
7. ✅ Ошибки скачивания обрабатываются
8. ✅ API остается обратно совместимым

## ТЕСТИРОВАНИЕ

### 1. Тест скачивания файла:
```bash
# Проверить что URL доступен
curl -I "https://picsum.photos/800/600"

# Скачать файл вручную
curl -o test_image.jpg "https://picsum.photos/800/600"
```

### 2. Тест API с URL:
```bash
curl -X POST http://localhost:4123/api/create-video \
  -H "Content-Type: application/json" \
  -d '{
    "files": [
      {"id": "test", "src": "https://picsum.photos/800/600", "type": "photo", "download": true}
    ],
    "output": "test_download.mp4",
    "duration": 5
  }'
```

### 3. Тест с несколькими файлами:
```bash
curl -X POST http://localhost:4123/api/create-video \
  -H "Content-Type: application/json" \
  -d '{
    "files": [
      {"id": "img1", "src": "https://picsum.photos/800/600", "type": "photo", "download": true},
      {"id": "img2", "src": "https://via.placeholder.com/800x600/FF0000/FFFFFF?text=Test", "type": "photo", "download": true}
    ],
    "output": "test_multi_download.mp4",
    "duration": 10
  }'
```

### 4. Тест с музыкой:
```bash
curl -X POST http://localhost:4123/api/create-video \
  -H "Content-Type: application/json" \
  -d '{
    "files": [
      {"id": "img1", "src": "https://picsum.photos/800/600", "type": "photo", "download": true}
    ],
    "music": "https://file-examples.com/storage/fe68c0b5b5b5b5b5b5b5b5b/2017/11/file_example_MP3_700KB.mp3",
    "musicDownload": true,
    "output": "test_with_music.mp4",
    "duration": 10
  }'
```

### 5. Проверка очистки:
```bash
# Проверить что файлы скачались
ls -la /root/media-video-maker_project/assets/downloads/

# Проверить что файлы удалились после создания видео
ls -la /root/media-video-maker_project/assets/downloads/
```

## ПРИОРИТЕТ: ВЫСОКИЙ
Эта функция критична для интеграции с внешними сервисами (n8n, Zapier, etc.)

## ДОПОЛНИТЕЛЬНАЯ ИНФОРМАЦИЯ

### Текущие зависимости в package.json:
```json
{
  "dependencies": {
    "@modelcontextprotocol/sdk": "^1.7.0",
    "execa": "^8.0.1",
    "express": "^4.19.2",
    "form-data": "^4.0.0",
    "fs-extra": "^11.2.0",
    "mime-types": "^2.1.35",
    "pureimage": "^0.4.18",
    "uuid": "^9.0.1",
    "zod": "^3.23.8"
  }
}
```

### Нужно добавить:
- `multer` - для загрузки файлов
- `node-fetch` или `axios` - для скачивания по URL
- `mime-types` - уже есть

### Примеры тестовых URL (ПРОВЕРЕННЫЕ И РАБОТАЮЩИЕ):

**Фото (быстрые тесты):**
- `https://picsum.photos/800/600` - случайные фото (работает)
- `https://via.placeholder.com/800x600/000000/FFFFFF?text=Test` - placeholder (работает)
- `https://httpbin.org/image/jpeg` - тестовое изображение (работает)

**Видео (короткие для тестов):**
- `https://sample-videos.com/zip/10/mp4/SampleVideo_1280x720_1mb.mp4` - 1MB видео
- `https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4` - 4MB видео
- `https://www.learningcontainer.com/wp-content/uploads/2020/05/sample-mp4-file.mp4` - 5MB видео

**Аудио/музыка (короткие):**
- `https://www.soundjay.com/misc/sounds/bell-ringing-05.wav` - 1MB аудио
- `https://www2.cs.uic.edu/~i101/SoundFiles/BabyElephantWalk60.wav` - 1MB аудио
- `https://file-examples.com/storage/fe68c0b5b5b5b5b5b5b5b5b/2017/11/file_example_MP3_700KB.mp3` - 700KB MP3

**TTS файлы:**
- `https://file-examples.com/storage/fe68c0b5b5b5b5b5b5b5b5b/2017/11/file_example_MP3_700KB.mp3` - готовый MP3
- `https://www.soundjay.com/misc/sounds/bell-ringing-05.wav` - готовый WAV

---

**ВАЖНО**: Сохранить обратную совместимость! Существующие запросы с локальными путями должны продолжать работать.

## ЛОГИКА АВТООЧИСТКИ

### Сценарий работы:
1. **n8n отправляет запрос** с URL файлов
2. **MCP скачивает файлы** в `assets/downloads/`
3. **Создается видео** из скачанных файлов
4. **Видео сохраняется** в `/app/output/`
5. **n8n получает webhook** с ссылкой на готовое видео
6. **n8n скачивает видео** на Google Drive
7. **MCP удаляет все скачанные файлы** из `assets/downloads/`
8. **Сервер остается чистым** без лишних файлов

### Структура папок для очистки:
```
assets/downloads/
├── images/          # Скачанные фото
├── videos/          # Скачанные видео  
├── audio/           # Скачанные аудио
├── tts/             # TTS файлы
└── overlays/        # Оверлеи
```

### Webhook уведомления:
```json
{
  "jobId": "abc123",
  "status": "completed",
  "videoUrl": "http://178.156.142.35:8080/video_abc123.mp4",
  "downloadUrl": "http://178.156.142.35:8080/video_abc123.mp4",
  "cleanupCompleted": true,
  "timestamp": "2025-09-30T21:45:00Z"
}
```

---

## ПЛАН РЕАЛИЗАЦИИ

### Этап 1: Базовое скачивание
1. Создать `src/utils/FileDownloader.ts`
2. Добавить зависимости в `package.json` (node-fetch, multer)
3. Протестировать скачивание простого изображения
4. Интегрировать в `MediaCreator.ts`

### Этап 2: Полная функциональность
1. Расширить схемы в `src/types/plan.ts`
2. Добавить поддержку всех типов файлов
3. Создать `src/utils/CleanupService.ts`
4. Добавить webhook уведомления

### Этап 3: Тестирование
1. Тест с одним изображением
2. Тест с несколькими файлами
3. Тест с музыкой
4. Тест очистки файлов
5. Тест webhook уведомлений

### Этап 4: Оптимизация
1. Параллельное скачивание
2. Кэширование
3. Обработка ошибок
4. Логирование

---

**СТАРТ**: Начать с создания `src/utils/FileDownloader.ts` и тестирования на `https://picsum.photos/800/600`.
