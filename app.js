/* ============================================================
   Map Puzzle — app.js
   Map rendered with D3 + TopoJSON. No labels, no zoom,
   white land + water, black borders, red dots.
   ============================================================ */

/* ── 1. Date Utilities ─────────────────────────────────── */

function getMondayOfCurrentWeek() {
  const today = new Date();
  const day = today.getDay();
  const diff = (day === 0) ? -6 : 1 - day;
  const monday = new Date(today);
  monday.setDate(today.getDate() + diff);
  monday.setHours(0, 0, 0, 0);
  return monday;
}

function formatFolderDate(date) {
  return date.toLocaleDateString('en-US', {
    month: 'long', day: 'numeric', year: 'numeric'
  });
}

function getTodayDayName() {
  const names = ['sunday','monday','tuesday','wednesday','thursday','friday','saturday'];
  return names[new Date().getDay()];
}

/* ── 2. Point Parsing ──────────────────────────────────── */

function parsePoints(text) {
  return text
    .split('\n')
    .map(l => l.trim())
    .filter(l => l.length > 0)
    .map(l => {
      const parts = l.split(',');
      if (parts.length < 2) return null;
      const lat = parseFloat(parts[0].trim());
      const lon = parseFloat(parts[1].trim());
      if (isNaN(lat) || isNaN(lon)) return null;
      return [lon, lat]; // D3 expects [lon, lat]
    })
    .filter(Boolean);
}

/* ── 3. Map rendering with D3 ──────────────────────────── */

async function renderMap(todayPoints, allWeekPoints) {
  const container = document.getElementById('map-container');
  const W = container.clientWidth || 800;
  const H = container.clientHeight || 460;

  const topology = await d3.json(
    'https://cdn.jsdelivr.net/npm/world-atlas@2/countries-50m.json'
  );

  const countries = topojson.feature(topology, topology.objects.countries);
  const borders   = topojson.mesh(topology, topology.objects.countries, (a, b) => a !== b);

  // Find every country containing at least one of the full week's points
  const matchedCountries = countries.features.filter(feature =>
    allWeekPoints.some(pt => d3.geoContains(feature, pt))
  );


  const lons = allWeekPoints.map(p => p[0]);
  const lats = allWeekPoints.map(p => p[1]);
  const minLon = Math.min(...lons);
  const maxLon = Math.max(...lons);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const buf = 8;

  const projection = d3.geoMercator();
  const padding = 60;

  // Manually compute scale and translate instead of relying on fitExtent
  // Project the corner coordinates and solve for scale/translate directly
  const lonSpan = (maxLon + buf) - (minLon - buf);
  const latSpan = (maxLat + buf) - (minLat - buf);
  const midLon  = (minLon + maxLon) / 2;
  const midLat  = (minLat + maxLat) / 2;

  // Mercator y = ln(tan(π/4 + lat*π/360))
  const mercY = lat => Math.log(Math.tan(Math.PI / 4 + lat * Math.PI / 360));
  const topY    = mercY(maxLat + buf);
  const bottomY = mercY(minLat - buf);
  const mercSpanY = topY - bottomY;
  const mercSpanX = lonSpan * Math.PI / 180;

  const scaleX = (W - padding * 2) / mercSpanX;
  const scaleY = (H - padding * 2) / mercSpanY;
  const scale  = Math.min(scaleX, scaleY);

  projection.scale(scale).center([midLon, midLat]).translate([W / 2, H / 2]);

  const path = d3.geoPath().projection(projection);

  const svg = d3.select('#map-container')
    .append('svg')
    .attr('width', W)
    .attr('height', H)
    .style('display', 'block');

  svg.append('rect')
    .attr('width', W)
    .attr('height', H)
    .attr('fill', '#ffffff');

  svg.append('g')
    .selectAll('path')
    .data(countries.features)
    .join('path')
    .attr('d', path)
    .attr('fill', '#ffffff')
    .attr('stroke', '#000000')
    .attr('stroke-width', 0.5);

  svg.append('path')
    .datum(borders)
    .attr('d', path)
    .attr('fill', 'none')
    .attr('stroke', '#000000')
    .attr('stroke-width', 0.4);

  svg.append('g')
    .selectAll('circle')
    .data(todayPoints)
    .join('circle')
    .attr('cx', d => projection(d)[0])
    .attr('cy', d => projection(d)[1])
    .attr('r', 3)
    .attr('fill', '#e03030')
    .attr('stroke', '#ffffff')
    .attr('stroke-width', 1.5);
}

/* ── 4. Orchestration ──────────────────────────────────── */

