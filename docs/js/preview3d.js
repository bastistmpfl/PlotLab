// 3D Preview using Three.js
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { Line2 } from 'three/examples/jsm/lines/Line2.js';
import { LineMaterial } from 'three/examples/jsm/lines/LineMaterial.js';
import { LineGeometry } from 'three/examples/jsm/lines/LineGeometry.js';

// Constants
const CAMERA_POSITION = { x: -250, y: 300, z: 0 };
const CAMERA_FOV = 50;
const CAMERA_NEAR = 0.1;
const CAMERA_FAR = 2000;
const CAMERA_MIN_DISTANCE = 50;
const CAMERA_MAX_DISTANCE = 800;
const CAMERA_MAX_POLAR_ANGLE = Math.PI / 2;

const GRID_DIVISIONS = 10;
const GRID_COLOR_PRIMARY = 0xeeeeee;
const GRID_COLOR_SECONDARY = 0xe0e0e0;

const AXIS_LENGTH = 50;
const AXIS_LABEL_OFFSET = 10;
const AXIS_LABEL_SIZE = 64;
const AXIS_LABEL_FONT = 'bold 48px Arial';
const AXIS_LABEL_SCALE = 15;
const AXIS_COLOR_X = 0xef4444;
const AXIS_COLOR_Y = 0x22c55e;
const AXIS_COLOR_Z = 0x3b82f6;

const BED_HEIGHT = 0.61;
const BED_OPACITY = 0.35;
const BED_ROUGHNESS = 1;
const BED_METALNESS = 1;
const BED_BORDER_COLOR = 0x2563eb;
const BED_BORDER_HEIGHT = 0.8;

const GRID_HEIGHT = 1.0;
const POLYLINE_HEIGHT = 1.5;
const EXCLUSION_ZONE_HEIGHT = 1.2;
const EXCLUSION_ZONE_BORDER_HEIGHT = 1.25;
const EXCLUSION_ZONE_OPACITY = 0.3;
const EXCLUSION_ZONE_COLOR = 0xff0000;

const SVG_DEFAULT_COLOR = 0x22c55e;
const SVG_SELECTED_COLOR = 0x3b82f6;
const SVG_LINE_WIDTH = 2; // Width in pixels
const SVG_SELECTION_OUTLINE_COLOR = 0xf59e0b;
const SVG_SELECTION_OUTLINE_WIDTH = 2; // Width in pixels
const SVG_SELECTION_OUTLINE_HEIGHT = 1.6;
const SVG_SELECTION_DASH_SIZE = 8;
const SVG_SELECTION_GAP_SIZE = 4;

const SCENE_BACKGROUND_COLOR = 0xf5f5f5;
const AMBIENT_LIGHT_INTENSITY = 0.6;
const DIRECTIONAL_LIGHT_INTENSITY = 0.6;
const DIRECTIONAL_LIGHT_2_INTENSITY = 0.3;

const ORBIT_DAMPING_FACTOR = 0.05;

/**
 * Three.js-based 3D preview for visualizing SVGs, bed, grid, and exclusion zones.
 * @class
 */
export class Preview3D {
    /**
     * Initialize the 3D preview
     * @param {HTMLCanvasElement} container - Canvas element for rendering
     */
    constructor(container) {
        this.container = container;
        this.svgMeshes = new Map();
        this.svgBounds = new Map();
        this.exclusionZoneMeshes = [];
        this.bedWidth = 256;
        this.bedHeight = 256;
        this.selectedId = null;
        this.selectionOutline = null;
        
        this._initScene();
        this._initLights();
        this._initBed();
        this._initAxes();
        this._initControls();
        this._animate();
        
        // Handle window resize
        window.addEventListener('resize', () => this._onResize());
    }

    /**
     * Initialize the Three.js scene, camera, and renderer
     * @private
     */
    _initScene() {
        // Scene
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(SCENE_BACKGROUND_COLOR);
        
        // Camera
        this.camera = new THREE.PerspectiveCamera(
            CAMERA_FOV,
            this.container.clientWidth / this.container.clientHeight,
            CAMERA_NEAR,
            CAMERA_FAR
        );
        this.camera.position.set(CAMERA_POSITION.x, CAMERA_POSITION.y, CAMERA_POSITION.z);
        this.camera.lookAt(0, 0, 0);
        
        // Renderer
        this.renderer = new THREE.WebGLRenderer({ 
            canvas: this.container,
            antialias: true 
        });
        this.renderer.setSize(this.container.clientWidth, this.container.clientHeight);
        this.renderer.setPixelRatio(window.devicePixelRatio);
    }

