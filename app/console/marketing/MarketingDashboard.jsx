'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import './mktg.css';
import { dec, fmt, esc, buildCost, makeEngine, buildPages } from './dashboard-data';

const DIM_FILTERS = [
  ['pair', 'sources', 'Source / medium'],
  ['sub', 'mediums', 'Medium'],
  ['region', 'regions', 'Region'],
  ['size', 'sizes', 'Company size'],
  ['owner', 'owners', 'Owner'],
  ['reason', 'reasons', 'Lost reason'],
];
const CHIP_LABEL = { pair: 'Source', sub: 'Medium', region: 'Region', size: 'Size', owner: 'Owner', reason: 'Reason' };

function MultiSelect({ label, values, counts, selected, onChange }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return;
    const onDoc = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('click', onDoc);
    return () => document.removeEventListener('click', onDoc);
  }, [open]);
  if (!values.length) return null;
  const btnLabel = selected.length === 0 ? 'All ' + label : selected.length === 1 ? selected[0] : selected.length + ' ' + label + ' selected';
  return (
    <div className={'ms' + (selected.length ? ' on' : '') + (open ? ' open' : '')} ref={ref}>
      <button type="button" aria-haspopup="true" aria-expanded={open} onClick={(e) => { e.stopPropagation(); setOpen((v) => !v); }}>
        {btnLabel}
      </button>
      <div className="panel" role="group" aria-label={label} onClick={(e) => e.stopPropagation()}>
        <div className="head">
          <button type="button" onClick={() => onChange(values.slice())}>Select all</button>
          <button type="button" onClick={() => onChange([])}>Clear</button>
        </div>
        {values.map((v) => (
          <label key={v}>
            <input type="checkbox" checked={selected.includes(v)}
                   onChange={(e) => onChange(e.target.checked ? selected.concat(v) : selected.filter((x) => x !== v))} />
            <span>{v}</span>
            <span className="n">{fmt(counts[v] || 0)}</span>
          </label>
        ))}
      </div>
    </div>
  );
}

