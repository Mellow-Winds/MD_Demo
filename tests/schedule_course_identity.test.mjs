import test from 'node:test';
import assert from 'node:assert/strict';
import createScheduleRouter from '../routes/schedule.js';

test('schedule import reuses a course only when code, class name, and teacher match', () => {
  let captured;
  const db = {
    get(sql, params) {
      captured = { sql, params };
      return { id: 7 };
    },
  };

  assert.equal(typeof createScheduleRouter.findExistingCourse, 'function');
  assert.deepEqual(
    createScheduleRouter.findExistingCourse(db, {
      courseId: '25000310',
      className: '软件工程与计算 I03班',
      teacher: '刘钦,冯奕',
    }),
    { id: 7 }
  );
  assert.match(captured.sql, /title = \?/);
  assert.deepEqual(captured.params, ['25000310 · %', '软件工程与计算 I03班', '刘钦,冯奕']);
});
