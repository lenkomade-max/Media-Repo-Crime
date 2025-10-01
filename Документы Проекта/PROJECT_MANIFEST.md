Расширенный манифест проекта Media Video Maker

Версия: 1.2
⚠️ Важно: Это основной документ. Его нельзя переписывать или сокращать. Исполнение шагов разрешено без отдельного согласования, если действия строго соответствуют этому манифесту, `.cursorrules` и `DEV_PROMPT`. Все изменения сопровождаются diff и командами.

🎯 Общая цель

Система для автоматизированного монтажа коротких роликов с:

субтитрами (Whisper),

озвучкой (TTS),

эффектами (VHS, ретро, LUT),

видео-оверлеями,

текстовыми оверлеями,

API и агентами для полной автоматизации.

🛠 Модули и их обязанности
1. 🎬 Таймлайн (главный слой)

Основное видео или фото — это база, на которую накладываются все остальные элементы.

Каждый клип описывается в JSON:

{ "type": "video", "file": "assets/main.mp4", "start": 0, "end": 30 }


Поддержка фото: type: "image".

2. 📝 Субтитры (Whisper ASR)
Задачи:

Автоматически распознавать речь из аудио/видео.

Поддержка языков:  EN

Генерация .srt или .json с таймкодами.

Формат JSON:
"subtitles": {
  "engine": "whisper",
  "file": "assets/main.mp4",
  "language": "en",
  "output": "assets/subs.srt",
  "style": {
    "font": "Arial",
    "size": 24,
    "color": "#FFFFFF",
    "background": "#00000080",
    "position": "bottom"
  }
}

Особенности:

Автосинхронизация с голосом.

Возможность редактирования текста перед рендером.

Экспорт в .srt, .ass, .vtt.

3. 🔊 Озвучка (TTS) — модуль Kokoro
Задачи:

Генерация озвучки на основе текста.

Поддержка нескольких голосов (мужские, женские).

