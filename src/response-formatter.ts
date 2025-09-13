import { ScrapeResult } from "./steel-api";

export function formatSuccessResponse(result: ScrapeResult, verboseMode: boolean) {
  if (!verboseMode) {
    const cleanText = result.metadata?.warnings && result.metadata.warnings.length > 0 
      ? `[WARNING: ${result.metadata.warnings.join('; ')}]\n\n${result.data}`
      : result.data;
    
    return {
      content: [{ type: "text", text: cleanText }],
    };
  }
  
  const formatInfo = result.metadata?.format?.join(', ') || 'unknown';
  const warningsInfo = result.metadata?.warnings && result.metadata.warnings.length > 0 
    ? `\nWarnings: ${result.metadata.warnings.join('; ')}` 
    : '';
  const truncatedInfo = result.metadata?.truncated 
    ? ` (truncated to ${result.metadata?.returnedLength} characters)` 
    : '';
  const linksInfo = result.links && result.links.length > 0 
    ? `\nLinks Found: ${result.links.length}` 
    : '';
  
  return {
    content: [{
      type: "text",
      text: `SUCCESS: Successfully scraped ${result.metadata?.url}
Method: ${result.metadata?.method} (stealth browser, anti-detection)
Format: ${formatInfo}
Status Code: ${result.statusCode}
Processing Time: ${result.metadata?.processingTime}ms
Content Length: ${result.metadata?.contentLength} characters${truncatedInfo}${warningsInfo}
Content Type: ${result.metadata?.contentType}
Timestamp: ${result.metadata?.timestamp}${result.metadata?.title ? `\nTitle: ${result.metadata.title}` : ''}${result.metadata?.description ? `\nDescription: ${result.metadata.description}` : ''}${result.metadata?.language ? `\nLanguage: ${result.metadata.language}` : ''}${result.screenshot ? '\nScreenshot: Available (base64)' : ''}${result.pdf ? '\nPDF: Available (base64)' : ''}${linksInfo}

SCRAPED CONTENT:
${result.data}`,
    }],
  };
}

export function formatErrorResponse(result: ScrapeResult, verboseMode: boolean) {
  if (!verboseMode) {
    let errorText = `ERROR: Failed to scrape ${result.metadata?.url || 'unknown URL'}`;
    
    if (result.errorCode) errorText += ` (${result.errorCode})`;
    if (result.error) errorText += `: ${result.error}`;
    
    return { content: [{ type: "text", text: errorText }], isError: true };
  }
  
  let errorText = `ERROR: Failed to scrape ${result.metadata?.url || 'unknown URL'}\n`;
  if (result.errorCode) errorText += `Error Code: ${result.errorCode}\n`;
  if (result.error) errorText += `Error: ${result.error}\n`;
  errorText += `Status Code: ${result.statusCode || 'unknown'}\n`;
  errorText += `Timestamp: ${result.metadata?.timestamp || new Date().toISOString()}\n`;
  
  if (result.errorMetadata) {
    try {
      errorText += `Error Metadata: ${JSON.stringify(result.errorMetadata, null, 2)}\n`;
    } catch {
      errorText += `Error Metadata: Unable to serialize metadata\n`;
    }
  }
  
  return { content: [{ type: "text", text: errorText }], isError: true };
}
