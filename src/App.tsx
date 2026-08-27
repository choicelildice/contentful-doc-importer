import React, { useState, useCallback, useRef } from 'react';
import type { PageAppSDK } from '@contentful/app-sdk';
import {
  Box,
  Flex,
  Stack,
  Heading,
  Paragraph,
  Text,
  Button,
  Spinner,
  Note,
  Table,
} from '@contentful/f36-components';
import mammoth from 'mammoth';
import TurndownService from 'turndown';
import { richTextFromMarkdown } from '@contentful/rich-text-from-markdown';
import {
  CONTENT_TYPE_ID,
  TITLE_FIELD_ID,
  BODY_FIELD_ID,
  SLUG_FIELD_ID,
  LOCALE,
  IMPORT_CONCURRENCY,
} from './config';

type FileStatus = 'pending' | 'parsing' | 'importing' | 'done' | 'error';

interface FileEntry {
  id: string;
  file: File;
  title: string;
  status: FileStatus;
  error?: string;
  entryId?: string;
}

type Phase = 'select' | 'preview' | 'running' | 'done';

interface Props {
  sdk: PageAppSDK;
}

const SUPPORTED = ['.docx', '.html', '.htm'];

function isSupported(file: File) {
  return SUPPORTED.some(ext => file.name.toLowerCase().endsWith(ext));
}

async function parseFile(file: File): Promise<{ title: string; bodyHtml: string }> {
  let html: string;

  if (file.name.toLowerCase().endsWith('.docx')) {
    const arrayBuffer = await file.arrayBuffer();
    const result = await mammoth.convertToHtml(
      { arrayBuffer },
      // Skip images — they can't go into Rich Text and bloat memory
      { convertImage: mammoth.images.imgElement(() => ({})) }
    );
    html = result.value;
  } else {
    html = await file.text();
  }

  const doc = new DOMParser().parseFromString(html, 'text/html');

  // Strip images and empty src artifacts left by mammoth's image skip
  doc.querySelectorAll('img').forEach(el => el.remove());

  const h1 = doc.querySelector('h1');
  const title = h1?.textContent?.trim() ?? file.name.replace(/\.[^.]+$/, '');
  h1?.remove();

  return { title, bodyHtml: doc.body.innerHTML };
}

