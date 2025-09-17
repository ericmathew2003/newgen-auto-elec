import React from 'react';

const Pagination = ({ 
  currentPage, 
  totalPages, 
  totalRecords, 
  recordsPerPage, 
  onPageChange,
  showRecordCount = true 
}) => {
  const startIndex = (currentPage - 1) * recordsPerPage;
  const endIndex = Math.min(startIndex + recordsPerPage, totalRecords);

  const goToPreviousPage = () => {
    if (currentPage > 1) {
      onPageChange(currentPage - 1);
    }
  };

  const goToNextPage = () => {
    if (currentPage < totalPages) {
      onPageChange(currentPage + 1);
    }
  };

  if (totalRecords === 0) return null;

  return (
    <div className="flex items-center gap-2 text-sm text-gray-600">
      <button
        onClick={goToPreviousPage}
        disabled={currentPage === 1}
        className={`p-1 rounded ${
          currentPage === 1
            ? "text-gray-300 cursor-not-allowed"
            : "text-gray-600 hover:bg-gray-100"
        }`}
        title="Previous page"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
          <path d="M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z"/>
        </svg>
      </button>
      
      {showRecordCount && (
        <span className="font-medium">
          {startIndex + 1}-{endIndex} / {totalRecords}
        </span>
      )}
      
      <button
        onClick={goToNextPage}
        disabled={currentPage === totalPages}
        className={`p-1 rounded ${
          currentPage === totalPages
            ? "text-gray-300 cursor-not-allowed"
            : "text-gray-600 hover:bg-gray-100"
        }`}
        title="Next page"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
          <path d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z"/>
        </svg>
      </button>
    </div>
  );
};

export default Pagination;

