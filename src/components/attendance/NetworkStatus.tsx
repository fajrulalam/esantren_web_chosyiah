import { useNetworkStatus } from '@/app/attendance/hooks';
import { useState, useEffect } from 'react';

export default function NetworkStatusIndicator() {
  // Create a separate variable for online status on client 
  const [onlineStatus, setOnlineStatus] = useState(true);
  const [isClient, setIsClient] = useState(false);
  
  // Only render the full component after the first client-side render
  useEffect(() => {
    setIsClient(true);
    // Set initial online status
    setOnlineStatus(typeof navigator !== 'undefined' ? navigator.onLine : true);
    
    // Event listeners for online/offline events
    const handleOnline = () => setOnlineStatus(true);
    const handleOffline = () => setOnlineStatus(false);
    
    if (typeof window !== 'undefined') {
      window.addEventListener('online', handleOnline);
      window.addEventListener('offline', handleOffline);
    }
    
    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('online', handleOnline);
        window.removeEventListener('offline', handleOffline);
      }
    };
  }, []);
  
  // During SSR or first render, return a placeholder with the same dimensions
  if (!isClient) {
    return (
      <div className="network-status rounded-md px-3 py-1 text-sm font-medium opacity-0">
        <span className="flex items-center">
          <span className="mr-1 h-2 w-2 rounded-full"></span>
          Loading
        </span>
      </div>
    );
  }

  return (
    <div className={`network-status ${onlineStatus ? 'online' : 'offline'} rounded-md px-3 py-1 text-sm font-medium`}>
      {onlineStatus ? (
        <span className="flex items-center text-green-600 dark:text-green-400">
          <span className="mr-1 h-2 w-2 rounded-full bg-green-600 dark:bg-green-400"></span>
          Online
        </span>
      ) : (
        <span className="flex items-center text-amber-600 dark:text-amber-400">
          <span className="mr-1 h-2 w-2 rounded-full bg-amber-600 dark:bg-amber-400"></span>
          Offline - Changes will sync when reconnected
        </span>
      )}
    </div>
  );
}