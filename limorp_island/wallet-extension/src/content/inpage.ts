// This script is injected into the web page and defines window.limorp
(function () {
  const listeners: Record<string, ((...args: any[]) => void)[]> = {};

  const limorp = {
    isLimorp: true,
    request: async (payload: any) => {
      const requestId = Math.random().toString(36).substring(7);

      return new Promise((resolve, reject) => {
        const handler = (event: MessageEvent) => {
          if (
            event.source !== window ||
            !event.data ||
            event.data.source !== "limorp-content" ||
            event.data.requestId !== requestId
          ) {
            return;
          }
          window.removeEventListener("message", handler);
          if (event.data.payload?.error) {
            reject(event.data.payload.error);
          } else {
            resolve(event.data.payload);
          }
        };

        window.addEventListener("message", handler);

        window.postMessage(
          {
            source: "limorp-inpage",
            requestId,
            payload,
          },
          "*",
        );
      });
    },

    on: (event: string, callback: (...args: any[]) => void) => {
      if (!listeners[event]) listeners[event] = [];
      listeners[event].push(callback);
    },

    removeListener: (event: string, callback: (...args: any[]) => void) => {
      if (!listeners[event]) return;
      listeners[event] = listeners[event].filter((cb) => cb !== callback);
    },

    _emit: (event: string, ...args: any[]) => {
      if (!listeners[event]) return;
      listeners[event].forEach((cb) => cb(...args));
    },
  };

  // Listen for events from content script
  window.addEventListener("message", (event: MessageEvent) => {
    if (
      event.source !== window ||
      !event.data ||
      event.data.source !== "limorp-content" ||
      !event.data.event
    ) {
      return;
    }
    // @ts-ignore
    limorp._emit(event.data.event, event.data.data);
  });

  // @ts-ignore
  window.limorp = limorp;
  console.log("[Limorp] Provider injected into window.limorp");
})();
