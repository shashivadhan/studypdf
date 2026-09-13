# StudyPDF

A clean browser-based PDF viewer and annotator.

## Features

- Upload and view PDF files
- Page navigation
- Zoom and fit-to-page
- Highlight areas in multiple colors
- Freehand pen
- Eraser
- Text notes
- Export original PDF
- Export annotations as JSON

## Run locally

Because this uses ES modules, run it with a local server.

### Option 1: VS Code Live Server

Open the folder in VS Code and use the Live Server extension.

### Option 2: Python

```bash
python -m http.server 5500
```

Then open:

http://localhost:5500

## Deploy to GitHub Pages

1. Create a GitHub repository named `studypdf`.
2. Upload `index.html`, `style.css`, `app.js`, and `README.md`.
3. Go to **Settings → Pages**.
4. Under **Build and deployment**, choose:
   - Source: Deploy from a branch
   - Branch: `main`
   - Folder: `/ (root)`
5. Save and wait for GitHub Pages to publish.

## Important

This is the local prototype. The PDF viewer works in the browser, but annotations are exported separately as JSON. A future cloud version can add:

- Supabase authentication
- Cloud PDF storage
- Persistent annotations
- Cross-device synchronization
- Real annotated-PDF export
