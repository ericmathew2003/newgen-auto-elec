import React from 'react';

const DarkModeWrapper = ({ children, className = "" }) => {
  return (
    <div className={`bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 transition-colors duration-200 ${className}`}>
      {children}
    </div>
  );
};

export default DarkModeWrapper;