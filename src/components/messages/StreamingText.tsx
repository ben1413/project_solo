"use client";

import React, { useState, useEffect } from 'react';

interface StreamingTextProps {
  text: string;
  isNew?: boolean;
}

export const StreamingText = ({ text, isNew }: StreamingTextProps) => {
  // Initialize with full text if not new, avoiding the effect-based sync
  const [displayedText, setDisplayedText] = useState(isNew ? "" : text);

  useEffect(() => {
    if (!isNew) {
      setDisplayedText(text);
      return;
    }

    let i = 0;
    const interval = setInterval(() => {
      setDisplayedText(text.slice(0, i));
      i++;
      if (i > text.length) clearInterval(interval);
    }, 15);

    return () => clearInterval(interval);
  }, [text, isNew]);

  return <span>{displayedText}</span>;
};
