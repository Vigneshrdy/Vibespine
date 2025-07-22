// Posture Guardian - Fixed Implementation
class PostureGuardian {
    constructor() {
        this.isRunning = false;
        this.pose = null;
        this.camera = null;
        this.canvas = null;
        this.ctx = null;
        
        // Session tracking
        this.sessionStartTime = null;
        this.sessionData = {
            totalTime: 0,
            goodPostureTime: 0,
            poorPostureWarnings: 0,
            currentPostureState: 'unknown',
            postureHistory: []
        };
        
        // Posture analysis
        this.currentAngles = {
            neck: 0,
            torso: 0
        };
        
        // Settings from provided data
        this.settings = {
            audioEnabled: true,
            stretchReminders: true,
            reminderInterval: 30, // minutes
            sensitivityLevel: 'medium',
            achievementsEnabled: true,
            neckThreshold: 15,
            torsoThresholdMin: 85,
            torsoThresholdMax: 95
        };
        
        // Exercise data
        this.exercises = [
            {
                name: "Neck Stretch",
                description: "Gently tilt your head to each side",
                duration: 30,
                instructions: ["Sit up straight", "Slowly tilt head to right shoulder", "Hold for 15 seconds", "Repeat on left side"]
            },
            {
                name: "Shoulder Rolls", 
                description: "Roll shoulders backwards in circles",
                duration: 60,
                instructions: ["Sit up straight", "Roll shoulders backwards 10 times", "Roll shoulders forwards 10 times", "Repeat sequence"]
            },
            {
                name: "Upper Back Stretch",
                description: "Stretch between shoulder blades", 
                duration: 30,
                instructions: ["Clasp hands in front", "Push arms forward", "Round upper back", "Hold stretch"]
            }
        ];
        
        // Achievement data
        this.achievements = [
            {
                id: "perfect_hour",
                name: "Perfect Hour",
                description: "Maintain good posture for 1 full hour",
                icon: "🏆",
                unlocked: false
            },
            {
                id: "consistency_week", 
                name: "Weekly Warrior",
                description: "Use Posture Guardian every day for a week",
                icon: "🔥",
                unlocked: false
            },
            {
                id: "improvement_streak",
                name: "Improvement Champion", 
                description: "Improve posture score 5 days in a row",
                icon: "📈",
                unlocked: false
            }
        ];
        
        // Audio context for notifications
        this.audioContext = null;
        this.lastReminder = 0;
        this.exerciseTimer = null;
        this.sessionTimer = null;
        this.charts = {};
        this.currentExercise = null;
        
        this.initializeApp();
    }
    
    async initializeApp() {
        console.log('Initializing Posture Guardian...');
        
        // Load saved settings and data
        this.loadSettings();
        this.loadStatistics();
        this.loadAchievements();
        
        // Initialize DOM elements
        this.initializeElements();
        
        // Setup event listeners
        this.setupEventListeners();
        
        // Initialize MediaPipe (but don't require it to complete initialization)
        this.initializeMediaPipe().catch(error => {
            console.warn('MediaPipe initialization failed:', error);
            this.statusText.textContent = 'Ready to start (camera access required)';
        });
        
        // Setup UI
        this.setupUI();
        
        // Initialize charts
        this.initializeCharts();
        
        // Update initial display
        this.updatePostureDisplay();
        this.updateControlButtons();
        
        console.log('Posture Guardian initialized successfully');
    }
    
    initializeElements() {
        // Video elements
        this.videoElement = document.getElementById('inputVideo');
        this.canvas = document.getElementById('outputCanvas');
        this.ctx = this.canvas.getContext('2d');
        
        // Control buttons
        this.startBtn = document.getElementById('startBtn');
        this.stopBtn = document.getElementById('stopBtn');
        this.calibrateBtn = document.getElementById('calibrateBtn');
        
        // Status elements
        this.statusIndicator = document.getElementById('statusIndicator');
        this.statusText = document.getElementById('statusText');
        this.neckAngleDisplay = document.getElementById('neckAngle');
        this.torsoAngleDisplay = document.getElementById('torsoAngle');
        
        // Session tracking elements
        this.sessionTimeDisplay = document.getElementById('sessionTime');
        this.postureScoreDisplay = document.getElementById('postureScore');
        this.streakDisplay = document.getElementById('streakCount');
        this.goodPostureProgress = document.getElementById('goodPostureProgress');
        this.goodPostureTimeDisplay = document.getElementById('goodPostureTime');
        this.warningCountDisplay = document.getElementById('warningCount');
        
        // Settings elements
        this.audioCheckbox = document.getElementById('audioNotifications');
        this.stretchCheckbox = document.getElementById('stretchReminders');
        this.reminderSelect = document.getElementById('reminderInterval');
        this.sensitivitySelect = document.getElementById('sensitivity');
        this.neckThresholdSlider = document.getElementById('neckThreshold');
        this.torsoThresholdSlider = document.getElementById('torsoThreshold');
        
        // Modal elements
        this.exerciseModal = document.getElementById('exerciseModal');
        this.exerciseReminder = document.getElementById('exerciseReminder');
        
        // Alert elements
        this.alertBanner = document.getElementById('alertBanner');
    }
    
