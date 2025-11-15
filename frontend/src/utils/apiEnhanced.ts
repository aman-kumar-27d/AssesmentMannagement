import { 
  handleApiError, 
  handleNetworkError, 
  createFrontendError,
  displayError 
} from './errorHandler';

// Base API URL
const API_URL = 'http://localhost:5000/api';

// Enhanced fetch wrapper with error handling and timeout
const apiFetch = async (url: string, options: RequestInit = {}, timeout = 30000) => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    clearTimeout(timeoutId);

    // Handle non-JSON responses
    const contentType = response.headers.get('content-type');
    if (!contentType || !contentType.includes('application/json')) {
      const text = await response.text();
      throw createFrontendError('INVALID_FORMAT', `Server returned non-JSON response: ${text.substring(0, 100)}...`);
    }

    const data = await response.json();

    if (!response.ok) {
      // Use the enhanced error handler for API errors
      throw await handleApiError(response);
    }

    return data;
  } catch (error) {
    clearTimeout(timeoutId);
    
    // Handle aborted requests (timeout)
    if (error.name === 'AbortError') {
      throw createFrontendError('TIMEOUT_ERROR', 'Request timeout');
    }
    
    // Handle network errors
    if (error instanceof TypeError && error.message.includes('fetch')) {
      throw handleNetworkError(error);
    }
    
    // Re-throw if it's already a handled error
    if (error.name === 'FrontendError') {
      throw error;
    }
    
    // Handle other unexpected errors
    throw handleNetworkError(error);
  }
};

// User Authentication API
export const registerUser = async (userData: any) => {
  return apiFetch(`${API_URL}/users/register`, {
    method: 'POST',
    body: JSON.stringify(userData),
  });
};

export const registerAdmin = async (userData: any) => {
  return apiFetch(`${API_URL}/users/register-admin`, {
    method: 'POST',
    body: JSON.stringify(userData),
  });
};

export const loginUser = async (credentials: any) => {
  return apiFetch(`${API_URL}/users/login`, {
    method: 'POST',
    body: JSON.stringify(credentials),
  });
};

export const getUserProfile = async (token: string) => {
  return apiFetch(`${API_URL}/users/profile`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  });
};

export const updateUserPassword = async (token: string, currentPassword: string, newPassword: string) => {
  return apiFetch(`${API_URL}/users/update-password`, {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({ currentPassword, newPassword }),
  });
};

export const updateUserProfile = async (token: string, profileData: { userId?: string; email?: string }) => {
  return apiFetch(`${API_URL}/users/profile`, {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify(profileData),
  });
};

// Assessment API
export const getAssessments = async (token: string) => {
  return apiFetch(`${API_URL}/assessments`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  });
};

export const getAssessmentById = async (token: string, assessmentId: string) => {
  return apiFetch(`${API_URL}/assessments/${assessmentId}`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  });
};

export const createAssessment = async (token: string, assessmentData: any) => {
  return apiFetch(`${API_URL}/assessments`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify(assessmentData),
  });
};

export const updateAssessment = async (token: string, assessmentId: string, assessmentData: any) => {
  return apiFetch(`${API_URL}/assessments/${assessmentId}`, {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify(assessmentData),
  });
};

export const deleteAssessment = async (token: string, assessmentId: string) => {
  return apiFetch(`${API_URL}/assessments/${assessmentId}`, {
    method: 'DELETE',
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  });
};

// Category Management
export const getCategories = async (token: string) => {
  return apiFetch(`${API_URL}/categories`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  });
};

export const createCategory = async (token: string, categoryData: { name: string; description?: string }) => {
  return apiFetch(`${API_URL}/categories`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify(categoryData),
  });
};

// Submission API
export const getUserSubmissions = async (token: string) => {
  return apiFetch(`${API_URL}/submissions/user`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  });
};

export const getAllSubmissions = async (token: string) => {
  return apiFetch(`${API_URL}/submissions`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  });
};

export const getSubmissionById = async (token: string, submissionId: string) => {
  return apiFetch(`${API_URL}/submissions/${submissionId}`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  });
};

export const submitAssessment = async (
  token: string, 
  assessmentId: string, 
  content: string, 
  tabSwitches?: number, 
  multipleChoiceAnswers?: Record<string, string[]>,
  antiCheatViolations?: any[],
  sessionActivities?: any[],
  startTime?: string,
  endTime?: string
) => {
  return apiFetch(`${API_URL}/submissions`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({ 
      assessmentId, 
      content, 
      tabSwitches, 
      multipleChoiceAnswers,
      antiCheatViolations,
      sessionActivities,
      startTime,
      endTime
    }),
  });
};

export const evaluateSubmission = async (token: string, submissionId: string, grade: number, feedback?: string) => {
  return apiFetch(`${API_URL}/submissions/${submissionId}/evaluate`, {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({ grade, feedback }),
  });
};

// Challenge Management
export const challengeEvaluation = async (token: string, submissionId: string, reason: string) => {
  return apiFetch(`${API_URL}/submissions/${submissionId}/challenge`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({ reason }),
  });
};

export const respondToChallenge = async (token: string, submissionId: string, response: string) => {
  return apiFetch(`${API_URL}/submissions/${submissionId}/respond-challenge`, {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({ response }),
  });
};

// Error Reporting
export const reportError = async (errorData: any) => {
  return apiFetch(`${API_URL}/errors/report`, {
    method: 'POST',
    body: JSON.stringify(errorData),
  });
};

// Utility function to handle API calls with error display
export const apiCall = async (apiFunction: Function, ...args: any[]) => {
  try {
    return await apiFunction(...args);
  } catch (error) {
    // Display error to user
    displayError(error, { showNotification: true });
    throw error;
  }
};

// Export alias for backward compatibility
export const submitChallenge = challengeEvaluation;

// Export the enhanced API functions
export default {
  // Authentication
  registerUser,
  registerAdmin,
  loginUser,
  getUserProfile,
  updateUserPassword,
  updateUserProfile,
  
  // Assessments
  getAssessments,
  getAssessmentById,
  createAssessment,
  updateAssessment,
  deleteAssessment,
  
  // Categories
  getCategories,
  createCategory,
  
  // Submissions
  getUserSubmissions,
  getAllSubmissions,
  getSubmissionById,
  submitAssessment,
  evaluateSubmission,
  
  // Challenges
  challengeEvaluation,
  respondToChallenge,
  submitChallenge,
  
  // Error Reporting
  reportError,
  
  // Utility
  apiCall
};