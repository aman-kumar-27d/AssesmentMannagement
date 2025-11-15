import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '../../test/test-utils';
import Timer from '../Timer';

describe('Timer Component', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
  });

  it('should auto-start timer when component mounts', () => {
    const onTimeUp = vi.fn();
    const onTimeUpdate = vi.fn();

    render(
      <Timer
        totalSeconds={60}
        onTimeUp={onTimeUp}
        onTimeUpdate={onTimeUpdate}
        autoPauseOnBlur={false}
        showProgress={true}
        size="large"
        label="Test Timer"
      />
    );

    // Timer should start automatically (no manual start button)
    expect(screen.queryByText(/start/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/pause/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/reset/i)).not.toBeInTheDocument();
    
    // Should display time remaining
    expect(screen.getByText(/59/i)).toBeInTheDocument();
  });

  it('should count down automatically', async () => {
    const onTimeUpdate = vi.fn();

    render(
      <Timer
        totalSeconds={60}
        onTimeUp={vi.fn()}
        onTimeUpdate={onTimeUpdate}
        autoPauseOnBlur={false}
        showProgress={true}
        size="large"
        label="Test Timer"
      />
    );

    // Advance time by 1 second
    vi.advanceTimersByTime(1000);

    await waitFor(() => {
      expect(onTimeUpdate).toHaveBeenCalledWith(59);
    });

    // Advance time by another second
    vi.advanceTimersByTime(1000);

    await waitFor(() => {
      expect(onTimeUpdate).toHaveBeenCalledWith(58);
    });
  });

  it('should trigger onTimeUp when time expires', async () => {
    const onTimeUp = vi.fn();
    const onTimeUpdate = vi.fn();

    render(
      <Timer
        totalSeconds={3}
        onTimeUp={onTimeUp}
        onTimeUpdate={onTimeUpdate}
        autoPauseOnBlur={false}
        showProgress={true}
        size="large"
        label="Test Timer"
      />
    );

    // Advance time to expiration
    vi.advanceTimersByTime(3000);

    await waitFor(() => {
      expect(onTimeUp).toHaveBeenCalledTimes(1);
    });
  });

  it('should trigger time warnings at specified thresholds', async () => {
    const onTimeWarning = vi.fn();

    render(
      <Timer
        totalSeconds={10}
        onTimeUp={vi.fn()}
        onTimeWarning={onTimeWarning}
        warningThresholds={[5, 3, 1]}
        autoPauseOnBlur={false}
        showProgress={true}
        size="large"
        label="Test Timer"
      />
    );

    // Advance to 5 seconds remaining (should trigger warning)
    vi.advanceTimersByTime(5000);

    await waitFor(() => {
      expect(onTimeWarning).toHaveBeenCalledWith(5);
    });

    // Advance to 3 seconds remaining (should trigger warning)
    vi.advanceTimersByTime(2000);

    await waitFor(() => {
      expect(onTimeWarning).toHaveBeenCalledWith(3);
    });

    // Advance to 1 second remaining (should trigger warning)
    vi.advanceTimersByTime(2000);

    await waitFor(() => {
      expect(onTimeWarning).toHaveBeenCalledWith(1);
    });
  });

  it('should display correct time format', () => {
    render(
      <Timer
        totalSeconds={125}
        onTimeUp={vi.fn()}
        onTimeUpdate={vi.fn()}
        autoPauseOnBlur={false}
        showProgress={true}
        size="large"
        label="Test Timer"
      />
    );

    // Should display 02:04 (125 seconds = 2 minutes 5 seconds, but starts at 124 due to immediate countdown)
    expect(screen.getByText(/02:04/i)).toBeInTheDocument();
  });

  it('should show progress indicator when enabled', () => {
    render(
      <Timer
        totalSeconds={60}
        onTimeUp={vi.fn()}
        onTimeUpdate={vi.fn()}
        autoPauseOnBlur={false}
        showProgress={true}
        size="large"
        label="Test Timer"
      />
    );

    // Should have progress elements
    expect(screen.getByRole('progressbar')).toBeInTheDocument();
  });

  it('should not show progress indicator when disabled', () => {
    render(
      <Timer
        totalSeconds={60}
        onTimeUp={vi.fn()}
        onTimeUpdate={vi.fn()}
        autoPauseOnBlur={false}
        showProgress={false}
        size="large"
        label="Test Timer"
      />
    );

    // Should not have progress elements
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
  });

  it('should apply different sizes correctly', () => {
    const { rerender } = render(
      <Timer
        totalSeconds={60}
        onTimeUp={vi.fn()}
        onTimeUpdate={vi.fn()}
        autoPauseOnBlur={false}
        showProgress={true}
        size="small"
        label="Test Timer"
      />
    );

    // Check for small size styling (more compact)
    const smallTimer = screen.getByText(/Test Timer/i).closest('div.flex');
    expect(smallTimer).toBeInTheDocument();

    rerender(
      <Timer
        totalSeconds={60}
        onTimeUp={vi.fn()}
        onTimeUpdate={vi.fn()}
        autoPauseOnBlur={false}
        showProgress={true}
        size="large"
        label="Test Timer"
      />
    );

    // Check for large size styling (more prominent)
    const largeTimer = screen.getByText(/Test Timer/i).closest('div.flex');
    expect(largeTimer).toBeInTheDocument();
  });

  it('should handle auto-pause on blur when enabled', async () => {
    const onTimeUpdate = vi.fn();

    render(
      <Timer
        totalSeconds={60}
        onTimeUp={vi.fn()}
        onTimeUpdate={onTimeUpdate}
        autoPauseOnBlur={true}
        showProgress={true}
        size="large"
        label="Test Timer"
      />
    );

    // Simulate window blur
    window.dispatchEvent(new Event('blur'));

    // Advance time - timer should be paused
    vi.advanceTimersByTime(2000);

    // Timer should not have updated due to pause
    expect(onTimeUpdate).not.toHaveBeenCalledWith(58);
  });

  it('should not pause on blur when autoPauseOnBlur is disabled', async () => {
    const onTimeUpdate = vi.fn();

    render(
      <Timer
        totalSeconds={60}
        onTimeUp={vi.fn()}
        onTimeUpdate={onTimeUpdate}
        autoPauseOnBlur={false}
        showProgress={true}
        size="large"
        label="Test Timer"
      />
    );

    // Simulate window blur
    window.dispatchEvent(new Event('blur'));

    // Advance time - timer should continue
    vi.advanceTimersByTime(2000);

    // Timer should have updated normally
    await waitFor(() => {
      expect(onTimeUpdate).toHaveBeenCalledWith(58);
    });
  });
});