import { Bot, User } from 'lucide-react';

interface ChatMessageProps {
  role: 'user' | 'assistant';
  content: string | null | undefined;
  timestamp?: Date | string;
}

function parseMarkdown(text: string | null | undefined) {
  // Handle null or undefined text
  if (!text) return null;

  // Split by newlines to preserve line breaks
  const lines = text.split('\n');

  return lines.map((line, lineIndex) => {
    const parts: React.ReactNode[] = [];
    let currentIndex = 0;

    // Regex to match **bold** and URLs
    const regex = /(\*\*.*?\*\*|https?:\/\/[^\s]+)/g;
    let match;

    while ((match = regex.exec(line)) !== null) {
      // Add text before match
      if (match.index > currentIndex) {
        parts.push(line.substring(currentIndex, match.index));
      }

      const matchedText = match[0];

      // Check if it's bold text
      if (matchedText.startsWith('**') && matchedText.endsWith('**')) {
        const boldText = matchedText.slice(2, -2);
        parts.push(<strong key={`bold-${lineIndex}-${match.index}`}>{boldText}</strong>);
      }
      // Check if it's a URL
      else if (matchedText.startsWith('http')) {
        parts.push(
          <a
            key={`link-${lineIndex}-${match.index}`}
            href={matchedText}
            target="_blank"
            rel="noopener noreferrer"
            className="underline hover:text-primary transition-colors"
          >
            {matchedText}
          </a>
        );
      }

      currentIndex = match.index + matchedText.length;
    }

    // Add remaining text
    if (currentIndex < line.length) {
      parts.push(line.substring(currentIndex));
    }

    return (
      <span key={lineIndex}>
        {parts.length > 0 ? parts : line}
        {lineIndex < lines.length - 1 && <br />}
      </span>
    );
  });
}

export function ChatMessage({ role, content, timestamp }: ChatMessageProps) {
  const isAssistant = role === 'assistant';

  return (
    <div className={`flex gap-3 ${isAssistant ? '' : 'flex-row-reverse'} mb-4`}>
      <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${
        isAssistant ? 'bg-primary' : 'bg-secondary'
      }`}>
        {isAssistant ? <Bot className="h-5 w-5 text-primary-foreground" /> : <User className="h-5 w-5 text-secondary-foreground" />}
      </div>

      <div className={`flex flex-col gap-1.5 max-w-[75%]`}>
        <div className={`rounded-2xl px-5 py-3 ${
          isAssistant
            ? 'bg-muted text-foreground rounded-tl-sm'
            : 'bg-primary text-primary-foreground rounded-tr-sm'
        }`}>
          <div className="text-base leading-relaxed">
            {content ? parseMarkdown(content) : <span className="text-muted-foreground italic">No content</span>}
          </div>
        </div>
        {timestamp && (
          <span className={`text-xs text-muted-foreground ${isAssistant ? 'px-2' : 'text-right px-2'}`}>
            {new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </span>
        )}
      </div>
    </div>
  );
}
