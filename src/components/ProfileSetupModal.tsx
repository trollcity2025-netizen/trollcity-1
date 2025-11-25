import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

interface ProfileSetupModalProps {
  isOpen: boolean;
  onSubmit: (username: string, bio?: string) => void;
  loading: boolean;
  onClose?: () => void;
}

const ProfileSetupModal: React.FC<ProfileSetupModalProps> = ({ isOpen, onSubmit, loading, onClose }) => {
  const [username, setUsername] = useState('');
  const [bio, setBio] = useState('');
  const inputRef = useRef<HTMLInputElement | null>(null);

  // focus the username input when modal opens and allow Escape to close
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus()
    }

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose?.()
      }
    }

    if (isOpen) document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [isOpen, onClose]);

  if (!isOpen) return null;

 
  const content = (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black bg-opacity-70"
      role="dialog"
      aria-modal="true"
      onClick={() => onClose?.()}
    >
      <div
        className="bg-[#18181b] p-8 rounded-xl shadow-lg w-full max-w-md pointer-events-auto"
        style={{ zIndex: 10000 }}
        onClick={e => e.stopPropagation()}
        tabIndex={-1}
      >
        <h2 className="text-2xl font-bold mb-4 text-white">Complete Your Profile</h2>
        <form
          onSubmit={e => {
            e.preventDefault();
            onSubmit(username, bio);
          }}
          className="space-y-4"
        >
          <div>
            <label className="block text-sm font-medium text-gray-200 mb-1">Username</label>
            <input
              ref={inputRef}
              id="profile-username"
              name="username"
              type="text"
              required
              value={username}
              onChange={e => setUsername(e.target.value)}
              className="w-full px-4 py-2 rounded bg-[#23232b] text-white border border-gray-600 focus:outline-none"
              placeholder="Choose a username"
              autoComplete="off"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-200 mb-1">Bio (optional)</label>
            <textarea
              value={bio}
              onChange={e => setBio(e.target.value)}
              className="w-full px-4 py-2 rounded bg-[#23232b] text-white border border-gray-600 focus:outline-none"
              placeholder="Tell us about yourself"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full py-2 mt-2 bg-gradient-to-r from-[#FFC93C] to-[#FFD700] text-black font-semibold rounded hover:shadow-lg disabled:opacity-50"
          >
            {loading ? 'Saving...' : 'Save Profile'}
          </button>
        </form>
      </div>
    </div>
  )

  // Render modal into document.body to avoid being trapped behind other layout
  return createPortal(content, document.body)
};

export default ProfileSetupModal;
