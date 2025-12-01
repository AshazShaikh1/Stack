import React from 'react';

interface IconProps {
  className?: string;
  size?: number;
}

export const HomeIcon: React.FC<IconProps> = ({ className = '', size = 20 }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 20 20"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
  >
    <path
      d="M10 2L3 7V17H7V12H13V17H17V7L10 2Z"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      fill="none"
    />
  </svg>
);

export const FeedIcon: React.FC<IconProps> = ({ className = '', size = 20 }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 20 20"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
  >
    <rect x="3" y="3" width="6" height="6" stroke="currentColor" strokeWidth="1.5" fill="none" />
    <rect x="11" y="3" width="6" height="6" stroke="currentColor" strokeWidth="1.5" fill="none" />
    <rect x="3" y="11" width="6" height="6" stroke="currentColor" strokeWidth="1.5" fill="none" />
    <rect x="11" y="11" width="6" height="6" stroke="currentColor" strokeWidth="1.5" fill="none" />
  </svg>
);

export const ExploreIcon: React.FC<IconProps> = ({ className = '', size = 20 }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 20 20"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
  >
    <circle cx="10" cy="10" r="7" stroke="currentColor" strokeWidth="1.5" fill="none" />
    <path
      d="M10 3V10L14 12"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      fill="none"
    />
  </svg>
);

export const CreateIcon: React.FC<IconProps> = ({ className = '', size = 20 }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 20 20"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
  >
    <path
      d="M10 4V16M4 10H16"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      fill="none"
    />
  </svg>
);

export const ProfileIcon: React.FC<IconProps> = ({ className = '', size = 20 }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 20 20"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
  >
    <circle cx="10" cy="7" r="3" stroke="currentColor" strokeWidth="1.5" fill="none" />
    <path
      d="M4 17C4 14 6.5 12 10 12C13.5 12 16 14 16 17"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      fill="none"
    />
  </svg>
);

export const SearchIcon: React.FC<IconProps> = ({ className = '', size = 20 }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 20 20"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
  >
    <circle cx="9" cy="9" r="6" stroke="currentColor" strokeWidth="1.5" fill="none" />
    <path
      d="M13 13L17 17"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      fill="none"
    />
  </svg>
);

export const MyStacksIcon: React.FC<IconProps> = ({ className = '', size = 20 }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 20 20"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
  >
    <rect x="3" y="3" width="14" height="14" rx="1" stroke="currentColor" strokeWidth="1.5" fill="none" />
    <path d="M3 7H17" stroke="currentColor" strokeWidth="1.5" />
    <path d="M7 3V17" stroke="currentColor" strokeWidth="1.5" />
  </svg>
);

export const NotificationIcon: React.FC<IconProps> = ({ className = '', size = 20 }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 20 20"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
  >
    <path
      d="M10 2C7.2 2 5 4.2 5 7V11L3 13V14H17V13L15 11V7C15 4.2 12.8 2 10 2Z"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      fill="none"
    />
    <path
      d="M7 14V15C7 16.1 7.9 17 9 17H11C12.1 17 13 16.1 13 15V14"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      fill="none"
    />
  </svg>
);

