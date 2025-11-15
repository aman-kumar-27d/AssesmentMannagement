import { 
  handleApiError, 
  handleNetworkError, 
  createFrontendError
} from './errorHandler';

// Base API URL
const API_URL = 'http://localhost:5000/api';

// Enhanced fetch wrapper with error handling
const apiFetch = async (url: string, options: RequestInit = {}) => {
  try {
    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

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
    // Handle network errors
    if (error instanceof TypeError && error.message.includes('fetch')) {
      throw handleNetworkError(error);
    }
    
    // Re-throw if it's already a handled error
    if (error instanceof Error && error.name === 'FrontendError') {
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
  try {
    const response = await fetch(`${API_URL}/users/register-admin`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(userData),
    });
    
    // Check if the response is JSON
    const contentType = response.headers.get('content-type');
    if (!contentType || !contentType.includes('application/json')) {
      const text = await response.text();
      throw new Error('Server returned non-JSON response: ' + (text.substring(0, 100) + '...'));
    }
    
    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.message || 'Admin registration failed');
    }
    
    return data;
  } catch (error) {
    console.error('Admin registration error:', error);
    throw error;
  }
};

export const loginUser = async (credentials: any) => {
  try {
    const response = await fetch(`${API_URL}/users/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(credentials),
    });
    
    // Check if the response is JSON
    const contentType = response.headers.get('content-type');
    if (!contentType || !contentType.includes('application/json')) {
      const text = await response.text();
      throw new Error('Server returned non-JSON response: ' + (text.substring(0, 100) + '...'));
    }
    
    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.message || 'Login failed');
    }
    
    return data;
  } catch (error) {
    console.error('Login error:', error);
    throw error;
  }
};

export const getUserProfile = async (token: string) => {
  try {
    const response = await fetch(`${API_URL}/users/profile`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
    });
    
    // Check if the response is JSON
    const contentType = response.headers.get('content-type');
    if (!contentType || !contentType.includes('application/json')) {
      const text = await response.text();
      throw new Error('Server returned non-JSON response: ' + (text.substring(0, 100) + '...'));
    }
    
    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.message || 'Failed to get user profile');
    }
    
    return data;
  } catch (error) {
    console.error('Profile fetch error:', error);
    throw error;
  }
};

export const updateUserPassword = async (token: string, currentPassword: string, newPassword: string) => {
  try {
    const response = await fetch(`${API_URL}/users/update-password`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({ currentPassword, newPassword }),
    });
    
    // Check if the response is JSON
    const contentType = response.headers.get('content-type');
    if (!contentType || !contentType.includes('application/json')) {
      const text = await response.text();
      throw new Error('Server returned non-JSON response: ' + (text.substring(0, 100) + '...'));
    }
    
    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.message || 'Failed to update password');
    }
    
    return data;
  } catch (error) {
    console.error('Password update error:', error);
    throw error;
  }
};

export const updateUserProfile = async (token: string, profileData: { userId?: string; email?: string }) => {
  try {
    const response = await fetch(`${API_URL}/users/profile`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify(profileData),
    });
    
    // Check if the response is JSON
    const contentType = response.headers.get('content-type');
    if (!contentType || !contentType.includes('application/json')) {
      const text = await response.text();
      throw new Error('Server returned non-JSON response: ' + (text.substring(0, 100) + '...'));
    }
    
    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.message || 'Failed to update profile');
    }
    
    return data;
  } catch (error) {
    console.error('Update profile error:', error);
    throw error;
  }
};

// Assessment API
export const getAssessments = async (token: string) => {
  try {
    const response = await fetch(`${API_URL}/assessments`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
    });
    
    // Check if the response is JSON
    const contentType = response.headers.get('content-type');
    if (!contentType || !contentType.includes('application/json')) {
      const text = await response.text();
      throw new Error('Server returned non-JSON response: ' + (text.substring(0, 100) + '...'));
    }
    
    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.message || 'Failed to fetch assessments');
    }
    
    return data;
  } catch (error) {
    console.error('Fetch assessments error:', error);
    throw error;
  }
};

export const getAssessmentById = async (token: string, assessmentId: string) => {
  try {
    const response = await fetch(`${API_URL}/assessments/${assessmentId}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
    });
    
    // Check if the response is JSON
    const contentType = response.headers.get('content-type');
    if (!contentType || !contentType.includes('application/json')) {
      const text = await response.text();
      throw new Error('Server returned non-JSON response: ' + (text.substring(0, 100) + '...'));
    }
    
    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.message || 'Failed to fetch assessment');
    }
    
    return data;
  } catch (error) {
    console.error('Fetch assessment error:', error);
    throw error;
  }
};

