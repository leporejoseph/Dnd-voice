import React, { useState, useRef, useEffect } from 'react';
import { Mic, MicOff, Volume2, ArrowLeft, User, Crown, Sword, Settings, Send } from 'lucide-react';
import { Character, GameMessage } from '../types';
import { RealtimeClient } from '../lib/realtimeClient';
import SettingsModal from '../components/SettingsModal';
import { useVoiceSettings } from '../hooks/useVoiceSettings';
import { storage } from '../lib/encryptedStorage';

interface VoiceProps {
  character: Character;
  onExit: () => void;
}

const Voice: React.FC<VoiceProps> = ({ character, onExit }) => {
  const { settings, updateSettings, hasValidApiKey, isLoaded } = useVoiceSettings();
  const [showSettings, setShowSettings] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [messages, setMessages] = useState<GameMessage[]>([]);
  const [sessionTime, setSessionTime] = useState(0);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const realtimeClient = useRef<RealtimeClient | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [audioLevel, setAudioLevel] = useState(0);
  const [isAISpeaking, setIsAISpeaking] = useState(false);
  const [currentlyPlaying, setCurrentlyPlaying] = useState<number | null>(null);
  const [speechSynthesis, setSpeechSynthesis] = useState<SpeechSynthesis | null>(null);
  const [currentUtterance, setCurrentUtterance] = useState<SpeechSynthesisUtterance | null>(null);
  const [currentNPC, setCurrentNPC] = useState<string>('dm');

  // Initialize speech synthesis
  useEffect(() => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      setSpeechSynthesis(window.speechSynthesis);
    }
  }, []);

  // Save character data encrypted
  useEffect(() => {
    storage.save('currentCharacter', character);
  }, [character]);

  // Save session messages encrypted
  useEffect(() => {
    storage.save('sessionMessages', messages);
  }, [messages]);

  // Show settings modal if no valid API key
  useEffect(() => {
    if (isLoaded && !hasValidApiKey() && !showSettings) {
      setShowSettings(true);
    }
  }, [isLoaded, hasValidApiKey, showSettings]);

  // Session timer (30 minutes = 1800 seconds)
  useEffect(() => {
    const timer = setInterval(() => {
      setSessionTime((prev) => prev + 1);
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Initialize with welcome message
  useEffect(() => {
    const welcomeMessage: GameMessage = {
      type: 'dm',
      text: `Welcome, ${character.name} the ${character.race} ${character.class}! You find yourself standing at the edge of a mysterious forest. Ancient trees tower above you, their branches whispering secrets in the wind. A worn path leads deeper into the shadows. What do you do?`,
      timestamp: new Date(),
    };
    setMessages([welcomeMessage]);
    
    // Initialize Realtime client
    initializeRealtimeClient();
    
    return () => {
      if (realtimeClient.current) {
        realtimeClient.current.disconnect();
      }
      // Clean up speech synthesis
      if (speechSynthesis && currentUtterance) {
        speechSynthesis.cancel();
      }
    };
  }, [character]);

  const initializeRealtimeClient = async () => {
    setIsConnecting(true);
    setConnectionError(null);
    
    try {
      realtimeClient.current = new RealtimeClient(
        character,
        settings,
        // On message from DM
        (message) => {
          console.log('Received DM message:', message);
          setMessages(prev => [...prev, message]);
          setIsAISpeaking(true);
          // Clear AI speaking after message is complete
          setTimeout(() => setIsAISpeaking(false), 2000);
        },
        // On transcript
        (text) => {
          console.log('Received transcript:', text);
          setTranscript(text);
          // Add user message when transcript is complete
          setMessages(prev => [...prev, {
            type: 'user',
            text,
            timestamp: new Date()
          }]);
        },
        // On error
        (error) => {
          setConnectionError(error);
        },
        // On audio level change
        (level) => {
          setAudioLevel(level);
        },
        // On NPC change
        (npcName) => {
          setCurrentNPC(npcName);
        }
      );
      
      console.log('Connecting to realtime client...');
      await realtimeClient.current.connect();
    } catch (error) {
      console.error('Failed to initialize realtime client:', error);
      setConnectionError(error instanceof Error ? error.message : 'Failed to connect');
    } finally {
      setIsConnecting(false);
    }
  };

  // Reinitialize client when settings change
  useEffect(() => {
    if (isLoaded && realtimeClient.current) {
      realtimeClient.current.disconnect();
      initializeRealtimeClient();
    }
  }, [settings, isLoaded]);

  const handleStartListening = () => {
    console.log('Start listening clicked');
    // Force stop any currently playing message audio when user starts talking
    stopCurrentAudio();
    
    // Stop AI speaking state when user starts talking
    setIsAISpeaking(false);
    
    if (realtimeClient.current) {
      const success = realtimeClient.current.startListening();
      if (success) {
        setIsListening(true);
        setTranscript('');
        setIsAISpeaking(false);
        console.log('Started listening - microphone should be active');
      } else {
        console.error('Failed to start listening');
      }
    }
  };

  const handleStopListening = () => {
    console.log('Stop listening clicked');
    // Force stop any currently playing message audio when user sends message
    stopCurrentAudio();
    
    // Stop AI speaking state when user sends message
    setIsAISpeaking(false);
    
    if (realtimeClient.current && isListening) {
      realtimeClient.current.stopListening();
      setIsListening(false);
      console.log('Stopped listening');
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Keyboard event handlers for spacebar
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.code === 'Space' && !event.repeat && !isListening && hasValidApiKey()) {
        event.preventDefault();
        console.log('Spacebar pressed - starting listening');
        handleStartListening();
      }
    };

    const handleKeyUp = (event: KeyboardEvent) => {
      if (event.code === 'Space' && isListening) {
        event.preventDefault();
        console.log('Spacebar released - stopping listening');
        handleStopListening();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [isListening, hasValidApiKey]);

  const remainingTime = Math.max(0, 1800 - sessionTime);

  const stopCurrentAudio = () => {
    if (speechSynthesis) {
      speechSynthesis.cancel();
      // Force immediate stop
      setTimeout(() => {
        if (speechSynthesis) {
          speechSynthesis.cancel();
        }
      }, 10);
      // Additional force stop for stubborn browsers
      setTimeout(() => {
        if (speechSynthesis) {
          speechSynthesis.cancel();
        }
      }, 50);
    }
    if (currentUtterance) {
      setCurrentUtterance(null);
    }
    setCurrentlyPlaying(null);
  };

  const playMessageAudio = (text: string, index: number) => {
    if (!speechSynthesis) {
      console.warn('Speech synthesis not available');
      return;
    }

    // Stop any currently playing audio
    if (currentUtterance) {
      speechSynthesis.cancel();
      setCurrentUtterance(null);
      setCurrentlyPlaying(null);
    }

    setCurrentlyPlaying(index);
    
    const utterance = new SpeechSynthesisUtterance(text);
    
    // Try to use a more natural voice if available
    const voices = speechSynthesis.getVoices();
    const preferredVoice = voices.find(voice => 
      voice.name.includes('Natural') || 
      voice.name.includes('Premium') ||
      voice.name.includes('Enhanced') ||
      voice.lang.startsWith('en')
    );
    
    if (preferredVoice) {
      utterance.voice = preferredVoice;
    }
    
    utterance.rate = 0.9;
    utterance.pitch = 1.0;
    utterance.volume = 0.8;
    
    utterance.onend = () => {
      setCurrentlyPlaying(null);
      setCurrentUtterance(null);
    };
    
    utterance.onerror = (event) => {
      console.error('Speech synthesis error:', event.error);
      setCurrentlyPlaying(null);
      setCurrentUtterance(null);
    };
    
    setCurrentUtterance(utterance);
    speechSynthesis.speak(utterance);
  };

  const switchToNPC = (npcName: string) => {
    if (realtimeClient.current && npcName !== currentNPC) {
      console.log(`Switching to NPC: ${npcName}`);
      setCurrentNPC(npcName);
      realtimeClient.current.updateSessionInstructions(npcName);
      
      // Add a system message to indicate NPC switch
      const switchMessage: GameMessage = {
        type: 'dm',
        text: `*${npcName === 'dm' ? 'Dungeon Master' : npcName.charAt(0).toUpperCase() + npcName.slice(1)} speaks*`,
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, switchMessage]);
    }
  };

  return (
    <div className="h-screen bg-gradient-to-br from-indigo-900 via-purple-900 to-slate-900 flex flex-col">
      {/* Header */}
      <div className="bg-slate-800/90 backdrop-blur-sm border-b border-slate-700 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={onExit}
              className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
              Exit Adventure
            </button>
            <div className="h-6 w-px bg-slate-600" />
            <div className="flex items-center gap-3">
              <User className="w-5 h-5 text-purple-400" />
              <span className="text-white font-medium">{character.name}</span>
              <span className="text-slate-400">•</span>
              <span className="text-slate-300">{character.race} {character.class}</span>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            {/* Current NPC Indicator */}
            <div className="flex items-center gap-2 bg-slate-700/50 px-3 py-1 rounded-lg">
              <div className={`w-2 h-2 rounded-full ${
                currentNPC === 'dm' ? 'bg-purple-400' :
                currentNPC === 'elara' ? 'bg-amber-400' :
                currentNPC === 'thorek' ? 'bg-orange-400' :
                currentNPC === 'grimjaw' ? 'bg-green-400' :
                currentNPC === 'valdris' ? 'bg-emerald-400' :
                currentNPC === 'malachar' ? 'bg-red-400' : 'bg-gray-400'
              }`} />
              <span className="text-slate-300 text-sm">
                {currentNPC === 'dm' ? 'Dungeon Master' :
                 currentNPC === 'elara' ? 'Elara the Merchant' :
                 currentNPC === 'thorek' ? 'Thorek the Blacksmith' :
                 currentNPC === 'grimjaw' ? 'Grimjaw the Goblin' :
                 currentNPC === 'valdris' ? 'Valdris the Guardian' :
                 currentNPC === 'malachar' ? 'Malachar the Wraith' : 'Unknown'}
              </span>
            </div>
            
            <div className="text-center">
              <div className="text-lg font-bold text-white">
                {formatTime(remainingTime)}
              </div>
              <div className="text-xs text-slate-400">Time Left</div>
            </div>
            <button
              onClick={() => setShowSettings(true)}
              className="p-2 text-slate-400 hover:text-white transition-colors"
            >
              <Settings className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col max-w-4xl mx-auto p-4 min-h-0">
        {/* Messages */}
        <div className="flex-1 bg-slate-800/50 backdrop-blur-sm rounded-xl border border-slate-700/50 mb-6 flex flex-col min-h-0">
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {messages.map((message, index) => (
              <div
                key={index}
                className={`flex gap-3 ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                {message.type === 'dm' && (
                  <div className="w-8 h-8 bg-gradient-to-br from-amber-500 to-amber-600 rounded-full flex items-center justify-center flex-shrink-0">
                    <Crown className="w-4 h-4 text-white" />
                  </div>
                )}
                
                {message.type === 'elara' && (
                  <div className="w-8 h-8 bg-gradient-to-br from-amber-500 to-amber-600 rounded-full flex items-center justify-center flex-shrink-0">
                    <User className="w-4 h-4 text-white" />
                  </div>
                )}
                
                {message.type === 'thorek' && (
                  <div className="w-8 h-8 bg-gradient-to-br from-orange-500 to-orange-600 rounded-full flex items-center justify-center flex-shrink-0">
                    <User className="w-4 h-4 text-white" />
                  </div>
                )}
                
                {message.type === 'grimjaw' && (
                  <div className="w-8 h-8 bg-gradient-to-br from-green-500 to-green-600 rounded-full flex items-center justify-center flex-shrink-0">
                    <User className="w-4 h-4 text-white" />
                  </div>
                )}
                
                {message.type === 'valdris' && (
                  <div className="w-8 h-8 bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-full flex items-center justify-center flex-shrink-0">
                    <User className="w-4 h-4 text-white" />
                  </div>
                )}
                
                {message.type === 'malachar' && (
                  <div className="w-8 h-8 bg-gradient-to-br from-red-500 to-red-600 rounded-full flex items-center justify-center flex-shrink-0">
                    <User className="w-4 h-4 text-white" />
                  </div>
                )}
                
                <div className={`max-w-[80%] ${message.type === 'user' ? 'order-2' : ''}`}>
                  <div
                    className={`p-4 rounded-xl ${
                      message.type === 'user'
                        ? 'bg-purple-600 text-white'
                        : 'bg-slate-700 text-slate-100'
                    }`}
                  >
                    <p className="whitespace-pre-wrap">{message.text}</p>
                  </div>
                  
                  <div className={`flex items-center gap-2 mt-2 ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <button
                      onClick={() => playMessageAudio(message.text, index)}
                      className="text-slate-400 hover:text-white transition-colors p-1"
                      title="Play audio"
                    >
                      <Volume2 className="w-4 h-4" />
                    </button>
                    {currentlyPlaying === index && (
                      <span className="text-xs text-slate-400">Playing...</span>
                    )}
                    <span className="text-xs text-slate-500">
                      {message.timestamp.toLocaleTimeString([], { 
                        hour: '2-digit', 
                        minute: '2-digit' 
                      })}
                    </span>
                  </div>
                </div>
                
                {message.type === 'user' && (
                  <div className="w-8 h-8 bg-gradient-to-br from-purple-500 to-purple-600 rounded-full flex items-center justify-center flex-shrink-0 order-3">
                    <User className="w-4 h-4 text-white" />
                  </div>
                )}
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>
        </div>

        {/* Voice Controls */}
        <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl border border-slate-700/50 p-6">
          {/* Connection Status */}
          {isConnecting && (
            <div className="text-center mb-4">
              <div className="text-amber-400 mb-2">Connecting to voice system...</div>
              <div className="w-full bg-slate-700 rounded-full h-2">
                <div className="bg-amber-400 h-2 rounded-full animate-pulse w-3/4"></div>
              </div>
            </div>
          )}
          
          {connectionError && (
            <div className="text-center mb-4 p-4 bg-red-900/20 border border-red-500/50 rounded-lg">
              <div className="text-red-400 font-medium mb-2">Connection Error</div>
              <div className="text-red-300 text-sm">{connectionError}</div>
              <button
                onClick={initializeRealtimeClient}
                className="mt-2 px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded-lg text-sm transition-colors"
              >
                Retry Connection
              </button>
            </div>
          )}

          {!hasValidApiKey() && (
            <div className="text-center mb-4 p-4 bg-amber-900/20 border border-amber-500/50 rounded-lg">
              <div className="text-amber-400 font-medium mb-2">API Key Required</div>
              <div className="text-amber-300 text-sm mb-2">Enter your OpenAI API key to enable voice interaction</div>
              <button
                onClick={() => setShowSettings(true)}
                className="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-lg text-sm transition-colors"
              >
                Open Settings
              </button>
            </div>
          )}

          {/* Audio Level Indicator */}
          {(isListening || isAISpeaking) && (
            <div className="mb-4">
              <svg
                width="100%"
                height="60"
                viewBox="0 0 400 60"
                className="overflow-visible"
              >
                {/* Heartbeat line */}
                <path
                  d={`M 0 30 L 50 30 L 60 ${30 - audioLevel * 20} L 70 ${30 + audioLevel * 15} L 80 30 L 120 30 L 130 ${30 - audioLevel * 25} L 140 ${30 + audioLevel * 20} L 150 30 L 190 30 L 200 ${30 - audioLevel * 18} L 210 ${30 + audioLevel * 12} L 220 30 L 260 30 L 270 ${30 - audioLevel * 22} L 280 ${30 + audioLevel * 18} L 290 30 L 330 30 L 340 ${30 - audioLevel * 16} L 350 ${30 + audioLevel * 14} L 360 30 L 400 30`}
                  stroke={isListening ? "url(#userGradient)" : "url(#aiGradient)"}
                  strokeWidth="3"
                  fill="none"
                  className="animate-pulse"
                />
                
                {/* Gradient definitions */}
                <defs>
                  <linearGradient id="userGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#8b5cf6" />
                    <stop offset="100%" stopColor="#6366f1" />
                  </linearGradient>
                  <linearGradient id="aiGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#10b981" />
                    <stop offset="100%" stopColor="#f59e0b" />
                  </linearGradient>
                </defs>
                
                {/* Pulse dots at peaks during active audio */}
                {audioLevel > 0.3 && (
                  <>
                    <circle
                      cx="130"
                      cy={30 - audioLevel * 25}
                      r="3"
                      fill={isListening ? "#8b5cf6" : "#10b981"}
                      className="animate-ping"
                    />
                    <circle
                      cx="270"
                      cy={30 - audioLevel * 22}
                      r="3"
                      fill={isListening ? "#8b5cf6" : "#10b981"}
                      className="animate-ping"
                    />
                  </>
                )}
              </svg>
              
              <div className="text-center text-sm text-slate-400 mt-2">
                {isListening ? "🎤 Listening..." : isAISpeaking ? "🤖 AI Speaking..." : ""}
              </div>
            </div>
          )}

          {/* Microphone Controls */}
          <div className="flex items-center justify-center gap-4">
            <button
              onClick={isListening ? handleStopListening : handleStartListening}
              disabled={!hasValidApiKey() || isConnecting}
              className={`w-16 h-16 rounded-full transition-all duration-300 transform hover:scale-105 shadow-2xl ${
                isListening
                  ? 'bg-red-500 hover:bg-red-600 shadow-red-500/25'
                  : 'bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 shadow-purple-500/25'
              } ${
                !hasValidApiKey() || isConnecting
                  ? 'opacity-50 cursor-not-allowed'
                  : 'hover:shadow-2xl'
              }`}
            >
              {isListening ? (
                <MicOff className="w-8 h-8 text-white mx-auto" />
              ) : (
                <Mic className="w-8 h-8 text-white mx-auto" />
              )}
            </button>
            
          </div>
          
          <div className="text-center text-sm text-slate-400 mt-4">
            {hasValidApiKey() ? (
              <>Click the microphone or hold <kbd className="px-2 py-1 bg-slate-700 rounded text-xs">Spacebar</kbd> to speak</>
            ) : (
              'Configure your API key in settings to enable voice chat'
            )}
          </div>
        </div>
      </div>
      
      {/* Settings Modal */}
      {showSettings && (
        <SettingsModal
          isOpen={showSettings}
          onClose={() => setShowSettings(false)}
          settings={settings}
          onSettingsChange={updateSettings}
        />
      )}
    </div>
  );
};

export default Voice;