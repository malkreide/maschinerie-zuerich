'use client';

import { useState } from 'react';

export default function EmbedButton({ embedPath, title }: { embedPath: string, title?: string }) {
  const [isOpen, setIsOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  // Der vollständige Link hängt vom aktuellen Origin ab
  const origin = typeof window !== 'undefined' ? window.location.origin : 'https://maschinerie-zuerich.ch';
  const embedUrl = `${origin}${embedPath}`;

  const iframeSnippet = `<iframe 
  src="${embedUrl}" 
  width="100%" 
  height="600" 
  style="border: none; border-radius: 8px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1);"
  title="${title || 'Datenvisualisierung Maschinerie Zürich'}"
  allowfullscreen>
</iframe>
<p style="font-size: 12px; color: #666; font-family: sans-serif; text-align: right; margin-top: 4px;">
  Daten bereitgestellt von <a href="${origin}" target="_blank" rel="noopener noreferrer" style="color: #666; text-decoration: underline;">Maschinerie Zürich</a>
</p>`;

  const handleCopy = () => {
    navigator.clipboard.writeText(iframeSnippet);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="inline-flex items-center px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors"
      >
        <svg
          className="w-4 h-4 mr-2"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4"
          />
        </svg>
        Grafik einbetten
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:p-0">
            <div className="fixed inset-0 transition-opacity bg-gray-500 bg-opacity-75 backdrop-blur-sm" onClick={() => setIsOpen(false)} />

            <div className="relative inline-block px-4 pt-5 pb-4 overflow-hidden text-left align-bottom transition-all transform bg-white rounded-lg shadow-xl sm:my-8 sm:align-middle sm:max-w-lg sm:w-full sm:p-6">
              <div className="absolute top-0 right-0 hidden pt-4 pr-4 sm:block">
                <button
                  onClick={() => setIsOpen(false)}
                  className="text-gray-400 bg-white rounded-md hover:text-gray-500 focus:outline-none"
                >
                  <span className="sr-only">Schliessen</span>
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="sm:flex sm:items-start">
                <div className="mt-3 text-center sm:mt-0 sm:text-left w-full">
                  <h3 className="text-lg font-medium leading-6 text-gray-900">
                    Visualisierung einbetten
                  </h3>
                  <div className="mt-2">
                    <p className="text-sm text-gray-500">
                      Kopiere diesen HTML-Code, um die interaktive Grafik in deinem Artikel oder deiner Website (z.B. WordPress) einzubetten.
                    </p>
                    <div className="mt-4">
                      <textarea
                        readOnly
                        value={iframeSnippet}
                        className="w-full h-40 p-3 font-mono text-sm text-gray-800 bg-gray-100 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        onClick={(e) => (e.target as HTMLTextAreaElement).select()}
                      />
                    </div>
                  </div>
                </div>
              </div>
              <div className="mt-5 sm:mt-4 sm:flex sm:flex-row-reverse">
                <button
                  type="button"
                  onClick={handleCopy}
                  className="inline-flex justify-center w-full px-4 py-2 text-base font-medium text-white bg-indigo-600 border border-transparent rounded-md shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:ml-3 sm:w-auto sm:text-sm"
                >
                  {copied ? 'Kopiert!' : 'Code kopieren'}
                </button>
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="inline-flex justify-center w-full px-4 py-2 mt-3 text-base font-medium text-gray-700 bg-white border border-gray-300 rounded-md shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:mt-0 sm:w-auto sm:text-sm"
                >
                  Schliessen
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
