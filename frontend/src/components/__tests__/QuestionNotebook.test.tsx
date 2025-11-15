import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '../../test/test-utils';
import QuestionNotebook from '../QuestionNotebook';

describe('QuestionNotebook Component', () => {
  const mockOnChange = vi.fn();
  
  beforeEach(() => {
    mockOnChange.mockClear();
    // Clear session storage before each test
    sessionStorage.clear();
  });

  it('should render with initial content', () => {
    render(
      <QuestionNotebook
        questionId="question-1"
        questionIndex={0}
        value="Initial note content"
        onChange={mockOnChange}
      />
    );

    expect(screen.getByText(/Question 1 Notes/i)).toBeInTheDocument();
    expect(screen.getByRole('textbox')).toHaveValue('Initial note content');
  });

  it('should render as collapsed by default', () => {
    render(
      <QuestionNotebook
        questionId="question-1"
        questionIndex={0}
        value=""
        onChange={mockOnChange}
      />
    );

    // Should show the collapsed header
    expect(screen.getByText(/Question 1 Notes/i)).toBeInTheDocument();
    expect(screen.getByText(/Click to expand/i)).toBeInTheDocument();
    
    // Textarea should not be visible when collapsed
    expect(screen.getByRole('textbox')).toHaveClass('hidden');
  });

  it('should expand when header is clicked', async () => {
    render(
      <QuestionNotebook
        questionIndex={0}
        questionId="question-1"
        value=""
        onChange={mockOnChange}
      />
    );

    const header = screen.getByText(/Question 1 Notes/i).closest('div');
    fireEvent.click(header!);

    await waitFor(() => {
      expect(screen.getByRole('textbox')).not.toHaveClass('hidden');
      expect(screen.getByText(/Click to collapse/i)).toBeInTheDocument();
    });
  });

  it('should handle content changes', async () => {
    render(
      <QuestionNotebook
        questionId="question-1"
        questionIndex={0}
        value=""
        onChange={mockOnChange}
      />
    );

    // Expand the notebook first
    const header = screen.getByText(/Question 1 Notes/i).closest('div');
    fireEvent.click(header!);

    const textarea = screen.getByRole('textbox');
    fireEvent.change(textarea, { target: { value: 'New note content' } });

    await waitFor(() => {
      expect(mockOnChange).toHaveBeenCalledWith('New note content');
      expect(textarea).toHaveValue('New note content');
    });
  });

  it('should update character count', async () => {
    render(
      <QuestionNotebook
        questionIndex={0}
        questionId="question-1"
        value="Test content"
        onChange={mockOnChange}
      />
    );

    // Expand the notebook
    const header = screen.getByText(/Question 1 Notes/i).closest('div');
    fireEvent.click(header!);

    expect(screen.getByText(/12 characters/i)).toBeInTheDocument();

    const textarea = screen.getByRole('textbox');
    fireEvent.change(textarea, { target: { value: 'Updated test content' } });

    await waitFor(() => {
      expect(screen.getByText(/20 characters/i)).toBeInTheDocument();
    });
  });

  it('should prevent copy and paste operations', () => {
    render(
      <QuestionNotebook
        questionId="question-1"
        questionIndex={0}
        value="Test content"
        onChange={mockOnChange}
      />
    );

    // Expand the notebook
    const header = screen.getByText(/Question 1 Notes/i).closest('div');
    fireEvent.click(header!);

    const textarea = screen.getByRole('textbox');

    // Test copy prevention
    const copyEvent = new ClipboardEvent('copy', { bubbles: true });
    const preventCopySpy = vi.spyOn(copyEvent, 'preventDefault');
    textarea.dispatchEvent(copyEvent);
    expect(preventCopySpy).toHaveBeenCalled();

    // Test paste prevention
    const pasteEvent = new ClipboardEvent('paste', { bubbles: true });
    const preventPasteSpy = vi.spyOn(pasteEvent, 'preventDefault');
    textarea.dispatchEvent(pasteEvent);
    expect(preventPasteSpy).toHaveBeenCalled();
  });

  it('should persist content to session storage', async () => {
    render(
      <QuestionNotebook
        questionId="question-1"
        questionIndex={0}
        value=""
        onChange={mockOnChange}
      />
    );

    // Expand the notebook
    const header = screen.getByText(/Question 1 Notes/i).closest('div');
    fireEvent.click(header!);

    const textarea = screen.getByRole('textbox');
    fireEvent.change(textarea, { target: { value: 'Persisted content' } });

    await waitFor(() => {
      // Check session storage
      const storedContent = sessionStorage.getItem('question_note_question-1');
      expect(storedContent).toBe('Persisted content');
    });
  });

  it('should load content from session storage on mount', () => {
    // Pre-populate session storage
    sessionStorage.setItem('question_note_question-2', 'Stored content');

    render(
      <QuestionNotebook
        questionIndex={1}
        questionId="question-2"
        value="Initial content"
        onChange={mockOnChange}
      />
    );

    // Expand the notebook
    const header = screen.getByText(/Question 2 Notes/i).closest('div');
    fireEvent.click(header!);

    // Should load from session storage, not initial content
    expect(screen.getByRole('textbox')).toHaveValue('Stored content');
  });

  it('should handle different question indices correctly', () => {
    const { rerender } = render(
      <QuestionNotebook
        questionIndex={0}
        questionId="question-1"
        value="Question 1 notes"
        onChange={mockOnChange}
      />
    );

    expect(screen.getByText(/Question 1 Notes/i)).toBeInTheDocument();

    rerender(
      <QuestionNotebook
        questionIndex={2}
        questionId="question-3"
        value="Question 3 notes"
        onChange={mockOnChange}
      />
    );

    expect(screen.getByText(/Question 3 Notes/i)).toBeInTheDocument();
  });

  it('should handle keyboard navigation', async () => {
    render(
      <QuestionNotebook
        questionId="question-1"
        questionIndex={0}
        value=""
        onChange={mockOnChange}
      />
    );

    const header = screen.getByText(/Question 1 Notes/i).closest('div');
    
    // Test Enter key
    fireEvent.keyDown(header!, { key: 'Enter', code: 'Enter' });
    
    await waitFor(() => {
      expect(screen.getByRole('textbox')).not.toHaveClass('hidden');
    });

    // Test Space key
    fireEvent.keyDown(header!, { key: ' ', code: 'Space' });
    
    await waitFor(() => {
      expect(screen.getByRole('textbox')).toHaveClass('hidden');
    });
  });
});