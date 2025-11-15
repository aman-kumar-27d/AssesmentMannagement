import { useState, useEffect, useRef } from 'react';

interface QuestionNotebookProps {
  questionId: string;
  questionIndex: number;
  value: string;
  onChange: (questionId: string, value: string) => void;
  placeholder?: string;
  readOnly?: boolean;
}

const QuestionNotebook: React.FC<QuestionNotebookProps> = ({
  questionId,
  questionIndex,
  value,
  onChange,
  placeholder = 'Add notes for this question...',
  readOnly = false,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Disable context menu (right-click) and keyboard shortcuts for security
  useEffect(() => {
    const handleContextMenu = (e: MouseEvent) => {
      if (textareaRef.current && textareaRef.current.contains(e.target as Node)) {
        e.preventDefault();
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      // Check if textarea is focused
      if (document.activeElement === textareaRef.current) {
        // Prevent copy (Ctrl+C, Command+C)
        if ((e.ctrlKey || e.metaKey) && e.key === 'c') {
          e.preventDefault();
        }
        
        // Prevent cut (Ctrl+X, Command+X)
        if ((e.ctrlKey || e.metaKey) && e.key === 'x') {
          e.preventDefault();
        }
        
        // Prevent paste (Ctrl+V, Command+V)
        if ((e.ctrlKey || e.metaKey) && e.key === 'v') {
          e.preventDefault();
        }
      }
    };

    // Add event listeners
    document.addEventListener('contextmenu', handleContextMenu);
    document.addEventListener('keydown', handleKeyDown);

    // Clean up event listeners
    return () => {
      document.removeEventListener('contextmenu', handleContextMenu);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    onChange(questionId, e.target.value);
  };

  const toggleExpanded = () => {
    setIsExpanded(!isExpanded);
  };

  const characterCount = value.length;

  return (
    <div className={`border rounded-md transition-all duration-200 ${
      isFocused ? 'border-blue-500 ring-2 ring-blue-200' : 'border-gray-300'
    } ${isExpanded ? 'mb-4' : 'mb-2'}`}>
      {/* Notebook Header */}
      <div 
        className="flex items-center justify-between p-3 bg-gray-50 cursor-pointer hover:bg-gray-100 transition-colors"
        onClick={toggleExpanded}
      >
        <div className="flex items-center space-x-2">
          <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
          </svg>
          <span className="text-sm font-medium text-gray-700">
            Question {questionIndex + 1} Notes
          </span>
          {characterCount > 0 && (
            <span className="text-xs text-gray-500 bg-gray-200 px-2 py-1 rounded-full">
              {characterCount}
            </span>
          )}
        </div>
        <svg 
          className={`w-4 h-4 text-gray-600 transform transition-transform ${
            isExpanded ? 'rotate-180' : ''
          }`} 
          fill="none" 
          stroke="currentColor" 
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </div>

      {/* Notebook Content */}
      {isExpanded && (
        <div className="p-3 border-t border-gray-200">
          <textarea
            ref={textareaRef}
            value={value}
            onChange={handleChange}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            placeholder={placeholder}
            readOnly={readOnly}
            className={`w-full px-3 py-2 min-h-[120px] rounded-md focus:outline-none resize-y text-sm ${
              readOnly ? 'bg-gray-50 cursor-not-allowed' : 'bg-white'
            }`}
            onCopy={(e) => e.preventDefault()}
            onCut={(e) => e.preventDefault()}
            onPaste={(e) => e.preventDefault()}
          />
          <div className="flex justify-between items-center mt-2">
            <div className="text-xs text-gray-400">
              Notes are saved automatically for this question
            </div>
            <div className="text-xs text-gray-400">
              {characterCount} characters
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default QuestionNotebook;