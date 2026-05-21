export type CloudFunctionResult = {
  success?: boolean;
  error?: string;
  [key: string]: unknown;
};

type FunctionResponse = {
  data?: CloudFunctionResult;
  result?: CloudFunctionResult;
  success?: boolean;
  error?: string;
  invokeResult?: {
    RetMsg?: string;
  };
  raw?: {
    RetMsg?: string;
  };
  [key: string]: unknown;
};

function parseRetMsg(retMsg?: string) {
  if (!retMsg) return null;
  try {
    return JSON.parse(retMsg) as CloudFunctionResult;
  } catch {
    return null;
  }
}

function isBusinessResult(value: unknown): value is CloudFunctionResult {
  if (!value || typeof value !== 'object') return false;
  return 'success' in value || 'error' in value || 'code' in value;
}

export function unwrapCloudFunctionResult(response: FunctionResponse): CloudFunctionResult {
  const dataInvokeResult = response?.data?.invokeResult as { RetMsg?: string } | undefined;
  const dataRawResult = response?.data?.raw as { RetMsg?: string } | undefined;
  return (
    parseRetMsg(dataInvokeResult?.RetMsg) ||
    parseRetMsg(dataRawResult?.RetMsg) ||
    (isBusinessResult(response?.data) ? response.data : null) ||
    response?.result ||
    parseRetMsg(response?.invokeResult?.RetMsg) ||
    parseRetMsg(response?.raw?.RetMsg) ||
    response
  ) as CloudFunctionResult;
}
