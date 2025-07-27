/**
 * Data Storage Module
 * Handles all localStorage operations for settings, statistics, and session data
 */

class DataStorage {
    constructor() {
        this.storageKeys = {
            SETTINGS: 'postureGuardian_settings',
            STATISTICS: 'postureGuardian_statistics',
            SESSION_DATA: 'postureGuardian_sessionData',
            ACHIEVEMENTS: 'postureGuardian_achievements',
            USER_PROFILE: 'postureGuardian_userProfile'
        };

        this.defaultSettings = {
            audioEnabled: true,
            stretchReminders: true,
            reminderInterval: 30, // minutes
            sensitivityLevel: 'medium',
            achievementsEnabled: true,
            neckThreshold: 15, // degrees
            torsoThresholdMin: 85, // degrees
            torsoThresholdMax: 95, // degrees
            notificationVolume: 0.7,
            theme: 'light',
            language: 'en'
        };

        this.defaultStatistics = {
            totalSessions: 0,
            totalTime: 0, // seconds
            totalGoodPostureTime: 0, // seconds
            averagePostureScore: 0,
            streakDays: 0,
            lastSessionDate: null,
            dailyStats: {}, // date -> stats object
            weeklyStats: [], // array of weekly summaries
            monthlyStats: [], // array of monthly summaries
            postureImprovements: []
        };

        this.initializeStorage();
    }

    /**
     * Initialize storage with default values if not exists
     */
    initializeStorage() {
        if (!this.getSettings()) {
            this.saveSettings(this.defaultSettings);
        }

        if (!this.getStatistics()) {
            this.saveStatistics(this.defaultStatistics);
        }

        if (!this.getAchievements()) {
            this.saveAchievements([]);
        }
    }

    /**
     * Generic localStorage operations
     */
    getItem(key) {
        try {
            const item = localStorage.getItem(key);
            return item ? JSON.parse(item) : null;
        } catch (error) {
            console.error(`Error reading from localStorage (key: ${key}):`, error);
            return null;
        }
    }

    setItem(key, value) {
        try {
            localStorage.setItem(key, JSON.stringify(value));
            return true;
        } catch (error) {
            console.error(`Error writing to localStorage (key: ${key}):`, error);
            return false;
        }
    }

    removeItem(key) {
        try {
            localStorage.removeItem(key);
            return true;
        } catch (error) {
            console.error(`Error removing from localStorage (key: ${key}):`, error);
            return false;
        }
    }

    /**
     * Settings Management
     */
    getSettings() {
        return this.getItem(this.storageKeys.SETTINGS);
    }

    saveSettings(settings) {
        const mergedSettings = { ...this.defaultSettings, ...settings };
        return this.setItem(this.storageKeys.SETTINGS, mergedSettings);
    }

    updateSetting(key, value) {
        const settings = this.getSettings() || {};
        settings[key] = value;
        return this.saveSettings(settings);
    }

    resetSettings() {
        return this.saveSettings(this.defaultSettings);
    }

    /**
     * Statistics Management
     */
    getStatistics() {
        return this.getItem(this.storageKeys.STATISTICS);
    }

    saveStatistics(stats) {
        return this.setItem(this.storageKeys.STATISTICS, stats);
    }

    updateStatistics(updates) {
        const stats = this.getStatistics() || this.defaultStatistics;
        const updatedStats = { ...stats, ...updates };
        return this.saveStatistics(updatedStats);
    }

    addSessionData(sessionData) {
        const stats = this.getStatistics() || this.defaultStatistics;
        const today = new Date().toDateString();

        // Update overall statistics
        stats.totalSessions++;
        stats.totalTime += sessionData.duration;
        stats.totalGoodPostureTime += sessionData.goodPostureTime;
        stats.averagePostureScore = this.calculateAverageScore(stats, sessionData.averageScore);
        stats.lastSessionDate = new Date().toISOString();

        // Update daily statistics
        if (!stats.dailyStats[today]) {
            stats.dailyStats[today] = {
                sessions: 0,
                totalTime: 0,
                goodPostureTime: 0,
                averageScore: 0,
                postureEvents: []
            };
        }

        const dayStats = stats.dailyStats[today];
        dayStats.sessions++;
        dayStats.totalTime += sessionData.duration;
        dayStats.goodPostureTime += sessionData.goodPostureTime;
        dayStats.averageScore = this.calculateAverageScore(dayStats, sessionData.averageScore);
        dayStats.postureEvents.push(...sessionData.postureEvents);

        // Update streak
        stats.streakDays = this.calculateStreak(stats.dailyStats);

        return this.saveStatistics(stats);
    }

    calculateAverageScore(stats, newScore) {
        if (stats.totalSessions === 0) return newScore;
        return (stats.averagePostureScore * stats.totalSessions + newScore) / (stats.totalSessions + 1);
    }

    calculateStreak(dailyStats) {
        const dates = Object.keys(dailyStats).sort().reverse();
        let streak = 0;
        const today = new Date().toDateString();

        for (const date of dates) {
            if (date === today || this.isConsecutiveDay(dates[streak], date)) {
                streak++;
            } else {
                break;
            }
        }

        return streak;
    }

