// pitch.js (ВЕРСЯ 6.0 - МАКСИМАЛЬНАЯ СОВМЕСТИМОСТЬ С МОБИЛЬНЫМИ)

document.addEventListener('DOMContentLoaded', () => {
    // Ждем готовности API Телеграма, но не зависим от него для основной логики
    if (window.Telegram && window.Telegram.WebApp) {
        Telegram.WebApp.ready();
    }

    // --- Элементы интерфейса ---
    const display = document.querySelector('.output-display');
    const startButton = document.getElementById('startButton');
    const noteElement = document.getElementById('note');
    const octaveElement = document.getElementById('octave');
    const frequencyElement = document.getElementById('frequency');
    const centsElement = document.getElementById('cents');
    const statusMessage = document.getElementById('status-message');
    const canvas = document.getElementById('pitch-canvas');
    const canvasCtx = canvas.getContext('2d');
    
    // --- Глобальные переменные ---
    let audioContext; // ВАЖНО: Инициализируем позже!
    let analyser;
    let sourceNode;
    let isListening = false;
    let dataArray;
    let animationFrameId;
    let targetNote = null; 
    const PITCH_HISTORY_SIZE = 200;
    let pitchHistory = [];

    const noteStrings = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
    const A4 = 440;
    const C0 = A4 * Math.pow(2, -4.75);

    /**
     * ВАЖНЕЙШАЯ ФУНКЦИЯ: Инициализация AudioContext.
     * Вызывается ТОЛЬКО при первом клике пользователя.
     */
    function initAudioContext() {
        if (!audioContext) {
            try {
                console.log("Попытка создать AudioContext...");
                audioContext = new (window.AudioContext || window.webkitAudioContext)();
                console.log("AudioContext успешно создан. Состояние:", audioContext.state);
            } catch (e) {
                console.error("Не удалось создать AudioContext:", e);
                alert("Ваш браузер не поддерживает Web Audio API, необходимое для работы приложения.");
            }
        }
        // Если контекст был создан, но "уснул" (политика браузера), "будим" его
        if (audioContext && audioContext.state === 'suspended') {
            audioContext.resume();
        }
    }

    // --- Обработчики событий ---

    startButton.addEventListener('click', () => {
        initAudioContext(); // Инициализация при клике
        if (!audioContext) return; // Если не удалось создать, ничего не делаем

        if (!isListening) {
            targetNote = null;
            statusMessage.textContent = 'Свободный режим. Пойте любую ноту.';
            display.classList.remove('correct', 'octave-miss', 'wrong');
            startListening();
        } else {
            stopListening();
        }
    });

    const pianoKeys = document.querySelectorAll('.piano .key');
    pianoKeys.forEach(key => {
        key.addEventListener('click', () => {
            initAudioContext(); // Инициализация при клике
            if (!audioContext) return;

            const note = key.dataset.note;
            targetNote = note; 
            statusMessage.textContent = `Повторите ноту: ${targetNote}`;
            display.classList.remove('correct', 'octave-miss', 'wrong');
            
            const freq = noteFrequencies[note];
            if (freq) playNote(freq, 0.5);

            if (!isListening) {
                startListening();
            }
        });
    });

    // --- Основные функции ---

    async function startListening() {
        if (!audioContext || isListening) return;

        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            alert("Ваш браузер не поддерживает доступ к микрофону.");
            return;
        }
        
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            analyser = audioContext.createAnalyser();
            analyser.fftSize = 2048;
            dataArray = new Float32Array(analyser.fftSize);
            sourceNode = audioContext.createMediaStreamSource(stream);
            sourceNode.connect(analyser);
            isListening = true;
            startButton.textContent = 'Остановить';
            startButton.classList.add('listening');
            if (!targetNote) statusMessage.textContent = 'Анализ звука...';
            updatePitch();
        } catch (err) {
            console.error("Ошибка доступа к микрофону:", err);
            statusMessage.textContent = 'Ошибка доступа к микрофону. Разрешите доступ.';
        }
    }

    function stopListening() {
        if (!isListening || !sourceNode) return;
        sourceNode.mediaStream.getTracks().forEach(track => track.stop());
        sourceNode.disconnect();
        sourceNode = null;
        cancelAnimationFrame(animationFrameId);
        isListening = false;
        startButton.textContent = 'Начать анализ';
        startButton.classList.remove('listening');
        statusMessage.textContent = 'Нажмите "Начать" или сыграйте ноту на пианино.';
        display.classList.remove('correct', 'octave-miss', 'wrong');
        resetDisplay();
    }

    function playNote(frequency, duration) {
        if (!audioContext) return;
        const oscillator = audioContext.createOscillator();
        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(frequency, audioContext.currentTime);
        const gainNode = audioContext.createGain();
        gainNode.gain.setValueAtTime(0.5, audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + duration);
        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);
        oscillator.start(audioContext.currentTime);
        oscillator.stop(audioContext.currentTime + duration);
    }
    
    // --- Функции анализа и отрисовки (без изменений) ---
    const noteFrequencies = { /* ... скопируйте этот объект из прошлой версии ... */ 
        'C4': 261.63, 'C#4': 277.18, 'D4': 293.66, 'D#4': 311.13, 'E4': 329.63,
        'F4': 349.23, 'F#4': 369.99, 'G4': 392.00, 'G#4': 415.30, 'A4': 440.00,
        'A#4': 466.16, 'B4': 493.88, 'C5': 523.25
    };
    function updatePitch() { /* ... скопируйте эту функцию из прошлой версии ... */ 
        analyser.getFloatTimeDomainData(dataArray);
        let rms = 0; for (let i = 0; i < dataArray.length; i++) rms += dataArray[i] * dataArray[i];
        rms = Math.sqrt(rms / dataArray.length);
        let currentPitch = null;
        if (rms > 0.01) {
            const pitch = findFundamentalFrequency(dataArray, audioContext.sampleRate);
            if (pitch) {
                currentPitch = pitch;
                const { note, octave, cents } = frequencyToNoteDetails(pitch);
                noteElement.textContent = note; octaveElement.textContent = octave;
                frequencyElement.textContent = `Частота: ${pitch.toFixed(1)} Hz`;
                centsElement.textContent = `Отклонение: ${cents.toFixed(0)} cents`;
                if (targetNote) {
                    const sungNoteWithOctave = note + octave; const sungNoteName = note;
                    const targetNoteName = targetNote.replace(/[0-9]/g, '');
                    display.classList.remove('correct', 'octave-miss', 'wrong');
                    if (sungNoteWithOctave === targetNote) display.classList.add('correct');
                    else if (sungNoteName === targetNoteName) display.classList.add('octave-miss');
                    else display.classList.add('wrong');
                }
            }
        } else {
            display.classList.remove('correct', 'octave-miss', 'wrong');
        }
        pitchHistory.push(currentPitch);
        if (pitchHistory.length > PITCH_HISTORY_SIZE) pitchHistory.shift();
        drawPitchGraph();
        animationFrameId = requestAnimationFrame(updatePitch);
    }
    function drawPitchGraph() { /* ... скопируйте эту функцию из прошлой версии ... */ 
        const width = canvas.width; const height = canvas.height;
        const minNote = 19; const maxNote = 48;
        canvasCtx.fillStyle = 'var(--tg-theme-secondary-bg-color, black)';
        canvasCtx.fillRect(0, 0, width, height);
        const noteToY = (noteNum) => height - ((noteNum - minNote) / (maxNote - minNote)) * height;
        for (let i = minNote; i <= maxNote; i++) {
            const y = noteToY(i); const noteIndex = i % 12; const noteName = noteStrings[noteIndex];
            if (noteName.length === 1) {
                canvasCtx.strokeStyle = 'rgba(255, 255, 255, 0.3)'; canvasCtx.lineWidth = 1;
                canvasCtx.beginPath(); canvasCtx.moveTo(0, y); canvasCtx.lineTo(width, y); canvasCtx.stroke();
                const octave = Math.floor(i / 12);
                if (noteName === "C" || noteName === "G" || noteName === "A" || noteName === "B") {
                    canvasCtx.fillStyle = 'rgba(255, 255, 255, 0.5)'; canvasCtx.font = '14px sans-serif';
                    canvasCtx.textAlign = 'left'; canvasCtx.fillText(`${noteName}${octave}`, 5, y - 2);
                }
            }
        }
        canvasCtx.strokeStyle = '#ffc107'; canvasCtx.lineWidth = 2; canvasCtx.beginPath();
        for (let i = 0; i < pitchHistory.length; i++) {
            const pitch = pitchHistory[i]; const x = (i / PITCH_HISTORY_SIZE) * width;
            if (pitch !== null) {
                const noteNum = 12 * Math.log2(pitch / C0); const y = noteToY(noteNum);
                if (i > 0 && pitchHistory[i - 1] === null) canvasCtx.moveTo(x, y);
                else canvasCtx.lineTo(x, y);
            }
        }
        canvasCtx.stroke();
    }
    function findFundamentalFrequency(buffer, sampleRate) { /* ... скопируйте эту функцию из прошлой версии ... */ 
         let size = buffer.length; let maxSamples = Math.floor(size / 2); let bestOffset = -1; let bestCorrelation = 0; let rms = 0; if (size == 0) return null; for (let i = 0; i < size; i++) { let val = buffer[i]; rms += val * val; } rms = Math.sqrt(rms / size); if (rms < 0.01) return null; let lastCorrelation = 1; for (let offset = 0; offset < maxSamples; offset++) { let correlation = 0; for (let i = 0; i < maxSamples; i++) { correlation += Math.abs((buffer[i]) - (buffer[i + offset])); } correlation = 1 - (correlation / maxSamples); if (correlation > 0.9 && correlation > lastCorrelation) { if (correlation > bestCorrelation) { bestCorrelation = correlation; bestOffset = offset; } } lastCorrelation = correlation; } if (bestCorrelation > 0.01) { return sampleRate / bestOffset; } return null;
    }
    function frequencyToNoteDetails(frequency) { /* ... скопируйте эту функцию из прошлой версии ... */ 
        const noteNum = 12 * (Math.log2(frequency / A4)); const roundedNoteNum = Math.round(noteNum); const noteIndex = (roundedNoteNum + 69) % 12; const octave = Math.floor((roundedNoteNum + 69) / 12); const note = noteStrings[noteIndex]; const idealFrequency = A4 * Math.pow(2, roundedNoteNum / 12); const cents = 1200 * Math.log2(frequency / idealFrequency); return { note, octave, cents };
    }
    function resetDisplay() { /* ... скопируйте эту функцию из прошлой версии ... */ 
        noteElement.textContent = '--'; octaveElement.textContent = ''; frequencyElement.textContent = `Частота: --- Hz`; centsElement.textContent = `Отклонение: --- cents`;
        pitchHistory = [];
        drawPitchGraph();
    }
});