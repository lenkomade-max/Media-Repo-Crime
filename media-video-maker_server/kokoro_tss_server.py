#!/usr/bin/env python3
"""
Kokoro TTS HTTP Server - ОБНОВЛЕННАЯ ВЕРСИЯ
Обслуживает HTTP API для синтеза речи
"""

from flask import Flask, request, jsonify, send_file
import tempfile
import os
import numpy as np
import wave
from kokoro_tts import Kokoro

app = Flask(__name__)

# Инициализация Kokoro TTS
try:
    print("✅ Kokoro TTS модуль загружен успешно")
    
    # Пути к моделям (найденные на сервере)
    model_path = "/root/media-video-maker-test/kokoro-v1.0.onnx"
    voices_path = "/root/media-video-maker/media-video-maker_server/voices-v1.0.bin"
    
    print(f"🔍 Загрузка модели: {model_path}")
    print(f"🔍 Загрузка голосов: {voices_path}")
    
    kokoro_manager = Kokoro(model_path=model_path, voices_path=voices_path)
    kokoro_ready = True
    print("✅ Kokoro TTS готов к работе!")
    
except Exception as e:
    print(f"❌ Ошибка загрузки Kokoro TTS: {e}")
    kokoro_ready = False
    kokoro_manager = None

def audio_samples_to_wav_file(samples, sample_rate, filepath):
    """Конвертирует numpy samples в WAV файл"""
    try:
        # Нормализуем до 16-бит
        samples_int16 = (samples * 32767).astype(np.int16)
        
        with wave.open(filepath, 'wb') as wav_file:
            wav_file.setnchannels(1)  # моно
            wav_file.setsampwidth(2)   # 16-бит = 2 байта
            wav_file.setframerate(sample_rate)
            wav_file.writeframes(samples_int16.tobytes())
        
        return True
    except Exception as e:
        print(f"❌ Ошибка конвертации в WAV: {e}")
        return False

@app.route('/health', methods=['GET'])
def health():
    """Health check endpoint"""
    return jsonify({"status": "ok", "provider": "kokoro-tts", "ready": kokoro_ready})

@app.route('/voices', methods=['GET'])
def get_voices():
    """Получить список доступных голосов"""
    if not kokoro_ready:
        return jsonify({"error": "Kokoro TTS не готов"}), 500
    
    try:
        voices = kokoro_manager.get_voices()
        return jsonify({"voices": voices})
    except Exception as e:
        return jsonify({"error": f"Ошибка получения голосов: {e}"}), 500

@app.route('/languages', methods=['GET'])
def get_languages():
    """Получить список поддерживаемых языков"""
    if not kokoro_ready:
        return jsonify({"error": "Kokoro TTS не готов"}), 500
    
    try:
        languages = kokoro_manager.get_languages()
        return jsonify({"languages": languages})
    except Exception as e:
        return jsonify({"error": f"Ошибка получения языков: {e}"}), 500

@app.route('/v1/tts', methods=['POST'])
def synthesize_speech():
    """Основной TTS endpoint"""
    if not kokoro_ready:
        return jsonify({"error": "Kokoro TTS недоступен"}), 500
    
    try:
        data = request.get_json()
        text = data.get('text', '')
        voice = data.get('voice', 'af_alloy')  # голос по умолчанию
        
        if not text.strip():
            return jsonify({"error": "Текст для озвучки пуст"}), 400
        
        print(f"🎤 Синтез речи: '{text}' голос '{voice}'")
        
        # Выполняем синтез
        audio_samples, sample_rate = kokoro_manager.create(text, voice=voice)
        
        print(f"✅ Синтез успешен: {len(audio_samples)} samples, {sample_rate}Hz")
        
        # Создаем временный WAV файл
        with tempfile.NamedTemporaryFile(suffix='.wav', delete=False) as temp_file:
            temp_path = temp_file.name
        
        # Конвертируем в WAV
        if audio_samples_to_wav_file(audio_samples, sample_rate, temp_path):
            file_size = os.path.getsize(temp_path)
            print(f"📁 WAV файл создан: {file_size} байт")
            
            return send_file(
                temp_path, 
                as_attachment=True, 
                download_name='speech.wav',
                mimetype='audio/wav'
            )
        else:
            return jsonify({"error": "Ошибка создания аудио файла"}), 500
            
    except Exception as e:
        print(f"❌ Ошибка синтеза речи: {e}")
        return jsonify({"error": f"Ошибка TTS: {e}"}), 500

@app.route('/test', methods=['POST'])
def test_synthesis():
    """Тестовый endpoint для проверки синтеза"""
    test_data = {
        "text": "Hello world, this is a test",
        "voice": "af_alloy"
    }
    
    # Перенаправляем на основной endpoint
    return synthesize_speech()

if __name__ == '__main__':
    print("🚀 Запуск Kokoro TTS Server на порту 11402...")
    app.run(host='0.0.0.0', port=11402, debug=False)