import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { assessmentLogger, AssessmentErrorLogger } from '../assessmentLogger';

describe('AssessmentLogger', () => {
  beforeEach(() => {
    // Clear session storage and mocks before each test
    localStorage.clear();
    sessionStorage.clear();
    vi.clearAllMocks();
    
    // Mock console methods
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'info').mockImplementation(() => {});
    vi.spyOn(console, 'debug').mockImplementation(() => {});
    
    // Clear any existing logs
    assessmentLogger.clearLogs();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('error', () => {
    it('should log error with context', () => {
      const context = 'test-context';
      const error = new Error('Test error');
      
      assessmentLogger.error('Test error message', error, context);
      
      expect(console.error).toHaveBeenCalledWith(
        '[Assessment] ERROR: Test error message',
        expect.objectContaining({
          details: error,
          context,
          timestamp: expect.any(String)
        })
      );
    });

    it('should store error in local storage', () => {
      const context = 'test-context';
      const error = new Error('Test error');
      
      assessmentLogger.error('Test error message', error, context);
      
      const storedLogs = localStorage.getItem('assessment_error_logs');
      expect(storedLogs).toBeTruthy();
      
      const logs = JSON.parse(storedLogs!);
      expect(logs.length).toBeGreaterThan(0);
      const lastLog = logs[logs.length - 1];
      expect(lastLog).toMatchObject({
        level: 'error',
        message: 'Test error message',
        context,
        timestamp: expect.any(String)
      });
    });
  });

  describe('warn', () => {
    it('should log warning with context', () => {
      const context = 'test-context';
      
      assessmentLogger.warn('Test warning message', context);
      
      expect(console.warn).toHaveBeenCalledWith(
        '[Assessment] WARN: Test warning message',
        expect.objectContaining({
          context,
          timestamp: expect.any(String)
        })
      );
    });

    it('should store warning in local storage', () => {
      const context = 'test-context';
      
      assessmentLogger.warn('Test warning message', context);
      
      const storedLogs = localStorage.getItem('assessment_error_logs');
      expect(storedLogs).toBeTruthy();
      
      const logs = JSON.parse(storedLogs!);
      expect(logs.length).toBeGreaterThan(0);
      const lastLog = logs[logs.length - 1];
      expect(lastLog).toMatchObject({
        level: 'warn',
        message: 'Test warning message',
        context,
        timestamp: expect.any(String)
      });
    });
  });

  describe('info', () => {
    it('should log info with context', () => {
      const context = 'test-context';
      
      assessmentLogger.info('Test info message', context);
      
      expect(console.info).toHaveBeenCalledWith(
        '[Assessment] INFO: Test info message',
        expect.objectContaining({
          context,
          timestamp: expect.any(String)
        })
      );
    });

    it('should store info in local storage', () => {
      const context = 'test-context';
      
      assessmentLogger.info('Test info message', context);
      
      const storedLogs = localStorage.getItem('assessment_error_logs');
      expect(storedLogs).toBeTruthy();
      
      const logs = JSON.parse(storedLogs!);
      expect(logs.length).toBeGreaterThan(0);
      const lastLog = logs[logs.length - 1];
      expect(lastLog).toMatchObject({
        level: 'info',
        message: 'Test info message',
        context,
        timestamp: expect.any(String)
      });
    });
  });

  describe('logSubmissionError', () => {
    it('should log submission error with detailed context', () => {
      const error = new Error('Submission failed');
      const metadata = {
        timeRemaining: 300,
        tabSwitches: 2,
        violations: 1,
        activities: 5
      };
      
      assessmentLogger.logSubmissionError('ass123', 'user456', error, metadata);
      
      expect(console.error).toHaveBeenCalledWith(
        '[Assessment] ERROR: Submission failed for assessment ass123',
        expect.objectContaining({
          details: {
            error: 'Submission failed',
            assessmentId: 'ass123',
            userId: 'user456',
            details: metadata
          },
          context: 'submission',
          timestamp: expect.any(String)
        })
      );
    });
  });

  describe('logAssessmentError', () => {
    it('should log assessment error with context', () => {
      const error = new Error('Assessment loading failed');
      
      assessmentLogger.logAssessmentError('ass123', 'user456', error);
      
      expect(console.error).toHaveBeenCalledWith(
        '[Assessment] ERROR: Assessment error for ass123',
        expect.objectContaining({
          details: {
            error: 'Assessment loading failed',
            assessmentId: 'ass123',
            userId: 'user456',
            stack: error.stack
          },
          context: 'assessment',
          timestamp: expect.any(String)
        })
      );
    });
  });

  describe('logAntiCheatViolation', () => {
    it('should log anti-cheat violation with details', () => {
      const violation = {
        type: 'tab_switch',
        severity: 'high' as const,
        timestamp: new Date().toISOString(),
        details: 'User switched tabs 3 times'
      };
      
      assessmentLogger.logAntiCheatViolation('ass123', 'user456', violation);
      
      expect(console.warn).toHaveBeenCalledWith(
        '[Assessment] WARN: Anti-cheat violation detected for assessment ass123',
        expect.objectContaining({
          details: {
            assessmentId: 'ass123',
            userId: 'user456',
            violation
          },
          context: 'anti-cheat',
          timestamp: expect.any(String)
        })
      );
    });
  });

  describe('getLogs', () => {
    it('should return all logs from session storage', () => {
      const context = { assessmentId: 'test123', userId: 'user456' };
      
      assessmentLogger.logInfo('Info message', context);
      assessmentLogger.logWarning('Warning message', context);
      assessmentLogger.logError('Error message', new Error('Test'), context);
      
      const logs = assessmentLogger.getLogs();
      
      expect(logs).toHaveLength(3);
      expect(logs[0].level).toBe('info');
      expect(logs[1].level).toBe('warning');
      expect(logs[2].level).toBe('error');
    });

    it('should return empty array when no logs exist', () => {
      const logs = assessmentLogger.getLogs();
      expect(logs).toEqual([]);
    });
  });

  describe('clearLogs', () => {
    it('should clear all logs from session storage', () => {
      const context = { assessmentId: 'test123', userId: 'user456' };
      
      assessmentLogger.logInfo('Info message', context);
      assessmentLogger.logWarning('Warning message', context);
      
      expect(assessmentLogger.getLogs()).toHaveLength(2);
      
      assessmentLogger.clearLogs();
      
      expect(assessmentLogger.getLogs()).toHaveLength(0);
      expect(sessionStorage.getItem('assessment_logs')).toBe('[]');
    });
  });

  describe('exportLogs', () => {
    it('should export logs as formatted JSON string', () => {
      const context = { assessmentId: 'test123', userId: 'user456' };
      
      assessmentLogger.logInfo('Info message', context);
      assessmentLogger.logError('Error message', new Error('Test'), context);
      
      const exported = assessmentLogger.exportLogs();
      const parsed = JSON.parse(exported);
      
      expect(parsed).toHaveProperty('exportDate');
      expect(parsed).toHaveProperty('logs');
      expect(parsed.logs).toHaveLength(2);
      expect(parsed.logs[0].level).toBe('info');
      expect(parsed.logs[1].level).toBe('error');
    });
  });

  describe('log storage limits', () => {
    it('should maintain chronological order of logs', () => {
      const context = { assessmentId: 'test123', userId: 'user456' };
      
      assessmentLogger.logInfo('First message', context);
      
      // Small delay to ensure different timestamps
      vi.advanceTimersByTime(100);
      
      assessmentLogger.logWarning('Second message', context);
      
      vi.advanceTimersByTime(100);
      
      assessmentLogger.logError('Third message', new Error('Test'), context);
      
      const logs = assessmentLogger.getLogs();
      
      expect(logs[0].message).toBe('First message');
      expect(logs[1].message).toBe('Second message');
      expect(logs[2].message).toBe('Third message');
      
      // Verify timestamps are in ascending order
      for (let i = 1; i < logs.length; i++) {
        expect(new Date(logs[i].timestamp).getTime()).toBeGreaterThanOrEqual(
          new Date(logs[i-1].timestamp).getTime()
        );
      }
    });
  });

  describe('error handling', () => {
    it('should handle session storage errors gracefully', () => {
      // Mock sessionStorage.setItem to throw an error
      const originalSetItem = sessionStorage.setItem;
      sessionStorage.setItem = vi.fn(() => {
        throw new Error('Storage full');
      });
      
      const context = { assessmentId: 'test123', userId: 'user456' };
      
      // Should not throw when logging
      expect(() => {
        assessmentLogger.logInfo('Test message', context);
      }).not.toThrow();
      
      // Should still log to console
      expect(console.info).toHaveBeenCalled();
      
      // Restore original
      sessionStorage.setItem = originalSetItem;
    });

    it('should handle malformed session storage data', () => {
      // Set malformed JSON in session storage
      sessionStorage.setItem('assessment_logs', 'invalid json');
      
      const context = { assessmentId: 'test123', userId: 'user456' };
      
      // Should not throw when logging
      expect(() => {
        assessmentLogger.logInfo('Test message', context);
      }).not.toThrow();
      
      // Should create new log array
      const logs = assessmentLogger.getLogs();
      expect(logs).toHaveLength(1);
      expect(logs[0].message).toBe('Test message');
    });
  });
});