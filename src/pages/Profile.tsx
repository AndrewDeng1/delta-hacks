import { Navbar } from '@/components/Navbar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { EXERCISE_LABELS, EXERCISE_ICONS, ExerciseType } from '@/types';
import { useAuth } from '@/contexts/AuthContext';
import { User, Trophy, Zap, TreePine, Heart } from 'lucide-react';
import { Navigate } from 'react-router-dom';

export default function Profile() {
  const { user, isAuthenticated } = useAuth();

  if (!isAuthenticated || !user) {
    return <Navigate to="/signin" replace />;
  }

  const totalReps = Object.values(user.lifetimeStats).reduce((a, b) => a + b, 0);

  // Mock achievements
  const achievements = [
    { name: 'First Steps', description: 'Complete your first exercise session', unlocked: true },
    { name: 'Century Club', description: 'Complete 100 reps in one session', unlocked: true },
    { name: 'Tree Hugger', description: 'Contribute to planting 10 trees', unlocked: true },
    { name: 'Ocean Warrior', description: 'Help remove 50 lbs of ocean waste', unlocked: false },
    { name: 'Charity Champion', description: 'Donate $100 through exercises', unlocked: false },
    { name: 'Marathon', description: 'Complete 10,000 total reps', unlocked: false },
  ];

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
              {(['jumping_jacks', 'squats', 'high_knees'] as ExerciseType[]).map(exercise => (
                <div key={exercise} className="flex items-center justify-between p-4 rounded-lg bg-muted">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{EXERCISE_ICONS[exercise]}</span>
                    <span className="font-medium">{EXERCISE_LABELS[exercise]}</span>
                  </div>
                  <span className="font-display text-2xl font-bold text-primary">
                    {user.lifetimeStats[exercise].toLocaleString()}
                  </span>
                </div>
              ))}

              {/* Impact Summary */}
              <div className="pt-4 border-t border-border">
                <h4 className="text-sm font-medium text-muted-foreground mb-3">Estimated Impact</h4>
                <div className="grid grid-cols-3 gap-3 text-center">
                  <div className="p-3 rounded-lg bg-nature-light">
                    <TreePine className="h-5 w-5 mx-auto text-primary mb-1" />
                    <p className="font-display text-xl font-bold">56</p>
                    <p className="text-xs text-muted-foreground">Trees</p>
                  </div>
                  <div className="p-3 rounded-lg bg-ocean/10">
                    <Heart className="h-5 w-5 mx-auto text-ocean mb-1" />
                    <p className="font-display text-xl font-bold">$48</p>
                    <p className="text-xs text-muted-foreground">Donated</p>
                  </div>
                  <div className="p-3 rounded-lg bg-energy/10">
                    <Zap className="h-5 w-5 mx-auto text-energy mb-1" />
                    <p className="font-display text-xl font-bold">32</p>
                    <p className="text-xs text-muted-foreground">lbs waste</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Achievements */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Trophy className="h-5 w-5 text-energy" />
                Achievements
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-3">
                {achievements.map((achievement, index) => (
                  <div 
                    key={index}
                    className={`p-3 rounded-lg border transition-all ${
                      achievement.unlocked 
                        ? 'border-primary bg-primary/5' 
                        : 'border-border bg-muted/50 opacity-60'
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <Trophy className={`h-4 w-4 ${achievement.unlocked ? 'text-energy' : 'text-muted-foreground'}`} />
                      <span className="font-medium text-sm">{achievement.name}</span>
                    </div>
                    <p className="text-xs text-muted-foreground">{achievement.description}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
