'use client';

import { useState } from 'react';

export function ExpandableDescription({ description }: { description: string }) {
  const [isExpanded, setIsExpanded] = useState(false);
  
  if (!description) return null;

  return (
    <div className="py-6">
      <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wider mb-2">
        Description
      </h3>
      <div className={`relative ${!isExpanded ? 'cursor-pointer' : ''}`} onClick={() => !isExpanded && setIsExpanded(true)}>
        <p 
          className={`text-gray-700 leading-relaxed ${
            !isExpanded ? 'line-clamp-1' : ''
          }`}
        >
          {description}
        </p>
        
        {/* Read More Button */}
        {!isExpanded && (
          <button 
            onClick={(e) => {
              e.stopPropagation();
              setIsExpanded(true);
            }}
            className="text-emerald font-medium hover:underline mt-1 text-sm inline-flex items-center gap-1"
          >
            Read more
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
        )}

        {/* Show Less Button (Optional) */}
        {isExpanded && (
          <button 
            onClick={(e) => {
              e.stopPropagation();
              setIsExpanded(false);
            }}
            className="text-gray-500 hover:text-emerald font-medium mt-2 text-sm inline-flex items-center gap-1"
          >
            Show less
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
            </svg>
          </button>
        )}
      </div>
    </div>
  );
}