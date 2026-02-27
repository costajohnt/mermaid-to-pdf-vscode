/** Partial type declaration for html-to-docx — only options used by this project. */
declare module 'html-to-docx' {
    interface DocxOptions {
        table?: { row?: { cantSplit?: boolean } };
        footer?: boolean;
        pageNumber?: boolean;
    }

    export default function HTMLtoDOCX(
        htmlString: string,
        headerHtml: string | null,
        options?: DocxOptions,
    ): Promise<ArrayBuffer>;
}
