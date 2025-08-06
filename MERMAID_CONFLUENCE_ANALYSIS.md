# Mermaid to Confluence Conversion Issue Analysis

## Problem Statement
Mermaid diagrams in markdown are not being converted to rendered images when uploaded to Confluence pages. Instead, they appear as markdown code blocks.

## Root Cause Analysis

### Current Architecture Flow
1. **Input**: Markdown with Mermaid code blocks (````mermaid ... ```)
2. **Processing**: `SimplifiedConfluenceConverter.convertMarkdown()`
3. **Step 1**: `processMermaidDiagrams()` - Convert Mermaid to placeholder + store attachment
4. **Step 2**: `markdownToConfluence()` - Convert markdown to Confluence Storage Format
5. **Step 3**: `replaceDiagramPlaceholders()` - Replace placeholders with image XML
6. **Output**: Confluence Storage Format with `<ac:image>` elements

### Critical Issues Identified

#### Issue 1: Placeholder Strategy Failure
**Problem**: HTML comment placeholders (`<!-- CONFLUENCE_DIAGRAM_PLACEHOLDER_${id} -->`) are being converted by the `marked` markdown parser.

**Evidence**: 
- Test output shows: `<p><strong>CONFLUENCE_DIAGRAM_PLACEHOLDER_mermaid_diagram_0</strong></p>`
- The markdown parser treats `<!--` as start of bold text when not properly formatted

**Why Current Fix Attempts Failed**:
- Multiple placeholder format matching attempted but unsuccessful
- The replacement logic runs AFTER markdown conversion, but placeholder is already mangled

#### Issue 2: Attachment Reference Format Mismatch
**Problem**: The generated Confluence XML uses `<ri:attachment>` but may not be properly formatted for Confluence's attachment system.

**Current Output**:
```xml
<ac:image ac:title="mermaid_diagram_0.png">
    <ri:attachment ri:filename="mermaid_diagram_0.png" />
</ac:image>
```

**Confluence Requirements** (from documentation):
- Attachments must actually exist on the page
- `ri:filename` must match actual uploaded attachment
- May need `ri:version-at-save` attribute

#### Issue 3: MCP Attachment Handling Gap
**Problem**: The MCP server creates attachment metadata but there's no mechanism to actually upload attachments to Confluence.

**Current Behavior**:
- Creates `ConfluenceAttachment` objects with base64 data
- Generates proper Storage Format XML
- But attachments don't exist on the Confluence page

## Confluence Storage Format Requirements

### For Embedded Images (Data URLs)
```xml
<ac:image ac:alt="Mermaid Diagram">
    <ri:url ri:value="data:image/png;base64,iVBORw0KG..." />
</ac:image>
```

### For File Attachments
```xml
<ac:image ac:alt="Mermaid Diagram">
    <ri:attachment ri:filename="diagram.png" ri:version-at-save="1" />
</ac:image>
```

## Proposed Solution Strategy

### Option A: Fix Placeholder Processing (Recommended)
**Strategy**: Process Mermaid diagrams BEFORE markdown conversion to avoid placeholder mangling.

**Implementation**:
1. Move `processMermaidDiagrams()` to run BEFORE `markdownToConfluence()`
2. Replace Mermaid blocks directly with final Confluence XML
3. Eliminate placeholder/replacement system entirely

**Pros**:
- Fixes core placeholder issue
- Simpler, more reliable approach
- No dependency on markdown parser behavior

**Cons**:
- Still doesn't solve attachment upload issue

### Option B: Use Data URL Embedding (Quick Fix)
**Strategy**: Embed images as base64 data URLs instead of attachments.

**Implementation**:
1. Always use `diagramFormat: 'base64'` mode
2. Generate `<ri:url>` elements with data URLs
3. Remove attachment dependency

**Pros**:
- Works without file uploads
- Self-contained in page content
- Immediate solution

**Cons**:
- Large base64 data in page storage
- May hit Confluence size limits
- No attachment management benefits

### Option C: Implement Full Attachment Upload
**Strategy**: Actually upload generated images as Confluence attachments.

**Implementation**:
1. Use Confluence REST API to upload PNG files
2. Generate proper `<ri:attachment>` references
3. Handle attachment versioning

**Pros**:
- Proper Confluence integration
- Clean Storage Format
- Attachment management benefits

**Cons**:
- Complex implementation
- Requires Confluence API integration
- Authentication and permissions complexity

## Immediate Action Plan

### Phase 1: Quick Fix (Recommended Start)
1. Implement **Option A** - fix placeholder processing
2. Use **Option B** as fallback - data URL embedding
3. Test with existing Confluence page

### Phase 2: Long-term Solution
1. Evaluate **Option C** - full attachment upload
2. Add proper error handling and fallbacks
3. Performance optimization

## Key Questions for Clarification

1. **Attachment Preference**: Do you prefer data URL embedding or actual file attachments?
2. **API Access**: Do you have Confluence API credentials for attachment uploads?
3. **Size Constraints**: Are there limits on base64 data size in Confluence pages?
4. **User Experience**: Should the MCP tool handle attachment uploads automatically?

## Test Cases Needed

1. Single Mermaid diagram conversion
2. Multiple diagrams in one page
3. Complex diagrams with large file sizes
4. Error handling for render failures
5. Confluence page update/overwrite scenarios

## Success Criteria

- [ ] Mermaid code blocks convert to visible images in Confluence
- [ ] Multiple diagrams per page work correctly  
- [ ] No placeholder text visible in final output
- [ ] Reasonable performance for typical diagram sizes
- [ ] Proper error handling with fallbacks