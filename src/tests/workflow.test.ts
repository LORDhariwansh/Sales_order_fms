import { describe, it, expect, vi } from 'vitest';
import { calculateSLAStatus } from '../services/workflow';

describe('Workflow Engine SLA Status', () => {
  it('returns NOT_STARTED when planned date is missing', () => {
    expect(calculateSLAStatus(null, null)).toBe('NOT_STARTED');
  });

  it('returns ON_TIME when completed before deadline', () => {
    const planned = new Date(Date.now() + 100000).toISOString();
    const actual = new Date(Date.now()).toISOString();
    expect(calculateSLAStatus(planned, actual)).toBe('ON_TIME');
  });

  it('returns OVERDUE_COMPLETED when completed after deadline', () => {
    const planned = new Date(Date.now() - 100000).toISOString();
    const actual = new Date(Date.now()).toISOString();
    expect(calculateSLAStatus(planned, actual)).toBe('OVERDUE_COMPLETED');
  });

  it('returns OVERDUE when active and past deadline', () => {
    const planned = new Date(Date.now() - 100000).toISOString();
    expect(calculateSLAStatus(planned, null)).toBe('OVERDUE');
  });

  it('returns DUE_SOON when active and within 1 hour of deadline', () => {
    const planned = new Date(Date.now() + (30 * 60 * 1000)).toISOString(); // 30 mins from now
    expect(calculateSLAStatus(planned, null)).toBe('DUE_SOON');
  });

  it('returns IN_PROGRESS when active and safe', () => {
    const planned = new Date(Date.now() + (3 * 60 * 60 * 1000)).toISOString(); // 3 hours from now
    expect(calculateSLAStatus(planned, null)).toBe('IN_PROGRESS');
  });
});
