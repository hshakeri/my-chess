// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import { BACKED_UP_KEYS, readLocalData, restoreLocalData } from '../../../src/services/localData';

describe('localStorage data in the JSON backup', () => {
  beforeEach(() => window.localStorage.clear());

  it('reads only the backed-up keys this browser has', () => {
    window.localStorage.setItem('my_chess_idea_cards_v1', '{"lesson-x":{}}');
    window.localStorage.setItem('my_chess_session_v2', 'in progress');
    window.localStorage.setItem('unrelated', 'x');
    expect(readLocalData()).toEqual({ my_chess_idea_cards_v1: '{"lesson-x":{}}' });
  });

  it('restores the keys missing here, keeps what is here, and writes no other key', () => {
    window.localStorage.setItem('my_chess_speedrun_v1', 'local');
    const restored = restoreLocalData({ my_chess_speedrun_v1: 'backup', my_chess_cct_log_v1: '[1]', evil_key: 'x', my_chess_spar_log_v1: 42 });
    expect(restored).toEqual(['my_chess_cct_log_v1']);
    expect(window.localStorage.getItem('my_chess_speedrun_v1')).toBe('local');
    expect(window.localStorage.getItem('my_chess_cct_log_v1')).toBe('[1]');
    expect(window.localStorage.getItem('evil_key')).toBeNull();
    expect(window.localStorage.getItem('my_chess_spar_log_v1')).toBeNull();
    expect(BACKED_UP_KEYS).not.toContain('my_chess_session_v2');
    expect(restoreLocalData(undefined)).toEqual([]);
  });
});
