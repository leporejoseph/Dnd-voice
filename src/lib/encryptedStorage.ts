// Encrypted local storage utility
interface StorageData {
  characters: any[];
  settings: any;
  currentSession?: any;
}

class EncryptedStorage {
  private key: string;

  constructor() {
    // Generate or retrieve encryption key
    this.key = this.getOrCreateKey();
  }

  private getOrCreateKey(): string {
    let key = localStorage.getItem('voicequest-key');
    if (!key) {
      // Generate a simple key for client-side encryption
      key = btoa(crypto.randomUUID() + Date.now()).slice(0, 32);
      localStorage.setItem('voicequest-key', key);
    }
    return key;
  }

  private encrypt(data: string): string {
    try {
      // Convert Unicode string to UTF-8 byte string for btoa compatibility
      const utf8Data = unescape(encodeURIComponent(data));
      // Simple XOR encryption for client-side storage
      let encrypted = '';
      for (let i = 0; i < utf8Data.length; i++) {
        encrypted += String.fromCharCode(
          utf8Data.charCodeAt(i) ^ this.key.charCodeAt(i % this.key.length)
        );
      }
      return btoa(encrypted);
    } catch (error) {
      console.warn('Encryption failed, storing as plain text:', error);
      return btoa(unescape(encodeURIComponent(data)));
    }
  }

  private decrypt(encryptedData: string): string {
    try {
      const data = atob(encryptedData);
      let decrypted = '';
      for (let i = 0; i < data.length; i++) {
        decrypted += String.fromCharCode(
          data.charCodeAt(i) ^ this.key.charCodeAt(i % this.key.length)
        );
      }
      // Convert UTF-8 byte string back to Unicode string
      return decodeURIComponent(escape(decrypted));
    } catch (error) {
      console.warn('Decryption failed:', error);
      return '';
    }
  }

  save(key: string, data: any): void {
    try {
      const jsonData = JSON.stringify(data);
      const encrypted = this.encrypt(jsonData);
      localStorage.setItem(`voicequest-${key}`, encrypted);
    } catch (error) {
      console.error('Failed to save encrypted data:', error);
    }
  }

  load<T>(key: string, defaultValue: T): T {
    try {
      const encrypted = localStorage.getItem(`voicequest-${key}`);
      if (!encrypted) return defaultValue;
      
      const decrypted = this.decrypt(encrypted);
      if (!decrypted) return defaultValue;
      
      return JSON.parse(decrypted);
    } catch (error) {
      console.error('Failed to load encrypted data:', error);
      return defaultValue;
    }
  }

  remove(key: string): void {
    localStorage.removeItem(`voicequest-${key}`);
  }

  clear(): void {
    const keys = Object.keys(localStorage).filter(key => 
      key.startsWith('voicequest-')
    );
    keys.forEach(key => localStorage.removeItem(key));
  }
}

export const storage = new EncryptedStorage();