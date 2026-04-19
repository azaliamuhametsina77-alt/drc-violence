
const DATA_FILES = {
  countries: 'https://cdn.jsdelivr.net/gh/nvkelso/natural-earth-vector@master/geojson/ne_10m_admin_0_countries.geojson',
  states: 'https://cdn.jsdelivr.net/gh/wmgeolab/geoBoundaries@9469f09592ced973a3448cf66b6100b741b64c0d/releaseData/gbOpen/COD/ADM1/geoBoundaries-COD-ADM1_simplified.geojson',
  events: './drc_events_2023_2025.geojson'
};

const COLORS = {
  1: '#6F8FA6',
  2: '#A05A5A',
  3: '#B08A57'
};

const COUNTRY_LABELS_RU = {
  'Democratic Republic of the Congo': 'ДР Конго',
  'Republic of the Congo': 'Республика Конго',
  'Central African Republic': 'ЦАР',
  'South Sudan': 'Южный Судан',
  'Uganda': 'Уганда',
  'Rwanda': 'Руанда',
  'Burundi': 'Бурунди',
  'Tanzania': 'Танзания',
  'Zambia': 'Замбия',
  'Angola': 'Ангола'
};

const STATE_LABELS_RU = {
  'Bas-Uele': 'Нижнее Уэле',
  'Équateur': 'Экватор',
  'Equateur': 'Экватор',
  'Haut-Katanga': 'Верхняя Катанга',
  'Haut-Lomami': 'Верхнее Ломами',
  'Haut-Uélé': 'Верхнее Уэле',
  'Haut-Uele': 'Верхнее Уэле',
  'Ituri': 'Итури',
  'Kasaï': 'Касаи',
  'Kasai': 'Касаи',
  'Kasaï-Central': 'Центральное Касаи',
  'Kasai-Central': 'Центральное Касаи',
  'Kasaï-Oriental': 'Восточное Касаи',
  'Kasaï Oriental': 'Восточное Касаи',
  'Kasai-Oriental': 'Восточное Касаи',
  'Kinshasa': 'Киншаса',
  'Kongo-Central': 'Конго-Центральная',
  'Kongo Central': 'Конго-Центральная',
  'Kwango': 'Кванго',
  'Kwilu': 'Квилу',
  'Lomami': 'Ломами',
  'Lualaba': 'Луалаба',
  'Mai-Ndombe': 'Маи-Ндомбе',
  'Maniema': 'Маниема',
  'Mongala': 'Монгала',
  'Nord-Kivu': 'Северное Киву',
  'Nord Kivu': 'Северное Киву',
  'Nord-Ubangi': 'Северное Убанги',
  'Sankuru': 'Санкуру',
  'Sud-Kivu': 'Южное Киву',
  'Sud Kivu': 'Южное Киву',
  'Sud-Ubangi': 'Южное Убанги',
  'Tanganyika': 'Танганьика',
  'Tshopo': 'Чопо',
  'Tshuapa': 'Чуапа'
};

const NEIGHBOR_NAMES = Object.keys(COUNTRY_LABELS_RU);

const state = {
  lockedId: null,
  hoverId: null,
  eventById: new Map()
};

const hoverCard = document.getElementById('hoverCard');
const hoverCardBody = document.getElementById('hoverCardBody');
const statusEl = document.getElementById('status');
const infoPanel = document.getElementById('infoPanel');
const infoToggle = document.getElementById('infoToggle');
const attributionPanel = document.getElementById('attributionPanel');
const attributionToggle = document.getElementById('attributionToggle');

let map;

function setStatus(message, hide = false) {
  statusEl.textContent = message;
  statusEl.classList.toggle('is-hidden', hide);
}

