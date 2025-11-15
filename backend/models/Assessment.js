const mongoose = require('mongoose');

const QuestionOptionSchema = new mongoose.Schema({
  text: {
    type: String,
    required: true,
    trim: true,
  },
  isCorrect: {
    type: Boolean,
    default: false,
  },
  points: {
    type: Number,
    default: 1,
  }
});

const QuestionSchema = new mongoose.Schema({
  questionText: {
    type: String,
    required: true,
    trim: true,
  },
  instructions: {
    type: String,
    default: '',
  },
  maxPoints: {
    type: Number,
    default: 10,
    min: 1,
  },
  type: {
    type: String,
    enum: ['descriptive', 'mcq', 'multiple_select'],
    default: 'descriptive',
  },
  options: [QuestionOptionSchema],
  categoryId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Category',
  },
  categoryName: {
    type: String,
    default: '',
  },
  timeLimit: {
    type: Number, // Time limit in seconds for this specific question
    default: 0, // 0 means no specific limit, use assessment time limit
  },
  difficulty: {
    type: String,
    enum: ['easy', 'medium', 'hard'],
    default: 'medium',
  },
  negativeMarking: {
    type: Boolean,
    default: false,
  },
  negativeMarks: {
    type: Number,
    default: 0,
  }
});

const AssessmentSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, 'Assessment title is required'],
      trim: true,
      maxlength: [200, 'Title cannot exceed 200 characters'],
    },
    description: {
      type: String,
      required: [true, 'Assessment description is required'],
      maxlength: [2000, 'Description cannot exceed 2000 characters'],
    },
    questions: [QuestionSchema],
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    timeLimit: {
      type: Number, // Time limit in minutes
      default: 60,
      min: [1, 'Time limit must be at least 1 minute'],
      max: [480, 'Time limit cannot exceed 8 hours'],
    },
    passingScore: {
      type: Number,
      default: 60,
      min: 0,
      max: 100,
    },
    totalPoints: {
      type: Number,
      default: 0,
    },
    shuffleQuestions: {
      type: Boolean,
      default: false,
    },
    shuffleOptions: {
      type: Boolean,
      default: false,
    },
    allowReview: {
      type: Boolean,
      default: true,
    },
    showCorrectAnswers: {
      type: Boolean,
      default: false,
    },
    maxAttempts: {
      type: Number,
      default: 1,
      min: 1,
      max: 10,
    },
    antiCheatEnabled: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('Assessment', AssessmentSchema);