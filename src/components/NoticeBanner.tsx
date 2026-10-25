import React from 'react';
import { Info, X } from 'lucide-react';

interface NoticeBannerProps {
  message: string;
  onDismiss?: () => void;
}

export const NoticeBanner: React.FC<NoticeBannerProps> = ({ message, onDismiss }) => {
  return (
    <div className="bg-[#EAECE8] border-b border-[#D6D8D3] px-4 py-2.5 text-xs text-[#1C2321] flex items-center justify-between">
      <div className="flex items-center gap-2">
        <Info className="w-4 h-4 text-[#59615E] shrink-0" />
        <span>{message}</span>
      </div>
      {onDismiss && (
        <button
          onClick={onDismiss}
          className="text-[#59615E] hover:text-[#1C2321] p-1 rounded transition-colors"
          title="Dismiss notice"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
};
