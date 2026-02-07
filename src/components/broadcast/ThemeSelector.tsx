import React, { useEffect, useState, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../lib/store';
import { toast } from 'sonner';
import { Palette, Check, Loader2 } from 'lucide-react';
import { cn } from '../../lib/utils';

interface ThemeSelectorProps {
    streamId: string;
    currentThemeUrl?: string | null;
    onClose: () => void;
}

interface ThemeItem {
    id: string; // inventory id
    item_id: string;
    marketplace_item: {
        id: string;
        name: string;
        description: string;
        asset_url: string; // The background image URL
        type: string;
    };
}

export default function ThemeSelector({ streamId, currentThemeUrl, onClose }: ThemeSelectorProps) {
    const { user } = useAuthStore();
    const [themes, setThemes] = useState<ThemeItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [activating, setActivating] = useState<string | null>(null);

    const fetchThemes = useCallback(async () => {
        setLoading(true);
        try {
            // Fetch inventory items
            const { data: inventory, error: inventoryError } = await supabase
                .from('user_inventory')
                .select('id, item_id')
                .eq('user_id', user!.id);

            if (inventoryError) throw inventoryError;

            if (!inventory || inventory.length === 0) {
                setThemes([]);
                return;
            }

            // Extract item IDs
            const itemIds = inventory.map(i => i.item_id).filter(Boolean);

            // Fetch marketplace items manually to avoid relationship errors
            const { data: items, error: itemsError } = await supabase
                .from('marketplace_items')
                .select('id, name, description, asset_url, type')
                .in('id', itemIds)
                .eq('type', 'broadcast_theme');

            if (itemsError) throw itemsError;

            if (!items) {
                setThemes([]);
                return;
            }

            // Create a map for quick lookup
            const itemMap = new Map(items.map(i => [i.id, i]));

            // Combine inventory with marketplace items
            const themes: ThemeItem[] = inventory
                .filter(inv => itemMap.has(inv.item_id))
                .map(inv => ({
                    id: inv.id,
                    item_id: inv.item_id,
                    marketplace_item: itemMap.get(inv.item_id)!
                }));

            setThemes(themes);
        } catch (err) {
            console.error('Error fetching themes:', err);
            toast.error('Failed to load themes');
        } finally {
            setLoading(false);
        }
    }, [user]);

    useEffect(() => {
        if (!user) return;
        fetchThemes();
    }, [user, fetchThemes]);

    const handleSelectTheme = async (themeUrl: string | null) => {
        if (!user) return;
        setActivating(themeUrl || 'default');
        
        try {
            const { error } = await supabase
                .from('streams')
                .update({ active_theme_url: themeUrl })
                .eq('id', streamId);

            if (error) throw error;
            toast.success(themeUrl ? "Theme activated" : "Theme reset");
        } catch (e) {
            console.error(e);
            toast.error("Failed to update theme");
        } finally {
            setActivating(null);
        }
    };

    return (
        <div className="absolute bottom-full right-0 w-80 mb-4 bg-zinc-900 border border-purple-500/30 rounded-xl p-4 shadow-2xl z-[100] animate-in slide-in-from-bottom-2">
            <div className="flex justify-between items-center mb-4">
                <h3 className="font-bold text-white flex items-center gap-2">
                    <Palette size={16} className="text-purple-400" />
                    Broadcast Themes
                </h3>
                <button onClick={onClose} className="text-sm text-zinc-400 hover:text-white">Close</button>
            </div>

            {loading ? (
                <div className="flex justify-center py-8"><Loader2 className="animate-spin text-purple-500" /></div>
            ) : (
                <div className="grid grid-cols-2 gap-2 max-h-80 overflow-y-auto pr-1">
                    {/* Default Theme Option */}
                    <button
                        onClick={() => handleSelectTheme(null)}
                        disabled={activating !== null}
                        className={cn(
                            "relative aspect-video rounded-lg border-2 overflow-hidden transition-all",
                            !currentThemeUrl ? "border-green-500 ring-2 ring-green-500/20" : "border-white/10 hover:border-white/30"
                        )}
                    >
                        <div className="absolute inset-0 bg-gradient-to-b from-zinc-800 to-black flex items-center justify-center">
                            <span className="text-xs font-bold text-zinc-400">Default</span>
                        </div>
                        {!currentThemeUrl && (
                            <div className="absolute top-1 right-1 bg-green-500 rounded-full p-0.5">
                                <Check size={10} className="text-black" />
                            </div>
                        )}
                    </button>

                    {themes.map((theme) => {
                        const isActive = currentThemeUrl === theme.marketplace_item.asset_url;
                        return (
                            <button
                                key={theme.id}
                                onClick={() => handleSelectTheme(theme.marketplace_item.asset_url)}
                                disabled={activating !== null}
                                className={cn(
                                    "relative aspect-video rounded-lg border-2 overflow-hidden transition-all group",
                                    isActive ? "border-green-500 ring-2 ring-green-500/20" : "border-white/10 hover:border-white/30"
                                )}
                            >
                                {theme.marketplace_item.asset_url ? (
                                    <img 
                                        src={theme.marketplace_item.asset_url} 
                                        alt={theme.marketplace_item.name} 
                                        className="w-full h-full object-cover"
                                    />
                                ) : (
                                    <div className="w-full h-full bg-purple-900/20 flex items-center justify-center text-xs text-purple-300">
                                        No Image
                                    </div>
                                )}
                                
                                <div className="absolute inset-x-0 bottom-0 bg-black/60 p-1 truncate text-[10px] text-center text-white backdrop-blur-sm">
                                    {theme.marketplace_item.name}
                                </div>

                                {isActive && (
                                    <div className="absolute top-1 right-1 bg-green-500 rounded-full p-0.5">
                                        <Check size={10} className="text-black" />
                                    </div>
                                )}
                            </button>
                        );
                    })}
                </div>
            )}
            
            {themes.length === 0 && !loading && (
                <div className="text-center py-4 text-xs text-zinc-500">
                    No themes found in inventory.
                    <br />
                    Visit the Marketplace to buy themes!
                </div>
            )}
        </div>
    );
}