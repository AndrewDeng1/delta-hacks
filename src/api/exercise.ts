import { ExerciseType } from '../types';

const API_BASE_URL = 'http://localhost:8000';

/**
 * Set the target exercise for the motion detection backend
 */
export async function setTargetExercise(exercise: ExerciseType): Promise<{ success: boolean; target: string }> {
  const response = await fetch(`${API_BASE_URL}/target-exercise`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      target: exercise
    })
  });

  if (!response.ok) {
    throw new Error('Failed to set target exercise');
  }

  const data = await response.json();
  return data;
}

/**
 * Get current rep counts from the motion detection backend
 * Note: This endpoint returns the counts and resets them to 0
 */
export async function getRepCounts(): Promise<Record<ExerciseType, number>> {
  const response = await fetch(`${API_BASE_URL}/reps/process`, {
    method: 'GET',
  });

  if (!response.ok) {
    throw new Error('Failed to get rep counts');
  }

  const data = await response.json();
  console.log('[API] Raw response from /reps/process:', JSON.stringify(data));
  return data;
}

/**
 * Check if the backend is available
 */
export async function checkBackendAvailability(): Promise<boolean> {
  try {
    const response = await fetch(`${API_BASE_URL}/target-exercise`, {
      method: 'GET',
    });
    console.log(`[Backend Check] Status: ${response.status} - ${response.ok ? 'Available' : 'Unavailable'}`);
    return response.ok;
  } catch (error) {
    console.error('[Backend Check] Failed to connect:', error);
    return false;
  }
}
