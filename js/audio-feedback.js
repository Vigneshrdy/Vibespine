/**
 * Audio Feedback Module
 * Handles all audio notifications and sound effects
 */

class AudioFeedback {
    constructor() {
        this.audioContext = null;
        this.sounds = {};
        this.isEnabled = true;
        this.volume = 0.7;

        this.soundDefinitions = {
            goodPosture: {
                frequency: 440,
                duration: 0.2,
                type: 'sine',
                volume: 0.3
            },
            postureWarning: {
                frequency: 220,
                duration: 0.5,
                type: 'triangle',
                volume: 0.5
            },
            postureAlert: {
                frequency: 165,
                duration: 0.8,
                type: 'sawtooth',
                volume: 0.6
            },
            sessionStart: {
                frequency: 523,
                duration: 0.3,
                type: 'sine',
                volume: 0.4
            },
            sessionEnd: {
                frequency: 392,
                duration: 0.4,
                type: 'sine',
                volume: 0.4
            },
            achievement: {
                frequencies: [523, 659, 784, 1047],
                duration: 0.6,
                type: 'sine',
                volume: 0.5
            },
            stretchReminder: {
                frequency: 349,
                duration: 0.3,
                type: 'triangle',
                volume: 0.4
            }
        };

        this.initializeAudioContext();
        this.loadPreloadedSounds();
    }

    /**
     * Initialize Web Audio API context
     */
    async initializeAudioContext() {
        try {
            // Create AudioContext with proper browser compatibility
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            if (AudioContext) {
                this.audioContext = new AudioContext();

                // Handle autoplay policy - resume context on user interaction
                if (this.audioContext.state === 'suspended') {
                    document.addEventListener('click', () => this.resumeAudioContext(), { once: true });
                    document.addEventListener('keydown', () => this.resumeAudioContext(), { once: true });
                }
            } else {
                console.warn('Web Audio API not supported');
                this.fallbackToHTMLAudio();
            }
        } catch (error) {
            console.error('Error initializing audio context:', error);
            this.fallbackToHTMLAudio();
        }
    }

    /**
     * Resume audio context (required for autoplay policy compliance)
     */
    async resumeAudioContext() {
        if (this.audioContext && this.audioContext.state === 'suspended') {
            try {
                await this.audioContext.resume();
                console.log('Audio context resumed');
            } catch (error) {
                console.error('Error resuming audio context:', error);
            }
        }
    }

    /**
     * Fallback to HTML Audio API if Web Audio API is not available
     */
    fallbackToHTMLAudio() {
        console.log('Using HTML Audio API fallback');
        this.useHTMLAudio = true;
        this.generateHTMLAudioSounds();
    }

    /**
     * Generate HTML audio elements for fallback
     */
    generateHTMLAudioSounds() {
        // Create simple beep sounds using data URLs
        const createBeepDataURL = (frequency, duration) => {
            const sampleRate = 44100;
            const samples = duration * sampleRate;
            const buffer = new ArrayBuffer(44 + samples * 2);
            const view = new DataView(buffer);

            // WAV file header
            const writeString = (offset, string) => {
                for (let i = 0; i < string.length; i++) {
                    view.setUint8(offset + i, string.charCodeAt(i));
                }
            };

            writeString(0, 'RIFF');
            view.setUint32(4, 36 + samples * 2, true);
            writeString(8, 'WAVE');
            writeString(12, 'fmt ');
            view.setUint32(16, 16, true);
            view.setUint16(20, 1, true);
            view.setUint16(22, 1, true);
            view.setUint32(24, sampleRate, true);
            view.setUint32(28, sampleRate * 2, true);
            view.setUint16(32, 2, true);
            view.setUint16(34, 16, true);
            writeString(36, 'data');
            view.setUint32(40, samples * 2, true);

            // Generate sine wave
            for (let i = 0; i < samples; i++) {
                const sample = Math.sin(2 * Math.PI * frequency * i / sampleRate) * 0.3;
                view.setInt16(44 + i * 2, sample * 32767, true);
            }

            return 'data:audio/wav;base64,' + btoa(String.fromCharCode(...new Uint8Array(buffer)));
        };

        // Create audio elements for each sound
        Object.entries(this.soundDefinitions).forEach(([name, config]) => {
            if (config.frequencies) {
                // Handle multi-frequency sounds like achievement
                this.sounds[name] = config.frequencies.map(freq => {
                    const audio = new Audio(createBeepDataURL(freq, config.duration / config.frequencies.length));
                    audio.volume = config.volume * this.volume;
                    return audio;
                });
            } else {
                const audio = new Audio(createBeepDataURL(config.frequency, config.duration));
                audio.volume = config.volume * this.volume;
                this.sounds[name] = audio;
            }
        });
    }

