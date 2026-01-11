import { useState, useEffect } from 'react';
import { Navbar } from '@/components/Navbar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { EXERCISE_LABELS, EXERCISE_ICONS, ExerciseType } from '@/types';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { useToast } from '@/hooks/use-toast';
import { challengeAPI } from '@/lib/api';
import { Challenge } from '@/types';
import { User, Trophy, Zap, Loader2, Calendar, Palette, Check } from 'lucide-react';
import { Navigate, Link } from 'react-router-dom';

export default function Profile() {
  const { user, isAuthenticated } = useAuth();
  const { theme, setTheme, availableThemes } = useTheme();
  const { toast } = useToast();
  const [enrolledChallenges, setEnrolledChallenges] = useState<Challenge[]>([]);
  const [loading, setLoading] = useState(true);
  const [lifetimeStats, setLifetimeStats] = useState({
    jumping_jacks: 0,
    squats: 0,
    high_knees: 0,
    bicep_curls: 0,
    tricep_extensions: 0,
    lateral_raises: 0,
  });

  useEffect(() => {
    const fetchEnrolledChallenges = async () => {
      if (!user) return;

      try {
        const response = await challengeAPI.getEnrolledChallenges();

        // Transform challenges
        const transformedChallenges: Challenge[] = [];
        response.challenges.forEach((apiChallenge) => {
          try {
            const repReward: any = {};
            Object.entries(apiChallenge.repReward).forEach(([key, value]) => {
              if (Array.isArray(value)) {
                repReward[key] = { amount: value[0], perReps: value[1] };
              } else {
                repReward[key] = { amount: value as number, perReps: 1 };
              }
            });

            const transformed: Challenge = {
              id: apiChallenge._id,
              name: apiChallenge.name,
              creatorId: apiChallenge.creatorUserId,
              creatorName: 'User',
              description: apiChallenge.description,
              enabledExercises: apiChallenge.enabledExercises as any,
              userContributions: apiChallenge.contributions,
              enrolledUsers: apiChallenge.participants,
              repGoal: apiChallenge.repGoal as any,
              repReward: repReward,
              repRewardType: Object.values(apiChallenge.repRewardType)[0] || 'trees planted',
              completionReward: apiChallenge.completionReward,
              startDate: new Date(apiChallenge.startDate),
              endDate: new Date(apiChallenge.endDate),
              isCompleted: apiChallenge.completed,
            };

            transformedChallenges.push(transformed);
          } catch (error) {
            console.error('Failed to transform challenge:', error);
          }
        });

        setEnrolledChallenges(transformedChallenges);

        // Calculate lifetime stats from all enrolled challenges
        const stats = {
          jumping_jacks: 0,
          squats: 0,
          high_knees: 0,
          bicep_curls: 0,
          tricep_extensions: 0,
          lateral_raises: 0,
        };

        transformedChallenges.forEach((challenge) => {
          const userContribution = challenge.userContributions[user.id];
          if (userContribution) {
            Object.entries(userContribution).forEach(([exercise, reps]) => {
              if (exercise in stats) {
                stats[exercise as ExerciseType] += reps as number;
              }
            });
          }
        });

        setLifetimeStats(stats);
      } catch (error) {
        console.error('Failed to fetch enrolled challenges:', error);
        toast({
          title: 'Failed to load profile data',
          description: 'Please try refreshing the page.',
          variant: 'destructive',
        });
      } finally {
        setLoading(false);
      }
    };

    fetchEnrolledChallenges();
  }, [user, toast]);

  if (!isAuthenticated || !user) {
    return <Navigate to="/signin" replace />;
  }

  const totalReps = Object.values(lifetimeStats).reduce((a, b) => a + b, 0);

  // Get past challenges (ended or completed)
  const now = new Date();
  const pastChallenges = enrolledChallenges.filter(
    c => c.isCompleted || now > c.endDate
  );

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      
      <main className="container mx-auto px-4 py-8">
        {/* Profile Header */}
        <Card className="mb-8 overflow-hidden">
          <div className="gradient-hero h-32" />
          <CardContent className="relative pt-0">
            <div className="flex flex-col md:flex-row md:items-end gap-4 -mt-12">
              <div className="flex items-center justify-center w-24 h-24 rounded-2xl bg-background border-4 border-background shadow-lg">
                <User className="h-12 w-12 text-primary" />
              </div>
              <div className="flex-1 pb-2">
                <h1 className="font-display text-3xl font-bold">{user.username}</h1>
                <p className="text-muted-foreground">{user.email}</p>
              </div>
              <Badge variant="secondary" className="gap-1 py-2 px-4">
                <Zap className="h-4 w-4" />
                {totalReps.toLocaleString()} lifetime reps
              </Badge>
            </div>
          </CardContent>
        </Card>

        {/* Color Theme Settings */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Palette className="h-5 w-5 text-primary" />
              Color Theme
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              Choose a color theme for better visual accessibility
            </p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {availableThemes.map((themeOption) => (
                <button
                  key={themeOption.id}
                  onClick={() => {
                    setTheme(themeOption.id);
                    toast({
                      title: 'Theme Updated',
                      description: `Switched to ${themeOption.colors.name}`,
                    });
                  }}
                  className={`relative p-4 rounded-lg border-2 transition-all ${
                    theme === themeOption.id
                      ? 'border-primary shadow-lg'
                      : 'border-border hover:border-primary/50'
                  }`}
                >
                  {/* Color preview */}
                  <div className="flex gap-2 mb-3">
                    <div
                      className="h-12 w-full rounded"
                      style={{ backgroundColor: themeOption.colors.primary }}
                    />
                    <div
                      className="h-12 w-full rounded"
                      style={{ backgroundColor: themeOption.colors.secondary }}
                    />
                  </div>

                  {/* Theme name */}
                  <p className="text-sm font-medium text-center">
                    {themeOption.colors.name}
                  </p>

                  {/* Check mark for selected theme */}
                  {theme === themeOption.id && (
                    <div className="absolute top-2 right-2 bg-primary rounded-full p-1">
                      <Check className="h-3 w-3 text-primary-foreground" />
                    </div>
                  )}
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <span className="ml-2 text-muted-foreground">Loading profile data...</span>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 gap-6">
            {/* Lifetime Stats */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Trophy className="h-5 w-5 text-primary" />
                  Lifetime Stats
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {(['jumping_jacks', 'squats', 'high_knees', 'bicep_curls', 'tricep_extensions', 'lateral_raises'] as ExerciseType[]).map(exercise => (
                  <div key={exercise} className="flex items-center justify-between p-4 rounded-lg bg-muted">
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">{EXERCISE_ICONS[exercise]}</span>
                      <span className="font-medium">{EXERCISE_LABELS[exercise]}</span>
                    </div>
                    <span className="font-display text-2xl font-bold text-foreground">
                      {lifetimeStats[exercise].toLocaleString()}
                    </span>
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* Past Challenges */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calendar className="h-5 w-5 text-primary" />
                  Past Challenges
                </CardTitle>
              </CardHeader>
              <CardContent>
                {pastChallenges.length > 0 ? (
                  <div className="space-y-3">
                    {pastChallenges.slice(0, 5).map((challenge) => {
                      const userContribution = challenge.userContributions[user.id] || {};
                      const totalUserReps = Object.values(userContribution).reduce((sum, r) => sum + (r as number), 0);

                      // Check if challenge was completed
                      const allGoalsMet = challenge.enabledExercises.every((exercise) => {
                        const totalReps = Object.values(challenge.userContributions).reduce(
                          (sum, userReps) => sum + (userReps[exercise] || 0), 0
                        );
                        return totalReps >= challenge.repGoal[exercise];
                      });

                      return (
                        <Link key={challenge.id} to={`/challenges/${challenge.id}`}>
                          <div className="p-3 rounded-lg border hover:border-primary hover:bg-primary/5 transition-all cursor-pointer">
                            <div className="flex items-center justify-between mb-1">
                              <span className="font-medium text-sm">{challenge.name}</span>
                              {allGoalsMet ? (
                                <Badge className="bg-green-600 text-white text-xs">Completed</Badge>
                              ) : (
                                <Badge variant="secondary" className="text-xs">Ended</Badge>
                              )}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              Your contribution: {totalUserReps.toLocaleString()} reps
                            </div>
                            <div className="flex gap-1 mt-2">
                              {challenge.enabledExercises.map((exercise) => {
                                const userReps = userContribution[exercise] || 0;
                                if (userReps > 0) {
                                  return (
                                    <Badge key={exercise} variant="outline" className="text-xs">
                                      {EXERCISE_ICONS[exercise]} {userReps}
                                    </Badge>
                                  );
                                }
                                return null;
                              })}
                            </div>
                          </div>
                        </Link>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <Calendar className="h-12 w-12 mx-auto mb-3 opacity-50" />
                    <p className="text-sm">No past challenges yet</p>
                    <p className="text-xs mt-1">Join a challenge to get started!</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}
      </main>
    </div>
  );
}
