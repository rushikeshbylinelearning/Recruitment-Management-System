/**
 * FileParserService
 * 
 * Parses uploaded CSV and Excel files into structured data.
 * Supports automatic delimiter detection for CSV files and multi-sheet Excel files.
 * 
 * Requirements: 11.1, 11.2, 11.3, 11.4, 11.5, 12.1, 12.5
 */

import Papa from 'papaparse';
import * as XLSX from 'xlsx';

class FileParserService {
  /**
   * Parse uploaded file (CSV or Excel)
   * @param {Buffer} fileBuffer - File content as buffer
   * @param {string} filename - Original filename
   * @param {number} [sheetIndex=0] - Sheet index for Excel files (default: 0)
   * @returns {Promise<ParsedFileResult>} - Parsed file data
   */
  async parseFile(fileBuffer, filename, sheetIndex = 0) {
    const fileType = this._getFileType(filename);
    
    if (fileType === 'csv') {
      return await this._parseCSV(fileBuffer);
    } else if (fileType === 'xlsx' || fileType === 'xls') {
      return await this._parseExcel(fileBuffer, sheetIndex);
    } else {
      throw new Error(`Unsupported file format. Supported formats: .csv, .xlsx, .xls`);
    }
  }

  /**
   * Parse CSV file with automatic delimiter detection
   * @param {Buffer} fileBuffer - CSV file content
   * @returns {Promise<ParsedFileResult>} - Parsed CSV data
   * @private
   */
  async _parseCSV(fileBuffer) {
    try {
      // Convert buffer to string with UTF-8 encoding
      const csvContent = fileBuffer.toString('utf-8');
      
      // Detect delimiter
      const delimiter = this.detectDelimiter(csvContent);
      
      // Parse CSV with detected delimiter
      const parseResult = Papa.parse(csvContent, {
        delimiter: delimiter,
        header: true,
        skipEmptyLines: 'greedy', // Skip completely empty rows
        transformHeader: (header) => header.trim(), // Trim whitespace from headers
        transform: (value) => value.trim(), // Trim whitespace from values
      });

      if (parseResult.errors.length > 0) {
        console.warn('CSV parsing warnings:', parseResult.errors);
      }

      // Filter out completely empty rows (all values are empty strings)
      const filteredRows = parseResult.data.filter(row => {
        return Object.values(row).some(value => value !== '');
      });

      return {
        headers: parseResult.meta.fields || [],
        rows: filteredRows,
        totalRows: filteredRows.length,
        fileType: 'csv',
        encoding: 'utf-8'
      };
    } catch (error) {
      console.error('CSV parsing error:', error);
      throw new Error(`Failed to parse CSV file: ${error.message}`);
    }
  }

  /**
   * Parse Excel file (.xlsx or .xls)
   * @param {Buffer} fileBuffer - Excel file content
   * @param {number} sheetIndex - Sheet index to read (default: 0)
   * @returns {Promise<ParsedFileResult>} - Parsed Excel data with color metadata
   * @private
   */
  async _parseExcel(fileBuffer, sheetIndex = 0) {
    try {
      // Read workbook from buffer WITH cell styles for color extraction
      const workbook = XLSX.read(fileBuffer, { 
        type: 'buffer',
        cellStyles: true  // Enable style/color extraction
      });
      
      // Get sheet names
      const sheetNames = workbook.SheetNames;
      
      if (sheetNames.length === 0) {
        throw new Error('Excel file contains no sheets');
      }

      // Validate sheet index
      if (sheetIndex < 0 || sheetIndex >= sheetNames.length) {
        throw new Error(`Invalid sheet index ${sheetIndex}. File has ${sheetNames.length} sheet(s)`);
      }

      // Get the specified sheet (default: first sheet)
      const sheetName = sheetNames[sheetIndex];
      const worksheet = workbook.Sheets[sheetName];

      // Convert sheet to JSON with header row
      const jsonData = XLSX.utils.sheet_to_json(worksheet, {
        raw: false, // Format values as strings
        defval: '', // Default value for empty cells
      });

      // Get headers from first row
      const headers = jsonData.length > 0 ? Object.keys(jsonData[0]) : [];

      // Extract colors for each row
      const rowsWithColors = jsonData.map((row, rowIndex) => {
        const actualRowIndex = rowIndex + 2; // +2 because: 0-indexed + header row
        const rowColors = this._extractRowColors(worksheet, headers, actualRowIndex);
        
        return {
          ...row,
          __cellColors: rowColors  // Metadata field for colors
        };
      });

      // Filter out completely empty rows
      const filteredRows = rowsWithColors.filter(row => {
        return Object.values(row).some(value => value !== '' && value !== undefined);
      });

      // Determine file type from workbook
      const fileType = workbook.bookType === 'xls' ? 'xls' : 'xlsx';

      return {
        headers: headers,
        rows: filteredRows,
        totalRows: filteredRows.length,
        fileType: fileType,
        sheetNames: sheetNames,
        encoding: 'utf-8'
      };
    } catch (error) {
      console.error('Excel parsing error:', error);
      throw new Error(`Failed to parse Excel file: ${error.message}`);
    }
  }

