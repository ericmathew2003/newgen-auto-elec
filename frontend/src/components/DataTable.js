import React from 'react';

const DataTable = ({ 
  data, 
  columns, 
  onRowDoubleClick, 
  onRowClick,
  onDelete,
  emptyMessage = "No data found",
  className = ""
}) => {
  return (
    <div className={`border rounded-lg shadow-sm overflow-auto max-h-[70vh] ${className}`}>
      <table className="w-full border-collapse">
        <thead className="bg-gray-100 text-left sticky top-0 z-10">
          <tr>
            {columns.map((column, index) => (
              <th 
                key={index}
                className={`p-3 border-b ${column.align === 'right' ? 'text-right' : 'text-left'} ${column.hidden ? 'hidden' : ''}`}
              >
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((row, rowIndex) => (
            <tr
              key={row.id || rowIndex}
              onClick={() => onRowClick && onRowClick(row)}
              onDoubleClick={() => onRowDoubleClick && onRowDoubleClick(row)}
              className={`cursor-pointer hover:bg-indigo-50 transition-colors ${
                rowIndex % 2 === 0 ? "bg-white" : "bg-gray-50"
              }`}
            >
              {columns.map((column, colIndex) => (
                <td 
                  key={colIndex}
                  className={`px-2 py-1 border-b ${column.align === 'right' ? 'text-right' : 'text-left'} ${column.hidden ? 'hidden' : ''}`}
                >
                  {column.render ? column.render(row[column.key], row) : row[column.key]}
                </td>
              ))}
            </tr>
          ))}
          {data.length === 0 && (
            <tr>
              <td colSpan={columns.length} className="text-center p-3">
                {emptyMessage}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
};

export default DataTable;

