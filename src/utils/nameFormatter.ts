/**
 * Properly formats a name with appropriate capitalization
 * Examples:
 * - "FAJRUL ALAM ULIN" -> "Fajrul Alam Ulin"
 * - "muhammad fajrul" -> "Muhammad Fajrul"
 * - "M. FAJRUL ALAM" -> "M. Fajrul Alam" 
 */
export const formatName = (name: string): string => {
  if (!name) return '';
  
  // Handle all uppercase input
  let formattedName = name.toLowerCase();
  
  // Split by spaces to handle each word
  return formattedName.split(' ').map(word => {
    if (!word) return '';
    
    // Handle prefixes like "M.", "H.", etc.
    if (word.length === 2 && word.endsWith('.')) {
      return word.charAt(0).toUpperCase() + '.';
    }
    
    // For words with periods inside (like "m.fajrul")
    if (word.includes('.') && !word.endsWith('.')) {
      return word.split('.').map(part => {
        if (!part) return '.';
        return part.charAt(0).toUpperCase() + part.slice(1).toLowerCase();
      }).join('.');
    }
    
    // Regular words: capitalize first letter
    return word.charAt(0).toUpperCase() + word.slice(1);
  }).join(' ');
};

/**
 * Creates a URL-friendly ID from a name
 * Examples:
 * - "Fajrul Alam Ulin" -> "Fajrul_Alam_Ulin"
 */
export const formatNameForId = (name: string): string => {
  if (!name) return '';
  
  // Replace any non-alphanumeric character except spaces with nothing
  const sanitizedName = name.replace(/[^a-zA-Z0-9\s]/g, '');
  
  // Replace spaces with underscores
  return sanitizedName.replace(/\s+/g, '_');
};