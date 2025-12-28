/**
 * Utility function to download text content as a file
 * @param filename - The name of the file to download
 * @param content - The text content to download
 * @param mimeType - The MIME type of the file (default: 'text/plain')
 */
export function downloadText(filename: string, content: string, mimeType: string = 'text/plain'): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);

  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.style.display = 'none';

  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  // Clean up the URL object
  URL.revokeObjectURL(url);
}