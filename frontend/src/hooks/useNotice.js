import { useState } from 'react';

const useNotice = () => {
  const [notice, setNotice] = useState({ 
    open: false, 
    type: 'success', 
    message: '' 
  });

  const showNotice = (type, message) => {
    setNotice({ open: true, type, message });
    setTimeout(() => setNotice((n) => ({ ...n, open: false })), 2500);
  };

  const closeNotice = () => {
    setNotice({ open: false, type: 'success', message: '' });
  };

  return {
    notice,
    showNotice,
    closeNotice
  };
};

export default useNotice;

