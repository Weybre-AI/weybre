/**
 * Simple text chunking utility.
 * Splits text into chunks of roughly maxChunkSize, trying to break at sentences.
 */
export function chunkText(text: string, maxChunkSize = 8000): string[] {
  if (!text) return [];
  if (text.length <= maxChunkSize) return [text];

  const chunks: string[] = [];
  let startIndex = 0;

  while (startIndex < text.length) {
    let endIndex = startIndex + maxChunkSize;
    if (endIndex > text.length) {
      endIndex = text.length;
    } else {
      // Try to find a good breaking point (period followed by space)
      const lastPeriod = text.lastIndexOf(". ", endIndex);
      if (lastPeriod > startIndex + maxChunkSize * 0.7) {
        endIndex = lastPeriod + 1;
      }
    }

    chunks.push(text.substring(startIndex, endIndex).trim());
    startIndex = endIndex;
  }

  return chunks;
}
