import React, { createContext, useContext, useState, ReactNode } from 'react';
import { User, ExerciseType } from '@/types';

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (username: string, email: string, password: string) => Promise<void>;
  logout: () => void;
  updateUserStats: (exerciseType: ExerciseType, reps: number) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Mock user for demo purposes
const createMockUser = (username: string, email: string): User => ({
  id: Math.random().toString(36).substr(2, 9),
  username,
  email,
  enrolledChallenges: [],
  lifetimeStats: {
    jumping_jacks: 0,
    squats: 0,
    high_knees: 0,
  },
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);

  const login = async (email: string, password: string) => {
    // Mock login - in production, this would call the backend
    await new Promise(resolve => setTimeout(resolve, 500));
    const mockUser = createMockUser('Demo User', email);
    mockUser.lifetimeStats = {
      jumping_jacks: 1250,
      squats: 890,
      high_knees: 650,
    };
    setUser(mockUser);
  };

  const signup = async (username: string, email: string, password: string) => {
    // Mock signup - in production, this would call the backend
    await new Promise(resolve => setTimeout(resolve, 500));
    setUser(createMockUser(username, email));
  };

  const logout = () => {
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