    isConsecutiveDay(date1, date2) {
        const d1 = new Date(date1);
        const d2 = new Date(date2);
        const diffTime = Math.abs(d2 - d1);
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        return diffDays === 1;
    }

    /**
     * Session Data Management
     */
    saveSessionData(sessionData) {
        return this.setItem(this.storageKeys.SESSION_DATA, sessionData);
    }

    getSessionData() {
        return this.getItem(this.storageKeys.SESSION_DATA);
    }

    clearSessionData() {
        return this.removeItem(this.storageKeys.SESSION_DATA);
    }

    /**
     * Achievements Management
     */
    getAchievements() {
        return this.getItem(this.storageKeys.ACHIEVEMENTS) || [];
    }

    saveAchievements(achievements) {
        return this.setItem(this.storageKeys.ACHIEVEMENTS, achievements);
    }

    unlockAchievement(achievementId) {
        const achievements = this.getAchievements();
        const achievement = {
            id: achievementId,
            unlockedAt: new Date().toISOString(),
            isNew: true
        };

        if (!achievements.find(a => a.id === achievementId)) {
            achievements.push(achievement);
            this.saveAchievements(achievements);
            return true;
        }
        return false;
    }

    markAchievementAsViewed(achievementId) {
        const achievements = this.getAchievements();
        const achievement = achievements.find(a => a.id === achievementId);
        if (achievement) {
            achievement.isNew = false;
            this.saveAchievements(achievements);
        }
    }

    /**
     * Data Export/Import
     */
    exportData() {
        const data = {
            settings: this.getSettings(),
            statistics: this.getStatistics(),
            achievements: this.getAchievements(),
            exportDate: new Date().toISOString(),
            version: '1.0.0'
        };

        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);

        const a = document.createElement('a');
        a.href = url;
        a.download = `posture-guardian-data-${new Date().toISOString().split('T')[0]}.json`;
        a.click();

        URL.revokeObjectURL(url);
    }

    async importData(file) {
        try {
            const text = await file.text();
            const data = JSON.parse(text);

            if (data.settings) {
                this.saveSettings(data.settings);
            }

            if (data.statistics) {
                this.saveStatistics(data.statistics);
            }

            if (data.achievements) {
                this.saveAchievements(data.achievements);
            }

            return true;
        } catch (error) {
            console.error('Error importing data:', error);
            return false;
        }
    }

    /**
     * Data Cleanup and Maintenance
     */
    cleanupOldData() {
        const stats = this.getStatistics();
        if (!stats || !stats.dailyStats) return;

        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - 90); // Keep 90 days of data

        Object.keys(stats.dailyStats).forEach(dateStr => {
            const date = new Date(dateStr);
            if (date < cutoffDate) {
                delete stats.dailyStats[dateStr];
            }
        });

        this.saveStatistics(stats);
    }

    /**
     * Analytics and Insights
     */
    getPostureInsights() {
        const stats = this.getStatistics();
        if (!stats) return null;

        const totalTime = stats.totalTime;
        const goodTime = stats.totalGoodPostureTime;
        const posturePercentage = totalTime > 0 ? (goodTime / totalTime) * 100 : 0;

        const dailyStats = Object.values(stats.dailyStats || {});
        const recentSessions = dailyStats.slice(-7); // Last 7 days

        const weeklyAverage = recentSessions.length > 0 
            ? recentSessions.reduce((sum, day) => sum + day.averageScore, 0) / recentSessions.length
            : 0;

        return {
            overallPosturePercentage: Math.round(posturePercentage),
            averageScore: Math.round(stats.averagePostureScore),
            weeklyAverage: Math.round(weeklyAverage),
            totalSessions: stats.totalSessions,
            streakDays: stats.streakDays,
            totalHours: Math.round(totalTime / 3600),
            improvement: this.calculateImprovement(dailyStats)
        };
    }

    calculateImprovement(dailyStats) {
        if (dailyStats.length < 14) return 0; // Need at least 2 weeks of data

        const recent = dailyStats.slice(-7);
        const previous = dailyStats.slice(-14, -7);

        const recentAvg = recent.reduce((sum, day) => sum + day.averageScore, 0) / recent.length;
        const previousAvg = previous.reduce((sum, day) => sum + day.averageScore, 0) / previous.length;

        return Math.round(((recentAvg - previousAvg) / previousAvg) * 100);
    }

    /**
     * Storage Quota Management
     */
    getStorageInfo() {
        if ('storage' in navigator && 'estimate' in navigator.storage) {
            return navigator.storage.estimate();
        }
        return Promise.resolve({ quota: 0, usage: 0 });
    }

    async checkStorageSpace() {
        try {
            const { quota, usage } = await this.getStorageInfo();
            const usagePercentage = quota > 0 ? (usage / quota) * 100 : 0;

            if (usagePercentage > 80) {
                console.warn('Storage space is running low. Consider cleaning up old data.');
                this.cleanupOldData();
            }

            return { quota, usage, usagePercentage };
        } catch (error) {
            console.error('Error checking storage space:', error);
            return { quota: 0, usage: 0, usagePercentage: 0 };
        }
    }
}

// Export for use in other modules
window.DataStorage = DataStorage;