Поддержка нескольких языков (EN.

Формат JSON:
"tts": {
  "engine": "kokoro",
  "text": "This is a sample narration.",
  "voice": "en_male_1",
  "language": "en",
  "output": "assets/voiceover.mp3",
  "options": {
    "speed": 1.0,
    "pitch": 0,
    "volume": 1.0
  }
}

Особенности:

Поддержка синхронизации с субтитрами.

Возможность менять тембр, скорость и тон.

Возможность вставлять паузы через разметку:

Hello <pause=1000ms> how are you?

4. 🎨 Визуальные эффекты
VHS / Ретро

5 готовых VHS-эффектов.

5 готовых ретро-эффектов.

Применяются через blendMode.

LUT (цветокоррекция)

Загрузка .cube файлов.

JSON:

"lut": {
  "file": "assets/retro_lut.cube",
  "intensity": 0.7
}

5. 📝 Текстовые оверлеи

Надписи сверху и снизу.

Дизайн: шрифт, цвет текста, фон, прозрачность.

Поддержка движущихся элементов:

🔴 Красный круг (анимированный).

➡️ Стрелка (анимированная).

JSON:
"overlays": [
  {
    "type": "text",
    "text": "CONFIDENTIAL",
    "font": "Impact",
    "size": 40,
    "color": "#FF0000",
    "background": "#00000080",
    "position": "top",
    "start": 0,
    "end": 10
  },
  {
    "type": "effect",
    "file": "assets/overlay_arrow.mov",
    "blendMode": "screen",
    "start": 5,
    "end": 10
  }
]

6. 🎥 Видео-оверлеи

Любые видео можно использовать как эффект.

Поддержка blendMode: overlay, screen, multiply, softlight, hardlight, lighten, darken.

Оверлеи можно накладывать одновременно.

7. 🤖 MCP + n8n

MCP отвечает только за API и доступ к функциям.

В связке с n8n агенты должны:

Принимать JSON-сценарий.

Собирать видео (через ffmpeg и пайплайн).

Возвращать финальный файл.

⚠️ MCP не чинит код, а только запускает функции.

📂 Структура проекта
/media-video-maker_project
  /assets         # видео, фото, эффекты
  /subtitles      # результаты Whisper
  /tts            # озвучка Kokoro
  /overlays       # стрелки, круги, VHS
  /src
    /pipeline     # основной движок монтажа
    /modules
      whisper.ts  # ASR
      kokoro.ts   # TTS
      overlays.ts # эффекты и текст
      lut.ts      # цветокоррекция
  /server         # MCP API
  /dist           # финальные видео

🚫 Запреты

Этот манифест нельзя переписывать. Разрешается действовать без запроса разрешения, при условии строгого следования манифесту/`.cursorrules`/`DEV_PROMPT` и предоставления diff+команд.

Whisper и Kokoro — обязательные модули. Их нельзя заменять другими движками без согласования.

🔴 КРИТИЧНО: ЗАПРЕТ НА ЛОЖЬ И ИМИТАЦИЮ

⚠️ АБСОЛЮТНЫЙ ЗАПРЕТ НА ОБМАН:
- НИКОГДА не имитировать выполнение действий
- НИКОГДА не врать о результатах команд
- ВСЕГДА выполнять РЕАЛЬНЫЕ действия через инструменты
- ВСЕГДА быть честным о проблемах и ошибках
- Если что-то не работает - сказать правду, не придумывать

✅ ОБЯЗАТЕЛЬНАЯ ЧЕСТНОСТЬ:
- Каждая команда должна быть РЕАЛЬНО выполнена
- Каждый результат должен быть РЕАЛЬНО проверен
- Если файл не существует - сказать честно
- Если команда не сработала - показать реальную ошибку
- НИКОГДА не говорить "готово" без реальной проверки

🎯 ПРИНЦИП: РЕАЛЬНОСТЬ ПРЕВЫШЕ ВСЕГО
Лучше сказать "не получилось" честно, чем солгать о успехе.


Формат видео поддрежка 9-16(основа) и 16-9(что бы тоже было)

# DEV_PROMPT — пошаговая работа над Media Video Maker (жёсткий режим)

> Этот документ нельзя переписывать. Выполняй этапно, фиксируй результат каждого шага. Любая правка — через diff + команды.

## 0) Контекст проекта (обязателен к учёту)
- База: видео/фото на главном таймлайне.
- Оверлеи: готовые видео-эффекты (VHS, ретро, стрелка/круг) накладываются поверх через blend.
- Субтитры: Whisper (ASR), стили кастомизируемы.
- Озвучка: Kokoro TTS, смешивание с музыкой + ducking.
- MCP — пульт управления (через n8n/агентов), не чинит код.
- Рабочие ассеты (пример): `/root/media-video-maker_project/assets/`
  - `assets/Test video Main.mp4` — ОСНОВНАЯ ДОРОЖКА
  - `assets/VHS 01 Effect.mp4`, `assets/VHS 02 Effect.mp4` — эффекты
  - `assets/overlay_arrow.mov` — стрелка/кружок (эффект)

## 1) Этапы и критерии (Stage Gates)

### S1 — Чистая сборка
**Команда**
npm run build

markdown
Копировать код
**Критерий OK**: сборка без ошибок.  
**Если ошибки**: перечисли коды TS и строки; предложи минимальные патчи (diff), не трогая dist/.

### S2 — Валидация сценария (JSON)
**Правила**
- `timeline.base[]` — минимум 1 видео.
- `timeline.overlays[]` — каждое поле: `file`, `blendMode` (из списка), `start`, `end`.
- Все файлы должны существовать; `0 <= start < end <= duration(base)`.

**Проверки**
ls -lh assets/
ffprobe -v error -show_entries format=duration -of default=nw=1:nk=1 "assets/Test video Main.mp4"

markdown
Копировать код
**Критерий OK**: все файлы на месте; времена валидны; blendMode из списка.

### S3 — Быстрый прокси-рендер (без оверлеев)
**Команда (пример)**
ffmpeg -y -i "assets/Test video Main.mp4"
-vf "scale=-2:480" -c:v libx264 -crf 28 -preset veryfast
-map 0:a? -c:a aac -b:a 128k out/proxy_base.mp4

bash
Копировать код
**Критерий OK**: out/proxy_base.mp4 создан, длительность ≈ базовой.

### S4 — Быстрый прокси с оверлеями (blend)
**Пример 2-х оверлеев цепочкой**
ffmpeg -y -i "assets/Test video Main.mp4"
-i "assets/VHS 01 Effect.mp4"
-i "assets/overlay_arrow.mov"
-filter_complex "[0:v][1:v]blend=all_mode=overlay:shortest=1[tmp];
[tmp][2:v]blend=all_mode=screen:shortest=1[v]"
-map "[v]" -map 0:a? -c:a aac -b:a 128k
-vf "scale=-2:480" -c:v libx264 -crf 28 -preset veryfast
out/proxy_overlays.mp4

markdown
Копировать код
**Критерий OK**: основная дорожка видна, эффекты наложены, без клипов/черного экрана.

### S5 — Кадровая проверка (QA-стоп-кадры)
**Команды**
mkdir -p out/frames
ffmpeg -y -i out/proxy_overlays.mp4 -vf fps=1/2 out/frames/frame_%03d.jpg

markdown
Копировать код
Просмотри 6–10 кадров с равным шагом (каждые 2 сек).  
**Критерий OK**: на кадрах видно правильное наложение, база не перекрыта.

### S6 — Whisper субтитры (черновик)
**Требование**: сгенерировать .srt/.ass, наложить в прокси.
(Если Whisper запускается вне Node — приложи команду; если внутри — дай npm-скрипт.)
**Пример наложения субтитров `.ass`:**
ffmpeg -y -i out/proxy_overlays.mp4 -vf "ass=assets/subs.ass"
-c:v libx264 -crf 28 -preset veryfast -c:a copy out/proxy_subs.mp4

markdown
Копировать код
**Критерий OK**: субтитры читаемы, не конфликтуют по цветам/фону.

### S7 — TTS (Kokoro) + ducking
**Шаги**
- Сгенерировать озвучку → `assets/voiceover.mp3`
- Замиксовать с базовым аудио и музыкой (если есть) с ducking.
**Пример (упрощённо, микс 2 дорожек)**
ffmpeg -y -i out/proxy_subs.mp4 -i assets/voiceover.mp3
-filter_complex "[0:a][1:a]amix=inputs=2:duration=longest:dropout_transition=2[a]"
-map 0:v -map "[a]" -c:v copy -c:a aac -b:a 192k out/proxy_vo.mp4

markdown
Копировать код
**Критерий OK**: речь чёткая, музыка приглушается при речи.

### S8 — Полный рендер (продакшн)
**Команда (пример)**
ffmpeg -y -i "assets/Test video Main.mp4"
-i "assets/VHS 01 Effect.mp4"
-i "assets/VHS 02 Effect.mp4"
-i "assets/overlay_arrow.mov"
-filter_complex "[0:v][1:v]blend=all_mode=overlay:shortest=1[t1];
[t1][2:v]blend=all_mode=softlight:shortest=1[t2];
[t2][3:v]blend=all_mode=screen:shortest=1[v]"
-map "[v]" -map 0:a? -c:v libx264 -crf 18 -preset slow -c:a aac -b:a 192k
out/final.mp4

markdown
Копировать код
**Критерий OK**: финал соответствует прокси-версиям, без артефактов.

## 2) Blend modes: разрешённые значения
`overlay`, `screen`, `multiply`, `softlight`, `hardlight`, `lighten`, `darken`  
→ маппятся на `ffmpeg blend: all_mode=<value>`.

## 3) Правила диффов
- Показывать только затронутые файлы.
- Комментарии в diff — кратко «зачем».
- Любая правка конфигов — с пояснением «почему без этого не собиралось».

## 4) Взаимодействие с MCP/n8n
- MCP лишь проксирует задачи (create, status), не трогает код.
- Предоставь curl-примеры:
curl -X POST http://localhost:5123/mcp/create -H "Content-Type: application/json" -d @scenario.json
curl http://localhost:5123/mcp/status?id=JOB_ID

diff
Копировать код

## 5) Определения «Готово»
- S1–S7 пройдены (с артефактами out/*), финальный рендер успешен.
- Лог сборки/команд приложен.
- Никаких правок в dist/, только src/.
- Ни одной скрытой зависимости.
