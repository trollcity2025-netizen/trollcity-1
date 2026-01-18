import React from 'react';

export const StreamSkeleton: React.FC = () => (
  <div className="relative rounded-2xl overflow-hidden shadow-xl bg-gradient-to-br from-[#1f1535] via-[#16102a] to-[#0f0820] border border-purple-500/40 animate-pulse">
    <div className="relative overflow-hidden h-32 bg-gray-700">
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
    </div>
    <div className="p-4 flex flex-col justify-between h-28 bg-gradient-to-t from-black/90 via-black/70 to-black/40">
      <div className="flex-1">
        <div className="h-4 bg-gray-600 rounded mb-2"></div>
      </div>
      <div className="flex items-center justify-between pt-2 border-t border-white/10">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <div className="w-6 h-6 rounded-full bg-gray-600 flex-shrink-0"></div>
          <div className="h-3 bg-gray-600 rounded w-20"></div>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0 ml-2">
          <span className="text-2xl">👁</span>
          <div className="h-3 bg-gray-600 rounded w-8"></div>
        </div>
      </div>
    </div>
  </div>
);

export const UserCardSkeleton: React.FC = () => (
  <div className="relative group bg-gradient-to-br from-[#1f1535]/80 via-[#16102a]/60 to-[#0f0820]/40 rounded-xl p-4 border border-purple-500/30 shadow-lg animate-pulse">
    <div className="relative z-10">
      <div className="relative">
        <div className="w-full aspect-square rounded-full bg-gray-600 border border-purple-400/50"></div>
      </div>
    </div>
    <div className="relative z-10 text-center flex-1 w-full mt-3">
      <div className="h-5 bg-gray-600 rounded mb-2"></div>
      <div className="flex items-center justify-center gap-2">
        <div className="h-4 bg-gray-600 rounded w-12"></div>
      </div>
    </div>
  </div>
);
