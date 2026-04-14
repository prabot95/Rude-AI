import os
from dotenv import load_dotenv
from deepgram import DeepgramClient


class TextToSpeech:
    """Web-compatible Text-to-Speech using Deepgram"""
    
    def __init__(self):
        pass
    
    def generate_speech(self, text):
        """Generate speech and return audio bytes for web playback"""
        if not text or len(text.strip()) == 0:
            return None
        
        try:
            load_dotenv(override=True)
            api_key = os.getenv("DEEPGRAM_API_KEY")
            deepgram = DeepgramClient(api_key=api_key)

            # Generate audio
            response = deepgram.speak.v1.audio.generate(
                text=text,
                model="aura-asteria-en",
                encoding="linear16",
                sample_rate=16000
            )

            # Collect audio data
            audio_data = b""
            for chunk in response:
                audio_data += chunk
            
            return audio_data
            
        except Exception as e:
            print(f"[TTS Error] {e}")
            return None


