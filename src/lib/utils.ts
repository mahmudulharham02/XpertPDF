import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
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
  // Find the index of '%PDF-' (37, 80, 68, 70, 45)
  let offset = -1;
  for (let i = 0; i < Math.min(bytes.length - 5, 2048); i++) {
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
