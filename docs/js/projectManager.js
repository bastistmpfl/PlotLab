/**
 * Project Manager
 * Handles saving and loading complete PlotLab projects
 */
export class ProjectManager {
    constructor(svgManager, exclusionZones, settings) {
        this.svgManager = svgManager;
        this.exclusionZones = exclusionZones;
        this.settings = settings;
        this.projectVersion = '1.0.0';
    }

    /**
     * Create project data object
     * @param {string} name - Project name
     * @returns {Object} Project data
     */
    createProject(name) {
        const svgs = Array.from(this.svgManager.svgObjects.values()).map(svg => ({
            id: svg.id,
            filename: svg.filename,
            svgContent: svg.metadata.originalSVG || '', // Store original SVG
            polylines: svg.polylines,
            originalBounds: svg.originalBounds,
            centerViewBox: svg.centerViewBox,
            translation: svg.translation,
            scale: svg.scale,
            rotation: svg.rotation,
            visible: svg.visible,
            penColor: svg.penColor,
            hatchingEnabled: svg.hatchingEnabled,
            hatchingSettings: svg.hatchingSettings,
            metadata: svg.metadata
        }));

        return {
            version: this.projectVersion,
            name,
            timestamp: new Date().toISOString(),
            settings: this.settings,
            svgs,
            exclusionZones: this.exclusionZones.getAllZones()
        };
    }

    /**
     * Save project to localStorage
     * @param {string} name - Project name
     */
    saveProject(name) {
        const projects = this.getAllProjects();
        const projectData = this.createProject(name);
        
        // Store in localStorage
        projects[name] = projectData;
        localStorage.setItem('plotlab_projects', JSON.stringify(projects));
        
        return projectData;
    }

    /**
     * Load project from localStorage
     * @param {string} name - Project name
     * @returns {Object|null} Project data or null if not found
     */
    loadProject(name) {
        const projects = this.getAllProjects();
        return projects[name] || null;
    }

    /**
     * Get all saved projects
     * @returns {Object} Map of project names to project data
     */
    getAllProjects() {
        const stored = localStorage.getItem('plotlab_projects');
        return stored ? JSON.parse(stored) : {};
    }

    /**
     * Delete project from localStorage
     * @param {string} name - Project name
     */
    deleteProject(name) {
        const projects = this.getAllProjects();
        delete projects[name];
        localStorage.setItem('plotlab_projects', JSON.stringify(projects));
    }

    /**
     * Export project to JSON file
     * @param {string} name - Project name
     */
    exportToFile(name) {
        const projectData = this.createProject(name);
        const json = JSON.stringify(projectData, null, 2);
        
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${name}.plotlab.json`;
        a.click();
        URL.revokeObjectURL(url);
    }

    /**
     * Import project from JSON file
     * @param {File} file - JSON file
     * @returns {Promise<Object>} Project data
     */
    async importFromFile(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            
            reader.onload = (e) => {
                try {
                    const projectData = JSON.parse(e.target.result);
                    
                    // Validate project structure
                    if (!projectData.version || !projectData.svgs) {
                        throw new Error('Invalid project file format');
                    }
                    
                    resolve(projectData);
                } catch (error) {
                    reject(new Error('Failed to parse project file: ' + error.message));
                }
            };
            
            reader.onerror = () => reject(new Error('Failed to read file'));
            reader.readAsText(file);
        });
    }

    /**
     * Apply project data to app state
     * @param {Object} projectData - Project data to apply
     * @param {Function} svgManagerClearCallback - Callback to clear SVG manager
     * @param {Function} exclusionZonesClearCallback - Callback to clear exclusion zones
     * @param {Function} settingsApplyCallback - Callback to apply settings
     */
    applyProject(projectData, svgManagerClearCallback, exclusionZonesClearCallback, settingsApplyCallback) {
        // Clear current state
        svgManagerClearCallback();
        exclusionZonesClearCallback();
        
        // Apply settings
        settingsApplyCallback(projectData.settings);
        
        // Restore SVGs
        const svgPromises = projectData.svgs.map(svg => {
            return new Promise((resolve) => {
                // Re-add SVG to manager
                const id = this.svgManager.addSVG(
                    svg.filename,
                    svg.polylines,
                    svg.originalBounds,
                    svg.scale,
                    svg.metadata
                );
                
                // Restore properties
                const svgObj = this.svgManager.svgObjects.get(id);
                if (svgObj) {
                    svgObj.translation = svg.translation;
                    svgObj.rotation = svg.rotation;
                    svgObj.visible = svg.visible;
                    svgObj.penColor = svg.penColor;
                    svgObj.hatchingEnabled = svg.hatchingEnabled;
                    svgObj.hatchingSettings = svg.hatchingSettings;
                }
                
                resolve({ id, svg });
            });
        });
        
        // Restore exclusion zones
        projectData.exclusionZones?.forEach(zone => {
            this.exclusionZones.addZone(zone.name, zone.x, zone.y, zone.width, zone.height);
        });
        
        return Promise.all(svgPromises);
    }
}
