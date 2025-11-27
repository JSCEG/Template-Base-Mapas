# Guía de Estilos Web - Plantilla Institucional SENER 2025

Esta guía define los lineamientos de diseño para la implementación web, basados en la identidad gráfica institucional del Gobierno de México y la plantilla LaTeX `sener2025`.

## 1. Variables CSS (Design Tokens)

Copia y pega este bloque en el `:root` de tu archivo CSS principal (ej. `styles.css` o `index.css`).

```css
:root {
  /* --- Paleta de Colores Institucional (GobMX) --- */
  --color-gobmx-guinda: #9B2247;
  --color-gobmx-verde: #1E5B4F;
  --color-gobmx-dorado: #A57F2C;
  --color-gobmx-gris: #98989A;
  --color-gobmx-gris-claro: #E5E5E5;
  
  /* Variantes de Opacidad (para fondos) */
  --color-gobmx-guinda-light: rgba(155, 34, 71, 0.05);
  --color-gobmx-verde-light: rgba(30, 91, 79, 0.05);
  --color-gobmx-dorado-light: rgba(165, 127, 44, 0.05);

  /* Colores Funcionales */
  --color-text-primary: #333333;
  --color-text-secondary: var(--color-gobmx-gris);
  --color-background: #FFFFFF;
  --color-surface: #F8F9FA;
  --color-border: #DDDDDD;
  
  /* --- Tipografía --- */
  /* Nota: Asegúrate de importar 'Noto Sans' de Google Fonts. 
     Para 'Patria', usa una serif similar si no está disponible web (ej. Merriweather). */
  --font-family-headings: 'Patria', 'Merriweather', serif;
  --font-family-body: 'Noto Sans', sans-serif;

  --font-size-base: 16px;
  --font-size-h1: 2.5rem;   /* ~40px */
  --font-size-h2: 2rem;     /* ~32px */
  --font-size-h3: 1.75rem;  /* ~28px */
  --font-size-h4: 1.5rem;   /* ~24px */
  --font-size-small: 0.875rem; /* ~14px */

  /* --- Espaciado (Based on 8pt grid approx) --- */
  --spacing-xs: 0.5rem;  /* 8px */
  --spacing-sm: 1rem;    /* 16px */
  --spacing-md: 1.5rem;  /* 24px - Similar a los márgenes LaTeX */
  --spacing-lg: 2rem;    /* 32px */
  --spacing-xl: 3rem;    /* 48px */

  /* --- Bordes y Sombras --- */
  --border-radius-sm: 4px;
  --border-radius-md: 8px; /* Coincide con 'arc=3mm' aprox */
  --box-shadow-card: 0 4px 6px rgba(0, 0, 0, 0.1);
}
```

## 2. Tipografía

### Importación (Google Fonts)
Para el cuerpo de texto, usamos **Noto Sans**.
```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Noto+Sans:ital,wght@0,400;0,700;1,400;1,700&display=swap" rel="stylesheet">
```

### Jerarquía
*   **H1 (Título Principal):** `font-family: var(--font-family-headings); color: var(--color-gobmx-guinda);`
*   **H2 (Sección):** `font-family: var(--font-family-headings); color: var(--color-gobmx-guinda); border-bottom: 2px solid var(--color-gobmx-guinda);`
*   **H3 (Subsección):** `font-family: var(--font-family-headings); color: var(--color-gobmx-verde);`
*   **H4 (Sub-subsección):** `font-family: var(--font-family-headings); color: var(--color-gobmx-dorado);`
*   **Párrafos:** `font-family: var(--font-family-body); color: var(--color-text-primary); line-height: 1.6;`

## 3. Elementos UI

### Botones
Estilos sugeridos para botones interactivos.

```css
.btn {
  padding: var(--spacing-xs) var(--spacing-md);
  border-radius: var(--border-radius-sm);
  font-family: var(--font-family-body);
  font-weight: bold;
  cursor: pointer;
  border: none;
  transition: background-color 0.3s;
}

.btn-primary {
  background-color: var(--color-gobmx-guinda);
  color: white;
}

.btn-primary:hover {
  background-color: #7a1b38; /* Guinda más oscuro */
}

.btn-secondary {
  background-color: var(--color-gobmx-verde);
  color: white;
}
```

### Tarjetas y Recuadros (Inspirado en LaTeX)

Estos componentes replican los entornos `recuadro`, `notaimportante`, `definicion` y `ejemplo`.

```css
/* Base para tarjetas */
.card {
  padding: var(--spacing-md);
  border-radius: var(--border-radius-md);
  margin-bottom: var(--spacing-md);
  border-left: 5px solid transparent; /* Borde lateral grueso */
}

/* Nota Importante */
.card-important {
  background-color: var(--color-gobmx-guinda-light);
  border-color: var(--color-gobmx-guinda);
}
.card-important h4 {
  color: var(--color-gobmx-guinda);
  margin-top: 0;
}

/* Definición */
.card-definition {
  background-color: var(--color-gobmx-verde-light);
  border-color: var(--color-gobmx-verde);
}
.card-definition h4 {
  color: var(--color-gobmx-verde);
  margin-top: 0;
}

/* Ejemplo */
.card-example {
  background-color: var(--color-gobmx-dorado-light);
  border-color: var(--color-gobmx-dorado);
}
.card-example h4 {
  color: var(--color-gobmx-dorado);
  margin-top: 0;
}
```

## 4. Listas

*   **Items (ul):** Usar viñetas color Guinda (`var(--color-gobmx-guinda)`).
*   **Enumeraciones (ol):** Números en color Guinda y negritas.

```css
ul li::marker {
  color: var(--color-gobmx-guinda);
}

ol li::marker {
  color: var(--color-gobmx-guinda);
  font-weight: bold;
}
```

## 5. Imágenes y Figuras

Las figuras deben tener un estilo limpio con pies de foto (captions) distintivos.

```css
figure {
  margin: var(--spacing-lg) 0;
  text-align: center;
}

figure img {
  max-width: 100%;
  height: auto;
  border-radius: var(--border-radius-sm);
  box-shadow: var(--box-shadow-card);
}

figcaption {
  margin-top: var(--spacing-xs);
  font-family: var(--font-family-body);
  font-size: var(--font-size-small);
  font-style: italic;
  color: var(--color-text-secondary);
}

figcaption strong {
  color: var(--color-gobmx-guinda); /* Etiqueta "Figura X" en guinda */
  font-style: normal;
}
```

## 6. Layout General

Recomendación para la estructura de la página.

```css
.container {
  max-width: 1200px;
  margin: 0 auto;
  padding: 0 var(--spacing-md);
}

/* Header simple */
header {
  border-bottom: 4px solid var(--color-gobmx-dorado);
  padding: var(--spacing-md) 0;
  margin-bottom: var(--spacing-xl);
}
```