function toSlug(title: string): string {
  return title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

async function toRichText(html: string) {
  const td = new TurndownService({ headingStyle: 'atx', bulletListMarker: '-' });
  const markdown = td.turndown(html || '');
  return richTextFromMarkdown(markdown);
}

export default function App({ sdk }: Props) {
  const [phase, setPhase] = useState<Phase>('select');
  const [files, setFiles] = useState<FileEntry[]>([]);
  const [doneCount, setDoneCount] = useState(0);
  const [errorCount, setErrorCount] = useState(0);
  const cancelRef = useRef(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const envId = sdk.ids.environment;

  const updateFile = useCallback((id: string, patch: Partial<FileEntry>) => {
    setFiles(prev => prev.map(f => f.id === id ? { ...f, ...patch } : f));
  }, []);

  const handleFolderSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const supported = Array.from(e.target.files ?? []).filter(isSupported);
    if (supported.length === 0) return;
    setFiles(
      supported.map((file, i) => ({
        id: `${i}-${file.name}`,
        file,
        title: file.name.replace(/\.[^.]+$/, ''),
        status: 'pending',
      }))
    );
    setPhase('preview');
  }, []);

  const runImport = useCallback(async () => {
    cancelRef.current = false;
    setPhase('running');
    setDoneCount(0);
    setErrorCount(0);

    let qi = 0;

    const worker = async () => {
      while (!cancelRef.current) {
        const idx = qi++;
        if (idx >= files.length) break;
        const entry = files[idx];

        updateFile(entry.id, { status: 'parsing' });
        try {
          const { title, bodyHtml } = await parseFile(entry.file);
          updateFile(entry.id, { status: 'importing', title });

          const richText = await toRichText(bodyHtml);
          const fields: Record<string, Record<string, unknown>> = {
            [TITLE_FIELD_ID]: { [LOCALE]: title },
            [BODY_FIELD_ID]: { [LOCALE]: richText },
          };
          if (SLUG_FIELD_ID) {
            fields[SLUG_FIELD_ID] = { [LOCALE]: toSlug(title) };
          }

          const created = await sdk.cma.entry.create(
            { contentTypeId: CONTENT_TYPE_ID, environmentId: envId },
            { fields }
          );

          updateFile(entry.id, { status: 'done', title, entryId: created.sys.id });
          setDoneCount(n => n + 1);
        } catch (err) {
          updateFile(entry.id, {
            status: 'error',
            error: err instanceof Error ? err.message : 'Unknown error',
          });
          setErrorCount(n => n + 1);
        }
      }
    };

    await Promise.all(Array.from({ length: IMPORT_CONCURRENCY }, worker));
    setPhase('done');
  }, [files, envId, updateFile, sdk.cma.entry]);

  const reset = useCallback(() => {
    setFiles([]);
    setDoneCount(0);
    setErrorCount(0);
    setPhase('select');
    // Clear the file input so the same folder can be reselected
    if (inputRef.current) inputRef.current.value = '';
  }, []);

  // ── Select phase ──────────────────────────────────────────────────────────
  if (phase === 'select') {
    return (
      <Flex alignItems="center" justifyContent="center" style={{ height: '60vh' }}>
        <Stack flexDirection="column" alignItems="center" spacing="spacingM">
          <Heading as="h1">Document Importer</Heading>
          <Paragraph fontColor="gray600" style={{ textAlign: 'center', maxWidth: 480 }}>
            Select a folder of <strong>.docx</strong> or <strong>.html</strong> files
            exported from Google Docs. The first H1 in each file becomes the entry title;
            everything else becomes the body.
          </Paragraph>
          <Paragraph fontColor="gray500" fontSize="fontSizeS" style={{ textAlign: 'center', maxWidth: 480 }}>
            Entries are created as <strong>drafts</strong> in the current environment.
            Images are skipped.
          </Paragraph>
          <Button variant="primary" size="large" onClick={() => inputRef.current?.click()}>
            Select folder
          </Button>
          <input
            ref={inputRef}
            type="file"
            // @ts-expect-error webkitdirectory is non-standard but widely supported
            webkitdirectory=""
            multiple
            style={{ display: 'none' }}
            onChange={handleFolderSelect}
          />
        </Stack>
      </Flex>
    );
  }

  const total = files.length;
  const processed = doneCount + errorCount;

  return (
    <Box padding="spacingXl" style={{ maxWidth: 960, margin: '0 auto' }}>
      <Stack flexDirection="column" spacing="spacingL">

        <Flex justifyContent="space-between" alignItems="center">
          <Stack flexDirection="column" spacing="spacingXs">
            <Heading as="h1">Document Importer</Heading>
            <Text fontColor="gray600">
              {phase === 'preview' && `${total} ${total === 1 ? 'file' : 'files'} ready — will be created as draft ${CONTENT_TYPE_ID} entries.`}
              {phase === 'running' && `Importing… ${processed} of ${total}`}
              {phase === 'done' && `Done — ${doneCount} imported${errorCount > 0 ? `, ${errorCount} failed` : ' successfully'}.`}
            </Text>
          </Stack>

          <Flex gap="spacingS">
            {phase === 'preview' && (
              <Button variant="positive" onClick={runImport}>
                Import {total} {total === 1 ? 'file' : 'files'}
              </Button>
            )}
            {phase === 'running' && (
              <Button variant="secondary" onClick={() => { cancelRef.current = true; }}>
                Cancel
              </Button>
            )}
            {phase === 'done' && (
              <Button variant="secondary" onClick={reset}>
                Import another batch
              </Button>
            )}
          </Flex>
        </Flex>

        {phase === 'done' && (
          <Note variant={errorCount > 0 ? 'warning' : 'positive'}>
            <strong>
              {doneCount} {doneCount === 1 ? 'entry' : 'entries'} created as drafts.
            </strong>
            {errorCount > 0 && ` ${errorCount} failed — see errors below.`}
          </Note>
        )}

        <div style={{ maxHeight: 560, overflowY: 'auto', border: '1px solid #CFD9E0', borderRadius: 6 }}>
          <Table>
            <Table.Head>
              <Table.Row>
                <Table.Cell>File</Table.Cell>
                <Table.Cell>Title (from H1)</Table.Cell>
                <Table.Cell style={{ width: 160 }}>Status</Table.Cell>
              </Table.Row>
            </Table.Head>
            <Table.Body>
              {files.map(entry => (
                <Table.Row key={entry.id}>
                  <Table.Cell>
                    <Text fontSize="fontSizeS" fontColor="gray500">{entry.file.name}</Text>
                  </Table.Cell>
                  <Table.Cell>
                    <Text fontSize="fontSizeS">{entry.title}</Text>
                  </Table.Cell>
                  <Table.Cell>
                    {entry.status === 'pending' && (
                      <Text fontSize="fontSizeS" fontColor="gray400">Waiting</Text>
                    )}
                    {(entry.status === 'parsing' || entry.status === 'importing') && (
                      <Flex alignItems="center" gap="spacingXs">
                        <Spinner size="small" />
                        <Text fontSize="fontSizeS" fontColor="gray600">
                          {entry.status === 'parsing' ? 'Parsing…' : 'Importing…'}
                        </Text>
                      </Flex>
                    )}
                    {entry.status === 'done' && (
                      <Text fontSize="fontSizeS" fontColor="green600">✓ Done</Text>
                    )}
                    {entry.status === 'error' && (
                      <Text fontSize="fontSizeS" fontColor="red600" title={entry.error}>
                        ✗ {entry.error}
                      </Text>
                    )}
                  </Table.Cell>
                </Table.Row>
              ))}
            </Table.Body>
          </Table>
        </div>

      </Stack>
    </Box>
  );
}
