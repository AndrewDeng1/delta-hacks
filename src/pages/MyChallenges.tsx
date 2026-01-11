import { useState } from 'react';
import { Navbar } from '@/components/Navbar';
import { ChallengeCard } from '@/components/ChallengeCard';
import { mockChallenges } from '@/data/mockChallenges';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Link } from 'react-router-dom';
import { Plus, Trophy, Trash2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

export default function MyChallenges() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [enrolledChallenges, setEnrolledChallenges] = useState<string[]>(['1', '2']);
  const [createdChallenges, setCreatedChallenges] = useState(
    mockChallenges.filter(c => c.creatorId === 'user1')
  );

  const enrolledList = mockChallenges.filter(c => enrolledChallenges.includes(c.id));
  
  const now = new Date();
  const activeCreated = createdChallenges.filter(
    c => now >= c.startDate && now <= c.endDate && !c.isCompleted
  );
  const pastCreated = createdChallenges.filter(
    c => now > c.endDate || c.isCompleted
  );

  const handleUnenroll = (challengeId: string) => {
    setEnrolledChallenges(enrolledChallenges.filter(id => id !== challengeId));
    toast({
      title: 'Left challenge',
      description: 'You have left the challenge.',
    });
  };

  const handleDelete = (challengeId: string) => {
    setCreatedChallenges(createdChallenges.filter(c => c.id !== challengeId));
    toast({
      title: 'Challenge deleted',
      description: 'The challenge has been permanently deleted.',
    });
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      
      <main className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="font-display text-4xl font-bold mb-2">My Challenges</h1>
            <p className="text-muted-foreground">Track your enrolled and created challenges</p>
          </div>
          <Link to="/create-challenge">
            <Button variant="hero" className="gap-2">
              <Plus className="h-4 w-4" />
              Create Challenge
            </Button>
          </Link>
        </div>

        <Tabs defaultValue="enrolled" className="space-y-6">
          <TabsList className="bg-muted">
            <TabsTrigger value="enrolled" className="gap-2">
              <Trophy className="h-4 w-4" />
              Enrolled ({enrolledList.length})
            </TabsTrigger>
            <TabsTrigger value="created">
              Created ({createdChallenges.length})
            </TabsTrigger>
          </TabsList>

          {/* Enrolled Challenges */}
          <TabsContent value="enrolled" className="space-y-6">
            {enrolledList.length > 0 ? (
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                {enrolledList.map((challenge) => (
                  <ChallengeCard
                    key={challenge.id}
                    challenge={challenge}
                    userEnrolled={true}
                    onLeave={() => handleUnenroll(challenge.id)}
                  />
                ))}
              </div>
            ) : (
              <Card>
                <CardContent className="py-12 text-center">
                  <Trophy className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
                  <h3 className="font-display text-xl font-semibold mb-2">No enrolled challenges</h3>
                  <p className="text-muted-foreground mb-4">
                    Join a challenge to start making an impact!
                  </p>
                  <Link to="/challenges">
                    <Button variant="hero">Browse Challenges</Button>
                  </Link>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Created Challenges */}
          <TabsContent value="created" className="space-y-8">
            {/* Active Created */}
            {activeCreated.length > 0 && (
              <div>
                <h2 className="font-display text-xl font-semibold mb-4">Active</h2>
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {activeCreated.map((challenge) => (
                    <ChallengeCard key={challenge.id} challenge={challenge} />
                  ))}
                </div>
              </div>
            )}

            {/* Past Created */}
            {pastCreated.length > 0 && (
              <div>
                <h2 className="font-display text-xl font-semibold mb-4">Past</h2>
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {pastCreated.map((challenge) => (
                    <div key={challenge.id} className="relative">
                      <ChallengeCard challenge={challenge} />
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button 
                            variant="ghost" 
                            size="icon"
                            className="absolute top-4 right-4 text-destructive hover:bg-destructive/10"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete Challenge?</AlertDialogTitle>
                            <AlertDialogDescription>
                              This action cannot be undone. This will permanently delete the challenge
                              and all its data.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => handleDelete(challenge.id)}
                              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            >
                              Delete
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {createdChallenges.length === 0 && (
              <Card>
                <CardContent className="py-12 text-center">
                  <Plus className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
                  <h3 className="font-display text-xl font-semibold mb-2">No created challenges</h3>
                  <p className="text-muted-foreground mb-4">
                    Create your first challenge and inspire others!
                  </p>
                  <Link to="/create-challenge">
                    <Button variant="hero">Create Challenge</Button>
                  </Link>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
