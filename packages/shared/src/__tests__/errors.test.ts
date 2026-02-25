import { describe, expect, it } from 'vitest';
import { AppError, IngestionError, AnalysisError, GenerationError } from '../errors';

describe('Error classes', () => {
  it('AppError includes code and statusCode', () => {
    const error = new AppError('test', 'TEST_ERROR', 400, { foo: 'bar' });
    expect(error.message).toBe('test');
    expect(error.code).toBe('TEST_ERROR');
    expect(error.statusCode).toBe(400);
    expect(error.details).toEqual({ foo: 'bar' });
    expect(error).toBeInstanceOf(Error);
  });

  it('IngestionError defaults to 400', () => {
    const error = new IngestionError('bad url', 'INVALID_URL');
    expect(error.statusCode).toBe(400);
    expect(error.name).toBe('IngestionError');
  });

  it('AnalysisError defaults to 500', () => {
    const error = new AnalysisError('parse failed', 'PARSE_ERROR');
    expect(error.statusCode).toBe(500);
    expect(error.name).toBe('AnalysisError');
  });

  it('GenerationError defaults to 500', () => {
    const error = new GenerationError('llm failed', 'LLM_ERROR');
    expect(error.statusCode).toBe(500);
    expect(error.name).toBe('GenerationError');
  });
});
