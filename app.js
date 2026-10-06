/* CivicPulse – client-side app. Data lives in localStorage (demo only). */
const $ = s => document.querySelector(s), $$ = s => [...document.querySelectorAll(s)];

/* ---------- 1. Rules: categories, departments, severity ---------- */
const CATS = {
  'Pothole / Road Damage': { k: ['pothole', 'road', 'crack', 'tar', 'asphalt', 'pit'], dept: 'Public Works (Roads)' },
  'Garbage':               { k: ['garbage', 'trash', 'waste', 'dump', 'litter', 'rubbish', 'bin'], dept: 'Solid Waste Management' },
  'Water Leakage':         { k: ['water', 'leak', 'pipe', 'sewage', 'drain', 'burst'], dept: 'Water Supply Board' },
  'Streetlight':           { k: ['streetlight', 'light', 'lamp', 'dark', 'bulb', 'pole'], dept: 'Electricity Department' },
  'Other':                 { k: [], dept: 'General Municipal Office' }
};
const CRITICAL = ['accident', 'injury', 'injuries', 'injured', 'live wire', 'fire', 'flood', 'electrocution', 'electrocuted', 'hospital', 'school', 'children', 'collapse'];
const HIGH = ['huge', 'deep', 'large', 'days', 'week', 'blocked', 'smell', 'dangerous', 'night', 'traffic'];
const LEVELS = ['Low', 'Medium', 'High', 'Critical'];
const COLORS = { Low: '#2e9e6b', Medium: '#c99700', High: '#e8742c', Critical: '#d12f3f' };
const STEPS = ['Reported', 'Assigned', 'In Progress', 'Resolved'];
// Demo video: paste a YouTube link (e.g. 'https://youtu.be/XXXX') or a file path (e.g. 'assets/demo.mp4'). Leave '' to hide the player.
const DEMO_VIDEO = '';
const DUP_RADIUS = 100; // metres; phone GPS is often 10-50 m off

// Whole-word match (allows simple endings: s, es, d, ed, ing) so "hospital" never matches "pit".
const matches = (text, words) => words.filter(w => new RegExp('\\b' + w + '(?:s|es|d|ed|ing)?\\b').test(text));

// Pick the category whose keywords appear most often. Returns the category and the words that matched.
function classify(text) {
  text = text.toLowerCase();
  let best = 'Other', top = 0, hits = [];
  for (const [name, v] of Object.entries(CATS)) {
    const m = matches(text, v.k);
    if (m.length > top) { top = m.length; best = name; hits = m; }
  }
  return { cat: best, hits };
}

// Danger and urgency words found in a report.
function signals(text) {
  text = text.toLowerCase();
  return { crit: matches(text, CRITICAL), high: matches(text, HIGH) };
}
const union = (a, b) => [...new Set([...(a || []), ...(b || [])])];

// Score 1-4 from danger words, urgency words and how many people reported it.
function severity(sig, count) {
  let s = 1;
  if ((sig.crit || []).length) s += 2;
  if ((sig.high || []).length) s += 1;
  if (count >= 3) s += 1;
  if (count >= 5) s += 1;
  return LEVELS[Math.min(s, 4) - 1];
}

// Plain-language reasons for the priority, shown to the citizen.
function why(sig, count) {
  const r = [];
  if ((sig.crit || []).length) r.push('safety words: ' + sig.crit.join(', '));
  if ((sig.high || []).length) r.push('urgency words: ' + sig.high.join(', '));
  if (count >= 3) r.push(count + ' people reported it');
  return r.length ? r.join('; ') : 'no urgent signals found';
}

