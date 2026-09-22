// Pure data/render helpers for the Marketing dashboard, ported from the
// original marketing-and-sales-performance artifact (the one the 2026-09-22
// audit reviewed), adapted from its dictionary-encoded row format to this
// app's flat dataroom.perf_deals / perf_meetings / perf_spend columns.
//
// Kept as template-string renderers rather than JSX, deliberately: the
// original's table/drilldown/sparkline builders are dense and easy to get
// subtly wrong on a re-derive, so this is a faithful line-for-line port with
// the audited defects fixed inline (each one marked FIX #n, matching the
// audit doc). Field names differ from the original; behaviour otherwise
// matches it exactly except where a FIX comment says it doesn't.

export const FIELD = {
  month: 'month', set: 'set_type', owner: 'owner', role: 'role', status: 'status',
  reason: 'reason', closed: 'closed_date', pair: 'source_pair', sub: 'sub_source',
  ch: 'channel', country: 'country', region: 'region', size: 'size_band', met: 'met',
  host: 'host', regsrc: 'region_source', rcat: 'reason_category',
};
export const dec = (r, k) => (r ? r[FIELD[k] || k] ?? null : null);

export const CH = ['Google Ads', 'Clutch', 'Organic+Direct+LLMs+Other', 'Social Media'];
export const NOATTR = ['unknown', 'undefined / undefined'];
// FIX #9 (Won page "Attributed"): direct/none reads as a named source in the
// original. This second list is for a stricter "genuinely named source"
// count, kept separate from NOATTR because NOATTR also drives the coverage
// and signal logic, which should keep treating direct/none as attribution
// rather than as no-source.
const DIRECTISH = ['direct / none', 'direct/none', 'direct', '(direct)', 'none'];
export const SIZES = ['1-10', '11-50', '51-200', '201-1000', '1000+', 'Unknown'];

export const fmt = (n) => Number(n || 0).toLocaleString('en-US');
export const usd = (n) => (n == null || isNaN(n)) ? '—' : '$' + Math.round(n).toLocaleString('en-US');
export const esc = (t) => String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;');

export function buildCost(spendRows) {
  const COST = {};
  (spendRows || []).forEach((r) => {
    const m = (COST[r.month] ||= {});
    m[r.channel] = (m[r.channel] || 0) + Number(r.amount);
  });
  Object.keys(COST).forEach((m) => {
    COST[m].TOTAL = CH.reduce((a, ch) => a + (COST[m][ch] || 0), 0);
  });
  return COST;
}

const MONTH_ORDER = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
export function monthsFrom(cost) {
  return Object.keys(cost).sort((a, b) => MONTH_ORDER.indexOf(a) - MONTH_ORDER.indexOf(b));
}

