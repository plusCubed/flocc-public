import React from 'react';

import ReactDOM from 'react-dom';

import './index.css';
import '@fontsource/roboto-mono/400.css';
import '@fontsource/roboto-mono/500.css';
import '@fontsource/roboto-mono/700.css';
import '@fontsource/open-sans/400.css';
import '@fontsource/open-sans/600.css';
import '@fontsource/open-sans/700.css';

import { AppWrapper } from './components/app';

ReactDOM.createRoot(document.getElementById('root')).render(<AppWrapper />);

if (module.hot) {
  module.hot.accept((err) => {
    console.error('HMR accept() error: ' + err);
  });
  module.hot.addStatusHandler((status) => {
    if (status === 'apply') {
      window.location.reload();
    }
  });
}
