import { useState, useEffect } from 'react';
import { VoiceSettings, DEFAULT_SETTINGS } from '../lib/realtimeClient';
import { storage } from '../lib/encryptedStorage';

const STORAGE_KEY = 'settings';

export const useVoiceSettings = () => {
  const [settings, setSettings] = useState<VoiceSettings>(DEFAULT_SETTINGS);
  const [isLoaded, setIsLoaded] = useState(false);

  // Load settings from localStorage on mount
  useEffect(() => {
    try {
      const stored = storage.load(STORAGE_KEY, DEFAULT_SETTINGS);
      // Merge with defaults to ensure all properties exist
      setSettings({ ...DEFAULT_SETTINGS, ...stored });
    } catch (error) {
      console.warn('Failed to load settings from localStorage:', error);
    } finally {
      setIsLoaded(true);
    }
  }, []);

  // Save settings to localStorage whenever they change
  const updateSettings = (newSettings: VoiceSettings) => {
    try {
      setSettings(newSettings);
      storage.save(STORAGE_KEY, newSettings);
    } catch (error) {
      console.warn('Failed to save settings to localStorage:', error);
    }
  };

  const hasValidApiKey = () => {
    return settings.apiKey.startsWith('sk-') && settings.apiKey.length > 20;
  };

  const resetSettings = () => {
    updateSettings(DEFAULT_SETTINGS);
    try {
      storage.remove(STORAGE_KEY);
    } catch (error) {
      console.warn('Failed to clear settings from localStorage:', error);
    }
  };

  return {
    settings,
    updateSettings,
    hasValidApiKey,
    resetSettings,
    isLoaded
  };
};