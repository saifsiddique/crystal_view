// readciffile.js - Crystallographic Information File Parser

class CIFReader {
    constructor() {
        this.cellParams = {};
        this.cifData = {};
    }

    /**
     * Parse CIF file content and extract cell parameters
     * @param {string} content - Raw CIF file content
     * @returns {Object} - Object containing cell parameters (a, b, c, alpha, beta, gamma)
     */
    parseCIFFile(content) {
        const lines = content.split('\n');
        const params = {
            a: null,
            b: null, 
            c: null,
            alpha: null,
            beta: null,
            gamma: null
        };

        // Define CIF parameter patterns with optional error values
        const patterns = {
            a: /_cell_length_a\s+([\d.]+)(?:\(\d+\))?/,
            b: /_cell_length_b\s+([\d.]+)(?:\(\d+\))?/,
            c: /_cell_length_c\s+([\d.]+)(?:\(\d+\))?/,
            alpha: /_cell_angle_alpha\s+([\d.]+)(?:\(\d+\))?/,
            beta: /_cell_angle_beta\s+([\d.]+)(?:\(\d+\))?/,
            gamma: /_cell_angle_gamma\s+([\d.]+)(?:\(\d+\))?/
        };

        // Parse each line for cell parameters
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            
            // Skip empty lines and comments
            if (!line || line.startsWith('#')) continue;
            
            // Check each parameter pattern
            for (const [param, pattern] of Object.entries(patterns)) {
                const match = line.match(pattern);
                if (match) {
                    params[param] = parseFloat(match[1]);
                    console.log(`Found ${param}: ${params[param]}`);
                }
            }
        }

        // Validate that all required parameters were found
        const missingParams = Object.entries(params)
            .filter(([key, value]) => value === null)
            .map(([key]) => key);

        if (missingParams.length > 0) {
            throw new Error(`Missing cell parameters in CIF file: ${missingParams.join(', ')}`);
        }

        // Validate parameter ranges
        this.validateCellParameters(params);

        this.cellParams = params;
        return params;
    }

    /**
     * Validate cell parameters are within reasonable ranges
     * @param {Object} params - Cell parameters object
     */
    validateCellParameters(params) {
        // Check lattice parameters are positive
        if (params.a <= 0 || params.b <= 0 || params.c <= 0) {
            throw new Error('Lattice parameters (a, b, c) must be positive values');
        }

        // Check angles are within valid range (0° < angle < 180°)
        const angles = [params.alpha, params.beta, params.gamma];
        for (const angle of angles) {
            if (angle <= 0 || angle >= 180) {
                throw new Error(`Cell angles must be between 0° and 180°, found: ${angle}°`);
            }
        }

        // Check for reasonable lattice parameter values (typically 1-100 Å)
        const lengths = [params.a, params.b, params.c];
        for (const length of lengths) {
            if (length < 1 || length > 1000) {
                console.warn(`Unusual lattice parameter value: ${length} Å`);
            }
        }
    }

    /**
     * Get the parsed cell parameters
     * @returns {Object} Cell parameters object
     */
    getCellParameters() {
        return this.cellParams;
    }

    /**
     * Extract additional information from CIF file (space group, formula, etc.)
     * @param {string} content - Raw CIF file content
     * @returns {Object} Additional CIF data
     */
    extractAdditionalInfo(content) {
        const lines = content.split('\n');
        const info = {
            spaceGroup: null,
            formula: null,
            temperature: null,
            radiation: null
        };

        const patterns = {
            spaceGroup: /_space_group_name_H-M_alt\s+['"]([^'"]+)['"]/,
            formula: /_chemical_formula_sum\s+['"]([^'"]+)['"]/,
            temperature: /_diffrn_ambient_temperature\s+([\d.]+)/,
            radiation: /_diffrn_radiation_wavelength\s+([\d.]+)/
        };

        for (const line of lines) {
            const trimmedLine = line.trim();
            
            for (const [key, pattern] of Object.entries(patterns)) {
                const match = trimmedLine.match(pattern);
                if (match) {
                    info[key] = key === 'temperature' || key === 'radiation' 
                        ? parseFloat(match[1]) 
                        : match[1];
                }
            }
        }

        return info;
    }

    /**
     * Check if the file content appears to be a valid CIF file
     * @param {string} content - File content to check
     * @returns {boolean} True if content appears to be CIF format
     */
    static isValidCIFContent(content) {
        // Check for basic CIF indicators
        const cifIndicators = [
            /data_/,
            /_cell_length_[abc]/,
            /_cell_angle_/,
            /loop_/
        ];

        return cifIndicators.some(pattern => pattern.test(content));
    }
}

// Export for use in other modules (if using ES6 modules)
if (typeof module !== 'undefined' && module.exports) {
    module.exports = CIFReader;
}

// Make available globally for browser use
if (typeof window !== 'undefined') {
    window.CIFReader = CIFReader;
}