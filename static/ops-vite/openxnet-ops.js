// @__NO_SIDE_EFFECTS__
function vl(e) {
  const t = /* @__PURE__ */ Object.create(null);
  for (const n of e.split(",")) t[n] = 1;
  return (n) => n in t;
}
const De = {}, ds = [], $t = () => {
}, Ca = () => !1, _n = (e) => e.charCodeAt(0) === 111 && e.charCodeAt(1) === 110 && // uppercase letter
(e.charCodeAt(2) > 122 || e.charCodeAt(2) < 97), bn = (e) => e.startsWith("onUpdate:"), et = Object.assign, gl = (e, t) => {
  const n = e.indexOf(t);
  n > -1 && e.splice(n, 1);
}, ui = Object.prototype.hasOwnProperty, Ee = (e, t) => ui.call(e, t), me = Array.isArray, ps = (e) => zs(e) === "[object Map]", ks = (e) => zs(e) === "[object Set]", Kl = (e) => zs(e) === "[object Date]", xe = (e) => typeof e == "function", Ue = (e) => typeof e == "string", At = (e) => typeof e == "symbol", Pe = (e) => e !== null && typeof e == "object", Ma = (e) => (Pe(e) || xe(e)) && xe(e.then) && xe(e.catch), Ra = Object.prototype.toString, zs = (e) => Ra.call(e), ci = (e) => zs(e).slice(8, -1), Ta = (e) => zs(e) === "[object Object]", ml = (e) => Ue(e) && e !== "NaN" && e[0] !== "-" && "" + parseInt(e, 10) === e, Es = /* @__PURE__ */ vl(
  // the leading comma is intentional so empty string "" is also included
  ",key,ref,ref_for,ref_key,onVnodeBeforeMount,onVnodeMounted,onVnodeBeforeUpdate,onVnodeUpdated,onVnodeBeforeUnmount,onVnodeUnmounted"
), xn = (e) => {
  const t = /* @__PURE__ */ Object.create(null);
  return ((n) => t[n] || (t[n] = e(n)));
}, di = /-\w/g, bt = xn(
  (e) => e.replace(di, (t) => t.slice(1).toUpperCase())
), pi = /\B([A-Z])/g, Jt = xn(
  (e) => e.replace(pi, "-$1").toLowerCase()
), $a = xn((e) => e.charAt(0).toUpperCase() + e.slice(1)), Nn = xn(
  (e) => e ? `on${$a(e)}` : ""
), Tt = (e, t) => !Object.is(e, t), on = (e, ...t) => {
  for (let n = 0; n < e.length; n++)
    e[n](...t);
}, Aa = (e, t, n, a = !1) => {
  Object.defineProperty(e, t, {
    configurable: !0,
    enumerable: !1,
    writable: a,
    value: n
  });
}, kn = (e) => {
  const t = parseFloat(e);
  return isNaN(t) ? e : t;
};
let ql;
const Sn = () => ql || (ql = typeof globalThis < "u" ? globalThis : typeof self < "u" ? self : typeof window < "u" ? window : typeof globalThis < "u" ? globalThis : {});
function pt(e) {
  if (me(e)) {
    const t = {};
    for (let n = 0; n < e.length; n++) {
      const a = e[n], o = Ue(a) ? mi(a) : pt(a);
      if (o)
        for (const i in o)
          t[i] = o[i];
    }
    return t;
  } else if (Ue(e) || Pe(e))
    return e;
}
const fi = /;(?![^(]*\))/g, vi = /:([^]+)/, gi = /\/\*[^]*?\*\//g;
function mi(e) {
  const t = {};
  return e.replace(gi, "").split(fi).forEach((n) => {
    if (n) {
      const a = n.split(vi);
      a.length > 1 && (t[a[0].trim()] = a[1].trim());
    }
  }), t;
}
function q(e) {
  let t = "";
  if (Ue(e))
    t = e;
  else if (me(e))
    for (let n = 0; n < e.length; n++) {
      const a = q(e[n]);
      a && (t += a + " ");
    }
  else if (Pe(e))
    for (const n in e)
      e[n] && (t += n + " ");
  return t.trim();
}
const yi = "itemscope,allowfullscreen,formnovalidate,ismap,nomodule,novalidate,readonly", hi = /* @__PURE__ */ vl(yi);
function Ia(e) {
  return !!e || e === "";
}
function _i(e, t) {
  if (e.length !== t.length) return !1;
  let n = !0;
  for (let a = 0; n && a < e.length; a++)
    n = Ss(e[a], t[a]);
  return n;
}
function Ss(e, t) {
  if (e === t) return !0;
  let n = Kl(e), a = Kl(t);
  if (n || a)
    return n && a ? e.getTime() === t.getTime() : !1;
  if (n = At(e), a = At(t), n || a)
    return e === t;
  if (n = me(e), a = me(t), n || a)
    return n && a ? _i(e, t) : !1;
  if (n = Pe(e), a = Pe(t), n || a) {
    if (!n || !a)
      return !1;
    const o = Object.keys(e).length, i = Object.keys(t).length;
    if (o !== i)
      return !1;
    for (const p in e) {
      const f = e.hasOwnProperty(p), g = t.hasOwnProperty(p);
      if (f && !g || !f && g || !Ss(e[p], t[p]))
        return !1;
    }
  }
  return String(e) === String(t);
}
function yl(e, t) {
  return e.findIndex((n) => Ss(n, t));
}
const Ea = (e) => !!(e && e.__v_isRef === !0), l = (e) => Ue(e) ? e : e == null ? "" : me(e) || Pe(e) && (e.toString === Ra || !xe(e.toString)) ? Ea(e) ? l(e.value) : JSON.stringify(e, Pa, 2) : String(e), Pa = (e, t) => Ea(t) ? Pa(e, t.value) : ps(t) ? {
  [`Map(${t.size})`]: [...t.entries()].reduce(
    (n, [a, o], i) => (n[jn(a, i) + " =>"] = o, n),
    {}
  )
} : ks(t) ? {
  [`Set(${t.size})`]: [...t.values()].map((n) => jn(n))
} : At(t) ? jn(t) : Pe(t) && !me(t) && !Ta(t) ? String(t) : t, jn = (e, t = "") => {
  var n;
  return (
    // Symbol.description in es2019+ so we need to cast here to pass
    // the lib: es2016 check
    At(e) ? `Symbol(${(n = e.description) != null ? n : t})` : e
  );
};
let Ge;
class bi {
  // TODO isolatedDeclarations "__v_skip"
  constructor(t = !1) {
    this.detached = t, this._active = !0, this._on = 0, this.effects = [], this.cleanups = [], this._isPaused = !1, this._warnOnRun = !0, this.__v_skip = !0, !t && Ge && (Ge.active ? (this.parent = Ge, this.index = (Ge.scopes || (Ge.scopes = [])).push(
      this
    ) - 1) : (this._active = !1, this._warnOnRun = !1));
  }
  get active() {
    return this._active;
  }
  pause() {
    if (this._active) {
      this._isPaused = !0;
      let t, n;
      if (this.scopes)
        for (t = 0, n = this.scopes.length; t < n; t++)
          this.scopes[t].pause();
      for (t = 0, n = this.effects.length; t < n; t++)
        this.effects[t].pause();
    }
  }
  /**
   * Resumes the effect scope, including all child scopes and effects.
   */
  resume() {
    if (this._active && this._isPaused) {
      this._isPaused = !1;
      let t, n;
      if (this.scopes)
        for (t = 0, n = this.scopes.length; t < n; t++)
          this.scopes[t].resume();
      for (t = 0, n = this.effects.length; t < n; t++)
        this.effects[t].resume();
    }
  }
  run(t) {
    if (this._active) {
      const n = Ge;
      try {
        return Ge = this, t();
      } finally {
        Ge = n;
      }
    }
  }
  /**
   * This should only be called on non-detached scopes
   * @internal
   */
  on() {
    ++this._on === 1 && (this.prevScope = Ge, Ge = this);
  }
  /**
   * This should only be called on non-detached scopes
   * @internal
   */
  off() {
    if (this._on > 0 && --this._on === 0) {
      if (Ge === this)
        Ge = this.prevScope;
      else {
        let t = Ge;
        for (; t; ) {
          if (t.prevScope === this) {
            t.prevScope = this.prevScope;
            break;
          }
          t = t.prevScope;
        }
      }
      this.prevScope = void 0;
    }
  }
  stop(t) {
    if (this._active) {
      this._active = !1;
      let n, a;
      for (n = 0, a = this.effects.length; n < a; n++)
        this.effects[n].stop();
      for (this.effects.length = 0, n = 0, a = this.cleanups.length; n < a; n++)
        this.cleanups[n]();
      if (this.cleanups.length = 0, this.scopes) {
        for (n = 0, a = this.scopes.length; n < a; n++)
          this.scopes[n].stop(!0);
        this.scopes.length = 0;
      }
      if (!this.detached && this.parent && !t) {
        const o = this.parent.scopes.pop();
        o && o !== this && (this.parent.scopes[this.index] = o, o.index = this.index);
      }
      this.parent = void 0;
    }
  }
}
function xi() {
  return Ge;
}
let Oe;
const Wn = /* @__PURE__ */ new WeakSet();
class Da {
  constructor(t) {
    this.fn = t, this.deps = void 0, this.depsTail = void 0, this.flags = 5, this.next = void 0, this.cleanup = void 0, this.scheduler = void 0, Ge && (Ge.active ? Ge.effects.push(this) : this.flags &= -2);
  }
  pause() {
    this.flags |= 64;
  }
  resume() {
    this.flags & 64 && (this.flags &= -65, Wn.has(this) && (Wn.delete(this), this.trigger()));
  }
  /**
   * @internal
   */
  notify() {
    this.flags & 2 && !(this.flags & 32) || this.flags & 8 || Va(this);
  }
  run() {
    if (!(this.flags & 1))
      return this.fn();
    this.flags |= 2, Hl(this), La(this);
    const t = Oe, n = xt;
    Oe = this, xt = !0;
    try {
      return this.fn();
    } finally {
      Fa(this), Oe = t, xt = n, this.flags &= -3;
    }
  }
  stop() {
    if (this.flags & 1) {
      for (let t = this.deps; t; t = t.nextDep)
        bl(t);
      this.deps = this.depsTail = void 0, Hl(this), this.onStop && this.onStop(), this.flags &= -2;
    }
  }
  trigger() {
    this.flags & 64 ? Wn.add(this) : this.scheduler ? this.scheduler() : this.runIfDirty();
  }
  /**
   * @internal
   */
  runIfDirty() {
    el(this) && this.run();
  }
  get dirty() {
    return el(this);
  }
}
let Oa = 0, Ps, Ds;
function Va(e, t = !1) {
  if (e.flags |= 8, t) {
    e.next = Ds, Ds = e;
    return;
  }
  e.next = Ps, Ps = e;
}
function hl() {
  Oa++;
}
function _l() {
  if (--Oa > 0)
    return;
  if (Ds) {
    let t = Ds;
    for (Ds = void 0; t; ) {
      const n = t.next;
      t.next = void 0, t.flags &= -9, t = n;
    }
  }
  let e;
  for (; Ps; ) {
    let t = Ps;
    for (Ps = void 0; t; ) {
      const n = t.next;
      if (t.next = void 0, t.flags &= -9, t.flags & 1)
        try {
          t.trigger();
        } catch (a) {
          e || (e = a);
        }
      t = n;
    }
  }
  if (e) throw e;
}
function La(e) {
  for (let t = e.deps; t; t = t.nextDep)
    t.version = -1, t.prevActiveLink = t.dep.activeLink, t.dep.activeLink = t;
}
function Fa(e) {
  let t, n = e.depsTail, a = n;
  for (; a; ) {
    const o = a.prevDep;
    a.version === -1 ? (a === n && (n = o), bl(a), ki(a)) : t = a, a.dep.activeLink = a.prevActiveLink, a.prevActiveLink = void 0, a = o;
  }
  e.deps = t, e.depsTail = n;
}
function el(e) {
  for (let t = e.deps; t; t = t.nextDep)
    if (t.dep.version !== t.version || t.dep.computed && (Na(t.dep.computed) || t.dep.version !== t.version))
      return !0;
  return !!e._dirty;
}
function Na(e) {
  if (e.flags & 4 && !(e.flags & 16) || (e.flags &= -17, e.globalVersion === js) || (e.globalVersion = js, !e.isSSR && e.flags & 128 && (!e.deps && !e._dirty || !el(e))))
    return;
  e.flags |= 2;
  const t = e.dep, n = Oe, a = xt;
  Oe = e, xt = !0;
  try {
    La(e);
    const o = e.fn(e._value);
    (t.version === 0 || Tt(o, e._value)) && (e.flags |= 128, e._value = o, t.version++);
  } catch (o) {
    throw t.version++, o;
  } finally {
    Oe = n, xt = a, Fa(e), e.flags &= -3;
  }
}
function bl(e, t = !1) {
  const { dep: n, prevSub: a, nextSub: o } = e;
  if (a && (a.nextSub = o, e.prevSub = void 0), o && (o.prevSub = a, e.nextSub = void 0), n.subs === e && (n.subs = a, !a && n.computed)) {
    n.computed.flags &= -5;
    for (let i = n.computed.deps; i; i = i.nextDep)
      bl(i, !0);
  }
  !t && !--n.sc && n.map && n.map.delete(n.key);
}
function ki(e) {
  const { prevDep: t, nextDep: n } = e;
  t && (t.nextDep = n, e.prevDep = void 0), n && (n.prevDep = t, e.nextDep = void 0);
}
let xt = !0;
const ja = [];
function jt() {
  ja.push(xt), xt = !1;
}
function Wt() {
  const e = ja.pop();
  xt = e === void 0 ? !0 : e;
}
function Hl(e) {
  const { cleanup: t } = e;
  if (e.cleanup = void 0, t) {
    const n = Oe;
    Oe = void 0;
    try {
      t();
    } finally {
      Oe = n;
    }
  }
}
let js = 0;
class Si {
  constructor(t, n) {
    this.sub = t, this.dep = n, this.version = n.version, this.nextDep = this.prevDep = this.nextSub = this.prevSub = this.prevActiveLink = void 0;
  }
}
class xl {
  // TODO isolatedDeclarations "__v_skip"
  constructor(t) {
    this.computed = t, this.version = 0, this.activeLink = void 0, this.subs = void 0, this.map = void 0, this.key = void 0, this.sc = 0, this.__v_skip = !0;
  }
  track(t) {
    if (!Oe || !xt || Oe === this.computed)
      return;
    let n = this.activeLink;
    if (n === void 0 || n.sub !== Oe)
      n = this.activeLink = new Si(Oe, this), Oe.deps ? (n.prevDep = Oe.depsTail, Oe.depsTail.nextDep = n, Oe.depsTail = n) : Oe.deps = Oe.depsTail = n, Wa(n);
    else if (n.version === -1 && (n.version = this.version, n.nextDep)) {
      const a = n.nextDep;
      a.prevDep = n.prevDep, n.prevDep && (n.prevDep.nextDep = a), n.prevDep = Oe.depsTail, n.nextDep = void 0, Oe.depsTail.nextDep = n, Oe.depsTail = n, Oe.deps === n && (Oe.deps = a);
    }
    return n;
  }
  trigger(t) {
    this.version++, js++, this.notify(t);
  }
  notify(t) {
    hl();
    try {
      for (let n = this.subs; n; n = n.prevSub)
        n.sub.notify() && n.sub.dep.notify();
    } finally {
      _l();
    }
  }
}
function Wa(e) {
  if (e.dep.sc++, e.sub.flags & 4) {
    const t = e.dep.computed;
    if (t && !e.dep.subs) {
      t.flags |= 20;
      for (let a = t.deps; a; a = a.nextDep)
        Wa(a);
    }
    const n = e.dep.subs;
    n !== e && (e.prevSub = n, n && (n.nextSub = e)), e.dep.subs = e;
  }
}
const tl = /* @__PURE__ */ new WeakMap(), os = /* @__PURE__ */ Symbol(
  ""
), sl = /* @__PURE__ */ Symbol(
  ""
), Ws = /* @__PURE__ */ Symbol(
  ""
);
function Je(e, t, n) {
  if (xt && Oe) {
    let a = tl.get(e);
    a || tl.set(e, a = /* @__PURE__ */ new Map());
    let o = a.get(n);
    o || (a.set(n, o = new xl()), o.map = a, o.key = n), o.track();
  }
}
function Lt(e, t, n, a, o, i) {
  const p = tl.get(e);
  if (!p) {
    js++;
    return;
  }
  const f = (g) => {
    g && g.trigger();
  };
  if (hl(), t === "clear")
    p.forEach(f);
  else {
    const g = me(e), m = g && ml(n);
    if (g && n === "length") {
      const h = Number(a);
      p.forEach((R, b) => {
        (b === "length" || b === Ws || !At(b) && b >= h) && f(R);
      });
    } else
      switch ((n !== void 0 || p.has(void 0)) && f(p.get(n)), m && f(p.get(Ws)), t) {
        case "add":
          g ? m && f(p.get("length")) : (f(p.get(os)), ps(e) && f(p.get(sl)));
          break;
        case "delete":
          g || (f(p.get(os)), ps(e) && f(p.get(sl)));
          break;
        case "set":
          ps(e) && f(p.get(os));
          break;
      }
  }
  _l();
}
function us(e) {
  const t = /* @__PURE__ */ Ae(e);
  return t === e ? t : (Je(t, "iterate", Ws), /* @__PURE__ */ gt(e) ? t : t.map(St));
}
function wn(e) {
  return Je(e = /* @__PURE__ */ Ae(e), "iterate", Ws), e;
}
function Mt(e, t) {
  return /* @__PURE__ */ Bt(e) ? ms(/* @__PURE__ */ is(e) ? St(t) : t) : St(t);
}
const wi = {
  __proto__: null,
  [Symbol.iterator]() {
    return Bn(this, Symbol.iterator, (e) => Mt(this, e));
  },
  concat(...e) {
    return us(this).concat(
      ...e.map((t) => me(t) ? us(t) : t)
    );
  },
  entries() {
    return Bn(this, "entries", (e) => (e[1] = Mt(this, e[1]), e));
  },
  every(e, t) {
    return Et(this, "every", e, t, void 0, arguments);
  },
  filter(e, t) {
    return Et(
      this,
      "filter",
      e,
      t,
      (n) => n.map((a) => Mt(this, a)),
      arguments
    );
  },
  find(e, t) {
    return Et(
      this,
      "find",
      e,
      t,
      (n) => Mt(this, n),
      arguments
    );
  },
  findIndex(e, t) {
    return Et(this, "findIndex", e, t, void 0, arguments);
  },
  findLast(e, t) {
    return Et(
      this,
      "findLast",
      e,
      t,
      (n) => Mt(this, n),
      arguments
    );
  },
  findLastIndex(e, t) {
    return Et(this, "findLastIndex", e, t, void 0, arguments);
  },
  // flat, flatMap could benefit from ARRAY_ITERATE but are not straight-forward to implement
  forEach(e, t) {
    return Et(this, "forEach", e, t, void 0, arguments);
  },
  includes(...e) {
    return Un(this, "includes", e);
  },
  indexOf(...e) {
    return Un(this, "indexOf", e);
  },
  join(e) {
    return us(this).join(e);
  },
  // keys() iterator only reads `length`, no optimization required
  lastIndexOf(...e) {
    return Un(this, "lastIndexOf", e);
  },
  map(e, t) {
    return Et(this, "map", e, t, void 0, arguments);
  },
  pop() {
    return Ms(this, "pop");
  },
  push(...e) {
    return Ms(this, "push", e);
  },
  reduce(e, ...t) {
    return zl(this, "reduce", e, t);
  },
  reduceRight(e, ...t) {
    return zl(this, "reduceRight", e, t);
  },
  shift() {
    return Ms(this, "shift");
  },
  // slice could use ARRAY_ITERATE but also seems to beg for range tracking
  some(e, t) {
    return Et(this, "some", e, t, void 0, arguments);
  },
  splice(...e) {
    return Ms(this, "splice", e);
  },
  toReversed() {
    return us(this).toReversed();
  },
  toSorted(e) {
    return us(this).toSorted(e);
  },
  toSpliced(...e) {
    return us(this).toSpliced(...e);
  },
  unshift(...e) {
    return Ms(this, "unshift", e);
  },
  values() {
    return Bn(this, "values", (e) => Mt(this, e));
  }
};
function Bn(e, t, n) {
  const a = wn(e), o = a[t]();
  return a !== e && !/* @__PURE__ */ gt(e) && (o._next = o.next, o.next = () => {
    const i = o._next();
    return i.done || (i.value = n(i.value)), i;
  }), o;
}
const Ci = Array.prototype;
function Et(e, t, n, a, o, i) {
  const p = wn(e), f = p !== e && !/* @__PURE__ */ gt(e), g = p[t];
  if (g !== Ci[t]) {
    const R = g.apply(e, i);
    return f ? St(R) : R;
  }
  let m = n;
  p !== e && (f ? m = function(R, b) {
    return n.call(this, Mt(e, R), b, e);
  } : n.length > 2 && (m = function(R, b) {
    return n.call(this, R, b, e);
  }));
  const h = g.call(p, m, a);
  return f && o ? o(h) : h;
}
function zl(e, t, n, a) {
  const o = wn(e), i = o !== e && !/* @__PURE__ */ gt(e);
  let p = n, f = !1;
  o !== e && (i ? (f = a.length === 0, p = function(m, h, R) {
    return f && (f = !1, m = Mt(e, m)), n.call(this, m, Mt(e, h), R, e);
  }) : n.length > 3 && (p = function(m, h, R) {
    return n.call(this, m, h, R, e);
  }));
  const g = o[t](p, ...a);
  return f ? Mt(e, g) : g;
}
function Un(e, t, n) {
  const a = /* @__PURE__ */ Ae(e);
  Je(a, "iterate", Ws);
  const o = a[t](...n);
  return (o === -1 || o === !1) && /* @__PURE__ */ Cl(n[0]) ? (n[0] = /* @__PURE__ */ Ae(n[0]), a[t](...n)) : o;
}
function Ms(e, t, n = []) {
  jt(), hl();
  const a = (/* @__PURE__ */ Ae(e))[t].apply(e, n);
  return _l(), Wt(), a;
}
const Mi = /* @__PURE__ */ vl("__proto__,__v_isRef,__isVue"), Ba = new Set(
  /* @__PURE__ */ Object.getOwnPropertyNames(Symbol).filter((e) => e !== "arguments" && e !== "caller").map((e) => Symbol[e]).filter(At)
);
function Ri(e) {
  At(e) || (e = String(e));
  const t = /* @__PURE__ */ Ae(this);
  return Je(t, "has", e), t.hasOwnProperty(e);
}
class Ua {
  constructor(t = !1, n = !1) {
    this._isReadonly = t, this._isShallow = n;
  }
  get(t, n, a) {
    if (n === "__v_skip") return t.__v_skip;
    const o = this._isReadonly, i = this._isShallow;
    if (n === "__v_isReactive")
      return !o;
    if (n === "__v_isReadonly")
      return o;
    if (n === "__v_isShallow")
      return i;
    if (n === "__v_raw")
      return a === (o ? i ? Li : za : i ? Ha : qa).get(t) || // receiver is not the reactive proxy, but has the same prototype
      // this means the receiver is a user proxy of the reactive proxy
      Object.getPrototypeOf(t) === Object.getPrototypeOf(a) ? t : void 0;
    const p = me(t);
    if (!o) {
      let g;
      if (p && (g = wi[n]))
        return g;
      if (n === "hasOwnProperty")
        return Ri;
    }
    const f = Reflect.get(
      t,
      n,
      // if this is a proxy wrapping a ref, return methods using the raw ref
      // as receiver so that we don't have to call `toRaw` on the ref in all
      // its class methods
      /* @__PURE__ */ Ze(t) ? t : a
    );
    if ((At(n) ? Ba.has(n) : Mi(n)) || (o || Je(t, "get", n), i))
      return f;
    if (/* @__PURE__ */ Ze(f)) {
      const g = p && ml(n) ? f : f.value;
      return o && Pe(g) ? /* @__PURE__ */ ll(g) : g;
    }
    return Pe(f) ? o ? /* @__PURE__ */ ll(f) : /* @__PURE__ */ Sl(f) : f;
  }
}
class Ka extends Ua {
  constructor(t = !1) {
    super(!1, t);
  }
  set(t, n, a, o) {
    let i = t[n];
    const p = me(t) && ml(n);
    if (!this._isShallow) {
      const m = /* @__PURE__ */ Bt(i);
      if (!/* @__PURE__ */ gt(a) && !/* @__PURE__ */ Bt(a) && (i = /* @__PURE__ */ Ae(i), a = /* @__PURE__ */ Ae(a)), !p && /* @__PURE__ */ Ze(i) && !/* @__PURE__ */ Ze(a))
        return m || (i.value = a), !0;
    }
    const f = p ? Number(n) < t.length : Ee(t, n), g = Reflect.set(
      t,
      n,
      a,
      /* @__PURE__ */ Ze(t) ? t : o
    );
    return t === /* @__PURE__ */ Ae(o) && (f ? Tt(a, i) && Lt(t, "set", n, a) : Lt(t, "add", n, a)), g;
  }
  deleteProperty(t, n) {
    const a = Ee(t, n);
    t[n];
    const o = Reflect.deleteProperty(t, n);
    return o && a && Lt(t, "delete", n, void 0), o;
  }
  has(t, n) {
    const a = Reflect.has(t, n);
    return (!At(n) || !Ba.has(n)) && Je(t, "has", n), a;
  }
  ownKeys(t) {
    return Je(
      t,
      "iterate",
      me(t) ? "length" : os
    ), Reflect.ownKeys(t);
  }
}
class Ti extends Ua {
  constructor(t = !1) {
    super(!0, t);
  }
  set(t, n) {
    return !0;
  }
  deleteProperty(t, n) {
    return !0;
  }
}
const $i = /* @__PURE__ */ new Ka(), Ai = /* @__PURE__ */ new Ti(), Ii = /* @__PURE__ */ new Ka(!0);
const nl = (e) => e, tn = (e) => Reflect.getPrototypeOf(e);
function Ei(e, t, n) {
  return function(...a) {
    const o = this.__v_raw, i = /* @__PURE__ */ Ae(o), p = ps(i), f = e === "entries" || e === Symbol.iterator && p, g = e === "keys" && p, m = o[e](...a), h = n ? nl : t ? ms : St;
    return !t && Je(
      i,
      "iterate",
      g ? sl : os
    ), et(
      // inheriting all iterator properties
      Object.create(m),
      {
        // iterator protocol
        next() {
          const { value: R, done: b } = m.next();
          return b ? { value: R, done: b } : {
            value: f ? [h(R[0]), h(R[1])] : h(R),
            done: b
          };
        }
      }
    );
  };
}
function sn(e) {
  return function(...t) {
    return e === "delete" ? !1 : e === "clear" ? void 0 : this;
  };
}
function Pi(e, t) {
  const n = {
    get(o) {
      const i = this.__v_raw, p = /* @__PURE__ */ Ae(i), f = /* @__PURE__ */ Ae(o);
      e || (Tt(o, f) && Je(p, "get", o), Je(p, "get", f));
      const { has: g } = tn(p), m = t ? nl : e ? ms : St;
      if (g.call(p, o))
        return m(i.get(o));
      if (g.call(p, f))
        return m(i.get(f));
      i !== p && i.get(o);
    },
    get size() {
      const o = this.__v_raw;
      return !e && Je(/* @__PURE__ */ Ae(o), "iterate", os), o.size;
    },
    has(o) {
      const i = this.__v_raw, p = /* @__PURE__ */ Ae(i), f = /* @__PURE__ */ Ae(o);
      return e || (Tt(o, f) && Je(p, "has", o), Je(p, "has", f)), o === f ? i.has(o) : i.has(o) || i.has(f);
    },
    forEach(o, i) {
      const p = this, f = p.__v_raw, g = /* @__PURE__ */ Ae(f), m = t ? nl : e ? ms : St;
      return !e && Je(g, "iterate", os), f.forEach((h, R) => o.call(i, m(h), m(R), p));
    }
  };
  return et(
    n,
    e ? {
      add: sn("add"),
      set: sn("set"),
      delete: sn("delete"),
      clear: sn("clear")
    } : {
      add(o) {
        const i = /* @__PURE__ */ Ae(this), p = tn(i), f = /* @__PURE__ */ Ae(o), g = !t && !/* @__PURE__ */ gt(o) && !/* @__PURE__ */ Bt(o) ? f : o;
        return p.has.call(i, g) || Tt(o, g) && p.has.call(i, o) || Tt(f, g) && p.has.call(i, f) || (i.add(g), Lt(i, "add", g, g)), this;
      },
      set(o, i) {
        !t && !/* @__PURE__ */ gt(i) && !/* @__PURE__ */ Bt(i) && (i = /* @__PURE__ */ Ae(i));
        const p = /* @__PURE__ */ Ae(this), { has: f, get: g } = tn(p);
        let m = f.call(p, o);
        m || (o = /* @__PURE__ */ Ae(o), m = f.call(p, o));
        const h = g.call(p, o);
        return p.set(o, i), m ? Tt(i, h) && Lt(p, "set", o, i) : Lt(p, "add", o, i), this;
      },
      delete(o) {
        const i = /* @__PURE__ */ Ae(this), { has: p, get: f } = tn(i);
        let g = p.call(i, o);
        g || (o = /* @__PURE__ */ Ae(o), g = p.call(i, o)), f && f.call(i, o);
        const m = i.delete(o);
        return g && Lt(i, "delete", o, void 0), m;
      },
      clear() {
        const o = /* @__PURE__ */ Ae(this), i = o.size !== 0, p = o.clear();
        return i && Lt(
          o,
          "clear",
          void 0,
          void 0
        ), p;
      }
    }
  ), [
    "keys",
    "values",
    "entries",
    Symbol.iterator
  ].forEach((o) => {
    n[o] = Ei(o, e, t);
  }), n;
}
function kl(e, t) {
  const n = Pi(e, t);
  return (a, o, i) => o === "__v_isReactive" ? !e : o === "__v_isReadonly" ? e : o === "__v_raw" ? a : Reflect.get(
    Ee(n, o) && o in a ? n : a,
    o,
    i
  );
}
const Di = {
  get: /* @__PURE__ */ kl(!1, !1)
}, Oi = {
  get: /* @__PURE__ */ kl(!1, !0)
}, Vi = {
  get: /* @__PURE__ */ kl(!0, !1)
};
const qa = /* @__PURE__ */ new WeakMap(), Ha = /* @__PURE__ */ new WeakMap(), za = /* @__PURE__ */ new WeakMap(), Li = /* @__PURE__ */ new WeakMap();
function Fi(e) {
  switch (e) {
    case "Object":
    case "Array":
      return 1;
    case "Map":
    case "Set":
    case "WeakMap":
    case "WeakSet":
      return 2;
    default:
      return 0;
  }
}
function Ni(e) {
  return e.__v_skip || !Object.isExtensible(e) ? 0 : Fi(ci(e));
}
// @__NO_SIDE_EFFECTS__
function Sl(e) {
  return /* @__PURE__ */ Bt(e) ? e : wl(
    e,
    !1,
    $i,
    Di,
    qa
  );
}
// @__NO_SIDE_EFFECTS__
function ji(e) {
  return wl(
    e,
    !1,
    Ii,
    Oi,
    Ha
  );
}
// @__NO_SIDE_EFFECTS__
function ll(e) {
  return wl(
    e,
    !0,
    Ai,
    Vi,
    za
  );
}
function wl(e, t, n, a, o) {
  if (!Pe(e) || e.__v_raw && !(t && e.__v_isReactive))
    return e;
  const i = Ni(e);
  if (i === 0)
    return e;
  const p = o.get(e);
  if (p)
    return p;
  const f = new Proxy(
    e,
    i === 2 ? a : n
  );
  return o.set(e, f), f;
}
// @__NO_SIDE_EFFECTS__
function is(e) {
  return /* @__PURE__ */ Bt(e) ? /* @__PURE__ */ is(e.__v_raw) : !!(e && e.__v_isReactive);
}
// @__NO_SIDE_EFFECTS__
function Bt(e) {
  return !!(e && e.__v_isReadonly);
}
// @__NO_SIDE_EFFECTS__
function gt(e) {
  return !!(e && e.__v_isShallow);
}
// @__NO_SIDE_EFFECTS__
function Cl(e) {
  return e ? !!e.__v_raw : !1;
}
// @__NO_SIDE_EFFECTS__
function Ae(e) {
  const t = e && e.__v_raw;
  return t ? /* @__PURE__ */ Ae(t) : e;
}
function Wi(e) {
  return !Ee(e, "__v_skip") && Object.isExtensible(e) && Aa(e, "__v_skip", !0), e;
}
const St = (e) => Pe(e) ? /* @__PURE__ */ Sl(e) : e, ms = (e) => Pe(e) ? /* @__PURE__ */ ll(e) : e;
// @__NO_SIDE_EFFECTS__
function Ze(e) {
  return e ? e.__v_isRef === !0 : !1;
}
// @__NO_SIDE_EFFECTS__
function pe(e) {
  return Bi(e, !1);
}
function Bi(e, t) {
  return /* @__PURE__ */ Ze(e) ? e : new Ui(e, t);
}
class Ui {
  constructor(t, n) {
    this.dep = new xl(), this.__v_isRef = !0, this.__v_isShallow = !1, this._rawValue = n ? t : /* @__PURE__ */ Ae(t), this._value = n ? t : St(t), this.__v_isShallow = n;
  }
  get value() {
    return this.dep.track(), this._value;
  }
  set value(t) {
    const n = this._rawValue, a = this.__v_isShallow || /* @__PURE__ */ gt(t) || /* @__PURE__ */ Bt(t);
    t = a ? t : /* @__PURE__ */ Ae(t), Tt(t, n) && (this._rawValue = t, this._value = a ? t : St(t), this.dep.trigger());
  }
}
function ys(e) {
  return /* @__PURE__ */ Ze(e) ? e.value : e;
}
const Ki = {
  get: (e, t, n) => t === "__v_raw" ? e : ys(Reflect.get(e, t, n)),
  set: (e, t, n, a) => {
    const o = e[t];
    return /* @__PURE__ */ Ze(o) && !/* @__PURE__ */ Ze(n) ? (o.value = n, !0) : Reflect.set(e, t, n, a);
  }
};
function Ya(e) {
  return /* @__PURE__ */ is(e) ? e : new Proxy(e, Ki);
}
class qi {
  constructor(t, n, a) {
    this.fn = t, this.setter = n, this._value = void 0, this.dep = new xl(this), this.__v_isRef = !0, this.deps = void 0, this.depsTail = void 0, this.flags = 16, this.globalVersion = js - 1, this.next = void 0, this.effect = this, this.__v_isReadonly = !n, this.isSSR = a;
  }
  /**
   * @internal
   */
  notify() {
    if (this.flags |= 16, !(this.flags & 8) && // avoid infinite self recursion
    Oe !== this)
      return Va(this, !0), !0;
  }
  get value() {
    const t = this.dep.track();
    return Na(this), t && (t.version = this.dep.version), this._value;
  }
  set value(t) {
    this.setter && this.setter(t);
  }
}
// @__NO_SIDE_EFFECTS__
function Hi(e, t, n = !1) {
  let a, o;
  return xe(e) ? a = e : (a = e.get, o = e.set), new qi(a, o, n);
}
const nn = {}, dn = /* @__PURE__ */ new WeakMap();
let as;
function zi(e, t = !1, n = as) {
  if (n) {
    let a = dn.get(n);
    a || dn.set(n, a = []), a.push(e);
  }
}
function Yi(e, t, n = De) {
  const { immediate: a, deep: o, once: i, scheduler: p, augmentJob: f, call: g } = n, m = (w) => o ? w : /* @__PURE__ */ gt(w) || o === !1 || o === 0 ? Ft(w, 1) : Ft(w);
  let h, R, b, A, B = !1, J = !1;
  if (/* @__PURE__ */ Ze(e) ? (R = () => e.value, B = /* @__PURE__ */ gt(e)) : /* @__PURE__ */ is(e) ? (R = () => m(e), B = !0) : me(e) ? (J = !0, B = e.some((w) => /* @__PURE__ */ is(w) || /* @__PURE__ */ gt(w)), R = () => e.map((w) => {
    if (/* @__PURE__ */ Ze(w))
      return w.value;
    if (/* @__PURE__ */ is(w))
      return m(w);
    if (xe(w))
      return g ? g(w, 2) : w();
  })) : xe(e) ? t ? R = g ? () => g(e, 2) : e : R = () => {
    if (b) {
      jt();
      try {
        b();
      } finally {
        Wt();
      }
    }
    const w = as;
    as = h;
    try {
      return g ? g(e, 3, [A]) : e(A);
    } finally {
      as = w;
    }
  } : R = $t, t && o) {
    const w = R, _e = o === !0 ? 1 / 0 : o;
    R = () => Ft(w(), _e);
  }
  const G = xi(), $ = () => {
    h.stop(), G && G.active && gl(G.effects, h);
  };
  if (i && t) {
    const w = t;
    t = (..._e) => {
      w(..._e), $();
    };
  }
  let Q = J ? new Array(e.length).fill(nn) : nn;
  const ae = (w) => {
    if (!(!(h.flags & 1) || !h.dirty && !w))
      if (t) {
        const _e = h.run();
        if (o || B || (J ? _e.some((ye, ne) => Tt(ye, Q[ne])) : Tt(_e, Q))) {
          b && b();
          const ye = as;
          as = h;
          try {
            const ne = [
              _e,
              // pass undefined as the old value when it's changed for the first time
              Q === nn ? void 0 : J && Q[0] === nn ? [] : Q,
              A
            ];
            Q = _e, g ? g(t, 3, ne) : (
              // @ts-expect-error
              t(...ne)
            );
          } finally {
            as = ye;
          }
        }
      } else
        h.run();
  };
  return f && f(ae), h = new Da(R), h.scheduler = p ? () => p(ae, !1) : ae, A = (w) => zi(w, !1, h), b = h.onStop = () => {
    const w = dn.get(h);
    if (w) {
      if (g)
        g(w, 4);
      else
        for (const _e of w) _e();
      dn.delete(h);
    }
  }, t ? a ? ae(!0) : Q = h.run() : p ? p(ae.bind(null, !0), !0) : h.run(), $.pause = h.pause.bind(h), $.resume = h.resume.bind(h), $.stop = $, $;
}
function Ft(e, t = 1 / 0, n) {
  if (t <= 0 || !Pe(e) || e.__v_skip || (n = n || /* @__PURE__ */ new Map(), (n.get(e) || 0) >= t))
    return e;
  if (n.set(e, t), t--, /* @__PURE__ */ Ze(e))
    Ft(e.value, t, n);
  else if (me(e))
    for (let a = 0; a < e.length; a++)
      Ft(e[a], t, n);
  else if (ks(e) || ps(e))
    e.forEach((a) => {
      Ft(a, t, n);
    });
  else if (Ta(e)) {
    for (const a in e)
      Ft(e[a], t, n);
    for (const a of Object.getOwnPropertySymbols(e))
      Object.prototype.propertyIsEnumerable.call(e, a) && Ft(e[a], t, n);
  }
  return e;
}
function Ys(e, t, n, a) {
  try {
    return a ? e(...a) : e();
  } catch (o) {
    Cn(o, t, n);
  }
}
function It(e, t, n, a) {
  if (xe(e)) {
    const o = Ys(e, t, n, a);
    return o && Ma(o) && o.catch((i) => {
      Cn(i, t, n);
    }), o;
  }
  if (me(e)) {
    const o = [];
    for (let i = 0; i < e.length; i++)
      o.push(It(e[i], t, n, a));
    return o;
  }
}
function Cn(e, t, n, a = !0) {
  const o = t ? t.vnode : null, { errorHandler: i, throwUnhandledErrorInProduction: p } = t && t.appContext.config || De;
  if (t) {
    let f = t.parent;
    const g = t.proxy, m = `https://vuejs.org/error-reference/#runtime-${n}`;
    for (; f; ) {
      const h = f.ec;
      if (h) {
        for (let R = 0; R < h.length; R++)
          if (h[R](e, g, m) === !1)
            return;
      }
      f = f.parent;
    }
    if (i) {
      jt(), Ys(i, null, 10, [
        e,
        g,
        m
      ]), Wt();
      return;
    }
  }
  Gi(e, n, o, a, p);
}
function Gi(e, t, n, a = !0, o = !1) {
  if (o)
    throw e;
  console.error(e);
}
const lt = [];
let Ct = -1;
const fs = [];
let zt = null, cs = 0;
const Ga = /* @__PURE__ */ Promise.resolve();
let pn = null;
function Bs(e) {
  const t = pn || Ga;
  return e ? t.then(this ? e.bind(this) : e) : t;
}
function Qi(e) {
  let t = Ct + 1, n = lt.length;
  for (; t < n; ) {
    const a = t + n >>> 1, o = lt[a], i = Us(o);
    i < e || i === e && o.flags & 2 ? t = a + 1 : n = a;
  }
  return t;
}
function Ml(e) {
  if (!(e.flags & 1)) {
    const t = Us(e), n = lt[lt.length - 1];
    !n || // fast path when the job id is larger than the tail
    !(e.flags & 2) && t >= Us(n) ? lt.push(e) : lt.splice(Qi(t), 0, e), e.flags |= 1, Qa();
  }
}
function Qa() {
  pn || (pn = Ga.then(Ja));
}
function Xi(e) {
  me(e) ? fs.push(...e) : zt && e.id === -1 ? zt.splice(cs + 1, 0, e) : e.flags & 1 || (fs.push(e), e.flags |= 1), Qa();
}
function Yl(e, t, n = Ct + 1) {
  for (; n < lt.length; n++) {
    const a = lt[n];
    if (a && a.flags & 2) {
      if (e && a.id !== e.uid)
        continue;
      lt.splice(n, 1), n--, a.flags & 4 && (a.flags &= -2), a(), a.flags & 4 || (a.flags &= -2);
    }
  }
}
function Xa(e) {
  if (fs.length) {
    const t = [...new Set(fs)].sort(
      (n, a) => Us(n) - Us(a)
    );
    if (fs.length = 0, zt) {
      zt.push(...t);
      return;
    }
    for (zt = t, cs = 0; cs < zt.length; cs++) {
      const n = zt[cs];
      n.flags & 4 && (n.flags &= -2), n.flags & 8 || n(), n.flags &= -2;
    }
    zt = null, cs = 0;
  }
}
const Us = (e) => e.id == null ? e.flags & 2 ? -1 : 1 / 0 : e.id;
function Ja(e) {
  try {
    for (Ct = 0; Ct < lt.length; Ct++) {
      const t = lt[Ct];
      t && !(t.flags & 8) && (t.flags & 4 && (t.flags &= -2), Ys(
        t,
        t.i,
        t.i ? 15 : 14
      ), t.flags & 4 || (t.flags &= -2));
    }
  } finally {
    for (; Ct < lt.length; Ct++) {
      const t = lt[Ct];
      t && (t.flags &= -2);
    }
    Ct = -1, lt.length = 0, Xa(), pn = null, (lt.length || fs.length) && Ja();
  }
}
let vt = null, Za = null;
function fn(e) {
  const t = vt;
  return vt = e, Za = e && e.type.__scopeId || null, t;
}
function Ji(e, t = vt, n) {
  if (!t || e._n)
    return e;
  const a = (...o) => {
    a._d && aa(-1);
    const i = fn(t);
    let p;
    try {
      p = e(...o);
    } finally {
      fn(i), a._d && aa(1);
    }
    return p;
  };
  return a._n = !0, a._c = !0, a._d = !0, a;
}
function je(e, t) {
  if (vt === null)
    return e;
  const n = $n(vt), a = e.dirs || (e.dirs = []);
  for (let o = 0; o < t.length; o++) {
    let [i, p, f, g = De] = t[o];
    i && (xe(i) && (i = {
      mounted: i,
      updated: i
    }), i.deep && Ft(p), a.push({
      dir: i,
      instance: n,
      value: p,
      oldValue: void 0,
      arg: f,
      modifiers: g
    }));
  }
  return e;
}
function ss(e, t, n, a) {
  const o = e.dirs, i = t && t.dirs;
  for (let p = 0; p < o.length; p++) {
    const f = o[p];
    i && (f.oldValue = i[p].value);
    let g = f.dir[a];
    g && (jt(), It(g, n, 8, [
      e.el,
      f,
      e,
      t
    ]), Wt());
  }
}
function Zi(e, t) {
  if (at) {
    let n = at.provides;
    const a = at.parent && at.parent.provides;
    a === n && (n = at.provides = Object.create(a)), n[e] = t;
  }
}
function rn(e, t, n = !1) {
  const a = Qr();
  if (a || vs) {
    let o = vs ? vs._context.provides : a ? a.parent == null || a.ce ? a.vnode.appContext && a.vnode.appContext.provides : a.parent.provides : void 0;
    if (o && e in o)
      return o[e];
    if (arguments.length > 1)
      return n && xe(t) ? t.call(a && a.proxy) : t;
  }
}
const er = /* @__PURE__ */ Symbol.for("v-scx"), tr = () => rn(er);
function Gt(e, t, n) {
  return eo(e, t, n);
}
function eo(e, t, n = De) {
  const { immediate: a, deep: o, flush: i, once: p } = n, f = et({}, n), g = t && a || !t && i !== "post";
  let m;
  if (qs) {
    if (i === "sync") {
      const A = tr();
      m = A.__watcherHandles || (A.__watcherHandles = []);
    } else if (!g) {
      const A = () => {
      };
      return A.stop = $t, A.resume = $t, A.pause = $t, A;
    }
  }
  const h = at;
  f.call = (A, B, J) => It(A, h, B, J);
  let R = !1;
  i === "post" ? f.scheduler = (A) => {
    rt(A, h && h.suspense);
  } : i !== "sync" && (R = !0, f.scheduler = (A, B) => {
    B ? A() : Ml(A);
  }), f.augmentJob = (A) => {
    t && (A.flags |= 4), R && (A.flags |= 2, h && (A.id = h.uid, A.i = h));
  };
  const b = Yi(e, t, f);
  return qs && (m ? m.push(b) : g && b()), b;
}
function sr(e, t, n) {
  const a = this.proxy, o = Ue(e) ? e.includes(".") ? to(a, e) : () => a[e] : e.bind(a, a);
  let i;
  xe(t) ? i = t : (i = t.handler, n = t);
  const p = Gs(this), f = eo(o, i.bind(a), n);
  return p(), f;
}
function to(e, t) {
  const n = t.split(".");
  return () => {
    let a = e;
    for (let o = 0; o < n.length && a; o++)
      a = a[n[o]];
    return a;
  };
}
const nr = /* @__PURE__ */ Symbol("_vte"), lr = (e) => e.__isTeleport, ar = /* @__PURE__ */ Symbol("_leaveCb");
function Rl(e, t) {
  e.shapeFlag & 6 && e.component ? (e.transition = t, Rl(e.component.subTree, t)) : e.shapeFlag & 128 ? (e.ssContent.transition = t.clone(e.ssContent), e.ssFallback.transition = t.clone(e.ssFallback)) : e.transition = t;
}
function so(e) {
  e.ids = [e.ids[0] + e.ids[2]++ + "-", 0, 0];
}
function Gl(e, t) {
  let n;
  return !!((n = Object.getOwnPropertyDescriptor(e, t)) && !n.configurable);
}
const vn = /* @__PURE__ */ new WeakMap();
function Os(e, t, n, a, o = !1) {
  if (me(e)) {
    e.forEach(
      (J, G) => Os(
        J,
        t && (me(t) ? t[G] : t),
        n,
        a,
        o
      )
    );
    return;
  }
  if (Vs(a) && !o) {
    a.shapeFlag & 512 && a.type.__asyncResolved && a.component.subTree.component && Os(e, t, n, a.component.subTree);
    return;
  }
  const i = a.shapeFlag & 4 ? $n(a.component) : a.el, p = o ? null : i, { i: f, r: g } = e, m = t && t.r, h = f.refs === De ? f.refs = {} : f.refs, R = f.setupState, b = /* @__PURE__ */ Ae(R), A = R === De ? Ca : (J) => Gl(h, J) ? !1 : Ee(b, J), B = (J, G) => !(G && Gl(h, G));
  if (m != null && m !== g) {
    if (Ql(t), Ue(m))
      h[m] = null, A(m) && (R[m] = null);
    else if (/* @__PURE__ */ Ze(m)) {
      const J = t;
      B(m, J.k) && (m.value = null), J.k && (h[J.k] = null);
    }
  }
  if (xe(g))
    Ys(g, f, 12, [p, h]);
  else {
    const J = Ue(g), G = /* @__PURE__ */ Ze(g);
    if (J || G) {
      const $ = () => {
        if (e.f) {
          const Q = J ? A(g) ? R[g] : h[g] : B() || !e.k ? g.value : h[e.k];
          if (o)
            me(Q) && gl(Q, i);
          else if (me(Q))
            Q.includes(i) || Q.push(i);
          else if (J)
            h[g] = [i], A(g) && (R[g] = h[g]);
          else {
            const ae = [i];
            B(g, e.k) && (g.value = ae), e.k && (h[e.k] = ae);
          }
        } else J ? (h[g] = p, A(g) && (R[g] = p)) : G && (B(g, e.k) && (g.value = p), e.k && (h[e.k] = p));
      };
      if (p) {
        const Q = () => {
          $(), vn.delete(e);
        };
        Q.id = -1, vn.set(e, Q), rt(Q, n);
      } else
        Ql(e), $();
    }
  }
}
function Ql(e) {
  const t = vn.get(e);
  t && (t.flags |= 8, vn.delete(e));
}
Sn().requestIdleCallback;
Sn().cancelIdleCallback;
const Vs = (e) => !!e.type.__asyncLoader, no = (e) => e.type.__isKeepAlive;
function or(e, t) {
  lo(e, "a", t);
}
function ir(e, t) {
  lo(e, "da", t);
}
function lo(e, t, n = at) {
  const a = e.__wdc || (e.__wdc = () => {
    let o = n;
    for (; o; ) {
      if (o.isDeactivated)
        return;
      o = o.parent;
    }
    return e();
  });
  if (Mn(t, a, n), n) {
    let o = n.parent;
    for (; o && o.parent; )
      no(o.parent.vnode) && rr(a, t, n, o), o = o.parent;
  }
}
function rr(e, t, n, a) {
  const o = Mn(
    t,
    e,
    a,
    !0
    /* prepend */
  );
  ao(() => {
    gl(a[t], o);
  }, n);
}
function Mn(e, t, n = at, a = !1) {
  if (n) {
    const o = n[e] || (n[e] = []), i = t.__weh || (t.__weh = (...p) => {
      jt();
      const f = Gs(n), g = It(t, n, e, p);
      return f(), Wt(), g;
    });
    return a ? o.unshift(i) : o.push(i), i;
  }
}
const Ut = (e) => (t, n = at) => {
  (!qs || e === "sp") && Mn(e, (...a) => t(...a), n);
}, ur = Ut("bm"), Tl = Ut("m"), cr = Ut(
  "bu"
), dr = Ut("u"), $l = Ut(
  "bum"
), ao = Ut("um"), pr = Ut(
  "sp"
), fr = Ut("rtg"), vr = Ut("rtc");
function gr(e, t = at) {
  Mn("ec", e, t);
}
const mr = /* @__PURE__ */ Symbol.for("v-ndc");
function U(e, t, n, a) {
  let o;
  const i = n, p = me(e);
  if (p || Ue(e)) {
    const f = p && /* @__PURE__ */ is(e);
    let g = !1, m = !1;
    f && (g = !/* @__PURE__ */ gt(e), m = /* @__PURE__ */ Bt(e), e = wn(e)), o = new Array(e.length);
    for (let h = 0, R = e.length; h < R; h++)
      o[h] = t(
        g ? m ? ms(St(e[h])) : St(e[h]) : e[h],
        h,
        void 0,
        i
      );
  } else if (typeof e == "number") {
    o = new Array(e);
    for (let f = 0; f < e; f++)
      o[f] = t(f + 1, f, void 0, i);
  } else if (Pe(e))
    if (e[Symbol.iterator])
      o = Array.from(
        e,
        (f, g) => t(f, g, void 0, i)
      );
    else {
      const f = Object.keys(e);
      o = new Array(f.length);
      for (let g = 0, m = f.length; g < m; g++) {
        const h = f[g];
        o[g] = t(e[h], h, g, i);
      }
    }
  else
    o = [];
  return o;
}
const al = (e) => e ? To(e) ? $n(e) : al(e.parent) : null, Ls = (
  // Move PURE marker to new line to workaround compiler discarding it
  // due to type annotation
  /* @__PURE__ */ et(/* @__PURE__ */ Object.create(null), {
    $: (e) => e,
    $el: (e) => e.vnode.el,
    $data: (e) => e.data,
    $props: (e) => e.props,
    $attrs: (e) => e.attrs,
    $slots: (e) => e.slots,
    $refs: (e) => e.refs,
    $parent: (e) => al(e.parent),
    $root: (e) => al(e.root),
    $host: (e) => e.ce,
    $emit: (e) => e.emit,
    $options: (e) => io(e),
    $forceUpdate: (e) => e.f || (e.f = () => {
      Ml(e.update);
    }),
    $nextTick: (e) => e.n || (e.n = Bs.bind(e.proxy)),
    $watch: (e) => sr.bind(e)
  })
), Kn = (e, t) => e !== De && !e.__isScriptSetup && Ee(e, t), yr = {
  get({ _: e }, t) {
    if (t === "__v_skip")
      return !0;
    const { ctx: n, setupState: a, data: o, props: i, accessCache: p, type: f, appContext: g } = e;
    if (t[0] !== "$") {
      const b = p[t];
      if (b !== void 0)
        switch (b) {
          case 1:
            return a[t];
          case 2:
            return o[t];
          case 4:
            return n[t];
          case 3:
            return i[t];
        }
      else {
        if (Kn(a, t))
          return p[t] = 1, a[t];
        if (o !== De && Ee(o, t))
          return p[t] = 2, o[t];
        if (Ee(i, t))
          return p[t] = 3, i[t];
        if (n !== De && Ee(n, t))
          return p[t] = 4, n[t];
        ol && (p[t] = 0);
      }
    }
    const m = Ls[t];
    let h, R;
    if (m)
      return t === "$attrs" && Je(e.attrs, "get", ""), m(e);
    if (
      // css module (injected by vue-loader)
      (h = f.__cssModules) && (h = h[t])
    )
      return h;
    if (n !== De && Ee(n, t))
      return p[t] = 4, n[t];
    if (
      // global properties
      R = g.config.globalProperties, Ee(R, t)
    )
      return R[t];
  },
  set({ _: e }, t, n) {
    const { data: a, setupState: o, ctx: i } = e;
    return Kn(o, t) ? (o[t] = n, !0) : a !== De && Ee(a, t) ? (a[t] = n, !0) : Ee(e.props, t) || t[0] === "$" && t.slice(1) in e ? !1 : (i[t] = n, !0);
  },
  has({
    _: { data: e, setupState: t, accessCache: n, ctx: a, appContext: o, props: i, type: p }
  }, f) {
    let g;
    return !!(n[f] || e !== De && f[0] !== "$" && Ee(e, f) || Kn(t, f) || Ee(i, f) || Ee(a, f) || Ee(Ls, f) || Ee(o.config.globalProperties, f) || (g = p.__cssModules) && g[f]);
  },
  defineProperty(e, t, n) {
    return n.get != null ? e._.accessCache[t] = 0 : Ee(n, "value") && this.set(e, t, n.value, null), Reflect.defineProperty(e, t, n);
  }
};
function Xl(e) {
  return me(e) ? e.reduce(
    (t, n) => (t[n] = null, t),
    {}
  ) : e;
}
let ol = !0;
function hr(e) {
  const t = io(e), n = e.proxy, a = e.ctx;
  ol = !1, t.beforeCreate && Jl(t.beforeCreate, e, "bc");
  const {
    // state
    data: o,
    computed: i,
    methods: p,
    watch: f,
    provide: g,
    inject: m,
    // lifecycle
    created: h,
    beforeMount: R,
    mounted: b,
    beforeUpdate: A,
    updated: B,
    activated: J,
    deactivated: G,
    beforeDestroy: $,
    beforeUnmount: Q,
    destroyed: ae,
    unmounted: w,
    render: _e,
    renderTracked: ye,
    renderTriggered: ne,
    errorCaptured: Ce,
    serverPrefetch: ke,
    // public API
    expose: Z,
    inheritAttrs: Me,
    // assets
    components: ie,
    directives: k,
    filters: H
  } = t;
  if (m && _r(m, a, null), p)
    for (const he in p) {
      const le = p[he];
      xe(le) && (a[he] = le.bind(n));
    }
  if (o) {
    const he = o.call(n, n);
    Pe(he) && (e.data = /* @__PURE__ */ Sl(he));
  }
  if (ol = !0, i)
    for (const he in i) {
      const le = i[he], Le = xe(le) ? le.bind(n, n) : xe(le.get) ? le.get.bind(n, n) : $t, Fe = !xe(le) && xe(le.set) ? le.set.bind(n) : $t, Te = se({
        get: Le,
        set: Fe
      });
      Object.defineProperty(a, he, {
        enumerable: !0,
        configurable: !0,
        get: () => Te.value,
        set: ($e) => Te.value = $e
      });
    }
  if (f)
    for (const he in f)
      oo(f[he], a, n, he);
  if (g) {
    const he = xe(g) ? g.call(n) : g;
    Reflect.ownKeys(he).forEach((le) => {
      Zi(le, he[le]);
    });
  }
  h && Jl(h, e, "c");
  function be(he, le) {
    me(le) ? le.forEach((Le) => he(Le.bind(n))) : le && he(le.bind(n));
  }
  if (be(ur, R), be(Tl, b), be(cr, A), be(dr, B), be(or, J), be(ir, G), be(gr, Ce), be(vr, ye), be(fr, ne), be($l, Q), be(ao, w), be(pr, ke), me(Z))
    if (Z.length) {
      const he = e.exposed || (e.exposed = {});
      Z.forEach((le) => {
        Object.defineProperty(he, le, {
          get: () => n[le],
          set: (Le) => n[le] = Le,
          enumerable: !0
        });
      });
    } else e.exposed || (e.exposed = {});
  _e && e.render === $t && (e.render = _e), Me != null && (e.inheritAttrs = Me), ie && (e.components = ie), k && (e.directives = k), ke && so(e);
}
function _r(e, t, n = $t) {
  me(e) && (e = il(e));
  for (const a in e) {
    const o = e[a];
    let i;
    Pe(o) ? "default" in o ? i = rn(
      o.from || a,
      o.default,
      !0
    ) : i = rn(o.from || a) : i = rn(o), /* @__PURE__ */ Ze(i) ? Object.defineProperty(t, a, {
      enumerable: !0,
      configurable: !0,
      get: () => i.value,
      set: (p) => i.value = p
    }) : t[a] = i;
  }
}
function Jl(e, t, n) {
  It(
    me(e) ? e.map((a) => a.bind(t.proxy)) : e.bind(t.proxy),
    t,
    n
  );
}
function oo(e, t, n, a) {
  let o = a.includes(".") ? to(n, a) : () => n[a];
  if (Ue(e)) {
    const i = t[e];
    xe(i) && Gt(o, i);
  } else if (xe(e))
    Gt(o, e.bind(n));
  else if (Pe(e))
    if (me(e))
      e.forEach((i) => oo(i, t, n, a));
    else {
      const i = xe(e.handler) ? e.handler.bind(n) : t[e.handler];
      xe(i) && Gt(o, i, e);
    }
}
function io(e) {
  const t = e.type, { mixins: n, extends: a } = t, {
    mixins: o,
    optionsCache: i,
    config: { optionMergeStrategies: p }
  } = e.appContext, f = i.get(t);
  let g;
  return f ? g = f : !o.length && !n && !a ? g = t : (g = {}, o.length && o.forEach(
    (m) => gn(g, m, p, !0)
  ), gn(g, t, p)), Pe(t) && i.set(t, g), g;
}
function gn(e, t, n, a = !1) {
  const { mixins: o, extends: i } = t;
  i && gn(e, i, n, !0), o && o.forEach(
    (p) => gn(e, p, n, !0)
  );
  for (const p in t)
    if (!(a && p === "expose")) {
      const f = br[p] || n && n[p];
      e[p] = f ? f(e[p], t[p]) : t[p];
    }
  return e;
}
const br = {
  data: Zl,
  props: ea,
  emits: ea,
  // objects
  methods: $s,
  computed: $s,
  // lifecycle
  beforeCreate: nt,
  created: nt,
  beforeMount: nt,
  mounted: nt,
  beforeUpdate: nt,
  updated: nt,
  beforeDestroy: nt,
  beforeUnmount: nt,
  destroyed: nt,
  unmounted: nt,
  activated: nt,
  deactivated: nt,
  errorCaptured: nt,
  serverPrefetch: nt,
  // assets
  components: $s,
  directives: $s,
  // watch
  watch: kr,
  // provide / inject
  provide: Zl,
  inject: xr
};
function Zl(e, t) {
  return t ? e ? function() {
    return et(
      xe(e) ? e.call(this, this) : e,
      xe(t) ? t.call(this, this) : t
    );
  } : t : e;
}
function xr(e, t) {
  return $s(il(e), il(t));
}
function il(e) {
  if (me(e)) {
    const t = {};
    for (let n = 0; n < e.length; n++)
      t[e[n]] = e[n];
    return t;
  }
  return e;
}
function nt(e, t) {
  return e ? [...new Set([].concat(e, t))] : t;
}
function $s(e, t) {
  return e ? et(/* @__PURE__ */ Object.create(null), e, t) : t;
}
function ea(e, t) {
  return e ? me(e) && me(t) ? [.../* @__PURE__ */ new Set([...e, ...t])] : et(
    /* @__PURE__ */ Object.create(null),
    Xl(e),
    Xl(t ?? {})
  ) : t;
}
function kr(e, t) {
  if (!e) return t;
  if (!t) return e;
  const n = et(/* @__PURE__ */ Object.create(null), e);
  for (const a in t)
    n[a] = nt(e[a], t[a]);
  return n;
}
function ro() {
  return {
    app: null,
    config: {
      isNativeTag: Ca,
      performance: !1,
      globalProperties: {},
      optionMergeStrategies: {},
      errorHandler: void 0,
      warnHandler: void 0,
      compilerOptions: {}
    },
    mixins: [],
    components: {},
    directives: {},
    provides: /* @__PURE__ */ Object.create(null),
    optionsCache: /* @__PURE__ */ new WeakMap(),
    propsCache: /* @__PURE__ */ new WeakMap(),
    emitsCache: /* @__PURE__ */ new WeakMap()
  };
}
let Sr = 0;
function wr(e, t) {
  return function(a, o = null) {
    xe(a) || (a = et({}, a)), o != null && !Pe(o) && (o = null);
    const i = ro(), p = /* @__PURE__ */ new WeakSet(), f = [];
    let g = !1;
    const m = i.app = {
      _uid: Sr++,
      _component: a,
      _props: o,
      _container: null,
      _context: i,
      _instance: null,
      version: su,
      get config() {
        return i.config;
      },
      set config(h) {
      },
      use(h, ...R) {
        return p.has(h) || (h && xe(h.install) ? (p.add(h), h.install(m, ...R)) : xe(h) && (p.add(h), h(m, ...R))), m;
      },
      mixin(h) {
        return i.mixins.includes(h) || i.mixins.push(h), m;
      },
      component(h, R) {
        return R ? (i.components[h] = R, m) : i.components[h];
      },
      directive(h, R) {
        return R ? (i.directives[h] = R, m) : i.directives[h];
      },
      mount(h, R, b) {
        if (!g) {
          const A = m._ceVNode || kt(a, o);
          return A.appContext = i, b === !0 ? b = "svg" : b === !1 && (b = void 0), e(A, h, b), g = !0, m._container = h, h.__vue_app__ = m, $n(A.component);
        }
      },
      onUnmount(h) {
        f.push(h);
      },
      unmount() {
        g && (It(
          f,
          m._instance,
          16
        ), e(null, m._container), delete m._container.__vue_app__);
      },
      provide(h, R) {
        return i.provides[h] = R, m;
      },
      runWithContext(h) {
        const R = vs;
        vs = m;
        try {
          return h();
        } finally {
          vs = R;
        }
      }
    };
    return m;
  };
}
let vs = null;
const Cr = (e, t) => t === "modelValue" || t === "model-value" ? e.modelModifiers : e[`${t}Modifiers`] || e[`${bt(t)}Modifiers`] || e[`${Jt(t)}Modifiers`];
function Mr(e, t, ...n) {
  if (e.isUnmounted) return;
  const a = e.vnode.props || De;
  let o = n;
  const i = t.startsWith("update:"), p = i && Cr(a, t.slice(7));
  p && (p.trim && (o = n.map((h) => Ue(h) ? h.trim() : h)), p.number && (o = n.map(kn)));
  let f, g = a[f = Nn(t)] || // also try camelCase event handler (#2249)
  a[f = Nn(bt(t))];
  !g && i && (g = a[f = Nn(Jt(t))]), g && It(
    g,
    e,
    6,
    o
  );
  const m = a[f + "Once"];
  if (m) {
    if (!e.emitted)
      e.emitted = {};
    else if (e.emitted[f])
      return;
    e.emitted[f] = !0, It(
      m,
      e,
      6,
      o
    );
  }
}
const Rr = /* @__PURE__ */ new WeakMap();
function uo(e, t, n = !1) {
  const a = n ? Rr : t.emitsCache, o = a.get(e);
  if (o !== void 0)
    return o;
  const i = e.emits;
  let p = {}, f = !1;
  if (!xe(e)) {
    const g = (m) => {
      const h = uo(m, t, !0);
      h && (f = !0, et(p, h));
    };
    !n && t.mixins.length && t.mixins.forEach(g), e.extends && g(e.extends), e.mixins && e.mixins.forEach(g);
  }
  return !i && !f ? (Pe(e) && a.set(e, null), null) : (me(i) ? i.forEach((g) => p[g] = null) : et(p, i), Pe(e) && a.set(e, p), p);
}
function Rn(e, t) {
  return !e || !_n(t) ? !1 : (t = t.slice(2).replace(/Once$/, ""), Ee(e, t[0].toLowerCase() + t.slice(1)) || Ee(e, Jt(t)) || Ee(e, t));
}
function ta(e) {
  const {
    type: t,
    vnode: n,
    proxy: a,
    withProxy: o,
    propsOptions: [i],
    slots: p,
    attrs: f,
    emit: g,
    render: m,
    renderCache: h,
    props: R,
    data: b,
    setupState: A,
    ctx: B,
    inheritAttrs: J
  } = e, G = fn(e);
  let $, Q;
  try {
    if (n.shapeFlag & 4) {
      const w = o || a, _e = w;
      $ = Rt(
        m.call(
          _e,
          w,
          h,
          R,
          A,
          b,
          B
        )
      ), Q = f;
    } else {
      const w = t;
      $ = Rt(
        w.length > 1 ? w(
          R,
          { attrs: f, slots: p, emit: g }
        ) : w(
          R,
          null
        )
      ), Q = t.props ? f : Tr(f);
    }
  } catch (w) {
    Fs.length = 0, Cn(w, e, 1), $ = kt(Xt);
  }
  let ae = $;
  if (Q && J !== !1) {
    const w = Object.keys(Q), { shapeFlag: _e } = ae;
    w.length && _e & 7 && (i && w.some(bn) && (Q = $r(
      Q,
      i
    )), ae = hs(ae, Q, !1, !0));
  }
  return n.dirs && (ae = hs(ae, null, !1, !0), ae.dirs = ae.dirs ? ae.dirs.concat(n.dirs) : n.dirs), n.transition && Rl(ae, n.transition), $ = ae, fn(G), $;
}
const Tr = (e) => {
  let t;
  for (const n in e)
    (n === "class" || n === "style" || _n(n)) && ((t || (t = {}))[n] = e[n]);
  return t;
}, $r = (e, t) => {
  const n = {};
  for (const a in e)
    (!bn(a) || !(a.slice(9) in t)) && (n[a] = e[a]);
  return n;
};
function Ar(e, t, n) {
  const { props: a, children: o, component: i } = e, { props: p, children: f, patchFlag: g } = t, m = i.emitsOptions;
  if (t.dirs || t.transition)
    return !0;
  if (n && g >= 0) {
    if (g & 1024)
      return !0;
    if (g & 16)
      return a ? sa(a, p, m) : !!p;
    if (g & 8) {
      const h = t.dynamicProps;
      for (let R = 0; R < h.length; R++) {
        const b = h[R];
        if (co(p, a, b) && !Rn(m, b))
          return !0;
      }
    }
  } else
    return (o || f) && (!f || !f.$stable) ? !0 : a === p ? !1 : a ? p ? sa(a, p, m) : !0 : !!p;
  return !1;
}
function sa(e, t, n) {
  const a = Object.keys(t);
  if (a.length !== Object.keys(e).length)
    return !0;
  for (let o = 0; o < a.length; o++) {
    const i = a[o];
    if (co(t, e, i) && !Rn(n, i))
      return !0;
  }
  return !1;
}
function co(e, t, n) {
  const a = e[n], o = t[n];
  return n === "style" && Pe(a) && Pe(o) ? !Ss(a, o) : a !== o;
}
function Ir({ vnode: e, parent: t, suspense: n }, a) {
  for (; t; ) {
    const o = t.subTree;
    if (o.suspense && o.suspense.activeBranch === e && (o.suspense.vnode.el = o.el = a, e = o), o === e)
      (e = t.vnode).el = a, t = t.parent;
    else
      break;
  }
  n && n.activeBranch === e && (n.vnode.el = a);
}
const po = {}, fo = () => Object.create(po), vo = (e) => Object.getPrototypeOf(e) === po;
function Er(e, t, n, a = !1) {
  const o = {}, i = fo();
  e.propsDefaults = /* @__PURE__ */ Object.create(null), go(e, t, o, i);
  for (const p in e.propsOptions[0])
    p in o || (o[p] = void 0);
  n ? e.props = a ? o : /* @__PURE__ */ ji(o) : e.type.props ? e.props = o : e.props = i, e.attrs = i;
}
function Pr(e, t, n, a) {
  const {
    props: o,
    attrs: i,
    vnode: { patchFlag: p }
  } = e, f = /* @__PURE__ */ Ae(o), [g] = e.propsOptions;
  let m = !1;
  if (
    // always force full diff in dev
    // - #1942 if hmr is enabled with sfc component
    // - vite#872 non-sfc component used by sfc component
    (a || p > 0) && !(p & 16)
  ) {
    if (p & 8) {
      const h = e.vnode.dynamicProps;
      for (let R = 0; R < h.length; R++) {
        let b = h[R];
        if (Rn(e.emitsOptions, b))
          continue;
        const A = t[b];
        if (g)
          if (Ee(i, b))
            A !== i[b] && (i[b] = A, m = !0);
          else {
            const B = bt(b);
            o[B] = rl(
              g,
              f,
              B,
              A,
              e,
              !1
            );
          }
        else
          A !== i[b] && (i[b] = A, m = !0);
      }
    }
  } else {
    go(e, t, o, i) && (m = !0);
    let h;
    for (const R in f)
      (!t || // for camelCase
      !Ee(t, R) && // it's possible the original props was passed in as kebab-case
      // and converted to camelCase (#955)
      ((h = Jt(R)) === R || !Ee(t, h))) && (g ? n && // for camelCase
      (n[R] !== void 0 || // for kebab-case
      n[h] !== void 0) && (o[R] = rl(
        g,
        f,
        R,
        void 0,
        e,
        !0
      )) : delete o[R]);
    if (i !== f)
      for (const R in i)
        (!t || !Ee(t, R)) && (delete i[R], m = !0);
  }
  m && Lt(e.attrs, "set", "");
}
function go(e, t, n, a) {
  const [o, i] = e.propsOptions;
  let p = !1, f;
  if (t)
    for (let g in t) {
      if (Es(g))
        continue;
      const m = t[g];
      let h;
      o && Ee(o, h = bt(g)) ? !i || !i.includes(h) ? n[h] = m : (f || (f = {}))[h] = m : Rn(e.emitsOptions, g) || (!(g in a) || m !== a[g]) && (a[g] = m, p = !0);
    }
  if (i) {
    const g = /* @__PURE__ */ Ae(n), m = f || De;
    for (let h = 0; h < i.length; h++) {
      const R = i[h];
      n[R] = rl(
        o,
        g,
        R,
        m[R],
        e,
        !Ee(m, R)
      );
    }
  }
  return p;
}
function rl(e, t, n, a, o, i) {
  const p = e[n];
  if (p != null) {
    const f = Ee(p, "default");
    if (f && a === void 0) {
      const g = p.default;
      if (p.type !== Function && !p.skipFactory && xe(g)) {
        const { propsDefaults: m } = o;
        if (n in m)
          a = m[n];
        else {
          const h = Gs(o);
          a = m[n] = g.call(
            null,
            t
          ), h();
        }
      } else
        a = g;
      o.ce && o.ce._setProp(n, a);
    }
    p[
      0
      /* shouldCast */
    ] && (i && !f ? a = !1 : p[
      1
      /* shouldCastTrue */
    ] && (a === "" || a === Jt(n)) && (a = !0));
  }
  return a;
}
const Dr = /* @__PURE__ */ new WeakMap();
function mo(e, t, n = !1) {
  const a = n ? Dr : t.propsCache, o = a.get(e);
  if (o)
    return o;
  const i = e.props, p = {}, f = [];
  let g = !1;
  if (!xe(e)) {
    const h = (R) => {
      g = !0;
      const [b, A] = mo(R, t, !0);
      et(p, b), A && f.push(...A);
    };
    !n && t.mixins.length && t.mixins.forEach(h), e.extends && h(e.extends), e.mixins && e.mixins.forEach(h);
  }
  if (!i && !g)
    return Pe(e) && a.set(e, ds), ds;
  if (me(i))
    for (let h = 0; h < i.length; h++) {
      const R = bt(i[h]);
      na(R) && (p[R] = De);
    }
  else if (i)
    for (const h in i) {
      const R = bt(h);
      if (na(R)) {
        const b = i[h], A = p[R] = me(b) || xe(b) ? { type: b } : et({}, b), B = A.type;
        let J = !1, G = !0;
        if (me(B))
          for (let $ = 0; $ < B.length; ++$) {
            const Q = B[$], ae = xe(Q) && Q.name;
            if (ae === "Boolean") {
              J = !0;
              break;
            } else ae === "String" && (G = !1);
          }
        else
          J = xe(B) && B.name === "Boolean";
        A[
          0
          /* shouldCast */
        ] = J, A[
          1
          /* shouldCastTrue */
        ] = G, (J || Ee(A, "default")) && f.push(R);
      }
    }
  const m = [p, f];
  return Pe(e) && a.set(e, m), m;
}
function na(e) {
  return e[0] !== "$" && !Es(e);
}
const Al = (e) => e === "_" || e === "_ctx" || e === "$stable", Il = (e) => me(e) ? e.map(Rt) : [Rt(e)], Or = (e, t, n) => {
  if (t._n)
    return t;
  const a = Ji((...o) => Il(t(...o)), n);
  return a._c = !1, a;
}, yo = (e, t, n) => {
  const a = e._ctx;
  for (const o in e) {
    if (Al(o)) continue;
    const i = e[o];
    if (xe(i))
      t[o] = Or(o, i, a);
    else if (i != null) {
      const p = Il(i);
      t[o] = () => p;
    }
  }
}, ho = (e, t) => {
  const n = Il(t);
  e.slots.default = () => n;
}, _o = (e, t, n) => {
  for (const a in t)
    (n || !Al(a)) && (e[a] = t[a]);
}, Vr = (e, t, n) => {
  const a = e.slots = fo();
  if (e.vnode.shapeFlag & 32) {
    const o = t._;
    o ? (_o(a, t, n), n && Aa(a, "_", o, !0)) : yo(t, a);
  } else t && ho(e, t);
}, Lr = (e, t, n) => {
  const { vnode: a, slots: o } = e;
  let i = !0, p = De;
  if (a.shapeFlag & 32) {
    const f = t._;
    f ? n && f === 1 ? i = !1 : _o(o, t, n) : (i = !t.$stable, yo(t, o)), p = t;
  } else t && (ho(e, t), p = { default: 1 });
  if (i)
    for (const f in o)
      !Al(f) && p[f] == null && delete o[f];
}, rt = Br;
function Fr(e) {
  return Nr(e);
}
function Nr(e, t) {
  const n = Sn();
  n.__VUE__ = !0;
  const {
    insert: a,
    remove: o,
    patchProp: i,
    createElement: p,
    createText: f,
    createComment: g,
    setText: m,
    setElementText: h,
    parentNode: R,
    nextSibling: b,
    setScopeId: A = $t,
    insertStaticContent: B
  } = e, J = (y, x, T, N = null, C = null, F = null, ee = void 0, X = null, Y = !!x.dynamicChildren) => {
    if (y === x)
      return;
    y && !Rs(y, x) && (N = Se(y), $e(y, C, F, !0), y = null), x.patchFlag === -2 && (Y = !1, x.dynamicChildren = null);
    const { type: j, ref: re, shapeFlag: te } = x;
    switch (j) {
      case Tn:
        G(y, x, T, N);
        break;
      case Xt:
        $(y, x, T, N);
        break;
      case Hn:
        y == null && Q(x, T, N, ee);
        break;
      case I:
        ie(
          y,
          x,
          T,
          N,
          C,
          F,
          ee,
          X,
          Y
        );
        break;
      default:
        te & 1 ? _e(
          y,
          x,
          T,
          N,
          C,
          F,
          ee,
          X,
          Y
        ) : te & 6 ? k(
          y,
          x,
          T,
          N,
          C,
          F,
          ee,
          X,
          Y
        ) : (te & 64 || te & 128) && j.process(
          y,
          x,
          T,
          N,
          C,
          F,
          ee,
          X,
          Y,
          ze
        );
    }
    re != null && C ? Os(re, y && y.ref, F, x || y, !x) : re == null && y && y.ref != null && Os(y.ref, null, F, y, !0);
  }, G = (y, x, T, N) => {
    if (y == null)
      a(
        x.el = f(x.children),
        T,
        N
      );
    else {
      const C = x.el = y.el;
      x.children !== y.children && m(C, x.children);
    }
  }, $ = (y, x, T, N) => {
    y == null ? a(
      x.el = g(x.children || ""),
      T,
      N
    ) : x.el = y.el;
  }, Q = (y, x, T, N) => {
    [y.el, y.anchor] = B(
      y.children,
      x,
      T,
      N,
      y.el,
      y.anchor
    );
  }, ae = ({ el: y, anchor: x }, T, N) => {
    let C;
    for (; y && y !== x; )
      C = b(y), a(y, T, N), y = C;
    a(x, T, N);
  }, w = ({ el: y, anchor: x }) => {
    let T;
    for (; y && y !== x; )
      T = b(y), o(y), y = T;
    o(x);
  }, _e = (y, x, T, N, C, F, ee, X, Y) => {
    if (x.type === "svg" ? ee = "svg" : x.type === "math" && (ee = "mathml"), y == null)
      ye(
        x,
        T,
        N,
        C,
        F,
        ee,
        X,
        Y
      );
    else {
      const j = y.el && y.el._isVueCE ? y.el : null;
      try {
        j && j._beginPatch(), ke(
          y,
          x,
          C,
          F,
          ee,
          X,
          Y
        );
      } finally {
        j && j._endPatch();
      }
    }
  }, ye = (y, x, T, N, C, F, ee, X) => {
    let Y, j;
    const { props: re, shapeFlag: te, transition: oe, dirs: E } = y;
    if (Y = y.el = p(
      y.type,
      F,
      re && re.is,
      re
    ), te & 8 ? h(Y, y.children) : te & 16 && Ce(
      y.children,
      Y,
      null,
      N,
      C,
      qn(y, F),
      ee,
      X
    ), E && ss(y, null, N, "created"), ne(Y, y, y.scopeId, ee, N), re) {
      for (const L in re)
        L !== "value" && !Es(L) && i(Y, L, null, re[L], F, N);
      "value" in re && i(Y, "value", null, re.value, F), (j = re.onVnodeBeforeMount) && wt(j, N, y);
    }
    E && ss(y, null, N, "beforeMount");
    const D = jr(C, oe);
    D && oe.beforeEnter(Y), a(Y, x, T), ((j = re && re.onVnodeMounted) || D || E) && rt(() => {
      j && wt(j, N, y), D && oe.enter(Y), E && ss(y, null, N, "mounted");
    }, C);
  }, ne = (y, x, T, N, C) => {
    if (T && A(y, T), N)
      for (let F = 0; F < N.length; F++)
        A(y, N[F]);
    if (C) {
      let F = C.subTree;
      if (x === F || So(F.type) && (F.ssContent === x || F.ssFallback === x)) {
        const ee = C.vnode;
        ne(
          y,
          ee,
          ee.scopeId,
          ee.slotScopeIds,
          C.parent
        );
      }
    }
  }, Ce = (y, x, T, N, C, F, ee, X, Y = 0) => {
    for (let j = Y; j < y.length; j++) {
      const re = y[j] = X ? Vt(y[j]) : Rt(y[j]);
      J(
        null,
        re,
        x,
        T,
        N,
        C,
        F,
        ee,
        X
      );
    }
  }, ke = (y, x, T, N, C, F, ee) => {
    const X = x.el = y.el;
    let { patchFlag: Y, dynamicChildren: j, dirs: re } = x;
    Y |= y.patchFlag & 16;
    const te = y.props || De, oe = x.props || De;
    let E;
    if (T && ns(T, !1), (E = oe.onVnodeBeforeUpdate) && wt(E, T, x, y), re && ss(x, y, T, "beforeUpdate"), T && ns(T, !0), (te.innerHTML && oe.innerHTML == null || te.textContent && oe.textContent == null) && h(X, ""), j ? Z(
      y.dynamicChildren,
      j,
      X,
      T,
      N,
      qn(x, C),
      F
    ) : ee || le(
      y,
      x,
      X,
      null,
      T,
      N,
      qn(x, C),
      F,
      !1
    ), Y > 0) {
      if (Y & 16)
        Me(X, te, oe, T, C);
      else if (Y & 2 && te.class !== oe.class && i(X, "class", null, oe.class, C), Y & 4 && i(X, "style", te.style, oe.style, C), Y & 8) {
        const D = x.dynamicProps;
        for (let L = 0; L < D.length; L++) {
          const ge = D[L], Re = te[ge], qe = oe[ge];
          (qe !== Re || ge === "value") && i(X, ge, Re, qe, C, T);
        }
      }
      Y & 1 && y.children !== x.children && h(X, x.children);
    } else !ee && j == null && Me(X, te, oe, T, C);
    ((E = oe.onVnodeUpdated) || re) && rt(() => {
      E && wt(E, T, x, y), re && ss(x, y, T, "updated");
    }, N);
  }, Z = (y, x, T, N, C, F, ee) => {
    for (let X = 0; X < x.length; X++) {
      const Y = y[X], j = x[X], re = (
        // oldVNode may be an errored async setup() component inside Suspense
        // which will not have a mounted element
        Y.el && // - In the case of a Fragment, we need to provide the actual parent
        // of the Fragment itself so it can move its children.
        (Y.type === I || // - In the case of different nodes, there is going to be a replacement
        // which also requires the correct parent container
        !Rs(Y, j) || // - In the case of a component, it could contain anything.
        Y.shapeFlag & 198) ? R(Y.el) : (
          // In other cases, the parent container is not actually used so we
          // just pass the block element here to avoid a DOM parentNode call.
          T
        )
      );
      J(
        Y,
        j,
        re,
        null,
        N,
        C,
        F,
        ee,
        !0
      );
    }
  }, Me = (y, x, T, N, C) => {
    if (x !== T) {
      if (x !== De)
        for (const F in x)
          !Es(F) && !(F in T) && i(
            y,
            F,
            x[F],
            null,
            C,
            N
          );
      for (const F in T) {
        if (Es(F)) continue;
        const ee = T[F], X = x[F];
        ee !== X && F !== "value" && i(y, F, X, ee, C, N);
      }
      "value" in T && i(y, "value", x.value, T.value, C);
    }
  }, ie = (y, x, T, N, C, F, ee, X, Y) => {
    const j = x.el = y ? y.el : f(""), re = x.anchor = y ? y.anchor : f("");
    let { patchFlag: te, dynamicChildren: oe, slotScopeIds: E } = x;
    E && (X = X ? X.concat(E) : E), y == null ? (a(j, T, N), a(re, T, N), Ce(
      // #10007
      // such fragment like `<></>` will be compiled into
      // a fragment which doesn't have a children.
      // In this case fallback to an empty array
      x.children || [],
      T,
      re,
      C,
      F,
      ee,
      X,
      Y
    )) : te > 0 && te & 64 && oe && // #2715 the previous fragment could've been a BAILed one as a result
    // of renderSlot() with no valid children
    y.dynamicChildren && y.dynamicChildren.length === oe.length ? (Z(
      y.dynamicChildren,
      oe,
      T,
      C,
      F,
      ee,
      X
    ), // #2080 if the stable fragment has a key, it's a <template v-for> that may
    //  get moved around. Make sure all root level vnodes inherit el.
    // #2134 or if it's a component root, it may also get moved around
    // as the component is being moved.
    (x.key != null || C && x === C.subTree) && bo(
      y,
      x,
      !0
      /* shallow */
    )) : le(
      y,
      x,
      T,
      re,
      C,
      F,
      ee,
      X,
      Y
    );
  }, k = (y, x, T, N, C, F, ee, X, Y) => {
    x.slotScopeIds = X, y == null ? x.shapeFlag & 512 ? C.ctx.activate(
      x,
      T,
      N,
      ee,
      Y
    ) : H(
      x,
      T,
      N,
      C,
      F,
      ee,
      Y
    ) : ve(y, x, Y);
  }, H = (y, x, T, N, C, F, ee) => {
    const X = y.component = Gr(
      y,
      N,
      C
    );
    if (no(y) && (X.ctx.renderer = ze), Xr(X, !1, ee), X.asyncDep) {
      if (C && C.registerDep(X, be, ee), !y.el) {
        const Y = X.subTree = kt(Xt);
        $(null, Y, x, T), y.placeholder = Y.el;
      }
    } else
      be(
        X,
        y,
        x,
        T,
        C,
        F,
        ee
      );
  }, ve = (y, x, T) => {
    const N = x.component = y.component;
    if (Ar(y, x, T))
      if (N.asyncDep && !N.asyncResolved) {
        he(N, x, T);
        return;
      } else
        N.next = x, N.update();
    else
      x.el = y.el, N.vnode = x;
  }, be = (y, x, T, N, C, F, ee) => {
    const X = () => {
      if (y.isMounted) {
        let { next: te, bu: oe, u: E, parent: D, vnode: L } = y;
        {
          const ot = xo(y);
          if (ot) {
            te && (te.el = L.el, he(y, te, ee)), ot.asyncDep.then(() => {
              rt(() => {
                y.isUnmounted || j();
              }, C);
            });
            return;
          }
        }
        let ge = te, Re;
        ns(y, !1), te ? (te.el = L.el, he(y, te, ee)) : te = L, oe && on(oe), (Re = te.props && te.props.onVnodeBeforeUpdate) && wt(Re, D, te, L), ns(y, !0);
        const qe = ta(y), ut = y.subTree;
        y.subTree = qe, J(
          ut,
          qe,
          // parent may have changed if it's in a teleport
          R(ut.el),
          // anchor may have changed if it's in a fragment
          Se(ut),
          y,
          C,
          F
        ), te.el = qe.el, ge === null && Ir(y, qe.el), E && rt(E, C), (Re = te.props && te.props.onVnodeUpdated) && rt(
          () => wt(Re, D, te, L),
          C
        );
      } else {
        let te;
        const { el: oe, props: E } = x, { bm: D, m: L, parent: ge, root: Re, type: qe } = y, ut = Vs(x);
        ns(y, !1), D && on(D), !ut && (te = E && E.onVnodeBeforeMount) && wt(te, ge, x), ns(y, !0);
        {
          Re.ce && Re.ce._hasShadowRoot() && Re.ce._injectChildStyle(
            qe,
            y.parent ? y.parent.type : void 0
          );
          const ot = y.subTree = ta(y);
          J(
            null,
            ot,
            T,
            N,
            y,
            C,
            F
          ), x.el = ot.el;
        }
        if (L && rt(L, C), !ut && (te = E && E.onVnodeMounted)) {
          const ot = x;
          rt(
            () => wt(te, ge, ot),
            C
          );
        }
        (x.shapeFlag & 256 || ge && Vs(ge.vnode) && ge.vnode.shapeFlag & 256) && y.a && rt(y.a, C), y.isMounted = !0, x = T = N = null;
      }
    };
    y.scope.on();
    const Y = y.effect = new Da(X);
    y.scope.off();
    const j = y.update = Y.run.bind(Y), re = y.job = Y.runIfDirty.bind(Y);
    re.i = y, re.id = y.uid, Y.scheduler = () => Ml(re), ns(y, !0), j();
  }, he = (y, x, T) => {
    x.component = y;
    const N = y.vnode.props;
    y.vnode = x, y.next = null, Pr(y, x.props, N, T), Lr(y, x.children, T), jt(), Yl(y), Wt();
  }, le = (y, x, T, N, C, F, ee, X, Y = !1) => {
    const j = y && y.children, re = y ? y.shapeFlag : 0, te = x.children, { patchFlag: oe, shapeFlag: E } = x;
    if (oe > 0) {
      if (oe & 128) {
        Fe(
          j,
          te,
          T,
          N,
          C,
          F,
          ee,
          X,
          Y
        );
        return;
      } else if (oe & 256) {
        Le(
          j,
          te,
          T,
          N,
          C,
          F,
          ee,
          X,
          Y
        );
        return;
      }
    }
    E & 8 ? (re & 16 && V(j, C, F), te !== j && h(T, te)) : re & 16 ? E & 16 ? Fe(
      j,
      te,
      T,
      N,
      C,
      F,
      ee,
      X,
      Y
    ) : V(j, C, F, !0) : (re & 8 && h(T, ""), E & 16 && Ce(
      te,
      T,
      N,
      C,
      F,
      ee,
      X,
      Y
    ));
  }, Le = (y, x, T, N, C, F, ee, X, Y) => {
    y = y || ds, x = x || ds;
    const j = y.length, re = x.length, te = Math.min(j, re);
    let oe;
    for (oe = 0; oe < te; oe++) {
      const E = x[oe] = Y ? Vt(x[oe]) : Rt(x[oe]);
      J(
        y[oe],
        E,
        T,
        null,
        C,
        F,
        ee,
        X,
        Y
      );
    }
    j > re ? V(
      y,
      C,
      F,
      !0,
      !1,
      te
    ) : Ce(
      x,
      T,
      N,
      C,
      F,
      ee,
      X,
      Y,
      te
    );
  }, Fe = (y, x, T, N, C, F, ee, X, Y) => {
    let j = 0;
    const re = x.length;
    let te = y.length - 1, oe = re - 1;
    for (; j <= te && j <= oe; ) {
      const E = y[j], D = x[j] = Y ? Vt(x[j]) : Rt(x[j]);
      if (Rs(E, D))
        J(
          E,
          D,
          T,
          null,
          C,
          F,
          ee,
          X,
          Y
        );
      else
        break;
      j++;
    }
    for (; j <= te && j <= oe; ) {
      const E = y[te], D = x[oe] = Y ? Vt(x[oe]) : Rt(x[oe]);
      if (Rs(E, D))
        J(
          E,
          D,
          T,
          null,
          C,
          F,
          ee,
          X,
          Y
        );
      else
        break;
      te--, oe--;
    }
    if (j > te) {
      if (j <= oe) {
        const E = oe + 1, D = E < re ? x[E].el : N;
        for (; j <= oe; )
          J(
            null,
            x[j] = Y ? Vt(x[j]) : Rt(x[j]),
            T,
            D,
            C,
            F,
            ee,
            X,
            Y
          ), j++;
      }
    } else if (j > oe)
      for (; j <= te; )
        $e(y[j], C, F, !0), j++;
    else {
      const E = j, D = j, L = /* @__PURE__ */ new Map();
      for (j = D; j <= oe; j++) {
        const st = x[j] = Y ? Vt(x[j]) : Rt(x[j]);
        st.key != null && L.set(st.key, j);
      }
      let ge, Re = 0;
      const qe = oe - D + 1;
      let ut = !1, ot = 0;
      const Ht = new Array(qe);
      for (j = 0; j < qe; j++) Ht[j] = 0;
      for (j = E; j <= te; j++) {
        const st = y[j];
        if (Re >= qe) {
          $e(st, C, F, !0);
          continue;
        }
        let ct;
        if (st.key != null)
          ct = L.get(st.key);
        else
          for (ge = D; ge <= oe; ge++)
            if (Ht[ge - D] === 0 && Rs(st, x[ge])) {
              ct = ge;
              break;
            }
        ct === void 0 ? $e(st, C, F, !0) : (Ht[ct - D] = j + 1, ct >= ot ? ot = ct : ut = !0, J(
          st,
          x[ct],
          T,
          null,
          C,
          F,
          ee,
          X,
          Y
        ), Re++);
      }
      const rs = ut ? Wr(Ht) : ds;
      for (ge = rs.length - 1, j = qe - 1; j >= 0; j--) {
        const st = D + j, ct = x[st], Js = x[st + 1], Zs = st + 1 < re ? (
          // #13559, #14173 fallback to el placeholder for unresolved async component
          Js.el || ko(Js)
        ) : N;
        Ht[j] === 0 ? J(
          null,
          ct,
          T,
          Zs,
          C,
          F,
          ee,
          X,
          Y
        ) : ut && (ge < 0 || j !== rs[ge] ? Te(ct, T, Zs, 2) : ge--);
      }
    }
  }, Te = (y, x, T, N, C = null) => {
    const { el: F, type: ee, transition: X, children: Y, shapeFlag: j } = y;
    if (j & 6) {
      Te(y.component.subTree, x, T, N);
      return;
    }
    if (j & 128) {
      y.suspense.move(x, T, N);
      return;
    }
    if (j & 64) {
      ee.move(y, x, T, ze);
      return;
    }
    if (ee === I) {
      a(F, x, T);
      for (let te = 0; te < Y.length; te++)
        Te(Y[te], x, T, N);
      a(y.anchor, x, T);
      return;
    }
    if (ee === Hn) {
      ae(y, x, T);
      return;
    }
    if (N !== 2 && j & 1 && X)
      if (N === 0)
        X.beforeEnter(F), a(F, x, T), rt(() => X.enter(F), C);
      else {
        const { leave: te, delayLeave: oe, afterLeave: E } = X, D = () => {
          y.ctx.isUnmounted ? o(F) : a(F, x, T);
        }, L = () => {
          F._isLeaving && F[ar](
            !0
            /* cancelled */
          ), te(F, () => {
            D(), E && E();
          });
        };
        oe ? oe(F, D, L) : L();
      }
    else
      a(F, x, T);
  }, $e = (y, x, T, N = !1, C = !1) => {
    const {
      type: F,
      props: ee,
      ref: X,
      children: Y,
      dynamicChildren: j,
      shapeFlag: re,
      patchFlag: te,
      dirs: oe,
      cacheIndex: E,
      memo: D
    } = y;
    if (te === -2 && (C = !1), X != null && (jt(), Os(X, null, T, y, !0), Wt()), E != null && (x.renderCache[E] = void 0), re & 256) {
      x.ctx.deactivate(y);
      return;
    }
    const L = re & 1 && oe, ge = !Vs(y);
    let Re;
    if (ge && (Re = ee && ee.onVnodeBeforeUnmount) && wt(Re, x, y), re & 6)
      M(y.component, T, N);
    else {
      if (re & 128) {
        y.suspense.unmount(T, N);
        return;
      }
      L && ss(y, null, x, "beforeUnmount"), re & 64 ? y.type.remove(
        y,
        x,
        T,
        ze,
        N
      ) : j && // #5154
      // when v-once is used inside a block, setBlockTracking(-1) marks the
      // parent block with hasOnce: true
      // so that it doesn't take the fast path during unmount - otherwise
      // components nested in v-once are never unmounted.
      !j.hasOnce && // #1153: fast path should not be taken for non-stable (v-for) fragments
      (F !== I || te > 0 && te & 64) ? V(
        j,
        x,
        T,
        !1,
        !0
      ) : (F === I && te & 384 || !C && re & 16) && V(Y, x, T), N && ce(y);
    }
    const qe = D != null && E == null;
    (ge && (Re = ee && ee.onVnodeUnmounted) || L || qe) && rt(() => {
      Re && wt(Re, x, y), L && ss(y, null, x, "unmounted"), qe && (y.el = null);
    }, T);
  }, ce = (y) => {
    const { type: x, el: T, anchor: N, transition: C } = y;
    if (x === I) {
      O(T, N);
      return;
    }
    if (x === Hn) {
      w(y);
      return;
    }
    const F = () => {
      o(T), C && !C.persisted && C.afterLeave && C.afterLeave();
    };
    if (y.shapeFlag & 1 && C && !C.persisted) {
      const { leave: ee, delayLeave: X } = C, Y = () => ee(T, F);
      X ? X(y.el, F, Y) : Y();
    } else
      F();
  }, O = (y, x) => {
    let T;
    for (; y !== x; )
      T = b(y), o(y), y = T;
    o(x);
  }, M = (y, x, T) => {
    const { bum: N, scope: C, job: F, subTree: ee, um: X, m: Y, a: j } = y;
    la(Y), la(j), N && on(N), C.stop(), F && (F.flags |= 8, $e(ee, y, x, T)), X && rt(X, x), rt(() => {
      y.isUnmounted = !0;
    }, x);
  }, V = (y, x, T, N = !1, C = !1, F = 0) => {
    for (let ee = F; ee < y.length; ee++)
      $e(y[ee], x, T, N, C);
  }, Se = (y) => {
    if (y.shapeFlag & 6)
      return Se(y.component.subTree);
    if (y.shapeFlag & 128)
      return y.suspense.next();
    const x = b(y.anchor || y.el), T = x && x[nr];
    return T ? b(T) : x;
  };
  let He = !1;
  const tt = (y, x, T) => {
    let N;
    y == null ? x._vnode && ($e(x._vnode, null, null, !0), N = x._vnode.component) : J(
      x._vnode || null,
      y,
      x,
      null,
      null,
      null,
      T
    ), x._vnode = y, He || (He = !0, Yl(N), Xa(), He = !1);
  }, ze = {
    p: J,
    um: $e,
    m: Te,
    r: ce,
    mt: H,
    mc: Ce,
    pc: le,
    pbc: Z,
    n: Se,
    o: e
  };
  return {
    render: tt,
    hydrate: void 0,
    createApp: wr(tt)
  };
}
function qn({ type: e, props: t }, n) {
  return n === "svg" && e === "foreignObject" || n === "mathml" && e === "annotation-xml" && t && t.encoding && t.encoding.includes("html") ? void 0 : n;
}
function ns({ effect: e, job: t }, n) {
  n ? (e.flags |= 32, t.flags |= 4) : (e.flags &= -33, t.flags &= -5);
}
function jr(e, t) {
  return (!e || e && !e.pendingBranch) && t && !t.persisted;
}
function bo(e, t, n = !1) {
  const a = e.children, o = t.children;
  if (me(a) && me(o))
    for (let i = 0; i < a.length; i++) {
      const p = a[i];
      let f = o[i];
      f.shapeFlag & 1 && !f.dynamicChildren && ((f.patchFlag <= 0 || f.patchFlag === 32) && (f = o[i] = Vt(o[i]), f.el = p.el), !n && f.patchFlag !== -2 && bo(p, f)), f.type === Tn && (f.patchFlag === -1 && (f = o[i] = Vt(f)), f.el = p.el), f.type === Xt && !f.el && (f.el = p.el);
    }
}
function Wr(e) {
  const t = e.slice(), n = [0];
  let a, o, i, p, f;
  const g = e.length;
  for (a = 0; a < g; a++) {
    const m = e[a];
    if (m !== 0) {
      if (o = n[n.length - 1], e[o] < m) {
        t[a] = o, n.push(a);
        continue;
      }
      for (i = 0, p = n.length - 1; i < p; )
        f = i + p >> 1, e[n[f]] < m ? i = f + 1 : p = f;
      m < e[n[i]] && (i > 0 && (t[a] = n[i - 1]), n[i] = a);
    }
  }
  for (i = n.length, p = n[i - 1]; i-- > 0; )
    n[i] = p, p = t[p];
  return n;
}
function xo(e) {
  const t = e.subTree.component;
  if (t)
    return t.asyncDep && !t.asyncResolved ? t : xo(t);
}
function la(e) {
  if (e)
    for (let t = 0; t < e.length; t++)
      e[t].flags |= 8;
}
function ko(e) {
  if (e.placeholder)
    return e.placeholder;
  const t = e.component;
  return t ? ko(t.subTree) : null;
}
const So = (e) => e.__isSuspense;
function Br(e, t) {
  t && t.pendingBranch ? me(e) ? t.effects.push(...e) : t.effects.push(e) : Xi(e);
}
const I = /* @__PURE__ */ Symbol.for("v-fgt"), Tn = /* @__PURE__ */ Symbol.for("v-txt"), Xt = /* @__PURE__ */ Symbol.for("v-cmt"), Hn = /* @__PURE__ */ Symbol.for("v-stc"), Fs = [];
let ft = null;
function u(e = !1) {
  Fs.push(ft = e ? null : []);
}
function Ur() {
  Fs.pop(), ft = Fs[Fs.length - 1] || null;
}
let Ks = 1;
function aa(e, t = !1) {
  Ks += e, e < 0 && ft && t && (ft.hasOnce = !0);
}
function wo(e) {
  return e.dynamicChildren = Ks > 0 ? ft || ds : null, Ur(), Ks > 0 && ft && ft.push(e), e;
}
function c(e, t, n, a, o, i) {
  return wo(
    s(
      e,
      t,
      n,
      a,
      o,
      i,
      !0
    )
  );
}
function Co(e, t, n, a, o) {
  return wo(
    kt(
      e,
      t,
      n,
      a,
      o,
      !0
    )
  );
}
function Mo(e) {
  return e ? e.__v_isVNode === !0 : !1;
}
function Rs(e, t) {
  return e.type === t.type && e.key === t.key;
}
const Ro = ({ key: e }) => e ?? null, un = ({
  ref: e,
  ref_key: t,
  ref_for: n
}) => (typeof e == "number" && (e = "" + e), e != null ? Ue(e) || /* @__PURE__ */ Ze(e) || xe(e) ? { i: vt, r: e, k: t, f: !!n } : e : null);
function s(e, t = null, n = null, a = 0, o = null, i = e === I ? 0 : 1, p = !1, f = !1) {
  const g = {
    __v_isVNode: !0,
    __v_skip: !0,
    type: e,
    props: t,
    key: t && Ro(t),
    ref: t && un(t),
    scopeId: Za,
    slotScopeIds: null,
    children: n,
    component: null,
    suspense: null,
    ssContent: null,
    ssFallback: null,
    dirs: null,
    transition: null,
    el: null,
    anchor: null,
    target: null,
    targetStart: null,
    targetAnchor: null,
    staticCount: 0,
    shapeFlag: i,
    patchFlag: a,
    dynamicProps: o,
    dynamicChildren: null,
    appContext: null,
    ctx: vt
  };
  return f ? (El(g, n), i & 128 && e.normalize(g)) : n && (g.shapeFlag |= Ue(n) ? 8 : 16), Ks > 0 && // avoid a block node from tracking itself
  !p && // has current parent block
  ft && // presence of a patch flag indicates this node needs patching on updates.
  // component nodes also should always be patched, because even if the
  // component doesn't need to update, it needs to persist the instance on to
  // the next vnode so that it can be properly unmounted later.
  (g.patchFlag > 0 || i & 6) && // the EVENTS flag is only for hydration and if it is the only flag, the
  // vnode should not be considered dynamic due to handler caching.
  g.patchFlag !== 32 && ft.push(g), g;
}
const kt = Kr;
function Kr(e, t = null, n = null, a = 0, o = null, i = !1) {
  if ((!e || e === mr) && (e = Xt), Mo(e)) {
    const f = hs(
      e,
      t,
      !0
      /* mergeRef: true */
    );
    return n && El(f, n), Ks > 0 && !i && ft && (f.shapeFlag & 6 ? ft[ft.indexOf(e)] = f : ft.push(f)), f.patchFlag = -2, f;
  }
  if (tu(e) && (e = e.__vccOpts), t) {
    t = qr(t);
    let { class: f, style: g } = t;
    f && !Ue(f) && (t.class = q(f)), Pe(g) && (/* @__PURE__ */ Cl(g) && !me(g) && (g = et({}, g)), t.style = pt(g));
  }
  const p = Ue(e) ? 1 : So(e) ? 128 : lr(e) ? 64 : Pe(e) ? 4 : xe(e) ? 2 : 0;
  return s(
    e,
    t,
    n,
    a,
    o,
    p,
    i,
    !0
  );
}
function qr(e) {
  return e ? /* @__PURE__ */ Cl(e) || vo(e) ? et({}, e) : e : null;
}
function hs(e, t, n = !1, a = !1) {
  const { props: o, ref: i, patchFlag: p, children: f, transition: g } = e, m = t ? Hr(o || {}, t) : o, h = {
    __v_isVNode: !0,
    __v_skip: !0,
    type: e.type,
    props: m,
    key: m && Ro(m),
    ref: t && t.ref ? (
      // #2078 in the case of <component :is="vnode" ref="extra"/>
      // if the vnode itself already has a ref, cloneVNode will need to merge
      // the refs so the single vnode can be set on multiple refs
      n && i ? me(i) ? i.concat(un(t)) : [i, un(t)] : un(t)
    ) : i,
    scopeId: e.scopeId,
    slotScopeIds: e.slotScopeIds,
    children: f,
    target: e.target,
    targetStart: e.targetStart,
    targetAnchor: e.targetAnchor,
    staticCount: e.staticCount,
    shapeFlag: e.shapeFlag,
    // if the vnode is cloned with extra props, we can no longer assume its
    // existing patch flag to be reliable and need to add the FULL_PROPS flag.
    // note: preserve flag for fragments since they use the flag for children
    // fast paths only.
    patchFlag: t && e.type !== I ? p === -1 ? 16 : p | 16 : p,
    dynamicProps: e.dynamicProps,
    dynamicChildren: e.dynamicChildren,
    appContext: e.appContext,
    dirs: e.dirs,
    transition: g,
    // These should technically only be non-null on mounted VNodes. However,
    // they *should* be copied for kept-alive vnodes. So we just always copy
    // them since them being non-null during a mount doesn't affect the logic as
    // they will simply be overwritten.
    component: e.component,
    suspense: e.suspense,
    ssContent: e.ssContent && hs(e.ssContent),
    ssFallback: e.ssFallback && hs(e.ssFallback),
    placeholder: e.placeholder,
    el: e.el,
    anchor: e.anchor,
    ctx: e.ctx,
    ce: e.ce
  };
  return g && a && Rl(
    h,
    g.clone(h)
  ), h;
}
function de(e = " ", t = 0) {
  return kt(Tn, null, e, t);
}
function P(e = "", t = !1) {
  return t ? (u(), Co(Xt, null, e)) : kt(Xt, null, e);
}
function Rt(e) {
  return e == null || typeof e == "boolean" ? kt(Xt) : me(e) ? kt(
    I,
    null,
    // #3666, avoid reference pollution when reusing vnode
    e.slice()
  ) : Mo(e) ? Vt(e) : kt(Tn, null, String(e));
}
function Vt(e) {
  return e.el === null && e.patchFlag !== -1 || e.memo ? e : hs(e);
}
function El(e, t) {
  let n = 0;
  const { shapeFlag: a } = e;
  if (t == null)
    t = null;
  else if (me(t))
    n = 16;
  else if (typeof t == "object")
    if (a & 65) {
      const o = t.default;
      o && (o._c && (o._d = !1), El(e, o()), o._c && (o._d = !0));
      return;
    } else {
      n = 32;
      const o = t._;
      !o && !vo(t) ? t._ctx = vt : o === 3 && vt && (vt.slots._ === 1 ? t._ = 1 : (t._ = 2, e.patchFlag |= 1024));
    }
  else xe(t) ? (t = { default: t, _ctx: vt }, n = 32) : (t = String(t), a & 64 ? (n = 16, t = [de(t)]) : n = 8);
  e.children = t, e.shapeFlag |= n;
}
function Hr(...e) {
  const t = {};
  for (let n = 0; n < e.length; n++) {
    const a = e[n];
    for (const o in a)
      if (o === "class")
        t.class !== a.class && (t.class = q([t.class, a.class]));
      else if (o === "style")
        t.style = pt([t.style, a.style]);
      else if (_n(o)) {
        const i = t[o], p = a[o];
        p && i !== p && !(me(i) && i.includes(p)) ? t[o] = i ? [].concat(i, p) : p : p == null && i == null && // mergeProps({ 'onUpdate:modelValue': undefined }) should not retain
        // the model listener.
        !bn(o) && (t[o] = p);
      } else o !== "" && (t[o] = a[o]);
  }
  return t;
}
function wt(e, t, n, a = null) {
  It(e, t, 7, [
    n,
    a
  ]);
}
const zr = ro();
let Yr = 0;
function Gr(e, t, n) {
  const a = e.type, o = (t ? t.appContext : e.appContext) || zr, i = {
    uid: Yr++,
    vnode: e,
    type: a,
    parent: t,
    appContext: o,
    root: null,
    // to be immediately set
    next: null,
    subTree: null,
    // will be set synchronously right after creation
    effect: null,
    update: null,
    // will be set synchronously right after creation
    job: null,
    scope: new bi(
      !0
      /* detached */
    ),
    render: null,
    proxy: null,
    exposed: null,
    exposeProxy: null,
    withProxy: null,
    provides: t ? t.provides : Object.create(o.provides),
    ids: t ? t.ids : ["", 0, 0],
    accessCache: null,
    renderCache: [],
    // local resolved assets
    components: null,
    directives: null,
    // resolved props and emits options
    propsOptions: mo(a, o),
    emitsOptions: uo(a, o),
    // emit
    emit: null,
    // to be set immediately
    emitted: null,
    // props default value
    propsDefaults: De,
    // inheritAttrs
    inheritAttrs: a.inheritAttrs,
    // state
    ctx: De,
    data: De,
    props: De,
    attrs: De,
    slots: De,
    refs: De,
    setupState: De,
    setupContext: null,
    // suspense related
    suspense: n,
    suspenseId: n ? n.pendingId : 0,
    asyncDep: null,
    asyncResolved: !1,
    // lifecycle hooks
    // not using enums here because it results in computed properties
    isMounted: !1,
    isUnmounted: !1,
    isDeactivated: !1,
    bc: null,
    c: null,
    bm: null,
    m: null,
    bu: null,
    u: null,
    um: null,
    bum: null,
    da: null,
    a: null,
    rtg: null,
    rtc: null,
    ec: null,
    sp: null
  };
  return i.ctx = { _: i }, i.root = t ? t.root : i, i.emit = Mr.bind(null, i), e.ce && e.ce(i), i;
}
let at = null;
const Qr = () => at || vt;
let mn, ul;
{
  const e = Sn(), t = (n, a) => {
    let o;
    return (o = e[n]) || (o = e[n] = []), o.push(a), (i) => {
      o.length > 1 ? o.forEach((p) => p(i)) : o[0](i);
    };
  };
  mn = t(
    "__VUE_INSTANCE_SETTERS__",
    (n) => at = n
  ), ul = t(
    "__VUE_SSR_SETTERS__",
    (n) => qs = n
  );
}
const Gs = (e) => {
  const t = at;
  return mn(e), e.scope.on(), () => {
    e.scope.off(), mn(t);
  };
}, oa = () => {
  at && at.scope.off(), mn(null);
};
function To(e) {
  return e.vnode.shapeFlag & 4;
}
let qs = !1;
function Xr(e, t = !1, n = !1) {
  t && ul(t);
  const { props: a, children: o } = e.vnode, i = To(e);
  Er(e, a, i, t), Vr(e, o, n || t);
  const p = i ? Jr(e, t) : void 0;
  return t && ul(!1), p;
}
function Jr(e, t) {
  const n = e.type;
  e.accessCache = /* @__PURE__ */ Object.create(null), e.proxy = new Proxy(e.ctx, yr);
  const { setup: a } = n;
  if (a) {
    jt();
    const o = e.setupContext = a.length > 1 ? eu(e) : null, i = Gs(e), p = Ys(
      a,
      e,
      0,
      [
        e.props,
        o
      ]
    ), f = Ma(p);
    if (Wt(), i(), (f || e.sp) && !Vs(e) && so(e), f) {
      if (p.then(oa, oa), t)
        return p.then((g) => {
          ia(e, g);
        }).catch((g) => {
          Cn(g, e, 0);
        });
      e.asyncDep = p;
    } else
      ia(e, p);
  } else
    $o(e);
}
function ia(e, t, n) {
  xe(t) ? e.type.__ssrInlineRender ? e.ssrRender = t : e.render = t : Pe(t) && (e.setupState = Ya(t)), $o(e);
}
function $o(e, t, n) {
  const a = e.type;
  e.render || (e.render = a.render || $t);
  {
    const o = Gs(e);
    jt();
    try {
      hr(e);
    } finally {
      Wt(), o();
    }
  }
}
const Zr = {
  get(e, t) {
    return Je(e, "get", ""), e[t];
  }
};
function eu(e) {
  const t = (n) => {
    e.exposed = n || {};
  };
  return {
    attrs: new Proxy(e.attrs, Zr),
    slots: e.slots,
    emit: e.emit,
    expose: t
  };
}
function $n(e) {
  return e.exposed ? e.exposeProxy || (e.exposeProxy = new Proxy(Ya(Wi(e.exposed)), {
    get(t, n) {
      if (n in t)
        return t[n];
      if (n in Ls)
        return Ls[n](e);
    },
    has(t, n) {
      return n in t || n in Ls;
    }
  })) : e.proxy;
}
function tu(e) {
  return xe(e) && "__vccOpts" in e;
}
const se = (e, t) => /* @__PURE__ */ Hi(e, t, qs), su = "3.5.34";
let cl;
const ra = typeof window < "u" && window.trustedTypes;
if (ra)
  try {
    cl = /* @__PURE__ */ ra.createPolicy("vue", {
      createHTML: (e) => e
    });
  } catch {
  }
const Ao = cl ? (e) => cl.createHTML(e) : (e) => e, nu = "http://www.w3.org/2000/svg", lu = "http://www.w3.org/1998/Math/MathML", Dt = typeof document < "u" ? document : null, ua = Dt && /* @__PURE__ */ Dt.createElement("template"), au = {
  insert: (e, t, n) => {
    t.insertBefore(e, n || null);
  },
  remove: (e) => {
    const t = e.parentNode;
    t && t.removeChild(e);
  },
  createElement: (e, t, n, a) => {
    const o = t === "svg" ? Dt.createElementNS(nu, e) : t === "mathml" ? Dt.createElementNS(lu, e) : n ? Dt.createElement(e, { is: n }) : Dt.createElement(e);
    return e === "select" && a && a.multiple != null && o.setAttribute("multiple", a.multiple), o;
  },
  createText: (e) => Dt.createTextNode(e),
  createComment: (e) => Dt.createComment(e),
  setText: (e, t) => {
    e.nodeValue = t;
  },
  setElementText: (e, t) => {
    e.textContent = t;
  },
  parentNode: (e) => e.parentNode,
  nextSibling: (e) => e.nextSibling,
  querySelector: (e) => Dt.querySelector(e),
  setScopeId(e, t) {
    e.setAttribute(t, "");
  },
  // __UNSAFE__
  // Reason: innerHTML.
  // Static content here can only come from compiled templates.
  // As long as the user only uses trusted templates, this is safe.
  insertStaticContent(e, t, n, a, o, i) {
    const p = n ? n.previousSibling : t.lastChild;
    if (o && (o === i || o.nextSibling))
      for (; t.insertBefore(o.cloneNode(!0), n), !(o === i || !(o = o.nextSibling)); )
        ;
    else {
      ua.innerHTML = Ao(
        a === "svg" ? `<svg>${e}</svg>` : a === "mathml" ? `<math>${e}</math>` : e
      );
      const f = ua.content;
      if (a === "svg" || a === "mathml") {
        const g = f.firstChild;
        for (; g.firstChild; )
          f.appendChild(g.firstChild);
        f.removeChild(g);
      }
      t.insertBefore(f, n);
    }
    return [
      // first
      p ? p.nextSibling : t.firstChild,
      // last
      n ? n.previousSibling : t.lastChild
    ];
  }
}, ou = /* @__PURE__ */ Symbol("_vtc");
function iu(e, t, n) {
  const a = e[ou];
  a && (t = (t ? [t, ...a] : [...a]).join(" ")), t == null ? e.removeAttribute("class") : n ? e.setAttribute("class", t) : e.className = t;
}
const yn = /* @__PURE__ */ Symbol("_vod"), Io = /* @__PURE__ */ Symbol("_vsh"), Eo = {
  // used for prop mismatch check during hydration
  name: "show",
  beforeMount(e, { value: t }, { transition: n }) {
    e[yn] = e.style.display === "none" ? "" : e.style.display, n && t ? n.beforeEnter(e) : Ts(e, t);
  },
  mounted(e, { value: t }, { transition: n }) {
    n && t && n.enter(e);
  },
  updated(e, { value: t, oldValue: n }, { transition: a }) {
    !t != !n && (a ? t ? (a.beforeEnter(e), Ts(e, !0), a.enter(e)) : a.leave(e, () => {
      Ts(e, !1);
    }) : Ts(e, t));
  },
  beforeUnmount(e, { value: t }) {
    Ts(e, t);
  }
};
function Ts(e, t) {
  e.style.display = t ? e[yn] : "none", e[Io] = !t;
}
const ru = /* @__PURE__ */ Symbol(""), uu = /(?:^|;)\s*display\s*:/;
function cu(e, t, n) {
  const a = e.style, o = Ue(n);
  let i = !1;
  if (n && !o) {
    if (t)
      if (Ue(t))
        for (const p of t.split(";")) {
          const f = p.slice(0, p.indexOf(":")).trim();
          n[f] == null && As(a, f, "");
        }
      else
        for (const p in t)
          n[p] == null && As(a, p, "");
    for (const p in n) {
      p === "display" && (i = !0);
      const f = n[p];
      f != null ? pu(
        e,
        p,
        !Ue(t) && t ? t[p] : void 0,
        f
      ) || As(a, p, f) : As(a, p, "");
    }
  } else if (o) {
    if (t !== n) {
      const p = a[ru];
      p && (n += ";" + p), a.cssText = n, i = uu.test(n);
    }
  } else t && e.removeAttribute("style");
  yn in e && (e[yn] = i ? a.display : "", e[Io] && (a.display = "none"));
}
const ca = /\s*!important$/;
function As(e, t, n) {
  if (me(n))
    n.forEach((a) => As(e, t, a));
  else if (n == null && (n = ""), t.startsWith("--"))
    e.setProperty(t, n);
  else {
    const a = du(e, t);
    ca.test(n) ? e.setProperty(
      Jt(a),
      n.replace(ca, ""),
      "important"
    ) : e[a] = n;
  }
}
const da = ["Webkit", "Moz", "ms"], zn = {};
function du(e, t) {
  const n = zn[t];
  if (n)
    return n;
  let a = bt(t);
  if (a !== "filter" && a in e)
    return zn[t] = a;
  a = $a(a);
  for (let o = 0; o < da.length; o++) {
    const i = da[o] + a;
    if (i in e)
      return zn[t] = i;
  }
  return t;
}
function pu(e, t, n, a) {
  return e.tagName === "TEXTAREA" && (t === "width" || t === "height") && Ue(a) && n === a;
}
const pa = "http://www.w3.org/1999/xlink";
function fa(e, t, n, a, o, i = hi(t)) {
  a && t.startsWith("xlink:") ? n == null ? e.removeAttributeNS(pa, t.slice(6, t.length)) : e.setAttributeNS(pa, t, n) : n == null || i && !Ia(n) ? e.removeAttribute(t) : e.setAttribute(
    t,
    i ? "" : At(n) ? String(n) : n
  );
}
function va(e, t, n, a, o) {
  if (t === "innerHTML" || t === "textContent") {
    n != null && (e[t] = t === "innerHTML" ? Ao(n) : n);
    return;
  }
  const i = e.tagName;
  if (t === "value" && i !== "PROGRESS" && // custom elements may use _value internally
  !i.includes("-")) {
    const f = i === "OPTION" ? e.getAttribute("value") || "" : e.value, g = n == null ? (
      // #11647: value should be set as empty string for null and undefined,
      // but <input type="checkbox"> should be set as 'on'.
      e.type === "checkbox" ? "on" : ""
    ) : String(n);
    (f !== g || !("_value" in e)) && (e.value = g), n == null && e.removeAttribute(t), e._value = n;
    return;
  }
  let p = !1;
  if (n === "" || n == null) {
    const f = typeof e[t];
    f === "boolean" ? n = Ia(n) : n == null && f === "string" ? (n = "", p = !0) : f === "number" && (n = 0, p = !0);
  }
  try {
    e[t] = n;
  } catch {
  }
  p && e.removeAttribute(o || t);
}
function Yt(e, t, n, a) {
  e.addEventListener(t, n, a);
}
function fu(e, t, n, a) {
  e.removeEventListener(t, n, a);
}
const ga = /* @__PURE__ */ Symbol("_vei");
function vu(e, t, n, a, o = null) {
  const i = e[ga] || (e[ga] = {}), p = i[t];
  if (a && p)
    p.value = a;
  else {
    const [f, g] = gu(t);
    if (a) {
      const m = i[t] = hu(
        a,
        o
      );
      Yt(e, f, m, g);
    } else p && (fu(e, f, p, g), i[t] = void 0);
  }
}
const ma = /(?:Once|Passive|Capture)$/;
function gu(e) {
  let t;
  if (ma.test(e)) {
    t = {};
    let a;
    for (; a = e.match(ma); )
      e = e.slice(0, e.length - a[0].length), t[a[0].toLowerCase()] = !0;
  }
  return [e[2] === ":" ? e.slice(3) : Jt(e.slice(2)), t];
}
let Yn = 0;
const mu = /* @__PURE__ */ Promise.resolve(), yu = () => Yn || (mu.then(() => Yn = 0), Yn = Date.now());
function hu(e, t) {
  const n = (a) => {
    if (!a._vts)
      a._vts = Date.now();
    else if (a._vts <= n.attached)
      return;
    It(
      _u(a, n.value),
      t,
      5,
      [a]
    );
  };
  return n.value = e, n.attached = yu(), n;
}
function _u(e, t) {
  if (me(t)) {
    const n = e.stopImmediatePropagation;
    return e.stopImmediatePropagation = () => {
      n.call(e), e._stopped = !0;
    }, t.map(
      (a) => (o) => !o._stopped && a && a(o)
    );
  } else
    return t;
}
const ya = (e) => e.charCodeAt(0) === 111 && e.charCodeAt(1) === 110 && // lowercase letter
e.charCodeAt(2) > 96 && e.charCodeAt(2) < 123, bu = (e, t, n, a, o, i) => {
  const p = o === "svg";
  t === "class" ? iu(e, a, p) : t === "style" ? cu(e, n, a) : _n(t) ? bn(t) || vu(e, t, n, a, i) : (t[0] === "." ? (t = t.slice(1), !0) : t[0] === "^" ? (t = t.slice(1), !1) : xu(e, t, a, p)) ? (va(e, t, a), !e.tagName.includes("-") && (t === "value" || t === "checked" || t === "selected") && fa(e, t, a, p, i, t !== "value")) : /* #11081 force set props for possible async custom element */ e._isVueCE && // #12408 check if it's declared prop or it's async custom element
  (ku(e, t) || // @ts-expect-error _def is private
  e._def.__asyncLoader && (/[A-Z]/.test(t) || !Ue(a))) ? va(e, bt(t), a, i, t) : (t === "true-value" ? e._trueValue = a : t === "false-value" && (e._falseValue = a), fa(e, t, a, p));
};
function xu(e, t, n, a) {
  if (a)
    return !!(t === "innerHTML" || t === "textContent" || t in e && ya(t) && xe(n));
  if (t === "spellcheck" || t === "draggable" || t === "translate" || t === "autocorrect" || t === "sandbox" && e.tagName === "IFRAME" || t === "form" || t === "list" && e.tagName === "INPUT" || t === "type" && e.tagName === "TEXTAREA")
    return !1;
  if (t === "width" || t === "height") {
    const o = e.tagName;
    if (o === "IMG" || o === "VIDEO" || o === "CANVAS" || o === "SOURCE")
      return !1;
  }
  return ya(t) && Ue(n) ? !1 : t in e;
}
function ku(e, t) {
  const n = (
    // @ts-expect-error _def is private
    e._def.props
  );
  if (!n)
    return !1;
  const a = bt(t);
  return Array.isArray(n) ? n.some((o) => bt(o) === a) : Object.keys(n).some((o) => bt(o) === a);
}
const _s = (e) => {
  const t = e.props["onUpdate:modelValue"] || !1;
  return me(t) ? (n) => on(t, n) : t;
};
function Su(e) {
  e.target.composing = !0;
}
function ha(e) {
  const t = e.target;
  t.composing && (t.composing = !1, t.dispatchEvent(new Event("input")));
}
const Nt = /* @__PURE__ */ Symbol("_assign");
function _a(e, t, n) {
  return t && (e = e.trim()), n && (e = kn(e)), e;
}
const Qe = {
  created(e, { modifiers: { lazy: t, trim: n, number: a } }, o) {
    e[Nt] = _s(o);
    const i = a || o.props && o.props.type === "number";
    Yt(e, t ? "change" : "input", (p) => {
      p.target.composing || e[Nt](_a(e.value, n, i));
    }), (n || i) && Yt(e, "change", () => {
      e.value = _a(e.value, n, i);
    }), t || (Yt(e, "compositionstart", Su), Yt(e, "compositionend", ha), Yt(e, "change", ha));
  },
  // set value on mounted so it's after min/max for type="range"
  mounted(e, { value: t }) {
    e.value = t ?? "";
  },
  beforeUpdate(e, { value: t, oldValue: n, modifiers: { lazy: a, trim: o, number: i } }, p) {
    if (e[Nt] = _s(p), e.composing) return;
    const f = (i || e.type === "number") && !/^0\d/.test(e.value) ? kn(e.value) : e.value, g = t ?? "";
    if (f === g)
      return;
    const m = e.getRootNode();
    (m instanceof Document || m instanceof ShadowRoot) && m.activeElement === e && e.type !== "range" && (a && t === n || o && e.value.trim() === g) || (e.value = g);
  }
}, Pl = {
  // #4096 array checkboxes need to be deep traversed
  deep: !0,
  created(e, t, n) {
    e[Nt] = _s(n), Yt(e, "change", () => {
      const a = e._modelValue, o = Hs(e), i = e.checked, p = e[Nt];
      if (me(a)) {
        const f = yl(a, o), g = f !== -1;
        if (i && !g)
          p(a.concat(o));
        else if (!i && g) {
          const m = [...a];
          m.splice(f, 1), p(m);
        }
      } else if (ks(a)) {
        const f = new Set(a);
        i ? f.add(o) : f.delete(o), p(f);
      } else
        p(Do(e, i));
    });
  },
  // set initial checked on mount to wait for true-value/false-value
  mounted: ba,
  beforeUpdate(e, t, n) {
    e[Nt] = _s(n), ba(e, t, n);
  }
};
function ba(e, { value: t, oldValue: n }, a) {
  e._modelValue = t;
  let o;
  if (me(t))
    o = yl(t, a.props.value) > -1;
  else if (ks(t))
    o = t.has(a.props.value);
  else {
    if (t === n) return;
    o = Ss(t, Do(e, !0));
  }
  e.checked !== o && (e.checked = o);
}
const Po = {
  // <select multiple> value need to be deep traversed
  deep: !0,
  created(e, { value: t, modifiers: { number: n } }, a) {
    const o = ks(t);
    Yt(e, "change", () => {
      const i = Array.prototype.filter.call(e.options, (p) => p.selected).map(
        (p) => n ? kn(Hs(p)) : Hs(p)
      );
      e[Nt](
        e.multiple ? o ? new Set(i) : i : i[0]
      ), e._assigning = !0, Bs(() => {
        e._assigning = !1;
      });
    }), e[Nt] = _s(a);
  },
  // set value in mounted & updated because <select> relies on its children
  // <option>s.
  mounted(e, { value: t }) {
    xa(e, t);
  },
  beforeUpdate(e, t, n) {
    e[Nt] = _s(n);
  },
  updated(e, { value: t }) {
    e._assigning || xa(e, t);
  }
};
function xa(e, t) {
  const n = e.multiple, a = me(t);
  if (!(n && !a && !ks(t))) {
    for (let o = 0, i = e.options.length; o < i; o++) {
      const p = e.options[o], f = Hs(p);
      if (n)
        if (a) {
          const g = typeof f;
          g === "string" || g === "number" ? p.selected = t.some((m) => String(m) === String(f)) : p.selected = yl(t, f) > -1;
        } else
          p.selected = t.has(f);
      else if (Ss(Hs(p), t)) {
        e.selectedIndex !== o && (e.selectedIndex = o);
        return;
      }
    }
    !n && e.selectedIndex !== -1 && (e.selectedIndex = -1);
  }
}
function Hs(e) {
  return "_value" in e ? e._value : e.value;
}
function Do(e, t) {
  const n = t ? "_trueValue" : "_falseValue";
  return n in e ? e[n] : t;
}
const wu = ["ctrl", "shift", "alt", "meta"], Cu = {
  stop: (e) => e.stopPropagation(),
  prevent: (e) => e.preventDefault(),
  self: (e) => e.target !== e.currentTarget,
  ctrl: (e) => !e.ctrlKey,
  shift: (e) => !e.shiftKey,
  alt: (e) => !e.altKey,
  meta: (e) => !e.metaKey,
  left: (e) => "button" in e && e.button !== 0,
  middle: (e) => "button" in e && e.button !== 1,
  right: (e) => "button" in e && e.button !== 2,
  exact: (e, t) => wu.some((n) => e[`${n}Key`] && !t.includes(n))
}, Ot = (e, t) => {
  if (!e) return e;
  const n = e._withMods || (e._withMods = {}), a = t.join(".");
  return n[a] || (n[a] = ((o, ...i) => {
    for (let p = 0; p < t.length; p++) {
      const f = Cu[t[p]];
      if (f && f(o, t)) return;
    }
    return e(o, ...i);
  }));
}, Mu = {
  esc: "escape",
  space: " ",
  up: "arrow-up",
  left: "arrow-left",
  right: "arrow-right",
  down: "arrow-down",
  delete: "backspace"
}, Ru = (e, t) => {
  const n = e._withKeys || (e._withKeys = {}), a = t.join(".");
  return n[a] || (n[a] = ((o) => {
    if (!("key" in o))
      return;
    const i = Jt(o.key);
    if (t.some(
      (p) => p === i || Mu[p] === i
    ))
      return e(o);
  }));
}, Tu = /* @__PURE__ */ et({ patchProp: bu }, au);
let ka;
function $u() {
  return ka || (ka = Fr(Tu));
}
const Au = ((...e) => {
  const t = $u().createApp(...e), { mount: n } = t;
  return t.mount = (a) => {
    const o = Eu(a);
    if (!o) return;
    const i = t._component;
    !xe(i) && !i.render && !i.template && (i.template = o.innerHTML), o.nodeType === 1 && (o.textContent = "");
    const p = n(o, !1, Iu(o));
    return o instanceof Element && (o.removeAttribute("v-cloak"), o.setAttribute("data-v-app", "")), p;
  }, t;
});
function Iu(e) {
  if (e instanceof SVGElement)
    return "svg";
  if (typeof MathMLElement == "function" && e instanceof MathMLElement)
    return "mathml";
}
function Eu(e) {
  return Ue(e) ? document.querySelector(e) : e;
}
const Dl = "session:current", Pu = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i, K = (e) => typeof e == "string" ? e : typeof e == "number" ? String(e) : "", Ie = (e) => Array.isArray(e) ? e.filter((t) => t && typeof t == "object") : [], Gn = (e) => e && typeof e == "object" && !Array.isArray(e) ? e : {}, bs = (e) => [...new Map(e.filter((t) => t.id).map((t) => [t.id, t])).values()], _t = (e = "unavailable", t = "") => ({ availability: e, error: t }), Is = (e, t = !1) => e?.availability === "error" ? _t("error", e.error) : _t(e?.availability === "available" || t ? "available" : "unavailable", e?.error || "");
function Qn(e) {
  return typeof e == "string" ? e : Ie(e).filter((t) => ["text", "input_text", "output_text"].includes(t.type)).map((t) => K(t.text)).filter(Boolean).join(`
`);
}
function Oo(e) {
  const t = K(e?.CLISettings?.cc_path), n = K(e?.sandboxCurrentWs), a = K(e?.sandboxCurrentProject), o = Ie(e?.enterpriseWorkspaces).find((p) => K(p.id) === n), i = Ie(e?.enterpriseProjects).find((p) => K(p.id) === a && (!n || K(p.workspaceId) === n));
  return {
    directory: t,
    name: t.split(/[\\/]/).filter(Boolean).pop() || "",
    enterpriseWorkspaceId: n,
    enterpriseWorkspaceName: K(o?.name),
    projectId: a,
    projectName: K(i?.name)
  };
}
function ln(e) {
  const t = Oo(e);
  return JSON.stringify([t.directory, t.enterpriseWorkspaceId, t.projectId]);
}
function Vo(e) {
  return e ? K(e.conversationId) || Dl : "";
}
function Du(e, t) {
  const n = Vo(e), a = Ie(e?.conversations).filter((o) => !o.isPlaceholder);
  return n && !a.some((o) => K(o.id) === n) && a.unshift({ id: n, title: K(e?.conversationTitle) }), bs(a.map((o) => {
    const i = K(o.id), p = i === n, f = p && Array.isArray(e?.messages) ? e.messages : o.messages, g = (i === t ? Ie(f) : []).map((h, R) => ({
      id: K(h.id) || `${i}:message:${R}`,
      role: K(h.role),
      content: Qn(h.pure_content || h.content),
      agentId: K(h.agentId || h.agent_id)
    })), m = !o.title && Array.isArray(f) ? f.find((h) => h?.role === "user" && Qn(h.pure_content || h.content)) : null;
    return {
      id: i,
      title: K(o.title) || Qn(m?.pure_content || m?.content).slice(0, 48),
      isCurrent: p,
      contentAvailable: Array.isArray(f),
      messageCount: Array.isArray(f) ? f.length : null,
      messages: g
    };
  }));
}
function ht(e, t = "task") {
  const n = K(t === "incident" ? e.incidentId : e.id || e.task_id);
  return {
    id: n ? `${t}:${n}` : "",
    source: t,
    sourceId: n,
    title: K(e.title || e.goal),
    status: K(e.status),
    workspaceId: K(e.workspaceId || e.workspace_id),
    workspacePath: K(e.workspacePath || e.workspace_path),
    updatedAt: K(e.updatedAt || e.updated_at || e.createdAt || e.created_at || e.timestamp)
  };
}
function Sa(e, t, n = !1) {
  if (n)
    return (!t.enterpriseWorkspaceId || K(e.workspaceId) === t.enterpriseWorkspaceId) && (!t.projectId || K(e.projectId) === t.projectId);
  const a = K(e.workspacePath || e.workspace_path);
  return !a || !t.directory || a === t.directory;
}
function an(e, t) {
  return {
    id: K(e.id || e.observation_id || e.session_id || e.sessionId || e.turn_id || e.digest) || `record:${t}`,
    title: K(e.title || e.task_title || e.event_type || e.stage),
    summary: K(e.summary || e.detail || e.content || e.description),
    source: K(e.source || e.channel || e.origin),
    timestamp: K(e.timestamp || e.updated_at || e.created_at || e.createdAt)
  };
}
function Xn(e, t, n) {
  return t.kind === "task" ? !!n && K(e.task_id || e.taskId) === n : !!t.sessionId && t.sessionId !== Dl && K(e.session_id || e.sessionId) === t.sessionId;
}
function Lo(e) {
  return {
    id: K(e.roleCardId || e.id || e.agentId || e.agent_id),
    name: K(e.name || e.agentName || e.agent_name),
    role: K(e.teamRole || e.role || e.department)
  };
}
function Ou(e, t, n) {
  const a = t?.data, o = a?.task || e, i = ht(o), p = a?.events || o.events || o.execution_trace || o.recent_trace_excerpt, g = (typeof p == "string" && p ? [{ message: p }] : Ie(p)).map((m, h) => ({
    id: K(m.id || m.eventId) || `${i.id}:event:${h}`,
    title: K(m.type || m.eventType || m.stage),
    summary: K(m.message || m.summary || m.content),
    timestamp: K(m.createdAt || m.timestamp || m.created_at),
    agentId: K(m.agentId || m.agent_id || m.roleCardId),
    status: K(m.nextStatus || m.status)
  }));
  return {
    ...i,
    ...Is(t, !0),
    detailAvailability: t?.availability === "error" ? "error" : a ? "available" : "unavailable",
    goal: K(o.description || o.goal || o.context?.goal),
    summary: K(o.resultSummary || o.result_summary || o.summary || a?.consensusContent),
    events: n.agentId ? g.filter((m) => m.agentId === n.agentId) : g,
    members: bs(Ie(o.details?.members || o.members).map(Lo)),
    evidenceRefs: Ie(o.artifacts).map((m) => ({
      id: K(m.artifactId),
      summary: K(m.label),
      resourceVersion: "",
      timestamp: ""
    })),
    childTasks: Ie(a?.childTasks).map((m) => ht(m))
  };
}
function Vu(e, t, n) {
  const a = K(e.activeTraceId), o = (m) => K(m.incidentId) === K(e.incidentId) && K(m.workspaceId) === K(e.workspaceId) && !!a && K(m.traceId) === a, i = Ie(t.teamBindings).filter(o), p = Ie(t.agentDecisions).filter(o), f = Ie(t.taskGraphs).filter(o), g = p.flatMap((m) => [
    {
      id: K(m.decisionId),
      title: K(m.stage),
      summary: K(m.summary),
      timestamp: K(m.createdAt),
      agentId: K(m.roleCardId),
      status: K(m.decision)
    },
    ...Ie(m.transportEvents).map((h) => ({
      id: K(h.eventId) || `${K(m.decisionId)}:transport:${K(h.sequence)}`,
      title: K(h.kind),
      summary: K(h.redactedBody),
      timestamp: K(h.observedAt),
      agentId: K(m.roleCardId),
      status: K(h.direction)
    }))
  ]).concat(f.flatMap((m) => Ie(m.events).map((h) => ({
    id: K(h.eventId),
    title: K(h.eventType),
    summary: K(h.reasonCode),
    timestamp: K(h.createdAt),
    agentId: K(h.toRoleCardId || h.fromRoleCardId),
    status: ""
  }))));
  return {
    ...ht(e, "incident"),
    ..._t("available"),
    detailAvailability: "available",
    goal: K(e.summary),
    summary: K(e.summary),
    traceId: a,
    events: bs(g).filter((m) => !n.agentId || m.agentId === n.agentId),
    members: bs(i.flatMap((m) => Ie(m.memberSnapshots).map(Lo))),
    evidenceRefs: Ie(t.evidence).filter(o).map((m) => ({
      id: K(m.evidenceId),
      summary: K(m.summary),
      resourceVersion: K(m.resourceVersion),
      timestamp: K(m.observedAt)
    })),
    childTasks: []
  };
}
async function ls(e, t, n, a) {
  if (typeof e?.[t] != "function") return { ..._t("unavailable"), data: null };
  try {
    const o = n === void 0 ? await e[t]() : await e[t](n);
    if (!a(o)) throw new Error(`${t}: response unavailable`);
    return { ..._t("available"), data: o };
  } catch (o) {
    return { ..._t("error", K(o?.message) || "Context read failed"), data: null };
  }
}
function Lu({ getHost: e = () => null, getDesktopApi: t = () => null } = {}) {
  let n = { kind: "session", sessionId: null, taskId: "", agentId: "" }, a = 0, o = null, i = null;
  function p(b) {
    return { ...n, sessionId: n.sessionId === null ? Vo(b) : n.sessionId };
  }
  function f(b) {
    return JSON.stringify([ln(b), p(b)]);
  }
  function g(b) {
    const A = p(b);
    return JSON.stringify([ln(b), A.kind, A.sessionId, A.taskId]);
  }
  function m() {
    const b = e(), A = Oo(b), B = p(b), J = ln(b), G = o?.workspaceKey === J ? o : null, $ = G?.targetKey === g(b) ? G : null, Q = i?.generation === a && i.scopeKey === f(b), ae = Du(b, B.sessionId), w = ae.find((C) => C.id === B.sessionId), _e = {
      id: B.sessionId,
      title: w?.title || "",
      ..._t(w?.contentAvailable ? "available" : "unavailable"),
      messages: w?.messages || []
    }, ye = Gn(b?.competitionSnapshot), ne = G?.competition?.data || ye, Ce = G?.tasks?.data?.tasks || Ie(b?.taskList), ke = Ie(ne.incidents).filter((C) => Sa(C, A, !0)), Z = Ie(Ce).filter((C) => Sa(C, A)), Me = bs(Z.map((C) => ht(C)).concat(ke.map((C) => ht(C, "incident")))), ie = Me.find((C) => C.id === B.taskId), k = Z.find((C) => ht(C).id === B.taskId) || ($?.detail?.data?.task && ht($.detail.data.task).id === B.taskId ? $.detail.data.task : null), H = ke.find((C) => ht(C, "incident").id === B.taskId), ve = b?.viewingTaskDetail, be = ve && ht(ve).id === B.taskId ? { ..._t("available"), data: { task: ve } } : null, he = H ? Vu(H, ne, B) : k ? Ou(k, $?.detail || be, B) : { id: B.taskId, source: "", sourceId: "", title: "", status: "", ...Is($?.detail), detailAvailability: "unavailable", goal: "", summary: "", events: [], members: [], evidenceRefs: [], childTasks: [] }, le = ie?.source === "task" ? K(k?.legacyTaskId || k?.task_id || ie.sourceId) : "", Le = G?.bootstrap?.data, Fe = Gn(Le?.overview), Te = !!A.directory && K(b?.recallWorkspace) === A.directory, $e = Te ? Ie(b?.recallSessionSummaries) : [], ce = Te ? Ie(b?.recallObservationItems) : [], O = Ie(Fe.recent_sessions || $e), M = $?.observations?.data?.observations || Ie(Fe.recent_observations).concat(ce).filter((C) => Xn(C, B, le)), V = $?.timeline?.data?.timeline || (Te ? Ie(b?.recallTimeline).filter((C) => Xn(C, B, le)) : []), Se = Ie(Le?.interrupted || (Te ? b?.recallInterruptedTurns : [])).filter((C) => Xn(C, B, le)), He = [G?.bootstrap, $?.observations, $?.timeline].filter((C) => C?.error).map((C) => C.error).join("; "), tt = !!Le || M.length > 0 || V.length > 0 || $e.length > 0, ze = G?.profile?.data, Ke = K(ze?.releaseProfile || b?.competitionReleaseProfile), y = ze ? ze.rehearsalEnabled === !0 : b?.competitionRehearsalAvailable === !0, x = {
      releaseProfile: Ke,
      rehearsalEnabled: y,
      ...Is(G?.profile, !!Ke || typeof b?.competitionRehearsalAvailable == "boolean")
    }, T = bs([
      ...b?.mainAgent ? [{ id: K(b.mainAgent), name: K(b?.agents?.[b.mainAgent]?.name) || K(b.mainAgent) }] : [],
      ...Object.entries(Gn(b?.agents)).map(([C, F]) => ({ id: C, name: K(F?.name) || C })),
      ...Ie(b?.enterpriseRoleCards || b?.staffRoles).map((C) => ({ id: K(C.id), name: K(C.name || C.displayName) || K(C.id) })),
      ...he.members.map((C) => ({ id: C.id, name: C.name || C.id }))
    ]), N = [G?.tasks, G?.competition, G?.profile, $?.detail].filter((C) => C?.error).map((C) => C.error);
    return He && N.push(He), {
      scope: B,
      workspace: A,
      agents: T,
      sessions: ae.map(({ messages: C, ...F }) => F),
      tasks: Me,
      session: _e,
      task: he,
      taskCatalog: Is(G?.tasks, Z.length > 0),
      incidentCatalog: Is(G?.competition, Ie(ne.incidents).length > 0),
      recall: {
        ..._t(He ? "error" : tt ? "available" : "unavailable", He),
        loading: !!Q,
        sessions: O.map(an),
        observations: M.map(an),
        interrupted: Se.map(an),
        timeline: V.map(an),
        observationAvailability: $?.observations?.availability || (M.length ? "available" : "unavailable")
      },
      extensions: x,
      measurement: { tokenCount: null, assembledInputAvailable: !1, kind: "unknown" },
      loading: !!Q,
      error: [...new Set(N)].join("; ")
    };
  }
  function h(b) {
    return n = { ...n, ...b }, a += 1, m();
  }
  async function R() {
    const b = e(), A = t(), B = m(), J = { generation: ++a, scopeKey: f(b), targetKey: g(b), workspaceKey: ln(b) };
    i = J;
    const $ = B.tasks.find((ie) => ie.id === B.scope.taskId && ie.source === "task")?.sourceId || (B.scope.taskId.startsWith("task:") ? B.scope.taskId.slice(5) : ""), Q = Ie(b?.taskList).find((ie) => ht(ie).id === B.scope.taskId), ae = Ie(o?.workspaceKey === J.workspaceKey ? o?.tasks?.data?.tasks : []).find((ie) => ht(ie).id === B.scope.taskId), w = B.scope.kind === "task" && $ ? K(ae?.legacyTaskId || Q?.legacyTaskId || Q?.task_id || $) : "", _e = B.scope.kind === "session" && B.scope.sessionId !== Dl ? B.scope.sessionId : "", ye = { taskId: w, sessionId: _e, digest: "", query: "", limit: 60, origin: "" }, ne = !!(w || _e), Ce = { ..._t("unavailable"), data: null }, ke = ls(
      A,
      "getApplicationCompetitionUiProfile",
      void 0,
      (ie) => ["production", "goai-staging"].includes(ie?.releaseProfile) && typeof ie?.rehearsalEnabled == "boolean"
    ), Z = ke.then((ie) => {
      const k = ie.data;
      return (k ? k.releaseProfile === "goai-staging" || k.rehearsalEnabled : b?.competitionReleaseProfile === "goai-staging" || b?.competitionRehearsalAvailable === !0) || Ie(b?.competitionSnapshot?.incidents).length > 0 ? ls(A, "getApplicationCompetitionSnapshot", void 0, (ve) => Array.isArray(ve?.incidents)) : Ce;
    }), Me = await Promise.all([
      ls(A, "listTasks", B.workspace.directory ? { workspacePath: B.workspace.directory } : {}, (ie) => Array.isArray(ie?.tasks)),
      ls(A, "getApplicationRecallBootstrap", void 0, (ie) => !!ie?.overview && typeof ie.overview == "object"),
      Pu.test($) ? ls(A, typeof A?.getTaskExecution == "function" ? "getTaskExecution" : "getTask", { taskId: $ }, (ie) => K(ie?.task?.id) === $) : Ce,
      ne ? ls(A, "getApplicationRecallObservations", ye, (ie) => Array.isArray(ie?.observations) && (!ie.workspace || ie.workspace === B.workspace.directory)) : Ce,
      ne ? ls(A, "getApplicationRecallTimeline", { ...ye, limit: 40, depthBefore: 10, depthAfter: 10 }, (ie) => Array.isArray(ie?.timeline) && (!ie.workspace || ie.workspace === B.workspace.directory)) : Ce,
      ke,
      Z
    ]);
    if (a === J.generation && f(e()) === J.scopeKey) {
      const [ie, k, H, ve, be, he, le] = Me;
      k.data?.overview?.workspace && k.data.overview.workspace !== B.workspace.directory && (k.data = null, Object.assign(k, _t("error", "Recall workspace does not match the selected directory"))), o = { ...J, tasks: ie, bootstrap: k, detail: H, observations: ve, timeline: be, profile: he, competition: le };
    }
    return i === J && (i = null), m();
  }
  return {
    snapshot: m,
    refresh: R,
    selectSession: (b) => h({ kind: "session", sessionId: K(b), taskId: "", agentId: "" }),
    selectTask: (b) => h({ kind: "task", taskId: K(b), agentId: "" }),
    selectAgent: (b) => h({ agentId: K(b) })
  };
}
function fe() {
  return typeof window < "u" && window.openxnetApp || null;
}
const Be = {
  snapshot: null,
  loading: !1,
  request: null,
  error: null,
  progress: {},
  unsubscribe: null
}, ue = {
  status: null,
  recovery: null,
  recoveryAttempted: !1,
  items: [],
  selectedMemoryId: "",
  selectedMemory: null,
  history: [],
  integrity: null,
  actorAgent: "",
  query: "",
  includeRetired: !1,
  loading: !1,
  error: ""
}, Ne = {
  status: null,
  loading: !1,
  error: "",
  attempted: !1,
  request: null
}, Fu = [
  {
    capabilityId: "voice",
    icon: "fa-solid fa-microphone-lines",
    nameZh: "语音与识别",
    nameEn: "Voice and ASR",
    descriptionZh: "本地语音识别、转写与音频处理运行时。",
    descriptionEn: "Local speech recognition, transcription, and audio runtime."
  },
  {
    capabilityId: "vector-index",
    icon: "fa-solid fa-vector-square",
    nameZh: "向量索引",
    nameEn: "Vector Index",
    descriptionZh: "本地向量嵌入、索引与语义检索运行时。",
    descriptionEn: "Local embedding, indexing, and semantic retrieval runtime."
  },
  {
    capabilityId: "memory",
    icon: "fa-solid fa-brain",
    nameZh: "长期记忆",
    nameEn: "Long-term Memory",
    descriptionZh: "长期记忆存储、召回与关联处理运行时。",
    descriptionEn: "Long-term memory storage, recall, and association runtime."
  },
  {
    capabilityId: "documents",
    icon: "fa-solid fa-file-lines",
    nameZh: "文档处理",
    nameEn: "Document Processing",
    descriptionZh: "Office、PDF 与结构化文档提取运行时。",
    descriptionEn: "Office, PDF, and structured document extraction runtime."
  },
  {
    capabilityId: "connectors",
    icon: "fa-solid fa-plug",
    nameZh: "外部连接器",
    nameEn: "External Connectors",
    descriptionZh: "QQ、飞书、钉钉、Discord 与 Slack 连接器。",
    descriptionEn: "QQ, Feishu, DingTalk, Discord, and Slack connectors."
  },
  {
    capabilityId: "gitnexus",
    icon: "fa-solid fa-code-branch",
    nameZh: "代码知识图谱",
    nameEn: "GitNexus",
    descriptionZh: "代码索引、关系图谱与仓库上下文运行时。",
    descriptionEn: "Code indexing, relationship graph, and repository context runtime."
  }
];
function mt() {
  return typeof window < "u" && window.openxnetDesktop || null;
}
const Nu = Lu({ getHost: fe, getDesktopApi: mt });
function ju() {
  const e = mt();
  Be.unsubscribe || !e?.onFeaturePackProgress || (Be.unsubscribe = e.onFeaturePackProgress((t) => {
    t?.capabilityId && (Be.progress = {
      ...Be.progress,
      [t.capabilityId]: { ...t }
    }, t.phase === "failed" && t.error && (Be.error = { ...t.error }));
  }));
}
async function An(e = !0) {
  const t = mt();
  return t?.listFeaturePacks ? (ju(), Be.request || (Be.loading = !0, Be.request = t.listFeaturePacks({ refresh: !!e }).then((n) => (Be.snapshot = n, Be.error = n?.error || null, n)).catch((n) => (Be.error = {
    code: "FEATURE_PACK_OPERATION_FAILED",
    message: String(n?.message || "Feature Pack state could not be loaded."),
    retryable: !0
  }, null)).finally(() => {
    Be.loading = !1, Be.request = null;
  })), Be.request) : null;
}
async function Wu(e, t) {
  const n = mt(), o = {
    install: n?.installFeaturePack,
    repair: n?.repairFeaturePack,
    uninstall: n?.uninstallFeaturePack
  }[e];
  if (typeof o != "function") return null;
  Be.error = null, Be.progress = {
    ...Be.progress,
    [t]: {
      capabilityId: t,
      operation: e,
      phase: "preparing",
      percent: null,
      transferredBytes: null,
      totalBytes: null
    }
  };
  try {
    return await o.call(n, { capabilityId: t });
  } catch (i) {
    throw Be.error = {
      code: "FEATURE_PACK_OPERATION_FAILED",
      message: String(i?.message || "Feature Pack operation failed."),
      retryable: !0
    }, i;
  } finally {
    await An(!1);
  }
}
function Bu(e) {
  const t = Be.snapshot, n = new Map((t?.packs || []).map((a) => [a.capabilityId, a]));
  return {
    available: !!mt()?.listFeaturePacks,
    loading: Be.loading,
    feedStatus: t?.feedStatus || (mt() ? "loading" : "unavailable"),
    catalogGeneratedAt: t?.catalogGeneratedAt || null,
    error: Be.error || t?.error || null,
    items: Fu.map((a) => {
      const o = n.get(a.capabilityId) || {};
      return {
        ...o,
        capabilityId: a.capabilityId,
        icon: a.icon,
        displayName: e ? a.nameZh : a.nameEn,
        description: e ? a.descriptionZh : a.descriptionEn,
        status: o.status || "not-installed",
        installedVersion: o.installedVersion || null,
        availableVersion: o.availableVersion || null,
        operation: o.operation || null,
        progress: Be.progress[a.capabilityId] || null
      };
    })
  };
}
function Qs(e) {
  if (e && typeof e.isCurrentLanguageZh == "function")
    try {
      return !!e.isCurrentLanguageZh();
    } catch {
      return !0;
    }
  return String(e?.currentLanguage || navigator.language || "zh-CN").toLowerCase().startsWith("zh");
}
function Ol(e, t, n) {
  if (!t) return "";
  if (n && t.prototypeLabelZh) return String(t.prototypeLabelZh);
  if (!n && t.prototypeLabelEn) return String(t.prototypeLabelEn);
  if (e && typeof e.t == "function" && t.title)
    try {
      return String(e.t(t.title) || t.id || "");
    } catch {
      return String(t.id || "");
    }
  return String(t.title || t.label || t.id || "");
}
function z(e) {
  return Array.isArray(e) ? e : [];
}
function Qt(e, t = 140) {
  const n = String(e || "").trim();
  return n.length <= t ? n : `${n.slice(0, t - 1)}...`;
}
function gs(e) {
  if (!e) return "";
  try {
    const t = new Date(e);
    return Number.isNaN(t.getTime()) ? String(e) : t.toLocaleString();
  } catch {
    return String(e);
  }
}
function Xs(e) {
  return z(e).map((t) => ({
    label: String(t?.label || ""),
    value: String(t?.value ?? ""),
    meta: String(t?.meta || ""),
    emphasis: !!t?.emphasis,
    truncate: !!t?.truncate
  }));
}
function yt(e, t) {
  return e ? t ? "已启用" : "Enabled" : t ? "未启用" : "Disabled";
}
function Pt(e, t, n = "运行中", a = "Running") {
  return e ? t ? n : a : t ? "待启动" : "Standby";
}
function Uu(e) {
  return e ? "true" : "false";
}
function Fo(e, t, n = "") {
  const a = String(t || "").trim();
  if (!a) return String(n || "");
  if (e && typeof e.t == "function")
    try {
      const o = e.t(a);
      if (o && o !== a)
        return String(o);
    } catch {
    }
  return String(n || a);
}
function Jn(e, t, n = "") {
  if (typeof t == "string")
    return { value: t, label: n || t };
  const a = String(t?.value ?? t?.id ?? t?.key ?? "").trim(), o = t?.label ?? t?.name ?? t?.title ?? a;
  return {
    value: a,
    label: Fo(e, o, n || o || a),
    description: String(t?.description || t?.desc || ""),
    icon: String(t?.icon || "")
  };
}
function Ku(e) {
  return {
    deploy: "deploy-bot",
    vrm: "vrm",
    workbench: "api-group",
    enterprise: "enterprise",
    storage: "storage",
    kernel: "kernel",
    system: "system",
    task: "task-center",
    about: "logo"
  }[e] || "";
}
function qu(e, t) {
  const n = z(e?.deployTiles).map((i) => ({
    id: String(i?.id || ""),
    icon: String(i?.icon || "fa-solid fa-circle"),
    label: Ol(e, i, t)
  })), a = String(e?.subMenu || n[0]?.id || "table_pet"), o = e?.getPrototypeDeployDetailMeta?.(a) || {
    title: t ? "部署机器人" : "Deploy Bots",
    summary: t ? "配置多平台机器人连接、权限和消息路由。" : "Configure multi-platform bot connections, permissions, and message routing.",
    chips: []
  };
  return {
    title: t ? "部署机器人" : "Deploy Bots",
    subtitle: t ? "配置多平台机器人连接、权限和消息路由" : "Configure multi-platform bot connections, permissions, and message routing.",
    tabs: n,
    activeTab: a,
    meta: o,
    stats: Xs(e?.getPrototypeDeployDetailStats?.(a)),
    deskPet: {
      online: !!(e?.isVRMRunning || e?.vrmOnline),
      status: Pt(!!(e?.isVRMRunning || e?.vrmOnline), t, "桌宠在线", "Online"),
      modelId: String(e?.VRMConfig?.selectedModelId || e?.VRMConfig?.name || (t ? "未选择模型" : "No model")),
      expressions: yt(!!e?.VRMConfig?.enabledExpressions, t),
      motions: yt(!!e?.VRMConfig?.enabledMotions, t),
      width: Number(e?.VRMConfig?.windowWidth || 540),
      height: Number(e?.VRMConfig?.windowHeight || 960),
      userModels: z(e?.VRMConfig?.userModels).length,
      motionCount: z(e?.VRMConfig?.selectedMotionIds).length
    },
    imChannels: [
      {
        id: "qq",
        label: "QQ",
        running: !!e?.isQQBotRunning,
        status: Pt(!!e?.isQQBotRunning, t),
        agent: String(e?.qqBotConfig?.QQAgent || "openxnet-model"),
        memory: `${Number(e?.qqBotConfig?.memoryLimit || 30)} ${t ? "轮记忆" : "turns"}`,
        note: `${z(e?.qqBotConfig?.separators).length} ${t ? "个分隔符" : "separators"}`
      },
      {
        id: "feishu",
        label: t ? "飞书" : "Feishu",
        running: !!e?.isFeishuBotRunning,
        status: Pt(!!e?.isFeishuBotRunning, t),
        agent: String(e?.feishuBotConfig?.FeishuAgent || "openxnet-model"),
        memory: `${Number(e?.feishuBotConfig?.memoryLimit || 30)} ${t ? "轮记忆" : "turns"}`,
        note: yt(!!e?.feishuBotConfig?.enableTTS, t)
      },
      {
        id: "dingtalk",
        label: t ? "钉钉" : "DingTalk",
        running: !!e?.isDingtalkBotRunning,
        status: Pt(!!e?.isDingtalkBotRunning, t),
        agent: String(e?.dingtalkBotConfig?.DingtalkAgent || "openxnet-model"),
        memory: `${Number(e?.dingtalkBotConfig?.memoryLimit || 30)} ${t ? "轮记忆" : "turns"}`,
        note: yt(!!e?.dingtalkBotConfig?.enableTTS, t)
      },
      {
        id: "telegram",
        label: "Telegram",
        running: !!e?.isTelegramBotRunning,
        status: Pt(!!e?.isTelegramBotRunning, t),
        agent: String(e?.telegramBotConfig?.TelegramAgent || "openxnet-model"),
        memory: `${Number(e?.telegramBotConfig?.memoryLimit || 20)} ${t ? "轮记忆" : "turns"}`,
        note: yt(!!e?.telegramBotConfig?.enableTTS, t)
      },
      {
        id: "discord",
        label: "Discord",
        running: !!e?.isDiscordBotRunning,
        status: Pt(!!e?.isDiscordBotRunning, t),
        agent: String(e?.discordBotConfig?.llm_model || "openxnet-model"),
        memory: `${Number(e?.discordBotConfig?.memory_limit || 30)} ${t ? "轮记忆" : "turns"}`,
        note: yt(!!e?.discordBotConfig?.enable_tts, t)
      },
      {
        id: "slack",
        label: "Slack",
        running: !!e?.isSlackBotRunning,
        status: Pt(!!e?.isSlackBotRunning, t),
        agent: String(e?.slackBotConfig?.llm_model || "openxnet-model"),
        memory: `${Number(e?.slackBotConfig?.memory_limit || 30)} ${t ? "轮记忆" : "turns"}`,
        note: yt(!!e?.slackBotConfig?.enable_tts, t)
      }
    ],
    liveChannels: [
      {
        id: "bilibili",
        label: "Bilibili",
        enabled: !!e?.liveConfig?.bilibili_enabled,
        status: yt(!!e?.liveConfig?.bilibili_enabled, t),
        note: String(e?.liveConfig?.bilibili_room_id || (t ? "未填写房间号" : "No room id"))
      },
      {
        id: "youtube",
        label: "YouTube",
        enabled: !!e?.liveConfig?.youtube_enabled,
        status: yt(!!e?.liveConfig?.youtube_enabled, t),
        note: String(e?.liveConfig?.youtube_vedio_id || (t ? "未填写视频 ID" : "No video id"))
      },
      {
        id: "twitch",
        label: "Twitch",
        enabled: !!e?.liveConfig?.twitch_enabled,
        status: yt(!!e?.liveConfig?.twitch_enabled, t),
        note: String(e?.liveConfig?.twitch_channel || (t ? "未填写频道" : "No channel"))
      }
    ],
    liveStrategy: {
      runtime: Pt(!!e?.isLiveRunning, t, "直播中", "Live"),
      danmakuOnly: Uu(!!e?.liveConfig?.onlyDanmaku),
      queueLimit: Number(e?.liveConfig?.danmakuQueueLimit || 5),
      wakeWord: String(e?.liveConfig?.wakeWord || (t ? "未设置唤醒词" : "No wake word")),
      obsUrl: `${String(e?.partyURL || "").replace(/\/$/, "")}/vrm.html?mode=render`
    },
    readBot: {
      runtime: Pt(!!e?.isReadRunning, t, "朗读中", "Reading"),
      selectedFile: (() => {
        const i = z(e?.textFiles).find((p) => String(p?.unique_filename || "") === String(e?.selectedFile || ""));
        return String(i?.original_filename || i?.unique_filename || (t ? "未选择文件" : "No file selected"));
      })(),
      segments: z(e?.readConfig?.longTextList).length,
      preview: Qt(e?.readConfig?.longText || (t ? "当前还没有载入朗读内容。" : "No reading content is loaded yet."), 140),
      audioState: e?.readState?.isPlaying ? t ? "播放中" : "Playing" : t ? "待播放" : "Idle"
    },
    translateBot: {
      runtime: String(e?.targetLangSelected || (t ? "系统默认" : "system")),
      sourceLength: String(e?.sourceText || "").length,
      targetLength: String(e?.translatedText || "").length,
      busy: !!e?.isTranslating,
      sourcePreview: Qt(e?.sourceText || (t ? "还没有待翻译内容。" : "No source text yet."), 180),
      resultPreview: Qt(e?.translatedText || (t ? "翻译结果会显示在这里。" : "Translated output will appear here."), 180)
    },
    generalConfig: {
      mediaHostEnabled: yt(!!e?.BotConfig?.imgHost_enabled, t),
      mediaHost: String(e?.BotConfig?.imgHost || "smms"),
      easyImage: String(e?.BotConfig?.EI2_base_url || (t ? "未配置 EasyImage2 地址" : "No EasyImage2 URL")),
      githubRepo: [e?.BotConfig?.github_repo_owner, e?.BotConfig?.github_repo_name].filter(Boolean).join("/") || (t ? "未配置 GitHub 仓库" : "No GitHub repository"),
      giteeRepo: [e?.BotConfig?.gitee_repo_owner, e?.BotConfig?.gitee_repo_name].filter(Boolean).join("/") || (t ? "未配置 Gitee 仓库" : "No Gitee repository")
    }
  };
}
function Hu(e, t) {
  const n = z(e?.apiTiles).map(($) => ({
    id: String($?.id || ""),
    icon: String($?.icon || "fa-solid fa-circle"),
    label: Ol(e, $, t)
  })), a = String(e?.subMenu || "develop"), o = e?.getPrototypeApiDetailMeta?.(a) || {
    title: t ? "开发者工作台" : "Developer Workbench",
    summary: t ? "统一查看 API 接入、开发流与本地工作区状态。" : "Review API routes, workflows, and local workspace status in one place.",
    chips: []
  }, i = z(e?.devWorkbenchOverview?.configuration_readiness?.items).map(($) => ({
    id: String($?.id || $?.label || ""),
    label: e?.formatDevReadinessLabel?.($?.id) || String($?.label || ""),
    status: e?.formatDevReadinessStatus?.($?.status) || String($?.status || ""),
    note: String($?.note || $?.summary || "")
  })), p = z(e?.devWorkbenchOverview?.recent_dev_tasks || e?.recent_dev_tasks || []).map(($) => ({
    id: String($?.task_id || $?.id || ""),
    title: String($?.title || $?.goal || (t ? "未命名开发任务" : "Untitled developer task")),
    status: String($?.status || ""),
    workflow: e?.formatDevWorkflowKind?.($?.workflow_kind) || String($?.workflow_kind || ""),
    updatedAt: gs($?.updated_at || $?.created_at || $?.timestamp || "")
  })), f = e?.devWorkbenchOverview || {}, g = f.runtime_profile || {}, m = f.configuration_assistant || {}, h = m.provider_setup || {}, R = m.gateway_provider_setup || {}, b = m.mapping_setup || {}, A = m.workspace_setup || {}, B = f.task_stats || {}, J = f.capability_summary || {}, G = f.workflow_support || {};
  return {
    title: t ? "开发者 · 工作台" : "Developer Workbench",
    subtitle: t ? "API 接口、智能体管理与开发者工具" : "API routes, agent management, and developer tools",
    tabs: n,
    activeTab: a,
    meta: o,
    stats: Xs(e?.getPrototypeApiDetailStats?.(a)),
    topStats: [
      {
        label: t ? "运行 Profile" : "Runtime Profile",
        value: String(g.profile || "desktop"),
        note: String(g.app_name || "OpenXnet"),
        emphasis: !0
      },
      {
        label: t ? "接入就绪度" : "Readiness",
        value: String(f.configuration_readiness?.overall_status || (t ? "未检查" : "unchecked")),
        note: String(f.configuration_readiness?.next_step || (t ? "检查 provider / 工作区状态" : "Check provider and workspace state"))
      },
      {
        label: t ? "开发任务" : "Developer Tasks",
        value: String(B.developer || 0),
        note: `${B.running || 0} ${t ? "个运行中" : "running"} · ${B.resumable || 0} ${t ? "个可恢复" : "resumable"}`
      },
      {
        label: t ? "插件与模板" : "Plugins & Templates",
        value: String(f.plugin_count || 0),
        note: `${z(f.templates).length} ${t ? "个模板" : "templates"}`
      }
    ],
    readiness: i,
    warnings: z(e?.devWorkbenchOverview?.warnings),
    templates: z(e?.devWorkbenchOverview?.templates).map(($) => ({
      id: String($?.id || ""),
      title: String($?.label || $?.title || $?.id || ""),
      summary: String($?.summary || ""),
      suggestedGoal: String($?.suggested_goal || "")
    })),
    recentTasks: p,
    providerCard: {
      status: String(h.status || ""),
      message: String(h.message || ""),
      vendor: String(e?.devWorkbenchProviderDraft?.vendor || h.current_vendor || ""),
      url: String(e?.devWorkbenchProviderDraft?.url || h.current_base_url || ""),
      model: String(e?.devWorkbenchProviderDraft?.model_id || h.current_model || ""),
      providerCount: z(h.provider_options).length,
      apiKeyConfigured: !!h.api_key_configured,
      validationStatus: String(e?.devWorkbenchProviderValidation?.status || ""),
      validationMessage: String(e?.devWorkbenchProviderValidation?.message || "")
    },
    gatewayCard: {
      enabled: !!R.enabled,
      reachable: !!R.reachable,
      status: String(R.status || ""),
      message: String(R.message || ""),
      vendor: String(e?.devWorkbenchGatewayProviderDraft?.vendor || R.current_vendor || ""),
      url: String(e?.devWorkbenchGatewayProviderDraft?.url || R.current_base_url || ""),
      model: String(e?.devWorkbenchGatewayProviderDraft?.model_id || R.current_model || ""),
      providerCount: z(R.provider_options).length,
      apiKeyConfigured: !!R.api_key_configured,
      managementUrl: String(R.management_url || "")
    },
    mappingCard: {
      status: String(b.status || ""),
      message: String(b.message || ""),
      agent: String(e?.devWorkbenchMappingDraft?.agent_id || b.current_main_agent || ""),
      resolvedModel: String(b.resolved_model || ""),
      currentModel: String(b.current_model || ""),
      resolutionSource: String(b.resolution_source || ""),
      providerModelCount: z(b.provider_models).length,
      agentCount: z(b.agent_options).length
    },
    workspaceCard: {
      status: String(A.status || ""),
      message: String(A.message || ""),
      path: String(e?.devWorkbenchWorkspaceDraft?.workspace_dir || A.workspace_dir || A.recommended_workspace_dir || ""),
      exists: !!A.workspace_exists,
      engine: String(e?.devWorkbenchWorkspaceDraft?.engine || A.engine || "local"),
      permissionMode: String(e?.devWorkbenchWorkspaceDraft?.permission_mode || A.permission_mode || "default"),
      visibilityScope: String(e?.devWorkbenchWorkspaceDraft?.visibility_scope || A.visibility_scope || "workspace"),
      recommendedReason: String(A.recommended_reason || "")
    },
    capabilitySummary: Object.entries(J).map(([$, Q]) => ({
      id: $,
      label: e?.formatDevCapabilityLabel?.($) || $,
      enabled: !!Q
    })),
    workflowSupport: Object.entries(G).filter(([$]) => !["write_enabled", "collaboration"].includes($)).map(([$, Q]) => ({
      id: $,
      label: e?.formatDevWorkflowKind?.($) || $,
      enabled: !!Q
    }))
  };
}
const zu = [
  { id: "usage", icon: "fa-solid fa-chart-line" },
  { id: "neuro", icon: "fa-solid fa-brain" },
  { id: "kg", icon: "fa-solid fa-diagram-project" },
  { id: "dataops", icon: "fa-solid fa-database" },
  { id: "mlops", icon: "fa-solid fa-flask-vial" },
  { id: "aiops", icon: "fa-solid fa-server" },
  { id: "enterprise-kb", icon: "fa-solid fa-book-open" },
  { id: "staff-roles", icon: "fa-solid fa-id-badge" },
  { id: "enterprise-workspaces", icon: "fa-solid fa-building" },
  { id: "enterprise-sandbox", icon: "fa-solid fa-cube" }
];
function Yu(e, t) {
  const n = String(e?.enterpriseTab || "usage"), a = zu.map((k) => ({
    ...k,
    label: e?.getPrototypeEnterpriseTitle?.(k.id) || k.id
  })), o = e?.usageData?.summary || {}, i = z(e?.usageData?.trend).slice().reverse().slice(0, 8).map((k, H) => ({
    id: `${k?.period || "trend"}-${H}`,
    label: String(k?.period || "").slice(-5) || `#${H + 1}`,
    value: Number(k?.total_tokens || 0)
  })), p = z(e?.usageData?.models).slice(0, 6).map((k, H) => ({
    id: `${k?.model || "model"}-${H}`,
    name: k?.model || t ? "未命名模型" : "Unnamed model",
    requests: Number(k?.requests || 0),
    tokens: Number(k?.total_tokens || 0),
    cost: Number(k?.cost || 0)
  })), f = z(e?.usageData?.users).slice(0, 6).map((k, H) => ({
    id: `${k?.user_id || "user"}-${H}`,
    name: k?.user_id || t ? "未命名用户" : "Unknown user",
    requests: Number(k?.requests || 0),
    tokens: Number(k?.total_tokens || 0),
    latency: Math.round(Number(k?.avg_duration_ms || 0))
  })), g = e?.neuroData?.stats || {}, m = z(e?.neuroData?.symbols).slice(0, 8).map((k, H) => ({
    id: String(k?.id || `symbol-${H}`),
    operator: String(k?.operator || "-"),
    label: k?.label || t ? "未命名符号" : "Unnamed symbol",
    entities: z(k?.K?.entities).slice(0, 4),
    successRate: Number(k?.successRate || 0),
    activations: Number(k?.activationCount || 0)
  })), h = z(e?.neuroData?.rules).slice(0, 6).map((k, H) => ({
    id: String(k?.id || `rule-${H}`),
    name: k?.name || t ? "未命名规则" : "Unnamed rule",
    domain: String(k?.domain || "-"),
    enabled: !!k?.enabled,
    description: String(k?.description || "")
  })), R = e?.kgData?.stats || {}, b = z(e?.kgData?.entityFacts).slice(0, 8).map((k, H) => ({
    id: `fact-${H}`,
    subject: String(k?.subject || k?.source || "-"),
    predicate: String(k?.predicate || k?.label || "-"),
    object: String(k?.object || k?.target || "-")
  })), A = z(e?.enterpriseKBs).map((k, H) => ({
    id: String(k?.id || `kb-${H}`),
    name: String(k?.name || (t ? "未命名知识库" : "Unnamed KB")),
    category: String(k?.category || (t ? "未分类" : "Uncategorized")),
    docs: Number(k?.doc_count || 0),
    description: String(k?.description || ""),
    updatedAt: gs(k?.updated_at || k?.created_at || "")
  })), B = z(e?.enterpriseRoleCards || e?.staffRoles), J = B.map((k, H) => ({
    id: String(k?.id || `role-${H}`),
    name: String(k?.name || (t ? "未命名角色" : "Unnamed role")),
    department: String(k?.department || (t ? "未分配部门" : "Unassigned")),
    workspaceId: String(k?.assignedWorkspace || ""),
    workspace: e?.getEnterpriseWorkspaceNameById?.(k?.assignedWorkspace) || String(k?.assignedWorkspace || ""),
    skills: z(k?.skills).slice(0, 6),
    summary: String(k?.summaryZh || k?.summaryEn || k?.description || k?.system_prompt || ""),
    icon: String(k?.icon || "fa-solid fa-user-tie"),
    enabled: k?.enabled !== !1,
    templateId: String(k?.templateId || ""),
    category: String(k?.category || ""),
    categoryLabel: String(
      t ? k?.categoryZh || k?.categoryEn || k?.category || "未分类" : k?.categoryEn || k?.categoryZh || k?.category || "Uncategorized"
    ),
    accent: z(k?.accent).slice(0, 2)
  })).sort((k, H) => k.enabled !== H.enabled ? k.enabled ? -1 : 1 : String(k.name || "").localeCompare(String(H.name || ""), "zh-Hans-CN")), G = Object.entries(e?.staffRoleTemplates || {}).map(([k, H]) => ({
    id: k,
    name: String(H?.name || k),
    department: String(H?.department || ""),
    summary: String(H?.summaryZh || H?.summaryEn || ""),
    skills: z(H?.skills).slice(0, 6),
    icon: String(H?.icon || "fa-solid fa-user-tie"),
    category: String(H?.category || ""),
    categoryLabel: String(
      t ? H?.categoryZh || H?.categoryEn || H?.category || "未分类" : H?.categoryEn || H?.categoryZh || H?.category || "Uncategorized"
    ),
    categoryZh: String(H?.categoryZh || ""),
    categoryEn: String(H?.categoryEn || ""),
    featured: !!H?.featured,
    priority: Number(H?.priority || 0),
    accent: z(H?.accent).slice(0, 2)
  })).sort((k, H) => k.featured !== H.featured ? k.featured ? -1 : 1 : Number(H.priority || 0) - Number(k.priority || 0)), $ = z(e?.enterpriseWorkspaces).map((k, H) => {
    const ve = String(k?.id || "");
    return {
      id: ve || `ws-${H}`,
      name: k?.name || t ? "未命名工作空间" : "Unnamed workspace",
      type: e?.getEnterpriseWorkspaceTypeLabel?.(k) || String(k?.type || "-"),
      permission: String(k?.permission || "default"),
      projectCount: z(e?.enterpriseProjects).filter((be) => String(be?.workspaceId || "") === ve).length,
      roleCount: z(e?.staffRoles || e?.enterpriseRoleCards).filter((be) => String(be?.assignedWorkspace || "") === ve).length,
      summary: e?.describeEnterpriseWorkspace?.(k) || String(k?.path || k?.host || "-"),
      path: String(k?.path || k?.host || "-"),
      updatedAt: gs(k?.updatedAt || k?.createdAt || "")
    };
  }), Q = String(e?.sandboxCurrentWs || ""), ae = String(e?.sandboxCurrentProject || ""), w = String(e?.selected3DAgent?.id || ""), _e = z(e?.enterpriseWorkspaces).find((k) => String(k?.id || "") === Q) || null, ye = z(e?.enterpriseProjects).find((k) => String(k?.id || "") === ae) || null, ne = z(e?.enterpriseProjects).filter((k) => !Q || String(k?.workspaceId || "") === Q).map((k, H) => ({
    id: String(k?.id || `project-${H}`),
    name: String(k?.name || (t ? "未命名项目" : "Untitled project")),
    workspaceId: String(k?.workspaceId || ""),
    workspace: e?.getEnterpriseWorkspaceNameById?.(k?.workspaceId) || "",
    color: String(k?.color || "#4ecdc4"),
    icon: String(k?.icon || "fa-solid fa-folder"),
    description: String(k?.description || ""),
    floor: Number(k?.floor || H + 1)
  })), Ce = new Map(
    B.map((k) => [String(k?.id || "").trim(), k])
  ), Z = z(e?.sandboxAgents).map((k, H) => {
    const ve = Ce.get(String(k?.id || "").trim()) || null;
    return {
      id: String(k?.id || `agent-${H}`),
      name: String(k?.name || k?.agent_name || ve?.name || (t ? "未命名智能体" : "Unnamed agent")),
      role: String(k?.role || k?.department || ve?.department || "-"),
      department: String(k?.department || k?.role || ve?.department || "-"),
      status: String(k?.status || (t ? "未知" : "unknown")),
      workspaceId: String(k?.workspaceId || ve?.assignedWorkspace || ""),
      workspace: String(k?.workspace_name || e?.getEnterpriseWorkspaceNameById?.(k?.workspaceId || ve?.assignedWorkspace) || k?.workspaceId || ve?.assignedWorkspace || ""),
      projectId: String(k?.projectId || ve?.projectId || ""),
      project: String(k?.project_name || k?.projectId || ve?.projectId || ""),
      icon: String(k?.icon || ve?.icon || "fa-solid fa-user-tie"),
      skills: z(k?.skills || ve?.skills).slice(0, 6),
      summary: String(k?.summary || ve?.summaryZh || ve?.summaryEn || ve?.description || ve?.system_prompt || ""),
      enabled: ve?.enabled !== !1
    };
  }).filter((k) => ae ? String(k?.projectId || "") === ae : Q ? String(k?.workspaceId || "") === Q : !0), Me = [];
  Me.push({
    id: "root",
    level: 0,
    label: t ? "企业园区" : "Enterprise Campus"
  }), _e && Me.push({
    id: _e.id,
    level: 1,
    label: _e.name
  }), ye && Me.push({
    id: ye.id,
    level: 2,
    label: ye.name
  });
  const ie = ["dataops", "mlops", "aiops"].map((k) => {
    const H = e?.xnetServices?.[k] || {};
    return {
      id: k,
      title: String(H?.name || k),
      status: String(H?.status || "offline"),
      url: String(H?.url || ""),
      autoConnect: !!H?.auto_connect,
      lastCheck: gs(H?.last_check || "")
    };
  });
  return {
    title: t ? "企业空间" : "Enterprise Space",
    subtitle: t ? "统一沉淀企业知识、角色、工作区与运营指标" : "Unify enterprise knowledge, roles, workspaces, and operating signals",
    tabs: a,
    activeTab: n,
    meta: e?.getPrototypeEnterpriseDetailMeta?.(n) || { title: "", summary: "", chips: [] },
    stats: Xs(e?.getPrototypeEnterpriseDetailStats?.(n)),
    topStats: [
      {
        title: t ? "总请求量" : "Requests",
        value: String(o.total_requests || 0),
        note: t ? "当前企业视图累计请求" : "Total requests inside the enterprise view"
      },
      {
        title: t ? "知识库文档" : "KB Docs",
        value: String(e?.enterpriseKBTotalDocs || 0),
        note: `${z(e?.enterpriseKBs).length} ${t ? "个知识库" : "knowledge bases"}`
      },
      {
        title: t ? "角色卡" : "Role Cards",
        value: String(B.length),
        note: `${z(e?.enterpriseWorkspaces).length} ${t ? "个工作空间" : "workspaces"}`
      },
      {
        title: t ? "沙盘智能体" : "Sandbox Agents",
        value: String(z(e?.sandboxAgents).length),
        note: `${z(e?.enterpriseSkills).length} ${t ? "个企业技能" : "enterprise skills"}`
      }
    ],
    overviewCards: [
      {
        title: t ? "知识库" : "Knowledge Bases",
        value: String(z(e?.enterpriseKBs).length),
        note: t ? "企业级共享知识与文档空间" : "Shared enterprise knowledge and docs"
      },
      {
        title: t ? "员工角色卡" : "Staff Roles",
        value: String(B.length),
        note: t ? "沉淀可复用的企业 AI 岗位能力" : "Reusable enterprise AI role templates"
      },
      {
        title: t ? "工作空间" : "Workspaces",
        value: String(z(e?.enterpriseWorkspaces).length),
        note: t ? "按项目或团队隔离资源边界" : "Project or team level resource boundaries"
      },
      {
        title: t ? "沙盘智能体" : "Sandbox Agents",
        value: String(z(e?.sandboxAgents).length),
        note: t ? "试运行、演练与隔离实验空间" : "Dry runs, drills, and isolated experiments"
      }
    ],
    usagePanel: {
      metrics: [
        { label: t ? "请求" : "Requests", value: String(o.total_requests || 0) },
        { label: t ? "总 Tokens" : "Tokens", value: String(e?.formatNumber?.(o.total_tokens || 0) || o.total_tokens || 0) },
        { label: t ? "输入" : "Input", value: String(e?.formatNumber?.(o.total_input || 0) || o.total_input || 0) },
        { label: t ? "输出" : "Output", value: String(e?.formatNumber?.(o.total_output || 0) || o.total_output || 0) },
        { label: t ? "缓存命中" : "Cache Hit", value: String(e?.formatNumber?.(o.total_cache_read || 0) || o.total_cache_read || 0) },
        { label: t ? "总成本" : "Cost", value: `$${Number(o.total_cost || 0).toFixed(4)}` }
      ],
      trend: i,
      models: p,
      users: f
    },
    neuroPanel: {
      metrics: [
        { label: t ? "符号总数" : "Symbols", value: String(g.totalSymbols || e?.neuroData?.total || 0) },
        { label: t ? "实体数" : "Entities", value: String(g.uniqueEntities || 0) },
        { label: t ? "平均成功率" : "Success Rate", value: `${(Number(g.avgSuccessRate || 0) * 100).toFixed(1)}%` },
        { label: t ? "运算符类型" : "Operators", value: String(Object.keys(g.operatorDistribution || {}).length) }
      ],
      symbols: m,
      rules: h
    },
    kgPanel: {
      metrics: [
        { label: t ? "实体" : "Entities", value: String(R.entities || z(e?.kgData?.graph?.nodes).length || 0) },
        { label: t ? "三元组" : "Triples", value: String(R.triples || 0) },
        { label: t ? "节点" : "Nodes", value: String(z(e?.kgData?.graph?.nodes).length || 0) },
        { label: t ? "边" : "Edges", value: String(z(e?.kgData?.graph?.edges).length || 0) }
      ],
      facts: b
    },
    knowledgePanel: {
      totalDocs: Number(e?.enterpriseKBTotalDocs || 0),
      totalCount: A.length,
      items: A
    },
    rolePanel: {
      templateCount: G.length,
      createdCount: J.length,
      enabledCount: J.filter((k) => k.enabled).length,
      items: J,
      templates: G
    },
    workspacePanel: {
      totalCount: $.length,
      items: $
    },
    sandboxPanel: {
      level: Number(e?.sandboxLevel || 0),
      levelLabel: Number(e?.sandboxLevel || 0) === 0 ? t ? "企业园区" : "Enterprise Campus" : Number(e?.sandboxLevel || 0) === 1 ? t ? "工作空间层" : "Workspace Layer" : t ? "项目楼层" : "Project Floor",
      currentWorkspaceId: Q,
      currentWorkspace: String(_e?.name || Q || ""),
      currentProjectId: ae,
      currentProject: String(ye?.name || ae || ""),
      selectedAgentId: w,
      breadcrumb: Me,
      workspaceCount: $.length,
      projectCount: ne.length,
      roleCount: Z.length,
      workspaces: $.slice(0, 8),
      projects: ne.slice(0, 8),
      items: Z
    },
    xnetPanel: {
      items: ie
    }
  };
}
function Kt() {
  const e = mt();
  if (!e || [
    "recoverSynapxnetMemories",
    "getSynapxnetMemoryStatus",
    "listSynapxnetMemories",
    "getSynapxnetMemoryHistory",
    "createSynapxnetMemory",
    "editSynapxnetMemory",
    "rollbackSynapxnetMemory",
    "retireSynapxnetMemory",
    "exportSynapxnetMemories",
    "importSynapxnetMemories",
    "verifySynapxnetMemory"
  ].some((n) => typeof e[n] != "function"))
    throw new Error("SynapXnet Memory runtime is unavailable.");
  return e;
}
async function No(e = !1) {
  const t = mt();
  return typeof t?.discoverApplicationOllama != "function" ? (Ne.attempted = !0, Ne.status = null, null) : Ne.request ? Ne.request : !e && Ne.attempted && Ne.status ? Ne.status : (Ne.loading = !0, Ne.error = "", Ne.request = t.discoverApplicationOllama({}).then((n) => (Ne.status = n && typeof n == "object" ? n : null, Ne.status)).catch((n) => (Ne.status = null, Ne.error = String(n?.message || "Ollama discovery failed."), null)).finally(() => {
    Ne.attempted = !0, Ne.loading = !1, Ne.request = null;
  }), Ne.request);
}
function jo(e, t) {
  const n = e?.agents && typeof e.agents == "object" ? e.agents : {}, a = z(e?.enterpriseRoleCards || e?.staffRoles), o = [
    {
      id: String(e?.mainAgent || "openxnet-model"),
      name: t ? "当前主智能体" : "Current main agent"
    },
    ...Object.entries(n).map(([p, f]) => ({
      id: String(p),
      name: String(f?.name || p)
    })),
    ...a.map((p) => ({
      id: String(p?.id || ""),
      name: String(p?.name || p?.displayName || p?.id || "")
    }))
  ], i = /* @__PURE__ */ new Set();
  return o.filter((p) => p.id && !i.has(p.id) && i.add(p.id));
}
async function Wo(e) {
  const t = String(e || "").trim();
  if (!t)
    return ue.selectedMemoryId = "", ue.selectedMemory = null, ue.history = [], null;
  const a = await Kt().getSynapxnetMemoryHistory({
    memoryId: t,
    requesterAgent: ue.actorAgent
  }), o = Array.isArray(a?.versions) ? a.versions : [], i = [...o].sort((p, f) => Number(f?.version || 0) - Number(p?.version || 0))[0] || null;
  return ue.selectedMemoryId = t, ue.selectedMemory = i, ue.history = o, i;
}
async function qt(e = {}) {
  const t = fe(), n = Kt(), a = jo(t, Qs(t));
  ue.actorAgent = String(
    e.actorAgent || ue.actorAgent || a[0]?.id || "openxnet-model"
  ).trim(), ue.query = String(e.query ?? ue.query ?? "").trim(), ue.includeRetired = e.includeRetired === void 0 ? ue.includeRetired : !!e.includeRetired, ue.loading = !0, ue.error = "";
  try {
    Ne.attempted || No(), ue.recoveryAttempted || (ue.recovery = await n.recoverSynapxnetMemories({
      actorAgent: ue.actorAgent
    }), ue.recoveryAttempted = !0, ue.recovery?.integrity && (ue.integrity = ue.recovery.integrity));
    const [o, i] = await Promise.all([
      n.getSynapxnetMemoryStatus(),
      n.listSynapxnetMemories({
        requesterAgent: ue.actorAgent,
        query: ue.query,
        ownerAgent: "",
        includeRetired: ue.includeRetired,
        limit: 500
      })
    ]);
    ue.status = o, ue.items = Array.isArray(i?.items) ? i.items : [];
    const p = ue.items.some((f) => f.memoryId === ue.selectedMemoryId) ? ue.selectedMemoryId : String(ue.items[0]?.memoryId || "");
    return await Wo(p), i;
  } catch (o) {
    throw ue.error = String(o?.message || "SynapXnet Memory runtime is unavailable."), o;
  } finally {
    ue.loading = !1;
  }
}
async function Gu(e) {
  return ue.error = "", Wo(e);
}
async function Qu(e = {}) {
  const t = Kt(), n = ue.actorAgent || "openxnet-model", a = await t.createSynapxnetMemory({
    ownerAgent: n,
    actorAgent: n,
    taskId: String(e.taskId || "").trim(),
    title: String(e.title || "").trim(),
    content: String(e.content || "").trim(),
    qualityScore: Number(e.qualityScore ?? 0.8),
    permissions: Array.isArray(e.permissions) ? e.permissions : [],
    tags: Array.isArray(e.tags) ? e.tags : [],
    source: "user-created"
  });
  return ue.selectedMemoryId = a.memoryId, await qt(), a;
}
async function Xu(e = {}) {
  const n = await Kt().editSynapxnetMemory({
    memoryId: String(e.memoryId || "").trim(),
    baseVersion: Number(e.baseVersion || 0),
    actorAgent: ue.actorAgent || "openxnet-model",
    title: String(e.title || "").trim(),
    content: String(e.content || "").trim(),
    qualityScore: Number(e.qualityScore ?? 0.8),
    permissions: Array.isArray(e.permissions) ? e.permissions : [],
    tags: Array.isArray(e.tags) ? e.tags : [],
    reason: String(e.reason || "").trim()
  });
  return ue.selectedMemoryId = n.memoryId, await qt(), n;
}
async function Ju(e, t, n = "") {
  const o = await Kt().rollbackSynapxnetMemory({
    memoryId: String(e || "").trim(),
    targetVersion: Number(t || 0),
    actorAgent: ue.actorAgent || "openxnet-model",
    reason: String(n || "").trim()
  });
  return ue.selectedMemoryId = o.memoryId, await qt(), o;
}
async function Zu(e) {
  const n = await Kt().retireSynapxnetMemory({
    memoryId: String(e || "").trim(),
    actorAgent: ue.actorAgent || "openxnet-model"
  });
  return ue.selectedMemoryId = n.memoryId, await qt(), n;
}
async function ec(e = []) {
  return Kt().exportSynapxnetMemories({
    requesterAgent: ue.actorAgent || "openxnet-model",
    memoryIds: [...e]
  });
}
async function tc(e) {
  const t = ue.actorAgent || "openxnet-model", n = await Kt().importSynapxnetMemories({
    actorAgent: t,
    targetOwnerAgent: t,
    document: e
  });
  return await qt(), n;
}
async function sc(e = "") {
  const t = await Kt().verifySynapxnetMemory({
    requesterAgent: ue.actorAgent || "openxnet-model",
    memoryId: String(e || "").trim()
  });
  return ue.integrity = t, t;
}
function nc(e, t) {
  const n = jo(e, t);
  return ue.actorAgent || (ue.actorAgent = n[0]?.id || "openxnet-model"), {
    available: !!mt()?.listSynapxnetMemories,
    ...ue,
    items: [...ue.items],
    history: [...ue.history],
    agentOptions: n,
    ollama: {
      status: Ne.status ? { ...Ne.status } : null,
      loading: Ne.loading,
      error: Ne.error,
      attempted: Ne.attempted
    }
  };
}
const hn = {
  text: ["doc", "docx", "ppt", "pptx", "xls", "xlsx", "pdf", "pages", "numbers", "key", "rtf", "odt", "epub", "js", "ts", "py", "java", "c", "cpp", "h", "hpp", "go", "rs", "swift", "kt", "dart", "rb", "php", "html", "css", "scss", "less", "vue", "svelte", "jsx", "tsx", "json", "xml", "yml", "yaml", "sql", "sh", "csv", "tsv", "txt", "md", "log", "conf", "ini", "env", "toml"],
  image: ["png", "jpg", "jpeg", "gif", "webp", "bmp"]
}, dl = Object.freeze({
  text: { list: "textFiles", remove: "deleteFile", batch: "batchDeleteFiles", selected: "selectedFiles" },
  image: { list: "imageFiles", remove: "deleteImage", batch: "batchDeleteImages", selected: "selectedImages" },
  video: { list: "videoFiles", remove: "deleteVideo", batch: "batchDeleteVideos", selected: "selectedVideos" }
});
function We(e, t) {
  const n = fe();
  return new Error(!n || Qs(n) ? e : t);
}
function In(e, t = []) {
  const n = fe();
  if (!n) throw We("文件库尚未连接，请重新打开页面。", "The file library is not connected. Reopen the page.");
  if (!Object.hasOwn(dl, e)) throw We("文件库类型无效。", "Invalid file library kind.");
  if (!Array.isArray(t) || t.some((i) => typeof i != "string" || !i.trim() || /[/\\\u0000-\u001f]/.test(i) || i === "." || i === ".."))
    throw We("文件标识无效，请刷新文件库后重试。", "Invalid file identifier. Refresh the library and retry.");
  const a = dl[e], o = t.map((i) => {
    const p = z(n[a.list]).filter((f) => f?.unique_filename === i);
    if (p.length !== 1) throw We("所选文件已不存在或标识重复，请刷新后重试。", "A selected file is missing or its identifier is duplicated. Refresh and retry.");
    return p[0];
  });
  return { host: n, config: a, files: o };
}
function Bo(e, t) {
  if (!t || /[/\\\u0000-\u001f]/.test(t) || t === "." || t === "..") throw We("文件标识无效。", "Invalid file identifier.");
  const n = String(e?.partyURL || (typeof window < "u" ? window.location?.origin : "") || ""), a = new URL("uploaded_files/" + encodeURIComponent(t), n.replace(/\/+$/, "") + "/");
  if (!["http:", "https:"].includes(a.protocol) || a.username || a.password) throw We("文件服务地址无效。", "Invalid file service URL.");
  return a.href;
}
function Zn(e, t, n) {
  const a = z(e?.[dl[t].list]), o = /* @__PURE__ */ new Map();
  return a.forEach((i) => o.set(i?.unique_filename, (o.get(i?.unique_filename) || 0) + 1)), a.map((i) => {
    const p = typeof i?.unique_filename == "string" ? i.unique_filename : "", f = String(i?.original_filename || p || i?.name || (n ? "未命名文件" : "Untitled file"));
    let g = "", m = "";
    try {
      if (o.get(p) !== 1) throw new Error();
      g = Bo(e, p);
    } catch {
      m = n ? "文件标识或服务地址不可用，请刷新文件库。" : "File identifier or service URL is unavailable. Refresh the library.";
    }
    const h = String(e?.getPrototypeStorageFileExtension?.(i) || (f.includes(".") ? f.split(".").pop() : "")).toUpperCase();
    return {
      id: p,
      name: f,
      ext: h,
      url: g,
      invalidReason: m,
      size: String(e?.getPrototypeStorageFileDisplaySize?.(i) || (Number(i?.size || i?.file_size || i?.bytes) > 0 ? Number(i?.size || i?.file_size || i?.bytes).toLocaleString() + " B" : n ? "未知大小" : "Unknown size")),
      time: String(e?.getPrototypeStorageFileDisplayTime?.(i) || gs(i?.uploaded_at || i?.created_at || i?.timestamp) || "—")
    };
  });
}
function xs(e) {
  return e?.canceled === !0 || e?.cancelled === !0 || ["AbortError", "CancelError"].includes(e?.name) || ["ERR_CANCELED", "ERR_CANCELLED"].includes(e?.code) || /^Download (?:was )?cancel[l]?ed\.?$/i.test(String(e?.message || ""));
}
async function lc(e, t) {
  const { host: n, config: a } = In(e);
  if (!hn[e]) throw We("视频库当前接收工作流产生的视频，不支持手动上传。", "The video library currently receives workflow outputs and does not support manual uploads.");
  if (!Array.isArray(t)) throw We("请选择要上传的文件。", "Select files to upload.");
  if (!t.length) return { status: "cancelled" };
  if (typeof n.uploadStorageFiles != "function") throw We("当前环境无法上传文件。", "File upload is unavailable in this environment.");
  if (t.some((p) => !(p instanceof Blob) || typeof p.name != "string" || !hn[e].includes(p.name.split(".").pop().toLowerCase())))
    throw We("所选文件包含不支持的格式，请使用当前文件库允许的格式。", "The selection contains unsupported formats. Use formats allowed by this library.");
  const o = JSON.stringify(z(n[a.list]));
  let i;
  try {
    i = await n.uploadStorageFiles(e === "image" ? "image" : "file", t);
  } catch (p) {
    if (xs(p)) return { status: "cancelled" };
    throw p;
  }
  if (xs(i)) return { status: "cancelled" };
  if (i === !1 || i?.ok === !1 || i?.success === !1 || JSON.stringify(z(n[a.list])) === o)
    throw We("未确认文件导入完成，请检查上传提示后重试。", "The file import could not be confirmed. Check the upload message and retry.");
  return { status: "completed" };
}
async function ac() {
  const { host: e } = In("text");
  if (e.isElectron) {
    if (typeof e.loadApplicationArtifacts != "function") throw We("当前环境无法读取文件库。", "The file library cannot be loaded in this environment.");
    const t = await e.loadApplicationArtifacts();
    if (!t || t.ok === !1) throw We("文件库刷新失败，请重试。", "The file library could not be refreshed. Retry.");
  } else {
    const t = await fetch("/update_storage", { method: "GET" });
    if (!t.ok) throw We(`文件库刷新失败（${t.status}）。`, `File library refresh failed (${t.status}).`);
    const n = await t.json();
    if (!n || !["textFiles", "imageFiles", "videoFiles"].every((a) => Array.isArray(n[a]))) throw We("文件库返回的数据无效。", "The file library returned invalid data.");
    e.textFiles = n.textFiles, e.imageFiles = n.imageFiles, e.videoFiles = n.videoFiles;
  }
  return { status: "completed" };
}
async function oc(e, t) {
  if (!Array.isArray(t) || !t.length || new Set(t).size !== t.length) throw We("请选择有效且不重复的文件。", "Select valid files without duplicate identifiers.");
  const { host: n, config: a, files: o } = In(e, t), i = t.length === 1 ? a.remove : a.batch;
  if (typeof n[i] != "function") throw We("当前环境无法删除所选文件。", "Deleting the selected files is unavailable.");
  const p = z(n[a.selected]).slice();
  t.length > 1 && (n[a.selected] = t.slice());
  try {
    const f = await n[i](...t.length === 1 ? [o[0]] : []);
    if (xs(f)) return { status: "cancelled" };
    const g = new Set(z(n[a.list]).map((m) => m?.unique_filename));
    if (f === !1 || f?.ok === !1 || f?.success === !1 || t.some((m) => g.has(m)))
      throw We("部分文件未能删除，请刷新后重试。", "Some files could not be deleted. Refresh and retry.");
    return { status: "completed" };
  } catch (f) {
    if (xs(f)) return { status: "cancelled" };
    throw f;
  } finally {
    const f = new Set(z(n[a.list]).map((g) => g?.unique_filename));
    n[a.selected] = p.filter((g) => f.has(g));
  }
}
async function ic(e, t, n) {
  if (!["copy-link", "download", "preview"].includes(t)) throw We("文件操作无效。", "Invalid file action.");
  const { host: a, files: o } = In(e, [n]), i = o[0], p = Bo(a, n);
  if (t === "preview") {
    if (e !== "image" && e !== "video") throw We("此文件不支持媒体预览。", "This file does not support media preview.");
    return { status: "completed", url: p };
  }
  try {
    if (t === "copy-link") {
      if (typeof navigator > "u" || typeof navigator.clipboard?.writeText != "function") throw We("当前环境无法访问剪贴板。", "Clipboard access is unavailable.");
      await navigator.clipboard.writeText(p);
    } else if (a.isElectron) {
      if (typeof window.electronAPI?.downloadFile != "function") throw We("当前环境无法下载文件。", "File download is unavailable.");
      const f = await window.electronAPI.downloadFile({ url: p, filename: i.original_filename || n });
      if (xs(f)) return { status: "cancelled" };
      if (f?.success !== !0) throw We("下载未完成，请重试。", "The download did not complete. Retry.");
    } else {
      const f = await fetch(p);
      if (!f.ok) throw We(`文件下载失败（${f.status}）。`, `File download failed (${f.status}).`);
      const g = await f.blob(), m = URL.createObjectURL(g), h = document.createElement("a");
      return h.href = m, h.download = i.original_filename || n, document.body.appendChild(h), h.click(), h.remove(), setTimeout(() => URL.revokeObjectURL(m), 3e4), { status: "requested" };
    }
    return { status: "completed" };
  } catch (f) {
    if (xs(f)) return { status: "cancelled" };
    throw f;
  }
}
function rc(e, t) {
  const n = z(e?.storageTiles).map((m) => ({
    id: String(m?.id || ""),
    icon: String(m?.icon || "fa-solid fa-circle"),
    label: m?.id === "memory-v3" ? t ? "记忆与上下文" : "Memory & context" : Ol(e, m, t)
  }));
  n.some((m) => m.id === "memory-v3") || n.push({ id: "memory-v3", icon: "fa-solid fa-brain", label: t ? "记忆与上下文" : "Memory & context" });
  const a = String(e?.subMenu || "text"), o = Zn(e, "text", t), i = Zn(e, "image", t), p = Zn(e, "video", t), f = { text: o, image: i, video: p }, g = z(e?.recallResults).slice(0, 6).map((m, h) => ({
    id: String(m?.task_id || m?.id || `recall-${h}`),
    title: Qt(m?.title || m?.summary || m?.query || (t ? "续接任务" : "Recall item"), 56),
    note: Qt(m?.content || m?.description || m?.source || "", 80)
  }));
  return {
    title: a === "memory-v3" ? t ? "记忆与上下文" : "Memory & context" : t ? "存储管理" : "Storage Manager",
    subtitle: t ? "统一管理文本、图片、视频和续接素材" : "Manage text, images, videos, and recall assets together",
    tabs: n,
    activeTab: a,
    meta: a === "memory-v3" ? {
      title: "SynapXnet Memory V3",
      summary: t ? "从当前会话、项目协作，到可复用的原生记忆。" : "From current conversations and project collaboration to reusable native memory.",
      chips: []
    } : e?.getPrototypeStorageDetailMeta?.(a) || { title: "", summary: "", chips: [] },
    stats: a === "memory-v3" ? [
      { label: t ? "长期记忆" : "Memories", value: String(ue.status?.tiers?.longTerm?.memories || 0) },
      { label: t ? "版本" : "Versions", value: String(ue.status?.tiers?.longTerm?.versions || 0) },
      { label: t ? "共享版本" : "Shared", value: String(ue.status?.sharedVersions || 0) },
      { label: t ? "审计事件" : "Audit Events", value: String(ue.status?.auditEvents || 0) }
    ] : Xs(e?.getPrototypeStorageDetailStats?.(a)),
    overviewStats: z(e?.getPrototypeStorageOverviewStats?.()),
    textFiles: o,
    imageFiles: i,
    videoFiles: p,
    fileLibrary: {
      kind: a,
      files: f[a] || [],
      canUpload: Object.hasOwn(hn, a),
      uploadAccept: (hn[a] || []).map((m) => "." + m).join(",")
    },
    recallItems: g,
    memoryV3: nc(e, t)
  };
}
function uc(e, t) {
  const n = String(e?.kernelConsoleTab || "overview"), a = [
    { id: "overview", label: t ? "总览" : "Overview", icon: "fa-solid fa-gauge-high" },
    { id: "actions", label: t ? "队列" : "Queue", icon: "fa-solid fa-list-check" },
    { id: "plan", label: t ? "计划" : "Plan", icon: "fa-solid fa-diagram-project" },
    { id: "audit", label: t ? "审计" : "Audit", icon: "fa-solid fa-shield-halved" },
    { id: "traces", label: t ? "追踪" : "Traces", icon: "fa-solid fa-route" },
    { id: "world", label: t ? "世界状态" : "World", icon: "fa-solid fa-globe" }
  ];
  return {
    title: t ? "神经符号内核" : "Neural-Symbolic Kernel",
    subtitle: e?.getKernelConsoleRuntimeSubtitle?.() || "",
    tabs: a,
    activeTab: n,
    metrics: z(e?.getKernelConsoleMetrics?.()),
    runtimeRows: z(e?.getKernelConsoleRuntimeRows?.()),
    profileRows: z(e?.getKernelConsoleProfileRows?.()),
    boardItems: z(e?.getKernelConsoleBoardItems?.()),
    actions: z(e?.getKernelConsoleVisibleActions?.()).slice(0, 8).map((o) => ({
      id: String(o?.id || o?.task_id || o?.created_at || Math.random()),
      title: String(o?.title || o?.summary || o?.task || (t ? "内核动作" : "Kernel action")),
      type: e?.getKernelConsoleActionLabel?.(o?.type || o?.action_type || "") || String(o?.type || o?.action_type || ""),
      status: e?.getKernelConsoleActionStatusLabel?.(o) || String(o?.status || ""),
      next: e?.getKernelConsoleActionNextLabel?.(o) || ""
    })),
    updatedLabel: e?.getKernelConsoleUpdatedLabel?.() || ""
  };
}
function wa(e, t) {
  const n = e && typeof e == "object" ? e : {}, a = n.mode === "dark", o = (i, p) => /^#[\da-f]{6}$/i.test(String(i || "")) ? String(i) : p;
  return {
    id: String(n.id || ""),
    name: String(n.name || (t ? "OpenXnet 蓝青" : "OpenXnet Blue")),
    mode: a ? "dark" : "light",
    primary: o(n.primary, "#21859c"),
    background: o(n.background, a ? "#16232b" : "#f1f7fa"),
    surface: o(n.surface, a ? "#21333e" : "#ffffff"),
    text: o(n.text, a ? "#e5f0f4" : "#263f4a"),
    radius: Math.max(0, Math.min(32, Number.isFinite(Number(n.radius)) ? Number(n.radius) : 14)),
    density: n.density === "compact" ? "compact" : "comfortable",
    hasWallpaper: !!(n.hasWallpaper || n.wallpaper)
  };
}
function cc(e, t) {
  const n = z(e?.getPrototypeSystemTabs?.()).map((f) => ({
    id: String(f?.id || ""),
    icon: String(f?.icon || "fa-solid fa-circle"),
    label: String(f?.label || f?.id || "")
  }));
  n.some((f) => f.id === "feature-packs") || n.splice(Math.max(0, n.length - 1), 0, {
    id: "feature-packs",
    icon: "fa-solid fa-cubes",
    label: t ? "功能包" : "Feature Packs"
  });
  const a = String(e?.prototypeSystemTab || "general"), o = z(e?.themeOptions).length ? z(e?.themeOptions).map((f) => Jn(e, f)) : z(e?.themeValues).map((f) => ({
    value: String(f),
    label: typeof e?.getPrototypeThemeLabel == "function" ? e.getPrototypeThemeLabel(f) : Fo(e, `theme.${f}`, String(f))
  })), i = z(e?.networkOptions).map((f) => Jn(e, f)), p = z(e?.systemlanguageOptions).map((f) => Jn(e, f));
  return {
    title: t ? "系统设置" : "System Settings",
    subtitle: t ? "统一管理外观、网络、快捷键、更新内容与运行维护配置" : "Manage appearance, network, shortcuts, update content, and runtime maintenance settings",
    tabs: n,
    activeTab: a,
    stats: Xs(e?.getPrototypeSystemStats?.()),
    currentMeta: a === "feature-packs" ? {
      heading: t ? "功能包管理" : "Feature Pack Management",
      summary: t ? "按需安装独立运行时，并验证发布签名与文件完整性。" : "Install optional runtimes on demand with release signature and file integrity verification."
    } : e?.getPrototypeSystemTabMeta?.(a) || { heading: "", summary: "" },
    settings: {
      language: String(e?.systemSettings?.language || "auto"),
      theme: String(e?.systemSettings?.theme || "party"),
      network: String(e?.systemSettings?.network || "local"),
      timezone: String(e?.systemSettings?.timezone || "Asia/Shanghai"),
      dateFormat: String(e?.systemSettings?.dateFormat || "YYYY-MM-DD"),
      proxyMode: String(e?.systemSettings?.proxyMode || "system"),
      proxy: String(e?.systemSettings?.proxy || ""),
      launchAtStartup: !!e?.systemSettings?.launchAtStartup,
      startMinimized: !!e?.systemSettings?.startMinimized
    },
    targetLanguage: String(e?.targetLangSelected || "system"),
    languageOptions: p.length ? p : [
      { value: "auto", label: t ? "跟随系统" : "Auto" },
      { value: "zh-CN", label: "中文" },
      { value: "en-US", label: "English" }
    ],
    targetLanguageOptions: [
      { value: "system", label: t ? "跟随系统语言" : "System language" },
      { value: "简体中文", label: "简体中文" },
      { value: "繁體中文", label: "繁體中文" },
      { value: "English", label: "English" },
      { value: "Français", label: "Français" },
      { value: "Deutsch", label: "Deutsch" },
      { value: "Español", label: "Español" },
      { value: "Portuguese", label: "Portuguese" },
      { value: "日本語", label: "日本語" },
      { value: "한국어", label: "한국어" }
    ],
    timezoneOptions: [
      { value: "Asia/Shanghai", label: "Asia/Shanghai (UTC+8)" },
      { value: "UTC", label: "UTC" },
      { value: "America/Los_Angeles", label: "Los Angeles" },
      { value: "Europe/London", label: "London" }
    ],
    dateFormatOptions: [
      { value: "YYYY-MM-DD", label: "YYYY-MM-DD" },
      { value: "MM/DD/YYYY", label: "MM/DD/YYYY" },
      { value: "DD/MM/YYYY", label: "DD/MM/YYYY" }
    ],
    themeOptions: o,
    skinCurrent: wa(e?.getSkinCurrentSummary?.(), t),
    skinLibrary: z(e?.getSkinLibrary?.()).map((f) => wa(f, t)),
    skinStudioAvailable: typeof e?.openSkinStudio == "function",
    networkOptions: i.length ? i : [
      { value: "local", label: t ? "本机可见" : "Local only" },
      { value: "global", label: t ? "局域网可见" : "LAN visible" }
    ],
    proxyOptions: [
      { value: "system", label: t ? "系统代理" : "System proxy" },
      { value: "manual", label: t ? "手动代理" : "Manual proxy" },
      { value: "none", label: t ? "不使用代理" : "No proxy" }
    ],
    shortcutRows: z(e?.getPrototypeShortcutRows?.()),
    quickActions: [
      {
        id: "command-panel",
        icon: "fa-solid fa-terminal",
        label: t ? "命令面板" : "Command Panel",
        description: t ? "打开全局命令搜索面板。" : "Open the global command search panel."
      },
      {
        id: "desktop-control",
        icon: "fa-solid fa-window-restore",
        label: t ? "桌面控制台" : "Desktop Control",
        description: t ? "进入开发者工作台中的桌面控制能力。" : "Open desktop control inside the developer workbench."
      },
      {
        id: "dynamic-island",
        icon: "fa-solid fa-table-cells-large",
        label: t ? "动态岛" : "Dynamic Island",
        description: t ? "打开桌面动态岛浮层。" : "Open the desktop dynamic island surface."
      },
      {
        id: "floating-task-hud",
        icon: "fa-solid fa-list-check",
        label: t ? "任务 HUD" : "Task HUD",
        description: t ? "打开任务执行与跟踪浮层。" : "Open the task execution and tracking HUD."
      }
    ],
    isElectron: !!e?.isElectron,
    version: String(e?.updateCurrentVersion || e?.version || "1.0.0"),
    updateMessage: String(e?.updateMessage || ""),
    updateStatus: String(e?.updateStatus || "idle"),
    updateStatusTitle: String(e?.getUpdateStatusTitle?.() || ""),
    updateStatusDescription: String(e?.getUpdateStatusDescription?.() || ""),
    updateAvailable: !!e?.updateAvailable,
    updateEntries: z(e?.getPrototypeSystemUpdateEntries?.()),
    featurePacks: Bu(t)
  };
}
function dc(e, t) {
  const n = z(e?.getPrototypeTaskBoardColumns?.()).map((o) => ({
    id: String(o?.id || ""),
    title: String(o?.title || ""),
    emptyTitle: String(o?.emptyTitle || ""),
    emptyCopy: String(o?.emptyCopy || ""),
    tasks: z(o?.tasks).map((i) => ({
      raw: i,
      id: String(i?.task_id || i?.id || Math.random()),
      title: String(i?.title || i?.goal || (t ? "未命名任务" : "Untitled task")),
      summary: Qt(i?.description || i?.goal || i?.context?.goal || "", 96),
      status: String(i?.status || ""),
      updatedAt: gs(i?.updated_at || i?.created_at || i?.timestamp || ""),
      progress: Number.isFinite(Number(i?.progress)) ? Number(i.progress) : null,
      assignee: String(i?.agent_name || i?.owner || i?.agent_type || "")
    }))
  })), a = e?.viewingTaskDetail || null;
  return {
    title: t ? "任务中心" : "Task Center",
    subtitle: t ? "查看待处理、进行中和已完成任务，并继续推进关键工作" : "Track pending, running, and completed tasks and keep work moving",
    columns: n,
    detail: a ? {
      title: String(a?.title || a?.goal || (t ? "任务详情" : "Task Detail")),
      status: String(a?.status || ""),
      summary: Qt(a?.description || a?.goal || "", 160),
      trace: z(a?.recent_trace_excerpt || a?.execution_trace).slice(0, 6).map((o, i) => ({
        id: `${a?.task_id || "detail"}-${i}`,
        text: Qt(typeof o == "string" ? o : o?.message || o?.summary || JSON.stringify(o), 120)
      }))
    } : null
  };
}
function pc(e, t) {
  return {
    title: "OpenXnet",
    subtitle: t ? "神经符号系统、多智能体协作与企业空间的一体化工作台" : "A unified workspace for neural-symbolic systems, multi-agent collaboration, and enterprise operations",
    version: String(e?.updateCurrentVersion || e?.version || "1.0.0"),
    features: [
      {
        icon: "fa-solid fa-comments",
        title: t ? "实时协作" : "Live Collaboration",
        description: t ? "对话、工具调用与任务流保持在同一条工作轨道。" : "Keep conversations, tools, and tasks in one working lane."
      },
      {
        icon: "fa-solid fa-brain",
        title: t ? "神经符号内核" : "Neural-Symbolic Kernel",
        description: t ? "模型能力、规则约束、记忆和执行控制统一收束。" : "Unify model power, policy, memory, and execution control."
      },
      {
        icon: "fa-solid fa-building",
        title: t ? "企业空间" : "Enterprise Space",
        description: t ? "角色、知识、工作区和用量治理放到同一个控制面。" : "Roles, knowledge, workspaces, and usage share one control plane."
      },
      {
        icon: "fa-solid fa-globe",
        title: t ? "AI 浏览器" : "AI Browser",
        description: t ? "把网页理解、自动操作和会话分析连到一起。" : "Connect page understanding, automation, and chat analysis."
      }
    ],
    links: [
      { label: "Community", value: "developer.synapxnet.com", href: "https://developer.synapxnet.com/" },
      { label: "GitHub", value: "github.com/synapxnet/OpenXnet", href: "https://github.com/synapxnet/OpenXnet" },
      { label: t ? "联系邮箱" : "Contact", value: "synapxnet@gmail.com", href: "mailto:synapxnet@gmail.com" },
      { label: t ? "开源许可" : "License", value: "GNU AGPL v3.0", href: "https://www.gnu.org/licenses/agpl-3.0.html" }
    ],
    facts: [
      {
        label: t ? "版本说明" : "Version",
        value: t ? `当前关于页基于桌面端 v${String(e?.updateCurrentVersion || "1.0.0")} 的新菜单承接结构整理。` : `This about page is aligned to desktop build v${String(e?.updateCurrentVersion || "1.0.0")}.`
      },
      {
        label: t ? "产品愿景" : "Direction",
        value: t ? "不是堆叠孤立功能，而是围绕统一智能系统持续演进。" : "The direction is a unified intelligent system instead of isolated feature stacks."
      },
      {
        label: t ? "业务承载" : "Operations",
        value: t ? "登录、订阅、高级模型、企业空间与额度同步共同构成可持续发布基础。" : "Login, subscription, premium models, enterprise spaces, and quota sync form the operational base."
      }
    ]
  };
}
function fc(e, t) {
  const n = e?.VRMConfig || {}, a = (Z, Me, ie = {}) => ({
    id: String(Z?.id || ""),
    name: String(Z?.name || Z?.id || ""),
    path: String(Z?.path || ""),
    builtin: Me,
    cloud: !!Z?.cloud || String(Z?.source || "") === "cloud",
    source: String(Z?.source || (Me ? "packaged" : "user")),
    downloaded: Z?.downloaded !== !1,
    downloadable: !!Z?.downloadable,
    remoteUrl: String(Z?.remoteUrl || ""),
    relativePath: String(Z?.relativePath || ""),
    ...ie
  }), o = z(n.defaultModels).map((Z) => ({
    ...a(Z, !0, { downloaded: !0, downloadable: !1 })
  })), i = z(n.cloudModels).map((Z) => {
    const Me = !!Z?.downloaded;
    return a(Z, !1, {
      cloud: !0,
      downloaded: Me,
      downloadable: !Me,
      source: "cloud"
    });
  }), p = z(n.userModels).map((Z) => a(Z, !1)), f = [...o, ...p], g = String(
    (n.name && n.name !== "default" ? n.selectedNewModelId : n.selectedModelId) || n.selectedModelId || f[0]?.id || ""
  ), m = f.find((Z) => Z.id === g) || f[0] || null, h = z(n.defaultMotions).map((Z) => ({
    id: String(Z?.id || ""),
    name: String(Z?.name || Z?.id || ""),
    builtin: !0
  })), R = z(n.userMotions).map((Z) => ({
    id: String(Z?.id || ""),
    name: String(Z?.name || Z?.id || ""),
    builtin: !1
  })), b = [...h, ...R], A = new Set(z(n.selectedMotionIds).map((Z) => String(Z))), B = b.map((Z) => ({
    ...Z,
    selected: A.has(Z.id)
  })), J = String(e?.partyURL || "").replace(/\/$/, ""), G = new URLSearchParams({ mode: "embed" });
  g && G.set("model", g);
  const $ = Array.from(A).sort().join(",");
  $ && G.set("motions", $);
  const Q = [
    g || "none",
    $ || "no-motion",
    n.enabledExpressions ? "expr-on" : "expr-off",
    n.enabledMotions ? "motion-on" : "motion-off"
  ].join("|"), ae = J ? `${J}/vrm.html?${G.toString()}` : "", w = !!e?.isVRMRunning, _e = !!e?.isVRMStarting, ye = !!e?.isVRMStopping, ne = String(e?.mainAgent || "super-model"), Ce = e?.agents && typeof e.agents == "object" ? e.agents : {}, ke = [
    {
      id: "super-model",
      name: t ? "跟随当前主模型" : "Follow current main model"
    },
    ...Object.entries(Ce).map(([Z, Me]) => ({
      id: String(Z),
      name: String(Me?.name || Z)
    }))
  ];
  return {
    title: t ? "VRM 桌宠" : "VRM Pet",
    subtitle: t ? "配置 VRM 模型、动作与窗口表现，并预览桌宠形象。" : "Configure the VRM model, motion bindings, and window behavior, then preview the pet.",
    meta: {
      summary: t ? "VRM 桌宠从机器人部署里独立成菜单，左侧编排模型、动画与窗口，右侧实时预览模型与动作清单。" : "VRM Pet is now its own menu separate from bot deployment. Configure on the left, preview model and motions on the right.",
      guideNote: t ? "配置顺序：先确认回答你的主智能体，再选择桌宠模型和动作，最后预览或启动桌宠。" : "Setup order: choose the main agent first, then pick the pet model and motions, and finally preview or start the pet.",
      setupSteps: [
        {
          icon: "fa-regular fa-user",
          title: t ? "主智能体 / 角色卡" : "Main agent / role card",
          desc: t ? "决定人格、系统提示词和回复内容。" : "Controls persona, system prompt, and responses."
        },
        {
          icon: "fa-solid fa-vr-cardboard",
          title: t ? "VRM 模型" : "VRM model",
          desc: t ? "决定桌宠形象，支持内置或上传模型。" : "Controls the pet appearance, built-in or uploaded."
        },
        {
          icon: "fa-solid fa-person-running",
          title: t ? "动作 / 窗口 / 预览" : "Motion / window / preview",
          desc: t ? "勾选动作、设置尺寸，再启动检查效果。" : "Enable motions, set size, then start to check it."
        }
      ],
      chips: [
        {
          icon: "fa-solid fa-vr-cardboard",
          text: t ? `当前模型 ${m?.name || "未选择"}` : `Current model: ${m?.name || "None"}`
        },
        {
          icon: "fa-solid fa-person-running",
          text: t ? `${B.filter((Z) => Z.selected).length} 个动作已启用` : `${B.filter((Z) => Z.selected).length} motions enabled`
        }
      ]
    },
    stats: [
      {
        label: t ? "运行状态" : "Status",
        value: w ? t ? "运行中" : "Running" : t ? "已停止" : "Stopped",
        meta: t ? "桌宠窗口的当前活动状态。" : "Current activity of the desktop pet window.",
        emphasis: w
      },
      {
        label: t ? "当前模型" : "Current Model",
        value: m?.name || (t ? "未选择" : "None"),
        meta: `${o.length} ${t ? "内置 + " : "built-in + "}${i.length} ${t ? "资源包 + " : "cloud + "}${p.length} ${t ? "自定义" : "custom"}`,
        truncate: !0
      },
      {
        label: t ? "动作" : "Motions",
        value: `${B.filter((Z) => Z.selected).length} / ${b.length}`,
        meta: t ? "已启用 / 全部可用" : "Enabled / available"
      },
      {
        label: t ? "窗口尺寸" : "Window Size",
        value: `${Number(n.windowWidth || 540)} × ${Number(n.windowHeight || 960)}`,
        meta: t ? "宽 × 高（像素）" : "Width × Height (px)"
      }
    ],
    vrm: {
      selectedModelId: g,
      selectedModel: m,
      models: f,
      defaultModels: o,
      cloudModels: i,
      userModels: p,
      remoteResourceBaseUrl: String(n.remoteResourceBaseUrl || ""),
      motions: B,
      selectedMotionIds: Array.from(A),
      enabledExpressions: !!n.enabledExpressions,
      enabledMotions: !!n.enabledMotions,
      windowWidth: Number(n.windowWidth || 540),
      windowHeight: Number(n.windowHeight || 960),
      running: w,
      starting: _e,
      stopping: ye,
      mainAgent: ne,
      agentOptions: ke,
      previewUrl: ae,
      previewKey: Q,
      partyURL: J,
      isElectron: !!e?.isElectron
    }
  };
}
function vc(e) {
  const t = fe(), n = Qs(t), a = Ku(e), o = {
    surface: e,
    surfaceMenu: a,
    activeMenu: String(t?.activeMenu || ""),
    isZh: n,
    isActive: String(t?.activeMenu || "") === a
  };
  switch (e) {
    case "deploy":
      return { ...o, ...qu(t, n) };
    case "vrm":
      return { ...o, ...fc(t, n) };
    case "workbench":
      return { ...o, ...Hu(t, n) };
    case "enterprise":
      return { ...o, ...Yu(t, n) };
    case "storage":
      return { ...o, ...rc(t, n) };
    case "kernel":
      return { ...o, ...uc(t, n) };
    case "system":
      return { ...o, ...cc(t, n) };
    case "task":
      return { ...o, ...dc(t, n) };
    case "about":
      return { ...o, ...pc(t, n) };
    default:
      return o;
  }
}
async function pl(e) {
  e === "system" && await An(!0);
  const t = fe();
  if (t)
    switch (e) {
      case "deploy":
        typeof t.ensureDeployBotReady == "function" && await t.ensureDeployBotReady(t.subMenu || "live_stream");
        break;
      case "vrm":
        typeof t.loadDefaultModels == "function" && await t.loadDefaultModels(), typeof t.loadDefaultMotions == "function" && await t.loadDefaultMotions();
        break;
      case "workbench":
        t.subMenu = t.subMenu || "develop", t.subMenu === "develop" && typeof t.loadDevWorkbench == "function" && await t.loadDevWorkbench();
        break;
      case "enterprise":
        typeof t.openEnterpriseTab == "function" && await t.openEnterpriseTab(t.enterpriseTab || "usage");
        break;
      case "storage":
        String(t.subMenu || "") === "memory-v3" ? await qt() : typeof t.switchStorageTile == "function" && await t.switchStorageTile(t.subMenu || "text");
        break;
      case "kernel":
        typeof t.openKernelTab == "function" && await t.openKernelTab(t.kernelConsoleTab || "overview");
        break;
      case "system":
        typeof t.setPrototypeSystemTab == "function" && t.setPrototypeSystemTab(t.prototypeSystemTab || "general");
        break;
      case "task":
        typeof t.fetchTasks == "function" && await t.fetchTasks();
        break;
      case "about":
        if (t.isElectron && typeof window < "u" && window.electronAPI?.getAppVersion)
          try {
            const n = await window.electronAPI.getAppVersion();
            n && (t.updateCurrentVersion = String(n));
          } catch {
          }
        break;
    }
}
async function gc(e, t) {
  const n = fe();
  if (n)
    switch (e) {
      case "deploy":
        n.subMenu = t, typeof n.ensureDeployBotReady == "function" && await n.ensureDeployBotReady(t);
        break;
      case "workbench":
        n.subMenu = t, t === "develop" && typeof n.loadDevWorkbench == "function" && await n.loadDevWorkbench();
        break;
      case "enterprise":
        typeof n.openEnterpriseTab == "function" ? await n.openEnterpriseTab(t) : n.enterpriseTab = t;
        break;
      case "storage":
        t === "memory-v3" ? (n.subMenu = "memory-v3", await qt()) : typeof n.switchStorageTile == "function" ? await n.switchStorageTile(t) : n.subMenu = t;
        break;
      case "kernel":
        typeof n.openKernelTab == "function" ? await n.openKernelTab(t) : n.kernelConsoleTab = t;
        break;
      case "system":
        t === "feature-packs" ? n.prototypeSystemTab = t : typeof n.setPrototypeSystemTab == "function" ? n.setPrototypeSystemTab(t) : n.prototypeSystemTab = t;
        break;
    }
}
async function mc(e) {
  const t = fe();
  if (t)
    switch (e) {
      case "deploy":
        typeof t.refreshPrototypeDeployStatus == "function" && await t.refreshPrototypeDeployStatus(t.subMenu || "table_pet");
        break;
      case "vrm":
        await pl(e);
        break;
      case "workbench":
        typeof t.loadDevWorkbench == "function" && await t.loadDevWorkbench();
        break;
      case "enterprise":
        typeof t.refreshPrototypeEnterpriseStatus == "function" && await t.refreshPrototypeEnterpriseStatus(t.enterpriseTab || "usage");
        break;
      case "storage":
        String(t.subMenu || "") === "memory-v3" ? await qt() : await pl(e);
        break;
      case "kernel":
        typeof t.loadKernelConsole == "function" && await t.loadKernelConsole();
        break;
      case "system":
        typeof t.refreshPrototypeSystemStatus == "function" && await t.refreshPrototypeSystemStatus(), await An(!0);
        break;
      case "task":
        typeof t.fetchTasks == "function" && await t.fetchTasks();
        break;
    }
}
async function yc() {
  const e = fe();
  !e || typeof e.checkForUpdates != "function" || await e.checkForUpdates({ silent: !1 });
}
async function hc() {
  const e = fe();
  !e || typeof e.handleSelect != "function" || await e.handleSelect("logo");
}
async function Ns(e) {
  e && typeof e.autoSaveSettings == "function" && await e.autoSaveSettings();
}
async function Uo(e) {
  if (!(!e?.isElectron || typeof window > "u" || !window.electronAPI?.setLaunchAtStartup))
    try {
      await window.electronAPI.setLaunchAtStartup({
        enabled: !!e?.systemSettings?.launchAtStartup,
        startMinimized: !!e?.systemSettings?.startMinimized
      });
    } catch (t) {
      console.warn("Sync launch settings failed:", t);
    }
}
async function _c(e, t) {
  const n = fe();
  if (!n) return;
  (!n.systemSettings || typeof n.systemSettings != "object") && (n.systemSettings = {});
  const a = String(e || "").trim();
  if (!a) return;
  const i = (/* @__PURE__ */ new Set(["launchAtStartup", "startMinimized"])).has(a) ? !!t : String(t ?? "");
  if (a === "language" && typeof n.handleSystemLanguageChange == "function") {
    await n.handleSystemLanguageChange(i);
    return;
  }
  if (a === "theme" && typeof n.handleThemeChange == "function") {
    await n.handleThemeChange(i);
    return;
  }
  if (a === "network") {
    if (n.isElectron && typeof window < "u" && window.electronAPI?.setNetworkVisibility && typeof n.handleNetworkChange == "function") {
      await n.handleNetworkChange(i);
      return;
    }
    n.systemSettings.network = i, await Ns(n);
    return;
  }
  if (n.systemSettings[a] = i, a === "proxyMode" || a === "proxy") {
    typeof n.updateProxy == "function" ? await n.updateProxy() : (await Ns(n), n.isElectron || await fetch("/api/update_proxy", { method: "POST" }).catch(() => null));
    return;
  }
  await Ns(n), (a === "launchAtStartup" || a === "startMinimized") && await Uo(n);
}
async function bc() {
  const e = fe();
  typeof e?.openSkinStudio == "function" && await e.openSkinStudio();
}
async function xc(e) {
  const t = fe();
  typeof t?.activateSkin == "function" && await t.activateSkin(String(e || ""));
}
async function kc(e) {
  const t = fe();
  t && (t.targetLangSelected = String(e || "system"), typeof t.changeLanguage == "function" ? t.changeLanguage() : await Ns(t));
}
async function Sc() {
  const e = fe();
  e && typeof e.clearPrototypeRuntimeCache == "function" && await e.clearPrototypeRuntimeCache();
}
async function wc(e) {
  const t = fe();
  if (!t) return;
  const n = String(e || "").trim();
  if (n === "command-panel" && typeof t.openHomeCommandPanel == "function") {
    t.openHomeCommandPanel();
    return;
  }
  if (n === "desktop-control" && typeof t.openDesktopControlWorkbench == "function") {
    await t.openDesktopControlWorkbench();
    return;
  }
  if (n === "dynamic-island" && typeof t.openDynamicIslandSurface == "function") {
    await t.openDynamicIslandSurface();
    return;
  }
  n === "floating-task-hud" && typeof t.openFloatingTaskHudSurface == "function" && await t.openFloatingTaskHudSurface();
}
async function Cc(e) {
  const t = fe();
  if (!t) return;
  const n = String(e || "").trim();
  if (n === "user" && typeof t.openUserfile == "function") {
    await t.openUserfile();
    return;
  }
  if (n === "logs" && typeof t.openLogfile == "function") {
    await t.openLogfile();
    return;
  }
  n === "extensions" && typeof t.openExtfile == "function" && await t.openExtfile();
}
async function Mc() {
  const e = fe();
  e && (e.systemSettings = {
    ...e.systemSettings || {},
    language: "auto",
    theme: "party",
    network: "local",
    timezone: "Asia/Shanghai",
    dateFormat: "YYYY-MM-DD",
    launchAtStartup: !1,
    startMinimized: !1,
    proxy: "",
    proxyMode: "system"
  }, e.targetLangSelected = "system", typeof e.handleSystemLanguageChange == "function" && await e.handleSystemLanguageChange("auto"), typeof e.handleThemeChange == "function" && await e.handleThemeChange("party"), await Ns(e), await Uo(e), typeof e.updateProxy == "function" ? await e.updateProxy() : e.isElectron || await fetch("/api/update_proxy", { method: "POST" }).catch(() => null), cn(Qs(e) ? "系统设置已恢复默认值" : "System settings reset to defaults", "success"));
}
async function Rc() {
  const e = fe();
  e && typeof e.ensureDeployBotReady == "function" && await e.ensureDeployBotReady("live_stream");
}
async function Tc() {
  const e = fe();
  e && typeof e.startVRM == "function" && await e.startVRM();
}
async function $c() {
  const e = fe();
  e && typeof e.startVRMweb == "function" && await e.startVRMweb();
}
async function Ac(e) {
  const t = fe();
  if (!t || !t.VRMConfig) return;
  const n = String(e || "");
  t.VRMConfig.name = "default", t.VRMConfig.selectedModelId = n, t.VRMConfig.selectedNewModelId = n, typeof t.saveVRMConfig == "function" ? await t.saveVRMConfig() : typeof t.handleModelChange == "function" ? await t.handleModelChange(n) : typeof t.autoSaveSettings == "function" && await t.autoSaveSettings();
}
function cn(e, t = "info") {
  typeof window < "u" && typeof window.showNotification == "function" && window.showNotification(e, t);
}
async function Ic(e) {
  const t = fe();
  if (!t || !t.VRMConfig) return null;
  const n = Qs(t), a = String(e || "");
  if (!a) return null;
  cn(n ? "开始下载 VRM 模型..." : "Downloading VRM model...", "info");
  let o;
  if (t.isElectron) {
    if (typeof window.openxnetDesktop?.downloadApplicationCloudVrmModel != "function")
      throw new Error("Desktop VR Asset Runtime is unavailable.");
    const p = await window.openxnetDesktop.downloadApplicationCloudVrmModel({ modelId: a });
    o = { success: p.success, model: p.asset }, typeof t.invalidateApplicationVrAssetCatalog == "function" && t.invalidateApplicationVrAssetCatalog();
  } else {
    const p = await fetch(`/download_vrm_model/${encodeURIComponent(a)}`, {
      method: "POST"
    });
    if (o = await p.json().catch(() => ({})), !p.ok || !o?.success) {
      const f = o?.message || `Download failed (${p.status})`;
      throw cn(f, "error"), new Error(f);
    }
  }
  const i = o.model || null;
  if (i?.id) {
    Array.isArray(t.VRMConfig.userModels) || (t.VRMConfig.userModels = []);
    const p = t.VRMConfig.userModels.findIndex((f) => String(f?.id || "") === String(i.id));
    p >= 0 ? t.VRMConfig.userModels.splice(p, 1, i) : t.VRMConfig.userModels.push(i), t.VRMConfig.selectedModelId = String(i.id), t.VRMConfig.selectedNewModelId = String(i.id), Array.isArray(t.VRMConfig.cloudModels) && (t.VRMConfig.cloudModels = t.VRMConfig.cloudModels.map((f) => String(f?.id || "") === String(i.id) ? { ...f, downloaded: !0, downloadable: !1, path: i.path } : f)), typeof t.saveVRMConfig == "function" ? await t.saveVRMConfig() : typeof t.autoSaveSettings == "function" && await t.autoSaveSettings();
  }
  return typeof t.loadDefaultModels == "function" && await t.loadDefaultModels(), cn(n ? "VRM 模型已下载并选中" : "VRM model downloaded and selected", "success"), o;
}
async function Ec(e) {
  const t = fe();
  if (!t || !t.VRMConfig) return;
  Array.isArray(t.VRMConfig.selectedMotionIds) || (t.VRMConfig.selectedMotionIds = []);
  const n = t.VRMConfig.selectedMotionIds, a = n.indexOf(e);
  a === -1 ? n.push(e) : n.splice(a, 1), typeof t.handleMotionChange == "function" ? await t.handleMotionChange() : typeof t.autoSaveSettings == "function" && await t.autoSaveSettings();
}
async function Pc(e) {
  const t = fe();
  !t || !t.VRMConfig || (t.VRMConfig.enabledExpressions = !!e, typeof t.autoSaveSettings == "function" && await t.autoSaveSettings());
}
async function Dc(e) {
  const t = fe();
  !t || !t.VRMConfig || (t.VRMConfig.enabledMotions = !!e, typeof t.autoSaveSettings == "function" && await t.autoSaveSettings());
}
async function Oc(e) {
  const t = fe();
  if (!t || !t.VRMConfig) return;
  const n = Number(e);
  Number.isFinite(n) && (t.VRMConfig.windowWidth = Math.max(300, Math.min(3840, Math.floor(n))), typeof t.autoSaveSettings == "function" && await t.autoSaveSettings());
}
async function Vc(e) {
  const t = fe();
  if (!t || !t.VRMConfig) return;
  const n = Number(e);
  Number.isFinite(n) && (t.VRMConfig.windowHeight = Math.max(300, Math.min(3840, Math.floor(n))), typeof t.autoSaveSettings == "function" && await t.autoSaveSettings());
}
async function Lc(e) {
  const t = fe();
  t && (t.mainAgent = String(e || "super-model"), typeof t.autoSaveSettings == "function" && await t.autoSaveSettings());
}
async function Fc() {
  const e = fe();
  e && (e.showVrmModelDialog = !0);
}
async function Nc() {
  const e = fe();
  e && (e.showVrmaMotionDialog = !0);
}
async function jc(e) {
  const t = fe();
  t && typeof t.deleteModelOption == "function" && (await t.deleteModelOption(e), typeof t.loadDefaultModels == "function" && await t.loadDefaultModels());
}
async function Wc(e) {
  const t = fe();
  t && typeof t.deleteMotionOption == "function" && await t.deleteMotionOption(e);
}
async function Bc() {
  const e = fe();
  e && (typeof e.openTaskCenter == "function" ? e.openTaskCenter() : e.activeMenu = "task-center");
}
async function Uc(e) {
  const t = fe();
  !t || !e || typeof t.openTaskDetailView == "function" && await t.openTaskDetailView(e);
}
async function Kc(e, t = "") {
  const n = fe();
  n && (typeof n.handleSelect == "function" ? await n.handleSelect(e) : n.activeMenu = e, t && (e === "enterprise" ? n.enterpriseTab = t : e === "kernel" ? n.kernelConsoleTab = t : n.subMenu = t));
}
async function Ko(e = "") {
  const t = fe();
  if (!t) return;
  const n = String(e || "").trim(), a = n && z(t?.enterpriseRoleCards || t?.staffRoles).find((o) => String(o?.id || "") === n) || null;
  if (typeof t.openStaffRoleForm == "function") {
    t.openStaffRoleForm(a || null);
    return;
  }
  typeof t.createEmptyStaffRoleDraft == "function" && (t.newStaffRole = t.createEmptyStaffRoleDraft({ department: "" })), t.newSkillInput = "", t.showStaffRoleForm = !0;
}
async function qc(e) {
  const t = fe();
  if (t) {
    if (typeof t.createStaffFromTemplate == "function") {
      t.createStaffFromTemplate(e);
      return;
    }
    await Ko();
  }
}
async function Hc(e) {
  const t = fe();
  if (!(!t || !e)) {
    if (typeof t.removeStaffRole == "function") {
      await t.removeStaffRole(e);
      return;
    }
    typeof t.deleteRoleCard == "function" && await t.deleteRoleCard(e);
  }
}
async function zc(e = "") {
  const t = fe();
  if (!t) return;
  const n = String(e || "").trim(), a = n && z(t?.enterpriseWorkspaces).find((o) => String(o?.id || "") === n) || null;
  if (typeof t.openWorkspaceForm == "function") {
    t.openWorkspaceForm(a || null);
    return;
  }
  t.showWorkspaceForm = !0;
}
async function Yc(e) {
  const t = fe();
  if (!(!t || !e)) {
    if (typeof t.openEnterpriseWorkspace == "function") {
      await t.openEnterpriseWorkspace(e);
      return;
    }
    typeof t.openEnterpriseTab == "function" ? await t.openEnterpriseTab("enterprise-sandbox") : t.enterpriseTab = "enterprise-sandbox", t.sandboxLevel = 1, t.sandboxCurrentWs = e;
  }
}
async function Gc(e) {
  const t = fe();
  !t || !e || typeof t.removeWorkspace == "function" && await t.removeWorkspace(e);
}
async function Qc(e = "", t = "") {
  const n = fe();
  if (!n) return;
  const a = String(t || "").trim(), o = a && z(n?.enterpriseProjects).find((i) => String(i?.id || "") === a) || null;
  if (typeof n.openProjectForm == "function") {
    n.openProjectForm(o || null, String(e || n.sandboxCurrentWs || ""));
    return;
  }
  n.newProject = {
    ...n.newProject || {},
    id: "",
    name: "",
    workspaceId: String(e || n.sandboxCurrentWs || ""),
    color: "#4ecdc4",
    icon: "fa-solid fa-folder",
    description: ""
  }, n.showProjectFloatPanel = !0;
}
async function Xc(e) {
  const t = fe();
  !t || !e || typeof t.removeProject == "function" && await t.removeProject(e);
}
async function Jc(e) {
  const t = fe();
  if (!t || !e) return;
  const n = z(t?.enterpriseProjects).find((a) => String(a?.id || "") === String(e || "")) || null;
  n && (typeof t.openEnterpriseTab == "function" ? await t.openEnterpriseTab("enterprise-sandbox") : t.enterpriseTab = "enterprise-sandbox", t.sandboxLevel = 2, t.sandboxCurrentWs = String(n.workspaceId || t.sandboxCurrentWs || ""), t.sandboxCurrentProject = String(n.id || ""), t.selected3DAgent = null, t.enterprise3DScene && typeof t.enterprise3DScene.showFloorView == "function" && (t.enterprise3DScene.showFloorView(n.id), typeof t.enterprise3DScene.resize == "function" && t.enterprise3DScene.resize()));
}
async function Zc(e = 0, t = "") {
  const n = fe();
  if (!n) return;
  const a = Math.max(0, Math.min(2, Number(e || 0)));
  if (a === 0) {
    n.sandboxLevel = 0, n.sandboxCurrentWs = null, n.sandboxCurrentProject = null, n.selected3DAgent = null, n.enterprise3DScene && typeof n.enterprise3DScene.showCityView == "function" && (n.enterprise3DScene.showCityView(), typeof n.enterprise3DScene.resize == "function" && n.enterprise3DScene.resize());
    return;
  }
  if (a === 1) {
    const p = String(t || n.sandboxCurrentWs || "").trim();
    if (!p) return;
    n.sandboxLevel = 1, n.sandboxCurrentWs = p, n.sandboxCurrentProject = null, n.selected3DAgent = null, n.enterprise3DScene && typeof n.enterprise3DScene.showBuildingView == "function" && (n.enterprise3DScene.showBuildingView(p), typeof n.enterprise3DScene.resize == "function" && n.enterprise3DScene.resize());
    return;
  }
  const o = String(t || n.sandboxCurrentProject || "").trim(), i = z(n?.enterpriseProjects).find((p) => String(p?.id || "") === o) || null;
  i && (n.sandboxLevel = 2, n.sandboxCurrentWs = String(i.workspaceId || n.sandboxCurrentWs || "").trim(), n.sandboxCurrentProject = String(i.id || "").trim(), n.selected3DAgent = null, n.enterprise3DScene && typeof n.enterprise3DScene.showFloorView == "function" && (n.enterprise3DScene.showFloorView(i.id), typeof n.enterprise3DScene.resize == "function" && n.enterprise3DScene.resize()));
}
async function ed(e) {
  const t = fe();
  if (!t || !e) return;
  const n = z(t?.sandboxAgents).find((a) => String(a?.id || "") === String(e || "")) || z(t?.staffRoles).find((a) => String(a?.id || "") === String(e || "")) || null;
  if (n) {
    if (t.selected3DAgent = n, typeof t.onAgent3DDblClick == "function") {
      t.onAgent3DDblClick(n);
      return;
    }
    t.showSandboxChatPanel = !0;
  }
}
async function td(e = "", t = "") {
  const n = fe();
  n && (typeof n.createEmptyStaffRoleDraft == "function" && (n.newStaffRole = n.createEmptyStaffRoleDraft({
    department: "",
    assignedWorkspace: String(e || n.sandboxCurrentWs || ""),
    projectId: String(t || n.sandboxCurrentProject || "")
  })), n.newSkillInput = "", n.enterprise3DScene && n.enterprise3DScene._isFullscreen ? n.showSandboxFloatPanel = !0 : n.showStaffRoleForm = !0);
}
async function sd() {
  const e = fe();
  if (e) {
    if (typeof e.sandboxGoBack == "function") {
      e.sandboxGoBack();
      return;
    }
    e.sandboxLevel = Math.max(0, Number(e.sandboxLevel || 0) - 1);
  }
}
async function nd(e = {}) {
  const t = fe();
  if (!t) return !1;
  const n = String(e?.id || "").trim(), a = {
    name: String(e?.name || "").trim(),
    description: String(e?.description || "").trim(),
    category: String(e?.category || "").trim()
  };
  if (typeof t.saveEnterpriseKnowledgeBaseRecord == "function")
    await t.saveEnterpriseKnowledgeBaseRecord({ ...a, ...n ? { id: n } : {} });
  else {
    if (mt())
      throw new Error("Desktop Enterprise host bridge is unavailable.");
    const o = n ? "PUT" : "POST", i = n ? `/v1/enterprise/knowledge-bases/${n}` : "/v1/enterprise/knowledge-bases", p = await fetch(i, {
      method: o,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(a)
    });
    if (!p.ok) {
      const f = await p.json().catch(() => ({}));
      throw new Error(f?.error || `Failed to save KB (${p.status})`);
    }
  }
  return typeof t.loadEnterpriseKBs == "function" && await t.loadEnterpriseKBs(), !0;
}
async function ld(e) {
  const t = fe();
  if (!(!t || !e)) {
    if (typeof t.removeEnterpriseKnowledgeBaseRecord == "function")
      await t.removeEnterpriseKnowledgeBaseRecord(e);
    else {
      if (mt())
        throw new Error("Desktop Enterprise host bridge is unavailable.");
      const n = await fetch(`/v1/enterprise/knowledge-bases/${e}`, {
        method: "DELETE"
      });
      if (!n.ok) {
        const a = await n.json().catch(() => ({}));
        throw new Error(a?.error || `Failed to delete KB (${n.status})`);
      }
    }
    typeof t.loadEnterpriseKBs == "function" && await t.loadEnterpriseKBs();
  }
}
async function ad(e) {
  if (!e) return [];
  const t = fe();
  if (typeof t?.loadEnterpriseKnowledgeBaseVersionRecords == "function")
    return t.loadEnterpriseKnowledgeBaseVersionRecords(e);
  if (mt())
    throw new Error("Desktop Enterprise host bridge is unavailable.");
  const n = await fetch(`/v1/enterprise/knowledge-bases/${e}/versions`);
  if (!n.ok)
    throw new Error(`Failed to load versions (${n.status})`);
  const a = await n.json();
  return Array.isArray(a?.versions) ? a.versions : [];
}
function od() {
  return {
    contextWorkspace: Nu,
    snapshot: vc,
    ensureLoaded: pl,
    selectSurfaceTab: gc,
    refreshSurface: mc,
    uploadStorageLibrary: lc,
    refreshStorageLibrary: ac,
    runStorageFileAction: ic,
    deleteStorageFiles: oc,
    runSystemUpdateCheck: yc,
    openAboutSurface: hc,
    updateSystemSetting: _c,
    openSkinStudio: bc,
    activateSkin: xc,
    setSystemTargetLanguage: kc,
    clearSystemRuntimeCache: Sc,
    runSystemQuickAction: wc,
    openSystemPath: Cc,
    resetSystemSettings: Mc,
    loadFeaturePacks: An,
    runFeaturePackOperation: Wu,
    startPrimaryDeployAction: Rc,
    openTaskCenter: Bc,
    openTask: Uc,
    jumpToMenu: Kc,
    // VRM actions
    startVrm: Tc,
    startVrmWeb: $c,
    setVrmModel: Ac,
    downloadVrmModel: Ic,
    toggleVrmMotion: Ec,
    setVrmExpressionsEnabled: Pc,
    setVrmMotionsEnabled: Dc,
    setVrmWindowWidth: Oc,
    setVrmWindowHeight: Vc,
    setVrmAgent: Lc,
    openAddVrmModel: Fc,
    openAddVrmMotion: Nc,
    deleteVrmUserModel: jc,
    deleteVrmUserMotion: Wc,
    openEnterpriseStaffRoleForm: Ko,
    createEnterpriseStaffRoleFromTemplate: qc,
    deleteEnterpriseStaffRole: Hc,
    openEnterpriseWorkspaceForm: zc,
    openEnterpriseWorkspace: Yc,
    deleteEnterpriseWorkspace: Gc,
    openEnterpriseProjectForm: Qc,
    deleteEnterpriseProject: Xc,
    openEnterpriseProject: Jc,
    navigateEnterpriseSandbox: Zc,
    openEnterpriseSandboxAgentChat: ed,
    openEnterpriseStaffRoleForProject: td,
    sandboxGoBack: sd,
    saveEnterpriseKnowledgeBase: nd,
    deleteEnterpriseKnowledgeBase: ld,
    loadEnterpriseKnowledgeBaseVersions: ad,
    loadSynapxnetMemories: qt,
    detectApplicationOllama: No,
    selectSynapxnetMemory: Gu,
    createSynapxnetMemory: Qu,
    editSynapxnetMemory: Xu,
    rollbackSynapxnetMemory: Ju,
    retireSynapxnetMemory: Zu,
    exportSynapxnetMemories: ec,
    importSynapxnetMemories: tc,
    verifySynapxnetMemory: sc
  };
}
const Vl = (e, t) => {
  const n = e.__vccOpts || e;
  for (const [a, o] of t)
    n[a] = o;
  return n;
}, id = ["aria-busy"], rd = { class: "ox-storage-library__head" }, ud = { class: "ox-storage-library__identity" }, cd = { class: "ox-storage-library__icon" }, dd = { class: "ox-storage-library__commands" }, pd = ["disabled"], fd = ["disabled"], vd = ["accept"], gd = { class: "ox-storage-library__filters" }, md = { class: "ox-storage-library__search" }, yd = ["aria-label", "placeholder"], hd = ["aria-label"], _d = { value: "all" }, bd = ["value"], xd = { class: "ox-storage-library__count" }, kd = ["role"], Sd = { class: "ox-storage-library__selection" }, wd = ["checked", "indeterminate", "disabled"], Cd = ["disabled"], Md = {
  key: 0,
  class: "ox-storage-library__media"
}, Rd = ["disabled", "aria-label", "onClick"], Td = ["src", "alt", "onError"], $d = ["src", "aria-label", "onError"], Ad = {
  key: 2,
  class: "ox-storage-library__media-error"
}, Id = { class: "ox-storage-library__check" }, Ed = ["value", "disabled", "aria-label"], Pd = { class: "ox-storage-library__filename" }, Dd = {
  key: 0,
  class: "ox-storage-library__file-icon"
}, Od = ["title"], Vd = {
  key: 0,
  class: "ox-storage-library__invalid"
}, Ld = { class: "ox-storage-library__metadata" }, Fd = { class: "ox-storage-library__file-actions" }, Nd = ["disabled", "title", "aria-label", "onClick"], jd = ["disabled", "title", "aria-label", "onClick"], Wd = ["disabled", "title", "aria-label", "onClick"], Bd = ["disabled", "title", "aria-label", "onClick"], Ud = {
  key: 2,
  class: "ox-storage-library__empty"
}, Kd = ["disabled"], qd = {
  key: 3,
  class: "ox-storage-library__drop-note"
}, Hd = { class: "ox-storage-library__dialog-actions" }, zd = ["aria-label"], Yd = {
  key: 0,
  role: "alert"
}, Gd = ["src", "alt"], Qd = {
  __name: "StorageLibrary",
  props: {
    library: { type: Object, default: () => ({ kind: "text", files: [], canUpload: !1, uploadAccept: "" }) },
    bridge: { type: Object, required: !0 },
    isZh: { type: Boolean, default: !0 }
  },
  emits: ["refresh"],
  setup(e, { emit: t }) {
    const n = e, a = t, o = /* @__PURE__ */ pe(""), i = /* @__PURE__ */ pe("all"), p = /* @__PURE__ */ pe([]), f = /* @__PURE__ */ pe(!1), g = /* @__PURE__ */ pe(""), m = /* @__PURE__ */ pe("info"), h = /* @__PURE__ */ pe(null), R = /* @__PURE__ */ pe(null), b = /* @__PURE__ */ pe(null), A = /* @__PURE__ */ pe([]), B = /* @__PURE__ */ pe(null), J = /* @__PURE__ */ pe(/* @__PURE__ */ new Set()), G = /* @__PURE__ */ pe(!1), $ = /* @__PURE__ */ pe(!1), Q = se(() => n.library.kind), ae = se(() => Array.isArray(n.library.files) ? n.library.files : []), w = (ce, O) => n.isZh ? ce : O, _e = se(() => ({ text: w("文档库", "Documents"), image: w("图片库", "Images"), video: w("视频库", "Videos") })[Q.value] || w("文件库", "Files")), ye = se(() => ({ text: "fa-file-lines", image: "fa-image", video: "fa-video" })[Q.value] || "fa-file"), ne = se(() => [...new Set(ae.value.map((ce) => ce.ext).filter(Boolean))].sort()), Ce = se(() => ae.value.filter((ce) => (!o.value.trim() || String(ce.name).toLocaleLowerCase().includes(o.value.trim().toLocaleLowerCase())) && (Q.value !== "text" || i.value === "all" || ce.ext === i.value))), ke = se(() => Ce.value.filter((ce) => !ce.invalidReason).map((ce) => ce.id)), Z = se(() => ke.value.length > 0 && ke.value.every((ce) => p.value.includes(ce))), Me = se(() => !Z.value && ke.value.some((ce) => p.value.includes(ce)));
    Gt(Q, () => {
      o.value = "", i.value = "all", p.value = [], g.value = "", $.value = !1, le(), $e();
    }), Gt(ae, (ce) => {
      const O = new Set(ce.filter((M) => !M.invalidReason).map((M) => M.id));
      p.value = p.value.filter((M) => O.has(M));
    });
    async function ie(ce, O, M) {
      if (f.value) return null;
      f.value = !0, g.value = "";
      try {
        if (typeof n.bridge[ce] != "function") throw new Error(w("当前环境不支持此操作。", "This operation is unavailable in the current environment."));
        const V = await n.bridge[ce](...O);
        if (!V || !["completed", "requested", "cancelled"].includes(V.status)) throw new Error(w("操作未返回有效结果，请刷新后重试。", "The operation returned no valid result. Refresh and retry."));
        return V.status === "cancelled" ? (m.value = "info", g.value = w("已取消操作。", "Operation cancelled.")) : (m.value = "success", g.value = V.status === "requested" ? w("已交给浏览器保存，请查看下载列表。", "Handed to the browser for saving. Check your downloads.") : M), V;
      } catch (V) {
        return m.value = "error", g.value = V?.message || w("操作失败，请重试。", "The operation failed. Retry."), null;
      } finally {
        f.value = !1, a("refresh");
      }
    }
    function k(ce) {
      p.value = ce ? [.../* @__PURE__ */ new Set([...p.value, ...ke.value])] : p.value.filter((O) => !ke.value.includes(O));
    }
    async function H(ce) {
      const O = Array.from(ce.target?.files || []);
      ce.target && (ce.target.value = ""), O.length && await ie("uploadStorageLibrary", [Q.value, O], w("文件已加入文件库。", "Files added to the library."));
    }
    async function ve(ce) {
      if ($.value = !1, !n.library.canUpload || f.value) return;
      const O = Array.from(ce.dataTransfer?.files || []);
      O.length && await ie("uploadStorageLibrary", [Q.value, O], w("文件已加入文件库。", "Files added to the library."));
    }
    async function be() {
      J.value = /* @__PURE__ */ new Set(), await ie("refreshStorageLibrary", [], w("文件库已刷新。", "Library refreshed."));
    }
    async function he(ce) {
      A.value = [...ce], await Bs(), R.value?.showModal();
    }
    function le() {
      R.value?.close(), A.value = [];
    }
    async function Le() {
      const ce = A.value.slice();
      le(), await ie("deleteStorageFiles", [Q.value, ce], w("所选文件已删除。", "Selected files deleted."));
    }
    async function Fe(ce, O) {
      await ie("runStorageFileAction", [Q.value, ce, O.id], ce === "copy-link" ? w("文件链接已复制。", "File link copied.") : w("文件下载完成。", "File download completed."));
    }
    async function Te(ce) {
      const O = await ie("runStorageFileAction", [Q.value, "preview", ce.id], "");
      O?.url && (B.value = { name: ce.name, url: O.url }, G.value = !1, await Bs(), b.value?.showModal());
    }
    function $e() {
      b.value?.close(), B.value = null, G.value = !1;
    }
    return (ce, O) => (u(), c("section", {
      class: q(["ox-storage-library", { "is-dragging": $.value }]),
      "aria-busy": f.value,
      onDragover: O[9] || (O[9] = Ot((M) => $.value = e.library.canUpload && !f.value, ["prevent"])),
      onDragleave: O[10] || (O[10] = Ot((M) => $.value = !1, ["self"])),
      onDrop: Ot(ve, ["prevent"])
    }, [
      s("header", rd, [
        s("div", ud, [
          s("span", cd, [
            s("i", {
              class: q(["fa-solid", ye.value]),
              "aria-hidden": "true"
            }, null, 2)
          ]),
          s("div", null, [
            s("h2", null, [
              de(l(_e.value) + " ", 1),
              s("span", null, l(ae.value.length), 1)
            ]),
            s("p", null, l(Q.value === "video" ? w("工作流与生成任务产生的视频会同步到这里。", "Videos from workflows and generation tasks appear here.") : w("上传、查找和管理可复用的素材文件。", "Upload, find, and manage reusable files.")), 1)
          ])
        ]),
        s("div", dd, [
          s("button", {
            type: "button",
            disabled: f.value,
            onClick: be
          }, [
            O[11] || (O[11] = s("i", {
              class: "fa-solid fa-arrow-rotate-right",
              "aria-hidden": "true"
            }, null, -1)),
            de(l(w("刷新", "Refresh")), 1)
          ], 8, pd),
          e.library.canUpload ? (u(), c("button", {
            key: 0,
            type: "button",
            class: "is-primary",
            disabled: f.value,
            onClick: O[0] || (O[0] = (M) => h.value?.click())
          }, [
            O[12] || (O[12] = s("i", {
              class: "fa-solid fa-arrow-up-from-bracket",
              "aria-hidden": "true"
            }, null, -1)),
            de(l(Q.value === "image" ? w("上传图片", "Upload images") : w("上传文件", "Upload files")), 1)
          ], 8, fd)) : P("", !0),
          s("input", {
            ref_key: "fileInput",
            ref: h,
            type: "file",
            accept: e.library.uploadAccept,
            multiple: "",
            hidden: "",
            onChange: H
          }, null, 40, vd)
        ])
      ]),
      s("div", gd, [
        s("label", md, [
          O[13] || (O[13] = s("i", {
            class: "fa-solid fa-magnifying-glass",
            "aria-hidden": "true"
          }, null, -1)),
          je(s("input", {
            "onUpdate:modelValue": O[1] || (O[1] = (M) => o.value = M),
            type: "search",
            "aria-label": w("搜索文件名", "Search filenames"),
            placeholder: w("搜索文件名…", "Search filenames…")
          }, null, 8, yd), [
            [Qe, o.value]
          ])
        ]),
        Q.value === "text" ? je((u(), c("select", {
          key: 0,
          "onUpdate:modelValue": O[2] || (O[2] = (M) => i.value = M),
          "aria-label": w("文件格式", "File format")
        }, [
          s("option", _d, l(w("全部格式", "All formats")), 1),
          (u(!0), c(I, null, U(ne.value, (M) => (u(), c("option", {
            key: M,
            value: M
          }, l(M), 9, bd))), 128))
        ], 8, hd)), [
          [Po, i.value]
        ]) : P("", !0),
        s("span", xd, l(w("显示", "Showing")) + " " + l(Ce.value.length) + " / " + l(ae.value.length), 1)
      ]),
      g.value ? (u(), c("div", {
        key: 0,
        class: q(["ox-storage-library__feedback", "is-" + m.value]),
        role: m.value === "error" ? "alert" : "status"
      }, [
        s("i", {
          class: q(["fa-solid", m.value === "error" ? "fa-circle-exclamation" : "fa-circle-check"]),
          "aria-hidden": "true"
        }, null, 2),
        de(l(g.value), 1)
      ], 10, kd)) : P("", !0),
      s("div", Sd, [
        s("label", null, [
          s("input", {
            type: "checkbox",
            checked: Z.value,
            indeterminate: Me.value,
            disabled: f.value || !ke.value.length,
            onChange: O[3] || (O[3] = (M) => k(M.target.checked))
          }, null, 40, wd),
          de(l(w("选择当前结果", "Select results")), 1)
        ]),
        s("span", null, l(w("已选", "Selected")) + " " + l(p.value.length), 1),
        s("button", {
          type: "button",
          class: "is-danger",
          disabled: f.value || !p.value.length,
          onClick: O[4] || (O[4] = (M) => he(p.value))
        }, [
          O[14] || (O[14] = s("i", {
            class: "fa-solid fa-trash-can",
            "aria-hidden": "true"
          }, null, -1)),
          de(l(w("删除所选", "Delete selected")), 1)
        ], 8, Cd)
      ]),
      Ce.value.length ? (u(), c("div", {
        key: 1,
        class: q(Q.value === "text" ? "ox-storage-library__rows" : "ox-storage-library__gallery")
      }, [
        (u(!0), c(I, null, U(Ce.value, (M, V) => (u(), c("article", {
          key: M.invalidReason ? "invalid-" + V : M.id,
          class: q(["ox-storage-library__file", { "is-selected": p.value.includes(M.id), "is-media": Q.value !== "text" }])
        }, [
          Q.value !== "text" ? (u(), c("div", Md, [
            Q.value === "image" && !M.invalidReason && !J.value.has(M.id) ? (u(), c("button", {
              key: 0,
              type: "button",
              class: "ox-storage-library__preview-button",
              disabled: f.value,
              "aria-label": w("预览 ", "Preview ") + M.name,
              onClick: (Se) => Te(M)
            }, [
              s("img", {
                src: M.url,
                alt: M.name,
                loading: "lazy",
                decoding: "async",
                onError: (Se) => J.value.add(M.id)
              }, null, 40, Td)
            ], 8, Rd)) : Q.value === "video" && !M.invalidReason && !J.value.has(M.id) ? (u(), c("video", {
              key: 1,
              src: M.url,
              controls: "",
              preload: "none",
              "aria-label": M.name,
              onError: (Se) => J.value.add(M.id)
            }, null, 40, $d)) : (u(), c("span", Ad, [
              s("i", {
                class: q(["fa-solid", ye.value]),
                "aria-hidden": "true"
              }, null, 2),
              de(l(M.invalidReason || (Q.value === "video" ? w("视频暂时无法播放", "Video unavailable") : w("图片暂时无法加载", "Image unavailable"))), 1)
            ]))
          ])) : P("", !0),
          s("label", Id, [
            je(s("input", {
              "onUpdate:modelValue": O[5] || (O[5] = (Se) => p.value = Se),
              type: "checkbox",
              value: M.id,
              disabled: f.value || !!M.invalidReason,
              "aria-label": w("选择 ", "Select ") + M.name
            }, null, 8, Ed), [
              [Pl, p.value]
            ])
          ]),
          s("div", Pd, [
            Q.value === "text" ? (u(), c("span", Dd, [...O[15] || (O[15] = [
              s("i", {
                class: "fa-regular fa-file-lines",
                "aria-hidden": "true"
              }, null, -1)
            ])])) : P("", !0),
            s("div", null, [
              s("strong", {
                title: M.name
              }, l(M.name), 9, Od),
              s("small", null, l(M.ext || "FILE"), 1),
              M.invalidReason ? (u(), c("p", Vd, l(M.invalidReason), 1)) : P("", !0)
            ])
          ]),
          s("div", Ld, [
            s("span", null, l(M.size), 1),
            s("time", null, l(M.time), 1)
          ]),
          s("div", Fd, [
            Q.value === "image" ? (u(), c("button", {
              key: 0,
              type: "button",
              disabled: f.value || !!M.invalidReason,
              title: w("预览", "Preview"),
              "aria-label": w("预览 ", "Preview ") + M.name,
              onClick: (Se) => Te(M)
            }, [...O[16] || (O[16] = [
              s("i", {
                class: "fa-regular fa-eye",
                "aria-hidden": "true"
              }, null, -1)
            ])], 8, Nd)) : P("", !0),
            s("button", {
              type: "button",
              disabled: f.value || !!M.invalidReason,
              title: w("复制链接", "Copy link"),
              "aria-label": w("复制链接 ", "Copy link for ") + M.name,
              onClick: (Se) => Fe("copy-link", M)
            }, [...O[17] || (O[17] = [
              s("i", {
                class: "fa-solid fa-link",
                "aria-hidden": "true"
              }, null, -1)
            ])], 8, jd),
            s("button", {
              type: "button",
              disabled: f.value || !!M.invalidReason,
              title: w("下载", "Download"),
              "aria-label": w("下载 ", "Download ") + M.name,
              onClick: (Se) => Fe("download", M)
            }, [...O[18] || (O[18] = [
              s("i", {
                class: "fa-solid fa-download",
                "aria-hidden": "true"
              }, null, -1)
            ])], 8, Wd),
            s("button", {
              type: "button",
              class: "is-danger",
              disabled: f.value || !!M.invalidReason,
              title: w("删除", "Delete"),
              "aria-label": w("删除 ", "Delete ") + M.name,
              onClick: (Se) => he([M.id])
            }, [...O[19] || (O[19] = [
              s("i", {
                class: "fa-regular fa-trash-can",
                "aria-hidden": "true"
              }, null, -1)
            ])], 8, Bd)
          ])
        ], 2))), 128))
      ], 2)) : (u(), c("div", Ud, [
        s("span", null, [
          s("i", {
            class: q(["fa-solid", o.value || i.value !== "all" ? "fa-magnifying-glass" : ye.value]),
            "aria-hidden": "true"
          }, null, 2)
        ]),
        s("h3", null, l(ae.value.length ? w("没有匹配的文件", "No matching files") : w("文件库中还没有内容", "This library is empty")), 1),
        s("p", null, l(ae.value.length ? w("调整关键词或格式筛选即可继续查找。", "Try another keyword or format filter.") : Q.value === "video" ? w("工作流生成的视频将显示在这里，可直接播放、下载或删除。", "Workflow videos will appear here for playback, download, or deletion.") : w("点击上传按钮，或将文件拖入此区域。", "Use the upload button or drag files into this area.")), 1),
        ae.value.length ? (u(), c("button", {
          key: 0,
          type: "button",
          onClick: O[6] || (O[6] = (M) => {
            o.value = "", i.value = "all";
          })
        }, l(w("清除筛选", "Clear filters")), 1)) : e.library.canUpload ? (u(), c("button", {
          key: 1,
          type: "button",
          class: "is-primary",
          disabled: f.value,
          onClick: O[7] || (O[7] = (M) => h.value?.click())
        }, l(w("选择文件", "Choose files")), 9, Kd)) : P("", !0)
      ])),
      e.library.canUpload ? (u(), c("footer", qd, [
        O[20] || (O[20] = s("i", {
          class: "fa-solid fa-cloud-arrow-up",
          "aria-hidden": "true"
        }, null, -1)),
        de(l($.value ? w("松开即可上传", "Release to upload") : w("也可将文件拖入库中上传", "You can also drag files into the library")), 1)
      ])) : P("", !0),
      s("dialog", {
        ref_key: "deleteDialog",
        ref: R,
        class: "ox-storage-library__dialog",
        onCancel: Ot(le, ["prevent"]),
        onClick: Ot(le, ["self"])
      }, [
        s("h3", null, l(w("删除所选文件", "Delete selected files")), 1),
        s("p", null, l(w(`将从文件库中删除 ${A.value.length} 个文件。`, `Remove ${A.value.length} files from the library.`)), 1),
        s("div", Hd, [
          s("button", {
            type: "button",
            autofocus: "",
            onClick: le
          }, l(w("取消", "Cancel")), 1),
          s("button", {
            type: "button",
            class: "is-danger-solid",
            onClick: Le
          }, l(w("删除文件", "Delete files")), 1)
        ])
      ], 544),
      s("dialog", {
        ref_key: "previewDialog",
        ref: b,
        class: "ox-storage-library__dialog ox-storage-library__dialog--preview",
        onCancel: Ot($e, ["prevent"]),
        onClick: Ot($e, ["self"])
      }, [
        s("header", null, [
          s("h3", null, l(B.value?.name), 1),
          s("button", {
            type: "button",
            "aria-label": w("关闭预览", "Close preview"),
            onClick: $e
          }, [...O[21] || (O[21] = [
            s("i", {
              class: "fa-solid fa-xmark",
              "aria-hidden": "true"
            }, null, -1)
          ])], 8, zd)
        ]),
        G.value ? (u(), c("p", Yd, l(w("图片无法加载，请关闭后刷新文件库重试。", "The image could not be loaded. Close this preview and refresh the library.")), 1)) : P("", !0),
        B.value && !G.value ? (u(), c("img", {
          key: 1,
          src: B.value.url,
          alt: B.value.name,
          onError: O[8] || (O[8] = (M) => G.value = !0)
        }, null, 40, Gd)) : P("", !0)
      ], 544)
    ], 42, id));
  }
}, Xd = /* @__PURE__ */ Vl(Qd, [["__scopeId", "data-v-30a630ea"]]);
function qo(e) {
  const t = typeof e == "function" ? e({ html: !1, linkify: !1, breaks: !1, typographer: !1 }).disable(["image", "link", "autolink"]) : null;
  return (n) => {
    const a = String(n || "");
    return t ? t.render(a) : `<pre>${a.replace(/[&<>"']/g, (i) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    })[i])}</pre>`;
  };
}
const Jd = ["aria-label", "aria-busy"], Zd = { class: "ox-memory-library-toolbar ox-vite-memory-toolbar" }, ep = { class: "ox-memory-library-actor ox-vite-memory-actor" }, tp = ["aria-label", "disabled"], sp = {
  key: 0,
  value: ""
}, np = ["value"], lp = { class: "ox-memory-library-search ox-vite-memory-search" }, ap = ["aria-label", "placeholder", "disabled"], op = ["disabled"], ip = { class: "ox-memory-library-statusline" }, rp = { key: 0 }, up = { key: 1 }, cp = {
  key: 2,
  class: "ox-memory-library-progress",
  role: "status"
}, dp = { class: "ox-memory-library-status-actions" }, pp = { class: "ox-memory-library-check ox-vite-memory-check" }, fp = ["disabled"], vp = ["disabled", "title"], gp = ["disabled", "aria-label", "title"], mp = {
  key: 0,
  class: "ox-memory-library-notice ox-vite-memory-notice is-error",
  role: "alert"
}, yp = {
  key: 1,
  class: "ox-memory-library-notice",
  role: "status"
}, hp = {
  key: 2,
  class: "ox-memory-library-notice is-error",
  role: "alert"
}, _p = {
  key: 3,
  class: "ox-memory-library-feedback",
  role: "status"
}, bp = { class: "ox-memory-library-layout" }, xp = ["aria-label"], kp = {
  key: 0,
  class: "ox-memory-library-list"
}, Sp = ["aria-pressed", "disabled", "onClick"], wp = { class: "ox-memory-library-row-heading ox-vite-memory-row__head" }, Cp = { class: "ox-memory-library-row-meta ox-vite-memory-row__meta" }, Mp = ["data-memory-type"], Rp = { key: 0 }, Tp = ["title"], $p = {
  key: 1,
  class: "ox-memory-library-empty"
}, Ap = { class: "ox-memory-library-reader" }, Ip = { class: "ox-memory-library-document-top" }, Ep = { key: 0 }, Pp = { class: "ox-memory-library-field ox-vite-field" }, Dp = ["disabled", "placeholder"], Op = {
  key: 0,
  class: "ox-memory-library-field ox-vite-field"
}, Vp = ["disabled", "placeholder"], Lp = { class: "ox-memory-library-field ox-vite-field" }, Fp = ["disabled", "placeholder"], Np = {
  class: "ox-memory-library-details",
  "data-memory-section": "draft-options"
}, jp = { class: "ox-memory-library-options" }, Wp = { class: "ox-memory-library-field ox-vite-field" }, Bp = ["disabled", "placeholder"], Up = { class: "ox-memory-library-field ox-vite-field" }, Kp = ["disabled", "placeholder"], qp = { class: "ox-memory-library-field ox-vite-field" }, Hp = ["disabled"], zp = {
  key: 1,
  class: "ox-memory-library-field ox-vite-field"
}, Yp = ["disabled"], Gp = {
  key: 2,
  class: "ox-memory-library-notice is-error",
  role: "alert"
}, Qp = { class: "ox-memory-library-editor-footer" }, Xp = ["disabled"], Jp = ["disabled"], Zp = { class: "ox-memory-library-document-top" }, ef = ["title"], tf = { class: "ox-memory-library-document-actions ox-vite-memory-header-actions" }, sf = ["disabled", "title"], nf = ["disabled", "title"], lf = { class: "ox-memory-library-document-meta" }, af = ["data-memory-type"], of = { key: 0 }, rf = {
  key: 0,
  class: "ox-memory-library-tags"
}, uf = ["innerHTML"], cf = {
  class: "ox-memory-library-details",
  "data-memory-section": "access"
}, df = { class: "ox-memory-library-facts" }, pf = ["title"], ff = ["disabled"], vf = {
  class: "ox-memory-library-details",
  "data-memory-section": "history"
}, gf = {
  key: 0,
  class: "ox-memory-library-version-list"
}, mf = {
  key: 0,
  class: "ox-memory-library-current"
}, yf = ["title"], hf = ["disabled", "onClick"], _f = {
  key: 1,
  class: "ox-memory-library-muted"
}, bf = {
  key: 2,
  class: "ox-memory-library-empty is-reader"
}, xf = ["disabled"], kf = {
  class: "ox-memory-library-details ox-memory-library-runtime",
  "data-memory-section": "runtime"
}, Sf = { class: "ox-memory-library-runtime-body" }, wf = ["disabled", "title"], Cf = { class: "ox-memory-library-facts" }, Mf = { key: 0 }, Rf = { key: 1 }, Tf = { key: 2 }, $f = { key: 3 }, Af = { key: 4 }, If = { key: 5 }, Ef = ["data-status", "aria-busy"], Pf = { class: "ox-memory-library-ollama-heading" }, Df = { class: "ox-memory-library-ollama-kicker" }, Of = { class: "ox-memory-library-ollama-actions" }, Vf = { class: "ox-memory-library-ollama-status" }, Lf = ["disabled", "aria-label", "title"], Ff = {
  key: 0,
  class: "ox-memory-library-ollama-models"
}, Nf = {
  key: 1,
  class: "ox-memory-library-muted"
}, jf = {
  key: 2,
  class: "ox-memory-library-muted"
}, Wf = {
  key: 3,
  class: "ox-memory-library-notice is-error"
}, Bf = {
  key: 4,
  class: "ox-memory-library-notice is-error"
}, Uf = {
  key: 0,
  class: "ox-memory-library-failures"
}, Kf = {
  __name: "MemoryLibrary",
  props: {
    memory: { type: Object, default: () => ({}) },
    bridge: { type: Object, required: !0 },
    isZh: { type: Boolean, default: !0 }
  },
  emits: ["refresh"],
  setup(e, { expose: t, emit: n }) {
    const a = e, o = n, i = (E, D) => a.isZh ? E : D, p = qo(typeof window > "u" ? void 0 : window.markdownit), f = /* @__PURE__ */ pe(""), g = /* @__PURE__ */ pe(""), m = /* @__PURE__ */ pe(!1), h = /* @__PURE__ */ pe(!1), R = /* @__PURE__ */ pe(""), b = /* @__PURE__ */ pe(""), A = /* @__PURE__ */ pe(!1), B = /* @__PURE__ */ pe("create"), J = /* @__PURE__ */ pe(""), G = /* @__PURE__ */ pe(ce()), $ = /* @__PURE__ */ pe(null), Q = /* @__PURE__ */ pe(null), ae = se(() => a.memory.items || []), w = se(() => a.memory.selectedMemory || null), _e = se(() => [...a.memory.history || []].sort((E, D) => Number(D.version) - Number(E.version))), ye = se(() => a.memory.available !== !1), ne = se(() => h.value || !!a.memory.loading), Ce = se(() => !!w.value && !!a.memory.actorAgent && w.value.ownerAgent === a.memory.actorAgent), ke = se(() => ne.value || A.value), Z = se(() => A.value && J.value !== String(a.memory.actorAgent || "")), Me = se(() => !ne.value && !Z.value && !!G.value.title.trim() && !!G.value.content.trim() && (B.value === "edit" || !!G.value.taskId.trim())), ie = se(() => (w.value?.tags || []).filter((E) => !String(E).startsWith("memory-type:"))), k = se(() => a.memory.integrity), H = se(() => a.memory.status || {}), ve = se(() => a.memory.ollama || {}), be = se(() => ve.value.status || null), he = se(() => Array.isArray(be.value?.models) ? be.value.models : []), le = se(() => ve.value.loading ? "checking" : be.value ? be.value.status === "ready" && he.value.length ? "ready" : be.value.status === "ready" ? "empty" : be.value.status === "blocked" ? "blocked" : "offline" : ve.value.attempted ? "unavailable" : "unknown"), Le = se(() => ({
      checking: i("检测中", "Checking"),
      ready: i("已连接", "Connected"),
      empty: i("无本地模型", "No local models"),
      offline: i("服务未启动", "Service offline"),
      blocked: i("响应无效", "Invalid response"),
      unavailable: i("桌面桥接不可用", "Desktop bridge unavailable"),
      unknown: i("尚未检测", "Not checked")
    })[le.value] || i("未知", "Unknown")), Fe = se(() => ({ ready: "ready", checking: "checking", empty: "warning", offline: "muted", blocked: "error", unavailable: "muted", unknown: "muted" })[le.value] || "muted"), Te = se(() => R.value || a.memory.error || ""), $e = se(() => {
      if (!k.value) return i("尚未校验", "Not verified yet");
      if (!k.value.healthy) return i("完整性校验发现异常", "Integrity verification found problems");
      const E = a.memory.recovery;
      return E?.source === "bundled-transfer" && Number(E.importedVersions) > 0 ? i(`已恢复 ${E.importedVersions} 个可信版本，记录链与审计链完整`, `${E.importedVersions} trusted versions restored; record and audit chains are healthy`) : E?.source === "competition-history" && Number(E.reconciledMemories) > 0 ? i(`已同步 ${E.reconciledMemories} 条完成记录，记录链与审计链完整`, `${E.reconciledMemories} completed workflows synchronized; record and audit chains are healthy`) : i(`已校验 ${k.value.checkedVersions ?? 0} 个版本，记录链与审计链完整`, `${k.value.checkedVersions ?? 0} versions verified; record and audit chains are healthy`);
    });
    Gt(() => [String(a.memory.actorAgent || ""), String(a.memory.query || ""), !!a.memory.includeRetired], (E, D = []) => {
      A.value || h.value || [f, g, m].forEach((L, ge) => {
        (D[ge] === void 0 || L.value === D[ge]) && (L.value = E[ge]);
      });
    }, { immediate: !0 });
    function ce() {
      return { memoryId: "", baseVersion: 0, taskId: "", title: "", content: "", qualityScore: 0.8, permissionsText: "", tagsText: "", reason: "" };
    }
    function O(E) {
      return [...new Set(String(E || "").split(/[,，\n]/).map((D) => D.trim()).filter(Boolean))];
    }
    async function M(E, D = !0) {
      if (ne.value) return { ok: !1 };
      h.value = !0, R.value = "", b.value = "";
      try {
        const L = await E();
        return D && o("refresh"), { ok: !0, result: L };
      } catch (L) {
        return R.value = String(L?.message || i("操作失败，请重试。", "The operation failed. Please retry.")), { ok: !1 };
      } finally {
        h.value = !1;
      }
    }
    async function V() {
      await Bs(), $.value?.focus();
    }
    function Se() {
      !ye.value || ne.value || A.value || (B.value = "create", G.value = ce(), J.value = String(a.memory.actorAgent || ""), R.value = "", b.value = "", A.value = !0, V());
    }
    function He() {
      if (!Ce.value || ne.value || A.value) return;
      const E = w.value;
      B.value = "edit", G.value = {
        memoryId: String(E.memoryId || ""),
        baseVersion: Number(E.version || 0),
        taskId: String(E.taskId || ""),
        title: String(E.title || ""),
        content: String(E.content || ""),
        qualityScore: Number(E.qualityScore ?? 0.8),
        permissionsText: (E.permissions || []).join(", "),
        tagsText: (E.tags || []).join(", "),
        reason: ""
      }, J.value = String(a.memory.actorAgent || ""), R.value = "", b.value = "", A.value = !0, V();
    }
    function tt() {
      ne.value || (A.value = !1, R.value = "", f.value = String(a.memory.actorAgent || ""));
    }
    async function ze() {
      if (!Me.value) return;
      const E = G.value, D = {
        memoryId: E.memoryId,
        baseVersion: E.baseVersion,
        taskId: E.taskId.trim(),
        title: E.title.trim(),
        content: E.content.trim(),
        qualityScore: Number(E.qualityScore ?? 0.8),
        permissions: O(E.permissionsText),
        tags: O(E.tagsText),
        reason: E.reason.trim()
      };
      (await M(() => B.value === "edit" ? a.bridge.editSynapxnetMemory(D) : a.bridge.createSynapxnetMemory(D))).ok && (A.value = !1, b.value = i("记忆已保存。", "Memory saved."));
    }
    async function Ke() {
      ke.value || !ye.value || await M(() => a.bridge.loadSynapxnetMemories({ actorAgent: f.value, query: g.value, includeRetired: m.value }));
    }
    async function y(E) {
      ke.value || E === a.memory.selectedMemoryId || await M(() => a.bridge.selectSynapxnetMemory(E));
    }
    async function x(E) {
      if (!Ce.value || ne.value || A.value || Number(E.version) === Number(w.value.version)) return;
      const D = w.value;
      if (!window.confirm(i(`确认从 v${E.version} 创建一个新的回滚版本？历史版本不会被覆盖。`, `Create a new rollback version from v${E.version}? Existing history will remain unchanged.`))) return;
      (await M(() => a.bridge.rollbackSynapxnetMemory(D.memoryId, E.version, i("用户从版本时间线回滚", "User rollback from version timeline")))).ok && (b.value = i("已创建回滚版本。", "Rollback version created."));
    }
    async function T() {
      if (!Ce.value || ne.value || A.value || w.value.status === "RETIRED") return;
      const E = w.value;
      if (!window.confirm(i("确认退役当前记忆？历史版本仍会保留。", "Retire this memory? Its version history will be preserved."))) return;
      (await M(() => a.bridge.retireSynapxnetMemory(E.memoryId))).ok && (b.value = i("记忆已退役，历史版本已保留。", "Memory retired; its version history is preserved."));
    }
    async function N() {
      if (!ye.value) return;
      const E = await M(() => a.bridge.verifySynapxnetMemory(""));
      E.ok && (b.value = E.result?.healthy ? i("完整性校验通过。", "Integrity verification passed.") : i("完整性校验发现异常，请查看运行状态。", "Integrity verification found problems. See runtime status."));
    }
    async function C() {
      if (!(ne.value || typeof a.bridge.detectApplicationOllama != "function")) {
        h.value = !0, R.value = "", b.value = "";
        try {
          await a.bridge.detectApplicationOllama(!0), o("refresh"), b.value = i("已重新检测本机 Ollama。", "Local Ollama was checked again.");
        } catch (E) {
          R.value = String(E?.message || i("Ollama 检测失败，请重试。", "Ollama detection failed. Please retry."));
        } finally {
          h.value = !1;
        }
      }
    }
    async function F() {
      if (!w.value || ne.value) return;
      const E = w.value.memoryId;
      await M(async () => {
        const D = await a.bridge.exportSynapxnetMemories([E]), L = URL.createObjectURL(new Blob([JSON.stringify(D, null, 2)], { type: "application/json;charset=utf-8" })), ge = window.document.createElement("a");
        try {
          ge.href = L, ge.download = `openxnet-memory-${E.slice(0, 12)}.json`, ge.hidden = !0, window.document.body.appendChild(ge), ge.click(), b.value = i("已交给浏览器下载。", "Sent to the browser for download.");
        } finally {
          ge.remove(), window.setTimeout(() => URL.revokeObjectURL(L), 1e3);
        }
      }, !1);
    }
    function ee() {
      ke.value || !ye.value || Q.value?.click();
    }
    async function X(E) {
      const D = E.target, L = D.files?.[0];
      if (!L || ke.value || !ye.value) {
        D.value = "";
        return;
      }
      const ge = await M(async () => {
        const Re = JSON.parse(await L.text());
        return a.bridge.importSynapxnetMemories(Re);
      });
      D.value = "", ge.ok && (b.value = i("记忆导入完成。", "Memory import completed."));
    }
    function Y(E) {
      if (!E) return "—";
      const D = new Date(E);
      return Number.isNaN(D.getTime()) ? "—" : D.toLocaleString(a.isZh ? "zh-CN" : "en-US");
    }
    function j(E) {
      const D = String(E || "");
      return D ? `${D.slice(0, 8)}…${D.slice(-6)}` : "—";
    }
    function re(E) {
      return { skill: i("技能记忆", "Skill"), incident: i("事件记忆", "Incident"), collaboration: i("协作记忆", "Collaboration"), decision: i("决策记忆", "Decision"), manual: i("人工记忆", "Manual") }[E] || i("人工记忆", "Manual");
    }
    function te(E) {
      return { CREATE: i("创建", "Created"), EDIT: i("编辑", "Edited"), ROLLBACK: i("回滚", "Rollback"), RETIRE: i("退役", "Retired"), IMPORT: i("导入", "Imported") }[String(E).toUpperCase()] || E;
    }
    function oe(E) {
      const D = Number(E);
      if (!Number.isFinite(D) || D <= 0) return "";
      const L = ["B", "KB", "MB", "GB", "TB"];
      let ge = 0, Re = D;
      for (; Re >= 1024 && ge < L.length - 1; )
        Re /= 1024, ge += 1;
      return `${Re >= 10 || ge === 0 ? Re.toFixed(0) : Re.toFixed(1)} ${L[ge]}`;
    }
    return t({ openCreate: Se }), (E, D) => (u(), c("section", {
      class: "ox-memory-library",
      "aria-label": i("原生记忆", "Native memory"),
      "aria-busy": ne.value
    }, [
      s("div", Zd, [
        s("label", ep, [
          D[10] || (D[10] = s("i", {
            class: "fa-regular fa-user",
            "aria-hidden": "true"
          }, null, -1)),
          je(s("select", {
            "onUpdate:modelValue": D[0] || (D[0] = (L) => f.value = L),
            "aria-label": i("记忆身份", "Memory identity"),
            disabled: ke.value || !ye.value,
            onChange: Ke
          }, [
            f.value ? P("", !0) : (u(), c("option", sp, l(i("选择身份", "Choose an identity")), 1)),
            (u(!0), c(I, null, U(e.memory.agentOptions || [], (L) => (u(), c("option", {
              key: L.id,
              value: L.id
            }, l(L.name), 9, np))), 128))
          ], 40, tp), [
            [Po, f.value]
          ])
        ]),
        s("label", lp, [
          D[11] || (D[11] = s("i", {
            class: "fa-solid fa-magnifying-glass",
            "aria-hidden": "true"
          }, null, -1)),
          je(s("input", {
            "onUpdate:modelValue": D[1] || (D[1] = (L) => g.value = L),
            type: "search",
            "aria-label": i("搜索记忆", "Search memories"),
            placeholder: i("搜索标题、内容、任务或标签", "Search title, content, task, or tags"),
            disabled: !ye.value,
            onKeyup: Ru(Ke, ["enter"])
          }, null, 40, ap), [
            [Qe, g.value]
          ])
        ]),
        s("button", {
          class: "ox-memory-library-button is-primary",
          type: "button",
          disabled: ke.value || !ye.value,
          onClick: Se
        }, [
          D[12] || (D[12] = s("i", {
            class: "fa-solid fa-plus",
            "aria-hidden": "true"
          }, null, -1)),
          de(l(i("新建记忆", "New Memory")), 1)
        ], 8, op)
      ]),
      s("div", ip, [
        s("span", null, [
          de(l(i("可见记忆", "Visible memories")) + " ", 1),
          s("strong", null, l(ae.value.length), 1)
        ]),
        H.value.tiers?.longTerm ? (u(), c("span", rp, l(i("总版本", "Total versions")) + " " + l(H.value.tiers.longTerm.versions), 1)) : P("", !0),
        H.value.auditEvents !== void 0 ? (u(), c("span", up, l(i("审计", "Audit events")) + " " + l(H.value.auditEvents), 1)) : P("", !0),
        ne.value ? (u(), c("span", cp, l(i("正在处理…", "Working…")), 1)) : P("", !0),
        s("div", dp, [
          s("label", pp, [
            je(s("input", {
              "onUpdate:modelValue": D[2] || (D[2] = (L) => m.value = L),
              type: "checkbox",
              disabled: ke.value || !ye.value,
              onChange: Ke
            }, null, 40, fp), [
              [Pl, m.value]
            ]),
            de(l(i("显示已退役", "Show retired")), 1)
          ]),
          s("button", {
            type: "button",
            class: "ox-memory-library-text-button",
            disabled: ke.value || !ye.value,
            title: i("导入记忆", "Import memory"),
            onClick: ee
          }, l(i("导入", "Import")), 9, vp),
          s("button", {
            type: "button",
            class: "ox-memory-library-icon-button",
            disabled: ke.value || !ye.value,
            "aria-label": i("刷新", "Refresh"),
            title: i("刷新", "Refresh"),
            onClick: Ke
          }, [...D[13] || (D[13] = [
            s("i", {
              class: "fa-solid fa-rotate-right",
              "aria-hidden": "true"
            }, null, -1)
          ])], 8, gp)
        ]),
        s("input", {
          ref_key: "importInput",
          ref: Q,
          class: "ox-memory-library-file-input",
          type: "file",
          accept: ".json,application/json",
          onChange: X
        }, null, 544)
      ]),
      Te.value ? (u(), c("p", mp, [
        D[14] || (D[14] = s("i", {
          class: "fa-solid fa-circle-exclamation",
          "aria-hidden": "true"
        }, null, -1)),
        de(l(Te.value), 1)
      ])) : ye.value ? P("", !0) : (u(), c("p", yp, l(i("记忆服务尚未连接，连接后可查看和管理记忆。", "The memory service is not connected. Connect it to view and manage memories.")), 1)),
      k.value && !k.value.healthy ? (u(), c("p", hp, l($e.value), 1)) : P("", !0),
      b.value ? (u(), c("p", _p, l(b.value), 1)) : P("", !0),
      s("div", bp, [
        s("aside", {
          class: "ox-memory-library-index",
          "aria-label": i("记忆列表", "Memory list")
        }, [
          ae.value.length ? (u(), c("div", kp, [
            (u(!0), c(I, null, U(ae.value, (L) => (u(), c("button", {
              key: L.memoryId,
              type: "button",
              class: q(["ox-memory-library-row ox-vite-memory-row", { active: e.memory.selectedMemoryId === L.memoryId }]),
              "aria-pressed": e.memory.selectedMemoryId === L.memoryId,
              disabled: ke.value,
              onClick: (ge) => y(L.memoryId)
            }, [
              s("div", wp, [
                s("strong", null, l(L.title), 1)
              ]),
              s("p", null, l(L.contentPreview || i("暂无摘要", "No preview")), 1),
              s("div", Cp, [
                s("span", {
                  class: "ox-memory-library-type",
                  "data-memory-type": L.memoryType
                }, l(re(L.memoryType)), 9, Mp),
                s("span", null, "v" + l(L.version), 1),
                L.status === "RETIRED" ? (u(), c("span", Rp, l(i("已退役", "Retired")), 1)) : P("", !0)
              ]),
              s("span", {
                class: "ox-memory-library-owner",
                title: L.ownerAgent
              }, l(L.ownerAgent), 9, Tp)
            ], 10, Sp))), 128))
          ])) : (u(), c("div", $p, [
            D[15] || (D[15] = s("i", {
              class: "fa-regular fa-folder-open",
              "aria-hidden": "true"
            }, null, -1)),
            s("strong", null, l(ne.value ? i("正在读取记忆…", "Loading memories…") : g.value ? i("没有找到匹配的记忆", "No matching memories") : i("还没有可见记忆", "No visible memories yet")), 1),
            s("p", null, l(g.value ? i("试试其他关键词，按回车搜索。", "Try another keyword and press Enter.") : i("选择其他身份，或创建第一条记忆。", "Choose another identity or create your first memory.")), 1)
          ]))
        ], 8, xp),
        s("div", Ap, [
          A.value ? (u(), c("form", {
            key: 0,
            class: "ox-memory-library-editor ox-vite-memory-form",
            onSubmit: Ot(ze, ["prevent"])
          }, [
            s("div", Ip, [
              s("span", null, l(B.value === "edit" ? i("编辑为新版本", "Edit as a new version") : i("新建长期记忆", "New long-term memory")), 1),
              B.value === "edit" ? (u(), c("span", Ep, "v" + l(G.value.baseVersion) + " → v" + l(G.value.baseVersion + 1), 1)) : P("", !0)
            ]),
            s("label", Pp, [
              s("span", null, l(i("标题", "Title")), 1),
              je(s("input", {
                ref_key: "titleInput",
                ref: $,
                "onUpdate:modelValue": D[3] || (D[3] = (L) => G.value.title = L),
                type: "text",
                required: "",
                disabled: ne.value,
                placeholder: i("给这条记忆一个清楚的标题", "Give this memory a clear title")
              }, null, 8, Dp), [
                [Qe, G.value.title]
              ])
            ]),
            B.value === "create" ? (u(), c("label", Op, [
              s("span", null, l(i("任务标识", "Task ID")), 1),
              je(s("input", {
                "onUpdate:modelValue": D[4] || (D[4] = (L) => G.value.taskId = L),
                type: "text",
                required: "",
                disabled: ne.value,
                placeholder: i("关联的任务 ID", "Associated task ID")
              }, null, 8, Vp), [
                [Qe, G.value.taskId]
              ])
            ])) : P("", !0),
            s("label", Lp, [
              s("span", null, [
                de(l(i("记忆内容", "Memory Content")), 1),
                D[16] || (D[16] = s("small", null, "Markdown", -1))
              ]),
              je(s("textarea", {
                "onUpdate:modelValue": D[5] || (D[5] = (L) => G.value.content = L),
                rows: "12",
                required: "",
                disabled: ne.value,
                placeholder: i("记录事实、决策或可复用的经验…", "Capture facts, decisions, or reusable knowledge…")
              }, null, 8, Fp), [
                [Qe, G.value.content]
              ])
            ]),
            s("details", Np, [
              s("summary", null, l(i("共享、标签与质量", "Sharing, tags, and quality")), 1),
              s("div", jp, [
                s("label", Wp, [
                  s("span", null, l(i("共享 Agent", "Shared Agents")), 1),
                  je(s("input", {
                    "onUpdate:modelValue": D[6] || (D[6] = (L) => G.value.permissionsText = L),
                    type: "text",
                    disabled: ne.value,
                    placeholder: i("用逗号分隔，* 表示公开", "Comma-separated; * means public")
                  }, null, 8, Bp), [
                    [Qe, G.value.permissionsText]
                  ]),
                  s("small", null, l(i("留空时仅所有者可见。", "Leave empty for owner-only access.")), 1)
                ]),
                s("label", Up, [
                  s("span", null, l(i("标签", "Tags")), 1),
                  je(s("input", {
                    "onUpdate:modelValue": D[7] || (D[7] = (L) => G.value.tagsText = L),
                    type: "text",
                    disabled: ne.value,
                    placeholder: i("用逗号分隔", "Comma-separated")
                  }, null, 8, Kp), [
                    [Qe, G.value.tagsText]
                  ])
                ]),
                s("label", qp, [
                  s("span", null, [
                    de(l(i("质量评分", "Quality Score")) + " ", 1),
                    s("output", null, l(Number(G.value.qualityScore).toFixed(2)), 1)
                  ]),
                  je(s("input", {
                    "onUpdate:modelValue": D[8] || (D[8] = (L) => G.value.qualityScore = L),
                    type: "range",
                    min: "0",
                    max: "1",
                    step: "0.05",
                    disabled: ne.value
                  }, null, 8, Hp), [
                    [
                      Qe,
                      G.value.qualityScore,
                      void 0,
                      { number: !0 }
                    ]
                  ])
                ])
              ])
            ]),
            B.value === "edit" ? (u(), c("label", zp, [
              s("span", null, [
                de(l(i("修改原因", "Change Reason")), 1),
                s("small", null, l(i("可选", "Optional")), 1)
              ]),
              je(s("input", {
                "onUpdate:modelValue": D[9] || (D[9] = (L) => G.value.reason = L),
                type: "text",
                disabled: ne.value
              }, null, 8, Yp), [
                [Qe, G.value.reason]
              ])
            ])) : P("", !0),
            Z.value ? (u(), c("p", Gp, l(i("当前身份已变化，草稿已保留。请恢复原身份后提交，或取消编辑。", "The current identity changed. Your draft is retained. Restore the original identity to save, or cancel editing.")), 1)) : P("", !0),
            s("div", Qp, [
              s("span", null, l(i("保存后保留完整版本记录", "Saving preserves the version history")), 1),
              s("div", null, [
                s("button", {
                  type: "button",
                  class: "ox-memory-library-button",
                  disabled: ne.value,
                  onClick: tt
                }, l(i("取消", "Cancel")), 9, Xp),
                s("button", {
                  type: "submit",
                  class: "ox-memory-library-button is-primary",
                  disabled: !Me.value
                }, l(ne.value ? i("正在保存…", "Saving…") : i("提交版本", "Commit Version")), 9, Jp)
              ])
            ])
          ], 32)) : w.value ? (u(), c("article", {
            key: w.value.memoryId,
            class: "ox-memory-library-document ox-vite-memory-document"
          }, [
            s("div", Zp, [
              s("span", {
                title: w.value.taskId
              }, l(w.value.taskId), 9, ef),
              s("div", tf, [
                s("button", {
                  type: "button",
                  class: "ox-memory-library-text-button",
                  disabled: ne.value,
                  title: i("导出迁移包", "Export transfer package"),
                  onClick: F
                }, l(i("导出", "Export")), 9, sf),
                Ce.value ? (u(), c("button", {
                  key: 0,
                  type: "button",
                  class: "ox-memory-library-button",
                  disabled: ne.value,
                  title: i("编辑", "Edit"),
                  onClick: He
                }, [
                  D[17] || (D[17] = s("i", {
                    class: "fa-solid fa-pen",
                    "aria-hidden": "true"
                  }, null, -1)),
                  de(l(i("编辑", "Edit")), 1)
                ], 8, nf)) : P("", !0)
              ])
            ]),
            s("h2", null, l(w.value.title), 1),
            s("div", lf, [
              s("span", {
                class: "ox-memory-library-type",
                "data-memory-type": w.value.memoryType
              }, l(re(w.value.memoryType)), 9, af),
              s("span", null, "v" + l(w.value.version), 1),
              w.value.status === "RETIRED" ? (u(), c("span", of, l(i("已退役", "Retired")), 1)) : P("", !0),
              s("span", null, l(Y(w.value.committedAtUtc)), 1)
            ]),
            ie.value.length ? (u(), c("div", rf, [
              (u(!0), c(I, null, U(ie.value, (L) => (u(), c("span", { key: L }, l(L), 1))), 128))
            ])) : P("", !0),
            s("div", {
              class: "ox-memory-library-prose ox-ops-memory-prose",
              innerHTML: ys(p)(w.value.content)
            }, null, 8, uf),
            s("details", cf, [
              s("summary", null, [
                de(l(i("共享与记录信息", "Sharing and record details")), 1),
                s("span", null, l((w.value.permissions || []).includes("*") ? i("公开", "Public") : (w.value.permissions || []).length ? i("指定身份可见", "Shared with selected identities") : i("仅所有者", "Owner only")), 1)
              ]),
              s("dl", df, [
                s("div", null, [
                  s("dt", null, l(i("所有者", "Owner")), 1),
                  s("dd", null, l(w.value.ownerAgent), 1)
                ]),
                s("div", null, [
                  s("dt", null, l(i("共享范围", "Shared with")), 1),
                  s("dd", null, l((w.value.permissions || []).join(", ") || i("仅所有者", "Owner only")), 1)
                ]),
                s("div", null, [
                  s("dt", null, l(i("记录哈希", "Record hash")), 1),
                  s("dd", {
                    title: w.value.recordSha256
                  }, l(j(w.value.recordSha256)), 9, pf)
                ]),
                s("div", null, [
                  s("dt", null, l(i("提交时间", "Committed")), 1),
                  s("dd", null, l(Y(w.value.committedAtUtc)), 1)
                ]),
                s("div", null, [
                  s("dt", null, l(i("质量评分", "Quality score")), 1),
                  s("dd", null, l(Number(w.value.qualityScore ?? 0).toFixed(2)), 1)
                ])
              ]),
              Ce.value && w.value.status !== "RETIRED" ? (u(), c("button", {
                key: 0,
                type: "button",
                class: "ox-memory-library-text-button is-danger",
                disabled: ne.value,
                onClick: T
              }, l(i("退役记忆", "Retire Memory")), 9, ff)) : P("", !0)
            ]),
            s("details", vf, [
              s("summary", null, [
                de(l(i("版本历史", "Version history")), 1),
                s("span", null, l(_e.value.length), 1)
              ]),
              _e.value.length ? (u(), c("div", gf, [
                (u(!0), c(I, null, U(_e.value, (L) => (u(), c("article", {
                  key: L.recordSha256 || L.version,
                  class: "ox-memory-library-version"
                }, [
                  s("div", null, [
                    s("strong", null, "v" + l(L.version), 1),
                    s("span", null, l(te(L.operation)), 1),
                    Number(L.version) === Number(w.value.version) ? (u(), c("span", mf, l(i("当前", "Current")), 1)) : P("", !0)
                  ]),
                  s("time", null, l(Y(L.committedAtUtc)), 1),
                  s("small", {
                    title: L.recordSha256
                  }, l(j(L.recordSha256)), 9, yf),
                  Ce.value && Number(L.version) !== Number(w.value.version) ? (u(), c("button", {
                    key: 0,
                    type: "button",
                    class: "ox-memory-library-text-button ox-vite-memory-version__rollback",
                    disabled: ne.value,
                    onClick: (ge) => x(L)
                  }, l(i("回滚至此版本", "Rollback to this version")), 9, hf)) : P("", !0)
                ]))), 128))
              ])) : (u(), c("p", _f, l(i("暂无版本记录", "No version history")), 1))
            ])
          ])) : (u(), c("div", bf, [
            D[18] || (D[18] = s("i", {
              class: "fa-regular fa-file-lines",
              "aria-hidden": "true"
            }, null, -1)),
            s("strong", null, l(i("让经验留下来", "Keep what you learn")), 1),
            s("p", null, l(i("选择一条记忆阅读，或新建记忆记录经验。", "Select a memory to read, or create one to capture what you learn.")), 1),
            s("button", {
              type: "button",
              class: "ox-memory-library-button",
              disabled: ne.value || !ye.value,
              onClick: Se
            }, l(i("新建记忆", "New Memory")), 9, xf)
          ]))
        ])
      ]),
      s("details", kf, [
        s("summary", null, [
          de(l(i("运行状态与完整性", "Runtime and integrity")), 1),
          s("span", null, l(k.value ? k.value.healthy ? i("校验通过", "Verified") : i("需要检查", "Needs review") : i("尚未校验", "Not verified")), 1)
        ]),
        s("div", Sf, [
          s("p", null, l($e.value), 1),
          s("button", {
            type: "button",
            class: "ox-memory-library-button",
            disabled: ne.value || !ye.value,
            title: i("校验完整性", "Verify integrity"),
            onClick: N
          }, [
            D[19] || (D[19] = s("i", {
              class: "fa-solid fa-shield-halved",
              "aria-hidden": "true"
            }, null, -1)),
            de(l(i("校验完整性", "Verify integrity")), 1)
          ], 8, wf)
        ]),
        s("dl", Cf, [
          H.value.frameworkVersion ? (u(), c("div", Mf, [
            s("dt", null, l(i("记忆版本", "Memory runtime")), 1),
            s("dd", null, l(H.value.frameworkVersion), 1)
          ])) : P("", !0),
          H.value.tiers?.longTerm ? (u(), c("div", Rf, [
            s("dt", null, l(i("长期记忆", "Long-term memories")), 1),
            s("dd", null, l(H.value.tiers.longTerm.memories), 1)
          ])) : P("", !0),
          H.value.sharedVersions !== void 0 ? (u(), c("div", Tf, [
            s("dt", null, l(i("共享版本", "Shared versions")), 1),
            s("dd", null, l(H.value.sharedVersions), 1)
          ])) : P("", !0),
          H.value.tiers?.activeNative ? (u(), c("div", $f, [
            s("dt", null, l(i("活跃会话", "Active sessions")), 1),
            s("dd", null, l(H.value.tiers.activeNative.sessions), 1)
          ])) : P("", !0),
          H.value.tiers?.shortTerm ? (u(), c("div", Af, [
            s("dt", null, l(i("短期事件", "Short-term events")), 1),
            s("dd", null, l(H.value.tiers.shortTerm.events), 1)
          ])) : P("", !0),
          H.value.auditEvents !== void 0 ? (u(), c("div", If, [
            s("dt", null, l(i("审计事件", "Audit events")), 1),
            s("dd", null, l(H.value.auditEvents), 1)
          ])) : P("", !0)
        ]),
        s("section", {
          class: "ox-memory-library-ollama",
          "data-memory-ollama-status": "",
          "data-status": Fe.value,
          "aria-busy": ve.value.loading
        }, [
          s("div", Pf, [
            s("div", null, [
              s("span", Df, [
                D[20] || (D[20] = s("i", {
                  class: "fa-solid fa-microchip",
                  "aria-hidden": "true"
                }, null, -1)),
                de(l(i("可选本地模型增强", "Optional local model enhancement")), 1)
              ]),
              s("strong", null, l(i("Ollama 服务", "Ollama service")), 1),
              s("p", null, l(i("Memory V3 账本独立运行；Ollama 可用于本地摘要、重排或推理。", "The Memory V3 ledger runs independently; Ollama can provide local summarization, reranking, or inference.")), 1)
            ]),
            s("div", Of, [
              s("span", Vf, [
                D[21] || (D[21] = s("i", {
                  class: "fa-solid fa-circle",
                  "aria-hidden": "true"
                }, null, -1)),
                de(l(Le.value), 1)
              ]),
              s("button", {
                type: "button",
                class: "ox-memory-library-icon-button",
                disabled: ne.value,
                "aria-label": i("重新检测 Ollama", "Recheck Ollama"),
                title: i("重新检测 Ollama", "Recheck Ollama"),
                onClick: C
              }, [
                s("i", {
                  class: q(["fa-solid fa-rotate-right", { "fa-spin": ve.value.loading }]),
                  "aria-hidden": "true"
                }, null, 2)
              ], 8, Lf)
            ])
          ]),
          be.value?.status === "ready" && he.value.length ? (u(), c("div", Ff, [
            (u(!0), c(I, null, U(he.value, (L) => (u(), c("div", {
              key: L.name,
              class: "ox-memory-library-ollama-model"
            }, [
              D[22] || (D[22] = s("i", {
                class: "fa-solid fa-cube",
                "aria-hidden": "true"
              }, null, -1)),
              s("span", null, [
                s("strong", null, l(L.name), 1),
                s("small", null, [
                  de(l(oe(L.sizeBytes) || i("本地模型", "Local model")), 1),
                  L.modifiedAt ? (u(), c(I, { key: 0 }, [
                    de(" · " + l(Y(L.modifiedAt)), 1)
                  ], 64)) : P("", !0)
                ])
              ])
            ]))), 128))
          ])) : le.value === "empty" ? (u(), c("p", Nf, l(i("Ollama 已连接，但尚未安装模型。可先运行 ollama pull，再重新检测。", "Ollama is reachable but has no installed models. Run ollama pull, then check again.")), 1)) : le.value === "offline" ? (u(), c("p", jf, l(i("未发现本机 Ollama 服务。启动 Ollama 后点击重新检测；这不会影响 Memory V3 账本。", "Ollama is not running locally. Start Ollama and check again; the Memory V3 ledger is unaffected.")), 1)) : le.value === "blocked" ? (u(), c("p", Wf, l(i("Ollama 返回的数据格式无法确认，请检查服务版本后重试。", "Ollama returned an invalid response. Check the service version and retry.")), 1)) : ve.value.error ? (u(), c("p", Bf, l(ve.value.error), 1)) : P("", !0)
        ], 8, Ef),
        k.value?.failures?.length ? (u(), c("ul", Uf, [
          (u(!0), c(I, null, U(k.value.failures, (L) => (u(), c("li", {
            key: `${L.memoryId}:${L.version}:${L.reason}`
          }, l(L.memoryId) + " · v" + l(L.version) + " · " + l(L.reason), 1))), 128))
        ])) : P("", !0)
      ])
    ], 8, Jd));
  }
}, qf = /* @__PURE__ */ Vl(Kf, [["__scopeId", "data-v-68172deb"]]), Hf = ["data-memory-view"], zf = { class: "ox-memory-workspace-navigation" }, Yf = ["aria-label"], Gf = ["aria-pressed"], Qf = ["aria-pressed"], Xf = ["aria-pressed"], Jf = { class: "ox-memory-workspace-scope" }, Zf = ["aria-busy"], ev = { class: "ox-context-toolbar" }, tv = { class: "ox-context-toolbar-actions" }, sv = {
  key: 0,
  class: "ox-context-agent"
}, nv = ["aria-label", "value"], lv = { value: "" }, av = ["value"], ov = ["disabled"], iv = {
  key: 0,
  class: "ox-context-alert",
  role: "alert"
}, rv = { class: "ox-context-columns" }, uv = { class: "ox-context-list" }, cv = { class: "ox-context-search" }, dv = ["aria-label", "placeholder"], pv = { class: "ox-context-list-heading" }, fv = {
  key: 0,
  class: "ox-context-items"
}, vv = ["data-context-session-id", "aria-pressed", "onClick"], gv = {
  key: 0,
  class: "ox-context-list-empty"
}, mv = {
  key: 1,
  class: "ox-context-items"
}, yv = ["data-context-task-id", "aria-pressed", "onClick"], hv = { class: "ox-context-item-icon" }, _v = {
  key: 0,
  class: "ox-context-list-empty"
}, bv = {
  key: 0,
  class: "ox-context-detail",
  "data-context-session-detail": ""
}, xv = { class: "ox-context-detail-heading" }, kv = {
  key: 0,
  class: "ox-context-badge"
}, Sv = { class: "ox-context-boundary" }, wv = {
  key: 0,
  class: "ox-context-alert",
  role: "alert"
}, Cv = {
  key: 1,
  class: "ox-context-messages"
}, Mv = ["data-context-message-id"], Rv = { class: "ox-context-message-meta" }, Tv = ["data-message-role"], $v = { key: 0 }, Av = ["innerHTML"], Iv = {
  key: 1,
  class: "ox-context-muted"
}, Ev = {
  key: 2,
  class: "ox-context-empty"
}, Pv = {
  key: 3,
  class: "ox-context-disclosure"
}, Dv = {
  key: 1,
  class: "ox-context-detail",
  "data-context-task-detail": ""
}, Ov = { class: "ox-context-detail-heading" }, Vv = {
  key: 0,
  class: "ox-context-badge"
}, Lv = {
  key: 0,
  class: "ox-context-alert",
  role: "alert"
}, Fv = {
  key: 0,
  class: "ox-context-muted"
}, Nv = {
  key: 1,
  class: "ox-context-boundary"
}, jv = { class: "ox-context-goal" }, Wv = ["innerHTML"], Bv = { key: 1 }, Uv = {
  key: 2,
  class: "ox-context-members"
}, Kv = { key: 0 }, qv = { class: "ox-context-trace" }, Hv = { class: "ox-context-section-heading" }, zv = { key: 0 }, Yv = ["data-context-event-id"], Gv = { key: 0 }, Qv = {
  key: 1,
  class: "ox-context-muted"
}, Xv = {
  key: 3,
  class: "ox-context-disclosure"
}, Jv = { key: 0 }, Zv = { key: 1 }, eg = {
  key: 4,
  class: "ox-context-disclosure"
}, tg = { class: "ox-context-boundary" }, sg = {
  key: 2,
  class: "ox-context-empty"
}, ng = {
  __name: "MemoryWorkspace",
  props: {
    memory: { type: Object, default: () => ({}) },
    bridge: { type: Object, required: !0 },
    isZh: { type: Boolean, default: !0 },
    active: { type: Boolean, default: !0 }
  },
  emits: ["refresh"],
  setup(e, { expose: t, emit: n }) {
    const a = e, o = n, i = /* @__PURE__ */ pe("native"), p = /* @__PURE__ */ pe(null), f = /* @__PURE__ */ pe({}), g = /* @__PURE__ */ pe(""), m = /* @__PURE__ */ pe(""), h = /* @__PURE__ */ pe(!1), R = qo(window.markdownit), b = (O, M) => a.isZh ? O : M, A = (O) => Array.isArray(O) ? O : [], B = se(() => A(f.value.sessions).filter((O) => ie(k(O)))), J = se(() => A(f.value.tasks).filter((O) => ie(H(O)))), G = se(() => f.value.session || {}), $ = se(() => f.value.task || {}), Q = se(() => !!$.value.id && !!$.value.source), ae = se(() => A(G.value.messages)), w = se(() => A($.value.events)), _e = se(() => A($.value.members)), ye = se(() => A($.value.evidenceRefs)), ne = se(() => A(f.value.recall?.observations)), Ce = se(() => i.value === "native" ? b("原生记忆库", "Native memory library") : i.value === "session" ? b("会话上下文", "Session context") : b("任务上下文", "Task context"));
    let ke, Z = !1, Me = 0;
    function ie(O) {
      return String(O || "").toLocaleLowerCase().includes(g.value.trim().toLocaleLowerCase());
    }
    function k(O) {
      return O.title || (O.isCurrent || A(f.value.sessions).some((M) => M.id === O.id && M.isCurrent) ? b("当前会话", "Current session") : b("未命名会话", "Untitled session"));
    }
    function H(O) {
      return O.title || (O.source === "incident" ? b("未命名事件", "Untitled incident") : b("未命名任务", "Untitled task"));
    }
    function ve() {
      Z || a.bridge.contextWorkspace && (f.value = a.bridge.contextWorkspace.snapshot());
    }
    async function be() {
      const O = ++Me;
      h.value = !0, m.value = "";
      try {
        if (!a.bridge.contextWorkspace) throw new Error(b("上下文资料暂不可用，请稍后刷新。", "Context is unavailable. Please refresh later."));
        await a.bridge.contextWorkspace.refresh();
      } catch (M) {
        !Z && O === Me && (m.value = String(M?.message || b("上下文读取失败", "Could not read context")));
      } finally {
        !Z && O === Me && (h.value = !1, ve());
      }
    }
    async function he(O) {
      if (i.value = O, g.value = "", m.value = "", ve(), O !== "native") {
        const M = f.value;
        O === "session" ? a.bridge.contextWorkspace?.selectSession(M.scope?.sessionId || A(M.sessions).find((V) => V.isCurrent)?.id || M.sessions?.[0]?.id || "") : a.bridge.contextWorkspace?.selectTask(M.scope?.taskId || M.tasks?.[0]?.id || ""), ve(), await be();
      }
    }
    async function le(O, M) {
      m.value = "";
      const V = { session: "selectSession", task: "selectTask", agent: "selectAgent" }[O];
      a.bridge.contextWorkspace?.[V](M), ve(), await be();
    }
    function Le(O) {
      return { user: b("用户", "User"), assistant: b("智能体", "Assistant"), system: b("系统指令", "System"), developer: b("开发指令", "Developer"), tool: b("工具结果", "Tool"), function: b("工具结果", "Tool") }[O] || O || b("记录", "Record");
    }
    function Fe(O) {
      const V = { pending: ["待处理", "Pending"], queued: ["排队中", "Queued"], running: ["进行中", "Running"], completed: ["已完成", "Completed"], succeeded: ["已完成", "Succeeded"], success: ["已完成", "Succeeded"], resolved: ["已解决", "Resolved"], failed: ["失败", "Failed"], cancelled: ["已取消", "Cancelled"], interrupted: ["已中断", "Interrupted"], paused: ["已暂停", "Paused"], waiting_approval: ["等待审批", "Awaiting approval"], verifying: ["验证中", "Verifying"] }[String(O || "").toLowerCase()];
      return V ? b(...V) : String(O || b("未提供状态", "Status unavailable"));
    }
    function Te(O) {
      if (!O) return "";
      const M = new Date(O);
      return Number.isFinite(M.getTime()) ? M.toLocaleString(a.isZh ? "zh-CN" : "en-US") : "";
    }
    function $e() {
      i.value = "native", p.value?.openCreate();
    }
    async function ce() {
      if (i.value !== "native") return be();
      await a.bridge.loadSynapxnetMemories(), o("refresh");
    }
    return t({ openCreate: $e, refresh: ce }), Gt(() => a.active, (O) => {
      O && (ve(), i.value !== "native" && be());
    }), Tl(() => {
      ve(), ke = window.setInterval(() => {
        a.active && ve();
      }, 1200);
    }), $l(() => {
      Z = !0, window.clearInterval(ke);
    }), (O, M) => (u(), c("section", {
      class: "ox-memory-workspace",
      "data-memory-view": i.value
    }, [
      s("div", zf, [
        s("nav", {
          class: "ox-memory-workspace-tabs",
          "aria-label": b("记忆与上下文视图", "Memory and context views")
        }, [
          s("button", {
            type: "button",
            "data-memory-view-tab": "native",
            "aria-pressed": i.value === "native",
            onClick: M[0] || (M[0] = (V) => he("native"))
          }, [
            M[6] || (M[6] = s("i", {
              class: "fa-solid fa-brain",
              "aria-hidden": "true"
            }, null, -1)),
            de(l(b("原生记忆", "Native memory")), 1)
          ], 8, Gf),
          s("button", {
            type: "button",
            "data-memory-view-tab": "session",
            "aria-pressed": i.value === "session",
            onClick: M[1] || (M[1] = (V) => he("session"))
          }, [
            M[7] || (M[7] = s("i", {
              class: "fa-regular fa-comments",
              "aria-hidden": "true"
            }, null, -1)),
            de(l(b("会话上下文", "Session context")), 1)
          ], 8, Qf),
          s("button", {
            type: "button",
            "data-memory-view-tab": "task",
            "aria-pressed": i.value === "task",
            onClick: M[2] || (M[2] = (V) => he("task"))
          }, [
            M[8] || (M[8] = s("i", {
              class: "fa-solid fa-diagram-project",
              "aria-hidden": "true"
            }, null, -1)),
            de(l(b("任务上下文", "Task context")), 1)
          ], 8, Xf)
        ], 8, Yf),
        s("span", Jf, [
          M[9] || (M[9] = s("i", {
            class: "fa-regular fa-folder-open",
            "aria-hidden": "true"
          }, null, -1)),
          de(l(f.value.workspace?.name ? `${b("本地目录", "Local directory")} · ${f.value.workspace.name}` : b("当前工作区", "Current workspace")), 1)
        ])
      ]),
      je(kt(qf, {
        ref_key: "library",
        ref: p,
        memory: e.memory,
        bridge: e.bridge,
        "is-zh": e.isZh,
        onRefresh: M[3] || (M[3] = (V) => o("refresh"))
      }, null, 8, ["memory", "bridge", "is-zh"]), [
        [Eo, i.value === "native"]
      ]),
      i.value !== "native" ? (u(), c("div", {
        key: 0,
        class: "ox-context-workspace",
        "aria-busy": h.value || f.value.loading
      }, [
        s("div", ev, [
          s("div", null, [
            s("strong", null, l(Ce.value), 1),
            s("p", null, l(i.value === "session" ? b("查看会话记录与续接资料，保留信息来源。", "Inspect conversation records and recall material with their sources.") : b("沿任务查看目标、角色、进展与证据。", "Follow goals, roles, progress and evidence within each task.")), 1)
          ]),
          s("div", tv, [
            i.value === "task" && A(f.value.agents).length ? (u(), c("label", sv, [
              M[10] || (M[10] = s("i", {
                class: "fa-solid fa-user-gear",
                "aria-hidden": "true"
              }, null, -1)),
              s("select", {
                "data-context-agent": "",
                "aria-label": b("按智能体筛选进展记录", "Filter progress by agent"),
                value: f.value.scope?.agentId || "",
                onChange: M[4] || (M[4] = (V) => le("agent", V.target.value))
              }, [
                s("option", lv, l(b("全部可见智能体", "All visible agents")), 1),
                (u(!0), c(I, null, U(f.value.agents, (V) => (u(), c("option", {
                  key: V.id,
                  value: V.id
                }, l(V.name), 9, av))), 128))
              ], 40, nv)
            ])) : P("", !0),
            s("button", {
              type: "button",
              class: "ox-context-button",
              disabled: h.value,
              onClick: be
            }, [
              s("i", {
                class: q(["fa-solid fa-rotate-right", { "fa-spin": h.value }]),
                "aria-hidden": "true"
              }, null, 2),
              de(l(b("刷新资料", "Refresh")), 1)
            ], 8, ov)
          ])
        ]),
        m.value || f.value.error ? (u(), c("div", iv, [
          M[11] || (M[11] = s("i", {
            class: "fa-solid fa-circle-exclamation",
            "aria-hidden": "true"
          }, null, -1)),
          de(l(m.value || f.value.error), 1)
        ])) : P("", !0),
        s("div", rv, [
          s("aside", uv, [
            s("label", cv, [
              M[12] || (M[12] = s("i", {
                class: "fa-solid fa-magnifying-glass",
                "aria-hidden": "true"
              }, null, -1)),
              je(s("input", {
                "onUpdate:modelValue": M[5] || (M[5] = (V) => g.value = V),
                type: "search",
                "aria-label": b("搜索上下文", "Search context"),
                placeholder: i.value === "session" ? b("搜索会话", "Find a session") : b("搜索任务与事件", "Find a task or incident")
              }, null, 8, dv), [
                [Qe, g.value]
              ])
            ]),
            s("div", pv, [
              s("span", null, l(i.value === "session" ? b("会话记录", "Conversations") : b("任务与事件", "Tasks and incidents")), 1),
              s("span", null, l(i.value === "session" ? B.value.length : J.value.length), 1)
            ]),
            i.value === "session" ? (u(), c("div", fv, [
              (u(!0), c(I, null, U(B.value, (V) => (u(), c("button", {
                key: V.id,
                type: "button",
                "data-context-session-id": V.id,
                class: "ox-context-item",
                "aria-pressed": G.value.id === V.id,
                onClick: (Se) => le("session", V.id)
              }, [
                M[13] || (M[13] = s("span", { class: "ox-context-item-icon" }, [
                  s("i", {
                    class: "fa-regular fa-message",
                    "aria-hidden": "true"
                  })
                ], -1)),
                s("span", null, [
                  s("strong", null, l(k(V)), 1),
                  s("small", null, [
                    de(l(V.isCurrent ? b("当前会话", "Current session") : b("已保存会话", "Saved session")), 1),
                    V.contentAvailable ? (u(), c(I, { key: 0 }, [
                      de(" · " + l(V.messageCount) + " " + l(b("条记录", "records")), 1)
                    ], 64)) : P("", !0)
                  ])
                ])
              ], 8, vv))), 128)),
              B.value.length ? P("", !0) : (u(), c("p", gv, l(g.value ? b("没有匹配的会话", "No matching session") : b("开始一次对话后，会话会显示在这里。", "Your conversations will appear here.")), 1))
            ])) : (u(), c("div", mv, [
              (u(!0), c(I, null, U(J.value, (V) => (u(), c("button", {
                key: V.id,
                type: "button",
                "data-context-task-id": V.id,
                class: "ox-context-item",
                "aria-pressed": $.value.id === V.id,
                onClick: (Se) => le("task", V.id)
              }, [
                s("span", hv, [
                  s("i", {
                    class: q(V.source === "incident" ? "fa-solid fa-circle-nodes" : "fa-solid fa-list-check"),
                    "aria-hidden": "true"
                  }, null, 2)
                ]),
                s("span", null, [
                  s("strong", null, l(H(V)), 1),
                  s("small", null, l(V.source === "incident" ? b("事件", "Incident") : b("任务", "Task")) + " · " + l(Fe(V.status)), 1)
                ])
              ], 8, yv))), 128)),
              J.value.length ? P("", !0) : (u(), c("p", _v, l(g.value ? b("没有匹配的任务", "No matching task") : b("创建项目任务后，可在这里查看协作上下文。", "Project tasks and their context will appear here.")), 1))
            ]))
          ]),
          i.value === "session" ? (u(), c("main", bv, [
            s("header", xv, [
              s("div", null, [
                s("span", null, l(b("会话资料", "Conversation material")), 1),
                s("h2", null, l(G.value.id ? k(G.value) : b("选择一个会话", "Select a session")), 1)
              ]),
              G.value.id ? (u(), c("span", kv, l(ae.value.length) + " " + l(b("条可见记录", "visible records")), 1)) : P("", !0)
            ]),
            s("div", Sv, [
              M[14] || (M[14] = s("i", {
                class: "fa-solid fa-layer-group",
                "aria-hidden": "true"
              }, null, -1)),
              s("span", null, l(b("这里保留会话原始记录；本次模型输入的完整组成和用量尚未提供。", "These are conversation records. The complete model input and usage are not yet available.")), 1)
            ]),
            G.value.error ? (u(), c("div", wv, l(G.value.error), 1)) : P("", !0),
            ae.value.length ? (u(), c("div", Cv, [
              (u(!0), c(I, null, U(ae.value, (V) => (u(), c("article", {
                key: V.id,
                class: "ox-context-message",
                "data-context-message-id": V.id
              }, [
                s("div", Rv, [
                  s("span", {
                    "data-message-role": V.role
                  }, l(Le(V.role)), 9, Tv),
                  V.timestamp ? (u(), c("time", $v, l(Te(V.timestamp)), 1)) : P("", !0)
                ]),
                String(V.content || "").trim() ? (u(), c("div", {
                  key: 0,
                  class: "ox-context-prose",
                  innerHTML: ys(R)(V.content)
                }, null, 8, Av)) : (u(), c("p", Iv, l(b("此条记录没有提供文本正文。", "This record does not provide text content.")), 1))
              ], 8, Mv))), 128))
            ])) : (u(), c("div", Ev, [
              M[15] || (M[15] = s("i", {
                class: "fa-regular fa-comments",
                "aria-hidden": "true"
              }, null, -1)),
              s("strong", null, l(G.value.availability === "available" ? b("这个会话还没有消息", "This conversation has no messages yet") : b("会话正文暂不可用", "Conversation content is unavailable")), 1),
              s("p", null, l(G.value.availability === "available" ? b("开始对话后，可以在这里回看原始记录。", "Conversation records will appear here once you start chatting.") : b("当前只读取到会话信息，可稍后刷新或选择其他会话。", "Only session metadata is available. Refresh later or choose another session.")), 1)
            ])),
            ne.value.length ? (u(), c("details", Pv, [
              s("summary", null, [
                de(l(b("工作区续接资料", "Workspace recall material")) + " ", 1),
                s("span", null, l(ne.value.length), 1)
              ]),
              (u(!0), c(I, null, U(ne.value, (V, Se) => (u(), c("article", {
                key: V.id || Se,
                class: "ox-context-observation"
              }, [
                s("strong", null, l(V.title || b("工作记录", "Work record")), 1),
                s("p", null, l(V.summary), 1),
                s("small", null, l(V.source) + " " + l(Te(V.timestamp)), 1)
              ]))), 128))
            ])) : P("", !0)
          ])) : (u(), c("main", Dv, [
            s("header", Ov, [
              s("div", null, [
                s("span", null, l($.value.source === "incident" ? b("事件上下文", "Incident context") : b("协作任务", "Collaborative task")), 1),
                s("h2", null, l(Q.value ? H($.value) : b("选择一个任务", "Select a task")), 1)
              ]),
              Q.value ? (u(), c("span", Vv, l(Fe($.value.status)), 1)) : P("", !0)
            ]),
            $.value.error ? (u(), c("div", Lv, l($.value.error), 1)) : P("", !0),
            Q.value ? (u(), c(I, { key: 1 }, [
              $.value.source === "incident" && $.value.workspaceId ? (u(), c("p", Fv, [
                de(l(b("事件所属空间：", "Incident workspace: ")) + l(f.value.workspace?.enterpriseWorkspaceName || $.value.workspaceId), 1),
                f.value.workspace?.projectName ? (u(), c(I, { key: 0 }, [
                  de(" · " + l(f.value.workspace.projectName), 1)
                ], 64)) : P("", !0)
              ])) : P("", !0),
              $.value.detailAvailability === "unavailable" ? (u(), c("div", Nv, l(b("当前可读取任务概要，详细执行记录暂不可用。", "The task summary is available. Detailed execution records are currently unavailable.")), 1)) : P("", !0),
              s("section", jv, [
                s("h3", null, l(b("目标与任务摘要", "Goal and task summary")), 1),
                $.value.goal || $.value.summary ? (u(), c("div", {
                  key: 0,
                  class: "ox-context-prose",
                  innerHTML: ys(R)([$.value.goal, $.value.summary].filter((V, Se, He) => V && He.indexOf(V) === Se).join(`

`))
                }, null, 8, Wv)) : (u(), c("p", Bv, l(b("该任务尚未提供目标摘要。", "No goal summary has been provided.")), 1))
              ]),
              _e.value.length ? (u(), c("section", Uv, [
                s("h3", null, l(b("参与角色", "Participants")), 1),
                s("div", null, [
                  (u(!0), c(I, null, U(_e.value, (V) => (u(), c("span", {
                    key: V.id,
                    class: "ox-context-member"
                  }, [
                    M[16] || (M[16] = s("i", {
                      class: "fa-regular fa-user",
                      "aria-hidden": "true"
                    }, null, -1)),
                    de(l(V.name || V.id), 1),
                    V.role ? (u(), c("small", Kv, l(V.role), 1)) : P("", !0)
                  ]))), 128))
                ])
              ])) : P("", !0),
              s("section", qv, [
                s("div", Hv, [
                  s("h3", null, l(b("进展与交接记录", "Progress and handoffs")), 1),
                  s("span", null, l(w.value.length), 1)
                ]),
                w.value.length ? (u(), c("ol", zv, [
                  (u(!0), c(I, null, U(w.value, (V, Se) => (u(), c("li", {
                    key: V.id || Se,
                    "data-context-event-id": V.id
                  }, [
                    M[17] || (M[17] = s("div", { class: "ox-context-trace-dot" }, null, -1)),
                    s("div", null, [
                      s("strong", null, l(V.title || b("任务记录", "Task record")), 1),
                      V.summary ? (u(), c("p", Gv, l(V.summary), 1)) : P("", !0),
                      s("small", null, [
                        de(l(V.agentId), 1),
                        V.status ? (u(), c(I, { key: 0 }, [
                          de(" · " + l(Fe(V.status)), 1)
                        ], 64)) : P("", !0),
                        V.timestamp ? (u(), c(I, { key: 1 }, [
                          de(" · " + l(Te(V.timestamp)), 1)
                        ], 64)) : P("", !0)
                      ])
                    ])
                  ], 8, Yv))), 128))
                ])) : (u(), c("p", Qv, l(b("暂无可读取的进展记录。", "No progress records are available.")), 1))
              ]),
              ye.value.length ? (u(), c("details", Xv, [
                s("summary", null, [
                  de(l(b("证据与来源", "Evidence and sources")) + " ", 1),
                  s("span", null, l(ye.value.length), 1)
                ]),
                (u(!0), c(I, null, U(ye.value, (V, Se) => (u(), c("article", {
                  key: V.id || Se,
                  class: "ox-context-observation"
                }, [
                  s("strong", null, l(V.id), 1),
                  s("p", null, l(V.summary), 1),
                  V.resourceVersion ? (u(), c("small", Jv, l(b("资源版本", "Resource version")) + " " + l(V.resourceVersion), 1)) : P("", !0),
                  V.timestamp ? (u(), c("small", Zv, " · " + l(Te(V.timestamp)), 1)) : P("", !0)
                ]))), 128))
              ])) : P("", !0),
              ne.value.length ? (u(), c("details", eg, [
                s("summary", null, [
                  de(l(b("任务续接资料", "Task recall material")) + " ", 1),
                  s("span", null, l(ne.value.length), 1)
                ]),
                (u(!0), c(I, null, U(ne.value, (V, Se) => (u(), c("article", {
                  key: V.id || Se,
                  class: "ox-context-observation"
                }, [
                  s("strong", null, l(V.title || b("工作记录", "Work record")), 1),
                  s("p", null, l(V.summary), 1),
                  s("small", null, l(V.source) + " " + l(Te(V.timestamp)), 1)
                ]))), 128))
              ])) : P("", !0),
              s("div", tg, [
                M[18] || (M[18] = s("i", {
                  class: "fa-solid fa-shield-halved",
                  "aria-hidden": "true"
                }, null, -1)),
                s("span", null, l(b("上下文沿用任务的权限与版本。工具授权、计划审批和执行状态由原任务流程管理。", "Context follows task permissions and versions. Authorization, approval and execution remain in the task workflow.")), 1)
              ])
            ], 64)) : (u(), c("div", sg, [
              M[19] || (M[19] = s("i", {
                class: "fa-solid fa-diagram-project",
                "aria-hidden": "true"
              }, null, -1)),
              s("strong", null, l(b("从一个任务开始", "Start with a task")), 1),
              s("p", null, l(b("日常项目与场景验证共享这套视图，按实际任务展示角色和证据。", "Everyday projects and scenario validation share this view, using their actual participants and evidence.")), 1)
            ]))
          ]))
        ])
      ], 8, Zf)) : P("", !0)
    ], 8, Hf));
  }
}, lg = /* @__PURE__ */ Vl(ng, [["__scopeId", "data-v-dde87ca8"]]), ag = ["data-active-tab"], og = { class: "ox-vite-ops-header" }, ig = { class: "ox-vite-ops-header__kicker" }, rg = { class: "ox-vite-ops-header__actions" }, ug = { class: "ox-vite-task-shell" }, cg = { class: "ox-vite-task-board" }, dg = { class: "ox-vite-task-column__head" }, pg = {
  key: 0,
  class: "ox-vite-task-empty"
}, fg = ["onClick"], vg = { class: "ox-vite-task-card__title" }, gg = { class: "ox-vite-task-card__summary" }, mg = {
  key: 0,
  class: "ox-vite-task-progress"
}, yg = { class: "ox-vite-task-card__meta" }, hg = { class: "ox-vite-task-detail" }, _g = { class: "ox-vite-task-detail__head" }, bg = { class: "ox-vite-task-detail__title" }, xg = { class: "ox-vite-detail-chip" }, kg = { class: "ox-vite-task-detail__summary" }, Sg = { class: "ox-vite-task-detail__trace" }, wg = {
  key: 1,
  class: "ox-vite-empty-state"
}, Cg = {
  key: 1,
  class: "ox-vite-about-shell"
}, Mg = { class: "ox-vite-about-name" }, Rg = { class: "ox-vite-detail-chip" }, Tg = { class: "ox-vite-about-copy" }, $g = { class: "ox-vite-about-grid" }, Ag = { class: "ox-vite-info-card__icon" }, Ig = { class: "ox-vite-link-grid" }, Eg = ["href"], Pg = { class: "ox-vite-fact-list" }, Dg = {
  key: 2,
  class: "ox-vite-vrm-layout"
}, Og = { class: "ox-vite-vrm-config" }, Vg = { class: "ox-vite-vrm-topbar" }, Lg = { class: "ox-vite-vrm-topbar__title" }, Fg = { class: "ox-vite-ops-header__kicker" }, Ng = {
  key: 0,
  class: "ox-vite-vrm-guide"
}, jg = { class: "ox-vite-vrm-guide__note" }, Wg = { class: "ox-vite-vrm-guide__steps" }, Bg = { class: "ox-vite-vrm-guide__step-index" }, Ug = { class: "ox-vite-vrm-guide__step-copy" }, Kg = {
  key: 0,
  class: "ox-vite-vrm-chips"
}, qg = {
  key: 1,
  class: "ox-vite-vrm-statgrid"
}, Hg = { class: "ox-vite-panel-card" }, zg = { class: "ox-vite-panel-card__head" }, Yg = { class: "ox-vite-vrm-tabs" }, Gg = { class: "ox-vite-vrm-tab__count" }, Qg = { class: "ox-vite-vrm-tab__count" }, Xg = { class: "ox-vite-vrm-tab__count" }, Jg = { class: "ox-vite-vrm-search" }, Zg = ["placeholder"], em = { class: "ox-vite-vrm-list" }, tm = ["disabled", "onClick"], sm = { class: "ox-vite-vrm-row__icon" }, nm = { class: "ox-vite-vrm-row__main" }, lm = { class: "ox-vite-vrm-row__name" }, am = { class: "ox-vite-vrm-row__sub" }, om = {
  key: 0,
  class: "fa-solid fa-circle-check ox-vite-vrm-row__check"
}, im = ["onClick"], rm = ["title", "onClick"], um = {
  key: 0,
  class: "ox-vite-vrm-empty"
}, cm = { key: 0 }, dm = { key: 1 }, pm = { key: 2 }, fm = { key: 3 }, vm = { class: "ox-vite-panel-card" }, gm = { class: "ox-vite-panel-card__head" }, mm = { class: "ox-vite-form-grid" }, ym = { class: "ox-vite-field" }, hm = ["value"], _m = ["value"], bm = { class: "ox-vite-field" }, xm = { class: "ox-vite-vrm-toggle" }, km = ["checked"], Sm = { class: "ox-vite-field" }, wm = { class: "ox-vite-vrm-toggle" }, Cm = ["checked"], Mm = { class: "ox-vite-field" }, Rm = ["value"], Tm = { class: "ox-vite-field" }, $m = ["value"], Am = { class: "ox-vite-panel-card" }, Im = { class: "ox-vite-panel-card__head" }, Em = { class: "ox-vite-vrm-tabs" }, Pm = { class: "ox-vite-vrm-tab__count" }, Dm = { class: "ox-vite-vrm-tab__count" }, Om = { class: "ox-vite-vrm-search" }, Vm = ["placeholder"], Lm = { class: "ox-vite-vrm-list" }, Fm = ["onClick"], Nm = { class: "ox-vite-vrm-row__icon" }, jm = { class: "ox-vite-vrm-row__main" }, Wm = { class: "ox-vite-vrm-row__name" }, Bm = { class: "ox-vite-vrm-row__sub" }, Um = ["title", "onClick"], Km = {
  key: 0,
  class: "ox-vite-vrm-empty"
}, qm = { key: 0 }, Hm = { key: 1 }, zm = { key: 2 }, Ym = { class: "ox-vite-vrm-preview" }, Gm = { class: "ox-vite-vrm-preview__head" }, Qm = { key: 0 }, Xm = { class: "ox-vite-vrm-preview__toggle" }, Jm = { class: "ox-vite-vrm-preview__stage" }, Zm = {
  key: 0,
  class: "ox-vite-vrm-preview__frame"
}, ey = ["src"], ty = {
  key: 1,
  class: "ox-vite-vrm-preview__frame"
}, sy = ["src"], ny = {
  key: 2,
  class: "ox-vite-vrm-preview__placeholder"
}, ly = { class: "ox-vite-vrm-preview__actions ox-vite-vrm-preview__actions--top" }, ay = ["disabled"], oy = {
  key: 0,
  class: "ox-vite-vrm-preview__motions"
}, iy = { class: "ox-vite-vrm-section-label" }, ry = { class: "ox-vite-vrm-preview__motion-chips" }, uy = { class: "ox-vite-vrm-preview__actions" }, cy = ["disabled"], dy = { class: "ox-vite-ops-header" }, py = { class: "ox-ops-page-identity" }, fy = {
  class: "ox-ops-page-icon",
  "aria-hidden": "true"
}, vy = { class: "ox-ops-page-copy" }, gy = { class: "ox-vite-ops-header__actions" }, my = {
  key: 0,
  class: "ox-vite-system-layout"
}, yy = { class: "ox-vite-side-tabs" }, hy = ["onClick"], _y = { class: "ox-vite-ops-main" }, by = { class: "ox-vite-stat-grid" }, xy = { class: "ox-vite-panel-card" }, ky = { class: "ox-vite-panel-card__head" }, Sy = {
  key: 0,
  class: "ox-vite-settings-stack"
}, wy = { class: "ox-vite-settings-section" }, Cy = { class: "ox-vite-settings-section__label" }, My = { class: "ox-vite-settings-row" }, Ry = ["value"], Ty = ["value"], $y = { class: "ox-vite-settings-row" }, Ay = ["value"], Iy = ["value"], Ey = { class: "ox-vite-settings-row ox-vite-settings-row--wide" }, Py = { class: "ox-vite-segmented" }, Dy = ["onClick"], Oy = { class: "ox-vite-settings-row ox-vite-settings-row--wide" }, Vy = { class: "ox-vite-segmented" }, Ly = ["onClick"], Fy = { class: "ox-vite-settings-section" }, Ny = { class: "ox-vite-settings-section__label" }, jy = { class: "ox-vite-settings-row" }, Wy = { class: "ox-vite-switch" }, By = ["checked"], Uy = { class: "ox-vite-settings-row" }, Ky = { class: "ox-vite-switch" }, qy = ["checked"], Hy = { class: "ox-vite-settings-section" }, zy = { class: "ox-vite-settings-section__label" }, Yy = { class: "ox-vite-settings-row" }, Gy = {
  key: 1,
  class: "ox-vite-settings-stack ox-skin-settings"
}, Qy = { class: "ox-skin-current__copy" }, Xy = { class: "ox-skin-eyebrow" }, Jy = { class: "ox-skin-current__meta" }, Zy = { key: 0 }, eh = ["disabled"], th = {
  key: 0,
  class: "ox-skin-library"
}, sh = { class: "ox-skin-library__heading" }, nh = { class: "ox-skin-library__grid" }, lh = ["data-skin-id", "aria-pressed", "onClick"], ah = { class: "ox-skin-library-card__label" }, oh = {
  key: 0,
  class: "fa-solid fa-circle-check",
  "aria-hidden": "true"
}, ih = { key: 0 }, rh = { class: "ox-skin-classic-themes" }, uh = { class: "ox-vite-theme-grid" }, ch = ["onClick"], dh = {
  key: 2,
  class: "ox-vite-settings-stack"
}, ph = { class: "ox-vite-settings-section" }, fh = { class: "ox-vite-settings-section__label" }, vh = { class: "ox-vite-shortcut-state" }, gh = { class: "ox-vite-settings-section" }, mh = { class: "ox-vite-settings-section__label" }, yh = ["onClick"], hh = {
  key: 3,
  class: "ox-vite-settings-stack"
}, _h = { class: "ox-vite-settings-section" }, bh = { class: "ox-vite-settings-section__label" }, xh = { class: "ox-vite-settings-row" }, kh = ["value"], Sh = ["value"], wh = { class: "ox-vite-settings-row" }, Ch = ["value"], Mh = ["value"], Rh = {
  key: 0,
  class: "ox-vite-settings-row ox-vite-settings-row--wide"
}, Th = ["value"], $h = {
  key: 4,
  class: "ox-vite-feature-packs"
}, Ah = { class: "ox-vite-feature-packs__toolbar" }, Ih = { class: "ox-vite-feature-packs__feed" }, Eh = { key: 0 }, Ph = ["disabled", "title"], Dh = {
  key: 0,
  class: "ox-vite-feature-pack-notice is-error",
  role: "status"
}, Oh = {
  key: 1,
  class: "ox-vite-feature-pack-notice",
  role: "status"
}, Vh = {
  key: 2,
  class: "ox-vite-feature-pack-notice",
  role: "status"
}, Lh = { class: "ox-vite-feature-pack-list" }, Fh = { class: "ox-vite-feature-pack-row__identity" }, Nh = { class: "ox-vite-feature-pack-row__icon" }, jh = { class: "ox-vite-feature-pack-row__versions" }, Wh = { class: "ox-vite-feature-pack-row__state" }, Bh = {
  key: 0,
  class: "ox-vite-feature-pack-restart"
}, Uh = { class: "ox-vite-feature-pack-row__actions" }, Kh = ["disabled", "onClick"], qh = ["disabled", "onClick"], Hh = ["disabled", "title", "onClick"], zh = { class: "ox-vite-feature-pack-progress__meta" }, Yh = { key: 0 }, Gh = { key: 1 }, Qh = {
  class: "ox-vite-feature-pack-progress__track",
  "aria-hidden": "true"
}, Xh = { key: 0 }, Jh = {
  key: 5,
  class: "ox-vite-settings-stack"
}, Zh = { class: "ox-vite-settings-section" }, e_ = { class: "ox-vite-settings-section__label" }, t_ = { class: "ox-vite-settings-row" }, s_ = { class: "ox-vite-settings-row" }, n_ = { class: "ox-vite-settings-row" }, l_ = { class: "ox-vite-settings-section" }, a_ = { class: "ox-vite-settings-section__label" }, o_ = { class: "ox-vite-settings-row" }, i_ = { class: "ox-vite-settings-row" }, r_ = {
  key: 6,
  class: "ox-vite-card-grid"
}, u_ = { class: "ox-vite-panel-card" }, c_ = { class: "ox-vite-panel-card__head" }, d_ = { class: "ox-vite-chip-grid" }, p_ = { class: "ox-vite-detail-chip" }, f_ = { class: "ox-vite-detail-chip" }, v_ = { class: "ox-vite-detail-chip" }, g_ = { class: "ox-vite-fact-list" }, m_ = { class: "ox-vite-fact-row" }, y_ = { class: "ox-vite-fact-row" }, h_ = { class: "ox-vite-fact-row" }, __ = { class: "ox-vite-chip-grid" }, b_ = { class: "ox-vite-panel-card__head" }, x_ = { class: "ox-vite-chip-grid" }, k_ = { class: "ox-vite-detail-chip" }, S_ = { class: "ox-vite-bullet-list" }, w_ = {
  key: 1,
  class: "ox-ops-content-body"
}, C_ = {
  key: 0,
  class: "ox-vite-side-tabs"
}, M_ = ["onClick"], R_ = { class: "ox-vite-ops-main ox-ops-primary-workspace" }, T_ = {
  key: 0,
  class: "ox-vite-tab-strip"
}, $_ = ["onClick"], A_ = {
  key: 1,
  class: "ox-vite-summary-card"
}, I_ = { class: "ox-vite-chip-grid" }, E_ = {
  key: 2,
  class: "ox-vite-stat-grid"
}, P_ = {
  key: 0,
  class: "ox-vite-card-grid"
}, D_ = { class: "ox-vite-panel-card" }, O_ = { class: "ox-vite-panel-card__head" }, V_ = { class: "ox-vite-deploy-hero" }, L_ = { class: "ox-vite-deploy-hero__status" }, F_ = { class: "ox-vite-deploy-kicker" }, N_ = { class: "ox-vite-stat-card emphasis" }, j_ = { class: "ox-vite-form-grid" }, W_ = { class: "ox-vite-field" }, B_ = ["value"], U_ = { class: "ox-vite-field" }, K_ = ["value"], q_ = { class: "ox-vite-field" }, H_ = ["value"], z_ = { class: "ox-vite-field" }, Y_ = ["value"], G_ = { class: "ox-vite-panel-card" }, Q_ = { class: "ox-vite-panel-card__head" }, X_ = { class: "ox-vite-chip-grid" }, J_ = { class: "ox-vite-detail-chip" }, Z_ = { class: "ox-vite-detail-chip" }, eb = { class: "ox-vite-detail-chip" }, tb = {
  key: 1,
  class: "ox-vite-deploy-platform-grid"
}, sb = { class: "ox-vite-deploy-platform-card__head" }, nb = { class: "ox-vite-detail-chip" }, lb = { class: "ox-vite-deploy-platform-card__meta" }, ab = {
  key: 2,
  class: "ox-vite-card-grid"
}, ob = { class: "ox-vite-panel-card" }, ib = { class: "ox-vite-panel-card__head" }, rb = { class: "ox-vite-deploy-platform-grid" }, ub = { class: "ox-vite-deploy-platform-card__head" }, cb = { class: "ox-vite-detail-chip" }, db = { class: "ox-vite-panel-card" }, pb = { class: "ox-vite-panel-card__head" }, fb = { class: "ox-vite-form-grid" }, vb = { class: "ox-vite-field" }, gb = ["value"], mb = { class: "ox-vite-field" }, yb = ["value"], hb = { class: "ox-vite-field" }, _b = ["value"], bb = { class: "ox-vite-field" }, xb = ["value"], kb = { class: "ox-vite-field ox-vite-field--wide" }, Sb = ["value"], wb = {
  key: 3,
  class: "ox-vite-card-grid"
}, Cb = { class: "ox-vite-panel-card" }, Mb = { class: "ox-vite-panel-card__head" }, Rb = { class: "ox-vite-form-grid" }, Tb = { class: "ox-vite-field ox-vite-field--wide" }, $b = ["value"], Ab = { class: "ox-vite-field" }, Ib = ["value"], Eb = { class: "ox-vite-field" }, Pb = ["value"], Db = { class: "ox-vite-chip-grid" }, Ob = { class: "ox-vite-detail-chip" }, Vb = { class: "ox-vite-panel-card" }, Lb = { class: "ox-vite-panel-card__head" }, Fb = { class: "ox-vite-deploy-preview" }, Nb = {
  key: 4,
  class: "ox-vite-card-grid"
}, jb = { class: "ox-vite-panel-card" }, Wb = { class: "ox-vite-panel-card__head" }, Bb = { class: "ox-vite-form-grid" }, Ub = { class: "ox-vite-field" }, Kb = ["value"], qb = { class: "ox-vite-field" }, Hb = ["value"], zb = { class: "ox-vite-chip-grid" }, Yb = { class: "ox-vite-detail-chip" }, Gb = { class: "ox-vite-detail-chip" }, Qb = { class: "ox-vite-panel-card" }, Xb = { class: "ox-vite-panel-card__head" }, Jb = { class: "ox-vite-deploy-preview" }, Zb = { class: "ox-vite-panel-card" }, e1 = { class: "ox-vite-panel-card__head" }, t1 = { class: "ox-vite-deploy-preview" }, s1 = {
  key: 5,
  class: "ox-vite-card-grid"
}, n1 = { class: "ox-vite-panel-card" }, l1 = { class: "ox-vite-panel-card__head" }, a1 = { class: "ox-vite-form-grid" }, o1 = { class: "ox-vite-field" }, i1 = ["value"], r1 = { class: "ox-vite-field" }, u1 = ["value"], c1 = { class: "ox-vite-field ox-vite-field--wide" }, d1 = ["value"], p1 = { class: "ox-vite-field ox-vite-field--wide" }, f1 = ["value"], v1 = { class: "ox-vite-field ox-vite-field--wide" }, g1 = ["value"], m1 = { class: "ox-vite-stat-grid" }, y1 = { class: "ox-vite-summary-card" }, h1 = { class: "ox-vite-workbench-summary" }, _1 = { class: "ox-vite-chip-grid" }, b1 = { class: "ox-vite-chip-grid" }, x1 = { class: "ox-vite-card-grid ox-vite-card-grid--workbench" }, k1 = { class: "ox-vite-panel-card" }, S1 = { class: "ox-vite-panel-card__head" }, w1 = { class: "ox-vite-chip-grid" }, C1 = { class: "ox-vite-detail-chip" }, M1 = { class: "ox-vite-detail-chip" }, R1 = { class: "ox-vite-detail-chip" }, T1 = { class: "ox-vite-form-grid" }, $1 = { class: "ox-vite-field" }, A1 = ["value"], I1 = { class: "ox-vite-field" }, E1 = ["value"], P1 = { class: "ox-vite-field ox-vite-field--wide" }, D1 = ["value"], O1 = {
  key: 0,
  class: "ox-vite-inline-note"
}, V1 = { class: "ox-vite-panel-card" }, L1 = { class: "ox-vite-panel-card__head" }, F1 = { class: "ox-vite-chip-grid" }, N1 = { class: "ox-vite-detail-chip" }, j1 = { class: "ox-vite-detail-chip" }, W1 = { class: "ox-vite-detail-chip" }, B1 = { class: "ox-vite-form-grid" }, U1 = { class: "ox-vite-field" }, K1 = ["value"], q1 = { class: "ox-vite-field" }, H1 = ["value"], z1 = { class: "ox-vite-field ox-vite-field--wide" }, Y1 = ["value"], G1 = { class: "ox-vite-field ox-vite-field--wide" }, Q1 = ["value"], X1 = { class: "ox-vite-panel-card" }, J1 = { class: "ox-vite-panel-card__head" }, Z1 = { class: "ox-vite-list" }, ex = { class: "ox-vite-list-row" }, tx = { class: "ox-vite-list-row" }, sx = { class: "ox-vite-list-row" }, nx = { class: "ox-vite-list-row" }, lx = { class: "ox-vite-chip-grid" }, ax = { class: "ox-vite-detail-chip" }, ox = { class: "ox-vite-detail-chip" }, ix = { class: "ox-vite-panel-card" }, rx = { class: "ox-vite-panel-card__head" }, ux = { class: "ox-vite-chip-grid" }, cx = { class: "ox-vite-detail-chip" }, dx = { class: "ox-vite-detail-chip" }, px = { class: "ox-vite-form-grid" }, fx = { class: "ox-vite-field ox-vite-field--wide" }, vx = ["value"], gx = { class: "ox-vite-field" }, mx = ["value"], yx = { class: "ox-vite-field" }, hx = ["value"], _x = { class: "ox-vite-field" }, bx = ["value"], xx = {
  key: 0,
  class: "ox-vite-inline-note"
}, kx = { class: "ox-vite-card-grid ox-vite-card-grid--workbench" }, Sx = { class: "ox-vite-panel-card" }, wx = { class: "ox-vite-panel-card__head" }, Cx = { class: "ox-vite-list" }, Mx = { class: "ox-vite-detail-chip" }, Rx = { class: "ox-vite-panel-card" }, Tx = { class: "ox-vite-panel-card__head" }, $x = { class: "ox-vite-list" }, Ax = { class: "ox-vite-detail-chip" }, Ix = {
  key: 0,
  class: "ox-vite-list-row"
}, Ex = { class: "ox-vite-panel-card" }, Px = { class: "ox-vite-panel-card__head" }, Dx = { class: "ox-vite-list" }, Ox = { class: "ox-vite-detail-chip" }, Vx = {
  key: 0,
  class: "ox-vite-list-row"
}, Lx = { class: "ox-vite-panel-card" }, Fx = { class: "ox-vite-panel-card__head" }, Nx = { class: "ox-vite-list" }, jx = {
  key: 0,
  class: "ox-vite-list-row"
}, Wx = {
  key: 1,
  class: "ox-vite-card-grid"
}, Bx = { class: "ox-vite-panel-card" }, Ux = { class: "ox-vite-panel-card__head" }, Kx = { class: "ox-vite-list" }, qx = { class: "ox-vite-stat-grid" }, Hx = { class: "ox-vite-summary-card" }, zx = { class: "ox-vite-chip-grid" }, Yx = { class: "ox-vite-stat-grid" }, Gx = { class: "ox-vite-card-grid ox-vite-card-grid--workbench" }, Qx = { class: "ox-vite-panel-card" }, Xx = { class: "ox-vite-panel-card__head" }, Jx = { class: "ox-vite-mini-bars" }, Zx = { class: "ox-vite-panel-card" }, ek = { class: "ox-vite-panel-card__head" }, tk = { class: "ox-vite-list" }, sk = { class: "ox-vite-panel-card" }, nk = { class: "ox-vite-panel-card__head" }, lk = { class: "ox-vite-list" }, ak = { class: "ox-vite-stat-grid" }, ok = { class: "ox-vite-card-grid ox-vite-card-grid--workbench" }, ik = { class: "ox-vite-panel-card" }, rk = { class: "ox-vite-panel-card__head" }, uk = { class: "ox-vite-list" }, ck = { class: "ox-vite-panel-card" }, dk = { class: "ox-vite-panel-card__head" }, pk = { class: "ox-vite-list" }, fk = { class: "ox-vite-stat-grid" }, vk = { class: "ox-vite-panel-card" }, gk = { class: "ox-vite-panel-card__head" }, mk = { class: "ox-vite-list" }, yk = {
  key: 0,
  class: "ox-vite-list-row"
}, hk = {
  key: 3,
  class: "ox-vite-kb-hub"
}, _k = { class: "ox-vite-kb-hero" }, bk = { class: "ox-vite-kb-hero__copy" }, xk = { class: "ox-vite-ops-header__kicker" }, kk = { class: "ox-vite-kb-hero__stats" }, Sk = { class: "ox-vite-role-hero__stat" }, wk = { class: "ox-vite-role-hero__stat" }, Ck = { class: "ox-vite-role-hero__stat" }, Mk = { class: "ox-vite-role-toolbar" }, Rk = { class: "ox-vite-role-search" }, Tk = ["placeholder"], $k = { class: "ox-vite-role-category-strip" }, Ak = ["onClick"], Ik = { class: "ox-vite-kb-layout" }, Ek = { class: "ox-vite-panel-card" }, Pk = { class: "ox-vite-panel-card__head" }, Dk = { class: "ox-vite-ops-header__kicker" }, Ok = { class: "ox-vite-detail-chip" }, Vk = {
  key: 0,
  class: "ox-vite-kb-grid"
}, Lk = { class: "ox-vite-kb-card__head" }, Fk = { class: "ox-vite-kb-card__identity" }, Nk = { class: "ox-vite-kb-card__name" }, jk = { class: "ox-vite-kb-card__meta" }, Wk = { class: "ox-vite-detail-chip" }, Bk = { class: "ox-vite-chip-grid" }, Uk = {
  key: 0,
  class: "ox-vite-detail-chip"
}, Kk = { class: "ox-vite-workspace-card__actions" }, qk = ["onClick"], Hk = ["onClick"], zk = ["onClick"], Yk = {
  key: 1,
  class: "ox-vite-empty-state"
}, Gk = { class: "ox-vite-panel-card ox-vite-kb-sidecard" }, Qk = { class: "ox-vite-panel-card__head" }, Xk = { class: "ox-vite-ops-header__kicker" }, Jk = { class: "ox-vite-form-grid" }, Zk = { class: "ox-vite-field ox-vite-field--wide" }, eS = { class: "ox-vite-field ox-vite-field--wide" }, tS = { class: "ox-vite-field ox-vite-field--wide" }, sS = { class: "ox-vite-workspace-card__actions" }, nS = ["disabled"], lS = { class: "ox-vite-panel-card__head" }, aS = { class: "ox-vite-ops-header__kicker" }, oS = {
  key: 0,
  class: "ox-vite-list"
}, iS = {
  key: 1,
  class: "ox-vite-empty-state ox-vite-empty-state--compact"
}, rS = { class: "ox-vite-workspace-card__actions" }, uS = { class: "ox-vite-panel-card__head" }, cS = { class: "ox-vite-ops-header__kicker" }, dS = { class: "ox-vite-list" }, pS = { class: "ox-vite-list-row" }, fS = { class: "ox-vite-list-row" }, vS = {
  key: 4,
  class: "ox-vite-role-studio"
}, gS = { class: "ox-vite-role-hero" }, mS = { class: "ox-vite-role-hero__copy" }, yS = { class: "ox-vite-ops-header__kicker" }, hS = { class: "ox-vite-role-hero__stats" }, _S = { class: "ox-vite-role-hero__stat" }, bS = { class: "ox-vite-role-hero__stat" }, xS = { class: "ox-vite-role-hero__stat" }, kS = { class: "ox-vite-role-toolbar" }, SS = { class: "ox-vite-role-search" }, wS = ["placeholder"], CS = { class: "ox-vite-role-category-strip" }, MS = ["onClick"], RS = { class: "ox-vite-role-layout" }, TS = { class: "ox-vite-panel-card" }, $S = { class: "ox-vite-panel-card__head" }, AS = { class: "ox-vite-ops-header__kicker" }, IS = { class: "ox-vite-detail-chip" }, ES = {
  key: 0,
  class: "ox-vite-role-template-grid"
}, PS = ["onClick"], DS = { class: "ox-vite-role-template-card__head" }, OS = { class: "ox-vite-role-template-card__icon" }, VS = { class: "ox-vite-role-template-card__category" }, LS = { class: "ox-vite-role-template-card__title" }, FS = { class: "ox-vite-role-template-card__department" }, NS = { class: "ox-vite-role-template-card__summary" }, jS = { class: "ox-vite-chip-grid" }, WS = { class: "ox-vite-role-template-card__foot" }, BS = {
  key: 1,
  class: "ox-vite-empty-state"
}, US = { class: "ox-vite-panel-card ox-vite-role-spotlight" }, KS = { class: "ox-vite-panel-card__head" }, qS = { class: "ox-vite-ops-header__kicker" }, HS = { class: "ox-vite-role-spotlight__list" }, zS = ["onClick"], YS = { class: "ox-vite-role-spotlight__icon" }, GS = { class: "ox-vite-role-spotlight__body" }, QS = { class: "ox-vite-role-spotlight__name" }, XS = { class: "ox-vite-role-spotlight__meta" }, JS = { class: "ox-vite-role-spotlight__tip" }, ZS = { class: "ox-vite-panel-card" }, ew = { class: "ox-vite-panel-card__head" }, tw = { class: "ox-vite-ops-header__kicker" }, sw = { class: "ox-vite-detail-chip" }, nw = {
  key: 0,
  class: "ox-vite-role-library-grid"
}, lw = { class: "ox-vite-role-library-card__toolbar" }, aw = ["onClick"], ow = { class: "ox-vite-role-library-card__hero" }, iw = { class: "ox-vite-role-library-card__icon" }, rw = { class: "ox-vite-role-library-card__identity" }, uw = { class: "ox-vite-role-library-card__name" }, cw = { class: "ox-vite-role-library-card__meta" }, dw = { key: 0 }, pw = { key: 1 }, fw = { class: "ox-vite-role-library-card__summary" }, vw = { class: "ox-vite-chip-grid" }, gw = {
  key: 1,
  class: "ox-vite-empty-state"
}, mw = {
  key: 5,
  class: "ox-vite-workspace-hub"
}, yw = { class: "ox-vite-workspace-hub__hero" }, hw = { class: "ox-vite-workspace-hub__copy" }, _w = { class: "ox-vite-ops-header__kicker" }, bw = { class: "ox-vite-workspace-hub__actions" }, xw = {
  key: 0,
  class: "ox-vite-workspace-grid"
}, kw = { class: "ox-vite-workspace-card__head" }, Sw = { class: "ox-vite-workspace-card__identity" }, ww = { class: "ox-vite-workspace-card__copy" }, Cw = { class: "ox-vite-workspace-card__name" }, Mw = { class: "ox-vite-workspace-card__meta" }, Rw = { class: "ox-vite-detail-chip" }, Tw = { class: "ox-vite-workspace-card__stats" }, $w = { class: "ox-vite-workspace-card__stat" }, Aw = { class: "ox-vite-workspace-card__stat" }, Iw = { class: "ox-vite-workspace-card__stat" }, Ew = { class: "ox-vite-chip-grid" }, Pw = { class: "ox-vite-detail-chip" }, Dw = {
  key: 0,
  class: "ox-vite-detail-chip"
}, Ow = { class: "ox-vite-workspace-card__actions" }, Vw = ["onClick"], Lw = ["onClick"], Fw = ["onClick"], Nw = {
  key: 1,
  class: "ox-vite-empty-state"
}, jw = {
  key: 6,
  class: "ox-vite-sandbox-shell"
}, Ww = { class: "ox-vite-sandbox-hero" }, Bw = { class: "ox-vite-sandbox-hero__head" }, Uw = { class: "ox-vite-sandbox-hero__copy" }, Kw = { class: "ox-vite-ops-header__kicker" }, qw = { class: "ox-vite-sandbox-breadcrumb" }, Hw = ["onClick"], zw = { class: "ox-vite-stat-grid" }, Yw = { class: "ox-vite-stat-card" }, Gw = { class: "ox-vite-stat-card" }, Qw = { class: "ox-vite-stat-card" }, Xw = { class: "ox-vite-stat-card" }, Jw = { class: "ox-vite-sandbox-layout" }, Zw = { class: "ox-vite-panel-card" }, e0 = { class: "ox-vite-panel-card__head" }, t0 = { class: "ox-vite-ops-header__kicker" }, s0 = { class: "ox-vite-sandbox-workspace-shell" }, n0 = { class: "ox-vite-workspace-grid ox-vite-workspace-grid--compact" }, l0 = ["onClick"], a0 = { class: "ox-vite-workspace-card__head" }, o0 = { class: "ox-vite-workspace-card__identity" }, i0 = { class: "ox-vite-workspace-card__copy" }, r0 = { class: "ox-vite-workspace-card__name" }, u0 = { class: "ox-vite-workspace-card__meta" }, c0 = { class: "ox-vite-chip-grid" }, d0 = { class: "ox-vite-detail-chip" }, p0 = { class: "ox-vite-detail-chip" }, f0 = { class: "ox-vite-workspace-card__actions" }, v0 = ["onClick"], g0 = {
  key: 0,
  class: "ox-vite-sandbox-detail-card"
}, m0 = { class: "ox-vite-panel-card__head" }, y0 = { class: "ox-vite-ops-header__kicker" }, h0 = { class: "ox-vite-sandbox-detail-card__hero" }, _0 = { class: "ox-vite-sandbox-detail-card__title" }, b0 = { class: "ox-vite-sandbox-detail-card__meta" }, x0 = { class: "ox-vite-chip-grid" }, k0 = { class: "ox-vite-detail-chip" }, S0 = { class: "ox-vite-detail-chip" }, w0 = { class: "ox-vite-detail-chip" }, C0 = { class: "ox-vite-workspace-card__actions" }, M0 = { class: "ox-vite-panel-card" }, R0 = { class: "ox-vite-panel-card__head" }, T0 = { class: "ox-vite-ops-header__kicker" }, $0 = ["disabled"], A0 = {
  key: 0,
  class: "ox-vite-sandbox-project-shell"
}, I0 = { class: "ox-vite-role-template-grid" }, E0 = ["onClick"], P0 = { class: "ox-vite-project-card__head" }, D0 = { class: "ox-vite-project-card__name" }, O0 = { class: "ox-vite-project-card__meta" }, V0 = { class: "ox-vite-chip-grid" }, L0 = { class: "ox-vite-detail-chip" }, F0 = {
  key: 0,
  class: "ox-vite-sandbox-detail-card"
}, N0 = { class: "ox-vite-panel-card__head" }, j0 = { class: "ox-vite-ops-header__kicker" }, W0 = { class: "ox-vite-sandbox-detail-card__hero" }, B0 = { class: "ox-vite-sandbox-detail-card__title" }, U0 = { class: "ox-vite-sandbox-detail-card__meta" }, K0 = { class: "ox-vite-sandbox-detail-card__summary" }, q0 = { class: "ox-vite-workspace-card__actions" }, H0 = {
  key: 1,
  class: "ox-vite-empty-state"
}, z0 = { class: "ox-vite-panel-card" }, Y0 = { class: "ox-vite-panel-card__head" }, G0 = { class: "ox-vite-ops-header__kicker" }, Q0 = {
  key: 0,
  class: "ox-vite-sandbox-roster-shell"
}, X0 = { class: "ox-vite-role-library-grid" }, J0 = ["onClick"], Z0 = { class: "ox-vite-role-library-card__hero" }, eC = { class: "ox-vite-role-library-card__icon" }, tC = { class: "ox-vite-role-library-card__identity" }, sC = { class: "ox-vite-role-library-card__name" }, nC = { class: "ox-vite-role-library-card__meta" }, lC = { key: 0 }, aC = { key: 1 }, oC = { class: "ox-vite-chip-grid" }, iC = { class: "ox-vite-detail-chip" }, rC = {
  key: 0,
  class: "ox-vite-sandbox-detail-card"
}, uC = { class: "ox-vite-panel-card__head" }, cC = { class: "ox-vite-ops-header__kicker" }, dC = { class: "ox-vite-sandbox-detail-card__hero" }, pC = { class: "ox-vite-role-library-card__icon ox-vite-role-library-card__icon--large" }, fC = { class: "ox-vite-sandbox-detail-card__title" }, vC = { class: "ox-vite-sandbox-detail-card__meta" }, gC = { key: 0 }, mC = { class: "ox-vite-sandbox-detail-card__summary" }, yC = { class: "ox-vite-chip-grid" }, hC = { class: "ox-vite-detail-chip" }, _C = { class: "ox-vite-workspace-card__actions" }, bC = {
  key: 1,
  class: "ox-vite-empty-state"
}, xC = {
  key: 7,
  class: "ox-vite-media-grid"
}, kC = { class: "ox-vite-chip-grid" }, SC = { class: "ox-vite-detail-chip" }, wC = ["aria-label"], CC = { class: "ox-ops-storage-metrics" }, MC = {
  class: "ox-ops-storage-metric__icon",
  "aria-hidden": "true"
}, RC = { key: 0 }, TC = { class: "ox-ops-storage-overview__footer" }, $C = { class: "ox-ops-storage-overview__label" }, AC = {
  key: 2,
  class: "ox-vite-panel-card"
}, IC = { class: "ox-vite-panel-card__head" }, EC = { class: "ox-vite-list" }, PC = {
  key: 0,
  class: "ox-ops-vault-empty"
}, DC = { class: "ox-vite-tab-strip" }, OC = ["onClick"], VC = { class: "ox-vite-stat-grid" }, LC = { class: "ox-vite-card-grid" }, FC = { class: "ox-vite-panel-card" }, NC = { class: "ox-vite-panel-card__head" }, jC = { class: "ox-vite-list" }, WC = { class: "ox-vite-panel-card" }, BC = { class: "ox-vite-panel-card__head" }, UC = { class: "ox-vite-list" }, KC = {
  __name: "App",
  props: {
    surface: {
      type: String,
      default: ""
    }
  },
  setup(e) {
    const t = e, n = od(), a = /* @__PURE__ */ pe(null), o = /* @__PURE__ */ pe(n.snapshot(t.surface)), i = se(() => ({
      storage: "fa-solid fa-database",
      system: "fa-solid fa-sliders",
      enterprise: "fa-solid fa-building",
      deploy: "fa-solid fa-robot",
      workbench: "fa-solid fa-terminal",
      kernel: "fa-solid fa-microchip"
    })[t.surface] || "fa-solid fa-layer-group");
    let p = null, f = !1;
    function g() {
      const S = n.snapshot(t.surface), v = !f && S.isActive;
      o.value = S, v && n.ensureLoaded(t.surface).finally(() => {
        o.value = n.snapshot(t.surface);
      }), f = S.isActive;
    }
    function m(S) {
      n.selectSurfaceTab(t.surface, S).finally(g);
    }
    function h() {
      if (t.surface === "storage" && o.value?.activeTab === "memory-v3" && a.value) {
        a.value.refresh().catch(() => {
        }).finally(g);
        return;
      }
      n.refreshSurface(t.surface).finally(g);
    }
    function R() {
      n.runSystemUpdateCheck().finally(g);
    }
    function b() {
      n.openAboutSurface().finally(g);
    }
    function A(S, v) {
      n.updateSystemSetting(S, v).finally(g);
    }
    function B() {
      n.openSkinStudio().finally(g);
    }
    function J(S) {
      n.activateSkin(S).finally(g);
    }
    function G(S = {}) {
      return {
        "--skin-preview-primary": S.primary || "#21859c",
        "--skin-preview-background": S.background || "#f1f7fa",
        "--skin-preview-surface": S.surface || "#ffffff",
        "--skin-preview-text": S.text || "#263f4a",
        "--skin-preview-radius": `${S.radius ?? 14}px`
      };
    }
    function $(S, v) {
      A(S, v?.target?.value ?? v);
    }
    function Q(S, v) {
      A(S, !!v?.target?.checked);
    }
    function ae(S) {
      n.setSystemTargetLanguage(S?.target?.value || "system").finally(g);
    }
    function w() {
      n.clearSystemRuntimeCache().finally(g);
    }
    function _e(S) {
      n.runSystemQuickAction(S).finally(g);
    }
    function ye(S) {
      n.openSystemPath(S).finally(g);
    }
    function ne() {
      n.resetSystemSettings().finally(g);
    }
    function Ce() {
      n.loadFeaturePacks(!0).finally(g);
    }
    function ke(S, v) {
      !v?.capabilityId || Z(v) || S === "uninstall" && !window.confirm(
        d.value ? `确认卸载“${v.displayName}”？应用重启后该能力将不可用。` : `Uninstall “${v.displayName}”? This capability will be unavailable after restart.`
      ) || n.runFeaturePackOperation(S, v.capabilityId).catch(() => {
      }).finally(g);
    }
    function Z(S) {
      const v = String(S?.progress?.phase || "");
      return !!S?.operation || !!v && v !== "completed" && v !== "failed";
    }
    function Me(S) {
      return (d.value ? {
        "not-installed": "未安装",
        installed: "已安装",
        "update-available": "可更新",
        damaged: "需要修复"
      } : {
        "not-installed": "Not installed",
        installed: "Installed",
        "update-available": "Update available",
        damaged: "Repair required"
      })[S] || S;
    }
    function ie(S) {
      return {
        "not-installed": "fa-regular fa-circle",
        installed: "fa-solid fa-circle-check",
        "update-available": "fa-solid fa-circle-arrow-up",
        damaged: "fa-solid fa-triangle-exclamation"
      }[S] || "fa-regular fa-circle-question";
    }
    function k(S) {
      return (d.value ? {
        preparing: "准备中",
        downloading: "正在下载",
        "verifying-archive": "校验归档",
        extracting: "安全解包",
        "verifying-pack": "校验签名与文件",
        installing: "正在安装",
        removing: "正在卸载",
        completed: "操作完成",
        failed: "操作失败"
      } : {
        preparing: "Preparing",
        downloading: "Downloading",
        "verifying-archive": "Verifying archive",
        extracting: "Extracting safely",
        "verifying-pack": "Verifying signature and files",
        installing: "Installing",
        removing: "Uninstalling",
        completed: "Completed",
        failed: "Failed"
      })[S] || S;
    }
    function H(S) {
      const v = Number(S);
      return !Number.isFinite(v) || v < 0 ? "" : v < 1024 ? `${v} B` : v < 1024 * 1024 ? `${(v / 1024).toFixed(1)} KB` : `${(v / (1024 * 1024)).toFixed(1)} MB`;
    }
    function ve() {
      t.surface === "deploy" ? n.startPrimaryDeployAction().finally(g) : t.surface === "workbench" ? n.openTaskCenter().finally(g) : t.surface === "storage" ? o.value?.activeTab === "memory-v3" ? a.value?.openCreate() : n.jumpToMenu("storage", "text").finally(g) : t.surface === "kernel" ? n.selectSurfaceTab("kernel", "actions").finally(g) : t.surface === "system" && (o.value?.activeTab === "about" ? n.runSystemUpdateCheck().finally(g) : n.selectSurfaceTab("system", "about").finally(g));
    }
    function be(S) {
      n.openTask(S).finally(g);
    }
    const he = /* @__PURE__ */ pe(!1), le = /* @__PURE__ */ pe("builtin"), Le = /* @__PURE__ */ pe(""), Fe = /* @__PURE__ */ pe(""), Te = /* @__PURE__ */ pe("builtin"), $e = /* @__PURE__ */ pe(""), ce = /* @__PURE__ */ pe(""), O = /* @__PURE__ */ pe("all"), M = /* @__PURE__ */ pe(""), V = /* @__PURE__ */ pe("all"), Se = /* @__PURE__ */ pe(!1), He = /* @__PURE__ */ pe(!1), tt = /* @__PURE__ */ pe("summary"), ze = /* @__PURE__ */ pe([]), Ke = /* @__PURE__ */ pe({
      id: "",
      name: "",
      description: "",
      category: ""
    }), y = /* @__PURE__ */ pe(""), x = /* @__PURE__ */ pe(""), T = /* @__PURE__ */ pe("");
    function N() {
      n.startVrm().finally(g);
    }
    function C() {
      n.startVrmWeb().finally(g);
    }
    function F(S) {
      const v = typeof S == "object" && S ? S : { id: S };
      if (v.cloud && !v.downloaded) {
        ee(v);
        return;
      }
      n.setVrmModel(v.id).finally(g);
    }
    function ee(S, v) {
      v && v.stopPropagation(), !(!S?.id || Fe.value) && (Fe.value = S.id, n.downloadVrmModel(S.id).catch(() => {
      }).finally(() => {
        Fe.value = "", g();
      }));
    }
    function X(S, v) {
      v && v.stopPropagation(), n.deleteVrmUserModel(S).finally(g);
    }
    function Y(S) {
      n.toggleVrmMotion(S).finally(g);
    }
    function j(S, v) {
      v && v.stopPropagation(), n.deleteVrmUserMotion(S).finally(g);
    }
    function re(S) {
      n.setVrmExpressionsEnabled(S.target.checked).finally(g);
    }
    function te(S) {
      n.setVrmMotionsEnabled(S.target.checked).finally(g);
    }
    function oe(S) {
      n.setVrmWindowWidth(S.target.value).finally(g);
    }
    function E(S) {
      n.setVrmWindowHeight(S.target.value).finally(g);
    }
    function D(S) {
      n.setVrmAgent(S.target.value).finally(g);
    }
    function L() {
      n.openAddVrmModel().finally(g);
    }
    function ge() {
      n.openAddVrmMotion().finally(g);
    }
    function Re() {
      n.openEnterpriseStaffRoleForm().finally(g);
    }
    function qe(S) {
      n.createEnterpriseStaffRoleFromTemplate(S).finally(g);
    }
    function ut(S) {
      n.deleteEnterpriseStaffRole(S).finally(g);
    }
    function ot() {
      n.openEnterpriseWorkspaceForm().finally(g);
    }
    function Ht(S) {
      y.value = String(S || ""), n.openEnterpriseWorkspaceForm(S).finally(g);
    }
    function rs(S) {
      y.value = String(S || ""), n.openEnterpriseWorkspace(S).finally(g);
    }
    function st(S) {
      y.value === String(S || "") && (y.value = ""), n.deleteEnterpriseWorkspace(S).finally(g);
    }
    function ct(S) {
      n.openEnterpriseProjectForm(S).finally(g);
    }
    function Js(S, v = "") {
      x.value = String(S || ""), n.openEnterpriseProjectForm(v, S).finally(g);
    }
    function Zs(S) {
      const v = String(S || "");
      x.value === v && (x.value = ""), n.deleteEnterpriseProject(S).finally(g);
    }
    function Ho() {
      y.value = "", x.value = "", T.value = "", n.sandboxGoBack().finally(g);
    }
    function zo(S) {
      const v = Number(S?.level || 0);
      v <= 0 ? (y.value = "", x.value = "", T.value = "") : v === 1 ? (y.value = String(S?.id || ""), x.value = "", T.value = "") : v === 2 && (x.value = String(S?.id || "")), n.navigateEnterpriseSandbox(v, S?.id || "").finally(g);
    }
    function Yo(S) {
      x.value = String(S || ""), n.openEnterpriseProject(S).finally(g);
    }
    function Go(S) {
      x.value = String(S || "");
    }
    function Qo(S) {
      T.value = String(S || "");
    }
    function Xo(S) {
      T.value = String(S || ""), n.openEnterpriseSandboxAgentChat(S).finally(g);
    }
    function Jo(S) {
      T.value = String(S || ""), n.openEnterpriseStaffRoleForm(S).finally(g);
    }
    function Zo() {
      n.openEnterpriseStaffRoleForProject(
        Ve.value.currentWorkspaceId,
        Ve.value.currentProjectId || x.value
      ).finally(g);
    }
    function ei() {
      Ke.value = {
        id: "",
        name: "",
        description: "",
        category: Ln.value[1]?.id || "general"
      }, He.value = !1, tt.value = "editor", Se.value = !0;
    }
    function ti(S) {
      Ke.value = {
        id: S?.id || "",
        name: S?.name || "",
        description: S?.description || "",
        category: S?.category || ""
      }, He.value = !1, tt.value = "editor", Se.value = !0;
    }
    async function si() {
      try {
        await n.saveEnterpriseKnowledgeBase(Ke.value), Se.value = !1, tt.value = "summary", g();
      } catch (S) {
        console.error(S);
      }
    }
    function ni(S) {
      n.deleteEnterpriseKnowledgeBase(S?.id).then(g).catch((v) => {
        console.error(v);
      });
    }
    async function li(S) {
      Se.value = !1, tt.value = "versions", He.value = !0, ze.value = [];
      try {
        ze.value = await n.loadEnterpriseKnowledgeBaseVersions(S?.id);
      } catch (v) {
        console.error(v), ze.value = [];
      }
    }
    const _ = se(() => o.value || {}), d = se(() => _.value.isZh), Xe = se(() => _.value.featurePacks || {}), we = se(() => _.value.vrm || {}), en = se(() => (we.value.motions || []).filter((S) => S.selected)), ws = se(() => _.value.rolePanel || {}), Cs = se(() => ws.value.items || []), Zt = se(() => ws.value.templates || []), Ll = se(() => _.value.workspacePanel || {}), Ve = se(() => _.value.sandboxPanel || {}), es = se(() => _.value.knowledgePanel || {}), ai = se(() => _.value.memoryV3 || {}), oi = se(() => {
      const S = /* @__PURE__ */ new Set(), v = [];
      return Zt.value.forEach((r) => {
        const W = String(r?.category || "").trim();
        !W || S.has(W) || (S.add(W), v.push({
          id: W,
          label: String(r?.categoryLabel || W)
        }));
      }), [
        {
          id: "all",
          label: d.value ? "全部岗位" : "All Roles"
        },
        ...v
      ];
    }), En = se(() => {
      const S = String(O.value || "all").trim(), v = String(ce.value || "").trim().toLowerCase();
      return Zt.value.filter((r) => S !== "all" && String(r?.category || "").trim() !== S ? !1 : v ? [
        r?.name,
        r?.department,
        r?.summary,
        r?.categoryLabel,
        ...r?.skills || []
      ].filter(Boolean).join(" ").toLowerCase().includes(v) : !0);
    }), ii = se(() => {
      const S = Zt.value.filter((v) => v?.featured);
      return (S.length ? S : Zt.value).slice(0, 4);
    }), Fl = se(() => we.value.defaultModels || []), Pn = se(() => we.value.cloudModels || []), Dn = se(() => we.value.userModels || []), Nl = se(() => {
      const S = le.value === "custom" ? Dn.value : le.value === "cloud" ? Pn.value : Fl.value, v = String(Le.value || "").trim().toLowerCase();
      return v ? S.filter((r) => [r.name, r.id, r.relativePath].filter(Boolean).join(" ").toLowerCase().includes(v)) : S;
    }), jl = se(() => (we.value.motions || []).filter((S) => S.builtin)), On = se(() => (we.value.motions || []).filter((S) => !S.builtin)), Wl = se(() => {
      const S = Te.value === "custom" ? On.value : jl.value, v = String($e.value || "").trim().toLowerCase();
      return v ? S.filter((r) => String(r.name || r.id || "").toLowerCase().includes(v)) : S;
    });
    function ri(S) {
      return String(S || "all") === "all" ? Zt.value.length : Zt.value.filter((v) => String(v?.category || "") === String(S || "")).length;
    }
    function Vn(S) {
      const v = Array.isArray(S?.accent) && S.accent.length ? S.accent : ["#4ecdc4", "#5b8cff"];
      return {
        "--ox-vite-role-accent-start": v[0],
        "--ox-vite-role-accent-end": v[1] || v[0]
      };
    }
    function Bl(S) {
      const v = String(S || "default");
      return d.value ? {
        default: "默认权限",
        readonly: "只读",
        write: "读写",
        admin: "管理"
      }[v] || v : {
        default: "Default",
        readonly: "Read only",
        write: "Read / Write",
        admin: "Admin"
      }[v] || v;
    }
    function Ul(S) {
      const v = String(S || "").trim().toLowerCase();
      return d.value ? {
        online: "在线",
        idle: "待命",
        busy: "执行中",
        running: "运行中",
        offline: "离线",
        unknown: "未知"
      }[v] || S || "未知" : {
        online: "Online",
        idle: "Idle",
        busy: "Busy",
        running: "Running",
        offline: "Offline",
        unknown: "Unknown"
      }[v] || S || "Unknown";
    }
    const Ln = se(() => {
      const S = /* @__PURE__ */ new Set(), v = [];
      return (es.value.items || []).forEach((r) => {
        const W = String(r?.category || "").trim();
        !W || S.has(W) || (S.add(W), v.push({ id: W, label: W }));
      }), [
        {
          id: "all",
          label: d.value ? "全部知识库" : "All KBs"
        },
        ...v
      ];
    }), Fn = se(() => {
      const S = String(V.value || "all").trim(), v = String(M.value || "").trim().toLowerCase();
      return (es.value.items || []).filter((r) => S !== "all" && String(r?.category || "") !== S ? !1 : v ? [r?.name, r?.category, r?.description].filter(Boolean).join(" ").toLowerCase().includes(v) : !0);
    }), it = se(() => {
      const S = Ve.value.projects || [];
      return S.find((r) => String(r?.id || "") === String(x.value || "")) || S[0] || null;
    }), Ye = se(() => {
      const S = Ve.value.items || [];
      return S.find((r) => String(r?.id || "") === String(T.value || "")) || S[0] || null;
    }), dt = se(() => {
      const S = Ve.value.workspaces || [], v = String(y.value || Ve.value.currentWorkspaceId || "");
      return S.find((W) => String(W?.id || "") === v) || S[0] || null;
    });
    return Gt(
      Ve,
      (S) => {
        const v = String(S?.currentWorkspaceId || "").trim(), r = String(S?.currentProjectId || "").trim(), W = String(S?.selectedAgentId || "").trim();
        v ? y.value = v : (S?.workspaces || []).some((ts) => String(ts?.id || "") === String(y.value || "")) || (y.value = ""), r ? x.value = r : (S?.projects || []).some((ts) => String(ts?.id || "") === String(x.value || "")) || (x.value = ""), W ? T.value = W : (S?.items || []).some((ts) => String(ts?.id || "") === String(T.value || "")) || (T.value = "");
      },
      { deep: !0 }
    ), Tl(() => {
      g(), p = window.setInterval(g, 800);
    }), $l(() => {
      p && (window.clearInterval(p), p = null);
    }), (S, v) => (u(), c("div", {
      class: q(["ox-vite-ops-shell", [`surface-${t.surface}`, { "is-memory-workspace": t.surface === "storage" && _.value.activeTab === "memory-v3" }]]),
      "data-active-tab": _.value.activeTab
    }, [
      t.surface === "task" ? (u(), c(I, { key: 0 }, [
        s("div", og, [
          s("div", null, [
            s("div", ig, l((d.value, "Task Board")), 1),
            s("h1", null, l(_.value.title), 1),
            s("p", null, l(_.value.subtitle), 1)
          ]),
          s("div", rg, [
            s("button", {
              type: "button",
              class: "ox-vite-ops-secondary-btn",
              onClick: h
            }, [
              v[39] || (v[39] = s("i", { class: "fa-solid fa-rotate-right" }, null, -1)),
              s("span", null, l(d.value ? "刷新" : "Refresh"), 1)
            ])
          ])
        ]),
        s("div", ug, [
          s("section", cg, [
            (u(!0), c(I, null, U(_.value.columns || [], (r) => (u(), c("article", {
              key: r.id,
              class: "ox-vite-task-column"
            }, [
              s("div", dg, [
                s("h2", null, l(r.title), 1),
                s("span", null, l((r.tasks || []).length), 1)
              ]),
              (r.tasks || []).length ? P("", !0) : (u(), c("div", pg, [
                s("strong", null, l(r.emptyTitle), 1),
                s("p", null, l(r.emptyCopy), 1)
              ])),
              (u(!0), c(I, null, U(r.tasks || [], (W) => (u(), c("button", {
                key: W.id,
                type: "button",
                class: q(["ox-vite-task-card", `is-${W.status || "pending"}`]),
                onClick: (ts) => be(W.raw)
              }, [
                s("div", vg, l(W.title), 1),
                s("div", gg, l(W.summary), 1),
                W.progress !== null ? (u(), c("div", mg, [
                  s("div", {
                    class: "ox-vite-task-progress__fill",
                    style: pt({ width: `${Math.max(0, Math.min(100, W.progress))}%` })
                  }, null, 4)
                ])) : P("", !0),
                s("div", yg, [
                  s("span", null, l(W.assignee || (d.value ? "未分配" : "Unassigned")), 1),
                  s("span", null, l(W.updatedAt), 1)
                ])
              ], 10, fg))), 128))
            ]))), 128))
          ]),
          s("aside", hg, [
            s("div", _g, [
              s("h2", null, l(d.value ? "任务详情" : "Task Detail"), 1)
            ]),
            _.value.detail ? (u(), c(I, { key: 0 }, [
              s("div", bg, l(_.value.detail.title), 1),
              s("div", xg, l(_.value.detail.status || (d.value ? "待处理" : "Pending")), 1),
              s("p", kg, l(_.value.detail.summary), 1),
              s("div", Sg, [
                (u(!0), c(I, null, U(_.value.detail.trace || [], (r) => (u(), c("div", {
                  key: r.id,
                  class: "ox-vite-task-detail__trace-item"
                }, l(r.text), 1))), 128))
              ])
            ], 64)) : (u(), c("div", wg, [
              v[40] || (v[40] = s("i", { class: "fa-solid fa-list-check" }, null, -1)),
              s("strong", null, l(d.value ? "选择一个任务查看详情" : "Select a task to inspect"), 1)
            ]))
          ])
        ])
      ], 64)) : t.surface === "about" ? (u(), c("div", Cg, [
        v[41] || (v[41] = s("div", { class: "ox-vite-about-mark" }, [
          s("img", {
            src: "/source/icon.png",
            alt: "OpenXnet"
          })
        ], -1)),
        s("div", Mg, l(_.value.title), 1),
        s("div", Rg, "v" + l(_.value.version), 1),
        s("p", Tg, l(_.value.subtitle), 1),
        s("section", $g, [
          (u(!0), c(I, null, U(_.value.features || [], (r) => (u(), c("article", {
            key: r.title,
            class: "ox-vite-info-card"
          }, [
            s("div", Ag, [
              s("i", {
                class: q(r.icon)
              }, null, 2)
            ]),
            s("div", null, [
              s("h3", null, l(r.title), 1),
              s("p", null, l(r.description), 1)
            ])
          ]))), 128))
        ]),
        s("section", Ig, [
          (u(!0), c(I, null, U(_.value.links || [], (r) => (u(), c("a", {
            key: r.href,
            class: "ox-vite-link-card",
            href: r.href,
            target: "_blank",
            rel: "noreferrer"
          }, [
            s("span", null, l(r.label), 1),
            s("strong", null, l(r.value), 1)
          ], 8, Eg))), 128))
        ]),
        s("section", Pg, [
          (u(!0), c(I, null, U(_.value.facts || [], (r) => (u(), c("article", {
            key: r.label,
            class: "ox-vite-fact-row"
          }, [
            s("span", null, l(r.label), 1),
            s("p", null, l(r.value), 1)
          ]))), 128))
        ])
      ])) : t.surface === "vrm" ? (u(), c("div", Dg, [
        s("div", Og, [
          s("header", Vg, [
            s("div", Lg, [
              s("div", Fg, l(d.value ? "VRM 桌宠" : "VRM Pet"), 1),
              s("h1", null, l(_.value.title), 1),
              s("p", null, l(_.value.subtitle), 1),
              _.value.meta?.setupSteps?.length ? (u(), c("div", Ng, [
                s("div", jg, [
                  v[42] || (v[42] = s("i", { class: "fa-solid fa-route" }, null, -1)),
                  s("span", null, l(_.value.meta?.guideNote), 1)
                ]),
                s("div", Wg, [
                  (u(!0), c(I, null, U(_.value.meta?.setupSteps || [], (r, W) => (u(), c("span", {
                    key: r.title,
                    class: "ox-vite-vrm-guide__step"
                  }, [
                    s("span", Bg, l(W + 1), 1),
                    s("i", {
                      class: q(r.icon)
                    }, null, 2),
                    s("span", Ug, [
                      s("strong", null, l(r.title), 1),
                      s("small", null, l(r.desc), 1)
                    ])
                  ]))), 128))
                ])
              ])) : P("", !0)
            ])
          ]),
          _.value.meta?.chips?.length ? (u(), c("section", Kg, [
            (u(!0), c(I, null, U(_.value.meta.chips || [], (r) => (u(), c("span", {
              key: r.icon + r.text,
              class: "ox-vite-detail-chip"
            }, [
              s("i", {
                class: q(r.icon)
              }, null, 2),
              s("span", null, l(r.text), 1)
            ]))), 128))
          ])) : P("", !0),
          _.value.stats?.length ? (u(), c("section", qg, [
            (u(!0), c(I, null, U(_.value.stats, (r) => (u(), c("article", {
              key: r.label,
              class: q(["ox-vite-stat-card", { emphasis: r.emphasis }])
            }, [
              s("span", null, l(r.label), 1),
              s("strong", null, l(r.value), 1),
              s("small", null, l(r.meta), 1)
            ], 2))), 128))
          ])) : P("", !0),
          s("article", Hg, [
            s("div", zg, [
              s("div", null, [
                s("h2", null, l(d.value ? "VRM 模型" : "VRM Model"), 1),
                s("p", null, l(d.value ? "内置和自定义模型分开管理，搜索过滤后从列表中点选。" : "Built-in and custom models are split. Search to filter, click to select."), 1)
              ]),
              s("button", {
                type: "button",
                class: "ox-vite-ops-secondary-btn",
                onClick: L
              }, [
                v[43] || (v[43] = s("i", { class: "fa-solid fa-plus" }, null, -1)),
                s("span", null, l(d.value ? "上传模型" : "Upload"), 1)
              ])
            ]),
            s("div", Yg, [
              s("button", {
                type: "button",
                class: q(["ox-vite-vrm-tab", { "is-active": le.value === "builtin" }]),
                onClick: v[0] || (v[0] = (r) => le.value = "builtin")
              }, [
                v[44] || (v[44] = s("i", { class: "fa-solid fa-star" }, null, -1)),
                s("span", null, l(d.value ? "内置模型" : "Built-in"), 1),
                s("span", Gg, l(Fl.value.length), 1)
              ], 2),
              s("button", {
                type: "button",
                class: q(["ox-vite-vrm-tab", { "is-active": le.value === "cloud" }]),
                onClick: v[1] || (v[1] = (r) => le.value = "cloud")
              }, [
                v[45] || (v[45] = s("i", { class: "fa-solid fa-cloud-arrow-down" }, null, -1)),
                s("span", null, l(d.value ? "资源库" : "Library"), 1),
                s("span", Qg, l(Pn.value.length), 1)
              ], 2),
              s("button", {
                type: "button",
                class: q(["ox-vite-vrm-tab", { "is-active": le.value === "custom" }]),
                onClick: v[2] || (v[2] = (r) => le.value = "custom")
              }, [
                v[46] || (v[46] = s("i", { class: "fa-solid fa-user" }, null, -1)),
                s("span", null, l(d.value ? "自定义" : "Custom"), 1),
                s("span", Xg, l(Dn.value.length), 1)
              ], 2)
            ]),
            s("div", Jg, [
              v[48] || (v[48] = s("i", { class: "fa-solid fa-magnifying-glass" }, null, -1)),
              je(s("input", {
                type: "text",
                placeholder: d.value ? "搜索模型..." : "Search models...",
                "onUpdate:modelValue": v[3] || (v[3] = (r) => Le.value = r)
              }, null, 8, Zg), [
                [Qe, Le.value]
              ]),
              Le.value ? (u(), c("button", {
                key: 0,
                type: "button",
                class: "ox-vite-vrm-search__clear",
                onClick: v[4] || (v[4] = (r) => Le.value = "")
              }, [...v[47] || (v[47] = [
                s("i", { class: "fa-solid fa-xmark" }, null, -1)
              ])])) : P("", !0)
            ]),
            s("div", em, [
              (u(!0), c(I, null, U(Nl.value, (r) => (u(), c("button", {
                key: r.id,
                type: "button",
                class: q(["ox-vite-vrm-row", {
                  "is-active": we.value.selectedModelId === r.id,
                  "is-cloud": r.cloud,
                  "is-downloading": Fe.value === r.id
                }]),
                disabled: Fe.value === r.id,
                onClick: (W) => F(r)
              }, [
                s("span", sm, [
                  s("i", {
                    class: q(r.cloud ? "fa-solid fa-cloud-arrow-down" : r.builtin ? "fa-solid fa-vr-cardboard" : "fa-solid fa-cube")
                  }, null, 2)
                ]),
                s("span", nm, [
                  s("span", lm, l(r.name), 1),
                  s("span", am, l(r.cloud ? r.downloaded ? d.value ? "已下载资源" : "Downloaded resource" : d.value ? "云端资源，点击下载" : "Cloud resource, click to download" : r.builtin ? d.value ? "内置模型" : "Built-in" : d.value ? "自定义模型" : "Custom"), 1)
                ]),
                we.value.selectedModelId === r.id ? (u(), c("i", om)) : r.cloud ? (u(), c("span", {
                  key: 1,
                  class: q(["ox-vite-vrm-row__download", { "is-ready": r.downloaded }]),
                  onClick: (W) => r.downloaded ? F(r) : ee(r, W)
                }, [
                  s("i", {
                    class: q(Fe.value === r.id ? "fa-solid fa-spinner fa-spin" : r.downloaded ? "fa-solid fa-check" : "fa-solid fa-download")
                  }, null, 2),
                  s("span", null, l(Fe.value === r.id ? d.value ? "下载中" : "Downloading" : r.downloaded ? d.value ? "使用" : "Use" : d.value ? "下载" : "Download"), 1)
                ], 10, im)) : P("", !0),
                !r.builtin && (!r.cloud || r.downloaded) ? (u(), c("span", {
                  key: 2,
                  class: "ox-vite-vrm-row__del",
                  title: d.value ? "删除" : "Delete",
                  onClick: (W) => X(r.id, W)
                }, [...v[49] || (v[49] = [
                  s("i", { class: "fa-regular fa-trash-can" }, null, -1)
                ])], 8, rm)) : P("", !0)
              ], 10, tm))), 128)),
              Nl.value.length ? P("", !0) : (u(), c("div", um, [
                le.value === "custom" && !Dn.value.length ? (u(), c("span", cm, l(d.value ? "尚未上传自定义模型" : "No custom models yet"), 1)) : le.value === "cloud" && !Pn.value.length ? (u(), c("span", dm, l(d.value ? "资源库暂无可下载模型" : "No downloadable models yet"), 1)) : Le.value ? (u(), c("span", pm, l(d.value ? "没有匹配的模型" : "No matching models"), 1)) : (u(), c("span", fm, l(d.value ? "无可用模型" : "No models available"), 1))
              ]))
            ])
          ]),
          s("article", vm, [
            s("div", gm, [
              s("div", null, [
                s("h2", null, l(d.value ? "动作与窗口" : "Behavior & Window"), 1),
                s("p", null, l(d.value ? "主智能体、表情/动作开关与桌宠默认窗口尺寸。" : "Main agent, expression/motion toggles, and default window size."), 1)
              ])
            ]),
            s("div", mm, [
              s("label", ym, [
                s("span", null, l(d.value ? "主智能体" : "Main Agent"), 1),
                s("select", {
                  value: we.value.mainAgent,
                  onChange: D
                }, [
                  (u(!0), c(I, null, U(we.value.agentOptions || [], (r) => (u(), c("option", {
                    key: r.id,
                    value: r.id
                  }, l(r.name), 9, _m))), 128))
                ], 40, hm)
              ]),
              s("label", bm, [
                s("span", null, l(d.value ? "启用表情" : "Enable expressions"), 1),
                s("span", xm, [
                  s("input", {
                    type: "checkbox",
                    checked: we.value.enabledExpressions,
                    onChange: re
                  }, null, 40, km),
                  s("span", null, l(we.value.enabledExpressions ? d.value ? "已开启" : "On" : d.value ? "已关闭" : "Off"), 1)
                ])
              ]),
              s("label", Sm, [
                s("span", null, l(d.value ? "启用动作" : "Enable motions"), 1),
                s("span", wm, [
                  s("input", {
                    type: "checkbox",
                    checked: we.value.enabledMotions,
                    onChange: te
                  }, null, 40, Cm),
                  s("span", null, l(we.value.enabledMotions ? d.value ? "已开启" : "On" : d.value ? "已关闭" : "Off"), 1)
                ])
              ]),
              s("label", Mm, [
                s("span", null, l(d.value ? "窗口宽度 (px)" : "Width (px)"), 1),
                s("input", {
                  type: "number",
                  min: "300",
                  max: "3840",
                  step: "10",
                  value: we.value.windowWidth,
                  onChange: oe
                }, null, 40, Rm)
              ]),
              s("label", Tm, [
                s("span", null, l(d.value ? "窗口高度 (px)" : "Height (px)"), 1),
                s("input", {
                  type: "number",
                  min: "300",
                  max: "3840",
                  step: "10",
                  value: we.value.windowHeight,
                  onChange: E
                }, null, 40, $m)
              ])
            ])
          ]),
          s("article", Am, [
            s("div", Im, [
              s("div", null, [
                s("h2", null, l(d.value ? "VRMA 动作" : "VRMA Motions"), 1),
                s("p", null, l(d.value ? "在内置 / 自定义两组动作里勾选启用项，会同步进桌宠运行环境。" : "Tick motions from built-in or custom groups; the desktop pet picks them up."), 1)
              ]),
              s("button", {
                type: "button",
                class: "ox-vite-ops-secondary-btn",
                onClick: ge
              }, [
                v[50] || (v[50] = s("i", { class: "fa-solid fa-plus" }, null, -1)),
                s("span", null, l(d.value ? "上传动作" : "Upload"), 1)
              ])
            ]),
            s("div", Em, [
              s("button", {
                type: "button",
                class: q(["ox-vite-vrm-tab", { "is-active": Te.value === "builtin" }]),
                onClick: v[5] || (v[5] = (r) => Te.value = "builtin")
              }, [
                v[51] || (v[51] = s("i", { class: "fa-solid fa-star" }, null, -1)),
                s("span", null, l(d.value ? "内置动作" : "Built-in"), 1),
                s("span", Pm, l(jl.value.length), 1)
              ], 2),
              s("button", {
                type: "button",
                class: q(["ox-vite-vrm-tab", { "is-active": Te.value === "custom" }]),
                onClick: v[6] || (v[6] = (r) => Te.value = "custom")
              }, [
                v[52] || (v[52] = s("i", { class: "fa-solid fa-user" }, null, -1)),
                s("span", null, l(d.value ? "自定义" : "Custom"), 1),
                s("span", Dm, l(On.value.length), 1)
              ], 2)
            ]),
            s("div", Om, [
              v[54] || (v[54] = s("i", { class: "fa-solid fa-magnifying-glass" }, null, -1)),
              je(s("input", {
                type: "text",
                placeholder: d.value ? "搜索动作..." : "Search motions...",
                "onUpdate:modelValue": v[7] || (v[7] = (r) => $e.value = r)
              }, null, 8, Vm), [
                [Qe, $e.value]
              ]),
              $e.value ? (u(), c("button", {
                key: 0,
                type: "button",
                class: "ox-vite-vrm-search__clear",
                onClick: v[8] || (v[8] = (r) => $e.value = "")
              }, [...v[53] || (v[53] = [
                s("i", { class: "fa-solid fa-xmark" }, null, -1)
              ])])) : P("", !0)
            ]),
            s("div", Lm, [
              (u(!0), c(I, null, U(Wl.value, (r) => (u(), c("button", {
                key: r.id,
                type: "button",
                class: q(["ox-vite-vrm-row", { "is-active": r.selected }]),
                onClick: (W) => Y(r.id)
              }, [
                s("span", Nm, [
                  s("i", {
                    class: q(r.selected ? "fa-solid fa-circle-check" : "fa-regular fa-circle")
                  }, null, 2)
                ]),
                s("span", jm, [
                  s("span", Wm, l(r.name), 1),
                  s("span", Bm, l(r.builtin ? d.value ? "内置动作" : "Built-in" : d.value ? "自定义动作" : "Custom"), 1)
                ]),
                r.builtin ? P("", !0) : (u(), c("span", {
                  key: 0,
                  class: "ox-vite-vrm-row__del",
                  title: d.value ? "删除" : "Delete",
                  onClick: (W) => j(r.id, W)
                }, [...v[55] || (v[55] = [
                  s("i", { class: "fa-regular fa-trash-can" }, null, -1)
                ])], 8, Um))
              ], 10, Fm))), 128)),
              Wl.value.length ? P("", !0) : (u(), c("div", Km, [
                Te.value === "custom" && !On.value.length ? (u(), c("span", qm, l(d.value ? "尚未上传自定义动作" : "No custom motions yet"), 1)) : $e.value ? (u(), c("span", Hm, l(d.value ? "没有匹配的动作" : "No matching motions"), 1)) : (u(), c("span", zm, l(d.value ? "无可用动作" : "No motions available"), 1))
              ]))
            ])
          ])
        ]),
        s("aside", Ym, [
          s("div", Gm, [
            s("div", null, [
              s("h2", null, l(d.value ? "实时预览" : "Live Preview"), 1),
              s("p", null, [
                s("span", null, l(we.value.selectedModel?.name || (d.value ? "未选择模型" : "No model")), 1),
                en.value.length ? (u(), c("span", Qm, " · " + l(en.value.length) + " " + l(d.value ? "个动作" : "motions"), 1)) : P("", !0)
              ])
            ]),
            s("label", Xm, [
              je(s("input", {
                type: "checkbox",
                "onUpdate:modelValue": v[9] || (v[9] = (r) => he.value = r)
              }, null, 512), [
                [Pl, he.value]
              ]),
              s("span", null, l(he.value ? d.value ? "关闭预览" : "Hide" : d.value ? "开启预览" : "Show"), 1)
            ])
          ]),
          s("div", Jm, [
            he.value && we.value.previewUrl && we.value.isElectron ? (u(), c("div", Zm, [
              (u(), c("webview", {
                key: we.value.previewKey || we.value.previewUrl,
                src: we.value.previewUrl,
                partition: "persist:openxnet-vrm-preview",
                class: "ox-vite-vrm-preview__webview",
                allowpopups: "",
                webpreferences: "transparent=true"
              }, null, 8, ey))
            ])) : he.value && we.value.previewUrl ? (u(), c("div", ty, [
              (u(), c("iframe", {
                key: we.value.previewKey || we.value.previewUrl,
                src: we.value.previewUrl,
                class: "ox-vite-vrm-preview__iframe",
                referrerpolicy: "no-referrer",
                allowtransparency: "true"
              }, null, 8, sy))
            ])) : (u(), c("div", ny, [
              v[56] || (v[56] = s("div", { class: "ox-vite-vrm-preview__hero" }, [
                s("i", { class: "fa-solid fa-vr-cardboard" })
              ], -1)),
              s("h3", null, l(we.value.selectedModel?.name || (d.value ? "未选择模型" : "No model selected")), 1),
              s("p", null, l(d.value ? '点击"开启预览"加载 VRM 模型，桌宠未运行时也能看到当前选择的模型与动作。' : "Toggle preview to load the VRM. Visible even when the desktop pet is stopped."), 1)
            ]))
          ]),
          s("div", ly, [
            s("button", {
              type: "button",
              class: "ox-vite-ops-secondary-btn",
              onClick: C
            }, [
              v[57] || (v[57] = s("i", { class: "fa-solid fa-window-maximize" }, null, -1)),
              s("span", null, l(d.value ? "浏览器预览" : "Browser preview"), 1)
            ]),
            we.value.isElectron ? (u(), c("button", {
              key: 0,
              type: "button",
              class: "ox-vite-ops-primary-btn",
              disabled: we.value.starting,
              onClick: N
            }, [
              s("i", {
                class: q(we.value.starting ? "fa-solid fa-spinner fa-spin" : we.value.running ? "fa-solid fa-rotate" : "fa-solid fa-play")
              }, null, 2),
              s("span", null, l(we.value.starting ? d.value ? "启动中..." : "Starting..." : we.value.running ? d.value ? "重启桌宠" : "Restart pet" : d.value ? "启动桌宠" : "Start pet"), 1)
            ], 8, ay)) : P("", !0)
          ]),
          en.value.length ? (u(), c("div", oy, [
            s("div", iy, l(d.value ? "已启用动作" : "Enabled motions"), 1),
            s("div", ry, [
              (u(!0), c(I, null, U(en.value, (r) => (u(), c("span", {
                key: r.id,
                class: "ox-vite-detail-chip"
              }, [
                v[58] || (v[58] = s("i", { class: "fa-solid fa-person-running" }, null, -1)),
                s("span", null, l(r.name), 1)
              ]))), 128))
            ])
          ])) : P("", !0),
          s("div", uy, [
            s("button", {
              type: "button",
              class: "ox-vite-ops-secondary-btn",
              onClick: C
            }, [
              v[59] || (v[59] = s("i", { class: "fa-solid fa-window-maximize" }, null, -1)),
              s("span", null, l(d.value ? "浏览器" : "Browser"), 1)
            ]),
            we.value.isElectron ? (u(), c("button", {
              key: 0,
              type: "button",
              class: "ox-vite-ops-primary-btn",
              disabled: we.value.starting,
              onClick: N
            }, [
              s("i", {
                class: q(we.value.starting ? "fa-solid fa-spinner fa-spin" : "fa-solid fa-play")
              }, null, 2),
              s("span", null, l(we.value.running ? d.value ? "重启" : "Restart" : d.value ? "启动" : "Start"), 1)
            ], 8, cy)) : P("", !0)
          ])
        ])
      ])) : (u(), c(I, { key: 3 }, [
        s("div", dy, [
          s("div", py, [
            s("span", fy, [
              s("i", {
                class: q(i.value)
              }, null, 2)
            ]),
            s("div", vy, [
              s("h1", null, l(_.value.title), 1),
              s("p", null, l(t.surface === "storage" && _.value.meta?.summary || _.value.subtitle), 1)
            ])
          ]),
          s("div", gy, [
            t.surface === "storage" && _.value.activeTab === "memory-v3" ? P("", !0) : (u(), c("button", {
              key: 0,
              type: "button",
              class: "ox-vite-ops-secondary-btn",
              onClick: h
            }, [
              v[60] || (v[60] = s("i", { class: "fa-solid fa-rotate-right" }, null, -1)),
              s("span", null, l(d.value ? "同步状态" : "Sync Status"), 1)
            ])),
            ["deploy", "workbench", "kernel", "system"].includes(t.surface) ? (u(), c("button", {
              key: 1,
              type: "button",
              class: "ox-vite-ops-primary-btn",
              onClick: ve
            }, [
              s("i", {
                class: q(t.surface === "storage" && _.value.activeTab === "memory-v3" ? "fa-solid fa-plus" : "fa-solid fa-arrow-right")
              }, null, 2),
              s("span", null, l(t.surface === "deploy" ? d.value ? "启动主机器人" : "Start primary bot" : t.surface === "workbench" ? d.value ? "打开任务中心" : "Open task center" : t.surface === "storage" ? _.value.activeTab === "memory-v3" ? d.value ? "新建记忆" : "New memory" : d.value ? "进入文件库" : "Open file vault" : t.surface === "kernel" ? d.value ? "查看行动队列" : "Open action queue" : _.value.activeTab === "about" ? d.value ? "检查更新" : "Check Updates" : d.value ? "查看更新内容" : "Open update content"), 1)
            ])) : P("", !0)
          ])
        ]),
        t.surface === "system" ? (u(), c("div", my, [
          s("aside", yy, [
            (u(!0), c(I, null, U(_.value.tabs || [], (r) => (u(), c("button", {
              key: r.id,
              type: "button",
              class: q(["ox-vite-side-tab", { active: _.value.activeTab === r.id }]),
              onClick: (W) => m(r.id)
            }, [
              s("i", {
                class: q(r.icon)
              }, null, 2),
              s("span", null, l(r.label), 1)
            ], 10, hy))), 128))
          ]),
          s("main", _y, [
            s("section", by, [
              (u(!0), c(I, null, U(_.value.stats || [], (r) => (u(), c("article", {
                key: r.label,
                class: q(["ox-vite-stat-card", { emphasis: r.emphasis }])
              }, [
                s("span", null, l(r.label), 1),
                s("strong", null, l(r.value), 1),
                s("small", null, l(r.meta), 1)
              ], 2))), 128))
            ]),
            s("section", xy, [
              s("div", ky, [
                s("h2", null, l(_.value.currentMeta?.heading), 1),
                s("p", null, l(_.value.currentMeta?.summary), 1)
              ]),
              _.value.activeTab === "general" ? (u(), c("div", Sy, [
                s("section", wy, [
                  s("div", Cy, l(d.value ? "语言与区域" : "Language & Region"), 1),
                  s("article", My, [
                    s("div", null, [
                      s("strong", null, l(d.value ? "界面语言" : "Interface Language"), 1),
                      s("p", null, l(d.value ? "选择 OpenXnet 界面显示语言。" : "Choose the language used by the OpenXnet interface."), 1)
                    ]),
                    s("select", {
                      class: "ox-vite-select",
                      value: _.value.settings?.language,
                      onChange: v[10] || (v[10] = (r) => $("language", r))
                    }, [
                      (u(!0), c(I, null, U(_.value.languageOptions || [], (r) => (u(), c("option", {
                        key: r.value,
                        value: r.value
                      }, l(r.label), 9, Ty))), 128))
                    ], 40, Ry)
                  ]),
                  s("article", $y, [
                    s("div", null, [
                      s("strong", null, l(d.value ? "目标输出语言" : "Target Output Language"), 1),
                      s("p", null, l(d.value ? "控制模型回答时优先使用的语言。" : "Controls the preferred language for model replies."), 1)
                    ]),
                    s("select", {
                      class: "ox-vite-select",
                      value: _.value.targetLanguage,
                      onChange: ae
                    }, [
                      (u(!0), c(I, null, U(_.value.targetLanguageOptions || [], (r) => (u(), c("option", {
                        key: r.value,
                        value: r.value
                      }, l(r.label), 9, Iy))), 128))
                    ], 40, Ay)
                  ]),
                  s("article", Ey, [
                    s("div", null, [
                      s("strong", null, l(d.value ? "时区" : "Timezone"), 1),
                      s("p", null, l(d.value ? "用于时间显示、任务计划和更新记录。" : "Used by timestamps, scheduled tasks, and release records."), 1)
                    ]),
                    s("div", Py, [
                      (u(!0), c(I, null, U(_.value.timezoneOptions || [], (r) => (u(), c("button", {
                        key: r.value,
                        type: "button",
                        class: q({ active: _.value.settings?.timezone === r.value }),
                        onClick: (W) => A("timezone", r.value)
                      }, l(r.label), 11, Dy))), 128))
                    ])
                  ]),
                  s("article", Oy, [
                    s("div", null, [
                      s("strong", null, l(d.value ? "日期格式" : "Date Format"), 1),
                      s("p", null, l(d.value ? "选择日期在系统页面中的显示方式。" : "Choose how dates are displayed across system pages."), 1)
                    ]),
                    s("div", Vy, [
                      (u(!0), c(I, null, U(_.value.dateFormatOptions || [], (r) => (u(), c("button", {
                        key: r.value,
                        type: "button",
                        class: q({ active: _.value.settings?.dateFormat === r.value }),
                        onClick: (W) => A("dateFormat", r.value)
                      }, l(r.label), 11, Ly))), 128))
                    ])
                  ])
                ]),
                s("section", Fy, [
                  s("div", Ny, l(d.value ? "启动行为" : "Startup"), 1),
                  s("article", jy, [
                    s("div", null, [
                      s("strong", null, l(d.value ? "开机自启" : "Launch at Startup"), 1),
                      s("p", null, l(d.value ? "系统启动后自动运行 OpenXnet。" : "Run OpenXnet automatically after system startup."), 1)
                    ]),
                    s("label", Wy, [
                      s("input", {
                        type: "checkbox",
                        checked: _.value.settings?.launchAtStartup,
                        onChange: v[11] || (v[11] = (r) => Q("launchAtStartup", r))
                      }, null, 40, By),
                      v[61] || (v[61] = s("span", null, null, -1))
                    ])
                  ]),
                  s("article", Uy, [
                    s("div", null, [
                      s("strong", null, l(d.value ? "启动时最小化" : "Start Minimized"), 1),
                      s("p", null, l(d.value ? "启动后进入托盘，不打断当前桌面。" : "Start into the tray without interrupting the desktop."), 1)
                    ]),
                    s("label", Ky, [
                      s("input", {
                        type: "checkbox",
                        checked: _.value.settings?.startMinimized,
                        onChange: v[12] || (v[12] = (r) => Q("startMinimized", r))
                      }, null, 40, qy),
                      v[62] || (v[62] = s("span", null, null, -1))
                    ])
                  ])
                ]),
                s("section", Hy, [
                  s("div", zy, l(d.value ? "数据与隐私" : "Data & Privacy"), 1),
                  s("article", Yy, [
                    s("div", null, [
                      s("strong", null, l(d.value ? "清理运行缓存" : "Clear Runtime Cache"), 1),
                      s("p", null, l(d.value ? "清理 Service Worker 与 Cache Storage，重新加载后获取最新 UI。" : "Clear Service Worker and Cache Storage so the latest UI loads after refresh."), 1)
                    ]),
                    s("button", {
                      type: "button",
                      class: "ox-vite-ops-secondary-btn",
                      onClick: w
                    }, [
                      v[63] || (v[63] = s("i", { class: "fa-solid fa-broom" }, null, -1)),
                      s("span", null, l(d.value ? "清除缓存" : "Clear"), 1)
                    ])
                  ])
                ])
              ])) : _.value.activeTab === "appearance" ? (u(), c("div", Gy, [
                s("section", {
                  class: "ox-skin-current",
                  style: pt(G(_.value.skinCurrent))
                }, [
                  s("div", Qy, [
                    s("span", Xy, l(d.value ? "当前皮肤" : "Current skin"), 1),
                    s("h2", null, l(_.value.skinCurrent?.name), 1),
                    s("div", Jy, [
                      s("span", null, [
                        s("i", {
                          class: q(_.value.skinCurrent?.mode === "dark" ? "fa-regular fa-moon" : "fa-regular fa-sun")
                        }, null, 2),
                        de(l(_.value.skinCurrent?.mode === "dark" ? d.value ? "深色" : "Dark" : d.value ? "浅色" : "Light"), 1)
                      ]),
                      s("span", null, l(_.value.skinCurrent?.density === "compact" ? d.value ? "紧凑布局" : "Compact layout" : d.value ? "舒适布局" : "Comfortable layout"), 1),
                      _.value.skinCurrent?.hasWallpaper ? (u(), c("span", Zy, [
                        v[64] || (v[64] = s("i", { class: "fa-regular fa-image" }, null, -1)),
                        de(l(d.value ? "自选背景" : "Custom background"), 1)
                      ])) : P("", !0)
                    ]),
                    s("p", null, l(d.value ? "调整主色、背景与圆角，找到适合自己的工作空间。" : "Make the workspace yours with colors, backgrounds, and softer corners."), 1),
                    s("button", {
                      type: "button",
                      class: "ox-skin-settings-open",
                      disabled: !_.value.skinStudioAvailable,
                      onClick: B
                    }, [
                      v[65] || (v[65] = s("i", { class: "fa-solid fa-sliders" }, null, -1)),
                      s("span", null, l(d.value ? "自定义皮肤" : "Customize skin"), 1)
                    ], 8, eh)
                  ]),
                  s("div", {
                    class: q(["ox-skin-workspace-preview", { "has-wallpaper": _.value.skinCurrent?.hasWallpaper }]),
                    "aria-hidden": "true"
                  }, [...v[66] || (v[66] = [
                    s("div", { class: "ox-skin-workspace-preview__top" }, [
                      s("span"),
                      s("b", null, "OpenXnet"),
                      s("i")
                    ], -1),
                    s("div", { class: "ox-skin-workspace-preview__sidebar" }, [
                      s("i"),
                      s("i"),
                      s("i"),
                      s("i")
                    ], -1),
                    s("div", { class: "ox-skin-workspace-preview__content" }, [
                      s("b"),
                      s("i"),
                      s("div", null, [
                        s("span"),
                        s("span")
                      ]),
                      s("em")
                    ], -1)
                  ])], 2)
                ], 4),
                _.value.skinLibrary?.length ? (u(), c("section", th, [
                  s("div", sh, [
                    s("h3", null, l(d.value ? "皮肤库" : "Your skins"), 1),
                    s("p", null, l(d.value ? "选择即可应用，随时继续调整。" : "Choose a skin to apply it. You can fine-tune it anytime."), 1)
                  ]),
                  s("div", nh, [
                    (u(!0), c(I, null, U(_.value.skinLibrary, (r) => (u(), c("button", {
                      key: r.id,
                      type: "button",
                      class: q(["ox-skin-library-card", { "is-active": _.value.skinCurrent?.id === r.id }]),
                      "data-skin-id": r.id,
                      "aria-pressed": _.value.skinCurrent?.id === r.id,
                      onClick: (W) => J(r.id)
                    }, [
                      s("span", {
                        class: q(["ox-skin-library-card__preview", { "has-wallpaper": r.hasWallpaper }]),
                        style: pt(G(r)),
                        "aria-hidden": "true"
                      }, [...v[67] || (v[67] = [
                        s("i", null, null, -1),
                        s("b", null, null, -1),
                        s("em", null, null, -1)
                      ])], 6),
                      s("span", ah, [
                        s("strong", null, l(r.name), 1),
                        _.value.skinCurrent?.id === r.id ? (u(), c("i", oh)) : P("", !0)
                      ]),
                      s("small", null, [
                        de(l(r.mode === "dark" ? d.value ? "深色" : "Dark" : d.value ? "浅色" : "Light"), 1),
                        _.value.skinCurrent?.id === r.id ? (u(), c("span", ih, " · " + l(d.value ? "当前使用" : "In use"), 1)) : P("", !0)
                      ])
                    ], 10, lh))), 128))
                  ])
                ])) : P("", !0),
                s("details", rh, [
                  s("summary", null, [
                    de(l(d.value ? "经典主题" : "Classic themes"), 1),
                    v[68] || (v[68] = s("i", { class: "fa-solid fa-chevron-down" }, null, -1))
                  ]),
                  s("div", uh, [
                    (u(!0), c(I, null, U(_.value.themeOptions || [], (r) => (u(), c("button", {
                      key: r.value,
                      type: "button",
                      class: "ox-vite-theme-card",
                      onClick: (W) => A("theme", r.value)
                    }, [
                      s("span", {
                        class: q(["ox-vite-theme-card__preview", `theme-${r.value}`])
                      }, [...v[69] || (v[69] = [
                        s("i", null, null, -1),
                        s("i", null, null, -1),
                        s("i", null, null, -1)
                      ])], 2),
                      s("strong", null, l(r.label), 1),
                      s("small", null, l(d.value ? "应用经典主题" : "Apply classic theme"), 1)
                    ], 8, ch))), 128))
                  ])
                ])
              ])) : _.value.activeTab === "shortcuts" ? (u(), c("div", dh, [
                s("section", ph, [
                  s("div", fh, l(d.value ? "已注册快捷键" : "Registered Shortcuts"), 1),
                  (u(!0), c(I, null, U(_.value.shortcutRows || [], (r) => (u(), c("article", {
                    key: r.key || r.label,
                    class: "ox-vite-settings-row"
                  }, [
                    s("div", null, [
                      s("strong", null, l(r.label), 1),
                      s("p", null, l(r.description), 1)
                    ]),
                    s("div", vh, [
                      s("kbd", null, l(r.shortcut), 1),
                      s("span", {
                        class: q(["ox-vite-status-pill", { active: r.registered }])
                      }, l(r.registered ? d.value ? "已注册" : "Ready" : d.value ? "未注册" : "Unavailable"), 3)
                    ])
                  ]))), 128))
                ]),
                s("section", gh, [
                  s("div", mh, l(d.value ? "快速操作" : "Quick Actions"), 1),
                  (u(!0), c(I, null, U(_.value.quickActions || [], (r) => (u(), c("article", {
                    key: r.id,
                    class: "ox-vite-settings-row"
                  }, [
                    s("div", null, [
                      s("strong", null, [
                        s("i", {
                          class: q(r.icon)
                        }, null, 2),
                        de(l(r.label), 1)
                      ]),
                      s("p", null, l(r.description), 1)
                    ]),
                    s("button", {
                      type: "button",
                      class: "ox-vite-ops-secondary-btn",
                      onClick: (W) => _e(r.id)
                    }, [
                      v[70] || (v[70] = s("i", { class: "fa-solid fa-arrow-up-right-from-square" }, null, -1)),
                      s("span", null, l(d.value ? "打开" : "Open"), 1)
                    ], 8, yh)
                  ]))), 128))
                ])
              ])) : _.value.activeTab === "network" ? (u(), c("div", hh, [
                s("section", _h, [
                  s("div", bh, l(d.value ? "网络与代理" : "Network & Proxy"), 1),
                  s("article", xh, [
                    s("div", null, [
                      s("strong", null, l(d.value ? "网络模式" : "Network Mode"), 1),
                      s("p", null, l(d.value ? "决定桌面服务在本机或局域网中的可见范围。" : "Controls whether the desktop service is local-only or visible on the LAN."), 1)
                    ]),
                    s("select", {
                      class: "ox-vite-select",
                      value: _.value.settings?.network,
                      onChange: v[13] || (v[13] = (r) => $("network", r))
                    }, [
                      (u(!0), c(I, null, U(_.value.networkOptions || [], (r) => (u(), c("option", {
                        key: r.value,
                        value: r.value
                      }, l(r.label), 9, Sh))), 128))
                    ], 40, kh)
                  ]),
                  s("article", wh, [
                    s("div", null, [
                      s("strong", null, l(d.value ? "代理模式" : "Proxy Mode"), 1),
                      s("p", null, l(d.value ? "用于模型、插件、资源下载和外部服务访问。" : "Used for models, plugins, resource downloads, and external services."), 1)
                    ]),
                    s("select", {
                      class: "ox-vite-select",
                      value: _.value.settings?.proxyMode,
                      onChange: v[14] || (v[14] = (r) => $("proxyMode", r))
                    }, [
                      (u(!0), c(I, null, U(_.value.proxyOptions || [], (r) => (u(), c("option", {
                        key: r.value,
                        value: r.value
                      }, l(r.label), 9, Mh))), 128))
                    ], 40, Ch)
                  ]),
                  _.value.settings?.proxyMode === "manual" ? (u(), c("article", Rh, [
                    s("div", null, [
                      s("strong", null, l(d.value ? "代理地址" : "Proxy Address"), 1),
                      s("p", null, l(d.value ? "示例：http://127.0.0.1:7890。SOCKS 代理会被后端保护性拦截。" : "Example: http://127.0.0.1:7890. SOCKS proxies are blocked by the backend guard."), 1)
                    ]),
                    s("input", {
                      class: "ox-vite-text-input",
                      value: _.value.settings?.proxy,
                      type: "text",
                      placeholder: "http://127.0.0.1:7890",
                      onChange: v[15] || (v[15] = (r) => $("proxy", r))
                    }, null, 40, Th)
                  ])) : P("", !0)
                ])
              ])) : _.value.activeTab === "feature-packs" ? (u(), c("div", $h, [
                s("div", Ah, [
                  s("div", Ih, [
                    s("span", {
                      class: q(["ox-vite-feature-pack-feed-state", `is-${Xe.value.feedStatus || "unavailable"}`])
                    }, [
                      s("i", {
                        class: q(Xe.value.feedStatus === "ready" ? "fa-solid fa-shield-halved" : "fa-solid fa-circle-exclamation")
                      }, null, 2),
                      s("span", null, l(Xe.value.feedStatus === "ready" ? d.value ? "可信分发已连接" : "Trusted feed connected" : Xe.value.feedStatus === "not-configured" ? d.value ? "分发未配置" : "Distribution not configured" : Xe.value.feedStatus === "loading" ? d.value ? "正在同步" : "Syncing" : d.value ? "分发不可用" : "Distribution unavailable"), 1)
                    ], 2),
                    Xe.value.catalogGeneratedAt ? (u(), c("small", Eh, l(d.value ? "目录时间" : "Catalog") + ": " + l(Xe.value.catalogGeneratedAt), 1)) : P("", !0)
                  ]),
                  s("button", {
                    type: "button",
                    class: "ox-vite-icon-btn",
                    disabled: Xe.value.loading,
                    title: d.value ? "刷新功能包目录" : "Refresh Feature Pack catalog",
                    onClick: Ce
                  }, [
                    s("i", {
                      class: q(Xe.value.loading ? "fa-solid fa-spinner fa-spin" : "fa-solid fa-rotate-right")
                    }, null, 2)
                  ], 8, Ph)
                ]),
                Xe.value.error ? (u(), c("div", Dh, [
                  v[71] || (v[71] = s("i", { class: "fa-solid fa-triangle-exclamation" }, null, -1)),
                  s("span", null, l(Xe.value.error.message), 1)
                ])) : Xe.value.feedStatus === "not-configured" ? (u(), c("div", Oh, [
                  v[72] || (v[72] = s("i", { class: "fa-solid fa-lock" }, null, -1)),
                  s("span", null, l(d.value ? "远程安装已停用；应用信任存储和分发地址尚未配置。" : "Remote installation is disabled because the application trust store and feed are not configured."), 1)
                ])) : Xe.value.available ? P("", !0) : (u(), c("div", Vh, [
                  v[73] || (v[73] = s("i", { class: "fa-solid fa-desktop" }, null, -1)),
                  s("span", null, l(d.value ? "功能包管理仅在桌面应用中可用。" : "Feature Pack management is available in the desktop application."), 1)
                ])),
                s("div", Lh, [
                  (u(!0), c(I, null, U(Xe.value.items || [], (r) => (u(), c("article", {
                    key: r.capabilityId,
                    class: q(["ox-vite-feature-pack-row", [`is-${r.status}`, { "is-busy": Z(r) }]])
                  }, [
                    s("div", Fh, [
                      s("span", Nh, [
                        s("i", {
                          class: q(r.icon)
                        }, null, 2)
                      ]),
                      s("div", null, [
                        s("strong", null, l(r.displayName), 1),
                        s("p", null, l(r.description), 1)
                      ])
                    ]),
                    s("div", jh, [
                      s("span", null, [
                        s("small", null, l(d.value ? "已安装" : "Installed"), 1),
                        s("strong", null, l(r.installedVersion || "—"), 1)
                      ]),
                      s("span", null, [
                        s("small", null, l(d.value ? "可用版本" : "Available"), 1),
                        s("strong", null, l(r.availableVersion || "—"), 1)
                      ])
                    ]),
                    s("div", Wh, [
                      s("span", {
                        class: q(["ox-vite-feature-pack-status", `is-${r.status}`])
                      }, [
                        s("i", {
                          class: q(ie(r.status))
                        }, null, 2),
                        s("span", null, l(Me(r.status)), 1)
                      ], 2),
                      r.restartRequired ? (u(), c("span", Bh, [
                        v[74] || (v[74] = s("i", { class: "fa-solid fa-power-off" }, null, -1)),
                        s("span", null, l(d.value ? "重启后生效" : "Restart required"), 1)
                      ])) : P("", !0)
                    ]),
                    s("div", Uh, [
                      r.status === "not-installed" || r.status === "update-available" ? (u(), c("button", {
                        key: 0,
                        type: "button",
                        class: "ox-vite-ops-primary-btn",
                        disabled: Z(r) || Xe.value.feedStatus !== "ready",
                        onClick: (W) => ke("install", r)
                      }, [
                        s("i", {
                          class: q(Z(r) ? "fa-solid fa-spinner fa-spin" : r.status === "update-available" ? "fa-solid fa-arrow-up" : "fa-solid fa-download")
                        }, null, 2),
                        s("span", null, l(r.status === "update-available" ? d.value ? "更新" : "Update" : d.value ? "安装" : "Install"), 1)
                      ], 8, Kh)) : (u(), c("button", {
                        key: 1,
                        type: "button",
                        class: "ox-vite-ops-secondary-btn",
                        disabled: Z(r) || Xe.value.feedStatus !== "ready",
                        onClick: (W) => ke("repair", r)
                      }, [
                        s("i", {
                          class: q(Z(r) ? "fa-solid fa-spinner fa-spin" : "fa-solid fa-screwdriver-wrench")
                        }, null, 2),
                        s("span", null, l(d.value ? "修复" : "Repair"), 1)
                      ], 8, qh)),
                      r.installedVersion || r.status === "damaged" ? (u(), c("button", {
                        key: 2,
                        type: "button",
                        class: "ox-vite-icon-btn is-danger",
                        disabled: Z(r),
                        title: d.value ? "卸载功能包" : "Uninstall Feature Pack",
                        onClick: (W) => ke("uninstall", r)
                      }, [...v[75] || (v[75] = [
                        s("i", { class: "fa-regular fa-trash-can" }, null, -1)
                      ])], 8, Hh)) : P("", !0)
                    ]),
                    r.progress ? (u(), c("div", {
                      key: 0,
                      class: q(["ox-vite-feature-pack-progress", { "is-failed": r.progress.phase === "failed" }])
                    }, [
                      s("div", zh, [
                        s("span", null, l(k(r.progress.phase)), 1),
                        r.progress.transferredBytes !== null && r.progress.totalBytes !== null ? (u(), c("span", Yh, l(H(r.progress.transferredBytes)) + " / " + l(H(r.progress.totalBytes)), 1)) : r.progress.percent !== null ? (u(), c("span", Gh, l(r.progress.percent) + "%", 1)) : P("", !0)
                      ]),
                      s("div", Qh, [
                        s("span", {
                          class: q({ "is-indeterminate": r.progress.percent === null && !["completed", "failed"].includes(r.progress.phase) }),
                          style: pt({ width: r.progress.percent === null ? r.progress.phase === "completed" ? "100%" : "28%" : `${r.progress.percent}%` })
                        }, null, 6)
                      ]),
                      r.progress.error ? (u(), c("p", Xh, l(r.progress.error.message), 1)) : P("", !0)
                    ], 2)) : P("", !0)
                  ], 2))), 128))
                ])
              ])) : _.value.activeTab === "advanced" ? (u(), c("div", Jh, [
                s("section", Zh, [
                  s("div", e_, l(d.value ? "文件与目录" : "Files & Directories"), 1),
                  s("article", t_, [
                    s("div", null, [
                      s("strong", null, l(d.value ? "用户数据目录" : "User Data Folder"), 1),
                      s("p", null, l(d.value ? "配置、会话、本地资产和数据库所在目录。" : "Folder for settings, conversations, local assets, and databases."), 1)
                    ]),
                    s("button", {
                      type: "button",
                      class: "ox-vite-ops-secondary-btn",
                      onClick: v[16] || (v[16] = (r) => ye("user"))
                    }, [
                      v[76] || (v[76] = s("i", { class: "fa-solid fa-folder-open" }, null, -1)),
                      s("span", null, l(d.value ? "打开" : "Open"), 1)
                    ])
                  ]),
                  s("article", s_, [
                    s("div", null, [
                      s("strong", null, l(d.value ? "日志目录" : "Log Folder"), 1),
                      s("p", null, l(d.value ? "桌面端与后端运行日志，用于排查启动、更新和接口问题。" : "Desktop and backend logs for startup, update, and API diagnostics."), 1)
                    ]),
                    s("button", {
                      type: "button",
                      class: "ox-vite-ops-secondary-btn",
                      onClick: v[17] || (v[17] = (r) => ye("logs"))
                    }, [
                      v[77] || (v[77] = s("i", { class: "fa-solid fa-file-lines" }, null, -1)),
                      s("span", null, l(d.value ? "打开" : "Open"), 1)
                    ])
                  ]),
                  s("article", n_, [
                    s("div", null, [
                      s("strong", null, l(d.value ? "扩展目录" : "Extension Folder"), 1),
                      s("p", null, l(d.value ? "插件、扩展与外部能力文件目录。" : "Folder for plugins, extensions, and external capability files."), 1)
                    ]),
                    s("button", {
                      type: "button",
                      class: "ox-vite-ops-secondary-btn",
                      onClick: v[18] || (v[18] = (r) => ye("extensions"))
                    }, [
                      v[78] || (v[78] = s("i", { class: "fa-solid fa-puzzle-piece" }, null, -1)),
                      s("span", null, l(d.value ? "打开" : "Open"), 1)
                    ])
                  ])
                ]),
                s("section", l_, [
                  s("div", a_, l(d.value ? "维护操作" : "Maintenance"), 1),
                  s("article", o_, [
                    s("div", null, [
                      s("strong", null, l(d.value ? "清理运行缓存" : "Clear Runtime Cache"), 1),
                      s("p", null, l(d.value ? "清理前端缓存，不会删除用户会话和配置。" : "Clear frontend runtime cache without deleting conversations or settings."), 1)
                    ]),
                    s("button", {
                      type: "button",
                      class: "ox-vite-ops-secondary-btn",
                      onClick: w
                    }, [
                      v[79] || (v[79] = s("i", { class: "fa-solid fa-broom" }, null, -1)),
                      s("span", null, l(d.value ? "清除" : "Clear"), 1)
                    ])
                  ]),
                  s("article", i_, [
                    s("div", null, [
                      s("strong", null, l(d.value ? "恢复默认系统设置" : "Reset System Settings"), 1),
                      s("p", null, l(d.value ? "仅恢复系统设置页中的语言、主题、启动、网络和代理选项。" : "Only resets language, theme, startup, network, and proxy options in this page."), 1)
                    ]),
                    s("button", {
                      type: "button",
                      class: "ox-vite-danger-btn",
                      onClick: ne
                    }, [
                      v[80] || (v[80] = s("i", { class: "fa-solid fa-rotate-left" }, null, -1)),
                      s("span", null, l(d.value ? "恢复默认" : "Reset"), 1)
                    ])
                  ])
                ])
              ])) : (u(), c("div", r_, [
                s("article", u_, [
                  s("div", c_, [
                    s("h2", null, l(d.value ? "当前发布状态" : "Current Release Status"), 1),
                    s("p", null, l(d.value ? "版本更新、更新检测与优化说明都会统一汇总在这里。" : "Release updates, update checks, and optimization notes are collected here."), 1)
                  ]),
                  s("div", d_, [
                    s("span", p_, "v" + l(_.value.version), 1),
                    s("span", f_, l(_.value.updateStatus || "idle"), 1),
                    s("span", v_, l(_.value.updateAvailable ? d.value ? "发现新版本" : "Update Available" : d.value ? "当前已同步" : "Up to Date"), 1)
                  ]),
                  s("div", g_, [
                    s("article", m_, [
                      s("strong", null, l(d.value ? "更新状态" : "Update Status"), 1),
                      s("p", null, l(_.value.updateStatusTitle || (d.value ? "等待下一次更新检查。" : "Waiting for the next update check.")), 1)
                    ]),
                    s("article", y_, [
                      s("strong", null, l(d.value ? "状态说明" : "Status Detail"), 1),
                      s("p", null, l(_.value.updateStatusDescription || _.value.updateMessage || (d.value ? "等待下一次更新检查。" : "Waiting for the next update check.")), 1)
                    ]),
                    s("article", h_, [
                      s("strong", null, l(d.value ? "更新节奏" : "Check Cadence"), 1),
                      s("p", null, l(d.value ? "启动后首次静默检查，之后每 1 小时自动检测一次。" : "A silent check runs shortly after launch, then once every hour."), 1)
                    ])
                  ]),
                  s("div", __, [
                    s("button", {
                      type: "button",
                      class: "ox-vite-ops-primary-btn",
                      onClick: R
                    }, [
                      v[81] || (v[81] = s("i", { class: "fa-solid fa-rotate-right" }, null, -1)),
                      s("span", null, l(d.value ? "检查更新" : "Check for Updates"), 1)
                    ]),
                    s("button", {
                      type: "button",
                      class: "ox-vite-ops-secondary-btn",
                      onClick: b
                    }, [
                      v[82] || (v[82] = s("i", { class: "fa-solid fa-circle-info" }, null, -1)),
                      s("span", null, l(d.value ? "查看关于页" : "Open About Page"), 1)
                    ])
                  ])
                ]),
                (u(!0), c(I, null, U(_.value.updateEntries || [], (r) => (u(), c("article", {
                  key: `${r.version}-${r.date}-${r.title}`,
                  class: "ox-vite-panel-card"
                }, [
                  s("div", b_, [
                    s("h2", null, l(r.title), 1),
                    s("p", null, l(r.date), 1)
                  ]),
                  s("div", x_, [
                    s("span", k_, l(r.version), 1),
                    (u(!0), c(I, null, U(r.modules || [], (W) => (u(), c("span", {
                      key: r.version + W,
                      class: "ox-vite-detail-chip"
                    }, l(W), 1))), 128))
                  ]),
                  s("ul", S_, [
                    (u(!0), c(I, null, U(r.highlights || [], (W) => (u(), c("li", { key: W }, l(W), 1))), 128))
                  ])
                ]))), 128))
              ]))
            ])
          ])
        ])) : (u(), c("div", w_, [
          s("div", {
            class: q(["ox-ops-content-layout", t.surface === "enterprise" ? "ox-vite-system-layout" : "ox-vite-ops-main"])
          }, [
            t.surface === "enterprise" ? (u(), c("aside", C_, [
              (u(!0), c(I, null, U(_.value.tabs || [], (r) => (u(), c("button", {
                key: r.id,
                type: "button",
                class: q(["ox-vite-side-tab", { active: _.value.activeTab === r.id }]),
                onClick: (W) => m(r.id)
              }, [
                s("i", {
                  class: q(r.icon)
                }, null, 2),
                s("span", null, l(r.label), 1)
              ], 10, M_))), 128))
            ])) : P("", !0),
            s("main", R_, [
              t.surface !== "kernel" ? (u(), c("div", T_, [
                (u(!0), c(I, null, U(t.surface === "enterprise" ? [] : _.value.tabs || [], (r) => (u(), c("button", {
                  key: r.id,
                  type: "button",
                  class: q(["ox-vite-strip-tab", { active: _.value.activeTab === r.id }]),
                  onClick: (W) => m(r.id)
                }, [
                  s("i", {
                    class: q(r.icon)
                  }, null, 2),
                  s("span", null, l(r.label), 1)
                ], 10, $_))), 128))
              ])) : P("", !0),
              _.value.meta?.summary && !(["enterprise", "storage"].includes(t.surface) || t.surface === "workbench" && _.value.activeTab === "develop") ? (u(), c("section", A_, [
                s("p", null, l(_.value.meta.summary), 1),
                s("div", I_, [
                  (u(!0), c(I, null, U(_.value.meta.chips || [], (r) => (u(), c("span", {
                    key: r.icon + r.text,
                    class: "ox-vite-detail-chip"
                  }, [
                    s("i", {
                      class: q(r.icon)
                    }, null, 2),
                    s("span", null, l(r.text), 1)
                  ]))), 128))
                ])
              ])) : P("", !0),
              _.value.stats?.length && !(["enterprise", "storage"].includes(t.surface) || t.surface === "workbench" && _.value.activeTab === "develop") ? (u(), c("section", E_, [
                (u(!0), c(I, null, U(_.value.stats || [], (r) => (u(), c("article", {
                  key: r.label,
                  class: q(["ox-vite-stat-card", { emphasis: r.emphasis }])
                }, [
                  s("span", null, l(r.label), 1),
                  s("strong", null, l(r.value), 1),
                  s("small", null, l(r.meta), 1)
                ], 2))), 128))
              ])) : P("", !0),
              t.surface === "deploy" ? (u(), c(I, { key: 3 }, [
                _.value.activeTab === "table_pet" ? (u(), c("section", P_, [
                  s("article", D_, [
                    s("div", O_, [
                      s("h2", null, l(d.value ? "VRM 模型与在线状态" : "VRM Model & Runtime"), 1),
                      s("p", null, l(d.value ? "桌宠入口承接模型、动作和窗口设置，是最接近数字生命表现层的部署面。" : "The desktop-pet lane holds model, motion, and window settings for the most embodied deployment surface."), 1)
                    ]),
                    s("div", V_, [
                      s("div", L_, [
                        s("span", F_, l(d.value ? "当前状态" : "Current state"), 1),
                        s("strong", null, l(_.value.deskPet?.status), 1),
                        s("p", null, l(d.value ? "建议先确认模型、表情和动作，再启动桌宠窗口。" : "Confirm the model, expressions, and motion set before launching the pet window."), 1)
                      ]),
                      s("div", N_, [
                        s("span", null, l(d.value ? "当前模型" : "Current Model"), 1),
                        s("strong", null, l(_.value.deskPet?.modelId), 1),
                        s("small", null, l(_.value.deskPet?.userModels) + " " + l(d.value ? "个自定义模型" : "custom models"), 1)
                      ])
                    ]),
                    s("div", j_, [
                      s("label", W_, [
                        s("span", null, l(d.value ? "表情驱动" : "Expressions"), 1),
                        s("input", {
                          value: _.value.deskPet?.expressions,
                          disabled: "",
                          type: "text"
                        }, null, 8, B_)
                      ]),
                      s("label", U_, [
                        s("span", null, l(d.value ? "动作驱动" : "Motions"), 1),
                        s("input", {
                          value: _.value.deskPet?.motions,
                          disabled: "",
                          type: "text"
                        }, null, 8, K_)
                      ]),
                      s("label", q_, [
                        s("span", null, l(d.value ? "窗口宽度" : "Window Width"), 1),
                        s("input", {
                          value: String(_.value.deskPet?.width || 0),
                          disabled: "",
                          type: "text"
                        }, null, 8, H_)
                      ]),
                      s("label", z_, [
                        s("span", null, l(d.value ? "窗口高度" : "Window Height"), 1),
                        s("input", {
                          value: String(_.value.deskPet?.height || 0),
                          disabled: "",
                          type: "text"
                        }, null, 8, Y_)
                      ])
                    ])
                  ]),
                  s("article", G_, [
                    s("div", Q_, [
                      s("h2", null, l(d.value ? "动作与表现" : "Motion & Presence"), 1),
                      s("p", null, l(d.value ? "后续会继续补齐待机动画、触摸反应和桌面漫游的可视化配置。" : "The next pass will deepen idle motion, touch reactions, and desktop roaming controls."), 1)
                    ]),
                    s("div", X_, [
                      s("span", J_, [
                        v[83] || (v[83] = s("i", { class: "fa-solid fa-face-smile" }, null, -1)),
                        de(l(_.value.deskPet?.expressions), 1)
                      ]),
                      s("span", Z_, [
                        v[84] || (v[84] = s("i", { class: "fa-solid fa-person-running" }, null, -1)),
                        de(l(_.value.deskPet?.motionCount) + " " + l(d.value ? "个已选动作" : "selected motions"), 1)
                      ]),
                      s("span", eb, [
                        v[85] || (v[85] = s("i", { class: "fa-solid fa-window-maximize" }, null, -1)),
                        de(l(_.value.deskPet?.width) + " x " + l(_.value.deskPet?.height), 1)
                      ])
                    ])
                  ])
                ])) : _.value.activeTab === "im_bot" ? (u(), c("section", tb, [
                  (u(!0), c(I, null, U(_.value.imChannels || [], (r) => (u(), c("article", {
                    key: r.id,
                    class: "ox-vite-deploy-platform-card"
                  }, [
                    s("div", sb, [
                      s("div", null, [
                        s("h3", null, l(r.label), 1),
                        s("p", null, l(r.agent), 1)
                      ]),
                      s("span", nb, l(r.status), 1)
                    ]),
                    s("div", lb, [
                      s("span", null, l(r.memory), 1),
                      s("span", null, l(r.note), 1)
                    ])
                  ]))), 128))
                ])) : _.value.activeTab === "live_stream" ? (u(), c("section", ab, [
                  s("article", ob, [
                    s("div", ib, [
                      s("h2", null, l(d.value ? "直播平台路由" : "Streaming Routes"), 1),
                      s("p", null, l(d.value ? "当前直播工作面统一管理 Bilibili、YouTube 和 Twitch 的启用状态与入口。" : "The live lane tracks Bilibili, YouTube, and Twitch enablement and entry points together."), 1)
                    ]),
                    s("div", rb, [
                      (u(!0), c(I, null, U(_.value.liveChannels || [], (r) => (u(), c("article", {
                        key: r.id,
                        class: "ox-vite-deploy-platform-card"
                      }, [
                        s("div", ub, [
                          s("div", null, [
                            s("h3", null, l(r.label), 1),
                            s("p", null, l(r.note), 1)
                          ]),
                          s("span", cb, l(r.status), 1)
                        ])
                      ]))), 128))
                    ])
                  ]),
                  s("article", db, [
                    s("div", pb, [
                      s("h2", null, l(d.value ? "互动与渲染输出" : "Interaction & Render Output"), 1),
                      s("p", null, l(d.value ? "把弹幕队列、唤醒词和 OBS 连接地址放在同一块，便于直播场景快速核对。" : "Keep danmaku flow, wake words, and OBS output together for faster stream checks."), 1)
                    ]),
                    s("div", fb, [
                      s("label", vb, [
                        s("span", null, l(d.value ? "运行状态" : "Runtime"), 1),
                        s("input", {
                          value: _.value.liveStrategy?.runtime,
                          disabled: "",
                          type: "text"
                        }, null, 8, gb)
                      ]),
                      s("label", mb, [
                        s("span", null, l(d.value ? "弹幕优先模式" : "Danmaku Only"), 1),
                        s("input", {
                          value: _.value.liveStrategy?.danmakuOnly,
                          disabled: "",
                          type: "text"
                        }, null, 8, yb)
                      ]),
                      s("label", hb, [
                        s("span", null, l(d.value ? "队列上限" : "Queue Limit"), 1),
                        s("input", {
                          value: String(_.value.liveStrategy?.queueLimit || 0),
                          disabled: "",
                          type: "text"
                        }, null, 8, _b)
                      ]),
                      s("label", bb, [
                        s("span", null, l(d.value ? "唤醒词" : "Wake Word"), 1),
                        s("input", {
                          value: _.value.liveStrategy?.wakeWord,
                          disabled: "",
                          type: "text"
                        }, null, 8, xb)
                      ]),
                      s("label", kb, [
                        v[86] || (v[86] = s("span", null, "OBS", -1)),
                        s("input", {
                          value: _.value.liveStrategy?.obsUrl,
                          disabled: "",
                          type: "text"
                        }, null, 8, Sb)
                      ])
                    ])
                  ])
                ])) : _.value.activeTab === "read_bot" ? (u(), c("section", wb, [
                  s("article", Cb, [
                    s("div", Mb, [
                      s("h2", null, l(d.value ? "朗读任务" : "Reading Job"), 1),
                      s("p", null, l(d.value ? "集中看选中文件、切片数量和朗读进度，比在旧页面里来回跳更清楚。" : "Keep file selection, segment counts, and reading progress visible in one place."), 1)
                    ]),
                    s("div", Rb, [
                      s("label", Tb, [
                        s("span", null, l(d.value ? "当前文件" : "Selected File"), 1),
                        s("input", {
                          value: _.value.readBot?.selectedFile,
                          disabled: "",
                          type: "text"
                        }, null, 8, $b)
                      ]),
                      s("label", Ab, [
                        s("span", null, l(d.value ? "运行状态" : "Runtime"), 1),
                        s("input", {
                          value: _.value.readBot?.runtime,
                          disabled: "",
                          type: "text"
                        }, null, 8, Ib)
                      ]),
                      s("label", Eb, [
                        s("span", null, l(d.value ? "音频状态" : "Audio State"), 1),
                        s("input", {
                          value: _.value.readBot?.audioState,
                          disabled: "",
                          type: "text"
                        }, null, 8, Pb)
                      ])
                    ]),
                    s("div", Db, [
                      s("span", Ob, [
                        v[87] || (v[87] = s("i", { class: "fa-solid fa-waveform" }, null, -1)),
                        de(l(_.value.readBot?.segments) + " " + l(d.value ? "段内容" : "segments"), 1)
                      ])
                    ])
                  ]),
                  s("article", Vb, [
                    s("div", Lb, [
                      s("h2", null, l(d.value ? "内容预览" : "Content Preview"), 1)
                    ]),
                    s("div", Fb, l(_.value.readBot?.preview), 1)
                  ])
                ])) : _.value.activeTab === "translate_bot" ? (u(), c("section", Nb, [
                  s("article", jb, [
                    s("div", Wb, [
                      s("h2", null, l(d.value ? "翻译输入" : "Translation Input"), 1),
                      s("p", null, l(d.value ? "目标语言、源文本长度和翻译状态已经挂到新的工作面里。" : "Target language, source length, and translation status now live on the new workbench."), 1)
                    ]),
                    s("div", Bb, [
                      s("label", Ub, [
                        s("span", null, l(d.value ? "目标语言" : "Target Language"), 1),
                        s("input", {
                          value: _.value.translateBot?.runtime,
                          disabled: "",
                          type: "text"
                        }, null, 8, Kb)
                      ]),
                      s("label", qb, [
                        s("span", null, l(d.value ? "翻译状态" : "Translation Status"), 1),
                        s("input", {
                          value: _.value.translateBot?.busy ? d.value ? "翻译中" : "Translating" : d.value ? "待处理" : "Idle",
                          disabled: "",
                          type: "text"
                        }, null, 8, Hb)
                      ])
                    ]),
                    s("div", zb, [
                      s("span", Yb, [
                        v[88] || (v[88] = s("i", { class: "fa-solid fa-align-left" }, null, -1)),
                        de(l(_.value.translateBot?.sourceLength) + " " + l(d.value ? "字符输入" : "source chars"), 1)
                      ]),
                      s("span", Gb, [
                        v[89] || (v[89] = s("i", { class: "fa-solid fa-language" }, null, -1)),
                        de(l(_.value.translateBot?.targetLength) + " " + l(d.value ? "字符输出" : "target chars"), 1)
                      ])
                    ])
                  ]),
                  s("article", Qb, [
                    s("div", Xb, [
                      s("h2", null, l(d.value ? "源文本预览" : "Source Preview"), 1)
                    ]),
                    s("div", Jb, l(_.value.translateBot?.sourcePreview), 1)
                  ]),
                  s("article", Zb, [
                    s("div", e1, [
                      s("h2", null, l(d.value ? "译文预览" : "Result Preview"), 1)
                    ]),
                    s("div", t1, l(_.value.translateBot?.resultPreview), 1)
                  ])
                ])) : (u(), c("section", s1, [
                  s("article", n1, [
                    s("div", l1, [
                      s("h2", null, l(d.value ? "图床与素材出口" : "Media Outputs"), 1),
                      s("p", null, l(d.value ? "这一块是多个机器人共用的出口配置，先把图床和仓库回退整理清楚。" : "These shared output routes affect multiple bots, so host and fallback setup should stay explicit."), 1)
                    ]),
                    s("div", a1, [
                      s("label", o1, [
                        s("span", null, l(d.value ? "图床状态" : "Media Host"), 1),
                        s("input", {
                          value: _.value.generalConfig?.mediaHostEnabled,
                          disabled: "",
                          type: "text"
                        }, null, 8, i1)
                      ]),
                      s("label", r1, [
                        s("span", null, l(d.value ? "当前图床" : "Selected Host"), 1),
                        s("input", {
                          value: _.value.generalConfig?.mediaHost,
                          disabled: "",
                          type: "text"
                        }, null, 8, u1)
                      ]),
                      s("label", c1, [
                        v[90] || (v[90] = s("span", null, "EasyImage2", -1)),
                        s("input", {
                          value: _.value.generalConfig?.easyImage,
                          disabled: "",
                          type: "text"
                        }, null, 8, d1)
                      ]),
                      s("label", p1, [
                        v[91] || (v[91] = s("span", null, "GitHub", -1)),
                        s("input", {
                          value: _.value.generalConfig?.githubRepo,
                          disabled: "",
                          type: "text"
                        }, null, 8, f1)
                      ]),
                      s("label", v1, [
                        v[92] || (v[92] = s("span", null, "Gitee", -1)),
                        s("input", {
                          value: _.value.generalConfig?.giteeRepo,
                          disabled: "",
                          type: "text"
                        }, null, 8, g1)
                      ])
                    ])
                  ])
                ]))
              ], 64)) : t.surface === "workbench" ? (u(), c(I, { key: 4 }, [
                _.value.activeTab === "develop" ? (u(), c(I, { key: 0 }, [
                  s("section", m1, [
                    (u(!0), c(I, null, U(_.value.topStats || [], (r) => (u(), c("article", {
                      key: r.label,
                      class: q(["ox-vite-stat-card", { emphasis: r.emphasis }])
                    }, [
                      s("span", null, l(r.label), 1),
                      s("strong", null, l(r.value), 1),
                      s("small", null, l(r.note), 1)
                    ], 2))), 128))
                  ]),
                  s("section", y1, [
                    s("p", null, l(d.value ? "把计划、差异分析、Provider 修复、工作区映射与任务中心收束到同一个开发控制台。" : "Bring plan, diff analysis, provider repair, workspace mapping, and task follow-through into one developer control surface."), 1),
                    s("div", h1, [
                      s("div", null, [
                        s("strong", null, l(d.value ? "工作流支持" : "Workflow Support"), 1),
                        s("div", _1, [
                          (u(!0), c(I, null, U(_.value.workflowSupport || [], (r) => (u(), c("span", {
                            key: r.id,
                            class: q(["ox-vite-detail-chip", { "is-disabled": !r.enabled }])
                          }, [
                            s("i", {
                              class: q(r.enabled ? "fa-solid fa-circle-check" : "fa-regular fa-circle")
                            }, null, 2),
                            s("span", null, l(r.label), 1)
                          ], 2))), 128))
                        ])
                      ]),
                      s("div", null, [
                        s("strong", null, l(d.value ? "能力摘要" : "Capability Summary"), 1),
                        s("div", b1, [
                          (u(!0), c(I, null, U(_.value.capabilitySummary || [], (r) => (u(), c("span", {
                            key: r.id,
                            class: q(["ox-vite-detail-chip", { "is-disabled": !r.enabled }])
                          }, [
                            s("i", {
                              class: q(r.enabled ? "fa-solid fa-square-check" : "fa-regular fa-square")
                            }, null, 2),
                            s("span", null, l(r.label), 1)
                          ], 2))), 128))
                        ])
                      ])
                    ])
                  ]),
                  s("section", x1, [
                    s("article", k1, [
                      s("div", S1, [
                        s("h2", null, l(d.value ? "模型服务商" : "Provider Setup"), 1),
                        s("p", null, l(_.value.providerCard?.message || (d.value ? "本地 OpenXnet Runtime 与模型服务的主要接入点。" : "Primary entry for the desktop runtime and model provider integration.")), 1)
                      ]),
                      s("div", w1, [
                        s("span", C1, l(_.value.providerCard?.status || "-"), 1),
                        s("span", M1, l(_.value.providerCard?.apiKeyConfigured ? d.value ? "已配置 API Key" : "API key configured" : d.value ? "缺少 API Key" : "API key missing"), 1),
                        s("span", R1, l(_.value.providerCard?.providerCount) + " " + l(d.value ? "个 provider 选项" : "provider options"), 1)
                      ]),
                      s("div", T1, [
                        s("label", $1, [
                          s("span", null, l((d.value, "Vendor")), 1),
                          s("input", {
                            value: _.value.providerCard?.vendor,
                            disabled: "",
                            type: "text"
                          }, null, 8, A1)
                        ]),
                        s("label", I1, [
                          s("span", null, l(d.value ? "模型" : "Model"), 1),
                          s("input", {
                            value: _.value.providerCard?.model,
                            disabled: "",
                            type: "text"
                          }, null, 8, E1)
                        ]),
                        s("label", P1, [
                          v[93] || (v[93] = s("span", null, "URL", -1)),
                          s("input", {
                            value: _.value.providerCard?.url,
                            disabled: "",
                            type: "text"
                          }, null, 8, D1)
                        ])
                      ]),
                      _.value.providerCard?.validationMessage ? (u(), c("div", O1, l(_.value.providerCard?.validationMessage), 1)) : P("", !0)
                    ]),
                    s("article", V1, [
                      s("div", L1, [
                        s("h2", null, l(d.value ? "OpenXnet-Server 网关" : "Gateway Provider"), 1),
                        s("p", null, l(_.value.gatewayCard?.message || (d.value ? "用于服务端 profile 的模型接入和网关治理。" : "Provider access and gateway governance for the server profile.")), 1)
                      ]),
                      s("div", F1, [
                        s("span", N1, l(_.value.gatewayCard?.enabled ? d.value ? "已启用" : "Enabled" : d.value ? "未启用" : "Disabled"), 1),
                        s("span", j1, l(_.value.gatewayCard?.reachable ? d.value ? "可达" : "Reachable" : d.value ? "不可达" : "Unreachable"), 1),
                        s("span", W1, l(_.value.gatewayCard?.providerCount) + " " + l(d.value ? "个 provider 选项" : "provider options"), 1)
                      ]),
                      s("div", B1, [
                        s("label", U1, [
                          s("span", null, l((d.value, "Vendor")), 1),
                          s("input", {
                            value: _.value.gatewayCard?.vendor,
                            disabled: "",
                            type: "text"
                          }, null, 8, K1)
                        ]),
                        s("label", q1, [
                          s("span", null, l(d.value ? "模型" : "Model"), 1),
                          s("input", {
                            value: _.value.gatewayCard?.model,
                            disabled: "",
                            type: "text"
                          }, null, 8, H1)
                        ]),
                        s("label", z1, [
                          v[94] || (v[94] = s("span", null, "URL", -1)),
                          s("input", {
                            value: _.value.gatewayCard?.url,
                            disabled: "",
                            type: "text"
                          }, null, 8, Y1)
                        ]),
                        s("label", G1, [
                          s("span", null, l(d.value ? "管理地址" : "Management URL"), 1),
                          s("input", {
                            value: _.value.gatewayCard?.managementUrl || "-",
                            disabled: "",
                            type: "text"
                          }, null, 8, Q1)
                        ])
                      ])
                    ]),
                    s("article", X1, [
                      s("div", J1, [
                        s("h2", null, l(d.value ? "默认映射" : "Default Mapping"), 1),
                        s("p", null, l(_.value.mappingCard?.message || (d.value ? "主智能体、模型解析和 provider 映射应在这里先校准。" : "Tune the main agent, model resolution, and provider mapping here first.")), 1)
                      ]),
                      s("div", Z1, [
                        s("article", ex, [
                          s("div", null, [
                            s("strong", null, l(d.value ? "主智能体" : "Main Agent"), 1)
                          ]),
                          s("span", null, l(_.value.mappingCard?.agent || "-"), 1)
                        ]),
                        s("article", tx, [
                          s("div", null, [
                            s("strong", null, l(d.value ? "当前模型" : "Current Model"), 1)
                          ]),
                          s("span", null, l(_.value.mappingCard?.currentModel || "-"), 1)
                        ]),
                        s("article", sx, [
                          s("div", null, [
                            s("strong", null, l(d.value ? "解析结果" : "Resolved Model"), 1)
                          ]),
                          s("span", null, l(_.value.mappingCard?.resolvedModel || "-"), 1)
                        ]),
                        s("article", nx, [
                          s("div", null, [
                            s("strong", null, l(d.value ? "解析来源" : "Resolution Source"), 1)
                          ]),
                          s("span", null, l(_.value.mappingCard?.resolutionSource || "-"), 1)
                        ])
                      ]),
                      s("div", lx, [
                        s("span", ax, l(_.value.mappingCard?.providerModelCount) + " " + l(d.value ? "个 provider 模型" : "provider models"), 1),
                        s("span", ox, l(_.value.mappingCard?.agentCount) + " " + l(d.value ? "个 agent 选项" : "agent options"), 1)
                      ])
                    ]),
                    s("article", ix, [
                      s("div", rx, [
                        s("h2", null, l(d.value ? "CLI 工作区" : "CLI Workspace"), 1),
                        s("p", null, l(_.value.workspaceCard?.message || (d.value ? "CLI 工作区路径、权限模式和可见范围决定后续开发动作的落点。" : "Workspace path, permission mode, and visibility scope define where later coding actions land.")), 1)
                      ]),
                      s("div", ux, [
                        s("span", cx, l(_.value.workspaceCard?.status || "-"), 1),
                        s("span", dx, l(_.value.workspaceCard?.exists ? d.value ? "路径存在" : "Path exists" : d.value ? "路径缺失" : "Path missing"), 1)
                      ]),
                      s("div", px, [
                        s("label", fx, [
                          s("span", null, l(d.value ? "工作区路径" : "Workspace Path"), 1),
                          s("input", {
                            value: _.value.workspaceCard?.path,
                            disabled: "",
                            type: "text"
                          }, null, 8, vx)
                        ]),
                        s("label", gx, [
                          s("span", null, l(d.value ? "执行引擎" : "Engine"), 1),
                          s("input", {
                            value: _.value.workspaceCard?.engine,
                            disabled: "",
                            type: "text"
                          }, null, 8, mx)
                        ]),
                        s("label", yx, [
                          s("span", null, l(d.value ? "权限模式" : "Permission Mode"), 1),
                          s("input", {
                            value: _.value.workspaceCard?.permissionMode,
                            disabled: "",
                            type: "text"
                          }, null, 8, hx)
                        ]),
                        s("label", _x, [
                          s("span", null, l(d.value ? "可见范围" : "Visibility Scope"), 1),
                          s("input", {
                            value: _.value.workspaceCard?.visibilityScope,
                            disabled: "",
                            type: "text"
                          }, null, 8, bx)
                        ])
                      ]),
                      _.value.workspaceCard?.recommendedReason ? (u(), c("div", xx, l(_.value.workspaceCard?.recommendedReason), 1)) : P("", !0)
                    ])
                  ]),
                  s("section", kx, [
                    s("article", Sx, [
                      s("div", wx, [
                        s("h2", null, l(d.value ? "配置就绪度" : "Configuration Readiness"), 1),
                        s("p", null, l(d.value ? "先把运行 Profile、模型接入和 CLI 工作区状态收敛清楚，再让后续任务持续落在正确轨道。" : "Clarify runtime profile, model access, and workspace state before letting later tasks run on the wrong track."), 1)
                      ]),
                      s("div", Cx, [
                        (u(!0), c(I, null, U(_.value.readiness || [], (r) => (u(), c("article", {
                          key: r.id,
                          class: "ox-vite-list-row"
                        }, [
                          s("div", null, [
                            s("strong", null, l(r.label), 1),
                            s("p", null, l(r.note), 1)
                          ]),
                          s("span", Mx, l(r.status), 1)
                        ]))), 128))
                      ])
                    ]),
                    s("article", Rx, [
                      s("div", Tx, [
                        s("h2", null, l(d.value ? "最近开发任务" : "Recent Dev Tasks"), 1),
                        s("p", null, l(d.value ? "把开发流里最近提交的计划、Review 和 Patch 任务继续收束到同一工作面。" : "Keep recent plan, review, and patch tasks visible inside the same workbench."), 1)
                      ]),
                      s("div", $x, [
                        (u(!0), c(I, null, U(_.value.recentTasks || [], (r) => (u(), c("article", {
                          key: r.id,
                          class: "ox-vite-list-row"
                        }, [
                          s("div", null, [
                            s("strong", null, l(r.title), 1),
                            s("p", null, l(r.workflow) + " · " + l(r.updatedAt), 1)
                          ]),
                          s("span", Ax, l(r.status), 1)
                        ]))), 128)),
                        (_.value.recentTasks || []).length ? P("", !0) : (u(), c("article", Ix, [
                          s("div", null, [
                            s("strong", null, l(d.value ? "还没有最近任务" : "No recent tasks yet"), 1),
                            s("p", null, l(d.value ? "等开发任务创建后，这里会开始沉淀最近活动。" : "Recent activity will appear here once dev tasks are created."), 1)
                          ])
                        ]))
                      ])
                    ]),
                    s("article", Ex, [
                      s("div", Px, [
                        s("h2", null, l(d.value ? "工作流模板" : "Workflow Templates"), 1),
                        s("p", null, l(d.value ? "这里会持续沉淀计划、Review、Diff 和 Patch 的工作模板。" : "This panel collects reusable templates for plan, review, diff, and patch workflows."), 1)
                      ]),
                      s("div", Dx, [
                        (u(!0), c(I, null, U(_.value.templates || [], (r) => (u(), c("article", {
                          key: r.id,
                          class: "ox-vite-list-row"
                        }, [
                          s("div", null, [
                            s("strong", null, l(r.title), 1),
                            s("p", null, l(r.summary || r.suggestedGoal || "-"), 1)
                          ]),
                          s("span", Ox, l(r.id), 1)
                        ]))), 128)),
                        (_.value.templates || []).length ? P("", !0) : (u(), c("article", Vx, [
                          s("div", null, [
                            s("strong", null, l(d.value ? "还没有模板" : "No templates yet"), 1),
                            s("p", null, l(d.value ? "模板加载完成后，会显示建议目标和默认工作流。" : "Templates will show suggested goals and default workflows once loaded."), 1)
                          ])
                        ]))
                      ])
                    ]),
                    s("article", Lx, [
                      s("div", Fx, [
                        s("h2", null, l(d.value ? "当前告警" : "Warnings"), 1),
                        s("p", null, l(d.value ? "阻塞项和注意事项应该集中出现在工作台里，而不是藏在设置深处。" : "Blockers and cautions should stay visible in the workbench instead of hiding deep in settings."), 1)
                      ]),
                      s("div", Nx, [
                        (u(!0), c(I, null, U(_.value.warnings || [], (r, W) => (u(), c("article", {
                          key: `${W}-${r}`,
                          class: "ox-vite-list-row"
                        }, [
                          s("div", null, [
                            s("strong", null, l(d.value ? "注意事项" : "Warning"), 1),
                            s("p", null, l(r), 1)
                          ])
                        ]))), 128)),
                        (_.value.warnings || []).length ? P("", !0) : (u(), c("article", jx, [
                          s("div", null, [
                            s("strong", null, l(d.value ? "当前没有告警" : "No warnings right now"), 1),
                            s("p", null, l(d.value ? "当 provider、映射或工作区存在风险时，这里会优先显示。" : "Provider, mapping, or workspace issues will surface here first."), 1)
                          ])
                        ]))
                      ])
                    ])
                  ])
                ], 64)) : (u(), c("section", Wx, [
                  s("article", Bx, [
                    s("div", Ux, [
                      s("h2", null, l(_.value.meta?.title), 1),
                      s("p", null, l(_.value.meta?.summary), 1)
                    ]),
                    s("div", Kx, [
                      (u(!0), c(I, null, U(_.value.stats || [], (r) => (u(), c("article", {
                        key: r.label,
                        class: "ox-vite-list-row"
                      }, [
                        s("div", null, [
                          s("strong", null, l(r.label), 1),
                          s("p", null, l(r.meta), 1)
                        ]),
                        s("span", null, l(r.value), 1)
                      ]))), 128))
                    ])
                  ])
                ]))
              ], 64)) : t.surface === "enterprise" ? (u(), c(I, { key: 5 }, [
                s("section", qx, [
                  (u(!0), c(I, null, U(_.value.topStats || [], (r) => (u(), c("article", {
                    key: r.title,
                    class: "ox-vite-stat-card"
                  }, [
                    s("span", null, l(r.title), 1),
                    s("strong", null, l(r.value), 1),
                    s("small", null, l(r.note), 1)
                  ]))), 128))
                ]),
                s("section", Hx, [
                  s("p", null, l(_.value.meta?.summary), 1),
                  s("div", zx, [
                    (u(!0), c(I, null, U(_.value.meta?.chips || [], (r) => (u(), c("span", {
                      key: r.icon + r.text,
                      class: "ox-vite-detail-chip"
                    }, [
                      s("i", {
                        class: q(r.icon)
                      }, null, 2),
                      s("span", null, l(r.text), 1)
                    ]))), 128))
                  ])
                ]),
                _.value.activeTab === "usage" ? (u(), c(I, { key: 0 }, [
                  s("section", Yx, [
                    (u(!0), c(I, null, U(_.value.usagePanel?.metrics || [], (r) => (u(), c("article", {
                      key: r.label,
                      class: "ox-vite-stat-card"
                    }, [
                      s("span", null, l(r.label), 1),
                      s("strong", null, l(r.value), 1)
                    ]))), 128))
                  ]),
                  s("section", Gx, [
                    s("article", Qx, [
                      s("div", Xx, [
                        s("h2", null, l(d.value ? "用量趋势" : "Usage Trend"), 1),
                        s("p", null, l(d.value ? "这里先把近期 token 变化做成轻量条形视图，后续继续贴近原型中的图表层次。" : "A lightweight token trend view for now, with a closer chart treatment coming next."), 1)
                      ]),
                      s("div", Jx, [
                        (u(!0), c(I, null, U(_.value.usagePanel?.trend || [], (r) => (u(), c("div", {
                          key: r.id,
                          class: "ox-vite-mini-bars__item"
                        }, [
                          s("div", {
                            class: "ox-vite-mini-bars__bar",
                            style: pt({ height: `${Math.max(10, Math.min(100, r.value ? r.value / Math.max(...(_.value.usagePanel?.trend || []).map((W) => W.value || 0), 1) * 100 : 10))}%` })
                          }, null, 4),
                          s("span", null, l(r.label), 1)
                        ]))), 128))
                      ])
                    ]),
                    s("article", Zx, [
                      s("div", ek, [
                        s("h2", null, l(d.value ? "模型用量" : "Usage by Model"), 1)
                      ]),
                      s("div", tk, [
                        (u(!0), c(I, null, U(_.value.usagePanel?.models || [], (r) => (u(), c("article", {
                          key: r.id,
                          class: "ox-vite-list-row"
                        }, [
                          s("div", null, [
                            s("strong", null, l(r.name), 1),
                            s("p", null, l(r.requests) + " " + l(d.value ? "次请求" : "requests"), 1)
                          ]),
                          s("span", null, l(r.tokens) + " tokens · $" + l(r.cost.toFixed(4)), 1)
                        ]))), 128))
                      ])
                    ])
                  ]),
                  s("section", sk, [
                    s("div", nk, [
                      s("h2", null, l(d.value ? "用户用量" : "Usage by User"), 1)
                    ]),
                    s("div", lk, [
                      (u(!0), c(I, null, U(_.value.usagePanel?.users || [], (r) => (u(), c("article", {
                        key: r.id,
                        class: "ox-vite-list-row"
                      }, [
                        s("div", null, [
                          s("strong", null, l(r.name), 1),
                          s("p", null, l(r.requests) + " " + l(d.value ? "次请求" : "requests"), 1)
                        ]),
                        s("span", null, l(r.tokens) + " tokens · " + l(r.latency) + "ms", 1)
                      ]))), 128))
                    ])
                  ])
                ], 64)) : _.value.activeTab === "neuro" ? (u(), c(I, { key: 1 }, [
                  s("section", ak, [
                    (u(!0), c(I, null, U(_.value.neuroPanel?.metrics || [], (r) => (u(), c("article", {
                      key: r.label,
                      class: "ox-vite-stat-card"
                    }, [
                      s("span", null, l(r.label), 1),
                      s("strong", null, l(r.value), 1)
                    ]))), 128))
                  ]),
                  s("section", ok, [
                    s("article", ik, [
                      s("div", rk, [
                        s("h2", null, l(d.value ? "神经符号" : "Symbols"), 1)
                      ]),
                      s("div", uk, [
                        (u(!0), c(I, null, U(_.value.neuroPanel?.symbols || [], (r) => (u(), c("article", {
                          key: r.id,
                          class: "ox-vite-list-row"
                        }, [
                          s("div", null, [
                            s("strong", null, l(r.label), 1),
                            s("p", null, l(r.operator) + " · " + l(r.entities.join(", ") || "-"), 1)
                          ]),
                          s("span", null, l(Math.round(r.successRate * 100)) + "% · " + l(r.activations), 1)
                        ]))), 128))
                      ])
                    ]),
                    s("article", ck, [
                      s("div", dk, [
                        s("h2", null, l(d.value ? "认知规则" : "Cognitive Rules"), 1)
                      ]),
                      s("div", pk, [
                        (u(!0), c(I, null, U(_.value.neuroPanel?.rules || [], (r) => (u(), c("article", {
                          key: r.id,
                          class: "ox-vite-list-row"
                        }, [
                          s("div", null, [
                            s("strong", null, l(r.name), 1),
                            s("p", null, l(r.domain) + " · " + l(r.description), 1)
                          ]),
                          s("span", null, l(r.enabled ? "ON" : "OFF"), 1)
                        ]))), 128))
                      ])
                    ])
                  ])
                ], 64)) : _.value.activeTab === "kg" ? (u(), c(I, { key: 2 }, [
                  s("section", fk, [
                    (u(!0), c(I, null, U(_.value.kgPanel?.metrics || [], (r) => (u(), c("article", {
                      key: r.label,
                      class: "ox-vite-stat-card"
                    }, [
                      s("span", null, l(r.label), 1),
                      s("strong", null, l(r.value), 1)
                    ]))), 128))
                  ]),
                  s("section", vk, [
                    s("div", gk, [
                      s("h2", null, l(d.value ? "实体事实" : "Entity Facts"), 1),
                      s("p", null, l(d.value ? "这一层先把知识图谱查询结果收束成可读列表，后续再继续贴近图谱可视化原型。" : "This pass keeps graph query results readable first, with a more visual graph view to follow."), 1)
                    ]),
                    s("div", mk, [
                      (u(!0), c(I, null, U(_.value.kgPanel?.facts || [], (r) => (u(), c("article", {
                        key: r.id,
                        class: "ox-vite-list-row"
                      }, [
                        s("div", null, [
                          s("strong", null, l(r.subject), 1),
                          s("p", null, l(r.predicate), 1)
                        ]),
                        s("span", null, l(r.object), 1)
                      ]))), 128)),
                      (_.value.kgPanel?.facts || []).length ? P("", !0) : (u(), c("article", yk, [
                        s("div", null, [
                          s("strong", null, l(d.value ? "当前没有实体事实" : "No entity facts yet"), 1),
                          s("p", null, l(d.value ? "当图谱实体查询成功后，结果会先沉淀在这里。" : "Facts will appear here once entity queries return data."), 1)
                        ])
                      ]))
                    ])
                  ])
                ], 64)) : _.value.activeTab === "enterprise-kb" ? (u(), c("section", hk, [
                  s("section", _k, [
                    s("div", bk, [
                      s("div", xk, l(d.value ? "企业知识库" : "Enterprise Knowledge"), 1),
                      s("h2", null, l(d.value ? "统一管理知识库、分类与文档沉淀" : "Manage knowledge bases, categories, and document coverage in one place"), 1),
                      s("p", null, l(d.value ? "把知识库、分类、文档规模和版本演进收束进同一条企业工作流，便于团队共享知识和后续接入知识图谱。" : "Keep knowledge bases, categories, document scale, and version history aligned in one enterprise workflow."), 1)
                    ]),
                    s("div", kk, [
                      s("article", Sk, [
                        s("span", null, l(es.value.totalCount || (es.value.items || []).length), 1),
                        s("small", null, l(d.value ? "知识库" : "KBs"), 1)
                      ]),
                      s("article", wk, [
                        s("span", null, l(es.value.totalDocs || 0), 1),
                        s("small", null, l(d.value ? "文档总量" : "Docs"), 1)
                      ]),
                      s("article", Ck, [
                        s("span", null, l(Ln.value.length - 1), 1),
                        s("small", null, l(d.value ? "分类" : "Categories"), 1)
                      ])
                    ])
                  ]),
                  s("section", Mk, [
                    s("div", Rk, [
                      v[96] || (v[96] = s("i", { class: "fa-solid fa-magnifying-glass" }, null, -1)),
                      je(s("input", {
                        "onUpdate:modelValue": v[19] || (v[19] = (r) => M.value = r),
                        type: "text",
                        placeholder: d.value ? "搜索知识库名称、分类或描述" : "Search KB name, category, or description"
                      }, null, 8, Tk), [
                        [Qe, M.value]
                      ]),
                      M.value ? (u(), c("button", {
                        key: 0,
                        type: "button",
                        class: "ox-vite-role-search__clear",
                        onClick: v[20] || (v[20] = (r) => M.value = "")
                      }, [...v[95] || (v[95] = [
                        s("i", { class: "fa-solid fa-xmark" }, null, -1)
                      ])])) : P("", !0)
                    ]),
                    s("button", {
                      type: "button",
                      class: "ox-vite-ops-primary-btn",
                      onClick: ei
                    }, [
                      v[97] || (v[97] = s("i", { class: "fa-solid fa-plus" }, null, -1)),
                      s("span", null, l(d.value ? "新建知识库" : "Create KB"), 1)
                    ])
                  ]),
                  s("section", $k, [
                    (u(!0), c(I, null, U(Ln.value, (r) => (u(), c("button", {
                      key: r.id,
                      type: "button",
                      class: q(["ox-vite-role-category-chip", { "is-active": V.value === r.id }]),
                      onClick: (W) => V.value = r.id
                    }, [
                      s("span", null, l(r.label), 1),
                      s("strong", null, l(r.id === "all" ? (es.value.items || []).length : (es.value.items || []).filter((W) => W.category === r.id).length), 1)
                    ], 10, Ak))), 128))
                  ]),
                  s("section", Ik, [
                    s("article", Ek, [
                      s("div", Pk, [
                        s("div", null, [
                          s("div", Dk, l(d.value ? "知识库列表" : "Knowledge Base Library"), 1),
                          s("h2", null, l(d.value ? "当前企业知识库" : "Current Enterprise Knowledge Bases"), 1)
                        ]),
                        s("div", Ok, l(Fn.value.length), 1)
                      ]),
                      Fn.value.length ? (u(), c("div", Vk, [
                        (u(!0), c(I, null, U(Fn.value, (r) => (u(), c("article", {
                          key: r.id,
                          class: "ox-vite-kb-card"
                        }, [
                          s("div", Lk, [
                            s("div", Fk, [
                              v[98] || (v[98] = s("div", { class: "ox-vite-kb-card__icon" }, [
                                s("i", { class: "fa-solid fa-book-open" })
                              ], -1)),
                              s("div", null, [
                                s("div", Nk, l(r.name), 1),
                                s("div", jk, l(r.category), 1)
                              ])
                            ]),
                            s("span", Wk, l(r.docs) + " " + l(d.value ? "篇文档" : "docs"), 1)
                          ]),
                          s("p", null, l(r.description || (d.value ? "当前知识库还没有补充描述。" : "No KB description yet.")), 1),
                          s("div", Bk, [
                            r.updatedAt ? (u(), c("span", Uk, l(r.updatedAt), 1)) : P("", !0)
                          ]),
                          s("div", Kk, [
                            s("button", {
                              type: "button",
                              class: "ox-vite-ops-secondary-btn",
                              onClick: (W) => ti(r)
                            }, [
                              v[99] || (v[99] = s("i", { class: "fa-solid fa-pen" }, null, -1)),
                              s("span", null, l(d.value ? "编辑" : "Edit"), 1)
                            ], 8, qk),
                            s("button", {
                              type: "button",
                              class: "ox-vite-ops-secondary-btn",
                              onClick: (W) => li(r)
                            }, [
                              v[100] || (v[100] = s("i", { class: "fa-solid fa-clock-rotate-left" }, null, -1)),
                              s("span", null, l(d.value ? "版本" : "Versions"), 1)
                            ], 8, Hk),
                            s("button", {
                              type: "button",
                              class: "ox-vite-ops-secondary-btn",
                              onClick: (W) => ni(r)
                            }, [
                              v[101] || (v[101] = s("i", { class: "fa-regular fa-trash-can" }, null, -1)),
                              s("span", null, l(d.value ? "删除" : "Delete"), 1)
                            ], 8, zk)
                          ])
                        ]))), 128))
                      ])) : (u(), c("div", Yk, [
                        v[102] || (v[102] = s("i", { class: "fa-solid fa-book-open" }, null, -1)),
                        s("strong", null, l(d.value ? "还没有知识库" : "No knowledge bases yet"), 1),
                        s("p", null, l(d.value ? "先创建一个知识库，后续再继续承接文档上传和版本演进。" : "Create the first KB, then continue with docs and version flows."), 1)
                      ]))
                    ]),
                    s("aside", Gk, [
                      tt.value === "editor" && Se.value ? (u(), c(I, { key: 0 }, [
                        s("div", Qk, [
                          s("div", null, [
                            s("div", Xk, l(d.value ? "知识库编辑器" : "KB Editor"), 1),
                            s("h2", null, l(Ke.value.id ? d.value ? "编辑知识库" : "Edit Knowledge Base" : d.value ? "新建知识库" : "Create Knowledge Base"), 1)
                          ])
                        ]),
                        s("div", Jk, [
                          s("label", Zk, [
                            s("span", null, l(d.value ? "知识库名称" : "KB Name"), 1),
                            je(s("input", {
                              "onUpdate:modelValue": v[21] || (v[21] = (r) => Ke.value.name = r),
                              type: "text"
                            }, null, 512), [
                              [Qe, Ke.value.name]
                            ])
                          ]),
                          s("label", eS, [
                            s("span", null, l(d.value ? "分类" : "Category"), 1),
                            je(s("input", {
                              "onUpdate:modelValue": v[22] || (v[22] = (r) => Ke.value.category = r),
                              type: "text"
                            }, null, 512), [
                              [Qe, Ke.value.category]
                            ])
                          ]),
                          s("label", tS, [
                            s("span", null, l(d.value ? "描述" : "Description"), 1),
                            je(s("input", {
                              "onUpdate:modelValue": v[23] || (v[23] = (r) => Ke.value.description = r),
                              type: "text"
                            }, null, 512), [
                              [Qe, Ke.value.description]
                            ])
                          ])
                        ]),
                        s("div", sS, [
                          s("button", {
                            type: "button",
                            class: "ox-vite-ops-secondary-btn",
                            onClick: v[24] || (v[24] = (r) => {
                              Se.value = !1, tt.value = "summary";
                            })
                          }, [
                            v[103] || (v[103] = s("i", { class: "fa-solid fa-xmark" }, null, -1)),
                            s("span", null, l(d.value ? "取消" : "Cancel"), 1)
                          ]),
                          s("button", {
                            type: "button",
                            class: "ox-vite-ops-primary-btn",
                            disabled: !Ke.value.name,
                            onClick: si
                          }, [
                            v[104] || (v[104] = s("i", { class: "fa-solid fa-check" }, null, -1)),
                            s("span", null, l(Ke.value.id ? d.value ? "保存" : "Save" : d.value ? "创建" : "Create"), 1)
                          ], 8, nS)
                        ])
                      ], 64)) : tt.value === "versions" && He.value ? (u(), c(I, { key: 1 }, [
                        s("div", lS, [
                          s("div", null, [
                            s("div", aS, l(d.value ? "版本历史" : "Version History"), 1),
                            s("h2", null, l(d.value ? "知识库版本演进" : "Knowledge Base Revisions"), 1)
                          ])
                        ]),
                        ze.value.length ? (u(), c("div", oS, [
                          (u(!0), c(I, null, U(ze.value, (r, W) => (u(), c("article", {
                            key: `${r.version || W}`,
                            class: "ox-vite-list-row"
                          }, [
                            s("div", null, [
                              s("strong", null, "v" + l(r.version || W + 1), 1),
                              s("p", null, l(r.created_at || (d.value ? "暂无时间信息" : "No timestamp")), 1)
                            ]),
                            s("span", null, l(r.doc_count || 0) + " " + l(d.value ? "篇文档" : "docs"), 1)
                          ]))), 128))
                        ])) : (u(), c("div", iS, [
                          v[105] || (v[105] = s("i", { class: "fa-solid fa-clock-rotate-left" }, null, -1)),
                          s("strong", null, l(d.value ? "暂无版本历史" : "No version history yet"), 1)
                        ])),
                        s("div", rS, [
                          s("button", {
                            type: "button",
                            class: "ox-vite-ops-secondary-btn",
                            onClick: v[25] || (v[25] = (r) => {
                              He.value = !1, tt.value = "summary";
                            })
                          }, [
                            v[106] || (v[106] = s("i", { class: "fa-solid fa-arrow-left" }, null, -1)),
                            s("span", null, l(d.value ? "返回" : "Back"), 1)
                          ])
                        ])
                      ], 64)) : (u(), c(I, { key: 2 }, [
                        s("div", uS, [
                          s("div", null, [
                            s("div", cS, l(d.value ? "知识工程提示" : "Knowledge Engineering Notes"), 1),
                            s("h2", null, l(d.value ? "先把知识库沉淀成稳定入口" : "Turn KBs into a stable operating surface first"), 1)
                          ])
                        ]),
                        s("div", dS, [
                          s("article", pS, [
                            s("div", null, [
                              s("strong", null, l(d.value ? "分类先于扩张" : "Categorize before scaling"), 1),
                              s("p", null, l(d.value ? "先让知识库有清晰分类和描述，再继续接文档上传和图谱关系。" : "Give each KB a clear category and scope before expanding into files and graph links."), 1)
                            ])
                          ]),
                          s("article", fS, [
                            s("div", null, [
                              s("strong", null, l(d.value ? "版本历史保留审计线" : "Version history preserves the audit trail"), 1),
                              s("p", null, l(d.value ? "后续继续细化版本差异、回滚和文档批次信息。" : "The next pass can deepen version diff, rollback, and document batch details."), 1)
                            ])
                          ])
                        ])
                      ], 64))
                    ])
                  ])
                ])) : _.value.activeTab === "staff-roles" ? (u(), c("section", vS, [
                  s("section", gS, [
                    s("div", mS, [
                      s("div", yS, l(d.value ? "OpenXnet 内置岗位中心" : "OpenXnet Built-in Role Studio"), 1),
                      s("h2", null, l(d.value ? "OpenXnet 内置职工角色模板库" : "OpenXnet Built-in Staff Role Library"), 1),
                      s("p", null, l(d.value ? "围绕平台工程、知识工程、测试质量、客户服务等方向扩展更多员工类型角色，便于企业空间快速组建协作团队，同时保持命名、文案和布局为 OpenXnet 自有表达。" : "Expand staff roles across platform, knowledge, quality, and service domains so enterprise spaces can assemble teams quickly with OpenXnet-native naming and presentation."), 1)
                    ]),
                    s("div", hS, [
                      s("article", _S, [
                        s("span", null, l(ws.value.templateCount || Zt.value.length), 1),
                        s("small", null, l(d.value ? "岗位模板" : "Templates"), 1)
                      ]),
                      s("article", bS, [
                        s("span", null, l(ws.value.createdCount || Cs.value.length), 1),
                        s("small", null, l(d.value ? "已创建员工" : "Created Roles"), 1)
                      ]),
                      s("article", xS, [
                        s("span", null, l(ws.value.enabledCount || Cs.value.filter((r) => r.enabled).length), 1),
                        s("small", null, l(d.value ? "启用中" : "Enabled"), 1)
                      ])
                    ])
                  ]),
                  s("section", kS, [
                    s("div", SS, [
                      v[108] || (v[108] = s("i", { class: "fa-solid fa-magnifying-glass" }, null, -1)),
                      je(s("input", {
                        "onUpdate:modelValue": v[26] || (v[26] = (r) => ce.value = r),
                        type: "text",
                        placeholder: d.value ? "搜索岗位名称、部门、技能或职责" : "Search roles, departments, skills, or responsibilities"
                      }, null, 8, wS), [
                        [Qe, ce.value]
                      ]),
                      ce.value ? (u(), c("button", {
                        key: 0,
                        type: "button",
                        class: "ox-vite-role-search__clear",
                        onClick: v[27] || (v[27] = (r) => ce.value = "")
                      }, [...v[107] || (v[107] = [
                        s("i", { class: "fa-solid fa-xmark" }, null, -1)
                      ])])) : P("", !0)
                    ]),
                    s("button", {
                      type: "button",
                      class: "ox-vite-ops-primary-btn",
                      onClick: Re
                    }, [
                      v[109] || (v[109] = s("i", { class: "fa-solid fa-user-plus" }, null, -1)),
                      s("span", null, l(d.value ? "新建自定义员工" : "Create Custom Role"), 1)
                    ])
                  ]),
                  s("section", CS, [
                    (u(!0), c(I, null, U(oi.value, (r) => (u(), c("button", {
                      key: r.id,
                      type: "button",
                      class: q(["ox-vite-role-category-chip", { "is-active": O.value === r.id }]),
                      onClick: (W) => O.value = r.id
                    }, [
                      s("span", null, l(r.label), 1),
                      s("strong", null, l(ri(r.id)), 1)
                    ], 10, MS))), 128))
                  ]),
                  s("section", RS, [
                    s("article", TS, [
                      s("div", $S, [
                        s("div", null, [
                          s("div", AS, l(d.value ? "内置模板岗位库" : "Built-in Template Library"), 1),
                          s("h2", null, l(d.value ? "从模板快速创建职工角色卡" : "Quickly Create Staff Roles from Templates"), 1)
                        ]),
                        s("div", IS, l(En.value.length), 1)
                      ]),
                      En.value.length ? (u(), c("div", ES, [
                        (u(!0), c(I, null, U(En.value, (r) => (u(), c("button", {
                          key: r.id,
                          type: "button",
                          class: "ox-vite-role-template-card",
                          style: pt(Vn(r)),
                          onClick: (W) => qe(r.id)
                        }, [
                          v[111] || (v[111] = s("div", { class: "ox-vite-role-template-card__glow" }, null, -1)),
                          s("div", DS, [
                            s("div", OS, [
                              s("i", {
                                class: q(r.icon)
                              }, null, 2)
                            ]),
                            s("span", VS, l(r.categoryLabel || (d.value ? "未分类" : "Uncategorized")), 1)
                          ]),
                          s("div", LS, l(r.name), 1),
                          s("div", FS, l(r.department), 1),
                          s("p", NS, l(r.summary), 1),
                          s("div", jS, [
                            (u(!0), c(I, null, U(r.skills || [], (W) => (u(), c("span", {
                              key: `${r.id}-${W}`,
                              class: "ox-vite-detail-chip"
                            }, l(W), 1))), 128))
                          ]),
                          s("div", WS, [
                            s("span", null, l(d.value ? "点击创建" : "Create from this role"), 1),
                            v[110] || (v[110] = s("i", { class: "fa-solid fa-arrow-up-right-from-square" }, null, -1))
                          ])
                        ], 12, PS))), 128))
                      ])) : (u(), c("div", BS, [
                        v[112] || (v[112] = s("i", { class: "fa-solid fa-folder-open" }, null, -1)),
                        s("strong", null, l(d.value ? "没有匹配的岗位模板" : "No matching staff role templates"), 1),
                        s("p", null, l(d.value ? "可以更换分类或清空搜索条件后继续查看。" : "Try a different category or clear the search to continue."), 1)
                      ]))
                    ]),
                    s("aside", US, [
                      s("div", KS, [
                        s("div", null, [
                          s("div", qS, l(d.value ? "推荐模板" : "Spotlight"), 1),
                          s("h2", null, l(d.value ? "优先启用的岗位组合" : "Recommended Role Mixes"), 1)
                        ])
                      ]),
                      s("div", HS, [
                        (u(!0), c(I, null, U(ii.value, (r) => (u(), c("button", {
                          key: `spotlight-${r.id}`,
                          type: "button",
                          class: "ox-vite-role-spotlight__card",
                          style: pt(Vn(r)),
                          onClick: (W) => qe(r.id)
                        }, [
                          s("div", YS, [
                            s("i", {
                              class: q(r.icon)
                            }, null, 2)
                          ]),
                          s("div", GS, [
                            s("div", QS, l(r.name), 1),
                            s("div", XS, l(r.department), 1),
                            s("p", null, l(r.summary), 1)
                          ])
                        ], 12, zS))), 128))
                      ]),
                      s("div", JS, [
                        v[113] || (v[113] = s("i", { class: "fa-solid fa-sparkles" }, null, -1)),
                        s("span", null, l(d.value ? "建议先创建 2-3 个基础岗位，再为每个工作空间补充专业岗位，能更快形成团队协作闭环。" : "Start with 2-3 core roles, then add specialist roles per workspace to form a stronger collaboration loop."), 1)
                      ])
                    ])
                  ]),
                  s("section", ZS, [
                    s("div", ew, [
                      s("div", null, [
                        s("div", tw, l(d.value ? "我的员工卡" : "My Staff Roles"), 1),
                        s("h2", null, l(d.value ? "已创建的企业职工角色卡" : "Created Enterprise Staff Roles"), 1)
                      ]),
                      s("div", sw, l(Cs.value.length), 1)
                    ]),
                    Cs.value.length ? (u(), c("div", nw, [
                      (u(!0), c(I, null, U(Cs.value, (r) => (u(), c("article", {
                        key: r.id,
                        class: "ox-vite-role-library-card",
                        style: pt(Vn(r))
                      }, [
                        s("div", lw, [
                          s("span", {
                            class: q(["ox-vite-detail-chip", { "is-active": r.enabled }])
                          }, l(r.enabled ? d.value ? "启用中" : "Enabled" : d.value ? "已停用" : "Disabled"), 3),
                          s("button", {
                            type: "button",
                            class: "ox-vite-role-library-card__delete",
                            onClick: (W) => ut(r.id)
                          }, [...v[114] || (v[114] = [
                            s("i", { class: "fa-regular fa-trash-can" }, null, -1)
                          ])], 8, aw)
                        ]),
                        s("div", ow, [
                          s("div", iw, [
                            s("i", {
                              class: q(r.icon)
                            }, null, 2)
                          ]),
                          s("div", rw, [
                            s("div", uw, l(r.name), 1),
                            s("div", cw, [
                              r.department ? (u(), c("span", dw, l(r.department), 1)) : P("", !0),
                              r.workspace ? (u(), c("span", pw, l(r.workspace), 1)) : P("", !0)
                            ])
                          ])
                        ]),
                        s("p", fw, l(r.summary), 1),
                        s("div", vw, [
                          (u(!0), c(I, null, U(r.skills || [], (W) => (u(), c("span", {
                            key: `${r.id}-${W}`,
                            class: "ox-vite-detail-chip"
                          }, l(W), 1))), 128))
                        ])
                      ], 4))), 128)),
                      s("button", {
                        type: "button",
                        class: "ox-vite-role-library-card ox-vite-role-library-card--add",
                        onClick: Re
                      }, [
                        v[115] || (v[115] = s("i", { class: "fa-solid fa-user-plus" }, null, -1)),
                        s("div", null, l(d.value ? "添加职工角色卡" : "Add Staff Role"), 1)
                      ])
                    ])) : (u(), c("div", gw, [
                      v[116] || (v[116] = s("i", { class: "fa-solid fa-user-group" }, null, -1)),
                      s("strong", null, l(d.value ? "还没有创建员工角色卡" : "No staff roles created yet"), 1),
                      s("p", null, l(d.value ? "先从模板岗位库中挑选一个岗位开始。" : "Start by choosing a template from the role library above."), 1)
                    ]))
                  ])
                ])) : _.value.activeTab === "enterprise-workspaces" ? (u(), c("section", mw, [
                  s("section", yw, [
                    s("div", hw, [
                      s("div", _w, l(d.value ? "企业工作空间" : "Enterprise Workspaces"), 1),
                      s("h2", null, l(d.value ? "统一管理工作空间、角色绑定与项目边界" : "Manage workspaces, role bindings, and project boundaries in one lane"), 1),
                      s("p", null, l(d.value ? "先在这里统一创建和检查工作空间，再进入企业沙盘查看项目楼层、员工角色和 3D 结构，避免菜单有入口但缺少对应工作空间配置。" : "Create and review workspaces here first, then enter the enterprise sandbox for projects, staff roles, and the 3D structure."), 1)
                    ]),
                    s("div", bw, [
                      s("button", {
                        type: "button",
                        class: "ox-vite-ops-primary-btn",
                        onClick: ot
                      }, [
                        v[117] || (v[117] = s("i", { class: "fa-solid fa-plus" }, null, -1)),
                        s("span", null, l(d.value ? "创建工作空间" : "Create Workspace"), 1)
                      ])
                    ])
                  ]),
                  Ll.value.items?.length ? (u(), c("section", xw, [
                    (u(!0), c(I, null, U(Ll.value.items || [], (r) => (u(), c("article", {
                      key: r.id,
                      class: "ox-vite-workspace-card"
                    }, [
                      s("div", kw, [
                        s("div", Sw, [
                          v[118] || (v[118] = s("div", { class: "ox-vite-workspace-card__icon" }, [
                            s("i", { class: "fa-solid fa-building" })
                          ], -1)),
                          s("div", ww, [
                            s("div", Cw, l(r.name), 1),
                            s("div", Mw, l(r.summary || r.path), 1)
                          ])
                        ]),
                        s("span", Rw, l(r.type), 1)
                      ]),
                      s("div", Tw, [
                        s("article", $w, [
                          s("span", null, l(d.value ? "项目楼层" : "Projects"), 1),
                          s("strong", null, l(r.projectCount), 1)
                        ]),
                        s("article", Aw, [
                          s("span", null, l(d.value ? "指派角色" : "Roles"), 1),
                          s("strong", null, l(r.roleCount), 1)
                        ]),
                        s("article", Iw, [
                          s("span", null, l(d.value ? "权限" : "Permission"), 1),
                          s("strong", null, l(Bl(r.permission)), 1)
                        ])
                      ]),
                      s("div", Ew, [
                        s("span", Pw, l(r.summary || r.path), 1),
                        r.updatedAt ? (u(), c("span", Dw, l(r.updatedAt), 1)) : P("", !0)
                      ]),
                      s("div", Ow, [
                        s("button", {
                          type: "button",
                          class: "ox-vite-ops-primary-btn",
                          onClick: (W) => rs(r.id)
                        }, [
                          v[119] || (v[119] = s("i", { class: "fa-solid fa-cube" }, null, -1)),
                          s("span", null, l(d.value ? "进入企业沙盘" : "Open Sandbox"), 1)
                        ], 8, Vw),
                        s("button", {
                          type: "button",
                          class: "ox-vite-ops-secondary-btn",
                          onClick: (W) => Ht(r.id)
                        }, [
                          v[120] || (v[120] = s("i", { class: "fa-solid fa-pen" }, null, -1)),
                          s("span", null, l(d.value ? "复制配置" : "Duplicate Draft"), 1)
                        ], 8, Lw),
                        s("button", {
                          type: "button",
                          class: "ox-vite-ops-secondary-btn",
                          onClick: (W) => st(r.id)
                        }, [
                          v[121] || (v[121] = s("i", { class: "fa-regular fa-trash-can" }, null, -1)),
                          s("span", null, l(d.value ? "删除" : "Delete"), 1)
                        ], 8, Fw)
                      ])
                    ]))), 128))
                  ])) : (u(), c("section", Nw, [
                    v[123] || (v[123] = s("i", { class: "fa-solid fa-building" }, null, -1)),
                    s("strong", null, l(d.value ? "还没有工作空间" : "No workspaces yet"), 1),
                    s("p", null, l(d.value ? "创建第一个工作空间后，这里会展示项目边界、权限和角色绑定。" : "Create the first workspace and this panel will show project boundaries, permissions, and role bindings."), 1),
                    s("button", {
                      type: "button",
                      class: "ox-vite-ops-primary-btn",
                      onClick: ot
                    }, [
                      v[122] || (v[122] = s("i", { class: "fa-solid fa-plus" }, null, -1)),
                      s("span", null, l(d.value ? "创建第一个工作空间" : "Create the first workspace"), 1)
                    ])
                  ]))
                ])) : _.value.activeTab === "enterprise-sandbox" ? (u(), c("section", jw, [
                  s("section", Ww, [
                    s("div", Bw, [
                      Ve.value.level > 0 ? (u(), c("button", {
                        key: 0,
                        type: "button",
                        class: "ox-vite-sandbox-back",
                        onClick: Ho
                      }, [...v[124] || (v[124] = [
                        s("i", { class: "fa-solid fa-chevron-left" }, null, -1)
                      ])])) : P("", !0),
                      s("div", Uw, [
                        s("div", Kw, l(d.value ? "企业沙盘" : "Enterprise Sandbox"), 1),
                        s("h2", null, l(Ve.value.levelLabel || (d.value ? "企业园区" : "Enterprise Campus")), 1),
                        s("p", null, l(d.value ? "在这里按层级查看当前工作空间、项目楼层与员工编组，逐步逼近 3D 沙盘里的结构关系。" : "Inspect the current workspace, project floors, and staff roster by level, moving closer to the full 3D sandbox structure."), 1)
                      ])
                    ]),
                    s("div", qw, [
                      (u(!0), c(I, null, U(Ve.value.breadcrumb || [], (r, W) => (u(), c("button", {
                        key: `${r.id}-${W}`,
                        type: "button",
                        class: q(["ox-vite-sandbox-breadcrumb__chip", { "is-current": W === (Ve.value.breadcrumb || []).length - 1 }]),
                        onClick: (ts) => W === (Ve.value.breadcrumb || []).length - 1 ? null : zo(r)
                      }, l(r.label), 11, Hw))), 128))
                    ])
                  ]),
                  s("section", zw, [
                    s("article", Yw, [
                      s("span", null, l(d.value ? "当前层级" : "Current Level"), 1),
                      s("strong", null, l(Ve.value.level), 1),
                      s("small", null, l(Ve.value.levelLabel), 1)
                    ]),
                    s("article", Gw, [
                      s("span", null, l(d.value ? "当前工作空间" : "Current Workspace"), 1),
                      s("strong", null, l(Ve.value.currentWorkspace || "-"), 1)
                    ]),
                    s("article", Qw, [
                      s("span", null, l(d.value ? "当前项目" : "Current Project"), 1),
                      s("strong", null, l(Ve.value.currentProject || "-"), 1)
                    ]),
                    s("article", Xw, [
                      s("span", null, l(d.value ? "沙盘智能体" : "Sandbox Agents"), 1),
                      s("strong", null, l(Ve.value.roleCount || (Ve.value.items || []).length), 1)
                    ])
                  ]),
                  s("section", Jw, [
                    s("article", Zw, [
                      s("div", e0, [
                        s("div", null, [
                          s("div", t0, l(d.value ? "工作空间层" : "Workspace Layer"), 1),
                          s("h2", null, l(d.value ? "当前工作空间入口" : "Workspace Access Points"), 1)
                        ]),
                        s("button", {
                          type: "button",
                          class: "ox-vite-ops-primary-btn",
                          onClick: ot
                        }, [
                          v[125] || (v[125] = s("i", { class: "fa-solid fa-plus" }, null, -1)),
                          s("span", null, l(d.value ? "创建工作空间" : "Create Workspace"), 1)
                        ])
                      ]),
                      s("div", s0, [
                        s("div", n0, [
                          (u(!0), c(I, null, U(Ve.value.workspaces || [], (r) => (u(), c("button", {
                            key: `sandbox-${r.id}`,
                            type: "button",
                            class: q(["ox-vite-workspace-card ox-vite-workspace-card--compact ox-vite-workspace-card--selectable", { "is-selected": dt.value && dt.value.id === r.id }]),
                            onClick: (W) => S.handleSandboxSelectWorkspace(r.id)
                          }, [
                            s("div", a0, [
                              s("div", o0, [
                                v[126] || (v[126] = s("div", { class: "ox-vite-workspace-card__icon" }, [
                                  s("i", { class: "fa-solid fa-building" })
                                ], -1)),
                                s("div", i0, [
                                  s("div", r0, l(r.name), 1),
                                  s("div", u0, l(r.type), 1)
                                ])
                              ])
                            ]),
                            s("div", c0, [
                              s("span", d0, l(r.projectCount) + " " + l(d.value ? "个项目" : "projects"), 1),
                              s("span", p0, l(r.roleCount) + " " + l(d.value ? "个角色" : "roles"), 1)
                            ]),
                            s("div", f0, [
                              s("button", {
                                type: "button",
                                class: "ox-vite-ops-primary-btn",
                                onClick: Ot((W) => rs(r.id), ["stop"])
                              }, [
                                v[127] || (v[127] = s("i", { class: "fa-solid fa-cube" }, null, -1)),
                                s("span", null, l(d.value ? "进入" : "Open"), 1)
                              ], 8, v0)
                            ])
                          ], 10, l0))), 128))
                        ]),
                        dt.value ? (u(), c("aside", g0, [
                          s("div", m0, [
                            s("div", null, [
                              s("div", y0, l(d.value ? "工作空间详情" : "Workspace Detail"), 1),
                              s("h2", null, l(dt.value.name), 1)
                            ])
                          ]),
                          s("div", h0, [
                            v[128] || (v[128] = s("div", { class: "ox-vite-workspace-card__icon ox-vite-project-card__icon--large" }, [
                              s("i", { class: "fa-solid fa-building" })
                            ], -1)),
                            s("div", null, [
                              s("div", _0, l(dt.value.type), 1),
                              s("div", b0, l(dt.value.summary || dt.value.path), 1)
                            ])
                          ]),
                          s("div", x0, [
                            s("span", k0, l(dt.value.projectCount) + " " + l(d.value ? "个项目" : "projects"), 1),
                            s("span", S0, l(dt.value.roleCount) + " " + l(d.value ? "个角色" : "roles"), 1),
                            s("span", w0, l(Bl(dt.value.permission)), 1)
                          ]),
                          s("div", C0, [
                            s("button", {
                              type: "button",
                              class: "ox-vite-ops-primary-btn",
                              onClick: v[28] || (v[28] = (r) => rs(dt.value.id))
                            }, [
                              v[129] || (v[129] = s("i", { class: "fa-solid fa-cube" }, null, -1)),
                              s("span", null, l(d.value ? "进入工作空间层" : "Open Workspace Layer"), 1)
                            ]),
                            s("button", {
                              type: "button",
                              class: "ox-vite-ops-secondary-btn",
                              onClick: v[29] || (v[29] = (r) => Ht(dt.value.id))
                            }, [
                              v[130] || (v[130] = s("i", { class: "fa-solid fa-pen" }, null, -1)),
                              s("span", null, l(d.value ? "编辑工作空间" : "Edit Workspace"), 1)
                            ]),
                            s("button", {
                              type: "button",
                              class: "ox-vite-ops-secondary-btn",
                              onClick: v[30] || (v[30] = (r) => ct(dt.value.id))
                            }, [
                              v[131] || (v[131] = s("i", { class: "fa-solid fa-layer-group" }, null, -1)),
                              s("span", null, l(d.value ? "添加项目" : "Add Project"), 1)
                            ])
                          ])
                        ])) : P("", !0)
                      ])
                    ]),
                    s("article", M0, [
                      s("div", R0, [
                        s("div", null, [
                          s("div", T0, l(d.value ? "项目楼层" : "Project Floors"), 1),
                          s("h2", null, l(d.value ? "当前上下文中的项目编组" : "Projects in the Current Context"), 1)
                        ]),
                        s("button", {
                          type: "button",
                          class: "ox-vite-ops-secondary-btn",
                          disabled: !Ve.value.currentWorkspaceId,
                          onClick: v[31] || (v[31] = (r) => ct(Ve.value.currentWorkspaceId))
                        }, [
                          v[132] || (v[132] = s("i", { class: "fa-solid fa-layer-group" }, null, -1)),
                          s("span", null, l(d.value ? "添加项目楼层" : "Add Project Floor"), 1)
                        ], 8, $0)
                      ]),
                      Ve.value.projects?.length ? (u(), c("div", A0, [
                        s("div", I0, [
                          (u(!0), c(I, null, U(Ve.value.projects || [], (r) => (u(), c("button", {
                            key: r.id,
                            type: "button",
                            class: q(["ox-vite-project-card ox-vite-project-card--selectable", { "is-selected": it.value && it.value.id === r.id }]),
                            onClick: (W) => Go(r.id)
                          }, [
                            s("div", P0, [
                              s("div", {
                                class: "ox-vite-project-card__icon",
                                style: pt({ background: r.color })
                              }, [
                                s("i", {
                                  class: q(r.icon)
                                }, null, 2)
                              ], 4),
                              s("div", null, [
                                s("div", D0, l(r.name), 1),
                                s("div", O0, l(r.workspace || (d.value ? "未绑定工作空间" : "No workspace")), 1)
                              ])
                            ]),
                            s("p", null, l(r.description || (d.value ? "当前项目楼层还没有补充描述。" : "No project description yet.")), 1),
                            s("div", V0, [
                              s("span", L0, l(d.value ? `第 ${r.floor} 层` : `Floor ${r.floor}`), 1)
                            ])
                          ], 10, E0))), 128))
                        ]),
                        it.value ? (u(), c("aside", F0, [
                          s("div", N0, [
                            s("div", null, [
                              s("div", j0, l(d.value ? "项目详情" : "Project Detail"), 1),
                              s("h2", null, l(it.value.name), 1)
                            ])
                          ]),
                          s("div", W0, [
                            s("div", {
                              class: "ox-vite-project-card__icon ox-vite-project-card__icon--large",
                              style: pt({ background: it.value.color })
                            }, [
                              s("i", {
                                class: q(it.value.icon)
                              }, null, 2)
                            ], 4),
                            s("div", null, [
                              s("div", B0, l(it.value.workspace || (d.value ? "未绑定工作空间" : "No workspace")), 1),
                              s("div", U0, l(d.value ? `第 ${it.value.floor} 层` : `Floor ${it.value.floor}`), 1)
                            ])
                          ]),
                          s("p", K0, l(it.value.description || (d.value ? "当前项目楼层还没有补充描述。" : "No project description yet.")), 1),
                          s("div", q0, [
                            s("button", {
                              type: "button",
                              class: "ox-vite-ops-primary-btn",
                              onClick: v[32] || (v[32] = (r) => Yo(it.value.id))
                            }, [
                              v[133] || (v[133] = s("i", { class: "fa-solid fa-cube" }, null, -1)),
                              s("span", null, l(d.value ? "进入项目楼层" : "Open Project Floor"), 1)
                            ]),
                            s("button", {
                              type: "button",
                              class: "ox-vite-ops-secondary-btn",
                              onClick: v[33] || (v[33] = (r) => Js(it.value.id, it.value.workspaceId))
                            }, [
                              v[134] || (v[134] = s("i", { class: "fa-solid fa-pen" }, null, -1)),
                              s("span", null, l(d.value ? "编辑项目" : "Edit Project"), 1)
                            ]),
                            s("button", {
                              type: "button",
                              class: "ox-vite-ops-secondary-btn",
                              onClick: v[34] || (v[34] = (r) => Zo())
                            }, [
                              v[135] || (v[135] = s("i", { class: "fa-solid fa-user-plus" }, null, -1)),
                              s("span", null, l(d.value ? "添加员工" : "Add Staff Role"), 1)
                            ]),
                            s("button", {
                              type: "button",
                              class: "ox-vite-ops-secondary-btn",
                              onClick: v[35] || (v[35] = (r) => Zs(it.value.id))
                            }, [
                              v[136] || (v[136] = s("i", { class: "fa-regular fa-trash-can" }, null, -1)),
                              s("span", null, l(d.value ? "删除项目" : "Delete Project"), 1)
                            ])
                          ])
                        ])) : P("", !0)
                      ])) : (u(), c("div", H0, [
                        v[137] || (v[137] = s("i", { class: "fa-solid fa-layer-group" }, null, -1)),
                        s("strong", null, l(d.value ? "当前还没有项目楼层" : "No project floors yet"), 1),
                        s("p", null, l(d.value ? "先进入一个工作空间，再为它添加项目楼层。" : "Enter a workspace first, then add project floors for it."), 1)
                      ]))
                    ])
                  ]),
                  s("section", z0, [
                    s("div", Y0, [
                      s("div", null, [
                        s("div", G0, l(d.value ? "员工编组" : "Sandbox Roster"), 1),
                        s("h2", null, l(d.value ? "当前沙盘中的员工角色" : "Staff Roles Inside the Current Sandbox"), 1)
                      ]),
                      s("button", {
                        type: "button",
                        class: "ox-vite-ops-secondary-btn",
                        onClick: Re
                      }, [
                        v[138] || (v[138] = s("i", { class: "fa-solid fa-user-plus" }, null, -1)),
                        s("span", null, l(d.value ? "添加员工角色" : "Add Staff Role"), 1)
                      ])
                    ]),
                    Ve.value.items?.length ? (u(), c("div", Q0, [
                      s("div", X0, [
                        (u(!0), c(I, null, U(Ve.value.items || [], (r) => (u(), c("button", {
                          key: r.id,
                          type: "button",
                          class: q(["ox-vite-role-library-card ox-vite-role-library-card--selectable", { "is-selected": Ye.value && Ye.value.id === r.id }]),
                          onClick: (W) => Qo(r.id)
                        }, [
                          s("div", Z0, [
                            s("div", eC, [
                              s("i", {
                                class: q(r.icon)
                              }, null, 2)
                            ]),
                            s("div", tC, [
                              s("div", sC, l(r.name), 1),
                              s("div", nC, [
                                s("span", null, l(r.department || r.role), 1),
                                r.workspace ? (u(), c("span", lC, l(r.workspace), 1)) : P("", !0),
                                r.project ? (u(), c("span", aC, l(r.project), 1)) : P("", !0)
                              ])
                            ])
                          ]),
                          s("div", oC, [
                            s("span", iC, l(Ul(r.status)), 1),
                            (u(!0), c(I, null, U(r.skills || [], (W) => (u(), c("span", {
                              key: `${r.id}-${W}`,
                              class: "ox-vite-detail-chip"
                            }, l(W), 1))), 128))
                          ])
                        ], 10, J0))), 128))
                      ]),
                      Ye.value ? (u(), c("aside", rC, [
                        s("div", uC, [
                          s("div", null, [
                            s("div", cC, l(d.value ? "员工详情" : "Staff Detail"), 1),
                            s("h2", null, l(Ye.value.name), 1)
                          ])
                        ]),
                        s("div", dC, [
                          s("div", pC, [
                            s("i", {
                              class: q(Ye.value.icon)
                            }, null, 2)
                          ]),
                          s("div", null, [
                            s("div", fC, l(Ye.value.department || Ye.value.role), 1),
                            s("div", vC, [
                              de(l(Ye.value.workspace || "-") + " ", 1),
                              Ye.value.project ? (u(), c("span", gC, " · " + l(Ye.value.project), 1)) : P("", !0)
                            ])
                          ])
                        ]),
                        s("p", mC, l(Ye.value.summary || (d.value ? "当前员工角色还没有补充摘要，后续可以继续细化职责、边界和提示词。" : "This staff role does not have a summary yet. Responsibilities, boundaries, and prompts can be refined next.")), 1),
                        s("div", yC, [
                          s("span", hC, l(Ul(Ye.value.status)), 1),
                          (u(!0), c(I, null, U(Ye.value.skills || [], (r) => (u(), c("span", {
                            key: `${Ye.value.id}-detail-${r}`,
                            class: "ox-vite-detail-chip"
                          }, l(r), 1))), 128))
                        ]),
                        s("div", _C, [
                          s("button", {
                            type: "button",
                            class: "ox-vite-ops-secondary-btn",
                            onClick: v[36] || (v[36] = (r) => Jo(Ye.value.id))
                          }, [
                            v[139] || (v[139] = s("i", { class: "fa-solid fa-pen" }, null, -1)),
                            s("span", null, l(d.value ? "编辑角色" : "Edit Role"), 1)
                          ]),
                          s("button", {
                            type: "button",
                            class: "ox-vite-ops-primary-btn",
                            onClick: v[37] || (v[37] = (r) => Xo(Ye.value.id))
                          }, [
                            v[140] || (v[140] = s("i", { class: "fa-solid fa-comments" }, null, -1)),
                            s("span", null, l(d.value ? "发起对话" : "Open Chat"), 1)
                          ]),
                          s("button", {
                            type: "button",
                            class: "ox-vite-ops-secondary-btn",
                            onClick: v[38] || (v[38] = (r) => ut(Ye.value.id))
                          }, [
                            v[141] || (v[141] = s("i", { class: "fa-regular fa-trash-can" }, null, -1)),
                            s("span", null, l(d.value ? "删除角色" : "Delete Role"), 1)
                          ])
                        ])
                      ])) : P("", !0)
                    ])) : (u(), c("div", bC, [
                      v[142] || (v[142] = s("i", { class: "fa-solid fa-user-group" }, null, -1)),
                      s("strong", null, l(d.value ? "还没有沙盘智能体" : "No sandbox agents yet"), 1),
                      s("p", null, l(d.value ? "当工作空间和角色绑定后，这里会开始显示沙盘编组。" : "Once workspaces and roles are bound, sandbox rosters will appear here."), 1)
                    ]))
                  ])
                ])) : (u(), c("section", xC, [
                  (u(!0), c(I, null, U(_.value.xnetPanel?.items || [], (r) => (u(), c("article", {
                    key: r.id,
                    class: "ox-vite-media-card"
                  }, [
                    s("strong", null, l(r.title), 1),
                    s("small", null, l(r.status), 1),
                    s("div", kC, [
                      s("span", SC, l(r.autoConnect ? d.value ? "自动连接" : "Auto connect" : d.value ? "手动检查" : "Manual check"), 1)
                    ]),
                    s("small", null, l(r.url || (d.value ? "未配置服务地址" : "No configured URL")), 1),
                    s("small", null, l(r.lastCheck || (d.value ? "尚未检查" : "Not checked yet")), 1)
                  ]))), 128))
                ]))
              ], 64)) : t.surface === "storage" ? (u(), c(I, { key: 6 }, [
                _.value.activeTab !== "memory-v3" ? (u(), c("section", {
                  key: 0,
                  class: "ox-ops-storage-overview",
                  "aria-label": d.value ? "存储概览" : "Storage overview"
                }, [
                  s("div", CC, [
                    (u(!0), c(I, null, U(_.value.stats || [], (r, W) => (u(), c("article", {
                      key: r.label,
                      class: q(["ox-ops-storage-metric", { "is-text-value": !/^[0-9.,]+$/.test(String(r.value)) }])
                    }, [
                      s("span", MC, [
                        s("i", {
                          class: q(["fa-solid fa-database", "fa-solid fa-layer-group", "fa-solid fa-share-nodes", "fa-solid fa-clock-rotate-left"][W % 4])
                        }, null, 2)
                      ]),
                      s("div", null, [
                        s("span", null, l(r.label), 1),
                        s("strong", null, l(r.value), 1),
                        r.meta ? (u(), c("small", RC, l(r.meta), 1)) : P("", !0)
                      ])
                    ], 2))), 128))
                  ]),
                  s("div", TC, [
                    s("span", $C, l(d.value ? "资源库" : "Asset library"), 1),
                    (u(!0), c(I, null, U(_.value.overviewStats || [], (r) => (u(), c("span", {
                      key: r.id,
                      class: "ox-ops-storage-counter"
                    }, [
                      s("i", {
                        class: q(r.icon)
                      }, null, 2),
                      s("span", null, l(r.label), 1),
                      s("strong", null, l(r.value), 1)
                    ]))), 128)),
                    (u(!0), c(I, null, U(_.value.meta?.chips || [], (r) => (u(), c("span", {
                      key: r.icon + r.text,
                      class: "ox-ops-storage-counter"
                    }, [
                      s("i", {
                        class: q(r.icon)
                      }, null, 2),
                      s("span", null, l(r.text), 1)
                    ]))), 128))
                  ])
                ], 8, wC)) : P("", !0),
                je(kt(lg, {
                  ref_key: "memoryWorkspace",
                  ref: a,
                  memory: ai.value,
                  bridge: ys(n),
                  "is-zh": d.value,
                  active: _.value.isActive && _.value.activeTab === "memory-v3",
                  onRefresh: g
                }, null, 8, ["memory", "bridge", "is-zh", "active"]), [
                  [Eo, _.value.activeTab === "memory-v3"]
                ]),
                ["text", "image", "video"].includes(_.value.activeTab) ? (u(), Co(Xd, {
                  key: 1,
                  library: _.value.fileLibrary,
                  bridge: ys(n),
                  "is-zh": d.value,
                  onRefresh: g
                }, null, 8, ["library", "bridge", "is-zh"])) : _.value.activeTab !== "memory-v3" ? (u(), c("section", AC, [
                  s("div", IC, [
                    s("h2", null, l(d.value ? "续接记录" : "Recall history"), 1),
                    s("p", null, l(d.value ? "查看任务上下文，继续未完成的工作。" : "Review task context and continue your work."), 1)
                  ]),
                  s("div", EC, [
                    (u(!0), c(I, null, U(_.value.recallItems || [], (r) => (u(), c("article", {
                      key: r.id,
                      class: "ox-vite-list-row"
                    }, [
                      s("div", null, [
                        s("strong", null, l(r.title), 1),
                        s("p", null, l(r.note), 1)
                      ])
                    ]))), 128))
                  ]),
                  _.value.recallItems?.length ? P("", !0) : (u(), c("div", PC, [
                    v[143] || (v[143] = s("i", {
                      class: "fa-solid fa-clock-rotate-left",
                      "aria-hidden": "true"
                    }, null, -1)),
                    s("strong", null, l(d.value ? "还没有续接记录" : "No recall history yet"), 1),
                    s("p", null, l(d.value ? "任务产生可续接的上下文后，会在这里集中展示。" : "Continuable task context will appear here when available."), 1)
                  ]))
                ])) : P("", !0)
              ], 64)) : t.surface === "kernel" ? (u(), c(I, { key: 7 }, [
                s("div", DC, [
                  (u(!0), c(I, null, U(_.value.tabs || [], (r) => (u(), c("button", {
                    key: r.id,
                    type: "button",
                    class: q(["ox-vite-strip-tab", { active: _.value.activeTab === r.id }]),
                    onClick: (W) => m(r.id)
                  }, [
                    s("i", {
                      class: q(r.icon)
                    }, null, 2),
                    s("span", null, l(r.label), 1)
                  ], 10, OC))), 128))
                ]),
                s("section", VC, [
                  (u(!0), c(I, null, U(_.value.metrics || [], (r) => (u(), c("article", {
                    key: r.id,
                    class: "ox-vite-stat-card"
                  }, [
                    s("span", null, l(r.label), 1),
                    s("strong", null, l(r.value), 1),
                    s("small", null, l(r.note), 1)
                  ]))), 128))
                ]),
                s("section", LC, [
                  s("article", FC, [
                    s("div", NC, [
                      s("h2", null, l(d.value ? "运行画像" : "Runtime Profile"), 1),
                      s("p", null, l(_.value.updatedLabel), 1)
                    ]),
                    s("div", jC, [
                      (u(!0), c(I, null, U(_.value.runtimeRows || [], (r) => (u(), c("article", {
                        key: r.label,
                        class: "ox-vite-list-row"
                      }, [
                        s("div", null, [
                          s("strong", null, l(r.label), 1)
                        ]),
                        s("span", null, l(r.value), 1)
                      ]))), 128))
                    ])
                  ]),
                  s("article", WC, [
                    s("div", BC, [
                      s("h2", null, l(d.value ? "计划与动作" : "Plans & Actions"), 1),
                      s("p", null, l(d.value ? "优先显示近期内核行动与下一步建议。" : "Show recent kernel actions and recommended next steps first."), 1)
                    ]),
                    s("div", UC, [
                      (u(!0), c(I, null, U(_.value.actions || [], (r) => (u(), c("article", {
                        key: r.id,
                        class: "ox-vite-list-row"
                      }, [
                        s("div", null, [
                          s("strong", null, l(r.title), 1),
                          s("p", null, l(r.type), 1)
                        ]),
                        s("span", null, l(r.status) + l(r.next ? ` · ${r.next}` : ""), 1)
                      ]))), 128))
                    ])
                  ])
                ])
              ], 64)) : P("", !0)
            ])
          ], 2)
        ]))
      ], 64))
    ], 10, ag));
  }
};
function fl() {
  document.querySelectorAll("[data-openxnet-ops-surface]").forEach((t) => {
    const n = t?.closest(".page");
    if (!t || t.dataset.viteMounted === "true" || n && window.getComputedStyle(n).display === "none")
      return;
    const a = String(t.dataset.openxnetOpsSurface || "").trim();
    Au(KC, { surface: a }).mount(t), t.dataset.viteMounted = "true";
  });
}
document.readyState === "loading" ? document.addEventListener("DOMContentLoaded", fl, { once: !0 }) : fl();
window.addEventListener("openxnet-vite-ops-remount", fl);