    /**
     * Load preloaded sound files if available
     */
    async loadPreloadedSounds() {
        const soundFiles = {
            goodPosture: '/sounds/good-posture.mp3',
            postureWarning: '/sounds/warning.mp3',
            postureAlert: '/sounds/alert.mp3',
            sessionStart: '/sounds/start.mp3',
            sessionEnd: '/sounds/end.mp3',
            achievement: '/sounds/achievement.mp3',
            stretchReminder: '/sounds/stretch.mp3'
        };

        for (const [soundName, filePath] of Object.entries(soundFiles)) {
            try {
                const audio = new Audio();
                audio.preload = 'auto';
                audio.volume = this.soundDefinitions[soundName].volume * this.volume;

                await new Promise((resolve, reject) => {
                    audio.addEventListener('canplaythrough', resolve);
                    audio.addEventListener('error', reject);
                    audio.src = filePath;
                });

                this.sounds[soundName] = audio;
            } catch (error) {
                // Fallback to generated sounds if files don't exist
                console.log(`Sound file ${filePath} not found, using generated sound`);
            }
        }
    }

    /**
     * Generate sound using Web Audio API
     */
    generateSound(config) {
        if (!this.audioContext || !this.isEnabled) return;

        try {
            if (config.frequencies) {
                // Multi-frequency sound (like achievement)
                this.playMultiFrequencySound(config);
            } else {
                // Single frequency sound
                this.playSingleFrequencySound(config);
            }
        } catch (error) {
            console.error('Error generating sound:', error);
        }
    }

    /**
     * Play single frequency sound
     */
    playSingleFrequencySound(config) {
        const oscillator = this.audioContext.createOscillator();
        const gainNode = this.audioContext.createGain();

        oscillator.connect(gainNode);
        gainNode.connect(this.audioContext.destination);

        oscillator.type = config.type || 'sine';
        oscillator.frequency.setValueAtTime(config.frequency, this.audioContext.currentTime);

        // Apply volume envelope
        const now = this.audioContext.currentTime;
        const volume = (config.volume || 0.5) * this.volume;

        gainNode.gain.setValueAtTime(0, now);
        gainNode.gain.linearRampToValueAtTime(volume, now + 0.01);
        gainNode.gain.exponentialRampToValueAtTime(0.001, now + config.duration);

        oscillator.start(now);
        oscillator.stop(now + config.duration);
    }

    /**
     * Play multi-frequency sound (for achievements)
     */
    playMultiFrequencySound(config) {
        const { frequencies, duration, type, volume } = config;
        const noteDuration = duration / frequencies.length;

        frequencies.forEach((frequency, index) => {
            setTimeout(() => {
                this.playSingleFrequencySound({
                    frequency,
                    duration: noteDuration,
                    type,
                    volume
                });
            }, index * noteDuration * 1000);
        });
    }

    /**
     * Play sound by name
     */
    playSound(soundName) {
        if (!this.isEnabled) return;

        // Resume audio context if needed
        this.resumeAudioContext();

        if (this.sounds[soundName]) {
            // Use preloaded or generated HTML audio
            if (Array.isArray(this.sounds[soundName])) {
                // Multi-part sound
                this.sounds[soundName].forEach((audio, index) => {
                    setTimeout(() => {
                        audio.currentTime = 0;
                        audio.play().catch(e => console.warn('Audio play failed:', e));
                    }, index * 200);
                });
            } else {
                this.sounds[soundName].currentTime = 0;
                this.sounds[soundName].play().catch(e => console.warn('Audio play failed:', e));
            }
        } else if (this.soundDefinitions[soundName] && !this.useHTMLAudio) {
            // Generate sound using Web Audio API
            this.generateSound(this.soundDefinitions[soundName]);
        }
    }

    /**
     * Posture-specific audio feedback methods
     */
    playGoodPosture() {
        this.playSound('goodPosture');
    }

    playPostureWarning() {
        this.playSound('postureWarning');
    }

    playPostureAlert() {
        this.playSound('postureAlert');
    }

    playSessionStart() {
        this.playSound('sessionStart');
    }

    playSessionEnd() {
        this.playSound('sessionEnd');
    }

    playAchievement() {
        this.playSound('achievement');
    }

    playStretchReminder() {
        this.playSound('stretchReminder');
    }

    /**
     * Configuration methods
     */
    setEnabled(enabled) {
        this.isEnabled = enabled;
    }

    setVolume(volume) {
        this.volume = Math.max(0, Math.min(1, volume));

        // Update volume for HTML audio elements
        Object.values(this.sounds).forEach(sound => {
            if (sound instanceof HTMLAudioElement) {
                sound.volume = this.volume;
            } else if (Array.isArray(sound)) {
                sound.forEach(audio => {
                    if (audio instanceof HTMLAudioElement) {
                        audio.volume = this.volume;
                    }
                });
            }
        });
    }

    getVolume() {
        return this.volume;
    }

    isAudioEnabled() {
        return this.isEnabled;
    }

    /**
     * Cleanup and resource management
     */
    destroy() {
        if (this.audioContext && this.audioContext.state !== 'closed') {
            this.audioContext.close();
        }

        Object.values(this.sounds).forEach(sound => {
            if (sound instanceof HTMLAudioElement) {
                sound.pause();
                sound.src = '';
            } else if (Array.isArray(sound)) {
                sound.forEach(audio => {
                    if (audio instanceof HTMLAudioElement) {
                        audio.pause();
                        audio.src = '';
                    }
                });
            }
        });

        this.sounds = {};
    }
}

// Export for use in other modules
window.AudioFeedback = AudioFeedback;
