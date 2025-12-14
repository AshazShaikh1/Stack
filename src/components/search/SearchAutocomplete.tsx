'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { SearchIcon, XIcon } from '@/components/ui/Icons'; // Ensure XIcon exists or use SVG
import { useDebounce } from '@/hooks/useDebounce';

export function SearchAutocomplete() {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<any>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  // Debounce query to prevent API spam (500ms delay)
  const [debouncedQuery, setDebouncedQuery] = useState(query);
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query), 300);
    return () => clearTimeout(timer);
  }, [query]);

  // Fetch results when debounced query changes
  useEffect(() => {
    if (!debouncedQuery.trim()) {
      setResults(null);
      return;
    }

    const fetchResults = async () => {
      setIsLoading(true);
      try {
        // Limit to 5 results per category for the dropdown
        const res = await fetch(`/api/search?q=${encodeURIComponent(debouncedQuery)}&limit=3`);
        if (res.ok) {
          const data = await res.json();
          setResults(data);
          setIsOpen(true);
        }
      } catch (error) {
        console.error('Search error:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchResults();
  }, [debouncedQuery]);

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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsOpen(false);
    if (query.trim()) {
      router.push(`/search?q=${encodeURIComponent(query)}`);
    }
  };

  const clearSearch = () => {
    setQuery('');
    setResults(null);
    setIsOpen(false);
  };

  const hasResults = results && (
    (results.collections?.length > 0) || 
    (results.cards?.length > 0) || 
    (results.users?.length > 0)
  );

  return (
    <div ref={wrapperRef} className="relative w-full max-w-2xl">
      <form onSubmit={handleSubmit} className="relative z-50">
        <div className="relative flex items-center">
          <div className="absolute left-4 text-gray-400 pointer-events-none">
            <SearchIcon size={18} />
          </div>
          <input
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              if (e.target.value.trim()) setIsOpen(true);
            }}
            onFocus={() => {
              if (results) setIsOpen(true);
            }}
            placeholder="Search collections, cards, people..."
            className={`
              w-full py-2.5 pl-11 pr-10 bg-gray-100 border border-transparent 
              text-jet-dark placeholder:text-gray-500 outline-none transition-all duration-200
              ${isOpen ? 'rounded-t-xl bg-white border-gray-200 border-b-transparent shadow-lg' : 'rounded-xl focus:bg-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20'}
            `}
          />
          {query && (
            <button
              type="button"
              onClick={clearSearch}
              className="absolute right-3 p-1 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-200 transition-colors"
            >
              {/* Simple X icon */}
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
            </button>
          )}
        </div>
      </form>

      {/* Dropdown Results */}
      {isOpen && (query.trim().length > 0) && (
        <div className="absolute top-full left-0 right-0 bg-white border border-gray-200 border-t-0 rounded-b-xl shadow-xl overflow-hidden z-40 max-h-[80vh] overflow-y-auto">
          
          {isLoading && !results && (
            <div className="p-8 flex justify-center text-gray-400">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-emerald-500"></div>
            </div>
          )}

          {!isLoading && !hasResults && debouncedQuery && (
            <div className="p-4 text-center text-gray-500 text-sm">
              No results found for &quot;{query}&quot;
            </div>
          )}

          {/* Collections Section */}
          {results?.collections?.length > 0 && (
            <div className="py-2">
              <div className="px-4 py-2 text-xs font-bold text-gray-400 uppercase tracking-wider">Collections</div>
              {results.collections.map((collection: any) => (
                <Link 
                  key={collection.id} 
                  href={`/collection/${collection.id}`}
                  onClick={() => setIsOpen(false)}
                  className="flex items-center gap-3 px-4 py-2 hover:bg-gray-50 transition-colors"
                >
                  <div className="w-8 h-8 bg-gray-100 rounded-md flex-shrink-0 overflow-hidden relative">
                    {collection.cover_image_url ? (
                      <Image src={collection.cover_image_url} alt="" fill className="object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-xs">📚</div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-jet-dark truncate">{collection.title}</div>
                    <div className="text-xs text-gray-500 truncate">by {collection.owner?.display_name}</div>
                  </div>
                </Link>
              ))}
            </div>
          )}

          {/* Cards Section */}
          {results?.cards?.length > 0 && (
            <div className="py-2 border-t border-gray-100">
              <div className="px-4 py-2 text-xs font-bold text-gray-400 uppercase tracking-wider">Cards</div>
              {results.cards.map((card: any) => (
                <Link 
                  key={card.id} 
                  href={`/card/${card.id}`}
                  onClick={() => setIsOpen(false)}
                  className="flex items-center gap-3 px-4 py-2 hover:bg-gray-50 transition-colors"
                >
                  <div className="w-8 h-8 bg-gray-100 rounded-md flex-shrink-0 overflow-hidden relative">
                    {card.thumbnail_url ? (
                      <Image src={card.thumbnail_url} alt="" fill className="object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-xs">📄</div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-jet-dark truncate">{card.title}</div>
                    <div className="text-xs text-gray-500 truncate">{card.domain || 'Resource'}</div>
                  </div>
                </Link>
              ))}
            </div>
          )}

          {/* Users Section */}
          {results?.users?.length > 0 && (
            <div className="py-2 border-t border-gray-100">
              <div className="px-4 py-2 text-xs font-bold text-gray-400 uppercase tracking-wider">People</div>
              {results.users.map((user: any) => (
                <Link 
                  key={user.id} 
                  href={`/profile/${user.username}`}
                  onClick={() => setIsOpen(false)}
                  className="flex items-center gap-3 px-4 py-2 hover:bg-gray-50 transition-colors"
                >
                  <div className="w-8 h-8 bg-gray-100 rounded-full flex-shrink-0 overflow-hidden relative">
                    {user.avatar_url ? (
                      <Image src={user.avatar_url} alt="" fill className="object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-xs font-bold text-gray-500">
                        {user.username?.[0]?.toUpperCase()}
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-jet-dark truncate">{user.display_name}</div>
                    <div className="text-xs text-gray-500 truncate">@{user.username}</div>
                  </div>
                </Link>
              ))}
            </div>
          )}

          {/* View All Link */}
          {hasResults && (
            <Link
              href={`/search?q=${encodeURIComponent(query)}`}
              onClick={() => setIsOpen(false)}
              className="block p-3 text-center text-sm font-medium text-emerald-600 bg-gray-50 hover:bg-emerald-50 transition-colors border-t border-gray-100"
            >
              See all results for &quot;{query}&quot;
            </Link>
          )}
        </div>
      )}
    </div>
  );
}