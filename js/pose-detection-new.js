/**
 * Pose Detection Module
 * Handles MediaPipe pose detection and camera integration
 */

class PoseDetection {
    constructor() {
        this.pose = null;
        this.camera = null;
        this.isInitialized = false;
        this.isDetecting = false;

        this.videoElement = null;
        this.canvasElement = null;
        this.canvasContext = null;

        this.onResultsCallback = null;
        this.onErrorCallback = null;

        // MediaPipe configuration
        this.config = {
            modelComplexity: 1,
            smoothLandmarks: true,
            enableSegmentation: false,
            smoothSegmentation: true,
            minDetectionConfidence: 0.5,
            minTrackingConfidence: 0.5
        };

        this.drawingUtils = null;
    }

    /**
     * Initialize MediaPipe pose detection
     * @param {HTMLVideoElement} videoElement - Video element for camera feed
     * @param {HTMLCanvasElement} canvasElement - Canvas element for drawing overlay
     * @param {Function} onResults - Callback function for pose results
     * @param {Function} onError - Callback function for errors
     */
    async initialize(videoElement, canvasElement, onResults, onError) {
        try {
            this.videoElement = videoElement;
            this.canvasElement = canvasElement;
            this.canvasContext = canvasElement.getContext('2d');
            this.onResultsCallback = onResults;
            this.onErrorCallback = onError;

            // Initialize MediaPipe Pose
            await this.initializeMediaPipe();

            // Initialize camera
            await this.initializeCamera();

            this.isInitialized = true;
            console.log('Pose detection initialized successfully');

        } catch (error) {
            console.error('Failed to initialize pose detection:', error);
            if (this.onErrorCallback) {
                this.onErrorCallback(error);
            }
            throw error;
        }
    }

    /**
     * Initialize MediaPipe pose model
     */
    async initializeMediaPipe() {
        // Initialize MediaPipe Pose
        this.pose = new Pose({
            locateFile: (file) => {
                return `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${file}`;
            }
        });

        // Configure pose detection
        this.pose.setOptions(this.config);

        // Set up result handler
        this.pose.onResults((results) => {
            this.handlePoseResults(results);
        });

        console.log('MediaPipe pose model initialized');
    }