// Haversine distance in metres between two {lat,lng} points.
function dist(a, b) {
  const R = 6371000, r = x => x * Math.PI / 180;
  const dLat = r(b.lat - a.lat), dLng = r(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(r(a.lat)) * Math.cos(r(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/* ---------- 2. Data ---------- */
function seed() {
  const rows = [
    ['Pothole / Road Damage', 'Deep pothole causing traffic jams, bike accident yesterday', 12.9352, 77.6245, 5, 'In Progress'],
    ['Garbage', 'Garbage dump overflowing for a week, bad smell', 12.9716, 77.5946, 3, 'Assigned'],
    ['Water Leakage', 'Burst pipe, water flooding the road', 12.9121, 77.6446, 2, 'Reported'],
    ['Streetlight', 'Streetlight not working, very dark at night', 12.9279, 77.6271, 1, 'Reported'],
    ['Pothole / Road Damage', 'Road cracks near school gate', 12.9352, 77.5855, 2, 'Assigned'],
    ['Garbage', 'Trash not collected', 12.9850, 77.6050, 1, 'Resolved'],
    ['Water Leakage', 'Drain leak near market', 12.9610, 77.6400, 1, 'Resolved'],
    ['Streetlight', 'Lamp pole broken', 12.9400, 77.5700, 1, 'In Progress']
  ];
  return rows.map((r, i) => {
    const sig = signals(r[1]);
    return {
      id: 'CP-' + (1001 + i), cat: r[0], text: r[1], lat: r[2], lng: r[3],
      count: r[4], status: r[5], dept: CATS[r[0]].dept, crit: sig.crit, high: sig.high, sev: severity(sig, r[4])
    };
  });
}
// A corrupt or old saved value must never stop the app from loading.
function load() {
  try {
    const v = JSON.parse(localStorage.getItem('cp_cases'));
    if (Array.isArray(v) && v.length) return v;
  } catch (e) { /* fall through to seed data */ }
  return seed();
}
let cases = load();
// Next ID is always one higher than the largest existing number, so IDs never collide.
const nextId = () => 'CP-' + (Math.max(1000, ...cases.map(c => parseInt(String(c.id).slice(3), 10) || 0)) + 1);
const save = () => localStorage.setItem('cp_cases', JSON.stringify(cases));

/* ---------- 3. Navigation ---------- */
let rmap, mmap, pin, pinMarker, markers, heat;
function go(v) {
  $$('main section').forEach(s => s.hidden = s.id !== v);
  $$('header [data-v]').forEach(b => b.classList.toggle('on', b.dataset.v === v));
  setTimeout(() => {
    if (v === 'report') rmap.invalidateSize();
    if (v === 'map') { mmap.invalidateSize(); drawMap(); }
  }, 50);
  if (v === 'dash') dash();
  if (v === 'admin') admin();
}
$$('header [data-v]').forEach(b => b.onclick = () => go(b.dataset.v));

/* ---------- 4. Maps ---------- */
const tiles = () => L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}', { attribution: 'Tiles © Esri', maxZoom: 19 });
rmap = L.map('rmap').setView([12.9716, 77.5946], 12); tiles().addTo(rmap);
mmap = L.map('mmap').setView([12.9716, 77.5946], 12); tiles().addTo(mmap);
markers = L.layerGroup().addTo(mmap);

function setPin(latlng) {
  pin = { lat: latlng.lat, lng: latlng.lng };
  if (pinMarker) pinMarker.setLatLng(latlng); else pinMarker = L.marker(latlng).addTo(rmap);
}
rmap.on('click', e => setPin(e.latlng));
$('#loc').onclick = () => navigator.geolocation
  ? navigator.geolocation.getCurrentPosition(p => {
      const ll = { lat: p.coords.latitude, lng: p.coords.longitude };
      setPin(ll); rmap.setView(ll, 16);
    }, () => alert('Could not get your location. Tap the map instead.'))
  : alert('Location is not supported in this browser.');

function drawMap() {
  markers.clearLayers();
  if (heat) mmap.removeLayer(heat);
  cases.forEach(c => L.circleMarker([c.lat, c.lng], { radius: 8 + c.count * 2, color: COLORS[c.sev], fillOpacity: .65 })
    .bindPopup(`<b>${c.id}</b><br>${c.cat}<br>${c.sev} priority, ${c.status}<br>${c.count} report(s)`).addTo(markers));
  if ($('#heat').checked) heat = L.heatLayer(cases.map(c => [c.lat, c.lng, c.count]), { radius: 35, max: Math.max(3, ...cases.map(c => c.count)) }).addTo(mmap);
}
$('#heat').onchange = drawMap;

/* ---------- 5. Submit a report ---------- */
let rec = null;
$('#mic').onclick = () => {
  if (rec) { rec.stop(); return; }
  const R = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!R) return alert('Voice input works in Chrome. You can type instead.');
  rec = new R(); rec.lang = $('#lang').value;
  rec.onstart = () => { $('#mic').textContent = 'Listening… tap to stop'; };
  rec.onresult = e => { $('#desc').value = ($('#desc').value + ' ' + e.results[0][0].transcript).trim(); };
  rec.onerror = e => alert(e.error === 'not-allowed' ? 'Microphone access was blocked. Allow it in the browser, or type instead.' : 'Could not hear you. Try again or type instead.');
  rec.onend = () => { rec = null; $('#mic').textContent = 'Speak instead'; };
  rec.start();
};

$('#form').onsubmit = e => {
  e.preventDefault();
  if (!pin) return alert('Tap the map to mark the location first.');
  const text = $('#desc').value.trim();
  const file = $('#photo').files[0];
  // The photo's file name (e.g. "pothole_mg_road.jpg") is also used as a hint.
  const { cat, hits } = classify(text + ' ' + (file ? file.name.replace(/[_\-.]/g, ' ') : ''));
  const sig = signals(text);

  // Duplicate check: same category, still open, within DUP_RADIUS. Pick the NEAREST match.
  let c = null, best = Infinity;
  for (const x of cases) {
    if (x.cat !== cat || x.status === 'Resolved') continue;
    const d = dist(x, pin);
    if (d <= DUP_RADIUS && d < best) { best = d; c = x; }
  }
  const merged = !!c;
  if (c) { c.count++; c.crit = union(c.crit, sig.crit); c.high = union(c.high, sig.high); }
  else {
    c = { id: nextId(), cat, text, lat: pin.lat, lng: pin.lng, count: 1, status: 'Reported', crit: sig.crit, high: sig.high };
    cases.push(c);
  }
  c.sev = severity(c, c.count);
  c.dept = CATS[c.cat].dept;
  save();

  const box = $('#result');
  box.hidden = false;
  box.className = merged ? 'merged' : '';
  box.innerHTML = `<h3>${merged ? 'Already reported nearby. We added your report to the same case.' : 'Thanks, your report is in.'}</h3>
    <dl><dt>Complaint ID</dt><dd>${c.id}</dd><dt>Problem</dt><dd>${c.cat}</dd>
    <dt>Priority</dt><dd style="color:${COLORS[c.sev]}">${c.sev}</dd>
    <dt>Sent to</dt><dd>${c.dept}</dd><dt>Reports</dt><dd>${c.count}</dd>
    <dt>Why</dt><dd>${hits.length ? 'matched ' + hits.join(', ') + '; ' : ''}${why(c, c.count)}</dd></dl>
    <p class="hint">Save your ID to track progress on the Track page.</p>`;

  // Clear the form AND the pin so the next report cannot silently reuse this location.
  $('#form').reset();
  pin = null;
  if (pinMarker) { rmap.removeLayer(pinMarker); pinMarker = null; }
};

/* ---------- 6. Dashboard ---------- */
function bars(sel, keys, fn, col) {
  const v = keys.map(fn), m = Math.max(1, ...v);
  $(sel).innerHTML = keys.map((k, i) =>
    `<div class="bar"><span>${k}</span><i style="width:${v[i] / m * 100}%;${col ? 'background:' + col[k] : ''}"></i><em>${v[i]}</em></div>`).join('');
}
function dash() {
  const total = cases.length, done = cases.filter(c => c.status === 'Resolved').length;
  const urgent = cases.filter(c => c.status !== 'Resolved' && ['High', 'Critical'].includes(c.sev)).length;
  $('#stats').innerHTML = [['Total complaints', total], ['Active', total - done], ['Resolved', done], ['High priority', urgent]]
    .map(([l, n]) => `<div class="stat"><b>${n}</b><span>${l}</span></div>`).join('');
  bars('#catbars', Object.keys(CATS), k => cases.filter(c => c.cat === k).length);
  bars('#sevbars', LEVELS, k => cases.filter(c => c.sev === k).length, COLORS);
}

/* ---------- 7. Tracking ---------- */
$('#tform').onsubmit = e => {
  e.preventDefault();
  const c = cases.find(x => x.id === $('#tid').value.trim().toUpperCase());
  const at = c ? STEPS.indexOf(c.status) : -1;
  $('#tres').innerHTML = c
    ? `<h3>${c.id}: ${c.cat}</h3><p>${c.dept}. ${c.sev} priority, ${c.count} report(s).</p>
       <ol class="steps">${STEPS.map((s, i) => `<li class="${i <= at ? 'done' : ''}">${s}</li>`).join('')}</ol>`
    : '<p>No complaint found with that ID. Check it and try again.</p>';
};

/* ---------- 8. Department view ---------- */
function admin() {
  $('#alist').innerHTML = cases.map(c => `<tr><td>${c.id}</td><td>${c.cat}</td><td>${c.dept}</td>
    <td style="color:${COLORS[c.sev]};font-weight:700">${c.sev}</td><td>${c.count}</td>
    <td><select data-id="${c.id}">${STEPS.map(s => `<option${s === c.status ? ' selected' : ''}>${s}</option>`).join('')}</select></td></tr>`).join('');
}
$('#alist').onchange = e => {
  cases.find(x => x.id === e.target.dataset.id).status = e.target.value;
  save();
};
$('#reset').onclick = () => { cases = seed(); save(); admin(); };


/* ---------- 9. How-to / demo video ---------- */
(function () {
  const box = $('#demo'), v = DEMO_VIDEO.trim();
  if (!v) { box.hidden = true; return; }
  const yt = v.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/))([\w-]{11})/);
  box.innerHTML = yt
    ? `<iframe src="https://www.youtube.com/embed/${yt[1]}" title="CivicPulse demo video" allowfullscreen loading="lazy"></iframe>`
    : `<video src="${v.replace(/"/g, '')}" controls preload="metadata" title="CivicPulse demo video"></video>`;
})();
