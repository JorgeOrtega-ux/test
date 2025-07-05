// /assets/js/tools/menu-interactions.js

"use strict";
import { use24HourFormat, deactivateModule, PREMIUM_FEATURES, showSpecificOverlay, getCurrentActiveOverlay } from '../general/main.js';
import { getTranslation } from '../general/translations-controller.js';
import { addTimerAndRender, updateTimer, getTimersCount, getTimerLimit } from './timer-controller.js';
import { showDynamicIslandNotification } from '../general/dynamic-island-controller.js';
import { playSound, stopSound, generateSoundList, handleAudioUpload, deleteUserAudio, getSoundNameById } from './general-tools.js';
import { getCurrentLocation } from '../general/location-manager.js';

const autoIncrementState = {
    isActive: false,
    intervalId: null,
    timeoutId: null,
    initialDelay: 500,
    repeatInterval: 120
};

const initialState = {
    alarm: { hour: 0, minute: 0, sound: 'classic_beep' },
    timer: {
        currentTab: 'countdown',
        duration: { hours: 0, minutes: 5, seconds: 0 },
        countTo: { date: new Date(), selectedDate: null, selectedHour: null, selectedMinute: null, timeSelectionStep: 'hour', sound: 'classic_beep' },
        endAction: 'stop',
        sound: 'classic_beep'
    },
    worldClock: { country: '', timezone: '', countryCode: '', isEditing: false, editingId: null }
};

const state = JSON.parse(JSON.stringify(initialState));
state.timer.countTo.date = new Date();

let soundSelectionCallback = null;
let activeSoundListAction = null;
let previousMenu = null;

const dropdownMap = {
    'toggleTimerEndActionDropdown': '.menu-timer-end-action',
    'toggleCalendarDropdown': '.calendar-container',
    'toggleTimerHourDropdown': '.menu-timer-hour-selection',
    'toggleTimerTypeDropdown': '.menu-timer-type'
};

const menuActivatorMap = {
    'toggleAlarmSoundMenu': { menu: 'menuSounds', callback: (soundId) => state.alarm.sound = soundId },
    'toggleCountdownSoundMenu': { menu: 'menuSounds', callback: (soundId) => state.timer.sound = soundId },
    'toggleCountToDateSoundMenu': { menu: 'menuSounds', callback: (soundId) => state.timer.countTo.sound = soundId },
    'toggleCountryMenu': { menu: 'menuCountry' },
    'toggleTimezoneMenu': { menu: 'menuTimezone' }
};

const menuTimeouts = {};
let areGlobalListenersInitialized = false;

function initMenuInteractions() {
    if (areGlobalListenersInitialized) return;
    setupGlobalEventListeners();
    areGlobalListenersInitialized = true;
}

const getMenuElement = (menuName) => {
    const menuSelectorMap = {
        'menuAlarm': '.menu-alarm[data-menu="Alarm"]',
        'menuTimer': '.menu-timer[data-menu="Timer"]',
        'menuWorldClock': '.menu-worldClock[data-menu="WorldClock"]',
        'menuSounds': '[data-menu="Sounds"]',
        'menuCountry': '[data-menu="Country"]',
        'menuTimezone': '[data-menu="Timezone"]',
    };
    return document.querySelector(menuSelectorMap[menuName]);
};

function startAutoIncrement(actionFn) {
    stopAutoIncrement();
    autoIncrementState.isActive = true;
    actionFn();
    autoIncrementState.timeoutId = setTimeout(() => {
        autoIncrementState.intervalId = setInterval(actionFn, autoIncrementState.repeatInterval);
    }, autoIncrementState.initialDelay);
}

function stopAutoIncrement() {
    if (autoIncrementState.timeoutId) clearTimeout(autoIncrementState.timeoutId);
    if (autoIncrementState.intervalId) clearInterval(autoIncrementState.intervalId);
    autoIncrementState.isActive = false;
    autoIncrementState.timeoutId = null;
    autoIncrementState.intervalId = null;
}

function addSpinnerToCreateButton(button) {
    button.classList.add('disabled-interactive');
    const originalTextSpan = button.querySelector('span');
    if (originalTextSpan) {
        button.setAttribute('data-original-text', originalTextSpan.textContent);
        originalTextSpan.style.display = 'none';
    }
    const loader = document.createElement('span');
    loader.className = 'material-symbols-rounded spinning';
    loader.textContent = 'progress_activity';
    button.appendChild(loader);
}

function removeSpinnerFromCreateButton(button) {
    button.classList.remove('disabled-interactive');
    const originalText = button.getAttribute('data-original-text');
    const textSpan = button.querySelector('span[data-translate]');
    const loader = button.querySelector('.spinning');
    if (loader) loader.remove();
    if (textSpan) {
        textSpan.textContent = originalText;
        textSpan.style.display = 'inline';
        button.removeAttribute('data-original-text');
    }
}

function validateField(element, condition) {
    if (condition) {
        element.classList.remove('input-error');
        return true;
    } else {
        element.classList.add('input-error');
        if (navigator.vibrate) {
            navigator.vibrate(100);
        }
        return false;
    }
}

const setAlarmDefaults = () => {
    const now = new Date();
    now.setMinutes(now.getMinutes() + 10);
    state.alarm.hour = now.getHours();
    state.alarm.minute = now.getMinutes();
};

const resetAlarmMenu = (menuElement) => {
    setAlarmDefaults();
    state.alarm.sound = 'classic_beep';
    const titleInput = menuElement.querySelector('#alarm-title');
    if (titleInput) {
        titleInput.value = '';
        titleInput.removeAttribute('disabled');
        titleInput.parentElement.classList.remove('disabled-interactive', 'input-error');
    }
    const searchInput = menuElement.querySelector('.search-content-text input');
    if (searchInput) searchInput.value = '';
    updateAlarmDisplay(menuElement);
    resetDropdownDisplay(menuElement, '#alarm-selected-sound', 'classic_beep', 'sounds');
    const createButton = menuElement.querySelector('.create-tool');
    if (createButton) {
        if (createButton.classList.contains('disabled-interactive')) removeSpinnerFromCreateButton(createButton);
        createButton.dataset.action = 'createAlarm';
        const buttonText = createButton.querySelector('span');
        if (buttonText) {
            buttonText.setAttribute('data-translate', 'create_alarm');
            buttonText.setAttribute('data-translate-category', 'alarms');
            buttonText.textContent = getTranslation('create_alarm', 'alarms');
        }
    }
    menuElement.removeAttribute('data-editing-id');
    const menuId = menuElement.dataset.menu;
    if (menuTimeouts[menuId]) {
        clearTimeout(menuTimeouts[menuId]);
        delete menuTimeouts[menuId];
    }
};

