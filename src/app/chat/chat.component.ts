import { Component, OnInit, ViewChild, ElementRef, AfterViewChecked } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ChatService } from '../services/chat.service';
import { ChatMessage } from '../models/chat-message';
import { marked } from 'marked';
import * as Prism from 'prismjs';
import 'prismjs/components/prism-javascript';
import 'prismjs/components/prism-typescript';
import 'prismjs/components/prism-css';
import 'prismjs/components/prism-python';
import 'prismjs/components/prism-java';
import 'prismjs/components/prism-csharp';
import 'prismjs/components/prism-bash';
import 'prismjs/components/prism-json';
import 'prismjs/components/prism-markdown';
import 'prismjs/components/prism-yaml';

@Component({
  selector: 'app-chat',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './chat.component.html',
  styleUrls: ['./chat.component.css']
})
export class ChatComponent implements OnInit, AfterViewChecked {
  messages: ChatMessage[] = [];
  newMessage: string = '';
  isLoading: boolean = false;
  
  @ViewChild('chatContainer') private chatContainer!: ElementRef;

  constructor(private chatService: ChatService) {}

  ngOnInit(): void {
    this.chatService.getMessages().subscribe(messages => {
      this.messages = messages;
    });
  }

  ngAfterViewChecked(): void {
    this.scrollToBottom();
  }

  sendMessage(): void {
    if (!this.newMessage.trim()) return;
    
    this.isLoading = true;
    this.chatService.sendMessage(this.newMessage);
    this.newMessage = '';
    
    // Simulate loading state
    setTimeout(() => {
      this.isLoading = false;
    }, 1000);
  }

  // Handle key press events
  handleKeyDown(event: KeyboardEvent): void {
    // Check if it's Enter key
    if (event.key === 'Enter' && !event.ctrlKey && !event.shiftKey) {
      event.preventDefault();
      this.sendMessage();
    }
  }

  formatMessage(content: string): string {
    // Use marked to parse markdown
    const renderer = new marked.Renderer();
    
    // Override the code renderer to use Prism for syntax highlighting
    renderer.code = (text: string, lang: string | undefined, escaped: boolean): string => {
      if (!lang) lang = 'plaintext';
      
      // Ensure the language is loaded
      if (Prism.languages[lang]) {
        const highlightedCode = Prism.highlight(
          text,
          Prism.languages[lang],
          lang
        );
        return `<pre class="language-${lang}"><code class="language-${lang}">${highlightedCode}</code></pre>`;
      }
      
      return `<pre class="language-plaintext"><code>${text}</code></pre>`;
    };
    
    // Use marked.parse with the correct return type
    const parsed = marked.parse(content, { renderer });
    return parsed as string;
  }

  private scrollToBottom(): void {
    try {
      this.chatContainer.nativeElement.scrollTop = this.chatContainer.nativeElement.scrollHeight;
    } catch (err) {}
  }

  // Handle file uploads
  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (!input.files?.length) return;
    
    const file = input.files[0];
    const reader = new FileReader();
    
    reader.onload = () => {
      const content = reader.result as string;
      const fileExtension = file.name.split('.').pop() || '';
      let language = this.getLanguageFromExtension(fileExtension);
      
      // Format the message with the code block
      this.newMessage = `File: ${file.name}\n\n\`\`\`${language}\n${content}\n\`\`\``;
    };
    
    reader.readAsText(file);
  }
  
  getLanguageFromExtension(extension: string): string {
    const extensionMap: {[key: string]: string} = {
      'js': 'javascript',
      'ts': 'typescript',
      'py': 'python',
      'java': 'java',
      'cs': 'csharp',
      'html': 'html',
      'css': 'css',
      'json': 'json',
      'md': 'markdown',
      'yml': 'yaml',
      'yaml': 'yaml',
      'sh': 'bash',
      'bash': 'bash',
      'txt': 'plaintext'
    };
    
    return extensionMap[extension.toLowerCase()] || 'plaintext';
  }
}