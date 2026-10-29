// Same shim as polyfills.js, but for the pdf.js worker thread. Must run before the worker loads.
if (!Promise.withResolvers) {
  Promise.withResolvers = function () {
    let resolve, reject;
    const promise = new Promise((res, rej) => { resolve = res; reject = rej; });
    return { promise, resolve, reject };
  };
}
await import('./pdf.worker.min.mjs');