const resetTimerMenu = (menuElement) => {
    state.timer = JSON.parse(JSON.stringify(initialState.timer));
    state.timer.countTo.date = new Date();
    const countdownTitle = menuElement.querySelector('#timer-title');
    if (countdownTitle) {
        countdownTitle.value = '';
        countdownTitle.removeAttribute('disabled');
        countdownTitle.parentElement.classList.remove('disabled-interactive', 'input-error');
    }
    const countToTitle = menuElement.querySelector('#countto-title');
    if (countToTitle) {
        countToTitle.value = '';
        countToTitle.removeAttribute('disabled');
        countToTitle.parentElement.classList.remove('disabled-interactive', 'input-error');
    }
    updateTimerTabView(menuElement);
    updateTimerDurationDisplay(menuElement);
    renderCalendar(menuElement);
    updateDisplay('#selected-date-display', '-- / -- / ----', menuElement);
    updateDisplay('#selected-hour-display', '--', menuElement);
    updateDisplay('#selected-minute-display', '--', menuElement);
    resetDropdownDisplay(menuElement, '#timer-selected-end-action', 'stop_timer', 'timer');
    resetDropdownDisplay(menuElement, '#countdown-selected-sound', 'classic_beep', 'sounds');
    resetDropdownDisplay(menuElement, '#count-to-date-selected-sound', 'classic_beep', 'sounds');
    const createButton = menuElement.querySelector('.create-tool');
    if (createButton) {
        if (createButton.classList.contains('disabled-interactive')) removeSpinnerFromCreateButton(createButton);
        createButton.dataset.action = 'createTimer';
        const buttonText = createButton.querySelector('span');
        if (buttonText) {
            buttonText.setAttribute('data-translate', 'create_timer');
            buttonText.setAttribute('data-translate-category', 'timer');
            buttonText.textContent = getTranslation('create_timer', 'timer');
        }
    }
    menuElement.removeAttribute('data-editing-id');
};

const resetWorldClockMenu = (menuElement) => {
    const menuId = menuElement.dataset.menu;
    if (menuTimeouts[menuId]) {
        clearTimeout(menuTimeouts[menuId]);
        delete menuTimeouts[menuId];
    }
    
    // Resetear el estado
    state.worldClock = JSON.parse(JSON.stringify(initialState.worldClock));
    
    const titleInput = menuElement.querySelector('#worldclock-title');
    if (titleInput) {
        titleInput.value = '';
        titleInput.parentElement.classList.remove('input-error');
    }
    
    resetDropdownDisplay(menuElement, '#worldclock-selected-country', 'select_a_country', 'world_clock');
    resetDropdownDisplay(menuElement, '#worldclock-selected-timezone', 'select_a_timezone', 'world_clock');

    // CORREGIR: Asegurar que los selectores tengan el estado correcto
    const countrySelector = menuElement.querySelector('[data-action="toggleCountryMenu"]');
    const timezoneSelector = menuElement.querySelector('[data-action="toggleTimezoneMenu"]');
    
    if (countrySelector) {
        countrySelector.classList.remove('input-error');
    }
    
    if (timezoneSelector) {
        timezoneSelector.classList.add('disabled-interactive');
        timezoneSelector.classList.remove('input-error');
    }

    const createButton = menuElement.querySelector('.create-tool');
    if (createButton) {
        if (createButton.classList.contains('disabled-interactive')) removeSpinnerFromCreateButton(createButton);
        createButton.dataset.action = 'addWorldClock';
        const buttonText = createButton.querySelector('span');
        if (buttonText) buttonText.textContent = getTranslation('add_clock', 'tooltips');
    }
    menuElement.removeAttribute('data-editing-id');
};



export function prepareAlarmForEdit(alarmData) {
    const menuElement = getMenuElement('menuAlarm');
    if (!menuElement) return;
    state.alarm.hour = alarmData.hour;
    state.alarm.minute = alarmData.minute;
    state.alarm.sound = alarmData.sound;
    const titleInput = menuElement.querySelector('#alarm-title');
    if (titleInput) {
        if (alarmData.type === 'default') {
            titleInput.value = getTranslation(alarmData.title, 'alarms');
            titleInput.setAttribute('disabled', 'true');
            titleInput.parentElement.classList.add('disabled-interactive');
        } else {
            titleInput.value = alarmData.title;
            titleInput.removeAttribute('disabled');
            titleInput.parentElement.classList.remove('disabled-interactive');
        }
    }
    updateAlarmDisplay(menuElement);
    const alarmSoundName = getSoundNameById(alarmData.sound);
    updateDisplay('#alarm-selected-sound', alarmSoundName, menuElement);
    const createButton = menuElement.querySelector('.create-tool');
    if (createButton) {
        createButton.dataset.action = 'saveAlarmChanges';
        const buttonText = createButton.querySelector('span');
        if (buttonText) {
            buttonText.setAttribute('data-translate', 'save_changes');
            buttonText.setAttribute('data-translate-category', 'alarms');
            buttonText.textContent = getTranslation('save_changes', 'alarms');
        }
    }
    menuElement.setAttribute('data-editing-id', alarmData.id);
}

export function prepareTimerForEdit(timerData) {
    const menuElement = getMenuElement('menuTimer');
    if (!menuElement) return;
    state.timer.currentTab = 'countdown';
    updateTimerTabView(menuElement);
    const durationInMs = timerData.initialDuration;
    const totalSeconds = Math.floor(durationInMs / 1000);
    state.timer.duration.hours = Math.floor(totalSeconds / 3600);
    state.timer.duration.minutes = Math.floor((totalSeconds % 3600) / 60);
    state.timer.duration.seconds = totalSeconds % 60;
    state.timer.endAction = timerData.endAction;
    state.timer.sound = timerData.sound;
    const titleInput = menuElement.querySelector('#timer-title');
    if (titleInput) {
        if (timerData.id.startsWith('default-timer-')) {
            titleInput.value = getTranslation(timerData.title, 'timer');
            titleInput.setAttribute('disabled', 'true');
            titleInput.parentElement.classList.add('disabled-interactive');
        } else {
            titleInput.value = timerData.title;
            titleInput.removeAttribute('disabled');
            titleInput.parentElement.classList.remove('disabled-interactive');
        }
    }
    updateTimerDurationDisplay(menuElement);
    updateDisplay('#timer-selected-end-action', getTranslation(`${timerData.endAction}_timer`, 'timer'), menuElement);
    const countdownSoundName = getSoundNameById(timerData.sound);
    updateDisplay('#countdown-selected-sound', countdownSoundName, menuElement);
    const createButton = menuElement.querySelector('.create-tool');
    if (createButton) {
        createButton.dataset.action = 'saveTimerChanges';
        const buttonText = createButton.querySelector('span');
        if (buttonText) {
            buttonText.setAttribute('data-translate', 'save_changes');
            buttonText.setAttribute('data-translate-category', 'timer');
            buttonText.textContent = getTranslation('save_changes', 'timer');
        }
    }
    menuElement.setAttribute('data-editing-id', timerData.id);
}

