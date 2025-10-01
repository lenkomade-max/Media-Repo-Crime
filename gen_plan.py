import json
from pathlib import Path

photos = [p.strip() for p in Path('/tmp/photos_50.txt').read_text().splitlines() if p.strip()]
tts_text = Path('tmp_tts.txt').read_text()
files = [{"id": f"img{i+1:02d}", "type": "photo", "src": p, "duration": 1.2} for i,p in enumerate(photos)]
plan = {
  "files": files,
  "width": 1080,
  "height": 1920,
  "fps": 30,
  "durationPerPhoto": 1.2,
  "backgroundMusic": {"path": "assets/background_music.mp3", "volume": -6},
  "tts": {"enabled": True, "provider": "kokoro", "text": tts_text, "voice": "default"},
  "subtitles": {"enabled": True, "karaoke": True, "style": {"fontSize": 28, "fontColor": "#FFFFFF", "backgroundColor": "rgba(0,0,0,0.8)", "position": "bottom"}},
  "effects": [ {"kind": "zoom", "params": {"enabled": True, "startScale": 1.0, "endScale": 1.15, "center": "middle"}} ],
  "overlays": [
    {"target": "top", "text": "КРИМИНАЛЬНЫЕ НОВОСТИ", "startSec": 0, "endSec": 60, "style": {"size": 40, "color": "#FF0000", "fontWeight": "bold", "backgroundStyle": {"color": "rgba(0,0,0,0.6)", "padding": 16, "borderRadius": 8}}},
    {"target": "bottom", "text": "1 минута, 50 фото, 1080p", "startSec": 5, "endSec": 55, "style": {"size": 28, "color": "#FFFFFF", "fontWeight": "normal", "backgroundStyle": {"color": "rgba(0,0,0,0.5)", "padding": 10, "borderRadius": 6}}}
  ]
}
Path('job_photos_60s_1080p.json').write_text(json.dumps(plan, ensure_ascii=False))
print('OK')
