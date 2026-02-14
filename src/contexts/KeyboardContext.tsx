
import React, { createContext, useContext, useState, useEffect } from 'react';

interface KeyboardContextProps {
  isKeyboardVisible: boolean;
}

const KeyboardContext = createContext<KeyboardContextProps>({
  isKeyboardVisible: false,
});

export const KeyboardProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isKeyboardVisible, setKeyboardVisible] = useState(false);

  useEffect(() => {
    const handleResize = () => {
      const vh = window.innerHeight * 0.01;
      document.documentElement.style.setProperty('--vh', `${vh}px`);
      
      const isLikelyKeyboard = window.innerHeight < window.outerHeight * 0.7;
      setKeyboardVisible(isLikelyKeyboard);
    };

    window.addEventListener('resize', handleResize);
    handleResize();

    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  return (
    <KeyboardContext.Provider value={{ isKeyboardVisible }}>
      {children}
    </KeyboardContext.Provider>
  );
};

// eslint-disable-next-line react-refresh/only-export-components
export const useKeyboard = () => {
  return useContext(KeyboardContext);
};
