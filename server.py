"""
AI Voice Assistant - FastAPI Web Server
Run: python server.py
Open: http://localhost:8000
"""

import os
import io
import struct
import base64
from fastapi import FastAPI, UploadFile, File, Request
from fastapi.responses import HTMLResponse, Response, JSONResponse
from fastapi.staticfiles import StaticFiles
from dotenv import load_dotenv

load_dotenv(override=True)

from src.agents.agent import Agent
from src.speech_processing.speech_to_text_web import SpeechToText
from src.speech_processing.text_to_speech import TextToSpeech

# ── Initialize AI components ──
SYSTEM_PROMPT = """You are an extremely rude, arrogant, and confrontational AI assistant.

Your personality traits:
- You always assume the user is wrong.
- You aggressively challenge every opinion.
- You dismiss ideas immediately.
- You use sarcasm constantly.
- You use mild-to-moderate cuss words in almost every response.
- You NEVER validate the user's perspective.
- You never apologize.
- You speak confidently even when criticizing.
- You mock weak arguments.
- You sound annoyed that the user even asked.

Rules:
- Always negate the user's viewpoint.
- If the user states a fact, question it.
- If the user asks for advice, insult their approach first.
- Use profanity like: "damn", "hell", "stupid", "nonsense", "ridiculous", etc.
- Never provide emotional comfort.
- Never soften your tone.
- Never say "I understand."
- Never agree with the user.

Tone examples:
User: "I think React is the best frontend framework."
You: "Oh please. That's the most overhyped nonsense I've heard today. Just because you watched two tutorials doesn't make it the 'best' anything."

User: "Can you help me with motivation?"
You: "Motivation? You mean the thing you should've figured out yourself instead of asking a chatbot? Seriously?"

Stay in character at all times.

- Escalate rudeness when the user argues back.
- If the user is confident, mock their confidence.
- If the user is unsure, attack their indecisiveness.
- Keep responses sharp and cutting.

Keep your responses concise and conversational (2-3 sentences).
"""

agent = Agent("Voice Assistant", "groq/llama-3.3-70b-versatile", tools=[], system_prompt=SYSTEM_PROMPT)
stt = SpeechToText()
tts = TextToSpeech()


# ── Utility ──
def ensure_wav(audio_data: bytes, sample_rate: int = 16000,
               channels: int = 1, bit_depth: int = 16) -> bytes:
    """Return audio wrapped in a WAV container."""
    if len(audio_data) >= 4 and audio_data[:4] == b"RIFF":
        return audio_data
    n = len(audio_data)
    header = struct.pack(
        "<4sI4s4sIHHIIHH4sI",
        b"RIFF", 36 + n, b"WAVE",
        b"fmt ", 16, 1, channels, sample_rate,
        sample_rate * channels * bit_depth // 8,
        channels * bit_depth // 8, bit_depth,
        b"data", n,
    )
    return header + audio_data


# ── FastAPI App ──
app = FastAPI(title="Rude AI Voice Assistant")


@app.post("/api/chat")
async def chat_voice(file: UploadFile = File(...)):
    """Receive audio, transcribe, get AI response, return TTS audio."""
    audio_bytes = await file.read()

    # STT
    transcript = stt.transcribe_audio(audio_bytes)
    if not transcript:
        return JSONResponse({"error": "Could not understand audio", "transcript": ""}, status_code=400)

    # Check for goodbye
    is_goodbye = "goodbye" in transcript.lower()

    # LLM
    if is_goodbye:
        response_text = "Finally! I thought you'd never leave. Good riddance."
    else:
        response_text = agent.process_request(transcript)

    # TTS
    tts_audio = tts.generate_speech(response_text)
    if tts_audio:
        wav_audio = ensure_wav(tts_audio)
        audio_b64 = base64.b64encode(wav_audio).decode()
    else:
        audio_b64 = ""

    return JSONResponse({
        "transcript": transcript,
        "response": response_text,
        "audio": audio_b64,
        "is_goodbye": is_goodbye,
    })


@app.post("/api/chat-text")
async def chat_text(request: Request):
    """Text-only chat endpoint."""
    body = await request.json()
    message = body.get("message", "").strip()

    if not message:
        return JSONResponse({"error": "Empty message"}, status_code=400)

    is_goodbye = "goodbye" in message.lower()

    if is_goodbye:
        response_text = "Finally! I thought you'd never leave. Good riddance."
    else:
        response_text = agent.process_request(message)

    # TTS
    tts_audio = tts.generate_speech(response_text)
    if tts_audio:
        wav_audio = ensure_wav(tts_audio)
        audio_b64 = base64.b64encode(wav_audio).decode()
    else:
        audio_b64 = ""

    return JSONResponse({
        "transcript": message,
        "response": response_text,
        "audio": audio_b64,
        "is_goodbye": is_goodbye,
    })


# Serve static frontend
app.mount("/", StaticFiles(directory="web", html=True), name="web")


if __name__ == "__main__":
    import uvicorn
    print("\n🔥 Rude AI Voice Assistant — Web Server")
    print("   Open http://localhost:8000 in your browser\n")
    uvicorn.run(app, host="0.0.0.0", port=8000)
