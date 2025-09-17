import React from 'react';

const Notice = ({ notice, onClose }) => {
  if (!notice.open) return null;

  const noticeBg = {
    error: 'bg-red-700',
    warning: 'bg-amber-600',
    info: 'bg-blue-700',
    success: 'bg-green-500',
  }[notice.type || 'success'];

  return (
    <div className="fixed top-4 inset-x-0 flex justify-center z-50" role="alert">
      <div className={`${noticeBg} text-white px-4 py-3 rounded shadow-lg w-[90%] md:w-[600px] relative`}>
        <div className="font-bold">Newgen Alert</div>
        <div className="mt-1 pr-6">{notice.message}</div>
        <button
          type="button"
          aria-label="Close alert"
          className="absolute right-2 top-2 text-white/90 hover:text-white"
          onClick={onClose}
        >
          ×
        </button>
      </div>
    </div>
  );
};

export default Notice;

