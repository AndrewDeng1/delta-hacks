import { useState, useMemo } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Navbar } from '@/components/Navbar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { CustomRewardModal } from '@/components/CustomRewardModal';
import { EXERCISE_LABELS, ExerciseType } from '@/types';
import { ArrowLeft, TreePine, DollarSign, Waves, Loader2, Sparkles, AlertCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { challengeAPI } from '@/lib/api';

export default function CreateChallenge() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [showCustomModal, setShowCustomModal] = useState(false);
  const [customRewardLabel, setCustomRewardLabel] = useState('');
  const [dateError, setDateError] = useState('');
  
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    rewardType: 'tree',
    completionReward: '',
    startDate: '',
    endDate: '',
    enabledExercises: [] as ExerciseType[],
    repGoals: {
      jumping_jacks: '',
      squats: '',
      high_knees: '',
      bicep_curls: '',
      tricep_extensions: '',
      lateral_raises: '',
    },
    repRewards: {
      jumping_jacks: { amount: '', perReps: '' },
      squats: { amount: '', perReps: '' },
      high_knees: { amount: '', perReps: '' },
      bicep_curls: { amount: '', perReps: '' },
      tricep_extensions: { amount: '', perReps: '' },
      lateral_raises: { amount: '', perReps: '' },
    },
  });

  const rewardTypes = [
    { id: 'tree', label: 'trees planted', icon: TreePine },
    { id: 'usd', label: 'dollars donated', icon: DollarSign },
    { id: 'waste', label: 'lbs of ocean waste removed', icon: Waves },
    { id: 'custom', label: customRewardLabel || 'Custom...', icon: Sparkles },
  ];

  const getRewardLabel = () => {
    if (formData.rewardType === 'custom') return customRewardLabel;
    const type = rewardTypes.find(t => t.id === formData.rewardType);
    return type?.label || '';
  };

  // Calculate total contribution for each exercise
  const calculateTotalContribution = (exercise: ExerciseType) => {
    const goal = parseInt(formData.repGoals[exercise]) || 0;
    const amount = parseFloat(formData.repRewards[exercise].amount) || 0;
    const perReps = parseInt(formData.repRewards[exercise].perReps) || 0;
    
    if (goal > 0 && amount > 0 && perReps > 0) {
      return Math.floor(goal / perReps) * amount;
    }
    return 0;
  };

  // Get today's date in YYYY-MM-DD format for min attribute
  const today = useMemo(() => {
    const now = new Date();
    return now.toISOString().split('T')[0];
  }, []);

  const handleExerciseToggle = (exercise: ExerciseType) => {
    setFormData(prev => ({
      ...prev,
      enabledExercises: prev.enabledExercises.includes(exercise)
        ? prev.enabledExercises.filter(e => e !== exercise)
        : [...prev.enabledExercises, exercise],
    }));
  };

  const handleRewardTypeSelect = (typeId: string) => {
    if (typeId === 'custom') {
      setShowCustomModal(true);
    } else {
      setFormData({ ...formData, rewardType: typeId });
    }
  };

  const handleCustomRewardSave = (type: string, label: string) => {
    setCustomRewardLabel(label);
    setFormData({ ...formData, rewardType: 'custom' });
  };

  const validateDates = (startDate: string, endDate: string) => {
    if (startDate && endDate) {
      const start = new Date(startDate);
      const end = new Date(endDate);
      if (end <= start) {
        setDateError('End date must be after start date');
        return false;
      }
    }
    setDateError('');
    return true;
  };

  const handleStartDateChange = (value: string) => {
    setFormData({ ...formData, startDate: value });
    validateDates(value, formData.endDate);
  };

  const handleEndDateChange = (value: string) => {
    setFormData({ ...formData, endDate: value });
    validateDates(formData.startDate, value);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (formData.enabledExercises.length === 0) {
      toast({
        title: 'Please select at least one exercise',
        variant: 'destructive',
      });
      return;
    }

    if (!validateDates(formData.startDate, formData.endDate)) {
      toast({
        title: 'Invalid dates',
        description: 'End date must be after start date',
        variant: 'destructive',
      });
      return;
    }

    if (formData.rewardType === 'custom' && !customRewardLabel) {
      toast({
        title: 'Please specify a custom contribution type',
        variant: 'destructive',
      });
      return;
    }

    // Validate that enabled exercises have goals and rewards set
    for (const exercise of formData.enabledExercises) {
      if (!formData.repGoals[exercise] || parseInt(formData.repGoals[exercise]) <= 0) {
        toast({
          title: 'Missing goal',
          description: `Please set a rep goal for ${EXERCISE_LABELS[exercise]}`,
          variant: 'destructive',
        });
        return;
      }
      if (!formData.repRewards[exercise].amount || parseFloat(formData.repRewards[exercise].amount) <= 0) {
        toast({
          title: 'Missing reward',
          description: `Please set a contribution amount for ${EXERCISE_LABELS[exercise]}`,
          variant: 'destructive',
        });
        return;
      }
      if (!formData.repRewards[exercise].perReps || parseInt(formData.repRewards[exercise].perReps) <= 0) {
        toast({
          title: 'Missing reps',
          description: `Please set "per X reps" for ${EXERCISE_LABELS[exercise]}`,
          variant: 'destructive',
        });
        return;
      }
    }

    setLoading(true);

    try {
      // Transform form data to match backend format
      const rep_goal: Record<string, number> = {};
      const rep_reward: Record<string, [number, number]> = {};
      const rep_reward_type: Record<string, string> = {};

      // Get reward label based on type
      const rewardLabel = formData.rewardType === 'custom' ? customRewardLabel : getRewardLabel();

      formData.enabledExercises.forEach(exercise => {
        rep_goal[exercise] = parseInt(formData.repGoals[exercise]);
        rep_reward[exercise] = [
          parseFloat(formData.repRewards[exercise].amount),
          parseInt(formData.repRewards[exercise].perReps)
        ];
        rep_reward_type[exercise] = rewardLabel;
      });

      // Convert dates to ISO format
      const startDate = new Date(formData.startDate).toISOString();
      const endDate = new Date(formData.endDate).toISOString();

      console.log('Creating challenge with data:', {
        name: formData.name,
        description: formData.description,
        enabled_exercises: formData.enabledExercises,
        rep_goal,
        rep_reward,
        rep_reward_type,
        completion_reward: formData.completionReward,
        start_date: startDate,
        end_date: endDate,
      });

      const response = await challengeAPI.createChallenge({
        name: formData.name,
        description: formData.description,
        enabled_exercises: formData.enabledExercises,
        rep_goal,
        rep_reward,
        rep_reward_type,
        completion_reward: formData.completionReward,
        start_date: startDate,
        end_date: endDate,
      });

      console.log('Challenge created:', response);

      toast({
        title: 'Challenge Created! 🎉',
        description: 'Your challenge is now live.',
      });

      navigate('/my-challenges');
    } catch (error: any) {
      console.error('Failed to create challenge:', error);
      toast({
        title: 'Failed to create challenge',
        description: error?.message || 'An error occurred. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      
      <main className="container mx-auto px-4 py-8 max-w-3xl">
        {/* Back Button */}
        <Link to="/challenges" className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground mb-6">
          <ArrowLeft className="h-4 w-4" />
          Back to Challenges
        </Link>

        <div className="mb-8">
          <h1 className="font-display text-4xl font-bold mb-2">Create a Challenge</h1>
          <p className="text-muted-foreground">Inspire the community to work out for a cause</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-8">
          {/* Basic Info */}
          <Card>
            <CardHeader>
              <CardTitle>Basic Information</CardTitle>
              <CardDescription>Give your challenge a compelling name and description</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Challenge Name</Label>
                <Input
                  id="name"
                  placeholder="e.g., Plant a Forest Challenge"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  placeholder="Describe your challenge and its impact..."
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  required
                  rows={4}
                />
              </div>
            </CardContent>
          </Card>

          {/* Reward Type */}
          <Card>
            <CardHeader>
              <CardTitle>Contribution Type</CardTitle>
              <CardDescription>What impact will participants create?</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {rewardTypes.map(type => (
                  <button
                    key={type.id}
                    type="button"
                    onClick={() => handleRewardTypeSelect(type.id)}
                    className={`p-4 rounded-lg border-2 transition-all text-center ${
                      formData.rewardType === type.id 
                        ? 'border-primary bg-primary/10' 
                        : 'border-border hover:border-primary/50'
                    }`}
                  >
                    <type.icon className={`h-8 w-8 mx-auto mb-2 ${
                      formData.rewardType === type.id ? 'text-primary' : 'text-muted-foreground'
                    }`} />
                    <span className="text-sm font-medium">{type.label}</span>
                  </button>
                ))}
              </div>

              {/* Preview of how it will look */}
              {getRewardLabel() && (
                <div className="mt-4 p-4 rounded-lg bg-muted border">
                  <p className="text-sm text-muted-foreground mb-2">How users will see it:</p>
                  <p className="font-display text-2xl font-bold">
                    <span className="text-primary">123</span>{' '}
                    <span className="text-foreground">{getRewardLabel()}</span>
                  </p>
                </div>
              )}

              <div className="mt-4 space-y-2">
                <Label htmlFor="completionReward">Completion Reward Message</Label>
                <Input
                  id="completionReward"
                  placeholder="e.g., 1000 trees planted in the Amazon!"
                  value={formData.completionReward}
                  onChange={(e) => setFormData({ ...formData, completionReward: e.target.value })}
                  required
                />
              </div>
            </CardContent>
          </Card>

          {/* Exercises */}
          <Card>
            <CardHeader>
              <CardTitle>Exercises & Goals</CardTitle>
              <CardDescription>Select exercises and set goals for each</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {(['jumping_jacks', 'squats', 'high_knees', 'bicep_curls', 'tricep_extensions', 'lateral_raises'] as ExerciseType[]).map(exercise => {
                const totalContribution = calculateTotalContribution(exercise);
                return (
                  <div key={exercise} className="space-y-3">
                    <div className="flex items-center gap-3">
                      <Checkbox
                        id={exercise}
                        checked={formData.enabledExercises.includes(exercise)}
                        onCheckedChange={() => handleExerciseToggle(exercise)}
                      />
                      <Label htmlFor={exercise} className="font-medium cursor-pointer">
                        {EXERCISE_LABELS[exercise]}
                      </Label>
                    </div>
                    
                    {formData.enabledExercises.includes(exercise) && (
                      <div className="ml-7 space-y-3">
                        <div className="grid grid-cols-3 gap-3 p-4 rounded-lg bg-muted">
                          <div className="space-y-1">
                            <Label className="text-xs text-muted-foreground">Goal (reps)</Label>
                            <Input
                              type="number"
                              placeholder="e.g., 10000"
                              value={formData.repGoals[exercise]}
                              onChange={(e) => setFormData({
                                ...formData,
                                repGoals: { ...formData.repGoals, [exercise]: e.target.value }
                              })}
                            />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs text-muted-foreground">Contribution amount</Label>
                            <Input
                              type="number"
                              placeholder="e.g., 1"
                              value={formData.repRewards[exercise].amount}
                              onChange={(e) => setFormData({
                                ...formData,
                                repRewards: {
                                  ...formData.repRewards,
                                  [exercise]: { ...formData.repRewards[exercise], amount: e.target.value }
                                }
                              })}
                            />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs text-muted-foreground">Per X reps</Label>
                            <Input
                              type="number"
                              placeholder="e.g., 50"
                              value={formData.repRewards[exercise].perReps}
                              onChange={(e) => setFormData({
                                ...formData,
                                repRewards: {
                                  ...formData.repRewards,
                                  [exercise]: { ...formData.repRewards[exercise], perReps: e.target.value }
                                }
                              })}
                            />
                          </div>
                        </div>
                        
                        {/* Auto-calculated total */}
                        {totalContribution > 0 && getRewardLabel() && (
                          <div className="ml-0 p-3 rounded-lg bg-primary/10 border border-primary/20">
                            <p className="text-sm">
                              <span className="text-muted-foreground">If goal is reached: </span>
                              <span className="font-bold text-primary">{totalContribution.toLocaleString()}</span>
                              <span className="text-foreground"> {getRewardLabel()}</span>
                            </p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </CardContent>
          </Card>

          {/* Duration */}
          <Card>
            <CardHeader>
              <CardTitle>Duration</CardTitle>
              <CardDescription>Set the challenge start and end dates</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="startDate">Start Date</Label>
                  <Input
                    id="startDate"
                    type="date"
                    min={today}
                    value={formData.startDate}
                    onChange={(e) => handleStartDateChange(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="endDate">End Date</Label>
                  <Input
                    id="endDate"
                    type="date"
                    min={formData.startDate || today}
                    value={formData.endDate}
                    onChange={(e) => handleEndDateChange(e.target.value)}
                    required
                  />
                </div>
              </div>
              {dateError && (
                <div className="flex items-center gap-2 text-destructive text-sm">
                  <AlertCircle className="h-4 w-4" />
                  {dateError}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Submit */}
          <div className="flex gap-4">
            <Button type="submit" variant="hero" size="lg" disabled={loading || !!dateError} className="flex-1">
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Creating...
                </>
              ) : (
                'Create Challenge'
              )}
            </Button>
            <Link to="/challenges">
              <Button variant="outline" size="lg">Cancel</Button>
            </Link>
          </div>
        </form>
      </main>

      <CustomRewardModal
        open={showCustomModal}
        onOpenChange={setShowCustomModal}
        onSave={handleCustomRewardSave}
      />
    </div>
  );
}
