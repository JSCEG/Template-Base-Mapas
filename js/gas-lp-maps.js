/**
 * Configuración de mapas para GAS L.P.
 */

// ==========================================
// GAS LP - VARIABLES GLOBALES
// ==========================================

// Variables para almacenar datos y estado
let gasLPPermitsData = [];
let gasLPStats = null;
let currentGasLPFilter = null;
let currentGasLPFilteredData = [];

// Variables para gráficos
let gasLPTypeChart = null;
let gasLPStatesChart = null;


const GAS_LP_MAPS = [
    {
        name: 'Permisos de Gas L.P.',
        geojsonUrl: 'https://cdn.sassoapps.com/Mapas/Electricidad/estados.geojson',
        geojsonUrlType: 'states',
        googleSheetUrl: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vR2Si_bVgJ98BZyqEHaXaVoGKrxPmlz8YpHdqTPCat8KcqiWVADA0WbvJLhCvj2OKIKkoB3VF_JXk_J/pub?gid=0&single=true&output=csv',
        googleSheetEditUrl: 'https://docs.google.com/spreadsheets/d/1Ih_4kaFwjOC-Y1kQ8X7ZjYvxYTHIcQDvrxxu4S7fqm4/edit?usp=sharing',
        useClusters: true,
        enableSearch: true,
        mapType: 'gaslp',
        descriptionTitle: 'Permisos de Gas L.P.',
        description: 'Mapa de permisos de distribución y comercialización de Gas L.P. en México. Los marcadores están agrupados para facilitar la visualización. Haga clic en un grupo para ampliar o en un marcador individual para ver los detalles del permiso.'
    }
];

// ==========================================
// GAS LP - FUNCIONES PRINCIPALES
// ==========================================

function calculateGasLPStats(data) {
    const stats = {
        byState: {}, // By Estado (EfId)
        byType: {}, // By TipoPermiso
        totals: {
            capacity: 0,
            capacityLiters: 0,
            count: 0
        }
    };

    data.forEach(row => {
        const stateId = (row.EfId || 'Sin Estado').trim();
        const stateName = getStateName(stateId);
        const type = (row.TipoPermiso || 'Sin Tipo').trim();
        const capacityInstall = parseFloat(row.CapacidadInstalacion) || 0;
        const capacityLiters = parseFloat(row.CapacidadLitros) || 0;

        // By State
        if (!stats.byState[stateName]) {
            stats.byState[stateName] = { capacity: 0, capacityLiters: 0, count: 0, stateId: stateId };
        }
        stats.byState[stateName].capacity += capacityInstall;
        stats.byState[stateName].capacityLiters += capacityLiters;
        stats.byState[stateName].count++;

        // By Type
        if (!stats.byType[type]) {
            stats.byType[type] = { capacity: 0, capacityLiters: 0, count: 0 };
        }
        stats.byType[type].capacity += capacityInstall;
        stats.byType[type].capacityLiters += capacityLiters;
        stats.byType[type].count++;

        // Totals
        stats.totals.capacity += capacityInstall;
        stats.totals.capacityLiters += capacityLiters;
        stats.totals.count++;
    });

    return stats;
}

function drawGasLPPermits(rows) {
    console.log('drawGasLPPermits called with', rows.length, 'rows');

    // Clear existing markers
    markersLayer.clearLayers();
    if (markersClusterGroup) {
        map.removeLayer(markersClusterGroup);
        markersClusterGroup = null;
    }

    // Store data
    gasLPPermitsData = rows;
    console.log('Stored gasLPPermitsData:', gasLPPermitsData.length);

    // Calculate statistics
    gasLPStats = calculateGasLPStats(rows);
    console.log('Calculated stats:', gasLPStats);

    updateGasLPTotals(gasLPStats);
    createGasLPFilterCards(gasLPStats, 'state');
    createGasLPFilterCards(gasLPStats, 'type');

    // Create charts
    createGasLPCharts(gasLPStats);

    // Show States layer by default
    showStatesLayer(null);

    // Show filters panel
    const filtersPanel = document.getElementById('gaslp-filters-panel');
    if (filtersPanel) {
        filtersPanel.style.display = 'block';
        console.log('Gas LP filters panel shown');
    } else {
        console.error('Gas LP filters panel not found!');
    }

    // Draw markers
    drawGasLPMarkersOnly(rows);
    console.log('Markers drawn');
}

