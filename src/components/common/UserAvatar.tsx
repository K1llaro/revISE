import React from 'react';
import { getInitials } from '../../lib/avatarUtils';

interface UserAvatarProps {
  avatarUrl?: string | null;
  nickname?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  showBorder?: boolean;
  onClick?: () => void;
}

const sizeClasses: Record<NonNullable<UserAvatarProps['size']>, { container: string; text: string }> = {
  xs: { container: 'h-6 w-6', text: 'text-[10px]' },
  sm: { container: 'h-8 w-8', text: 'text-xs' },
  md: { container: 'h-10 w-10', text: 'text-sm' },
  lg: { container: 'h-14 w-14', text: 'text-base font-bold' },
  xl: { container: 'h-20 w-20', text: 'text-xl font-bold' },
};

export const UserAvatar: React.FC<UserAvatarProps> = ({
  avatarUrl,
  nickname,
  size = 'md',
  className = '',
  showBorder = true,
  onClick,
}) => {
  const { container, text } = sizeClasses[size];
  const borderClass = showBorder ? 'border border-white/20 shadow-md' : '';
  const interactiveClass = onClick ? 'cursor-pointer hover:opacity-90 active:scale-95 transition-all' : '';

  if (avatarUrl && avatarUrl.trim().length > 0) {
    return (
      <div
        onClick={onClick}
        className={`relative inline-flex items-center justify-center shrink-0 rounded-2xl overflow-hidden bg-[#060c20] ${container} ${borderClass} ${interactiveClass} ${className}`}
      >
        <img
          src={avatarUrl}
          alt={nickname ? `${nickname}'s avatar` : 'User avatar'}
          className="h-full w-full object-cover select-none"
          loading="lazy"
        />
      </div>
    );
  }

  // Fallback: stylish ISE gradient with initials
  const initials = getInitials(nickname);

  return (
    <div
      onClick={onClick}
      className={`relative inline-flex items-center justify-center shrink-0 rounded-2xl bg-gradient-to-br from-[#0a2e18] via-[#06182c] to-[#040816] text-[#3ccb57] font-mono font-black select-none ${container} ${text} ${borderClass} ${interactiveClass} ${className}`}
    >
      <span>{initials}</span>
    </div>
  );
};
