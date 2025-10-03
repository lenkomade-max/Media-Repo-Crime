#!/usr/bin/env python3
"""
Kokoro TTS HTTP Server
Обслуживает HTTP API для нашего media-server
"""

from flask import Flask, request, jsonify, send_file
import tempfile
import os
from kokoro_tts import Kokoro, convert_text_to_audio, list_available_voices

app = Flask(__name__)

# Проверка Kokoro TTS
try:
    print("✅ Kokoro TTS модуль загружен успешно")
    # Проверяем доступные голоса
    voices = list_available_voices()
    print(f"✅ Доступные голоса: {voices}")
    kokoro_ready = True
except Exception as e:
    print(f"❌ Ошибка загрузки Kokoro TTS: {e}")
    kokoro_ready = False

@app.route('/health', methods=['GET'])
def health():
    """Health check endpoint"""
    return jsonify({"status": "ok", "provider": "kokoro-tts", "ready": kokoro_ready})

@app.route('/voices', methods=['GET'])
def list_voices():
    """Получить список доступных голосов"""
    if not kokoro_ready:
        return jsonify({"error": "Kokoro TTS не готов"}), 500
    
    try:
        voices = list_available_voices()
        return jsonify({"voices": voices})
    except Exception as e:
        return jsonify({"error": f"Ошибка получения голосов: {e}"}), 500

@app.route('/v1/tts', methods=['POST'])
def text_to_speech():
    """Основной TTS endpoint"""
    if not kokoro_ready:
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
            
        # Генерируем речь через функцию
        convert_text_to_audio(text=text, output_file=temp_path, voice=voice)
        
        return send_file(temp_path, as_attachment=True, 
                       download_name=f'speech.{format}',
                       mimetype='audio/wav' if format == 'wav' else 'audio/mpeg')
       
    except Exception as e:
        return jsonify({"error": f"Ошибка TTS: {e}"}), 500

if __name__ == '__main__':
    print("🚀 Запуск Kokoro TTS Server на порту 11402...")
    app.run(host='0.0.0.0', port=11402, debug=False)