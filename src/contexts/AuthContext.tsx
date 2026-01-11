import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { User, ExerciseType } from '@/types';
import { authAPI, setAuthToken, clearAuthToken, setUserId, getUserId, getAuthToken } from '@/lib/api';

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (username: string, email: string, password: string) => Promise<void>;
  logout: () => void;
  updateUserStats: (exerciseType: ExerciseType, reps: number) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);

  // Check for existing auth on mount
  useEffect(() => {
    console.log('AuthContext: Checking for existing auth on mount');
    const token = getAuthToken();
    const userId = getUserId();

    console.log('AuthContext: Token exists?', !!token);
    console.log('AuthContext: UserId exists?', !!userId);

    if (token && userId) {
      console.log('AuthContext: Restoring user session', { userId });

      // Restore user state from localStorage
      const storedEmail = localStorage.getItem('user_email');
      const storedUsername = localStorage.getItem('user_username');

      setUser({
        id: userId,
        username: storedUsername || 'User',
        email: storedEmail || '',
        enrolledChallenges: [],
        lifetimeStats: {
          jumping_jacks: 0,
          squats: 0,
          high_knees: 0,
        },
      });

      console.log('AuthContext: User session restored');
    } else {
      console.log('AuthContext: No existing session found');
    }
  }, []);

  const login = async (email: string, password: string) => {
    try {
      console.log('Attempting to log in:', { email });
      const response = await authAPI.login(email, password);
      console.log('Login successful:', response);

      // Store token and user ID
      setAuthToken(response.token);
      setUserId(response.user_id);

      // Store email and username for session restoration
      const username = email.split('@')[0];
      localStorage.setItem('user_email', email);
      localStorage.setItem('user_username', username);

      // Create user object with available info
      // Note: Backend doesn't return username, so we use email as placeholder
      const loggedInUser: User = {
        id: response.user_id,
        username: username,
        email: email,
        enrolledChallenges: [],
        lifetimeStats: {
          jumping_jacks: 0,
          squats: 0,
          high_knees: 0,
        },
      };

      setUser(loggedInUser);
    } catch (error) {
      console.error('Login failed:', error);
      // Clear any stored auth data on error
      clearAuthToken();
      throw error;
    }
  };

  const signup = async (username: string, email: string, password: string) => {
    let userCreated = false;
    let createdUserId: string | null = null;

    // Step 1: Create the user
    try {
      console.log('Attempting to create user:', { username, email });
      const signupResponse = await authAPI.signup(username, email, password);
      console.log('User created successfully:', signupResponse);
      userCreated = true;
      createdUserId = signupResponse.user_id;
    } catch (error) {
      console.error('User creation failed:', error);
      clearAuthToken();
      throw error;
    }

    // Step 2: Auto-login the user
    try {
      console.log('Attempting to log in user');
      const loginResponse = await authAPI.login(email, password);
      console.log('Login successful:', loginResponse);

      // Store token and user ID
      setAuthToken(loginResponse.token);
      setUserId(loginResponse.user_id);

      // Store email and username for session restoration
      localStorage.setItem('user_email', email);
      localStorage.setItem('user_username', username);

      // Create user object
      const newUser: User = {
        id: loginResponse.user_id,
        username: username,
        email: email,
        enrolledChallenges: [],
        lifetimeStats: {
          jumping_jacks: 0,
          squats: 0,
          high_knees: 0,
        },
      };

      setUser(newUser);
    } catch (error) {
      console.error('Auto-login failed after user creation:', error);

      // User was created but login failed - throw special error
      const loginError: any = new Error('Account created but login failed. Please sign in manually.');
      loginError.userCreated = true;
      loginError.userId = createdUserId;
      throw loginError;
    }
  };

  const logout = () => {
    // Call backend logout (optional, since JWT is stateless)
    authAPI.logout().catch(console.error);

    // Clear local state
    clearAuthToken();
    setUser(null);
  };

  const updateUserStats = (exerciseType: ExerciseType, reps: number) => {
    if (user) {
      setUser({
        ...user,
        lifetimeStats: {
          ...user.lifetimeStats,
          [exerciseType]: user.lifetimeStats[exerciseType] + reps,
        },
      });
    }
  };

  return (
    <AuthContext.Provider value={{
      user,
      isAuthenticated: !!user,
      login,
      signup,
      logout,
      updateUserStats
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
