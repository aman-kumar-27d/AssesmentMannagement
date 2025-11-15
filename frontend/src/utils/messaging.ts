import { create } from 'zustand';

export interface NotificationMessage {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  title: string;
  message: string;
  duration?: number;
  persistent?: boolean;
  actions?: Array<{
    label: string;
    onClick: () => void;
  }>;
}

export interface MessageState {
  notifications: NotificationMessage[];
  addNotification: (notification: Omit<NotificationMessage, 'id'>) => void;
  removeNotification: (id: string) => void;
  clearNotifications: () => void;
}

export const useMessageStore = create<MessageState>((set) => ({
  notifications: [],
  addNotification: (notification) => {
    const id = `notification-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const newNotification: NotificationMessage = {
      ...notification,
      id,
      duration: notification.duration ?? 5000,
    };

    set((state) => ({
      notifications: [...state.notifications, newNotification],
    }));

    // Auto-remove notification after duration
    if (!notification.persistent && notification.duration !== 0) {
      setTimeout(() => {
        set((state) => ({
          notifications: state.notifications.filter((n) => n.id !== id),
        }));
      }, notification.duration);
    }
  },
  removeNotification: (id) => {
    set((state) => ({
      notifications: state.notifications.filter((n) => n.id !== id),
    }));
  },
  clearNotifications: () => {
    set({ notifications: [] });
  },
}));

// Helper functions for common notifications
export const showSuccess = (title: string, message: string, duration = 3000) => {
  useMessageStore.getState().addNotification({
    type: 'success',
    title,
    message,
    duration,
  });
};

export const showError = (title: string, message: string, duration = 5000) => {
  useMessageStore.getState().addNotification({
    type: 'error',
    title,
    message,
    duration,
  });
};

export const showWarning = (title: string, message: string, duration = 4000) => {
  useMessageStore.getState().addNotification({
    type: 'warning',
    title,
    message,
    duration,
  });
};

export const showInfo = (title: string, message: string, duration = 3000) => {
  useMessageStore.getState().addNotification({
    type: 'info',
    title,
    message,
    duration,
  });
};