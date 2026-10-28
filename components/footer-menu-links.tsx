'use client';

import Link from 'next/link';
import { useContentMenu } from '@/components/site-content-provider';

export default function FooterMenuLinks() {
  const menu = useContentMenu();
  return <nav aria-label="Швидкі посилання"><h2>Швидкі посилання</h2><ul>{menu.map((item) => <li key={item.id || item.label}><Link href={item.href === '#' ? item.children![0].href : item.href === '/promotions' ? '/promotions/catalog' : item.href}>{item.label}</Link></li>)}</ul></nav>;
}
