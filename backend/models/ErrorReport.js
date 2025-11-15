const mongoose = require('mongoose');

const errorReportSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  error: {
    name: {
      type: String,
      required: true,
      maxlength: 100
    },
    message: {
      type: String,
      required: true,
      maxlength: 1000
    },
    stack: {
      type: String,
      maxlength: 5000,
      default: ''
    },
    errorCode: {
      type: String,
      maxlength: 20,
      default: 'UNKNOWN'
    }
  },
  context: {
    url: {
      type: String,
      maxlength: 500,
      default: 'Unknown'
    },
    userAgent: {
      type: String,
      maxlength: 500,
      default: 'Unknown'
    },
    timestamp: {
      type: String,
      required: true
    }
  },
  errorInfo: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  ipAddress: {
    type: String,
    required: true
  },
  userAgent: {
    type: String,
    maxlength: 500
  },
  timestamp: {
    type: Date,
    default: Date.now,
    index: true
  },
  resolved: {
    type: Boolean,
    default: false
  },
  severity: {
    type: String,
    enum: ['low', 'medium', 'high', 'critical'],
    default: 'medium'
  },
  tags: [{
    type: String,
    maxlength: 50
  }]
}, {
  timestamps: true,
  collection: 'error_reports'
});

// Indexes for efficient querying
errorReportSchema.index({ 'error.errorCode': 1, timestamp: -1 });
errorReportSchema.index({ userId: 1, timestamp: -1 });
errorReportSchema.index({ ipAddress: 1, timestamp: -1 });
errorReportSchema.index({ severity: 1, resolved: 1 });
errorReportSchema.index({ timestamp: -1 });

// Static methods
errorReportSchema.statics.getErrorStats = async function(timeRange = 24) {
  const startDate = new Date(Date.now() - timeRange * 60 * 60 * 1000);
  
  return this.aggregate([
    {
      $match: {
        timestamp: { $gte: startDate }
      }
    },
    {
      $group: {
        _id: '$error.errorCode',
        count: { $sum: 1 },
        uniqueUsers: { $addToSet: '$userId' },
        uniqueIPs: { $addToSet: '$ipAddress' },
        avgSeverity: { $avg: { $switch: {
          branches: [
            { case: { $eq: ['$severity', 'low'] }, then: 1 },
            { case: { $eq: ['$severity', 'medium'] }, then: 2 },
            { case: { $eq: ['$severity', 'high'] }, then: 3 },
            { case: { $eq: ['$severity', 'critical'] }, then: 4 }
          ],
          default: 2
        }}}
      }
    },
    {
      $project: {
        errorCode: '$_id',
        count: 1,
        uniqueUserCount: { $size: '$uniqueUsers' },
        uniqueIPCount: { $size: '$uniqueIPs' },
        avgSeverity: { $round: ['$avgSeverity', 1] }
      }
    },
    {
      $sort: { count: -1 }
    }
  ]);
};

errorReportSchema.statics.getUserErrorTrend = async function(userId, timeRange = 7) {
  const startDate = new Date(Date.now() - timeRange * 24 * 60 * 60 * 1000);
  
  return this.aggregate([
    {
      $match: {
        userId: mongoose.Types.ObjectId(userId),
        timestamp: { $gte: startDate }
      }
    },
    {
      $group: {
        _id: {
          date: { $dateToString: { format: '%Y-%m-%d', date: '$timestamp' } },
          errorCode: '$error.errorCode'
        },
        count: { $sum: 1 }
      }
    },
    {
      $group: {
        _id: '$_id.date',
        errors: {
          $push: {
            errorCode: '$_id.errorCode',
            count: '$count'
          }
        },
        totalErrors: { $sum: '$count' }
      }
    },
    {
      $sort: { _id: 1 }
    }
  ]);
};

errorReportSchema.statics.getCriticalErrors = async function(limit = 10) {
  const criticalCodes = ['SRV001', 'SRV002', 'SRV003', 'SEC001', 'SEC002', 'SEC003', 'SEC004'];
  
  return this.find({
    'error.errorCode': { $in: criticalCodes },
    resolved: false
  })
  .populate('userId', 'name email')
  .sort({ timestamp: -1 })
  .limit(limit);
};

errorReportSchema.statics.resolveError = async function(reportId) {
  return this.findByIdAndUpdate(
    reportId,
    { resolved: true },
    { new: true }
  );
};

// Instance methods
errorReportSchema.methods.markAsResolved = function() {
  this.resolved = true;
  return this.save();
};

errorReportSchema.methods.addTag = function(tag) {
  if (!this.tags.includes(tag)) {
    this.tags.push(tag);
    return this.save();
  }
  return Promise.resolve(this);
};

errorReportSchema.methods.setSeverity = function(severity) {
  this.severity = severity;
  return this.save();
};

// Pre-save middleware to auto-determine severity
errorReportSchema.pre('save', function(next) {
  const criticalCodes = ['SRV001', 'SRV002', 'SRV003', 'SEC001', 'SEC002', 'SEC003', 'SEC004'];
  const highCodes = ['AUTH001', 'AUTH002', 'AUTH003', 'ASM006', 'RATE001'];
  
  if (criticalCodes.includes(this.error.errorCode)) {
    this.severity = 'critical';
  } else if (highCodes.includes(this.error.errorCode)) {
    this.severity = 'high';
  } else if (this.error.errorCode.startsWith('VAL')) {
    this.severity = 'low';
  } else {
    this.severity = 'medium';
  }
  
  next();
});

const ErrorReport = mongoose.model('ErrorReport', errorReportSchema);

module.exports = ErrorReport;