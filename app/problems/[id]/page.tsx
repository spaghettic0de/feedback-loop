"use client";

import React, { useState, useEffect, useRef } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";
import rehypeRaw from "rehype-raw";
import rehypeSanitize from "rehype-sanitize";
import rehypeHighlight from "rehype-highlight";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { MarkdownComponents } from "@/lib/markdown-components";

// Import types and constants
import { 
  Message, 
  Hint, 
  InterviewState,
  ApiQuestionResponse,
  ApiQuestionResponseStructured,
  Category,
  Difficulty,
  ProblemHistoryItem
} from "@/lib/types";

// Add the CATEGORY_SECTIONS definition from app/page.tsx
// Define category sections with subsections
const CATEGORY_SECTIONS = [
  {
    id: "core_cs",
    name: "Computer Science Fundamentals",
    categories: [
      { id: "algorithms", name: "Algorithms & Data Structures" },
      { id: "system_design", name: "System Design" },
      { id: "networking", name: "Networking" },
      { id: "os", name: "Operating Systems" },
      { id: "concurrency", name: "Concurrency" },
      { id: "databases", name: "Databases" },
      { id: "web", name: "Web Development" },
      { id: "devops", name: "DevOps" },
      { id: "security", name: "Security" },
    ]
  },
  {
    id: "programming_languages",
    name: "Programming Languages",
    categories: [
      { id: "python", name: "Python" },
      { id: "javascript", name: "JavaScript" },
      { id: "typescript", name: "TypeScript" },
      { id: "cpp", name: "C++" },
      { id: "csharp", name: "C#" },
      { id: "go", name: "Go" },
    ]
  }
];

// Create a flattened array of all categories for easier lookup
const FLATTENED_CATEGORIES = CATEGORY_SECTIONS.flatMap(section => section.categories);

// Helper function to create form data from an object
function createFormData(data: Record<string, any>): FormData {
  const formData = new FormData();
  
  Object.entries(data).forEach(([key, value]) => {
    if (key === "messages" && Array.isArray(value)) {
      // Handle messages array specially - each message needs to be a separate entry
      if (value.length > 0) {
        value.forEach((message, index) => {
          formData.append(`messages`, JSON.stringify(message));
        });
      } else {
        // If empty array, add an empty entry to ensure the key exists in the request
        formData.append(`messages`, JSON.stringify([]));
      }
    } else if (Array.isArray(value)) {
      // For other arrays, just stringify them
      formData.append(key, JSON.stringify(value));
    } else if (value !== null && value !== undefined) {
      formData.append(key, String(value));
    }
  });
  
  return formData;
}

