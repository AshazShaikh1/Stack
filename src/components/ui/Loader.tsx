import React from 'react';

interface LoaderProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  fullPage?: boolean;
}

export const Loader: React.FC<LoaderProps> = ({ 
  size = 'md', 
  className = '',
  fullPage = false 
}) => {
  const sizeClasses = {
    sm: 'w-4 h-4 border-2',
    md: 'w-8 h-8 border-2',
    lg: 'w-12 h-12 border-3',
  };

  const spinner = (
    <div
      className={`
        ${sizeClasses[size]} 
        border-jet border-t-transparent 
        rounded-full animate-spin 
        ${className}
      `}
      role="status"
      aria-label="Loading"
    >
      <span className="sr-only">Loading...</span>
    </div>
  );

  if (fullPage) {
    return (
      <div className="flex items-center justify-center min-h-[50vh] w-full">
        {spinner}
      </div>
    );
  }

  return spinner;
};