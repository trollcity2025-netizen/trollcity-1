
import React from 'react';
import { User } from 'lucide-react';

const ViewerSeats = () => {
  const viewerCount = 12458;
  const maxVisibleAvatars = 50;

  return (
    <div className="w-full h-24 bg-gray-950 rounded-t-lg flex items-center justify-center flex-col pt-4">
      <div className="flex items-center justify-center -space-x-2 mb-2">
        {Array.from({ length: Math.min(viewerCount, maxVisibleAvatars) }).map((_, index) => (
          <div 
            key={index} 
            className="w-8 h-8 rounded-full bg-gray-700 flex items-center justify-center border-2 border-gray-950"
            style={{ zIndex: maxVisibleAvatars - index }}
          >
            <User className="w-4 h-4 text-gray-500" />
          </div>
        ))}
      </div>
      <p className="text-gray-400 font-bold text-lg">
        + {viewerCount.toLocaleString()} watching
      </p>
    </div>
  );
};

export default ViewerSeats;
