export function sendMessageToHost(tag, payload) {
  const message = { tag, payload }
  if (window.chrome?.webview) {
    window.chrome.webview.postMessage(message)
  } else {
    console.warn('[WebView] Host API not available — dev mode.')
  }
}

export function onMessageFromHost(handler) {
  if (window.chrome?.webview) {
    const listener = (event) => handler(event.data)
    window.chrome.webview.addEventListener('message', listener)
    return () => window.chrome.webview.removeEventListener('message', listener)
  } else {
    console.warn('[WebView] Host API not available — dev mode.')
    return () => {}
  }
}