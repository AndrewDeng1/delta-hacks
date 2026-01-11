import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { Navbar } from '@/components/Navbar';
import { ExerciseSession } from '@/components/ExerciseSession';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import {
  EXERCISE_LABELS,
  EXERCISE_ICONS,
  ExerciseType,
  SessionStats,
  Challenge
} from '@/types';
import {
  ArrowLeft,
  Calendar,
  Users,
  Trophy,
  Play,
  TreePine,
  Target,
  Trash2,
  LogOut,
  ExternalLink,
  Loader2
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { challengeAPI } from '@/lib/api';

export default function ChallengeDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, updateUserStats } = useAuth();
  const { toast } = useToast();
  const [challenge, setChallenge] = useState<Challenge | null>(null);
  const [loading, setLoading] = useState(true);
  const [showSession, setShowSession] = useState(false);
  const [showLeaveDialog, setShowLeaveDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  // Fetch challenge data
  useEffect(() => {
    const fetchChallenge = async () => {
      if (!id) return;

      try {
        console.log('Fetching challenge:', id);
        const apiChallenge = await challengeAPI.getChallenge(id);
        console.log('Fetched challenge:', apiChallenge);

        // Handle repReward transformation
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

        setChallenge(transformed);
      } catch (error) {
        console.error('Failed to fetch challenge:', error);
        toast({
          title: 'Failed to load challenge',
          description: 'Please try again.',
          variant: 'destructive',
        });
      } finally {
        setLoading(false);
      }
    };

    fetchChallenge();
  }, [id, toast]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="container mx-auto px-4 py-12 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <span className="ml-2 text-muted-foreground">Loading challenge...</span>
        </div>
      </div>
    );
  }

  if (!challenge) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="container mx-auto px-4 py-12 text-center">
          <h1 className="text-2xl font-bold mb-4">Challenge not found</h1>
          <Link to="/challenges">
            <Button>Back to Challenges</Button>
          </Link>
        </div>
      </div>
    );
  }

  const now = new Date();
  const isActive = now >= challenge.startDate && now <= challenge.endDate && !challenge.isCompleted;
  const daysLeft = Math.ceil((challenge.endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

  // Check if user owns this challenge
  const isOwner = user?.id === challenge.creatorId;

  // Check if user is enrolled
  const enrolled = challenge.enrolledUsers.includes(user?.id || '');

  // Calculate total reps per exercise (capped at goal)
  const getTotalReps = (exercise: ExerciseType) => {
    const actual = Object.values(challenge.userContributions).reduce(
      (sum, userReps) => sum + (userReps[exercise] || 0), 0
    );
    const goal = challenge.repGoal[exercise] || 0;
    return Math.min(actual, goal);
  };

  // Get actual reps (not capped) for checking completion
  const getActualTotalReps = (exercise: ExerciseType) => {
    return Object.values(challenge.userContributions).reduce(
      (sum, userReps) => sum + (userReps[exercise] || 0), 0
    );
  };

  // Calculate contributions (based on capped reps)
  const getContributions = (exercise: ExerciseType) => {
    const totalReps = getTotalReps(exercise); // Already capped
    const reward = challenge.repReward[exercise];
    if (reward && reward.perReps > 0) {
      return Math.floor(totalReps / reward.perReps) * reward.amount;
    }
    return 0;
  };

  const totalContributions = challenge.enabledExercises.reduce(
    (sum, ex) => sum + getContributions(ex), 0
  );

  // Calculate maximum possible contributions if all goals are met
  const getMaxContributions = (exercise: ExerciseType) => {
    const goal = challenge.repGoal[exercise];
    const reward = challenge.repReward[exercise];
    if (reward && reward.perReps > 0 && goal > 0) {
      return Math.floor(goal / reward.perReps) * reward.amount;
    }
    return 0;
  };

  const maxTotalContributions = challenge.enabledExercises.reduce(
    (sum, ex) => sum + getMaxContributions(ex), 0
  );

  // Calculate top contributors from actual challenge data
  const getTopContributors = () => {
    // Convert userContributions object to array with total reps
    const contributorsArray = Object.entries(challenge.userContributions).map(([userId, reps]) => {
      const totalReps = Object.values(reps).reduce((sum, r) => sum + (r as number), 0);
      return {
        userId,
        username: userId === user?.id ? 'You' : `User ${userId.slice(-4)}`, // Show last 4 chars of ID
        reps,
        totalReps,
      };
    });

    // Sort by total reps (descending) and take top 3
    return contributorsArray
      .sort((a, b) => b.totalReps - a.totalReps)
      .slice(0, 3);
  };

  const topContributors = getTopContributors();

  // Check if challenge is ended or completed
  const isEnded = now > challenge.endDate || challenge.isCompleted;

  // Check if all goals were met (for completion status)
  const checkGoalsMet = () => {
    if (!isEnded) return null;

    let allGoalsMet = true;
    for (const exercise of challenge.enabledExercises) {
      const actualReps = getActualTotalReps(exercise);
      const goal = challenge.repGoal[exercise];
      if (actualReps < goal) {
        allGoalsMet = false;
        break;
      }
    }
    return allGoalsMet;
  };

  const goalsMet = checkGoalsMet();

  const handleEnroll = async () => {
    if (!challenge || !id) return;

    try {
      await challengeAPI.enrollInChallenge(id);

      // Update local state
      setChallenge({
        ...challenge,
        enrolledUsers: [...challenge.enrolledUsers, user?.id || ''],
      });

      toast({
        title: 'Enrolled!',
        description: `You've joined "${challenge.name}"`,
      });
    } catch (error: any) {
      console.error('Failed to enroll:', error);
      toast({
        title: 'Failed to enroll',
        description: error?.message || 'Please try again.',
        variant: 'destructive',
      });
    }
  };

  const handleLeaveChallenge = async () => {
    if (!challenge || !id) return;

    try {
      await challengeAPI.unenrollFromChallenge(id);

      // Update local state
      setChallenge({
        ...challenge,
        enrolledUsers: challenge.enrolledUsers.filter(uid => uid !== user?.id),
      });

      setShowLeaveDialog(false);
      toast({
        title: 'Left Challenge',
        description: 'Your contributions have been removed.',
      });
    } catch (error: any) {
      console.error('Failed to unenroll:', error);
      setShowLeaveDialog(false);
      toast({
        title: 'Failed to leave challenge',
        description: error?.message || 'Please try again.',
        variant: 'destructive',
      });
    }
  };

  const handleDeleteChallenge = async () => {
    if (!id) return;

    try {
      await challengeAPI.deleteChallenge(id);

      setShowDeleteDialog(false);
      toast({
        title: 'Challenge Deleted',
        description: 'The challenge has been permanently deleted.',
      });
      navigate('/my-challenges');
    } catch (error: any) {
      console.error('Failed to delete challenge:', error);
      setShowDeleteDialog(false);
      toast({
        title: 'Failed to delete challenge',
        description: error?.message || 'Please try again.',
        variant: 'destructive',
      });
    }
  };

  const handleSessionEnd = (stats: SessionStats) => {
    setShowSession(false);
    
    // Update user stats
    for (const exercise of challenge.enabledExercises) {
      if (stats.reps[exercise] > 0) {
        updateUserStats(exercise, stats.reps[exercise]);
      }
    }

    toast({
      title: 'Session Complete! 🎉',
      description: `You contributed ${stats.rewardsEarned} ${challenge.repRewardType} this session!`,
    });
  };

  if (showSession) {
    return (
      <ExerciseSession
        challenge={challenge}
        onEnd={handleSessionEnd}
        onClose={() => setShowSession(false)}
        onChallengeUpdate={(updatedChallenge) => setChallenge(updatedChallenge)}
      />
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      
      <main className="container mx-auto px-4 py-8">
        {/* Back Button */}
        <Link to="/challenges" className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground mb-6">
          <ArrowLeft className="h-4 w-4" />
          Back to Challenges
        </Link>

        {/* Header */}
        <div className="flex flex-col lg:flex-row gap-8 mb-8">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-4">
              {isActive && <Badge className="bg-primary text-primary-foreground">Active</Badge>}
              {!isActive && goalsMet === true && (
                <Badge className="bg-green-600 text-white">Challenge Completed! 🎉</Badge>
              )}
              {!isActive && goalsMet === false && (
                <Badge className="bg-red-600 text-white">Challenge Failed 😞</Badge>
              )}
              {isOwner && <Badge variant="outline">Your Challenge</Badge>}
            </div>
            <h1 className="font-display text-4xl font-bold mb-4">{challenge.name}</h1>
            <p className="text-lg text-muted-foreground mb-6">{challenge.description}</p>
            
            <div className="flex flex-wrap gap-4 text-sm text-muted-foreground mb-6">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4" />
                {challenge.enrolledUsers.length} enrolled
              </div>
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                {isActive ? `${daysLeft} days left` : 'Ended'}
              </div>
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground">by</span>
                <span className="font-medium text-foreground">{challenge.creatorName}</span>
              </div>
            </div>

            {/* Enabled Exercises */}
            <div className="flex flex-wrap gap-2 mb-6">
              {challenge.enabledExercises.map((exercise) => (
                <Badge key={exercise} variant="outline" className="gap-1">
                  <span>{EXERCISE_ICONS[exercise]}</span>
                  {EXERCISE_LABELS[exercise]}
                </Badge>
              ))}
            </div>

            {/* Action Buttons */}
            <div className="flex flex-wrap gap-3">
              {/* Show exercise/enroll buttons for active challenges */}
              {isActive && enrolled && (
                <>
                  <Button variant="hero" size="lg" onClick={() => setShowSession(true)} className="gap-2">
                    <Play className="h-5 w-5" />
                    Start Exercising
                  </Button>
                  <Button variant="outline" size="lg" onClick={() => setShowLeaveDialog(true)} className="gap-2 text-destructive border-destructive hover:bg-destructive hover:text-white hover:border-destructive">
                    <LogOut className="h-5 w-5" />
                    Leave Challenge
                  </Button>
                </>
              )}
              {isActive && !enrolled && (
                <Button variant="hero" size="lg" onClick={handleEnroll} className="gap-2">
                  <Users className="h-5 w-5" />
                  Join Challenge
                </Button>
              )}

              {/* Show delete button for owners (active or past) */}
              {isOwner && (
                <Button variant="outline" size="lg" onClick={() => setShowDeleteDialog(true)} className="gap-2 text-destructive border-destructive hover:bg-destructive hover:text-white hover:border-destructive">
                  <Trash2 className="h-5 w-5" />
                  Delete Challenge
                </Button>
              )}
            </div>
          </div>

          {/* Impact Card */}
          <Card className="lg:w-80 gradient-card border-primary/20">
            <CardContent className="pt-6">
              <div className="text-center mb-6">
                <Trophy className="h-12 w-12 mx-auto text-primary mb-3" />
                <p className="text-sm text-muted-foreground mb-1">Total Community Impact</p>
                <div className="flex items-baseline justify-center gap-2">
                  <p className="font-display text-5xl font-bold text-gradient">
                    {totalContributions}
                  </p>
                  <p className="font-display text-2xl text-muted-foreground">
                    / {maxTotalContributions}
                  </p>
                </div>
                <p className="text-lg text-muted-foreground mt-1">{challenge.repRewardType}</p>
              </div>
              <div className="p-4 rounded-lg bg-muted/50 text-center">
                <Target className="h-5 w-5 mx-auto text-primary mb-2" />
                <p className="text-sm text-muted-foreground">Completion Goal</p>
                <p className="font-medium text-sm mt-1">{challenge.completionReward}</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Progress Section */}
        <div className="grid md:grid-cols-2 gap-6 mb-8">
          {/* Exercise Progress */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TreePine className="h-5 w-5 text-primary" />
                Exercise Progress
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {challenge.enabledExercises.map((exercise) => {
                const total = getTotalReps(exercise); // Capped at goal
                const actualTotal = getActualTotalReps(exercise); // Actual reps
                const goal = challenge.repGoal[exercise];
                const progress = goal > 0 ? Math.min((total / goal) * 100, 100) : 0;
                const reward = challenge.repReward[exercise];
                const contributions = getContributions(exercise);
                const goalMet = actualTotal >= goal;

                return (
                  <div key={exercise}>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-xl">{EXERCISE_ICONS[exercise]}</span>
                        <span className="font-medium">{EXERCISE_LABELS[exercise]}</span>
                        {goalMet && <span className="text-green-600">✓</span>}
                      </div>
                      <span className="text-sm text-muted-foreground">
                        {total.toLocaleString()} / {goal.toLocaleString()}
                      </span>
                    </div>
                    <Progress value={progress} className="h-3 mb-2" />
                    {reward && (
                      <p className="text-sm text-primary">
                        {reward.amount} {challenge.repRewardType} per {reward.perReps} reps
                        <span className="text-muted-foreground"> • {contributions} contributed</span>
                      </p>
                    )}
                  </div>
                );
              })}
            </CardContent>
          </Card>

          {/* Top Contributors */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5 text-primary" />
                Top Contributors
              </CardTitle>
              <Link to={`/challenges/${id}/contributors`}>
                <Button variant="ghost" size="sm" className="gap-1">
                  View All
                  <ExternalLink className="h-4 w-4" />
                </Button>
              </Link>
            </CardHeader>
            <CardContent>
              {topContributors.length > 0 ? (
                <div className="space-y-4">
                  {topContributors.map((contributor, index) => (
                    <div key={contributor.userId} className="flex items-center gap-4">
                      <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/10 text-primary font-bold">
                        {index + 1}
                      </div>
                      <div className="flex-1">
                        <p className="font-medium">{contributor.username}</p>
                        <p className="text-sm text-muted-foreground">{contributor.totalReps.toLocaleString()} total reps</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-6 text-muted-foreground">
                  <p>No contributions yet</p>
                  <p className="text-sm mt-1">Be the first to start exercising!</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </main>

      {/* Leave Challenge Confirmation */}
      <ConfirmDialog
        open={showLeaveDialog}
        onOpenChange={setShowLeaveDialog}
        title="Leave Challenge?"
        description="This will remove all your contributions to this challenge. This action cannot be undone."
        confirmLabel="Leave Challenge"
        variant="destructive"
        onConfirm={handleLeaveChallenge}
      />

      {/* Delete Challenge Confirmation */}
      <ConfirmDialog
        open={showDeleteDialog}
        onOpenChange={setShowDeleteDialog}
        title="Delete Challenge?"
        description="This will permanently delete the challenge and all participant contributions. This action cannot be undone."
        confirmLabel="Delete Challenge"
        variant="destructive"
        onConfirm={handleDeleteChallenge}
      />
    </div>
  );
}
