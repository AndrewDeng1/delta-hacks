import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Send } from 'lucide-react';

interface ChatInputProps {
  onSend: (message: string) => void;
  disabled?: boolean;
}

export function ChatInput({ onSend, disabled }: ChatInputProps) {
  const [message, setMessage] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (message.trim() && !disabled) {
      onSend(message);
      setMessage('');
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex gap-3 items-end">
      <Textarea
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        placeholder="Message your coach..."
        disabled={disabled}
        className="min-h-[56px] max-h-[120px] resize-none text-base rounded-2xl px-5 py-4 border-2 focus:border-primary"
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSubmit(e);
          }
        }}
      />
      <Button
        type="submit"
        disabled={disabled || !message.trim()}
        size="icon"
        className="h-[56px] w-[56px] rounded-full shrink-0"
      >
        <Send className="h-5 w-5" />
      </Button>
    </form>
  );
}
