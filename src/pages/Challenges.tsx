import { useState } from 'react';
import { Navbar } from '@/components/Navbar';
import { ChallengeCard } from '@/components/ChallengeCard';
import { mockChallenges } from '@/data/mockChallenges';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Search, TreePine } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

export default function Challenges() {
  const [searchQuery, setSearchQuery] = useState('');
  const { user } = useAuth();
  const { toast } = useToast();
  const [enrolledChallenges, setEnrolledChallenges] = useState<string[]>(user?.enrolledChallenges || []);

  const now = new Date();
  const activeChallenges = mockChallenges.filter(
    c => now >= c.startDate && now <= c.endDate && !c.isCompleted
  );
  const pastChallenges = mockChallenges.filter(
    c => now > c.endDate || c.isCompleted
  );

  const filterChallenges = (challenges: typeof mockChallenges) => {
    if (!searchQuery) return challenges;
    return challenges.filter(c => 
      c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.description.toLowerCase().includes(searchQuery.toLowerCase())
    );
  };

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
