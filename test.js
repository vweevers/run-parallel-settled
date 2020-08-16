'use strict'

const test = require('tape')
const uniform = require('uniform-integer')
const parallel = require('.')
const noop = () => {}

test('no tasks', function (t) {
  let sync = true

  parallel([], function (err, results) {
    t.ifError(err, 'no error')
    t.same(results, [])
    t.is(sync, false)
    t.end()
  })

  sync = false
})

test('no limit', function (t) {
  t.plan(4 * 4)

  for (const limit of [undefined, Infinity, 2, 3]) {
    let called = false

    const tasks = [
      function one (next) {
        process.nextTick(function () {
          t.is(called, true)
          next(null, 1)
        })
      },
      function two (next) {
        called = true
        next(null, 2)
      }
    ]

    const done = function (err, results) {
      t.ifError(err, 'no error')
      t.is(called, true)
      t.same(results, [1, 2])
    }

    if (limit === undefined) {
      parallel(tasks, done)
    } else {
      parallel(tasks, limit, done)
    }
  }
})

test('limit 1', function (t) {
  t.plan(3)

  let called = false

  const tasks = [
    function one (next) {
      process.nextTick(function () {
        t.is(called, false)
        next()
      })
    },
    function two (next) {
      called = true
      next()
    }
  ]

  parallel(tasks, 1, function (err) {
    t.ifError(err, 'no error')
    t.is(called, true)
  })
})

test('limit 2', function (t) {
  t.plan(3)

  let called = false

  const tasks = [
    function one (next) {
      process.nextTick(function () {
        t.is(called, false)
        next()
      })
    },
    function two (next) {
      process.nextTick(function () {
        t.is(called, true)
        next()
      })
    },
    function three (next) {
      called = true
      next()
    }
  ]

  parallel(tasks, 2, function (err) {
    t.ifError(err, 'no error')
  })
})

test('results are ordered', function (t) {
  t.plan(2)

  const tasks = [
    function (next) {
      setTimeout(function () {
        next(null, 1)
      }, 200)
    },
    function (next) {
      next(null, 2)
    }
  ]

  parallel(tasks, Infinity, function (err, results) {
    t.ifError(err, 'no error')
    t.same(results, [1, 2])
  })
})

test('no results', function (t) {
  let sync = true

  parallel([(next) => next(), (next) => next()], function (err, results) {
    t.ifError(err, 'no error')
    t.same(results, [undefined, undefined])
    t.is(sync, false)
    t.end()
  })

  sync = false
})

for (const limit of [1, uniform(2, 999)(), 1000]) {
  test('many tasks with limit ' + limit, function (t) {
    t.plan(3)

    const tasks = []

    let active = 0
    let max = 0

    for (let i = 0; i < 1000; i++) {
      tasks.push(function (next) {
        max = Math.max(max, ++active)

        setImmediate(function () {
          active--
          next()
        })
      })
    }

    parallel(tasks, limit, function (err, results) {
      t.ifError(err, 'no error')
      t.is(results.length, tasks.length)
      t.is(max, limit)
    })
  })
}

test('error before limit', function (t) {
  t.plan(2)

  const tasks = [
    function (next) {
      next(new Error('test'))
    },
    function (next) {
      t.fail('should not be called')
    }
  ]

  parallel(tasks, 1, function (err, results) {
    t.is(err.message, 'test')
    t.is(results, undefined)
  })
})

test('error within limit', function (t) {
  t.plan(3)

  const tasks = [
    function (next) {
      next(new Error('test'))
    },
    function (next) {
      t.pass('called')
      next()
    }
  ]

  parallel(tasks, 2, function (err, results) {
    t.is(err.message, 'test')
    t.is(results, undefined)
  })
})

test('error after limit', function (t) {
  t.plan(3)

  const tasks = [
    function (next) {
      t.pass('called')
      next()
    },
    function (next) {
      next(new Error('test'))
    }
  ]

  parallel(tasks, 1, function (err, results) {
    t.is(err.message, 'test')
    t.is(results, undefined)
  })
})

test('combines errors', function (t) {
  t.plan(2)

  const tasks = [
    function (next) {
      next(new Error('test1'))
    },
    function (next) {
      next(new Error('test2'))
    }
  ]

  parallel(tasks, 2, function (err, results) {
    t.is(err.message, 'test1; test2')
    t.is(results, undefined)
  })
})

test('errors are ordered', function (t) {
  t.plan(4)

  const tasks = [
    function (next) {
      setTimeout(() => next(new Error('test1'), 200))
    },
    function (next) {
      t.pass('called')
      next()
    },
    function (next) {
      next(new Error('test2'))
    }
  ]

  parallel(tasks, Infinity, function (err, results) {
    t.is(err.message, 'test1; test2')
    t.is(Array.from(err).length, 2, 'skipped empty items in errors array')
    t.is(results, undefined)
  })
})

test('error on all initial tasks', function (t) {
  t.plan(3)

  let called = false

  const tasks = [
    function (next) {
      setTimeout(function () {
        t.is(called, false, 'callback not yet called')
        next(new Error('test'))
      }, 200)
    },
    function (next) {
      setTimeout(function () {
        t.is(called, false, 'callback not yet called')
        next(new Error('test2'))
      }, 200)
    },
    function (next) {
      t.fail('should not be called')
    }
  ]

  parallel(tasks, 2, function (err) {
    t.ok(err)
    called = true
  })
})

test('limit must be a number >= 1', function (t) {
  t.throws(() => parallel([], 'no', noop), /TypeError: The "limit" argument/)
  t.throws(() => parallel([], 0, noop), /TypeError: The "limit" argument/)
  t.throws(() => parallel([], -1, noop), /TypeError: The "limit" argument/)
  t.throws(() => parallel([], -Infinity, noop), /TypeError: The "limit" argument/)
  t.end()
})
