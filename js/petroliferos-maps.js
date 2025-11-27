/**
 * Configuración de mapas para PETROLÍFEROS
 */

// ==========================================
// PETROLÍFEROS - VARIABLES GLOBALES
// ==========================================

// Variables para almacenar datos y estado
let petroliferosPermitsData = [];
let petroliferosStats = null;
let currentPetroliferosFilter = null;
let currentPetroliferosFilteredData = [];

// Variables para gráficos
let petroliferosBrandChart = null;
let petroliferosStatesChart = null;

const PETROLIFEROS_MAPS = [
    {
        name: 'Permisos de Petrolíferos',
        geojsonUrl: 'https://cdn.sassoapps.com/Mapas/Electricidad/estados.geojson',
        geojsonUrlType: 'states',
        googleSheetUrl: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vSAPC9kG5ZmMtP3Zsn6RZani7ABURGlHQOEnuZ8u8S8XeFYJrYaSqHbO66yavlc5J4WrQ0iw23Qgv-q/pub?gid=0&single=true&output=csv',
        googleSheetEditUrl: 'https://docs.google.com/spreadsheets/d/xxxxx/edit?usp=sharing',
        useClusters: true,
        enableSearch: true,
        mapType: 'petroliferos',
        descriptionTitle: 'Permisos de Petrolíferos',
        description: 'Mapa de permisos de expendio y comercialización de petrolíferos en México.'
    }
];

// ==========================================
// PETROLÍFEROS - FUNCIONES PRINCIPALES
// ==========================================

function calculatePetroliferosStats(data) {
    const stats = {
        byState: {}, // By Estado (EfId)
        byType: {}, // By TipoPermiso
        byBrand: {}, // By Marca
        totals: {
            capacity: 0,
            investment: 0,
            count: 0
        }
    };

    data.forEach(row => {
        const stateId = (row.EfId || 'Sin Estado').trim();
        const stateName = getStateName(stateId);
        const type = (row.TipoPermiso || 'Sin Tipo').trim();
        const brand = (row.Marca || 'Sin Marca').trim();
        const capacity = parseFloat(row.CapacidadAutorizadaBarriles) || 0;
        const investment = parseFloat(row.InversionEstimada) || 0;

        // By State
        if (!stats.byState[stateName]) {
            stats.byState[stateName] = { capacity: 0, investment: 0, count: 0, stateId: stateId };
        }
        stats.byState[stateName].capacity += capacity;
        stats.byState[stateName].investment += investment;
        stats.byState[stateName].count++;

        // By Type
        if (!stats.byType[type]) {
            stats.byType[type] = { capacity: 0, investment: 0, count: 0 };
        }
        stats.byType[type].capacity += capacity;
        stats.byType[type].investment += investment;
        stats.byType[type].count++;

        // By Brand
        if (!stats.byBrand[brand]) {
            stats.byBrand[brand] = { capacity: 0, investment: 0, count: 0 };
        }
        stats.byBrand[brand].capacity += capacity;
        stats.byBrand[brand].investment += investment;
        stats.byBrand[brand].count++;

        // Totals
        stats.totals.capacity += capacity;
        stats.totals.investment += investment;
        stats.totals.count++;
    });

    return stats;
}

function drawPetroliferosPermits(rows) {
    console.log('drawPetroliferosPermits called with', rows.length, 'rows');

    // Clear existing markers
    markersLayer.clearLayers();
    if (markersClusterGroup) {
        map.removeLayer(markersClusterGroup);
        markersClusterGroup = null;
    }

    // Store data
    petroliferosPermitsData = rows;
    console.log('Stored petroliferosPermitsData:', petroliferosPermitsData.length);

    // Calculate statistics
    petroliferosStats = calculatePetroliferosStats(rows);
    console.log('Calculated stats:', petroliferosStats);

    updatePetroliferosTotals(petroliferosStats);
    createPetroliferosFilterCards(petroliferosStats, 'state');
    createPetroliferosFilterCards(petroliferosStats, 'type');
    createPetroliferosFilterCards(petroliferosStats, 'brand');

    // Create charts
    createPetroliferosCharts(petroliferosStats);

    // Show States layer by default
    showStatesLayer(null);

    // Show filters panel
    const filtersPanel = document.getElementById('petroliferos-filters-panel');
    if (filtersPanel) {
        filtersPanel.style.display = 'block';
        console.log('Petroliferos filters panel shown');
    } else {
        console.error('Petroliferos filters panel not found!');
    }

    // Draw markers
    drawPetroliferosMarkersOnly(rows);
    console.log('Markers drawn');
}

