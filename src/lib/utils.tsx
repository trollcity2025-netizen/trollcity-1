import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"
import React from "react"
import { Link } from "react-router-dom"
 
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
 * Convert URLs and #username tags in text to clickable links
 * Matches URLs starting with http://, https://, or www.
 * Matches #username tags and converts them to profile links
 * Returns React nodes with anchor tags
 */
export function parseTextWithLinks(text: string | null | undefined): React.ReactNode[] {
  if (!text) return [];
  
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  
  // Combined regex to match URLs and #username tags
  const combinedRegex = /(https?:\/\/[^\s<]+[^<.,:;"\s())])|(www\.[^\s<]+[^<.,:;"\s())])|#(\w+)/gi;
  
  const matches = [...text.matchAll(combinedRegex)];
  
  if (matches.length === 0) {
    return [text];
  }
  
  for (const match of matches) {
    const matchIndex = match.index ?? 0;
    
    // Add text before the match
    if (matchIndex > lastIndex) {
      parts.push(text.slice(lastIndex, matchIndex));
    }
    
    // Handle #username tag
    if (match[3]) {
      const username = match[3];
      parts.push(
        <Link
          key={`tag-${matchIndex}`}
          to={`/profile/${username}`}
          className="text-purple-400 font-semibold hover:text-purple-300"
          onClick={(e) => e.stopPropagation()}
        >
          {username}
        </Link>
      );
      lastIndex = matchIndex + match[0].length;
      continue;
    }
    
    // Handle URL
    const matchText = match[0] || match[1] || '';
    let url = matchText;
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
  
  // Add remaining text after last match
  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }
  
  return parts;
}
