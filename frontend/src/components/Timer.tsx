import React, { useState, useEffect, useCallback } from 'react';
import { Clock, AlertTriangle, Pause, Play, RefreshCw } from 'lucide-react';

export interface TimerProps {
  totalSeconds: number;
  onTimeUp: () => void;
  onTimeWarning?: (remainingSeconds: number) => void;
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
  warningThresholds = [300, 120, 60, 30], // 5min, 2min, 1min, 30sec
  autoPauseOnBlur = false,
  showProgress = true,
  size = 'medium',
  className = '',
  label = 'Time Remaining'
}) => {
  const [state, setState] = useState<TimerState>({
    remainingSeconds: totalSeconds,
    isRunning: false,
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
    const percentage = remainingSeconds / totalSeconds;
    
    if (remainingSeconds <= 30) return 'text-red-600';
    if (remainingSeconds <= 120) return 'text-orange-600';
    if (remainingSeconds <= 300) return 'text-yellow-600';
    return 'text-gray-700';
  };

  const getProgressColor = (remainingSeconds: number): string => {
    const percentage = remainingSeconds / totalSeconds;
    
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

        return {
          ...prev,
          remainingSeconds: newRemaining,
          timeSpent: newTimeSpent,
        };
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [state.isRunning, state.isPaused, onTimeUp, checkWarnings]);

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

  const start = () => {
    setState(prev => ({
      ...prev,
      isRunning: true,
      isPaused: false,
    }));
  };

  const pause = () => {
    setState(prev => ({
      ...prev,
      isPaused: !prev.isPaused,
    }));
  };

  const reset = () => {
    setState({
      remainingSeconds: totalSeconds,
      isRunning: false,
      isPaused: false,
      totalSeconds,
      timeSpent: 0,
    });
    setWarningsTriggered(new Set());
  };

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

  return (
    <div className={`bg-white rounded-lg shadow-md p-4 ${className}`}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center space-x-2">
          <Clock className={`${getIconSize()} ${getTimeColor(state.remainingSeconds)}`} />
          <span className="text-sm font-medium text-gray-700">{label}</span>
        </div>
        
        <div className="flex items-center space-x-2">
          {isCritical && (
            <AlertTriangle className="w-5 h-5 text-red-500 animate-pulse" />
          )}
          <span className={`font-mono font-bold ${getTimeColor(state.remainingSeconds)} ${getSizeClasses()}`}>
            {formatTime(state.remainingSeconds)}
          </span>
        </div>
      </div>

      {showProgress && (
        <div className="w-full bg-gray-200 rounded-full h-2 mb-3">
          <div
            className={`h-2 rounded-full transition-all duration-300 ${getProgressColor(state.remainingSeconds)}`}
            style={{ width: `${progressPercentage}%` }}
          />
        </div>
      )}

      <div className="flex justify-between text-xs text-gray-500 mb-3">
        <span>Time Spent: {formatTime(state.timeSpent)}</span>
        <span>Total: {formatTime(state.totalSeconds)}</span>
      </div>

      <div className="flex justify-center space-x-2">
        {!state.isRunning ? (
          <button
            onClick={start}
            className="flex items-center space-x-1 px-3 py-1 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <Play className="w-4 h-4" />
            <span>Start</span>
          </button>
        ) : (
          <button
            onClick={pause}
            className="flex items-center space-x-1 px-3 py-1 bg-yellow-600 text-white rounded-md hover:bg-yellow-700 focus:outline-none focus:ring-2 focus:ring-yellow-500"
          >
            {state.isPaused ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
            <span>{state.isPaused ? 'Resume' : 'Pause'}</span>
          </button>
        )}
        
        <button
          onClick={reset}
          className="flex items-center space-x-1 px-3 py-1 bg-gray-600 text-white rounded-md hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-500"
        >
          <RefreshCw className="w-4 h-4" />
          <span>Reset</span>
        </button>
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