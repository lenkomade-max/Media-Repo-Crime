#!/usr/bin/env python3
"""
Диагностика результата Kokoro.create()
"""

from kokoro_tts import Kokoro
import tempfile
import os

def main():
    model_path = "/root/media-video-maker-test/kokoro-v1.0.onnx"
    voices_path = "/root/media-video-maker/media-video-maker_server/voices-v1.0.bin"

    kokoro = Kokoro(model_path=model_path, voices_path=voices_path)
    
    print("🧪 Диагностика create()...")
    audio_result = kokoro.create("Hello world", voice="af_alloy")
    
    print(f"Тип результата: {type(audio_result)}")
    print(f"Результат: {audio_result}")
    
    if isinstance(audio_result, tuple):
        print(f"Длина кортежа: {len(audio_result)}")
        for i, item in enumerate(audio_result):
            print(f"Элемент {i}: {type(item)}")
            if hasattr(item, '__len__'):
                print(f"  Размер: {len(item)} байт")
                
            # Попробуем разные варианты сохранения
            if isinstance(item, bytes):
                filename = f"/tmp/kokoro_element_{i}.wav"
                with open(filename, "wb") as f:
                    f.write(item)
                print(f"  Сохранено как: {filename}")
            elif isinstance(item, tuple) and len(item) == 2:
                print(f"  Возможный формат (sample_rate, samples): {item}")
                sample_rate, samples = item
                print(f"    Sample rate: {sample_rate}")
                print(f"    Samples type: {type(samples)}, размер: {len(samples) if hasattr(samples, '__len__') else 'N/A'}")
                
    elif isinstance(audio_result, bytes):
        print("Результат - bytes, сохраняем...")
        with open("/tmp/kokoro_direct.wav", "wb") as f:
            f.write(audio_result)
        print("Сохранил как /tmp/kokoro_direct.wav")
        
    else:
        print(f"Неизвестный формат: {audio_result}")

if __name__ == "__main__":
    main()