// Helper function to parse evaluation response
function parseEvaluationResponse(evaluation: string): {
  score: number;
  strengths: string[];
  improvements: string[];
  missedPoints: string[];
  followUp?: string;
  idealResponse?: string;
} {
  // Initialize with empty values
  const result = {
    score: 0,
    strengths: [] as string[],
    improvements: [] as string[],
    missedPoints: [] as string[],
    followUp: '',
    idealResponse: ''
  };

  // Extract score (looking for "Score: X" or "X/5" pattern)
  const scoreMatch = evaluation.match(/Score:?\s*(\d+(?:\.\d+)?)/i) || 
                    evaluation.match(/(\d+(?:\.\d+)?)\s*\/\s*5/i);
  if (scoreMatch) {
    result.score = parseFloat(scoreMatch[1]);
  }

  // Extract sections based on common headings
  const sections: Record<string, RegExp> = {
    strengths: /(?:Strengths|Strengths:)\s*([\s\S]*?)(?=Areas for Improvement|Improvements|Areas of Improvement|Key Points Missed|Missed Points|Follow-up|Ideal Response|$)/i,
    improvements: /(?:Areas for Improvement|Improvements|Areas of Improvement):?\s*([\s\S]*?)(?=Key Points Missed|Missed Points|Follow-up|Ideal Response|$)/i,
    missedPoints: /(?:Key Points Missed|Missed Points|Missed Opportunities|Key Points):?\s*([\s\S]*?)(?=Follow-up|Ideal Response|$)/i,
    followUp: /(?:Follow-up Question|Follow-up):?\s*([\s\S]*?)(?=Ideal Response|$)/i,
    idealResponse: /(?:Ideal Response|Example Answer|Model Answer):?\s*([\s\S]*?)(?=$)/i
  };

  // Extract each section
  Object.entries(sections).forEach(([key, regex]) => {
    const match = evaluation.match(regex);
    if (match && match[1] && match[1].trim()) {
      const content = match[1].trim();
      
      // For list sections, split into bullet points
      if (['strengths', 'improvements', 'missedPoints'].includes(key)) {
        // First clean up common markdown artifacts
        const cleanedContent = content
          // Remove any leading/trailing list artifacts
          .replace(/^\s*[-•*]\s*/, '')
          .trim();
        
        // Try different ways to split the content into bullet points
        let points: string[] = [];
        
        // Method 1: Try to split by bullet points or numbered lists
        const bulletMatch = cleanedContent.match(/(?:^|\n)[-•*]\s+(.+?)(?=(?:\n[-•*]|\n\d+\.|\n\n|$))/g);
        const numberedMatch = cleanedContent.match(/(?:^|\n)\d+\.\s+(.+?)(?=(?:\n[-•*]|\n\d+\.|\n\n|$))/g);
        
        if (bulletMatch || numberedMatch) {
          const matches = [...(bulletMatch || []), ...(numberedMatch || [])];
          points = matches.map(point => 
            point
              .replace(/^[-•*]\s+/, '') // Remove bullet markers
              .replace(/^\d+\.\s+/, '') // Remove numbers
              .replace(/^\n+/, '') // Remove leading newlines
              .trim()
          );
        } 
        // Method 2: If no bullet points found, try splitting by newlines
        else if (cleanedContent.includes('\n')) {
          points = cleanedContent
            .split('\n')
            .map(point => point.trim().replace(/^[-•*]\s+/, '').replace(/^\d+\.\s+/, ''))
            .filter(point => point.length > 0);
        }
        // Method 3: If still no structured points found, just use the whole content
        else {
          points = [cleanedContent];
        }
        
        // Filter out empty or obviously incorrect points (like single asterisks or numbers)
        points = points
          .filter(point => point.length > 1) // Exclude very short items like "*" or "•"
          .filter(point => !/^[-•*]$/.test(point)); // Exclude items that are just bullet characters
        
        if (points.length > 0) {
          (result as any)[key] = points;
        } else {
          // If still no valid points found, use the whole content
          (result as any)[key] = [cleanedContent.replace(/^[-•*]\s+/, '')];
        }
      } else if (key === 'followUp') {
        // Clean up the follow-up question by removing asterisks and extra whitespace
        let followUpText = content
          .replace(/^\s*\*+\s*/, '')  // Remove leading asterisks
          .replace(/\s*\*+\s*$/, '')  // Remove trailing asterisks
          .trim();
          
        // Also remove any "###" markdown headers that might be present
        followUpText = followUpText.replace(/^###\s+/, '');
        
        (result as any)[key] = followUpText;
      } else if (key === 'idealResponse') {
        // For ideal response, ensure code blocks are properly formatted
        // Make sure triple backtick code blocks have language specifiers
        let idealResponseText = content;
        
        // Detect code blocks without language specification and add 'python' as default
        idealResponseText = idealResponseText.replace(/```\s*\n/g, '```python\n');
        
        // Clean up any bad formatting
        idealResponseText = idealResponseText
          .replace(/^```\s*$/gm, '```') // Handle lone backticks
          .replace(/^`{1,2}(?!`)/gm, '') // Remove stray single or double backticks at line start
          .replace(/(?<!\n)```/g, '\n```'); // Ensure backticks start on their own line
        
        (result as any)[key] = idealResponseText;
      } else {
        // For other non-list sections, just use the whole content
        (result as any)[key] = content;
      }
    }
  });

  return result;
}

// Component to display the evaluation in a structured format
const StructuredEvaluation = ({ evaluation }: { evaluation: string }) => {
  const {
    score,
    strengths,
    improvements,
    missedPoints,
    followUp,
    idealResponse
  } = parseEvaluationResponse(evaluation);

  return (
    <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden">
      <div className="p-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-medium text-gray-900 dark:text-white">Evaluation Results</h3>
          <div className="flex items-center justify-center w-16 h-16 rounded-full bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300">
            <span className="text-3xl font-bold">{score}</span>
            <span className="text-sm ml-0.5 mt-1">/5</span>
          </div>
        </div>
        
        {strengths.length > 0 && (
          <div className="mb-4">
            <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Strengths</h4>
            <ul className="list-disc pl-5 text-sm text-gray-600 dark:text-gray-400 space-y-1">
              {strengths.map((strength, i) => (
                <li key={i} className="prose-sm dark:prose-invert">
                  <ReactMarkdown
                    components={MarkdownComponents}
                    rehypePlugins={[rehypeRaw, rehypeSanitize, rehypeHighlight]}
                  >
                    {strength}
                  </ReactMarkdown>
                </li>
              ))}
            </ul>
          </div>
        )}
        
        {improvements.length > 0 && (
          <div className="mb-4">
            <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Areas for Improvement</h4>
            <ul className="list-disc pl-5 text-sm text-gray-600 dark:text-gray-400 space-y-1">
              {improvements.map((improvement, i) => (
                <li key={i} className="prose-sm dark:prose-invert">
                  <ReactMarkdown
                    components={MarkdownComponents}
                    rehypePlugins={[rehypeRaw, rehypeSanitize, rehypeHighlight]}
                  >
                    {improvement}
                  </ReactMarkdown>
                </li>
              ))}
            </ul>
          </div>
        )}
        
        {missedPoints.length > 0 && (
          <div className="mb-4">
            <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Key Points Missed</h4>
            <ul className="list-disc pl-5 text-sm text-gray-600 dark:text-gray-400 space-y-1">
              {missedPoints.map((point, i) => (
                <li key={i} className="prose-sm dark:prose-invert">
                  <ReactMarkdown
                    components={MarkdownComponents}
                    rehypePlugins={[rehypeRaw, rehypeSanitize, rehypeHighlight]}
                  >
                    {point}
                  </ReactMarkdown>
                </li>
              ))}
            </ul>
          </div>
        )}
        
        {followUp && (
          <div className="mb-4">
            <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Follow-up Question</h4>
            <div className="text-sm text-gray-600 dark:text-gray-400 prose dark:prose-invert prose-sm">
              <ReactMarkdown
                components={MarkdownComponents}
                rehypePlugins={[rehypeRaw, rehypeSanitize, rehypeHighlight]}
              >
                {followUp}
              </ReactMarkdown>
            </div>
          </div>
        )}
        
        {idealResponse && (
          <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
            <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Ideal Response Example</h4>
            <div className="text-sm text-gray-600 dark:text-gray-400 prose dark:prose-invert prose-sm max-w-none">
              <ReactMarkdown
                components={MarkdownComponents}
                rehypePlugins={[rehypeRaw, rehypeSanitize, [rehypeHighlight, { ignoreMissing: true }]]}
              >
                {idealResponse}
              </ReactMarkdown>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default function ProblemPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  
  // State
  const [state, setState] = useState<InterviewState>({
    category: null,
    isActive: false,
    currentStep: "idle",
    messages: [],
    isLoading: false,
    currentQuestion: "",
    textInput: "",
    voiceModeEnabled: false,
    hints: [],
  });
  const [audioPermissionGranted, setAudioPermissionGranted] = useState<boolean | null>(null);

  // Refs
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<BlobPart[]>([]);
  const audioElementRef = useRef<HTMLAudioElement | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  // Check for problem ID and category from URL
  useEffect(() => {
    const problemId = params?.id;
    const categoryFromUrl = searchParams?.get('category');
    
    if (problemId) {
      console.log("Problem ID from URL:", problemId);
      
      // If we have a category parameter, start the interview with that category
      if (categoryFromUrl) {
        console.log("Category from URL:", categoryFromUrl);
        startInterview(categoryFromUrl);
      } else {
        // No category - we'll show the category selection
        setState(prevState => ({
          ...prevState,
          isActive: false,
          currentStep: "idle"
        }));
      }
    }
  }, [params, searchParams]);
  
  // Load problem data on mount
  useEffect(() => {
    // Check if this is a new problem or existing one
    const savedProblem = localStorage.getItem(`problem-${params.id}`);
    
    if (savedProblem) {
      try {
        const problemData = JSON.parse(savedProblem);
        setState(problemData);
      } catch (e) {
        console.error('Failed to parse problem data:', e);
      }
    } else {
      // New problem - we'll show the category selection
      setState(prev => ({
        ...prev,
        isActive: false,
        currentStep: "idle"
      }));
    }
  }, [params.id]);
  
  // Save problem state when it changes
  useEffect(() => {
    if (state.isActive) {
      localStorage.setItem(`problem-${params.id}`, JSON.stringify(state));
      
      // Update history
      const historyItem = {
        id: params.id,
        title: state.currentQuestion.slice(0, 50) + (state.currentQuestion.length > 50 ? '...' : ''),
        category: FLATTENED_CATEGORIES.find(c => c.id === state.category)?.name || 'Unknown',
        date: new Date().toLocaleDateString(),
        status: state.messages.length > 1 ? 'completed' : 'in-progress'
      };
      
      // Get current history
      const savedHistory = localStorage.getItem('problemHistory');
      let history = [];
      
      if (savedHistory) {
        try {
          history = JSON.parse(savedHistory);
          // Update this item or add it
          const existingIndex = history.findIndex((item: any) => item.id === params.id);
          if (existingIndex >= 0) {
            history[existingIndex] = historyItem;
          } else {
            history.unshift(historyItem); // Add to beginning
          }
        } catch (e) {
          console.error('Failed to parse history:', e);
          history = [historyItem];
        }
      } else {
        history = [historyItem];
      }
      
      // Limit history to 50 items
      if (history.length > 50) {
        history = history.slice(0, 50);
      }
      
      localStorage.setItem('problemHistory', JSON.stringify(history));
    }
  }, [state, params.id]);
  
  // Check for audio permission on component mount
  useEffect(() => {
    // Try to check if we already have permission
    if (navigator.permissions && navigator.permissions.query) {
      navigator.permissions.query({ name: 'microphone' as PermissionName })
        .then(permissionStatus => {
          setAudioPermissionGranted(permissionStatus.state === 'granted');
          
          // Listen for permission changes
          permissionStatus.onchange = () => {
            setAudioPermissionGranted(permissionStatus.state === 'granted');
          };
        })
        .catch(err => {
          console.error("Error checking microphone permission:", err);
          // Set to null, which means we don't know
          setAudioPermissionGranted(null);
        });
    }
  }, []);

  // Scroll to bottom of messages when they change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [state.messages]);

  // Create audio element for TTS playback
  useEffect(() => {
    // Create audio element with muted attribute to help with autoplay policies
    audioElementRef.current = new Audio();
    
    // Some browsers have autoplay restrictions, so set initial properties
    // that make autoplay more likely to succeed
    audioElementRef.current.muted = false; // Not muted, we need to hear it
    audioElementRef.current.volume = 1.0;  // Full volume
    audioElementRef.current.autoplay = false; // We'll control play() manually
    audioElementRef.current.preload = "auto"; // Preload audio data
    
    // Add various event handlers to track audio state
    audioElementRef.current.onloadeddata = () => {
      console.log("Audio data loaded successfully");
    };
    
    audioElementRef.current.onplay = () => {
      console.log("Audio playback started");
    };
    
    audioElementRef.current.onpause = () => {
      console.log("Audio playback paused");
    };
    
    audioElementRef.current.onerror = (e) => {
      const error = audioElementRef.current?.error;
      console.error("Audio playback error:", error ? 
        `code: ${error.code}, message: ${error.message}` : e);
      
      // If we get a media error, check specific code to log better information
      if (error) {
        switch (error.code) {
          case MediaError.MEDIA_ERR_ABORTED:
            console.error("Audio playback aborted by user");
            break;
          case MediaError.MEDIA_ERR_NETWORK:
            console.error("Network error while loading audio");
            break;
          case MediaError.MEDIA_ERR_DECODE:
            console.error("Audio decoding error - format may be unsupported");
            break;
          case MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED:
            console.error("Audio source format not supported by browser");
            break;
        }
      }
      
      // Fallback to browser TTS in case of error
      speakText(state.currentQuestion);
    };
    
    audioElementRef.current.onended = () => {
      // Only transition to answering state when audio has finished playing
      console.log("Audio playback ended, transitioning to answering state");
      setState(prev => ({
        ...prev,
        currentStep: "answering"
      }));
      toast.info("You can now record your answer");
    };
    
    // Pre-fetch voices for speech synthesis as a fallback
    if ('speechSynthesis' in window) {
      window.speechSynthesis.getVoices();
    }
    
    return () => {
      if (audioElementRef.current) {
        audioElementRef.current.pause();
        audioElementRef.current = null;
      }
    };
  }, []);

  // Toggle voice mode
  const toggleVoiceMode = async () => {
    if (!state.voiceModeEnabled) {
      // Trying to enable voice mode - check permissions first
      const permissionGranted = await requestAudioPermission();
      if (permissionGranted) {
        setState(prev => ({ ...prev, voiceModeEnabled: true }));
        toast.success("Voice mode enabled");
      } else {
        toast.error("Could not enable voice mode. Microphone access is required.");
      }
    } else {
      // Disabling voice mode
      setState(prev => ({ ...prev, voiceModeEnabled: false }));
      toast.info("Voice mode disabled. Using text input instead.");
    }
  };

  // Handle text input changes
  const handleTextInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setState(prev => ({ ...prev, textInput: e.target.value }));
  };

  // Function to request audio permission
  async function requestAudioPermission(): Promise<boolean> {
    console.log("Requesting audio permission...");
    toast.info("Please allow microphone access when prompted");
    
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      // Stop tracks after permission is granted
      stream.getTracks().forEach(track => track.stop());
      
      setAudioPermissionGranted(true);
      toast.success("Microphone access granted!");
      
      return true;
    } catch (error: any) {
      console.error("Error requesting audio permission:", error);
      setAudioPermissionGranted(false);
      toast.error("Microphone access denied or not available");
      return false;
    }
  }

  // Submit text answer
  const submitTextAnswer = async () => {
    if (!state.textInput.trim()) {
      toast.error("Please enter your answer before submitting.");
      return;
    }

    console.log("Submitting text answer:", state.textInput.substring(0, 50) + "...");
    
    // Update state to evaluating
    setState(prev => ({
      ...prev,
      isLoading: true,
      currentStep: "evaluating"
    }));
    
    toast.loading("Evaluating your answer...");
    
    try {
      // Get the user's answer
      const userAnswer = state.textInput.trim();
      
      // Create a copy of messages with the new user message for evaluation
      // But don't update the state yet to prevent duplicate messages
      const messagesForEvaluation: Message[] = [
        ...state.messages,
        { role: "user" as const, content: userAnswer }
      ];
      
      // Clear input field immediately
      setState(prev => ({
        ...prev,
        textInput: ""
      }));
      
      // Evaluate the answer
      if (state.category) {
        console.log("Evaluating answer for category:", state.category);
        const evaluation = await evaluateAnswer(state.category, messagesForEvaluation);
        
        if (evaluation) {
          console.log("Evaluation received, updating state with both messages");
          
          // Update the UI with both the user message and evaluation response
          setState(prev => ({
            ...prev,
            isLoading: false,
            currentStep: "idle",
            messages: [
              ...state.messages,
              { role: "user", content: userAnswer },
              { role: "assistant", content: evaluation }
            ]
          }));
          
          toast.dismiss();
          toast.success("Answer evaluated");
        } else {
          // Handle evaluation failure
          console.log("Evaluation failed, resetting to input state");
          setState(prev => ({
            ...prev,
            isLoading: false,
            currentStep: "input"
          }));
          
          toast.dismiss();
          toast.error("Failed to evaluate answer. Please try again.");
        }
      }
    } catch (error) {
      console.error("Error processing text answer:", error);
      toast.dismiss();
      toast.error("Error evaluating your answer. Please try again.");
      
      setState(prev => ({
        ...prev,
        isLoading: false,
        currentStep: "input"
      }));
    }
  };

  // Modified function to start interview with option for voice mode
  async function startInterview(categoryId: string) {
    console.log(`Starting interview for category: ${categoryId}`);
    
    // Only check for audio permission if voice mode is enabled
    if (state.voiceModeEnabled && audioPermissionGranted !== true) {
      console.log("Voice mode enabled but audio permission not granted, requesting...");
      const permissionGranted = await requestAudioPermission();
      if (!permissionGranted) {
        toast.warning("Microphone access is required for voice mode. Switching to text mode.");
        setState((prev: InterviewState) => ({ ...prev, voiceModeEnabled: false }));
      }
    }
    
    // Show loading toast
    const loadingToastId = toast.loading("Starting interview...");
    
    try {
      setState((prev: InterviewState) => ({
        ...prev,
        category: categoryId,
        isActive: true,
        isLoading: true,
        currentStep: "question",
        messages: []
      }));

      console.log("Fetching first question...");
      const { questionText, audioData, hints, difficulty } = await fetchQuestion(categoryId);
      
      // Dismiss loading toast and show success
      toast.dismiss(loadingToastId);
      toast.success("Interview started!");
      
      // Update messages with welcome message and first question
      setState((prev: InterviewState) => ({
        ...prev,
        isLoading: false,
        currentQuestion: questionText,
        messages: [
          {
            role: "assistant",
            content: questionText
          }
        ],
        hints,
        difficulty
      }));
      
      // If voice mode is enabled, play the question audio
      if (state.voiceModeEnabled && audioData) {
        console.log("Voice mode enabled. Playing audio question...");
        await playAudioData(audioData);
      } else if (state.voiceModeEnabled) {
        console.log("Voice mode enabled but no audio data, using speech synthesis...");
        await speakText(questionText);
      } else {
        console.log("Voice mode disabled, setting state to input mode");
        setState((prev: InterviewState) => ({
          ...prev, 
          currentStep: "input"
        }));
      }
    } catch (error: any) {
      console.error("Error starting interview:", error);
      toast.dismiss(loadingToastId);
      toast.error(`Failed to start interview: ${error.message || "Unknown error"}`);
      // Reset to selection state if there was an error
      setState((prev: InterviewState) => ({
        ...prev,
        category: null,
        isActive: false,
        currentStep: "idle",
        messages: [],
        isLoading: false,
        currentQuestion: "",
      }));
    }
  }

  // Placeholder for the rest of the functions
  // These will be added in subsequent edits
  
  // Temporary placeholders for functions
  /*const evaluateAnswer = async (category: string, messages: Message[]) => {
    // Placeholder - to be implemented
    return "Placeholder evaluation";
  };*/
  
  const fetchQuestion = async (category: string) => {
    // Make API request to get a question for the specified category
    try {
      const formData = createFormData({
        category: category,
        requestType: "question",
        generateAudio: state.voiceModeEnabled, // Only generate audio if voice mode is enabled
      });
      
      const response = await fetch("/api", {
        method: "POST",
        body: formData,
      });
      
      if (!response.ok) {
        // Try to get an error message from the response
        try {
          const errorData = await response.json();
          throw new Error(errorData.error || `Server error: ${response.status}`);
        } catch (parseError) {
          throw new Error(`Failed to fetch question. Server returned ${response.status}`);
        }
      }
      
      const data: ApiQuestionResponse = await response.json();
      
      if (data.error) {
        throw new Error(data.error);
      }
      
      // Check if we have structured content
      if (data.structuredContent) {
        // If we have structured content, use it to parse the question and hints
        const questionText = data.structuredContent.question;
        const hintTexts = data.structuredContent.hints;
        // Use the difficulty directly from the API response or default to medium
        const difficulty = data.structuredContent.difficulty || "medium";
        console.log(`Question difficulty from API: ${difficulty}`);
        
        // Create hint objects
        const hints: Hint[] = hintTexts.map((text, index) => ({
          text,
          visible: false,
        }));
        
        return {
          questionText,
          audioData: data.audioData || null,
          hints,
          difficulty
        };
      } else {
        // Fallback to using the raw response
        console.warn("No structured content found in API response, using raw response");
        
        return {
          questionText: data.response,
          audioData: data.audioData || null,
          hints: [],
          difficulty: "medium" as const // Default to medium
        };
      }
    } catch (error) {
      console.error("Error fetching question:", error);
      throw error;
    }
  };
  
  const playAudioData = async (audioData: string) => {
    // Placeholder - to be implemented
  };
  
  const speakText = async (text: string) => {
    // Placeholder - to be implemented
  };

  // Add a DifficultyBadge component
  const DifficultyBadge = ({ difficulty }: { difficulty: Difficulty }) => {
    const colors: Record<Difficulty, string> = {
      easy: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
      medium: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
      hard: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200"
    };
    
    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${colors[difficulty]}`}>
        {difficulty}
      </span>
    );
  };

  // Toggle hint visibility function - move inside the component
  const toggleHintVisibility = (index: number) => {
    setState(prevState => {
      const updatedHints = [...prevState.hints];
      if (updatedHints[index]) {
        updatedHints[index] = {
          ...updatedHints[index],
          visible: !updatedHints[index].visible
        };
      }
      return {
        ...prevState,
        hints: updatedHints
      };
    });
  };

  // Get category name by id
  function getCategoryName(categoryId: string): string {
    const category = FLATTENED_CATEGORIES.find(c => c.id === categoryId);
    return category?.name || '';
  }

  // CategorySelection component
  function CategorySelection({ onSelectCategory }: { onSelectCategory: (categoryId: string) => void }) {
    return (
      <div className="max-w-3xl mx-auto">
        <h2 className="text-3xl font-medium text-gray-900 dark:text-white mb-3">
          Select a Category
        </h2>
        <p className="text-gray-600 dark:text-gray-400 text-lg mb-4">
          Choose a topic for your technical interview practice:
        </p>
        
        {CATEGORY_SECTIONS.map((section) => (
          <div key={section.id} className="mb-8">
            <h3 className="text-xl font-medium text-gray-800 dark:text-gray-200 mb-4">
              {section.name}
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {section.categories.map((category) => (
                <button
                  key={category.id}
                  onClick={() => onSelectCategory(category.id)}
                  className="group p-5 bg-gray-50 dark:bg-gray-900 rounded-xl hover:shadow-md transition-all duration-200 text-left"
                >
                  <h4 className="font-medium text-lg text-gray-900 dark:text-white mb-2">
                    {category.name}
                  </h4>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {getCategoryDescription(category.id)}
                  </p>
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  }

  // Render category selection when not active
  if (!state.isActive) {
    return (
      <div className="flex-1 overflow-y-auto bg-white dark:bg-gray-950 p-6">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-3xl font-medium text-gray-900 dark:text-white mb-3">
            Select a Category
          </h2>
          <p className="text-gray-600 dark:text-gray-400 text-lg mb-4">
            Choose a topic for your technical interview practice:
          </p>
          
          {CATEGORY_SECTIONS.map((section) => (
            <div key={section.id} className="mb-8">
              <h3 className="text-xl font-medium text-gray-800 dark:text-gray-200 mb-4">
                {section.name}
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {section.categories.map((category) => (
                  <button
                    key={category.id}
                    onClick={() => startInterview(category.id)}
                    className="group p-5 bg-gray-50 dark:bg-gray-900 rounded-xl hover:shadow-md transition-all duration-200 text-left"
                  >
                    <h4 className="font-medium text-lg text-gray-900 dark:text-white mb-2">
                      {category.name}
                    </h4>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      {getCategoryDescription(category.id)}
                    </p>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Placeholder content for active state
  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <header className="bg-white dark:bg-gray-950 border-b border-gray-200 dark:border-gray-800 py-3 px-6">
        <div className="flex justify-between items-center">
          <div className="flex items-center">
            <h2 className="text-sm font-medium text-gray-700 dark:text-gray-300 mr-3">
              {FLATTENED_CATEGORIES.find((c) => c.id === state.category)?.name || "Interview"}
            </h2>
            {state.difficulty && (
              <DifficultyBadge difficulty={state.difficulty} />
            )}
            <div className="flex items-center ml-3">
              <div className={`h-2 w-2 rounded-full mr-1.5 ${
                state.currentStep === "question" ? "bg-blue-500 animate-pulse" :
                state.currentStep === "answering" ? "bg-green-500" :
                state.currentStep === "recording" ? "bg-red-500 animate-pulse" :
                state.currentStep === "evaluating" ? "bg-yellow-500 animate-pulse" :
                state.currentStep === "input" ? "bg-green-500" :
                "bg-gray-400"
              }`}></div>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {state.currentStep === "question" && "Listening to question..."}
                {state.currentStep === "answering" && "Ready for your answer"}
                {state.currentStep === "recording" && "Recording your answer..."}
                {state.currentStep === "evaluating" && "Evaluating your answer..."}
                {state.currentStep === "input" && "Please type your answer below"}
                {state.currentStep === "idle" && "Interview in progress"}
              </p>
            </div>
          </div>
          
          <div className="flex space-x-3">
            <Button
              onClick={toggleVoiceMode}
              variant={state.voiceModeEnabled ? "secondary" : "outline"}
              size="sm"
              className={state.voiceModeEnabled ? "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-200 hover:bg-blue-200 dark:hover:bg-blue-800" : ""}
            >
              {state.voiceModeEnabled ? (
                <>
                  <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-1.5"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"></path><path d="M19 10v2a7 7 0 0 1-14 0v-2"></path><line x1="12" x2="12" y1="19" y2="22"></line></svg>
                  Voice Mode: On
                </>
              ) : (
                <>
                  <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-1.5"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"></path><line x1="3" y1="3" x2="21" y2="21"></line></svg>
                  Voice Mode: Off
                </>
              )}
            </Button>
            <Button 
              onClick={resetInterview}
              variant="outline"
              size="sm"
            >
              End Interview
            </Button>
          </div>
        </div>
      </header>
      
      <main className="flex-1 overflow-y-auto p-6">
        {state.isActive ? (
          <div className="max-w-3xl mx-auto">
            {/* Category and difficulty header */}
            <div className="flex justify-between items-center mb-6">
              <h1 className="text-2xl font-semibold">
                {getCategoryName(state.category || '') || "Interview"}
              </h1>
              {state.difficulty && (
                <DifficultyBadge difficulty={state.difficulty} />
              )}
            </div>
            
            {/* Question display first - with Interviewer label */}
            {state.currentQuestion && (
              <div className="bg-white dark:bg-gray-900 rounded-lg shadow-sm p-4 mb-4 border border-gray-200 dark:border-gray-800">
                <div className="mb-2 text-sm font-medium">
                  Interviewer
                </div>
                <div className="prose dark:prose-invert max-w-none">
                  <ReactMarkdown
                    components={MarkdownComponents}
                    rehypePlugins={[rehypeRaw, rehypeSanitize, rehypeHighlight]}
                  >
                    {state.currentQuestion}
                  </ReactMarkdown>
                </div>
                
                {/* Hints section right after the question */}
                {state.hints.length > 0 && (
                  <div className="mt-4 space-y-2">
                    {state.hints.map((hint, index) => (
                      <div key={index} className="bg-gray-50 dark:bg-gray-900 rounded-lg overflow-hidden">
                        <button
                          onClick={() => toggleHintVisibility(index)}
                          className="w-full px-4 py-2 text-left flex justify-between items-center text-sm hover:bg-gray-100 dark:hover:bg-gray-800"
                        >
                          <span className="font-medium">Hint {index + 1}</span>
                          <span>
                            {hint.visible ? (
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                              </svg>
                            ) : (
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                              </svg>
                            )}
                          </span>
                        </button>
                        {hint.visible && (
                          <div className="px-4 pb-3 prose-sm dark:prose-invert prose-gray max-w-none">
                            <ReactMarkdown
                              components={MarkdownComponents}
                              rehypePlugins={[rehypeRaw, rehypeSanitize, rehypeHighlight]}
                            >
                              {hint.text}
                            </ReactMarkdown>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Messages - skip the first message which is the question */}
            {state.messages.length > 1 && (
              <div className="space-y-6 mb-6">
                {state.messages.slice(1).map((message, index) => {
                  // Add 1 to index since we're using slice(1)
                  const actualIndex = index + 1;
                  
                  // Check if this is an evaluation message from the assistant
                  const isEvaluation = message.role === "assistant" && 
                                     actualIndex > 0 && 
                                     state.messages[actualIndex - 1].role === "user";
                  
                  return (
                    <div 
                      key={actualIndex} 
                      className={`p-4 rounded-lg ${
                        message.role === "user"
                          ? "bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-900"
                          : "bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800"
                      }`}
                    >
                      <div className="mb-2 text-sm font-medium">
                        {message.role === "user" ? "You" : "Interviewer"}
                      </div>
                      
                      {/* Render structured evaluation or regular markdown */}
                      {isEvaluation ? (
                        <StructuredEvaluation evaluation={message.content} />
                      ) : (
                        <div className="prose dark:prose-invert max-w-none">
                          <ReactMarkdown
                            components={MarkdownComponents}
                            rehypePlugins={[rehypeRaw, rehypeSanitize, rehypeHighlight]}
                          >
                            {message.content}
                          </ReactMarkdown>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* Input area */}
            {state.currentStep === "input" && (
              <div className="bg-white dark:bg-gray-900 rounded-lg shadow-sm border border-gray-200 dark:border-gray-800 p-4">
                <div className="mb-4">
                  <Textarea
                    placeholder="Type your answer..."
                    value={state.textInput}
                    onChange={handleTextInputChange}
                    className="w-full h-32 resize-none"
                  />
                </div>
                <div className="flex justify-end">
                  <Button onClick={submitTextAnswer}>
                    Submit Answer
                  </Button>
                </div>
              </div>
            )}
            
            {/* Actions section */}
            {state.currentStep === "idle" && (
              <div className="flex justify-center mt-6">
                <Button onClick={askNewQuestion}>
                  Ask New Question
                </Button>
              </div>
            )}
            
            {/* Loading indicator */}
            {state.isLoading && (
              <div className="flex justify-center my-8">
                <div className="rounded-md bg-blue-50 dark:bg-blue-900/20 p-4 flex items-center space-x-3">
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600 dark:border-blue-400"></div>
                  <div className="text-blue-700 dark:text-blue-300 text-sm">Processing...</div>
                </div>
              </div>
            )}
          </div>
        ) : (
          <CategorySelection onSelectCategory={startInterview} />
        )}
      </main>
    </div>
  );
}

// Helper function to get descriptions for each category
function getCategoryDescription(id: string): string {
  const descriptions: Record<string, string> = {
    "algorithms": "Practice sorting, searching, and optimization algorithms",
    "system_design": "Design scalable systems and architectures",
    "networking": "Understand protocols, APIs, and network architecture",
    "databases": "Work with SQL, NoSQL, and database optimization",
    "os": "Explore processes, memory management, and threading",
    "concurrency": "Master multithreading, parallelism, and race conditions",
    "web": "Cover HTTP, RESTful design, and web architecture",
    "devops": "Learn CI/CD, containers, and infrastructure as code",
    "security": "Practice authentication, encryption, and secure design"
  };
  
  return descriptions[id] || "Practice technical interview questions";
}

// Update the evaluateAnswer function
async function evaluateAnswer(category: string, messages: Message[]): Promise<string | null> {
  console.log("Evaluating answer for category:", category);
  
  try {
    // Request evaluation
    const formData = createFormData({
      category,
      requestType: "evaluate",
      messages,
    });
    
    console.log("Sending evaluation request to API");
    const response = await fetch("/api", {
      method: "POST",
      body: formData,
    });
    
    if (!response.ok) {
      // Try to get an error message from the response
      try {
        const errorData = await response.json();
        throw new Error(errorData.error || `Server error: ${response.status}`);
      } catch (parseError) {
        throw new Error(`Failed to evaluate answer. Server returned ${response.status}`);
      }
    }
    
    const data: ApiQuestionResponse = await response.json();
    
    if (data.error) {
      throw new Error(data.error);
    }
    
    if (!data.response) {
      throw new Error("Empty response from evaluation API");
    }
    
    // Parse the evaluation to check if it has an ideal response
    const parsedEval = parseEvaluationResponse(data.response);
    
    // If no ideal response is found, we might want to request one separately
    if (!parsedEval.idealResponse && parsedEval.score > 0) {
      console.log("No ideal response found in evaluation, will generate one");
      
      try {
        // We'll add an additional request to get an ideal answer example
        const idealFormData = createFormData({
          category,
          requestType: "idealAnswer",
          // Include the original question from the most recent assistant's message
          originalQuestion: messages.find(m => m.role === "assistant")?.content || "",
          // Include the user's answer for context
          userAnswer: messages.find(m => m.role === "user")?.content || "",
          // Include score for context
          score: parsedEval.score
        });
        
        const idealResponse = await fetch("/api", {
          method: "POST",
          body: idealFormData,
        }).then(res => res.json());
        
        if (idealResponse && idealResponse.response) {
          // Append the ideal response to our evaluation
          return data.response + "\n\n### Ideal Response\n" + idealResponse.response;
        }
      } catch (idealError) {
        console.error("Error getting ideal response:", idealError);
        // Continue with the original evaluation if we fail to get an ideal response
      }
    }
    
    return data.response;
  } catch (error) {
    console.error("Error evaluating answer:", error);
    return null;
  }
}

async function playAudioData(audioData: string): Promise<void> {
  if (!audioElementRef.current) {
    console.error("Audio element not initialized");
    return;
  }
  
  try {
    console.log("Playing audio data...");
    
    audioElementRef.current.src = audioData;
    
    // Try to play audio
    try {
      await audioElementRef.current.play();
      console.log("Audio playback started");
    } catch (playError) {
      console.error("Failed to play audio:", playError);
      
      // Fallback to speech synthesis if audio playback fails
      if (state.currentQuestion) {
        console.log("Falling back to speech synthesis");
        speakText(state.currentQuestion);
      }
    }
  } catch (error) {
    console.error("Error setting up audio playback:", error);
    
    // Fallback to speech synthesis
    if (state.currentQuestion) {
      console.log("Falling back to speech synthesis due to setup error");
      speakText(state.currentQuestion);
    }
  }
}

function speakText(text: string): Promise<void> {
  return new Promise((resolve, reject) => {
    console.log("Using speech synthesis to speak text:", text.substring(0, 50) + "...");
    
    // Stop any ongoing speech
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    
    // Create a new speech synthesis utterance
    const utterance = new SpeechSynthesisUtterance(text);
    
    // Try to find a good voice
    if ('speechSynthesis' in window) {
      const voices = window.speechSynthesis.getVoices();
      console.log(`Found ${voices.length} voices`);
      
      // Try to find a good English voice
      const preferredVoices = voices.filter(voice => 
        (voice.lang.startsWith('en') && voice.name.includes('Daniel')) ||
        (voice.lang.startsWith('en') && voice.name.includes('Google')) ||
        (voice.lang.startsWith('en') && voice.name.includes('Samantha')) ||
        (voice.lang.startsWith('en') && !voice.name.includes('Zira'))
      );
      
      if (preferredVoices.length > 0) {
        console.log("Using preferred voice:", preferredVoices[0].name);
        utterance.voice = preferredVoices[0];
      } else if (voices.length > 0) {
        // Use the first available voice if no preferred voice is found
        console.log("Using default voice:", voices[0].name);
        utterance.voice = voices[0];
      }
    }
    
    // Set properties
    utterance.rate = 1.0; // Normal speed
    utterance.pitch = 1.0; // Normal pitch
    utterance.volume = 1.0; // Full volume
    
    // Add event listeners
    utterance.onend = () => {
      console.log("Speech synthesis finished");
      
      // Update state to answering when speech is done
      setState(prevState => ({
        ...prevState,
        currentStep: "answering"
      }));
      
      toast.info("You can now provide your answer");
      resolve();
    };
    
    utterance.onerror = (event) => {
      console.error("Speech synthesis error:", event);
      
      // Still update state even if there was an error
      setState(prevState => ({
        ...prevState,
        currentStep: "answering"
      }));
      
      toast.info("You can now provide your answer");
      reject(new Error("Speech synthesis failed"));
    };
    
    // Speak the text
    if ('speechSynthesis' in window) {
      window.speechSynthesis.speak(utterance);
      console.log("Speech synthesis started");
    } else {
      console.error("Speech synthesis not supported");
      
      // Still update state even if speech synthesis is not supported
      setState(prevState => ({
        ...prevState,
        currentStep: "answering"
      }));
      
      toast.info("You can now provide your answer");
      reject(new Error("Speech synthesis not supported"));
    }
  });
}

// Add recording functionality
const startRecording = () => {
  // Implemented in a separate edit
};

const stopRecording = async () => {
  // Implemented in a separate edit
};

// Add a function to ask for a new question
const askNewQuestion = async () => {
  if (!state.category) return;
  
  setState(prevState => ({
    ...prevState,
    isLoading: true,
    currentStep: "question"
  }));
  
  toast.loading("Getting next question...");
  
  try {
    const { questionText, audioData, hints, difficulty } = await fetchQuestion(state.category);
    
    toast.dismiss();
    toast.success("New question received!");
    
    // Update state with the new question
    setState(prevState => ({
      ...prevState,
      isLoading: false,
      currentQuestion: questionText,
      messages: [
        ...prevState.messages,
        { role: "assistant", content: questionText }
      ],
      hints,
      difficulty
    }));
    
    // If voice mode is enabled, play the question audio
    if (state.voiceModeEnabled && audioData) {
      await playAudioData(audioData);
    } else if (state.voiceModeEnabled) {
      await speakText(questionText);
    } else {
      setState(prevState => ({
        ...prevState,
        currentStep: "input"
      }));
    }
  } catch (error: any) {
    console.error("Error fetching new question:", error);
    toast.dismiss();
    toast.error(`Failed to get new question: ${error.message || "Unknown error"}`);
    
    setState(prevState => ({
      ...prevState,
      isLoading: false,
      currentStep: "idle"
    }));
  }
};

// Function to reset the interview state
function resetInterview() {
  setState({
    category: null,
    isActive: false,
    currentStep: "idle",
    messages: [],
    isLoading: false,
    currentQuestion: "",
    textInput: "",
    voiceModeEnabled: state.voiceModeEnabled, // preserve the voice mode setting
    hints: [],
  });
  
  // Navigate back to the category selection
  router.push('/problems');
} 