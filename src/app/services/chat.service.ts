import { Injectable, OnDestroy } from '@angular/core';
import { BehaviorSubject, Observable, Subscription } from 'rxjs';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { ChatMessage } from '../models/chat-message';
import { ChatSession } from '../models/chat-session';
import { environment } from '../../environments/environment';
import { SocketService } from './socket.service';
import { TerraformOutput, TerraformStatus } from '../models/terraform-output';

@Injectable({
  providedIn: 'root'
})
export class ChatService implements OnDestroy {
  private messages = new BehaviorSubject<ChatMessage[]>([]);
  private chatSessions = new BehaviorSubject<ChatSession[]>([]);
  private currentSessionId = new BehaviorSubject<string>('');
  
  private apiUrl = environment.apiUrl;
  private terraformApplyUrl = environment.terraformApplyUrl;
  private terraformOutputSubscription: Subscription;
  private terraformStatusSubscription: Subscription;
  
  constructor(
    private http: HttpClient,
    private socketService: SocketService
  ) {
    // Load saved sessions from localStorage or create a new one if none exist
    this.loadSavedSessions();
    
    // Subscribe to terraform output events
    this.terraformOutputSubscription = this.socketService.getTerraformOutput().subscribe(
      (output: TerraformOutput) => {
        this.handleTerraformOutput(output);
      }
    );
    
    // Subscribe to terraform status events
    this.terraformStatusSubscription = this.socketService.getTerraformStatus().subscribe(
      (status: TerraformStatus) => {
        this.handleTerraformStatus(status);
      }
    );
  }

  ngOnDestroy(): void {
    // Clean up subscriptions when the service is destroyed
    if (this.terraformOutputSubscription) {
      this.terraformOutputSubscription.unsubscribe();
    }
    
    if (this.terraformStatusSubscription) {
      this.terraformStatusSubscription.unsubscribe();
    }
  }

  getMessages(): Observable<ChatMessage[]> {
    return this.messages.asObservable();
  }
  
  getChatSessions(): Observable<ChatSession[]> {
    return this.chatSessions.asObservable();
  }
  
  getCurrentSessionId(): Observable<string> {
    return this.currentSessionId.asObservable();
  }

  addMessage(message: ChatMessage): void {
    // Add message to current messages
    const currentMessages = this.messages.getValue();
    this.messages.next([...currentMessages, message]);
    
    // Also update the message in the current chat session
    const sessionId = this.currentSessionId.getValue();
    if (sessionId) {
      this.updateSessionMessages(sessionId, [...currentMessages, message]);
    }
  }
  
  // Method to remove a message by ID
  removeMessage(messageId: string): void {
    const currentMessages = this.messages.getValue();
    const updatedMessages = currentMessages.filter(msg => msg.id !== messageId);
    this.messages.next(updatedMessages);
    
    // Also update the messages in the current chat session
    const sessionId = this.currentSessionId.getValue();
    if (sessionId) {
      this.updateSessionMessages(sessionId, updatedMessages);
    }
  }
  
  // Method to update a message by ID
  updateMessage(messageId: string, updatedMessage: Partial<ChatMessage>): void {
    const currentMessages = this.messages.getValue();
    const messageIndex = currentMessages.findIndex(msg => msg.id === messageId);
    
    if (messageIndex !== -1) {
      const updatedMessages = [...currentMessages];
      updatedMessages[messageIndex] = {
        ...updatedMessages[messageIndex],
        ...updatedMessage
      };
      
      this.messages.next(updatedMessages);
      
      // Also update the message in the current chat session
      const sessionId = this.currentSessionId.getValue();
      if (sessionId) {
        this.updateSessionMessages(sessionId, updatedMessages);
      }
    }
  }
  
  private updateSessionMessages(sessionId: string, messages: ChatMessage[]): void {
    const sessions = this.chatSessions.getValue();
    const sessionIndex = sessions.findIndex(s => s.id === sessionId);
    
    if (sessionIndex !== -1) {
      const updatedSession = {
        ...sessions[sessionIndex],
        messages,
        updatedAt: new Date()
      };
      
      const updatedSessions = [...sessions];
      updatedSessions[sessionIndex] = updatedSession;
      
      this.chatSessions.next(updatedSessions);
      this.saveSessions(updatedSessions);
    }
  }

