import { useState, useEffect } from 'react';

const usePagination = (data, recordsPerPage = 50) => {
  const [currentPage, setCurrentPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState("");

  // Reset to page 1 when search changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm]);

  const totalRecords = data.length;
  const totalPages = Math.ceil(totalRecords / recordsPerPage);
  const startIndex = (currentPage - 1) * recordsPerPage;
  const endIndex = startIndex + recordsPerPage;
  const currentRecords = data.slice(startIndex, endIndex);

  const goToPreviousPage = () => {
    if (currentPage > 1) {
      setCurrentPage(currentPage - 1);
    }
  };

  const goToNextPage = () => {
    if (currentPage < totalPages) {
      setCurrentPage(currentPage + 1);
    }
  };

  return {
    currentPage,
    setCurrentPage,
    totalPages,
    totalRecords,
    startIndex,
    endIndex,
    currentRecords,
    goToPreviousPage,
    goToNextPage,
    searchTerm,
    setSearchTerm
  };
};

export default usePagination;