function drawPetroliferosMarkersOnly(rows) {
    console.log('drawPetroliferosMarkersOnly called with', rows.length, 'rows');

    if (!markersClusterGroup) {
        console.log('Creating new cluster group');
        markersClusterGroup = L.markerClusterGroup({
            maxClusterRadius: 50,
            spiderfyOnMaxZoom: true,
            showCoverageOnHover: false,
            zoomToBoundsOnClick: true,
            iconCreateFunction: function (cluster) {
                const count = cluster.getChildCount();
                let className = 'marker-cluster-small';
                if (count >= 100) {
                    className = 'marker-cluster-large';
                } else if (count >= 10) {
                    className = 'marker-cluster-medium';
                }
                return L.divIcon({
                    html: '<div><span>' + count + '</span></div>',
                    className: 'marker-cluster ' + className,
                    iconSize: L.point(40, 40)
                });
            }
        });
    } else {
        markersClusterGroup.clearLayers();
    }

    let markersAdded = 0;

    rows.forEach(row => {
        // Extract lat/lng handling various column names
        const latRaw = row.lat || row.Lat || row.latitude || row.Latitud || '';
        const lngRaw = row.lon || row.lng || row.longitude || row.Longitud || row.Lon || '';

        const lat = parseFloat(latRaw.toString().replace(',', '.'));
        const lng = parseFloat(lngRaw.toString().replace(',', '.'));

        if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
            return;
        }

        markersAdded++;

        const popup = [
            '<div class="permit-popup">',
            '<div class="permit-header">',
            '<strong>' + (row.NumeroPermiso || 'S/N') + '</strong>',
            '</div>',
            '<div class="permit-details">',
            '<div><strong>Razón Social:</strong> ' + (row.RazonSocial || 'N/A') + '</div>',
            '<div><strong>Estado:</strong> ' + getStateName(row.EfId) + '</div>',
            '<div><strong>Municipio:</strong> ' + (row.MpoId || 'N/A') + '</div>',
            '<div><strong>Estatus:</strong> ' + (row.Estatus || 'N/A') + '</div>',
            '<div><strong>Tipo:</strong> ' + (row.TipoPermiso || 'N/A') + '</div>',
            '<div><strong>Marca:</strong> ' + (row.Marca || 'N/A') + '</div>',
            '<div><strong>Capacidad:</strong> ' + (row.CapacidadAutorizadaBarriles || '0') + ' Barriles</div>',
            '<div><strong>Inversión:</strong> $' + (parseFloat(row.InversionEstimada) || 0).toLocaleString('es-MX', { maximumFractionDigits: 2 }) + '</div>',
            row.FechaOtorgamiento ? '<div><strong>Fecha:</strong> ' + row.FechaOtorgamiento + '</div>' : '',
            '</div>',
            '</div>'
        ].join('');

        const gasIcon = L.divIcon({
            className: 'electricity-marker-icon',
            html: '<img src="https://cdn.sassoapps.com/iconos_snien/gasolinera.png" style="width: 32px; height: 32px;">',
            iconSize: [32, 32],
            iconAnchor: [16, 16],
            popupAnchor: [0, -16]
        });

        const marker = L.marker([lat, lng], {
            icon: gasIcon,
            zIndexOffset: 1000
        });

        marker.bindPopup(popup);
        marker.permitData = row;
        markersClusterGroup.addLayer(marker);
    });

    console.log('Markers added to cluster:', markersAdded);

    map.addLayer(markersClusterGroup);
    console.log('Cluster group added to map');

    if (markersClusterGroup._featureGroup && map.getPane('markerPane')) {
        const markerPane = map.getPane('markerPane');
        markerPane.style.zIndex = 650;
    }
}

