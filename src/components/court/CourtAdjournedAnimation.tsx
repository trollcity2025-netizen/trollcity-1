
import React from 'react';
import { motion } from 'framer-motion';

const CourtAdjournedAnimation: React.FC = () => {
  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[100]">
      <motion.div
        initial={{ scale: 0.5, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 260, damping: 20 }}
      >
        <div className="relative">
          {/* Gavel */}
          <motion.div
            initial={{ rotate: -45, y: -200, x: -100 }}
            animate={{ rotate: 10, y: 0, x: 0 }}
            transition={{ delay: 0.5, type: 'spring', stiffness: 100 }}
            className="z-10 relative"
          >
            <div 
              className="w-24 h-64 bg-yellow-800 rounded-full transform -rotate-45 relative"
              style={{
                boxShadow: 'inset 0 0 10px #000000a0',
              }}
            >
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-28 h-10 bg-yellow-900 rounded-md" />
            </div>
          </motion.div>

          {/* Block */}
          <div 
            className="w-64 h-24 bg-yellow-900 rounded-lg transform skew-x-[-20deg] relative"
            style={{
              boxShadow: 'inset 0 0 20px #000000a0, 5px 5px 15px #000000a0',
            }}
          >
             <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent rounded-lg"/>
          </div>
          
          {/* Text */}
          <motion.h1
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1.5, duration: 0.5 }}
            className="text-white text-6xl font-serif absolute -bottom-24 left-1/2 -translate-x-1/2 whitespace-nowrap"
          >
            Court Adjourned
          </motion.h1>
        </div>
      </motion.div>
    </div>
  );
};

export default CourtAdjournedAnimation;
