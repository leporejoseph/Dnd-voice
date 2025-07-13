import React, { useState } from 'react';
import { X, Dices, User, Crown, Sword } from 'lucide-react';
import { Character } from '../types';

interface CharacterModalProps {
  onClose: () => void;
  onCharacterCreated: (character: Character) => void;
}

const classes = ['Fighter', 'Wizard', 'Rogue', 'Cleric', 'Ranger', 'Bard', 'Barbarian', 'Sorcerer'];
const races = ['Human', 'Elf', 'Dwarf', 'Halfling', 'Dragonborn', 'Tiefling', 'Half-Elf', 'Gnome'];

const rollStat = () => {
  // Roll 4d6, drop lowest (classic D&D method)
  const rolls = Array.from({ length: 4 }, () => Math.floor(Math.random() * 6) + 1);
  rolls.sort((a, b) => b - a);
  return rolls.slice(0, 3).reduce((sum, roll) => sum + roll, 0);
};

const rollAllStats = () => ({
  strength: rollStat(),
  dexterity: rollStat(),
  constitution: rollStat(),
  intelligence: rollStat(),
  wisdom: rollStat(),
  charisma: rollStat(),
});

const CharacterModal: React.FC<CharacterModalProps> = ({ onClose, onCharacterCreated }) => {
  const [name, setName] = useState('');
  const [selectedClass, setSelectedClass] = useState('Fighter');
  const [selectedRace, setSelectedRace] = useState('Human');
  const [stats, setStats] = useState(rollAllStats());

  const handleCreate = () => {
    if (!name.trim()) return;

    const character: Character = {
      id: crypto.randomUUID(),
      name: name.trim(),
      class: selectedClass,
      race: selectedRace,
      stats,
    };

    onCharacterCreated(character);
  };

  const rerollStats = () => {
    setStats(rollAllStats());
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-slate-800 rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-700">
          <div className="flex items-center gap-3">
            <User className="w-6 h-6 text-purple-400" />
            <h2 className="text-2xl font-bold text-white">Create Your Hero</h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-700 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-slate-400" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Character Name */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Character Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter your hero's name..."
              className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-3 text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            />
          </div>

          {/* Class Selection */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-3">
              <Crown className="w-4 h-4 inline mr-2" />
              Class
            </label>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              {classes.map((cls) => (
                <button
                  key={cls}
                  onClick={() => setSelectedClass(cls)}
                  className={`p-3 rounded-lg text-sm font-medium transition-all ${
                    selectedClass === cls
                      ? 'bg-purple-600 text-white shadow-lg'
                      : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                  }`}
                >
                  {cls}
                </button>
              ))}
            </div>
          </div>

          {/* Race Selection */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-3">
              <Sword className="w-4 h-4 inline mr-2" />
              Race
            </label>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              {races.map((race) => (
                <button
                  key={race}
                  onClick={() => setSelectedRace(race)}
                  className={`p-3 rounded-lg text-sm font-medium transition-all ${
                    selectedRace === race
                      ? 'bg-amber-600 text-white shadow-lg'
                      : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                  }`}
                >
                  {race}
                </button>
              ))}
            </div>
          </div>

          {/* Stats */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <label className="block text-sm font-medium text-slate-300">
                <Dices className="w-4 h-4 inline mr-2" />
                Ability Scores
              </label>
              <button
                onClick={rerollStats}
                className="flex items-center gap-2 text-sm text-purple-400 hover:text-purple-300 transition-colors"
              >
                <Dices className="w-4 h-4" />
                Reroll
              </button>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {Object.entries(stats).map(([stat, value]) => (
                <div key={stat} className="bg-slate-700 rounded-lg p-3 text-center">
                  <div className="text-sm text-slate-400 capitalize mb-1">{stat}</div>
                  <div className="text-2xl font-bold text-white">{value}</div>
                  <div className="text-xs text-slate-500">
                    {Math.floor((value - 10) / 2) >= 0 ? '+' : ''}{Math.floor((value - 10) / 2)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-6 border-t border-slate-700">
          <button
            onClick={onClose}
            className="px-6 py-2 text-slate-400 hover:text-white transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleCreate}
            disabled={!name.trim()}
            className="flex items-center gap-2 bg-gradient-to-r from-purple-600 to-amber-600 hover:from-purple-500 hover:to-amber-500 disabled:from-slate-600 disabled:to-slate-600 text-white font-medium px-8 py-2 rounded-lg transition-all duration-300 disabled:cursor-not-allowed"
          >
            <User className="w-4 h-4" />
            Begin Adventure
          </button>
        </div>
      </div>
    </div>
  );
};

export default CharacterModal;