import React from 'react';

// Define custom components for ReactMarkdown
export const MarkdownComponents = {
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