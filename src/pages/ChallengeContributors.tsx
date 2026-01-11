import { useState, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Navbar } from '@/components/Navbar';
import { mockChallenges } from '@/data/mockChallenges';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
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
  ArrowUpDown
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
  const [searchQuery, setSearchQuery] = useState('');
  const [sortField, setSortField] = useState<'total' | ExerciseType>('total');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  const challenge = mockChallenges.find(c => c.id === id);

  // Mock contributors data
  const mockContributors: Contributor[] = useMemo(() => [
    { userId: '1', username: 'FitnessFan', email: 'fitness@example.com', reps: { jumping_jacks: 500, squats: 300, high_knees: 200 }, totalReps: 1000 },
    { userId: '2', username: 'EcoRunner', email: 'eco@example.com', reps: { jumping_jacks: 320, squats: 180, high_knees: 450 }, totalReps: 950 },
    { userId: '3', username: 'GreenWarrior', email: 'green@example.com', reps: { jumping_jacks: 280, squats: 220, high_knees: 150 }, totalReps: 650 },
    { userId: '4', username: 'NatureLover', email: 'nature@example.com', reps: { jumping_jacks: 150, squats: 400, high_knees: 100 }, totalReps: 650 },
    { userId: '5', username: 'OceanSaver', email: 'ocean@example.com', reps: { jumping_jacks: 200, squats: 150, high_knees: 300 }, totalReps: 650 },
    { userId: '6', username: 'TreeHugger', email: 'tree@example.com', reps: { jumping_jacks: 180, squats: 120, high_knees: 280 }, totalReps: 580 },
    { userId: '7', username: 'CleanPlanet', email: 'clean@example.com', reps: { jumping_jacks: 220, squats: 200, high_knees: 140 }, totalReps: 560 },
    { userId: '8', username: 'HealthyHero', email: 'healthy@example.com', reps: { jumping_jacks: 160, squats: 180, high_knees: 200 }, totalReps: 540 },
    { userId: '9', username: 'EarthFirst', email: 'earth@example.com', reps: { jumping_jacks: 140, squats: 160, high_knees: 220 }, totalReps: 520 },
    { userId: '10', username: 'ActiveLife', email: 'active@example.com', reps: { jumping_jacks: 180, squats: 140, high_knees: 180 }, totalReps: 500 },
    { userId: '11', username: 'FitMind', email: 'fitmind@example.com', reps: { jumping_jacks: 120, squats: 200, high_knees: 160 }, totalReps: 480 },
    { userId: '12', username: 'PowerMove', email: 'power@example.com', reps: { jumping_jacks: 200, squats: 100, high_knees: 150 }, totalReps: 450 },
  ], []);

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
  const filteredContributors = mockContributors.filter(c => 
    c.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.email.toLowerCase().includes(searchQuery.toLowerCase())
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
                  placeholder="Search by username or email..."
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
                            <p className="text-sm text-muted-foreground">{contributor.email}</p>
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
