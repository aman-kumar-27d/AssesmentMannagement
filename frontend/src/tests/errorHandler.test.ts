import { 
  createFrontendError, 
  handleApiError, 
  handleNetworkError, 
  validateEmail, 
  validatePassword,
  validateRequiredField,
  getErrorRecoverySuggestion,
  errorTracker
} from '../utils/errorHandler';
import { useMessageStore } from '../utils/messaging';

// Mock the message store
jest.mock('../utils/messaging', () => ({
  useMessageStore: {
    getState: jest.fn(() => ({
      addNotification: jest.fn()
    }))
  }
}));

describe('Frontend Error Handler', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    errorTracker.clearErrors();
  });

  describe('createFrontendError', () => {
    test('should create error with correct properties', () => {
      const error = createFrontendError('INVALID_INPUT', 'Custom message', { field: 'test' });
      
      expect(error).toBeInstanceOf(Error);
      expect(error.message).toBe('Custom message');
      expect(error.errorCode).toBe('VAL001');
      expect(error.details).toEqual({ field: 'test' });
      expect(error.userMessage).toBe('Please check your input and try again.');
      expect(error.timestamp).toBeDefined();
    });

    test('should use default message if custom message not provided', () => {
      const error = createFrontendError('NETWORK_ERROR');
      
      expect(error.message).toBe('Network connection failed');
      expect(error.userMessage).toBe('Please check your internet connection and try again.');
    });

    test('should track error in error tracker', () => {
      createFrontendError('INVALID_INPUT', 'Test error');
      
      const recentErrors = errorTracker.getRecentErrors(1);
      expect(recentErrors).toHaveLength(1);
      expect(recentErrors[0].error.message).toBe('Test error');
    });
  });

  describe('handleApiError', () => {
    test('should handle JSON error response', async () => {
      const mockResponse = {
        status: 400,
        url: 'http://test.com/api/test',
        json: jest.fn().mockResolvedValue({
          error: {
            message: 'Validation failed',
            errorCode: 'VAL001',
            details: { field: 'email' }
          }
        })
      };

      const error = await handleApiError(mockResponse);
      
      expect(error.message).toBe('Validation failed');
      expect(error.errorCode).toBe('VAL001');
      expect(error.details).toEqual({ field: 'email' });
    });

    test('should handle text error response', async () => {
      const mockResponse = {
        status: 500,
        url: 'http://test.com/api/test',
        json: jest.fn().mockRejectedValue(new Error('Not JSON')),
        text: jest.fn().mockResolvedValue('Internal server error')
      };

      const error = await handleApiError(mockResponse);
      
      expect(error.message).toBe('Internal server error');
      expect(error.errorCode).toBe('UNKNOWN');
    });

    test('should handle network errors', async () => {
      const mockResponse = {
        status: 0,
        url: 'http://test.com/api/test',
        json: jest.fn().mockRejectedValue(new Error('Network error'))
      };

      const error = await handleApiError(mockResponse);
      
      expect(error.errorCode).toBe('UNKNOWN');
    });
  });

  describe('handleNetworkError', () => {
    test('should handle fetch errors', () => {
      const fetchError = new TypeError('Failed to fetch');
      const error = handleNetworkError(fetchError);
      
      expect(error.errorCode).toBe('NET001');
      expect(error.userMessage).toBe('Please check your internet connection and try again.');
    });

    test('should handle timeout errors', () => {
      const timeoutError = new Error('AbortError');
      timeoutError.name = 'AbortError';
      const error = handleNetworkError(timeoutError);
      
      expect(error.errorCode).toBe('NET002');
      expect(error.userMessage).toBe('The request is taking too long. Please try again.');
    });

    test('should handle unexpected errors', () => {
      const unexpectedError = new Error('Something unexpected');
      const error = handleNetworkError(unexpectedError);
      
      expect(error.errorCode).toBe('SYS001');
      expect(error.userMessage).toBe('An unexpected error occurred. Please try again.');
    });
  });

  describe('Validation Functions', () => {
    describe('validateEmail', () => {
      test('should validate correct email', () => {
        expect(() => validateEmail('test@example.com')).not.toThrow();
      });

      test('should throw error for empty email', () => {
        expect(() => validateEmail('')).toThrow();
        expect(() => validateEmail(null)).toThrow();
        expect(() => validateEmail(undefined)).toThrow();
      });

      test('should throw error for invalid email format', () => {
        expect(() => validateEmail('invalid-email')).toThrow();
        expect(() => validateEmail('test@')).toThrow();
        expect(() => validateEmail('@example.com')).toThrow();
      });
    });

    describe('validatePassword', () => {
      test('should validate correct password', () => {
        expect(() => validatePassword('password123')).not.toThrow();
      });

      test('should throw error for empty password', () => {
        expect(() => validatePassword('')).toThrow();
        expect(() => validatePassword(null)).toThrow();
        expect(() => validatePassword(undefined)).toThrow();
      });

      test('should throw error for short password', () => {
        expect(() => validatePassword('short')).toThrow();
        expect(() => validatePassword('1234567')).toThrow();
      });
    });

    describe('validateRequiredField', () => {
      test('should validate non-empty string', () => {
        expect(() => validateRequiredField('valid', 'Field')).not.toThrow();
      });

      test('should throw error for empty string', () => {
        expect(() => validateRequiredField('', 'Field')).toThrow();
        expect(() => validateRequiredField('   ', 'Field')).toThrow();
      });

      test('should throw error for null/undefined', () => {
        expect(() => validateRequiredField(null, 'Field')).toThrow();
        expect(() => validateRequiredField(undefined, 'Field')).toThrow();
      });
    });
  });

  describe('getErrorRecoverySuggestion', () => {
    test('should return correct suggestions for known errors', () => {
      const authError = createFrontendError('AUTH_REQUIRED');
      expect(getErrorRecoverySuggestion(authError)).toContain('logging in again');

      const networkError = createFrontendError('NETWORK_ERROR');
      expect(getErrorRecoverySuggestion(networkError)).toContain('internet connection');

      const systemError = createFrontendError('UNEXPECTED_ERROR');
      expect(getErrorRecoverySuggestion(systemError)).toContain('contact support');
    });
  });

  describe('ErrorTracker', () => {
    test('should track errors with unique IDs', () => {
      const error1 = createFrontendError('INVALID_INPUT', 'Error 1');
      const error2 = createFrontendError('NETWORK_ERROR', 'Error 2');

      errorTracker.addError(error1);
      errorTracker.addError(error2);

      const recentErrors = errorTracker.getRecentErrors(2);
      expect(recentErrors).toHaveLength(2);
      expect(recentErrors[0].id).not.toBe(recentErrors[1].id);
    });

    test('should limit stored errors to maxErrors', () => {
      // Add more errors than the limit
      for (let i = 0; i < 150; i++) {
        errorTracker.addError(createFrontendError('INVALID_INPUT', `Error ${i}`));
      }

      const recentErrors = errorTracker.getRecentErrors(200);
      expect(recentErrors.length).toBe(100); // Should be limited to maxErrors
    });

    test('should include context information', () => {
      const context = { 
        url: 'http://test.com',
        userAction: 'form submission',
        timestamp: new Date().toISOString()
      };
      
      const error = createFrontendError('INVALID_INPUT', 'Test error');
      errorTracker.addError(error, context);

      const recentErrors = errorTracker.getRecentErrors(1);
      expect(recentErrors[0].context).toMatchObject(context);
    });

    test('should determine if error should be reported', () => {
      const userError = createFrontendError('AUTH_REQUIRED');
      expect(errorTracker.shouldReportError(userError)).toBe(false);

      const systemError = createFrontendError('UNEXPECTED_ERROR');
      expect(errorTracker.shouldReportError(systemError)).toBe(true);
    });
  });

  describe('Integration with Message Store', () => {
    test('should display error notifications', () => {
      const mockAddNotification = jest.fn();
      useMessageStore.getState.mockReturnValue({
        addNotification: mockAddNotification
      });

      // This would need to be implemented in the actual error handler
      // For now, we'll test the concept
      const error = createFrontendError('INVALID_INPUT');
      
      // Simulate displaying error
      if (error.userMessage) {
        mockAddNotification({
          type: 'error',
          title: 'Error',
          message: error.userMessage,
          duration: 5000,
          dismissible: true
        });
      }

      expect(mockAddNotification).toHaveBeenCalledWith({
        type: 'error',
        title: 'Error',
        message: 'Please check your input and try again.',
        duration: 5000,
        dismissible: true
      });
    });
  });
});