#!/usr/bin/env python3
"""
Интерактивный тест Kokoro TTS
"""

from kokoro_tts import Kokoro
import os

def main():
    model_path = "/root/media-video-maker-test/kokoro-v1.0.onnx"
    voices_path = "/root/media-video-maker/media-video-maker_server/voices-v1.0.bin"

    try:
        print("🎤 Инициализация Kokoro...")
        kokoro = Kokoro(model_path=model_path, voices_path=voices_path)
        
        print("✅ Kokoro инициализирован!")
        
        print("\n🔍 Доступные методы:")
        methods = [m for m in dir(kokoro) if not m.startswith("_")]
        for method in methods:
            print(f"  - {method}")
        
        print("\n🔍 Доступные голоса:")
        try:
            voices = kokoro.get_voices()
            print(f"Голоса: {voices}")
        except Exception as e:
            print(f"Ошибка get_voices: {e}")
        
        print("\n🔍 Языки:")
        try:
            languages = kokoro.get_languages()
            print(f"Языки: {languages}")
        except Exception as e:
            print(f"Ошибка get_languages: {e}")
        
        print("\n🧪 Тест синтеза речи...")
        try:
            audio = kokoro.create("Hello world test", voice="en-us", language="en")
            print(f"✅ Синтез успешен! Тип: {type(audio)}, размер: {len(audio) if audio else 0}")
            
            # Попробуем сохранить результат
            if audio:
                with open("/tmp/test_kokoro_output.wav", "wb") as f:
                    f.write(audio)
                print("✅ Аудио сохранено в /tmp/test_kokoro_output.wav")
                
        except Exception as e:
            print(f"❌ Ошибка синтеза: {e}")
            import traceback
            traceback.print_exc()
            
    except Exception as e:
        print(f"❌ Ошибка инициализации: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    main()
