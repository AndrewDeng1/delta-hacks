import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { TreePine, Waves, Heart, Users, Trophy, Zap, ArrowRight } from 'lucide-react';
import { challengeAPI } from '@/lib/api';
import { Challenge } from '@/types';

export default function Landing() {
  const [activeChallenges, setActiveChallenges] = useState<Challenge[]>([]);
  const [loading, setLoading] = useState(true);

  // Fetch active challenges
  useEffect(() => {
    const fetchChallenges = async () => {
      try {
        const response = await challengeAPI.getAllChallenges();

        // Transform and filter to active challenges
        const now = new Date();
        const transformedChallenges: Challenge[] = [];

        response.challenges.forEach((apiChallenge) => {
          try {
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

            // Only include active challenges
            if (!transformed.isCompleted && now <= transformed.endDate) {
              transformedChallenges.push(transformed);
            }
          } catch (error) {
            console.error('Failed to transform challenge:', error);
          }
        });

        // Take only first 3 active challenges
        setActiveChallenges(transformedChallenges.slice(0, 3));
      } catch (error) {
        console.error('Failed to fetch challenges:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchChallenges();
  }, []);

  // Calculate progress for a challenge
  const calculateProgress = (challenge: Challenge) => {
    const totalReps = Object.values(challenge.userContributions).reduce((sum, userReps) => {
      return sum + Object.values(userReps).reduce((s, r) => s + r, 0);
    }, 0);
    const totalGoal = Object.values(challenge.repGoal).reduce((s, g) => s + g, 0);
    return totalGoal > 0 ? Math.min((totalReps / totalGoal) * 100, 100) : 0;
  };

  // Format reward display
  const formatReward = (challenge: Challenge) => {
    // Get first enabled exercise reward as representative
    const firstExercise = challenge.enabledExercises[0];
    const reward = challenge.repReward[firstExercise];
    if (reward) {
      return `${reward.amount} ${challenge.repRewardType} / ${reward.perReps} reps`;
    }
    return challenge.repRewardType;
  };

  return (
    <div className="min-h-screen">
      {/* Hero Section */}
      <section className="relative overflow-hidden bg-gradient-to-b from-nature-light to-background py-20 lg:py-32">
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute -top-40 -right-40 h-80 w-80 rounded-full bg-primary/10 blur-3xl animate-float" />
          <div className="absolute -bottom-40 -left-40 h-80 w-80 rounded-full bg-ocean/10 blur-3xl animate-float" style={{ animationDelay: '2s' }} />
        </div>
        
        <div className="container mx-auto px-4 relative z-10">
          <div className="max-w-4xl mx-auto text-center">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary font-medium mb-6 animate-fade-in">
              <Zap className="h-4 w-4" />
              <span>Exercise with purpose</span>
            </div>
            
            <h1 className="font-display text-5xl md:text-7xl font-bold mb-6 animate-slide-up">
              Move Your Body,
              <span className="block text-gradient">Change the World</span>
            </h1>
            
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto mb-10 animate-slide-up" style={{ animationDelay: '0.1s' }}>
              Join community fitness challenges where every rep makes a real impact. 
              Plant trees, clean oceans, and donate to charity—just by working out at home.
            </p>
            
            <div className="flex flex-col sm:flex-row gap-4 justify-center animate-slide-up" style={{ animationDelay: '0.2s' }}>
              <Link to="/signup">
                <Button variant="hero" size="xl" className="gap-2">
                  Start Moving
                  <ArrowRight className="h-5 w-5" />
                </Button>
              </Link>
              <Link to="/signin">
                <Button variant="outline" size="xl">
                  Sign In
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Impact Stats */}
      <section className="py-16 border-y border-border">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {[
              { value: '50K+', label: 'Trees Planted', icon: TreePine, color: 'text-primary' },
              { value: '1.2K', label: 'Lbs Ocean Waste', icon: Waves, color: 'text-ocean' },
              { value: '$25K', label: 'Donated', icon: Heart, color: 'text-energy' },
              { value: '10K+', label: 'Active Users', icon: Users, color: 'text-impact' },
            ].map((stat, index) => (
              <div key={index} className="text-center">
                <stat.icon className={`h-8 w-8 mx-auto mb-3 ${stat.color}`} />
                <div className="font-display text-4xl font-bold mb-1">{stat.value}</div>
                <div className="text-muted-foreground">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-20">
        <div className="container mx-auto px-4">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <h2 className="font-display text-4xl font-bold mb-4">How It Works</h2>
            <p className="text-muted-foreground text-lg">
              Turn your home workouts into real-world impact in three simple steps.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                step: '01',
                title: 'Join a Challenge',
                description: 'Browse active challenges and pick one that resonates with your values. Trees, oceans, charity—your choice!',
                icon: Users,
              },
              {
                step: '02',
                title: 'Start Exercising',
                description: 'Use your webcam to track jumping jacks, squats, and high knees. Our AI counts your reps in real-time.',
                icon: Zap,
              },
              {
                step: '03',
                title: 'Create Impact',
                description: 'Every rep you do translates into real rewards—trees planted, waste removed, or money donated.',
                icon: Trophy,
              },
            ].map((item, index) => (
              <Card key={index} className="relative overflow-hidden group hover:shadow-lg transition-all duration-300">
                <CardContent className="pt-8 pb-6">
                  <div className="absolute -top-4 -right-4 font-display text-8xl font-bold text-muted/30 group-hover:text-primary/20 transition-colors">
                    {item.step}
                  </div>
                  <item.icon className="h-12 w-12 text-primary mb-4" />
                  <h3 className="font-display text-xl font-semibold mb-2">{item.title}</h3>
                  <p className="text-muted-foreground">{item.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Featured Challenges */}
      <section className="py-20 bg-muted/50">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between mb-12">
            <div>
              <h2 className="font-display text-4xl font-bold mb-2">Active Challenges</h2>
              <p className="text-muted-foreground">Join thousands making a difference today</p>
            </div>
            <Link to="/challenges">
              <Button variant="outline" className="gap-2">
                View All
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            {loading ? (
              // Loading skeleton
              [1, 2, 3].map((i) => (
                <Card key={i} className="animate-pulse">
                  <CardContent className="pt-6">
                    <div className="h-6 bg-muted rounded mb-2" />
                    <div className="h-4 bg-muted rounded w-2/3 mb-4" />
                    <div className="h-2 bg-muted rounded mb-3" />
                    <div className="flex justify-between">
                      <div className="h-4 bg-muted rounded w-20" />
                      <div className="h-4 bg-muted rounded w-16" />
                    </div>
                  </CardContent>
                </Card>
              ))
            ) : activeChallenges.length > 0 ? (
              // Real challenges
              activeChallenges.map((challenge) => {
                const progress = calculateProgress(challenge);
                return (
                  <Link key={challenge.id} to={`/challenges/${challenge.id}`}>
                    <Card className="hover:shadow-lg transition-all duration-300 hover:-translate-y-1 h-full">
                      <CardContent className="pt-6">
                        <h3 className="font-display text-xl font-semibold mb-2">{challenge.name}</h3>
                        <div className="flex items-center gap-2 text-sm text-primary font-medium mb-4">
                          <Trophy className="h-4 w-4" />
                          {formatReward(challenge)}
                        </div>
                        <div className="h-2 rounded-full bg-muted overflow-hidden mb-3">
                          <div
                            className="h-full gradient-hero rounded-full transition-all duration-500"
                            style={{ width: `${progress}%` }}
                          />
                        </div>
                        <div className="flex items-center justify-between text-sm text-muted-foreground">
                          <span>{challenge.enrolledUsers.length} enrolled</span>
                          <span>{Math.round(progress)}% complete</span>
                        </div>
                      </CardContent>
                    </Card>
                  </Link>
                );
              })
            ) : (
              // No challenges fallback
              <Card className="md:col-span-3">
                <CardContent className="pt-6 text-center py-12">
                  <Trophy className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                  <h3 className="font-display text-xl font-semibold mb-2">No Active Challenges</h3>
                  <p className="text-muted-foreground mb-4">Be the first to create a challenge!</p>
                  <Link to="/create-challenge">
                    <Button variant="hero">Create Challenge</Button>
                  </Link>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20">
        <div className="container mx-auto px-4">
          <div className="relative rounded-3xl gradient-hero p-12 md:p-20 text-center overflow-hidden">
            <div className="absolute inset-0 bg-black/10" />
            <div className="relative z-10">
              <h2 className="font-display text-4xl md:text-5xl font-bold text-primary-foreground mb-6">
                Ready to Make an Impact?
              </h2>
              <p className="text-xl text-primary-foreground/90 max-w-2xl mx-auto mb-10">
                Join Motion4Good today and start transforming your workouts into positive change for the planet.
              </p>
              <Link to="/signup">
                <Button variant="energy" size="xl" className="gap-2">
                  Get Started Free
                  <ArrowRight className="h-5 w-5" />
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border py-12">
        <div className="container mx-auto px-4">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg gradient-hero">
                <TreePine className="h-4 w-4 text-primary-foreground" />
              </div>
              <span className="font-display font-bold">Motion4Good</span>
            </div>
            <p className="text-sm text-muted-foreground">
              © 2026 Motion4Good. Every rep counts.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
