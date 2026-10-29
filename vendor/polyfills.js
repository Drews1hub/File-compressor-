// Older browsers (Safari < 17.4, Chrome < 119) lack Promise.withResolvers, which pdf.js needs.
if (!Promise.withResolvers) {
  Promise.withResolvers = function () {
    let resolve, reject;
    const promise = new Promise((res, rej) => { resolve = res; reject = rej; });
    return { promise, resolve, reject };
  };
}
