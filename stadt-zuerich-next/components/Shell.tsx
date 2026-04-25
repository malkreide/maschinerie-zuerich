// Shell wraps every Route mit Header und Search-Leiste. Server-Component:
// rendert nur Markup, die Kinder (Header/Search) sind selbst Client-Components.

import type { ReactNode } from 'react';
import type { Lebenslage } from '@/types/stadt';
import type { DataStandInfo } from '@/lib/data-meta';
import Header from './Header';
import Search from './Search';

export default function Shell({
  lebenslagen, dataStand, children,
}: {
  lebenslagen: Lebenslage[];
  dataStand: DataStandInfo;
  children: ReactNode;
}) {
  return (
    <>
      <Header dataStand={dataStand} />
      <Search lebenslagen={lebenslagen} />
      {children}
    </>
  );
}
