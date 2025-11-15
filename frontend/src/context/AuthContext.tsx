import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { getUserProfile, registerUser, registerAdmin as apiRegisterAdmin, loginUser as apiLoginUser } from '../utils/api';

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

// Export the AuthContext so it can be imported in test files
export const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider = ({ children }: AuthProviderProps) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Check for saved user data in localStorage
    const loadUser = async () => {
      try {
        const savedUser = localStorage.getItem('user');
        
        if (savedUser) {
          const parsedUser = JSON.parse(savedUser) as User;
          
          // Validate token by fetching user profile
          await getUserProfile(parsedUser.token);
          
          setUser(parsedUser);
        }
      } catch (err) {
        console.error('Failed to load user:', err);
        // Invalid or expired token, clear the storage
        localStorage.removeItem('user');
      } finally {
        setLoading(false);
      }
    };

    loadUser();
  }, []);

  const saveUser = (userData: User) => {
    // Save user data to localStorage
    localStorage.setItem('user', JSON.stringify(userData));
    setUser(userData);
    setError(null);
  };

  const login = async (email: string, password: string) => {
    setLoading(true);
    setError(null);
    
    try {
      const userData = await apiLoginUser({ email, password });
      saveUser(userData);
    } catch (err) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('Login failed');
      }
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const logout = () => {
    // Clear user data from localStorage
    localStorage.removeItem('user');
    setUser(null);
  };

  const register = async (userId: string, email: string, password: string) => {
    setLoading(true);
    setError(null);
    
    try {
      const data = await registerUser({ userId, email, password });
      saveUser(data); // Automatically log in after successful registration
      return data;
    } catch (err) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('Registration failed');
      }
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const registerAdmin = async (userId: string, email: string, password: string, adminSecret?: string) => {
    setLoading(true);
    setError(null);
    
    try {
      const data = await apiRegisterAdmin({ userId, email, password, adminSecret });
      saveUser(data); // Automatically log in after successful registration
      return data;
    } catch (err) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('Admin registration failed');
      }
      throw err;
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, error, login, logout, register, registerAdmin, setUser }}>
      {children}
    </AuthContext.Provider>
  );
};