function getFormattedDate(date) {
    const location = getCurrentLocation();
    const options = {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    };
    let locale = 'default';

    if (location && location.code.toLowerCase() === 'us') {
        locale = 'en-US';
    }

    return date.toLocaleDateString(locale, options);
}

export function prepareCountToDateForEdit(timerData) {
    const menuElement = getMenuElement('menuTimer');
    if (!menuElement) return;
    state.timer.currentTab = 'count_to_date';
    updateTimerTabView(menuElement);
    const titleInput = menuElement.querySelector('#countto-title');
    if (titleInput) {
        if (timerData.id.startsWith('default-timer-')) {
            titleInput.value = getTranslation(timerData.title, 'timer');
            titleInput.setAttribute('disabled', 'true');
            titleInput.parentElement.classList.add('disabled-interactive');
        } else {
            titleInput.value = timerData.title;
            titleInput.removeAttribute('disabled');
            titleInput.parentElement.classList.remove('disabled-interactive');
        }
    }
    state.timer.countTo.sound = timerData.sound;
    const targetDate = new Date(timerData.targetDate);
    state.timer.countTo.date = targetDate;
    state.timer.countTo.selectedDate = targetDate.toISOString();
    state.timer.countTo.selectedHour = targetDate.getHours();
    state.timer.countTo.selectedMinute = targetDate.getMinutes();

    updateDisplay('#selected-date-display', getFormattedDate(targetDate), menuElement);

    updateDisplay('#selected-hour-display', String(targetDate.getHours()).padStart(2, '0'), menuElement);
    updateDisplay('#selected-minute-display', String(targetDate.getMinutes()).padStart(2, '0'), menuElement);
    const countToDateSoundName = getSoundNameById(timerData.sound);
    updateDisplay('#count-to-date-selected-sound', countToDateSoundName, menuElement);
    renderCalendar(menuElement);
    const createButton = menuElement.querySelector('.create-tool');
    if (createButton) {
        createButton.dataset.action = 'saveCountToDateChanges';
        const buttonText = createButton.querySelector('span');
        if (buttonText) {
            buttonText.setAttribute('data-translate', 'save_changes');
            buttonText.setAttribute('data-translate-category', 'timer');
            buttonText.textContent = getTranslation('save_changes', 'timer');
        }
    }
    menuElement.setAttribute('data-editing-id', timerData.id);
}

export function prepareWorldClockForEdit(clockData) {
    const menuElement = getMenuElement('menuWorldClock');
    if (!menuElement) return;
    state.worldClock.isEditing = true;
    state.worldClock.editingId = clockData.id;
    state.worldClock.country = clockData.country;
    state.worldClock.timezone = clockData.timezone;
    state.worldClock.countryCode = clockData.countryCode;
    const titleInput = menuElement.querySelector('#worldclock-title');
    if (titleInput) titleInput.value = clockData.title;
    updateDisplay('#worldclock-selected-country', clockData.country, menuElement);
    populateTimezoneDropdown(menuElement, clockData.countryCode).then(() => {
        const timezoneSelector = menuElement.querySelector('[data-action="toggleTimezoneMenu"]');
        if (timezoneSelector) timezoneSelector.classList.remove('disabled-interactive');
        const ct = window.ct;
        const tzObject = ct.getTimezone(clockData.timezone);
        const cityName = tzObject.name.split('/').pop().replace(/_/g, ' ');
        const displayName = `(UTC ${tzObject.utcOffsetStr}) ${cityName}`;
        updateDisplay('#worldclock-selected-timezone', displayName, menuElement);
    });
    const createButton = menuElement.querySelector('.create-tool');
    if (createButton) {
        createButton.dataset.action = 'saveWorldClockChanges';
        const buttonText = createButton.querySelector('span');
        if (buttonText) {
            buttonText.setAttribute('data-translate', 'save_changes');
            buttonText.setAttribute('data-translate-category', 'world_clock_options');
            buttonText.textContent = getTranslation('save_changes', 'world_clock_options');
        }
    }
    menuElement.setAttribute('data-editing-id', clockData.id);
}

const initializeAlarmMenu = (menuElement) => {
    if (!menuElement.hasAttribute('data-editing-id')) {
        setAlarmDefaults();
    }
    updateAlarmDisplay(menuElement);
};

const initializeTimerMenu = (menuElement) => {
    updateTimerDurationDisplay(menuElement);
    renderCalendar(menuElement);
    populateHourSelectionMenu(menuElement);
};

const initializeWorldClockMenu = (menuElement) => {
    const timezoneSelector = menuElement.querySelector('[data-action="toggleTimezoneMenu"]');
    if (timezoneSelector) timezoneSelector.classList.add('disabled-interactive');
};

export function initializeMenuForOverlay(menuName) {
    const menuElement = getMenuElement(menuName);
    if (!menuElement) return;
    switch (menuName) {
        case 'menuAlarm': initializeAlarmMenu(menuElement); break;
        case 'menuTimer': initializeTimerMenu(menuElement); break;
        case 'menuWorldClock': initializeWorldClockMenu(menuElement); break;
    }
}

export function resetMenuForOverlay(menuName) {
    const menuElement = getMenuElement(menuName);
    if (!menuElement) return;
    switch (menuName) {
        case 'menuAlarm': resetAlarmMenu(menuElement); break;
        case 'menuTimer': resetTimerMenu(menuElement); break;
        case 'menuWorldClock': resetWorldClockMenu(menuElement); break;
    }
}

const loadCountriesAndTimezones = () => new Promise((resolve, reject) => {
    if (window.ct) return resolve(window.ct);
    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/gh/manuelmhtr/countries-and-timezones@latest/dist/index.min.js';
    script.onload = () => window.ct ? resolve(window.ct) : reject(new Error('Library loaded but ct object not found'));
    script.onerror = () => reject(new Error('Failed to load script'));
    document.head.appendChild(script);
});

const updateDisplay = (selector, text, parent = document) => {
    const element = parent.querySelector(selector);
    if (element) element.textContent = text;
};

const handleSelect = (selectedItem, displaySelector) => {
    const parentMenu = selectedItem.closest('.menu-alarm, .menu-timer, .menu-worldClock');
    if (!parentMenu) return;
    const displayElement = parentMenu.querySelector(displaySelector);
    const dropdownMenu = selectedItem.closest('.dropdown-menu-container');
    const textToDisplay = selectedItem.querySelector('.menu-link-text span')?.textContent;
    if (displayElement && textToDisplay) displayElement.textContent = textToDisplay;
    if (dropdownMenu) dropdownMenu.classList.add('disabled');
};

