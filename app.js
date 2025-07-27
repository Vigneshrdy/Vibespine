/**
 * Posture Guardian - Main Application
 * Optimized for real-time posture detection and analysis
 */

class PostureGuardian {
    constructor() {
        this.isRunning = false;
        this.poseDetection = null;
        this.postureAnalysis = null;
        this.audioFeedback = null;
        this.dataStorage = null;

        // DOM elements
        this.elements = {};

        // Session tracking
        this.sessionStartTime = null;
        this.sessionData = {};

        // Settings
        this.settings = {};

        // Timers
        this.sessionTimer = null;

        // State
        this.isCalibrating = false;
    }

    /**
     * Main initialization method, called after DOM is loaded.
     */
    initialize() {
        console.log('🚀 Initializing Posture Guardian...');

        this.initializeDOM();
        this.initializeComponents();
        this.loadData();
        this.setupEventListeners();
        this.updateUI();

        console.log('✅ Posture Guardian initialized successfully!');
        this.updateStatusDisplay('Ready to start monitoring.');
    }

    /**
     * Get all necessary DOM elements.
     */
    initializeDOM() {
        this.elements = {
            // Video
            video: document.getElementById('inputVideo'),
            canvas: document.getElementById('outputCanvas'),

            // Buttons
            startBtn: document.getElementById('startBtn'),
            stopBtn: document.getElementById('stopBtn'),
            calibrateBtn: document.getElementById('calibrateBtn'),
            
            // Status
            statusText: document.getElementById('statusText'),
            neckAngle: document.getElementById('neckAngle'),
            torsoAngle: document.getElementById('torsoAngle'),
            
            // Session
            sessionTime: document.getElementById('sessionTime'),
            postureScore: document.getElementById('postureScore'),
            streakCount: document.getElementById('streakCount'),
        };
        console.log('DOM elements initialized', this.elements);
    }

    /**
     * Initialize JS components/modules.
     */
    initializeComponents() {
        this.poseDetection = new PoseDetection();
        this.postureAnalysis = new PostureAnalysis();
        this.audioFeedback = new AudioFeedback();
        this.dataStorage = new DataStorage();
        console.log('Components initialized');
    }

    /**
     * Load settings and data from storage.
     */
    loadData() {
        this.settings = this.dataStorage.getSettings();
        this.sessionData = this.dataStorage.getSessionData();
        console.log('Data loaded');
    }

    /**
     * Setup all event listeners.
     */
    setupEventListeners() {
        this.elements.startBtn.addEventListener('click', () => this.startMonitoring());
        this.elements.stopBtn.addEventListener('click', () => this.stopMonitoring());
        this.elements.calibrateBtn.addEventListener('click', () => this.calibratePosture());

        window.addEventListener('resize', () => this.adjustCanvasSize());
        document.addEventListener('visibilitychange', () => this.handleVisibilityChange());
        console.log('Event listeners set up');
    }

    /**
     * Update UI with initial data.
     */
    updateUI() {
        this.adjustCanvasSize();
        this.updateHeaderStats();
        console.log('UI updated');
    }

    /**
     * Start the posture monitoring session.
     */
    async startMonitoring() {
        if (this.isRunning) return;
        
        this.updateStatusDisplay('Initializing camera...');
        
        try {
            await this.poseDetection.initialize(
                this.elements.video,
                this.elements.canvas,
                (results) => this.onPoseResults(results),
                (error) => this.onPoseError(error)
            );
            
            this.poseDetection.updateConfiguration(this.settings);
            await this.poseDetection.startDetection();

            this.isRunning = true;
            this.sessionStartTime = Date.now();
            this.startSessionTimer();
            
            this.audioFeedback.playSessionStart();
            this.updateStatusDisplay('Monitoring...');
            
            this.elements.startBtn.style.display = 'none';
            this.elements.stopBtn.style.display = 'inline-flex';
            this.elements.calibrateBtn.style.display = 'inline-flex';

        } catch (error) {
            this.onPoseError(error);
        }
    }

