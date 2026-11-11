import { test } from 'node:test'
import assert from 'node:assert/strict'
import { pressScale } from './PressMotion'

test('小さい部品ほど大きく縮む', () => {
  assert.equal(pressScale(120, 44), 0.95)
  assert.equal(pressScale(320, 120), 0.975)
  assert.equal(pressScale(900, 300), 0.99)
})
