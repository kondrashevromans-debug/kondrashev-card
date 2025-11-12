// pitch.js (ВЕРСИЯ 5.0 - ПРОФЕССИОНАЛЬНЫЙ ГРАФИК ПИТЧА)

document.addEventListener('DOMContentLoaded', () => {
    Telegram.WebApp.ready();

    const display = document.querySelector('.output-display');
    const startButton = document.getElementById('startButton');
    const noteElement = document.getElementById('note');
    const octaveElement = document.getElementById('octave');
    const frequencyElement = document.getElementById('frequency');
    const centsElement = document.getElementById('cents');
    const statusMessage = document.getElementById('status-message');
    const canvas = document.getElementById('pitch-canvas');
    const canvasCtx = canvas.getContext('2d');
    
    let audioContext;
    let analyser;
    let sourceNode;
    let isListening = false;
    let dataArray;
    let animationFrameId;

    let targetNote = null; 

    // НОВОЕ: Настройки для графика
    const PITCH_HISTORY_SIZE = 200; // Сколько точек хранить в истории
    let pitchHistory = [];

    const noteStrings = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
    const A4 = 440;
    const C0 = A4 * Math.pow(2, -4.75); // Частота ноты C0

    // --- ОСНОВНАЯ ЛОГИКА ---

    function updatePitch() {
        analyser.getFloatTimeDomainData(dataArray);
        let rms = 0;
        for (let i = 0; i < dataArray.length; i++) rms += dataArray[i] * dataArray[i];
        rms = Math.sqrt(rms / dataArray.length);

        let currentPitch = null;
        if (rms > 0.01) { // Порог громкости
            const pitch = findFundamentalFrequency(dataArray, audioContext.sampleRate);
            if (pitch) {
                currentPitch = pitch;
                const { note, octave, cents } = frequencyToNoteDetails(pitch);
                
                noteElement.textContent = note;
                octaveElement.textContent = octave;
                frequencyElement.textContent = `Частота: ${pitch.toFixed(1)} Hz`;
                centsElement.textContent = `Отклонение: ${cents.toFixed(0)} cents`;

                if (targetNote) {
                    const sungNoteWithOctave = note + octave;
                    const sungNoteName = note;
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

        // НОВОЕ: Обновляем историю питча
        pitchHistory.push(currentPitch);
        if (pitchHistory.length > PITCH_HISTORY_SIZE) {
            pitchHistory.shift(); // Удаляем самый старый элемент
        }

        // НОВОЕ: Вызываем новую функцию отрисовки
        drawPitchGraph();
        
        animationFrameId = requestAnimationFrame(updatePitch);
    }
    
    // --- НОВАЯ ФУНКЦИЯ ОТРИСОВКИ ГРАФИКА ---

    function drawPitchGraph() {
        const width = canvas.width;
        const height = canvas.height;
        
        // Диапазон нот для отображения на графике (в полутонах от C0)
        // Например, от G2 (2+7=19) до C5 (4*12=48)
        const minNote = 19; // G2
        const maxNote = 48; // C5

        // Очистка и фон
        canvasCtx.fillStyle = 'var(--tg-theme-secondary-bg-color, black)';
        canvasCtx.fillRect(0, 0, width, height);
        
        // Функция для преобразования номера ноты в Y-координату
        const noteToY = (noteNum) => {
            return height - ((noteNum - minNote) / (maxNote - minNote)) * height;
        };

        // Рисуем линии нот (нотный стан)
        for (let i = minNote; i <= maxNote; i++) {
            const y = noteToY(i);
            const noteIndex = i % 12;
            const noteName = noteStrings[noteIndex];
            
            // Основные ноты (без диезов) рисуем ярче
            if (noteName.length === 1) {
                canvasCtx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
                canvasCtx.lineWidth = 1;
                canvasCtx.beginPath();
                canvasCtx.moveTo(0, y);
                canvasCtx.lineTo(width, y);
                canvasCtx.stroke();
                
                // Добавляем подписи нот
                const octave = Math.floor(i / 12);
                if (noteName === "C" || noteName === "G" || noteName === "A" || noteName === "B") { // Чтобы не было слишком много подписей
                    canvasCtx.fillStyle = 'rgba(255, 255, 255, 0.5)';
                    canvasCtx.font = '14px sans-serif';
                    canvasCtx.textAlign = 'left';
                    canvasCtx.fillText(`${noteName}${octave}`, 5, y - 2);
                }
            }
        }

        // Рисуем линию высоты голоса
        canvasCtx.strokeStyle = '#ffc107'; // Желтый цвет
        canvasCtx.lineWidth = 2;
        canvasCtx.beginPath();

        for (let i = 0; i < pitchHistory.length; i++) {
            const pitch = pitchHistory[i];
            const x = (i / PITCH_HISTORY_SIZE) * width;
            
            if (pitch !== null) {
                const noteNum = 12 * Math.log2(pitch / C0);
                const y = noteToY(noteNum);
                
                // Если предыдущая точка была null (тишина), начинаем новую линию
                if (i > 0 && pitchHistory[i - 1] === null) {
                    canvasCtx.moveTo(x, y);
                } else {
                    canvasCtx.lineTo(x, y);
                }
            }
        }
        canvasCtx.stroke();
    }

    // --- ВСПОМОГАТЕЛЬНЫЕ И ОСТАЛЬНЫЕ ФУНКЦИИ (без изменений) ---
    // (Копируем их из прошлой версии)
    const pianoKeys = document.querySelectorAll('.piano .key');
    const noteFrequencies = {
        'C4': 261.63, 'C#4': 277.18, 'D4': 293.66, 'D#4': 311.13, 'E4': 329.63,
        'F4': 349.23, 'F#4': 369.99, 'G4': 392.00, 'G#4': 415.30, 'A4': 440.00,
        'A#4': 466.16, 'B4': 493.88, 'C5': 523.25
    };
    pianoKeys.forEach(key => {
        key.addEventListener('click', () => {
            const note = key.dataset.note;
            targetNote = note; 
            statusMessage.textContent = `Повторите ноту: ${targetNote}`;
            display.classList.remove('correct', 'octave-miss', 'wrong');
            const freq = noteFrequencies[note];
            if (freq) playNote(freq, 0.5);
            if (!isListening) startListening();
        });
    });
    function playNote(frequency, duration) {
        if (!audioContext) audioContext = new (window.AudioContext || window.webkitAudioContext)();
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
    startButton.addEventListener('click', () => {
        if (!audioContext) audioContext = new (window.AudioContext || window.webkitAudioContext)();
        if (!isListening) {
            targetNote = null;
            statusMessage.textContent = 'Свободный режим. Пойте любую ноту.';
            display.classList.remove('correct', 'octave-miss', 'wrong');
            startListening();
        } else stopListening();
    });
    async function startListening() {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) return;
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
        } catch (err) { console.error(err); }
    }
    function stopListening() {