    /**
     * Initialize scene lighting
     * @private
     */
    _initLights() {
        // Ambient light
        const ambientLight = new THREE.AmbientLight(0xffffff, AMBIENT_LIGHT_INTENSITY);
        this.scene.add(ambientLight);
        
        // Directional light
        const directionalLight = new THREE.DirectionalLight(0xffffff, DIRECTIONAL_LIGHT_INTENSITY);
        directionalLight.position.set(100, -100, 200);
        this.scene.add(directionalLight);
        
        const directionalLight2 = new THREE.DirectionalLight(0xffffff, DIRECTIONAL_LIGHT_2_INTENSITY);
        directionalLight2.position.set(-100, 100, 100);
        this.scene.add(directionalLight2);
    }

    /**
     * Initialize the bed surface, grid, and border
     * @private
     */
    _initBed() {
        // Create bed group
        this.bedGroup = new THREE.Group();
        
        // Bed surface
        const bedGeometry = new THREE.PlaneGeometry(this.bedWidth, this.bedHeight);
        const bedMaterial = new THREE.MeshStandardMaterial({ 
            color: 0xffffff,
            roughness: BED_ROUGHNESS,
            metalness: BED_METALNESS,
            transparent: true,
            opacity: BED_OPACITY
        });
        this.bedMesh = new THREE.Mesh(bedGeometry, bedMaterial);
        this.bedMesh.rotation.x = -Math.PI / 2;
        this.bedMesh.position.y = BED_HEIGHT;
        this.bedGroup.add(this.bedMesh);
        
        // Grid
        const gridHelper = new THREE.GridHelper(
            Math.max(this.bedWidth, this.bedHeight),
            GRID_DIVISIONS,
            GRID_COLOR_PRIMARY,
            GRID_COLOR_SECONDARY
        );
        gridHelper.position.y = GRID_HEIGHT;
        this.bedGroup.add(gridHelper);
        
        // Bed border
        const borderGeometry = new THREE.EdgesGeometry(bedGeometry);
        const borderMaterial = new THREE.LineBasicMaterial({ color: BED_BORDER_COLOR, linewidth: SVG_LINE_WIDTH });
        const border = new THREE.LineSegments(borderGeometry, borderMaterial);
        border.rotation.x = -Math.PI / 2;
        border.position.y = BED_BORDER_HEIGHT;
        this.bedGroup.add(border);
        
        this.scene.add(this.bedGroup);
    }

    /**
     * Initialize coordinate system axes at origin (bottom-left corner of bed)
     * @private
     */
    _initAxes() {
        // Create coordinate system axes at origin (bottom-left corner of bed)
        // Red = X, Green = Y, Blue = Z
        const axesGroup = new THREE.Group();
        const originX = -this.bedWidth / 2;
        const originZ = -this.bedHeight / 2;
        
        // X-Axis (Red) - horizontal nach rechts
        const xGeometry = new THREE.BufferGeometry().setFromPoints([
            new THREE.Vector3(0, 0, 0),
            new THREE.Vector3(AXIS_LENGTH, 0, 0)
        ]);
        const xMaterial = new THREE.LineBasicMaterial({ color: AXIS_COLOR_X, linewidth: 3 });
        const xAxis = new THREE.Line(xGeometry, xMaterial);
        axesGroup.add(xAxis);
        
        // Y-Axis (Green) - horizontal nach vorne
        const yGeometry = new THREE.BufferGeometry().setFromPoints([
            new THREE.Vector3(0, 0, 0),
            new THREE.Vector3(0, 0, AXIS_LENGTH)
        ]);
        const yMaterial = new THREE.LineBasicMaterial({ color: AXIS_COLOR_Y, linewidth: 3 });
        const yAxis = new THREE.Line(yGeometry, yMaterial);
        axesGroup.add(yAxis);
        
        // Z-Axis (Blue) - vertikal nach oben
        const zGeometry = new THREE.BufferGeometry().setFromPoints([
            new THREE.Vector3(0, 0, 0),
            new THREE.Vector3(0, AXIS_LENGTH, 0)
        ]);
        const zMaterial = new THREE.LineBasicMaterial({ color: AXIS_COLOR_Z, linewidth: 3 });
        const zAxis = new THREE.Line(zGeometry, zMaterial);
        axesGroup.add(zAxis);
        
        // Position axes group at bed origin (bottom-left corner)
        axesGroup.position.set(originX, 0, originZ);
        this.scene.add(axesGroup);
        
        // Add labels for axes
        this.scene.add(this._createAxisLabel('X', new THREE.Vector3(originX + AXIS_LENGTH + AXIS_LABEL_OFFSET, 0, originZ), '#ef4444'));
        this.scene.add(this._createAxisLabel('Y', new THREE.Vector3(originX, 0, originZ + AXIS_LENGTH + AXIS_LABEL_OFFSET), '#22c55e'));
        this.scene.add(this._createAxisLabel('Z', new THREE.Vector3(originX, AXIS_LENGTH + AXIS_LABEL_OFFSET, originZ), '#3b82f6'));
    }

