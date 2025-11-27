/**
 * Configuración de mapas para GAS NATURAL
 */

// ==========================================
// GAS NATURAL - VARIABLES GLOBALES
// ==========================================

// Variables para almacenar datos y estado
let gasNaturalPermitsData = [];
let gasNaturalStats = null;
let currentGasNaturalFilter = null;
let currentGasNaturalFilteredData = [];

// Variables para gráficos
let gasNaturalTypeChart = null;
let gasNaturalStatesChart = null;


const GAS_NATURAL_MAPS = [
    {
        name: 'Permisos de Gas Natural',
        geojsonUrl: 'https://cdn.sassoapps.com/Mapas/Electricidad/estados.geojson',
        geojsonUrlType: 'states',
        googleSheetUrl: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vRj2u5R11ZLBGtZA88_3k0zaQhzxYnHSxD1Hq2naz8pLuptsOIamjjD_FHIpXwLQWywPOouQ8EtYRME/pub?gid=0&single=true&output=csv',
        googleSheetEditUrl: 'https://docs.google.com/spreadsheets/d/1132Pk53PRj29O7DYYNivwikF3szLTgbxj01FpMPsT90/edit?usp=sharing',
        useClusters: true,
        enableSearch: true,
        mapType: 'gasnatural',
        descriptionTitle: 'Permisos de Gas Natural',
        description: 'Mapa de permisos de distribución, comercialización y expendio de Gas Natural en México. Los marcadores están agrupados para facilitar la visualización. Haga clic en un grupo para ampliar o en un marcador individual para ver los detalles del permiso.'
    }
];

// ==========================================
// GAS NATURAL - FUNCIONES DE ESTADÍSTICAS
// ==========================================

function calculateGasNaturalStats(data) {
    const stats = {
        byState: {}, // By Estado (EfId)
        byType: {}, // By TipoPermiso
        totals: {
            investment: 0,
            compressors: 0,
            dispatchers: 0,
            cylinders: 0,
            count: 0
        }
    };

    data.forEach(row => {
        // Parse EfId to extract state ID and name
        const efIdRaw = (row.EfId || '').trim();
        let stateId = '';
        let stateName = '';

        if (efIdRaw.includes('-')) {
            const parts = efIdRaw.split('-');
            stateId = parts[0].trim();
            stateName = parts[1] ? parts[1].trim() : getStateName(stateId);
        } else {
            stateId = efIdRaw;
            stateName = getStateName(stateId);
        }

        const type = (row.TipoPermiso || 'Sin Tipo').trim();
        const investment = parseFloat(row.InversionEstimada) || 0;
        const compressors = parseInt(row.Compresores) || 0;
        const dispatchers = parseInt(row.NumeroDespachadores) || 0;
        const cylinders = parseInt(row.Cilindros) || 0;

        // By State
        if (!stats.byState[stateName]) {
            stats.byState[stateName] = {
                investment: 0,
                compressors: 0,
                dispatchers: 0,
                cylinders: 0,
                count: 0,
                stateId: stateId
            };
        }
        stats.byState[stateName].investment += investment;
        stats.byState[stateName].compressors += compressors;
        stats.byState[stateName].dispatchers += dispatchers;
        stats.byState[stateName].cylinders += cylinders;
        stats.byState[stateName].count++;

        // By Type
        if (!stats.byType[type]) {
            stats.byType[type] = {
                investment: 0,
                compressors: 0,
                dispatchers: 0,
                cylinders: 0,
                count: 0
            };
        }
        stats.byType[type].investment += investment;
        stats.byType[type].compressors += compressors;
        stats.byType[type].dispatchers += dispatchers;
        stats.byType[type].cylinders += cylinders;
        stats.byType[type].count++;

        // Totals
        stats.totals.investment += investment;
        stats.totals.compressors += compressors;
        stats.totals.dispatchers += dispatchers;
        stats.totals.cylinders += cylinders;
        stats.totals.count++;
    });

    return stats;
}

// ==========================================
// GAS NATURAL - FUNCIONES DE DIBUJO
// ==========================================