function updatePetroliferosTotals(stats) {
    const capacityEl = document.getElementById('total-petroliferos-capacity');
    const investmentEl = document.getElementById('total-petroliferos-investment');
    const permitsEl = document.getElementById('total-petroliferos-permits');

    if (capacityEl) {
        capacityEl.textContent = stats.totals.capacity.toLocaleString('es-MX', { maximumFractionDigits: 0 }) + ' Barriles';
    }
    if (investmentEl) {
        investmentEl.textContent = '$' + stats.totals.investment.toLocaleString('es-MX', { maximumFractionDigits: 2 });
    }
    if (permitsEl) {
        permitsEl.textContent = stats.totals.count.toLocaleString('es-MX');
    }
}

function createPetroliferosFilterCards(stats, type) {
    let container, data;

    if (type === 'state') {
        container = document.getElementById('petroliferos-state-cards');
        data = stats.byState;
    } else if (type === 'type') {
        container = document.getElementById('petroliferos-type-cards');
        data = stats.byType;
    } else {
        container = document.getElementById('petroliferos-brand-cards');
        data = stats.byBrand;
    }

    if (!container) return;

    container.innerHTML = '';

    const sortedKeys = Object.keys(data).sort((a, b) => data[b].investment - data[a].investment);

    sortedKeys.forEach(key => {
        const item = data[key];
        const card = document.createElement('div');
        card.className = 'filter-card';
        card.dataset.filterType = type;
        card.dataset.filterValue = key;

        card.innerHTML = `
            <div class="filter-card-header">
                <div class="filter-card-title">${key}</div>
                <div class="filter-card-count">${item.count}</div>
            </div>
            <div class="filter-card-stats">
                <div class="filter-stat">
                    <span class="filter-stat-label">🛢️ Capacidad:</span>
                    <span class="filter-stat-value">${item.capacity.toLocaleString('es-MX', { maximumFractionDigits: 0 })} Barriles</span>
                </div>
                <div class="filter-stat">
                    <span class="filter-stat-label">💰 Inversión:</span>
                    <span class="filter-stat-value">$${item.investment.toLocaleString('es-MX', { maximumFractionDigits: 2 })}</span>
                </div>
            </div>
        `;

        card.addEventListener('click', function () {
            filterPetroliferosPermits(type, key);

            // Update active state
            container.querySelectorAll('.filter-card').forEach(c => c.classList.remove('active'));
            this.classList.add('active');
        });

        container.appendChild(card);
    });
}

function filterPetroliferosPermits(type, value) {
    if (!markersClusterGroup || !petroliferosPermitsData.length) return;

    currentPetroliferosFilter = { type, value };

    // Clear search box
    clearSearchBox();

    // Clear existing cluster
    map.removeLayer(markersClusterGroup);
    markersClusterGroup.clearLayers();

    // Show/hide geometry layers based on filter type
    if (type === 'state') {
        showStatesLayer(value);
    } else {
        // For other filters, show states without highlighting
        showStatesLayer(null);
    }

    // Filter data
    let filteredData;
    if (type === 'state') {
        const stateId = petroliferosStats.byState[value] ? petroliferosStats.byState[value].stateId : null;

        console.log('Filtering by state:', value, 'State ID:', stateId);

        if (stateId) {
            const normalizedFilterId = stateId.toString().trim().padStart(2, '0');

            filteredData = petroliferosPermitsData.filter(row => {
                const rowId = (row.EfId || '').toString().trim().padStart(2, '0');
                return rowId === normalizedFilterId;
            });
        } else {
            filteredData = petroliferosPermitsData.filter(row => {
                const rowStateName = getStateName(row.EfId);
                return rowStateName === value;
            });
        }
    } else if (type === 'type') {
        filteredData = petroliferosPermitsData.filter(row =>
            (row.TipoPermiso || 'Sin Tipo').trim() === value
        );
    } else if (type === 'brand') {
        filteredData = petroliferosPermitsData.filter(row =>
            (row.Marca || 'Sin Marca').trim() === value
        );
    }

    // Store filtered data for search
    currentPetroliferosFilteredData = filteredData;
    console.log('Petroliferos filter applied:', type, value, '- Showing', filteredData.length, 'permits');

    // Recalculate stats for filtered data
    const filteredStats = calculatePetroliferosStats(filteredData);
    updatePetroliferosTotals(filteredStats);

    // Update charts with filtered data
    updatePetroliferosCharts(filteredStats);

    // Redraw markers with filtered data
    drawPetroliferosMarkersOnly(filteredData);
}