const toggleDropdown = (action, parentMenu) => {
    const targetSelector = dropdownMap[action];
    if (!targetSelector || !parentMenu) return;
    const targetDropdown = parentMenu.querySelector(targetSelector);
    if (!targetDropdown) return;
    const isCurrentlyOpen = !targetDropdown.classList.contains('disabled');
    document.querySelectorAll('.dropdown-menu-container').forEach(d => d.classList.add('disabled'));
    if (!isCurrentlyOpen) {
        targetDropdown.classList.remove('disabled');
    }
};

const resetDropdownDisplay = (menuElement, displaySelector, translateKey, translateCategory) => {
    const display = menuElement.querySelector(displaySelector);
    if (display && typeof getTranslation === 'function') {
        display.textContent = getTranslation(translateKey, translateCategory);
    }
};

const updateAlarmDisplay = (parent) => {
    let finalHourText;
    const hourUnit = getTranslation('h', 'timer');
    const minuteUnit = getTranslation('min', 'timer');
    
    if (use24HourFormat) {
        finalHourText = `${state.alarm.hour} ${hourUnit}`;
    } else {
        const hour = state.alarm.hour;
        const ampm = hour >= 12 ? 'PM' : 'AM';
        let hour12 = hour % 12;
        hour12 = hour12 ? hour12 : 12;
        finalHourText = `${hour12} ${ampm}`;
    }
    updateDisplay('#hour-display', finalHourText, parent);
    updateDisplay('#minute-display', `${state.alarm.minute} ${minuteUnit}`, parent);
};

const updateTimerDurationDisplay = (timerMenu) => {
    if (!timerMenu) return;
    const hourText = getTranslation('h', 'timer');
    const minuteText = getTranslation('min', 'timer');
    const secondText = getTranslation('s', 'timer');
    updateDisplay('#timer-hour-display', `${state.timer.duration.hours} ${hourText}`, timerMenu);
    updateDisplay('#timer-minute-display', `${state.timer.duration.minutes} ${minuteText}`, timerMenu);
    updateDisplay('#timer-second-display', `${state.timer.duration.seconds} ${secondText}`, timerMenu);
};

const updateTimerTabView = (timerMenu) => {
    if (!timerMenu) return;
    const display = timerMenu.querySelector('#timer-type-display');
    const iconDisplay = timerMenu.querySelector('#timer-type-icon');
    if (display && iconDisplay) {
        const isCountdown = state.timer.currentTab === 'countdown';
        const key = isCountdown ? 'countdown' : 'count_to_date';
        display.textContent = getTranslation(key, 'timer');
        iconDisplay.textContent = isCountdown ? 'timer' : 'event';
    }
    const dropdown = timerMenu.querySelector('.menu-timer-type');
    if (dropdown) {
        dropdown.querySelectorAll('.menu-link').forEach(link => {
            link.classList.remove('active');
            if (link.dataset.tab === state.timer.currentTab) {
                link.classList.add('active');
            }
        });
    }
    timerMenu.querySelectorAll('.menu-content-wrapper[data-tab-content]').forEach(c => {
        c.classList.remove('active');
        c.classList.add('disabled');
    });
    const activeContent = timerMenu.querySelector(`.menu-content-wrapper[data-tab-content="${state.timer.currentTab}"]`);
    if (activeContent) {
        activeContent.classList.remove('disabled');
        activeContent.classList.add('active');
    }
};

const renderCalendar = (timerMenu) => {
    if (!timerMenu) return;
    const monthYearDisplay = timerMenu.querySelector('#calendar-month-year');
    const daysContainer = timerMenu.querySelector('.calendar-days');
    if (!monthYearDisplay || !daysContainer) return;
    const date = state.timer.countTo.date;
    monthYearDisplay.textContent = date.toLocaleDateString(navigator.language, { month: 'long', year: 'numeric' });
    daysContainer.innerHTML = '';
    const firstDayIndex = new Date(date.getFullYear(), date.getMonth(), 1).getDay();
    const lastDate = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
    for (let i = 0; i < firstDayIndex; i++) daysContainer.innerHTML += `<div class="day other-month"></div>`;
    for (let i = 1; i <= lastDate; i++) {
        const dayEl = document.createElement('div');
        dayEl.className = 'day'; dayEl.textContent = i; dayEl.dataset.day = i;
        const today = new Date();
        if (i === today.getDate() && date.getMonth() === today.getMonth() && date.getFullYear() === today.getFullYear()) dayEl.classList.add('today');
        if (state.timer.countTo.selectedDate && i === new Date(state.timer.countTo.selectedDate).getDate() && date.getMonth() === new Date(state.timer.countTo.selectedDate).getMonth()) dayEl.classList.add('selected');
        daysContainer.appendChild(dayEl);
    }
    const currentYear = new Date().getFullYear();
    const minYear = currentYear - 265;
    const prevButton = timerMenu.querySelector('[data-action="prev-month"]');
    const nextButton = timerMenu.querySelector('[data-action="next-month"]');
    if (prevButton) {
        prevButton.disabled = (date.getFullYear() < minYear || (date.getFullYear() === minYear && date.getMonth() === 0));
        prevButton.classList.toggle('disabled-interactive', prevButton.disabled);
    }
    if (nextButton) {
        nextButton.disabled = false;
        nextButton.classList.remove('disabled-interactive');
    }
};

const selectCalendarDate = (day, timerMenu) => {
    state.timer.countTo.selectedDate = new Date(state.timer.countTo.date.getFullYear(), state.timer.countTo.date.getMonth(), day).toISOString();
    const selectedDate = new Date(state.timer.countTo.selectedDate);
    updateDisplay('#selected-date-display', getFormattedDate(selectedDate), timerMenu);
    timerMenu.querySelector('.calendar-container')?.classList.add('disabled');
    renderCalendar(timerMenu);
};

const populateHourSelectionMenu = (timerMenu) => {
    if (!timerMenu) return;
    const hourMenu = timerMenu.querySelector('.menu-timer-hour-selection .menu-list');
    if (!hourMenu || hourMenu.children.length > 0) return;
    for (let i = 0; i < 24; i++) {
        const hour = String(i).padStart(2, '0');
        const link = document.createElement('div');
        link.className = 'menu-link'; link.setAttribute('data-action', 'selectTimerHour'); link.setAttribute('data-hour', i);
        link.innerHTML = `<div class="menu-link-text"><span>${hour}:00</span></div>`;
        hourMenu.appendChild(link);
    }
};