    /**
     * Create a text sprite for axis labels
     * @private
     * @param {string} text - Label text
     * @param {THREE.Vector3} position - Position in 3D space
     * @param {string} color - CSS color string
     * @returns {THREE.Sprite} Text sprite
     */
    _createAxisLabel(text, position, color) {
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        canvas.width = AXIS_LABEL_SIZE;
        canvas.height = AXIS_LABEL_SIZE;
        context.clearRect(0, 0, canvas.width, canvas.height);
        context.fillStyle = color;
        context.font = AXIS_LABEL_FONT;
        context.textAlign = 'center';
        context.textBaseline = 'middle';
        context.fillText(text, AXIS_LABEL_SIZE / 2, AXIS_LABEL_SIZE / 2);
        
        const texture = new THREE.CanvasTexture(canvas);
        const spriteMaterial = new THREE.SpriteMaterial({ 
            map: texture,
            transparent: true,
            alphaTest: 0.1
        });
        const sprite = new THREE.Sprite(spriteMaterial);
        sprite.position.copy(position);
        sprite.scale.set(AXIS_LABEL_SCALE, AXIS_LABEL_SCALE, 1);
        return sprite;
    }

    /**
     * Initialize orbit controls for camera manipulation
     * @private
     */
    _initControls() {
        this.controls = new OrbitControls(this.camera, this.renderer.domElement);
        this.controls.enableDamping = false;
        this.controls.dampingFactor = ORBIT_DAMPING_FACTOR;
        this.controls.minDistance = CAMERA_MIN_DISTANCE;
        this.controls.maxDistance = CAMERA_MAX_DISTANCE;
        this.controls.maxPolarAngle = CAMERA_MAX_POLAR_ANGLE;
    }

    /**
     * Animation loop for rendering
     * @private
     */
    _animate() {
        requestAnimationFrame(() => this._animate());
        this.controls.update();
        this.renderer.render(this.scene, this.camera);
    }

    /**
     * Handle window resize events
     * @private
     */
    _onResize() {
        const width = this.container.clientWidth;
        const height = this.container.clientHeight;
        
        this.camera.aspect = width / height;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(width, height);
        
        // Update resolution for all Line2 materials
        const resolution = new THREE.Vector2(width, height);
        
        // Update SVG line materials
        this.svgMeshes.forEach(group => {
            group.traverse(obj => {
                if (obj.material && obj.material.resolution) {
                    obj.material.resolution.set(width, height);
                }
            });
        });
        
        // Update selection outline material
        if (this.selectionOutline && this.selectionOutline.material && this.selectionOutline.material.resolution) {
            this.selectionOutline.material.resolution.set(width, height);
        }
    }

    /**
     * Transform bed-space coordinates to Three.js world coordinates (centered)
     * @private
     * @param {number} x - X coordinate in bed space
     * @param {number} y - Y coordinate in bed space
     * @returns {{x: number, y: number}} Centered Three.js coordinates
     */
    _transformToThreeCoords(x, y) {
        return {
            x: x - this.bedWidth / 2,
            y: y - this.bedHeight / 2
        };
    }

