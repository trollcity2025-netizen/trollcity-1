import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuthStore } from '../../lib/store';

interface TMButtonProps {
  className?: string;
}

export function TMButton({ className = '' }: TMButtonProps) {
  const navigate = useNavigate();
  const { user } = useAuthStore();

  if (!user) return null;

  return (
    <motion.button
      onClick={() => navigate('/match')}
      className={`
        relative px-4 py-2 font-bold text-white rounded-xl
        bg-gradient-to-r from-purple-600 to-purple-500
        hover:from-purple-500 hover:to-purple-400
        shadow-lg shadow-purple-500/30
        transition-all duration-300
        ${className}
      `}
      whileHover={{ 
        scale: 1.05,
        boxShadow: '0 0 20px rgba(168, 85, 247, 0.5)'
      }}
      whileTap={{ scale: 0.95 }}
    >
      <span className="flex items-center gap-2">
        <span className="text-sm font-black tracking-wider">TM</span>
      </span>
      
      {/* Glow effect */}
      <div className="absolute inset-0 rounded-xl bg-purple-400 opacity-0 hover:opacity-20 transition-opacity duration-300 blur-xl" />
    </motion.button>
  );
}

export default TMButton;
