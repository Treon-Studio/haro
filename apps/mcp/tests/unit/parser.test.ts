import { describe, it, expect } from 'vitest';
import { parseDocument, validateOkfDocument } from '../../src/github/parser';

describe('document parser', () => {
  const sampleDoc = `---
id: okf-001
title: Authentication Flow
created: 2026-06-15
updated: 2026-06-28
author: john.doe
version: "1.2.0"
status: stable
related:
  - okf-002
  - okf-007
tags:
  - authentication
  - security
category: security
context_priority: 1
---

# Authentication Flow

## Overview

This document describes the authentication flow.

See [Authorization](okf-002.md) for details.

## Details

More content here.
`;

  it('parses front matter correctly', () => {
    const parsed = parseDocument(sampleDoc, 'docs/okf-001-auth.md', 'abc123');
    expect(parsed.id).toBe('okf-001');
    expect(parsed.title).toBe('Authentication Flow');
    expect(parsed.metadata.status).toBe('stable');
    expect(parsed.metadata.author).toBe('john.doe');
    expect(parsed.metadata.version).toBe('1.2.0');
    expect(parsed.metadata.tags).toEqual(['authentication', 'security']);
    expect(parsed.metadata.category).toBe('security');
    expect(parsed.metadata.context_priority).toBe(1);
  });

  it('extracts content fields', () => {
    const parsed = parseDocument(sampleDoc, 'docs/okf-001-auth.md', 'abc123');
    expect(parsed.content.raw_markdown).toContain('# Authentication Flow');
    expect(parsed.content.plain_text).toContain('Authentication Flow');
    expect(parsed.content.headings.length).toBeGreaterThan(0);
    expect(parsed.content.links.internal).toContain('okf-002');
  });

  it('validates OKF schema', () => {
    const valid = { id: 'okf-001', title: 'Test', created: '2026-01-01', updated: '2026-01-02' };
    expect(validateOkfDocument(valid)).toEqual([]);

    const invalid = { title: 'Test' };
    expect(validateOkfDocument(invalid)).toContain('Missing or invalid "id"');

    const badStatus = { id: 'okf-001', title: 'Test', created: '2026-01-01', updated: '2026-01-02', status: 'invalid' };
    const errors = validateOkfDocument(badStatus);
    expect(errors.some((e: string) => e.includes('status'))).toBe(true);
  });
});