function drawGasLPMarkersOnly(rows) {
    console.log('drawGasLPMarkersOnly called with', rows.length, 'rows');

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
        console.log('Clearing existing cluster group');
        markersClusterGroup.clearLayers();
    }

    let markersAdded = 0;

    rows.forEach(row => {
        const latRaw = row.lat || row.Lat || '';
        const lngRaw = row.lon || row.lng || row.Lon || row.Lng || '';
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
            row.CapacidadInstalacion ? '<div><strong>Capacidad Instalación:</strong> ' + parseFloat(row.CapacidadInstalacion).toLocaleString('es-MX') + ' Litros</div>' : '',
            row.CapacidadLitros ? '<div><strong>Capacidad Total:</strong> ' + parseFloat(row.CapacidadLitros).toLocaleString('es-MX') + ' Litros</div>' : '',
            row.NumeroTanques ? '<div><strong>Tanques:</strong> ' + row.NumeroTanques + '</div>' : '',
            row.FechaDeOtorgamiento ? '<div><strong>Fecha:</strong> ' + row.FechaDeOtorgamiento + '</div>' : '',
            '</div>',
            '</div>'
        ].join('');

        const gasLPIcon = L.divIcon({
            className: 'electricity-marker-icon',
            html: '<img src="https://cdn.sassoapps.com/iconos_snien/gaslp.png" style="width: 32px; height: 32px;">',
            iconSize: [32, 32],
            iconAnchor: [16, 16],
            popupAnchor: [0, -16]
        });

        const marker = L.marker([lat, lng], {
            icon: gasLPIcon,
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

function updateGasLPTotals(stats) {
    const capacityEl = document.getElementById('total-gaslp-capacity');
    const investmentEl = document.getElementById('total-gaslp-investment');
    const permitsEl = document.getElementById('total-gaslp-permits');

    if (capacityEl) {
        const totalCapacity = stats.totals.capacity + stats.totals.capacityLiters;
        capacityEl.textContent = totalCapacity.toLocaleString('es-MX', { maximumFractionDigits: 0 }) + ' Litros';
    }
    if (investmentEl) {
        // Show capacity in liters instead since there's no investment data
        investmentEl.textContent = stats.totals.capacityLiters.toLocaleString('es-MX', { maximumFractionDigits: 0 }) + ' L (Tanques)';
    }
    if (permitsEl) {
        permitsEl.textContent = stats.totals.count.toLocaleString('es-MX');
    }
}

function createGasLPFilterCards(stats, type) {
    let container, data;

    if (type === 'state') {
        container = document.getElementById('gaslp-state-cards');
        data = stats.byState;
    } else {
        container = document.getElementById('gaslp-type-cards');
        data = stats.byType;
    }

    if (!container) return;

    container.innerHTML = '';

    const sortedKeys = Object.keys(data).sort((a, b) => data[b].capacity - data[a].capacity);

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
                    <span class="filter-stat-label">💧 Capacidad:</span>
                    <span class="filter-stat-value">${(item.capacity + item.capacityLiters).toLocaleString('es-MX', { maximumFractionDigits: 0 })} Litros</span>
                </div>
                <div class="filter-stat">
                    <span class="filter-stat-label">🛢️ Tanques:</span>
                    <span class="filter-stat-value">${item.capacityLiters.toLocaleString('es-MX', { maximumFractionDigits: 0 })} L</span>
                </div>
            </div>
        `;

        card.addEventListener('click', function () {
            filterGasLPPermits(type, key);

            // Update active state
            container.querySelectorAll('.filter-card').forEach(c => c.classList.remove('active'));
            this.classList.add('active');
        });

        container.appendChild(card);
    });
}

function filterGasLPPermits(type, value) {
    if (!markersClusterGroup || !gasLPPermitsData.length) return;

    currentGasLPFilter = { type, value };

    // Clear search box
    clearSearchBox();

    // Clear existing cluster
    map.removeLayer(markersClusterGroup);
    markersClusterGroup.clearLayers();

    // Show/hide geometry layers based on filter type
    if (type === 'state') {
        showStatesLayer(value);
    } else {
        showStatesLayer(null);
    }

    // Filter data
    let filteredData;
    if (type === 'state') {
        const stateId = gasLPStats.byState[value] ? gasLPStats.byState[value].stateId : null;

        console.log('Filtering by state:', value, 'State ID:', stateId);

        if (stateId) {
            const normalizedFilterId = stateId.toString().trim().padStart(2, '0');

            filteredData = gasLPPermitsData.filter(row => {
                const rowId = (row.EfId || '').toString().trim().padStart(2, '0');
                return rowId === normalizedFilterId;
            });
        } else {
            filteredData = gasLPPermitsData.filter(row => {
                const rowStateName = getStateName(row.EfId);
                return rowStateName === value;
            });
        }
    } else if (type === 'type') {
        filteredData = gasLPPermitsData.filter(row =>
            (row.TipoPermiso || 'Sin Tipo').trim() === value
        );
    }

    // Store filtered data for search
    currentGasLPFilteredData = filteredData;
    console.log('Gas LP filter applied:', type, value, '- Showing', filteredData.length, 'permits');

    // Recalculate stats for filtered data
    const filteredStats = calculateGasLPStats(filteredData);
    updateGasLPTotals(filteredStats);

    // Update charts with filtered data
    updateGasLPCharts(filteredStats);

    // Redraw markers with filtered data
    drawGasLPMarkersOnly(filteredData);
}

function resetGasLPFilters() {
    currentGasLPFilter = null;
    currentGasLPFilteredData = [];

    console.log('Gas LP filters reset - searching in all', gasLPPermitsData.length, 'permits');

    // Clear search box
    clearSearchBox();

    // Remove active class from all cards
    document.querySelectorAll('.filter-card').forEach(c => c.classList.remove('active'));

    // Show layer based on active tab
    const activeTab = document.querySelector('.filter-tab-gaslp.active');
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
    updateGasLPTotals(gasLPStats);

    // Update charts with all data
    updateGasLPCharts(gasLPStats);

    // Redraw all markers
    if (gasLPPermitsData.length) {
        drawGasLPMarkersOnly(gasLPPermitsData);
    }
}

// ==========================================
// GAS LP - FUNCIONES DE GRÁFICOS
// ==========================================

function createGasLPCharts(stats) {
    createGasLPTypeChart(stats);
    createGasLPStatesChart(stats);
}

function createGasLPTypeChart(stats) {
    const ctx = document.getElementById('gaslp-type-chart');
    if (!ctx) return;

    // Destroy existing chart
    if (gasLPTypeChart) {
        gasLPTypeChart.destroy();
    }

    // Prepare data
    const types = Object.keys(stats.byType).sort((a, b) =>
        stats.byType[b].count - stats.byType[a].count
    );

    const data = types.map(type => stats.byType[type].count);
    const colors = [
        '#1f7a62', '#601623', '#24a47a', '#8B1E3F', '#0D5C4A',
        '#C41E3A', '#165845', '#7a2432', '#2d9575', '#4a0e16'
    ];

    gasLPTypeChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: types,
            datasets: [{
                label: 'Número de Permisos',
                data: data,
                backgroundColor: colors.slice(0, types.length),
                borderWidth: 2,
                borderColor: '#ffffff'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: {
                        boxWidth: 12,
                        padding: 10,
                        font: {
                            family: "'Montserrat', sans-serif",
                            size: 11
                        }
                    }
                },
                title: {
                    display: true,
                    text: 'Distribución por Tipo de Permiso',
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

function createGasLPStatesChart(stats) {
    const ctx = document.getElementById('gaslp-states-chart');
    if (!ctx) return;

    // Destroy existing chart
    if (gasLPStatesChart) {
        gasLPStatesChart.destroy();
    }

    // Get top 10 states by permit count
    const states = Object.keys(stats.byState).sort((a, b) =>
        stats.byState[b].count - stats.byState[a].count
    ).slice(0, 10);

    const data = states.map(state => stats.byState[state].count);

    gasLPStatesChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: states,
            datasets: [{
                label: 'Número de Permisos',
                data: data,
                backgroundColor: '#1f7a62',
                borderColor: '#0D5C4A',
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

function updateGasLPCharts(stats) {
    updateGasLPTypeChart(stats);
    updateGasLPStatesChart(stats);
}

function updateGasLPTypeChart(stats) {
    if (!gasLPTypeChart) {
        createGasLPTypeChart(stats);
        return;
    }

    const types = Object.keys(stats.byType).sort((a, b) =>
        stats.byType[b].count - stats.byType[a].count
    );
    const data = types.map(type => stats.byType[type].count);

    gasLPTypeChart.data.labels = types;
    gasLPTypeChart.data.datasets[0].data = data;
    gasLPTypeChart.update();
}

function updateGasLPStatesChart(stats) {
    if (!gasLPStatesChart) {
        createGasLPStatesChart(stats);
        return;
    }

    const states = Object.keys(stats.byState).sort((a, b) =>
        stats.byState[b].count - stats.byState[a].count
    ).slice(0, 10);
    const data = states.map(state => stats.byState[state].count);

    gasLPStatesChart.data.labels = states;
    gasLPStatesChart.data.datasets[0].data = data;
    gasLPStatesChart.update();
}

// ==========================================
// GAS LP - EVENT LISTENERS
// ==========================================

// Inicializar event listeners cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', function () {
    // Event listeners para tabs de Gas LP
    const gasLPTabs = document.querySelectorAll('.filter-tab-gaslp');
    gasLPTabs.forEach(tab => {
        tab.addEventListener('click', function () {
            const targetTab = this.dataset.tab;

            console.log('Gas LP tab clicked:', targetTab);

            // Reset filters when changing tabs
            if (currentGasLPFilter) {
                console.log('Resetting Gas LP filters on tab change');
                currentGasLPFilter = null;
                currentGasLPFilteredData = [];

                // Restore all markers
                if (gasLPPermitsData.length) {
                    drawGasLPMarkersOnly(gasLPPermitsData);
                }

                // Update totals to show all data
                updateGasLPTotals(gasLPStats);

                // Update charts to show all data
                updateGasLPCharts(gasLPStats);
            }

            // Remove active class from all cards
            document.querySelectorAll('.filter-card').forEach(card => {
                card.classList.remove('active');
            });

            // Update tabs
            gasLPTabs.forEach(t => t.classList.remove('active'));
            this.classList.add('active');

            // Update content
            document.querySelectorAll('.filter-tab-content').forEach(content => {
                content.classList.remove('active');
            });
            document.getElementById('gaslp-' + targetTab + '-filters').classList.add('active');

            // Show/hide layers based on tab
            if (targetTab === 'state') {
                console.log('Showing States layer');
                showStatesLayer(null);
            } else {
                console.log('Hiding geometry layers');
                showStatesLayer(null);
            }
        });
    });

    // Reset button for Gas LP
    const resetGasLPBtn = document.getElementById('reset-gaslp-filters-btn');
    if (resetGasLPBtn) {
        resetGasLPBtn.addEventListener('click', function () {
            resetGasLPFilters();
        });
    }
});

// Exportar para uso en map-config.js
if (typeof module !== 'undefined' && module.exports) {
    module.exports = GAS_LP_MAPS;
}
