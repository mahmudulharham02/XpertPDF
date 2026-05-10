import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

import { PDFDocument, type LoadOptions } from 'pdf-lib';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export async function loadPdf(bytes: Uint8Array, options?: LoadOptions): Promise<PDFDocument> {
  try {
    const sanitizedBytes = sanitizePdfBytes(bytes);
    return await PDFDocument.load(sanitizedBytes, options);
  } catch (error: any) {
    if (error.message && error.message.includes('No PDF header found')) {
      throw new Error('The selected file is not a valid PDF or is corrupted. Please ensure you upload a valid PDF document.');
    }
    throw error;
  }
}

// Convert File to Base64
export function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
      const result = reader.result as string;
      // Remove the data:application/pdf;base64, part
      const base64 = result.split(',')[1];
      resolve(base64);
    };
    reader.onerror = (error) => reject(error);
  });
}

// Sanitize PDF bytes by stripping any preamble before %PDF-
export function sanitizePdfBytes(bytes: Uint8Array): Uint8Array {
  try {
    // Check if it's potentially a base64 or Data URI string
    // A string representation would start with "data:application/pdf;base64,JV..." or just "JVBERi"
    const textDecoder = new TextDecoder('utf-8', { fatal: true }); // Use fatal to quickly fail on binary
    const str = textDecoder.decode(bytes.slice(0, 100)).trim(); // Just check the start

    if (str.startsWith('JVBERi') || str.startsWith('data:')) {
      const fullStr = textDecoder.decode(bytes).trim();
      let base64String = fullStr;
      if (fullStr.startsWith('data:')) {
        const parts = fullStr.split('base64,');
        if (parts.length === 2) {
          base64String = parts[1];
        }
      }
      const binaryString = atob(base64String);
      const newBytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        newBytes[i] = binaryString.charCodeAt(i);
      }
      bytes = newBytes; // Update bytes to the decoded array and let it fall through to header search below
    }
  } catch (e) {
    // Not a valid UTF-8 string, so it's likely raw binary data.
    // Let it fall through.
  }

  // Find the index of '%PDF-' (37, 80, 68, 70, 45)
  let offset = -1;
  const searchLimit = bytes.length - 5; // Scan the entire file
  for (let i = 0; i < searchLimit; i++) {
    if (
      bytes[i] === 37 &&
      bytes[i + 1] === 80 &&
      bytes[i + 2] === 68 &&
      bytes[i + 3] === 70 &&
      bytes[i + 4] === 45
    ) {
      offset = i;
      break;
    }
  }
  if (offset > 0) {
    return bytes.slice(offset);
  }
  return bytes;
}

// Download file utility
export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// Fallback clipboard copy for iframes
export function copyToClipboard(text: string): Promise<boolean> {
  return new Promise((resolve) => {
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(text)
        .then(() => resolve(true))
        .catch(() => resolve(fallbackCopyTextToClipboard(text)));
    } else {
      resolve(fallbackCopyTextToClipboard(text));
    }
  });
}

function fallbackCopyTextToClipboard(text: string) {
  const textArea = document.createElement("textarea");
  textArea.value = text;
  
  // Avoid scrolling to bottom
  textArea.style.top = "0";
  textArea.style.left = "0";
  textArea.style.position = "fixed";

  document.body.appendChild(textArea);
  textArea.focus();
  textArea.select();

  try {
    const successful = document.execCommand('copy');
    return successful;
  } catch (err) {
    console.error('Fallback: Oops, unable to copy', err);
    return false;
  } finally {
    document.body.removeChild(textArea);
  }
}
