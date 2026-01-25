import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system';
import { Platform } from 'react-native';

// Dynamic import for xlsx to handle React Native compatibility
let XLSX;
try {
  XLSX = require('xlsx');
} catch (error) {
  console.warn('xlsx not available:', error);
  XLSX = null;
}

/**
 * Generate PDF from HTML content
 */
export const generatePDF = async (htmlContent, filename) => {
  try {
    // Validate HTML content
    if (!htmlContent || typeof htmlContent !== 'string' || htmlContent.trim().length === 0) {
      throw new Error('PDF generation failed: Invalid or empty HTML content');
    }

    // Check if printToFileAsync is available
    if (!Print || !Print.printToFileAsync) {
      throw new Error('PDF generation is not available on this platform');
    }

    // On web, use browser print functionality
    if (Platform.OS === 'web') {
      // Create a new window with the HTML and trigger print
      const printWindow = window.open('', '_blank');
      if (!printWindow) {
        throw new Error('PDF generation failed: Could not open print window. Please allow popups.');
      }
      printWindow.document.write(htmlContent);
      printWindow.document.close();
      printWindow.onload = () => {
        printWindow.print();
      };
      return 'web-print-triggered';
    }

    // For native platforms, use printToFileAsync
    // Call printToFileAsync and handle the result
    let result;
    try {
      // Use minimal options for better compatibility
      // Note: width/height may cause issues on some platforms, so we omit them
      result = await Print.printToFileAsync({
        html: htmlContent,
        base64: false,
      });
      
      // Log success for debugging
      console.log('printToFileAsync result type:', typeof result);
      console.log('printToFileAsync result:', result);
    } catch (printError) {
      console.error('printToFileAsync error:', printError);
      console.error('Error details:', JSON.stringify(printError, null, 2));
      console.error('HTML content length:', htmlContent.length);
      console.error('HTML content preview:', htmlContent.substring(0, 500));
      throw new Error(`PDF generation failed: ${printError.message || 'Unknown error'}`);
    }

    // Validate result - printToFileAsync should return { uri: string } or string
    if (result === null || result === undefined) {
      console.error('printToFileAsync returned null/undefined');
      console.error('HTML content length:', htmlContent.length);
      console.error('HTML content preview:', htmlContent.substring(0, 500));
      console.error('Platform:', Platform.OS);
      throw new Error('PDF generation failed: printToFileAsync returned null or undefined. Please ensure expo-print is properly installed and the HTML content is valid.');
    }

    // Handle different result formats
    let uri;
    if (typeof result === 'string') {
      // Some platforms return URI directly as string
      uri = result;
    } else if (result && typeof result === 'object' && result.uri) {
      uri = result.uri;
    } else {
      console.error('Unexpected result format:', typeof result, result);
      throw new Error(`PDF generation failed: Unexpected result format: ${typeof result}. Expected object with 'uri' property or string.`);
    }

    if (!uri || typeof uri !== 'string' || uri.trim().length === 0) {
      console.error('Invalid URI:', uri);
      throw new Error('PDF generation failed: No valid URI returned from printToFileAsync');
    }

    // Use the URI directly from printToFileAsync (avoiding deprecated moveAsync)
    // The file is already created and ready to share
    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(uri, {
        mimeType: 'application/pdf',
        dialogTitle: `Share ${filename}.pdf`,
      });
    } else {
      console.log('Sharing not available');
    }
    
    return uri;
  } catch (error) {
    console.error('Error generating PDF:', error);
    throw error;
  }
};

/**
 * Generate Excel file from data array with optional headers
 * @param {Array<Array>} data - Array of data rows
 * @param {string} date - Date string to display
 * @param {string} filename - Filename for the export
 * @param {Array<string>} headers - Optional array of header labels (excludes Action column)
 */
