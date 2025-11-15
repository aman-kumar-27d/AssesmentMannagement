const mongoose = require('mongoose');

const MCQResponseSchema = new mongoose.Schema({
  questionIndex: {
    type: Number,
    required: true,
  },
  selectedOptions: [{
    type: String,
    required: true,
  }],
  isCorrect: {
    type: Boolean,
    default: false,
  },
  pointsEarned: {
    type: Number,
    default: 0,
  },
  maxPoints: {
    type: Number,
    required: true,
  }
});

const AntiCheatViolationSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: ['tab_switch', 'clipboard_copy', 'clipboard_paste', 'screenshot_attempt', 'window_resize', 'right_click', 'dev_tools', 'inactivity'],
    required: true,
  },
  timestamp: {
    type: Date,
    default: Date.now,
  },
  details: {
    type: String,
    default: '',
  },
  severity: {
    type: String,
    enum: ['low', 'medium', 'high', 'critical'],
    default: 'low',
  }
});

const SessionActivitySchema = new mongoose.Schema({
  timestamp: {
    type: Date,
    default: Date.now,
  },
  action: {
    type: String,
    required: true,
  },
  details: {
    type: String,
    default: '',
  }
});

const SubmissionSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    assessment: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Assessment',
      required: true,
    },
    content: {
      type: String,
      required: [true, 'Submission content is required'],
    },
    mcqResponses: [MCQResponseSchema],
    mcqScore: {
      type: Number,
      default: 0,
      min: 0,
    },
    totalScore: {
      type: Number,
      default: 0,
      min: 0,
    },
    maxPossibleScore: {
      type: Number,
      default: 0,
      min: 0,
    },
    tabSwitches: {
      type: Number,
      default: 0,
    },
    antiCheatViolations: [AntiCheatViolationSchema],
    sessionActivities: [SessionActivitySchema],
    timeSpent: {
      type: Number, // Time spent in seconds
      default: 0,
    },
    startTime: {
      type: Date,
    },
    endTime: {
      type: Date,
    },
    evaluationStatus: {
      type: String,
      enum: ['pending', 'auto_evaluated', 'manual_evaluated', 'evaluated'],
      default: 'pending',
    },
    grade: {
      type: Number,
      min: 0,
      max: 100,
    },
    feedback: {
      type: String,
    },
    evaluatedAt: {
      type: Date,
    },
    evaluatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    challenge: {
      status: {
        type: String,
        enum: ['pending', 'resolved', 'accepted', 'rejected', 'reviewing'],
      },
      reason: {
        type: String,
      },
      adminResponse: {
        type: String,
      },
      challengeDate: {
        type: Date,
      },
      resolvedDate: {
        type: Date,
      },
      resolvedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      }
    },
    attemptNumber: {
      type: Number,
      default: 1,
    },
    isFlagged: {
      type: Boolean,
      default: false,
    },
    flagReason: {
      type: String,
      default: '',
    },
  },
  {
    timestamps: true,
  }
);

// Create compound index to ensure a user can only submit once per assessment
SubmissionSchema.index({ user: 1, assessment: 1 }, { unique: true });

module.exports = mongoose.model('Submission', SubmissionSchema);