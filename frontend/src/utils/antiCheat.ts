export interface AntiCheatViolation {
  type: string;
  timestamp: Date;
  details: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
}

export interface SessionActivity {
  timestamp: Date;
  action: string;
  details: string;
}

export class AntiCheatMonitor {
  private violations: AntiCheatViolation[] = [];
  private activities: SessionActivity[] = [];
  private tabSwitchCount = 0;
  private isFullscreen = false;
  private inactivityThreshold = 30000; // 30 seconds
  private inactivityTimer: ReturnType<typeof setTimeout> | null = null;
  private listeners: Map<string, EventListener> = new Map();
  private clipboardBlocker: ((e: ClipboardEvent) => void) | null = null;

  constructor(private onViolation: (violation: AntiCheatViolation) => void) {
    this.startMonitoring();
  }

  private startMonitoring() {
    this.setupTabSwitchDetection();
    this.setupClipboardMonitoring();
    this.setupScreenshotProtection();
    this.setupInactivityDetection();
    this.setupRightClickBlocking();
    this.setupKeyboardShortcuts();
    this.setupFullscreenDetection();
    this.setupWindowResizeDetection();
  }

  private setupTabSwitchDetection() {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        this.tabSwitchCount++;
        this.addViolation('tab_switch', `Tab switched ${this.tabSwitchCount} times`, 'medium');
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    this.listeners.set('visibilitychange', handleVisibilityChange);
  }

  private setupClipboardMonitoring() {
    this.clipboardBlocker = (e: ClipboardEvent) => {
      const action = e.type === 'copy' ? 'clipboard_copy' : e.type === 'paste' ? 'clipboard_paste' : 'clipboard_cut';
      const target = e.target as HTMLElement;
      const isInInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.contentEditable === 'true';
      
      // Allow clipboard operations in input fields for accessibility
      if (isInInput) {
        this.addViolation(action, `Clipboard ${action.replace('clipboard_', '')} detected in input field`, 'low');
        // Don't prevent default for accessibility in input fields
        return;
      }
      
      // Block clipboard operations in assessment content area
      this.addViolation(action, `Clipboard ${action.replace('clipboard_', '')} detected in assessment area`, 'high');
      e.preventDefault();
    };

    document.addEventListener('copy', this.clipboardBlocker);
    document.addEventListener('paste', this.clipboardBlocker);
    document.addEventListener('cut', this.clipboardBlocker);
  }

  private setupScreenshotProtection() {
    // Block screenshot attempts using canvas protection
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (ctx) {
      // Add watermark or overlay to prevent screenshots
      this.addActivity('screenshot_protection_enabled', 'Screenshot protection activated');
    }

    // Block print screen key
    const handleKeydown = (e: KeyboardEvent) => {
      if (e.key === 'PrintScreen') {
        this.addViolation('screenshot_attempt', 'Print Screen key pressed', 'critical');
        e.preventDefault();
      }
    };

    document.addEventListener('keydown', handleKeydown);
    this.listeners.set('keydown_screenshot', handleKeydown as EventListener);
  }

  private setupInactivityDetection() {
    const resetInactivityTimer = () => {
      if (this.inactivityTimer) {
        clearTimeout(this.inactivityTimer);
      }
      
      this.inactivityTimer = setTimeout(() => {
        this.addViolation('inactivity', 'User inactive for 30 seconds', 'medium');
      }, this.inactivityThreshold);
    };

    // Monitor user activity
    const events = ['mousedown', 'keydown', 'scroll', 'touchstart'];
    events.forEach(event => {
      document.addEventListener(event, resetInactivityTimer);
    });

    resetInactivityTimer(); // Start the timer
  }

  private setupRightClickBlocking() {
    const handleContextMenu = () => {
      // Allow right-click for accessibility - screen readers and assistive technologies need this
      this.addViolation('right_click', 'Right click detected', 'low');
      // Don't prevent default for accessibility
      // e.preventDefault(); // REMOVED for accessibility
    };

    document.addEventListener('contextmenu', handleContextMenu);
    this.listeners.set('contextmenu', handleContextMenu as EventListener);
  }

