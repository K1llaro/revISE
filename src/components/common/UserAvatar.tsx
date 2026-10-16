import React from 'react';
import { getInitials } from '../../lib/avatarUtils';

export interface UserAvatarProps {
  avatarUrl?: string | null;
  nickname?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  showBorder?: boolean;
  onClick?: () => void;
}

const sizeClasses: Record<NonNullable<UserAvatarProps['size']>, { container: string; text: string; outerRadius: string; innerRadius: string }> = {
  xs: { container: 'h-6 w-6', text: 'text-[10px]', outerRadius: 'rounded-[8px]', innerRadius: 'rounded-[6px]' },
  sm: { container: 'h-8 w-8', text: 'text-xs', outerRadius: 'rounded-[10px]', innerRadius: 'rounded-[8px]' },
  md: { container: 'h-10 w-10', text: 'text-sm', outerRadius: 'rounded-[13px]', innerRadius: 'rounded-[10px]' },
  lg: { container: 'h-14 w-14', text: 'text-base font-bold', outerRadius: 'rounded-[17px]', innerRadius: 'rounded-[13px]' },
  xl: { container: 'h-20 w-20', text: 'text-xl font-bold', outerRadius: 'rounded-[22px]', innerRadius: 'rounded-[16px]' },
};

export const UserAvatar: React.FC<UserAvatarProps> = ({
  avatarUrl,
  nickname,
  size = 'md',
  className = '',
  showBorder = true,
  onClick,
}) => {
  const { container, text, outerRadius, innerRadius } = sizeClasses[size];
  const interactiveClass = onClick ? 'cursor-pointer hover:opacity-95 active:scale-95 transition-transform' : '';
  const borderClass = showBorder ? 'border border-white/20 shadow-md' : '';

  if (avatarUrl && avatarUrl.trim().length > 0) {
    return (
      <div
        onClick={onClick}
        className={`relative inline-flex items-center justify-center shrink-0 ${outerRadius} overflow-hidden bg-[#060c20] ${container} ${borderClass} ${interactiveClass} ${className}`}
      >
        <img
          src={avatarUrl}
          alt={nickname ? `${nickname}'s avatar` : 'User avatar'}
          className={`h-full w-full object-cover select-none ${innerRadius}`}
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
      className={`relative inline-flex items-center justify-center shrink-0 ${outerRadius} bg-gradient-to-br from-[#0a2e18] via-[#06182c] to-[#040816] text-[#3ccb57] font-mono font-black select-none ${container} ${text} ${borderClass} ${interactiveClass} ${className}`}
    >
      <span>{initials}</span>
    </div>
  );
};
