import { authApi, API_BASE_URL } from '../services/api';

export interface OAuthPopupOptions {
  onSuccess: () => void;
  onError: (errorMsg: string) => void;
  onLoading?: (isLoading: boolean) => void;
}

export const openGoogleOAuthPopup = ({
  onSuccess,
  onError,
  onLoading,
}: OAuthPopupOptions) => {
  if (onLoading) onLoading(true);

  const width = 500;
  const height = 600;
  const left = window.screenX + (window.outerWidth - width) / 2;
  const top = window.screenY + (window.outerHeight - height) / 2;

  const popup = window.open(
    `${API_BASE_URL}/auth/google`,
    'google_oauth_popup',
    `width=${width},height=${height},left=${left},top=${top},status=0,toolbar=0,menubar=0,location=1`
  );

  if (!popup || popup.closed || typeof popup.closed === 'undefined') {
    if (onLoading) onLoading(false);
    onError('Popup window was blocked by your browser. Please allow popups for this site or use Demo Workspace.');
    return;
  }

  let isHandled = false;
  let timer: NodeJS.Timeout | null = null;

  const cleanup = () => {
    window.removeEventListener('message', handleMessage);
    if (timer) {
      clearInterval(timer);
      timer = null;
    }
    if (onLoading) onLoading(false);
  };

  const syncAndVerify = async (explicitFailureMsg?: string) => {
    if (isHandled) return;
    isHandled = true;
    cleanup();

    try {
      // Step 1: Re-verify session with backend FIRST before displaying an error
      const authData = await authApi.getMe();
      if (authData && authData.user) {
        onSuccess();
        return;
      }
    } catch (err) {
      // Session re-verification returned 401 or network error
    }

    // Step 2: Only if session verification fails, display explicit error or popup closure error
    if (explicitFailureMsg) {
      onError(explicitFailureMsg);
    } else {
      onError('Authentication popup window was closed before completing login.');
    }
  };

  const allowedOrigins = [window.location.origin];
  try {
    if (API_BASE_URL.startsWith('http://') || API_BASE_URL.startsWith('https://')) {
      allowedOrigins.push(new URL(API_BASE_URL).origin);
    }
  } catch (_) {}

  const handleMessage = (event: MessageEvent) => {
    if (!allowedOrigins.includes(event.origin)) return;
    if (event.source !== popup) return;

    if (event.data?.type === 'GOOGLE_AUTH_SUCCESS') {
      syncAndVerify();
    } else if (event.data?.type === 'GOOGLE_AUTH_FAILURE') {
      syncAndVerify(event.data?.error || 'Google authentication failed.');
    }
  };

  window.addEventListener('message', handleMessage);

  // Poll for popup window closure
  timer = setInterval(() => {
    if (popup.closed) {
      // Brief delay to allow postMessage/cookies to finish writing
      setTimeout(() => {
        syncAndVerify();
      }, 300);
    }
  }, 500);
};
