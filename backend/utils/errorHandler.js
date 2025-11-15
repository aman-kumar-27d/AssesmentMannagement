const logger = require('./logger');

class AppError extends Error {
  constructor(message, statusCode, errorCode, details = null) {
    super(message);
    this.statusCode = statusCode;
    this.errorCode = errorCode;
    this.details = details;
    this.isOperational = true;
    this.timestamp = new Date().toISOString();

    Error.captureStackTrace(this, this.constructor);
  }
}

const errorTypes = {
  // Authentication & Authorization Errors (4xx)
  UNAUTHORIZED: { code: 'AUTH001', message: 'Authentication required', statusCode: 401 },
  INVALID_CREDENTIALS: { code: 'AUTH002', message: 'Invalid username or password', statusCode: 401 },
  TOKEN_EXPIRED: { code: 'AUTH003', message: 'Session has expired', statusCode: 401 },
  INSUFFICIENT_PERMISSIONS: { code: 'AUTH004', message: 'Insufficient permissions', statusCode: 403 },
  ACCOUNT_LOCKED: { code: 'AUTH005', message: 'Account temporarily locked', statusCode: 423 },
  
  // Validation Errors (4xx)
  VALIDATION_ERROR: { code: 'VAL001', message: 'Invalid input data', statusCode: 400 },
  MISSING_REQUIRED_FIELD: { code: 'VAL002', message: 'Required field is missing', statusCode: 400 },
  INVALID_FORMAT: { code: 'VAL003', message: 'Invalid data format', statusCode: 400 },
  INVALID_EMAIL: { code: 'VAL004', message: 'Invalid email address', statusCode: 400 },
  INVALID_PASSWORD: { code: 'VAL005', message: 'Password does not meet requirements', statusCode: 400 },
  
  // Resource Errors (4xx)
  RESOURCE_NOT_FOUND: { code: 'RES001', message: 'Requested resource not found', statusCode: 404 },
  RESOURCE_ALREADY_EXISTS: { code: 'RES002', message: 'Resource already exists', statusCode: 409 },
  RESOURCE_CONFLICT: { code: 'RES003', message: 'Resource conflict detected', statusCode: 409 },
  
  // Assessment Errors (4xx)
  ASSESSMENT_NOT_FOUND: { code: 'ASM001', message: 'Assessment not found', statusCode: 404 },
  ASSESSMENT_EXPIRED: { code: 'ASM002', message: 'Assessment has expired', statusCode: 410 },
  ASSESSMENT_NOT_STARTED: { code: 'ASM003', message: 'Assessment has not started yet', statusCode: 403 },
  ASSESSMENT_ALREADY_SUBMITTED: { code: 'ASM004', message: 'Assessment already submitted', statusCode: 409 },
  INVALID_ANSWER_FORMAT: { code: 'ASM005', message: 'Invalid answer format', statusCode: 400 },
  TIME_LIMIT_EXCEEDED: { code: 'ASM006', message: 'Time limit exceeded', statusCode: 408 },
  
  // Anti-Cheat Errors (4xx)
  ANTI_CHEAT_VIOLATION: { code: 'AC001', message: 'Security violation detected', statusCode: 403 },
  FULLSCREEN_REQUIRED: { code: 'AC002', message: 'Fullscreen mode required', statusCode: 403 },
  TAB_SWITCH_DETECTED: { code: 'AC003', message: 'Tab switching detected', statusCode: 403 },
  COPY_PASTE_DETECTED: { code: 'AC004', message: 'Copy/paste activity detected', statusCode: 403 },
  
  // Rate Limiting Errors (4xx)
  RATE_LIMIT_EXCEEDED: { code: 'RATE001', message: 'Too many requests', statusCode: 429 },
  
  // Server Errors (5xx)
  INTERNAL_SERVER_ERROR: { code: 'SRV001', message: 'Internal server error', statusCode: 500 },
  DATABASE_ERROR: { code: 'SRV002', message: 'Database operation failed', statusCode: 500 },
  SERVICE_UNAVAILABLE: { code: 'SRV003', message: 'Service temporarily unavailable', statusCode: 503 },
  MAINTENANCE_MODE: { code: 'SRV004', message: 'System under maintenance', statusCode: 503 },
  
  // Third-Party Service Errors (5xx)
  EMAIL_SERVICE_ERROR: { code: 'EXT001', message: 'Email service unavailable', statusCode: 503 },
  STORAGE_SERVICE_ERROR: { code: 'EXT002', message: 'File storage service error', statusCode: 503 },
  
  // Security Errors (4xx/5xx)
  SUSPICIOUS_ACTIVITY: { code: 'SEC001', message: 'Suspicious activity detected', statusCode: 403 },
  IP_BLOCKED: { code: 'SEC002', message: 'IP address blocked', statusCode: 403 },
  XSS_DETECTED: { code: 'SEC003', message: 'Malicious content detected', statusCode: 400 },
  SQL_INJECTION_DETECTED: { code: 'SEC004', message: 'Invalid input detected', statusCode: 400 }
};

