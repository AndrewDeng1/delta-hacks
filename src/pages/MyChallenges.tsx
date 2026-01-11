import { useState, useEffect } from 'react';
import { Navbar } from '@/components/Navbar';
import { ChallengeCard } from '@/components/ChallengeCard';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Link } from 'react-router-dom';
import { Plus, Trophy, Trash2, Loader2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { challengeAPI, Challenge as APIChallenge } from '@/lib/api';
import { Challenge } from '@/types';
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
  const [createdChallenges, setCreatedChallenges] = useState<Challenge[]>([]);
  const [enrolledList, setEnrolledList] = useState<Challenge[]>([]);
  const [loading, setLoading] = useState(true);
  const [showLeaveDialog, setShowLeaveDialog] = useState(false);
  const [challengeToLeave, setChallengeToLeave] = useState<string | null>(null);

  // Helper function to transform API challenge to frontend format
  const transformChallenge = (apiChallenge: any): Challenge | null => {
    try {
      // Handle repReward - can be either array [amount, perReps] or just a number
      const repReward: any = {};
      Object.entries(apiChallenge.repReward).forEach(([key, value]) => {
        if (Array.isArray(value)) {
          repReward[key] = { amount: value[0], perReps: value[1] };
        } else {
          repReward[key] = { amount: value as number, perReps: 1 };
        }
      });

      return {
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
    } catch (error) {
      console.error('Failed to transform challenge:', error, apiChallenge);
      return null;
    }
  };

  // Fetch user's challenges
  useEffect(() => {
    const fetchChallenges = async () => {
      if (!user) return;

      try {
        console.log('Fetching created and enrolled challenges...');

        // Fetch both in parallel
        const [myResponse, enrolledResponse] = await Promise.all([
          challengeAPI.getMyChallenges(),
          challengeAPI.getEnrolledChallenges(),
        ]);

        console.log('Fetched created challenges:', myResponse);
        console.log('Fetched enrolled challenges:', enrolledResponse);

        // Transform created challenges (filter to only those created by user)
        const transformedCreated = myResponse.challenges
          .map(transformChallenge)
          .filter((c): c is Challenge => c !== null && c.creatorId === user.id);

        // Transform enrolled challenges
        const transformedEnrolled = enrolledResponse.challenges
          .map(transformChallenge)
          .filter((c): c is Challenge => c !== null);

        console.log('Created challenges:', transformedCreated.length);
        console.log('Enrolled challenges:', transformedEnrolled.length);

        setCreatedChallenges(transformedCreated);
        setEnrolledList(transformedEnrolled);
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
  }, [user, toast]);
  
  const now = new Date();
  const activeCreated = createdChallenges.filter(
    c => !c.isCompleted && now <= c.endDate
  );
  const pastCreated = createdChallenges.filter(
    c => c.isCompleted || now > c.endDate
  );

  const handleEnroll = async (challengeId: string) => {
    if (!user) return;

    try {
      await challengeAPI.enrollInChallenge(challengeId);

      // Update local state - add user to enrolledUsers
      setCreatedChallenges(prevChallenges =>
        prevChallenges.map(c =>
          c.id === challengeId
            ? { ...c, enrolledUsers: [...c.enrolledUsers, user.id] }
            : c
        )
      );

      toast({
        title: 'Enrolled!',
        description: 'You have joined your challenge.',
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

  const handleUnenrollClick = (challengeId: string) => {
    setChallengeToLeave(challengeId);
    setShowLeaveDialog(true);
  };

  const handleUnenroll = async () => {
    if (!user || !challengeToLeave) return;

    try {
      await challengeAPI.unenrollFromChallenge(challengeToLeave);

      // Update enrolled list
      setEnrolledList(enrolledList.filter(c => c.id !== challengeToLeave));

      // Update created challenges to reflect unenrollment
      setCreatedChallenges(prevChallenges =>
        prevChallenges.map(c =>
          c.id === challengeToLeave
            ? { ...c, enrolledUsers: c.enrolledUsers.filter(id => id !== user.id) }
            : c
        )
      );

      setShowLeaveDialog(false);
      setChallengeToLeave(null);

      toast({
        title: 'Left challenge',
        description: 'You have left the challenge.',
      });
    } catch (error: any) {
      console.error('Failed to unenroll:', error);
      setShowLeaveDialog(false);
      setChallengeToLeave(null);
      toast({
        title: 'Failed to leave challenge',
        description: error?.message || 'Please try again.',
        variant: 'destructive',
      });
    }
  };

  const handleDelete = async (challengeId: string) => {
    try {
      await challengeAPI.deleteChallenge(challengeId);
      setCreatedChallenges(createdChallenges.filter(c => c.id !== challengeId));
      toast({
        title: 'Challenge deleted',
        description: 'The challenge has been permanently deleted.',
      });
    } catch (error: any) {
      console.error('Failed to delete challenge:', error);
      toast({
        title: 'Failed to delete challenge',
        description: error?.message || 'Please try again.',
        variant: 'destructive',
      });
    }
  };

  // Show loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <main className="container mx-auto px-4 py-8">
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <span className="ml-2 text-muted-foreground">Loading your challenges...</span>
          </div>
        </main>
      </div>
    );
  }

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
                    userEnrolled={user ? challenge.enrolledUsers.includes(user.id) : false}
                    onLeave={() => handleUnenrollClick(challenge.id)}
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
                    <ChallengeCard
                      key={challenge.id}
                      challenge={challenge}
                      userEnrolled={user ? challenge.enrolledUsers.includes(user.id) : false}
                      onEnroll={() => handleEnroll(challenge.id)}
                      onLeave={() => handleUnenrollClick(challenge.id)}
                    />
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

      {/* Leave Challenge Confirmation */}
      <ConfirmDialog
        open={showLeaveDialog}
        onOpenChange={setShowLeaveDialog}
        title="Leave Challenge?"
        description="This will remove all your contributions to this challenge. This action cannot be undone."
        confirmLabel="Leave Challenge"
        variant="destructive"
        onConfirm={handleUnenroll}
      />
    </div>
  );
}
