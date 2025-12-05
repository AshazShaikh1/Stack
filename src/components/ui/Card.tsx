import React from 'react';

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  hover?: boolean;
}

export const Card: React.FC<CardProps> = ({
  children,
  hover = false,
  className = '',
  ...props
}) => {
  return (
    <div
      className={`
        bg-white rounded-card border border-gray-light shadow-card
        ${hover ? 'hover:shadow-cardHover hover:scale-[1.01] transition-all duration-300 cursor-pointer' : ''}
        ${className}
      `}
      {...props}
    >
      {children}
    </div>
  );
};

