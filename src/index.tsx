import React from 'react';
import { createRoot } from 'react-dom/client';
import { init } from '@contentful/app-sdk';
import type { PageAppSDK } from '@contentful/app-sdk';
import { GlobalStyles } from '@contentful/f36-components';
import App from './App';

const container = document.getElementById('root')!;
const root = createRoot(container);

init((sdk) => {
  root.render(
    <>
      <GlobalStyles />
      <App sdk={sdk as PageAppSDK} />
    </>
  );
});

