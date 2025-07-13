export interface Character {
  id: string;
  name: string;
  class: string;
  race: string;
  stats: {
    strength: number;
    dexterity: number;
    constitution: number;
    intelligence: number;
    wisdom: number;
    charisma: number;
  };
}

export interface GameSession {
  characterId: string;
  messages: GameMessage[];
  startTime: Date;
  isActive: boolean;
}

export interface GameMessage {
  type: 'user' | 'dm' | 'elara' | 'thorek' | 'grimjaw' | 'valdris' | 'malachar';
  text: string;
  timestamp: Date;
}