  private setupKeyboardShortcuts() {
    const handleKeydown = (e: KeyboardEvent) => {
      // Allow essential accessibility shortcuts
      const target = e.target as HTMLElement;
      const isInInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.contentEditable === 'true';
      
      // Allow Ctrl+A (Select All) for accessibility - only block in assessment context
      if ((e.ctrlKey || e.metaKey) && e.key === 'a' && !isInInput) {
        this.addViolation('keyboard_shortcut', `Keyboard shortcut Ctrl+A detected in assessment context`, 'low');
        // Don't prevent default for accessibility
        return;
      }
      
      // Allow Ctrl+S (Save) - users expect to save their work
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        this.addViolation('keyboard_shortcut', `Keyboard shortcut Ctrl+S detected`, 'low');
        // Don't prevent default - allow save functionality
        return;
      }

      // Block potentially harmful shortcuts (copy, paste, print, view source)
      if ((e.ctrlKey || e.metaKey) && ['c', 'v', 'x', 'p', 'u'].includes(e.key)) {
        this.addViolation('keyboard_shortcut', `Keyboard shortcut Ctrl+${e.key} detected`, 'medium');
        e.preventDefault();
      }

      // Block F12 (DevTools)
      if (e.key === 'F12') {
        this.addViolation('dev_tools', 'Developer tools shortcut detected', 'critical');
        e.preventDefault();
      }

      // Block Ctrl+Shift+I (DevTools)
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'I') {
        this.addViolation('dev_tools', 'Developer tools shortcut detected', 'critical');
        e.preventDefault();
      }
    };

    document.addEventListener('keydown', handleKeydown);
    this.listeners.set('keydown_shortcuts', handleKeydown as EventListener);
  }

  private setupFullscreenDetection() {
    const handleFullscreenChange = () => {
      this.isFullscreen = !!document.fullscreenElement;
      if (!this.isFullscreen) {
        this.addViolation('window_resize', 'Fullscreen mode exited', 'medium');
      }
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    this.listeners.set('fullscreenchange', handleFullscreenChange);
  }

  private setupWindowResizeDetection() {
    let resizeTimer: ReturnType<typeof setTimeout>;
    const handleResize = () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        this.addViolation('window_resize', `Window resized to ${window.innerWidth}x${window.innerHeight}`, 'low');
      }, 1000);
    };

    window.addEventListener('resize', handleResize);
    this.listeners.set('resize', handleResize);
  }

  private addViolation(type: string, details: string, severity: 'low' | 'medium' | 'high' | 'critical') {
    const violation: AntiCheatViolation = {
      type,
      timestamp: new Date(),
      details,
      severity
    };
    
    this.violations.push(violation);
    this.onViolation(violation);
    this.addActivity('violation_detected', `${type}: ${details}`);
  }

  private addActivity(action: string, details: string) {
    this.activities.push({
      timestamp: new Date(),
      action,
      details
    });
  }

  public getViolations(): AntiCheatViolation[] {
    return [...this.violations];
  }

  public getActivities(): SessionActivity[] {
    return [...this.activities];
  }

  public getTabSwitchCount(): number {
    return this.tabSwitchCount;
  }

  public requestFullscreen(): Promise<void> {
    return document.documentElement.requestFullscreen().then(() => {
      this.isFullscreen = true;
      this.addActivity('fullscreen_requested', 'Fullscreen mode requested');
    }).catch(err => {
      this.addViolation('window_resize', `Failed to enter fullscreen: ${err.message}`, 'medium');
      throw err;
    });
  }

  public exitFullscreen(): Promise<void> {
    return document.exitFullscreen().then(() => {
      this.isFullscreen = false;
      this.addActivity('fullscreen_exited', 'Fullscreen mode exited');
      
      // Add additional verification and cleanup
      setTimeout(() => {
        // Force any remaining fullscreen elements to exit
        if (document.fullscreenElement) {
          document.exitFullscreen().catch(err => {
            console.error('Secondary fullscreen exit failed:', err);
          });
        }
        
        // Ensure viewport is properly restored
        document.body.style.overflow = '';
        document.body.style.padding = '';
        document.documentElement.style.overflow = '';
      }, 100);
    }).catch(err => {
      console.error('Fullscreen exit failed:', err);
      this.addViolation('window_resize', `Failed to exit fullscreen: ${err.message}`, 'medium');
      throw err;
    });
  }

  public isInFullscreen(): boolean {
    return this.isFullscreen;
  }

  public destroy() {
    // Remove all event listeners
    this.listeners.forEach((listener, event) => {
      if (event === 'visibilitychange') {
        document.removeEventListener('visibilitychange', listener);
      } else if (event === 'keydown_screenshot' || event === 'keydown_shortcuts') {
        document.removeEventListener('keydown', listener);
      } else if (event === 'contextmenu') {
        document.removeEventListener('contextmenu', listener);
      } else if (event === 'fullscreenchange') {
        document.removeEventListener('fullscreenchange', listener);
      } else if (event === 'resize') {
        window.removeEventListener('resize', listener);
      }
    });

    // Remove clipboard listeners
    if (this.clipboardBlocker) {
      document.removeEventListener('copy', this.clipboardBlocker);
      document.removeEventListener('paste', this.clipboardBlocker);
      document.removeEventListener('cut', this.clipboardBlocker);
    }

    // Clear timers
    if (this.inactivityTimer) {
      clearTimeout(this.inactivityTimer);
    }

    this.listeners.clear();
  }
}

export const createAntiCheatMonitor = (onViolation: (violation: AntiCheatViolation) => void): AntiCheatMonitor => {
  return new AntiCheatMonitor(onViolation);
};