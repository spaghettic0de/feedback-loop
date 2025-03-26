import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

// Types for history items
export type HistoryItem = {
  id: string;
  title: string;
  category: string;
  date: string;
  status: 'completed' | 'in-progress' | 'failed';
};

interface SidebarProps {
  history: HistoryItem[];
  activeProblemId?: string;
  onNewProblem: () => void;
  isMobileOpen?: boolean;
  onToggleMobile?: () => void;
}

export function Sidebar({ 
  history, 
  activeProblemId, 
  onNewProblem, 
  isMobileOpen = false,
  onToggleMobile
}: SidebarProps) {
  // Track if we're on mobile using media query
  const [isMobile, setIsMobile] = useState(false);

  // Listen for window resize to determine if mobile
  useEffect(() => {
    const checkIfMobile = () => {
      setIsMobile(window.innerWidth < 768); // 768px is typical md breakpoint
    };
    
    // Check on mount
    checkIfMobile();
    
    // Add resize listener
    window.addEventListener('resize', checkIfMobile);
    
    // Clean up
    return () => window.removeEventListener('resize', checkIfMobile);
  }, []);

  return (
    <>
      {/* Mobile sidebar toggle button - fixed at the bottom left */}
      {isMobile && (
        <button 
          onClick={onToggleMobile}
          className="fixed bottom-4 left-4 z-30 flex items-center justify-center w-12 h-12 rounded-full bg-blue-600 text-white shadow-lg md:hidden"
          aria-label={isMobileOpen ? "Close sidebar" : "Open sidebar"}
        >
          {isMobileOpen ? (
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 6L6 18"></path>
              <path d="M6 6l12 12"></path>
            </svg>
          ) : (
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 6h16"></path>
              <path d="M4 12h16"></path>
              <path d="M4 18h16"></path>
            </svg>
          )}
        </button>
      )}
      
      {/* Sidebar overlay for mobile - only visible when sidebar is open */}
      {isMobile && isMobileOpen && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 z-10 md:hidden"
          onClick={onToggleMobile}
          aria-hidden="true"
        />
      )}
      
      {/* Sidebar - hidden on mobile by default, shown when isMobileOpen is true */}
      <div className={cn(
        "fixed inset-y-0 left-0 z-20 transform transition-transform duration-300 ease-in-out md:relative md:transform-none",
        isMobile && !isMobileOpen ? "-translate-x-full" : "translate-x-0",
        "flex flex-col h-full border-r border-gray-200 dark:border-gray-800 w-80 bg-white dark:bg-gray-900"
      )}>
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-800">
          <Link href="/" className="text-xl font-medium text-gray-900 dark:text-white">
            feedback.loop
          </Link>
          {/* Close button for mobile */}
          {isMobile && (
            <button 
              onClick={onToggleMobile}
              className="md:hidden text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
              aria-label="Close sidebar"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 6L6 18"></path>
                <path d="M6 6l12 12"></path>
              </svg>
            </button>
          )}
        </div>
        
        <div className="p-4">
          <Button 
            onClick={onNewProblem} 
            className="w-full justify-start"
          >
            <svg 
              xmlns="http://www.w3.org/2000/svg" 
              className="w-4 h-4 mr-2" 
              viewBox="0 0 24 24" 
              fill="none" 
              stroke="currentColor" 
              strokeWidth="2" 
              strokeLinecap="round" 
              strokeLinejoin="round"
            >
              <line x1="12" y1="5" x2="12" y2="19"></line>
              <line x1="5" y1="12" x2="19" y2="12"></line>
            </svg>
            New Question
          </Button>
        </div>
        
        <div className="flex-1 overflow-y-auto p-4">
          <h3 className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">
            History
          </h3>
          
          {history.length === 0 ? (
            <div className="text-sm text-gray-500 dark:text-gray-400">
              No question history yet
            </div>
          ) : (
            <div className="space-y-2">
              {history.map((item) => (
                <Link 
                  key={item.id} 
                  href={`/problems/${item.id}`}
                  onClick={isMobile ? onToggleMobile : undefined}
                  className={cn(
                    "block p-3 rounded-md text-sm transition-colors",
                    item.id === activeProblemId 
                      ? "bg-gray-200 dark:bg-gray-800 text-gray-900 dark:text-white" 
                      : "hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300"
                  )}
                >
                  <div className="font-medium">{item.title}</div>
                  <div className="flex items-center justify-between mt-1">
                    <span className="text-xs text-gray-500 dark:text-gray-400">{item.category}</span>
                    <span className="text-xs text-gray-500 dark:text-gray-400">{item.date}</span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
        
        <div className="p-4 border-t border-gray-200 dark:border-gray-800 text-xs text-gray-500 dark:text-gray-400">
          Technical interview prep powered by AI
        </div>
      </div>
    </>
  );
} 