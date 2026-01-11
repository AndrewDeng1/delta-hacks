export type ExerciseType = 'jumping_jacks' | 'squats' | 'high_knees';

export interface RepReward {
  amount: number;
  perReps: number;
}

export interface Challenge {
  id: string;
  name: string;
  creatorId: string;
  creatorName: string;
  description: string;
  enabledExercises: ExerciseType[];
  userContributions: Record<string, Record<ExerciseType, number>>;
  enrolledUsers: string[];
  repGoal: Record<ExerciseType, number>;
  repReward: Record<ExerciseType, RepReward>;
  repRewardType: string;
  completionReward: string;
  startDate: Date;
  endDate: Date;
  isCompleted: boolean;
}

export interface User {
  id: string;
  username: string;
  email: string;
  enrolledChallenges: string[];
  lifetimeStats: Record<ExerciseType, number>;
}

export interface SessionStats {
  reps: Record<ExerciseType, number>;
  rewardsEarned: number;
}

export const EXERCISE_LABELS: Record<ExerciseType, string> = {
  jumping_jacks: 'Jumping Jacks',
  squats: 'Squats',
  high_knees: 'High Knees',
};

export const EXERCISE_ICONS: Record<ExerciseType, string> = {
  jumping_jacks: '⭐',
  squats: '🏋️',
  high_knees: '🏃',
};