    setupEventListeners() {
        // Control buttons
        if (this.startBtn) {
            this.startBtn.addEventListener('click', () => this.startMonitoring());
        }
        if (this.stopBtn) {
            this.stopBtn.addEventListener('click', () => this.stopMonitoring());
        }
        
        const calibratePostureBtn = document.getElementById('calibratePosture');
        if (calibratePostureBtn) {
            calibratePostureBtn.addEventListener('click', () => this.calibratePosture());
        }
        
        const resetSessionBtn = document.getElementById('resetSession');
        if (resetSessionBtn) {
            resetSessionBtn.addEventListener('click', () => this.resetSession());
        }
        
        // Panel tabs - Fixed implementation
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                const panelName = e.target.dataset.panel;
                console.log('Switching to panel:', panelName);
                this.switchPanel(panelName);
            });
        });
        
        // Settings
        if (this.audioCheckbox) {
            this.audioCheckbox.addEventListener('change', (e) => {
                this.settings.audioEnabled = e.target.checked;
                this.saveSettings();
            });
        }
        
        if (this.stretchCheckbox) {
            this.stretchCheckbox.addEventListener('change', (e) => {
                this.settings.stretchReminders = e.target.checked;
                this.saveSettings();
            });
        }
        
        if (this.reminderSelect) {
            this.reminderSelect.addEventListener('change', (e) => {
                this.settings.reminderInterval = parseInt(e.target.value);
                this.saveSettings();
            });
        }
        
        if (this.sensitivitySelect) {
            this.sensitivitySelect.addEventListener('change', (e) => {
                this.settings.sensitivityLevel = e.target.value;
                this.saveSettings();
            });
        }
        
        if (this.neckThresholdSlider) {
            this.neckThresholdSlider.addEventListener('input', (e) => {
                this.settings.neckThreshold = parseInt(e.target.value);
                const valueDisplay = document.getElementById('neckThresholdValue');
                if (valueDisplay) {
                    valueDisplay.textContent = `${e.target.value}°`;
                }
                this.saveSettings();
            });
        }
        
        if (this.torsoThresholdSlider) {
            this.torsoThresholdSlider.addEventListener('input', (e) => {
                this.settings.torsoThresholdMin = parseInt(e.target.value);
                const valueDisplay = document.getElementById('torsoThresholdValue');
                if (valueDisplay) {
                    valueDisplay.textContent = `${e.target.value}°`;
                }
                this.saveSettings();
            });
        }
        
        // Exercise controls
        const exerciseBtn = document.getElementById('exerciseBtn');
        if (exerciseBtn) {
            exerciseBtn.addEventListener('click', () => this.showExerciseModal());
        }
        
        const startExerciseBtn = document.getElementById('startExercise');
        if (startExerciseBtn) {
            startExerciseBtn.addEventListener('click', () => this.startExerciseTimer());
        }
        
        const skipExerciseBtn = document.getElementById('skipExercise');
        if (skipExerciseBtn) {
            skipExerciseBtn.addEventListener('click', () => this.hideExerciseReminder());
        }
        
        // Modal controls
        const modalClose = document.getElementById('modalClose');
        if (modalClose) {
            modalClose.addEventListener('click', () => this.hideExerciseModal());
        }
        
        const modalStartStop = document.getElementById('modalStartStop');
        if (modalStartStop) {
            modalStartStop.addEventListener('click', () => this.toggleExerciseTimer());
        }
        
        const modalSkip = document.getElementById('modalSkip');
        if (modalSkip) {
            modalSkip.addEventListener('click', () => this.hideExerciseModal());
        }
        
        // Alert close
        const alertClose = document.getElementById('alertClose');
        if (alertClose) {
            alertClose.addEventListener('click', () => this.hideAlert());
        }
        
        // Settings actions
        const saveSettingsBtn = document.getElementById('saveSettings');
        if (saveSettingsBtn) {
            saveSettingsBtn.addEventListener('click', () => this.saveSettings());
        }
        
        const resetSettingsBtn = document.getElementById('resetSettings');
        if (resetSettingsBtn) {
            resetSettingsBtn.addEventListener('click', () => this.resetSettings());
        }
    }
    
    async initializeMediaPipe() {
        try {
            // Check if MediaPipe is available
            if (typeof Pose === 'undefined') {
                throw new Error('MediaPipe Pose not available');
            }
            
            // Initialize MediaPipe Pose
            this.pose = new Pose({
                locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${file}`
            });
            
            this.pose.setOptions({
                modelComplexity: 1,
                smoothLandmarks: true,
                enableSegmentation: false,
                smoothSegmentation: false,
                minDetectionConfidence: 0.5,
                minTrackingConfidence: 0.5
            });
            
            this.pose.onResults((results) => this.onPoseResults(results));
            
            console.log('MediaPipe Pose initialized');
            if (this.statusText) {
                this.statusText.textContent = 'Ready to start';
            }
        } catch (error) {
            console.error('Failed to initialize MediaPipe:', error);
            if (this.statusText) {
                this.statusText.textContent = 'Ready (limited functionality)';
            }
            throw error;
        }
    }
    
    async startMonitoring() {
        try {
            console.log('Starting posture monitoring...');
            
            if (this.statusText) {
                this.statusText.textContent = 'Requesting camera access...';
            }
            
            // Request camera access
            const stream = await navigator.mediaDevices.getUserMedia({
                video: { 
                    width: 640, 
                    height: 480,
                    facingMode: 'user'
                }
            });
            
            this.videoElement.srcObject = stream;
            this.videoElement.play();
            
            // Wait for video to be ready
            await new Promise((resolve) => {
                this.videoElement.onloadedmetadata = () => {
                    this.canvas.width = this.videoElement.videoWidth;
                    this.canvas.height = this.videoElement.videoHeight;
                    resolve();
                };
            });
            
            // Initialize camera utils if MediaPipe is available
            if (typeof Camera !== 'undefined' && this.pose) {
                this.camera = new Camera(this.videoElement, {
                    onFrame: async () => {
                        if (this.pose) {
                            await this.pose.send({image: this.videoElement});
                        }
                    },
                    width: 640,
                    height: 480
                });
                
                this.camera.start();
            } else {
                // Fallback: basic video display without pose detection
                console.warn('MediaPipe not available, running in basic mode');
                this.startBasicMode();
            }
            
            // Update state
            this.isRunning = true;
            this.sessionStartTime = Date.now();
            this.sessionData = {
                totalTime: 0,
                goodPostureTime: 0,
                poorPostureWarnings: 0,
                currentPostureState: 'unknown',
                postureHistory: []
            };
            
            // Update UI
            this.updateControlButtons();
            if (this.statusText) {
                this.statusText.textContent = 'Monitoring active';
            }
            
            // Start session timer
            this.startSessionTimer();
            
            // Initialize audio context
            if (this.settings.audioEnabled && !this.audioContext) {
                try {
                    this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
                } catch (e) {
                    console.warn('Audio context not available');
                }
            }
            
            this.showNotification('Success', 'Posture monitoring started', 'success');
            
        } catch (error) {
            console.error('Failed to start monitoring:', error);
            this.showNotification('Error', 'Failed to access camera. Please allow camera access and try again.', 'error');
            if (this.statusText) {
                this.statusText.textContent = 'Camera access denied';
            }
        }
    }
    
    startBasicMode() {
        // Basic mode without pose detection - just show video and simulate some data
        console.log('Running in basic mode');
        
        // Simulate posture data for demo purposes
        setInterval(() => {
            if (this.isRunning) {
                // Simulate random posture data
                this.currentAngles.neck = 10 + Math.random() * 20;
                this.currentAngles.torso = 85 + Math.random() * 20;
                
                const postureState = Math.random() > 0.3 ? 'good' : 'poor';
                this.updateSessionData(postureState);
                
                if (postureState !== this.sessionData.currentPostureState) {
                    this.handlePostureChange(postureState);
                }
                
                this.sessionData.currentPostureState = postureState;
                this.updatePostureDisplay();
            }
        }, 1000);
    }
    
    stopMonitoring() {
        console.log('Stopping posture monitoring...');
        
        if (this.camera) {
            this.camera.stop();
        }
        
        if (this.videoElement && this.videoElement.srcObject) {
            const tracks = this.videoElement.srcObject.getTracks();
            tracks.forEach(track => track.stop());
            this.videoElement.srcObject = null;
        }
        
        this.isRunning = false;
        this.clearCanvas();
        
        // Save session data
        this.saveSessionData();
        
        // Update UI
        this.updateControlButtons();
        if (this.statusText) {
            this.statusText.textContent = 'Monitoring stopped';
        }
        if (this.statusIndicator) {
            this.statusIndicator.className = 'status-indicator';
        }
        
        this.showNotification('Info', 'Session completed', 'success');
    }
    
    onPoseResults(results) {
        if (!this.isRunning || !results.poseLandmarks) {
            return;
        }
        
        // Clear canvas
        this.clearCanvas();
        
        // Draw pose landmarks
        this.drawPoseLandmarks(results.poseLandmarks);
        
        // Analyze posture
        this.analyzePosture(results.poseLandmarks);
        
        // Update UI
        this.updatePostureDisplay();
        
        // Check for reminders
        this.checkStretchReminder();
    }
    
    analyzePosture(landmarks) {
        // Calculate neck angle (ear to shoulder to hip)
        const neckAngle = this.calculateNeckAngle(landmarks);
        const torsoAngle = this.calculateTorsoAngle(landmarks);
        
        this.currentAngles.neck = neckAngle;
        this.currentAngles.torso = torsoAngle;
        
        // Determine posture quality
        const postureState = this.classifyPosture(neckAngle, torsoAngle);
        
        // Update session data
        this.updateSessionData(postureState);
        
        // Handle posture changes
        if (postureState !== this.sessionData.currentPostureState) {
            this.handlePostureChange(postureState);
        }
        
        this.sessionData.currentPostureState = postureState;
    }
    
    calculateNeckAngle(landmarks) {
        // Points: ear (7), shoulder (11), hip (23)
        const ear = landmarks[7];
        const shoulder = landmarks[11];
        const hip = landmarks[23];
        
        if (!ear || !shoulder || !hip) return 0;
        
        // Calculate vectors
        const v1 = {
            x: ear.x - shoulder.x,
            y: ear.y - shoulder.y
        };
        
        const v2 = {
            x: hip.x - shoulder.x,
            y: hip.y - shoulder.y
        };
        
        // Calculate angle
        const angle = this.calculateAngleBetweenVectors(v1, v2);
        return Math.abs(90 - angle); // Deviation from vertical
    }
    
    calculateTorsoAngle(landmarks) {
        // Points: shoulder (11), hip (23), knee (25)
        const shoulder = landmarks[11];
        const hip = landmarks[23];
        const knee = landmarks[25];
        
        if (!shoulder || !hip || !knee) return 90;
        
        // Calculate vectors
        const v1 = {
            x: shoulder.x - hip.x,
            y: shoulder.y - hip.y
        };
        
        const v2 = {
            x: knee.x - hip.x,
            y: knee.y - hip.y
        };
        
        // Calculate angle
        return this.calculateAngleBetweenVectors(v1, v2);
    }
    
    calculateAngleBetweenVectors(v1, v2) {
        const dot = v1.x * v2.x + v1.y * v2.y;
        const mag1 = Math.sqrt(v1.x * v1.x + v1.y * v1.y);
        const mag2 = Math.sqrt(v2.x * v2.x + v2.y * v2.y);
        
        const cos = dot / (mag1 * mag2);
        const angle = Math.acos(Math.max(-1, Math.min(1, cos))) * (180 / Math.PI);
        
        return angle;
    }
    
    classifyPosture(neckAngle, torsoAngle) {
        const neckGood = neckAngle <= this.settings.neckThreshold;
        const torsoGood = torsoAngle >= this.settings.torsoThresholdMin && 
                         torsoAngle <= this.settings.torsoThresholdMax + 15;
        
        if (neckGood && torsoGood) {
            return 'good';
        } else {
            return 'poor';
        }
    }
    
    updateSessionData(postureState) {
        const now = Date.now();
        if (this.sessionStartTime) {
            const elapsed = now - this.sessionStartTime;
            this.sessionData.totalTime = elapsed;
            
            if (postureState === 'good') {
                this.sessionData.goodPostureTime += 100; // Add 100ms
            }
        }
        
        // Track posture history
        this.sessionData.postureHistory.push({
            timestamp: now,
            state: postureState,
            neckAngle: this.currentAngles.neck,
            torsoAngle: this.currentAngles.torso
        });
        
        // Limit history size
        if (this.sessionData.postureHistory.length > 1000) {
            this.sessionData.postureHistory = this.sessionData.postureHistory.slice(-500);
        }
    }
    
    handlePostureChange(newState) {
        if (newState === 'poor' && this.sessionData.currentPostureState !== 'poor') {
            this.sessionData.poorPostureWarnings++;
            this.showPostureAlert();
            this.playNotificationSound('warning');
        } else if (newState === 'good' && this.sessionData.currentPostureState === 'poor') {
            this.hideAlert();
            this.playNotificationSound('success');
        }
    }
    
    drawPoseLandmarks(landmarks) {
        // Set canvas size to match video
        this.ctx.save();
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        
        // Draw connections
        this.drawPoseConnections(landmarks);
        
        // Draw key points
        this.drawKeyPoints(landmarks);
        
        this.ctx.restore();
    }
    
    drawPoseConnections(landmarks) {
        const connections = [
            [11, 12], [11, 13], [12, 14], [13, 15], [14, 16], // Arms
            [11, 23], [12, 24], [23, 24], // Torso
            [23, 25], [24, 26], [25, 27], [26, 28] // Legs
        ];
        
        this.ctx.strokeStyle = '#32a852';
        this.ctx.lineWidth = 3;
        this.ctx.lineCap = 'round';
        
        connections.forEach(([start, end]) => {
            const startPoint = landmarks[start];
            const endPoint = landmarks[end];
            
            if (startPoint && endPoint && startPoint.visibility > 0.5 && endPoint.visibility > 0.5) {
                this.ctx.beginPath();
                this.ctx.moveTo(startPoint.x * this.canvas.width, startPoint.y * this.canvas.height);
                this.ctx.lineTo(endPoint.x * this.canvas.width, endPoint.y * this.canvas.height);
                this.ctx.stroke();
            }
        });
    }
    
    drawKeyPoints(landmarks) {
        const keyPoints = [11, 12, 23, 24, 7, 8]; // Key posture points
        
        keyPoints.forEach(index => {
            const point = landmarks[index];
            if (point && point.visibility > 0.5) {
                this.ctx.fillStyle = '#1fb8cd';
                this.ctx.beginPath();
                this.ctx.arc(
                    point.x * this.canvas.width,
                    point.y * this.canvas.height,
                    6,
                    0,
                    2 * Math.PI
                );
                this.ctx.fill();
                
                // Add white border
                this.ctx.strokeStyle = '#ffffff';
                this.ctx.lineWidth = 2;
                this.ctx.stroke();
            }
        });
    }
    
    clearCanvas() {
        if (this.ctx && this.canvas) {
            this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        }
    }
    
    updatePostureDisplay() {
        // Update angles
        if (this.neckAngleDisplay) {
            this.neckAngleDisplay.textContent = `${Math.round(this.currentAngles.neck)}°`;
        }
        if (this.torsoAngleDisplay) {
            this.torsoAngleDisplay.textContent = `${Math.round(this.currentAngles.torso)}°`;
        }
        
        // Update status
        const state = this.sessionData.currentPostureState;
        if (this.statusIndicator) {
            this.statusIndicator.className = `status-indicator ${state}`;
        }
        
        if (this.statusText) {
            if (state === 'good') {
                this.statusText.textContent = 'Good posture';
            } else if (state === 'poor') {
                this.statusText.textContent = 'Poor posture detected';
            }
        }
        
        // Update session stats
        if (this.sessionData.totalTime > 0) {
            const totalMinutes = Math.floor(this.sessionData.totalTime / 60000);
            const totalSeconds = Math.floor((this.sessionData.totalTime % 60000) / 1000);
            const goodMinutes = Math.floor(this.sessionData.goodPostureTime / 60000);
            const goodSeconds = Math.floor((this.sessionData.goodPostureTime % 60000) / 1000);
            
            if (this.sessionTimeDisplay) {
                this.sessionTimeDisplay.textContent = `${String(Math.floor(totalMinutes / 60)).padStart(2, '0')}:${String(totalMinutes % 60).padStart(2, '0')}:${String(totalSeconds).padStart(2, '0')}`;
            }
            
            const score = Math.round((this.sessionData.goodPostureTime / this.sessionData.totalTime) * 100);
            if (this.postureScoreDisplay) {
                this.postureScoreDisplay.textContent = `${score}%`;
            }
            if (this.goodPostureProgress) {
                this.goodPostureProgress.style.width = `${score}%`;
            }
            
            if (this.goodPostureTimeDisplay) {
                this.goodPostureTimeDisplay.textContent = `${goodMinutes}m ${goodSeconds}s`;
            }
        }
        
        if (this.warningCountDisplay) {
            this.warningCountDisplay.textContent = this.sessionData.poorPostureWarnings;
        }
    }
    
    showPostureAlert() {
        if (this.alertBanner) {
            this.alertBanner.style.display = 'block';
        }
        const alertMessage = document.getElementById('alertMessage');
        if (alertMessage) {
            alertMessage.textContent = 'Poor posture detected! Please adjust your position.';
        }
    }
    
    hideAlert() {
        if (this.alertBanner) {
            this.alertBanner.style.display = 'none';
        }
    }
    
    async playNotificationSound(type) {
        if (!this.settings.audioEnabled || !this.audioContext) return;
        
        try {
            const oscillator = this.audioContext.createOscillator();
            const gainNode = this.audioContext.createGain();
            
            oscillator.connect(gainNode);
            gainNode.connect(this.audioContext.destination);
            
            // Different sounds for different notifications
            if (type === 'warning') {
                oscillator.frequency.value = 400;
                oscillator.type = 'triangle';
            } else if (type === 'success') {
                oscillator.frequency.value = 800;
                oscillator.type = 'sine';
            }
            
            gainNode.gain.setValueAtTime(0.1, this.audioContext.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 0.5);
            
            oscillator.start(this.audioContext.currentTime);
            oscillator.stop(this.audioContext.currentTime + 0.5);
        } catch (error) {
            console.warn('Failed to play notification sound:', error);
        }
    }
    
    checkStretchReminder() {
        if (!this.settings.stretchReminders || !this.isRunning) return;
        
        const now = Date.now();
        const reminderInterval = this.settings.reminderInterval * 60 * 1000; // Convert to milliseconds
        
        if (now - this.lastReminder > reminderInterval) {
            this.showExerciseReminder();
            this.lastReminder = now;
        }
    }
    
    showExerciseReminder() {
        const exercise = this.exercises[Math.floor(Math.random() * this.exercises.length)];
        
        const exerciseName = document.getElementById('exerciseName');
        const exerciseDescription = document.getElementById('exerciseDescription');
        const exerciseTimer = document.getElementById('exerciseTimer');
        
        if (exerciseName) exerciseName.textContent = exercise.name;
        if (exerciseDescription) exerciseDescription.textContent = exercise.description;
        if (exerciseTimer) exerciseTimer.textContent = `${exercise.duration}s`;
        
        if (this.exerciseReminder) {
            this.exerciseReminder.style.display = 'block';
        }
        this.playNotificationSound('success');
    }
    
    hideExerciseReminder() {
        if (this.exerciseReminder) {
            this.exerciseReminder.style.display = 'none';
        }
    }
    
    showExerciseModal() {
        const exercise = this.exercises[Math.floor(Math.random() * this.exercises.length)];
        
        const modalExerciseName = document.getElementById('modalExerciseName');
        const modalTimer = document.getElementById('modalTimer');
        const modalInstructions = document.getElementById('modalInstructions');
        
        if (modalExerciseName) modalExerciseName.textContent = exercise.name;
        if (modalTimer) modalTimer.textContent = exercise.duration;
        
        if (modalInstructions) {
            modalInstructions.innerHTML = '<ol>' + exercise.instructions.map(step => `<li>${step}</li>`).join('') + '</ol>';
        }
        
        if (this.exerciseModal) {
            this.exerciseModal.style.display = 'flex';
        }
        this.currentExercise = exercise;
    }
    
    hideExerciseModal() {
        if (this.exerciseModal) {
            this.exerciseModal.style.display = 'none';
        }
        this.stopExerciseTimer();
    }
    
    startExerciseTimer() {
        this.hideExerciseReminder();
        this.showExerciseModal();
        this.toggleExerciseTimer();
    }
    
    toggleExerciseTimer() {
        if (this.exerciseTimer) {
            this.stopExerciseTimer();
        } else {
            this.startModalExerciseTimer();
        }
    }
    
    startModalExerciseTimer() {
        if (!this.currentExercise) return;
        
        let timeLeft = this.currentExercise.duration;
        const timerDisplay = document.getElementById('modalTimer');
        const progressBar = document.getElementById('exerciseProgress');
        const startStopBtn = document.getElementById('modalStartStop');
        
        if (startStopBtn) {
            startStopBtn.textContent = 'Stop Exercise';
        }
        
        this.exerciseTimer = setInterval(() => {
            timeLeft--;
            if (timerDisplay) timerDisplay.textContent = timeLeft;
            
            const progress = ((this.currentExercise.duration - timeLeft) / this.currentExercise.duration) * 100;
            if (progressBar) progressBar.style.width = `${progress}%`;
            
            if (timeLeft <= 0) {
                this.stopExerciseTimer();
                this.completeExercise();
            }
        }, 1000);
    }
    
    stopExerciseTimer() {
        if (this.exerciseTimer) {
            clearInterval(this.exerciseTimer);
            this.exerciseTimer = null;
            
            const startStopBtn = document.getElementById('modalStartStop');
            if (startStopBtn) {
                startStopBtn.textContent = 'Start Exercise';
            }
        }
    }
    
    completeExercise() {
        this.showNotification('Success', 'Exercise completed! Great job!', 'success');
        this.hideExerciseModal();
        
        // Update activity log
        if (this.currentExercise) {
            this.addActivityLog('🧘', `Completed ${this.currentExercise.name}`);
        }
    }
    
    startSessionTimer() {
        if (this.sessionTimer) {
            clearInterval(this.sessionTimer);
        }
        
        this.sessionTimer = setInterval(() => {
            if (this.isRunning) {
                this.updatePostureDisplay();
            }
        }, 100);
    }
    
    switchPanel(panelName) {
        console.log('Switching to panel:', panelName);
        
        // Update tab buttons
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.panel === panelName);
        });
        
        // Update panels
        document.querySelectorAll('.panel').forEach(panel => {
            const isActive = panel.id === `${panelName}Panel`;
            panel.classList.toggle('active', isActive);
            console.log(`Panel ${panel.id}: ${isActive ? 'active' : 'inactive'}`);
        });
        
        // Load panel-specific content
        if (panelName === 'statistics') {
            this.updateStatistics();
        } else if (panelName === 'achievements') {
            this.updateAchievements();
        }
    }
    
    updateStatistics() {
        const stats = this.loadStatistics();
        
        const totalSessionsEl = document.getElementById('totalSessions');
        const totalTimeEl = document.getElementById('totalTime');
        const avgScoreEl = document.getElementById('avgScore');
        const bestStreakEl = document.getElementById('bestStreak');
        
        if (totalSessionsEl) totalSessionsEl.textContent = stats.totalSessions || 0;
        if (totalTimeEl) totalTimeEl.textContent = `${Math.floor((stats.totalTime || 0) / 3600000)}h`;
        if (avgScoreEl) avgScoreEl.textContent = `${Math.round(stats.avgScore || 0)}%`;
        if (bestStreakEl) bestStreakEl.textContent = stats.bestStreak || 0;
        
        // Update charts
        this.updateCharts(stats);
    }
    
    updateAchievements() {
        const container = document.getElementById('achievementsList');
        if (!container) return;
        
        container.innerHTML = '';
        
        this.achievements.forEach(achievement => {
            const item = document.createElement('div');
            item.className = `achievement-item ${achievement.unlocked ? 'unlocked' : 'locked'}`;
            
            item.innerHTML = `
                <div class="achievement-icon">${achievement.icon}</div>
                <div class="achievement-info">
                    <div class="achievement-name">${achievement.name}</div>
                    <div class="achievement-description">${achievement.description}</div>
                </div>
                <div class="achievement-status ${achievement.unlocked ? 'unlocked' : 'locked'}">
                    ${achievement.unlocked ? 'Unlocked' : 'Locked'}
                </div>
            `;
            
            container.appendChild(item);
        });
    }
    
    initializeCharts() {
        // Check if Chart.js is available
        if (typeof Chart === 'undefined') {
            console.warn('Chart.js not available');
            return;
        }
        
        // Weekly progress chart
        const weeklyCtx = document.getElementById('weeklyChart');
        if (weeklyCtx) {
            this.charts.weekly = new Chart(weeklyCtx, {
                type: 'line',
                data: {
                    labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
                    datasets: [{
                        label: 'Posture Score',
                        data: [65, 70, 68, 75, 72, 78, 80],
                        borderColor: '#1FB8CD',
                        backgroundColor: 'rgba(31, 184, 205, 0.1)',
                        fill: true,
                        tension: 0.3
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: {
                            display: false
                        }
                    },
                    scales: {
                        y: {
                            beginAtZero: true,
                            max: 100,
                            ticks: {
                                callback: function(value) {
                                    return value + '%';
                                }
                            }
                        }
                    }
                }
            });
        }
        
        // Trend chart
        const trendCtx = document.getElementById('trendChart');
        if (trendCtx) {
            this.charts.trend = new Chart(trendCtx, {
                type: 'doughnut',
                data: {
                    labels: ['Good Posture', 'Poor Posture'],
                    datasets: [{
                        data: [75, 25],
                        backgroundColor: ['#1FB8CD', '#FF5459'],
                        borderWidth: 0
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: {
                            position: 'bottom'
                        }
                    }
                }
            });
        }
    }
    
    updateCharts(stats) {
        // Update weekly chart with real data
        if (this.charts.weekly && stats.weeklyData) {
            this.charts.weekly.data.datasets[0].data = stats.weeklyData;
            this.charts.weekly.update();
        }
        
        // Update trend chart
        if (this.charts.trend && this.sessionData.totalTime > 0) {
            const goodPercent = (this.sessionData.goodPostureTime / this.sessionData.totalTime) * 100;
            const poorPercent = 100 - goodPercent;
            
            this.charts.trend.data.datasets[0].data = [goodPercent, poorPercent];
            this.charts.trend.update();
        }
    }
    
    updateControlButtons() {
        if (this.isRunning) {
            if (this.startBtn) this.startBtn.style.display = 'none';
            if (this.stopBtn) this.stopBtn.style.display = 'inline-flex';
            if (this.calibrateBtn) this.calibrateBtn.style.display = 'inline-flex';
        } else {
            if (this.startBtn) this.startBtn.style.display = 'inline-flex';
            if (this.stopBtn) this.stopBtn.style.display = 'none';
            if (this.calibrateBtn) this.calibrateBtn.style.display = 'none';
        }
    }
    
    calibratePosture() {
        // Reset thresholds based on current posture
        if (this.currentAngles.neck > 0 && this.currentAngles.torso > 0) {
            this.settings.neckThreshold = Math.max(10, this.currentAngles.neck + 5);
            this.settings.torsoThresholdMin = Math.max(70, this.currentAngles.torso - 10);
            
            if (this.neckThresholdSlider) this.neckThresholdSlider.value = this.settings.neckThreshold;
            if (this.torsoThresholdSlider) this.torsoThresholdSlider.value = this.settings.torsoThresholdMin;
            
            const neckValueDisplay = document.getElementById('neckThresholdValue');
            const torsoValueDisplay = document.getElementById('torsoThresholdValue');
            
            if (neckValueDisplay) neckValueDisplay.textContent = `${this.settings.neckThreshold}°`;
            if (torsoValueDisplay) torsoValueDisplay.textContent = `${this.settings.torsoThresholdMin}°`;
            
            this.saveSettings();
            this.showNotification('Success', 'Posture calibrated successfully', 'success');
        } else {
            this.showNotification('Info', 'Please start monitoring first to calibrate', 'info');
        }
    }
    
    resetSession() {
        this.sessionData = {
            totalTime: 0,
            goodPostureTime: 0,
            poorPostureWarnings: 0,
            currentPostureState: 'unknown',
            postureHistory: []
        };
        
        this.sessionStartTime = Date.now();
        this.updatePostureDisplay();
        this.showNotification('Info', 'Session reset', 'success');
    }
    
    setupUI() {
        // Initialize settings UI
        if (this.audioCheckbox) this.audioCheckbox.checked = this.settings.audioEnabled;
        if (this.stretchCheckbox) this.stretchCheckbox.checked = this.settings.stretchReminders;
        if (this.reminderSelect) this.reminderSelect.value = this.settings.reminderInterval;
        if (this.sensitivitySelect) this.sensitivitySelect.value = this.settings.sensitivityLevel;
        if (this.neckThresholdSlider) this.neckThresholdSlider.value = this.settings.neckThreshold;
        if (this.torsoThresholdSlider) this.torsoThresholdSlider.value = this.settings.torsoThresholdMin;
        
        const neckValueDisplay = document.getElementById('neckThresholdValue');
        const torsoValueDisplay = document.getElementById('torsoThresholdValue');
        
        if (neckValueDisplay) neckValueDisplay.textContent = `${this.settings.neckThreshold}°`;
        if (torsoValueDisplay) torsoValueDisplay.textContent = `${this.settings.torsoThresholdMin}°`;
        
        // Load streak data
        const stats = this.loadStatistics();
        if (this.streakDisplay) {
            this.streakDisplay.textContent = `${stats.currentStreak || 0} days`;
        }
        
        // Initialize achievements
        this.updateAchievements();
        
        // Add welcome activity
        this.addActivityLog('👋', 'Welcome to Posture Guardian!');
        
        // Set initial status
        if (this.statusText) {
            this.statusText.textContent = 'Ready to start';
        }
    }
    
    showNotification(title, message, type = 'info') {
        const container = document.getElementById('notificationContainer');
        if (!container) return;
        
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        
        const icons = {
            success: '✅',
            error: '❌',
            warning: '⚠️',
            info: 'ℹ️'
        };
        
        notification.innerHTML = `
            <div class="notification-icon">${icons[type]}</div>
            <div class="notification-content">
                <div class="notification-title">${title}</div>
                <div class="notification-message">${message}</div>
            </div>
            <button class="notification-close">×</button>
        `;
        
        container.appendChild(notification);
        
        // Auto-remove after 5 seconds
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 5000);
        
        // Close button
        const closeBtn = notification.querySelector('.notification-close');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => {
                if (notification.parentNode) {
                    notification.parentNode.removeChild(notification);
                }
            });
        }
    }
    
    addActivityLog(icon, text) {
        const log = document.getElementById('activityLog');
        if (!log) return;
        
        const item = document.createElement('div');
        item.className = 'activity-item';
        
        item.innerHTML = `
            <span class="activity-icon">${icon}</span>
            <span class="activity-text">${text}</span>
            <span class="activity-time">Just now</span>
        `;
        
        log.insertBefore(item, log.firstChild);
        
        // Limit log size
        while (log.children.length > 10) {
            log.removeChild(log.lastChild);
        }
    }
    
    saveSettings() {
        localStorage.setItem('postureGuardianSettings', JSON.stringify(this.settings));
        console.log('Settings saved:', this.settings);
        this.showNotification('Success', 'Settings saved', 'success');
    }
    
    loadSettings() {
        try {
            const saved = localStorage.getItem('postureGuardianSettings');
            if (saved) {
                this.settings = { ...this.settings, ...JSON.parse(saved) };
            }
        } catch (error) {
            console.warn('Failed to load settings:', error);
        }
    }
    
    resetSettings() {
        this.settings = {
            audioEnabled: true,
            stretchReminders: true,
            reminderInterval: 30,
            sensitivityLevel: 'medium',
            achievementsEnabled: true,
            neckThreshold: 15,
            torsoThresholdMin: 85,
            torsoThresholdMax: 95
        };
        
        this.saveSettings();
        this.setupUI();
        this.showNotification('Info', 'Settings reset to default', 'success');
    }
    
    saveSessionData() {
        try {
            const stats = this.loadStatistics();
            
            stats.totalSessions = (stats.totalSessions || 0) + 1;
            stats.totalTime = (stats.totalTime || 0) + this.sessionData.totalTime;
            
            const sessionScore = this.sessionData.totalTime > 0 ? 
                (this.sessionData.goodPostureTime / this.sessionData.totalTime) * 100 : 0;
            
            stats.avgScore = ((stats.avgScore || 0) * (stats.totalSessions - 1) + sessionScore) / stats.totalSessions;
            
            // Update daily streak
            const today = new Date().toDateString();
            if (stats.lastSessionDate !== today) {
                if (sessionScore >= 70) { // Good session threshold
                    stats.currentStreak = (stats.currentStreak || 0) + 1;
                    stats.bestStreak = Math.max(stats.bestStreak || 0, stats.currentStreak);
                } else {
                    stats.currentStreak = 0;
                }
                stats.lastSessionDate = today;
            }
            
            // Update weekly data
            const dayIndex = new Date().getDay();
            stats.weeklyData = stats.weeklyData || [0, 0, 0, 0, 0, 0, 0];
            stats.weeklyData[dayIndex] = sessionScore;
            
            localStorage.setItem('postureGuardianStats', JSON.stringify(stats));
            
            // Check achievements
            this.checkAchievements(stats);
        } catch (error) {
            console.warn('Failed to save session data:', error);
        }
    }
    
    loadStatistics() {
        try {
            const saved = localStorage.getItem('postureGuardianStats');
            return saved ? JSON.parse(saved) : {};
        } catch (error) {
            console.warn('Failed to load statistics:', error);
            return {};
        }
    }
    
    checkAchievements(stats) {
        // Perfect Hour achievement
        if (this.sessionData.goodPostureTime >= 3600000 && !this.achievements[0].unlocked) {
            this.unlockAchievement(0);
        }
        
        // Weekly Warrior achievement
        if (stats.currentStreak >= 7 && !this.achievements[1].unlocked) {
            this.unlockAchievement(1);
        }
        
        // Improvement Champion achievement
        if (stats.currentStreak >= 5 && !this.achievements[2].unlocked) {
            this.unlockAchievement(2);
        }
    }
    
    unlockAchievement(index) {
        this.achievements[index].unlocked = true;
        
        // Save achievements
        try {
            localStorage.setItem('postureGuardianAchievements', JSON.stringify(this.achievements));
        } catch (error) {
            console.warn('Failed to save achievements:', error);
        }
        
        // Show notification
        this.showNotification(
            'Achievement Unlocked!', 
            `${this.achievements[index].icon} ${this.achievements[index].name}`, 
            'success'
        );
        
        // Update activity log
        this.addActivityLog('🏆', `Unlocked: ${this.achievements[index].name}`);
        
        // Play achievement sound
        this.playNotificationSound('success');
    }
    
    // Load saved achievements
    loadAchievements() {
        try {
            const saved = localStorage.getItem('postureGuardianAchievements');
            if (saved) {
                const savedAchievements = JSON.parse(saved);
                savedAchievements.forEach((saved, index) => {
                    if (this.achievements[index]) {
                        this.achievements[index].unlocked = saved.unlocked;
                    }
                });
            }
        } catch (error) {
            console.warn('Failed to load achievements:', error);
        }
    }
}

// Initialize the app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM loaded, initializing Posture Guardian...');
    window.postureGuardian = new PostureGuardian();
});

// Handle page unload
window.addEventListener('beforeunload', () => {
    if (window.postureGuardian && window.postureGuardian.isRunning) {
        window.postureGuardian.stopMonitoring();
    }
});