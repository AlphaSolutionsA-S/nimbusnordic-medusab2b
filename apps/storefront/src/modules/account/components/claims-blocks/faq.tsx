'use client';

import type { ClaimsFaqBlock } from '@/types/cms';
import { useState } from 'react';

import { ClaimsRichText } from './rich-text';

export function ClaimsFaq({ block }: { block: ClaimsFaqBlock }) {
  if (block.rows.length === 0) {
    return null;
  }

  return (
    <div data-testid="claims-faq-block" className="my-6 space-y-2">
      {block.rows.map((item, index) => (
        <FaqItem
          key={`${item.question}-${index}`}
          question={item.question}
          answer={item.answer}
        />
      ))}
    </div>
  );
}

function FaqItem({ question, answer }: { question: string; answer: unknown }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="border border-ui-border-base rounded">
      <button
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
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
          <ClaimsRichText block={{ blockType: 'richText', content: answer }} />
        </div>
      )}
    </div>
  );
}
