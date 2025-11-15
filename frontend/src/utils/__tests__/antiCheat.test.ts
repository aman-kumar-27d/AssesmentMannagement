import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createAntiCheatMonitor } from '../antiCheat';

describe('AntiCheat Utilities', () => {
  let mockViolationHandler: ReturnType<typeof vi.fn>;
  let monitor: ReturnType<typeof createAntiCheatMonitor>;

  beforeEach(() => {
    mockViolationHandler = vi.fn();
    monitor = createAntiCheatMonitor(mockViolationHandler);
    
    // Mock fullscreen API
    Object.defineProperty(document, 'fullscreenElement', {
      writable: true,
      value: null
    });
    
    document.exitFullscreen = vi.fn().mockResolvedValue(undefined);
    document.documentElement.requestFullscreen = vi.fn().mockResolvedValue(undefined);
  });

  afterEach(() => {
    monitor.destroy();
    vi.clearAllMocks();
  });

  describe('createAntiCheatMonitor', () => {
    it('should create a monitor instance', () => {
      expect(monitor).toBeDefined();
      expect(monitor.requestFullscreen).toBeDefined();
      expect(monitor.exitFullscreen).toBeDefined();
      expect(monitor.getViolations).toBeDefined();
      expect(monitor.getActivities).toBeDefined();
      expect(monitor.getTabSwitchCount).toBeDefined();
      expect(monitor.isInFullscreen).toBeDefined();
      expect(monitor.destroy).toBeDefined();
    });

    it('should track tab switches', () => {
      // Simulate visibility change (tab switch)
      Object.defineProperty(document, 'visibilityState', {
        writable: true,
        value: 'hidden'
      });
      
      document.dispatchEvent(new Event('visibilitychange'));
      
      expect(monitor.getTabSwitchCount()).toBe(1);
      expect(mockViolationHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'tab_switch',
          severity: 'medium'
        })
      );
    });

    it('should detect copy attempts', () => {
      // Mock clipboard event
      const mockClipboardEvent = {
        type: 'copy',
        target: document.body,
        preventDefault: vi.fn(),
        bubbles: true
      };
      
      // Trigger copy event through the monitor's event listener
      document.dispatchEvent(new Event('copy'));
      
      expect(mockViolationHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'clipboard_copy',
          severity: 'high'
        })
      );
    });

    it('should detect right-click attempts', () => {
      const contextMenuEvent = new MouseEvent('contextmenu', { bubbles: true });
      
      document.dispatchEvent(contextMenuEvent);
      
      // Note: Right-click is now allowed for accessibility, so severity is 'low'
      expect(mockViolationHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'right_click',
          severity: 'low'
        })
      );
    });

    it('should detect F12 key press', () => {
      const f12Event = new KeyboardEvent('keydown', { key: 'F12', code: 'F12' });
      const preventDefaultSpy = vi.spyOn(f12Event, 'preventDefault');
      
      document.dispatchEvent(f12Event);
      
      expect(preventDefaultSpy).toHaveBeenCalled();
      expect(mockViolationHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'dev_tools',
          severity: 'critical'
        })
      );
    });

    it('should detect Ctrl+Shift+I (dev tools)', () => {
      const devToolsEvent = new KeyboardEvent('keydown', { 
        key: 'I', 
        code: 'KeyI',
        ctrlKey: true,
        shiftKey: true 
      });
      const preventDefaultSpy = vi.spyOn(devToolsEvent, 'preventDefault');
      
      document.dispatchEvent(devToolsEvent);
      
      expect(preventDefaultSpy).toHaveBeenCalled();
      expect(mockViolationHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'dev_tools',
          severity: 'critical'
        })
      );
    });

    it('should detect print screen key', () => {
      const printScreenEvent = new KeyboardEvent('keydown', { key: 'PrintScreen' });
      const preventDefaultSpy = vi.spyOn(printScreenEvent, 'preventDefault');
      
      document.dispatchEvent(printScreenEvent);
      
      expect(preventDefaultSpy).toHaveBeenCalled();
      expect(mockViolationHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'screenshot_attempt',
          severity: 'critical'
        })
      );
    });

    it('should allow normal keyboard input', () => {
      const normalEvent = new KeyboardEvent('keydown', { key: 'a', code: 'KeyA' });
      const preventDefaultSpy = vi.spyOn(normalEvent, 'preventDefault');
      
      document.dispatchEvent(normalEvent);
      
      expect(preventDefaultSpy).not.toHaveBeenCalled();
      // Normal input should not trigger violations
      const violations = monitor.getViolations();
      const hasNormalInputViolation = violations.some(v => v.type === 'normal_input');
      expect(hasNormalInputViolation).toBe(false);
    });
  });

  describe('Fullscreen Management', () => {
    it('should request fullscreen successfully', async () => {
      await monitor.requestFullscreen();
      
      expect(document.documentElement.requestFullscreen).toHaveBeenCalled();
    });

    it('should exit fullscreen successfully', async () => {
      // Mock being in fullscreen
      Object.defineProperty(document, 'fullscreenElement', {
        writable: true,
        value: document.documentElement
      });
      
      await monitor.exitFullscreen();
      
      expect(document.exitFullscreen).toHaveBeenCalled();
    });

    it('should detect fullscreen status', () => {
      expect(monitor.isInFullscreen()).toBe(false);
      
      // Mock being in fullscreen
      Object.defineProperty(document, 'fullscreenElement', {
        writable: true,
        value: document.documentElement
      });
      
      expect(monitor.isInFullscreen()).toBe(true);
    });

    it('should handle fullscreen request errors', async () => {
      document.documentElement.requestFullscreen = vi.fn().mockRejectedValue(new Error('Fullscreen denied'));
      
      await expect(monitor.requestFullscreen()).rejects.toThrow('Fullscreen denied');
    });

    it('should handle fullscreen exit errors', async () => {
      document.exitFullscreen = vi.fn().mockRejectedValue(new Error('Exit failed'));
      
      // Mock being in fullscreen
      Object.defineProperty(document, 'fullscreenElement', {
        writable: true,
        value: document.documentElement
      });
      
      await expect(monitor.exitFullscreen()).rejects.toThrow('Exit failed');
    });
  });

  describe('Activity Tracking', () => {
    it('should track user activities', () => {
      // Simulate some user activity
      document.dispatchEvent(new MouseEvent('click'));
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'a' }));
      
      const activities = monitor.getActivities();
      
      expect(activities.length).toBeGreaterThan(0);
      expect(activities[0]).toMatchObject({
        type: expect.any(String),
        timestamp: expect.any(String)
      });
    });

    it('should limit activity history', () => {
      // Generate many activities
      for (let i = 0; i < 150; i++) {
        document.dispatchEvent(new MouseEvent('click'));
      }
      
      const activities = monitor.getActivities();
      
      // Should be limited to 100 activities
      expect(activities.length).toBeLessThanOrEqual(100);
    });
  });

  describe('Violation Tracking', () => {
    it('should track violations', () => {
      // Trigger a violation
      const contextMenuEvent = new MouseEvent('contextmenu', { bubbles: true });
      document.dispatchEvent(contextMenuEvent);
      
      const violations = monitor.getViolations();
      
      expect(violations.length).toBe(1);
      expect(violations[0]).toMatchObject({
        type: 'right_click',
        severity: 'medium',
        timestamp: expect.any(String),
        details: expect.any(String)
      });
    });

    it('should track multiple violations', () => {
      // Trigger multiple violations
      document.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true }));
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'F12' }));
      
      const violations = monitor.getViolations();
      
      expect(violations.length).toBe(2);
    });
  });

  describe('Cleanup', () => {
    it('should remove event listeners on destroy', () => {
      const removeEventListenerSpy = vi.spyOn(document, 'removeEventListener');
      
      monitor.destroy();
      
      expect(removeEventListenerSpy).toHaveBeenCalledWith('visibilitychange', expect.any(Function));
      expect(removeEventListenerSpy).toHaveBeenCalledWith('copy', expect.any(Function));
      expect(removeEventListenerSpy).toHaveBeenCalledWith('paste', expect.any(Function));
      expect(removeEventListenerSpy).toHaveBeenCalledWith('contextmenu', expect.any(Function));
      expect(removeEventListenerSpy).toHaveBeenCalledWith('keydown', expect.any(Function));
    });

    it('should handle multiple destroy calls', () => {
      expect(() => {
        monitor.destroy();
        monitor.destroy(); // Second call should not throw
      }).not.toThrow();
    });
  });

  describe('Edge Cases', () => {
    it('should handle undefined violation handler gracefully', () => {
      const monitorWithoutHandler = createAntiCheatMonitor();
      
      // Should not throw when triggering violations
      expect(() => {
        document.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true }));
      }).not.toThrow();
      
      monitorWithoutHandler.destroy();
    });

    it('should handle missing fullscreen API gracefully', () => {
      // Temporarily remove fullscreen API
      const originalRequestFullscreen = document.documentElement.requestFullscreen;
      const originalExitFullscreen = document.exitFullscreen;
      
      delete (document.documentElement as any).requestFullscreen;
      delete (document as any).exitFullscreen;
      
      const monitorWithoutFullscreen = createAntiCheatMonitor(mockViolationHandler);
      
      // Should not throw when trying to use fullscreen
      expect(async () => {
        await monitorWithoutFullscreen.requestFullscreen();
        await monitorWithoutFullscreen.exitFullscreen();
      }).not.toThrow();
      
      // Restore APIs
      document.documentElement.requestFullscreen = originalRequestFullscreen;
      document.exitFullscreen = originalExitFullscreen;
      
      monitorWithoutFullscreen.destroy();
    });

    it('should handle rapid event firing', () => {
      // Fire many events rapidly
      for (let i = 0; i < 50; i++) {
        document.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true }));
      }
      
      const violations = monitor.getViolations();
      
      // Should handle all events without errors
      expect(violations.length).toBe(50);
    });
  });
});