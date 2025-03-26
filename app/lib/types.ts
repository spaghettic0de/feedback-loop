// Message type for chat interactions
export type Message = {
  role: "user" | "assistant";
  content: string;
};

// Hint type for providing help on questions
export type Hint = {
  text: string;
  visible: boolean;
};

// Difficulty levels for questions
export type Difficulty = "easy" | "medium" | "hard";

// Interview state type
export type InterviewState = {
  category: string | null;
  isActive: boolean;
  currentStep: "idle" | "question" | "answering" | "recording" | "evaluating" | "input";
  messages: Message[];
  isLoading: boolean;
  currentQuestion: string;
  textInput: string;
  voiceModeEnabled: boolean;
  hints: Hint[];
  difficulty?: Difficulty;
};

// API structured response
export type ApiQuestionResponseStructured = {
  question: string;
  hints: string[];
  difficulty?: Difficulty;
};

// API response type
export type ApiQuestionResponse = {
  response: string;
  structuredContent?: ApiQuestionResponseStructured;
  audioData?: string;
  error?: string;
  transcript?: string;
};

// Category type
export type Category = {
  id: string;
  name: string;
};

// Categories of technical interview questions
export const CATEGORIES: Category[] = [
  { id: "algorithms", name: "Data Structures & Algorithms" },
  { id: "system_design", name: "System Design" },
  { id: "networking", name: "Networking Concepts" },
  { id: "databases", name: "Database Systems" },
  { id: "os", name: "Operating Systems" },
  { id: "concurrency", name: "Concurrency & Parallelism" },
  { id: "web", name: "Web Technologies" },
  { id: "devops", name: "DevOps & Infrastructure" },
  { id: "security", name: "Security Concepts" },
];

// Problem history item
export type ProblemHistoryItem = {
  id: string;
  title: string;
  category: string;
  date: string;
  status: 'in-progress' | 'completed';
}; 