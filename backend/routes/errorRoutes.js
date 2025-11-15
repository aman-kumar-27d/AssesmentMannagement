const express = require('express');
const rateLimit = require('express-rate-limit');
const { body, validationResult } = require('express-validator');
const logger = require('../utils/logger');
const { createError, catchAsync } = require('../utils/errorHandler');

const router = express.Router();

// Rate limiting for error reporting
const errorReportLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 50, // limit each IP to 50 requests per windowMs
  message: 'Too many error reports from this IP'
});

// Validation middleware
const validateErrorReport = [
  body('error.name').optional().isString().isLength({ max: 100 }),
  body('error.message').optional().isString().isLength({ max: 1000 }),
  body('error.stack').optional().isString().isLength({ max: 5000 }),
  body('error.errorCode').optional().isString().isLength({ max: 20 }),
  body('context.url').optional().isURL(),
  body('context.userAgent').optional().isString().isLength({ max: 500 }),
  body('context.timestamp').optional().isISO8601(),
  body('errorInfo').optional().isObject()
];

// Error report model
const ErrorReport = require('../models/ErrorReport');

// POST /api/errors/report - Report frontend errors
router.post('/report', 
  errorReportLimiter,
  validateErrorReport,
  catchAsync(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw createError('VALIDATION_ERROR', 'Invalid error report data', errors.array());
    }

    const { error, context, errorInfo } = req.body;
    const userId = req.user?.id || null;
    const ip = req.ip;
    const userAgent = req.get('user-agent');

    // Sanitize error data to prevent injection
    const sanitizedError = {
      name: error?.name?.substring(0, 100) || 'UnknownError',
      message: error?.message?.substring(0, 1000) || 'No message provided',
      stack: error?.stack?.substring(0, 5000) || '',
      errorCode: error?.errorCode?.substring(0, 20) || 'UNKNOWN'
    };

    const sanitizedContext = {
      url: context?.url?.substring(0, 500) || req.headers.referer || 'Unknown',
      userAgent: context?.userAgent?.substring(0, 500) || userAgent || 'Unknown',
      timestamp: context?.timestamp || new Date().toISOString()
    };

    // Create error report
    const errorReport = new ErrorReport({
      userId,
      error: sanitizedError,
      context: sanitizedContext,
      errorInfo: errorInfo || {},
      ipAddress: ip,
      userAgent,
      timestamp: new Date()
    });

    await errorReport.save();

    // Log the error for immediate attention
    logger.error('Frontend Error Reported:', {
      errorCode: sanitizedError.errorCode,
      message: sanitizedError.message,
      userId,
      ip,
      url: sanitizedContext.url,
      timestamp: sanitizedContext.timestamp
    });

    // Check for critical errors that need immediate attention
    if (isCriticalError(sanitizedError)) {
      logger.critical('Critical Frontend Error Detected:', {
        errorCode: sanitizedError.errorCode,
        message: sanitizedError.message,
        userId,
        ip,
        url: sanitizedContext.url
      });
    }

    res.status(201).json({
      status: 'success',
      message: 'Error report received',
      data: {
        reportId: errorReport._id,
        acknowledged: true
      }
    });
  })
);

// GET /api/errors/reports - Get error reports (admin only)
router.get('/reports',
  catchAsync(async (req, res) => {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const skip = (page - 1) * limit;

    const filter = {};
    
    // Filter by error code
    if (req.query.errorCode) {
      filter['error.errorCode'] = req.query.errorCode;
    }

    // Filter by user
    if (req.query.userId) {
      filter.userId = req.query.userId;
    }

    // Filter by date range
    if (req.query.startDate || req.query.endDate) {
      filter.timestamp = {};
      if (req.query.startDate) {
        filter.timestamp.$gte = new Date(req.query.startDate);
      }
      if (req.query.endDate) {
        filter.timestamp.$lte = new Date(req.query.endDate);
      }
    }

    // Filter by critical errors
    if (req.query.critical === 'true') {
      filter['error.errorCode'] = { $in: getCriticalErrorCodes() };
    }

    const [reports, total] = await Promise.all([
      ErrorReport.find(filter)
        .populate('userId', 'name email')
        .sort({ timestamp: -1 })
        .skip(skip)
        .limit(limit),
      ErrorReport.countDocuments(filter)
    ]);

    res.status(200).json({
      status: 'success',
      data: {
        reports,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit)
        }
      }
    });
  })
);

// GET /api/errors/stats - Get error statistics
router.get('/stats',
  catchAsync(async (req, res) => {
    const timeRange = parseInt(req.query.timeRange) || 24; // hours
    const startDate = new Date(Date.now() - timeRange * 60 * 60 * 1000);

    const stats = await ErrorReport.aggregate([
      {
        $match: {
          timestamp: { $gte: startDate }
        }
      },
      {
        $group: {
          _id: {
            errorCode: '$error.errorCode',
            hour: { $hour: '$timestamp' }
          },
          count: { $sum: 1 },
          uniqueUsers: { $addToSet: '$userId' }
        }
      },
      {
        $project: {
          errorCode: '$_id.errorCode',
          hour: '$_id.hour',
          count: 1,
          uniqueUserCount: { $size: '$uniqueUsers' }
        }
      },
      {
        $sort: { count: -1 }
      }
    ]);

    const hourlyStats = await ErrorReport.aggregate([
      {
        $match: {
          timestamp: { $gte: startDate }
        }
      },
      {
        $group: {
          _id: { $hour: '$timestamp' },
          totalErrors: { $sum: 1 },
          criticalErrors: {
            $sum: {
              $cond: [
                { $in: ['$error.errorCode', getCriticalErrorCodes()] },
                1,
                0
              ]
            }
          }
        }
      },
      {
        $sort: { _id: 1 }
      }
    ]);

    res.status(200).json({
      status: 'success',
      data: {
        stats,
        hourlyStats,
        timeRange: `${timeRange}h`,
        generatedAt: new Date().toISOString()
      }
    });
  })
);

// DELETE /api/errors/reports/:id - Delete error report
router.delete('/reports/:id',
  catchAsync(async (req, res) => {
    const report = await ErrorReport.findByIdAndDelete(req.params.id);
    
    if (!report) {
      throw createError('RESOURCE_NOT_FOUND', 'Error report not found');
    }

    res.status(204).json({
      status: 'success',
      data: null
    });
  })
);

// Helper functions
function isCriticalError(error) {
  const criticalCodes = [
    'SRV001', 'SRV002', 'SRV003', // Server errors
    'SEC001', 'SEC002', 'SEC003', 'SEC004', // Security errors
    'DATABASE_ERROR', 'EMAIL_SERVICE_ERROR', 'STORAGE_SERVICE_ERROR' // Service errors
  ];
  
  return criticalCodes.includes(error.errorCode);
}

function getCriticalErrorCodes() {
  return [
    'SRV001', 'SRV002', 'SRV003',
    'SEC001', 'SEC002', 'SEC003', 'SEC004',
    'DATABASE_ERROR', 'EMAIL_SERVICE_ERROR', 'STORAGE_SERVICE_ERROR'
  ];
}

module.exports = router;