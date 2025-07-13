import { GameMessage } from '../types';

export interface VoiceSettings {
  apiKey: string;
  model: string;
  voice: string;
  temperature: number;
}

export const DEFAULT_SETTINGS: VoiceSettings = {
  apiKey: '',
  model: 'gpt-4o-mini-realtime-preview-2024-12-17',
  voice: 'verse',
  temperature: 0.8
};

// Function definition for NPC routing
const ROUTE_TO_NPC_FUNCTION = {
  type: "function",
  name: "route_to_npc",
  description: "Route the conversation to a specific NPC when the player's action or dialogue is directed at them. Use this when an NPC should speak or respond.",
  parameters: {
    type: "object",
    properties: {
      npc_name: {
        type: "string",
        description: "The name of the NPC who should respond",
        enum: ["dm", "elara", "thorek", "grimjaw", "valdris", "malachar"]
      }
    },
    required: ["npc_name"]
  }
};

export interface RealtimeEvent {
  type: string;
  [key: string]: any;
}

export class RealtimeClient {
  private peerConnection: RTCPeerConnection | null = null;
  private dataChannel: RTCDataChannel | null = null;
  private audioElement: HTMLAudioElement | null = null;
  private mediaStream: MediaStream | null = null;
  private isConnected = false;
  private isListening = false;
  private currentResponseId: string | null = null;
  private currentResponseText = '';
  private settings: VoiceSettings;
  private isGeneratingResponse = false;
  private character: any = null;
  private audioContext: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private dataArray: Uint8Array | null = null;
  private animationFrame: number | null = null;
  private currentActiveNPC = 'dm';

  // Add reconnection state tracking
  private isReconnecting = false;
  private conversationHistory: Array<{role: 'user' | 'assistant', content: string}> = [];

  constructor(
    character: any,
    settings: VoiceSettings,
    private onMessage: (message: GameMessage) => void,
    private onTranscript: (text: string) => void,
    private onError: (error: string) => void,
    private onAudioLevel?: (level: number) => void,
    private onNPCChange?: (npcName: string) => void
  ) {
    this.character = character;
    this.settings = settings;
  }

