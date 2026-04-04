import {
  aggregateReactions,
  buildCommentTree,
  hasExternalActivity,
} from './community.utils';

describe('community utils', () => {
  it('aggregates reactions by emoji', () => {
    expect(
      aggregateReactions([{ emoji: '👍' }, { emoji: '💡' }, { emoji: '👍' }]),
    ).toEqual([
      { emoji: '👍', count: 2 },
      { emoji: '💡', count: 1 },
    ]);
  });

  it('builds a one-level comment tree', () => {
    const tree = buildCommentTree([
      { id: 'a', parentCommentId: null, body: 'top level' },
      { id: 'b', parentCommentId: 'a', body: 'reply' },
      { id: 'c', parentCommentId: null, body: 'second top level' },
    ]);

    expect(tree).toHaveLength(2);
    expect(tree[0].replies).toEqual([
      { id: 'b', parentCommentId: 'a', body: 'reply', replies: [] },
    ]);
    expect(tree[1].replies).toEqual([]);
  });

  it('detects cross-organization activity', () => {
    expect(hasExternalActivity('northlight', ['northlight', 'horizon'])).toBe(
      true,
    );
    expect(
      hasExternalActivity('northlight', ['northlight', 'northlight']),
    ).toBe(false);
  });
});
