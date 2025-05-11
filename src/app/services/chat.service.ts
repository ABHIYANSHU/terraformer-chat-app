import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { ChatMessage } from '../models/chat-message';

@Injectable({
  providedIn: 'root'
})
export class ChatService {
  private messages = new BehaviorSubject<ChatMessage[]>([]);
  
  constructor() {
    // Initialize with a welcome message
    this.addMessage({
      id: this.generateId(),
      content: 'Hello! How can I help you today?',
      sender: 'assistant',
      timestamp: new Date()
    });
  }

  getMessages(): Observable<ChatMessage[]> {
    return this.messages.asObservable();
  }

  addMessage(message: ChatMessage): void {
    const currentMessages = this.messages.getValue();
    this.messages.next([...currentMessages, message]);
  }

  sendMessage(content: string): void {
    // Add user message
    this.addMessage({
      id: this.generateId(),
      content,
      sender: 'user',
      timestamp: new Date()
    });

    // In a real app, you would call an API here
    // For now, we'll just simulate a response after a delay
    setTimeout(() => {
      this.addMessage({
        id: this.generateId(),
        content: 'This is a simulated response. In a real application, this would come from your backend API.',
        sender: 'assistant',
        timestamp: new Date()
      });
    }, 1000);
  }

  // Helper method to detect code blocks in messages
  detectCodeBlock(content: string): { isCode: boolean, language: string, content: string } {
    const codeBlockRegex = /```([a-z]*)\n([\s\S]*?)```/g;
    const match = codeBlockRegex.exec(content);
    
    if (match) {
      return {
        isCode: true,
        language: match[1] || 'plaintext',
        content: match[2]
      };
    }
    
    return {
      isCode: false,
      language: '',
      content
    };
  }

  private generateId(): string {
    return Math.random().toString(36).substring(2, 15);
  }
}