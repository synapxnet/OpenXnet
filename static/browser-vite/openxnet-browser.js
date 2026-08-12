// @__NO_SIDE_EFFECTS__
function Yn(e) {
  const t = /* @__PURE__ */ Object.create(null);
  for (const n of e.split(",")) t[n] = 1;
  return (n) => n in t;
}
const q = {}, bt = [], ke = () => {
}, Zs = () => !1, hn = (e) => e.charCodeAt(0) === 111 && e.charCodeAt(1) === 110 && // uppercase letter
(e.charCodeAt(2) > 122 || e.charCodeAt(2) < 97), gn = (e) => e.startsWith("onUpdate:"), ae = Object.assign, Jn = (e, t) => {
  const n = e.indexOf(t);
  n > -1 && e.splice(n, 1);
}, li = Object.prototype.hasOwnProperty, j = (e, t) => li.call(e, t), R = Array.isArray, mt = (e) => Vt(e) === "[object Map]", Qs = (e) => Vt(e) === "[object Set]", ms = (e) => Vt(e) === "[object Date]", F = (e) => typeof e == "function", Z = (e) => typeof e == "string", He = (e) => typeof e == "symbol", K = (e) => e !== null && typeof e == "object", er = (e) => (K(e) || F(e)) && F(e.then) && F(e.catch), tr = Object.prototype.toString, Vt = (e) => tr.call(e), ci = (e) => Vt(e).slice(8, -1), nr = (e) => Vt(e) === "[object Object]", Xn = (e) => Z(e) && e !== "NaN" && e[0] !== "-" && "" + parseInt(e, 10) === e, Ft = /* @__PURE__ */ Yn(
  // the leading comma is intentional so empty string "" is also included
  ",key,ref,ref_for,ref_key,onVnodeBeforeMount,onVnodeMounted,onVnodeBeforeUpdate,onVnodeUpdated,onVnodeBeforeUnmount,onVnodeUnmounted"
), bn = (e) => {
  const t = /* @__PURE__ */ Object.create(null);
  return ((n) => t[n] || (t[n] = e(n)));
}, ai = /-\w/g, xe = bn(
  (e) => e.replace(ai, (t) => t.slice(1).toUpperCase())
), ui = /\B([A-Z])/g, ot = bn(
  (e) => e.replace(ui, "-$1").toLowerCase()
), sr = bn((e) => e.charAt(0).toUpperCase() + e.slice(1)), An = bn(
  (e) => e ? `on${sr(e)}` : ""
), Le = (e, t) => !Object.is(e, t), tn = (e, ...t) => {
  for (let n = 0; n < e.length; n++)
    e[n](...t);
}, rr = (e, t, n, s = !1) => {
  Object.defineProperty(e, t, {
    configurable: !0,
    enumerable: !1,
    writable: s,
    value: n
  });
}, Zn = (e) => {
  const t = parseFloat(e);
  return isNaN(t) ? e : t;
};
let _s;
const mn = () => _s || (_s = typeof globalThis < "u" ? globalThis : typeof self < "u" ? self : typeof window < "u" ? window : typeof globalThis < "u" ? globalThis : {});
function _n(e) {
  if (R(e)) {
    const t = {};
    for (let n = 0; n < e.length; n++) {
      const s = e[n], r = Z(s) ? hi(s) : _n(s);
      if (r)
        for (const i in r)
          t[i] = r[i];
    }
    return t;
  } else if (Z(e) || K(e))
    return e;
}
const fi = /;(?![^(]*\))/g, di = /:([^]+)/, pi = /\/\*[^]*?\*\//g;
function hi(e) {
  const t = {};
  return e.replace(pi, "").split(fi).forEach((n) => {
    if (n) {
      const s = n.split(di);
      s.length > 1 && (t[s[0].trim()] = s[1].trim());
    }
  }), t;
}
function we(e) {
  let t = "";
  if (Z(e))
    t = e;
  else if (R(e))
    for (let n = 0; n < e.length; n++) {
      const s = we(e[n]);
      s && (t += s + " ");
    }
  else if (K(e))
    for (const n in e)
      e[n] && (t += n + " ");
  return t.trim();
}
const gi = "itemscope,allowfullscreen,formnovalidate,ismap,nomodule,novalidate,readonly", bi = /* @__PURE__ */ Yn(gi);
function ir(e) {
  return !!e || e === "";
}
function mi(e, t) {
  if (e.length !== t.length) return !1;
  let n = !0;
  for (let s = 0; n && s < e.length; s++)
    n = Qn(e[s], t[s]);
  return n;
}
function Qn(e, t) {
  if (e === t) return !0;
  let n = ms(e), s = ms(t);
  if (n || s)
    return n && s ? e.getTime() === t.getTime() : !1;
  if (n = He(e), s = He(t), n || s)
    return e === t;
  if (n = R(e), s = R(t), n || s)
    return n && s ? mi(e, t) : !1;
  if (n = K(e), s = K(t), n || s) {
    if (!n || !s)
      return !1;
    const r = Object.keys(e).length, i = Object.keys(t).length;
    if (r !== i)
      return !1;
    for (const o in e) {
      const l = e.hasOwnProperty(o), u = t.hasOwnProperty(o);
      if (l && !u || !l && u || !Qn(e[o], t[o]))
        return !1;
    }
  }
  return String(e) === String(t);
}
const or = (e) => !!(e && e.__v_isRef === !0), H = (e) => Z(e) ? e : e == null ? "" : R(e) || K(e) && (e.toString === tr || !F(e.toString)) ? or(e) ? H(e.value) : JSON.stringify(e, lr, 2) : String(e), lr = (e, t) => or(t) ? lr(e, t.value) : mt(t) ? {
  [`Map(${t.size})`]: [...t.entries()].reduce(
    (n, [s, r], i) => (n[En(s, i) + " =>"] = r, n),
    {}
  )
} : Qs(t) ? {
  [`Set(${t.size})`]: [...t.values()].map((n) => En(n))
} : He(t) ? En(t) : K(t) && !R(t) && !nr(t) ? String(t) : t, En = (e, t = "") => {
  var n;
  return (
    // Symbol.description in es2019+ so we need to cast here to pass
    // the lib: es2016 check
    He(e) ? `Symbol(${(n = e.description) != null ? n : t})` : e
  );
};
let ie;
class _i {
  // TODO isolatedDeclarations "__v_skip"
  constructor(t = !1) {
    this.detached = t, this._active = !0, this._on = 0, this.effects = [], this.cleanups = [], this._isPaused = !1, this._warnOnRun = !0, this.__v_skip = !0, !t && ie && (ie.active ? (this.parent = ie, this.index = (ie.scopes || (ie.scopes = [])).push(
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
      const n = ie;
      try {
        return ie = this, t();
      } finally {
        ie = n;
      }
    }
  }
  /**
   * This should only be called on non-detached scopes
   * @internal
   */
  on() {
    ++this._on === 1 && (this.prevScope = ie, ie = this);
  }
  /**
   * This should only be called on non-detached scopes
   * @internal
   */
  off() {
    if (this._on > 0 && --this._on === 0) {
      if (ie === this)
        ie = this.prevScope;
      else {
        let t = ie;
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
      let n, s;
      for (n = 0, s = this.effects.length; n < s; n++)
        this.effects[n].stop();
      for (this.effects.length = 0, n = 0, s = this.cleanups.length; n < s; n++)
        this.cleanups[n]();
      if (this.cleanups.length = 0, this.scopes) {
        for (n = 0, s = this.scopes.length; n < s; n++)
          this.scopes[n].stop(!0);
        this.scopes.length = 0;
      }
      if (!this.detached && this.parent && !t) {
        const r = this.parent.scopes.pop();
        r && r !== this && (this.parent.scopes[this.index] = r, r.index = this.index);
      }
      this.parent = void 0;
    }
  }
}
function yi() {
  return ie;
}
let J;
const Pn = /* @__PURE__ */ new WeakSet();
class cr {
  constructor(t) {
    this.fn = t, this.deps = void 0, this.depsTail = void 0, this.flags = 5, this.next = void 0, this.cleanup = void 0, this.scheduler = void 0, ie && (ie.active ? ie.effects.push(this) : this.flags &= -2);
  }
  pause() {
    this.flags |= 64;
  }
  resume() {
    this.flags & 64 && (this.flags &= -65, Pn.has(this) && (Pn.delete(this), this.trigger()));
  }
  /**
   * @internal
   */
  notify() {
    this.flags & 2 && !(this.flags & 32) || this.flags & 8 || ur(this);
  }
  run() {
    if (!(this.flags & 1))
      return this.fn();
    this.flags |= 2, ys(this), fr(this);
    const t = J, n = Se;
    J = this, Se = !0;
    try {
      return this.fn();
    } finally {
      dr(this), J = t, Se = n, this.flags &= -3;
    }
  }
  stop() {
    if (this.flags & 1) {
      for (let t = this.deps; t; t = t.nextDep)
        ns(t);
      this.deps = this.depsTail = void 0, ys(this), this.onStop && this.onStop(), this.flags &= -2;
    }
  }
  trigger() {
    this.flags & 64 ? Pn.add(this) : this.scheduler ? this.scheduler() : this.runIfDirty();
  }
  /**
   * @internal
   */
  runIfDirty() {
    Hn(this) && this.run();
  }
  get dirty() {
    return Hn(this);
  }
}
let ar = 0, Dt, Lt;
function ur(e, t = !1) {
  if (e.flags |= 8, t) {
    e.next = Lt, Lt = e;
    return;
  }
  e.next = Dt, Dt = e;
}
function es() {
  ar++;
}
function ts() {
  if (--ar > 0)
    return;
  if (Lt) {
    let t = Lt;
    for (Lt = void 0; t; ) {
      const n = t.next;
      t.next = void 0, t.flags &= -9, t = n;
    }
  }
  let e;
  for (; Dt; ) {
    let t = Dt;
    for (Dt = void 0; t; ) {
      const n = t.next;
      if (t.next = void 0, t.flags &= -9, t.flags & 1)
        try {
          t.trigger();
        } catch (s) {
          e || (e = s);
        }
      t = n;
    }
  }
  if (e) throw e;
}
function fr(e) {
  for (let t = e.deps; t; t = t.nextDep)
    t.version = -1, t.prevActiveLink = t.dep.activeLink, t.dep.activeLink = t;
}
function dr(e) {
  let t, n = e.depsTail, s = n;
  for (; s; ) {
    const r = s.prevDep;
    s.version === -1 ? (s === n && (n = r), ns(s), vi(s)) : t = s, s.dep.activeLink = s.prevActiveLink, s.prevActiveLink = void 0, s = r;
  }
  e.deps = t, e.depsTail = n;
}
function Hn(e) {
  for (let t = e.deps; t; t = t.nextDep)
    if (t.dep.version !== t.version || t.dep.computed && (pr(t.dep.computed) || t.dep.version !== t.version))
      return !0;
  return !!e._dirty;
}
function pr(e) {
  if (e.flags & 4 && !(e.flags & 16) || (e.flags &= -17, e.globalVersion === $t) || (e.globalVersion = $t, !e.isSSR && e.flags & 128 && (!e.deps && !e._dirty || !Hn(e))))
    return;
  e.flags |= 2;
  const t = e.dep, n = J, s = Se;
  J = e, Se = !0;
  try {
    fr(e);
    const r = e.fn(e._value);
    (t.version === 0 || Le(r, e._value)) && (e.flags |= 128, e._value = r, t.version++);
  } catch (r) {
    throw t.version++, r;
  } finally {
    J = n, Se = s, dr(e), e.flags &= -3;
  }
}
function ns(e, t = !1) {
  const { dep: n, prevSub: s, nextSub: r } = e;
  if (s && (s.nextSub = r, e.prevSub = void 0), r && (r.prevSub = s, e.nextSub = void 0), n.subs === e && (n.subs = s, !s && n.computed)) {
    n.computed.flags &= -5;
    for (let i = n.computed.deps; i; i = i.nextDep)
      ns(i, !0);
  }
  !t && !--n.sc && n.map && n.map.delete(n.key);
}
function vi(e) {
  const { prevDep: t, nextDep: n } = e;
  t && (t.nextDep = n, e.prevDep = void 0), n && (n.prevDep = t, e.nextDep = void 0);
}
let Se = !0;
const hr = [];
function Ge() {
  hr.push(Se), Se = !1;
}
function qe() {
  const e = hr.pop();
  Se = e === void 0 ? !0 : e;
}
function ys(e) {
  const { cleanup: t } = e;
  if (e.cleanup = void 0, t) {
    const n = J;
    J = void 0;
    try {
      t();
    } finally {
      J = n;
    }
  }
}
let $t = 0;
class wi {
  constructor(t, n) {
    this.sub = t, this.dep = n, this.version = n.version, this.nextDep = this.prevDep = this.nextSub = this.prevSub = this.prevActiveLink = void 0;
  }
}
class ss {
  // TODO isolatedDeclarations "__v_skip"
  constructor(t) {
    this.computed = t, this.version = 0, this.activeLink = void 0, this.subs = void 0, this.map = void 0, this.key = void 0, this.sc = 0, this.__v_skip = !0;
  }
  track(t) {
    if (!J || !Se || J === this.computed)
      return;
    let n = this.activeLink;
    if (n === void 0 || n.sub !== J)
      n = this.activeLink = new wi(J, this), J.deps ? (n.prevDep = J.depsTail, J.depsTail.nextDep = n, J.depsTail = n) : J.deps = J.depsTail = n, gr(n);
    else if (n.version === -1 && (n.version = this.version, n.nextDep)) {
      const s = n.nextDep;
      s.prevDep = n.prevDep, n.prevDep && (n.prevDep.nextDep = s), n.prevDep = J.depsTail, n.nextDep = void 0, J.depsTail.nextDep = n, J.depsTail = n, J.deps === n && (J.deps = s);
    }
    return n;
  }
  trigger(t) {
    this.version++, $t++, this.notify(t);
  }
  notify(t) {
    es();
    try {
      for (let n = this.subs; n; n = n.prevSub)
        n.sub.notify() && n.sub.dep.notify();
    } finally {
      ts();
    }
  }
}
function gr(e) {
  if (e.dep.sc++, e.sub.flags & 4) {
    const t = e.dep.computed;
    if (t && !e.dep.subs) {
      t.flags |= 20;
      for (let s = t.deps; s; s = s.nextDep)
        gr(s);
    }
    const n = e.dep.subs;
    n !== e && (e.prevSub = n, n && (n.nextSub = e)), e.dep.subs = e;
  }
}
const Nn = /* @__PURE__ */ new WeakMap(), rt = /* @__PURE__ */ Symbol(
  ""
), Un = /* @__PURE__ */ Symbol(
  ""
), jt = /* @__PURE__ */ Symbol(
  ""
);
function le(e, t, n) {
  if (Se && J) {
    let s = Nn.get(e);
    s || Nn.set(e, s = /* @__PURE__ */ new Map());
    let r = s.get(n);
    r || (s.set(n, r = new ss()), r.map = s, r.key = n), r.track();
  }
}
function Be(e, t, n, s, r, i) {
  const o = Nn.get(e);
  if (!o) {
    $t++;
    return;
  }
  const l = (u) => {
    u && u.trigger();
  };
  if (es(), t === "clear")
    o.forEach(l);
  else {
    const u = R(e), h = u && Xn(n);
    if (u && n === "length") {
      const d = Number(s);
      o.forEach((b, T) => {
        (T === "length" || T === jt || !He(T) && T >= d) && l(b);
      });
    } else
      switch ((n !== void 0 || o.has(void 0)) && l(o.get(n)), h && l(o.get(jt)), t) {
        case "add":
          u ? h && l(o.get("length")) : (l(o.get(rt)), mt(e) && l(o.get(Un)));
          break;
        case "delete":
          u || (l(o.get(rt)), mt(e) && l(o.get(Un)));
          break;
        case "set":
          mt(e) && l(o.get(rt));
          break;
      }
  }
  ts();
}
function dt(e) {
  const t = /* @__PURE__ */ $(e);
  return t === e ? t : (le(t, "iterate", jt), /* @__PURE__ */ ve(e) ? t : t.map(Te));
}
function yn(e) {
  return le(e = /* @__PURE__ */ $(e), "iterate", jt), e;
}
function Fe(e, t) {
  return /* @__PURE__ */ ze(e) ? vt(/* @__PURE__ */ it(e) ? Te(t) : t) : Te(t);
}
const xi = {
  __proto__: null,
  [Symbol.iterator]() {
    return In(this, Symbol.iterator, (e) => Fe(this, e));
  },
  concat(...e) {
    return dt(this).concat(
      ...e.map((t) => R(t) ? dt(t) : t)
    );
  },
  entries() {
    return In(this, "entries", (e) => (e[1] = Fe(this, e[1]), e));
  },
  every(e, t) {
    return $e(this, "every", e, t, void 0, arguments);
  },
  filter(e, t) {
    return $e(
      this,
      "filter",
      e,
      t,
      (n) => n.map((s) => Fe(this, s)),
      arguments
    );
  },
  find(e, t) {
    return $e(
      this,
      "find",
      e,
      t,
      (n) => Fe(this, n),
      arguments
    );
  },
  findIndex(e, t) {
    return $e(this, "findIndex", e, t, void 0, arguments);
  },
  findLast(e, t) {
    return $e(
      this,
      "findLast",
      e,
      t,
      (n) => Fe(this, n),
      arguments
    );
  },
  findLastIndex(e, t) {
    return $e(this, "findLastIndex", e, t, void 0, arguments);
  },
  // flat, flatMap could benefit from ARRAY_ITERATE but are not straight-forward to implement
  forEach(e, t) {
    return $e(this, "forEach", e, t, void 0, arguments);
  },
  includes(...e) {
    return Mn(this, "includes", e);
  },
  indexOf(...e) {
    return Mn(this, "indexOf", e);
  },
  join(e) {
    return dt(this).join(e);
  },
  // keys() iterator only reads `length`, no optimization required
  lastIndexOf(...e) {
    return Mn(this, "lastIndexOf", e);
  },
  map(e, t) {
    return $e(this, "map", e, t, void 0, arguments);
  },
  pop() {
    return Et(this, "pop");
  },
  push(...e) {
    return Et(this, "push", e);
  },
  reduce(e, ...t) {
    return vs(this, "reduce", e, t);
  },
  reduceRight(e, ...t) {
    return vs(this, "reduceRight", e, t);
  },
  shift() {
    return Et(this, "shift");
  },
  // slice could use ARRAY_ITERATE but also seems to beg for range tracking
  some(e, t) {
    return $e(this, "some", e, t, void 0, arguments);
  },
  splice(...e) {
    return Et(this, "splice", e);
  },
  toReversed() {
    return dt(this).toReversed();
  },
  toSorted(e) {
    return dt(this).toSorted(e);
  },
  toSpliced(...e) {
    return dt(this).toSpliced(...e);
  },
  unshift(...e) {
    return Et(this, "unshift", e);
  },
  values() {
    return In(this, "values", (e) => Fe(this, e));
  }
};
function In(e, t, n) {
  const s = yn(e), r = s[t]();
  return s !== e && !/* @__PURE__ */ ve(e) && (r._next = r.next, r.next = () => {
    const i = r._next();
    return i.done || (i.value = n(i.value)), i;
  }), r;
}
const Si = Array.prototype;
function $e(e, t, n, s, r, i) {
  const o = yn(e), l = o !== e && !/* @__PURE__ */ ve(e), u = o[t];
  if (u !== Si[t]) {
    const b = u.apply(e, i);
    return l ? Te(b) : b;
  }
  let h = n;
  o !== e && (l ? h = function(b, T) {
    return n.call(this, Fe(e, b), T, e);
  } : n.length > 2 && (h = function(b, T) {
    return n.call(this, b, T, e);
  }));
  const d = u.call(o, h, s);
  return l && r ? r(d) : d;
}
function vs(e, t, n, s) {
  const r = yn(e), i = r !== e && !/* @__PURE__ */ ve(e);
  let o = n, l = !1;
  r !== e && (i ? (l = s.length === 0, o = function(h, d, b) {
    return l && (l = !1, h = Fe(e, h)), n.call(this, h, Fe(e, d), b, e);
  }) : n.length > 3 && (o = function(h, d, b) {
    return n.call(this, h, d, b, e);
  }));
  const u = r[t](o, ...s);
  return l ? Fe(e, u) : u;
}
function Mn(e, t, n) {
  const s = /* @__PURE__ */ $(e);
  le(s, "iterate", jt);
  const r = s[t](...n);
  return (r === -1 || r === !1) && /* @__PURE__ */ ls(n[0]) ? (n[0] = /* @__PURE__ */ $(n[0]), s[t](...n)) : r;
}
function Et(e, t, n = []) {
  Ge(), es();
  const s = (/* @__PURE__ */ $(e))[t].apply(e, n);
  return ts(), qe(), s;
}
const Ti = /* @__PURE__ */ Yn("__proto__,__v_isRef,__isVue"), br = new Set(
  /* @__PURE__ */ Object.getOwnPropertyNames(Symbol).filter((e) => e !== "arguments" && e !== "caller").map((e) => Symbol[e]).filter(He)
);
function Ci(e) {
  He(e) || (e = String(e));
  const t = /* @__PURE__ */ $(this);
  return le(t, "has", e), t.hasOwnProperty(e);
}
class mr {
  constructor(t = !1, n = !1) {
    this._isReadonly = t, this._isShallow = n;
  }
  get(t, n, s) {
    if (n === "__v_skip") return t.__v_skip;
    const r = this._isReadonly, i = this._isShallow;
    if (n === "__v_isReactive")
      return !r;
    if (n === "__v_isReadonly")
      return r;
    if (n === "__v_isShallow")
      return i;
    if (n === "__v_raw")
      return s === (r ? i ? Li : wr : i ? vr : yr).get(t) || // receiver is not the reactive proxy, but has the same prototype
      // this means the receiver is a user proxy of the reactive proxy
      Object.getPrototypeOf(t) === Object.getPrototypeOf(s) ? t : void 0;
    const o = R(t);
    if (!r) {
      let u;
      if (o && (u = xi[n]))
        return u;
      if (n === "hasOwnProperty")
        return Ci;
    }
    const l = Reflect.get(
      t,
      n,
      // if this is a proxy wrapping a ref, return methods using the raw ref
      // as receiver so that we don't have to call `toRaw` on the ref in all
      // its class methods
      /* @__PURE__ */ ce(t) ? t : s
    );
    if ((He(n) ? br.has(n) : Ti(n)) || (r || le(t, "get", n), i))
      return l;
    if (/* @__PURE__ */ ce(l)) {
      const u = o && Xn(n) ? l : l.value;
      return r && K(u) ? /* @__PURE__ */ jn(u) : u;
    }
    return K(l) ? r ? /* @__PURE__ */ jn(l) : /* @__PURE__ */ is(l) : l;
  }
}
class _r extends mr {
  constructor(t = !1) {
    super(!1, t);
  }
  set(t, n, s, r) {
    let i = t[n];
    const o = R(t) && Xn(n);
    if (!this._isShallow) {
      const h = /* @__PURE__ */ ze(i);
      if (!/* @__PURE__ */ ve(s) && !/* @__PURE__ */ ze(s) && (i = /* @__PURE__ */ $(i), s = /* @__PURE__ */ $(s)), !o && /* @__PURE__ */ ce(i) && !/* @__PURE__ */ ce(s))
        return h || (i.value = s), !0;
    }
    const l = o ? Number(n) < t.length : j(t, n), u = Reflect.set(
      t,
      n,
      s,
      /* @__PURE__ */ ce(t) ? t : r
    );
    return t === /* @__PURE__ */ $(r) && (l ? Le(s, i) && Be(t, "set", n, s) : Be(t, "add", n, s)), u;
  }
  deleteProperty(t, n) {
    const s = j(t, n);
    t[n];
    const r = Reflect.deleteProperty(t, n);
    return r && s && Be(t, "delete", n, void 0), r;
  }
  has(t, n) {
    const s = Reflect.has(t, n);
    return (!He(n) || !br.has(n)) && le(t, "has", n), s;
  }
  ownKeys(t) {
    return le(
      t,
      "iterate",
      R(t) ? "length" : rt
    ), Reflect.ownKeys(t);
  }
}
class Ai extends mr {
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
const Ei = /* @__PURE__ */ new _r(), Pi = /* @__PURE__ */ new Ai(), Ii = /* @__PURE__ */ new _r(!0);
const $n = (e) => e, Jt = (e) => Reflect.getPrototypeOf(e);
function Mi(e, t, n) {
  return function(...s) {
    const r = this.__v_raw, i = /* @__PURE__ */ $(r), o = mt(i), l = e === "entries" || e === Symbol.iterator && o, u = e === "keys" && o, h = r[e](...s), d = n ? $n : t ? vt : Te;
    return !t && le(
      i,
      "iterate",
      u ? Un : rt
    ), ae(
      // inheriting all iterator properties
      Object.create(h),
      {
        // iterator protocol
        next() {
          const { value: b, done: T } = h.next();
          return T ? { value: b, done: T } : {
            value: l ? [d(b[0]), d(b[1])] : d(b),
            done: T
          };
        }
      }
    );
  };
}
function Xt(e) {
  return function(...t) {
    return e === "delete" ? !1 : e === "clear" ? void 0 : this;
  };
}
function Oi(e, t) {
  const n = {
    get(r) {
      const i = this.__v_raw, o = /* @__PURE__ */ $(i), l = /* @__PURE__ */ $(r);
      e || (Le(r, l) && le(o, "get", r), le(o, "get", l));
      const { has: u } = Jt(o), h = t ? $n : e ? vt : Te;
      if (u.call(o, r))
        return h(i.get(r));
      if (u.call(o, l))
        return h(i.get(l));
      i !== o && i.get(r);
    },
    get size() {
      const r = this.__v_raw;
      return !e && le(/* @__PURE__ */ $(r), "iterate", rt), r.size;
    },
    has(r) {
      const i = this.__v_raw, o = /* @__PURE__ */ $(i), l = /* @__PURE__ */ $(r);
      return e || (Le(r, l) && le(o, "has", r), le(o, "has", l)), r === l ? i.has(r) : i.has(r) || i.has(l);
    },
    forEach(r, i) {
      const o = this, l = o.__v_raw, u = /* @__PURE__ */ $(l), h = t ? $n : e ? vt : Te;
      return !e && le(u, "iterate", rt), l.forEach((d, b) => r.call(i, h(d), h(b), o));
    }
  };
  return ae(
    n,
    e ? {
      add: Xt("add"),
      set: Xt("set"),
      delete: Xt("delete"),
      clear: Xt("clear")
    } : {
      add(r) {
        const i = /* @__PURE__ */ $(this), o = Jt(i), l = /* @__PURE__ */ $(r), u = !t && !/* @__PURE__ */ ve(r) && !/* @__PURE__ */ ze(r) ? l : r;
        return o.has.call(i, u) || Le(r, u) && o.has.call(i, r) || Le(l, u) && o.has.call(i, l) || (i.add(u), Be(i, "add", u, u)), this;
      },
      set(r, i) {
        !t && !/* @__PURE__ */ ve(i) && !/* @__PURE__ */ ze(i) && (i = /* @__PURE__ */ $(i));
        const o = /* @__PURE__ */ $(this), { has: l, get: u } = Jt(o);
        let h = l.call(o, r);
        h || (r = /* @__PURE__ */ $(r), h = l.call(o, r));
        const d = u.call(o, r);
        return o.set(r, i), h ? Le(i, d) && Be(o, "set", r, i) : Be(o, "add", r, i), this;
      },
      delete(r) {
        const i = /* @__PURE__ */ $(this), { has: o, get: l } = Jt(i);
        let u = o.call(i, r);
        u || (r = /* @__PURE__ */ $(r), u = o.call(i, r)), l && l.call(i, r);
        const h = i.delete(r);
        return u && Be(i, "delete", r, void 0), h;
      },
      clear() {
        const r = /* @__PURE__ */ $(this), i = r.size !== 0, o = r.clear();
        return i && Be(
          r,
          "clear",
          void 0,
          void 0
        ), o;
      }
    }
  ), [
    "keys",
    "values",
    "entries",
    Symbol.iterator
  ].forEach((r) => {
    n[r] = Mi(r, e, t);
  }), n;
}
function rs(e, t) {
  const n = Oi(e, t);
  return (s, r, i) => r === "__v_isReactive" ? !e : r === "__v_isReadonly" ? e : r === "__v_raw" ? s : Reflect.get(
    j(n, r) && r in s ? n : s,
    r,
    i
  );
}
const Ri = {
  get: /* @__PURE__ */ rs(!1, !1)
}, Fi = {
  get: /* @__PURE__ */ rs(!1, !0)
}, Di = {
  get: /* @__PURE__ */ rs(!0, !1)
};
const yr = /* @__PURE__ */ new WeakMap(), vr = /* @__PURE__ */ new WeakMap(), wr = /* @__PURE__ */ new WeakMap(), Li = /* @__PURE__ */ new WeakMap();
function ki(e) {
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
function Hi(e) {
  return e.__v_skip || !Object.isExtensible(e) ? 0 : ki(ci(e));
}
// @__NO_SIDE_EFFECTS__
function is(e) {
  return /* @__PURE__ */ ze(e) ? e : os(
    e,
    !1,
    Ei,
    Ri,
    yr
  );
}
// @__NO_SIDE_EFFECTS__
function Ni(e) {
  return os(
    e,
    !1,
    Ii,
    Fi,
    vr
  );
}
// @__NO_SIDE_EFFECTS__
function jn(e) {
  return os(
    e,
    !0,
    Pi,
    Di,
    wr
  );
}
function os(e, t, n, s, r) {
  if (!K(e) || e.__v_raw && !(t && e.__v_isReactive))
    return e;
  const i = Hi(e);
  if (i === 0)
    return e;
  const o = r.get(e);
  if (o)
    return o;
  const l = new Proxy(
    e,
    i === 2 ? s : n
  );
  return r.set(e, l), l;
}
// @__NO_SIDE_EFFECTS__
function it(e) {
  return /* @__PURE__ */ ze(e) ? /* @__PURE__ */ it(e.__v_raw) : !!(e && e.__v_isReactive);
}
// @__NO_SIDE_EFFECTS__
function ze(e) {
  return !!(e && e.__v_isReadonly);
}
// @__NO_SIDE_EFFECTS__
function ve(e) {
  return !!(e && e.__v_isShallow);
}
// @__NO_SIDE_EFFECTS__
function ls(e) {
  return e ? !!e.__v_raw : !1;
}
// @__NO_SIDE_EFFECTS__
function $(e) {
  const t = e && e.__v_raw;
  return t ? /* @__PURE__ */ $(t) : e;
}
function Ui(e) {
  return !j(e, "__v_skip") && Object.isExtensible(e) && rr(e, "__v_skip", !0), e;
}
const Te = (e) => K(e) ? /* @__PURE__ */ is(e) : e, vt = (e) => K(e) ? /* @__PURE__ */ jn(e) : e;
// @__NO_SIDE_EFFECTS__
function ce(e) {
  return e ? e.__v_isRef === !0 : !1;
}
// @__NO_SIDE_EFFECTS__
function Pt(e) {
  return $i(e, !1);
}
function $i(e, t) {
  return /* @__PURE__ */ ce(e) ? e : new ji(e, t);
}
class ji {
  constructor(t, n) {
    this.dep = new ss(), this.__v_isRef = !0, this.__v_isShallow = !1, this._rawValue = n ? t : /* @__PURE__ */ $(t), this._value = n ? t : Te(t), this.__v_isShallow = n;
  }
  get value() {
    return this.dep.track(), this._value;
  }
  set value(t) {
    const n = this._rawValue, s = this.__v_isShallow || /* @__PURE__ */ ve(t) || /* @__PURE__ */ ze(t);
    t = s ? t : /* @__PURE__ */ $(t), Le(t, n) && (this._rawValue = t, this._value = s ? t : Te(t), this.dep.trigger());
  }
}
function Wi(e) {
  return /* @__PURE__ */ ce(e) ? e.value : e;
}
const Bi = {
  get: (e, t, n) => t === "__v_raw" ? e : Wi(Reflect.get(e, t, n)),
  set: (e, t, n, s) => {
    const r = e[t];
    return /* @__PURE__ */ ce(r) && !/* @__PURE__ */ ce(n) ? (r.value = n, !0) : Reflect.set(e, t, n, s);
  }
};
function xr(e) {
  return /* @__PURE__ */ it(e) ? e : new Proxy(e, Bi);
}
class Ki {
  constructor(t, n, s) {
    this.fn = t, this.setter = n, this._value = void 0, this.dep = new ss(this), this.__v_isRef = !0, this.deps = void 0, this.depsTail = void 0, this.flags = 16, this.globalVersion = $t - 1, this.next = void 0, this.effect = this, this.__v_isReadonly = !n, this.isSSR = s;
  }
  /**
   * @internal
   */
  notify() {
    if (this.flags |= 16, !(this.flags & 8) && // avoid infinite self recursion
    J !== this)
      return ur(this, !0), !0;
  }
  get value() {
    const t = this.dep.track();
    return pr(this), t && (t.version = this.dep.version), this._value;
  }
  set value(t) {
    this.setter && this.setter(t);
  }
}
// @__NO_SIDE_EFFECTS__
function Vi(e, t, n = !1) {
  let s, r;
  return F(e) ? s = e : (s = e.get, r = e.set), new Ki(s, r, n);
}
const Zt = {}, ln = /* @__PURE__ */ new WeakMap();
let st;
function Gi(e, t = !1, n = st) {
  if (n) {
    let s = ln.get(n);
    s || ln.set(n, s = []), s.push(e);
  }
}
function qi(e, t, n = q) {
  const { immediate: s, deep: r, once: i, scheduler: o, augmentJob: l, call: u } = n, h = (E) => r ? E : /* @__PURE__ */ ve(E) || r === !1 || r === 0 ? Ke(E, 1) : Ke(E);
  let d, b, T, C, N = !1, O = !1;
  if (/* @__PURE__ */ ce(e) ? (b = () => e.value, N = /* @__PURE__ */ ve(e)) : /* @__PURE__ */ it(e) ? (b = () => h(e), N = !0) : R(e) ? (O = !0, N = e.some((E) => /* @__PURE__ */ it(E) || /* @__PURE__ */ ve(E)), b = () => e.map((E) => {
    if (/* @__PURE__ */ ce(E))
      return E.value;
    if (/* @__PURE__ */ it(E))
      return h(E);
    if (F(E))
      return u ? u(E, 2) : E();
  })) : F(e) ? t ? b = u ? () => u(e, 2) : e : b = () => {
    if (T) {
      Ge();
      try {
        T();
      } finally {
        qe();
      }
    }
    const E = st;
    st = d;
    try {
      return u ? u(e, 3, [C]) : e(C);
    } finally {
      st = E;
    }
  } : b = ke, t && r) {
    const E = b, Q = r === !0 ? 1 / 0 : r;
    b = () => Ke(E(), Q);
  }
  const D = yi(), z = () => {
    d.stop(), D && D.active && Jn(D.effects, d);
  };
  if (i && t) {
    const E = t;
    t = (...Q) => {
      E(...Q), z();
    };
  }
  let L = O ? new Array(e.length).fill(Zt) : Zt;
  const V = (E) => {
    if (!(!(d.flags & 1) || !d.dirty && !E))
      if (t) {
        const Q = d.run();
        if (r || N || (O ? Q.some((Ae, be) => Le(Ae, L[be])) : Le(Q, L))) {
          T && T();
          const Ae = st;
          st = d;
          try {
            const be = [
              Q,
              // pass undefined as the old value when it's changed for the first time
              L === Zt ? void 0 : O && L[0] === Zt ? [] : L,
              C
            ];
            L = Q, u ? u(t, 3, be) : (
              // @ts-expect-error
              t(...be)
            );
          } finally {
            st = Ae;
          }
        }
      } else
        d.run();
  };
  return l && l(V), d = new cr(b), d.scheduler = o ? () => o(V, !1) : V, C = (E) => Gi(E, !1, d), T = d.onStop = () => {
    const E = ln.get(d);
    if (E) {
      if (u)
        u(E, 4);
      else
        for (const Q of E) Q();
      ln.delete(d);
    }
  }, t ? s ? V(!0) : L = d.run() : o ? o(V.bind(null, !0), !0) : d.run(), z.pause = d.pause.bind(d), z.resume = d.resume.bind(d), z.stop = z, z;
}
function Ke(e, t = 1 / 0, n) {
  if (t <= 0 || !K(e) || e.__v_skip || (n = n || /* @__PURE__ */ new Map(), (n.get(e) || 0) >= t))
    return e;
  if (n.set(e, t), t--, /* @__PURE__ */ ce(e))
    Ke(e.value, t, n);
  else if (R(e))
    for (let s = 0; s < e.length; s++)
      Ke(e[s], t, n);
  else if (Qs(e) || mt(e))
    e.forEach((s) => {
      Ke(s, t, n);
    });
  else if (nr(e)) {
    for (const s in e)
      Ke(e[s], t, n);
    for (const s of Object.getOwnPropertySymbols(e))
      Object.prototype.propertyIsEnumerable.call(e, s) && Ke(e[s], t, n);
  }
  return e;
}
function Gt(e, t, n, s) {
  try {
    return s ? e(...s) : e();
  } catch (r) {
    vn(r, t, n);
  }
}
function Ne(e, t, n, s) {
  if (F(e)) {
    const r = Gt(e, t, n, s);
    return r && er(r) && r.catch((i) => {
      vn(i, t, n);
    }), r;
  }
  if (R(e)) {
    const r = [];
    for (let i = 0; i < e.length; i++)
      r.push(Ne(e[i], t, n, s));
    return r;
  }
}
function vn(e, t, n, s = !0) {
  const r = t ? t.vnode : null, { errorHandler: i, throwUnhandledErrorInProduction: o } = t && t.appContext.config || q;
  if (t) {
    let l = t.parent;
    const u = t.proxy, h = `https://vuejs.org/error-reference/#runtime-${n}`;
    for (; l; ) {
      const d = l.ec;
      if (d) {
        for (let b = 0; b < d.length; b++)
          if (d[b](e, u, h) === !1)
            return;
      }
      l = l.parent;
    }
    if (i) {
      Ge(), Gt(i, null, 10, [
        e,
        u,
        h
      ]), qe();
      return;
    }
  }
  zi(e, n, r, s, o);
}
function zi(e, t, n, s = !0, r = !1) {
  if (r)
    throw e;
  console.error(e);
}
const de = [];
let Re = -1;
const _t = [];
let Xe = null, ht = 0;
const Sr = /* @__PURE__ */ Promise.resolve();
let cn = null;
function nn(e) {
  const t = cn || Sr;
  return e ? t.then(this ? e.bind(this) : e) : t;
}
function Yi(e) {
  let t = Re + 1, n = de.length;
  for (; t < n; ) {
    const s = t + n >>> 1, r = de[s], i = Wt(r);
    i < e || i === e && r.flags & 2 ? t = s + 1 : n = s;
  }
  return t;
}
function cs(e) {
  if (!(e.flags & 1)) {
    const t = Wt(e), n = de[de.length - 1];
    !n || // fast path when the job id is larger than the tail
    !(e.flags & 2) && t >= Wt(n) ? de.push(e) : de.splice(Yi(t), 0, e), e.flags |= 1, Tr();
  }
}
function Tr() {
  cn || (cn = Sr.then(Ar));
}
function Ji(e) {
  R(e) ? _t.push(...e) : Xe && e.id === -1 ? Xe.splice(ht + 1, 0, e) : e.flags & 1 || (_t.push(e), e.flags |= 1), Tr();
}
function ws(e, t, n = Re + 1) {
  for (; n < de.length; n++) {
    const s = de[n];
    if (s && s.flags & 2) {
      if (e && s.id !== e.uid)
        continue;
      de.splice(n, 1), n--, s.flags & 4 && (s.flags &= -2), s(), s.flags & 4 || (s.flags &= -2);
    }
  }
}
function Cr(e) {
  if (_t.length) {
    const t = [...new Set(_t)].sort(
      (n, s) => Wt(n) - Wt(s)
    );
    if (_t.length = 0, Xe) {
      Xe.push(...t);
      return;
    }
    for (Xe = t, ht = 0; ht < Xe.length; ht++) {
      const n = Xe[ht];
      n.flags & 4 && (n.flags &= -2), n.flags & 8 || n(), n.flags &= -2;
    }
    Xe = null, ht = 0;
  }
}
const Wt = (e) => e.id == null ? e.flags & 2 ? -1 : 1 / 0 : e.id;
function Ar(e) {
  try {
    for (Re = 0; Re < de.length; Re++) {
      const t = de[Re];
      t && !(t.flags & 8) && (t.flags & 4 && (t.flags &= -2), Gt(
        t,
        t.i,
        t.i ? 15 : 14
      ), t.flags & 4 || (t.flags &= -2));
    }
  } finally {
    for (; Re < de.length; Re++) {
      const t = de[Re];
      t && (t.flags &= -2);
    }
    Re = -1, de.length = 0, Cr(), cn = null, (de.length || _t.length) && Ar();
  }
}
let ye = null, Er = null;
function an(e) {
  const t = ye;
  return ye = e, Er = e && e.type.__scopeId || null, t;
}
function Xi(e, t = ye, n) {
  if (!t || e._n)
    return e;
  const s = (...r) => {
    s._d && Rs(-1);
    const i = an(t);
    let o;
    try {
      o = e(...r);
    } finally {
      an(i), s._d && Rs(1);
    }
    return o;
  };
  return s._n = !0, s._c = !0, s._d = !0, s;
}
function Qt(e, t) {
  if (ye === null)
    return e;
  const n = Tn(ye), s = e.dirs || (e.dirs = []);
  for (let r = 0; r < t.length; r++) {
    let [i, o, l, u = q] = t[r];
    i && (F(i) && (i = {
      mounted: i,
      updated: i
    }), i.deep && Ke(o), s.push({
      dir: i,
      instance: n,
      value: o,
      oldValue: void 0,
      arg: l,
      modifiers: u
    }));
  }
  return e;
}
function tt(e, t, n, s) {
  const r = e.dirs, i = t && t.dirs;
  for (let o = 0; o < r.length; o++) {
    const l = r[o];
    i && (l.oldValue = i[o].value);
    let u = l.dir[s];
    u && (Ge(), Ne(u, n, 8, [
      e.el,
      l,
      e,
      t
    ]), qe());
  }
}
function Zi(e, t) {
  if (pe) {
    let n = pe.provides;
    const s = pe.parent && pe.parent.provides;
    s === n && (n = pe.provides = Object.create(s)), n[e] = t;
  }
}
function sn(e, t, n = !1) {
  const s = Zo();
  if (s || yt) {
    let r = yt ? yt._context.provides : s ? s.parent == null || s.ce ? s.vnode.appContext && s.vnode.appContext.provides : s.parent.provides : void 0;
    if (r && e in r)
      return r[e];
    if (arguments.length > 1)
      return n && F(t) ? t.call(s && s.proxy) : t;
  }
}
const Qi = /* @__PURE__ */ Symbol.for("v-scx"), eo = () => sn(Qi);
function rn(e, t, n) {
  return Pr(e, t, n);
}
function Pr(e, t, n = q) {
  const { immediate: s, deep: r, flush: i, once: o } = n, l = ae({}, n), u = t && s || !t && i !== "post";
  let h;
  if (Kt) {
    if (i === "sync") {
      const C = eo();
      h = C.__watcherHandles || (C.__watcherHandles = []);
    } else if (!u) {
      const C = () => {
      };
      return C.stop = ke, C.resume = ke, C.pause = ke, C;
    }
  }
  const d = pe;
  l.call = (C, N, O) => Ne(C, d, N, O);
  let b = !1;
  i === "post" ? l.scheduler = (C) => {
    ge(C, d && d.suspense);
  } : i !== "sync" && (b = !0, l.scheduler = (C, N) => {
    N ? C() : cs(C);
  }), l.augmentJob = (C) => {
    t && (C.flags |= 4), b && (C.flags |= 2, d && (C.id = d.uid, C.i = d));
  };
  const T = qi(e, t, l);
  return Kt && (h ? h.push(T) : u && T()), T;
}
function to(e, t, n) {
  const s = this.proxy, r = Z(e) ? e.includes(".") ? Ir(s, e) : () => s[e] : e.bind(s, s);
  let i;
  F(t) ? i = t : (i = t.handler, n = t);
  const o = qt(this), l = Pr(r, i.bind(s), n);
  return o(), l;
}
function Ir(e, t) {
  const n = t.split(".");
  return () => {
    let s = e;
    for (let r = 0; r < n.length && s; r++)
      s = s[n[r]];
    return s;
  };
}
const no = /* @__PURE__ */ Symbol("_vte"), so = (e) => e.__isTeleport, ro = /* @__PURE__ */ Symbol("_leaveCb");
function as(e, t) {
  e.shapeFlag & 6 && e.component ? (e.transition = t, as(e.component.subTree, t)) : e.shapeFlag & 128 ? (e.ssContent.transition = t.clone(e.ssContent), e.ssFallback.transition = t.clone(e.ssFallback)) : e.transition = t;
}
function Mr(e) {
  e.ids = [e.ids[0] + e.ids[2]++ + "-", 0, 0];
}
function xs(e, t) {
  let n;
  return !!((n = Object.getOwnPropertyDescriptor(e, t)) && !n.configurable);
}
const un = /* @__PURE__ */ new WeakMap();
function kt(e, t, n, s, r = !1) {
  if (R(e)) {
    e.forEach(
      (O, D) => kt(
        O,
        t && (R(t) ? t[D] : t),
        n,
        s,
        r
      )
    );
    return;
  }
  if (Ht(s) && !r) {
    s.shapeFlag & 512 && s.type.__asyncResolved && s.component.subTree.component && kt(e, t, n, s.component.subTree);
    return;
  }
  const i = s.shapeFlag & 4 ? Tn(s.component) : s.el, o = r ? null : i, { i: l, r: u } = e, h = t && t.r, d = l.refs === q ? l.refs = {} : l.refs, b = l.setupState, T = /* @__PURE__ */ $(b), C = b === q ? Zs : (O) => xs(d, O) ? !1 : j(T, O), N = (O, D) => !(D && xs(d, D));
  if (h != null && h !== u) {
    if (Ss(t), Z(h))
      d[h] = null, C(h) && (b[h] = null);
    else if (/* @__PURE__ */ ce(h)) {
      const O = t;
      N(h, O.k) && (h.value = null), O.k && (d[O.k] = null);
    }
  }
  if (F(u))
    Gt(u, l, 12, [o, d]);
  else {
    const O = Z(u), D = /* @__PURE__ */ ce(u);
    if (O || D) {
      const z = () => {
        if (e.f) {
          const L = O ? C(u) ? b[u] : d[u] : N() || !e.k ? u.value : d[e.k];
          if (r)
            R(L) && Jn(L, i);
          else if (R(L))
            L.includes(i) || L.push(i);
          else if (O)
            d[u] = [i], C(u) && (b[u] = d[u]);
          else {
            const V = [i];
            N(u, e.k) && (u.value = V), e.k && (d[e.k] = V);
          }
        } else O ? (d[u] = o, C(u) && (b[u] = o)) : D && (N(u, e.k) && (u.value = o), e.k && (d[e.k] = o));
      };
      if (o) {
        const L = () => {
          z(), un.delete(e);
        };
        L.id = -1, un.set(e, L), ge(L, n);
      } else
        Ss(e), z();
    }
  }
}
function Ss(e) {
  const t = un.get(e);
  t && (t.flags |= 8, un.delete(e));
}
mn().requestIdleCallback;
mn().cancelIdleCallback;
const Ht = (e) => !!e.type.__asyncLoader, Or = (e) => e.type.__isKeepAlive;
function io(e, t) {
  Rr(e, "a", t);
}
function oo(e, t) {
  Rr(e, "da", t);
}
function Rr(e, t, n = pe) {
  const s = e.__wdc || (e.__wdc = () => {
    let r = n;
    for (; r; ) {
      if (r.isDeactivated)
        return;
      r = r.parent;
    }
    return e();
  });
  if (wn(t, s, n), n) {
    let r = n.parent;
    for (; r && r.parent; )
      Or(r.parent.vnode) && lo(s, t, n, r), r = r.parent;
  }
}
function lo(e, t, n, s) {
  const r = wn(
    t,
    e,
    s,
    !0
    /* prepend */
  );
  Lr(() => {
    Jn(s[t], r);
  }, n);
}
function wn(e, t, n = pe, s = !1) {
  if (n) {
    const r = n[e] || (n[e] = []), i = t.__weh || (t.__weh = (...o) => {
      Ge();
      const l = qt(n), u = Ne(t, n, e, o);
      return l(), qe(), u;
    });
    return s ? r.unshift(i) : r.push(i), i;
  }
}
const Ye = (e) => (t, n = pe) => {
  (!Kt || e === "sp") && wn(e, (...s) => t(...s), n);
}, co = Ye("bm"), Fr = Ye("m"), ao = Ye(
  "bu"
), uo = Ye("u"), Dr = Ye(
  "bum"
), Lr = Ye("um"), fo = Ye(
  "sp"
), po = Ye("rtg"), ho = Ye("rtc");
function go(e, t = pe) {
  wn("ec", e, t);
}
const bo = /* @__PURE__ */ Symbol.for("v-ndc");
function pt(e, t, n, s) {
  let r;
  const i = n, o = R(e);
  if (o || Z(e)) {
    const l = o && /* @__PURE__ */ it(e);
    let u = !1, h = !1;
    l && (u = !/* @__PURE__ */ ve(e), h = /* @__PURE__ */ ze(e), e = yn(e)), r = new Array(e.length);
    for (let d = 0, b = e.length; d < b; d++)
      r[d] = t(
        u ? h ? vt(Te(e[d])) : Te(e[d]) : e[d],
        d,
        void 0,
        i
      );
  } else if (typeof e == "number") {
    r = new Array(e);
    for (let l = 0; l < e; l++)
      r[l] = t(l + 1, l, void 0, i);
  } else if (K(e))
    if (e[Symbol.iterator])
      r = Array.from(
        e,
        (l, u) => t(l, u, void 0, i)
      );
    else {
      const l = Object.keys(e);
      r = new Array(l.length);
      for (let u = 0, h = l.length; u < h; u++) {
        const d = l[u];
        r[u] = t(e[d], d, u, i);
      }
    }
  else
    r = [];
  return r;
}
const Wn = (e) => e ? ni(e) ? Tn(e) : Wn(e.parent) : null, Nt = (
  // Move PURE marker to new line to workaround compiler discarding it
  // due to type annotation
  /* @__PURE__ */ ae(/* @__PURE__ */ Object.create(null), {
    $: (e) => e,
    $el: (e) => e.vnode.el,
    $data: (e) => e.data,
    $props: (e) => e.props,
    $attrs: (e) => e.attrs,
    $slots: (e) => e.slots,
    $refs: (e) => e.refs,
    $parent: (e) => Wn(e.parent),
    $root: (e) => Wn(e.root),
    $host: (e) => e.ce,
    $emit: (e) => e.emit,
    $options: (e) => Hr(e),
    $forceUpdate: (e) => e.f || (e.f = () => {
      cs(e.update);
    }),
    $nextTick: (e) => e.n || (e.n = nn.bind(e.proxy)),
    $watch: (e) => to.bind(e)
  })
), On = (e, t) => e !== q && !e.__isScriptSetup && j(e, t), mo = {
  get({ _: e }, t) {
    if (t === "__v_skip")
      return !0;
    const { ctx: n, setupState: s, data: r, props: i, accessCache: o, type: l, appContext: u } = e;
    if (t[0] !== "$") {
      const T = o[t];
      if (T !== void 0)
        switch (T) {
          case 1:
            return s[t];
          case 2:
            return r[t];
          case 4:
            return n[t];
          case 3:
            return i[t];
        }
      else {
        if (On(s, t))
          return o[t] = 1, s[t];
        if (r !== q && j(r, t))
          return o[t] = 2, r[t];
        if (j(i, t))
          return o[t] = 3, i[t];
        if (n !== q && j(n, t))
          return o[t] = 4, n[t];
        Bn && (o[t] = 0);
      }
    }
    const h = Nt[t];
    let d, b;
    if (h)
      return t === "$attrs" && le(e.attrs, "get", ""), h(e);
    if (
      // css module (injected by vue-loader)
      (d = l.__cssModules) && (d = d[t])
    )
      return d;
    if (n !== q && j(n, t))
      return o[t] = 4, n[t];
    if (
      // global properties
      b = u.config.globalProperties, j(b, t)
    )
      return b[t];
  },
  set({ _: e }, t, n) {
    const { data: s, setupState: r, ctx: i } = e;
    return On(r, t) ? (r[t] = n, !0) : s !== q && j(s, t) ? (s[t] = n, !0) : j(e.props, t) || t[0] === "$" && t.slice(1) in e ? !1 : (i[t] = n, !0);
  },
  has({
    _: { data: e, setupState: t, accessCache: n, ctx: s, appContext: r, props: i, type: o }
  }, l) {
    let u;
    return !!(n[l] || e !== q && l[0] !== "$" && j(e, l) || On(t, l) || j(i, l) || j(s, l) || j(Nt, l) || j(r.config.globalProperties, l) || (u = o.__cssModules) && u[l]);
  },
  defineProperty(e, t, n) {
    return n.get != null ? e._.accessCache[t] = 0 : j(n, "value") && this.set(e, t, n.value, null), Reflect.defineProperty(e, t, n);
  }
};
function Ts(e) {
  return R(e) ? e.reduce(
    (t, n) => (t[n] = null, t),
    {}
  ) : e;
}
let Bn = !0;
function _o(e) {
  const t = Hr(e), n = e.proxy, s = e.ctx;
  Bn = !1, t.beforeCreate && Cs(t.beforeCreate, e, "bc");
  const {
    // state
    data: r,
    computed: i,
    methods: o,
    watch: l,
    provide: u,
    inject: h,
    // lifecycle
    created: d,
    beforeMount: b,
    mounted: T,
    beforeUpdate: C,
    updated: N,
    activated: O,
    deactivated: D,
    beforeDestroy: z,
    beforeUnmount: L,
    destroyed: V,
    unmounted: E,
    render: Q,
    renderTracked: Ae,
    renderTriggered: be,
    errorCaptured: Ee,
    serverPrefetch: lt,
    // public API
    expose: Ue,
    inheritAttrs: Qe,
    // assets
    components: ct,
    directives: at,
    filters: xt
  } = t;
  if (h && yo(h, s, null), o)
    for (const X in o) {
      const B = o[X];
      F(B) && (s[X] = B.bind(n));
    }
  if (r) {
    const X = r.call(n, n);
    K(X) && (e.data = /* @__PURE__ */ is(X));
  }
  if (Bn = !0, i)
    for (const X in i) {
      const B = i[X], P = F(B) ? B.bind(n, n) : F(B.get) ? B.get.bind(n, n) : ke, ut = !F(B) && F(B.set) ? B.set.bind(n) : ke, he = fe({
        get: P,
        set: ut
      });
      Object.defineProperty(s, X, {
        enumerable: !0,
        configurable: !0,
        get: () => he.value,
        set: (te) => he.value = te
      });
    }
  if (l)
    for (const X in l)
      kr(l[X], s, n, X);
  if (u) {
    const X = F(u) ? u.call(n) : u;
    Reflect.ownKeys(X).forEach((B) => {
      Zi(B, X[B]);
    });
  }
  d && Cs(d, e, "c");
  function se(X, B) {
    R(B) ? B.forEach((P) => X(P.bind(n))) : B && X(B.bind(n));
  }
  if (se(co, b), se(Fr, T), se(ao, C), se(uo, N), se(io, O), se(oo, D), se(go, Ee), se(ho, Ae), se(po, be), se(Dr, L), se(Lr, E), se(fo, lt), R(Ue))
    if (Ue.length) {
      const X = e.exposed || (e.exposed = {});
      Ue.forEach((B) => {
        Object.defineProperty(X, B, {
          get: () => n[B],
          set: (P) => n[B] = P,
          enumerable: !0
        });
      });
    } else e.exposed || (e.exposed = {});
  Q && e.render === ke && (e.render = Q), Qe != null && (e.inheritAttrs = Qe), ct && (e.components = ct), at && (e.directives = at), lt && Mr(e);
}
function yo(e, t, n = ke) {
  R(e) && (e = Kn(e));
  for (const s in e) {
    const r = e[s];
    let i;
    K(r) ? "default" in r ? i = sn(
      r.from || s,
      r.default,
      !0
    ) : i = sn(r.from || s) : i = sn(r), /* @__PURE__ */ ce(i) ? Object.defineProperty(t, s, {
      enumerable: !0,
      configurable: !0,
      get: () => i.value,
      set: (o) => i.value = o
    }) : t[s] = i;
  }
}
function Cs(e, t, n) {
  Ne(
    R(e) ? e.map((s) => s.bind(t.proxy)) : e.bind(t.proxy),
    t,
    n
  );
}
function kr(e, t, n, s) {
  let r = s.includes(".") ? Ir(n, s) : () => n[s];
  if (Z(e)) {
    const i = t[e];
    F(i) && rn(r, i);
  } else if (F(e))
    rn(r, e.bind(n));
  else if (K(e))
    if (R(e))
      e.forEach((i) => kr(i, t, n, s));
    else {
      const i = F(e.handler) ? e.handler.bind(n) : t[e.handler];
      F(i) && rn(r, i, e);
    }
}
function Hr(e) {
  const t = e.type, { mixins: n, extends: s } = t, {
    mixins: r,
    optionsCache: i,
    config: { optionMergeStrategies: o }
  } = e.appContext, l = i.get(t);
  let u;
  return l ? u = l : !r.length && !n && !s ? u = t : (u = {}, r.length && r.forEach(
    (h) => fn(u, h, o, !0)
  ), fn(u, t, o)), K(t) && i.set(t, u), u;
}
function fn(e, t, n, s = !1) {
  const { mixins: r, extends: i } = t;
  i && fn(e, i, n, !0), r && r.forEach(
    (o) => fn(e, o, n, !0)
  );
  for (const o in t)
    if (!(s && o === "expose")) {
      const l = vo[o] || n && n[o];
      e[o] = l ? l(e[o], t[o]) : t[o];
    }
  return e;
}
const vo = {
  data: As,
  props: Es,
  emits: Es,
  // objects
  methods: Ot,
  computed: Ot,
  // lifecycle
  beforeCreate: ue,
  created: ue,
  beforeMount: ue,
  mounted: ue,
  beforeUpdate: ue,
  updated: ue,
  beforeDestroy: ue,
  beforeUnmount: ue,
  destroyed: ue,
  unmounted: ue,
  activated: ue,
  deactivated: ue,
  errorCaptured: ue,
  serverPrefetch: ue,
  // assets
  components: Ot,
  directives: Ot,
  // watch
  watch: xo,
  // provide / inject
  provide: As,
  inject: wo
};
function As(e, t) {
  return t ? e ? function() {
    return ae(
      F(e) ? e.call(this, this) : e,
      F(t) ? t.call(this, this) : t
    );
  } : t : e;
}
function wo(e, t) {
  return Ot(Kn(e), Kn(t));
}
function Kn(e) {
  if (R(e)) {
    const t = {};
    for (let n = 0; n < e.length; n++)
      t[e[n]] = e[n];
    return t;
  }
  return e;
}
function ue(e, t) {
  return e ? [...new Set([].concat(e, t))] : t;
}
function Ot(e, t) {
  return e ? ae(/* @__PURE__ */ Object.create(null), e, t) : t;
}
function Es(e, t) {
  return e ? R(e) && R(t) ? [.../* @__PURE__ */ new Set([...e, ...t])] : ae(
    /* @__PURE__ */ Object.create(null),
    Ts(e),
    Ts(t ?? {})
  ) : t;
}
function xo(e, t) {
  if (!e) return t;
  if (!t) return e;
  const n = ae(/* @__PURE__ */ Object.create(null), e);
  for (const s in t)
    n[s] = ue(e[s], t[s]);
  return n;
}
function Nr() {
  return {
    app: null,
    config: {
      isNativeTag: Zs,
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
let So = 0;
function To(e, t) {
  return function(s, r = null) {
    F(s) || (s = ae({}, s)), r != null && !K(r) && (r = null);
    const i = Nr(), o = /* @__PURE__ */ new WeakSet(), l = [];
    let u = !1;
    const h = i.app = {
      _uid: So++,
      _component: s,
      _props: r,
      _container: null,
      _context: i,
      _instance: null,
      version: rl,
      get config() {
        return i.config;
      },
      set config(d) {
      },
      use(d, ...b) {
        return o.has(d) || (d && F(d.install) ? (o.add(d), d.install(h, ...b)) : F(d) && (o.add(d), d(h, ...b))), h;
      },
      mixin(d) {
        return i.mixins.includes(d) || i.mixins.push(d), h;
      },
      component(d, b) {
        return b ? (i.components[d] = b, h) : i.components[d];
      },
      directive(d, b) {
        return b ? (i.directives[d] = b, h) : i.directives[d];
      },
      mount(d, b, T) {
        if (!u) {
          const C = h._ceVNode || Ve(s, r);
          return C.appContext = i, T === !0 ? T = "svg" : T === !1 && (T = void 0), e(C, d, T), u = !0, h._container = d, d.__vue_app__ = h, Tn(C.component);
        }
      },
      onUnmount(d) {
        l.push(d);
      },
      unmount() {
        u && (Ne(
          l,
          h._instance,
          16
        ), e(null, h._container), delete h._container.__vue_app__);
      },
      provide(d, b) {
        return i.provides[d] = b, h;
      },
      runWithContext(d) {
        const b = yt;
        yt = h;
        try {
          return d();
        } finally {
          yt = b;
        }
      }
    };
    return h;
  };
}
let yt = null;
const Co = (e, t) => t === "modelValue" || t === "model-value" ? e.modelModifiers : e[`${t}Modifiers`] || e[`${xe(t)}Modifiers`] || e[`${ot(t)}Modifiers`];
function Ao(e, t, ...n) {
  if (e.isUnmounted) return;
  const s = e.vnode.props || q;
  let r = n;
  const i = t.startsWith("update:"), o = i && Co(s, t.slice(7));
  o && (o.trim && (r = n.map((d) => Z(d) ? d.trim() : d)), o.number && (r = n.map(Zn)));
  let l, u = s[l = An(t)] || // also try camelCase event handler (#2249)
  s[l = An(xe(t))];
  !u && i && (u = s[l = An(ot(t))]), u && Ne(
    u,
    e,
    6,
    r
  );
  const h = s[l + "Once"];
  if (h) {
    if (!e.emitted)
      e.emitted = {};
    else if (e.emitted[l])
      return;
    e.emitted[l] = !0, Ne(
      h,
      e,
      6,
      r
    );
  }
}
const Eo = /* @__PURE__ */ new WeakMap();
function Ur(e, t, n = !1) {
  const s = n ? Eo : t.emitsCache, r = s.get(e);
  if (r !== void 0)
    return r;
  const i = e.emits;
  let o = {}, l = !1;
  if (!F(e)) {
    const u = (h) => {
      const d = Ur(h, t, !0);
      d && (l = !0, ae(o, d));
    };
    !n && t.mixins.length && t.mixins.forEach(u), e.extends && u(e.extends), e.mixins && e.mixins.forEach(u);
  }
  return !i && !l ? (K(e) && s.set(e, null), null) : (R(i) ? i.forEach((u) => o[u] = null) : ae(o, i), K(e) && s.set(e, o), o);
}
function xn(e, t) {
  return !e || !hn(t) ? !1 : (t = t.slice(2).replace(/Once$/, ""), j(e, t[0].toLowerCase() + t.slice(1)) || j(e, ot(t)) || j(e, t));
}
function Ps(e) {
  const {
    type: t,
    vnode: n,
    proxy: s,
    withProxy: r,
    propsOptions: [i],
    slots: o,
    attrs: l,
    emit: u,
    render: h,
    renderCache: d,
    props: b,
    data: T,
    setupState: C,
    ctx: N,
    inheritAttrs: O
  } = e, D = an(e);
  let z, L;
  try {
    if (n.shapeFlag & 4) {
      const E = r || s, Q = E;
      z = De(
        h.call(
          Q,
          E,
          d,
          b,
          C,
          T,
          N
        )
      ), L = l;
    } else {
      const E = t;
      z = De(
        E.length > 1 ? E(
          b,
          { attrs: l, slots: o, emit: u }
        ) : E(
          b,
          null
        )
      ), L = t.props ? l : Po(l);
    }
  } catch (E) {
    Ut.length = 0, vn(E, e, 1), z = Ve(Ze);
  }
  let V = z;
  if (L && O !== !1) {
    const E = Object.keys(L), { shapeFlag: Q } = V;
    E.length && Q & 7 && (i && E.some(gn) && (L = Io(
      L,
      i
    )), V = wt(V, L, !1, !0));
  }
  return n.dirs && (V = wt(V, null, !1, !0), V.dirs = V.dirs ? V.dirs.concat(n.dirs) : n.dirs), n.transition && as(V, n.transition), z = V, an(D), z;
}
const Po = (e) => {
  let t;
  for (const n in e)
    (n === "class" || n === "style" || hn(n)) && ((t || (t = {}))[n] = e[n]);
  return t;
}, Io = (e, t) => {
  const n = {};
  for (const s in e)
    (!gn(s) || !(s.slice(9) in t)) && (n[s] = e[s]);
  return n;
};
function Mo(e, t, n) {
  const { props: s, children: r, component: i } = e, { props: o, children: l, patchFlag: u } = t, h = i.emitsOptions;
  if (t.dirs || t.transition)
    return !0;
  if (n && u >= 0) {
    if (u & 1024)
      return !0;
    if (u & 16)
      return s ? Is(s, o, h) : !!o;
    if (u & 8) {
      const d = t.dynamicProps;
      for (let b = 0; b < d.length; b++) {
        const T = d[b];
        if ($r(o, s, T) && !xn(h, T))
          return !0;
      }
    }
  } else
    return (r || l) && (!l || !l.$stable) ? !0 : s === o ? !1 : s ? o ? Is(s, o, h) : !0 : !!o;
  return !1;
}
function Is(e, t, n) {
  const s = Object.keys(t);
  if (s.length !== Object.keys(e).length)
    return !0;
  for (let r = 0; r < s.length; r++) {
    const i = s[r];
    if ($r(t, e, i) && !xn(n, i))
      return !0;
  }
  return !1;
}
function $r(e, t, n) {
  const s = e[n], r = t[n];
  return n === "style" && K(s) && K(r) ? !Qn(s, r) : s !== r;
}
function Oo({ vnode: e, parent: t, suspense: n }, s) {
  for (; t; ) {
    const r = t.subTree;
    if (r.suspense && r.suspense.activeBranch === e && (r.suspense.vnode.el = r.el = s, e = r), r === e)
      (e = t.vnode).el = s, t = t.parent;
    else
      break;
  }
  n && n.activeBranch === e && (n.vnode.el = s);
}
const jr = {}, Wr = () => Object.create(jr), Br = (e) => Object.getPrototypeOf(e) === jr;
function Ro(e, t, n, s = !1) {
  const r = {}, i = Wr();
  e.propsDefaults = /* @__PURE__ */ Object.create(null), Kr(e, t, r, i);
  for (const o in e.propsOptions[0])
    o in r || (r[o] = void 0);
  n ? e.props = s ? r : /* @__PURE__ */ Ni(r) : e.type.props ? e.props = r : e.props = i, e.attrs = i;
}
function Fo(e, t, n, s) {
  const {
    props: r,
    attrs: i,
    vnode: { patchFlag: o }
  } = e, l = /* @__PURE__ */ $(r), [u] = e.propsOptions;
  let h = !1;
  if (
    // always force full diff in dev
    // - #1942 if hmr is enabled with sfc component
    // - vite#872 non-sfc component used by sfc component
    (s || o > 0) && !(o & 16)
  ) {
    if (o & 8) {
      const d = e.vnode.dynamicProps;
      for (let b = 0; b < d.length; b++) {
        let T = d[b];
        if (xn(e.emitsOptions, T))
          continue;
        const C = t[T];
        if (u)
          if (j(i, T))
            C !== i[T] && (i[T] = C, h = !0);
          else {
            const N = xe(T);
            r[N] = Vn(
              u,
              l,
              N,
              C,
              e,
              !1
            );
          }
        else
          C !== i[T] && (i[T] = C, h = !0);
      }
    }
  } else {
    Kr(e, t, r, i) && (h = !0);
    let d;
    for (const b in l)
      (!t || // for camelCase
      !j(t, b) && // it's possible the original props was passed in as kebab-case
      // and converted to camelCase (#955)
      ((d = ot(b)) === b || !j(t, d))) && (u ? n && // for camelCase
      (n[b] !== void 0 || // for kebab-case
      n[d] !== void 0) && (r[b] = Vn(
        u,
        l,
        b,
        void 0,
        e,
        !0
      )) : delete r[b]);
    if (i !== l)
      for (const b in i)
        (!t || !j(t, b)) && (delete i[b], h = !0);
  }
  h && Be(e.attrs, "set", "");
}
function Kr(e, t, n, s) {
  const [r, i] = e.propsOptions;
  let o = !1, l;
  if (t)
    for (let u in t) {
      if (Ft(u))
        continue;
      const h = t[u];
      let d;
      r && j(r, d = xe(u)) ? !i || !i.includes(d) ? n[d] = h : (l || (l = {}))[d] = h : xn(e.emitsOptions, u) || (!(u in s) || h !== s[u]) && (s[u] = h, o = !0);
    }
  if (i) {
    const u = /* @__PURE__ */ $(n), h = l || q;
    for (let d = 0; d < i.length; d++) {
      const b = i[d];
      n[b] = Vn(
        r,
        u,
        b,
        h[b],
        e,
        !j(h, b)
      );
    }
  }
  return o;
}
function Vn(e, t, n, s, r, i) {
  const o = e[n];
  if (o != null) {
    const l = j(o, "default");
    if (l && s === void 0) {
      const u = o.default;
      if (o.type !== Function && !o.skipFactory && F(u)) {
        const { propsDefaults: h } = r;
        if (n in h)
          s = h[n];
        else {
          const d = qt(r);
          s = h[n] = u.call(
            null,
            t
          ), d();
        }
      } else
        s = u;
      r.ce && r.ce._setProp(n, s);
    }
    o[
      0
      /* shouldCast */
    ] && (i && !l ? s = !1 : o[
      1
      /* shouldCastTrue */
    ] && (s === "" || s === ot(n)) && (s = !0));
  }
  return s;
}
const Do = /* @__PURE__ */ new WeakMap();
function Vr(e, t, n = !1) {
  const s = n ? Do : t.propsCache, r = s.get(e);
  if (r)
    return r;
  const i = e.props, o = {}, l = [];
  let u = !1;
  if (!F(e)) {
    const d = (b) => {
      u = !0;
      const [T, C] = Vr(b, t, !0);
      ae(o, T), C && l.push(...C);
    };
    !n && t.mixins.length && t.mixins.forEach(d), e.extends && d(e.extends), e.mixins && e.mixins.forEach(d);
  }
  if (!i && !u)
    return K(e) && s.set(e, bt), bt;
  if (R(i))
    for (let d = 0; d < i.length; d++) {
      const b = xe(i[d]);
      Ms(b) && (o[b] = q);
    }
  else if (i)
    for (const d in i) {
      const b = xe(d);
      if (Ms(b)) {
        const T = i[d], C = o[b] = R(T) || F(T) ? { type: T } : ae({}, T), N = C.type;
        let O = !1, D = !0;
        if (R(N))
          for (let z = 0; z < N.length; ++z) {
            const L = N[z], V = F(L) && L.name;
            if (V === "Boolean") {
              O = !0;
              break;
            } else V === "String" && (D = !1);
          }
        else
          O = F(N) && N.name === "Boolean";
        C[
          0
          /* shouldCast */
        ] = O, C[
          1
          /* shouldCastTrue */
        ] = D, (O || j(C, "default")) && l.push(b);
      }
    }
  const h = [o, l];
  return K(e) && s.set(e, h), h;
}
function Ms(e) {
  return e[0] !== "$" && !Ft(e);
}
const us = (e) => e === "_" || e === "_ctx" || e === "$stable", fs = (e) => R(e) ? e.map(De) : [De(e)], Lo = (e, t, n) => {
  if (t._n)
    return t;
  const s = Xi((...r) => fs(t(...r)), n);
  return s._c = !1, s;
}, Gr = (e, t, n) => {
  const s = e._ctx;
  for (const r in e) {
    if (us(r)) continue;
    const i = e[r];
    if (F(i))
      t[r] = Lo(r, i, s);
    else if (i != null) {
      const o = fs(i);
      t[r] = () => o;
    }
  }
}, qr = (e, t) => {
  const n = fs(t);
  e.slots.default = () => n;
}, zr = (e, t, n) => {
  for (const s in t)
    (n || !us(s)) && (e[s] = t[s]);
}, ko = (e, t, n) => {
  const s = e.slots = Wr();
  if (e.vnode.shapeFlag & 32) {
    const r = t._;
    r ? (zr(s, t, n), n && rr(s, "_", r, !0)) : Gr(t, s);
  } else t && qr(e, t);
}, Ho = (e, t, n) => {
  const { vnode: s, slots: r } = e;
  let i = !0, o = q;
  if (s.shapeFlag & 32) {
    const l = t._;
    l ? n && l === 1 ? i = !1 : zr(r, t, n) : (i = !t.$stable, Gr(t, r)), o = t;
  } else t && (qr(e, t), o = { default: 1 });
  if (i)
    for (const l in r)
      !us(l) && o[l] == null && delete r[l];
}, ge = Wo;
function No(e) {
  return Uo(e);
}
function Uo(e, t) {
  const n = mn();
  n.__VUE__ = !0;
  const {
    insert: s,
    remove: r,
    patchProp: i,
    createElement: o,
    createText: l,
    createComment: u,
    setText: h,
    setElementText: d,
    parentNode: b,
    nextSibling: T,
    setScopeId: C = ke,
    insertStaticContent: N
  } = e, O = (a, c, f, p = null, g = null, m = null, x = void 0, w = null, v = !!c.dynamicChildren) => {
    if (a === c)
      return;
    a && !It(a, c) && (p = ft(a), te(a, g, m, !0), a = null), c.patchFlag === -2 && (v = !1, c.dynamicChildren = null);
    const { type: _, ref: I, shapeFlag: S } = c;
    switch (_) {
      case Sn:
        D(a, c, f, p);
        break;
      case Ze:
        z(a, c, f, p);
        break;
      case Fn:
        a == null && L(c, f, p, x);
        break;
      case oe:
        ct(
          a,
          c,
          f,
          p,
          g,
          m,
          x,
          w,
          v
        );
        break;
      default:
        S & 1 ? Q(
          a,
          c,
          f,
          p,
          g,
          m,
          x,
          w,
          v
        ) : S & 6 ? at(
          a,
          c,
          f,
          p,
          g,
          m,
          x,
          w,
          v
        ) : (S & 64 || S & 128) && _.process(
          a,
          c,
          f,
          p,
          g,
          m,
          x,
          w,
          v,
          Je
        );
    }
    I != null && g ? kt(I, a && a.ref, m, c || a, !c) : I == null && a && a.ref != null && kt(a.ref, null, m, a, !0);
  }, D = (a, c, f, p) => {
    if (a == null)
      s(
        c.el = l(c.children),
        f,
        p
      );
    else {
      const g = c.el = a.el;
      c.children !== a.children && h(g, c.children);
    }
  }, z = (a, c, f, p) => {
    a == null ? s(
      c.el = u(c.children || ""),
      f,
      p
    ) : c.el = a.el;
  }, L = (a, c, f, p) => {
    [a.el, a.anchor] = N(
      a.children,
      c,
      f,
      p,
      a.el,
      a.anchor
    );
  }, V = ({ el: a, anchor: c }, f, p) => {
    let g;
    for (; a && a !== c; )
      g = T(a), s(a, f, p), a = g;
    s(c, f, p);
  }, E = ({ el: a, anchor: c }) => {
    let f;
    for (; a && a !== c; )
      f = T(a), r(a), a = f;
    r(c);
  }, Q = (a, c, f, p, g, m, x, w, v) => {
    if (c.type === "svg" ? x = "svg" : c.type === "math" && (x = "mathml"), a == null)
      Ae(
        c,
        f,
        p,
        g,
        m,
        x,
        w,
        v
      );
    else {
      const _ = a.el && a.el._isVueCE ? a.el : null;
      try {
        _ && _._beginPatch(), lt(
          a,
          c,
          g,
          m,
          x,
          w,
          v
        );
      } finally {
        _ && _._endPatch();
      }
    }
  }, Ae = (a, c, f, p, g, m, x, w) => {
    let v, _;
    const { props: I, shapeFlag: S, transition: A, dirs: M } = a;
    if (v = a.el = o(
      a.type,
      m,
      I && I.is,
      I
    ), S & 8 ? d(v, a.children) : S & 16 && Ee(
      a.children,
      v,
      null,
      p,
      g,
      Rn(a, m),
      x,
      w
    ), M && tt(a, null, p, "created"), be(v, a, a.scopeId, x, p), I) {
      for (const G in I)
        G !== "value" && !Ft(G) && i(v, G, null, I[G], m, p);
      "value" in I && i(v, "value", null, I.value, m), (_ = I.onVnodeBeforeMount) && Oe(_, p, a);
    }
    M && tt(a, null, p, "beforeMount");
    const k = $o(g, A);
    k && A.beforeEnter(v), s(v, c, f), ((_ = I && I.onVnodeMounted) || k || M) && ge(() => {
      _ && Oe(_, p, a), k && A.enter(v), M && tt(a, null, p, "mounted");
    }, g);
  }, be = (a, c, f, p, g) => {
    if (f && C(a, f), p)
      for (let m = 0; m < p.length; m++)
        C(a, p[m]);
    if (g) {
      let m = g.subTree;
      if (c === m || Zr(m.type) && (m.ssContent === c || m.ssFallback === c)) {
        const x = g.vnode;
        be(
          a,
          x,
          x.scopeId,
          x.slotScopeIds,
          g.parent
        );
      }
    }
  }, Ee = (a, c, f, p, g, m, x, w, v = 0) => {
    for (let _ = v; _ < a.length; _++) {
      const I = a[_] = w ? We(a[_]) : De(a[_]);
      O(
        null,
        I,
        c,
        f,
        p,
        g,
        m,
        x,
        w
      );
    }
  }, lt = (a, c, f, p, g, m, x) => {
    const w = c.el = a.el;
    let { patchFlag: v, dynamicChildren: _, dirs: I } = c;
    v |= a.patchFlag & 16;
    const S = a.props || q, A = c.props || q;
    let M;
    if (f && nt(f, !1), (M = A.onVnodeBeforeUpdate) && Oe(M, f, c, a), I && tt(c, a, f, "beforeUpdate"), f && nt(f, !0), (S.innerHTML && A.innerHTML == null || S.textContent && A.textContent == null) && d(w, ""), _ ? Ue(
      a.dynamicChildren,
      _,
      w,
      f,
      p,
      Rn(c, g),
      m
    ) : x || B(
      a,
      c,
      w,
      null,
      f,
      p,
      Rn(c, g),
      m,
      !1
    ), v > 0) {
      if (v & 16)
        Qe(w, S, A, f, g);
      else if (v & 2 && S.class !== A.class && i(w, "class", null, A.class, g), v & 4 && i(w, "style", S.style, A.style, g), v & 8) {
        const k = c.dynamicProps;
        for (let G = 0; G < k.length; G++) {
          const Y = k[G], ee = S[Y], re = A[Y];
          (re !== ee || Y === "value") && i(w, Y, ee, re, g, f);
        }
      }
      v & 1 && a.children !== c.children && d(w, c.children);
    } else !x && _ == null && Qe(w, S, A, f, g);
    ((M = A.onVnodeUpdated) || I) && ge(() => {
      M && Oe(M, f, c, a), I && tt(c, a, f, "updated");
    }, p);
  }, Ue = (a, c, f, p, g, m, x) => {
    for (let w = 0; w < c.length; w++) {
      const v = a[w], _ = c[w], I = (
        // oldVNode may be an errored async setup() component inside Suspense
        // which will not have a mounted element
        v.el && // - In the case of a Fragment, we need to provide the actual parent
        // of the Fragment itself so it can move its children.
        (v.type === oe || // - In the case of different nodes, there is going to be a replacement
        // which also requires the correct parent container
        !It(v, _) || // - In the case of a component, it could contain anything.
        v.shapeFlag & 198) ? b(v.el) : (
          // In other cases, the parent container is not actually used so we
          // just pass the block element here to avoid a DOM parentNode call.
          f
        )
      );
      O(
        v,
        _,
        I,
        null,
        p,
        g,
        m,
        x,
        !0
      );
    }
  }, Qe = (a, c, f, p, g) => {
    if (c !== f) {
      if (c !== q)
        for (const m in c)
          !Ft(m) && !(m in f) && i(
            a,
            m,
            c[m],
            null,
            g,
            p
          );
      for (const m in f) {
        if (Ft(m)) continue;
        const x = f[m], w = c[m];
        x !== w && m !== "value" && i(a, m, w, x, g, p);
      }
      "value" in f && i(a, "value", c.value, f.value, g);
    }
  }, ct = (a, c, f, p, g, m, x, w, v) => {
    const _ = c.el = a ? a.el : l(""), I = c.anchor = a ? a.anchor : l("");
    let { patchFlag: S, dynamicChildren: A, slotScopeIds: M } = c;
    M && (w = w ? w.concat(M) : M), a == null ? (s(_, f, p), s(I, f, p), Ee(
      // #10007
      // such fragment like `<></>` will be compiled into
      // a fragment which doesn't have a children.
      // In this case fallback to an empty array
      c.children || [],
      f,
      I,
      g,
      m,
      x,
      w,
      v
    )) : S > 0 && S & 64 && A && // #2715 the previous fragment could've been a BAILed one as a result
    // of renderSlot() with no valid children
    a.dynamicChildren && a.dynamicChildren.length === A.length ? (Ue(
      a.dynamicChildren,
      A,
      f,
      g,
      m,
      x,
      w
    ), // #2080 if the stable fragment has a key, it's a <template v-for> that may
    //  get moved around. Make sure all root level vnodes inherit el.
    // #2134 or if it's a component root, it may also get moved around
    // as the component is being moved.
    (c.key != null || g && c === g.subTree) && Yr(
      a,
      c,
      !0
      /* shallow */
    )) : B(
      a,
      c,
      f,
      I,
      g,
      m,
      x,
      w,
      v
    );
  }, at = (a, c, f, p, g, m, x, w, v) => {
    c.slotScopeIds = w, a == null ? c.shapeFlag & 512 ? g.ctx.activate(
      c,
      f,
      p,
      x,
      v
    ) : xt(
      c,
      f,
      p,
      g,
      m,
      x,
      v
    ) : zt(a, c, v);
  }, xt = (a, c, f, p, g, m, x) => {
    const w = a.component = Xo(
      a,
      p,
      g
    );
    if (Or(a) && (w.ctx.renderer = Je), Qo(w, !1, x), w.asyncDep) {
      if (g && g.registerDep(w, se, x), !a.el) {
        const v = w.subTree = Ve(Ze);
        z(null, v, c, f), a.placeholder = v.el;
      }
    } else
      se(
        w,
        a,
        c,
        f,
        g,
        m,
        x
      );
  }, zt = (a, c, f) => {
    const p = c.component = a.component;
    if (Mo(a, c, f))
      if (p.asyncDep && !p.asyncResolved) {
        X(p, c, f);
        return;
      } else
        p.next = c, p.update();
    else
      c.el = a.el, p.vnode = c;
  }, se = (a, c, f, p, g, m, x) => {
    const w = () => {
      if (a.isMounted) {
        let { next: S, bu: A, u: M, parent: k, vnode: G } = a;
        {
          const Ie = Jr(a);
          if (Ie) {
            S && (S.el = G.el, X(a, S, x)), Ie.asyncDep.then(() => {
              ge(() => {
                a.isUnmounted || _();
              }, g);
            });
            return;
          }
        }
        let Y = S, ee;
        nt(a, !1), S ? (S.el = G.el, X(a, S, x)) : S = G, A && tn(A), (ee = S.props && S.props.onVnodeBeforeUpdate) && Oe(ee, k, S, G), nt(a, !0);
        const re = Ps(a), Pe = a.subTree;
        a.subTree = re, O(
          Pe,
          re,
          // parent may have changed if it's in a teleport
          b(Pe.el),
          // anchor may have changed if it's in a fragment
          ft(Pe),
          a,
          g,
          m
        ), S.el = re.el, Y === null && Oo(a, re.el), M && ge(M, g), (ee = S.props && S.props.onVnodeUpdated) && ge(
          () => Oe(ee, k, S, G),
          g
        );
      } else {
        let S;
        const { el: A, props: M } = c, { bm: k, m: G, parent: Y, root: ee, type: re } = a, Pe = Ht(c);
        nt(a, !1), k && tn(k), !Pe && (S = M && M.onVnodeBeforeMount) && Oe(S, Y, c), nt(a, !0);
        {
          ee.ce && ee.ce._hasShadowRoot() && ee.ce._injectChildStyle(
            re,
            a.parent ? a.parent.type : void 0
          );
          const Ie = a.subTree = Ps(a);
          O(
            null,
            Ie,
            f,
            p,
            a,
            g,
            m
          ), c.el = Ie.el;
        }
        if (G && ge(G, g), !Pe && (S = M && M.onVnodeMounted)) {
          const Ie = c;
          ge(
            () => Oe(S, Y, Ie),
            g
          );
        }
        (c.shapeFlag & 256 || Y && Ht(Y.vnode) && Y.vnode.shapeFlag & 256) && a.a && ge(a.a, g), a.isMounted = !0, c = f = p = null;
      }
    };
    a.scope.on();
    const v = a.effect = new cr(w);
    a.scope.off();
    const _ = a.update = v.run.bind(v), I = a.job = v.runIfDirty.bind(v);
    I.i = a, I.id = a.uid, v.scheduler = () => cs(I), nt(a, !0), _();
  }, X = (a, c, f) => {
    c.component = a;
    const p = a.vnode.props;
    a.vnode = c, a.next = null, Fo(a, c.props, p, f), Ho(a, c.children, f), Ge(), ws(a), qe();
  }, B = (a, c, f, p, g, m, x, w, v = !1) => {
    const _ = a && a.children, I = a ? a.shapeFlag : 0, S = c.children, { patchFlag: A, shapeFlag: M } = c;
    if (A > 0) {
      if (A & 128) {
        ut(
          _,
          S,
          f,
          p,
          g,
          m,
          x,
          w,
          v
        );
        return;
      } else if (A & 256) {
        P(
          _,
          S,
          f,
          p,
          g,
          m,
          x,
          w,
          v
        );
        return;
      }
    }
    M & 8 ? (I & 16 && et(_, g, m), S !== _ && d(f, S)) : I & 16 ? M & 16 ? ut(
      _,
      S,
      f,
      p,
      g,
      m,
      x,
      w,
      v
    ) : et(_, g, m, !0) : (I & 8 && d(f, ""), M & 16 && Ee(
      S,
      f,
      p,
      g,
      m,
      x,
      w,
      v
    ));
  }, P = (a, c, f, p, g, m, x, w, v) => {
    a = a || bt, c = c || bt;
    const _ = a.length, I = c.length, S = Math.min(_, I);
    let A;
    for (A = 0; A < S; A++) {
      const M = c[A] = v ? We(c[A]) : De(c[A]);
      O(
        a[A],
        M,
        f,
        null,
        g,
        m,
        x,
        w,
        v
      );
    }
    _ > I ? et(
      a,
      g,
      m,
      !0,
      !1,
      S
    ) : Ee(
      c,
      f,
      p,
      g,
      m,
      x,
      w,
      v,
      S
    );
  }, ut = (a, c, f, p, g, m, x, w, v) => {
    let _ = 0;
    const I = c.length;
    let S = a.length - 1, A = I - 1;
    for (; _ <= S && _ <= A; ) {
      const M = a[_], k = c[_] = v ? We(c[_]) : De(c[_]);
      if (It(M, k))
        O(
          M,
          k,
          f,
          null,
          g,
          m,
          x,
          w,
          v
        );
      else
        break;
      _++;
    }
    for (; _ <= S && _ <= A; ) {
      const M = a[S], k = c[A] = v ? We(c[A]) : De(c[A]);
      if (It(M, k))
        O(
          M,
          k,
          f,
          null,
          g,
          m,
          x,
          w,
          v
        );
      else
        break;
      S--, A--;
    }
    if (_ > S) {
      if (_ <= A) {
        const M = A + 1, k = M < I ? c[M].el : p;
        for (; _ <= A; )
          O(
            null,
            c[_] = v ? We(c[_]) : De(c[_]),
            f,
            k,
            g,
            m,
            x,
            w,
            v
          ), _++;
      }
    } else if (_ > A)
      for (; _ <= S; )
        te(a[_], g, m, !0), _++;
    else {
      const M = _, k = _, G = /* @__PURE__ */ new Map();
      for (_ = k; _ <= A; _++) {
        const me = c[_] = v ? We(c[_]) : De(c[_]);
        me.key != null && G.set(me.key, _);
      }
      let Y, ee = 0;
      const re = A - k + 1;
      let Pe = !1, Ie = 0;
      const At = new Array(re);
      for (_ = 0; _ < re; _++) At[_] = 0;
      for (_ = M; _ <= S; _++) {
        const me = a[_];
        if (ee >= re) {
          te(me, g, m, !0);
          continue;
        }
        let Me;
        if (me.key != null)
          Me = G.get(me.key);
        else
          for (Y = k; Y <= A; Y++)
            if (At[Y - k] === 0 && It(me, c[Y])) {
              Me = Y;
              break;
            }
        Me === void 0 ? te(me, g, m, !0) : (At[Me - k] = _ + 1, Me >= Ie ? Ie = Me : Pe = !0, O(
          me,
          c[Me],
          f,
          null,
          g,
          m,
          x,
          w,
          v
        ), ee++);
      }
      const hs = Pe ? jo(At) : bt;
      for (Y = hs.length - 1, _ = re - 1; _ >= 0; _--) {
        const me = k + _, Me = c[me], gs = c[me + 1], bs = me + 1 < I ? (
          // #13559, #14173 fallback to el placeholder for unresolved async component
          gs.el || Xr(gs)
        ) : p;
        At[_] === 0 ? O(
          null,
          Me,
          f,
          bs,
          g,
          m,
          x,
          w,
          v
        ) : Pe && (Y < 0 || _ !== hs[Y] ? he(Me, f, bs, 2) : Y--);
      }
    }
  }, he = (a, c, f, p, g = null) => {
    const { el: m, type: x, transition: w, children: v, shapeFlag: _ } = a;
    if (_ & 6) {
      he(a.component.subTree, c, f, p);
      return;
    }
    if (_ & 128) {
      a.suspense.move(c, f, p);
      return;
    }
    if (_ & 64) {
      x.move(a, c, f, Je);
      return;
    }
    if (x === oe) {
      s(m, c, f);
      for (let S = 0; S < v.length; S++)
        he(v[S], c, f, p);
      s(a.anchor, c, f);
      return;
    }
    if (x === Fn) {
      V(a, c, f);
      return;
    }
    if (p !== 2 && _ & 1 && w)
      if (p === 0)
        w.beforeEnter(m), s(m, c, f), ge(() => w.enter(m), g);
      else {
        const { leave: S, delayLeave: A, afterLeave: M } = w, k = () => {
          a.ctx.isUnmounted ? r(m) : s(m, c, f);
        }, G = () => {
          m._isLeaving && m[ro](
            !0
            /* cancelled */
          ), S(m, () => {
            k(), M && M();
          });
        };
        A ? A(m, k, G) : G();
      }
    else
      s(m, c, f);
  }, te = (a, c, f, p = !1, g = !1) => {
    const {
      type: m,
      props: x,
      ref: w,
      children: v,
      dynamicChildren: _,
      shapeFlag: I,
      patchFlag: S,
      dirs: A,
      cacheIndex: M,
      memo: k
    } = a;
    if (S === -2 && (g = !1), w != null && (Ge(), kt(w, null, f, a, !0), qe()), M != null && (c.renderCache[M] = void 0), I & 256) {
      c.ctx.deactivate(a);
      return;
    }
    const G = I & 1 && A, Y = !Ht(a);
    let ee;
    if (Y && (ee = x && x.onVnodeBeforeUnmount) && Oe(ee, c, a), I & 6)
      Cn(a.component, f, p);
    else {
      if (I & 128) {
        a.suspense.unmount(f, p);
        return;
      }
      G && tt(a, null, c, "beforeUnmount"), I & 64 ? a.type.remove(
        a,
        c,
        f,
        Je,
        p
      ) : _ && // #5154
      // when v-once is used inside a block, setBlockTracking(-1) marks the
      // parent block with hasOnce: true
      // so that it doesn't take the fast path during unmount - otherwise
      // components nested in v-once are never unmounted.
      !_.hasOnce && // #1153: fast path should not be taken for non-stable (v-for) fragments
      (m !== oe || S > 0 && S & 64) ? et(
        _,
        c,
        f,
        !1,
        !0
      ) : (m === oe && S & 384 || !g && I & 16) && et(v, c, f), p && St(a);
    }
    const re = k != null && M == null;
    (Y && (ee = x && x.onVnodeUnmounted) || G || re) && ge(() => {
      ee && Oe(ee, c, a), G && tt(a, null, c, "unmounted"), re && (a.el = null);
    }, f);
  }, St = (a) => {
    const { type: c, el: f, anchor: p, transition: g } = a;
    if (c === oe) {
      Tt(f, p);
      return;
    }
    if (c === Fn) {
      E(a);
      return;
    }
    const m = () => {
      r(f), g && !g.persisted && g.afterLeave && g.afterLeave();
    };
    if (a.shapeFlag & 1 && g && !g.persisted) {
      const { leave: x, delayLeave: w } = g, v = () => x(f, m);
      w ? w(a.el, m, v) : v();
    } else
      m();
  }, Tt = (a, c) => {
    let f;
    for (; a !== c; )
      f = T(a), r(a), a = f;
    r(c);
  }, Cn = (a, c, f) => {
    const { bum: p, scope: g, job: m, subTree: x, um: w, m: v, a: _ } = a;
    Os(v), Os(_), p && tn(p), g.stop(), m && (m.flags |= 8, te(x, a, c, f)), w && ge(w, c), ge(() => {
      a.isUnmounted = !0;
    }, c);
  }, et = (a, c, f, p = !1, g = !1, m = 0) => {
    for (let x = m; x < a.length; x++)
      te(a[x], c, f, p, g);
  }, ft = (a) => {
    if (a.shapeFlag & 6)
      return ft(a.component.subTree);
    if (a.shapeFlag & 128)
      return a.suspense.next();
    const c = T(a.anchor || a.el), f = c && c[no];
    return f ? T(f) : c;
  };
  let Ct = !1;
  const Yt = (a, c, f) => {
    let p;
    a == null ? c._vnode && (te(c._vnode, null, null, !0), p = c._vnode.component) : O(
      c._vnode || null,
      a,
      c,
      null,
      null,
      null,
      f
    ), c._vnode = a, Ct || (Ct = !0, ws(p), Cr(), Ct = !1);
  }, Je = {
    p: O,
    um: te,
    m: he,
    r: St,
    mt: xt,
    mc: Ee,
    pc: B,
    pbc: Ue,
    n: ft,
    o: e
  };
  return {
    render: Yt,
    hydrate: void 0,
    createApp: To(Yt)
  };
}
function Rn({ type: e, props: t }, n) {
  return n === "svg" && e === "foreignObject" || n === "mathml" && e === "annotation-xml" && t && t.encoding && t.encoding.includes("html") ? void 0 : n;
}
function nt({ effect: e, job: t }, n) {
  n ? (e.flags |= 32, t.flags |= 4) : (e.flags &= -33, t.flags &= -5);
}
function $o(e, t) {
  return (!e || e && !e.pendingBranch) && t && !t.persisted;
}
function Yr(e, t, n = !1) {
  const s = e.children, r = t.children;
  if (R(s) && R(r))
    for (let i = 0; i < s.length; i++) {
      const o = s[i];
      let l = r[i];
      l.shapeFlag & 1 && !l.dynamicChildren && ((l.patchFlag <= 0 || l.patchFlag === 32) && (l = r[i] = We(r[i]), l.el = o.el), !n && l.patchFlag !== -2 && Yr(o, l)), l.type === Sn && (l.patchFlag === -1 && (l = r[i] = We(l)), l.el = o.el), l.type === Ze && !l.el && (l.el = o.el);
    }
}
function jo(e) {
  const t = e.slice(), n = [0];
  let s, r, i, o, l;
  const u = e.length;
  for (s = 0; s < u; s++) {
    const h = e[s];
    if (h !== 0) {
      if (r = n[n.length - 1], e[r] < h) {
        t[s] = r, n.push(s);
        continue;
      }
      for (i = 0, o = n.length - 1; i < o; )
        l = i + o >> 1, e[n[l]] < h ? i = l + 1 : o = l;
      h < e[n[i]] && (i > 0 && (t[s] = n[i - 1]), n[i] = s);
    }
  }
  for (i = n.length, o = n[i - 1]; i-- > 0; )
    n[i] = o, o = t[o];
  return n;
}
function Jr(e) {
  const t = e.subTree.component;
  if (t)
    return t.asyncDep && !t.asyncResolved ? t : Jr(t);
}
function Os(e) {
  if (e)
    for (let t = 0; t < e.length; t++)
      e[t].flags |= 8;
}
function Xr(e) {
  if (e.placeholder)
    return e.placeholder;
  const t = e.component;
  return t ? Xr(t.subTree) : null;
}
const Zr = (e) => e.__isSuspense;
function Wo(e, t) {
  t && t.pendingBranch ? R(e) ? t.effects.push(...e) : t.effects.push(e) : Ji(e);
}
const oe = /* @__PURE__ */ Symbol.for("v-fgt"), Sn = /* @__PURE__ */ Symbol.for("v-txt"), Ze = /* @__PURE__ */ Symbol.for("v-cmt"), Fn = /* @__PURE__ */ Symbol.for("v-stc"), Ut = [];
let _e = null;
function U(e = !1) {
  Ut.push(_e = e ? null : []);
}
function Bo() {
  Ut.pop(), _e = Ut[Ut.length - 1] || null;
}
let Bt = 1;
function Rs(e, t = !1) {
  Bt += e, e < 0 && _e && t && (_e.hasOnce = !0);
}
function Qr(e) {
  return e.dynamicChildren = Bt > 0 ? _e || bt : null, Bo(), Bt > 0 && _e && _e.push(e), e;
}
function W(e, t, n, s, r, i) {
  return Qr(
    y(
      e,
      t,
      n,
      s,
      r,
      i,
      !0
    )
  );
}
function Ko(e, t, n, s, r) {
  return Qr(
    Ve(
      e,
      t,
      n,
      s,
      r,
      !0
    )
  );
}
function ei(e) {
  return e ? e.__v_isVNode === !0 : !1;
}
function It(e, t) {
  return e.type === t.type && e.key === t.key;
}
const ti = ({ key: e }) => e ?? null, on = ({
  ref: e,
  ref_key: t,
  ref_for: n
}) => (typeof e == "number" && (e = "" + e), e != null ? Z(e) || /* @__PURE__ */ ce(e) || F(e) ? { i: ye, r: e, k: t, f: !!n } : e : null);
function y(e, t = null, n = null, s = 0, r = null, i = e === oe ? 0 : 1, o = !1, l = !1) {
  const u = {
    __v_isVNode: !0,
    __v_skip: !0,
    type: e,
    props: t,
    key: t && ti(t),
    ref: t && on(t),
    scopeId: Er,
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
    patchFlag: s,
    dynamicProps: r,
    dynamicChildren: null,
    appContext: null,
    ctx: ye
  };
  return l ? (ds(u, n), i & 128 && e.normalize(u)) : n && (u.shapeFlag |= Z(n) ? 8 : 16), Bt > 0 && // avoid a block node from tracking itself
  !o && // has current parent block
  _e && // presence of a patch flag indicates this node needs patching on updates.
  // component nodes also should always be patched, because even if the
  // component doesn't need to update, it needs to persist the instance on to
  // the next vnode so that it can be properly unmounted later.
  (u.patchFlag > 0 || i & 6) && // the EVENTS flag is only for hydration and if it is the only flag, the
  // vnode should not be considered dynamic due to handler caching.
  u.patchFlag !== 32 && _e.push(u), u;
}
const Ve = Vo;
function Vo(e, t = null, n = null, s = 0, r = null, i = !1) {
  if ((!e || e === bo) && (e = Ze), ei(e)) {
    const l = wt(
      e,
      t,
      !0
      /* mergeRef: true */
    );
    return n && ds(l, n), Bt > 0 && !i && _e && (l.shapeFlag & 6 ? _e[_e.indexOf(e)] = l : _e.push(l)), l.patchFlag = -2, l;
  }
  if (sl(e) && (e = e.__vccOpts), t) {
    t = Go(t);
    let { class: l, style: u } = t;
    l && !Z(l) && (t.class = we(l)), K(u) && (/* @__PURE__ */ ls(u) && !R(u) && (u = ae({}, u)), t.style = _n(u));
  }
  const o = Z(e) ? 1 : Zr(e) ? 128 : so(e) ? 64 : K(e) ? 4 : F(e) ? 2 : 0;
  return y(
    e,
    t,
    n,
    s,
    r,
    o,
    i,
    !0
  );
}
function Go(e) {
  return e ? /* @__PURE__ */ ls(e) || Br(e) ? ae({}, e) : e : null;
}
function wt(e, t, n = !1, s = !1) {
  const { props: r, ref: i, patchFlag: o, children: l, transition: u } = e, h = t ? zo(r || {}, t) : r, d = {
    __v_isVNode: !0,
    __v_skip: !0,
    type: e.type,
    props: h,
    key: h && ti(h),
    ref: t && t.ref ? (
      // #2078 in the case of <component :is="vnode" ref="extra"/>
      // if the vnode itself already has a ref, cloneVNode will need to merge
      // the refs so the single vnode can be set on multiple refs
      n && i ? R(i) ? i.concat(on(t)) : [i, on(t)] : on(t)
    ) : i,
    scopeId: e.scopeId,
    slotScopeIds: e.slotScopeIds,
    children: l,
    target: e.target,
    targetStart: e.targetStart,
    targetAnchor: e.targetAnchor,
    staticCount: e.staticCount,
    shapeFlag: e.shapeFlag,
    // if the vnode is cloned with extra props, we can no longer assume its
    // existing patch flag to be reliable and need to add the FULL_PROPS flag.
    // note: preserve flag for fragments since they use the flag for children
    // fast paths only.
    patchFlag: t && e.type !== oe ? o === -1 ? 16 : o | 16 : o,
    dynamicProps: e.dynamicProps,
    dynamicChildren: e.dynamicChildren,
    appContext: e.appContext,
    dirs: e.dirs,
    transition: u,
    // These should technically only be non-null on mounted VNodes. However,
    // they *should* be copied for kept-alive vnodes. So we just always copy
    // them since them being non-null during a mount doesn't affect the logic as
    // they will simply be overwritten.
    component: e.component,
    suspense: e.suspense,
    ssContent: e.ssContent && wt(e.ssContent),
    ssFallback: e.ssFallback && wt(e.ssFallback),
    placeholder: e.placeholder,
    el: e.el,
    anchor: e.anchor,
    ctx: e.ctx,
    ce: e.ce
  };
  return u && s && as(
    d,
    u.clone(d)
  ), d;
}
function qo(e = " ", t = 0) {
  return Ve(Sn, null, e, t);
}
function en(e = "", t = !1) {
  return t ? (U(), Ko(Ze, null, e)) : Ve(Ze, null, e);
}
function De(e) {
  return e == null || typeof e == "boolean" ? Ve(Ze) : R(e) ? Ve(
    oe,
    null,
    // #3666, avoid reference pollution when reusing vnode
    e.slice()
  ) : ei(e) ? We(e) : Ve(Sn, null, String(e));
}
function We(e) {
  return e.el === null && e.patchFlag !== -1 || e.memo ? e : wt(e);
}
function ds(e, t) {
  let n = 0;
  const { shapeFlag: s } = e;
  if (t == null)
    t = null;
  else if (R(t))
    n = 16;
  else if (typeof t == "object")
    if (s & 65) {
      const r = t.default;
      r && (r._c && (r._d = !1), ds(e, r()), r._c && (r._d = !0));
      return;
    } else {
      n = 32;
      const r = t._;
      !r && !Br(t) ? t._ctx = ye : r === 3 && ye && (ye.slots._ === 1 ? t._ = 1 : (t._ = 2, e.patchFlag |= 1024));
    }
  else F(t) ? (t = { default: t, _ctx: ye }, n = 32) : (t = String(t), s & 64 ? (n = 16, t = [qo(t)]) : n = 8);
  e.children = t, e.shapeFlag |= n;
}
function zo(...e) {
  const t = {};
  for (let n = 0; n < e.length; n++) {
    const s = e[n];
    for (const r in s)
      if (r === "class")
        t.class !== s.class && (t.class = we([t.class, s.class]));
      else if (r === "style")
        t.style = _n([t.style, s.style]);
      else if (hn(r)) {
        const i = t[r], o = s[r];
        o && i !== o && !(R(i) && i.includes(o)) ? t[r] = i ? [].concat(i, o) : o : o == null && i == null && // mergeProps({ 'onUpdate:modelValue': undefined }) should not retain
        // the model listener.
        !gn(r) && (t[r] = o);
      } else r !== "" && (t[r] = s[r]);
  }
  return t;
}
function Oe(e, t, n, s = null) {
  Ne(e, t, 7, [
    n,
    s
  ]);
}
const Yo = Nr();
let Jo = 0;
function Xo(e, t, n) {
  const s = e.type, r = (t ? t.appContext : e.appContext) || Yo, i = {
    uid: Jo++,
    vnode: e,
    type: s,
    parent: t,
    appContext: r,
    root: null,
    // to be immediately set
    next: null,
    subTree: null,
    // will be set synchronously right after creation
    effect: null,
    update: null,
    // will be set synchronously right after creation
    job: null,
    scope: new _i(
      !0
      /* detached */
    ),
    render: null,
    proxy: null,
    exposed: null,
    exposeProxy: null,
    withProxy: null,
    provides: t ? t.provides : Object.create(r.provides),
    ids: t ? t.ids : ["", 0, 0],
    accessCache: null,
    renderCache: [],
    // local resolved assets
    components: null,
    directives: null,
    // resolved props and emits options
    propsOptions: Vr(s, r),
    emitsOptions: Ur(s, r),
    // emit
    emit: null,
    // to be set immediately
    emitted: null,
    // props default value
    propsDefaults: q,
    // inheritAttrs
    inheritAttrs: s.inheritAttrs,
    // state
    ctx: q,
    data: q,
    props: q,
    attrs: q,
    slots: q,
    refs: q,
    setupState: q,
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
  return i.ctx = { _: i }, i.root = t ? t.root : i, i.emit = Ao.bind(null, i), e.ce && e.ce(i), i;
}
let pe = null;
const Zo = () => pe || ye;
let dn, Gn;
{
  const e = mn(), t = (n, s) => {
    let r;
    return (r = e[n]) || (r = e[n] = []), r.push(s), (i) => {
      r.length > 1 ? r.forEach((o) => o(i)) : r[0](i);
    };
  };
  dn = t(
    "__VUE_INSTANCE_SETTERS__",
    (n) => pe = n
  ), Gn = t(
    "__VUE_SSR_SETTERS__",
    (n) => Kt = n
  );
}
const qt = (e) => {
  const t = pe;
  return dn(e), e.scope.on(), () => {
    e.scope.off(), dn(t);
  };
}, Fs = () => {
  pe && pe.scope.off(), dn(null);
};
function ni(e) {
  return e.vnode.shapeFlag & 4;
}
let Kt = !1;
function Qo(e, t = !1, n = !1) {
  t && Gn(t);
  const { props: s, children: r } = e.vnode, i = ni(e);
  Ro(e, s, i, t), ko(e, r, n || t);
  const o = i ? el(e, t) : void 0;
  return t && Gn(!1), o;
}
function el(e, t) {
  const n = e.type;
  e.accessCache = /* @__PURE__ */ Object.create(null), e.proxy = new Proxy(e.ctx, mo);
  const { setup: s } = n;
  if (s) {
    Ge();
    const r = e.setupContext = s.length > 1 ? nl(e) : null, i = qt(e), o = Gt(
      s,
      e,
      0,
      [
        e.props,
        r
      ]
    ), l = er(o);
    if (qe(), i(), (l || e.sp) && !Ht(e) && Mr(e), l) {
      if (o.then(Fs, Fs), t)
        return o.then((u) => {
          Ds(e, u);
        }).catch((u) => {
          vn(u, e, 0);
        });
      e.asyncDep = o;
    } else
      Ds(e, o);
  } else
    si(e);
}
function Ds(e, t, n) {
  F(t) ? e.type.__ssrInlineRender ? e.ssrRender = t : e.render = t : K(t) && (e.setupState = xr(t)), si(e);
}
function si(e, t, n) {
  const s = e.type;
  e.render || (e.render = s.render || ke);
  {
    const r = qt(e);
    Ge();
    try {
      _o(e);
    } finally {
      qe(), r();
    }
  }
}
const tl = {
  get(e, t) {
    return le(e, "get", ""), e[t];
  }
};
function nl(e) {
  const t = (n) => {
    e.exposed = n || {};
  };
  return {
    attrs: new Proxy(e.attrs, tl),
    slots: e.slots,
    emit: e.emit,
    expose: t
  };
}
function Tn(e) {
  return e.exposed ? e.exposeProxy || (e.exposeProxy = new Proxy(xr(Ui(e.exposed)), {
    get(t, n) {
      if (n in t)
        return t[n];
      if (n in Nt)
        return Nt[n](e);
    },
    has(t, n) {
      return n in t || n in Nt;
    }
  })) : e.proxy;
}
function sl(e) {
  return F(e) && "__vccOpts" in e;
}
const fe = (e, t) => /* @__PURE__ */ Vi(e, t, Kt), rl = "3.5.34";
let qn;
const Ls = typeof window < "u" && window.trustedTypes;
if (Ls)
  try {
    qn = /* @__PURE__ */ Ls.createPolicy("vue", {
      createHTML: (e) => e
    });
  } catch {
  }
const ri = qn ? (e) => qn.createHTML(e) : (e) => e, il = "http://www.w3.org/2000/svg", ol = "http://www.w3.org/1998/Math/MathML", je = typeof document < "u" ? document : null, ks = je && /* @__PURE__ */ je.createElement("template"), ll = {
  insert: (e, t, n) => {
    t.insertBefore(e, n || null);
  },
  remove: (e) => {
    const t = e.parentNode;
    t && t.removeChild(e);
  },
  createElement: (e, t, n, s) => {
    const r = t === "svg" ? je.createElementNS(il, e) : t === "mathml" ? je.createElementNS(ol, e) : n ? je.createElement(e, { is: n }) : je.createElement(e);
    return e === "select" && s && s.multiple != null && r.setAttribute("multiple", s.multiple), r;
  },
  createText: (e) => je.createTextNode(e),
  createComment: (e) => je.createComment(e),
  setText: (e, t) => {
    e.nodeValue = t;
  },
  setElementText: (e, t) => {
    e.textContent = t;
  },
  parentNode: (e) => e.parentNode,
  nextSibling: (e) => e.nextSibling,
  querySelector: (e) => je.querySelector(e),
  setScopeId(e, t) {
    e.setAttribute(t, "");
  },
  // __UNSAFE__
  // Reason: innerHTML.
  // Static content here can only come from compiled templates.
  // As long as the user only uses trusted templates, this is safe.
  insertStaticContent(e, t, n, s, r, i) {
    const o = n ? n.previousSibling : t.lastChild;
    if (r && (r === i || r.nextSibling))
      for (; t.insertBefore(r.cloneNode(!0), n), !(r === i || !(r = r.nextSibling)); )
        ;
    else {
      ks.innerHTML = ri(
        s === "svg" ? `<svg>${e}</svg>` : s === "mathml" ? `<math>${e}</math>` : e
      );
      const l = ks.content;
      if (s === "svg" || s === "mathml") {
        const u = l.firstChild;
        for (; u.firstChild; )
          l.appendChild(u.firstChild);
        l.removeChild(u);
      }
      t.insertBefore(l, n);
    }
    return [
      // first
      o ? o.nextSibling : t.firstChild,
      // last
      n ? n.previousSibling : t.lastChild
    ];
  }
}, cl = /* @__PURE__ */ Symbol("_vtc");
function al(e, t, n) {
  const s = e[cl];
  s && (t = (t ? [t, ...s] : [...s]).join(" ")), t == null ? e.removeAttribute("class") : n ? e.setAttribute("class", t) : e.className = t;
}
const pn = /* @__PURE__ */ Symbol("_vod"), ii = /* @__PURE__ */ Symbol("_vsh"), Hs = {
  // used for prop mismatch check during hydration
  name: "show",
  beforeMount(e, { value: t }, { transition: n }) {
    e[pn] = e.style.display === "none" ? "" : e.style.display, n && t ? n.beforeEnter(e) : Mt(e, t);
  },
  mounted(e, { value: t }, { transition: n }) {
    n && t && n.enter(e);
  },
  updated(e, { value: t, oldValue: n }, { transition: s }) {
    !t != !n && (s ? t ? (s.beforeEnter(e), Mt(e, !0), s.enter(e)) : s.leave(e, () => {
      Mt(e, !1);
    }) : Mt(e, t));
  },
  beforeUnmount(e, { value: t }) {
    Mt(e, t);
  }
};
function Mt(e, t) {
  e.style.display = t ? e[pn] : "none", e[ii] = !t;
}
const ul = /* @__PURE__ */ Symbol(""), fl = /(?:^|;)\s*display\s*:/;
function dl(e, t, n) {
  const s = e.style, r = Z(n);
  let i = !1;
  if (n && !r) {
    if (t)
      if (Z(t))
        for (const o of t.split(";")) {
          const l = o.slice(0, o.indexOf(":")).trim();
          n[l] == null && Rt(s, l, "");
        }
      else
        for (const o in t)
          n[o] == null && Rt(s, o, "");
    for (const o in n) {
      o === "display" && (i = !0);
      const l = n[o];
      l != null ? hl(
        e,
        o,
        !Z(t) && t ? t[o] : void 0,
        l
      ) || Rt(s, o, l) : Rt(s, o, "");
    }
  } else if (r) {
    if (t !== n) {
      const o = s[ul];
      o && (n += ";" + o), s.cssText = n, i = fl.test(n);
    }
  } else t && e.removeAttribute("style");
  pn in e && (e[pn] = i ? s.display : "", e[ii] && (s.display = "none"));
}
const Ns = /\s*!important$/;
function Rt(e, t, n) {
  if (R(n))
    n.forEach((s) => Rt(e, t, s));
  else if (n == null && (n = ""), t.startsWith("--"))
    e.setProperty(t, n);
  else {
    const s = pl(e, t);
    Ns.test(n) ? e.setProperty(
      ot(s),
      n.replace(Ns, ""),
      "important"
    ) : e[s] = n;
  }
}
const Us = ["Webkit", "Moz", "ms"], Dn = {};
function pl(e, t) {
  const n = Dn[t];
  if (n)
    return n;
  let s = xe(t);
  if (s !== "filter" && s in e)
    return Dn[t] = s;
  s = sr(s);
  for (let r = 0; r < Us.length; r++) {
    const i = Us[r] + s;
    if (i in e)
      return Dn[t] = i;
  }
  return t;
}
function hl(e, t, n, s) {
  return e.tagName === "TEXTAREA" && (t === "width" || t === "height") && Z(s) && n === s;
}
const $s = "http://www.w3.org/1999/xlink";
function js(e, t, n, s, r, i = bi(t)) {
  s && t.startsWith("xlink:") ? n == null ? e.removeAttributeNS($s, t.slice(6, t.length)) : e.setAttributeNS($s, t, n) : n == null || i && !ir(n) ? e.removeAttribute(t) : e.setAttribute(
    t,
    i ? "" : He(n) ? String(n) : n
  );
}
function Ws(e, t, n, s, r) {
  if (t === "innerHTML" || t === "textContent") {
    n != null && (e[t] = t === "innerHTML" ? ri(n) : n);
    return;
  }
  const i = e.tagName;
  if (t === "value" && i !== "PROGRESS" && // custom elements may use _value internally
  !i.includes("-")) {
    const l = i === "OPTION" ? e.getAttribute("value") || "" : e.value, u = n == null ? (
      // #11647: value should be set as empty string for null and undefined,
      // but <input type="checkbox"> should be set as 'on'.
      e.type === "checkbox" ? "on" : ""
    ) : String(n);
    (l !== u || !("_value" in e)) && (e.value = u), n == null && e.removeAttribute(t), e._value = n;
    return;
  }
  let o = !1;
  if (n === "" || n == null) {
    const l = typeof e[t];
    l === "boolean" ? n = ir(n) : n == null && l === "string" ? (n = "", o = !0) : l === "number" && (n = 0, o = !0);
  }
  try {
    e[t] = n;
  } catch {
  }
  o && e.removeAttribute(r || t);
}
function gt(e, t, n, s) {
  e.addEventListener(t, n, s);
}
function gl(e, t, n, s) {
  e.removeEventListener(t, n, s);
}
const Bs = /* @__PURE__ */ Symbol("_vei");
function bl(e, t, n, s, r = null) {
  const i = e[Bs] || (e[Bs] = {}), o = i[t];
  if (s && o)
    o.value = s;
  else {
    const [l, u] = ml(t);
    if (s) {
      const h = i[t] = vl(
        s,
        r
      );
      gt(e, l, h, u);
    } else o && (gl(e, l, o, u), i[t] = void 0);
  }
}
const Ks = /(?:Once|Passive|Capture)$/;
function ml(e) {
  let t;
  if (Ks.test(e)) {
    t = {};
    let s;
    for (; s = e.match(Ks); )
      e = e.slice(0, e.length - s[0].length), t[s[0].toLowerCase()] = !0;
  }
  return [e[2] === ":" ? e.slice(3) : ot(e.slice(2)), t];
}
let Ln = 0;
const _l = /* @__PURE__ */ Promise.resolve(), yl = () => Ln || (_l.then(() => Ln = 0), Ln = Date.now());
function vl(e, t) {
  const n = (s) => {
    if (!s._vts)
      s._vts = Date.now();
    else if (s._vts <= n.attached)
      return;
    Ne(
      wl(s, n.value),
      t,
      5,
      [s]
    );
  };
  return n.value = e, n.attached = yl(), n;
}
function wl(e, t) {
  if (R(t)) {
    const n = e.stopImmediatePropagation;
    return e.stopImmediatePropagation = () => {
      n.call(e), e._stopped = !0;
    }, t.map(
      (s) => (r) => !r._stopped && s && s(r)
    );
  } else
    return t;
}
const Vs = (e) => e.charCodeAt(0) === 111 && e.charCodeAt(1) === 110 && // lowercase letter
e.charCodeAt(2) > 96 && e.charCodeAt(2) < 123, xl = (e, t, n, s, r, i) => {
  const o = r === "svg";
  t === "class" ? al(e, s, o) : t === "style" ? dl(e, n, s) : hn(t) ? gn(t) || bl(e, t, n, s, i) : (t[0] === "." ? (t = t.slice(1), !0) : t[0] === "^" ? (t = t.slice(1), !1) : Sl(e, t, s, o)) ? (Ws(e, t, s), !e.tagName.includes("-") && (t === "value" || t === "checked" || t === "selected") && js(e, t, s, o, i, t !== "value")) : /* #11081 force set props for possible async custom element */ e._isVueCE && // #12408 check if it's declared prop or it's async custom element
  (Tl(e, t) || // @ts-expect-error _def is private
  e._def.__asyncLoader && (/[A-Z]/.test(t) || !Z(s))) ? Ws(e, xe(t), s, i, t) : (t === "true-value" ? e._trueValue = s : t === "false-value" && (e._falseValue = s), js(e, t, s, o));
};
function Sl(e, t, n, s) {
  if (s)
    return !!(t === "innerHTML" || t === "textContent" || t in e && Vs(t) && F(n));
  if (t === "spellcheck" || t === "draggable" || t === "translate" || t === "autocorrect" || t === "sandbox" && e.tagName === "IFRAME" || t === "form" || t === "list" && e.tagName === "INPUT" || t === "type" && e.tagName === "TEXTAREA")
    return !1;
  if (t === "width" || t === "height") {
    const r = e.tagName;
    if (r === "IMG" || r === "VIDEO" || r === "CANVAS" || r === "SOURCE")
      return !1;
  }
  return Vs(t) && Z(n) ? !1 : t in e;
}
function Tl(e, t) {
  const n = (
    // @ts-expect-error _def is private
    e._def.props
  );
  if (!n)
    return !1;
  const s = xe(t);
  return Array.isArray(n) ? n.some((r) => xe(r) === s) : Object.keys(n).some((r) => xe(r) === s);
}
const Gs = (e) => {
  const t = e.props["onUpdate:modelValue"] || !1;
  return R(t) ? (n) => tn(t, n) : t;
};
function Cl(e) {
  e.target.composing = !0;
}
function qs(e) {
  const t = e.target;
  t.composing && (t.composing = !1, t.dispatchEvent(new Event("input")));
}
const kn = /* @__PURE__ */ Symbol("_assign");
function zs(e, t, n) {
  return t && (e = e.trim()), n && (e = Zn(e)), e;
}
const Ys = {
  created(e, { modifiers: { lazy: t, trim: n, number: s } }, r) {
    e[kn] = Gs(r);
    const i = s || r.props && r.props.type === "number";
    gt(e, t ? "change" : "input", (o) => {
      o.target.composing || e[kn](zs(e.value, n, i));
    }), (n || i) && gt(e, "change", () => {
      e.value = zs(e.value, n, i);
    }), t || (gt(e, "compositionstart", Cl), gt(e, "compositionend", qs), gt(e, "change", qs));
  },
  // set value on mounted so it's after min/max for type="range"
  mounted(e, { value: t }) {
    e.value = t ?? "";
  },
  beforeUpdate(e, { value: t, oldValue: n, modifiers: { lazy: s, trim: r, number: i } }, o) {
    if (e[kn] = Gs(o), e.composing) return;
    const l = (i || e.type === "number") && !/^0\d/.test(e.value) ? Zn(e.value) : e.value, u = t ?? "";
    if (l === u)
      return;
    const h = e.getRootNode();
    (h instanceof Document || h instanceof ShadowRoot) && h.activeElement === e && e.type !== "range" && (s && t === n || r && e.value.trim() === u) || (e.value = u);
  }
}, Al = ["ctrl", "shift", "alt", "meta"], El = {
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
  exact: (e, t) => Al.some((n) => e[`${n}Key`] && !t.includes(n))
}, Pl = (e, t) => {
  if (!e) return e;
  const n = e._withMods || (e._withMods = {}), s = t.join(".");
  return n[s] || (n[s] = ((r, ...i) => {
    for (let o = 0; o < t.length; o++) {
      const l = El[t[o]];
      if (l && l(r, t)) return;
    }
    return e(r, ...i);
  }));
}, Il = /* @__PURE__ */ ae({ patchProp: xl }, ll);
let Js;
function Ml() {
  return Js || (Js = No(Il));
}
const Ol = ((...e) => {
  const t = Ml().createApp(...e), { mount: n } = t;
  return t.mount = (s) => {
    const r = Fl(s);
    if (!r) return;
    const i = t._component;
    !F(i) && !i.render && !i.template && (i.template = r.innerHTML), r.nodeType === 1 && (r.textContent = "");
    const o = n(r, !1, Rl(r));
    return r instanceof Element && (r.removeAttribute("v-cloak"), r.setAttribute("data-v-app", "")), o;
  }, t;
});
function Rl(e) {
  if (e instanceof SVGElement)
    return "svg";
  if (typeof MathMLElement == "function" && e instanceof MathMLElement)
    return "mathml";
}
function Fl(e) {
  return Z(e) ? document.querySelector(e) : e;
}
function Ce() {
  return typeof window < "u" && window.openxnetApp || null;
}
function Dl(e) {
  if (e && typeof e.isCurrentLanguageZh == "function")
    try {
      return !!e.isCurrentLanguageZh();
    } catch {
      return !0;
    }
  return String(e?.currentLanguage || navigator.language || "zh-CN").toLowerCase().startsWith("zh");
}
function Ll(e) {
  return String(e || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}
function Xs(e) {
  return Ll(e).replace(/\n/g, "<br>");
}
function kl(e) {
  return String(e || "").replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim();
}
function Hl(e) {
  return !e || !Array.isArray(e.messages) ? !1 : e.messages.some((t, n) => t?.role === "system" && n === 0 ? !1 : String(t?.content || "").trim().length > 0 || t?.role === "assistant" && e.isTyping);
}
function Nl(e, t, n) {
  const s = String(t || "");
  if (!s.trim())
    return "";
  try {
    if (e && typeof e.formatMessage == "function") {
      const r = e.formatMessage.call(e, s, n);
      if (r && String(r).trim())
        return String(r);
    }
  } catch {
    return Xs(s);
  }
  return Xs(s);
}
function Ul(e) {
  if (!Hl(e))
    return [];
  const t = (e?.messages || []).filter((n, s) => !(n?.role === "system" && s === 0));
  return t.map((n, s) => {
    const r = n?.role === "assistant" ? "assistant" : "user", i = String(n?.pure_content || n?.content || ""), o = String(n?.prototypeTime || n?.time || "").trim();
    return {
      id: String(n?.id || `browser-live-${s}`),
      role: r,
      text: r === "user" ? kl(i) : "",
      html: r === "assistant" ? Nl(e, i, s) : "",
      typing: r === "assistant" && !String(i || "").trim() && !!e?.isTyping && s === t.length - 1,
      time: o
    };
  });
}
function $l(e) {
  return Array.isArray(e?.browserTabs) ? e.browserTabs.map((t, n) => ({
    id: String(t?.id || `tab-${n}`),
    title: String(t?.title || ""),
    favicon: String(t?.favicon || ""),
    url: String(t?.url || ""),
    currentUrl: String(t?.currentUrl || t?.url || ""),
    isLoading: !!t?.isLoading,
    canGoBack: !!t?.canGoBack,
    canGoForward: !!t?.canGoForward
  })) : [];
}
function jl(e, t) {
  const n = String(e?.currentTabId || "");
  return t.find((s) => s.id === n) || null;
}
function Wl(e, t) {
  const n = String(e?.searchEngine || "bing");
  return n === "google" ? "Google" : n === "bing" ? "Bing" : t ? "AI 分析" : "AI analysis";
}
function Bl(e) {
  if (!e) return !1;
  try {
    if (typeof e.isCurrentTabFavorite == "boolean")
      return e.isCurrentTabFavorite;
    if (typeof e.isCurrentTabFavorite == "function")
      return !!e.isCurrentTabFavorite();
  } catch {
    return !1;
  }
  return !!e.isCurrentTabFavorite;
}
function Kl() {
  const e = Ce(), t = Dl(e), n = $l(e), s = jl(e, n);
  return {
    isZh: t,
    canUseHost: !!e,
    isElectron: !!e?.isElectron,
    activeMenu: String(e?.activeMenu || ""),
    tabs: n,
    currentTab: s,
    currentTabId: String(e?.currentTabId || ""),
    showAssistant: e ? e.showBrowserChat !== !1 : !0,
    dynamicUserAgent: String(e?.dynamicUserAgent || ""),
    webviewPreloadPath: String(e?.webviewPreloadPath || ""),
    messages: Ul(e),
    isSending: !!(e?.isSending || e?.isTyping),
    interpreterEnabled: !!e?.codeSettings?.enabled,
    asrEnabled: !!e?.asrSettings?.enabled,
    searchProviderLabel: Wl(e, t),
    isCurrentTabFavorite: Bl(e),
    urlInput: String(e?.urlInput || "")
  };
}
function ne(e, ...t) {
  const n = Ce(), s = n?.[e];
  if (typeof s == "function")
    return s.apply(n, t);
}
async function oi(e) {
  const t = Ce();
  return t ? (t.userInput = String(e || ""), await t.handleSendOrGuidance(), !0) : !1;
}
async function Vl(e) {
  return oi(e);
}
async function Gl() {
  const e = Ce();
  e && (typeof e.clearMessages == "function" && e.clearMessages(), e.activeMenu = "ai-browser", e.showBrowserChat = !0);
}
async function ql(e) {
  const t = Ce();
  return !t || typeof t.handleWelcomeSearch != "function" ? !1 : (t.welcomeSearchQuery = String(e || ""), t.showBrowserChat = !0, await t.handleWelcomeSearch(), !0);
}
async function zl() {
  return ne("browseAllFiles");
}
async function Yl() {
  return ne("browseImages");
}
async function Jl() {
  const e = Ce();
  e && (e.codeSettings.enabled = !e.codeSettings.enabled, typeof e.handleInterpreterToggle == "function" && await e.handleInterpreterToggle(e.codeSettings.enabled));
}
async function Xl() {
  return ne("toggleASR");
}
async function Zl() {
  const e = Ce();
  e && (e.showBrowserChat = !e.showBrowserChat, typeof e.autoSaveSettings == "function" && await e.autoSaveSettings());
}
async function Ql(e) {
  const t = Ce();
  t && (t.showBrowserChat = !!e, typeof t.autoSaveSettings == "function" && await t.autoSaveSettings());
}
async function ec() {
  return ne("addNewTab");
}
async function tc(e) {
  return ne("switchTab", e);
}
async function nc(e, t) {
  return ne("closeTab", e, t);
}
async function sc() {
  return ne("browserGoBack");
}
async function rc() {
  return ne("browserGoForward");
}
async function ic() {
  return ne("browserReload");
}
async function oc() {
  return ne("goHome");
}
async function lc() {
  const e = Ce();
  e && typeof e.toggleFavorite == "function" && await e.toggleFavorite(e.currentTab);
}
async function cc(e) {
  const t = Ce();
  t && (t.urlInput = String(e || ""), typeof t.handleUrlEnter == "function" && await t.handleUrlEnter());
}
async function ac() {
  return ne("reloadWorkspaceView");
}
async function uc(e) {
  const t = Ce();
  !t || typeof t.openUrlInNewTab != "function" || t.openUrlInNewTab(String(e || ""));
}
async function fc(e) {
  return ne("onDidStartLoading", e);
}
async function dc(e) {
  return ne("onDidStopLoading", e);
}
async function pc(e, t) {
  return ne("onPageTitleUpdated", e, t);
}
async function hc(e, t) {
  return ne("onPageFaviconUpdated", e, t);
}
async function gc(e, t) {
  return ne("onNewWindow", e, t);
}
async function bc(e) {
  return ne("onDomReady", e);
}
async function mc(e) {
  return ne("handleWebviewIpcMessage", e);
}
function _c() {
  return {
    snapshot: Kl,
    sendMessage: oi,
    sendPresetPrompt: Vl,
    startFreshAnalysis: Gl,
    submitWelcomeQuery: ql,
    browseAllFiles: zl,
    browseImages: Yl,
    toggleInterpreter: Jl,
    toggleAsr: Xl,
    toggleAssistantPanel: Zl,
    setAssistantPanel: Ql,
    addNewTab: ec,
    switchTab: tc,
    closeTab: nc,
    goBack: sc,
    goForward: rc,
    reloadCurrent: ic,
    goHome: oc,
    toggleFavorite: lc,
    navigate: cc,
    reloadWorkspaceView: ac,
    openUrlInNewTab: uc,
    onDidStartLoading: fc,
    onDidStopLoading: dc,
    onPageTitleUpdated: pc,
    onPageFaviconUpdated: hc,
    onNewWindow: gc,
    onDomReady: bc,
    handleWebviewIpcMessage: mc
  };
}
const yc = { class: "oxb-split" }, vc = { class: "oxb-stage" }, wc = {
  key: 0,
  class: "oxb-empty"
}, xc = {
  key: 1,
  class: "oxb-empty"
}, Sc = {
  key: 2,
  class: "oxb-empty"
}, Tc = { class: "oxb-chip-row" }, Cc = {
  key: 3,
  class: "oxb-webview-stack"
}, Ac = ["id", "src", "useragent", "preload", "onDidStartLoading", "onDidStopLoading", "onPageTitleUpdated", "onPageFaviconUpdated", "onNewWindow", "onDomReady"], Ec = { class: "oxb-newtab" }, Pc = { class: "oxb-newtab__inner" }, Ic = { class: "oxb-newtab__hero" }, Mc = ["placeholder"], Oc = ["disabled"], Rc = { class: "oxb-newtab__shortcuts" }, Fc = ["onClick"], Dc = { class: "oxb-newtab__shortcut-label" }, Lc = {
  key: 0,
  class: "oxb-panel"
}, kc = { class: "oxb-panel__header" }, Hc = { class: "oxb-panel__title" }, Nc = ["title"], Uc = { class: "oxb-panel__tabs" }, $c = { class: "oxb-pill-group" }, jc = ["onClick"], Wc = {
  key: 0,
  class: "oxb-summary"
}, Bc = { class: "oxb-summary__head" }, Kc = { class: "oxb-summary__text" }, Vc = { class: "oxb-summary__points" }, Gc = { class: "oxb-summary__actions" }, qc = {
  key: 1,
  class: "oxb-ask"
}, zc = {
  key: 0,
  class: "oxb-empty-chat"
}, Yc = { class: "oxb-chip-grid" }, Jc = ["onClick"], Xc = {
  key: 1,
  class: "oxb-stream"
}, Zc = {
  key: 0,
  class: "oxb-msg__avatar"
}, Qc = { class: "oxb-msg__content" }, ea = {
  key: 0,
  class: "oxb-msg__bubble oxb-msg__bubble--assistant oxb-msg__bubble--typing"
}, ta = ["innerHTML"], na = {
  key: 2,
  class: "oxb-msg__bubble oxb-msg__bubble--user"
}, sa = {
  key: 2,
  class: "oxb-translate"
}, ra = { class: "oxb-summary__head" }, ia = { class: "oxb-summary__text" }, oa = { class: "oxb-chip-grid" }, la = { class: "oxb-panel__ask" }, ca = { class: "oxb-panel__ask-row" }, aa = ["placeholder"], ua = {
  __name: "App",
  setup(e) {
    const t = _c(), n = /* @__PURE__ */ Pt(t.snapshot()), s = /* @__PURE__ */ Pt(null), r = /* @__PURE__ */ Pt(""), i = /* @__PURE__ */ Pt("summary"), o = /* @__PURE__ */ Pt("");
    let l = null, u = "", h = "", d = "", b = !1;
    function T(c) {
      return c.map((f) => [
        f.id,
        f.role,
        f.time,
        f.typing ? "typing" : "content",
        f.text || "",
        f.html || ""
      ].join("::")).join("||");
    }
    function C(c) {
      return c.map((f) => [
        f.id,
        f.title,
        f.url,
        f.currentUrl,
        f.isLoading ? "loading" : "idle"
      ].join("::")).join("||");
    }
    function N() {
      const c = s.value;
      return c ? c.scrollHeight - c.scrollTop - c.clientHeight < 120 : !0;
    }
    function O(c = !1) {
      const f = s.value;
      f && (!c && !N() || (f.scrollTop = Math.max(0, f.scrollHeight - f.clientHeight)));
    }
    function D(c = !1) {
      const f = t.snapshot(), p = T(f.messages || []), g = C(f.tabs || []), m = !!f.currentTab?.url, x = p !== u || g !== h || f.showAssistant !== n.value.showAssistant || f.currentTabId !== d || m !== b || f.isSending !== n.value.isSending;
      n.value = f, (x || c) && (u = p, h = g, d = f.currentTabId || "", b = m, nn(() => O(!0)));
    }
    async function z() {
      await t.toggleAssistantPanel(), D();
    }
    async function L() {
      const c = String(r.value || "");
      if (!c.trim() && !n.value.isSending)
        return;
      i.value !== "ask" && (i.value = "ask"), (te.value ? await t.sendMessage(c) : await t.submitWelcomeQuery(c)) && (r.value = "", D(!0));
    }
    function V(c) {
      c.key === "Enter" && !c.shiftKey && (c.preventDefault(), L());
    }
    async function E(c) {
      if (c) {
        if (i.value = "ask", te.value) {
          await t.sendPresetPrompt(c) && D(!0);
          return;
        }
        r.value = c, await L();
      }
    }
    async function Q() {
      const c = P.value ? "OpenXnet 是一个开源的 AI 多智能体协作平台，提供桌面端应用。它基于 Electron 和 TypeScript 构建，支持通过 MCP 协议集成多种工具和技能，打造统一的智能工作流体验。" : "OpenXnet is an open-source AI multi-agent collaboration platform built with Electron and TypeScript, designed to unify tools, models, and workflows through MCP-based integrations.";
      try {
        await navigator.clipboard.writeText(c);
      } catch (f) {
        console.warn("Failed to copy AI browser summary:", f);
      }
    }
    function Ae() {
      i.value = "ask";
      const c = P.value ? "请对当前页面进行深入分析，给出关键结论和后续动作建议。" : "Please deep-analyze the current page and provide key takeaways and recommended next actions.";
      E(c);
    }
    async function be() {
      await t.addNewTab(), D();
    }
    async function Ee() {
      await t.goHome(), D();
    }
    async function lt() {
      await t.reloadWorkspaceView(), D();
    }
    async function Ue(c) {
      c && (await t.navigate(c), D(!0), nn(() => D(!0)));
    }
    async function Qe() {
      const c = String(o.value || "").trim();
      c && (o.value = "", await t.navigate(c), D(!0), nn(() => D(!0)));
    }
    function ct(c) {
      t.onDidStartLoading(c), D();
    }
    function at(c) {
      t.onDidStopLoading(c), D(!0);
    }
    function xt(c, f) {
      t.onPageTitleUpdated(c, f), D();
    }
    function zt(c, f) {
      t.onPageFaviconUpdated(c, f), D();
    }
    function se(c, f) {
      t.onNewWindow(c, f), D();
    }
    function X(c) {
      t.onDomReady(c), D();
    }
    function B(c) {
      t.handleWebviewIpcMessage(c);
    }
    const P = fe(() => n.value.isZh), ut = fe(() => n.value.tabs || []), he = fe(() => n.value.currentTab || null), te = fe(() => !!he.value?.url), St = fe(() => n.value.showAssistant !== !1), Tt = fe(() => n.value.messages || []), Cn = fe(() => [
      { id: "summary", label: P.value ? "摘要" : "Summary" },
      { id: "ask", label: P.value ? "提问" : "Ask" },
      { id: "translate", label: P.value ? "翻译" : "Translate" }
    ]), et = fe(() => P.value ? "OpenXnet 是一个开源的 AI 多智能体协作平台，提供桌面端应用。它基于 Electron 和 TypeScript 构建，支持通过 MCP 协议集成多种工具和技能，打造统一的智能工作流体验。" : "OpenXnet is an open-source AI multi-agent collaboration platform built with Electron and TypeScript, designed to unify tools, models, and workflows through MCP-based integrations."), ft = fe(() => P.value ? ["支持多种 AI 模型提供商", "MCP 工具集成架构", "多平台部署能力"] : ["Supports multiple AI model providers", "MCP tool integration architecture", "Cross-platform deployment support"]), Ct = fe(() => P.value ? [
      { label: "GitHub", url: "https://github.com", icon: "fa-brands fa-github", color: "#24292F" },
      { label: "百度", url: "https://www.baidu.com", icon: "fa-solid fa-paw", color: "#2932E1" },
      { label: "Bing", url: "https://www.bing.com", icon: "fa-solid fa-magnifying-glass", color: "#008373" },
      { label: "维基百科", url: "https://zh.wikipedia.org", icon: "fa-brands fa-wikipedia-w", color: "#000000" },
      { label: "YouTube", url: "https://www.youtube.com", icon: "fa-brands fa-youtube", color: "#FF0000" },
      { label: "Stack Overflow", url: "https://stackoverflow.com", icon: "fa-brands fa-stack-overflow", color: "#F48024" }
    ] : [
      { label: "GitHub", url: "https://github.com", icon: "fa-brands fa-github", color: "#24292F" },
      { label: "Google", url: "https://www.google.com", icon: "fa-brands fa-google", color: "#4285F4" },
      { label: "Bing", url: "https://www.bing.com", icon: "fa-solid fa-magnifying-glass", color: "#008373" },
      { label: "Wikipedia", url: "https://www.wikipedia.org", icon: "fa-brands fa-wikipedia-w", color: "#000000" },
      { label: "YouTube", url: "https://www.youtube.com", icon: "fa-brands fa-youtube", color: "#FF0000" },
      { label: "Stack Overflow", url: "https://stackoverflow.com", icon: "fa-brands fa-stack-overflow", color: "#F48024" }
    ]), Yt = fe(() => P.value ? [
      { icon: "fa-solid fa-file-lines", label: "总结页面", prompt: "请总结当前页面的核心内容和结论。" },
      { icon: "fa-solid fa-list-check", label: "提取待办", prompt: "请从当前页面中提取所有可执行待办，并按优先级整理。" },
      { icon: "fa-solid fa-language", label: "翻译内容", prompt: "请将当前页面的重点内容翻译成中文，并保留结构。" },
      { icon: "fa-solid fa-triangle-exclamation", label: "风险检查", prompt: "请帮我识别当前页面中可能存在的风险、限制和注意事项。" }
    ] : [
      { icon: "fa-solid fa-file-lines", label: "Summarize", prompt: "Summarize the current page with the key points and conclusion." },
      { icon: "fa-solid fa-list-check", label: "Action Items", prompt: "Extract actionable tasks from the current page and sort them by priority." },
      { icon: "fa-solid fa-language", label: "Translate", prompt: "Translate the most important content on the current page while keeping its structure." },
      { icon: "fa-solid fa-triangle-exclamation", label: "Risks", prompt: "Identify possible risks, limitations, and caveats on the current page." }
    ]), Je = fe(() => {
      const c = he.value?.currentUrl || he.value?.url || "";
      if (!c) return "";
      try {
        return new URL(c).hostname.replace(/^www\./, "");
      } catch {
        return c;
      }
    }), ps = fe(() => n.value.isSending && !String(r.value || "").trim() ? "fa-solid fa-stop" : "fa-solid fa-arrow-up"), a = fe(() => i.value === "translate" ? P.value ? "输入要翻译的内容或网址..." : "Enter text or URL to translate..." : te.value ? P.value ? "对此页面提问..." : "Ask about this page..." : P.value ? "输入网址、搜索词或任务..." : "Enter a URL, search, or task...");
    return rn(te, (c, f) => {
      c && !f && Tt.value.length === 0 && (i.value = "summary");
    }), Fr(() => {
      D(!0), l = window.setInterval(() => D(!1), 400);
    }), Dr(() => {
      l && (window.clearInterval(l), l = null);
    }), (c, f) => (U(), W("div", {
      class: we(["ox-vite-browser-shell", {
        "is-panel-collapsed": !St.value,
        "is-live-page": te.value
      }])
    }, [
      y("div", yc, [
        y("section", vc, [
          n.value.canUseHost ? he.value ? n.value.isElectron ? (U(), W("div", Cc, [
            (U(!0), W(oe, null, pt(ut.value, (p) => (U(), W(oe, {
              key: p.id
            }, [
              p.url ? Qt((U(), W("webview", {
                key: 0,
                id: "webview-" + p.id,
                src: p.url,
                class: "oxb-webview",
                useragent: n.value.dynamicUserAgent,
                preload: n.value.webviewPreloadPath,
                partition: "persist:party-browser-session",
                allowpopups: "",
                plugins: "",
                webpreferences: "contextIsolation=true, nodeIntegration=false, sandbox=true, webSecurity=true, enableRemoteModule=false",
                onIpcMessage: B,
                onDidStartLoading: (g) => ct(p.id),
                onDidStopLoading: (g) => at(p.id),
                onPageTitleUpdated: (g) => xt(p.id, g),
                onPageFaviconUpdated: (g) => zt(p.id, g),
                onNewWindow: (g) => se(p.id, g),
                onDomReady: (g) => X(p.id)
              }, null, 40, Ac)), [
                [Hs, he.value && he.value.id === p.id]
              ]) : en("", !0)
            ], 64))), 128)),
            Qt(y("div", Ec, [
              y("div", Pc, [
                y("div", Ic, [
                  f[10] || (f[10] = y("div", { class: "oxb-newtab__icon" }, [
                    y("i", { class: "fa-solid fa-globe" })
                  ], -1)),
                  y("h1", null, H(P.value ? "OpenXnet AI 浏览器" : "OpenXnet AI Browser"), 1),
                  y("p", null, H(P.value ? "在上方地址栏输入网址或搜索内容开始浏览，AI 助手会跟随你的页面同步分析。" : "Type a URL or search above to start browsing. The AI assistant will analyse the page alongside you."), 1)
                ]),
                y("form", {
                  class: "oxb-newtab__search",
                  onSubmit: Pl(Qe, ["prevent"])
                }, [
                  f[11] || (f[11] = y("i", { class: "fa-solid fa-magnifying-glass" }, null, -1)),
                  Qt(y("input", {
                    "onUpdate:modelValue": f[0] || (f[0] = (p) => o.value = p),
                    type: "text",
                    placeholder: P.value ? "输入网址或搜索关键词..." : "Enter a URL or search query..."
                  }, null, 8, Mc), [
                    [Ys, o.value]
                  ]),
                  y("button", {
                    type: "submit",
                    disabled: !String(o.value || "").trim()
                  }, H(P.value ? "前往" : "Go"), 9, Oc)
                ], 32),
                y("div", Rc, [
                  (U(!0), W(oe, null, pt(Ct.value, (p) => (U(), W("button", {
                    key: p.url,
                    type: "button",
                    class: "oxb-newtab__shortcut",
                    onClick: (g) => Ue(p.url)
                  }, [
                    y("span", {
                      class: "oxb-newtab__shortcut-icon",
                      style: _n({ background: p.color })
                    }, [
                      y("i", {
                        class: we(p.icon)
                      }, null, 2)
                    ], 4),
                    y("span", Dc, H(p.label), 1)
                  ], 8, Fc))), 128))
                ])
              ])
            ], 512), [
              [Hs, !te.value]
            ])
          ])) : (U(), W("div", Sc, [
            f[9] || (f[9] = y("div", { class: "oxb-empty__icon" }, [
              y("i", { class: "fa-solid fa-globe" })
            ], -1)),
            y("h2", null, H(P.value ? "浏览器预览模式" : "Browser preview mode"), 1),
            y("p", null, H(P.value ? "当前是外部浏览器预览，AI 浏览器的真实网页承载会在桌面端壳内启用。" : "You are in external browser preview mode. The live browsing surface is enabled inside the desktop shell."), 1),
            y("div", Tc, [
              y("button", {
                type: "button",
                class: "oxb-chip",
                onClick: Ee
              }, H(P.value ? "回到空白页" : "Go to blank tab"), 1),
              y("button", {
                type: "button",
                class: "oxb-chip",
                onClick: be
              }, H(P.value ? "新建标签页" : "Create tab"), 1)
            ])
          ])) : (U(), W("div", xc, [
            f[8] || (f[8] = y("div", { class: "oxb-empty__icon" }, [
              y("i", { class: "fa-regular fa-compass" })
            ], -1)),
            y("h2", null, H(P.value ? "正在恢复标签页状态" : "Restoring tabs"), 1),
            y("p", null, H(P.value ? "浏览器会在恢复完成后继续回到上次的工作流。" : "The browser will resume your previous workspace flow once tab recovery completes."), 1),
            y("button", {
              type: "button",
              class: "oxb-primary-btn",
              onClick: be
            }, [
              f[7] || (f[7] = y("i", { class: "fa-solid fa-plus" }, null, -1)),
              y("span", null, H(P.value ? "新建标签页" : "Create tab"), 1)
            ])
          ])) : (U(), W("div", wc, [
            f[6] || (f[6] = y("div", { class: "oxb-empty__icon" }, [
              y("i", { class: "fa-solid fa-plug-circle-xmark" })
            ], -1)),
            y("h2", null, H(P.value ? "桌面桥接未恢复" : "Desktop bridge unavailable"), 1),
            y("p", null, H(P.value ? "AI 浏览器需要桌面端桥接能力，当前页面正在尝试恢复工作区。" : "The AI browser needs the desktop bridge. The workspace is attempting to recover."), 1),
            y("button", {
              type: "button",
              class: "oxb-primary-btn",
              onClick: lt
            }, [
              f[5] || (f[5] = y("i", { class: "fa-solid fa-rotate-right" }, null, -1)),
              y("span", null, H(P.value ? "重新加载工作区" : "Reload workspace"), 1)
            ])
          ]))
        ]),
        St.value ? (U(), W("aside", Lc, [
          y("div", kc, [
            y("span", Hc, [
              f[12] || (f[12] = y("i", { class: "fa-solid fa-sparkles" }, null, -1)),
              y("span", null, H(P.value ? "AI 助手" : "AI Assistant"), 1)
            ]),
            y("button", {
              type: "button",
              class: "oxb-panel__minimize",
              title: P.value ? "收起 AI 面板" : "Minimize AI panel",
              onClick: z
            }, [...f[13] || (f[13] = [
              y("i", { class: "fa-solid fa-minus" }, null, -1)
            ])], 8, Nc)
          ]),
          y("div", Uc, [
            y("div", $c, [
              (U(!0), W(oe, null, pt(Cn.value, (p) => (U(), W("button", {
                key: p.id,
                type: "button",
                class: we(["oxb-pill", { "is-active": i.value === p.id }]),
                onClick: (g) => i.value = p.id
              }, H(p.label), 11, jc))), 128))
            ])
          ]),
          y("div", {
            ref_key: "streamRef",
            ref: s,
            class: "oxb-panel__body"
          }, [
            i.value === "summary" ? (U(), W("div", Wc, [
              y("div", Bc, [
                f[14] || (f[14] = y("i", { class: "fa-solid fa-sparkles" }, null, -1)),
                y("span", null, H(P.value ? "页面摘要" : "Page Summary"), 1)
              ]),
              y("p", Kc, H(et.value), 1),
              y("ul", Vc, [
                (U(!0), W(oe, null, pt(ft.value, (p) => (U(), W("li", { key: p }, [
                  f[15] || (f[15] = y("i", { class: "fa-solid fa-circle-check" }, null, -1)),
                  y("span", null, H(p), 1)
                ]))), 128))
              ]),
              y("div", Gc, [
                y("button", {
                  type: "button",
                  class: "oxb-secondary-btn",
                  onClick: Q
                }, [
                  f[16] || (f[16] = y("i", { class: "fa-regular fa-copy" }, null, -1)),
                  y("span", null, H(P.value ? "复制摘要" : "Copy Summary"), 1)
                ]),
                y("button", {
                  type: "button",
                  class: "oxb-primary-btn oxb-primary-btn--sm",
                  onClick: Ae
                }, [
                  f[17] || (f[17] = y("i", { class: "fa-solid fa-magnifying-glass-plus" }, null, -1)),
                  y("span", null, H(P.value ? "深入分析" : "Deep Analysis"), 1)
                ])
              ])
            ])) : i.value === "ask" ? (U(), W("div", qc, [
              Tt.value.length === 0 ? (U(), W("div", zc, [
                y("h3", null, H(te.value ? P.value ? "对当前页面开始分析" : "Start analyzing this page" : P.value ? "从这里开始浏览任务" : "Start the browsing workflow here"), 1),
                y("p", null, H(te.value ? P.value ? `当前正在浏览 ${Je.value || "此页面"}，可以直接提问、总结、翻译或提取操作建议。` : `You are currently browsing ${Je.value || "this page"}. Ask questions, summarize, translate, or extract actions.` : P.value ? "可以输入网址、关键词，或者直接让 AI 帮你规划下一步浏览动作。" : "Enter a URL, a query, or ask the assistant to plan the next browsing action."), 1),
                y("div", Yc, [
                  (U(!0), W(oe, null, pt(Yt.value, (p) => (U(), W("button", {
                    key: p.label,
                    type: "button",
                    class: "oxb-chip oxb-chip--icon",
                    onClick: (g) => E(p.prompt)
                  }, [
                    y("i", {
                      class: we(p.icon)
                    }, null, 2),
                    y("span", null, H(p.label), 1)
                  ], 8, Jc))), 128))
                ])
              ])) : (U(), W("div", Xc, [
                (U(!0), W(oe, null, pt(Tt.value, (p) => (U(), W("article", {
                  key: p.id,
                  class: we(["oxb-msg", `is-${p.role}`])
                }, [
                  p.role === "assistant" ? (U(), W("div", Zc, "AI")) : en("", !0),
                  y("div", Qc, [
                    p.typing ? (U(), W("div", ea, [...f[18] || (f[18] = [
                      y("span", null, null, -1),
                      y("span", null, null, -1),
                      y("span", null, null, -1)
                    ])])) : p.role === "assistant" ? (U(), W("div", {
                      key: 1,
                      class: "oxb-msg__bubble oxb-msg__bubble--assistant markdown-body",
                      innerHTML: p.html
                    }, null, 8, ta)) : (U(), W("div", na, H(p.text), 1)),
                    p.time ? (U(), W("div", {
                      key: 3,
                      class: we(["oxb-msg__time", `is-${p.role}`])
                    }, H(p.time), 3)) : en("", !0)
                  ])
                ], 2))), 128))
              ]))
            ])) : (U(), W("div", sa, [
              y("div", ra, [
                f[19] || (f[19] = y("i", { class: "fa-solid fa-language" }, null, -1)),
                y("span", null, H(P.value ? "翻译与整理" : "Translate & Reshape"), 1)
              ]),
              y("p", ia, H(P.value ? "在下方输入框输入要翻译的文字或网址，AI 会保留原结构并提供双语对照。" : "Enter text or a URL below. The assistant will translate while keeping the original structure and provide a bilingual view."), 1),
              y("div", oa, [
                y("button", {
                  type: "button",
                  class: "oxb-chip",
                  onClick: f[1] || (f[1] = (p) => E(P.value ? "请将本页内容翻译为英文。" : "Translate this page into English."))
                }, H(P.value ? "英文翻译" : "Translate to English"), 1),
                y("button", {
                  type: "button",
                  class: "oxb-chip",
                  onClick: f[2] || (f[2] = (p) => E(P.value ? "请将本页内容翻译为中文。" : "Translate this page into Chinese."))
                }, H(P.value ? "中文翻译" : "Translate to Chinese"), 1),
                y("button", {
                  type: "button",
                  class: "oxb-chip",
                  onClick: f[3] || (f[3] = (p) => E(P.value ? "请把页面中的表格抽取为结构化数据。" : "Extract tables on this page into structured data."))
                }, H(P.value ? "表格抽取" : "Extract Tables"), 1)
              ])
            ]))
          ], 512),
          y("div", la, [
            y("div", ca, [
              Qt(y("input", {
                "onUpdate:modelValue": f[4] || (f[4] = (p) => r.value = p),
                type: "text",
                class: "oxb-panel__ask-input",
                placeholder: a.value,
                onKeydown: V
              }, null, 40, aa), [
                [Ys, r.value]
              ]),
              y("button", {
                type: "button",
                class: we(["oxb-panel__ask-send", { "is-stopping": n.value.isSending && !String(r.value || "").trim() }]),
                onClick: L
              }, [
                y("i", {
                  class: we(ps.value)
                }, null, 2)
              ], 2)
            ])
          ])
        ])) : en("", !0)
      ])
    ], 2));
  }
};
function zn() {
  const e = document.getElementById("openxnet-vite-browser-root");
  !e || e.dataset.viteMounted === "true" || (Ol(ua).mount(e), e.dataset.viteMounted = "true");
}
document.readyState === "loading" ? document.addEventListener("DOMContentLoaded", zn, { once: !0 }) : zn();
window.addEventListener("openxnet-vite-browser-remount", zn);
