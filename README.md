# PlotLab

A browser-based SVG to G-Code converter specifically designed for pen plotting on 3D printers, with optimized support for Bambu Lab P1S and similar machines.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![GitHub Pages](https://img.shields.io/badge/demo-live-success)](https://bastistmpfl.github.io/PlotLab/)

## ✨ Features

### Core Functionality
- **📁 SVG Import & Processing**: Full support for complex SVG paths including:
  - Bézier curves (cubic and quadratic)
  - Arcs, ellipses, and circles
  - Rectangles, polylines, and polygons
  - SVG transforms (translate, rotate, scale, matrix)
  - Physical dimension extraction (mm, cm, in units)

- **🎨 Multi-SVG Management**: Import and manage multiple SVG files simultaneously
  - Individual transform controls (position, scale, rotation)
  - Per-SVG visibility toggling
  - Color-coded visualization with 8 distinct colors
  - Layer-based organization

- **📐 Interactive 3D Preview**: Real-time Three.js-based visualization
  - Orbit controls (pan, zoom, rotate view)
  - Coordinate axes and grid
  - Bed dimensions display
  - Live preview of all transformations

- **🚫 Exclusion Zones**: Define no-draw areas on the print bed
  - Visual zone editor
  - Automatic path collision detection
  - Safety warnings for out-of-bounds paths

- **⚙️ Preset System**: Save and load complete configuration sets
  - Bed dimensions and pen parameters
  - G-Code templates
  - Exclusion zones
  - Stored locally in browser

- **🔧 G-Code Generation**: Customizable output with template system
  - Token-based header/footer templates
  - Configurable pen heights, feed rates, offsets
  - Bambu Lab P1S optimized defaults
  - Support for sheet thickness compensation

### Advanced Features
- **Import Dialog**: Preview SVG with pan/zoom before importing
- **Transform Controls**: Precise positioning with X/Y coordinates, scale factor, and rotation angle
- **Dimension-Aware**: Automatically reads SVG physical dimensions for accurate scaling
- **Real-Time Validation**: Live warnings for paths outside print bed boundaries

## 🚀 Quick Start

### Online (Recommended)
Visit the live demo: [PlotLab on GitHub Pages](https://bastistmpfl.github.io/PlotLab/)

### Local Development
1. Clone the repository:
   ```bash
   git clone https://github.com/bastistmpfl/PlotLab.git
   cd PlotLab
   ```

2. Serve the application (any static file server works):
   ```bash
   # Python 3
   python -m http.server 8000 --directory src
   
   # Node.js (with npx)
   npx serve src
   
   # PHP
   php -S localhost:8000 -t src
   ```

3. Open your browser to `http://localhost:8000`

## 📖 Usage

### Basic Workflow

1. **Configure Print Bed**
   - Set bed dimensions (default: 256×256mm for Bambu Lab P1S)
   - Adjust pen parameters:
     - Pen up/down Z heights
     - Sheet thickness
     - Pen offset (nozzle center to pen tip)
     - Feed rates for drawing and travel

2. **Import SVG File(s)**
   - Click "Import SVG" button
   - Preview appears with pan/zoom controls
   - Click "Import" to add to workspace
   - Repeat for multiple SVGs

3. **Transform SVGs**
   - Use X/Y position controls to place SVG
   - Adjust scale factor (1.0 = original size)
   - Rotate if needed (-180° to 180°)
   - Toggle visibility to focus on specific layers

4. **Define Exclusion Zones** (Optional)
   - Click "Add Exclusion Zone"
   - Set position and dimensions
   - Zones appear as red rectangles in preview
   - Automatic collision warnings

5. **Generate G-Code**
   - Review warnings if any paths are out of bounds
   - Click "Generate G-Code"
   - Review output in text area
   - Click "Download G-Code" to save `.gcode` file

6. **Save Configuration** (Optional)
   - Click "Save Preset"
   - Name your configuration
   - Load presets anytime from dropdown

### G-Code Template Tokens

Customize header/footer templates with these tokens:
- `{penUpZ}` - Pen up Z position
- `{nozzleUpZ}` - Nozzle Z position for travel
- `{sheetHeight}` - Sheet thickness
- `{feedRate}` - Drawing feed rate
- `{travelFeedRate}` - Travel move feed rate
- `{offsetX}`, `{offsetY}`, `{offsetZ}` - Pen offset values
- `{bedWidth}`, `{bedHeight}` - Bed dimensions
- `{timestamp}` - Current date/time

## 🖨️ Hardware Compatibility

### Primary Target: Bambu Lab P1S
PlotLab is optimized for the Bambu Lab P1S 3D printer with pen adapter attachment. Default G-Code includes:
- Bambu-specific commands (`M106` for fans, `M400 U1` for user interaction)
- 256×256mm bed size preset
- Manual intervention prompts for pen attachment/removal

### Other 3D Printers
PlotLab is adaptable to any 3D printer that accepts G-Code:
- Adjust bed dimensions in settings
- Modify G-Code templates to match your printer's dialect
- Remove or adjust Bambu-specific commands
- Test with small plots first

### Requirements
- Pen attachment or adapter for your 3D printer
- Proper pen offset calibration
- Z-height adjustment for pen up/down positions

## 💻 Technical Details

### Technology Stack
- **Pure JavaScript** (ES6 modules) - No build system required
- **Three.js v0.160.0** - 3D visualization (via CDN)
- **HTML5 Canvas** - SVG import preview
- **CSS Custom Properties** - Theme system
- **localStorage API** - Preset persistence

### Browser Requirements
- Modern browser with ES6 module support (Chrome 61+, Firefox 60+, Safari 11+, Edge 79+)
- WebGL support for 3D preview
- Import Maps support
- localStorage enabled

### Architecture
Modular design with 8 main components:
- `app.js` - Application orchestrator and UI controller
- `svgProcessor.js` - SVG parsing and path processing (1575 lines)
- `gcodeGenerator.js` - G-Code generation with template system
- `svgManager.js` - Multi-SVG object management
- `preview3d.js` - Three.js 3D visualization
- `importDialog.js` - SVG import preview dialog
- `exclusionZones.js` - Exclusion zone management
- `presetManager.js` - Settings preset system

### SVG Support
**Supported Elements:**
- `<path>` - All path commands (M, L, H, V, C, S, Q, T, A, Z)
- `<line>`, `<polyline>`, `<polygon>`
- `<circle>`, `<ellipse>`, `<rect>`

**Supported Transforms:**
- `translate()`, `scale()`, `rotate()`, `matrix()`

**Supported Units:**
- mm, cm, in, pt, pc, px

**Not Supported:**
- Text elements (convert to paths in your SVG editor first)
- Gradients, patterns, filters
- CSS-defined styles (use inline attributes)

## 🛠️ Development

### Project Structure
```
PlotLab/
├── src/                    # Source files
│   ├── index.html         # Main application page
│   ├── css/
│   │   ├── styles.css     # Main stylesheet (BEM convention)
│   │   └── import-dialog.css
│   └── js/
│       ├── app.js
│       ├── svgProcessor.js
│       ├── gcodeGenerator.js
│       ├── svgManager.js
│       ├── preview3d.js
│       ├── importDialog.js
│       ├── exclusionZones.js
│       └── presetManager.js
├── docs/                  # GitHub Pages deployment (copy of src/)
├── .github/
│   └── workflows/
│       └── deploy.yml     # Automated GitHub Pages deployment
├── LICENSE                # MIT License
├── README.md
└── CHANGELOG.md
```

### Code Quality
- **JSDoc documentation** for all public methods
- **Modular ES6 architecture** with clear separation of concerns
- **BEM CSS methodology** for maintainable styles
- **No external dependencies** (except Three.js via CDN)
- **Zero build process** - runs directly in browser

### Contributing
Contributions are welcome! Areas for improvement:
- Path optimization algorithms (e.g., traveling salesman for efficient plotting)
- Additional 3D printer profiles
- SVG editing capabilities
- Undo/redo functionality
- Export/import for presets
- Additional G-Code dialects

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- **Three.js** - 3D visualization library
- **Bambu Lab** - Inspiration and primary hardware target
- SVG specification and path parsing algorithms

## 📧 Contact & Support

- 🐛 **Issues**: [GitHub Issues](https://github.com/bastistmpfl/PlotLab/issues)
- 💡 **Feature Requests**: [GitHub Discussions](https://github.com/bastistmpfl/PlotLab/discussions)

---

**Note**: PlotLab is a hobby project and is provided as-is. Always test generated G-Code with small plots first and monitor your printer during operation.
