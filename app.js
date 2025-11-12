const tg = window.Telegram.WebApp;

function applyTheme() {
    document.body.style.setProperty('--tg-theme-bg-color', tg.themeParams.bg_color || '#ffffff');
    document.body.style.setProperty('--tg-theme-text-color', tg.themeParams.text_color || '#191919');
    document.body.style.setProperty('--tg-theme-button-color', tg.themeParams.button_color || '#6952DC');
    document.body.style.setProperty('--tg-theme-button-text-color', tg.themeParams.button_text_color || '#ffffff');
    document.body.style.setProperty('--tg-theme-secondary-bg-color', tg.themeParams.secondary_bg_color || '#f3f4f6');
    
    // Добавляем атрибут для CSS, чтобы можно было стилизовать темную тему
    if (tg.colorScheme === 'dark') {
        document.body.setAttribute('data-theme', 'dark');
    } else {
        document.body.removeAttribute('data-theme');
    }
}

// НОВАЯ ФУНКЦИЯ ДЛЯ ПРИВЕТСТВИЯ
function showGreeting() {
    // Находим наш элемент по ID
    const greetingElement = document.getElementById('user-greeting');
    // Проверяем, что элемент существует на странице
    if (greetingElement) {
        // Пытаемся получить имя пользователя
        const userFirstName = tg.initDataUnsafe?.user?.first_name;
        if (userFirstName) {
            // Если имя есть, показываем приветствие
            greetingElement.innerText = `Здравствуйте, ${userFirstName}!`;
        } else {
            // Если по какой-то причине имени нет, можно ничего не показывать или показать общее приветствие
            // greetingElement.innerText = `Здравствуйте!`; 
        }
    }
}

tg.ready();
tg.expand();

applyTheme();
showGreeting(); // Вызываем функцию приветствия при загрузке

tg.onEvent('themeChanged', applyTheme);