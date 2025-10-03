#!/usr/bin/env python3
"""
Полноценный тест Kokoro TTS с конвертацией в WAV
"""

from kokoro_tts import Kokoro
import numpy as np
import wave
import tempfile
import os

def audio_samples_to_wav(samples, sample_rate, filename):
    """Конвертирует numpy array в WAV файл"""
    try:
        # Нормализуем до 16-бит
        samples_int16 = (samples * 32767).astype(np.int16)
        
        with wave.open(filename, 'wb') as wav_file:
            wav_file.setnchannels(1)  # моно
            wav_file.setsampwidth(2)   # 16-бит = 2 байта
            wav_file.setframerate(sample_rate)
            wav_file.writeframes(samples_int16.tobytes())
        
        return True
    except Exception as e:
        print(f"Ошибка конвертации в WAV: {e}")
        return False

def main():
    model_path = "/root/media-video-maker-test/kokoro-v1.0.onnx"
    voices_path = "/root/media-video-maker/media-video-maker_server/voices-v1.0.bin"

    try:
        print("🎤 Инициализация Kokoro TTS...")
        kokoro = Kokoro(model_path=model_path, voices_path=voices_path)
        print("✅ Kokoro готов!")
        
        # Тестируем разные голоса
        test_cases = [
            ("Hello world, testing English voice", "af_alloy"),
            ("Привет мир, тест русского голоса", "if_sara"),  # русский женский
            ("Bonjour le monde", "ef_dora"),  # французский женский
        ]
        
        for text, voice in test_cases:
            print(f"\n🧪 Тест: '{text}' с голосом '{voice}'")
            
            try:
                # Синтез речи
                audio_result = kokoro.create(text, voice=voice)
                samples, sample_rate = audio_result
                
                print(f"✅ Синтез успешен!")
                print(f"  Sample rate: {sample_rate} Hz")
                print(f"  Samples: {len(samples)} ({samples.dtype})")
                
                # Конвертируем в WAV
                filename = f"/tmp/kokoro_test_{voice}_{int(os.getpid())}.wav"
                if audio_samples_to_wav(samples, sample_rate, filename):
                    file_size = os.path.getsize(filename)
                    print(f"✅ WAV файл создан: {filename}")
                    print(f"  Размер файла: {file_size} байт")
                    
                    # Проверим что файл корректный
                    with wave.open(filename, 'rb') as f:
                        frames = f.getnframes()
                        duration = frames / float(sample_rate)
                        print(f"  Длительность: {duration:.2f} секунд")
                else:
                    print("❌ Ошибка создания WAV")
                    
            except Exception as e:
                print(f"❌ Ошибка теста: {e}")
                
        print("\n🎉 Тестирование Kokoro завершено!")
        
    except Exception as e:
        print(f"❌ Критическая ошибка: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    main()
