document.addEventListener('DOMContentLoaded', () => {
    const container = document.getElementById('exercises-container');
    if (!container || !exercisesData) {
        console.error('Container or exercises data not found!');
        return;
    }

    // Главный цикл для создания HTML
    for (const mainCategoryTitle in exercisesData) {
        const mainCategoryData = exercisesData[mainCategoryTitle];

        // Создаем главный заголовок (например, "АРТИКУЛЯЦИОННЫЙ АППАРАТ")
        const mainHeader = document.createElement('h1');
        mainHeader.className = 'main-category-title';
        mainHeader.textContent = mainCategoryTitle;
        container.appendChild(mainHeader);

        mainCategoryData.forEach(categoryGroup => {
            // Создаем подзаголовок (например, "Челюсть")
            const subHeader = document.createElement('h3');
            subHeader.className = 'sub-category-title';
            subHeader.textContent = categoryGroup.category;
            container.appendChild(subHeader);

            // Создаем контейнер для упражнений в этой подкатегории
            const exercisesList = document.createElement('div');
            exercisesList.className = 'exercises-list';
            
            categoryGroup.exercises.forEach(exercise => {
                const exerciseItem = document.createElement('div');
                exerciseItem.className = 'exercise-item';

                const exerciseHeader = document.createElement('div');
                exerciseHeader.className = 'exercise-header';
                exerciseHeader.innerHTML = `<span>${exercise.title}</span><span class="indicator">+</span>`;
                
                const exerciseContent = document.createElement('div');
				exerciseContent.className = 'exercise-content';

				const desc = exercise.description;

				// Генерируем HTML из структурированных данных
				let contentHtml = '';
				if (desc.goal) {
					contentHtml += `
						<div class="exercise-section">
							<h4>Цель:</h4>
							<p>${desc.goal}</p>
						</div>
					`;
				}
				if (desc.technique && desc.technique.length > 0) {
					contentHtml += `
						<div class="exercise-section">
							<h4>Техника выполнения:</h4>
							<ol>
								${desc.technique.map(step => `<li>${step}</li>`).join('')}
							</ol>
						</div>
					`;
				}
				if (desc.sensation) {
					contentHtml += `
						<div class="exercise-section">
							<h4>Что вы почувствуете:</h4>
							<p>${desc.sensation}</p>
						</div>
					`;
				}
				exerciseContent.innerHTML = contentHtml;

                exerciseItem.appendChild(exerciseHeader);
                exerciseItem.appendChild(exerciseContent);
                exercisesList.appendChild(exerciseItem);
            });

            container.appendChild(exercisesList);
        });
    }

    // Добавляем обработчик кликов (используем делегирование)
    container.addEventListener('click', (event) => {
        const header = event.target.closest('.exercise-header');
        if (!header) return;

        const item = header.parentElement;
        const content = item.querySelector('.exercise-content');
        const indicator = header.querySelector('.indicator');
        
        // Логика "аккордеона"
        if (item.classList.contains('active')) {
            // Закрыть текущий
            content.style.maxHeight = null;
            item.classList.remove('active');
            indicator.textContent = '+';
        } else {
            // Закрыть все остальные
            const allActiveItems = container.querySelectorAll('.exercise-item.active');
            allActiveItems.forEach(activeItem => {
                activeItem.classList.remove('active');
                activeItem.querySelector('.exercise-content').style.maxHeight = null;
                activeItem.querySelector('.indicator').textContent = '+';
            });

            // Открыть текущий
            item.classList.add('active');
            content.style.maxHeight = content.scrollHeight + "px";
            indicator.textContent = '−';
        }
    });
});