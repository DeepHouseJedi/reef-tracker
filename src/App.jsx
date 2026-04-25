import React, { useEffect, useMemo, useState } from 'react';
import { Activity, Droplets, Download, Plus, Trash2, Waves } from 'lucide-react';
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

const STORAGE_KEY = 'reef-tank-tracker-entries-v3';

const PARAMS = [
  { key: 'alk', label: 'dKH', step: '0.1', unit: 'dKH', decimals: 2, icon: Activity },
  { key: 'calcium', label: 'Ca', step: '1', unit: 'ppm', decimals: 0, icon: Droplets },
  { key: 'magnesium', label: 'Mg', step: '1', unit: 'ppm', decimals: 0, icon: Waves },
  { key: 'phosphate', label: 'PO4', step: '0.01', unit: 'ppm', decimals: 2, icon: Droplets },
  { key: 'nitrate', label: 'NO3', step: '0.1', unit: 'ppm', decimals: 1, icon: Activity },
];

const sampleEntries = [
  { id: 1, date: '2026-04-20T08:30', alk: 8.4, calcium: 430, magnesium: 1360, phosphate: 0.06, nitrate: 7.2, notes: 'Corals extended well.' },
  { id: 2, date: '2026-04-21T19:15', alk: 8.3, calcium: null, magnesium: null, phosphate: 0.07, nitrate: null, notes: 'Fed heavier than usual.' },
  { id: 3, date: '2026-04-22T09:05', alk: null, calcium: 432, magnesium: 1362, phosphate: 0.05, nitrate: 6.9, notes: 'Small water change.' },
];

function getLocalDateTime() {
  const now = new Date();
  const offset = now.getTimezoneOffset();
  const local = new Date(now.getTime() - offset * 60000);
  return local.toISOString().slice(0, 16);
}

