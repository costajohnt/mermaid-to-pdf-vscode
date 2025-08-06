# Confluence Document Package

This package contains:
- `document.json`: Main Confluence document in Storage Format
- `attachments/`: Directory containing binary attachments
- `attachments.json`: Attachment metadata manifest

## Usage
1. Upload `document.json` to Confluence via REST API
2. Upload attachments from `attachments/` directory
3. Reference attachment metadata from `attachments.json`
