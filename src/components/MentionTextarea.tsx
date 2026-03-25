import { useState, useRef, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useNavigate } from 'react-router-dom'

interface MentionUser {
  id: string
  username: string
  avatar_url: string | null
  is_admin: boolean
}

interface MentionTextareaProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  rows?: number
  maxLength?: number
  className?: string
  required?: boolean
  disabled?: boolean
  id?: string
  onFocus?: () => void
}

export default function MentionTextarea({
  value,
  onChange,
  placeholder,
  rows,
  maxLength,
  className,
  required,
  disabled,
  id,
  onFocus,
}: MentionTextareaProps) {
  const navigate = useNavigate()
  const [showDropdown, setShowDropdown] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [users, setUsers] = useState<MentionUser[]>([])
  const [loading, setLoading] = useState(false)
  const [highlightedIndex, setHighlightedIndex] = useState(0)
  const [triggerPos, setTriggerPos] = useState(-1)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const searchUsers = useCallback(async (query: string) => {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('id, username, avatar_url, is_admin')
        .ilike('username', `${query.toLowerCase()}%`)
        .limit(8)
        .order('is_admin', { ascending: false })

      if (error) throw error
      setUsers(data || [])
    } catch (err) {
      console.error('Error searching users for mention:', err)
      setUsers([])
    } finally {
      setLoading(false)
    }
  }, [])

  const detectMention = useCallback(() => {
    const textarea = textareaRef.current
    if (!textarea) return

    const cursorPos = textarea.selectionStart
    const textBeforeCursor = value.substring(0, cursorPos)

    // Find the last # that starts a mention (not preceded by a word char)
    const mentionMatch = textBeforeCursor.match(/(?:^|\s)#(\w*)$/)

    if (mentionMatch) {
      const query = mentionMatch[1]
      // Position of the # character
      const hashPos = cursorPos - mentionMatch[0].length + (mentionMatch[0].startsWith('#') ? 0 : 1)
      setTriggerPos(hashPos)
      setSearchQuery(query)
      setShowDropdown(true)
      setHighlightedIndex(0)

      if (debounceRef.current) clearTimeout(debounceRef.current)
      debounceRef.current = setTimeout(() => {
        searchUsers(query)
      }, 150)
    } else {
      setShowDropdown(false)
      setTriggerPos(-1)
    }
  }, [value, searchUsers])

  useEffect(() => {
    detectMention()
  }, [detectMention])

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node) &&
        textareaRef.current &&
        !textareaRef.current.contains(e.target as Node)
      ) {
        setShowDropdown(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleSelectUser = (user: MentionUser) => {
    const textarea = textareaRef.current
    if (!textarea || triggerPos < 0) return

    const before = value.substring(0, triggerPos)
    const after = value.substring(textarea.selectionStart)
    const newValue = `${before}#${user.username} ${after}`

    onChange(newValue)
    setShowDropdown(false)
    setTriggerPos(-1)

    // Restore cursor position after the inserted mention
    requestAnimationFrame(() => {
      const newCursorPos = triggerPos + user.username.length + 2 // +2 for # and space
      textarea.focus()
      textarea.setSelectionRange(newCursorPos, newCursorPos)
    })
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (!showDropdown || users.length === 0) return

    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setHighlightedIndex((prev) => (prev + 1) % users.length)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setHighlightedIndex((prev) => (prev - 1 + users.length) % users.length)
    } else if (e.key === 'Enter' || e.key === 'Tab') {
      e.preventDefault()
      handleSelectUser(users[highlightedIndex])
    } else if (e.key === 'Escape') {
      setShowDropdown(false)
    }
  }

  const handleTagClick = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement
    if (target.dataset.username) {
      e.preventDefault()
      e.stopPropagation()
      navigate(`/profile/${target.dataset.username}`)
    }
  }

  // Render value with styled #tags in an overlay
  const renderHighlightedText = () => {
    if (!value) return null
    const tagRegex = /#(\w+)/g
    const parts: React.ReactNode[] = []
    let lastIndex = 0
    let match: RegExpExecArray | null

    while ((match = tagRegex.exec(value)) !== null) {
      if (match.index > lastIndex) {
        parts.push(value.slice(lastIndex, match.index))
      }
      parts.push(
        <span
          key={match.index}
          className="text-purple-400 font-semibold cursor-pointer hover:text-purple-300"
          data-username={match[1]}
          onClick={handleTagClick}
        >
          #{match[1]}
        </span>
      )
      lastIndex = match.index + match[0].length
    }
    if (lastIndex < value.length) {
      parts.push(value.slice(lastIndex))
    }
    return parts
  }

  return (
    <div className="relative">
      {/* Highlighted overlay - only visible when there are tags */}
      {value && /#\w/.test(value) && (
        <div
          aria-hidden="true"
          className={`absolute inset-0 pointer-events-auto whitespace-pre-wrap overflow-hidden ${className || ''}`}
          style={{
            padding: textareaRef.current
              ? window.getComputedStyle(textareaRef.current).padding
              : undefined,
            font: textareaRef.current
              ? window.getComputedStyle(textareaRef.current).font
              : undefined,
            lineHeight: textareaRef.current
              ? window.getComputedStyle(textareaRef.current).lineHeight
              : undefined,
          }}
          onClick={handleTagClick}
        >
          {renderHighlightedText()}
        </div>
      )}
      <textarea
        ref={textareaRef}
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        onFocus={onFocus}
        placeholder={placeholder}
        rows={rows}
        maxLength={maxLength}
        className={`${className} ${value && /#\w/.test(value) ? 'text-transparent caret-white' : ''}`}
        required={required}
        disabled={disabled}
      />
      {/* Mention Dropdown */}
      {showDropdown && (
        <div
          ref={dropdownRef}
          className="absolute bottom-full mb-2 left-0 w-64 bg-[#1A1A1A] border border-purple-600 rounded-lg shadow-lg z-50 max-h-48 overflow-y-auto"
        >
          {loading ? (
            <div className="p-3 text-center text-gray-400 text-sm">Searching...</div>
          ) : users.length === 0 ? (
            <div className="p-3 text-center text-gray-400 text-sm">No users found</div>
          ) : (
            users.map((user, index) => (
              <div
                key={user.id}
                onClick={() => handleSelectUser(user)}
                className={`p-2.5 cursor-pointer flex items-center gap-2 border-b border-[#2C2C2C] last:border-b-0 transition-colors ${
                  index === highlightedIndex ? 'bg-purple-600/20' : 'hover:bg-purple-600/10'
                }`}
              >
                <img
                  src={
                    user.avatar_url ||
                    `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.username}`
                  }
                  alt={user.username}
                  className="w-8 h-8 rounded-full border border-purple-500"
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm text-white font-medium truncate">
                      {user.username}
                    </span>
                    {user.is_admin && (
                      <span className="text-[10px] px-1.5 py-0.5 bg-amber-500/20 text-amber-400 rounded font-semibold">
                        Admin
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  )
}