export const generateExcel = async (data, date, filename, headers = null) => {
  if (!XLSX) {
    throw new Error('Excel export is not available. Please install xlsx package.');
  }

  try {
    // Create worksheet with date in first row, headers (if provided), then data
    const dateRow = [[`Date: ${date}`]];
    const headerRow = headers && Array.isArray(headers) && headers.length > 0 ? [headers] : [];
    const allData = [...dateRow, ...headerRow, ...data];
    const worksheet = XLSX.utils.aoa_to_sheet(allData);
    
    // Set column widths based on all data including headers
    if (allData.length > 0) {
      const numColumns = allData[0].length;
      const columnWidths = Array.from({ length: numColumns }, (_, index) => {
        const maxLength = Math.max(
          ...allData.map(row => String(row[index] || '').length)
        );
        return { wch: Math.min(maxLength + 2, 50) };
      });
      worksheet['!cols'] = columnWidths;
    }

    // Create workbook
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Sheet1');

    // Generate buffer as array for binary write
    const wbout = XLSX.write(workbook, { type: 'array', bookType: 'xlsx' });
    const uint8Array = new Uint8Array(wbout);

    // Save file - handle web and native platforms differently
    const fileUri = `${FileSystem.documentDirectory}${filename}.xlsx`;
    
    if (Platform.OS === 'web') {
      // Web: Create blob and download
      const blob = new Blob([uint8Array], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${filename}.xlsx`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      return fileUri;
    }
    
    // Native: Convert array to base64 and write
    // Convert Uint8Array to base64 string efficiently
    const base64 = btoa(String.fromCharCode.apply(null, Array.from(uint8Array)));
    
    // Write file - using current API (deprecated signature but still functional)
    // The deprecation warning is expected with expo-file-system v19+
    // The method works correctly at runtime despite the TypeScript deprecation warning
    // TODO: Migrate to new File API when available in future Expo versions
    const writeOptions = { encoding: FileSystem.EncodingType.Base64 };
    await FileSystem.writeAsStringAsync(fileUri, base64, writeOptions);

    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(fileUri);
    } else {
      console.log('Sharing not available');
    }

    return fileUri;
  } catch (error) {
    console.error('Error generating Excel:', error);
    throw error;
  }
};

/**
 * Generate HTML table for PDF export - exports table data with headers (excluding Action column)
 * @param {Array<Array>} data - Array of data rows
 * @param {string} date - Date string to display
 * @param {Array<string>} headers - Optional array of header labels (excludes Action column)
 */
export const generateHTMLTable = (data, date, headers = null) => {
  if (!data || data.length === 0) {
    throw new Error('Cannot generate PDF: No data to export');
  }

  // Validate and sanitize data
  const sanitizedData = data.map(row => {
    if (!row || !Array.isArray(row)) {
      return [];
    }
    return row.map(cell => escapeHtml(String(cell || '')));
  });

  // Generate header row if headers are provided
  let headerRow = '';
  if (headers && Array.isArray(headers) && headers.length > 0) {
    const headerCells = headers.map(header => 
      `<th style="border: 1px solid #000; padding: 6px; font-size: 11px; font-weight: bold; background-color: #f3f4f6;">${escapeHtml(String(header || ''))}</th>`
    ).join('');
    headerRow = `<thead><tr>${headerCells}</tr></thead>`;
  }

  // Generate data rows
  const dataRows = sanitizedData.map(row => {
    const cells = row.map(cell => `<td style="border: 1px solid #000; padding: 6px; font-size: 11px;">${cell}</td>`).join('');
    return `<tr>${cells}</tr>`;
  }).join('');

  // Simplified HTML document - minimal styling for better compatibility
  const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<style>
  body {
    margin: 0;
    padding: 8px;
    font-family: Arial, sans-serif;
    font-size: 11px;
  }
  .date {
    font-size: 14px;
    font-weight: bold;
    margin-bottom: 8px;
  }
  table {
    width: 100%;
    border-collapse: collapse;
    margin: 0;
  }
  th, td {
    border: 1px solid #000;
    padding: 6px;
    font-size: 11px;
  }
  th {
    font-weight: bold;
    background-color: #f3f4f6;
  }
</style>
</head>
<body>
<div class="date">Date: ${escapeHtml(date)}</div>
<table>
  ${headerRow}
  <tbody>
    ${dataRows}
  </tbody>
</table>
</body>
</html>`;

  // Validate HTML before returning
  if (!html || html.trim().length === 0) {
    throw new Error('Generated HTML is empty');
  }

  return html;
};

/**
 * Escape HTML to prevent XSS and formatting issues
 */
const escapeHtml = (text) => {
  if (!text) return '';
  const map = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  };
  return String(text).replace(/[&<>"']/g, m => map[m]);
};
