import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getAssessmentById, submitAssessment } from '../utils/api';
import SecureNotepad from '../components/SecureNotepad';
import Timer from '../components/Timer';
import NotificationContainer from '../components/NotificationContainer';
import { createAntiCheatMonitor, AntiCheatViolation, SessionActivity } from '../utils/antiCheat';
import { showSuccess, showError, showWarning } from '../utils/messaging';

interface QuestionOption {
  text: string;
  isCorrect?: boolean; // We don't send isCorrect to the frontend
  points?: number;
}

interface Question {
  _id: string;
  questionText: string;
  instructions: string;
  maxPoints: number;
  categoryId?: string;
  categoryName?: string;
  type: 'descriptive' | 'mcq' | 'multiple_select';
  options?: QuestionOption[];
  timeLimit?: number; // in seconds
  difficulty?: 'easy' | 'medium' | 'hard';
  negativeMarking?: boolean;
  negativeMarks?: number;
}

interface Assessment {
  _id: string;
  title: string;
  description: string;
  timeLimit: number; // in minutes
  questions: Question[];
  passingScore?: number;
  shuffleQuestions?: boolean;
  shuffleOptions?: boolean;
  antiCheatEnabled?: boolean;
  maxAttempts?: number;
  allowReview?: boolean;
  showCorrectAnswers?: boolean;
}

const SESSION_KEYS = {
  HAS_STARTED: 'assessment_started',
  START_TIME: 'assessment_start_time',
  ASSESSMENT_ID: 'assessment_id',
  TAB_SWITCHES: 'assessment_tab_switches',
  SELECTED_OPTIONS: 'assessment_selected_options',
  CONTENT: 'assessment_content',
  INITIAL_VISIT: 'assessment_initial_visit',
};

