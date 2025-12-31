import { useState } from "react";
import { X, Send } from "lucide-react";

interface NewUserApplicationModalProps {
  onClose: () => void;
  onSubmit?: (application: {
    username: string;
    email: string;
    reason: string;
  }) => void;
}

export default function NewUserApplicationModal({
  onClose,
  onSubmit,
}: NewUserApplicationModalProps) {
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [reason, setReason] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = () => {
    if (!username.trim() || !email.trim() || !reason.trim()) {
      alert("Please fill in all fields");
      return;
    }

    onSubmit?.({ username, email, reason });
    setSubmitted(true);

    setTimeout(() => {
      onClose();
    }, 2000);
  };

  if (submitted) {
    return (
      <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
        <div className="bg-gray-900 rounded-lg p-8 max-w-sm w-full purple-neon text-center">
          <div className="text-5xl mb-4">✨</div>
          <h2 className="text-2xl font-bold mb-2">Application Submitted!</h2>
          <p className="text-gray-400 mb-4">
            Your application has been sent to admins and lead troll officers for review.
          </p>
          <p className="text-sm text-gray-500">
            Redirecting to admin/lead officers page...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 rounded-lg p-6 max-w-sm w-full purple-neon">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold">New User Application</h2>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-800 rounded transition"
          >
            <X size={20} />
          </button>
        </div>

        <div className="space-y-4 mb-4">
          <div>
            <label className="text-sm font-bold block mb-2">Username</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Enter your username"
              className="w-full bg-gray-800 border border-purple-500/30 rounded px-3 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-purple-500 transition"
            />
          </div>

          <div>
            <label className="text-sm font-bold block mb-2">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="your@email.com"
              className="w-full bg-gray-800 border border-purple-500/30 rounded px-3 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-purple-500 transition"
            />
          </div>

          <div>
            <label className="text-sm font-bold block mb-2">
              Why do you want to join?
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Tell us about yourself..."
              className="w-full bg-gray-800 border border-purple-500/30 rounded px-3 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-purple-500 transition resize-none h-24"
            />
          </div>
        </div>

        <div className="flex gap-2">
          <button
            onClick={onClose}
            className="flex-1 px-3 py-2 bg-gray-800 hover:bg-gray-700 rounded transition"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            className="flex-1 px-3 py-2 bg-purple-600 hover:bg-purple-700 rounded font-bold transition flex items-center justify-center gap-2"
          >
            <Send size={16} />
            Submit
          </button>
        </div>
      </div>
    </div>
  );
}
