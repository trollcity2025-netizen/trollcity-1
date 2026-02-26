
import React, { useState, useEffect, useRef } from 'react';
import { Search, User } from 'lucide-react';
import { cn } from '@/lib/utils';
import { supabase } from '@/lib/supabase';
import { useNavigate } from 'react-router-dom';

interface SearchResult {
  id: string;
  username: string;
  avatar_url: string | null;
}

const RGBSearchBar = () => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();
  const wrapperRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Search for users when query changes
  useEffect(() => {
    const searchUsers = async () => {
      const searchTerm = query.trim().replace('@', '').toLowerCase();
      
      if (searchTerm.length < 3) {
        setResults([]);
        setIsOpen(false);
        return;
      }

      setIsLoading(true);
      
      try {
        // Search by first 3 characters of username
        const searchQuery = searchTerm.substring(0, 3);
        
        const { data, error } = await supabase
          .from('user_profiles')
          .select('id, username, avatar_url')
          .ilike('username', `${searchQuery}%`)
          .limit(10)
          .order('username', { ascending: true });

        if (error) {
          console.error('Search error:', error);
          setResults([]);
        } else {
          setResults(data || []);
          setIsOpen(data && data.length > 0);
        }
      } catch (err) {
        console.error('Search error:', err);
        setResults([]);
      } finally {
        setIsLoading(false);
      }
    };

    const debounce = setTimeout(searchUsers, 300);
    return () => clearTimeout(debounce);
  }, [query]);

  const handleSelect = (username: string) => {
    setQuery('');
    setResults([]);
    setIsOpen(false);
    navigate(`/profile/${username}`);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setIsOpen(false);
    }
  };

  return (
    <div ref={wrapperRef} className="relative group w-full max-w-md">
      <div
        className={cn(
          'absolute -inset-0.5 bg-gradient-to-r from-purple-600 via-pink-600 to-blue-600 ',
          'rounded-full blur-md opacity-50 group-hover:opacity-75 transition duration-1000 group-hover:duration-200 animate-tilt'
        )}
      />
      <div className="relative flex items-center">
        <div className="absolute left-4">
          <Search className="text-slate-500" size={20} />
        </div>
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => query.length >= 3 && results.length > 0 && setIsOpen(true)}
          placeholder="Search Troll City..."
          className={cn(
            'w-full pl-12 pr-4 py-2.5 rounded-full text-white placeholder-slate-500',
            'bg-slate-900/80 border border-slate-700/50 backdrop-blur-sm',
            'focus:outline-none focus:ring-2 focus:ring-pink-500/50 transition-all'
          )}
        />
      </div>

      {/* Search Results Dropdown */}
      {isOpen && results.length > 0 && (
        <div className="absolute top-full mt-2 w-full bg-slate-800/95 backdrop-blur-lg rounded-xl border border-slate-700 shadow-2xl overflow-hidden z-50">
          <div className="py-2 max-h-80 overflow-y-auto">
            {results.map((user) => (
              <button
                key={user.id}
                onClick={() => handleSelect(user.username)}
                className="w-full px-4 py-3 flex items-center gap-3 hover:bg-slate-700/50 transition-colors text-left"
              >
                {user.avatar_url ? (
                  <img
                    src={user.avatar_url}
                    alt={user.username}
                    className="w-8 h-8 rounded-full object-cover"
                  />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
                    <User className="w-4 h-4 text-white" />
                  </div>
                )}
                <span className="text-white font-medium">@{user.username}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Loading indicator */}
      {isLoading && (
        <div className="absolute top-full mt-2 w-full bg-slate-800/95 backdrop-blur-lg rounded-xl border border-slate-700 shadow-xl p-4 z-50">
          <div className="flex items-center justify-center gap-2 text-slate-400">
            <div className="w-4 h-4 border-2 border-slate-400 border-t-transparent rounded-full animate-spin" />
            <span className="text-sm">Searching...</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default RGBSearchBar;