    /**
     * Add SVG polylines to the 3D scene
     * @param {string} id - Unique identifier for the SVG
     * @param {Array<Array<[number, number]>>} polylines - Array of polylines
     * @param {number} color - Three.js color (hex)
     */
    addSVG(id, polylines, color = SVG_DEFAULT_COLOR) {
        // Remove existing mesh if any
        this._removeSVGMesh(id, true);
        
        // Create group for this SVG
        const group = new THREE.Group();
        
        // Create lines for each polyline
        polylines.forEach(polyline => {
            if (polyline.length < 2) return;
            
            // Transform coordinates for Three.js coordinate system:
            // - Bed is in XZ plane (rotated -90° around X axis)
            // - X axis: left/right (horizontal)
            // - Y axis: up/down (height above bed)
            // - Z axis: front/back (depth)
            const points = polyline.map(([x, y]) => {
                const coords = this._transformToThreeCoords(x, y);
                // Y is the height above the bed
                return new THREE.Vector3(coords.x, POLYLINE_HEIGHT, coords.y);
            });
            
            // Create positions array for LineGeometry (x,y,z,x,y,z,...)
            const positions = [];
            points.forEach(p => {
                positions.push(p.x, p.y, p.z);
            });
            
            const geometry = new LineGeometry();
            geometry.setPositions(positions);
            
            const material = new LineMaterial({ 
                color: color,
                linewidth: SVG_LINE_WIDTH, // LineWidth is in pixels
                transparent: false,
                opacity: 1.0,
                resolution: new THREE.Vector2(this.container.clientWidth, this.container.clientHeight),
                dashed: false
            });
            
            const line = new Line2(geometry, material);
            group.add(line);
        });
        
        this.svgMeshes.set(id, group);
        this.svgBounds.set(id, this._calculateBounds(polylines));
        this.scene.add(group);

        if (this.selectedId === id) {
            this._updateSelectionOutline(id);
        }
    }

    /**
     * Remove SVG from the scene and dispose resources
     * @param {string} id - SVG identifier
     */
    removeSVG(id) {
        this._removeSVGMesh(id, false);
    }

    /**
     * Remove SVG mesh and clean resources
     * @private
     * @param {string} id - SVG identifier
     * @param {boolean} preserveSelection - Keep selection state if true
     */
    _removeSVGMesh(id, preserveSelection) {
        const group = this.svgMeshes.get(id);
        if (group) {
            this.scene.remove(group);
            group.traverse(obj => {
                if (obj.geometry) obj.geometry.dispose();
                if (obj.material) obj.material.dispose();
            });
            this.svgMeshes.delete(id);
        }

        this.svgBounds.delete(id);

        if (this.selectedId === id) {
            if (!preserveSelection) {
                this.selectedId = null;
            }
            this._clearSelectionOutline();
        }
    }

    /**
     * Update SVG in the scene (replaces existing)
     * @param {string} id - SVG identifier
     * @param {Array<Array<[number, number]>>} polylines - Array of polylines
     * @param {number} color - Three.js color (hex)
     */
    updateSVG(id, polylines, color = SVG_DEFAULT_COLOR) {
        this.addSVG(id, polylines, color);
        if (this.selectedId) {
            this.selectSVG(this.selectedId);
        }
    }

    /**
     * Highlight a specific SVG by changing its color
     * @param {string} id - SVG identifier to select
     */
    selectSVG(id) {
        this.selectedId = id;

        // Highlight selected SVG
        this.svgMeshes.forEach((group, svgId) => {
            group.traverse(obj => {
                if (obj.material) {
                    obj.material.color.setHex(svgId === id ? SVG_SELECTED_COLOR : SVG_DEFAULT_COLOR);
                }
            });
        });

        this._updateSelectionOutline(id);
    }

    /**
     * Update selection outline to match current SVG bounds
     * @private
     * @param {string|null} id - SVG identifier
     */
    _updateSelectionOutline(id) {
        this._clearSelectionOutline();

        const bounds = id ? this.svgBounds.get(id) : null;
        if (!bounds || bounds.width <= 0 || bounds.height <= 0) {
            return;
        }

        const corners = [
            [bounds.minX, bounds.minY],
            [bounds.maxX, bounds.minY],
            [bounds.maxX, bounds.maxY],
            [bounds.minX, bounds.maxY]
        ];

        const points = corners.map(([x, y]) => {
            const coords = this._transformToThreeCoords(x, y);
            return new THREE.Vector3(coords.x, SVG_SELECTION_OUTLINE_HEIGHT, coords.y);
        });
        // Add first point again to close the loop
        points.push(points[0].clone());

        // Create positions array for LineGeometry
        const positions = [];
        points.forEach(p => {
            positions.push(p.x, p.y, p.z);
        });

        const geometry = new LineGeometry();
        geometry.setPositions(positions);
        
        const material = new LineMaterial({
            color: SVG_SELECTION_OUTLINE_COLOR,
            linewidth: SVG_SELECTION_OUTLINE_WIDTH, // LineWidth is in pixels
            dashed: true,
            dashScale: 1,
            dashSize: SVG_SELECTION_DASH_SIZE,
            gapSize: SVG_SELECTION_GAP_SIZE,
            transparent: false,
            opacity: 1.0,
            resolution: new THREE.Vector2(this.container.clientWidth, this.container.clientHeight)
        });
        
        const line = new Line2(geometry, material);
        line.computeLineDistances(); // Required for dashed lines

        this.selectionOutline = line;
        this.scene.add(line);
    }