export function makeEngine(deals, meetings, cost) {
  const MONTHS = monthsFrom(cost);
  const HAS = (k) => deals.some((r) => dec(r, k) != null);
  const raw = (m, s) => deals.filter((r) => dec(r, 'month') === m && dec(r, 'set') === s);

  function filt(rs, st) {
    return rs.filter((r) =>
      (!st.pair.length || st.pair.includes(dec(r, 'pair'))) &&
      (!st.sub.length || st.sub.includes(dec(r, 'sub'))) &&
      (!HAS('region') || !st.region.length || st.region.includes(dec(r, 'region'))) &&
      (!st.owner.length || st.owner.includes(dec(r, 'owner'))) &&
      (!HAS('rcat') || !st.reason.length || st.reason.includes(dec(r, 'rcat'))) &&
      (!HAS('size') || !st.size.length || st.size.includes(dec(r, 'size'))));
  }
  function scope(st, m) {
    m = m || st.month;
    const created = filt(raw(m, 'created'), st), closed = filt(raw(m, 'closed'), st);
    return {
      m, created, closed,
      won: closed.filter((r) => dec(r, 'status') === 'Won'),
      lost: closed.filter((r) => dec(r, 'status') === 'Lost'),
    };
  }
  // FIX (spend never responds to filters): true whenever any DIMENSION filter
  // is on. Month is a scope choice, not a filter, so it does not trigger this —
  // COST is already keyed per month and that part was never wrong.
  const anyDimFilter = (st) => ['pair', 'sub', 'region', 'size', 'owner', 'reason'].some((k) => st[k].length);

  const grp = (rs, k) => {
    const o = {}; rs.forEach((r) => { const v = dec(r, k) || '—'; o[v] = (o[v] || 0) + 1; });
    return Object.entries(o).sort((a, b) => b[1] - a[1]);
  };
  const cnt = (rs, k, v) => rs.filter((r) => dec(r, k) === v).length;
  const prevM = (st) => { const i = MONTHS.indexOf(st.month); return i > 0 ? MONTHS[i - 1] : null; };
  const known = (rs) => HAS('region') ? rs.filter((r) => dec(r, 'region') && dec(r, 'region') !== 'Unknown') : [];

  function rateTable(rows, key, order, cls) {
    const g = {};
    rows.forEach((r) => {
      const k = dec(r, key) || 'Unknown';
      g[k] = g[k] || { w: 0, l: 0, o: 0 };
      const s2 = dec(r, 'status');
      if (s2 === 'Won') g[k].w++; else if (s2 === 'Lost') g[k].l++; else g[k].o++;
    });
    let e = Object.entries(g);
    if (order) e.sort((a, b) => order.indexOf(a[0]) - order.indexOf(b[0]));
    else e.sort((a, b) => (b[1].w + b[1].l) - (a[1].w + a[1].l));
    if (!e.length) return '<p class="empty">Nothing matches these filters.</p>';
    const mx = Math.max(1, ...e.map((x) => x[1].w + x[1].l));
    return `<table><thead><tr><th>${key === 'size' ? 'Company size' : 'Group'}</th>
      <th class="num">Won</th><th class="num">Lost</th><th class="num">Resolved</th><th></th>
      <th class="num">Win rate</th></tr></thead><tbody>${e.map(([k, v]) => {
      const res = v.w + v.l;
      return `<tr><td class="src">${esc(k)}</td>
        <td class="num">${v.w ? '<span class="pill g">' + v.w + '</span>' : '<span class="mut">0</span>'}</td>
        <td class="num mut">${v.l}</td><td class="num">${res}</td>
        <td class="track ${cls}"><i style="width:${Math.max(3, res / mx * 100)}%"></i></td>
        <td class="num">${res ? (v.w / res * 100).toFixed(1) + '%' : '—'}</td></tr>`;
    }).join('')}</tbody></table>`;
  }
  function ranks(entries, cls, tot) {
    if (!entries.length) return '<p class="empty">Nothing matches these filters.</p>';
    const mx = Math.max(1, ...entries.map((e) => e[1])); tot = tot || entries.reduce((a, b) => a + b[1], 0) || 1;
    return `<table><tbody>${entries.map(([k, v]) =>
      `<tr><td class="src">${esc(k)}</td><td class="num">${fmt(v)}</td>
       <td class="track ${cls}"><i style="width:${Math.max(3, v / mx * 100)}%"></i></td>
       <td class="num mut">${Math.round(v / tot * 100)}%</td></tr>`).join('')}</tbody></table>`;
  }
  function drillTable(rows, parentKey, childKey, cls, hdr) {
    const g = grp(rows, parentKey), tot = rows.length || 1, mx = Math.max(1, ...g.map((x) => x[1]));
    if (!g.length) return '<p class="empty">Nothing matches these filters.</p>';
    let body = '';
    g.forEach(([k, n], i) => {
      const kids = grp(rows.filter((r) => (dec(r, parentKey) || '—') === k), childKey);
      body += `<tr class="drill" data-k="d${i}" tabindex="0" role="button" aria-expanded="false">
        <td class="src"><span class="tw">&#9654;</span>${esc(k)}</td><td class="num">${fmt(n)}</td>
        <td class="track ${cls}"><i style="width:${Math.max(3, n / mx * 100)}%"></i></td>
        <td class="num mut">${Math.round(n / tot * 100)}%</td>
        <td class="mut">${kids.length}</td></tr>`;
      const km = Math.max(1, ...kids.map((x) => x[1]));
      kids.forEach(([p, c]) => {
        body += `<tr class="kid" data-p="d${i}" hidden>
          <td>${esc(p)}</td><td class="num">${fmt(c)}</td>
          <td class="track ${cls}"><i style="width:${Math.max(3, c / km * 100)}%"></i></td>
          <td class="num mut">${Math.round(c / n * 100)}%</td><td></td></tr>`;
      });
    });
    return `<table><thead><tr><th>${hdr[0]}</th><th class="num">Deals</th><th></th>
      <th class="num">Share</th><th>${hdr[1]}</th></tr></thead><tbody>${body}</tbody></table>`;
  }
  function strip(title, total, parts) {
    const t = total || 1;
    return `<div class="strip"><div class="stt"><b>${esc(title)}</b><span>${fmt(total)}</span></div>
      <div class="sbar">${parts.map((p) => `<i style="width:${p.v / t * 100}%;background:${p.c}"
        title="${esc(p.n)}: ${p.v}"></i>`).join('')}</div>
      <div class="skey">${parts.filter((p) => p.v).map((p) =>
      `<div><i style="background:${p.c}"></i>${esc(p.n)} <b>${fmt(p.v)}</b></div>`).join('')}</div></div>`;
  }
  function sparkline(vals, labels, color, fmtV) {
    const W = 320, H = 74, P = 17, L = 8, R = 8, mn = Math.min(...vals), mx = Math.max(...vals), sp = (mx - mn) || 1;
    const X = (i) => L + i * ((W - L - R) / Math.max(1, vals.length - 1)), Y = (v) => P + (1 - (v - mn) / sp) * (H - P * 2);
    return `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none">
      <polyline points="${vals.map((v, i) => X(i) + ',' + Y(v)).join(' ')}" fill="none"
        stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
      ${vals.map((v, i) => `<circle cx="${X(i)}" cy="${Y(v)}" r="${i === vals.length - 1 ? 4 : 2.5}"
        fill="${i === vals.length - 1 ? color : '#0B0B0D'}" stroke="${color}" stroke-width="2"/>
        <text class="vn" x="${X(i)}" y="${Y(v) - 9}" text-anchor="${i === 0 ? 'start' : i === vals.length - 1 ? 'end' : 'middle'}"
        >${fmtV ? fmtV(v) : v}</text>`).join('')}</svg>
      <div style="display:flex;justify-content:space-between;margin-top:2px">
      ${labels.map((l) => `<span class="al">${l}</span>`).join('')}</div>`;
  }
  function metrics(items) {
    return `<div class="metrics">${items.map(([l, v, s, c]) =>
      `<div class="mx ${c || ''}"><div class="lab">${l}</div><div class="val">${v}</div>
       <div class="sub">${s}</div></div>`).join('')}</div>`;
  }
  function coverNote(s) {
    const na = s.created.filter((r) => NOATTR.includes(dec(r, 'pair'))).length;
    const pct = s.created.length ? Math.round(na / s.created.length * 100) : 0;
    return `<p class="note"><b>${pct}% of deals created in ${s.m} carry no usable attribution</b>
      &mdash; ${fmt(na)} of ${fmt(s.created.length)}. Channel figures are floors, not totals.</p>`;
  }

  function momTable(st) {
    const i = MONTHS.indexOf(st.month);
    if (i < 1) return `<section><p class="eyebrow">Month over month</p>
      <h2>${st.month} is the first month in this report</h2>
      <p class="sup">Pick a later month to compare against the one before it.</p></section>`;
    const prev = MONTHS[i - 1], a = scope(st, st.month), b = scope(st, prev);
    const cv = (x) => x.created.length ? (1 - x.created.filter((r) => NOATTR.includes(dec(r, 'pair'))).length / x.created.length) * 100 : 0;
    const wr = (x) => (x.won.length + x.lost.length) ? x.won.length / (x.won.length + x.lost.length) * 100 : 0;
    const cpw = (x, m) => (x.won.length && cost[m].TOTAL) ? cost[m].TOTAL / x.won.length : null;
    // FIX (change column labels points as %): each row now says whether its
    // Change column is a level-formatted delta (isPct=true -> "pts", never a
    // bare number with a misleading % suffix) or the metric's own unit.
    const rows = [
      ['Deals created', b.created.length, a.created.length, fmt, 1, false],
      ['Deals won', b.won.length, a.won.length, fmt, 1, false],
      ['Deals lost', b.lost.length, a.lost.length, fmt, -1, false],
      ['Win rate', wr(b), wr(a), (v) => v.toFixed(1) + '%', 1, true],
      ['Marketing spend', cost[prev].TOTAL, cost[st.month].TOTAL, usd, 0, false],
      ['Cost per win', cpw(b, prev), cpw(a, st.month), usd, -1, false],
      ['Attribution coverage', cv(b), cv(a), (v) => v.toFixed(0) + '%', 1, true],
    ];
    CH.forEach((ch) => {
      const pb = cnt(b.won, 'ch', ch), pa = cnt(a.won, 'ch', ch);
      if (pb || pa) rows.push([ch.split('+')[0] + ' wins', pb, pa, fmt, 1, false]);
    });
    return `<section><p class="eyebrow">Month over month</p>
      <h2>${st.month} compared with ${prev}</h2>
      <p class="sup">Same filters applied to both months. Colour follows meaning, so falling cost
        and falling losses read as good.</p>
      <div class="card momwrap" style="margin-top:16px"><div class="cb"><table class="momtbl">
        <thead><tr><th>Metric</th><th class="num">${prev}</th><th class="num">${st.month}</th>
        <th class="num">Change</th><th class="num">%</th></tr></thead><tbody>
        ${rows.map(([lab, was, now, f, dir, isPct]) => {
      if (was == null || now == null) return `<tr><td class="metric">${lab}</td>
            <td class="num mut">${was == null ? '—' : f(was)}</td><td class="num">${now == null ? '—' : f(now)}</td>
            <td class="num mut">—</td><td class="num mut">—</td></tr>`;
      const d = now - was, pc = was ? d / was * 100 : null;
      const good = dir === 0 ? 0 : (dir > 0 ? d > 0 : d < 0);
      const cls = d === 0 ? 'fl' : (dir === 0 ? 'fl' : (good ? 'up' : 'dn'));
      const arrow = d > 0 ? '&#9650;' : d < 0 ? '&#9660;' : '';
      const changeText = isPct ? `${Math.abs(d).toFixed(1)} pts` : f(Math.abs(d));
      return `<tr><td class="metric">${lab}</td><td class="num mut">${f(was)}</td>
          <td class="num">${f(now)}</td>
          <td class="num delta ${cls}">${arrow} ${changeText}</td>
          <td class="num delta ${cls}">${pc == null ? '—' : (d > 0 ? '+' : d < 0 ? '-' : '') + Math.abs(pc).toFixed(0) + '%'}</td></tr>`;
    }).join('')}</tbody></table></div></div></section>`;
  }

  function signals(st) {
    const s = scope(st, st.month), p = prevM(st) ? scope(st, prevM(st)) : null, out = [];
    const push = (dir, title, body, thin) => out.push({ dir, title, body, thin });
    const wr = (x) => (x.won.length + x.lost.length) ? x.won.length / (x.won.length + x.lost.length) * 100 : 0;
    const cv = (x) => x.created.length ? (1 - x.created.filter((r) => NOATTR.includes(dec(r, 'pair'))).length / x.created.length) * 100 : 0;

    if (p) {
      const a = (s.won.length && cost[st.month].TOTAL) ? cost[st.month].TOTAL / s.won.length : null;
      const b = (p.won.length && cost[p.m].TOTAL) ? cost[p.m].TOTAL / p.won.length : null;
      if (a && b && Math.abs(a - b) / b >= .10)
        push(a < b ? 'up' : 'dn', `Cost per win ${a < b ? 'fell' : 'rose'} ${Math.abs((a - b) / b * 100).toFixed(0)}%`,
          `${usd(b)} in ${p.m} to ${usd(a)} in ${st.month}, on ${fmt(s.won.length)} wins against ${fmt(p.won.length)}.`);
      const d = cv(s) - cv(p);
      if (Math.abs(d) >= 3)
        push(d > 0 ? 'up' : 'dn', `Attribution coverage ${d > 0 ? 'improved' : 'fell'} ${Math.abs(d).toFixed(0)} points`,
          `${cv(p).toFixed(0)}% in ${p.m} to ${cv(s).toFixed(0)}% in ${st.month}. ` +
          (d > 0 ? 'More of the funnel is measurable.' : 'Less of the funnel is measurable, which weakens every channel number on every page.'));
      const dw = wr(s) - wr(p);
      if (Math.abs(dw) >= 1)
        push(dw > 0 ? 'up' : 'dn', `Win rate ${dw > 0 ? 'up' : 'down'} ${Math.abs(dw).toFixed(1)} points`,
          `${wr(p).toFixed(1)}% in ${p.m} to ${wr(s).toFixed(1)}% in ${st.month}.`);
      CH.forEach((ch) => {
        const nw = cnt(s.won, 'ch', ch), pw = cnt(p.won, 'ch', ch), sp = cost[st.month][ch];
        const nc = cnt(s.closed, 'ch', ch); // FIX ("None closed" false): real closed count, not assumed zero
        if (nw !== pw && (nw >= 2 || pw >= 2))
          push(nw > pw ? 'up' : 'dn', `${ch.split('+')[0]} wins went ${pw} to ${nw}`,
            sp ? `At ${usd(sp)} that is ${nw ? usd(sp / nw) + ' per win' : 'no return'} this month.` : 'No spend recorded.');
        else if (sp && nw === 0 && pw === 0)
          push('wa', `${ch.split('+')[0]} produced no wins ${nc > 0 ? 'despite deals closing' : 'again'}`,
            `${usd(sp)} spent in ${st.month}, ${fmt(cnt(s.created, 'ch', ch))} deals created, ` +
            (nc > 0 ? `${fmt(nc)} closed, all lost.` : 'none closed.'));
      });
      const now = Object.fromEntries(grp(s.created, 'pair')), pre = Object.fromEntries(grp(p.created, 'pair'));
      Object.keys(Object.assign({}, now, pre)).filter((k) => !NOATTR.includes(k)).forEach((k) => {
        const a2 = now[k] || 0, b2 = pre[k] || 0;
        if (b2 >= 10 && a2 / Math.max(1, b2) <= .5) push('dn', `${k} halved`, `${b2} deals in ${p.m} to ${a2} in ${st.month}.`);
        else if (a2 >= 10 && b2 > 0 && a2 / b2 >= 2) push('up', `${k} doubled`, `${b2} deals in ${p.m} to ${a2} in ${st.month}.`);
        else if (a2 >= 5 && b2 === 0) push('up', `${k} is new`, `${a2} deals in ${st.month}, none in ${p.m}.`);
      });
    }
    // FIX (loss-reason double count): use the same key the Lost page itself
    // uses (rcat when available), so this signal never disagrees with the
    // page it is summarising.
    const lossKey = HAS('rcat') ? 'rcat' : 'reason';
    const topLoss = grp(s.lost, lossKey)[0];
    if (topLoss && s.lost.length) {
      const sub = grp(s.lost.filter((r) => (dec(r, lossKey) || '—') === topLoss[0]), 'pair');
      const na = sub.filter((x) => NOATTR.includes(x[0])).reduce((a, b) => a + b[1], 0);
      if (na / topLoss[1] >= .3)
        push('wa', `"${topLoss[0]}" is mostly unattributed`,
          `${fmt(na)} of ${fmt(topLoss[1])} deals lost to this reason have no usable source, so the largest loss category is also the least explainable.`);
    }
    const ovr = s.created.length ? s.won.length / s.created.length * 100 : 0;
    grp(s.created, 'pair').filter((e) => !NOATTR.includes(e[0]) && e[1] >= 3).forEach(([k, n]) => {
      const w = cnt(s.won, 'pair', k);
      if (w && w / n >= .4) push('up', `${k} converts at ${Math.round(w / n * 100)}%`,
        `${w} wins from ${n} deals created, against ${ovr.toFixed(0)}% overall.`,
        n < 8 ? `Only ${n} deals — a lead, not a conclusion` : null);
    });
    const kl = known(s.closed), unk = s.closed.length - kl.length;
    const covPct = s.closed.length ? Math.round(kl.length / s.closed.length * 100) : 0;
    if (kl.length >= 10) grp(kl, 'region').forEach(([rg, n]) => {
      const w = kl.filter((r) => dec(r, 'region') === rg && dec(r, 'status') === 'Won').length;
      const base = `Based on ${n} of the ${fmt(kl.length)} closed deals that have a region ` +
        `(${covPct}% of ${fmt(s.closed.length)} closed). ${fmt(unk)} closed deals have no region, ` +
        `so ${rg}'s true volume could be materially higher.`;
      if (n >= 8 && w === 0) push('dn', `${rg}: ${n} closed, none won`,
        `Every closed deal with a ${rg} contact was a loss. ` + base,
        n < 15 ? `${n} deals of ${fmt(s.closed.length)} closed — directional only` : null);
      else if (n >= 8 && w / n >= .35) push('up', `${rg} won ${w} of ${n} it closed (${Math.round(w / n * 100)}%)`,
        base, n < 15 ? `${n} deals of ${fmt(s.closed.length)} closed — directional only` : null);
    });
    return out;
  }

  // ADDED (audit's buried finding): 847 meeting records with host/met/region
  // sat in the original artifact's own DATA.meetings, embedded but never
  // rendered on any of its 7 tabs. This is the AE close-ratio denominator the
  // 15% growth plan needed, so it now has a real home on the Team tab.
  function meetingHostTable(st) {
    const hosts = {};
    meetings.forEach((m) => {
      if (m.month !== st.month) return;
      (hosts[m.host] ||= { booked: 0, held: 0, won: 0 }).booked++;
    });
    filt(raw(st.month, 'closed'), st).forEach((r) => {
      const h = dec(r, 'host');
      if (!h || dec(r, 'met') !== 'Met') return;
      (hosts[h] ||= { booked: 0, held: 0, won: 0 }).held++;
      if (dec(r, 'status') === 'Won') hosts[h].won++;
    });
    const rows = Object.entries(hosts).sort((a, b) => b[1].held - a[1].held);
    if (!rows.length) return '<p class="empty">No meeting records for this month.</p>';
    return `<table><thead><tr><th>Host</th><th class="num">Booked</th>
      <th class="num">Held and closed</th><th class="num">Won</th><th class="num">Close ratio</th>
      </tr></thead><tbody>${rows.map(([h, v]) => `<tr><td class="src">${esc(h)}</td>
        <td class="num">${fmt(v.booked)}</td><td class="num">${fmt(v.held)}</td><td class="num">${fmt(v.won)}</td>
        <td class="num" style="font-weight:700;color:${v.held && v.won / v.held >= .06 ? 'var(--grn2)' : 'var(--red)'}">
        ${v.held ? (v.won / v.held * 100).toFixed(1) + '%' : '—'}</td></tr>`).join('')}</tbody></table>`;
  }

  return {
    MONTHS, HAS, raw, filt, scope, anyDimFilter, grp, cnt, prevM, known,
    rateTable, ranks, drillTable, strip, sparkline, metrics, coverNote, momTable, signals, meetingHostTable,
  };
}

