import React, { ReactElement } from 'react';
import { render, RenderOptions } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { vi } from 'vitest';
import { AuthContext } from '../context/AuthContext';

// Define the correct AuthContextType that matches the implementation
interface User {
  _id: string;
  userId: string;
  email: string;
  role: 'user' | 'admin';
  token: string;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  error: string | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  register: (userId: string, email: string, password: string) => Promise<void>;
  registerAdmin: (userId: string, email: string, password: string, adminSecret?: string) => Promise<void>;
  setUser: (user: User | null) => void;
}

// Define default mock auth context
const defaultAuthContext: AuthContextType = {
  user: null,
  loading: false,
  error: null,
  login: vi.fn(),
  logout: vi.fn(),
  register: vi.fn(),
  registerAdmin: vi.fn(),
  setUser: vi.fn()
};

interface CustomRenderOptions extends Omit<RenderOptions, 'wrapper'> {
  route?: string;
  authContext?: Partial<AuthContextType>;
  routePath?: string;
}

/**
 * Custom render function that wraps the component in necessary providers
 */
export function renderWithProviders(
  ui: ReactElement,
  {
    route = '/',
    authContext = {},
    routePath = '/',
    ...renderOptions
  }: CustomRenderOptions = {}
): ReturnType<typeof render> {
  // Merge the default and provided auth contexts
  const mergedAuthContext = { ...defaultAuthContext, ...authContext };

  function Wrapper({ children }: { children: React.ReactNode }): ReactElement {
    return (
      <AuthContext.Provider value={mergedAuthContext}>
        <MemoryRouter initialEntries={[route]}>
          {routePath ? (
            <Routes>
              <Route path={routePath} element={children} />
            </Routes>
          ) : (
            children
          )}
        </MemoryRouter>
      </AuthContext.Provider>
    );
  }

  return render(ui, { wrapper: Wrapper, ...renderOptions });
}

// Re-export everything from React Testing Library
export * from '@testing-library/react';
export { renderWithProviders as render };