const TakeAssessment = () => {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const hasInitialized = useRef(false);
  const antiCheatMonitor = useRef<ReturnType<typeof createAntiCheatMonitor> | null>(null);
  const startTimeRef = useRef<Date | null>(null);

  const [assessment, setAssessment] = useState<Assessment | null>(null);
  const [content, setContent] = useState('');
  const [timeRemaining, setTimeRemaining] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [tabSwitches, setTabSwitches] = useState(0);
  const [selectedOptions, setSelectedOptions] = useState<Record<string, string[]>>({});
  const [showConfirmSubmit, setShowConfirmSubmit] = useState(false);
  const [hasMCQs, setHasMCQs] = useState(false);
  const [pageReloaded, setPageReloaded] = useState(false);
  const [antiCheatViolations, setAntiCheatViolations] = useState<AntiCheatViolation[]>([]);
  const [sessionActivities, setSessionActivities] = useState<SessionActivity[]>([]);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [questionTimers, setQuestionTimers] = useState<Record<number, number>>({});

  // Initialize anti-cheat monitoring
  const handleAntiCheatViolation = useCallback((violation: AntiCheatViolation) => {
    setAntiCheatViolations(prev => [...prev, violation]);
    
    // Show appropriate warning based on severity
    switch (violation.severity) {
      case 'critical':
        showError('Security Violation', violation.details);
        break;
      case 'high':
        showWarning('Security Warning', violation.details);
        break;
      case 'medium':
        showWarning('Notice', violation.details);
        break;
      default:
        console.warn('Anti-cheat violation:', violation);
    }
  }, []);

  // Check if this is a page reload - this runs only once when component mounts
  useEffect(() => {
    const checkReload = () => {
      // Check if this is the first time this component has loaded in this browser session
      const initialVisit = sessionStorage.getItem(SESSION_KEYS.INITIAL_VISIT);
      
      if (!initialVisit) {
        // First time visiting, so we mark it
        sessionStorage.setItem(SESSION_KEYS.INITIAL_VISIT, 'true');
        
        // Check if we're returning to an already started assessment
        const startedId = sessionStorage.getItem(SESSION_KEYS.ASSESSMENT_ID);
        if (startedId && startedId === id) {
          // This is a page navigation back to an existing assessment, not a reload
          return false;
        }
        
        // Brand new assessment
        sessionStorage.setItem(SESSION_KEYS.ASSESSMENT_ID, id || '');
        sessionStorage.setItem(SESSION_KEYS.START_TIME, Date.now().toString());
        sessionStorage.setItem(SESSION_KEYS.TAB_SWITCHES, '0');
        return false;
      } else {
        // Not first visit, check if we have a started assessment with same ID
        const startedId = sessionStorage.getItem(SESSION_KEYS.ASSESSMENT_ID);
        
        if (startedId && startedId === id) {
          // This is a reload of the same assessment
          // Get saved tab switches
          const savedTabSwitches = sessionStorage.getItem(SESSION_KEYS.TAB_SWITCHES);
          if (savedTabSwitches) {
            setTabSwitches(parseInt(savedTabSwitches, 10) || 0);
          }
          
          // Get saved content if any
          const savedContent = sessionStorage.getItem(SESSION_KEYS.CONTENT);
          if (savedContent) {
            setContent(savedContent);
          }
          
          // Get saved selected options if any
          const savedOptions = sessionStorage.getItem(SESSION_KEYS.SELECTED_OPTIONS);
          if (savedOptions) {
            try {
              setSelectedOptions(JSON.parse(savedOptions));
            } catch (e) {
              console.error("Could not parse saved options", e);
            }
          }
          
          return true;
        } else {
          // This is a new assessment with a different ID
          sessionStorage.setItem(SESSION_KEYS.ASSESSMENT_ID, id || '');
          sessionStorage.setItem(SESSION_KEYS.START_TIME, Date.now().toString());
          sessionStorage.setItem(SESSION_KEYS.TAB_SWITCHES, '0');
          return false;
        }
      }
    };
    
    const isReload = checkReload();
    setPageReloaded(isReload);
  }, [id, handleAntiCheatViolation]); // Only depend on id, not any state variables

  // Initialize anti-cheat monitoring when assessment loads
  useEffect(() => {
    if (assessment && assessment.antiCheatEnabled && !antiCheatMonitor.current) {
      antiCheatMonitor.current = createAntiCheatMonitor(handleAntiCheatViolation);
      
      // Request fullscreen if enabled
      if (assessment.antiCheatEnabled) {
        antiCheatMonitor.current.requestFullscreen().then(() => {
          setIsFullscreen(true);
        }).catch(err => {
          console.warn('Fullscreen request denied:', err);
        });
      }
    }

    return () => {
      if (antiCheatMonitor.current) {
        antiCheatMonitor.current.destroy();
        antiCheatMonitor.current = null;
      }
    };
  }, [assessment, handleAntiCheatViolation]);

  // Handle time warnings
  const handleTimeWarning = useCallback((remainingSeconds: number) => {
    if (remainingSeconds <= 60) {
      showWarning('Time Warning', `Only ${remainingSeconds} seconds remaining!`);
    } else if (remainingSeconds <= 300) {
      showWarning('Time Warning', `Only ${Math.floor(remainingSeconds / 60)} minutes remaining!`);
    }
  }, []);

  // Handle time up
  const handleTimeUp = useCallback(() => {
    showError('Time\'s Up!', 'The assessment time has expired. Your submission will be automatically submitted.');
    handleSubmit(true);
  }, []);

  // Fetch assessment details - this should only depend on user and id
  useEffect(() => {
    const fetchAssessment = async () => {
      if (!user?.token || !id) return;
      
      try {
        setIsLoading(true);
        setError('');
        const data = await getAssessmentById(user.token, id);
        
        // Ensure question type is correctly identified and preserved
        const processedAssessment = {
          ...data,
          questions: data.questions.map((q: Question) => {
            // Explicitly ensure type is preserved as-is from backend
            // If the question has options array, it's definitely an MCQ
            const isQuestionMCQ = q.type === 'mcq' || (q.options && q.options.length > 0);
            return {
              ...q,
              type: isQuestionMCQ ? 'mcq' : 'descriptive',
              options: q.options || []
            };
          })
        };
        
        setAssessment(processedAssessment);
        
        // Initialize time remaining based on session storage or assessment time limit
        const startTime = sessionStorage.getItem(SESSION_KEYS.START_TIME);
        if (startTime) {
          const elapsedSeconds = Math.floor((Date.now() - parseInt(startTime, 10)) / 1000);
          const remainingSeconds = Math.max(0, processedAssessment.timeLimit * 60 - elapsedSeconds);
          setTimeRemaining(remainingSeconds);
        } else {
          setTimeRemaining(processedAssessment.timeLimit * 60); // Convert to seconds
          sessionStorage.setItem(SESSION_KEYS.START_TIME, Date.now().toString());
        }
        
        // Check if assessment has MCQs
        const hasMultipleChoice = processedAssessment.questions.some((q: Question) => q.type === 'mcq');
        setHasMCQs(hasMultipleChoice);
        
        // Initialize selected options for MCQs if not already loaded from session
        // We use a ref to ensure this only happens once after loading assessment data
        if (!hasInitialized.current) {
          // Check if we have saved options first
          const savedOptions = sessionStorage.getItem(SESSION_KEYS.SELECTED_OPTIONS);
          if (savedOptions) {
            try {
              setSelectedOptions(JSON.parse(savedOptions));
            } catch (e) {
              console.error("Could not parse saved options", e);
              initializeEmptyOptions(processedAssessment.questions);
            }
          } else {
            initializeEmptyOptions(processedAssessment.questions);
          }
          hasInitialized.current = true;
        }
      } catch (err: any) {
        setError(err.message || 'Failed to load assessment.');
      } finally {
        setIsLoading(false);
      }
    };
    
    // Initialize empty options for all MCQ questions
    const initializeEmptyOptions = (questions: Question[]) => {
      const initialSelectedOptions: Record<string, string[]> = {};
      questions.forEach((question, index) => {
        if (question.type === 'mcq') {
          initialSelectedOptions[index] = [];
        }
      });
      setSelectedOptions(initialSelectedOptions);
    };

    fetchAssessment();
  }, [user, id]); // Removed selectedOptions from dependencies

  // Save content to session storage when it changes
  useEffect(() => {
    if (content) {
      sessionStorage.setItem(SESSION_KEYS.CONTENT, content);
    }
  }, [content]);

  // Save selected options to session storage when they change
  useEffect(() => {
    if (Object.keys(selectedOptions).length > 0) {
      sessionStorage.setItem(SESSION_KEYS.SELECTED_OPTIONS, JSON.stringify(selectedOptions));
    }
  }, [selectedOptions]);

  // Timer countdown
  useEffect(() => {
    if (!assessment || timeRemaining <= 0) return;

    const timer = setInterval(() => {
      setTimeRemaining(prev => {
        if (prev <= 1) {
          clearInterval(timer);
          handleSubmit(true); // Auto-submit when time runs out
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [assessment, timeRemaining]);

  // Tab switch detection
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        const newTabSwitches = tabSwitches + 1;
        setTabSwitches(newTabSwitches);
        // Update session storage
        sessionStorage.setItem(SESSION_KEYS.TAB_SWITCHES, newTabSwitches.toString());
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [tabSwitches]);

  // Handle MCQ option selection
  const handleOptionSelect = (questionIndex: number, optionText: string) => {
    setSelectedOptions(prev => {
      const currentSelections = prev[questionIndex] || [];
      const question = assessment?.questions[questionIndex];
      
      // For single selection questions, replace the selection
      if (question?.type === 'mcq' && question.options && question.options.filter(o => o.isCorrect).length === 1) {
        return { ...prev, [questionIndex]: [optionText] };
      }
      
      // For multiple selection questions, toggle the selection
      const isSelected = currentSelections.includes(optionText);
      if (isSelected) {
        return { ...prev, [questionIndex]: currentSelections.filter(opt => opt !== optionText) };
      } else {
        return { ...prev, [questionIndex]: [...currentSelections, optionText] };
      }
    });
  };

  // Handle submission
  const handleSubmit = async (isAutoSubmit = false) => {
    if (!user?.token || !id || !assessment) return;
    
    // Show confirmation dialog if not already showing and not auto-submitting due to time expiration
    if (!showConfirmSubmit && timeRemaining > 0 && !isAutoSubmit) {
      setShowConfirmSubmit(true);
      return;
    }
    
    try {
      setIsSubmitting(true);
      
      // Prepare submission data
      let submissionContent = content;
      
      // If this is an MCQ-only assessment, send a placeholder message for content
      if (hasMCQs && content.trim() === '') {
        submissionContent = "MCQ Assessment Submission";
      }

      // Get anti-cheat data from monitor
      const violations = antiCheatMonitor.current?.getViolations() || antiCheatViolations;
      const activities = antiCheatMonitor.current?.getActivities() || sessionActivities;
      const finalTabSwitches = antiCheatMonitor.current?.getTabSwitchCount() || tabSwitches;
      
      // Calculate time spent
      const startTime = startTimeRef.current || new Date(sessionStorage.getItem(SESSION_KEYS.START_TIME) || Date.now());
      const endTime = new Date();
      const timeSpent = Math.floor((endTime.getTime() - startTime.getTime()) / 1000);
      
      await submitAssessment(
        user.token,
        id,
        submissionContent,
        finalTabSwitches,
        hasMCQs ? selectedOptions : undefined,
        violations,
        activities,
        startTime.toISOString(),
        endTime.toISOString()
      );
      
      // Clear session storage after successful submission
      sessionStorage.removeItem(SESSION_KEYS.HAS_STARTED);
      sessionStorage.removeItem(SESSION_KEYS.ASSESSMENT_ID);
      sessionStorage.removeItem(SESSION_KEYS.START_TIME);
      sessionStorage.removeItem(SESSION_KEYS.TAB_SWITCHES);
      sessionStorage.removeItem(SESSION_KEYS.SELECTED_OPTIONS);
      sessionStorage.removeItem(SESSION_KEYS.CONTENT);
      // Keep the initial visit flag so we can detect actual page reloads
      
      // Show success message
      showSuccess('Assessment Submitted', 'Your assessment has been successfully submitted!');
      
      // Redirect to results page after submission
      navigate('/results');
    } catch (err: any) {
      setError(err.message || 'Failed to submit assessment.');
      setShowConfirmSubmit(false);
      setIsSubmitting(false);
      showError('Submission Failed', err.message || 'Failed to submit assessment.');
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <h2 className="text-xl font-semibold">Loading Assessment...</h2>
          <p className="text-gray-500 mt-2">Please wait while we prepare your assessment.</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="text-center max-w-md">
          <div className="text-red-500 text-5xl mb-4">⚠️</div>
          <h2 className="text-xl font-semibold text-red-600 mb-2">Error Loading Assessment</h2>
          <p className="text-gray-600 mb-4">{error}</p>
          <button
            onClick={() => navigate('/dashboard')}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  if (!assessment) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="text-center">
          <h2 className="text-xl font-semibold">Assessment not found</h2>
          <button
            onClick={() => navigate('/dashboard')}
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Notification Container */}
      <NotificationContainer />
      
      {/* Fixed header with timer */}
      <div className="fixed top-0 left-0 right-0 bg-white z-10 shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <h1 className="text-xl font-bold text-gray-900 truncate">
              {assessment.title}
            </h1>
            <div className="flex items-center space-x-4">
              <div className="text-sm text-gray-500">
                Tab Switches: {antiCheatMonitor.current?.getTabSwitchCount() || tabSwitches}
              </div>
              <div className={`text-sm font-medium px-3 py-1 rounded-full ${
                timeRemaining < 60 ? 'bg-red-100 text-red-800' : 'bg-blue-100 text-blue-800'
              }`}>
                Time Remaining: {formatTime(timeRemaining)}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main content with padding for the fixed header */}
      <div className="pt-20 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto pb-20">
        {pageReloaded && (
          <div className="mb-6 p-4 bg-red-100 border border-red-400 text-red-700 rounded-md">
            <p className="font-medium">⚠️ Warning: Page Refresh Detected</p>
            <p>Please avoid refreshing the page during an assessment. Your progress has been preserved.</p>
          </div>
        )}

        {/* Advanced Timer Component */}
        <div className="mb-6">
          <Timer
            totalSeconds={timeRemaining}
            onTimeUp={handleTimeUp}
            onTimeWarning={handleTimeWarning}
            warningThresholds={[300, 120, 60, 30]}
            autoPauseOnBlur={assessment?.antiCheatEnabled}
            showProgress={true}
            size="large"
            label="Assessment Time Remaining"
          />
        </div>
        
        <div className="mb-8">
          <div className="bg-white shadow rounded-lg overflow-hidden">
            <div className="px-6 py-5 border-b border-gray-200">
              <h2 className="text-lg font-medium text-gray-900">Instructions</h2>
            </div>
            <div className="px-6 py-5">
              <p className="text-gray-700 whitespace-pre-wrap">{assessment.description}</p>
              
              {tabSwitches > 0 && (
                <div className="mt-4 p-3 bg-yellow-50 border-l-4 border-yellow-400">
                  <p className="text-sm text-yellow-700">
                    <strong>Warning:</strong> You have switched tabs {tabSwitches} time(s). This will be recorded with your submission.
                  </p>
                </div>
              )}

              {antiCheatViolations.length > 0 && (
                <div className="mt-4 p-3 bg-red-50 border-l-4 border-red-400">
                  <p className="text-sm text-red-700">
                    <strong>Security Notice:</strong> {antiCheatViolations.length} security violation(s) detected.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Questions Display */}
        <div className="mb-8 space-y-6">
          {assessment.questions.map((question, index) => (
            <div key={index} className="bg-white shadow rounded-lg p-6">
              <div className="mb-4">
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  Question {index + 1}: {question.questionText}
                </h3>
                {question.categoryName && (
                  <span className="inline-block bg-blue-100 text-blue-800 text-xs font-medium px-2.5 py-0.5 rounded">
                    {question.categoryName}
                  </span>
                )}
                <div className="text-sm text-gray-500 mt-2">Points: {question.maxPoints}</div>
              </div>
              
              <div className="bg-gray-50 border border-gray-200 rounded-md p-4 mb-4">
                <p className="text-gray-700">{question.instructions}</p>
              </div>
              
              {question.type === 'mcq' && question.options && (
                <div className="mt-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Select {question.options.filter(o => o.isCorrect).length > 1 ? 'all that apply' : 'one option'}:
                  </label>
                  <div className="space-y-2">
                    {question.options.map((option, optionIndex) => {
                      const isSelected = selectedOptions[index]?.includes(option.text) || false;
                      
                      return (
                        <div 
                          key={optionIndex} 
                          className={`p-3 border rounded-md cursor-pointer ${
                            isSelected ? 'bg-blue-50 border-blue-300' : 'hover:bg-gray-50 border-gray-300'
                          }`}
                          onClick={() => handleOptionSelect(index, option.text)}
                        >
                          <div className="flex items-center">
                            <div className="flex-shrink-0 mr-2">
                              {question.options!.filter(o => o.isCorrect).length > 1 ? (
                                <div className={`h-5 w-5 border ${isSelected ? 'bg-blue-600 border-blue-600' : 'border-gray-300'} rounded flex items-center justify-center`}>
                                  {isSelected && (
                                    <svg className="h-3 w-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 111.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                    </svg>
                                  )}
                                </div>
                              ) : (
                                <div className={`h-5 w-5 border ${isSelected ? 'bg-blue-600 border-blue-600' : 'border-gray-300'} rounded-full flex items-center justify-center`}>
                                  {isSelected && (
                                    <div className="h-3 w-3 rounded-full bg-white"></div>
                                  )}
                                </div>
                              )}
                            </div>
                            <span className="text-gray-700">{option.text}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Code editor for descriptive responses */}
        {!hasMCQs || assessment.questions.some(q => q.type === 'descriptive') ? (
          <div className="bg-white shadow rounded-lg p-6 mb-8">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Your Solution</h3>
            <div className="h-96">
              <SecureNotepad value={content} onChange={setContent} />
            </div>
          </div>
        ) : null}
        
        {/* Submit button */}
        <div className="flex justify-end mt-6">
          <button
            onClick={() => handleSubmit()}
            disabled={isSubmitting}
            className={`px-6 py-3 bg-blue-600 text-white rounded-md shadow hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
              isSubmitting ? 'opacity-75 cursor-not-allowed' : ''
            }`}
          >
            {isSubmitting ? 'Submitting...' : showConfirmSubmit ? 'Confirm Submission' : 'Submit Assessment'}
          </button>
        </div>

        {/* Confirmation dialog */}
        {showConfirmSubmit && (
          <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 max-w-md w-full">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Confirm Submission</h3>
              <p className="text-gray-700 mb-6">
                Are you sure you want to submit your assessment? You cannot make changes after submission.
              </p>
              <div className="flex justify-end space-x-4">
                <button
                  onClick={() => setShowConfirmSubmit(false)}
                  className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
                  disabled={isSubmitting}
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleSubmit()}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? 'Submitting...' : 'Submit'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default TakeAssessment;