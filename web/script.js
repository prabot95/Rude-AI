(() => {
            // ── DOM refs ──
            const micBtn = document.getElementById('micBtn');
            const micContainer = document.getElementById('micContainer');
            const micIcon = document.getElementById('micIcon');
            const micLabel = document.getElementById('micLabel');
            const statePill = document.getElementById('statePill');
            const audioPlayer = document.getElementById('audioPlayer');
            const headerStatus = document.getElementById('headerStatus');
            const waveformEl = document.getElementById('waveform');
            const mainArea = document.getElementById('mainArea');

            // ── State ──
            let state = 'idle'; // idle | listening | thinking | speaking | ended
            let conversationActive = false; // true once user clicks mic to start the loop
            let micStream = null; // persistent mic stream
            let mediaRecorder = null;
            let audioChunks = [];
            let currentAudio = null;
            let silenceTimer = null;
            let analyser = null;
            let audioContext = null;

            // Silence detection config
            const SILENCE_THRESHOLD = 15; // RMS level below which = silence
            const SILENCE_DURATION = 2000; // ms of silence before auto-stop
            const MIN_RECORDING_TIME = 500; // ms minimum recording before silence detection kicks in

            // ── Generate waveform bars ──
            const BAR_COUNT = 30;
            for (let i = 0; i < BAR_COUNT; i++) {
                const bar = document.createElement('div');
                bar.className = 'wave-bar';
                const h = 8 + Math.random() * 55;
                const dur = (0.8 + Math.random() * 0.8).toFixed(2);
                const delay = (Math.random() * 0.5).toFixed(2);
                bar.style.height = `${h}%`;
                bar.style.animation = `wave ${dur}s ease-in-out ${delay}s infinite`;
                waveformEl.appendChild(bar);
            }

            // ── State machine ──
            function setState(newState, message) {
                state = newState;
                statePill.className = 'state-pill ' + newState;

                switch (newState) {
                    case 'idle':
                        statePill.textContent = message || 'Ready — tap mic to start conversation';
                        micBtn.disabled = false;
                        micContainer.classList.remove('recording');
                        micIcon.textContent = 'mic';
                        micLabel.textContent = 'Tap to Talk';
                        headerStatus.textContent = 'System Online';
                        conversationActive = false;
                        break;
                    case 'listening':
                        statePill.textContent = message || 'Listening... (speak now)';
                        micBtn.disabled = true;
                        micContainer.classList.add('recording');
                        micIcon.textContent = 'graphic_eq';
                        micLabel.textContent = 'Listening';
                        headerStatus.textContent = 'Listening';
                        break;
                    case 'thinking':
                        statePill.textContent = message || 'Thinking...';
                        micBtn.disabled = true;
                        micContainer.classList.remove('recording');
                        micIcon.textContent = 'hourglass_top';
                        micLabel.textContent = 'Processing';
                        headerStatus.textContent = 'Processing';
                        break;
                    case 'speaking':
                        statePill.textContent = message || 'Speaking...';
                        micBtn.disabled = true;
                        micContainer.classList.remove('recording');
                        micIcon.textContent = 'volume_up';
                        micLabel.textContent = 'Speaking';
                        headerStatus.textContent = 'Speaking';
                        break;
                    case 'ended':
                        conversationActive = false;
                        releaseMic();
                        mainArea.innerHTML = `
                        <div class="ended-screen">
                            <h2>Conversation Ended</h2>
                            <p>The AI has had enough of you.</p>
                            <button onclick="location.reload()">Start New Conversation</button>
                        </div>`;
                        headerStatus.textContent = 'Offline';
                        break;
                }
            }


            // ── Play audio ──
            function playAudio(base64Wav) {
                return new Promise((resolve) => {
                    if (!base64Wav) { resolve(); return; }
                    setState('speaking');
                    const blob = base64ToBlob(base64Wav, 'audio/wav');
                    const url = URL.createObjectURL(blob);
                    audioPlayer.src = url;
                    audioPlayer.onended = () => {
                        URL.revokeObjectURL(url);
                        resolve();
                    };
                    audioPlayer.onerror = () => { resolve(); };
                    currentAudio = audioPlayer;
                    audioPlayer.play().catch(() => resolve());
                });
            }

            function base64ToBlob(b64, mime) {
                const bin = atob(b64);
                const bytes = new Uint8Array(bin.length);
                for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
                return new Blob([bytes], { type: mime });
            }

            // ═══════════════════════════════════════════════════════
            // CONTINUOUS VOICE LOOP
            // ═══════════════════════════════════════════════════════

            // Acquire mic stream once and keep it alive for the session
            async function acquireMic() {
                if (micStream) return micStream;
                micStream = await navigator.mediaDevices.getUserMedia({ audio: true });

                // Setup audio analyser for silence detection
                audioContext = new (window.AudioContext || window.webkitAudioContext)();
                const source = audioContext.createMediaStreamSource(micStream);
                analyser = audioContext.createAnalyser();
                analyser.fftSize = 512;
                source.connect(analyser);

                return micStream;
            }

            function releaseMic() {
                if (micStream) {
                    micStream.getTracks().forEach(t => t.stop());
                    micStream = null;
                }
                if (audioContext) {
                    audioContext.close().catch(() => { });
                    audioContext = null;
                    analyser = null;
                }
                clearTimeout(silenceTimer);
            }

            // Start recording with automatic silence detection
            function startListening() {
                if (!micStream || !conversationActive) return;

                audioChunks = [];
                mediaRecorder = new MediaRecorder(micStream, { mimeType: 'audio/webm;codecs=opus' });

                mediaRecorder.ondataavailable = (e) => {
                    if (e.data.size > 0) audioChunks.push(e.data);
                };

                mediaRecorder.onstop = async () => {
                    if (!conversationActive) return;
                    if (audioChunks.length === 0) {
                        // No audio — re-listen
                        if (conversationActive) startListening();
                        return;
                    }
                    const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
                    await processVoice(audioBlob);
                };

                mediaRecorder.start(250); // collect in 250ms chunks
                setState('listening');

                // Start silence detection after a brief delay
                const recordStartTime = Date.now();
                monitorSilence(recordStartTime);
            }

            // Monitor audio levels and auto-stop on silence
            function monitorSilence(recordStartTime) {
                if (!analyser || !conversationActive || state !== 'listening') return;

                const dataArray = new Uint8Array(analyser.frequencyBinCount);
                let silenceStart = null;

                function check() {
                    if (!conversationActive || state !== 'listening') return;

                    analyser.getByteTimeDomainData(dataArray);

                    // Calculate RMS
                    let sum = 0;
                    for (let i = 0; i < dataArray.length; i++) {
                        const val = (dataArray[i] - 128) / 128;
                        sum += val * val;
                    }
                    const rms = Math.sqrt(sum / dataArray.length) * 100;

                    const elapsed = Date.now() - recordStartTime;

                    if (rms < SILENCE_THRESHOLD && elapsed > MIN_RECORDING_TIME) {
                        if (!silenceStart) silenceStart = Date.now();
                        if (Date.now() - silenceStart >= SILENCE_DURATION) {
                            // Silence detected — stop recording
                            stopListening();
                            return;
                        }
                    } else {
                        silenceStart = null; // reset on sound
                    }

                    requestAnimationFrame(check);
                }

                requestAnimationFrame(check);
            }

            function stopListening() {
                if (mediaRecorder && mediaRecorder.state === 'recording') {
                    mediaRecorder.stop();
                    setState('thinking');
                }
            }

            // ── Process voice → API → play response → auto re-listen ──
            async function processVoice(blob) {
                setState('thinking');
                try {
                    const form = new FormData();
                    form.append('file', blob, 'recording.webm');

                    const res = await fetch('/api/chat', { method: 'POST', body: form });
                    const data = await res.json();

                    if (!res.ok) {
                        // Could not understand — auto re-listen
                        if (conversationActive) {
                            setState('listening', 'Could not understand — listening again...');
                            setTimeout(() => { if (conversationActive) startListening(); }, 500);
                        }
                        return;
                    }



                    // Play TTS response
                    if (data.audio) {
                        await playAudio(data.audio);
                    }

                    // Check for goodbye
                    if (data.is_goodbye) {
                        setState('ended');
                        return;
                    }

                    // ── AUTO RE-LISTEN → this is the continuous loop ──
                    if (conversationActive) {
                        startListening();
                    }
                } catch (err) {
                    console.error('API Error:', err);
                    // On error, try to keep the loop going
                    if (conversationActive) {
                        setState('listening', 'Connection error — listening again...');
                        setTimeout(() => { if (conversationActive) startListening(); }, 1000);
                    }
                }
            }

            // ── Start the conversation loop (called once on mic click) ──
            async function beginConversation() {
                try {
                    await acquireMic();
                    conversationActive = true;
                    startListening();
                } catch (err) {
                    setState('idle', 'Mic access denied — use text input below');
                    console.error('Mic error:', err);
                }
            }

            // ── Stop entire conversation ──
            function endConversation() {
                conversationActive = false;
                if (mediaRecorder && mediaRecorder.state === 'recording') {
                    mediaRecorder.stop();
                }
                if (currentAudio && !currentAudio.paused) {
                    currentAudio.pause();
                    currentAudio.currentTime = 0;
                }
                releaseMic();
                setState('ended');
            }



            // ── Interrupt playback (Space key) ──
            function interrupt() {
                if (currentAudio && !currentAudio.paused) {
                    currentAudio.pause();
                    currentAudio.currentTime = 0;
                    // After interrupt, auto re-listen if in conversation
                    if (conversationActive) {
                        startListening();
                    } else {
                        setState('idle', 'Interrupted — tap mic to restart');
                    }
                }
            }

            // ── Event Listeners ──
            micBtn.addEventListener('click', () => {
                if (state === 'idle' && !conversationActive) {
                    beginConversation();
                }
            });

            // Keyboard shortcuts
            document.addEventListener('keydown', (e) => {
                // Space to interrupt (when not typing)
                if (e.key === ' ' && e.target.tagName !== 'INPUT' && e.target.tagName !== 'TEXTAREA') {
                    e.preventDefault();
                    if (state === 'speaking') {
                        interrupt();
                    }
                }
            });

            // Init
            setState('idle', 'Ready — tap mic to start conversation');
        })();