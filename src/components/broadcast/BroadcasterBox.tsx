import React from "react";
import { Card } from "@/components/ui/card";
import { Video, Radio } from "lucide-react";

interface BroadcasterBoxProps {
  broadcasterName?: string | null;
  thumbnail?: string | null;
}

export default function BroadcasterBox({ broadcasterName, thumbnail }: BroadcasterBoxProps) {
  return (
    <Card className="bg-gray-800/50 border-gray-700 overflow-hidden">
      <div className="relative aspect-video bg-gradient-to-br from-green-500/20 to-purple-500/20">
        {thumbnail ? (
          <img src={thumbnail} alt="Stream" className="w-full h-full object-cover" />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center">
            <Video className="w-24 h-24 text-gray-600" />
          </div>
        )}

        {/* Broadcaster Label */}
        <div className="absolute top-4 left-4 flex items-center gap-2 px-3 py-1.5 rounded-full bg-black/60 border border-green-500/50">
          <Radio className="w-4 h-4 text-green-400 animate-pulse" />
          <span className="text-sm font-bold text-white">{broadcasterName}</span>
        </div>

        {/* Live Indicator */}
        <div className="absolute top-4 right-4 px-3 py-1.5 rounded-full bg-red-500 border-2 border-white">
          <span className="text-xs font-black text-white">LIVE</span>
        </div>
      </div>
    </Card>
  );
}
