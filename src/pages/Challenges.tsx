import { useState, useEffect } from 'react';
import { Navbar } from '@/components/Navbar';
import { ChallengeCard } from '@/components/ChallengeCard';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Search, TreePine, Loader2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { challengeAPI, Challenge as APIChallenge } from '@/lib/api';
import { Challenge } from '@/types';

export default function Challenges() {
  const [searchQuery, setSearchQuery] = useState('');
  const { user } = useAuth();
  const { toast } = useToast();
  const [enrolledChallenges, setEnrolledChallenges] = useState<string[]>(user?.enrolledChallenges || []);
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [loading, setLoading] = useState(true);

  // Fetch challenges on mount
  useEffect(() => {
    const fetchChallenges = async () => {
      try {
        console.log('Fetching challenges...');
        const response = await challengeAPI.getAllChallenges();
        console.log('Fetched challenges from API:', response);
        console.log('Number of challenges:', response.challenges.length);

        // Transform API challenges to frontend format
        const transformedChallenges: Challenge[] = [];

        response.challenges.forEach((apiChallenge, index) => {
          try {
            console.log(`Transforming challenge ${index + 1}:`, apiChallenge);

            // Handle repReward - can be either array [amount, perReps] or just a number
            const repReward: any = {};
            Object.entries(apiChallenge.repReward).forEach(([key, value]) => {
              if (Array.isArray(value)) {
                repReward[key] = { amount: value[0], perReps: value[1] };
              } else {
                // If it's just a number, assume it's the amount and default perReps to 1
                repReward[key] = { amount: value as number, perReps: 1 };
              }
            });

            const transformed: Challenge = {
              id: apiChallenge._id,
              name: apiChallenge.name,
              creatorId: apiChallenge.creatorUserId,
              creatorName: 'User', // Backend doesn't return username
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

            console.log(`Transformed challenge ${index + 1}:`, transformed);
            transformedChallenges.push(transformed);
          } catch (transformError) {
            console.error(`Failed to transform challenge ${index + 1}:`, transformError, apiChallenge);
          }
        });

        console.log('Total transformed challenges:', transformedChallenges.length);
        setChallenges(transformedChallenges);
      } catch (error) {
        console.error('Failed to fetch challenges:', error);
        toast({
          title: 'Failed to load challenges',
          description: 'Please try refreshing the page.',
          variant: 'destructive',
        });
      } finally {
        setLoading(false);
      }
    };

    fetchChallenges();
  }, [toast]);

  const now = new Date();
  // Active challenges: not completed and haven't ended yet (includes upcoming)
  const activeChallenges = challenges.filter(
    c => !c.isCompleted && now <= c.endDate
  );
  // Past challenges: completed or ended
  const pastChallenges = challenges.filter(
    c => c.isCompleted || now > c.endDate
  );

  console.log('All challenges:', challenges.length);
  console.log('Active challenges:', activeChallenges.length, activeChallenges.map(c => c.name));
  console.log('Past challenges:', pastChallenges.length, pastChallenges.map(c => c.name));

  const filterChallenges = (challengeList: Challenge[]) => {
    if (!searchQuery) return challengeList;
    return challengeList.filter(c =>
      c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.description.toLowerCase().includes(searchQuery.toLowerCase())
    );
  };

  // Show loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <main className="container mx-auto px-4 py-8">
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <span className="ml-2 text-muted-foreground">Loading challenges...</span>
          </div>
        </main>
      </div>
    );
  }

  const handleEnroll = (challengeId: string) => {
    setEnrolledChallenges([...enrolledChallenges, challengeId]);
    toast({
      title: 'Enrolled!',
      description: 'You have joined the challenge.',
    });
  };

  const handleUnenroll = (challengeId: string) => {
    setEnrolledChallenges(enrolledChallenges.filter(id => id !== challengeId));
    toast({
      title: 'Left challenge',
      description: 'You have left the challenge.',
    });
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      
      <main className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="font-display text-4xl font-bold mb-2">Challenges</h1>
          <p className="text-muted-foreground">Find challenges that match your fitness goals and values</p>
        </div>

        {/* Search */}
        <div className="relative mb-8">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
          <Input
            placeholder="Search challenges..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>

        {/* Tabs */}
        <Tabs defaultValue="active" className="space-y-6">
          <TabsList className="bg-muted">
            <TabsTrigger value="active" className="gap-2">
              <TreePine className="h-4 w-4" />
              Active ({activeChallenges.length})
            </TabsTrigger>
            <TabsTrigger value="past">
              Past ({pastChallenges.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="active" className="space-y-6">
            {filterChallenges(activeChallenges).length > 0 ? (
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filterChallenges(activeChallenges).map((challenge) => (
                  <ChallengeCard
                    key={challenge.id}
                    challenge={challenge}
                    userEnrolled={enrolledChallenges.includes(challenge.id)}
                    onEnroll={() => handleEnroll(challenge.id)}
                    onLeave={() => handleUnenroll(challenge.id)}
                  />
                ))}
              </div>
            ) : (
              <div className="text-center py-12 text-muted-foreground">
                <TreePine className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No active challenges found</p>
              </div>
            )}
          </TabsContent>

          <TabsContent value="past" className="space-y-6">
            {filterChallenges(pastChallenges).length > 0 ? (
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filterChallenges(pastChallenges).map((challenge) => (
                  <ChallengeCard
                    key={challenge.id}
                    challenge={challenge}
                    userEnrolled={enrolledChallenges.includes(challenge.id)}
                  />
                ))}
              </div>
            ) : (
              <div className="text-center py-12 text-muted-foreground">
                <p>No past challenges found</p>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
