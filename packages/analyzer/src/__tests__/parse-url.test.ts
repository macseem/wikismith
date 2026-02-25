import { describe, expect, it } from 'vitest';
import { parseGitHubUrl } from '../ingestion/parse-url';

describe('parseGitHubUrl', () => {
  it('parses https://github.com/owner/repo', () => {
    const result = parseGitHubUrl('https://github.com/facebook/react');
    expect(result).toEqual({ owner: 'facebook', name: 'react' });
  });

  it('parses https://github.com/owner/repo/ (trailing slash)', () => {
    const result = parseGitHubUrl('https://github.com/facebook/react/');
    expect(result).toEqual({ owner: 'facebook', name: 'react' });
  });

  it('parses https://github.com/owner/repo.git', () => {
    const result = parseGitHubUrl('https://github.com/facebook/react.git');
    expect(result).toEqual({ owner: 'facebook', name: 'react' });
  });

  it('parses owner/repo shorthand', () => {
    const result = parseGitHubUrl('facebook/react');
    expect(result).toEqual({ owner: 'facebook', name: 'react' });
  });

  it('parses URL with tree/branch ref', () => {
    const result = parseGitHubUrl('https://github.com/facebook/react/tree/main');
    expect(result).toEqual({ owner: 'facebook', name: 'react', ref: 'main' });
  });

  it('parses URL with ?ref= query param', () => {
    const result = parseGitHubUrl('https://github.com/facebook/react?ref=v18.0.0');
    expect(result).toEqual({ owner: 'facebook', name: 'react', ref: 'v18.0.0' });
  });

  it('parses URL with #hash ref', () => {
    const result = parseGitHubUrl('https://github.com/facebook/react#v18.0.0');
    expect(result).toEqual({ owner: 'facebook', name: 'react', ref: 'v18.0.0' });
  });

  it('handles owners and repos with dots and hyphens', () => {
    const result = parseGitHubUrl('https://github.com/my-org/my.project');
    expect(result).toEqual({ owner: 'my-org', name: 'my.project' });
  });

  it('trims whitespace', () => {
    const result = parseGitHubUrl('  facebook/react  ');
    expect(result).toEqual({ owner: 'facebook', name: 'react' });
  });

  it('throws on empty input', () => {
    expect(() => parseGitHubUrl('')).toThrow('Repository URL is required');
  });

  it('throws on non-GitHub URL', () => {
    expect(() => parseGitHubUrl('https://gitlab.com/owner/repo')).toThrow('Invalid GitHub URL');
  });

  it('throws on random text', () => {
    expect(() => parseGitHubUrl('not-a-url')).toThrow('Invalid GitHub URL');
  });
});
