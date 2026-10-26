import { css } from "styled-components";

// The suite's controls, as style fragments, copied from Regimen: each panel's *.style.js
// applies them to its own class names.
// why fragments, not a <Button>: the markup stays plain buttons and inputs, so the tests'
// roles and the e2e selectors don't move, and one rule still sets every button.

// Terminus's outlined button: mono, bold, 44px tall, rounded, the primary colour on hover.
export const chip = css`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-2);
  min-height: 44px;
  padding: var(--space-2) var(--space-4);
  background: none;
  border: 1px solid var(--color-control-border);
  border-radius: var(--border-radius-base);
  color: var(--color-text);
  font-family: var(--font-family-mono);
  font-size: var(--font-size-small);
  font-weight: var(--font-weight-bold);
  white-space: nowrap;
  cursor: pointer;
  transition: all var(--transition-base);

  &:hover:not(:disabled) {
    border-color: color-mix(in srgb, var(--color-primary) 40%, transparent);
    color: var(--color-primary-text);
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`;

// The one main action on screen (Connect, Try again): filled.
export const chipPrimary = css`
  ${chip}
  background: var(--color-button-primary);
  border-color: var(--color-button-primary);
  color: var(--color-on-button-primary);

  &:hover:not(:disabled) {
    background: color-mix(in srgb, var(--color-button-primary) 85%, var(--color-text));
    border-color: var(--color-button-primary);
    color: var(--color-on-button-primary);
  }
`;
