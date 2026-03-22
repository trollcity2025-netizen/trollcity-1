import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"
import React from "react"
 
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export const isAuthRoute = (pathname: string) => {
  return pathname.startsWith('/auth') || pathname.startsWith('/callback') || pathname.startsWith('/profile/setup');
};

export function formatCompactNumber(number: number) {
  if (number < 1000) {
    return number.toString();
  }
  return new Intl.NumberFormat('en-US', {
    notation: 'compact',
    compactDisplay: 'short',
  }).format(number);
}

/**
 * Convert URLs in text to clickable links
 * Matches URLs starting with http://, https://, or www.
 * Returns React nodes with anchor tags
 */
export function parseTextWithLinks(text: string | null | undefined): React.ReactNode[] {
  if (!text) return [];
  
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  
  // Combined regex to match http://, https://, or www. URLs
  const urlRegex = /(https?:\/\/[^\s<]+[^<.,:;"\s())])|(www\.[^\s<]+[^<.,:;"\s())])/gi;
  
  // Find all matches
  const matches = [...text.matchAll(urlRegex)];
  
  if (matches.length === 0) {
    return [text];
  }
  
  for (const match of matches) {
    const matchText = match[0] || match[1] || '';
    const matchIndex = match.index ?? 0;
    
    // Add text before the URL
    if (matchIndex > lastIndex) {
      parts.push(text.slice(lastIndex, matchIndex));
    }
    
    // Add the URL as a clickable link
    let url = matchText;
    // Ensure URL has protocol for href
    if (url.startsWith('www.')) {
      url = 'https://' + url;
    }
    
    parts.push(
      <a
        key={matchIndex}
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="text-blue-400 hover:text-blue-300 underline"
        onClick={(e) => e.stopPropagation()}
      >
        {matchText}
      </a>
    );
    
    lastIndex = matchIndex + matchText.length;
  }
  
  // Add remaining text after last URL
  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }
  
  return parts;
}
