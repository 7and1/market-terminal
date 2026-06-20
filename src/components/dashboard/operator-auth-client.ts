export const OPERATOR_TOKEN_STORAGE_KEY = 'trendanalysis:operator-token';

export function buildOperatorHeaders(operatorToken: string, contentType?: string) {
  const headers: Record<string, string> = {};
  if (contentType) headers['content-type'] = contentType;
  if (operatorToken.trim()) headers['x-operator-token'] = operatorToken.trim();
  return headers;
}