const populateMinuteSelectionMenu = (hour, timerMenu) => {
    if (!timerMenu) return;
    const minuteMenu = timerMenu.querySelector('.menu-timer-minute-selection .menu-list');
    if (!minuteMenu) return;
    minuteMenu.innerHTML = '';
    for (let j = 0; j < 60; j += 5) {
        const hourStr = String(hour).padStart(2, '0');
        const minuteStr = String(j).padStart(2, '0');
        const link = document.createElement('div');
        link.className = 'menu-link'; link.setAttribute('data-action', 'selectTimerMinute'); link.setAttribute('data-hour', hour); link.setAttribute('data-minute', j);
        link.innerHTML = `<div class="menu-link-text"><span>${hourStr}:${minuteStr}</span></div>`;
        minuteMenu.appendChild(link);
    }
};

async function populateCountryDropdown(parentMenu) {
    const countryList = parentMenu.querySelector('.country-list');
    if (!countryList) return;

    if (countryList.children.length > 1) return;

    const loadingText = (typeof getTranslation === 'function') ? getTranslation('loading_countries', 'world_clock') : 'Loading countries...';
    countryList.innerHTML = `<div class="menu-link-text" style="padding: 0 12px;"><span>${loadingText}</span></div>`;

    try {
        const ct = await loadCountriesAndTimezones();
        const countries = Object.values(ct.getAllCountries()).sort((a, b) => a.name.localeCompare(b.name));
        countryList.innerHTML = '';
        countries.forEach(country => {
            const link = document.createElement('div');
            link.className = 'menu-link'; link.setAttribute('data-action', 'selectCountry'); link.setAttribute('data-country-code', country.id);
            link.innerHTML = `<div class="menu-link-icon"><span class="material-symbols-rounded">public</span></div><div class="menu-link-text"><span>${country.name}</span></div>`;
            countryList.appendChild(link);
        });
    } catch (error) {
        const errorText = (typeof getTranslation === 'function') ? getTranslation('error_loading_countries', 'world_clock') : '❌ Error loading countries.';
        countryList.innerHTML = `<div class="menu-link-text" style="padding: 0 12px;"><span>${errorText}</span></div>`;
    }
}

async function populateTimezoneDropdown(parentMenu, countryCode) {
    const timezoneList = parentMenu.querySelector('.timezone-list');
    const mainWorldClockMenu = getMenuElement('menuWorldClock');
    const timezoneSelector = mainWorldClockMenu.querySelector('[data-action="toggleTimezoneMenu"]');

    if (!timezoneList || !timezoneSelector) return;

    timezoneList.innerHTML = '';

    try {
        const ct = await loadCountriesAndTimezones();
        const timezones = ct.getTimezonesForCountry(countryCode);

        if (timezones && timezones.length > 0) {
            timezones.forEach(tz => {
                const cityName = tz.name.split('/').pop().replace(/_/g, ' ');
                const displayName = `(UTC ${tz.utcOffsetStr}) ${cityName}`;
                const link = document.createElement('div');
                link.className = 'menu-link';
                link.setAttribute('data-action', 'selectTimezone');
                link.setAttribute('data-timezone', tz.name);
                link.innerHTML = `
                    <div class="menu-link-icon"><span class="material-symbols-rounded">schedule</span></div>
                    <div class="menu-link-text"><span>${displayName}</span></div>
                `;
                timezoneList.appendChild(link);
            });
            // CORREGIR: Habilitar el selector
            timezoneSelector.classList.remove('disabled-interactive');
        } else {
            const noTimezonesText = (typeof getTranslation === 'function') ? getTranslation('no_timezones_found', 'world_clock') : '⚠️ No timezones found.';
            timezoneList.innerHTML = `<div class="menu-link-text" style="padding: 0 12px;"><span>${noTimezonesText}</span></div>`;
            timezoneSelector.classList.add('disabled-interactive');
        }
    } catch (error) {
        const errorText = (typeof getTranslation === 'function') ? getTranslation('error_loading_timezones', 'world_clock') : '❌ Error loading timezones.';
        timezoneList.innerHTML = `<div class="menu-link-text" style="padding: 0 12px;"><span>${errorText}</span></div>`;
        timezoneSelector.classList.add('disabled-interactive');
    }
}

function showSubMenu(menuToShow, currentMenu) {
    previousMenu = currentMenu;
    showSpecificOverlay(menuToShow);
}

function goBackToPreviousMenu() {
    if (previousMenu) {
        showSpecificOverlay(previousMenu);
        previousMenu = null;
    }
}

