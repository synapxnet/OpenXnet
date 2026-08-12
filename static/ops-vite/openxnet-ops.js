// @__NO_SIDE_EFFECTS__
function Ln(e) {
  const t = /* @__PURE__ */ Object.create(null);
  for (const n of e.split(",")) t[n] = 1;
  return (n) => n in t;
}
const ve = {}, Qt = [], ft = () => {
}, Ul = () => !1, zs = (e) => e.charCodeAt(0) === 111 && e.charCodeAt(1) === 110 && // uppercase letter
(e.charCodeAt(2) > 122 || e.charCodeAt(2) < 97), Ys = (e) => e.startsWith("onUpdate:"), $e = Object.assign, jn = (e, t) => {
  const n = e.indexOf(t);
  n > -1 && e.splice(n, 1);
}, po = Object.prototype.hasOwnProperty, ue = (e, t) => po.call(e, t), Q = Array.isArray, Xt = (e) => Ss(e) === "[object Map]", Gs = (e) => Ss(e) === "[object Set]", ul = (e) => Ss(e) === "[object Date]", Z = (e) => typeof e == "function", ye = (e) => typeof e == "string", vt = (e) => typeof e == "symbol", pe = (e) => e !== null && typeof e == "object", Kl = (e) => (pe(e) || Z(e)) && Z(e.then) && Z(e.catch), Hl = Object.prototype.toString, Ss = (e) => Hl.call(e), fo = (e) => Ss(e).slice(8, -1), ql = (e) => Ss(e) === "[object Object]", Bn = (e) => ye(e) && e !== "NaN" && e[0] !== "-" && "" + parseInt(e, 10) === e, cs = /* @__PURE__ */ Ln(
  // the leading comma is intentional so empty string "" is also included
  ",key,ref,ref_for,ref_key,onVnodeBeforeMount,onVnodeMounted,onVnodeBeforeUpdate,onVnodeUpdated,onVnodeBeforeUnmount,onVnodeUnmounted"
), Qs = (e) => {
  const t = /* @__PURE__ */ Object.create(null);
  return ((n) => t[n] || (t[n] = e(n)));
}, vo = /-\w/g, st = Qs(
  (e) => e.replace(vo, (t) => t.slice(1).toUpperCase())
), go = /\B([A-Z])/g, zt = Qs(
  (e) => e.replace(go, "-$1").toLowerCase()
), zl = Qs((e) => e.charAt(0).toUpperCase() + e.slice(1)), vn = Qs(
  (e) => e ? `on${zl(e)}` : ""
), pt = (e, t) => !Object.is(e, t), $s = (e, ...t) => {
  for (let n = 0; n < e.length; n++)
    e[n](...t);
}, Yl = (e, t, n, l = !1) => {
  Object.defineProperty(e, t, {
    configurable: !0,
    enumerable: !1,
    writable: l,
    value: n
  });
}, Nn = (e) => {
  const t = parseFloat(e);
  return isNaN(t) ? e : t;
};
let dl;
const Xs = () => dl || (dl = typeof globalThis < "u" ? globalThis : typeof self < "u" ? self : typeof window < "u" ? window : typeof globalThis < "u" ? globalThis : {});
function tt(e) {
  if (Q(e)) {
    const t = {};
    for (let n = 0; n < e.length; n++) {
      const l = e[n], a = ye(l) ? bo(l) : tt(l);
      if (a)
        for (const r in a)
          t[r] = a[r];
    }
    return t;
  } else if (ye(e) || pe(e))
    return e;
}
const _o = /;(?![^(]*\))/g, ho = /:([^]+)/, mo = /\/\*[^]*?\*\//g;
function bo(e) {
  const t = {};
  return e.replace(mo, "").split(_o).forEach((n) => {
    if (n) {
      const l = n.split(ho);
      l.length > 1 && (t[l[0].trim()] = l[1].trim());
    }
  }), t;
}
function j(e) {
  let t = "";
  if (ye(e))
    t = e;
  else if (Q(e))
    for (let n = 0; n < e.length; n++) {
      const l = j(e[n]);
      l && (t += l + " ");
    }
  else if (pe(e))
    for (const n in e)
      e[n] && (t += n + " ");
  return t.trim();
}
const yo = "itemscope,allowfullscreen,formnovalidate,ismap,nomodule,novalidate,readonly", xo = /* @__PURE__ */ Ln(yo);
function Gl(e) {
  return !!e || e === "";
}
function ko(e, t) {
  if (e.length !== t.length) return !1;
  let n = !0;
  for (let l = 0; n && l < e.length; l++)
    n = ws(e[l], t[l]);
  return n;
}
function ws(e, t) {
  if (e === t) return !0;
  let n = ul(e), l = ul(t);
  if (n || l)
    return n && l ? e.getTime() === t.getTime() : !1;
  if (n = vt(e), l = vt(t), n || l)
    return e === t;
  if (n = Q(e), l = Q(t), n || l)
    return n && l ? ko(e, t) : !1;
  if (n = pe(e), l = pe(t), n || l) {
    if (!n || !l)
      return !1;
    const a = Object.keys(e).length, r = Object.keys(t).length;
    if (a !== r)
      return !1;
    for (const d in e) {
      const p = e.hasOwnProperty(d), g = t.hasOwnProperty(d);
      if (p && !g || !p && g || !ws(e[d], t[d]))
        return !1;
    }
  }
  return String(e) === String(t);
}
function Ql(e, t) {
  return e.findIndex((n) => ws(n, t));
}
const Xl = (e) => !!(e && e.__v_isRef === !0), i = (e) => ye(e) ? e : e == null ? "" : Q(e) || pe(e) && (e.toString === Hl || !Z(e.toString)) ? Xl(e) ? i(e.value) : JSON.stringify(e, Jl, 2) : String(e), Jl = (e, t) => Xl(t) ? Jl(e, t.value) : Xt(t) ? {
  [`Map(${t.size})`]: [...t.entries()].reduce(
    (n, [l, a], r) => (n[gn(l, r) + " =>"] = a, n),
    {}
  )
} : Gs(t) ? {
  [`Set(${t.size})`]: [...t.values()].map((n) => gn(n))
} : vt(t) ? gn(t) : pe(t) && !Q(t) && !ql(t) ? String(t) : t, gn = (e, t = "") => {
  var n;
  return (
    // Symbol.description in es2019+ so we need to cast here to pass
    // the lib: es2016 check
    vt(e) ? `Symbol(${(n = e.description) != null ? n : t})` : e
  );
};
let Ee;
class So {
  // TODO isolatedDeclarations "__v_skip"
  constructor(t = !1) {
    this.detached = t, this._active = !0, this._on = 0, this.effects = [], this.cleanups = [], this._isPaused = !1, this._warnOnRun = !0, this.__v_skip = !0, !t && Ee && (Ee.active ? (this.parent = Ee, this.index = (Ee.scopes || (Ee.scopes = [])).push(
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
      const n = Ee;
      try {
        return Ee = this, t();
      } finally {
        Ee = n;
      }
    }
  }
  /**
   * This should only be called on non-detached scopes
   * @internal
   */
  on() {
    ++this._on === 1 && (this.prevScope = Ee, Ee = this);
  }
  /**
   * This should only be called on non-detached scopes
   * @internal
   */
  off() {
    if (this._on > 0 && --this._on === 0) {
      if (Ee === this)
        Ee = this.prevScope;
      else {
        let t = Ee;
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
      let n, l;
      for (n = 0, l = this.effects.length; n < l; n++)
        this.effects[n].stop();
      for (this.effects.length = 0, n = 0, l = this.cleanups.length; n < l; n++)
        this.cleanups[n]();
      if (this.cleanups.length = 0, this.scopes) {
        for (n = 0, l = this.scopes.length; n < l; n++)
          this.scopes[n].stop(!0);
        this.scopes.length = 0;
      }
      if (!this.detached && this.parent && !t) {
        const a = this.parent.scopes.pop();
        a && a !== this && (this.parent.scopes[this.index] = a, a.index = this.index);
      }
      this.parent = void 0;
    }
  }
}
function wo() {
  return Ee;
}
let _e;
const _n = /* @__PURE__ */ new WeakSet();
class Zl {
  constructor(t) {
    this.fn = t, this.deps = void 0, this.depsTail = void 0, this.flags = 5, this.next = void 0, this.cleanup = void 0, this.scheduler = void 0, Ee && (Ee.active ? Ee.effects.push(this) : this.flags &= -2);
  }
  pause() {
    this.flags |= 64;
  }
  resume() {
    this.flags & 64 && (this.flags &= -65, _n.has(this) && (_n.delete(this), this.trigger()));
  }
  /**
   * @internal
   */
  notify() {
    this.flags & 2 && !(this.flags & 32) || this.flags & 8 || ti(this);
  }
  run() {
    if (!(this.flags & 1))
      return this.fn();
    this.flags |= 2, pl(this), si(this);
    const t = _e, n = nt;
    _e = this, nt = !0;
    try {
      return this.fn();
    } finally {
      ni(this), _e = t, nt = n, this.flags &= -3;
    }
  }
  stop() {
    if (this.flags & 1) {
      for (let t = this.deps; t; t = t.nextDep)
        Kn(t);
      this.deps = this.depsTail = void 0, pl(this), this.onStop && this.onStop(), this.flags &= -2;
    }
  }
  trigger() {
    this.flags & 64 ? _n.add(this) : this.scheduler ? this.scheduler() : this.runIfDirty();
  }
  /**
   * @internal
   */
  runIfDirty() {
    Cn(this) && this.run();
  }
  get dirty() {
    return Cn(this);
  }
}
let ei = 0, us, ds;
function ti(e, t = !1) {
  if (e.flags |= 8, t) {
    e.next = ds, ds = e;
    return;
  }
  e.next = us, us = e;
}
function Wn() {
  ei++;
}
function Un() {
  if (--ei > 0)
    return;
  if (ds) {
    let t = ds;
    for (ds = void 0; t; ) {
      const n = t.next;
      t.next = void 0, t.flags &= -9, t = n;
    }
  }
  let e;
  for (; us; ) {
    let t = us;
    for (us = void 0; t; ) {
      const n = t.next;
      if (t.next = void 0, t.flags &= -9, t.flags & 1)
        try {
          t.trigger();
        } catch (l) {
          e || (e = l);
        }
      t = n;
    }
  }
  if (e) throw e;
}
function si(e) {
  for (let t = e.deps; t; t = t.nextDep)
    t.version = -1, t.prevActiveLink = t.dep.activeLink, t.dep.activeLink = t;
}
function ni(e) {
  let t, n = e.depsTail, l = n;
  for (; l; ) {
    const a = l.prevDep;
    l.version === -1 ? (l === n && (n = a), Kn(l), Co(l)) : t = l, l.dep.activeLink = l.prevActiveLink, l.prevActiveLink = void 0, l = a;
  }
  e.deps = t, e.depsTail = n;
}
function Cn(e) {
  for (let t = e.deps; t; t = t.nextDep)
    if (t.dep.version !== t.version || t.dep.computed && (li(t.dep.computed) || t.dep.version !== t.version))
      return !0;
  return !!e._dirty;
}
function li(e) {
  if (e.flags & 4 && !(e.flags & 16) || (e.flags &= -17, e.globalVersion === ms) || (e.globalVersion = ms, !e.isSSR && e.flags & 128 && (!e.deps && !e._dirty || !Cn(e))))
    return;
  e.flags |= 2;
  const t = e.dep, n = _e, l = nt;
  _e = e, nt = !0;
  try {
    si(e);
    const a = e.fn(e._value);
    (t.version === 0 || pt(a, e._value)) && (e.flags |= 128, e._value = a, t.version++);
  } catch (a) {
    throw t.version++, a;
  } finally {
    _e = n, nt = l, ni(e), e.flags &= -3;
  }
}
function Kn(e, t = !1) {
  const { dep: n, prevSub: l, nextSub: a } = e;
  if (l && (l.nextSub = a, e.prevSub = void 0), a && (a.prevSub = l, e.nextSub = void 0), n.subs === e && (n.subs = l, !l && n.computed)) {
    n.computed.flags &= -5;
    for (let r = n.computed.deps; r; r = r.nextDep)
      Kn(r, !0);
  }
  !t && !--n.sc && n.map && n.map.delete(n.key);
}
function Co(e) {
  const { prevDep: t, nextDep: n } = e;
  t && (t.nextDep = n, e.prevDep = void 0), n && (n.prevDep = t, e.nextDep = void 0);
}
let nt = !0;
const ii = [];
function wt() {
  ii.push(nt), nt = !1;
}
function Ct() {
  const e = ii.pop();
  nt = e === void 0 ? !0 : e;
}
function pl(e) {
  const { cleanup: t } = e;
  if (e.cleanup = void 0, t) {
    const n = _e;
    _e = void 0;
    try {
      t();
    } finally {
      _e = n;
    }
  }
}
let ms = 0;
class Mo {
  constructor(t, n) {
    this.sub = t, this.dep = n, this.version = n.version, this.nextDep = this.prevDep = this.nextSub = this.prevSub = this.prevActiveLink = void 0;
  }
}
class Hn {
  // TODO isolatedDeclarations "__v_skip"
  constructor(t) {
    this.computed = t, this.version = 0, this.activeLink = void 0, this.subs = void 0, this.map = void 0, this.key = void 0, this.sc = 0, this.__v_skip = !0;
  }
  track(t) {
    if (!_e || !nt || _e === this.computed)
      return;
    let n = this.activeLink;
    if (n === void 0 || n.sub !== _e)
      n = this.activeLink = new Mo(_e, this), _e.deps ? (n.prevDep = _e.depsTail, _e.depsTail.nextDep = n, _e.depsTail = n) : _e.deps = _e.depsTail = n, oi(n);
    else if (n.version === -1 && (n.version = this.version, n.nextDep)) {
      const l = n.nextDep;
      l.prevDep = n.prevDep, n.prevDep && (n.prevDep.nextDep = l), n.prevDep = _e.depsTail, n.nextDep = void 0, _e.depsTail.nextDep = n, _e.depsTail = n, _e.deps === n && (_e.deps = l);
    }
    return n;
  }
  trigger(t) {
    this.version++, ms++, this.notify(t);
  }
  notify(t) {
    Wn();
    try {
      for (let n = this.subs; n; n = n.prevSub)
        n.sub.notify() && n.sub.dep.notify();
    } finally {
      Un();
    }
  }
}
function oi(e) {
  if (e.dep.sc++, e.sub.flags & 4) {
    const t = e.dep.computed;
    if (t && !e.dep.subs) {
      t.flags |= 20;
      for (let l = t.deps; l; l = l.nextDep)
        oi(l);
    }
    const n = e.dep.subs;
    n !== e && (e.prevSub = n, n && (n.nextSub = e)), e.dep.subs = e;
  }
}
const Mn = /* @__PURE__ */ new WeakMap(), Ht = /* @__PURE__ */ Symbol(
  ""
), Pn = /* @__PURE__ */ Symbol(
  ""
), bs = /* @__PURE__ */ Symbol(
  ""
);
function Oe(e, t, n) {
  if (nt && _e) {
    let l = Mn.get(e);
    l || Mn.set(e, l = /* @__PURE__ */ new Map());
    let a = l.get(n);
    a || (l.set(n, a = new Hn()), a.map = l, a.key = n), a.track();
  }
}
function xt(e, t, n, l, a, r) {
  const d = Mn.get(e);
  if (!d) {
    ms++;
    return;
  }
  const p = (g) => {
    g && g.trigger();
  };
  if (Wn(), t === "clear")
    d.forEach(p);
  else {
    const g = Q(e), k = g && Bn(n);
    if (g && n === "length") {
      const b = Number(l);
      d.forEach((S, O) => {
        (O === "length" || O === bs || !vt(O) && O >= b) && p(S);
      });
    } else
      switch ((n !== void 0 || d.has(void 0)) && p(d.get(n)), k && p(d.get(bs)), t) {
        case "add":
          g ? k && p(d.get("length")) : (p(d.get(Ht)), Xt(e) && p(d.get(Pn)));
          break;
        case "delete":
          g || (p(d.get(Ht)), Xt(e) && p(d.get(Pn)));
          break;
        case "set":
          Xt(e) && p(d.get(Ht));
          break;
      }
  }
  Un();
}
function Yt(e) {
  const t = /* @__PURE__ */ ce(e);
  return t === e ? t : (Oe(t, "iterate", bs), /* @__PURE__ */ Xe(e) ? t : t.map(lt));
}
function Js(e) {
  return Oe(e = /* @__PURE__ */ ce(e), "iterate", bs), e;
}
function ut(e, t) {
  return /* @__PURE__ */ Mt(e) ? ts(/* @__PURE__ */ qt(e) ? lt(t) : t) : lt(t);
}
const Po = {
  __proto__: null,
  [Symbol.iterator]() {
    return hn(this, Symbol.iterator, (e) => ut(this, e));
  },
  concat(...e) {
    return Yt(this).concat(
      ...e.map((t) => Q(t) ? Yt(t) : t)
    );
  },
  entries() {
    return hn(this, "entries", (e) => (e[1] = ut(this, e[1]), e));
  },
  every(e, t) {
    return _t(this, "every", e, t, void 0, arguments);
  },
  filter(e, t) {
    return _t(
      this,
      "filter",
      e,
      t,
      (n) => n.map((l) => ut(this, l)),
      arguments
    );
  },
  find(e, t) {
    return _t(
      this,
      "find",
      e,
      t,
      (n) => ut(this, n),
      arguments
    );
  },
  findIndex(e, t) {
    return _t(this, "findIndex", e, t, void 0, arguments);
  },
  findLast(e, t) {
    return _t(
      this,
      "findLast",
      e,
      t,
      (n) => ut(this, n),
      arguments
    );
  },
  findLastIndex(e, t) {
    return _t(this, "findLastIndex", e, t, void 0, arguments);
  },
  // flat, flatMap could benefit from ARRAY_ITERATE but are not straight-forward to implement
  forEach(e, t) {
    return _t(this, "forEach", e, t, void 0, arguments);
  },
  includes(...e) {
    return mn(this, "includes", e);
  },
  indexOf(...e) {
    return mn(this, "indexOf", e);
  },
  join(e) {
    return Yt(this).join(e);
  },
  // keys() iterator only reads `length`, no optimization required
  lastIndexOf(...e) {
    return mn(this, "lastIndexOf", e);
  },
  map(e, t) {
    return _t(this, "map", e, t, void 0, arguments);
  },
  pop() {
    return is(this, "pop");
  },
  push(...e) {
    return is(this, "push", e);
  },
  reduce(e, ...t) {
    return fl(this, "reduce", e, t);
  },
  reduceRight(e, ...t) {
    return fl(this, "reduceRight", e, t);
  },
  shift() {
    return is(this, "shift");
  },
  // slice could use ARRAY_ITERATE but also seems to beg for range tracking
  some(e, t) {
    return _t(this, "some", e, t, void 0, arguments);
  },
  splice(...e) {
    return is(this, "splice", e);
  },
  toReversed() {
    return Yt(this).toReversed();
  },
  toSorted(e) {
    return Yt(this).toSorted(e);
  },
  toSpliced(...e) {
    return Yt(this).toSpliced(...e);
  },
  unshift(...e) {
    return is(this, "unshift", e);
  },
  values() {
    return hn(this, "values", (e) => ut(this, e));
  }
};
function hn(e, t, n) {
  const l = Js(e), a = l[t]();
  return l !== e && !/* @__PURE__ */ Xe(e) && (a._next = a.next, a.next = () => {
    const r = a._next();
    return r.done || (r.value = n(r.value)), r;
  }), a;
}
const Ro = Array.prototype;
function _t(e, t, n, l, a, r) {
  const d = Js(e), p = d !== e && !/* @__PURE__ */ Xe(e), g = d[t];
  if (g !== Ro[t]) {
    const S = g.apply(e, r);
    return p ? lt(S) : S;
  }
  let k = n;
  d !== e && (p ? k = function(S, O) {
    return n.call(this, ut(e, S), O, e);
  } : n.length > 2 && (k = function(S, O) {
    return n.call(this, S, O, e);
  }));
  const b = g.call(d, k, l);
  return p && a ? a(b) : b;
}
function fl(e, t, n, l) {
  const a = Js(e), r = a !== e && !/* @__PURE__ */ Xe(e);
  let d = n, p = !1;
  a !== e && (r ? (p = l.length === 0, d = function(k, b, S) {
    return p && (p = !1, k = ut(e, k)), n.call(this, k, ut(e, b), S, e);
  }) : n.length > 3 && (d = function(k, b, S) {
    return n.call(this, k, b, S, e);
  }));
  const g = a[t](d, ...l);
  return p ? ut(e, g) : g;
}
function mn(e, t, n) {
  const l = /* @__PURE__ */ ce(e);
  Oe(l, "iterate", bs);
  const a = l[t](...n);
  return (a === -1 || a === !1) && /* @__PURE__ */ Gn(n[0]) ? (n[0] = /* @__PURE__ */ ce(n[0]), l[t](...n)) : a;
}
function is(e, t, n = []) {
  wt(), Wn();
  const l = (/* @__PURE__ */ ce(e))[t].apply(e, n);
  return Un(), Ct(), l;
}
const To = /* @__PURE__ */ Ln("__proto__,__v_isRef,__isVue"), ai = new Set(
  /* @__PURE__ */ Object.getOwnPropertyNames(Symbol).filter((e) => e !== "arguments" && e !== "caller").map((e) => Symbol[e]).filter(vt)
);
function Eo(e) {
  vt(e) || (e = String(e));
  const t = /* @__PURE__ */ ce(this);
  return Oe(t, "has", e), t.hasOwnProperty(e);
}
class ri {
  constructor(t = !1, n = !1) {
    this._isReadonly = t, this._isShallow = n;
  }
  get(t, n, l) {
    if (n === "__v_skip") return t.__v_skip;
    const a = this._isReadonly, r = this._isShallow;
    if (n === "__v_isReactive")
      return !a;
    if (n === "__v_isReadonly")
      return a;
    if (n === "__v_isShallow")
      return r;
    if (n === "__v_raw")
      return l === (a ? r ? Bo : pi : r ? di : ui).get(t) || // receiver is not the reactive proxy, but has the same prototype
      // this means the receiver is a user proxy of the reactive proxy
      Object.getPrototypeOf(t) === Object.getPrototypeOf(l) ? t : void 0;
    const d = Q(t);
    if (!a) {
      let g;
      if (d && (g = Po[n]))
        return g;
      if (n === "hasOwnProperty")
        return Eo;
    }
    const p = Reflect.get(
      t,
      n,
      // if this is a proxy wrapping a ref, return methods using the raw ref
      // as receiver so that we don't have to call `toRaw` on the ref in all
      // its class methods
      /* @__PURE__ */ Ve(t) ? t : l
    );
    if ((vt(n) ? ai.has(n) : To(n)) || (a || Oe(t, "get", n), r))
      return p;
    if (/* @__PURE__ */ Ve(p)) {
      const g = d && Bn(n) ? p : p.value;
      return a && pe(g) ? /* @__PURE__ */ Tn(g) : g;
    }
    return pe(p) ? a ? /* @__PURE__ */ Tn(p) : /* @__PURE__ */ zn(p) : p;
  }
}
class ci extends ri {
  constructor(t = !1) {
    super(!1, t);
  }
  set(t, n, l, a) {
    let r = t[n];
    const d = Q(t) && Bn(n);
    if (!this._isShallow) {
      const k = /* @__PURE__ */ Mt(r);
      if (!/* @__PURE__ */ Xe(l) && !/* @__PURE__ */ Mt(l) && (r = /* @__PURE__ */ ce(r), l = /* @__PURE__ */ ce(l)), !d && /* @__PURE__ */ Ve(r) && !/* @__PURE__ */ Ve(l))
        return k || (r.value = l), !0;
    }
    const p = d ? Number(n) < t.length : ue(t, n), g = Reflect.set(
      t,
      n,
      l,
      /* @__PURE__ */ Ve(t) ? t : a
    );
    return t === /* @__PURE__ */ ce(a) && (p ? pt(l, r) && xt(t, "set", n, l) : xt(t, "add", n, l)), g;
  }
  deleteProperty(t, n) {
    const l = ue(t, n);
    t[n];
    const a = Reflect.deleteProperty(t, n);
    return a && l && xt(t, "delete", n, void 0), a;
  }
  has(t, n) {
    const l = Reflect.has(t, n);
    return (!vt(n) || !ai.has(n)) && Oe(t, "has", n), l;
  }
  ownKeys(t) {
    return Oe(
      t,
      "iterate",
      Q(t) ? "length" : Ht
    ), Reflect.ownKeys(t);
  }
}
class Ao extends ri {
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
const Do = /* @__PURE__ */ new ci(), Oo = /* @__PURE__ */ new Ao(), Vo = /* @__PURE__ */ new ci(!0);
const Rn = (e) => e, Ds = (e) => Reflect.getPrototypeOf(e);
function $o(e, t, n) {
  return function(...l) {
    const a = this.__v_raw, r = /* @__PURE__ */ ce(a), d = Xt(r), p = e === "entries" || e === Symbol.iterator && d, g = e === "keys" && d, k = a[e](...l), b = n ? Rn : t ? ts : lt;
    return !t && Oe(
      r,
      "iterate",
      g ? Pn : Ht
    ), $e(
      // inheriting all iterator properties
      Object.create(k),
      {
        // iterator protocol
        next() {
          const { value: S, done: O } = k.next();
          return O ? { value: S, done: O } : {
            value: p ? [b(S[0]), b(S[1])] : b(S),
            done: O
          };
        }
      }
    );
  };
}
function Os(e) {
  return function(...t) {
    return e === "delete" ? !1 : e === "clear" ? void 0 : this;
  };
}
function Fo(e, t) {
  const n = {
    get(a) {
      const r = this.__v_raw, d = /* @__PURE__ */ ce(r), p = /* @__PURE__ */ ce(a);
      e || (pt(a, p) && Oe(d, "get", a), Oe(d, "get", p));
      const { has: g } = Ds(d), k = t ? Rn : e ? ts : lt;
      if (g.call(d, a))
        return k(r.get(a));
      if (g.call(d, p))
        return k(r.get(p));
      r !== d && r.get(a);
    },
    get size() {
      const a = this.__v_raw;
      return !e && Oe(/* @__PURE__ */ ce(a), "iterate", Ht), a.size;
    },
    has(a) {
      const r = this.__v_raw, d = /* @__PURE__ */ ce(r), p = /* @__PURE__ */ ce(a);
      return e || (pt(a, p) && Oe(d, "has", a), Oe(d, "has", p)), a === p ? r.has(a) : r.has(a) || r.has(p);
    },
    forEach(a, r) {
      const d = this, p = d.__v_raw, g = /* @__PURE__ */ ce(p), k = t ? Rn : e ? ts : lt;
      return !e && Oe(g, "iterate", Ht), p.forEach((b, S) => a.call(r, k(b), k(S), d));
    }
  };
  return $e(
    n,
    e ? {
      add: Os("add"),
      set: Os("set"),
      delete: Os("delete"),
      clear: Os("clear")
    } : {
      add(a) {
        const r = /* @__PURE__ */ ce(this), d = Ds(r), p = /* @__PURE__ */ ce(a), g = !t && !/* @__PURE__ */ Xe(a) && !/* @__PURE__ */ Mt(a) ? p : a;
        return d.has.call(r, g) || pt(a, g) && d.has.call(r, a) || pt(p, g) && d.has.call(r, p) || (r.add(g), xt(r, "add", g, g)), this;
      },
      set(a, r) {
        !t && !/* @__PURE__ */ Xe(r) && !/* @__PURE__ */ Mt(r) && (r = /* @__PURE__ */ ce(r));
        const d = /* @__PURE__ */ ce(this), { has: p, get: g } = Ds(d);
        let k = p.call(d, a);
        k || (a = /* @__PURE__ */ ce(a), k = p.call(d, a));
        const b = g.call(d, a);
        return d.set(a, r), k ? pt(r, b) && xt(d, "set", a, r) : xt(d, "add", a, r), this;
      },
      delete(a) {
        const r = /* @__PURE__ */ ce(this), { has: d, get: p } = Ds(r);
        let g = d.call(r, a);
        g || (a = /* @__PURE__ */ ce(a), g = d.call(r, a)), p && p.call(r, a);
        const k = r.delete(a);
        return g && xt(r, "delete", a, void 0), k;
      },
      clear() {
        const a = /* @__PURE__ */ ce(this), r = a.size !== 0, d = a.clear();
        return r && xt(
          a,
          "clear",
          void 0,
          void 0
        ), d;
      }
    }
  ), [
    "keys",
    "values",
    "entries",
    Symbol.iterator
  ].forEach((a) => {
    n[a] = $o(a, e, t);
  }), n;
}
function qn(e, t) {
  const n = Fo(e, t);
  return (l, a, r) => a === "__v_isReactive" ? !e : a === "__v_isReadonly" ? e : a === "__v_raw" ? l : Reflect.get(
    ue(n, a) && a in l ? n : l,
    a,
    r
  );
}
const Io = {
  get: /* @__PURE__ */ qn(!1, !1)
}, Lo = {
  get: /* @__PURE__ */ qn(!1, !0)
}, jo = {
  get: /* @__PURE__ */ qn(!0, !1)
};
const ui = /* @__PURE__ */ new WeakMap(), di = /* @__PURE__ */ new WeakMap(), pi = /* @__PURE__ */ new WeakMap(), Bo = /* @__PURE__ */ new WeakMap();
function No(e) {
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
function Wo(e) {
  return e.__v_skip || !Object.isExtensible(e) ? 0 : No(fo(e));
}
// @__NO_SIDE_EFFECTS__
function zn(e) {
  return /* @__PURE__ */ Mt(e) ? e : Yn(
    e,
    !1,
    Do,
    Io,
    ui
  );
}
// @__NO_SIDE_EFFECTS__
function Uo(e) {
  return Yn(
    e,
    !1,
    Vo,
    Lo,
    di
  );
}
// @__NO_SIDE_EFFECTS__
function Tn(e) {
  return Yn(
    e,
    !0,
    Oo,
    jo,
    pi
  );
}
function Yn(e, t, n, l, a) {
  if (!pe(e) || e.__v_raw && !(t && e.__v_isReactive))
    return e;
  const r = Wo(e);
  if (r === 0)
    return e;
  const d = a.get(e);
  if (d)
    return d;
  const p = new Proxy(
    e,
    r === 2 ? l : n
  );
  return a.set(e, p), p;
}
// @__NO_SIDE_EFFECTS__
function qt(e) {
  return /* @__PURE__ */ Mt(e) ? /* @__PURE__ */ qt(e.__v_raw) : !!(e && e.__v_isReactive);
}
// @__NO_SIDE_EFFECTS__
function Mt(e) {
  return !!(e && e.__v_isReadonly);
}
// @__NO_SIDE_EFFECTS__
function Xe(e) {
  return !!(e && e.__v_isShallow);
}
// @__NO_SIDE_EFFECTS__
function Gn(e) {
  return e ? !!e.__v_raw : !1;
}
// @__NO_SIDE_EFFECTS__
function ce(e) {
  const t = e && e.__v_raw;
  return t ? /* @__PURE__ */ ce(t) : e;
}
function Ko(e) {
  return !ue(e, "__v_skip") && Object.isExtensible(e) && Yl(e, "__v_skip", !0), e;
}
const lt = (e) => pe(e) ? /* @__PURE__ */ zn(e) : e, ts = (e) => pe(e) ? /* @__PURE__ */ Tn(e) : e;
// @__NO_SIDE_EFFECTS__
function Ve(e) {
  return e ? e.__v_isRef === !0 : !1;
}
// @__NO_SIDE_EFFECTS__
function Se(e) {
  return Ho(e, !1);
}
function Ho(e, t) {
  return /* @__PURE__ */ Ve(e) ? e : new qo(e, t);
}
class qo {
  constructor(t, n) {
    this.dep = new Hn(), this.__v_isRef = !0, this.__v_isShallow = !1, this._rawValue = n ? t : /* @__PURE__ */ ce(t), this._value = n ? t : lt(t), this.__v_isShallow = n;
  }
  get value() {
    return this.dep.track(), this._value;
  }
  set value(t) {
    const n = this._rawValue, l = this.__v_isShallow || /* @__PURE__ */ Xe(t) || /* @__PURE__ */ Mt(t);
    t = l ? t : /* @__PURE__ */ ce(t), pt(t, n) && (this._rawValue = t, this._value = l ? t : lt(t), this.dep.trigger());
  }
}
function zo(e) {
  return /* @__PURE__ */ Ve(e) ? e.value : e;
}
const Yo = {
  get: (e, t, n) => t === "__v_raw" ? e : zo(Reflect.get(e, t, n)),
  set: (e, t, n, l) => {
    const a = e[t];
    return /* @__PURE__ */ Ve(a) && !/* @__PURE__ */ Ve(n) ? (a.value = n, !0) : Reflect.set(e, t, n, l);
  }
};
function fi(e) {
  return /* @__PURE__ */ qt(e) ? e : new Proxy(e, Yo);
}
class Go {
  constructor(t, n, l) {
    this.fn = t, this.setter = n, this._value = void 0, this.dep = new Hn(this), this.__v_isRef = !0, this.deps = void 0, this.depsTail = void 0, this.flags = 16, this.globalVersion = ms - 1, this.next = void 0, this.effect = this, this.__v_isReadonly = !n, this.isSSR = l;
  }
  /**
   * @internal
   */
  notify() {
    if (this.flags |= 16, !(this.flags & 8) && // avoid infinite self recursion
    _e !== this)
      return ti(this, !0), !0;
  }
  get value() {
    const t = this.dep.track();
    return li(this), t && (t.version = this.dep.version), this._value;
  }
  set value(t) {
    this.setter && this.setter(t);
  }
}
// @__NO_SIDE_EFFECTS__
function Qo(e, t, n = !1) {
  let l, a;
  return Z(e) ? l = e : (l = e.get, a = e.set), new Go(l, a, n);
}
const Vs = {}, Bs = /* @__PURE__ */ new WeakMap();
let Ut;
function Xo(e, t = !1, n = Ut) {
  if (n) {
    let l = Bs.get(n);
    l || Bs.set(n, l = []), l.push(e);
  }
}
function Jo(e, t, n = ve) {
  const { immediate: l, deep: a, once: r, scheduler: d, augmentJob: p, call: g } = n, k = (K) => a ? K : /* @__PURE__ */ Xe(K) || a === !1 || a === 0 ? kt(K, 1) : kt(K);
  let b, S, O, L, J = !1, U = !1;
  if (/* @__PURE__ */ Ve(e) ? (S = () => e.value, J = /* @__PURE__ */ Xe(e)) : /* @__PURE__ */ qt(e) ? (S = () => k(e), J = !0) : Q(e) ? (U = !0, J = e.some((K) => /* @__PURE__ */ qt(K) || /* @__PURE__ */ Xe(K)), S = () => e.map((K) => {
    if (/* @__PURE__ */ Ve(K))
      return K.value;
    if (/* @__PURE__ */ qt(K))
      return k(K);
    if (Z(K))
      return g ? g(K, 2) : K();
  })) : Z(e) ? t ? S = g ? () => g(e, 2) : e : S = () => {
    if (O) {
      wt();
      try {
        O();
      } finally {
        Ct();
      }
    }
    const K = Ut;
    Ut = b;
    try {
      return g ? g(e, 3, [L]) : e(L);
    } finally {
      Ut = K;
    }
  } : S = ft, t && a) {
    const K = S, ne = a === !0 ? 1 / 0 : a;
    S = () => kt(K(), ne);
  }
  const ie = wo(), F = () => {
    b.stop(), ie && ie.active && jn(ie.effects, b);
  };
  if (r && t) {
    const K = t;
    t = (...ne) => {
      K(...ne), F();
    };
  }
  let G = U ? new Array(e.length).fill(Vs) : Vs;
  const te = (K) => {
    if (!(!(b.flags & 1) || !b.dirty && !K))
      if (t) {
        const ne = b.run();
        if (a || J || (U ? ne.some((Me, Pe) => pt(Me, G[Pe])) : pt(ne, G))) {
          O && O();
          const Me = Ut;
          Ut = b;
          try {
            const Pe = [
              ne,
              // pass undefined as the old value when it's changed for the first time
              G === Vs ? void 0 : U && G[0] === Vs ? [] : G,
              L
            ];
            G = ne, g ? g(t, 3, Pe) : (
              // @ts-expect-error
              t(...Pe)
            );
          } finally {
            Ut = Me;
          }
        }
      } else
        b.run();
  };
  return p && p(te), b = new Zl(S), b.scheduler = d ? () => d(te, !1) : te, L = (K) => Xo(K, !1, b), O = b.onStop = () => {
    const K = Bs.get(b);
    if (K) {
      if (g)
        g(K, 4);
      else
        for (const ne of K) ne();
      Bs.delete(b);
    }
  }, t ? l ? te(!0) : G = b.run() : d ? d(te.bind(null, !0), !0) : b.run(), F.pause = b.pause.bind(b), F.resume = b.resume.bind(b), F.stop = F, F;
}
function kt(e, t = 1 / 0, n) {
  if (t <= 0 || !pe(e) || e.__v_skip || (n = n || /* @__PURE__ */ new Map(), (n.get(e) || 0) >= t))
    return e;
  if (n.set(e, t), t--, /* @__PURE__ */ Ve(e))
    kt(e.value, t, n);
  else if (Q(e))
    for (let l = 0; l < e.length; l++)
      kt(e[l], t, n);
  else if (Gs(e) || Xt(e))
    e.forEach((l) => {
      kt(l, t, n);
    });
  else if (ql(e)) {
    for (const l in e)
      kt(e[l], t, n);
    for (const l of Object.getOwnPropertySymbols(e))
      Object.prototype.propertyIsEnumerable.call(e, l) && kt(e[l], t, n);
  }
  return e;
}
function Cs(e, t, n, l) {
  try {
    return l ? e(...l) : e();
  } catch (a) {
    Zs(a, t, n);
  }
}
function gt(e, t, n, l) {
  if (Z(e)) {
    const a = Cs(e, t, n, l);
    return a && Kl(a) && a.catch((r) => {
      Zs(r, t, n);
    }), a;
  }
  if (Q(e)) {
    const a = [];
    for (let r = 0; r < e.length; r++)
      a.push(gt(e[r], t, n, l));
    return a;
  }
}
function Zs(e, t, n, l = !0) {
  const a = t ? t.vnode : null, { errorHandler: r, throwUnhandledErrorInProduction: d } = t && t.appContext.config || ve;
  if (t) {
    let p = t.parent;
    const g = t.proxy, k = `https://vuejs.org/error-reference/#runtime-${n}`;
    for (; p; ) {
      const b = p.ec;
      if (b) {
        for (let S = 0; S < b.length; S++)
          if (b[S](e, g, k) === !1)
            return;
      }
      p = p.parent;
    }
    if (r) {
      wt(), Cs(r, null, 10, [
        e,
        g,
        k
      ]), Ct();
      return;
    }
  }
  Zo(e, n, a, l, d);
}
function Zo(e, t, n, l = !0, a = !1) {
  if (a)
    throw e;
  console.error(e);
}
const Le = [];
let ct = -1;
const Jt = [];
let At = null, Gt = 0;
const vi = /* @__PURE__ */ Promise.resolve();
let Ns = null;
function ea(e) {
  const t = Ns || vi;
  return e ? t.then(this ? e.bind(this) : e) : t;
}
function ta(e) {
  let t = ct + 1, n = Le.length;
  for (; t < n; ) {
    const l = t + n >>> 1, a = Le[l], r = ys(a);
    r < e || r === e && a.flags & 2 ? t = l + 1 : n = l;
  }
  return t;
}
function Qn(e) {
  if (!(e.flags & 1)) {
    const t = ys(e), n = Le[Le.length - 1];
    !n || // fast path when the job id is larger than the tail
    !(e.flags & 2) && t >= ys(n) ? Le.push(e) : Le.splice(ta(t), 0, e), e.flags |= 1, gi();
  }
}
function gi() {
  Ns || (Ns = vi.then(hi));
}
function sa(e) {
  Q(e) ? Jt.push(...e) : At && e.id === -1 ? At.splice(Gt + 1, 0, e) : e.flags & 1 || (Jt.push(e), e.flags |= 1), gi();
}
function vl(e, t, n = ct + 1) {
  for (; n < Le.length; n++) {
    const l = Le[n];
    if (l && l.flags & 2) {
      if (e && l.id !== e.uid)
        continue;
      Le.splice(n, 1), n--, l.flags & 4 && (l.flags &= -2), l(), l.flags & 4 || (l.flags &= -2);
    }
  }
}
function _i(e) {
  if (Jt.length) {
    const t = [...new Set(Jt)].sort(
      (n, l) => ys(n) - ys(l)
    );
    if (Jt.length = 0, At) {
      At.push(...t);
      return;
    }
    for (At = t, Gt = 0; Gt < At.length; Gt++) {
      const n = At[Gt];
      n.flags & 4 && (n.flags &= -2), n.flags & 8 || n(), n.flags &= -2;
    }
    At = null, Gt = 0;
  }
}
const ys = (e) => e.id == null ? e.flags & 2 ? -1 : 1 / 0 : e.id;
function hi(e) {
  try {
    for (ct = 0; ct < Le.length; ct++) {
      const t = Le[ct];
      t && !(t.flags & 8) && (t.flags & 4 && (t.flags &= -2), Cs(
        t,
        t.i,
        t.i ? 15 : 14
      ), t.flags & 4 || (t.flags &= -2));
    }
  } finally {
    for (; ct < Le.length; ct++) {
      const t = Le[ct];
      t && (t.flags &= -2);
    }
    ct = -1, Le.length = 0, _i(), Ns = null, (Le.length || Jt.length) && hi();
  }
}
let Qe = null, mi = null;
function Ws(e) {
  const t = Qe;
  return Qe = e, mi = e && e.type.__scopeId || null, t;
}
function na(e, t = Qe, n) {
  if (!t || e._n)
    return e;
  const l = (...a) => {
    l._d && Cl(-1);
    const r = Ws(t);
    let d;
    try {
      d = e(...a);
    } finally {
      Ws(r), l._d && Cl(1);
    }
    return d;
  };
  return l._n = !0, l._c = !0, l._d = !0, l;
}
function Et(e, t) {
  if (Qe === null)
    return e;
  const n = nn(Qe), l = e.dirs || (e.dirs = []);
  for (let a = 0; a < t.length; a++) {
    let [r, d, p, g = ve] = t[a];
    r && (Z(r) && (r = {
      mounted: r,
      updated: r
    }), r.deep && kt(d), l.push({
      dir: r,
      instance: n,
      value: d,
      oldValue: void 0,
      arg: p,
      modifiers: g
    }));
  }
  return e;
}
function Bt(e, t, n, l) {
  const a = e.dirs, r = t && t.dirs;
  for (let d = 0; d < a.length; d++) {
    const p = a[d];
    r && (p.oldValue = r[d].value);
    let g = p.dir[l];
    g && (wt(), gt(g, n, 8, [
      e.el,
      p,
      e,
      t
    ]), Ct());
  }
}
function la(e, t) {
  if (je) {
    let n = je.provides;
    const l = je.parent && je.parent.provides;
    l === n && (n = je.provides = Object.create(l)), n[e] = t;
  }
}
function Fs(e, t, n = !1) {
  const l = sr();
  if (l || Zt) {
    let a = Zt ? Zt._context.provides : l ? l.parent == null || l.ce ? l.vnode.appContext && l.vnode.appContext.provides : l.parent.provides : void 0;
    if (a && e in a)
      return a[e];
    if (arguments.length > 1)
      return n && Z(t) ? t.call(l && l.proxy) : t;
  }
}
const ia = /* @__PURE__ */ Symbol.for("v-scx"), oa = () => Fs(ia);
function Is(e, t, n) {
  return bi(e, t, n);
}
function bi(e, t, n = ve) {
  const { immediate: l, deep: a, flush: r, once: d } = n, p = $e({}, n), g = t && l || !t && r !== "post";
  let k;
  if (ks) {
    if (r === "sync") {
      const L = oa();
      k = L.__watcherHandles || (L.__watcherHandles = []);
    } else if (!g) {
      const L = () => {
      };
      return L.stop = ft, L.resume = ft, L.pause = ft, L;
    }
  }
  const b = je;
  p.call = (L, J, U) => gt(L, b, J, U);
  let S = !1;
  r === "post" ? p.scheduler = (L) => {
    Ue(L, b && b.suspense);
  } : r !== "sync" && (S = !0, p.scheduler = (L, J) => {
    J ? L() : Qn(L);
  }), p.augmentJob = (L) => {
    t && (L.flags |= 4), S && (L.flags |= 2, b && (L.id = b.uid, L.i = b));
  };
  const O = Jo(e, t, p);
  return ks && (k ? k.push(O) : g && O()), O;
}
function aa(e, t, n) {
  const l = this.proxy, a = ye(e) ? e.includes(".") ? yi(l, e) : () => l[e] : e.bind(l, l);
  let r;
  Z(t) ? r = t : (r = t.handler, n = t);
  const d = Ms(this), p = bi(a, r.bind(l), n);
  return d(), p;
}
function yi(e, t) {
  const n = t.split(".");
  return () => {
    let l = e;
    for (let a = 0; a < n.length && l; a++)
      l = l[n[a]];
    return l;
  };
}
const ra = /* @__PURE__ */ Symbol("_vte"), ca = (e) => e.__isTeleport, ua = /* @__PURE__ */ Symbol("_leaveCb");
function Xn(e, t) {
  e.shapeFlag & 6 && e.component ? (e.transition = t, Xn(e.component.subTree, t)) : e.shapeFlag & 128 ? (e.ssContent.transition = t.clone(e.ssContent), e.ssFallback.transition = t.clone(e.ssFallback)) : e.transition = t;
}
function xi(e) {
  e.ids = [e.ids[0] + e.ids[2]++ + "-", 0, 0];
}
function gl(e, t) {
  let n;
  return !!((n = Object.getOwnPropertyDescriptor(e, t)) && !n.configurable);
}
const Us = /* @__PURE__ */ new WeakMap();
function ps(e, t, n, l, a = !1) {
  if (Q(e)) {
    e.forEach(
      (U, ie) => ps(
        U,
        t && (Q(t) ? t[ie] : t),
        n,
        l,
        a
      )
    );
    return;
  }
  if (fs(l) && !a) {
    l.shapeFlag & 512 && l.type.__asyncResolved && l.component.subTree.component && ps(e, t, n, l.component.subTree);
    return;
  }
  const r = l.shapeFlag & 4 ? nn(l.component) : l.el, d = a ? null : r, { i: p, r: g } = e, k = t && t.r, b = p.refs === ve ? p.refs = {} : p.refs, S = p.setupState, O = /* @__PURE__ */ ce(S), L = S === ve ? Ul : (U) => gl(b, U) ? !1 : ue(O, U), J = (U, ie) => !(ie && gl(b, ie));
  if (k != null && k !== g) {
    if (_l(t), ye(k))
      b[k] = null, L(k) && (S[k] = null);
    else if (/* @__PURE__ */ Ve(k)) {
      const U = t;
      J(k, U.k) && (k.value = null), U.k && (b[U.k] = null);
    }
  }
  if (Z(g))
    Cs(g, p, 12, [d, b]);
  else {
    const U = ye(g), ie = /* @__PURE__ */ Ve(g);
    if (U || ie) {
      const F = () => {
        if (e.f) {
          const G = U ? L(g) ? S[g] : b[g] : J() || !e.k ? g.value : b[e.k];
          if (a)
            Q(G) && jn(G, r);
          else if (Q(G))
            G.includes(r) || G.push(r);
          else if (U)
            b[g] = [r], L(g) && (S[g] = b[g]);
          else {
            const te = [r];
            J(g, e.k) && (g.value = te), e.k && (b[e.k] = te);
          }
        } else U ? (b[g] = d, L(g) && (S[g] = d)) : ie && (J(g, e.k) && (g.value = d), e.k && (b[e.k] = d));
      };
      if (d) {
        const G = () => {
          F(), Us.delete(e);
        };
        G.id = -1, Us.set(e, G), Ue(G, n);
      } else
        _l(e), F();
    }
  }
}
function _l(e) {
  const t = Us.get(e);
  t && (t.flags |= 8, Us.delete(e));
}
Xs().requestIdleCallback;
Xs().cancelIdleCallback;
const fs = (e) => !!e.type.__asyncLoader, ki = (e) => e.type.__isKeepAlive;
function da(e, t) {
  Si(e, "a", t);
}
function pa(e, t) {
  Si(e, "da", t);
}
function Si(e, t, n = je) {
  const l = e.__wdc || (e.__wdc = () => {
    let a = n;
    for (; a; ) {
      if (a.isDeactivated)
        return;
      a = a.parent;
    }
    return e();
  });
  if (en(t, l, n), n) {
    let a = n.parent;
    for (; a && a.parent; )
      ki(a.parent.vnode) && fa(l, t, n, a), a = a.parent;
  }
}
function fa(e, t, n, l) {
  const a = en(
    t,
    e,
    l,
    !0
    /* prepend */
  );
  Mi(() => {
    jn(l[t], a);
  }, n);
}
function en(e, t, n = je, l = !1) {
  if (n) {
    const a = n[e] || (n[e] = []), r = t.__weh || (t.__weh = (...d) => {
      wt();
      const p = Ms(n), g = gt(t, n, e, d);
      return p(), Ct(), g;
    });
    return l ? a.unshift(r) : a.push(r), r;
  }
}
const Pt = (e) => (t, n = je) => {
  (!ks || e === "sp") && en(e, (...l) => t(...l), n);
}, va = Pt("bm"), wi = Pt("m"), ga = Pt(
  "bu"
), _a = Pt("u"), Ci = Pt(
  "bum"
), Mi = Pt("um"), ha = Pt(
  "sp"
), ma = Pt("rtg"), ba = Pt("rtc");
function ya(e, t = je) {
  en("ec", e, t);
}
const xa = /* @__PURE__ */ Symbol.for("v-ndc");
function $(e, t, n, l) {
  let a;
  const r = n, d = Q(e);
  if (d || ye(e)) {
    const p = d && /* @__PURE__ */ qt(e);
    let g = !1, k = !1;
    p && (g = !/* @__PURE__ */ Xe(e), k = /* @__PURE__ */ Mt(e), e = Js(e)), a = new Array(e.length);
    for (let b = 0, S = e.length; b < S; b++)
      a[b] = t(
        g ? k ? ts(lt(e[b])) : lt(e[b]) : e[b],
        b,
        void 0,
        r
      );
  } else if (typeof e == "number") {
    a = new Array(e);
    for (let p = 0; p < e; p++)
      a[p] = t(p + 1, p, void 0, r);
  } else if (pe(e))
    if (e[Symbol.iterator])
      a = Array.from(
        e,
        (p, g) => t(p, g, void 0, r)
      );
    else {
      const p = Object.keys(e);
      a = new Array(p.length);
      for (let g = 0, k = p.length; g < k; g++) {
        const b = p[g];
        a[g] = t(e[b], b, g, r);
      }
    }
  else
    a = [];
  return a;
}
const En = (e) => e ? zi(e) ? nn(e) : En(e.parent) : null, vs = (
  // Move PURE marker to new line to workaround compiler discarding it
  // due to type annotation
  /* @__PURE__ */ $e(/* @__PURE__ */ Object.create(null), {
    $: (e) => e,
    $el: (e) => e.vnode.el,
    $data: (e) => e.data,
    $props: (e) => e.props,
    $attrs: (e) => e.attrs,
    $slots: (e) => e.slots,
    $refs: (e) => e.refs,
    $parent: (e) => En(e.parent),
    $root: (e) => En(e.root),
    $host: (e) => e.ce,
    $emit: (e) => e.emit,
    $options: (e) => Ri(e),
    $forceUpdate: (e) => e.f || (e.f = () => {
      Qn(e.update);
    }),
    $nextTick: (e) => e.n || (e.n = ea.bind(e.proxy)),
    $watch: (e) => aa.bind(e)
  })
), bn = (e, t) => e !== ve && !e.__isScriptSetup && ue(e, t), ka = {
  get({ _: e }, t) {
    if (t === "__v_skip")
      return !0;
    const { ctx: n, setupState: l, data: a, props: r, accessCache: d, type: p, appContext: g } = e;
    if (t[0] !== "$") {
      const O = d[t];
      if (O !== void 0)
        switch (O) {
          case 1:
            return l[t];
          case 2:
            return a[t];
          case 4:
            return n[t];
          case 3:
            return r[t];
        }
      else {
        if (bn(l, t))
          return d[t] = 1, l[t];
        if (a !== ve && ue(a, t))
          return d[t] = 2, a[t];
        if (ue(r, t))
          return d[t] = 3, r[t];
        if (n !== ve && ue(n, t))
          return d[t] = 4, n[t];
        An && (d[t] = 0);
      }
    }
    const k = vs[t];
    let b, S;
    if (k)
      return t === "$attrs" && Oe(e.attrs, "get", ""), k(e);
    if (
      // css module (injected by vue-loader)
      (b = p.__cssModules) && (b = b[t])
    )
      return b;
    if (n !== ve && ue(n, t))
      return d[t] = 4, n[t];
    if (
      // global properties
      S = g.config.globalProperties, ue(S, t)
    )
      return S[t];
  },
  set({ _: e }, t, n) {
    const { data: l, setupState: a, ctx: r } = e;
    return bn(a, t) ? (a[t] = n, !0) : l !== ve && ue(l, t) ? (l[t] = n, !0) : ue(e.props, t) || t[0] === "$" && t.slice(1) in e ? !1 : (r[t] = n, !0);
  },
  has({
    _: { data: e, setupState: t, accessCache: n, ctx: l, appContext: a, props: r, type: d }
  }, p) {
    let g;
    return !!(n[p] || e !== ve && p[0] !== "$" && ue(e, p) || bn(t, p) || ue(r, p) || ue(l, p) || ue(vs, p) || ue(a.config.globalProperties, p) || (g = d.__cssModules) && g[p]);
  },
  defineProperty(e, t, n) {
    return n.get != null ? e._.accessCache[t] = 0 : ue(n, "value") && this.set(e, t, n.value, null), Reflect.defineProperty(e, t, n);
  }
};
function hl(e) {
  return Q(e) ? e.reduce(
    (t, n) => (t[n] = null, t),
    {}
  ) : e;
}
let An = !0;
function Sa(e) {
  const t = Ri(e), n = e.proxy, l = e.ctx;
  An = !1, t.beforeCreate && ml(t.beforeCreate, e, "bc");
  const {
    // state
    data: a,
    computed: r,
    methods: d,
    watch: p,
    provide: g,
    inject: k,
    // lifecycle
    created: b,
    beforeMount: S,
    mounted: O,
    beforeUpdate: L,
    updated: J,
    activated: U,
    deactivated: ie,
    beforeDestroy: F,
    beforeUnmount: G,
    destroyed: te,
    unmounted: K,
    render: ne,
    renderTracked: Me,
    renderTriggered: Pe,
    errorCaptured: Be,
    serverPrefetch: it,
    // public API
    expose: H,
    inheritAttrs: xe,
    // assets
    components: Ne,
    directives: x,
    filters: N
  } = t;
  if (k && wa(k, l, null), d)
    for (const re in d) {
      const le = d[re];
      Z(le) && (l[re] = le.bind(n));
    }
  if (a) {
    const re = a.call(n, n);
    pe(re) && (e.data = /* @__PURE__ */ zn(re));
  }
  if (An = !0, r)
    for (const re in r) {
      const le = r[re], Je = Z(le) ? le.bind(n, n) : Z(le.get) ? le.get.bind(n, n) : ft, ot = !Z(le) && Z(le.set) ? le.set.bind(n) : ft, Ze = fe({
        get: Je,
        set: ot
      });
      Object.defineProperty(l, re, {
        enumerable: !0,
        configurable: !0,
        get: () => Ze.value,
        set: (Re) => Ze.value = Re
      });
    }
  if (p)
    for (const re in p)
      Pi(p[re], l, n, re);
  if (g) {
    const re = Z(g) ? g.call(n) : g;
    Reflect.ownKeys(re).forEach((le) => {
      la(le, re[le]);
    });
  }
  b && ml(b, e, "c");
  function ge(re, le) {
    Q(le) ? le.forEach((Je) => re(Je.bind(n))) : le && re(le.bind(n));
  }
  if (ge(va, S), ge(wi, O), ge(ga, L), ge(_a, J), ge(da, U), ge(pa, ie), ge(ya, Be), ge(ba, Me), ge(ma, Pe), ge(Ci, G), ge(Mi, K), ge(ha, it), Q(H))
    if (H.length) {
      const re = e.exposed || (e.exposed = {});
      H.forEach((le) => {
        Object.defineProperty(re, le, {
          get: () => n[le],
          set: (Je) => n[le] = Je,
          enumerable: !0
        });
      });
    } else e.exposed || (e.exposed = {});
  ne && e.render === ft && (e.render = ne), xe != null && (e.inheritAttrs = xe), Ne && (e.components = Ne), x && (e.directives = x), it && xi(e);
}
function wa(e, t, n = ft) {
  Q(e) && (e = Dn(e));
  for (const l in e) {
    const a = e[l];
    let r;
    pe(a) ? "default" in a ? r = Fs(
      a.from || l,
      a.default,
      !0
    ) : r = Fs(a.from || l) : r = Fs(a), /* @__PURE__ */ Ve(r) ? Object.defineProperty(t, l, {
      enumerable: !0,
      configurable: !0,
      get: () => r.value,
      set: (d) => r.value = d
    }) : t[l] = r;
  }
}
function ml(e, t, n) {
  gt(
    Q(e) ? e.map((l) => l.bind(t.proxy)) : e.bind(t.proxy),
    t,
    n
  );
}
function Pi(e, t, n, l) {
  let a = l.includes(".") ? yi(n, l) : () => n[l];
  if (ye(e)) {
    const r = t[e];
    Z(r) && Is(a, r);
  } else if (Z(e))
    Is(a, e.bind(n));
  else if (pe(e))
    if (Q(e))
      e.forEach((r) => Pi(r, t, n, l));
    else {
      const r = Z(e.handler) ? e.handler.bind(n) : t[e.handler];
      Z(r) && Is(a, r, e);
    }
}
function Ri(e) {
  const t = e.type, { mixins: n, extends: l } = t, {
    mixins: a,
    optionsCache: r,
    config: { optionMergeStrategies: d }
  } = e.appContext, p = r.get(t);
  let g;
  return p ? g = p : !a.length && !n && !l ? g = t : (g = {}, a.length && a.forEach(
    (k) => Ks(g, k, d, !0)
  ), Ks(g, t, d)), pe(t) && r.set(t, g), g;
}
function Ks(e, t, n, l = !1) {
  const { mixins: a, extends: r } = t;
  r && Ks(e, r, n, !0), a && a.forEach(
    (d) => Ks(e, d, n, !0)
  );
  for (const d in t)
    if (!(l && d === "expose")) {
      const p = Ca[d] || n && n[d];
      e[d] = p ? p(e[d], t[d]) : t[d];
    }
  return e;
}
const Ca = {
  data: bl,
  props: yl,
  emits: yl,
  // objects
  methods: as,
  computed: as,
  // lifecycle
  beforeCreate: Ie,
  created: Ie,
  beforeMount: Ie,
  mounted: Ie,
  beforeUpdate: Ie,
  updated: Ie,
  beforeDestroy: Ie,
  beforeUnmount: Ie,
  destroyed: Ie,
  unmounted: Ie,
  activated: Ie,
  deactivated: Ie,
  errorCaptured: Ie,
  serverPrefetch: Ie,
  // assets
  components: as,
  directives: as,
  // watch
  watch: Pa,
  // provide / inject
  provide: bl,
  inject: Ma
};
function bl(e, t) {
  return t ? e ? function() {
    return $e(
      Z(e) ? e.call(this, this) : e,
      Z(t) ? t.call(this, this) : t
    );
  } : t : e;
}
function Ma(e, t) {
  return as(Dn(e), Dn(t));
}
function Dn(e) {
  if (Q(e)) {
    const t = {};
    for (let n = 0; n < e.length; n++)
      t[e[n]] = e[n];
    return t;
  }
  return e;
}
function Ie(e, t) {
  return e ? [...new Set([].concat(e, t))] : t;
}
function as(e, t) {
  return e ? $e(/* @__PURE__ */ Object.create(null), e, t) : t;
}
function yl(e, t) {
  return e ? Q(e) && Q(t) ? [.../* @__PURE__ */ new Set([...e, ...t])] : $e(
    /* @__PURE__ */ Object.create(null),
    hl(e),
    hl(t ?? {})
  ) : t;
}
function Pa(e, t) {
  if (!e) return t;
  if (!t) return e;
  const n = $e(/* @__PURE__ */ Object.create(null), e);
  for (const l in t)
    n[l] = Ie(e[l], t[l]);
  return n;
}
function Ti() {
  return {
    app: null,
    config: {
      isNativeTag: Ul,
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
let Ra = 0;
function Ta(e, t) {
  return function(l, a = null) {
    Z(l) || (l = $e({}, l)), a != null && !pe(a) && (a = null);
    const r = Ti(), d = /* @__PURE__ */ new WeakSet(), p = [];
    let g = !1;
    const k = r.app = {
      _uid: Ra++,
      _component: l,
      _props: a,
      _container: null,
      _context: r,
      _instance: null,
      version: rr,
      get config() {
        return r.config;
      },
      set config(b) {
      },
      use(b, ...S) {
        return d.has(b) || (b && Z(b.install) ? (d.add(b), b.install(k, ...S)) : Z(b) && (d.add(b), b(k, ...S))), k;
      },
      mixin(b) {
        return r.mixins.includes(b) || r.mixins.push(b), k;
      },
      component(b, S) {
        return S ? (r.components[b] = S, k) : r.components[b];
      },
      directive(b, S) {
        return S ? (r.directives[b] = S, k) : r.directives[b];
      },
      mount(b, S, O) {
        if (!g) {
          const L = k._ceVNode || St(l, a);
          return L.appContext = r, O === !0 ? O = "svg" : O === !1 && (O = void 0), e(L, b, O), g = !0, k._container = b, b.__vue_app__ = k, nn(L.component);
        }
      },
      onUnmount(b) {
        p.push(b);
      },
      unmount() {
        g && (gt(
          p,
          k._instance,
          16
        ), e(null, k._container), delete k._container.__vue_app__);
      },
      provide(b, S) {
        return r.provides[b] = S, k;
      },
      runWithContext(b) {
        const S = Zt;
        Zt = k;
        try {
          return b();
        } finally {
          Zt = S;
        }
      }
    };
    return k;
  };
}
let Zt = null;
const Ea = (e, t) => t === "modelValue" || t === "model-value" ? e.modelModifiers : e[`${t}Modifiers`] || e[`${st(t)}Modifiers`] || e[`${zt(t)}Modifiers`];
function Aa(e, t, ...n) {
  if (e.isUnmounted) return;
  const l = e.vnode.props || ve;
  let a = n;
  const r = t.startsWith("update:"), d = r && Ea(l, t.slice(7));
  d && (d.trim && (a = n.map((b) => ye(b) ? b.trim() : b)), d.number && (a = n.map(Nn)));
  let p, g = l[p = vn(t)] || // also try camelCase event handler (#2249)
  l[p = vn(st(t))];
  !g && r && (g = l[p = vn(zt(t))]), g && gt(
    g,
    e,
    6,
    a
  );
  const k = l[p + "Once"];
  if (k) {
    if (!e.emitted)
      e.emitted = {};
    else if (e.emitted[p])
      return;
    e.emitted[p] = !0, gt(
      k,
      e,
      6,
      a
    );
  }
}
const Da = /* @__PURE__ */ new WeakMap();
function Ei(e, t, n = !1) {
  const l = n ? Da : t.emitsCache, a = l.get(e);
  if (a !== void 0)
    return a;
  const r = e.emits;
  let d = {}, p = !1;
  if (!Z(e)) {
    const g = (k) => {
      const b = Ei(k, t, !0);
      b && (p = !0, $e(d, b));
    };
    !n && t.mixins.length && t.mixins.forEach(g), e.extends && g(e.extends), e.mixins && e.mixins.forEach(g);
  }
  return !r && !p ? (pe(e) && l.set(e, null), null) : (Q(r) ? r.forEach((g) => d[g] = null) : $e(d, r), pe(e) && l.set(e, d), d);
}
function tn(e, t) {
  return !e || !zs(t) ? !1 : (t = t.slice(2).replace(/Once$/, ""), ue(e, t[0].toLowerCase() + t.slice(1)) || ue(e, zt(t)) || ue(e, t));
}
function xl(e) {
  const {
    type: t,
    vnode: n,
    proxy: l,
    withProxy: a,
    propsOptions: [r],
    slots: d,
    attrs: p,
    emit: g,
    render: k,
    renderCache: b,
    props: S,
    data: O,
    setupState: L,
    ctx: J,
    inheritAttrs: U
  } = e, ie = Ws(e);
  let F, G;
  try {
    if (n.shapeFlag & 4) {
      const K = a || l, ne = K;
      F = dt(
        k.call(
          ne,
          K,
          b,
          S,
          L,
          O,
          J
        )
      ), G = p;
    } else {
      const K = t;
      F = dt(
        K.length > 1 ? K(
          S,
          { attrs: p, slots: d, emit: g }
        ) : K(
          S,
          null
        )
      ), G = t.props ? p : Oa(p);
    }
  } catch (K) {
    gs.length = 0, Zs(K, e, 1), F = St(Ot);
  }
  let te = F;
  if (G && U !== !1) {
    const K = Object.keys(G), { shapeFlag: ne } = te;
    K.length && ne & 7 && (r && K.some(Ys) && (G = Va(
      G,
      r
    )), te = ss(te, G, !1, !0));
  }
  return n.dirs && (te = ss(te, null, !1, !0), te.dirs = te.dirs ? te.dirs.concat(n.dirs) : n.dirs), n.transition && Xn(te, n.transition), F = te, Ws(ie), F;
}
const Oa = (e) => {
  let t;
  for (const n in e)
    (n === "class" || n === "style" || zs(n)) && ((t || (t = {}))[n] = e[n]);
  return t;
}, Va = (e, t) => {
  const n = {};
  for (const l in e)
    (!Ys(l) || !(l.slice(9) in t)) && (n[l] = e[l]);
  return n;
};
function $a(e, t, n) {
  const { props: l, children: a, component: r } = e, { props: d, children: p, patchFlag: g } = t, k = r.emitsOptions;
  if (t.dirs || t.transition)
    return !0;
  if (n && g >= 0) {
    if (g & 1024)
      return !0;
    if (g & 16)
      return l ? kl(l, d, k) : !!d;
    if (g & 8) {
      const b = t.dynamicProps;
      for (let S = 0; S < b.length; S++) {
        const O = b[S];
        if (Ai(d, l, O) && !tn(k, O))
          return !0;
      }
    }
  } else
    return (a || p) && (!p || !p.$stable) ? !0 : l === d ? !1 : l ? d ? kl(l, d, k) : !0 : !!d;
  return !1;
}
function kl(e, t, n) {
  const l = Object.keys(t);
  if (l.length !== Object.keys(e).length)
    return !0;
  for (let a = 0; a < l.length; a++) {
    const r = l[a];
    if (Ai(t, e, r) && !tn(n, r))
      return !0;
  }
  return !1;
}
function Ai(e, t, n) {
  const l = e[n], a = t[n];
  return n === "style" && pe(l) && pe(a) ? !ws(l, a) : l !== a;
}
function Fa({ vnode: e, parent: t, suspense: n }, l) {
  for (; t; ) {
    const a = t.subTree;
    if (a.suspense && a.suspense.activeBranch === e && (a.suspense.vnode.el = a.el = l, e = a), a === e)
      (e = t.vnode).el = l, t = t.parent;
    else
      break;
  }
  n && n.activeBranch === e && (n.vnode.el = l);
}
const Di = {}, Oi = () => Object.create(Di), Vi = (e) => Object.getPrototypeOf(e) === Di;
function Ia(e, t, n, l = !1) {
  const a = {}, r = Oi();
  e.propsDefaults = /* @__PURE__ */ Object.create(null), $i(e, t, a, r);
  for (const d in e.propsOptions[0])
    d in a || (a[d] = void 0);
  n ? e.props = l ? a : /* @__PURE__ */ Uo(a) : e.type.props ? e.props = a : e.props = r, e.attrs = r;
}
function La(e, t, n, l) {
  const {
    props: a,
    attrs: r,
    vnode: { patchFlag: d }
  } = e, p = /* @__PURE__ */ ce(a), [g] = e.propsOptions;
  let k = !1;
  if (
    // always force full diff in dev
    // - #1942 if hmr is enabled with sfc component
    // - vite#872 non-sfc component used by sfc component
    (l || d > 0) && !(d & 16)
  ) {
    if (d & 8) {
      const b = e.vnode.dynamicProps;
      for (let S = 0; S < b.length; S++) {
        let O = b[S];
        if (tn(e.emitsOptions, O))
          continue;
        const L = t[O];
        if (g)
          if (ue(r, O))
            L !== r[O] && (r[O] = L, k = !0);
          else {
            const J = st(O);
            a[J] = On(
              g,
              p,
              J,
              L,
              e,
              !1
            );
          }
        else
          L !== r[O] && (r[O] = L, k = !0);
      }
    }
  } else {
    $i(e, t, a, r) && (k = !0);
    let b;
    for (const S in p)
      (!t || // for camelCase
      !ue(t, S) && // it's possible the original props was passed in as kebab-case
      // and converted to camelCase (#955)
      ((b = zt(S)) === S || !ue(t, b))) && (g ? n && // for camelCase
      (n[S] !== void 0 || // for kebab-case
      n[b] !== void 0) && (a[S] = On(
        g,
        p,
        S,
        void 0,
        e,
        !0
      )) : delete a[S]);
    if (r !== p)
      for (const S in r)
        (!t || !ue(t, S)) && (delete r[S], k = !0);
  }
  k && xt(e.attrs, "set", "");
}
function $i(e, t, n, l) {
  const [a, r] = e.propsOptions;
  let d = !1, p;
  if (t)
    for (let g in t) {
      if (cs(g))
        continue;
      const k = t[g];
      let b;
      a && ue(a, b = st(g)) ? !r || !r.includes(b) ? n[b] = k : (p || (p = {}))[b] = k : tn(e.emitsOptions, g) || (!(g in l) || k !== l[g]) && (l[g] = k, d = !0);
    }
  if (r) {
    const g = /* @__PURE__ */ ce(n), k = p || ve;
    for (let b = 0; b < r.length; b++) {
      const S = r[b];
      n[S] = On(
        a,
        g,
        S,
        k[S],
        e,
        !ue(k, S)
      );
    }
  }
  return d;
}
function On(e, t, n, l, a, r) {
  const d = e[n];
  if (d != null) {
    const p = ue(d, "default");
    if (p && l === void 0) {
      const g = d.default;
      if (d.type !== Function && !d.skipFactory && Z(g)) {
        const { propsDefaults: k } = a;
        if (n in k)
          l = k[n];
        else {
          const b = Ms(a);
          l = k[n] = g.call(
            null,
            t
          ), b();
        }
      } else
        l = g;
      a.ce && a.ce._setProp(n, l);
    }
    d[
      0
      /* shouldCast */
    ] && (r && !p ? l = !1 : d[
      1
      /* shouldCastTrue */
    ] && (l === "" || l === zt(n)) && (l = !0));
  }
  return l;
}
const ja = /* @__PURE__ */ new WeakMap();
function Fi(e, t, n = !1) {
  const l = n ? ja : t.propsCache, a = l.get(e);
  if (a)
    return a;
  const r = e.props, d = {}, p = [];
  let g = !1;
  if (!Z(e)) {
    const b = (S) => {
      g = !0;
      const [O, L] = Fi(S, t, !0);
      $e(d, O), L && p.push(...L);
    };
    !n && t.mixins.length && t.mixins.forEach(b), e.extends && b(e.extends), e.mixins && e.mixins.forEach(b);
  }
  if (!r && !g)
    return pe(e) && l.set(e, Qt), Qt;
  if (Q(r))
    for (let b = 0; b < r.length; b++) {
      const S = st(r[b]);
      Sl(S) && (d[S] = ve);
    }
  else if (r)
    for (const b in r) {
      const S = st(b);
      if (Sl(S)) {
        const O = r[b], L = d[S] = Q(O) || Z(O) ? { type: O } : $e({}, O), J = L.type;
        let U = !1, ie = !0;
        if (Q(J))
          for (let F = 0; F < J.length; ++F) {
            const G = J[F], te = Z(G) && G.name;
            if (te === "Boolean") {
              U = !0;
              break;
            } else te === "String" && (ie = !1);
          }
        else
          U = Z(J) && J.name === "Boolean";
        L[
          0
          /* shouldCast */
        ] = U, L[
          1
          /* shouldCastTrue */
        ] = ie, (U || ue(L, "default")) && p.push(S);
      }
    }
  const k = [d, p];
  return pe(e) && l.set(e, k), k;
}
function Sl(e) {
  return e[0] !== "$" && !cs(e);
}
const Jn = (e) => e === "_" || e === "_ctx" || e === "$stable", Zn = (e) => Q(e) ? e.map(dt) : [dt(e)], Ba = (e, t, n) => {
  if (t._n)
    return t;
  const l = na((...a) => Zn(t(...a)), n);
  return l._c = !1, l;
}, Ii = (e, t, n) => {
  const l = e._ctx;
  for (const a in e) {
    if (Jn(a)) continue;
    const r = e[a];
    if (Z(r))
      t[a] = Ba(a, r, l);
    else if (r != null) {
      const d = Zn(r);
      t[a] = () => d;
    }
  }
}, Li = (e, t) => {
  const n = Zn(t);
  e.slots.default = () => n;
}, ji = (e, t, n) => {
  for (const l in t)
    (n || !Jn(l)) && (e[l] = t[l]);
}, Na = (e, t, n) => {
  const l = e.slots = Oi();
  if (e.vnode.shapeFlag & 32) {
    const a = t._;
    a ? (ji(l, t, n), n && Yl(l, "_", a, !0)) : Ii(t, l);
  } else t && Li(e, t);
}, Wa = (e, t, n) => {
  const { vnode: l, slots: a } = e;
  let r = !0, d = ve;
  if (l.shapeFlag & 32) {
    const p = t._;
    p ? n && p === 1 ? r = !1 : ji(a, t, n) : (r = !t.$stable, Ii(t, a)), d = t;
  } else t && (Li(e, t), d = { default: 1 });
  if (r)
    for (const p in a)
      !Jn(p) && d[p] == null && delete a[p];
}, Ue = za;
function Ua(e) {
  return Ka(e);
}
function Ka(e, t) {
  const n = Xs();
  n.__VUE__ = !0;
  const {
    insert: l,
    remove: a,
    patchProp: r,
    createElement: d,
    createText: p,
    createComment: g,
    setText: k,
    setElementText: b,
    parentNode: S,
    nextSibling: O,
    setScopeId: L = ft,
    insertStaticContent: J
  } = e, U = (_, m, w, T = null, M = null, P = null, I = void 0, V = null, A = !!m.dynamicChildren) => {
    if (_ === m)
      return;
    _ && !os(_, m) && (T = Ae(_), Re(_, M, P, !0), _ = null), m.patchFlag === -2 && (A = !1, m.dynamicChildren = null);
    const { type: R, ref: q, shapeFlag: B } = m;
    switch (R) {
      case sn:
        ie(_, m, w, T);
        break;
      case Ot:
        F(_, m, w, T);
        break;
      case xn:
        _ == null && G(m, w, T, I);
        break;
      case C:
        Ne(
          _,
          m,
          w,
          T,
          M,
          P,
          I,
          V,
          A
        );
        break;
      default:
        B & 1 ? ne(
          _,
          m,
          w,
          T,
          M,
          P,
          I,
          V,
          A
        ) : B & 6 ? x(
          _,
          m,
          w,
          T,
          M,
          P,
          I,
          V,
          A
        ) : (B & 64 || B & 128) && R.process(
          _,
          m,
          w,
          T,
          M,
          P,
          I,
          V,
          A,
          Tt
        );
    }
    q != null && M ? ps(q, _ && _.ref, P, m || _, !m) : q == null && _ && _.ref != null && ps(_.ref, null, P, _, !0);
  }, ie = (_, m, w, T) => {
    if (_ == null)
      l(
        m.el = p(m.children),
        w,
        T
      );
    else {
      const M = m.el = _.el;
      m.children !== _.children && k(M, m.children);
    }
  }, F = (_, m, w, T) => {
    _ == null ? l(
      m.el = g(m.children || ""),
      w,
      T
    ) : m.el = _.el;
  }, G = (_, m, w, T) => {
    [_.el, _.anchor] = J(
      _.children,
      m,
      w,
      T,
      _.el,
      _.anchor
    );
  }, te = ({ el: _, anchor: m }, w, T) => {
    let M;
    for (; _ && _ !== m; )
      M = O(_), l(_, w, T), _ = M;
    l(m, w, T);
  }, K = ({ el: _, anchor: m }) => {
    let w;
    for (; _ && _ !== m; )
      w = O(_), a(_), _ = w;
    a(m);
  }, ne = (_, m, w, T, M, P, I, V, A) => {
    if (m.type === "svg" ? I = "svg" : m.type === "math" && (I = "mathml"), _ == null)
      Me(
        m,
        w,
        T,
        M,
        P,
        I,
        V,
        A
      );
    else {
      const R = _.el && _.el._isVueCE ? _.el : null;
      try {
        R && R._beginPatch(), it(
          _,
          m,
          M,
          P,
          I,
          V,
          A
        );
      } finally {
        R && R._endPatch();
      }
    }
  }, Me = (_, m, w, T, M, P, I, V) => {
    let A, R;
    const { props: q, shapeFlag: B, transition: W, dirs: z } = _;
    if (A = _.el = d(
      _.type,
      P,
      q && q.is,
      q
    ), B & 8 ? b(A, _.children) : B & 16 && Be(
      _.children,
      A,
      null,
      T,
      M,
      yn(_, P),
      I,
      V
    ), z && Bt(_, null, T, "created"), Pe(A, _, _.scopeId, I, T), q) {
      for (const oe in q)
        oe !== "value" && !cs(oe) && r(A, oe, null, q[oe], P, T);
      "value" in q && r(A, "value", null, q.value, P), (R = q.onVnodeBeforeMount) && rt(R, T, _);
    }
    z && Bt(_, null, T, "beforeMount");
    const se = Ha(M, W);
    se && W.beforeEnter(A), l(A, m, w), ((R = q && q.onVnodeMounted) || se || z) && Ue(() => {
      R && rt(R, T, _), se && W.enter(A), z && Bt(_, null, T, "mounted");
    }, M);
  }, Pe = (_, m, w, T, M) => {
    if (w && L(_, w), T)
      for (let P = 0; P < T.length; P++)
        L(_, T[P]);
    if (M) {
      let P = M.subTree;
      if (m === P || Ui(P.type) && (P.ssContent === m || P.ssFallback === m)) {
        const I = M.vnode;
        Pe(
          _,
          I,
          I.scopeId,
          I.slotScopeIds,
          M.parent
        );
      }
    }
  }, Be = (_, m, w, T, M, P, I, V, A = 0) => {
    for (let R = A; R < _.length; R++) {
      const q = _[R] = V ? yt(_[R]) : dt(_[R]);
      U(
        null,
        q,
        m,
        w,
        T,
        M,
        P,
        I,
        V
      );
    }
  }, it = (_, m, w, T, M, P, I) => {
    const V = m.el = _.el;
    let { patchFlag: A, dynamicChildren: R, dirs: q } = m;
    A |= _.patchFlag & 16;
    const B = _.props || ve, W = m.props || ve;
    let z;
    if (w && Nt(w, !1), (z = W.onVnodeBeforeUpdate) && rt(z, w, m, _), q && Bt(m, _, w, "beforeUpdate"), w && Nt(w, !0), (B.innerHTML && W.innerHTML == null || B.textContent && W.textContent == null) && b(V, ""), R ? H(
      _.dynamicChildren,
      R,
      V,
      w,
      T,
      yn(m, M),
      P
    ) : I || le(
      _,
      m,
      V,
      null,
      w,
      T,
      yn(m, M),
      P,
      !1
    ), A > 0) {
      if (A & 16)
        xe(V, B, W, w, M);
      else if (A & 2 && B.class !== W.class && r(V, "class", null, W.class, M), A & 4 && r(V, "style", B.style, W.style, M), A & 8) {
        const se = m.dynamicProps;
        for (let oe = 0; oe < se.length; oe++) {
          const de = se[oe], me = B[de], ke = W[de];
          (ke !== me || de === "value") && r(V, de, me, ke, M, w);
        }
      }
      A & 1 && _.children !== m.children && b(V, m.children);
    } else !I && R == null && xe(V, B, W, w, M);
    ((z = W.onVnodeUpdated) || q) && Ue(() => {
      z && rt(z, w, m, _), q && Bt(m, _, w, "updated");
    }, T);
  }, H = (_, m, w, T, M, P, I) => {
    for (let V = 0; V < m.length; V++) {
      const A = _[V], R = m[V], q = (
        // oldVNode may be an errored async setup() component inside Suspense
        // which will not have a mounted element
        A.el && // - In the case of a Fragment, we need to provide the actual parent
        // of the Fragment itself so it can move its children.
        (A.type === C || // - In the case of different nodes, there is going to be a replacement
        // which also requires the correct parent container
        !os(A, R) || // - In the case of a component, it could contain anything.
        A.shapeFlag & 198) ? S(A.el) : (
          // In other cases, the parent container is not actually used so we
          // just pass the block element here to avoid a DOM parentNode call.
          w
        )
      );
      U(
        A,
        R,
        q,
        null,
        T,
        M,
        P,
        I,
        !0
      );
    }
  }, xe = (_, m, w, T, M) => {
    if (m !== w) {
      if (m !== ve)
        for (const P in m)
          !cs(P) && !(P in w) && r(
            _,
            P,
            m[P],
            null,
            M,
            T
          );
      for (const P in w) {
        if (cs(P)) continue;
        const I = w[P], V = m[P];
        I !== V && P !== "value" && r(_, P, V, I, M, T);
      }
      "value" in w && r(_, "value", m.value, w.value, M);
    }
  }, Ne = (_, m, w, T, M, P, I, V, A) => {
    const R = m.el = _ ? _.el : p(""), q = m.anchor = _ ? _.anchor : p("");
    let { patchFlag: B, dynamicChildren: W, slotScopeIds: z } = m;
    z && (V = V ? V.concat(z) : z), _ == null ? (l(R, w, T), l(q, w, T), Be(
      // #10007
      // such fragment like `<></>` will be compiled into
      // a fragment which doesn't have a children.
      // In this case fallback to an empty array
      m.children || [],
      w,
      q,
      M,
      P,
      I,
      V,
      A
    )) : B > 0 && B & 64 && W && // #2715 the previous fragment could've been a BAILed one as a result
    // of renderSlot() with no valid children
    _.dynamicChildren && _.dynamicChildren.length === W.length ? (H(
      _.dynamicChildren,
      W,
      w,
      M,
      P,
      I,
      V
    ), // #2080 if the stable fragment has a key, it's a <template v-for> that may
    //  get moved around. Make sure all root level vnodes inherit el.
    // #2134 or if it's a component root, it may also get moved around
    // as the component is being moved.
    (m.key != null || M && m === M.subTree) && Bi(
      _,
      m,
      !0
      /* shallow */
    )) : le(
      _,
      m,
      w,
      q,
      M,
      P,
      I,
      V,
      A
    );
  }, x = (_, m, w, T, M, P, I, V, A) => {
    m.slotScopeIds = V, _ == null ? m.shapeFlag & 512 ? M.ctx.activate(
      m,
      w,
      T,
      I,
      A
    ) : N(
      m,
      w,
      T,
      M,
      P,
      I,
      A
    ) : ae(_, m, A);
  }, N = (_, m, w, T, M, P, I) => {
    const V = _.component = tr(
      _,
      T,
      M
    );
    if (ki(_) && (V.ctx.renderer = Tt), nr(V, !1, I), V.asyncDep) {
      if (M && M.registerDep(V, ge, I), !_.el) {
        const A = V.subTree = St(Ot);
        F(null, A, m, w), _.placeholder = A.el;
      }
    } else
      ge(
        V,
        _,
        m,
        w,
        M,
        P,
        I
      );
  }, ae = (_, m, w) => {
    const T = m.component = _.component;
    if ($a(_, m, w))
      if (T.asyncDep && !T.asyncResolved) {
        re(T, m, w);
        return;
      } else
        T.next = m, T.update();
    else
      m.el = _.el, T.vnode = m;
  }, ge = (_, m, w, T, M, P, I) => {
    const V = () => {
      if (_.isMounted) {
        let { next: B, bu: W, u: z, parent: se, vnode: oe } = _;
        {
          const Ye = Ni(_);
          if (Ye) {
            B && (B.el = oe.el, re(_, B, I)), Ye.asyncDep.then(() => {
              Ue(() => {
                _.isUnmounted || R();
              }, M);
            });
            return;
          }
        }
        let de = B, me;
        Nt(_, !1), B ? (B.el = oe.el, re(_, B, I)) : B = oe, W && $s(W), (me = B.props && B.props.onVnodeBeforeUpdate) && rt(me, se, B, oe), Nt(_, !0);
        const ke = xl(_), He = _.subTree;
        _.subTree = ke, U(
          He,
          ke,
          // parent may have changed if it's in a teleport
          S(He.el),
          // anchor may have changed if it's in a fragment
          Ae(He),
          _,
          M,
          P
        ), B.el = ke.el, de === null && Fa(_, ke.el), z && Ue(z, M), (me = B.props && B.props.onVnodeUpdated) && Ue(
          () => rt(me, se, B, oe),
          M
        );
      } else {
        let B;
        const { el: W, props: z } = m, { bm: se, m: oe, parent: de, root: me, type: ke } = _, He = fs(m);
        Nt(_, !1), se && $s(se), !He && (B = z && z.onVnodeBeforeMount) && rt(B, de, m), Nt(_, !0);
        {
          me.ce && me.ce._hasShadowRoot() && me.ce._injectChildStyle(
            ke,
            _.parent ? _.parent.type : void 0
          );
          const Ye = _.subTree = xl(_);
          U(
            null,
            Ye,
            w,
            T,
            _,
            M,
            P
          ), m.el = Ye.el;
        }
        if (oe && Ue(oe, M), !He && (B = z && z.onVnodeMounted)) {
          const Ye = m;
          Ue(
            () => rt(B, de, Ye),
            M
          );
        }
        (m.shapeFlag & 256 || de && fs(de.vnode) && de.vnode.shapeFlag & 256) && _.a && Ue(_.a, M), _.isMounted = !0, m = w = T = null;
      }
    };
    _.scope.on();
    const A = _.effect = new Zl(V);
    _.scope.off();
    const R = _.update = A.run.bind(A), q = _.job = A.runIfDirty.bind(A);
    q.i = _, q.id = _.uid, A.scheduler = () => Qn(q), Nt(_, !0), R();
  }, re = (_, m, w) => {
    m.component = _;
    const T = _.vnode.props;
    _.vnode = m, _.next = null, La(_, m.props, T, w), Wa(_, m.children, w), wt(), vl(_), Ct();
  }, le = (_, m, w, T, M, P, I, V, A = !1) => {
    const R = _ && _.children, q = _ ? _.shapeFlag : 0, B = m.children, { patchFlag: W, shapeFlag: z } = m;
    if (W > 0) {
      if (W & 128) {
        ot(
          R,
          B,
          w,
          T,
          M,
          P,
          I,
          V,
          A
        );
        return;
      } else if (W & 256) {
        Je(
          R,
          B,
          w,
          T,
          M,
          P,
          I,
          V,
          A
        );
        return;
      }
    }
    z & 8 ? (q & 16 && we(R, M, P), B !== R && b(w, B)) : q & 16 ? z & 16 ? ot(
      R,
      B,
      w,
      T,
      M,
      P,
      I,
      V,
      A
    ) : we(R, M, P, !0) : (q & 8 && b(w, ""), z & 16 && Be(
      B,
      w,
      T,
      M,
      P,
      I,
      V,
      A
    ));
  }, Je = (_, m, w, T, M, P, I, V, A) => {
    _ = _ || Qt, m = m || Qt;
    const R = _.length, q = m.length, B = Math.min(R, q);
    let W;
    for (W = 0; W < B; W++) {
      const z = m[W] = A ? yt(m[W]) : dt(m[W]);
      U(
        _[W],
        z,
        w,
        null,
        M,
        P,
        I,
        V,
        A
      );
    }
    R > q ? we(
      _,
      M,
      P,
      !0,
      !1,
      B
    ) : Be(
      m,
      w,
      T,
      M,
      P,
      I,
      V,
      A,
      B
    );
  }, ot = (_, m, w, T, M, P, I, V, A) => {
    let R = 0;
    const q = m.length;
    let B = _.length - 1, W = q - 1;
    for (; R <= B && R <= W; ) {
      const z = _[R], se = m[R] = A ? yt(m[R]) : dt(m[R]);
      if (os(z, se))
        U(
          z,
          se,
          w,
          null,
          M,
          P,
          I,
          V,
          A
        );
      else
        break;
      R++;
    }
    for (; R <= B && R <= W; ) {
      const z = _[B], se = m[W] = A ? yt(m[W]) : dt(m[W]);
      if (os(z, se))
        U(
          z,
          se,
          w,
          null,
          M,
          P,
          I,
          V,
          A
        );
      else
        break;
      B--, W--;
    }
    if (R > B) {
      if (R <= W) {
        const z = W + 1, se = z < q ? m[z].el : T;
        for (; R <= W; )
          U(
            null,
            m[R] = A ? yt(m[R]) : dt(m[R]),
            w,
            se,
            M,
            P,
            I,
            V,
            A
          ), R++;
      }
    } else if (R > W)
      for (; R <= B; )
        Re(_[R], M, P, !0), R++;
    else {
      const z = R, se = R, oe = /* @__PURE__ */ new Map();
      for (R = se; R <= W; R++) {
        const Fe = m[R] = A ? yt(m[R]) : dt(m[R]);
        Fe.key != null && oe.set(Fe.key, R);
      }
      let de, me = 0;
      const ke = W - se + 1;
      let He = !1, Ye = 0;
      const Ft = new Array(ke);
      for (R = 0; R < ke; R++) Ft[R] = 0;
      for (R = z; R <= B; R++) {
        const Fe = _[R];
        if (me >= ke) {
          Re(Fe, M, P, !0);
          continue;
        }
        let Ge;
        if (Fe.key != null)
          Ge = oe.get(Fe.key);
        else
          for (de = se; de <= W; de++)
            if (Ft[de - se] === 0 && os(Fe, m[de])) {
              Ge = de;
              break;
            }
        Ge === void 0 ? Re(Fe, M, P, !0) : (Ft[Ge - se] = R + 1, Ge >= Ye ? Ye = Ge : He = !0, U(
          Fe,
          m[Ge],
          w,
          null,
          M,
          P,
          I,
          V,
          A
        ), me++);
      }
      const Rs = He ? qa(Ft) : Qt;
      for (de = Rs.length - 1, R = ke - 1; R >= 0; R--) {
        const Fe = se + R, Ge = m[Fe], Ts = m[Fe + 1], Es = Fe + 1 < q ? (
          // #13559, #14173 fallback to el placeholder for unresolved async component
          Ts.el || Wi(Ts)
        ) : T;
        Ft[R] === 0 ? U(
          null,
          Ge,
          w,
          Es,
          M,
          P,
          I,
          V,
          A
        ) : He && (de < 0 || R !== Rs[de] ? Ze(Ge, w, Es, 2) : de--);
      }
    }
  }, Ze = (_, m, w, T, M = null) => {
    const { el: P, type: I, transition: V, children: A, shapeFlag: R } = _;
    if (R & 6) {
      Ze(_.component.subTree, m, w, T);
      return;
    }
    if (R & 128) {
      _.suspense.move(m, w, T);
      return;
    }
    if (R & 64) {
      I.move(_, m, w, Tt);
      return;
    }
    if (I === C) {
      l(P, m, w);
      for (let B = 0; B < A.length; B++)
        Ze(A[B], m, w, T);
      l(_.anchor, m, w);
      return;
    }
    if (I === xn) {
      te(_, m, w);
      return;
    }
    if (T !== 2 && R & 1 && V)
      if (T === 0)
        V.beforeEnter(P), l(P, m, w), Ue(() => V.enter(P), M);
      else {
        const { leave: B, delayLeave: W, afterLeave: z } = V, se = () => {
          _.ctx.isUnmounted ? a(P) : l(P, m, w);
        }, oe = () => {
          P._isLeaving && P[ua](
            !0
            /* cancelled */
          ), B(P, () => {
            se(), z && z();
          });
        };
        W ? W(P, se, oe) : oe();
      }
    else
      l(P, m, w);
  }, Re = (_, m, w, T = !1, M = !1) => {
    const {
      type: P,
      props: I,
      ref: V,
      children: A,
      dynamicChildren: R,
      shapeFlag: q,
      patchFlag: B,
      dirs: W,
      cacheIndex: z,
      memo: se
    } = _;
    if (B === -2 && (M = !1), V != null && (wt(), ps(V, null, w, _, !0), Ct()), z != null && (m.renderCache[z] = void 0), q & 256) {
      m.ctx.deactivate(_);
      return;
    }
    const oe = q & 1 && W, de = !fs(_);
    let me;
    if (de && (me = I && I.onVnodeBeforeUnmount) && rt(me, m, _), q & 6)
      $t(_.component, w, T);
    else {
      if (q & 128) {
        _.suspense.unmount(w, T);
        return;
      }
      oe && Bt(_, null, m, "beforeUnmount"), q & 64 ? _.type.remove(
        _,
        m,
        w,
        Tt,
        T
      ) : R && // #5154
      // when v-once is used inside a block, setBlockTracking(-1) marks the
      // parent block with hasOnce: true
      // so that it doesn't take the fast path during unmount - otherwise
      // components nested in v-once are never unmounted.
      !R.hasOnce && // #1153: fast path should not be taken for non-stable (v-for) fragments
      (P !== C || B > 0 && B & 64) ? we(
        R,
        m,
        w,
        !1,
        !0
      ) : (P === C && B & 384 || !M && q & 16) && we(A, m, w), T && Rt(_);
    }
    const ke = se != null && z == null;
    (de && (me = I && I.onVnodeUnmounted) || oe || ke) && Ue(() => {
      me && rt(me, m, _), oe && Bt(_, null, m, "unmounted"), ke && (_.el = null);
    }, w);
  }, Rt = (_) => {
    const { type: m, el: w, anchor: T, transition: M } = _;
    if (m === C) {
      at(w, T);
      return;
    }
    if (m === xn) {
      K(_);
      return;
    }
    const P = () => {
      a(w), M && !M.persisted && M.afterLeave && M.afterLeave();
    };
    if (_.shapeFlag & 1 && M && !M.persisted) {
      const { leave: I, delayLeave: V } = M, A = () => I(w, P);
      V ? V(_.el, P, A) : A();
    } else
      P();
  }, at = (_, m) => {
    let w;
    for (; _ !== m; )
      w = O(_), a(_), _ = w;
    a(m);
  }, $t = (_, m, w) => {
    const { bum: T, scope: M, job: P, subTree: I, um: V, m: A, a: R } = _;
    wl(A), wl(R), T && $s(T), M.stop(), P && (P.flags |= 8, Re(I, _, m, w)), V && Ue(V, m), Ue(() => {
      _.isUnmounted = !0;
    }, m);
  }, we = (_, m, w, T = !1, M = !1, P = 0) => {
    for (let I = P; I < _.length; I++)
      Re(_[I], m, w, T, M);
  }, Ae = (_) => {
    if (_.shapeFlag & 6)
      return Ae(_.component.subTree);
    if (_.shapeFlag & 128)
      return _.suspense.next();
    const m = O(_.anchor || _.el), w = m && m[ra];
    return w ? O(w) : m;
  };
  let Ce = !1;
  const Ke = (_, m, w) => {
    let T;
    _ == null ? m._vnode && (Re(m._vnode, null, null, !0), T = m._vnode.component) : U(
      m._vnode || null,
      _,
      m,
      null,
      null,
      null,
      w
    ), m._vnode = _, Ce || (Ce = !0, vl(T), _i(), Ce = !1);
  }, Tt = {
    p: U,
    um: Re,
    m: Ze,
    r: Rt,
    mt: N,
    mc: Be,
    pc: le,
    pbc: H,
    n: Ae,
    o: e
  };
  return {
    render: Ke,
    hydrate: void 0,
    createApp: Ta(Ke)
  };
}
function yn({ type: e, props: t }, n) {
  return n === "svg" && e === "foreignObject" || n === "mathml" && e === "annotation-xml" && t && t.encoding && t.encoding.includes("html") ? void 0 : n;
}
function Nt({ effect: e, job: t }, n) {
  n ? (e.flags |= 32, t.flags |= 4) : (e.flags &= -33, t.flags &= -5);
}
function Ha(e, t) {
  return (!e || e && !e.pendingBranch) && t && !t.persisted;
}
function Bi(e, t, n = !1) {
  const l = e.children, a = t.children;
  if (Q(l) && Q(a))
    for (let r = 0; r < l.length; r++) {
      const d = l[r];
      let p = a[r];
      p.shapeFlag & 1 && !p.dynamicChildren && ((p.patchFlag <= 0 || p.patchFlag === 32) && (p = a[r] = yt(a[r]), p.el = d.el), !n && p.patchFlag !== -2 && Bi(d, p)), p.type === sn && (p.patchFlag === -1 && (p = a[r] = yt(p)), p.el = d.el), p.type === Ot && !p.el && (p.el = d.el);
    }
}
function qa(e) {
  const t = e.slice(), n = [0];
  let l, a, r, d, p;
  const g = e.length;
  for (l = 0; l < g; l++) {
    const k = e[l];
    if (k !== 0) {
      if (a = n[n.length - 1], e[a] < k) {
        t[l] = a, n.push(l);
        continue;
      }
      for (r = 0, d = n.length - 1; r < d; )
        p = r + d >> 1, e[n[p]] < k ? r = p + 1 : d = p;
      k < e[n[r]] && (r > 0 && (t[l] = n[r - 1]), n[r] = l);
    }
  }
  for (r = n.length, d = n[r - 1]; r-- > 0; )
    n[r] = d, d = t[d];
  return n;
}
function Ni(e) {
  const t = e.subTree.component;
  if (t)
    return t.asyncDep && !t.asyncResolved ? t : Ni(t);
}
function wl(e) {
  if (e)
    for (let t = 0; t < e.length; t++)
      e[t].flags |= 8;
}
function Wi(e) {
  if (e.placeholder)
    return e.placeholder;
  const t = e.component;
  return t ? Wi(t.subTree) : null;
}
const Ui = (e) => e.__isSuspense;
function za(e, t) {
  t && t.pendingBranch ? Q(e) ? t.effects.push(...e) : t.effects.push(e) : sa(e);
}
const C = /* @__PURE__ */ Symbol.for("v-fgt"), sn = /* @__PURE__ */ Symbol.for("v-txt"), Ot = /* @__PURE__ */ Symbol.for("v-cmt"), xn = /* @__PURE__ */ Symbol.for("v-stc"), gs = [];
let ze = null;
function f(e = !1) {
  gs.push(ze = e ? null : []);
}
function Ya() {
  gs.pop(), ze = gs[gs.length - 1] || null;
}
let xs = 1;
function Cl(e, t = !1) {
  xs += e, e < 0 && ze && t && (ze.hasOnce = !0);
}
function Ki(e) {
  return e.dynamicChildren = xs > 0 ? ze || Qt : null, Ya(), xs > 0 && ze && ze.push(e), e;
}
function v(e, t, n, l, a, r) {
  return Ki(
    s(
      e,
      t,
      n,
      l,
      a,
      r,
      !0
    )
  );
}
function Ga(e, t, n, l, a) {
  return Ki(
    St(
      e,
      t,
      n,
      l,
      a,
      !0
    )
  );
}
function Hi(e) {
  return e ? e.__v_isVNode === !0 : !1;
}
function os(e, t) {
  return e.type === t.type && e.key === t.key;
}
const qi = ({ key: e }) => e ?? null, Ls = ({
  ref: e,
  ref_key: t,
  ref_for: n
}) => (typeof e == "number" && (e = "" + e), e != null ? ye(e) || /* @__PURE__ */ Ve(e) || Z(e) ? { i: Qe, r: e, k: t, f: !!n } : e : null);
function s(e, t = null, n = null, l = 0, a = null, r = e === C ? 0 : 1, d = !1, p = !1) {
  const g = {
    __v_isVNode: !0,
    __v_skip: !0,
    type: e,
    props: t,
    key: t && qi(t),
    ref: t && Ls(t),
    scopeId: mi,
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
    shapeFlag: r,
    patchFlag: l,
    dynamicProps: a,
    dynamicChildren: null,
    appContext: null,
    ctx: Qe
  };
  return p ? (el(g, n), r & 128 && e.normalize(g)) : n && (g.shapeFlag |= ye(n) ? 8 : 16), xs > 0 && // avoid a block node from tracking itself
  !d && // has current parent block
  ze && // presence of a patch flag indicates this node needs patching on updates.
  // component nodes also should always be patched, because even if the
  // component doesn't need to update, it needs to persist the instance on to
  // the next vnode so that it can be properly unmounted later.
  (g.patchFlag > 0 || r & 6) && // the EVENTS flag is only for hydration and if it is the only flag, the
  // vnode should not be considered dynamic due to handler caching.
  g.patchFlag !== 32 && ze.push(g), g;
}
const St = Qa;
function Qa(e, t = null, n = null, l = 0, a = null, r = !1) {
  if ((!e || e === xa) && (e = Ot), Hi(e)) {
    const p = ss(
      e,
      t,
      !0
      /* mergeRef: true */
    );
    return n && el(p, n), xs > 0 && !r && ze && (p.shapeFlag & 6 ? ze[ze.indexOf(e)] = p : ze.push(p)), p.patchFlag = -2, p;
  }
  if (ar(e) && (e = e.__vccOpts), t) {
    t = Xa(t);
    let { class: p, style: g } = t;
    p && !ye(p) && (t.class = j(p)), pe(g) && (/* @__PURE__ */ Gn(g) && !Q(g) && (g = $e({}, g)), t.style = tt(g));
  }
  const d = ye(e) ? 1 : Ui(e) ? 128 : ca(e) ? 64 : pe(e) ? 4 : Z(e) ? 2 : 0;
  return s(
    e,
    t,
    n,
    l,
    a,
    d,
    r,
    !0
  );
}
function Xa(e) {
  return e ? /* @__PURE__ */ Gn(e) || Vi(e) ? $e({}, e) : e : null;
}
function ss(e, t, n = !1, l = !1) {
  const { props: a, ref: r, patchFlag: d, children: p, transition: g } = e, k = t ? Ja(a || {}, t) : a, b = {
    __v_isVNode: !0,
    __v_skip: !0,
    type: e.type,
    props: k,
    key: k && qi(k),
    ref: t && t.ref ? (
      // #2078 in the case of <component :is="vnode" ref="extra"/>
      // if the vnode itself already has a ref, cloneVNode will need to merge
      // the refs so the single vnode can be set on multiple refs
      n && r ? Q(r) ? r.concat(Ls(t)) : [r, Ls(t)] : Ls(t)
    ) : r,
    scopeId: e.scopeId,
    slotScopeIds: e.slotScopeIds,
    children: p,
    target: e.target,
    targetStart: e.targetStart,
    targetAnchor: e.targetAnchor,
    staticCount: e.staticCount,
    shapeFlag: e.shapeFlag,
    // if the vnode is cloned with extra props, we can no longer assume its
    // existing patch flag to be reliable and need to add the FULL_PROPS flag.
    // note: preserve flag for fragments since they use the flag for children
    // fast paths only.
    patchFlag: t && e.type !== C ? d === -1 ? 16 : d | 16 : d,
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
    ssContent: e.ssContent && ss(e.ssContent),
    ssFallback: e.ssFallback && ss(e.ssFallback),
    placeholder: e.placeholder,
    el: e.el,
    anchor: e.anchor,
    ctx: e.ctx,
    ce: e.ce
  };
  return g && l && Xn(
    b,
    g.clone(b)
  ), b;
}
function mt(e = " ", t = 0) {
  return St(sn, null, e, t);
}
function Y(e = "", t = !1) {
  return t ? (f(), Ga(Ot, null, e)) : St(Ot, null, e);
}
function dt(e) {
  return e == null || typeof e == "boolean" ? St(Ot) : Q(e) ? St(
    C,
    null,
    // #3666, avoid reference pollution when reusing vnode
    e.slice()
  ) : Hi(e) ? yt(e) : St(sn, null, String(e));
}
function yt(e) {
  return e.el === null && e.patchFlag !== -1 || e.memo ? e : ss(e);
}
function el(e, t) {
  let n = 0;
  const { shapeFlag: l } = e;
  if (t == null)
    t = null;
  else if (Q(t))
    n = 16;
  else if (typeof t == "object")
    if (l & 65) {
      const a = t.default;
      a && (a._c && (a._d = !1), el(e, a()), a._c && (a._d = !0));
      return;
    } else {
      n = 32;
      const a = t._;
      !a && !Vi(t) ? t._ctx = Qe : a === 3 && Qe && (Qe.slots._ === 1 ? t._ = 1 : (t._ = 2, e.patchFlag |= 1024));
    }
  else Z(t) ? (t = { default: t, _ctx: Qe }, n = 32) : (t = String(t), l & 64 ? (n = 16, t = [mt(t)]) : n = 8);
  e.children = t, e.shapeFlag |= n;
}
function Ja(...e) {
  const t = {};
  for (let n = 0; n < e.length; n++) {
    const l = e[n];
    for (const a in l)
      if (a === "class")
        t.class !== l.class && (t.class = j([t.class, l.class]));
      else if (a === "style")
        t.style = tt([t.style, l.style]);
      else if (zs(a)) {
        const r = t[a], d = l[a];
        d && r !== d && !(Q(r) && r.includes(d)) ? t[a] = r ? [].concat(r, d) : d : d == null && r == null && // mergeProps({ 'onUpdate:modelValue': undefined }) should not retain
        // the model listener.
        !Ys(a) && (t[a] = d);
      } else a !== "" && (t[a] = l[a]);
  }
  return t;
}
function rt(e, t, n, l = null) {
  gt(e, t, 7, [
    n,
    l
  ]);
}
const Za = Ti();
let er = 0;
function tr(e, t, n) {
  const l = e.type, a = (t ? t.appContext : e.appContext) || Za, r = {
    uid: er++,
    vnode: e,
    type: l,
    parent: t,
    appContext: a,
    root: null,
    // to be immediately set
    next: null,
    subTree: null,
    // will be set synchronously right after creation
    effect: null,
    update: null,
    // will be set synchronously right after creation
    job: null,
    scope: new So(
      !0
      /* detached */
    ),
    render: null,
    proxy: null,
    exposed: null,
    exposeProxy: null,
    withProxy: null,
    provides: t ? t.provides : Object.create(a.provides),
    ids: t ? t.ids : ["", 0, 0],
    accessCache: null,
    renderCache: [],
    // local resolved assets
    components: null,
    directives: null,
    // resolved props and emits options
    propsOptions: Fi(l, a),
    emitsOptions: Ei(l, a),
    // emit
    emit: null,
    // to be set immediately
    emitted: null,
    // props default value
    propsDefaults: ve,
    // inheritAttrs
    inheritAttrs: l.inheritAttrs,
    // state
    ctx: ve,
    data: ve,
    props: ve,
    attrs: ve,
    slots: ve,
    refs: ve,
    setupState: ve,
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
  return r.ctx = { _: r }, r.root = t ? t.root : r, r.emit = Aa.bind(null, r), e.ce && e.ce(r), r;
}
let je = null;
const sr = () => je || Qe;
let Hs, Vn;
{
  const e = Xs(), t = (n, l) => {
    let a;
    return (a = e[n]) || (a = e[n] = []), a.push(l), (r) => {
      a.length > 1 ? a.forEach((d) => d(r)) : a[0](r);
    };
  };
  Hs = t(
    "__VUE_INSTANCE_SETTERS__",
    (n) => je = n
  ), Vn = t(
    "__VUE_SSR_SETTERS__",
    (n) => ks = n
  );
}
const Ms = (e) => {
  const t = je;
  return Hs(e), e.scope.on(), () => {
    e.scope.off(), Hs(t);
  };
}, Ml = () => {
  je && je.scope.off(), Hs(null);
};
function zi(e) {
  return e.vnode.shapeFlag & 4;
}
let ks = !1;
function nr(e, t = !1, n = !1) {
  t && Vn(t);
  const { props: l, children: a } = e.vnode, r = zi(e);
  Ia(e, l, r, t), Na(e, a, n || t);
  const d = r ? lr(e, t) : void 0;
  return t && Vn(!1), d;
}
function lr(e, t) {
  const n = e.type;
  e.accessCache = /* @__PURE__ */ Object.create(null), e.proxy = new Proxy(e.ctx, ka);
  const { setup: l } = n;
  if (l) {
    wt();
    const a = e.setupContext = l.length > 1 ? or(e) : null, r = Ms(e), d = Cs(
      l,
      e,
      0,
      [
        e.props,
        a
      ]
    ), p = Kl(d);
    if (Ct(), r(), (p || e.sp) && !fs(e) && xi(e), p) {
      if (d.then(Ml, Ml), t)
        return d.then((g) => {
          Pl(e, g);
        }).catch((g) => {
          Zs(g, e, 0);
        });
      e.asyncDep = d;
    } else
      Pl(e, d);
  } else
    Yi(e);
}
function Pl(e, t, n) {
  Z(t) ? e.type.__ssrInlineRender ? e.ssrRender = t : e.render = t : pe(t) && (e.setupState = fi(t)), Yi(e);
}
function Yi(e, t, n) {
  const l = e.type;
  e.render || (e.render = l.render || ft);
  {
    const a = Ms(e);
    wt();
    try {
      Sa(e);
    } finally {
      Ct(), a();
    }
  }
}
const ir = {
  get(e, t) {
    return Oe(e, "get", ""), e[t];
  }
};
function or(e) {
  const t = (n) => {
    e.exposed = n || {};
  };
  return {
    attrs: new Proxy(e.attrs, ir),
    slots: e.slots,
    emit: e.emit,
    expose: t
  };
}
function nn(e) {
  return e.exposed ? e.exposeProxy || (e.exposeProxy = new Proxy(fi(Ko(e.exposed)), {
    get(t, n) {
      if (n in t)
        return t[n];
      if (n in vs)
        return vs[n](e);
    },
    has(t, n) {
      return n in t || n in vs;
    }
  })) : e.proxy;
}
function ar(e) {
  return Z(e) && "__vccOpts" in e;
}
const fe = (e, t) => /* @__PURE__ */ Qo(e, t, ks), rr = "3.5.34";
let $n;
const Rl = typeof window < "u" && window.trustedTypes;
if (Rl)
  try {
    $n = /* @__PURE__ */ Rl.createPolicy("vue", {
      createHTML: (e) => e
    });
  } catch {
  }
const Gi = $n ? (e) => $n.createHTML(e) : (e) => e, cr = "http://www.w3.org/2000/svg", ur = "http://www.w3.org/1998/Math/MathML", bt = typeof document < "u" ? document : null, Tl = bt && /* @__PURE__ */ bt.createElement("template"), dr = {
  insert: (e, t, n) => {
    t.insertBefore(e, n || null);
  },
  remove: (e) => {
    const t = e.parentNode;
    t && t.removeChild(e);
  },
  createElement: (e, t, n, l) => {
    const a = t === "svg" ? bt.createElementNS(cr, e) : t === "mathml" ? bt.createElementNS(ur, e) : n ? bt.createElement(e, { is: n }) : bt.createElement(e);
    return e === "select" && l && l.multiple != null && a.setAttribute("multiple", l.multiple), a;
  },
  createText: (e) => bt.createTextNode(e),
  createComment: (e) => bt.createComment(e),
  setText: (e, t) => {
    e.nodeValue = t;
  },
  setElementText: (e, t) => {
    e.textContent = t;
  },
  parentNode: (e) => e.parentNode,
  nextSibling: (e) => e.nextSibling,
  querySelector: (e) => bt.querySelector(e),
  setScopeId(e, t) {
    e.setAttribute(t, "");
  },
  // __UNSAFE__
  // Reason: innerHTML.
  // Static content here can only come from compiled templates.
  // As long as the user only uses trusted templates, this is safe.
  insertStaticContent(e, t, n, l, a, r) {
    const d = n ? n.previousSibling : t.lastChild;
    if (a && (a === r || a.nextSibling))
      for (; t.insertBefore(a.cloneNode(!0), n), !(a === r || !(a = a.nextSibling)); )
        ;
    else {
      Tl.innerHTML = Gi(
        l === "svg" ? `<svg>${e}</svg>` : l === "mathml" ? `<math>${e}</math>` : e
      );
      const p = Tl.content;
      if (l === "svg" || l === "mathml") {
        const g = p.firstChild;
        for (; g.firstChild; )
          p.appendChild(g.firstChild);
        p.removeChild(g);
      }
      t.insertBefore(p, n);
    }
    return [
      // first
      d ? d.nextSibling : t.firstChild,
      // last
      n ? n.previousSibling : t.lastChild
    ];
  }
}, pr = /* @__PURE__ */ Symbol("_vtc");
function fr(e, t, n) {
  const l = e[pr];
  l && (t = (t ? [t, ...l] : [...l]).join(" ")), t == null ? e.removeAttribute("class") : n ? e.setAttribute("class", t) : e.className = t;
}
const El = /* @__PURE__ */ Symbol("_vod"), vr = /* @__PURE__ */ Symbol("_vsh"), gr = /* @__PURE__ */ Symbol(""), _r = /(?:^|;)\s*display\s*:/;
function hr(e, t, n) {
  const l = e.style, a = ye(n);
  let r = !1;
  if (n && !a) {
    if (t)
      if (ye(t))
        for (const d of t.split(";")) {
          const p = d.slice(0, d.indexOf(":")).trim();
          n[p] == null && rs(l, p, "");
        }
      else
        for (const d in t)
          n[d] == null && rs(l, d, "");
    for (const d in n) {
      d === "display" && (r = !0);
      const p = n[d];
      p != null ? br(
        e,
        d,
        !ye(t) && t ? t[d] : void 0,
        p
      ) || rs(l, d, p) : rs(l, d, "");
    }
  } else if (a) {
    if (t !== n) {
      const d = l[gr];
      d && (n += ";" + d), l.cssText = n, r = _r.test(n);
    }
  } else t && e.removeAttribute("style");
  El in e && (e[El] = r ? l.display : "", e[vr] && (l.display = "none"));
}
const Al = /\s*!important$/;
function rs(e, t, n) {
  if (Q(n))
    n.forEach((l) => rs(e, t, l));
  else if (n == null && (n = ""), t.startsWith("--"))
    e.setProperty(t, n);
  else {
    const l = mr(e, t);
    Al.test(n) ? e.setProperty(
      zt(l),
      n.replace(Al, ""),
      "important"
    ) : e[l] = n;
  }
}
const Dl = ["Webkit", "Moz", "ms"], kn = {};
function mr(e, t) {
  const n = kn[t];
  if (n)
    return n;
  let l = st(t);
  if (l !== "filter" && l in e)
    return kn[t] = l;
  l = zl(l);
  for (let a = 0; a < Dl.length; a++) {
    const r = Dl[a] + l;
    if (r in e)
      return kn[t] = r;
  }
  return t;
}
function br(e, t, n, l) {
  return e.tagName === "TEXTAREA" && (t === "width" || t === "height") && ye(l) && n === l;
}
const Ol = "http://www.w3.org/1999/xlink";
function Vl(e, t, n, l, a, r = xo(t)) {
  l && t.startsWith("xlink:") ? n == null ? e.removeAttributeNS(Ol, t.slice(6, t.length)) : e.setAttributeNS(Ol, t, n) : n == null || r && !Gl(n) ? e.removeAttribute(t) : e.setAttribute(
    t,
    r ? "" : vt(n) ? String(n) : n
  );
}
function $l(e, t, n, l, a) {
  if (t === "innerHTML" || t === "textContent") {
    n != null && (e[t] = t === "innerHTML" ? Gi(n) : n);
    return;
  }
  const r = e.tagName;
  if (t === "value" && r !== "PROGRESS" && // custom elements may use _value internally
  !r.includes("-")) {
    const p = r === "OPTION" ? e.getAttribute("value") || "" : e.value, g = n == null ? (
      // #11647: value should be set as empty string for null and undefined,
      // but <input type="checkbox"> should be set as 'on'.
      e.type === "checkbox" ? "on" : ""
    ) : String(n);
    (p !== g || !("_value" in e)) && (e.value = g), n == null && e.removeAttribute(t), e._value = n;
    return;
  }
  let d = !1;
  if (n === "" || n == null) {
    const p = typeof e[t];
    p === "boolean" ? n = Gl(n) : n == null && p === "string" ? (n = "", d = !0) : p === "number" && (n = 0, d = !0);
  }
  try {
    e[t] = n;
  } catch {
  }
  d && e.removeAttribute(a || t);
}
function Kt(e, t, n, l) {
  e.addEventListener(t, n, l);
}
function yr(e, t, n, l) {
  e.removeEventListener(t, n, l);
}
const Fl = /* @__PURE__ */ Symbol("_vei");
function xr(e, t, n, l, a = null) {
  const r = e[Fl] || (e[Fl] = {}), d = r[t];
  if (l && d)
    d.value = l;
  else {
    const [p, g] = kr(t);
    if (l) {
      const k = r[t] = Cr(
        l,
        a
      );
      Kt(e, p, k, g);
    } else d && (yr(e, p, d, g), r[t] = void 0);
  }
}
const Il = /(?:Once|Passive|Capture)$/;
function kr(e) {
  let t;
  if (Il.test(e)) {
    t = {};
    let l;
    for (; l = e.match(Il); )
      e = e.slice(0, e.length - l[0].length), t[l[0].toLowerCase()] = !0;
  }
  return [e[2] === ":" ? e.slice(3) : zt(e.slice(2)), t];
}
let Sn = 0;
const Sr = /* @__PURE__ */ Promise.resolve(), wr = () => Sn || (Sr.then(() => Sn = 0), Sn = Date.now());
function Cr(e, t) {
  const n = (l) => {
    if (!l._vts)
      l._vts = Date.now();
    else if (l._vts <= n.attached)
      return;
    gt(
      Mr(l, n.value),
      t,
      5,
      [l]
    );
  };
  return n.value = e, n.attached = wr(), n;
}
function Mr(e, t) {
  if (Q(t)) {
    const n = e.stopImmediatePropagation;
    return e.stopImmediatePropagation = () => {
      n.call(e), e._stopped = !0;
    }, t.map(
      (l) => (a) => !a._stopped && l && l(a)
    );
  } else
    return t;
}
const Ll = (e) => e.charCodeAt(0) === 111 && e.charCodeAt(1) === 110 && // lowercase letter
e.charCodeAt(2) > 96 && e.charCodeAt(2) < 123, Pr = (e, t, n, l, a, r) => {
  const d = a === "svg";
  t === "class" ? fr(e, l, d) : t === "style" ? hr(e, n, l) : zs(t) ? Ys(t) || xr(e, t, n, l, r) : (t[0] === "." ? (t = t.slice(1), !0) : t[0] === "^" ? (t = t.slice(1), !1) : Rr(e, t, l, d)) ? ($l(e, t, l), !e.tagName.includes("-") && (t === "value" || t === "checked" || t === "selected") && Vl(e, t, l, d, r, t !== "value")) : /* #11081 force set props for possible async custom element */ e._isVueCE && // #12408 check if it's declared prop or it's async custom element
  (Tr(e, t) || // @ts-expect-error _def is private
  e._def.__asyncLoader && (/[A-Z]/.test(t) || !ye(l))) ? $l(e, st(t), l, r, t) : (t === "true-value" ? e._trueValue = l : t === "false-value" && (e._falseValue = l), Vl(e, t, l, d));
};
function Rr(e, t, n, l) {
  if (l)
    return !!(t === "innerHTML" || t === "textContent" || t in e && Ll(t) && Z(n));
  if (t === "spellcheck" || t === "draggable" || t === "translate" || t === "autocorrect" || t === "sandbox" && e.tagName === "IFRAME" || t === "form" || t === "list" && e.tagName === "INPUT" || t === "type" && e.tagName === "TEXTAREA")
    return !1;
  if (t === "width" || t === "height") {
    const a = e.tagName;
    if (a === "IMG" || a === "VIDEO" || a === "CANVAS" || a === "SOURCE")
      return !1;
  }
  return Ll(t) && ye(n) ? !1 : t in e;
}
function Tr(e, t) {
  const n = (
    // @ts-expect-error _def is private
    e._def.props
  );
  if (!n)
    return !1;
  const l = st(t);
  return Array.isArray(n) ? n.some((a) => st(a) === l) : Object.keys(n).some((a) => st(a) === l);
}
const qs = (e) => {
  const t = e.props["onUpdate:modelValue"] || !1;
  return Q(t) ? (n) => $s(t, n) : t;
};
function Er(e) {
  e.target.composing = !0;
}
function jl(e) {
  const t = e.target;
  t.composing && (t.composing = !1, t.dispatchEvent(new Event("input")));
}
const es = /* @__PURE__ */ Symbol("_assign");
function Bl(e, t, n) {
  return t && (e = e.trim()), n && (e = Nn(e)), e;
}
const Wt = {
  created(e, { modifiers: { lazy: t, trim: n, number: l } }, a) {
    e[es] = qs(a);
    const r = l || a.props && a.props.type === "number";
    Kt(e, t ? "change" : "input", (d) => {
      d.target.composing || e[es](Bl(e.value, n, r));
    }), (n || r) && Kt(e, "change", () => {
      e.value = Bl(e.value, n, r);
    }), t || (Kt(e, "compositionstart", Er), Kt(e, "compositionend", jl), Kt(e, "change", jl));
  },
  // set value on mounted so it's after min/max for type="range"
  mounted(e, { value: t }) {
    e.value = t ?? "";
  },
  beforeUpdate(e, { value: t, oldValue: n, modifiers: { lazy: l, trim: a, number: r } }, d) {
    if (e[es] = qs(d), e.composing) return;
    const p = (r || e.type === "number") && !/^0\d/.test(e.value) ? Nn(e.value) : e.value, g = t ?? "";
    if (p === g)
      return;
    const k = e.getRootNode();
    (k instanceof Document || k instanceof ShadowRoot) && k.activeElement === e && e.type !== "range" && (l && t === n || a && e.value.trim() === g) || (e.value = g);
  }
}, Ar = {
  // #4096 array checkboxes need to be deep traversed
  deep: !0,
  created(e, t, n) {
    e[es] = qs(n), Kt(e, "change", () => {
      const l = e._modelValue, a = Dr(e), r = e.checked, d = e[es];
      if (Q(l)) {
        const p = Ql(l, a), g = p !== -1;
        if (r && !g)
          d(l.concat(a));
        else if (!r && g) {
          const k = [...l];
          k.splice(p, 1), d(k);
        }
      } else if (Gs(l)) {
        const p = new Set(l);
        r ? p.add(a) : p.delete(a), d(p);
      } else
        d(Qi(e, r));
    });
  },
  // set initial checked on mount to wait for true-value/false-value
  mounted: Nl,
  beforeUpdate(e, t, n) {
    e[es] = qs(n), Nl(e, t, n);
  }
};
function Nl(e, { value: t, oldValue: n }, l) {
  e._modelValue = t;
  let a;
  if (Q(t))
    a = Ql(t, l.props.value) > -1;
  else if (Gs(t))
    a = t.has(l.props.value);
  else {
    if (t === n) return;
    a = ws(t, Qi(e, !0));
  }
  e.checked !== a && (e.checked = a);
}
function Dr(e) {
  return "_value" in e ? e._value : e.value;
}
function Qi(e, t) {
  const n = t ? "_trueValue" : "_falseValue";
  return n in e ? e[n] : t;
}
const Or = ["ctrl", "shift", "alt", "meta"], Vr = {
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
  exact: (e, t) => Or.some((n) => e[`${n}Key`] && !t.includes(n))
}, $r = (e, t) => {
  if (!e) return e;
  const n = e._withMods || (e._withMods = {}), l = t.join(".");
  return n[l] || (n[l] = ((a, ...r) => {
    for (let d = 0; d < t.length; d++) {
      const p = Vr[t[d]];
      if (p && p(a, t)) return;
    }
    return e(a, ...r);
  }));
}, Fr = /* @__PURE__ */ $e({ patchProp: Pr }, dr);
let Wl;
function Ir() {
  return Wl || (Wl = Ua(Fr));
}
const Lr = ((...e) => {
  const t = Ir().createApp(...e), { mount: n } = t;
  return t.mount = (l) => {
    const a = Br(l);
    if (!a) return;
    const r = t._component;
    !Z(r) && !r.render && !r.template && (r.template = a.innerHTML), a.nodeType === 1 && (a.textContent = "");
    const d = n(a, !1, jr(a));
    return a instanceof Element && (a.removeAttribute("v-cloak"), a.setAttribute("data-v-app", "")), d;
  }, t;
});
function jr(e) {
  if (e instanceof SVGElement)
    return "svg";
  if (typeof MathMLElement == "function" && e instanceof MathMLElement)
    return "mathml";
}
function Br(e) {
  return ye(e) ? document.querySelector(e) : e;
}
function X() {
  return typeof window < "u" && window.openxnetApp || null;
}
const be = {
  snapshot: null,
  loading: !1,
  request: null,
  error: null,
  progress: {},
  unsubscribe: null
}, Nr = [
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
function Vt() {
  return typeof window < "u" && window.openxnetDesktop || null;
}
function Wr() {
  const e = Vt();
  be.unsubscribe || !e?.onFeaturePackProgress || (be.unsubscribe = e.onFeaturePackProgress((t) => {
    t?.capabilityId && (be.progress = {
      ...be.progress,
      [t.capabilityId]: { ...t }
    }, t.phase === "failed" && t.error && (be.error = { ...t.error }));
  }));
}
async function ln(e = !0) {
  const t = Vt();
  return t?.listFeaturePacks ? (Wr(), be.request || (be.loading = !0, be.request = t.listFeaturePacks({ refresh: !!e }).then((n) => (be.snapshot = n, be.error = n?.error || null, n)).catch((n) => (be.error = {
    code: "FEATURE_PACK_OPERATION_FAILED",
    message: String(n?.message || "Feature Pack state could not be loaded."),
    retryable: !0
  }, null)).finally(() => {
    be.loading = !1, be.request = null;
  })), be.request) : null;
}
async function Ur(e, t) {
  const n = Vt(), a = {
    install: n?.installFeaturePack,
    repair: n?.repairFeaturePack,
    uninstall: n?.uninstallFeaturePack
  }[e];
  if (typeof a != "function") return null;
  be.error = null, be.progress = {
    ...be.progress,
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
    return await a.call(n, { capabilityId: t });
  } catch (r) {
    throw be.error = {
      code: "FEATURE_PACK_OPERATION_FAILED",
      message: String(r?.message || "Feature Pack operation failed."),
      retryable: !0
    }, r;
  } finally {
    await ln(!1);
  }
}
function Kr(e) {
  const t = be.snapshot, n = new Map((t?.packs || []).map((l) => [l.capabilityId, l]));
  return {
    available: !!Vt()?.listFeaturePacks,
    loading: be.loading,
    feedStatus: t?.feedStatus || (Vt() ? "loading" : "unavailable"),
    catalogGeneratedAt: t?.catalogGeneratedAt || null,
    error: be.error || t?.error || null,
    items: Nr.map((l) => {
      const a = n.get(l.capabilityId) || {};
      return {
        ...a,
        capabilityId: l.capabilityId,
        icon: l.icon,
        displayName: e ? l.nameZh : l.nameEn,
        description: e ? l.descriptionZh : l.descriptionEn,
        status: a.status || "not-installed",
        installedVersion: a.installedVersion || null,
        availableVersion: a.availableVersion || null,
        operation: a.operation || null,
        progress: be.progress[l.capabilityId] || null
      };
    })
  };
}
function tl(e) {
  if (e && typeof e.isCurrentLanguageZh == "function")
    try {
      return !!e.isCurrentLanguageZh();
    } catch {
      return !0;
    }
  return String(e?.currentLanguage || navigator.language || "zh-CN").toLowerCase().startsWith("zh");
}
function sl(e, t, n) {
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
function D(e) {
  return Array.isArray(e) ? e : [];
}
function Dt(e, t = 140) {
  const n = String(e || "").trim();
  return n.length <= t ? n : `${n.slice(0, t - 1)}...`;
}
function _s(e) {
  if (!e) return "";
  try {
    const t = new Date(e);
    return Number.isNaN(t.getTime()) ? String(e) : t.toLocaleString();
  } catch {
    return String(e);
  }
}
function Ps(e) {
  return D(e).map((t) => ({
    label: String(t?.label || ""),
    value: String(t?.value ?? ""),
    meta: String(t?.meta || ""),
    emphasis: !!t?.emphasis,
    truncate: !!t?.truncate
  }));
}
function et(e, t) {
  return e ? t ? "已启用" : "Enabled" : t ? "未启用" : "Disabled";
}
function ht(e, t, n = "运行中", l = "Running") {
  return e ? t ? n : l : t ? "待启动" : "Standby";
}
function Hr(e) {
  return e ? "true" : "false";
}
function Xi(e, t, n = "") {
  const l = String(t || "").trim();
  if (!l) return String(n || "");
  if (e && typeof e.t == "function")
    try {
      const a = e.t(l);
      if (a && a !== l)
        return String(a);
    } catch {
    }
  return String(n || l);
}
function wn(e, t, n = "") {
  if (typeof t == "string")
    return { value: t, label: n || t };
  const l = String(t?.value ?? t?.id ?? t?.key ?? "").trim(), a = t?.label ?? t?.name ?? t?.title ?? l;
  return {
    value: l,
    label: Xi(e, a, n || a || l),
    description: String(t?.description || t?.desc || ""),
    icon: String(t?.icon || "")
  };
}
function qr(e) {
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
function zr(e, t) {
  const n = D(e?.deployTiles).map((r) => ({
    id: String(r?.id || ""),
    icon: String(r?.icon || "fa-solid fa-circle"),
    label: sl(e, r, t)
  })), l = String(e?.subMenu || n[0]?.id || "table_pet"), a = e?.getPrototypeDeployDetailMeta?.(l) || {
    title: t ? "部署机器人" : "Deploy Bots",
    summary: t ? "配置多平台机器人连接、权限和消息路由。" : "Configure multi-platform bot connections, permissions, and message routing.",
    chips: []
  };
  return {
    title: t ? "部署机器人" : "Deploy Bots",
    subtitle: t ? "配置多平台机器人连接、权限和消息路由" : "Configure multi-platform bot connections, permissions, and message routing.",
    tabs: n,
    activeTab: l,
    meta: a,
    stats: Ps(e?.getPrototypeDeployDetailStats?.(l)),
    deskPet: {
      online: !!(e?.isVRMRunning || e?.vrmOnline),
      status: ht(!!(e?.isVRMRunning || e?.vrmOnline), t, "桌宠在线", "Online"),
      modelId: String(e?.VRMConfig?.selectedModelId || e?.VRMConfig?.name || (t ? "未选择模型" : "No model")),
      expressions: et(!!e?.VRMConfig?.enabledExpressions, t),
      motions: et(!!e?.VRMConfig?.enabledMotions, t),
      width: Number(e?.VRMConfig?.windowWidth || 540),
      height: Number(e?.VRMConfig?.windowHeight || 960),
      userModels: D(e?.VRMConfig?.userModels).length,
      motionCount: D(e?.VRMConfig?.selectedMotionIds).length
    },
    imChannels: [
      {
        id: "qq",
        label: "QQ",
        running: !!e?.isQQBotRunning,
        status: ht(!!e?.isQQBotRunning, t),
        agent: String(e?.qqBotConfig?.QQAgent || "openxnet-model"),
        memory: `${Number(e?.qqBotConfig?.memoryLimit || 30)} ${t ? "轮记忆" : "turns"}`,
        note: `${D(e?.qqBotConfig?.separators).length} ${t ? "个分隔符" : "separators"}`
      },
      {
        id: "feishu",
        label: t ? "飞书" : "Feishu",
        running: !!e?.isFeishuBotRunning,
        status: ht(!!e?.isFeishuBotRunning, t),
        agent: String(e?.feishuBotConfig?.FeishuAgent || "openxnet-model"),
        memory: `${Number(e?.feishuBotConfig?.memoryLimit || 30)} ${t ? "轮记忆" : "turns"}`,
        note: et(!!e?.feishuBotConfig?.enableTTS, t)
      },
      {
        id: "dingtalk",
        label: t ? "钉钉" : "DingTalk",
        running: !!e?.isDingtalkBotRunning,
        status: ht(!!e?.isDingtalkBotRunning, t),
        agent: String(e?.dingtalkBotConfig?.DingtalkAgent || "openxnet-model"),
        memory: `${Number(e?.dingtalkBotConfig?.memoryLimit || 30)} ${t ? "轮记忆" : "turns"}`,
        note: et(!!e?.dingtalkBotConfig?.enableTTS, t)
      },
      {
        id: "telegram",
        label: "Telegram",
        running: !!e?.isTelegramBotRunning,
        status: ht(!!e?.isTelegramBotRunning, t),
        agent: String(e?.telegramBotConfig?.TelegramAgent || "openxnet-model"),
        memory: `${Number(e?.telegramBotConfig?.memoryLimit || 20)} ${t ? "轮记忆" : "turns"}`,
        note: et(!!e?.telegramBotConfig?.enableTTS, t)
      },
      {
        id: "discord",
        label: "Discord",
        running: !!e?.isDiscordBotRunning,
        status: ht(!!e?.isDiscordBotRunning, t),
        agent: String(e?.discordBotConfig?.llm_model || "openxnet-model"),
        memory: `${Number(e?.discordBotConfig?.memory_limit || 30)} ${t ? "轮记忆" : "turns"}`,
        note: et(!!e?.discordBotConfig?.enable_tts, t)
      },
      {
        id: "slack",
        label: "Slack",
        running: !!e?.isSlackBotRunning,
        status: ht(!!e?.isSlackBotRunning, t),
        agent: String(e?.slackBotConfig?.llm_model || "openxnet-model"),
        memory: `${Number(e?.slackBotConfig?.memory_limit || 30)} ${t ? "轮记忆" : "turns"}`,
        note: et(!!e?.slackBotConfig?.enable_tts, t)
      }
    ],
    liveChannels: [
      {
        id: "bilibili",
        label: "Bilibili",
        enabled: !!e?.liveConfig?.bilibili_enabled,
        status: et(!!e?.liveConfig?.bilibili_enabled, t),
        note: String(e?.liveConfig?.bilibili_room_id || (t ? "未填写房间号" : "No room id"))
      },
      {
        id: "youtube",
        label: "YouTube",
        enabled: !!e?.liveConfig?.youtube_enabled,
        status: et(!!e?.liveConfig?.youtube_enabled, t),
        note: String(e?.liveConfig?.youtube_vedio_id || (t ? "未填写视频 ID" : "No video id"))
      },
      {
        id: "twitch",
        label: "Twitch",
        enabled: !!e?.liveConfig?.twitch_enabled,
        status: et(!!e?.liveConfig?.twitch_enabled, t),
        note: String(e?.liveConfig?.twitch_channel || (t ? "未填写频道" : "No channel"))
      }
    ],
    liveStrategy: {
      runtime: ht(!!e?.isLiveRunning, t, "直播中", "Live"),
      danmakuOnly: Hr(!!e?.liveConfig?.onlyDanmaku),
      queueLimit: Number(e?.liveConfig?.danmakuQueueLimit || 5),
      wakeWord: String(e?.liveConfig?.wakeWord || (t ? "未设置唤醒词" : "No wake word")),
      obsUrl: `${String(e?.partyURL || "").replace(/\/$/, "")}/vrm.html?mode=render`
    },
    readBot: {
      runtime: ht(!!e?.isReadRunning, t, "朗读中", "Reading"),
      selectedFile: (() => {
        const r = D(e?.textFiles).find((d) => String(d?.unique_filename || "") === String(e?.selectedFile || ""));
        return String(r?.original_filename || r?.unique_filename || (t ? "未选择文件" : "No file selected"));
      })(),
      segments: D(e?.readConfig?.longTextList).length,
      preview: Dt(e?.readConfig?.longText || (t ? "当前还没有载入朗读内容。" : "No reading content is loaded yet."), 140),
      audioState: e?.readState?.isPlaying ? t ? "播放中" : "Playing" : t ? "待播放" : "Idle"
    },
    translateBot: {
      runtime: String(e?.targetLangSelected || (t ? "系统默认" : "system")),
      sourceLength: String(e?.sourceText || "").length,
      targetLength: String(e?.translatedText || "").length,
      busy: !!e?.isTranslating,
      sourcePreview: Dt(e?.sourceText || (t ? "还没有待翻译内容。" : "No source text yet."), 180),
      resultPreview: Dt(e?.translatedText || (t ? "翻译结果会显示在这里。" : "Translated output will appear here."), 180)
    },
    generalConfig: {
      mediaHostEnabled: et(!!e?.BotConfig?.imgHost_enabled, t),
      mediaHost: String(e?.BotConfig?.imgHost || "smms"),
      easyImage: String(e?.BotConfig?.EI2_base_url || (t ? "未配置 EasyImage2 地址" : "No EasyImage2 URL")),
      githubRepo: [e?.BotConfig?.github_repo_owner, e?.BotConfig?.github_repo_name].filter(Boolean).join("/") || (t ? "未配置 GitHub 仓库" : "No GitHub repository"),
      giteeRepo: [e?.BotConfig?.gitee_repo_owner, e?.BotConfig?.gitee_repo_name].filter(Boolean).join("/") || (t ? "未配置 Gitee 仓库" : "No Gitee repository")
    }
  };
}
function Yr(e, t) {
  const n = D(e?.apiTiles).map((F) => ({
    id: String(F?.id || ""),
    icon: String(F?.icon || "fa-solid fa-circle"),
    label: sl(e, F, t)
  })), l = String(e?.subMenu || "develop"), a = e?.getPrototypeApiDetailMeta?.(l) || {
    title: t ? "开发者工作台" : "Developer Workbench",
    summary: t ? "统一查看 API 接入、开发流与本地工作区状态。" : "Review API routes, workflows, and local workspace status in one place.",
    chips: []
  }, r = D(e?.devWorkbenchOverview?.configuration_readiness?.items).map((F) => ({
    id: String(F?.id || F?.label || ""),
    label: e?.formatDevReadinessLabel?.(F?.id) || String(F?.label || ""),
    status: e?.formatDevReadinessStatus?.(F?.status) || String(F?.status || ""),
    note: String(F?.note || F?.summary || "")
  })), d = D(e?.devWorkbenchOverview?.recent_dev_tasks || e?.recent_dev_tasks || []).map((F) => ({
    id: String(F?.task_id || F?.id || ""),
    title: String(F?.title || F?.goal || (t ? "未命名开发任务" : "Untitled developer task")),
    status: String(F?.status || ""),
    workflow: e?.formatDevWorkflowKind?.(F?.workflow_kind) || String(F?.workflow_kind || ""),
    updatedAt: _s(F?.updated_at || F?.created_at || F?.timestamp || "")
  })), p = e?.devWorkbenchOverview || {}, g = p.runtime_profile || {}, k = p.configuration_assistant || {}, b = k.provider_setup || {}, S = k.gateway_provider_setup || {}, O = k.mapping_setup || {}, L = k.workspace_setup || {}, J = p.task_stats || {}, U = p.capability_summary || {}, ie = p.workflow_support || {};
  return {
    title: t ? "开发者 · 工作台" : "Developer Workbench",
    subtitle: t ? "API 接口、智能体管理与开发者工具" : "API routes, agent management, and developer tools",
    tabs: n,
    activeTab: l,
    meta: a,
    stats: Ps(e?.getPrototypeApiDetailStats?.(l)),
    topStats: [
      {
        label: t ? "运行 Profile" : "Runtime Profile",
        value: String(g.profile || "desktop"),
        note: String(g.app_name || "OpenXnet"),
        emphasis: !0
      },
      {
        label: t ? "接入就绪度" : "Readiness",
        value: String(p.configuration_readiness?.overall_status || (t ? "未检查" : "unchecked")),
        note: String(p.configuration_readiness?.next_step || (t ? "检查 provider / 工作区状态" : "Check provider and workspace state"))
      },
      {
        label: t ? "开发任务" : "Developer Tasks",
        value: String(J.developer || 0),
        note: `${J.running || 0} ${t ? "个运行中" : "running"} · ${J.resumable || 0} ${t ? "个可恢复" : "resumable"}`
      },
      {
        label: t ? "插件与模板" : "Plugins & Templates",
        value: String(p.plugin_count || 0),
        note: `${D(p.templates).length} ${t ? "个模板" : "templates"}`
      }
    ],
    readiness: r,
    warnings: D(e?.devWorkbenchOverview?.warnings),
    templates: D(e?.devWorkbenchOverview?.templates).map((F) => ({
      id: String(F?.id || ""),
      title: String(F?.label || F?.title || F?.id || ""),
      summary: String(F?.summary || ""),
      suggestedGoal: String(F?.suggested_goal || "")
    })),
    recentTasks: d,
    providerCard: {
      status: String(b.status || ""),
      message: String(b.message || ""),
      vendor: String(e?.devWorkbenchProviderDraft?.vendor || b.current_vendor || ""),
      url: String(e?.devWorkbenchProviderDraft?.url || b.current_base_url || ""),
      model: String(e?.devWorkbenchProviderDraft?.model_id || b.current_model || ""),
      providerCount: D(b.provider_options).length,
      apiKeyConfigured: !!b.api_key_configured,
      validationStatus: String(e?.devWorkbenchProviderValidation?.status || ""),
      validationMessage: String(e?.devWorkbenchProviderValidation?.message || "")
    },
    gatewayCard: {
      enabled: !!S.enabled,
      reachable: !!S.reachable,
      status: String(S.status || ""),
      message: String(S.message || ""),
      vendor: String(e?.devWorkbenchGatewayProviderDraft?.vendor || S.current_vendor || ""),
      url: String(e?.devWorkbenchGatewayProviderDraft?.url || S.current_base_url || ""),
      model: String(e?.devWorkbenchGatewayProviderDraft?.model_id || S.current_model || ""),
      providerCount: D(S.provider_options).length,
      apiKeyConfigured: !!S.api_key_configured,
      managementUrl: String(S.management_url || "")
    },
    mappingCard: {
      status: String(O.status || ""),
      message: String(O.message || ""),
      agent: String(e?.devWorkbenchMappingDraft?.agent_id || O.current_main_agent || ""),
      resolvedModel: String(O.resolved_model || ""),
      currentModel: String(O.current_model || ""),
      resolutionSource: String(O.resolution_source || ""),
      providerModelCount: D(O.provider_models).length,
      agentCount: D(O.agent_options).length
    },
    workspaceCard: {
      status: String(L.status || ""),
      message: String(L.message || ""),
      path: String(e?.devWorkbenchWorkspaceDraft?.workspace_dir || L.workspace_dir || L.recommended_workspace_dir || ""),
      exists: !!L.workspace_exists,
      engine: String(e?.devWorkbenchWorkspaceDraft?.engine || L.engine || "local"),
      permissionMode: String(e?.devWorkbenchWorkspaceDraft?.permission_mode || L.permission_mode || "default"),
      visibilityScope: String(e?.devWorkbenchWorkspaceDraft?.visibility_scope || L.visibility_scope || "workspace"),
      recommendedReason: String(L.recommended_reason || "")
    },
    capabilitySummary: Object.entries(U).map(([F, G]) => ({
      id: F,
      label: e?.formatDevCapabilityLabel?.(F) || F,
      enabled: !!G
    })),
    workflowSupport: Object.entries(ie).filter(([F]) => !["write_enabled", "collaboration"].includes(F)).map(([F, G]) => ({
      id: F,
      label: e?.formatDevWorkflowKind?.(F) || F,
      enabled: !!G
    }))
  };
}
const Gr = [
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
function Qr(e, t) {
  const n = String(e?.enterpriseTab || "usage"), l = Gr.map((x) => ({
    ...x,
    label: e?.getPrototypeEnterpriseTitle?.(x.id) || x.id
  })), a = e?.usageData?.summary || {}, r = D(e?.usageData?.trend).slice().reverse().slice(0, 8).map((x, N) => ({
    id: `${x?.period || "trend"}-${N}`,
    label: String(x?.period || "").slice(-5) || `#${N + 1}`,
    value: Number(x?.total_tokens || 0)
  })), d = D(e?.usageData?.models).slice(0, 6).map((x, N) => ({
    id: `${x?.model || "model"}-${N}`,
    name: x?.model || t ? "未命名模型" : "Unnamed model",
    requests: Number(x?.requests || 0),
    tokens: Number(x?.total_tokens || 0),
    cost: Number(x?.cost || 0)
  })), p = D(e?.usageData?.users).slice(0, 6).map((x, N) => ({
    id: `${x?.user_id || "user"}-${N}`,
    name: x?.user_id || t ? "未命名用户" : "Unknown user",
    requests: Number(x?.requests || 0),
    tokens: Number(x?.total_tokens || 0),
    latency: Math.round(Number(x?.avg_duration_ms || 0))
  })), g = e?.neuroData?.stats || {}, k = D(e?.neuroData?.symbols).slice(0, 8).map((x, N) => ({
    id: String(x?.id || `symbol-${N}`),
    operator: String(x?.operator || "-"),
    label: x?.label || t ? "未命名符号" : "Unnamed symbol",
    entities: D(x?.K?.entities).slice(0, 4),
    successRate: Number(x?.successRate || 0),
    activations: Number(x?.activationCount || 0)
  })), b = D(e?.neuroData?.rules).slice(0, 6).map((x, N) => ({
    id: String(x?.id || `rule-${N}`),
    name: x?.name || t ? "未命名规则" : "Unnamed rule",
    domain: String(x?.domain || "-"),
    enabled: !!x?.enabled,
    description: String(x?.description || "")
  })), S = e?.kgData?.stats || {}, O = D(e?.kgData?.entityFacts).slice(0, 8).map((x, N) => ({
    id: `fact-${N}`,
    subject: String(x?.subject || x?.source || "-"),
    predicate: String(x?.predicate || x?.label || "-"),
    object: String(x?.object || x?.target || "-")
  })), L = D(e?.enterpriseKBs).map((x, N) => ({
    id: String(x?.id || `kb-${N}`),
    name: String(x?.name || (t ? "未命名知识库" : "Unnamed KB")),
    category: String(x?.category || (t ? "未分类" : "Uncategorized")),
    docs: Number(x?.doc_count || 0),
    description: String(x?.description || ""),
    updatedAt: _s(x?.updated_at || x?.created_at || "")
  })), J = D(e?.enterpriseRoleCards || e?.staffRoles), U = J.map((x, N) => ({
    id: String(x?.id || `role-${N}`),
    name: String(x?.name || (t ? "未命名角色" : "Unnamed role")),
    department: String(x?.department || (t ? "未分配部门" : "Unassigned")),
    workspaceId: String(x?.assignedWorkspace || ""),
    workspace: e?.getEnterpriseWorkspaceNameById?.(x?.assignedWorkspace) || String(x?.assignedWorkspace || ""),
    skills: D(x?.skills).slice(0, 6),
    summary: String(x?.summaryZh || x?.summaryEn || x?.description || x?.system_prompt || ""),
    icon: String(x?.icon || "fa-solid fa-user-tie"),
    enabled: x?.enabled !== !1,
    templateId: String(x?.templateId || ""),
    category: String(x?.category || ""),
    categoryLabel: String(
      t ? x?.categoryZh || x?.categoryEn || x?.category || "未分类" : x?.categoryEn || x?.categoryZh || x?.category || "Uncategorized"
    ),
    accent: D(x?.accent).slice(0, 2)
  })).sort((x, N) => x.enabled !== N.enabled ? x.enabled ? -1 : 1 : String(x.name || "").localeCompare(String(N.name || ""), "zh-Hans-CN")), ie = Object.entries(e?.staffRoleTemplates || {}).map(([x, N]) => ({
    id: x,
    name: String(N?.name || x),
    department: String(N?.department || ""),
    summary: String(N?.summaryZh || N?.summaryEn || ""),
    skills: D(N?.skills).slice(0, 6),
    icon: String(N?.icon || "fa-solid fa-user-tie"),
    category: String(N?.category || ""),
    categoryLabel: String(
      t ? N?.categoryZh || N?.categoryEn || N?.category || "未分类" : N?.categoryEn || N?.categoryZh || N?.category || "Uncategorized"
    ),
    categoryZh: String(N?.categoryZh || ""),
    categoryEn: String(N?.categoryEn || ""),
    featured: !!N?.featured,
    priority: Number(N?.priority || 0),
    accent: D(N?.accent).slice(0, 2)
  })).sort((x, N) => x.featured !== N.featured ? x.featured ? -1 : 1 : Number(N.priority || 0) - Number(x.priority || 0)), F = D(e?.enterpriseWorkspaces).map((x, N) => {
    const ae = String(x?.id || "");
    return {
      id: ae || `ws-${N}`,
      name: x?.name || t ? "未命名工作空间" : "Unnamed workspace",
      type: e?.getEnterpriseWorkspaceTypeLabel?.(x) || String(x?.type || "-"),
      permission: String(x?.permission || "default"),
      projectCount: D(e?.enterpriseProjects).filter((ge) => String(ge?.workspaceId || "") === ae).length,
      roleCount: D(e?.staffRoles || e?.enterpriseRoleCards).filter((ge) => String(ge?.assignedWorkspace || "") === ae).length,
      summary: e?.describeEnterpriseWorkspace?.(x) || String(x?.path || x?.host || "-"),
      path: String(x?.path || x?.host || "-"),
      updatedAt: _s(x?.updatedAt || x?.createdAt || "")
    };
  }), G = String(e?.sandboxCurrentWs || ""), te = String(e?.sandboxCurrentProject || ""), K = String(e?.selected3DAgent?.id || ""), ne = D(e?.enterpriseWorkspaces).find((x) => String(x?.id || "") === G) || null, Me = D(e?.enterpriseProjects).find((x) => String(x?.id || "") === te) || null, Pe = D(e?.enterpriseProjects).filter((x) => !G || String(x?.workspaceId || "") === G).map((x, N) => ({
    id: String(x?.id || `project-${N}`),
    name: String(x?.name || (t ? "未命名项目" : "Untitled project")),
    workspaceId: String(x?.workspaceId || ""),
    workspace: e?.getEnterpriseWorkspaceNameById?.(x?.workspaceId) || "",
    color: String(x?.color || "#4ecdc4"),
    icon: String(x?.icon || "fa-solid fa-folder"),
    description: String(x?.description || ""),
    floor: Number(x?.floor || N + 1)
  })), Be = new Map(
    J.map((x) => [String(x?.id || "").trim(), x])
  ), H = D(e?.sandboxAgents).map((x, N) => {
    const ae = Be.get(String(x?.id || "").trim()) || null;
    return {
      id: String(x?.id || `agent-${N}`),
      name: String(x?.name || x?.agent_name || ae?.name || (t ? "未命名智能体" : "Unnamed agent")),
      role: String(x?.role || x?.department || ae?.department || "-"),
      department: String(x?.department || x?.role || ae?.department || "-"),
      status: String(x?.status || (t ? "未知" : "unknown")),
      workspaceId: String(x?.workspaceId || ae?.assignedWorkspace || ""),
      workspace: String(x?.workspace_name || e?.getEnterpriseWorkspaceNameById?.(x?.workspaceId || ae?.assignedWorkspace) || x?.workspaceId || ae?.assignedWorkspace || ""),
      projectId: String(x?.projectId || ae?.projectId || ""),
      project: String(x?.project_name || x?.projectId || ae?.projectId || ""),
      icon: String(x?.icon || ae?.icon || "fa-solid fa-user-tie"),
      skills: D(x?.skills || ae?.skills).slice(0, 6),
      summary: String(x?.summary || ae?.summaryZh || ae?.summaryEn || ae?.description || ae?.system_prompt || ""),
      enabled: ae?.enabled !== !1
    };
  }).filter((x) => te ? String(x?.projectId || "") === te : G ? String(x?.workspaceId || "") === G : !0), xe = [];
  xe.push({
    id: "root",
    level: 0,
    label: t ? "企业园区" : "Enterprise Campus"
  }), ne && xe.push({
    id: ne.id,
    level: 1,
    label: ne.name
  }), Me && xe.push({
    id: Me.id,
    level: 2,
    label: Me.name
  });
  const Ne = ["dataops", "mlops", "aiops"].map((x) => {
    const N = e?.xnetServices?.[x] || {};
    return {
      id: x,
      title: String(N?.name || x),
      status: String(N?.status || "offline"),
      url: String(N?.url || ""),
      autoConnect: !!N?.auto_connect,
      lastCheck: _s(N?.last_check || "")
    };
  });
  return {
    title: t ? "企业空间" : "Enterprise Space",
    subtitle: t ? "统一沉淀企业知识、角色、工作区与运营指标" : "Unify enterprise knowledge, roles, workspaces, and operating signals",
    tabs: l,
    activeTab: n,
    meta: e?.getPrototypeEnterpriseDetailMeta?.(n) || { title: "", summary: "", chips: [] },
    stats: Ps(e?.getPrototypeEnterpriseDetailStats?.(n)),
    topStats: [
      {
        title: t ? "总请求量" : "Requests",
        value: String(a.total_requests || 0),
        note: t ? "当前企业视图累计请求" : "Total requests inside the enterprise view"
      },
      {
        title: t ? "知识库文档" : "KB Docs",
        value: String(e?.enterpriseKBTotalDocs || 0),
        note: `${D(e?.enterpriseKBs).length} ${t ? "个知识库" : "knowledge bases"}`
      },
      {
        title: t ? "角色卡" : "Role Cards",
        value: String(J.length),
        note: `${D(e?.enterpriseWorkspaces).length} ${t ? "个工作空间" : "workspaces"}`
      },
      {
        title: t ? "沙盘智能体" : "Sandbox Agents",
        value: String(D(e?.sandboxAgents).length),
        note: `${D(e?.enterpriseSkills).length} ${t ? "个企业技能" : "enterprise skills"}`
      }
    ],
    overviewCards: [
      {
        title: t ? "知识库" : "Knowledge Bases",
        value: String(D(e?.enterpriseKBs).length),
        note: t ? "企业级共享知识与文档空间" : "Shared enterprise knowledge and docs"
      },
      {
        title: t ? "员工角色卡" : "Staff Roles",
        value: String(J.length),
        note: t ? "沉淀可复用的企业 AI 岗位能力" : "Reusable enterprise AI role templates"
      },
      {
        title: t ? "工作空间" : "Workspaces",
        value: String(D(e?.enterpriseWorkspaces).length),
        note: t ? "按项目或团队隔离资源边界" : "Project or team level resource boundaries"
      },
      {
        title: t ? "沙盘智能体" : "Sandbox Agents",
        value: String(D(e?.sandboxAgents).length),
        note: t ? "试运行、演练与隔离实验空间" : "Dry runs, drills, and isolated experiments"
      }
    ],
    usagePanel: {
      metrics: [
        { label: t ? "请求" : "Requests", value: String(a.total_requests || 0) },
        { label: t ? "总 Tokens" : "Tokens", value: String(e?.formatNumber?.(a.total_tokens || 0) || a.total_tokens || 0) },
        { label: t ? "输入" : "Input", value: String(e?.formatNumber?.(a.total_input || 0) || a.total_input || 0) },
        { label: t ? "输出" : "Output", value: String(e?.formatNumber?.(a.total_output || 0) || a.total_output || 0) },
        { label: t ? "缓存命中" : "Cache Hit", value: String(e?.formatNumber?.(a.total_cache_read || 0) || a.total_cache_read || 0) },
        { label: t ? "总成本" : "Cost", value: `$${Number(a.total_cost || 0).toFixed(4)}` }
      ],
      trend: r,
      models: d,
      users: p
    },
    neuroPanel: {
      metrics: [
        { label: t ? "符号总数" : "Symbols", value: String(g.totalSymbols || e?.neuroData?.total || 0) },
        { label: t ? "实体数" : "Entities", value: String(g.uniqueEntities || 0) },
        { label: t ? "平均成功率" : "Success Rate", value: `${(Number(g.avgSuccessRate || 0) * 100).toFixed(1)}%` },
        { label: t ? "运算符类型" : "Operators", value: String(Object.keys(g.operatorDistribution || {}).length) }
      ],
      symbols: k,
      rules: b
    },
    kgPanel: {
      metrics: [
        { label: t ? "实体" : "Entities", value: String(S.entities || D(e?.kgData?.graph?.nodes).length || 0) },
        { label: t ? "三元组" : "Triples", value: String(S.triples || 0) },
        { label: t ? "节点" : "Nodes", value: String(D(e?.kgData?.graph?.nodes).length || 0) },
        { label: t ? "边" : "Edges", value: String(D(e?.kgData?.graph?.edges).length || 0) }
      ],
      facts: O
    },
    knowledgePanel: {
      totalDocs: Number(e?.enterpriseKBTotalDocs || 0),
      totalCount: L.length,
      items: L
    },
    rolePanel: {
      templateCount: ie.length,
      createdCount: U.length,
      enabledCount: U.filter((x) => x.enabled).length,
      items: U,
      templates: ie
    },
    workspacePanel: {
      totalCount: F.length,
      items: F
    },
    sandboxPanel: {
      level: Number(e?.sandboxLevel || 0),
      levelLabel: Number(e?.sandboxLevel || 0) === 0 ? t ? "企业园区" : "Enterprise Campus" : Number(e?.sandboxLevel || 0) === 1 ? t ? "工作空间层" : "Workspace Layer" : t ? "项目楼层" : "Project Floor",
      currentWorkspaceId: G,
      currentWorkspace: String(ne?.name || G || ""),
      currentProjectId: te,
      currentProject: String(Me?.name || te || ""),
      selectedAgentId: K,
      breadcrumb: xe,
      workspaceCount: F.length,
      projectCount: Pe.length,
      roleCount: H.length,
      workspaces: F.slice(0, 8),
      projects: Pe.slice(0, 8),
      items: H
    },
    xnetPanel: {
      items: Ne
    }
  };
}
function Xr(e, t) {
  const n = D(e?.storageTiles).map((p) => ({
    id: String(p?.id || ""),
    icon: String(p?.icon || "fa-solid fa-circle"),
    label: sl(e, p, t)
  })), l = String(e?.subMenu || "text"), a = D(e?.textFiles).slice(0, 8).map((p, g) => ({
    id: String(p?.id || p?.path || `text-${g}`),
    name: String(p?.original_filename || p?.unique_filename || p?.name || (t ? "未命名文件" : "Untitled file")),
    ext: e?.getPrototypeStorageFileExtension?.(p) || "",
    size: e?.getPrototypeStorageFileDisplaySize?.(p) || "",
    time: e?.getPrototypeStorageFileDisplayTime?.(p) || ""
  })), r = D(e?.imageFiles).slice(0, 6).map((p, g) => ({
    id: String(p?.id || p?.path || `image-${g}`),
    name: String(p?.original_filename || p?.unique_filename || p?.name || (t ? "未命名图片" : "Untitled image")),
    size: e?.getPrototypeStorageFileDisplaySize?.(p) || ""
  })), d = D(e?.recallResults).slice(0, 6).map((p, g) => ({
    id: String(p?.task_id || p?.id || `recall-${g}`),
    title: Dt(p?.title || p?.summary || p?.query || (t ? "续接任务" : "Recall item"), 56),
    note: Dt(p?.content || p?.description || p?.source || "", 80)
  }));
  return {
    title: t ? "存储管理" : "Storage Manager",
    subtitle: t ? "统一管理文本、图片、视频和续接素材" : "Manage text, images, videos, and recall assets together",
    tabs: n,
    activeTab: l,
    meta: e?.getPrototypeStorageDetailMeta?.(l) || { title: "", summary: "", chips: [] },
    stats: Ps(e?.getPrototypeStorageDetailStats?.(l)),
    overviewStats: D(e?.getPrototypeStorageOverviewStats?.()),
    textFiles: a,
    imageFiles: r,
    videoFiles: [
      { id: "video-1", name: "product-demo.mp4", size: "128 MB", duration: "04:32" },
      { id: "video-2", name: "training-session.mov", size: "1.2 GB", duration: "45:08" },
      { id: "video-3", name: "bug-repro.webm", size: "45 MB", duration: "02:47" }
    ],
    recallItems: d
  };
}
function Jr(e, t) {
  const n = String(e?.kernelConsoleTab || "overview"), l = [
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
    tabs: l,
    activeTab: n,
    metrics: D(e?.getKernelConsoleMetrics?.()),
    runtimeRows: D(e?.getKernelConsoleRuntimeRows?.()),
    profileRows: D(e?.getKernelConsoleProfileRows?.()),
    boardItems: D(e?.getKernelConsoleBoardItems?.()),
    actions: D(e?.getKernelConsoleVisibleActions?.()).slice(0, 8).map((a) => ({
      id: String(a?.id || a?.task_id || a?.created_at || Math.random()),
      title: String(a?.title || a?.summary || a?.task || (t ? "内核动作" : "Kernel action")),
      type: e?.getKernelConsoleActionLabel?.(a?.type || a?.action_type || "") || String(a?.type || a?.action_type || ""),
      status: e?.getKernelConsoleActionStatusLabel?.(a) || String(a?.status || ""),
      next: e?.getKernelConsoleActionNextLabel?.(a) || ""
    })),
    updatedLabel: e?.getKernelConsoleUpdatedLabel?.() || ""
  };
}
function Zr(e, t) {
  const n = D(e?.getPrototypeSystemTabs?.()).map((p) => ({
    id: String(p?.id || ""),
    icon: String(p?.icon || "fa-solid fa-circle"),
    label: String(p?.label || p?.id || "")
  }));
  n.some((p) => p.id === "feature-packs") || n.splice(Math.max(0, n.length - 1), 0, {
    id: "feature-packs",
    icon: "fa-solid fa-cubes",
    label: t ? "功能包" : "Feature Packs"
  });
  const l = String(e?.prototypeSystemTab || "general"), a = D(e?.themeOptions).length ? D(e?.themeOptions).map((p) => wn(e, p)) : D(e?.themeValues).map((p) => ({
    value: String(p),
    label: typeof e?.getPrototypeThemeLabel == "function" ? e.getPrototypeThemeLabel(p) : Xi(e, `theme.${p}`, String(p))
  })), r = D(e?.networkOptions).map((p) => wn(e, p)), d = D(e?.systemlanguageOptions).map((p) => wn(e, p));
  return {
    title: t ? "系统设置" : "System Settings",
    subtitle: t ? "统一管理外观、网络、快捷键、更新内容与运行维护配置" : "Manage appearance, network, shortcuts, update content, and runtime maintenance settings",
    tabs: n,
    activeTab: l,
    stats: Ps(e?.getPrototypeSystemStats?.()),
    currentMeta: l === "feature-packs" ? {
      heading: t ? "功能包管理" : "Feature Pack Management",
      summary: t ? "按需安装独立运行时，并验证发布签名与文件完整性。" : "Install optional runtimes on demand with release signature and file integrity verification."
    } : e?.getPrototypeSystemTabMeta?.(l) || { heading: "", summary: "" },
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
    languageOptions: d.length ? d : [
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
    themeOptions: a,
    networkOptions: r.length ? r : [
      { value: "local", label: t ? "本机可见" : "Local only" },
      { value: "global", label: t ? "局域网可见" : "LAN visible" }
    ],
    proxyOptions: [
      { value: "system", label: t ? "系统代理" : "System proxy" },
      { value: "manual", label: t ? "手动代理" : "Manual proxy" },
      { value: "none", label: t ? "不使用代理" : "No proxy" }
    ],
    shortcutRows: D(e?.getPrototypeShortcutRows?.()),
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
    updateEntries: D(e?.getPrototypeSystemUpdateEntries?.()),
    featurePacks: Kr(t)
  };
}
function ec(e, t) {
  const n = D(e?.getPrototypeTaskBoardColumns?.()).map((a) => ({
    id: String(a?.id || ""),
    title: String(a?.title || ""),
    emptyTitle: String(a?.emptyTitle || ""),
    emptyCopy: String(a?.emptyCopy || ""),
    tasks: D(a?.tasks).map((r) => ({
      raw: r,
      id: String(r?.task_id || r?.id || Math.random()),
      title: String(r?.title || r?.goal || (t ? "未命名任务" : "Untitled task")),
      summary: Dt(r?.description || r?.goal || r?.context?.goal || "", 96),
      status: String(r?.status || ""),
      updatedAt: _s(r?.updated_at || r?.created_at || r?.timestamp || ""),
      progress: Number.isFinite(Number(r?.progress)) ? Number(r.progress) : null,
      assignee: String(r?.agent_name || r?.owner || r?.agent_type || "")
    }))
  })), l = e?.viewingTaskDetail || null;
  return {
    title: t ? "任务中心" : "Task Center",
    subtitle: t ? "查看待处理、进行中和已完成任务，并继续推进关键工作" : "Track pending, running, and completed tasks and keep work moving",
    columns: n,
    detail: l ? {
      title: String(l?.title || l?.goal || (t ? "任务详情" : "Task Detail")),
      status: String(l?.status || ""),
      summary: Dt(l?.description || l?.goal || "", 160),
      trace: D(l?.recent_trace_excerpt || l?.execution_trace).slice(0, 6).map((a, r) => ({
        id: `${l?.task_id || "detail"}-${r}`,
        text: Dt(typeof a == "string" ? a : a?.message || a?.summary || JSON.stringify(a), 120)
      }))
    } : null
  };
}
function tc(e, t) {
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
function sc(e, t) {
  const n = e?.VRMConfig || {}, l = (H, xe, Ne = {}) => ({
    id: String(H?.id || ""),
    name: String(H?.name || H?.id || ""),
    path: String(H?.path || ""),
    builtin: xe,
    cloud: !!H?.cloud || String(H?.source || "") === "cloud",
    source: String(H?.source || (xe ? "packaged" : "user")),
    downloaded: H?.downloaded !== !1,
    downloadable: !!H?.downloadable,
    remoteUrl: String(H?.remoteUrl || ""),
    relativePath: String(H?.relativePath || ""),
    ...Ne
  }), a = D(n.defaultModels).map((H) => ({
    ...l(H, !0, { downloaded: !0, downloadable: !1 })
  })), r = D(n.cloudModels).map((H) => {
    const xe = !!H?.downloaded;
    return l(H, !1, {
      cloud: !0,
      downloaded: xe,
      downloadable: !xe,
      source: "cloud"
    });
  }), d = D(n.userModels).map((H) => l(H, !1)), p = [...a, ...d], g = String(
    (n.name && n.name !== "default" ? n.selectedNewModelId : n.selectedModelId) || n.selectedModelId || p[0]?.id || ""
  ), k = p.find((H) => H.id === g) || p[0] || null, b = D(n.defaultMotions).map((H) => ({
    id: String(H?.id || ""),
    name: String(H?.name || H?.id || ""),
    builtin: !0
  })), S = D(n.userMotions).map((H) => ({
    id: String(H?.id || ""),
    name: String(H?.name || H?.id || ""),
    builtin: !1
  })), O = [...b, ...S], L = new Set(D(n.selectedMotionIds).map((H) => String(H))), J = O.map((H) => ({
    ...H,
    selected: L.has(H.id)
  })), U = String(e?.partyURL || "").replace(/\/$/, ""), ie = new URLSearchParams({ mode: "embed" });
  g && ie.set("model", g);
  const F = Array.from(L).sort().join(",");
  F && ie.set("motions", F);
  const G = [
    g || "none",
    F || "no-motion",
    n.enabledExpressions ? "expr-on" : "expr-off",
    n.enabledMotions ? "motion-on" : "motion-off"
  ].join("|"), te = U ? `${U}/vrm.html?${ie.toString()}` : "", K = !!e?.isVRMRunning, ne = !!e?.isVRMStarting, Me = !!e?.isVRMStopping, Pe = String(e?.mainAgent || "super-model"), Be = e?.agents && typeof e.agents == "object" ? e.agents : {}, it = [
    {
      id: "super-model",
      name: t ? "跟随当前主模型" : "Follow current main model"
    },
    ...Object.entries(Be).map(([H, xe]) => ({
      id: String(H),
      name: String(xe?.name || H)
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
          text: t ? `当前模型 ${k?.name || "未选择"}` : `Current model: ${k?.name || "None"}`
        },
        {
          icon: "fa-solid fa-person-running",
          text: t ? `${J.filter((H) => H.selected).length} 个动作已启用` : `${J.filter((H) => H.selected).length} motions enabled`
        }
      ]
    },
    stats: [
      {
        label: t ? "运行状态" : "Status",
        value: K ? t ? "运行中" : "Running" : t ? "已停止" : "Stopped",
        meta: t ? "桌宠窗口的当前活动状态。" : "Current activity of the desktop pet window.",
        emphasis: K
      },
      {
        label: t ? "当前模型" : "Current Model",
        value: k?.name || (t ? "未选择" : "None"),
        meta: `${a.length} ${t ? "内置 + " : "built-in + "}${r.length} ${t ? "资源包 + " : "cloud + "}${d.length} ${t ? "自定义" : "custom"}`,
        truncate: !0
      },
      {
        label: t ? "动作" : "Motions",
        value: `${J.filter((H) => H.selected).length} / ${O.length}`,
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
      selectedModel: k,
      models: p,
      defaultModels: a,
      cloudModels: r,
      userModels: d,
      remoteResourceBaseUrl: String(n.remoteResourceBaseUrl || ""),
      motions: J,
      selectedMotionIds: Array.from(L),
      enabledExpressions: !!n.enabledExpressions,
      enabledMotions: !!n.enabledMotions,
      windowWidth: Number(n.windowWidth || 540),
      windowHeight: Number(n.windowHeight || 960),
      running: K,
      starting: ne,
      stopping: Me,
      mainAgent: Pe,
      agentOptions: it,
      previewUrl: te,
      previewKey: G,
      partyURL: U,
      isElectron: !!e?.isElectron
    }
  };
}
function nc(e) {
  const t = X(), n = tl(t), l = qr(e), a = {
    surface: e,
    surfaceMenu: l,
    activeMenu: String(t?.activeMenu || ""),
    isZh: n,
    isActive: String(t?.activeMenu || "") === l
  };
  switch (e) {
    case "deploy":
      return { ...a, ...zr(t, n) };
    case "vrm":
      return { ...a, ...sc(t, n) };
    case "workbench":
      return { ...a, ...Yr(t, n) };
    case "enterprise":
      return { ...a, ...Qr(t, n) };
    case "storage":
      return { ...a, ...Xr(t, n) };
    case "kernel":
      return { ...a, ...Jr(t, n) };
    case "system":
      return { ...a, ...Zr(t, n) };
    case "task":
      return { ...a, ...ec(t, n) };
    case "about":
      return { ...a, ...tc(t, n) };
    default:
      return a;
  }
}
async function Fn(e) {
  e === "system" && await ln(!0);
  const t = X();
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
        typeof t.switchStorageTile == "function" && await t.switchStorageTile(t.subMenu || "text");
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
async function lc(e, t) {
  const n = X();
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
        typeof n.switchStorageTile == "function" ? await n.switchStorageTile(t) : n.subMenu = t;
        break;
      case "kernel":
        typeof n.openKernelTab == "function" ? await n.openKernelTab(t) : n.kernelConsoleTab = t;
        break;
      case "system":
        t === "feature-packs" ? n.prototypeSystemTab = t : typeof n.setPrototypeSystemTab == "function" ? n.setPrototypeSystemTab(t) : n.prototypeSystemTab = t;
        break;
    }
}
async function ic(e) {
  const t = X();
  if (t)
    switch (e) {
      case "deploy":
        typeof t.refreshPrototypeDeployStatus == "function" && await t.refreshPrototypeDeployStatus(t.subMenu || "table_pet");
        break;
      case "vrm":
        await Fn(e);
        break;
      case "workbench":
        typeof t.loadDevWorkbench == "function" && await t.loadDevWorkbench();
        break;
      case "enterprise":
        typeof t.refreshPrototypeEnterpriseStatus == "function" && await t.refreshPrototypeEnterpriseStatus(t.enterpriseTab || "usage");
        break;
      case "storage":
        await Fn(e);
        break;
      case "kernel":
        typeof t.loadKernelConsole == "function" && await t.loadKernelConsole();
        break;
      case "system":
        typeof t.refreshPrototypeSystemStatus == "function" && await t.refreshPrototypeSystemStatus(), await ln(!0);
        break;
      case "task":
        typeof t.fetchTasks == "function" && await t.fetchTasks();
        break;
    }
}
async function oc() {
  const e = X();
  !e || typeof e.checkForUpdates != "function" || await e.checkForUpdates({ silent: !1 });
}
async function ac() {
  const e = X();
  !e || typeof e.handleSelect != "function" || await e.handleSelect("logo");
}
async function hs(e) {
  e && typeof e.autoSaveSettings == "function" && await e.autoSaveSettings();
}
async function Ji(e) {
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
async function rc(e, t) {
  const n = X();
  if (!n) return;
  (!n.systemSettings || typeof n.systemSettings != "object") && (n.systemSettings = {});
  const l = String(e || "").trim();
  if (!l) return;
  const r = (/* @__PURE__ */ new Set(["launchAtStartup", "startMinimized"])).has(l) ? !!t : String(t ?? "");
  if (l === "language" && typeof n.handleSystemLanguageChange == "function") {
    await n.handleSystemLanguageChange(r);
    return;
  }
  if (l === "theme" && typeof n.handleThemeChange == "function") {
    await n.handleThemeChange(r);
    return;
  }
  if (l === "network") {
    if (n.isElectron && typeof window < "u" && window.electronAPI?.setNetworkVisibility && typeof n.handleNetworkChange == "function") {
      await n.handleNetworkChange(r);
      return;
    }
    n.systemSettings.network = r, await hs(n);
    return;
  }
  if (n.systemSettings[l] = r, l === "proxyMode" || l === "proxy") {
    typeof n.updateProxy == "function" ? await n.updateProxy() : (await hs(n), n.isElectron || await fetch("/api/update_proxy", { method: "POST" }).catch(() => null));
    return;
  }
  await hs(n), (l === "launchAtStartup" || l === "startMinimized") && await Ji(n);
}
async function cc(e) {
  const t = X();
  t && (t.targetLangSelected = String(e || "system"), typeof t.changeLanguage == "function" ? t.changeLanguage() : await hs(t));
}
async function uc() {
  const e = X();
  e && typeof e.clearPrototypeRuntimeCache == "function" && await e.clearPrototypeRuntimeCache();
}
async function dc(e) {
  const t = X();
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
async function pc(e) {
  const t = X();
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
async function fc() {
  const e = X();
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
  }, e.targetLangSelected = "system", typeof e.handleSystemLanguageChange == "function" && await e.handleSystemLanguageChange("auto"), typeof e.handleThemeChange == "function" && await e.handleThemeChange("party"), await hs(e), await Ji(e), typeof e.updateProxy == "function" ? await e.updateProxy() : e.isElectron || await fetch("/api/update_proxy", { method: "POST" }).catch(() => null), js(tl(e) ? "系统设置已恢复默认值" : "System settings reset to defaults", "success"));
}
async function vc() {
  const e = X();
  e && typeof e.ensureDeployBotReady == "function" && await e.ensureDeployBotReady("live_stream");
}
async function gc() {
  const e = X();
  e && typeof e.startVRM == "function" && await e.startVRM();
}
async function _c() {
  const e = X();
  e && typeof e.startVRMweb == "function" && await e.startVRMweb();
}
async function hc(e) {
  const t = X();
  if (!t || !t.VRMConfig) return;
  const n = String(e || "");
  t.VRMConfig.name = "default", t.VRMConfig.selectedModelId = n, t.VRMConfig.selectedNewModelId = n, typeof t.saveVRMConfig == "function" ? await t.saveVRMConfig() : typeof t.handleModelChange == "function" ? await t.handleModelChange(n) : typeof t.autoSaveSettings == "function" && await t.autoSaveSettings();
}
function js(e, t = "info") {
  typeof window < "u" && typeof window.showNotification == "function" && window.showNotification(e, t);
}
async function mc(e) {
  const t = X();
  if (!t || !t.VRMConfig) return null;
  const n = tl(t), l = String(e || "");
  if (!l) return null;
  js(n ? "开始下载 VRM 模型..." : "Downloading VRM model...", "info");
  let a;
  if (t.isElectron) {
    if (typeof window.openxnetDesktop?.downloadApplicationCloudVrmModel != "function")
      throw new Error("Desktop VR Asset Runtime is unavailable.");
    const d = await window.openxnetDesktop.downloadApplicationCloudVrmModel({ modelId: l });
    a = { success: d.success, model: d.asset }, typeof t.invalidateApplicationVrAssetCatalog == "function" && t.invalidateApplicationVrAssetCatalog();
  } else {
    const d = await fetch(`/download_vrm_model/${encodeURIComponent(l)}`, {
      method: "POST"
    });
    if (a = await d.json().catch(() => ({})), !d.ok || !a?.success) {
      const p = a?.message || `Download failed (${d.status})`;
      throw js(p, "error"), new Error(p);
    }
  }
  const r = a.model || null;
  if (r?.id) {
    Array.isArray(t.VRMConfig.userModels) || (t.VRMConfig.userModels = []);
    const d = t.VRMConfig.userModels.findIndex((p) => String(p?.id || "") === String(r.id));
    d >= 0 ? t.VRMConfig.userModels.splice(d, 1, r) : t.VRMConfig.userModels.push(r), t.VRMConfig.selectedModelId = String(r.id), t.VRMConfig.selectedNewModelId = String(r.id), Array.isArray(t.VRMConfig.cloudModels) && (t.VRMConfig.cloudModels = t.VRMConfig.cloudModels.map((p) => String(p?.id || "") === String(r.id) ? { ...p, downloaded: !0, downloadable: !1, path: r.path } : p)), typeof t.saveVRMConfig == "function" ? await t.saveVRMConfig() : typeof t.autoSaveSettings == "function" && await t.autoSaveSettings();
  }
  return typeof t.loadDefaultModels == "function" && await t.loadDefaultModels(), js(n ? "VRM 模型已下载并选中" : "VRM model downloaded and selected", "success"), a;
}
async function bc(e) {
  const t = X();
  if (!t || !t.VRMConfig) return;
  Array.isArray(t.VRMConfig.selectedMotionIds) || (t.VRMConfig.selectedMotionIds = []);
  const n = t.VRMConfig.selectedMotionIds, l = n.indexOf(e);
  l === -1 ? n.push(e) : n.splice(l, 1), typeof t.handleMotionChange == "function" ? await t.handleMotionChange() : typeof t.autoSaveSettings == "function" && await t.autoSaveSettings();
}
async function yc(e) {
  const t = X();
  !t || !t.VRMConfig || (t.VRMConfig.enabledExpressions = !!e, typeof t.autoSaveSettings == "function" && await t.autoSaveSettings());
}
async function xc(e) {
  const t = X();
  !t || !t.VRMConfig || (t.VRMConfig.enabledMotions = !!e, typeof t.autoSaveSettings == "function" && await t.autoSaveSettings());
}
async function kc(e) {
  const t = X();
  if (!t || !t.VRMConfig) return;
  const n = Number(e);
  Number.isFinite(n) && (t.VRMConfig.windowWidth = Math.max(300, Math.min(3840, Math.floor(n))), typeof t.autoSaveSettings == "function" && await t.autoSaveSettings());
}
async function Sc(e) {
  const t = X();
  if (!t || !t.VRMConfig) return;
  const n = Number(e);
  Number.isFinite(n) && (t.VRMConfig.windowHeight = Math.max(300, Math.min(3840, Math.floor(n))), typeof t.autoSaveSettings == "function" && await t.autoSaveSettings());
}
async function wc(e) {
  const t = X();
  t && (t.mainAgent = String(e || "super-model"), typeof t.autoSaveSettings == "function" && await t.autoSaveSettings());
}
async function Cc() {
  const e = X();
  e && (e.showVrmModelDialog = !0);
}
async function Mc() {
  const e = X();
  e && (e.showVrmaMotionDialog = !0);
}
async function Pc(e) {
  const t = X();
  t && typeof t.deleteModelOption == "function" && (await t.deleteModelOption(e), typeof t.loadDefaultModels == "function" && await t.loadDefaultModels());
}
async function Rc(e) {
  const t = X();
  t && typeof t.deleteMotionOption == "function" && await t.deleteMotionOption(e);
}
async function Tc() {
  const e = X();
  e && (typeof e.openTaskCenter == "function" ? e.openTaskCenter() : e.activeMenu = "task-center");
}
async function Ec(e) {
  const t = X();
  !t || !e || typeof t.openTaskDetailView == "function" && await t.openTaskDetailView(e);
}
async function Ac(e, t = "") {
  const n = X();
  n && (typeof n.handleSelect == "function" ? await n.handleSelect(e) : n.activeMenu = e, t && (e === "enterprise" ? n.enterpriseTab = t : e === "kernel" ? n.kernelConsoleTab = t : n.subMenu = t));
}
async function Zi(e = "") {
  const t = X();
  if (!t) return;
  const n = String(e || "").trim(), l = n && D(t?.enterpriseRoleCards || t?.staffRoles).find((a) => String(a?.id || "") === n) || null;
  if (typeof t.openStaffRoleForm == "function") {
    t.openStaffRoleForm(l || null);
    return;
  }
  typeof t.createEmptyStaffRoleDraft == "function" && (t.newStaffRole = t.createEmptyStaffRoleDraft({ department: "" })), t.newSkillInput = "", t.showStaffRoleForm = !0;
}
async function Dc(e) {
  const t = X();
  if (t) {
    if (typeof t.createStaffFromTemplate == "function") {
      t.createStaffFromTemplate(e);
      return;
    }
    await Zi();
  }
}
async function Oc(e) {
  const t = X();
  if (!(!t || !e)) {
    if (typeof t.removeStaffRole == "function") {
      await t.removeStaffRole(e);
      return;
    }
    typeof t.deleteRoleCard == "function" && await t.deleteRoleCard(e);
  }
}
async function Vc(e = "") {
  const t = X();
  if (!t) return;
  const n = String(e || "").trim(), l = n && D(t?.enterpriseWorkspaces).find((a) => String(a?.id || "") === n) || null;
  if (typeof t.openWorkspaceForm == "function") {
    t.openWorkspaceForm(l || null);
    return;
  }
  t.showWorkspaceForm = !0;
}
async function $c(e) {
  const t = X();
  if (!(!t || !e)) {
    if (typeof t.openEnterpriseWorkspace == "function") {
      await t.openEnterpriseWorkspace(e);
      return;
    }
    typeof t.openEnterpriseTab == "function" ? await t.openEnterpriseTab("enterprise-sandbox") : t.enterpriseTab = "enterprise-sandbox", t.sandboxLevel = 1, t.sandboxCurrentWs = e;
  }
}
async function Fc(e) {
  const t = X();
  !t || !e || typeof t.removeWorkspace == "function" && await t.removeWorkspace(e);
}
async function Ic(e = "", t = "") {
  const n = X();
  if (!n) return;
  const l = String(t || "").trim(), a = l && D(n?.enterpriseProjects).find((r) => String(r?.id || "") === l) || null;
  if (typeof n.openProjectForm == "function") {
    n.openProjectForm(a || null, String(e || n.sandboxCurrentWs || ""));
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
async function Lc(e) {
  const t = X();
  !t || !e || typeof t.removeProject == "function" && await t.removeProject(e);
}
async function jc(e) {
  const t = X();
  if (!t || !e) return;
  const n = D(t?.enterpriseProjects).find((l) => String(l?.id || "") === String(e || "")) || null;
  n && (typeof t.openEnterpriseTab == "function" ? await t.openEnterpriseTab("enterprise-sandbox") : t.enterpriseTab = "enterprise-sandbox", t.sandboxLevel = 2, t.sandboxCurrentWs = String(n.workspaceId || t.sandboxCurrentWs || ""), t.sandboxCurrentProject = String(n.id || ""), t.selected3DAgent = null, t.enterprise3DScene && typeof t.enterprise3DScene.showFloorView == "function" && (t.enterprise3DScene.showFloorView(n.id), typeof t.enterprise3DScene.resize == "function" && t.enterprise3DScene.resize()));
}
async function Bc(e = 0, t = "") {
  const n = X();
  if (!n) return;
  const l = Math.max(0, Math.min(2, Number(e || 0)));
  if (l === 0) {
    n.sandboxLevel = 0, n.sandboxCurrentWs = null, n.sandboxCurrentProject = null, n.selected3DAgent = null, n.enterprise3DScene && typeof n.enterprise3DScene.showCityView == "function" && (n.enterprise3DScene.showCityView(), typeof n.enterprise3DScene.resize == "function" && n.enterprise3DScene.resize());
    return;
  }
  if (l === 1) {
    const d = String(t || n.sandboxCurrentWs || "").trim();
    if (!d) return;
    n.sandboxLevel = 1, n.sandboxCurrentWs = d, n.sandboxCurrentProject = null, n.selected3DAgent = null, n.enterprise3DScene && typeof n.enterprise3DScene.showBuildingView == "function" && (n.enterprise3DScene.showBuildingView(d), typeof n.enterprise3DScene.resize == "function" && n.enterprise3DScene.resize());
    return;
  }
  const a = String(t || n.sandboxCurrentProject || "").trim(), r = D(n?.enterpriseProjects).find((d) => String(d?.id || "") === a) || null;
  r && (n.sandboxLevel = 2, n.sandboxCurrentWs = String(r.workspaceId || n.sandboxCurrentWs || "").trim(), n.sandboxCurrentProject = String(r.id || "").trim(), n.selected3DAgent = null, n.enterprise3DScene && typeof n.enterprise3DScene.showFloorView == "function" && (n.enterprise3DScene.showFloorView(r.id), typeof n.enterprise3DScene.resize == "function" && n.enterprise3DScene.resize()));
}
async function Nc(e) {
  const t = X();
  if (!t || !e) return;
  const n = D(t?.sandboxAgents).find((l) => String(l?.id || "") === String(e || "")) || D(t?.staffRoles).find((l) => String(l?.id || "") === String(e || "")) || null;
  if (n) {
    if (t.selected3DAgent = n, typeof t.onAgent3DDblClick == "function") {
      t.onAgent3DDblClick(n);
      return;
    }
    t.showSandboxChatPanel = !0;
  }
}
async function Wc(e = "", t = "") {
  const n = X();
  n && (typeof n.createEmptyStaffRoleDraft == "function" && (n.newStaffRole = n.createEmptyStaffRoleDraft({
    department: "",
    assignedWorkspace: String(e || n.sandboxCurrentWs || ""),
    projectId: String(t || n.sandboxCurrentProject || "")
  })), n.newSkillInput = "", n.enterprise3DScene && n.enterprise3DScene._isFullscreen ? n.showSandboxFloatPanel = !0 : n.showStaffRoleForm = !0);
}
async function Uc() {
  const e = X();
  if (e) {
    if (typeof e.sandboxGoBack == "function") {
      e.sandboxGoBack();
      return;
    }
    e.sandboxLevel = Math.max(0, Number(e.sandboxLevel || 0) - 1);
  }
}
async function Kc(e = {}) {
  const t = X();
  if (!t) return !1;
  const n = String(e?.id || "").trim(), l = {
    name: String(e?.name || "").trim(),
    description: String(e?.description || "").trim(),
    category: String(e?.category || "").trim()
  };
  if (typeof t.saveEnterpriseKnowledgeBaseRecord == "function")
    await t.saveEnterpriseKnowledgeBaseRecord({ ...l, ...n ? { id: n } : {} });
  else {
    if (Vt())
      throw new Error("Desktop Enterprise host bridge is unavailable.");
    const a = n ? "PUT" : "POST", r = n ? `/v1/enterprise/knowledge-bases/${n}` : "/v1/enterprise/knowledge-bases", d = await fetch(r, {
      method: a,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(l)
    });
    if (!d.ok) {
      const p = await d.json().catch(() => ({}));
      throw new Error(p?.error || `Failed to save KB (${d.status})`);
    }
  }
  return typeof t.loadEnterpriseKBs == "function" && await t.loadEnterpriseKBs(), !0;
}
async function Hc(e) {
  const t = X();
  if (!(!t || !e)) {
    if (typeof t.removeEnterpriseKnowledgeBaseRecord == "function")
      await t.removeEnterpriseKnowledgeBaseRecord(e);
    else {
      if (Vt())
        throw new Error("Desktop Enterprise host bridge is unavailable.");
      const n = await fetch(`/v1/enterprise/knowledge-bases/${e}`, {
        method: "DELETE"
      });
      if (!n.ok) {
        const l = await n.json().catch(() => ({}));
        throw new Error(l?.error || `Failed to delete KB (${n.status})`);
      }
    }
    typeof t.loadEnterpriseKBs == "function" && await t.loadEnterpriseKBs();
  }
}
async function qc(e) {
  if (!e) return [];
  const t = X();
  if (typeof t?.loadEnterpriseKnowledgeBaseVersionRecords == "function")
    return t.loadEnterpriseKnowledgeBaseVersionRecords(e);
  if (Vt())
    throw new Error("Desktop Enterprise host bridge is unavailable.");
  const n = await fetch(`/v1/enterprise/knowledge-bases/${e}/versions`);
  if (!n.ok)
    throw new Error(`Failed to load versions (${n.status})`);
  const l = await n.json();
  return Array.isArray(l?.versions) ? l.versions : [];
}
function zc() {
  return {
    snapshot: nc,
    ensureLoaded: Fn,
    selectSurfaceTab: lc,
    refreshSurface: ic,
    runSystemUpdateCheck: oc,
    openAboutSurface: ac,
    updateSystemSetting: rc,
    setSystemTargetLanguage: cc,
    clearSystemRuntimeCache: uc,
    runSystemQuickAction: dc,
    openSystemPath: pc,
    resetSystemSettings: fc,
    loadFeaturePacks: ln,
    runFeaturePackOperation: Ur,
    startPrimaryDeployAction: vc,
    openTaskCenter: Tc,
    openTask: Ec,
    jumpToMenu: Ac,
    // VRM actions
    startVrm: gc,
    startVrmWeb: _c,
    setVrmModel: hc,
    downloadVrmModel: mc,
    toggleVrmMotion: bc,
    setVrmExpressionsEnabled: yc,
    setVrmMotionsEnabled: xc,
    setVrmWindowWidth: kc,
    setVrmWindowHeight: Sc,
    setVrmAgent: wc,
    openAddVrmModel: Cc,
    openAddVrmMotion: Mc,
    deleteVrmUserModel: Pc,
    deleteVrmUserMotion: Rc,
    openEnterpriseStaffRoleForm: Zi,
    createEnterpriseStaffRoleFromTemplate: Dc,
    deleteEnterpriseStaffRole: Oc,
    openEnterpriseWorkspaceForm: Vc,
    openEnterpriseWorkspace: $c,
    deleteEnterpriseWorkspace: Fc,
    openEnterpriseProjectForm: Ic,
    deleteEnterpriseProject: Lc,
    openEnterpriseProject: jc,
    navigateEnterpriseSandbox: Bc,
    openEnterpriseSandboxAgentChat: Nc,
    openEnterpriseStaffRoleForProject: Wc,
    sandboxGoBack: Uc,
    saveEnterpriseKnowledgeBase: Kc,
    deleteEnterpriseKnowledgeBase: Hc,
    loadEnterpriseKnowledgeBaseVersions: qc
  };
}
const Yc = { class: "ox-vite-ops-header" }, Gc = { class: "ox-vite-ops-header__kicker" }, Qc = { class: "ox-vite-ops-header__actions" }, Xc = { class: "ox-vite-task-shell" }, Jc = { class: "ox-vite-task-board" }, Zc = { class: "ox-vite-task-column__head" }, eu = {
  key: 0,
  class: "ox-vite-task-empty"
}, tu = ["onClick"], su = { class: "ox-vite-task-card__title" }, nu = { class: "ox-vite-task-card__summary" }, lu = {
  key: 0,
  class: "ox-vite-task-progress"
}, iu = { class: "ox-vite-task-card__meta" }, ou = { class: "ox-vite-task-detail" }, au = { class: "ox-vite-task-detail__head" }, ru = { class: "ox-vite-task-detail__title" }, cu = { class: "ox-vite-detail-chip" }, uu = { class: "ox-vite-task-detail__summary" }, du = { class: "ox-vite-task-detail__trace" }, pu = {
  key: 1,
  class: "ox-vite-empty-state"
}, fu = {
  key: 1,
  class: "ox-vite-about-shell"
}, vu = { class: "ox-vite-about-name" }, gu = { class: "ox-vite-detail-chip" }, _u = { class: "ox-vite-about-copy" }, hu = { class: "ox-vite-about-grid" }, mu = { class: "ox-vite-info-card__icon" }, bu = { class: "ox-vite-link-grid" }, yu = ["href"], xu = { class: "ox-vite-fact-list" }, ku = {
  key: 2,
  class: "ox-vite-vrm-layout"
}, Su = { class: "ox-vite-vrm-config" }, wu = { class: "ox-vite-vrm-topbar" }, Cu = { class: "ox-vite-vrm-topbar__title" }, Mu = { class: "ox-vite-ops-header__kicker" }, Pu = {
  key: 0,
  class: "ox-vite-vrm-guide"
}, Ru = { class: "ox-vite-vrm-guide__note" }, Tu = { class: "ox-vite-vrm-guide__steps" }, Eu = { class: "ox-vite-vrm-guide__step-index" }, Au = { class: "ox-vite-vrm-guide__step-copy" }, Du = {
  key: 0,
  class: "ox-vite-vrm-chips"
}, Ou = {
  key: 1,
  class: "ox-vite-vrm-statgrid"
}, Vu = { class: "ox-vite-panel-card" }, $u = { class: "ox-vite-panel-card__head" }, Fu = { class: "ox-vite-vrm-tabs" }, Iu = { class: "ox-vite-vrm-tab__count" }, Lu = { class: "ox-vite-vrm-tab__count" }, ju = { class: "ox-vite-vrm-tab__count" }, Bu = { class: "ox-vite-vrm-search" }, Nu = ["placeholder"], Wu = { class: "ox-vite-vrm-list" }, Uu = ["disabled", "onClick"], Ku = { class: "ox-vite-vrm-row__icon" }, Hu = { class: "ox-vite-vrm-row__main" }, qu = { class: "ox-vite-vrm-row__name" }, zu = { class: "ox-vite-vrm-row__sub" }, Yu = {
  key: 0,
  class: "fa-solid fa-circle-check ox-vite-vrm-row__check"
}, Gu = ["onClick"], Qu = ["title", "onClick"], Xu = {
  key: 0,
  class: "ox-vite-vrm-empty"
}, Ju = { key: 0 }, Zu = { key: 1 }, ed = { key: 2 }, td = { key: 3 }, sd = { class: "ox-vite-panel-card" }, nd = { class: "ox-vite-panel-card__head" }, ld = { class: "ox-vite-form-grid" }, id = { class: "ox-vite-field" }, od = ["value"], ad = ["value"], rd = { class: "ox-vite-field" }, cd = { class: "ox-vite-vrm-toggle" }, ud = ["checked"], dd = { class: "ox-vite-field" }, pd = { class: "ox-vite-vrm-toggle" }, fd = ["checked"], vd = { class: "ox-vite-field" }, gd = ["value"], _d = { class: "ox-vite-field" }, hd = ["value"], md = { class: "ox-vite-panel-card" }, bd = { class: "ox-vite-panel-card__head" }, yd = { class: "ox-vite-vrm-tabs" }, xd = { class: "ox-vite-vrm-tab__count" }, kd = { class: "ox-vite-vrm-tab__count" }, Sd = { class: "ox-vite-vrm-search" }, wd = ["placeholder"], Cd = { class: "ox-vite-vrm-list" }, Md = ["onClick"], Pd = { class: "ox-vite-vrm-row__icon" }, Rd = { class: "ox-vite-vrm-row__main" }, Td = { class: "ox-vite-vrm-row__name" }, Ed = { class: "ox-vite-vrm-row__sub" }, Ad = ["title", "onClick"], Dd = {
  key: 0,
  class: "ox-vite-vrm-empty"
}, Od = { key: 0 }, Vd = { key: 1 }, $d = { key: 2 }, Fd = { class: "ox-vite-vrm-preview" }, Id = { class: "ox-vite-vrm-preview__head" }, Ld = { key: 0 }, jd = { class: "ox-vite-vrm-preview__toggle" }, Bd = { class: "ox-vite-vrm-preview__stage" }, Nd = {
  key: 0,
  class: "ox-vite-vrm-preview__frame"
}, Wd = ["src"], Ud = {
  key: 1,
  class: "ox-vite-vrm-preview__frame"
}, Kd = ["src"], Hd = {
  key: 2,
  class: "ox-vite-vrm-preview__placeholder"
}, qd = { class: "ox-vite-vrm-preview__actions ox-vite-vrm-preview__actions--top" }, zd = ["disabled"], Yd = {
  key: 0,
  class: "ox-vite-vrm-preview__motions"
}, Gd = { class: "ox-vite-vrm-section-label" }, Qd = { class: "ox-vite-vrm-preview__motion-chips" }, Xd = { class: "ox-vite-vrm-preview__actions" }, Jd = ["disabled"], Zd = { class: "ox-vite-ops-header" }, ep = { class: "ox-vite-ops-header__kicker" }, tp = { class: "ox-vite-ops-header__actions" }, sp = {
  key: 0,
  class: "ox-vite-system-layout"
}, np = { class: "ox-vite-side-tabs" }, lp = ["onClick"], ip = { class: "ox-vite-ops-main" }, op = { class: "ox-vite-stat-grid" }, ap = { class: "ox-vite-panel-card" }, rp = { class: "ox-vite-panel-card__head" }, cp = {
  key: 0,
  class: "ox-vite-settings-stack"
}, up = { class: "ox-vite-settings-section" }, dp = { class: "ox-vite-settings-section__label" }, pp = { class: "ox-vite-settings-row" }, fp = ["value"], vp = ["value"], gp = { class: "ox-vite-settings-row" }, _p = ["value"], hp = ["value"], mp = { class: "ox-vite-settings-row ox-vite-settings-row--wide" }, bp = { class: "ox-vite-segmented" }, yp = ["onClick"], xp = { class: "ox-vite-settings-row ox-vite-settings-row--wide" }, kp = { class: "ox-vite-segmented" }, Sp = ["onClick"], wp = { class: "ox-vite-settings-section" }, Cp = { class: "ox-vite-settings-section__label" }, Mp = { class: "ox-vite-settings-row" }, Pp = { class: "ox-vite-switch" }, Rp = ["checked"], Tp = { class: "ox-vite-settings-row" }, Ep = { class: "ox-vite-switch" }, Ap = ["checked"], Dp = { class: "ox-vite-settings-section" }, Op = { class: "ox-vite-settings-section__label" }, Vp = { class: "ox-vite-settings-row" }, $p = {
  key: 1,
  class: "ox-vite-settings-stack"
}, Fp = { class: "ox-vite-settings-section" }, Ip = { class: "ox-vite-settings-section__label" }, Lp = { class: "ox-vite-theme-grid" }, jp = ["onClick"], Bp = {
  key: 2,
  class: "ox-vite-settings-stack"
}, Np = { class: "ox-vite-settings-section" }, Wp = { class: "ox-vite-settings-section__label" }, Up = { class: "ox-vite-shortcut-state" }, Kp = { class: "ox-vite-settings-section" }, Hp = { class: "ox-vite-settings-section__label" }, qp = ["onClick"], zp = {
  key: 3,
  class: "ox-vite-settings-stack"
}, Yp = { class: "ox-vite-settings-section" }, Gp = { class: "ox-vite-settings-section__label" }, Qp = { class: "ox-vite-settings-row" }, Xp = ["value"], Jp = ["value"], Zp = { class: "ox-vite-settings-row" }, ef = ["value"], tf = ["value"], sf = {
  key: 0,
  class: "ox-vite-settings-row ox-vite-settings-row--wide"
}, nf = ["value"], lf = {
  key: 4,
  class: "ox-vite-feature-packs"
}, of = { class: "ox-vite-feature-packs__toolbar" }, af = { class: "ox-vite-feature-packs__feed" }, rf = { key: 0 }, cf = ["disabled", "title"], uf = {
  key: 0,
  class: "ox-vite-feature-pack-notice is-error",
  role: "status"
}, df = {
  key: 1,
  class: "ox-vite-feature-pack-notice",
  role: "status"
}, pf = {
  key: 2,
  class: "ox-vite-feature-pack-notice",
  role: "status"
}, ff = { class: "ox-vite-feature-pack-list" }, vf = { class: "ox-vite-feature-pack-row__identity" }, gf = { class: "ox-vite-feature-pack-row__icon" }, _f = { class: "ox-vite-feature-pack-row__versions" }, hf = { class: "ox-vite-feature-pack-row__state" }, mf = {
  key: 0,
  class: "ox-vite-feature-pack-restart"
}, bf = { class: "ox-vite-feature-pack-row__actions" }, yf = ["disabled", "onClick"], xf = ["disabled", "onClick"], kf = ["disabled", "title", "onClick"], Sf = { class: "ox-vite-feature-pack-progress__meta" }, wf = { key: 0 }, Cf = { key: 1 }, Mf = {
  class: "ox-vite-feature-pack-progress__track",
  "aria-hidden": "true"
}, Pf = { key: 0 }, Rf = {
  key: 5,
  class: "ox-vite-settings-stack"
}, Tf = { class: "ox-vite-settings-section" }, Ef = { class: "ox-vite-settings-section__label" }, Af = { class: "ox-vite-settings-row" }, Df = { class: "ox-vite-settings-row" }, Of = { class: "ox-vite-settings-row" }, Vf = { class: "ox-vite-settings-section" }, $f = { class: "ox-vite-settings-section__label" }, Ff = { class: "ox-vite-settings-row" }, If = { class: "ox-vite-settings-row" }, Lf = {
  key: 6,
  class: "ox-vite-card-grid"
}, jf = { class: "ox-vite-panel-card" }, Bf = { class: "ox-vite-panel-card__head" }, Nf = { class: "ox-vite-chip-grid" }, Wf = { class: "ox-vite-detail-chip" }, Uf = { class: "ox-vite-detail-chip" }, Kf = { class: "ox-vite-detail-chip" }, Hf = { class: "ox-vite-fact-list" }, qf = { class: "ox-vite-fact-row" }, zf = { class: "ox-vite-fact-row" }, Yf = { class: "ox-vite-fact-row" }, Gf = { class: "ox-vite-chip-grid" }, Qf = { class: "ox-vite-panel-card__head" }, Xf = { class: "ox-vite-chip-grid" }, Jf = { class: "ox-vite-detail-chip" }, Zf = { class: "ox-vite-bullet-list" }, ev = { key: 1 }, tv = {
  key: 0,
  class: "ox-vite-side-tabs"
}, sv = ["onClick"], nv = { class: "ox-vite-ops-main" }, lv = {
  key: 0,
  class: "ox-vite-tab-strip"
}, iv = ["onClick"], ov = {
  key: 1,
  class: "ox-vite-summary-card"
}, av = { class: "ox-vite-chip-grid" }, rv = {
  key: 2,
  class: "ox-vite-stat-grid"
}, cv = {
  key: 0,
  class: "ox-vite-card-grid"
}, uv = { class: "ox-vite-panel-card" }, dv = { class: "ox-vite-panel-card__head" }, pv = { class: "ox-vite-deploy-hero" }, fv = { class: "ox-vite-deploy-hero__status" }, vv = { class: "ox-vite-deploy-kicker" }, gv = { class: "ox-vite-stat-card emphasis" }, _v = { class: "ox-vite-form-grid" }, hv = { class: "ox-vite-field" }, mv = ["value"], bv = { class: "ox-vite-field" }, yv = ["value"], xv = { class: "ox-vite-field" }, kv = ["value"], Sv = { class: "ox-vite-field" }, wv = ["value"], Cv = { class: "ox-vite-panel-card" }, Mv = { class: "ox-vite-panel-card__head" }, Pv = { class: "ox-vite-chip-grid" }, Rv = { class: "ox-vite-detail-chip" }, Tv = { class: "ox-vite-detail-chip" }, Ev = { class: "ox-vite-detail-chip" }, Av = {
  key: 1,
  class: "ox-vite-deploy-platform-grid"
}, Dv = { class: "ox-vite-deploy-platform-card__head" }, Ov = { class: "ox-vite-detail-chip" }, Vv = { class: "ox-vite-deploy-platform-card__meta" }, $v = {
  key: 2,
  class: "ox-vite-card-grid"
}, Fv = { class: "ox-vite-panel-card" }, Iv = { class: "ox-vite-panel-card__head" }, Lv = { class: "ox-vite-deploy-platform-grid" }, jv = { class: "ox-vite-deploy-platform-card__head" }, Bv = { class: "ox-vite-detail-chip" }, Nv = { class: "ox-vite-panel-card" }, Wv = { class: "ox-vite-panel-card__head" }, Uv = { class: "ox-vite-form-grid" }, Kv = { class: "ox-vite-field" }, Hv = ["value"], qv = { class: "ox-vite-field" }, zv = ["value"], Yv = { class: "ox-vite-field" }, Gv = ["value"], Qv = { class: "ox-vite-field" }, Xv = ["value"], Jv = { class: "ox-vite-field ox-vite-field--wide" }, Zv = ["value"], eg = {
  key: 3,
  class: "ox-vite-card-grid"
}, tg = { class: "ox-vite-panel-card" }, sg = { class: "ox-vite-panel-card__head" }, ng = { class: "ox-vite-form-grid" }, lg = { class: "ox-vite-field ox-vite-field--wide" }, ig = ["value"], og = { class: "ox-vite-field" }, ag = ["value"], rg = { class: "ox-vite-field" }, cg = ["value"], ug = { class: "ox-vite-chip-grid" }, dg = { class: "ox-vite-detail-chip" }, pg = { class: "ox-vite-panel-card" }, fg = { class: "ox-vite-panel-card__head" }, vg = { class: "ox-vite-deploy-preview" }, gg = {
  key: 4,
  class: "ox-vite-card-grid"
}, _g = { class: "ox-vite-panel-card" }, hg = { class: "ox-vite-panel-card__head" }, mg = { class: "ox-vite-form-grid" }, bg = { class: "ox-vite-field" }, yg = ["value"], xg = { class: "ox-vite-field" }, kg = ["value"], Sg = { class: "ox-vite-chip-grid" }, wg = { class: "ox-vite-detail-chip" }, Cg = { class: "ox-vite-detail-chip" }, Mg = { class: "ox-vite-panel-card" }, Pg = { class: "ox-vite-panel-card__head" }, Rg = { class: "ox-vite-deploy-preview" }, Tg = { class: "ox-vite-panel-card" }, Eg = { class: "ox-vite-panel-card__head" }, Ag = { class: "ox-vite-deploy-preview" }, Dg = {
  key: 5,
  class: "ox-vite-card-grid"
}, Og = { class: "ox-vite-panel-card" }, Vg = { class: "ox-vite-panel-card__head" }, $g = { class: "ox-vite-form-grid" }, Fg = { class: "ox-vite-field" }, Ig = ["value"], Lg = { class: "ox-vite-field" }, jg = ["value"], Bg = { class: "ox-vite-field ox-vite-field--wide" }, Ng = ["value"], Wg = { class: "ox-vite-field ox-vite-field--wide" }, Ug = ["value"], Kg = { class: "ox-vite-field ox-vite-field--wide" }, Hg = ["value"], qg = { class: "ox-vite-stat-grid" }, zg = { class: "ox-vite-summary-card" }, Yg = { class: "ox-vite-workbench-summary" }, Gg = { class: "ox-vite-chip-grid" }, Qg = { class: "ox-vite-chip-grid" }, Xg = { class: "ox-vite-card-grid ox-vite-card-grid--workbench" }, Jg = { class: "ox-vite-panel-card" }, Zg = { class: "ox-vite-panel-card__head" }, e_ = { class: "ox-vite-chip-grid" }, t_ = { class: "ox-vite-detail-chip" }, s_ = { class: "ox-vite-detail-chip" }, n_ = { class: "ox-vite-detail-chip" }, l_ = { class: "ox-vite-form-grid" }, i_ = { class: "ox-vite-field" }, o_ = ["value"], a_ = { class: "ox-vite-field" }, r_ = ["value"], c_ = { class: "ox-vite-field ox-vite-field--wide" }, u_ = ["value"], d_ = {
  key: 0,
  class: "ox-vite-inline-note"
}, p_ = { class: "ox-vite-panel-card" }, f_ = { class: "ox-vite-panel-card__head" }, v_ = { class: "ox-vite-chip-grid" }, g_ = { class: "ox-vite-detail-chip" }, __ = { class: "ox-vite-detail-chip" }, h_ = { class: "ox-vite-detail-chip" }, m_ = { class: "ox-vite-form-grid" }, b_ = { class: "ox-vite-field" }, y_ = ["value"], x_ = { class: "ox-vite-field" }, k_ = ["value"], S_ = { class: "ox-vite-field ox-vite-field--wide" }, w_ = ["value"], C_ = { class: "ox-vite-field ox-vite-field--wide" }, M_ = ["value"], P_ = { class: "ox-vite-panel-card" }, R_ = { class: "ox-vite-panel-card__head" }, T_ = { class: "ox-vite-list" }, E_ = { class: "ox-vite-list-row" }, A_ = { class: "ox-vite-list-row" }, D_ = { class: "ox-vite-list-row" }, O_ = { class: "ox-vite-list-row" }, V_ = { class: "ox-vite-chip-grid" }, $_ = { class: "ox-vite-detail-chip" }, F_ = { class: "ox-vite-detail-chip" }, I_ = { class: "ox-vite-panel-card" }, L_ = { class: "ox-vite-panel-card__head" }, j_ = { class: "ox-vite-chip-grid" }, B_ = { class: "ox-vite-detail-chip" }, N_ = { class: "ox-vite-detail-chip" }, W_ = { class: "ox-vite-form-grid" }, U_ = { class: "ox-vite-field ox-vite-field--wide" }, K_ = ["value"], H_ = { class: "ox-vite-field" }, q_ = ["value"], z_ = { class: "ox-vite-field" }, Y_ = ["value"], G_ = { class: "ox-vite-field" }, Q_ = ["value"], X_ = {
  key: 0,
  class: "ox-vite-inline-note"
}, J_ = { class: "ox-vite-card-grid ox-vite-card-grid--workbench" }, Z_ = { class: "ox-vite-panel-card" }, eh = { class: "ox-vite-panel-card__head" }, th = { class: "ox-vite-list" }, sh = { class: "ox-vite-detail-chip" }, nh = { class: "ox-vite-panel-card" }, lh = { class: "ox-vite-panel-card__head" }, ih = { class: "ox-vite-list" }, oh = { class: "ox-vite-detail-chip" }, ah = {
  key: 0,
  class: "ox-vite-list-row"
}, rh = { class: "ox-vite-panel-card" }, ch = { class: "ox-vite-panel-card__head" }, uh = { class: "ox-vite-list" }, dh = { class: "ox-vite-detail-chip" }, ph = {
  key: 0,
  class: "ox-vite-list-row"
}, fh = { class: "ox-vite-panel-card" }, vh = { class: "ox-vite-panel-card__head" }, gh = { class: "ox-vite-list" }, _h = {
  key: 0,
  class: "ox-vite-list-row"
}, hh = {
  key: 1,
  class: "ox-vite-card-grid"
}, mh = { class: "ox-vite-panel-card" }, bh = { class: "ox-vite-panel-card__head" }, yh = { class: "ox-vite-list" }, xh = { class: "ox-vite-stat-grid" }, kh = { class: "ox-vite-summary-card" }, Sh = { class: "ox-vite-chip-grid" }, wh = { class: "ox-vite-stat-grid" }, Ch = { class: "ox-vite-card-grid ox-vite-card-grid--workbench" }, Mh = { class: "ox-vite-panel-card" }, Ph = { class: "ox-vite-panel-card__head" }, Rh = { class: "ox-vite-mini-bars" }, Th = { class: "ox-vite-panel-card" }, Eh = { class: "ox-vite-panel-card__head" }, Ah = { class: "ox-vite-list" }, Dh = { class: "ox-vite-panel-card" }, Oh = { class: "ox-vite-panel-card__head" }, Vh = { class: "ox-vite-list" }, $h = { class: "ox-vite-stat-grid" }, Fh = { class: "ox-vite-card-grid ox-vite-card-grid--workbench" }, Ih = { class: "ox-vite-panel-card" }, Lh = { class: "ox-vite-panel-card__head" }, jh = { class: "ox-vite-list" }, Bh = { class: "ox-vite-panel-card" }, Nh = { class: "ox-vite-panel-card__head" }, Wh = { class: "ox-vite-list" }, Uh = { class: "ox-vite-stat-grid" }, Kh = { class: "ox-vite-panel-card" }, Hh = { class: "ox-vite-panel-card__head" }, qh = { class: "ox-vite-list" }, zh = {
  key: 0,
  class: "ox-vite-list-row"
}, Yh = {
  key: 3,
  class: "ox-vite-kb-hub"
}, Gh = { class: "ox-vite-kb-hero" }, Qh = { class: "ox-vite-kb-hero__copy" }, Xh = { class: "ox-vite-ops-header__kicker" }, Jh = { class: "ox-vite-kb-hero__stats" }, Zh = { class: "ox-vite-role-hero__stat" }, em = { class: "ox-vite-role-hero__stat" }, tm = { class: "ox-vite-role-hero__stat" }, sm = { class: "ox-vite-role-toolbar" }, nm = { class: "ox-vite-role-search" }, lm = ["placeholder"], im = { class: "ox-vite-role-category-strip" }, om = ["onClick"], am = { class: "ox-vite-kb-layout" }, rm = { class: "ox-vite-panel-card" }, cm = { class: "ox-vite-panel-card__head" }, um = { class: "ox-vite-ops-header__kicker" }, dm = { class: "ox-vite-detail-chip" }, pm = {
  key: 0,
  class: "ox-vite-kb-grid"
}, fm = { class: "ox-vite-kb-card__head" }, vm = { class: "ox-vite-kb-card__identity" }, gm = { class: "ox-vite-kb-card__name" }, _m = { class: "ox-vite-kb-card__meta" }, hm = { class: "ox-vite-detail-chip" }, mm = { class: "ox-vite-chip-grid" }, bm = {
  key: 0,
  class: "ox-vite-detail-chip"
}, ym = { class: "ox-vite-workspace-card__actions" }, xm = ["onClick"], km = ["onClick"], Sm = ["onClick"], wm = {
  key: 1,
  class: "ox-vite-empty-state"
}, Cm = { class: "ox-vite-panel-card ox-vite-kb-sidecard" }, Mm = { class: "ox-vite-panel-card__head" }, Pm = { class: "ox-vite-ops-header__kicker" }, Rm = { class: "ox-vite-form-grid" }, Tm = { class: "ox-vite-field ox-vite-field--wide" }, Em = { class: "ox-vite-field ox-vite-field--wide" }, Am = { class: "ox-vite-field ox-vite-field--wide" }, Dm = { class: "ox-vite-workspace-card__actions" }, Om = ["disabled"], Vm = { class: "ox-vite-panel-card__head" }, $m = { class: "ox-vite-ops-header__kicker" }, Fm = {
  key: 0,
  class: "ox-vite-list"
}, Im = {
  key: 1,
  class: "ox-vite-empty-state ox-vite-empty-state--compact"
}, Lm = { class: "ox-vite-workspace-card__actions" }, jm = { class: "ox-vite-panel-card__head" }, Bm = { class: "ox-vite-ops-header__kicker" }, Nm = { class: "ox-vite-list" }, Wm = { class: "ox-vite-list-row" }, Um = { class: "ox-vite-list-row" }, Km = {
  key: 4,
  class: "ox-vite-role-studio"
}, Hm = { class: "ox-vite-role-hero" }, qm = { class: "ox-vite-role-hero__copy" }, zm = { class: "ox-vite-ops-header__kicker" }, Ym = { class: "ox-vite-role-hero__stats" }, Gm = { class: "ox-vite-role-hero__stat" }, Qm = { class: "ox-vite-role-hero__stat" }, Xm = { class: "ox-vite-role-hero__stat" }, Jm = { class: "ox-vite-role-toolbar" }, Zm = { class: "ox-vite-role-search" }, eb = ["placeholder"], tb = { class: "ox-vite-role-category-strip" }, sb = ["onClick"], nb = { class: "ox-vite-role-layout" }, lb = { class: "ox-vite-panel-card" }, ib = { class: "ox-vite-panel-card__head" }, ob = { class: "ox-vite-ops-header__kicker" }, ab = { class: "ox-vite-detail-chip" }, rb = {
  key: 0,
  class: "ox-vite-role-template-grid"
}, cb = ["onClick"], ub = { class: "ox-vite-role-template-card__head" }, db = { class: "ox-vite-role-template-card__icon" }, pb = { class: "ox-vite-role-template-card__category" }, fb = { class: "ox-vite-role-template-card__title" }, vb = { class: "ox-vite-role-template-card__department" }, gb = { class: "ox-vite-role-template-card__summary" }, _b = { class: "ox-vite-chip-grid" }, hb = { class: "ox-vite-role-template-card__foot" }, mb = {
  key: 1,
  class: "ox-vite-empty-state"
}, bb = { class: "ox-vite-panel-card ox-vite-role-spotlight" }, yb = { class: "ox-vite-panel-card__head" }, xb = { class: "ox-vite-ops-header__kicker" }, kb = { class: "ox-vite-role-spotlight__list" }, Sb = ["onClick"], wb = { class: "ox-vite-role-spotlight__icon" }, Cb = { class: "ox-vite-role-spotlight__body" }, Mb = { class: "ox-vite-role-spotlight__name" }, Pb = { class: "ox-vite-role-spotlight__meta" }, Rb = { class: "ox-vite-role-spotlight__tip" }, Tb = { class: "ox-vite-panel-card" }, Eb = { class: "ox-vite-panel-card__head" }, Ab = { class: "ox-vite-ops-header__kicker" }, Db = { class: "ox-vite-detail-chip" }, Ob = {
  key: 0,
  class: "ox-vite-role-library-grid"
}, Vb = { class: "ox-vite-role-library-card__toolbar" }, $b = ["onClick"], Fb = { class: "ox-vite-role-library-card__hero" }, Ib = { class: "ox-vite-role-library-card__icon" }, Lb = { class: "ox-vite-role-library-card__identity" }, jb = { class: "ox-vite-role-library-card__name" }, Bb = { class: "ox-vite-role-library-card__meta" }, Nb = { key: 0 }, Wb = { key: 1 }, Ub = { class: "ox-vite-role-library-card__summary" }, Kb = { class: "ox-vite-chip-grid" }, Hb = {
  key: 1,
  class: "ox-vite-empty-state"
}, qb = {
  key: 5,
  class: "ox-vite-workspace-hub"
}, zb = { class: "ox-vite-workspace-hub__hero" }, Yb = { class: "ox-vite-workspace-hub__copy" }, Gb = { class: "ox-vite-ops-header__kicker" }, Qb = { class: "ox-vite-workspace-hub__actions" }, Xb = {
  key: 0,
  class: "ox-vite-workspace-grid"
}, Jb = { class: "ox-vite-workspace-card__head" }, Zb = { class: "ox-vite-workspace-card__identity" }, ey = { class: "ox-vite-workspace-card__copy" }, ty = { class: "ox-vite-workspace-card__name" }, sy = { class: "ox-vite-workspace-card__meta" }, ny = { class: "ox-vite-detail-chip" }, ly = { class: "ox-vite-workspace-card__stats" }, iy = { class: "ox-vite-workspace-card__stat" }, oy = { class: "ox-vite-workspace-card__stat" }, ay = { class: "ox-vite-workspace-card__stat" }, ry = { class: "ox-vite-chip-grid" }, cy = { class: "ox-vite-detail-chip" }, uy = {
  key: 0,
  class: "ox-vite-detail-chip"
}, dy = { class: "ox-vite-workspace-card__actions" }, py = ["onClick"], fy = ["onClick"], vy = ["onClick"], gy = {
  key: 1,
  class: "ox-vite-empty-state"
}, _y = {
  key: 6,
  class: "ox-vite-sandbox-shell"
}, hy = { class: "ox-vite-sandbox-hero" }, my = { class: "ox-vite-sandbox-hero__head" }, by = { class: "ox-vite-sandbox-hero__copy" }, yy = { class: "ox-vite-ops-header__kicker" }, xy = { class: "ox-vite-sandbox-breadcrumb" }, ky = ["onClick"], Sy = { class: "ox-vite-stat-grid" }, wy = { class: "ox-vite-stat-card" }, Cy = { class: "ox-vite-stat-card" }, My = { class: "ox-vite-stat-card" }, Py = { class: "ox-vite-stat-card" }, Ry = { class: "ox-vite-sandbox-layout" }, Ty = { class: "ox-vite-panel-card" }, Ey = { class: "ox-vite-panel-card__head" }, Ay = { class: "ox-vite-ops-header__kicker" }, Dy = { class: "ox-vite-sandbox-workspace-shell" }, Oy = { class: "ox-vite-workspace-grid ox-vite-workspace-grid--compact" }, Vy = ["onClick"], $y = { class: "ox-vite-workspace-card__head" }, Fy = { class: "ox-vite-workspace-card__identity" }, Iy = { class: "ox-vite-workspace-card__copy" }, Ly = { class: "ox-vite-workspace-card__name" }, jy = { class: "ox-vite-workspace-card__meta" }, By = { class: "ox-vite-chip-grid" }, Ny = { class: "ox-vite-detail-chip" }, Wy = { class: "ox-vite-detail-chip" }, Uy = { class: "ox-vite-workspace-card__actions" }, Ky = ["onClick"], Hy = {
  key: 0,
  class: "ox-vite-sandbox-detail-card"
}, qy = { class: "ox-vite-panel-card__head" }, zy = { class: "ox-vite-ops-header__kicker" }, Yy = { class: "ox-vite-sandbox-detail-card__hero" }, Gy = { class: "ox-vite-sandbox-detail-card__title" }, Qy = { class: "ox-vite-sandbox-detail-card__meta" }, Xy = { class: "ox-vite-chip-grid" }, Jy = { class: "ox-vite-detail-chip" }, Zy = { class: "ox-vite-detail-chip" }, e1 = { class: "ox-vite-detail-chip" }, t1 = { class: "ox-vite-workspace-card__actions" }, s1 = { class: "ox-vite-panel-card" }, n1 = { class: "ox-vite-panel-card__head" }, l1 = { class: "ox-vite-ops-header__kicker" }, i1 = ["disabled"], o1 = {
  key: 0,
  class: "ox-vite-sandbox-project-shell"
}, a1 = { class: "ox-vite-role-template-grid" }, r1 = ["onClick"], c1 = { class: "ox-vite-project-card__head" }, u1 = { class: "ox-vite-project-card__name" }, d1 = { class: "ox-vite-project-card__meta" }, p1 = { class: "ox-vite-chip-grid" }, f1 = { class: "ox-vite-detail-chip" }, v1 = {
  key: 0,
  class: "ox-vite-sandbox-detail-card"
}, g1 = { class: "ox-vite-panel-card__head" }, _1 = { class: "ox-vite-ops-header__kicker" }, h1 = { class: "ox-vite-sandbox-detail-card__hero" }, m1 = { class: "ox-vite-sandbox-detail-card__title" }, b1 = { class: "ox-vite-sandbox-detail-card__meta" }, y1 = { class: "ox-vite-sandbox-detail-card__summary" }, x1 = { class: "ox-vite-workspace-card__actions" }, k1 = {
  key: 1,
  class: "ox-vite-empty-state"
}, S1 = { class: "ox-vite-panel-card" }, w1 = { class: "ox-vite-panel-card__head" }, C1 = { class: "ox-vite-ops-header__kicker" }, M1 = {
  key: 0,
  class: "ox-vite-sandbox-roster-shell"
}, P1 = { class: "ox-vite-role-library-grid" }, R1 = ["onClick"], T1 = { class: "ox-vite-role-library-card__hero" }, E1 = { class: "ox-vite-role-library-card__icon" }, A1 = { class: "ox-vite-role-library-card__identity" }, D1 = { class: "ox-vite-role-library-card__name" }, O1 = { class: "ox-vite-role-library-card__meta" }, V1 = { key: 0 }, $1 = { key: 1 }, F1 = { class: "ox-vite-chip-grid" }, I1 = { class: "ox-vite-detail-chip" }, L1 = {
  key: 0,
  class: "ox-vite-sandbox-detail-card"
}, j1 = { class: "ox-vite-panel-card__head" }, B1 = { class: "ox-vite-ops-header__kicker" }, N1 = { class: "ox-vite-sandbox-detail-card__hero" }, W1 = { class: "ox-vite-role-library-card__icon ox-vite-role-library-card__icon--large" }, U1 = { class: "ox-vite-sandbox-detail-card__title" }, K1 = { class: "ox-vite-sandbox-detail-card__meta" }, H1 = { key: 0 }, q1 = { class: "ox-vite-sandbox-detail-card__summary" }, z1 = { class: "ox-vite-chip-grid" }, Y1 = { class: "ox-vite-detail-chip" }, G1 = { class: "ox-vite-workspace-card__actions" }, Q1 = {
  key: 1,
  class: "ox-vite-empty-state"
}, X1 = {
  key: 7,
  class: "ox-vite-media-grid"
}, J1 = { class: "ox-vite-chip-grid" }, Z1 = { class: "ox-vite-detail-chip" }, ex = { class: "ox-vite-chip-grid" }, tx = {
  key: 0,
  class: "ox-vite-panel-card"
}, sx = { class: "ox-vite-list" }, nx = {
  key: 1,
  class: "ox-vite-media-grid"
}, lx = {
  key: 2,
  class: "ox-vite-media-grid"
}, ix = {
  key: 3,
  class: "ox-vite-panel-card"
}, ox = { class: "ox-vite-list" }, ax = { class: "ox-vite-tab-strip" }, rx = ["onClick"], cx = { class: "ox-vite-stat-grid" }, ux = { class: "ox-vite-card-grid" }, dx = { class: "ox-vite-panel-card" }, px = { class: "ox-vite-panel-card__head" }, fx = { class: "ox-vite-list" }, vx = { class: "ox-vite-panel-card" }, gx = { class: "ox-vite-panel-card__head" }, _x = { class: "ox-vite-list" }, hx = {
  __name: "App",
  props: {
    surface: {
      type: String,
      default: ""
    }
  },
  setup(e) {
    const t = e, n = zc(), l = /* @__PURE__ */ Se(n.snapshot(t.surface));
    let a = null, r = !1;
    function d() {
      const y = n.snapshot(t.surface), u = !r && y.isActive;
      l.value = y, u && n.ensureLoaded(t.surface).finally(() => {
        l.value = n.snapshot(t.surface);
      }), r = y.isActive;
    }
    function p(y) {
      n.selectSurfaceTab(t.surface, y).finally(d);
    }
    function g() {
      n.refreshSurface(t.surface).finally(d);
    }
    function k() {
      n.runSystemUpdateCheck().finally(d);
    }
    function b() {
      n.openAboutSurface().finally(d);
    }
    function S(y, u) {
      n.updateSystemSetting(y, u).finally(d);
    }
    function O(y, u) {
      S(y, u?.target?.value ?? u);
    }
    function L(y, u) {
      S(y, !!u?.target?.checked);
    }
    function J(y) {
      n.setSystemTargetLanguage(y?.target?.value || "system").finally(d);
    }
    function U() {
      n.clearSystemRuntimeCache().finally(d);
    }
    function ie(y) {
      n.runSystemQuickAction(y).finally(d);
    }
    function F(y) {
      n.openSystemPath(y).finally(d);
    }
    function G() {
      n.resetSystemSettings().finally(d);
    }
    function te() {
      n.loadFeaturePacks(!0).finally(d);
    }
    function K(y, u) {
      !u?.capabilityId || ne(u) || y === "uninstall" && !window.confirm(
        c.value ? `确认卸载“${u.displayName}”？应用重启后该能力将不可用。` : `Uninstall “${u.displayName}”? This capability will be unavailable after restart.`
      ) || n.runFeaturePackOperation(y, u.capabilityId).catch(() => {
      }).finally(d);
    }
    function ne(y) {
      const u = String(y?.progress?.phase || "");
      return !!y?.operation || !!u && u !== "completed" && u !== "failed";
    }
    function Me(y) {
      return (c.value ? {
        "not-installed": "未安装",
        installed: "已安装",
        "update-available": "可更新",
        damaged: "需要修复"
      } : {
        "not-installed": "Not installed",
        installed: "Installed",
        "update-available": "Update available",
        damaged: "Repair required"
      })[y] || y;
    }
    function Pe(y) {
      return {
        "not-installed": "fa-regular fa-circle",
        installed: "fa-solid fa-circle-check",
        "update-available": "fa-solid fa-circle-arrow-up",
        damaged: "fa-solid fa-triangle-exclamation"
      }[y] || "fa-regular fa-circle-question";
    }
    function Be(y) {
      return (c.value ? {
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
      })[y] || y;
    }
    function it(y) {
      const u = Number(y);
      return !Number.isFinite(u) || u < 0 ? "" : u < 1024 ? `${u} B` : u < 1024 * 1024 ? `${(u / 1024).toFixed(1)} KB` : `${(u / (1024 * 1024)).toFixed(1)} MB`;
    }
    function H() {
      t.surface === "deploy" ? n.startPrimaryDeployAction().finally(d) : t.surface === "workbench" ? n.openTaskCenter().finally(d) : t.surface === "storage" ? n.jumpToMenu("storage", "text").finally(d) : t.surface === "kernel" ? n.selectSurfaceTab("kernel", "actions").finally(d) : t.surface === "system" && (l.value?.activeTab === "about" ? n.runSystemUpdateCheck().finally(d) : n.selectSurfaceTab("system", "about").finally(d));
    }
    function xe(y) {
      n.openTask(y).finally(d);
    }
    const Ne = /* @__PURE__ */ Se(!1), x = /* @__PURE__ */ Se("builtin"), N = /* @__PURE__ */ Se(""), ae = /* @__PURE__ */ Se(""), ge = /* @__PURE__ */ Se("builtin"), re = /* @__PURE__ */ Se(""), le = /* @__PURE__ */ Se(""), Je = /* @__PURE__ */ Se("all"), ot = /* @__PURE__ */ Se(""), Ze = /* @__PURE__ */ Se("all"), Re = /* @__PURE__ */ Se(!1), Rt = /* @__PURE__ */ Se(!1), at = /* @__PURE__ */ Se("summary"), $t = /* @__PURE__ */ Se([]), we = /* @__PURE__ */ Se({
      id: "",
      name: "",
      description: "",
      category: ""
    }), Ae = /* @__PURE__ */ Se(""), Ce = /* @__PURE__ */ Se(""), Ke = /* @__PURE__ */ Se("");
    function Tt() {
      n.startVrm().finally(d);
    }
    function on() {
      n.startVrmWeb().finally(d);
    }
    function _(y) {
      const u = typeof y == "object" && y ? y : { id: y };
      if (u.cloud && !u.downloaded) {
        m(u);
        return;
      }
      n.setVrmModel(u.id).finally(d);
    }
    function m(y, u) {
      u && u.stopPropagation(), !(!y?.id || ae.value) && (ae.value = y.id, n.downloadVrmModel(y.id).catch(() => {
      }).finally(() => {
        ae.value = "", d();
      }));
    }
    function w(y, u) {
      u && u.stopPropagation(), n.deleteVrmUserModel(y).finally(d);
    }
    function T(y) {
      n.toggleVrmMotion(y).finally(d);
    }
    function M(y, u) {
      u && u.stopPropagation(), n.deleteVrmUserMotion(y).finally(d);
    }
    function P(y) {
      n.setVrmExpressionsEnabled(y.target.checked).finally(d);
    }
    function I(y) {
      n.setVrmMotionsEnabled(y.target.checked).finally(d);
    }
    function V(y) {
      n.setVrmWindowWidth(y.target.value).finally(d);
    }
    function A(y) {
      n.setVrmWindowHeight(y.target.value).finally(d);
    }
    function R(y) {
      n.setVrmAgent(y.target.value).finally(d);
    }
    function q() {
      n.openAddVrmModel().finally(d);
    }
    function B() {
      n.openAddVrmMotion().finally(d);
    }
    function W() {
      n.openEnterpriseStaffRoleForm().finally(d);
    }
    function z(y) {
      n.createEnterpriseStaffRoleFromTemplate(y).finally(d);
    }
    function se(y) {
      n.deleteEnterpriseStaffRole(y).finally(d);
    }
    function oe() {
      n.openEnterpriseWorkspaceForm().finally(d);
    }
    function de(y) {
      Ae.value = String(y || ""), n.openEnterpriseWorkspaceForm(y).finally(d);
    }
    function me(y) {
      Ae.value = String(y || ""), n.openEnterpriseWorkspace(y).finally(d);
    }
    function ke(y) {
      Ae.value === String(y || "") && (Ae.value = ""), n.deleteEnterpriseWorkspace(y).finally(d);
    }
    function He(y) {
      n.openEnterpriseProjectForm(y).finally(d);
    }
    function Ye(y, u = "") {
      Ce.value = String(y || ""), n.openEnterpriseProjectForm(u, y).finally(d);
    }
    function Ft(y) {
      const u = String(y || "");
      Ce.value === u && (Ce.value = ""), n.deleteEnterpriseProject(y).finally(d);
    }
    function Rs() {
      Ae.value = "", Ce.value = "", Ke.value = "", n.sandboxGoBack().finally(d);
    }
    function Fe(y) {
      const u = Number(y?.level || 0);
      u <= 0 ? (Ae.value = "", Ce.value = "", Ke.value = "") : u === 1 ? (Ae.value = String(y?.id || ""), Ce.value = "", Ke.value = "") : u === 2 && (Ce.value = String(y?.id || "")), n.navigateEnterpriseSandbox(u, y?.id || "").finally(d);
    }
    function Ge(y) {
      Ce.value = String(y || ""), n.openEnterpriseProject(y).finally(d);
    }
    function Ts(y) {
      Ce.value = String(y || "");
    }
    function Es(y) {
      Ke.value = String(y || "");
    }
    function eo(y) {
      Ke.value = String(y || ""), n.openEnterpriseSandboxAgentChat(y).finally(d);
    }
    function to(y) {
      Ke.value = String(y || ""), n.openEnterpriseStaffRoleForm(y).finally(d);
    }
    function so() {
      n.openEnterpriseStaffRoleForProject(
        he.value.currentWorkspaceId,
        he.value.currentProjectId || Ce.value
      ).finally(d);
    }
    function no() {
      we.value = {
        id: "",
        name: "",
        description: "",
        category: pn.value[1]?.id || "general"
      }, Rt.value = !1, at.value = "editor", Re.value = !0;
    }
    function lo(y) {
      we.value = {
        id: y?.id || "",
        name: y?.name || "",
        description: y?.description || "",
        category: y?.category || ""
      }, Rt.value = !1, at.value = "editor", Re.value = !0;
    }
    async function io() {
      try {
        await n.saveEnterpriseKnowledgeBase(we.value), Re.value = !1, at.value = "summary", d();
      } catch (y) {
        console.error(y);
      }
    }
    function oo(y) {
      n.deleteEnterpriseKnowledgeBase(y?.id).then(d).catch((u) => {
        console.error(u);
      });
    }
    async function ao(y) {
      Re.value = !1, at.value = "versions", Rt.value = !0, $t.value = [];
      try {
        $t.value = await n.loadEnterpriseKnowledgeBaseVersions(y?.id);
      } catch (u) {
        console.error(u), $t.value = [];
      }
    }
    const h = fe(() => l.value || {}), c = fe(() => h.value.isZh), De = fe(() => h.value.featurePacks || {}), ee = fe(() => h.value.vrm || {}), As = fe(() => (ee.value.motions || []).filter((y) => y.selected)), ns = fe(() => h.value.rolePanel || {}), ls = fe(() => ns.value.items || []), It = fe(() => ns.value.templates || []), nl = fe(() => h.value.workspacePanel || {}), he = fe(() => h.value.sandboxPanel || {}), Lt = fe(() => h.value.knowledgePanel || {}), ro = fe(() => {
      const y = /* @__PURE__ */ new Set(), u = [];
      return It.value.forEach((o) => {
        const E = String(o?.category || "").trim();
        !E || y.has(E) || (y.add(E), u.push({
          id: E,
          label: String(o?.categoryLabel || E)
        }));
      }), [
        {
          id: "all",
          label: c.value ? "全部岗位" : "All Roles"
        },
        ...u
      ];
    }), an = fe(() => {
      const y = String(Je.value || "all").trim(), u = String(le.value || "").trim().toLowerCase();
      return It.value.filter((o) => y !== "all" && String(o?.category || "").trim() !== y ? !1 : u ? [
        o?.name,
        o?.department,
        o?.summary,
        o?.categoryLabel,
        ...o?.skills || []
      ].filter(Boolean).join(" ").toLowerCase().includes(u) : !0);
    }), co = fe(() => {
      const y = It.value.filter((u) => u?.featured);
      return (y.length ? y : It.value).slice(0, 4);
    }), ll = fe(() => ee.value.defaultModels || []), rn = fe(() => ee.value.cloudModels || []), cn = fe(() => ee.value.userModels || []), il = fe(() => {
      const y = x.value === "custom" ? cn.value : x.value === "cloud" ? rn.value : ll.value, u = String(N.value || "").trim().toLowerCase();
      return u ? y.filter((o) => [o.name, o.id, o.relativePath].filter(Boolean).join(" ").toLowerCase().includes(u)) : y;
    }), ol = fe(() => (ee.value.motions || []).filter((y) => y.builtin)), un = fe(() => (ee.value.motions || []).filter((y) => !y.builtin)), al = fe(() => {
      const y = ge.value === "custom" ? un.value : ol.value, u = String(re.value || "").trim().toLowerCase();
      return u ? y.filter((o) => String(o.name || o.id || "").toLowerCase().includes(u)) : y;
    });
    function uo(y) {
      return String(y || "all") === "all" ? It.value.length : It.value.filter((u) => String(u?.category || "") === String(y || "")).length;
    }
    function dn(y) {
      const u = Array.isArray(y?.accent) && y.accent.length ? y.accent : ["#4ecdc4", "#5b8cff"];
      return {
        "--ox-vite-role-accent-start": u[0],
        "--ox-vite-role-accent-end": u[1] || u[0]
      };
    }
    function rl(y) {
      const u = String(y || "default");
      return c.value ? {
        default: "默认权限",
        readonly: "只读",
        write: "读写",
        admin: "管理"
      }[u] || u : {
        default: "Default",
        readonly: "Read only",
        write: "Read / Write",
        admin: "Admin"
      }[u] || u;
    }
    function cl(y) {
      const u = String(y || "").trim().toLowerCase();
      return c.value ? {
        online: "在线",
        idle: "待命",
        busy: "执行中",
        running: "运行中",
        offline: "离线",
        unknown: "未知"
      }[u] || y || "未知" : {
        online: "Online",
        idle: "Idle",
        busy: "Busy",
        running: "Running",
        offline: "Offline",
        unknown: "Unknown"
      }[u] || y || "Unknown";
    }
    const pn = fe(() => {
      const y = /* @__PURE__ */ new Set(), u = [];
      return (Lt.value.items || []).forEach((o) => {
        const E = String(o?.category || "").trim();
        !E || y.has(E) || (y.add(E), u.push({ id: E, label: E }));
      }), [
        {
          id: "all",
          label: c.value ? "全部知识库" : "All KBs"
        },
        ...u
      ];
    }), fn = fe(() => {
      const y = String(Ze.value || "all").trim(), u = String(ot.value || "").trim().toLowerCase();
      return (Lt.value.items || []).filter((o) => y !== "all" && String(o?.category || "") !== y ? !1 : u ? [o?.name, o?.category, o?.description].filter(Boolean).join(" ").toLowerCase().includes(u) : !0);
    }), We = fe(() => {
      const y = he.value.projects || [];
      return y.find((o) => String(o?.id || "") === String(Ce.value || "")) || y[0] || null;
    }), Te = fe(() => {
      const y = he.value.items || [];
      return y.find((o) => String(o?.id || "") === String(Ke.value || "")) || y[0] || null;
    }), qe = fe(() => {
      const y = he.value.workspaces || [], u = String(Ae.value || he.value.currentWorkspaceId || "");
      return y.find((E) => String(E?.id || "") === u) || y[0] || null;
    });
    return Is(
      he,
      (y) => {
        const u = String(y?.currentWorkspaceId || "").trim(), o = String(y?.currentProjectId || "").trim(), E = String(y?.selectedAgentId || "").trim();
        u ? Ae.value = u : (y?.workspaces || []).some((jt) => String(jt?.id || "") === String(Ae.value || "")) || (Ae.value = ""), o ? Ce.value = o : (y?.projects || []).some((jt) => String(jt?.id || "") === String(Ce.value || "")) || (Ce.value = ""), E ? Ke.value = E : (y?.items || []).some((jt) => String(jt?.id || "") === String(Ke.value || "")) || (Ke.value = "");
      },
      { deep: !0 }
    ), wi(() => {
      d(), a = window.setInterval(d, 800);
    }), Ci(() => {
      a && (window.clearInterval(a), a = null);
    }), (y, u) => (f(), v("div", {
      class: j(["ox-vite-ops-shell", `surface-${t.surface}`])
    }, [
      t.surface === "task" ? (f(), v(C, { key: 0 }, [
        s("div", Yc, [
          s("div", null, [
            s("div", Gc, i((c.value, "Task Board")), 1),
            s("h1", null, i(h.value.title), 1),
            s("p", null, i(h.value.subtitle), 1)
          ]),
          s("div", Qc, [
            s("button", {
              type: "button",
              class: "ox-vite-ops-secondary-btn",
              onClick: g
            }, [
              u[39] || (u[39] = s("i", { class: "fa-solid fa-rotate-right" }, null, -1)),
              s("span", null, i(c.value ? "刷新" : "Refresh"), 1)
            ])
          ])
        ]),
        s("div", Xc, [
          s("section", Jc, [
            (f(!0), v(C, null, $(h.value.columns || [], (o) => (f(), v("article", {
              key: o.id,
              class: "ox-vite-task-column"
            }, [
              s("div", Zc, [
                s("h2", null, i(o.title), 1),
                s("span", null, i((o.tasks || []).length), 1)
              ]),
              (o.tasks || []).length ? Y("", !0) : (f(), v("div", eu, [
                s("strong", null, i(o.emptyTitle), 1),
                s("p", null, i(o.emptyCopy), 1)
              ])),
              (f(!0), v(C, null, $(o.tasks || [], (E) => (f(), v("button", {
                key: E.id,
                type: "button",
                class: j(["ox-vite-task-card", `is-${E.status || "pending"}`]),
                onClick: (jt) => xe(E.raw)
              }, [
                s("div", su, i(E.title), 1),
                s("div", nu, i(E.summary), 1),
                E.progress !== null ? (f(), v("div", lu, [
                  s("div", {
                    class: "ox-vite-task-progress__fill",
                    style: tt({ width: `${Math.max(0, Math.min(100, E.progress))}%` })
                  }, null, 4)
                ])) : Y("", !0),
                s("div", iu, [
                  s("span", null, i(E.assignee || (c.value ? "未分配" : "Unassigned")), 1),
                  s("span", null, i(E.updatedAt), 1)
                ])
              ], 10, tu))), 128))
            ]))), 128))
          ]),
          s("aside", ou, [
            s("div", au, [
              s("h2", null, i(c.value ? "任务详情" : "Task Detail"), 1)
            ]),
            h.value.detail ? (f(), v(C, { key: 0 }, [
              s("div", ru, i(h.value.detail.title), 1),
              s("div", cu, i(h.value.detail.status || (c.value ? "待处理" : "Pending")), 1),
              s("p", uu, i(h.value.detail.summary), 1),
              s("div", du, [
                (f(!0), v(C, null, $(h.value.detail.trace || [], (o) => (f(), v("div", {
                  key: o.id,
                  class: "ox-vite-task-detail__trace-item"
                }, i(o.text), 1))), 128))
              ])
            ], 64)) : (f(), v("div", pu, [
              u[40] || (u[40] = s("i", { class: "fa-solid fa-list-check" }, null, -1)),
              s("strong", null, i(c.value ? "选择一个任务查看详情" : "Select a task to inspect"), 1)
            ]))
          ])
        ])
      ], 64)) : t.surface === "about" ? (f(), v("div", fu, [
        u[41] || (u[41] = s("div", { class: "ox-vite-about-mark" }, [
          s("img", {
            src: "/source/icon.png",
            alt: "OpenXnet"
          })
        ], -1)),
        s("div", vu, i(h.value.title), 1),
        s("div", gu, "v" + i(h.value.version), 1),
        s("p", _u, i(h.value.subtitle), 1),
        s("section", hu, [
          (f(!0), v(C, null, $(h.value.features || [], (o) => (f(), v("article", {
            key: o.title,
            class: "ox-vite-info-card"
          }, [
            s("div", mu, [
              s("i", {
                class: j(o.icon)
              }, null, 2)
            ]),
            s("div", null, [
              s("h3", null, i(o.title), 1),
              s("p", null, i(o.description), 1)
            ])
          ]))), 128))
        ]),
        s("section", bu, [
          (f(!0), v(C, null, $(h.value.links || [], (o) => (f(), v("a", {
            key: o.href,
            class: "ox-vite-link-card",
            href: o.href,
            target: "_blank",
            rel: "noreferrer"
          }, [
            s("span", null, i(o.label), 1),
            s("strong", null, i(o.value), 1)
          ], 8, yu))), 128))
        ]),
        s("section", xu, [
          (f(!0), v(C, null, $(h.value.facts || [], (o) => (f(), v("article", {
            key: o.label,
            class: "ox-vite-fact-row"
          }, [
            s("span", null, i(o.label), 1),
            s("p", null, i(o.value), 1)
          ]))), 128))
        ])
      ])) : t.surface === "vrm" ? (f(), v("div", ku, [
        s("div", Su, [
          s("header", wu, [
            s("div", Cu, [
              s("div", Mu, i(c.value ? "VRM 桌宠" : "VRM Pet"), 1),
              s("h1", null, i(h.value.title), 1),
              s("p", null, i(h.value.subtitle), 1),
              h.value.meta?.setupSteps?.length ? (f(), v("div", Pu, [
                s("div", Ru, [
                  u[42] || (u[42] = s("i", { class: "fa-solid fa-route" }, null, -1)),
                  s("span", null, i(h.value.meta?.guideNote), 1)
                ]),
                s("div", Tu, [
                  (f(!0), v(C, null, $(h.value.meta?.setupSteps || [], (o, E) => (f(), v("span", {
                    key: o.title,
                    class: "ox-vite-vrm-guide__step"
                  }, [
                    s("span", Eu, i(E + 1), 1),
                    s("i", {
                      class: j(o.icon)
                    }, null, 2),
                    s("span", Au, [
                      s("strong", null, i(o.title), 1),
                      s("small", null, i(o.desc), 1)
                    ])
                  ]))), 128))
                ])
              ])) : Y("", !0)
            ])
          ]),
          h.value.meta?.chips?.length ? (f(), v("section", Du, [
            (f(!0), v(C, null, $(h.value.meta.chips || [], (o) => (f(), v("span", {
              key: o.icon + o.text,
              class: "ox-vite-detail-chip"
            }, [
              s("i", {
                class: j(o.icon)
              }, null, 2),
              s("span", null, i(o.text), 1)
            ]))), 128))
          ])) : Y("", !0),
          h.value.stats?.length ? (f(), v("section", Ou, [
            (f(!0), v(C, null, $(h.value.stats, (o) => (f(), v("article", {
              key: o.label,
              class: j(["ox-vite-stat-card", { emphasis: o.emphasis }])
            }, [
              s("span", null, i(o.label), 1),
              s("strong", null, i(o.value), 1),
              s("small", null, i(o.meta), 1)
            ], 2))), 128))
          ])) : Y("", !0),
          s("article", Vu, [
            s("div", $u, [
              s("div", null, [
                s("h2", null, i(c.value ? "VRM 模型" : "VRM Model"), 1),
                s("p", null, i(c.value ? "内置和自定义模型分开管理，搜索过滤后从列表中点选。" : "Built-in and custom models are split. Search to filter, click to select."), 1)
              ]),
              s("button", {
                type: "button",
                class: "ox-vite-ops-secondary-btn",
                onClick: q
              }, [
                u[43] || (u[43] = s("i", { class: "fa-solid fa-plus" }, null, -1)),
                s("span", null, i(c.value ? "上传模型" : "Upload"), 1)
              ])
            ]),
            s("div", Fu, [
              s("button", {
                type: "button",
                class: j(["ox-vite-vrm-tab", { "is-active": x.value === "builtin" }]),
                onClick: u[0] || (u[0] = (o) => x.value = "builtin")
              }, [
                u[44] || (u[44] = s("i", { class: "fa-solid fa-star" }, null, -1)),
                s("span", null, i(c.value ? "内置模型" : "Built-in"), 1),
                s("span", Iu, i(ll.value.length), 1)
              ], 2),
              s("button", {
                type: "button",
                class: j(["ox-vite-vrm-tab", { "is-active": x.value === "cloud" }]),
                onClick: u[1] || (u[1] = (o) => x.value = "cloud")
              }, [
                u[45] || (u[45] = s("i", { class: "fa-solid fa-cloud-arrow-down" }, null, -1)),
                s("span", null, i(c.value ? "资源库" : "Library"), 1),
                s("span", Lu, i(rn.value.length), 1)
              ], 2),
              s("button", {
                type: "button",
                class: j(["ox-vite-vrm-tab", { "is-active": x.value === "custom" }]),
                onClick: u[2] || (u[2] = (o) => x.value = "custom")
              }, [
                u[46] || (u[46] = s("i", { class: "fa-solid fa-user" }, null, -1)),
                s("span", null, i(c.value ? "自定义" : "Custom"), 1),
                s("span", ju, i(cn.value.length), 1)
              ], 2)
            ]),
            s("div", Bu, [
              u[48] || (u[48] = s("i", { class: "fa-solid fa-magnifying-glass" }, null, -1)),
              Et(s("input", {
                type: "text",
                placeholder: c.value ? "搜索模型..." : "Search models...",
                "onUpdate:modelValue": u[3] || (u[3] = (o) => N.value = o)
              }, null, 8, Nu), [
                [Wt, N.value]
              ]),
              N.value ? (f(), v("button", {
                key: 0,
                type: "button",
                class: "ox-vite-vrm-search__clear",
                onClick: u[4] || (u[4] = (o) => N.value = "")
              }, [...u[47] || (u[47] = [
                s("i", { class: "fa-solid fa-xmark" }, null, -1)
              ])])) : Y("", !0)
            ]),
            s("div", Wu, [
              (f(!0), v(C, null, $(il.value, (o) => (f(), v("button", {
                key: o.id,
                type: "button",
                class: j(["ox-vite-vrm-row", {
                  "is-active": ee.value.selectedModelId === o.id,
                  "is-cloud": o.cloud,
                  "is-downloading": ae.value === o.id
                }]),
                disabled: ae.value === o.id,
                onClick: (E) => _(o)
              }, [
                s("span", Ku, [
                  s("i", {
                    class: j(o.cloud ? "fa-solid fa-cloud-arrow-down" : o.builtin ? "fa-solid fa-vr-cardboard" : "fa-solid fa-cube")
                  }, null, 2)
                ]),
                s("span", Hu, [
                  s("span", qu, i(o.name), 1),
                  s("span", zu, i(o.cloud ? o.downloaded ? c.value ? "已下载资源" : "Downloaded resource" : c.value ? "云端资源，点击下载" : "Cloud resource, click to download" : o.builtin ? c.value ? "内置模型" : "Built-in" : c.value ? "自定义模型" : "Custom"), 1)
                ]),
                ee.value.selectedModelId === o.id ? (f(), v("i", Yu)) : o.cloud ? (f(), v("span", {
                  key: 1,
                  class: j(["ox-vite-vrm-row__download", { "is-ready": o.downloaded }]),
                  onClick: (E) => o.downloaded ? _(o) : m(o, E)
                }, [
                  s("i", {
                    class: j(ae.value === o.id ? "fa-solid fa-spinner fa-spin" : o.downloaded ? "fa-solid fa-check" : "fa-solid fa-download")
                  }, null, 2),
                  s("span", null, i(ae.value === o.id ? c.value ? "下载中" : "Downloading" : o.downloaded ? c.value ? "使用" : "Use" : c.value ? "下载" : "Download"), 1)
                ], 10, Gu)) : Y("", !0),
                !o.builtin && (!o.cloud || o.downloaded) ? (f(), v("span", {
                  key: 2,
                  class: "ox-vite-vrm-row__del",
                  title: c.value ? "删除" : "Delete",
                  onClick: (E) => w(o.id, E)
                }, [...u[49] || (u[49] = [
                  s("i", { class: "fa-regular fa-trash-can" }, null, -1)
                ])], 8, Qu)) : Y("", !0)
              ], 10, Uu))), 128)),
              il.value.length ? Y("", !0) : (f(), v("div", Xu, [
                x.value === "custom" && !cn.value.length ? (f(), v("span", Ju, i(c.value ? "尚未上传自定义模型" : "No custom models yet"), 1)) : x.value === "cloud" && !rn.value.length ? (f(), v("span", Zu, i(c.value ? "资源库暂无可下载模型" : "No downloadable models yet"), 1)) : N.value ? (f(), v("span", ed, i(c.value ? "没有匹配的模型" : "No matching models"), 1)) : (f(), v("span", td, i(c.value ? "无可用模型" : "No models available"), 1))
              ]))
            ])
          ]),
          s("article", sd, [
            s("div", nd, [
              s("div", null, [
                s("h2", null, i(c.value ? "动作与窗口" : "Behavior & Window"), 1),
                s("p", null, i(c.value ? "主智能体、表情/动作开关与桌宠默认窗口尺寸。" : "Main agent, expression/motion toggles, and default window size."), 1)
              ])
            ]),
            s("div", ld, [
              s("label", id, [
                s("span", null, i(c.value ? "主智能体" : "Main Agent"), 1),
                s("select", {
                  value: ee.value.mainAgent,
                  onChange: R
                }, [
                  (f(!0), v(C, null, $(ee.value.agentOptions || [], (o) => (f(), v("option", {
                    key: o.id,
                    value: o.id
                  }, i(o.name), 9, ad))), 128))
                ], 40, od)
              ]),
              s("label", rd, [
                s("span", null, i(c.value ? "启用表情" : "Enable expressions"), 1),
                s("span", cd, [
                  s("input", {
                    type: "checkbox",
                    checked: ee.value.enabledExpressions,
                    onChange: P
                  }, null, 40, ud),
                  s("span", null, i(ee.value.enabledExpressions ? c.value ? "已开启" : "On" : c.value ? "已关闭" : "Off"), 1)
                ])
              ]),
              s("label", dd, [
                s("span", null, i(c.value ? "启用动作" : "Enable motions"), 1),
                s("span", pd, [
                  s("input", {
                    type: "checkbox",
                    checked: ee.value.enabledMotions,
                    onChange: I
                  }, null, 40, fd),
                  s("span", null, i(ee.value.enabledMotions ? c.value ? "已开启" : "On" : c.value ? "已关闭" : "Off"), 1)
                ])
              ]),
              s("label", vd, [
                s("span", null, i(c.value ? "窗口宽度 (px)" : "Width (px)"), 1),
                s("input", {
                  type: "number",
                  min: "300",
                  max: "3840",
                  step: "10",
                  value: ee.value.windowWidth,
                  onChange: V
                }, null, 40, gd)
              ]),
              s("label", _d, [
                s("span", null, i(c.value ? "窗口高度 (px)" : "Height (px)"), 1),
                s("input", {
                  type: "number",
                  min: "300",
                  max: "3840",
                  step: "10",
                  value: ee.value.windowHeight,
                  onChange: A
                }, null, 40, hd)
              ])
            ])
          ]),
          s("article", md, [
            s("div", bd, [
              s("div", null, [
                s("h2", null, i(c.value ? "VRMA 动作" : "VRMA Motions"), 1),
                s("p", null, i(c.value ? "在内置 / 自定义两组动作里勾选启用项，会同步进桌宠运行环境。" : "Tick motions from built-in or custom groups; the desktop pet picks them up."), 1)
              ]),
              s("button", {
                type: "button",
                class: "ox-vite-ops-secondary-btn",
                onClick: B
              }, [
                u[50] || (u[50] = s("i", { class: "fa-solid fa-plus" }, null, -1)),
                s("span", null, i(c.value ? "上传动作" : "Upload"), 1)
              ])
            ]),
            s("div", yd, [
              s("button", {
                type: "button",
                class: j(["ox-vite-vrm-tab", { "is-active": ge.value === "builtin" }]),
                onClick: u[5] || (u[5] = (o) => ge.value = "builtin")
              }, [
                u[51] || (u[51] = s("i", { class: "fa-solid fa-star" }, null, -1)),
                s("span", null, i(c.value ? "内置动作" : "Built-in"), 1),
                s("span", xd, i(ol.value.length), 1)
              ], 2),
              s("button", {
                type: "button",
                class: j(["ox-vite-vrm-tab", { "is-active": ge.value === "custom" }]),
                onClick: u[6] || (u[6] = (o) => ge.value = "custom")
              }, [
                u[52] || (u[52] = s("i", { class: "fa-solid fa-user" }, null, -1)),
                s("span", null, i(c.value ? "自定义" : "Custom"), 1),
                s("span", kd, i(un.value.length), 1)
              ], 2)
            ]),
            s("div", Sd, [
              u[54] || (u[54] = s("i", { class: "fa-solid fa-magnifying-glass" }, null, -1)),
              Et(s("input", {
                type: "text",
                placeholder: c.value ? "搜索动作..." : "Search motions...",
                "onUpdate:modelValue": u[7] || (u[7] = (o) => re.value = o)
              }, null, 8, wd), [
                [Wt, re.value]
              ]),
              re.value ? (f(), v("button", {
                key: 0,
                type: "button",
                class: "ox-vite-vrm-search__clear",
                onClick: u[8] || (u[8] = (o) => re.value = "")
              }, [...u[53] || (u[53] = [
                s("i", { class: "fa-solid fa-xmark" }, null, -1)
              ])])) : Y("", !0)
            ]),
            s("div", Cd, [
              (f(!0), v(C, null, $(al.value, (o) => (f(), v("button", {
                key: o.id,
                type: "button",
                class: j(["ox-vite-vrm-row", { "is-active": o.selected }]),
                onClick: (E) => T(o.id)
              }, [
                s("span", Pd, [
                  s("i", {
                    class: j(o.selected ? "fa-solid fa-circle-check" : "fa-regular fa-circle")
                  }, null, 2)
                ]),
                s("span", Rd, [
                  s("span", Td, i(o.name), 1),
                  s("span", Ed, i(o.builtin ? c.value ? "内置动作" : "Built-in" : c.value ? "自定义动作" : "Custom"), 1)
                ]),
                o.builtin ? Y("", !0) : (f(), v("span", {
                  key: 0,
                  class: "ox-vite-vrm-row__del",
                  title: c.value ? "删除" : "Delete",
                  onClick: (E) => M(o.id, E)
                }, [...u[55] || (u[55] = [
                  s("i", { class: "fa-regular fa-trash-can" }, null, -1)
                ])], 8, Ad))
              ], 10, Md))), 128)),
              al.value.length ? Y("", !0) : (f(), v("div", Dd, [
                ge.value === "custom" && !un.value.length ? (f(), v("span", Od, i(c.value ? "尚未上传自定义动作" : "No custom motions yet"), 1)) : re.value ? (f(), v("span", Vd, i(c.value ? "没有匹配的动作" : "No matching motions"), 1)) : (f(), v("span", $d, i(c.value ? "无可用动作" : "No motions available"), 1))
              ]))
            ])
          ])
        ]),
        s("aside", Fd, [
          s("div", Id, [
            s("div", null, [
              s("h2", null, i(c.value ? "实时预览" : "Live Preview"), 1),
              s("p", null, [
                s("span", null, i(ee.value.selectedModel?.name || (c.value ? "未选择模型" : "No model")), 1),
                As.value.length ? (f(), v("span", Ld, " · " + i(As.value.length) + " " + i(c.value ? "个动作" : "motions"), 1)) : Y("", !0)
              ])
            ]),
            s("label", jd, [
              Et(s("input", {
                type: "checkbox",
                "onUpdate:modelValue": u[9] || (u[9] = (o) => Ne.value = o)
              }, null, 512), [
                [Ar, Ne.value]
              ]),
              s("span", null, i(Ne.value ? c.value ? "关闭预览" : "Hide" : c.value ? "开启预览" : "Show"), 1)
            ])
          ]),
          s("div", Bd, [
            Ne.value && ee.value.previewUrl && ee.value.isElectron ? (f(), v("div", Nd, [
              (f(), v("webview", {
                key: ee.value.previewKey || ee.value.previewUrl,
                src: ee.value.previewUrl,
                partition: "persist:openxnet-vrm-preview",
                class: "ox-vite-vrm-preview__webview",
                allowpopups: "",
                webpreferences: "transparent=true"
              }, null, 8, Wd))
            ])) : Ne.value && ee.value.previewUrl ? (f(), v("div", Ud, [
              (f(), v("iframe", {
                key: ee.value.previewKey || ee.value.previewUrl,
                src: ee.value.previewUrl,
                class: "ox-vite-vrm-preview__iframe",
                referrerpolicy: "no-referrer",
                allowtransparency: "true"
              }, null, 8, Kd))
            ])) : (f(), v("div", Hd, [
              u[56] || (u[56] = s("div", { class: "ox-vite-vrm-preview__hero" }, [
                s("i", { class: "fa-solid fa-vr-cardboard" })
              ], -1)),
              s("h3", null, i(ee.value.selectedModel?.name || (c.value ? "未选择模型" : "No model selected")), 1),
              s("p", null, i(c.value ? '点击"开启预览"加载 VRM 模型，桌宠未运行时也能看到当前选择的模型与动作。' : "Toggle preview to load the VRM. Visible even when the desktop pet is stopped."), 1)
            ]))
          ]),
          s("div", qd, [
            s("button", {
              type: "button",
              class: "ox-vite-ops-secondary-btn",
              onClick: on
            }, [
              u[57] || (u[57] = s("i", { class: "fa-solid fa-window-maximize" }, null, -1)),
              s("span", null, i(c.value ? "浏览器预览" : "Browser preview"), 1)
            ]),
            ee.value.isElectron ? (f(), v("button", {
              key: 0,
              type: "button",
              class: "ox-vite-ops-primary-btn",
              disabled: ee.value.starting,
              onClick: Tt
            }, [
              s("i", {
                class: j(ee.value.starting ? "fa-solid fa-spinner fa-spin" : ee.value.running ? "fa-solid fa-rotate" : "fa-solid fa-play")
              }, null, 2),
              s("span", null, i(ee.value.starting ? c.value ? "启动中..." : "Starting..." : ee.value.running ? c.value ? "重启桌宠" : "Restart pet" : c.value ? "启动桌宠" : "Start pet"), 1)
            ], 8, zd)) : Y("", !0)
          ]),
          As.value.length ? (f(), v("div", Yd, [
            s("div", Gd, i(c.value ? "已启用动作" : "Enabled motions"), 1),
            s("div", Qd, [
              (f(!0), v(C, null, $(As.value, (o) => (f(), v("span", {
                key: o.id,
                class: "ox-vite-detail-chip"
              }, [
                u[58] || (u[58] = s("i", { class: "fa-solid fa-person-running" }, null, -1)),
                s("span", null, i(o.name), 1)
              ]))), 128))
            ])
          ])) : Y("", !0),
          s("div", Xd, [
            s("button", {
              type: "button",
              class: "ox-vite-ops-secondary-btn",
              onClick: on
            }, [
              u[59] || (u[59] = s("i", { class: "fa-solid fa-window-maximize" }, null, -1)),
              s("span", null, i(c.value ? "浏览器" : "Browser"), 1)
            ]),
            ee.value.isElectron ? (f(), v("button", {
              key: 0,
              type: "button",
              class: "ox-vite-ops-primary-btn",
              disabled: ee.value.starting,
              onClick: Tt
            }, [
              s("i", {
                class: j(ee.value.starting ? "fa-solid fa-spinner fa-spin" : "fa-solid fa-play")
              }, null, 2),
              s("span", null, i(ee.value.running ? c.value ? "重启" : "Restart" : c.value ? "启动" : "Start"), 1)
            ], 8, Jd)) : Y("", !0)
          ])
        ])
      ])) : (f(), v(C, { key: 3 }, [
        s("div", Zd, [
          s("div", null, [
            s("div", ep, i(h.value.meta?.title || h.value.title), 1),
            s("h1", null, i(h.value.title), 1),
            s("p", null, i(h.value.subtitle), 1)
          ]),
          s("div", tp, [
            s("button", {
              type: "button",
              class: "ox-vite-ops-secondary-btn",
              onClick: g
            }, [
              u[60] || (u[60] = s("i", { class: "fa-solid fa-rotate-right" }, null, -1)),
              s("span", null, i(c.value ? "同步状态" : "Sync Status"), 1)
            ]),
            ["deploy", "workbench", "storage", "kernel", "system"].includes(t.surface) ? (f(), v("button", {
              key: 0,
              type: "button",
              class: "ox-vite-ops-primary-btn",
              onClick: H
            }, [
              u[61] || (u[61] = s("i", { class: "fa-solid fa-arrow-right" }, null, -1)),
              s("span", null, i(t.surface === "deploy" ? c.value ? "启动主机器人" : "Start primary bot" : t.surface === "workbench" ? c.value ? "打开任务中心" : "Open task center" : t.surface === "storage" ? c.value ? "进入文件库" : "Open file vault" : t.surface === "kernel" ? c.value ? "查看行动队列" : "Open action queue" : h.value.activeTab === "about" ? c.value ? "检查更新" : "Check Updates" : c.value ? "查看更新内容" : "Open update content"), 1)
            ])) : Y("", !0)
          ])
        ]),
        t.surface === "system" ? (f(), v("div", sp, [
          s("aside", np, [
            (f(!0), v(C, null, $(h.value.tabs || [], (o) => (f(), v("button", {
              key: o.id,
              type: "button",
              class: j(["ox-vite-side-tab", { active: h.value.activeTab === o.id }]),
              onClick: (E) => p(o.id)
            }, [
              s("i", {
                class: j(o.icon)
              }, null, 2),
              s("span", null, i(o.label), 1)
            ], 10, lp))), 128))
          ]),
          s("main", ip, [
            s("section", op, [
              (f(!0), v(C, null, $(h.value.stats || [], (o) => (f(), v("article", {
                key: o.label,
                class: j(["ox-vite-stat-card", { emphasis: o.emphasis }])
              }, [
                s("span", null, i(o.label), 1),
                s("strong", null, i(o.value), 1),
                s("small", null, i(o.meta), 1)
              ], 2))), 128))
            ]),
            s("section", ap, [
              s("div", rp, [
                s("h2", null, i(h.value.currentMeta?.heading), 1),
                s("p", null, i(h.value.currentMeta?.summary), 1)
              ]),
              h.value.activeTab === "general" ? (f(), v("div", cp, [
                s("section", up, [
                  s("div", dp, i(c.value ? "语言与区域" : "Language & Region"), 1),
                  s("article", pp, [
                    s("div", null, [
                      s("strong", null, i(c.value ? "界面语言" : "Interface Language"), 1),
                      s("p", null, i(c.value ? "选择 OpenXnet 界面显示语言。" : "Choose the language used by the OpenXnet interface."), 1)
                    ]),
                    s("select", {
                      class: "ox-vite-select",
                      value: h.value.settings?.language,
                      onChange: u[10] || (u[10] = (o) => O("language", o))
                    }, [
                      (f(!0), v(C, null, $(h.value.languageOptions || [], (o) => (f(), v("option", {
                        key: o.value,
                        value: o.value
                      }, i(o.label), 9, vp))), 128))
                    ], 40, fp)
                  ]),
                  s("article", gp, [
                    s("div", null, [
                      s("strong", null, i(c.value ? "目标输出语言" : "Target Output Language"), 1),
                      s("p", null, i(c.value ? "控制模型回答时优先使用的语言。" : "Controls the preferred language for model replies."), 1)
                    ]),
                    s("select", {
                      class: "ox-vite-select",
                      value: h.value.targetLanguage,
                      onChange: J
                    }, [
                      (f(!0), v(C, null, $(h.value.targetLanguageOptions || [], (o) => (f(), v("option", {
                        key: o.value,
                        value: o.value
                      }, i(o.label), 9, hp))), 128))
                    ], 40, _p)
                  ]),
                  s("article", mp, [
                    s("div", null, [
                      s("strong", null, i(c.value ? "时区" : "Timezone"), 1),
                      s("p", null, i(c.value ? "用于时间显示、任务计划和更新记录。" : "Used by timestamps, scheduled tasks, and release records."), 1)
                    ]),
                    s("div", bp, [
                      (f(!0), v(C, null, $(h.value.timezoneOptions || [], (o) => (f(), v("button", {
                        key: o.value,
                        type: "button",
                        class: j({ active: h.value.settings?.timezone === o.value }),
                        onClick: (E) => S("timezone", o.value)
                      }, i(o.label), 11, yp))), 128))
                    ])
                  ]),
                  s("article", xp, [
                    s("div", null, [
                      s("strong", null, i(c.value ? "日期格式" : "Date Format"), 1),
                      s("p", null, i(c.value ? "选择日期在系统页面中的显示方式。" : "Choose how dates are displayed across system pages."), 1)
                    ]),
                    s("div", kp, [
                      (f(!0), v(C, null, $(h.value.dateFormatOptions || [], (o) => (f(), v("button", {
                        key: o.value,
                        type: "button",
                        class: j({ active: h.value.settings?.dateFormat === o.value }),
                        onClick: (E) => S("dateFormat", o.value)
                      }, i(o.label), 11, Sp))), 128))
                    ])
                  ])
                ]),
                s("section", wp, [
                  s("div", Cp, i(c.value ? "启动行为" : "Startup"), 1),
                  s("article", Mp, [
                    s("div", null, [
                      s("strong", null, i(c.value ? "开机自启" : "Launch at Startup"), 1),
                      s("p", null, i(c.value ? "系统启动后自动运行 OpenXnet。" : "Run OpenXnet automatically after system startup."), 1)
                    ]),
                    s("label", Pp, [
                      s("input", {
                        type: "checkbox",
                        checked: h.value.settings?.launchAtStartup,
                        onChange: u[11] || (u[11] = (o) => L("launchAtStartup", o))
                      }, null, 40, Rp),
                      u[62] || (u[62] = s("span", null, null, -1))
                    ])
                  ]),
                  s("article", Tp, [
                    s("div", null, [
                      s("strong", null, i(c.value ? "启动时最小化" : "Start Minimized"), 1),
                      s("p", null, i(c.value ? "启动后进入托盘，不打断当前桌面。" : "Start into the tray without interrupting the desktop."), 1)
                    ]),
                    s("label", Ep, [
                      s("input", {
                        type: "checkbox",
                        checked: h.value.settings?.startMinimized,
                        onChange: u[12] || (u[12] = (o) => L("startMinimized", o))
                      }, null, 40, Ap),
                      u[63] || (u[63] = s("span", null, null, -1))
                    ])
                  ])
                ]),
                s("section", Dp, [
                  s("div", Op, i(c.value ? "数据与隐私" : "Data & Privacy"), 1),
                  s("article", Vp, [
                    s("div", null, [
                      s("strong", null, i(c.value ? "清理运行缓存" : "Clear Runtime Cache"), 1),
                      s("p", null, i(c.value ? "清理 Service Worker 与 Cache Storage，重新加载后获取最新 UI。" : "Clear Service Worker and Cache Storage so the latest UI loads after refresh."), 1)
                    ]),
                    s("button", {
                      type: "button",
                      class: "ox-vite-ops-secondary-btn",
                      onClick: U
                    }, [
                      u[64] || (u[64] = s("i", { class: "fa-solid fa-broom" }, null, -1)),
                      s("span", null, i(c.value ? "清除缓存" : "Clear"), 1)
                    ])
                  ])
                ])
              ])) : h.value.activeTab === "appearance" ? (f(), v("div", $p, [
                s("section", Fp, [
                  s("div", Ip, i(c.value ? "主题模式" : "Theme Mode"), 1),
                  s("div", Lp, [
                    (f(!0), v(C, null, $(h.value.themeOptions || [], (o) => (f(), v("button", {
                      key: o.value,
                      type: "button",
                      class: j(["ox-vite-theme-card", { active: h.value.settings?.theme === o.value }]),
                      onClick: (E) => S("theme", o.value)
                    }, [
                      s("span", {
                        class: j(["ox-vite-theme-card__preview", `theme-${o.value}`])
                      }, [...u[65] || (u[65] = [
                        s("i", null, null, -1),
                        s("i", null, null, -1),
                        s("i", null, null, -1)
                      ])], 2),
                      s("strong", null, i(o.label), 1),
                      s("small", null, i(h.value.settings?.theme === o.value ? c.value ? "当前使用" : "Current" : c.value ? "点击切换" : "Switch"), 1)
                    ], 10, jp))), 128))
                  ])
                ])
              ])) : h.value.activeTab === "shortcuts" ? (f(), v("div", Bp, [
                s("section", Np, [
                  s("div", Wp, i(c.value ? "已注册快捷键" : "Registered Shortcuts"), 1),
                  (f(!0), v(C, null, $(h.value.shortcutRows || [], (o) => (f(), v("article", {
                    key: o.key || o.label,
                    class: "ox-vite-settings-row"
                  }, [
                    s("div", null, [
                      s("strong", null, i(o.label), 1),
                      s("p", null, i(o.description), 1)
                    ]),
                    s("div", Up, [
                      s("kbd", null, i(o.shortcut), 1),
                      s("span", {
                        class: j(["ox-vite-status-pill", { active: o.registered }])
                      }, i(o.registered ? c.value ? "已注册" : "Ready" : c.value ? "未注册" : "Unavailable"), 3)
                    ])
                  ]))), 128))
                ]),
                s("section", Kp, [
                  s("div", Hp, i(c.value ? "快速操作" : "Quick Actions"), 1),
                  (f(!0), v(C, null, $(h.value.quickActions || [], (o) => (f(), v("article", {
                    key: o.id,
                    class: "ox-vite-settings-row"
                  }, [
                    s("div", null, [
                      s("strong", null, [
                        s("i", {
                          class: j(o.icon)
                        }, null, 2),
                        mt(i(o.label), 1)
                      ]),
                      s("p", null, i(o.description), 1)
                    ]),
                    s("button", {
                      type: "button",
                      class: "ox-vite-ops-secondary-btn",
                      onClick: (E) => ie(o.id)
                    }, [
                      u[66] || (u[66] = s("i", { class: "fa-solid fa-arrow-up-right-from-square" }, null, -1)),
                      s("span", null, i(c.value ? "打开" : "Open"), 1)
                    ], 8, qp)
                  ]))), 128))
                ])
              ])) : h.value.activeTab === "network" ? (f(), v("div", zp, [
                s("section", Yp, [
                  s("div", Gp, i(c.value ? "网络与代理" : "Network & Proxy"), 1),
                  s("article", Qp, [
                    s("div", null, [
                      s("strong", null, i(c.value ? "网络模式" : "Network Mode"), 1),
                      s("p", null, i(c.value ? "决定桌面服务在本机或局域网中的可见范围。" : "Controls whether the desktop service is local-only or visible on the LAN."), 1)
                    ]),
                    s("select", {
                      class: "ox-vite-select",
                      value: h.value.settings?.network,
                      onChange: u[13] || (u[13] = (o) => O("network", o))
                    }, [
                      (f(!0), v(C, null, $(h.value.networkOptions || [], (o) => (f(), v("option", {
                        key: o.value,
                        value: o.value
                      }, i(o.label), 9, Jp))), 128))
                    ], 40, Xp)
                  ]),
                  s("article", Zp, [
                    s("div", null, [
                      s("strong", null, i(c.value ? "代理模式" : "Proxy Mode"), 1),
                      s("p", null, i(c.value ? "用于模型、插件、资源下载和外部服务访问。" : "Used for models, plugins, resource downloads, and external services."), 1)
                    ]),
                    s("select", {
                      class: "ox-vite-select",
                      value: h.value.settings?.proxyMode,
                      onChange: u[14] || (u[14] = (o) => O("proxyMode", o))
                    }, [
                      (f(!0), v(C, null, $(h.value.proxyOptions || [], (o) => (f(), v("option", {
                        key: o.value,
                        value: o.value
                      }, i(o.label), 9, tf))), 128))
                    ], 40, ef)
                  ]),
                  h.value.settings?.proxyMode === "manual" ? (f(), v("article", sf, [
                    s("div", null, [
                      s("strong", null, i(c.value ? "代理地址" : "Proxy Address"), 1),
                      s("p", null, i(c.value ? "示例：http://127.0.0.1:7890。SOCKS 代理会被后端保护性拦截。" : "Example: http://127.0.0.1:7890. SOCKS proxies are blocked by the backend guard."), 1)
                    ]),
                    s("input", {
                      class: "ox-vite-text-input",
                      value: h.value.settings?.proxy,
                      type: "text",
                      placeholder: "http://127.0.0.1:7890",
                      onChange: u[15] || (u[15] = (o) => O("proxy", o))
                    }, null, 40, nf)
                  ])) : Y("", !0)
                ])
              ])) : h.value.activeTab === "feature-packs" ? (f(), v("div", lf, [
                s("div", of, [
                  s("div", af, [
                    s("span", {
                      class: j(["ox-vite-feature-pack-feed-state", `is-${De.value.feedStatus || "unavailable"}`])
                    }, [
                      s("i", {
                        class: j(De.value.feedStatus === "ready" ? "fa-solid fa-shield-halved" : "fa-solid fa-circle-exclamation")
                      }, null, 2),
                      s("span", null, i(De.value.feedStatus === "ready" ? c.value ? "可信分发已连接" : "Trusted feed connected" : De.value.feedStatus === "not-configured" ? c.value ? "分发未配置" : "Distribution not configured" : De.value.feedStatus === "loading" ? c.value ? "正在同步" : "Syncing" : c.value ? "分发不可用" : "Distribution unavailable"), 1)
                    ], 2),
                    De.value.catalogGeneratedAt ? (f(), v("small", rf, i(c.value ? "目录时间" : "Catalog") + ": " + i(De.value.catalogGeneratedAt), 1)) : Y("", !0)
                  ]),
                  s("button", {
                    type: "button",
                    class: "ox-vite-icon-btn",
                    disabled: De.value.loading,
                    title: c.value ? "刷新功能包目录" : "Refresh Feature Pack catalog",
                    onClick: te
                  }, [
                    s("i", {
                      class: j(De.value.loading ? "fa-solid fa-spinner fa-spin" : "fa-solid fa-rotate-right")
                    }, null, 2)
                  ], 8, cf)
                ]),
                De.value.error ? (f(), v("div", uf, [
                  u[67] || (u[67] = s("i", { class: "fa-solid fa-triangle-exclamation" }, null, -1)),
                  s("span", null, i(De.value.error.message), 1)
                ])) : De.value.feedStatus === "not-configured" ? (f(), v("div", df, [
                  u[68] || (u[68] = s("i", { class: "fa-solid fa-lock" }, null, -1)),
                  s("span", null, i(c.value ? "远程安装已停用；应用信任存储和分发地址尚未配置。" : "Remote installation is disabled because the application trust store and feed are not configured."), 1)
                ])) : De.value.available ? Y("", !0) : (f(), v("div", pf, [
                  u[69] || (u[69] = s("i", { class: "fa-solid fa-desktop" }, null, -1)),
                  s("span", null, i(c.value ? "功能包管理仅在桌面应用中可用。" : "Feature Pack management is available in the desktop application."), 1)
                ])),
                s("div", ff, [
                  (f(!0), v(C, null, $(De.value.items || [], (o) => (f(), v("article", {
                    key: o.capabilityId,
                    class: j(["ox-vite-feature-pack-row", [`is-${o.status}`, { "is-busy": ne(o) }]])
                  }, [
                    s("div", vf, [
                      s("span", gf, [
                        s("i", {
                          class: j(o.icon)
                        }, null, 2)
                      ]),
                      s("div", null, [
                        s("strong", null, i(o.displayName), 1),
                        s("p", null, i(o.description), 1)
                      ])
                    ]),
                    s("div", _f, [
                      s("span", null, [
                        s("small", null, i(c.value ? "已安装" : "Installed"), 1),
                        s("strong", null, i(o.installedVersion || "—"), 1)
                      ]),
                      s("span", null, [
                        s("small", null, i(c.value ? "可用版本" : "Available"), 1),
                        s("strong", null, i(o.availableVersion || "—"), 1)
                      ])
                    ]),
                    s("div", hf, [
                      s("span", {
                        class: j(["ox-vite-feature-pack-status", `is-${o.status}`])
                      }, [
                        s("i", {
                          class: j(Pe(o.status))
                        }, null, 2),
                        s("span", null, i(Me(o.status)), 1)
                      ], 2),
                      o.restartRequired ? (f(), v("span", mf, [
                        u[70] || (u[70] = s("i", { class: "fa-solid fa-power-off" }, null, -1)),
                        s("span", null, i(c.value ? "重启后生效" : "Restart required"), 1)
                      ])) : Y("", !0)
                    ]),
                    s("div", bf, [
                      o.status === "not-installed" || o.status === "update-available" ? (f(), v("button", {
                        key: 0,
                        type: "button",
                        class: "ox-vite-ops-primary-btn",
                        disabled: ne(o) || De.value.feedStatus !== "ready",
                        onClick: (E) => K("install", o)
                      }, [
                        s("i", {
                          class: j(ne(o) ? "fa-solid fa-spinner fa-spin" : o.status === "update-available" ? "fa-solid fa-arrow-up" : "fa-solid fa-download")
                        }, null, 2),
                        s("span", null, i(o.status === "update-available" ? c.value ? "更新" : "Update" : c.value ? "安装" : "Install"), 1)
                      ], 8, yf)) : (f(), v("button", {
                        key: 1,
                        type: "button",
                        class: "ox-vite-ops-secondary-btn",
                        disabled: ne(o) || De.value.feedStatus !== "ready",
                        onClick: (E) => K("repair", o)
                      }, [
                        s("i", {
                          class: j(ne(o) ? "fa-solid fa-spinner fa-spin" : "fa-solid fa-screwdriver-wrench")
                        }, null, 2),
                        s("span", null, i(c.value ? "修复" : "Repair"), 1)
                      ], 8, xf)),
                      o.installedVersion || o.status === "damaged" ? (f(), v("button", {
                        key: 2,
                        type: "button",
                        class: "ox-vite-icon-btn is-danger",
                        disabled: ne(o),
                        title: c.value ? "卸载功能包" : "Uninstall Feature Pack",
                        onClick: (E) => K("uninstall", o)
                      }, [...u[71] || (u[71] = [
                        s("i", { class: "fa-regular fa-trash-can" }, null, -1)
                      ])], 8, kf)) : Y("", !0)
                    ]),
                    o.progress ? (f(), v("div", {
                      key: 0,
                      class: j(["ox-vite-feature-pack-progress", { "is-failed": o.progress.phase === "failed" }])
                    }, [
                      s("div", Sf, [
                        s("span", null, i(Be(o.progress.phase)), 1),
                        o.progress.transferredBytes !== null && o.progress.totalBytes !== null ? (f(), v("span", wf, i(it(o.progress.transferredBytes)) + " / " + i(it(o.progress.totalBytes)), 1)) : o.progress.percent !== null ? (f(), v("span", Cf, i(o.progress.percent) + "%", 1)) : Y("", !0)
                      ]),
                      s("div", Mf, [
                        s("span", {
                          class: j({ "is-indeterminate": o.progress.percent === null && !["completed", "failed"].includes(o.progress.phase) }),
                          style: tt({ width: o.progress.percent === null ? o.progress.phase === "completed" ? "100%" : "28%" : `${o.progress.percent}%` })
                        }, null, 6)
                      ]),
                      o.progress.error ? (f(), v("p", Pf, i(o.progress.error.message), 1)) : Y("", !0)
                    ], 2)) : Y("", !0)
                  ], 2))), 128))
                ])
              ])) : h.value.activeTab === "advanced" ? (f(), v("div", Rf, [
                s("section", Tf, [
                  s("div", Ef, i(c.value ? "文件与目录" : "Files & Directories"), 1),
                  s("article", Af, [
                    s("div", null, [
                      s("strong", null, i(c.value ? "用户数据目录" : "User Data Folder"), 1),
                      s("p", null, i(c.value ? "配置、会话、本地资产和数据库所在目录。" : "Folder for settings, conversations, local assets, and databases."), 1)
                    ]),
                    s("button", {
                      type: "button",
                      class: "ox-vite-ops-secondary-btn",
                      onClick: u[16] || (u[16] = (o) => F("user"))
                    }, [
                      u[72] || (u[72] = s("i", { class: "fa-solid fa-folder-open" }, null, -1)),
                      s("span", null, i(c.value ? "打开" : "Open"), 1)
                    ])
                  ]),
                  s("article", Df, [
                    s("div", null, [
                      s("strong", null, i(c.value ? "日志目录" : "Log Folder"), 1),
                      s("p", null, i(c.value ? "桌面端与后端运行日志，用于排查启动、更新和接口问题。" : "Desktop and backend logs for startup, update, and API diagnostics."), 1)
                    ]),
                    s("button", {
                      type: "button",
                      class: "ox-vite-ops-secondary-btn",
                      onClick: u[17] || (u[17] = (o) => F("logs"))
                    }, [
                      u[73] || (u[73] = s("i", { class: "fa-solid fa-file-lines" }, null, -1)),
                      s("span", null, i(c.value ? "打开" : "Open"), 1)
                    ])
                  ]),
                  s("article", Of, [
                    s("div", null, [
                      s("strong", null, i(c.value ? "扩展目录" : "Extension Folder"), 1),
                      s("p", null, i(c.value ? "插件、扩展与外部能力文件目录。" : "Folder for plugins, extensions, and external capability files."), 1)
                    ]),
                    s("button", {
                      type: "button",
                      class: "ox-vite-ops-secondary-btn",
                      onClick: u[18] || (u[18] = (o) => F("extensions"))
                    }, [
                      u[74] || (u[74] = s("i", { class: "fa-solid fa-puzzle-piece" }, null, -1)),
                      s("span", null, i(c.value ? "打开" : "Open"), 1)
                    ])
                  ])
                ]),
                s("section", Vf, [
                  s("div", $f, i(c.value ? "维护操作" : "Maintenance"), 1),
                  s("article", Ff, [
                    s("div", null, [
                      s("strong", null, i(c.value ? "清理运行缓存" : "Clear Runtime Cache"), 1),
                      s("p", null, i(c.value ? "清理前端缓存，不会删除用户会话和配置。" : "Clear frontend runtime cache without deleting conversations or settings."), 1)
                    ]),
                    s("button", {
                      type: "button",
                      class: "ox-vite-ops-secondary-btn",
                      onClick: U
                    }, [
                      u[75] || (u[75] = s("i", { class: "fa-solid fa-broom" }, null, -1)),
                      s("span", null, i(c.value ? "清除" : "Clear"), 1)
                    ])
                  ]),
                  s("article", If, [
                    s("div", null, [
                      s("strong", null, i(c.value ? "恢复默认系统设置" : "Reset System Settings"), 1),
                      s("p", null, i(c.value ? "仅恢复系统设置页中的语言、主题、启动、网络和代理选项。" : "Only resets language, theme, startup, network, and proxy options in this page."), 1)
                    ]),
                    s("button", {
                      type: "button",
                      class: "ox-vite-danger-btn",
                      onClick: G
                    }, [
                      u[76] || (u[76] = s("i", { class: "fa-solid fa-rotate-left" }, null, -1)),
                      s("span", null, i(c.value ? "恢复默认" : "Reset"), 1)
                    ])
                  ])
                ])
              ])) : (f(), v("div", Lf, [
                s("article", jf, [
                  s("div", Bf, [
                    s("h2", null, i(c.value ? "当前发布状态" : "Current Release Status"), 1),
                    s("p", null, i(c.value ? "版本更新、更新检测与优化说明都会统一汇总在这里。" : "Release updates, update checks, and optimization notes are collected here."), 1)
                  ]),
                  s("div", Nf, [
                    s("span", Wf, "v" + i(h.value.version), 1),
                    s("span", Uf, i(h.value.updateStatus || "idle"), 1),
                    s("span", Kf, i(h.value.updateAvailable ? c.value ? "发现新版本" : "Update Available" : c.value ? "当前已同步" : "Up to Date"), 1)
                  ]),
                  s("div", Hf, [
                    s("article", qf, [
                      s("strong", null, i(c.value ? "更新状态" : "Update Status"), 1),
                      s("p", null, i(h.value.updateStatusTitle || (c.value ? "等待下一次更新检查。" : "Waiting for the next update check.")), 1)
                    ]),
                    s("article", zf, [
                      s("strong", null, i(c.value ? "状态说明" : "Status Detail"), 1),
                      s("p", null, i(h.value.updateStatusDescription || h.value.updateMessage || (c.value ? "等待下一次更新检查。" : "Waiting for the next update check.")), 1)
                    ]),
                    s("article", Yf, [
                      s("strong", null, i(c.value ? "更新节奏" : "Check Cadence"), 1),
                      s("p", null, i(c.value ? "启动后首次静默检查，之后每 1 小时自动检测一次。" : "A silent check runs shortly after launch, then once every hour."), 1)
                    ])
                  ]),
                  s("div", Gf, [
                    s("button", {
                      type: "button",
                      class: "ox-vite-ops-primary-btn",
                      onClick: k
                    }, [
                      u[77] || (u[77] = s("i", { class: "fa-solid fa-rotate-right" }, null, -1)),
                      s("span", null, i(c.value ? "检查更新" : "Check for Updates"), 1)
                    ]),
                    s("button", {
                      type: "button",
                      class: "ox-vite-ops-secondary-btn",
                      onClick: b
                    }, [
                      u[78] || (u[78] = s("i", { class: "fa-solid fa-circle-info" }, null, -1)),
                      s("span", null, i(c.value ? "查看关于页" : "Open About Page"), 1)
                    ])
                  ])
                ]),
                (f(!0), v(C, null, $(h.value.updateEntries || [], (o) => (f(), v("article", {
                  key: `${o.version}-${o.date}-${o.title}`,
                  class: "ox-vite-panel-card"
                }, [
                  s("div", Qf, [
                    s("h2", null, i(o.title), 1),
                    s("p", null, i(o.date), 1)
                  ]),
                  s("div", Xf, [
                    s("span", Jf, i(o.version), 1),
                    (f(!0), v(C, null, $(o.modules || [], (E) => (f(), v("span", {
                      key: o.version + E,
                      class: "ox-vite-detail-chip"
                    }, i(E), 1))), 128))
                  ]),
                  s("ul", Zf, [
                    (f(!0), v(C, null, $(o.highlights || [], (E) => (f(), v("li", { key: E }, i(E), 1))), 128))
                  ])
                ]))), 128))
              ]))
            ])
          ])
        ])) : (f(), v("div", ev, [
          s("div", {
            class: j(t.surface === "enterprise" ? "ox-vite-system-layout" : "ox-vite-ops-main")
          }, [
            t.surface === "enterprise" ? (f(), v("aside", tv, [
              (f(!0), v(C, null, $(h.value.tabs || [], (o) => (f(), v("button", {
                key: o.id,
                type: "button",
                class: j(["ox-vite-side-tab", { active: h.value.activeTab === o.id }]),
                onClick: (E) => p(o.id)
              }, [
                s("i", {
                  class: j(o.icon)
                }, null, 2),
                s("span", null, i(o.label), 1)
              ], 10, sv))), 128))
            ])) : Y("", !0),
            s("main", nv, [
              t.surface !== "kernel" ? (f(), v("div", lv, [
                (f(!0), v(C, null, $(t.surface === "enterprise" ? [] : h.value.tabs || [], (o) => (f(), v("button", {
                  key: o.id,
                  type: "button",
                  class: j(["ox-vite-strip-tab", { active: h.value.activeTab === o.id }]),
                  onClick: (E) => p(o.id)
                }, [
                  s("i", {
                    class: j(o.icon)
                  }, null, 2),
                  s("span", null, i(o.label), 1)
                ], 10, iv))), 128))
              ])) : Y("", !0),
              h.value.meta?.summary && !(t.surface === "enterprise" || t.surface === "workbench" && h.value.activeTab === "develop") ? (f(), v("section", ov, [
                s("p", null, i(h.value.meta.summary), 1),
                s("div", av, [
                  (f(!0), v(C, null, $(h.value.meta.chips || [], (o) => (f(), v("span", {
                    key: o.icon + o.text,
                    class: "ox-vite-detail-chip"
                  }, [
                    s("i", {
                      class: j(o.icon)
                    }, null, 2),
                    s("span", null, i(o.text), 1)
                  ]))), 128))
                ])
              ])) : Y("", !0),
              h.value.stats?.length && !(t.surface === "enterprise" || t.surface === "workbench" && h.value.activeTab === "develop") ? (f(), v("section", rv, [
                (f(!0), v(C, null, $(h.value.stats || [], (o) => (f(), v("article", {
                  key: o.label,
                  class: j(["ox-vite-stat-card", { emphasis: o.emphasis }])
                }, [
                  s("span", null, i(o.label), 1),
                  s("strong", null, i(o.value), 1),
                  s("small", null, i(o.meta), 1)
                ], 2))), 128))
              ])) : Y("", !0),
              t.surface === "deploy" ? (f(), v(C, { key: 3 }, [
                h.value.activeTab === "table_pet" ? (f(), v("section", cv, [
                  s("article", uv, [
                    s("div", dv, [
                      s("h2", null, i(c.value ? "VRM 模型与在线状态" : "VRM Model & Runtime"), 1),
                      s("p", null, i(c.value ? "桌宠入口承接模型、动作和窗口设置，是最接近数字生命表现层的部署面。" : "The desktop-pet lane holds model, motion, and window settings for the most embodied deployment surface."), 1)
                    ]),
                    s("div", pv, [
                      s("div", fv, [
                        s("span", vv, i(c.value ? "当前状态" : "Current state"), 1),
                        s("strong", null, i(h.value.deskPet?.status), 1),
                        s("p", null, i(c.value ? "建议先确认模型、表情和动作，再启动桌宠窗口。" : "Confirm the model, expressions, and motion set before launching the pet window."), 1)
                      ]),
                      s("div", gv, [
                        s("span", null, i(c.value ? "当前模型" : "Current Model"), 1),
                        s("strong", null, i(h.value.deskPet?.modelId), 1),
                        s("small", null, i(h.value.deskPet?.userModels) + " " + i(c.value ? "个自定义模型" : "custom models"), 1)
                      ])
                    ]),
                    s("div", _v, [
                      s("label", hv, [
                        s("span", null, i(c.value ? "表情驱动" : "Expressions"), 1),
                        s("input", {
                          value: h.value.deskPet?.expressions,
                          disabled: "",
                          type: "text"
                        }, null, 8, mv)
                      ]),
                      s("label", bv, [
                        s("span", null, i(c.value ? "动作驱动" : "Motions"), 1),
                        s("input", {
                          value: h.value.deskPet?.motions,
                          disabled: "",
                          type: "text"
                        }, null, 8, yv)
                      ]),
                      s("label", xv, [
                        s("span", null, i(c.value ? "窗口宽度" : "Window Width"), 1),
                        s("input", {
                          value: String(h.value.deskPet?.width || 0),
                          disabled: "",
                          type: "text"
                        }, null, 8, kv)
                      ]),
                      s("label", Sv, [
                        s("span", null, i(c.value ? "窗口高度" : "Window Height"), 1),
                        s("input", {
                          value: String(h.value.deskPet?.height || 0),
                          disabled: "",
                          type: "text"
                        }, null, 8, wv)
                      ])
                    ])
                  ]),
                  s("article", Cv, [
                    s("div", Mv, [
                      s("h2", null, i(c.value ? "动作与表现" : "Motion & Presence"), 1),
                      s("p", null, i(c.value ? "后续会继续补齐待机动画、触摸反应和桌面漫游的可视化配置。" : "The next pass will deepen idle motion, touch reactions, and desktop roaming controls."), 1)
                    ]),
                    s("div", Pv, [
                      s("span", Rv, [
                        u[79] || (u[79] = s("i", { class: "fa-solid fa-face-smile" }, null, -1)),
                        mt(i(h.value.deskPet?.expressions), 1)
                      ]),
                      s("span", Tv, [
                        u[80] || (u[80] = s("i", { class: "fa-solid fa-person-running" }, null, -1)),
                        mt(i(h.value.deskPet?.motionCount) + " " + i(c.value ? "个已选动作" : "selected motions"), 1)
                      ]),
                      s("span", Ev, [
                        u[81] || (u[81] = s("i", { class: "fa-solid fa-window-maximize" }, null, -1)),
                        mt(i(h.value.deskPet?.width) + " x " + i(h.value.deskPet?.height), 1)
                      ])
                    ])
                  ])
                ])) : h.value.activeTab === "im_bot" ? (f(), v("section", Av, [
                  (f(!0), v(C, null, $(h.value.imChannels || [], (o) => (f(), v("article", {
                    key: o.id,
                    class: "ox-vite-deploy-platform-card"
                  }, [
                    s("div", Dv, [
                      s("div", null, [
                        s("h3", null, i(o.label), 1),
                        s("p", null, i(o.agent), 1)
                      ]),
                      s("span", Ov, i(o.status), 1)
                    ]),
                    s("div", Vv, [
                      s("span", null, i(o.memory), 1),
                      s("span", null, i(o.note), 1)
                    ])
                  ]))), 128))
                ])) : h.value.activeTab === "live_stream" ? (f(), v("section", $v, [
                  s("article", Fv, [
                    s("div", Iv, [
                      s("h2", null, i(c.value ? "直播平台路由" : "Streaming Routes"), 1),
                      s("p", null, i(c.value ? "当前直播工作面统一管理 Bilibili、YouTube 和 Twitch 的启用状态与入口。" : "The live lane tracks Bilibili, YouTube, and Twitch enablement and entry points together."), 1)
                    ]),
                    s("div", Lv, [
                      (f(!0), v(C, null, $(h.value.liveChannels || [], (o) => (f(), v("article", {
                        key: o.id,
                        class: "ox-vite-deploy-platform-card"
                      }, [
                        s("div", jv, [
                          s("div", null, [
                            s("h3", null, i(o.label), 1),
                            s("p", null, i(o.note), 1)
                          ]),
                          s("span", Bv, i(o.status), 1)
                        ])
                      ]))), 128))
                    ])
                  ]),
                  s("article", Nv, [
                    s("div", Wv, [
                      s("h2", null, i(c.value ? "互动与渲染输出" : "Interaction & Render Output"), 1),
                      s("p", null, i(c.value ? "把弹幕队列、唤醒词和 OBS 连接地址放在同一块，便于直播场景快速核对。" : "Keep danmaku flow, wake words, and OBS output together for faster stream checks."), 1)
                    ]),
                    s("div", Uv, [
                      s("label", Kv, [
                        s("span", null, i(c.value ? "运行状态" : "Runtime"), 1),
                        s("input", {
                          value: h.value.liveStrategy?.runtime,
                          disabled: "",
                          type: "text"
                        }, null, 8, Hv)
                      ]),
                      s("label", qv, [
                        s("span", null, i(c.value ? "弹幕优先模式" : "Danmaku Only"), 1),
                        s("input", {
                          value: h.value.liveStrategy?.danmakuOnly,
                          disabled: "",
                          type: "text"
                        }, null, 8, zv)
                      ]),
                      s("label", Yv, [
                        s("span", null, i(c.value ? "队列上限" : "Queue Limit"), 1),
                        s("input", {
                          value: String(h.value.liveStrategy?.queueLimit || 0),
                          disabled: "",
                          type: "text"
                        }, null, 8, Gv)
                      ]),
                      s("label", Qv, [
                        s("span", null, i(c.value ? "唤醒词" : "Wake Word"), 1),
                        s("input", {
                          value: h.value.liveStrategy?.wakeWord,
                          disabled: "",
                          type: "text"
                        }, null, 8, Xv)
                      ]),
                      s("label", Jv, [
                        u[82] || (u[82] = s("span", null, "OBS", -1)),
                        s("input", {
                          value: h.value.liveStrategy?.obsUrl,
                          disabled: "",
                          type: "text"
                        }, null, 8, Zv)
                      ])
                    ])
                  ])
                ])) : h.value.activeTab === "read_bot" ? (f(), v("section", eg, [
                  s("article", tg, [
                    s("div", sg, [
                      s("h2", null, i(c.value ? "朗读任务" : "Reading Job"), 1),
                      s("p", null, i(c.value ? "集中看选中文件、切片数量和朗读进度，比在旧页面里来回跳更清楚。" : "Keep file selection, segment counts, and reading progress visible in one place."), 1)
                    ]),
                    s("div", ng, [
                      s("label", lg, [
                        s("span", null, i(c.value ? "当前文件" : "Selected File"), 1),
                        s("input", {
                          value: h.value.readBot?.selectedFile,
                          disabled: "",
                          type: "text"
                        }, null, 8, ig)
                      ]),
                      s("label", og, [
                        s("span", null, i(c.value ? "运行状态" : "Runtime"), 1),
                        s("input", {
                          value: h.value.readBot?.runtime,
                          disabled: "",
                          type: "text"
                        }, null, 8, ag)
                      ]),
                      s("label", rg, [
                        s("span", null, i(c.value ? "音频状态" : "Audio State"), 1),
                        s("input", {
                          value: h.value.readBot?.audioState,
                          disabled: "",
                          type: "text"
                        }, null, 8, cg)
                      ])
                    ]),
                    s("div", ug, [
                      s("span", dg, [
                        u[83] || (u[83] = s("i", { class: "fa-solid fa-waveform" }, null, -1)),
                        mt(i(h.value.readBot?.segments) + " " + i(c.value ? "段内容" : "segments"), 1)
                      ])
                    ])
                  ]),
                  s("article", pg, [
                    s("div", fg, [
                      s("h2", null, i(c.value ? "内容预览" : "Content Preview"), 1)
                    ]),
                    s("div", vg, i(h.value.readBot?.preview), 1)
                  ])
                ])) : h.value.activeTab === "translate_bot" ? (f(), v("section", gg, [
                  s("article", _g, [
                    s("div", hg, [
                      s("h2", null, i(c.value ? "翻译输入" : "Translation Input"), 1),
                      s("p", null, i(c.value ? "目标语言、源文本长度和翻译状态已经挂到新的工作面里。" : "Target language, source length, and translation status now live on the new workbench."), 1)
                    ]),
                    s("div", mg, [
                      s("label", bg, [
                        s("span", null, i(c.value ? "目标语言" : "Target Language"), 1),
                        s("input", {
                          value: h.value.translateBot?.runtime,
                          disabled: "",
                          type: "text"
                        }, null, 8, yg)
                      ]),
                      s("label", xg, [
                        s("span", null, i(c.value ? "翻译状态" : "Translation Status"), 1),
                        s("input", {
                          value: h.value.translateBot?.busy ? c.value ? "翻译中" : "Translating" : c.value ? "待处理" : "Idle",
                          disabled: "",
                          type: "text"
                        }, null, 8, kg)
                      ])
                    ]),
                    s("div", Sg, [
                      s("span", wg, [
                        u[84] || (u[84] = s("i", { class: "fa-solid fa-align-left" }, null, -1)),
                        mt(i(h.value.translateBot?.sourceLength) + " " + i(c.value ? "字符输入" : "source chars"), 1)
                      ]),
                      s("span", Cg, [
                        u[85] || (u[85] = s("i", { class: "fa-solid fa-language" }, null, -1)),
                        mt(i(h.value.translateBot?.targetLength) + " " + i(c.value ? "字符输出" : "target chars"), 1)
                      ])
                    ])
                  ]),
                  s("article", Mg, [
                    s("div", Pg, [
                      s("h2", null, i(c.value ? "源文本预览" : "Source Preview"), 1)
                    ]),
                    s("div", Rg, i(h.value.translateBot?.sourcePreview), 1)
                  ]),
                  s("article", Tg, [
                    s("div", Eg, [
                      s("h2", null, i(c.value ? "译文预览" : "Result Preview"), 1)
                    ]),
                    s("div", Ag, i(h.value.translateBot?.resultPreview), 1)
                  ])
                ])) : (f(), v("section", Dg, [
                  s("article", Og, [
                    s("div", Vg, [
                      s("h2", null, i(c.value ? "图床与素材出口" : "Media Outputs"), 1),
                      s("p", null, i(c.value ? "这一块是多个机器人共用的出口配置，先把图床和仓库回退整理清楚。" : "These shared output routes affect multiple bots, so host and fallback setup should stay explicit."), 1)
                    ]),
                    s("div", $g, [
                      s("label", Fg, [
                        s("span", null, i(c.value ? "图床状态" : "Media Host"), 1),
                        s("input", {
                          value: h.value.generalConfig?.mediaHostEnabled,
                          disabled: "",
                          type: "text"
                        }, null, 8, Ig)
                      ]),
                      s("label", Lg, [
                        s("span", null, i(c.value ? "当前图床" : "Selected Host"), 1),
                        s("input", {
                          value: h.value.generalConfig?.mediaHost,
                          disabled: "",
                          type: "text"
                        }, null, 8, jg)
                      ]),
                      s("label", Bg, [
                        u[86] || (u[86] = s("span", null, "EasyImage2", -1)),
                        s("input", {
                          value: h.value.generalConfig?.easyImage,
                          disabled: "",
                          type: "text"
                        }, null, 8, Ng)
                      ]),
                      s("label", Wg, [
                        u[87] || (u[87] = s("span", null, "GitHub", -1)),
                        s("input", {
                          value: h.value.generalConfig?.githubRepo,
                          disabled: "",
                          type: "text"
                        }, null, 8, Ug)
                      ]),
                      s("label", Kg, [
                        u[88] || (u[88] = s("span", null, "Gitee", -1)),
                        s("input", {
                          value: h.value.generalConfig?.giteeRepo,
                          disabled: "",
                          type: "text"
                        }, null, 8, Hg)
                      ])
                    ])
                  ])
                ]))
              ], 64)) : t.surface === "workbench" ? (f(), v(C, { key: 4 }, [
                h.value.activeTab === "develop" ? (f(), v(C, { key: 0 }, [
                  s("section", qg, [
                    (f(!0), v(C, null, $(h.value.topStats || [], (o) => (f(), v("article", {
                      key: o.label,
                      class: j(["ox-vite-stat-card", { emphasis: o.emphasis }])
                    }, [
                      s("span", null, i(o.label), 1),
                      s("strong", null, i(o.value), 1),
                      s("small", null, i(o.note), 1)
                    ], 2))), 128))
                  ]),
                  s("section", zg, [
                    s("p", null, i(c.value ? "把计划、差异分析、Provider 修复、工作区映射与任务中心收束到同一个开发控制台。" : "Bring plan, diff analysis, provider repair, workspace mapping, and task follow-through into one developer control surface."), 1),
                    s("div", Yg, [
                      s("div", null, [
                        s("strong", null, i(c.value ? "工作流支持" : "Workflow Support"), 1),
                        s("div", Gg, [
                          (f(!0), v(C, null, $(h.value.workflowSupport || [], (o) => (f(), v("span", {
                            key: o.id,
                            class: j(["ox-vite-detail-chip", { "is-disabled": !o.enabled }])
                          }, [
                            s("i", {
                              class: j(o.enabled ? "fa-solid fa-circle-check" : "fa-regular fa-circle")
                            }, null, 2),
                            s("span", null, i(o.label), 1)
                          ], 2))), 128))
                        ])
                      ]),
                      s("div", null, [
                        s("strong", null, i(c.value ? "能力摘要" : "Capability Summary"), 1),
                        s("div", Qg, [
                          (f(!0), v(C, null, $(h.value.capabilitySummary || [], (o) => (f(), v("span", {
                            key: o.id,
                            class: j(["ox-vite-detail-chip", { "is-disabled": !o.enabled }])
                          }, [
                            s("i", {
                              class: j(o.enabled ? "fa-solid fa-square-check" : "fa-regular fa-square")
                            }, null, 2),
                            s("span", null, i(o.label), 1)
                          ], 2))), 128))
                        ])
                      ])
                    ])
                  ]),
                  s("section", Xg, [
                    s("article", Jg, [
                      s("div", Zg, [
                        s("h2", null, i(c.value ? "模型服务商" : "Provider Setup"), 1),
                        s("p", null, i(h.value.providerCard?.message || (c.value ? "本地 OpenXnet Runtime 与模型服务的主要接入点。" : "Primary entry for the desktop runtime and model provider integration.")), 1)
                      ]),
                      s("div", e_, [
                        s("span", t_, i(h.value.providerCard?.status || "-"), 1),
                        s("span", s_, i(h.value.providerCard?.apiKeyConfigured ? c.value ? "已配置 API Key" : "API key configured" : c.value ? "缺少 API Key" : "API key missing"), 1),
                        s("span", n_, i(h.value.providerCard?.providerCount) + " " + i(c.value ? "个 provider 选项" : "provider options"), 1)
                      ]),
                      s("div", l_, [
                        s("label", i_, [
                          s("span", null, i((c.value, "Vendor")), 1),
                          s("input", {
                            value: h.value.providerCard?.vendor,
                            disabled: "",
                            type: "text"
                          }, null, 8, o_)
                        ]),
                        s("label", a_, [
                          s("span", null, i(c.value ? "模型" : "Model"), 1),
                          s("input", {
                            value: h.value.providerCard?.model,
                            disabled: "",
                            type: "text"
                          }, null, 8, r_)
                        ]),
                        s("label", c_, [
                          u[89] || (u[89] = s("span", null, "URL", -1)),
                          s("input", {
                            value: h.value.providerCard?.url,
                            disabled: "",
                            type: "text"
                          }, null, 8, u_)
                        ])
                      ]),
                      h.value.providerCard?.validationMessage ? (f(), v("div", d_, i(h.value.providerCard?.validationMessage), 1)) : Y("", !0)
                    ]),
                    s("article", p_, [
                      s("div", f_, [
                        s("h2", null, i(c.value ? "OpenXnet-Server 网关" : "Gateway Provider"), 1),
                        s("p", null, i(h.value.gatewayCard?.message || (c.value ? "用于服务端 profile 的模型接入和网关治理。" : "Provider access and gateway governance for the server profile.")), 1)
                      ]),
                      s("div", v_, [
                        s("span", g_, i(h.value.gatewayCard?.enabled ? c.value ? "已启用" : "Enabled" : c.value ? "未启用" : "Disabled"), 1),
                        s("span", __, i(h.value.gatewayCard?.reachable ? c.value ? "可达" : "Reachable" : c.value ? "不可达" : "Unreachable"), 1),
                        s("span", h_, i(h.value.gatewayCard?.providerCount) + " " + i(c.value ? "个 provider 选项" : "provider options"), 1)
                      ]),
                      s("div", m_, [
                        s("label", b_, [
                          s("span", null, i((c.value, "Vendor")), 1),
                          s("input", {
                            value: h.value.gatewayCard?.vendor,
                            disabled: "",
                            type: "text"
                          }, null, 8, y_)
                        ]),
                        s("label", x_, [
                          s("span", null, i(c.value ? "模型" : "Model"), 1),
                          s("input", {
                            value: h.value.gatewayCard?.model,
                            disabled: "",
                            type: "text"
                          }, null, 8, k_)
                        ]),
                        s("label", S_, [
                          u[90] || (u[90] = s("span", null, "URL", -1)),
                          s("input", {
                            value: h.value.gatewayCard?.url,
                            disabled: "",
                            type: "text"
                          }, null, 8, w_)
                        ]),
                        s("label", C_, [
                          s("span", null, i(c.value ? "管理地址" : "Management URL"), 1),
                          s("input", {
                            value: h.value.gatewayCard?.managementUrl || "-",
                            disabled: "",
                            type: "text"
                          }, null, 8, M_)
                        ])
                      ])
                    ]),
                    s("article", P_, [
                      s("div", R_, [
                        s("h2", null, i(c.value ? "默认映射" : "Default Mapping"), 1),
                        s("p", null, i(h.value.mappingCard?.message || (c.value ? "主智能体、模型解析和 provider 映射应在这里先校准。" : "Tune the main agent, model resolution, and provider mapping here first.")), 1)
                      ]),
                      s("div", T_, [
                        s("article", E_, [
                          s("div", null, [
                            s("strong", null, i(c.value ? "主智能体" : "Main Agent"), 1)
                          ]),
                          s("span", null, i(h.value.mappingCard?.agent || "-"), 1)
                        ]),
                        s("article", A_, [
                          s("div", null, [
                            s("strong", null, i(c.value ? "当前模型" : "Current Model"), 1)
                          ]),
                          s("span", null, i(h.value.mappingCard?.currentModel || "-"), 1)
                        ]),
                        s("article", D_, [
                          s("div", null, [
                            s("strong", null, i(c.value ? "解析结果" : "Resolved Model"), 1)
                          ]),
                          s("span", null, i(h.value.mappingCard?.resolvedModel || "-"), 1)
                        ]),
                        s("article", O_, [
                          s("div", null, [
                            s("strong", null, i(c.value ? "解析来源" : "Resolution Source"), 1)
                          ]),
                          s("span", null, i(h.value.mappingCard?.resolutionSource || "-"), 1)
                        ])
                      ]),
                      s("div", V_, [
                        s("span", $_, i(h.value.mappingCard?.providerModelCount) + " " + i(c.value ? "个 provider 模型" : "provider models"), 1),
                        s("span", F_, i(h.value.mappingCard?.agentCount) + " " + i(c.value ? "个 agent 选项" : "agent options"), 1)
                      ])
                    ]),
                    s("article", I_, [
                      s("div", L_, [
                        s("h2", null, i(c.value ? "CLI 工作区" : "CLI Workspace"), 1),
                        s("p", null, i(h.value.workspaceCard?.message || (c.value ? "CLI 工作区路径、权限模式和可见范围决定后续开发动作的落点。" : "Workspace path, permission mode, and visibility scope define where later coding actions land.")), 1)
                      ]),
                      s("div", j_, [
                        s("span", B_, i(h.value.workspaceCard?.status || "-"), 1),
                        s("span", N_, i(h.value.workspaceCard?.exists ? c.value ? "路径存在" : "Path exists" : c.value ? "路径缺失" : "Path missing"), 1)
                      ]),
                      s("div", W_, [
                        s("label", U_, [
                          s("span", null, i(c.value ? "工作区路径" : "Workspace Path"), 1),
                          s("input", {
                            value: h.value.workspaceCard?.path,
                            disabled: "",
                            type: "text"
                          }, null, 8, K_)
                        ]),
                        s("label", H_, [
                          s("span", null, i(c.value ? "执行引擎" : "Engine"), 1),
                          s("input", {
                            value: h.value.workspaceCard?.engine,
                            disabled: "",
                            type: "text"
                          }, null, 8, q_)
                        ]),
                        s("label", z_, [
                          s("span", null, i(c.value ? "权限模式" : "Permission Mode"), 1),
                          s("input", {
                            value: h.value.workspaceCard?.permissionMode,
                            disabled: "",
                            type: "text"
                          }, null, 8, Y_)
                        ]),
                        s("label", G_, [
                          s("span", null, i(c.value ? "可见范围" : "Visibility Scope"), 1),
                          s("input", {
                            value: h.value.workspaceCard?.visibilityScope,
                            disabled: "",
                            type: "text"
                          }, null, 8, Q_)
                        ])
                      ]),
                      h.value.workspaceCard?.recommendedReason ? (f(), v("div", X_, i(h.value.workspaceCard?.recommendedReason), 1)) : Y("", !0)
                    ])
                  ]),
                  s("section", J_, [
                    s("article", Z_, [
                      s("div", eh, [
                        s("h2", null, i(c.value ? "配置就绪度" : "Configuration Readiness"), 1),
                        s("p", null, i(c.value ? "先把运行 Profile、模型接入和 CLI 工作区状态收敛清楚，再让后续任务持续落在正确轨道。" : "Clarify runtime profile, model access, and workspace state before letting later tasks run on the wrong track."), 1)
                      ]),
                      s("div", th, [
                        (f(!0), v(C, null, $(h.value.readiness || [], (o) => (f(), v("article", {
                          key: o.id,
                          class: "ox-vite-list-row"
                        }, [
                          s("div", null, [
                            s("strong", null, i(o.label), 1),
                            s("p", null, i(o.note), 1)
                          ]),
                          s("span", sh, i(o.status), 1)
                        ]))), 128))
                      ])
                    ]),
                    s("article", nh, [
                      s("div", lh, [
                        s("h2", null, i(c.value ? "最近开发任务" : "Recent Dev Tasks"), 1),
                        s("p", null, i(c.value ? "把开发流里最近提交的计划、Review 和 Patch 任务继续收束到同一工作面。" : "Keep recent plan, review, and patch tasks visible inside the same workbench."), 1)
                      ]),
                      s("div", ih, [
                        (f(!0), v(C, null, $(h.value.recentTasks || [], (o) => (f(), v("article", {
                          key: o.id,
                          class: "ox-vite-list-row"
                        }, [
                          s("div", null, [
                            s("strong", null, i(o.title), 1),
                            s("p", null, i(o.workflow) + " · " + i(o.updatedAt), 1)
                          ]),
                          s("span", oh, i(o.status), 1)
                        ]))), 128)),
                        (h.value.recentTasks || []).length ? Y("", !0) : (f(), v("article", ah, [
                          s("div", null, [
                            s("strong", null, i(c.value ? "还没有最近任务" : "No recent tasks yet"), 1),
                            s("p", null, i(c.value ? "等开发任务创建后，这里会开始沉淀最近活动。" : "Recent activity will appear here once dev tasks are created."), 1)
                          ])
                        ]))
                      ])
                    ]),
                    s("article", rh, [
                      s("div", ch, [
                        s("h2", null, i(c.value ? "工作流模板" : "Workflow Templates"), 1),
                        s("p", null, i(c.value ? "这里会持续沉淀计划、Review、Diff 和 Patch 的工作模板。" : "This panel collects reusable templates for plan, review, diff, and patch workflows."), 1)
                      ]),
                      s("div", uh, [
                        (f(!0), v(C, null, $(h.value.templates || [], (o) => (f(), v("article", {
                          key: o.id,
                          class: "ox-vite-list-row"
                        }, [
                          s("div", null, [
                            s("strong", null, i(o.title), 1),
                            s("p", null, i(o.summary || o.suggestedGoal || "-"), 1)
                          ]),
                          s("span", dh, i(o.id), 1)
                        ]))), 128)),
                        (h.value.templates || []).length ? Y("", !0) : (f(), v("article", ph, [
                          s("div", null, [
                            s("strong", null, i(c.value ? "还没有模板" : "No templates yet"), 1),
                            s("p", null, i(c.value ? "模板加载完成后，会显示建议目标和默认工作流。" : "Templates will show suggested goals and default workflows once loaded."), 1)
                          ])
                        ]))
                      ])
                    ]),
                    s("article", fh, [
                      s("div", vh, [
                        s("h2", null, i(c.value ? "当前告警" : "Warnings"), 1),
                        s("p", null, i(c.value ? "阻塞项和注意事项应该集中出现在工作台里，而不是藏在设置深处。" : "Blockers and cautions should stay visible in the workbench instead of hiding deep in settings."), 1)
                      ]),
                      s("div", gh, [
                        (f(!0), v(C, null, $(h.value.warnings || [], (o, E) => (f(), v("article", {
                          key: `${E}-${o}`,
                          class: "ox-vite-list-row"
                        }, [
                          s("div", null, [
                            s("strong", null, i(c.value ? "注意事项" : "Warning"), 1),
                            s("p", null, i(o), 1)
                          ])
                        ]))), 128)),
                        (h.value.warnings || []).length ? Y("", !0) : (f(), v("article", _h, [
                          s("div", null, [
                            s("strong", null, i(c.value ? "当前没有告警" : "No warnings right now"), 1),
                            s("p", null, i(c.value ? "当 provider、映射或工作区存在风险时，这里会优先显示。" : "Provider, mapping, or workspace issues will surface here first."), 1)
                          ])
                        ]))
                      ])
                    ])
                  ])
                ], 64)) : (f(), v("section", hh, [
                  s("article", mh, [
                    s("div", bh, [
                      s("h2", null, i(h.value.meta?.title), 1),
                      s("p", null, i(h.value.meta?.summary), 1)
                    ]),
                    s("div", yh, [
                      (f(!0), v(C, null, $(h.value.stats || [], (o) => (f(), v("article", {
                        key: o.label,
                        class: "ox-vite-list-row"
                      }, [
                        s("div", null, [
                          s("strong", null, i(o.label), 1),
                          s("p", null, i(o.meta), 1)
                        ]),
                        s("span", null, i(o.value), 1)
                      ]))), 128))
                    ])
                  ])
                ]))
              ], 64)) : t.surface === "enterprise" ? (f(), v(C, { key: 5 }, [
                s("section", xh, [
                  (f(!0), v(C, null, $(h.value.topStats || [], (o) => (f(), v("article", {
                    key: o.title,
                    class: "ox-vite-stat-card"
                  }, [
                    s("span", null, i(o.title), 1),
                    s("strong", null, i(o.value), 1),
                    s("small", null, i(o.note), 1)
                  ]))), 128))
                ]),
                s("section", kh, [
                  s("p", null, i(h.value.meta?.summary), 1),
                  s("div", Sh, [
                    (f(!0), v(C, null, $(h.value.meta?.chips || [], (o) => (f(), v("span", {
                      key: o.icon + o.text,
                      class: "ox-vite-detail-chip"
                    }, [
                      s("i", {
                        class: j(o.icon)
                      }, null, 2),
                      s("span", null, i(o.text), 1)
                    ]))), 128))
                  ])
                ]),
                h.value.activeTab === "usage" ? (f(), v(C, { key: 0 }, [
                  s("section", wh, [
                    (f(!0), v(C, null, $(h.value.usagePanel?.metrics || [], (o) => (f(), v("article", {
                      key: o.label,
                      class: "ox-vite-stat-card"
                    }, [
                      s("span", null, i(o.label), 1),
                      s("strong", null, i(o.value), 1)
                    ]))), 128))
                  ]),
                  s("section", Ch, [
                    s("article", Mh, [
                      s("div", Ph, [
                        s("h2", null, i(c.value ? "用量趋势" : "Usage Trend"), 1),
                        s("p", null, i(c.value ? "这里先把近期 token 变化做成轻量条形视图，后续继续贴近原型中的图表层次。" : "A lightweight token trend view for now, with a closer chart treatment coming next."), 1)
                      ]),
                      s("div", Rh, [
                        (f(!0), v(C, null, $(h.value.usagePanel?.trend || [], (o) => (f(), v("div", {
                          key: o.id,
                          class: "ox-vite-mini-bars__item"
                        }, [
                          s("div", {
                            class: "ox-vite-mini-bars__bar",
                            style: tt({ height: `${Math.max(10, Math.min(100, o.value ? o.value / Math.max(...(h.value.usagePanel?.trend || []).map((E) => E.value || 0), 1) * 100 : 10))}%` })
                          }, null, 4),
                          s("span", null, i(o.label), 1)
                        ]))), 128))
                      ])
                    ]),
                    s("article", Th, [
                      s("div", Eh, [
                        s("h2", null, i(c.value ? "模型用量" : "Usage by Model"), 1)
                      ]),
                      s("div", Ah, [
                        (f(!0), v(C, null, $(h.value.usagePanel?.models || [], (o) => (f(), v("article", {
                          key: o.id,
                          class: "ox-vite-list-row"
                        }, [
                          s("div", null, [
                            s("strong", null, i(o.name), 1),
                            s("p", null, i(o.requests) + " " + i(c.value ? "次请求" : "requests"), 1)
                          ]),
                          s("span", null, i(o.tokens) + " tokens · $" + i(o.cost.toFixed(4)), 1)
                        ]))), 128))
                      ])
                    ])
                  ]),
                  s("section", Dh, [
                    s("div", Oh, [
                      s("h2", null, i(c.value ? "用户用量" : "Usage by User"), 1)
                    ]),
                    s("div", Vh, [
                      (f(!0), v(C, null, $(h.value.usagePanel?.users || [], (o) => (f(), v("article", {
                        key: o.id,
                        class: "ox-vite-list-row"
                      }, [
                        s("div", null, [
                          s("strong", null, i(o.name), 1),
                          s("p", null, i(o.requests) + " " + i(c.value ? "次请求" : "requests"), 1)
                        ]),
                        s("span", null, i(o.tokens) + " tokens · " + i(o.latency) + "ms", 1)
                      ]))), 128))
                    ])
                  ])
                ], 64)) : h.value.activeTab === "neuro" ? (f(), v(C, { key: 1 }, [
                  s("section", $h, [
                    (f(!0), v(C, null, $(h.value.neuroPanel?.metrics || [], (o) => (f(), v("article", {
                      key: o.label,
                      class: "ox-vite-stat-card"
                    }, [
                      s("span", null, i(o.label), 1),
                      s("strong", null, i(o.value), 1)
                    ]))), 128))
                  ]),
                  s("section", Fh, [
                    s("article", Ih, [
                      s("div", Lh, [
                        s("h2", null, i(c.value ? "神经符号" : "Symbols"), 1)
                      ]),
                      s("div", jh, [
                        (f(!0), v(C, null, $(h.value.neuroPanel?.symbols || [], (o) => (f(), v("article", {
                          key: o.id,
                          class: "ox-vite-list-row"
                        }, [
                          s("div", null, [
                            s("strong", null, i(o.label), 1),
                            s("p", null, i(o.operator) + " · " + i(o.entities.join(", ") || "-"), 1)
                          ]),
                          s("span", null, i(Math.round(o.successRate * 100)) + "% · " + i(o.activations), 1)
                        ]))), 128))
                      ])
                    ]),
                    s("article", Bh, [
                      s("div", Nh, [
                        s("h2", null, i(c.value ? "认知规则" : "Cognitive Rules"), 1)
                      ]),
                      s("div", Wh, [
                        (f(!0), v(C, null, $(h.value.neuroPanel?.rules || [], (o) => (f(), v("article", {
                          key: o.id,
                          class: "ox-vite-list-row"
                        }, [
                          s("div", null, [
                            s("strong", null, i(o.name), 1),
                            s("p", null, i(o.domain) + " · " + i(o.description), 1)
                          ]),
                          s("span", null, i(o.enabled ? "ON" : "OFF"), 1)
                        ]))), 128))
                      ])
                    ])
                  ])
                ], 64)) : h.value.activeTab === "kg" ? (f(), v(C, { key: 2 }, [
                  s("section", Uh, [
                    (f(!0), v(C, null, $(h.value.kgPanel?.metrics || [], (o) => (f(), v("article", {
                      key: o.label,
                      class: "ox-vite-stat-card"
                    }, [
                      s("span", null, i(o.label), 1),
                      s("strong", null, i(o.value), 1)
                    ]))), 128))
                  ]),
                  s("section", Kh, [
                    s("div", Hh, [
                      s("h2", null, i(c.value ? "实体事实" : "Entity Facts"), 1),
                      s("p", null, i(c.value ? "这一层先把知识图谱查询结果收束成可读列表，后续再继续贴近图谱可视化原型。" : "This pass keeps graph query results readable first, with a more visual graph view to follow."), 1)
                    ]),
                    s("div", qh, [
                      (f(!0), v(C, null, $(h.value.kgPanel?.facts || [], (o) => (f(), v("article", {
                        key: o.id,
                        class: "ox-vite-list-row"
                      }, [
                        s("div", null, [
                          s("strong", null, i(o.subject), 1),
                          s("p", null, i(o.predicate), 1)
                        ]),
                        s("span", null, i(o.object), 1)
                      ]))), 128)),
                      (h.value.kgPanel?.facts || []).length ? Y("", !0) : (f(), v("article", zh, [
                        s("div", null, [
                          s("strong", null, i(c.value ? "当前没有实体事实" : "No entity facts yet"), 1),
                          s("p", null, i(c.value ? "当图谱实体查询成功后，结果会先沉淀在这里。" : "Facts will appear here once entity queries return data."), 1)
                        ])
                      ]))
                    ])
                  ])
                ], 64)) : h.value.activeTab === "enterprise-kb" ? (f(), v("section", Yh, [
                  s("section", Gh, [
                    s("div", Qh, [
                      s("div", Xh, i(c.value ? "企业知识库" : "Enterprise Knowledge"), 1),
                      s("h2", null, i(c.value ? "统一管理知识库、分类与文档沉淀" : "Manage knowledge bases, categories, and document coverage in one place"), 1),
                      s("p", null, i(c.value ? "把知识库、分类、文档规模和版本演进收束进同一条企业工作流，便于团队共享知识和后续接入知识图谱。" : "Keep knowledge bases, categories, document scale, and version history aligned in one enterprise workflow."), 1)
                    ]),
                    s("div", Jh, [
                      s("article", Zh, [
                        s("span", null, i(Lt.value.totalCount || (Lt.value.items || []).length), 1),
                        s("small", null, i(c.value ? "知识库" : "KBs"), 1)
                      ]),
                      s("article", em, [
                        s("span", null, i(Lt.value.totalDocs || 0), 1),
                        s("small", null, i(c.value ? "文档总量" : "Docs"), 1)
                      ]),
                      s("article", tm, [
                        s("span", null, i(pn.value.length - 1), 1),
                        s("small", null, i(c.value ? "分类" : "Categories"), 1)
                      ])
                    ])
                  ]),
                  s("section", sm, [
                    s("div", nm, [
                      u[92] || (u[92] = s("i", { class: "fa-solid fa-magnifying-glass" }, null, -1)),
                      Et(s("input", {
                        "onUpdate:modelValue": u[19] || (u[19] = (o) => ot.value = o),
                        type: "text",
                        placeholder: c.value ? "搜索知识库名称、分类或描述" : "Search KB name, category, or description"
                      }, null, 8, lm), [
                        [Wt, ot.value]
                      ]),
                      ot.value ? (f(), v("button", {
                        key: 0,
                        type: "button",
                        class: "ox-vite-role-search__clear",
                        onClick: u[20] || (u[20] = (o) => ot.value = "")
                      }, [...u[91] || (u[91] = [
                        s("i", { class: "fa-solid fa-xmark" }, null, -1)
                      ])])) : Y("", !0)
                    ]),
                    s("button", {
                      type: "button",
                      class: "ox-vite-ops-primary-btn",
                      onClick: no
                    }, [
                      u[93] || (u[93] = s("i", { class: "fa-solid fa-plus" }, null, -1)),
                      s("span", null, i(c.value ? "新建知识库" : "Create KB"), 1)
                    ])
                  ]),
                  s("section", im, [
                    (f(!0), v(C, null, $(pn.value, (o) => (f(), v("button", {
                      key: o.id,
                      type: "button",
                      class: j(["ox-vite-role-category-chip", { "is-active": Ze.value === o.id }]),
                      onClick: (E) => Ze.value = o.id
                    }, [
                      s("span", null, i(o.label), 1),
                      s("strong", null, i(o.id === "all" ? (Lt.value.items || []).length : (Lt.value.items || []).filter((E) => E.category === o.id).length), 1)
                    ], 10, om))), 128))
                  ]),
                  s("section", am, [
                    s("article", rm, [
                      s("div", cm, [
                        s("div", null, [
                          s("div", um, i(c.value ? "知识库列表" : "Knowledge Base Library"), 1),
                          s("h2", null, i(c.value ? "当前企业知识库" : "Current Enterprise Knowledge Bases"), 1)
                        ]),
                        s("div", dm, i(fn.value.length), 1)
                      ]),
                      fn.value.length ? (f(), v("div", pm, [
                        (f(!0), v(C, null, $(fn.value, (o) => (f(), v("article", {
                          key: o.id,
                          class: "ox-vite-kb-card"
                        }, [
                          s("div", fm, [
                            s("div", vm, [
                              u[94] || (u[94] = s("div", { class: "ox-vite-kb-card__icon" }, [
                                s("i", { class: "fa-solid fa-book-open" })
                              ], -1)),
                              s("div", null, [
                                s("div", gm, i(o.name), 1),
                                s("div", _m, i(o.category), 1)
                              ])
                            ]),
                            s("span", hm, i(o.docs) + " " + i(c.value ? "篇文档" : "docs"), 1)
                          ]),
                          s("p", null, i(o.description || (c.value ? "当前知识库还没有补充描述。" : "No KB description yet.")), 1),
                          s("div", mm, [
                            o.updatedAt ? (f(), v("span", bm, i(o.updatedAt), 1)) : Y("", !0)
                          ]),
                          s("div", ym, [
                            s("button", {
                              type: "button",
                              class: "ox-vite-ops-secondary-btn",
                              onClick: (E) => lo(o)
                            }, [
                              u[95] || (u[95] = s("i", { class: "fa-solid fa-pen" }, null, -1)),
                              s("span", null, i(c.value ? "编辑" : "Edit"), 1)
                            ], 8, xm),
                            s("button", {
                              type: "button",
                              class: "ox-vite-ops-secondary-btn",
                              onClick: (E) => ao(o)
                            }, [
                              u[96] || (u[96] = s("i", { class: "fa-solid fa-clock-rotate-left" }, null, -1)),
                              s("span", null, i(c.value ? "版本" : "Versions"), 1)
                            ], 8, km),
                            s("button", {
                              type: "button",
                              class: "ox-vite-ops-secondary-btn",
                              onClick: (E) => oo(o)
                            }, [
                              u[97] || (u[97] = s("i", { class: "fa-regular fa-trash-can" }, null, -1)),
                              s("span", null, i(c.value ? "删除" : "Delete"), 1)
                            ], 8, Sm)
                          ])
                        ]))), 128))
                      ])) : (f(), v("div", wm, [
                        u[98] || (u[98] = s("i", { class: "fa-solid fa-book-open" }, null, -1)),
                        s("strong", null, i(c.value ? "还没有知识库" : "No knowledge bases yet"), 1),
                        s("p", null, i(c.value ? "先创建一个知识库，后续再继续承接文档上传和版本演进。" : "Create the first KB, then continue with docs and version flows."), 1)
                      ]))
                    ]),
                    s("aside", Cm, [
                      at.value === "editor" && Re.value ? (f(), v(C, { key: 0 }, [
                        s("div", Mm, [
                          s("div", null, [
                            s("div", Pm, i(c.value ? "知识库编辑器" : "KB Editor"), 1),
                            s("h2", null, i(we.value.id ? c.value ? "编辑知识库" : "Edit Knowledge Base" : c.value ? "新建知识库" : "Create Knowledge Base"), 1)
                          ])
                        ]),
                        s("div", Rm, [
                          s("label", Tm, [
                            s("span", null, i(c.value ? "知识库名称" : "KB Name"), 1),
                            Et(s("input", {
                              "onUpdate:modelValue": u[21] || (u[21] = (o) => we.value.name = o),
                              type: "text"
                            }, null, 512), [
                              [Wt, we.value.name]
                            ])
                          ]),
                          s("label", Em, [
                            s("span", null, i(c.value ? "分类" : "Category"), 1),
                            Et(s("input", {
                              "onUpdate:modelValue": u[22] || (u[22] = (o) => we.value.category = o),
                              type: "text"
                            }, null, 512), [
                              [Wt, we.value.category]
                            ])
                          ]),
                          s("label", Am, [
                            s("span", null, i(c.value ? "描述" : "Description"), 1),
                            Et(s("input", {
                              "onUpdate:modelValue": u[23] || (u[23] = (o) => we.value.description = o),
                              type: "text"
                            }, null, 512), [
                              [Wt, we.value.description]
                            ])
                          ])
                        ]),
                        s("div", Dm, [
                          s("button", {
                            type: "button",
                            class: "ox-vite-ops-secondary-btn",
                            onClick: u[24] || (u[24] = (o) => {
                              Re.value = !1, at.value = "summary";
                            })
                          }, [
                            u[99] || (u[99] = s("i", { class: "fa-solid fa-xmark" }, null, -1)),
                            s("span", null, i(c.value ? "取消" : "Cancel"), 1)
                          ]),
                          s("button", {
                            type: "button",
                            class: "ox-vite-ops-primary-btn",
                            disabled: !we.value.name,
                            onClick: io
                          }, [
                            u[100] || (u[100] = s("i", { class: "fa-solid fa-check" }, null, -1)),
                            s("span", null, i(we.value.id ? c.value ? "保存" : "Save" : c.value ? "创建" : "Create"), 1)
                          ], 8, Om)
                        ])
                      ], 64)) : at.value === "versions" && Rt.value ? (f(), v(C, { key: 1 }, [
                        s("div", Vm, [
                          s("div", null, [
                            s("div", $m, i(c.value ? "版本历史" : "Version History"), 1),
                            s("h2", null, i(c.value ? "知识库版本演进" : "Knowledge Base Revisions"), 1)
                          ])
                        ]),
                        $t.value.length ? (f(), v("div", Fm, [
                          (f(!0), v(C, null, $($t.value, (o, E) => (f(), v("article", {
                            key: `${o.version || E}`,
                            class: "ox-vite-list-row"
                          }, [
                            s("div", null, [
                              s("strong", null, "v" + i(o.version || E + 1), 1),
                              s("p", null, i(o.created_at || (c.value ? "暂无时间信息" : "No timestamp")), 1)
                            ]),
                            s("span", null, i(o.doc_count || 0) + " " + i(c.value ? "篇文档" : "docs"), 1)
                          ]))), 128))
                        ])) : (f(), v("div", Im, [
                          u[101] || (u[101] = s("i", { class: "fa-solid fa-clock-rotate-left" }, null, -1)),
                          s("strong", null, i(c.value ? "暂无版本历史" : "No version history yet"), 1)
                        ])),
                        s("div", Lm, [
                          s("button", {
                            type: "button",
                            class: "ox-vite-ops-secondary-btn",
                            onClick: u[25] || (u[25] = (o) => {
                              Rt.value = !1, at.value = "summary";
                            })
                          }, [
                            u[102] || (u[102] = s("i", { class: "fa-solid fa-arrow-left" }, null, -1)),
                            s("span", null, i(c.value ? "返回" : "Back"), 1)
                          ])
                        ])
                      ], 64)) : (f(), v(C, { key: 2 }, [
                        s("div", jm, [
                          s("div", null, [
                            s("div", Bm, i(c.value ? "知识工程提示" : "Knowledge Engineering Notes"), 1),
                            s("h2", null, i(c.value ? "先把知识库沉淀成稳定入口" : "Turn KBs into a stable operating surface first"), 1)
                          ])
                        ]),
                        s("div", Nm, [
                          s("article", Wm, [
                            s("div", null, [
                              s("strong", null, i(c.value ? "分类先于扩张" : "Categorize before scaling"), 1),
                              s("p", null, i(c.value ? "先让知识库有清晰分类和描述，再继续接文档上传和图谱关系。" : "Give each KB a clear category and scope before expanding into files and graph links."), 1)
                            ])
                          ]),
                          s("article", Um, [
                            s("div", null, [
                              s("strong", null, i(c.value ? "版本历史保留审计线" : "Version history preserves the audit trail"), 1),
                              s("p", null, i(c.value ? "后续继续细化版本差异、回滚和文档批次信息。" : "The next pass can deepen version diff, rollback, and document batch details."), 1)
                            ])
                          ])
                        ])
                      ], 64))
                    ])
                  ])
                ])) : h.value.activeTab === "staff-roles" ? (f(), v("section", Km, [
                  s("section", Hm, [
                    s("div", qm, [
                      s("div", zm, i(c.value ? "OpenXnet 内置岗位中心" : "OpenXnet Built-in Role Studio"), 1),
                      s("h2", null, i(c.value ? "OpenXnet 内置职工角色模板库" : "OpenXnet Built-in Staff Role Library"), 1),
                      s("p", null, i(c.value ? "围绕平台工程、知识工程、测试质量、客户服务等方向扩展更多员工类型角色，便于企业空间快速组建协作团队，同时保持命名、文案和布局为 OpenXnet 自有表达。" : "Expand staff roles across platform, knowledge, quality, and service domains so enterprise spaces can assemble teams quickly with OpenXnet-native naming and presentation."), 1)
                    ]),
                    s("div", Ym, [
                      s("article", Gm, [
                        s("span", null, i(ns.value.templateCount || It.value.length), 1),
                        s("small", null, i(c.value ? "岗位模板" : "Templates"), 1)
                      ]),
                      s("article", Qm, [
                        s("span", null, i(ns.value.createdCount || ls.value.length), 1),
                        s("small", null, i(c.value ? "已创建员工" : "Created Roles"), 1)
                      ]),
                      s("article", Xm, [
                        s("span", null, i(ns.value.enabledCount || ls.value.filter((o) => o.enabled).length), 1),
                        s("small", null, i(c.value ? "启用中" : "Enabled"), 1)
                      ])
                    ])
                  ]),
                  s("section", Jm, [
                    s("div", Zm, [
                      u[104] || (u[104] = s("i", { class: "fa-solid fa-magnifying-glass" }, null, -1)),
                      Et(s("input", {
                        "onUpdate:modelValue": u[26] || (u[26] = (o) => le.value = o),
                        type: "text",
                        placeholder: c.value ? "搜索岗位名称、部门、技能或职责" : "Search roles, departments, skills, or responsibilities"
                      }, null, 8, eb), [
                        [Wt, le.value]
                      ]),
                      le.value ? (f(), v("button", {
                        key: 0,
                        type: "button",
                        class: "ox-vite-role-search__clear",
                        onClick: u[27] || (u[27] = (o) => le.value = "")
                      }, [...u[103] || (u[103] = [
                        s("i", { class: "fa-solid fa-xmark" }, null, -1)
                      ])])) : Y("", !0)
                    ]),
                    s("button", {
                      type: "button",
                      class: "ox-vite-ops-primary-btn",
                      onClick: W
                    }, [
                      u[105] || (u[105] = s("i", { class: "fa-solid fa-user-plus" }, null, -1)),
                      s("span", null, i(c.value ? "新建自定义员工" : "Create Custom Role"), 1)
                    ])
                  ]),
                  s("section", tb, [
                    (f(!0), v(C, null, $(ro.value, (o) => (f(), v("button", {
                      key: o.id,
                      type: "button",
                      class: j(["ox-vite-role-category-chip", { "is-active": Je.value === o.id }]),
                      onClick: (E) => Je.value = o.id
                    }, [
                      s("span", null, i(o.label), 1),
                      s("strong", null, i(uo(o.id)), 1)
                    ], 10, sb))), 128))
                  ]),
                  s("section", nb, [
                    s("article", lb, [
                      s("div", ib, [
                        s("div", null, [
                          s("div", ob, i(c.value ? "内置模板岗位库" : "Built-in Template Library"), 1),
                          s("h2", null, i(c.value ? "从模板快速创建职工角色卡" : "Quickly Create Staff Roles from Templates"), 1)
                        ]),
                        s("div", ab, i(an.value.length), 1)
                      ]),
                      an.value.length ? (f(), v("div", rb, [
                        (f(!0), v(C, null, $(an.value, (o) => (f(), v("button", {
                          key: o.id,
                          type: "button",
                          class: "ox-vite-role-template-card",
                          style: tt(dn(o)),
                          onClick: (E) => z(o.id)
                        }, [
                          u[107] || (u[107] = s("div", { class: "ox-vite-role-template-card__glow" }, null, -1)),
                          s("div", ub, [
                            s("div", db, [
                              s("i", {
                                class: j(o.icon)
                              }, null, 2)
                            ]),
                            s("span", pb, i(o.categoryLabel || (c.value ? "未分类" : "Uncategorized")), 1)
                          ]),
                          s("div", fb, i(o.name), 1),
                          s("div", vb, i(o.department), 1),
                          s("p", gb, i(o.summary), 1),
                          s("div", _b, [
                            (f(!0), v(C, null, $(o.skills || [], (E) => (f(), v("span", {
                              key: `${o.id}-${E}`,
                              class: "ox-vite-detail-chip"
                            }, i(E), 1))), 128))
                          ]),
                          s("div", hb, [
                            s("span", null, i(c.value ? "点击创建" : "Create from this role"), 1),
                            u[106] || (u[106] = s("i", { class: "fa-solid fa-arrow-up-right-from-square" }, null, -1))
                          ])
                        ], 12, cb))), 128))
                      ])) : (f(), v("div", mb, [
                        u[108] || (u[108] = s("i", { class: "fa-solid fa-folder-open" }, null, -1)),
                        s("strong", null, i(c.value ? "没有匹配的岗位模板" : "No matching staff role templates"), 1),
                        s("p", null, i(c.value ? "可以更换分类或清空搜索条件后继续查看。" : "Try a different category or clear the search to continue."), 1)
                      ]))
                    ]),
                    s("aside", bb, [
                      s("div", yb, [
                        s("div", null, [
                          s("div", xb, i(c.value ? "推荐模板" : "Spotlight"), 1),
                          s("h2", null, i(c.value ? "优先启用的岗位组合" : "Recommended Role Mixes"), 1)
                        ])
                      ]),
                      s("div", kb, [
                        (f(!0), v(C, null, $(co.value, (o) => (f(), v("button", {
                          key: `spotlight-${o.id}`,
                          type: "button",
                          class: "ox-vite-role-spotlight__card",
                          style: tt(dn(o)),
                          onClick: (E) => z(o.id)
                        }, [
                          s("div", wb, [
                            s("i", {
                              class: j(o.icon)
                            }, null, 2)
                          ]),
                          s("div", Cb, [
                            s("div", Mb, i(o.name), 1),
                            s("div", Pb, i(o.department), 1),
                            s("p", null, i(o.summary), 1)
                          ])
                        ], 12, Sb))), 128))
                      ]),
                      s("div", Rb, [
                        u[109] || (u[109] = s("i", { class: "fa-solid fa-sparkles" }, null, -1)),
                        s("span", null, i(c.value ? "建议先创建 2-3 个基础岗位，再为每个工作空间补充专业岗位，能更快形成团队协作闭环。" : "Start with 2-3 core roles, then add specialist roles per workspace to form a stronger collaboration loop."), 1)
                      ])
                    ])
                  ]),
                  s("section", Tb, [
                    s("div", Eb, [
                      s("div", null, [
                        s("div", Ab, i(c.value ? "我的员工卡" : "My Staff Roles"), 1),
                        s("h2", null, i(c.value ? "已创建的企业职工角色卡" : "Created Enterprise Staff Roles"), 1)
                      ]),
                      s("div", Db, i(ls.value.length), 1)
                    ]),
                    ls.value.length ? (f(), v("div", Ob, [
                      (f(!0), v(C, null, $(ls.value, (o) => (f(), v("article", {
                        key: o.id,
                        class: "ox-vite-role-library-card",
                        style: tt(dn(o))
                      }, [
                        s("div", Vb, [
                          s("span", {
                            class: j(["ox-vite-detail-chip", { "is-active": o.enabled }])
                          }, i(o.enabled ? c.value ? "启用中" : "Enabled" : c.value ? "已停用" : "Disabled"), 3),
                          s("button", {
                            type: "button",
                            class: "ox-vite-role-library-card__delete",
                            onClick: (E) => se(o.id)
                          }, [...u[110] || (u[110] = [
                            s("i", { class: "fa-regular fa-trash-can" }, null, -1)
                          ])], 8, $b)
                        ]),
                        s("div", Fb, [
                          s("div", Ib, [
                            s("i", {
                              class: j(o.icon)
                            }, null, 2)
                          ]),
                          s("div", Lb, [
                            s("div", jb, i(o.name), 1),
                            s("div", Bb, [
                              o.department ? (f(), v("span", Nb, i(o.department), 1)) : Y("", !0),
                              o.workspace ? (f(), v("span", Wb, i(o.workspace), 1)) : Y("", !0)
                            ])
                          ])
                        ]),
                        s("p", Ub, i(o.summary), 1),
                        s("div", Kb, [
                          (f(!0), v(C, null, $(o.skills || [], (E) => (f(), v("span", {
                            key: `${o.id}-${E}`,
                            class: "ox-vite-detail-chip"
                          }, i(E), 1))), 128))
                        ])
                      ], 4))), 128)),
                      s("button", {
                        type: "button",
                        class: "ox-vite-role-library-card ox-vite-role-library-card--add",
                        onClick: W
                      }, [
                        u[111] || (u[111] = s("i", { class: "fa-solid fa-user-plus" }, null, -1)),
                        s("div", null, i(c.value ? "添加职工角色卡" : "Add Staff Role"), 1)
                      ])
                    ])) : (f(), v("div", Hb, [
                      u[112] || (u[112] = s("i", { class: "fa-solid fa-user-group" }, null, -1)),
                      s("strong", null, i(c.value ? "还没有创建员工角色卡" : "No staff roles created yet"), 1),
                      s("p", null, i(c.value ? "先从模板岗位库中挑选一个岗位开始。" : "Start by choosing a template from the role library above."), 1)
                    ]))
                  ])
                ])) : h.value.activeTab === "enterprise-workspaces" ? (f(), v("section", qb, [
                  s("section", zb, [
                    s("div", Yb, [
                      s("div", Gb, i(c.value ? "企业工作空间" : "Enterprise Workspaces"), 1),
                      s("h2", null, i(c.value ? "统一管理工作空间、角色绑定与项目边界" : "Manage workspaces, role bindings, and project boundaries in one lane"), 1),
                      s("p", null, i(c.value ? "先在这里统一创建和检查工作空间，再进入企业沙盘查看项目楼层、员工角色和 3D 结构，避免菜单有入口但缺少对应工作空间配置。" : "Create and review workspaces here first, then enter the enterprise sandbox for projects, staff roles, and the 3D structure."), 1)
                    ]),
                    s("div", Qb, [
                      s("button", {
                        type: "button",
                        class: "ox-vite-ops-primary-btn",
                        onClick: oe
                      }, [
                        u[113] || (u[113] = s("i", { class: "fa-solid fa-plus" }, null, -1)),
                        s("span", null, i(c.value ? "创建工作空间" : "Create Workspace"), 1)
                      ])
                    ])
                  ]),
                  nl.value.items?.length ? (f(), v("section", Xb, [
                    (f(!0), v(C, null, $(nl.value.items || [], (o) => (f(), v("article", {
                      key: o.id,
                      class: "ox-vite-workspace-card"
                    }, [
                      s("div", Jb, [
                        s("div", Zb, [
                          u[114] || (u[114] = s("div", { class: "ox-vite-workspace-card__icon" }, [
                            s("i", { class: "fa-solid fa-building" })
                          ], -1)),
                          s("div", ey, [
                            s("div", ty, i(o.name), 1),
                            s("div", sy, i(o.summary || o.path), 1)
                          ])
                        ]),
                        s("span", ny, i(o.type), 1)
                      ]),
                      s("div", ly, [
                        s("article", iy, [
                          s("span", null, i(c.value ? "项目楼层" : "Projects"), 1),
                          s("strong", null, i(o.projectCount), 1)
                        ]),
                        s("article", oy, [
                          s("span", null, i(c.value ? "指派角色" : "Roles"), 1),
                          s("strong", null, i(o.roleCount), 1)
                        ]),
                        s("article", ay, [
                          s("span", null, i(c.value ? "权限" : "Permission"), 1),
                          s("strong", null, i(rl(o.permission)), 1)
                        ])
                      ]),
                      s("div", ry, [
                        s("span", cy, i(o.summary || o.path), 1),
                        o.updatedAt ? (f(), v("span", uy, i(o.updatedAt), 1)) : Y("", !0)
                      ]),
                      s("div", dy, [
                        s("button", {
                          type: "button",
                          class: "ox-vite-ops-primary-btn",
                          onClick: (E) => me(o.id)
                        }, [
                          u[115] || (u[115] = s("i", { class: "fa-solid fa-cube" }, null, -1)),
                          s("span", null, i(c.value ? "进入企业沙盘" : "Open Sandbox"), 1)
                        ], 8, py),
                        s("button", {
                          type: "button",
                          class: "ox-vite-ops-secondary-btn",
                          onClick: (E) => de(o.id)
                        }, [
                          u[116] || (u[116] = s("i", { class: "fa-solid fa-pen" }, null, -1)),
                          s("span", null, i(c.value ? "复制配置" : "Duplicate Draft"), 1)
                        ], 8, fy),
                        s("button", {
                          type: "button",
                          class: "ox-vite-ops-secondary-btn",
                          onClick: (E) => ke(o.id)
                        }, [
                          u[117] || (u[117] = s("i", { class: "fa-regular fa-trash-can" }, null, -1)),
                          s("span", null, i(c.value ? "删除" : "Delete"), 1)
                        ], 8, vy)
                      ])
                    ]))), 128))
                  ])) : (f(), v("section", gy, [
                    u[119] || (u[119] = s("i", { class: "fa-solid fa-building" }, null, -1)),
                    s("strong", null, i(c.value ? "还没有工作空间" : "No workspaces yet"), 1),
                    s("p", null, i(c.value ? "创建第一个工作空间后，这里会展示项目边界、权限和角色绑定。" : "Create the first workspace and this panel will show project boundaries, permissions, and role bindings."), 1),
                    s("button", {
                      type: "button",
                      class: "ox-vite-ops-primary-btn",
                      onClick: oe
                    }, [
                      u[118] || (u[118] = s("i", { class: "fa-solid fa-plus" }, null, -1)),
                      s("span", null, i(c.value ? "创建第一个工作空间" : "Create the first workspace"), 1)
                    ])
                  ]))
                ])) : h.value.activeTab === "enterprise-sandbox" ? (f(), v("section", _y, [
                  s("section", hy, [
                    s("div", my, [
                      he.value.level > 0 ? (f(), v("button", {
                        key: 0,
                        type: "button",
                        class: "ox-vite-sandbox-back",
                        onClick: Rs
                      }, [...u[120] || (u[120] = [
                        s("i", { class: "fa-solid fa-chevron-left" }, null, -1)
                      ])])) : Y("", !0),
                      s("div", by, [
                        s("div", yy, i(c.value ? "企业沙盘" : "Enterprise Sandbox"), 1),
                        s("h2", null, i(he.value.levelLabel || (c.value ? "企业园区" : "Enterprise Campus")), 1),
                        s("p", null, i(c.value ? "在这里按层级查看当前工作空间、项目楼层与员工编组，逐步逼近 3D 沙盘里的结构关系。" : "Inspect the current workspace, project floors, and staff roster by level, moving closer to the full 3D sandbox structure."), 1)
                      ])
                    ]),
                    s("div", xy, [
                      (f(!0), v(C, null, $(he.value.breadcrumb || [], (o, E) => (f(), v("button", {
                        key: `${o.id}-${E}`,
                        type: "button",
                        class: j(["ox-vite-sandbox-breadcrumb__chip", { "is-current": E === (he.value.breadcrumb || []).length - 1 }]),
                        onClick: (jt) => E === (he.value.breadcrumb || []).length - 1 ? null : Fe(o)
                      }, i(o.label), 11, ky))), 128))
                    ])
                  ]),
                  s("section", Sy, [
                    s("article", wy, [
                      s("span", null, i(c.value ? "当前层级" : "Current Level"), 1),
                      s("strong", null, i(he.value.level), 1),
                      s("small", null, i(he.value.levelLabel), 1)
                    ]),
                    s("article", Cy, [
                      s("span", null, i(c.value ? "当前工作空间" : "Current Workspace"), 1),
                      s("strong", null, i(he.value.currentWorkspace || "-"), 1)
                    ]),
                    s("article", My, [
                      s("span", null, i(c.value ? "当前项目" : "Current Project"), 1),
                      s("strong", null, i(he.value.currentProject || "-"), 1)
                    ]),
                    s("article", Py, [
                      s("span", null, i(c.value ? "沙盘智能体" : "Sandbox Agents"), 1),
                      s("strong", null, i(he.value.roleCount || (he.value.items || []).length), 1)
                    ])
                  ]),
                  s("section", Ry, [
                    s("article", Ty, [
                      s("div", Ey, [
                        s("div", null, [
                          s("div", Ay, i(c.value ? "工作空间层" : "Workspace Layer"), 1),
                          s("h2", null, i(c.value ? "当前工作空间入口" : "Workspace Access Points"), 1)
                        ]),
                        s("button", {
                          type: "button",
                          class: "ox-vite-ops-primary-btn",
                          onClick: oe
                        }, [
                          u[121] || (u[121] = s("i", { class: "fa-solid fa-plus" }, null, -1)),
                          s("span", null, i(c.value ? "创建工作空间" : "Create Workspace"), 1)
                        ])
                      ]),
                      s("div", Dy, [
                        s("div", Oy, [
                          (f(!0), v(C, null, $(he.value.workspaces || [], (o) => (f(), v("button", {
                            key: `sandbox-${o.id}`,
                            type: "button",
                            class: j(["ox-vite-workspace-card ox-vite-workspace-card--compact ox-vite-workspace-card--selectable", { "is-selected": qe.value && qe.value.id === o.id }]),
                            onClick: (E) => y.handleSandboxSelectWorkspace(o.id)
                          }, [
                            s("div", $y, [
                              s("div", Fy, [
                                u[122] || (u[122] = s("div", { class: "ox-vite-workspace-card__icon" }, [
                                  s("i", { class: "fa-solid fa-building" })
                                ], -1)),
                                s("div", Iy, [
                                  s("div", Ly, i(o.name), 1),
                                  s("div", jy, i(o.type), 1)
                                ])
                              ])
                            ]),
                            s("div", By, [
                              s("span", Ny, i(o.projectCount) + " " + i(c.value ? "个项目" : "projects"), 1),
                              s("span", Wy, i(o.roleCount) + " " + i(c.value ? "个角色" : "roles"), 1)
                            ]),
                            s("div", Uy, [
                              s("button", {
                                type: "button",
                                class: "ox-vite-ops-primary-btn",
                                onClick: $r((E) => me(o.id), ["stop"])
                              }, [
                                u[123] || (u[123] = s("i", { class: "fa-solid fa-cube" }, null, -1)),
                                s("span", null, i(c.value ? "进入" : "Open"), 1)
                              ], 8, Ky)
                            ])
                          ], 10, Vy))), 128))
                        ]),
                        qe.value ? (f(), v("aside", Hy, [
                          s("div", qy, [
                            s("div", null, [
                              s("div", zy, i(c.value ? "工作空间详情" : "Workspace Detail"), 1),
                              s("h2", null, i(qe.value.name), 1)
                            ])
                          ]),
                          s("div", Yy, [
                            u[124] || (u[124] = s("div", { class: "ox-vite-workspace-card__icon ox-vite-project-card__icon--large" }, [
                              s("i", { class: "fa-solid fa-building" })
                            ], -1)),
                            s("div", null, [
                              s("div", Gy, i(qe.value.type), 1),
                              s("div", Qy, i(qe.value.summary || qe.value.path), 1)
                            ])
                          ]),
                          s("div", Xy, [
                            s("span", Jy, i(qe.value.projectCount) + " " + i(c.value ? "个项目" : "projects"), 1),
                            s("span", Zy, i(qe.value.roleCount) + " " + i(c.value ? "个角色" : "roles"), 1),
                            s("span", e1, i(rl(qe.value.permission)), 1)
                          ]),
                          s("div", t1, [
                            s("button", {
                              type: "button",
                              class: "ox-vite-ops-primary-btn",
                              onClick: u[28] || (u[28] = (o) => me(qe.value.id))
                            }, [
                              u[125] || (u[125] = s("i", { class: "fa-solid fa-cube" }, null, -1)),
                              s("span", null, i(c.value ? "进入工作空间层" : "Open Workspace Layer"), 1)
                            ]),
                            s("button", {
                              type: "button",
                              class: "ox-vite-ops-secondary-btn",
                              onClick: u[29] || (u[29] = (o) => de(qe.value.id))
                            }, [
                              u[126] || (u[126] = s("i", { class: "fa-solid fa-pen" }, null, -1)),
                              s("span", null, i(c.value ? "编辑工作空间" : "Edit Workspace"), 1)
                            ]),
                            s("button", {
                              type: "button",
                              class: "ox-vite-ops-secondary-btn",
                              onClick: u[30] || (u[30] = (o) => He(qe.value.id))
                            }, [
                              u[127] || (u[127] = s("i", { class: "fa-solid fa-layer-group" }, null, -1)),
                              s("span", null, i(c.value ? "添加项目" : "Add Project"), 1)
                            ])
                          ])
                        ])) : Y("", !0)
                      ])
                    ]),
                    s("article", s1, [
                      s("div", n1, [
                        s("div", null, [
                          s("div", l1, i(c.value ? "项目楼层" : "Project Floors"), 1),
                          s("h2", null, i(c.value ? "当前上下文中的项目编组" : "Projects in the Current Context"), 1)
                        ]),
                        s("button", {
                          type: "button",
                          class: "ox-vite-ops-secondary-btn",
                          disabled: !he.value.currentWorkspaceId,
                          onClick: u[31] || (u[31] = (o) => He(he.value.currentWorkspaceId))
                        }, [
                          u[128] || (u[128] = s("i", { class: "fa-solid fa-layer-group" }, null, -1)),
                          s("span", null, i(c.value ? "添加项目楼层" : "Add Project Floor"), 1)
                        ], 8, i1)
                      ]),
                      he.value.projects?.length ? (f(), v("div", o1, [
                        s("div", a1, [
                          (f(!0), v(C, null, $(he.value.projects || [], (o) => (f(), v("button", {
                            key: o.id,
                            type: "button",
                            class: j(["ox-vite-project-card ox-vite-project-card--selectable", { "is-selected": We.value && We.value.id === o.id }]),
                            onClick: (E) => Ts(o.id)
                          }, [
                            s("div", c1, [
                              s("div", {
                                class: "ox-vite-project-card__icon",
                                style: tt({ background: o.color })
                              }, [
                                s("i", {
                                  class: j(o.icon)
                                }, null, 2)
                              ], 4),
                              s("div", null, [
                                s("div", u1, i(o.name), 1),
                                s("div", d1, i(o.workspace || (c.value ? "未绑定工作空间" : "No workspace")), 1)
                              ])
                            ]),
                            s("p", null, i(o.description || (c.value ? "当前项目楼层还没有补充描述。" : "No project description yet.")), 1),
                            s("div", p1, [
                              s("span", f1, i(c.value ? `第 ${o.floor} 层` : `Floor ${o.floor}`), 1)
                            ])
                          ], 10, r1))), 128))
                        ]),
                        We.value ? (f(), v("aside", v1, [
                          s("div", g1, [
                            s("div", null, [
                              s("div", _1, i(c.value ? "项目详情" : "Project Detail"), 1),
                              s("h2", null, i(We.value.name), 1)
                            ])
                          ]),
                          s("div", h1, [
                            s("div", {
                              class: "ox-vite-project-card__icon ox-vite-project-card__icon--large",
                              style: tt({ background: We.value.color })
                            }, [
                              s("i", {
                                class: j(We.value.icon)
                              }, null, 2)
                            ], 4),
                            s("div", null, [
                              s("div", m1, i(We.value.workspace || (c.value ? "未绑定工作空间" : "No workspace")), 1),
                              s("div", b1, i(c.value ? `第 ${We.value.floor} 层` : `Floor ${We.value.floor}`), 1)
                            ])
                          ]),
                          s("p", y1, i(We.value.description || (c.value ? "当前项目楼层还没有补充描述。" : "No project description yet.")), 1),
                          s("div", x1, [
                            s("button", {
                              type: "button",
                              class: "ox-vite-ops-primary-btn",
                              onClick: u[32] || (u[32] = (o) => Ge(We.value.id))
                            }, [
                              u[129] || (u[129] = s("i", { class: "fa-solid fa-cube" }, null, -1)),
                              s("span", null, i(c.value ? "进入项目楼层" : "Open Project Floor"), 1)
                            ]),
                            s("button", {
                              type: "button",
                              class: "ox-vite-ops-secondary-btn",
                              onClick: u[33] || (u[33] = (o) => Ye(We.value.id, We.value.workspaceId))
                            }, [
                              u[130] || (u[130] = s("i", { class: "fa-solid fa-pen" }, null, -1)),
                              s("span", null, i(c.value ? "编辑项目" : "Edit Project"), 1)
                            ]),
                            s("button", {
                              type: "button",
                              class: "ox-vite-ops-secondary-btn",
                              onClick: u[34] || (u[34] = (o) => so())
                            }, [
                              u[131] || (u[131] = s("i", { class: "fa-solid fa-user-plus" }, null, -1)),
                              s("span", null, i(c.value ? "添加员工" : "Add Staff Role"), 1)
                            ]),
                            s("button", {
                              type: "button",
                              class: "ox-vite-ops-secondary-btn",
                              onClick: u[35] || (u[35] = (o) => Ft(We.value.id))
                            }, [
                              u[132] || (u[132] = s("i", { class: "fa-regular fa-trash-can" }, null, -1)),
                              s("span", null, i(c.value ? "删除项目" : "Delete Project"), 1)
                            ])
                          ])
                        ])) : Y("", !0)
                      ])) : (f(), v("div", k1, [
                        u[133] || (u[133] = s("i", { class: "fa-solid fa-layer-group" }, null, -1)),
                        s("strong", null, i(c.value ? "当前还没有项目楼层" : "No project floors yet"), 1),
                        s("p", null, i(c.value ? "先进入一个工作空间，再为它添加项目楼层。" : "Enter a workspace first, then add project floors for it."), 1)
                      ]))
                    ])
                  ]),
                  s("section", S1, [
                    s("div", w1, [
                      s("div", null, [
                        s("div", C1, i(c.value ? "员工编组" : "Sandbox Roster"), 1),
                        s("h2", null, i(c.value ? "当前沙盘中的员工角色" : "Staff Roles Inside the Current Sandbox"), 1)
                      ]),
                      s("button", {
                        type: "button",
                        class: "ox-vite-ops-secondary-btn",
                        onClick: W
                      }, [
                        u[134] || (u[134] = s("i", { class: "fa-solid fa-user-plus" }, null, -1)),
                        s("span", null, i(c.value ? "添加员工角色" : "Add Staff Role"), 1)
                      ])
                    ]),
                    he.value.items?.length ? (f(), v("div", M1, [
                      s("div", P1, [
                        (f(!0), v(C, null, $(he.value.items || [], (o) => (f(), v("button", {
                          key: o.id,
                          type: "button",
                          class: j(["ox-vite-role-library-card ox-vite-role-library-card--selectable", { "is-selected": Te.value && Te.value.id === o.id }]),
                          onClick: (E) => Es(o.id)
                        }, [
                          s("div", T1, [
                            s("div", E1, [
                              s("i", {
                                class: j(o.icon)
                              }, null, 2)
                            ]),
                            s("div", A1, [
                              s("div", D1, i(o.name), 1),
                              s("div", O1, [
                                s("span", null, i(o.department || o.role), 1),
                                o.workspace ? (f(), v("span", V1, i(o.workspace), 1)) : Y("", !0),
                                o.project ? (f(), v("span", $1, i(o.project), 1)) : Y("", !0)
                              ])
                            ])
                          ]),
                          s("div", F1, [
                            s("span", I1, i(cl(o.status)), 1),
                            (f(!0), v(C, null, $(o.skills || [], (E) => (f(), v("span", {
                              key: `${o.id}-${E}`,
                              class: "ox-vite-detail-chip"
                            }, i(E), 1))), 128))
                          ])
                        ], 10, R1))), 128))
                      ]),
                      Te.value ? (f(), v("aside", L1, [
                        s("div", j1, [
                          s("div", null, [
                            s("div", B1, i(c.value ? "员工详情" : "Staff Detail"), 1),
                            s("h2", null, i(Te.value.name), 1)
                          ])
                        ]),
                        s("div", N1, [
                          s("div", W1, [
                            s("i", {
                              class: j(Te.value.icon)
                            }, null, 2)
                          ]),
                          s("div", null, [
                            s("div", U1, i(Te.value.department || Te.value.role), 1),
                            s("div", K1, [
                              mt(i(Te.value.workspace || "-") + " ", 1),
                              Te.value.project ? (f(), v("span", H1, " · " + i(Te.value.project), 1)) : Y("", !0)
                            ])
                          ])
                        ]),
                        s("p", q1, i(Te.value.summary || (c.value ? "当前员工角色还没有补充摘要，后续可以继续细化职责、边界和提示词。" : "This staff role does not have a summary yet. Responsibilities, boundaries, and prompts can be refined next.")), 1),
                        s("div", z1, [
                          s("span", Y1, i(cl(Te.value.status)), 1),
                          (f(!0), v(C, null, $(Te.value.skills || [], (o) => (f(), v("span", {
                            key: `${Te.value.id}-detail-${o}`,
                            class: "ox-vite-detail-chip"
                          }, i(o), 1))), 128))
                        ]),
                        s("div", G1, [
                          s("button", {
                            type: "button",
                            class: "ox-vite-ops-secondary-btn",
                            onClick: u[36] || (u[36] = (o) => to(Te.value.id))
                          }, [
                            u[135] || (u[135] = s("i", { class: "fa-solid fa-pen" }, null, -1)),
                            s("span", null, i(c.value ? "编辑角色" : "Edit Role"), 1)
                          ]),
                          s("button", {
                            type: "button",
                            class: "ox-vite-ops-primary-btn",
                            onClick: u[37] || (u[37] = (o) => eo(Te.value.id))
                          }, [
                            u[136] || (u[136] = s("i", { class: "fa-solid fa-comments" }, null, -1)),
                            s("span", null, i(c.value ? "发起对话" : "Open Chat"), 1)
                          ]),
                          s("button", {
                            type: "button",
                            class: "ox-vite-ops-secondary-btn",
                            onClick: u[38] || (u[38] = (o) => se(Te.value.id))
                          }, [
                            u[137] || (u[137] = s("i", { class: "fa-regular fa-trash-can" }, null, -1)),
                            s("span", null, i(c.value ? "删除角色" : "Delete Role"), 1)
                          ])
                        ])
                      ])) : Y("", !0)
                    ])) : (f(), v("div", Q1, [
                      u[138] || (u[138] = s("i", { class: "fa-solid fa-user-group" }, null, -1)),
                      s("strong", null, i(c.value ? "还没有沙盘智能体" : "No sandbox agents yet"), 1),
                      s("p", null, i(c.value ? "当工作空间和角色绑定后，这里会开始显示沙盘编组。" : "Once workspaces and roles are bound, sandbox rosters will appear here."), 1)
                    ]))
                  ])
                ])) : (f(), v("section", X1, [
                  (f(!0), v(C, null, $(h.value.xnetPanel?.items || [], (o) => (f(), v("article", {
                    key: o.id,
                    class: "ox-vite-media-card"
                  }, [
                    s("strong", null, i(o.title), 1),
                    s("small", null, i(o.status), 1),
                    s("div", J1, [
                      s("span", Z1, i(o.autoConnect ? c.value ? "自动连接" : "Auto connect" : c.value ? "手动检查" : "Manual check"), 1)
                    ]),
                    s("small", null, i(o.url || (c.value ? "未配置服务地址" : "No configured URL")), 1),
                    s("small", null, i(o.lastCheck || (c.value ? "尚未检查" : "Not checked yet")), 1)
                  ]))), 128))
                ]))
              ], 64)) : t.surface === "storage" ? (f(), v(C, { key: 6 }, [
                s("section", ex, [
                  (f(!0), v(C, null, $(h.value.overviewStats || [], (o) => (f(), v("span", {
                    key: o.id,
                    class: "ox-vite-detail-chip"
                  }, [
                    s("i", {
                      class: j(o.icon)
                    }, null, 2),
                    s("span", null, i(o.label) + " " + i(o.value), 1)
                  ]))), 128))
                ]),
                h.value.activeTab === "text" ? (f(), v("section", tx, [
                  s("div", sx, [
                    (f(!0), v(C, null, $(h.value.textFiles || [], (o) => (f(), v("article", {
                      key: o.id,
                      class: "ox-vite-list-row"
                    }, [
                      s("div", null, [
                        s("strong", null, i(o.name), 1),
                        s("p", null, i(o.ext) + " · " + i(o.size), 1)
                      ]),
                      s("span", null, i(o.time), 1)
                    ]))), 128))
                  ])
                ])) : h.value.activeTab === "image" ? (f(), v("section", nx, [
                  (f(!0), v(C, null, $(h.value.imageFiles || [], (o) => (f(), v("article", {
                    key: o.id,
                    class: "ox-vite-media-card"
                  }, [
                    u[139] || (u[139] = s("div", { class: "ox-vite-media-card__thumb" }, [
                      s("i", { class: "fa-regular fa-image" })
                    ], -1)),
                    s("strong", null, i(o.name), 1),
                    s("small", null, i(o.size), 1)
                  ]))), 128))
                ])) : h.value.activeTab === "video" ? (f(), v("section", lx, [
                  (f(!0), v(C, null, $(h.value.videoFiles || [], (o) => (f(), v("article", {
                    key: o.id,
                    class: "ox-vite-media-card"
                  }, [
                    u[140] || (u[140] = s("div", { class: "ox-vite-media-card__thumb" }, [
                      s("i", { class: "fa-solid fa-play" })
                    ], -1)),
                    s("strong", null, i(o.name), 1),
                    s("small", null, i(o.duration) + " · " + i(o.size), 1)
                  ]))), 128))
                ])) : (f(), v("section", ix, [
                  s("div", ox, [
                    (f(!0), v(C, null, $(h.value.recallItems || [], (o) => (f(), v("article", {
                      key: o.id,
                      class: "ox-vite-list-row"
                    }, [
                      s("div", null, [
                        s("strong", null, i(o.title), 1),
                        s("p", null, i(o.note), 1)
                      ])
                    ]))), 128))
                  ])
                ]))
              ], 64)) : t.surface === "kernel" ? (f(), v(C, { key: 7 }, [
                s("div", ax, [
                  (f(!0), v(C, null, $(h.value.tabs || [], (o) => (f(), v("button", {
                    key: o.id,
                    type: "button",
                    class: j(["ox-vite-strip-tab", { active: h.value.activeTab === o.id }]),
                    onClick: (E) => p(o.id)
                  }, [
                    s("i", {
                      class: j(o.icon)
                    }, null, 2),
                    s("span", null, i(o.label), 1)
                  ], 10, rx))), 128))
                ]),
                s("section", cx, [
                  (f(!0), v(C, null, $(h.value.metrics || [], (o) => (f(), v("article", {
                    key: o.id,
                    class: "ox-vite-stat-card"
                  }, [
                    s("span", null, i(o.label), 1),
                    s("strong", null, i(o.value), 1),
                    s("small", null, i(o.note), 1)
                  ]))), 128))
                ]),
                s("section", ux, [
                  s("article", dx, [
                    s("div", px, [
                      s("h2", null, i(c.value ? "运行画像" : "Runtime Profile"), 1),
                      s("p", null, i(h.value.updatedLabel), 1)
                    ]),
                    s("div", fx, [
                      (f(!0), v(C, null, $(h.value.runtimeRows || [], (o) => (f(), v("article", {
                        key: o.label,
                        class: "ox-vite-list-row"
                      }, [
                        s("div", null, [
                          s("strong", null, i(o.label), 1)
                        ]),
                        s("span", null, i(o.value), 1)
                      ]))), 128))
                    ])
                  ]),
                  s("article", vx, [
                    s("div", gx, [
                      s("h2", null, i(c.value ? "计划与动作" : "Plans & Actions"), 1),
                      s("p", null, i(c.value ? "优先显示近期内核行动与下一步建议。" : "Show recent kernel actions and recommended next steps first."), 1)
                    ]),
                    s("div", _x, [
                      (f(!0), v(C, null, $(h.value.actions || [], (o) => (f(), v("article", {
                        key: o.id,
                        class: "ox-vite-list-row"
                      }, [
                        s("div", null, [
                          s("strong", null, i(o.title), 1),
                          s("p", null, i(o.type), 1)
                        ]),
                        s("span", null, i(o.status) + i(o.next ? ` · ${o.next}` : ""), 1)
                      ]))), 128))
                    ])
                  ])
                ])
              ], 64)) : Y("", !0)
            ])
          ], 2)
        ]))
      ], 64))
    ], 2));
  }
};
function In() {
  document.querySelectorAll("[data-openxnet-ops-surface]").forEach((t) => {
    const n = t?.closest(".page");
    if (!t || t.dataset.viteMounted === "true" || n && window.getComputedStyle(n).display === "none")
      return;
    const l = String(t.dataset.openxnetOpsSurface || "").trim();
    Lr(hx, { surface: l }).mount(t), t.dataset.viteMounted = "true";
  });
}
document.readyState === "loading" ? document.addEventListener("DOMContentLoaded", In, { once: !0 }) : In();
window.addEventListener("openxnet-vite-ops-remount", In);