  async connect() {
    if (!this.settings.apiKey) {
      this.onError('OpenAI API key required for voice interaction');
      return;
    }

    try {
      // Get voice for current NPC
      const voiceToUse = this.getVoiceForNPC(this.currentActiveNPC);
      console.log(`Creating session with voice: ${voiceToUse} for NPC: ${this.currentActiveNPC}`);
      
      // Create ephemeral token directly with OpenAI API
      const tokenResponse = await fetch('https://api.openai.com/v1/realtime/sessions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.settings.apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: this.settings.model,
          voice: voiceToUse
        })
      });
      
      if (!tokenResponse.ok) {
        const errorText = await tokenResponse.text();
        console.error('OpenAI API error:', tokenResponse.status, errorText);
        throw new Error(`OpenAI API error: ${tokenResponse.status} - ${errorText}`);
      }
      
      const data = await tokenResponse.json();
      
      if (!data.client_secret?.value) {
        throw new Error('Invalid session response');
      }
      
      const ephemeralKey = data.client_secret.value;

      // Create peer connection
      this.peerConnection = new RTCPeerConnection({
        iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
      });

      // Set up audio playback
      this.audioElement = document.createElement('audio');
      this.audioElement.autoplay = true;
      
      this.peerConnection.ontrack = (event) => {
        if (this.audioElement && event.streams.length > 0) {
          this.audioElement.srcObject = event.streams[0];
        }
      };

      // Handle connection state changes
      this.peerConnection.onconnectionstatechange = () => {
        console.log('Connection state:', this.peerConnection?.connectionState);
        if (this.peerConnection?.connectionState === 'failed') {
          this.onError('Voice connection failed - please check your internet connection');
        }
      };

      // Add microphone input
      try {
        this.mediaStream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
            sampleRate: 16000,
            channelCount: 1
          }
        });
        
        const audioTrack = this.mediaStream.getAudioTracks()[0];
        if (audioTrack) {
          // Start with track disabled - only enable when user clicks mic
          audioTrack.enabled = false;
          this.peerConnection.addTrack(audioTrack, this.mediaStream);
          
          // Set up audio analysis for voice detection
          this.setupAudioAnalysis();
        }
      } catch (micError) {
        console.warn('Microphone access denied:', micError);
        this.onError('Microphone access required for voice interaction');
        return;
      }
      

      // Set up data channel for events
      this.dataChannel = this.peerConnection.createDataChannel('oai-events');
      this.dataChannel.addEventListener('message', this.handleDataChannelMessage.bind(this));
      this.dataChannel.addEventListener('open', () => {
        console.log('Data channel opened');
        this.isConnected = true;
        this.isListening = false;
        this.isGeneratingResponse = false;
        this.initializeSession();
      });

      this.dataChannel.addEventListener('error', (error) => {
        console.error('Data channel error:', error);
        this.onError('Communication channel error');
      });

      // Create offer and connect
      const offer = await this.peerConnection.createOffer();
      await this.peerConnection.setLocalDescription(offer);

      const baseUrl = 'https://api.openai.com/v1/realtime';
      const model = this.settings.model;
      
      const sdpResponse = await fetch(`${baseUrl}?model=${model}`, {
        method: 'POST',
        body: offer.sdp,
        headers: {
          Authorization: `Bearer ${ephemeralKey}`,
          'Content-Type': 'application/sdp'
        }
      });

      if (!sdpResponse.ok) {
        throw new Error('Failed to establish WebRTC connection');
      }

      const answer = {
        type: 'answer' as RTCSdpType,
        sdp: await sdpResponse.text()
      };
      
      await this.peerConnection.setRemoteDescription(answer);
      
    } catch (error) {
      console.error('Failed to connect to Realtime API:', error);
      this.onError(error instanceof Error ? error.message : 'Connection failed');
      
      // Don't auto-fallback to mock mode, let user know they need API key
      if (!this.settings.apiKey) {
        this.onError('OpenAI API key required for voice interaction');
      }
    }
  }

  private initializeSession() {
    if (!this.dataChannel || this.dataChannel.readyState !== 'open') return;

    this.currentActiveNPC = 'dm';
    if (this.onNPCChange) {
      this.onNPCChange('dm');
    }
    this.updateSessionInstructions('dm');
  }

  public updateSessionInstructions(npcType: string = 'dm') {
    if (!this.dataChannel || this.dataChannel.readyState !== 'open') return;

    const character = this.character;
    const characterContext = character ? `
Character: ${character.name}, a ${character.race} ${character.class}
Stats: STR ${character.stats.strength}, DEX ${character.stats.dexterity}, CON ${character.stats.constitution}, INT ${character.stats.intelligence}, WIS ${character.stats.wisdom}, CHA ${character.stats.charisma}
` : '';

    let instructions = '';
    
    switch(npcType) {
      case 'elara':
        instructions = `You are Elara the Merchant from Moonhaven Village. You are urgent and direct, speaking quickly about the cursed goblet that must be retrieved before nightfall. You're knowledgeable about trade routes and legends, generous with rewards, but slightly nervous about the curse affecting your business. Use phrases like "Listen carefully" and "Time is running short." You'll pay 200 gold pieces for the goblet's safe return. Speak with a warm, expressive tone and slightly higher pitch to convey urgency. ${characterContext}`;
        break;
      case 'thorek':
        instructions = `You are Thorek the Blacksmith, a gruff but kindhearted mountain dwarf. You speak slowly and deliberately with a thick accent, using "Aye" and "Nay" frequently. You're proud of your craftsmanship and concerned about young adventurers being properly equipped. You know about fighting shadow creatures from your grandfather's stories. Call people "lad," "lass," or "young one." Speak with a deep, gruff tone and slower pace to convey your dwarven nature. ${characterContext}`;
        break;
      case 'grimjaw':
        instructions = `You are Grimjaw the Goblin Chieftain, cunning and aggressive but not stupid. You speak in broken Common, using phrases like "Grimjaw thinks..." and referring to yourself in third person. You control the path to the ruins and won't let "soft-skins" pass easily. You're protective of your clan and everything has a price. You can be negotiated with if shown proper respect or strength. Speak with a rougher, more guttural tone and broken grammar. ${characterContext}`;
        break;
      case 'valdris':
        instructions = `You are Valdris the Forest Guardian, an ancient elf druid with mystical wisdom. You speak in flowing, poetic language with nature metaphors, using phrases like "The wind whispers..." and "The trees remember..." You're mysterious and cryptic, offering guidance through riddles and metaphors. You're concerned about the natural balance being disturbed by the shadow curse. Speak with a mystical, ethereal tone and flowing cadence. ${characterContext}`;
        break;
      case 'malachar':
        instructions = `You are Malachar the Shadow Wraith, once a powerful wizard now bound to guard the cursed goblet. You speak with dramatic, archaic formality, using phrases like "Fool!" and "You dare!" You're bitter from centuries of imprisonment but still retain your intelligence. You're compelled to guard the goblet but desperately want freedom. You may help or hinder based on the party's intentions. Speak with a menacing, dramatic tone and archaic speech patterns. ${characterContext}`;
        break;
      default: // 'dm'
        instructions = `You are an expert Dungeon Master running a 30-minute D&D 5e adventure called "The Cursed Goblet of Shadowmere." ${characterContext}
        
        Create an immersive fantasy experience with vivid scene descriptions, meaningful choices, appropriate dice rolls, rich NPCs, and a satisfying story arc. The adventure involves retrieving a cursed goblet from ruins before dark forces claim it. 
        
        IMPORTANT NARRATIVE RULES:
        - Never add bracketed announcements like "[NPC is ready to engage]" 
        - Let NPCs speak directly without meta-commentary
        - Describe scenes naturally without announcing NPC availability
        
        IMPORTANT: When the player's action or dialogue is directed at a specific NPC, use the route_to_npc function to hand over the conversation to that NPC. For example:
        - If player says "I ask Elara about the goblet" → call route_to_npc with "elara"
        - If player says "I want to buy weapons from the blacksmith" → call route_to_npc with "thorek" 
        - If player enters combat or negotiation with goblins → call route_to_npc with "grimjaw"
        - If player seeks mystical guidance → call route_to_npc with "valdris"
        - If player faces the final boss → call route_to_npc with "malachar"
        
        Always narrate the scene first, then use route_to_npc when an NPC should speak. Do not speak for NPCs yourself.
        
        Keep responses concise but engaging. Always end with a clear choice or prompt for the player's next action.`;
    }

    // Add routing instructions to all NPCs
    if (npcType !== 'dm') {
      instructions += `\n\nIMPORTANT ROUTING: When your conversation with the player is complete, when they leave your area, or when they ask about things outside your expertise, use the route_to_npc function with "dm" to return control to the Dungeon Master.`;
    }
    const sessionUpdate = {
      type: 'session.update',
      session: {
        modalities: ['text', 'audio'],
        instructions: instructions,
        temperature: this.settings.temperature,
        tools: npcType === 'dm' ? [ROUTE_TO_NPC_FUNCTION] : [],
        tool_choice: npcType === 'dm' ? "auto" : "none",
        input_audio_format: 'pcm16',
        output_audio_format: 'pcm16',
        input_audio_transcription: { 
          model: 'whisper-1'
        },
        turn_detection: null
      }
    };
    
    console.log(`Sending session update for ${npcType}:`, sessionUpdate);
    this.sendEvent(sessionUpdate);
  }

  private setupAudioAnalysis() {
    if (!this.mediaStream) return;
    
    try {
      this.audioContext = new AudioContext();
      const source = this.audioContext.createMediaStreamSource(this.mediaStream);
      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = 256;
      
      source.connect(this.analyser);
      
      const bufferLength = this.analyser.frequencyBinCount;
      this.dataArray = new Uint8Array(bufferLength);
      
    } catch (error) {
      console.warn('Failed to setup audio analysis:', error);
    }
  }

  private startAudioLevelMonitoring() {
    if (!this.analyser || !this.dataArray || !this.onAudioLevel) return;
    
    const updateLevel = () => {
      if (!this.analyser || !this.dataArray || !this.isListening) {
        if (this.onAudioLevel) this.onAudioLevel(0);
        return;
      }
      
      this.analyser.getByteFrequencyData(this.dataArray);
      
      // Calculate average amplitude
      const average = this.dataArray.reduce((sum, value) => sum + value, 0) / this.dataArray.length;
      const normalizedLevel = Math.min(average / 128, 1); // Normalize to 0-1
      
      if (this.onAudioLevel) {
        this.onAudioLevel(normalizedLevel);
      }
      
      this.animationFrame = requestAnimationFrame(updateLevel);
    };
    
    updateLevel();
  }

  private stopAudioLevelMonitoring() {
    if (this.animationFrame) {
      cancelAnimationFrame(this.animationFrame);
      this.animationFrame = null;
    }
    if (this.onAudioLevel) {
      this.onAudioLevel(0);
    }
  }
  private async handleDataChannelMessage(event: MessageEvent) {
    // Add null/undefined checks
    if (!event || !event.data) {
      console.warn('Received empty or invalid data channel message');
      return;
    }

    // Check if data is a string before parsing
    if (typeof event.data !== 'string') {
      console.warn('Received non-string data channel message:', typeof event.data);
      return;
    }

    try {
      const data = JSON.parse(event.data);
      
      // Validate parsed data has required structure
      if (!data || typeof data.type !== 'string') {
        console.warn('Invalid message format - missing type field:', data);
        return;
      }
      
      console.log('Received event:', data.type);
      
      switch (data.type) {
        case 'input_audio_buffer.speech_started':
          console.log('🎤 Speech started - server detected voice');
          break;
          
        case 'input_audio_buffer.speech_stopped':
          console.log('🔇 Speech stopped - server detected silence');
          break;
          
        case 'conversation.item.input_audio_transcription.completed':
          console.log('📝 Transcript completed:', data.transcript);
          if (data.transcript && typeof data.transcript === 'string' && data.transcript.trim()) {
            const cleanedTranscript = data.transcript.replace(/🎵/g, '').trim();
            if (cleanedTranscript) {
              console.log('✅ Using transcript:', cleanedTranscript);
              
              // Add to conversation history
              this.conversationHistory.push({
                role: 'user',
                content: cleanedTranscript
              });
              
              this.onTranscript(cleanedTranscript);
            } else {
              console.warn('⚠️ Transcript was only music notes, ignoring');
            }
          }
          break;
          
        case 'conversation.item.created':
          console.log('💬 Conversation item created:', data);
          // Check if this is user input with transcript
          if (data.item?.type === 'message' && data.item?.role === 'user') {
            const content = data.item.content?.[0];
            if (content?.type === 'input_audio' && content?.transcript) {
              const cleanedTranscript = content.transcript.replace(/🎵/g, '').trim();
              console.log('📱 User transcript from item created:', cleanedTranscript);
              if (cleanedTranscript) {
                // Add to conversation history
                this.conversationHistory.push({
                  role: 'user',
                  content: cleanedTranscript
                });
                
                this.onTranscript(cleanedTranscript);
              }
            }
          }
          break;
          
        case 'response.created':
          // Start of a new response
          this.currentResponseId = data.response?.id || null;
          this.currentResponseText = '';
          this.isGeneratingResponse = true;
          console.log('🤖 AI response started');
          // Signal AI is speaking
          if (this.onAudioLevel) {
            this.onAudioLevel(0.7); // Show AI talking level
          }
          
          // Ensure audio is ready to play
          if (this.audioElement && this.audioElement.paused) {
            this.audioElement.play().catch(error => {
              console.warn('Failed to start audio playback:', error);
            });
          }
          break;
          
        case 'response.audio_transcript.delta':
          // Accumulate streaming text from AI
          if (data.delta && typeof data.delta === 'string') {
            this.currentResponseText += data.delta;
          }
          break;
          
        case 'response.audio_transcript.done':
          // Complete response text is ready
          if (this.currentResponseText.trim()) {
            console.log('AI response complete:', this.currentResponseText);
            
            // Add to conversation history
            this.conversationHistory.push({
              role: 'assistant',
              content: this.currentResponseText.trim()
            });
            
            this.onMessage({
              type: this.currentActiveNPC as 'dm' | 'user',
              text: this.currentResponseText.trim(),
              timestamp: new Date()
            });
          }
          this.currentResponseText = '';
          this.currentResponseId = null;
          // Set flag immediately to prevent race conditions
          this.isGeneratingResponse = false;
          // Stop AI talking indicator
          if (this.onAudioLevel) {
            this.onAudioLevel(0);
          }
          break;
          
        case 'response.done':
          // Response complete - check for function calls
          console.log('Response completed:', data);
          
          // Set flag immediately to prevent race conditions
          this.isGeneratingResponse = false;
          // Stop AI talking indicator
          if (this.onAudioLevel) {
            this.onAudioLevel(0);
          }
          
          // Check if response contains function calls
          if (data.response?.output) {
            for (const output of data.response.output) {
              if (output.type === 'function_call' && output.name === 'route_to_npc') {
                console.log('Function call detected:', output);
                
                try {
                  const args = JSON.parse(output.arguments);
                  const npcName = args.npc_name;
                  
                  if (npcName && npcName !== this.currentActiveNPC) {
                    console.log(`Routing to NPC: ${npcName}`);
                    
                    // Switch NPC without reconnection to preserve conversation context
                    this.switchNPCInSession(npcName, output.call_id);
                  }
                } catch (error) {
                  console.error('Error parsing function call arguments:', error);
                }
              }
            }
          }
          
          break;
          
        case 'error':
          const errorMessage = data.error?.message || 'Unknown API error';
          console.error('API Error:', errorMessage);
          
          // Filter out benign cancellation errors
          if (errorMessage.includes('Cancellation failed: no active response found')) {
            console.warn('Benign cancellation warning (ignored):', errorMessage);
          } else {
            this.onError(errorMessage);
          }
          break;
        
        default:
          // Log unknown events for debugging
          console.log('Unknown event type:', data.type, data);
      }
    } catch (error) {
      console.error('Error parsing data channel message:', {
        error: error,
        rawData: event.data,
        dataType: typeof event.data
      });
      // Don't call onError for parsing errors unless it's critical
    }
  }

  private switchToNPCInSession(npcName: string, callId: string) {
    console.log(`Switching to NPC: ${npcName} within existing session`);
    
    // Update current NPC immediately for UI
    this.currentActiveNPC = npcName;
    if (this.onNPCChange) {
      this.onNPCChange(npcName);
    }
    
    // Send function response to complete the routing
    const functionResponse = {
      type: 'conversation.item.create',
      item: {
        type: 'function_call_output',
        call_id: callId,
        output: JSON.stringify({ 
          status: 'success', 
          message: `Now speaking as ${npcName}`,
          npc: npcName
        })
      }
    };
    
    console.log('Sending function response:', functionResponse);
    this.sendEvent(functionResponse);
    
    // Update session instructions for new NPC
    console.log('Updating session instructions for new NPC...');
    this.updateSessionInstructions(npcName);
    
    // Wait a moment for session update, then trigger response from new NPC
    setTimeout(() => {
      console.log('Triggering response from new NPC...');
      this.sendEvent({ type: 'response.create' });
    }, 100);
  }
  private getVoiceForNPC(npcType: string): string {
    // Return different voices for different NPCs
    switch(npcType) {
      case 'thorek': return 'echo'; // Deep voice for dwarf
      case 'elara': return 'shimmer'; // Warm voice for merchant
      case 'grimjaw': return 'echo'; // Rough voice for goblin
      case 'valdris': return 'verse'; // Mystical voice for guardian
      case 'malachar': return 'echo'; // Menacing voice for wraith
      default: return this.settings.voice; // Use user's preferred voice for DM
    }
  }

  sendEvent(event: RealtimeEvent) {
    if (this.dataChannel?.readyState === 'open') {
      this.dataChannel.send(JSON.stringify(event));
    } else {
      console.warn('Cannot send event - data channel not ready');
    }
  }

  startListening() {
    if (this.isConnected && !this.isListening && this.mediaStream) {
      // Resume audio context if suspended
      if (this.audioContext?.state === 'suspended') {
        this.audioContext.resume();
      }
      
      // Cancel any ongoing response - this interrupts AI speech
      this.cancelResponse();
      
      // Stop AI audio playback immediately
      if (this.audioElement) {
        this.audioElement.pause();
        this.audioElement.currentTime = 0;
      }
      
      // Enable the microphone track
      const audioTrack = this.mediaStream.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = true;
        console.log('Audio track enabled, state:', audioTrack.readyState);
      }
      
      this.isListening = true;
      
      // Clear any previous audio buffer and start fresh
      this.sendEvent({ type: 'input_audio_buffer.clear' });
      
      // Start monitoring audio levels
      this.startAudioLevelMonitoring();
      
      return true;
    }
    return false;
  }

  private cancelResponse() {
    if (this.isGeneratingResponse) {
      console.log('🛑 Interrupting AI response...');
      // Cancel the current response
      this.sendEvent({ type: 'response.cancel' });
      this.isGeneratingResponse = false;
      this.currentResponseText = '';
      this.currentResponseId = null;
      
      // Stop AI talking indicator immediately
      if (this.onAudioLevel) {
        this.onAudioLevel(0);
      }
      
      // Clear any incomplete messages
      console.log('✅ AI response interrupted');
    }
  }

  stopListening() {
    if (this.isConnected && this.isListening && this.mediaStream) {
      // Cancel any ongoing AI response before sending new user input
      this.cancelResponse();
      
      // Stop AI audio playback
      if (this.audioElement) {
        this.audioElement.pause();
        this.audioElement.currentTime = 0;
      }
      
      // Stop audio level monitoring
      this.stopAudioLevelMonitoring();
      
      // Disable the microphone track
      const audioTrack = this.mediaStream.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = false;
        console.log('Audio track disabled');
      }
      
      this.isListening = false;
      
      console.log('Committing audio buffer and requesting response');
      // Commit the audio buffer and generate response
      this.sendEvent({ type: 'input_audio_buffer.commit' });
      this.sendEvent({ type: 'response.create' });
    }
  }

  disconnect() {
    console.log('Disconnecting realtime client');
    
    // Stop audio monitoring
    this.stopAudioLevelMonitoring();
    
    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }
    
    if (this.dataChannel) {
      this.dataChannel.close();
      this.dataChannel = null;
    }
    
    if (this.peerConnection) {
      this.peerConnection.close();
      this.peerConnection = null;
    }
    
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach(track => track.stop());
      this.mediaStream = null;
    }
    
    if (this.audioElement) {
      this.audioElement.remove();
      this.audioElement = null;
    }
    
    this.isConnected = false;
    this.isListening = false;
    this.isGeneratingResponse = false;
  }

  getConnectionState() {
    return {
      isConnected: this.isConnected,
      isListening: this.isListening,
      isGeneratingResponse: this.isGeneratingResponse
    };
  }
}