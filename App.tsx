import { useEffect, useState } from 'react';

interface Item {
  id: number;
  name: string;
}

// Replace these values with the actual API address and login token.
const API_URL = 'https://example.com/api/';
const getToken = () => sessionStorage.getItem('accessToken');

async function request(
  path: string,
  method = 'GET',
  body?: { name: string },
  signal?: AbortSignal,
  query?: Record<string, string>,
): Promise<unknown> {
  const url = new URL(path, API_URL);
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value) url.searchParams.set(key, value);
  }

  const headers = new Headers({ Accept: 'application/json' });
  const token = getToken();
  if (token) headers.set('Authorization', `Bearer ${token}`);
  if (body) headers.set('Content-Type', 'application/json; charset=utf-8');

  const response = await fetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
    signal,
  });

  if (!response.ok) throw new Error(`Request failed (${response.status})`);
  const text = await response.text();
  return text ? JSON.parse(text) : undefined;
}

function parseItem(data: unknown): Item {
  if (
    typeof data !== 'object' || data === null ||
    !('id' in data) || typeof data.id !== 'number' ||
    !('name' in data) || typeof data.name !== 'string'
  ) throw new Error('Invalid API response');
  return { id: data.id, name: data.name };
}

export default function App() {
  const [items, setItems] = useState<Item[]>([]);
  const [name, setName] = useState('');
  const [editingId, setEditingId] = useState<number | null>(null);
  const [search, setSearch] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError(null);

    async function load() {
      try {
        const data = await request('items', 'GET', undefined, controller.signal, { search });
        if (!Array.isArray(data)) throw new Error('Invalid API response');
        const result = data.map(parseItem);
        if (!controller.signal.aborted) setItems(result);
      } catch (reason) {
        if (!controller.signal.aborted) {
          setError(reason instanceof Error ? reason.message : 'Failed to fetch items');
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }

    void load();
    return () => controller.abort();
  }, [search]);

  async function save() {
    if (!name.trim() || loading || saving) return;
    setSaving(true);
    setError(null);
    try {
      const path = editingId === null ? 'items' : `items/${encodeURIComponent(String(editingId))}`;
      const method = editingId === null ? 'POST' : 'PUT';
      const item = parseItem(await request(path, method, { name: name.trim() }));
      setItems(previous => editingId === null
        ? [...previous, item]
        : previous.map(old => old.id === editingId ? item : old));
      setName('');
      setEditingId(null);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Failed to save item');
    } finally {
      setSaving(false);
    }
  }

  async function remove(id: number) {
    if (loading || saving) return;
    setSaving(true);
    setError(null);
    try {
      await request(`items/${encodeURIComponent(String(id))}`, 'DELETE');
      setItems(previous => previous.filter(item => item.id !== id));
      if (editingId === id) { setEditingId(null); setName(''); }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Failed to delete item');
    } finally {
      setSaving(false);
    }
  }

  const disabled = loading || saving;
  return (
    <div>
      <h1>Items</h1>
      <input aria-label="Search" placeholder="Search" value={search}
        disabled={saving} onChange={event => setSearch(event.target.value)} />
      {loading && <p role="status">Loading...</p>}
      {saving && <p role="status">Saving...</p>}
      {error && <p role="alert">{error}</p>}
      <ul>
        {items.map(item => (
          <li key={item.id}>
            {item.name}{' '}
            <button disabled={disabled} onClick={() => {
              setEditingId(item.id); setName(item.name);
            }}>Update</button>
            <button disabled={disabled} onClick={() => void remove(item.id)}>Delete</button>
          </li>
        ))}
      </ul>
      <form onSubmit={event => { event.preventDefault(); void save(); }}>
        <input aria-label="Item name" value={name} disabled={disabled}
          onChange={event => setName(event.target.value)} required />
        <button disabled={disabled || !name.trim()}>
          {editingId === null ? 'Add' : 'Save'}
        </button>
        {editingId !== null && <button type="button" disabled={disabled} onClick={() => {
          setEditingId(null); setName('');
        }}>Cancel</button>}
      </form>
    </div>
  );
}
