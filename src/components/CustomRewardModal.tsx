import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Sparkles } from 'lucide-react';

interface CustomRewardModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (rewardType: string, label: string) => void;
}

export function CustomRewardModal({ open, onOpenChange, onSave }: CustomRewardModalProps) {
  const [customType, setCustomType] = useState('');

  const handleSave = () => {
    if (customType.trim()) {
      onSave('custom', customType.trim());
      setCustomType('');
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Custom Contribution Type
          </DialogTitle>
          <DialogDescription>
            Create a custom contribution type for your challenge. This will appear to users as they exercise.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="customType">Contribution Name</Label>
            <Input
              id="customType"
              placeholder="e.g., meals donated, books provided, vaccines funded"
              value={customType}
              onChange={(e) => setCustomType(e.target.value)}
            />
          </div>

          {/* Preview */}
          {customType && (
            <div className="p-4 rounded-lg bg-muted border">
              <p className="text-sm text-muted-foreground mb-2">Preview:</p>
              <p className="font-display text-2xl font-bold text-primary">
                123 <span className="text-foreground">{customType}</span>
              </p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={!customType.trim()}>
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
