import { useState, useEffect, useRef } from 'react';
import { Challenge, ExerciseType, EXERCISE_LABELS, EXERCISE_ICONS, SessionStats } from '@/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Camera, CameraOff, Trophy, Zap, X, Check, AlertCircle } from 'lucide-react';
import { setTargetExercise, getRepCounts, checkBackendAvailability } from '@/api/exercise';
import { challengeAPI } from '@/lib/api';
import { toast } from 'sonner';

interface ExerciseSessionProps {
  challenge: Challenge;
  onEnd: (stats: SessionStats) => void;
  onClose: () => void;
  onChallengeUpdate?: (updatedChallenge: Challenge) => void;
}

export function ExerciseSession({ challenge, onEnd, onClose, onChallengeUpdate }: ExerciseSessionProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [cameraActive, setCameraActive] = useState(false);
  const [sessionReps, setSessionReps] = useState<Record<ExerciseType, number>>({
    jumping_jacks: 0,
    squats: 0,
    high_knees: 0,
  });
  const [popExercise, setPopExercise] = useState<ExerciseType | null>(null);
  const [selectedExercise, setSelectedExercise] = useState<ExerciseType | null>(null);
  const [backendAvailable, setBackendAvailable] = useState(true);
  const [showRewardPop, setShowRewardPop] = useState(false);
  const previousContributionsRef = useRef(0);

  // Calculate session contributions
  const calculateSessionContributions = () => {
    let total = 0;
    for (const exercise of challenge.enabledExercises) {
      const reward = challenge.repReward[exercise];
      if (reward) {
        total += Math.floor(sessionReps[exercise] / reward.perReps) * reward.amount;
      }
    }
    return total;
  };

  // Calculate community total reps for an exercise
  const getCommunityReps = (exercise: ExerciseType) => {
    return Object.values(challenge.userContributions).reduce(
      (sum, userReps) => sum + (userReps[exercise] || 0), 0
    );
  };

  // Calculate community total contributions
  const getCommunityContributions = () => {
    let total = 0;
    for (const exercise of challenge.enabledExercises) {
      const communityReps = getCommunityReps(exercise);
      const reward = challenge.repReward[exercise];
      if (reward) {
        total += Math.floor(communityReps / reward.perReps) * reward.amount;
      }
    }
    return total;
  };

  // Calculate overall challenge progress per exercise
  const getExerciseProgress = (exercise: ExerciseType) => {
    const totalReps = getCommunityReps(exercise) + sessionReps[exercise];
    const goal = challenge.repGoal[exercise];
    return goal > 0 ? Math.min((totalReps / goal) * 100, 100) : 0;
  };

  // Handle exercise selection
  const handleExerciseSelect = async (exercise: ExerciseType) => {
    try {
      setSelectedExercise(exercise);
      await setTargetExercise(exercise);
      console.log(`[Exercise Select] Set target to: ${exercise}`);
      toast.success(`Now tracking: ${EXERCISE_LABELS[exercise]}`);
    } catch (error) {
      console.error('Failed to set target exercise:', error);
      toast.error('Failed to set exercise. Please try again.');
      setSelectedExercise(null);
    }
  };

  // Start camera
  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        setCameraActive(true);
      }
    } catch (error) {
      console.error('Camera access denied:', error);
      toast.error('Failed to access camera');
    }
  };

  // Stop camera
  const stopCamera = () => {
    if (videoRef.current?.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach(track => track.stop());
      videoRef.current.srcObject = null;
      setCameraActive(false);
    }
  };

  // Reset backend counter and set default exercise on mount
  useEffect(() => {
    const initialize = async () => {
      // Reset backend rep counter
      try {
        console.log('[Init] Resetting backend rep counter...');
        await getRepCounts(); // This fetches and resets the counter
        console.log('[Init] Backend rep counter reset');
      } catch (error) {
        console.error('[Init] Failed to reset rep counter:', error);
      }

      // Check backend availability
      const available = await checkBackendAvailability();
      setBackendAvailable(available);

      // Set default exercise to first enabled exercise
      if (challenge.enabledExercises.length > 0) {
        const defaultExercise = challenge.enabledExercises[0];
        console.log(`[Init] Setting default exercise to: ${defaultExercise}`);

        try {
          setSelectedExercise(defaultExercise);
          await setTargetExercise(defaultExercise);
          console.log(`[Init] Successfully set target to: ${defaultExercise}`);
          toast.success(`Tracking: ${EXERCISE_LABELS[defaultExercise]}`);
        } catch (error) {
          console.error('[Init] Failed to set default exercise:', error);
        }
      }
    };

    initialize();

    // Recheck backend availability every 5 seconds
    const interval = setInterval(async () => {
      const available = await checkBackendAvailability();
      setBackendAvailable(available);
    }, 5000);

    return () => clearInterval(interval);
  }, [challenge.enabledExercises]);

  // Poll backend for real rep counts and send to MongoDB
  useEffect(() => {
    if (!cameraActive || !selectedExercise) return;

    const pollInterval = setInterval(async () => {
      try {
        const repCounts = await getRepCounts();
        console.log('[Polling] Received rep counts:', repCounts);

        // Build increments object for MongoDB
        const increments: Record<string, number> = {};
        let hasIncrements = false;

        // Process increments for all exercises
        Object.entries(repCounts).forEach(([exercise, count]) => {
          if (count > 0) {
            console.log(`[Polling] ${exercise}: received count = ${count}`);

            if (challenge.enabledExercises.includes(exercise as ExerciseType)) {
              // Add to increments for MongoDB
              increments[exercise] = count;
              hasIncrements = true;

              // Update session reps
              setSessionReps(prev => {
                const oldValue = prev[exercise] || 0;
                const newValue = oldValue + count;
                console.log(`[Polling] ${exercise}: ${oldValue} + ${count} = ${newValue}`);
                return {
                  ...prev,
                  [exercise]: newValue
                };
              });

              // Show animation feedback
              setPopExercise(exercise as ExerciseType);
              setTimeout(() => setPopExercise(null), 1000);
            }
          }
        });

        // Send increments to MongoDB if we have any
        if (hasIncrements) {
          try {
            await challengeAPI.incrementContributions(challenge.id, increments);
            console.log('[MongoDB] Successfully saved increments:', increments);
          } catch (error) {
            console.error('[MongoDB] Failed to save increments:', error);
            toast.error('Failed to save reps to challenge');
          }
        }
      } catch (error) {
        console.error('Failed to fetch rep counts:', error);
      }
    }, 500); // Poll every 500ms

    return () => clearInterval(pollInterval);
  }, [cameraActive, selectedExercise, challenge.enabledExercises, challenge.id]);

  // Watch for contribution increases and trigger pop-up (same pattern as rep counter)
  useEffect(() => {
    const currentContributions = calculateSessionContributions();

    if (previousContributionsRef.current > 0 && currentContributions > previousContributionsRef.current) {
      // Contribution increased! Show pop-up animation
      setShowRewardPop(true);
      setTimeout(() => setShowRewardPop(false), 1000);
    }

    previousContributionsRef.current = currentContributions;
  }, [sessionReps]);

  // Cleanup on unmount
  useEffect(() => {
    return () => stopCamera();
  }, []);

  const fetchLatestChallenge = async () => {
    try {
      const apiChallenge = await challengeAPI.getChallenge(challenge.id);

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

      if (onChallengeUpdate) {
        onChallengeUpdate(transformed);
      }
    } catch (error) {
      console.error('[Session Exit] Failed to fetch latest challenge data:', error);
    }
  };

  const handleEndSession = async () => {
    stopCamera();
    await fetchLatestChallenge();
    onEnd({
      reps: sessionReps,
      rewardsEarned: calculateSessionContributions(),
    });
  };

  const handleClose = async () => {
    stopCamera();
    await fetchLatestChallenge();
    onClose();
  };

  const sessionContributions = calculateSessionContributions();
  const communityContributions = getCommunityContributions();

  return (
    <div className="fixed inset-0 z-50 bg-background/95 backdrop-blur-sm overflow-y-auto">
      <div className="container mx-auto px-4 py-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="font-display text-2xl font-bold">{challenge.name}</h1>
            <p className="text-muted-foreground">Exercise Session</p>
          </div>
          <Button variant="ghost" size="icon" onClick={handleClose}>
            <X className="h-6 w-6" />
          </Button>
        </div>

        {/* Backend Unavailable Warning */}
        {!backendAvailable && (
          <Card className="border-destructive bg-destructive/10 mb-6">
            <CardContent className="pt-6">
              <div className="flex items-start gap-3">
                <AlertCircle className="h-5 w-5 text-destructive mt-0.5" />
                <div className="flex-1">
                  <p className="font-semibold text-destructive mb-1">Backend Unavailable</p>
                  <p className="text-sm text-muted-foreground">
                    Please ensure the motion detection script is running.
                  </p>
                  <p className="text-xs text-muted-foreground mt-2 font-mono">
                    Run: <code className="bg-muted px-1 py-0.5 rounded">python3 backend/script.py</code>
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Video Feed */}
          <div className="lg:col-span-2 space-y-4">
            <Card className="overflow-hidden">
              <CardContent className="p-0">
                <div className="relative aspect-video bg-muted">
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    className="w-full h-full object-cover"
                    style={{ transform: 'scaleX(-1)' }}
                  />
                  {!cameraActive && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-4">
                      <CameraOff className="h-16 w-16 text-muted-foreground" />
                      <p className="text-muted-foreground">Camera not active</p>
                      <Button variant="hero" onClick={startCamera} className="gap-2">
                        <Camera className="h-4 w-4" />
                        Start Camera
                      </Button>
                    </div>
                  )}

                  {/* Live Stats Overlay */}
                  {cameraActive && selectedExercise && (
                    <div className="absolute top-4 left-4 right-4 flex justify-between">
                      <Badge className="bg-green-500 text-white text-lg px-4 py-2 gap-2">
                        <Check className="h-4 w-4" />
                        {EXERCISE_LABELS[selectedExercise]}
                      </Badge>
                      <Badge className="bg-destructive text-destructive-foreground text-lg px-4 py-2">
                        <Zap className="h-4 w-4 mr-1" />
                        LIVE
                      </Badge>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Exercise Selection - Horizontal Buttons */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">Select Exercise</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex justify-center gap-2">
                  {challenge.enabledExercises.map((exercise) => (
                    <button
                      key={exercise}
                      onClick={() => handleExerciseSelect(exercise)}
                      disabled={!backendAvailable}
                      className={`px-4 py-2 rounded-lg border-2 transition-all ${
                        selectedExercise === exercise
                          ? 'bg-green-500 border-green-600 text-white'
                          : 'bg-background border-border hover:border-green-400 disabled:opacity-50 disabled:cursor-not-allowed'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-xl">{EXERCISE_ICONS[exercise]}</span>
                        <span className="font-semibold text-sm">
                          {EXERCISE_LABELS[exercise]}
                        </span>
                        {selectedExercise === exercise && (
                          <Check className="h-4 w-4" />
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Camera Controls */}
            <div className="flex justify-center gap-4">
              {cameraActive ? (
                <>
                  <Button variant="outline" onClick={stopCamera}>
                    <CameraOff className="h-4 w-4 mr-2" />
                    Stop Camera
                  </Button>
                  <Button variant="hero" size="lg" onClick={handleEndSession}>
                    End Session & Save
                  </Button>
                </>
              ) : (
                <Button variant="hero" size="lg" onClick={startCamera}>
                  <Camera className="h-4 w-4 mr-2" />
                  Start Exercising
                </Button>
              )}
            </div>
          </div>

          {/* Session Stats */}
          <div className="space-y-4">
            {/* Session Stats Card */}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">Session Stats</CardTitle>
                  <Badge variant="outline" className="bg-primary/10">This Session</Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Session Reps */}
                {challenge.enabledExercises.map((exercise) => (
                  <div
                    key={exercise}
                    className={`p-3 rounded-lg bg-muted transition-all duration-300 ${
                      popExercise === exercise ? 'animate-counter-pop scale-105 bg-primary/20' : ''
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-xl">{EXERCISE_ICONS[exercise]}</span>
                        <span className="font-medium text-sm">{EXERCISE_LABELS[exercise]}</span>
                      </div>
                      <span className="font-display text-2xl font-bold text-primary">
                        {sessionReps[exercise]}
                      </span>
                    </div>
                  </div>
                ))}

                {/* Session Contribution */}
                <div className="pt-3 border-t">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Session Contribution</span>
                    <span
                      className={`font-display text-xl font-bold text-gradient transition-all duration-300 ${
                        showRewardPop ? 'animate-counter-pop scale-125' : ''
                      }`}
                    >
                      {sessionContributions} {challenge.repRewardType}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Community Stats Card */}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">Community Total</CardTitle>
                  <Badge variant="outline">All Time</Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Community Reps */}
                {challenge.enabledExercises.map((exercise) => {
                  const communityReps = getCommunityReps(exercise);
                  const totalWithSession = communityReps + sessionReps[exercise];

                  return (
                    <div key={exercise} className="space-y-1">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-xl">{EXERCISE_ICONS[exercise]}</span>
                          <span className="font-medium text-sm">{EXERCISE_LABELS[exercise]}</span>
                        </div>
                        <div className="text-right">
                          <div className="font-display text-xl font-bold">
                            {totalWithSession}
                          </div>
                          {sessionReps[exercise] > 0 && (
                            <div className="text-xs text-green-600">
                              +{sessionReps[exercise]} this session
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}

                {/* Community Contribution */}
                <div className="pt-3 border-t">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Total Contribution</span>
                    <div className="text-right">
                      <div
                        className={`font-display text-xl font-bold text-gradient transition-all duration-300 ${
                          showRewardPop ? 'animate-counter-pop scale-125' : ''
                        }`}
                      >
                        {communityContributions + sessionContributions}
                      </div>
                      {sessionContributions > 0 && (
                        <div className="text-xs text-green-600">
                          +{sessionContributions} this session
                        </div>
                      )}
                      <div className="text-xs text-muted-foreground">
                        {challenge.repRewardType}
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Challenge Progress */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">Challenge Progress</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {challenge.enabledExercises.map((exercise) => {
                  const progress = getExerciseProgress(exercise);
                  const goal = challenge.repGoal[exercise];
                  const current = getCommunityReps(exercise) + sessionReps[exercise];

                  return (
                    <div key={exercise}>
                      <div className="flex items-center justify-between text-sm mb-1">
                        <span className="text-muted-foreground">{EXERCISE_LABELS[exercise]}</span>
                        <span className="font-medium">{current} / {goal}</span>
                      </div>
                      <Progress value={progress} className="h-2" />
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
