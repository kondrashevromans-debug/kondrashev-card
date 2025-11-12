// pitch.js (ВЕРСИЯ 2.0 - УЛУЧШЕННАЯ)

document.addEventListener('DOMContentLoaded', () => {
    Telegram.WebApp.ready();

    // ... все элементы остаются теми же ...
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

    const noteStrings = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
    const A4 = 440;
    const MIN_SAMPLES = 0; //
    const GOOD_ENOUGH_CORRELATION = 0.9;

    startButton.addEventListener('click', () => {
        if (!isListening) {
            startListening();
        } else {
            stopListening();
        }
    });

    async function startListening() {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            statusMessage.textContent = 'Ваш браузер не поддерживает доступ к микрофону.';
            return;
        }

        try {
            statusMessage.textContent = 'Запрос доступа к микрофону...';
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            
            audioContext = new (window.AudioContext || window.webkitAudioContext)();
            analyser = audioContext.createAnalyser();
            analyser.fftSize = 2048;
            
            dataArray = new Float32Array(analyser.fftSize);
            
            sourceNode = audioContext.createMediaStreamSource(stream);
            sourceNode.connect(analyser);

            isListening = true;
            startButton.textContent = 'Остановить';
            startButton.classList.add('listening');
            statusMessage.textContent = 'Анализ звука... Пойте в микрофон.';

            updatePitch();

        } catch (err) {
            statusMessage.textContent = 'Ошибка доступа к микрофону. Проверьте разрешения.';
            console.error('Ошибка доступа к микрофону:', err);
        }
    }

    function stopListening() {
        if (!isListening) return;

        sourceNode.disconnect();
        sourceNode.mediaStream.getTracks().forEach(track => track.stop());
        audioContext.close();
        
        cancelAnimationFrame(animationFrameId);
        isListening = false;
        
        startButton.textContent = 'Начать анализ';
        startButton.classList.remove('listening');
        statusMessage.textContent = 'Нажмите "Начать", чтобы разрешить доступ к микрофону.';
        resetDisplay();
    }
    
    function updatePitch() {
        analyser.getFloatTimeDomainData(dataArray);

        // *** НОВОЕ: Проверка громкости сигнала ***
        let rms = 0;
        for (let i = 0; i < dataArray.length; i++) {
            rms += dataArray[i] * dataArray[i];
        }
        rms = Math.sqrt(rms / dataArray.length);

        // Порог громкости. Если слишком тихо, ничего не делаем.
        const volumeThreshold = 0.01; 
        if (rms < volumeThreshold) {
            // Можно раскомментировать, чтобы видеть, что сигнал слишком тихий
            // statusMessage.textContent = 'Слишком тихо...';
        } else {
            const pitch = findFundamentalFrequency(dataArray, audioContext.sampleRate);
            if (pitch) {
                statusMessage.textContent = 'Анализ звука...';
                const { note, octave, cents } = frequencyToNoteDetails(pitch);
                noteElement.textContent = note;
                octaveElement.textContent = octave;
                frequencyElement.textContent = `Частота: ${pitch.toFixed(1)} Hz`;
                centsElement.textContent = `Отклонение: ${cents.toFixed(0)} cents`;
            }
        }
        
        drawWaveform(dataArray);
        animationFrameId = requestAnimationFrame(updatePitch);
    }
    
    // *** НОВОЕ: Улучшенный алгоритм определения частоты (Auto-correlation) ***
    function findFundamentalFrequency(buffer, sampleRate) {
        let size = buffer.length;
        let maxSamples = Math.floor(size / 2);
        let bestOffset = -1;
        let bestCorrelation = 0;
        let rms = 0;
        let foundNewBest = false;

        if (size == 0) return null;

        for (let i = 0; i < size; i++) {
            let val = buffer[i];
            rms += val * val;
        }
        rms = Math.sqrt(rms / size);
        if (rms < 0.01) return null; // Недостаточно громко

        let lastCorrelation = 1;
        for (let offset = MIN_SAMPLES; offset < maxSamples; offset++) {
            let correlation = 0;

            for (let i = 0; i < maxSamples; i++) {
                correlation += Math.abs((buffer[i]) - (buffer[i + offset]));
            }
            correlation = 1 - (correlation / maxSamples);

            if ((correlation > GOOD_ENOUGH_CORRELATION) && (correlation > lastCorrelation)) {
                foundNewBest = true;
                if (correlation > bestCorrelation) {
                    bestCorrelation = correlation;
                    bestOffset = offset;
                }
            } else if (foundNewBest) {
                return sampleRate / bestOffset;
            }
            lastCorrelation = correlation;
        }
        if (bestCorrelation > 0.01) {
            return sampleRate / bestOffset;
        }
        return null;
    }
    
    // ----- Остальные функции без изменений -----

    function frequencyToNoteDetails(frequency) {
        const noteNum = 12 * (Math.log2(frequency / A4));
        const roundedNoteNum = Math.round(noteNum);
        const noteIndex = (roundedNoteNum + 69) % 12;
        const octave = Math.floor((roundedNoteNum + 69) / 12);
        const note = noteStrings[noteIndex];
        const idealFrequency = A4 * Math.pow(2, roundedNoteNum / 12);
        const cents = 1200 * Math.log2(frequency / idealFrequency);
        return { note, octave, cents };
    }

    function drawWaveform(data) {
        const width = canvas.width;
        const height = canvas.height;
        const sliceWidth = width * 1.0 / data.length;
        canvasCtx.fillStyle = 'var(--tg-theme-secondary-bg-color, #fff)';
        canvasCtx.fillRect(0, 0, width, height);
        canvasCtx.lineWidth = 2;
        canvasCtx.strokeStyle = 'var(--tg-theme-button-color, #007bff)';
        canvasCtx.beginPath();
        let x = 0;
        for (let i = 0; i < data.length; i++) {
            const v = data[i] * 0.5 + 0.5;
            const y = v * height;
            if (i === 0) { canvasCtx.moveTo(x, y); } else { canvasCtx.lineTo(x, y); }
            x += sliceWidth;
        }
        canvasCtx.lineTo(width, height / 2);
        canvasCtx.stroke();
    }
    
    function resetDisplay() {
        noteElement.textContent = '--';
        octaveElement.textContent = '';
        frequencyElement.textContent = `Частота: --- Hz`;
        centsElement.textContent = `Отклонение: --- cents`;
        if (analyser) {
           drawWaveform(new Float32Array(analyser.fftSize).fill(0));
        }
    }
});