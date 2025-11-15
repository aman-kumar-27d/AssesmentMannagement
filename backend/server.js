const express = require('express');
const dotenv = require('dotenv');
const cors = require('cors');
const helmet = require('helmet');
const mongoSanitize = require('express-mongo-sanitize');
const xss = require('xss-clean');
const hpp = require('hpp');
const rateLimit = require('express-rate-limit');
const connectDB = require('./config/db');
const logger = require('./utils/logger');
const { globalErrorHandler, notFound } = require('./utils/errorHandler');
const userRoutes = require('./routes/userRoutes');
const assessmentRoutes = require('./routes/assessmentRoutes');
const submissionRoutes = require('./routes/submissionRoutes');
const categoryRoutes = require('./routes/categoryRoutes');
const errorRoutes = require('./routes/errorRoutes');

// Load environment variables
dotenv.config();

// Create Express app
const app = express();

// Security middleware
app.use(helmet());
app.use(mongoSanitize());
app.use(xss());
app.use(hpp());

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.'
});
app.use('/api', limiter);

// Body parser middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: false, limit: '10mb' }));

// CORS middleware
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true
}));

// Request logging middleware
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl}`);
  next();
});

// Routes
app.use('/api/users', userRoutes);
app.use('/api/assessments', assessmentRoutes);
app.use('/api/submissions', submissionRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/errors', errorRoutes);

// Root route
app.get('/', (req, res) => {
  try {
    console.log('Root route handler called');
    const response = { 
      status: 'success',
      message: 'Welcome to the Secure Notepad Assessment Platform API',
      version: '2.0.0',
      timestamp: new Date().toISOString()
    };
    console.log('Sending response:', response);
    res.json(response);
    console.log('Response sent');
  } catch (error) {
    console.error('Error in root route:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// Handle undefined routes
app.use(notFound);

// Global error handling middleware
app.use(globalErrorHandler);

// Declare server variable in outer scope
let server;

// Handle unhandled promise rejections
process.on('unhandledRejection', (err, promise) => {
  console.error('UNHANDLED REJECTION:', err);
  logger.error('UNHANDLED REJECTION!', {
    error: err.message,
    stack: err.stack,
    timestamp: new Date().toISOString()
  });
});

// Handle uncaught exceptions  
process.on('uncaughtException', (err) => {
  console.error('UNCAUGHT EXCEPTION:', err);
  logger.error('UNCAUGHT EXCEPTION!', {
    error: err.message,
    stack: err.stack,
    timestamp: new Date().toISOString()
  });
});

// Start server after database connection
const startServer = async () => {
  try {
    await connectDB();
    
    const PORT = process.env.PORT || 5000;
    server = app.listen(PORT, () => {
      logger.info(`Server running on port ${PORT}`, {
        port: PORT,
        environment: process.env.NODE_ENV || 'development',
        timestamp: new Date().toISOString()
      });
    });

    server.on('error', (error) => {
      logger.error('Server startup failed', {
        error: error.message,
        stack: error.stack,
        timestamp: new Date().toISOString()
      });
      process.exit(1);
    });
    
  } catch (error) {
    logger.error('Server startup failed', {
      error: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString()
    });
    process.exit(1);
  }
};

startServer();

module.exports = app;