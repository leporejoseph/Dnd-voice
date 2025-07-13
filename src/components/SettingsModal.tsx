import React, { useState, useEffect } from 'react';
import { X, Settings, Key, Mic, Sliders, Info, Eye, EyeOff } from 'lucide-react';
import { VoiceSettings, DEFAULT_SETTINGS } from '../lib/realtimeClient';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: VoiceSettings;
  onSettingsChange: (settings: VoiceSettings) => void;
}

const AVAILABLE_MODELS = [
  { id: 'gpt-4o-mini-realtime-preview-2024-12-17', name: 'GPT-4o Mini (Recommended)', description: 'Fast and cost-effective' },
  { id: 'gpt-4o-realtime-preview-2024-12-17', name: 'GPT-4o', description: 'Most capable, higher cost' }
];

const AVAILABLE_VOICES = [
  { id: 'verse', name: 'Verse', description: 'Conversational and friendly' },
  { id: 'alloy', name: 'Alloy', description: 'Neutral and clear' },
  { id: 'echo', name: 'Echo', description: 'Deep and resonant' },
  { id: 'shimmer', name: 'Shimmer', description: 'Warm and expressive' }
];

const SettingsModal: React.FC<SettingsModalProps> = ({ 
  isOpen, 
  onClose, 
  settings, 
  onSettingsChange 
}) => {
  const [localSettings, setLocalSettings] = useState<VoiceSettings>(settings);
  const [showApiKey, setShowApiKey] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    setLocalSettings(settings);
    setHasChanges(false);
  }, [settings, isOpen]);

  const handleSettingChange = (key: keyof VoiceSettings, value: string | number) => {
    const newSettings = { ...localSettings, [key]: value };
    setLocalSettings(newSettings);
    setHasChanges(true);
  };

  const handleSave = () => {
    onSettingsChange(localSettings);
    setHasChanges(false);
    onClose();
  };

  const handleReset = () => {
    setLocalSettings(DEFAULT_SETTINGS);
    setHasChanges(true);
  };

  const isValidApiKey = (key: string) => {
    return key.startsWith('sk-') && key.length > 20;
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-slate-800 rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-700">
          <div className="flex items-center gap-3">
            <Settings className="w-6 h-6 text-purple-400" />
            <h2 className="text-2xl font-bold text-white">Voice Settings</h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-700 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-slate-400" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* API Key Section */}
          <div className="bg-slate-900/50 rounded-xl p-4 border border-slate-700/50">
            <div className="flex items-center gap-2 mb-3">
              <Key className="w-5 h-5 text-amber-400" />
              <h3 className="text-lg font-semibold text-white">OpenAI API Key</h3>
              {!isValidApiKey(localSettings.apiKey) && (
                <span className="text-xs bg-red-500/20 text-red-300 px-2 py-1 rounded">Required</span>
              )}
            </div>
            
            <div className="space-y-3">
              <div className="relative">
                <input
                  type={showApiKey ? "text" : "password"}
                  value={localSettings.apiKey}
                  onChange={(e) => handleSettingChange('apiKey', e.target.value)}
                  placeholder="sk-..."
                  className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-3 pr-12 text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent font-mono text-sm"
                />
                <button
                  type="button"
                  onClick={() => setShowApiKey(!showApiKey)}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-slate-400 hover:text-white transition-colors"
                >
                  {showApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              
              <div className="flex items-start gap-2 text-sm text-slate-400">
                <Info className="w-4 h-4 mt-0.5 flex-shrink-0" />
                <div>
                  <p>Get your API key from <a href="https://platform.openai.com/api-keys" target="_blank" rel="noopener noreferrer" className="text-purple-400 hover:text-purple-300 underline">OpenAI Platform</a></p>
                  <p className="mt-1">Your key is stored locally and never sent to our servers.</p>
                </div>
              </div>
            </div>
          </div>

          {/* Model Selection */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-3">
              <Mic className="w-4 h-4 inline mr-2" />
              Model
            </label>
            <div className="space-y-2">
              {AVAILABLE_MODELS.map((model) => (
                <button
                  key={model.id}
                  onClick={() => handleSettingChange('model', model.id)}
                  className={`w-full text-left p-4 rounded-lg border transition-all ${
                    localSettings.model === model.id
                      ? 'bg-purple-600/20 border-purple-500/50 text-white'
                      : 'bg-slate-700/50 border-slate-600/50 text-slate-300 hover:bg-slate-700'
                  }`}
                >
                  <div className="font-medium">{model.name}</div>
                  <div className="text-sm text-slate-400 mt-1">{model.description}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Voice Selection */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-3">
              <Mic className="w-4 h-4 inline mr-2" />
              Voice
            </label>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {AVAILABLE_VOICES.map((voice) => (
                <button
                  key={voice.id}
                  onClick={() => handleSettingChange('voice', voice.id)}
                  className={`text-left p-3 rounded-lg border transition-all ${
                    localSettings.voice === voice.id
                      ? 'bg-amber-600/20 border-amber-500/50 text-white'
                      : 'bg-slate-700/50 border-slate-600/50 text-slate-300 hover:bg-slate-700'
                  }`}
                >
                  <div className="font-medium text-sm">{voice.name}</div>
                  <div className="text-xs text-slate-400 mt-1">{voice.description}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Temperature */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-3">
              <Sliders className="w-4 h-4 inline mr-2" />
              Creativity ({localSettings.temperature})
            </label>
            <div className="px-1">
              <input
                type="range"
                min="0"
                max="1"
                step="0.1"
                value={localSettings.temperature}
                onChange={(e) => handleSettingChange('temperature', parseFloat(e.target.value))}
                className="w-full h-2 bg-slate-700 rounded-lg appearance-none slider"
              />
              <div className="flex justify-between text-xs text-slate-500 mt-1">
                <span>Focused</span>
                <span>Creative</span>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-6 border-t border-slate-700">
          <button
            onClick={handleReset}
            className="px-4 py-2 text-slate-400 hover:text-white transition-colors"
          >
            Reset to Defaults
          </button>
          
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="px-6 py-2 text-slate-400 hover:text-white transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={!hasChanges}
              className="flex items-center gap-2 bg-gradient-to-r from-purple-600 to-amber-600 hover:from-purple-500 hover:to-amber-500 disabled:from-slate-600 disabled:to-slate-600 text-white font-medium px-8 py-2 rounded-lg transition-all duration-300 disabled:cursor-not-allowed"
            >
              <Settings className="w-4 h-4" />
              Save Settings
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SettingsModal;