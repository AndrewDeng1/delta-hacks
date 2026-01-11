import { useState, useEffect, useRef } from 'react';
import { Challenge, ExerciseType, EXERCISE_LABELS, EXERCISE_ICONS, SessionStats } from '@/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Camera, CameraOff, Trophy, Zap, X } from 'lucide-react';

interface ExerciseSessionProps {
  challenge: Challenge;
  onEnd: (stats: SessionStats) => void;
  onClose: () => void;
}

export function ExerciseSession({ challenge, onEnd, onClose }: ExerciseSessionProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [cameraActive, setCameraActive] = useState(false);
  const [sessionReps, setSessionReps] = useState<Record<ExerciseType, number>>({
    jumping_jacks: 0,
    squats: 0,
    high_knees: 0,
  });
  const [popExercise, setPopExercise] = useState<ExerciseType | null>(null);

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

  // Calculate overall challenge progress per exercise
  const getExerciseProgress = (exercise: ExerciseType) => {
    const totalReps = Object.values(challenge.userContributions).reduce(
      (sum, userReps) => sum + (userReps[exercise] || 0), 0
    ) + sessionReps[exercise];
    const goal = challenge.repGoal[exercise];
    return goal > 0 ? Math.min((totalReps / goal) * 100, 100) : 0;
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

  // Simulate exercise detection (in production, this would come from backend)
  useEffect(() => {
    if (!cameraActive) return;

    const interval = setInterval(() => {
      const exerciseIndex = Math.floor(Math.random() * challenge.enabledExercises.length);
      const exercise = challenge.enabledExercises[exerciseIndex];
      
      setSessionReps(prev => ({
        ...prev,
        [exercise]: prev[exercise] + 1,
      }));
      
      setPopExercise(exercise);
      setTimeout(() => setPopExercise(null), 300);
    }, 1500);

    return () => clearInterval(interval);
  }, [cameraActive, challenge.enabledExercises]);

  // Cleanup on unmount
  useEffect(() => {
    return () => stopCamera();
  }, []);

  const handleEndSession = () => {
    stopCamera();
    onEnd({
      reps: sessionReps,
      rewardsEarned: calculateSessionContributions(),
    });
  };

  const sessionContributions = calculateSessionContributions();

  return (
    <div className="fixed inset-0 z-50 bg-background/95 backdrop-blur-sm overflow-y-auto">
      <div className="container mx-auto px-4 py-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="font-display text-2xl font-bold">{challenge.name}</h1>
            <p className="text-muted-foreground">Exercise Session</p>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-6 w-6" />
          </Button>
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Video Feed */}
          <div className="lg:col-span-2">
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
                  {cameraActive && (
                    <div className="absolute top-4 left-4 right-4 flex justify-between">
                      <Badge className="gradient-energy text-energy-foreground text-lg px-4 py-2 gap-2">
                        <Trophy className="h-4 w-4" />
                        {sessionContributions} {challenge.repRewardType}
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

            {/* Camera Controls */}
            <div className="flex justify-center gap-4 mt-4">
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
            {/* Session Reps */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">Session Reps</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {challenge.enabledExercises.map((exercise) => (
                  <div 
                    key={exercise}
                    className={`p-4 rounded-lg bg-muted transition-all duration-300 ${
                      popExercise === exercise ? 'animate-counter-pop scale-105 bg-primary/20' : ''
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-2xl">{EXERCISE_ICONS[exercise]}</span>
                        <span className="font-medium">{EXERCISE_LABELS[exercise]}</span>
                      </div>
                      <span className="font-display text-3xl font-bold text-primary">
                        {sessionReps[exercise]}
                      </span>
                    </div>
                  </div>
                ))}
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
                  const current = Object.values(challenge.userContributions).reduce(
                    (sum, userReps) => sum + (userReps[exercise] || 0), 0
                  ) + sessionReps[exercise];

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

            {/* Contribution Info */}
            <Card className="gradient-card border-primary/20">
              <CardContent className="pt-6">
                <div className="text-center">
                  <Trophy className="h-8 w-8 mx-auto text-primary mb-2" />
                  <p className="text-sm text-muted-foreground mb-1">Session Contribution</p>
                  <p className="font-display text-4xl font-bold text-gradient">
                    {sessionContributions}
                  </p>
                  <p className="text-lg text-muted-foreground">{challenge.repRewardType}</p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
