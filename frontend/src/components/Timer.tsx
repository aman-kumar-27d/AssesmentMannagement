import React, { useState, useEffect, useCallback } from 'react';
import { Clock, AlertTriangle } from 'lucide-react';

export interface TimerProps {
  totalSeconds: number;
  onTimeUp: () => void;
  onTimeWarning?: (remainingSeconds: number) => void;
  onTimeUpdate?: (remainingSeconds: number) => void; // Callback for time updates
  warningThresholds?: number[]; // Warning at these remaining seconds
  autoPauseOnBlur?: boolean;
  showProgress?: boolean;
  size?: 'small' | 'medium' | 'large';
  className?: string;
  label?: string;
}

export interface TimerState {
  remainingSeconds: number;
  isRunning: boolean;
  isPaused: boolean;
  totalSeconds: number;
  timeSpent: number;
}

const Timer: React.FC<TimerProps> = ({
  totalSeconds,
  onTimeUp,
  onTimeWarning,
  onTimeUpdate,
  warningThresholds = [300, 120, 60, 30], // 5min, 2min, 1min, 30sec
  autoPauseOnBlur = false,
  showProgress = true,
  size = 'medium',
  className = '',
  label = 'Time Remaining'
}) => {
  const [state, setState] = useState<TimerState>({
    remainingSeconds: totalSeconds,
    isRunning: true, // Auto-start timer
    isPaused: false,
    totalSeconds,
    timeSpent: 0,
  });

  const [warningsTriggered, setWarningsTriggered] = useState<Set<number>>(new Set());

  const formatTime = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    if (hours > 0) {
      return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const getTimeColor = (remainingSeconds: number): string => {
    if (remainingSeconds <= 30) return 'text-red-600';
    if (remainingSeconds <= 120) return 'text-orange-600';
    if (remainingSeconds <= 300) return 'text-yellow-600';
    return 'text-gray-700';
  };

  const getProgressColor = (remainingSeconds: number): string => {
    if (remainingSeconds <= 30) return 'bg-red-500';
    if (remainingSeconds <= 120) return 'bg-orange-500';
    if (remainingSeconds <= 300) return 'bg-yellow-500';
    return 'bg-green-500';
  };

  const checkWarnings = useCallback((remainingSeconds: number) => {
    warningThresholds.forEach(threshold => {
      if (remainingSeconds <= threshold && !warningsTriggered.has(threshold)) {
        setWarningsTriggered(prev => new Set([...prev, threshold]));
        onTimeWarning?.(remainingSeconds);
      }
    });
  }, [warningThresholds, warningsTriggered, onTimeWarning]);

  useEffect(() => {
    if (!state.isRunning || state.isPaused) return;

    const interval = setInterval(() => {
      setState(prev => {
        const newRemaining = prev.remainingSeconds - 1;
        const newTimeSpent = prev.timeSpent + 1;

        if (newRemaining <= 0) {
          clearInterval(interval);
          onTimeUp();
          return {
            ...prev,
            remainingSeconds: 0,
            isRunning: false,
            timeSpent: newTimeSpent,
          };
        }

        checkWarnings(newRemaining);
        
        // Notify parent component of time update
        if (onTimeUpdate) {
          onTimeUpdate(newRemaining);
        }

        return {
          ...prev,
          remainingSeconds: newRemaining,
          timeSpent: newTimeSpent,
        };
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [state.isRunning, state.isPaused, onTimeUp, checkWarnings, onTimeUpdate]);

  useEffect(() => {
    if (autoPauseOnBlur) {
      const handleVisibilityChange = () => {
        setState(prev => ({
          ...prev,
          isPaused: document.hidden,
        }));
      };

      document.addEventListener('visibilitychange', handleVisibilityChange);
      return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
    }
  }, [autoPauseOnBlur]);

  const getSizeClasses = () => {
    switch (size) {
      case 'small':
        return 'text-sm p-2';
      case 'large':
        return 'text-xl p-4';
      default:
        return 'text-base p-3';
    }
  };

  const getIconSize = () => {
    switch (size) {
      case 'small':
        return 'w-4 h-4';
      case 'large':
        return 'w-8 h-8';
      default:
        return 'w-6 h-6';
    }
  };

  const progressPercentage = (state.remainingSeconds / state.totalSeconds) * 100;
  const isWarning = state.remainingSeconds <= 120;
  const isCritical = state.remainingSeconds <= 30;

  // Generate ARIA label for time remaining
  const getAriaLabel = () => {
    const hours = Math.floor(state.remainingSeconds / 3600);
    const minutes = Math.floor((state.remainingSeconds % 3600) / 60);
    const seconds = state.remainingSeconds % 60;
    
    if (hours > 0) {
      return `${hours} hours, ${minutes} minutes, ${seconds} seconds remaining`;
    } else if (minutes > 0) {
      return `${minutes} minutes, ${seconds} seconds remaining`;
    } else {
      return `${seconds} seconds remaining`;
    }
  };

  // Generate live region text for critical time warnings
  const getLiveRegionText = () => {
    if (state.remainingSeconds === 0) return 'Time is up!';
    if (state.remainingSeconds === 60) return 'Warning: 1 minute remaining';
    if (state.remainingSeconds === 30) return 'Critical: 30 seconds remaining';
    if (state.remainingSeconds === 10) return 'Critical: 10 seconds remaining';
    if (state.remainingSeconds <= 5 && state.remainingSeconds > 0) return `${state.remainingSeconds} seconds remaining`;
    return '';
  };

  return (
    <div className={`bg-white rounded-lg shadow-md p-4 ${className}`} role="timer" aria-label={label}>
      {/* Live region for critical time announcements */}
      <div 
        className="sr-only" 
        role="status" 
        aria-live="assertive" 
        aria-atomic="true"
      >
        {getLiveRegionText()}
      </div>
      
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center space-x-2">
          <Clock className={`${getIconSize()} ${getTimeColor(state.remainingSeconds)}`} aria-hidden="true" />
          <span className="text-sm font-medium text-gray-700">{label}</span>
        </div>
        
        <div className="flex items-center space-x-2">
          {isCritical && (
            <AlertTriangle className="w-5 h-5 text-red-500 animate-pulse" aria-hidden="true" />
          )}
          <span 
            className={`font-mono font-bold ${getTimeColor(state.remainingSeconds)} ${getSizeClasses()}`}
            aria-label={getAriaLabel()}
            role="text"
          >
            {formatTime(state.remainingSeconds)}
          </span>
        </div>
      </div>

      {showProgress && (
        <div className="w-full bg-gray-200 rounded-full h-2 mb-3" role="progressbar" aria-valuenow={state.remainingSeconds} aria-valuemin={0} aria-valuemax={state.totalSeconds} aria-label="Time remaining progress">
          <div
            className={`h-2 rounded-full transition-all duration-300 ${getProgressColor(state.remainingSeconds)}`}
            style={{ width: `${progressPercentage}%` }}
            aria-hidden="true"
          />
        </div>
      )}

      <div className="flex justify-between text-xs text-gray-500 mb-3">
        <span>Time Spent: {formatTime(state.timeSpent)}</span>
        <span>Total: {formatTime(state.totalSeconds)}</span>
      </div>

      {/* Timer controls removed - assessment timer is strictly controlled and cannot be manually modified */}
      <div className="flex justify-center space-x-2">
        <div className="text-xs text-gray-500 px-3 py-1">
          Timer is strictly controlled during assessment
        </div>
      </div>

      {isWarning && (
        <div className="mt-3 p-2 bg-yellow-50 border border-yellow-200 rounded-md">
          <div className="flex items-center space-x-2">
            <AlertTriangle className="w-4 h-4 text-yellow-600" />
            <span className="text-sm text-yellow-800">
              {isCritical ? 'Time is running out!' : 'Warning: Limited time remaining'}
            </span>
          </div>
        </div>
      )}
    </div>
  );
};

export default Timer;