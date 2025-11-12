document.addEventListener('DOMContentLoaded', () => {
    const container = document.getElementById('trainer-menu-container');
    if (!container || !trainerData) return;

    // --- ОБНОВЛЕННЫЕ НАСТРОЙКИ ---
    const difficultySettings = [
        { label: 'легко', value: 'easy', cents: 50 },
        { label: 'норма', value: 'normal', cents: 30 },
        { label: 'сложно', value: 'hard', cents: 10 }
    ];
    const durationSettings = [ { label: '0.7 сек', value: 0.7 }, { label: '1.0 сек', value: 1.0 }, { label: '1.5 сек', value: 1.5 } ];
    
    // Вспомогательная функция для получения номера ноты
    function noteToNoteNum(note) {
        const noteNameOnly = note.replace(/[0-9]/g, '');
        const octave = parseInt(note.slice(-1));
        const noteIndex = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"].indexOf(noteNameOnly);
        if (noteIndex === -1) return null;
        return 12 * octave + noteIndex;
    }

    for (const exerciseId in trainerData) {
        const exercise = trainerData[exerciseId];
        let difficultyIndex = 0; // "легко"
        let durationIndex = 1;   // "1.0 сек"
        let octaveIndex = 1;     // "C3"

        // --- ОБНОВЛЕННАЯ ЛОГИКА ВЫСОТЫ ---
        const baseNoteNum = noteToNoteNum(exercise.notes[0].noteName);
        const octaveTargets = [
            { label: 'C2', targetNum: 24 },
            { label: 'C3', targetNum: 36 },
            { label: 'C4', targetNum: 48 }
        ];
        // Рассчитываем сдвиг относительно базовой ноты упражнения
        const octaveSettings = octaveTargets.map(target => ({
            label: target.label,
            value: target.targetNum - baseNoteNum // сдвиг в полутонах
        }));

        const startLink = document.createElement('a');
        startLink.className = 'start-trainer-button';
        startLink.textContent = 'Начать';

        function updateLink() {
            const difficultyValue = difficultySettings[difficultyIndex].value;
            const shiftValue = octaveSettings[octaveIndex].value;
            const holdValue = durationSettings[durationIndex].value;
            startLink.href = `trainer.html?exercise=${exerciseId}&difficulty=${difficultyValue}&shift=${shiftValue}&hold=${holdValue}`;
        }

        const card = document.createElement('div');
        card.className = 'trainer-card';
        const title = document.createElement('h3');
        title.className = 'trainer-card-title';
        title.textContent = exercise.title;
        
        const difficultyControl = createControl('Точность', difficultySettings.map(s => ({label: s.label})), difficultyIndex, (newIndex) => {
            difficultyIndex = newIndex;
            updateLink();
        });

        const octaveControl = createControl('Высота', octaveSettings.map(s => ({label: s.label})), octaveIndex, (newIndex) => {
            octaveIndex = newIndex;
            updateLink();
        });

        const durationControl = createControl('Длительность', durationSettings.map(s => ({label: s.label})), durationIndex, (newIndex) => {
            durationIndex = newIndex;
            updateLink();
        });
        
        card.appendChild(title);
        card.appendChild(difficultyControl);
        card.appendChild(octaveControl);
        card.appendChild(durationControl);
        card.appendChild(startLink);
        container.appendChild(card);
        updateLink();
    }

    function createControl(labelText, settings, initialIndex, callback) {
        let currentIndex = initialIndex;
        const controlWrapper = document.createElement('div');
        controlWrapper.className = 'trainer-card-controls';
        const label = document.createElement('span');
        label.className = 'control-group-label';
        label.textContent = labelText;
        const selector = document.createElement('div');
        selector.className = 'control-selector';
        const downBtn = document.createElement('button');
        downBtn.textContent = '◄';
        const display = document.createElement('span');
        display.className = 'control-display';
        const upBtn = document.createElement('button');
        upBtn.textContent = '►';
        function updateDisplay() { display.textContent = settings[currentIndex].label; callback(currentIndex); }
        downBtn.addEventListener('click', () => { if (currentIndex > 0) { currentIndex--; updateDisplay(); } });
        upBtn.addEventListener('click', () => { if (currentIndex < settings.length - 1) { currentIndex++; updateDisplay(); } });
        selector.appendChild(downBtn);
        selector.appendChild(display);
        selector.appendChild(upBtn);
        controlWrapper.appendChild(label);
        controlWrapper.appendChild(selector);
        updateDisplay();
        return controlWrapper;
    }
});