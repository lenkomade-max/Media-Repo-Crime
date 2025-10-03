# media-video-maker

Сервис собирает видео из фото и/или видео. Ббез Pexels. Есть REST и MCP.

## Запуск
```bash
docker build -t media-video-maker .
docker run -it --rm   -e LOG_LEVEL=debug -e PORT=4123   -p 4123:4123   -v /root/video_factory/assets:/app/data:ro   -v /root/video_factory/videos:/app/output   media-video-maker
```

## Тестирование модулей

Проект разделён на модули: **subtitles** (субтитры), **voiceover** (озвучка), **overlays** (текстовые накладки), **music** (фоновая музыка).

### Структура тестов
```
media-video-maker_server/
├── tests/
│   ├── input/          # Тестовые входные файлы
│   ├── output/         # Результаты тестов (игнорируется Git)
│   ├── run_all_tests.sh   # Запуск всех тестов
│   ├── test_subtitles.sh  # Тест субтитров
│   ├── test_voiceover.sh  # Тест озвучки
│   ├── test_overlays.sh   # Тест текстовых накладок
│   └── test_music.sh      # Тест фоновой музыки
├── logs/               # Логи выполнения (игнорируется Git)
└── modules/            # Папки модулей
    ├── subtitles/
    ├── voiceover/
    ├── overlays/
    └── music/
```

### Запуск тестов

#### Все модули сразу:
```bash
cd media-video-maker_server
./tests/run_all_tests.sh
```

#### Отдельный модуль:
```bash
./tests/test_subtitles.sh
./tests/test_voiceover.sh      # Требует OPENAI_API_KEY
./tests/test_overlays.sh
./tests/test_music.sh
```

### Принципы тестирования
- Каждый тест проверяет **реальное применение эффекта** (не имитацию)
- Результаты сохраняются в `tests/output/`
- Логи пишутся в `logs/module_name.log`
- Тест успешен только если итоговое видео содержит ожидаемый эффект

### Требования для тестов
- Сервис должен быть запущен на `http://127.0.0.1:4123`
- Для `test_voiceover.sh`: установите `OPENAI_API_KEY` в env
- FFmpeg должен быть доступен для проверки потоков