    /**
     * Remove selection outline
     * @private
     */
    _clearSelectionOutline() {
        if (!this.selectionOutline) return;
        this.scene.remove(this.selectionOutline);
        if (this.selectionOutline.geometry) this.selectionOutline.geometry.dispose();
        if (this.selectionOutline.material) this.selectionOutline.material.dispose();
        this.selectionOutline = null;
    }

    /**
     * Calculate bounds for an array of polylines
     * @private
     * @param {Array<Array<[number, number]>>} polylines
     * @returns {{minX:number, minY:number, maxX:number, maxY:number, width:number, height:number}}
     */
    _calculateBounds(polylines) {
        let minX = Infinity;
        let minY = Infinity;
        let maxX = -Infinity;
        let maxY = -Infinity;

        polylines.forEach(polyline => {
            polyline.forEach(([x, y]) => {
                if (!Number.isFinite(x) || !Number.isFinite(y)) return;
                minX = Math.min(minX, x);
                minY = Math.min(minY, y);
                maxX = Math.max(maxX, x);
                maxY = Math.max(maxY, y);
            });
        });

        if (minX === Infinity) {
            return { minX: 0, minY: 0, maxX: 0, maxY: 0, width: 0, height: 0 };
        }

        return {
            minX,
            minY,
            maxX,
            maxY,
            width: maxX - minX,
            height: maxY - minY
        };
    }

    /**
     * Set the bed dimensions and recreate the bed mesh
     * @param {number} width - Bed width in mm
     * @param {number} height - Bed height in mm
     */
    setBedSize(width, height) {
        this.bedWidth = width;
        this.bedHeight = height;
        
        // Remove old bed
        this.scene.remove(this.bedGroup);
        
        // Create new bed
        this._initBed();
    }

    /**
     * Reset camera to default position
     */
    resetCamera() {
        this.camera.position.set(CAMERA_POSITION.x, CAMERA_POSITION.y, CAMERA_POSITION.z);
        this.camera.lookAt(0, 0, 0);
        this.controls.target.set(0, 0, 0);
        this.controls.update();
    }

    /**
     * Toggle grid visibility
     */
    toggleGrid() {
        this.bedGroup.visible = !this.bedGroup.visible;
    }

    /**
     * Update exclusion zones on the bed
     * @param {Array<{name: string, x: number, y: number, width: number, height: number, enabled: boolean}>} zones
     */
    updateExclusionZones(zones) {
        // CLEANUP: Dispose old zone meshes properly to prevent memory leaks
        this.exclusionZoneMeshes.forEach(mesh => {
            this.scene.remove(mesh);
            if (mesh.geometry) mesh.geometry.dispose();
            if (mesh.material) {
                if (Array.isArray(mesh.material)) {
                    mesh.material.forEach(mat => mat.dispose());
                } else {
                    mesh.material.dispose();
                }
            }
        });
        this.exclusionZoneMeshes = [];
        
        // Add new zone meshes
        zones.forEach(zone => {
            if (!zone.enabled) return;
            
            // Create semi-transparent red box
            const geometry = new THREE.PlaneGeometry(zone.width, zone.height);
            const material = new THREE.MeshBasicMaterial({ 
                color: EXCLUSION_ZONE_COLOR,
                transparent: true,
                opacity: EXCLUSION_ZONE_OPACITY,
                side: THREE.DoubleSide
            });
            const mesh = new THREE.Mesh(geometry, material);
            
            // Position on bed (XZ plane, Y is height)
            const centerCoords = this._transformToThreeCoords(
                zone.x + zone.width / 2,
                zone.y + zone.height / 2
            );
            mesh.rotation.x = -Math.PI / 2;
            mesh.position.set(centerCoords.x, EXCLUSION_ZONE_HEIGHT, centerCoords.y);
            
            this.scene.add(mesh);
            this.exclusionZoneMeshes.push(mesh);
            
            // Add border
            const borderGeometry = new THREE.EdgesGeometry(geometry);
            const borderMaterial = new THREE.LineBasicMaterial({ 
                color: EXCLUSION_ZONE_COLOR, 
                linewidth: SVG_LINE_WIDTH 
            });
            const border = new THREE.LineSegments(borderGeometry, borderMaterial);
            border.rotation.x = -Math.PI / 2;
            border.position.set(centerCoords.x, EXCLUSION_ZONE_BORDER_HEIGHT, centerCoords.y);
            
            this.scene.add(border);
            this.exclusionZoneMeshes.push(border);
        });
    }

