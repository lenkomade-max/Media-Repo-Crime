#!/usr/bin/env python3
"""
Kokoro TTS HTTP Server
Обслуживает HTTP API для нашего media-server
"""

from flask import Flask, request, jsonify, send_file
import tempfile
import os
import subprocess
from kokoro_tts import KokoroTTS

app = Flask(__name__)

# Инициализация Kokoro TTS
try:
    tts = KokoroTTS()
    print("✅ Kokoro TTS инициализирован успешно")
except Exception as e:
    print(f"❌ Ошибка инициализации Kokoro TTS: {e}")
    tts = None

@app.route('/health', methods=['GET'])
def health():
    """Health check endpoint"""
    return jsonify({"status": "ok", "provider": "kokoro-tts", "initialized": tts is not None})

@app.route('/voices', methods=['GET'])
def list_voices():
    """Получить список доступных голосов"""
    if not tts:
        return jsonify({"error": "Kokoro TTS не инициализирован"}), 500
    
    try:
        # Kokoro поддерживает разные голоса
        voices = {
            "default": {"name": "Default", "language": "en", "gender": "neutral"},
            "male": {"name": "Male Voice", "language": "en", "gender": "male"},
            "female": {"name": "Female Voice", "language": "en", "gender": "female"}
        }
        return jsonify({"voices": voices})
    except Exception as e:
        return jsonify({"error": f"Ошибка получения голосов: {e}"}), 500

@app.route('/v1/tts', methods=['POST'])
def text_to_speech():
    """Основной TTS endpoint"""
    if not tts:
        return jsonify({"error": "Kokoro TTS недоступен"}), 500
    
    try:
        data = request.get_json()
        text = data.get('text', '')
        voice = data.get('voice', 'default')
        format = data.get('format', 'wav')
        
        if not text:
            return jsonify({"error": "Текст не предоставлен"}), 400
        
        # Создаем временный файл
        with tempfile.NamedTemporaryFile(suffix=f'.{format}', delete=False) as temp_file:
            temp_path = temp_file.name
            
        # Генерируем речь
        tts.generate(text, temp_path, voice=voice)
        
        return send_file(temp_path, as_attachment=True, 
                       download_name=f'speech.{format}',
                       mimetype='audio/wav' if format == 'wav' else 'audio/mpeg')
       
    except Exception as e:
        return jsonify({"error": f"Ошибка TTS: {e}"}), 500

if __name__ == '__main__':
    print("🚀 Запуск Kokoro TTS Server на порту 11402...")
    app.run(host='0.0.0.0', port=11402, debug=False)
