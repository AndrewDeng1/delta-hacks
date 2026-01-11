import { useState, useEffect, useRef } from 'react';
import { Navbar } from '@/components/Navbar';
import { ChatMessage } from '@/components/ChatMessage';
import { ChatInput } from '@/components/ChatInput';
import { MedicalInfoDialog } from '@/components/MedicalInfoDialog';
import { CoachSettingsDialog } from '@/components/CoachSettingsDialog';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { coachAPI } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Settings, Trash2, Bot, User } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { Navigate } from 'react-router-dom';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

const WELCOME_MESSAGE: Message = {
  role: 'assistant',
  content: `Hey! I'm your Motion4Good coach 💪

I can help you find challenges, give workout tips, check your form, and answer any fitness questions you got.

What's up?`,
  timestamp: new Date(),
};

// Helper function to convert base64 to Blob for audio playback
function base64ToBlob(base64: string, mimeType: string): Blob {
  const byteCharacters = atob(base64);
  const byteNumbers = new Array(byteCharacters.length);
  for (let i = 0; i < byteCharacters.length; i++) {
    byteNumbers[i] = byteCharacters.charCodeAt(i);
  }
  const byteArray = new Uint8Array(byteNumbers);
  return new Blob([byteArray], { type: mimeType });
}

export default function Consultant() {
  const { user, isAuthenticated } = useAuth();
  const { toast } = useToast();
  const [messages, setMessages] = useState<Message[]>([WELCOME_MESSAGE]);
  const [loading, setLoading] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [medicalInfoOpen, setMedicalInfoOpen] = useState(false);
  const [coachSettingsOpen, setCoachSettingsOpen] = useState(false);
  const [clearHistoryOpen, setClearHistoryOpen] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    document.title = 'Coach | Motion4Good';
    loadHistory();
  }, []);

  useEffect(() => {
    // Scroll to bottom when new messages arrive
    if (scrollRef.current) {
      scrollRef.current.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }
  }, [messages]);

  const loadHistory = async () => {
    try {
      const data = await coachAPI.getHistory();
      if (data.messages && data.messages.length > 0) {
        // Clean up any messages with leading/trailing newlines and convert timestamp
        const cleanedMessages: Message[] = data.messages.map(msg => ({
          role: msg.role as 'user' | 'assistant',
          content: msg.content?.trim() || '',
          timestamp: new Date(msg.timestamp),
        }));
        setMessages([WELCOME_MESSAGE, ...cleanedMessages]);
      }
    } catch (error) {
      console.error('Failed to load history:', error);
    } finally {
      setLoadingHistory(false);
    }
  };

  const handleSend = async (message: string, retryCount = 0) => {
    // Add user message immediately (only on first try)
    if (retryCount === 0) {
      const userMessage: Message = {
        role: 'user',
        content: message,
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, userMessage]);
    }
    setLoading(true);

    try {
      const response = await coachAPI.sendMessage(message);

      // Trim leading/trailing newlines from response
      let cleanedContent = response.response?.trim() || '';

      // If content is empty or null, retry up to 2 times
      if (!cleanedContent && retryCount < 2) {
        console.log(`Retrying coach message (attempt ${retryCount + 1})...`);
        return handleSend(message, retryCount + 1);
      }

      // If still no content after retries, show error message
      if (!cleanedContent) {
        cleanedContent = "I'm having trouble responding right now. Please try again.";
      }

      const assistantMessage: Message = {
        role: 'assistant',
        content: cleanedContent,
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, assistantMessage]);

      // Play audio if available
      if (response.audio) {
        try {
          const audioBlob = base64ToBlob(response.audio, 'audio/mpeg');
          const audioUrl = URL.createObjectURL(audioBlob);
          const audio = new Audio(audioUrl);
          audio.play();

          // Clean up after playing
          audio.onended = () => URL.revokeObjectURL(audioUrl);
        } catch (error) {
          console.error('Failed to play audio:', error);
        }
      }

      if (response.context_used) {
        toast({
          title: 'Context used',
          description: 'Response personalized using your information',
        });
      }
    } catch (error: any) {
      toast({
        title: 'Failed to send message',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleClearHistory = () => {
    setClearHistoryOpen(true);
  };

  const confirmClearHistory = async () => {
    try {
      await coachAPI.clearHistory();
      setMessages([WELCOME_MESSAGE]);
      setClearHistoryOpen(false);
      toast({
        title: 'History cleared',
        description: 'Your chat history has been cleared',
      });
    } catch (error: any) {
      toast({
        title: 'Failed to clear history',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  if (!isAuthenticated || !user) {
    return <Navigate to="/signin" replace />;
  }

  if (loadingHistory) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <main className="container mx-auto px-4 py-8">
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      <main className="container mx-auto px-4 py-6 h-[calc(100vh-80px)] max-w-4xl">
        <Card className="h-full flex flex-col shadow-lg">
          <CardHeader className="flex-row items-center justify-between space-y-0 pb-4 border-b">
            <CardTitle className="flex items-center gap-3 text-xl">
              <Bot className="h-6 w-6 text-primary" />
              Coach
            </CardTitle>
            <div className="flex gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setCoachSettingsOpen(true)}
                title="Coach Settings"
              >
                <Settings className="h-5 w-5" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setMedicalInfoOpen(true)}
                title="Fitness Information"
              >
                <User className="h-5 w-5" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleClearHistory}
                title="Clear Chat History"
              >
                <Trash2 className="h-5 w-5" />
              </Button>
            </div>
          </CardHeader>

          <CardContent className="flex-1 flex flex-col gap-4 min-h-0 p-6">
            <ScrollArea className="flex-1">
              <div className="pb-4 px-2">
                {messages.map((msg, i) => (
                  <ChatMessage
                    key={i}
                    role={msg.role}
                    content={msg.content}
                    timestamp={msg.timestamp}
                  />
                ))}
                {loading && (
                  <div className="flex gap-3 mb-4">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary">
                      <Bot className="h-5 w-5 text-primary-foreground" />
                    </div>
                    <div className="flex items-center gap-2 px-5 py-3 bg-muted rounded-2xl rounded-tl-sm">
                      <Loader2 className="h-5 w-5 animate-spin" />
                      <span className="text-base text-muted-foreground">Typing...</span>
                    </div>
                  </div>
                )}
                <div ref={scrollRef} />
              </div>
            </ScrollArea>

            <div className="pt-2">
              <ChatInput onSend={handleSend} disabled={loading} />
            </div>
          </CardContent>
        </Card>
      </main>

      <CoachSettingsDialog open={coachSettingsOpen} onOpenChange={setCoachSettingsOpen} />
      <MedicalInfoDialog open={medicalInfoOpen} onOpenChange={setMedicalInfoOpen} />

      <AlertDialog open={clearHistoryOpen} onOpenChange={setClearHistoryOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Clear all chat history?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete all your conversations with the coach. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmClearHistory}>Clear History</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
