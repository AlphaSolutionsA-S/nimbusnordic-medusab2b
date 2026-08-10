'use client';

import type { ClaimsFaqBlock } from '@/types/cms';
import { useState } from 'react';

export function ClaimsFaq({ block }: { block: ClaimsFaqBlock }) {
  if (!block.questions || block.questions.length === 0) {
    return null;
  }

  return (
    <div data-testid="claims-faq-block" className="my-6 space-y-2">
      {block.questions.map((item, i) => (
        <FaqItem
          key={i}
          question={typeof item === 'string' ? item : item?.question || ''}
          answer={typeof item === 'string' ? '' : item?.answer || ''}
        />
      ))}
    </div>
  );
}

function FaqItem({ question, answer }: { question: string; answer: string }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="border border-ui-border-base rounded">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-4 py-3 flex justify-between items-center hover:bg-ui-bg-subtle transition-colors text-left"
        data-testid={`faq-question-${question}`}
      >
        <span className="font-semibold text-ui-fg-base">{question}</span>
        <span className="text-ui-fg-muted">
          {isOpen ? '−' : '+'}
        </span>
      </button>
      {isOpen && (
        <div className="border-t border-ui-border-base px-4 py-3 bg-ui-bg-subtle text-ui-fg-base">
          {answer}
        </div>
      )}
    </div>
  );
}
