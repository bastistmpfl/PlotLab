# Changelog

All notable changes to PlotLab will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2026-02-11

### Initial Release 🎉

PlotLab's first public release - a browser-based SVG to G-Code converter for pen plotting on 3D printers.

#### Features
- **SVG Processing**
  - Full support for complex SVG paths (Bézier curves, arcs, ellipses, circles, rectangles, polylines, polygons)
  - SVG transform support (translate, rotate, scale, matrix)
  - Physical dimension extraction (mm, cm, in units)
  - Automatic path sampling with configurable density

- **Multi-SVG Management**
  - Import and manage multiple SVG files simultaneously
  - Individual transform controls (position, scale, rotation)
  - Per-SVG visibility toggling
  - Color-coded visualization with 8 distinct colors

- **3D Preview**
  - Real-time Three.js-based visualization
  - Orbit controls (pan, zoom, rotate)
  - Coordinate axes and grid display
  - Live preview of transformations

- **Exclusion Zones**
  - Define no-draw areas on print bed
  - Visual zone editor
  - Automatic path collision detection
  - Safety warnings for out-of-bounds paths

- **G-Code Generation**
  - Customizable header/footer templates
  - Token-based template system ({penUpZ}, {feedRate}, etc.)
  - Bambu Lab P1S optimized defaults
  - Sheet thickness compensation
  - Pen offset calculations

- **Preset System**
  - Save and load complete configuration sets
  - localStorage-based persistence
  - Export bed settings, G-Code templates, and exclusion zones

- **Import Dialog**
  - SVG preview with pan/zoom before importing
  - Physical dimension display
  - Responsive canvas rendering

#### Technical
- Pure JavaScript (ES6 modules) - zero build process
- Three.js v0.160.0 for 3D visualization (CDN)
- BEM CSS methodology for maintainable styles
- Comprehensive JSDoc documentation
- MIT License

#### Supported Browsers
- Chrome 61+
- Firefox 60+
- Safari 11+
- Edge 79+

[1.0.0]: https://github.com/yourusername/PlotLab/releases/tag/v1.0.0