    /**
     * Stop the posture monitoring session.
     */
    stopMonitoring() {
        if (!this.isRunning) return;
        this.isRunning = false;

        this.poseDetection.stopDetection();
        this.stopSessionTimer();
        this.dataStorage.saveSessionData(this.sessionData);
        this.audioFeedback.playSessionEnd();

        this.updateStatusDisplay('Session stopped.');
        this.elements.startBtn.style.display = 'inline-flex';
        this.elements.stopBtn.style.display = 'none';
        this.elements.calibrateBtn.style.display = 'none';
    }

    /**
     * Calibrate posture based on current position.
     */
    calibratePosture() {
        this.isCalibrating = true;
        this.updateStatusDisplay('Hold a good posture for calibration...');
        // The next pose result will be used for calibration
    }

    /**
     * Handle new pose results from the detection module.
     */
    onPoseResults(results) {
        if (!results.poseLandmarks) return;

        if (this.isCalibrating) {
            const calibrationData = this.postureAnalysis.getCalibrationData(results.poseLandmarks);
            this.settings = { ...this.settings, ...calibrationData };
            this.dataStorage.saveSettings(this.settings);
            this.isCalibrating = false;
            this.updateStatusDisplay('Calibration complete!');
            return;
        }

        const postureData = this.postureAnalysis.analyzePose(results.poseLandmarks, this.settings);
        this.updateLiveStats(postureData);
        this.updateSessionData(postureData);
    }

    /**
     * Handle errors from the pose detection module.
     */
    onPoseError(error) {
        console.error('Pose Detection Error:', error);
        let message = 'An unknown error occurred.';
        if (error.name === 'NotAllowedError') {
            message = 'Camera access denied. Please enable camera permissions.';
        } else if (error.name === 'NotFoundError') {
            message = 'No camera found. Please connect a camera.';
        }
        this.updateStatusDisplay(message);
    }

    /**
     * Update live statistics display (angles).
     */
    updateLiveStats(postureData) {
        this.elements.neckAngle.textContent = `${postureData.angles.neck.toFixed(0)}°`;
        this.elements.torsoAngle.textContent = `${postureData.angles.torso.toFixed(0)}°`;
    }
    
    /**
     * Update session data based on posture.
     */
    updateSessionData(postureData) {
        // This is where you would update session data like good posture time, etc.
    }

    /**
     * Update header statistics display.
     */
    updateHeaderStats() {
        const sessionTime = this.sessionData.totalTime || 0;
        this.elements.sessionTime.textContent = this.formatTime(sessionTime);
        this.elements.postureScore.textContent = `${this.sessionData.averageScore || 0}%`;
        this.elements.streakCount.textContent = `${this.dataStorage.getStreak()} days`;
    }

    /**
     * Start the session timer.
     */
    startSessionTimer() {
        if (this.sessionTimer) clearInterval(this.sessionTimer);
        this.sessionTimer = setInterval(() => {
            if (!this.sessionStartTime) return;
            const elapsed = Date.now() - this.sessionStartTime;
            this.sessionData.totalTime = elapsed;
            this.updateHeaderStats();
        }, 1000);
    }

    /**
     * Stop the session timer.
     */
    stopSessionTimer() {
        clearInterval(this.sessionTimer);
        this.sessionTimer = null;
    }

    /**
     * Adjust canvas size to match video element.
     */
    adjustCanvasSize() {
        if (this.elements.video && this.elements.canvas) {
            const videoRect = this.elements.video.getBoundingClientRect();
            this.elements.canvas.width = videoRect.width;
            this.elements.canvas.height = videoRect.height;
        }
    }

    /**
     * Handle page visibility changes.
     */
    handleVisibilityChange() {
        if (document.hidden && this.isRunning) {
            this.poseDetection.stopDetection();
        } else if (!document.hidden && this.isRunning) {
            this.poseDetection.startDetection();
        }
    }

    /**
     * Update the status text display.
     */
    updateStatusDisplay(message) {
        if (this.elements.statusText) {
            this.elements.statusText.textContent = message;
        }
    }

    /**
     * Format time from milliseconds to HH:MM:SS.
     */
    formatTime(ms) {
        const totalSeconds = Math.floor(ms / 1000);
        const hours = Math.floor(totalSeconds / 3600);
        const minutes = Math.floor((totalSeconds % 3600) / 60);
        const seconds = totalSeconds % 60;
        return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    }
}

// Initialize the app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    const app = new PostureGuardian();
    app.initialize();
});