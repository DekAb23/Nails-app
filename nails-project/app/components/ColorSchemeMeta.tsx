'use client';

import { useEffect } from 'react';

export default function ColorSchemeMeta() {
  useEffect(() => {
    // Add color-scheme meta tag to prevent Android dark mode
    if (typeof document !== 'undefined') {
      const existingMeta = document.querySelector('meta[name="color-scheme"]');
      if (!existingMeta) {
        const meta = document.createElement('meta');
        meta.name = 'color-scheme';
        meta.content = 'light only';
        document.head.appendChild(meta);
      }
    }
  }, []);

  return null;
}
