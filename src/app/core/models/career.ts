export interface ResumeVersion {
  id: string;
  parentId?: string;
  jobId?: string;
  jobVersion?: string;
  name: string;
  text: string;
  createdAt: string;
  expiresAt: string;
  confirmed: boolean;
  active: boolean;
  kind: 'original' | 'tailored' | 'edited';
  explanation?: string;
  missing?: string[];
  originalBase64?: string;
  mime?: string;
}
export interface CareerConfig {
  ai: boolean;
  uploads: boolean;
  processor: string;
  retentionDays: number;
  maxUploadBytes: number;
}
export interface ChatMessage {
  role: 'user' | 'assistant';
  text: string;
}
export interface Conversation {
  id: string;
  messages: ChatMessage[];
  jobId?: string;
  createdAt: string;
  expiresAt: string;
}
