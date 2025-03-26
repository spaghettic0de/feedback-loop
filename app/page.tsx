"use client";

import React, { useState, useRef, useEffect } from "react";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";
import rehypeRaw from "rehype-raw";
import rehypeSanitize from "rehype-sanitize";
import rehypeHighlight from "rehype-highlight";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { CATEGORIES } from "@/lib/types";

// Define custom components for ReactMarkdown
const MarkdownComponents = {
	code({ node, inline, className, children, ...props }: any) {
		const match = /language-(\w+)/.exec(className || '');
		const language = match ? match[1] : '';
		const content = String(children).replace(/\n$/, '');
		
		// Simple approach: If it's inline or doesn't have a language, render as inline code
		if (inline || !match) {
			// This is inline code
			return (
				<code className="inline-code" {...props}>
					{content}
				</code>
			);
		}
		
		// Otherwise, it's a code block with a specified language
		return (
			<pre className={`${className || ''} overflow-auto rounded-md p-3 bg-gray-100 dark:bg-gray-800`}>
				<code className={language ? `language-${language}` : ''} {...props}>
					{children}
				</code>
			</pre>
		);
	},
	// Add better styling for tables
	table({ children }: any) {
		return (
			<div className="overflow-x-auto my-4">
				<table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700 border border-gray-200 dark:border-gray-700 rounded-md">
					{children}
				</table>
			</div>
		);
	},
	th({ children }: any) {
		return (
			<th className="px-4 py-3 bg-gray-50 dark:bg-gray-800 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
				{children}
			</th>
		);
	},
	td({ children }: any) {
		return (
			<td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100 border-t border-gray-200 dark:border-gray-700">
				{children}
			</td>
		);
	}
};

// Sample questions for each category
const SAMPLE_QUESTIONS: Record<string, string[]> = {
	algorithms: [
		"Explain how a binary search works and its time complexity.",
		"How would you implement a queue using two stacks?",
		"Describe the difference between a linked list and an array."
	],
	system_design: [
		"How would you handle 100,000,000,000 file updates?",
		"How would you design a system to store 100TB of data?",
		"Design a URL shortening service like bit.ly."
	],
	networking: [
		"What's the difference between TCP and UDP?",
		"Explain how DNS resolution works.",
		"Describe the OSI model layers."
	],
	os: [
		"Explain the difference between a process and a thread.",
		"How does virtual memory work?",
		"What is a deadlock and how can it be prevented?"
	],
	concurrency: [
		"What's the difference between a mutex and a semaphore?",
		"Explain deadlocks and how to prevent them.",
		"What is the difference between a process and a thread?"
	],
	databases: [
		"NoSQL vs SQL databases - when would you use each?",
		"Explain database indexing and its importance.",
		"What are ACID properties in databases?"
	],
	web: [
		"Explain the difference between cookies and local storage.",
		"What happens when you type a URL in the browser and press Enter?",
		"Describe the difference between REST and GraphQL."
	],
	devops: [
		"What are the differences between containers and VMs?",
		"Explain the concept of infrastructure as code.",
		"How does CI/CD improve the software development process?"
	],
	security: [
		"What is cross-site scripting (XSS) and how can it be prevented?",
		"Explain the concept of defense in depth.",
		"What is the difference between authentication and authorization?"
	],
};

type Message = {
	role: "user" | "assistant";
	content: string;
};

type Hint = {
	text: string;
	visible: boolean;
};

type InterviewState = {
	category: string | null;
	isActive: boolean;
	currentStep: "idle" | "question" | "answering" | "recording" | "evaluating" | "input";
	messages: Message[];
	isLoading: boolean;
	currentQuestion: string;
	textInput: string;
	voiceModeEnabled: boolean;
	hints: Hint[];
};

// API response types
type ApiQuestionResponseStructured = {
	question: string;
	hints: string[];
};

type ApiQuestionResponse = {
	response: string;
	structuredContent?: ApiQuestionResponseStructured;
	audioData?: string;
	error?: string;
};

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

