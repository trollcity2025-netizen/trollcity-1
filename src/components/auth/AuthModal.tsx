import React, { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogTitle } from '../ui/dialog';
import Auth from '../../pages/Auth';
import { useSearchParams, useNavigate } from 'react-router-dom';

const VisuallyHidden = ({ children }: { children: React.ReactNode }) => (
  <span className="sr-only">{children}</span>
);

export default function AuthModal() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const [initialMode, setInitialMode] = useState<'login' | 'signup'>('login');

  useEffect(() => {
    const mode = searchParams.get('mode');
    const signup = searchParams.get('signup');
    
    if (mode === 'signup' || mode === 'login' || signup === 'true') {
      setInitialMode(mode === 'signup' || signup === 'true' ? 'signup' : 'login');
      setIsOpen(true);
    } else {
      setIsOpen(false);
    }
  }, [searchParams]);

  const handleClose = () => {
    setIsOpen(false);
    // Remove auth params from URL but keep others if needed, or just go to root
    const newParams = new URLSearchParams(searchParams);
    newParams.delete('mode');
    newParams.delete('signup');
    navigate({ search: newParams.toString() }, { replace: true });
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent 
        className="sm:max-w-md bg-transparent border-none shadow-none p-0 max-h-[90vh] overflow-y-auto scrollbar-hide translate-y-8"
      >
        <VisuallyHidden>
            <DialogTitle>Authentication</DialogTitle>
        </VisuallyHidden>
        <div className="bg-slate-900/90 backdrop-blur-xl border border-white/10 rounded-3xl overflow-hidden shadow-2xl">
          <Auth embedded={true} onClose={handleClose} initialMode={initialMode} />
        </div>
      </DialogContent>
    </Dialog>
  );
}
