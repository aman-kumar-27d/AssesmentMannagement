import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getAssessmentById, submitAssessment } from '../utils/api';
import SecureNotepad from '../components/SecureNotepad';
import Timer from '../components/Timer';
import NotificationContainer from '../components/NotificationContainer';
import { createAntiCheatMonitor, AntiCheatViolation } from '../utils/antiCheat';
import { showSuccess, showError, showWarning } from '../utils/messaging';
import { assessmentLogger } from '../utils/assessmentLogger';

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
  CONTENT: 'assessment_content', // Legacy key for backward compatibility
  QUESTION_CONTENT: 'assessment_question_content',
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
  const [questionContent, setQuestionContent] = useState<Record<number, string>>({});
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
        startTimeRef.current = new Date();
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
          
          // Set start time from session storage
          const savedStartTime = sessionStorage.getItem(SESSION_KEYS.START_TIME);
          if (savedStartTime) {
            const parsedTime = parseInt(savedStartTime, 10);
            if (!isNaN(parsedTime)) {
              startTimeRef.current = new Date(parsedTime);
            }
          }
          
          // Get saved content if any
          const savedContent = sessionStorage.getItem(SESSION_KEYS.CONTENT);
          if (savedContent) {
            // Legacy content loading removed - using individual question content now
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
          startTimeRef.current = new Date();
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
        antiCheatMonitor.current.requestFullscreen().catch(err => {
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

  // Handle time updates from Timer component
  const handleTimeUpdate = useCallback((remainingSeconds: number) => {
    setTimeRemaining(remainingSeconds);
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
          // Set the startTimeRef
          const parsedTime = parseInt(startTime, 10);
          if (!isNaN(parsedTime)) {
            startTimeRef.current = new Date(parsedTime);
          }
        } else {
          setTimeRemaining(processedAssessment.timeLimit * 60); // Convert to seconds
          sessionStorage.setItem(SESSION_KEYS.START_TIME, Date.now().toString());
          startTimeRef.current = new Date();
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
          
          // Load saved question content
          const savedContent = sessionStorage.getItem(SESSION_KEYS.QUESTION_CONTENT);
          if (savedContent) {
            try {
              setQuestionContent(JSON.parse(savedContent));
            } catch (e) {
              console.error("Could not parse saved question content", e);
            }
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

  

  // Save selected options to session storage when they change
  useEffect(() => {
    if (Object.keys(selectedOptions).length > 0) {
      sessionStorage.setItem(SESSION_KEYS.SELECTED_OPTIONS, JSON.stringify(selectedOptions));
    }
  }, [selectedOptions]);

  // Save question content to session storage when it changes
  useEffect(() => {
    if (Object.keys(questionContent).length > 0) {
      sessionStorage.setItem(SESSION_KEYS.QUESTION_CONTENT, JSON.stringify(questionContent));
    }
  }, [questionContent]);

  // Handle individual question content updates
  const handleQuestionContentChange = (questionIndex: number, content: string) => {
    setQuestionContent(prev => ({
      ...prev,
      [questionIndex]: content
    }));
  };

  // Timer countdown - REMOVED: Timer component handles all timing logic
  // The Timer component calls handleTimeUp which calls handleSubmit when time expires

  // Tab switch detection
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        const newTabSwitches = tabSwitches + 1;
        setTabSwitches(newTabSwitches);
        // Update session storage
        sessionStorage.setItem(SESSION_KEYS.TAB_SWITCHES, newTabSwitches.toString());
        
        // Log tab switch event
        assessmentLogger.logAssessmentEvent(id || '', user?._id || '', 'TAB_SWITCH', `Tab switch detected. Total: ${newTabSwitches}`);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [tabSwitches, id, user?._id]);

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

  // Validate assessment completion
  const validateAssessmentCompletion = () => {
    if (!assessment) return { isValid: true, warnings: [] };
    
    const warnings: string[] = [];
    
    // Check for unanswered MCQ questions
    if (hasMCQs) {
      assessment.questions.forEach((question, index) => {
        if (question.type === 'mcq') {
          const questionAnswered = selectedOptions[index] && selectedOptions[index].length > 0;
          if (!questionAnswered) {
            warnings.push(`Question ${index + 1}: ${question.questionText.substring(0, 50)}${question.questionText.length > 50 ? '...' : ''}`);
          }
        }
      });
    }
    
    // Check for empty code content if there are descriptive questions
    const hasDescriptiveQuestions = assessment.questions.some(q => q.type === 'descriptive');
    if (hasDescriptiveQuestions) {
      const hasAnyContent = Object.values(questionContent).some(content => content.trim().length > 0);
      if (!hasAnyContent) {
        warnings.push('Your code solution appears to be empty');
      }
    }
    
    return {
      isValid: warnings.length === 0,
      warnings
    };
  };

  // Handle submission with fullscreen recovery
  const handleSubmit = async (isAutoSubmit = false) => {
    if (!user?.token || !id || !assessment) return;
    
    // Validate assessment completion before showing confirmation
    if (!showConfirmSubmit && timeRemaining > 0 && !isAutoSubmit) {
      const validation = validateAssessmentCompletion();
      
      if (!validation.isValid && validation.warnings.length > 0) {
        // Show validation warnings
        const warningMessage = `You have ${validation.warnings.length} incomplete item(s):\n\n${validation.warnings.map(w => `• ${w}`).join('\n')}\n\nDo you want to continue with submission anyway?`;
        
        if (!window.confirm(warningMessage)) {
          return; // User chose to go back and complete the assessment
        }
      }
      
      // Show confirmation dialog if validation passed or user chose to continue
      setShowConfirmSubmit(true);
      return;
    }
    
    try {
      setIsSubmitting(true);
      
      // Exit fullscreen mode if active
      if (antiCheatMonitor.current?.isInFullscreen()) {
        await antiCheatMonitor.current.exitFullscreen();
        
        // Verify viewport restoration
        setTimeout(() => {
          if (document.fullscreenElement) {
            console.error('Fullscreen exit failed, forcing exit');
            document.exitFullscreen().catch(err => {
              console.error('Forced fullscreen exit failed:', err);
            });
          }
        }, 100);
      }
      
      // Prepare submission data - combine all question content
      let submissionContent = '';
      const descriptiveQuestions = assessment?.questions.filter(q => q.type !== 'mcq') || [];
      
      if (descriptiveQuestions.length > 0) {
        // Build submission content from individual question responses
        submissionContent = descriptiveQuestions.map((question) => {
          const questionIndex = assessment!.questions.indexOf(question);
          const content = questionContent[questionIndex] || '';
          return `Question ${questionIndex + 1}: ${question.questionText}\n\n${content}\n\n---\n\n`;
        }).join('');
      }
      
      // If this is an MCQ-only assessment or no descriptive content, send a placeholder
      if (submissionContent.trim() === '') {
        submissionContent = "MCQ Assessment Submission";
      }

      // Get anti-cheat data from monitor
      const violations = antiCheatMonitor.current?.getViolations() || antiCheatViolations;
      const activities = antiCheatMonitor.current?.getActivities() || [];
      const finalTabSwitches = antiCheatMonitor.current?.getTabSwitchCount() || tabSwitches;
      
      // Calculate time spent with proper error handling
      let startTime: Date;
      const sessionStartTime = sessionStorage.getItem(SESSION_KEYS.START_TIME);
      
      if (startTimeRef.current) {
        startTime = startTimeRef.current;
      } else if (sessionStartTime) {
        const parsedTime = parseInt(sessionStartTime, 10);
        if (!isNaN(parsedTime)) {
          startTime = new Date(parsedTime);
        } else {
          startTime = new Date();
          assessmentLogger.logAssessmentError(id || '', user?._id || '', new Error('Invalid start time in session storage'), sessionStartTime);
        }
      } else {
        startTime = new Date();
        assessmentLogger.logAssessmentError(id || '', user?._id || '', new Error('No start time found, using current time'));
      }
      
      const endTime = new Date();
      
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
      sessionStorage.removeItem(SESSION_KEYS.QUESTION_CONTENT);
      // Keep the initial visit flag so we can detect actual page reloads
      
      // Show success message
      showSuccess('Assessment Submitted', 'Your assessment has been successfully submitted!');
      
      // Verify UI restoration before navigation
      setTimeout(() => {
        // Ensure all UI elements are properly restored
        document.body.style.overflow = ''; // Restore scrolling
        document.body.style.padding = ''; // Remove any fullscreen padding
        
        // Redirect to results page after submission
        navigate('/results');
      }, 500); // Small delay to ensure UI restoration
      
    } catch (err: any) {
      setError(err.message || 'Failed to submit assessment.');
      setShowConfirmSubmit(false);
      setIsSubmitting(false);
      showError('Submission Failed', err.message || 'Failed to submit assessment.');
      
      // Log detailed error for debugging
      const currentViolations = antiCheatMonitor.current?.getViolations() || antiCheatViolations;
      const currentActivities = antiCheatMonitor.current?.getActivities() || [];
      assessmentLogger.logSubmissionError(id || '', user?._id || '', err, {
        timeRemaining,
        tabSwitches: tabSwitches,
        violations: currentViolations.length,
        activities: currentActivities.length
      });
    }
  };

  // Handle modal close
  const handleModalClose = useCallback(() => {
    if (!isSubmitting) {
      setShowConfirmSubmit(false);
    }
  }, [isSubmitting]);

  // Handle escape key for modal
  useEffect(() => {
    const handleEscapeKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && showConfirmSubmit) {
        handleModalClose();
      }
    };

    if (showConfirmSubmit) {
      document.addEventListener('keydown', handleEscapeKey);
      // Prevent body scroll when modal is open
      document.body.style.overflow = 'hidden';
      
      // Focus management: focus the confirm button when modal opens
      const confirmButton = document.querySelector('[role="dialog"] button[autofocus]') as HTMLButtonElement;
      if (confirmButton) {
        confirmButton.focus();
      }
    }

    return () => {
      document.removeEventListener('keydown', handleEscapeKey);
      document.body.style.overflow = '';
    };
  }, [showConfirmSubmit, handleModalClose]);

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
          <div className="mb-6 p-4 bg-gradient-to-r from-red-50 to-orange-50 border-l-4 border-red-500 rounded-r-lg shadow-sm">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-red-500" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-red-800">Page Refresh Detected</h3>
                <p className="text-sm text-red-700 mt-1">Please avoid refreshing the page during an assessment. Your progress has been preserved.</p>
              </div>
            </div>
          </div>
        )}

        {/* Advanced Timer Component - Auto-starts when assessment begins */}
        <div className="mb-6">
          <Timer
            totalSeconds={timeRemaining}
            onTimeUp={handleTimeUp}
            onTimeWarning={handleTimeWarning}
            onTimeUpdate={handleTimeUpdate}
            warningThresholds={[300, 120, 60, 30]}
            autoPauseOnBlur={assessment?.antiCheatEnabled}
            showProgress={true}
            size="large"
            label="Assessment Time Remaining"
          />
        </div>
        
        <div className="mb-8">
          <div className="bg-gradient-to-br from-white to-gray-50 shadow-lg rounded-xl overflow-hidden border border-gray-100">
            <div className="px-6 py-5 border-b border-gray-100 bg-gradient-to-r from-blue-50 to-indigo-50">
              <h2 className="text-xl font-semibold text-gray-900 flex items-center">
                <svg className="h-5 w-5 text-blue-600 mr-2" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                </svg>
                Assessment Instructions
              </h2>
            </div>
            <div className="px-6 py-6">
              <p className="text-gray-700 whitespace-pre-wrap leading-relaxed">{assessment.description}</p>
              
              {tabSwitches > 0 && (
                <div className="mt-6 p-4 bg-gradient-to-r from-yellow-50 to-orange-50 border-l-4 border-yellow-400 rounded-r-lg shadow-sm">
                  <div className="flex items-center">
                    <div className="flex-shrink-0">
                      <svg className="h-5 w-5 text-yellow-500" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                      </svg>
                    </div>
                    <div className="ml-3">
                      <h3 className="text-sm font-medium text-yellow-800">Tab Switch Detected</h3>
                      <p className="text-sm text-yellow-700 mt-1">
                        You have switched tabs <span className="font-semibold">{tabSwitches} time(s)</span>. This activity will be recorded with your submission.
                      </p>
                    </div>
                  </div>
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
        <div className="mb-8 space-y-8">
          {assessment.questions.map((question, index) => (
            <div key={index} className="bg-gradient-to-br from-white to-gray-50 shadow-xl rounded-2xl p-8 border border-gray-100 hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-1">
              <div className="mb-6">
                <div className="flex items-start justify-between mb-4">
                  <h3 className="text-xl font-bold text-gray-900 leading-tight">
                    <span className="text-blue-600 font-extrabold">Question {index + 1}:</span> {question.questionText}
                  </h3>
                  <div className="flex items-center space-x-3">
                    {question.categoryName && (
                      <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-gradient-to-r from-blue-100 to-indigo-100 text-blue-800 border border-blue-200">
                        <svg className="h-4 w-4 mr-1" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M17.707 9.293a1 1 0 010 1.414l-7 7a1 1 0 01-1.414 0l-7-7A.997.997 0 012 10V5a3 3 0 013-3h5c.256 0 .512.098.707.293l7 7zM5 6a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
                        </svg>
                        {question.categoryName}
                      </span>
                    )}
                    <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-semibold bg-gradient-to-r from-green-100 to-emerald-100 text-green-800 border border-green-200">
                      <svg className="h-4 w-4 mr-1" viewBox="0 0 20 20" fill="currentColor">
                        <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                      </svg>
                      {question.maxPoints} pts
                    </span>
                  </div>
                </div>
              </div>
              
              <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-100 rounded-xl p-6 mb-6 shadow-inner">
                <div className="flex items-start">
                  <svg className="h-5 w-5 text-blue-600 mt-0.5 mr-3 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                  </svg>
                  <p className="text-gray-700 leading-relaxed">{question.instructions}</p>
                </div>
              </div>
              
              {question.type === 'mcq' && question.options && (
                <div className="mt-4">
                  <fieldset className="space-y-2">
                    <legend className="block text-sm font-medium text-gray-700 mb-2">
                      Select {question.options.filter(o => o.isCorrect).length > 1 ? 'all that apply' : 'one option'}:
                    </legend>
                    {question.options.map((option, optionIndex) => {
                      const isSelected = selectedOptions[index]?.includes(option.text) || false;
                      const inputType = question.options!.filter(o => o.isCorrect).length > 1 ? 'checkbox' : 'radio';
                      const inputId = `question-${index}-option-${optionIndex}`;
                      
                      return (
                        <div key={optionIndex} className="relative">
                          <input
                            type={inputType}
                            id={inputId}
                            name={`question-${index}`}
                            value={option.text}
                            checked={isSelected}
                            onChange={() => handleOptionSelect(index, option.text)}
                            className="sr-only"
                            aria-describedby={`${inputId}-label`}
                          />
                          <label
                            htmlFor={inputId}
                            className={`block p-3 border rounded-md cursor-pointer transition-colors ${
                              isSelected 
                                ? 'bg-blue-50 border-blue-300 ring-2 ring-blue-200' 
                                : 'hover:bg-gray-50 border-gray-300 hover:border-gray-400'
                            }`}
                            id={`${inputId}-label`}
                          >
                            <div className="flex items-center">
                              <div className="shrink-0 mr-3">
                                {inputType === 'checkbox' ? (
                                  <div className={`h-5 w-5 border ${isSelected ? 'bg-blue-600 border-blue-600' : 'border-gray-300'} rounded flex items-center justify-center transition-colors`}>
                                    {isSelected && (
                                      <svg className="h-3 w-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 111.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                      </svg>
                                    )}
                                  </div>
                                ) : (
                                  <div className={`h-5 w-5 border ${isSelected ? 'bg-blue-600 border-blue-600' : 'border-gray-300'} rounded-full flex items-center justify-center transition-colors`}>
                                    {isSelected && (
                                      <div className="h-3 w-3 rounded-full bg-white"></div>
                                    )}
                                  </div>
                                )}
                              </div>
                              <span className="text-gray-700 flex-1">{option.text}</span>
                            </div>
                          </label>
                        </div>
                      );
                    })}
                  </fieldset>
                </div>
              )}
              
              {/* Individual editor for descriptive questions */}
              {question.type !== 'mcq' && (
                <div className="mt-8">
                  <div className="flex items-center mb-4">
                    <svg className="h-5 w-5 text-green-600 mr-2" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 111.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                    <h4 className="text-lg font-semibold text-gray-900">Your Answer:</h4>
                  </div>
                  <div className="h-80 border-2 border-gray-200 rounded-xl shadow-inner bg-white overflow-hidden">
                    <SecureNotepad 
                      value={questionContent[index] || ''} 
                      onChange={(content) => handleQuestionContentChange(index, content)} 
                    />
                  </div>
                  <div className="mt-3 flex items-center text-sm text-gray-500">
                    <svg className="h-4 w-4 mr-1" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                    </svg>
                    Type your response in the editor above. Your work is automatically saved.
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Individual editors are now rendered within each question */}
        
        {/* Submit button */}
        <div className="flex justify-end mt-8">
          <button
            onClick={() => handleSubmit()}
            disabled={isSubmitting}
            className={`group relative inline-flex items-center px-8 py-4 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-bold rounded-xl shadow-lg hover:from-blue-700 hover:to-indigo-700 focus:outline-none focus:ring-4 focus:ring-blue-500 focus:ring-opacity-50 transform hover:-translate-y-1 transition-all duration-200 ${
              isSubmitting ? 'opacity-75 cursor-not-allowed transform-none' : ''
            }`}
          >
            <span className="absolute left-0 inset-y-0 flex items-center pl-3">
              {isSubmitting ? (
                <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
              ) : (
                <svg className="h-5 w-5 text-white group-hover:text-blue-100" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
              )}
            </span>
            <span className="ml-8">
              {isSubmitting ? 'Submitting Assessment...' : 'Submit Assessment'}
            </span>
          </button>
        </div>

        {/* Confirmation dialog */}
        {showConfirmSubmit && (
          <div 
            className="fixed inset-0 bg-black bg-opacity-60 backdrop-blur-sm flex items-center justify-center z-50 animate-fadeIn"
            role="dialog"
            aria-modal="true"
            aria-labelledby="confirm-submission-title"
            aria-describedby="confirm-submission-description"
            onClick={handleModalClose}
          >
            <div 
              className="bg-white rounded-2xl p-8 max-w-lg w-full mx-4 shadow-2xl transform animate-scaleIn"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="text-center mb-6">
                <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-gradient-to-r from-yellow-100 to-orange-100 mb-4">
                  <svg className="h-8 w-8 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                </div>
                <h3 
                  id="confirm-submission-title"
                  className="text-2xl font-bold text-gray-900 mb-3"
                >
                  Ready to Submit?
                </h3>
                <p 
                  id="confirm-submission-description"
                  className="text-gray-600 leading-relaxed"
                >
                  Are you sure you want to submit your assessment? This action cannot be undone and you won't be able to make any changes after submission.
                </p>
              </div>
              
              <div className="bg-gray-50 rounded-xl p-4 mb-6">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600">Questions Answered:</span>
                  <span className="font-semibold text-gray-900">
                    {Object.keys(selectedOptions).filter(key => selectedOptions[key as any].length > 0).length + Object.keys(questionContent).filter(key => questionContent[key as any].trim().length > 0).length} / {assessment.questions.length}
                  </span>
                </div>
              </div>
              
              <div className="flex space-x-4">
                <button
                  onClick={handleModalClose}
                  className="flex-1 px-6 py-3 border-2 border-gray-300 text-gray-700 font-semibold rounded-xl hover:bg-gray-50 focus:outline-none focus:ring-4 focus:ring-gray-500 focus:ring-opacity-25 transition-all duration-200 transform hover:-translate-y-0.5"
                  disabled={isSubmitting}
                  type="button"
                >
                  Go Back
                </button>
                <button
                  onClick={() => handleSubmit()}
                  className="flex-1 px-6 py-3 bg-gradient-to-r from-green-600 to-emerald-600 text-white font-bold rounded-xl hover:from-green-700 hover:to-emerald-700 focus:outline-none focus:ring-4 focus:ring-green-500 focus:ring-opacity-25 transition-all duration-200 transform hover:-translate-y-0.5 disabled:opacity-75 disabled:cursor-not-allowed disabled:transform-none"
                  disabled={isSubmitting}
                  type="button"
                  autoFocus
                >
                  {isSubmitting ? (
                    <span className="flex items-center justify-center">
                      <svg className="animate-spin h-5 w-5 mr-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Submitting...
                    </span>
                  ) : (
                    'Submit Now'
                  )}
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