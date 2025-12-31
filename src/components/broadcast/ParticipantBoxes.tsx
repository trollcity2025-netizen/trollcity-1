import { X } from "lucide-react";

interface Participant {
  id: number;
  name: string;
  color: string;
  isSpeaking?: boolean;
}

interface ParticipantBoxesProps {
  participants: Participant[];
  onRemove?: (id: number) => void;
}

export default function ParticipantBoxes({
  participants,
  onRemove,
}: ParticipantBoxesProps) {
  if (!participants || participants.length === 0) {
    return null;
  }

  return (
    <div className="flex-[3] grid grid-cols-2 lg:grid-cols-4 gap-3">
      {participants.map((participant) => (
        <div
          key={participant.id}
          className="relative aspect-video bg-gradient-to-br from-gray-800 to-gray-900 rounded-lg overflow-hidden"
          style={{
            border: participant.isSpeaking
              ? "2px solid"
              : "2px solid " + participant.color,
            boxShadow: participant.isSpeaking
              ? "0 0 20px " +
                participant.color +
                ", inset 0 0 20px " +
                participant.color +
                "40"
              : "0 0 15px " +
                participant.color +
                "99, inset 0 0 15px " +
                participant.color +
                "33",
            animation: participant.isSpeaking
              ? "rgbRotate 2s infinite"
              : "none",
          }}
        >
          <div className="w-full h-full flex items-center justify-center">
            <div className="text-center">
              <div
                className="w-12 h-12 mx-auto mb-2 rounded-full flex items-center justify-center text-xl font-bold text-white"
                style={{ backgroundColor: participant.color }}
              >
                {participant.name.charAt(0)}
              </div>
            </div>
          </div>
          <div className="absolute top-2 left-2 bg-black/70 px-2 py-1 rounded text-xs font-bold">
            {participant.name}
          </div>
          {participants.length > 1 && (
            <button
              onClick={() => onRemove?.(participant.id)}
              className="absolute top-2 right-2 p-1 bg-red-600/80 hover:bg-red-700 rounded transition-colors"
            >
              <X size={14} />
            </button>
          )}
        </div>
      ))}
    </div>
  );
}
