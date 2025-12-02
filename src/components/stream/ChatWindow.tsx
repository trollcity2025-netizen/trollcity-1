import ChatOverlay from './ChatOverlay'
import ChatInput from './ChatInput'

interface ChatWindowProps {
  streamId: string | undefined
}

export default function ChatWindow({ streamId }: ChatWindowProps) {
  return (
    <div className="flex flex-col h-full">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto mb-2">
        <ChatOverlay streamId={streamId} />
      </div>
      
      {/* Input */}
      <div className="flex-shrink-0">
        <ChatInput streamId={streamId} />
      </div>
    </div>
  )
}