export default function MarketingDashboard({ dataset }) {
  const { deals, meetings, spend, upload } = dataset;
  const cost = useMemo(() => buildCost(spend), [spend]);
  const engine = useMemo(() => makeEngine(deals, meetings, cost), [deals, meetings, cost]);
  const pages = useMemo(() => buildPages(engine, cost), [engine, cost]);
  const MONTHS = engine.MONTHS;
  const PAGE_KEYS = Object.keys(pages);

  const [st, setSt] = useState(() => ({
    page: 'overview', month: MONTHS[MONTHS.length - 1],
    pair: [], sub: [], region: [], owner: [], reason: [], size: [],
  }));
  const navRef = useRef(null);
  const pageRef = useRef(null);

  // Distinct values (+counts) per filter key, for the multi-select panels —
  // same source as the original's sel(): every value that ever occurs,
  // regardless of the current filter state, so a panel never shrinks under you.
  const optionSets = useMemo(() => {
    const out = {};
    DIM_FILTERS.forEach(([key]) => {
      const filterKey = key === 'reason' ? 'rcat' : key;
      if (!engine.HAS(filterKey)) { out[key] = { values: [], counts: {} }; return; }
      const counts = {};
      deals.forEach((r) => { const v = dec(r, filterKey); if (v && v !== '—') counts[v] = (counts[v] || 0) + 1; });
      const values = Object.keys(counts).sort((a, b) => counts[b] - counts[a] || a.localeCompare(b));
      out[key] = { values, counts };
    });
    return out;
  }, [engine, deals]);

  // wireDrill + wireScroll + sticky nav, re-run after every render of #page.
  useEffect(() => {
    const root = pageRef.current;
    if (!root) return;
    root.querySelectorAll('tr.drill').forEach((row) => {
      const go = () => {
        const wasOpen = row.getAttribute('aria-expanded') === 'true';
        row.setAttribute('aria-expanded', String(!wasOpen));
        row.closest('table')?.querySelectorAll(`tr.kid[data-p="${row.dataset.k}"]`)
          .forEach((k) => { k.hidden = wasOpen; });
      };
      row.onclick = go;
      row.onkeydown = (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(); } };
    });
    const cbs = root.querySelectorAll('.cb');
    const upd = (el) => () => {
      const more = el.scrollWidth - el.clientWidth > 4;
      el.classList.toggle('scrollable', more);
      el.classList.toggle('more', more && el.scrollLeft < el.scrollWidth - el.clientWidth - 4);
    };
    cbs.forEach((el) => { const f = upd(el); f(); el.onscroll = f; });
  });

  useEffect(() => {
    const navEl = navRef.current;
    if (!navEl) return;
    const onScroll = () => navEl.classList.toggle('stuck', navEl.getBoundingClientRect().top <= 0 && window.scrollY > 14);
    const container = navEl.closest('.mktg');
    const target = container || window;
    target.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    return () => target.removeEventListener('scroll', onScroll);
  }, []);

  const setFilter = (key, vals) => setSt((s) => ({ ...s, [key]: vals }));
  const clearAll = () => setSt((s) => ({ ...s, pair: [], sub: [], region: [], owner: [], reason: [], size: [] }));
  const removeChip = (key, v) => setSt((s) => ({ ...s, [key]: s[key].filter((x) => x !== v) }));

  const anyFilterOn = DIM_FILTERS.some(([k]) => st[k].length);
  const title = st.page === 'overview' ? 'Marketing and sales performance' : pages[st.page].label;
  const html = pages[st.page].render(st);

  return (
    <div className="mktg">
      <div className="field"><b className="f1" /><b className="f2" /><b className="f3" /><b className="f4" /></div>
      <div className="grain" />
      <header>
        <div className="wrap">
          <p className="eyebrow">End of month report</p>
          <h1>{title}</h1>
          <p className="sup">{MONTHS[0]} to {MONTHS[MONTHS.length - 1]} 2026 · viewing {st.month}</p>
        </div>
      </header>

      <nav ref={navRef}><div className="wrap">
        <div className="tabs" role="tablist">
          {PAGE_KEYS.map((k) => (
            <button key={k} type="button" role="tab" aria-selected={st.page === k}
                    onClick={() => { setSt((s) => ({ ...s, page: k })); window.scrollTo({ top: 0, behavior: 'smooth' }); }}>
              {pages[k].label}
            </button>
          ))}
        </div>
        <div className="filters">
          <div className="seg" role="group" aria-label="Month">
            {MONTHS.map((m) => (
              <button key={m} type="button" aria-pressed={st.month === m} onClick={() => setSt((s) => ({ ...s, month: m }))}>
                {m}
              </button>
            ))}
          </div>
          {DIM_FILTERS.map(([key, plural, label]) => (
            <div className="f" key={key}>
              <span>{label}</span>
              <MultiSelect label={plural} values={optionSets[key]?.values || []} counts={optionSets[key]?.counts || {}}
                           selected={st[key]} onChange={(vals) => setFilter(key, vals)} />
            </div>
          ))}
          <button className="clear" type="button" onClick={clearAll}>Clear</button>
        </div>
        <div className="chips">
          {Object.keys(CHIP_LABEL).flatMap((k) => st[k].map((v) => (
            <button key={k + v} type="button" onClick={() => removeChip(k, v)}>
              {CHIP_LABEL[k]} <b>{v}</b><span>&times;</span>
            </button>
          )))}
        </div>
      </div></nav>

      <div className="wrap">
        <div ref={pageRef} dangerouslySetInnerHTML={{ __html: html }} />
      </div>

      <footer><div className="wrap">
        Deals created counts everything opened in the month. Won and lost count what closed in the month,
        whatever month it opened. Attribution resolves across first click, last click and UTM, preferring a
        named source and falling back to direct, undefined or unknown rather than discarding the row.
        Cost segmentation uses only the expense-sheet lines.
        {anyFilterOn && ' Spend and cost per win are suppressed while a filter is on — see Overview.'}
        {' '}Source: {upload.filename}, as of {upload.as_of_date}, via the Data Room. See{' '}
        <a href="https://martal-data-room.vercel.app/methodology" style={{ color: 'var(--blu2)' }}>
          Methodology
        </a> for what each figure divides by.
      </div></footer>
    </div>
  );
}
