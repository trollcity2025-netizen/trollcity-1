
import React from 'react';

interface MaiTalentLayoutProps {
  children: React.ReactNode;
}

const MaiTalentLayout: React.FC<MaiTalentLayoutProps> = ({ children }) => {
  return (
    <div className="min-h-screen w-full bg-[#0b1220] text-white flex flex-col">
      <div className="flex-1 w-full max-w-[1600px] mx-auto px-4 py-6">
        {children}
      </div>
    </div>
  );
};

export default MaiTalentLayout;