const createError = (errorType, customMessage = null, details = null) => {
  const error = errorTypes[errorType];
  return new AppError(
    customMessage || error.message,
    error.statusCode,
    error.code,
    details
  );
};

const handleCastErrorDB = (err) => {
  const message = `Invalid ${err.path}: ${err.value}`;
  return createError('VALIDATION_ERROR', message, { field: err.path, value: err.value });
};

const handleDuplicateFieldsDB = (err) => {
  const field = Object.keys(err.keyValue)[0];
  const value = err.keyValue[field];
  const message = `${field} '${value}' is already taken`;
  return createError('RESOURCE_ALREADY_EXISTS', message, { field, value });
};

const handleValidationErrorDB = (err) => {
  const errors = Object.values(err.errors).map(el => ({
    field: el.path,
    message: el.message,
    value: el.value
  }));
  
  return createError('VALIDATION_ERROR', 'Validation failed', errors);
};

const handleJWTError = () => 
  createError('TOKEN_EXPIRED', 'Invalid token. Please log in again!');

const handleJWTExpiredError = () => 
  createError('TOKEN_EXPIRED', 'Your token has expired! Please log in again.');

const handleMulterError = (err) => {
  if (err.code === 'LIMIT_FILE_SIZE') {
    return createError('VALIDATION_ERROR', 'File too large');
  }
  if (err.code === 'LIMIT_FILE_TYPE') {
    return createError('VALIDATION_ERROR', 'Invalid file type');
  }
  return createError('VALIDATION_ERROR', err.message);
};

const sendErrorDev = (err, req, res) => {
  logger.error('Development Error:', {
    error: err,
    url: req.originalUrl,
    method: req.method,
    ip: req.ip,
    userAgent: req.get('user-agent'),
    timestamp: new Date().toISOString()
  });

  res.status(err.statusCode).json({
    status: 'error',
    error: {
      message: err.message,
      errorCode: err.errorCode,
      details: err.details,
      stack: err.stack,
      timestamp: err.timestamp
    },
    request: {
      method: req.method,
      url: req.originalUrl,
      timestamp: new Date().toISOString()
    }
  });
};

const sendErrorProd = (err, req, res) => {
  // Log error for monitoring
  logger.error('Production Error:', {
    errorCode: err.errorCode,
    message: err.message,
    url: req.originalUrl,
    method: req.method,
    ip: req.ip,
    userAgent: req.get('user-agent'),
    details: err.details,
    timestamp: err.timestamp
  });

  // Operational, trusted error: send message to client
  if (err.isOperational) {
    return res.status(err.statusCode).json({
      status: 'error',
      error: {
        message: err.message,
        errorCode: err.errorCode,
        details: err.details
      },
      request: {
        timestamp: new Date().toISOString()
      }
    });
  }

  // Programming or other unknown error: don't leak error details
  logger.error('Programming Error:', {
    error: err,
    message: 'Non-operational error occurred',
    stack: err.stack,
    timestamp: new Date().toISOString()
  });

  // Send generic message
  res.status(500).json({
    status: 'error',
    error: {
      message: 'Something went wrong!',
      errorCode: 'SRV001'
    },
    request: {
      timestamp: new Date().toISOString()
    }
  });
};

const globalErrorHandler = (err, req, res, next) => {
  err.statusCode = err.statusCode || 500;
  err.status = err.status || 'error';

  if (process.env.NODE_ENV === 'development') {
    sendErrorDev(err, req, res);
  } else {
    let error = { ...err };
    error.message = err.message;

    // Handle specific error types
    if (error.name === 'CastError') error = handleCastErrorDB(error);
    if (error.code === 11000) error = handleDuplicateFieldsDB(error);
    if (error.name === 'ValidationError') error = handleValidationErrorDB(error);
    if (error.name === 'JsonWebTokenError') error = handleJWTError();
    if (error.name === 'TokenExpiredError') error = handleJWTExpiredError();
    if (error.name === 'MulterError') error = handleMulterError(error);

    sendErrorProd(error, req, res);
  }
};

const catchAsync = (fn) => {
  return (req, res, next) => {
    fn(req, res, next).catch(next);
  };
};

const notFound = (req, res, next) => {
  const err = createError('RESOURCE_NOT_FOUND', `Can't find ${req.originalUrl} on this server!`);
  next(err);
};

module.exports = {
  AppError,
  createError,
  errorTypes,
  globalErrorHandler,
  catchAsync,
  notFound
};