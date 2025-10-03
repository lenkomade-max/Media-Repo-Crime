#!/usr/bin/env python3
"""
Простой тест Kokoro TTS для проверки функциональности
"""

from flask import Flask, request, jsonify
import tempfile
import os
from kokoro_tts import Kokoro

print("🎤 Инициализация Kokoro TTS для тестирования...")

try:
    # Найденные пути к моделям Kokoro на сервере
    model_path = "/root/media-video-maker-test/kokoro-v1.0.onnx"
    voices_path = "/root/media-video-maker/media-video-maker_server/voices-v1.0.bin"
    
    print(f"🔍 Ищу модель: {model_path}")
    print(f"🔍 Ищу голоса: {voices_path}")
    
    if os.path.exists(model_path):
        print(f"✅ Найдена модель: {model_path}")
    else:
        print(f"❌ Модель не найдена: {model_path}")
        
    if os.path.exists(voices_path):
        print(f"✅ Найдены голоса: {voices_path}")
    else:
        print(f"❌ Голоса не найдены: {voices_path}")
    
    # Инициализация с путями
    kokoro = Kokoro(model_path=model_path, voices_path=voices_path)
    print("✅ Kokoro TTS успешно инициализирован")
    
    # Тестируем базовую функцию
    test_text = "Hello world, this is a test"
    print(f"🧪 Тестируем синтез: '{test_text}'")
    
    audio_data = kokoro.convert_text_to_audio(test_text)
    print(f"✅ Синтез успешен! Размер аудио: {len(audio_data)} байт")
    
    app = Flask(__name__)
    
    @app.route('/health', methods=['GET'])
    def health():
        return jsonify({
            "status": "ok", 
            "provider": "kokoro-tts", 
            "ready": True,
            "test_passed": True
        })
    
    @app.route('/test', methods=['POST'])
    def test_tts():
        try:
            data = request.json or {}
            text = data.get('text', 'Hello world test')
            
            audio_data = kokoro.convert_text_to_audio(text)
            
            # Сохраняем во временный файл
            with tempfile.NamedTemporaryFile(delete=False, suffix=".wav") as tmp_file:
                tmp_file.write(audio_data)
                tmp_path = tmp_file.name
            
            return jsonify({
                "status": "success",
                "audio_size": len(audio_data),
                "temp_file": tmp_path,
                "message": f"Successfully synthesized: '{text}'"
            })
            
        except Exception as e:
            return jsonify({"error": str(e)}), 500
    
    if __name__ == '__main__':
        print("🚀 Запуск тестового сервера на порту 11402")
        app.run(host='0.0.0.0', port=11402, debug=False)

except Exception as e:
    print(f"❌ Ошибка инициализации: {e}")
    exit(1)