async function init() {
  const monday     = getMondayOfCurrentWeek();
  const folderName = formatFolderDate(monday);
  const dayName    = getTodayDayName();

  const allDays = ['monday','tuesday','wednesday','thursday'];
  const todayIndex = allDays.indexOf(dayName);
  const loadUpTo = todayIndex === -1 ? 3 : Math.min(todayIndex, 3);

  let todayPoints   = []; // points to show as dots (cumulative up to today)
  let allWeekPoints = []; // all 4 days' points — used only for country bounding box

  // Load all 4 days for country detection
  for (const day of allDays) {
    const filePath = `./${encodeURIComponent(folderName)}/${day}.txt`;
    try {
      const res = await fetch(filePath);
      if (!res.ok) continue;
      const text = await res.text();
      allWeekPoints = allWeekPoints.concat(parsePoints(text));
    } catch (err) {
      console.warn(`Could not load ${day}:`, err);
    }
  }

  // Load only up to today for the visible dots
  for (const day of allDays.slice(0, loadUpTo + 1)) {
    const filePath = `./${encodeURIComponent(folderName)}/${day}.txt`;
    try {
      const res = await fetch(filePath);
      if (!res.ok) continue;
      const text = await res.text();
      todayPoints = todayPoints.concat(parsePoints(text));
    } catch (err) {
      console.warn(`Could not load ${day}:`, err);
    }
  }

  if (todayPoints.length === 0) {
    document.getElementById('map-container').innerHTML =
      `<p style="padding:2rem;color:#888;text-align:center">No puzzle found for this week. Check back later.</p>`;
    return;
  }

  await renderMap(todayPoints, allWeekPoints);

  // Show winners on Fri/Sat/Sun
  if (['friday','saturday','sunday'].includes(dayName)) {
    await loadWinners(folderName);
  } else {
    console.log('Not a winners day:', dayName);
  }
}

/* ── 5. Winners ────────────────────────────────────────── */

async function loadWinners(folderName) {
  const SHEET_URL = 'https://script.google.com/macros/s/AKfycbzY0KQnMLFHsMDgNyl7QSyZRXUFUqbGPnrXgrQzUqOjkMYuYRGK9SplYRx3AMnsb40Axg/exec';
  try {
    const url = `${SHEET_URL}?week=${encodeURIComponent(folderName)}`;
    const res  = await fetch(url, { redirect: 'follow', mode: 'cors' });
    const data = await res.json();

    if (!data.first && !data.second && !data.third) return;
    document.getElementById('winner-1').textContent = data.first  || '—';
    document.getElementById('winner-2').textContent = data.second || '—';
    document.getElementById('winner-3').textContent = data.third  || '—';
    document.getElementById('winners-section').style.display = 'block';
  } catch (err) {
    console.warn('Could not load winners:', err);
  }
}

/* ── 5. Form ───────────────────────────────────────────── */

document.addEventListener('DOMContentLoaded', () => {
  init();

  // Hidden iframe to absorb the form POST response (avoids page redirect)
  const iframe = document.createElement('iframe');
  iframe.name = 'hidden-submit';
  iframe.style.display = 'none';
  document.body.appendChild(iframe);

  document.getElementById('submit-btn').addEventListener('click', () => {
    const email  = document.getElementById('email').value.trim();
    const guess  = document.getElementById('guess').value.trim();
    const msgEl  = document.getElementById('form-message');
    const submitBtn = document.getElementById('submit-btn');

    msgEl.className = 'form-message';
    msgEl.textContent = '';

    if (!email || !guess) {
      msgEl.textContent = 'Please fill in both fields before submitting.';
      msgEl.classList.add('error');
      return;
    }

    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailPattern.test(email)) {
      msgEl.textContent = 'Please enter a valid email address.';
      msgEl.classList.add('error');
      return;
    }

    const SHEET_URL = 'https://script.google.com/macros/s/AKfycbzY0KQnMLFHsMDgNyl7QSyZRXUFUqbGPnrXgrQzUqOjkMYuYRGK9SplYRx3AMnsb40Axg/exec';

    // Build a temporary form that POSTs directly to Apps Script
    // targeting the hidden iframe — no CORS, no page redirect
    const form = document.createElement('form');
    form.method  = 'POST';
    form.action  = SHEET_URL;
    form.target  = 'hidden-submit';
    form.style.display = 'none';

    const fields = {
      email: email,
      guess: guess,
      day:   getTodayDayName(),
      week:  formatFolderDate(getMondayOfCurrentWeek())
    };

    Object.entries(fields).forEach(([name, value]) => {
      const input = document.createElement('input');
      input.type  = 'hidden';
      input.name  = name;
      input.value = value;
      form.appendChild(input);
    });

    document.body.appendChild(form);
    form.submit();
    document.body.removeChild(form);

    submitBtn.textContent = 'Submit guess';
    submitBtn.disabled = false;
    msgEl.textContent = 'Your guess has been recorded — good luck!';
    msgEl.classList.add('success');
    document.getElementById('email').value = '';
    document.getElementById('guess').value = '';
  });
});