function formatNumber(value) {
  return new Intl.NumberFormat('ru-RU').format(Number(value || 0));
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function getAdminName(props = {}) {
  return props.ADMIN || props.admin || props.NAME_EN || props.NAME || props.name || props.name_en || '';
}

function circleRadiusExpression() {
  return [
    'interpolate',
    ['linear'],
    ['to-number', ['get', 'best']],
    0, 4,
    1, 4.5,
    2, 5.5,
    5, 6.5,
    10, 8,
    25, 10.5,
    50, 13,
    100, 16,
    300, 22
  ];
}

function highlightRadiusExpression() {
  return [
    'interpolate',
    ['linear'],
    ['to-number', ['get', 'best']],
    0, 9,
    1, 10,
    2, 11,
    5, 12,
    10, 14,
    25, 16,
    50, 19,
    100, 23,
    300, 29
  ];
}

function buildGeoBounds(geojson) {
  const bounds = new maplibregl.LngLatBounds();
  geojson.features.forEach((feature) => {
    const geom = feature.geometry;
    const parts = geom.type === 'Polygon' ? [geom.coordinates] : geom.coordinates;
    parts.forEach((poly) => {
      poly.forEach((ring) => {
        ring.forEach(([lng, lat]) => bounds.extend([lng, lat]));
      });
    });
  });
  return bounds;
}

function createMap() {
  map = new maplibregl.Map({
    container: 'map',
    style: {
      version: 8,
      glyphs: 'https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf',
      sources: {},
      layers: [
        { id: 'background', type: 'background', paint: { 'background-color': '#0a0a0b' } }
      ]
    },
    attributionControl: false,
    dragRotate: false,
    touchZoomRotate: true
  });
}

function prepareCountriesData(geojson) {
  return {
    type: 'FeatureCollection',
    features: (geojson.features || [])
      .filter((feature) => NEIGHBOR_NAMES.includes(getAdminName(feature.properties)))
      .map((feature) => {
        const countryEn = getAdminName(feature.properties);
        feature.properties = {
          ...feature.properties,
          country_en: countryEn,
          country_ru: COUNTRY_LABELS_RU[countryEn] || countryEn
        };
        return feature;
      })
  };
}

function prepareStatesData(geojson) {
  return {
    type: 'FeatureCollection',
    features: (geojson.features || []).map((feature) => {
      const shapeName = feature.properties?.shapeName || '';
      feature.properties = {
        ...feature.properties,
        shapeNameRu: STATE_LABELS_RU[shapeName] || shapeName
      };
      return feature;
    })
  };
}

function installSources(countriesGeoJSON, statesGeoJSON, eventsGeoJSON) {
  map.addSource('countries', {
    type: 'geojson',
    data: countriesGeoJSON
  });

  map.addSource('states', {
    type: 'geojson',
    data: statesGeoJSON
  });

  map.addSource('events', {
    type: 'geojson',
    data: eventsGeoJSON,
    promoteId: 'event_id'
  });

  map.addSource('active-event', {
    type: 'geojson',
    data: { type: 'FeatureCollection', features: [] }
  });
}

function installLayers() {
  map.addLayer({
    id: 'countries-fill',
    type: 'fill',
    source: 'countries',
    paint: {
      'fill-color': [
        'case',
        ['==', ['get', 'country_en'], 'Democratic Republic of the Congo'], '#0d1013',
        '#111317'
      ],
      'fill-opacity': 1
    }
  });

  map.addLayer({
    id: 'countries-outline',
    type: 'line',
    source: 'countries',
    paint: {
      'line-color': 'rgba(255,255,255,0.14)',
      'line-width': 1.1
    }
  });

  map.addLayer({
    id: 'states-outline',
    type: 'line',
    source: 'states',
    paint: {
      'line-color': 'rgba(176,186,198,0.22)',
      'line-width': [
        'interpolate',
        ['linear'],
        ['zoom'],
        3, 0.45,
        5, 0.75,
        7, 1.0
      ],
      'line-opacity': 0.5
    }
  });

  map.addLayer({
    id: 'states-label',
    type: 'symbol',
    source: 'states',
    minzoom: 4.4,
    layout: {
      'text-field': ['get', 'shapeNameRu'],
      'text-font': ['Open Sans Semibold'],
      'text-size': [
        'interpolate',
        ['linear'],
        ['zoom'],
        4.4, 9.5,
        5.8, 11,
        7.2, 12.5
      ],
      'text-max-width': 8,
      'text-allow-overlap': false,
      'text-ignore-placement': false
    },
    paint: {
      'text-color': 'rgba(205,212,220,0.42)',
      'text-halo-color': 'rgba(10,10,11,0.92)',
      'text-halo-width': 1.25
    }
  });

  map.addLayer({
    id: 'countries-label',
    type: 'symbol',
    source: 'countries',
    layout: {
      'text-field': ['get', 'country_ru'],
      'text-font': ['Open Sans Semibold'],
      'text-size': [
        'interpolate',
        ['linear'],
        ['zoom'],
        3, 10,
        5, 12,
        7, 14
      ],
      'text-allow-overlap': false,
      'text-ignore-placement': false
    },
    paint: {
      'text-color': 'rgba(168,176,187,0.58)',
      'text-halo-color': 'rgba(10,10,11,0.86)',
      'text-halo-width': 1.2
    }
  });

  map.addLayer({
    id: 'events-layer',
    type: 'circle',
    source: 'events',
    paint: {
      'circle-color': [
        'match',
        ['to-number', ['get', 'type_of_violence']],
        1, COLORS[1],
        2, COLORS[2],
        3, COLORS[3],
        '#d8dde5'
      ],
      'circle-radius': circleRadiusExpression(),
      'circle-opacity': [
        'case',
        ['boolean', ['feature-state', 'dimmed'], false], 0.28,
        ['==', ['get', 'dataset_status'], 'candidate'], 0.85,
        0.84
      ],
      'circle-stroke-color': [
        'case',
        ['==', ['get', 'dataset_status'], 'candidate'], 'rgba(236,236,236,0.72)',
        'rgba(10,10,11,0.95)'
      ],
      'circle-stroke-width': [
        'case',
        ['==', ['get', 'dataset_status'], 'candidate'], 1.4,
        0.9
      ]
    }
  });

  map.addLayer({
    id: 'active-event-layer',
    type: 'circle',
    source: 'active-event',
    paint: {
      'circle-color': [
        'match',
        ['to-number', ['get', 'type_of_violence']],
        1, COLORS[1],
        2, COLORS[2],
        3, COLORS[3],
        '#ffffff'
      ],
      'circle-opacity': 0.18,
      'circle-radius': highlightRadiusExpression(),
      'circle-stroke-color': '#ffffff',
      'circle-stroke-width': 2.5
    }
  });
}

function installPanelToggles() {
  infoToggle.addEventListener('click', () => {
    const collapsed = infoPanel.classList.toggle('is-collapsed');
    infoToggle.textContent = collapsed ? 'Показать' : 'Скрыть';
    infoToggle.setAttribute('aria-expanded', String(!collapsed));
  });

  attributionToggle.addEventListener('click', () => {
    const collapsed = attributionPanel.classList.toggle('is-collapsed');
    attributionToggle.textContent = collapsed ? 'Источники' : 'Скрыть';
    attributionToggle.setAttribute('aria-expanded', String(!collapsed));
  });
}

function eventFeatureAtPoint(point) {
  return map.queryRenderedFeatures(point, { layers: ['events-layer'] })[0] || null;
}

function setActiveFeature(feature) {
  const data = feature ? { type: 'FeatureCollection', features: [feature] } : { type: 'FeatureCollection', features: [] };
  map.getSource('active-event').setData(data);
}

function renderEmptyCard() {
  hoverCard.classList.add('is-empty');
  hoverCardBody.innerHTML = `
    <div class="eyebrow">Наведите или нажмите на точку</div>
    <div class="event-type muted">Данные о событии появятся здесь</div>
  `;
}

function deathRows(props) {
  const rows = [];
  if (Number(props.best) > 0) {
    rows.push(['Погибло всего', formatNumber(props.best)]);
  } else {
    rows.push(['Погибло всего', 'не указано']);
  }
  if (Number(props.deaths_a) > 0) rows.push(['С первой стороны', formatNumber(props.deaths_a)]);
  if (Number(props.deaths_b) > 0) rows.push(['Со второй стороны', formatNumber(props.deaths_b)]);
  if (Number(props.deaths_civilians) > 0) rows.push(['Гражданские', formatNumber(props.deaths_civilians)]);
  if (Number(props.deaths_unknown) > 0) rows.push(['Статус жертв не установлен', formatNumber(props.deaths_unknown)]);
  return rows.map(([label, value]) => `
    <div class="death-row">
      <span class="death-label">${escapeHtml(label)}</span>
      <span class="death-value">${escapeHtml(value)}</span>
    </div>
  `).join('');
}

function metaRow(label, value) {
  if (!value) return '';
  return `
    <div class="meta-row">
      <div class="meta-label">${escapeHtml(label)}</div>
      <div class="meta-value">${escapeHtml(value)}</div>
    </div>
  `;
}

function buildActors(props) {
  if (props.side_a_ru && props.side_b_ru) {
    return `${props.side_a_ru} → ${props.side_b_ru}`;
  }
  return props.side_a_ru || props.side_b_ru || '';
}

function renderFeatureCard(feature, locked = false) {
  if (!feature) {
    renderEmptyCard();
    return;
  }

  const props = feature.properties;
  hoverCard.classList.remove('is-empty');

  const badges = [];
  if (props.dataset_status === 'candidate') {
    badges.push('<span class="badge badge--candidate">Предварительное событие</span>');
  }
  if (Number(props.number_of_sources) > 0) {
    badges.push(`<span class="badge badge--sources">Источников: ${formatNumber(props.number_of_sources)}</span>`);
  }

  const note = props.dataset_status === 'candidate'
    ? `<div class="card-note">Событие за 2025 год показано по предварительной версии базы: исследователи уже зафиксировали его место и дату, но часть сведений еще может быть уточнена.</div>`
    : '';

  hoverCardBody.innerHTML = `
    <div class="eyebrow">${locked ? 'Событие выбрано' : 'Наведите или нажмите на точку'}</div>
    <div class="event-type">${escapeHtml(props.type_label_ru)}</div>
    ${badges.length ? `<div class="card-badges">${badges.join('')}</div>` : ''}
    <div class="meta-list">
      ${metaRow('Провинция', props.adm_1_ru || props.adm_1 || '')}
      ${metaRow('Год', props.date_label_ru)}
      ${metaRow('Участники', buildActors(props))}
    </div>
    <div class="deaths-block">
      <div class="deaths-title">Потери</div>
      ${deathRows(props)}
    </div>
    ${note}
  `;
}

function updateActiveFromId(id) {
  const feature = id ? state.eventById.get(id) : null;
  setActiveFeature(feature || null);
  renderFeatureCard(feature || null, Boolean(state.lockedId));
}

function setHover(id) {
  if (state.hoverId === id) return;
  state.hoverId = id;
  updateActiveFromId(state.lockedId || state.hoverId);
}

function clearHover() {
  if (state.hoverId === null) return;
  state.hoverId = null;
  updateActiveFromId(state.lockedId || null);
}

function setLocked(id) {
  state.lockedId = id;
  updateActiveFromId(id);
}

function clearLocked() {
  if (state.lockedId === null) return;
  state.lockedId = null;
  updateActiveFromId(state.hoverId || null);
}

function installInteractions() {
  map.on('mousemove', 'events-layer', (e) => {
    map.getCanvas().style.cursor = 'pointer';
    if (state.lockedId) return;
    const feature = e.features && e.features[0];
    if (feature) setHover(feature.properties.event_id);
  });

  map.on('mouseleave', 'events-layer', () => {
    map.getCanvas().style.cursor = '';
    if (state.lockedId) return;
    clearHover();
  });

  map.on('click', (e) => {
    const feature = eventFeatureAtPoint(e.point);
    if (feature) {
      setLocked(feature.properties.event_id);
      map.getCanvas().style.cursor = 'pointer';
    } else {
      clearLocked();
      clearHover();
      map.getCanvas().style.cursor = '';
    }
  });
}

function toActorTitleCase(value) {
  if (!value) return value;

  const fixedMap = {
    'm23': 'M23',
    'adf': 'ADF',
    'nalu': 'NALU',
    'fdlr': 'FDLR',
    'cndp': 'CNDP',
    'fardc': 'FARDC',
    'codeco': 'CODECO',
    'udps': 'UDPS',
    'un': 'ООН',
    'monusco': 'МООНСДРК'
  };

  return String(value)
    .trim()
    .split(/(\s+|[-–—/()])/)
    .map(part => {
      const lower = part.toLowerCase();
      if (fixedMap[lower]) return fixedMap[lower];
      if (/^(\s+|[-–—/()])$/.test(part)) return part;
      if (!lower) return part;
      return lower.charAt(0).toUpperCase() + lower.slice(1);
    })
    .join('');
}

function normalizeActorLabel(value) {
  if (!value) return value;
  const v = String(value).trim();

  if (v === 'Civilians') return 'Гражданские';
  if (v === 'Government of DR Congo (Zaire)' || v === 'Government of the Democratic Republic of Congo') {
    return 'Власти ДР Конго';
  }
  if (v === 'DR Congo (Zaire) Military Forces' || v === 'FARDC') {
    return 'FARDC';
  }
  if (v === 'Military Forces of Rwanda (1994-)') {
    return 'Военные силы Руанды';
  }

  return toActorTitleCase(v);
}

async function fetchJSON(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Не удалось загрузить ${url}: ${response.status}`);
  }
  return response.json();
}

async function init() {
  setStatus('Загрузка данных…');

  const [countriesRaw, statesRaw, eventsGeoJSON] = await Promise.all([
    fetchJSON(DATA_FILES.countries),
    fetchJSON(DATA_FILES.states),
    fetchJSON(DATA_FILES.events)
  ]);

  const countriesGeoJSON = prepareCountriesData(countriesRaw);
  const statesGeoJSON = prepareStatesData(statesRaw);

  eventsGeoJSON.features.forEach(feature => {
    const props = feature.properties || {};

    props.side_a_ru = normalizeActorLabel(props.side_a_ru || props.side_a);
    props.side_b_ru = normalizeActorLabel(props.side_b_ru || props.side_b);
    props.side_a = normalizeActorLabel(props.side_a);
    props.side_b = normalizeActorLabel(props.side_b);

    state.eventById.set(props.event_id, feature);
  });

  createMap();
  installPanelToggles();

  map.on('load', () => {
    installSources(countriesGeoJSON, statesGeoJSON, eventsGeoJSON);
    installLayers();
    installInteractions();

    const bounds = buildGeoBounds(countriesGeoJSON);
    map.fitBounds(bounds, {
      padding: { top: 70, right: 70, bottom: 70, left: 70 },
      duration: 0,
      maxZoom: 5.7
    });

    renderEmptyCard();
    setStatus('Готово', true);
  });
}

init().catch((error) => {
  console.error(error);
  setStatus('Не удалось загрузить карту');
});
