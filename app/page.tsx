"use client";

import React from "react";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";

export default function Home() {
	const router = useRouter();
	
	// Function to start a new interview
	const startNewInterview = () => {
		const newId = crypto.randomUUID();
		router.push(`/problems/${newId}`);
	};

	return (
		<div className="min-h-screen bg-white dark:bg-gray-950">
			<main className="max-w-6xl mx-auto px-6 py-16">
				<div className="text-center mb-12">
					<h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-4">
						feedback.loop
					</h1>
					<p className="text-xl text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
						Prepare for technical interviews with AI-powered practice questions and real-time feedback
					</p>
					<div className="mt-10">
						<Button 
							onClick={startNewInterview}
							size="lg"
							className="px-8 py-6 text-lg"
						>
							Start New Practice
						</Button>
					</div>
				</div>
				
				<div className="mt-20 max-w-4xl mx-auto">
					<div className="grid grid-cols-1 md:grid-cols-3 gap-8">
						<div className="bg-gray-50 dark:bg-gray-900 p-6 rounded-xl">
							<div className="flex items-center justify-center h-14 w-14 rounded-full bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-300 mb-4 mx-auto">
								<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
									<path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
									<polyline points="14 2 14 8 20 8" />
									<path d="M8 13h4" />
									<path d="M8 17h8" />
									<path d="M8 9h1" />
								</svg>
							</div>
							<h3 className="text-lg font-medium text-center text-gray-900 dark:text-white mb-2">
								Practice Questions
							</h3>
							<p className="text-sm text-center text-gray-600 dark:text-gray-400">
								Access a broad range of technical interview questions covering algorithms, system design, and more
							</p>
						</div>
						
						<div className="bg-gray-50 dark:bg-gray-900 p-6 rounded-xl">
							<div className="flex items-center justify-center h-14 w-14 rounded-full bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-300 mb-4 mx-auto">
								<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
									<path d="M3 3v18h18" />
									<path d="m19 9-5 5-4-4-3 3" />
								</svg>
							</div>
							<h3 className="text-lg font-medium text-center text-gray-900 dark:text-white mb-2">
								Detailed Feedback
							</h3>
							<p className="text-sm text-center text-gray-600 dark:text-gray-400">
								Receive personalized feedback on your answers to improve your problem-solving skills
							</p>
						</div>
						
						<div className="bg-gray-50 dark:bg-gray-900 p-6 rounded-xl">
							<div className="flex items-center justify-center h-14 w-14 rounded-full bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-300 mb-4 mx-auto">
								<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
									<path d="M12 8a2 2 0 0 1 2 2v4a2 2 0 1 1-4 0v-4a2 2 0 0 1 2-2z" />
									<rect width="16" height="16" x="4" y="4" rx="2" ry="2" />
								</svg>
							</div>
							<h3 className="text-lg font-medium text-center text-gray-900 dark:text-white mb-2">
								Voice & Text Support
							</h3>
							<p className="text-sm text-center text-gray-600 dark:text-gray-400">
								Practice in the format that suits you best with both voice and text input options
							</p>
						</div>
					</div>
					
					<div className="mt-16 text-center">
						<h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-4">
							Ready to ace your next interview?
						</h2>
						<p className="text-gray-600 dark:text-gray-400 mb-8">
							Start practicing with AI-powered feedback to build confidence and technical skills
						</p>
						<Button 
							onClick={startNewInterview}
							variant="outline"
							size="lg"
							className="px-6"
						>
							Get Started Now
						</Button>
					</div>
				</div>
			</main>
		</div>
	);
}
