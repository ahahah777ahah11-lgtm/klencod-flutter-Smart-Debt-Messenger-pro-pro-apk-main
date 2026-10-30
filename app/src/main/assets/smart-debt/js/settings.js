/**
 * مدير الديون الذكي برو SMS - Smart Debt Manager Pro SMS
 * Settings & Customization Service
 */

const SettingsService = (function() {
  'use strict';

  function getSettings() {
    return AppDatabase.getSettings();
  }

  function updateSettings(newSettings) {
    const current = AppDatabase.getSettings();
    const updated = { ...current, ...newSettings };
    
    // Apply theme to DOM immediately
    applyTheme(updated);

    AppDatabase.persist('settings');
    return updated;
  }

  function applyTheme(settings) {
    const body = document.body;
    
    // Dark mode
    if (settings.theme === 'dark') {
      body.classList.add('theme-dark');
    } else {
      body.classList.remove('theme-dark');
    }

    // Accent color
    body.classList.remove('accent-emerald', 'accent-purple', 'accent-navy');
    if (settings.accentColor === 'emerald') {
      body.classList.add('accent-emerald');
    } else if (settings.accentColor === 'purple') {
      body.classList.add('accent-purple');
    } else if (settings.accentColor === 'navy') {
      body.classList.add('accent-navy');
    }
  }

  return {
    getSettings,
    updateSettings,
    applyTheme
  };
})();

window.SettingsService = SettingsService;
