// Function to estimate token count
export const estimateTokens = async (text: string): Promise<number> => {
  const charCount = text.length
  const tokenCount = Math.ceil(charCount / 4)
  return tokenCount
}

// Function to extract JSON metadata from the AI response
export const extractJsonMetadata = (response: string): string => {
  let jsonString

  // Extract the ```json block from the response
  const jsonBlockStart = response.indexOf('```json')
  const jsonBlockEnd = response.indexOf('```', jsonBlockStart + 6)

  if (jsonBlockStart !== -1 && jsonBlockEnd !== -1) {
    jsonString = response.substring(jsonBlockStart + 6, jsonBlockEnd).trim()
  } else {
    jsonString = response
  }

  // Remove any data before the first '{'
  const jsonStartIndex = jsonString.indexOf('{')
  if (jsonStartIndex !== -1) {
    jsonString = jsonString.substring(jsonStartIndex)
  }

  // Remove any data after the last '}'
  const jsonEndIndex = jsonString.lastIndexOf('}')
  if (jsonEndIndex !== -1) {
    jsonString = jsonString.substring(0, jsonEndIndex + 1)
  }

  return jsonString
}
