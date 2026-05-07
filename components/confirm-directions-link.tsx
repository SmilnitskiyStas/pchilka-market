'use client';

import type { MouseEvent, ReactNode } from 'react';

type ConfirmDirectionsLinkProps = {
  href: string;
  address: string;
  className?: string;
  title?: string;
  children: ReactNode;
};

export function ConfirmDirectionsLink({
  href,
  address,
  className,
  title,
  children,
}: ConfirmDirectionsLinkProps) {
  function handleClick(event: MouseEvent<HTMLAnchorElement>) {
    const confirmed = window.confirm(
      `\u041f\u0440\u043e\u043a\u043b\u0430\u0441\u0442\u0438 \u043c\u0430\u0440\u0448\u0440\u0443\u0442 \u0434\u043e \u0430\u0434\u0440\u0435\u0441\u0438:\n${address}\n\n\u0412\u0456\u0434\u043a\u0440\u0438\u0442\u0438 Google Maps?`,
    );

    if (!confirmed) {
      event.preventDefault();
    }
  }

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      onClick={handleClick}
      className={className}
      title={title}
    >
      {children}
    </a>
  );
}
