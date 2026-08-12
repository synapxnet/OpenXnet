// @__NO_SIDE_EFFECTS__
function Kn(e) {
  const t = /* @__PURE__ */ Object.create(null);
  for (const n of e.split(",")) t[n] = 1;
  return (n) => n in t;
}
const X = {}, yt = [], Be = () => {
}, Js = () => !1, un = (e) => e.charCodeAt(0) === 111 && e.charCodeAt(1) === 110 && // uppercase letter
(e.charCodeAt(2) > 122 || e.charCodeAt(2) < 97), fn = (e) => e.startsWith("onUpdate:"), pe = Object.assign, qn = (e, t) => {
  const n = e.indexOf(t);
  n > -1 && e.splice(n, 1);
}, io = Object.prototype.hasOwnProperty, q = (e, t) => io.call(e, t), k = Array.isArray, bt = (e) => qt(e) === "[object Map]", zs = (e) => qt(e) === "[object Set]", hs = (e) => qt(e) === "[object Date]", V = (e) => typeof e == "function", ne = (e) => typeof e == "string", We = (e) => typeof e == "symbol", J = (e) => e !== null && typeof e == "object", Ys = (e) => (J(e) || V(e)) && V(e.then) && V(e.catch), Xs = Object.prototype.toString, qt = (e) => Xs.call(e), oo = (e) => qt(e).slice(8, -1), Qs = (e) => qt(e) === "[object Object]", Gn = (e) => ne(e) && e !== "NaN" && e[0] !== "-" && "" + parseInt(e, 10) === e, Ft = /* @__PURE__ */ Kn(
  // the leading comma is intentional so empty string "" is also included
  ",key,ref,ref_for,ref_key,onVnodeBeforeMount,onVnodeMounted,onVnodeBeforeUpdate,onVnodeUpdated,onVnodeBeforeUnmount,onVnodeUnmounted"
), dn = (e) => {
  const t = /* @__PURE__ */ Object.create(null);
  return ((n) => t[n] || (t[n] = e(n)));
}, lo = /-\w/g, Ee = dn(
  (e) => e.replace(lo, (t) => t.slice(1).toUpperCase())
), ro = /\B([A-Z])/g, pt = dn(
  (e) => e.replace(ro, "-$1").toLowerCase()
), Zs = dn((e) => e.charAt(0).toUpperCase() + e.slice(1)), bn = dn(
  (e) => e ? `on${Zs(e)}` : ""
), He = (e, t) => !Object.is(e, t), Zt = (e, ...t) => {
  for (let n = 0; n < e.length; n++)
    e[n](...t);
}, ei = (e, t, n, s = !1) => {
  Object.defineProperty(e, t, {
    configurable: !0,
    enumerable: !1,
    writable: s,
    value: n
  });
}, Jn = (e) => {
  const t = parseFloat(e);
  return isNaN(t) ? e : t;
};
let gs;
const pn = () => gs || (gs = typeof globalThis < "u" ? globalThis : typeof self < "u" ? self : typeof window < "u" ? window : typeof globalThis < "u" ? globalThis : {});
function xt(e) {
  if (k(e)) {
    const t = {};
    for (let n = 0; n < e.length; n++) {
      const s = e[n], i = ne(s) ? fo(s) : xt(s);
      if (i)
        for (const o in i)
          t[o] = i[o];
    }
    return t;
  } else if (ne(e) || J(e))
    return e;
}
const ao = /;(?![^(]*\))/g, co = /:([^]+)/, uo = /\/\*[^]*?\*\//g;
function fo(e) {
  const t = {};
  return e.replace(uo, "").split(ao).forEach((n) => {
    if (n) {
      const s = n.split(co);
      s.length > 1 && (t[s[0].trim()] = s[1].trim());
    }
  }), t;
}
function ot(e) {
  let t = "";
  if (ne(e))
    t = e;
  else if (k(e))
    for (let n = 0; n < e.length; n++) {
      const s = ot(e[n]);
      s && (t += s + " ");
    }
  else if (J(e))
    for (const n in e)
      e[n] && (t += n + " ");
  return t.trim();
}
const po = "itemscope,allowfullscreen,formnovalidate,ismap,nomodule,novalidate,readonly", ho = /* @__PURE__ */ Kn(po);
function ti(e) {
  return !!e || e === "";
}
function go(e, t) {
  if (e.length !== t.length) return !1;
  let n = !0;
  for (let s = 0; n && s < e.length; s++)
    n = zn(e[s], t[s]);
  return n;
}
function zn(e, t) {
  if (e === t) return !0;
  let n = hs(e), s = hs(t);
  if (n || s)
    return n && s ? e.getTime() === t.getTime() : !1;
  if (n = We(e), s = We(t), n || s)
    return e === t;
  if (n = k(e), s = k(t), n || s)
    return n && s ? go(e, t) : !1;
  if (n = J(e), s = J(t), n || s) {
    if (!n || !s)
      return !1;
    const i = Object.keys(e).length, o = Object.keys(t).length;
    if (i !== o)
      return !1;
    for (const l in e) {
      const r = e.hasOwnProperty(l), u = t.hasOwnProperty(l);
      if (r && !u || !r && u || !zn(e[l], t[l]))
        return !1;
    }
  }
  return String(e) === String(t);
}
const ni = (e) => !!(e && e.__v_isRef === !0), g = (e) => ne(e) ? e : e == null ? "" : k(e) || J(e) && (e.toString === Xs || !V(e.toString)) ? ni(e) ? g(e.value) : JSON.stringify(e, si, 2) : String(e), si = (e, t) => ni(t) ? si(e, t.value) : bt(t) ? {
  [`Map(${t.size})`]: [...t.entries()].reduce(
    (n, [s, i], o) => (n[xn(s, o) + " =>"] = i, n),
    {}
  )
} : zs(t) ? {
  [`Set(${t.size})`]: [...t.values()].map((n) => xn(n))
} : We(t) ? xn(t) : J(t) && !k(t) && !Qs(t) ? String(t) : t, xn = (e, t = "") => {
  var n;
  return (
    // Symbol.description in es2019+ so we need to cast here to pass
    // the lib: es2016 check
    We(e) ? `Symbol(${(n = e.description) != null ? n : t})` : e
  );
};
let ce;
class vo {
  // TODO isolatedDeclarations "__v_skip"
  constructor(t = !1) {
    this.detached = t, this._active = !0, this._on = 0, this.effects = [], this.cleanups = [], this._isPaused = !1, this._warnOnRun = !0, this.__v_skip = !0, !t && ce && (ce.active ? (this.parent = ce, this.index = (ce.scopes || (ce.scopes = [])).push(
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
      const n = ce;
      try {
        return ce = this, t();
      } finally {
        ce = n;
      }
    }
  }
  /**
   * This should only be called on non-detached scopes
   * @internal
   */
  on() {
    ++this._on === 1 && (this.prevScope = ce, ce = this);
  }
  /**
   * This should only be called on non-detached scopes
   * @internal
   */
  off() {
    if (this._on > 0 && --this._on === 0) {
      if (ce === this)
        ce = this.prevScope;
      else {
        let t = ce;
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
        const i = this.parent.scopes.pop();
        i && i !== this && (this.parent.scopes[this.index] = i, i.index = this.index);
      }
      this.parent = void 0;
    }
  }
}
function mo() {
  return ce;
}
let ee;
const Sn = /* @__PURE__ */ new WeakSet();
class ii {
  constructor(t) {
    this.fn = t, this.deps = void 0, this.depsTail = void 0, this.flags = 5, this.next = void 0, this.cleanup = void 0, this.scheduler = void 0, ce && (ce.active ? ce.effects.push(this) : this.flags &= -2);
  }
  pause() {
    this.flags |= 64;
  }
  resume() {
    this.flags & 64 && (this.flags &= -65, Sn.has(this) && (Sn.delete(this), this.trigger()));
  }
  /**
   * @internal
   */
  notify() {
    this.flags & 2 && !(this.flags & 32) || this.flags & 8 || li(this);
  }
  run() {
    if (!(this.flags & 1))
      return this.fn();
    this.flags |= 2, vs(this), ri(this);
    const t = ee, n = Pe;
    ee = this, Pe = !0;
    try {
      return this.fn();
    } finally {
      ai(this), ee = t, Pe = n, this.flags &= -3;
    }
  }
  stop() {
    if (this.flags & 1) {
      for (let t = this.deps; t; t = t.nextDep)
        Qn(t);
      this.deps = this.depsTail = void 0, vs(this), this.onStop && this.onStop(), this.flags &= -2;
    }
  }
  trigger() {
    this.flags & 64 ? Sn.add(this) : this.scheduler ? this.scheduler() : this.runIfDirty();
  }
  /**
   * @internal
   */
  runIfDirty() {
    On(this) && this.run();
  }
  get dirty() {
    return On(this);
  }
}
let oi = 0, kt, Vt;
function li(e, t = !1) {
  if (e.flags |= 8, t) {
    e.next = Vt, Vt = e;
    return;
  }
  e.next = kt, kt = e;
}
function Yn() {
  oi++;
}
function Xn() {
  if (--oi > 0)
    return;
  if (Vt) {
    let t = Vt;
    for (Vt = void 0; t; ) {
      const n = t.next;
      t.next = void 0, t.flags &= -9, t = n;
    }
  }
  let e;
  for (; kt; ) {
    let t = kt;
    for (kt = void 0; t; ) {
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
function ri(e) {
  for (let t = e.deps; t; t = t.nextDep)
    t.version = -1, t.prevActiveLink = t.dep.activeLink, t.dep.activeLink = t;
}
function ai(e) {
  let t, n = e.depsTail, s = n;
  for (; s; ) {
    const i = s.prevDep;
    s.version === -1 ? (s === n && (n = i), Qn(s), _o(s)) : t = s, s.dep.activeLink = s.prevActiveLink, s.prevActiveLink = void 0, s = i;
  }
  e.deps = t, e.depsTail = n;
}
function On(e) {
  for (let t = e.deps; t; t = t.nextDep)
    if (t.dep.version !== t.version || t.dep.computed && (ci(t.dep.computed) || t.dep.version !== t.version))
      return !0;
  return !!e._dirty;
}
function ci(e) {
  if (e.flags & 4 && !(e.flags & 16) || (e.flags &= -17, e.globalVersion === Ht) || (e.globalVersion = Ht, !e.isSSR && e.flags & 128 && (!e.deps && !e._dirty || !On(e))))
    return;
  e.flags |= 2;
  const t = e.dep, n = ee, s = Pe;
  ee = e, Pe = !0;
  try {
    ri(e);
    const i = e.fn(e._value);
    (t.version === 0 || He(i, e._value)) && (e.flags |= 128, e._value = i, t.version++);
  } catch (i) {
    throw t.version++, i;
  } finally {
    ee = n, Pe = s, ai(e), e.flags &= -3;
  }
}
function Qn(e, t = !1) {
  const { dep: n, prevSub: s, nextSub: i } = e;
  if (s && (s.nextSub = i, e.prevSub = void 0), i && (i.prevSub = s, e.nextSub = void 0), n.subs === e && (n.subs = s, !s && n.computed)) {
    n.computed.flags &= -5;
    for (let o = n.computed.deps; o; o = o.nextDep)
      Qn(o, !0);
  }
  !t && !--n.sc && n.map && n.map.delete(n.key);
}
function _o(e) {
  const { prevDep: t, nextDep: n } = e;
  t && (t.nextDep = n, e.prevDep = void 0), n && (n.prevDep = t, e.nextDep = void 0);
}
let Pe = !0;
const ui = [];
function Xe() {
  ui.push(Pe), Pe = !1;
}
function Qe() {
  const e = ui.pop();
  Pe = e === void 0 ? !0 : e;
}
function vs(e) {
  const { cleanup: t } = e;
  if (e.cleanup = void 0, t) {
    const n = ee;
    ee = void 0;
    try {
      t();
    } finally {
      ee = n;
    }
  }
}
let Ht = 0;
class yo {
  constructor(t, n) {
    this.sub = t, this.dep = n, this.version = n.version, this.nextDep = this.prevDep = this.nextSub = this.prevSub = this.prevActiveLink = void 0;
  }
}
class Zn {
  // TODO isolatedDeclarations "__v_skip"
  constructor(t) {
    this.computed = t, this.version = 0, this.activeLink = void 0, this.subs = void 0, this.map = void 0, this.key = void 0, this.sc = 0, this.__v_skip = !0;
  }
  track(t) {
    if (!ee || !Pe || ee === this.computed)
      return;
    let n = this.activeLink;
    if (n === void 0 || n.sub !== ee)
      n = this.activeLink = new yo(ee, this), ee.deps ? (n.prevDep = ee.depsTail, ee.depsTail.nextDep = n, ee.depsTail = n) : ee.deps = ee.depsTail = n, fi(n);
    else if (n.version === -1 && (n.version = this.version, n.nextDep)) {
      const s = n.nextDep;
      s.prevDep = n.prevDep, n.prevDep && (n.prevDep.nextDep = s), n.prevDep = ee.depsTail, n.nextDep = void 0, ee.depsTail.nextDep = n, ee.depsTail = n, ee.deps === n && (ee.deps = s);
    }
    return n;
  }
  trigger(t) {
    this.version++, Ht++, this.notify(t);
  }
  notify(t) {
    Yn();
    try {
      for (let n = this.subs; n; n = n.prevSub)
        n.sub.notify() && n.sub.dep.notify();
    } finally {
      Xn();
    }
  }
}
function fi(e) {
  if (e.dep.sc++, e.sub.flags & 4) {
    const t = e.dep.computed;
    if (t && !e.dep.subs) {
      t.flags |= 20;
      for (let s = t.deps; s; s = s.nextDep)
        fi(s);
    }
    const n = e.dep.subs;
    n !== e && (e.prevSub = n, n && (n.nextSub = e)), e.dep.subs = e;
  }
}
const Ln = /* @__PURE__ */ new WeakMap(), ft = /* @__PURE__ */ Symbol(
  ""
), Fn = /* @__PURE__ */ Symbol(
  ""
), Bt = /* @__PURE__ */ Symbol(
  ""
);
function fe(e, t, n) {
  if (Pe && ee) {
    let s = Ln.get(e);
    s || Ln.set(e, s = /* @__PURE__ */ new Map());
    let i = s.get(n);
    i || (s.set(n, i = new Zn()), i.map = s, i.key = n), i.track();
  }
}
function Je(e, t, n, s, i, o) {
  const l = Ln.get(e);
  if (!l) {
    Ht++;
    return;
  }
  const r = (u) => {
    u && u.trigger();
  };
  if (Yn(), t === "clear")
    l.forEach(r);
  else {
    const u = k(e), p = u && Gn(n);
    if (u && n === "length") {
      const d = Number(s);
      l.forEach((v, A) => {
        (A === "length" || A === Bt || !We(A) && A >= d) && r(v);
      });
    } else
      switch ((n !== void 0 || l.has(void 0)) && r(l.get(n)), p && r(l.get(Bt)), t) {
        case "add":
          u ? p && r(l.get("length")) : (r(l.get(ft)), bt(e) && r(l.get(Fn)));
          break;
        case "delete":
          u || (r(l.get(ft)), bt(e) && r(l.get(Fn)));
          break;
        case "set":
          bt(e) && r(l.get(ft));
          break;
      }
  }
  Xn();
}
function vt(e) {
  const t = /* @__PURE__ */ K(e);
  return t === e ? t : (fe(t, "iterate", Bt), /* @__PURE__ */ Ce(e) ? t : t.map(Ie));
}
function hn(e) {
  return fe(e = /* @__PURE__ */ K(e), "iterate", Bt), e;
}
function $e(e, t) {
  return /* @__PURE__ */ Ze(e) ? Mt(/* @__PURE__ */ dt(e) ? Ie(t) : t) : Ie(t);
}
const bo = {
  __proto__: null,
  [Symbol.iterator]() {
    return wn(this, Symbol.iterator, (e) => $e(this, e));
  },
  concat(...e) {
    return vt(this).concat(
      ...e.map((t) => k(t) ? vt(t) : t)
    );
  },
  entries() {
    return wn(this, "entries", (e) => (e[1] = $e(this, e[1]), e));
  },
  every(e, t) {
    return Ke(this, "every", e, t, void 0, arguments);
  },
  filter(e, t) {
    return Ke(
      this,
      "filter",
      e,
      t,
      (n) => n.map((s) => $e(this, s)),
      arguments
    );
  },
  find(e, t) {
    return Ke(
      this,
      "find",
      e,
      t,
      (n) => $e(this, n),
      arguments
    );
  },
  findIndex(e, t) {
    return Ke(this, "findIndex", e, t, void 0, arguments);
  },
  findLast(e, t) {
    return Ke(
      this,
      "findLast",
      e,
      t,
      (n) => $e(this, n),
      arguments
    );
  },
  findLastIndex(e, t) {
    return Ke(this, "findLastIndex", e, t, void 0, arguments);
  },
  // flat, flatMap could benefit from ARRAY_ITERATE but are not straight-forward to implement
  forEach(e, t) {
    return Ke(this, "forEach", e, t, void 0, arguments);
  },
  includes(...e) {
    return Mn(this, "includes", e);
  },
  indexOf(...e) {
    return Mn(this, "indexOf", e);
  },
  join(e) {
    return vt(this).join(e);
  },
  // keys() iterator only reads `length`, no optimization required
  lastIndexOf(...e) {
    return Mn(this, "lastIndexOf", e);
  },
  map(e, t) {
    return Ke(this, "map", e, t, void 0, arguments);
  },
  pop() {
    return Et(this, "pop");
  },
  push(...e) {
    return Et(this, "push", e);
  },
  reduce(e, ...t) {
    return ms(this, "reduce", e, t);
  },
  reduceRight(e, ...t) {
    return ms(this, "reduceRight", e, t);
  },
  shift() {
    return Et(this, "shift");
  },
  // slice could use ARRAY_ITERATE but also seems to beg for range tracking
  some(e, t) {
    return Ke(this, "some", e, t, void 0, arguments);
  },
  splice(...e) {
    return Et(this, "splice", e);
  },
  toReversed() {
    return vt(this).toReversed();
  },
  toSorted(e) {
    return vt(this).toSorted(e);
  },
  toSpliced(...e) {
    return vt(this).toSpliced(...e);
  },
  unshift(...e) {
    return Et(this, "unshift", e);
  },
  values() {
    return wn(this, "values", (e) => $e(this, e));
  }
};
function wn(e, t, n) {
  const s = hn(e), i = s[t]();
  return s !== e && !/* @__PURE__ */ Ce(e) && (i._next = i.next, i.next = () => {
    const o = i._next();
    return o.done || (o.value = n(o.value)), o;
  }), i;
}
const xo = Array.prototype;
function Ke(e, t, n, s, i, o) {
  const l = hn(e), r = l !== e && !/* @__PURE__ */ Ce(e), u = l[t];
  if (u !== xo[t]) {
    const v = u.apply(e, o);
    return r ? Ie(v) : v;
  }
  let p = n;
  l !== e && (r ? p = function(v, A) {
    return n.call(this, $e(e, v), A, e);
  } : n.length > 2 && (p = function(v, A) {
    return n.call(this, v, A, e);
  }));
  const d = u.call(l, p, s);
  return r && i ? i(d) : d;
}
function ms(e, t, n, s) {
  const i = hn(e), o = i !== e && !/* @__PURE__ */ Ce(e);
  let l = n, r = !1;
  i !== e && (o ? (r = s.length === 0, l = function(p, d, v) {
    return r && (r = !1, p = $e(e, p)), n.call(this, p, $e(e, d), v, e);
  }) : n.length > 3 && (l = function(p, d, v) {
    return n.call(this, p, d, v, e);
  }));
  const u = i[t](l, ...s);
  return r ? $e(e, u) : u;
}
function Mn(e, t, n) {
  const s = /* @__PURE__ */ K(e);
  fe(s, "iterate", Bt);
  const i = s[t](...n);
  return (i === -1 || i === !1) && /* @__PURE__ */ ss(n[0]) ? (n[0] = /* @__PURE__ */ K(n[0]), s[t](...n)) : i;
}
function Et(e, t, n = []) {
  Xe(), Yn();
  const s = (/* @__PURE__ */ K(e))[t].apply(e, n);
  return Xn(), Qe(), s;
}
const So = /* @__PURE__ */ Kn("__proto__,__v_isRef,__isVue"), di = new Set(
  /* @__PURE__ */ Object.getOwnPropertyNames(Symbol).filter((e) => e !== "arguments" && e !== "caller").map((e) => Symbol[e]).filter(We)
);
function wo(e) {
  We(e) || (e = String(e));
  const t = /* @__PURE__ */ K(this);
  return fe(t, "has", e), t.hasOwnProperty(e);
}
class pi {
  constructor(t = !1, n = !1) {
    this._isReadonly = t, this._isShallow = n;
  }
  get(t, n, s) {
    if (n === "__v_skip") return t.__v_skip;
    const i = this._isReadonly, o = this._isShallow;
    if (n === "__v_isReactive")
      return !i;
    if (n === "__v_isReadonly")
      return i;
    if (n === "__v_isShallow")
      return o;
    if (n === "__v_raw")
      return s === (i ? o ? Lo : mi : o ? vi : gi).get(t) || // receiver is not the reactive proxy, but has the same prototype
      // this means the receiver is a user proxy of the reactive proxy
      Object.getPrototypeOf(t) === Object.getPrototypeOf(s) ? t : void 0;
    const l = k(t);
    if (!i) {
      let u;
      if (l && (u = bo[n]))
        return u;
      if (n === "hasOwnProperty")
        return wo;
    }
    const r = Reflect.get(
      t,
      n,
      // if this is a proxy wrapping a ref, return methods using the raw ref
      // as receiver so that we don't have to call `toRaw` on the ref in all
      // its class methods
      /* @__PURE__ */ de(t) ? t : s
    );
    if ((We(n) ? di.has(n) : So(n)) || (i || fe(t, "get", n), o))
      return r;
    if (/* @__PURE__ */ de(r)) {
      const u = l && Gn(n) ? r : r.value;
      return i && J(u) ? /* @__PURE__ */ Vn(u) : u;
    }
    return J(r) ? i ? /* @__PURE__ */ Vn(r) : /* @__PURE__ */ ts(r) : r;
  }
}
class hi extends pi {
  constructor(t = !1) {
    super(!1, t);
  }
  set(t, n, s, i) {
    let o = t[n];
    const l = k(t) && Gn(n);
    if (!this._isShallow) {
      const p = /* @__PURE__ */ Ze(o);
      if (!/* @__PURE__ */ Ce(s) && !/* @__PURE__ */ Ze(s) && (o = /* @__PURE__ */ K(o), s = /* @__PURE__ */ K(s)), !l && /* @__PURE__ */ de(o) && !/* @__PURE__ */ de(s))
        return p || (o.value = s), !0;
    }
    const r = l ? Number(n) < t.length : q(t, n), u = Reflect.set(
      t,
      n,
      s,
      /* @__PURE__ */ de(t) ? t : i
    );
    return t === /* @__PURE__ */ K(i) && (r ? He(s, o) && Je(t, "set", n, s) : Je(t, "add", n, s)), u;
  }
  deleteProperty(t, n) {
    const s = q(t, n);
    t[n];
    const i = Reflect.deleteProperty(t, n);
    return i && s && Je(t, "delete", n, void 0), i;
  }
  has(t, n) {
    const s = Reflect.has(t, n);
    return (!We(n) || !di.has(n)) && fe(t, "has", n), s;
  }
  ownKeys(t) {
    return fe(
      t,
      "iterate",
      k(t) ? "length" : ft
    ), Reflect.ownKeys(t);
  }
}
class Mo extends pi {
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
const Co = /* @__PURE__ */ new hi(), To = /* @__PURE__ */ new Mo(), Ro = /* @__PURE__ */ new hi(!0);
const kn = (e) => e, Yt = (e) => Reflect.getPrototypeOf(e);
function Ao(e, t, n) {
  return function(...s) {
    const i = this.__v_raw, o = /* @__PURE__ */ K(i), l = bt(o), r = e === "entries" || e === Symbol.iterator && l, u = e === "keys" && l, p = i[e](...s), d = n ? kn : t ? Mt : Ie;
    return !t && fe(
      o,
      "iterate",
      u ? Fn : ft
    ), pe(
      // inheriting all iterator properties
      Object.create(p),
      {
        // iterator protocol
        next() {
          const { value: v, done: A } = p.next();
          return A ? { value: v, done: A } : {
            value: r ? [d(v[0]), d(v[1])] : d(v),
            done: A
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
function Eo(e, t) {
  const n = {
    get(i) {
      const o = this.__v_raw, l = /* @__PURE__ */ K(o), r = /* @__PURE__ */ K(i);
      e || (He(i, r) && fe(l, "get", i), fe(l, "get", r));
      const { has: u } = Yt(l), p = t ? kn : e ? Mt : Ie;
      if (u.call(l, i))
        return p(o.get(i));
      if (u.call(l, r))
        return p(o.get(r));
      o !== l && o.get(i);
    },
    get size() {
      const i = this.__v_raw;
      return !e && fe(/* @__PURE__ */ K(i), "iterate", ft), i.size;
    },
    has(i) {
      const o = this.__v_raw, l = /* @__PURE__ */ K(o), r = /* @__PURE__ */ K(i);
      return e || (He(i, r) && fe(l, "has", i), fe(l, "has", r)), i === r ? o.has(i) : o.has(i) || o.has(r);
    },
    forEach(i, o) {
      const l = this, r = l.__v_raw, u = /* @__PURE__ */ K(r), p = t ? kn : e ? Mt : Ie;
      return !e && fe(u, "iterate", ft), r.forEach((d, v) => i.call(o, p(d), p(v), l));
    }
  };
  return pe(
    n,
    e ? {
      add: Xt("add"),
      set: Xt("set"),
      delete: Xt("delete"),
      clear: Xt("clear")
    } : {
      add(i) {
        const o = /* @__PURE__ */ K(this), l = Yt(o), r = /* @__PURE__ */ K(i), u = !t && !/* @__PURE__ */ Ce(i) && !/* @__PURE__ */ Ze(i) ? r : i;
        return l.has.call(o, u) || He(i, u) && l.has.call(o, i) || He(r, u) && l.has.call(o, r) || (o.add(u), Je(o, "add", u, u)), this;
      },
      set(i, o) {
        !t && !/* @__PURE__ */ Ce(o) && !/* @__PURE__ */ Ze(o) && (o = /* @__PURE__ */ K(o));
        const l = /* @__PURE__ */ K(this), { has: r, get: u } = Yt(l);
        let p = r.call(l, i);
        p || (i = /* @__PURE__ */ K(i), p = r.call(l, i));
        const d = u.call(l, i);
        return l.set(i, o), p ? He(o, d) && Je(l, "set", i, o) : Je(l, "add", i, o), this;
      },
      delete(i) {
        const o = /* @__PURE__ */ K(this), { has: l, get: r } = Yt(o);
        let u = l.call(o, i);
        u || (i = /* @__PURE__ */ K(i), u = l.call(o, i)), r && r.call(o, i);
        const p = o.delete(i);
        return u && Je(o, "delete", i, void 0), p;
      },
      clear() {
        const i = /* @__PURE__ */ K(this), o = i.size !== 0, l = i.clear();
        return o && Je(
          i,
          "clear",
          void 0,
          void 0
        ), l;
      }
    }
  ), [
    "keys",
    "values",
    "entries",
    Symbol.iterator
  ].forEach((i) => {
    n[i] = Ao(i, e, t);
  }), n;
}
function es(e, t) {
  const n = Eo(e, t);
  return (s, i, o) => i === "__v_isReactive" ? !e : i === "__v_isReadonly" ? e : i === "__v_raw" ? s : Reflect.get(
    q(n, i) && i in s ? n : s,
    i,
    o
  );
}
const Po = {
  get: /* @__PURE__ */ es(!1, !1)
}, Io = {
  get: /* @__PURE__ */ es(!1, !0)
}, Oo = {
  get: /* @__PURE__ */ es(!0, !1)
};
const gi = /* @__PURE__ */ new WeakMap(), vi = /* @__PURE__ */ new WeakMap(), mi = /* @__PURE__ */ new WeakMap(), Lo = /* @__PURE__ */ new WeakMap();
function Fo(e) {
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
function ko(e) {
  return e.__v_skip || !Object.isExtensible(e) ? 0 : Fo(oo(e));
}
// @__NO_SIDE_EFFECTS__
function ts(e) {
  return /* @__PURE__ */ Ze(e) ? e : ns(
    e,
    !1,
    Co,
    Po,
    gi
  );
}
// @__NO_SIDE_EFFECTS__
function Vo(e) {
  return ns(
    e,
    !1,
    Ro,
    Io,
    vi
  );
}
// @__NO_SIDE_EFFECTS__
function Vn(e) {
  return ns(
    e,
    !0,
    To,
    Oo,
    mi
  );
}
function ns(e, t, n, s, i) {
  if (!J(e) || e.__v_raw && !(t && e.__v_isReactive))
    return e;
  const o = ko(e);
  if (o === 0)
    return e;
  const l = i.get(e);
  if (l)
    return l;
  const r = new Proxy(
    e,
    o === 2 ? s : n
  );
  return i.set(e, r), r;
}
// @__NO_SIDE_EFFECTS__
function dt(e) {
  return /* @__PURE__ */ Ze(e) ? /* @__PURE__ */ dt(e.__v_raw) : !!(e && e.__v_isReactive);
}
// @__NO_SIDE_EFFECTS__
function Ze(e) {
  return !!(e && e.__v_isReadonly);
}
// @__NO_SIDE_EFFECTS__
function Ce(e) {
  return !!(e && e.__v_isShallow);
}
// @__NO_SIDE_EFFECTS__
function ss(e) {
  return e ? !!e.__v_raw : !1;
}
// @__NO_SIDE_EFFECTS__
function K(e) {
  const t = e && e.__v_raw;
  return t ? /* @__PURE__ */ K(t) : e;
}
function Do(e) {
  return !q(e, "__v_skip") && Object.isExtensible(e) && ei(e, "__v_skip", !0), e;
}
const Ie = (e) => J(e) ? /* @__PURE__ */ ts(e) : e, Mt = (e) => J(e) ? /* @__PURE__ */ Vn(e) : e;
// @__NO_SIDE_EFFECTS__
function de(e) {
  return e ? e.__v_isRef === !0 : !1;
}
// @__NO_SIDE_EFFECTS__
function Cn(e) {
  return No(e, !1);
}
function No(e, t) {
  return /* @__PURE__ */ de(e) ? e : new $o(e, t);
}
class $o {
  constructor(t, n) {
    this.dep = new Zn(), this.__v_isRef = !0, this.__v_isShallow = !1, this._rawValue = n ? t : /* @__PURE__ */ K(t), this._value = n ? t : Ie(t), this.__v_isShallow = n;
  }
  get value() {
    return this.dep.track(), this._value;
  }
  set value(t) {
    const n = this._rawValue, s = this.__v_isShallow || /* @__PURE__ */ Ce(t) || /* @__PURE__ */ Ze(t);
    t = s ? t : /* @__PURE__ */ K(t), He(t, n) && (this._rawValue = t, this._value = s ? t : Ie(t), this.dep.trigger());
  }
}
function jo(e) {
  return /* @__PURE__ */ de(e) ? e.value : e;
}
const Ho = {
  get: (e, t, n) => t === "__v_raw" ? e : jo(Reflect.get(e, t, n)),
  set: (e, t, n, s) => {
    const i = e[t];
    return /* @__PURE__ */ de(i) && !/* @__PURE__ */ de(n) ? (i.value = n, !0) : Reflect.set(e, t, n, s);
  }
};
function _i(e) {
  return /* @__PURE__ */ dt(e) ? e : new Proxy(e, Ho);
}
class Bo {
  constructor(t, n, s) {
    this.fn = t, this.setter = n, this._value = void 0, this.dep = new Zn(this), this.__v_isRef = !0, this.deps = void 0, this.depsTail = void 0, this.flags = 16, this.globalVersion = Ht - 1, this.next = void 0, this.effect = this, this.__v_isReadonly = !n, this.isSSR = s;
  }
  /**
   * @internal
   */
  notify() {
    if (this.flags |= 16, !(this.flags & 8) && // avoid infinite self recursion
    ee !== this)
      return li(this, !0), !0;
  }
  get value() {
    const t = this.dep.track();
    return ci(this), t && (t.version = this.dep.version), this._value;
  }
  set value(t) {
    this.setter && this.setter(t);
  }
}
// @__NO_SIDE_EFFECTS__
function Wo(e, t, n = !1) {
  let s, i;
  return V(e) ? s = e : (s = e.get, i = e.set), new Bo(s, i, n);
}
const Qt = {}, sn = /* @__PURE__ */ new WeakMap();
let ut;
function Uo(e, t = !1, n = ut) {
  if (n) {
    let s = sn.get(n);
    s || sn.set(n, s = []), s.push(e);
  }
}
function Ko(e, t, n = X) {
  const { immediate: s, deep: i, once: o, scheduler: l, augmentJob: r, call: u } = n, p = (O) => i ? O : /* @__PURE__ */ Ce(O) || i === !1 || i === 0 ? ze(O, 1) : ze(O);
  let d, v, A, E, W = !1, F = !1;
  if (/* @__PURE__ */ de(e) ? (v = () => e.value, W = /* @__PURE__ */ Ce(e)) : /* @__PURE__ */ dt(e) ? (v = () => p(e), W = !0) : k(e) ? (F = !0, W = e.some((O) => /* @__PURE__ */ dt(O) || /* @__PURE__ */ Ce(O)), v = () => e.map((O) => {
    if (/* @__PURE__ */ de(O))
      return O.value;
    if (/* @__PURE__ */ dt(O))
      return p(O);
    if (V(O))
      return u ? u(O, 2) : O();
  })) : V(e) ? t ? v = u ? () => u(e, 2) : e : v = () => {
    if (A) {
      Xe();
      try {
        A();
      } finally {
        Qe();
      }
    }
    const O = ut;
    ut = d;
    try {
      return u ? u(e, 3, [E]) : e(E);
    } finally {
      ut = O;
    }
  } : v = Be, t && i) {
    const O = v, se = i === !0 ? 1 / 0 : i;
    v = () => ze(O(), se);
  }
  const te = mo(), Q = () => {
    d.stop(), te && te.active && qn(te.effects, d);
  };
  if (o && t) {
    const O = t;
    t = (...se) => {
      O(...se), Q();
    };
  }
  let j = F ? new Array(e.length).fill(Qt) : Qt;
  const U = (O) => {
    if (!(!(d.flags & 1) || !d.dirty && !O))
      if (t) {
        const se = d.run();
        if (i || W || (F ? se.some((Te, Se) => He(Te, j[Se])) : He(se, j))) {
          A && A();
          const Te = ut;
          ut = d;
          try {
            const Se = [
              se,
              // pass undefined as the old value when it's changed for the first time
              j === Qt ? void 0 : F && j[0] === Qt ? [] : j,
              E
            ];
            j = se, u ? u(t, 3, Se) : (
              // @ts-expect-error
              t(...Se)
            );
          } finally {
            ut = Te;
          }
        }
      } else
        d.run();
  };
  return r && r(U), d = new ii(v), d.scheduler = l ? () => l(U, !1) : U, E = (O) => Uo(O, !1, d), A = d.onStop = () => {
    const O = sn.get(d);
    if (O) {
      if (u)
        u(O, 4);
      else
        for (const se of O) se();
      sn.delete(d);
    }
  }, t ? s ? U(!0) : j = d.run() : l ? l(U.bind(null, !0), !0) : d.run(), Q.pause = d.pause.bind(d), Q.resume = d.resume.bind(d), Q.stop = Q, Q;
}
function ze(e, t = 1 / 0, n) {
  if (t <= 0 || !J(e) || e.__v_skip || (n = n || /* @__PURE__ */ new Map(), (n.get(e) || 0) >= t))
    return e;
  if (n.set(e, t), t--, /* @__PURE__ */ de(e))
    ze(e.value, t, n);
  else if (k(e))
    for (let s = 0; s < e.length; s++)
      ze(e[s], t, n);
  else if (zs(e) || bt(e))
    e.forEach((s) => {
      ze(s, t, n);
    });
  else if (Qs(e)) {
    for (const s in e)
      ze(e[s], t, n);
    for (const s of Object.getOwnPropertySymbols(e))
      Object.prototype.propertyIsEnumerable.call(e, s) && ze(e[s], t, n);
  }
  return e;
}
function Gt(e, t, n, s) {
  try {
    return s ? e(...s) : e();
  } catch (i) {
    gn(i, t, n);
  }
}
function Ue(e, t, n, s) {
  if (V(e)) {
    const i = Gt(e, t, n, s);
    return i && Ys(i) && i.catch((o) => {
      gn(o, t, n);
    }), i;
  }
  if (k(e)) {
    const i = [];
    for (let o = 0; o < e.length; o++)
      i.push(Ue(e[o], t, n, s));
    return i;
  }
}
function gn(e, t, n, s = !0) {
  const i = t ? t.vnode : null, { errorHandler: o, throwUnhandledErrorInProduction: l } = t && t.appContext.config || X;
  if (t) {
    let r = t.parent;
    const u = t.proxy, p = `https://vuejs.org/error-reference/#runtime-${n}`;
    for (; r; ) {
      const d = r.ec;
      if (d) {
        for (let v = 0; v < d.length; v++)
          if (d[v](e, u, p) === !1)
            return;
      }
      r = r.parent;
    }
    if (o) {
      Xe(), Gt(o, null, 10, [
        e,
        u,
        p
      ]), Qe();
      return;
    }
  }
  qo(e, n, i, s, l);
}
function qo(e, t, n, s = !0, i = !1) {
  if (i)
    throw e;
  console.error(e);
}
const ge = [];
let Ne = -1;
const St = [];
let it = null, mt = 0;
const yi = /* @__PURE__ */ Promise.resolve();
let on = null;
function bi(e) {
  const t = on || yi;
  return e ? t.then(this ? e.bind(this) : e) : t;
}
function Go(e) {
  let t = Ne + 1, n = ge.length;
  for (; t < n; ) {
    const s = t + n >>> 1, i = ge[s], o = Wt(i);
    o < e || o === e && i.flags & 2 ? t = s + 1 : n = s;
  }
  return t;
}
function is(e) {
  if (!(e.flags & 1)) {
    const t = Wt(e), n = ge[ge.length - 1];
    !n || // fast path when the job id is larger than the tail
    !(e.flags & 2) && t >= Wt(n) ? ge.push(e) : ge.splice(Go(t), 0, e), e.flags |= 1, xi();
  }
}
function xi() {
  on || (on = yi.then(wi));
}
function Jo(e) {
  k(e) ? St.push(...e) : it && e.id === -1 ? it.splice(mt + 1, 0, e) : e.flags & 1 || (St.push(e), e.flags |= 1), xi();
}
function _s(e, t, n = Ne + 1) {
  for (; n < ge.length; n++) {
    const s = ge[n];
    if (s && s.flags & 2) {
      if (e && s.id !== e.uid)
        continue;
      ge.splice(n, 1), n--, s.flags & 4 && (s.flags &= -2), s(), s.flags & 4 || (s.flags &= -2);
    }
  }
}
function Si(e) {
  if (St.length) {
    const t = [...new Set(St)].sort(
      (n, s) => Wt(n) - Wt(s)
    );
    if (St.length = 0, it) {
      it.push(...t);
      return;
    }
    for (it = t, mt = 0; mt < it.length; mt++) {
      const n = it[mt];
      n.flags & 4 && (n.flags &= -2), n.flags & 8 || n(), n.flags &= -2;
    }
    it = null, mt = 0;
  }
}
const Wt = (e) => e.id == null ? e.flags & 2 ? -1 : 1 / 0 : e.id;
function wi(e) {
  try {
    for (Ne = 0; Ne < ge.length; Ne++) {
      const t = ge[Ne];
      t && !(t.flags & 8) && (t.flags & 4 && (t.flags &= -2), Gt(
        t,
        t.i,
        t.i ? 15 : 14
      ), t.flags & 4 || (t.flags &= -2));
    }
  } finally {
    for (; Ne < ge.length; Ne++) {
      const t = ge[Ne];
      t && (t.flags &= -2);
    }
    Ne = -1, ge.length = 0, Si(), on = null, (ge.length || St.length) && wi();
  }
}
let Me = null, Mi = null;
function ln(e) {
  const t = Me;
  return Me = e, Mi = e && e.type.__scopeId || null, t;
}
function zo(e, t = Me, n) {
  if (!t || e._n)
    return e;
  const s = (...i) => {
    s._d && Es(-1);
    const o = ln(t);
    let l;
    try {
      l = e(...i);
    } finally {
      ln(o), s._d && Es(1);
    }
    return l;
  };
  return s._n = !0, s._c = !0, s._d = !0, s;
}
function Yo(e, t) {
  if (Me === null)
    return e;
  const n = yn(Me), s = e.dirs || (e.dirs = []);
  for (let i = 0; i < t.length; i++) {
    let [o, l, r, u = X] = t[i];
    o && (V(o) && (o = {
      mounted: o,
      updated: o
    }), o.deep && ze(l), s.push({
      dir: o,
      instance: n,
      value: l,
      oldValue: void 0,
      arg: r,
      modifiers: u
    }));
  }
  return e;
}
function at(e, t, n, s) {
  const i = e.dirs, o = t && t.dirs;
  for (let l = 0; l < i.length; l++) {
    const r = i[l];
    o && (r.oldValue = o[l].value);
    let u = r.dir[s];
    u && (Xe(), Ue(u, n, 8, [
      e.el,
      r,
      e,
      t
    ]), Qe());
  }
}
function Xo(e, t) {
  if (ve) {
    let n = ve.provides;
    const s = ve.parent && ve.parent.provides;
    s === n && (n = ve.provides = Object.create(s)), n[e] = t;
  }
}
function en(e, t, n = !1) {
  const s = Yl();
  if (s || wt) {
    let i = wt ? wt._context.provides : s ? s.parent == null || s.ce ? s.vnode.appContext && s.vnode.appContext.provides : s.parent.provides : void 0;
    if (i && e in i)
      return i[e];
    if (arguments.length > 1)
      return n && V(t) ? t.call(s && s.proxy) : t;
  }
}
const Qo = /* @__PURE__ */ Symbol.for("v-scx"), Zo = () => en(Qo);
function tn(e, t, n) {
  return Ci(e, t, n);
}
function Ci(e, t, n = X) {
  const { immediate: s, deep: i, flush: o, once: l } = n, r = pe({}, n), u = t && s || !t && o !== "post";
  let p;
  if (Kt) {
    if (o === "sync") {
      const E = Zo();
      p = E.__watcherHandles || (E.__watcherHandles = []);
    } else if (!u) {
      const E = () => {
      };
      return E.stop = Be, E.resume = Be, E.pause = Be, E;
    }
  }
  const d = ve;
  r.call = (E, W, F) => Ue(E, d, W, F);
  let v = !1;
  o === "post" ? r.scheduler = (E) => {
    me(E, d && d.suspense);
  } : o !== "sync" && (v = !0, r.scheduler = (E, W) => {
    W ? E() : is(E);
  }), r.augmentJob = (E) => {
    t && (E.flags |= 4), v && (E.flags |= 2, d && (E.id = d.uid, E.i = d));
  };
  const A = Ko(e, t, r);
  return Kt && (p ? p.push(A) : u && A()), A;
}
function el(e, t, n) {
  const s = this.proxy, i = ne(e) ? e.includes(".") ? Ti(s, e) : () => s[e] : e.bind(s, s);
  let o;
  V(t) ? o = t : (o = t.handler, n = t);
  const l = Jt(this), r = Ci(i, o.bind(s), n);
  return l(), r;
}
function Ti(e, t) {
  const n = t.split(".");
  return () => {
    let s = e;
    for (let i = 0; i < n.length && s; i++)
      s = s[n[i]];
    return s;
  };
}
const tl = /* @__PURE__ */ Symbol("_vte"), nl = (e) => e.__isTeleport, sl = /* @__PURE__ */ Symbol("_leaveCb");
function os(e, t) {
  e.shapeFlag & 6 && e.component ? (e.transition = t, os(e.component.subTree, t)) : e.shapeFlag & 128 ? (e.ssContent.transition = t.clone(e.ssContent), e.ssFallback.transition = t.clone(e.ssFallback)) : e.transition = t;
}
function Ri(e) {
  e.ids = [e.ids[0] + e.ids[2]++ + "-", 0, 0];
}
function ys(e, t) {
  let n;
  return !!((n = Object.getOwnPropertyDescriptor(e, t)) && !n.configurable);
}
const rn = /* @__PURE__ */ new WeakMap();
function Dt(e, t, n, s, i = !1) {
  if (k(e)) {
    e.forEach(
      (F, te) => Dt(
        F,
        t && (k(t) ? t[te] : t),
        n,
        s,
        i
      )
    );
    return;
  }
  if (Nt(s) && !i) {
    s.shapeFlag & 512 && s.type.__asyncResolved && s.component.subTree.component && Dt(e, t, n, s.component.subTree);
    return;
  }
  const o = s.shapeFlag & 4 ? yn(s.component) : s.el, l = i ? null : o, { i: r, r: u } = e, p = t && t.r, d = r.refs === X ? r.refs = {} : r.refs, v = r.setupState, A = /* @__PURE__ */ K(v), E = v === X ? Js : (F) => ys(d, F) ? !1 : q(A, F), W = (F, te) => !(te && ys(d, te));
  if (p != null && p !== u) {
    if (bs(t), ne(p))
      d[p] = null, E(p) && (v[p] = null);
    else if (/* @__PURE__ */ de(p)) {
      const F = t;
      W(p, F.k) && (p.value = null), F.k && (d[F.k] = null);
    }
  }
  if (V(u))
    Gt(u, r, 12, [l, d]);
  else {
    const F = ne(u), te = /* @__PURE__ */ de(u);
    if (F || te) {
      const Q = () => {
        if (e.f) {
          const j = F ? E(u) ? v[u] : d[u] : W() || !e.k ? u.value : d[e.k];
          if (i)
            k(j) && qn(j, o);
          else if (k(j))
            j.includes(o) || j.push(o);
          else if (F)
            d[u] = [o], E(u) && (v[u] = d[u]);
          else {
            const U = [o];
            W(u, e.k) && (u.value = U), e.k && (d[e.k] = U);
          }
        } else F ? (d[u] = l, E(u) && (v[u] = l)) : te && (W(u, e.k) && (u.value = l), e.k && (d[e.k] = l));
      };
      if (l) {
        const j = () => {
          Q(), rn.delete(e);
        };
        j.id = -1, rn.set(e, j), me(j, n);
      } else
        bs(e), Q();
    }
  }
}
function bs(e) {
  const t = rn.get(e);
  t && (t.flags |= 8, rn.delete(e));
}
pn().requestIdleCallback;
pn().cancelIdleCallback;
const Nt = (e) => !!e.type.__asyncLoader, Ai = (e) => e.type.__isKeepAlive;
function il(e, t) {
  Ei(e, "a", t);
}
function ol(e, t) {
  Ei(e, "da", t);
}
function Ei(e, t, n = ve) {
  const s = e.__wdc || (e.__wdc = () => {
    let i = n;
    for (; i; ) {
      if (i.isDeactivated)
        return;
      i = i.parent;
    }
    return e();
  });
  if (vn(t, s, n), n) {
    let i = n.parent;
    for (; i && i.parent; )
      Ai(i.parent.vnode) && ll(s, t, n, i), i = i.parent;
  }
}
function ll(e, t, n, s) {
  const i = vn(
    t,
    e,
    s,
    !0
    /* prepend */
  );
  Oi(() => {
    qn(s[t], i);
  }, n);
}
function vn(e, t, n = ve, s = !1) {
  if (n) {
    const i = n[e] || (n[e] = []), o = t.__weh || (t.__weh = (...l) => {
      Xe();
      const r = Jt(n), u = Ue(t, n, e, l);
      return r(), Qe(), u;
    });
    return s ? i.unshift(o) : i.push(o), o;
  }
}
const et = (e) => (t, n = ve) => {
  (!Kt || e === "sp") && vn(e, (...s) => t(...s), n);
}, rl = et("bm"), Pi = et("m"), al = et(
  "bu"
), cl = et("u"), Ii = et(
  "bum"
), Oi = et("um"), ul = et(
  "sp"
), fl = et("rtg"), dl = et("rtc");
function pl(e, t = ve) {
  vn("ec", e, t);
}
const hl = /* @__PURE__ */ Symbol.for("v-ndc");
function Re(e, t, n, s) {
  let i;
  const o = n, l = k(e);
  if (l || ne(e)) {
    const r = l && /* @__PURE__ */ dt(e);
    let u = !1, p = !1;
    r && (u = !/* @__PURE__ */ Ce(e), p = /* @__PURE__ */ Ze(e), e = hn(e)), i = new Array(e.length);
    for (let d = 0, v = e.length; d < v; d++)
      i[d] = t(
        u ? p ? Mt(Ie(e[d])) : Ie(e[d]) : e[d],
        d,
        void 0,
        o
      );
  } else if (typeof e == "number") {
    i = new Array(e);
    for (let r = 0; r < e; r++)
      i[r] = t(r + 1, r, void 0, o);
  } else if (J(e))
    if (e[Symbol.iterator])
      i = Array.from(
        e,
        (r, u) => t(r, u, void 0, o)
      );
    else {
      const r = Object.keys(e);
      i = new Array(r.length);
      for (let u = 0, p = r.length; u < p; u++) {
        const d = r[u];
        i[u] = t(e[d], d, u, o);
      }
    }
  else
    i = [];
  return i;
}
const Dn = (e) => e ? Zi(e) ? yn(e) : Dn(e.parent) : null, $t = (
  // Move PURE marker to new line to workaround compiler discarding it
  // due to type annotation
  /* @__PURE__ */ pe(/* @__PURE__ */ Object.create(null), {
    $: (e) => e,
    $el: (e) => e.vnode.el,
    $data: (e) => e.data,
    $props: (e) => e.props,
    $attrs: (e) => e.attrs,
    $slots: (e) => e.slots,
    $refs: (e) => e.refs,
    $parent: (e) => Dn(e.parent),
    $root: (e) => Dn(e.root),
    $host: (e) => e.ce,
    $emit: (e) => e.emit,
    $options: (e) => Fi(e),
    $forceUpdate: (e) => e.f || (e.f = () => {
      is(e.update);
    }),
    $nextTick: (e) => e.n || (e.n = bi.bind(e.proxy)),
    $watch: (e) => el.bind(e)
  })
), Tn = (e, t) => e !== X && !e.__isScriptSetup && q(e, t), gl = {
  get({ _: e }, t) {
    if (t === "__v_skip")
      return !0;
    const { ctx: n, setupState: s, data: i, props: o, accessCache: l, type: r, appContext: u } = e;
    if (t[0] !== "$") {
      const A = l[t];
      if (A !== void 0)
        switch (A) {
          case 1:
            return s[t];
          case 2:
            return i[t];
          case 4:
            return n[t];
          case 3:
            return o[t];
        }
      else {
        if (Tn(s, t))
          return l[t] = 1, s[t];
        if (i !== X && q(i, t))
          return l[t] = 2, i[t];
        if (q(o, t))
          return l[t] = 3, o[t];
        if (n !== X && q(n, t))
          return l[t] = 4, n[t];
        Nn && (l[t] = 0);
      }
    }
    const p = $t[t];
    let d, v;
    if (p)
      return t === "$attrs" && fe(e.attrs, "get", ""), p(e);
    if (
      // css module (injected by vue-loader)
      (d = r.__cssModules) && (d = d[t])
    )
      return d;
    if (n !== X && q(n, t))
      return l[t] = 4, n[t];
    if (
      // global properties
      v = u.config.globalProperties, q(v, t)
    )
      return v[t];
  },
  set({ _: e }, t, n) {
    const { data: s, setupState: i, ctx: o } = e;
    return Tn(i, t) ? (i[t] = n, !0) : s !== X && q(s, t) ? (s[t] = n, !0) : q(e.props, t) || t[0] === "$" && t.slice(1) in e ? !1 : (o[t] = n, !0);
  },
  has({
    _: { data: e, setupState: t, accessCache: n, ctx: s, appContext: i, props: o, type: l }
  }, r) {
    let u;
    return !!(n[r] || e !== X && r[0] !== "$" && q(e, r) || Tn(t, r) || q(o, r) || q(s, r) || q($t, r) || q(i.config.globalProperties, r) || (u = l.__cssModules) && u[r]);
  },
  defineProperty(e, t, n) {
    return n.get != null ? e._.accessCache[t] = 0 : q(n, "value") && this.set(e, t, n.value, null), Reflect.defineProperty(e, t, n);
  }
};
function xs(e) {
  return k(e) ? e.reduce(
    (t, n) => (t[n] = null, t),
    {}
  ) : e;
}
let Nn = !0;
function vl(e) {
  const t = Fi(e), n = e.proxy, s = e.ctx;
  Nn = !1, t.beforeCreate && Ss(t.beforeCreate, e, "bc");
  const {
    // state
    data: i,
    computed: o,
    methods: l,
    watch: r,
    provide: u,
    inject: p,
    // lifecycle
    created: d,
    beforeMount: v,
    mounted: A,
    beforeUpdate: E,
    updated: W,
    activated: F,
    deactivated: te,
    beforeDestroy: Q,
    beforeUnmount: j,
    destroyed: U,
    unmounted: O,
    render: se,
    renderTracked: Te,
    renderTriggered: Se,
    errorCaptured: Oe,
    serverPrefetch: ht,
    // public API
    expose: Le,
    inheritAttrs: rt,
    // assets
    components: gt,
    directives: S,
    filters: Tt
  } = t;
  if (p && ml(p, s, null), l)
    for (const z in l) {
      const G = l[z];
      V(G) && (s[z] = G.bind(n));
    }
  if (i) {
    const z = i.call(n, n);
    J(z) && (e.data = /* @__PURE__ */ ts(z));
  }
  if (Nn = !0, o)
    for (const z in o) {
      const G = o[z], H = V(G) ? G.bind(n, n) : V(G.get) ? G.get.bind(n, n) : Be, _e = !V(G) && V(G.set) ? G.set.bind(n) : Be, ue = Ae({
        get: H,
        set: _e
      });
      Object.defineProperty(s, z, {
        enumerable: !0,
        configurable: !0,
        get: () => ue.value,
        set: (ye) => ue.value = ye
      });
    }
  if (r)
    for (const z in r)
      Li(r[z], s, n, z);
  if (u) {
    const z = V(u) ? u.call(n) : u;
    Reflect.ownKeys(z).forEach((G) => {
      Xo(G, z[G]);
    });
  }
  d && Ss(d, e, "c");
  function le(z, G) {
    k(G) ? G.forEach((H) => z(H.bind(n))) : G && z(G.bind(n));
  }
  if (le(rl, v), le(Pi, A), le(al, E), le(cl, W), le(il, F), le(ol, te), le(pl, Oe), le(dl, Te), le(fl, Se), le(Ii, j), le(Oi, O), le(ul, ht), k(Le))
    if (Le.length) {
      const z = e.exposed || (e.exposed = {});
      Le.forEach((G) => {
        Object.defineProperty(z, G, {
          get: () => n[G],
          set: (H) => n[G] = H,
          enumerable: !0
        });
      });
    } else e.exposed || (e.exposed = {});
  se && e.render === Be && (e.render = se), rt != null && (e.inheritAttrs = rt), gt && (e.components = gt), S && (e.directives = S), ht && Ri(e);
}
function ml(e, t, n = Be) {
  k(e) && (e = $n(e));
  for (const s in e) {
    const i = e[s];
    let o;
    J(i) ? "default" in i ? o = en(
      i.from || s,
      i.default,
      !0
    ) : o = en(i.from || s) : o = en(i), /* @__PURE__ */ de(o) ? Object.defineProperty(t, s, {
      enumerable: !0,
      configurable: !0,
      get: () => o.value,
      set: (l) => o.value = l
    }) : t[s] = o;
  }
}
function Ss(e, t, n) {
  Ue(
    k(e) ? e.map((s) => s.bind(t.proxy)) : e.bind(t.proxy),
    t,
    n
  );
}
function Li(e, t, n, s) {
  let i = s.includes(".") ? Ti(n, s) : () => n[s];
  if (ne(e)) {
    const o = t[e];
    V(o) && tn(i, o);
  } else if (V(e))
    tn(i, e.bind(n));
  else if (J(e))
    if (k(e))
      e.forEach((o) => Li(o, t, n, s));
    else {
      const o = V(e.handler) ? e.handler.bind(n) : t[e.handler];
      V(o) && tn(i, o, e);
    }
}
function Fi(e) {
  const t = e.type, { mixins: n, extends: s } = t, {
    mixins: i,
    optionsCache: o,
    config: { optionMergeStrategies: l }
  } = e.appContext, r = o.get(t);
  let u;
  return r ? u = r : !i.length && !n && !s ? u = t : (u = {}, i.length && i.forEach(
    (p) => an(u, p, l, !0)
  ), an(u, t, l)), J(t) && o.set(t, u), u;
}
function an(e, t, n, s = !1) {
  const { mixins: i, extends: o } = t;
  o && an(e, o, n, !0), i && i.forEach(
    (l) => an(e, l, n, !0)
  );
  for (const l in t)
    if (!(s && l === "expose")) {
      const r = _l[l] || n && n[l];
      e[l] = r ? r(e[l], t[l]) : t[l];
    }
  return e;
}
const _l = {
  data: ws,
  props: Ms,
  emits: Ms,
  // objects
  methods: Ot,
  computed: Ot,
  // lifecycle
  beforeCreate: he,
  created: he,
  beforeMount: he,
  mounted: he,
  beforeUpdate: he,
  updated: he,
  beforeDestroy: he,
  beforeUnmount: he,
  destroyed: he,
  unmounted: he,
  activated: he,
  deactivated: he,
  errorCaptured: he,
  serverPrefetch: he,
  // assets
  components: Ot,
  directives: Ot,
  // watch
  watch: bl,
  // provide / inject
  provide: ws,
  inject: yl
};
function ws(e, t) {
  return t ? e ? function() {
    return pe(
      V(e) ? e.call(this, this) : e,
      V(t) ? t.call(this, this) : t
    );
  } : t : e;
}
function yl(e, t) {
  return Ot($n(e), $n(t));
}
function $n(e) {
  if (k(e)) {
    const t = {};
    for (let n = 0; n < e.length; n++)
      t[e[n]] = e[n];
    return t;
  }
  return e;
}
function he(e, t) {
  return e ? [...new Set([].concat(e, t))] : t;
}
function Ot(e, t) {
  return e ? pe(/* @__PURE__ */ Object.create(null), e, t) : t;
}
function Ms(e, t) {
  return e ? k(e) && k(t) ? [.../* @__PURE__ */ new Set([...e, ...t])] : pe(
    /* @__PURE__ */ Object.create(null),
    xs(e),
    xs(t ?? {})
  ) : t;
}
function bl(e, t) {
  if (!e) return t;
  if (!t) return e;
  const n = pe(/* @__PURE__ */ Object.create(null), e);
  for (const s in t)
    n[s] = he(e[s], t[s]);
  return n;
}
function ki() {
  return {
    app: null,
    config: {
      isNativeTag: Js,
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
let xl = 0;
function Sl(e, t) {
  return function(s, i = null) {
    V(s) || (s = pe({}, s)), i != null && !J(i) && (i = null);
    const o = ki(), l = /* @__PURE__ */ new WeakSet(), r = [];
    let u = !1;
    const p = o.app = {
      _uid: xl++,
      _component: s,
      _props: i,
      _container: null,
      _context: o,
      _instance: null,
      version: nr,
      get config() {
        return o.config;
      },
      set config(d) {
      },
      use(d, ...v) {
        return l.has(d) || (d && V(d.install) ? (l.add(d), d.install(p, ...v)) : V(d) && (l.add(d), d(p, ...v))), p;
      },
      mixin(d) {
        return o.mixins.includes(d) || o.mixins.push(d), p;
      },
      component(d, v) {
        return v ? (o.components[d] = v, p) : o.components[d];
      },
      directive(d, v) {
        return v ? (o.directives[d] = v, p) : o.directives[d];
      },
      mount(d, v, A) {
        if (!u) {
          const E = p._ceVNode || Ye(s, i);
          return E.appContext = o, A === !0 ? A = "svg" : A === !1 && (A = void 0), e(E, d, A), u = !0, p._container = d, d.__vue_app__ = p, yn(E.component);
        }
      },
      onUnmount(d) {
        r.push(d);
      },
      unmount() {
        u && (Ue(
          r,
          p._instance,
          16
        ), e(null, p._container), delete p._container.__vue_app__);
      },
      provide(d, v) {
        return o.provides[d] = v, p;
      },
      runWithContext(d) {
        const v = wt;
        wt = p;
        try {
          return d();
        } finally {
          wt = v;
        }
      }
    };
    return p;
  };
}
let wt = null;
const wl = (e, t) => t === "modelValue" || t === "model-value" ? e.modelModifiers : e[`${t}Modifiers`] || e[`${Ee(t)}Modifiers`] || e[`${pt(t)}Modifiers`];
function Ml(e, t, ...n) {
  if (e.isUnmounted) return;
  const s = e.vnode.props || X;
  let i = n;
  const o = t.startsWith("update:"), l = o && wl(s, t.slice(7));
  l && (l.trim && (i = n.map((d) => ne(d) ? d.trim() : d)), l.number && (i = n.map(Jn)));
  let r, u = s[r = bn(t)] || // also try camelCase event handler (#2249)
  s[r = bn(Ee(t))];
  !u && o && (u = s[r = bn(pt(t))]), u && Ue(
    u,
    e,
    6,
    i
  );
  const p = s[r + "Once"];
  if (p) {
    if (!e.emitted)
      e.emitted = {};
    else if (e.emitted[r])
      return;
    e.emitted[r] = !0, Ue(
      p,
      e,
      6,
      i
    );
  }
}
const Cl = /* @__PURE__ */ new WeakMap();
function Vi(e, t, n = !1) {
  const s = n ? Cl : t.emitsCache, i = s.get(e);
  if (i !== void 0)
    return i;
  const o = e.emits;
  let l = {}, r = !1;
  if (!V(e)) {
    const u = (p) => {
      const d = Vi(p, t, !0);
      d && (r = !0, pe(l, d));
    };
    !n && t.mixins.length && t.mixins.forEach(u), e.extends && u(e.extends), e.mixins && e.mixins.forEach(u);
  }
  return !o && !r ? (J(e) && s.set(e, null), null) : (k(o) ? o.forEach((u) => l[u] = null) : pe(l, o), J(e) && s.set(e, l), l);
}
function mn(e, t) {
  return !e || !un(t) ? !1 : (t = t.slice(2).replace(/Once$/, ""), q(e, t[0].toLowerCase() + t.slice(1)) || q(e, pt(t)) || q(e, t));
}
function Cs(e) {
  const {
    type: t,
    vnode: n,
    proxy: s,
    withProxy: i,
    propsOptions: [o],
    slots: l,
    attrs: r,
    emit: u,
    render: p,
    renderCache: d,
    props: v,
    data: A,
    setupState: E,
    ctx: W,
    inheritAttrs: F
  } = e, te = ln(e);
  let Q, j;
  try {
    if (n.shapeFlag & 4) {
      const O = i || s, se = O;
      Q = je(
        p.call(
          se,
          O,
          d,
          v,
          E,
          A,
          W
        )
      ), j = r;
    } else {
      const O = t;
      Q = je(
        O.length > 1 ? O(
          v,
          { attrs: r, slots: l, emit: u }
        ) : O(
          v,
          null
        )
      ), j = t.props ? r : Tl(r);
    }
  } catch (O) {
    jt.length = 0, gn(O, e, 1), Q = Ye(lt);
  }
  let U = Q;
  if (j && F !== !1) {
    const O = Object.keys(j), { shapeFlag: se } = U;
    O.length && se & 7 && (o && O.some(fn) && (j = Rl(
      j,
      o
    )), U = Ct(U, j, !1, !0));
  }
  return n.dirs && (U = Ct(U, null, !1, !0), U.dirs = U.dirs ? U.dirs.concat(n.dirs) : n.dirs), n.transition && os(U, n.transition), Q = U, ln(te), Q;
}
const Tl = (e) => {
  let t;
  for (const n in e)
    (n === "class" || n === "style" || un(n)) && ((t || (t = {}))[n] = e[n]);
  return t;
}, Rl = (e, t) => {
  const n = {};
  for (const s in e)
    (!fn(s) || !(s.slice(9) in t)) && (n[s] = e[s]);
  return n;
};
function Al(e, t, n) {
  const { props: s, children: i, component: o } = e, { props: l, children: r, patchFlag: u } = t, p = o.emitsOptions;
  if (t.dirs || t.transition)
    return !0;
  if (n && u >= 0) {
    if (u & 1024)
      return !0;
    if (u & 16)
      return s ? Ts(s, l, p) : !!l;
    if (u & 8) {
      const d = t.dynamicProps;
      for (let v = 0; v < d.length; v++) {
        const A = d[v];
        if (Di(l, s, A) && !mn(p, A))
          return !0;
      }
    }
  } else
    return (i || r) && (!r || !r.$stable) ? !0 : s === l ? !1 : s ? l ? Ts(s, l, p) : !0 : !!l;
  return !1;
}
function Ts(e, t, n) {
  const s = Object.keys(t);
  if (s.length !== Object.keys(e).length)
    return !0;
  for (let i = 0; i < s.length; i++) {
    const o = s[i];
    if (Di(t, e, o) && !mn(n, o))
      return !0;
  }
  return !1;
}
function Di(e, t, n) {
  const s = e[n], i = t[n];
  return n === "style" && J(s) && J(i) ? !zn(s, i) : s !== i;
}
function El({ vnode: e, parent: t, suspense: n }, s) {
  for (; t; ) {
    const i = t.subTree;
    if (i.suspense && i.suspense.activeBranch === e && (i.suspense.vnode.el = i.el = s, e = i), i === e)
      (e = t.vnode).el = s, t = t.parent;
    else
      break;
  }
  n && n.activeBranch === e && (n.vnode.el = s);
}
const Ni = {}, $i = () => Object.create(Ni), ji = (e) => Object.getPrototypeOf(e) === Ni;
function Pl(e, t, n, s = !1) {
  const i = {}, o = $i();
  e.propsDefaults = /* @__PURE__ */ Object.create(null), Hi(e, t, i, o);
  for (const l in e.propsOptions[0])
    l in i || (i[l] = void 0);
  n ? e.props = s ? i : /* @__PURE__ */ Vo(i) : e.type.props ? e.props = i : e.props = o, e.attrs = o;
}
function Il(e, t, n, s) {
  const {
    props: i,
    attrs: o,
    vnode: { patchFlag: l }
  } = e, r = /* @__PURE__ */ K(i), [u] = e.propsOptions;
  let p = !1;
  if (
    // always force full diff in dev
    // - #1942 if hmr is enabled with sfc component
    // - vite#872 non-sfc component used by sfc component
    (s || l > 0) && !(l & 16)
  ) {
    if (l & 8) {
      const d = e.vnode.dynamicProps;
      for (let v = 0; v < d.length; v++) {
        let A = d[v];
        if (mn(e.emitsOptions, A))
          continue;
        const E = t[A];
        if (u)
          if (q(o, A))
            E !== o[A] && (o[A] = E, p = !0);
          else {
            const W = Ee(A);
            i[W] = jn(
              u,
              r,
              W,
              E,
              e,
              !1
            );
          }
        else
          E !== o[A] && (o[A] = E, p = !0);
      }
    }
  } else {
    Hi(e, t, i, o) && (p = !0);
    let d;
    for (const v in r)
      (!t || // for camelCase
      !q(t, v) && // it's possible the original props was passed in as kebab-case
      // and converted to camelCase (#955)
      ((d = pt(v)) === v || !q(t, d))) && (u ? n && // for camelCase
      (n[v] !== void 0 || // for kebab-case
      n[d] !== void 0) && (i[v] = jn(
        u,
        r,
        v,
        void 0,
        e,
        !0
      )) : delete i[v]);
    if (o !== r)
      for (const v in o)
        (!t || !q(t, v)) && (delete o[v], p = !0);
  }
  p && Je(e.attrs, "set", "");
}
function Hi(e, t, n, s) {
  const [i, o] = e.propsOptions;
  let l = !1, r;
  if (t)
    for (let u in t) {
      if (Ft(u))
        continue;
      const p = t[u];
      let d;
      i && q(i, d = Ee(u)) ? !o || !o.includes(d) ? n[d] = p : (r || (r = {}))[d] = p : mn(e.emitsOptions, u) || (!(u in s) || p !== s[u]) && (s[u] = p, l = !0);
    }
  if (o) {
    const u = /* @__PURE__ */ K(n), p = r || X;
    for (let d = 0; d < o.length; d++) {
      const v = o[d];
      n[v] = jn(
        i,
        u,
        v,
        p[v],
        e,
        !q(p, v)
      );
    }
  }
  return l;
}
function jn(e, t, n, s, i, o) {
  const l = e[n];
  if (l != null) {
    const r = q(l, "default");
    if (r && s === void 0) {
      const u = l.default;
      if (l.type !== Function && !l.skipFactory && V(u)) {
        const { propsDefaults: p } = i;
        if (n in p)
          s = p[n];
        else {
          const d = Jt(i);
          s = p[n] = u.call(
            null,
            t
          ), d();
        }
      } else
        s = u;
      i.ce && i.ce._setProp(n, s);
    }
    l[
      0
      /* shouldCast */
    ] && (o && !r ? s = !1 : l[
      1
      /* shouldCastTrue */
    ] && (s === "" || s === pt(n)) && (s = !0));
  }
  return s;
}
const Ol = /* @__PURE__ */ new WeakMap();
function Bi(e, t, n = !1) {
  const s = n ? Ol : t.propsCache, i = s.get(e);
  if (i)
    return i;
  const o = e.props, l = {}, r = [];
  let u = !1;
  if (!V(e)) {
    const d = (v) => {
      u = !0;
      const [A, E] = Bi(v, t, !0);
      pe(l, A), E && r.push(...E);
    };
    !n && t.mixins.length && t.mixins.forEach(d), e.extends && d(e.extends), e.mixins && e.mixins.forEach(d);
  }
  if (!o && !u)
    return J(e) && s.set(e, yt), yt;
  if (k(o))
    for (let d = 0; d < o.length; d++) {
      const v = Ee(o[d]);
      Rs(v) && (l[v] = X);
    }
  else if (o)
    for (const d in o) {
      const v = Ee(d);
      if (Rs(v)) {
        const A = o[d], E = l[v] = k(A) || V(A) ? { type: A } : pe({}, A), W = E.type;
        let F = !1, te = !0;
        if (k(W))
          for (let Q = 0; Q < W.length; ++Q) {
            const j = W[Q], U = V(j) && j.name;
            if (U === "Boolean") {
              F = !0;
              break;
            } else U === "String" && (te = !1);
          }
        else
          F = V(W) && W.name === "Boolean";
        E[
          0
          /* shouldCast */
        ] = F, E[
          1
          /* shouldCastTrue */
        ] = te, (F || q(E, "default")) && r.push(v);
      }
    }
  const p = [l, r];
  return J(e) && s.set(e, p), p;
}
function Rs(e) {
  return e[0] !== "$" && !Ft(e);
}
const ls = (e) => e === "_" || e === "_ctx" || e === "$stable", rs = (e) => k(e) ? e.map(je) : [je(e)], Ll = (e, t, n) => {
  if (t._n)
    return t;
  const s = zo((...i) => rs(t(...i)), n);
  return s._c = !1, s;
}, Wi = (e, t, n) => {
  const s = e._ctx;
  for (const i in e) {
    if (ls(i)) continue;
    const o = e[i];
    if (V(o))
      t[i] = Ll(i, o, s);
    else if (o != null) {
      const l = rs(o);
      t[i] = () => l;
    }
  }
}, Ui = (e, t) => {
  const n = rs(t);
  e.slots.default = () => n;
}, Ki = (e, t, n) => {
  for (const s in t)
    (n || !ls(s)) && (e[s] = t[s]);
}, Fl = (e, t, n) => {
  const s = e.slots = $i();
  if (e.vnode.shapeFlag & 32) {
    const i = t._;
    i ? (Ki(s, t, n), n && ei(s, "_", i, !0)) : Wi(t, s);
  } else t && Ui(e, t);
}, kl = (e, t, n) => {
  const { vnode: s, slots: i } = e;
  let o = !0, l = X;
  if (s.shapeFlag & 32) {
    const r = t._;
    r ? n && r === 1 ? o = !1 : Ki(i, t, n) : (o = !t.$stable, Wi(t, i)), l = t;
  } else t && (Ui(e, t), l = { default: 1 });
  if (o)
    for (const r in i)
      !ls(r) && l[r] == null && delete i[r];
}, me = jl;
function Vl(e) {
  return Dl(e);
}
function Dl(e, t) {
  const n = pn();
  n.__VUE__ = !0;
  const {
    insert: s,
    remove: i,
    patchProp: o,
    createElement: l,
    createText: r,
    createComment: u,
    setText: p,
    setElementText: d,
    parentNode: v,
    nextSibling: A,
    setScopeId: E = Be,
    insertStaticContent: W
  } = e, F = (c, f, h, x = null, _ = null, y = null, T = void 0, C = null, M = !!f.dynamicChildren) => {
    if (c === f)
      return;
    c && !Pt(c, f) && (x = st(c), ye(c, _, y, !0), c = null), f.patchFlag === -2 && (M = !1, f.dynamicChildren = null);
    const { type: b, ref: I, shapeFlag: R } = f;
    switch (b) {
      case _n:
        te(c, f, h, x);
        break;
      case lt:
        Q(c, f, h, x);
        break;
      case An:
        c == null && j(f, h, x, T);
        break;
      case oe:
        gt(
          c,
          f,
          h,
          x,
          _,
          y,
          T,
          C,
          M
        );
        break;
      default:
        R & 1 ? se(
          c,
          f,
          h,
          x,
          _,
          y,
          T,
          C,
          M
        ) : R & 6 ? S(
          c,
          f,
          h,
          x,
          _,
          y,
          T,
          C,
          M
        ) : (R & 64 || R & 128) && b.process(
          c,
          f,
          h,
          x,
          _,
          y,
          T,
          C,
          M,
          Rt
        );
    }
    I != null && _ ? Dt(I, c && c.ref, y, f || c, !f) : I == null && c && c.ref != null && Dt(c.ref, null, y, c, !0);
  }, te = (c, f, h, x) => {
    if (c == null)
      s(
        f.el = r(f.children),
        h,
        x
      );
    else {
      const _ = f.el = c.el;
      f.children !== c.children && p(_, f.children);
    }
  }, Q = (c, f, h, x) => {
    c == null ? s(
      f.el = u(f.children || ""),
      h,
      x
    ) : f.el = c.el;
  }, j = (c, f, h, x) => {
    [c.el, c.anchor] = W(
      c.children,
      f,
      h,
      x,
      c.el,
      c.anchor
    );
  }, U = ({ el: c, anchor: f }, h, x) => {
    let _;
    for (; c && c !== f; )
      _ = A(c), s(c, h, x), c = _;
    s(f, h, x);
  }, O = ({ el: c, anchor: f }) => {
    let h;
    for (; c && c !== f; )
      h = A(c), i(c), c = h;
    i(f);
  }, se = (c, f, h, x, _, y, T, C, M) => {
    if (f.type === "svg" ? T = "svg" : f.type === "math" && (T = "mathml"), c == null)
      Te(
        f,
        h,
        x,
        _,
        y,
        T,
        C,
        M
      );
    else {
      const b = c.el && c.el._isVueCE ? c.el : null;
      try {
        b && b._beginPatch(), ht(
          c,
          f,
          _,
          y,
          T,
          C,
          M
        );
      } finally {
        b && b._endPatch();
      }
    }
  }, Te = (c, f, h, x, _, y, T, C) => {
    let M, b;
    const { props: I, shapeFlag: R, transition: P, dirs: L } = c;
    if (M = c.el = l(
      c.type,
      y,
      I && I.is,
      I
    ), R & 8 ? d(M, c.children) : R & 16 && Oe(
      c.children,
      M,
      null,
      x,
      _,
      Rn(c, y),
      T,
      C
    ), L && at(c, null, x, "created"), Se(M, c, c.scopeId, T, x), I) {
      for (const Y in I)
        Y !== "value" && !Ft(Y) && o(M, Y, null, I[Y], y, x);
      "value" in I && o(M, "value", null, I.value, y), (b = I.onVnodeBeforeMount) && De(b, x, c);
    }
    L && at(c, null, x, "beforeMount");
    const B = Nl(_, P);
    B && P.beforeEnter(M), s(M, f, h), ((b = I && I.onVnodeMounted) || B || L) && me(() => {
      b && De(b, x, c), B && P.enter(M), L && at(c, null, x, "mounted");
    }, _);
  }, Se = (c, f, h, x, _) => {
    if (h && E(c, h), x)
      for (let y = 0; y < x.length; y++)
        E(c, x[y]);
    if (_) {
      let y = _.subTree;
      if (f === y || zi(y.type) && (y.ssContent === f || y.ssFallback === f)) {
        const T = _.vnode;
        Se(
          c,
          T,
          T.scopeId,
          T.slotScopeIds,
          _.parent
        );
      }
    }
  }, Oe = (c, f, h, x, _, y, T, C, M = 0) => {
    for (let b = M; b < c.length; b++) {
      const I = c[b] = C ? Ge(c[b]) : je(c[b]);
      F(
        null,
        I,
        f,
        h,
        x,
        _,
        y,
        T,
        C
      );
    }
  }, ht = (c, f, h, x, _, y, T) => {
    const C = f.el = c.el;
    let { patchFlag: M, dynamicChildren: b, dirs: I } = f;
    M |= c.patchFlag & 16;
    const R = c.props || X, P = f.props || X;
    let L;
    if (h && ct(h, !1), (L = P.onVnodeBeforeUpdate) && De(L, h, f, c), I && at(f, c, h, "beforeUpdate"), h && ct(h, !0), (R.innerHTML && P.innerHTML == null || R.textContent && P.textContent == null) && d(C, ""), b ? Le(
      c.dynamicChildren,
      b,
      C,
      h,
      x,
      Rn(f, _),
      y
    ) : T || G(
      c,
      f,
      C,
      null,
      h,
      x,
      Rn(f, _),
      y,
      !1
    ), M > 0) {
      if (M & 16)
        rt(C, R, P, h, _);
      else if (M & 2 && R.class !== P.class && o(C, "class", null, P.class, _), M & 4 && o(C, "style", R.style, P.style, _), M & 8) {
        const B = f.dynamicProps;
        for (let Y = 0; Y < B.length; Y++) {
          const Z = B[Y], ie = R[Z], ae = P[Z];
          (ae !== ie || Z === "value") && o(C, Z, ie, ae, _, h);
        }
      }
      M & 1 && c.children !== f.children && d(C, f.children);
    } else !T && b == null && rt(C, R, P, h, _);
    ((L = P.onVnodeUpdated) || I) && me(() => {
      L && De(L, h, f, c), I && at(f, c, h, "updated");
    }, x);
  }, Le = (c, f, h, x, _, y, T) => {
    for (let C = 0; C < f.length; C++) {
      const M = c[C], b = f[C], I = (
        // oldVNode may be an errored async setup() component inside Suspense
        // which will not have a mounted element
        M.el && // - In the case of a Fragment, we need to provide the actual parent
        // of the Fragment itself so it can move its children.
        (M.type === oe || // - In the case of different nodes, there is going to be a replacement
        // which also requires the correct parent container
        !Pt(M, b) || // - In the case of a component, it could contain anything.
        M.shapeFlag & 198) ? v(M.el) : (
          // In other cases, the parent container is not actually used so we
          // just pass the block element here to avoid a DOM parentNode call.
          h
        )
      );
      F(
        M,
        b,
        I,
        null,
        x,
        _,
        y,
        T,
        !0
      );
    }
  }, rt = (c, f, h, x, _) => {
    if (f !== h) {
      if (f !== X)
        for (const y in f)
          !Ft(y) && !(y in h) && o(
            c,
            y,
            f[y],
            null,
            _,
            x
          );
      for (const y in h) {
        if (Ft(y)) continue;
        const T = h[y], C = f[y];
        T !== C && y !== "value" && o(c, y, C, T, _, x);
      }
      "value" in h && o(c, "value", f.value, h.value, _);
    }
  }, gt = (c, f, h, x, _, y, T, C, M) => {
    const b = f.el = c ? c.el : r(""), I = f.anchor = c ? c.anchor : r("");
    let { patchFlag: R, dynamicChildren: P, slotScopeIds: L } = f;
    L && (C = C ? C.concat(L) : L), c == null ? (s(b, h, x), s(I, h, x), Oe(
      // #10007
      // such fragment like `<></>` will be compiled into
      // a fragment which doesn't have a children.
      // In this case fallback to an empty array
      f.children || [],
      h,
      I,
      _,
      y,
      T,
      C,
      M
    )) : R > 0 && R & 64 && P && // #2715 the previous fragment could've been a BAILed one as a result
    // of renderSlot() with no valid children
    c.dynamicChildren && c.dynamicChildren.length === P.length ? (Le(
      c.dynamicChildren,
      P,
      h,
      _,
      y,
      T,
      C
    ), // #2080 if the stable fragment has a key, it's a <template v-for> that may
    //  get moved around. Make sure all root level vnodes inherit el.
    // #2134 or if it's a component root, it may also get moved around
    // as the component is being moved.
    (f.key != null || _ && f === _.subTree) && qi(
      c,
      f,
      !0
      /* shallow */
    )) : G(
      c,
      f,
      h,
      I,
      _,
      y,
      T,
      C,
      M
    );
  }, S = (c, f, h, x, _, y, T, C, M) => {
    f.slotScopeIds = C, c == null ? f.shapeFlag & 512 ? _.ctx.activate(
      f,
      h,
      x,
      T,
      M
    ) : Tt(
      f,
      h,
      x,
      _,
      y,
      T,
      M
    ) : nt(c, f, M);
  }, Tt = (c, f, h, x, _, y, T) => {
    const C = c.component = zl(
      c,
      x,
      _
    );
    if (Ai(c) && (C.ctx.renderer = Rt), Xl(C, !1, T), C.asyncDep) {
      if (_ && _.registerDep(C, le, T), !c.el) {
        const M = C.subTree = Ye(lt);
        Q(null, M, f, h), c.placeholder = M.el;
      }
    } else
      le(
        C,
        c,
        f,
        h,
        _,
        y,
        T
      );
  }, nt = (c, f, h) => {
    const x = f.component = c.component;
    if (Al(c, f, h))
      if (x.asyncDep && !x.asyncResolved) {
        z(x, f, h);
        return;
      } else
        x.next = f, x.update();
    else
      f.el = c.el, x.vnode = f;
  }, le = (c, f, h, x, _, y, T) => {
    const C = () => {
      if (c.isMounted) {
        let { next: R, bu: P, u: L, parent: B, vnode: Y } = c;
        {
          const ke = Gi(c);
          if (ke) {
            R && (R.el = Y.el, z(c, R, T)), ke.asyncDep.then(() => {
              me(() => {
                c.isUnmounted || b();
              }, _);
            });
            return;
          }
        }
        let Z = R, ie;
        ct(c, !1), R ? (R.el = Y.el, z(c, R, T)) : R = Y, P && Zt(P), (ie = R.props && R.props.onVnodeBeforeUpdate) && De(ie, B, R, Y), ct(c, !0);
        const ae = Cs(c), Fe = c.subTree;
        c.subTree = ae, F(
          Fe,
          ae,
          // parent may have changed if it's in a teleport
          v(Fe.el),
          // anchor may have changed if it's in a fragment
          st(Fe),
          c,
          _,
          y
        ), R.el = ae.el, Z === null && El(c, ae.el), L && me(L, _), (ie = R.props && R.props.onVnodeUpdated) && me(
          () => De(ie, B, R, Y),
          _
        );
      } else {
        let R;
        const { el: P, props: L } = f, { bm: B, m: Y, parent: Z, root: ie, type: ae } = c, Fe = Nt(f);
        ct(c, !1), B && Zt(B), !Fe && (R = L && L.onVnodeBeforeMount) && De(R, Z, f), ct(c, !0);
        {
          ie.ce && ie.ce._hasShadowRoot() && ie.ce._injectChildStyle(
            ae,
            c.parent ? c.parent.type : void 0
          );
          const ke = c.subTree = Cs(c);
          F(
            null,
            ke,
            h,
            x,
            c,
            _,
            y
          ), f.el = ke.el;
        }
        if (Y && me(Y, _), !Fe && (R = L && L.onVnodeMounted)) {
          const ke = f;
          me(
            () => De(R, Z, ke),
            _
          );
        }
        (f.shapeFlag & 256 || Z && Nt(Z.vnode) && Z.vnode.shapeFlag & 256) && c.a && me(c.a, _), c.isMounted = !0, f = h = x = null;
      }
    };
    c.scope.on();
    const M = c.effect = new ii(C);
    c.scope.off();
    const b = c.update = M.run.bind(M), I = c.job = M.runIfDirty.bind(M);
    I.i = c, I.id = c.uid, M.scheduler = () => is(I), ct(c, !0), b();
  }, z = (c, f, h) => {
    f.component = c;
    const x = c.vnode.props;
    c.vnode = f, c.next = null, Il(c, f.props, x, h), kl(c, f.children, h), Xe(), _s(c), Qe();
  }, G = (c, f, h, x, _, y, T, C, M = !1) => {
    const b = c && c.children, I = c ? c.shapeFlag : 0, R = f.children, { patchFlag: P, shapeFlag: L } = f;
    if (P > 0) {
      if (P & 128) {
        _e(
          b,
          R,
          h,
          x,
          _,
          y,
          T,
          C,
          M
        );
        return;
      } else if (P & 256) {
        H(
          b,
          R,
          h,
          x,
          _,
          y,
          T,
          C,
          M
        );
        return;
      }
    }
    L & 8 ? (I & 16 && m(b, _, y), R !== b && d(h, R)) : I & 16 ? L & 16 ? _e(
      b,
      R,
      h,
      x,
      _,
      y,
      T,
      C,
      M
    ) : m(b, _, y, !0) : (I & 8 && d(h, ""), L & 16 && Oe(
      R,
      h,
      x,
      _,
      y,
      T,
      C,
      M
    ));
  }, H = (c, f, h, x, _, y, T, C, M) => {
    c = c || yt, f = f || yt;
    const b = c.length, I = f.length, R = Math.min(b, I);
    let P;
    for (P = 0; P < R; P++) {
      const L = f[P] = M ? Ge(f[P]) : je(f[P]);
      F(
        c[P],
        L,
        h,
        null,
        _,
        y,
        T,
        C,
        M
      );
    }
    b > I ? m(
      c,
      _,
      y,
      !0,
      !1,
      R
    ) : Oe(
      f,
      h,
      x,
      _,
      y,
      T,
      C,
      M,
      R
    );
  }, _e = (c, f, h, x, _, y, T, C, M) => {
    let b = 0;
    const I = f.length;
    let R = c.length - 1, P = I - 1;
    for (; b <= R && b <= P; ) {
      const L = c[b], B = f[b] = M ? Ge(f[b]) : je(f[b]);
      if (Pt(L, B))
        F(
          L,
          B,
          h,
          null,
          _,
          y,
          T,
          C,
          M
        );
      else
        break;
      b++;
    }
    for (; b <= R && b <= P; ) {
      const L = c[R], B = f[P] = M ? Ge(f[P]) : je(f[P]);
      if (Pt(L, B))
        F(
          L,
          B,
          h,
          null,
          _,
          y,
          T,
          C,
          M
        );
      else
        break;
      R--, P--;
    }
    if (b > R) {
      if (b <= P) {
        const L = P + 1, B = L < I ? f[L].el : x;
        for (; b <= P; )
          F(
            null,
            f[b] = M ? Ge(f[b]) : je(f[b]),
            h,
            B,
            _,
            y,
            T,
            C,
            M
          ), b++;
      }
    } else if (b > P)
      for (; b <= R; )
        ye(c[b], _, y, !0), b++;
    else {
      const L = b, B = b, Y = /* @__PURE__ */ new Map();
      for (b = B; b <= P; b++) {
        const be = f[b] = M ? Ge(f[b]) : je(f[b]);
        be.key != null && Y.set(be.key, b);
      }
      let Z, ie = 0;
      const ae = P - B + 1;
      let Fe = !1, ke = 0;
      const At = new Array(ae);
      for (b = 0; b < ae; b++) At[b] = 0;
      for (b = L; b <= R; b++) {
        const be = c[b];
        if (ie >= ae) {
          ye(be, _, y, !0);
          continue;
        }
        let Ve;
        if (be.key != null)
          Ve = Y.get(be.key);
        else
          for (Z = B; Z <= P; Z++)
            if (At[Z - B] === 0 && Pt(be, f[Z])) {
              Ve = Z;
              break;
            }
        Ve === void 0 ? ye(be, _, y, !0) : (At[Ve - B] = b + 1, Ve >= ke ? ke = Ve : Fe = !0, F(
          be,
          f[Ve],
          h,
          null,
          _,
          y,
          T,
          C,
          M
        ), ie++);
      }
      const fs = Fe ? $l(At) : yt;
      for (Z = fs.length - 1, b = ae - 1; b >= 0; b--) {
        const be = B + b, Ve = f[be], ds = f[be + 1], ps = be + 1 < I ? (
          // #13559, #14173 fallback to el placeholder for unresolved async component
          ds.el || Ji(ds)
        ) : x;
        At[b] === 0 ? F(
          null,
          Ve,
          h,
          ps,
          _,
          y,
          T,
          C,
          M
        ) : Fe && (Z < 0 || b !== fs[Z] ? ue(Ve, h, ps, 2) : Z--);
      }
    }
  }, ue = (c, f, h, x, _ = null) => {
    const { el: y, type: T, transition: C, children: M, shapeFlag: b } = c;
    if (b & 6) {
      ue(c.component.subTree, f, h, x);
      return;
    }
    if (b & 128) {
      c.suspense.move(f, h, x);
      return;
    }
    if (b & 64) {
      T.move(c, f, h, Rt);
      return;
    }
    if (T === oe) {
      s(y, f, h);
      for (let R = 0; R < M.length; R++)
        ue(M[R], f, h, x);
      s(c.anchor, f, h);
      return;
    }
    if (T === An) {
      U(c, f, h);
      return;
    }
    if (x !== 2 && b & 1 && C)
      if (x === 0)
        C.beforeEnter(y), s(y, f, h), me(() => C.enter(y), _);
      else {
        const { leave: R, delayLeave: P, afterLeave: L } = C, B = () => {
          c.ctx.isUnmounted ? i(y) : s(y, f, h);
        }, Y = () => {
          y._isLeaving && y[sl](
            !0
            /* cancelled */
          ), R(y, () => {
            B(), L && L();
          });
        };
        P ? P(y, B, Y) : Y();
      }
    else
      s(y, f, h);
  }, ye = (c, f, h, x = !1, _ = !1) => {
    const {
      type: y,
      props: T,
      ref: C,
      children: M,
      dynamicChildren: b,
      shapeFlag: I,
      patchFlag: R,
      dirs: P,
      cacheIndex: L,
      memo: B
    } = c;
    if (R === -2 && (_ = !1), C != null && (Xe(), Dt(C, null, h, c, !0), Qe()), L != null && (f.renderCache[L] = void 0), I & 256) {
      f.ctx.deactivate(c);
      return;
    }
    const Y = I & 1 && P, Z = !Nt(c);
    let ie;
    if (Z && (ie = T && T.onVnodeBeforeUnmount) && De(ie, f, c), I & 6)
      w(c.component, h, x);
    else {
      if (I & 128) {
        c.suspense.unmount(h, x);
        return;
      }
      Y && at(c, null, f, "beforeUnmount"), I & 64 ? c.type.remove(
        c,
        f,
        h,
        Rt,
        x
      ) : b && // #5154
      // when v-once is used inside a block, setBlockTracking(-1) marks the
      // parent block with hasOnce: true
      // so that it doesn't take the fast path during unmount - otherwise
      // components nested in v-once are never unmounted.
      !b.hasOnce && // #1153: fast path should not be taken for non-stable (v-for) fragments
      (y !== oe || R > 0 && R & 64) ? m(
        b,
        f,
        h,
        !1,
        !0
      ) : (y === oe && R & 384 || !_ && I & 16) && m(M, f, h), x && we(c);
    }
    const ae = B != null && L == null;
    (Z && (ie = T && T.onVnodeUnmounted) || Y || ae) && me(() => {
      ie && De(ie, f, c), Y && at(c, null, f, "unmounted"), ae && (c.el = null);
    }, h);
  }, we = (c) => {
    const { type: f, el: h, anchor: x, transition: _ } = c;
    if (f === oe) {
      D(h, x);
      return;
    }
    if (f === An) {
      O(c);
      return;
    }
    const y = () => {
      i(h), _ && !_.persisted && _.afterLeave && _.afterLeave();
    };
    if (c.shapeFlag & 1 && _ && !_.persisted) {
      const { leave: T, delayLeave: C } = _, M = () => T(h, y);
      C ? C(c.el, y, M) : M();
    } else
      y();
  }, D = (c, f) => {
    let h;
    for (; c !== f; )
      h = A(c), i(c), c = h;
    i(f);
  }, w = (c, f, h) => {
    const { bum: x, scope: _, job: y, subTree: T, um: C, m: M, a: b } = c;
    As(M), As(b), x && Zt(x), _.stop(), y && (y.flags |= 8, ye(T, c, f, h)), C && me(C, f), me(() => {
      c.isUnmounted = !0;
    }, f);
  }, m = (c, f, h, x = !1, _ = !1, y = 0) => {
    for (let T = y; T < c.length; T++)
      ye(c[T], f, h, x, _);
  }, st = (c) => {
    if (c.shapeFlag & 6)
      return st(c.component.subTree);
    if (c.shapeFlag & 128)
      return c.suspense.next();
    const f = A(c.anchor || c.el), h = f && f[tl];
    return h ? A(h) : f;
  };
  let zt = !1;
  const us = (c, f, h) => {
    let x;
    c == null ? f._vnode && (ye(f._vnode, null, null, !0), x = f._vnode.component) : F(
      f._vnode || null,
      c,
      f,
      null,
      null,
      null,
      h
    ), f._vnode = c, zt || (zt = !0, _s(x), Si(), zt = !1);
  }, Rt = {
    p: F,
    um: ye,
    m: ue,
    r: we,
    mt: Tt,
    mc: Oe,
    pc: G,
    pbc: Le,
    n: st,
    o: e
  };
  return {
    render: us,
    hydrate: void 0,
    createApp: Sl(us)
  };
}
function Rn({ type: e, props: t }, n) {
  return n === "svg" && e === "foreignObject" || n === "mathml" && e === "annotation-xml" && t && t.encoding && t.encoding.includes("html") ? void 0 : n;
}
function ct({ effect: e, job: t }, n) {
  n ? (e.flags |= 32, t.flags |= 4) : (e.flags &= -33, t.flags &= -5);
}
function Nl(e, t) {
  return (!e || e && !e.pendingBranch) && t && !t.persisted;
}
function qi(e, t, n = !1) {
  const s = e.children, i = t.children;
  if (k(s) && k(i))
    for (let o = 0; o < s.length; o++) {
      const l = s[o];
      let r = i[o];
      r.shapeFlag & 1 && !r.dynamicChildren && ((r.patchFlag <= 0 || r.patchFlag === 32) && (r = i[o] = Ge(i[o]), r.el = l.el), !n && r.patchFlag !== -2 && qi(l, r)), r.type === _n && (r.patchFlag === -1 && (r = i[o] = Ge(r)), r.el = l.el), r.type === lt && !r.el && (r.el = l.el);
    }
}
function $l(e) {
  const t = e.slice(), n = [0];
  let s, i, o, l, r;
  const u = e.length;
  for (s = 0; s < u; s++) {
    const p = e[s];
    if (p !== 0) {
      if (i = n[n.length - 1], e[i] < p) {
        t[s] = i, n.push(s);
        continue;
      }
      for (o = 0, l = n.length - 1; o < l; )
        r = o + l >> 1, e[n[r]] < p ? o = r + 1 : l = r;
      p < e[n[o]] && (o > 0 && (t[s] = n[o - 1]), n[o] = s);
    }
  }
  for (o = n.length, l = n[o - 1]; o-- > 0; )
    n[o] = l, l = t[l];
  return n;
}
function Gi(e) {
  const t = e.subTree.component;
  if (t)
    return t.asyncDep && !t.asyncResolved ? t : Gi(t);
}
function As(e) {
  if (e)
    for (let t = 0; t < e.length; t++)
      e[t].flags |= 8;
}
function Ji(e) {
  if (e.placeholder)
    return e.placeholder;
  const t = e.component;
  return t ? Ji(t.subTree) : null;
}
const zi = (e) => e.__isSuspense;
function jl(e, t) {
  t && t.pendingBranch ? k(e) ? t.effects.push(...e) : t.effects.push(e) : Jo(e);
}
const oe = /* @__PURE__ */ Symbol.for("v-fgt"), _n = /* @__PURE__ */ Symbol.for("v-txt"), lt = /* @__PURE__ */ Symbol.for("v-cmt"), An = /* @__PURE__ */ Symbol.for("v-stc"), jt = [];
let xe = null;
function N(e = !1) {
  jt.push(xe = e ? null : []);
}
function Hl() {
  jt.pop(), xe = jt[jt.length - 1] || null;
}
let Ut = 1;
function Es(e, t = !1) {
  Ut += e, e < 0 && xe && t && (xe.hasOnce = !0);
}
function Yi(e) {
  return e.dynamicChildren = Ut > 0 ? xe || yt : null, Hl(), Ut > 0 && xe && xe.push(e), e;
}
function $(e, t, n, s, i, o) {
  return Yi(
    a(
      e,
      t,
      n,
      s,
      i,
      o,
      !0
    )
  );
}
function Bl(e, t, n, s, i) {
  return Yi(
    Ye(
      e,
      t,
      n,
      s,
      i,
      !0
    )
  );
}
function Xi(e) {
  return e ? e.__v_isVNode === !0 : !1;
}
function Pt(e, t) {
  return e.type === t.type && e.key === t.key;
}
const Qi = ({ key: e }) => e ?? null, nn = ({
  ref: e,
  ref_key: t,
  ref_for: n
}) => (typeof e == "number" && (e = "" + e), e != null ? ne(e) || /* @__PURE__ */ de(e) || V(e) ? { i: Me, r: e, k: t, f: !!n } : e : null);
function a(e, t = null, n = null, s = 0, i = null, o = e === oe ? 0 : 1, l = !1, r = !1) {
  const u = {
    __v_isVNode: !0,
    __v_skip: !0,
    type: e,
    props: t,
    key: t && Qi(t),
    ref: t && nn(t),
    scopeId: Mi,
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
    patchFlag: s,
    dynamicProps: i,
    dynamicChildren: null,
    appContext: null,
    ctx: Me
  };
  return r ? (as(u, n), o & 128 && e.normalize(u)) : n && (u.shapeFlag |= ne(n) ? 8 : 16), Ut > 0 && // avoid a block node from tracking itself
  !l && // has current parent block
  xe && // presence of a patch flag indicates this node needs patching on updates.
  // component nodes also should always be patched, because even if the
  // component doesn't need to update, it needs to persist the instance on to
  // the next vnode so that it can be properly unmounted later.
  (u.patchFlag > 0 || o & 6) && // the EVENTS flag is only for hydration and if it is the only flag, the
  // vnode should not be considered dynamic due to handler caching.
  u.patchFlag !== 32 && xe.push(u), u;
}
const Ye = Wl;
function Wl(e, t = null, n = null, s = 0, i = null, o = !1) {
  if ((!e || e === hl) && (e = lt), Xi(e)) {
    const r = Ct(
      e,
      t,
      !0
      /* mergeRef: true */
    );
    return n && as(r, n), Ut > 0 && !o && xe && (r.shapeFlag & 6 ? xe[xe.indexOf(e)] = r : xe.push(r)), r.patchFlag = -2, r;
  }
  if (tr(e) && (e = e.__vccOpts), t) {
    t = Ul(t);
    let { class: r, style: u } = t;
    r && !ne(r) && (t.class = ot(r)), J(u) && (/* @__PURE__ */ ss(u) && !k(u) && (u = pe({}, u)), t.style = xt(u));
  }
  const l = ne(e) ? 1 : zi(e) ? 128 : nl(e) ? 64 : J(e) ? 4 : V(e) ? 2 : 0;
  return a(
    e,
    t,
    n,
    s,
    i,
    l,
    o,
    !0
  );
}
function Ul(e) {
  return e ? /* @__PURE__ */ ss(e) || ji(e) ? pe({}, e) : e : null;
}
function Ct(e, t, n = !1, s = !1) {
  const { props: i, ref: o, patchFlag: l, children: r, transition: u } = e, p = t ? ql(i || {}, t) : i, d = {
    __v_isVNode: !0,
    __v_skip: !0,
    type: e.type,
    props: p,
    key: p && Qi(p),
    ref: t && t.ref ? (
      // #2078 in the case of <component :is="vnode" ref="extra"/>
      // if the vnode itself already has a ref, cloneVNode will need to merge
      // the refs so the single vnode can be set on multiple refs
      n && o ? k(o) ? o.concat(nn(t)) : [o, nn(t)] : nn(t)
    ) : o,
    scopeId: e.scopeId,
    slotScopeIds: e.slotScopeIds,
    children: r,
    target: e.target,
    targetStart: e.targetStart,
    targetAnchor: e.targetAnchor,
    staticCount: e.staticCount,
    shapeFlag: e.shapeFlag,
    // if the vnode is cloned with extra props, we can no longer assume its
    // existing patch flag to be reliable and need to add the FULL_PROPS flag.
    // note: preserve flag for fragments since they use the flag for children
    // fast paths only.
    patchFlag: t && e.type !== oe ? l === -1 ? 16 : l | 16 : l,
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
    ssContent: e.ssContent && Ct(e.ssContent),
    ssFallback: e.ssFallback && Ct(e.ssFallback),
    placeholder: e.placeholder,
    el: e.el,
    anchor: e.anchor,
    ctx: e.ctx,
    ce: e.ce
  };
  return u && s && os(
    d,
    u.clone(d)
  ), d;
}
function Kl(e = " ", t = 0) {
  return Ye(_n, null, e, t);
}
function Ps(e = "", t = !1) {
  return t ? (N(), Bl(lt, null, e)) : Ye(lt, null, e);
}
function je(e) {
  return e == null || typeof e == "boolean" ? Ye(lt) : k(e) ? Ye(
    oe,
    null,
    // #3666, avoid reference pollution when reusing vnode
    e.slice()
  ) : Xi(e) ? Ge(e) : Ye(_n, null, String(e));
}
function Ge(e) {
  return e.el === null && e.patchFlag !== -1 || e.memo ? e : Ct(e);
}
function as(e, t) {
  let n = 0;
  const { shapeFlag: s } = e;
  if (t == null)
    t = null;
  else if (k(t))
    n = 16;
  else if (typeof t == "object")
    if (s & 65) {
      const i = t.default;
      i && (i._c && (i._d = !1), as(e, i()), i._c && (i._d = !0));
      return;
    } else {
      n = 32;
      const i = t._;
      !i && !ji(t) ? t._ctx = Me : i === 3 && Me && (Me.slots._ === 1 ? t._ = 1 : (t._ = 2, e.patchFlag |= 1024));
    }
  else V(t) ? (t = { default: t, _ctx: Me }, n = 32) : (t = String(t), s & 64 ? (n = 16, t = [Kl(t)]) : n = 8);
  e.children = t, e.shapeFlag |= n;
}
function ql(...e) {
  const t = {};
  for (let n = 0; n < e.length; n++) {
    const s = e[n];
    for (const i in s)
      if (i === "class")
        t.class !== s.class && (t.class = ot([t.class, s.class]));
      else if (i === "style")
        t.style = xt([t.style, s.style]);
      else if (un(i)) {
        const o = t[i], l = s[i];
        l && o !== l && !(k(o) && o.includes(l)) ? t[i] = o ? [].concat(o, l) : l : l == null && o == null && // mergeProps({ 'onUpdate:modelValue': undefined }) should not retain
        // the model listener.
        !fn(i) && (t[i] = l);
      } else i !== "" && (t[i] = s[i]);
  }
  return t;
}
function De(e, t, n, s = null) {
  Ue(e, t, 7, [
    n,
    s
  ]);
}
const Gl = ki();
let Jl = 0;
function zl(e, t, n) {
  const s = e.type, i = (t ? t.appContext : e.appContext) || Gl, o = {
    uid: Jl++,
    vnode: e,
    type: s,
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
    scope: new vo(
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
    propsOptions: Bi(s, i),
    emitsOptions: Vi(s, i),
    // emit
    emit: null,
    // to be set immediately
    emitted: null,
    // props default value
    propsDefaults: X,
    // inheritAttrs
    inheritAttrs: s.inheritAttrs,
    // state
    ctx: X,
    data: X,
    props: X,
    attrs: X,
    slots: X,
    refs: X,
    setupState: X,
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
  return o.ctx = { _: o }, o.root = t ? t.root : o, o.emit = Ml.bind(null, o), e.ce && e.ce(o), o;
}
let ve = null;
const Yl = () => ve || Me;
let cn, Hn;
{
  const e = pn(), t = (n, s) => {
    let i;
    return (i = e[n]) || (i = e[n] = []), i.push(s), (o) => {
      i.length > 1 ? i.forEach((l) => l(o)) : i[0](o);
    };
  };
  cn = t(
    "__VUE_INSTANCE_SETTERS__",
    (n) => ve = n
  ), Hn = t(
    "__VUE_SSR_SETTERS__",
    (n) => Kt = n
  );
}
const Jt = (e) => {
  const t = ve;
  return cn(e), e.scope.on(), () => {
    e.scope.off(), cn(t);
  };
}, Is = () => {
  ve && ve.scope.off(), cn(null);
};
function Zi(e) {
  return e.vnode.shapeFlag & 4;
}
let Kt = !1;
function Xl(e, t = !1, n = !1) {
  t && Hn(t);
  const { props: s, children: i } = e.vnode, o = Zi(e);
  Pl(e, s, o, t), Fl(e, i, n || t);
  const l = o ? Ql(e, t) : void 0;
  return t && Hn(!1), l;
}
function Ql(e, t) {
  const n = e.type;
  e.accessCache = /* @__PURE__ */ Object.create(null), e.proxy = new Proxy(e.ctx, gl);
  const { setup: s } = n;
  if (s) {
    Xe();
    const i = e.setupContext = s.length > 1 ? er(e) : null, o = Jt(e), l = Gt(
      s,
      e,
      0,
      [
        e.props,
        i
      ]
    ), r = Ys(l);
    if (Qe(), o(), (r || e.sp) && !Nt(e) && Ri(e), r) {
      if (l.then(Is, Is), t)
        return l.then((u) => {
          Os(e, u);
        }).catch((u) => {
          gn(u, e, 0);
        });
      e.asyncDep = l;
    } else
      Os(e, l);
  } else
    eo(e);
}
function Os(e, t, n) {
  V(t) ? e.type.__ssrInlineRender ? e.ssrRender = t : e.render = t : J(t) && (e.setupState = _i(t)), eo(e);
}
function eo(e, t, n) {
  const s = e.type;
  e.render || (e.render = s.render || Be);
  {
    const i = Jt(e);
    Xe();
    try {
      vl(e);
    } finally {
      Qe(), i();
    }
  }
}
const Zl = {
  get(e, t) {
    return fe(e, "get", ""), e[t];
  }
};
function er(e) {
  const t = (n) => {
    e.exposed = n || {};
  };
  return {
    attrs: new Proxy(e.attrs, Zl),
    slots: e.slots,
    emit: e.emit,
    expose: t
  };
}
function yn(e) {
  return e.exposed ? e.exposeProxy || (e.exposeProxy = new Proxy(_i(Do(e.exposed)), {
    get(t, n) {
      if (n in t)
        return t[n];
      if (n in $t)
        return $t[n](e);
    },
    has(t, n) {
      return n in t || n in $t;
    }
  })) : e.proxy;
}
function tr(e) {
  return V(e) && "__vccOpts" in e;
}
const Ae = (e, t) => /* @__PURE__ */ Wo(e, t, Kt), nr = "3.5.34";
let Bn;
const Ls = typeof window < "u" && window.trustedTypes;
if (Ls)
  try {
    Bn = /* @__PURE__ */ Ls.createPolicy("vue", {
      createHTML: (e) => e
    });
  } catch {
  }
const to = Bn ? (e) => Bn.createHTML(e) : (e) => e, sr = "http://www.w3.org/2000/svg", ir = "http://www.w3.org/1998/Math/MathML", qe = typeof document < "u" ? document : null, Fs = qe && /* @__PURE__ */ qe.createElement("template"), or = {
  insert: (e, t, n) => {
    t.insertBefore(e, n || null);
  },
  remove: (e) => {
    const t = e.parentNode;
    t && t.removeChild(e);
  },
  createElement: (e, t, n, s) => {
    const i = t === "svg" ? qe.createElementNS(sr, e) : t === "mathml" ? qe.createElementNS(ir, e) : n ? qe.createElement(e, { is: n }) : qe.createElement(e);
    return e === "select" && s && s.multiple != null && i.setAttribute("multiple", s.multiple), i;
  },
  createText: (e) => qe.createTextNode(e),
  createComment: (e) => qe.createComment(e),
  setText: (e, t) => {
    e.nodeValue = t;
  },
  setElementText: (e, t) => {
    e.textContent = t;
  },
  parentNode: (e) => e.parentNode,
  nextSibling: (e) => e.nextSibling,
  querySelector: (e) => qe.querySelector(e),
  setScopeId(e, t) {
    e.setAttribute(t, "");
  },
  // __UNSAFE__
  // Reason: innerHTML.
  // Static content here can only come from compiled templates.
  // As long as the user only uses trusted templates, this is safe.
  insertStaticContent(e, t, n, s, i, o) {
    const l = n ? n.previousSibling : t.lastChild;
    if (i && (i === o || i.nextSibling))
      for (; t.insertBefore(i.cloneNode(!0), n), !(i === o || !(i = i.nextSibling)); )
        ;
    else {
      Fs.innerHTML = to(
        s === "svg" ? `<svg>${e}</svg>` : s === "mathml" ? `<math>${e}</math>` : e
      );
      const r = Fs.content;
      if (s === "svg" || s === "mathml") {
        const u = r.firstChild;
        for (; u.firstChild; )
          r.appendChild(u.firstChild);
        r.removeChild(u);
      }
      t.insertBefore(r, n);
    }
    return [
      // first
      l ? l.nextSibling : t.firstChild,
      // last
      n ? n.previousSibling : t.lastChild
    ];
  }
}, lr = /* @__PURE__ */ Symbol("_vtc");
function rr(e, t, n) {
  const s = e[lr];
  s && (t = (t ? [t, ...s] : [...s]).join(" ")), t == null ? e.removeAttribute("class") : n ? e.setAttribute("class", t) : e.className = t;
}
const ks = /* @__PURE__ */ Symbol("_vod"), ar = /* @__PURE__ */ Symbol("_vsh"), cr = /* @__PURE__ */ Symbol(""), ur = /(?:^|;)\s*display\s*:/;
function fr(e, t, n) {
  const s = e.style, i = ne(n);
  let o = !1;
  if (n && !i) {
    if (t)
      if (ne(t))
        for (const l of t.split(";")) {
          const r = l.slice(0, l.indexOf(":")).trim();
          n[r] == null && Lt(s, r, "");
        }
      else
        for (const l in t)
          n[l] == null && Lt(s, l, "");
    for (const l in n) {
      l === "display" && (o = !0);
      const r = n[l];
      r != null ? pr(
        e,
        l,
        !ne(t) && t ? t[l] : void 0,
        r
      ) || Lt(s, l, r) : Lt(s, l, "");
    }
  } else if (i) {
    if (t !== n) {
      const l = s[cr];
      l && (n += ";" + l), s.cssText = n, o = ur.test(n);
    }
  } else t && e.removeAttribute("style");
  ks in e && (e[ks] = o ? s.display : "", e[ar] && (s.display = "none"));
}
const Vs = /\s*!important$/;
function Lt(e, t, n) {
  if (k(n))
    n.forEach((s) => Lt(e, t, s));
  else if (n == null && (n = ""), t.startsWith("--"))
    e.setProperty(t, n);
  else {
    const s = dr(e, t);
    Vs.test(n) ? e.setProperty(
      pt(s),
      n.replace(Vs, ""),
      "important"
    ) : e[s] = n;
  }
}
const Ds = ["Webkit", "Moz", "ms"], En = {};
function dr(e, t) {
  const n = En[t];
  if (n)
    return n;
  let s = Ee(t);
  if (s !== "filter" && s in e)
    return En[t] = s;
  s = Zs(s);
  for (let i = 0; i < Ds.length; i++) {
    const o = Ds[i] + s;
    if (o in e)
      return En[t] = o;
  }
  return t;
}
function pr(e, t, n, s) {
  return e.tagName === "TEXTAREA" && (t === "width" || t === "height") && ne(s) && n === s;
}
const Ns = "http://www.w3.org/1999/xlink";
function $s(e, t, n, s, i, o = ho(t)) {
  s && t.startsWith("xlink:") ? n == null ? e.removeAttributeNS(Ns, t.slice(6, t.length)) : e.setAttributeNS(Ns, t, n) : n == null || o && !ti(n) ? e.removeAttribute(t) : e.setAttribute(
    t,
    o ? "" : We(n) ? String(n) : n
  );
}
function js(e, t, n, s, i) {
  if (t === "innerHTML" || t === "textContent") {
    n != null && (e[t] = t === "innerHTML" ? to(n) : n);
    return;
  }
  const o = e.tagName;
  if (t === "value" && o !== "PROGRESS" && // custom elements may use _value internally
  !o.includes("-")) {
    const r = o === "OPTION" ? e.getAttribute("value") || "" : e.value, u = n == null ? (
      // #11647: value should be set as empty string for null and undefined,
      // but <input type="checkbox"> should be set as 'on'.
      e.type === "checkbox" ? "on" : ""
    ) : String(n);
    (r !== u || !("_value" in e)) && (e.value = u), n == null && e.removeAttribute(t), e._value = n;
    return;
  }
  let l = !1;
  if (n === "" || n == null) {
    const r = typeof e[t];
    r === "boolean" ? n = ti(n) : n == null && r === "string" ? (n = "", l = !0) : r === "number" && (n = 0, l = !0);
  }
  try {
    e[t] = n;
  } catch {
  }
  l && e.removeAttribute(i || t);
}
function _t(e, t, n, s) {
  e.addEventListener(t, n, s);
}
function hr(e, t, n, s) {
  e.removeEventListener(t, n, s);
}
const Hs = /* @__PURE__ */ Symbol("_vei");
function gr(e, t, n, s, i = null) {
  const o = e[Hs] || (e[Hs] = {}), l = o[t];
  if (s && l)
    l.value = s;
  else {
    const [r, u] = vr(t);
    if (s) {
      const p = o[t] = yr(
        s,
        i
      );
      _t(e, r, p, u);
    } else l && (hr(e, r, l, u), o[t] = void 0);
  }
}
const Bs = /(?:Once|Passive|Capture)$/;
function vr(e) {
  let t;
  if (Bs.test(e)) {
    t = {};
    let s;
    for (; s = e.match(Bs); )
      e = e.slice(0, e.length - s[0].length), t[s[0].toLowerCase()] = !0;
  }
  return [e[2] === ":" ? e.slice(3) : pt(e.slice(2)), t];
}
let Pn = 0;
const mr = /* @__PURE__ */ Promise.resolve(), _r = () => Pn || (mr.then(() => Pn = 0), Pn = Date.now());
function yr(e, t) {
  const n = (s) => {
    if (!s._vts)
      s._vts = Date.now();
    else if (s._vts <= n.attached)
      return;
    Ue(
      br(s, n.value),
      t,
      5,
      [s]
    );
  };
  return n.value = e, n.attached = _r(), n;
}
function br(e, t) {
  if (k(t)) {
    const n = e.stopImmediatePropagation;
    return e.stopImmediatePropagation = () => {
      n.call(e), e._stopped = !0;
    }, t.map(
      (s) => (i) => !i._stopped && s && s(i)
    );
  } else
    return t;
}
const Ws = (e) => e.charCodeAt(0) === 111 && e.charCodeAt(1) === 110 && // lowercase letter
e.charCodeAt(2) > 96 && e.charCodeAt(2) < 123, xr = (e, t, n, s, i, o) => {
  const l = i === "svg";
  t === "class" ? rr(e, s, l) : t === "style" ? fr(e, n, s) : un(t) ? fn(t) || gr(e, t, n, s, o) : (t[0] === "." ? (t = t.slice(1), !0) : t[0] === "^" ? (t = t.slice(1), !1) : Sr(e, t, s, l)) ? (js(e, t, s), !e.tagName.includes("-") && (t === "value" || t === "checked" || t === "selected") && $s(e, t, s, l, o, t !== "value")) : /* #11081 force set props for possible async custom element */ e._isVueCE && // #12408 check if it's declared prop or it's async custom element
  (wr(e, t) || // @ts-expect-error _def is private
  e._def.__asyncLoader && (/[A-Z]/.test(t) || !ne(s))) ? js(e, Ee(t), s, o, t) : (t === "true-value" ? e._trueValue = s : t === "false-value" && (e._falseValue = s), $s(e, t, s, l));
};
function Sr(e, t, n, s) {
  if (s)
    return !!(t === "innerHTML" || t === "textContent" || t in e && Ws(t) && V(n));
  if (t === "spellcheck" || t === "draggable" || t === "translate" || t === "autocorrect" || t === "sandbox" && e.tagName === "IFRAME" || t === "form" || t === "list" && e.tagName === "INPUT" || t === "type" && e.tagName === "TEXTAREA")
    return !1;
  if (t === "width" || t === "height") {
    const i = e.tagName;
    if (i === "IMG" || i === "VIDEO" || i === "CANVAS" || i === "SOURCE")
      return !1;
  }
  return Ws(t) && ne(n) ? !1 : t in e;
}
function wr(e, t) {
  const n = (
    // @ts-expect-error _def is private
    e._def.props
  );
  if (!n)
    return !1;
  const s = Ee(t);
  return Array.isArray(n) ? n.some((i) => Ee(i) === s) : Object.keys(n).some((i) => Ee(i) === s);
}
const Us = (e) => {
  const t = e.props["onUpdate:modelValue"] || !1;
  return k(t) ? (n) => Zt(t, n) : t;
};
function Mr(e) {
  e.target.composing = !0;
}
function Ks(e) {
  const t = e.target;
  t.composing && (t.composing = !1, t.dispatchEvent(new Event("input")));
}
const In = /* @__PURE__ */ Symbol("_assign");
function qs(e, t, n) {
  return t && (e = e.trim()), n && (e = Jn(e)), e;
}
const Cr = {
  created(e, { modifiers: { lazy: t, trim: n, number: s } }, i) {
    e[In] = Us(i);
    const o = s || i.props && i.props.type === "number";
    _t(e, t ? "change" : "input", (l) => {
      l.target.composing || e[In](qs(e.value, n, o));
    }), (n || o) && _t(e, "change", () => {
      e.value = qs(e.value, n, o);
    }), t || (_t(e, "compositionstart", Mr), _t(e, "compositionend", Ks), _t(e, "change", Ks));
  },
  // set value on mounted so it's after min/max for type="range"
  mounted(e, { value: t }) {
    e.value = t ?? "";
  },
  beforeUpdate(e, { value: t, oldValue: n, modifiers: { lazy: s, trim: i, number: o } }, l) {
    if (e[In] = Us(l), e.composing) return;
    const r = (o || e.type === "number") && !/^0\d/.test(e.value) ? Jn(e.value) : e.value, u = t ?? "";
    if (r === u)
      return;
    const p = e.getRootNode();
    (p instanceof Document || p instanceof ShadowRoot) && p.activeElement === e && e.type !== "range" && (s && t === n || i && e.value.trim() === u) || (e.value = u);
  }
}, Tr = /* @__PURE__ */ pe({ patchProp: xr }, or);
let Gs;
function Rr() {
  return Gs || (Gs = Vl(Tr));
}
const Ar = ((...e) => {
  const t = Rr().createApp(...e), { mount: n } = t;
  return t.mount = (s) => {
    const i = Pr(s);
    if (!i) return;
    const o = t._component;
    !V(o) && !o.render && !o.template && (o.template = i.innerHTML), i.nodeType === 1 && (i.textContent = "");
    const l = n(i, !1, Er(i));
    return i instanceof Element && (i.removeAttribute("v-cloak"), i.setAttribute("data-v-app", "")), l;
  }, t;
});
function Er(e) {
  if (e instanceof SVGElement)
    return "svg";
  if (typeof MathMLElement == "function" && e instanceof MathMLElement)
    return "mathml";
}
function Pr(e) {
  return ne(e) ? document.querySelector(e) : e;
}
function re() {
  return typeof window < "u" && window.openxnetApp || null;
}
function cs(e) {
  if (e && typeof e.isCurrentLanguageZh == "function")
    try {
      return !!e.isCurrentLanguageZh();
    } catch {
      return !0;
    }
  return String(e?.currentLanguage || navigator.language || "zh-CN").toLowerCase().startsWith("zh");
}
function It(e, t) {
  return {
    memory: t ? "角色卡&记忆" : "Role Memory",
    voice: t ? "多角色语音" : "Voices",
    appearance: t ? "多角色外观" : "Appearance",
    behavior: t ? "自主行为" : "Behavior",
    vision: t ? "桌面视觉" : "Desktop Vision"
  }[e] || e;
}
function Ir(e) {
  const t = String(e?.prototypeBadgeClass || "").trim();
  return t.includes("success") ? "success" : t.includes("warning") ? "warning" : t.includes("error") ? "error" : t.includes("accent") ? "accent" : t.includes("info") ? "info" : "muted";
}
function no(e, t, n = 2) {
  let s = "";
  if (e && typeof e.getRoleMemoryAvatarText == "function")
    try {
      s = String(e.getRoleMemoryAvatarText(t) || "").trim();
    } catch {
      s = "";
    }
  if (!s) {
    const i = String(t?.name || "").trim();
    s = i ? Array.from(i).slice(0, n).join("") : "角";
  }
  return Array.from(s.replace(/\s+/g, "")).slice(0, n).join("") || "角";
}
function so(e, t) {
  if (e && typeof e.getRoleMemoryAvatarStyle == "function")
    try {
      const n = e.getRoleMemoryAvatarStyle(t);
      if (n && n.background)
        return n.background;
    } catch {
    }
  return "linear-gradient(135deg, #73c4ea 0%, #5aa7d1 100%)";
}
function Wn(e, t, n = "success") {
  try {
    if (typeof window < "u" && typeof window.showNotification == "function") {
      window.showNotification(t, n);
      return;
    }
  } catch {
  }
  try {
    e && typeof e.showNotification == "function" && e.showNotification(t, n);
  } catch {
  }
}
async function Or(e, t) {
  if (!e || !t) return;
  e.newMemory || (e.newMemory = {}), e.newMemory.avatar = t;
  const s = (e && typeof e.getActiveRoleMemoryId == "function" ? String(e.getActiveRoleMemoryId() || "").trim() : String(e.newMemory?.id || "").trim()) || String(e.newMemory?.id || "").trim();
  if (s && Array.isArray(e.memories)) {
    const i = e.memories.find((o) => String(o?.id || "") === s);
    i && (i.avatar = t);
  }
  await tt(e);
}
async function Lr(e, t) {
  if (!t) return;
  const n = cs(e);
  if (t.type && !String(t.type).startsWith("image/")) {
    Wn(e, n ? "请选择图片文件" : "Please select an image file", "warning");
    return;
  }
  const s = new FormData();
  s.append("files", t, t.name || "avatar.png");
  const i = await fetch("/load_file", {
    method: "POST",
    body: s
  });
  if (!i.ok)
    throw new Error(`HTTP ${i.status}`);
  const o = await i.json(), l = String(o?.fileLinks?.[0]?.path || o?.fileLinks?.[0]?.url || "").trim();
  if (!o?.success || !l)
    throw new Error(o?.message || o?.error || "Upload failed");
  await Or(e, l), Wn(e, n ? "头像已更新" : "Avatar updated", "success");
}
function Fr(e, t) {
  const n = e && typeof e.getPrototypeRoleMemorySource == "function" ? e.getPrototypeRoleMemorySource() : e?.memories || [], s = e && typeof e.getActiveRoleMemoryId == "function" ? String(e.getActiveRoleMemoryId() || "") : String(e?.memorySettings?.selectedMemory || "");
  return n.map((i) => ({
    id: String(i?.id || ""),
    name: String(i?.name || (t ? "未命名角色" : "Untitled role")),
    description: String(i?.description || i?.personality || ""),
    meta: e && typeof e.getRoleMemoryMeta == "function" ? e.getRoleMemoryMeta(i) : "",
    badge: e && typeof e.getRoleMemoryBadgeLabel == "function" ? e.getRoleMemoryBadgeLabel(i) : i?.infer ? t ? "记忆" : "Memory" : t ? "角色" : "Role",
    badgeTone: Ir(i),
    avatarText: no(e, i, 2),
    avatarImage: String(i?.avatar || ""),
    avatarBackground: so(e, i),
    active: s === String(i?.id || "")
  }));
}
function kr(e, t) {
  const n = Array.isArray(e?.modelProviders) ? e.modelProviders : [], s = [
    {
      value: "",
      label: t ? "不绑定长期记忆模型" : "No long-term memory model"
    },
    {
      value: "paraphrase-multilingual-MiniLM-L12-v2",
      label: t ? "本地 MiniLM - paraphrase-multilingual-MiniLM-L12-v2" : "Local MiniLM - paraphrase-multilingual-MiniLM-L12-v2"
    }
  ];
  return n.forEach((i) => {
    s.push({
      value: String(i?.id || ""),
      label: `${i?.vendor || "Provider"} - ${i?.modelId || i?.id || ""}`.trim()
    });
  }), s;
}
function Vr(e, t) {
  const n = e?.newMemory || {}, s = e?.memorySettings || {}, i = e && typeof e.getActiveRoleMemoryId == "function" ? String(e.getActiveRoleMemoryId() || "") : "", o = Array.isArray(e?.memories) ? e.memories.some((l) => String(l?.id || "") === i) : !1;
  return {
    id: String(n?.id || ""),
    activeId: i,
    canDelete: o,
    title: String(n?.id || "").trim() ? t ? "编辑角色" : "Edit Role" : t ? "新建角色" : "New Role",
    name: String(n?.name || ""),
    description: String(n?.description || ""),
    systemPrompt: String(n?.systemPrompt || ""),
    personality: String(n?.personality || ""),
    firstMes: String(n?.firstMes || ""),
    infer: !!n?.infer,
    avatarText: no(e, n, 3),
    avatarImage: String(n?.avatar || ""),
    avatarBackground: so(e, n),
    providerId: String(n?.providerId || ""),
    providerOptions: kr(e, t),
    memoryEnabled: !!s?.is_memory,
    memoryLimit: Number(s?.memoryLimit || 10),
    userName: String(s?.userName || "user"),
    genericSystemPrompt: String(s?.genericSystemPrompt || ""),
    backendLabel: e && typeof e.getPrototypeMemoryBackendLabel == "function" ? e.getPrototypeMemoryBackendLabel() : t ? "Session Store（本地 JSON / 时间线）" : "Session Store (local JSON / timeline)"
  };
}
function Dr(e, t, n) {
  const s = e?.ttsSettings || {}, o = (Array.isArray(e?.edgettsvoices) ? e.edgettsvoices : []).filter((l) => {
    const r = !s.edgettsLanguage || l.language === s.edgettsLanguage, u = !s.edgettsGender || l.gender === s.edgettsGender;
    return r && u;
  }).slice(0, 40).map((l) => ({
    value: l.name,
    label: `${l.name} · ${l.language} · ${l.gender}`
  }));
  return {
    providers: [
      { id: "edgetts", label: "Edge TTS", active: String(s.engine || "edgetts") === "edgetts" },
      { id: "openai", label: "OpenAI TTS", active: String(s.engine || "") === "openai" },
      { id: "system", label: n ? "系统语音" : "System Voice", active: String(s.engine || "") === "system" }
    ],
    rows: t.slice(0, 4).map((l, r) => ({
      id: l.id || `voice-${r}`,
      name: l.name,
      model: String(s.edgettsVoice || "XiaoyiNeural"),
      tone: [
        n ? "温暖女声" : "Warm",
        n ? "沉稳男声" : "Calm",
        n ? "清新女声" : "Fresh",
        n ? "磁性男声" : "Deep"
      ][r % 4],
      speed: `${Number(s.edgettsRate || 1).toFixed(1)}x`,
      pitch: ["+0", "-2", "+1", "+0"][r % 4]
    })),
    selectedLanguage: String(s.edgettsLanguage || "zh-CN"),
    selectedGender: String(s.edgettsGender || "Female"),
    selectedVoice: String(s.edgettsVoice || ""),
    selectedRate: Number(s.edgettsRate || 1),
    sampleText: String(s.SampleText || (n ? "openxnet链接一切！" : "OpenXnet connects everything.")),
    voiceOptions: o
  };
}
function Nr(e, t, n) {
  const s = e?.VRMConfig || {}, i = [...s.defaultModels || [], ...s.userModels || []];
  return {
    avatars: t.slice(0, 4).map((o) => ({
      ...o,
      shortName: o.avatarText
    })),
    selectedModelId: String(s.selectedModelId || ""),
    modelOptions: i.map((o) => ({
      value: o.id,
      label: o.name || o.id
    })),
    motionCount: Array.isArray(s.selectedMotionIds) ? s.selectedMotionIds.length : 0,
    expressionsEnabled: !!s.enabledExpressions,
    motionsEnabled: !!s.enabledMotions,
    windowSize: `${Number(s.windowWidth || 540)} × ${Number(s.windowHeight || 960)}`,
    selectedScene: String(s.selectedGaussSceneId || (n ? "透明" : "Transparent"))
  };
}
function $r(e, t) {
  const n = Array.isArray(e?.behaviorSettings?.behaviorList) ? e.behaviorSettings.behaviorList : [];
  return n.length > 0 ? {
    hasRealData: !0,
    rules: n.map((s, i) => ({
      id: String(s?.id || `behavior-${i}`),
      name: String(s?.name || [
        t ? "定时问候" : "Scheduled greeting",
        t ? "新闻播报" : "News digest",
        t ? "任务提醒" : "Task reminder",
        t ? "学习总结" : "Study summary"
      ][i % 4]),
      description: String(s?.action?.prompt || s?.description || (t ? "自定义行为规则" : "Custom behavior rule")),
      frequency: String(s?.trigger?.type || (t ? "事件驱动" : "Event-driven")),
      enabled: !!s?.enabled
    }))
  } : {
    hasRealData: !1,
    rules: [
      { id: "demo-greeting", name: t ? "定时问候" : "Scheduled greeting", description: t ? "每天早上 9 点主动问候用户" : "Greets the user every morning at 9:00", frequency: t ? "频率: 每天" : "Daily", enabled: !0 },
      { id: "demo-news", name: t ? "新闻播报" : "News digest", description: t ? "自动抓取并播报热点新闻" : "Pulls and summarizes trending news", frequency: t ? "频率: 每小时" : "Hourly", enabled: !1 },
      { id: "demo-remind", name: t ? "任务提醒" : "Task reminder", description: t ? "在任务截止前 30 分钟提醒" : "Reminds before a deadline", frequency: t ? "触发: 事件驱动" : "Event-driven", enabled: !0 },
      { id: "demo-summary", name: t ? "学习总结" : "Study summary", description: t ? "每周生成学习进度总结报告" : "Builds a weekly learning summary", frequency: t ? "频率: 每周" : "Weekly", enabled: !1 }
    ]
  };
}
function jr(e, t) {
  const n = e?.visionSettings || {}, s = Array.isArray(e?.modelProviders) ? e.modelProviders : [];
  return {
    desktopVision: !!n.desktopVision,
    enableWakeWord: !!n.enableWakeWord,
    wakeWord: String(n.wakeWord || ""),
    selectedProvider: String(n.selectedProvider || ""),
    providerOptions: s.map((i) => ({
      value: String(i?.id || ""),
      label: `${i?.vendor || "Provider"} - ${i?.modelId || i?.id || ""}`.trim()
    })),
    modelLabel: String(n.model || (t ? "未选择视觉模型" : "No vision model selected")),
    captureFrequency: t ? "每10秒" : "Every 10 seconds",
    captureScope: t ? "全屏" : "Fullscreen",
    excludeApps: t ? ["微信", "1Password", "银行客户端"] : ["WeChat", "1Password", "Bank App"]
  };
}
function Hr() {
  const e = re(), t = cs(e), n = Fr(e, t);
  return {
    isZh: t,
    activeMenu: String(e?.activeMenu || ""),
    activeTab: String(e?.subMenu || "memory"),
    tabs: [
      { id: "memory", label: It("memory", t), icon: "fa-solid fa-brain" },
      { id: "voice", label: It("voice", t), icon: "fa-solid fa-microphone" },
      { id: "appearance", label: It("appearance", t), icon: "fa-solid fa-palette" },
      { id: "behavior", label: It("behavior", t), icon: "fa-solid fa-wand-magic-sparkles" },
      { id: "vision", label: It("vision", t), icon: "fa-solid fa-eye" }
    ],
    roles: n,
    memory: Vr(e, t),
    voice: Dr(e, n, t),
    appearance: Nr(e, n, t),
    behavior: $r(e, t),
    vision: jr(e, t)
  };
}
async function tt(e) {
  e && typeof e.autoSaveSettings == "function" && await e.autoSaveSettings();
}
async function Br(e) {
  const t = re();
  t && (t.activeMenu = "role", t.subMenu = e, e === "memory" && typeof t.ensurePrototypeRoleSelection == "function" && t.ensurePrototypeRoleSelection());
}
async function Wr() {
  const e = re();
  !e || typeof e.startCreateRoleMemory != "function" || e.startCreateRoleMemory();
}
async function Ur(e) {
  const t = re();
  !t || typeof t.selectRoleMemory != "function" || t.selectRoleMemory(e, { persist: !1 });
}
async function Kr() {
  const e = re();
  !e || typeof e.saveRoleMemoryInline != "function" || await e.saveRoleMemoryInline();
}
async function qr() {
  const e = re();
  !e || !e.newMemory?.id || typeof e.removeMemory != "function" || await e.removeMemory(e.newMemory.id);
}
function Gr() {
  const e = re();
  if (typeof document > "u") return;
  const t = document.createElement("input");
  t.type = "file", t.accept = "image/*", t.tabIndex = -1, t.style.position = "fixed", t.style.left = "-9999px", t.style.top = "-9999px", t.addEventListener("change", async (n) => {
    const s = n.target?.files?.[0] || null;
    if (t.remove(), !!s)
      try {
        await Lr(e, s);
      } catch (i) {
        console.error("[role-vite] avatar upload failed:", i), Wn(
          e,
          cs(e) ? `头像上传失败：${i?.message || i}` : `Avatar upload failed: ${i?.message || i}`,
          "error"
        );
      }
  }, { once: !0 }), document.body.appendChild(t), t.click();
}
async function Jr(e, t) {
  const n = re();
  !n || !n.newMemory || (n.newMemory[e] = t, await tt(n));
}
async function zr(e, t) {
  const n = re();
  if (!(!n || !n.memorySettings)) {
    if (n.memorySettings[e] = t, e === "is_memory" && typeof n.changeMemory == "function") {
      n.changeMemory();
      return;
    }
    await tt(n);
  }
}
async function Yr(e) {
  const t = re();
  !t || !t.newMemory || (t.newMemory.providerId = e || null, typeof t.selectMemoryProvider == "function" && t.selectMemoryProvider(t.newMemory.providerId), await tt(t));
}
async function Xr(e, t) {
  const n = re();
  !n || !n.ttsSettings || (n.ttsSettings[e] = t, e === "edgettsLanguage" && (n.edgettsLanguage = t), e === "edgettsGender" && (n.edgettsGender = t), await tt(n));
}
async function Qr() {
  const e = re();
  if (!e || typeof e.ClickToListen != "function") return;
  const t = e.ttsSettings?.SampleText || "openxnet链接一切！", n = e.ttsSettings?.edgettsVoice || "default";
  await e.ClickToListen(t, n);
}
async function Zr() {
  const e = re();
  e && (e.showVrmModelDialog = !0);
}
async function ea(e, t) {
  const n = re();
  if (!(!n || !n.VRMConfig)) {
    if (n.VRMConfig[e] = t, typeof n.saveVRMConfig == "function") {
      await n.saveVRMConfig();
      return;
    }
    await tt(n);
  }
}
async function ta(e) {
  const t = re();
  if (!t || !Array.isArray(t.behaviorSettings?.behaviorList)) return;
  const n = t.behaviorSettings.behaviorList[e];
  n && (n.enabled = !n.enabled, await tt(t));
}
async function na() {
  const e = re();
  e && (e.showBehaviorDialog = !0);
}
async function sa(e, t) {
  const n = re();
  !n || !n.visionSettings || (n.visionSettings[e] = t, await tt(n));
}
async function ia(e) {
  const t = re();
  if (!(!t || !t.visionSettings)) {
    if (t.visionSettings.selectedProvider = e || null, typeof t.selectVisionProvider == "function") {
      await t.selectVisionProvider(t.visionSettings.selectedProvider);
      return;
    }
    await tt(t);
  }
}
function oa() {
  return {
    snapshot: Hr,
    selectTab: Br,
    createRole: Wr,
    selectRole: Ur,
    saveRole: Kr,
    deleteRole: qr,
    triggerAvatarUpload: Gr,
    updateRoleField: Jr,
    updateMemorySetting: zr,
    updateMemoryProvider: Yr,
    updateTtsField: Xr,
    playVoiceSample: Qr,
    openVrmUpload: Zr,
    updateVrmField: ea,
    toggleBehaviorRule: ta,
    openBehaviorEditor: na,
    updateVisionField: sa,
    updateVisionProvider: ia
  };
}
const la = { class: "ox-vite-role-shell" }, ra = { class: "ox-vite-role-tabs" }, aa = ["onClick"], ca = {
  key: 0,
  class: "ox-vite-role-content ox-vite-role-content--memory"
}, ua = { class: "ox-vite-role-sidebar" }, fa = { class: "ox-vite-role-sidebar__header" }, da = { class: "ox-vite-role-sidebar__title-row" }, pa = { class: "ox-vite-role-search" }, ha = ["placeholder"], ga = ["onClick"], va = { class: "ox-vite-role-card__top" }, ma = ["src", "alt"], _a = { key: 1 }, ya = { class: "ox-vite-role-card__copy" }, ba = { class: "ox-vite-role-card__name-row" }, xa = { class: "ox-vite-role-card__name" }, Sa = { class: "ox-vite-role-card__desc" }, wa = { class: "ox-vite-role-card__meta" }, Ma = {
  key: 0,
  class: "ox-vite-role-empty"
}, Ca = { class: "ox-vite-role-editor" }, Ta = { class: "ox-vite-role-editor__header" }, Ra = { class: "ox-vite-role-editor__actions" }, Aa = { class: "ox-vite-role-editor__lead" }, Ea = { class: "ox-vite-role-avatar-panel" }, Pa = { class: "ox-vite-role-avatar-upload" }, Ia = ["src", "alt"], Oa = { key: 1 }, La = { class: "ox-vite-role-avatar-upload__overlay" }, Fa = { class: "ox-vite-role-avatar-panel__copy" }, ka = { class: "ox-vite-role-tags" }, Va = { class: "ox-vite-role-tag" }, Da = { class: "ox-vite-role-tag" }, Na = { class: "ox-vite-role-tag" }, $a = { class: "ox-vite-role-form" }, ja = { class: "ox-vite-role-field ox-vite-role-field--name" }, Ha = ["value", "placeholder"], Ba = { class: "ox-vite-role-field ox-vite-role-field--full" }, Wa = ["value", "placeholder"], Ua = { class: "ox-vite-role-field ox-vite-role-field--full" }, Ka = ["value", "placeholder"], qa = { class: "ox-vite-role-field ox-vite-role-field--full" }, Ga = ["value", "placeholder"], Ja = { class: "ox-vite-role-field ox-vite-role-field--full" }, za = ["value"], Ya = { class: "ox-vite-role-field" }, Xa = ["value"], Qa = ["value"], Za = { class: "ox-vite-role-field" }, ec = { class: "ox-vite-role-slider-row" }, tc = ["value"], nc = { class: "ox-vite-role-switch-grid" }, sc = { class: "ox-vite-role-switch" }, ic = ["checked"], oc = { class: "ox-vite-role-switch" }, lc = ["checked"], rc = { class: "ox-vite-role-field" }, ac = ["value"], cc = { class: "ox-vite-role-field ox-vite-role-field--full" }, uc = ["value"], fc = {
  key: 1,
  class: "ox-vite-role-content ox-vite-role-content--panel"
}, dc = { class: "ox-vite-role-panel" }, pc = { class: "ox-vite-role-section-header" }, hc = { class: "ox-vite-role-provider-cards" }, gc = { class: "ox-vite-role-table-wrap" }, vc = { class: "ox-vite-role-table" }, mc = { class: "ox-vite-role-panel-grid ox-vite-role-panel-grid--voice" }, _c = { class: "ox-vite-role-field" }, yc = ["value"], bc = { class: "ox-vite-role-field" }, xc = ["value"], Sc = { value: "Female" }, wc = { value: "Male" }, Mc = { class: "ox-vite-role-field" }, Cc = ["value"], Tc = ["value"], Rc = { class: "ox-vite-role-field" }, Ac = ["value"], Ec = { class: "ox-vite-role-field ox-vite-role-field--full" }, Pc = ["value"], Ic = {
  key: 2,
  class: "ox-vite-role-content ox-vite-role-content--panel"
}, Oc = { class: "ox-vite-role-panel" }, Lc = { class: "ox-vite-role-section-header" }, Fc = { class: "ox-vite-role-avatar-grid" }, kc = ["src", "alt"], Vc = { key: 1 }, Dc = { class: "ox-vite-role-avatar-card__name" }, Nc = { class: "ox-vite-role-vrm-section" }, $c = { class: "ox-vite-role-vrm-meta" }, jc = { class: "ox-vite-role-field" }, Hc = ["value"], Bc = { value: "" }, Wc = ["value"], Uc = { class: "ox-vite-role-inline-stats" }, Kc = { class: "ox-vite-role-switch-grid" }, qc = { class: "ox-vite-role-switch" }, Gc = ["checked"], Jc = { class: "ox-vite-role-switch" }, zc = ["checked"], Yc = {
  key: 3,
  class: "ox-vite-role-content ox-vite-role-content--panel"
}, Xc = { class: "ox-vite-role-panel" }, Qc = { class: "ox-vite-role-section-header" }, Zc = { class: "ox-vite-role-behavior-list" }, eu = { class: "ox-vite-role-behavior-card__copy" }, tu = { class: "ox-vite-role-behavior-card__meta" }, nu = ["checked", "onChange"], su = {
  key: 1,
  class: "ox-vite-role-demo-badge"
}, iu = {
  key: 4,
  class: "ox-vite-role-content ox-vite-role-content--panel"
}, ou = { class: "ox-vite-role-panel" }, lu = { class: "ox-vite-role-section-header" }, ru = { class: "ox-vite-role-settings-grid" }, au = { class: "ox-vite-role-switch" }, cu = ["checked"], uu = { class: "ox-vite-role-field" }, fu = ["value"], du = { class: "ox-vite-role-field" }, pu = ["value"], hu = { class: "ox-vite-role-settings-grid" }, gu = { class: "ox-vite-role-field" }, vu = ["value"], mu = { value: "" }, _u = ["value"], yu = { class: "ox-vite-role-field" }, bu = ["value"], xu = { class: "ox-vite-role-settings-grid" }, Su = { class: "ox-vite-role-switch" }, wu = ["checked"], Mu = { class: "ox-vite-role-field ox-vite-role-field--full" }, Cu = ["value"], Tu = { class: "ox-vite-role-field ox-vite-role-field--full" }, Ru = { class: "ox-vite-role-chip-wrap" }, Au = {
  __name: "App",
  setup(e) {
    const t = oa(), n = /* @__PURE__ */ Cn(t.snapshot()), s = /* @__PURE__ */ Cn(null);
    let i = null;
    function o() {
      bi(() => {
        const D = s.value;
        D && (D.scrollTop = 0);
      });
    }
    function l() {
      n.value = t.snapshot();
    }
    function r(D) {
      t.selectTab(D), l();
    }
    function u() {
      t.createRole(), l();
    }
    function p(D) {
      t.selectRole(D), l(), o();
    }
    function d(D, w) {
      t.updateRoleField(D, w.target.value);
    }
    function v(D) {
      t.updateRoleField("infer", D.target.checked);
    }
    function A(D) {
      t.updateMemorySetting("is_memory", D.target.checked);
    }
    function E(D) {
      t.updateMemorySetting("memoryLimit", Number(D.target.value));
    }
    function W(D, w) {
      t.updateMemorySetting(D, w.target.value);
    }
    function F(D) {
      t.updateMemoryProvider(D.target.value);
    }
    function te() {
      t.saveRole(), l();
    }
    function Q() {
      t.deleteRole(), l();
    }
    function j() {
      t.triggerAvatarUpload(), window.setTimeout(l, 500);
    }
    function U(D, w) {
      t.updateTtsField(D, w.target.value), l();
    }
    function O() {
      t.playVoiceSample();
    }
    function se() {
      t.openVrmUpload();
    }
    function Te(D, w) {
      t.updateVrmField(D, w.target.checked), l();
    }
    function Se(D) {
      t.updateVrmField("selectedModelId", D.target.value), l();
    }
    function Oe(D) {
      t.toggleBehaviorRule(D), l();
    }
    function ht() {
      t.openBehaviorEditor();
    }
    function Le(D, w) {
      t.updateVisionField(D, w.target.checked), l();
    }
    function rt(D, w) {
      t.updateVisionField(D, w.target.value);
    }
    function gt(D) {
      t.updateVisionProvider(D.target.value), l();
    }
    const S = Ae(() => n.value.isZh), Tt = Ae(() => n.value.tabs || []), nt = Ae(() => n.value.activeTab || "memory"), le = Ae(() => n.value.roles || []), z = /* @__PURE__ */ Cn(""), G = Ae(() => {
      const D = z.value.trim().toLowerCase();
      return D ? le.value.filter((w) => [
        w.name,
        w.description,
        w.meta,
        w.badge,
        w.avatarText
      ].join(" ").toLowerCase().includes(D)) : le.value;
    }), H = Ae(() => n.value.memory || {}), _e = Ae(() => n.value.voice || {}), ue = Ae(() => n.value.appearance || {}), ye = Ae(() => n.value.behavior || {}), we = Ae(() => n.value.vision || {});
    return Pi(() => {
      l(), o(), i = window.setInterval(l, 400);
    }), tn(
      () => n.value.activeMenu,
      (D, w) => {
        D === "role" && w !== "role" && o();
      }
    ), Ii(() => {
      i && (window.clearInterval(i), i = null);
    }), (D, w) => (N(), $("div", la, [
      a("div", ra, [
        (N(!0), $(oe, null, Re(Tt.value, (m) => (N(), $("button", {
          key: m.id,
          type: "button",
          class: ot(["ox-vite-role-tab", { active: nt.value === m.id }]),
          onClick: (st) => r(m.id)
        }, [
          a("i", {
            class: ot(m.icon)
          }, null, 2),
          a("span", null, g(m.label), 1)
        ], 10, aa))), 128))
      ]),
      nt.value === "memory" ? (N(), $("div", ca, [
        a("aside", ua, [
          a("div", fa, [
            a("div", da, [
              a("h2", null, g(S.value ? "角色管理" : "Role Management"), 1),
              a("button", {
                type: "button",
                class: "ox-vite-role-primary-btn",
                onClick: u
              }, [
                w[18] || (w[18] = a("i", { class: "fa-solid fa-plus" }, null, -1)),
                a("span", null, g(S.value ? "新建角色" : "New Role"), 1)
              ])
            ]),
            a("div", pa, [
              w[19] || (w[19] = a("i", { class: "fa-solid fa-magnifying-glass" }, null, -1)),
              Yo(a("input", {
                "onUpdate:modelValue": w[0] || (w[0] = (m) => z.value = m),
                type: "text",
                placeholder: S.value ? "搜索角色..." : "Search roles..."
              }, null, 8, ha), [
                [Cr, z.value]
              ])
            ])
          ]),
          a("div", {
            ref_key: "roleListRef",
            ref: s,
            class: "ox-vite-role-list"
          }, [
            (N(!0), $(oe, null, Re(G.value, (m) => (N(), $("button", {
              key: m.id,
              type: "button",
              class: ot(["ox-vite-role-card", { active: m.active }]),
              onClick: (st) => p(m.id)
            }, [
              a("div", va, [
                a("div", {
                  class: "ox-vite-role-card__avatar",
                  style: xt({ background: m.avatarBackground })
                }, [
                  m.avatarImage ? (N(), $("img", {
                    key: 0,
                    src: m.avatarImage,
                    alt: m.name
                  }, null, 8, ma)) : (N(), $("span", _a, g(m.avatarText), 1))
                ], 4),
                a("div", ya, [
                  a("div", ba, [
                    a("span", xa, g(m.name), 1),
                    a("span", {
                      class: ot(["ox-vite-role-card__badge", `is-${m.badgeTone}`])
                    }, g(m.badge), 3)
                  ]),
                  a("div", Sa, g(m.description), 1)
                ])
              ]),
              a("div", wa, g(m.meta), 1)
            ], 10, ga))), 128)),
            G.value.length === 0 ? (N(), $("div", Ma, [
              w[20] || (w[20] = a("i", { class: "fa-regular fa-user" }, null, -1)),
              a("span", null, g(S.value ? "没有匹配的角色" : "No matching roles"), 1)
            ])) : Ps("", !0)
          ], 512)
        ]),
        a("main", Ca, [
          a("div", Ta, [
            a("h1", null, g(H.value.title), 1),
            a("div", Ra, [
              H.value.canDelete ? (N(), $("button", {
                key: 0,
                type: "button",
                class: "ox-vite-role-danger-btn",
                onClick: Q
              }, [
                w[21] || (w[21] = a("i", { class: "fa-solid fa-trash-can" }, null, -1)),
                a("span", null, g(S.value ? "删除" : "Delete"), 1)
              ])) : Ps("", !0),
              a("button", {
                type: "button",
                class: "ox-vite-role-primary-btn",
                onClick: te
              }, [
                w[22] || (w[22] = a("i", { class: "fa-solid fa-check" }, null, -1)),
                a("span", null, g(S.value ? "保存" : "Save"), 1)
              ])
            ])
          ]),
          a("div", Aa, [
            a("aside", Ea, [
              a("div", Pa, [
                a("button", {
                  type: "button",
                  class: "ox-vite-role-avatar-upload__circle",
                  style: xt({ background: H.value.avatarBackground }),
                  onClick: j
                }, [
                  H.value.avatarImage ? (N(), $("img", {
                    key: 0,
                    src: H.value.avatarImage,
                    alt: H.value.name
                  }, null, 8, Ia)) : (N(), $("span", Oa, g(H.value.avatarText), 1)),
                  a("div", La, [
                    w[23] || (w[23] = a("i", { class: "fa-solid fa-camera" }, null, -1)),
                    a("span", null, g(S.value ? "更换头像" : "Change avatar"), 1)
                  ])
                ], 4),
                a("button", {
                  type: "button",
                  class: "ox-vite-role-avatar-upload__button",
                  onClick: j
                }, [
                  w[24] || (w[24] = a("i", { class: "fa-solid fa-cloud-arrow-up" }, null, -1)),
                  a("span", null, g(S.value ? "上传头像" : "Upload avatar"), 1)
                ])
              ]),
              a("div", Fa, [
                a("strong", null, g(S.value ? "角色概览" : "Role Overview"), 1),
                a("p", null, g(H.value.canDelete ? S.value ? "当前角色已接入角色库，可继续编辑并保存。" : "This role already exists in the library and can be refined here." : S.value ? "新角色会在保存后加入角色库。" : "A new role will be added to the library after saving."), 1)
              ]),
              a("div", ka, [
                a("span", Va, g(H.value.memoryEnabled ? S.value ? "长记忆开启" : "Memory On" : S.value ? "长记忆关闭" : "Memory Off"), 1),
                a("span", Da, g(H.value.infer ? S.value ? "自动推理" : "Infer" : S.value ? "手动维护" : "Manual"), 1),
                a("span", Na, g(H.value.backendLabel), 1)
              ])
            ]),
            a("div", $a, [
              a("label", ja, [
                a("span", null, g(S.value ? "角色名称" : "Role name"), 1),
                a("input", {
                  value: H.value.name,
                  type: "text",
                  placeholder: S.value ? "例如：智能助手" : "e.g. Assistant",
                  onInput: w[1] || (w[1] = (m) => d("name", m))
                }, null, 40, Ha)
              ]),
              a("label", Ba, [
                a("span", null, g(S.value ? "描述" : "Description"), 1),
                a("textarea", {
                  value: H.value.description,
                  rows: "3",
                  placeholder: S.value ? "说明这个角色主要负责什么、适合什么场景。" : "Describe what this role does and when to use it.",
                  onInput: w[2] || (w[2] = (m) => d("description", m))
                }, null, 40, Wa)
              ]),
              a("label", Ua, [
                a("span", null, g(S.value ? "性格设定" : "Personality setting"), 1),
                a("textarea", {
                  value: H.value.personality,
                  rows: "3",
                  placeholder: S.value ? "例如：表达清晰、耐心、直接，回答前先拆解问题，避免夸张和空泛表述。" : "e.g. Clear, patient, direct, breaks down the problem first, avoids vague wording.",
                  onInput: w[3] || (w[3] = (m) => d("personality", m))
                }, null, 40, Ka)
              ]),
              a("label", qa, [
                a("span", null, g(S.value ? "系统提示词" : "System prompt"), 1),
                a("textarea", {
                  value: H.value.systemPrompt,
                  rows: "7",
                  placeholder: S.value ? "定义角色身份、职责边界、决策规则和输出风格。" : "Define identity, responsibilities, boundaries, decision rules, and output style.",
                  onInput: w[4] || (w[4] = (m) => d("systemPrompt", m))
                }, null, 40, Ga)
              ]),
              a("label", Ja, [
                a("span", null, g(S.value ? "开场白" : "First greeting"), 1),
                a("textarea", {
                  value: H.value.firstMes,
                  rows: "3",
                  onInput: w[5] || (w[5] = (m) => d("firstMes", m))
                }, null, 40, za)
              ]),
              a("label", Ya, [
                a("span", null, g(S.value ? "绑定记忆模型" : "Memory model binding"), 1),
                a("select", {
                  value: H.value.providerId,
                  onChange: F
                }, [
                  (N(!0), $(oe, null, Re(H.value.providerOptions, (m) => (N(), $("option", {
                    key: m.value,
                    value: m.value
                  }, g(m.label), 9, Qa))), 128))
                ], 40, Xa)
              ]),
              a("div", Za, [
                a("span", null, g(S.value ? "长记忆检索数量" : "Memory result count"), 1),
                a("div", ec, [
                  a("input", {
                    value: H.value.memoryLimit,
                    type: "range",
                    min: "1",
                    max: "20",
                    step: "1",
                    onInput: E
                  }, null, 40, tc),
                  a("strong", null, g(H.value.memoryLimit), 1)
                ])
              ]),
              a("div", nc, [
                a("label", sc, [
                  a("span", null, [
                    a("strong", null, g(S.value ? "启用长记忆" : "Enable memory"), 1),
                    a("small", null, g(H.value.backendLabel), 1)
                  ]),
                  a("input", {
                    checked: H.value.memoryEnabled,
                    type: "checkbox",
                    onChange: A
                  }, null, 40, ic)
                ]),
                a("label", oc, [
                  a("span", null, [
                    a("strong", null, g(S.value ? "自动推理更新" : "Auto infer"), 1),
                    a("small", null, g(S.value ? "生成时补充角色记忆" : "Update memory while generating"), 1)
                  ]),
                  a("input", {
                    checked: H.value.infer,
                    type: "checkbox",
                    onChange: v
                  }, null, 40, lc)
                ])
              ]),
              a("label", rc, [
                a("span", null, g(S.value ? "用户称呼" : "User label"), 1),
                a("input", {
                  value: H.value.userName,
                  type: "text",
                  onInput: w[6] || (w[6] = (m) => W("userName", m))
                }, null, 40, ac)
              ]),
              a("label", cc, [
                a("span", null, g(S.value ? "通用系统提示" : "Generic system prompt"), 1),
                a("textarea", {
                  value: H.value.genericSystemPrompt,
                  rows: "4",
                  onInput: w[7] || (w[7] = (m) => W("genericSystemPrompt", m))
                }, null, 40, uc)
              ])
            ])
          ])
        ])
      ])) : nt.value === "voice" ? (N(), $("div", fc, [
        a("section", dc, [
          a("div", pc, [
            a("h1", null, g(S.value ? "多角色语音配置" : "Multi-role Voice"), 1),
            a("p", null, g(S.value ? "为每个角色配置独立的语音合成方案" : "Assign voice synthesis settings across roles."), 1)
          ]),
          a("h2", null, g(S.value ? "语音供应商" : "Voice Providers"), 1),
          a("div", hc, [
            (N(!0), $(oe, null, Re(_e.value.providers, (m) => (N(), $("button", {
              key: m.id,
              type: "button",
              class: ot(["ox-vite-role-provider-card", { active: m.active }])
            }, [
              w[25] || (w[25] = a("i", { class: "fa-solid fa-waveform-lines" }, null, -1)),
              a("span", null, g(m.label), 1)
            ], 2))), 128))
          ]),
          a("h2", null, g(S.value ? "角色语音分配" : "Role Voice Mapping"), 1),
          a("div", gc, [
            a("table", vc, [
              a("thead", null, [
                a("tr", null, [
                  a("th", null, g(S.value ? "角色" : "Role"), 1),
                  a("th", null, g(S.value ? "语音模型" : "Voice Model"), 1),
                  a("th", null, g(S.value ? "音色" : "Tone"), 1),
                  a("th", null, g(S.value ? "语速" : "Speed"), 1),
                  a("th", null, g(S.value ? "音调" : "Pitch"), 1),
                  a("th", null, g(S.value ? "试听" : "Preview"), 1)
                ])
              ]),
              a("tbody", null, [
                (N(!0), $(oe, null, Re(_e.value.rows, (m) => (N(), $("tr", {
                  key: m.id
                }, [
                  a("td", null, [
                    a("strong", null, g(m.name), 1)
                  ]),
                  a("td", null, g(m.model), 1),
                  a("td", null, g(m.tone), 1),
                  a("td", null, g(m.speed), 1),
                  a("td", null, g(m.pitch), 1),
                  a("td", null, [
                    a("button", {
                      type: "button",
                      class: "ox-vite-role-play-btn",
                      onClick: O
                    }, [...w[26] || (w[26] = [
                      a("i", { class: "fa-solid fa-play" }, null, -1)
                    ])])
                  ])
                ]))), 128))
              ])
            ])
          ]),
          a("h2", null, g(S.value ? "全局设置" : "Global Settings"), 1),
          a("div", mc, [
            a("label", _c, [
              a("span", null, g(S.value ? "语言" : "Language"), 1),
              a("input", {
                value: _e.value.selectedLanguage,
                type: "text",
                onInput: w[8] || (w[8] = (m) => U("edgettsLanguage", m))
              }, null, 40, yc)
            ]),
            a("label", bc, [
              a("span", null, g(S.value ? "性别" : "Gender"), 1),
              a("select", {
                value: _e.value.selectedGender,
                onChange: w[9] || (w[9] = (m) => U("edgettsGender", m))
              }, [
                a("option", Sc, g(S.value ? "女声" : "Female"), 1),
                a("option", wc, g(S.value ? "男声" : "Male"), 1)
              ], 40, xc)
            ]),
            a("label", Mc, [
              a("span", null, g(S.value ? "默认音色" : "Default Voice"), 1),
              a("select", {
                value: _e.value.selectedVoice,
                onChange: w[10] || (w[10] = (m) => U("edgettsVoice", m))
              }, [
                (N(!0), $(oe, null, Re(_e.value.voiceOptions, (m) => (N(), $("option", {
                  key: m.value,
                  value: m.value
                }, g(m.label), 9, Tc))), 128))
              ], 40, Cc)
            ]),
            a("label", Rc, [
              a("span", null, g(S.value ? "默认语速" : "Default Rate"), 1),
              a("input", {
                value: _e.value.selectedRate,
                type: "number",
                min: "0.5",
                max: "2",
                step: "0.1",
                onInput: w[11] || (w[11] = (m) => U("edgettsRate", m))
              }, null, 40, Ac)
            ]),
            a("label", Ec, [
              a("span", null, g(S.value ? "试听文本" : "Sample Text"), 1),
              a("textarea", {
                value: _e.value.sampleText,
                rows: "3",
                onInput: w[12] || (w[12] = (m) => U("SampleText", m))
              }, null, 40, Pc)
            ])
          ])
        ])
      ])) : nt.value === "appearance" ? (N(), $("div", Ic, [
        a("section", Oc, [
          a("div", Lc, [
            a("h1", null, g(S.value ? "多角色外观配置" : "Multi-role Appearance"), 1),
            a("p", null, g(S.value ? "自定义每个角色的形象和动画表现" : "Customize each role avatar and motion presence."), 1)
          ]),
          a("h2", null, g(S.value ? "角色形象" : "Role Avatars"), 1),
          a("div", Fc, [
            (N(!0), $(oe, null, Re(ue.value.avatars, (m) => (N(), $("article", {
              key: m.id,
              class: "ox-vite-role-avatar-card"
            }, [
              a("div", {
                class: "ox-vite-role-avatar-card__img",
                style: xt({ background: m.avatarBackground })
              }, [
                m.avatarImage ? (N(), $("img", {
                  key: 0,
                  src: m.avatarImage,
                  alt: m.name
                }, null, 8, kc)) : (N(), $("span", Vc, g(m.shortName), 1))
              ], 4),
              a("span", Dc, g(m.name), 1),
              a("button", {
                type: "button",
                class: "ox-vite-role-secondary-btn",
                onClick: j
              }, [
                w[27] || (w[27] = a("i", { class: "fa-solid fa-arrows-rotate" }, null, -1)),
                a("span", null, g(S.value ? "更换形象" : "Change"), 1)
              ])
            ]))), 128))
          ]),
          a("h2", null, g(S.value ? "VRM 模型配置" : "VRM Model"), 1),
          a("div", Nc, [
            a("button", {
              type: "button",
              class: "ox-vite-role-vrm-upload",
              onClick: se
            }, [
              w[28] || (w[28] = a("i", { class: "fa-solid fa-cloud-arrow-up" }, null, -1)),
              a("span", null, g(S.value ? "拖拽或点击上传 VRM 文件" : "Upload VRM file"), 1),
              a("small", null, g(S.value ? "支持 .vrm 格式，最大 50MB" : "Supports .vrm up to 50MB"), 1)
            ]),
            a("div", $c, [
              a("label", jc, [
                a("span", null, g(S.value ? "当前模型" : "Current Model"), 1),
                a("select", {
                  value: ue.value.selectedModelId,
                  onChange: Se
                }, [
                  a("option", Bc, g(S.value ? "未选择模型" : "No model selected"), 1),
                  (N(!0), $(oe, null, Re(ue.value.modelOptions, (m) => (N(), $("option", {
                    key: m.value,
                    value: m.value
                  }, g(m.label), 9, Wc))), 128))
                ], 40, Hc)
              ]),
              a("div", Uc, [
                a("div", null, [
                  a("strong", null, g(ue.value.motionCount), 1),
                  a("span", null, g(S.value ? "动作映射" : "motions"), 1)
                ]),
                a("div", null, [
                  a("strong", null, g(ue.value.windowSize), 1),
                  a("span", null, g(S.value ? "窗口尺寸" : "window size"), 1)
                ]),
                a("div", null, [
                  a("strong", null, g(ue.value.selectedScene), 1),
                  a("span", null, g(S.value ? "场景" : "scene"), 1)
                ])
              ]),
              a("div", Kc, [
                a("label", qc, [
                  a("span", null, [
                    a("strong", null, g(S.value ? "表情映射" : "Expressions"), 1),
                    a("small", null, g(S.value ? "跟随角色输出驱动表情" : "Drive facial expressions from output"), 1)
                  ]),
                  a("input", {
                    checked: ue.value.expressionsEnabled,
                    type: "checkbox",
                    onChange: w[13] || (w[13] = (m) => Te("enabledExpressions", m))
                  }, null, 40, Gc)
                ]),
                a("label", Jc, [
                  a("span", null, [
                    a("strong", null, g(S.value ? "动作映射" : "Motions"), 1),
                    a("small", null, g(S.value ? "启用动作集合" : "Enable motion set"), 1)
                  ]),
                  a("input", {
                    checked: ue.value.motionsEnabled,
                    type: "checkbox",
                    onChange: w[14] || (w[14] = (m) => Te("enabledMotions", m))
                  }, null, 40, zc)
                ])
              ])
            ])
          ])
        ])
      ])) : nt.value === "behavior" ? (N(), $("div", Yc, [
        a("section", Xc, [
          a("div", Qc, [
            a("h1", null, g(S.value ? "自主行为配置" : "Autonomous Behavior"), 1),
            a("p", null, g(S.value ? "定义角色在无人操作时的主动行为" : "Define what roles do proactively when unattended."), 1)
          ]),
          a("div", Zc, [
            (N(!0), $(oe, null, Re(ye.value.rules, (m, st) => (N(), $("article", {
              key: m.id,
              class: "ox-vite-role-behavior-card"
            }, [
              w[29] || (w[29] = a("div", { class: "ox-vite-role-behavior-card__icon" }, [
                a("i", { class: "fa-solid fa-bolt" })
              ], -1)),
              a("div", eu, [
                a("strong", null, g(m.name), 1),
                a("p", null, g(m.description), 1)
              ]),
              a("div", tu, [
                a("span", null, g(m.frequency), 1),
                ye.value.hasRealData ? (N(), $("input", {
                  key: 0,
                  checked: m.enabled,
                  type: "checkbox",
                  onChange: (zt) => Oe(st)
                }, null, 40, nu)) : (N(), $("span", su, g(m.enabled ? S.value ? "已启用" : "Enabled" : S.value ? "未启用" : "Disabled"), 1))
              ])
            ]))), 128))
          ]),
          a("button", {
            type: "button",
            class: "ox-vite-role-primary-btn",
            onClick: ht
          }, [
            w[30] || (w[30] = a("i", { class: "fa-solid fa-plus" }, null, -1)),
            a("span", null, g(S.value ? "添加行为规则" : "Add behavior rule"), 1)
          ])
        ])
      ])) : (N(), $("div", iu, [
        a("section", ou, [
          a("div", lu, [
            a("h1", null, g(S.value ? "桌面视觉" : "Desktop Vision"), 1),
            a("p", null, g(S.value ? "让角色能够感知和理解桌面内容" : "Let roles perceive and understand what is on the desktop."), 1)
          ]),
          a("h2", null, g(S.value ? "屏幕捕获设置" : "Screen Capture"), 1),
          a("div", ru, [
            a("label", au, [
              a("span", null, [
                a("strong", null, g(S.value ? "启用桌面视觉" : "Enable desktop vision"), 1),
                a("small", null, g(S.value ? "开启后角色可以感知屏幕内容" : "Roles can inspect what is on screen"), 1)
              ]),
              a("input", {
                checked: we.value.desktopVision,
                type: "checkbox",
                onChange: w[15] || (w[15] = (m) => Le("desktopVision", m))
              }, null, 40, cu)
            ]),
            a("label", uu, [
              a("span", null, g(S.value ? "截图频率" : "Capture frequency"), 1),
              a("input", {
                value: we.value.captureFrequency,
                type: "text",
                readonly: ""
              }, null, 8, fu)
            ]),
            a("label", du, [
              a("span", null, g(S.value ? "识别区域" : "Capture scope"), 1),
              a("input", {
                value: we.value.captureScope,
                type: "text",
                readonly: ""
              }, null, 8, pu)
            ])
          ]),
          a("h2", null, g(S.value ? "视觉模型绑定" : "Vision Model"), 1),
          a("div", hu, [
            a("label", gu, [
              a("span", null, g(S.value ? "视觉供应商" : "Vision provider"), 1),
              a("select", {
                value: we.value.selectedProvider,
                onChange: gt
              }, [
                a("option", mu, g(S.value ? "请选择视觉供应商" : "Select a provider"), 1),
                (N(!0), $(oe, null, Re(we.value.providerOptions, (m) => (N(), $("option", {
                  key: m.value,
                  value: m.value
                }, g(m.label), 9, _u))), 128))
              ], 40, vu)
            ]),
            a("label", yu, [
              a("span", null, g(S.value ? "当前视觉模型" : "Current vision model"), 1),
              a("input", {
                value: we.value.modelLabel,
                type: "text",
                readonly: ""
              }, null, 8, bu)
            ])
          ]),
          a("h2", null, g(S.value ? "唤醒词与隐私" : "Wake Words and Privacy"), 1),
          a("div", xu, [
            a("label", Su, [
              a("span", null, [
                a("strong", null, g(S.value ? "启用视觉唤醒词" : "Enable vision wake words"), 1),
                a("small", null, g(S.value ? "检测到关键词时读取桌面内容" : "Read desktop content after wake word matches"), 1)
              ]),
              a("input", {
                checked: we.value.enableWakeWord,
                type: "checkbox",
                onChange: w[16] || (w[16] = (m) => Le("enableWakeWord", m))
              }, null, 40, wu)
            ]),
            a("label", Mu, [
              a("span", null, g(S.value ? "唤醒词" : "Wake words"), 1),
              a("textarea", {
                value: we.value.wakeWord,
                rows: "4",
                onInput: w[17] || (w[17] = (m) => rt("wakeWord", m))
              }, null, 40, Cu)
            ]),
            a("div", Tu, [
              a("span", null, g(S.value ? "排除应用列表" : "Excluded apps"), 1),
              a("div", Ru, [
                (N(!0), $(oe, null, Re(we.value.excludeApps, (m) => (N(), $("span", {
                  key: m,
                  class: "ox-vite-role-chip"
                }, g(m), 1))), 128))
              ])
            ])
          ])
        ])
      ]))
    ]));
  }
};
function Un() {
  const e = document.getElementById("openxnet-vite-role-root");
  !e || e.dataset.viteMounted === "true" || (Ar(Au).mount(e), e.dataset.viteMounted = "true");
}
document.readyState === "loading" ? document.addEventListener("DOMContentLoaded", Un, { once: !0 }) : Un();
window.addEventListener("openxnet-vite-role-remount", Un);
