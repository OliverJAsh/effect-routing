import { Alternative } from '@effect/typeclass/Alternative'
import { Monad } from '@effect/typeclass/Monad'
import { Monoid } from '@effect/typeclass/Monoid'
import { identity, pipe } from 'effect'
import * as O from 'effect/Option'

import { RowLacks } from './helpers'
import { Route } from './route'
import { LazyArg } from 'effect/Function'

/**
 * @category parsers
 * @since 0.4.0
 */
export class Parser<A> {
  /**
   * @since 0.4.0
   */
  readonly _A!: A
  constructor(readonly run: (r: Route) => O.Option<[A, Route]>) {}
  /**
   * @since 0.4.0
   */
  static of<A>(a: A): Parser<A> {
    return new Parser((s) => O.some([a, s]))
  }
  /**
   * @since 0.4.0
   */
  map<B>(f: (a: A) => B): Parser<B> {
    return this.chain((a) => Parser.of(f(a))) // <= derived
  }
  /**
   * @since 0.4.0
   */
  ap<B>(fab: Parser<(a: A) => B>): Parser<B> {
    return fab.chain((f) => this.map(f)) // <= derived
  }
  /**
   * @since 0.4.0
   */
  chain<B>(f: (a: A) => Parser<B>): Parser<B> {
    return new Parser((r) =>
      pipe(
        this.run(r),
        O.flatMap(([a, r2]) => f(a).run(r2))
      )
    )
  }
  /**
   * @since 0.4.0
   */
  alt(that: Parser<A>): Parser<A> {
    return new Parser((r) =>
      pipe(
        this.run(r),
        O.orElse(() => that.run(r))
      )
    )
  }
  /**
   * @since 0.4.0
   */
  then<B>(that: Parser<RowLacks<B, keyof A>>): Parser<A & B> {
    return that.ap(this.map(assign as (a: A) => (b: B) => A & B))
  }
}

/**
 * @category parsers
 * @since 0.4.0
 */
export const zero = <A>(): Parser<A> => new Parser(() => O.none())

/**
 * @category parsers
 * @since 0.4.0
 */
export const parse = <A>(parser: Parser<A>, r: Route, a: A): A =>
  pipe(
    parser.run(r),
    O.match({
      onNone: () => a,
      onSome: ([x]) => x
    })
  )

/**
 * @category parsers
 * @since 0.5.1
 */
export const getParserMonoid = <A>(): Monoid<Parser<A>> => ({
  concat: (x, y) => x.alt(y),
  empty: zero<A>()
})

/**
 * @category parsers
 * @since 0.5.1
 */
export const parser: Monad<PARSER_URI> & Alternative<PARSER_URI> = {
  URI: PARSER_URI,
  map: (ma, f) => ma.map(f),
  of: Parser.of,
  ap: (mab, ma) => ma.ap(mab),
  chain: (ma, f) => ma.chain(f),
  alt: (fx, f) =>
    new Parser((r) =>
      pipe(
        fx.run(r),
        O.orElse(() => f().run(r))
      )
    ),
  zero
}

/**
 * @category parsers
 * @since 0.5.1
 */
export const alt =
  <A>(that: LazyArg<Parser<A>>) =>
  (fa: Parser<A>): Parser<A> =>
    parser.alt(fa, that)

/**
 * @category parsers
 * @since 0.5.1
 */
export const ap =
  <A>(fa: Parser<A>) =>
  <B>(fab: Parser<(a: A) => B>): Parser<B> =>
    parser.ap(fab, fa)

// taken from fp-ts 2.0.1 https://github.com/gcanti/fp-ts/blob/2.0.1/src/pipeable.ts#L1028
/**
 * @category parsers
 * @since 0.5.1
 */
export const apFirst =
  <B>(fb: Parser<B>) =>
  <A>(fa: Parser<A>): Parser<A> =>
    parser.ap(
      parser.map(fa, (a) => () => a),
      fb
    )

// taken from fp-ts 2.0.1 https://github.com/gcanti/fp-ts/blob/2.0.1/src/pipeable.ts#L1031
/**
 * @category parsers
 * @since 0.5.1
 */
export const apSecond =
  <B>(fb: Parser<B>) =>
  <A>(fa: Parser<A>): Parser<B> =>
    parser.ap(
      parser.map(fa, () => (b: B) => b),
      fb
    )

/**
 * @category parsers
 * @since 0.5.1
 */
export const chain =
  <A, B>(f: (a: A) => Parser<B>) =>
  (ma: Parser<A>): Parser<B> =>
    parser.chain(ma, f)

/**
 * @category parsers
 * @since 0.5.1
 */
export const chainFirst =
  <A, B>(f: (a: A) => Parser<B>) =>
  (ma: Parser<A>): Parser<A> =>
    parser.chain(ma, (a) => parser.map(f(a), () => a))

/**
 * @category parsers
 * @since 0.5.1
 */
export const flatten = <A>(mma: Parser<Parser<A>>): Parser<A> => parser.chain(mma, identity)

/**
 * @category parsers
 * @since 0.5.1
 */
export const map =
  <A, B>(f: (a: A) => B) =>
  (fa: Parser<A>): Parser<B> =>
    parser.map(fa, f)

/**
 * @category parsers
 * @since 0.6.0
 */
export const then =
  <B>(fb: Parser<B>) =>
  <A>(fa: Parser<A> & Parser<RowLacks<A, keyof B>>): Parser<A & B> =>
    fa.then(fb as any)

// --- Helpers
const assign =
  <A>(a: A) =>
  <B>(b: B): A & B =>
    Object.assign({}, a, b)