function drawGasNaturalPermits(rows) {
    console.log('drawGasNaturalPermits called with', rows.length, 'rows');

    // Clear existing markers
    markersLayer.clearLayers();
    if (markersClusterGroup) {
        map.removeLayer(markersClusterGroup);
        markersClusterGroup = null;
    }

    // Store data
    gasNaturalPermitsData = rows;
    console.log('Stored gasNaturalPermitsData:', gasNaturalPermitsData.length);

    // Calculate statistics
    gasNaturalStats = calculateGasNaturalStats(rows);
    console.log('Calculated stats:', gasNaturalStats);

    updateGasNaturalTotals(gasNaturalStats);
    createGasNaturalFilterCards(gasNaturalStats, 'state');
    createGasNaturalFilterCards(gasNaturalStats, 'type');

    // Create charts
    createGasNaturalCharts(gasNaturalStats);

    // Show States layer by default
    showStatesLayer(null);

    // Show filters panel
    const filtersPanel = document.getElementById('gasnatural-filters-panel');
    if (filtersPanel) {
        filtersPanel.style.display = 'block';
        console.log('Gas Natural filters panel shown');
    } else {
        console.error('Gas Natural filters panel not found!');
    }

    // Draw markers
    drawGasNaturalMarkersOnly(rows);
    console.log('Markers drawn');
}