export function buildPages(engine, cost) {
  const { MONTHS, HAS, scope, filt, raw, anyDimFilter, grp, cnt, known, rateTable, ranks, drillTable,
    strip, sparkline, metrics, coverNote, momTable, signals, meetingHostTable } = engine;

  return {
    overview: {
      label: 'Overview',
      render(st) {
        const s = scope(st, st.month), c = cost[st.month] || {};
        const wr = (s.won.length + s.lost.length) ? s.won.length / (s.won.length + s.lost.length) * 100 : 0;
        const sig = signals(st), byM = MONTHS.map((m) => scope(st, m));
        const suppressed = anyDimFilter(st);
        return metrics([
          ['Won', fmt(s.won.length), 'closed won in ' + st.month, 'g'],
          ['Lost', fmt(s.lost.length), 'closed lost in ' + st.month, 'r'],
          ['Win rate', wr.toFixed(1) + '%', 'of everything closed', ''],
          ['Created', fmt(s.created.length), 'new opportunities', ''],
          // FIX (spend never responds to filters): suppressed rather than
          // silently charging the whole month's budget to a filtered slice.
          ['Spend', suppressed ? '—' : usd(c.TOTAL), suppressed ? 'clear filters to see spend' : 'all channels', 'b'],
          ['Cost per win', suppressed ? '—' : ((s.won.length && c.TOTAL) ? usd(c.TOTAL / s.won.length) : '—'),
            suppressed ? 'suppressed under a filter' : 'spend / wins', 'b'],
        ])
          + (suppressed ? `<p class="note"><b>Spend and cost per win are hidden while a filter is on.</b>
             The source has one spend figure per month per channel with no way to split it by
             source, region, size, owner or reason. Clear the filters to see them.</p>` : '')
          + coverNote(s)
          + momTable(st)
          + `<section><p class="eyebrow">What changed</p><h2>Signals</h2>
           <p class="sup">Read from the data rather than written by hand. Improvements and problems both
             surface here, and anything resting on a small sample says so.</p>
           <div style="margin-top:16px">${sig.length ? sig.map((x) =>
            `<div class="sig ${x.dir}"><div class="ic">${x.dir === 'up' ? '&#9650;' : x.dir === 'dn' ? '&#9660;' : '!'}</div>
             <div><b>${esc(x.title)}</b><p>${esc(x.body)}</p>
             ${x.thin ? '<span class="thin">' + esc(x.thin) + '</span>' : ''}</div></div>`).join('')
            : '<p class="empty">No material change against the prior month.</p>'}</div></section>`
          + `<section><p class="eyebrow">Trend</p><h2>${MONTHS[0]} to ${MONTHS[MONTHS.length - 1]}</h2>
           <div class="grid2" style="margin-top:16px">
            <div class="card"><div class="ch"><h3>Deals created</h3></div><div class="cb">
              ${sparkline(byM.map((x) => x.created.length), MONTHS, '#6BBCEA')}</div></div>
            <div class="card g"><div class="ch"><h3>Deals won</h3></div><div class="cb">
              ${sparkline(byM.map((x) => x.won.length), MONTHS, '#80B122')}</div></div>
            <div class="card"><div class="ch"><h3>Cost per win</h3></div><div class="cb">
              ${suppressed ? '<p class="empty">Suppressed under a filter.</p>' : sparkline(MONTHS.map((m, i) => (byM[i].won.length && cost[m].TOTAL) ? Math.round(cost[m].TOTAL / byM[i].won.length) : 0),
              MONTHS, '#E8B54D', (v) => v ? '$' + (v / 1000).toFixed(1) + 'k' : '—')}</div></div>
            <div class="card"><div class="ch"><h3>Attribution coverage</h3></div><div class="cb">
              ${sparkline(byM.map((x) => x.created.length ? Math.round((1 - x.created.filter((r) => NOATTR.includes(dec(r, 'pair'))).length / x.created.length) * 100) : 0),
              MONTHS, '#B0D26C', (v) => v + '%')}</div></div>
           </div></section>`;
      },
    },

    trend: {
      label: 'Three month trend',
      render(st) {
        const byM = MONTHS.map((m) => scope(st, m));
        const suppressed = anyDimFilter(st);
        const cv = (x) => x.created.length ? (1 - x.created.filter((r) => NOATTR.includes(dec(r, 'pair'))).length / x.created.length) * 100 : 0;
        const wr = (x) => (x.won.length + x.lost.length) ? x.won.length / (x.won.length + x.lost.length) * 100 : 0;
        const cpw = (x, m) => (x.won.length && cost[m].TOTAL) ? cost[m].TOTAL / x.won.length : null;
        const arrow = (v, dir) => {
          if (v === 0 || v == null) return '<span class="fl">&mdash;</span>';
          const good = dir === 0 ? null : (dir > 0 ? v > 0 : v < 0);
          return `<span class="delta ${good === null ? 'fl' : good ? 'up' : 'dn'}">${v > 0 ? '&#9650;' : '&#9660;'}</span>`;
        };
        const line = (lab, vals, f, dir) => {
          const ok = vals.filter((v) => v != null);
          const d = (ok.length > 1) ? ok[ok.length - 1] - ok[0] : null;
          const pc = (d != null && ok[0]) ? d / ok[0] * 100 : null;
          return `<tr><td class="metric src">${lab}</td>
            ${vals.map((v) => `<td class="num">${v == null ? '—' : f(v)}</td>`).join('')}
            <td class="num">${arrow(d, dir)}</td>
            <td class="num delta ${d == null || d === 0 ? 'fl' : (dir === 0 ? 'fl' : ((dir > 0 ? d > 0 : d < 0) ? 'up' : 'dn'))}">
              ${pc == null ? '—' : (d > 0 ? '+' : d < 0 ? '-' : '') + Math.abs(pc).toFixed(0) + '%'}</td></tr>`;
        };
        const head = (first) => `<thead><tr><th>${first}</th>${MONTHS.map((m) => `<th class="num">${m}</th>`).join('')}
          <th class="num">Dir</th><th class="num">${MONTHS[0]}→${MONTHS[MONTHS.length - 1]}</th></tr></thead>`;
        const dimTable = (title, key, pick, dir) => {
          const keySet = new Set();
          byM.forEach((x) => (pick === 'created' ? x.created : pick === 'won' ? x.won : x.lost)
            .forEach((r) => { const v = dec(r, key); if (v) keySet.add(v); }));
          const rows = [...keySet].map((k) => {
            const vals = byM.map((x) => cnt(pick === 'created' ? x.created : pick === 'won' ? x.won : x.lost, key, k));
            return { k, vals, tot: vals.reduce((a, b) => a + b, 0) };
          }).filter((r) => r.tot > 0).sort((a, b) => b.tot - a.tot).slice(0, 14);
          if (!rows.length) return '';
          return `<div class="card"><div class="ch"><h3>${title}</h3></div><div class="cb">
            <table>${head(key === 'pair' ? 'Source / medium' : key === 'ch' ? 'Channel' : key === 'region' ? 'Region' :
            key === 'rcat' ? 'Reason' : key === 'size' ? 'Company size' : 'Owner')}
            <tbody>${rows.map((r) => line(esc(r.k), r.vals, fmt, dir)).join('')}</tbody></table></div></div>`;
        };
        return `<section><p class="eyebrow">Three month trend</p>
          <h2>${MONTHS[0]} to ${MONTHS[MONTHS.length - 1]}</h2>
          <p class="sup">Every month side by side, with the move from first to last. Colour follows meaning,
            so falling cost and falling losses read as good. Filters apply to all three months at once.</p>
          <div class="card" style="margin-top:16px"><div class="cb"><table class="momtbl">
            ${head('Metric')}<tbody>
            ${line('Deals created', byM.map((x) => x.created.length), fmt, 1)}
            ${line('Deals won', byM.map((x) => x.won.length), fmt, 1)}
            ${line('Deals lost', byM.map((x) => x.lost.length), fmt, -1)}
            ${line('Win rate', byM.map(wr), (v) => v.toFixed(1) + '%', 1)}
            ${suppressed ? '' : line('Marketing spend', MONTHS.map((m) => cost[m].TOTAL), usd, 0)}
            ${suppressed ? '' : line('Cost per win', MONTHS.map((m, i) => cpw(byM[i], m)), usd, -1)}
            ${suppressed ? '' : line('Cost per deal created', MONTHS.map((m, i) => byM[i].created.length && cost[m].TOTAL ? cost[m].TOTAL / byM[i].created.length : null), usd, -1)}
            ${line('Attribution coverage', byM.map(cv), (v) => v.toFixed(0) + '%', 1)}
            </tbody></table></div></div>${suppressed ? '<p class="note">Spend rows are hidden under a filter — see Overview.</p>' : ''}</section>

          <section><h2>Shape of the trend</h2>
          <div class="grid2" style="margin-top:16px">
            <div class="card"><div class="ch"><h3>Deals created</h3></div><div class="cb">
              ${sparkline(byM.map((x) => x.created.length), MONTHS, '#6BBCEA')}</div></div>
            <div class="card g"><div class="ch"><h3>Deals won</h3></div><div class="cb">
              ${sparkline(byM.map((x) => x.won.length), MONTHS, '#80B122')}</div></div>
            <div class="card"><div class="ch"><h3>Cost per win</h3></div><div class="cb">
              ${suppressed ? '<p class="empty">Suppressed under a filter.</p>' : sparkline(MONTHS.map((m, i) => { const v = cpw(byM[i], m); return v ? Math.round(v) : 0; }),
              MONTHS, '#E8B54D', (v) => v ? '$' + (v / 1000).toFixed(1) + 'k' : 'no wins')}</div></div>
            <div class="card"><div class="ch"><h3>Attribution coverage</h3></div><div class="cb">
              ${sparkline(byM.map((x) => Math.round(cv(x))), MONTHS, '#B0D26C', (v) => v + '%')}</div></div>
          </div></section>

          <section><h2>By channel and source</h2><div class="grid2" style="margin-top:16px">
            ${dimTable('Deals created by channel', 'ch', 'created', 1)}
            ${dimTable('Deals won by channel', 'ch', 'won', 1)}
            ${dimTable('Deals created by source', 'pair', 'created', 1)}
            ${dimTable('Deals won by source', 'pair', 'won', 1)}
          </div></section>

          <section><h2>By region, size and team</h2><div class="grid2" style="margin-top:16px">
            ${HAS('region') ? dimTable('Deals created by region', 'region', 'created', 1) : ''}
            ${HAS('size') ? dimTable('Deals created by company size', 'size', 'created', 1) : ''}
            ${dimTable('Deals won by owner', 'owner', 'won', 1)}
            ${HAS('rcat') ? dimTable('Losses by reason', 'rcat', 'lost', -1) : ''}
          </div></section>`;
      },
    },

    spend: {
      label: 'Marketing spend',
      render(st) {
        const s = scope(st, st.month), c = cost[st.month] || {}, byM = MONTHS.map((m) => scope(st, m));
        const suppressed = anyDimFilter(st);
        if (suppressed) {
          return `<section><p class="eyebrow">Spend</p><h2>Cost by channel</h2>
            <div class="note"><b>Spend is hidden while a filter is on.</b> The expense sheet has one
            figure per month per channel, with no way to attribute it to a source, region, size,
            owner or reason. Showing it under a filter would charge the whole month's budget to a
            slice of it — clear the filters above to see spend.</div></section>`;
        }
        const rows = CH.map((ch) => {
          const cr = cnt(s.created, 'ch', ch), w = cnt(s.won, 'ch', ch), sp = c[ch];
          return `<tr><td class="src">${ch}</td>
            <td class="num">${sp == null ? '<span class="pill a">not tracked</span>' : usd(sp)}</td>
            <td class="num">${fmt(cr)}</td><td class="num">${(sp && cr) ? usd(sp / cr) : '—'}</td>
            <td class="num">${w ? '<span class="pill g">' + w + '</span>' : '<span class="pill r">0</span>'}</td>
            <td class="num">${(sp && w) ? usd(sp / w) : (sp ? '<span class="pill r">no return</span>' : '—')}</td></tr>`;
        }).join('');
        return `<section><p class="eyebrow">Spend</p><h2>Cost by channel</h2>
          <p class="sup">Segmented only by the lines on the expense sheet, so every figure ties to a budget
            that was actually set. Source and medium detail lives on the Won and Lost pages.
            <!-- FIX: the "Conv. rate" column is removed — it divided this month's wins by this
                 month's creates, two different cohorts, which read as a real conversion rate and
                 was not one. See Methodology. --></p>
          <div class="card" style="margin-top:16px"><div class="cb"><table>
            <thead><tr><th>Expense line</th><th class="num">Spend</th><th class="num">Created</th>
            <th class="num">Cost / deal</th><th class="num">Won</th><th class="num">Cost / win</th>
            </tr></thead><tbody>${rows}</tbody></table></div></div></section>
          <section><h2>Cost per win over time</h2>
          <p class="sup">Spend divided by deals won, so a channel that wins more gets cheaper without
            spending less. Read the spend line underneath each chart before drawing a conclusion.</p>
          <div class="grid2" style="margin-top:16px">
            ${CH.filter((ch) => cost[st.month][ch]).map((ch) => {
          const wins = MONTHS.map((m, i) => cnt(byM[i].won, 'ch', ch));
          const v = MONTHS.map((m, i) => (wins[i] && cost[m][ch]) ? Math.round(cost[m][ch] / wins[i]) : 0);
          return `<div class="card"><div class="ch"><h3>${ch} — cost per win</h3>
              <p>Zero means no wins that month</p></div><div class="cb">
              ${sparkline(v, MONTHS, '#6BBCEA', (x) => x ? '$' + (x / 1000).toFixed(1) + 'k' : 'no wins')}
              <table style="margin-top:10px"><tbody>
                <tr><td class="mut" style="width:96px">Spend</td>${MONTHS.map((m) =>
            `<td class="num">${usd(cost[m][ch])}</td>`).join('')}</tr>
                <tr><td class="mut">Deals won</td>${wins.map((w) =>
            `<td class="num">${w}</td>`).join('')}</tr>
              </tbody></table></div></div>`;
        }).join('')}
          </div></section>
          <section><h2>Where the deals came from, month by month</h2>
          <div class="card" style="margin-top:16px"><div class="cb">
            ${MONTHS.map((m, i) => strip(m + ' — ' + usd(cost[m].TOTAL) + ' spend, ' + byM[i].won.length + ' wins',
          byM[i].created.length, CH.map((ch, j) => ({
            n: ch.split('+')[0], v: cnt(byM[i].created, 'ch', ch),
            c: ['#80B122', '#2D9CDB', '#B8B8BC', '#E8B54D'][j],
          })))).join('')}
          </div></div></section>`;
      },
    },

    won: {
      label: 'Won',
      render(st) {
        const s = scope(st, st.month);
        const namedSource = s.won.filter((r) => {
          const v = (dec(r, 'pair') || '').toLowerCase();
          return !NOATTR.includes(dec(r, 'pair')) && !DIRECTISH.includes(v);
        }).length;
        const att = s.won.filter((r) => !NOATTR.includes(dec(r, 'pair'))).length;
        // FIX (Win rate NaN): guard on won+lost (what the ratio actually
        // divides by), not on deals created — the original's mismatch is
        // exactly what produced "NaN%" whenever a filter left deals created
        // but nothing closed.
        const resolved = s.won.length + s.lost.length;
        return metrics([
          ['Won', fmt(s.won.length), 'closed won in ' + st.month, 'g'],
          ['Attributed', fmt(att) + ' of ' + fmt(s.won.length), 'have a usable source (incl. direct/none)', ''],
          ['Named source', fmt(namedSource) + ' of ' + fmt(s.won.length), 'excludes direct/none', ''],
          ['Win rate', resolved ? (s.won.length / resolved * 100).toFixed(1) + '%' : '—', 'of everything closed', 'g'],
        ])
          + `<section><p class="eyebrow">Won</p><h2>Where wins come from</h2>
           <div class="grid2" style="margin-top:16px">
            <div class="card g"><div class="ch"><h3>By source and medium</h3>
              <span class="pill g">${fmt(s.won.length)}</span></div>
              <div class="cb">${ranks(grp(s.won, 'pair'), 'g', s.won.length)}</div></div>
            <div class="card g"><div class="ch"><h3>By channel</h3></div>
              <div class="cb">${ranks(grp(s.won, 'ch'), 'g', s.won.length)}</div></div>
            ${HAS('region') ? `<div class="card g"><div class="ch"><h3>By region</h3>
              <p>Unknown means the contact has no country on file</p></div>
              <div class="cb">${ranks(grp(s.won, 'region'), 'g', s.won.length)}</div></div>` : ''}
            <div class="card g"><div class="ch"><h3>By owner</h3></div>
              <div class="cb">${ranks(grp(s.won, 'owner'), 'g', s.won.length)}</div></div>
           </div></section>
           ${HAS('size') ? `<section><h2>Win rate by company size</h2>
           <p class="sup">Won against lost only, so deals still in flight do not distort it.
             Size comes from the Calendly booking form.</p>
           <div class="card g" style="margin-top:16px"><div class="cb">
             ${rateTable(s.closed, 'size', SIZES, 'g')}</div></div></section>` : ''}
           ${HAS('region') ? `<section><h2>Cross-reference</h2>
           <p class="sup">Click a region to see which sources produced its wins.</p>
           <div class="card g" style="margin-top:16px"><div class="cb">
             ${drillTable(s.won, 'region', 'pair', 'g', ['Region', 'Sources'])}</div></div></section>` : ''}
           <section><h2>Wins over time</h2><div class="card g" style="margin-top:16px"><div class="cb">
             ${sparkline(MONTHS.map((m) => scope(st, m).won.length), MONTHS, '#80B122')}</div></div></section>`;
      },
    },

    lost: {
      label: 'Lost',
      render(st) {
        const s = scope(st, st.month);
        const na = s.lost.filter((r) => NOATTR.includes(dec(r, 'pair'))).length;
        const kl = known(s.lost);
        const cat = HAS('rcat');
        const raw2 = grp(s.lost, 'reason');
        return metrics([
          ['Lost', fmt(s.lost.length), 'closed lost in ' + st.month, 'r'],
          ['Top category', (grp(s.lost, cat ? 'rcat' : 'reason')[0] || ['—'])[0], 'most common', ''],
          ['Unattributed', fmt(na), 'no usable source', 'r'],
          ['Distinct responses', fmt(raw2.length), 'free text entered', ''],
        ])
          + `<section><p class="eyebrow">Lost</p><h2>Why deals are lost</h2>
           <p class="sup">Reasons are free text in Pipedrive, so they are grouped into categories here.
             Click a category to see the exact responses behind it.</p>
           <div class="card r" style="margin-top:16px"><div class="cb">
             ${cat ? drillTable(s.lost, 'rcat', 'reason', 'r', ['Category', 'Responses'])
            : drillTable(s.lost, 'reason', 'pair', 'r', ['Reason', 'Sources'])}</div></div></section>
           <section><h2>Cross-reference</h2>
           <div class="grid2" style="margin-top:16px">
            <div class="card r"><div class="ch"><h3>Source, then category</h3>
              <p>What each source tends to lose to</p></div>
              <div class="cb">${drillTable(s.lost, 'pair', cat ? 'rcat' : 'reason', 'r', ['Source', 'Categories'])}</div></div>
            ${kl.length ? `<div class="card r"><div class="ch"><h3>Region, then category</h3>
              <p>Known regions only</p></div>
              <div class="cb">${drillTable(kl, 'region', cat ? 'rcat' : 'reason', 'r', ['Region', 'Categories'])}</div></div>` : ''}
            ${HAS('size') ? `<div class="card r"><div class="ch"><h3>Company size, then category</h3></div>
              <div class="cb">${drillTable(s.lost.filter((r) => dec(r, 'size') !== 'Unknown'), 'size', cat ? 'rcat' : 'reason', 'r', ['Size', 'Categories'])}</div></div>` : ''}
           </div></section>
           <section><p class="eyebrow">Reference</p><h2>Every response as entered</h2>
           <p class="sup">The raw text from Pipedrive, ungrouped. ${fmt(raw2.length)} distinct responses
             across ${fmt(s.lost.length)} lost deals in ${st.month}.</p>
           <div class="card" style="margin-top:16px"><div class="cb">
             <table><thead><tr><th>Response as entered</th><th class="num">Deals</th>
             <th>Category</th></tr></thead><tbody>${raw2.map(([k, v]) => {
          const ex = s.lost.find((r) => (dec(r, 'reason') || '—') === k);
          return `<tr><td class="src">${esc(k || '(not recorded)')}</td><td class="num">${fmt(v)}</td>
               <td class="mut">${cat && ex ? esc(dec(ex, 'rcat')) : ''}</td></tr>`;
        }).join('')}</tbody></table>
           </div></div></section>`;
      },
    },

    team: {
      label: 'Team',
      render(st) {
        const P = {};
        MONTHS.forEach((m) => {
          filt(raw(m, 'created'), st).forEach((r) => {
            const o = dec(r, 'owner');
            (P[o] = P[o] || { role: dec(r, 'role'), c: {}, w: {} }).c[m] = (P[o].c[m] || 0) + 1;
          });
          filt(raw(m, 'closed'), st).filter((r) => dec(r, 'status') === 'Won').forEach((r) => {
            const o = dec(r, 'owner');
            (P[o] = P[o] || { role: dec(r, 'role'), c: {}, w: {} }).w[m] = (P[o].w[m] || 0) + 1;
          });
        });
        const tbl = (role, metric, hi) => {
          const ent = Object.entries(P).filter((e) => e[1].role === role)
            .sort((a, b) => (b[1][metric][st.month] || 0) - (a[1][metric][st.month] || 0));
          if (!ent.length) return '<p class="empty">Nobody matches these filters.</p>';
          const gmx = Math.max(1, ...ent.map((e) => Math.max(...MONTHS.map((m) => e[1][metric][m] || 0))));
          return `<table><thead><tr><th>Person</th>${MONTHS.map((m) => '<th class="num">' + m + '</th>').join('')}
            <th></th><th>Trend</th><th class="num">Change</th></tr></thead><tbody>
            ${ent.map((e) => {
            const n = e[0], d = e[1];
            const v = MONTHS.map((m) => d[metric][m] || 0), mx = Math.max(1, ...v);
            const dl = v[v.length - 1] - (v[v.length - 2] || 0), cs = dl > 0 ? 'up' : dl < 0 ? 'dn' : 'fl';
            return `<tr><td class="src">${esc(n)}</td>${v.map((x) => '<td class="num">' + fmt(x) + '</td>').join('')}
              <td class="track ${hi}"><i style="width:${Math.max(3, v[v.length - 1] / gmx * 100)}%"></i></td>
              <td><div class="spark">${v.map((x) => '<i class="' + (hi === 'g' ? 'hi' : '') + '" style="height:' +
                Math.max(3, x / mx * 26) + 'px"></i>').join('')}</div></td>
              <td class="num delta ${cs}">${dl > 0 ? '+' : ''}${dl}</td></tr>`;
          }).join('')}</tbody></table>`;
        };
        // FIX (Team page loses June wins): the AE table only ever counted
        // role === 'AE'. Anyone else who happens to close a won deal (an SDR
        // covering, in this dataset Clara Galetti) vanished from BOTH tables
        // instead of reconciling to the Overview headline. Show them plainly.
        const monthWon = scope(st, st.month).won.length;
        const aeWon = Object.entries(P).filter((e) => e[1].role === 'AE').reduce((a, e) => a + (e[1].w[st.month] || 0), 0);
        const otherWinners = Object.entries(P).filter((e) => e[1].role !== 'AE' && (e[1].w[st.month] || 0) > 0);
        const gap = monthWon - aeWon;
        return `<section><p class="eyebrow">Sales executives</p><h2>Deals won</h2>
          <div class="card g" style="margin-top:16px"><div class="cb">${tbl('AE', 'w', 'g')}</div></div>
          ${gap > 0 && otherWinners.length ? `<p class="note"><b>${fmt(gap)} more win${gap === 1 ? '' : 's'} this month belong
            to ${otherWinners.map(([n]) => esc(n)).join(', ')}</b>, tracked here as ${otherWinners[0][1].role},
            so the ${fmt(monthWon)} in the Overview headline does not equal this table's sum on its own.</p>` : ''}
          </section>
          <section><p class="eyebrow">SDRs</p><h2>Deals created</h2>
          <p class="sup">Qualifying an account out is the job, so losses are never counted here.</p>
          <div class="card" style="margin-top:16px"><div class="cb">${tbl('SDR', 'c', 'b')}</div></div></section>
          <section><p class="eyebrow">Meetings</p><h2>By host, first calls held and closed</h2>
          <p class="sup">The meeting record set this dashboard used to carry but never show. This is the
            close-ratio denominator: wins per first call actually held, by the person who ran it.</p>
          <div class="card g" style="margin-top:16px"><div class="cb">${meetingHostTable(st)}</div></div></section>`;
      },
    },

    regions: {
      label: 'Regions',
      render(st) {
        const s = scope(st, st.month);
        if (!HAS('region')) return '<p class="empty">No region data in this dataset.</p>';
        const kc = known(s.created), kl = known(s.closed);
        const cov = s.created.length ? Math.round(kc.length / s.created.length * 100) : 0;
        const covCl = s.closed.length ? Math.round(kl.length / s.closed.length * 100) : 0;
        const unkC = s.created.length - kc.length, unkL = s.closed.length - kl.length;
        const unkW = s.won.length - kl.filter((r) => dec(r, 'status') === 'Won').length;
        // FIX (two precisions for the same figure): 1 decimal everywhere on
        // this page, matching the cross-reference table below it.
        const rows = grp(kl, 'region').map(([rg, n]) => {
          const w = kl.filter((r) => dec(r, 'region') === rg && dec(r, 'status') === 'Won').length;
          return `<tr><td class="src">${esc(rg)}</td><td class="num">${fmt(cnt(kc, 'region', rg))}</td>
            <td class="num">${fmt(n)}</td>
            <td class="num">${w ? '<span class="pill g">' + w + '</span>' : '<span class="pill r">0</span>'}</td>
            <td class="num mut">${n ? (w / n * 100).toFixed(1) + '%' : '—'}</td></tr>`;
        }).join('');
        return `<p class="note"><b>Region is known for ${cov}% of deals created and ${covCl}% of deals
          closed in ${st.month}</b> &mdash; ${fmt(kc.length)} of ${fmt(s.created.length)} created and
          ${fmt(kl.length)} of ${fmt(s.closed.length)} closed, taken from the contact's country.
          That leaves ${fmt(unkC)} created and ${fmt(unkL)} closed deals with no region at all,
          including ${fmt(unkW)} of the ${fmt(s.won.length)} wins. Every figure on this page is a
          <b>floor</b> for its region, not a share of the book: a region with few deals here may simply
          have contacts whose country was never captured.</p>
          ${HAS('regsrc') ? `<div class="card" style="margin-top:4px"><div class="ch">
            <h3>Where the region came from</h3><p>Calendly time zone is preferred; Pipedrive
            country is the fallback</p></div><div class="cb">
            ${ranks(grp(s.created, 'regsrc'), 'b', s.created.length)}</div></div>` : ''}
          <section><p class="eyebrow">Regions</p><h2>Performance by region</h2>
          <div class="card" style="margin-top:16px"><div class="cb">
            ${rows ? `<table><thead><tr><th>Region</th><th class="num">Created</th><th class="num">Closed</th>
            <th class="num">Won</th><th class="num">Win rate</th></tr></thead><tbody>${rows}
            <tr><td class="mut">Region not captured</td><td class="num mut">${fmt(unkC)}</td>
            <td class="num mut">${fmt(unkL)}</td><td class="num mut">${fmt(unkW)}</td>
            <td class="num mut">${unkL ? (unkW / unkL * 100).toFixed(1) + '%' : '—'}</td></tr>
            <tr><td class="src">Total</td><td class="num">${fmt(s.created.length)}</td>
            <td class="num">${fmt(s.closed.length)}</td><td class="num">${fmt(s.won.length)}</td>
            <td class="num mut">${s.closed.length ? (s.won.length / s.closed.length * 100).toFixed(1) + '%' : '—'}</td></tr>
            </tbody></table>`
            : '<p class="empty">No region data in this view.</p>'}</div></div></section>
          <section><h2>Cross-reference</h2>
          <p class="sup">Click a region to open the sources behind it.</p>
          <div class="grid2" style="margin-top:16px">
            <div class="card"><div class="ch"><h3>Region, then source</h3><p>Deals created</p></div>
              <div class="cb">${drillTable(kc, 'region', 'pair', 'b', ['Region', 'Sources'])}</div></div>
            <div class="card"><div class="ch"><h3>Win rate by region</h3>
              <p>Resolved deals only</p></div>
              <div class="cb">${rateTable(known(s.closed), 'region', null, 'b')}</div></div>
          </div></section>`;
      },
    },
  };
}
