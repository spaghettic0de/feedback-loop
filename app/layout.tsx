import type { Metadata } from "next";
import "./globals.css";
import { Toaster } from "sonner";
import { Analytics } from "@vercel/analytics/react";

export const metadata: Metadata = {
	title: "Loopy",
	description:
		"Technical interview preparation assistant powered by AI.",
};

export default function RootLayout({
	children,
}: {
	children: React.ReactNode;
}) {
	return (
		<html lang="en" suppressHydrationWarning>
			<body className="min-h-screen bg-white text-gray-900 dark:bg-gray-950 dark:text-gray-100">
				{children}
				<Toaster 
					position="top-center" 
					toastOptions={{
						style: {
							background: 'hsl(var(--background))',
							color: 'hsl(var(--foreground))',
							border: '1px solid hsl(var(--border))',
						},
					}}
				/>
				<Analytics />
			</body>
		</html>
	);
}
