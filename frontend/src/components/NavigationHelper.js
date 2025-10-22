import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { useCallback } from 'react';

// Custom hook for consistent navigation across all pages
export const usePageNavigation = (basePath) => {
  const navigate = useNavigate();
  const { id } = useParams();
  const location = useLocation();

  const isNewMode = location.pathname === `${basePath}/new`;
  const isEditMode = location.pathname.startsWith(`${basePath}/edit/`);
  const isListMode = location.pathname === basePath;
  const showForm = isNewMode || isEditMode;

  const navigateToList = useCallback(() => navigate(basePath), [navigate, basePath]);
  const navigateToNew = useCallback(() => navigate(`${basePath}/new`), [navigate, basePath]);
  const navigateToEdit = useCallback((itemId) => navigate(`${basePath}/edit/${itemId}`), [navigate, basePath]);

  return {
    id,
    isNewMode,
    isEditMode,
    isListMode,
    showForm,
    navigateToList,
    navigateToNew,
    navigateToEdit,
    navigate
  };
};

// Breadcrumb component for consistent navigation
export const Breadcrumb = ({ basePath, currentPage, itemName }) => {
  const navigate = useNavigate();
  
  const pathSegments = [
    { name: 'Home', path: '/home' },
    { name: currentPage, path: basePath }
  ];

  if (itemName) {
    pathSegments.push({ name: itemName, path: null });
  }

  return (
    <nav className="flex mb-4" aria-label="Breadcrumb">
      <ol className="inline-flex items-center space-x-1 md:space-x-3">
        {pathSegments.map((segment, index) => (
          <li key={index} className="inline-flex items-center">
            {index > 0 && (
              <svg className="w-6 h-6 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
              </svg>
            )}
            {segment.path ? (
              <button
                onClick={() => navigate(segment.path)}
                className="ml-1 text-sm font-medium text-blue-600 hover:text-blue-800 md:ml-2"
              >
                {segment.name}
              </button>
            ) : (
              <span className="ml-1 text-sm font-medium text-gray-500 md:ml-2">
                {segment.name}
              </span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
};