#!/usr/bin/env python3
from flask import Flask, request, jsonify
import subprocess
import tempfile
import os

app = Flask(__name__)

class KokoroTTS:
    def __init__(self):
        self.voices = {
            'en_male_1': {'espeak_voice': 'en+m3', 'speed': 1.0, 'pitch': 0},
            'en_male_2': {'espeak_voice': 'en+m3', 'speed': 0.9, 'pitch': -5},
            'en_female_1': {'espeak_voice': 'en+f3', 'speed': 1.1, 'pitch': 10},
            'en_female_2': {'espeak_voice': 'en+f3', 'speed': 1.0, 'pitch': 5},
        }
    
    def synthesize(self, text, voice='en_male_2', speed=1.0, format='mp3'):
        voice_params = self.voices.get(voice, self.voices['en_male_2'])
        espeak_speed = int(150 * speed * voice_params['speed'])
        espeak_pitch = int(50 + voice_params['pitch'])
        
        with tempfile.NamedTemporaryFile(suffix='.wav', delete=False) as tmp_wav:
            tmp_file = tmp_wav.name
            
        # Используем espeak для генерации речи
        cmd = [
            'espeak', '-v', voice_params['espeak_voice'],
            '-s', str(espeak_speed),
            '-p', str(espeak_pitch),
            '-w', tmp_file,
            text
        ]
        
        print(f"Running: {' '.join(cmd)}")
        result = subprocess.run(cmd, capture_output=True, text=True)
        
        if result.returncode != 0:
            raise Exception(f"espeak failed: {result.stderr}")
            
        with open(tmp_file, 'rb') as f:
            audio_data = f.read()
        
        os.unlink(tmp_file)
        return audio_data

@app.route('/synthesize', methods=['POST'])
def synthesize():
    try:
        data = request.json
        text = data.get('text', '')
        voice = data.get('voice', 'en_male_2')
        speed = data.get('speed', 1.0)
        
        if not text:
            return jsonify({'error': 'No text provided'}), 400
            
        tts = KokoroTTS()
        audio_data = tts.synthesize(text, voice, speed)
        
        return app.response_class(
            audio_data,
            mimetype='audio/wav'
        )
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/health', methods=['GET'])
def health():
    return jsonify({'status': 'ok', 'voice': 'Kokoro Container'})

if __name__ == '__main__':
    print("Starting Kokoro TTS Server inside container on port 8083...")
    app.run(host='0.0.0.0', port=8083, debug=False)
