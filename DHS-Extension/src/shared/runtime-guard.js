(function exposeRuntimeGuard(globalScope) {
  function isRuntimeInvalidationError(error) {
    return /Extension context invalidated/i.test(String(error && error.message || error || ''));
  }

  function safeChromeRuntimeRef(scope) {
    try {
      const root = scope || (typeof globalThis !== 'undefined' ? globalThis : {});
      const chromeRef = root.chrome;
      if (!chromeRef || !chromeRef.runtime) return null;
      return chromeRef;
    } catch (_) {
      return null;
    }
  }

  function deliverRuntimeCallback(done, response, error) {
    try {
      done(response, error);
    } catch (callbackError) {
      if (!isRuntimeInvalidationError(callbackError)) throw callbackError;
    }
  }

  function safeRuntimeGetURL(chromeRef, path) {
    try {
      if (!chromeRef || !chromeRef.runtime || typeof chromeRef.runtime.getURL !== 'function') return '';
      return chromeRef.runtime.getURL(path);
    } catch (_) {
      return '';
    }
  }

  function safeRuntimeSendMessage(chromeRef, message, callback) {
    const done = typeof callback === 'function' ? callback : function noop() {};
    try {
      if (!chromeRef || !chromeRef.runtime || typeof chromeRef.runtime.sendMessage !== 'function') {
        deliverRuntimeCallback(done, null, new Error('runtime-unavailable'));
        return false;
      }
      chromeRef.runtime.sendMessage(message, (response) => {
        let runtimeError = null;
        try {
          runtimeError = chromeRef.runtime && chromeRef.runtime.lastError;
        } catch (error) {
          runtimeError = error;
        }
        deliverRuntimeCallback(done, runtimeError ? null : response, runtimeError);
      });
      return true;
    } catch (error) {
      deliverRuntimeCallback(done, null, error);
      return false;
    }
  }

  const api = {
    deliverRuntimeCallback,
    isRuntimeInvalidationError,
    safeChromeRuntimeRef,
    safeRuntimeGetURL,
    safeRuntimeSendMessage
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
    return;
  }

  globalScope.DHS_RUNTIME_GUARD = api;
})(typeof globalThis !== 'undefined' ? globalThis : window);
