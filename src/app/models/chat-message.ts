export interface ChatMessage {
  id: string;
  content: string;
  sender: 'user' | 'assistant';
  timestamp: Date;
  isCode?: boolean;
  language?: string;
  fileName?: string;
  isLoading?: boolean;
}