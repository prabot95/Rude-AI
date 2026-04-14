# 🔥 Rude AI Voice Assistant 

An advanced, rude, and sarcastic AI voice assistant that runs entirely in the browser. Features real-time voice interaction, interruption handling, and a premium dark UI.

![Sarcastic AI](https://img.shields.io/badge/Persona-Sarcastic-red)
![FastAPI](https://img.shields.io/badge/Backend-FastAPI-green)
![Deepgram](https://img.shields.io/badge/Speech-Deepgram-orange)
![Groq](https://img.shields.io/badge/LLM-Groq-blue)

## ✨ Features

- **🗣️ Continuous Voice Loop**: Tap once to talk, and the conversation flows naturally.
- **⚡ Super Fast**: Powered by **Groq** (LLM) and **Deepgram** (STT/TTS) for near-instant responses.
- **🛑 Interruptible**: Press `SPACE` to shut the AI up mid-sentence.
- **🎨 Premium UI**: Dark mode, waveform animations, and glassmorphism design.
- **😈 Rude Persona**: Expect sarcasm, roasts, and attitude.

---

## 🚀 Quick Start (Local)

### 1. Clone & Install
```bash
git clone https://github.com/Rahul-64/Rude-AI.git
cd Rude-AI
pip install -r requirements.txt
```

### 2. Configure Keys
Create a `.env` file in the root directory:
```ini
DEEPGRAM_API_KEY=your_deepgram_key
GROQ_API_KEY=your_groq_key
```
*   Get Deepgram key: [console.deepgram.com](https://console.deepgram.com)
*   Get Groq key: [console.groq.com](https://console.groq.com)

### 3. Run Server
```bash
python server.py
```
Open **http://localhost:8000** in your browser.

---

## 🌐 Deploy to Render (Free)

This project is configured for 1-click deployment on **Render**.

1. **Fork this repo** to your GitHub.
2. Sign up at [render.com](https://render.com).
3. Click **New +** -> **Web Service**.
4. Connect your GitHub repo.
5. **Settings**:
    *   **Runtime**: Python 3
    *   **Build Command**: `pip install -r requirements.txt`
    *   **Start Command**: `uvicorn server:app --host 0.0.0.0 --port $PORT`
6. **Environment Variables**:
    *   Add `DEEPGRAM_API_KEY`
    *   Add `GROQ_API_KEY`
7. Click **Deploy**.

---

## 📂 Project Structure

```
├── server.py              # FastAPI Backend
├── web/
│   └── index.html         # Frontend (HTML/JS/CSS)
├── src/
│   ├── agents/            # AI Persona Logic
│   └── speech_processing/ # Deepgram Integration
├── requirements.txt       # Dependencies
├── Procfile               # Render Deployment Config
└── .env                   # API Keys (Local only)
```

## 🛠️ Tech Stack

*   **Frontend**: HTML5, CSS3 (Animations), Vanilla JS (AudioContext, WebSockets)
*   **Backend**: FastAPI, Uvicorn
*   **AI**: Groq (Llama 3 70B), LiteLLM
*   **Voice**: Deepgram Aura (TTS), Deepgram Nova-2 (STT)

---

## 📝 License
MIT License. Free to use, modify, and roast your friends.