    // ========================================
    // COLLISION DETECTION
    // ========================================

    /**
     * Check for collisions and highlight problem areas
     * @param {Array<Array<[number, number]>>} polylines - Polylines to check
     * @param {Object} settings - Settings object with bed dimensions
     * @param {Array<Object>} exclusionZones - Exclusion zones
     * @returns {Object} Collision data { hasCollisions, outOfBounds, zoneCollisions, total }
     */
    checkCollisions(polylines, settings, exclusionZones = []) {
        // Clear previous collision markers
        this._clearCollisionMarkers();

        const bedWidth = parseFloat(settings.bedWidth) || 256;
        const bedHeight = parseFloat(settings.bedHeight) || 256;
        const offsetX = parseFloat(settings.penOffsetX) || 0;
        const offsetY = parseFloat(settings.penOffsetY) || 0;

        const outOfBoundsPoints = [];
        const zoneCollisionPoints = [];

        // Check each point
        polylines.forEach((polyline, polyIdx) => {
            polyline.forEach((point, pointIdx) => {
                const x = point[0] + offsetX;
                const y = point[1] + offsetY;

                // Check bounds
                if (x < 0 || y < 0 || x > bedWidth || y > bedHeight) {
                    outOfBoundsPoints.push({ x, y, polyIdx, pointIdx });
                }

                // Check exclusion zones
                exclusionZones.forEach(zone => {
                    if (this._isPointInZone(x, y, zone)) {
                        zoneCollisionPoints.push({ x, y, polyIdx, pointIdx });
                    }
                });
            });
        });

        // Visualize collisions
        outOfBoundsPoints.forEach(p => {
            this._addCollisionMarker(p.x, p.y, 0xff0000); // Red for out of bounds
        });

        zoneCollisionPoints.forEach(p => {
            this._addCollisionMarker(p.x, p.y, 0xff8800); // Orange for zone collisions
        });

        const hasCollisions = outOfBoundsPoints.length > 0 || zoneCollisionPoints.length > 0;

        return {
            hasCollisions,
            outOfBounds: outOfBoundsPoints.length,
            zoneCollisions: zoneCollisionPoints.length,
            total: outOfBoundsPoints.length + zoneCollisionPoints.length
        };
    }

    /**
     * Check if point is inside exclusion zone
     * @private
     */
    _isPointInZone(x, y, zone) {
        return x >= zone.x && 
               x <= (zone.x + zone.width) && 
               y >= zone.y && 
               y <= (zone.y + zone.height);
    }

    /**
     * Add visual marker for collision point
     * @private
     */
    _addCollisionMarker(x, y, color) {
        if (!this.collisionMarkers) {
            this.collisionMarkers = [];
        }

        const coords = this._transformToThreeCoords(x, y);
        const geometry = new THREE.SphereGeometry(1.5, 16, 16);
        const material = new THREE.MeshBasicMaterial({ 
            color,
            transparent: true,
            opacity: 0.8
        });
        const marker = new THREE.Mesh(geometry, material);
        marker.position.set(coords.x, 5, coords.y); // Elevated for visibility
        
        this.scene.add(marker);
        this.collisionMarkers.push(marker);
    }

    /**
     * Clear all collision markers
     * @private
     */
    _clearCollisionMarkers() {
        if (this.collisionMarkers) {
            this.collisionMarkers.forEach(marker => {
                this.scene.remove(marker);
                marker.geometry.dispose();
                marker.material.dispose();
            });
            this.collisionMarkers = [];
        }
    }
}