function setupGlobalEventListeners() {
    document.addEventListener('click', (event) => {
        const isClickInsideDropdown = event.target.closest('.dropdown-menu-container');
        const actionTarget = event.target.closest('[data-action]');
        const isClickOnToggle = actionTarget && dropdownMap[actionTarget.dataset.action];
        const isCalendarNavigation = event.target.closest('.calendar-nav, .calendar-header, .calendar-weekdays, .day.other-month');

        if (!isClickInsideDropdown && !isClickOnToggle && !isCalendarNavigation) {
            document.querySelectorAll('.dropdown-menu-container').forEach(d => d.classList.add('disabled'));
        }
    });

    document.body.addEventListener('input', (event) => {
        const searchInput = event.target.closest('#menu-country-search-input');
        if (searchInput) {
            const searchTerm = searchInput.value.toLowerCase();
            const countryList = document.querySelector('.menu-country .country-list');
            const countries = countryList.querySelectorAll('.menu-link');
            let matchesFound = 0;
            countries.forEach(country => {
                const countryName = country.querySelector('.menu-link-text span').textContent.toLowerCase();
                const match = countryName.includes(searchTerm);
                country.style.display = match ? 'flex' : 'none';
                if (match) matchesFound++;
            });
            let noResultsMsg = countryList.querySelector('.no-results-message');
            if (matchesFound === 0 && searchTerm) {
                if (!noResultsMsg) {
                    noResultsMsg = document.createElement('div');
                    noResultsMsg.className = 'no-results-message';
                    countryList.appendChild(noResultsMsg);
                }
                const noResultsText = (typeof getTranslation === 'function') ? getTranslation('no_results', 'search') : 'No results found for';
                noResultsMsg.textContent = `${noResultsText} "${searchInput.value}"`;
            } else if (noResultsMsg) {
                noResultsMsg.remove();
            }
        }

        const soundSearchInput = event.target.closest('#menu-sounds-search-input');
        if (soundSearchInput) {
            const searchTerm = soundSearchInput.value.toLowerCase();
            const soundList = document.querySelector('.menu-sounds .sounds-list');
            const soundItems = soundList.querySelectorAll('.menu-link[data-sound]');
            let matchesFound = 0;
            soundItems.forEach(item => {
                const soundName = item.querySelector('.menu-link-text span').textContent.toLowerCase();
                const match = soundName.includes(searchTerm);
                item.style.display = match ? 'flex' : 'none';
                if (match) matchesFound++;
            });

            let noResultsMsg = soundList.querySelector('.no-results-message');
            if (matchesFound === 0 && searchTerm) {
                if (!noResultsMsg) {
                    noResultsMsg = document.createElement('div');
                    noResultsMsg.className = 'no-results-message';
                    soundList.appendChild(noResultsMsg);
                }
                const noResultsText = (typeof getTranslation === 'function') ? getTranslation('no_results', 'search') : 'No results found for';
                noResultsMsg.textContent = `${noResultsText} "${soundSearchInput.value}"`;
            } else if (noResultsMsg) {
                noResultsMsg.remove();
            }
        }
    });

    document.body.addEventListener('click', (event) => {
        const parentMenu = event.target.closest('.menu-alarm, .menu-timer, .menu-worldClock, .menu-sounds, .menu-country, .menu-timezone');
        if (!parentMenu || autoIncrementState.isActive) return;
        handleMenuClick(event, parentMenu);
    });

    const incrementDecrementActions = {
        'increaseHour': (p) => { state.alarm.hour = (state.alarm.hour + 1) % 24; updateAlarmDisplay(p); },
        'decreaseHour': (p) => { state.alarm.hour = (state.alarm.hour - 1 + 24) % 24; updateAlarmDisplay(p); },
        'increaseMinute': (p) => { state.alarm.minute = (state.alarm.minute + 1) % 60; updateAlarmDisplay(p); },
        'decreaseMinute': (p) => { state.alarm.minute = (state.alarm.minute - 1 + 60) % 60; updateAlarmDisplay(p); },
        'increaseTimerHour': (p) => { state.timer.duration.hours = (state.timer.duration.hours + 1) % 100; updateTimerDurationDisplay(p); },
        'decreaseTimerHour': (p) => { state.timer.duration.hours = (state.timer.duration.hours - 1 + 100) % 100; updateTimerDurationDisplay(p); },
        'increaseTimerMinute': (p) => { state.timer.duration.minutes = (state.timer.duration.minutes + 1) % 60; updateTimerDurationDisplay(p); },
        'decreaseTimerMinute': (p) => { state.timer.duration.minutes = (state.timer.duration.minutes - 1 + 60) % 60; updateTimerDurationDisplay(p); },
        'increaseTimerSecond': (p) => { state.timer.duration.seconds = (state.timer.duration.seconds + 1) % 60; updateTimerDurationDisplay(p); },
        'decreaseTimerSecond': (p) => { state.timer.duration.seconds = (state.timer.duration.seconds - 1 + 60) % 60; updateTimerDurationDisplay(p); },
    };

    Object.keys(incrementDecrementActions).forEach(action => {
        document.querySelectorAll(`[data-action="${action}"]`).forEach(button => {
            const parentMenu = button.closest('.menu-alarm, .menu-timer');
            if (!parentMenu) return;
            const actionFn = () => incrementDecrementActions[action](parentMenu);
            button.addEventListener('mousedown', () => startAutoIncrement(actionFn));
            button.addEventListener('touchstart', (e) => { e.preventDefault(); startAutoIncrement(actionFn); });
        });
    });

    ['mouseup', 'mouseleave', 'touchend', 'touchcancel'].forEach(eventType => {
        document.addEventListener(eventType, stopAutoIncrement);
    });
    
    document.querySelectorAll('.enter-text-tool input, .custom-select-content').forEach(el => {
        const parentWrapper = el.closest('.enter-text-tool, .custom-select-content');
        if (!parentWrapper) return;

        el.addEventListener('input', () => parentWrapper.classList.remove('input-error'));
        el.addEventListener('click', () => {
            const dropdown = parentWrapper.nextElementSibling;
            if (dropdown && dropdown.classList.contains('dropdown-menu-container')) {
                 dropdown.addEventListener('click', () => parentWrapper.classList.remove('input-error'), { once: true });
            }
        });
    });
}


