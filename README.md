# contentful-doc-importer

A Contentful Page App that bulk-imports Google Docs (exported as `.docx` or `.html`) into Contentful entries. Select a folder of files — the first H1 becomes the entry title, everything else becomes the Rich Text body. All entries are created as drafts.

Designed for large batches (600–1000+ files), processing up to 5 files in parallel with live per-file status.

---

## Prerequisites

- Node.js 18+
- A Contentful space with a content type that has:
  - A short text `title` field
  - A Rich Text `body` field
  - A short text `slug` field (optional — set `SLUG_FIELD_ID` to `''` in `src/config.ts` to skip)
- A Contentful App Definition with the **Page** location enabled

---

## Configuration

Edit **`src/config.ts`** before building:

```ts
export const CONTENT_TYPE_ID = 'task';    // content type to create entries as
export const TITLE_FIELD_ID  = 'title';   // short text field for the H1
export const BODY_FIELD_ID   = 'body';    // Rich Text field for the body
export const SLUG_FIELD_ID   = 'slug';    // auto-generated from title; set to '' to skip
export const LOCALE          = 'en-US';
export const IMPORT_CONCURRENCY = 5;      // files processed in parallel
```

---

## Setup

```bash
npm install
```

Copy `.env.example` to `.env` and fill in your values:

```bash
cp .env.example .env
```

---

## Create an App Definition

Before uploading, create an App Definition in Contentful:

1. Go to **org settings → Apps → Create app**
2. Name it (e.g. "Document Importer")
3. Under **Locations**, check both **Page** and **Dialog**
4. Save — copy the App Definition ID from the URL
5. Add it to `.env` as `CONTENTFUL_APP_DEF_ID`

> **Important:** Do not use `contentful-app-scripts create-app-definition`. That command creates definitions with only the Dialog location, which causes the upload activation to fail.

---

## Build & deploy to Contentful hosting

```bash
npm run build
npm run upload
```

Say **Yes** when asked to activate the bundle.

After upload, the activation script resets the App Definition's locations to Dialog only. **You must re-add the Page location manually:**

1. Open the App Definition in Contentful
2. Under Locations, re-check **Page**
3. Save

Then install the app in your space via **Apps → Manage apps**.

---

## Local development

```bash
npm run dev
```

In the App Definition, set the frontend URL to `http://localhost:3000` while developing. Switch back to **Hosted by Contentful** when deploying.

---

## Using the app

1. Open the app from the space's Apps menu
2. Click **Select folder** and choose a local folder of `.docx` or `.html` files
3. Review the file list and click **Import N files**
4. Monitor per-file progress — errors are shown inline
5. All successfully imported entries are saved as **drafts** for editorial review

> **Tip:** To export Google Docs as `.docx`, select all files in Google Drive → right-click → Download. Google Drive zips them automatically; unzip and select the folder in the app.

---

> **Disclaimer:** Contentful provides this sample code solely to demonstrate a technical scenario. Any and all sample code provided by Contentful is not intended for production use. Contentful is not responsible for maintaining or supporting this sample code after it has been provided to you.