    /**
     * Initialize camera using MediaPipe Camera utility
     */
    async initializeCamera() {
        try {
            // Check if camera is available
            if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
                throw new Error('Camera access not supported in this browser');
            }

            // Initialize camera
            this.camera = new Camera(this.videoElement, {
                onFrame: async () => {
                    if (this.isDetecting && this.pose) {
                        await this.pose.send({ image: this.videoElement });
                    }
                },
                width: 640,
                height: 480
            });

            console.log('Camera initialized');

        } catch (error) {
            console.error('Failed to initialize camera:', error);
            throw error;
        }
    }

    /**
     * Start pose detection
     */
    async startDetection() {
        if (!this.isInitialized) {
            throw new Error('Pose detection not initialized');
        }

        try {
            this.isDetecting = true;
            await this.camera.start();
            console.log('Pose detection started');

        } catch (error) {
            console.error('Failed to start pose detection:', error);
            this.isDetecting = false;
            if (this.onErrorCallback) {
                this.onErrorCallback(error);
            }
            throw error;
        }
    }

    /**
     * Stop pose detection
     */
    async stopDetection() {
        try {
            this.isDetecting = false;
            if (this.camera) {
                this.camera.stop();
            }

            // Clear canvas
            if (this.canvasContext) {
                this.canvasContext.clearRect(0, 0, this.canvasElement.width, this.canvasElement.height);
            }

            console.log('Pose detection stopped');

        } catch (error) {
            console.error('Error stopping pose detection:', error);
        }
    }

    /**
     * Handle pose detection results
     * @param {Object} results - MediaPipe pose results
     */
    handlePoseResults(results) {
        if (!this.canvasContext || !this.isDetecting) return;

        // Set canvas size to match video
        this.canvasElement.width = this.videoElement.videoWidth;
        this.canvasElement.height = this.videoElement.videoHeight;

        // Clear previous frame
        this.canvasContext.save();
        this.canvasContext.clearRect(0, 0, this.canvasElement.width, this.canvasElement.height);

        // Draw pose landmarks and connections if detected
        if (results.poseLandmarks) {
            this.drawPoseOverlay(results.poseLandmarks);
        }

        this.canvasContext.restore();

        // Send results to callback
        if (this.onResultsCallback) {
            this.onResultsCallback({
                landmarks: results.poseLandmarks,
                worldLandmarks: results.poseWorldLandmarks,
                segmentationMask: results.segmentationMask,
                imageSize: {
                    width: this.canvasElement.width,
                    height: this.canvasElement.height
                },
                timestamp: performance.now()
            });
        }
    }

    /**
     * Draw pose overlay on canvas
     * @param {Array} landmarks - Pose landmarks
     */
    drawPoseOverlay(landmarks) {
        // Draw connections
        this.drawConnections(landmarks);

        // Draw landmarks
        this.drawLandmarks(landmarks);

        // Draw key points with labels
        this.drawKeyPoints(landmarks);
    }

    /**
     * Draw pose connections
     * @param {Array} landmarks - Pose landmarks
     */
    drawConnections(landmarks) {
        const connections = [
            // Torso
            [11, 12], // shoulders
            [11, 23], // left shoulder to hip
            [12, 24], // right shoulder to hip
            [23, 24], // hips

            // Arms
            [11, 13], [13, 15], // left arm
            [12, 14], [14, 16], // right arm

            // Head
            [0, 1], [1, 2], [2, 3], [3, 7], // left face
            [0, 4], [4, 5], [5, 6], [6, 8], // right face
            [9, 10], // mouth

            // Body center line (approximated)
            [0, 11], [0, 12] // head to shoulders
        ];

        this.canvasContext.strokeStyle = '#00FF00';
        this.canvasContext.lineWidth = 2;

        connections.forEach(([startIdx, endIdx]) => {
            const start = landmarks[startIdx];
            const end = landmarks[endIdx];

            if (start && end && start.visibility > 0.5 && end.visibility > 0.5) {
                this.canvasContext.beginPath();
                this.canvasContext.moveTo(
                    start.x * this.canvasElement.width,
                    start.y * this.canvasElement.height
                );
                this.canvasContext.lineTo(
                    end.x * this.canvasElement.width,
                    end.y * this.canvasElement.height
                );
                this.canvasContext.stroke();
            }
        });
    }

    /**
     * Draw pose landmarks
     * @param {Array} landmarks - Pose landmarks
     */
    drawLandmarks(landmarks) {
        landmarks.forEach((landmark, index) => {
            if (landmark.visibility > 0.5) {
                const x = landmark.x * this.canvasElement.width;
                const y = landmark.y * this.canvasElement.height;

                // Different colors for different body parts
                let color = '#FF0000'; // default red

                if (index <= 10) color = '#FFFF00'; // head - yellow
                else if (index <= 16) color = '#FF00FF'; // arms - magenta
                else if (index <= 22) color = '#00FFFF'; // legs - cyan
                else color = '#FFA500'; // torso - orange

                this.canvasContext.fillStyle = color;
                this.canvasContext.beginPath();
                this.canvasContext.arc(x, y, 4, 0, 2 * Math.PI);
                this.canvasContext.fill();
            }
        });
    }

    /**
     * Draw key points with labels
     * @param {Array} landmarks - Pose landmarks
     */
    drawKeyPoints(landmarks) {
        const keyPoints = [
            { index: 0, label: 'Nose', color: '#FFFF00' },
            { index: 11, label: 'L Shoulder', color: '#FF00FF' },
            { index: 12, label: 'R Shoulder', color: '#FF00FF' },
            { index: 23, label: 'L Hip', color: '#00FFFF' },
            { index: 24, label: 'R Hip', color: '#00FFFF' }
        ];

        this.canvasContext.font = '12px Arial';
        this.canvasContext.textAlign = 'center';

        keyPoints.forEach(({ index, label, color }) => {
            const landmark = landmarks[index];
            if (landmark && landmark.visibility > 0.5) {
                const x = landmark.x * this.canvasElement.width;
                const y = landmark.y * this.canvasElement.height;

                // Draw larger circle for key points
                this.canvasContext.fillStyle = color;
                this.canvasContext.beginPath();
                this.canvasContext.arc(x, y, 6, 0, 2 * Math.PI);
                this.canvasContext.fill();

                // Draw label
                this.canvasContext.fillStyle = '#FFFFFF';
                this.canvasContext.fillText(label, x, y - 10);
            }
        });
    }

    /**
     * Update MediaPipe configuration
     * @param {Object} newConfig - New configuration options
     */
    updateConfiguration(newConfig) {
        this.config = { ...this.config, ...newConfig };

        if (this.pose) {
            this.pose.setOptions(this.config);
        }
    }

    /**
     * Get current configuration
     */
    getConfig() {
        return { ...this.config };
    }

    /**
     * Check if pose detection is running
     */
    isRunning() {
        return this.isDetecting;
    }

    /**
     * Check if pose detection is initialized
     */
    isReady() {
        return this.isInitialized;
    }

    /**
     * Cleanup resources
     */
    destroy() {
        try {
            this.stopDetection();

            if (this.camera) {
                this.camera.stop();
                this.camera = null;
            }

            if (this.pose) {
                this.pose.close();
                this.pose = null;
            }

            // Clear video stream
            if (this.videoElement && this.videoElement.srcObject) {
                const tracks = this.videoElement.srcObject.getTracks();
                tracks.forEach(track => track.stop());
                this.videoElement.srcObject = null;
            }

            this.isInitialized = false;
            console.log('Pose detection destroyed');

        } catch (error) {
            console.error('Error destroying pose detection:', error);
        }
    }
}

// Export for use in other modules
window.PoseDetection = PoseDetection;
