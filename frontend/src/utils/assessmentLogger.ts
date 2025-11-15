export interface ErrorLogEntry {
  id: string;
  timestamp: Date;
  level: 'error' | 'warn' | 'info' | 'debug';
  message: string;
  details?: any;
  userId?: string;
  assessmentId?: string;
  context?: string;
  stack?: string;
}

export class AssessmentErrorLogger {
  private static instance: AssessmentErrorLogger;
  private logs: ErrorLogEntry[] = [];
  private maxLogs = 100;
  private enableConsole = true;
  private enableStorage = true;

  private constructor() {
    // Load existing logs from localStorage if available
    if (typeof window !== 'undefined') {
      this.loadFromStorage();
    }
  }

  public static getInstance(): AssessmentErrorLogger {
    if (!AssessmentErrorLogger.instance) {
      AssessmentErrorLogger.instance = new AssessmentErrorLogger();
    }
    return AssessmentErrorLogger.instance;
  }

  private generateId(): string {
    return `error_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private log(level: ErrorLogEntry['level'], message: string, details?: any, context?: string) {
    const entry: ErrorLogEntry = {
      id: this.generateId(),
      timestamp: new Date(),
      level,
      message,
      details,
      context,
    };

    // Add stack trace for errors
    if (level === 'error' && details instanceof Error) {
      entry.stack = details.stack;
    }

    this.logs.push(entry);

    // Maintain log size limit
    if (this.logs.length > this.maxLogs) {
      this.logs = this.logs.slice(-this.maxLogs);
    }

    // Console logging
    if (this.enableConsole) {
      this.logToConsole(entry);
    }

    // Storage logging
    if (this.enableStorage && typeof window !== 'undefined') {
      this.saveToStorage();
    }

    return entry;
  }

  private logToConsole(entry: ErrorLogEntry) {
    const logMessage = `[Assessment] ${entry.level.toUpperCase()}: ${entry.message}`;
    const logData = {
      timestamp: entry.timestamp.toISOString(),
      details: entry.details,
      context: entry.context,
      stack: entry.stack,
    };

    switch (entry.level) {
      case 'error':
        console.error(logMessage, logData);
        break;
      case 'warn':
        console.warn(logMessage, logData);
        break;
      case 'info':
        console.info(logMessage, logData);
        break;
      case 'debug':
        console.debug(logMessage, logData);
        break;
    }
  }

  private saveToStorage() {
    try {
      localStorage.setItem('assessment_error_logs', JSON.stringify(this.logs));
    } catch (error) {
      console.warn('Failed to save error logs to localStorage:', error);
    }
  }

  private loadFromStorage() {
    try {
      const stored = localStorage.getItem('assessment_error_logs');
      if (stored) {
        const parsed = JSON.parse(stored);
        // Convert date strings back to Date objects
        this.logs = parsed.map((entry: any) => ({
          ...entry,
          timestamp: new Date(entry.timestamp),
        }));
      }
    } catch (error) {
      console.warn('Failed to load error logs from localStorage:', error);
    }
  }

  // Public logging methods
  public error(message: string, details?: any, context?: string) {
    return this.log('error', message, details, context);
  }

  public warn(message: string, details?: any, context?: string) {
    return this.log('warn', message, details, context);
  }

  public info(message: string, details?: any, context?: string) {
    return this.log('info', message, details, context);
  }

  public debug(message: string, details?: any, context?: string) {
    return this.log('debug', message, details, context);
  }

  // Assessment-specific logging
  public logAssessmentError(assessmentId: string, userId: string, error: Error, context?: string) {
    return this.error(`Assessment error for ${assessmentId}`, {
      error: error.message,
      assessmentId,
      userId,
      stack: error.stack,
    }, context || 'assessment');
  }

  public logSubmissionError(assessmentId: string, userId: string, error: any, details?: any) {
    return this.error(`Submission failed for assessment ${assessmentId}`, {
      error: error.message || error,
      assessmentId,
      userId,
      details,
    }, 'submission');
  }

  public logTimerError(assessmentId: string, userId: string, error: Error) {
    return this.error(`Timer error for assessment ${assessmentId}`, {
      error: error.message,
      assessmentId,
      userId,
      stack: error.stack,
    }, 'timer');
  }

  public logAntiCheatViolation(assessmentId: string, userId: string, violation: any) {
    return this.warn(`Anti-cheat violation detected for assessment ${assessmentId}`, {
      assessmentId,
      userId,
      violation,
    }, 'anti-cheat');
  }

  public logFullscreenError(assessmentId: string, userId: string, error: Error, action: string) {
    return this.error(`Fullscreen ${action} error for assessment ${assessmentId}`, {
      error: error.message,
      assessmentId,
      userId,
      action,
      stack: error.stack,
    }, 'fullscreen');
  }

  public logAssessmentEvent(assessmentId: string, userId: string, eventType: string, details?: string) {
    return this.info(`Assessment event: ${eventType} for ${assessmentId}`, {
      assessmentId,
      userId,
      eventType,
      details,
    }, 'assessment-event');
  }

  // Alias methods for compatibility with tests
  public logInfo(message: string, context?: any) {
    return this.info(message, context);
  }

  public logWarning(message: string, context?: any) {
    return this.warn(message, context);
  }

  public logError(message: string, error?: any, context?: any) {
    return this.error(message, error, context);
  }

  // Utility methods
  public getLogs(level?: ErrorLogEntry['level'], limit?: number): ErrorLogEntry[] {
    let filtered = this.logs;
    
    if (level) {
      filtered = filtered.filter(log => log.level === level);
    }
    
    if (limit) {
      filtered = filtered.slice(-limit);
    }
    
    return [...filtered]; // Return a copy
  }

  public getRecentErrors(limit: number = 10): ErrorLogEntry[] {
    return this.getLogs('error', limit);
  }

  public clearLogs() {
    this.logs = [];
    if (this.enableStorage && typeof window !== 'undefined') {
      localStorage.removeItem('assessment_error_logs');
    }
  }

  public exportLogs(): string {
    return JSON.stringify(this.logs, null, 2);
  }

  public setConsoleLogging(enabled: boolean) {
    this.enableConsole = enabled;
  }

  public setStorageLogging(enabled: boolean) {
    this.enableStorage = enabled;
    if (enabled) {
      this.saveToStorage();
    } else {
      localStorage.removeItem('assessment_error_logs');
    }
  }
}

// Export singleton instance
export const assessmentLogger = AssessmentErrorLogger.getInstance();

// Convenience functions
export const logAssessmentError = (assessmentId: string, userId: string, error: Error, context?: string) => {
  return assessmentLogger.logAssessmentError(assessmentId, userId, error, context);
};

export const logSubmissionError = (assessmentId: string, userId: string, error: any, details?: any) => {
  return assessmentLogger.logSubmissionError(assessmentId, userId, error, details);
};

export const logTimerError = (assessmentId: string, userId: string, error: Error) => {
  return assessmentLogger.logTimerError(assessmentId, userId, error);
};

export const logAntiCheatViolation = (assessmentId: string, userId: string, violation: any) => {
  return assessmentLogger.logAntiCheatViolation(assessmentId, userId, violation);
};

export const logFullscreenError = (assessmentId: string, userId: string, error: Error, action: string) => {
  return assessmentLogger.logFullscreenError(assessmentId, userId, error, action);
};