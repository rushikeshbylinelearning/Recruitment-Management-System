/**
 * Utility functions for date formatting in DD/MM/YYYY format
 */

/**
 * Parse a DD/MM/YYYY format date string to a Date object
 */
export const parseDDMMYYYY = (dateString: string): Date | null => {
  if (!dateString || !dateString.trim()) return null;
  
  // Handle DD/MM/YYYY format
  const parts = dateString.trim().split('/');
  if (parts.length === 3) {
    const day = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1; // JavaScript months are 0-indexed
    const year = parseInt(parts[2], 10);
    
    // Validate the date parts
    if (!isNaN(day) && !isNaN(month) && !isNaN(year)) {
      const date = new Date(year, month, day);
      // Check if the date is valid
      if (date.getFullYear() === year && date.getMonth() === month && date.getDate() === day) {
        return date;
      }
    }
  }
  
  return null;
};

/**
 * Format a Date object or ISO string to DD/MM/YYYY format
 */
export const formatToDDMMYYYY = (date: Date | string | null | undefined): string => {
  if (!date) return '';
  
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  
  // Check if date is valid
  if (isNaN(dateObj.getTime())) return '';
  
  const day = dateObj.getDate().toString().padStart(2, '0');
  const month = (dateObj.getMonth() + 1).toString().padStart(2, '0');
  const year = dateObj.getFullYear();
  
  return `${day}/${month}/${year}`;
};

/**
 * Format a Date object or ISO string to YYYY-MM-DD format (for input type="date")
 */
export const formatToYYYYMMDD = (date: Date | string | null | undefined): string => {
  if (!date) return '';
  
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  
  // Check if date is valid
  if (isNaN(dateObj.getTime())) return '';
  
  return dateObj.toISOString().split('T')[0];
};

/**
 * Convert DD/MM/YYYY to YYYY-MM-DD format
 */
export const ddmmyyyyToYYYYMMDD = (dateString: string): string => {
  const date = parseDDMMYYYY(dateString);
  return formatToYYYYMMDD(date);
};

/**
 * Convert YYYY-MM-DD to DD/MM/YYYY format
 */
export const yyyymmddToDDMMYYYY = (dateString: string): string => {
  if (!dateString) return '';
  const date = new Date(dateString);
  return formatToDDMMYYYY(date);
};







