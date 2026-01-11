/**
 * API client for Motion4Good backend
 */

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

// ============================================================================
// AUTH TOKEN MANAGEMENT
// ============================================================================

export function getAuthToken(): string | null {
  return localStorage.getItem('token');
}

export function setAuthToken(token: string): void {
  localStorage.setItem('token', token);
}

export function clearAuthToken(): void {
  localStorage.removeItem('token');
  localStorage.removeItem('user_id');
  localStorage.removeItem('user_email');
  localStorage.removeItem('user_username');
}

export function getUserId(): string | null {
  return localStorage.getItem('user_id');
}

export function setUserId(userId: string): void {
  localStorage.setItem('user_id', userId);
}

// ============================================================================
// API ERROR HANDLING
// ============================================================================

export class APIError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'APIError';
    this.status = status;
  }
}

async function handleResponse<T>(response: Response): Promise<T> {
  const data = await response.json();

  if (!response.ok) {
    // Log detailed error information for debugging
    console.error('API Error:', {
      status: response.status,
      statusText: response.statusText,
      url: response.url,
      errorData: data,
    });
    throw new APIError(data.error || 'An error occurred', response.status);
  }

  return data;
}

// ============================================================================
// AUTHENTICATED FETCH
// ============================================================================

async function authenticatedFetch(url: string, options: RequestInit = {}) {
  const token = getAuthToken();

  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...options.headers,
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE_URL}${url}`, {
    ...options,
    headers,
  });

  return response;
}

// ============================================================================
// AUTH API
// ============================================================================

export interface LoginResponse {
  user_id: string;
  token: string;
}

export interface SignupResponse {
  user_id: string;
}

export const authAPI = {
  async login(email: string, password: string): Promise<LoginResponse> {
    const response = await fetch(`${API_BASE_URL}/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email, password }),
    });

    return handleResponse<LoginResponse>(response);
  },

  async signup(username: string, email: string, password: string): Promise<SignupResponse> {
    const response = await fetch(`${API_BASE_URL}/users`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ username, email, password }),
    });

    return handleResponse<SignupResponse>(response);
  },

  async logout(): Promise<void> {
    const response = await authenticatedFetch('/auth/logout', {
      method: 'POST',
    });

    await handleResponse(response);
  },
};

// ============================================================================
// CHALLENGES API
// ============================================================================

export interface CreateChallengeData {
  name: string;
  description: string;
  enabled_exercises: string[];
  rep_goal: Record<string, number>;
  rep_reward: Record<string, [number, number]>;
  rep_reward_type: Record<string, string>;
  completion_reward: string;
  start_date: string;
  end_date: string;
}

export interface Challenge {
  _id: string;
  name: string;
  description: string;
  creatorUserId: string;
  enabledExercises: string[];
  participants: string[];
  contributions: Record<string, Record<string, number>>;
  repGoal: Record<string, number>;
  repReward: Record<string, [number, number]>;
  repRewardType: Record<string, string>;
  completionReward: string;
  startDate: string;
  endDate: string;
  completed: boolean;
  createdAt: string;
}

export const challengeAPI = {
  async createChallenge(data: CreateChallengeData): Promise<{ challenge_id: string }> {
    const response = await authenticatedFetch('/challenges', {
      method: 'POST',
      body: JSON.stringify(data),
    });

    return handleResponse(response);
  },

  async getAllChallenges(): Promise<{ challenges: Challenge[] }> {
    const response = await fetch(`${API_BASE_URL}/challenges`);
    return handleResponse(response);
  },

  async getMyChallenges(): Promise<{ challenges: Challenge[] }> {
    const response = await authenticatedFetch('/challenges/my');
    return handleResponse(response);
  },

  async getEnrolledChallenges(): Promise<{ challenges: Challenge[] }> {
    const response = await authenticatedFetch('/challenges/enrolled');
    return handleResponse(response);
  },

  async getChallenge(challengeId: string): Promise<Challenge> {
    const response = await authenticatedFetch(`/challenges/${challengeId}`);
    return handleResponse(response);
  },

  async deleteChallenge(challengeId: string): Promise<void> {
    const response = await authenticatedFetch(`/challenges/${challengeId}`, {
      method: 'DELETE',
    });

    await handleResponse(response);
  },

  async enrollInChallenge(challengeId: string): Promise<void> {
    const response = await authenticatedFetch(`/challenges/${challengeId}/enroll`, {
      method: 'POST',
    });

    await handleResponse(response);
  },

  async unenrollFromChallenge(challengeId: string): Promise<void> {
    const response = await authenticatedFetch(`/challenges/${challengeId}/unenroll`, {
      method: 'POST',
    });

    await handleResponse(response);
  },

  async getContributions(challengeId: string, userId: string): Promise<Record<string, number>> {
    const response = await authenticatedFetch(`/challenges/${challengeId}/contributions/${userId}`);
    return handleResponse(response);
  },

  async incrementContributions(
    challengeId: string,
    increments: Record<string, number>
  ): Promise<{ increments: Record<string, number> }> {
    const response = await authenticatedFetch(`/challenges/${challengeId}/contributions/increment`, {
      method: 'POST',
      body: JSON.stringify({ increments }),
    });

    return handleResponse(response);
  },
};

// ============================================================================
// REPS API
// ============================================================================

export const repsAPI = {
  async processReps(): Promise<Record<string, number>> {
    const response = await fetch(`${API_BASE_URL}/reps/process`);
    return handleResponse(response);
  },
};
