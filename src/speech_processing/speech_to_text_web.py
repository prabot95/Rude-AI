import os
from deepgram import DeepgramClient
from dotenv import load_dotenv


class SpeechToText:
    """Web-compatible Speech-to-Text using Deepgram"""
    
    def __init__(self):
        pass
    
    def transcribe_audio(self, audio_bytes):
        """Transcribe audio bytes to text"""
        if not audio_bytes or len(audio_bytes) == 0:
            return None
        
        try:
            load_dotenv(override=True)
            api_key = os.getenv("DEEPGRAM_API_KEY")
            client = DeepgramClient(api_key=api_key)

            # Transcribe using v5 SDK API
            response = client.listen.v1.media.transcribe_file(
                request=audio_bytes,
                model="nova-2",
                smart_format=True,
                language="en",
            )
            
            # Extract transcript
            if response.results and response.results.channels:
                alternatives = response.results.channels[0].alternatives
                if alternatives:
                    transcript = alternatives[0].transcript
                    return transcript.strip() if transcript else None
            
            return None
            
        except Exception as e:
            print(f"[STT Error] {e}")
            return None
