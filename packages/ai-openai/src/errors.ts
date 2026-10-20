import type { ErrorCode } from '@writehand/contracts';

export class AiFailure extends Error {
  constructor(readonly code: ErrorCode) {
    super(code);
  }
}

export function failureCode(error: unknown): ErrorCode {
  if (error instanceof AiFailure) return error.code;
  if (error instanceof Error && (error.name === 'AbortError' || error.name === 'TimeoutError'))
    return 'READ_CANCELLED';
  return 'AI_NETWORK';
}

export function providerFailure(status: number, code?: string): AiFailure {
  if (code === '3p_delegated_access_policy_denied') return new AiFailure('AI_POLICY_DENIED');
  if (code === '3p_login_workspace_scope_denied') return new AiFailure('AI_WORKSPACE_MISMATCH');
  if (code === 'subscription_sharing_user_not_eligible') return new AiFailure('AI_NOT_ELIGIBLE');
  if (code === 'model_not_found') return new AiFailure('AI_MODEL_UNAVAILABLE');
  if (code === 'subscription_sharing_usage_limit_exceeded' || status === 429)
    return new AiFailure('AI_LIMIT_REACHED');
  // A generic admission denial does not establish subscription eligibility.
  if (
    status === 403 ||
    code === 'subscription_sharing_route_not_supported' ||
    code === 'chatpass_v2_scope_not_authorized' ||
    code === 'chatpass_v2_invalid_authorization_context'
  )
    return new AiFailure('AI_ACCESS_DENIED');
  if (status === 401) return new AiFailure('AI_NOT_CONNECTED');
  return new AiFailure('AI_UNAVAILABLE');
}
