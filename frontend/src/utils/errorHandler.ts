import { useMessageStore } from './messaging';

export class FrontendError extends Error {
  constructor(message, errorCode, details = null, userMessage = null) {
    super(message);
    this.errorCode = errorCode;
    this.details = details;
    this.userMessage = userMessage;
    this.timestamp = new Date().toISOString();
    this.name = 'FrontendError';
  }
}

const errorTypes = {
  // Network Errors
  NETWORK_ERROR: { code: 'NET001', message: 'Network connection failed', userMessage: 'Please check your internet connection and try again.' },
  TIMEOUT_ERROR: { code: 'NET002', message: 'Request timeout', userMessage: 'The request is taking too long. Please try again.' },
  SERVER_UNAVAILABLE: { code: 'NET003', message: 'Server unavailable', userMessage: 'The server is temporarily unavailable. Please try again later.' },
  
  // Authentication Errors
  AUTH_REQUIRED: { code: 'AUTH001', message: 'Authentication required', userMessage: 'Please log in to continue.' },
  SESSION_EXPIRED: { code: 'AUTH002', message: 'Session expired', userMessage: 'Your session has expired. Please log in again.' },
  PERMISSION_DENIED: { code: 'AUTH003', message: 'Permission denied', userMessage: 'You don\'t have permission to perform this action.' },
  
  // Validation Errors
  INVALID_INPUT: { code: 'VAL001', message: 'Invalid input', userMessage: 'Please check your input and try again.' },
  REQUIRED_FIELD: { code: 'VAL002', message: 'Required field missing', userMessage: 'Please fill in all required fields.' },
  INVALID_FORMAT: { code: 'VAL003', message: 'Invalid format', userMessage: 'The data format is incorrect. Please check and try again.' },
  
  // Assessment Errors
  ASSESSMENT_NOT_FOUND: { code: 'ASM001', message: 'Assessment not found', userMessage: 'The assessment could not be found.' },
  ASSESSMENT_EXPIRED: { code: 'ASM002', message: 'Assessment expired', userMessage: 'This assessment has expired and is no longer available.' },
  TIME_LIMIT_EXCEEDED: { code: 'ASM003', message: 'Time limit exceeded', userMessage: 'The time limit for this assessment has been exceeded.' },
  SUBMISSION_FAILED: { code: 'ASM004', message: 'Submission failed', userMessage: 'Failed to submit your assessment. Please try again.' },
  
  // Anti-Cheat Errors
  SECURITY_VIOLATION: { code: 'SEC001', message: 'Security violation', userMessage: 'A security violation was detected. Please follow the assessment rules.' },
  FULLSCREEN_REQUIRED: { code: 'SEC002', message: 'Fullscreen required', userMessage: 'Please switch to fullscreen mode to continue.' },
  TAB_SWITCH_DETECTED: { code: 'SEC003', message: 'Tab switch detected', userMessage: 'Tab switching is not allowed during the assessment.' },
  
  // File/Upload Errors
  FILE_TOO_LARGE: { code: 'FILE001', message: 'File too large', userMessage: 'The file is too large. Please select a smaller file.' },
  INVALID_FILE_TYPE: { code: 'FILE002', message: 'Invalid file type', userMessage: 'This file type is not supported.' },
  UPLOAD_FAILED: { code: 'FILE003', message: 'Upload failed', userMessage: 'File upload failed. Please try again.' },
  
  // System Errors
  UNEXPECTED_ERROR: { code: 'SYS001', message: 'Unexpected error', userMessage: 'An unexpected error occurred. Please try again.' },
  FEATURE_UNAVAILABLE: { code: 'SYS002', message: 'Feature unavailable', userMessage: 'This feature is currently unavailable.' },
  BROWSER_NOT_SUPPORTED: { code: 'SYS003', message: 'Browser not supported', userMessage: 'Your browser is not supported. Please use a modern browser.' }
};

// Error tracking and reporting
class ErrorTracker {
  constructor() {
    this.errors = [];
    this.maxErrors = 100;
    this.reportingEndpoint = '/api/errors/report';
  }

  addError(error, context = {}) {
    const errorEntry = {
      id: Date.now().toString(),
      timestamp: new Date().toISOString(),
      error: {
        name: error.name,
        message: error.message,
        stack: error.stack,
        errorCode: error.errorCode || 'UNKNOWN'
      },
      context: {
        url: window.location.href,
        userAgent: navigator.userAgent,
        timestamp: new Date().toISOString(),
        ...context
      }
    };

    this.errors.unshift(errorEntry);
    
    // Keep only recent errors
    if (this.errors.length > this.maxErrors) {
      this.errors = this.errors.slice(0, this.maxErrors);
    }

    // Report critical errors
    if (this.shouldReportError(error)) {
      this.reportError(errorEntry);
    }
  }

  shouldReportError(error) {
    // Don't report user errors or network issues
    const nonReportableCodes = ['AUTH001', 'VAL001', 'ASM002', 'SEC001'];
    return !nonReportableCodes.includes(error.errorCode);
  }

