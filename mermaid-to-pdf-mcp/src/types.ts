export interface ConversionOptions {
    title?: string;
    theme?: 'light' | 'dark';
    pageSize?: 'A4' | 'Letter' | 'Legal';
}

export interface ConversionResult {
    pdfBase64: string;
    metadata: {
        fileSize: number;
        diagramCount: number;
        processingTime: number;
    };
}

export interface FileConversionResult {
    outputPath: string;
    metadata: ConversionResult['metadata'];
}
