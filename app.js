// Получаем доступ к API Телеграма, который предоставляется в объекте window.Telegram.WebApp
const tg = window.Telegram.WebApp;

// Функция для применения цветовой схемы Telegram
function applyTheme() {
    // document.body.style.setProperty(имя_переменной, значение)
    // Мы берем цвета из объекта tg.themeParams и устанавливаем их 
    // для наших CSS-переменных, которые мы определили в style.css
    document.body.style.setProperty('--tg-theme-bg-color', tg.themeParams.bg_color || '#ffffff');
    document.body.style.setProperty('--tg-theme-text-color', tg.themeParams.text_color || '#191919');
    document.body.style.setProperty('--tg-theme-button-color', tg.themeParams.button_color || '#6952DC');
    document.body.style.setProperty('--tg-theme-button-text-color', tg.themeParams.button_text_color || '#ffffff');
    document.body.style.setProperty('--tg-theme-secondary-bg-color', tg.themeParams.secondary_bg_color || '#f3f4f6');
}

// Сообщаем Telegram, что приложение готово к отображению
tg.ready();

// Раскрываем приложение на всю высоту
tg.expand();

// Вызываем функцию применения темы при первой загрузке
applyTheme();

// Устанавливаем обработчик события: если пользователь меняет тему в Telegram,
// наша функция applyTheme будет вызвана снова, чтобы обновить цвета.
tg.onEvent('themeChanged', applyTheme);