  /**
   * Extract cell colors from a worksheet row
   * 
   * IMPORTANT: Extracts colors from ALL columns for flexibility,
   * but the color detection engine will ONLY use the CANDIDATE NAME column color.
   * 
   * @param {Object} worksheet - XLSX worksheet object
   * @param {string[]} headers - Column headers
   * @param {number} rowIndex - Row index (1-based, accounting for header)
   * @returns {Object} Map of column name to hex color
   * @private
   */
  _extractRowColors(worksheet, headers, rowIndex) {
    const colors = {};
    
    headers.forEach((header, colIndex) => {
      // Convert column index to Excel column letter (A, B, C, ...)
      const colLetter = XLSX.utils.encode_col(colIndex);
      const cellAddress = `${colLetter}${rowIndex}`;
      const cell = worksheet[cellAddress];
      
      if (cell && cell.s) {
        // Extract fill color (background color)
        // Try fgColor first (foreground/fill), then bgColor
        const fillColor = cell.s.fgColor?.rgb || cell.s.bgColor?.rgb;
        
        if (fillColor) {
          // Handle both formats: "RRGGBB" and "AARRGGBB" (Excel ARGB)
          let hexColor = fillColor;
          
          // Remove any existing # prefix
          hexColor = hexColor.replace(/^#/, '');
          
          // If 8 characters (ARGB format), extract RGB part
          if (hexColor.length === 8) {
            hexColor = hexColor.substring(2);
          }
          
          // Add # prefix
          hexColor = `#${hexColor}`;
          
          colors[header] = hexColor;
        }
      }
    });
    
    return colors;
  }

  /**
   * Select and parse a specific sheet from Excel file
   * @param {Buffer} fileBuffer - Excel file content
   * @param {number} sheetIndex - Sheet index to read
   * @returns {Promise<ParsedFileResult>} - Parsed Excel data from selected sheet
   */
  async selectSheet(fileBuffer, sheetIndex) {
    return await this._parseExcel(fileBuffer, sheetIndex);
  }

  /**
   * Detect CSV delimiter (comma, semicolon, or tab)
   * @param {string} csvContent - CSV file content as string
   * @returns {string} - Detected delimiter
   */
  detectDelimiter(csvContent) {
    // Get first few lines for analysis
    const lines = csvContent.split('\n').slice(0, 5);
    const sampleText = lines.join('\n');

    // Count occurrences of potential delimiters
    const delimiters = [',', ';', '\t'];
    const counts = delimiters.map(delimiter => {
      return {
        delimiter,
        count: (sampleText.match(new RegExp(`\\${delimiter}`, 'g')) || []).length
      };
    });

    // Find delimiter with highest count
    const detected = counts.reduce((max, current) => 
      current.count > max.count ? current : max
    );

    // Default to comma if no clear delimiter found
    return detected.count > 0 ? detected.delimiter : ',';
  }

  /**
   * Get file type from filename extension
   * @param {string} filename - Original filename
   * @returns {string} - File type (csv, xlsx, xls)
   * @private
   */
  _getFileType(filename) {
    const extension = filename.toLowerCase().split('.').pop();
    
    if (extension === 'csv') return 'csv';
    if (extension === 'xlsx') return 'xlsx';
    if (extension === 'xls') return 'xls';
    
    throw new Error('Unsupported file format');
  }
}

// Export singleton instance
export default new FileParserService();

/**
 * @typedef {Object} ParsedFileResult
 * @property {string[]} headers - Column headers from the file
 * @property {Object[]} rows - Array of row objects with column headers as keys
 * @property {number} totalRows - Total number of rows (excluding empty rows)
 * @property {string} fileType - File type: 'csv', 'xlsx', or 'xls'
 * @property {string[]} [sheetNames] - Sheet names (for Excel files only)
 * @property {string} encoding - File encoding (e.g., 'utf-8')
 */
