import React, { createContext, useContext, useState, useEffect } from 'react';

const DarkModeContext = createContext();

export const useDarkMode = () => {
  const context = useContext(DarkModeContext);
  if (!context) {
    throw new Error('useDarkMode must be used within a DarkModeProvider');
  }
  return context;
};

export const DarkModeProvider = ({ children }) => {
  const [isDarkMode, setIsDarkMode] = useState(false); // Always force light mode

  useEffect(() => {
    // Always ensure light mode
    localStorage.setItem('darkMode', JSON.stringify(false));
    
    // Always remove dark class from document
    document.documentElement.classList.remove('dark');
  }, [isDarkMode]);

  const toggleDarkMode = () => {
    // Disable toggle - always stay in light mode
    setIsDarkMode(false);
  };

  return (
    <DarkModeContext.Provider value={{ isDarkMode: false, toggleDarkMode }}>
      {children}
    </DarkModeContext.Provider>
  );
};