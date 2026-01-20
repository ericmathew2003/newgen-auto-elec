import React from 'react';

const DarkModeWrapper = ({ children, className = "" }) => {
  return (
    <div className={`bg-white text-gray-900 transition-colors duration-200 ${className}`}>
      {children}
    </div>
  );
};

export default DarkModeWrapper;