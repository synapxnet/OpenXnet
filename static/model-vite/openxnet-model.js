// @__NO_SIDE_EFFECTS__
function vi(e) {
  const t = /* @__PURE__ */ Object.create(null);
  for (const n of e.split(",")) t[n] = 1;
  return (n) => n in t;
}
const re = {}, Lt = [], Qe = () => {
}, Ar = () => !1, En = (e) => e.charCodeAt(0) === 111 && e.charCodeAt(1) === 110 && // uppercase letter
(e.charCodeAt(2) > 122 || e.charCodeAt(2) < 97), On = (e) => e.startsWith("onUpdate:"), me = Object.assign, mi = (e, t) => {
  const n = e.indexOf(t);
  n > -1 && e.splice(n, 1);
}, Uo = Object.prototype.hasOwnProperty, Z = (e, t) => Uo.call(e, t), F = Array.isArray, Dt = (e) => un(e) === "[object Map]", Ir = (e) => un(e) === "[object Set]", Ki = (e) => un(e) === "[object Date]", B = (e) => typeof e == "function", fe = (e) => typeof e == "string", Ze = (e) => typeof e == "symbol", ee = (e) => e !== null && typeof e == "object", Mr = (e) => (ee(e) || B(e)) && B(e.then) && B(e.catch), Er = Object.prototype.toString, un = (e) => Er.call(e), Wo = (e) => un(e).slice(8, -1), Or = (e) => un(e) === "[object Object]", yi = (e) => fe(e) && e !== "NaN" && e[0] !== "-" && "" + parseInt(e, 10) === e, Jt = /* @__PURE__ */ vi(
  // the leading comma is intentional so empty string "" is also included
  ",key,ref,ref_for,ref_key,onVnodeBeforeMount,onVnodeMounted,onVnodeBeforeUpdate,onVnodeUpdated,onVnodeBeforeUnmount,onVnodeUnmounted"
), kn = (e) => {
  const t = /* @__PURE__ */ Object.create(null);
  return ((n) => t[n] || (t[n] = e(n)));
}, qo = /-\w/g, $e = kn(
  (e) => e.replace(qo, (t) => t.slice(1).toUpperCase())
), Go = /\B([A-Z])/g, It = kn(
  (e) => e.replace(Go, "-$1").toLowerCase()
), kr = kn((e) => e.charAt(0).toUpperCase() + e.slice(1)), Hn = kn(
  (e) => e ? `on${kr(e)}` : ""
), Xe = (e, t) => !Object.is(e, t), yn = (e, ...t) => {
  for (let n = 0; n < e.length; n++)
    e[n](...t);
}, Lr = (e, t, n, i = !1) => {
  Object.defineProperty(e, t, {
    configurable: !0,
    enumerable: !1,
    writable: i,
    value: n
  });
}, _i = (e) => {
  const t = parseFloat(e);
  return isNaN(t) ? e : t;
}, Jo = (e) => {
  const t = fe(e) ? Number(e) : NaN;
  return isNaN(t) ? e : t;
};
let Hi;
const Ln = () => Hi || (Hi = typeof globalThis < "u" ? globalThis : typeof self < "u" ? self : typeof window < "u" ? window : typeof globalThis < "u" ? globalThis : {});
function bi(e) {
  if (F(e)) {
    const t = {};
    for (let n = 0; n < e.length; n++) {
      const i = e[n], r = fe(i) ? Qo(i) : bi(i);
      if (r)
        for (const o in r)
          t[o] = r[o];
    }
    return t;
  } else if (fe(e) || ee(e))
    return e;
}
const zo = /;(?![^(]*\))/g, Yo = /:([^]+)/, Xo = /\/\*[^]*?\*\//g;
function Qo(e) {
  const t = {};
  return e.replace(Xo, "").split(zo).forEach((n) => {
    if (n) {
      const i = n.split(Yo);
      i.length > 1 && (t[i[0].trim()] = i[1].trim());
    }
  }), t;
}
function Oe(e) {
  let t = "";
  if (fe(e))
    t = e;
  else if (F(e))
    for (let n = 0; n < e.length; n++) {
      const i = Oe(e[n]);
      i && (t += i + " ");
    }
  else if (ee(e))
    for (const n in e)
      e[n] && (t += n + " ");
  return t.trim();
}
const Zo = "itemscope,allowfullscreen,formnovalidate,ismap,nomodule,novalidate,readonly", es = /* @__PURE__ */ vi(Zo);
function Dr(e) {
  return !!e || e === "";
}
function ts(e, t) {
  if (e.length !== t.length) return !1;
  let n = !0;
  for (let i = 0; n && i < e.length; i++)
    n = Si(e[i], t[i]);
  return n;
}
function Si(e, t) {
  if (e === t) return !0;
  let n = Ki(e), i = Ki(t);
  if (n || i)
    return n && i ? e.getTime() === t.getTime() : !1;
  if (n = Ze(e), i = Ze(t), n || i)
    return e === t;
  if (n = F(e), i = F(t), n || i)
    return n && i ? ts(e, t) : !1;
  if (n = ee(e), i = ee(t), n || i) {
    if (!n || !i)
      return !1;
    const r = Object.keys(e).length, o = Object.keys(t).length;
    if (r !== o)
      return !1;
    for (const s in e) {
      const l = e.hasOwnProperty(s), a = t.hasOwnProperty(s);
      if (l && !a || !l && a || !Si(e[s], t[s]))
        return !1;
    }
  }
  return String(e) === String(t);
}
const Fr = (e) => !!(e && e.__v_isRef === !0), R = (e) => fe(e) ? e : e == null ? "" : F(e) || ee(e) && (e.toString === Er || !B(e.toString)) ? Fr(e) ? R(e.value) : JSON.stringify(e, Rr, 2) : String(e), Rr = (e, t) => Fr(t) ? Rr(e, t.value) : Dt(t) ? {
  [`Map(${t.size})`]: [...t.entries()].reduce(
    (n, [i, r], o) => (n[jn(i, o) + " =>"] = r, n),
    {}
  )
} : Ir(t) ? {
  [`Set(${t.size})`]: [...t.values()].map((n) => jn(n))
} : Ze(t) ? jn(t) : ee(t) && !F(t) && !Or(t) ? String(t) : t, jn = (e, t = "") => {
  var n;
  return (
    // Symbol.description in es2019+ so we need to cast here to pass
    // the lib: es2016 check
    Ze(e) ? `Symbol(${(n = e.description) != null ? n : t})` : e
  );
};
let be;
class ns {
  // TODO isolatedDeclarations "__v_skip"
  constructor(t = !1) {
    this.detached = t, this._active = !0, this._on = 0, this.effects = [], this.cleanups = [], this._isPaused = !1, this._warnOnRun = !0, this.__v_skip = !0, !t && be && (be.active ? (this.parent = be, this.index = (be.scopes || (be.scopes = [])).push(
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
      const n = be;
      try {
        return be = this, t();
      } finally {
        be = n;
      }
    }
  }
  /**
   * This should only be called on non-detached scopes
   * @internal
   */
  on() {
    ++this._on === 1 && (this.prevScope = be, be = this);
  }
  /**
   * This should only be called on non-detached scopes
   * @internal
   */
  off() {
    if (this._on > 0 && --this._on === 0) {
      if (be === this)
        be = this.prevScope;
      else {
        let t = be;
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
      let n, i;
      for (n = 0, i = this.effects.length; n < i; n++)
        this.effects[n].stop();
      for (this.effects.length = 0, n = 0, i = this.cleanups.length; n < i; n++)
        this.cleanups[n]();
      if (this.cleanups.length = 0, this.scopes) {
        for (n = 0, i = this.scopes.length; n < i; n++)
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
function is() {
  return be;
}
let ae;
const Un = /* @__PURE__ */ new WeakSet();
class Vr {
  constructor(t) {
    this.fn = t, this.deps = void 0, this.depsTail = void 0, this.flags = 5, this.next = void 0, this.cleanup = void 0, this.scheduler = void 0, be && (be.active ? be.effects.push(this) : this.flags &= -2);
  }
  pause() {
    this.flags |= 64;
  }
  resume() {
    this.flags & 64 && (this.flags &= -65, Un.has(this) && (Un.delete(this), this.trigger()));
  }
  /**
   * @internal
   */
  notify() {
    this.flags & 2 && !(this.flags & 32) || this.flags & 8 || $r(this);
  }
  run() {
    if (!(this.flags & 1))
      return this.fn();
    this.flags |= 2, ji(this), Br(this);
    const t = ae, n = Be;
    ae = this, Be = !0;
    try {
      return this.fn();
    } finally {
      Kr(this), ae = t, Be = n, this.flags &= -3;
    }
  }
  stop() {
    if (this.flags & 1) {
      for (let t = this.deps; t; t = t.nextDep)
        Ci(t);
      this.deps = this.depsTail = void 0, ji(this), this.onStop && this.onStop(), this.flags &= -2;
    }
  }
  trigger() {
    this.flags & 64 ? Un.add(this) : this.scheduler ? this.scheduler() : this.runIfDirty();
  }
  /**
   * @internal
   */
  runIfDirty() {
    ni(this) && this.run();
  }
  get dirty() {
    return ni(this);
  }
}
let Nr = 0, zt, Yt;
function $r(e, t = !1) {
  if (e.flags |= 8, t) {
    e.next = Yt, Yt = e;
    return;
  }
  e.next = zt, zt = e;
}
function xi() {
  Nr++;
}
function Pi() {
  if (--Nr > 0)
    return;
  if (Yt) {
    let t = Yt;
    for (Yt = void 0; t; ) {
      const n = t.next;
      t.next = void 0, t.flags &= -9, t = n;
    }
  }
  let e;
  for (; zt; ) {
    let t = zt;
    for (zt = void 0; t; ) {
      const n = t.next;
      if (t.next = void 0, t.flags &= -9, t.flags & 1)
        try {
          t.trigger();
        } catch (i) {
          e || (e = i);
        }
      t = n;
    }
  }
  if (e) throw e;
}
function Br(e) {
  for (let t = e.deps; t; t = t.nextDep)
    t.version = -1, t.prevActiveLink = t.dep.activeLink, t.dep.activeLink = t;
}
function Kr(e) {
  let t, n = e.depsTail, i = n;
  for (; i; ) {
    const r = i.prevDep;
    i.version === -1 ? (i === n && (n = r), Ci(i), rs(i)) : t = i, i.dep.activeLink = i.prevActiveLink, i.prevActiveLink = void 0, i = r;
  }
  e.deps = t, e.depsTail = n;
}
function ni(e) {
  for (let t = e.deps; t; t = t.nextDep)
    if (t.dep.version !== t.version || t.dep.computed && (Hr(t.dep.computed) || t.dep.version !== t.version))
      return !0;
  return !!e._dirty;
}
function Hr(e) {
  if (e.flags & 4 && !(e.flags & 16) || (e.flags &= -17, e.globalVersion === tn) || (e.globalVersion = tn, !e.isSSR && e.flags & 128 && (!e.deps && !e._dirty || !ni(e))))
    return;
  e.flags |= 2;
  const t = e.dep, n = ae, i = Be;
  ae = e, Be = !0;
  try {
    Br(e);
    const r = e.fn(e._value);
    (t.version === 0 || Xe(r, e._value)) && (e.flags |= 128, e._value = r, t.version++);
  } catch (r) {
    throw t.version++, r;
  } finally {
    ae = n, Be = i, Kr(e), e.flags &= -3;
  }
}
function Ci(e, t = !1) {
  const { dep: n, prevSub: i, nextSub: r } = e;
  if (i && (i.nextSub = r, e.prevSub = void 0), r && (r.prevSub = i, e.nextSub = void 0), n.subs === e && (n.subs = i, !i && n.computed)) {
    n.computed.flags &= -5;
    for (let o = n.computed.deps; o; o = o.nextDep)
      Ci(o, !0);
  }
  !t && !--n.sc && n.map && n.map.delete(n.key);
}
function rs(e) {
  const { prevDep: t, nextDep: n } = e;
  t && (t.nextDep = n, e.prevDep = void 0), n && (n.prevDep = t, e.nextDep = void 0);
}
let Be = !0;
const jr = [];
function at() {
  jr.push(Be), Be = !1;
}
function ct() {
  const e = jr.pop();
  Be = e === void 0 ? !0 : e;
}
function ji(e) {
  const { cleanup: t } = e;
  if (e.cleanup = void 0, t) {
    const n = ae;
    ae = void 0;
    try {
      t();
    } finally {
      ae = n;
    }
  }
}
let tn = 0;
class os {
  constructor(t, n) {
    this.sub = t, this.dep = n, this.version = n.version, this.nextDep = this.prevDep = this.nextSub = this.prevSub = this.prevActiveLink = void 0;
  }
}
class wi {
  // TODO isolatedDeclarations "__v_skip"
  constructor(t) {
    this.computed = t, this.version = 0, this.activeLink = void 0, this.subs = void 0, this.map = void 0, this.key = void 0, this.sc = 0, this.__v_skip = !0;
  }
  track(t) {
    if (!ae || !Be || ae === this.computed)
      return;
    let n = this.activeLink;
    if (n === void 0 || n.sub !== ae)
      n = this.activeLink = new os(ae, this), ae.deps ? (n.prevDep = ae.depsTail, ae.depsTail.nextDep = n, ae.depsTail = n) : ae.deps = ae.depsTail = n, Ur(n);
    else if (n.version === -1 && (n.version = this.version, n.nextDep)) {
      const i = n.nextDep;
      i.prevDep = n.prevDep, n.prevDep && (n.prevDep.nextDep = i), n.prevDep = ae.depsTail, n.nextDep = void 0, ae.depsTail.nextDep = n, ae.depsTail = n, ae.deps === n && (ae.deps = i);
    }
    return n;
  }
  trigger(t) {
    this.version++, tn++, this.notify(t);
  }
  notify(t) {
    xi();
    try {
      for (let n = this.subs; n; n = n.prevSub)
        n.sub.notify() && n.sub.dep.notify();
    } finally {
      Pi();
    }
  }
}
function Ur(e) {
  if (e.dep.sc++, e.sub.flags & 4) {
    const t = e.dep.computed;
    if (t && !e.dep.subs) {
      t.flags |= 20;
      for (let i = t.deps; i; i = i.nextDep)
        Ur(i);
    }
    const n = e.dep.subs;
    n !== e && (e.prevSub = n, n && (n.nextSub = e)), e.dep.subs = e;
  }
}
const ii = /* @__PURE__ */ new WeakMap(), wt = /* @__PURE__ */ Symbol(
  ""
), ri = /* @__PURE__ */ Symbol(
  ""
), nn = /* @__PURE__ */ Symbol(
  ""
);
function Pe(e, t, n) {
  if (Be && ae) {
    let i = ii.get(e);
    i || ii.set(e, i = /* @__PURE__ */ new Map());
    let r = i.get(n);
    r || (i.set(n, r = new wi()), r.map = i, r.key = n), r.track();
  }
}
function st(e, t, n, i, r, o) {
  const s = ii.get(e);
  if (!s) {
    tn++;
    return;
  }
  const l = (a) => {
    a && a.trigger();
  };
  if (xi(), t === "clear")
    s.forEach(l);
  else {
    const a = F(e), d = a && yi(n);
    if (a && n === "length") {
      const c = Number(i);
      s.forEach((g, x) => {
        (x === "length" || x === nn || !Ze(x) && x >= c) && l(g);
      });
    } else
      switch ((n !== void 0 || s.has(void 0)) && l(s.get(n)), d && l(s.get(nn)), t) {
        case "add":
          a ? d && l(s.get("length")) : (l(s.get(wt)), Dt(e) && l(s.get(ri)));
          break;
        case "delete":
          a || (l(s.get(wt)), Dt(e) && l(s.get(ri)));
          break;
        case "set":
          Dt(e) && l(s.get(wt));
          break;
      }
  }
  Pi();
}
function Mt(e) {
  const t = /* @__PURE__ */ X(e);
  return t === e ? t : (Pe(t, "iterate", nn), /* @__PURE__ */ Ne(e) ? t : t.map(Ke));
}
function Dn(e) {
  return Pe(e = /* @__PURE__ */ X(e), "iterate", nn), e;
}
function ze(e, t) {
  return /* @__PURE__ */ ut(e) ? Vt(/* @__PURE__ */ Tt(e) ? Ke(t) : t) : Ke(t);
}
const ss = {
  __proto__: null,
  [Symbol.iterator]() {
    return Wn(this, Symbol.iterator, (e) => ze(this, e));
  },
  concat(...e) {
    return Mt(this).concat(
      ...e.map((t) => F(t) ? Mt(t) : t)
    );
  },
  entries() {
    return Wn(this, "entries", (e) => (e[1] = ze(this, e[1]), e));
  },
  every(e, t) {
    return nt(this, "every", e, t, void 0, arguments);
  },
  filter(e, t) {
    return nt(
      this,
      "filter",
      e,
      t,
      (n) => n.map((i) => ze(this, i)),
      arguments
    );
  },
  find(e, t) {
    return nt(
      this,
      "find",
      e,
      t,
      (n) => ze(this, n),
      arguments
    );
  },
  findIndex(e, t) {
    return nt(this, "findIndex", e, t, void 0, arguments);
  },
  findLast(e, t) {
    return nt(
      this,
      "findLast",
      e,
      t,
      (n) => ze(this, n),
      arguments
    );
  },
  findLastIndex(e, t) {
    return nt(this, "findLastIndex", e, t, void 0, arguments);
  },
  // flat, flatMap could benefit from ARRAY_ITERATE but are not straight-forward to implement
  forEach(e, t) {
    return nt(this, "forEach", e, t, void 0, arguments);
  },
  includes(...e) {
    return qn(this, "includes", e);
  },
  indexOf(...e) {
    return qn(this, "indexOf", e);
  },
  join(e) {
    return Mt(this).join(e);
  },
  // keys() iterator only reads `length`, no optimization required
  lastIndexOf(...e) {
    return qn(this, "lastIndexOf", e);
  },
  map(e, t) {
    return nt(this, "map", e, t, void 0, arguments);
  },
  pop() {
    return jt(this, "pop");
  },
  push(...e) {
    return jt(this, "push", e);
  },
  reduce(e, ...t) {
    return Ui(this, "reduce", e, t);
  },
  reduceRight(e, ...t) {
    return Ui(this, "reduceRight", e, t);
  },
  shift() {
    return jt(this, "shift");
  },
  // slice could use ARRAY_ITERATE but also seems to beg for range tracking
  some(e, t) {
    return nt(this, "some", e, t, void 0, arguments);
  },
  splice(...e) {
    return jt(this, "splice", e);
  },
  toReversed() {
    return Mt(this).toReversed();
  },
  toSorted(e) {
    return Mt(this).toSorted(e);
  },
  toSpliced(...e) {
    return Mt(this).toSpliced(...e);
  },
  unshift(...e) {
    return jt(this, "unshift", e);
  },
  values() {
    return Wn(this, "values", (e) => ze(this, e));
  }
};
function Wn(e, t, n) {
  const i = Dn(e), r = i[t]();
  return i !== e && !/* @__PURE__ */ Ne(e) && (r._next = r.next, r.next = () => {
    const o = r._next();
    return o.done || (o.value = n(o.value)), o;
  }), r;
}
const ls = Array.prototype;
function nt(e, t, n, i, r, o) {
  const s = Dn(e), l = s !== e && !/* @__PURE__ */ Ne(e), a = s[t];
  if (a !== ls[t]) {
    const g = a.apply(e, o);
    return l ? Ke(g) : g;
  }
  let d = n;
  s !== e && (l ? d = function(g, x) {
    return n.call(this, ze(e, g), x, e);
  } : n.length > 2 && (d = function(g, x) {
    return n.call(this, g, x, e);
  }));
  const c = a.call(s, d, i);
  return l && r ? r(c) : c;
}
function Ui(e, t, n, i) {
  const r = Dn(e), o = r !== e && !/* @__PURE__ */ Ne(e);
  let s = n, l = !1;
  r !== e && (o ? (l = i.length === 0, s = function(d, c, g) {
    return l && (l = !1, d = ze(e, d)), n.call(this, d, ze(e, c), g, e);
  }) : n.length > 3 && (s = function(d, c, g) {
    return n.call(this, d, c, g, e);
  }));
  const a = r[t](s, ...i);
  return l ? ze(e, a) : a;
}
function qn(e, t, n) {
  const i = /* @__PURE__ */ X(e);
  Pe(i, "iterate", nn);
  const r = i[t](...n);
  return (r === -1 || r === !1) && /* @__PURE__ */ Mi(n[0]) ? (n[0] = /* @__PURE__ */ X(n[0]), i[t](...n)) : r;
}
function jt(e, t, n = []) {
  at(), xi();
  const i = (/* @__PURE__ */ X(e))[t].apply(e, n);
  return Pi(), ct(), i;
}
const as = /* @__PURE__ */ vi("__proto__,__v_isRef,__isVue"), Wr = new Set(
  /* @__PURE__ */ Object.getOwnPropertyNames(Symbol).filter((e) => e !== "arguments" && e !== "caller").map((e) => Symbol[e]).filter(Ze)
);
function cs(e) {
  Ze(e) || (e = String(e));
  const t = /* @__PURE__ */ X(this);
  return Pe(t, "has", e), t.hasOwnProperty(e);
}
class qr {
  constructor(t = !1, n = !1) {
    this._isReadonly = t, this._isShallow = n;
  }
  get(t, n, i) {
    if (n === "__v_skip") return t.__v_skip;
    const r = this._isReadonly, o = this._isShallow;
    if (n === "__v_isReactive")
      return !r;
    if (n === "__v_isReadonly")
      return r;
    if (n === "__v_isShallow")
      return o;
    if (n === "__v_raw")
      return i === (r ? o ? _s : Yr : o ? zr : Jr).get(t) || // receiver is not the reactive proxy, but has the same prototype
      // this means the receiver is a user proxy of the reactive proxy
      Object.getPrototypeOf(t) === Object.getPrototypeOf(i) ? t : void 0;
    const s = F(t);
    if (!r) {
      let a;
      if (s && (a = ss[n]))
        return a;
      if (n === "hasOwnProperty")
        return cs;
    }
    const l = Reflect.get(
      t,
      n,
      // if this is a proxy wrapping a ref, return methods using the raw ref
      // as receiver so that we don't have to call `toRaw` on the ref in all
      // its class methods
      /* @__PURE__ */ Ce(t) ? t : i
    );
    if ((Ze(n) ? Wr.has(n) : as(n)) || (r || Pe(t, "get", n), o))
      return l;
    if (/* @__PURE__ */ Ce(l)) {
      const a = s && yi(n) ? l : l.value;
      return r && ee(a) ? /* @__PURE__ */ si(a) : a;
    }
    return ee(l) ? r ? /* @__PURE__ */ si(l) : /* @__PURE__ */ Ai(l) : l;
  }
}
class Gr extends qr {
  constructor(t = !1) {
    super(!1, t);
  }
  set(t, n, i, r) {
    let o = t[n];
    const s = F(t) && yi(n);
    if (!this._isShallow) {
      const d = /* @__PURE__ */ ut(o);
      if (!/* @__PURE__ */ Ne(i) && !/* @__PURE__ */ ut(i) && (o = /* @__PURE__ */ X(o), i = /* @__PURE__ */ X(i)), !s && /* @__PURE__ */ Ce(o) && !/* @__PURE__ */ Ce(i))
        return d || (o.value = i), !0;
    }
    const l = s ? Number(n) < t.length : Z(t, n), a = Reflect.set(
      t,
      n,
      i,
      /* @__PURE__ */ Ce(t) ? t : r
    );
    return t === /* @__PURE__ */ X(r) && (l ? Xe(i, o) && st(t, "set", n, i) : st(t, "add", n, i)), a;
  }
  deleteProperty(t, n) {
    const i = Z(t, n);
    t[n];
    const r = Reflect.deleteProperty(t, n);
    return r && i && st(t, "delete", n, void 0), r;
  }
  has(t, n) {
    const i = Reflect.has(t, n);
    return (!Ze(n) || !Wr.has(n)) && Pe(t, "has", n), i;
  }
  ownKeys(t) {
    return Pe(
      t,
      "iterate",
      F(t) ? "length" : wt
    ), Reflect.ownKeys(t);
  }
}
class us extends qr {
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
const fs = /* @__PURE__ */ new Gr(), ds = /* @__PURE__ */ new us(), ps = /* @__PURE__ */ new Gr(!0);
const oi = (e) => e, hn = (e) => Reflect.getPrototypeOf(e);
function gs(e, t, n) {
  return function(...i) {
    const r = this.__v_raw, o = /* @__PURE__ */ X(r), s = Dt(o), l = e === "entries" || e === Symbol.iterator && s, a = e === "keys" && s, d = r[e](...i), c = n ? oi : t ? Vt : Ke;
    return !t && Pe(
      o,
      "iterate",
      a ? ri : wt
    ), me(
      // inheriting all iterator properties
      Object.create(d),
      {
        // iterator protocol
        next() {
          const { value: g, done: x } = d.next();
          return x ? { value: g, done: x } : {
            value: l ? [c(g[0]), c(g[1])] : c(g),
            done: x
          };
        }
      }
    );
  };
}
function vn(e) {
  return function(...t) {
    return e === "delete" ? !1 : e === "clear" ? void 0 : this;
  };
}
function hs(e, t) {
  const n = {
    get(r) {
      const o = this.__v_raw, s = /* @__PURE__ */ X(o), l = /* @__PURE__ */ X(r);
      e || (Xe(r, l) && Pe(s, "get", r), Pe(s, "get", l));
      const { has: a } = hn(s), d = t ? oi : e ? Vt : Ke;
      if (a.call(s, r))
        return d(o.get(r));
      if (a.call(s, l))
        return d(o.get(l));
      o !== s && o.get(r);
    },
    get size() {
      const r = this.__v_raw;
      return !e && Pe(/* @__PURE__ */ X(r), "iterate", wt), r.size;
    },
    has(r) {
      const o = this.__v_raw, s = /* @__PURE__ */ X(o), l = /* @__PURE__ */ X(r);
      return e || (Xe(r, l) && Pe(s, "has", r), Pe(s, "has", l)), r === l ? o.has(r) : o.has(r) || o.has(l);
    },
    forEach(r, o) {
      const s = this, l = s.__v_raw, a = /* @__PURE__ */ X(l), d = t ? oi : e ? Vt : Ke;
      return !e && Pe(a, "iterate", wt), l.forEach((c, g) => r.call(o, d(c), d(g), s));
    }
  };
  return me(
    n,
    e ? {
      add: vn("add"),
      set: vn("set"),
      delete: vn("delete"),
      clear: vn("clear")
    } : {
      add(r) {
        const o = /* @__PURE__ */ X(this), s = hn(o), l = /* @__PURE__ */ X(r), a = !t && !/* @__PURE__ */ Ne(r) && !/* @__PURE__ */ ut(r) ? l : r;
        return s.has.call(o, a) || Xe(r, a) && s.has.call(o, r) || Xe(l, a) && s.has.call(o, l) || (o.add(a), st(o, "add", a, a)), this;
      },
      set(r, o) {
        !t && !/* @__PURE__ */ Ne(o) && !/* @__PURE__ */ ut(o) && (o = /* @__PURE__ */ X(o));
        const s = /* @__PURE__ */ X(this), { has: l, get: a } = hn(s);
        let d = l.call(s, r);
        d || (r = /* @__PURE__ */ X(r), d = l.call(s, r));
        const c = a.call(s, r);
        return s.set(r, o), d ? Xe(o, c) && st(s, "set", r, o) : st(s, "add", r, o), this;
      },
      delete(r) {
        const o = /* @__PURE__ */ X(this), { has: s, get: l } = hn(o);
        let a = s.call(o, r);
        a || (r = /* @__PURE__ */ X(r), a = s.call(o, r)), l && l.call(o, r);
        const d = o.delete(r);
        return a && st(o, "delete", r, void 0), d;
      },
      clear() {
        const r = /* @__PURE__ */ X(this), o = r.size !== 0, s = r.clear();
        return o && st(
          r,
          "clear",
          void 0,
          void 0
        ), s;
      }
    }
  ), [
    "keys",
    "values",
    "entries",
    Symbol.iterator
  ].forEach((r) => {
    n[r] = gs(r, e, t);
  }), n;
}
function Ti(e, t) {
  const n = hs(e, t);
  return (i, r, o) => r === "__v_isReactive" ? !e : r === "__v_isReadonly" ? e : r === "__v_raw" ? i : Reflect.get(
    Z(n, r) && r in i ? n : i,
    r,
    o
  );
}
const vs = {
  get: /* @__PURE__ */ Ti(!1, !1)
}, ms = {
  get: /* @__PURE__ */ Ti(!1, !0)
}, ys = {
  get: /* @__PURE__ */ Ti(!0, !1)
};
const Jr = /* @__PURE__ */ new WeakMap(), zr = /* @__PURE__ */ new WeakMap(), Yr = /* @__PURE__ */ new WeakMap(), _s = /* @__PURE__ */ new WeakMap();
function bs(e) {
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
function Ss(e) {
  return e.__v_skip || !Object.isExtensible(e) ? 0 : bs(Wo(e));
}
// @__NO_SIDE_EFFECTS__
function Ai(e) {
  return /* @__PURE__ */ ut(e) ? e : Ii(
    e,
    !1,
    fs,
    vs,
    Jr
  );
}
// @__NO_SIDE_EFFECTS__
function xs(e) {
  return Ii(
    e,
    !1,
    ps,
    ms,
    zr
  );
}
// @__NO_SIDE_EFFECTS__
function si(e) {
  return Ii(
    e,
    !0,
    ds,
    ys,
    Yr
  );
}
function Ii(e, t, n, i, r) {
  if (!ee(e) || e.__v_raw && !(t && e.__v_isReactive))
    return e;
  const o = Ss(e);
  if (o === 0)
    return e;
  const s = r.get(e);
  if (s)
    return s;
  const l = new Proxy(
    e,
    o === 2 ? i : n
  );
  return r.set(e, l), l;
}
// @__NO_SIDE_EFFECTS__
function Tt(e) {
  return /* @__PURE__ */ ut(e) ? /* @__PURE__ */ Tt(e.__v_raw) : !!(e && e.__v_isReactive);
}
// @__NO_SIDE_EFFECTS__
function ut(e) {
  return !!(e && e.__v_isReadonly);
}
// @__NO_SIDE_EFFECTS__
function Ne(e) {
  return !!(e && e.__v_isShallow);
}
// @__NO_SIDE_EFFECTS__
function Mi(e) {
  return e ? !!e.__v_raw : !1;
}
// @__NO_SIDE_EFFECTS__
function X(e) {
  const t = e && e.__v_raw;
  return t ? /* @__PURE__ */ X(t) : e;
}
function Ps(e) {
  return !Z(e, "__v_skip") && Object.isExtensible(e) && Lr(e, "__v_skip", !0), e;
}
const Ke = (e) => ee(e) ? /* @__PURE__ */ Ai(e) : e, Vt = (e) => ee(e) ? /* @__PURE__ */ si(e) : e;
// @__NO_SIDE_EFFECTS__
function Ce(e) {
  return e ? e.__v_isRef === !0 : !1;
}
// @__NO_SIDE_EFFECTS__
function Et(e) {
  return Cs(e, !1);
}
function Cs(e, t) {
  return /* @__PURE__ */ Ce(e) ? e : new ws(e, t);
}
class ws {
  constructor(t, n) {
    this.dep = new wi(), this.__v_isRef = !0, this.__v_isShallow = !1, this._rawValue = n ? t : /* @__PURE__ */ X(t), this._value = n ? t : Ke(t), this.__v_isShallow = n;
  }
  get value() {
    return this.dep.track(), this._value;
  }
  set value(t) {
    const n = this._rawValue, i = this.__v_isShallow || /* @__PURE__ */ Ne(t) || /* @__PURE__ */ ut(t);
    t = i ? t : /* @__PURE__ */ X(t), Xe(t, n) && (this._rawValue = t, this._value = i ? t : Ke(t), this.dep.trigger());
  }
}
function Ts(e) {
  return /* @__PURE__ */ Ce(e) ? e.value : e;
}
const As = {
  get: (e, t, n) => t === "__v_raw" ? e : Ts(Reflect.get(e, t, n)),
  set: (e, t, n, i) => {
    const r = e[t];
    return /* @__PURE__ */ Ce(r) && !/* @__PURE__ */ Ce(n) ? (r.value = n, !0) : Reflect.set(e, t, n, i);
  }
};
function Xr(e) {
  return /* @__PURE__ */ Tt(e) ? e : new Proxy(e, As);
}
class Is {
  constructor(t, n, i) {
    this.fn = t, this.setter = n, this._value = void 0, this.dep = new wi(this), this.__v_isRef = !0, this.deps = void 0, this.depsTail = void 0, this.flags = 16, this.globalVersion = tn - 1, this.next = void 0, this.effect = this, this.__v_isReadonly = !n, this.isSSR = i;
  }
  /**
   * @internal
   */
  notify() {
    if (this.flags |= 16, !(this.flags & 8) && // avoid infinite self recursion
    ae !== this)
      return $r(this, !0), !0;
  }
  get value() {
    const t = this.dep.track();
    return Hr(this), t && (t.version = this.dep.version), this._value;
  }
  set value(t) {
    this.setter && this.setter(t);
  }
}
// @__NO_SIDE_EFFECTS__
function Ms(e, t, n = !1) {
  let i, r;
  return B(e) ? i = e : (i = e.get, r = e.set), new Is(i, r, n);
}
const mn = {}, xn = /* @__PURE__ */ new WeakMap();
let Pt;
function Es(e, t = !1, n = Pt) {
  if (n) {
    let i = xn.get(n);
    i || xn.set(n, i = []), i.push(e);
  }
}
function Os(e, t, n = re) {
  const { immediate: i, deep: r, once: o, scheduler: s, augmentJob: l, call: a } = n, d = (E) => r ? E : /* @__PURE__ */ Ne(E) || r === !1 || r === 0 ? lt(E, 1) : lt(E);
  let c, g, x, I, K = !1, L = !1;
  if (/* @__PURE__ */ Ce(e) ? (g = () => e.value, K = /* @__PURE__ */ Ne(e)) : /* @__PURE__ */ Tt(e) ? (g = () => d(e), K = !0) : F(e) ? (L = !0, K = e.some((E) => /* @__PURE__ */ Tt(E) || /* @__PURE__ */ Ne(E)), g = () => e.map((E) => {
    if (/* @__PURE__ */ Ce(E))
      return E.value;
    if (/* @__PURE__ */ Tt(E))
      return d(E);
    if (B(E))
      return a ? a(E, 2) : E();
  })) : B(e) ? t ? g = a ? () => a(e, 2) : e : g = () => {
    if (x) {
      at();
      try {
        x();
      } finally {
        ct();
      }
    }
    const E = Pt;
    Pt = c;
    try {
      return a ? a(e, 3, [I]) : e(I);
    } finally {
      Pt = E;
    }
  } : g = Qe, t && r) {
    const E = g, W = r === !0 ? 1 / 0 : r;
    g = () => lt(E(), W);
  }
  const se = is(), Y = () => {
    c.stop(), se && se.active && mi(se.effects, c);
  };
  if (o && t) {
    const E = t;
    t = (...W) => {
      E(...W), Y();
    };
  }
  let N = L ? new Array(e.length).fill(mn) : mn;
  const J = (E) => {
    if (!(!(c.flags & 1) || !c.dirty && !E))
      if (t) {
        const W = c.run();
        if (r || K || (L ? W.some((ue, ye) => Xe(ue, N[ye])) : Xe(W, N))) {
          x && x();
          const ue = Pt;
          Pt = c;
          try {
            const ye = [
              W,
              // pass undefined as the old value when it's changed for the first time
              N === mn ? void 0 : L && N[0] === mn ? [] : N,
              I
            ];
            N = W, a ? a(t, 3, ye) : (
              // @ts-expect-error
              t(...ye)
            );
          } finally {
            Pt = ue;
          }
        }
      } else
        c.run();
  };
  return l && l(J), c = new Vr(g), c.scheduler = s ? () => s(J, !1) : J, I = (E) => Es(E, !1, c), x = c.onStop = () => {
    const E = xn.get(c);
    if (E) {
      if (a)
        a(E, 4);
      else
        for (const W of E) W();
      xn.delete(c);
    }
  }, t ? i ? J(!0) : N = c.run() : s ? s(J.bind(null, !0), !0) : c.run(), Y.pause = c.pause.bind(c), Y.resume = c.resume.bind(c), Y.stop = Y, Y;
}
function lt(e, t = 1 / 0, n) {
  if (t <= 0 || !ee(e) || e.__v_skip || (n = n || /* @__PURE__ */ new Map(), (n.get(e) || 0) >= t))
    return e;
  if (n.set(e, t), t--, /* @__PURE__ */ Ce(e))
    lt(e.value, t, n);
  else if (F(e))
    for (let i = 0; i < e.length; i++)
      lt(e[i], t, n);
  else if (Ir(e) || Dt(e))
    e.forEach((i) => {
      lt(i, t, n);
    });
  else if (Or(e)) {
    for (const i in e)
      lt(e[i], t, n);
    for (const i of Object.getOwnPropertySymbols(e))
      Object.prototype.propertyIsEnumerable.call(e, i) && lt(e[i], t, n);
  }
  return e;
}
function fn(e, t, n, i) {
  try {
    return i ? e(...i) : e();
  } catch (r) {
    Fn(r, t, n);
  }
}
function He(e, t, n, i) {
  if (B(e)) {
    const r = fn(e, t, n, i);
    return r && Mr(r) && r.catch((o) => {
      Fn(o, t, n);
    }), r;
  }
  if (F(e)) {
    const r = [];
    for (let o = 0; o < e.length; o++)
      r.push(He(e[o], t, n, i));
    return r;
  }
}
function Fn(e, t, n, i = !0) {
  const r = t ? t.vnode : null, { errorHandler: o, throwUnhandledErrorInProduction: s } = t && t.appContext.config || re;
  if (t) {
    let l = t.parent;
    const a = t.proxy, d = `https://vuejs.org/error-reference/#runtime-${n}`;
    for (; l; ) {
      const c = l.ec;
      if (c) {
        for (let g = 0; g < c.length; g++)
          if (c[g](e, a, d) === !1)
            return;
      }
      l = l.parent;
    }
    if (o) {
      at(), fn(o, null, 10, [
        e,
        a,
        d
      ]), ct();
      return;
    }
  }
  ks(e, n, r, i, s);
}
function ks(e, t, n, i = !0, r = !1) {
  if (r)
    throw e;
  console.error(e);
}
const Te = [];
let Ge = -1;
const Ft = [];
let pt = null, Ot = 0;
const Qr = /* @__PURE__ */ Promise.resolve();
let Pn = null;
function Ls(e) {
  const t = Pn || Qr;
  return e ? t.then(this ? e.bind(this) : e) : t;
}
function Ds(e) {
  let t = Ge + 1, n = Te.length;
  for (; t < n; ) {
    const i = t + n >>> 1, r = Te[i], o = rn(r);
    o < e || o === e && r.flags & 2 ? t = i + 1 : n = i;
  }
  return t;
}
function Ei(e) {
  if (!(e.flags & 1)) {
    const t = rn(e), n = Te[Te.length - 1];
    !n || // fast path when the job id is larger than the tail
    !(e.flags & 2) && t >= rn(n) ? Te.push(e) : Te.splice(Ds(t), 0, e), e.flags |= 1, Zr();
  }
}
function Zr() {
  Pn || (Pn = Qr.then(to));
}
function Fs(e) {
  F(e) ? Ft.push(...e) : pt && e.id === -1 ? pt.splice(Ot + 1, 0, e) : e.flags & 1 || (Ft.push(e), e.flags |= 1), Zr();
}
function Wi(e, t, n = Ge + 1) {
  for (; n < Te.length; n++) {
    const i = Te[n];
    if (i && i.flags & 2) {
      if (e && i.id !== e.uid)
        continue;
      Te.splice(n, 1), n--, i.flags & 4 && (i.flags &= -2), i(), i.flags & 4 || (i.flags &= -2);
    }
  }
}
function eo(e) {
  if (Ft.length) {
    const t = [...new Set(Ft)].sort(
      (n, i) => rn(n) - rn(i)
    );
    if (Ft.length = 0, pt) {
      pt.push(...t);
      return;
    }
    for (pt = t, Ot = 0; Ot < pt.length; Ot++) {
      const n = pt[Ot];
      n.flags & 4 && (n.flags &= -2), n.flags & 8 || n(), n.flags &= -2;
    }
    pt = null, Ot = 0;
  }
}
const rn = (e) => e.id == null ? e.flags & 2 ? -1 : 1 / 0 : e.id;
function to(e) {
  try {
    for (Ge = 0; Ge < Te.length; Ge++) {
      const t = Te[Ge];
      t && !(t.flags & 8) && (t.flags & 4 && (t.flags &= -2), fn(
        t,
        t.i,
        t.i ? 15 : 14
      ), t.flags & 4 || (t.flags &= -2));
    }
  } finally {
    for (; Ge < Te.length; Ge++) {
      const t = Te[Ge];
      t && (t.flags &= -2);
    }
    Ge = -1, Te.length = 0, eo(), Pn = null, (Te.length || Ft.length) && to();
  }
}
let Ve = null, no = null;
function Cn(e) {
  const t = Ve;
  return Ve = e, no = e && e.type.__scopeId || null, t;
}
function li(e, t = Ve, n) {
  if (!t || e._n)
    return e;
  const i = (...r) => {
    i._d && An(-1);
    const o = Cn(t);
    let s;
    try {
      s = e(...r);
    } finally {
      Cn(o), i._d && An(1);
    }
    return s;
  };
  return i._n = !0, i._c = !0, i._d = !0, i;
}
function Rs(e, t) {
  if (Ve === null)
    return e;
  const n = Bn(Ve), i = e.dirs || (e.dirs = []);
  for (let r = 0; r < t.length; r++) {
    let [o, s, l, a = re] = t[r];
    o && (B(o) && (o = {
      mounted: o,
      updated: o
    }), o.deep && lt(s), i.push({
      dir: o,
      instance: n,
      value: s,
      oldValue: void 0,
      arg: l,
      modifiers: a
    }));
  }
  return e;
}
function mt(e, t, n, i) {
  const r = e.dirs, o = t && t.dirs;
  for (let s = 0; s < r.length; s++) {
    const l = r[s];
    o && (l.oldValue = o[s].value);
    let a = l.dir[i];
    a && (at(), He(a, n, 8, [
      e.el,
      l,
      e,
      t
    ]), ct());
  }
}
function Vs(e, t) {
  if (Ie) {
    let n = Ie.provides;
    const i = Ie.parent && Ie.parent.provides;
    i === n && (n = Ie.provides = Object.create(i)), n[e] = t;
  }
}
function _n(e, t, n = !1) {
  const i = Do();
  if (i || Rt) {
    let r = Rt ? Rt._context.provides : i ? i.parent == null || i.ce ? i.vnode.appContext && i.vnode.appContext.provides : i.parent.provides : void 0;
    if (r && e in r)
      return r[e];
    if (arguments.length > 1)
      return n && B(t) ? t.call(i && i.proxy) : t;
  }
}
const Ns = /* @__PURE__ */ Symbol.for("v-scx"), $s = () => _n(Ns);
function bn(e, t, n) {
  return io(e, t, n);
}
function io(e, t, n = re) {
  const { immediate: i, deep: r, flush: o, once: s } = n, l = me({}, n), a = t && i || !t && o !== "post";
  let d;
  if (ln) {
    if (o === "sync") {
      const I = $s();
      d = I.__watcherHandles || (I.__watcherHandles = []);
    } else if (!a) {
      const I = () => {
      };
      return I.stop = Qe, I.resume = Qe, I.pause = Qe, I;
    }
  }
  const c = Ie;
  l.call = (I, K, L) => He(I, c, K, L);
  let g = !1;
  o === "post" ? l.scheduler = (I) => {
    Ee(I, c && c.suspense);
  } : o !== "sync" && (g = !0, l.scheduler = (I, K) => {
    K ? I() : Ei(I);
  }), l.augmentJob = (I) => {
    t && (I.flags |= 4), g && (I.flags |= 2, c && (I.id = c.uid, I.i = c));
  };
  const x = Os(e, t, l);
  return ln && (d ? d.push(x) : a && x()), x;
}
function Bs(e, t, n) {
  const i = this.proxy, r = fe(e) ? e.includes(".") ? ro(i, e) : () => i[e] : e.bind(i, i);
  let o;
  B(t) ? o = t : (o = t.handler, n = t);
  const s = dn(this), l = io(r, o.bind(i), n);
  return s(), l;
}
function ro(e, t) {
  const n = t.split(".");
  return () => {
    let i = e;
    for (let r = 0; r < n.length && i; r++)
      i = i[n[r]];
    return i;
  };
}
const Ks = /* @__PURE__ */ Symbol("_vte"), oo = (e) => e.__isTeleport, Je = /* @__PURE__ */ Symbol("_leaveCb"), Ut = /* @__PURE__ */ Symbol("_enterCb");
function Hs() {
  const e = {
    isMounted: !1,
    isLeaving: !1,
    isUnmounting: !1,
    leavingVNodes: /* @__PURE__ */ new Map()
  };
  return Oi(() => {
    e.isMounted = !0;
  }), ki(() => {
    e.isUnmounting = !0;
  }), e;
}
const Re = [Function, Array], so = {
  mode: String,
  appear: Boolean,
  persisted: Boolean,
  // enter
  onBeforeEnter: Re,
  onEnter: Re,
  onAfterEnter: Re,
  onEnterCancelled: Re,
  // leave
  onBeforeLeave: Re,
  onLeave: Re,
  onAfterLeave: Re,
  onLeaveCancelled: Re,
  // appear
  onBeforeAppear: Re,
  onAppear: Re,
  onAfterAppear: Re,
  onAppearCancelled: Re
}, lo = (e) => {
  const t = e.subTree;
  return t.component ? lo(t.component) : t;
}, js = {
  name: "BaseTransition",
  props: so,
  setup(e, { slots: t }) {
    const n = Do(), i = Hs();
    return () => {
      const r = t.default && uo(t.default(), !0), o = r && r.length ? ao(r) : (
        // Keep explicit default-slot conditionals on the same transition path
        // as regular v-if branches, which render a comment placeholder.
        n.subTree ? he() : void 0
      );
      if (!o)
        return;
      const s = /* @__PURE__ */ X(e), { mode: l } = s;
      if (i.isLeaving)
        return Gn(o);
      const a = qi(o);
      if (!a)
        return Gn(o);
      let d = ai(
        a,
        s,
        i,
        n,
        // #11061, ensure enterHooks is fresh after clone
        (g) => d = g
      );
      a.type !== Ae && on(a, d);
      let c = n.subTree && qi(n.subTree);
      if (c && c.type !== Ae && !Ct(c, a) && lo(n).type !== Ae) {
        let g = ai(
          c,
          s,
          i,
          n
        );
        if (on(c, g), l === "out-in" && a.type !== Ae)
          return i.isLeaving = !0, g.afterLeave = () => {
            i.isLeaving = !1, n.job.flags & 8 || n.update(), delete g.afterLeave, c = void 0;
          }, Gn(o);
        l === "in-out" && a.type !== Ae ? g.delayLeave = (x, I, K) => {
          const L = co(
            i,
            c
          );
          L[String(c.key)] = c, x[Je] = () => {
            I(), x[Je] = void 0, delete d.delayedLeave, c = void 0;
          }, d.delayedLeave = () => {
            K(), delete d.delayedLeave, c = void 0;
          };
        } : c = void 0;
      } else c && (c = void 0);
      return o;
    };
  }
};
function ao(e) {
  let t = e[0];
  if (e.length > 1) {
    for (const n of e)
      if (n.type !== Ae) {
        t = n;
        break;
      }
  }
  return t;
}
const Us = js;
function co(e, t) {
  const { leavingVNodes: n } = e;
  let i = n.get(t.type);
  return i || (i = /* @__PURE__ */ Object.create(null), n.set(t.type, i)), i;
}
function ai(e, t, n, i, r) {
  const {
    appear: o,
    mode: s,
    persisted: l = !1,
    onBeforeEnter: a,
    onEnter: d,
    onAfterEnter: c,
    onEnterCancelled: g,
    onBeforeLeave: x,
    onLeave: I,
    onAfterLeave: K,
    onLeaveCancelled: L,
    onBeforeAppear: se,
    onAppear: Y,
    onAfterAppear: N,
    onAppearCancelled: J
  } = t, E = String(e.key), W = co(n, e), ue = ($, Q) => {
    $ && He(
      $,
      i,
      9,
      Q
    );
  }, ye = ($, Q) => {
    const ce = Q[1];
    ue($, Q), F($) ? $.every((T) => T.length <= 1) && ce() : $.length <= 1 && ce();
  }, ve = {
    mode: s,
    persisted: l,
    beforeEnter($) {
      let Q = a;
      if (!n.isMounted)
        if (o)
          Q = se || a;
        else
          return;
      $[Je] && $[Je](
        !0
        /* cancelled */
      );
      const ce = W[E];
      ce && Ct(e, ce) && ce.el[Je] && ce.el[Je](), ue(Q, [$]);
    },
    enter($) {
      if (W[E] === e) return;
      let Q = d, ce = c, T = g;
      if (!n.isMounted)
        if (o)
          Q = Y || d, ce = N || c, T = J || g;
        else
          return;
      let te = !1;
      $[Ut] = (xe) => {
        te || (te = !0, xe ? ue(T, [$]) : ue(ce, [$]), ve.delayedLeave && ve.delayedLeave(), $[Ut] = void 0);
      };
      const de = $[Ut].bind(null, !1);
      Q ? ye(Q, [$, de]) : de();
    },
    leave($, Q) {
      const ce = String(e.key);
      if ($[Ut] && $[Ut](
        !0
        /* cancelled */
      ), n.isUnmounting)
        return Q();
      ue(x, [$]);
      let T = !1;
      $[Je] = (de) => {
        T || (T = !0, Q(), de ? ue(L, [$]) : ue(K, [$]), $[Je] = void 0, W[ce] === e && delete W[ce]);
      };
      const te = $[Je].bind(null, !1);
      W[ce] = e, I ? ye(I, [$, te]) : te();
    },
    clone($) {
      const Q = ai(
        $,
        t,
        n,
        i,
        r
      );
      return r && r(Q), Q;
    }
  };
  return ve;
}
function Gn(e) {
  if (Rn(e))
    return e = gt(e), e.children = null, e;
}
function qi(e) {
  if (!Rn(e))
    return oo(e.type) && e.children ? ao(e.children) : e;
  if (e.component)
    return e.component.subTree;
  const { shapeFlag: t, children: n } = e;
  if (n) {
    if (t & 16)
      return n[0];
    if (t & 32 && B(n.default))
      return n.default();
  }
}
function on(e, t) {
  e.shapeFlag & 6 && e.component ? (e.transition = t, on(e.component.subTree, t)) : e.shapeFlag & 128 ? (e.ssContent.transition = t.clone(e.ssContent), e.ssFallback.transition = t.clone(e.ssFallback)) : e.transition = t;
}
function uo(e, t = !1, n) {
  let i = [], r = 0;
  for (let o = 0; o < e.length; o++) {
    let s = e[o];
    const l = n == null ? s.key : String(n) + String(s.key != null ? s.key : o);
    s.type === Se ? (s.patchFlag & 128 && r++, i = i.concat(
      uo(s.children, t, l)
    )) : (t || s.type !== Ae) && i.push(l != null ? gt(s, { key: l }) : s);
  }
  if (r > 1)
    for (let o = 0; o < i.length; o++)
      i[o].patchFlag = -2;
  return i;
}
function fo(e) {
  e.ids = [e.ids[0] + e.ids[2]++ + "-", 0, 0];
}
function Gi(e, t) {
  let n;
  return !!((n = Object.getOwnPropertyDescriptor(e, t)) && !n.configurable);
}
const wn = /* @__PURE__ */ new WeakMap();
function Xt(e, t, n, i, r = !1) {
  if (F(e)) {
    e.forEach(
      (L, se) => Xt(
        L,
        t && (F(t) ? t[se] : t),
        n,
        i,
        r
      )
    );
    return;
  }
  if (Qt(i) && !r) {
    i.shapeFlag & 512 && i.type.__asyncResolved && i.component.subTree.component && Xt(e, t, n, i.component.subTree);
    return;
  }
  const o = i.shapeFlag & 4 ? Bn(i.component) : i.el, s = r ? null : o, { i: l, r: a } = e, d = t && t.r, c = l.refs === re ? l.refs = {} : l.refs, g = l.setupState, x = /* @__PURE__ */ X(g), I = g === re ? Ar : (L) => Gi(c, L) ? !1 : Z(x, L), K = (L, se) => !(se && Gi(c, se));
  if (d != null && d !== a) {
    if (Ji(t), fe(d))
      c[d] = null, I(d) && (g[d] = null);
    else if (/* @__PURE__ */ Ce(d)) {
      const L = t;
      K(d, L.k) && (d.value = null), L.k && (c[L.k] = null);
    }
  }
  if (B(a))
    fn(a, l, 12, [s, c]);
  else {
    const L = fe(a), se = /* @__PURE__ */ Ce(a);
    if (L || se) {
      const Y = () => {
        if (e.f) {
          const N = L ? I(a) ? g[a] : c[a] : K() || !e.k ? a.value : c[e.k];
          if (r)
            F(N) && mi(N, o);
          else if (F(N))
            N.includes(o) || N.push(o);
          else if (L)
            c[a] = [o], I(a) && (g[a] = c[a]);
          else {
            const J = [o];
            K(a, e.k) && (a.value = J), e.k && (c[e.k] = J);
          }
        } else L ? (c[a] = s, I(a) && (g[a] = s)) : se && (K(a, e.k) && (a.value = s), e.k && (c[e.k] = s));
      };
      if (s) {
        const N = () => {
          Y(), wn.delete(e);
        };
        N.id = -1, wn.set(e, N), Ee(N, n);
      } else
        Ji(e), Y();
    }
  }
}
function Ji(e) {
  const t = wn.get(e);
  t && (t.flags |= 8, wn.delete(e));
}
Ln().requestIdleCallback;
Ln().cancelIdleCallback;
const Qt = (e) => !!e.type.__asyncLoader, Rn = (e) => e.type.__isKeepAlive;
function Ws(e, t) {
  po(e, "a", t);
}
function qs(e, t) {
  po(e, "da", t);
}
function po(e, t, n = Ie) {
  const i = e.__wdc || (e.__wdc = () => {
    let r = n;
    for (; r; ) {
      if (r.isDeactivated)
        return;
      r = r.parent;
    }
    return e();
  });
  if (Vn(t, i, n), n) {
    let r = n.parent;
    for (; r && r.parent; )
      Rn(r.parent.vnode) && Gs(i, t, n, r), r = r.parent;
  }
}
function Gs(e, t, n, i) {
  const r = Vn(
    t,
    e,
    i,
    !0
    /* prepend */
  );
  go(() => {
    mi(i[t], r);
  }, n);
}
function Vn(e, t, n = Ie, i = !1) {
  if (n) {
    const r = n[e] || (n[e] = []), o = t.__weh || (t.__weh = (...s) => {
      at();
      const l = dn(n), a = He(t, n, e, s);
      return l(), ct(), a;
    });
    return i ? r.unshift(o) : r.push(o), o;
  }
}
const ft = (e) => (t, n = Ie) => {
  (!ln || e === "sp") && Vn(e, (...i) => t(...i), n);
}, Js = ft("bm"), Oi = ft("m"), zs = ft(
  "bu"
), Ys = ft("u"), ki = ft(
  "bum"
), go = ft("um"), Xs = ft(
  "sp"
), Qs = ft("rtg"), Zs = ft("rtc");
function el(e, t = Ie) {
  Vn("ec", e, t);
}
const tl = /* @__PURE__ */ Symbol.for("v-ndc");
function yt(e, t, n, i) {
  let r;
  const o = n, s = F(e);
  if (s || fe(e)) {
    const l = s && /* @__PURE__ */ Tt(e);
    let a = !1, d = !1;
    l && (a = !/* @__PURE__ */ Ne(e), d = /* @__PURE__ */ ut(e), e = Dn(e)), r = new Array(e.length);
    for (let c = 0, g = e.length; c < g; c++)
      r[c] = t(
        a ? d ? Vt(Ke(e[c])) : Ke(e[c]) : e[c],
        c,
        void 0,
        o
      );
  } else if (typeof e == "number") {
    r = new Array(e);
    for (let l = 0; l < e; l++)
      r[l] = t(l + 1, l, void 0, o);
  } else if (ee(e))
    if (e[Symbol.iterator])
      r = Array.from(
        e,
        (l, a) => t(l, a, void 0, o)
      );
    else {
      const l = Object.keys(e);
      r = new Array(l.length);
      for (let a = 0, d = l.length; a < d; a++) {
        const c = l[a];
        r[a] = t(e[c], c, a, o);
      }
    }
  else
    r = [];
  return r;
}
const ci = (e) => e ? Fo(e) ? Bn(e) : ci(e.parent) : null, Zt = (
  // Move PURE marker to new line to workaround compiler discarding it
  // due to type annotation
  /* @__PURE__ */ me(/* @__PURE__ */ Object.create(null), {
    $: (e) => e,
    $el: (e) => e.vnode.el,
    $data: (e) => e.data,
    $props: (e) => e.props,
    $attrs: (e) => e.attrs,
    $slots: (e) => e.slots,
    $refs: (e) => e.refs,
    $parent: (e) => ci(e.parent),
    $root: (e) => ci(e.root),
    $host: (e) => e.ce,
    $emit: (e) => e.emit,
    $options: (e) => vo(e),
    $forceUpdate: (e) => e.f || (e.f = () => {
      Ei(e.update);
    }),
    $nextTick: (e) => e.n || (e.n = Ls.bind(e.proxy)),
    $watch: (e) => Bs.bind(e)
  })
), Jn = (e, t) => e !== re && !e.__isScriptSetup && Z(e, t), nl = {
  get({ _: e }, t) {
    if (t === "__v_skip")
      return !0;
    const { ctx: n, setupState: i, data: r, props: o, accessCache: s, type: l, appContext: a } = e;
    if (t[0] !== "$") {
      const x = s[t];
      if (x !== void 0)
        switch (x) {
          case 1:
            return i[t];
          case 2:
            return r[t];
          case 4:
            return n[t];
          case 3:
            return o[t];
        }
      else {
        if (Jn(i, t))
          return s[t] = 1, i[t];
        if (r !== re && Z(r, t))
          return s[t] = 2, r[t];
        if (Z(o, t))
          return s[t] = 3, o[t];
        if (n !== re && Z(n, t))
          return s[t] = 4, n[t];
        ui && (s[t] = 0);
      }
    }
    const d = Zt[t];
    let c, g;
    if (d)
      return t === "$attrs" && Pe(e.attrs, "get", ""), d(e);
    if (
      // css module (injected by vue-loader)
      (c = l.__cssModules) && (c = c[t])
    )
      return c;
    if (n !== re && Z(n, t))
      return s[t] = 4, n[t];
    if (
      // global properties
      g = a.config.globalProperties, Z(g, t)
    )
      return g[t];
  },
  set({ _: e }, t, n) {
    const { data: i, setupState: r, ctx: o } = e;
    return Jn(r, t) ? (r[t] = n, !0) : i !== re && Z(i, t) ? (i[t] = n, !0) : Z(e.props, t) || t[0] === "$" && t.slice(1) in e ? !1 : (o[t] = n, !0);
  },
  has({
    _: { data: e, setupState: t, accessCache: n, ctx: i, appContext: r, props: o, type: s }
  }, l) {
    let a;
    return !!(n[l] || e !== re && l[0] !== "$" && Z(e, l) || Jn(t, l) || Z(o, l) || Z(i, l) || Z(Zt, l) || Z(r.config.globalProperties, l) || (a = s.__cssModules) && a[l]);
  },
  defineProperty(e, t, n) {
    return n.get != null ? e._.accessCache[t] = 0 : Z(n, "value") && this.set(e, t, n.value, null), Reflect.defineProperty(e, t, n);
  }
};
function zi(e) {
  return F(e) ? e.reduce(
    (t, n) => (t[n] = null, t),
    {}
  ) : e;
}
let ui = !0;
function il(e) {
  const t = vo(e), n = e.proxy, i = e.ctx;
  ui = !1, t.beforeCreate && Yi(t.beforeCreate, e, "bc");
  const {
    // state
    data: r,
    computed: o,
    methods: s,
    watch: l,
    provide: a,
    inject: d,
    // lifecycle
    created: c,
    beforeMount: g,
    mounted: x,
    beforeUpdate: I,
    updated: K,
    activated: L,
    deactivated: se,
    beforeDestroy: Y,
    beforeUnmount: N,
    destroyed: J,
    unmounted: E,
    render: W,
    renderTracked: ue,
    renderTriggered: ye,
    errorCaptured: ve,
    serverPrefetch: $,
    // public API
    expose: Q,
    inheritAttrs: ce,
    // assets
    components: T,
    directives: te,
    filters: de
  } = t;
  if (d && rl(d, i, null), s)
    for (const ne in s) {
      const G = s[ne];
      B(G) && (i[ne] = G.bind(n));
    }
  if (r) {
    const ne = r.call(n, n);
    ee(ne) && (e.data = /* @__PURE__ */ Ai(ne));
  }
  if (ui = !0, o)
    for (const ne in o) {
      const G = o[ne], et = B(G) ? G.bind(n, n) : B(G.get) ? G.get.bind(n, n) : Qe, ke = !B(G) && B(G.set) ? G.set.bind(n) : Qe, tt = De({
        get: et,
        set: ke
      });
      Object.defineProperty(i, ne, {
        enumerable: !0,
        configurable: !0,
        get: () => tt.value,
        set: (M) => tt.value = M
      });
    }
  if (l)
    for (const ne in l)
      ho(l[ne], i, n, ne);
  if (a) {
    const ne = B(a) ? a.call(n) : a;
    Reflect.ownKeys(ne).forEach((G) => {
      Vs(G, ne[G]);
    });
  }
  c && Yi(c, e, "c");
  function pe(ne, G) {
    F(G) ? G.forEach((et) => ne(et.bind(n))) : G && ne(G.bind(n));
  }
  if (pe(Js, g), pe(Oi, x), pe(zs, I), pe(Ys, K), pe(Ws, L), pe(qs, se), pe(el, ve), pe(Zs, ue), pe(Qs, ye), pe(ki, N), pe(go, E), pe(Xs, $), F(Q))
    if (Q.length) {
      const ne = e.exposed || (e.exposed = {});
      Q.forEach((G) => {
        Object.defineProperty(ne, G, {
          get: () => n[G],
          set: (et) => n[G] = et,
          enumerable: !0
        });
      });
    } else e.exposed || (e.exposed = {});
  W && e.render === Qe && (e.render = W), ce != null && (e.inheritAttrs = ce), T && (e.components = T), te && (e.directives = te), $ && fo(e);
}
function rl(e, t, n = Qe) {
  F(e) && (e = fi(e));
  for (const i in e) {
    const r = e[i];
    let o;
    ee(r) ? "default" in r ? o = _n(
      r.from || i,
      r.default,
      !0
    ) : o = _n(r.from || i) : o = _n(r), /* @__PURE__ */ Ce(o) ? Object.defineProperty(t, i, {
      enumerable: !0,
      configurable: !0,
      get: () => o.value,
      set: (s) => o.value = s
    }) : t[i] = o;
  }
}
function Yi(e, t, n) {
  He(
    F(e) ? e.map((i) => i.bind(t.proxy)) : e.bind(t.proxy),
    t,
    n
  );
}
function ho(e, t, n, i) {
  let r = i.includes(".") ? ro(n, i) : () => n[i];
  if (fe(e)) {
    const o = t[e];
    B(o) && bn(r, o);
  } else if (B(e))
    bn(r, e.bind(n));
  else if (ee(e))
    if (F(e))
      e.forEach((o) => ho(o, t, n, i));
    else {
      const o = B(e.handler) ? e.handler.bind(n) : t[e.handler];
      B(o) && bn(r, o, e);
    }
}
function vo(e) {
  const t = e.type, { mixins: n, extends: i } = t, {
    mixins: r,
    optionsCache: o,
    config: { optionMergeStrategies: s }
  } = e.appContext, l = o.get(t);
  let a;
  return l ? a = l : !r.length && !n && !i ? a = t : (a = {}, r.length && r.forEach(
    (d) => Tn(a, d, s, !0)
  ), Tn(a, t, s)), ee(t) && o.set(t, a), a;
}
function Tn(e, t, n, i = !1) {
  const { mixins: r, extends: o } = t;
  o && Tn(e, o, n, !0), r && r.forEach(
    (s) => Tn(e, s, n, !0)
  );
  for (const s in t)
    if (!(i && s === "expose")) {
      const l = ol[s] || n && n[s];
      e[s] = l ? l(e[s], t[s]) : t[s];
    }
  return e;
}
const ol = {
  data: Xi,
  props: Qi,
  emits: Qi,
  // objects
  methods: qt,
  computed: qt,
  // lifecycle
  beforeCreate: we,
  created: we,
  beforeMount: we,
  mounted: we,
  beforeUpdate: we,
  updated: we,
  beforeDestroy: we,
  beforeUnmount: we,
  destroyed: we,
  unmounted: we,
  activated: we,
  deactivated: we,
  errorCaptured: we,
  serverPrefetch: we,
  // assets
  components: qt,
  directives: qt,
  // watch
  watch: ll,
  // provide / inject
  provide: Xi,
  inject: sl
};
function Xi(e, t) {
  return t ? e ? function() {
    return me(
      B(e) ? e.call(this, this) : e,
      B(t) ? t.call(this, this) : t
    );
  } : t : e;
}
function sl(e, t) {
  return qt(fi(e), fi(t));
}
function fi(e) {
  if (F(e)) {
    const t = {};
    for (let n = 0; n < e.length; n++)
      t[e[n]] = e[n];
    return t;
  }
  return e;
}
function we(e, t) {
  return e ? [...new Set([].concat(e, t))] : t;
}
function qt(e, t) {
  return e ? me(/* @__PURE__ */ Object.create(null), e, t) : t;
}
function Qi(e, t) {
  return e ? F(e) && F(t) ? [.../* @__PURE__ */ new Set([...e, ...t])] : me(
    /* @__PURE__ */ Object.create(null),
    zi(e),
    zi(t ?? {})
  ) : t;
}
function ll(e, t) {
  if (!e) return t;
  if (!t) return e;
  const n = me(/* @__PURE__ */ Object.create(null), e);
  for (const i in t)
    n[i] = we(e[i], t[i]);
  return n;
}
function mo() {
  return {
    app: null,
    config: {
      isNativeTag: Ar,
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
let al = 0;
function cl(e, t) {
  return function(i, r = null) {
    B(i) || (i = me({}, i)), r != null && !ee(r) && (r = null);
    const o = mo(), s = /* @__PURE__ */ new WeakSet(), l = [];
    let a = !1;
    const d = o.app = {
      _uid: al++,
      _component: i,
      _props: r,
      _container: null,
      _context: o,
      _instance: null,
      version: jl,
      get config() {
        return o.config;
      },
      set config(c) {
      },
      use(c, ...g) {
        return s.has(c) || (c && B(c.install) ? (s.add(c), c.install(d, ...g)) : B(c) && (s.add(c), c(d, ...g))), d;
      },
      mixin(c) {
        return o.mixins.includes(c) || o.mixins.push(c), d;
      },
      component(c, g) {
        return g ? (o.components[c] = g, d) : o.components[c];
      },
      directive(c, g) {
        return g ? (o.directives[c] = g, d) : o.directives[c];
      },
      mount(c, g, x) {
        if (!a) {
          const I = d._ceVNode || Me(i, r);
          return I.appContext = o, x === !0 ? x = "svg" : x === !1 && (x = void 0), e(I, c, x), a = !0, d._container = c, c.__vue_app__ = d, Bn(I.component);
        }
      },
      onUnmount(c) {
        l.push(c);
      },
      unmount() {
        a && (He(
          l,
          d._instance,
          16
        ), e(null, d._container), delete d._container.__vue_app__);
      },
      provide(c, g) {
        return o.provides[c] = g, d;
      },
      runWithContext(c) {
        const g = Rt;
        Rt = d;
        try {
          return c();
        } finally {
          Rt = g;
        }
      }
    };
    return d;
  };
}
let Rt = null;
const ul = (e, t) => t === "modelValue" || t === "model-value" ? e.modelModifiers : e[`${t}Modifiers`] || e[`${$e(t)}Modifiers`] || e[`${It(t)}Modifiers`];
function fl(e, t, ...n) {
  if (e.isUnmounted) return;
  const i = e.vnode.props || re;
  let r = n;
  const o = t.startsWith("update:"), s = o && ul(i, t.slice(7));
  s && (s.trim && (r = n.map((c) => fe(c) ? c.trim() : c)), s.number && (r = n.map(_i)));
  let l, a = i[l = Hn(t)] || // also try camelCase event handler (#2249)
  i[l = Hn($e(t))];
  !a && o && (a = i[l = Hn(It(t))]), a && He(
    a,
    e,
    6,
    r
  );
  const d = i[l + "Once"];
  if (d) {
    if (!e.emitted)
      e.emitted = {};
    else if (e.emitted[l])
      return;
    e.emitted[l] = !0, He(
      d,
      e,
      6,
      r
    );
  }
}
const dl = /* @__PURE__ */ new WeakMap();
function yo(e, t, n = !1) {
  const i = n ? dl : t.emitsCache, r = i.get(e);
  if (r !== void 0)
    return r;
  const o = e.emits;
  let s = {}, l = !1;
  if (!B(e)) {
    const a = (d) => {
      const c = yo(d, t, !0);
      c && (l = !0, me(s, c));
    };
    !n && t.mixins.length && t.mixins.forEach(a), e.extends && a(e.extends), e.mixins && e.mixins.forEach(a);
  }
  return !o && !l ? (ee(e) && i.set(e, null), null) : (F(o) ? o.forEach((a) => s[a] = null) : me(s, o), ee(e) && i.set(e, s), s);
}
function Nn(e, t) {
  return !e || !En(t) ? !1 : (t = t.slice(2).replace(/Once$/, ""), Z(e, t[0].toLowerCase() + t.slice(1)) || Z(e, It(t)) || Z(e, t));
}
function Zi(e) {
  const {
    type: t,
    vnode: n,
    proxy: i,
    withProxy: r,
    propsOptions: [o],
    slots: s,
    attrs: l,
    emit: a,
    render: d,
    renderCache: c,
    props: g,
    data: x,
    setupState: I,
    ctx: K,
    inheritAttrs: L
  } = e, se = Cn(e);
  let Y, N;
  try {
    if (n.shapeFlag & 4) {
      const E = r || i, W = E;
      Y = Ye(
        d.call(
          W,
          E,
          c,
          g,
          I,
          x,
          K
        )
      ), N = l;
    } else {
      const E = t;
      Y = Ye(
        E.length > 1 ? E(
          g,
          { attrs: l, slots: s, emit: a }
        ) : E(
          g,
          null
        )
      ), N = t.props ? l : pl(l);
    }
  } catch (E) {
    en.length = 0, Fn(E, e, 1), Y = Me(Ae);
  }
  let J = Y;
  if (N && L !== !1) {
    const E = Object.keys(N), { shapeFlag: W } = J;
    E.length && W & 7 && (o && E.some(On) && (N = gl(
      N,
      o
    )), J = gt(J, N, !1, !0));
  }
  return n.dirs && (J = gt(J, null, !1, !0), J.dirs = J.dirs ? J.dirs.concat(n.dirs) : n.dirs), n.transition && on(J, n.transition), Y = J, Cn(se), Y;
}
const pl = (e) => {
  let t;
  for (const n in e)
    (n === "class" || n === "style" || En(n)) && ((t || (t = {}))[n] = e[n]);
  return t;
}, gl = (e, t) => {
  const n = {};
  for (const i in e)
    (!On(i) || !(i.slice(9) in t)) && (n[i] = e[i]);
  return n;
};
function hl(e, t, n) {
  const { props: i, children: r, component: o } = e, { props: s, children: l, patchFlag: a } = t, d = o.emitsOptions;
  if (t.dirs || t.transition)
    return !0;
  if (n && a >= 0) {
    if (a & 1024)
      return !0;
    if (a & 16)
      return i ? er(i, s, d) : !!s;
    if (a & 8) {
      const c = t.dynamicProps;
      for (let g = 0; g < c.length; g++) {
        const x = c[g];
        if (_o(s, i, x) && !Nn(d, x))
          return !0;
      }
    }
  } else
    return (r || l) && (!l || !l.$stable) ? !0 : i === s ? !1 : i ? s ? er(i, s, d) : !0 : !!s;
  return !1;
}
function er(e, t, n) {
  const i = Object.keys(t);
  if (i.length !== Object.keys(e).length)
    return !0;
  for (let r = 0; r < i.length; r++) {
    const o = i[r];
    if (_o(t, e, o) && !Nn(n, o))
      return !0;
  }
  return !1;
}
function _o(e, t, n) {
  const i = e[n], r = t[n];
  return n === "style" && ee(i) && ee(r) ? !Si(i, r) : i !== r;
}
function vl({ vnode: e, parent: t, suspense: n }, i) {
  for (; t; ) {
    const r = t.subTree;
    if (r.suspense && r.suspense.activeBranch === e && (r.suspense.vnode.el = r.el = i, e = r), r === e)
      (e = t.vnode).el = i, t = t.parent;
    else
      break;
  }
  n && n.activeBranch === e && (n.vnode.el = i);
}
const bo = {}, So = () => Object.create(bo), xo = (e) => Object.getPrototypeOf(e) === bo;
function ml(e, t, n, i = !1) {
  const r = {}, o = So();
  e.propsDefaults = /* @__PURE__ */ Object.create(null), Po(e, t, r, o);
  for (const s in e.propsOptions[0])
    s in r || (r[s] = void 0);
  n ? e.props = i ? r : /* @__PURE__ */ xs(r) : e.type.props ? e.props = r : e.props = o, e.attrs = o;
}
function yl(e, t, n, i) {
  const {
    props: r,
    attrs: o,
    vnode: { patchFlag: s }
  } = e, l = /* @__PURE__ */ X(r), [a] = e.propsOptions;
  let d = !1;
  if (
    // always force full diff in dev
    // - #1942 if hmr is enabled with sfc component
    // - vite#872 non-sfc component used by sfc component
    (i || s > 0) && !(s & 16)
  ) {
    if (s & 8) {
      const c = e.vnode.dynamicProps;
      for (let g = 0; g < c.length; g++) {
        let x = c[g];
        if (Nn(e.emitsOptions, x))
          continue;
        const I = t[x];
        if (a)
          if (Z(o, x))
            I !== o[x] && (o[x] = I, d = !0);
          else {
            const K = $e(x);
            r[K] = di(
              a,
              l,
              K,
              I,
              e,
              !1
            );
          }
        else
          I !== o[x] && (o[x] = I, d = !0);
      }
    }
  } else {
    Po(e, t, r, o) && (d = !0);
    let c;
    for (const g in l)
      (!t || // for camelCase
      !Z(t, g) && // it's possible the original props was passed in as kebab-case
      // and converted to camelCase (#955)
      ((c = It(g)) === g || !Z(t, c))) && (a ? n && // for camelCase
      (n[g] !== void 0 || // for kebab-case
      n[c] !== void 0) && (r[g] = di(
        a,
        l,
        g,
        void 0,
        e,
        !0
      )) : delete r[g]);
    if (o !== l)
      for (const g in o)
        (!t || !Z(t, g)) && (delete o[g], d = !0);
  }
  d && st(e.attrs, "set", "");
}
function Po(e, t, n, i) {
  const [r, o] = e.propsOptions;
  let s = !1, l;
  if (t)
    for (let a in t) {
      if (Jt(a))
        continue;
      const d = t[a];
      let c;
      r && Z(r, c = $e(a)) ? !o || !o.includes(c) ? n[c] = d : (l || (l = {}))[c] = d : Nn(e.emitsOptions, a) || (!(a in i) || d !== i[a]) && (i[a] = d, s = !0);
    }
  if (o) {
    const a = /* @__PURE__ */ X(n), d = l || re;
    for (let c = 0; c < o.length; c++) {
      const g = o[c];
      n[g] = di(
        r,
        a,
        g,
        d[g],
        e,
        !Z(d, g)
      );
    }
  }
  return s;
}
function di(e, t, n, i, r, o) {
  const s = e[n];
  if (s != null) {
    const l = Z(s, "default");
    if (l && i === void 0) {
      const a = s.default;
      if (s.type !== Function && !s.skipFactory && B(a)) {
        const { propsDefaults: d } = r;
        if (n in d)
          i = d[n];
        else {
          const c = dn(r);
          i = d[n] = a.call(
            null,
            t
          ), c();
        }
      } else
        i = a;
      r.ce && r.ce._setProp(n, i);
    }
    s[
      0
      /* shouldCast */
    ] && (o && !l ? i = !1 : s[
      1
      /* shouldCastTrue */
    ] && (i === "" || i === It(n)) && (i = !0));
  }
  return i;
}
const _l = /* @__PURE__ */ new WeakMap();
function Co(e, t, n = !1) {
  const i = n ? _l : t.propsCache, r = i.get(e);
  if (r)
    return r;
  const o = e.props, s = {}, l = [];
  let a = !1;
  if (!B(e)) {
    const c = (g) => {
      a = !0;
      const [x, I] = Co(g, t, !0);
      me(s, x), I && l.push(...I);
    };
    !n && t.mixins.length && t.mixins.forEach(c), e.extends && c(e.extends), e.mixins && e.mixins.forEach(c);
  }
  if (!o && !a)
    return ee(e) && i.set(e, Lt), Lt;
  if (F(o))
    for (let c = 0; c < o.length; c++) {
      const g = $e(o[c]);
      tr(g) && (s[g] = re);
    }
  else if (o)
    for (const c in o) {
      const g = $e(c);
      if (tr(g)) {
        const x = o[c], I = s[g] = F(x) || B(x) ? { type: x } : me({}, x), K = I.type;
        let L = !1, se = !0;
        if (F(K))
          for (let Y = 0; Y < K.length; ++Y) {
            const N = K[Y], J = B(N) && N.name;
            if (J === "Boolean") {
              L = !0;
              break;
            } else J === "String" && (se = !1);
          }
        else
          L = B(K) && K.name === "Boolean";
        I[
          0
          /* shouldCast */
        ] = L, I[
          1
          /* shouldCastTrue */
        ] = se, (L || Z(I, "default")) && l.push(g);
      }
    }
  const d = [s, l];
  return ee(e) && i.set(e, d), d;
}
function tr(e) {
  return e[0] !== "$" && !Jt(e);
}
const Li = (e) => e === "_" || e === "_ctx" || e === "$stable", Di = (e) => F(e) ? e.map(Ye) : [Ye(e)], bl = (e, t, n) => {
  if (t._n)
    return t;
  const i = li((...r) => Di(t(...r)), n);
  return i._c = !1, i;
}, wo = (e, t, n) => {
  const i = e._ctx;
  for (const r in e) {
    if (Li(r)) continue;
    const o = e[r];
    if (B(o))
      t[r] = bl(r, o, i);
    else if (o != null) {
      const s = Di(o);
      t[r] = () => s;
    }
  }
}, To = (e, t) => {
  const n = Di(t);
  e.slots.default = () => n;
}, Ao = (e, t, n) => {
  for (const i in t)
    (n || !Li(i)) && (e[i] = t[i]);
}, Sl = (e, t, n) => {
  const i = e.slots = So();
  if (e.vnode.shapeFlag & 32) {
    const r = t._;
    r ? (Ao(i, t, n), n && Lr(i, "_", r, !0)) : wo(t, i);
  } else t && To(e, t);
}, xl = (e, t, n) => {
  const { vnode: i, slots: r } = e;
  let o = !0, s = re;
  if (i.shapeFlag & 32) {
    const l = t._;
    l ? n && l === 1 ? o = !1 : Ao(r, t, n) : (o = !t.$stable, wo(t, r)), s = t;
  } else t && (To(e, t), s = { default: 1 });
  if (o)
    for (const l in r)
      !Li(l) && s[l] == null && delete r[l];
}, Ee = Al;
function Pl(e) {
  return Cl(e);
}
function Cl(e, t) {
  const n = Ln();
  n.__VUE__ = !0;
  const {
    insert: i,
    remove: r,
    patchProp: o,
    createElement: s,
    createText: l,
    createComment: a,
    setText: d,
    setElementText: c,
    parentNode: g,
    nextSibling: x,
    setScopeId: I = Qe,
    insertStaticContent: K
  } = e, L = (u, f, h, S = null, y = null, _ = null, w = void 0, C = null, P = !!f.dynamicChildren) => {
    if (u === f)
      return;
    u && !Ct(u, f) && (S = H(u), M(u, y, _, !0), u = null), f.patchFlag === -2 && (P = !1, f.dynamicChildren = null);
    const { type: b, ref: D, shapeFlag: A } = f;
    switch (b) {
      case $n:
        se(u, f, h, S);
        break;
      case Ae:
        Y(u, f, h, S);
        break;
      case Yn:
        u == null && N(f, h, S, w);
        break;
      case Se:
        T(
          u,
          f,
          h,
          S,
          y,
          _,
          w,
          C,
          P
        );
        break;
      default:
        A & 1 ? W(
          u,
          f,
          h,
          S,
          y,
          _,
          w,
          C,
          P
        ) : A & 6 ? te(
          u,
          f,
          h,
          S,
          y,
          _,
          w,
          C,
          P
        ) : (A & 64 || A & 128) && b.process(
          u,
          f,
          h,
          S,
          y,
          _,
          w,
          C,
          P,
          v
        );
    }
    D != null && y ? Xt(D, u && u.ref, _, f || u, !f) : D == null && u && u.ref != null && Xt(u.ref, null, _, u, !0);
  }, se = (u, f, h, S) => {
    if (u == null)
      i(
        f.el = l(f.children),
        h,
        S
      );
    else {
      const y = f.el = u.el;
      f.children !== u.children && d(y, f.children);
    }
  }, Y = (u, f, h, S) => {
    u == null ? i(
      f.el = a(f.children || ""),
      h,
      S
    ) : f.el = u.el;
  }, N = (u, f, h, S) => {
    [u.el, u.anchor] = K(
      u.children,
      f,
      h,
      S,
      u.el,
      u.anchor
    );
  }, J = ({ el: u, anchor: f }, h, S) => {
    let y;
    for (; u && u !== f; )
      y = x(u), i(u, h, S), u = y;
    i(f, h, S);
  }, E = ({ el: u, anchor: f }) => {
    let h;
    for (; u && u !== f; )
      h = x(u), r(u), u = h;
    r(f);
  }, W = (u, f, h, S, y, _, w, C, P) => {
    if (f.type === "svg" ? w = "svg" : f.type === "math" && (w = "mathml"), u == null)
      ue(
        f,
        h,
        S,
        y,
        _,
        w,
        C,
        P
      );
    else {
      const b = u.el && u.el._isVueCE ? u.el : null;
      try {
        b && b._beginPatch(), $(
          u,
          f,
          y,
          _,
          w,
          C,
          P
        );
      } finally {
        b && b._endPatch();
      }
    }
  }, ue = (u, f, h, S, y, _, w, C) => {
    let P, b;
    const { props: D, shapeFlag: A, transition: k, dirs: V } = u;
    if (P = u.el = s(
      u.type,
      _,
      D && D.is,
      D
    ), A & 8 ? c(P, u.children) : A & 16 && ve(
      u.children,
      P,
      null,
      S,
      y,
      zn(u, _),
      w,
      C
    ), V && mt(u, null, S, "created"), ye(P, u, u.scopeId, w, S), D) {
      for (const ie in D)
        ie !== "value" && !Jt(ie) && o(P, ie, null, D[ie], _, S);
      "value" in D && o(P, "value", null, D.value, _), (b = D.onVnodeBeforeMount) && qe(b, S, u);
    }
    V && mt(u, null, S, "beforeMount");
    const z = wl(y, k);
    z && k.beforeEnter(P), i(P, f, h), ((b = D && D.onVnodeMounted) || z || V) && Ee(() => {
      b && qe(b, S, u), z && k.enter(P), V && mt(u, null, S, "mounted");
    }, y);
  }, ye = (u, f, h, S, y) => {
    if (h && I(u, h), S)
      for (let _ = 0; _ < S.length; _++)
        I(u, S[_]);
    if (y) {
      let _ = y.subTree;
      if (f === _ || Oo(_.type) && (_.ssContent === f || _.ssFallback === f)) {
        const w = y.vnode;
        ye(
          u,
          w,
          w.scopeId,
          w.slotScopeIds,
          y.parent
        );
      }
    }
  }, ve = (u, f, h, S, y, _, w, C, P = 0) => {
    for (let b = P; b < u.length; b++) {
      const D = u[b] = C ? ot(u[b]) : Ye(u[b]);
      L(
        null,
        D,
        f,
        h,
        S,
        y,
        _,
        w,
        C
      );
    }
  }, $ = (u, f, h, S, y, _, w) => {
    const C = f.el = u.el;
    let { patchFlag: P, dynamicChildren: b, dirs: D } = f;
    P |= u.patchFlag & 16;
    const A = u.props || re, k = f.props || re;
    let V;
    if (h && _t(h, !1), (V = k.onVnodeBeforeUpdate) && qe(V, h, f, u), D && mt(f, u, h, "beforeUpdate"), h && _t(h, !0), (A.innerHTML && k.innerHTML == null || A.textContent && k.textContent == null) && c(C, ""), b ? Q(
      u.dynamicChildren,
      b,
      C,
      h,
      S,
      zn(f, y),
      _
    ) : w || G(
      u,
      f,
      C,
      null,
      h,
      S,
      zn(f, y),
      _,
      !1
    ), P > 0) {
      if (P & 16)
        ce(C, A, k, h, y);
      else if (P & 2 && A.class !== k.class && o(C, "class", null, k.class, y), P & 4 && o(C, "style", A.style, k.style, y), P & 8) {
        const z = f.dynamicProps;
        for (let ie = 0; ie < z.length; ie++) {
          const le = z[ie], ge = A[le], _e = k[le];
          (_e !== ge || le === "value") && o(C, le, ge, _e, y, h);
        }
      }
      P & 1 && u.children !== f.children && c(C, f.children);
    } else !w && b == null && ce(C, A, k, h, y);
    ((V = k.onVnodeUpdated) || D) && Ee(() => {
      V && qe(V, h, f, u), D && mt(f, u, h, "updated");
    }, S);
  }, Q = (u, f, h, S, y, _, w) => {
    for (let C = 0; C < f.length; C++) {
      const P = u[C], b = f[C], D = (
        // oldVNode may be an errored async setup() component inside Suspense
        // which will not have a mounted element
        P.el && // - In the case of a Fragment, we need to provide the actual parent
        // of the Fragment itself so it can move its children.
        (P.type === Se || // - In the case of different nodes, there is going to be a replacement
        // which also requires the correct parent container
        !Ct(P, b) || // - In the case of a component, it could contain anything.
        P.shapeFlag & 198) ? g(P.el) : (
          // In other cases, the parent container is not actually used so we
          // just pass the block element here to avoid a DOM parentNode call.
          h
        )
      );
      L(
        P,
        b,
        D,
        null,
        S,
        y,
        _,
        w,
        !0
      );
    }
  }, ce = (u, f, h, S, y) => {
    if (f !== h) {
      if (f !== re)
        for (const _ in f)
          !Jt(_) && !(_ in h) && o(
            u,
            _,
            f[_],
            null,
            y,
            S
          );
      for (const _ in h) {
        if (Jt(_)) continue;
        const w = h[_], C = f[_];
        w !== C && _ !== "value" && o(u, _, C, w, y, S);
      }
      "value" in h && o(u, "value", f.value, h.value, y);
    }
  }, T = (u, f, h, S, y, _, w, C, P) => {
    const b = f.el = u ? u.el : l(""), D = f.anchor = u ? u.anchor : l("");
    let { patchFlag: A, dynamicChildren: k, slotScopeIds: V } = f;
    V && (C = C ? C.concat(V) : V), u == null ? (i(b, h, S), i(D, h, S), ve(
      // #10007
      // such fragment like `<></>` will be compiled into
      // a fragment which doesn't have a children.
      // In this case fallback to an empty array
      f.children || [],
      h,
      D,
      y,
      _,
      w,
      C,
      P
    )) : A > 0 && A & 64 && k && // #2715 the previous fragment could've been a BAILed one as a result
    // of renderSlot() with no valid children
    u.dynamicChildren && u.dynamicChildren.length === k.length ? (Q(
      u.dynamicChildren,
      k,
      h,
      y,
      _,
      w,
      C
    ), // #2080 if the stable fragment has a key, it's a <template v-for> that may
    //  get moved around. Make sure all root level vnodes inherit el.
    // #2134 or if it's a component root, it may also get moved around
    // as the component is being moved.
    (f.key != null || y && f === y.subTree) && Io(
      u,
      f,
      !0
      /* shallow */
    )) : G(
      u,
      f,
      h,
      D,
      y,
      _,
      w,
      C,
      P
    );
  }, te = (u, f, h, S, y, _, w, C, P) => {
    f.slotScopeIds = C, u == null ? f.shapeFlag & 512 ? y.ctx.activate(
      f,
      h,
      S,
      w,
      P
    ) : de(
      f,
      h,
      S,
      y,
      _,
      w,
      P
    ) : xe(u, f, P);
  }, de = (u, f, h, S, y, _, w) => {
    const C = u.component = Rl(
      u,
      S,
      y
    );
    if (Rn(u) && (C.ctx.renderer = v), Vl(C, !1, w), C.asyncDep) {
      if (y && y.registerDep(C, pe, w), !u.el) {
        const P = C.subTree = Me(Ae);
        Y(null, P, f, h), u.placeholder = P.el;
      }
    } else
      pe(
        C,
        u,
        f,
        h,
        y,
        _,
        w
      );
  }, xe = (u, f, h) => {
    const S = f.component = u.component;
    if (hl(u, f, h))
      if (S.asyncDep && !S.asyncResolved) {
        ne(S, f, h);
        return;
      } else
        S.next = f, S.update();
    else
      f.el = u.el, S.vnode = f;
  }, pe = (u, f, h, S, y, _, w) => {
    const C = () => {
      if (u.isMounted) {
        let { next: A, bu: k, u: V, parent: z, vnode: ie } = u;
        {
          const Ue = Mo(u);
          if (Ue) {
            A && (A.el = ie.el, ne(u, A, w)), Ue.asyncDep.then(() => {
              Ee(() => {
                u.isUnmounted || b();
              }, y);
            });
            return;
          }
        }
        let le = A, ge;
        _t(u, !1), A ? (A.el = ie.el, ne(u, A, w)) : A = ie, k && yn(k), (ge = A.props && A.props.onVnodeBeforeUpdate) && qe(ge, z, A, ie), _t(u, !0);
        const _e = Zi(u), je = u.subTree;
        u.subTree = _e, L(
          je,
          _e,
          // parent may have changed if it's in a teleport
          g(je.el),
          // anchor may have changed if it's in a fragment
          H(je),
          u,
          y,
          _
        ), A.el = _e.el, le === null && vl(u, _e.el), V && Ee(V, y), (ge = A.props && A.props.onVnodeUpdated) && Ee(
          () => qe(ge, z, A, ie),
          y
        );
      } else {
        let A;
        const { el: k, props: V } = f, { bm: z, m: ie, parent: le, root: ge, type: _e } = u, je = Qt(f);
        _t(u, !1), z && yn(z), !je && (A = V && V.onVnodeBeforeMount) && qe(A, le, f), _t(u, !0);
        {
          ge.ce && ge.ce._hasShadowRoot() && ge.ce._injectChildStyle(
            _e,
            u.parent ? u.parent.type : void 0
          );
          const Ue = u.subTree = Zi(u);
          L(
            null,
            Ue,
            h,
            S,
            u,
            y,
            _
          ), f.el = Ue.el;
        }
        if (ie && Ee(ie, y), !je && (A = V && V.onVnodeMounted)) {
          const Ue = f;
          Ee(
            () => qe(A, le, Ue),
            y
          );
        }
        (f.shapeFlag & 256 || le && Qt(le.vnode) && le.vnode.shapeFlag & 256) && u.a && Ee(u.a, y), u.isMounted = !0, f = h = S = null;
      }
    };
    u.scope.on();
    const P = u.effect = new Vr(C);
    u.scope.off();
    const b = u.update = P.run.bind(P), D = u.job = P.runIfDirty.bind(P);
    D.i = u, D.id = u.uid, P.scheduler = () => Ei(D), _t(u, !0), b();
  }, ne = (u, f, h) => {
    f.component = u;
    const S = u.vnode.props;
    u.vnode = f, u.next = null, yl(u, f.props, S, h), xl(u, f.children, h), at(), Wi(u), ct();
  }, G = (u, f, h, S, y, _, w, C, P = !1) => {
    const b = u && u.children, D = u ? u.shapeFlag : 0, A = f.children, { patchFlag: k, shapeFlag: V } = f;
    if (k > 0) {
      if (k & 128) {
        ke(
          b,
          A,
          h,
          S,
          y,
          _,
          w,
          C,
          P
        );
        return;
      } else if (k & 256) {
        et(
          b,
          A,
          h,
          S,
          y,
          _,
          w,
          C,
          P
        );
        return;
      }
    }
    V & 8 ? (D & 16 && vt(b, y, _), A !== b && c(h, A)) : D & 16 ? V & 16 ? ke(
      b,
      A,
      h,
      S,
      y,
      _,
      w,
      C,
      P
    ) : vt(b, y, _, !0) : (D & 8 && c(h, ""), V & 16 && ve(
      A,
      h,
      S,
      y,
      _,
      w,
      C,
      P
    ));
  }, et = (u, f, h, S, y, _, w, C, P) => {
    u = u || Lt, f = f || Lt;
    const b = u.length, D = f.length, A = Math.min(b, D);
    let k;
    for (k = 0; k < A; k++) {
      const V = f[k] = P ? ot(f[k]) : Ye(f[k]);
      L(
        u[k],
        V,
        h,
        null,
        y,
        _,
        w,
        C,
        P
      );
    }
    b > D ? vt(
      u,
      y,
      _,
      !0,
      !1,
      A
    ) : ve(
      f,
      h,
      S,
      y,
      _,
      w,
      C,
      P,
      A
    );
  }, ke = (u, f, h, S, y, _, w, C, P) => {
    let b = 0;
    const D = f.length;
    let A = u.length - 1, k = D - 1;
    for (; b <= A && b <= k; ) {
      const V = u[b], z = f[b] = P ? ot(f[b]) : Ye(f[b]);
      if (Ct(V, z))
        L(
          V,
          z,
          h,
          null,
          y,
          _,
          w,
          C,
          P
        );
      else
        break;
      b++;
    }
    for (; b <= A && b <= k; ) {
      const V = u[A], z = f[k] = P ? ot(f[k]) : Ye(f[k]);
      if (Ct(V, z))
        L(
          V,
          z,
          h,
          null,
          y,
          _,
          w,
          C,
          P
        );
      else
        break;
      A--, k--;
    }
    if (b > A) {
      if (b <= k) {
        const V = k + 1, z = V < D ? f[V].el : S;
        for (; b <= k; )
          L(
            null,
            f[b] = P ? ot(f[b]) : Ye(f[b]),
            h,
            z,
            y,
            _,
            w,
            C,
            P
          ), b++;
      }
    } else if (b > k)
      for (; b <= A; )
        M(u[b], y, _, !0), b++;
    else {
      const V = b, z = b, ie = /* @__PURE__ */ new Map();
      for (b = z; b <= k; b++) {
        const Le = f[b] = P ? ot(f[b]) : Ye(f[b]);
        Le.key != null && ie.set(Le.key, b);
      }
      let le, ge = 0;
      const _e = k - z + 1;
      let je = !1, Ue = 0;
      const Ht = new Array(_e);
      for (b = 0; b < _e; b++) Ht[b] = 0;
      for (b = V; b <= A; b++) {
        const Le = u[b];
        if (ge >= _e) {
          M(Le, y, _, !0);
          continue;
        }
        let We;
        if (Le.key != null)
          We = ie.get(Le.key);
        else
          for (le = z; le <= k; le++)
            if (Ht[le - z] === 0 && Ct(Le, f[le])) {
              We = le;
              break;
            }
        We === void 0 ? M(Le, y, _, !0) : (Ht[We - z] = b + 1, We >= Ue ? Ue = We : je = !0, L(
          Le,
          f[We],
          h,
          null,
          y,
          _,
          w,
          C,
          P
        ), ge++);
      }
      const Ni = je ? Tl(Ht) : Lt;
      for (le = Ni.length - 1, b = _e - 1; b >= 0; b--) {
        const Le = z + b, We = f[Le], $i = f[Le + 1], Bi = Le + 1 < D ? (
          // #13559, #14173 fallback to el placeholder for unresolved async component
          $i.el || Eo($i)
        ) : S;
        Ht[b] === 0 ? L(
          null,
          We,
          h,
          Bi,
          y,
          _,
          w,
          C,
          P
        ) : je && (le < 0 || b !== Ni[le] ? tt(We, h, Bi, 2) : le--);
      }
    }
  }, tt = (u, f, h, S, y = null) => {
    const { el: _, type: w, transition: C, children: P, shapeFlag: b } = u;
    if (b & 6) {
      tt(u.component.subTree, f, h, S);
      return;
    }
    if (b & 128) {
      u.suspense.move(f, h, S);
      return;
    }
    if (b & 64) {
      w.move(u, f, h, v);
      return;
    }
    if (w === Se) {
      i(_, f, h);
      for (let A = 0; A < P.length; A++)
        tt(P[A], f, h, S);
      i(u.anchor, f, h);
      return;
    }
    if (w === Yn) {
      J(u, f, h);
      return;
    }
    if (S !== 2 && b & 1 && C)
      if (S === 0)
        C.beforeEnter(_), i(_, f, h), Ee(() => C.enter(_), y);
      else {
        const { leave: A, delayLeave: k, afterLeave: V } = C, z = () => {
          u.ctx.isUnmounted ? r(_) : i(_, f, h);
        }, ie = () => {
          _._isLeaving && _[Je](
            !0
            /* cancelled */
          ), A(_, () => {
            z(), V && V();
          });
        };
        k ? k(_, z, ie) : ie();
      }
    else
      i(_, f, h);
  }, M = (u, f, h, S = !1, y = !1) => {
    const {
      type: _,
      props: w,
      ref: C,
      children: P,
      dynamicChildren: b,
      shapeFlag: D,
      patchFlag: A,
      dirs: k,
      cacheIndex: V,
      memo: z
    } = u;
    if (A === -2 && (y = !1), C != null && (at(), Xt(C, null, h, u, !0), ct()), V != null && (f.renderCache[V] = void 0), D & 256) {
      f.ctx.deactivate(u);
      return;
    }
    const ie = D & 1 && k, le = !Qt(u);
    let ge;
    if (le && (ge = w && w.onVnodeBeforeUnmount) && qe(ge, f, u), D & 6)
      gn(u.component, h, S);
    else {
      if (D & 128) {
        u.suspense.unmount(h, S);
        return;
      }
      ie && mt(u, null, f, "beforeUnmount"), D & 64 ? u.type.remove(
        u,
        f,
        h,
        v,
        S
      ) : b && // #5154
      // when v-once is used inside a block, setBlockTracking(-1) marks the
      // parent block with hasOnce: true
      // so that it doesn't take the fast path during unmount - otherwise
      // components nested in v-once are never unmounted.
      !b.hasOnce && // #1153: fast path should not be taken for non-stable (v-for) fragments
      (_ !== Se || A > 0 && A & 64) ? vt(
        b,
        f,
        h,
        !1,
        !0
      ) : (_ === Se && A & 384 || !y && D & 16) && vt(P, f, h), S && pn(u);
    }
    const _e = z != null && V == null;
    (le && (ge = w && w.onVnodeUnmounted) || ie || _e) && Ee(() => {
      ge && qe(ge, f, u), ie && mt(u, null, f, "unmounted"), _e && (u.el = null);
    }, h);
  }, pn = (u) => {
    const { type: f, el: h, anchor: S, transition: y } = u;
    if (f === Se) {
      Kt(h, S);
      return;
    }
    if (f === Yn) {
      E(u);
      return;
    }
    const _ = () => {
      r(h), y && !y.persisted && y.afterLeave && y.afterLeave();
    };
    if (u.shapeFlag & 1 && y && !y.persisted) {
      const { leave: w, delayLeave: C } = y, P = () => w(h, _);
      C ? C(u.el, _, P) : P();
    } else
      _();
  }, Kt = (u, f) => {
    let h;
    for (; u !== f; )
      h = x(u), r(u), u = h;
    r(f);
  }, gn = (u, f, h) => {
    const { bum: S, scope: y, job: _, subTree: w, um: C, m: P, a: b } = u;
    nr(P), nr(b), S && yn(S), y.stop(), _ && (_.flags |= 8, M(w, u, f, h)), C && Ee(C, f), Ee(() => {
      u.isUnmounted = !0;
    }, f);
  }, vt = (u, f, h, S = !1, y = !1, _ = 0) => {
    for (let w = _; w < u.length; w++)
      M(u[w], f, h, S, y);
  }, H = (u) => {
    if (u.shapeFlag & 6)
      return H(u.component.subTree);
    if (u.shapeFlag & 128)
      return u.suspense.next();
    const f = x(u.anchor || u.el), h = f && f[Ks];
    return h ? x(h) : f;
  };
  let O = !1;
  const m = (u, f, h) => {
    let S;
    u == null ? f._vnode && (M(f._vnode, null, null, !0), S = f._vnode.component) : L(
      f._vnode || null,
      u,
      f,
      null,
      null,
      null,
      h
    ), f._vnode = u, O || (O = !0, Wi(S), eo(), O = !1);
  }, v = {
    p: L,
    um: M,
    m: tt,
    r: pn,
    mt: de,
    mc: ve,
    pc: G,
    pbc: Q,
    n: H,
    o: e
  };
  return {
    render: m,
    hydrate: void 0,
    createApp: cl(m)
  };
}
function zn({ type: e, props: t }, n) {
  return n === "svg" && e === "foreignObject" || n === "mathml" && e === "annotation-xml" && t && t.encoding && t.encoding.includes("html") ? void 0 : n;
}
function _t({ effect: e, job: t }, n) {
  n ? (e.flags |= 32, t.flags |= 4) : (e.flags &= -33, t.flags &= -5);
}
function wl(e, t) {
  return (!e || e && !e.pendingBranch) && t && !t.persisted;
}
function Io(e, t, n = !1) {
  const i = e.children, r = t.children;
  if (F(i) && F(r))
    for (let o = 0; o < i.length; o++) {
      const s = i[o];
      let l = r[o];
      l.shapeFlag & 1 && !l.dynamicChildren && ((l.patchFlag <= 0 || l.patchFlag === 32) && (l = r[o] = ot(r[o]), l.el = s.el), !n && l.patchFlag !== -2 && Io(s, l)), l.type === $n && (l.patchFlag === -1 && (l = r[o] = ot(l)), l.el = s.el), l.type === Ae && !l.el && (l.el = s.el);
    }
}
function Tl(e) {
  const t = e.slice(), n = [0];
  let i, r, o, s, l;
  const a = e.length;
  for (i = 0; i < a; i++) {
    const d = e[i];
    if (d !== 0) {
      if (r = n[n.length - 1], e[r] < d) {
        t[i] = r, n.push(i);
        continue;
      }
      for (o = 0, s = n.length - 1; o < s; )
        l = o + s >> 1, e[n[l]] < d ? o = l + 1 : s = l;
      d < e[n[o]] && (o > 0 && (t[i] = n[o - 1]), n[o] = i);
    }
  }
  for (o = n.length, s = n[o - 1]; o-- > 0; )
    n[o] = s, s = t[s];
  return n;
}
function Mo(e) {
  const t = e.subTree.component;
  if (t)
    return t.asyncDep && !t.asyncResolved ? t : Mo(t);
}
function nr(e) {
  if (e)
    for (let t = 0; t < e.length; t++)
      e[t].flags |= 8;
}
function Eo(e) {
  if (e.placeholder)
    return e.placeholder;
  const t = e.component;
  return t ? Eo(t.subTree) : null;
}
const Oo = (e) => e.__isSuspense;
function Al(e, t) {
  t && t.pendingBranch ? F(e) ? t.effects.push(...e) : t.effects.push(e) : Fs(e);
}
const Se = /* @__PURE__ */ Symbol.for("v-fgt"), $n = /* @__PURE__ */ Symbol.for("v-txt"), Ae = /* @__PURE__ */ Symbol.for("v-cmt"), Yn = /* @__PURE__ */ Symbol.for("v-stc"), en = [];
let Fe = null;
function U(e = !1) {
  en.push(Fe = e ? null : []);
}
function Il() {
  en.pop(), Fe = en[en.length - 1] || null;
}
let sn = 1;
function An(e, t = !1) {
  sn += e, e < 0 && Fe && t && (Fe.hasOnce = !0);
}
function ko(e) {
  return e.dynamicChildren = sn > 0 ? Fe || Lt : null, Il(), sn > 0 && Fe && Fe.push(e), e;
}
function q(e, t, n, i, r, o) {
  return ko(
    p(
      e,
      t,
      n,
      i,
      r,
      o,
      !0
    )
  );
}
function Ml(e, t, n, i, r) {
  return ko(
    Me(
      e,
      t,
      n,
      i,
      r,
      !0
    )
  );
}
function In(e) {
  return e ? e.__v_isVNode === !0 : !1;
}
function Ct(e, t) {
  return e.type === t.type && e.key === t.key;
}
const Lo = ({ key: e }) => e ?? null, Sn = ({
  ref: e,
  ref_key: t,
  ref_for: n
}) => (typeof e == "number" && (e = "" + e), e != null ? fe(e) || /* @__PURE__ */ Ce(e) || B(e) ? { i: Ve, r: e, k: t, f: !!n } : e : null);
function p(e, t = null, n = null, i = 0, r = null, o = e === Se ? 0 : 1, s = !1, l = !1) {
  const a = {
    __v_isVNode: !0,
    __v_skip: !0,
    type: e,
    props: t,
    key: t && Lo(t),
    ref: t && Sn(t),
    scopeId: no,
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
    shapeFlag: o,
    patchFlag: i,
    dynamicProps: r,
    dynamicChildren: null,
    appContext: null,
    ctx: Ve
  };
  return l ? (Fi(a, n), o & 128 && e.normalize(a)) : n && (a.shapeFlag |= fe(n) ? 8 : 16), sn > 0 && // avoid a block node from tracking itself
  !s && // has current parent block
  Fe && // presence of a patch flag indicates this node needs patching on updates.
  // component nodes also should always be patched, because even if the
  // component doesn't need to update, it needs to persist the instance on to
  // the next vnode so that it can be properly unmounted later.
  (a.patchFlag > 0 || o & 6) && // the EVENTS flag is only for hydration and if it is the only flag, the
  // vnode should not be considered dynamic due to handler caching.
  a.patchFlag !== 32 && Fe.push(a), a;
}
const Me = El;
function El(e, t = null, n = null, i = 0, r = null, o = !1) {
  if ((!e || e === tl) && (e = Ae), In(e)) {
    const l = gt(
      e,
      t,
      !0
      /* mergeRef: true */
    );
    return n && Fi(l, n), sn > 0 && !o && Fe && (l.shapeFlag & 6 ? Fe[Fe.indexOf(e)] = l : Fe.push(l)), l.patchFlag = -2, l;
  }
  if (Kl(e) && (e = e.__vccOpts), t) {
    t = Ol(t);
    let { class: l, style: a } = t;
    l && !fe(l) && (t.class = Oe(l)), ee(a) && (/* @__PURE__ */ Mi(a) && !F(a) && (a = me({}, a)), t.style = bi(a));
  }
  const s = fe(e) ? 1 : Oo(e) ? 128 : oo(e) ? 64 : ee(e) ? 4 : B(e) ? 2 : 0;
  return p(
    e,
    t,
    n,
    i,
    r,
    s,
    o,
    !0
  );
}
function Ol(e) {
  return e ? /* @__PURE__ */ Mi(e) || xo(e) ? me({}, e) : e : null;
}
function gt(e, t, n = !1, i = !1) {
  const { props: r, ref: o, patchFlag: s, children: l, transition: a } = e, d = t ? Ll(r || {}, t) : r, c = {
    __v_isVNode: !0,
    __v_skip: !0,
    type: e.type,
    props: d,
    key: d && Lo(d),
    ref: t && t.ref ? (
      // #2078 in the case of <component :is="vnode" ref="extra"/>
      // if the vnode itself already has a ref, cloneVNode will need to merge
      // the refs so the single vnode can be set on multiple refs
      n && o ? F(o) ? o.concat(Sn(t)) : [o, Sn(t)] : Sn(t)
    ) : o,
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
    patchFlag: t && e.type !== Se ? s === -1 ? 16 : s | 16 : s,
    dynamicProps: e.dynamicProps,
    dynamicChildren: e.dynamicChildren,
    appContext: e.appContext,
    dirs: e.dirs,
    transition: a,
    // These should technically only be non-null on mounted VNodes. However,
    // they *should* be copied for kept-alive vnodes. So we just always copy
    // them since them being non-null during a mount doesn't affect the logic as
    // they will simply be overwritten.
    component: e.component,
    suspense: e.suspense,
    ssContent: e.ssContent && gt(e.ssContent),
    ssFallback: e.ssFallback && gt(e.ssFallback),
    placeholder: e.placeholder,
    el: e.el,
    anchor: e.anchor,
    ctx: e.ctx,
    ce: e.ce
  };
  return a && i && on(
    c,
    a.clone(c)
  ), c;
}
function kl(e = " ", t = 0) {
  return Me($n, null, e, t);
}
function he(e = "", t = !1) {
  return t ? (U(), Ml(Ae, null, e)) : Me(Ae, null, e);
}
function Ye(e) {
  return e == null || typeof e == "boolean" ? Me(Ae) : F(e) ? Me(
    Se,
    null,
    // #3666, avoid reference pollution when reusing vnode
    e.slice()
  ) : In(e) ? ot(e) : Me($n, null, String(e));
}
function ot(e) {
  return e.el === null && e.patchFlag !== -1 || e.memo ? e : gt(e);
}
function Fi(e, t) {
  let n = 0;
  const { shapeFlag: i } = e;
  if (t == null)
    t = null;
  else if (F(t))
    n = 16;
  else if (typeof t == "object")
    if (i & 65) {
      const r = t.default;
      r && (r._c && (r._d = !1), Fi(e, r()), r._c && (r._d = !0));
      return;
    } else {
      n = 32;
      const r = t._;
      !r && !xo(t) ? t._ctx = Ve : r === 3 && Ve && (Ve.slots._ === 1 ? t._ = 1 : (t._ = 2, e.patchFlag |= 1024));
    }
  else B(t) ? (t = { default: t, _ctx: Ve }, n = 32) : (t = String(t), i & 64 ? (n = 16, t = [kl(t)]) : n = 8);
  e.children = t, e.shapeFlag |= n;
}
function Ll(...e) {
  const t = {};
  for (let n = 0; n < e.length; n++) {
    const i = e[n];
    for (const r in i)
      if (r === "class")
        t.class !== i.class && (t.class = Oe([t.class, i.class]));
      else if (r === "style")
        t.style = bi([t.style, i.style]);
      else if (En(r)) {
        const o = t[r], s = i[r];
        s && o !== s && !(F(o) && o.includes(s)) ? t[r] = o ? [].concat(o, s) : s : s == null && o == null && // mergeProps({ 'onUpdate:modelValue': undefined }) should not retain
        // the model listener.
        !On(r) && (t[r] = s);
      } else r !== "" && (t[r] = i[r]);
  }
  return t;
}
function qe(e, t, n, i = null) {
  He(e, t, 7, [
    n,
    i
  ]);
}
const Dl = mo();
let Fl = 0;
function Rl(e, t, n) {
  const i = e.type, r = (t ? t.appContext : e.appContext) || Dl, o = {
    uid: Fl++,
    vnode: e,
    type: i,
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
    scope: new ns(
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
    propsOptions: Co(i, r),
    emitsOptions: yo(i, r),
    // emit
    emit: null,
    // to be set immediately
    emitted: null,
    // props default value
    propsDefaults: re,
    // inheritAttrs
    inheritAttrs: i.inheritAttrs,
    // state
    ctx: re,
    data: re,
    props: re,
    attrs: re,
    slots: re,
    refs: re,
    setupState: re,
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
  return o.ctx = { _: o }, o.root = t ? t.root : o, o.emit = fl.bind(null, o), e.ce && e.ce(o), o;
}
let Ie = null;
const Do = () => Ie || Ve;
let Mn, pi;
{
  const e = Ln(), t = (n, i) => {
    let r;
    return (r = e[n]) || (r = e[n] = []), r.push(i), (o) => {
      r.length > 1 ? r.forEach((s) => s(o)) : r[0](o);
    };
  };
  Mn = t(
    "__VUE_INSTANCE_SETTERS__",
    (n) => Ie = n
  ), pi = t(
    "__VUE_SSR_SETTERS__",
    (n) => ln = n
  );
}
const dn = (e) => {
  const t = Ie;
  return Mn(e), e.scope.on(), () => {
    e.scope.off(), Mn(t);
  };
}, ir = () => {
  Ie && Ie.scope.off(), Mn(null);
};
function Fo(e) {
  return e.vnode.shapeFlag & 4;
}
let ln = !1;
function Vl(e, t = !1, n = !1) {
  t && pi(t);
  const { props: i, children: r } = e.vnode, o = Fo(e);
  ml(e, i, o, t), Sl(e, r, n || t);
  const s = o ? Nl(e, t) : void 0;
  return t && pi(!1), s;
}
function Nl(e, t) {
  const n = e.type;
  e.accessCache = /* @__PURE__ */ Object.create(null), e.proxy = new Proxy(e.ctx, nl);
  const { setup: i } = n;
  if (i) {
    at();
    const r = e.setupContext = i.length > 1 ? Bl(e) : null, o = dn(e), s = fn(
      i,
      e,
      0,
      [
        e.props,
        r
      ]
    ), l = Mr(s);
    if (ct(), o(), (l || e.sp) && !Qt(e) && fo(e), l) {
      if (s.then(ir, ir), t)
        return s.then((a) => {
          rr(e, a);
        }).catch((a) => {
          Fn(a, e, 0);
        });
      e.asyncDep = s;
    } else
      rr(e, s);
  } else
    Ro(e);
}
function rr(e, t, n) {
  B(t) ? e.type.__ssrInlineRender ? e.ssrRender = t : e.render = t : ee(t) && (e.setupState = Xr(t)), Ro(e);
}
function Ro(e, t, n) {
  const i = e.type;
  e.render || (e.render = i.render || Qe);
  {
    const r = dn(e);
    at();
    try {
      il(e);
    } finally {
      ct(), r();
    }
  }
}
const $l = {
  get(e, t) {
    return Pe(e, "get", ""), e[t];
  }
};
function Bl(e) {
  const t = (n) => {
    e.exposed = n || {};
  };
  return {
    attrs: new Proxy(e.attrs, $l),
    slots: e.slots,
    emit: e.emit,
    expose: t
  };
}
function Bn(e) {
  return e.exposed ? e.exposeProxy || (e.exposeProxy = new Proxy(Xr(Ps(e.exposed)), {
    get(t, n) {
      if (n in t)
        return t[n];
      if (n in Zt)
        return Zt[n](e);
    },
    has(t, n) {
      return n in t || n in Zt;
    }
  })) : e.proxy;
}
function Kl(e) {
  return B(e) && "__vccOpts" in e;
}
const De = (e, t) => /* @__PURE__ */ Ms(e, t, ln);
function Hl(e, t, n) {
  try {
    An(-1);
    const i = arguments.length;
    return i === 2 ? ee(t) && !F(t) ? In(t) ? Me(e, null, [t]) : Me(e, t) : Me(e, null, t) : (i > 3 ? n = Array.prototype.slice.call(arguments, 2) : i === 3 && In(n) && (n = [n]), Me(e, t, n));
  } finally {
    An(1);
  }
}
const jl = "3.5.34";
let gi;
const or = typeof window < "u" && window.trustedTypes;
if (or)
  try {
    gi = /* @__PURE__ */ or.createPolicy("vue", {
      createHTML: (e) => e
    });
  } catch {
  }
const Vo = gi ? (e) => gi.createHTML(e) : (e) => e, Ul = "http://www.w3.org/2000/svg", Wl = "http://www.w3.org/1998/Math/MathML", rt = typeof document < "u" ? document : null, sr = rt && /* @__PURE__ */ rt.createElement("template"), ql = {
  insert: (e, t, n) => {
    t.insertBefore(e, n || null);
  },
  remove: (e) => {
    const t = e.parentNode;
    t && t.removeChild(e);
  },
  createElement: (e, t, n, i) => {
    const r = t === "svg" ? rt.createElementNS(Ul, e) : t === "mathml" ? rt.createElementNS(Wl, e) : n ? rt.createElement(e, { is: n }) : rt.createElement(e);
    return e === "select" && i && i.multiple != null && r.setAttribute("multiple", i.multiple), r;
  },
  createText: (e) => rt.createTextNode(e),
  createComment: (e) => rt.createComment(e),
  setText: (e, t) => {
    e.nodeValue = t;
  },
  setElementText: (e, t) => {
    e.textContent = t;
  },
  parentNode: (e) => e.parentNode,
  nextSibling: (e) => e.nextSibling,
  querySelector: (e) => rt.querySelector(e),
  setScopeId(e, t) {
    e.setAttribute(t, "");
  },
  // __UNSAFE__
  // Reason: innerHTML.
  // Static content here can only come from compiled templates.
  // As long as the user only uses trusted templates, this is safe.
  insertStaticContent(e, t, n, i, r, o) {
    const s = n ? n.previousSibling : t.lastChild;
    if (r && (r === o || r.nextSibling))
      for (; t.insertBefore(r.cloneNode(!0), n), !(r === o || !(r = r.nextSibling)); )
        ;
    else {
      sr.innerHTML = Vo(
        i === "svg" ? `<svg>${e}</svg>` : i === "mathml" ? `<math>${e}</math>` : e
      );
      const l = sr.content;
      if (i === "svg" || i === "mathml") {
        const a = l.firstChild;
        for (; a.firstChild; )
          l.appendChild(a.firstChild);
        l.removeChild(a);
      }
      t.insertBefore(l, n);
    }
    return [
      // first
      s ? s.nextSibling : t.firstChild,
      // last
      n ? n.previousSibling : t.lastChild
    ];
  }
}, dt = "transition", Wt = "animation", an = /* @__PURE__ */ Symbol("_vtc"), No = {
  name: String,
  type: String,
  css: {
    type: Boolean,
    default: !0
  },
  duration: [String, Number, Object],
  enterFromClass: String,
  enterActiveClass: String,
  enterToClass: String,
  appearFromClass: String,
  appearActiveClass: String,
  appearToClass: String,
  leaveFromClass: String,
  leaveActiveClass: String,
  leaveToClass: String
}, Gl = /* @__PURE__ */ me(
  {},
  so,
  No
), Jl = (e) => (e.displayName = "Transition", e.props = Gl, e), lr = /* @__PURE__ */ Jl(
  (e, { slots: t }) => Hl(Us, zl(e), t)
), bt = (e, t = []) => {
  F(e) ? e.forEach((n) => n(...t)) : e && e(...t);
}, ar = (e) => e ? F(e) ? e.some((t) => t.length > 1) : e.length > 1 : !1;
function zl(e) {
  const t = {};
  for (const T in e)
    T in No || (t[T] = e[T]);
  if (e.css === !1)
    return t;
  const {
    name: n = "v",
    type: i,
    duration: r,
    enterFromClass: o = `${n}-enter-from`,
    enterActiveClass: s = `${n}-enter-active`,
    enterToClass: l = `${n}-enter-to`,
    appearFromClass: a = o,
    appearActiveClass: d = s,
    appearToClass: c = l,
    leaveFromClass: g = `${n}-leave-from`,
    leaveActiveClass: x = `${n}-leave-active`,
    leaveToClass: I = `${n}-leave-to`
  } = e, K = Yl(r), L = K && K[0], se = K && K[1], {
    onBeforeEnter: Y,
    onEnter: N,
    onEnterCancelled: J,
    onLeave: E,
    onLeaveCancelled: W,
    onBeforeAppear: ue = Y,
    onAppear: ye = N,
    onAppearCancelled: ve = J
  } = t, $ = (T, te, de, xe) => {
    T._enterCancelled = xe, St(T, te ? c : l), St(T, te ? d : s), de && de();
  }, Q = (T, te) => {
    T._isLeaving = !1, St(T, g), St(T, I), St(T, x), te && te();
  }, ce = (T) => (te, de) => {
    const xe = T ? ye : N, pe = () => $(te, T, de);
    bt(xe, [te, pe]), cr(() => {
      St(te, T ? a : o), it(te, T ? c : l), ar(xe) || ur(te, i, L, pe);
    });
  };
  return me(t, {
    onBeforeEnter(T) {
      bt(Y, [T]), it(T, o), it(T, s);
    },
    onBeforeAppear(T) {
      bt(ue, [T]), it(T, a), it(T, d);
    },
    onEnter: ce(!1),
    onAppear: ce(!0),
    onLeave(T, te) {
      T._isLeaving = !0;
      const de = () => Q(T, te);
      it(T, g), T._enterCancelled ? (it(T, x), pr(T)) : (pr(T), it(T, x)), cr(() => {
        T._isLeaving && (St(T, g), it(T, I), ar(E) || ur(T, i, se, de));
      }), bt(E, [T, de]);
    },
    onEnterCancelled(T) {
      $(T, !1, void 0, !0), bt(J, [T]);
    },
    onAppearCancelled(T) {
      $(T, !0, void 0, !0), bt(ve, [T]);
    },
    onLeaveCancelled(T) {
      Q(T), bt(W, [T]);
    }
  });
}
function Yl(e) {
  if (e == null)
    return null;
  if (ee(e))
    return [Xn(e.enter), Xn(e.leave)];
  {
    const t = Xn(e);
    return [t, t];
  }
}
function Xn(e) {
  return Jo(e);
}
function it(e, t) {
  t.split(/\s+/).forEach((n) => n && e.classList.add(n)), (e[an] || (e[an] = /* @__PURE__ */ new Set())).add(t);
}
function St(e, t) {
  t.split(/\s+/).forEach((i) => i && e.classList.remove(i));
  const n = e[an];
  n && (n.delete(t), n.size || (e[an] = void 0));
}
function cr(e) {
  requestAnimationFrame(() => {
    requestAnimationFrame(e);
  });
}
let Xl = 0;
function ur(e, t, n, i) {
  const r = e._endId = ++Xl, o = () => {
    r === e._endId && i();
  };
  if (n != null)
    return setTimeout(o, n);
  const { type: s, timeout: l, propCount: a } = Ql(e, t);
  if (!s)
    return i();
  const d = s + "end";
  let c = 0;
  const g = () => {
    e.removeEventListener(d, x), o();
  }, x = (I) => {
    I.target === e && ++c >= a && g();
  };
  setTimeout(() => {
    c < a && g();
  }, l + 1), e.addEventListener(d, x);
}
function Ql(e, t) {
  const n = window.getComputedStyle(e), i = (K) => (n[K] || "").split(", "), r = i(`${dt}Delay`), o = i(`${dt}Duration`), s = fr(r, o), l = i(`${Wt}Delay`), a = i(`${Wt}Duration`), d = fr(l, a);
  let c = null, g = 0, x = 0;
  t === dt ? s > 0 && (c = dt, g = s, x = o.length) : t === Wt ? d > 0 && (c = Wt, g = d, x = a.length) : (g = Math.max(s, d), c = g > 0 ? s > d ? dt : Wt : null, x = c ? c === dt ? o.length : a.length : 0);
  const I = c === dt && /\b(?:transform|all)(?:,|$)/.test(
    i(`${dt}Property`).toString()
  );
  return {
    type: c,
    timeout: g,
    propCount: x,
    hasTransform: I
  };
}
function fr(e, t) {
  for (; e.length < t.length; )
    e = e.concat(e);
  return Math.max(...t.map((n, i) => dr(n) + dr(e[i])));
}
function dr(e) {
  return e === "auto" ? 0 : Number(e.slice(0, -1).replace(",", ".")) * 1e3;
}
function pr(e) {
  return (e ? e.ownerDocument : document).body.offsetHeight;
}
function Zl(e, t, n) {
  const i = e[an];
  i && (t = (t ? [t, ...i] : [...i]).join(" ")), t == null ? e.removeAttribute("class") : n ? e.setAttribute("class", t) : e.className = t;
}
const gr = /* @__PURE__ */ Symbol("_vod"), ea = /* @__PURE__ */ Symbol("_vsh"), ta = /* @__PURE__ */ Symbol(""), na = /(?:^|;)\s*display\s*:/;
function ia(e, t, n) {
  const i = e.style, r = fe(n);
  let o = !1;
  if (n && !r) {
    if (t)
      if (fe(t))
        for (const s of t.split(";")) {
          const l = s.slice(0, s.indexOf(":")).trim();
          n[l] == null && Gt(i, l, "");
        }
      else
        for (const s in t)
          n[s] == null && Gt(i, s, "");
    for (const s in n) {
      s === "display" && (o = !0);
      const l = n[s];
      l != null ? oa(
        e,
        s,
        !fe(t) && t ? t[s] : void 0,
        l
      ) || Gt(i, s, l) : Gt(i, s, "");
    }
  } else if (r) {
    if (t !== n) {
      const s = i[ta];
      s && (n += ";" + s), i.cssText = n, o = na.test(n);
    }
  } else t && e.removeAttribute("style");
  gr in e && (e[gr] = o ? i.display : "", e[ea] && (i.display = "none"));
}
const hr = /\s*!important$/;
function Gt(e, t, n) {
  if (F(n))
    n.forEach((i) => Gt(e, t, i));
  else if (n == null && (n = ""), t.startsWith("--"))
    e.setProperty(t, n);
  else {
    const i = ra(e, t);
    hr.test(n) ? e.setProperty(
      It(i),
      n.replace(hr, ""),
      "important"
    ) : e[i] = n;
  }
}
const vr = ["Webkit", "Moz", "ms"], Qn = {};
function ra(e, t) {
  const n = Qn[t];
  if (n)
    return n;
  let i = $e(t);
  if (i !== "filter" && i in e)
    return Qn[t] = i;
  i = kr(i);
  for (let r = 0; r < vr.length; r++) {
    const o = vr[r] + i;
    if (o in e)
      return Qn[t] = o;
  }
  return t;
}
function oa(e, t, n, i) {
  return e.tagName === "TEXTAREA" && (t === "width" || t === "height") && fe(i) && n === i;
}
const mr = "http://www.w3.org/1999/xlink";
function yr(e, t, n, i, r, o = es(t)) {
  i && t.startsWith("xlink:") ? n == null ? e.removeAttributeNS(mr, t.slice(6, t.length)) : e.setAttributeNS(mr, t, n) : n == null || o && !Dr(n) ? e.removeAttribute(t) : e.setAttribute(
    t,
    o ? "" : Ze(n) ? String(n) : n
  );
}
function _r(e, t, n, i, r) {
  if (t === "innerHTML" || t === "textContent") {
    n != null && (e[t] = t === "innerHTML" ? Vo(n) : n);
    return;
  }
  const o = e.tagName;
  if (t === "value" && o !== "PROGRESS" && // custom elements may use _value internally
  !o.includes("-")) {
    const l = o === "OPTION" ? e.getAttribute("value") || "" : e.value, a = n == null ? (
      // #11647: value should be set as empty string for null and undefined,
      // but <input type="checkbox"> should be set as 'on'.
      e.type === "checkbox" ? "on" : ""
    ) : String(n);
    (l !== a || !("_value" in e)) && (e.value = a), n == null && e.removeAttribute(t), e._value = n;
    return;
  }
  let s = !1;
  if (n === "" || n == null) {
    const l = typeof e[t];
    l === "boolean" ? n = Dr(n) : n == null && l === "string" ? (n = "", s = !0) : l === "number" && (n = 0, s = !0);
  }
  try {
    e[t] = n;
  } catch {
  }
  s && e.removeAttribute(r || t);
}
function kt(e, t, n, i) {
  e.addEventListener(t, n, i);
}
function sa(e, t, n, i) {
  e.removeEventListener(t, n, i);
}
const br = /* @__PURE__ */ Symbol("_vei");
function la(e, t, n, i, r = null) {
  const o = e[br] || (e[br] = {}), s = o[t];
  if (i && s)
    s.value = i;
  else {
    const [l, a] = aa(t);
    if (i) {
      const d = o[t] = fa(
        i,
        r
      );
      kt(e, l, d, a);
    } else s && (sa(e, l, s, a), o[t] = void 0);
  }
}
const Sr = /(?:Once|Passive|Capture)$/;
function aa(e) {
  let t;
  if (Sr.test(e)) {
    t = {};
    let i;
    for (; i = e.match(Sr); )
      e = e.slice(0, e.length - i[0].length), t[i[0].toLowerCase()] = !0;
  }
  return [e[2] === ":" ? e.slice(3) : It(e.slice(2)), t];
}
let Zn = 0;
const ca = /* @__PURE__ */ Promise.resolve(), ua = () => Zn || (ca.then(() => Zn = 0), Zn = Date.now());
function fa(e, t) {
  const n = (i) => {
    if (!i._vts)
      i._vts = Date.now();
    else if (i._vts <= n.attached)
      return;
    He(
      da(i, n.value),
      t,
      5,
      [i]
    );
  };
  return n.value = e, n.attached = ua(), n;
}
function da(e, t) {
  if (F(t)) {
    const n = e.stopImmediatePropagation;
    return e.stopImmediatePropagation = () => {
      n.call(e), e._stopped = !0;
    }, t.map(
      (i) => (r) => !r._stopped && i && i(r)
    );
  } else
    return t;
}
const xr = (e) => e.charCodeAt(0) === 111 && e.charCodeAt(1) === 110 && // lowercase letter
e.charCodeAt(2) > 96 && e.charCodeAt(2) < 123, pa = (e, t, n, i, r, o) => {
  const s = r === "svg";
  t === "class" ? Zl(e, i, s) : t === "style" ? ia(e, n, i) : En(t) ? On(t) || la(e, t, n, i, o) : (t[0] === "." ? (t = t.slice(1), !0) : t[0] === "^" ? (t = t.slice(1), !1) : ga(e, t, i, s)) ? (_r(e, t, i), !e.tagName.includes("-") && (t === "value" || t === "checked" || t === "selected") && yr(e, t, i, s, o, t !== "value")) : /* #11081 force set props for possible async custom element */ e._isVueCE && // #12408 check if it's declared prop or it's async custom element
  (ha(e, t) || // @ts-expect-error _def is private
  e._def.__asyncLoader && (/[A-Z]/.test(t) || !fe(i))) ? _r(e, $e(t), i, o, t) : (t === "true-value" ? e._trueValue = i : t === "false-value" && (e._falseValue = i), yr(e, t, i, s));
};
function ga(e, t, n, i) {
  if (i)
    return !!(t === "innerHTML" || t === "textContent" || t in e && xr(t) && B(n));
  if (t === "spellcheck" || t === "draggable" || t === "translate" || t === "autocorrect" || t === "sandbox" && e.tagName === "IFRAME" || t === "form" || t === "list" && e.tagName === "INPUT" || t === "type" && e.tagName === "TEXTAREA")
    return !1;
  if (t === "width" || t === "height") {
    const r = e.tagName;
    if (r === "IMG" || r === "VIDEO" || r === "CANVAS" || r === "SOURCE")
      return !1;
  }
  return xr(t) && fe(n) ? !1 : t in e;
}
function ha(e, t) {
  const n = (
    // @ts-expect-error _def is private
    e._def.props
  );
  if (!n)
    return !1;
  const i = $e(t);
  return Array.isArray(n) ? n.some((r) => $e(r) === i) : Object.keys(n).some((r) => $e(r) === i);
}
const Pr = (e) => {
  const t = e.props["onUpdate:modelValue"] || !1;
  return F(t) ? (n) => yn(t, n) : t;
};
function va(e) {
  e.target.composing = !0;
}
function Cr(e) {
  const t = e.target;
  t.composing && (t.composing = !1, t.dispatchEvent(new Event("input")));
}
const ei = /* @__PURE__ */ Symbol("_assign");
function wr(e, t, n) {
  return t && (e = e.trim()), n && (e = _i(e)), e;
}
const ma = {
  created(e, { modifiers: { lazy: t, trim: n, number: i } }, r) {
    e[ei] = Pr(r);
    const o = i || r.props && r.props.type === "number";
    kt(e, t ? "change" : "input", (s) => {
      s.target.composing || e[ei](wr(e.value, n, o));
    }), (n || o) && kt(e, "change", () => {
      e.value = wr(e.value, n, o);
    }), t || (kt(e, "compositionstart", va), kt(e, "compositionend", Cr), kt(e, "change", Cr));
  },
  // set value on mounted so it's after min/max for type="range"
  mounted(e, { value: t }) {
    e.value = t ?? "";
  },
  beforeUpdate(e, { value: t, oldValue: n, modifiers: { lazy: i, trim: r, number: o } }, s) {
    if (e[ei] = Pr(s), e.composing) return;
    const l = (o || e.type === "number") && !/^0\d/.test(e.value) ? _i(e.value) : e.value, a = t ?? "";
    if (l === a)
      return;
    const d = e.getRootNode();
    (d instanceof Document || d instanceof ShadowRoot) && d.activeElement === e && e.type !== "range" && (i && t === n || r && e.value.trim() === a) || (e.value = a);
  }
}, ya = ["ctrl", "shift", "alt", "meta"], _a = {
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
  exact: (e, t) => ya.some((n) => e[`${n}Key`] && !t.includes(n))
}, ba = (e, t) => {
  if (!e) return e;
  const n = e._withMods || (e._withMods = {}), i = t.join(".");
  return n[i] || (n[i] = ((r, ...o) => {
    for (let s = 0; s < t.length; s++) {
      const l = _a[t[s]];
      if (l && l(r, t)) return;
    }
    return e(r, ...o);
  }));
}, Sa = /* @__PURE__ */ me({ patchProp: pa }, ql);
let Tr;
function xa() {
  return Tr || (Tr = Pl(Sa));
}
const Pa = ((...e) => {
  const t = xa().createApp(...e), { mount: n } = t;
  return t.mount = (i) => {
    const r = wa(i);
    if (!r) return;
    const o = t._component;
    !B(o) && !o.render && !o.template && (o.template = r.innerHTML), r.nodeType === 1 && (r.textContent = "");
    const s = n(r, !1, Ca(r));
    return r instanceof Element && (r.removeAttribute("v-cloak"), r.setAttribute("data-v-app", "")), s;
  }, t;
});
function Ca(e) {
  if (e instanceof SVGElement)
    return "svg";
  if (typeof MathMLElement == "function" && e instanceof MathMLElement)
    return "mathml";
}
function wa(e) {
  return fe(e) ? document.querySelector(e) : e;
}
function oe() {
  return typeof window < "u" && window.openxnetApp || null;
}
function Ta(e) {
  if (e && typeof e.isCurrentLanguageZh == "function")
    try {
      return !!e.isCurrentLanguageZh();
    } catch {
      return !0;
    }
  return String(e?.currentLanguage || navigator.language || "zh-CN").toLowerCase().startsWith("zh");
}
function $o(e, t) {
  return {
    service: t ? "模型服务" : "Provider Service",
    main: t ? "主模型" : "Main Model",
    fast: t ? "快速应答模型" : "Fast Model",
    reasoner: t ? "推理模型" : "Reasoner Model",
    vision: t ? "视觉模型" : "Vision Model",
    text2img: t ? "图像生成模型" : "Image Model",
    asr: t ? "语音识别模型" : "ASR Model",
    tts: t ? "语音合成模型" : "TTS Model"
  }[e] || e;
}
function Aa(e) {
  const t = String(e?.displayName || e?.vendor || e?.displayVendor || e?.id || "").trim();
  return t ? t.charAt(0).toUpperCase() : "P";
}
function Bo(e, t) {
  if (t && typeof t.getPrototypeProviderStatusTone == "function")
    return t.getPrototypeProviderStatusTone(e) || "muted";
  const n = !!String(e?.url || "").trim(), i = !!String(e?.modelId || "").trim();
  return n && i ? "success" : n ? "warning" : "muted";
}
function Ri(e, t, n) {
  if (t && typeof t.getPrototypeProviderStatusLabel == "function")
    return t.getPrototypeProviderStatusLabel(e);
  const i = !!String(e?.url || "").trim(), r = !!String(e?.modelId || "").trim();
  return i && r ? n ? "已连接" : "Connected" : i ? n ? "待选择模型" : "Model pending" : n ? "未配置" : "Not configured";
}
function Ia(e, t, n) {
  if (t && typeof t.getPrototypeProviderSummaryText == "function")
    return t.getPrototypeProviderSummaryText(e);
  const i = Array.isArray(e?.models) ? e.models.length : 0;
  return i > 0 ? n ? `${i} 个模型已配置` : `${i} models configured` : n ? "未设置" : "Unset";
}
function Ko(e, t) {
  return t && typeof t.getPrototypeProviderDisplayName == "function" ? t.getPrototypeProviderDisplayName(e) : String(e?.displayVendor || e?.vendor || e?.id || "").trim();
}
function Vi(e, t) {
  try {
    if (e && typeof e.getVendorLogo == "function")
      return String(e.getVendorLogo(t) || "").trim();
  } catch {
  }
  return "source/providers/logo.png";
}
function Nt(e, t) {
  try {
    if (e && typeof e.getProviderModelOptionValue == "function")
      return String(e.getProviderModelOptionValue(t) || "").trim();
  } catch {
  }
  return t && typeof t == "object" ? String(t.id || t.value || t.model || t.name || t.label || "").trim() : String(t || "").trim();
}
function cn(e, t) {
  try {
    if (e && typeof e.getProviderModelOptionLabel == "function")
      return String(e.getProviderModelOptionLabel(t) || "").trim();
  } catch {
  }
  return t && typeof t == "object" ? String(t.label || t.name || t.id || t.value || t.model || "").trim() : String(t || "").trim();
}
function $t(e) {
  if (e && typeof e.getPrototypeConfiguredProviders == "function")
    try {
      return e.getPrototypeConfiguredProviders() || [];
    } catch {
      return [];
    }
  return Array.isArray(e?.modelProviders) ? e.modelProviders : [];
}
function Ho(e) {
  const t = String(e?.vendor || "").trim(), n = String(e?.url || "").trim(), i = String(e?.modelId || "").trim(), r = String(e?.apiKey || "").trim(), o = Array.isArray(e?.models) ? e.models.map((s) => Nt(null, s)).filter(Boolean) : [];
  return !!(t || n || i || r || o.length);
}
function Bt(e) {
  if (e && typeof e.getPrototypeProviderTemplates == "function")
    try {
      return e.getPrototypeProviderTemplates() || [];
    } catch {
      return [];
    }
  return [];
}
function jo(e) {
  return String(e?.prototypeModelProviderSelection || "").trim();
}
function At(e, t) {
  e && (e.prototypeModelProviderSelection = String(t || "").trim());
}
function Ma(e, t) {
  const n = $t(e).filter((o) => e && typeof e.isPrototypeMeaningfulProvider == "function" ? e.isPrototypeMeaningfulProvider(o) : Ho(o)), i = jo(e), r = String(e?.settings?.selectedProvider || "").trim();
  return n.map((o) => {
    const s = String(o?.id || ""), l = s && e && typeof e.getProviderCardValidation == "function" ? e.getProviderCardValidation(s) : null, a = Array.isArray(o?.models) ? o.models.map((d) => ({
      value: Nt(e, d),
      label: cn(e, d)
    })).filter((d) => d.value) : [];
    return {
      id: s,
      vendor: String(o?.vendor || ""),
      displayName: Ko(o, e),
      summary: Ia(o, e, t),
      statusLabel: l?.status ? t ? { success: "验证通过", warning: "需关注", blocked: "阻塞", error: "异常" }[l.status] || l.status : { success: "Validated", warning: "Warning", blocked: "Blocked", error: "Error" }[l.status] || l.status : Ri(o, e, t),
      statusTone: l?.status || Bo(o, e),
      initial: Aa(o),
      isTemplate: !!o?.isTemplate,
      selected: i ? s === i : s === r,
      active: s === r,
      // 每张卡内联表单需要的字段：
      url: String(o?.url || ""),
      apiKey: String(o?.apiKey || ""),
      modelId: String(o?.modelId || ""),
      logo: Vi(e, o?.logoVendor || o?.setupVendor || o?.vendor),
      hasWebsite: !!String(e?.vendorAPIpage?.[o?.vendor] || "").trim(),
      isCustom: String(o?.vendor || "").toLowerCase() === "custom",
      rawModels: a,
      validationStatus: String(l?.status || "").trim(),
      validationMessage: String(l?.message || "").trim(),
      validationChecks: Array.isArray(l?.checks) ? l.checks : [],
      validationModels: Array.isArray(l?.models) ? l.models.map((d) => ({
        value: Nt(e, d),
        label: cn(e, d)
      })).filter((d) => d.value) : [],
      matchedModel: !!l?.matched_model,
      apiKeyConfigured: !!l?.api_key_configured,
      apiKeyOptional: !!l?.api_key_optional,
      isValidating: s && e && typeof e.isProviderCardValidating == "function" ? !!e.isProviderCardValidating(s) : !1,
      isApplying: s && e && typeof e.isProviderCardApplying == "function" ? !!e.isProviderCardApplying(s) : !1
    };
  });
}
const Ea = /* @__PURE__ */ new Set(["Ollama", "Vllm", "LMstudio", "xinference", "Dify", "newapi", "LocalAI", "ttswebui"]);
function Oa(e, t) {
  const n = Array.isArray(e?.vendorValues) ? e.vendorValues : [], i = String(e?.newProviderTemp?.vendor || "").trim();
  return n.map((r) => {
    const o = String(r || "").trim(), s = o.toLowerCase() === "custom", l = `vendor.${o}`;
    let a = "";
    if (e && typeof e.t == "function")
      try {
        a = String(e.t(l) || "").trim();
      } catch {
        a = "";
      }
    return (!a || a === l) && (a = s ? t ? "自定义 OpenAI" : "Custom OpenAI" : o), {
      value: o,
      label: a,
      logo: Vi(e, o),
      category: s ? "custom" : Ea.has(o) ? "local" : "cloud",
      selected: i === o,
      isCustom: s
    };
  });
}
function ht(e) {
  const t = jo(e), n = [...$t(e), ...Bt(e)];
  if (t) {
    const r = n.find((o) => String(o?.id || "") === t);
    if (r) return r;
  }
  if (e && typeof e.getPrototypeCurrentMainProvider == "function") {
    const r = e.getPrototypeCurrentMainProvider();
    if (r)
      return t || At(e, r.id), r;
  }
  const i = n[0] || null;
  return i && !t && At(e, i.id), i;
}
function ka(e, t) {
  const n = ht(e) || {}, i = !!n?.isTemplate, r = Array.isArray(n?.models) ? n.models.map((c) => e && typeof e.getProviderModelOptionValue == "function" ? e.getProviderModelOptionValue(c) : typeof c == "string" ? c : String(c?.id || c?.name || "")).filter(Boolean) : [], o = e?.newProviderTemp || {}, s = n?.id && e && typeof e.getProviderCardValidation == "function" ? e.getProviderCardValidation(n.id) : null, l = Bt(e), a = (Array.isArray(e?.vendorOptions) ? e.vendorOptions : []).filter((c) => c?.isUnlockHub), d = i && o.vendor ? o.vendor === "custom" ? "Azure OpenAI" : String(o.vendor || "").trim() : Ko(n, e);
  return {
    id: String(n?.id || ""),
    isTemplate: i,
    displayName: d || (t ? "新供应商" : "New Provider"),
    statusLabel: String(s?.status || "").trim() ? t ? { success: "验证通过", warning: "需关注", blocked: "阻塞", error: "异常" }[s.status] || s.status : { success: "Validated", warning: "Warning", blocked: "Blocked", error: "Error" }[s.status] || s.status : Ri(n, e, t),
    statusTone: String(s?.status || "").trim() || Bo(n, e),
    vendor: String(i ? o.vendor || n?.setupVendor || n?.vendor || "" : n?.vendor || ""),
    url: String(i ? o.url || "" : n?.url || ""),
    apiKey: String(i ? o.apiKey || "" : n?.apiKey || ""),
    modelId: String(i ? o.modelId || n?.modelId || "" : n?.modelId || ""),
    models: r.map((c) => ({
      value: Nt(e, c),
      label: cn(e, c)
    })),
    validationMessage: String(s?.message || ""),
    validationStatus: String(s?.status || ""),
    validationChecks: Array.isArray(s?.checks) ? s.checks : [],
    validationModels: Array.isArray(s?.models) ? s.models.map((c) => ({
      value: Nt(e, c),
      label: cn(e, c)
    })).filter((c) => c.value) : [],
    matchedModel: !!s?.matched_model,
    apiKeyConfigured: !!s?.api_key_configured,
    apiKeyOptional: !!s?.api_key_optional,
    isValidating: n?.id && e && typeof e.isProviderCardValidating == "function" ? !!e.isProviderCardValidating(n.id) : !1,
    isApplying: n?.id && e && typeof e.isProviderCardApplying == "function" ? !!e.isProviderCardApplying(n.id) : !1,
    isCurrentMain: String(e?.settings?.selectedProvider || "").trim() === String(n?.id || "").trim(),
    addOptions: [
      ...l.map((c) => ({
        value: String(c?.setupVendor || c?.vendor || "").trim(),
        label: String(c?.displayVendor || c?.vendor || c?.id || "").trim(),
        meta: String(c?.summaryText || "").trim(),
        isUnlockHub: !1,
        logo: Vi(e, c?.logoVendor || c?.setupVendor || c?.vendor),
        selected: String(o?.vendor || n?.setupVendor || n?.vendor || "").trim() === String(c?.setupVendor || c?.vendor || "").trim()
      })),
      ...a.map((c) => ({
        value: String(c?.value || "").trim(),
        label: String(c?.label || c?.value || "").trim(),
        meta: String(c?.meta || "").trim(),
        isUnlockHub: !0,
        logo: "",
        selected: !1
      }))
    ],
    validProvider: !!e?.validProvider,
    websiteUrl: String(e?.vendorAPIpage?.[o?.vendor || n?.vendor] || "").trim()
  };
}
function La(e) {
  return $t(e).filter((t) => e && typeof e.isPrototypeMeaningfulProvider == "function" ? e.isPrototypeMeaningfulProvider(t) : Ho(t)).map((t) => ({
    value: String(t?.id || ""),
    label: `${t?.vendor || "Provider"} · ${t?.modelId || t?.id || ""}`.trim()
  }));
}
function xt(e, t, n) {
  const i = {
    main: e?.settings,
    fast: e?.fastSettings,
    reasoner: e?.reasonerSettings,
    vision: e?.visionSettings,
    text2img: e?.text2imgSettings,
    asr: e?.asrSettings,
    tts: e?.ttsSettings
  }, r = {
    main: "selectMainProvider",
    fast: "selectFastProvider",
    reasoner: "selectReasonerProvider",
    vision: "selectVisionProvider",
    text2img: "selectText2imgProvider",
    asr: "selectAsrProvider",
    tts: "selectTTSProvider"
  }, o = i[t] || {}, s = String(o?.selectedProvider || ""), l = s && Array.isArray(e?.modelProviders) ? e.modelProviders.find((a) => String(a?.id || "") === s) : null;
  return {
    id: t,
    label: $o(t, n),
    methodName: r[t],
    selectedProvider: s,
    selectedProviderName: l ? `${l.vendor || "Provider"} / ${l.modelId || (n ? "待选择模型" : "Model pending")}` : n ? "未选择供应商" : "No provider selected",
    selectedProviderStatus: l ? Ri(l, e, n) : n ? "未绑定" : "Unbound",
    providerOptions: La(e),
    providerModels: Array.isArray(l?.models) ? l.models.map((a) => ({
      value: Nt(e, a),
      label: cn(e, a)
    })).filter((a) => a.value) : [],
    model: String(o?.model || ""),
    base_url: String(o?.base_url || ""),
    api_key: String(o?.api_key || ""),
    temperature: o?.temperature,
    max_tokens: o?.max_tokens,
    top_p: o?.top_p,
    reasoning_effort: o?.reasoning_effort,
    enabled: typeof o?.enabled == "boolean" ? o.enabled : null
  };
}
function Da() {
  const e = oe(), t = Ta(e), n = Array.isArray(e?.modelTiles) ? e.modelTiles.map((o) => ({
    id: String(o?.id || ""),
    label: $o(o?.id, t)
  })) : [], i = String(e?.subMenu || "service"), r = e?.newProviderTemp || {};
  return {
    isZh: t,
    activeMenu: String(e?.activeMenu || ""),
    activeTab: i,
    tabs: n,
    service: {
      providers: Ma(e, t),
      current: ka(e, t),
      totalConfigured: e && typeof e.getPrototypeProviderReadyCount == "function" ? e.getPrototypeProviderReadyCount() : $t(e).length,
      totalTemplates: Bt(e).length,
      currentMainId: String(e?.settings?.selectedProvider || "").trim()
    },
    addDialog: {
      visible: !!e?.showAddDialog,
      vendor: String(r?.vendor || "").trim(),
      url: String(r?.url || "").trim(),
      apiKey: String(r?.apiKey || "").trim(),
      modelId: String(r?.modelId || "").trim(),
      vendorOptions: Oa(e, t),
      validProvider: !!e?.validProvider,
      websiteUrl: String(e?.vendorAPIpage?.[r?.vendor || ""] || "").trim()
    },
    slots: [
      xt(e, "main", t),
      xt(e, "fast", t),
      xt(e, "reasoner", t),
      xt(e, "vision", t),
      xt(e, "text2img", t),
      xt(e, "asr", t),
      xt(e, "tts", t)
    ]
  };
}
function Kn(e, t) {
  const n = String(t || "").trim();
  return n && (Array.isArray(e?.modelProviders) ? e.modelProviders : []).find((i) => String(i?.id || "") === n) || null;
}
async function Fa(e) {
  const t = oe();
  t && (t.activeMenu = "model-config", t.subMenu = e);
}
async function Ra() {
  const e = oe();
  if (!e) return;
  e.activeMenu = "model-config", e.subMenu = "service";
  const n = Bt(e)[0] || null;
  n?.id && (At(e, n.id), typeof e.handleSelectVendor == "function" && e.handleSelectVendor(n.setupVendor || n.vendor || "custom"));
}
async function Va(e) {
  const t = oe();
  if (!t) return;
  const i = [...$t(t), ...Bt(t)].find((r) => String(r?.id || "") === String(e || ""));
  i && (At(t, i.id), i.isTemplate && typeof t.handleSelectVendor == "function" && t.handleSelectVendor(i.setupVendor || i.vendor || "custom"));
}
async function Na(e, t) {
  const n = oe();
  if (!n) return;
  const i = ht(n);
  if (i?.isTemplate)
    n.newProviderTemp[e] = t;
  else if (i && (i[e] = t, typeof n.handleProviderDraftChange == "function")) {
    await n.handleProviderDraftChange(i.id);
    return;
  }
  typeof n.autoSaveSettings == "function" && await n.autoSaveSettings();
}
async function $a(e) {
  const t = oe();
  !t || typeof t.handleSelectVendor != "function" || t.handleSelectVendor(e);
}
async function Ba() {
  const e = oe();
  if (!e) return { ok: !1 };
  const t = ht(e);
  if (t?.isTemplate && typeof e.confirmAddProvider == "function") {
    const n = {
      vendor: String(e?.newProviderTemp?.vendor || t?.vendor || "").trim(),
      url: String(e?.newProviderTemp?.url || t?.url || "").trim(),
      apiKey: String(e?.newProviderTemp?.apiKey || t?.apiKey || "").trim(),
      modelId: String(e?.newProviderTemp?.modelId || t?.modelId || "").trim()
    }, i = typeof e?.buildProviderCardIdentity == "function" ? String(e.buildProviderCardIdentity(n) || "").trim() : `${n.vendor.toLowerCase()}::${n.url.replace(/\/+$/, "").toLowerCase()}::${n.modelId.toLowerCase()}`, r = new Set(
      (Array.isArray(e.modelProviders) ? e.modelProviders : []).map((s) => String(s?.id || "").trim()).filter(Boolean)
    );
    await e.confirmAddProvider();
    const o = (Array.isArray(e.modelProviders) ? e.modelProviders : []).find((s) => {
      const l = typeof e?.buildProviderCardIdentity == "function" ? String(e.buildProviderCardIdentity(s) || "").trim() : `${String(s?.vendor || "").trim().toLowerCase()}::${String(s?.url || "").trim().replace(/\/+$/, "").toLowerCase()}::${String(s?.modelId || "").trim().toLowerCase()}`;
      return l && l === i;
    }) || (Array.isArray(e.modelProviders) ? e.modelProviders.find((s) => !r.has(String(s?.id || "").trim())) : null) || (Array.isArray(e.modelProviders) ? e.modelProviders : [])[0] || null;
    return o?.id ? (At(e, o.id), typeof e.selectModelProviderForUiplan == "function" && e.selectModelProviderForUiplan(o), {
      ok: !0,
      providerId: String(o.id),
      mode: "added"
    }) : { ok: !1 };
  } else if (t && typeof e.applyProviderCardToMain == "function")
    return await e.applyProviderCardToMain(t), At(e, t.id), {
      ok: !0,
      providerId: String(t.id || ""),
      mode: "applied"
    };
  return { ok: !1 };
}
async function Ka() {
  const e = oe();
  if (!e) return;
  const t = ht(e);
  t && typeof e.validateProviderCard == "function" && await e.validateProviderCard(t);
}
async function Ha() {
  const e = oe();
  if (!e) return;
  const t = ht(e);
  t && typeof e.fetchModelsForProvider == "function" && await e.fetchModelsForProvider(t);
}
async function ja() {
  const e = oe();
  if (!e) return;
  const t = ht(e);
  t?.id && typeof e.copyProviderById == "function" && e.copyProviderById(t.id);
}
async function Ua() {
  const e = oe();
  if (!e) return;
  const t = ht(e);
  if (t?.id && typeof e.removeProviderById == "function") {
    await e.removeProviderById(t.id);
    const n = [...$t(e), ...Bt(e)][0] || null;
    At(e, n?.id || "");
  }
}
function Wa() {
  const e = oe();
  if (!e) return;
  const t = ht(e);
  t && typeof e.goToURL == "function" && e.goToURL(t);
}
async function qa(e, t) {
  const n = oe();
  if (!n) return;
  const r = {
    main: "selectMainProvider",
    fast: "selectFastProvider",
    reasoner: "selectReasonerProvider",
    vision: "selectVisionProvider",
    text2img: "selectText2imgProvider",
    asr: "selectAsrProvider",
    tts: "selectTTSProvider"
  }[e];
  r && typeof n[r] == "function" && await n[r](t || null);
}
async function Ga(e, t, n) {
  const i = oe();
  if (!i) return;
  const r = Kn(i, e);
  if (r) {
    if (r[t] = n, typeof i.handleProviderDraftChange == "function") {
      await i.handleProviderDraftChange(r.id);
      return;
    }
    typeof i.autoSaveSettings == "function" && await i.autoSaveSettings();
  }
}
async function Ja(e) {
  const t = oe();
  t && (typeof t.selectMainProvider == "function" ? await t.selectMainProvider(String(e || "").trim()) : t.settings && (t.settings.selectedProvider = String(e || "").trim(), typeof t.autoSaveSettings == "function" && await t.autoSaveSettings()));
}
async function za(e) {
  const t = oe();
  if (!t) return;
  const n = Kn(t, e);
  n && typeof t.validateProviderCard == "function" && await t.validateProviderCard(n);
}
async function Ya(e) {
  const t = oe();
  if (!t) return;
  const n = Kn(t, e);
  n && typeof t.fetchModelsForProvider == "function" && await t.fetchModelsForProvider(n);
}
async function Xa(e) {
  const t = oe();
  t && typeof t.copyProviderById == "function" && t.copyProviderById(String(e || "").trim());
}
async function Qa(e) {
  const t = oe();
  t && typeof t.removeProviderById == "function" && await t.removeProviderById(String(e || "").trim());
}
function Za(e) {
  const t = oe();
  if (!t) return;
  const n = Kn(t, e);
  n && typeof t.goToURL == "function" && t.goToURL(n);
}
function ec(e) {
  const t = String(e || "");
  if (t) {
    if (typeof navigator < "u" && navigator.clipboard && typeof navigator.clipboard.writeText == "function") {
      navigator.clipboard.writeText(t).catch(() => {
      });
      return;
    }
    try {
      const n = document.createElement("textarea");
      n.value = t, n.setAttribute("readonly", ""), n.style.position = "absolute", n.style.left = "-9999px", document.body.appendChild(n), n.select(), document.execCommand && document.execCommand("copy"), document.body.removeChild(n);
    } catch {
    }
  }
}
function tc() {
  const e = oe();
  e && (e.newProviderTemp = { vendor: "", url: "", apiKey: "", modelId: "" }, e.showAddDialog = !0);
}
function nc() {
  const e = oe();
  e && (e.showAddDialog = !1);
}
function ic(e) {
  const t = oe();
  if (t) {
    if (typeof t.handleSelectVendor == "function") {
      t.handleSelectVendor(String(e || "").trim());
      return;
    }
    t.newProviderTemp || (t.newProviderTemp = { vendor: "", url: "", apiKey: "", modelId: "" }), t.newProviderTemp.vendor = String(e || "").trim(), typeof t.handleVendorChange == "function" && t.handleVendorChange(t.newProviderTemp.vendor);
  }
}
function rc(e, t) {
  const n = oe();
  n && (n.newProviderTemp || (n.newProviderTemp = { vendor: "", url: "", apiKey: "", modelId: "" }), n.newProviderTemp[e] = t);
}
async function oc() {
  const e = oe();
  return e && typeof e.confirmAddProvider == "function" ? (await e.confirmAddProvider(), !0) : !1;
}
function sc() {
  const e = oe();
  if (!e) return;
  const t = String(e?.newProviderTemp?.vendor || "").trim(), n = String(e?.vendorAPIpage?.[t] || "").trim();
  if (n && typeof e.goToURL == "function")
    e.goToURL({ url: n });
  else if (n && typeof window < "u")
    try {
      window.open(n, "_blank");
    } catch {
    }
}
async function lc(e, t, n) {
  const i = oe();
  if (!i) return;
  const o = {
    main: i.settings,
    fast: i.fastSettings,
    reasoner: i.reasonerSettings,
    vision: i.visionSettings,
    text2img: i.text2imgSettings,
    asr: i.asrSettings,
    tts: i.ttsSettings
  }[e];
  o && (o[t] = n, typeof i.autoSaveSettings == "function" && await i.autoSaveSettings());
}
function ac() {
  return {
    snapshot: Da,
    selectTab: Fa,
    prepareAddProvider: Ra,
    selectProviderCard: Va,
    updateServiceField: Na,
    selectServiceVendor: $a,
    saveServiceProvider: Ba,
    validateCurrentProvider: Ka,
    fetchCurrentProviderModels: Ha,
    copyCurrentProvider: ja,
    removeCurrentProvider: Ua,
    openCurrentProviderWebsite: Wa,
    // 新增：per-provider 与 Add Dialog
    updateProviderFieldById: Ga,
    selectProviderAsMain: Ja,
    validateProviderById: za,
    fetchModelsById: Ya,
    copyProviderById: Xa,
    removeProviderById: Qa,
    openProviderWebsiteById: Za,
    copyToClipboard: ec,
    openAddDialog: tc,
    closeAddDialog: nc,
    selectVendorInDialog: ic,
    setDialogField: rc,
    confirmAddDialog: oc,
    openVendorWebsiteFromDialog: sc,
    selectSlotProvider: qa,
    updateSlotField: lc
  };
}
const cc = { class: "ox-vite-model-shell" }, uc = { class: "ox-vite-model-header" }, fc = { class: "ox-vite-model-tabs" }, dc = ["onClick"], pc = {
  key: 0,
  class: "ox-vite-model-feedback"
}, gc = {
  key: 0,
  class: "ox-vite-model-service"
}, hc = { class: "oxm-service-grid" }, vc = {
  key: 0,
  class: "oxm-service-empty"
}, mc = { class: "oxm-provider-card__head" }, yc = { class: "oxm-provider-card__brand" }, _c = ["src", "alt"], bc = { class: "oxm-provider-card__name" }, Sc = {
  key: 0,
  class: "oxm-provider-card__main-tag"
}, xc = { class: "oxm-provider-card__actions" }, Pc = ["title", "onClick"], Cc = ["title", "onClick"], wc = ["title", "disabled", "onClick"], Tc = ["title", "onClick"], Ac = { class: "oxm-provider-card__form" }, Ic = { class: "oxm-field" }, Mc = ["title", "onClick"], Ec = ["value", "placeholder", "onInput"], Oc = { class: "oxm-field" }, kc = ["title", "onClick"], Lc = { class: "oxm-input-with-affix" }, Dc = ["type", "value", "placeholder", "onInput"], Fc = ["title", "onClick"], Rc = { class: "oxm-field" }, Vc = ["title", "onClick"], Nc = ["value", "placeholder", "onInput"], $c = {
  key: 1,
  class: "oxm-model-select"
}, Bc = ["value", "placeholder", "onInput"], Kc = { class: "oxm-model-list" }, Hc = { class: "oxm-model-list__items" }, jc = ["onClick"], Uc = {
  key: 1,
  class: "oxm-card-footer"
}, Wc = ["onClick"], qc = { class: "oxm-add-tile__label" }, Gc = { class: "oxm-dialog-shell" }, Jc = { class: "oxm-dialog__head" }, zc = ["title"], Yc = { class: "oxm-dialog__body" }, Xc = { class: "oxm-dialog__filter-row" }, Qc = { class: "oxm-dialog__search" }, Zc = ["placeholder"], eu = { class: "oxm-dialog__filter-tabs" }, tu = { class: "oxm-vendor-grid" }, nu = ["onClick"], iu = { class: "oxm-vendor-card__logo-wrap" }, ru = ["src", "alt"], ou = { class: "oxm-vendor-card__name" }, su = {
  key: 0,
  class: "oxm-vendor-empty"
}, lu = {
  key: 0,
  class: "oxm-pager"
}, au = ["disabled", "title"], cu = { class: "oxm-pager__pages" }, uu = ["onClick"], fu = ["disabled", "title"], du = { class: "oxm-pager__hint" }, pu = {
  key: 1,
  class: "oxm-dialog__form"
}, gu = { class: "oxm-dialog__form-head" }, hu = ["src", "alt"], vu = { key: 0 }, mu = { key: 1 }, yu = { class: "oxm-dialog__form-grid" }, _u = { class: "oxm-field oxm-field--full" }, bu = ["value", "placeholder"], Su = { class: "oxm-field" }, xu = ["value", "placeholder"], Pu = { class: "oxm-field" }, Cu = ["value", "placeholder"], wu = { class: "oxm-dialog__foot" }, Tu = ["disabled"], Au = {
  key: 1,
  class: "ox-vite-model-slot-panel"
}, Iu = { class: "ox-vite-model-slot-header" }, Mu = { class: "ox-vite-model-slot-status" }, Eu = { class: "ox-vite-model-slot-grid" }, Ou = { class: "ox-vite-model-field" }, ku = ["value"], Lu = { value: "" }, Du = ["value"], Fu = { class: "ox-vite-model-field" }, Ru = ["value"], Vu = {
  key: 0,
  class: "ox-vite-model-slot-models"
}, Nu = ["onClick"], $u = { class: "ox-vite-model-field" }, Bu = ["value"], Ku = { class: "ox-vite-model-field" }, Hu = ["value"], ju = {
  key: 1,
  class: "ox-vite-model-field"
}, Uu = ["value"], Wu = {
  key: 2,
  class: "ox-vite-model-field"
}, qu = ["value"], Gu = {
  key: 3,
  class: "ox-vite-model-field"
}, Ju = ["value"], zu = {
  key: 4,
  class: "ox-vite-model-field"
}, Yu = ["value"], Xu = {
  key: 5,
  class: "ox-vite-model-switch"
}, Qu = ["checked"], ti = 14, Zu = {
  __name: "App",
  setup(e) {
    const t = ac(), n = /* @__PURE__ */ Et(t.snapshot()), i = /* @__PURE__ */ Et({
      visible: !1,
      text: ""
    });
    let r = null, o = null;
    function s() {
      n.value = t.snapshot();
    }
    function l(O) {
      i.value = {
        visible: !0,
        text: String(O || "").trim()
      }, o && window.clearTimeout(o), o = window.setTimeout(() => {
        i.value.visible = !1;
      }, 2600);
    }
    function a(O) {
      t.selectTab(O), s();
    }
    function d() {
      t.openAddDialog(), s();
    }
    function c(O, m, v) {
      const j = v && v.target ? v.target.value : v;
      t.updateProviderFieldById(O, m, j), s();
    }
    function g(O, m) {
      t.updateProviderFieldById(O, "modelId", m), s();
    }
    function x(O) {
      O && (t.copyToClipboard(O), l(M.value ? "已复制到剪贴板" : "Copied to clipboard"));
    }
    function I(O) {
      t.copyProviderById(O), s(), l(M.value ? "已复制为新服务商" : "Provider duplicated");
    }
    function K(O) {
      t.openProviderWebsiteById(O);
    }
    function L(O) {
      t.fetchModelsById(O), s();
    }
    function se(O) {
      t.removeProviderById(O), s(), l(M.value ? "服务商已删除" : "Provider removed");
    }
    function Y(O) {
      t.selectProviderAsMain(O), s(), l(M.value ? "已设为主模型服务商" : "Set as main provider");
    }
    const N = /* @__PURE__ */ Et({});
    function J(O) {
      N.value = {
        ...N.value,
        [O]: !N.value[O]
      };
    }
    const E = /* @__PURE__ */ Et(""), W = /* @__PURE__ */ Et("all"), ue = /* @__PURE__ */ Et(1);
    function ye(O) {
      t.selectVendorInDialog(O), s();
    }
    function ve(O, m) {
      const v = m && m.target ? m.target.value : m;
      t.setDialogField(O, v), s();
    }
    function $() {
      t.closeAddDialog(), E.value = "", W.value = "all", ue.value = 1, s();
    }
    async function Q() {
      const O = await t.confirmAddDialog();
      s(), O && (E.value = "", W.value = "all", ue.value = 1, l(M.value ? "服务商已添加" : "Provider added"));
    }
    function ce() {
      t.openVendorWebsiteFromDialog();
    }
    const T = De(() => n.value.addDialog || { visible: !1, vendorOptions: [] }), te = De(() => {
      const O = T.value.vendorOptions || [], m = String(E.value || "").trim().toLowerCase(), v = W.value;
      return O.filter((j) => v === "cloud" && j.category === "local" || v === "local" && j.category !== "local" ? !1 : m ? String(j.label || "").toLowerCase().includes(m) || String(j.value || "").toLowerCase().includes(m) : !0);
    });
    bn([E, W], () => {
      ue.value = 1;
    });
    const de = De(() => {
      const O = te.value.length;
      return O <= 0 ? 1 : Math.max(1, Math.ceil(O / ti));
    }), xe = De(() => {
      const O = Number(ue.value || 1);
      return !Number.isFinite(O) || O < 1 ? 1 : Math.min(O, de.value);
    }), pe = De(() => {
      const O = te.value, m = (xe.value - 1) * ti;
      return O.slice(m, m + ti);
    });
    function ne(O) {
      const m = de.value;
      let v = Number(O);
      Number.isFinite(v) || (v = 1), v < 1 && (v = 1), v > m && (v = m), ue.value = v;
    }
    const G = De(
      () => (T.value.vendorOptions || []).find((O) => O.selected) || null
    );
    function et(O, m) {
      t.selectSlotProvider(O, m.target.value), s();
    }
    function ke(O, m, v) {
      let j = v.target.value;
      (m === "temperature" || m === "top_p") && (j = Number(j)), m === "max_tokens" && (j = Number(j)), t.updateSlotField(O, m, j);
    }
    function tt(O, m) {
      t.updateSlotField(O, "model", m), s();
    }
    const M = De(() => n.value.isZh), pn = De(() => n.value.tabs || []), Kt = De(() => n.value.activeTab || "service"), gn = De(() => n.value.service || { providers: [], current: {} }), vt = De(() => Object.fromEntries((n.value.slots || []).map((O) => [O.id, O]))), H = De(() => vt.value[Kt.value] || null);
    return Oi(() => {
      s(), r = window.setInterval(s, 400);
    }), ki(() => {
      r && (window.clearInterval(r), r = null), o && (window.clearTimeout(o), o = null);
    }), (O, m) => (U(), q("div", cc, [
      p("div", uc, [
        p("div", null, [
          p("h1", null, R(M.value ? "模型配置" : "Model Configuration"), 1),
          p("p", null, R(M.value ? "管理 AI 模型提供商和 API 密钥" : "Manage providers, API keys, and runtime model slots."), 1)
        ]),
        p("button", {
          type: "button",
          class: "ox-vite-model-primary-btn",
          onClick: d
        }, [
          m[22] || (m[22] = p("i", { class: "fa-solid fa-plus" }, null, -1)),
          p("span", null, R(M.value ? "添加提供商" : "Add Provider"), 1)
        ])
      ]),
      p("div", fc, [
        (U(!0), q(Se, null, yt(pn.value, (v) => (U(), q("button", {
          key: v.id,
          type: "button",
          class: Oe(["ox-vite-model-tab", { active: Kt.value === v.id }]),
          onClick: (j) => a(v.id)
        }, R(v.label), 11, dc))), 128))
      ]),
      Me(lr, { name: "ox-vite-model-feedback" }, {
        default: li(() => [
          i.value.visible ? (U(), q("div", pc, [
            m[23] || (m[23] = p("i", { class: "fa-solid fa-circle-check" }, null, -1)),
            p("span", null, R(i.value.text), 1)
          ])) : he("", !0)
        ]),
        _: 1
      }),
      Kt.value === "service" ? (U(), q("div", gc, [
        p("div", hc, [
          gn.value.providers.length ? he("", !0) : (U(), q("div", vc, [
            m[24] || (m[24] = p("i", { class: "fa-solid fa-plug-circle-plus" }, null, -1)),
            p("strong", null, R(M.value ? "还没有已配置的服务商" : "No configured providers yet"), 1),
            p("p", null, R(M.value ? "点击右下角磁贴添加新服务商，并在卡片里直接填写 API 地址、密钥与模型 ID。" : "Click the “Add Provider” tile to start; fill in URL, key and model directly on the card."), 1)
          ])),
          (U(!0), q(Se, null, yt(gn.value.providers, (v) => (U(), q("div", {
            key: v.id,
            class: Oe(["oxm-provider-card", { "is-current-main": v.active, [`is-${v.statusTone}`]: !!v.statusTone }])
          }, [
            p("div", mc, [
              p("div", yc, [
                p("img", {
                  src: v.logo,
                  alt: v.displayName,
                  class: "oxm-provider-card__logo"
                }, null, 8, _c),
                p("div", bc, [
                  p("strong", null, R(v.displayName), 1),
                  v.active ? (U(), q("span", Sc, R(M.value ? "主服务商" : "Main"), 1)) : he("", !0)
                ])
              ]),
              p("div", xc, [
                p("button", {
                  type: "button",
                  class: "oxm-icon-btn",
                  title: M.value ? "复制为新卡" : "Duplicate",
                  onClick: (j) => I(v.id)
                }, [...m[25] || (m[25] = [
                  p("i", { class: "fa-solid fa-copy" }, null, -1)
                ])], 8, Pc),
                v.hasWebsite ? (U(), q("button", {
                  key: 0,
                  type: "button",
                  class: "oxm-icon-btn",
                  title: M.value ? "获取 API Key" : "Get API Key",
                  onClick: (j) => K(v.id)
                }, [...m[26] || (m[26] = [
                  p("i", { class: "fa-solid fa-key" }, null, -1)
                ])], 8, Cc)) : he("", !0),
                p("button", {
                  type: "button",
                  class: "oxm-icon-btn oxm-icon-btn--accent",
                  title: M.value ? "拉取模型列表" : "Fetch model list",
                  disabled: v.isValidating,
                  onClick: (j) => L(v.id)
                }, [...m[27] || (m[27] = [
                  p("i", { class: "fa-solid fa-magnifying-glass" }, null, -1)
                ])], 8, wc),
                p("button", {
                  type: "button",
                  class: "oxm-icon-btn oxm-icon-btn--danger",
                  title: M.value ? "删除" : "Delete",
                  onClick: (j) => se(v.id)
                }, [...m[28] || (m[28] = [
                  p("i", { class: "fa-solid fa-trash" }, null, -1)
                ])], 8, Tc)
              ])
            ]),
            p("div", Ac, [
              p("div", Ic, [
                p("label", null, [
                  p("span", null, R(M.value ? "API 地址" : "API URL"), 1),
                  p("button", {
                    type: "button",
                    class: "oxm-field-copy",
                    title: M.value ? "复制" : "Copy",
                    onClick: (j) => x(v.url)
                  }, [...m[29] || (m[29] = [
                    p("i", { class: "fa-solid fa-copy" }, null, -1)
                  ])], 8, Mc)
                ]),
                p("input", {
                  type: "text",
                  value: v.url,
                  placeholder: (M.value, "https://api.example.com/v1"),
                  onInput: (j) => c(v.id, "url", j)
                }, null, 40, Ec)
              ]),
              p("div", Oc, [
                p("label", null, [
                  p("span", null, R(M.value ? "API 密钥" : "API Key"), 1),
                  p("button", {
                    type: "button",
                    class: "oxm-field-copy",
                    title: M.value ? "复制" : "Copy",
                    onClick: (j) => x(v.apiKey)
                  }, [...m[30] || (m[30] = [
                    p("i", { class: "fa-solid fa-copy" }, null, -1)
                  ])], 8, kc)
                ]),
                p("div", Lc, [
                  p("input", {
                    type: N.value[v.id] ? "text" : "password",
                    value: v.apiKey,
                    placeholder: (M.value, "sk-..."),
                    onInput: (j) => c(v.id, "apiKey", j)
                  }, null, 40, Dc),
                  p("button", {
                    type: "button",
                    class: "oxm-input-affix",
                    title: N.value[v.id] ? M.value ? "隐藏" : "Hide" : M.value ? "显示" : "Show",
                    onClick: (j) => J(v.id)
                  }, [
                    p("i", {
                      class: Oe(N.value[v.id] ? "fa-solid fa-eye-slash" : "fa-solid fa-eye")
                    }, null, 2)
                  ], 8, Fc)
                ])
              ]),
              p("div", Rc, [
                p("label", null, [
                  p("span", null, R(M.value ? "模型 ID（可手动填写）" : "Model ID (manual or list)"), 1),
                  p("button", {
                    type: "button",
                    class: "oxm-field-copy",
                    title: M.value ? "复制" : "Copy",
                    onClick: (j) => x(v.modelId)
                  }, [...m[31] || (m[31] = [
                    p("i", { class: "fa-solid fa-copy" }, null, -1)
                  ])], 8, Vc)
                ]),
                !v.rawModels || !v.rawModels.length ? (U(), q("input", {
                  key: 0,
                  type: "text",
                  value: v.modelId,
                  placeholder: M.value ? "点击放大镜可获取模型列表" : "Type or click the search icon to fetch",
                  onInput: (j) => c(v.id, "modelId", j)
                }, null, 40, Nc)) : (U(), q("div", $c, [
                  p("input", {
                    type: "text",
                    value: v.modelId,
                    placeholder: M.value ? "选择或输入模型" : "Select or type a model",
                    onInput: (j) => c(v.id, "modelId", j)
                  }, null, 40, Bc),
                  p("details", Kc, [
                    m[32] || (m[32] = p("summary", null, [
                      p("i", { class: "fa-solid fa-chevron-down" })
                    ], -1)),
                    p("div", Hc, [
                      (U(!0), q(Se, null, yt(v.rawModels, (j) => (U(), q("button", {
                        key: `${v.id}-${j.value}`,
                        type: "button",
                        class: Oe(["oxm-model-list__item", { "is-active": v.modelId === j.value }]),
                        onClick: (u) => g(v.id, j.value)
                      }, R(j.label), 11, jc))), 128))
                    ])
                  ])
                ]))
              ]),
              v.validationMessage ? (U(), q("div", {
                key: 0,
                class: Oe(["oxm-validation", `is-${v.validationStatus || "success"}`])
              }, [
                m[33] || (m[33] = p("i", { class: "fa-solid fa-circle-info" }, null, -1)),
                p("span", null, R(v.validationMessage), 1)
              ], 2)) : he("", !0),
              v.active ? he("", !0) : (U(), q("div", Uc, [
                p("button", {
                  type: "button",
                  class: "oxm-secondary-btn",
                  onClick: (j) => Y(v.id)
                }, [
                  m[34] || (m[34] = p("i", { class: "fa-solid fa-circle-check" }, null, -1)),
                  p("span", null, R(M.value ? "设为主服务商" : "Set as main"), 1)
                ], 8, Wc)
              ]))
            ])
          ], 2))), 128)),
          p("button", {
            type: "button",
            class: "oxm-provider-card oxm-provider-card--add",
            onClick: d
          }, [
            m[35] || (m[35] = p("div", { class: "oxm-add-tile__plus" }, [
              p("i", { class: "fa-solid fa-plus" })
            ], -1)),
            p("span", qc, R(M.value ? "添加新供应商" : "Add New Provider"), 1)
          ])
        ]),
        Me(lr, { name: "oxm-dialog" }, {
          default: li(() => [
            T.value.visible ? (U(), q("div", {
              key: 0,
              class: "oxm-dialog-mask",
              onClick: ba($, ["self"])
            }, [
              p("div", Gc, [
                p("div", Jc, [
                  p("h2", null, R(M.value ? "添加新供应商" : "Add New Provider"), 1),
                  p("button", {
                    type: "button",
                    class: "oxm-icon-btn",
                    title: M.value ? "关闭" : "Close",
                    onClick: $
                  }, [...m[36] || (m[36] = [
                    p("i", { class: "fa-solid fa-xmark" }, null, -1)
                  ])], 8, zc)
                ]),
                p("div", Yc, [
                  p("div", Xc, [
                    p("div", Qc, [
                      m[37] || (m[37] = p("i", { class: "fa-solid fa-magnifying-glass" }, null, -1)),
                      Rs(p("input", {
                        "onUpdate:modelValue": m[0] || (m[0] = (v) => E.value = v),
                        type: "text",
                        placeholder: M.value ? "搜索供应商" : "Search providers"
                      }, null, 8, Zc), [
                        [ma, E.value]
                      ])
                    ]),
                    p("div", eu, [
                      p("button", {
                        type: "button",
                        class: Oe({ "is-active": W.value === "all" }),
                        onClick: m[1] || (m[1] = (v) => W.value = "all")
                      }, R(M.value ? "全部" : "All"), 3),
                      p("button", {
                        type: "button",
                        class: Oe({ "is-active": W.value === "cloud" }),
                        onClick: m[2] || (m[2] = (v) => W.value = "cloud")
                      }, R(M.value ? "云端" : "Cloud"), 3),
                      p("button", {
                        type: "button",
                        class: Oe({ "is-active": W.value === "local" }),
                        onClick: m[3] || (m[3] = (v) => W.value = "local")
                      }, R(M.value ? "本地" : "Local"), 3)
                    ])
                  ]),
                  p("div", tu, [
                    (U(!0), q(Se, null, yt(pe.value, (v) => (U(), q("button", {
                      key: v.value,
                      type: "button",
                      class: Oe(["oxm-vendor-card", { "is-selected": v.selected, "is-custom": v.isCustom }]),
                      onClick: (j) => ye(v.value)
                    }, [
                      p("div", iu, [
                        p("img", {
                          src: v.logo,
                          alt: v.label
                        }, null, 8, ru)
                      ]),
                      p("span", ou, R(v.label), 1)
                    ], 10, nu))), 128)),
                    te.value.length ? he("", !0) : (U(), q("div", su, [
                      m[38] || (m[38] = p("i", { class: "fa-solid fa-circle-info" }, null, -1)),
                      p("span", null, R(M.value ? "没有匹配的供应商" : "No matching providers"), 1)
                    ]))
                  ]),
                  de.value > 1 ? (U(), q("div", lu, [
                    p("button", {
                      type: "button",
                      class: "oxm-pager__btn",
                      disabled: xe.value <= 1,
                      title: M.value ? "上一页" : "Previous",
                      onClick: m[4] || (m[4] = (v) => ne(xe.value - 1))
                    }, [...m[39] || (m[39] = [
                      p("i", { class: "fa-solid fa-chevron-left" }, null, -1)
                    ])], 8, au),
                    p("div", cu, [
                      (U(!0), q(Se, null, yt(de.value, (v) => (U(), q("button", {
                        key: `vendor-page-${v}`,
                        type: "button",
                        class: Oe(["oxm-pager__page", { "is-active": xe.value === v }]),
                        onClick: (j) => ne(v)
                      }, R(v), 11, uu))), 128))
                    ]),
                    p("button", {
                      type: "button",
                      class: "oxm-pager__btn",
                      disabled: xe.value >= de.value,
                      title: M.value ? "下一页" : "Next",
                      onClick: m[5] || (m[5] = (v) => ne(xe.value + 1))
                    }, [...m[40] || (m[40] = [
                      p("i", { class: "fa-solid fa-chevron-right" }, null, -1)
                    ])], 8, fu),
                    p("span", du, R(te.value.length) + " " + R(M.value ? "个供应商" : "providers"), 1)
                  ])) : he("", !0),
                  G.value ? (U(), q("div", pu, [
                    p("div", gu, [
                      p("img", {
                        src: G.value.logo,
                        alt: G.value.label
                      }, null, 8, hu),
                      p("div", null, [
                        p("strong", null, R(G.value.label), 1),
                        G.value.isCustom ? (U(), q("p", vu, R(M.value ? "自定义 OpenAI 兼容入口，与 OpenXnet 订阅中心绑定。" : "Custom OpenAI-compatible endpoint, bound to OpenXnet subscription."), 1)) : (U(), q("p", mu, R(M.value ? "已为你预填该供应商默认地址，填入 API Key 即可使用。" : "Default URL pre-filled. Provide an API key to start using it."), 1))
                      ]),
                      T.value.websiteUrl ? (U(), q("a", {
                        key: 0,
                        href: "javascript:void(0)",
                        class: "oxm-dialog__form-link",
                        onClick: ce
                      }, [
                        m[41] || (m[41] = p("i", { class: "fa-solid fa-key" }, null, -1)),
                        p("span", null, R(M.value ? "获取 API Key" : "Get API key"), 1)
                      ])) : he("", !0)
                    ]),
                    p("div", yu, [
                      p("label", _u, [
                        p("span", null, R(M.value ? "API 地址" : "API URL") + R(G.value.isCustom ? " *" : ""), 1),
                        p("input", {
                          type: "text",
                          value: T.value.url,
                          placeholder: (M.value, "https://api.example.com/v1"),
                          onInput: m[6] || (m[6] = (v) => ve("url", v))
                        }, null, 40, bu)
                      ]),
                      p("label", Su, [
                        p("span", null, R(M.value ? "API 密钥" : "API Key"), 1),
                        p("input", {
                          type: "password",
                          value: T.value.apiKey,
                          placeholder: M.value ? "可选，先添加再去填写" : "Optional, can be filled later",
                          onInput: m[7] || (m[7] = (v) => ve("apiKey", v))
                        }, null, 40, xu)
                      ]),
                      p("label", Pu, [
                        p("span", null, R(M.value ? "默认模型 ID（可选）" : "Default Model ID (optional)"), 1),
                        p("input", {
                          type: "text",
                          value: T.value.modelId,
                          placeholder: M.value ? "可留空，添加后可拉取模型列表" : "Optional, fetch models after adding",
                          onInput: m[8] || (m[8] = (v) => ve("modelId", v))
                        }, null, 40, Cu)
                      ])
                    ])
                  ])) : he("", !0)
                ]),
                p("div", wu, [
                  p("button", {
                    type: "button",
                    class: "oxm-secondary-btn",
                    onClick: $
                  }, R(M.value ? "取消" : "Cancel"), 1),
                  p("button", {
                    type: "button",
                    class: "oxm-primary-btn",
                    disabled: !T.value.vendor,
                    onClick: Q
                  }, [
                    m[42] || (m[42] = p("i", { class: "fa-solid fa-check" }, null, -1)),
                    p("span", null, R(M.value ? "确认添加" : "Confirm"), 1)
                  ], 8, Tu)
                ])
              ])
            ])) : he("", !0)
          ]),
          _: 1
        }),
        he("", !0)
      ])) : H.value ? (U(), q("div", Au, [
        p("div", Iu, [
          p("div", null, [
            p("h2", null, R(H.value.label), 1),
            p("p", null, R(H.value.selectedProviderName), 1)
          ]),
          p("span", Mu, R(H.value.selectedProviderStatus), 1)
        ]),
        p("div", Eu, [
          p("label", Ou, [
            p("span", null, R(M.value ? "绑定供应商" : "Provider"), 1),
            p("select", {
              value: H.value.selectedProvider,
              onChange: m[13] || (m[13] = (v) => et(H.value.id, v))
            }, [
              p("option", Lu, R(M.value ? "请选择供应商" : "Select provider"), 1),
              (U(!0), q(Se, null, yt(H.value.providerOptions, (v) => (U(), q("option", {
                key: v.value,
                value: v.value
              }, R(v.label), 9, Du))), 128))
            ], 40, ku)
          ]),
          p("label", Fu, [
            p("span", null, R(M.value ? "模型 ID" : "Model ID"), 1),
            p("input", {
              value: H.value.model,
              type: "text",
              onInput: m[14] || (m[14] = (v) => ke(H.value.id, "model", v))
            }, null, 40, Ru)
          ]),
          H.value.providerModels && H.value.providerModels.length ? (U(), q("div", Vu, [
            (U(!0), q(Se, null, yt(H.value.providerModels, (v) => (U(), q("button", {
              key: `${H.value.id}-${v.value}`,
              type: "button",
              class: Oe(["ox-vite-model-chip ox-vite-model-chip--button", { active: H.value.model === v.value }]),
              onClick: (j) => tt(H.value.id, v.value)
            }, R(v.label), 11, Nu))), 128))
          ])) : he("", !0),
          p("label", $u, [
            m[52] || (m[52] = p("span", null, "Base URL", -1)),
            p("input", {
              value: H.value.base_url,
              type: "text",
              onInput: m[15] || (m[15] = (v) => ke(H.value.id, "base_url", v))
            }, null, 40, Bu)
          ]),
          p("label", Ku, [
            m[53] || (m[53] = p("span", null, "API Key", -1)),
            p("input", {
              value: H.value.api_key,
              type: "password",
              onInput: m[16] || (m[16] = (v) => ke(H.value.id, "api_key", v))
            }, null, 40, Hu)
          ]),
          H.value.temperature !== void 0 ? (U(), q("label", ju, [
            m[54] || (m[54] = p("span", null, "Temperature", -1)),
            p("input", {
              value: H.value.temperature,
              type: "number",
              min: "0",
              max: "2",
              step: "0.1",
              onInput: m[17] || (m[17] = (v) => ke(H.value.id, "temperature", v))
            }, null, 40, Uu)
          ])) : he("", !0),
          H.value.max_tokens !== void 0 ? (U(), q("label", Wu, [
            m[55] || (m[55] = p("span", null, "Max Tokens", -1)),
            p("input", {
              value: H.value.max_tokens,
              type: "number",
              min: "1",
              step: "1",
              onInput: m[18] || (m[18] = (v) => ke(H.value.id, "max_tokens", v))
            }, null, 40, qu)
          ])) : he("", !0),
          H.value.top_p !== void 0 ? (U(), q("label", Gu, [
            m[56] || (m[56] = p("span", null, "Top P", -1)),
            p("input", {
              value: H.value.top_p,
              type: "number",
              min: "0",
              max: "1",
              step: "0.05",
              onInput: m[19] || (m[19] = (v) => ke(H.value.id, "top_p", v))
            }, null, 40, Ju)
          ])) : he("", !0),
          H.value.reasoning_effort !== void 0 ? (U(), q("label", zu, [
            p("span", null, R(M.value ? "推理强度" : "Reasoning Effort"), 1),
            p("input", {
              value: H.value.reasoning_effort || "",
              type: "text",
              onInput: m[20] || (m[20] = (v) => ke(H.value.id, "reasoning_effort", v))
            }, null, 40, Yu)
          ])) : he("", !0),
          H.value.enabled !== null ? (U(), q("label", Xu, [
            p("span", null, [
              p("strong", null, R(M.value ? "启用该模型槽位" : "Enable this slot"), 1),
              p("small", null, R(M.value ? "关闭后当前工作流不会主动使用该模型" : "The current workflow will not actively use this slot when disabled."), 1)
            ]),
            p("input", {
              checked: H.value.enabled,
              type: "checkbox",
              onChange: m[21] || (m[21] = (v) => ke(H.value.id, "enabled", v))
            }, null, 40, Qu)
          ])) : he("", !0)
        ])
      ])) : he("", !0)
    ]));
  }
};
function hi() {
  const e = document.getElementById("openxnet-vite-model-root");
  !e || e.dataset.viteMounted === "true" || (Pa(Zu).mount(e), e.dataset.viteMounted = "true");
}
document.readyState === "loading" ? document.addEventListener("DOMContentLoaded", hi, { once: !0 }) : hi();
window.addEventListener("openxnet-vite-model-remount", hi);
