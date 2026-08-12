// @__NO_SIDE_EFFECTS__
function Ms(e) {
  const t = /* @__PURE__ */ Object.create(null);
  for (const s of e.split(",")) t[s] = 1;
  return (s) => s in t;
}
const q = {}, ct = [], Le = () => {
}, Ln = () => !1, Yt = (e) => e.charCodeAt(0) === 111 && e.charCodeAt(1) === 110 && // uppercase letter
(e.charCodeAt(2) > 122 || e.charCodeAt(2) < 97), Qt = (e) => e.startsWith("onUpdate:"), fe = Object.assign, Rs = (e, t) => {
  const s = e.indexOf(t);
  s > -1 && e.splice(s, 1);
}, Vi = Object.prototype.hasOwnProperty, U = (e, t) => Vi.call(e, t), L = Array.isArray, ft = (e) => Rt(e) === "[object Map]", Dn = (e) => Rt(e) === "[object Set]", nn = (e) => Rt(e) === "[object Date]", D = (e) => typeof e == "function", ee = (e) => typeof e == "string", De = (e) => typeof e == "symbol", K = (e) => e !== null && typeof e == "object", Hn = (e) => (K(e) || D(e)) && D(e.then) && D(e.catch), jn = Object.prototype.toString, Rt = (e) => jn.call(e), Bi = (e) => Rt(e).slice(8, -1), Nn = (e) => Rt(e) === "[object Object]", Fs = (e) => ee(e) && e !== "NaN" && e[0] !== "-" && "" + parseInt(e, 10) === e, xt = /* @__PURE__ */ Ms(
  // the leading comma is intentional so empty string "" is also included
  ",key,ref,ref_for,ref_key,onVnodeBeforeMount,onVnodeMounted,onVnodeBeforeUpdate,onVnodeUpdated,onVnodeBeforeUnmount,onVnodeUnmounted"
), Xt = (e) => {
  const t = /* @__PURE__ */ Object.create(null);
  return ((s) => t[s] || (t[s] = e(s)));
}, Gi = /-\w/g, xe = Xt(
  (e) => e.replace(Gi, (t) => t.slice(1).toUpperCase())
), zi = /\B([A-Z])/g, it = Xt(
  (e) => e.replace(zi, "-$1").toLowerCase()
), $n = Xt((e) => e.charAt(0).toUpperCase() + e.slice(1)), cs = Xt(
  (e) => e ? `on${$n(e)}` : ""
), Re = (e, t) => !Object.is(e, t), fs = (e, ...t) => {
  for (let s = 0; s < e.length; s++)
    e[s](...t);
}, Un = (e, t, s, n = !1) => {
  Object.defineProperty(e, t, {
    configurable: !0,
    enumerable: !1,
    writable: n,
    value: s
  });
}, Zi = (e) => {
  const t = parseFloat(e);
  return isNaN(t) ? e : t;
};
let ln;
const es = () => ln || (ln = typeof globalThis < "u" ? globalThis : typeof self < "u" ? self : typeof window < "u" ? window : typeof globalThis < "u" ? globalThis : {});
function Ls(e) {
  if (L(e)) {
    const t = {};
    for (let s = 0; s < e.length; s++) {
      const n = e[s], i = ee(n) ? Qi(n) : Ls(n);
      if (i)
        for (const l in i)
          t[l] = i[l];
    }
    return t;
  } else if (ee(e) || K(e))
    return e;
}
const qi = /;(?![^(]*\))/g, Ji = /:([^]+)/, Yi = /\/\*[^]*?\*\//g;
function Qi(e) {
  const t = {};
  return e.replace(Yi, "").split(qi).forEach((s) => {
    if (s) {
      const n = s.split(Ji);
      n.length > 1 && (t[n[0].trim()] = n[1].trim());
    }
  }), t;
}
function be(e) {
  let t = "";
  if (ee(e))
    t = e;
  else if (L(e))
    for (let s = 0; s < e.length; s++) {
      const n = be(e[s]);
      n && (t += n + " ");
    }
  else if (K(e))
    for (const s in e)
      e[s] && (t += s + " ");
  return t.trim();
}
const Xi = "itemscope,allowfullscreen,formnovalidate,ismap,nomodule,novalidate,readonly", el = /* @__PURE__ */ Ms(Xi);
function Wn(e) {
  return !!e || e === "";
}
function tl(e, t) {
  if (e.length !== t.length) return !1;
  let s = !0;
  for (let n = 0; s && n < e.length; n++)
    s = Ds(e[n], t[n]);
  return s;
}
function Ds(e, t) {
  if (e === t) return !0;
  let s = nn(e), n = nn(t);
  if (s || n)
    return s && n ? e.getTime() === t.getTime() : !1;
  if (s = De(e), n = De(t), s || n)
    return e === t;
  if (s = L(e), n = L(t), s || n)
    return s && n ? tl(e, t) : !1;
  if (s = K(e), n = K(t), s || n) {
    if (!s || !n)
      return !1;
    const i = Object.keys(e).length, l = Object.keys(t).length;
    if (i !== l)
      return !1;
    for (const r in e) {
      const o = e.hasOwnProperty(r), f = t.hasOwnProperty(r);
      if (o && !f || !o && f || !Ds(e[r], t[r]))
        return !1;
    }
  }
  return String(e) === String(t);
}
const Kn = (e) => !!(e && e.__v_isRef === !0), F = (e) => ee(e) ? e : e == null ? "" : L(e) || K(e) && (e.toString === jn || !D(e.toString)) ? Kn(e) ? F(e.value) : JSON.stringify(e, Vn, 2) : String(e), Vn = (e, t) => Kn(t) ? Vn(e, t.value) : ft(t) ? {
  [`Map(${t.size})`]: [...t.entries()].reduce(
    (s, [n, i], l) => (s[us(n, l) + " =>"] = i, s),
    {}
  )
} : Dn(t) ? {
  [`Set(${t.size})`]: [...t.values()].map((s) => us(s))
} : De(t) ? us(t) : K(t) && !L(t) && !Nn(t) ? String(t) : t, us = (e, t = "") => {
  var s;
  return (
    // Symbol.description in es2019+ so we need to cast here to pass
    // the lib: es2016 check
    De(e) ? `Symbol(${(s = e.description) != null ? s : t})` : e
  );
};
let le;
class sl {
  // TODO isolatedDeclarations "__v_skip"
  constructor(t = !1) {
    this.detached = t, this._active = !0, this._on = 0, this.effects = [], this.cleanups = [], this._isPaused = !1, this._warnOnRun = !0, this.__v_skip = !0, !t && le && (le.active ? (this.parent = le, this.index = (le.scopes || (le.scopes = [])).push(
      this
    ) - 1) : (this._active = !1, this._warnOnRun = !1));
  }
  get active() {
    return this._active;
  }
  pause() {
    if (this._active) {
      this._isPaused = !0;
      let t, s;
      if (this.scopes)
        for (t = 0, s = this.scopes.length; t < s; t++)
          this.scopes[t].pause();
      for (t = 0, s = this.effects.length; t < s; t++)
        this.effects[t].pause();
    }
  }
  /**
   * Resumes the effect scope, including all child scopes and effects.
   */
  resume() {
    if (this._active && this._isPaused) {
      this._isPaused = !1;
      let t, s;
      if (this.scopes)
        for (t = 0, s = this.scopes.length; t < s; t++)
          this.scopes[t].resume();
      for (t = 0, s = this.effects.length; t < s; t++)
        this.effects[t].resume();
    }
  }
  run(t) {
    if (this._active) {
      const s = le;
      try {
        return le = this, t();
      } finally {
        le = s;
      }
    }
  }
  /**
   * This should only be called on non-detached scopes
   * @internal
   */
  on() {
    ++this._on === 1 && (this.prevScope = le, le = this);
  }
  /**
   * This should only be called on non-detached scopes
   * @internal
   */
  off() {
    if (this._on > 0 && --this._on === 0) {
      if (le === this)
        le = this.prevScope;
      else {
        let t = le;
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
      let s, n;
      for (s = 0, n = this.effects.length; s < n; s++)
        this.effects[s].stop();
      for (this.effects.length = 0, s = 0, n = this.cleanups.length; s < n; s++)
        this.cleanups[s]();
      if (this.cleanups.length = 0, this.scopes) {
        for (s = 0, n = this.scopes.length; s < n; s++)
          this.scopes[s].stop(!0);
        this.scopes.length = 0;
      }
      if (!this.detached && this.parent && !t) {
        const i = this.parent.scopes.pop();
        i && i !== this && (this.parent.scopes[this.index] = i, i.index = this.index);
      }
      this.parent = void 0;
    }
  }
}
function nl() {
  return le;
}
let Z;
const as = /* @__PURE__ */ new WeakSet();
class Bn {
  constructor(t) {
    this.fn = t, this.deps = void 0, this.depsTail = void 0, this.flags = 5, this.next = void 0, this.cleanup = void 0, this.scheduler = void 0, le && (le.active ? le.effects.push(this) : this.flags &= -2);
  }
  pause() {
    this.flags |= 64;
  }
  resume() {
    this.flags & 64 && (this.flags &= -65, as.has(this) && (as.delete(this), this.trigger()));
  }
  /**
   * @internal
   */
  notify() {
    this.flags & 2 && !(this.flags & 32) || this.flags & 8 || zn(this);
  }
  run() {
    if (!(this.flags & 1))
      return this.fn();
    this.flags |= 2, rn(this), Zn(this);
    const t = Z, s = Se;
    Z = this, Se = !0;
    try {
      return this.fn();
    } finally {
      qn(this), Z = t, Se = s, this.flags &= -3;
    }
  }
  stop() {
    if (this.flags & 1) {
      for (let t = this.deps; t; t = t.nextDep)
        Ns(t);
      this.deps = this.depsTail = void 0, rn(this), this.onStop && this.onStop(), this.flags &= -2;
    }
  }
  trigger() {
    this.flags & 64 ? as.add(this) : this.scheduler ? this.scheduler() : this.runIfDirty();
  }
  /**
   * @internal
   */
  runIfDirty() {
    bs(this) && this.run();
  }
  get dirty() {
    return bs(this);
  }
}
let Gn = 0, St, wt;
function zn(e, t = !1) {
  if (e.flags |= 8, t) {
    e.next = wt, wt = e;
    return;
  }
  e.next = St, St = e;
}
function Hs() {
  Gn++;
}
function js() {
  if (--Gn > 0)
    return;
  if (wt) {
    let t = wt;
    for (wt = void 0; t; ) {
      const s = t.next;
      t.next = void 0, t.flags &= -9, t = s;
    }
  }
  let e;
  for (; St; ) {
    let t = St;
    for (St = void 0; t; ) {
      const s = t.next;
      if (t.next = void 0, t.flags &= -9, t.flags & 1)
        try {
          t.trigger();
        } catch (n) {
          e || (e = n);
        }
      t = s;
    }
  }
  if (e) throw e;
}
function Zn(e) {
  for (let t = e.deps; t; t = t.nextDep)
    t.version = -1, t.prevActiveLink = t.dep.activeLink, t.dep.activeLink = t;
}
function qn(e) {
  let t, s = e.depsTail, n = s;
  for (; n; ) {
    const i = n.prevDep;
    n.version === -1 ? (n === s && (s = i), Ns(n), il(n)) : t = n, n.dep.activeLink = n.prevActiveLink, n.prevActiveLink = void 0, n = i;
  }
  e.deps = t, e.depsTail = s;
}
function bs(e) {
  for (let t = e.deps; t; t = t.nextDep)
    if (t.dep.version !== t.version || t.dep.computed && (Jn(t.dep.computed) || t.dep.version !== t.version))
      return !0;
  return !!e._dirty;
}
function Jn(e) {
  if (e.flags & 4 && !(e.flags & 16) || (e.flags &= -17, e.globalVersion === Pt) || (e.globalVersion = Pt, !e.isSSR && e.flags & 128 && (!e.deps && !e._dirty || !bs(e))))
    return;
  e.flags |= 2;
  const t = e.dep, s = Z, n = Se;
  Z = e, Se = !0;
  try {
    Zn(e);
    const i = e.fn(e._value);
    (t.version === 0 || Re(i, e._value)) && (e.flags |= 128, e._value = i, t.version++);
  } catch (i) {
    throw t.version++, i;
  } finally {
    Z = s, Se = n, qn(e), e.flags &= -3;
  }
}
function Ns(e, t = !1) {
  const { dep: s, prevSub: n, nextSub: i } = e;
  if (n && (n.nextSub = i, e.prevSub = void 0), i && (i.prevSub = n, e.nextSub = void 0), s.subs === e && (s.subs = n, !n && s.computed)) {
    s.computed.flags &= -5;
    for (let l = s.computed.deps; l; l = l.nextDep)
      Ns(l, !0);
  }
  !t && !--s.sc && s.map && s.map.delete(s.key);
}
function il(e) {
  const { prevDep: t, nextDep: s } = e;
  t && (t.nextDep = s, e.prevDep = void 0), s && (s.prevDep = t, e.nextDep = void 0);
}
let Se = !0;
const Yn = [];
function Ke() {
  Yn.push(Se), Se = !1;
}
function Ve() {
  const e = Yn.pop();
  Se = e === void 0 ? !0 : e;
}
function rn(e) {
  const { cleanup: t } = e;
  if (e.cleanup = void 0, t) {
    const s = Z;
    Z = void 0;
    try {
      t();
    } finally {
      Z = s;
    }
  }
}
let Pt = 0;
class ll {
  constructor(t, s) {
    this.sub = t, this.dep = s, this.version = s.version, this.nextDep = this.prevDep = this.nextSub = this.prevSub = this.prevActiveLink = void 0;
  }
}
class $s {
  // TODO isolatedDeclarations "__v_skip"
  constructor(t) {
    this.computed = t, this.version = 0, this.activeLink = void 0, this.subs = void 0, this.map = void 0, this.key = void 0, this.sc = 0, this.__v_skip = !0;
  }
  track(t) {
    if (!Z || !Se || Z === this.computed)
      return;
    let s = this.activeLink;
    if (s === void 0 || s.sub !== Z)
      s = this.activeLink = new ll(Z, this), Z.deps ? (s.prevDep = Z.depsTail, Z.depsTail.nextDep = s, Z.depsTail = s) : Z.deps = Z.depsTail = s, Qn(s);
    else if (s.version === -1 && (s.version = this.version, s.nextDep)) {
      const n = s.nextDep;
      n.prevDep = s.prevDep, s.prevDep && (s.prevDep.nextDep = n), s.prevDep = Z.depsTail, s.nextDep = void 0, Z.depsTail.nextDep = s, Z.depsTail = s, Z.deps === s && (Z.deps = n);
    }
    return s;
  }
  trigger(t) {
    this.version++, Pt++, this.notify(t);
  }
  notify(t) {
    Hs();
    try {
      for (let s = this.subs; s; s = s.prevSub)
        s.sub.notify() && s.sub.dep.notify();
    } finally {
      js();
    }
  }
}
function Qn(e) {
  if (e.dep.sc++, e.sub.flags & 4) {
    const t = e.dep.computed;
    if (t && !e.dep.subs) {
      t.flags |= 20;
      for (let n = t.deps; n; n = n.nextDep)
        Qn(n);
    }
    const s = e.dep.subs;
    s !== e && (e.prevSub = s, s && (s.nextSub = e)), e.dep.subs = e;
  }
}
const xs = /* @__PURE__ */ new WeakMap(), st = /* @__PURE__ */ Symbol(
  ""
), Ss = /* @__PURE__ */ Symbol(
  ""
), Et = /* @__PURE__ */ Symbol(
  ""
);
function oe(e, t, s) {
  if (Se && Z) {
    let n = xs.get(e);
    n || xs.set(e, n = /* @__PURE__ */ new Map());
    let i = n.get(s);
    i || (n.set(s, i = new $s()), i.map = n, i.key = s), i.track();
  }
}
function Ue(e, t, s, n, i, l) {
  const r = xs.get(e);
  if (!r) {
    Pt++;
    return;
  }
  const o = (f) => {
    f && f.trigger();
  };
  if (Hs(), t === "clear")
    r.forEach(o);
  else {
    const f = L(e), d = f && Fs(s);
    if (f && s === "length") {
      const a = Number(n);
      r.forEach((g, T) => {
        (T === "length" || T === Et || !De(T) && T >= a) && o(g);
      });
    } else
      switch ((s !== void 0 || r.has(void 0)) && o(r.get(s)), d && o(r.get(Et)), t) {
        case "add":
          f ? d && o(r.get("length")) : (o(r.get(st)), ft(e) && o(r.get(Ss)));
          break;
        case "delete":
          f || (o(r.get(st)), ft(e) && o(r.get(Ss)));
          break;
        case "set":
          ft(e) && o(r.get(st));
          break;
      }
  }
  js();
}
function lt(e) {
  const t = /* @__PURE__ */ $(e);
  return t === e ? t : (oe(t, "iterate", Et), /* @__PURE__ */ me(e) ? t : t.map(we));
}
function ts(e) {
  return oe(e = /* @__PURE__ */ $(e), "iterate", Et), e;
}
function Oe(e, t) {
  return /* @__PURE__ */ Be(e) ? dt(/* @__PURE__ */ nt(e) ? we(t) : t) : we(t);
}
const rl = {
  __proto__: null,
  [Symbol.iterator]() {
    return ds(this, Symbol.iterator, (e) => Oe(this, e));
  },
  concat(...e) {
    return lt(this).concat(
      ...e.map((t) => L(t) ? lt(t) : t)
    );
  },
  entries() {
    return ds(this, "entries", (e) => (e[1] = Oe(this, e[1]), e));
  },
  every(e, t) {
    return je(this, "every", e, t, void 0, arguments);
  },
  filter(e, t) {
    return je(
      this,
      "filter",
      e,
      t,
      (s) => s.map((n) => Oe(this, n)),
      arguments
    );
  },
  find(e, t) {
    return je(
      this,
      "find",
      e,
      t,
      (s) => Oe(this, s),
      arguments
    );
  },
  findIndex(e, t) {
    return je(this, "findIndex", e, t, void 0, arguments);
  },
  findLast(e, t) {
    return je(
      this,
      "findLast",
      e,
      t,
      (s) => Oe(this, s),
      arguments
    );
  },
  findLastIndex(e, t) {
    return je(this, "findLastIndex", e, t, void 0, arguments);
  },
  // flat, flatMap could benefit from ARRAY_ITERATE but are not straight-forward to implement
  forEach(e, t) {
    return je(this, "forEach", e, t, void 0, arguments);
  },
  includes(...e) {
    return ps(this, "includes", e);
  },
  indexOf(...e) {
    return ps(this, "indexOf", e);
  },
  join(e) {
    return lt(this).join(e);
  },
  // keys() iterator only reads `length`, no optimization required
  lastIndexOf(...e) {
    return ps(this, "lastIndexOf", e);
  },
  map(e, t) {
    return je(this, "map", e, t, void 0, arguments);
  },
  pop() {
    return _t(this, "pop");
  },
  push(...e) {
    return _t(this, "push", e);
  },
  reduce(e, ...t) {
    return on(this, "reduce", e, t);
  },
  reduceRight(e, ...t) {
    return on(this, "reduceRight", e, t);
  },
  shift() {
    return _t(this, "shift");
  },
  // slice could use ARRAY_ITERATE but also seems to beg for range tracking
  some(e, t) {
    return je(this, "some", e, t, void 0, arguments);
  },
  splice(...e) {
    return _t(this, "splice", e);
  },
  toReversed() {
    return lt(this).toReversed();
  },
  toSorted(e) {
    return lt(this).toSorted(e);
  },
  toSpliced(...e) {
    return lt(this).toSpliced(...e);
  },
  unshift(...e) {
    return _t(this, "unshift", e);
  },
  values() {
    return ds(this, "values", (e) => Oe(this, e));
  }
};
function ds(e, t, s) {
  const n = ts(e), i = n[t]();
  return n !== e && !/* @__PURE__ */ me(e) && (i._next = i.next, i.next = () => {
    const l = i._next();
    return l.done || (l.value = s(l.value)), l;
  }), i;
}
const ol = Array.prototype;
function je(e, t, s, n, i, l) {
  const r = ts(e), o = r !== e && !/* @__PURE__ */ me(e), f = r[t];
  if (f !== ol[t]) {
    const g = f.apply(e, l);
    return o ? we(g) : g;
  }
  let d = s;
  r !== e && (o ? d = function(g, T) {
    return s.call(this, Oe(e, g), T, e);
  } : s.length > 2 && (d = function(g, T) {
    return s.call(this, g, T, e);
  }));
  const a = f.call(r, d, n);
  return o && i ? i(a) : a;
}
function on(e, t, s, n) {
  const i = ts(e), l = i !== e && !/* @__PURE__ */ me(e);
  let r = s, o = !1;
  i !== e && (l ? (o = n.length === 0, r = function(d, a, g) {
    return o && (o = !1, d = Oe(e, d)), s.call(this, d, Oe(e, a), g, e);
  }) : s.length > 3 && (r = function(d, a, g) {
    return s.call(this, d, a, g, e);
  }));
  const f = i[t](r, ...n);
  return o ? Oe(e, f) : f;
}
function ps(e, t, s) {
  const n = /* @__PURE__ */ $(e);
  oe(n, "iterate", Et);
  const i = n[t](...s);
  return (i === -1 || i === !1) && /* @__PURE__ */ Vs(s[0]) ? (s[0] = /* @__PURE__ */ $(s[0]), n[t](...s)) : i;
}
function _t(e, t, s = []) {
  Ke(), Hs();
  const n = (/* @__PURE__ */ $(e))[t].apply(e, s);
  return js(), Ve(), n;
}
const cl = /* @__PURE__ */ Ms("__proto__,__v_isRef,__isVue"), Xn = new Set(
  /* @__PURE__ */ Object.getOwnPropertyNames(Symbol).filter((e) => e !== "arguments" && e !== "caller").map((e) => Symbol[e]).filter(De)
);
function fl(e) {
  De(e) || (e = String(e));
  const t = /* @__PURE__ */ $(this);
  return oe(t, "has", e), t.hasOwnProperty(e);
}
class ei {
  constructor(t = !1, s = !1) {
    this._isReadonly = t, this._isShallow = s;
  }
  get(t, s, n) {
    if (s === "__v_skip") return t.__v_skip;
    const i = this._isReadonly, l = this._isShallow;
    if (s === "__v_isReactive")
      return !i;
    if (s === "__v_isReadonly")
      return i;
    if (s === "__v_isShallow")
      return l;
    if (s === "__v_raw")
      return n === (i ? l ? ml : ii : l ? ni : si).get(t) || // receiver is not the reactive proxy, but has the same prototype
      // this means the receiver is a user proxy of the reactive proxy
      Object.getPrototypeOf(t) === Object.getPrototypeOf(n) ? t : void 0;
    const r = L(t);
    if (!i) {
      let f;
      if (r && (f = rl[s]))
        return f;
      if (s === "hasOwnProperty")
        return fl;
    }
    const o = Reflect.get(
      t,
      s,
      // if this is a proxy wrapping a ref, return methods using the raw ref
      // as receiver so that we don't have to call `toRaw` on the ref in all
      // its class methods
      /* @__PURE__ */ ce(t) ? t : n
    );
    if ((De(s) ? Xn.has(s) : cl(s)) || (i || oe(t, "get", s), l))
      return o;
    if (/* @__PURE__ */ ce(o)) {
      const f = r && Fs(s) ? o : o.value;
      return i && K(f) ? /* @__PURE__ */ Cs(f) : f;
    }
    return K(o) ? i ? /* @__PURE__ */ Cs(o) : /* @__PURE__ */ Ws(o) : o;
  }
}
class ti extends ei {
  constructor(t = !1) {
    super(!1, t);
  }
  set(t, s, n, i) {
    let l = t[s];
    const r = L(t) && Fs(s);
    if (!this._isShallow) {
      const d = /* @__PURE__ */ Be(l);
      if (!/* @__PURE__ */ me(n) && !/* @__PURE__ */ Be(n) && (l = /* @__PURE__ */ $(l), n = /* @__PURE__ */ $(n)), !r && /* @__PURE__ */ ce(l) && !/* @__PURE__ */ ce(n))
        return d || (l.value = n), !0;
    }
    const o = r ? Number(s) < t.length : U(t, s), f = Reflect.set(
      t,
      s,
      n,
      /* @__PURE__ */ ce(t) ? t : i
    );
    return t === /* @__PURE__ */ $(i) && (o ? Re(n, l) && Ue(t, "set", s, n) : Ue(t, "add", s, n)), f;
  }
  deleteProperty(t, s) {
    const n = U(t, s);
    t[s];
    const i = Reflect.deleteProperty(t, s);
    return i && n && Ue(t, "delete", s, void 0), i;
  }
  has(t, s) {
    const n = Reflect.has(t, s);
    return (!De(s) || !Xn.has(s)) && oe(t, "has", s), n;
  }
  ownKeys(t) {
    return oe(
      t,
      "iterate",
      L(t) ? "length" : st
    ), Reflect.ownKeys(t);
  }
}
class ul extends ei {
  constructor(t = !1) {
    super(!0, t);
  }
  set(t, s) {
    return !0;
  }
  deleteProperty(t, s) {
    return !0;
  }
}
const al = /* @__PURE__ */ new ti(), dl = /* @__PURE__ */ new ul(), pl = /* @__PURE__ */ new ti(!0);
const ws = (e) => e, $t = (e) => Reflect.getPrototypeOf(e);
function hl(e, t, s) {
  return function(...n) {
    const i = this.__v_raw, l = /* @__PURE__ */ $(i), r = ft(l), o = e === "entries" || e === Symbol.iterator && r, f = e === "keys" && r, d = i[e](...n), a = s ? ws : t ? dt : we;
    return !t && oe(
      l,
      "iterate",
      f ? Ss : st
    ), fe(
      // inheriting all iterator properties
      Object.create(d),
      {
        // iterator protocol
        next() {
          const { value: g, done: T } = d.next();
          return T ? { value: g, done: T } : {
            value: o ? [a(g[0]), a(g[1])] : a(g),
            done: T
          };
        }
      }
    );
  };
}
function Ut(e) {
  return function(...t) {
    return e === "delete" ? !1 : e === "clear" ? void 0 : this;
  };
}
function gl(e, t) {
  const s = {
    get(i) {
      const l = this.__v_raw, r = /* @__PURE__ */ $(l), o = /* @__PURE__ */ $(i);
      e || (Re(i, o) && oe(r, "get", i), oe(r, "get", o));
      const { has: f } = $t(r), d = t ? ws : e ? dt : we;
      if (f.call(r, i))
        return d(l.get(i));
      if (f.call(r, o))
        return d(l.get(o));
      l !== r && l.get(i);
    },
    get size() {
      const i = this.__v_raw;
      return !e && oe(/* @__PURE__ */ $(i), "iterate", st), i.size;
    },
    has(i) {
      const l = this.__v_raw, r = /* @__PURE__ */ $(l), o = /* @__PURE__ */ $(i);
      return e || (Re(i, o) && oe(r, "has", i), oe(r, "has", o)), i === o ? l.has(i) : l.has(i) || l.has(o);
    },
    forEach(i, l) {
      const r = this, o = r.__v_raw, f = /* @__PURE__ */ $(o), d = t ? ws : e ? dt : we;
      return !e && oe(f, "iterate", st), o.forEach((a, g) => i.call(l, d(a), d(g), r));
    }
  };
  return fe(
    s,
    e ? {
      add: Ut("add"),
      set: Ut("set"),
      delete: Ut("delete"),
      clear: Ut("clear")
    } : {
      add(i) {
        const l = /* @__PURE__ */ $(this), r = $t(l), o = /* @__PURE__ */ $(i), f = !t && !/* @__PURE__ */ me(i) && !/* @__PURE__ */ Be(i) ? o : i;
        return r.has.call(l, f) || Re(i, f) && r.has.call(l, i) || Re(o, f) && r.has.call(l, o) || (l.add(f), Ue(l, "add", f, f)), this;
      },
      set(i, l) {
        !t && !/* @__PURE__ */ me(l) && !/* @__PURE__ */ Be(l) && (l = /* @__PURE__ */ $(l));
        const r = /* @__PURE__ */ $(this), { has: o, get: f } = $t(r);
        let d = o.call(r, i);
        d || (i = /* @__PURE__ */ $(i), d = o.call(r, i));
        const a = f.call(r, i);
        return r.set(i, l), d ? Re(l, a) && Ue(r, "set", i, l) : Ue(r, "add", i, l), this;
      },
      delete(i) {
        const l = /* @__PURE__ */ $(this), { has: r, get: o } = $t(l);
        let f = r.call(l, i);
        f || (i = /* @__PURE__ */ $(i), f = r.call(l, i)), o && o.call(l, i);
        const d = l.delete(i);
        return f && Ue(l, "delete", i, void 0), d;
      },
      clear() {
        const i = /* @__PURE__ */ $(this), l = i.size !== 0, r = i.clear();
        return l && Ue(
          i,
          "clear",
          void 0,
          void 0
        ), r;
      }
    }
  ), [
    "keys",
    "values",
    "entries",
    Symbol.iterator
  ].forEach((i) => {
    s[i] = hl(i, e, t);
  }), s;
}
function Us(e, t) {
  const s = gl(e, t);
  return (n, i, l) => i === "__v_isReactive" ? !e : i === "__v_isReadonly" ? e : i === "__v_raw" ? n : Reflect.get(
    U(s, i) && i in n ? s : n,
    i,
    l
  );
}
const vl = {
  get: /* @__PURE__ */ Us(!1, !1)
}, _l = {
  get: /* @__PURE__ */ Us(!1, !0)
}, yl = {
  get: /* @__PURE__ */ Us(!0, !1)
};
const si = /* @__PURE__ */ new WeakMap(), ni = /* @__PURE__ */ new WeakMap(), ii = /* @__PURE__ */ new WeakMap(), ml = /* @__PURE__ */ new WeakMap();
function bl(e) {
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
function xl(e) {
  return e.__v_skip || !Object.isExtensible(e) ? 0 : bl(Bi(e));
}
// @__NO_SIDE_EFFECTS__
function Ws(e) {
  return /* @__PURE__ */ Be(e) ? e : Ks(
    e,
    !1,
    al,
    vl,
    si
  );
}
// @__NO_SIDE_EFFECTS__
function Sl(e) {
  return Ks(
    e,
    !1,
    pl,
    _l,
    ni
  );
}
// @__NO_SIDE_EFFECTS__
function Cs(e) {
  return Ks(
    e,
    !0,
    dl,
    yl,
    ii
  );
}
function Ks(e, t, s, n, i) {
  if (!K(e) || e.__v_raw && !(t && e.__v_isReactive))
    return e;
  const l = xl(e);
  if (l === 0)
    return e;
  const r = i.get(e);
  if (r)
    return r;
  const o = new Proxy(
    e,
    l === 2 ? n : s
  );
  return i.set(e, o), o;
}
// @__NO_SIDE_EFFECTS__
function nt(e) {
  return /* @__PURE__ */ Be(e) ? /* @__PURE__ */ nt(e.__v_raw) : !!(e && e.__v_isReactive);
}
// @__NO_SIDE_EFFECTS__
function Be(e) {
  return !!(e && e.__v_isReadonly);
}
// @__NO_SIDE_EFFECTS__
function me(e) {
  return !!(e && e.__v_isShallow);
}
// @__NO_SIDE_EFFECTS__
function Vs(e) {
  return e ? !!e.__v_raw : !1;
}
// @__NO_SIDE_EFFECTS__
function $(e) {
  const t = e && e.__v_raw;
  return t ? /* @__PURE__ */ $(t) : e;
}
function wl(e) {
  return !U(e, "__v_skip") && Object.isExtensible(e) && Un(e, "__v_skip", !0), e;
}
const we = (e) => K(e) ? /* @__PURE__ */ Ws(e) : e, dt = (e) => K(e) ? /* @__PURE__ */ Cs(e) : e;
// @__NO_SIDE_EFFECTS__
function ce(e) {
  return e ? e.__v_isRef === !0 : !1;
}
// @__NO_SIDE_EFFECTS__
function Cl(e) {
  return kl(e, !1);
}
function kl(e, t) {
  return /* @__PURE__ */ ce(e) ? e : new Tl(e, t);
}
class Tl {
  constructor(t, s) {
    this.dep = new $s(), this.__v_isRef = !0, this.__v_isShallow = !1, this._rawValue = s ? t : /* @__PURE__ */ $(t), this._value = s ? t : we(t), this.__v_isShallow = s;
  }
  get value() {
    return this.dep.track(), this._value;
  }
  set value(t) {
    const s = this._rawValue, n = this.__v_isShallow || /* @__PURE__ */ me(t) || /* @__PURE__ */ Be(t);
    t = n ? t : /* @__PURE__ */ $(t), Re(t, s) && (this._rawValue = t, this._value = n ? t : we(t), this.dep.trigger());
  }
}
function Il(e) {
  return /* @__PURE__ */ ce(e) ? e.value : e;
}
const Pl = {
  get: (e, t, s) => t === "__v_raw" ? e : Il(Reflect.get(e, t, s)),
  set: (e, t, s, n) => {
    const i = e[t];
    return /* @__PURE__ */ ce(i) && !/* @__PURE__ */ ce(s) ? (i.value = s, !0) : Reflect.set(e, t, s, n);
  }
};
function li(e) {
  return /* @__PURE__ */ nt(e) ? e : new Proxy(e, Pl);
}
class El {
  constructor(t, s, n) {
    this.fn = t, this.setter = s, this._value = void 0, this.dep = new $s(this), this.__v_isRef = !0, this.deps = void 0, this.depsTail = void 0, this.flags = 16, this.globalVersion = Pt - 1, this.next = void 0, this.effect = this, this.__v_isReadonly = !s, this.isSSR = n;
  }
  /**
   * @internal
   */
  notify() {
    if (this.flags |= 16, !(this.flags & 8) && // avoid infinite self recursion
    Z !== this)
      return zn(this, !0), !0;
  }
  get value() {
    const t = this.dep.track();
    return Jn(this), t && (t.version = this.dep.version), this._value;
  }
  set value(t) {
    this.setter && this.setter(t);
  }
}
// @__NO_SIDE_EFFECTS__
function Al(e, t, s = !1) {
  let n, i;
  return D(e) ? n = e : (n = e.get, i = e.set), new El(n, i, s);
}
const Wt = {}, Bt = /* @__PURE__ */ new WeakMap();
let et;
function Ol(e, t = !1, s = et) {
  if (s) {
    let n = Bt.get(s);
    n || Bt.set(s, n = []), n.push(e);
  }
}
function Ml(e, t, s = q) {
  const { immediate: n, deep: i, once: l, scheduler: r, augmentJob: o, call: f } = s, d = (O) => i ? O : /* @__PURE__ */ me(O) || i === !1 || i === 0 ? Ze(O, 1) : Ze(O);
  let a, g, T, P, H = !1, R = !1;
  if (/* @__PURE__ */ ce(e) ? (g = () => e.value, H = /* @__PURE__ */ me(e)) : /* @__PURE__ */ nt(e) ? (g = () => d(e), H = !0) : L(e) ? (R = !0, H = e.some((O) => /* @__PURE__ */ nt(O) || /* @__PURE__ */ me(O)), g = () => e.map((O) => {
    if (/* @__PURE__ */ ce(O))
      return O.value;
    if (/* @__PURE__ */ nt(O))
      return d(O);
    if (D(O))
      return f ? f(O, 2) : O();
  })) : D(e) ? t ? g = f ? () => f(e, 2) : e : g = () => {
    if (T) {
      Ke();
      try {
        T();
      } finally {
        Ve();
      }
    }
    const O = et;
    et = a;
    try {
      return f ? f(e, 3, [P]) : e(P);
    } finally {
      et = O;
    }
  } : g = Le, t && i) {
    const O = g, N = i === !0 ? 1 / 0 : i;
    g = () => Ze(O(), N);
  }
  const X = nl(), B = () => {
    a.stop(), X && X.active && Rs(X.effects, a);
  };
  if (l && t) {
    const O = t;
    t = (...N) => {
      O(...N), B();
    };
  }
  let k = R ? new Array(e.length).fill(Wt) : Wt;
  const W = (O) => {
    if (!(!(a.flags & 1) || !a.dirty && !O))
      if (t) {
        const N = a.run();
        if (i || H || (R ? N.some((ye, Y) => Re(ye, k[Y])) : Re(N, k))) {
          T && T();
          const ye = et;
          et = a;
          try {
            const Y = [
              N,
              // pass undefined as the old value when it's changed for the first time
              k === Wt ? void 0 : R && k[0] === Wt ? [] : k,
              P
            ];
            k = N, f ? f(t, 3, Y) : (
              // @ts-expect-error
              t(...Y)
            );
          } finally {
            et = ye;
          }
        }
      } else
        a.run();
  };
  return o && o(W), a = new Bn(g), a.scheduler = r ? () => r(W, !1) : W, P = (O) => Ol(O, !1, a), T = a.onStop = () => {
    const O = Bt.get(a);
    if (O) {
      if (f)
        f(O, 4);
      else
        for (const N of O) N();
      Bt.delete(a);
    }
  }, t ? n ? W(!0) : k = a.run() : r ? r(W.bind(null, !0), !0) : a.run(), B.pause = a.pause.bind(a), B.resume = a.resume.bind(a), B.stop = B, B;
}
function Ze(e, t = 1 / 0, s) {
  if (t <= 0 || !K(e) || e.__v_skip || (s = s || /* @__PURE__ */ new Map(), (s.get(e) || 0) >= t))
    return e;
  if (s.set(e, t), t--, /* @__PURE__ */ ce(e))
    Ze(e.value, t, s);
  else if (L(e))
    for (let n = 0; n < e.length; n++)
      Ze(e[n], t, s);
  else if (Dn(e) || ft(e))
    e.forEach((n) => {
      Ze(n, t, s);
    });
  else if (Nn(e)) {
    for (const n in e)
      Ze(e[n], t, s);
    for (const n of Object.getOwnPropertySymbols(e))
      Object.prototype.propertyIsEnumerable.call(e, n) && Ze(e[n], t, s);
  }
  return e;
}
function Ft(e, t, s, n) {
  try {
    return n ? e(...n) : e();
  } catch (i) {
    ss(i, t, s);
  }
}
function He(e, t, s, n) {
  if (D(e)) {
    const i = Ft(e, t, s, n);
    return i && Hn(i) && i.catch((l) => {
      ss(l, t, s);
    }), i;
  }
  if (L(e)) {
    const i = [];
    for (let l = 0; l < e.length; l++)
      i.push(He(e[l], t, s, n));
    return i;
  }
}
function ss(e, t, s, n = !0) {
  const i = t ? t.vnode : null, { errorHandler: l, throwUnhandledErrorInProduction: r } = t && t.appContext.config || q;
  if (t) {
    let o = t.parent;
    const f = t.proxy, d = `https://vuejs.org/error-reference/#runtime-${s}`;
    for (; o; ) {
      const a = o.ec;
      if (a) {
        for (let g = 0; g < a.length; g++)
          if (a[g](e, f, d) === !1)
            return;
      }
      o = o.parent;
    }
    if (l) {
      Ke(), Ft(l, null, 10, [
        e,
        f,
        d
      ]), Ve();
      return;
    }
  }
  Rl(e, s, i, n, r);
}
function Rl(e, t, s, n = !0, i = !1) {
  if (i)
    throw e;
  console.error(e);
}
const de = [];
let Ae = -1;
const ut = [];
let ze = null, ot = 0;
const ri = /* @__PURE__ */ Promise.resolve();
let Gt = null;
function Fl(e) {
  const t = Gt || ri;
  return e ? t.then(this ? e.bind(this) : e) : t;
}
function Ll(e) {
  let t = Ae + 1, s = de.length;
  for (; t < s; ) {
    const n = t + s >>> 1, i = de[n], l = At(i);
    l < e || l === e && i.flags & 2 ? t = n + 1 : s = n;
  }
  return t;
}
function Bs(e) {
  if (!(e.flags & 1)) {
    const t = At(e), s = de[de.length - 1];
    !s || // fast path when the job id is larger than the tail
    !(e.flags & 2) && t >= At(s) ? de.push(e) : de.splice(Ll(t), 0, e), e.flags |= 1, oi();
  }
}
function oi() {
  Gt || (Gt = ri.then(fi));
}
function Dl(e) {
  L(e) ? ut.push(...e) : ze && e.id === -1 ? ze.splice(ot + 1, 0, e) : e.flags & 1 || (ut.push(e), e.flags |= 1), oi();
}
function cn(e, t, s = Ae + 1) {
  for (; s < de.length; s++) {
    const n = de[s];
    if (n && n.flags & 2) {
      if (e && n.id !== e.uid)
        continue;
      de.splice(s, 1), s--, n.flags & 4 && (n.flags &= -2), n(), n.flags & 4 || (n.flags &= -2);
    }
  }
}
function ci(e) {
  if (ut.length) {
    const t = [...new Set(ut)].sort(
      (s, n) => At(s) - At(n)
    );
    if (ut.length = 0, ze) {
      ze.push(...t);
      return;
    }
    for (ze = t, ot = 0; ot < ze.length; ot++) {
      const s = ze[ot];
      s.flags & 4 && (s.flags &= -2), s.flags & 8 || s(), s.flags &= -2;
    }
    ze = null, ot = 0;
  }
}
const At = (e) => e.id == null ? e.flags & 2 ? -1 : 1 / 0 : e.id;
function fi(e) {
  try {
    for (Ae = 0; Ae < de.length; Ae++) {
      const t = de[Ae];
      t && !(t.flags & 8) && (t.flags & 4 && (t.flags &= -2), Ft(
        t,
        t.i,
        t.i ? 15 : 14
      ), t.flags & 4 || (t.flags &= -2));
    }
  } finally {
    for (; Ae < de.length; Ae++) {
      const t = de[Ae];
      t && (t.flags &= -2);
    }
    Ae = -1, de.length = 0, ci(), Gt = null, (de.length || ut.length) && fi();
  }
}
let Fe = null, ui = null;
function zt(e) {
  const t = Fe;
  return Fe = e, ui = e && e.type.__scopeId || null, t;
}
function Hl(e, t = Fe, s) {
  if (!t || e._n)
    return e;
  const n = (...i) => {
    n._d && mn(-1);
    const l = zt(t);
    let r;
    try {
      r = e(...i);
    } finally {
      zt(l), n._d && mn(1);
    }
    return r;
  };
  return n._n = !0, n._c = !0, n._d = !0, n;
}
function Qe(e, t, s, n) {
  const i = e.dirs, l = t && t.dirs;
  for (let r = 0; r < i.length; r++) {
    const o = i[r];
    l && (o.oldValue = l[r].value);
    let f = o.dir[n];
    f && (Ke(), He(f, s, 8, [
      e.el,
      o,
      e,
      t
    ]), Ve());
  }
}
function jl(e, t) {
  if (pe) {
    let s = pe.provides;
    const n = pe.parent && pe.parent.provides;
    n === s && (s = pe.provides = Object.create(n)), s[e] = t;
  }
}
function Kt(e, t, s = !1) {
  const n = Hr();
  if (n || at) {
    let i = at ? at._context.provides : n ? n.parent == null || n.ce ? n.vnode.appContext && n.vnode.appContext.provides : n.parent.provides : void 0;
    if (i && e in i)
      return i[e];
    if (arguments.length > 1)
      return s && D(t) ? t.call(n && n.proxy) : t;
  }
}
const Nl = /* @__PURE__ */ Symbol.for("v-scx"), $l = () => Kt(Nl);
function hs(e, t, s) {
  return ai(e, t, s);
}
function ai(e, t, s = q) {
  const { immediate: n, deep: i, flush: l, once: r } = s, o = fe({}, s), f = t && n || !t && l !== "post";
  let d;
  if (Mt) {
    if (l === "sync") {
      const P = $l();
      d = P.__watcherHandles || (P.__watcherHandles = []);
    } else if (!f) {
      const P = () => {
      };
      return P.stop = Le, P.resume = Le, P.pause = Le, P;
    }
  }
  const a = pe;
  o.call = (P, H, R) => He(P, a, H, R);
  let g = !1;
  l === "post" ? o.scheduler = (P) => {
    he(P, a && a.suspense);
  } : l !== "sync" && (g = !0, o.scheduler = (P, H) => {
    H ? P() : Bs(P);
  }), o.augmentJob = (P) => {
    t && (P.flags |= 4), g && (P.flags |= 2, a && (P.id = a.uid, P.i = a));
  };
  const T = Ml(e, t, o);
  return Mt && (d ? d.push(T) : f && T()), T;
}
function Ul(e, t, s) {
  const n = this.proxy, i = ee(e) ? e.includes(".") ? di(n, e) : () => n[e] : e.bind(n, n);
  let l;
  D(t) ? l = t : (l = t.handler, s = t);
  const r = Lt(this), o = ai(i, l.bind(n), s);
  return r(), o;
}
function di(e, t) {
  const s = t.split(".");
  return () => {
    let n = e;
    for (let i = 0; i < s.length && n; i++)
      n = n[s[i]];
    return n;
  };
}
const Wl = /* @__PURE__ */ Symbol("_vte"), Kl = (e) => e.__isTeleport, Vl = /* @__PURE__ */ Symbol("_leaveCb");
function Gs(e, t) {
  e.shapeFlag & 6 && e.component ? (e.transition = t, Gs(e.component.subTree, t)) : e.shapeFlag & 128 ? (e.ssContent.transition = t.clone(e.ssContent), e.ssFallback.transition = t.clone(e.ssFallback)) : e.transition = t;
}
function pi(e) {
  e.ids = [e.ids[0] + e.ids[2]++ + "-", 0, 0];
}
function fn(e, t) {
  let s;
  return !!((s = Object.getOwnPropertyDescriptor(e, t)) && !s.configurable);
}
const Zt = /* @__PURE__ */ new WeakMap();
function Ct(e, t, s, n, i = !1) {
  if (L(e)) {
    e.forEach(
      (R, X) => Ct(
        R,
        t && (L(t) ? t[X] : t),
        s,
        n,
        i
      )
    );
    return;
  }
  if (kt(n) && !i) {
    n.shapeFlag & 512 && n.type.__asyncResolved && n.component.subTree.component && Ct(e, t, s, n.component.subTree);
    return;
  }
  const l = n.shapeFlag & 4 ? Js(n.component) : n.el, r = i ? null : l, { i: o, r: f } = e, d = t && t.r, a = o.refs === q ? o.refs = {} : o.refs, g = o.setupState, T = /* @__PURE__ */ $(g), P = g === q ? Ln : (R) => fn(a, R) ? !1 : U(T, R), H = (R, X) => !(X && fn(a, X));
  if (d != null && d !== f) {
    if (un(t), ee(d))
      a[d] = null, P(d) && (g[d] = null);
    else if (/* @__PURE__ */ ce(d)) {
      const R = t;
      H(d, R.k) && (d.value = null), R.k && (a[R.k] = null);
    }
  }
  if (D(f))
    Ft(f, o, 12, [r, a]);
  else {
    const R = ee(f), X = /* @__PURE__ */ ce(f);
    if (R || X) {
      const B = () => {
        if (e.f) {
          const k = R ? P(f) ? g[f] : a[f] : H() || !e.k ? f.value : a[e.k];
          if (i)
            L(k) && Rs(k, l);
          else if (L(k))
            k.includes(l) || k.push(l);
          else if (R)
            a[f] = [l], P(f) && (g[f] = a[f]);
          else {
            const W = [l];
            H(f, e.k) && (f.value = W), e.k && (a[e.k] = W);
          }
        } else R ? (a[f] = r, P(f) && (g[f] = r)) : X && (H(f, e.k) && (f.value = r), e.k && (a[e.k] = r));
      };
      if (r) {
        const k = () => {
          B(), Zt.delete(e);
        };
        k.id = -1, Zt.set(e, k), he(k, s);
      } else
        un(e), B();
    }
  }
}
function un(e) {
  const t = Zt.get(e);
  t && (t.flags |= 8, Zt.delete(e));
}
es().requestIdleCallback;
es().cancelIdleCallback;
const kt = (e) => !!e.type.__asyncLoader, hi = (e) => e.type.__isKeepAlive;
function Bl(e, t) {
  gi(e, "a", t);
}
function Gl(e, t) {
  gi(e, "da", t);
}
function gi(e, t, s = pe) {
  const n = e.__wdc || (e.__wdc = () => {
    let i = s;
    for (; i; ) {
      if (i.isDeactivated)
        return;
      i = i.parent;
    }
    return e();
  });
  if (ns(t, n, s), s) {
    let i = s.parent;
    for (; i && i.parent; )
      hi(i.parent.vnode) && zl(n, t, s, i), i = i.parent;
  }
}
function zl(e, t, s, n) {
  const i = ns(
    t,
    e,
    n,
    !0
    /* prepend */
  );
  yi(() => {
    Rs(n[t], i);
  }, s);
}
function ns(e, t, s = pe, n = !1) {
  if (s) {
    const i = s[e] || (s[e] = []), l = t.__weh || (t.__weh = (...r) => {
      Ke();
      const o = Lt(s), f = He(t, s, e, r);
      return o(), Ve(), f;
    });
    return n ? i.unshift(l) : i.push(l), l;
  }
}
const Ge = (e) => (t, s = pe) => {
  (!Mt || e === "sp") && ns(e, (...n) => t(...n), s);
}, Zl = Ge("bm"), vi = Ge("m"), ql = Ge(
  "bu"
), Jl = Ge("u"), _i = Ge(
  "bum"
), yi = Ge("um"), Yl = Ge(
  "sp"
), Ql = Ge("rtg"), Xl = Ge("rtc");
function er(e, t = pe) {
  ns("ec", e, t);
}
const tr = /* @__PURE__ */ Symbol.for("v-ndc");
function rt(e, t, s, n) {
  let i;
  const l = s, r = L(e);
  if (r || ee(e)) {
    const o = r && /* @__PURE__ */ nt(e);
    let f = !1, d = !1;
    o && (f = !/* @__PURE__ */ me(e), d = /* @__PURE__ */ Be(e), e = ts(e)), i = new Array(e.length);
    for (let a = 0, g = e.length; a < g; a++)
      i[a] = t(
        f ? d ? dt(we(e[a])) : we(e[a]) : e[a],
        a,
        void 0,
        l
      );
  } else if (typeof e == "number") {
    i = new Array(e);
    for (let o = 0; o < e; o++)
      i[o] = t(o + 1, o, void 0, l);
  } else if (K(e))
    if (e[Symbol.iterator])
      i = Array.from(
        e,
        (o, f) => t(o, f, void 0, l)
      );
    else {
      const o = Object.keys(e);
      i = new Array(o.length);
      for (let f = 0, d = o.length; f < d; f++) {
        const a = o[f];
        i[f] = t(e[a], a, f, l);
      }
    }
  else
    i = [];
  return i;
}
const ks = (e) => e ? Ni(e) ? Js(e) : ks(e.parent) : null, Tt = (
  // Move PURE marker to new line to workaround compiler discarding it
  // due to type annotation
  /* @__PURE__ */ fe(/* @__PURE__ */ Object.create(null), {
    $: (e) => e,
    $el: (e) => e.vnode.el,
    $data: (e) => e.data,
    $props: (e) => e.props,
    $attrs: (e) => e.attrs,
    $slots: (e) => e.slots,
    $refs: (e) => e.refs,
    $parent: (e) => ks(e.parent),
    $root: (e) => ks(e.root),
    $host: (e) => e.ce,
    $emit: (e) => e.emit,
    $options: (e) => bi(e),
    $forceUpdate: (e) => e.f || (e.f = () => {
      Bs(e.update);
    }),
    $nextTick: (e) => e.n || (e.n = Fl.bind(e.proxy)),
    $watch: (e) => Ul.bind(e)
  })
), gs = (e, t) => e !== q && !e.__isScriptSetup && U(e, t), sr = {
  get({ _: e }, t) {
    if (t === "__v_skip")
      return !0;
    const { ctx: s, setupState: n, data: i, props: l, accessCache: r, type: o, appContext: f } = e;
    if (t[0] !== "$") {
      const T = r[t];
      if (T !== void 0)
        switch (T) {
          case 1:
            return n[t];
          case 2:
            return i[t];
          case 4:
            return s[t];
          case 3:
            return l[t];
        }
      else {
        if (gs(n, t))
          return r[t] = 1, n[t];
        if (i !== q && U(i, t))
          return r[t] = 2, i[t];
        if (U(l, t))
          return r[t] = 3, l[t];
        if (s !== q && U(s, t))
          return r[t] = 4, s[t];
        Ts && (r[t] = 0);
      }
    }
    const d = Tt[t];
    let a, g;
    if (d)
      return t === "$attrs" && oe(e.attrs, "get", ""), d(e);
    if (
      // css module (injected by vue-loader)
      (a = o.__cssModules) && (a = a[t])
    )
      return a;
    if (s !== q && U(s, t))
      return r[t] = 4, s[t];
    if (
      // global properties
      g = f.config.globalProperties, U(g, t)
    )
      return g[t];
  },
  set({ _: e }, t, s) {
    const { data: n, setupState: i, ctx: l } = e;
    return gs(i, t) ? (i[t] = s, !0) : n !== q && U(n, t) ? (n[t] = s, !0) : U(e.props, t) || t[0] === "$" && t.slice(1) in e ? !1 : (l[t] = s, !0);
  },
  has({
    _: { data: e, setupState: t, accessCache: s, ctx: n, appContext: i, props: l, type: r }
  }, o) {
    let f;
    return !!(s[o] || e !== q && o[0] !== "$" && U(e, o) || gs(t, o) || U(l, o) || U(n, o) || U(Tt, o) || U(i.config.globalProperties, o) || (f = r.__cssModules) && f[o]);
  },
  defineProperty(e, t, s) {
    return s.get != null ? e._.accessCache[t] = 0 : U(s, "value") && this.set(e, t, s.value, null), Reflect.defineProperty(e, t, s);
  }
};
function an(e) {
  return L(e) ? e.reduce(
    (t, s) => (t[s] = null, t),
    {}
  ) : e;
}
let Ts = !0;
function nr(e) {
  const t = bi(e), s = e.proxy, n = e.ctx;
  Ts = !1, t.beforeCreate && dn(t.beforeCreate, e, "bc");
  const {
    // state
    data: i,
    computed: l,
    methods: r,
    watch: o,
    provide: f,
    inject: d,
    // lifecycle
    created: a,
    beforeMount: g,
    mounted: T,
    beforeUpdate: P,
    updated: H,
    activated: R,
    deactivated: X,
    beforeDestroy: B,
    beforeUnmount: k,
    destroyed: W,
    unmounted: O,
    render: N,
    renderTracked: ye,
    renderTriggered: Y,
    errorCaptured: J,
    serverPrefetch: C,
    // public API
    expose: I,
    inheritAttrs: Ce,
    // assets
    components: Dt,
    directives: Ht,
    filters: rs
  } = t;
  if (d && ir(d, n, null), r)
    for (const Q in r) {
      const G = r[Q];
      D(G) && (n[Q] = G.bind(s));
    }
  if (i) {
    const Q = i.call(s, s);
    K(Q) && (e.data = /* @__PURE__ */ Ws(Q));
  }
  if (Ts = !0, l)
    for (const Q in l) {
      const G = l[Q], Je = D(G) ? G.bind(s, s) : D(G.get) ? G.get.bind(s, s) : Le, jt = !D(G) && D(G.set) ? G.set.bind(s) : Le, Ye = tt({
        get: Je,
        set: jt
      });
      Object.defineProperty(n, Q, {
        enumerable: !0,
        configurable: !0,
        get: () => Ye.value,
        set: (ke) => Ye.value = ke
      });
    }
  if (o)
    for (const Q in o)
      mi(o[Q], n, s, Q);
  if (f) {
    const Q = D(f) ? f.call(s) : f;
    Reflect.ownKeys(Q).forEach((G) => {
      jl(G, Q[G]);
    });
  }
  a && dn(a, e, "c");
  function ue(Q, G) {
    L(G) ? G.forEach((Je) => Q(Je.bind(s))) : G && Q(G.bind(s));
  }
  if (ue(Zl, g), ue(vi, T), ue(ql, P), ue(Jl, H), ue(Bl, R), ue(Gl, X), ue(er, J), ue(Xl, ye), ue(Ql, Y), ue(_i, k), ue(yi, O), ue(Yl, C), L(I))
    if (I.length) {
      const Q = e.exposed || (e.exposed = {});
      I.forEach((G) => {
        Object.defineProperty(Q, G, {
          get: () => s[G],
          set: (Je) => s[G] = Je,
          enumerable: !0
        });
      });
    } else e.exposed || (e.exposed = {});
  N && e.render === Le && (e.render = N), Ce != null && (e.inheritAttrs = Ce), Dt && (e.components = Dt), Ht && (e.directives = Ht), C && pi(e);
}
function ir(e, t, s = Le) {
  L(e) && (e = Is(e));
  for (const n in e) {
    const i = e[n];
    let l;
    K(i) ? "default" in i ? l = Kt(
      i.from || n,
      i.default,
      !0
    ) : l = Kt(i.from || n) : l = Kt(i), /* @__PURE__ */ ce(l) ? Object.defineProperty(t, n, {
      enumerable: !0,
      configurable: !0,
      get: () => l.value,
      set: (r) => l.value = r
    }) : t[n] = l;
  }
}
function dn(e, t, s) {
  He(
    L(e) ? e.map((n) => n.bind(t.proxy)) : e.bind(t.proxy),
    t,
    s
  );
}
function mi(e, t, s, n) {
  let i = n.includes(".") ? di(s, n) : () => s[n];
  if (ee(e)) {
    const l = t[e];
    D(l) && hs(i, l);
  } else if (D(e))
    hs(i, e.bind(s));
  else if (K(e))
    if (L(e))
      e.forEach((l) => mi(l, t, s, n));
    else {
      const l = D(e.handler) ? e.handler.bind(s) : t[e.handler];
      D(l) && hs(i, l, e);
    }
}
function bi(e) {
  const t = e.type, { mixins: s, extends: n } = t, {
    mixins: i,
    optionsCache: l,
    config: { optionMergeStrategies: r }
  } = e.appContext, o = l.get(t);
  let f;
  return o ? f = o : !i.length && !s && !n ? f = t : (f = {}, i.length && i.forEach(
    (d) => qt(f, d, r, !0)
  ), qt(f, t, r)), K(t) && l.set(t, f), f;
}
function qt(e, t, s, n = !1) {
  const { mixins: i, extends: l } = t;
  l && qt(e, l, s, !0), i && i.forEach(
    (r) => qt(e, r, s, !0)
  );
  for (const r in t)
    if (!(n && r === "expose")) {
      const o = lr[r] || s && s[r];
      e[r] = o ? o(e[r], t[r]) : t[r];
    }
  return e;
}
const lr = {
  data: pn,
  props: hn,
  emits: hn,
  // objects
  methods: mt,
  computed: mt,
  // lifecycle
  beforeCreate: ae,
  created: ae,
  beforeMount: ae,
  mounted: ae,
  beforeUpdate: ae,
  updated: ae,
  beforeDestroy: ae,
  beforeUnmount: ae,
  destroyed: ae,
  unmounted: ae,
  activated: ae,
  deactivated: ae,
  errorCaptured: ae,
  serverPrefetch: ae,
  // assets
  components: mt,
  directives: mt,
  // watch
  watch: or,
  // provide / inject
  provide: pn,
  inject: rr
};
function pn(e, t) {
  return t ? e ? function() {
    return fe(
      D(e) ? e.call(this, this) : e,
      D(t) ? t.call(this, this) : t
    );
  } : t : e;
}
function rr(e, t) {
  return mt(Is(e), Is(t));
}
function Is(e) {
  if (L(e)) {
    const t = {};
    for (let s = 0; s < e.length; s++)
      t[e[s]] = e[s];
    return t;
  }
  return e;
}
function ae(e, t) {
  return e ? [...new Set([].concat(e, t))] : t;
}
function mt(e, t) {
  return e ? fe(/* @__PURE__ */ Object.create(null), e, t) : t;
}
function hn(e, t) {
  return e ? L(e) && L(t) ? [.../* @__PURE__ */ new Set([...e, ...t])] : fe(
    /* @__PURE__ */ Object.create(null),
    an(e),
    an(t ?? {})
  ) : t;
}
function or(e, t) {
  if (!e) return t;
  if (!t) return e;
  const s = fe(/* @__PURE__ */ Object.create(null), e);
  for (const n in t)
    s[n] = ae(e[n], t[n]);
  return s;
}
function xi() {
  return {
    app: null,
    config: {
      isNativeTag: Ln,
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
let cr = 0;
function fr(e, t) {
  return function(n, i = null) {
    D(n) || (n = fe({}, n)), i != null && !K(i) && (i = null);
    const l = xi(), r = /* @__PURE__ */ new WeakSet(), o = [];
    let f = !1;
    const d = l.app = {
      _uid: cr++,
      _component: n,
      _props: i,
      _container: null,
      _context: l,
      _instance: null,
      version: Kr,
      get config() {
        return l.config;
      },
      set config(a) {
      },
      use(a, ...g) {
        return r.has(a) || (a && D(a.install) ? (r.add(a), a.install(d, ...g)) : D(a) && (r.add(a), a(d, ...g))), d;
      },
      mixin(a) {
        return l.mixins.includes(a) || l.mixins.push(a), d;
      },
      component(a, g) {
        return g ? (l.components[a] = g, d) : l.components[a];
      },
      directive(a, g) {
        return g ? (l.directives[a] = g, d) : l.directives[a];
      },
      mount(a, g, T) {
        if (!f) {
          const P = d._ceVNode || We(n, i);
          return P.appContext = l, T === !0 ? T = "svg" : T === !1 && (T = void 0), e(P, a, T), f = !0, d._container = a, a.__vue_app__ = d, Js(P.component);
        }
      },
      onUnmount(a) {
        o.push(a);
      },
      unmount() {
        f && (He(
          o,
          d._instance,
          16
        ), e(null, d._container), delete d._container.__vue_app__);
      },
      provide(a, g) {
        return l.provides[a] = g, d;
      },
      runWithContext(a) {
        const g = at;
        at = d;
        try {
          return a();
        } finally {
          at = g;
        }
      }
    };
    return d;
  };
}
let at = null;
const ur = (e, t) => t === "modelValue" || t === "model-value" ? e.modelModifiers : e[`${t}Modifiers`] || e[`${xe(t)}Modifiers`] || e[`${it(t)}Modifiers`];
function ar(e, t, ...s) {
  if (e.isUnmounted) return;
  const n = e.vnode.props || q;
  let i = s;
  const l = t.startsWith("update:"), r = l && ur(n, t.slice(7));
  r && (r.trim && (i = s.map((a) => ee(a) ? a.trim() : a)), r.number && (i = s.map(Zi)));
  let o, f = n[o = cs(t)] || // also try camelCase event handler (#2249)
  n[o = cs(xe(t))];
  !f && l && (f = n[o = cs(it(t))]), f && He(
    f,
    e,
    6,
    i
  );
  const d = n[o + "Once"];
  if (d) {
    if (!e.emitted)
      e.emitted = {};
    else if (e.emitted[o])
      return;
    e.emitted[o] = !0, He(
      d,
      e,
      6,
      i
    );
  }
}
const dr = /* @__PURE__ */ new WeakMap();
function Si(e, t, s = !1) {
  const n = s ? dr : t.emitsCache, i = n.get(e);
  if (i !== void 0)
    return i;
  const l = e.emits;
  let r = {}, o = !1;
  if (!D(e)) {
    const f = (d) => {
      const a = Si(d, t, !0);
      a && (o = !0, fe(r, a));
    };
    !s && t.mixins.length && t.mixins.forEach(f), e.extends && f(e.extends), e.mixins && e.mixins.forEach(f);
  }
  return !l && !o ? (K(e) && n.set(e, null), null) : (L(l) ? l.forEach((f) => r[f] = null) : fe(r, l), K(e) && n.set(e, r), r);
}
function is(e, t) {
  return !e || !Yt(t) ? !1 : (t = t.slice(2).replace(/Once$/, ""), U(e, t[0].toLowerCase() + t.slice(1)) || U(e, it(t)) || U(e, t));
}
function gn(e) {
  const {
    type: t,
    vnode: s,
    proxy: n,
    withProxy: i,
    propsOptions: [l],
    slots: r,
    attrs: o,
    emit: f,
    render: d,
    renderCache: a,
    props: g,
    data: T,
    setupState: P,
    ctx: H,
    inheritAttrs: R
  } = e, X = zt(e);
  let B, k;
  try {
    if (s.shapeFlag & 4) {
      const O = i || n, N = O;
      B = Me(
        d.call(
          N,
          O,
          a,
          g,
          P,
          T,
          H
        )
      ), k = o;
    } else {
      const O = t;
      B = Me(
        O.length > 1 ? O(
          g,
          { attrs: o, slots: r, emit: f }
        ) : O(
          g,
          null
        )
      ), k = t.props ? o : pr(o);
    }
  } catch (O) {
    It.length = 0, ss(O, e, 1), B = We(qe);
  }
  let W = B;
  if (k && R !== !1) {
    const O = Object.keys(k), { shapeFlag: N } = W;
    O.length && N & 7 && (l && O.some(Qt) && (k = hr(
      k,
      l
    )), W = pt(W, k, !1, !0));
  }
  return s.dirs && (W = pt(W, null, !1, !0), W.dirs = W.dirs ? W.dirs.concat(s.dirs) : s.dirs), s.transition && Gs(W, s.transition), B = W, zt(X), B;
}
const pr = (e) => {
  let t;
  for (const s in e)
    (s === "class" || s === "style" || Yt(s)) && ((t || (t = {}))[s] = e[s]);
  return t;
}, hr = (e, t) => {
  const s = {};
  for (const n in e)
    (!Qt(n) || !(n.slice(9) in t)) && (s[n] = e[n]);
  return s;
};
function gr(e, t, s) {
  const { props: n, children: i, component: l } = e, { props: r, children: o, patchFlag: f } = t, d = l.emitsOptions;
  if (t.dirs || t.transition)
    return !0;
  if (s && f >= 0) {
    if (f & 1024)
      return !0;
    if (f & 16)
      return n ? vn(n, r, d) : !!r;
    if (f & 8) {
      const a = t.dynamicProps;
      for (let g = 0; g < a.length; g++) {
        const T = a[g];
        if (wi(r, n, T) && !is(d, T))
          return !0;
      }
    }
  } else
    return (i || o) && (!o || !o.$stable) ? !0 : n === r ? !1 : n ? r ? vn(n, r, d) : !0 : !!r;
  return !1;
}
function vn(e, t, s) {
  const n = Object.keys(t);
  if (n.length !== Object.keys(e).length)
    return !0;
  for (let i = 0; i < n.length; i++) {
    const l = n[i];
    if (wi(t, e, l) && !is(s, l))
      return !0;
  }
  return !1;
}
function wi(e, t, s) {
  const n = e[s], i = t[s];
  return s === "style" && K(n) && K(i) ? !Ds(n, i) : n !== i;
}
function vr({ vnode: e, parent: t, suspense: s }, n) {
  for (; t; ) {
    const i = t.subTree;
    if (i.suspense && i.suspense.activeBranch === e && (i.suspense.vnode.el = i.el = n, e = i), i === e)
      (e = t.vnode).el = n, t = t.parent;
    else
      break;
  }
  s && s.activeBranch === e && (s.vnode.el = n);
}
const Ci = {}, ki = () => Object.create(Ci), Ti = (e) => Object.getPrototypeOf(e) === Ci;
function _r(e, t, s, n = !1) {
  const i = {}, l = ki();
  e.propsDefaults = /* @__PURE__ */ Object.create(null), Ii(e, t, i, l);
  for (const r in e.propsOptions[0])
    r in i || (i[r] = void 0);
  s ? e.props = n ? i : /* @__PURE__ */ Sl(i) : e.type.props ? e.props = i : e.props = l, e.attrs = l;
}
function yr(e, t, s, n) {
  const {
    props: i,
    attrs: l,
    vnode: { patchFlag: r }
  } = e, o = /* @__PURE__ */ $(i), [f] = e.propsOptions;
  let d = !1;
  if (
    // always force full diff in dev
    // - #1942 if hmr is enabled with sfc component
    // - vite#872 non-sfc component used by sfc component
    (n || r > 0) && !(r & 16)
  ) {
    if (r & 8) {
      const a = e.vnode.dynamicProps;
      for (let g = 0; g < a.length; g++) {
        let T = a[g];
        if (is(e.emitsOptions, T))
          continue;
        const P = t[T];
        if (f)
          if (U(l, T))
            P !== l[T] && (l[T] = P, d = !0);
          else {
            const H = xe(T);
            i[H] = Ps(
              f,
              o,
              H,
              P,
              e,
              !1
            );
          }
        else
          P !== l[T] && (l[T] = P, d = !0);
      }
    }
  } else {
    Ii(e, t, i, l) && (d = !0);
    let a;
    for (const g in o)
      (!t || // for camelCase
      !U(t, g) && // it's possible the original props was passed in as kebab-case
      // and converted to camelCase (#955)
      ((a = it(g)) === g || !U(t, a))) && (f ? s && // for camelCase
      (s[g] !== void 0 || // for kebab-case
      s[a] !== void 0) && (i[g] = Ps(
        f,
        o,
        g,
        void 0,
        e,
        !0
      )) : delete i[g]);
    if (l !== o)
      for (const g in l)
        (!t || !U(t, g)) && (delete l[g], d = !0);
  }
  d && Ue(e.attrs, "set", "");
}
function Ii(e, t, s, n) {
  const [i, l] = e.propsOptions;
  let r = !1, o;
  if (t)
    for (let f in t) {
      if (xt(f))
        continue;
      const d = t[f];
      let a;
      i && U(i, a = xe(f)) ? !l || !l.includes(a) ? s[a] = d : (o || (o = {}))[a] = d : is(e.emitsOptions, f) || (!(f in n) || d !== n[f]) && (n[f] = d, r = !0);
    }
  if (l) {
    const f = /* @__PURE__ */ $(s), d = o || q;
    for (let a = 0; a < l.length; a++) {
      const g = l[a];
      s[g] = Ps(
        i,
        f,
        g,
        d[g],
        e,
        !U(d, g)
      );
    }
  }
  return r;
}
function Ps(e, t, s, n, i, l) {
  const r = e[s];
  if (r != null) {
    const o = U(r, "default");
    if (o && n === void 0) {
      const f = r.default;
      if (r.type !== Function && !r.skipFactory && D(f)) {
        const { propsDefaults: d } = i;
        if (s in d)
          n = d[s];
        else {
          const a = Lt(i);
          n = d[s] = f.call(
            null,
            t
          ), a();
        }
      } else
        n = f;
      i.ce && i.ce._setProp(s, n);
    }
    r[
      0
      /* shouldCast */
    ] && (l && !o ? n = !1 : r[
      1
      /* shouldCastTrue */
    ] && (n === "" || n === it(s)) && (n = !0));
  }
  return n;
}
const mr = /* @__PURE__ */ new WeakMap();
function Pi(e, t, s = !1) {
  const n = s ? mr : t.propsCache, i = n.get(e);
  if (i)
    return i;
  const l = e.props, r = {}, o = [];
  let f = !1;
  if (!D(e)) {
    const a = (g) => {
      f = !0;
      const [T, P] = Pi(g, t, !0);
      fe(r, T), P && o.push(...P);
    };
    !s && t.mixins.length && t.mixins.forEach(a), e.extends && a(e.extends), e.mixins && e.mixins.forEach(a);
  }
  if (!l && !f)
    return K(e) && n.set(e, ct), ct;
  if (L(l))
    for (let a = 0; a < l.length; a++) {
      const g = xe(l[a]);
      _n(g) && (r[g] = q);
    }
  else if (l)
    for (const a in l) {
      const g = xe(a);
      if (_n(g)) {
        const T = l[a], P = r[g] = L(T) || D(T) ? { type: T } : fe({}, T), H = P.type;
        let R = !1, X = !0;
        if (L(H))
          for (let B = 0; B < H.length; ++B) {
            const k = H[B], W = D(k) && k.name;
            if (W === "Boolean") {
              R = !0;
              break;
            } else W === "String" && (X = !1);
          }
        else
          R = D(H) && H.name === "Boolean";
        P[
          0
          /* shouldCast */
        ] = R, P[
          1
          /* shouldCastTrue */
        ] = X, (R || U(P, "default")) && o.push(g);
      }
    }
  const d = [r, o];
  return K(e) && n.set(e, d), d;
}
function _n(e) {
  return e[0] !== "$" && !xt(e);
}
const zs = (e) => e === "_" || e === "_ctx" || e === "$stable", Zs = (e) => L(e) ? e.map(Me) : [Me(e)], br = (e, t, s) => {
  if (t._n)
    return t;
  const n = Hl((...i) => Zs(t(...i)), s);
  return n._c = !1, n;
}, Ei = (e, t, s) => {
  const n = e._ctx;
  for (const i in e) {
    if (zs(i)) continue;
    const l = e[i];
    if (D(l))
      t[i] = br(i, l, n);
    else if (l != null) {
      const r = Zs(l);
      t[i] = () => r;
    }
  }
}, Ai = (e, t) => {
  const s = Zs(t);
  e.slots.default = () => s;
}, Oi = (e, t, s) => {
  for (const n in t)
    (s || !zs(n)) && (e[n] = t[n]);
}, xr = (e, t, s) => {
  const n = e.slots = ki();
  if (e.vnode.shapeFlag & 32) {
    const i = t._;
    i ? (Oi(n, t, s), s && Un(n, "_", i, !0)) : Ei(t, n);
  } else t && Ai(e, t);
}, Sr = (e, t, s) => {
  const { vnode: n, slots: i } = e;
  let l = !0, r = q;
  if (n.shapeFlag & 32) {
    const o = t._;
    o ? s && o === 1 ? l = !1 : Oi(i, t, s) : (l = !t.$stable, Ei(t, i)), r = t;
  } else t && (Ai(e, t), r = { default: 1 });
  if (l)
    for (const o in i)
      !zs(o) && r[o] == null && delete i[o];
}, he = Ir;
function wr(e) {
  return Cr(e);
}
function Cr(e, t) {
  const s = es();
  s.__VUE__ = !0;
  const {
    insert: n,
    remove: i,
    patchProp: l,
    createElement: r,
    createText: o,
    createComment: f,
    setText: d,
    setElementText: a,
    parentNode: g,
    nextSibling: T,
    setScopeId: P = Le,
    insertStaticContent: H
  } = e, R = (c, u, p, m = null, v = null, _ = null, S = void 0, x = null, b = !!u.dynamicChildren) => {
    if (c === u)
      return;
    c && !yt(c, u) && (m = Nt(c), ke(c, v, _, !0), c = null), u.patchFlag === -2 && (b = !1, u.dynamicChildren = null);
    const { type: y, ref: A, shapeFlag: w } = u;
    switch (y) {
      case ls:
        X(c, u, p, m);
        break;
      case qe:
        B(c, u, p, m);
        break;
      case _s:
        c == null && k(u, p, m, S);
        break;
      case re:
        Dt(
          c,
          u,
          p,
          m,
          v,
          _,
          S,
          x,
          b
        );
        break;
      default:
        w & 1 ? N(
          c,
          u,
          p,
          m,
          v,
          _,
          S,
          x,
          b
        ) : w & 6 ? Ht(
          c,
          u,
          p,
          m,
          v,
          _,
          S,
          x,
          b
        ) : (w & 64 || w & 128) && y.process(
          c,
          u,
          p,
          m,
          v,
          _,
          S,
          x,
          b,
          gt
        );
    }
    A != null && v ? Ct(A, c && c.ref, _, u || c, !u) : A == null && c && c.ref != null && Ct(c.ref, null, _, c, !0);
  }, X = (c, u, p, m) => {
    if (c == null)
      n(
        u.el = o(u.children),
        p,
        m
      );
    else {
      const v = u.el = c.el;
      u.children !== c.children && d(v, u.children);
    }
  }, B = (c, u, p, m) => {
    c == null ? n(
      u.el = f(u.children || ""),
      p,
      m
    ) : u.el = c.el;
  }, k = (c, u, p, m) => {
    [c.el, c.anchor] = H(
      c.children,
      u,
      p,
      m,
      c.el,
      c.anchor
    );
  }, W = ({ el: c, anchor: u }, p, m) => {
    let v;
    for (; c && c !== u; )
      v = T(c), n(c, p, m), c = v;
    n(u, p, m);
  }, O = ({ el: c, anchor: u }) => {
    let p;
    for (; c && c !== u; )
      p = T(c), i(c), c = p;
    i(u);
  }, N = (c, u, p, m, v, _, S, x, b) => {
    if (u.type === "svg" ? S = "svg" : u.type === "math" && (S = "mathml"), c == null)
      ye(
        u,
        p,
        m,
        v,
        _,
        S,
        x,
        b
      );
    else {
      const y = c.el && c.el._isVueCE ? c.el : null;
      try {
        y && y._beginPatch(), C(
          c,
          u,
          v,
          _,
          S,
          x,
          b
        );
      } finally {
        y && y._endPatch();
      }
    }
  }, ye = (c, u, p, m, v, _, S, x) => {
    let b, y;
    const { props: A, shapeFlag: w, transition: E, dirs: M } = c;
    if (b = c.el = r(
      c.type,
      _,
      A && A.is,
      A
    ), w & 8 ? a(b, c.children) : w & 16 && J(
      c.children,
      b,
      null,
      m,
      v,
      vs(c, _),
      S,
      x
    ), M && Qe(c, null, m, "created"), Y(b, c, c.scopeId, S, m), A) {
      for (const V in A)
        V !== "value" && !xt(V) && l(b, V, null, A[V], _, m);
      "value" in A && l(b, "value", null, A.value, _), (y = A.onVnodeBeforeMount) && Ee(y, m, c);
    }
    M && Qe(c, null, m, "beforeMount");
    const j = kr(v, E);
    j && E.beforeEnter(b), n(b, u, p), ((y = A && A.onVnodeMounted) || j || M) && he(() => {
      y && Ee(y, m, c), j && E.enter(b), M && Qe(c, null, m, "mounted");
    }, v);
  }, Y = (c, u, p, m, v) => {
    if (p && P(c, p), m)
      for (let _ = 0; _ < m.length; _++)
        P(c, m[_]);
    if (v) {
      let _ = v.subTree;
      if (u === _ || Li(_.type) && (_.ssContent === u || _.ssFallback === u)) {
        const S = v.vnode;
        Y(
          c,
          S,
          S.scopeId,
          S.slotScopeIds,
          v.parent
        );
      }
    }
  }, J = (c, u, p, m, v, _, S, x, b = 0) => {
    for (let y = b; y < c.length; y++) {
      const A = c[y] = x ? $e(c[y]) : Me(c[y]);
      R(
        null,
        A,
        u,
        p,
        m,
        v,
        _,
        S,
        x
      );
    }
  }, C = (c, u, p, m, v, _, S) => {
    const x = u.el = c.el;
    let { patchFlag: b, dynamicChildren: y, dirs: A } = u;
    b |= c.patchFlag & 16;
    const w = c.props || q, E = u.props || q;
    let M;
    if (p && Xe(p, !1), (M = E.onVnodeBeforeUpdate) && Ee(M, p, u, c), A && Qe(u, c, p, "beforeUpdate"), p && Xe(p, !0), (w.innerHTML && E.innerHTML == null || w.textContent && E.textContent == null) && a(x, ""), y ? I(
      c.dynamicChildren,
      y,
      x,
      p,
      m,
      vs(u, v),
      _
    ) : S || G(
      c,
      u,
      x,
      null,
      p,
      m,
      vs(u, v),
      _,
      !1
    ), b > 0) {
      if (b & 16)
        Ce(x, w, E, p, v);
      else if (b & 2 && w.class !== E.class && l(x, "class", null, E.class, v), b & 4 && l(x, "style", w.style, E.style, v), b & 8) {
        const j = u.dynamicProps;
        for (let V = 0; V < j.length; V++) {
          const z = j[V], se = w[z], ie = E[z];
          (ie !== se || z === "value") && l(x, z, se, ie, v, p);
        }
      }
      b & 1 && c.children !== u.children && a(x, u.children);
    } else !S && y == null && Ce(x, w, E, p, v);
    ((M = E.onVnodeUpdated) || A) && he(() => {
      M && Ee(M, p, u, c), A && Qe(u, c, p, "updated");
    }, m);
  }, I = (c, u, p, m, v, _, S) => {
    for (let x = 0; x < u.length; x++) {
      const b = c[x], y = u[x], A = (
        // oldVNode may be an errored async setup() component inside Suspense
        // which will not have a mounted element
        b.el && // - In the case of a Fragment, we need to provide the actual parent
        // of the Fragment itself so it can move its children.
        (b.type === re || // - In the case of different nodes, there is going to be a replacement
        // which also requires the correct parent container
        !yt(b, y) || // - In the case of a component, it could contain anything.
        b.shapeFlag & 198) ? g(b.el) : (
          // In other cases, the parent container is not actually used so we
          // just pass the block element here to avoid a DOM parentNode call.
          p
        )
      );
      R(
        b,
        y,
        A,
        null,
        m,
        v,
        _,
        S,
        !0
      );
    }
  }, Ce = (c, u, p, m, v) => {
    if (u !== p) {
      if (u !== q)
        for (const _ in u)
          !xt(_) && !(_ in p) && l(
            c,
            _,
            u[_],
            null,
            v,
            m
          );
      for (const _ in p) {
        if (xt(_)) continue;
        const S = p[_], x = u[_];
        S !== x && _ !== "value" && l(c, _, x, S, v, m);
      }
      "value" in p && l(c, "value", u.value, p.value, v);
    }
  }, Dt = (c, u, p, m, v, _, S, x, b) => {
    const y = u.el = c ? c.el : o(""), A = u.anchor = c ? c.anchor : o("");
    let { patchFlag: w, dynamicChildren: E, slotScopeIds: M } = u;
    M && (x = x ? x.concat(M) : M), c == null ? (n(y, p, m), n(A, p, m), J(
      // #10007
      // such fragment like `<></>` will be compiled into
      // a fragment which doesn't have a children.
      // In this case fallback to an empty array
      u.children || [],
      p,
      A,
      v,
      _,
      S,
      x,
      b
    )) : w > 0 && w & 64 && E && // #2715 the previous fragment could've been a BAILed one as a result
    // of renderSlot() with no valid children
    c.dynamicChildren && c.dynamicChildren.length === E.length ? (I(
      c.dynamicChildren,
      E,
      p,
      v,
      _,
      S,
      x
    ), // #2080 if the stable fragment has a key, it's a <template v-for> that may
    //  get moved around. Make sure all root level vnodes inherit el.
    // #2134 or if it's a component root, it may also get moved around
    // as the component is being moved.
    (u.key != null || v && u === v.subTree) && Mi(
      c,
      u,
      !0
      /* shallow */
    )) : G(
      c,
      u,
      p,
      A,
      v,
      _,
      S,
      x,
      b
    );
  }, Ht = (c, u, p, m, v, _, S, x, b) => {
    u.slotScopeIds = x, c == null ? u.shapeFlag & 512 ? v.ctx.activate(
      u,
      p,
      m,
      S,
      b
    ) : rs(
      u,
      p,
      m,
      v,
      _,
      S,
      b
    ) : Ys(c, u, b);
  }, rs = (c, u, p, m, v, _, S) => {
    const x = c.component = Dr(
      c,
      m,
      v
    );
    if (hi(c) && (x.ctx.renderer = gt), jr(x, !1, S), x.asyncDep) {
      if (v && v.registerDep(x, ue, S), !c.el) {
        const b = x.subTree = We(qe);
        B(null, b, u, p), c.placeholder = b.el;
      }
    } else
      ue(
        x,
        c,
        u,
        p,
        v,
        _,
        S
      );
  }, Ys = (c, u, p) => {
    const m = u.component = c.component;
    if (gr(c, u, p))
      if (m.asyncDep && !m.asyncResolved) {
        Q(m, u, p);
        return;
      } else
        m.next = u, m.update();
    else
      u.el = c.el, m.vnode = u;
  }, ue = (c, u, p, m, v, _, S) => {
    const x = () => {
      if (c.isMounted) {
        let { next: w, bu: E, u: M, parent: j, vnode: V } = c;
        {
          const Ie = Ri(c);
          if (Ie) {
            w && (w.el = V.el, Q(c, w, S)), Ie.asyncDep.then(() => {
              he(() => {
                c.isUnmounted || y();
              }, v);
            });
            return;
          }
        }
        let z = w, se;
        Xe(c, !1), w ? (w.el = V.el, Q(c, w, S)) : w = V, E && fs(E), (se = w.props && w.props.onVnodeBeforeUpdate) && Ee(se, j, w, V), Xe(c, !0);
        const ie = gn(c), Te = c.subTree;
        c.subTree = ie, R(
          Te,
          ie,
          // parent may have changed if it's in a teleport
          g(Te.el),
          // anchor may have changed if it's in a fragment
          Nt(Te),
          c,
          v,
          _
        ), w.el = ie.el, z === null && vr(c, ie.el), M && he(M, v), (se = w.props && w.props.onVnodeUpdated) && he(
          () => Ee(se, j, w, V),
          v
        );
      } else {
        let w;
        const { el: E, props: M } = u, { bm: j, m: V, parent: z, root: se, type: ie } = c, Te = kt(u);
        Xe(c, !1), j && fs(j), !Te && (w = M && M.onVnodeBeforeMount) && Ee(w, z, u), Xe(c, !0);
        {
          se.ce && se.ce._hasShadowRoot() && se.ce._injectChildStyle(
            ie,
            c.parent ? c.parent.type : void 0
          );
          const Ie = c.subTree = gn(c);
          R(
            null,
            Ie,
            p,
            m,
            c,
            v,
            _
          ), u.el = Ie.el;
        }
        if (V && he(V, v), !Te && (w = M && M.onVnodeMounted)) {
          const Ie = u;
          he(
            () => Ee(w, z, Ie),
            v
          );
        }
        (u.shapeFlag & 256 || z && kt(z.vnode) && z.vnode.shapeFlag & 256) && c.a && he(c.a, v), c.isMounted = !0, u = p = m = null;
      }
    };
    c.scope.on();
    const b = c.effect = new Bn(x);
    c.scope.off();
    const y = c.update = b.run.bind(b), A = c.job = b.runIfDirty.bind(b);
    A.i = c, A.id = c.uid, b.scheduler = () => Bs(A), Xe(c, !0), y();
  }, Q = (c, u, p) => {
    u.component = c;
    const m = c.vnode.props;
    c.vnode = u, c.next = null, yr(c, u.props, m, p), Sr(c, u.children, p), Ke(), cn(c), Ve();
  }, G = (c, u, p, m, v, _, S, x, b = !1) => {
    const y = c && c.children, A = c ? c.shapeFlag : 0, w = u.children, { patchFlag: E, shapeFlag: M } = u;
    if (E > 0) {
      if (E & 128) {
        jt(
          y,
          w,
          p,
          m,
          v,
          _,
          S,
          x,
          b
        );
        return;
      } else if (E & 256) {
        Je(
          y,
          w,
          p,
          m,
          v,
          _,
          S,
          x,
          b
        );
        return;
      }
    }
    M & 8 ? (A & 16 && ht(y, v, _), w !== y && a(p, w)) : A & 16 ? M & 16 ? jt(
      y,
      w,
      p,
      m,
      v,
      _,
      S,
      x,
      b
    ) : ht(y, v, _, !0) : (A & 8 && a(p, ""), M & 16 && J(
      w,
      p,
      m,
      v,
      _,
      S,
      x,
      b
    ));
  }, Je = (c, u, p, m, v, _, S, x, b) => {
    c = c || ct, u = u || ct;
    const y = c.length, A = u.length, w = Math.min(y, A);
    let E;
    for (E = 0; E < w; E++) {
      const M = u[E] = b ? $e(u[E]) : Me(u[E]);
      R(
        c[E],
        M,
        p,
        null,
        v,
        _,
        S,
        x,
        b
      );
    }
    y > A ? ht(
      c,
      v,
      _,
      !0,
      !1,
      w
    ) : J(
      u,
      p,
      m,
      v,
      _,
      S,
      x,
      b,
      w
    );
  }, jt = (c, u, p, m, v, _, S, x, b) => {
    let y = 0;
    const A = u.length;
    let w = c.length - 1, E = A - 1;
    for (; y <= w && y <= E; ) {
      const M = c[y], j = u[y] = b ? $e(u[y]) : Me(u[y]);
      if (yt(M, j))
        R(
          M,
          j,
          p,
          null,
          v,
          _,
          S,
          x,
          b
        );
      else
        break;
      y++;
    }
    for (; y <= w && y <= E; ) {
      const M = c[w], j = u[E] = b ? $e(u[E]) : Me(u[E]);
      if (yt(M, j))
        R(
          M,
          j,
          p,
          null,
          v,
          _,
          S,
          x,
          b
        );
      else
        break;
      w--, E--;
    }
    if (y > w) {
      if (y <= E) {
        const M = E + 1, j = M < A ? u[M].el : m;
        for (; y <= E; )
          R(
            null,
            u[y] = b ? $e(u[y]) : Me(u[y]),
            p,
            j,
            v,
            _,
            S,
            x,
            b
          ), y++;
      }
    } else if (y > E)
      for (; y <= w; )
        ke(c[y], v, _, !0), y++;
    else {
      const M = y, j = y, V = /* @__PURE__ */ new Map();
      for (y = j; y <= E; y++) {
        const ve = u[y] = b ? $e(u[y]) : Me(u[y]);
        ve.key != null && V.set(ve.key, y);
      }
      let z, se = 0;
      const ie = E - j + 1;
      let Te = !1, Ie = 0;
      const vt = new Array(ie);
      for (y = 0; y < ie; y++) vt[y] = 0;
      for (y = M; y <= w; y++) {
        const ve = c[y];
        if (se >= ie) {
          ke(ve, v, _, !0);
          continue;
        }
        let Pe;
        if (ve.key != null)
          Pe = V.get(ve.key);
        else
          for (z = j; z <= E; z++)
            if (vt[z - j] === 0 && yt(ve, u[z])) {
              Pe = z;
              break;
            }
        Pe === void 0 ? ke(ve, v, _, !0) : (vt[Pe - j] = y + 1, Pe >= Ie ? Ie = Pe : Te = !0, R(
          ve,
          u[Pe],
          p,
          null,
          v,
          _,
          S,
          x,
          b
        ), se++);
      }
      const en = Te ? Tr(vt) : ct;
      for (z = en.length - 1, y = ie - 1; y >= 0; y--) {
        const ve = j + y, Pe = u[ve], tn = u[ve + 1], sn = ve + 1 < A ? (
          // #13559, #14173 fallback to el placeholder for unresolved async component
          tn.el || Fi(tn)
        ) : m;
        vt[y] === 0 ? R(
          null,
          Pe,
          p,
          sn,
          v,
          _,
          S,
          x,
          b
        ) : Te && (z < 0 || y !== en[z] ? Ye(Pe, p, sn, 2) : z--);
      }
    }
  }, Ye = (c, u, p, m, v = null) => {
    const { el: _, type: S, transition: x, children: b, shapeFlag: y } = c;
    if (y & 6) {
      Ye(c.component.subTree, u, p, m);
      return;
    }
    if (y & 128) {
      c.suspense.move(u, p, m);
      return;
    }
    if (y & 64) {
      S.move(c, u, p, gt);
      return;
    }
    if (S === re) {
      n(_, u, p);
      for (let w = 0; w < b.length; w++)
        Ye(b[w], u, p, m);
      n(c.anchor, u, p);
      return;
    }
    if (S === _s) {
      W(c, u, p);
      return;
    }
    if (m !== 2 && y & 1 && x)
      if (m === 0)
        x.beforeEnter(_), n(_, u, p), he(() => x.enter(_), v);
      else {
        const { leave: w, delayLeave: E, afterLeave: M } = x, j = () => {
          c.ctx.isUnmounted ? i(_) : n(_, u, p);
        }, V = () => {
          _._isLeaving && _[Vl](
            !0
            /* cancelled */
          ), w(_, () => {
            j(), M && M();
          });
        };
        E ? E(_, j, V) : V();
      }
    else
      n(_, u, p);
  }, ke = (c, u, p, m = !1, v = !1) => {
    const {
      type: _,
      props: S,
      ref: x,
      children: b,
      dynamicChildren: y,
      shapeFlag: A,
      patchFlag: w,
      dirs: E,
      cacheIndex: M,
      memo: j
    } = c;
    if (w === -2 && (v = !1), x != null && (Ke(), Ct(x, null, p, c, !0), Ve()), M != null && (u.renderCache[M] = void 0), A & 256) {
      u.ctx.deactivate(c);
      return;
    }
    const V = A & 1 && E, z = !kt(c);
    let se;
    if (z && (se = S && S.onVnodeBeforeUnmount) && Ee(se, u, c), A & 6)
      Ki(c.component, p, m);
    else {
      if (A & 128) {
        c.suspense.unmount(p, m);
        return;
      }
      V && Qe(c, null, u, "beforeUnmount"), A & 64 ? c.type.remove(
        c,
        u,
        p,
        gt,
        m
      ) : y && // #5154
      // when v-once is used inside a block, setBlockTracking(-1) marks the
      // parent block with hasOnce: true
      // so that it doesn't take the fast path during unmount - otherwise
      // components nested in v-once are never unmounted.
      !y.hasOnce && // #1153: fast path should not be taken for non-stable (v-for) fragments
      (_ !== re || w > 0 && w & 64) ? ht(
        y,
        u,
        p,
        !1,
        !0
      ) : (_ === re && w & 384 || !v && A & 16) && ht(b, u, p), m && Qs(c);
    }
    const ie = j != null && M == null;
    (z && (se = S && S.onVnodeUnmounted) || V || ie) && he(() => {
      se && Ee(se, u, c), V && Qe(c, null, u, "unmounted"), ie && (c.el = null);
    }, p);
  }, Qs = (c) => {
    const { type: u, el: p, anchor: m, transition: v } = c;
    if (u === re) {
      Wi(p, m);
      return;
    }
    if (u === _s) {
      O(c);
      return;
    }
    const _ = () => {
      i(p), v && !v.persisted && v.afterLeave && v.afterLeave();
    };
    if (c.shapeFlag & 1 && v && !v.persisted) {
      const { leave: S, delayLeave: x } = v, b = () => S(p, _);
      x ? x(c.el, _, b) : b();
    } else
      _();
  }, Wi = (c, u) => {
    let p;
    for (; c !== u; )
      p = T(c), i(c), c = p;
    i(u);
  }, Ki = (c, u, p) => {
    const { bum: m, scope: v, job: _, subTree: S, um: x, m: b, a: y } = c;
    yn(b), yn(y), m && fs(m), v.stop(), _ && (_.flags |= 8, ke(S, c, u, p)), x && he(x, u), he(() => {
      c.isUnmounted = !0;
    }, u);
  }, ht = (c, u, p, m = !1, v = !1, _ = 0) => {
    for (let S = _; S < c.length; S++)
      ke(c[S], u, p, m, v);
  }, Nt = (c) => {
    if (c.shapeFlag & 6)
      return Nt(c.component.subTree);
    if (c.shapeFlag & 128)
      return c.suspense.next();
    const u = T(c.anchor || c.el), p = u && u[Wl];
    return p ? T(p) : u;
  };
  let os = !1;
  const Xs = (c, u, p) => {
    let m;
    c == null ? u._vnode && (ke(u._vnode, null, null, !0), m = u._vnode.component) : R(
      u._vnode || null,
      c,
      u,
      null,
      null,
      null,
      p
    ), u._vnode = c, os || (os = !0, cn(m), ci(), os = !1);
  }, gt = {
    p: R,
    um: ke,
    m: Ye,
    r: Qs,
    mt: rs,
    mc: J,
    pc: G,
    pbc: I,
    n: Nt,
    o: e
  };
  return {
    render: Xs,
    hydrate: void 0,
    createApp: fr(Xs)
  };
}
function vs({ type: e, props: t }, s) {
  return s === "svg" && e === "foreignObject" || s === "mathml" && e === "annotation-xml" && t && t.encoding && t.encoding.includes("html") ? void 0 : s;
}
function Xe({ effect: e, job: t }, s) {
  s ? (e.flags |= 32, t.flags |= 4) : (e.flags &= -33, t.flags &= -5);
}
function kr(e, t) {
  return (!e || e && !e.pendingBranch) && t && !t.persisted;
}
function Mi(e, t, s = !1) {
  const n = e.children, i = t.children;
  if (L(n) && L(i))
    for (let l = 0; l < n.length; l++) {
      const r = n[l];
      let o = i[l];
      o.shapeFlag & 1 && !o.dynamicChildren && ((o.patchFlag <= 0 || o.patchFlag === 32) && (o = i[l] = $e(i[l]), o.el = r.el), !s && o.patchFlag !== -2 && Mi(r, o)), o.type === ls && (o.patchFlag === -1 && (o = i[l] = $e(o)), o.el = r.el), o.type === qe && !o.el && (o.el = r.el);
    }
}
function Tr(e) {
  const t = e.slice(), s = [0];
  let n, i, l, r, o;
  const f = e.length;
  for (n = 0; n < f; n++) {
    const d = e[n];
    if (d !== 0) {
      if (i = s[s.length - 1], e[i] < d) {
        t[n] = i, s.push(n);
        continue;
      }
      for (l = 0, r = s.length - 1; l < r; )
        o = l + r >> 1, e[s[o]] < d ? l = o + 1 : r = o;
      d < e[s[l]] && (l > 0 && (t[n] = s[l - 1]), s[l] = n);
    }
  }
  for (l = s.length, r = s[l - 1]; l-- > 0; )
    s[l] = r, r = t[r];
  return s;
}
function Ri(e) {
  const t = e.subTree.component;
  if (t)
    return t.asyncDep && !t.asyncResolved ? t : Ri(t);
}
function yn(e) {
  if (e)
    for (let t = 0; t < e.length; t++)
      e[t].flags |= 8;
}
function Fi(e) {
  if (e.placeholder)
    return e.placeholder;
  const t = e.component;
  return t ? Fi(t.subTree) : null;
}
const Li = (e) => e.__isSuspense;
function Ir(e, t) {
  t && t.pendingBranch ? L(e) ? t.effects.push(...e) : t.effects.push(e) : Dl(e);
}
const re = /* @__PURE__ */ Symbol.for("v-fgt"), ls = /* @__PURE__ */ Symbol.for("v-txt"), qe = /* @__PURE__ */ Symbol.for("v-cmt"), _s = /* @__PURE__ */ Symbol.for("v-stc"), It = [];
let _e = null;
function te(e = !1) {
  It.push(_e = e ? null : []);
}
function Pr() {
  It.pop(), _e = It[It.length - 1] || null;
}
let Ot = 1;
function mn(e, t = !1) {
  Ot += e, e < 0 && _e && t && (_e.hasOnce = !0);
}
function Di(e) {
  return e.dynamicChildren = Ot > 0 ? _e || ct : null, Pr(), Ot > 0 && _e && _e.push(e), e;
}
function ne(e, t, s, n, i, l) {
  return Di(
    h(
      e,
      t,
      s,
      n,
      i,
      l,
      !0
    )
  );
}
function Er(e, t, s, n, i) {
  return Di(
    We(
      e,
      t,
      s,
      n,
      i,
      !0
    )
  );
}
function Hi(e) {
  return e ? e.__v_isVNode === !0 : !1;
}
function yt(e, t) {
  return e.type === t.type && e.key === t.key;
}
const ji = ({ key: e }) => e ?? null, Vt = ({
  ref: e,
  ref_key: t,
  ref_for: s
}) => (typeof e == "number" && (e = "" + e), e != null ? ee(e) || /* @__PURE__ */ ce(e) || D(e) ? { i: Fe, r: e, k: t, f: !!s } : e : null);
function h(e, t = null, s = null, n = 0, i = null, l = e === re ? 0 : 1, r = !1, o = !1) {
  const f = {
    __v_isVNode: !0,
    __v_skip: !0,
    type: e,
    props: t,
    key: t && ji(t),
    ref: t && Vt(t),
    scopeId: ui,
    slotScopeIds: null,
    children: s,
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
    shapeFlag: l,
    patchFlag: n,
    dynamicProps: i,
    dynamicChildren: null,
    appContext: null,
    ctx: Fe
  };
  return o ? (qs(f, s), l & 128 && e.normalize(f)) : s && (f.shapeFlag |= ee(s) ? 8 : 16), Ot > 0 && // avoid a block node from tracking itself
  !r && // has current parent block
  _e && // presence of a patch flag indicates this node needs patching on updates.
  // component nodes also should always be patched, because even if the
  // component doesn't need to update, it needs to persist the instance on to
  // the next vnode so that it can be properly unmounted later.
  (f.patchFlag > 0 || l & 6) && // the EVENTS flag is only for hydration and if it is the only flag, the
  // vnode should not be considered dynamic due to handler caching.
  f.patchFlag !== 32 && _e.push(f), f;
}
const We = Ar;
function Ar(e, t = null, s = null, n = 0, i = null, l = !1) {
  if ((!e || e === tr) && (e = qe), Hi(e)) {
    const o = pt(
      e,
      t,
      !0
      /* mergeRef: true */
    );
    return s && qs(o, s), Ot > 0 && !l && _e && (o.shapeFlag & 6 ? _e[_e.indexOf(e)] = o : _e.push(o)), o.patchFlag = -2, o;
  }
  if (Wr(e) && (e = e.__vccOpts), t) {
    t = Or(t);
    let { class: o, style: f } = t;
    o && !ee(o) && (t.class = be(o)), K(f) && (/* @__PURE__ */ Vs(f) && !L(f) && (f = fe({}, f)), t.style = Ls(f));
  }
  const r = ee(e) ? 1 : Li(e) ? 128 : Kl(e) ? 64 : K(e) ? 4 : D(e) ? 2 : 0;
  return h(
    e,
    t,
    s,
    n,
    i,
    r,
    l,
    !0
  );
}
function Or(e) {
  return e ? /* @__PURE__ */ Vs(e) || Ti(e) ? fe({}, e) : e : null;
}
function pt(e, t, s = !1, n = !1) {
  const { props: i, ref: l, patchFlag: r, children: o, transition: f } = e, d = t ? Rr(i || {}, t) : i, a = {
    __v_isVNode: !0,
    __v_skip: !0,
    type: e.type,
    props: d,
    key: d && ji(d),
    ref: t && t.ref ? (
      // #2078 in the case of <component :is="vnode" ref="extra"/>
      // if the vnode itself already has a ref, cloneVNode will need to merge
      // the refs so the single vnode can be set on multiple refs
      s && l ? L(l) ? l.concat(Vt(t)) : [l, Vt(t)] : Vt(t)
    ) : l,
    scopeId: e.scopeId,
    slotScopeIds: e.slotScopeIds,
    children: o,
    target: e.target,
    targetStart: e.targetStart,
    targetAnchor: e.targetAnchor,
    staticCount: e.staticCount,
    shapeFlag: e.shapeFlag,
    // if the vnode is cloned with extra props, we can no longer assume its
    // existing patch flag to be reliable and need to add the FULL_PROPS flag.
    // note: preserve flag for fragments since they use the flag for children
    // fast paths only.
    patchFlag: t && e.type !== re ? r === -1 ? 16 : r | 16 : r,
    dynamicProps: e.dynamicProps,
    dynamicChildren: e.dynamicChildren,
    appContext: e.appContext,
    dirs: e.dirs,
    transition: f,
    // These should technically only be non-null on mounted VNodes. However,
    // they *should* be copied for kept-alive vnodes. So we just always copy
    // them since them being non-null during a mount doesn't affect the logic as
    // they will simply be overwritten.
    component: e.component,
    suspense: e.suspense,
    ssContent: e.ssContent && pt(e.ssContent),
    ssFallback: e.ssFallback && pt(e.ssFallback),
    placeholder: e.placeholder,
    el: e.el,
    anchor: e.anchor,
    ctx: e.ctx,
    ce: e.ce
  };
  return f && n && Gs(
    a,
    f.clone(a)
  ), a;
}
function Mr(e = " ", t = 0) {
  return We(ls, null, e, t);
}
function bn(e = "", t = !1) {
  return t ? (te(), Er(qe, null, e)) : We(qe, null, e);
}
function Me(e) {
  return e == null || typeof e == "boolean" ? We(qe) : L(e) ? We(
    re,
    null,
    // #3666, avoid reference pollution when reusing vnode
    e.slice()
  ) : Hi(e) ? $e(e) : We(ls, null, String(e));
}
function $e(e) {
  return e.el === null && e.patchFlag !== -1 || e.memo ? e : pt(e);
}
function qs(e, t) {
  let s = 0;
  const { shapeFlag: n } = e;
  if (t == null)
    t = null;
  else if (L(t))
    s = 16;
  else if (typeof t == "object")
    if (n & 65) {
      const i = t.default;
      i && (i._c && (i._d = !1), qs(e, i()), i._c && (i._d = !0));
      return;
    } else {
      s = 32;
      const i = t._;
      !i && !Ti(t) ? t._ctx = Fe : i === 3 && Fe && (Fe.slots._ === 1 ? t._ = 1 : (t._ = 2, e.patchFlag |= 1024));
    }
  else D(t) ? (t = { default: t, _ctx: Fe }, s = 32) : (t = String(t), n & 64 ? (s = 16, t = [Mr(t)]) : s = 8);
  e.children = t, e.shapeFlag |= s;
}
function Rr(...e) {
  const t = {};
  for (let s = 0; s < e.length; s++) {
    const n = e[s];
    for (const i in n)
      if (i === "class")
        t.class !== n.class && (t.class = be([t.class, n.class]));
      else if (i === "style")
        t.style = Ls([t.style, n.style]);
      else if (Yt(i)) {
        const l = t[i], r = n[i];
        r && l !== r && !(L(l) && l.includes(r)) ? t[i] = l ? [].concat(l, r) : r : r == null && l == null && // mergeProps({ 'onUpdate:modelValue': undefined }) should not retain
        // the model listener.
        !Qt(i) && (t[i] = r);
      } else i !== "" && (t[i] = n[i]);
  }
  return t;
}
function Ee(e, t, s, n = null) {
  He(e, t, 7, [
    s,
    n
  ]);
}
const Fr = xi();
let Lr = 0;
function Dr(e, t, s) {
  const n = e.type, i = (t ? t.appContext : e.appContext) || Fr, l = {
    uid: Lr++,
    vnode: e,
    type: n,
    parent: t,
    appContext: i,
    root: null,
    // to be immediately set
    next: null,
    subTree: null,
    // will be set synchronously right after creation
    effect: null,
    update: null,
    // will be set synchronously right after creation
    job: null,
    scope: new sl(
      !0
      /* detached */
    ),
    render: null,
    proxy: null,
    exposed: null,
    exposeProxy: null,
    withProxy: null,
    provides: t ? t.provides : Object.create(i.provides),
    ids: t ? t.ids : ["", 0, 0],
    accessCache: null,
    renderCache: [],
    // local resolved assets
    components: null,
    directives: null,
    // resolved props and emits options
    propsOptions: Pi(n, i),
    emitsOptions: Si(n, i),
    // emit
    emit: null,
    // to be set immediately
    emitted: null,
    // props default value
    propsDefaults: q,
    // inheritAttrs
    inheritAttrs: n.inheritAttrs,
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
    suspense: s,
    suspenseId: s ? s.pendingId : 0,
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
  return l.ctx = { _: l }, l.root = t ? t.root : l, l.emit = ar.bind(null, l), e.ce && e.ce(l), l;
}
let pe = null;
const Hr = () => pe || Fe;
let Jt, Es;
{
  const e = es(), t = (s, n) => {
    let i;
    return (i = e[s]) || (i = e[s] = []), i.push(n), (l) => {
      i.length > 1 ? i.forEach((r) => r(l)) : i[0](l);
    };
  };
  Jt = t(
    "__VUE_INSTANCE_SETTERS__",
    (s) => pe = s
  ), Es = t(
    "__VUE_SSR_SETTERS__",
    (s) => Mt = s
  );
}
const Lt = (e) => {
  const t = pe;
  return Jt(e), e.scope.on(), () => {
    e.scope.off(), Jt(t);
  };
}, xn = () => {
  pe && pe.scope.off(), Jt(null);
};
function Ni(e) {
  return e.vnode.shapeFlag & 4;
}
let Mt = !1;
function jr(e, t = !1, s = !1) {
  t && Es(t);
  const { props: n, children: i } = e.vnode, l = Ni(e);
  _r(e, n, l, t), xr(e, i, s || t);
  const r = l ? Nr(e, t) : void 0;
  return t && Es(!1), r;
}
function Nr(e, t) {
  const s = e.type;
  e.accessCache = /* @__PURE__ */ Object.create(null), e.proxy = new Proxy(e.ctx, sr);
  const { setup: n } = s;
  if (n) {
    Ke();
    const i = e.setupContext = n.length > 1 ? Ur(e) : null, l = Lt(e), r = Ft(
      n,
      e,
      0,
      [
        e.props,
        i
      ]
    ), o = Hn(r);
    if (Ve(), l(), (o || e.sp) && !kt(e) && pi(e), o) {
      if (r.then(xn, xn), t)
        return r.then((f) => {
          Sn(e, f);
        }).catch((f) => {
          ss(f, e, 0);
        });
      e.asyncDep = r;
    } else
      Sn(e, r);
  } else
    $i(e);
}
function Sn(e, t, s) {
  D(t) ? e.type.__ssrInlineRender ? e.ssrRender = t : e.render = t : K(t) && (e.setupState = li(t)), $i(e);
}
function $i(e, t, s) {
  const n = e.type;
  e.render || (e.render = n.render || Le);
  {
    const i = Lt(e);
    Ke();
    try {
      nr(e);
    } finally {
      Ve(), i();
    }
  }
}
const $r = {
  get(e, t) {
    return oe(e, "get", ""), e[t];
  }
};
function Ur(e) {
  const t = (s) => {
    e.exposed = s || {};
  };
  return {
    attrs: new Proxy(e.attrs, $r),
    slots: e.slots,
    emit: e.emit,
    expose: t
  };
}
function Js(e) {
  return e.exposed ? e.exposeProxy || (e.exposeProxy = new Proxy(li(wl(e.exposed)), {
    get(t, s) {
      if (s in t)
        return t[s];
      if (s in Tt)
        return Tt[s](e);
    },
    has(t, s) {
      return s in t || s in Tt;
    }
  })) : e.proxy;
}
function Wr(e) {
  return D(e) && "__vccOpts" in e;
}
const tt = (e, t) => /* @__PURE__ */ Al(e, t, Mt), Kr = "3.5.34";
let As;
const wn = typeof window < "u" && window.trustedTypes;
if (wn)
  try {
    As = /* @__PURE__ */ wn.createPolicy("vue", {
      createHTML: (e) => e
    });
  } catch {
  }
const Ui = As ? (e) => As.createHTML(e) : (e) => e, Vr = "http://www.w3.org/2000/svg", Br = "http://www.w3.org/1998/Math/MathML", Ne = typeof document < "u" ? document : null, Cn = Ne && /* @__PURE__ */ Ne.createElement("template"), Gr = {
  insert: (e, t, s) => {
    t.insertBefore(e, s || null);
  },
  remove: (e) => {
    const t = e.parentNode;
    t && t.removeChild(e);
  },
  createElement: (e, t, s, n) => {
    const i = t === "svg" ? Ne.createElementNS(Vr, e) : t === "mathml" ? Ne.createElementNS(Br, e) : s ? Ne.createElement(e, { is: s }) : Ne.createElement(e);
    return e === "select" && n && n.multiple != null && i.setAttribute("multiple", n.multiple), i;
  },
  createText: (e) => Ne.createTextNode(e),
  createComment: (e) => Ne.createComment(e),
  setText: (e, t) => {
    e.nodeValue = t;
  },
  setElementText: (e, t) => {
    e.textContent = t;
  },
  parentNode: (e) => e.parentNode,
  nextSibling: (e) => e.nextSibling,
  querySelector: (e) => Ne.querySelector(e),
  setScopeId(e, t) {
    e.setAttribute(t, "");
  },
  // __UNSAFE__
  // Reason: innerHTML.
  // Static content here can only come from compiled templates.
  // As long as the user only uses trusted templates, this is safe.
  insertStaticContent(e, t, s, n, i, l) {
    const r = s ? s.previousSibling : t.lastChild;
    if (i && (i === l || i.nextSibling))
      for (; t.insertBefore(i.cloneNode(!0), s), !(i === l || !(i = i.nextSibling)); )
        ;
    else {
      Cn.innerHTML = Ui(
        n === "svg" ? `<svg>${e}</svg>` : n === "mathml" ? `<math>${e}</math>` : e
      );
      const o = Cn.content;
      if (n === "svg" || n === "mathml") {
        const f = o.firstChild;
        for (; f.firstChild; )
          o.appendChild(f.firstChild);
        o.removeChild(f);
      }
      t.insertBefore(o, s);
    }
    return [
      // first
      r ? r.nextSibling : t.firstChild,
      // last
      s ? s.previousSibling : t.lastChild
    ];
  }
}, zr = /* @__PURE__ */ Symbol("_vtc");
function Zr(e, t, s) {
  const n = e[zr];
  n && (t = (t ? [t, ...n] : [...n]).join(" ")), t == null ? e.removeAttribute("class") : s ? e.setAttribute("class", t) : e.className = t;
}
const kn = /* @__PURE__ */ Symbol("_vod"), qr = /* @__PURE__ */ Symbol("_vsh"), Jr = /* @__PURE__ */ Symbol(""), Yr = /(?:^|;)\s*display\s*:/;
function Qr(e, t, s) {
  const n = e.style, i = ee(s);
  let l = !1;
  if (s && !i) {
    if (t)
      if (ee(t))
        for (const r of t.split(";")) {
          const o = r.slice(0, r.indexOf(":")).trim();
          s[o] == null && bt(n, o, "");
        }
      else
        for (const r in t)
          s[r] == null && bt(n, r, "");
    for (const r in s) {
      r === "display" && (l = !0);
      const o = s[r];
      o != null ? eo(
        e,
        r,
        !ee(t) && t ? t[r] : void 0,
        o
      ) || bt(n, r, o) : bt(n, r, "");
    }
  } else if (i) {
    if (t !== s) {
      const r = n[Jr];
      r && (s += ";" + r), n.cssText = s, l = Yr.test(s);
    }
  } else t && e.removeAttribute("style");
  kn in e && (e[kn] = l ? n.display : "", e[qr] && (n.display = "none"));
}
const Tn = /\s*!important$/;
function bt(e, t, s) {
  if (L(s))
    s.forEach((n) => bt(e, t, n));
  else if (s == null && (s = ""), t.startsWith("--"))
    e.setProperty(t, s);
  else {
    const n = Xr(e, t);
    Tn.test(s) ? e.setProperty(
      it(n),
      s.replace(Tn, ""),
      "important"
    ) : e[n] = s;
  }
}
const In = ["Webkit", "Moz", "ms"], ys = {};
function Xr(e, t) {
  const s = ys[t];
  if (s)
    return s;
  let n = xe(t);
  if (n !== "filter" && n in e)
    return ys[t] = n;
  n = $n(n);
  for (let i = 0; i < In.length; i++) {
    const l = In[i] + n;
    if (l in e)
      return ys[t] = l;
  }
  return t;
}
function eo(e, t, s, n) {
  return e.tagName === "TEXTAREA" && (t === "width" || t === "height") && ee(n) && s === n;
}
const Pn = "http://www.w3.org/1999/xlink";
function En(e, t, s, n, i, l = el(t)) {
  n && t.startsWith("xlink:") ? s == null ? e.removeAttributeNS(Pn, t.slice(6, t.length)) : e.setAttributeNS(Pn, t, s) : s == null || l && !Wn(s) ? e.removeAttribute(t) : e.setAttribute(
    t,
    l ? "" : De(s) ? String(s) : s
  );
}
function An(e, t, s, n, i) {
  if (t === "innerHTML" || t === "textContent") {
    s != null && (e[t] = t === "innerHTML" ? Ui(s) : s);
    return;
  }
  const l = e.tagName;
  if (t === "value" && l !== "PROGRESS" && // custom elements may use _value internally
  !l.includes("-")) {
    const o = l === "OPTION" ? e.getAttribute("value") || "" : e.value, f = s == null ? (
      // #11647: value should be set as empty string for null and undefined,
      // but <input type="checkbox"> should be set as 'on'.
      e.type === "checkbox" ? "on" : ""
    ) : String(s);
    (o !== f || !("_value" in e)) && (e.value = f), s == null && e.removeAttribute(t), e._value = s;
    return;
  }
  let r = !1;
  if (s === "" || s == null) {
    const o = typeof e[t];
    o === "boolean" ? s = Wn(s) : s == null && o === "string" ? (s = "", r = !0) : o === "number" && (s = 0, r = !0);
  }
  try {
    e[t] = s;
  } catch {
  }
  r && e.removeAttribute(i || t);
}
function to(e, t, s, n) {
  e.addEventListener(t, s, n);
}
function so(e, t, s, n) {
  e.removeEventListener(t, s, n);
}
const On = /* @__PURE__ */ Symbol("_vei");
function no(e, t, s, n, i = null) {
  const l = e[On] || (e[On] = {}), r = l[t];
  if (n && r)
    r.value = n;
  else {
    const [o, f] = io(t);
    if (n) {
      const d = l[t] = oo(
        n,
        i
      );
      to(e, o, d, f);
    } else r && (so(e, o, r, f), l[t] = void 0);
  }
}
const Mn = /(?:Once|Passive|Capture)$/;
function io(e) {
  let t;
  if (Mn.test(e)) {
    t = {};
    let n;
    for (; n = e.match(Mn); )
      e = e.slice(0, e.length - n[0].length), t[n[0].toLowerCase()] = !0;
  }
  return [e[2] === ":" ? e.slice(3) : it(e.slice(2)), t];
}
let ms = 0;
const lo = /* @__PURE__ */ Promise.resolve(), ro = () => ms || (lo.then(() => ms = 0), ms = Date.now());
function oo(e, t) {
  const s = (n) => {
    if (!n._vts)
      n._vts = Date.now();
    else if (n._vts <= s.attached)
      return;
    He(
      co(n, s.value),
      t,
      5,
      [n]
    );
  };
  return s.value = e, s.attached = ro(), s;
}
function co(e, t) {
  if (L(t)) {
    const s = e.stopImmediatePropagation;
    return e.stopImmediatePropagation = () => {
      s.call(e), e._stopped = !0;
    }, t.map(
      (n) => (i) => !i._stopped && n && n(i)
    );
  } else
    return t;
}
const Rn = (e) => e.charCodeAt(0) === 111 && e.charCodeAt(1) === 110 && // lowercase letter
e.charCodeAt(2) > 96 && e.charCodeAt(2) < 123, fo = (e, t, s, n, i, l) => {
  const r = i === "svg";
  t === "class" ? Zr(e, n, r) : t === "style" ? Qr(e, s, n) : Yt(t) ? Qt(t) || no(e, t, s, n, l) : (t[0] === "." ? (t = t.slice(1), !0) : t[0] === "^" ? (t = t.slice(1), !1) : uo(e, t, n, r)) ? (An(e, t, n), !e.tagName.includes("-") && (t === "value" || t === "checked" || t === "selected") && En(e, t, n, r, l, t !== "value")) : /* #11081 force set props for possible async custom element */ e._isVueCE && // #12408 check if it's declared prop or it's async custom element
  (ao(e, t) || // @ts-expect-error _def is private
  e._def.__asyncLoader && (/[A-Z]/.test(t) || !ee(n))) ? An(e, xe(t), n, l, t) : (t === "true-value" ? e._trueValue = n : t === "false-value" && (e._falseValue = n), En(e, t, n, r));
};
function uo(e, t, s, n) {
  if (n)
    return !!(t === "innerHTML" || t === "textContent" || t in e && Rn(t) && D(s));
  if (t === "spellcheck" || t === "draggable" || t === "translate" || t === "autocorrect" || t === "sandbox" && e.tagName === "IFRAME" || t === "form" || t === "list" && e.tagName === "INPUT" || t === "type" && e.tagName === "TEXTAREA")
    return !1;
  if (t === "width" || t === "height") {
    const i = e.tagName;
    if (i === "IMG" || i === "VIDEO" || i === "CANVAS" || i === "SOURCE")
      return !1;
  }
  return Rn(t) && ee(s) ? !1 : t in e;
}
function ao(e, t) {
  const s = (
    // @ts-expect-error _def is private
    e._def.props
  );
  if (!s)
    return !1;
  const n = xe(t);
  return Array.isArray(s) ? s.some((i) => xe(i) === n) : Object.keys(s).some((i) => xe(i) === n);
}
const po = /* @__PURE__ */ fe({ patchProp: fo }, Gr);
let Fn;
function ho() {
  return Fn || (Fn = wr(po));
}
const go = ((...e) => {
  const t = ho().createApp(...e), { mount: s } = t;
  return t.mount = (n) => {
    const i = _o(n);
    if (!i) return;
    const l = t._component;
    !D(l) && !l.render && !l.template && (l.template = i.innerHTML), i.nodeType === 1 && (i.textContent = "");
    const r = s(i, !1, vo(i));
    return i instanceof Element && (i.removeAttribute("v-cloak"), i.setAttribute("data-v-app", "")), r;
  }, t;
});
function vo(e) {
  if (e instanceof SVGElement)
    return "svg";
  if (typeof MathMLElement == "function" && e instanceof MathMLElement)
    return "mathml";
}
function _o(e) {
  return ee(e) ? document.querySelector(e) : e;
}
function ge() {
  return typeof window < "u" && window.openxnetApp || null;
}
function yo(e) {
  if (e && typeof e.isCurrentLanguageZh == "function")
    try {
      return !!e.isCurrentLanguageZh();
    } catch {
      return !0;
    }
  return String(e?.currentLanguage || navigator.language || "zh-CN").toLowerCase().startsWith("zh");
}
function mo(e) {
  return Array.isArray(e?.computedSkillsList) ? e.computedSkillsList : [];
}
function bo(e, t) {
  return (e && typeof e.getPrototypeFilteredSkillsList == "function" ? e.getPrototypeFilteredSkillsList() : mo(e)).map((n) => ({
    id: String(n?.id || ""),
    name: String(n?.displayName || n?.name || n?.id || ""),
    alias: String(n?.displayAlias || n?.id || ""),
    description: String(n?.displayDescription || n?.description || ""),
    version: String(n?.version || "1.0.0"),
    isGlobal: !!n?.isGlobal,
    isProject: !!n?.isProject,
    installed: !!(n?.isGlobal || n?.isProject),
    tags: Array.isArray(n?.tags) && n.tags.length ? n.tags : [t ? "技能" : "Skill"],
    previewSummary: String(n?.previewSummary || n?.displayDescription || n?.description || ""),
    previewHighlights: Array.isArray(n?.previewHighlights) ? n.previewHighlights : []
  }));
}
function xo(e, t, s) {
  const n = String(e?.activeSkillPreviewId || "").trim(), i = s.find((l) => l.id === n) || s[0] || null;
  return {
    activeId: n,
    current: i,
    renderedContent: String(e?.renderedSkillContent || ""),
    loading: !!e?.skillPreviewLoading,
    emptyText: t ? "选择技能后，这里会显示说明和预览。" : "Select a skill to see its preview here."
  };
}
function So(e, t) {
  return {
    githubUrl: String(e?.newSkillUrl || ""),
    isInstalling: !!e?.isSkillInstalling,
    isUploading: !!e?.isUploading,
    workspacePath: String(e?.CLISettings?.cc_path || ""),
    cards: [
      {
        id: "github",
        title: t ? "GitHub 仓库" : "GitHub Repository",
        description: t ? "从 GitHub 仓库直接安装技能。" : "Install a skill directly from a GitHub repository.",
        icon: "fa-brands fa-github"
      },
      {
        id: "zip",
        title: t ? "ZIP 技能包" : "ZIP Skill Package",
        description: t ? "上传 ZIP 技能包到全局技能目录。" : "Upload a ZIP skill package into the global skills directory.",
        icon: "fa-solid fa-file-zipper"
      }
    ]
  };
}
function wo(e, t) {
  const s = e?.skillCrystalDraft || {}, n = e?.skillLifecycleSummary || {}, i = Array.isArray(e?.skillLifecycleItems) ? e.skillLifecycleItems : [];
  return {
    draft: {
      source: String(s.source || "work"),
      name: String(s.name || ""),
      id: String(s.id || ""),
      description: String(s.description || ""),
      trigger: String(s.trigger || ""),
      workflow: String(s.workflow || ""),
      notes: String(s.notes || ""),
      syncToWorkspace: !!s.syncToWorkspace
    },
    preview: String(e?.skillCrystalPreview || ""),
    isCrystallizing: !!e?.isSkillCrystallizing,
    lifecycle: {
      loading: !!e?.skillLifecycleLoading,
      running: !!e?.skillLifecycleRunning,
      counts: n?.counts || {},
      items: i.slice(0, 8)
    },
    sourceOptions: e && typeof e.getSkillCrystalSourceOptions == "function" ? e.getSkillCrystalSourceOptions() : [],
    lifecycleStates: e && typeof e.getSkillLifecycleStates == "function" ? e.getSkillLifecycleStates() : [],
    workspacePath: String(e?.CLISettings?.cc_path || ""),
    isZh: t
  };
}
function Co() {
  const e = ge(), t = yo(e), s = String(e?.activeSkillCenterTab || e?.subMenu || "library"), n = bo(e, t);
  return {
    isZh: t,
    activeMenu: String(e?.activeMenu || ""),
    activeTab: s,
    filter: String(e?.skillsLibraryFilter || "all"),
    query: String(e?.skillsLibraryQuery || ""),
    tabs: [
      { id: "library", label: e?.t?.("skillLibrary") || (t ? "技能库" : "Library"), icon: "fa-solid fa-book-open-reader" },
      { id: "transform", label: e?.t?.("skillTransform") || (t ? "技能转化" : "Transform"), icon: "fa-solid fa-shuffle" },
      { id: "crystal", label: e?.t?.("skillCrystal") || (t ? "技能结晶" : "Crystal"), icon: "fa-solid fa-gem" }
    ],
    library: {
      items: n,
      preview: xo(e, t, n),
      workspacePath: String(e?.CLISettings?.cc_path || ""),
      loading: !!e?.skillsLoading
    },
    transform: So(e, t),
    crystal: wo(e, t)
  };
}
async function ko(e) {
  const t = ge();
  !t || typeof t.openSkillCenter != "function" || t.openSkillCenter(e);
}
async function To(e) {
  const t = ge();
  t && (t.skillsLibraryFilter = e);
}
async function Io(e) {
  const t = ge();
  t && (t.skillsLibraryQuery = e);
}
async function Po(e) {
  const t = ge();
  !t || typeof t.previewSkill != "function" || await t.previewSkill(e);
}
async function Eo() {
  const e = ge();
  !e || typeof e.handleRefreshSkills != "function" || await e.handleRefreshSkills();
}
async function Ao() {
  const e = ge();
  !e || typeof e.openSkillsFolder != "function" || await e.openSkillsFolder();
}
async function Oo(e) {
  const t = ge();
  t && (t.newSkillUrl = e);
}
async function Mo() {
  const e = ge();
  !e || typeof e.installSkillFromGithub != "function" || await e.installSkillFromGithub();
}
async function Ro(e) {
  const t = ge();
  !t || typeof t.processSkillUpload != "function" || await t.processSkillUpload(e);
}
async function Fo(e, t) {
  const s = ge();
  if (!(!s || !s.skillCrystalDraft)) {
    if (s.skillCrystalDraft[e] = t, e === "name" && typeof s.refreshSkillCrystalName == "function") {
      s.refreshSkillCrystalName();
      return;
    }
    if (e === "id" && typeof s.handleSkillCrystalIdInput == "function") {
      s.handleSkillCrystalIdInput();
      return;
    }
    typeof s.refreshSkillCrystalPreview == "function" && s.refreshSkillCrystalPreview();
  }
}
async function Lo() {
  const e = ge();
  !e || typeof e.seedSkillCrystalExample != "function" || e.seedSkillCrystalExample();
}
async function Do() {
  const e = ge();
  !e || typeof e.crystallizeSkill != "function" || await e.crystallizeSkill();
}
async function Ho() {
  const e = ge();
  !e || typeof e.runSkillLifecycleSleepCycle != "function" || await e.runSkillLifecycleSleepCycle();
}
function jo() {
  return {
    snapshot: Co,
    openTab: ko,
    setLibraryFilter: To,
    setLibraryQuery: Io,
    previewSkill: Po,
    refreshSkills: Eo,
    openSkillsFolder: Ao,
    setGithubUrl: Oo,
    installFromGithub: Mo,
    uploadSkillZip: Ro,
    setCrystalField: Fo,
    seedCrystalExample: Lo,
    crystallizeSkill: Do,
    runSleepCycle: Ho
  };
}
const No = { class: "ox-vite-skills-shell" }, $o = { class: "ox-vite-skills-header" }, Uo = { class: "ox-vite-skills-header__actions" }, Wo = { class: "ox-vite-skills-tabs" }, Ko = ["onClick"], Vo = { class: "ox-vite-skills-library-toolbar" }, Bo = { class: "ox-vite-skills-filter-pills" }, Go = { class: "ox-vite-skills-search" }, zo = ["value", "placeholder"], Zo = { class: "ox-vite-skills-library-layout" }, qo = { class: "ox-vite-skills-grid" }, Jo = { class: "ox-vite-skills-card__head" }, Yo = { class: "ox-vite-skills-card__copy" }, Qo = { class: "ox-vite-skills-card__name" }, Xo = { class: "ox-vite-skills-card__alias" }, ec = { class: "ox-vite-skills-card__version" }, tc = { class: "ox-vite-skills-card__desc" }, sc = { class: "ox-vite-skills-chip-wrap" }, nc = { class: "ox-vite-skills-card__footer" }, ic = ["onClick"], lc = { class: "ox-vite-skills-preview" }, rc = {
  key: 0,
  class: "ox-vite-skills-preview__head"
}, oc = {
  key: 1,
  class: "ox-vite-skills-chip-wrap"
}, cc = ["innerHTML"], fc = {
  key: 3,
  class: "ox-vite-skills-preview__empty"
}, uc = {
  key: 1,
  class: "ox-vite-skills-transform-grid"
}, ac = { class: "ox-vite-skills-transform-card" }, dc = { class: "ox-vite-skills-transform-card__head" }, pc = { class: "ox-vite-skills-field" }, hc = ["value"], gc = { class: "ox-vite-skills-transform-actions" }, vc = { class: "ox-vite-skills-transform-card" }, _c = { class: "ox-vite-skills-transform-card__head" }, yc = { class: "ox-vite-skills-upload-zone" }, mc = {
  key: 2,
  class: "ox-vite-skills-crystal-layout"
}, bc = { class: "ox-vite-skills-crystal-main" }, xc = { class: "ox-vite-skills-crystal-head" }, Sc = { class: "ox-vite-skills-crystal-actions" }, wc = { class: "ox-vite-skills-crystal-stats" }, Cc = { class: "ox-vite-skills-crystal-form" }, kc = { class: "ox-vite-skills-field" }, Tc = ["value"], Ic = ["value"], Pc = { class: "ox-vite-skills-field" }, Ec = ["value"], Ac = { class: "ox-vite-skills-field" }, Oc = ["value"], Mc = { class: "ox-vite-skills-field ox-vite-skills-field--full" }, Rc = ["value"], Fc = { class: "ox-vite-skills-field ox-vite-skills-field--full" }, Lc = ["value"], Dc = { class: "ox-vite-skills-field ox-vite-skills-field--full" }, Hc = ["value"], jc = { class: "ox-vite-skills-field ox-vite-skills-field--full" }, Nc = ["value"], $c = { class: "ox-vite-skills-checkbox" }, Uc = ["checked"], Wc = { class: "ox-vite-skills-transform-actions" }, Kc = { class: "ox-vite-skills-crystal-preview" }, Vc = { class: "ox-vite-skills-crystal-preview__content markdown-body" }, Bc = {
  __name: "App",
  setup(e) {
    const t = jo(), s = /* @__PURE__ */ Cl(t.snapshot());
    let n = null;
    function i() {
      s.value = t.snapshot();
    }
    function l(J) {
      t.openTab(J), i();
    }
    function r(J) {
      t.setLibraryFilter(J), i();
    }
    function o(J) {
      t.setLibraryQuery(J.target.value), i();
    }
    function f(J) {
      t.previewSkill(J), i();
    }
    function d() {
      t.refreshSkills(), i();
    }
    function a() {
      t.openSkillsFolder();
    }
    function g(J) {
      t.setGithubUrl(J.target.value), i();
    }
    function T() {
      t.installFromGithub(), i();
    }
    function P(J) {
      const C = J.target.files;
      C && C.length > 0 && t.uploadSkillZip(C[0]), J.target.value = "";
    }
    function H(J, C) {
      const I = C.target.type === "checkbox" ? C.target.checked : C.target.value;
      t.setCrystalField(J, I), i();
    }
    function R() {
      t.seedCrystalExample(), i();
    }
    function X() {
      t.crystallizeSkill(), i();
    }
    function B() {
      t.runSleepCycle(), i();
    }
    const k = tt(() => s.value.isZh), W = tt(() => s.value.activeTab || "library"), O = tt(() => s.value.tabs || []), N = tt(() => s.value.library || { items: [], preview: {} }), ye = tt(() => s.value.transform || { cards: [] }), Y = tt(() => s.value.crystal || { draft: {}, lifecycle: {} });
    return vi(() => {
      i(), n = window.setInterval(i, 400);
    }), _i(() => {
      n && (window.clearInterval(n), n = null);
    }), (J, C) => (te(), ne("div", No, [
      h("div", $o, [
        h("div", null, [
          h("h1", null, F(k.value ? "技能中心" : "Skills Center"), 1),
          h("p", null, F(k.value ? "技能仓库、技能转化和技能结晶的统一入口。" : "One place for the skill library, transformations, and crystallization."), 1)
        ]),
        h("div", Uo, [
          h("button", {
            type: "button",
            class: "ox-vite-skills-primary-btn",
            onClick: a
          }, [
            C[12] || (C[12] = h("i", { class: "fa-regular fa-folder-open" }, null, -1)),
            h("span", null, F(k.value ? "打开技能目录" : "Open skills folder"), 1)
          ]),
          h("button", {
            type: "button",
            class: "ox-vite-skills-secondary-btn",
            onClick: d
          }, [
            C[13] || (C[13] = h("i", { class: "fa-solid fa-rotate-right" }, null, -1)),
            h("span", null, F(k.value ? "刷新技能" : "Refresh skills"), 1)
          ])
        ])
      ]),
      h("div", Wo, [
        (te(!0), ne(re, null, rt(O.value, (I) => (te(), ne("button", {
          key: I.id,
          type: "button",
          class: be(["ox-vite-skills-tab", { active: W.value === I.id }]),
          onClick: (Ce) => l(I.id)
        }, [
          h("i", {
            class: be(I.icon)
          }, null, 2),
          h("span", null, F(I.label), 1)
        ], 10, Ko))), 128))
      ]),
      W.value === "library" ? (te(), ne(re, { key: 0 }, [
        h("div", Vo, [
          h("div", Bo, [
            h("button", {
              type: "button",
              class: be(["ox-vite-skills-filter-pill", { active: s.value.filter === "all" }]),
              onClick: C[0] || (C[0] = (I) => r("all"))
            }, F(k.value ? "全部" : "All"), 3),
            h("button", {
              type: "button",
              class: be(["ox-vite-skills-filter-pill", { active: s.value.filter === "featured" }]),
              onClick: C[1] || (C[1] = (I) => r("featured"))
            }, F(k.value ? "推荐" : "Featured"), 3),
            h("button", {
              type: "button",
              class: be(["ox-vite-skills-filter-pill", { active: s.value.filter === "installed" }]),
              onClick: C[2] || (C[2] = (I) => r("installed"))
            }, F(k.value ? "已安装" : "Installed"), 3),
            h("button", {
              type: "button",
              class: be(["ox-vite-skills-filter-pill", { active: s.value.filter === "custom" }]),
              onClick: C[3] || (C[3] = (I) => r("custom"))
            }, F(k.value ? "自定义" : "Custom"), 3)
          ]),
          h("label", Go, [
            C[14] || (C[14] = h("i", { class: "fa-solid fa-magnifying-glass" }, null, -1)),
            h("input", {
              value: s.value.query,
              type: "text",
              placeholder: k.value ? "搜索技能..." : "Search skills...",
              onInput: o
            }, null, 40, zo)
          ])
        ]),
        h("div", Zo, [
          h("section", qo, [
            (te(!0), ne(re, null, rt(N.value.items, (I) => (te(), ne("article", {
              key: I.id,
              class: "ox-vite-skills-card"
            }, [
              h("div", Jo, [
                C[15] || (C[15] = h("div", { class: "ox-vite-skills-card__icon" }, [
                  h("i", { class: "fa-solid fa-wand-magic-sparkles" })
                ], -1)),
                h("div", Yo, [
                  h("div", Qo, F(I.name), 1),
                  h("div", Xo, F(I.alias), 1)
                ]),
                h("span", ec, "v" + F(I.version), 1)
              ]),
              h("p", tc, F(I.description), 1),
              h("div", sc, [
                (te(!0), ne(re, null, rt(I.tags, (Ce) => (te(), ne("span", {
                  key: Ce,
                  class: "ox-vite-skills-chip"
                }, F(Ce), 1))), 128))
              ]),
              h("div", nc, [
                h("span", {
                  class: be(["ox-vite-skills-card__status", { installed: I.installed }])
                }, [
                  h("i", {
                    class: be(I.installed ? "fa-solid fa-circle-check" : "fa-regular fa-circle")
                  }, null, 2),
                  h("span", null, F(I.installed ? k.value ? "已安装" : "Installed" : k.value ? "未安装" : "Not installed"), 1)
                ], 2),
                h("button", {
                  type: "button",
                  class: "ox-vite-skills-secondary-btn",
                  onClick: (Ce) => f(I.id)
                }, [
                  C[16] || (C[16] = h("i", { class: "fa-solid fa-eye" }, null, -1)),
                  h("span", null, F(k.value ? "预览" : "Preview"), 1)
                ], 8, ic)
              ])
            ]))), 128))
          ]),
          h("aside", lc, [
            N.value.preview.current ? (te(), ne("div", rc, [
              C[17] || (C[17] = h("div", { class: "ox-vite-skills-preview__icon" }, [
                h("i", { class: "fa-solid fa-gem" })
              ], -1)),
              h("div", null, [
                h("h2", null, F(N.value.preview.current.name), 1),
                h("p", null, F(N.value.preview.current.previewSummary || N.value.preview.current.description), 1)
              ])
            ])) : bn("", !0),
            N.value.preview.current ? (te(), ne("div", oc, [
              (te(!0), ne(re, null, rt(N.value.preview.current.previewHighlights, (I) => (te(), ne("span", {
                key: I,
                class: "ox-vite-skills-chip"
              }, F(I), 1))), 128))
            ])) : bn("", !0),
            N.value.preview.renderedContent ? (te(), ne("div", {
              key: 2,
              class: "ox-vite-skills-preview__content markdown-body",
              innerHTML: N.value.preview.renderedContent
            }, null, 8, cc)) : (te(), ne("div", fc, F(N.value.preview.emptyText), 1))
          ])
        ])
      ], 64)) : W.value === "transform" ? (te(), ne("div", uc, [
        h("section", ac, [
          h("div", dc, [
            C[18] || (C[18] = h("i", { class: "fa-brands fa-github" }, null, -1)),
            h("div", null, [
              h("h2", null, F(k.value ? "GitHub 仓库" : "GitHub Repository"), 1),
              h("p", null, F(k.value ? "从 GitHub 仓库直接安装技能。" : "Install a skill directly from a GitHub repository."), 1)
            ])
          ]),
          h("label", pc, [
            C[19] || (C[19] = h("span", null, "GitHub URL", -1)),
            h("input", {
              value: ye.value.githubUrl,
              type: "text",
              placeholder: "https://github.com/owner/repo",
              onInput: g
            }, null, 40, hc)
          ]),
          h("div", gc, [
            h("button", {
              type: "button",
              class: "ox-vite-skills-primary-btn",
              onClick: T
            }, [
              C[20] || (C[20] = h("i", { class: "fa-solid fa-download" }, null, -1)),
              h("span", null, F(k.value ? "下载并安装" : "Download and install"), 1)
            ])
          ])
        ]),
        h("section", vc, [
          h("div", _c, [
            C[21] || (C[21] = h("i", { class: "fa-solid fa-file-zipper" }, null, -1)),
            h("div", null, [
              h("h2", null, F(k.value ? "ZIP 技能包" : "ZIP Skill Package"), 1),
              h("p", null, F(k.value ? "上传 ZIP 技能包到全局技能目录。" : "Upload a ZIP skill package into the global skills directory."), 1)
            ])
          ]),
          h("label", yc, [
            h("input", {
              type: "file",
              accept: ".zip",
              hidden: "",
              onChange: P
            }, null, 32),
            C[22] || (C[22] = h("i", { class: "fa-solid fa-cloud-arrow-up" }, null, -1)),
            h("span", null, F(k.value ? "点击选择 ZIP 技能包" : "Click to choose a ZIP skill package"), 1),
            h("small", null, F(ye.value.workspacePath ? ye.value.workspacePath : k.value ? "当前未选择工作区" : "No workspace selected"), 1)
          ])
        ])
      ])) : (te(), ne("div", mc, [
        h("section", bc, [
          h("div", xc, [
            h("div", null, [
              h("h2", null, F(k.value ? "技能结晶" : "Skill Crystal"), 1),
              h("p", null, F(k.value ? "把高成功率工作流结晶为标准化技能。" : "Crystallize high-signal workflows into standardized reusable skills."), 1)
            ]),
            h("div", Sc, [
              h("button", {
                type: "button",
                class: "ox-vite-skills-secondary-btn",
                onClick: R
              }, [
                C[23] || (C[23] = h("i", { class: "fa-solid fa-wand-magic-sparkles" }, null, -1)),
                h("span", null, F(k.value ? "填充示例" : "Seed example"), 1)
              ]),
              h("button", {
                type: "button",
                class: "ox-vite-skills-secondary-btn",
                onClick: B
              }, [
                C[24] || (C[24] = h("i", { class: "fa-solid fa-moon" }, null, -1)),
                h("span", null, F(k.value ? "运行睡眠周期" : "Run sleep cycle"), 1)
              ])
            ])
          ]),
          h("div", wc, [
            (te(!0), ne(re, null, rt(Y.value.lifecycleStates, (I) => (te(), ne("article", {
              key: I.value,
              class: "ox-vite-skills-crystal-stat"
            }, [
              h("span", null, F(I.label), 1),
              h("strong", null, F(Y.value.lifecycle.counts[I.value] || 0), 1)
            ]))), 128))
          ]),
          h("div", Cc, [
            h("label", kc, [
              h("span", null, F(k.value ? "来源" : "Source"), 1),
              h("select", {
                value: Y.value.draft.source,
                onChange: C[4] || (C[4] = (I) => H("source", I))
              }, [
                (te(!0), ne(re, null, rt(Y.value.sourceOptions, (I) => (te(), ne("option", {
                  key: I.value,
                  value: I.value
                }, F(I.label), 9, Ic))), 128))
              ], 40, Tc)
            ]),
            h("label", Pc, [
              h("span", null, F(k.value ? "技能名称" : "Skill Name"), 1),
              h("input", {
                value: Y.value.draft.name,
                type: "text",
                onInput: C[5] || (C[5] = (I) => H("name", I))
              }, null, 40, Ec)
            ]),
            h("label", Ac, [
              h("span", null, F(k.value ? "技能 ID" : "Skill ID"), 1),
              h("input", {
                value: Y.value.draft.id,
                type: "text",
                onInput: C[6] || (C[6] = (I) => H("id", I))
              }, null, 40, Oc)
            ]),
            h("label", Mc, [
              h("span", null, F(k.value ? "描述" : "Description"), 1),
              h("textarea", {
                value: Y.value.draft.description,
                rows: "3",
                onInput: C[7] || (C[7] = (I) => H("description", I))
              }, null, 40, Rc)
            ]),
            h("label", Fc, [
              h("span", null, F(k.value ? "触发场景" : "Trigger Context"), 1),
              h("textarea", {
                value: Y.value.draft.trigger,
                rows: "4",
                onInput: C[8] || (C[8] = (I) => H("trigger", I))
              }, null, 40, Lc)
            ]),
            h("label", Dc, [
              h("span", null, F(k.value ? "工作流步骤" : "Workflow"), 1),
              h("textarea", {
                value: Y.value.draft.workflow,
                rows: "4",
                onInput: C[9] || (C[9] = (I) => H("workflow", I))
              }, null, 40, Hc)
            ]),
            h("label", jc, [
              h("span", null, F(k.value ? "Guardrails / 备注" : "Guardrails / Notes"), 1),
              h("textarea", {
                value: Y.value.draft.notes,
                rows: "3",
                onInput: C[10] || (C[10] = (I) => H("notes", I))
              }, null, 40, Nc)
            ]),
            h("label", $c, [
              h("input", {
                checked: Y.value.draft.syncToWorkspace,
                type: "checkbox",
                onChange: C[11] || (C[11] = (I) => H("syncToWorkspace", I))
              }, null, 40, Uc),
              h("span", null, F(k.value ? "同步到当前工作区" : "Sync to current workspace"), 1)
            ])
          ]),
          h("div", Wc, [
            h("button", {
              type: "button",
              class: "ox-vite-skills-primary-btn",
              onClick: X
            }, [
              C[25] || (C[25] = h("i", { class: "fa-solid fa-gem" }, null, -1)),
              h("span", null, F(k.value ? "生成技能" : "Create skill"), 1)
            ])
          ])
        ]),
        h("aside", Kc, [
          C[26] || (C[26] = h("h3", null, "SKILL.md", -1)),
          h("div", Vc, [
            h("pre", null, F(Y.value.preview), 1)
          ])
        ])
      ]))
    ]));
  }
};
function Os() {
  const e = document.getElementById("openxnet-vite-skills-root");
  !e || e.dataset.viteMounted === "true" || (go(Bc).mount(e), e.dataset.viteMounted = "true");
}
document.readyState === "loading" ? document.addEventListener("DOMContentLoaded", Os, { once: !0 }) : Os();
window.addEventListener("openxnet-vite-skills-remount", Os);
