/**
 * Advanced Posture Analysis Module
 * Analyzes pose landmarks to determine posture quality and provide feedback
 */

class PostureAnalysis {
    constructor() {
        // Posture thresholds based on ergonomic research
        this.thresholds = {
            neck: {
                excellent: { min: -5, max: 5 },    // Nearly neutral
                good: { min: -10, max: 10 },       // Slight forward/backward
                warning: { min: -20, max: 20 },    // Moderate deviation
                poor: { min: -45, max: 45 }        // Significant deviation
            },
            torso: {
                excellent: { min: 85, max: 95 },   // Nearly upright
                good: { min: 80, max: 100 },       // Slight lean
                warning: { min: 70, max: 110 },    // Moderate lean
                poor: { min: 45, max: 135 }        // Significant lean
            },
            shoulders: {
                maxAsymmetry: 5,                   // Max shoulder height difference
                forwardThreshold: 15               // Forward shoulder projection
            }
        };

        // Posture scoring weights
        this.weights = {
            neck: 0.4,          // Neck position is critical
            torso: 0.35,        // Torso alignment is important
            shoulders: 0.25     // Shoulder position affects overall posture
        };

        // Moving average for smoothing
        this.smoothingWindow = 10;
        this.recentMeasurements = {
            neck: [],
            torso: [],
            shoulders: []
        };

        // Posture state tracking
        this.currentState = {
            status: 'unknown',
            score: 0,
            angles: { neck: 0, torso: 0, shoulders: 0 },
            issues: [],
            recommendations: [],
            timestamp: Date.now()
        };
    }

    /**
     * Analyze pose landmarks and return posture assessment
     */
    analyzePose(landmarks, imageSize) {
        if (!landmarks || landmarks.length === 0) {
            return this.getDefaultPostureState();
        }

        try {
            // Extract key measurements
            const measurements = this.extractMeasurements(landmarks, imageSize);
            
            if (!measurements.isValid) {
                return this.getDefaultPostureState();
            }

            // Apply smoothing
            const smoothedMeasurements = this.applySmoothingFilter(measurements);

            // Analyze each component
            const neckAnalysis = this.analyzeNeckPosture(smoothedMeasurements.neckAngle);
            const torsoAnalysis = this.analyzeTorsoPosture(smoothedMeasurements.torsoAngle);
            const shoulderAnalysis = this.analyzeShoulderPosture(smoothedMeasurements.shoulderData);

            // Calculate overall score
            const overallScore = this.calculateOverallScore(neckAnalysis, torsoAnalysis, shoulderAnalysis);

            // Determine status
            const status = this.determinePostureStatus(overallScore);

            // Generate issues and recommendations
            const issues = this.identifyPostureIssues(neckAnalysis, torsoAnalysis, shoulderAnalysis);
            const recommendations = this.generateRecommendations(issues);

            // Update current state
            this.currentState = {
                status: status,
                score: Math.round(overallScore),
                angles: {
                    neck: Math.round(smoothedMeasurements.neckAngle),
                    torso: Math.round(smoothedMeasurements.torsoAngle),
                    shoulders: Math.round(smoothedMeasurements.shoulderData.asymmetry)
                },
                issues: issues,
                recommendations: recommendations,
                timestamp: Date.now(),
                confidence: measurements.confidence
            };

            return this.currentState;

        } catch (error) {
            console.error('Error analyzing posture:', error);
            return this.getDefaultPostureState();
        }
    }

