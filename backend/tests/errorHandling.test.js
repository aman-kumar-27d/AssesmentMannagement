const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../server');
const { createError, errorTypes } = require('../utils/errorHandler');
const ErrorReport = require('../models/ErrorReport');

describe('Error Handling System', () => {
  beforeAll(async () => {
    // Connect to test database
    await mongoose.connect(process.env.MONGODB_TEST_URI || 'mongodb://localhost:27017/assessment_test', {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
  });

  afterAll(async () => {
    await mongoose.connection.close();
  });

  beforeEach(async () => {
    await ErrorReport.deleteMany({});
  });

  describe('Error Handler Utility', () => {
    test('should create error with correct properties', () => {
      const error = createError('VALIDATION_ERROR', 'Test error message', { field: 'test' });
      
      expect(error).toBeInstanceOf(Error);
      expect(error.message).toBe('Test error message');
      expect(error.statusCode).toBe(400);
      expect(error.errorCode).toBe('VAL001');
      expect(error.details).toEqual({ field: 'test' });
      expect(error.isOperational).toBe(true);
    });

    test('should use default message if custom message not provided', () => {
      const error = createError('RESOURCE_NOT_FOUND');
      
      expect(error.message).toBe('Requested resource not found');
      expect(error.statusCode).toBe(404);
      expect(error.errorCode).toBe('RES001');
    });

    test('should handle all error types correctly', () => {
      Object.keys(errorTypes).forEach(errorType => {
        const error = createError(errorType);
        expect(error).toBeDefined();
        expect(error.statusCode).toBe(errorTypes[errorType].statusCode);
        expect(error.errorCode).toBe(errorTypes[errorType].code);
      });
    });
  });

  describe('Error Reporting API', () => {
    test('should accept valid error report', async () => {
      const errorReport = {
        error: {
          name: 'TypeError',
          message: 'Cannot read property of undefined',
          stack: 'TypeError: Cannot read property of undefined\n    at Component.render',
          errorCode: 'VAL001'
        },
        context: {
          url: 'http://localhost:3000/test',
          userAgent: 'Mozilla/5.0 Test Browser',
          timestamp: new Date().toISOString()
        },
        errorInfo: {
          component: 'TestComponent',
          props: { test: true }
        }
      };

      const response = await request(app)
        .post('/api/errors/report')
        .send(errorReport)
        .expect(201);

      expect(response.body.status).toBe('success');
      expect(response.body.data.reportId).toBeDefined();
      expect(response.body.data.acknowledged).toBe(true);

      // Verify error was saved to database
      const savedError = await ErrorReport.findById(response.body.data.reportId);
      expect(savedError).toBeDefined();
      expect(savedError.error.name).toBe('TypeError');
    });

    test('should sanitize malicious input', async () => {
      const maliciousReport = {
        error: {
          name: '<script>alert("xss")</script>',
          message: 'Malicious message with <script>alert("xss")</script>',
          stack: 'Stack trace with <script>alert("xss")</script>',
          errorCode: '<script>alert("xss")</script>'
        },
        context: {
          url: 'javascript:alert("xss")',
          userAgent: '<script>alert("xss")</script>',
          timestamp: new Date().toISOString()
        }
      };

      const response = await request(app)
        .post('/api/errors/report')
        .send(maliciousReport)
        .expect(201);

      const savedError = await ErrorReport.findById(response.body.data.reportId);
      expect(savedError.error.name).not.toContain('<script>');
      expect(savedError.error.message).not.toContain('<script>');
      expect(savedError.context.url).not.toContain('javascript:');
    });

    test('should handle missing required fields gracefully', async () => {
      const incompleteReport = {
        error: {
          name: 'Error'
        },
        context: {}
      };

      const response = await request(app)
        .post('/api/errors/report')
        .send(incompleteReport)
        .expect(201);

      expect(response.body.status).toBe('success');
    });

    test('should enforce rate limiting', async () => {
      const errorReport = {
        error: {
          name: 'Error',
          message: 'Test error',
          stack: 'Stack trace',
          errorCode: 'VAL001'
        },
        context: {
          url: 'http://localhost:3000/test',
          userAgent: 'Test Browser',
          timestamp: new Date().toISOString()
        }
      };

      // Make multiple requests to trigger rate limit
      const promises = Array(60).fill(null).map(() =>
        request(app)
          .post('/api/errors/report')
          .send(errorReport)
      );

      const responses = await Promise.all(promises);
      
      // At least one should be rate limited
      const rateLimited = responses.some(response => response.status === 429);
      expect(rateLimited).toBe(true);
    });
  });

  describe('Error Statistics API', () => {
    beforeEach(async () => {
      // Create test error reports
      const testReports = [
        {
          error: { name: 'Error', message: 'Test 1', errorCode: 'VAL001' },
          context: { url: 'http://test1.com', userAgent: 'Browser 1', timestamp: new Date().toISOString() },
          ipAddress: '127.0.0.1',
          timestamp: new Date(Date.now() - 1 * 60 * 60 * 1000) // 1 hour ago
        },
        {
          error: { name: 'Error', message: 'Test 2', errorCode: 'VAL001' },
          context: { url: 'http://test2.com', userAgent: 'Browser 2', timestamp: new Date().toISOString() },
          ipAddress: '127.0.0.2',
          timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000) // 2 hours ago
        },
        {
          error: { name: 'Error', message: 'Test 3', errorCode: 'SRV001' },
          context: { url: 'http://test3.com', userAgent: 'Browser 3', timestamp: new Date().toISOString() },
          ipAddress: '127.0.0.3',
          timestamp: new Date(Date.now() - 3 * 60 * 60 * 1000) // 3 hours ago
        }
      ];

      await ErrorReport.insertMany(testReports);
    });

    test('should return error statistics', async () => {
      const response = await request(app)
        .get('/api/errors/stats')
        .expect(200);

      expect(response.body.status).toBe('success');
      expect(response.body.data.stats).toBeDefined();
      expect(response.body.data.hourlyStats).toBeDefined();
      expect(Array.isArray(response.body.data.stats)).toBe(true);
    });

    test('should filter by time range', async () => {
      const response = await request(app)
        .get('/api/errors/stats?timeRange=2')
        .expect(200);

      // Should only include errors from last 2 hours
      const stats = response.body.data.stats;
      expect(stats.length).toBeGreaterThan(0);
    });

    test('should filter by error code', async () => {
      const response = await request(app)
        .get('/api/errors/stats?errorCode=VAL001')
        .expect(200);

      const stats = response.body.data.stats;
      expect(stats.every(stat => stat.errorCode === 'VAL001')).toBe(true);
    });
  });

  describe('Error Report Management', () => {
    let errorReportId;

    beforeEach(async () => {
      const errorReport = new ErrorReport({
        error: { name: 'TestError', message: 'Test message', errorCode: 'VAL001' },
        context: { url: 'http://test.com', userAgent: 'Test Browser', timestamp: new Date().toISOString() },
        ipAddress: '127.0.0.1'
      });
      
      const saved = await errorReport.save();
      errorReportId = saved._id;
    });

    test('should retrieve error reports', async () => {
      const response = await request(app)
        .get('/api/errors/reports')
        .expect(200);

      expect(response.body.status).toBe('success');
      expect(response.body.data.reports).toBeDefined();
      expect(Array.isArray(response.body.data.reports)).toBe(true);
      expect(response.body.data.pagination).toBeDefined();
    });

    test('should delete error report', async () => {
      const response = await request(app)
        .delete(`/api/errors/reports/${errorReportId}`)
        .expect(204);

      // Verify report was deleted
      const deletedReport = await ErrorReport.findById(errorReportId);
      expect(deletedReport).toBeNull();
    });

    test('should return 404 for non-existent report', async () => {
      const fakeId = new mongoose.Types.ObjectId();
      
      await request(app)
        .delete(`/api/errors/reports/${fakeId}`)
        .expect(404);
    });
  });

  describe('Global Error Handler', () => {
    test('should handle 404 errors', async () => {
      const response = await request(app)
        .get('/api/nonexistent-endpoint')
        .expect(404);

      expect(response.body.status).toBe('error');
      expect(response.body.error.errorCode).toBe('RES001');
    });

    test('should handle validation errors', async () => {
      // This would require a route that triggers validation
      // For now, we'll test the error reporting validation
      const invalidReport = {
        error: {
          name: 'a'.repeat(101), // Too long
          message: 'Valid message'
        },
        context: {
          timestamp: new Date().toISOString()
        }
      };

      const response = await request(app)
        .post('/api/errors/report')
        .send(invalidReport)
        .expect(400);

      expect(response.body.status).toBe('error');
      expect(response.body.error.errorCode).toBe('VAL001');
    });
  });
});