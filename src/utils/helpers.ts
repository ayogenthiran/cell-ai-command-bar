/**
 * Generate a unique ID
 * @returns A unique string ID
 */
export const generateId = (): string => {
  return Math.random().toString(36).substring(2, 15) + 
         Math.random().toString(36).substring(2, 15);
};

/**
 * Format a date
 * @param timestamp The timestamp to format
 * @returns Formatted date string
 */
export const formatDate = (timestamp: number): string => {
  return new Date(timestamp).toLocaleString();
};

/**
 * Debounce a function
 * @param func The function to debounce
 * @param delay The delay in milliseconds
 * @returns Debounced function
 */
export const debounce = <T extends (...args: any[]) => any>(
  func: T,
  delay: number
): ((...args: Parameters<T>) => void) => {
  let timeoutId: ReturnType<typeof setTimeout>;
  
  return function(...args: Parameters<T>): void {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => {
      func(...args);
    }, delay);
  };
};

/**
 * Sanitize a string to be safe for HTML insertion
 * @param str The string to sanitize
 * @returns Sanitized string
 */
export const sanitizeHtml = (str: string): string => {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
};

/**
 * Truncate a string to a maximum length
 * @param str The string to truncate
 * @param maxLength Maximum length
 * @returns Truncated string
 */
export const truncate = (str: string, maxLength: number): string => {
  if (str.length <= maxLength) return str;
  return str.substring(0, maxLength - 3) + '...';
};

/**
 * Get the base domain from a URL
 * @param url The URL to parse
 * @returns The base domain
 */
export const getBaseDomain = (url: string): string => {
  try {
    const parsedUrl = new URL(url);
    return parsedUrl.hostname;
  } catch {
    return '';
  }
};

/**
 * Calculate similarity between two strings
 * @param a First string
 * @param b Second string
 * @returns Similarity score (0-1)
 */
export const stringSimilarity = (a: string, b: string): number => {
  if (a === b) return 1;
  if (a.length === 0 || b.length === 0) return 0;
  
  const aLength = a.length;
  const bLength = b.length;
  
  const matrix = Array(aLength + 1).fill(null).map(() => Array(bLength + 1).fill(0));
  
  for (let i = 0; i <= aLength; i++) {
    matrix[i][0] = i;
  }
  
  for (let j = 0; j <= bLength; j++) {
    matrix[0][j] = j;
  }
  
  for (let i = 1; i <= aLength; i++) {
    for (let j = 1; j <= bLength; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,          // deletion
        matrix[i][j - 1] + 1,          // insertion
        matrix[i - 1][j - 1] + cost    // substitution
      );
    }
  }
  
  const maxLength = Math.max(aLength, bLength);
  return 1 - matrix[aLength][bLength] / maxLength;
}; 