import type { ReactNode } from 'react';
import Link from 'next/link';

export default function EmbedLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col min-h-screen bg-transparent">
      <main className="flex-grow flex items-center justify-center p-0 m-0">
        {children}
      </main>
      <footer className="w-full text-right p-2 text-xs text-gray-500 opacity-70 hover:opacity-100 transition-opacity">
        Daten bereitgestellt von{' '}
        <Link 
          href="/" 
          target="_blank" 
          rel="noopener noreferrer"
          className="font-semibold underline"
        >
          Maschinerie Zürich
        </Link>
      </footer>
    </div>
  );
}