  sendMessage(content: string): void {
    // Add user message
    this.addMessage({
      id: this.generateId(),
      content,
      sender: 'user',
      timestamp: new Date()
    });

    // Create a loading message with a placeholder
    const loadingMessageId = this.generateId();
    this.addMessage({
      id: loadingMessageId,
      content: 'Thinking...',
      sender: 'assistant',
      timestamp: new Date(),
      isLoading: true
    });

    // Set up headers for the API request
    const headers = new HttpHeaders({
      'Content-Type': 'application/json'
    });

    if ((content.includes("aws") || content.includes("AWS")) && (content.includes("deploy") || content.includes("Deploy") || content.includes("Deploying") || content.includes("deploying"))) {
      content = content + "Please provide step by step guide with full terraform script. region should be us-east-1, do not attach or use any aws key pair, use ami-0f88e80871fd81e91 as ami & t2.medium instance type. Also add access key and secret key in the provider component & two empty variables for them in the script, so that user can later pass them in the command line. Remember to check if any important resource creation is missing which is extremely important. Always create and attach the security group to ec2 which allows all inbound and outbound traffic. Always use yum for package installation. When provising an angular app always install angular cli & use this 'ng serve --host 0.0.0.0 --port 4200' to deploy on port 4200. Provide the complete terraform code in a single tf file. Show the output public ec2 instance ip address in the output section of the script.";
    }

    if ((content.includes("load balancer") || content.includes("load-balancer")) && (content.includes("auto-scalling") || content.includes("auto scalling"))) {
      content = content + "Also output the load balancer url";
    }
    
    if ((content.includes("angular") || content.includes("Angular"))) {
      content = content + "remember to use node version 22";
    }

    // Prepare the request body
    const body = {
      prompt: content
    };

    // Get current session
    const sessionId = this.currentSessionId.getValue();
    const sessions = this.chatSessions.getValue();
    const currentSession = sessions.find(s => s.id === sessionId);

    // Make the API request
    this.http.post(this.apiUrl, body, { headers }).subscribe({
      next: (response: any) => {
        // Handle successful response
        console.log('API Response:', response);
        
        // Remove the loading message
        this.removeMessage(loadingMessageId);
        
        // Add the assistant's message from the API response
        this.addMessage({
          id: this.generateId(),
          content: response.message,
          sender: 'assistant',
          timestamp: new Date()
        });

        // Check if we need to trigger terraform apply
        this.checkAndTriggerTerraformApply(content, response.message);

        // Update session title if it's the first user message
        // We need to count the real messages (excluding loading messages)
        // and check if this is the first user message in the conversation
        const realMessages = currentSession?.messages.filter(msg => !msg.isLoading) || [];
        const userMessages = realMessages.filter(msg => msg.sender === 'user');
        if (userMessages.length === 1) {
          this.updateSessionTitle(sessionId, this.generateSessionTitle(content));
        }
      },
      error: (error) => {
        // Handle error
        console.error('API Error:', error);
        
        // Remove the loading message
        this.removeMessage(loadingMessageId);
        
        // Add an error message
        this.addMessage({
          id: this.generateId(),
          content: 'Sorry, there was an error processing your request. Please try again later.',
          sender: 'assistant',
          timestamp: new Date()
        });
      }
    });
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
  
  // Check if we need to trigger terraform apply
  private checkAndTriggerTerraformApply(userMessage: string, assistantResponse: string): void {
    // Check if the message contains a code block or if it contains both "deploy" and "terraform"
    const hasCodeBlock = assistantResponse.includes('```');
    const hasTerraformDeploy = 
      (userMessage.toLowerCase().includes('terraform') && userMessage.toLowerCase().includes('deploy')) ||
      (assistantResponse.toLowerCase().includes('terraform') && assistantResponse.toLowerCase().includes('deploy'));
    
    if (hasCodeBlock || hasTerraformDeploy) {
      console.log('Triggering Terraform apply...');
      
      // Add a message indicating that Terraform is being executed
      this.addMessage({
        id: this.generateId(),
        content: '🚀 Executing Terraform... Please wait while resources are being provisioned.',
        sender: 'assistant',
        timestamp: new Date()
      });
      
      // Make the API request to trigger terraform apply
      this.http.post(this.terraformApplyUrl, {}).subscribe({
        next: (response: any) => {
          console.log('Terraform apply triggered successfully:', response);
        },
        error: (error) => {
          console.error('Error triggering Terraform apply:', error);
          
          // Add error message
          this.addMessage({
            id: this.generateId(),
            content: '❌ Error triggering Terraform: ' + error.message,
            sender: 'assistant',
            timestamp: new Date()
          });
        }
      });
    }
  }
  
  // Handle terraform output from socket
  private handleTerraformOutput(output: TerraformOutput): void {
    // Add the terraform output as a message
    this.addMessage({
      id: this.generateId(),
      content: '```terraform\n' + output.output + '\n```',
      sender: 'assistant',
      timestamp: output.timestamp
    });
  }
  
  // Handle terraform status from socket
  private handleTerraformStatus(status: TerraformStatus): void {
    let content = '';
    
    switch(status.status) {
      case 'started':
        content = '🔄 Terraform execution started: ' + (status.message || '');
        break;
      case 'completed':
        content = '✅ Terraform execution completed successfully: ' + (status.message || '');
        break;
      case 'error':
        content = '❌ Terraform execution failed: ' + (status.message || '');
        break;
    }
    
    this.addMessage({
      id: this.generateId(),
      content: content,
      sender: 'assistant',
      timestamp: status.timestamp
    });
  }

  private generateId(): string {
    return Math.random().toString(36).substring(2, 15);
  }
  
  /**
   * Starts a new chat session by creating a new session
   * and adding a welcome message
   */
  startNewChat(): void {
    const welcomeMessage: ChatMessage = {
      id: this.generateId(),
      content: 'Hello! How can I help you today?',
      sender: 'assistant' as 'assistant',
      timestamp: new Date()
    };
    
    // Create a new session
    const newSession: ChatSession = {
      id: this.generateId(),
      title: 'New Chat',
      messages: [welcomeMessage],
      createdAt: new Date(),
      updatedAt: new Date(),
      totalTokens: 0
    };
    
    // Add the new session to the list
    const currentSessions = this.chatSessions.getValue();
    const updatedSessions = [newSession, ...currentSessions];
    this.chatSessions.next(updatedSessions);
    
    // Set as current session
    this.currentSessionId.next(newSession.id);
    this.messages.next([welcomeMessage]);
    
    // Save to localStorage
    this.saveSessions(updatedSessions);
  }
  
  /**
   * Switch to an existing chat session
   */
  switchSession(sessionId: string): void {
    const sessions = this.chatSessions.getValue();
    const session = sessions.find(s => s.id === sessionId);
    
    if (session) {
      this.currentSessionId.next(sessionId);
      this.messages.next([...session.messages]);
    }
  }
  
  /**
   * Delete a chat session
   */
  deleteSession(sessionId: string): void {
    const sessions = this.chatSessions.getValue();
    const updatedSessions = sessions.filter(s => s.id !== sessionId);
    this.chatSessions.next(updatedSessions);
    
    // If we deleted the current session, switch to another one or create a new one
    if (this.currentSessionId.getValue() === sessionId) {
      if (updatedSessions.length > 0) {
        this.switchSession(updatedSessions[0].id);
      } else {
        this.startNewChat();
      }
    }
    
    // Save to localStorage
    this.saveSessions(updatedSessions);
  }
  
  /**
   * Update the title of a session
   */
  private updateSessionTitle(sessionId: string, title: string): void {
    const sessions = this.chatSessions.getValue();
    const sessionIndex = sessions.findIndex(s => s.id === sessionId);
    
    if (sessionIndex !== -1) {
      const updatedSession = {
        ...sessions[sessionIndex],
        title,
        updatedAt: new Date()
      };
      
      const updatedSessions = [...sessions];
      updatedSessions[sessionIndex] = updatedSession;
      
      this.chatSessions.next(updatedSessions);
      this.saveSessions(updatedSessions);
    }
  }
  
  /**
   * Generate a title for a session based on the first message
   */
  private generateSessionTitle(content: string): string {
    // Use the first 30 characters of the message as the title
    return content.length > 30 ? content.substring(0, 30) + '...' : content;
  }
  
  /**
   * Save sessions to localStorage
   */
  private saveSessions(sessions: ChatSession[]): void {
    try {
      localStorage.setItem('chatSessions', JSON.stringify(sessions));
    } catch (error) {
      console.error('Error saving sessions to localStorage:', error);
    }
  }
  
  /**
   * Load saved sessions from localStorage
   */
  private loadSavedSessions(): void {
    try {
      const savedSessions = localStorage.getItem('chatSessions');
      
      if (savedSessions) {
        const sessions = JSON.parse(savedSessions) as ChatSession[];
        
        // Convert string dates back to Date objects
        const parsedSessions = sessions.map(session => ({
          ...session,
          createdAt: new Date(session.createdAt),
          updatedAt: new Date(session.updatedAt),
          messages: session.messages.map(msg => ({
            ...msg,
            timestamp: new Date(msg.timestamp),
            sender: msg.sender as 'user' | 'assistant' // Ensure correct typing
          }))
        }));
        
        this.chatSessions.next(parsedSessions);
        
        // Set current session to the most recent one
        if (parsedSessions.length > 0) {
          this.switchSession(parsedSessions[0].id);
        } else {
          this.startNewChat();
        }
      } else {
        this.startNewChat();
      }
    } catch (error) {
      console.error('Error loading sessions from localStorage:', error);
      this.startNewChat();
    }
  }
}