function resetPetroliferosFilters() {
    currentPetroliferosFilter = null;
    currentPetroliferosFilteredData = [];

    console.log('Petroliferos filters reset - searching in all', petroliferosPermitsData.length, 'permits');

    // Clear search box
    clearSearchBox();

    // Remove active class from all cards
    document.querySelectorAll('.filter-card').forEach(c => c.classList.remove('active'));

    // Show layer based on active tab
    const activeTab = document.querySelector('.filter-tab-petroliferos.active');
    if (activeTab) {
        const tabType = activeTab.dataset.tab;

        if (tabType === 'state') {
            showStatesLayer(null);
        } else {
            showStatesLayer(null);
        }
    } else {
        showStatesLayer(null);
    }

    // Recalculate stats for all data
    updatePetroliferosTotals(petroliferosStats);

    // Update charts with all data
    updatePetroliferosCharts(petroliferosStats);

    // Redraw all markers
    if (petroliferosPermitsData.length) {
        drawPetroliferosMarkersOnly(petroliferosPermitsData);
    }
}

// ==========================================
// PETROLÍFEROS - FUNCIONES DE GRÁFICOS
// ==========================================

function createPetroliferosCharts(stats) {
    createPetroliferosBrandChart(stats);
    createPetroliferosStatesChart(stats);
}

function createPetroliferosBrandChart(stats) {
    const ctx = document.getElementById('petroliferos-brand-chart');
    if (!ctx) return;

    // Destroy existing chart
    if (petroliferosBrandChart) {
        petroliferosBrandChart.destroy();
    }

    // Prepare data
    const brands = Object.keys(stats.byBrand).sort((a, b) =>
        stats.byBrand[b].count - stats.byBrand[a].count
    );

    const data = brands.map(brand => stats.byBrand[brand].count);
    const colors = [
        '#601623', '#1f7a62', '#8B1E3F', '#24a47a', '#C41E3A',
        '#0D5C4A', '#7a2432', '#165845', '#4a0e16', '#2d9575'
    ];

    petroliferosBrandChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: brands,
            datasets: [{
                label: 'Número de Permisos',
                data: data,
                backgroundColor: colors,
                borderColor: '#ffffff',
                borderWidth: 2
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: {
                    display: true,
                    position: 'right'
                },
                title: {
                    display: true,
                    text: 'Permisos por Marca',
                    font: {
                        family: "'Montserrat', sans-serif",
                        size: 14,
                        weight: 'bold'
                    },
                    color: '#601623'
                },
                tooltip: {
                    callbacks: {
                        label: function (context) {
                            const label = context.label || '';
                            const value = context.parsed || 0;
                            const total = context.dataset.data.reduce((a, b) => a + b, 0);
                            const percentage = ((value / total) * 100).toFixed(1);
                            return `${label}: ${value.toLocaleString('es-MX')} permisos (${percentage}%)`;
                        }
                    }
                }
            }
        }
    });
}

