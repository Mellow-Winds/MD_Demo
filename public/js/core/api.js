/**
 * core/api.js — 网络请求拦截器 + Auth Token 管理
 * 零UI依赖，纯数据层
 */

const AUTH_KEY = 'kedazi_token';

export function getToken() { return localStorage.getItem(AUTH_KEY); }
export function saveToken(token) { localStorage.setItem(AUTH_KEY, token); }
export function clearToken() { localStorage.removeItem(AUTH_KEY); }
export function isLoggedIn() { return !!getToken(); }

/** 通用 401 处理：清除无效 token */
async function handle401(res) {
  if (res.status === 401) {
    clearToken();
    window._currentUser = null;
  }
  const ct = res.headers.get('content-type') || '';
  if (ct.includes('json')) return res.json();
  const text = await res.text();
  try { return JSON.parse(text); } catch { return text || {}; }
}

export async function apiGet(url) {
  const token = getToken();
  const headers = token ? { 'Authorization': `Bearer ${token}` } : {};
  const res = await fetch(url, { headers });
  return handle401(res);
}

export async function apiPost(url, body) {
  const token = getToken();
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(url, { method: 'POST', headers, body: JSON.stringify(body) });
  return handle401(res);
}

export async function apiPut(url, body) {
  const token = getToken();
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(url, { method: 'PUT', headers, body: JSON.stringify(body) });
  return handle401(res);
}

export async function apiPostFile(url, file) {
  const fd = new FormData();
  fd.append('file', file);
  const token = getToken();
  const headers = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(url, { method: 'POST', headers, body: fd });
  return handle401(res);
}

export async function apiDelete(url) {
  const token = getToken();
  const headers = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(url, { method: 'DELETE', headers });
  return handle401(res);
}