// Difficulty badge component
const DifficultyBadge = ({ difficulty }: { difficulty: "easy" | "medium" | "hard" }) => {
	const colors = {
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

export default function Home() {
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
	const router = useRouter();

	// Refs for audio handling
	const mediaRecorderRef = useRef<MediaRecorder | null>(null);
	const audioChunksRef = useRef<BlobPart[]>([]);
	const audioElementRef = useRef<HTMLAudioElement | null>(null);
	const messagesEndRef = useRef<HTMLDivElement>(null);

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

	// Function to request audio permission
	async function requestAudioPermission() {
		console.log("Requesting audio permission...");
		toast.info("Please allow microphone access when prompted");
		
		try {
			// Request microphone access
			const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
			
			console.log("Microphone permission granted!");
			
			// Play a silent sound to unlock audio on iOS/Safari
			try {
				const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
				const source = audioContext.createBufferSource();
				source.connect(audioContext.destination);
				source.start(0);
				source.stop(0.001);
				console.log("Audio context unlocked");
			} catch (audioContextError) {
				console.warn("Could not unlock audio context:", audioContextError);
			}
			
			// Stop tracks after permission is granted
			stream.getTracks().forEach(track => track.stop());
			
			setAudioPermissionGranted(true);
			toast.success("Microphone access granted!");
			
			return true;
		} catch (error: any) {
			console.error("Error requesting audio permission:", error);
			
			// Check for specific permission denied error
			if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
				toast.error("Microphone access denied. Please allow microphone access in your browser settings and try again.");
			} else if (error.name === 'NotFoundError' || error.name === 'DevicesNotFoundError') {
				toast.error("No microphone detected. Please connect a microphone and try again.");
			} else {
				toast.error(`Microphone access error: ${error.message || "Unknown error"}`);
			}
			
			setAudioPermissionGranted(false);
			return false;
		}
	}

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
			// Add the user's answer to messages
			const userAnswer = state.textInput.trim();
			const updatedMessages: Message[] = [
				...state.messages,
				{ role: "user" as const, content: userAnswer }
			];
			
			// Update messages with the user input
			setState(prev => ({
				...prev,
				messages: updatedMessages,
				textInput: "", // Clear the input after submission
			}));
			
			// Evaluate the answer
			if (state.category) {
				console.log("Evaluating answer for category:", state.category);
				const evaluation = await evaluateAnswer(state.category, updatedMessages);
				
				if (evaluation) {
					console.log("Evaluation received, updating state to idle");
					// Add the evaluation to messages
					setState(prev => ({
						...prev,
						isLoading: false,
						currentStep: "idle",
						messages: [
							...prev.messages,
							{ role: "user" as const, content: userAnswer },
							{ role: "assistant" as const, content: evaluation }
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
				setState(prev => ({ ...prev, voiceModeEnabled: false }));
			}
		}
		
		// Show loading toast
		const loadingToastId = toast.loading("Starting interview...");
		
		try {
			setState(prev => ({
				...prev,
				category: categoryId,
				isActive: true,
				isLoading: true,
				currentStep: "question",
				messages: []
			}));

			console.log("Fetching first question...");
			const { questionText, audioData, hints } = await fetchQuestion(categoryId);
			
			// Dismiss loading toast and show success
			toast.dismiss(loadingToastId);
			toast.success("Interview started!");
			
			// Update messages with welcome message and first question
			setState(prev => ({
				...prev,
				isLoading: false,
				currentQuestion: questionText,
				messages: [
					{
						role: "assistant",
						content: questionText
					}
				],
				hints
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
				setState(prev => ({
					...prev, 
					currentStep: "input"
				}));
			}
		} catch (error: any) {
			console.error("Error starting interview:", error);
			toast.dismiss(loadingToastId);
			toast.error(`Failed to start interview: ${error.message || "Unknown error"}`);
			// Reset to selection state if there was an error
			setState(prev => ({
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

	// Fetch a question from our API
	async function fetchQuestion(category: string): Promise<{
		questionText: string;
		audioData?: string | null;
		hints: Hint[];
	}> {
		console.log(`Fetching question for category: ${category}, voice mode: ${state.voiceModeEnabled}`);
		setState(prev => ({ ...prev, isLoading: true }));
		
		const controller = new AbortController();
		const timeoutId = setTimeout(() => {
			controller.abort();
		}, 15000); // 15 second timeout
		
		try {
			// Create form data directly instead of using helper function
			const formData = new FormData();
			formData.append("category", category);
			formData.append("requestType", "question");
			formData.append("generateAudio", state.voiceModeEnabled ? "true" : "false");
			
			// No need to append messages for a new question
			// But if we had messages, we would need to append each one individually
			
			// Debug: Log form data entries
			console.log("Form data entries being sent:");
			for (let [key, value] of formData.entries()) {
				console.log(`${key}: ${typeof value === 'object' ? 'File or Object' : value}`);
			}
			
			console.log("Making API request...");
			const response = await fetch("/api", {
				method: "POST",
				body: formData,
				signal: controller.signal,
			});
			
			clearTimeout(timeoutId);
			
			if (!response.ok) {
				let errorText = "";
				try {
					const errorData = await response.json();
					errorText = JSON.stringify(errorData);
				} catch {
					errorText = await response.text();
				}
				console.error(`API returned error status ${response.status}: ${errorText}`);
				throw new Error(`API request failed with status ${response.status}: ${errorText}`);
			}
			
			const responseData = await response.json() as ApiQuestionResponse;
			console.log("API response received:", responseData);
			
			// Check if there's an error message from the API
			if (responseData.error) {
				console.error("API returned error:", responseData.error);
				toast.error(`API error: ${responseData.error}`);
				throw new Error(`API error: ${responseData.error}`);
			}
			
			if (!responseData.response) {
				console.error("API response missing question text");
				throw new Error("API response missing question text");
			}
			
			// If we have structured content, use it
			if (responseData.structuredContent) {
				const { question, hints } = responseData.structuredContent;
				console.log("Using structured content:", question);
				console.log("Structured hints:", hints);
				
				// Convert hints to the expected format
				const formattedHints = hints.map((text: string) => ({
					text,
					visible: false
				}));
				
				return {
					questionText: question,
					audioData: responseData.audioData,
					hints: formattedHints
				};
			}
			
			// Fallback to parsing from the raw response if structured content is not available
			const rawResponse = responseData.response;
			console.log("Raw response:", rawResponse);
			
			try {
				// Try to parse as JSON first (in case it's actually JSON but not parsed by the server)
				const jsonData = JSON.parse(rawResponse);
				if (jsonData && jsonData.question && Array.isArray(jsonData.hints)) {
					console.log("Parsed JSON from raw response:", jsonData);
					return {
						questionText: jsonData.question,
						audioData: responseData.audioData,
						hints: jsonData.hints.map((text: string) => ({ text, visible: false }))
					};
				}
			} catch (e) {
				// Not JSON, proceed with regex parsing
				console.log("Raw response is not JSON, using regex parsing");
			}
			
			// Extract question and hints using regex without 's' flag
			const questionMatch = rawResponse.match(/Question:\s*([\s\S]*?)(?=Hint1:|$)/);
			const hint1Match = rawResponse.match(/Hint1:\s*([\s\S]*?)(?=Hint2:|$)/);
			const hint2Match = rawResponse.match(/Hint2:\s*([\s\S]*?)(?=Hint3:|$)/);
			const hint3Match = rawResponse.match(/Hint3:\s*([\s\S]*?)(?=$)/);
			
			// Get the question text, fallback to the whole response if parsing fails
			const questionText = questionMatch ? questionMatch[1].trim() : rawResponse;
			
			// Create hints array
			const hints = [
				hint1Match ? { text: hint1Match[1].trim(), visible: false } : null,
				hint2Match ? { text: hint2Match[1].trim(), visible: false } : null,
				hint3Match ? { text: hint3Match[1].trim(), visible: false } : null,
			].filter(Boolean) as Hint[];
			
			console.log("Parsed question:", questionText);
			console.log("Parsed hints:", hints);
			
			return {
				questionText,
				audioData: responseData.audioData, // This will be null if generateAudio was false
				hints
			};
		} catch (fetchError: any) {
			console.error("Error fetching question:", fetchError);
			toast.error(`Failed to fetch question: ${fetchError.message || "Unknown error"}`);
			throw fetchError;
		} finally {
			clearTimeout(timeoutId);
			setState(prev => ({ ...prev, isLoading: false }));
		}
	}

	// Play audio data from Cartesia
	function playAudioData(audioData: string) {
		// Check if audio element exists
		if (!audioElementRef.current) {
			console.error("Audio element not available");
			speakText(state.currentQuestion);
			return;
		}
		
		try {
			console.log("Starting audio playback, setting question state");
			setState(prev => ({ ...prev, currentStep: "question" }));
			
			// Check if the audio data is valid
			if (!audioData || !audioData.startsWith('data:audio')) {
				console.error("Invalid audio data format:", audioData?.substring(0, 30) + "...");
				throw new Error("Invalid audio data");
			}
			
			// Force a state reset on the audio element
			audioElementRef.current.pause();
			audioElementRef.current.currentTime = 0;
			
			// Set up error handling before setting the source
			const errorHandler = (err: Event) => {
				console.error("Audio error event:", err);
				// Remove the error listener to prevent duplicate fallbacks
				audioElementRef.current?.removeEventListener('error', errorHandler);
				// Fallback to browser TTS
				console.log("Falling back to speech synthesis due to audio error");
				speakText(state.currentQuestion);
			};
			
			// Add error event listener
			audioElementRef.current.addEventListener('error', errorHandler, { once: true });
			
			// Set new audio source
			audioElementRef.current.src = audioData;
			
			console.log("Audio source set, preparing to play after delay");
			
			// Add a delay before playing to ensure the state update has taken effect
			setTimeout(() => {
				if (audioElementRef.current) {
					console.log("Playing audio after delay");
					
					try {
						const playPromise = audioElementRef.current.play();
						
						if (playPromise !== undefined) {
							playPromise.catch(err => {
								console.error("Audio play promise rejected:", err);
								// Remove the error listener since we're handling it here
								audioElementRef.current?.removeEventListener('error', errorHandler);
								// Fallback to browser TTS
								speakText(state.currentQuestion);
							});
						}
					} catch (playError) {
						console.error("Error during play() call:", playError);
						// Fallback to browser TTS
						audioElementRef.current.removeEventListener('error', errorHandler);
						speakText(state.currentQuestion);
					}
				}
			}, 300); // Increased delay for better reliability
		} catch (error) {
			console.error("Error in playAudioData:", error);
			// Fallback to browser TTS
			speakText(state.currentQuestion);
		}
	}

	// Evaluate an answer using our API
	async function evaluateAnswer(category: string, messages: Message[]) {
		setState(prev => ({ ...prev, isLoading: true, currentStep: "evaluating" }));
		
		try {
			// Create form data directly
			const formData = new FormData();
			formData.append("category", category);
			formData.append("requestType", "evaluate");
			
			// Add messages to context - each as a separate entry
			messages.forEach((message) => {
				formData.append("messages", JSON.stringify(message));
			});
			
			console.log("Sending evaluation request with messages:", messages.length);
			
			const response = await fetch("/api", {
				method: "POST",
				body: formData,
			});
			
			if (!response.ok) {
				let errorText = "";
				try {
					const errorData = await response.json();
					errorText = JSON.stringify(errorData);
				} catch {
					errorText = await response.text();
				}
				console.error(`API returned error status ${response.status}: ${errorText}`);
				throw new Error(`API evaluation request failed: ${errorText}`);
			}
			
			const data = await response.json();
			
			if (!data.response) {
				console.error("API response missing evaluation text");
				throw new Error("API response missing evaluation");
			}
			
			return data.response;
		} catch (error) {
			console.error("Error evaluating answer:", error);
			toast.error("Failed to evaluate your answer. Please try again.");
			return null;
		} finally {
			setState(prev => ({ ...prev, isLoading: false }));
		}
	}

	// Transcribe audio using our API
	async function transcribeAudio(audioBlob: Blob) {
		console.log("Transcribing audio with size:", audioBlob.size, "bytes");
		
		try {
			// Create form data directly
			const formData = new FormData();
			formData.append("category", state.category || "");
			formData.append("requestType", "audio");
			formData.append("audioData", audioBlob, "recording.webm");
			
			// Add timestamp to help debugging
			console.log("Sending audio to transcription API at", new Date().toISOString());
			
			// Set a 30 second timeout for transcription
			const controller = new AbortController();
			const timeoutId = setTimeout(() => controller.abort(), 30000);
			
			const response = await fetch("/api", {
				method: "POST",
				body: formData,
				signal: controller.signal
			});
			
			clearTimeout(timeoutId);
			
			if (!response.ok) {
				let errorText = "";
				try {
					const errorData = await response.json();
					errorText = JSON.stringify(errorData);
				} catch {
					errorText = await response.text();
				}
				console.error(`Transcription API error (${response.status}):`, errorText);
				throw new Error(`Transcription failed with status ${response.status}: ${errorText}`);
			}
			
			const data = await response.json();
			
			if (!data.transcript) {
				console.error("Transcription API response missing transcript:", data);
				
				if (data.error) {
					throw new Error(`Transcription error: ${data.error}`);
				} else {
					throw new Error("Transcription returned empty result");
				}
			}
			
			console.log("Transcription successful, length:", data.transcript.length, 
				"characters, preview:", data.transcript.substring(0, 50) + "...");
			return data.transcript;
		} catch (error: any) {
			// Check for abort error specifically
			if (error.name === 'AbortError') {
				console.error("Transcription timed out after 30 seconds");
				toast.error("Transcription timed out. The server might be busy, please try again.");
			} else {
				console.error("Error transcribing audio:", error);
				toast.error(`Failed to transcribe your answer: ${error.message || "Unknown error"}`);
			}
			return null;
		}
	}

	// Use text-to-speech to speak text (browser fallback)
	function speakText(text: string) {
		// Fallback to browser's built-in speech synthesis if Cartesia TTS fails
		if ('speechSynthesis' in window) {
			console.log("Starting speech synthesis, setting question state");
			setState(prev => ({ ...prev, currentStep: "question" }));
			
			// Create a new utterance
			const utterance = new SpeechSynthesisUtterance(text);
			
			// Optional: Improve voice quality if available
			const voices = window.speechSynthesis.getVoices();
			const preferredVoice = voices.find(voice => 
				voice.lang.includes('en') && (voice.name.includes('Google') || voice.name.includes('Natural'))
			);
			
			if (preferredVoice) {
				console.log("Using preferred voice:", preferredVoice.name);
				utterance.voice = preferredVoice;
			}
			
			// Set a reasonable speech rate
			utterance.rate = 1.0; // Normal speed
			utterance.pitch = 1.0; // Normal pitch
			
			// Handle speech end event
			utterance.onend = () => {
				console.log("Speech synthesis ended, transitioning to answering state");
				setState(prev => ({
					...prev,
					currentStep: "answering"
				}));
				toast.info("You can now record your answer");
			};
			
			// Handle error in speech synthesis
			utterance.onerror = (err) => {
				console.error("Speech synthesis error:", err);
				// Force transition to answering state
				setState(prev => ({
					...prev,
					currentStep: "answering"
				}));
				toast.info("Question playback finished. You can now record your answer.");
			};
			
			// Make sure any previous speech is cancelled
			window.speechSynthesis.cancel();
			
			// Wait a moment before starting speech
			setTimeout(() => {
				console.log("Speaking text:", text.substring(0, 50) + "...");
				window.speechSynthesis.speak(utterance);
			}, 100);
			
			return Promise.resolve();
		} else {
			// Fallback for browsers without speech synthesis
			console.warn("Speech synthesis not available in browser");
			toast.info("Text-to-speech not available in your browser. Please read the question.");
			
			// Force transition to answering state after a delay
			setTimeout(() => {
				console.log("No speech synthesis available, forcing transition to answering state");
				setState(prev => ({
					...prev,
					currentStep: "answering"
				}));
			}, 2000);
			return Promise.resolve();
		}
	}

	// Start recording the user's answer
	function startRecording() {
		console.log("Starting recording process...");
		
		// Check if we have microphone permission first
		if (audioPermissionGranted !== true) {
			console.log("No microphone permission, requesting first");
			toast.loading("Checking microphone permission...");
			
			requestAudioPermission().then(permissionGranted => {
				toast.dismiss();
				
				if (permissionGranted) {
					// Permission granted, now we can start recording
					console.log("Permission granted, now starting recording");
					initiateRecording();
				} else {
					console.log("Permission denied, cannot record");
					toast.error("Microphone access is required to record your answer");
				}
			});
		} else {
			// Already have permission, just start recording
			initiateRecording();
		}
	}
	
	// Actual recording initialization function
	function initiateRecording() {
		if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
			toast.loading("Initializing microphone...");
			
			navigator.mediaDevices.getUserMedia({ audio: true })
				.then(stream => {
					toast.dismiss();
					
					// Setup recorder options with highest quality
					const options = { 
						audioBitsPerSecond: 128000,
						mimeType: 'audio/webm;codecs=opus'
					};
					
					try {
						const mediaRecorder = new MediaRecorder(stream, options);
						mediaRecorderRef.current = mediaRecorder;
						audioChunksRef.current = [];
						
						mediaRecorder.ondataavailable = (e) => {
							if (e.data.size > 0) {
								audioChunksRef.current.push(e.data);
							}
						};
						
						// Set a maximum recording time (2 minutes)
						const maxRecordingTime = 2 * 60 * 1000;
						const recordingTimeout = setTimeout(() => {
							if (mediaRecorderRef.current?.state === "recording") {
								console.log("Max recording time reached, stopping automatically");
								toast.info("Maximum recording time reached");
								stopRecording();
							}
						}, maxRecordingTime);
						
						// Store timeout in a ref to clear it if stopped manually
						const timeoutRef = { current: recordingTimeout };
						
						// Override the onstop to clear the timeout
						const originalOnStop = mediaRecorder.onstop;
						mediaRecorder.onstop = (e) => {
							clearTimeout(timeoutRef.current);
							if (originalOnStop) originalOnStop.call(mediaRecorder, e);
						};
						
						// Start recording with small time slices to get data more frequently
						mediaRecorder.start(1000);
						
						setState(prev => ({
							...prev,
							currentStep: "recording"
						}));
						
						toast.success("Recording started. Click Stop when you've finished your answer.");
					} catch (recorderError) {
						console.error("Error creating MediaRecorder:", recorderError);
						toast.error("Could not start recording. Your browser may not support the required audio format.");
						
						// Release stream
						stream.getTracks().forEach(track => track.stop());
					}
				})
				.catch(error => {
					toast.dismiss();
					console.error("Error accessing microphone:", error);
					
					if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
						toast.error("Microphone access was denied. Please allow access in your browser settings.");
						setAudioPermissionGranted(false);
					} else if (error.name === 'NotFoundError' || error.name === 'DevicesNotFoundError') {
						toast.error("No microphone detected. Please connect a microphone and try again.");
					} else {
						toast.error(`Could not access microphone: ${error.message || "Unknown error"}`);
					}
				});
		} else {
			toast.error("Audio recording is not supported in your browser.");
		}
	}

	// Stop recording and process the answer
	async function stopRecording() {
		if (!mediaRecorderRef.current || state.currentStep !== "recording") {
			console.log("No active recording to stop");
			return;
		}
		
		console.log("Stopping recording...");
		
		// Set evaluating state immediately
		setState(prev => ({
			...prev,
			isLoading: true,
			currentStep: "evaluating"
		}));
		
		toast.loading("Processing your answer...");
		
		// Check if there is an active recording
		if (mediaRecorderRef.current.state === "recording") {
			mediaRecorderRef.current.stop();
		} else {
			console.log("MediaRecorder was not in recording state:", mediaRecorderRef.current.state);
		}
		
		mediaRecorderRef.current.onstop = async () => {
			try {
				console.log("Recording stopped, creating blob and transcribing");
				
				// Check if we captured any audio
				if (audioChunksRef.current.length === 0) {
					console.error("No audio data captured");
					toast.dismiss();
					toast.error("No audio was captured. Please try recording again.");
					
					setState(prev => ({
						...prev,
						isLoading: false,
						currentStep: "answering"
					}));
					return;
				}
				
				// Create audio blob
				const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
				
				// Check if the blob size is too small (likely no actual audio)
				if (audioBlob.size < 1000) {
					console.error("Audio recording too small, likely no speech detected:", audioBlob.size, "bytes");
					toast.dismiss();
					toast.error("No speech detected in recording. Please try again and speak clearly.");
					
					setState(prev => ({
						...prev,
						isLoading: false,
						currentStep: "answering"
					}));
					return;
				}
				
				// Transcribe the audio
				const transcript = await transcribeAudio(audioBlob);
				console.log("Transcription received:", transcript ? "success" : "failed");
				
				toast.dismiss();
				
				if (transcript) {
					// Add the user's answer to messages
					const updatedMessages: Message[] = [
						...state.messages,
						{ role: "user" as const, content: transcript }
					];
					
					// Update messages with the transcription
					setState(prev => ({
						...prev,
						messages: updatedMessages,
					}));
					
					// Evaluate the answer
					if (state.category) {
						console.log("Evaluating answer for category:", state.category);
						const evaluation = await evaluateAnswer(state.category, updatedMessages);
						
						if (evaluation) {
							console.log("Evaluation received, updating state to idle");
							// Add the evaluation to messages
							setState(prev => ({
								...prev,
								isLoading: false,
								currentStep: "idle",
								messages: [
									...prev.messages,
									{ role: "user" as const, content: transcript },
									{ role: "assistant" as const, content: evaluation }
								]
							}));
						} else {
							// Handle evaluation failure
							console.log("Evaluation failed, resetting to answering state");
							setState(prev => ({
								...prev,
								isLoading: false,
								currentStep: "answering"
							}));
						}
					}
				} else {
					// Handle transcription failure
					console.log("Transcription failed, resetting to answering state");
					setState(prev => ({
						...prev,
						isLoading: false,
						currentStep: "answering"
					}));
				}
			} catch (error) {
				console.error("Error processing recording:", error);
				toast.error("Error processing your answer. Please try again.");
				setState(prev => ({
					...prev,
					isLoading: false,
					currentStep: "answering"
				}));
			}
			
			// Release media stream
			mediaRecorderRef.current?.stream.getTracks().forEach(track => track.stop());
		};
	}

	// Ask a new question - modified to handle voice/text modes
	const askNewQuestion = async () => {
		console.log("Asking new question...");
		
		// Show loading toast
		const loadingToastId = toast.loading("Generating new question...");
		
		try {
			// Fetch a new question from the API
			const { questionText, audioData, hints } = await fetchQuestion(state.category || "");
			
			// Dismiss loading toast and show success
			toast.dismiss(loadingToastId);
			toast.success("New question ready!");
			
			// Add the new question to messages
			setState(prev => ({
				...prev,
				currentStep: "question",
				currentQuestion: questionText,
				messages: [...prev.messages, { role: "assistant", content: questionText }],
				hints: hints || []
			}));
			
			// If voice mode is enabled, play the question audio
			if (state.voiceModeEnabled && audioData) {
				console.log("Playing audio question...");
				await playAudioData(audioData);
			} else if (state.voiceModeEnabled) {
				console.log("No audio data, using speech synthesis...");
				await speakText(questionText);
			} else {
				console.log("Voice mode disabled, setting state to input mode");
				setState(prev => ({ 
					...prev, 
					currentStep: "input" 
				}));
			}
		} catch (error: any) {
			console.error("Error asking new question:", error);
			toast.dismiss(loadingToastId);
			toast.error(`Failed to get new question: ${error.message || "Unknown error"}`);
		}
	};

	// Reset the interview
	function resetInterview() {
		// Stop any ongoing recording
		if (state.currentStep === "recording" && mediaRecorderRef.current) {
			mediaRecorderRef.current.stop();
			mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
		}
		
		// Stop any ongoing speech
		if (audioElementRef.current) {
			audioElementRef.current.pause();
		}
		
		if ('speechSynthesis' in window) {
			window.speechSynthesis.cancel();
		}
		
		setState({
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
	}

	// Toggle hint visibility
	const toggleHintVisibility = (index: number) => {
		setState(prev => ({
			...prev,
			hints: prev.hints.map((hint, i) => 
				i === index ? { ...hint, visible: !hint.visible } : hint
			)
		}));
	};

	// Component to display hints in an accordion-style UI
	const HintsAccordion = ({ hints }: { hints: Hint[] }) => {
		if (!hints || hints.length === 0) return null;
		
		return (
			<div className="mt-3">
				<h4 className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">Need a hint?</h4>
				<div className="space-y-1">
					{hints.map((hint, index) => (
						<div 
							key={index} 
							className="overflow-hidden"
						>
							<button
								onClick={() => toggleHintVisibility(index)}
								className="w-full text-left py-1 flex items-center text-gray-600 dark:text-gray-400 text-xs hover:text-gray-900 dark:hover:text-gray-300 transition-colors"
							>
								<div className="flex-shrink-0 w-4 h-4 flex items-center justify-center">
									<svg
										xmlns="http://www.w3.org/2000/svg"
										width="10"
										height="10"
										viewBox="0 0 24 24"
										fill="none"
										stroke="currentColor"
										strokeWidth="2.5"
										strokeLinecap="round"
										strokeLinejoin="round"
										className={`transition-transform ${hint.visible ? "transform rotate-90" : ""}`}
									>
										<polyline points="9 18 15 12 9 6"></polyline>
									</svg>
								</div>
								<span className="font-medium ml-1">
									Hint {index + 1}
								</span>
							</button>
							
							{hint.visible && (
								<div className="pl-5 pr-2 pb-2 text-xs text-gray-600 dark:text-gray-400">
									<div className="prose prose-sm prose-gray dark:prose-invert max-w-none">
										<ReactMarkdown 
											rehypePlugins={[rehypeRaw, rehypeSanitize, rehypeHighlight]}
											components={MarkdownComponents}
										>
											{hint.text}
										</ReactMarkdown>
									</div>
								</div>
							)}
						</div>
					))}
				</div>
			</div>
		);
	};

	const formatQuestionWithMarkdown = (text: string): string => {
		if (!text) return "";
		
		// Only apply minimal formatting for terms in single quotes
		return text.replace(/(?<![`\\])['']([a-zA-Z0-9_\.]+)[''](?![`])/g, '`$1`');
	};

	// Function to start a new interview
	const startNewInterview = () => {
		const newId = crypto.randomUUID();
		router.push(`/problems/${newId}`);
	};

	return (
		<div className="min-h-screen bg-white dark:bg-gray-950">
			<main className="max-w-6xl mx-auto px-6 py-12">
				<div className="text-center mb-12">
					<h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-4">
						feedback.loop
					</h1>
					<p className="text-xl text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
						Prepare for technical interviews with AI-powered practice questions and feedback
					</p>
					<div className="mt-8">
						<Button 
							onClick={startNewInterview}
							size="lg"
							className="px-8"
						>
							Start New Practice
						</Button>
					</div>
				</div>
				
				<div className="mt-16">
					<h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-6">
						Practice by Category
					</h2>
					
					<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
						{CATEGORIES.map((category) => {
							// Assign a difficulty level to each category
							// This is just for demonstration - in a real app, you might want to fetch this data
							const getDifficulty = (id: string): "easy" | "medium" | "hard" => {
								const mapping: Record<string, "easy" | "medium" | "hard"> = {
									"algorithms": "hard",
									"system_design": "hard",
									"networking": "medium",
									"databases": "medium",
									"os": "medium",
									"concurrency": "hard",
									"web": "easy",
									"devops": "medium",
									"security": "hard"
								};
								return mapping[id] || "medium";
							};
							
							const difficulty = getDifficulty(category.id);
							
							return (
								<Link 
									href={`/problems/${crypto.randomUUID()}?category=${category.id}`}
									key={category.id}
									className="block group p-6 bg-gray-50 dark:bg-gray-900 rounded-xl hover:shadow-md transition-all duration-200"
								>
									<div className="flex justify-between items-start mb-3">
										<h3 className="font-medium text-lg text-gray-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
											{category.name}
										</h3>
										<DifficultyBadge difficulty={difficulty} />
									</div>
									<p className="text-sm text-gray-600 dark:text-gray-400">
										{getCategoryDescription(category.id)}
									</p>
								</Link>
							);
						})}
					</div>
				</div>
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