    /**
     * Extract key measurements from pose landmarks
     */
    extractMeasurements(landmarks, imageSize) {
        try {
            // Key landmark indices
            const nose = landmarks[0];
            const leftShoulder = landmarks[11];
            const rightShoulder = landmarks[12];
            const leftHip = landmarks[23];
            const rightHip = landmarks[24];

            // Check visibility
            const requiredLandmarks = [nose, leftShoulder, rightShoulder, leftHip, rightHip];
            const allVisible = requiredLandmarks.every(landmark => 
                landmark && landmark.visibility > 0.5
            );

            if (!allVisible) {
                return { isValid: false, confidence: 0 };
            }

            // Calculate confidence
            const confidence = requiredLandmarks.reduce((sum, landmark) => 
                sum + landmark.visibility, 0
            ) / requiredLandmarks.length;

            // Calculate neck angle (forward head posture)
            const shoulderMidpoint = {
                x: (leftShoulder.x + rightShoulder.x) / 2,
                y: (leftShoulder.y + rightShoulder.y) / 2
            };

            const neckVector = {
                x: nose.x - shoulderMidpoint.x,
                y: nose.y - shoulderMidpoint.y
            };

            const neckAngle = Math.atan2(neckVector.x, -neckVector.y) * (180 / Math.PI);

            // Calculate torso angle
            const hipMidpoint = {
                x: (leftHip.x + rightHip.x) / 2,
                y: (leftHip.y + rightHip.y) / 2
            };

            const torsoVector = {
                x: shoulderMidpoint.x - hipMidpoint.x,
                y: shoulderMidpoint.y - hipMidpoint.y
            };

            const torsoAngle = Math.atan2(Math.abs(torsoVector.x), -torsoVector.y) * (180 / Math.PI);

            // Calculate shoulder measurements
            const shoulderData = {
                asymmetry: Math.abs(leftShoulder.y - rightShoulder.y) * imageSize.height,
                leftHeight: leftShoulder.y,
                rightHeight: rightShoulder.y,
                forwardProjection: this.calculateShoulderForwardProjection(
                    leftShoulder, rightShoulder, shoulderMidpoint, hipMidpoint
                )
            };

            return {
                isValid: true,
                confidence: confidence,
                neckAngle: neckAngle,
                torsoAngle: torsoAngle,
                shoulderData: shoulderData,
                landmarks: {
                    nose, leftShoulder, rightShoulder, leftHip, rightHip,
                    shoulderMidpoint, hipMidpoint
                }
            };

        } catch (error) {
            console.error('Error extracting measurements:', error);
            return { isValid: false, confidence: 0 };
        }
    }

    /**
     * Calculate shoulder forward projection
     */
    calculateShoulderForwardProjection(leftShoulder, rightShoulder, shoulderMidpoint, hipMidpoint) {
        // Calculate how far forward the shoulders are relative to the hips
        const shoulderToHipDistance = Math.sqrt(
            Math.pow(shoulderMidpoint.x - hipMidpoint.x, 2) +
            Math.pow(shoulderMidpoint.y - hipMidpoint.y, 2)
        );

        return shoulderToHipDistance * 100; // Convert to percentage-like scale
    }

    /**
     * Apply smoothing filter to reduce noise
     */
    applySmoothingFilter(measurements) {
        // Add to recent measurements
        this.recentMeasurements.neck.push(measurements.neckAngle);
        this.recentMeasurements.torso.push(measurements.torsoAngle);
        this.recentMeasurements.shoulders.push(measurements.shoulderData.asymmetry);

        // Keep only recent measurements
        Object.keys(this.recentMeasurements).forEach(key => {
            if (this.recentMeasurements[key].length > this.smoothingWindow) {
                this.recentMeasurements[key].shift();
            }
        });

        // Calculate moving averages
        const smoothedNeckAngle = this.calculateMovingAverage(this.recentMeasurements.neck);
        const smoothedTorsoAngle = this.calculateMovingAverage(this.recentMeasurements.torso);
        const smoothedShoulderAsymmetry = this.calculateMovingAverage(this.recentMeasurements.shoulders);

        return {
            neckAngle: smoothedNeckAngle,
            torsoAngle: smoothedTorsoAngle,
            shoulderData: {
                ...measurements.shoulderData,
                asymmetry: smoothedShoulderAsymmetry
            }
        };
    }

    /**
     * Calculate moving average
     */
    calculateMovingAverage(values) {
        if (values.length === 0) return 0;
        return values.reduce((sum, value) => sum + value, 0) / values.length;
    }

    /**
     * Analyze neck posture
     */
    analyzeNeckPosture(neckAngle) {
        const absAngle = Math.abs(neckAngle);
        
        let score = 100;
        let status = 'excellent';
        let issues = [];

        if (absAngle <= 5) {
            score = 100;
            status = 'excellent';
        } else if (absAngle <= 10) {
            score = 85;
            status = 'good';
        } else if (absAngle <= 20) {
            score = 60;
            status = 'warning';
            issues.push(neckAngle > 0 ? 'Forward head posture detected' : 'Head tilted backward');
        } else {
            score = 30;
            status = 'poor';
            issues.push(neckAngle > 0 ? 'Severe forward head posture' : 'Severe backward head tilt');
        }

        return { score, status, issues, angle: neckAngle };
    }