function formatDateTime(value) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString([], {
    month: 'numeric',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function formatShortDateTime(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString([], {
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function Card({ children, className = '' }) {
  return <div className={`card ${className}`}>{children}</div>;
}

function Button({ children, className = '', ...props }) {
  return <button className={`button ${className}`} {...props}>{children}</button>;
}

function StatCard({ param, latestValue, average }) {
  const Icon = param.icon;
  return (
    <Card className="stat-card">
      <div>
        <p className="muted small">{param.label}</p>
        <p className="stat-value">{latestValue != null ? `${latestValue} ${param.unit}` : '—'}</p>
        <p className="muted tiny">
          Avg {average != null ? average.toFixed(param.decimals) : '—'} {param.unit}
        </p>
      </div>
      <div className="icon"><Icon size={24} /></div>
    </Card>
  );
}

export default function App() {
  const [entries, setEntries] = useState(sampleEntries);
  const [selectedParam, setSelectedParam] = useState('alk');
  const [tab, setTab] = useState('log');
  const [message, setMessage] = useState('');
  const [form, setForm] = useState({
    date: getLocalDateTime(),
    alk: '',
    calcium: '',
    magnesium: '',
    phosphate: '',
    nitrate: '',
    notes: '',
  });

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) setEntries(parsed);
      } catch {
        localStorage.removeItem(STORAGE_KEY);
      }
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  }, [entries]);

  const sortedEntries = useMemo(() => [...entries].sort((a, b) => a.date.localeCompare(b.date)), [entries]);
  const historyEntries = useMemo(() => [...sortedEntries].reverse(), [sortedEntries]);

  const latestByParam = useMemo(() => {
    const result = {};
    PARAMS.forEach(param => {
      result[param.key] = [...sortedEntries]
        .reverse()
        .find(entry => entry[param.key] !== null && entry[param.key] !== undefined)?.[param.key] ?? null;
    });
    return result;
  }, [sortedEntries]);

  const averages = useMemo(() => {
    const result = {};
    PARAMS.forEach(param => {
      const values = sortedEntries
        .map(entry => entry[param.key])
        .filter(value => value !== null && value !== undefined && value !== '')
        .map(Number)
        .filter(Number.isFinite);
      result[param.key] = values.length ? values.reduce((a, b) => a + b, 0) / values.length : null;
    });
    return result;
  }, [sortedEntries]);

  const chartData = useMemo(() => sortedEntries.map(entry => ({
    date: formatShortDateTime(entry.date),
    fullDate: formatDateTime(entry.date),
    ...Object.fromEntries(PARAMS.map(param => [
      param.key,
      entry[param.key] == null ? null : Number(entry[param.key]),
    ])),
  })), [sortedEntries]);

  const selectedMeta = PARAMS.find(param => param.key === selectedParam);

  function handleChange(key, value) {
    setForm(prev => ({ ...prev, [key]: value }));
  }

  function addEntry() {
    setMessage('');

    if (!form.date) {
      setMessage('Please choose a date and time.');
      return;
    }

    const enteredParams = PARAMS.filter(param => String(form[param.key] ?? '').trim() !== '');
    if (!enteredParams.length) {
      setMessage('Enter at least one parameter, then tap Save reading.');
      return;
    }

    const parsed = {
      id: Date.now(),
      date: form.date,
      notes: form.notes.trim(),
    };

    for (const param of PARAMS) {
      const raw = String(form[param.key] ?? '').trim();
      if (raw === '') {
        parsed[param.key] = null;
        continue;
      }

      const value = Number(raw);
      if (!Number.isFinite(value)) {
        setMessage(`Check ${param.label}. It needs to be a number.`);
        return;
      }

      parsed[param.key] = value;
    }

    setEntries(prev => [...prev, parsed]);
    setForm({
      date: getLocalDateTime(),
      alk: '',
      calcium: '',
      magnesium: '',
      phosphate: '',
      nitrate: '',
      notes: '',
    });
    setMessage('Reading saved.');
    window.setTimeout(() => {
      setMessage('');
    }, 3000);
  }

  function removeEntry(id) {
    setEntries(prev => prev.filter(entry => entry.id !== id));
  }

  function resetEntries() {
    if (confirm('Reset all readings and restore sample data?')) setEntries(sampleEntries);
  }

  function exportJson() {
    const blob = new Blob([JSON.stringify(entries, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'reef-tank-readings.json';
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <main className="app">
      <section className="hero">
        <div>
          <div className="badge"><Waves size={16} /> Reef Tank Tracker</div>
          <h1>Track reef parameters day by day</h1>
          <p>Log dKH, Ca, Mg, PO4, and NO3 one at a time or in groups. Blank fields are skipped.</p>
          <p className="save-note">Readings save automatically on this device.</p>
          <div className="actions">
            <Button className="secondary" onClick={exportJson}><Download size={16} /> Export data</Button>
          </div>
        </div>
        <Card className="latest">
          <p className="muted small">Latest entry</p>
          <strong>{sortedEntries.at(-1) ? formatDateTime(sortedEntries.at(-1).date) : 'No data yet'}</strong>
        </Card>
      </section>

      <section className="stats">
        {PARAMS.map(param => (
          <StatCard key={param.key} param={param} latestValue={latestByParam[param.key]} average={averages[param.key]} />
        ))}
      </section>

      <nav className="tabs">
        <button className={tab === 'log' ? 'active' : ''} onClick={() => setTab('log')}>Add Reading</button>
        <button className={tab === 'charts' ? 'active' : ''} onClick={() => setTab('charts')}>Charts</button>
        <button className={tab === 'history' ? 'active' : ''} onClick={() => setTab('history')}>History</button>
      </nav>

      {tab === 'log' && (
        <Card>
          <h2>Enter daily parameters</h2>
          <p className="muted">Add one or more parameters at a time. Blank fields will be skipped.</p>
          <div className="form-grid">
            <label>
              Date & Time
              <input type="datetime-local" value={form.date} onChange={e => handleChange('date', e.target.value)} />
            </label>
            {PARAMS.map(param => (
              <label key={param.key}>
                {param.label} ({param.unit})
                <input
                  type="number"
                  inputMode="decimal"
                  step={param.step}
                  placeholder={`Enter ${param.label}`}
                  value={form[param.key]}
                  onChange={e => handleChange(param.key, e.target.value)}
                />
              </label>
            ))}
          </div>
          <label className="notes">
            Notes
            <input
              placeholder="Optional: dosing, feeding, water change, coral observations"
              value={form.notes}
              onChange={e => handleChange('notes', e.target.value)}
            />
          </label>
          <div className="actions">
            <Button onClick={addEntry}><Plus size={16} /> Save reading</Button>
            <Button className="secondary" onClick={resetEntries}>Reset sample data</Button>
          </div>
          {message && <div className="message">{message}</div>}
        </Card>
      )}

      {tab === 'charts' && (
        <section className="chart-layout">
          <Card>
            <h2>Choose parameter</h2>
            {PARAMS.map(param => (
              <button
                key={param.key}
                className={`param-button ${selectedParam === param.key ? 'active' : ''}`}
                onClick={() => setSelectedParam(param.key)}
              >
                {param.label}<span>Track over time</span>
              </button>
            ))}
          </Card>
          <Card>
            <h2>{selectedMeta.label} trend</h2>
            <div className="chart">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip
                    formatter={value => [`${value} ${selectedMeta.unit}`, selectedMeta.label]}
                    labelFormatter={(label, payload) => payload?.[0]?.payload?.fullDate || label}
                  />
                  <Line type="monotone" dataKey={selectedParam} strokeWidth={3} connectNulls={false} dot={{ r: 4 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </section>
      )}

      {tab === 'history' && (
        <Card>
          <h2>Reading history</h2>
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th>Date & Time</th><th>dKH</th><th>Ca</th><th>Mg</th><th>PO4</th><th>NO3</th><th>Notes</th><th></th></tr>
              </thead>
              <tbody>
                {historyEntries.map(entry => (
                  <tr key={entry.id}>
                    <td>{formatDateTime(entry.date)}</td>
                    <td>{entry.alk ?? '—'}</td>
                    <td>{entry.calcium ?? '—'}</td>
                    <td>{entry.magnesium ?? '—'}</td>
                    <td>{entry.phosphate ?? '—'}</td>
                    <td>{entry.nitrate ?? '—'}</td>
                    <td>{entry.notes || '—'}</td>
                    <td><button className="delete" onClick={() => removeEntry(entry.id)}><Trash2 size={16} /></button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </main>
  );
}
