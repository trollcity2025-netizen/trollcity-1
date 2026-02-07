import { useEffect, useState } from 'react';
import { toast } from 'sonner';

export function useVersionCheck() {
  const [currentVersion, setCurrentVersion] = useState<number | null>(null);

  useEffect(() => {
    // 1. Fetch initial version
    const checkVersion = async () => {
      try {
        const res = await fetch('/version.json?t=' + Date.now());
        if (!res.ok) return;
        const data = await res.json();
        
        if (currentVersion === null) {
          setCurrentVersion(data.buildTime);
        } else if (data.buildTime > currentVersion) {
           // New version detected!
           toast.info("New Update Available!", {
             description: "A new version of Troll City has been deployed.",
             action: {
               label: "Refresh Now",
               onClick: () => window.location.reload()
             },
             duration: Infinity, // Stay until clicked
             dismissible: false
           });
           setCurrentVersion(data.buildTime); // Prevent spamming
        }
      } catch (e) {
        console.error("Failed to check version", e);
      }
    };

    checkVersion();

    // 2. Poll every minute
    const interval = setInterval(checkVersion, 60000);
    
    // 3. Check on visibility change (tab focus)
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        checkVersion();
      }
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [currentVersion]);
}
