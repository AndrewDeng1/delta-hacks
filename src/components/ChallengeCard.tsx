import { Challenge, EXERCISE_LABELS, ExerciseType } from '@/types';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Calendar, Users, TreePine, DollarSign, Waves, Trophy } from 'lucide-react';
import { Link } from 'react-router-dom';

interface ChallengeCardProps {
  challenge: Challenge;
  userEnrolled?: boolean;
  onEnroll?: () => void;
  onLeave?: () => void;
}

const getRewardIcon = (type: string) => {
  switch (type.toLowerCase()) {
    case 'tree':
    case 'trees':
      return <TreePine className="h-4 w-4" />;
    case 'usd':
    case 'dollar':
      return <DollarSign className="h-4 w-4" />;
    case 'lb':
    case 'waste':
      return <Waves className="h-4 w-4" />;
    default:
      return <Trophy className="h-4 w-4" />;
  }
};

export function ChallengeCard({ challenge, userEnrolled, onEnroll, onLeave }: ChallengeCardProps) {
  const now = new Date();
  const isActive = now >= challenge.startDate && now <= challenge.endDate && !challenge.isCompleted;
  const isPast = now > challenge.endDate || challenge.isCompleted;
  const isUpcoming = now < challenge.startDate;

  // Calculate total progress (capped at goal)
  const totalReps = Object.values(challenge.userContributions).reduce((sum, userReps) => {
    return sum + Object.values(userReps).reduce((s, r) => s + r, 0);
  }, 0);
  const totalGoal = Object.values(challenge.repGoal).reduce((s, g) => s + g, 0);
  const cappedReps = Math.min(totalReps, totalGoal);
  const progressPercent = totalGoal > 0 ? Math.min((cappedReps / totalGoal) * 100, 100) : 0;

  // Check if goals were met (for past challenges)
  const checkGoalsMet = () => {
    if (!isPast) return null;

    for (const exercise of challenge.enabledExercises) {
      const exerciseReps = Object.values(challenge.userContributions).reduce(
        (sum, userReps) => sum + (userReps[exercise] || 0), 0
      );
      const exerciseGoal = challenge.repGoal[exercise];
      if (exerciseReps < exerciseGoal) {
        return false;
      }
    }
    return true;
  };

  const goalsMet = checkGoalsMet();

  // Calculate contributions made (based on capped reps)
  const calculateContributions = () => {
    let total = 0;
    for (const exercise of challenge.enabledExercises) {
      const totalExerciseReps = Object.values(challenge.userContributions).reduce(
        (sum, userReps) => sum + (userReps[exercise] || 0), 0
      );
      // Cap reps at goal for contribution calculation
      const goal = challenge.repGoal[exercise];
      const cappedExerciseReps = Math.min(totalExerciseReps, goal);
      const reward = challenge.repReward[exercise];
      if (reward) {
        total += Math.floor(cappedExerciseReps / reward.perReps) * reward.amount;
      }
    }
    return total;
  };

  // Calculate maximum possible contributions if all goals are met
  const calculateMaxContributions = () => {
    let total = 0;
    for (const exercise of challenge.enabledExercises) {
      const goal = challenge.repGoal[exercise];
      const reward = challenge.repReward[exercise];
      if (reward && goal > 0) {
        total += Math.floor(goal / reward.perReps) * reward.amount;
      }
    }
    return total;
  };

  const contributions = calculateContributions();
  const maxContributions = calculateMaxContributions();
  const daysLeft = Math.ceil((challenge.endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

  return (
    <Card className="overflow-hidden shadow-card hover:shadow-lg transition-all duration-300 group">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              {isActive && <Badge className="bg-primary text-primary-foreground">Active</Badge>}
              {isPast && goalsMet === true && (
                <Badge className="bg-green-600 text-white">Completed! 🎉</Badge>
              )}
              {isPast && goalsMet === false && (
                <Badge className="bg-red-600 text-white">Failed 😞</Badge>
              )}
              {isUpcoming && <Badge variant="outline">Upcoming</Badge>}
            </div>
            <h3 className="font-display text-xl font-semibold text-foreground group-hover:text-primary transition-colors">
              {challenge.name}
            </h3>
            <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
              {challenge.description}
            </p>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Contribution Type */}
        <div className="flex items-center gap-2 p-3 rounded-lg bg-nature-light">
          {getRewardIcon(challenge.repRewardType)}
          <span className="text-sm font-medium text-foreground">
            {contributions} / {maxContributions} {challenge.repRewardType}
          </span>
        </div>

        {/* Progress */}
        <div>
          <div className="flex items-center justify-between text-sm mb-2">
            <span className="text-muted-foreground">Progress</span>
            <span className="font-semibold">{progressPercent.toFixed(0)}%</span>
          </div>
          <Progress value={progressPercent} className="h-2" />
        </div>

        {/* Enabled Exercises */}
        <div className="flex flex-wrap gap-1">
          {challenge.enabledExercises.map((exercise) => (
            <Badge key={exercise} variant="outline" className="text-xs">
              {EXERCISE_LABELS[exercise]}
            </Badge>
          ))}
        </div>

        {/* Stats */}
        <div className="flex items-center gap-4 text-sm text-muted-foreground">
          <div className="flex items-center gap-1">
            <Users className="h-4 w-4" />
            <span>{challenge.enrolledUsers.length} enrolled</span>
          </div>
          <div className="flex items-center gap-1">
            <Calendar className="h-4 w-4" />
            <span>{isActive ? `${daysLeft}d left` : isPast ? 'Ended' : 'Starts soon'}</span>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-2 pt-2">
          <Link to={`/challenges/${challenge.id}`} className="flex-1">
            <Button variant="outline" className="w-full">View Details</Button>
          </Link>
          {!isPast && (
            userEnrolled ? (
              <Button variant="outline" onClick={onLeave} className="text-destructive border-destructive hover:bg-destructive hover:text-white">
                Leave
              </Button>
            ) : (
              <Button variant="hero" onClick={onEnroll}>
                Join
              </Button>
            )
          )}
        </div>
      </CardContent>
    </Card>
  );
}
