# MCP Server Custom Instructions

This MCP server includes custom instructions that help LLMs understand how to effectively use the Mermaid to PDF conversion capabilities.

## How It Works

When connected to an LLM (like Claude Code), the LLM can call the `get_custom_instructions` tool to receive detailed guidance on:

1. **When to use the server** - Ideal for creating technical documentation, process flows, system designs
2. **Recommended workflow** - Create Markdown content first, then convert to PDF
3. **Best practices** - Proper diagram selection, content structure, quality settings
4. **Example scenarios** - API docs, system architecture, process documentation

## For LLM Developers

To enable custom instructions in your LLM integration:

1. **Call the instructions tool first** when the user requests documentation with diagrams:
   ```json
   {
     "jsonrpc": "2.0",
     "id": 1,
     "method": "tools/call",
     "params": {
       "name": "get_custom_instructions",
       "arguments": {}
     }
   }
   ```

2. **Use the returned instructions** to guide your document creation process

3. **Follow the recommended workflow**:
   - Create rich Markdown with Mermaid diagrams
   - Use appropriate diagram types for the content
   - Convert to professional PDF using the MCP server

## Example User Interaction

**User**: "I need documentation for our new API with diagrams, can you create a PDF?"

**LLM Response** (guided by custom instructions):
1. First, I'll create comprehensive Markdown documentation with:
   - API architecture diagrams
   - Sequence diagrams for key endpoints
   - Authentication flow charts
   - Request/response examples

2. Then I'll use the MCP server to convert it to a professional PDF

## Benefits

- **Consistent quality**: LLMs follow proven patterns for creating visual documentation
- **Appropriate tool usage**: LLMs know when and how to use different diagram types
- **Professional output**: Guidance ensures high-quality, well-structured PDFs
- **Efficient workflow**: Clear step-by-step process for document creation

## Customization

The instructions can be modified in `src/index.ts` in the `get_custom_instructions` case handler to match your specific use cases or organizational standards.