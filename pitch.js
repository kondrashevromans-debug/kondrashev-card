// pitch.js (ВЕРСИЯ 17.0 - ИСПРАВЛЕНИЕ ОШИБКИ ОТРИСОВКИ)

document.addEventListener('DOMContentLoaded', () => {
    // --- Инициализация и переменные ---
    if (window.Telegram && window.Telegram.WebApp) Telegram.WebApp.ready();

    const mainContent = document.getElementById('main-content');
    const display = document.querySelector('.output-display');
    const startButton = document.getElementById('startButton');
    const noteElement = document.getElementById('note');
    const octaveElement = document.getElementById('octave');
    const centsElement = document.getElementById('cents');
    const statusMessage = document.getElementById('status-message');
    const pianoContainer = document.getElementById('piano-container');
    const canvas = document.getElementById('pitch-canvas');
    const canvasCtx = canvas.getContext('2d');

    let audioContext; let analyser; let sourceNode; let isListening = false; let dataArray;
    let animationFrameId; let targetNote = null;
    const PITCH_HISTORY_SIZE = 400; const SMOOTHING_WINDOW_SIZE = 5; let pitchHistory = [];

    const MIN_NOTE_NUM = 24; // C2
    const MAX_NOTE_NUM = 72; // C6
    const NUM_NOTES_DISPLAYED = MAX_NOTE_NUM - MIN_NOTE_NUM + 1;
    const WHITE_KEY_PIXELS = 50;

    let scrollOffsetPixels = 0;
    let maxScrollOffset = 0;
    let isDragging = false;
    let lastTouchY = 0;
    
    const noteStrings = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
    const A4 = 440; const C0 = A4 * Math.pow(2, -4.75);

    // --- ГЕНЕРАЦИЯ ИНТЕРФЕЙСА С УЧЕТОМ ПРОКРУТКИ ---
    function setupUI() {
        // --- ИСПРАВЛЕНИЕ 2: ЗАЩИТА ОТ НУЛЕВОЙ ВЫСОТЫ ---
        // Если родительский блок еще не имеет высоты, выходим.
        // Функция будет вызвана позже при событии resize.
        if (!mainContent.clientHeight) return;

        const totalWhiteKeys = Array.from({ length: NUM_NOTES_DISPLAYED }, (_, i) => i + MIN_NOTE_NUM)
            .filter(n => !noteStrings[n % 12].includes('#')).length;
        const totalHeight = totalWhiteKeys * WHITE_KEY_PIXELS;
        
        pianoContainer.style.height = `${totalHeight}px`;
        canvas.height = totalHeight;
        canvas.width = canvas.parentElement.clientWidth;

        maxScrollOffset = totalHeight - mainContent.clientHeight;
        
        pianoContainer.innerHTML = '';
        let currentY = 0;
        for (let i = MAX_NOTE_NUM; i >= MIN_NOTE_NUM; i--) {
            const noteName = noteStrings[i % 12]; const octave = Math.floor(i / 12);
            const isBlack = noteName.includes('#'); const key = document.createElement('div');
            key.className = `key ${isBlack ? 'black' : 'white'}`; key.dataset.note = `${noteName}${octave}`;
            
            if (!isBlack) {
                key.style.height = `${WHITE_KEY_PIXELS}px`;
                key.style.top = `${currentY}px`;
                currentY += WHITE_KEY_PIXELS;
            } else {
                const blackKeyHeight = WHITE_KEY_PIXELS * 0.6;
                key.style.height = `${blackKeyHeight}px`;
                key.style.top = `${currentY - (blackKeyHeight / 2)}px`;
            }
            key.addEventListener('click', onKeyClick);
            pianoContainer.appendChild(key);
        }
        
        const c4NoteNum = 48;
        const c4WhiteKeyIndex = Array.from({ length: c4NoteNum - MIN_NOTE_NUM + 1 }, (_, i) => i + MIN_NOTE_NUM)
            .filter(n => n <= c4NoteNum && !noteStrings[n % 12].includes('#')).length;
        // Устанавливаем начальное смещение без вызова handleScroll, чтобы избежать гонки
        const initialScroll = c4WhiteKeyIndex * WHITE_KEY_PIXELS - (mainContent.clientHeight / 2);
        scrollOffsetPixels = Math.max(0, Math.min(initialScroll, maxScrollOffset));
        pianoContainer.style.transform = `translateY(-${scrollOffsetPixels}px)`;
        canvas.style.transform = `translateY(-${scrollOffsetPixels}px)`;

        drawPitchGraph();
    }
    
    // --- ЛОГИКА ПРОКРУТКИ ---
    function handleScroll(delta) {
        scrollOffsetPixels += delta;
        scrollOffsetPixels = Math.max(0, Math.min(scrollOffsetPixels, maxScrollOffset));
        pianoContainer.style.transform = `translateY(-${scrollOffsetPixels}px)`;
        canvas.style.transform = `translateY(-${scrollOffsetPixels}px)`;
    }
    mainContent.addEventListener('wheel', (e) => { e.preventDefault(); handleScroll(e.deltaY); });
    mainContent.addEventListener('touchstart', (e) => { isDragging = true; lastTouchY = e.touches[0].clientY; });
    mainContent.addEventListener('touchmove', (e) => { if (!isDragging) return; const currentY = e.touches[0].clientY; const deltaY = lastTouchY - currentY; handleScroll(deltaY); lastTouchY = currentY; });
    window.addEventListener('touchend', () => { isDragging = false; });

    // --- ОСНОВНАЯ ЛОГИКА ПРИЛОЖЕНИЯ (updatePitch, yin и т.д.) ---
    function updatePitch() { if (!analyser) return; analyser.getFloatTimeDomainData(dataArray); let rms = 0; for (let i = 0; i < dataArray.length; i++) rms += dataArray[i] * dataArray[i]; rms = Math.sqrt(rms / dataArray.length); let currentPitch = null; if (rms > 0.01) { const pitch = yin(dataArray, audioContext.sampleRate); if (pitch !== -1) {  currentPitch = pitch; const { note, octave, cents } = frequencyToNoteDetails(pitch); noteElement.textContent = note; octaveElement.textContent = octave; centsElement.textContent = `Отклонение: ${cents.toFixed(0)} cents`; if (targetNote) { const sungNoteWithOctave = note + octave; const sungNoteName = note; const targetNoteName = targetNote.replace(/[0-9]/g, ''); display.classList.remove('correct', 'octave-miss', 'wrong'); if (sungNoteWithOctave === targetNote) display.classList.add('correct'); else if (sungNoteName === targetNoteName) display.classList.add('octave-miss'); else display.classList.add('wrong'); } } } if (currentPitch === null) { display.classList.remove('correct', 'octave-miss', 'wrong'); } pitchHistory.push(currentPitch); if (pitchHistory.length > PITCH_HISTORY_SIZE) pitchHistory.shift(); drawPitchGraph(); animationFrameId = requestAnimationFrame(updatePitch); }
    function yin(buffer, sampleRate) { const threshold = 0.12; const bufferSize = buffer.length; const yinBufferSize = bufferSize / 2; const yinBuffer = new Float32Array(yinBufferSize); let tauEstimate = -1; let pitchInHz = -1; let runningSum = 0; yinBuffer[0] = 1; for (let tau = 1; tau < yinBufferSize; tau++) { let differenceSum = 0; for (let i = 0; i < yinBufferSize; i++) { const delta = buffer[i] - buffer[i + tau]; differenceSum += delta * delta; } runningSum += differenceSum; yinBuffer[tau] = differenceSum * tau / (runningSum || 1); } for (let tau = 4; tau < yinBufferSize; tau++) { if (yinBuffer[tau] < threshold) { if (yinBuffer[tau] < yinBuffer[tau - 1] && yinBuffer[tau] < yinBuffer[tau + 1]) { tauEstimate = tau; break; } } } if (tauEstimate === -1) { let min = Infinity; for (let tau = 4; tau < yinBufferSize; tau++) { if (yinBuffer[tau] < min) { min = yinBuffer[tau]; tauEstimate = tau; } } } if (tauEstimate > 0 && tauEstimate < yinBufferSize - 1) { const y1 = yinBuffer[tauEstimate - 1]; const y2 = yinBuffer[tauEstimate]; const y3 = yinBuffer[tauEstimate + 1]; const denominator = 2 * (2 * y2 - y3 - y1); if (denominator !== 0) { const betterTau = tauEstimate + (y3 - y1) / denominator; pitchInHz = sampleRate / betterTau; } else { pitchInHz = sampleRate / tauEstimate; } } return (pitchInHz > 50 && pitchInHz < 3000) ? pitchInHz : -1; }
    function drawPitchGraph() { const width = canvas.width; const height = canvas.height; canvasCtx.fillStyle = '#000'; canvasCtx.fillRect(0, 0, width, height); const noteToY = (noteNum) => { return height - ((noteNum - MIN_NOTE_NUM) / (NUM_NOTES_DISPLAYED - 1)) * height; }; let whiteKeyIndex = 0; const totalWhiteKeys = Array.from({ length: NUM_NOTES_DISPLAYED }, (_, i) => i + MIN_NOTE_NUM).filter(n => !noteStrings[n % 12].includes('#')).length; for (let i = MAX_NOTE_NUM; i >= MIN_NOTE_NUM; i--) { const noteName = noteStrings[i % 12]; if (!noteName.includes('#')) { const y = (whiteKeyIndex + 0.5) * (height / totalWhiteKeys); canvasCtx.strokeStyle = 'rgba(255, 255, 255, 0.2)'; canvasCtx.lineWidth = 1; canvasCtx.beginPath(); canvasCtx.moveTo(0, y); canvasCtx.lineTo(width, y); canvasCtx.stroke(); whiteKeyIndex++; } } canvasCtx.strokeStyle = '#ffc107'; canvasCtx.lineWidth = 2; canvasCtx.beginPath(); let lastPointWasNull = true; for (let i = 0; i < pitchHistory.length; i++) { const windowStart = Math.max(0, i - SMOOTHING_WINDOW_SIZE + 1); const windowSlice = pitchHistory.slice(windowStart, i + 1); const validPitchesInWindow = windowSlice.filter(p => p !== null); let smoothedPitch = null; if (validPitchesInWindow.length > 0) { const sum = validPitchesInWindow.reduce((a, b) => a + b, 0); smoothedPitch = sum / validPitchesInWindow.length; } const x = (i / PITCH_HISTORY_SIZE) * width; if (smoothedPitch !== null) { const noteNum = 12 * Math.log2(smoothedPitch / C0); const y = noteToY(noteNum); if (lastPointWasNull) { canvasCtx.moveTo(x, y); lastPointWasNull = false; } else { canvasCtx.lineTo(x, y); } } else { lastPointWasNull = true; } } canvasCtx.stroke(); }
    function initAudioContext() { if (!audioContext) { try { audioContext = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { alert("Ваш браузер не поддерживает Web Audio API."); } } if (audioContext && audioContext.state === 'suspended') { audioContext.resume(); } }
    function onKeyClick(event) { initAudioContext(); if (!audioContext) return; const key = event.currentTarget; const note = key.dataset.note; targetNote = note; statusMessage.textContent = `Повторите ноту: ${targetNote}`; const freq = noteToFrequency(note); if (freq) playNote(freq, 0.5); if (!isListening) startListening(); }
    startButton.addEventListener('click', () => { initAudioContext(); if (!audioContext) return; if (!isListening) { targetNote = null; statusMessage.textContent = 'Свободный режим'; startListening(); } else { stopListening(); } });
    async function startListening() { if (isListening || !navigator.mediaDevices) return; try { const stream = await navigator.mediaDevices.getUserMedia({ audio: true }); analyser = audioContext.createAnalyser(); analyser.fftSize = 2048; dataArray = new Float32Array(analyser.fftSize); sourceNode = audioContext.createMediaStreamSource(stream); sourceNode.connect(analyser); isListening = true; startButton.textContent = 'Остановить'; startButton.classList.add('listening'); updatePitch(); } catch (err) { statusMessage.textContent = 'Ошибка доступа к микрофону.'; console.error(err); } }
    function stopListening() { if (!isListening || !sourceNode) return; sourceNode.mediaStream.getTracks().forEach(track => track.stop()); sourceNode.disconnect(); sourceNode = null; cancelAnimationFrame(animationFrameId); isListening = false; startButton.textContent = 'Начать'; startButton.classList.remove('listening'); statusMessage.textContent = 'Нажмите "Начать" или сыграйте ноту'; resetDisplay(); }
    function playNote(frequency, duration) { if (!audioContext) return; const oscillator = audioContext.createOscillator(); oscillator.type = 'sine'; oscillator.frequency.setValueAtTime(frequency, audioContext.currentTime); const gainNode = audioContext.createGain(); gainNode.gain.setValueAtTime(0.5, audioContext.currentTime); gainNode.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + duration); oscillator.connect(gainNode); gainNode.connect(audioContext.destination); oscillator.start(audioContext.currentTime); oscillator.stop(audioContext.currentTime + duration); }
    function noteToFrequency(note) { const noteNameOnly = note.replace(/[0-9]/g, ''); const octave = parseInt(note.slice(-1)); const noteIndex = noteStrings.indexOf(noteNameOnly); if (noteIndex === -1) return null; const noteNumFromC0 = 12 * octave + noteIndex; return C0 * Math.pow(2, noteNumFromC0 / 12); }
    function frequencyToNoteDetails(frequency) { const noteNum = 12 * (Math.log2(frequency / A4)); const roundedNoteNum = Math.round(noteNum); const noteIndex = (roundedNoteNum + 69) % 12; const octave = Math.floor((roundedNoteNum + 69) / 12); const note = noteStrings[noteIndex]; const idealFrequency = A4 * Math.pow(2, roundedNoteNum / 12); const cents = 1200 * Math.log2(frequency / idealFrequency); return { note, octave, cents }; }
    function resetDisplay() { noteElement.textContent = '--'; octaveElement.textContent = ''; centsElement.textContent = `Отклонение: --- cents`; pitchHistory = []; drawPitchGraph(); }
    
    // --- ЗАПУСК ПРИЛОЖЕНИЯ ---
    // --- ИСПРАВЛЕНИЕ 1: ОТКЛАДЫВАЕМ ПЕРВУЮ ОТРИСОВКУ ---
    // Это дает браузеру время на отрисовку CSS и вычисление размеров.
    setTimeout(setupUI, 0);

    window.addEventListener('resize', setupUI);
});