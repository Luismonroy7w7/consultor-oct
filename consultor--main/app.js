const DATA_FILE = 'base_datos.csv';
const storageKey = 'consultor-merchant-visits-v1';
let merchants = [], visitHistory = [], activeMerchant = null, userLocation = null, currentMarker = null;
let routeIds = new Set(JSON.parse(localStorage.getItem('consultor-route-v1') || '[]'));
let visits = JSON.parse(localStorage.getItem(storageKey) || '{}');
let customMerchants = JSON.parse(localStorage.getItem('consultor-custom-merchants-v1') || '[]');
const map = L.map('map', {
  zoomControl: false
}
).setView([25.41, -100.98], 11);
L.control.zoom({
  position: 'bottomright'
}
).addTo(map);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  maxZoom: 19, attribution: '© OpenStreetMap'
}
).addTo(map);
const markerLayer = L.layerGroup().addTo(map);
const routeLine = L.polyline([], {
  color: '#0b6b55', weight: 4, opacity: .72, dashArray: '7 8'
}
).addTo(map);
const els = Object.fromEntries(['merchantList', 'resultCount', 'searchInput', 'visitFilter', 'sortSelect', 'locationStatus', 'routeCount', 'routeTabCount', 'visitTabCount', 'routeSummary', 'openRouteButton', 'clearRouteButton', 'routeList', 'merchantsView', 'routeView', 'visitsView', 'visitHistorySummary', 'visitHistoryList', 'visitDialog', 'dialogMerchantName', 'visitForm', 'visitType', 'visitNotes', 'merchantDialog', 'merchantForm', 'merchantFormStatus', 'addMerchantButton', 'geocodeButton', 'newMerchantName', 'newFirstName', 'newLastName', 'newPhone', 'newEmail', 'newAddress', 'newLatitude', 'newLongitude', 'locateButton'].map(id => [id, document.getElementById(id)]));
function parseCSV(text) {
  const rows = [], row = [];
  let field = '', quoted = false, current = [];
  for (let i = 0;
    i < text.length;
    i++) {
    const c = text[i], n = text[i + 1];
    if (c === '"' && quoted && n === '"') {
      field += '"';
      i++;
    }
    else if (c === '"') quoted = !quoted;
    else if (c === ',' && !quoted) {
      current.push(field);
      field = '';
    }
    else if ((c === '\n' || c === '\r') && !quoted) {
      if (c === '\r' && n === '\n') i++;
      current.push(field);
      if (current.some(Boolean)) rows.push(current);
      current = [];
      field = '';
    }
    else field += c;
  }
  current.push(field);
  if (current.some(Boolean)) rows.push(current);
  const [headers, ...data] = rows;
  return data.map((r, i) => {
    const record = Object.fromEntries(headers.map((h, j) => [h, r[j] || '']));
    record.id = i;
    return record;
  }
  );
}
function distance(a, b) {
  const rad = x => x * Math.PI / 180, R = 6371;
  const dLat = rad(b.lat - a.lat), dLon = rad(b.lng - a.lng);
  const q = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(q));
}
function markerIcon(merchant) {
  return L.divIcon({
    className: '', iconSize: [17, 17], iconAnchor: [8, 8], html: `<div class="pin ${visits[merchant.id] ? 'visited' : ''}"></div>`
  }
  );
}
function phone(m) {
  return [m['Tel 1'], m['Tel 2'], m['Tel 3'], m['Tel 4']].find(Boolean) || 'Sin teléfono';
}
function popup(m) {
  const done = visits[m.id];
  const address = m['Dirección'] || m.Direccion || '';
  return `<div class="popup-title">${escapeHtml(m['Nombre Comercio'])}</div><div class="popup-sub">${escapeHtml(m.Nombre + ' ' + m.Apellido)} · ${escapeHtml(phone(m))}${address ? `<br>${escapeHtml(address)}` : ''}</div><button class="popup-action" onclick="openVisit(${m.id})">${done ? 'Editar visita' : 'Registrar visita'}</button><button class="popup-action popup-route" onclick="toggleRoute(${m.id})">${routeIds.has(m.id) ? 'Quitar de ruta' : 'Añadir a ruta'}</button>`;
}
function escapeHtml(t) {
  return String(t).replace(/[&<>'"]/g, c => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    "'": '&#39;',
    '"': '&quot;'
  }[c]));
}
function filtered() { const q = els.searchInput.value.trim().toLowerCase(), state = els.visitFilter.value; return merchants.filter(m => (!q || `${m['Nombre Comercio']} ${m.Nombre} ${m.Apellido} ${m.Email}`.toLowerCase().includes(q)) && (state === 'all' || (state === 'visited') === Boolean(visits[m.id]))).sort((a, b) => els.sortSelect.value === 'name' ? a['Nombre Comercio'].localeCompare(b['Nombre Comercio']) : els.sortSelect.value === 'priority' ? Number(a['Prioridad Facturación']) - Number(b['Prioridad Facturación']) : (a.km ?? Infinity) - (b.km ?? Infinity)); }
function render() { markerLayer.clearLayers(); const visible = filtered(); els.resultCount.textContent = `${visible.length} resultados`; visible.forEach(m => { const mark = L.marker([m.lat, m.lng], { icon: markerIcon(m) }).bindPopup(popup(m)); mark.on('click', () => { activeMerchant = m.id; renderList(visible); }); markerLayer.addLayer(mark); }); renderList(visible); renderRoute(); renderVisitHistory(); }
function renderList(list = filtered()) { els.merchantList.innerHTML = list.map(m => { const v = visits[m.id], isRoute = routeIds.has(m.id); return `<article class="merchant ${v ? 'visited' : ''} ${activeMerchant === m.id ? 'selected' : ''}" data-id="${m.id}"><div class="merchant-top"><div class="merchant-name">${escapeHtml(m['Nombre Comercio'])}</div><span class="badge ${v ? 'done' : 'pending'}">${v ? 'VISITADO' : 'PENDIENTE'}</span></div><div class="merchant-person">${escapeHtml(m.Nombre + ' ' + m.Apellido)}</div><div class="merchant-meta"><span>${m.km === undefined ? 'Ubicación pendiente' : m.km.toFixed(1) + ' km'}</span><span>Prioridad ${m['Prioridad Facturación'] || '—'}</span></div>${v ? `<div class="merchant-meta"><span>${escapeHtml(v.type)}</span><span>${new Date(v.date).toLocaleDateString('es-MX')}</span></div>` : ''}<button class="add-route" data-route="${m.id}">${isRoute ? '✓ En ruta · quitar' : '＋ Añadir a ruta'}</button></article>`; }).join('') || '<p class="merchant-person">No encontramos comercios con esos filtros.</p>'; }
function selectedRoute() { return [...routeIds].map(id => merchants.find(m => m.id === id)).filter(Boolean); }
function renderRoute() { const selected = selectedRoute(); const points = [...(userLocation ? [userLocation] : []), ...selected.map(m => ({ lat: m.lat, lng: m.lng }))]; routeLine.setLatLngs(points.length > 1 ? points : []); els.routeCount.textContent = selected.length; els.routeTabCount.textContent = selected.length; els.routeSummary.textContent = !selected.length ? 'Selecciona comercios para crear una ruta.' : `${selected.length} parada${selected.length === 1 ? '' : 's'}. Arrastra para cambiar el orden.`; els.openRouteButton.disabled = !selected.length || !userLocation; els.clearRouteButton.disabled = !selected.length; els.routeList.innerHTML = selected.length ? selected.map((m, index) => { const previous = index === 0 ? userLocation : selected[index - 1]; const leg = previous ? `${distance(previous, m).toFixed(1)} km ${index === 0 ? 'desde tu ubicación' : 'desde la parada anterior'}` : 'Distancia al iniciar ubicación'; return `<li class="route-stop" draggable="true" data-route-id="${m.id}"><span class="stop-number">${index + 1}</span><button class="stop-name" data-focus="${m.id}" title="Ver ubicación">${escapeHtml(m['Nombre Comercio'])}<span class="stop-distance">${leg}</span></button><span class="stop-actions"><button data-move="up" data-route-id="${m.id}" title="Subir">↑</button><button data-move="down" data-route-id="${m.id}" title="Bajar">↓</button></span></li>`; }).join('') : '<li class="route-empty">Agrega comercios y define el orden de visita.</li>'; localStorage.setItem('consultor-route-v1', JSON.stringify([...routeIds])); }
function renderVisitHistory() { const records = [...visitHistory].sort((a, b) => new Date(b.date) - new Date(a.date)); els.visitTabCount.textContent = records.length; els.visitHistorySummary.textContent = records.length ? `${records.length} visita${records.length === 1 ? '' : 's'} registrada${records.length === 1 ? '' : 's'}.` : 'Aún no hay visitas registradas.'; els.visitHistoryList.innerHTML = records.length ? records.map(v => `<article class="visit-entry"><div class="visit-entry-top"><h3>${escapeHtml(v.merchantName || 'Comercio')}</h3><span class="visit-type">${escapeHtml(v.type || 'Visita')}</span></div><div class="visit-data">${escapeHtml(v.contactName || 'Sin contacto')} · ${escapeHtml(v.email || 'Sin correo')}</div><div class="visit-data">${new Date(v.date).toLocaleString('es-MX', { dateStyle: 'medium', timeStyle: 'short' })}${v.recordedBy ? ` · ${escapeHtml(v.recordedBy)}` : ''}</div>${v.notes ? `<div class="visit-notes">${escapeHtml(v.notes)}</div>` : '<div class="visit-notes">Sin notas.</div>'}<div class="visit-actions"><button class="visit-location" data-history-focus="${v.merchantId}">⌖ Ver ubicación</button><button class="visit-delete" data-delete-row="${v.row || ''}" data-delete-local="${v.row ? '' : v.merchantId}">Eliminar</button></div></article>`).join('') : '<p class="route-empty">Cuando registres una visita aparecerá aquí.</p>'; }
function toggleRoute(id) { routeIds.has(id) ? routeIds.delete(id) : routeIds.add(id); render(); }
window.toggleRoute = toggleRoute;
window.openVisit = id => { const m = merchants.find(x => x.id === id); activeMerchant = id; els.dialogMerchantName.textContent = m['Nombre Comercio']; const v = visits[id]; els.visitType.value = v?.type || 'Encuesta'; els.visitNotes.value = v?.notes || ''; els.visitDialog.showModal(); };
els.merchantList.addEventListener('click', e => { const article = e.target.closest('.merchant'); if (!article) return; const id = Number(article.dataset.id); if (e.target.dataset.route !== undefined) return toggleRoute(id); const m = merchants.find(x => x.id === id); activeMerchant = id; map.flyTo([m.lat, m.lng], 15); renderList(); });
function reorderRoute(movingId, targetId, placeAfter = false) { const order = [...routeIds]; const oldIndex = order.indexOf(movingId), targetIndex = order.indexOf(targetId); if (oldIndex < 0 || targetIndex < 0 || movingId === targetId) return; order.splice(oldIndex, 1); const insertion = order.indexOf(targetId) + (placeAfter ? 1 : 0); order.splice(insertion, 0, movingId); routeIds = new Set(order); render(); }
els.routeList.addEventListener('click', e => { const id = Number(e.target.dataset.routeId || e.target.dataset.focus); if (!Number.isFinite(id)) return; if (e.target.dataset.focus !== undefined) { const m = merchants.find(x => x.id === id); activeMerchant = id; map.flyTo([m.lat, m.lng], 16); renderList(); return; } const order = [...routeIds], index = order.indexOf(id); if (e.target.dataset.move === 'up' && index > 0) reorderRoute(id, order[index - 1]); if (e.target.dataset.move === 'down' && index < order.length - 1) reorderRoute(id, order[index + 1], true); });
els.routeList.addEventListener('dragstart', e => { const stop = e.target.closest('.route-stop'); if (!stop) return; stop.classList.add('dragging'); e.dataTransfer.setData('text/plain', stop.dataset.routeId); });
els.routeList.addEventListener('dragend', e => e.target.closest('.route-stop')?.classList.remove('dragging'));
els.routeList.addEventListener('dragover', e => e.preventDefault());
els.routeList.addEventListener('drop', e => { e.preventDefault(); const target = e.target.closest('.route-stop'); const movingId = Number(e.dataTransfer.getData('text/plain')); if (target) reorderRoute(movingId, Number(target.dataset.routeId)); });
els.visitHistoryList.addEventListener('click', e => { if (e.target.dataset.deleteRow !== undefined || e.target.dataset.deleteLocal !== undefined) { if (!window.confirm('¿Eliminar esta visita? Esta acción no se puede deshacer.')) return; const row = Number(e.target.dataset.deleteRow), localId = Number(e.target.dataset.deleteLocal); if (row && window.google?.script?.run) { google.script.run.withSuccessHandler(data => initialiseMerchants(data.merchants, data.visits, data.visitHistory || [])).withFailureHandler(showLoadError).deleteVisit(row); return; } const index = visitHistory.findIndex(v => v.merchantId === localId); if (index >= 0) visitHistory.splice(index, 1); delete visits[localId]; localStorage.setItem(storageKey, JSON.stringify(visits)); render(); return; } const id = Number(e.target.dataset.historyFocus); if (!Number.isFinite(id)) return; const merchant = merchants.find(m => m.id === id); if (!merchant) return; els.merchantsView.hidden = false; els.routeView.hidden = true; els.visitsView.hidden = true; document.querySelectorAll('.sidebar-tab').forEach(tab => tab.classList.toggle('active', tab.dataset.view === 'merchants')); activeMerchant = id; map.flyTo([merchant.lat, merchant.lng], 16); renderList(); });
document.querySelectorAll('.sidebar-tab').forEach(button => button.addEventListener('click', () => { const view = button.dataset.view; els.merchantsView.hidden = view !== 'merchants'; els.routeView.hidden = view !== 'route'; els.visitsView.hidden = view !== 'visits'; document.querySelectorAll('.sidebar-tab').forEach(tab => tab.classList.toggle('active', tab === button)); }));
els.visitForm.addEventListener('submit', e => { if (e.submitter?.value === 'cancel') return; e.preventDefault(); const merchant = merchants.find(m => m.id === activeMerchant); const visit = { type: els.visitType.value, notes: els.visitNotes.value.trim(), date: new Date().toISOString() }; visits[activeMerchant] = visit; visitHistory.unshift({ merchantId: activeMerchant, email: merchant.Email, merchantName: merchant['Nombre Comercio'], contactName: `${merchant.Nombre} ${merchant.Apellido}`, ...visit }); localStorage.setItem(storageKey, JSON.stringify(visits)); if (window.google?.script?.run) google.script.run.recordVisit({ merchantId: activeMerchant, email: merchant.Email, merchantName: merchant['Nombre Comercio'], contactName: `${merchant.Nombre} ${merchant.Apellido}`, type: visit.type, notes: visit.notes, date: visit.date }); els.visitDialog.close(); render(); });
els.addMerchantButton.addEventListener('click', () => { els.merchantForm.reset(); els.merchantFormStatus.textContent = ''; els.merchantDialog.showModal(); });
els.geocodeButton.addEventListener('click', async () => { const address = els.newAddress.value.trim(); if (!address) { els.merchantFormStatus.textContent = 'Escribe una dirección para buscarla.'; return; } els.merchantFormStatus.textContent = 'Buscando coordenadas…'; try { const response = await fetch(`https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&q=${encodeURIComponent(address)}`); const results = await response.json(); if (!results.length) throw Error('No encontramos esa dirección.'); els.newLatitude.value = results[0].lat; els.newLongitude.value = results[0].lon; els.merchantFormStatus.textContent = 'Ubicación encontrada. Revisa las coordenadas antes de guardar.'; } catch (error) { els.merchantFormStatus.textContent = error.message || 'No se pudieron buscar coordenadas.'; } });
els.merchantForm.addEventListener('submit', e => { if (e.submitter?.value === 'cancel') return; e.preventDefault(); const lat = Number(els.newLatitude.value), lng = Number(els.newLongitude.value); if (!Number.isFinite(lat) || !Number.isFinite(lng)) { els.merchantFormStatus.textContent = 'Agrega coordenadas o usa “Buscar coordenadas”.'; return; } const merchant = { id: Math.max(-1, ...merchants.map(m => m.id)) + 1, 'Nombre Comercio': els.newMerchantName.value.trim(), Nombre: els.newFirstName.value.trim(), Apellido: els.newLastName.value.trim(), Email: els.newEmail.value.trim(), 'Tel 1': els.newPhone.value.trim(), Latitud: lat, Longitud: lng, 'Dirección': els.newAddress.value.trim() }; if (window.google?.script?.run) { els.merchantFormStatus.textContent = 'Guardando en la hoja…'; google.script.run.withSuccessHandler(data => { els.merchantDialog.close(); initialiseMerchants(data.merchants, data.visits, data.visitHistory || []); }).withFailureHandler(showLoadError).addMerchant(merchant); return; } customMerchants.push(merchant); localStorage.setItem('consultor-custom-merchants-v1', JSON.stringify(customMerchants)); merchants.push({ ...merchant, lat, lng }); els.merchantDialog.close(); map.flyTo([lat, lng], 15); render(); });
['input', 'change'].forEach(event => [els.searchInput, els.visitFilter, els.sortSelect].forEach(el => el.addEventListener(event, render)));
els.clearRouteButton.addEventListener('click', () => { routeIds.clear(); render(); });
els.openRouteButton.addEventListener('click', () => { const stops = selectedRoute(); const points = [`${userLocation.lat},${userLocation.lng}`, ...stops.map(m => `${m.lat},${m.lng}`)]; window.open(`https://www.google.com/maps/dir/${points.join('/')}`, '_blank', 'noopener'); });
els.locateButton.addEventListener('click', () => {
  if (!window.isSecureContext && location.hostname !== 'localhost') {
    els.locationStatus.textContent = 'En iPhone la ubicación requiere una URL segura (https://). Publica la app en HTTPS y vuelve a intentarlo.';
    return;
  }
  if (!navigator.geolocation) {
    els.locationStatus.textContent = 'Este navegador no permite usar ubicación.';
    return;
  }
  navigator.geolocation.getCurrentPosition(p => {
    userLocation = {
      lat: p.coords.latitude, lng: p.coords.longitude
    }
      ;
    merchants.forEach(m => m.km = distance(userLocation, m));
    if (currentMarker) map.removeLayer(currentMarker);
    currentMarker = L.marker(userLocation, {
      icon: L.divIcon({
        className: '', iconSize: [20, 20], iconAnchor: [10, 10], html: '<div class="pin current"></div>'
      }
      )
    }
    ).addTo(map).bindPopup('Tu ubicación actual');
    map.flyTo(userLocation, 12);
    els.locationStatus.textContent = 'Ubicación actual lista. La lista está ordenada por cercanía.';
    render();
  }
    , err => {
      els.locationStatus.textContent = err.code === 1 ? 'Safari no tiene permiso de ubicación. Ve a Ajustes > Safari > Ubicación y permite el acceso para esta app.' : 'No fue posible obtener tu ubicación. Inténtalo de nuevo al aire libre o revisa la señal.';
    }
    , {
      enableHighAccuracy: true, timeout: 15000, maximumAge: 30000
    }
  );
}
);
function initialiseMerchants(records, remoteVisits = {
}
  , remoteHistory = []) {
  visits = {
    ...visits, ...remoteVisits
  }
    ;
  const source = window.google?.script?.run ? records : [...records, ...customMerchants];
  merchants = source.map((m, i) => ({
    ...m, id: Number.isFinite(Number(m.id)) ? Number(m.id) : i, lat: Number(m.Latitud), lng: Number(m.Longitud)
  }
  )).filter(m => Number.isFinite(m.lat) && Number.isFinite(m.lng));
  if (!merchants.length) throw Error('No encontramos ubicaciones válidas en la base');
  visitHistory = remoteHistory.length ? remoteHistory : Object.entries(visits).map(([merchantId, visit]) => {
    const merchant = merchants.find(m => m.id === Number(merchantId));
    return {
      merchantId, ...visit, email: merchant?.Email, merchantName: merchant?.['Nombre Comercio'], contactName: merchant ? `${merchant.Nombre} ${merchant.Apellido}` : ''
    }
      ;
  }
  );
  map.fitBounds(merchants.map(m => [m.lat, m.lng]), {
    padding: [25, 25]
  }
  );
  render();
}
function showLoadError(err) {
  els.resultCount.textContent = 'Error';
  els.merchantList.innerHTML = `<p class="merchant-person">${err.message || err}. Revisa la conexión con la base.</p>`;
}
if (window.google?.script?.run) {
  google.script.run.withSuccessHandler(data => {
    try {
      initialiseMerchants(data.merchants, data.visits, data.visitHistory || []);
    }
    catch (err) {
      showLoadError(err);
    }
  }
  ).withFailureHandler(showLoadError).getAppData();
}
else {
  fetch(encodeURI(DATA_FILE)).then(r => {
    if (!r.ok) throw Error('No se pudo cargar el CSV');
    return r.text();
  }
  ).then(text => initialiseMerchants(parseCSV(text))).catch(showLoadError);
}
