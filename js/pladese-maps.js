/**
 * Configuración de mapas para PLADESE
 * Planeación del Sistema Eléctrico Nacional
 */

const PLADESE_MAPS = [
    {
        name: 'Figura 2.1. Regiones y enlaces del SEN en 2025',
        geojsonUrl: 'https://cdn.sassoapps.com/Mapas/Electricidad/gerenciasdecontrol.geojson',
        geojsonUrlType: 'regions',
        connectionsGeojsonUrl: 'https://cdn.sassoapps.com/Mapas/Electricidad/lienas.geojson',
        //googleSheetUrl: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vRBhcrQHIMTSx9uf7i-iRPCm1i5JT20AYRqKsMBn-JZa4jHNFUKuftYnU5N0IdeQ3IUeyE_tr8Swnjo/pub?gid=0&single=true&output=csv',
        googleSheetUrl: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vRmiZTItq8d5z_ljlcWJjvYW1pEZ-TG2sFdOgjJPZZXeXHreDN0EcYOS6APs4L8zmsCjmCxVg4C_y4S/pub?gid=0&single=true&output=csv',
        //googleSheetEditUrl: 'https://docs.google.com/spreadsheets/d/1XuB7E8Vz4OqNf6lzGUr_8JJ9QE9ksqwSqSSx58yr-Gw/edit?usp=sharing',
        googleSheetEditUrl: 'https://docs.google.com/spreadsheets/d/18bRXnlygfBG0uJ5Z6RGvut6RlvC3Tip6-VjTQ6PrtzM/edit?usp=sharing',
        descriptionTitle: 'Diagnóstico del sector eléctrico',
        description: 'El suministro eléctrico es uno de los principales servicios capaces de impulsar y generar prosperidad y desarrollo para todos los sectores del país: desde un hogar, hasta comercios, el campo, otros servicios públicos y la industria. En esta sección se presenta un diagnóstico con las principales características que guarda el sector eléctrico nacional y su evolución de 2010 a 2024, como lo son: la demanda y el consumo, el consumo final, las pérdidas eléctricas, la infraestructura de transmisión y distribución, la red de gasoductos, la cobertura eléctrica, las tarifas eléctricas, las emisiones de gases de efecto invernadero, la cobertura del servicio eléctrico, la innovación, así como el desarrollo tecnológico y de capacidades.<br><br>El SEN se compone de 8 Gerencias de Control Regional (GCR) con 100 regiones de transmisión (Figura 2.1) y enlaces equivalentes que interconectan a estas y a las GCR. La GCR Baja California contiene tres sistemas interconectados: El Sistema Interconectado de Baja California (SIBC), el Sistema Interconectado de Baja California Sur (SIBCS) y el Sistema Interconectado de Mulegé (SIMUL). Por su parte, las GCR Central (CEN), Noreste (NES), Noroeste (NOR), Norte (NTE), Occidental (OCC), Oriental (ORI) y Peninsular (PEN) conforman el Sistema Interconectado Nacional (SIN).',
        insets: [
            {
                label: 'Baja California 1',
                center: [23.2, -110.5],
                zoom: 7,
                size: { width: 280, height: 200 },
                position: { bottom: '18px', left: '18px' },
                bounds: [
                    [21.5, -112.5],
                    [24.8, -108.5]
                ]
            },
            {
                label: 'Peninsular 1',
                center: [20.9, -87.4],
                zoom: 7,
                size: { width: 280, height: 200 },
                position: { top: '18px', right: '18px' },
                bounds: [
                    [19.5, -89.2],
                    [22.2, -85.5]
                ]
            },
            {
                label: 'Baja California 2',
                center: [23.2, -110.5],
                zoom: 7,
                size: { width: 280, height: 200 },
                position: { bottom: '230px', left: '18px' },
                bounds: [
                    [21.5, -112.5],
                    [24.8, -108.5]
                ]
            },
            {
                label: 'Peninsular 2',
                center: [20.9, -87.4],
                zoom: 7,
                size: { width: 280, height: 200 },
                position: { top: '230px', right: '18px' },
                bounds: [
                    [19.5, -89.2],
                    [22.2, -85.5]
                ]
            }
        ]
    },
    {
        name: 'Figura 2.12. Red nacional de gasoductos en 2024',
        geojsonUrl: 'https://cdn.sassoapps.com/Mapas/Electricidad/estados.geojson',
        geojsonUrlType: 'states',
        googleSheetUrl: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vSR7XevbKi6yGLS8hLXmWnBZIvOWu4xB45B0-VA7CNIleOY_88YGzZf9W_zf0GVIb5k5pHzSI7RE7tY/pub?gid=0&single=true&output=csv',
        googleSheetEditUrl: 'https://docs.google.com/spreadsheets/d/1xcApSZqIxPsu4x59_pHZ1Ym62id52CyIIXVC7AopQhM/edit?usp=sharing',
        descriptionTitle: 'Evolución de la red nacional de gasoductos',
        description: 'La generación de energía eléctrica a partir de tecnologías con funcionamiento basado en el consumo de gas natural (principalmente Turbogás y Ciclo Combinado) ha tomado relevancia en el contexto nacional. Con una TMCA de 3.1% en la generación eléctrica de estas dos tecnologías durante el periodo 2010-2024 (Ver Tabla 2.2), se ha tenido que construir y adaptar la infraestructura para ello. En esta sección se reporta la infraestructura existente para abastecer el combustible necesario para la generación de energía eléctrica.',
        pipelineGeojsonUrls: [
            'https://cdn.sassoapps.com/Mapas/Electricidad/Ductos%20de%20Importacion.geojson',
            'https://cdn.sassoapps.com/Mapas/Electricidad/Ductos%20integrados%20a%20SISTRANGAS.geojson',
            'https://cdn.sassoapps.com/Mapas/Electricidad/Ductos%20no%20integrados%20a%20SISTRANGAS.geojson'
        ]
    },
    {
        name: 'Figuras 2.15 a 2.22. Municipios con localidades sin electrificar',
        geojsonUrl: 'https://cdn.sassoapps.com/Mapas/Electricidad/gerenciasdecontrol.geojson',
        geojsonUrlType: 'interactive-regions',
        municipalitiesGeojsonUrl: 'https://cdn.sassoapps.com/Mapas/Electricidad/municipios.geojson',
        googleSheetUrl: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vRrctgh6EBDr8aCcqVWA5X03JtFm1E0NRb2h6bOrQMqO9qVr58MAgqtnHsRfqjzJgR7VqVtvqNUJRM-/pub?gid=0&single=true&output=csv',
        googleSheetEditUrl: 'https://docs.google.com/spreadsheets/d/182C6iNiTUcUI5HHVlNGg0IOJHoGYeI47uYwAaehC6E8/edit?usp=sharing',
        regionDescriptions: {
            // Descriptions will be added later
        },
        descriptionTitle: 'Municipios con localidades sin electrificar',
        description: `
            <div style="font-family: 'Montserrat', sans-serif; color: #333;">
                <p style="margin-bottom: 15px;">Este mapa interactivo permite visualizar las localidades pendientes de electrificación en todo el país, organizadas por Gerencias de Control Regional.</p>
                
                <div style="background-color: #f8f9fa; border-left: 4px solid #601623; padding: 15px; border-radius: 4px;">
                    <strong style="color: #601623; display: block; margin-bottom: 10px;">📋 Instrucciones de uso:</strong>
                    <ul style="margin: 0; padding-left: 20px; line-height: 1.6;">
                        <li>Haga clic en cualquier <strong>Gerencia de Control Regional</strong> (áreas coloreadas) para explorarla.</li>
                        <li>Al seleccionar una gerencia, el mapa hará zoom y mostrará sus <strong>municipios</strong>.</li>
                        <li>Los municipios se muestran en una escala de colores (mapa de calor) según el número de localidades pendientes.</li>
                        <li>Pase el cursor sobre cualquier municipio para ver el detalle exacto.</li>
                        <li>Para regresar a la vista nacional, haga clic nuevamente en la región seleccionada o utilice el botón de "Restablecer vista".</li>
                    </ul>
                </div>
            </div>
        `
    },
    {
        name: 'Figura 2.16. Municipios con localidades sin electrificar en la GCR Oriental',
        geojsonUrl: 'https://cdn.sassoapps.com/Mapas/Electricidad/gerenciasdecontrol.geojson',
        geojsonUrlType: 'interactive-regions',
        municipalitiesGeojsonUrl: 'https://cdn.sassoapps.com/Mapas/Electricidad/municipios.geojson',
        googleSheetUrl: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vRrctgh6EBDr8aCcqVWA5X03JtFm1E0NRb2h6bOrQMqO9qVr58MAgqtnHsRfqjzJgR7VqVtvqNUJRM-/pub?gid=0&single=true&output=csv',
        googleSheetEditUrl: 'https://docs.google.com/spreadsheets/d/182C6iNiTUcUI5HHVlNGg0IOJHoGYeI47uYwAaehC6E8/edit?usp=sharing',
        defaultRegion: 'Oriental',
        descriptionTitle: 'Municipios con localidades sin electrificar en la GCR Oriental',
        description: 'Mapa enfocado en la Gerencia de Control Regional Oriental, mostrando los municipios con localidades pendientes de electrificación.'
    },
    {
        name: 'Figura 3.5. Pronóstico regional del PIB, escenario de planeación 2025 - 2030 y 2025-2039',
        geojsonUrl: 'https://cdn.sassoapps.com/Mapas/Electricidad/gerenciasdecontrol.geojson',
        geojsonUrlType: 'pib-forecast',
        googleSheetUrl: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vSVE7N8gjuivL9JiM59vFBjiej5k48foC60TrSRGXjEAbJXvW0NXTZ3Fq0-kWzY73kmMPSq68xtpZE2/pub?gid=0&single=true&output=csv',
        googleSheetEditUrl: 'https://docs.google.com/spreadsheets/d/1NumCWqCiRd6Ph1vXOrsc1lcyv4Hx-v_1Lve1QIV2kdE/edit?usp=sharing',
        descriptionTitle: 'Pronóstico regional del PIB, escenario de planeación 2025 - 2030 y 2025-2039',
        description: 'El periodo de estudio 2025-2039, se estima que la participación en el PIB de los sectores de la economía mexicana se comporte de la siguiente manera: se estima que el PIB del sector primario crezca en promedio 1.9% por año, mientras que el Sector Industrial y el Sector Servicios lo harán a una tasa de 2.5% cada uno. En la composición sectorial del PIB, se prevé que, en 2039, el sector Agrícola represente el 3.1% del PIB Nacional, mientras que el Industrial y el de Servicios integrarán el 33.5% y 63.4%, respectivamente.<br><br>El Servicio Público de Energía Eléctrica se distribuye a través de las diferentes entidades responsables de carga los cuales se desagregan en seis sectores por el uso final de la energía eléctrica, con una diferente participación en el Consumo Eléctrico Nacional: residencial, comercial, servicios, agrícola, empresa mediana y gran industria.<br><br>Para el 2024 el SEN tuvo un consumo final de 304,011 GWh, siendo 1.8% mayor al del año previo. En cuanto a los usuarios con servicio de energía eléctrica crecieron 1.7% respecto al 2023, llegando a 49 millones de clientes. Los sectores empresa mediana y la gran industria consumieron el 60.6 % del consumo final, con solo el 0.9% del total de los usuarios. En el sector residencial, se alberga la mayor cantidad de usuarios con 89.2%, los cuales consumen sólo el 27.1% del SEN. El 12.4% restante del consumo final es utilizado por los usuarios de los sectores comercial con 5.9%, bombeo agrícola con 5.2% y servicios 1.3%.<br><br>Con el propósito de fomentar el crecimiento económico del país, se creó el Plan México, una estrategia gubernamental de largo plazo, que tiene como propósitos: incrementar la inversión, la creación de nuevos empleos, la proveeduría y consumo nacional en sectores estratégicos, disminución de la pobreza y la desigualdad, entre otros. Para ello, se planteó garantizar el acceso universal a la electricidad mediante el fortalecimiento de la infraestructura eléctrica del país. Por lo que, el Plan México contempla además de obras de electrificación, aumentos en la capacidad de generación pública y capacidad de generación mixta (pública y privada), además de proyectos de transmisión y distribución, con énfasis en las áreas marginadas. Se dará continuidad al programa de cobertura eléctrica nacional con fines sociales y comunitarios, permitiendo así el desarrollo local y regional, con la premisa de asegurar que las tarifas no aumenten en términos reales.<br><br>El Plan México regionaliza sus proyectos en Polos de Desarrollo Económico para el Bienestar (PODECOBIS), los primeros 15 polos estarán ubicados en 14 estados en los que se busca desarrollar zonas industriales, sin dejar de lado los servicios y el turismo. Dentro de ramas industriales contempladas están: agroindustria, aeroespacial, automotriz, bienes de consumo, farmacéutica y dispositivos médicos, electrónica y semiconductores, energía, química y petroquímica, textil y calzado, y economía circular.<br><br>Como parte de las inversiones estratégicas derivadas del Plan México, se continuará con la expansión y rehabilitación de redes ferroviarias mediante proyectos como los trenes México-Querétaro, México-Pachuca, Saltillo-Nuevo Laredo, Querétaro-Irapuato, Tren Insurgente y Tren Maya de Carga, así como la modernización de puertos y carreteras. Con estas acciones, se busca posicionar a México como nodo estratégico en las cadenas de suministro, impulsando la inversión en logística y comercio, y promoviendo el crecimiento y el desarrollo económico.<br><br>Las expectativas de crecimiento del PIB presentan un comportamiento diferenciado entre el mediano y largo plazo, ya que, en este último, la incertidumbre es mayor. Para el periodo 2025-2030, por Gerencia de Control Regional (GCR), se espera que los sistemas de Baja california y Mulegé (SIBCS y SIMUL) presenten la mayor TMCA con 3.1%, mientras que el menor crecimiento del PIB se estima ocurra en la GCR NTE, con 2.0%. Tanto el SIN como el SEN se proyecta un crecimiento de 2.5% anual en el mismo periodo. En el periodo 2025-2039, los SIBCS y SIMUL se prevé que continúen con mayor crecimiento y, en contraste, en la GCR NTE y ORI se estima la menor TMCA, con 2.2%. Para el SIN y el SEN se espera una TMCA de 2.5% cada uno.'
    },
    {
        name: 'Figura 3.9. Pronósticos del consumo bruto 2025 - 2030 y 2025 - 2039',
        geojsonUrl: 'https://cdn.sassoapps.com/Mapas/Electricidad/gerenciasdecontrol.geojson',
        geojsonUrlType: 'consumption-forecast',
        googleSheetUrl: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQytuUc9Cmf9kOvPCmLkYEOObPEP_rM1bSb9_awO0wYqdLAKw4x_b9FLEBSVGoGXKbDuK8nK4ge2cjM/pub?gid=0&single=true&output=csv',
        googleSheetEditUrl: 'https://docs.google.com/spreadsheets/d/1XdFM-P6c3N4wS5arzJ3K4hUcIMibCeBX5iz3IQ_3U2A/edit?usp=sharing',
        descriptionTitle: 'Pronósticos del consumo bruto',
        description: 'Se presentan las TMCA de los tres escenarios para cada una de las GCR que integran el SIN en el periodo de estudio. Tomando en cuenta el escenario de planeación, el cual es considerado como el escenario principal para la realización de estudios y evaluación de proyectos, se observa que, la península de Yucatán presenta la TMCA más alta con un crecimiento de 3.6% en el escenario bajo, 3.9% en el escenario de planeación y 4.3% en el escenario alto. Por el contrario, en las GCR Central, Oriental, Norte y Noroeste se esperan crecimientos menores a 1.9% en el escenario bajo. Los crecimientos de estas GCR en el escenario alto oscilan entre 2.4% y 2.7%, y en el escenario de planeación se estiman incrementos de 2% a 2.2%. La GCR Noreste y Occidental crecerán en el escenario de planeación 2.8% y 2.7%, respectivamente, mientras que para el escenario alto se estiman crecimientos ligeramente superiores al 3% y para el bajo se estima 2.4% para el Noreste y 2.3% el Occidental. En lo que refiere al escenario de planeación, se estima que la GCR Peninsular tenga un mayor crecimiento, con una TMCA de 3.9%, seguida de las GCR Noreste y Occidental con crecimientos promedio de 2.8% y 2.7%, respectivamente. En cuanto a los Sistemas Interconectados, el SIBC crecerá en promedio 3.4%, mientras que el SIBCS y SIMUL se calcula avancen 3.1% y 1.8%, en ese orden.'
    },
    {
        name: 'Figura 4.3. Adiciones de Capacidad de proyectos de fortalecimiento de la CFE 2025 - 2027',
        geojsonUrl: 'https://cdn.sassoapps.com/Mapas/Electricidad/gerenciasdecontrol.geojson',
        geojsonUrlType: 'capacity-additions',
        googleSheetUrl: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vR6orBJGbqI8xr6TkOUaJM7I-8RbE7inbex6PrKWHdgTUif8EBFljKuzFR42OqoroQ87kAGpZt_ry-J/pub?gid=0&single=true&output=csv',
        googleSheetEditUrl: 'https://docs.google.com/spreadsheets/d/1wnpAefR4rLYhOFEzsjas_ujkDvxAlHJ7EFr0pJi-Ve4/edit?usp=sharing',
        descriptionTitle: 'Adiciones de Capacidad de proyectos de fortalecimiento de la CFE 2025 - 2027',
        description: 'Como parte del fortalecimiento de la CFE durante la administración del Gobierno Federal en el periodo 2018-2024 se impulsaron proyectos de fortalecimiento correspondientes a modernización, rehabilitación y construcción de nuevas centrales. El PVIRCE considera la adición de 2,963 MW para el horizonte 2025-2027, de los cuales 2,330 MW corresponden a tecnología de ciclo combinado, 173 MW de turbogás y 460 MW de hidroeléctricas. En la Figura 4.3 se muestra la distribución de estos proyectos por tecnología y GCR.'
    },
    {
        name: 'Figura 4.4. Adiciones de capacidad de proyectos del Estado 2027 - 2030',
        geojsonUrl: 'https://cdn.sassoapps.com/Mapas/Electricidad/gerenciasdecontrol.geojson',
        geojsonUrlType: 'capacity-additions',
        googleSheetUrl: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vSuLWC7WRjRZ-Kicm-0rWJd9beVu4jAwsABNLcixRUCr6XvC0pVvrgPXJW-qh-44AvmLt6gYBDwdoms/pub?gid=0&single=true&output=csv',
        googleSheetEditUrl: 'https://docs.google.com/spreadsheets/d/1M39eRP0lyefgfZsZXKWsRSAXhQPHg54T8uaNZYEew-w/edit?usp=sharing',
        descriptionTitle: 'Adiciones de capacidad de proyectos del Estado',
        description: 'En la presente administración del Gobierno Federal el PVIRCE considera la adición de 14,046 MW para el horizonte 2027-2030 por parte del Estado, con una participación del 77% de energías limpias, de las cuales el 60% corresponde a renovables, en la mapa se muestra la distribución de estos proyectos por tecnología y GCR.'
    },
    {
        name: 'Figura 4.5. Adiciones de capacidad de proyectos con prelación 2025 - 2030',
        geojsonUrl: 'https://cdn.sassoapps.com/Mapas/Electricidad/gerenciasdecontrol.geojson',
        geojsonUrlType: 'capacity-additions',
        googleSheetUrl: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vRIo6nqNkppQCVqqsUC1LNKSw8n9AyslhakQb_3gB7bccFP1Tb7ssDX1ycdMe0rTSlSrWXpH_CSTMna/pub?gid=0&single=true&output=csv',
        googleSheetEditUrl: 'https://docs.google.com/spreadsheets/d/1Pkudx2FB2ta7jsm-Sx3TUzUpNlT7LF6sgi6Rs-Oi-NU/edit?usp=sharing',
        descriptionTitle: 'Adiciones de capacidad de proyectos con prelación 2025 - 2030',
        description: 'De 2025 a 2030 se espera adicionar 3,590 MW de capacidad de generación que cuentan con contrato de interconexión como se observa en mapa'
    },
    {
        name: 'Figura 4.6. Adición de capacidad para desarrollarse por particulares 2026 - 2030',
        geojsonUrl: 'https://cdn.sassoapps.com/Mapas/Electricidad/gerenciasdecontrol.geojson',
        geojsonUrlType: 'capacity-additions',
        googleSheetUrl: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vTYfjJ8D1nJGd7IFKOzzg_e7Dpn77RyyeQM1MVFLg4pN4CB7TR1hj_5Zt2igXlDiht8p7hVs-aIp3DQ/pub?gid=0&single=true&output=csv',
        googleSheetEditUrl: 'https://docs.google.com/spreadsheets/d/1jGSjieGMNeCyk_agXzDNF90J2srt-89Ungq4Bwda8HY/edit?usp=sharing',
        descriptionTitle: 'Adición de capacidad para desarrollarse por particulares 2026 - 2030',
        description: 'La SENER determinó también 7,405 MW de adiciones de capacidad con base a la Planeación Vinculante, que pueden ser desarrollados por particulares durante el periodo 2026 a 2030, con la participación de fuentes de generación renovables como se observa en la Figura 4.6. De los cuales 1,638 MW de capacidad de generación, y 900 MW de rebombeo hidráulico, corresponden a proyectos estratégicos para cumplir con la política energética nacional, definidos por la SENER.\nAdicionalmente, a dicha capacidad el CENACE y CNE, podrán atender y priorizar las solicitudes de otorgamiento de permisos de generación de energía eléctrica, así como la elaboración de estudios de interconexión para la figura de autoconsumo y la modalidad de cogeneración que pretendan desarrollar los particulares y que se encuentren alineados con los criterios de planeación vinculante. Asimismo, los trámites relacionados con el proceso de conexión de Centros de Carga podrán ser priorizados tomando en cuenta la política nacional atendiendo el crecimiento de la demanda de energía eléctrica en cumplimiento de las leyes, reglamentos y demás disposiciones jurídicas aplicables.'
    },
    {
        name: 'Adición de capacidad 2025-2030',
        geojsonUrl: 'https://cdn.sassoapps.com/Mapas/Electricidad/gerenciasdecontrol.geojson',
        geojsonUrlType: 'total-capacity-additions',
        descriptionTitle: 'Adición de Capacidad Total (Agregada) 2025-2039',
        description: 'Este mapa muestra la suma de todas las adiciones de capacidad planeadas de los proyectos de CFE, el Estado y particulares para el periodo 2025-2039, agregadas por Gerencia de Control Regional.'
    }
];

// Hacer disponible globalmente
window.PLADESE_MAPS = PLADESE_MAPS;