function drawGasNaturalMarkersOnly(rows) {
    console.log('drawGasNaturalMarkersOnly called with', rows.length, 'rows');

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
            '<div><strong>Estado:</strong> ' + (row.EfId || 'N/A').split('-')[1] || 'N/A' + '</div>',
            '<div><strong>Municipio:</strong> ' + (row.MpoId || 'N/A').split('-')[1] || 'N/A' + '</div>',
            '<div><strong>Estatus:</strong> ' + (row.Estatus || 'N/A') + '</div>',
            '<div><strong>Tipo:</strong> ' + (row.TipoPermiso || 'N/A') + '</div>',
            row.InversionEstimada ? '<div><strong>Inversión:</strong> $' + parseFloat(row.InversionEstimada).toLocaleString('es-MX', { maximumFractionDigits: 2 }) + '</div>' : '',
            row.Compresores ? '<div><strong>Compresores:</strong> ' + row.Compresores + '</div>' : '',
            row.NumeroDespachadores ? '<div><strong>Despachadores:</strong> ' + row.NumeroDespachadores + '</div>' : '',
            row.Cilindros ? '<div><strong>Cilindros:</strong> ' + row.Cilindros + '</div>' : '',
            row.FechaOtorgamiento ? '<div><strong>Fecha:</strong> ' + row.FechaOtorgamiento + '</div>' : '',
            '</div>',
            '</div>'
        ].join('');

        const gasNaturalIcon = L.divIcon({
            className: 'electricity-marker-icon',
            html: '<img src="https://cdn.sassoapps.com/iconos_snien/gas_natural.png" style="width: 32px; height: 32px;">',
            iconSize: [32, 32],
            iconAnchor: [16, 16],
            popupAnchor: [0, -16]
        });

        const marker = L.marker([lat, lng], {
            icon: gasNaturalIcon,
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

// ==========================================
// GAS NATURAL - FUNCIONES DE TOTALES
// ==========================================

function updateGasNaturalTotals(stats) {
    const investmentEl = document.getElementById('total-gasnatural-investment');
    const compressorsEl = document.getElementById('total-gasnatural-compressors');
    const permitsEl = document.getElementById('total-gasnatural-permits');

    if (investmentEl) {
        investmentEl.textContent = '$' + stats.totals.investment.toLocaleString('es-MX', { maximumFractionDigits: 2 });
    }
    if (compressorsEl) {
        compressorsEl.textContent = stats.totals.compressors.toLocaleString('es-MX');
    }
    if (permitsEl) {
        permitsEl.textContent = stats.totals.count.toLocaleString('es-MX');
    }
}

// ==========================================
// GAS NATURAL - FUNCIONES DE CARDS
// ==========================================

function createGasNaturalFilterCards(stats, type) {
    let container, data;

    if (type === 'state') {
        container = document.getElementById('gasnatural-state-cards');
        data = stats.byState;
    } else {
        container = document.getElementById('gasnatural-type-cards');
        data = stats.byType;
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
                    <span class="filter-stat-label">💰 Inversión:</span>
                    <span class="filter-stat-value">$${item.investment.toLocaleString('es-MX', { maximumFractionDigits: 2 })}</span>
                </div>
                <div class="filter-stat">
                    <span class="filter-stat-label">⚙️ Compresores:</span>
                    <span class="filter-stat-value">${item.compressors.toLocaleString('es-MX')}</span>
                </div>
            </div>
        `;

        card.addEventListener('click', function () {
            filterGasNaturalPermits(type, key);

            // Update active state
            container.querySelectorAll('.filter-card').forEach(c => c.classList.remove('active'));
            this.classList.add('active');
        });

        container.appendChild(card);
    });
}

// ==========================================
// GAS NATURAL - FUNCIONES DE FILTROS
// ==========================================

function filterGasNaturalPermits(type, value) {
    if (!markersClusterGroup || !gasNaturalPermitsData.length) return;

    currentGasNaturalFilter = { type, value };

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
        const stateId = gasNaturalStats.byState[value] ? gasNaturalStats.byState[value].stateId : null;

        console.log('Filtering by state:', value, 'State ID:', stateId);

        if (stateId) {
            const normalizedFilterId = stateId.toString().trim();

            filteredData = gasNaturalPermitsData.filter(row => {
                const rowEfId = (row.EfId || '').toString().trim();
                const rowId = rowEfId.split('-')[0].trim();
                return rowId === normalizedFilterId || rowEfId.includes(value);
            });
        } else {
            filteredData = gasNaturalPermitsData.filter(row => {
                const rowEfId = (row.EfId || '').toString().trim();
                return rowEfId.includes(value);
            });
        }
    } else if (type === 'type') {
        filteredData = gasNaturalPermitsData.filter(row =>
            (row.TipoPermiso || 'Sin Tipo').trim() === value
        );
    }

    // Store filtered data for search
    currentGasNaturalFilteredData = filteredData;
    console.log('Gas Natural filter applied:', type, value, '- Showing', filteredData.length, 'permits');

    // Recalculate stats for filtered data
    const filteredStats = calculateGasNaturalStats(filteredData);
    updateGasNaturalTotals(filteredStats);

    // Update charts with filtered data
    updateGasNaturalCharts(filteredStats);

    // Redraw markers with filtered data
    drawGasNaturalMarkersOnly(filteredData);
}

function resetGasNaturalFilters() {
    currentGasNaturalFilter = null;
    currentGasNaturalFilteredData = [];

    console.log('Gas Natural filters reset - searching in all', gasNaturalPermitsData.length, 'permits');

    // Clear search box
    clearSearchBox();

    // Remove active class from all cards
    document.querySelectorAll('.filter-card').forEach(c => c.classList.remove('active'));

    // Show layer based on active tab
    const activeTab = document.querySelector('.filter-tab-gasnatural.active');
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
    updateGasNaturalTotals(gasNaturalStats);

    // Update charts with all data
    updateGasNaturalCharts(gasNaturalStats);

    // Redraw all markers
    if (gasNaturalPermitsData.length) {
        drawGasNaturalMarkersOnly(gasNaturalPermitsData);
    }
}

// ==========================================
// GAS NATURAL - FUNCIONES DE GRÁFICOS
// ==========================================

function createGasNaturalCharts(stats) {
    createGasNaturalTypeChart(stats);
    createGasNaturalStatesChart(stats);
}

function createGasNaturalTypeChart(stats) {
    const ctx = document.getElementById('gasnatural-type-chart');
    if (!ctx) return;

    // Destroy existing chart
    if (gasNaturalTypeChart) {
        gasNaturalTypeChart.destroy();
    }

    // Prepare data
    const types = Object.keys(stats.byType).sort((a, b) =>
        stats.byType[b].count - stats.byType[a].count
    );

    const data = types.map(type => stats.byType[type].count);
    const colors = [
        '#601623', '#1f7a62', '#8B1E3F', '#24a47a', '#C41E3A',
        '#0D5C4A', '#7a2432', '#165845', '#4a0e16', '#2d9575'
    ];

    gasNaturalTypeChart = new Chart(ctx, {
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

function createGasNaturalStatesChart(stats) {
    const ctx = document.getElementById('gasnatural-states-chart');
    if (!ctx) return;

    // Destroy existing chart
    if (gasNaturalStatesChart) {
        gasNaturalStatesChart.destroy();
    }

    // Get top 10 states by investment
    const states = Object.keys(stats.byState).sort((a, b) =>
        stats.byState[b].investment - stats.byState[a].investment
    ).slice(0, 10);

    const data = states.map(state => stats.byState[state].investment);

    gasNaturalStatesChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: states,
            datasets: [{
                label: 'Inversión ($)',
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
                    text: 'Top 10 Estados por Inversión',
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
                            return `$${value.toLocaleString('es-MX', { maximumFractionDigits: 2 })}`;
                        }
                    }
                }
            },
            scales: {
                x: {
                    beginAtZero: true,
                    ticks: {
                        callback: function (value) {
                            return '$' + value.toLocaleString('es-MX');
                        }
                    }
                }
            }
        }
    });
}

function updateGasNaturalCharts(stats) {
    updateGasNaturalTypeChart(stats);
    updateGasNaturalStatesChart(stats);
}

function updateGasNaturalTypeChart(stats) {
    if (!gasNaturalTypeChart) {
        createGasNaturalTypeChart(stats);
        return;
    }

    const types = Object.keys(stats.byType).sort((a, b) =>
        stats.byType[b].count - stats.byType[a].count
    );
    const data = types.map(type => stats.byType[type].count);

    gasNaturalTypeChart.data.labels = types;
    gasNaturalTypeChart.data.datasets[0].data = data;
    gasNaturalTypeChart.update();
}

function updateGasNaturalStatesChart(stats) {
    if (!gasNaturalStatesChart) {
        createGasNaturalStatesChart(stats);
        return;
    }

    const states = Object.keys(stats.byState).sort((a, b) =>
        stats.byState[b].investment - stats.byState[a].investment
    ).slice(0, 10);
    const data = states.map(state => stats.byState[state].investment);

    gasNaturalStatesChart.data.labels = states;
    gasNaturalStatesChart.data.datasets[0].data = data;
    gasNaturalStatesChart.update();
}

// ==========================================
// GAS NATURAL - EVENT LISTENERS
// ==========================================

// Inicializar event listeners cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', function () {
    // Event listeners para tabs de Gas Natural
    const gasNaturalTabs = document.querySelectorAll('.filter-tab-gasnatural');
    gasNaturalTabs.forEach(tab => {
        tab.addEventListener('click', function () {
            const targetTab = this.dataset.tab;

            console.log('Gas Natural tab clicked:', targetTab);

            // Reset filters when changing tabs
            if (currentGasNaturalFilter) {
                console.log('Resetting Gas Natural filters on tab change');
                currentGasNaturalFilter = null;
                currentGasNaturalFilteredData = [];

                // Restore all markers
                if (gasNaturalPermitsData.length) {
                    drawGasNaturalMarkersOnly(gasNaturalPermitsData);
                }

                // Update totals to show all data
                updateGasNaturalTotals(gasNaturalStats);

                // Update charts to show all data
                updateGasNaturalCharts(gasNaturalStats);
            }

            // Remove active class from all cards
            document.querySelectorAll('.filter-card').forEach(card => {
                card.classList.remove('active');
            });

            // Update tabs
            gasNaturalTabs.forEach(t => t.classList.remove('active'));
            this.classList.add('active');

            // Update content
            document.querySelectorAll('.filter-tab-content').forEach(content => {
                content.classList.remove('active');
            });
            document.getElementById('gasnatural-' + targetTab + '-filters').classList.add('active');

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

    // Reset button for Gas Natural
    const resetGasNaturalBtn = document.getElementById('reset-gasnatural-filters-btn');
    if (resetGasNaturalBtn) {
        resetGasNaturalBtn.addEventListener('click', function () {
            resetGasNaturalFilters();
        });
    }
});

// Exportar para uso en map-config.js
if (typeof module !== 'undefined' && module.exports) {
    module.exports = GAS_NATURAL_MAPS;
}
