/**
 * Syntax highlighter for G-Code
 * @class
 */
export class GCodeHighlighter {
    /**
     * Highlight G-Code with syntax coloring
     * @param {string} gcode - G-Code text to highlight
     * @returns {string} HTML string with syntax highlighting
     */
    static highlight(gcode) {
        if (!gcode) return '';

        const lines = gcode.split('\n');
        const highlightedLines = lines.map(line => this._highlightLine(line));
        
        return highlightedLines.join('\n');
    }

    /**
     * Highlight a single line of G-Code
     * @private
     * @param {string} line - Single line of G-Code
     * @returns {string} HTML string with highlighted line
     */
    static _highlightLine(line) {
        const trimmed = line.trim();
        
        // Comment lines (start with ;)
        if (trimmed.startsWith(';')) {
            return `<span class="gcode-comment">${this._escapeHTML(line)}</span>`;
        }

        // Empty lines
        if (trimmed === '') {
            return '';
        }

        // Split line into command and comment
        const [command, ...commentParts] = line.split(';');
        const comment = commentParts.length > 0 ? ';' + commentParts.join(';') : '';

        // Highlight command part
        let highlighted = this._highlightCommand(command);

        // Add comment if exists
        if (comment) {
            highlighted += `<span class="gcode-comment">${this._escapeHTML(comment)}</span>`;
        }

        return highlighted;
    }

    /**
     * Highlight command part of line
     * @private
     * @param {string} command - Command part (before comment)
     * @returns {string} HTML string with highlighted command
     */
    static _highlightCommand(command) {
        // Regex patterns for different elements
        const gCommandPattern = /\b([GM]\d+)\b/g;        // G0, G1, M106, etc.
        const coordinatePattern = /\b([XYZEFIJK])([-+]?\d+\.?\d*)/g; // X10, Y-5.5, etc.
        const feedRatePattern = /\b(F)(\d+\.?\d*)/g;     // F3000
        const speedPattern = /\b(S)(\d+)/g;              // S255
        const paramPattern = /\b([PTULR])(\d+\.?\d*)/g;  // P1, T0, etc.

        let result = command;

        // Highlight G/M commands
        result = result.replace(gCommandPattern, '<span class="gcode-command">$1</span>');

        // Highlight coordinates
        result = result.replace(coordinatePattern, 
            '<span class="gcode-axis">$1</span><span class="gcode-value">$2</span>');

        // Highlight feed rate
        result = result.replace(feedRatePattern, 
            '<span class="gcode-param">$1</span><span class="gcode-value">$2</span>');

        // Highlight speed
        result = result.replace(speedPattern, 
            '<span class="gcode-param">$1</span><span class="gcode-value">$2</span>');

        // Highlight other parameters
        result = result.replace(paramPattern, 
            '<span class="gcode-param">$1</span><span class="gcode-value">$2</span>');

        return result;
    }

    /**
     * Escape HTML special characters
     * @private
     * @param {string} str - String to escape
     * @returns {string} Escaped string
     */
    static _escapeHTML(str) {
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }
}
