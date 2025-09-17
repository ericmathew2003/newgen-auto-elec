import React, { useState } from 'react';

const SearchBar = ({ 
  searchTerm, 
  onSearchChange, 
  placeholder = "Search...",
  searchFields = null,
  onSearchFieldsChange = null,
  showFieldFilters = false 
}) => {
  const [showSearchFields, setShowSearchFields] = useState(false);

  const toggleSearchField = (key) => {
    if (!onSearchFieldsChange || !searchFields) return;
    
    const selectedCount = Object.values(searchFields).filter(Boolean).length;
    const nextVal = !searchFields[key];
    
    // Keep at least one field selected
    if (!nextVal && selectedCount === 1) return;
    
    onSearchFieldsChange({ ...searchFields, [key]: nextVal });
  };

  return (
    <div className="relative flex items-center gap-2">
      <div className="relative">
        <input
          type="text"
          placeholder={placeholder}
          value={searchTerm}
          onChange={(e) => onSearchChange(e.target.value)}
          className="pl-8 pr-4 py-2 text-sm border rounded-md w-64"
        />
        <svg
          className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-400"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
          />
        </svg>
      </div>
      
      {showFieldFilters && searchFields && (
        <div className="relative">
          <button
            type="button"
            className="px-2 py-2 text-sm border rounded-md flex items-center gap-1"
            onClick={() => setShowSearchFields((s) => !s)}
            title="Select fields to search"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <path d="M3 4h18l-7 8v6l-4 2v-8L3 4z" />
            </svg>
            Filters
          </button>
          
          {showSearchFields && (
            <div className="absolute right-0 mt-2 w-56 bg-white border rounded shadow p-3 z-20">
              <div className="text-xs font-semibold text-gray-600 mb-2">Search in fields</div>
              {Object.entries(searchFields).map(([key, value]) => (
                <label key={key} className="flex items-center gap-2 py-1 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={value}
                    onChange={() => toggleSearchField(key)}
                  />
                  <span className="text-sm capitalize">{key.replace(/([A-Z])/g, ' $1').trim()}</span>
                </label>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default SearchBar;

