import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { coachAPI } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';

interface CoachSettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CoachSettingsDialog({ open, onOpenChange }: CoachSettingsDialogProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    tonePreference: 'casual',
    responseLength: 'short',
    motivationLevel: 'moderate',
    focusAreas: [] as string[],
    notificationPreference: 'daily',
  });

  const focusAreaOptions = [
    'Strength Training',
    'Cardio',
    'Flexibility',
    'Weight Loss',
    'Muscle Building',
    'Endurance',
    'Form & Technique',
    'Nutrition',
  ];

  useEffect(() => {
    if (open) {
      loadCoachSettings();
    }
  }, [open]);

  const loadCoachSettings = async () => {
    setLoading(true);
    try {
      const data = await coachAPI.getCoachSettings();
      setFormData(data);
    } catch (error: any) {
      toast({
        title: 'Failed to load settings',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await coachAPI.updateCoachSettings(formData);
      toast({
        title: 'Settings saved',
        description: 'Your coach preferences have been updated',
      });
      onOpenChange(false);
    } catch (error: any) {
      toast({
        title: 'Failed to save',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const toggleFocusArea = (area: string) => {
    setFormData(prev => ({
      ...prev,
      focusAreas: prev.focusAreas.includes(area)
        ? prev.focusAreas.filter(a => a !== area)
        : [...prev.focusAreas, area]
    }));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Coach Settings</DialogTitle>
          <DialogDescription>
            Customize how your coach communicates with you.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : (
          <div className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="tonePreference">Tone</Label>
              <Select
                value={formData.tonePreference}
                onValueChange={(value) => setFormData({ ...formData, tonePreference: value })}
              >
                <SelectTrigger id="tonePreference">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="casual">Casual & Encouraging</SelectItem>
                  <SelectItem value="friendly">Friendly & Warm</SelectItem>
                  <SelectItem value="motivational">Motivational & Energetic</SelectItem>
                  <SelectItem value="professional">Professional & Formal</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="responseLength">Response Length</Label>
              <Select
                value={formData.responseLength}
                onValueChange={(value) => setFormData({ ...formData, responseLength: value })}
              >
                <SelectTrigger id="responseLength">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="very_short">Very Short (1 sentence)</SelectItem>
                  <SelectItem value="short">Short (1-2 sentences)</SelectItem>
                  <SelectItem value="medium">Medium (2-3 sentences)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="motivationLevel">Motivation Level</Label>
              <Select
                value={formData.motivationLevel}
                onValueChange={(value) => setFormData({ ...formData, motivationLevel: value })}
              >
                <SelectTrigger id="motivationLevel">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low (Gentle & Supportive)</SelectItem>
                  <SelectItem value="moderate">Moderate (Balanced)</SelectItem>
                  <SelectItem value="high">High (Very Enthusiastic)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Focus Areas</Label>
              <p className="text-sm text-muted-foreground mb-3">
                Select areas you want to focus on:
              </p>
              <div className="grid grid-cols-2 gap-3">
                {focusAreaOptions.map((area) => (
                  <div key={area} className="flex items-center space-x-2">
                    <Checkbox
                      id={area}
                      checked={formData.focusAreas.includes(area)}
                      onCheckedChange={() => toggleFocusArea(area)}
                    />
                    <label
                      htmlFor={area}
                      className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                    >
                      {area}
                    </label>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-4">
              <Button
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={saving}
              >
                Cancel
              </Button>
              <Button
                onClick={handleSave}
                disabled={saving}
              >
                {saving ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  'Save'
                )}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
