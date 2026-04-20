// Shell wraps every Route mit Header und Search-Leiste. Server-Component:
// rendert nur Markup, die Kinder (Header/Search) sind selbst Client-Components.

import type { ReactNode } from 'react';
import type { Lebenslage } from '@/types/stadt';
import Header from './Header';
import Search from './Search';

export default function Shell({
  lebenslagen, children,
}: {
  lebenslagen: Lebenslage[];
  children: ReactNode;
}) {
  return (
    <>
      <Header />
      <Search lebenslagen={lebenslagen} />
      {children}
    </>
  );
}
