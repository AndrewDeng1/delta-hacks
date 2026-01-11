import { useState, useMemo, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Navbar } from '@/components/Navbar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { challengeAPI, usersAPI } from '@/lib/api';
import { Challenge } from '@/types';
import {
  EXERCISE_LABELS,
  EXERCISE_ICONS,
  ExerciseType
} from '@/types';
import {
  ArrowLeft,
  Search,
  Users,
  ChevronLeft,
  ChevronRight,
  ArrowUpDown,
  Loader2
} from 'lucide-react';

interface Contributor {
  userId: string;
  username: string;
  email: string;
  reps: Record<ExerciseType, number>;
  totalReps: number;
}

export default function ChallengeContributors() {
  const { id } = useParams();
  const { user } = useAuth();
  const { toast } = useToast();
  const [challenge, setChallenge] = useState<Challenge | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortField, setSortField] = useState<'total' | ExerciseType>('total');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [currentPage, setCurrentPage] = useState(1);
  const [usernameMap, setUsernameMap] = useState<Record<string, string>>({});
  const itemsPerPage = 10;

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

        // Fetch usernames for all contributors
        const userIds = Object.keys(apiChallenge.contributions);
        if (userIds.length > 0) {
          try {
            const { users } = await usersAPI.getUsersBatch(userIds);
            const usernameMapping: Record<string, string> = {};
            for (const userId in users) {
              usernameMapping[userId] = users[userId].username;
            }
            setUsernameMap(usernameMapping);
          } catch (error) {
            console.error('Failed to fetch usernames:', error);
          }
        }
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

  // Transform challenge contributions to contributor list
  const contributors: Contributor[] = useMemo(() => {
    if (!challenge) return [];

    return Object.entries(challenge.userContributions).map(([userId, reps]) => {
      const totalReps = Object.values(reps).reduce((sum, r) => sum + (r as number), 0);

      // Determine display name
      let displayName: string;
      if (userId === user?.id) {
        displayName = 'You';
      } else if (usernameMap[userId]) {
        displayName = usernameMap[userId];
      } else {
        displayName = `User ${userId.slice(-4)}`;
      }

      return {
        userId,
        username: displayName,
        email: '', // We don't have email in the backend response
        reps: reps as Record<ExerciseType, number>,
        totalReps,
      };
    });
  }, [challenge, user, usernameMap]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="container mx-auto px-4 py-12 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <span className="ml-2 text-muted-foreground">Loading contributors...</span>
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

  // Filter contributors
  const filteredContributors = contributors.filter(c =>
    c.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.userId.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Sort contributors
  const sortedContributors = [...filteredContributors].sort((a, b) => {
    let aVal: number, bVal: number;
    if (sortField === 'total') {
      aVal = a.totalReps;
      bVal = b.totalReps;
    } else {
      aVal = a.reps[sortField] || 0;
      bVal = b.reps[sortField] || 0;
    }
    return sortOrder === 'asc' ? aVal - bVal : bVal - aVal;
  });

  // Paginate
  const totalPages = Math.ceil(sortedContributors.length / itemsPerPage);
  const paginatedContributors = sortedContributors.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const toggleSortOrder = () => {
    setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      
      <main className="container mx-auto px-4 py-8">
        {/* Back Button */}
        <Link to={`/challenges/${id}`} className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground mb-6">
          <ArrowLeft className="h-4 w-4" />
          Back to Challenge
        </Link>

        <div className="mb-8">
          <h1 className="font-display text-3xl font-bold mb-2">Contributors</h1>
          <p className="text-muted-foreground">{challenge.name}</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5 text-primary" />
              All Contributors ({filteredContributors.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {/* Search and Sort */}
            <div className="flex flex-col sm:flex-row gap-4 mb-6">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by username or user ID..."
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="pl-10"
                />
              </div>
              <div className="flex gap-2">
                <Select 
                  value={sortField} 
                  onValueChange={(value) => setSortField(value as 'total' | ExerciseType)}
                >
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Sort by" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="total">Total Contributions</SelectItem>
                    {challenge.enabledExercises.map(ex => (
                      <SelectItem key={ex} value={ex}>{EXERCISE_LABELS[ex]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button variant="outline" size="icon" onClick={toggleSortOrder}>
                  <ArrowUpDown className={`h-4 w-4 ${sortOrder === 'asc' ? 'rotate-180' : ''}`} />
                </Button>
              </div>
            </div>

            {/* Contributors Table */}
            {filteredContributors.length > 0 ? (
              <div className="rounded-lg border overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-muted/50">
                      <tr>
                        <th className="text-left p-4 font-medium text-muted-foreground">Rank</th>
                        <th className="text-left p-4 font-medium text-muted-foreground">User</th>
                        {challenge.enabledExercises.map(ex => (
                          <th key={ex} className="text-center p-4 font-medium text-muted-foreground">
                            <span className="mr-1">{EXERCISE_ICONS[ex]}</span>
                            {EXERCISE_LABELS[ex]}
                          </th>
                        ))}
                        <th className="text-center p-4 font-medium text-muted-foreground">Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {paginatedContributors.map((contributor, index) => {
                      const rank = (currentPage - 1) * itemsPerPage + index + 1;
                      return (
                        <tr key={contributor.userId} className="hover:bg-muted/30 transition-colors">
                          <td className="p-4">
                            <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/10 text-primary font-bold text-sm">
                              {rank}
                            </div>
                          </td>
                          <td className="p-4">
                            <p className="font-medium">{contributor.username}</p>
                            <p className="text-sm text-muted-foreground font-mono text-xs">ID: {contributor.userId.slice(-8)}</p>
                          </td>
                          {challenge.enabledExercises.map(ex => (
                            <td key={ex} className="p-4 text-center font-medium">
                              {(contributor.reps[ex] || 0).toLocaleString()}
                            </td>
                          ))}
                          <td className="p-4 text-center">
                            <span className="font-bold text-primary">
                              {contributor.totalReps.toLocaleString()}
                            </span>
                          </td>
                        </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <div className="text-center py-12 text-muted-foreground">
                <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No contributors found</p>
                <p className="text-sm mt-1">Be the first to contribute to this challenge!</p>
              </div>
            )}

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between mt-6">
                <p className="text-sm text-muted-foreground">
                  Showing {(currentPage - 1) * itemsPerPage + 1} to {Math.min(currentPage * itemsPerPage, sortedContributors.length)} of {sortedContributors.length}
                </p>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                  >
                    <ChevronLeft className="h-4 w-4" />
                    Previous
                  </Button>
                  <div className="flex items-center gap-1">
                    {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                      <Button
                        key={page}
                        variant={currentPage === page ? "default" : "ghost"}
                        size="sm"
                        onClick={() => setCurrentPage(page)}
                        className="w-8 h-8 p-0"
                      >
                        {page}
                      </Button>
                    ))}
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                  >
                    Next
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
