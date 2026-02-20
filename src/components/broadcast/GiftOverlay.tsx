import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useUIStore } from '../../lib/ui-store';
import { GiftMessageType } from './BroadcastChat';
import { Coins } from 'lucide-react';
import { cn } from '../../lib/utils';

const rarityStyles = {
    common: { bg: 'bg-zinc-800/90', border: 'border-zinc-700', text: 'text-zinc-200' },
    rare: { bg: 'bg-blue-800/90', border: 'border-blue-700', text: 'text-blue-200' },
    epic: { bg: 'bg-purple-800/90', border: 'border-purple-700', text: 'text-purple-200' },
    legendary: { bg: 'bg-yellow-800/90', border: 'border-yellow-700', text: 'text-yellow-200' },
};

const GiftOverlay: React.FC = () => {
    const lastGift = useUIStore((state) => state.lastGift);
    const [visibleGift, setVisibleGift] = useState<GiftMessageType | null>(null);

    useEffect(() => {
        if (lastGift) {
            setVisibleGift(lastGift);
            const timer = setTimeout(() => {
                setVisibleGift(null);
            }, 4000); // Should be slightly less than the gift message visibility in chat

            return () => clearTimeout(timer);
        }
    }, [lastGift]);

    const variants = {
        initial: { opacity: 0, y: -100, scale: 0.5 },
        animate: { opacity: 1, y: 0, scale: 1, transition: { type: 'spring', stiffness: 200, damping: 15 } },
        exit: { opacity: 0, y: 100, scale: 0.5, transition: { duration: 0.5 } },
    };

    if (!visibleGift) {
        return null;
    }

    const styles = rarityStyles[visibleGift.rarity];

    return (
        <AnimatePresence>
            {visibleGift && (
                <motion.div
                    key={visibleGift.id}
                    variants={variants}
                    initial="initial"
                    animate="animate"
                    exit="exit"
                    className={cn(
                        'fixed top-1/4 left-1/2 -translate-x-1/2 w-80 p-4 rounded-xl shadow-2xl z-50 flex flex-col items-center',
                        styles.bg, styles.border, 'border-2'
                    )}
                >
                    <div className="text-lg font-bold text-white">{visibleGift.user_profiles?.username || visibleGift.username} sent a gift!</div>
                    
                    {visibleGift.gift_icon && (
                        <motion.div initial={{ scale: 0 }} animate={{ scale: 1, rotate: [0, 10, -10, 0] }} transition={{ delay: 0.2, duration: 0.5 }}>
                            {visibleGift.gift_icon.startsWith('http') ? (
                                <img src={visibleGift.gift_icon} alt={visibleGift.gift_name} className="w-24 h-24 my-4" />
                            ) : (
                                <span className="text-6xl my-4">{visibleGift.gift_icon}</span>
                            )}
                        </motion.div>
                    )}

                    <div className={cn('text-2xl font-bold', styles.text)}>{visibleGift.gift_name} x{visibleGift.gift_count}</div>
                    
                    <div className="flex items-center gap-2 mt-2">
                        <Coins size={20} className={styles.text} />
                        <span className={cn('text-xl font-bold', styles.text)}>
                            {(visibleGift.gift_value * visibleGift.gift_count).toLocaleString()}
                        </span>
                    </div>

                    {visibleGift.rarity === 'legendary' && (
                        <div className="absolute inset-0 rounded-xl pointer-events-none animate-pulse-slow" style={{ border: '3px solid gold', boxShadow: '0 0 20px gold' }}></div>
                    )}
                </motion.div>
            )}
        </AnimatePresence>
    );
};

export default GiftOverlay;
