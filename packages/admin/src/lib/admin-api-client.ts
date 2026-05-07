type JsonBody = unknown;

export function cloudbaseFetch(input: RequestInfo | URL, init: RequestInit = {}) {
  return fetch(input, {
    ...init,
    credentials: 'same-origin',
  }).then(response => {
    if (response.status === 401 && typeof window !== 'undefined') {
      window.localStorage.removeItem('admin_user');
      if (window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
    }
    return response;
  });
}

export function cloudbaseJsonFetch(input: RequestInfo | URL, body: JsonBody, init: RequestInit = {}) {
  const headers = new Headers(init.headers);
  headers.set('Content-Type', 'application/json');
  return cloudbaseFetch(input, {
    ...init,
    method: init.method || 'POST',
    headers,
    body: JSON.stringify(body),
  });
}
