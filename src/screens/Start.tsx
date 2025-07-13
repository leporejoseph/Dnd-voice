import React, { useState } from 'react';
import { Sword, Sparkles, User, Crown, Dices } from 'lucide-react';
import CharacterModal from '../components/CharacterModal';
import { Character } from '../types';

interface StartProps {
  onStartAdventure: (character: Character) => void;
}

const Start: React.FC<StartProps> = ({ onStartAdventure }) => {
  const [showCharacterModal, setShowCharacterModal] = useState(false);

  const handleCharacterCreated = (character: Character) => {
    setShowCharacterModal(false);
    onStartAdventure(character);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center p-4">
      {/* Background decorative elements */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-1/4 left-1/4 w-64 h-64 bg-purple-500/10 rounded-full blur-3xl"></div>
        <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-amber-500/10 rounded-full blur-3xl"></div>
        <div className="absolute top-3/4 left-1/2 w-56 h-56 bg-blue-500/10 rounded-full blur-3xl"></div>
      </div>

      <div className="relative z-10 text-center max-w-2xl mx-auto">
        {/* Logo and Title */}
        <div className="mb-8">
          <div className="flex justify-center mb-6">
            <div className="relative">
              <Sword className="w-16 h-16 text-amber-400 transform rotate-45" />
              <Sparkles className="w-8 h-8 text-purple-400 absolute -top-2 -right-2 animate-pulse" />
            </div>
          </div>
          <h1 className="text-6xl font-bold bg-gradient-to-r from-amber-300 via-purple-300 to-amber-300 bg-clip-text text-transparent mb-4">
            VoiceQuest
          </h1>
          <p className="text-xl text-slate-300 font-medium">
            Speak your adventure into existence with an AI Dungeon Master
          </p>
        </div>

        {/* Features */}
        <div className="grid md:grid-cols-3 gap-6 mb-12">
          <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl p-6 border border-slate-700/50">
            <User className="w-8 h-8 text-purple-400 mx-auto mb-3" />
            <h3 className="text-lg font-semibold text-white mb-2">Quick Character</h3>
            <p className="text-slate-400 text-sm">Roll stats and customize your hero in seconds</p>
          </div>
          <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl p-6 border border-slate-700/50">
            <Crown className="w-8 h-8 text-amber-400 mx-auto mb-3" />
            <h3 className="text-lg font-semibold text-white mb-2">AI Dungeon Master</h3>
            <p className="text-slate-400 text-sm">Immersive storytelling that responds to your voice</p>
          </div>
          <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl p-6 border border-slate-700/50">
            <Dices className="w-8 h-8 text-green-400 mx-auto mb-3" />
            <h3 className="text-lg font-semibold text-white mb-2">30-Minute Sessions</h3>
            <p className="text-slate-400 text-sm">Perfect bite-sized adventures for any schedule</p>
          </div>
        </div>

        {/* CTA Button */}
        <button
          onClick={() => setShowCharacterModal(true)}
          className="group relative inline-flex items-center gap-3 bg-gradient-to-r from-purple-600 to-amber-600 hover:from-purple-500 hover:to-amber-500 text-white font-bold text-xl px-12 py-4 rounded-xl transition-all duration-300 transform hover:scale-105 hover:shadow-2xl hover:shadow-purple-500/25"
        >
          <User className="w-6 h-6 group-hover:animate-pulse" />
          Create Character
          <div className="absolute inset-0 bg-gradient-to-r from-purple-600 to-amber-600 rounded-xl blur opacity-0 group-hover:opacity-50 transition-opacity duration-300 -z-10"></div>
        </button>

        <p className="text-slate-400 text-sm mt-6">
          Your adventure begins with a single character. Let your voice guide the story.
        </p>
      </div>

      {/* Character Creation Modal */}
      {showCharacterModal && (
        <CharacterModal
          onClose={() => setShowCharacterModal(false)}
          onCharacterCreated={handleCharacterCreated}
        />
      )}
    </div>
  );
};

export default Start;