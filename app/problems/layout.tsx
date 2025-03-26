"use client";

import { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { Sidebar, type HistoryItem } from '@/components/Sidebar';
import { useRouter } from 'next/navigation';

export default function ProblemsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  
  // Extract the current problem ID from the URL if it exists
  const activeProblemId = pathname.startsWith('/problems/') 
    ? pathname.split('/').pop() 
    : undefined;
    
  // Function to create a new problem
  const handleNewProblem = () => {
    // Generate a UUID for the new problem
    const newId = crypto.randomUUID();
    router.push(`/problems/${newId}`);
    // Close mobile sidebar after navigation
    setIsMobileSidebarOpen(false);
  };
  
  // Toggle mobile sidebar
  const toggleMobileSidebar = () => {
    setIsMobileSidebarOpen(prev => !prev);
  };
  
  // Close sidebar when route changes on mobile
  useEffect(() => {
    setIsMobileSidebarOpen(false);
  }, [pathname]);
  
  // Load history from local storage on initial render
  useEffect(() => {
    const savedHistory = localStorage.getItem('problemHistory');
    if (savedHistory) {
      try {
        setHistory(JSON.parse(savedHistory));
      } catch (e) {
        console.error('Failed to parse problem history:', e);
        localStorage.removeItem('problemHistory');
      }
    }
  }, []);
  
  // Save history to local storage whenever it changes
  useEffect(() => {
    if (history.length > 0) {
      localStorage.setItem('problemHistory', JSON.stringify(history));
    }
  }, [history]);
  
  return (
    <div className="flex h-screen bg-white dark:bg-gray-950 overflow-hidden">
      <Sidebar 
        history={history} 
        activeProblemId={activeProblemId} 
        onNewProblem={handleNewProblem}
        isMobileOpen={isMobileSidebarOpen}
        onToggleMobile={toggleMobileSidebar}
      />
      <div 
        className="flex-1 flex flex-col overflow-hidden relative"
        style={{
          // Make main content go behind sidebar on mobile when sidebar is open
          zIndex: isMobileSidebarOpen ? 0 : 1
        }}
      >
        {children}
      </div>
    </div>
  );
} 