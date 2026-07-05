import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource/gloock';
import '@fontsource-variable/newsreader/standard.css';
import '@fontsource-variable/newsreader/standard-italic.css';
import '@fontsource/ibm-plex-mono/400.css';
import '@fontsource/ibm-plex-mono/500.css';
import './styles/global.css';
import { HarborProvider } from './state/harbor';
import App from './App';

createRoot(document.getElementById('root')!).render(
	<StrictMode>
		<HarborProvider>
			<App />
		</HarborProvider>
	</StrictMode>,
);