  async reportError(errorEntry) {
    try {
      await fetch(this.reportingEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(errorEntry),
      });
    } catch (reportError) {
      console.error('Failed to report error:', reportError);
    }
  }

  getRecentErrors(limit = 10) {
    return this.errors.slice(0, limit);
  }

  clearErrors() {
    this.errors = [];
  }
}

// Global error tracker instance
export const errorTracker = new ErrorTracker();

// Create frontend error
export const createFrontendError = (errorType, customMessage = null, details = null, context = {}) => {
  const error = errorTypes[errorType];
  const frontendError = new FrontendError(
    customMessage || error.message,
    error.code,
    details,
    error.userMessage
  );

  // Track the error
  errorTracker.addError(frontendError, context);

  return frontendError;
};

// Handle API errors
export const handleApiError = async (response, context = {}) => {
  let errorMessage = 'An error occurred';
  let errorCode = 'UNKNOWN';
  let details = null;

  try {
    const errorData = await response.json();
    errorMessage = errorData.error?.message || errorMessage;
    errorCode = errorData.error?.errorCode || errorCode;
    details = errorData.error?.details || details;
  } catch (parseError) {
    // Response is not JSON
    errorMessage = await response.text() || errorMessage;
  }

  const errorType = Object.keys(errorTypes).find(
    key => errorTypes[key].code === errorCode
  ) || 'UNEXPECTED_ERROR';

  return createFrontendError(errorType, errorMessage, details, {
    statusCode: response.status,
    url: response.url,
    ...context
  });
};

// Handle network errors
export const handleNetworkError = (error, context = {}) => {
  if (error.name === 'TypeError' && error.message.includes('fetch')) {
    return createFrontendError('NETWORK_ERROR', error.message, null, context);
  }
  
  if (error.name === 'AbortError') {
    return createFrontendError('TIMEOUT_ERROR', error.message, null, context);
  }

  return createFrontendError('UNEXPECTED_ERROR', error.message, null, context);
};

// Display error to user
export const displayError = (error, options = {}) => {
  const { showNotification = true, logToConsole = true, severity = 'error' } = options;

  if (logToConsole) {
    console.error('Error:', error);
  }

  if (showNotification && error.userMessage) {
    const { addNotification } = useMessageStore.getState();
    addNotification({
      type: severity,
      title: 'Error',
      message: error.userMessage,
      duration: 5000,
      dismissible: true
    });
  }
};

// Error boundary helper
export const logErrorToService = (error, errorInfo) => {
  const errorEntry = {
    timestamp: new Date().toISOString(),
    error: {
      name: error.name,
      message: error.message,
      stack: error.stack
    },
    errorInfo,
    context: {
      url: window.location.href,
      userAgent: navigator.userAgent
    }
  };

  errorTracker.addError(error, errorInfo);
  
  // Send to error reporting service in production
  if (process.env.NODE_ENV === 'production') {
    errorTracker.reportError(errorEntry);
  }
};

// Validation helpers
export const validateEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!email) {
    throw createFrontendError('REQUIRED_FIELD', 'Email is required');
  }
  if (!emailRegex.test(email)) {
    throw createFrontendError('INVALID_EMAIL', 'Invalid email format');
  }
  return true;
};

export const validatePassword = (password) => {
  if (!password) {
    throw createFrontendError('REQUIRED_FIELD', 'Password is required');
  }
  if (password.length < 8) {
    throw createFrontendError('INVALID_PASSWORD', 'Password must be at least 8 characters');
  }
  return true;
};

export const validateRequiredField = (value, fieldName) => {
  if (!value || (typeof value === 'string' && value.trim() === '')) {
    throw createFrontendError('REQUIRED_FIELD', `${fieldName} is required`);
  }
  return true;
};

// Error recovery suggestions
export const getErrorRecoverySuggestion = (error) => {
  const suggestions = {
    'AUTH001': 'Try logging in again or contact support if you continue to have issues.',
    'AUTH002': 'Please log in again to refresh your session.',
    'NET001': 'Check your internet connection and refresh the page.',
    'NET002': 'The server is taking too long to respond. Try again in a few moments.',
    'ASM002': 'Contact your instructor if you believe this is an error.',
    'SEC001': 'Please follow the assessment guidelines and avoid prohibited actions.',
    'SYS001': 'Try refreshing the page or clearing your browser cache.',
    'FILE001': 'Select a smaller file or compress your file before uploading.',
    'FILE002': 'Check the supported file formats and convert your file if necessary.'
  };

  return suggestions[error.errorCode] || 'If the problem persists, please contact support.';
};

// Global error handlers
export const setupGlobalErrorHandlers = () => {
  // Handle unhandled promise rejections
  window.addEventListener('unhandledrejection', (event) => {
    console.error('Unhandled promise rejection:', event.reason);
    const error = handleNetworkError(event.reason, { source: 'unhandledrejection' });
    displayError(error, { showNotification: false });
  });

  // Handle JavaScript errors
  window.addEventListener('error', (event) => {
    console.error('Global error:', event.error);
    const error = createFrontendError('UNEXPECTED_ERROR', event.message, {
      filename: event.filename,
      lineno: event.lineno,
      colno: event.colno
    });
    displayError(error, { showNotification: false });
  });
};