    /**
     * Analyze torso posture
     */
    analyzeTorsoPosture(torsoAngle) {
        let score = 100;
        let status = 'excellent';
        let issues = [];

        if (torsoAngle >= 85 && torsoAngle <= 95) {
            score = 100;
            status = 'excellent';
        } else if (torsoAngle >= 80 && torsoAngle <= 100) {
            score = 80;
            status = 'good';
        } else if (torsoAngle >= 70 && torsoAngle <= 110) {
            score = 50;
            status = 'warning';
            issues.push(torsoAngle < 85 ? 'Leaning forward' : 'Leaning backward');
        } else {
            score = 20;
            status = 'poor';
            issues.push(torsoAngle < 70 ? 'Severe forward lean' : 'Severe backward lean');
        }

        return { score, status, issues, angle: torsoAngle };
    }

    /**
     * Analyze shoulder posture
     */
    analyzeShoulderPosture(shoulderData) {
        let score = 100;
        let status = 'excellent';
        let issues = [];

        // Check shoulder asymmetry
        if (shoulderData.asymmetry > 10) {
            score -= 30;
            status = 'warning';
            issues.push('Uneven shoulder height');
        } else if (shoulderData.asymmetry > 5) {
            score -= 15;
            if (status === 'excellent') status = 'good';
        }

        // Check forward shoulder projection
        if (shoulderData.forwardProjection > 20) {
            score -= 40;
            status = 'poor';
            issues.push('Rounded shoulders');
        } else if (shoulderData.forwardProjection > 15) {
            score -= 20;
            if (status === 'excellent') status = 'warning';
            issues.push('Slight shoulder rounding');
        }

        return { score, status, issues, asymmetry: shoulderData.asymmetry };
    }

    /**
     * Calculate overall posture score
     */
    calculateOverallScore(neckAnalysis, torsoAnalysis, shoulderAnalysis) {
        return (
            neckAnalysis.score * this.weights.neck +
            torsoAnalysis.score * this.weights.torso +
            shoulderAnalysis.score * this.weights.shoulders
        );
    }

    /**
     * Determine overall posture status
     */
    determinePostureStatus(score) {
        if (score >= 90) return 'excellent';
        if (score >= 75) return 'good';
        if (score >= 60) return 'warning';
        return 'poor';
    }

    /**
     * Identify posture issues
     */
    identifyPostureIssues(neckAnalysis, torsoAnalysis, shoulderAnalysis) {
        const allIssues = [
            ...neckAnalysis.issues,
            ...torsoAnalysis.issues,
            ...shoulderAnalysis.issues
        ];

        return allIssues.filter((issue, index, self) => self.indexOf(issue) === index);
    }

    /**
     * Generate recommendations based on issues
     */
    generateRecommendations(issues) {
        const recommendationMap = {
            'Forward head posture detected': 'Pull your chin back and align your ears over your shoulders',
            'Severe forward head posture': 'Perform neck strengthening exercises and adjust monitor height',
            'Head tilted backward': 'Lower your chin slightly and check your screen height',
            'Leaning forward': 'Sit back in your chair and engage your core muscles',
            'Severe forward lean': 'Take a break and practice spinal extension exercises',
            'Leaning backward': 'Engage your core and bring your torso more upright',
            'Uneven shoulder height': 'Check your workspace setup and avoid carrying bags on one side',
            'Rounded shoulders': 'Pull your shoulder blades together and stretch your chest',
            'Slight shoulder rounding': 'Practice shoulder blade squeezes throughout the day'
        };

        return issues.map(issue => recommendationMap[issue] || 'Maintain good posture awareness');
    }

    /**
     * Get default posture state
     */
    getDefaultPostureState() {
        return {
            status: 'unknown',
            score: 0,
            angles: { neck: 0, torso: 0, shoulders: 0 },
            issues: ['Unable to detect posture'],
            recommendations: ['Ensure you are visible to the camera'],
            timestamp: Date.now(),
            confidence: 0
        };
    }

    /**
     * Get current posture state
     */
    getCurrentState() {
        return { ...this.currentState };
    }

    /**
     * Update posture thresholds
     */
    updateThresholds(newThresholds) {
        this.thresholds = { ...this.thresholds, ...newThresholds };
    }

    /**
     * Reset smoothing data
     */
    resetSmoothing() {
        this.recentMeasurements = {
            neck: [],
            torso: [],
            shoulders: []
        };
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = PostureAnalysis;
}
