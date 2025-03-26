# Loopy - Technical Interview Preparation Assistant

An open-source study assistance tool for software engineers preparing for technical interviews. Loopy simulates realistic interview experiences with AI-driven questions and feedback.

## Features

- **Interactive Technical Interviews**: Experience realistic interview practice with AI-driven questions and feedback
- **Text-Based by Default**: Type your answers for maximum accessibility and ease of use
- **Optional Voice Mode**: Switch to voice mode for a more immersive experience with speech input/output
- **Real-time Feedback**: Receive detailed evaluation and feedback on your responses
- **Multiple Technical Topics**: Choose from a wide range of software engineering topics
- **Open Source**: Free to use and contribute to

## How It Works

### Text Mode (Default)
1. **Select a Topic**: Choose from various technical areas like algorithms, system design, networking, etc.
2. **Read the Question**: The AI interviewer presents you with a technical question
3. **Type Your Answer**: Respond to the question in a text box
4. **Get Feedback**: Receive an evaluation of your answer with specific feedback and improvement suggestions
5. **Continue the Interview**: Answer follow-up questions or request a new question

### Voice Mode (Optional)
1. **Enable Voice Mode**: Click the voice mode toggle in the header
2. **Listen to Questions**: The AI interviewer asks you questions using text-to-speech
3. **Respond Verbally**: Record your answer by speaking naturally
4. **Get Feedback**: Receive the same detailed evaluation and feedback
5. **Continue the Interview**: The conversation flow works the same as text mode

## Implementation Plan

### Phase 1: Core Interview Structure ✅
- [x] Create project foundation with Next.js
- [x] Design the interview interface
- [x] Implement the Q&A flow
- [x] Set up question generation and answer evaluation

### Phase 2: Text & Voice Modes ✅
- [x] Implement text-based input/output as default
- [x] Add optional voice mode with speech recognition and synthesis
- [x] Create toggle for switching between modes
- [x] Ensure graceful fallbacks when permissions or browser capabilities are limited

### Phase 3: UI/UX Refinement
- [ ] Improve visual feedback during different interview stages
- [ ] Add interview timers and progress tracking
- [ ] Create user dashboard for tracking progress
- [ ] Implement accessibility features

### Phase 4: Advanced Features
- [ ] Add difficulty levels for questions
- [ ] Implement interview session scoring
- [ ] Create personalized improvement recommendations
- [ ] Add coding-specific interview modes

## Example Questions

Loopy includes questions covering topics such as:

- **System Design**: 
  - How would you handle 100,000,000,000 file updates?
  - How would you design a system to store 100TB of data?

- **Networking**: 
  - What's the difference between TCP and UDP?
  - Explain how DNS resolution works

- **Concurrency**: 
  - What's the difference between a mutex and a semaphore?
  - Explain deadlocks and how to prevent them

- **Databases**: 
  - NoSQL vs SQL databases - when would you use each?
  - Explain database indexing and its importance

- **Infrastructure**: 
  - What are the differences between containers and VMs?
  - Explain the concept of infrastructure as code

## Technical Stack

- **Frontend**: Next.js with React and TypeScript
- **Styling**: Tailwind CSS for responsive design
- **AI Integration**: Integration with Groq API for question generation and answer evaluation
- **Speech Processing** (optional): 
  - Web Speech API for text-to-speech
  - Whisper API for transcription
- **Deployment**: Vercel

## Getting Started

```bash
# Install dependencies
npm install
# or
pnpm install

# Run the development server
npm run dev
# or
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser to see the application.

## Contributing

Loopy is an open-source project and we welcome contributions! Please feel free to submit a PR or open an issue if you have ideas for improvement.

## License

This project is open-sourced under the MIT license.
