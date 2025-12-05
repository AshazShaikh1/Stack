import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
  children: React.ReactNode;
}

export const Button: React.FC<ButtonProps> = ({
  variant = 'primary',
  size = 'md',
  isLoading = false,
  children,
  className = '',
  disabled,
  ...props
}) => {
  const baseStyles = 'inline-flex items-center justify-center font-medium rounded-button transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-emerald focus:ring-offset-2 active:outline-none disabled:opacity-50 disabled:cursor-not-allowed shadow-button hover:shadow-buttonHover';
  
  const variantStyles = {
    primary: 'bg-emerald text-white hover:bg-emerald-dark active:scale-[0.98]',
    secondary: 'bg-transparent text-emerald border-2 border-emerald hover:bg-emerald hover:text-white active:scale-[0.98]',
    outline: 'bg-white text-jet border border-gray-light hover:border-emerald hover:text-emerald hover:bg-emerald/5 active:scale-[0.98] shadow-none hover:shadow-sm',
  };
  
  const sizeStyles = {
    sm: 'px-4 py-2.5 text-sm',
    md: 'px-6 py-3 text-body',
    lg: 'px-8 py-4 text-lg',
  };

  return (
    <button
      className={`${baseStyles} ${variantStyles[variant]} ${sizeStyles[size]} ${className}`}
      disabled={disabled || isLoading}
      {...props}
    >
      {isLoading ? (
        <>
          <svg
            className="animate-spin -ml-1 mr-2 h-4 w-4"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
          Loading...
        </>
      ) : (
        children
      )}
    </button>
  );
};

