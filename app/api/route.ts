import Groq from "groq-sdk";
import { z } from "zod";
import { zfd } from "zod-form-data";

const groq = new Groq();

// Define the schema for our API requests
const schema = zfd.formData({
	category: zfd.text(),
	messages: zfd
		.repeatableOfType(
			zfd.text().transform((text) => {
				try {
					return JSON.parse(text);
				} catch (e) {
					console.error("Failed to parse message JSON:", text);
					return null;
				}
			})
		)
		.optional()
		.default([]),
	requestType: z.enum(["question", "evaluate", "audio"]).optional().default("question"),
	audioData: zfd.file().optional(),
	generateAudio: zfd.text().optional().default("false"),
});

export async function POST(request: Request) {
	console.log("API route handler called");
	
	try {
		// Parse the request
		const formData = await request.formData();
		console.log("Form data keys received:", [...formData.keys()]);
		
		// Debug: Check each form data value
		for (const key of formData.keys()) {
			const values = formData.getAll(key);
			console.log(`Form data key ${key} has ${values.length} value(s)`);
			values.forEach((value, index) => {
				if (typeof value === 'string' && value.length < 500) {
					console.log(`  Value ${index}: ${value}`);
				} else if (typeof value === 'string') {
					console.log(`  Value ${index}: [String of length ${value.length}]`);
				} else if (value instanceof File) {
					console.log(`  Value ${index}: [File: ${value.name}, ${value.size} bytes, ${value.type}]`);
				} else {
					console.log(`  Value ${index}: [${typeof value}]`);
				}
			});
		}
		
		// Create validated data with strict checking disabled for development
		let data: any;
		
		try {
			// Try to use the schema for parsing
			const parseResult = schema.safeParse(formData);
			
			if (!parseResult.success) {
				console.error("Form data validation failed:", parseResult.error);
				console.error("Validation errors:", JSON.stringify(parseResult.error.errors));
				
				// For development purposes, let's try a more lenient approach if schema validation fails
				data = {
					category: formData.get('category')?.toString() || '',
					requestType: formData.get('requestType')?.toString() || 'question',
					generateAudio: formData.get('generateAudio')?.toString() === 'true',
					audioData: formData.get('audioData') as File | null,
					messages: []
				};
				
				// Try to parse messages manually
				const messageEntries = formData.getAll('messages');
				console.log(`Manually processing ${messageEntries.length} message entries`);
				
				if (messageEntries.length > 0) {
					data.messages = messageEntries
						.map((entry) => {
							if (typeof entry === 'string') {
								try {
									const parsed = JSON.parse(entry);
									// Validate it has role and content
									if (parsed && typeof parsed === 'object' && 'role' in parsed && 'content' in parsed) {
										return parsed;
									}
									console.error("Invalid message structure:", parsed);
									return null;
								} catch (err) {
									console.error("Failed to parse message:", entry, err);
									return null;
								}
							} else {
								console.error("Message is not a string:", typeof entry);
								return null;
							}
						})
						.filter(Boolean); // Remove nulls
				}
				
				console.log("Using lenient data parsing approach. Parsed message count:", data.messages.length);
			} else {
				// If schema parse was successful, use that data
				data = parseResult.data;
				console.log("Schema validation succeeded");
			}
		} catch (parseError) {
			console.error("Unhandled error during form data parsing:", parseError);
			return new Response(JSON.stringify({ 
				error: "Invalid request format",
				details: parseError instanceof Error ? parseError.message : "Unknown parsing error" 
			}), { 
				status: 400,
				headers: { "Content-Type": "application/json" }
			});
		}

		// Get values from our parsed data
		const messages = data.messages || [];
		const category = data.category;
		const requestType = data.requestType || "question";
		const generateAudio = data.generateAudio === true || data.generateAudio === "true";
		
		console.log(`Processing ${requestType} request for category: ${category}, generateAudio: ${generateAudio}`);
		console.log("Messages count:", messages.length);

		// Handle audio transcription if audioData is provided
		if (requestType === "audio" && data.audioData) {
			console.log(`Processing audio transcription request, file size: ${data.audioData.size} bytes`);
			
			// Check if file is too small (likely empty or corrupted)
			if (data.audioData.size < 1000) {
				console.error("Audio file too small, likely empty or corrupted:", data.audioData.size, "bytes");
				return new Response(JSON.stringify({ 
					error: "Audio file too small or empty. Please ensure your microphone is working and try again."
				}), { 
					status: 400,
					headers: { "Content-Type": "application/json" }
				});
			}
			
			try {
				console.log("Starting audio transcription with Whisper model");
				
				// Check if GROQ_API_KEY is set
				if (!process.env.GROQ_API_KEY) {
					console.error("GROQ_API_KEY environment variable is not set");
					return new Response(JSON.stringify({ 
						error: "API key configuration error. Transcription service is not properly configured." 
					}), { 
						status: 500,
						headers: { "Content-Type": "application/json" }
					});
				}
				
				// Start timing the transcription
				const transcriptionStart = Date.now();
				
				const { text } = await groq.audio.transcriptions.create({
					file: data.audioData,
					model: "whisper-large-v3",
				});
				
				// Calculate transcription time
				const transcriptionTime = Date.now() - transcriptionStart;
				console.log(`Audio transcription successful in ${transcriptionTime}ms, result length: ${text.length} characters`);
				console.log("Transcription preview:", text.substring(0, 100) + "...");
				
				// Check if the transcription is empty or too short
				if (!text || text.trim().length < 5) {
					console.warn("Transcription result was empty or too short:", text);
					return new Response(JSON.stringify({ 
						error: "No speech detected in the recording. Please speak clearly and try again.",
						transcript: text.trim() // Still include the empty transcript for debugging
					}), { 
						status: 200, // Use 200 so client can handle this gracefully
						headers: { "Content-Type": "application/json" }
					});
				}
				
				return new Response(JSON.stringify({ transcript: text.trim() }), {
					headers: { "Content-Type": "application/json" },
				});
			} catch (error: any) {
				console.error("Error transcribing audio:", error);
				// Include more detailed error information
				const errorInfo = {
					message: error?.message || "Unknown error",
					code: error?.code || "UNKNOWN",
					status: error?.status || 500,
					type: error?.type || "transcription_error",
				};
				console.error("Error details:", JSON.stringify(errorInfo));
				
				return new Response(JSON.stringify({ 
					error: `Failed to transcribe audio: ${errorInfo.message}`,
					errorDetails: errorInfo
				}), { 
					status: 500,
					headers: { "Content-Type": "application/json" }
				});
			}
		}

		// Create system prompt based on category and request type
		let systemPrompt = "";
		
		if (requestType === "evaluate") {
			console.log("Generating evaluation prompt");
			systemPrompt = `You are Cartesia, an expert technical interviewer specializing in ${category}.
			
You're evaluating a candidate's answer to a technical interview question.
Based on their response:
1. Provide a score from 1-5 (where 5 is excellent)
2. Give specific feedback on the strengths of the answer
3. Suggest areas for improvement
4. Add any key points the candidate missed
5. If appropriate, ask a follow-up question to dig deeper

FORMATTING REQUIREMENTS:
- Use proper markdown formatting in your response
- Always use single backticks for:
  - All code elements: \`variable_name\`, \`function()\`, \`SELECT\`
  - All technical values: \`192.168.1.1\`, \`64\`, \`443\`, \`8080\`
  - All database elements: \`users\` table, \`id\` column
  - Any technical terms or keywords
- Only use triple backticks for multi-line code blocks with a language specified:
  \`\`\`sql
  SELECT * FROM users WHERE id = 1;
  \`\`\`
- Use **bold** text for important points and section headings
- Use bullet points for lists where appropriate
- Do not format regular text or sentences with backticks

Be honest but constructive - your goal is to help the candidate improve.`;
		}
		else {
			// Default case: generate a question
			console.log("Generating question prompt");
			systemPrompt = `You are Cartesia, a technical interviewer specializing in ${category}.
			
Generate a realistic interview question about ${category} that would be asked in a technical interview, along with three progressive hints and a difficulty rating.

The question should:
1. Be concise and clear
2. Be challenging but reasonable for a software engineering interview
3. Test both theoretical knowledge and practical application
4. Be specific enough that it can be answered in 1-3 minutes verbally

FORMATTING REQUIREMENTS:
- Use proper markdown formatting in your response
- Always use single backticks for:
  - All code elements: \`variable_name\`, \`function()\`, \`SELECT\`
  - All technical values: \`192.168.1.1\`, \`64\`, \`443\`, \`8080\`
  - All database elements: \`users\` table, \`id\` column
  - Any technical terms or keywords
- Only use triple backticks for multi-line code blocks with a language specified:
  \`\`\`sql
  SELECT * FROM users WHERE id = 1;
  \`\`\`
- Do not format regular text or sentences with backticks

Also provide THREE hints of increasing magnitude:
- Hint 1: A subtle hint that gently guides the user toward the answer
- Hint 2: A more direct hint that clarifies an important concept needed for the answer
- Hint 3: A substantial hint that almost gives away the answer but still requires some thinking

Rate the difficulty of the question as one of:
- "easy": For fundamental concepts and straightforward applications
- "medium": For questions requiring deeper understanding or multiple concepts
- "hard": For complex topics, edge cases, or questions requiring advanced knowledge

IMPORTANT: You MUST respond with a valid JSON object in the following format:
{
  "question": "The interview question text here with proper markdown formatting",
  "hints": [
    "First subtle hint text with proper markdown formatting",
    "Second moderate hint text with proper markdown formatting",
    "Third substantial hint text with proper markdown formatting"
  ],
  "difficulty": "easy|medium|hard"
}

Do not include any additional text, explanations, or markdown formatting outside of this JSON structure.`;
		}

		// Generate the response using Groq
		try {
			console.log("Calling Groq API...");
			
			// Check if GROQ_API_KEY is set
			if (!process.env.GROQ_API_KEY) {
				console.error("GROQ_API_KEY environment variable is not set");
				return new Response(JSON.stringify({ error: "API key configuration error" }), { 
					status: 500,
					headers: { "Content-Type": "application/json" }
				});
			}
			
			const completion = await groq.chat.completions.create({
				model: "llama3-8b-8192",
				messages: [
					{
						role: "system",
						content: systemPrompt,
					},
					...messages,
				],
				response_format: requestType === "question" ? { type: "json_object" } : undefined,
			});

			const response = completion.choices[0].message.content;
			console.log("Groq response received:", response.substring(0, 50) + "...");
			
			// If this is a question, try to parse the JSON
			let parsedResponse = response;
			let structuredContent: any = null;
			
			if (requestType === "question") {
				try {
					// Define a schema for the expected response structure
					const questionResponseSchema = z.object({
						question: z.string(),
						hints: z.array(z.string()).length(3),
						difficulty: z.enum(["easy", "medium", "hard"])
					});
					
					// Parse and validate the JSON response
					const parsedJson = JSON.parse(response);
					const validationResult = questionResponseSchema.safeParse(parsedJson);
					
					if (validationResult.success) {
						console.log("Successfully parsed structured response");
						structuredContent = validationResult.data;
						// Keep the original JSON response for compatibility
						parsedResponse = response;
					} else {
						console.error("Response validation failed:", validationResult.error);
						// Continue with the raw response for backward compatibility
					}
				} catch (parseError) {
					console.error("Failed to parse response as JSON:", parseError);
					// Continue with the raw response
				}
			}

			// If this is a question request and audio is requested, generate audio from the question text
			if (requestType === "question" && generateAudio) {
				try {
					console.log("Generate audio flag set to true, generating audio...");
					
					// Check if CARTESIA_API_KEY is set
					if (!process.env.CARTESIA_API_KEY) {
						console.error("CARTESIA_API_KEY environment variable is not set");
						console.log("Falling back to text-only response");
						return new Response(JSON.stringify({ 
							response: parsedResponse,
							structuredContent,
							audioData: null,
							error: "TTS API key not configured"
						}), {
							headers: { "Content-Type": "application/json" },
						});
					}
					
					// Generate audio using Cartesia TTS service
					const cartesiaResponse = await fetch("https://api.cartesia.ai/tts/bytes", {
						method: "POST",
						headers: {
							"Cartesia-Version": "2024-06-30",
							"Content-Type": "application/json",
							"X-API-Key": process.env.CARTESIA_API_KEY!,
						},
						body: JSON.stringify({
							model_id: "sonic-english",
							// Use the question text from the structured content if available, otherwise use the full response
							transcript: structuredContent ? structuredContent.question : response,
							voice: {
								mode: "id",
								id: "79a125e8-cd45-4c13-8a67-188112f4dd22", // Default voice ID
							},
							output_format: {
								container: "mp3",
								encoding: "mp3",
								sample_rate: 24000,
							},
						}),
					});

					if (!cartesiaResponse.ok) {
						const errorText = await cartesiaResponse.text();
						console.error("Cartesia TTS error:", errorText);
						throw new Error(`Failed to generate speech: ${cartesiaResponse.status} ${errorText}`);
					}

					// Get the audio data
					const audioBuffer = await cartesiaResponse.arrayBuffer();
					const audioBase64 = Buffer.from(audioBuffer).toString('base64');
					
					console.log("Audio generated successfully, size:", audioBuffer.byteLength, "bytes");
					
					// Return both text and audio data
					return new Response(JSON.stringify({ 
						response: parsedResponse,
						structuredContent,
						audioData: `data:audio/mp3;base64,${audioBase64}`
					}), {
						headers: {
							"Content-Type": "application/json",
						},
					});
				} catch (error) {
					console.error("Error generating speech:", error);
					// Fall back to just returning the text response
					return new Response(JSON.stringify({ 
						response: parsedResponse,
						structuredContent,
						audioData: null,
						error: "TTS generation failed"
					}), {
						headers: {
							"Content-Type": "application/json",
						},
					});
				}
			} else {
				// For text-only responses or evaluation requests
				console.log(`Returning ${requestType} response without audio`);
				return new Response(JSON.stringify({ 
					response: parsedResponse,
					structuredContent
				}), {
					headers: {
						"Content-Type": "application/json",
					},
				});
			}
		} catch (error: any) {
			console.error("Error generating response from Groq:", error);
			return new Response(JSON.stringify({ 
				error: `Failed to generate response: ${error?.message || "Unknown error"}` 
			}), { 
				status: 500,
				headers: { "Content-Type": "application/json" }
			});
		}
	} catch (outerError: any) {
		console.error("Unhandled error in API route:", outerError);
		return new Response(JSON.stringify({ 
			error: `Server error: ${outerError?.message || "Unknown error"}` 
		}), { 
			status: 500,
			headers: { "Content-Type": "application/json" }
		});
	}
}
