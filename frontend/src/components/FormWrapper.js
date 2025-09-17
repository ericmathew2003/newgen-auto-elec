import React from 'react';

const FormWrapper = ({ 
  title, 
  children, 
  onClose, 
  showRecordNavigation = false,
  recordNavigation = null 
}) => {
  return (
    <div className="bg-white border rounded-lg shadow-sm">
      <div className="flex items-center justify-between px-5 py-3 border-b">
        <h2 className="text-[15px] font-semibold">{title}</h2>
        <div className="flex items-center gap-4">
          {showRecordNavigation && recordNavigation && (
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <button
                type="button"
                onClick={recordNavigation.onPrevious}
                disabled={recordNavigation.isFirst}
                className={`p-1 rounded ${
                  recordNavigation.isFirst
                    ? "text-gray-300 cursor-not-allowed"
                    : "text-gray-600 hover:bg-gray-100"
                }`}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z"/>
                </svg>
              </button>
              <span className="font-medium">
                Record {recordNavigation.currentIndex + 1} / {recordNavigation.totalRecords}
              </span>
              <button
                type="button"
                onClick={recordNavigation.onNext}
                disabled={recordNavigation.isLast}
                className={`p-1 rounded ${
                  recordNavigation.isLast
                    ? "text-gray-300 cursor-not-allowed"
                    : "text-gray-600 hover:bg-gray-100"
                }`}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z"/>
                </svg>
              </button>
            </div>
          )}
          <button
            className="text-gray-500 hover:text-gray-700"
            onClick={onClose}
            aria-label="Close"
          >
            ✕
          </button>
        </div>
      </div>
      <div className="px-5 py-4">
        {children}
      </div>
    </div>
  );
};

export default FormWrapper;

