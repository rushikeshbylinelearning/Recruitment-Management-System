// Simple PDF text extraction utility
// This is a basic implementation that works with text-based PDFs

export class PDFTextExtractor {
  private static async extractTextFromArrayBuffer(arrayBuffer: ArrayBuffer): Promise<string> {
    try {
      // Convert ArrayBuffer to string
      const uint8Array = new Uint8Array(arrayBuffer);
      
      // Look for text content in the PDF
      // This is a simplified approach - in production, you'd want to use a proper PDF library
      let text = '';
      
      // Convert bytes to string, filtering out non-printable characters
      for (let i = 0; i < uint8Array.length; i++) {
        const byte = uint8Array[i];
        // Keep printable ASCII characters and some common unicode ranges
        if (
          (byte >= 32 && byte <= 126) || // Printable ASCII
          (byte >= 160 && byte <= 255) || // Extended ASCII
          byte === 9 || // Tab
          byte === 10 || // Line feed
          byte === 13   // Carriage return
        ) {
          text += String.fromCharCode(byte);
        }
      }
      
      // Clean up the extracted text
      return this.cleanPDFText(text);
    } catch (error) {
      throw new Error('Failed to extract text from PDF');
    }
  }

  private static cleanPDFText(text: string): string {
    // Remove PDF-specific artifacts and clean up the text
    return text
      // Remove PDF headers and metadata
      .replace(/^%PDF.*$/gm, '')
      .replace(/^%[^\n]*$/gm, '')
      // Remove common PDF artifacts
      .replace(/BT\s*\/F\d+\s*\d+\s*Tf\s*/g, '') // Font definitions
      .replace(/Tj\s*/g, '') // Text positioning
      .replace(/TJ\s*/g, '') // Text positioning
      .replace(/Tm\s*/g, '') // Text matrix
      .replace(/Td\s*/g, '') // Text positioning
      .replace(/TD\s*/g, '') // Text positioning
      .replace(/T\*\s*/g, '') // Text positioning
      .replace(/\[\s*\]\s*TJ/g, '') // Empty text arrays
      // Remove extra whitespace
      .replace(/\s+/g, ' ')
      .replace(/\n\s*\n/g, '\n')
      .trim();
  }

  static async extractText(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      
      reader.onload = async (e) => {
        try {
          const arrayBuffer = e.target?.result as ArrayBuffer;
          if (!arrayBuffer) {
            reject(new Error('Failed to read file'));
            return;
          }
          
          const text = await this.extractTextFromArrayBuffer(arrayBuffer);
          resolve(text);
        } catch (error) {
          reject(error);
        }
      };
      
      reader.onerror = () => {
        reject(new Error('Failed to read file'));
      };
      
      reader.readAsArrayBuffer(file);
    });
  }
}

// Word document text extraction (basic implementation)
export class WordTextExtractor {
  static async extractText(file: File): Promise<string> {
    // For Word documents, we'll use a simple approach
    // In production, you'd want to use a proper DOC/DOCX parsing library
    
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      
      reader.onload = (e) => {
        try {
          const arrayBuffer = e.target?.result as ArrayBuffer;
          if (!arrayBuffer) {
            reject(new Error('Failed to read file'));
            return;
          }
          
          // Convert to string and extract readable text
          const uint8Array = new Uint8Array(arrayBuffer);
          let text = '';
          
          for (let i = 0; i < uint8Array.length; i++) {
            const byte = uint8Array[i];
            // Look for printable characters
            if (byte >= 32 && byte <= 126) {
              text += String.fromCharCode(byte);
            } else if (byte === 10 || byte === 13) {
              text += '\n';
            }
          }
          
          // Clean up the text
          text = text
            .replace(/\x00/g, '') // Remove null characters
            .replace(/\s+/g, ' ')
            .replace(/\n\s*\n/g, '\n')
            .trim();
          
          resolve(text);
        } catch (error) {
          reject(new Error('Failed to extract text from Word document'));
        }
      };
      
      reader.onerror = () => {
        reject(new Error('Failed to read file'));
      };
      
      reader.readAsArrayBuffer(file);
    });
  }
}