function createPetroliferosStatesChart(stats) {
    const ctx = document.getElementById('petroliferos-states-chart');
    if (!ctx) return;

    // Destroy existing chart
    if (petroliferosStatesChart) {
        petroliferosStatesChart.destroy();
    }

    // Get top 10 states by permit count
    const states = Object.keys(stats.byState).sort((a, b) =>
        stats.byState[b].count - stats.byState[a].count
    ).slice(0, 10);

    const data = states.map(state => stats.byState[state].count);

    petroliferosStatesChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: states,
            datasets: [{
                label: 'Número de Permisos',
                data: data,
                backgroundColor: '#601623',
                borderColor: '#4a0e16',
                borderWidth: 1
            }]
        },
        options: {
            indexAxis: 'y',
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: {
                    display: false
                },
                title: {
                    display: true,
                    text: 'Top 10 Estados por Permisos',
                    font: {
                        family: "'Montserrat', sans-serif",
                        size: 14,
                        weight: 'bold'
                    },
                    color: '#601623'
                },
                tooltip: {
                    callbacks: {
                        label: function (context) {
                            const value = context.parsed.x || 0;
                            return `${value.toLocaleString('es-MX')} permisos`;
                        }
                    }
                }
            },
            scales: {
                x: {
                    beginAtZero: true,
                    ticks: {
                        callback: function (value) {
                            return value.toLocaleString('es-MX');
                        }
                    }
                }
            }
        }
    });
}

function updatePetroliferosCharts(stats) {
    updatePetroliferosBrandChart(stats);
    updatePetroliferosStatesChart(stats);
}

function updatePetroliferosBrandChart(stats) {
    if (!petroliferosBrandChart) {
        createPetroliferosBrandChart(stats);
        return;
    }

    const brands = Object.keys(stats.byBrand).sort((a, b) =>
        stats.byBrand[b].count - stats.byBrand[a].count
    );
    const data = brands.map(brand => stats.byBrand[brand].count);

    petroliferosBrandChart.data.labels = brands;
    petroliferosBrandChart.data.datasets[0].data = data;
    petroliferosBrandChart.update();
}

function updatePetroliferosStatesChart(stats) {
    if (!petroliferosStatesChart) {
        createPetroliferosStatesChart(stats);
        return;
    }

    const states = Object.keys(stats.byState).sort((a, b) =>
        stats.byState[b].count - stats.byState[a].count
    ).slice(0, 10);
    const data = states.map(state => stats.byState[state].count);

    petroliferosStatesChart.data.labels = states;
    petroliferosStatesChart.data.datasets[0].data = data;
    petroliferosStatesChart.update();
}

// ==========================================
// PETROLÍFEROS - EVENT LISTENERS
// ==========================================

// Inicializar event listeners cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', function () {
    // Event listeners para tabs de Petrolíferos
    const petroliferosTabs = document.querySelectorAll('.filter-tab-petroliferos');
    petroliferosTabs.forEach(tab => {
        tab.addEventListener('click', function () {
            const targetTab = this.dataset.tab;

            console.log('Petroliferos tab clicked:', targetTab);

            // Reset filters when changing tabs
            if (currentPetroliferosFilter) {
                console.log('Resetting Petroliferos filters on tab change');
                currentPetroliferosFilter = null;
                currentPetroliferosFilteredData = [];

                // Restore all markers
                if (petroliferosPermitsData.length) {
                    drawPetroliferosMarkersOnly(petroliferosPermitsData);
                }

                // Update totals to show all data
                updatePetroliferosTotals(petroliferosStats);

                // Update charts to show all data
                updatePetroliferosCharts(petroliferosStats);
            }

            // Remove active class from all cards
            document.querySelectorAll('.filter-card').forEach(card => {
                card.classList.remove('active');
            });

            // Update tabs
            petroliferosTabs.forEach(t => t.classList.remove('active'));
            this.classList.add('active');

            // Update content
            document.querySelectorAll('.filter-tab-content').forEach(content => {
                content.classList.remove('active');
            });
            document.getElementById('petroliferos-' + targetTab + '-filters').classList.add('active');

            // Show/hide layers based on tab
            if (targetTab === 'state') {
                console.log('Showing States layer');
                showStatesLayer(null);
            } else {
                console.log('Showing States layer without highlighting');
                showStatesLayer(null);
            }
        });
    });

    // Reset button for Petroliferos
    const resetPetroliferosBtn = document.getElementById('reset-petroliferos-filters-btn');
    if (resetPetroliferosBtn) {
        resetPetroliferosBtn.addEventListener('click', function () {
            resetPetroliferosFilters();
        });
    }
});

// Exportar para uso en map-config.js
if (typeof module !== 'undefined' && module.exports) {
    module.exports = PETROLIFEROS_MAPS;
}
