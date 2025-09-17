import React from 'react';

const PageHeader = ({ 
  title, 
  onNew, 
  showForm, 
  onSave, 
  onCancel, 
  onSaveAndAddAnother,
  canSave,
  isEditing,
  pagination = null,
  searchBar = null 
}) => {
  return (
    <div className="flex flex-col items-start mb-4">
      <div className="flex items-center justify-between w-full mb-2">
        <div className="flex items-center gap-2">
          <button
            onClick={onNew}
            className="bg-purple-600 text-white px-4 py-2 rounded-lg shadow hover:bg-purple-700"
          >
            New
          </button>

          {!showForm && searchBar}

          {showForm && (
            <>
              {!isEditing && (
                <button
                  type="button"
                  disabled={!canSave}
                  className={`px-3 py-2 text-sm border rounded ${
                    canSave ? "" : "opacity-50 cursor-not-allowed"
                  }`}
                  onClick={onSaveAndAddAnother}
                >
                  Save & Add Another
                </button>
              )}
              <button
                type="button"
                className="px-3 py-2 text-sm border rounded"
                onClick={onCancel}
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!canSave}
                onClick={onSave}
                className={`px-4 py-2 text-sm rounded text-white ${
                  canSave
                    ? "bg-purple-600 hover:bg-purple-700"
                    : "bg-purple-400 cursor-not-allowed opacity-60"
                }`}
              >
                Save
              </button>
            </>
          )}
        </div>

        {pagination}
      </div>
      <h1 className="text-xl font-semibold">{title}</h1>
    </div>
  );
};

export default PageHeader;

