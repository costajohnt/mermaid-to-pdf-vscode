"use strict";
/**
 * Core types and interfaces for the Mermaid Converter system
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.ValidationError = exports.DiagramRenderError = exports.ConversionError = void 0;
// Error types
class ConversionError extends Error {
    code;
    details;
    constructor(message, code, details) {
        super(message);
        this.code = code;
        this.details = details;
        this.name = 'ConversionError';
    }
}
exports.ConversionError = ConversionError;
class DiagramRenderError extends ConversionError {
    diagramId;
    diagramType;
    constructor(message, diagramId, diagramType, details) {
        super(message, 'DIAGRAM_RENDER_ERROR', details);
        this.diagramId = diagramId;
        this.diagramType = diagramType;
        this.name = 'DiagramRenderError';
    }
}
exports.DiagramRenderError = DiagramRenderError;
class ValidationError extends ConversionError {
    validationErrors;
    constructor(message, validationErrors, details) {
        super(message, 'VALIDATION_ERROR', details);
        this.validationErrors = validationErrors;
        this.name = 'ValidationError';
    }
}
exports.ValidationError = ValidationError;
//# sourceMappingURL=types.js.map