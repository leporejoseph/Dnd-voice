import React, { useState } from 'react';
import Start from './screens/Start';
import Voice from './screens/Voice';
import { Character } from './types';

type Screen = 'start' | 'voice';

function App() {
  const [currentScreen, setCurrentScreen] = useState<Screen>('start');
  const [character, setCharacter] = useState<Character | null>(null);

  const handleStartAdventure = (newCharacter: Character) => {
    setCharacter(newCharacter);
    setCurrentScreen('voice');
  };

  const handleExitAdventure = () => {
    setCharacter(null);
    setCurrentScreen('start');
  };

  return (
    <div className="min-h-screen bg-slate-900">
      {currentScreen === 'start' && (
        <Start onStartAdventure={handleStartAdventure} />
      )}
      {currentScreen === 'voice' && character && (
        <Voice character={character} onExit={handleExitAdventure} />
      )}
    </div>
  );
}

export default App;