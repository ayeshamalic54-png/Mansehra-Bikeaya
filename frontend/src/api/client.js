const API_BASE = '';

export function getStoredToken() {
  return localStorage.getItem('mns_bikeaya_token');
}

export function setStoredToken(token) {
  if (token) {
    localStorage.setItem('mns_bikeaya_token', token);
  } else {
    localStorage.removeItem('mns_bikeaya_token');
  }
}

export async function apiRequest(path, { method = 'GET', body, auth = true } = {}) {
  const headers = {};
  if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
  }
  if (auth) {
    const token = getStoredToken();
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
  }

  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    let message = `Request failed (${res.status})`;
    let code = null;
    try {
      const errData = await res.json();
      if (errData?.code) {
        code = errData.code;
      }
      if (errData?.detail) {
        message = typeof errData.detail === 'string' ? errData.detail : JSON.stringify(errData.detail);
      }
    } catch {
      // ignore non-json
    }
    const err = new Error(message);
    err.status = res.status;
    err.code = code;
    throw err;
  }

  const contentType = res.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    return res.json();
  }
  return res.text();
}

export async function downloadAuthenticatedCsv(path, filename) {
  const token = getStoredToken();
  const res = await fetch(`${API_BASE}${path}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) {
    throw new Error(`Export failed (${res.status})`);
  }
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export async function uploadAuthenticatedFile(path, file) {
  const token = getStoredToken();
  const formData = new FormData();
  formData.append('file', file);
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: formData,
  });
  if (!res.ok) {
    let message = `Upload failed (${res.status})`;
    try {
      const errData = await res.json();
      if (errData?.detail) {
        message = typeof errData.detail === 'string' ? errData.detail : JSON.stringify(errData.detail);
      }
    } catch {
      // ignore non-json
    }
    throw new Error(message);
  }
  return res.json();
}
