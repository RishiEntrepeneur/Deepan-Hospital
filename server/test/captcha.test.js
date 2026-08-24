/**
 * The captcha, tested where it matters: that it cannot be skipped, guessed,
 * forged or replayed. The arithmetic is the easy part.
 */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { issueChallenge, verifyChallenge } from '../src/lib/captcha.js'

/** Work out the answer the way a person would, from the question text. */
function solve(question) {
  const [, a, op, b] = question.match(/^(\d+)\s*([+×])\s*(\d+)$/)
  return op === '+' ? Number(a) + Number(b) : Number(a) * Number(b)
}

describe('captcha', () => {
  it('issues a question without leaking the answer', () => {
    const { question, token } = issueChallenge()
    assert.match(question, /^\d+ [+×] \d+$/)
    // The token must not contain the answer in any readable form.
    const answer = String(solve(question))
    const [nonce, issuedAt, signature] = token.split('.')
    assert.ok(nonce && issuedAt && signature)
    assert.notEqual(signature, answer)
    // Nor should decoding the signature reveal it.
    assert.ok(!Buffer.from(signature, 'base64url').toString('utf8').includes(answer))
  })

  it('accepts the right answer', () => {
    const { question, token } = issueChallenge()
    assert.equal(verifyChallenge(token, solve(question)), true)
  })

  it('accepts the right answer as a string, as a form would send it', () => {
    const { question, token } = issueChallenge()
    assert.equal(verifyChallenge(token, ` ${solve(question)} `), true)
  })

  it('refuses a wrong answer', () => {
    const { question, token } = issueChallenge()
    assert.throws(() => verifyChallenge(token, solve(question) + 1), /not right/i)
  })

  it('refuses a missing answer', () => {
    const { token } = issueChallenge()
    assert.throws(() => verifyChallenge(token, undefined), /answer the sum/i)
  })

  it('refuses a missing or malformed token', () => {
    assert.throws(() => verifyChallenge(undefined, 4), /answer the sum/i)
    assert.throws(() => verifyChallenge('nonsense', 4), /answer the sum/i)
  })

  it('refuses a token whose signature was tampered with', () => {
    const { question, token } = issueChallenge()
    const [nonce, issuedAt] = token.split('.')
    const forged = `${nonce}.${issuedAt}.${Buffer.from('forged').toString('base64url')}`
    assert.throws(() => verifyChallenge(forged, solve(question)), /not right/i)
  })

  it('will not let one solved token be used twice', () => {
    const { question, token } = issueChallenge()
    assert.equal(verifyChallenge(token, solve(question)), true)
    assert.throws(() => verifyChallenge(token, solve(question)), /new sum/i)
  })

  it('stops a token being brute-forced through every answer', () => {
    const { question, token } = issueChallenge()
    const right = solve(question)
    // Three wrong tries burn the token, so the right answer no longer helps.
    for (let i = 1; i <= 3; i++) {
      assert.throws(() => verifyChallenge(token, right + i))
    }
    assert.throws(() => verifyChallenge(token, right), /not right/i)
  })

  it('refuses an expired token', () => {
    const { question, token } = issueChallenge()
    const [nonce, , signature] = token.split('.')
    const old = Date.now() - 11 * 60 * 1000
    // Re-sign is impossible without the key, but an old timestamp must be
    // rejected before the signature is even considered.
    assert.throws(() => verifyChallenge(`${nonce}.${old}.${signature}`, solve(question)), /expired/i)
  })

  it('gives a different question and token each time', () => {
    const a = issueChallenge()
    const b = issueChallenge()
    assert.notEqual(a.token, b.token)
  })
})
