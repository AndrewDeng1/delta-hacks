import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { coachAPI } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';

interface MedicalInfoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function MedicalInfoDialog({ open, onOpenChange }: MedicalInfoDialogProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    goals: '',
    medicalHistory: '',
    physicalStatus: '',
    concerns: '',
    dietaryRestrictions: '',
  });

  useEffect(() => {
    if (open) {
      loadMedicalInfo();
    }
  }, [open]);

  const loadMedicalInfo = async () => {
    setLoading(true);
    try {
      const data = await coachAPI.getMedicalInfo();
      setFormData(data);
    } catch (error: any) {
      toast({
        title: 'Failed to load information',
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
      await coachAPI.updateMedicalInfo(formData);
      toast({
        title: 'Information saved',
        description: 'Your fitness information has been updated',
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Fitness Information</DialogTitle>
          <DialogDescription>
            Share your fitness goals and information to get personalized recommendations from your coach.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="goals">Fitness Goals</Label>
              <Textarea
                id="goals"
                placeholder="What are your fitness goals? (e.g., build muscle, lose weight, improve endurance)"
                value={formData.goals}
                onChange={(e) => setFormData({ ...formData, goals: e.target.value })}
                rows={3}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="physicalStatus">Physical Status</Label>
              <Textarea
                id="physicalStatus"
                placeholder="Current fitness level and activity (e.g., beginner, active 3x/week)"
                value={formData.physicalStatus}
                onChange={(e) => setFormData({ ...formData, physicalStatus: e.target.value })}
                rows={3}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="medicalHistory">Medical History</Label>
              <Textarea
                id="medicalHistory"
                placeholder="Any relevant medical conditions or history (optional)"
                value={formData.medicalHistory}
                onChange={(e) => setFormData({ ...formData, medicalHistory: e.target.value })}
                rows={3}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="concerns">Concerns or Limitations</Label>
              <Textarea
                id="concerns"
                placeholder="Any injuries, pain areas, or physical limitations (optional)"
                value={formData.concerns}
                onChange={(e) => setFormData({ ...formData, concerns: e.target.value })}
                rows={3}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="dietaryRestrictions">Dietary Restrictions</Label>
              <Textarea
                id="dietaryRestrictions"
                placeholder="Any dietary restrictions or preferences (optional)"
                value={formData.dietaryRestrictions}
                onChange={(e) => setFormData({ ...formData, dietaryRestrictions: e.target.value })}
                rows={2}
              />
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