async function handleMenuClick(event, parentMenu) {
    const target = event.target;
    const actionTarget = target.closest('[data-action]');
    if (!actionTarget) return;

    const action = actionTarget.dataset.action;

    if (menuActivatorMap[action]) {
        event.stopPropagation();
        const menuConfig = menuActivatorMap[action];
        const currentMenuName = getCurrentActiveOverlay();
        showSubMenu(menuConfig.menu, currentMenuName);
        
        if (menuConfig.menu === 'menuSounds') {
            soundSelectionCallback = menuConfig.callback;
            let currentSoundId = null;
            if(action === 'toggleAlarmSoundMenu') currentSoundId = state.alarm.sound;
            if(action === 'toggleCountdownSoundMenu') currentSoundId = state.timer.sound;
            if(action === 'toggleCountToDateSoundMenu') currentSoundId = state.timer.countTo.sound;
            
            const soundListContainer = document.querySelector('.menu-sounds .sounds-list');
            generateSoundList(soundListContainer, 'selectSound', currentSoundId);
            activeSoundListAction = action;
        } else if (menuConfig.menu === 'menuCountry') {
            const countryList = document.querySelector('.menu-country .country-list');
            await populateCountryDropdown(document.querySelector('.menu-country'));
        }
        return;
    }

    if (action === 'back-to-previous-menu') {
        goBackToPreviousMenu();
        return;
    }
    
    if (action === 'selectSound') {
        const soundId = actionTarget.dataset.sound;
        if (soundSelectionCallback) {
            soundSelectionCallback(soundId);
            
            let displaySelector = '';
            if(activeSoundListAction === 'toggleAlarmSoundMenu') displaySelector = '#alarm-selected-sound';
            if(activeSoundListAction === 'toggleCountdownSoundMenu') displaySelector = '#countdown-selected-sound';
            if(activeSoundListAction === 'toggleCountToDateSoundMenu') displaySelector = '#count-to-date-selected-sound';
            
            if(displaySelector) {
                const mainCreatorMenu = getMenuElement(previousMenu);
                if(mainCreatorMenu) {
                    updateDisplay(displaySelector, getSoundNameById(soundId), mainCreatorMenu);
                }
            }
        }
        goBackToPreviousMenu();
        return;
    }
// En menu-interactions.js, corregir la función selectCountry

if (action === 'selectCountry') {
    event.stopPropagation();
    const countryCode = actionTarget.getAttribute('data-country-code');
    const countryName = actionTarget.querySelector('.menu-link-text span')?.textContent;
    
    // Actualizar el estado
    state.worldClock.country = countryName;
    state.worldClock.countryCode = countryCode;
    state.worldClock.timezone = ''; // Resetear timezone

    const mainWorldClockMenu = getMenuElement('menuWorldClock');
    updateDisplay('#worldclock-selected-country', countryName, mainWorldClockMenu);
    resetDropdownDisplay(mainWorldClockMenu, '#worldclock-selected-timezone', 'select_a_timezone', 'world_clock');
    
    // AQUÍ ESTÁ EL PROBLEMA: Buscar el selector correcto
    const timezoneSelector = mainWorldClockMenu.querySelector('[data-action="toggleTimezoneMenu"]');
    if (timezoneSelector) {
        // Primero activar para que se pueda usar
        timezoneSelector.classList.remove('disabled-interactive');
        
        // Luego poblar las zonas horarias
        populateTimezoneDropdown(mainWorldClockMenu, countryCode).then(() => {
            // Asegurar que sigue habilitado después de poblar
            timezoneSelector.classList.remove('disabled-interactive');
        });
    }

    goBackToPreviousMenu();
    return;
}

    if (action === 'selectTimezone') {
        event.stopPropagation();
        const timezone = actionTarget.getAttribute('data-timezone');
        const timezoneDisplayName = actionTarget.querySelector('.menu-link-text span')?.textContent;
        state.worldClock.timezone = timezone;
        
        const mainWorldClockMenu = getMenuElement('menuWorldClock');
        updateDisplay('#worldclock-selected-timezone', timezoneDisplayName, mainWorldClockMenu);

        goBackToPreviousMenu();
        return;
    }


    if (dropdownMap[action]) {
        toggleDropdown(action, parentMenu);
        return;
    }

    // --- SWITCH PRINCIPAL DE ACCIONES ---
    switch (action) {
        case 'prev-month': state.timer.countTo.date.setMonth(state.timer.countTo.date.getMonth() - 1); renderCalendar(parentMenu); break;
        case 'next-month': state.timer.countTo.date.setMonth(state.timer.countTo.date.getMonth() + 1); renderCalendar(parentMenu); break;
        case 'selectTimerHour':
            event.stopPropagation();
            const hour = parseInt(actionTarget.dataset.hour, 10);
            state.timer.countTo.selectedHour = hour;
            updateDisplay('#selected-hour-display', String(hour).padStart(2, '0'), parentMenu);
            updateDisplay('#selected-minute-display', '--', parentMenu);
            actionTarget.closest('.dropdown-menu-container')?.classList.add('disabled');
            populateMinuteSelectionMenu(hour, parentMenu);
            const minuteMenu = parentMenu.querySelector('.menu-timer-minute-selection');
            if (minuteMenu) minuteMenu.classList.remove('disabled');
            state.timer.countTo.timeSelectionStep = 'minute';
            break;
        case 'selectTimerMinute':
            event.stopPropagation();
            const minute = parseInt(actionTarget.dataset.minute, 10);
            state.timer.countTo.selectedMinute = minute;
            updateDisplay('#selected-minute-display', String(minute).padStart(2, '0'), parentMenu);
            actionTarget.closest('.dropdown-menu-container')?.classList.add('disabled');
            state.timer.countTo.timeSelectionStep = 'hour';
            break;
        
        case 'previewAlarmSound': stopSound(); playSound(state.alarm.sound); setTimeout(stopSound, 1000); break;
        case 'previewCountdownSound': stopSound(); playSound(state.timer.sound); setTimeout(stopSound, 1000); break;
        case 'previewCountToDateSound': stopSound(); playSound(state.timer.countTo.sound); setTimeout(stopSound, 1000); break;
        
        case 'upload-audio':
            event.stopPropagation();
            handleAudioUpload(() => {
                const soundListContainer = document.querySelector('.menu-sounds .sounds-list');
                let currentSoundId = null;
                if(activeSoundListAction === 'toggleAlarmSoundMenu') currentSoundId = state.alarm.sound;
                if(activeSoundListAction === 'toggleCountdownSoundMenu') currentSoundId = state.timer.sound;
                if(activeSoundListAction === 'toggleCountToDateSoundMenu') currentSoundId = state.timer.countTo.sound;
                generateSoundList(soundListContainer, 'selectSound', currentSoundId);
            });
            break;
        case 'delete-user-audio':
            event.stopPropagation();
            const audioIdToDelete = actionTarget.dataset.audioId;
            if (audioIdToDelete) {
                deleteUserAudio(audioIdToDelete).then(() => {
                    const soundListContainer = document.querySelector('.menu-sounds .sounds-list');
                    let currentSoundId = null;
                    if(activeSoundListAction === 'toggleAlarmSoundMenu') currentSoundId = state.alarm.sound;
                    if(activeSoundListAction === 'toggleCountdownSoundMenu') currentSoundId = state.timer.sound;
                    if(activeSoundListAction === 'toggleCountToDateSoundMenu') currentSoundId = state.timer.countTo.sound;
                    generateSoundList(soundListContainer, 'selectSound', currentSoundId);
                });
            }
            break;
        case 'createAlarm': {
            const alarmTitleInput = parentMenu.querySelector('#alarm-title');
            const isTitleValid = validateField(alarmTitleInput.parentElement, alarmTitleInput.value.trim());

            if (!isTitleValid) return;
            
            const alarmLimit = window.alarmManager?.getAlarmLimit() ?? (PREMIUM_FEATURES ? 100 : 5);
            const currentAlarmCount = window.alarmManager?.getAlarmCount() ?? 0;
            if (currentAlarmCount >= alarmLimit) {
                showDynamicIslandNotification('system', 'limit_reached', null, 'notifications', { type: getTranslation('alarms', 'tooltips') });
                return;
            }
            addSpinnerToCreateButton(actionTarget);
            setTimeout(() => {
                if (window.alarmManager?.createAlarm(alarmTitleInput.value.trim(), state.alarm.hour, state.alarm.minute, state.alarm.sound)) {
                    deactivateModule('overlayContainer', { source: 'create-alarm' });
                } else removeSpinnerFromCreateButton(actionTarget);
                resetAlarmMenu(parentMenu);
            }, 500);
            break;
        }
        case 'createTimer': {
            let isValid = true;
            if (state.timer.currentTab === 'countdown') {
                const timerTitleInput = parentMenu.querySelector('#timer-title');
                const { hours, minutes, seconds } = state.timer.duration;

                isValid = validateField(timerTitleInput.parentElement, timerTitleInput.value.trim());

                if (hours === 0 && minutes === 0 && seconds === 0) {
                    console.error("Timer duration must be greater than zero.");
                    isValid = false;
                }
                
                if (!isValid) return;

                if (getTimersCount() >= getTimerLimit()) {
                    showDynamicIslandNotification('system', 'limit_reached', null, 'notifications', { type: getTranslation('timer', 'tooltips') });
                    return;
                }
                
                addSpinnerToCreateButton(actionTarget);
                setTimeout(() => {
                    addTimerAndRender({ type: 'countdown', title: timerTitleInput.value.trim(), duration: (hours * 3600 + minutes * 60 + seconds) * 1000, endAction: state.timer.endAction, sound: state.timer.sound });
                    deactivateModule('overlayContainer', { source: 'create-timer' });
                    resetTimerMenu(parentMenu);
                }, 500);

            } else {
                const eventTitleInput = parentMenu.querySelector('#countto-title');
                const { selectedDate, selectedHour, selectedMinute } = state.timer.countTo;
                
                isValid = validateField(eventTitleInput.parentElement, eventTitleInput.value.trim());
                isValid = validateField(parentMenu.querySelector('[data-action="toggleCalendarDropdown"]'), selectedDate) && isValid;
                isValid = validateField(parentMenu.querySelector('[data-action="toggleTimerHourDropdown"]'), typeof selectedHour === 'number') && isValid;

                if (!isValid) return;
                
                if (getTimersCount() >= getTimerLimit()) {
                    showDynamicIslandNotification('system', 'limit_reached', null, 'notifications', { type: getTranslation('timer', 'tooltips') });
                    return;
                }
                addSpinnerToCreateButton(actionTarget);
                setTimeout(() => {
                    const targetDate = new Date(selectedDate);
                    targetDate.setHours(selectedHour, selectedMinute, 0, 0);
                    addTimerAndRender({ type: 'count_to_date', title: eventTitleInput.value.trim(), targetDate: targetDate.toISOString(), sound: state.timer.countTo.sound });
                    deactivateModule('overlayContainer', { source: 'create-timer' });
                    resetTimerMenu(parentMenu);
                }, 500);
            }
            break;
        }
       case 'addWorldClock': {
    const clockTitleInput = parentMenu.querySelector('#worldclock-title');
    const { country, timezone } = state.worldClock;
    const countrySelector = parentMenu.querySelector('[data-action="toggleCountryMenu"]');
    const timezoneSelector = parentMenu.querySelector('[data-action="toggleTimezoneMenu"]');

    let isValid = validateField(clockTitleInput.parentElement, clockTitleInput.value.trim());
    isValid = validateField(countrySelector, country) && isValid;
    
    // CORREGIR: Validar zona horaria solo si el selector está habilitado
    if (!timezoneSelector.classList.contains('disabled-interactive')) {
        isValid = validateField(timezoneSelector, timezone) && isValid;
    } else {
        // Si el selector está deshabilitado, marcar como inválido
        isValid = false;
        timezoneSelector.classList.add('input-error');
    }

    if (!isValid) return;

    const clockLimit = window.worldClockManager?.getClockLimit() ?? (PREMIUM_FEATURES ? 100 : 5);
    if ((window.worldClockManager?.getClockCount() ?? 0) >= clockLimit) {
        showDynamicIslandNotification('system', 'limit_reached', null, 'notifications', { type: getTranslation('world_clock', 'tooltips') });
        return;
    }
    
    addSpinnerToCreateButton(actionTarget);
    setTimeout(() => {
        if (window.worldClockManager?.createAndStartClockCard(clockTitleInput.value.trim(), country, timezone)) {
            deactivateModule('overlayContainer', { source: 'add-world-clock' });
        } else removeSpinnerFromCreateButton(actionTarget);
        resetWorldClockMenu(parentMenu);
    }, 500);
    break;
}
        case 'saveAlarmChanges': {
            const editingId = parentMenu.getAttribute('data-editing-id');
            const alarmTitleInput = parentMenu.querySelector('#alarm-title');
            if (!editingId || !validateField(alarmTitleInput.parentElement, alarmTitleInput.value.trim())) return;
            
            addSpinnerToCreateButton(actionTarget);
            setTimeout(() => {
                window.alarmManager?.updateAlarm(editingId, { title: alarmTitleInput.value.trim(), hour: state.alarm.hour, minute: state.alarm.minute, sound: state.alarm.sound });
                deactivateModule('overlayContainer', { source: 'save-alarm' });
                resetAlarmMenu(parentMenu);
            }, 500);
            break;
        }
        case 'saveTimerChanges': {
            const editingId = parentMenu.getAttribute('data-editing-id');
            if (!editingId) return;

            const timerTitleInput = parentMenu.querySelector('#timer-title');
            if (!validateField(timerTitleInput.parentElement, timerTitleInput.value.trim())) return;

            addSpinnerToCreateButton(actionTarget);
            setTimeout(() => {
                const { hours, minutes, seconds } = state.timer.duration;
                if (hours > 0 || minutes > 0 || seconds > 0) {
                    updateTimer(editingId, { title: timerTitleInput.value.trim(), duration: (hours * 3600 + minutes * 60 + seconds) * 1000, endAction: state.timer.endAction, sound: state.timer.sound });
                    deactivateModule('overlayContainer', { source: 'save-timer' });
                } else removeSpinnerFromCreateButton(actionTarget);
                resetTimerMenu(parentMenu);
            }, 500);
            break;
        }
        case 'saveCountToDateChanges': {
            const editingId = parentMenu.getAttribute('data-editing-id');
            if (!editingId) return;

            const eventTitleInput = parentMenu.querySelector('#countto-title');
            const { selectedDate, selectedHour, selectedMinute } = state.timer.countTo;

            let isValid = validateField(eventTitleInput.parentElement, eventTitleInput.value.trim());
            isValid = validateField(parentMenu.querySelector('[data-action="toggleCalendarDropdown"]'), selectedDate) && isValid;
            isValid = validateField(parentMenu.querySelector('[data-action="toggleTimerHourDropdown"]'), typeof selectedHour === 'number') && isValid;
            
            if (!isValid) return;

            addSpinnerToCreateButton(actionTarget);
            setTimeout(() => {
                const targetDate = new Date(selectedDate);
                targetDate.setHours(selectedHour, selectedMinute, 0, 0);
                updateTimer(editingId, { type: 'count_to_date', title: eventTitleInput.value.trim(), targetDate: targetDate.toISOString(), sound: state.timer.countTo.sound });
                deactivateModule('overlayContainer', { source: 'save-timer' });
                resetTimerMenu(parentMenu);
            }, 500);
            break;
        }
        case 'saveWorldClockChanges': {
            const editingId = parentMenu.getAttribute('data-editing-id');
            const clockTitleInput = parentMenu.querySelector('#worldclock-title');
            const { country, timezone } = state.worldClock;
            
            let isValid = validateField(clockTitleInput.parentElement, clockTitleInput.value.trim());
            isValid = validateField(parentMenu.querySelector('[data-action="toggleCountryMenu"]'), country) && isValid;
            isValid = validateField(parentMenu.querySelector('[data-action="toggleTimezoneMenu"]'), timezone) && isValid;

            if (!editingId || !isValid) return;

            addSpinnerToCreateButton(actionTarget);
            setTimeout(() => {
                window.worldClockManager?.updateClockCard(editingId, { title: clockTitleInput.value.trim(), country, timezone });
                deactivateModule('overlayContainer', { source: 'save-world-clock' });
                resetWorldClockMenu(parentMenu);
            }, 500);
            break;
        }
    }
}

export { initMenuInteractions };