class PoseDetection {
    constructor() {
        this.pose = null;
        this.camera = null;
        this.isInitialized = false;
        this.isRunning = false;

        this.videoElement = null;
        this.canvasElement = null;
        this.canvasContext = null;

        this.onResultsCallback = null;
        this.onErrorCallback = null;

        // Default configuration
        this.config = {
            modelComplexity: 1,
            smoothLandmarks: true,
            enableSegmentation: false,
            minDetectionConfidence: 0.5,
            minTrackingConfidence: 0.5
        };
    }

    async initialize(videoElement, canvasElement, onResults, onError) {
        this.videoElement = videoElement;
        this.canvasElement = canvasElement;
        this.onResultsCallback = onResults;
        this.onErrorCallback = onError;
        
        this.canvasContext = this.canvasElement.getContext('2d');

        try {
            this.pose = new Pose({
                locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${file}`
            });

            this.pose.setOptions(this.config);
            this.pose.onResults((results) => this.processResults(results));

            this.camera = new Camera(this.videoElement, {
                onFrame: async () => {
                    if (this.isRunning) {
                        await this.pose.send({ image: this.videoElement });
                    }
                },
                width: 640,
                height: 480
            });

            this.isInitialized = true;
            console.log('PoseDetection initialized');
        } catch (error) {
            console.error('Failed to initialize PoseDetection:', error);
            if (this.onErrorCallback) {
                this.onErrorCallback(error);
            }
        }
    }

    async startDetection() {
        if (!this.isInitialized) {
            console.error('Cannot start, not initialized.');
            return;
        }
        if (this.isRunning) return;

        try {
            await this.camera.start();
            this.isRunning = true;
            console.log('Pose detection started.');
        } catch (error) {
            console.error('Error starting camera:', error);
            if (this.onErrorCallback) {
                this.onErrorCallback(error);
            }
        }
    }

    stopDetection() {
        if (!this.isRunning) return;
        this.camera.stop();
        this.isRunning = false;
        console.log('Pose detection stopped.');
    }

    processResults(results) {
        this.canvasContext.save();
        this.canvasContext.clearRect(0, 0, this.canvasElement.width, this.canvasElement.height);
        
        if (results.poseLandmarks) {
            drawConnectors(this.canvasContext, results.poseLandmarks, POSE_CONNECTIONS, { color: '#00FF00', lineWidth: 4 });
            drawLandmarks(this.canvasContext, results.poseLandmarks, { color: '#FF0000', radius: 5 });
        }
        
        this.canvasContext.restore();

        if (this.onResultsCallback) {
            this.onResultsCallback(results);
        }
    }

    updateConfiguration(newConfig) {
        this.config = { ...this.config, ...newConfig };
        if (this.pose) {
            this.pose.setOptions(this.config);
        }
    }
}
