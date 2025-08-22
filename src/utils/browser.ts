/**
 * Browser utility functions that safely handle SSR
 */

/**
 * Check if code is running in browser environment
 */
export const isBrowser = () => typeof window !== 'undefined' && typeof navigator !== 'undefined';

/**
 * Safely get navigator object
 */
export const getNavigator = () => {
  if (isBrowser()) {
    return navigator;
  }
  return null;
};

/**
 * Safely copy text to clipboard
 */
export const copyToClipboard = async (text: string): Promise<boolean> => {
  if (!isBrowser()) {
    console.warn('Clipboard API not available in SSR');
    return false;
  }
  
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch (err) {
    console.error('Failed to copy to clipboard:', err);
    
    // Fallback method for older browsers
    try {
      const textArea = document.createElement('textarea');
      textArea.value = text;
      textArea.style.position = 'fixed';
      textArea.style.left = '-999999px';
      textArea.style.top = '-999999px';
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      const successful = document.execCommand('copy');
      document.body.removeChild(textArea);
      return successful;
    } catch (fallbackErr) {
      console.error('Fallback copy also failed:', fallbackErr);
      return false;
    }
  }
};

/**
 * Get browser info safely
 */
export const getBrowserInfo = () => {
  if (!isBrowser()) {
    return {
      userAgent: 'SSR',
      platform: 'SSR',
      language: 'en',
      screenResolution: '0x0',
      viewport: '0x0'
    };
  }
  
  return {
    userAgent: navigator.userAgent,
    platform: navigator.platform,
    language: navigator.language,
    screenResolution: `${window.screen.width}x${window.screen.height}`,
    viewport: `${window.innerWidth}x${window.innerHeight}`
  };
};