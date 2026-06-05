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

async function renderMap(points) {
  const container = document.getElementById('map-container');
  const W = container.clientWidth || 800;
  const H = container.clientHeight || 460;

  // Fetch world topology
  const topology = await d3.json(
    'https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json'
  );

  const countries = topojson.feature(topology, topology.objects.countries);
  const borders   = topojson.mesh(topology, topology.objects.countries, (a, b) => a !== b);

  // Fit projection to the bounding box of the points, with padding
  const projection = d3.geoMercator();

  // Build a GeoJSON feature collection from the points to use fitExtent
  const pointsGeo = {
    type: 'FeatureCollection',
    features: points.map(([lon, lat]) => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [lon, lat] }
    }))
  };

  const padding = 80;
  projection.fitExtent([[padding, padding], [W - padding, H - padding]], pointsGeo);

  const path = d3.geoPath().projection(projection);

  // Build SVG
  const svg = d3.select('#map-container')
    .append('svg')
    .attr('width', W)
    .attr('height', H)
    .style('display', 'block');

  // Water background
  svg.append('rect')
    .attr('width', W)
    .attr('height', H)
    .attr('fill', '#ffffff');

  // Land fill
  svg.append('g')
    .selectAll('path')
    .data(countries.features)
    .join('path')
    .attr('d', path)
    .attr('fill', '#ffffff')
    .attr('stroke', '#000000')
    .attr('stroke-width', 0.5);

  // Country borders
  svg.append('path')
    .datum(borders)
    .attr('d', path)
    .attr('fill', 'none')
    .attr('stroke', '#000000')
    .attr('stroke-width', 0.4);

  // Red dots
  svg.append('g')
    .selectAll('circle')
    .data(points)
    .join('circle')
    .attr('cx', d => projection(d)[0])
    .attr('cy', d => projection(d)[1])
    .attr('r', 4)
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
  // Friday/Saturday/Sunday: load all 4 days (same as Thursday)
  const loadUpTo = todayIndex === -1 ? 3 : Math.min(todayIndex, 3);
  const daysToLoad = allDays.slice(0, loadUpTo + 1);

  let points = [];

  for (const day of daysToLoad) {
    const filePath = `./${encodeURIComponent(folderName)}/${day}.txt`;
    try {
      const res = await fetch(filePath);
      if (!res.ok) continue;
      const text = await res.text();
      points = points.concat(parsePoints(text));
    } catch (err) {
      console.warn(`Could not load ${day}:`, err);
    }
  }

  if (points.length === 0) {
    document.getElementById('map-container').innerHTML =
      `<p style="padding:2rem;color:#888;text-align:center">No puzzle found for this week. Check back later.</p>`;
    return;
  }

  await renderMap(points);
}

/* ── 5. Form ───────────────────────────────────────────── */

document.addEventListener('DOMContentLoaded', () => {
  init();

  document.getElementById('submit-btn').addEventListener('click', () => {
    const email  = document.getElementById('email').value.trim();
    const guess  = document.getElementById('guess').value.trim();
    const msgEl  = document.getElementById('form-message');

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

    console.log('Submission:', {
      email, guess,
      date: new Date().toISOString(),
      day: getTodayDayName(),
      folder: formatFolderDate(getMondayOfCurrentWeek())
    });

    msgEl.textContent = 'Your guess has been recorded — good luck!';
    msgEl.classList.add('success');
    document.getElementById('email').value = '';
    document.getElementById('guess').value = '';
  });
});