export const createAssessment = async (token: string, assessmentData: any) => {
  try {
    const response = await fetch(`${API_URL}/assessments`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify(assessmentData),
    });
    
    // Check if the response is JSON
    const contentType = response.headers.get('content-type');
    if (!contentType || !contentType.includes('application/json')) {
      const text = await response.text();
      throw new Error('Server returned non-JSON response: ' + (text.substring(0, 100) + '...'));
    }
    
    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.message || 'Failed to create assessment');
    }
    
    return data;
  } catch (error) {
    console.error('Create assessment error:', error);
    throw error;
  }
};

export const updateAssessment = async (token: string, assessmentId: string, assessmentData: any) => {
  try {
    const response = await fetch(`${API_URL}/assessments/${assessmentId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify(assessmentData),
    });
    
    // Check if the response is JSON
    const contentType = response.headers.get('content-type');
    if (!contentType || !contentType.includes('application/json')) {
      const text = await response.text();
      throw new Error('Server returned non-JSON response: ' + (text.substring(0, 100) + '...'));
    }
    
    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.message || 'Failed to update assessment');
    }
    
    return data;
  } catch (error) {
    console.error('Update assessment error:', error);
    throw error;
  }
};

export const deleteAssessment = async (token: string, assessmentId: string) => {
  try {
    const response = await fetch(`${API_URL}/assessments/${assessmentId}`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
    });
    
    // Check if the response is JSON
    const contentType = response.headers.get('content-type');
    if (!contentType || !contentType.includes('application/json')) {
      const text = await response.text();
      throw new Error('Server returned non-JSON response: ' + (text.substring(0, 100) + '...'));
    }
    
    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.message || 'Failed to delete assessment');
    }
    
    return data;
  } catch (error) {
    console.error('Delete assessment error:', error);
    throw error;
  }
};

// Category Management
export const getCategories = async (token: string) => {
  try {
    const response = await fetch(`${API_URL}/categories`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
    });
    
    const contentType = response.headers.get('content-type');
    if (!contentType || !contentType.includes('application/json')) {
      const text = await response.text();
      throw new Error('Server returned non-JSON response: ' + (text.substring(0, 100) + '...'));
    }
    
    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.message || 'Failed to fetch categories');
    }
    
    return data;
  } catch (error) {
    console.error('Fetch categories error:', error);
    throw error;
  }
};

export const createCategory = async (token: string, categoryData: { name: string; description?: string }) => {
  try {
    const response = await fetch(`${API_URL}/categories`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify(categoryData),
    });
    
    const contentType = response.headers.get('content-type');
    if (!contentType || !contentType.includes('application/json')) {
      const text = await response.text();
      throw new Error('Server returned non-JSON response: ' + (text.substring(0, 100) + '...'));
    }
    
    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.message || 'Failed to create category');
    }
    
    return data;
  } catch (error) {
    console.error('Create category error:', error);
    throw error;
  }
};

// Submission API
export const getUserSubmissions = async (token: string) => {
  try {
    const response = await fetch(`${API_URL}/submissions/user`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
    });
    
    // Check if the response is JSON
    const contentType = response.headers.get('content-type');
    if (!contentType || !contentType.includes('application/json')) {
      const text = await response.text();
      throw new Error('Server returned non-JSON response: ' + (text.substring(0, 100) + '...'));
    }
    
    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.message || 'Failed to fetch user submissions');
    }
    
    return data;
  } catch (error) {
    console.error('Fetch user submissions error:', error);
    throw error;
  }
};

export const getAllSubmissions = async (token: string) => {
  try {
    const response = await fetch(`${API_URL}/submissions`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
    });
    
    // Check if the response is JSON
    const contentType = response.headers.get('content-type');
    if (!contentType || !contentType.includes('application/json')) {
      const text = await response.text();
      throw new Error('Server returned non-JSON response: ' + (text.substring(0, 100) + '...'));
    }
    
    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.message || 'Failed to fetch all submissions');
    }
    
    return data;
  } catch (error) {
    console.error('Fetch all submissions error:', error);
    throw error;
  }
};

export const getSubmissionById = async (token: string, submissionId: string) => {
  try {
    const response = await fetch(`${API_URL}/submissions/${submissionId}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
    });
    
    // Check if the response is JSON
    const contentType = response.headers.get('content-type');
    if (!contentType || !contentType.includes('application/json')) {
      const text = await response.text();
      throw new Error('Server returned non-JSON response: ' + (text.substring(0, 100) + '...'));
    }
    
    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.message || 'Failed to fetch submission');
    }
    
    return data;
  } catch (error) {
    console.error('Fetch submission error:', error);
    throw error;
  }
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
  endTime?: string,
  questionNotes?: Record<string, string>
) => {
  try {
    const response = await fetch(`${API_URL}/submissions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
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
        endTime,
        questionNotes
      }),
    });
    
    // Check if the response is JSON
    const contentType = response.headers.get('content-type');
    if (!contentType || !contentType.includes('application/json')) {
      const text = await response.text();
      throw new Error('Server returned non-JSON response: ' + (text.substring(0, 100) + '...'));
    }
    
    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.message || 'Failed to submit assessment');
    }
    
    return data;
  } catch (error) {
    console.error('Submit assessment error:', error);
    throw error;
  }
};

export const evaluateSubmission = async (token: string, submissionId: string, grade: number, feedback?: string) => {
  try {
    const response = await fetch(`${API_URL}/submissions/${submissionId}/evaluate`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({ grade, feedback }),
    });
    
    // Check if the response is JSON
    const contentType = response.headers.get('content-type');
    if (!contentType || !contentType.includes('application/json')) {
      const text = await response.text();
      throw new Error('Server returned non-JSON response: ' + (text.substring(0, 100) + '...'));
    }
    
    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.message || 'Failed to evaluate submission');
    }
    
    return data;
  } catch (error) {
    console.error('Evaluate submission error:', error);
    throw error;
  }
};

// Challenge Management
export const challengeEvaluation = async (token: string, submissionId: string, reason: string) => {
  try {
    const response = await fetch(`${API_URL}/submissions/${submissionId}/challenge`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({ reason }),
    });
    
    const contentType = response.headers.get('content-type');
    if (!contentType || !contentType.includes('application/json')) {
      const text = await response.text();
      throw new Error('Server returned non-JSON response: ' + (text.substring(0, 100) + '...'));
    }
    
    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.message || 'Failed to submit challenge');
    }
    
    return data;
  } catch (error) {
    console.error('Challenge submission error:', error);
    throw error;
  }
};

export const respondToChallenge = async (token: string, submissionId: string, response: string) => {
  try {
    const apiResponse = await fetch(`${API_URL}/submissions/${submissionId}/respond-challenge`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({ response }),
    });
    
    const contentType = apiResponse.headers.get('content-type');
    if (!contentType || !contentType.includes('application/json')) {
      const text = await apiResponse.text();
      throw new Error('Server returned non-JSON response: ' + (text.substring(0, 100) + '...'));
    }
    
    const data = await apiResponse.json();
    
    if (!apiResponse.ok) {
      throw new Error(data.message || 'Failed to respond to challenge');
    }
    
    return data;
  } catch (error) {
    console.error('Challenge response error:', error);
    throw error;
  }
};

// Alias for challengeEvaluation for better naming consistency
export const submitChallenge = challengeEvaluation;