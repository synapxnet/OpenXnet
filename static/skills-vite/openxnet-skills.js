// @__NO_SIDE_EFFECTS__
function Ws(e) {
  const t = /* @__PURE__ */ Object.create(null);
  for (const s of e.split(",")) t[s] = 1;
  return (s) => s in t;
}
const Y = {}, gt = [], Fe = () => {
}, Bn = () => !1, rs = (e) => e.charCodeAt(0) === 111 && e.charCodeAt(1) === 110 && // uppercase letter
(e.charCodeAt(2) > 122 || e.charCodeAt(2) < 97), as = (e) => e.startsWith("onUpdate:"), fe = Object.assign, Vs = (e, t) => {
  const s = e.indexOf(t);
  s > -1 && e.splice(s, 1);
}, il = Object.prototype.hasOwnProperty, B = (e, t) => il.call(e, t), j = Array.isArray, vt = (e) => Ht(e) === "[object Map]", qn = (e) => Ht(e) === "[object Set]", pn = (e) => Ht(e) === "[object Date]", F = (e) => typeof e == "function", ie = (e) => typeof e == "string", Ne = (e) => typeof e == "symbol", z = (e) => e !== null && typeof e == "object", zn = (e) => (z(e) || F(e)) && F(e.then) && F(e.catch), Jn = Object.prototype.toString, Ht = (e) => Jn.call(e), ll = (e) => Ht(e).slice(8, -1), Yn = (e) => Ht(e) === "[object Object]", Gs = (e) => ie(e) && e !== "NaN" && e[0] !== "-" && "" + parseInt(e, 10) === e, Pt = /* @__PURE__ */ Ws(
  // the leading comma is intentional so empty string "" is also included
  ",key,ref,ref_for,ref_key,onVnodeBeforeMount,onVnodeMounted,onVnodeBeforeUpdate,onVnodeUpdated,onVnodeBeforeUnmount,onVnodeUnmounted"
), cs = (e) => {
  const t = /* @__PURE__ */ Object.create(null);
  return ((s) => t[s] || (t[s] = e(s)));
}, ol = /-\w/g, Ce = cs(
  (e) => e.replace(ol, (t) => t.slice(1).toUpperCase())
), rl = /\B([A-Z])/g, ct = cs(
  (e) => e.replace(rl, "-$1").toLowerCase()
), Qn = cs((e) => e.charAt(0).toUpperCase() + e.slice(1)), ys = cs(
  (e) => e ? `on${Qn(e)}` : ""
), je = (e, t) => !Object.is(e, t), Jt = (e, ...t) => {
  for (let s = 0; s < e.length; s++)
    e[s](...t);
}, Xn = (e, t, s, n = !1) => {
  Object.defineProperty(e, t, {
    configurable: !0,
    enumerable: !1,
    writable: n,
    value: s
  });
}, Ks = (e) => {
  const t = parseFloat(e);
  return isNaN(t) ? e : t;
};
let gn;
const us = () => gn || (gn = typeof globalThis < "u" ? globalThis : typeof self < "u" ? self : typeof window < "u" ? window : typeof globalThis < "u" ? globalThis : {});
function Bs(e) {
  if (j(e)) {
    const t = {};
    for (let s = 0; s < e.length; s++) {
      const n = e[s], i = ie(n) ? fl(n) : Bs(n);
      if (i)
        for (const l in i)
          t[l] = i[l];
    }
    return t;
  } else if (ie(e) || z(e))
    return e;
}
const al = /;(?![^(]*\))/g, cl = /:([^]+)/, ul = /\/\*[^]*?\*\//g;
function fl(e) {
  const t = {};
  return e.replace(ul, "").split(al).forEach((s) => {
    if (s) {
      const n = s.split(cl);
      n.length > 1 && (t[n[0].trim()] = n[1].trim());
    }
  }), t;
}
function te(e) {
  let t = "";
  if (ie(e))
    t = e;
  else if (j(e))
    for (let s = 0; s < e.length; s++) {
      const n = te(e[s]);
      n && (t += n + " ");
    }
  else if (z(e))
    for (const s in e)
      e[s] && (t += s + " ");
  return t.trim();
}
const dl = "itemscope,allowfullscreen,formnovalidate,ismap,nomodule,novalidate,readonly", hl = /* @__PURE__ */ Ws(dl);
function ei(e) {
  return !!e || e === "";
}
function pl(e, t) {
  if (e.length !== t.length) return !1;
  let s = !0;
  for (let n = 0; s && n < e.length; n++)
    s = qs(e[n], t[n]);
  return s;
}
function qs(e, t) {
  if (e === t) return !0;
  let s = pn(e), n = pn(t);
  if (s || n)
    return s && n ? e.getTime() === t.getTime() : !1;
  if (s = Ne(e), n = Ne(t), s || n)
    return e === t;
  if (s = j(e), n = j(t), s || n)
    return s && n ? pl(e, t) : !1;
  if (s = z(e), n = z(t), s || n) {
    if (!s || !n)
      return !1;
    const i = Object.keys(e).length, l = Object.keys(t).length;
    if (i !== l)
      return !1;
    for (const o in e) {
      const c = e.hasOwnProperty(o), f = t.hasOwnProperty(o);
      if (c && !f || !c && f || !qs(e[o], t[o]))
        return !1;
    }
  }
  return String(e) === String(t);
}
const ti = (e) => !!(e && e.__v_isRef === !0), v = (e) => ie(e) ? e : e == null ? "" : j(e) || z(e) && (e.toString === Jn || !F(e.toString)) ? ti(e) ? v(e.value) : JSON.stringify(e, si, 2) : String(e), si = (e, t) => ti(t) ? si(e, t.value) : vt(t) ? {
  [`Map(${t.size})`]: [...t.entries()].reduce(
    (s, [n, i], l) => (s[ms(n, l) + " =>"] = i, s),
    {}
  )
} : qn(t) ? {
  [`Set(${t.size})`]: [...t.values()].map((s) => ms(s))
} : Ne(t) ? ms(t) : z(t) && !j(t) && !Yn(t) ? String(t) : t, ms = (e, t = "") => {
  var s;
  return (
    // Symbol.description in es2019+ so we need to cast here to pass
    // the lib: es2016 check
    Ne(e) ? `Symbol(${(s = e.description) != null ? s : t})` : e
  );
};
let ae;
class gl {
  // TODO isolatedDeclarations "__v_skip"
  constructor(t = !1) {
    this.detached = t, this._active = !0, this._on = 0, this.effects = [], this.cleanups = [], this._isPaused = !1, this._warnOnRun = !0, this.__v_skip = !0, !t && ae && (ae.active ? (this.parent = ae, this.index = (ae.scopes || (ae.scopes = [])).push(
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
      const s = ae;
      try {
        return ae = this, t();
      } finally {
        ae = s;
      }
    }
  }
  /**
   * This should only be called on non-detached scopes
   * @internal
   */
  on() {
    ++this._on === 1 && (this.prevScope = ae, ae = this);
  }
  /**
   * This should only be called on non-detached scopes
   * @internal
   */
  off() {
    if (this._on > 0 && --this._on === 0) {
      if (ae === this)
        ae = this.prevScope;
      else {
        let t = ae;
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
function vl() {
  return ae;
}
let ee;
const ks = /* @__PURE__ */ new WeakSet();
class ni {
  constructor(t) {
    this.fn = t, this.deps = void 0, this.depsTail = void 0, this.flags = 5, this.next = void 0, this.cleanup = void 0, this.scheduler = void 0, ae && (ae.active ? ae.effects.push(this) : this.flags &= -2);
  }
  pause() {
    this.flags |= 64;
  }
  resume() {
    this.flags & 64 && (this.flags &= -65, ks.has(this) && (ks.delete(this), this.trigger()));
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
    this.flags |= 2, vn(this), oi(this);
    const t = ee, s = _e;
    ee = this, _e = !0;
    try {
      return this.fn();
    } finally {
      ri(this), ee = t, _e = s, this.flags &= -3;
    }
  }
  stop() {
    if (this.flags & 1) {
      for (let t = this.deps; t; t = t.nextDep)
        Ys(t);
      this.deps = this.depsTail = void 0, vn(this), this.onStop && this.onStop(), this.flags &= -2;
    }
  }
  trigger() {
    this.flags & 64 ? ks.add(this) : this.scheduler ? this.scheduler() : this.runIfDirty();
  }
  /**
   * @internal
   */
  runIfDirty() {
    Ps(this) && this.run();
  }
  get dirty() {
    return Ps(this);
  }
}
let ii = 0, At, Ot;
function li(e, t = !1) {
  if (e.flags |= 8, t) {
    e.next = Ot, Ot = e;
    return;
  }
  e.next = At, At = e;
}
function zs() {
  ii++;
}
function Js() {
  if (--ii > 0)
    return;
  if (Ot) {
    let t = Ot;
    for (Ot = void 0; t; ) {
      const s = t.next;
      t.next = void 0, t.flags &= -9, t = s;
    }
  }
  let e;
  for (; At; ) {
    let t = At;
    for (At = void 0; t; ) {
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
function oi(e) {
  for (let t = e.deps; t; t = t.nextDep)
    t.version = -1, t.prevActiveLink = t.dep.activeLink, t.dep.activeLink = t;
}
function ri(e) {
  let t, s = e.depsTail, n = s;
  for (; n; ) {
    const i = n.prevDep;
    n.version === -1 ? (n === s && (s = i), Ys(n), bl(n)) : t = n, n.dep.activeLink = n.prevActiveLink, n.prevActiveLink = void 0, n = i;
  }
  e.deps = t, e.depsTail = s;
}
function Ps(e) {
  for (let t = e.deps; t; t = t.nextDep)
    if (t.dep.version !== t.version || t.dep.computed && (ai(t.dep.computed) || t.dep.version !== t.version))
      return !0;
  return !!e._dirty;
}
function ai(e) {
  if (e.flags & 4 && !(e.flags & 16) || (e.flags &= -17, e.globalVersion === Ft) || (e.globalVersion = Ft, !e.isSSR && e.flags & 128 && (!e.deps && !e._dirty || !Ps(e))))
    return;
  e.flags |= 2;
  const t = e.dep, s = ee, n = _e;
  ee = e, _e = !0;
  try {
    oi(e);
    const i = e.fn(e._value);
    (t.version === 0 || je(i, e._value)) && (e.flags |= 128, e._value = i, t.version++);
  } catch (i) {
    throw t.version++, i;
  } finally {
    ee = s, _e = n, ri(e), e.flags &= -3;
  }
}
function Ys(e, t = !1) {
  const { dep: s, prevSub: n, nextSub: i } = e;
  if (n && (n.nextSub = i, e.prevSub = void 0), i && (i.prevSub = n, e.nextSub = void 0), s.subs === e && (s.subs = n, !n && s.computed)) {
    s.computed.flags &= -5;
    for (let l = s.computed.deps; l; l = l.nextDep)
      Ys(l, !0);
  }
  !t && !--s.sc && s.map && s.map.delete(s.key);
}
function bl(e) {
  const { prevDep: t, nextDep: s } = e;
  t && (t.nextDep = s, e.prevDep = void 0), s && (s.prevDep = t, e.nextDep = void 0);
}
let _e = !0;
const ci = [];
function qe() {
  ci.push(_e), _e = !1;
}
function ze() {
  const e = ci.pop();
  _e = e === void 0 ? !0 : e;
}
function vn(e) {
  const { cleanup: t } = e;
  if (e.cleanup = void 0, t) {
    const s = ee;
    ee = void 0;
    try {
      t();
    } finally {
      ee = s;
    }
  }
}
let Ft = 0;
class yl {
  constructor(t, s) {
    this.sub = t, this.dep = s, this.version = s.version, this.nextDep = this.prevDep = this.nextSub = this.prevSub = this.prevActiveLink = void 0;
  }
}
class Qs {
  // TODO isolatedDeclarations "__v_skip"
  constructor(t) {
    this.computed = t, this.version = 0, this.activeLink = void 0, this.subs = void 0, this.map = void 0, this.key = void 0, this.sc = 0, this.__v_skip = !0;
  }
  track(t) {
    if (!ee || !_e || ee === this.computed)
      return;
    let s = this.activeLink;
    if (s === void 0 || s.sub !== ee)
      s = this.activeLink = new yl(ee, this), ee.deps ? (s.prevDep = ee.depsTail, ee.depsTail.nextDep = s, ee.depsTail = s) : ee.deps = ee.depsTail = s, ui(s);
    else if (s.version === -1 && (s.version = this.version, s.nextDep)) {
      const n = s.nextDep;
      n.prevDep = s.prevDep, s.prevDep && (s.prevDep.nextDep = n), s.prevDep = ee.depsTail, s.nextDep = void 0, ee.depsTail.nextDep = s, ee.depsTail = s, ee.deps === s && (ee.deps = n);
    }
    return s;
  }
  trigger(t) {
    this.version++, Ft++, this.notify(t);
  }
  notify(t) {
    zs();
    try {
      for (let s = this.subs; s; s = s.prevSub)
        s.sub.notify() && s.sub.dep.notify();
    } finally {
      Js();
    }
  }
}
function ui(e) {
  if (e.dep.sc++, e.sub.flags & 4) {
    const t = e.dep.computed;
    if (t && !e.dep.subs) {
      t.flags |= 20;
      for (let n = t.deps; n; n = n.nextDep)
        ui(n);
    }
    const s = e.dep.subs;
    s !== e && (e.prevSub = s, s && (s.nextSub = e)), e.dep.subs = e;
  }
}
const As = /* @__PURE__ */ new WeakMap(), rt = /* @__PURE__ */ Symbol(
  ""
), Os = /* @__PURE__ */ Symbol(
  ""
), Dt = /* @__PURE__ */ Symbol(
  ""
);
function ce(e, t, s) {
  if (_e && ee) {
    let n = As.get(e);
    n || As.set(e, n = /* @__PURE__ */ new Map());
    let i = n.get(s);
    i || (n.set(s, i = new Qs()), i.map = n, i.key = s), i.track();
  }
}
function Ge(e, t, s, n, i, l) {
  const o = As.get(e);
  if (!o) {
    Ft++;
    return;
  }
  const c = (f) => {
    f && f.trigger();
  };
  if (zs(), t === "clear")
    o.forEach(c);
  else {
    const f = j(e), h = f && Gs(s);
    if (f && s === "length") {
      const d = Number(n);
      o.forEach((r, g) => {
        (g === "length" || g === Dt || !Ne(g) && g >= d) && c(r);
      });
    } else
      switch ((s !== void 0 || o.has(void 0)) && c(o.get(s)), h && c(o.get(Dt)), t) {
        case "add":
          f ? h && c(o.get("length")) : (c(o.get(rt)), vt(e) && c(o.get(Os)));
          break;
        case "delete":
          f || (c(o.get(rt)), vt(e) && c(o.get(Os)));
          break;
        case "set":
          vt(e) && c(o.get(rt));
          break;
      }
  }
  Js();
}
function dt(e) {
  const t = /* @__PURE__ */ K(e);
  return t === e ? t : (ce(t, "iterate", Dt), /* @__PURE__ */ we(e) ? t : t.map($e));
}
function fs(e) {
  return ce(e = /* @__PURE__ */ K(e), "iterate", Dt), e;
}
function Me(e, t) {
  return /* @__PURE__ */ Je(e) ? kt(/* @__PURE__ */ at(e) ? $e(t) : t) : $e(t);
}
const ml = {
  __proto__: null,
  [Symbol.iterator]() {
    return xs(this, Symbol.iterator, (e) => Me(this, e));
  },
  concat(...e) {
    return dt(this).concat(
      ...e.map((t) => j(t) ? dt(t) : t)
    );
  },
  entries() {
    return xs(this, "entries", (e) => (e[1] = Me(this, e[1]), e));
  },
  every(e, t) {
    return He(this, "every", e, t, void 0, arguments);
  },
  filter(e, t) {
    return He(
      this,
      "filter",
      e,
      t,
      (s) => s.map((n) => Me(this, n)),
      arguments
    );
  },
  find(e, t) {
    return He(
      this,
      "find",
      e,
      t,
      (s) => Me(this, s),
      arguments
    );
  },
  findIndex(e, t) {
    return He(this, "findIndex", e, t, void 0, arguments);
  },
  findLast(e, t) {
    return He(
      this,
      "findLast",
      e,
      t,
      (s) => Me(this, s),
      arguments
    );
  },
  findLastIndex(e, t) {
    return He(this, "findLastIndex", e, t, void 0, arguments);
  },
  // flat, flatMap could benefit from ARRAY_ITERATE but are not straight-forward to implement
  forEach(e, t) {
    return He(this, "forEach", e, t, void 0, arguments);
  },
  includes(...e) {
    return ws(this, "includes", e);
  },
  indexOf(...e) {
    return ws(this, "indexOf", e);
  },
  join(e) {
    return dt(this).join(e);
  },
  // keys() iterator only reads `length`, no optimization required
  lastIndexOf(...e) {
    return ws(this, "lastIndexOf", e);
  },
  map(e, t) {
    return He(this, "map", e, t, void 0, arguments);
  },
  pop() {
    return $t(this, "pop");
  },
  push(...e) {
    return $t(this, "push", e);
  },
  reduce(e, ...t) {
    return bn(this, "reduce", e, t);
  },
  reduceRight(e, ...t) {
    return bn(this, "reduceRight", e, t);
  },
  shift() {
    return $t(this, "shift");
  },
  // slice could use ARRAY_ITERATE but also seems to beg for range tracking
  some(e, t) {
    return He(this, "some", e, t, void 0, arguments);
  },
  splice(...e) {
    return $t(this, "splice", e);
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
    return $t(this, "unshift", e);
  },
  values() {
    return xs(this, "values", (e) => Me(this, e));
  }
};
function xs(e, t, s) {
  const n = fs(e), i = n[t]();
  return n !== e && !/* @__PURE__ */ we(e) && (i._next = i.next, i.next = () => {
    const l = i._next();
    return l.done || (l.value = s(l.value)), l;
  }), i;
}
const kl = Array.prototype;
function He(e, t, s, n, i, l) {
  const o = fs(e), c = o !== e && !/* @__PURE__ */ we(e), f = o[t];
  if (f !== kl[t]) {
    const r = f.apply(e, l);
    return c ? $e(r) : r;
  }
  let h = s;
  o !== e && (c ? h = function(r, g) {
    return s.call(this, Me(e, r), g, e);
  } : s.length > 2 && (h = function(r, g) {
    return s.call(this, r, g, e);
  }));
  const d = f.call(o, h, n);
  return c && i ? i(d) : d;
}
function bn(e, t, s, n) {
  const i = fs(e), l = i !== e && !/* @__PURE__ */ we(e);
  let o = s, c = !1;
  i !== e && (l ? (c = n.length === 0, o = function(h, d, r) {
    return c && (c = !1, h = Me(e, h)), s.call(this, h, Me(e, d), r, e);
  }) : s.length > 3 && (o = function(h, d, r) {
    return s.call(this, h, d, r, e);
  }));
  const f = i[t](o, ...n);
  return c ? Me(e, f) : f;
}
function ws(e, t, s) {
  const n = /* @__PURE__ */ K(e);
  ce(n, "iterate", Dt);
  const i = n[t](...s);
  return (i === -1 || i === !1) && /* @__PURE__ */ sn(s[0]) ? (s[0] = /* @__PURE__ */ K(s[0]), n[t](...s)) : i;
}
function $t(e, t, s = []) {
  qe(), zs();
  const n = (/* @__PURE__ */ K(e))[t].apply(e, s);
  return Js(), ze(), n;
}
const xl = /* @__PURE__ */ Ws("__proto__,__v_isRef,__isVue"), fi = new Set(
  /* @__PURE__ */ Object.getOwnPropertyNames(Symbol).filter((e) => e !== "arguments" && e !== "caller").map((e) => Symbol[e]).filter(Ne)
);
function wl(e) {
  Ne(e) || (e = String(e));
  const t = /* @__PURE__ */ K(this);
  return ce(t, "has", e), t.hasOwnProperty(e);
}
class di {
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
      return n === (i ? l ? Ol : vi : l ? gi : pi).get(t) || // receiver is not the reactive proxy, but has the same prototype
      // this means the receiver is a user proxy of the reactive proxy
      Object.getPrototypeOf(t) === Object.getPrototypeOf(n) ? t : void 0;
    const o = j(t);
    if (!i) {
      let f;
      if (o && (f = ml[s]))
        return f;
      if (s === "hasOwnProperty")
        return wl;
    }
    const c = Reflect.get(
      t,
      s,
      // if this is a proxy wrapping a ref, return methods using the raw ref
      // as receiver so that we don't have to call `toRaw` on the ref in all
      // its class methods
      /* @__PURE__ */ ue(t) ? t : n
    );
    if ((Ne(s) ? fi.has(s) : xl(s)) || (i || ce(t, "get", s), l))
      return c;
    if (/* @__PURE__ */ ue(c)) {
      const f = o && Gs(s) ? c : c.value;
      return i && z(f) ? /* @__PURE__ */ Rs(f) : f;
    }
    return z(c) ? i ? /* @__PURE__ */ Rs(c) : /* @__PURE__ */ en(c) : c;
  }
}
class hi extends di {
  constructor(t = !1) {
    super(!1, t);
  }
  set(t, s, n, i) {
    let l = t[s];
    const o = j(t) && Gs(s);
    if (!this._isShallow) {
      const h = /* @__PURE__ */ Je(l);
      if (!/* @__PURE__ */ we(n) && !/* @__PURE__ */ Je(n) && (l = /* @__PURE__ */ K(l), n = /* @__PURE__ */ K(n)), !o && /* @__PURE__ */ ue(l) && !/* @__PURE__ */ ue(n))
        return h || (l.value = n), !0;
    }
    const c = o ? Number(s) < t.length : B(t, s), f = Reflect.set(
      t,
      s,
      n,
      /* @__PURE__ */ ue(t) ? t : i
    );
    return t === /* @__PURE__ */ K(i) && (c ? je(n, l) && Ge(t, "set", s, n) : Ge(t, "add", s, n)), f;
  }
  deleteProperty(t, s) {
    const n = B(t, s);
    t[s];
    const i = Reflect.deleteProperty(t, s);
    return i && n && Ge(t, "delete", s, void 0), i;
  }
  has(t, s) {
    const n = Reflect.has(t, s);
    return (!Ne(s) || !fi.has(s)) && ce(t, "has", s), n;
  }
  ownKeys(t) {
    return ce(
      t,
      "iterate",
      j(t) ? "length" : rt
    ), Reflect.ownKeys(t);
  }
}
class Sl extends di {
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
const Cl = /* @__PURE__ */ new hi(), _l = /* @__PURE__ */ new Sl(), $l = /* @__PURE__ */ new hi(!0);
const Ms = (e) => e, Bt = (e) => Reflect.getPrototypeOf(e);
function El(e, t, s) {
  return function(...n) {
    const i = this.__v_raw, l = /* @__PURE__ */ K(i), o = vt(l), c = e === "entries" || e === Symbol.iterator && o, f = e === "keys" && o, h = i[e](...n), d = s ? Ms : t ? kt : $e;
    return !t && ce(
      l,
      "iterate",
      f ? Os : rt
    ), fe(
      // inheriting all iterator properties
      Object.create(h),
      {
        // iterator protocol
        next() {
          const { value: r, done: g } = h.next();
          return g ? { value: r, done: g } : {
            value: c ? [d(r[0]), d(r[1])] : d(r),
            done: g
          };
        }
      }
    );
  };
}
function qt(e) {
  return function(...t) {
    return e === "delete" ? !1 : e === "clear" ? void 0 : this;
  };
}
function Il(e, t) {
  const s = {
    get(i) {
      const l = this.__v_raw, o = /* @__PURE__ */ K(l), c = /* @__PURE__ */ K(i);
      e || (je(i, c) && ce(o, "get", i), ce(o, "get", c));
      const { has: f } = Bt(o), h = t ? Ms : e ? kt : $e;
      if (f.call(o, i))
        return h(l.get(i));
      if (f.call(o, c))
        return h(l.get(c));
      l !== o && l.get(i);
    },
    get size() {
      const i = this.__v_raw;
      return !e && ce(/* @__PURE__ */ K(i), "iterate", rt), i.size;
    },
    has(i) {
      const l = this.__v_raw, o = /* @__PURE__ */ K(l), c = /* @__PURE__ */ K(i);
      return e || (je(i, c) && ce(o, "has", i), ce(o, "has", c)), i === c ? l.has(i) : l.has(i) || l.has(c);
    },
    forEach(i, l) {
      const o = this, c = o.__v_raw, f = /* @__PURE__ */ K(c), h = t ? Ms : e ? kt : $e;
      return !e && ce(f, "iterate", rt), c.forEach((d, r) => i.call(l, h(d), h(r), o));
    }
  };
  return fe(
    s,
    e ? {
      add: qt("add"),
      set: qt("set"),
      delete: qt("delete"),
      clear: qt("clear")
    } : {
      add(i) {
        const l = /* @__PURE__ */ K(this), o = Bt(l), c = /* @__PURE__ */ K(i), f = !t && !/* @__PURE__ */ we(i) && !/* @__PURE__ */ Je(i) ? c : i;
        return o.has.call(l, f) || je(i, f) && o.has.call(l, i) || je(c, f) && o.has.call(l, c) || (l.add(f), Ge(l, "add", f, f)), this;
      },
      set(i, l) {
        !t && !/* @__PURE__ */ we(l) && !/* @__PURE__ */ Je(l) && (l = /* @__PURE__ */ K(l));
        const o = /* @__PURE__ */ K(this), { has: c, get: f } = Bt(o);
        let h = c.call(o, i);
        h || (i = /* @__PURE__ */ K(i), h = c.call(o, i));
        const d = f.call(o, i);
        return o.set(i, l), h ? je(l, d) && Ge(o, "set", i, l) : Ge(o, "add", i, l), this;
      },
      delete(i) {
        const l = /* @__PURE__ */ K(this), { has: o, get: c } = Bt(l);
        let f = o.call(l, i);
        f || (i = /* @__PURE__ */ K(i), f = o.call(l, i)), c && c.call(l, i);
        const h = l.delete(i);
        return f && Ge(l, "delete", i, void 0), h;
      },
      clear() {
        const i = /* @__PURE__ */ K(this), l = i.size !== 0, o = i.clear();
        return l && Ge(
          i,
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
  ].forEach((i) => {
    s[i] = El(i, e, t);
  }), s;
}
function Xs(e, t) {
  const s = Il(e, t);
  return (n, i, l) => i === "__v_isReactive" ? !e : i === "__v_isReadonly" ? e : i === "__v_raw" ? n : Reflect.get(
    B(s, i) && i in n ? s : n,
    i,
    l
  );
}
const Tl = {
  get: /* @__PURE__ */ Xs(!1, !1)
}, Pl = {
  get: /* @__PURE__ */ Xs(!1, !0)
}, Al = {
  get: /* @__PURE__ */ Xs(!0, !1)
};
const pi = /* @__PURE__ */ new WeakMap(), gi = /* @__PURE__ */ new WeakMap(), vi = /* @__PURE__ */ new WeakMap(), Ol = /* @__PURE__ */ new WeakMap();
function Ml(e) {
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
function Rl(e) {
  return e.__v_skip || !Object.isExtensible(e) ? 0 : Ml(ll(e));
}
// @__NO_SIDE_EFFECTS__
function en(e) {
  return /* @__PURE__ */ Je(e) ? e : tn(
    e,
    !1,
    Cl,
    Tl,
    pi
  );
}
// @__NO_SIDE_EFFECTS__
function Ll(e) {
  return tn(
    e,
    !1,
    $l,
    Pl,
    gi
  );
}
// @__NO_SIDE_EFFECTS__
function Rs(e) {
  return tn(
    e,
    !0,
    _l,
    Al,
    vi
  );
}
function tn(e, t, s, n, i) {
  if (!z(e) || e.__v_raw && !(t && e.__v_isReactive))
    return e;
  const l = Rl(e);
  if (l === 0)
    return e;
  const o = i.get(e);
  if (o)
    return o;
  const c = new Proxy(
    e,
    l === 2 ? n : s
  );
  return i.set(e, c), c;
}
// @__NO_SIDE_EFFECTS__
function at(e) {
  return /* @__PURE__ */ Je(e) ? /* @__PURE__ */ at(e.__v_raw) : !!(e && e.__v_isReactive);
}
// @__NO_SIDE_EFFECTS__
function Je(e) {
  return !!(e && e.__v_isReadonly);
}
// @__NO_SIDE_EFFECTS__
function we(e) {
  return !!(e && e.__v_isShallow);
}
// @__NO_SIDE_EFFECTS__
function sn(e) {
  return e ? !!e.__v_raw : !1;
}
// @__NO_SIDE_EFFECTS__
function K(e) {
  const t = e && e.__v_raw;
  return t ? /* @__PURE__ */ K(t) : e;
}
function jl(e) {
  return !B(e, "__v_skip") && Object.isExtensible(e) && Xn(e, "__v_skip", !0), e;
}
const $e = (e) => z(e) ? /* @__PURE__ */ en(e) : e, kt = (e) => z(e) ? /* @__PURE__ */ Rs(e) : e;
// @__NO_SIDE_EFFECTS__
function ue(e) {
  return e ? e.__v_isRef === !0 : !1;
}
// @__NO_SIDE_EFFECTS__
function Re(e) {
  return Fl(e, !1);
}
function Fl(e, t) {
  return /* @__PURE__ */ ue(e) ? e : new Dl(e, t);
}
class Dl {
  constructor(t, s) {
    this.dep = new Qs(), this.__v_isRef = !0, this.__v_isShallow = !1, this._rawValue = s ? t : /* @__PURE__ */ K(t), this._value = s ? t : $e(t), this.__v_isShallow = s;
  }
  get value() {
    return this.dep.track(), this._value;
  }
  set value(t) {
    const s = this._rawValue, n = this.__v_isShallow || /* @__PURE__ */ we(t) || /* @__PURE__ */ Je(t);
    t = n ? t : /* @__PURE__ */ K(t), je(t, s) && (this._rawValue = t, this._value = n ? t : $e(t), this.dep.trigger());
  }
}
function De(e) {
  return /* @__PURE__ */ ue(e) ? e.value : e;
}
const Nl = {
  get: (e, t, s) => t === "__v_raw" ? e : De(Reflect.get(e, t, s)),
  set: (e, t, s, n) => {
    const i = e[t];
    return /* @__PURE__ */ ue(i) && !/* @__PURE__ */ ue(s) ? (i.value = s, !0) : Reflect.set(e, t, s, n);
  }
};
function bi(e) {
  return /* @__PURE__ */ at(e) ? e : new Proxy(e, Nl);
}
class Zl {
  constructor(t, s, n) {
    this.fn = t, this.setter = s, this._value = void 0, this.dep = new Qs(this), this.__v_isRef = !0, this.deps = void 0, this.depsTail = void 0, this.flags = 16, this.globalVersion = Ft - 1, this.next = void 0, this.effect = this, this.__v_isReadonly = !s, this.isSSR = n;
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
    return ai(this), t && (t.version = this.dep.version), this._value;
  }
  set value(t) {
    this.setter && this.setter(t);
  }
}
// @__NO_SIDE_EFFECTS__
function Ul(e, t, s = !1) {
  let n, i;
  return F(e) ? n = e : (n = e.get, i = e.set), new Zl(n, i, s);
}
const zt = {}, es = /* @__PURE__ */ new WeakMap();
let ot;
function Hl(e, t = !1, s = ot) {
  if (s) {
    let n = es.get(s);
    n || es.set(s, n = []), n.push(e);
  }
}
function Wl(e, t, s = Y) {
  const { immediate: n, deep: i, once: l, scheduler: o, augmentJob: c, call: f } = s, h = (M) => i ? M : /* @__PURE__ */ we(M) || i === !1 || i === 0 ? Ke(M, 1) : Ke(M);
  let d, r, g, _, D = !1, A = !1;
  if (/* @__PURE__ */ ue(e) ? (r = () => e.value, D = /* @__PURE__ */ we(e)) : /* @__PURE__ */ at(e) ? (r = () => h(e), D = !0) : j(e) ? (A = !0, D = e.some((M) => /* @__PURE__ */ at(M) || /* @__PURE__ */ we(M)), r = () => e.map((M) => {
    if (/* @__PURE__ */ ue(M))
      return M.value;
    if (/* @__PURE__ */ at(M))
      return h(M);
    if (F(M))
      return f ? f(M, 2) : M();
  })) : F(e) ? t ? r = f ? () => f(e, 2) : e : r = () => {
    if (g) {
      qe();
      try {
        g();
      } finally {
        ze();
      }
    }
    const M = ot;
    ot = d;
    try {
      return f ? f(e, 3, [_]) : e(_);
    } finally {
      ot = M;
    }
  } : r = Fe, t && i) {
    const M = r, q = i === !0 ? 1 / 0 : i;
    r = () => Ke(M(), q);
  }
  const U = vl(), G = () => {
    d.stop(), U && U.active && Vs(U.effects, d);
  };
  if (l && t) {
    const M = t;
    t = (...q) => {
      M(...q), G();
    };
  }
  let N = A ? new Array(e.length).fill(zt) : zt;
  const H = (M) => {
    if (!(!(d.flags & 1) || !d.dirty && !M))
      if (t) {
        const q = d.run();
        if (i || D || (A ? q.some((ne, me) => je(ne, N[me])) : je(q, N))) {
          g && g();
          const ne = ot;
          ot = d;
          try {
            const me = [
              q,
              // pass undefined as the old value when it's changed for the first time
              N === zt ? void 0 : A && N[0] === zt ? [] : N,
              _
            ];
            N = q, f ? f(t, 3, me) : (
              // @ts-expect-error
              t(...me)
            );
          } finally {
            ot = ne;
          }
        }
      } else
        d.run();
  };
  return c && c(H), d = new ni(r), d.scheduler = o ? () => o(H, !1) : H, _ = (M) => Hl(M, !1, d), g = d.onStop = () => {
    const M = es.get(d);
    if (M) {
      if (f)
        f(M, 4);
      else
        for (const q of M) q();
      es.delete(d);
    }
  }, t ? n ? H(!0) : N = d.run() : o ? o(H.bind(null, !0), !0) : d.run(), G.pause = d.pause.bind(d), G.resume = d.resume.bind(d), G.stop = G, G;
}
function Ke(e, t = 1 / 0, s) {
  if (t <= 0 || !z(e) || e.__v_skip || (s = s || /* @__PURE__ */ new Map(), (s.get(e) || 0) >= t))
    return e;
  if (s.set(e, t), t--, /* @__PURE__ */ ue(e))
    Ke(e.value, t, s);
  else if (j(e))
    for (let n = 0; n < e.length; n++)
      Ke(e[n], t, s);
  else if (qn(e) || vt(e))
    e.forEach((n) => {
      Ke(n, t, s);
    });
  else if (Yn(e)) {
    for (const n in e)
      Ke(e[n], t, s);
    for (const n of Object.getOwnPropertySymbols(e))
      Object.prototype.propertyIsEnumerable.call(e, n) && Ke(e[n], t, s);
  }
  return e;
}
function Wt(e, t, s, n) {
  try {
    return n ? e(...n) : e();
  } catch (i) {
    ds(i, t, s);
  }
}
function Ze(e, t, s, n) {
  if (F(e)) {
    const i = Wt(e, t, s, n);
    return i && zn(i) && i.catch((l) => {
      ds(l, t, s);
    }), i;
  }
  if (j(e)) {
    const i = [];
    for (let l = 0; l < e.length; l++)
      i.push(Ze(e[l], t, s, n));
    return i;
  }
}
function ds(e, t, s, n = !0) {
  const i = t ? t.vnode : null, { errorHandler: l, throwUnhandledErrorInProduction: o } = t && t.appContext.config || Y;
  if (t) {
    let c = t.parent;
    const f = t.proxy, h = `https://vuejs.org/error-reference/#runtime-${s}`;
    for (; c; ) {
      const d = c.ec;
      if (d) {
        for (let r = 0; r < d.length; r++)
          if (d[r](e, f, h) === !1)
            return;
      }
      c = c.parent;
    }
    if (l) {
      qe(), Wt(l, null, 10, [
        e,
        f,
        h
      ]), ze();
      return;
    }
  }
  Vl(e, s, i, n, o);
}
function Vl(e, t, s, n = !0, i = !1) {
  if (i)
    throw e;
  console.error(e);
}
const he = [];
let Oe = -1;
const bt = [];
let et = null, ht = 0;
const yi = /* @__PURE__ */ Promise.resolve();
let ts = null;
function mi(e) {
  const t = ts || yi;
  return e ? t.then(this ? e.bind(this) : e) : t;
}
function Gl(e) {
  let t = Oe + 1, s = he.length;
  for (; t < s; ) {
    const n = t + s >>> 1, i = he[n], l = Nt(i);
    l < e || l === e && i.flags & 2 ? t = n + 1 : s = n;
  }
  return t;
}
function nn(e) {
  if (!(e.flags & 1)) {
    const t = Nt(e), s = he[he.length - 1];
    !s || // fast path when the job id is larger than the tail
    !(e.flags & 2) && t >= Nt(s) ? he.push(e) : he.splice(Gl(t), 0, e), e.flags |= 1, ki();
  }
}
function ki() {
  ts || (ts = yi.then(wi));
}
function Kl(e) {
  j(e) ? bt.push(...e) : et && e.id === -1 ? et.splice(ht + 1, 0, e) : e.flags & 1 || (bt.push(e), e.flags |= 1), ki();
}
function yn(e, t, s = Oe + 1) {
  for (; s < he.length; s++) {
    const n = he[s];
    if (n && n.flags & 2) {
      if (e && n.id !== e.uid)
        continue;
      he.splice(s, 1), s--, n.flags & 4 && (n.flags &= -2), n(), n.flags & 4 || (n.flags &= -2);
    }
  }
}
function xi(e) {
  if (bt.length) {
    const t = [...new Set(bt)].sort(
      (s, n) => Nt(s) - Nt(n)
    );
    if (bt.length = 0, et) {
      et.push(...t);
      return;
    }
    for (et = t, ht = 0; ht < et.length; ht++) {
      const s = et[ht];
      s.flags & 4 && (s.flags &= -2), s.flags & 8 || s(), s.flags &= -2;
    }
    et = null, ht = 0;
  }
}
const Nt = (e) => e.id == null ? e.flags & 2 ? -1 : 1 / 0 : e.id;
function wi(e) {
  try {
    for (Oe = 0; Oe < he.length; Oe++) {
      const t = he[Oe];
      t && !(t.flags & 8) && (t.flags & 4 && (t.flags &= -2), Wt(
        t,
        t.i,
        t.i ? 15 : 14
      ), t.flags & 4 || (t.flags &= -2));
    }
  } finally {
    for (; Oe < he.length; Oe++) {
      const t = he[Oe];
      t && (t.flags &= -2);
    }
    Oe = -1, he.length = 0, xi(), ts = null, (he.length || bt.length) && wi();
  }
}
let xe = null, Si = null;
function ss(e) {
  const t = xe;
  return xe = e, Si = e && e.type.__scopeId || null, t;
}
function Bl(e, t = xe, s) {
  if (!t || e._n)
    return e;
  const n = (...i) => {
    n._d && Tn(-1);
    const l = ss(t);
    let o;
    try {
      o = e(...i);
    } finally {
      ss(l), n._d && Tn(1);
    }
    return o;
  };
  return n._n = !0, n._c = !0, n._d = !0, n;
}
function ql(e, t) {
  if (xe === null)
    return e;
  const s = vs(xe), n = e.dirs || (e.dirs = []);
  for (let i = 0; i < t.length; i++) {
    let [l, o, c, f = Y] = t[i];
    l && (F(l) && (l = {
      mounted: l,
      updated: l
    }), l.deep && Ke(o), n.push({
      dir: l,
      instance: s,
      value: o,
      oldValue: void 0,
      arg: c,
      modifiers: f
    }));
  }
  return e;
}
function it(e, t, s, n) {
  const i = e.dirs, l = t && t.dirs;
  for (let o = 0; o < i.length; o++) {
    const c = i[o];
    l && (c.oldValue = l[o].value);
    let f = c.dir[n];
    f && (qe(), Ze(f, s, 8, [
      e.el,
      c,
      e,
      t
    ]), ze());
  }
}
function zl(e, t) {
  if (ge) {
    let s = ge.provides;
    const n = ge.parent && ge.parent.provides;
    n === s && (s = ge.provides = Object.create(n)), s[e] = t;
  }
}
function Yt(e, t, s = !1) {
  const n = Bo();
  if (n || yt) {
    let i = yt ? yt._context.provides : n ? n.parent == null || n.ce ? n.vnode.appContext && n.vnode.appContext.provides : n.parent.provides : void 0;
    if (i && e in i)
      return i[e];
    if (arguments.length > 1)
      return s && F(t) ? t.call(n && n.proxy) : t;
  }
}
const Jl = /* @__PURE__ */ Symbol.for("v-scx"), Yl = () => Yt(Jl);
function Qt(e, t, s) {
  return Ci(e, t, s);
}
function Ci(e, t, s = Y) {
  const { immediate: n, deep: i, flush: l, once: o } = s, c = fe({}, s), f = t && n || !t && l !== "post";
  let h;
  if (Ut) {
    if (l === "sync") {
      const _ = Yl();
      h = _.__watcherHandles || (_.__watcherHandles = []);
    } else if (!f) {
      const _ = () => {
      };
      return _.stop = Fe, _.resume = Fe, _.pause = Fe, _;
    }
  }
  const d = ge;
  c.call = (_, D, A) => Ze(_, d, D, A);
  let r = !1;
  l === "post" ? c.scheduler = (_) => {
    ve(_, d && d.suspense);
  } : l !== "sync" && (r = !0, c.scheduler = (_, D) => {
    D ? _() : nn(_);
  }), c.augmentJob = (_) => {
    t && (_.flags |= 4), r && (_.flags |= 2, d && (_.id = d.uid, _.i = d));
  };
  const g = Wl(e, t, c);
  return Ut && (h ? h.push(g) : f && g()), g;
}
function Ql(e, t, s) {
  const n = this.proxy, i = ie(e) ? e.includes(".") ? _i(n, e) : () => n[e] : e.bind(n, n);
  let l;
  F(t) ? l = t : (l = t.handler, s = t);
  const o = Vt(this), c = Ci(i, l.bind(n), s);
  return o(), c;
}
function _i(e, t) {
  const s = t.split(".");
  return () => {
    let n = e;
    for (let i = 0; i < s.length && n; i++)
      n = n[s[i]];
    return n;
  };
}
const Xl = /* @__PURE__ */ Symbol("_vte"), eo = (e) => e.__isTeleport, to = /* @__PURE__ */ Symbol("_leaveCb");
function ln(e, t) {
  e.shapeFlag & 6 && e.component ? (e.transition = t, ln(e.component.subTree, t)) : e.shapeFlag & 128 ? (e.ssContent.transition = t.clone(e.ssContent), e.ssFallback.transition = t.clone(e.ssFallback)) : e.transition = t;
}
function $i(e) {
  e.ids = [e.ids[0] + e.ids[2]++ + "-", 0, 0];
}
function mn(e, t) {
  let s;
  return !!((s = Object.getOwnPropertyDescriptor(e, t)) && !s.configurable);
}
const ns = /* @__PURE__ */ new WeakMap();
function Mt(e, t, s, n, i = !1) {
  if (j(e)) {
    e.forEach(
      (A, U) => Mt(
        A,
        t && (j(t) ? t[U] : t),
        s,
        n,
        i
      )
    );
    return;
  }
  if (Rt(n) && !i) {
    n.shapeFlag & 512 && n.type.__asyncResolved && n.component.subTree.component && Mt(e, t, s, n.component.subTree);
    return;
  }
  const l = n.shapeFlag & 4 ? vs(n.component) : n.el, o = i ? null : l, { i: c, r: f } = e, h = t && t.r, d = c.refs === Y ? c.refs = {} : c.refs, r = c.setupState, g = /* @__PURE__ */ K(r), _ = r === Y ? Bn : (A) => mn(d, A) ? !1 : B(g, A), D = (A, U) => !(U && mn(d, U));
  if (h != null && h !== f) {
    if (kn(t), ie(h))
      d[h] = null, _(h) && (r[h] = null);
    else if (/* @__PURE__ */ ue(h)) {
      const A = t;
      D(h, A.k) && (h.value = null), A.k && (d[A.k] = null);
    }
  }
  if (F(f))
    Wt(f, c, 12, [o, d]);
  else {
    const A = ie(f), U = /* @__PURE__ */ ue(f);
    if (A || U) {
      const G = () => {
        if (e.f) {
          const N = A ? _(f) ? r[f] : d[f] : D() || !e.k ? f.value : d[e.k];
          if (i)
            j(N) && Vs(N, l);
          else if (j(N))
            N.includes(l) || N.push(l);
          else if (A)
            d[f] = [l], _(f) && (r[f] = d[f]);
          else {
            const H = [l];
            D(f, e.k) && (f.value = H), e.k && (d[e.k] = H);
          }
        } else A ? (d[f] = o, _(f) && (r[f] = o)) : U && (D(f, e.k) && (f.value = o), e.k && (d[e.k] = o));
      };
      if (o) {
        const N = () => {
          G(), ns.delete(e);
        };
        N.id = -1, ns.set(e, N), ve(N, s);
      } else
        kn(e), G();
    }
  }
}
function kn(e) {
  const t = ns.get(e);
  t && (t.flags |= 8, ns.delete(e));
}
us().requestIdleCallback;
us().cancelIdleCallback;
const Rt = (e) => !!e.type.__asyncLoader, Ei = (e) => e.type.__isKeepAlive;
function so(e, t) {
  Ii(e, "a", t);
}
function no(e, t) {
  Ii(e, "da", t);
}
function Ii(e, t, s = ge) {
  const n = e.__wdc || (e.__wdc = () => {
    let i = s;
    for (; i; ) {
      if (i.isDeactivated)
        return;
      i = i.parent;
    }
    return e();
  });
  if (hs(t, n, s), s) {
    let i = s.parent;
    for (; i && i.parent; )
      Ei(i.parent.vnode) && io(n, t, s, i), i = i.parent;
  }
}
function io(e, t, s, n) {
  const i = hs(
    t,
    e,
    n,
    !0
    /* prepend */
  );
  Ai(() => {
    Vs(n[t], i);
  }, s);
}
function hs(e, t, s = ge, n = !1) {
  if (s) {
    const i = s[e] || (s[e] = []), l = t.__weh || (t.__weh = (...o) => {
      qe();
      const c = Vt(s), f = Ze(t, s, e, o);
      return c(), ze(), f;
    });
    return n ? i.unshift(l) : i.push(l), l;
  }
}
const Ye = (e) => (t, s = ge) => {
  (!Ut || e === "sp") && hs(e, (...n) => t(...n), s);
}, lo = Ye("bm"), Ti = Ye("m"), oo = Ye(
  "bu"
), ro = Ye("u"), Pi = Ye(
  "bum"
), Ai = Ye("um"), ao = Ye(
  "sp"
), co = Ye("rtg"), uo = Ye("rtc");
function fo(e, t = ge) {
  hs("ec", e, t);
}
const ho = /* @__PURE__ */ Symbol.for("v-ndc");
function pe(e, t, s, n) {
  let i;
  const l = s, o = j(e);
  if (o || ie(e)) {
    const c = o && /* @__PURE__ */ at(e);
    let f = !1, h = !1;
    c && (f = !/* @__PURE__ */ we(e), h = /* @__PURE__ */ Je(e), e = fs(e)), i = new Array(e.length);
    for (let d = 0, r = e.length; d < r; d++)
      i[d] = t(
        f ? h ? kt($e(e[d])) : $e(e[d]) : e[d],
        d,
        void 0,
        l
      );
  } else if (typeof e == "number") {
    i = new Array(e);
    for (let c = 0; c < e; c++)
      i[c] = t(c + 1, c, void 0, l);
  } else if (z(e))
    if (e[Symbol.iterator])
      i = Array.from(
        e,
        (c, f) => t(c, f, void 0, l)
      );
    else {
      const c = Object.keys(e);
      i = new Array(c.length);
      for (let f = 0, h = c.length; f < h; f++) {
        const d = c[f];
        i[f] = t(e[d], d, f, l);
      }
    }
  else
    i = [];
  return i;
}
const Ls = (e) => e ? Qi(e) ? vs(e) : Ls(e.parent) : null, Lt = (
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
    $parent: (e) => Ls(e.parent),
    $root: (e) => Ls(e.root),
    $host: (e) => e.ce,
    $emit: (e) => e.emit,
    $options: (e) => Mi(e),
    $forceUpdate: (e) => e.f || (e.f = () => {
      nn(e.update);
    }),
    $nextTick: (e) => e.n || (e.n = mi.bind(e.proxy)),
    $watch: (e) => Ql.bind(e)
  })
), Ss = (e, t) => e !== Y && !e.__isScriptSetup && B(e, t), po = {
  get({ _: e }, t) {
    if (t === "__v_skip")
      return !0;
    const { ctx: s, setupState: n, data: i, props: l, accessCache: o, type: c, appContext: f } = e;
    if (t[0] !== "$") {
      const g = o[t];
      if (g !== void 0)
        switch (g) {
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
        if (Ss(n, t))
          return o[t] = 1, n[t];
        if (i !== Y && B(i, t))
          return o[t] = 2, i[t];
        if (B(l, t))
          return o[t] = 3, l[t];
        if (s !== Y && B(s, t))
          return o[t] = 4, s[t];
        js && (o[t] = 0);
      }
    }
    const h = Lt[t];
    let d, r;
    if (h)
      return t === "$attrs" && ce(e.attrs, "get", ""), h(e);
    if (
      // css module (injected by vue-loader)
      (d = c.__cssModules) && (d = d[t])
    )
      return d;
    if (s !== Y && B(s, t))
      return o[t] = 4, s[t];
    if (
      // global properties
      r = f.config.globalProperties, B(r, t)
    )
      return r[t];
  },
  set({ _: e }, t, s) {
    const { data: n, setupState: i, ctx: l } = e;
    return Ss(i, t) ? (i[t] = s, !0) : n !== Y && B(n, t) ? (n[t] = s, !0) : B(e.props, t) || t[0] === "$" && t.slice(1) in e ? !1 : (l[t] = s, !0);
  },
  has({
    _: { data: e, setupState: t, accessCache: s, ctx: n, appContext: i, props: l, type: o }
  }, c) {
    let f;
    return !!(s[c] || e !== Y && c[0] !== "$" && B(e, c) || Ss(t, c) || B(l, c) || B(n, c) || B(Lt, c) || B(i.config.globalProperties, c) || (f = o.__cssModules) && f[c]);
  },
  defineProperty(e, t, s) {
    return s.get != null ? e._.accessCache[t] = 0 : B(s, "value") && this.set(e, t, s.value, null), Reflect.defineProperty(e, t, s);
  }
};
function xn(e) {
  return j(e) ? e.reduce(
    (t, s) => (t[s] = null, t),
    {}
  ) : e;
}
let js = !0;
function go(e) {
  const t = Mi(e), s = e.proxy, n = e.ctx;
  js = !1, t.beforeCreate && wn(t.beforeCreate, e, "bc");
  const {
    // state
    data: i,
    computed: l,
    methods: o,
    watch: c,
    provide: f,
    inject: h,
    // lifecycle
    created: d,
    beforeMount: r,
    mounted: g,
    beforeUpdate: _,
    updated: D,
    activated: A,
    deactivated: U,
    beforeDestroy: G,
    beforeUnmount: N,
    destroyed: H,
    unmounted: M,
    render: q,
    renderTracked: ne,
    renderTriggered: me,
    errorCaptured: ke,
    serverPrefetch: Qe,
    // public API
    expose: Ue,
    inheritAttrs: st,
    // assets
    components: ut,
    directives: ft,
    filters: wt
  } = t;
  if (h && vo(h, n, null), o)
    for (const S in o) {
      const Z = o[S];
      F(Z) && (n[S] = Z.bind(s));
    }
  if (i) {
    const S = i.call(s, s);
    z(S) && (e.data = /* @__PURE__ */ en(S));
  }
  if (js = !0, l)
    for (const S in l) {
      const Z = l[S], Xe = F(Z) ? Z.bind(s, s) : F(Z.get) ? Z.get.bind(s, s) : Fe, Gt = !F(Z) && F(Z.set) ? Z.set.bind(s) : Fe, nt = Se({
        get: Xe,
        set: Gt
      });
      Object.defineProperty(n, S, {
        enumerable: !0,
        configurable: !0,
        get: () => nt.value,
        set: (Ee) => nt.value = Ee
      });
    }
  if (c)
    for (const S in c)
      Oi(c[S], n, s, S);
  if (f) {
    const S = F(f) ? f.call(s) : f;
    Reflect.ownKeys(S).forEach((Z) => {
      zl(Z, S[Z]);
    });
  }
  d && wn(d, e, "c");
  function P(S, Z) {
    j(Z) ? Z.forEach((Xe) => S(Xe.bind(s))) : Z && S(Z.bind(s));
  }
  if (P(lo, r), P(Ti, g), P(oo, _), P(ro, D), P(so, A), P(no, U), P(fo, ke), P(uo, ne), P(co, me), P(Pi, N), P(Ai, M), P(ao, Qe), j(Ue))
    if (Ue.length) {
      const S = e.exposed || (e.exposed = {});
      Ue.forEach((Z) => {
        Object.defineProperty(S, Z, {
          get: () => s[Z],
          set: (Xe) => s[Z] = Xe,
          enumerable: !0
        });
      });
    } else e.exposed || (e.exposed = {});
  q && e.render === Fe && (e.render = q), st != null && (e.inheritAttrs = st), ut && (e.components = ut), ft && (e.directives = ft), Qe && $i(e);
}
function vo(e, t, s = Fe) {
  j(e) && (e = Fs(e));
  for (const n in e) {
    const i = e[n];
    let l;
    z(i) ? "default" in i ? l = Yt(
      i.from || n,
      i.default,
      !0
    ) : l = Yt(i.from || n) : l = Yt(i), /* @__PURE__ */ ue(l) ? Object.defineProperty(t, n, {
      enumerable: !0,
      configurable: !0,
      get: () => l.value,
      set: (o) => l.value = o
    }) : t[n] = l;
  }
}
function wn(e, t, s) {
  Ze(
    j(e) ? e.map((n) => n.bind(t.proxy)) : e.bind(t.proxy),
    t,
    s
  );
}
function Oi(e, t, s, n) {
  let i = n.includes(".") ? _i(s, n) : () => s[n];
  if (ie(e)) {
    const l = t[e];
    F(l) && Qt(i, l);
  } else if (F(e))
    Qt(i, e.bind(s));
  else if (z(e))
    if (j(e))
      e.forEach((l) => Oi(l, t, s, n));
    else {
      const l = F(e.handler) ? e.handler.bind(s) : t[e.handler];
      F(l) && Qt(i, l, e);
    }
}
function Mi(e) {
  const t = e.type, { mixins: s, extends: n } = t, {
    mixins: i,
    optionsCache: l,
    config: { optionMergeStrategies: o }
  } = e.appContext, c = l.get(t);
  let f;
  return c ? f = c : !i.length && !s && !n ? f = t : (f = {}, i.length && i.forEach(
    (h) => is(f, h, o, !0)
  ), is(f, t, o)), z(t) && l.set(t, f), f;
}
function is(e, t, s, n = !1) {
  const { mixins: i, extends: l } = t;
  l && is(e, l, s, !0), i && i.forEach(
    (o) => is(e, o, s, !0)
  );
  for (const o in t)
    if (!(n && o === "expose")) {
      const c = bo[o] || s && s[o];
      e[o] = c ? c(e[o], t[o]) : t[o];
    }
  return e;
}
const bo = {
  data: Sn,
  props: Cn,
  emits: Cn,
  // objects
  methods: It,
  computed: It,
  // lifecycle
  beforeCreate: de,
  created: de,
  beforeMount: de,
  mounted: de,
  beforeUpdate: de,
  updated: de,
  beforeDestroy: de,
  beforeUnmount: de,
  destroyed: de,
  unmounted: de,
  activated: de,
  deactivated: de,
  errorCaptured: de,
  serverPrefetch: de,
  // assets
  components: It,
  directives: It,
  // watch
  watch: mo,
  // provide / inject
  provide: Sn,
  inject: yo
};
function Sn(e, t) {
  return t ? e ? function() {
    return fe(
      F(e) ? e.call(this, this) : e,
      F(t) ? t.call(this, this) : t
    );
  } : t : e;
}
function yo(e, t) {
  return It(Fs(e), Fs(t));
}
function Fs(e) {
  if (j(e)) {
    const t = {};
    for (let s = 0; s < e.length; s++)
      t[e[s]] = e[s];
    return t;
  }
  return e;
}
function de(e, t) {
  return e ? [...new Set([].concat(e, t))] : t;
}
function It(e, t) {
  return e ? fe(/* @__PURE__ */ Object.create(null), e, t) : t;
}
function Cn(e, t) {
  return e ? j(e) && j(t) ? [.../* @__PURE__ */ new Set([...e, ...t])] : fe(
    /* @__PURE__ */ Object.create(null),
    xn(e),
    xn(t ?? {})
  ) : t;
}
function mo(e, t) {
  if (!e) return t;
  if (!t) return e;
  const s = fe(/* @__PURE__ */ Object.create(null), e);
  for (const n in t)
    s[n] = de(e[n], t[n]);
  return s;
}
function Ri() {
  return {
    app: null,
    config: {
      isNativeTag: Bn,
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
let ko = 0;
function xo(e, t) {
  return function(n, i = null) {
    F(n) || (n = fe({}, n)), i != null && !z(i) && (i = null);
    const l = Ri(), o = /* @__PURE__ */ new WeakSet(), c = [];
    let f = !1;
    const h = l.app = {
      _uid: ko++,
      _component: n,
      _props: i,
      _container: null,
      _context: l,
      _instance: null,
      version: Xo,
      get config() {
        return l.config;
      },
      set config(d) {
      },
      use(d, ...r) {
        return o.has(d) || (d && F(d.install) ? (o.add(d), d.install(h, ...r)) : F(d) && (o.add(d), d(h, ...r))), h;
      },
      mixin(d) {
        return l.mixins.includes(d) || l.mixins.push(d), h;
      },
      component(d, r) {
        return r ? (l.components[d] = r, h) : l.components[d];
      },
      directive(d, r) {
        return r ? (l.directives[d] = r, h) : l.directives[d];
      },
      mount(d, r, g) {
        if (!f) {
          const _ = h._ceVNode || Be(n, i);
          return _.appContext = l, g === !0 ? g = "svg" : g === !1 && (g = void 0), e(_, d, g), f = !0, h._container = d, d.__vue_app__ = h, vs(_.component);
        }
      },
      onUnmount(d) {
        c.push(d);
      },
      unmount() {
        f && (Ze(
          c,
          h._instance,
          16
        ), e(null, h._container), delete h._container.__vue_app__);
      },
      provide(d, r) {
        return l.provides[d] = r, h;
      },
      runWithContext(d) {
        const r = yt;
        yt = h;
        try {
          return d();
        } finally {
          yt = r;
        }
      }
    };
    return h;
  };
}
let yt = null;
const wo = (e, t) => t === "modelValue" || t === "model-value" ? e.modelModifiers : e[`${t}Modifiers`] || e[`${Ce(t)}Modifiers`] || e[`${ct(t)}Modifiers`];
function So(e, t, ...s) {
  if (e.isUnmounted) return;
  const n = e.vnode.props || Y;
  let i = s;
  const l = t.startsWith("update:"), o = l && wo(n, t.slice(7));
  o && (o.trim && (i = s.map((d) => ie(d) ? d.trim() : d)), o.number && (i = s.map(Ks)));
  let c, f = n[c = ys(t)] || // also try camelCase event handler (#2249)
  n[c = ys(Ce(t))];
  !f && l && (f = n[c = ys(ct(t))]), f && Ze(
    f,
    e,
    6,
    i
  );
  const h = n[c + "Once"];
  if (h) {
    if (!e.emitted)
      e.emitted = {};
    else if (e.emitted[c])
      return;
    e.emitted[c] = !0, Ze(
      h,
      e,
      6,
      i
    );
  }
}
const Co = /* @__PURE__ */ new WeakMap();
function Li(e, t, s = !1) {
  const n = s ? Co : t.emitsCache, i = n.get(e);
  if (i !== void 0)
    return i;
  const l = e.emits;
  let o = {}, c = !1;
  if (!F(e)) {
    const f = (h) => {
      const d = Li(h, t, !0);
      d && (c = !0, fe(o, d));
    };
    !s && t.mixins.length && t.mixins.forEach(f), e.extends && f(e.extends), e.mixins && e.mixins.forEach(f);
  }
  return !l && !c ? (z(e) && n.set(e, null), null) : (j(l) ? l.forEach((f) => o[f] = null) : fe(o, l), z(e) && n.set(e, o), o);
}
function ps(e, t) {
  return !e || !rs(t) ? !1 : (t = t.slice(2).replace(/Once$/, ""), B(e, t[0].toLowerCase() + t.slice(1)) || B(e, ct(t)) || B(e, t));
}
function _n(e) {
  const {
    type: t,
    vnode: s,
    proxy: n,
    withProxy: i,
    propsOptions: [l],
    slots: o,
    attrs: c,
    emit: f,
    render: h,
    renderCache: d,
    props: r,
    data: g,
    setupState: _,
    ctx: D,
    inheritAttrs: A
  } = e, U = ss(e);
  let G, N;
  try {
    if (s.shapeFlag & 4) {
      const M = i || n, q = M;
      G = Le(
        h.call(
          q,
          M,
          d,
          r,
          _,
          g,
          D
        )
      ), N = c;
    } else {
      const M = t;
      G = Le(
        M.length > 1 ? M(
          r,
          { attrs: c, slots: o, emit: f }
        ) : M(
          r,
          null
        )
      ), N = t.props ? c : _o(c);
    }
  } catch (M) {
    jt.length = 0, ds(M, e, 1), G = Be(tt);
  }
  let H = G;
  if (N && A !== !1) {
    const M = Object.keys(N), { shapeFlag: q } = H;
    M.length && q & 7 && (l && M.some(as) && (N = $o(
      N,
      l
    )), H = xt(H, N, !1, !0));
  }
  return s.dirs && (H = xt(H, null, !1, !0), H.dirs = H.dirs ? H.dirs.concat(s.dirs) : s.dirs), s.transition && ln(H, s.transition), G = H, ss(U), G;
}
const _o = (e) => {
  let t;
  for (const s in e)
    (s === "class" || s === "style" || rs(s)) && ((t || (t = {}))[s] = e[s]);
  return t;
}, $o = (e, t) => {
  const s = {};
  for (const n in e)
    (!as(n) || !(n.slice(9) in t)) && (s[n] = e[n]);
  return s;
};
function Eo(e, t, s) {
  const { props: n, children: i, component: l } = e, { props: o, children: c, patchFlag: f } = t, h = l.emitsOptions;
  if (t.dirs || t.transition)
    return !0;
  if (s && f >= 0) {
    if (f & 1024)
      return !0;
    if (f & 16)
      return n ? $n(n, o, h) : !!o;
    if (f & 8) {
      const d = t.dynamicProps;
      for (let r = 0; r < d.length; r++) {
        const g = d[r];
        if (ji(o, n, g) && !ps(h, g))
          return !0;
      }
    }
  } else
    return (i || c) && (!c || !c.$stable) ? !0 : n === o ? !1 : n ? o ? $n(n, o, h) : !0 : !!o;
  return !1;
}
function $n(e, t, s) {
  const n = Object.keys(t);
  if (n.length !== Object.keys(e).length)
    return !0;
  for (let i = 0; i < n.length; i++) {
    const l = n[i];
    if (ji(t, e, l) && !ps(s, l))
      return !0;
  }
  return !1;
}
function ji(e, t, s) {
  const n = e[s], i = t[s];
  return s === "style" && z(n) && z(i) ? !qs(n, i) : n !== i;
}
function Io({ vnode: e, parent: t, suspense: s }, n) {
  for (; t; ) {
    const i = t.subTree;
    if (i.suspense && i.suspense.activeBranch === e && (i.suspense.vnode.el = i.el = n, e = i), i === e)
      (e = t.vnode).el = n, t = t.parent;
    else
      break;
  }
  s && s.activeBranch === e && (s.vnode.el = n);
}
const Fi = {}, Di = () => Object.create(Fi), Ni = (e) => Object.getPrototypeOf(e) === Fi;
function To(e, t, s, n = !1) {
  const i = {}, l = Di();
  e.propsDefaults = /* @__PURE__ */ Object.create(null), Zi(e, t, i, l);
  for (const o in e.propsOptions[0])
    o in i || (i[o] = void 0);
  s ? e.props = n ? i : /* @__PURE__ */ Ll(i) : e.type.props ? e.props = i : e.props = l, e.attrs = l;
}
function Po(e, t, s, n) {
  const {
    props: i,
    attrs: l,
    vnode: { patchFlag: o }
  } = e, c = /* @__PURE__ */ K(i), [f] = e.propsOptions;
  let h = !1;
  if (
    // always force full diff in dev
    // - #1942 if hmr is enabled with sfc component
    // - vite#872 non-sfc component used by sfc component
    (n || o > 0) && !(o & 16)
  ) {
    if (o & 8) {
      const d = e.vnode.dynamicProps;
      for (let r = 0; r < d.length; r++) {
        let g = d[r];
        if (ps(e.emitsOptions, g))
          continue;
        const _ = t[g];
        if (f)
          if (B(l, g))
            _ !== l[g] && (l[g] = _, h = !0);
          else {
            const D = Ce(g);
            i[D] = Ds(
              f,
              c,
              D,
              _,
              e,
              !1
            );
          }
        else
          _ !== l[g] && (l[g] = _, h = !0);
      }
    }
  } else {
    Zi(e, t, i, l) && (h = !0);
    let d;
    for (const r in c)
      (!t || // for camelCase
      !B(t, r) && // it's possible the original props was passed in as kebab-case
      // and converted to camelCase (#955)
      ((d = ct(r)) === r || !B(t, d))) && (f ? s && // for camelCase
      (s[r] !== void 0 || // for kebab-case
      s[d] !== void 0) && (i[r] = Ds(
        f,
        c,
        r,
        void 0,
        e,
        !0
      )) : delete i[r]);
    if (l !== c)
      for (const r in l)
        (!t || !B(t, r)) && (delete l[r], h = !0);
  }
  h && Ge(e.attrs, "set", "");
}
function Zi(e, t, s, n) {
  const [i, l] = e.propsOptions;
  let o = !1, c;
  if (t)
    for (let f in t) {
      if (Pt(f))
        continue;
      const h = t[f];
      let d;
      i && B(i, d = Ce(f)) ? !l || !l.includes(d) ? s[d] = h : (c || (c = {}))[d] = h : ps(e.emitsOptions, f) || (!(f in n) || h !== n[f]) && (n[f] = h, o = !0);
    }
  if (l) {
    const f = /* @__PURE__ */ K(s), h = c || Y;
    for (let d = 0; d < l.length; d++) {
      const r = l[d];
      s[r] = Ds(
        i,
        f,
        r,
        h[r],
        e,
        !B(h, r)
      );
    }
  }
  return o;
}
function Ds(e, t, s, n, i, l) {
  const o = e[s];
  if (o != null) {
    const c = B(o, "default");
    if (c && n === void 0) {
      const f = o.default;
      if (o.type !== Function && !o.skipFactory && F(f)) {
        const { propsDefaults: h } = i;
        if (s in h)
          n = h[s];
        else {
          const d = Vt(i);
          n = h[s] = f.call(
            null,
            t
          ), d();
        }
      } else
        n = f;
      i.ce && i.ce._setProp(s, n);
    }
    o[
      0
      /* shouldCast */
    ] && (l && !c ? n = !1 : o[
      1
      /* shouldCastTrue */
    ] && (n === "" || n === ct(s)) && (n = !0));
  }
  return n;
}
const Ao = /* @__PURE__ */ new WeakMap();
function Ui(e, t, s = !1) {
  const n = s ? Ao : t.propsCache, i = n.get(e);
  if (i)
    return i;
  const l = e.props, o = {}, c = [];
  let f = !1;
  if (!F(e)) {
    const d = (r) => {
      f = !0;
      const [g, _] = Ui(r, t, !0);
      fe(o, g), _ && c.push(..._);
    };
    !s && t.mixins.length && t.mixins.forEach(d), e.extends && d(e.extends), e.mixins && e.mixins.forEach(d);
  }
  if (!l && !f)
    return z(e) && n.set(e, gt), gt;
  if (j(l))
    for (let d = 0; d < l.length; d++) {
      const r = Ce(l[d]);
      En(r) && (o[r] = Y);
    }
  else if (l)
    for (const d in l) {
      const r = Ce(d);
      if (En(r)) {
        const g = l[d], _ = o[r] = j(g) || F(g) ? { type: g } : fe({}, g), D = _.type;
        let A = !1, U = !0;
        if (j(D))
          for (let G = 0; G < D.length; ++G) {
            const N = D[G], H = F(N) && N.name;
            if (H === "Boolean") {
              A = !0;
              break;
            } else H === "String" && (U = !1);
          }
        else
          A = F(D) && D.name === "Boolean";
        _[
          0
          /* shouldCast */
        ] = A, _[
          1
          /* shouldCastTrue */
        ] = U, (A || B(_, "default")) && c.push(r);
      }
    }
  const h = [o, c];
  return z(e) && n.set(e, h), h;
}
function En(e) {
  return e[0] !== "$" && !Pt(e);
}
const on = (e) => e === "_" || e === "_ctx" || e === "$stable", rn = (e) => j(e) ? e.map(Le) : [Le(e)], Oo = (e, t, s) => {
  if (t._n)
    return t;
  const n = Bl((...i) => rn(t(...i)), s);
  return n._c = !1, n;
}, Hi = (e, t, s) => {
  const n = e._ctx;
  for (const i in e) {
    if (on(i)) continue;
    const l = e[i];
    if (F(l))
      t[i] = Oo(i, l, n);
    else if (l != null) {
      const o = rn(l);
      t[i] = () => o;
    }
  }
}, Wi = (e, t) => {
  const s = rn(t);
  e.slots.default = () => s;
}, Vi = (e, t, s) => {
  for (const n in t)
    (s || !on(n)) && (e[n] = t[n]);
}, Mo = (e, t, s) => {
  const n = e.slots = Di();
  if (e.vnode.shapeFlag & 32) {
    const i = t._;
    i ? (Vi(n, t, s), s && Xn(n, "_", i, !0)) : Hi(t, n);
  } else t && Wi(e, t);
}, Ro = (e, t, s) => {
  const { vnode: n, slots: i } = e;
  let l = !0, o = Y;
  if (n.shapeFlag & 32) {
    const c = t._;
    c ? s && c === 1 ? l = !1 : Vi(i, t, s) : (l = !t.$stable, Hi(t, i)), o = t;
  } else t && (Wi(e, t), o = { default: 1 });
  if (l)
    for (const c in i)
      !on(c) && o[c] == null && delete i[c];
}, ve = No;
function Lo(e) {
  return jo(e);
}
function jo(e, t) {
  const s = us();
  s.__VUE__ = !0;
  const {
    insert: n,
    remove: i,
    patchProp: l,
    createElement: o,
    createText: c,
    createComment: f,
    setText: h,
    setElementText: d,
    parentNode: r,
    nextSibling: g,
    setScopeId: _ = Fe,
    insertStaticContent: D
  } = e, A = (u, p, b, x = null, y = null, m = null, I = void 0, E = null, $ = !!p.dynamicChildren) => {
    if (u === p)
      return;
    u && !Et(u, p) && (x = Kt(u), Ee(u, y, m, !0), u = null), p.patchFlag === -2 && ($ = !1, p.dynamicChildren = null);
    const { type: k, ref: R, shapeFlag: T } = p;
    switch (k) {
      case gs:
        U(u, p, b, x);
        break;
      case tt:
        G(u, p, b, x);
        break;
      case _s:
        u == null && N(p, b, x, I);
        break;
      case Q:
        ut(
          u,
          p,
          b,
          x,
          y,
          m,
          I,
          E,
          $
        );
        break;
      default:
        T & 1 ? q(
          u,
          p,
          b,
          x,
          y,
          m,
          I,
          E,
          $
        ) : T & 6 ? ft(
          u,
          p,
          b,
          x,
          y,
          m,
          I,
          E,
          $
        ) : (T & 64 || T & 128) && k.process(
          u,
          p,
          b,
          x,
          y,
          m,
          I,
          E,
          $,
          Ct
        );
    }
    R != null && y ? Mt(R, u && u.ref, m, p || u, !p) : R == null && u && u.ref != null && Mt(u.ref, null, m, u, !0);
  }, U = (u, p, b, x) => {
    if (u == null)
      n(
        p.el = c(p.children),
        b,
        x
      );
    else {
      const y = p.el = u.el;
      p.children !== u.children && h(y, p.children);
    }
  }, G = (u, p, b, x) => {
    u == null ? n(
      p.el = f(p.children || ""),
      b,
      x
    ) : p.el = u.el;
  }, N = (u, p, b, x) => {
    [u.el, u.anchor] = D(
      u.children,
      p,
      b,
      x,
      u.el,
      u.anchor
    );
  }, H = ({ el: u, anchor: p }, b, x) => {
    let y;
    for (; u && u !== p; )
      y = g(u), n(u, b, x), u = y;
    n(p, b, x);
  }, M = ({ el: u, anchor: p }) => {
    let b;
    for (; u && u !== p; )
      b = g(u), i(u), u = b;
    i(p);
  }, q = (u, p, b, x, y, m, I, E, $) => {
    if (p.type === "svg" ? I = "svg" : p.type === "math" && (I = "mathml"), u == null)
      ne(
        p,
        b,
        x,
        y,
        m,
        I,
        E,
        $
      );
    else {
      const k = u.el && u.el._isVueCE ? u.el : null;
      try {
        k && k._beginPatch(), Qe(
          u,
          p,
          y,
          m,
          I,
          E,
          $
        );
      } finally {
        k && k._endPatch();
      }
    }
  }, ne = (u, p, b, x, y, m, I, E) => {
    let $, k;
    const { props: R, shapeFlag: T, transition: O, dirs: L } = u;
    if ($ = u.el = o(
      u.type,
      m,
      R && R.is,
      R
    ), T & 8 ? d($, u.children) : T & 16 && ke(
      u.children,
      $,
      null,
      x,
      y,
      Cs(u, m),
      I,
      E
    ), L && it(u, null, x, "created"), me($, u, u.scopeId, I, x), R) {
      for (const J in R)
        J !== "value" && !Pt(J) && l($, J, null, R[J], m, x);
      "value" in R && l($, "value", null, R.value, m), (k = R.onVnodeBeforeMount) && Ae(k, x, u);
    }
    L && it(u, null, x, "beforeMount");
    const V = Fo(y, O);
    V && O.beforeEnter($), n($, p, b), ((k = R && R.onVnodeMounted) || V || L) && ve(() => {
      k && Ae(k, x, u), V && O.enter($), L && it(u, null, x, "mounted");
    }, y);
  }, me = (u, p, b, x, y) => {
    if (b && _(u, b), x)
      for (let m = 0; m < x.length; m++)
        _(u, x[m]);
    if (y) {
      let m = y.subTree;
      if (p === m || qi(m.type) && (m.ssContent === p || m.ssFallback === p)) {
        const I = y.vnode;
        me(
          u,
          I,
          I.scopeId,
          I.slotScopeIds,
          y.parent
        );
      }
    }
  }, ke = (u, p, b, x, y, m, I, E, $ = 0) => {
    for (let k = $; k < u.length; k++) {
      const R = u[k] = E ? Ve(u[k]) : Le(u[k]);
      A(
        null,
        R,
        p,
        b,
        x,
        y,
        m,
        I,
        E
      );
    }
  }, Qe = (u, p, b, x, y, m, I) => {
    const E = p.el = u.el;
    let { patchFlag: $, dynamicChildren: k, dirs: R } = p;
    $ |= u.patchFlag & 16;
    const T = u.props || Y, O = p.props || Y;
    let L;
    if (b && lt(b, !1), (L = O.onVnodeBeforeUpdate) && Ae(L, b, p, u), R && it(p, u, b, "beforeUpdate"), b && lt(b, !0), (T.innerHTML && O.innerHTML == null || T.textContent && O.textContent == null) && d(E, ""), k ? Ue(
      u.dynamicChildren,
      k,
      E,
      b,
      x,
      Cs(p, y),
      m
    ) : I || Z(
      u,
      p,
      E,
      null,
      b,
      x,
      Cs(p, y),
      m,
      !1
    ), $ > 0) {
      if ($ & 16)
        st(E, T, O, b, y);
      else if ($ & 2 && T.class !== O.class && l(E, "class", null, O.class, y), $ & 4 && l(E, "style", T.style, O.style, y), $ & 8) {
        const V = p.dynamicProps;
        for (let J = 0; J < V.length; J++) {
          const X = V[J], oe = T[X], re = O[X];
          (re !== oe || X === "value") && l(E, X, oe, re, y, b);
        }
      }
      $ & 1 && u.children !== p.children && d(E, p.children);
    } else !I && k == null && st(E, T, O, b, y);
    ((L = O.onVnodeUpdated) || R) && ve(() => {
      L && Ae(L, b, p, u), R && it(p, u, b, "updated");
    }, x);
  }, Ue = (u, p, b, x, y, m, I) => {
    for (let E = 0; E < p.length; E++) {
      const $ = u[E], k = p[E], R = (
        // oldVNode may be an errored async setup() component inside Suspense
        // which will not have a mounted element
        $.el && // - In the case of a Fragment, we need to provide the actual parent
        // of the Fragment itself so it can move its children.
        ($.type === Q || // - In the case of different nodes, there is going to be a replacement
        // which also requires the correct parent container
        !Et($, k) || // - In the case of a component, it could contain anything.
        $.shapeFlag & 198) ? r($.el) : (
          // In other cases, the parent container is not actually used so we
          // just pass the block element here to avoid a DOM parentNode call.
          b
        )
      );
      A(
        $,
        k,
        R,
        null,
        x,
        y,
        m,
        I,
        !0
      );
    }
  }, st = (u, p, b, x, y) => {
    if (p !== b) {
      if (p !== Y)
        for (const m in p)
          !Pt(m) && !(m in b) && l(
            u,
            m,
            p[m],
            null,
            y,
            x
          );
      for (const m in b) {
        if (Pt(m)) continue;
        const I = b[m], E = p[m];
        I !== E && m !== "value" && l(u, m, E, I, y, x);
      }
      "value" in b && l(u, "value", p.value, b.value, y);
    }
  }, ut = (u, p, b, x, y, m, I, E, $) => {
    const k = p.el = u ? u.el : c(""), R = p.anchor = u ? u.anchor : c("");
    let { patchFlag: T, dynamicChildren: O, slotScopeIds: L } = p;
    L && (E = E ? E.concat(L) : L), u == null ? (n(k, b, x), n(R, b, x), ke(
      // #10007
      // such fragment like `<></>` will be compiled into
      // a fragment which doesn't have a children.
      // In this case fallback to an empty array
      p.children || [],
      b,
      R,
      y,
      m,
      I,
      E,
      $
    )) : T > 0 && T & 64 && O && // #2715 the previous fragment could've been a BAILed one as a result
    // of renderSlot() with no valid children
    u.dynamicChildren && u.dynamicChildren.length === O.length ? (Ue(
      u.dynamicChildren,
      O,
      b,
      y,
      m,
      I,
      E
    ), // #2080 if the stable fragment has a key, it's a <template v-for> that may
    //  get moved around. Make sure all root level vnodes inherit el.
    // #2134 or if it's a component root, it may also get moved around
    // as the component is being moved.
    (p.key != null || y && p === y.subTree) && Gi(
      u,
      p,
      !0
      /* shallow */
    )) : Z(
      u,
      p,
      b,
      R,
      y,
      m,
      I,
      E,
      $
    );
  }, ft = (u, p, b, x, y, m, I, E, $) => {
    p.slotScopeIds = E, u == null ? p.shapeFlag & 512 ? y.ctx.activate(
      p,
      b,
      x,
      I,
      $
    ) : wt(
      p,
      b,
      x,
      y,
      m,
      I,
      $
    ) : W(u, p, $);
  }, wt = (u, p, b, x, y, m, I) => {
    const E = u.component = Ko(
      u,
      x,
      y
    );
    if (Ei(u) && (E.ctx.renderer = Ct), qo(E, !1, I), E.asyncDep) {
      if (y && y.registerDep(E, P, I), !u.el) {
        const $ = E.subTree = Be(tt);
        G(null, $, p, b), u.placeholder = $.el;
      }
    } else
      P(
        E,
        u,
        p,
        b,
        y,
        m,
        I
      );
  }, W = (u, p, b) => {
    const x = p.component = u.component;
    if (Eo(u, p, b))
      if (x.asyncDep && !x.asyncResolved) {
        S(x, p, b);
        return;
      } else
        x.next = p, x.update();
    else
      p.el = u.el, x.vnode = p;
  }, P = (u, p, b, x, y, m, I) => {
    const E = () => {
      if (u.isMounted) {
        let { next: T, bu: O, u: L, parent: V, vnode: J } = u;
        {
          const Te = Ki(u);
          if (Te) {
            T && (T.el = J.el, S(u, T, I)), Te.asyncDep.then(() => {
              ve(() => {
                u.isUnmounted || k();
              }, y);
            });
            return;
          }
        }
        let X = T, oe;
        lt(u, !1), T ? (T.el = J.el, S(u, T, I)) : T = J, O && Jt(O), (oe = T.props && T.props.onVnodeBeforeUpdate) && Ae(oe, V, T, J), lt(u, !0);
        const re = _n(u), Ie = u.subTree;
        u.subTree = re, A(
          Ie,
          re,
          // parent may have changed if it's in a teleport
          r(Ie.el),
          // anchor may have changed if it's in a fragment
          Kt(Ie),
          u,
          y,
          m
        ), T.el = re.el, X === null && Io(u, re.el), L && ve(L, y), (oe = T.props && T.props.onVnodeUpdated) && ve(
          () => Ae(oe, V, T, J),
          y
        );
      } else {
        let T;
        const { el: O, props: L } = p, { bm: V, m: J, parent: X, root: oe, type: re } = u, Ie = Rt(p);
        lt(u, !1), V && Jt(V), !Ie && (T = L && L.onVnodeBeforeMount) && Ae(T, X, p), lt(u, !0);
        {
          oe.ce && oe.ce._hasShadowRoot() && oe.ce._injectChildStyle(
            re,
            u.parent ? u.parent.type : void 0
          );
          const Te = u.subTree = _n(u);
          A(
            null,
            Te,
            b,
            x,
            u,
            y,
            m
          ), p.el = Te.el;
        }
        if (J && ve(J, y), !Ie && (T = L && L.onVnodeMounted)) {
          const Te = p;
          ve(
            () => Ae(T, X, Te),
            y
          );
        }
        (p.shapeFlag & 256 || X && Rt(X.vnode) && X.vnode.shapeFlag & 256) && u.a && ve(u.a, y), u.isMounted = !0, p = b = x = null;
      }
    };
    u.scope.on();
    const $ = u.effect = new ni(E);
    u.scope.off();
    const k = u.update = $.run.bind($), R = u.job = $.runIfDirty.bind($);
    R.i = u, R.id = u.uid, $.scheduler = () => nn(R), lt(u, !0), k();
  }, S = (u, p, b) => {
    p.component = u;
    const x = u.vnode.props;
    u.vnode = p, u.next = null, Po(u, p.props, x, b), Ro(u, p.children, b), qe(), yn(u), ze();
  }, Z = (u, p, b, x, y, m, I, E, $ = !1) => {
    const k = u && u.children, R = u ? u.shapeFlag : 0, T = p.children, { patchFlag: O, shapeFlag: L } = p;
    if (O > 0) {
      if (O & 128) {
        Gt(
          k,
          T,
          b,
          x,
          y,
          m,
          I,
          E,
          $
        );
        return;
      } else if (O & 256) {
        Xe(
          k,
          T,
          b,
          x,
          y,
          m,
          I,
          E,
          $
        );
        return;
      }
    }
    L & 8 ? (R & 16 && St(k, y, m), T !== k && d(b, T)) : R & 16 ? L & 16 ? Gt(
      k,
      T,
      b,
      x,
      y,
      m,
      I,
      E,
      $
    ) : St(k, y, m, !0) : (R & 8 && d(b, ""), L & 16 && ke(
      T,
      b,
      x,
      y,
      m,
      I,
      E,
      $
    ));
  }, Xe = (u, p, b, x, y, m, I, E, $) => {
    u = u || gt, p = p || gt;
    const k = u.length, R = p.length, T = Math.min(k, R);
    let O;
    for (O = 0; O < T; O++) {
      const L = p[O] = $ ? Ve(p[O]) : Le(p[O]);
      A(
        u[O],
        L,
        b,
        null,
        y,
        m,
        I,
        E,
        $
      );
    }
    k > R ? St(
      u,
      y,
      m,
      !0,
      !1,
      T
    ) : ke(
      p,
      b,
      x,
      y,
      m,
      I,
      E,
      $,
      T
    );
  }, Gt = (u, p, b, x, y, m, I, E, $) => {
    let k = 0;
    const R = p.length;
    let T = u.length - 1, O = R - 1;
    for (; k <= T && k <= O; ) {
      const L = u[k], V = p[k] = $ ? Ve(p[k]) : Le(p[k]);
      if (Et(L, V))
        A(
          L,
          V,
          b,
          null,
          y,
          m,
          I,
          E,
          $
        );
      else
        break;
      k++;
    }
    for (; k <= T && k <= O; ) {
      const L = u[T], V = p[O] = $ ? Ve(p[O]) : Le(p[O]);
      if (Et(L, V))
        A(
          L,
          V,
          b,
          null,
          y,
          m,
          I,
          E,
          $
        );
      else
        break;
      T--, O--;
    }
    if (k > T) {
      if (k <= O) {
        const L = O + 1, V = L < R ? p[L].el : x;
        for (; k <= O; )
          A(
            null,
            p[k] = $ ? Ve(p[k]) : Le(p[k]),
            b,
            V,
            y,
            m,
            I,
            E,
            $
          ), k++;
      }
    } else if (k > O)
      for (; k <= T; )
        Ee(u[k], y, m, !0), k++;
    else {
      const L = k, V = k, J = /* @__PURE__ */ new Map();
      for (k = V; k <= O; k++) {
        const be = p[k] = $ ? Ve(p[k]) : Le(p[k]);
        be.key != null && J.set(be.key, k);
      }
      let X, oe = 0;
      const re = O - V + 1;
      let Ie = !1, Te = 0;
      const _t = new Array(re);
      for (k = 0; k < re; k++) _t[k] = 0;
      for (k = L; k <= T; k++) {
        const be = u[k];
        if (oe >= re) {
          Ee(be, y, m, !0);
          continue;
        }
        let Pe;
        if (be.key != null)
          Pe = J.get(be.key);
        else
          for (X = V; X <= O; X++)
            if (_t[X - V] === 0 && Et(be, p[X])) {
              Pe = X;
              break;
            }
        Pe === void 0 ? Ee(be, y, m, !0) : (_t[Pe - V] = k + 1, Pe >= Te ? Te = Pe : Ie = !0, A(
          be,
          p[Pe],
          b,
          null,
          y,
          m,
          I,
          E,
          $
        ), oe++);
      }
      const fn = Ie ? Do(_t) : gt;
      for (X = fn.length - 1, k = re - 1; k >= 0; k--) {
        const be = V + k, Pe = p[be], dn = p[be + 1], hn = be + 1 < R ? (
          // #13559, #14173 fallback to el placeholder for unresolved async component
          dn.el || Bi(dn)
        ) : x;
        _t[k] === 0 ? A(
          null,
          Pe,
          b,
          hn,
          y,
          m,
          I,
          E,
          $
        ) : Ie && (X < 0 || k !== fn[X] ? nt(Pe, b, hn, 2) : X--);
      }
    }
  }, nt = (u, p, b, x, y = null) => {
    const { el: m, type: I, transition: E, children: $, shapeFlag: k } = u;
    if (k & 6) {
      nt(u.component.subTree, p, b, x);
      return;
    }
    if (k & 128) {
      u.suspense.move(p, b, x);
      return;
    }
    if (k & 64) {
      I.move(u, p, b, Ct);
      return;
    }
    if (I === Q) {
      n(m, p, b);
      for (let T = 0; T < $.length; T++)
        nt($[T], p, b, x);
      n(u.anchor, p, b);
      return;
    }
    if (I === _s) {
      H(u, p, b);
      return;
    }
    if (x !== 2 && k & 1 && E)
      if (x === 0)
        E.beforeEnter(m), n(m, p, b), ve(() => E.enter(m), y);
      else {
        const { leave: T, delayLeave: O, afterLeave: L } = E, V = () => {
          u.ctx.isUnmounted ? i(m) : n(m, p, b);
        }, J = () => {
          m._isLeaving && m[to](
            !0
            /* cancelled */
          ), T(m, () => {
            V(), L && L();
          });
        };
        O ? O(m, V, J) : J();
      }
    else
      n(m, p, b);
  }, Ee = (u, p, b, x = !1, y = !1) => {
    const {
      type: m,
      props: I,
      ref: E,
      children: $,
      dynamicChildren: k,
      shapeFlag: R,
      patchFlag: T,
      dirs: O,
      cacheIndex: L,
      memo: V
    } = u;
    if (T === -2 && (y = !1), E != null && (qe(), Mt(E, null, b, u, !0), ze()), L != null && (p.renderCache[L] = void 0), R & 256) {
      p.ctx.deactivate(u);
      return;
    }
    const J = R & 1 && O, X = !Rt(u);
    let oe;
    if (X && (oe = I && I.onVnodeBeforeUnmount) && Ae(oe, p, u), R & 6)
      nl(u.component, b, x);
    else {
      if (R & 128) {
        u.suspense.unmount(b, x);
        return;
      }
      J && it(u, null, p, "beforeUnmount"), R & 64 ? u.type.remove(
        u,
        p,
        b,
        Ct,
        x
      ) : k && // #5154
      // when v-once is used inside a block, setBlockTracking(-1) marks the
      // parent block with hasOnce: true
      // so that it doesn't take the fast path during unmount - otherwise
      // components nested in v-once are never unmounted.
      !k.hasOnce && // #1153: fast path should not be taken for non-stable (v-for) fragments
      (m !== Q || T > 0 && T & 64) ? St(
        k,
        p,
        b,
        !1,
        !0
      ) : (m === Q && T & 384 || !y && R & 16) && St($, p, b), x && cn(u);
    }
    const re = V != null && L == null;
    (X && (oe = I && I.onVnodeUnmounted) || J || re) && ve(() => {
      oe && Ae(oe, p, u), J && it(u, null, p, "unmounted"), re && (u.el = null);
    }, b);
  }, cn = (u) => {
    const { type: p, el: b, anchor: x, transition: y } = u;
    if (p === Q) {
      sl(b, x);
      return;
    }
    if (p === _s) {
      M(u);
      return;
    }
    const m = () => {
      i(b), y && !y.persisted && y.afterLeave && y.afterLeave();
    };
    if (u.shapeFlag & 1 && y && !y.persisted) {
      const { leave: I, delayLeave: E } = y, $ = () => I(b, m);
      E ? E(u.el, m, $) : $();
    } else
      m();
  }, sl = (u, p) => {
    let b;
    for (; u !== p; )
      b = g(u), i(u), u = b;
    i(p);
  }, nl = (u, p, b) => {
    const { bum: x, scope: y, job: m, subTree: I, um: E, m: $, a: k } = u;
    In($), In(k), x && Jt(x), y.stop(), m && (m.flags |= 8, Ee(I, u, p, b)), E && ve(E, p), ve(() => {
      u.isUnmounted = !0;
    }, p);
  }, St = (u, p, b, x = !1, y = !1, m = 0) => {
    for (let I = m; I < u.length; I++)
      Ee(u[I], p, b, x, y);
  }, Kt = (u) => {
    if (u.shapeFlag & 6)
      return Kt(u.component.subTree);
    if (u.shapeFlag & 128)
      return u.suspense.next();
    const p = g(u.anchor || u.el), b = p && p[Xl];
    return b ? g(b) : p;
  };
  let bs = !1;
  const un = (u, p, b) => {
    let x;
    u == null ? p._vnode && (Ee(p._vnode, null, null, !0), x = p._vnode.component) : A(
      p._vnode || null,
      u,
      p,
      null,
      null,
      null,
      b
    ), p._vnode = u, bs || (bs = !0, yn(x), xi(), bs = !1);
  }, Ct = {
    p: A,
    um: Ee,
    m: nt,
    r: cn,
    mt: wt,
    mc: ke,
    pc: Z,
    pbc: Ue,
    n: Kt,
    o: e
  };
  return {
    render: un,
    hydrate: void 0,
    createApp: xo(un)
  };
}
function Cs({ type: e, props: t }, s) {
  return s === "svg" && e === "foreignObject" || s === "mathml" && e === "annotation-xml" && t && t.encoding && t.encoding.includes("html") ? void 0 : s;
}
function lt({ effect: e, job: t }, s) {
  s ? (e.flags |= 32, t.flags |= 4) : (e.flags &= -33, t.flags &= -5);
}
function Fo(e, t) {
  return (!e || e && !e.pendingBranch) && t && !t.persisted;
}
function Gi(e, t, s = !1) {
  const n = e.children, i = t.children;
  if (j(n) && j(i))
    for (let l = 0; l < n.length; l++) {
      const o = n[l];
      let c = i[l];
      c.shapeFlag & 1 && !c.dynamicChildren && ((c.patchFlag <= 0 || c.patchFlag === 32) && (c = i[l] = Ve(i[l]), c.el = o.el), !s && c.patchFlag !== -2 && Gi(o, c)), c.type === gs && (c.patchFlag === -1 && (c = i[l] = Ve(c)), c.el = o.el), c.type === tt && !c.el && (c.el = o.el);
    }
}
function Do(e) {
  const t = e.slice(), s = [0];
  let n, i, l, o, c;
  const f = e.length;
  for (n = 0; n < f; n++) {
    const h = e[n];
    if (h !== 0) {
      if (i = s[s.length - 1], e[i] < h) {
        t[n] = i, s.push(n);
        continue;
      }
      for (l = 0, o = s.length - 1; l < o; )
        c = l + o >> 1, e[s[c]] < h ? l = c + 1 : o = c;
      h < e[s[l]] && (l > 0 && (t[n] = s[l - 1]), s[l] = n);
    }
  }
  for (l = s.length, o = s[l - 1]; l-- > 0; )
    s[l] = o, o = t[o];
  return s;
}
function Ki(e) {
  const t = e.subTree.component;
  if (t)
    return t.asyncDep && !t.asyncResolved ? t : Ki(t);
}
function In(e) {
  if (e)
    for (let t = 0; t < e.length; t++)
      e[t].flags |= 8;
}
function Bi(e) {
  if (e.placeholder)
    return e.placeholder;
  const t = e.component;
  return t ? Bi(t.subTree) : null;
}
const qi = (e) => e.__isSuspense;
function No(e, t) {
  t && t.pendingBranch ? j(e) ? t.effects.push(...e) : t.effects.push(e) : Kl(e);
}
const Q = /* @__PURE__ */ Symbol.for("v-fgt"), gs = /* @__PURE__ */ Symbol.for("v-txt"), tt = /* @__PURE__ */ Symbol.for("v-cmt"), _s = /* @__PURE__ */ Symbol.for("v-stc"), jt = [];
let ye = null;
function w(e = !1) {
  jt.push(ye = e ? null : []);
}
function Zo() {
  jt.pop(), ye = jt[jt.length - 1] || null;
}
let Zt = 1;
function Tn(e, t = !1) {
  Zt += e, e < 0 && ye && t && (ye.hasOnce = !0);
}
function zi(e) {
  return e.dynamicChildren = Zt > 0 ? ye || gt : null, Zo(), Zt > 0 && ye && ye.push(e), e;
}
function C(e, t, s, n, i, l) {
  return zi(
    a(
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
function Ns(e, t, s, n, i) {
  return zi(
    Be(
      e,
      t,
      s,
      n,
      i,
      !0
    )
  );
}
function Ji(e) {
  return e ? e.__v_isVNode === !0 : !1;
}
function Et(e, t) {
  return e.type === t.type && e.key === t.key;
}
const Yi = ({ key: e }) => e ?? null, Xt = ({
  ref: e,
  ref_key: t,
  ref_for: s
}) => (typeof e == "number" && (e = "" + e), e != null ? ie(e) || /* @__PURE__ */ ue(e) || F(e) ? { i: xe, r: e, k: t, f: !!s } : e : null);
function a(e, t = null, s = null, n = 0, i = null, l = e === Q ? 0 : 1, o = !1, c = !1) {
  const f = {
    __v_isVNode: !0,
    __v_skip: !0,
    type: e,
    props: t,
    key: t && Yi(t),
    ref: t && Xt(t),
    scopeId: Si,
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
    ctx: xe
  };
  return c ? (an(f, s), l & 128 && e.normalize(f)) : s && (f.shapeFlag |= ie(s) ? 8 : 16), Zt > 0 && // avoid a block node from tracking itself
  !o && // has current parent block
  ye && // presence of a patch flag indicates this node needs patching on updates.
  // component nodes also should always be patched, because even if the
  // component doesn't need to update, it needs to persist the instance on to
  // the next vnode so that it can be properly unmounted later.
  (f.patchFlag > 0 || l & 6) && // the EVENTS flag is only for hydration and if it is the only flag, the
  // vnode should not be considered dynamic due to handler caching.
  f.patchFlag !== 32 && ye.push(f), f;
}
const Be = Uo;
function Uo(e, t = null, s = null, n = 0, i = null, l = !1) {
  if ((!e || e === ho) && (e = tt), Ji(e)) {
    const c = xt(
      e,
      t,
      !0
      /* mergeRef: true */
    );
    return s && an(c, s), Zt > 0 && !l && ye && (c.shapeFlag & 6 ? ye[ye.indexOf(e)] = c : ye.push(c)), c.patchFlag = -2, c;
  }
  if (Qo(e) && (e = e.__vccOpts), t) {
    t = Ho(t);
    let { class: c, style: f } = t;
    c && !ie(c) && (t.class = te(c)), z(f) && (/* @__PURE__ */ sn(f) && !j(f) && (f = fe({}, f)), t.style = Bs(f));
  }
  const o = ie(e) ? 1 : qi(e) ? 128 : eo(e) ? 64 : z(e) ? 4 : F(e) ? 2 : 0;
  return a(
    e,
    t,
    s,
    n,
    i,
    o,
    l,
    !0
  );
}
function Ho(e) {
  return e ? /* @__PURE__ */ sn(e) || Ni(e) ? fe({}, e) : e : null;
}
function xt(e, t, s = !1, n = !1) {
  const { props: i, ref: l, patchFlag: o, children: c, transition: f } = e, h = t ? Wo(i || {}, t) : i, d = {
    __v_isVNode: !0,
    __v_skip: !0,
    type: e.type,
    props: h,
    key: h && Yi(h),
    ref: t && t.ref ? (
      // #2078 in the case of <component :is="vnode" ref="extra"/>
      // if the vnode itself already has a ref, cloneVNode will need to merge
      // the refs so the single vnode can be set on multiple refs
      s && l ? j(l) ? l.concat(Xt(t)) : [l, Xt(t)] : Xt(t)
    ) : l,
    scopeId: e.scopeId,
    slotScopeIds: e.slotScopeIds,
    children: c,
    target: e.target,
    targetStart: e.targetStart,
    targetAnchor: e.targetAnchor,
    staticCount: e.staticCount,
    shapeFlag: e.shapeFlag,
    // if the vnode is cloned with extra props, we can no longer assume its
    // existing patch flag to be reliable and need to add the FULL_PROPS flag.
    // note: preserve flag for fragments since they use the flag for children
    // fast paths only.
    patchFlag: t && e.type !== Q ? o === -1 ? 16 : o | 16 : o,
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
    ssContent: e.ssContent && xt(e.ssContent),
    ssFallback: e.ssFallback && xt(e.ssFallback),
    placeholder: e.placeholder,
    el: e.el,
    anchor: e.anchor,
    ctx: e.ctx,
    ce: e.ce
  };
  return f && n && ln(
    d,
    f.clone(d)
  ), d;
}
function le(e = " ", t = 0) {
  return Be(gs, null, e, t);
}
function se(e = "", t = !1) {
  return t ? (w(), Ns(tt, null, e)) : Be(tt, null, e);
}
function Le(e) {
  return e == null || typeof e == "boolean" ? Be(tt) : j(e) ? Be(
    Q,
    null,
    // #3666, avoid reference pollution when reusing vnode
    e.slice()
  ) : Ji(e) ? Ve(e) : Be(gs, null, String(e));
}
function Ve(e) {
  return e.el === null && e.patchFlag !== -1 || e.memo ? e : xt(e);
}
function an(e, t) {
  let s = 0;
  const { shapeFlag: n } = e;
  if (t == null)
    t = null;
  else if (j(t))
    s = 16;
  else if (typeof t == "object")
    if (n & 65) {
      const i = t.default;
      i && (i._c && (i._d = !1), an(e, i()), i._c && (i._d = !0));
      return;
    } else {
      s = 32;
      const i = t._;
      !i && !Ni(t) ? t._ctx = xe : i === 3 && xe && (xe.slots._ === 1 ? t._ = 1 : (t._ = 2, e.patchFlag |= 1024));
    }
  else F(t) ? (t = { default: t, _ctx: xe }, s = 32) : (t = String(t), n & 64 ? (s = 16, t = [le(t)]) : s = 8);
  e.children = t, e.shapeFlag |= s;
}
function Wo(...e) {
  const t = {};
  for (let s = 0; s < e.length; s++) {
    const n = e[s];
    for (const i in n)
      if (i === "class")
        t.class !== n.class && (t.class = te([t.class, n.class]));
      else if (i === "style")
        t.style = Bs([t.style, n.style]);
      else if (rs(i)) {
        const l = t[i], o = n[i];
        o && l !== o && !(j(l) && l.includes(o)) ? t[i] = l ? [].concat(l, o) : o : o == null && l == null && // mergeProps({ 'onUpdate:modelValue': undefined }) should not retain
        // the model listener.
        !as(i) && (t[i] = o);
      } else i !== "" && (t[i] = n[i]);
  }
  return t;
}
function Ae(e, t, s, n = null) {
  Ze(e, t, 7, [
    s,
    n
  ]);
}
const Vo = Ri();
let Go = 0;
function Ko(e, t, s) {
  const n = e.type, i = (t ? t.appContext : e.appContext) || Vo, l = {
    uid: Go++,
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
    scope: new gl(
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
    propsOptions: Ui(n, i),
    emitsOptions: Li(n, i),
    // emit
    emit: null,
    // to be set immediately
    emitted: null,
    // props default value
    propsDefaults: Y,
    // inheritAttrs
    inheritAttrs: n.inheritAttrs,
    // state
    ctx: Y,
    data: Y,
    props: Y,
    attrs: Y,
    slots: Y,
    refs: Y,
    setupState: Y,
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
  return l.ctx = { _: l }, l.root = t ? t.root : l, l.emit = So.bind(null, l), e.ce && e.ce(l), l;
}
let ge = null;
const Bo = () => ge || xe;
let ls, Zs;
{
  const e = us(), t = (s, n) => {
    let i;
    return (i = e[s]) || (i = e[s] = []), i.push(n), (l) => {
      i.length > 1 ? i.forEach((o) => o(l)) : i[0](l);
    };
  };
  ls = t(
    "__VUE_INSTANCE_SETTERS__",
    (s) => ge = s
  ), Zs = t(
    "__VUE_SSR_SETTERS__",
    (s) => Ut = s
  );
}
const Vt = (e) => {
  const t = ge;
  return ls(e), e.scope.on(), () => {
    e.scope.off(), ls(t);
  };
}, Pn = () => {
  ge && ge.scope.off(), ls(null);
};
function Qi(e) {
  return e.vnode.shapeFlag & 4;
}
let Ut = !1;
function qo(e, t = !1, s = !1) {
  t && Zs(t);
  const { props: n, children: i } = e.vnode, l = Qi(e);
  To(e, n, l, t), Mo(e, i, s || t);
  const o = l ? zo(e, t) : void 0;
  return t && Zs(!1), o;
}
function zo(e, t) {
  const s = e.type;
  e.accessCache = /* @__PURE__ */ Object.create(null), e.proxy = new Proxy(e.ctx, po);
  const { setup: n } = s;
  if (n) {
    qe();
    const i = e.setupContext = n.length > 1 ? Yo(e) : null, l = Vt(e), o = Wt(
      n,
      e,
      0,
      [
        e.props,
        i
      ]
    ), c = zn(o);
    if (ze(), l(), (c || e.sp) && !Rt(e) && $i(e), c) {
      if (o.then(Pn, Pn), t)
        return o.then((f) => {
          An(e, f);
        }).catch((f) => {
          ds(f, e, 0);
        });
      e.asyncDep = o;
    } else
      An(e, o);
  } else
    Xi(e);
}
function An(e, t, s) {
  F(t) ? e.type.__ssrInlineRender ? e.ssrRender = t : e.render = t : z(t) && (e.setupState = bi(t)), Xi(e);
}
function Xi(e, t, s) {
  const n = e.type;
  e.render || (e.render = n.render || Fe);
  {
    const i = Vt(e);
    qe();
    try {
      go(e);
    } finally {
      ze(), i();
    }
  }
}
const Jo = {
  get(e, t) {
    return ce(e, "get", ""), e[t];
  }
};
function Yo(e) {
  const t = (s) => {
    e.exposed = s || {};
  };
  return {
    attrs: new Proxy(e.attrs, Jo),
    slots: e.slots,
    emit: e.emit,
    expose: t
  };
}
function vs(e) {
  return e.exposed ? e.exposeProxy || (e.exposeProxy = new Proxy(bi(jl(e.exposed)), {
    get(t, s) {
      if (s in t)
        return t[s];
      if (s in Lt)
        return Lt[s](e);
    },
    has(t, s) {
      return s in t || s in Lt;
    }
  })) : e.proxy;
}
function Qo(e) {
  return F(e) && "__vccOpts" in e;
}
const Se = (e, t) => /* @__PURE__ */ Ul(e, t, Ut), Xo = "3.5.34";
let Us;
const On = typeof window < "u" && window.trustedTypes;
if (On)
  try {
    Us = /* @__PURE__ */ On.createPolicy("vue", {
      createHTML: (e) => e
    });
  } catch {
  }
const el = Us ? (e) => Us.createHTML(e) : (e) => e, er = "http://www.w3.org/2000/svg", tr = "http://www.w3.org/1998/Math/MathML", We = typeof document < "u" ? document : null, Mn = We && /* @__PURE__ */ We.createElement("template"), sr = {
  insert: (e, t, s) => {
    t.insertBefore(e, s || null);
  },
  remove: (e) => {
    const t = e.parentNode;
    t && t.removeChild(e);
  },
  createElement: (e, t, s, n) => {
    const i = t === "svg" ? We.createElementNS(er, e) : t === "mathml" ? We.createElementNS(tr, e) : s ? We.createElement(e, { is: s }) : We.createElement(e);
    return e === "select" && n && n.multiple != null && i.setAttribute("multiple", n.multiple), i;
  },
  createText: (e) => We.createTextNode(e),
  createComment: (e) => We.createComment(e),
  setText: (e, t) => {
    e.nodeValue = t;
  },
  setElementText: (e, t) => {
    e.textContent = t;
  },
  parentNode: (e) => e.parentNode,
  nextSibling: (e) => e.nextSibling,
  querySelector: (e) => We.querySelector(e),
  setScopeId(e, t) {
    e.setAttribute(t, "");
  },
  // __UNSAFE__
  // Reason: innerHTML.
  // Static content here can only come from compiled templates.
  // As long as the user only uses trusted templates, this is safe.
  insertStaticContent(e, t, s, n, i, l) {
    const o = s ? s.previousSibling : t.lastChild;
    if (i && (i === l || i.nextSibling))
      for (; t.insertBefore(i.cloneNode(!0), s), !(i === l || !(i = i.nextSibling)); )
        ;
    else {
      Mn.innerHTML = el(
        n === "svg" ? `<svg>${e}</svg>` : n === "mathml" ? `<math>${e}</math>` : e
      );
      const c = Mn.content;
      if (n === "svg" || n === "mathml") {
        const f = c.firstChild;
        for (; f.firstChild; )
          c.appendChild(f.firstChild);
        c.removeChild(f);
      }
      t.insertBefore(c, s);
    }
    return [
      // first
      o ? o.nextSibling : t.firstChild,
      // last
      s ? s.previousSibling : t.lastChild
    ];
  }
}, nr = /* @__PURE__ */ Symbol("_vtc");
function ir(e, t, s) {
  const n = e[nr];
  n && (t = (t ? [t, ...n] : [...n]).join(" ")), t == null ? e.removeAttribute("class") : s ? e.setAttribute("class", t) : e.className = t;
}
const Rn = /* @__PURE__ */ Symbol("_vod"), lr = /* @__PURE__ */ Symbol("_vsh"), or = /* @__PURE__ */ Symbol(""), rr = /(?:^|;)\s*display\s*:/;
function ar(e, t, s) {
  const n = e.style, i = ie(s);
  let l = !1;
  if (s && !i) {
    if (t)
      if (ie(t))
        for (const o of t.split(";")) {
          const c = o.slice(0, o.indexOf(":")).trim();
          s[c] == null && Tt(n, c, "");
        }
      else
        for (const o in t)
          s[o] == null && Tt(n, o, "");
    for (const o in s) {
      o === "display" && (l = !0);
      const c = s[o];
      c != null ? ur(
        e,
        o,
        !ie(t) && t ? t[o] : void 0,
        c
      ) || Tt(n, o, c) : Tt(n, o, "");
    }
  } else if (i) {
    if (t !== s) {
      const o = n[or];
      o && (s += ";" + o), n.cssText = s, l = rr.test(s);
    }
  } else t && e.removeAttribute("style");
  Rn in e && (e[Rn] = l ? n.display : "", e[lr] && (n.display = "none"));
}
const Ln = /\s*!important$/;
function Tt(e, t, s) {
  if (j(s))
    s.forEach((n) => Tt(e, t, n));
  else if (s == null && (s = ""), t.startsWith("--"))
    e.setProperty(t, s);
  else {
    const n = cr(e, t);
    Ln.test(s) ? e.setProperty(
      ct(n),
      s.replace(Ln, ""),
      "important"
    ) : e[n] = s;
  }
}
const jn = ["Webkit", "Moz", "ms"], $s = {};
function cr(e, t) {
  const s = $s[t];
  if (s)
    return s;
  let n = Ce(t);
  if (n !== "filter" && n in e)
    return $s[t] = n;
  n = Qn(n);
  for (let i = 0; i < jn.length; i++) {
    const l = jn[i] + n;
    if (l in e)
      return $s[t] = l;
  }
  return t;
}
function ur(e, t, s, n) {
  return e.tagName === "TEXTAREA" && (t === "width" || t === "height") && ie(n) && s === n;
}
const Fn = "http://www.w3.org/1999/xlink";
function Dn(e, t, s, n, i, l = hl(t)) {
  n && t.startsWith("xlink:") ? s == null ? e.removeAttributeNS(Fn, t.slice(6, t.length)) : e.setAttributeNS(Fn, t, s) : s == null || l && !ei(s) ? e.removeAttribute(t) : e.setAttribute(
    t,
    l ? "" : Ne(s) ? String(s) : s
  );
}
function Nn(e, t, s, n, i) {
  if (t === "innerHTML" || t === "textContent") {
    s != null && (e[t] = t === "innerHTML" ? el(s) : s);
    return;
  }
  const l = e.tagName;
  if (t === "value" && l !== "PROGRESS" && // custom elements may use _value internally
  !l.includes("-")) {
    const c = l === "OPTION" ? e.getAttribute("value") || "" : e.value, f = s == null ? (
      // #11647: value should be set as empty string for null and undefined,
      // but <input type="checkbox"> should be set as 'on'.
      e.type === "checkbox" ? "on" : ""
    ) : String(s);
    (c !== f || !("_value" in e)) && (e.value = f), s == null && e.removeAttribute(t), e._value = s;
    return;
  }
  let o = !1;
  if (s === "" || s == null) {
    const c = typeof e[t];
    c === "boolean" ? s = ei(s) : s == null && c === "string" ? (s = "", o = !0) : c === "number" && (s = 0, o = !0);
  }
  try {
    e[t] = s;
  } catch {
  }
  o && e.removeAttribute(i || t);
}
function pt(e, t, s, n) {
  e.addEventListener(t, s, n);
}
function fr(e, t, s, n) {
  e.removeEventListener(t, s, n);
}
const Zn = /* @__PURE__ */ Symbol("_vei");
function dr(e, t, s, n, i = null) {
  const l = e[Zn] || (e[Zn] = {}), o = l[t];
  if (n && o)
    o.value = n;
  else {
    const [c, f] = hr(t);
    if (n) {
      const h = l[t] = vr(
        n,
        i
      );
      pt(e, c, h, f);
    } else o && (fr(e, c, o, f), l[t] = void 0);
  }
}
const Un = /(?:Once|Passive|Capture)$/;
function hr(e) {
  let t;
  if (Un.test(e)) {
    t = {};
    let n;
    for (; n = e.match(Un); )
      e = e.slice(0, e.length - n[0].length), t[n[0].toLowerCase()] = !0;
  }
  return [e[2] === ":" ? e.slice(3) : ct(e.slice(2)), t];
}
let Es = 0;
const pr = /* @__PURE__ */ Promise.resolve(), gr = () => Es || (pr.then(() => Es = 0), Es = Date.now());
function vr(e, t) {
  const s = (n) => {
    if (!n._vts)
      n._vts = Date.now();
    else if (n._vts <= s.attached)
      return;
    Ze(
      br(n, s.value),
      t,
      5,
      [n]
    );
  };
  return s.value = e, s.attached = gr(), s;
}
function br(e, t) {
  if (j(t)) {
    const s = e.stopImmediatePropagation;
    return e.stopImmediatePropagation = () => {
      s.call(e), e._stopped = !0;
    }, t.map(
      (n) => (i) => !i._stopped && n && n(i)
    );
  } else
    return t;
}
const Hn = (e) => e.charCodeAt(0) === 111 && e.charCodeAt(1) === 110 && // lowercase letter
e.charCodeAt(2) > 96 && e.charCodeAt(2) < 123, yr = (e, t, s, n, i, l) => {
  const o = i === "svg";
  t === "class" ? ir(e, n, o) : t === "style" ? ar(e, s, n) : rs(t) ? as(t) || dr(e, t, s, n, l) : (t[0] === "." ? (t = t.slice(1), !0) : t[0] === "^" ? (t = t.slice(1), !1) : mr(e, t, n, o)) ? (Nn(e, t, n), !e.tagName.includes("-") && (t === "value" || t === "checked" || t === "selected") && Dn(e, t, n, o, l, t !== "value")) : /* #11081 force set props for possible async custom element */ e._isVueCE && // #12408 check if it's declared prop or it's async custom element
  (kr(e, t) || // @ts-expect-error _def is private
  e._def.__asyncLoader && (/[A-Z]/.test(t) || !ie(n))) ? Nn(e, Ce(t), n, l, t) : (t === "true-value" ? e._trueValue = n : t === "false-value" && (e._falseValue = n), Dn(e, t, n, o));
};
function mr(e, t, s, n) {
  if (n)
    return !!(t === "innerHTML" || t === "textContent" || t in e && Hn(t) && F(s));
  if (t === "spellcheck" || t === "draggable" || t === "translate" || t === "autocorrect" || t === "sandbox" && e.tagName === "IFRAME" || t === "form" || t === "list" && e.tagName === "INPUT" || t === "type" && e.tagName === "TEXTAREA")
    return !1;
  if (t === "width" || t === "height") {
    const i = e.tagName;
    if (i === "IMG" || i === "VIDEO" || i === "CANVAS" || i === "SOURCE")
      return !1;
  }
  return Hn(t) && ie(s) ? !1 : t in e;
}
function kr(e, t) {
  const s = (
    // @ts-expect-error _def is private
    e._def.props
  );
  if (!s)
    return !1;
  const n = Ce(t);
  return Array.isArray(s) ? s.some((i) => Ce(i) === n) : Object.keys(s).some((i) => Ce(i) === n);
}
const Wn = (e) => {
  const t = e.props["onUpdate:modelValue"] || !1;
  return j(t) ? (s) => Jt(t, s) : t;
};
function xr(e) {
  e.target.composing = !0;
}
function Vn(e) {
  const t = e.target;
  t.composing && (t.composing = !1, t.dispatchEvent(new Event("input")));
}
const Is = /* @__PURE__ */ Symbol("_assign");
function Gn(e, t, s) {
  return t && (e = e.trim()), s && (e = Ks(e)), e;
}
const wr = {
  created(e, { modifiers: { lazy: t, trim: s, number: n } }, i) {
    e[Is] = Wn(i);
    const l = n || i.props && i.props.type === "number";
    pt(e, t ? "change" : "input", (o) => {
      o.target.composing || e[Is](Gn(e.value, s, l));
    }), (s || l) && pt(e, "change", () => {
      e.value = Gn(e.value, s, l);
    }), t || (pt(e, "compositionstart", xr), pt(e, "compositionend", Vn), pt(e, "change", Vn));
  },
  // set value on mounted so it's after min/max for type="range"
  mounted(e, { value: t }) {
    e.value = t ?? "";
  },
  beforeUpdate(e, { value: t, oldValue: s, modifiers: { lazy: n, trim: i, number: l } }, o) {
    if (e[Is] = Wn(o), e.composing) return;
    const c = (l || e.type === "number") && !/^0\d/.test(e.value) ? Ks(e.value) : e.value, f = t ?? "";
    if (c === f)
      return;
    const h = e.getRootNode();
    (h instanceof Document || h instanceof ShadowRoot) && h.activeElement === e && e.type !== "range" && (n && t === s || i && e.value.trim() === f) || (e.value = f);
  }
}, Sr = /* @__PURE__ */ fe({ patchProp: yr }, sr);
let Kn;
function Cr() {
  return Kn || (Kn = Lo(Sr));
}
const _r = ((...e) => {
  const t = Cr().createApp(...e), { mount: s } = t;
  return t.mount = (n) => {
    const i = Er(n);
    if (!i) return;
    const l = t._component;
    !F(l) && !l.render && !l.template && (l.template = i.innerHTML), i.nodeType === 1 && (i.textContent = "");
    const o = s(i, !1, $r(i));
    return i instanceof Element && (i.removeAttribute("v-cloak"), i.setAttribute("data-v-app", "")), o;
  }, t;
});
function $r(e) {
  if (e instanceof SVGElement)
    return "svg";
  if (typeof MathMLElement == "function" && e instanceof MathMLElement)
    return "mathml";
}
function Er(e) {
  return ie(e) ? document.querySelector(e) : e;
}
const os = [
  { id: "all", zh: "全部能力", en: "All capabilities", icon: "fa-solid fa-shapes" },
  { id: "build", zh: "产品与交付", en: "Build & deliver", icon: "fa-solid fa-pen-ruler" },
  { id: "knowledge", zh: "知识与协作", en: "Knowledge & teamwork", icon: "fa-solid fa-diagram-project" },
  { id: "govern", zh: "治理与运维", en: "Governance & operations", icon: "fa-solid fa-shield-halved" },
  { id: "goai", zh: "GOAI 任务", en: "GOAI tasks", icon: "fa-solid fa-cubes" }
], tl = [
  { id: "delivery", zh: "从界面到交付", en: "Interface to delivery", descriptionZh: "整理界面、验证关键流程，再准备发布。", descriptionEn: "Refine interfaces, check workflows, then prepare delivery.", icon: "fa-solid fa-pen-ruler", skillIds: ["ui-polish", "regression-audit", "release-checklist"], starterZh: "请先梳理这个界面的主任务，提出层级与间距调整，再列出发布前必须验证的操作。", starterEn: "Map the primary interface task, propose layout and spacing changes, then list interactions to verify before delivery." },
  { id: "knowledge", zh: "把经验变成协作能力", en: "Knowledge into teamwork", descriptionZh: "组织知识、设计员工岗位，并安排任务交接。", descriptionEn: "Structure knowledge, define employee roles and plan handoffs.", icon: "fa-solid fa-diagram-project", skillIds: ["knowledge-base-curator", "role-card-builder", "agent-orchestrator"], starterZh: "请根据现有项目资料，整理知识目录、岗位职责与交接清单，标注缺失的信息。", starterEn: "Draft a knowledge index, role responsibilities and handoff checklist from project materials, identifying missing information." },
  { id: "goai", zh: "企业事件协作", en: "Enterprise incident teamwork", descriptionZh: "取证、制定受控计划、独立验证，连接 GOAI 主线。", descriptionEn: "Collect evidence, prepare a governed plan and independently verify outcomes.", icon: "fa-solid fa-cubes", skillIds: ["goai-evidence-collect", "goai-change-execute", "goai-service-verify"], starterZh: "请整理当前事件的只读证据需求、人工审批点和独立验证标准，先给出计划。", starterEn: "Outline read-only evidence needs, human approval points and independent verification criteria. Start with a plan." },
  { id: "operations", zh: "模型服务排查", en: "Diagnose model services", descriptionZh: "定位连接与工作区问题，核对真实配置边界。", descriptionEn: "Inspect connectivity and workspace issues within explicit configuration boundaries.", icon: "fa-solid fa-satellite-dish", skillIds: ["provider-diagnostics", "workspace-ops", "security-audit"], starterZh: "请先检查模型服务与工作区的连接条件，列出证据和可验证的修复建议。", starterEn: "Inspect model service and workspace connection requirements, then list evidence and verifiable repair recommendations." }
];
function Ir(e) {
  return /^(goai-|synapxnet-)/i.test(e) ? "goai" : /(ui-polish|regression|release|office|presentation|document|spreadsheet)/i.test(e) ? "build" : /(knowledge|role-card|agent-orchestrator|memory|find-skills)/i.test(e) ? "knowledge" : /(diagnos|security|workspace|subscription|ops)/i.test(e) ? "govern" : "all";
}
function Ts(e, t = !0) {
  const s = String(e.id || "").trim(), n = Ir(s), i = os.find((l) => l.id === n) || os[0];
  return {
    ...e,
    id: s,
    group: n,
    groupLabel: t ? i.zh : i.en,
    icon: i.icon,
    name: String(e.displayName || e.name || s),
    alias: String(e.displayAlias || s),
    description: String(e.displayDescription || e.description || ""),
    previewSummary: String(e.previewSummary || e.displayDescription || e.description || ""),
    previewHighlights: Array.isArray(e.previewHighlights) ? [...e.previewHighlights] : [],
    tags: Array.isArray(e.tags) ? [...e.tags] : [],
    files: Array.isArray(e.files) ? [...e.files] : [],
    version: String(e.version || ""),
    author: String(e.author || ""),
    lifecycleStatus: String(e.lifecycleStatus || e.lifecycle_status || "legacy"),
    evidenceOrigin: String(e.evidenceOrigin || e.evidence_origin || "legacy"),
    environmentScope: String(e.environmentScope || e.environment_scope || "legacy"),
    familyId: String(e.familyId || e.family_id || ""),
    isGlobal: e.isGlobal === !0,
    isProject: e.isProject === !0,
    installed: e.isGlobal === !0 || e.isProject === !0,
    productionEligible: e.productionEligible === !0
  };
}
function Tr(e, { query: t = "", category: s = "all", location: n = "all" } = {}) {
  const i = String(t).trim().toLowerCase();
  return e.filter((l) => s !== "all" && l.group !== s || n === "global" && !l.isGlobal || n === "project" && !l.isProject || n === "installed" && !l.installed ? !1 : !i || [l.id, l.name, l.description, l.alias, ...l.tags].join(" ").toLowerCase().includes(i));
}
function Pr(e) {
  const t = new Map(e.map((s) => [s.id, s]));
  return tl.map((s) => ({ ...s, members: s.skillIds.map((n) => ({ id: n, skill: t.get(n) || null })) }));
}
function Ar(e, t = !0) {
  const s = tl.find((n) => n.skillIds.includes(e.id));
  return s ? t ? s.starterZh : s.starterEn : t ? `请使用「${e.name}」协助我处理：
目标：
相关资料：
预期交付：
先确认缺失信息并给出计划，执行前说明需要的权限。` : `Help me with ${e.name}:
Goal:
Materials:
Expected deliverable:
Identify missing information, propose a plan and explain required permissions before execution.`;
}
function mt(e, t = !0) {
  return {
    candidate: ["候选", "Candidate"],
    verified: ["已验证", "Verified"],
    active: ["启用", "Active"],
    deprecated: ["降级", "Deprecated"],
    retired: ["退役", "Retired"],
    legacy: ["未标注", "Not specified"],
    work: ["工作沉淀", "Work"],
    rehearsal: ["演练", "Rehearsal"],
    manual: ["人工整理", "Manual"],
    external: ["外部导入", "External"],
    synthetic: ["合成环境", "Synthetic"],
    simulation: ["仿真", "Simulation"],
    staging: ["预发布", "Staging"],
    shadow: ["影子验证", "Shadow"],
    canary: ["灰度", "Canary"],
    production: ["生产", "Production"]
  }[e]?.[t ? 0 : 1] || e || (t ? "未提供" : "Not provided");
}
function Or(e) {
  const t = e.status || e.lifecycle_status, s = t === "candidate" ? ["verified"] : t === "verified" ? ["active"] : [];
  return t && !["deprecated", "retired"].includes(t) && s.push("deprecated"), s;
}
function Mr() {
  return typeof window > "u" ? null : window.openxnetApp || null;
}
function Rr(e) {
  const t = String(e?.skillLifecycleError || ""), s = !!e?.skillLifecycleLoading;
  return {
    summary: { ...e?.skillLifecycleSummary || {} },
    counts: e?.skillLifecycleSummary?.counts || {},
    items: [...e?.skillLifecycleItems || []],
    loading: s,
    error: t,
    phase: s ? "loading" : t ? "error" : "ready",
    running: !!e?.skillLifecycleRunning,
    states: e?.getSkillLifecycleStates?.() || []
  };
}
function Lr(e = Mr) {
  async function t(r, ...g) {
    const _ = e();
    if (typeof _?.[r] != "function") throw new Error(`技能接口暂不可用 / Skill action unavailable: ${r}`);
    return await _[r](...g);
  }
  function s() {
    const r = e(), g = typeof r?.isCurrentLanguageZh == "function" ? !!r.isCurrentLanguageZh() : !String(r?.currentLanguage || "zh").startsWith("en"), D = (Array.isArray(r?.computedSkillsList) ? r.computedSkillsList : (r?.skillsList || []).map((ne) => ({ ...ne, isGlobal: !0 }))).map((ne) => Ts(ne, g)), A = String(r?.activeSkillPreviewId || ""), U = D.find((ne) => ne.id === A) || null, G = String(r?.activeSkillPreviewSource || "global"), N = G === "project" ? r?.projectSkillsDetails : r?.skillsList, H = Array.isArray(N) ? N.find((ne) => ne.id === A) : null, M = !!U && Array.isArray(N) && !H, q = U ? H ? Ts({ ...H, isGlobal: U.isGlobal, isProject: U.isProject }, g) : M ? Ts({ id: A, name: U.name, isGlobal: U.isGlobal, isProject: U.isProject, sourceMetadataUnavailable: !0 }, g) : U : null;
    return {
      isZh: g,
      available: !!r,
      activeMenu: String(r?.activeMenu || ""),
      activeTab: String(r?.activeSkillCenterTab || "library"),
      query: String(r?.skillsLibraryQuery || ""),
      workspacePath: String(r?.CLISettings?.cc_path || ""),
      canUseEnterprise: r?.canUseEnterprise === !0,
      library: { items: D, loading: !!r?.skillsLoading || !!r?.projectSkillsLoading, error: String(r?.skillCatalogError || r?.projectSkillsError || "") },
      preview: { activeId: A, current: q, source: G, loading: !!q && !!r?.skillPreviewLoading, error: q ? String(r?.skillPreviewError || "") : "", renderedContent: q ? String(r?.renderedSkillContent || "") : "" },
      transform: { githubUrl: String(r?.newSkillUrl || ""), isInstalling: !!r?.isSkillInstalling, isUploading: !!r?.isUploading },
      crystal: { draft: { ...r?.skillCrystalDraft || {} }, preview: String(r?.skillCrystalPreview || ""), busy: !!r?.isSkillCrystallizing, sourceOptions: r?.getSkillCrystalSourceOptions?.() || [] },
      lifecycle: Rr(r),
      employees: (r?.staffRoles || []).map((ne) => ({ id: ne.id, name: ne.name, skillIds: Array.isArray(ne.skill_ids) ? [...ne.skill_ids] : [] }))
    };
  }
  async function n(r) {
    await t("openSkillCenter", r), r === "lifecycle" && await t("fetchSkillLifecycle", !1);
  }
  function i() {
    const r = e();
    if (typeof r?.clearSkillPreview == "function") return r.clearSkillPreview();
    r && (r.activeSkillPreviewId = "", r.renderedSkillContent = "", r.skillPreviewError = "", r.skillPreviewLoading = !1);
  }
  function l(r) {
    const g = e();
    g && (g.skillsLibraryQuery = String(r)), i();
  }
  async function o(r, g) {
    const _ = s().library.items.find((D) => D.id === r);
    if (!_) throw new Error("技能不在当前目录 / Skill is no longer in the catalog.");
    return await t("previewSkill", r, g || (_.isGlobal ? "global" : "project"));
  }
  async function c(r, g) {
    const _ = s().library.items.find((A) => A.id === g);
    if (!_) throw new Error("技能已不可用 / Skill is unavailable.");
    const D = { install: "syncToProject", removeProject: "removeProjectSkill", syncGlobal: "syncToGlobal", removeGlobal: "removeGlobalSkill" };
    if (!D[r]) throw new Error("未知技能操作 / Unknown skill action.");
    if (["install", "removeProject", "syncGlobal"].includes(r) && !s().workspacePath) throw new Error("请先选择工作区 / Select a workspace first.");
    return await t(D[r], r.startsWith("remove") ? _ : g);
  }
  async function f(r = "enterprise-skills") {
    const g = e();
    if (!g?.canUseEnterprise) return await t("promptEnterpriseAccess", r);
    g.activeMenu = "enterprise", g.enterpriseTab = r, r === "enterprise-skills" && await t("loadEnterpriseSkills");
  }
  function h(r, g) {
    const _ = e();
    !_?.skillCrystalDraft || !["source", "name", "id", "description", "trigger", "workflow", "notes", "syncToWorkspace"].includes(r) || (_.skillCrystalDraft[r] = g, r === "name" ? _.syncSkillCrystalIdFromName?.() : r === "id" ? _.handleSkillCrystalIdInput?.() : _.refreshSkillCrystalPreview?.());
  }
  function d(r) {
    const g = e();
    g && (g.newSkillUrl = String(r));
  }
  return { snapshot: s, invoke: t, openTab: n, clearPreview: i, setQuery: l, previewSkill: o, manageSkill: c, openEnterprise: f, setCrystalField: h, setGithubUrl: d };
}
const jr = ["aria-label"], Fr = { class: "oxsk-detail-heading" }, Dr = ["data-group"], Nr = { class: "oxsk-eyebrow" }, Zr = ["aria-label"], Ur = { class: "oxsk-detail-id" }, Hr = { class: "oxsk-detail-origin" }, Wr = { key: 0 }, Vr = {
  key: 0,
  class: "oxsk-hint"
}, Gr = { class: "oxsk-detail-tabs" }, Kr = { class: "oxsk-detail-section" }, Br = {
  key: 0,
  class: "oxsk-highlights"
}, qr = {
  key: 1,
  class: "oxsk-tags"
}, zr = { class: "oxsk-detail-section oxsk-task-starter" }, Jr = { class: "oxsk-section-line" }, Yr = ["aria-label"], Qr = { class: "oxsk-section-line" }, Xr = ["disabled"], ea = {
  key: 0,
  class: "oxsk-feedback",
  role: "status"
}, ta = { class: "oxsk-detail-section" }, sa = { class: "oxsk-scope-row" }, na = ["disabled"], ia = ["disabled"], la = { class: "oxsk-scope-row" }, oa = ["disabled"], ra = ["disabled"], aa = { class: "oxsk-hint oxsk-wrap-path" }, ca = { class: "oxsk-detail-section" }, ua = { class: "oxsk-metadata" }, fa = { class: "oxsk-hint" }, da = { class: "oxsk-detail-section" }, ha = { class: "oxsk-section-line" }, pa = {
  key: 0,
  class: "oxsk-tags"
}, ga = {
  key: 1,
  class: "oxsk-hint"
}, va = { class: "oxsk-provenance" }, ba = { class: "oxsk-metadata" }, ya = {
  key: 0,
  class: "oxsk-file-list"
}, ma = {
  key: 1,
  class: "oxsk-hint"
}, ka = ["disabled"], xa = {
  key: 2,
  class: "oxsk-source-section"
}, wa = {
  key: 0,
  class: "oxsk-inline-field"
}, Sa = ["value", "aria-label"], Ca = { value: "global" }, _a = { value: "project" }, $a = {
  key: 1,
  class: "oxsk-hint"
}, Ea = {
  key: 2,
  class: "oxsk-source-status",
  role: "status"
}, Ia = {
  key: 3,
  class: "oxsk-source-status"
}, Ta = { role: "alert" }, Pa = ["innerHTML"], Aa = {
  key: 5,
  class: "oxsk-hint"
}, Oa = {
  __name: "SkillDetail",
  props: { skill: { type: Object, required: !0 }, preview: { type: Object, required: !0 }, isZh: Boolean, workspacePath: String, employees: { type: Array, default: () => [] }, busy: Boolean },
  emits: ["close", "manage", "preview", "enterprise"],
  setup(e, { emit: t }) {
    const s = e, n = t, i = /* @__PURE__ */ Re("overview"), l = /* @__PURE__ */ Re(Ar(s.skill, s.isZh)), o = /* @__PURE__ */ Re(""), c = Se(() => s.employees.filter((d) => d.skillIds.includes(s.skill.id)));
    async function f() {
      try {
        await navigator.clipboard.writeText(l.value), o.value = s.isZh ? "已复制，可粘贴到任务草稿。" : "Copied. Paste into a task draft.";
      } catch {
        o.value = s.isZh ? "未能访问剪贴板，请选中文本后复制。" : "Clipboard unavailable. Select and copy the text.";
      }
    }
    function h(d) {
      n("preview", s.skill.id, d.target.value);
    }
    return (d, r) => (w(), C("aside", {
      class: "oxsk-detail",
      "aria-label": e.isZh ? "技能详情" : "Skill detail"
    }, [
      a("header", Fr, [
        a("span", {
          class: "oxsk-icon",
          "data-group": e.skill.group
        }, [
          a("i", {
            class: te(e.skill.icon)
          }, null, 2)
        ], 8, Dr),
        a("div", null, [
          a("span", Nr, v(e.isZh ? "能力详情" : "CAPABILITY DETAIL"), 1),
          a("h2", null, v(e.skill.name), 1)
        ]),
        a("button", {
          class: "oxsk-icon-button",
          "aria-label": e.isZh ? "关闭详情" : "Close detail",
          onClick: r[0] || (r[0] = (g) => n("close"))
        }, [...r[12] || (r[12] = [
          a("i", { class: "fa-solid fa-xmark" }, null, -1)
        ])], 8, Zr)
      ]),
      a("code", Ur, v(e.skill.id), 1),
      a("p", Hr, [
        le(v(e.preview.source === "project" ? e.isZh ? "当前工作区副本" : "Workspace copy" : e.isZh ? "本机全局副本" : "Global copy"), 1),
        e.skill.version ? (w(), C("span", Wr, " · v" + v(e.skill.version), 1)) : se("", !0)
      ]),
      e.skill.sourceMetadataUnavailable ? (w(), C("p", Vr, v(e.isZh ? "当前来源的元数据不可用，请刷新目录。" : "Metadata for this source is unavailable. Refresh the catalog."), 1)) : se("", !0),
      a("div", Gr, [
        a("button", {
          class: te({ "is-active": i.value === "overview" }),
          onClick: r[1] || (r[1] = (g) => i.value = "overview")
        }, v(e.isZh ? "能力与范围" : "Capability & scope"), 3),
        a("button", {
          class: te({ "is-active": i.value === "source" }),
          onClick: r[2] || (r[2] = (g) => i.value = "source")
        }, v(e.isZh ? "原始说明" : "Source guide"), 3)
      ]),
      i.value === "overview" ? (w(), C(Q, { key: 1 }, [
        a("section", Kr, [
          a("h3", null, v(e.isZh ? "适合做什么" : "What it helps with"), 1),
          a("p", null, v(e.skill.previewSummary || (e.isZh ? "当前技能没有提供用途说明。" : "This skill has no purpose description.")), 1),
          e.skill.previewHighlights.length ? (w(), C("ul", Br, [
            (w(!0), C(Q, null, pe(e.skill.previewHighlights, (g) => (w(), C("li", { key: g }, [
              r[13] || (r[13] = a("i", { class: "fa-solid fa-check" }, null, -1)),
              le(v(g), 1)
            ]))), 128))
          ])) : se("", !0),
          e.skill.tags.length ? (w(), C("div", qr, [
            (w(!0), C(Q, null, pe(e.skill.tags, (g) => (w(), C("span", { key: g }, v(g), 1))), 128))
          ])) : se("", !0)
        ]),
        a("section", zr, [
          a("div", Jr, [
            a("h3", null, v(e.isZh ? "任务起手式" : "Task starter"), 1),
            a("span", null, v(e.isZh ? "原创建议" : "Original suggestion"), 1)
          ]),
          ql(a("textarea", {
            "onUpdate:modelValue": r[3] || (r[3] = (g) => l.value = g),
            rows: "5",
            "aria-label": e.isZh ? "编辑任务起手式" : "Edit task starter"
          }, null, 8, Yr), [
            [wr, l.value]
          ]),
          a("div", Qr, [
            a("small", null, v(e.isZh ? "可编辑、可复制；不会自动执行。" : "Edit and copy; nothing runs automatically."), 1),
            a("button", {
              class: "oxsk-button",
              disabled: !l.value.trim(),
              onClick: f
            }, [
              r[14] || (r[14] = a("i", { class: "fa-regular fa-copy" }, null, -1)),
              le(v(e.isZh ? "复制" : "Copy"), 1)
            ], 8, Xr)
          ]),
          o.value ? (w(), C("p", ea, v(o.value), 1)) : se("", !0)
        ]),
        a("section", ta, [
          a("h3", null, v(e.isZh ? "安装范围" : "Installation scope"), 1),
          a("div", sa, [
            a("div", null, [
              a("strong", null, v(e.isZh ? "本机全局" : "Global on this device"), 1),
              a("span", null, v(e.skill.isGlobal ? e.isZh ? "已安装" : "Installed" : e.isZh ? "未安装" : "Not installed"), 1)
            ]),
            !e.skill.isGlobal && e.skill.isProject ? (w(), C("button", {
              key: 0,
              class: "oxsk-button",
              disabled: e.busy || !e.workspacePath,
              onClick: r[4] || (r[4] = (g) => n("manage", "syncGlobal", e.skill.id))
            }, v(e.isZh ? "同步到本机" : "Sync globally"), 9, na)) : se("", !0),
            e.skill.isGlobal ? (w(), C("button", {
              key: 1,
              class: "oxsk-button oxsk-button--quiet-danger",
              disabled: e.busy,
              onClick: r[5] || (r[5] = (g) => n("manage", "removeGlobal", e.skill.id))
            }, v(e.isZh ? "卸载全局副本" : "Remove global copy"), 9, ia)) : se("", !0)
          ]),
          a("div", la, [
            a("div", null, [
              a("strong", null, v(e.isZh ? "当前工作区" : "Current workspace"), 1),
              a("span", null, v(e.skill.isProject ? e.isZh ? "已安装" : "Installed" : e.isZh ? "未安装" : "Not installed"), 1)
            ]),
            e.skill.isProject ? (w(), C("button", {
              key: 1,
              class: "oxsk-button oxsk-button--quiet-danger",
              disabled: e.busy || !e.workspacePath,
              onClick: r[7] || (r[7] = (g) => n("manage", "removeProject", e.skill.id))
            }, v(e.isZh ? "移除工作区副本" : "Remove workspace copy"), 9, ra)) : (w(), C("button", {
              key: 0,
              class: "oxsk-button",
              disabled: e.busy || !e.workspacePath || !e.skill.isGlobal,
              onClick: r[6] || (r[6] = (g) => n("manage", "install", e.skill.id))
            }, v(e.isZh ? "安装到工作区" : "Install to workspace"), 9, oa))
          ]),
          a("p", aa, v(e.workspacePath || (e.isZh ? "请先在工作空间中选择项目，再安装到该工作区。" : "Select a project workspace before installing into it.")), 1),
          e.workspacePath ? se("", !0) : (w(), C("button", {
            key: 0,
            class: "oxsk-link-button",
            onClick: r[8] || (r[8] = (g) => n("enterprise", "enterprise-workspaces"))
          }, [
            le(v(e.isZh ? "管理工作空间" : "Manage workspaces") + " ", 1),
            r[15] || (r[15] = a("i", { class: "fa-solid fa-arrow-right" }, null, -1))
          ]))
        ]),
        a("section", ca, [
          a("h3", null, v(e.isZh ? "状态与证据" : "State & evidence"), 1),
          a("dl", ua, [
            a("div", null, [
              a("dt", null, v(e.isZh ? "生命周期" : "Lifecycle"), 1),
              a("dd", null, v(De(mt)(e.skill.lifecycleStatus, e.isZh)), 1)
            ]),
            a("div", null, [
              a("dt", null, v(e.isZh ? "证据来源" : "Evidence origin"), 1),
              a("dd", null, v(De(mt)(e.skill.evidenceOrigin, e.isZh)), 1)
            ]),
            a("div", null, [
              a("dt", null, v(e.isZh ? "适用环境" : "Environment"), 1),
              a("dd", null, v(De(mt)(e.skill.environmentScope, e.isZh)), 1)
            ]),
            a("div", null, [
              a("dt", null, v(e.isZh ? "生产资格" : "Production eligibility"), 1),
              a("dd", null, v(e.skill.productionEligible ? e.isZh ? "已标记具备" : "Marked eligible" : e.isZh ? "未标记具备" : "Not marked eligible"), 1)
            ])
          ]),
          a("p", fa, v(e.isZh ? "安装、企业启用与执行授权分别管理。候选上传后仍需验证。" : "Installation, enterprise enablement and execution authorization are separate. Uploaded candidates still need verification."), 1)
        ]),
        a("section", da, [
          a("div", ha, [
            a("h3", null, v(e.isZh ? "关联员工" : "Linked employees"), 1),
            a("button", {
              class: "oxsk-link-button",
              onClick: r[9] || (r[9] = (g) => n("enterprise", "staff-roles"))
            }, v(e.isZh ? "配置岗位" : "Configure roles"), 1)
          ]),
          c.value.length ? (w(), C("div", pa, [
            (w(!0), C(Q, null, pe(c.value, (g) => (w(), C("span", {
              key: g.id
            }, [
              r[16] || (r[16] = a("i", { class: "fa-regular fa-user" }, null, -1)),
              le(" " + v(g.name), 1)
            ]))), 128))
          ])) : (w(), C("p", ga, v(e.isZh ? "当前已加载员工中，没有明确绑定此技能包的记录。" : "No explicit package binding found among the loaded employees."), 1))
        ]),
        a("details", va, [
          a("summary", null, v(e.isZh ? "作者、版本与文件" : "Author, version & files"), 1),
          a("dl", ba, [
            a("div", null, [
              a("dt", null, v(e.isZh ? "作者" : "Author"), 1),
              a("dd", null, v(e.skill.author || (e.isZh ? "未提供" : "Not provided")), 1)
            ]),
            a("div", null, [
              a("dt", null, v(e.isZh ? "版本" : "Version"), 1),
              a("dd", null, v(e.skill.version || (e.isZh ? "未提供" : "Not provided")), 1)
            ]),
            a("div", null, [
              a("dt", null, v(e.isZh ? "技能家族" : "Skill family"), 1),
              a("dd", null, v(e.skill.familyId || (e.isZh ? "未提供" : "Not provided")), 1)
            ])
          ]),
          e.skill.files.length ? (w(), C("ul", ya, [
            (w(!0), C(Q, null, pe(e.skill.files, (g) => (w(), C("li", { key: g }, [
              r[17] || (r[17] = a("i", { class: "fa-regular fa-file-lines" }, null, -1)),
              a("code", null, v(g), 1)
            ]))), 128))
          ])) : (w(), C("p", ma, v(e.isZh ? "未提供文件清单。" : "No file list provided."), 1))
        ]),
        a("button", {
          class: "oxsk-button oxsk-button--primary oxsk-full-button",
          disabled: e.busy,
          onClick: r[10] || (r[10] = (g) => n("enterprise", "enterprise-skills"))
        }, [
          r[18] || (r[18] = a("i", { class: "fa-solid fa-building" }, null, -1)),
          le(v(e.isZh ? "管理企业启用与候选发布" : "Enterprise enablement & candidate publishing"), 1)
        ], 8, ka)
      ], 64)) : (w(), C("section", xa, [
        e.skill.isGlobal && e.skill.isProject ? (w(), C("label", wa, [
          a("span", null, v(e.isZh ? "说明来源" : "Content source"), 1),
          a("select", {
            value: e.preview.source,
            "aria-label": e.isZh ? "说明来源" : "Content source",
            onChange: h
          }, [
            a("option", Ca, v(e.isZh ? "本机全局副本" : "Global copy"), 1),
            a("option", _a, v(e.isZh ? "当前工作区副本" : "Workspace copy"), 1)
          ], 40, Sa)
        ])) : (w(), C("p", $a, v(e.preview.source === "project" ? e.isZh ? "当前工作区 · SKILL.md" : "Workspace · SKILL.md" : e.isZh ? "本机全局 · SKILL.md" : "Global · SKILL.md"), 1)),
        e.preview.loading ? (w(), C("p", Ea, [
          r[19] || (r[19] = a("i", { class: "fa-solid fa-circle-notch fa-spin" }, null, -1)),
          le(v(e.isZh ? "正在读取原始说明…" : "Loading the source guide…"), 1)
        ])) : e.preview.error ? (w(), C("div", Ia, [
          a("p", Ta, v(e.preview.error), 1),
          a("button", {
            class: "oxsk-button",
            onClick: r[11] || (r[11] = (g) => n("preview", e.skill.id, e.preview.source))
          }, v(e.isZh ? "重新读取" : "Retry"), 1)
        ])) : e.preview.renderedContent ? (w(), C("div", {
          key: 4,
          class: "oxsk-markdown markdown-body",
          innerHTML: e.preview.renderedContent
        }, null, 8, Pa)) : (w(), C("p", Aa, v(e.isZh ? "未读取到说明内容。" : "No guide content available."), 1))
      ]))
    ], 8, jr));
  }
}, Ma = {
  key: 0,
  class: "oxsk-management"
}, Ra = { class: "oxsk-section-heading" }, La = { class: "oxsk-import-grid" }, ja = { class: "oxsk-import-card" }, Fa = { class: "oxsk-field" }, Da = ["value", "disabled"], Na = ["disabled"], Za = { class: "oxsk-import-card" }, Ua = ["disabled"], Ha = { class: "oxsk-help-row" }, Wa = ["disabled"], Va = ["disabled"], Ga = {
  key: 1,
  class: "oxsk-management"
}, Ka = { class: "oxsk-section-heading oxsk-section-line" }, Ba = ["disabled"], qa = { class: "oxsk-crystal-grid" }, za = { class: "oxsk-crystal-form" }, Ja = { class: "oxsk-field" }, Ya = ["value", "disabled"], Qa = ["value"], Xa = { class: "oxsk-form-grid" }, ec = ["value", "rows", "disabled", "onInput"], tc = ["value", "disabled", "onInput"], sc = { class: "oxsk-checkbox" }, nc = ["checked", "disabled"], ic = { class: "oxsk-hint oxsk-wrap-path" }, lc = ["disabled"], oc = { class: "oxsk-crystal-preview" }, rc = { class: "oxsk-section-line" }, ac = {
  key: 2,
  class: "oxsk-management"
}, cc = { class: "oxsk-section-heading oxsk-section-line" }, uc = { class: "oxsk-actions" }, fc = ["disabled"], dc = ["disabled"], hc = {
  key: 0,
  class: "oxsk-empty",
  role: "status"
}, pc = {
  key: 1,
  class: "oxsk-empty"
}, gc = { role: "alert" }, vc = ["disabled"], bc = { class: "oxsk-lifecycle-counts" }, yc = ["onClick"], mc = {
  key: 0,
  class: "oxsk-lifecycle-evidence"
}, kc = { key: 0 }, xc = { key: 1 }, wc = { key: 2 }, Sc = {
  key: 1,
  class: "oxsk-lifecycle-list"
}, Cc = {
  key: 0,
  class: "oxsk-lifecycle-description"
}, _c = { class: "oxsk-lifecycle-evidence" }, $c = { key: 0 }, Ec = { class: "oxsk-actions" }, Ic = ["disabled", "onClick"], Tc = {
  key: 2,
  class: "oxsk-empty"
}, Pc = {
  __name: "SkillManagement",
  props: { view: String, state: { type: Object, required: !0 }, busy: Boolean },
  emits: ["command", "field", "github", "enterprise"],
  setup(e, { emit: t }) {
    const s = e, n = t, i = /* @__PURE__ */ Re("all"), l = Se(() => s.state.isZh), o = Se(() => s.state.lifecycle.items.filter((d) => i.value === "all" || (d.status || d.lifecycle_status) === i.value)), c = Se(() => [
      ["name", l.value ? "技能名称" : "Skill name", 0],
      ["id", l.value ? "技能 ID" : "Skill ID", 0],
      ["description", l.value ? "用途描述" : "Purpose", 3],
      ["trigger", l.value ? "什么时候使用" : "When to use", 3],
      ["workflow", l.value ? "工作流步骤" : "Workflow steps", 5],
      ["notes", l.value ? "验证方式与注意事项" : "Verification & notes", 3]
    ]);
    function f(d) {
      const r = d.target.files?.[0];
      r && n("command", "processSkillUpload", r), d.target.value = "";
    }
    function h(d) {
      return typeof d != "number" || !Number.isFinite(d) ? l.value ? "未记录" : "Not recorded" : `${Math.round(d * 100)}%`;
    }
    return (d, r) => e.view === "transform" ? (w(), C("section", Ma, [
      a("div", Ra, [
        a("h2", null, v(l.value ? "把已有方法带入工作台" : "Bring your methods into the workbench"), 1),
        a("p", null, v(l.value ? "导入后会出现在本机全局技能目录，可继续配置到工作区和员工。" : "Imports appear in the global skill folder and can then be configured for workspaces and employees."), 1)
      ]),
      a("div", La, [
        a("section", ja, [
          r[12] || (r[12] = a("span", { class: "oxsk-icon" }, [
            a("i", { class: "fa-brands fa-github" })
          ], -1)),
          a("h3", null, "GitHub " + v(l.value ? "仓库" : "repository"), 1),
          a("p", null, v(l.value ? "使用包含标准技能包的仓库地址。" : "Use a repository containing a standard skill package."), 1),
          a("label", Fa, [
            a("span", null, v(l.value ? "仓库地址" : "Repository URL"), 1),
            a("input", {
              value: e.state.transform.githubUrl,
              type: "url",
              placeholder: "https://github.com/owner/repository",
              disabled: e.busy || e.state.transform.isInstalling,
              onInput: r[0] || (r[0] = (g) => n("github", g.target.value))
            }, null, 40, Da)
          ]),
          a("button", {
            class: "oxsk-button oxsk-button--primary",
            disabled: e.busy || e.state.transform.isInstalling || !e.state.transform.githubUrl.trim(),
            onClick: r[1] || (r[1] = (g) => n("command", "installSkillFromGithub"))
          }, [
            a("i", {
              class: te(e.state.transform.isInstalling ? "fa-solid fa-circle-notch fa-spin" : "fa-solid fa-download")
            }, null, 2),
            le(v(e.state.transform.isInstalling ? l.value ? "正在安装…" : "Installing…" : l.value ? "下载并安装" : "Download & install"), 1)
          ], 8, Na)
        ]),
        a("section", Za, [
          r[13] || (r[13] = a("span", { class: "oxsk-icon" }, [
            a("i", { class: "fa-regular fa-file-zipper" })
          ], -1)),
          a("h3", null, v(l.value ? "本地 ZIP 技能包" : "Local ZIP package"), 1),
          a("p", null, v(l.value ? "选择已有的技能归档文件，保留包内说明和文件。" : "Choose an existing skill archive to retain its guide and files."), 1),
          a("label", {
            class: te(["oxsk-upload", { "is-disabled": e.busy || e.state.transform.isUploading }])
          }, [
            a("input", {
              type: "file",
              accept: ".zip,application/zip",
              disabled: e.busy || e.state.transform.isUploading,
              onChange: f
            }, null, 40, Ua),
            a("i", {
              class: te(e.state.transform.isUploading ? "fa-solid fa-circle-notch fa-spin" : "fa-solid fa-arrow-up-from-bracket")
            }, null, 2),
            a("strong", null, v(e.state.transform.isUploading ? l.value ? "正在导入…" : "Importing…" : l.value ? "选择 ZIP 文件" : "Choose a ZIP file"), 1),
            a("span", null, v(l.value ? "安装位置：本机全局" : "Destination: global skill folder"), 1)
          ], 2)
        ])
      ]),
      a("div", Ha, [
        r[14] || (r[14] = a("i", { class: "fa-regular fa-folder-open" }, null, -1)),
        a("div", null, [
          a("strong", null, v(l.value ? "已有本机技能目录" : "Already have a local skill folder?"), 1),
          a("p", null, v(l.value ? "打开目录检查现有包，完成文件整理后刷新技能目录。" : "Open the folder to inspect packages, then refresh after organizing files."), 1)
        ]),
        a("button", {
          class: "oxsk-button",
          disabled: e.busy,
          onClick: r[2] || (r[2] = (g) => n("command", "openSkillsFolder"))
        }, v(l.value ? "打开目录" : "Open folder"), 9, Wa),
        a("button", {
          class: "oxsk-button",
          disabled: e.busy,
          onClick: r[3] || (r[3] = (g) => n("command", "handleRefreshSkills"))
        }, v(l.value ? "刷新目录" : "Refresh"), 9, Va)
      ])
    ])) : e.view === "crystal" ? (w(), C("section", Ga, [
      a("div", Ka, [
        a("div", null, [
          a("h2", null, v(l.value ? "把一次方法，沉淀为下一次能力" : "Turn a method into a reusable capability"), 1),
          a("p", null, v(l.value ? "写清使用条件、步骤与验证方式，生成待验证的候选技能。" : "Describe triggers, steps and verification to create a candidate skill."), 1)
        ]),
        a("button", {
          class: "oxsk-button",
          disabled: e.busy || e.state.crystal.busy,
          onClick: r[4] || (r[4] = (g) => n("command", "seedSkillCrystalExample"))
        }, [
          r[15] || (r[15] = a("i", { class: "fa-regular fa-lightbulb" }, null, -1)),
          le(v(l.value ? "填充原创示例" : "Fill example"), 1)
        ], 8, Ba)
      ]),
      a("div", qa, [
        a("section", za, [
          a("label", Ja, [
            a("span", null, v(l.value ? "方法来源" : "Method source"), 1),
            a("select", {
              value: e.state.crystal.draft.source,
              disabled: e.busy || e.state.crystal.busy,
              onChange: r[5] || (r[5] = (g) => n("field", "source", g.target.value))
            }, [
              (w(!0), C(Q, null, pe(e.state.crystal.sourceOptions, (g) => (w(), C("option", {
                key: g.value,
                value: g.value
              }, v(g.label), 9, Qa))), 128))
            ], 40, Ya)
          ]),
          a("div", Xa, [
            (w(!0), C(Q, null, pe(c.value, (g) => (w(), C("label", {
              key: g[0],
              class: te(["oxsk-field", { "oxsk-field--full": g[2] }])
            }, [
              a("span", null, v(g[1]), 1),
              g[2] ? (w(), C("textarea", {
                key: 0,
                value: e.state.crystal.draft[g[0]],
                rows: g[2],
                disabled: e.busy || e.state.crystal.busy,
                onInput: (_) => n("field", g[0], _.target.value)
              }, null, 40, ec)) : (w(), C("input", {
                key: 1,
                value: e.state.crystal.draft[g[0]],
                disabled: e.busy || e.state.crystal.busy,
                onInput: (_) => n("field", g[0], _.target.value)
              }, null, 40, tc))
            ], 2))), 128))
          ]),
          a("label", sc, [
            a("input", {
              type: "checkbox",
              checked: e.state.crystal.draft.syncToWorkspace,
              disabled: !e.state.workspacePath || e.busy || e.state.crystal.busy,
              onChange: r[6] || (r[6] = (g) => n("field", "syncToWorkspace", g.target.checked))
            }, null, 40, nc),
            a("span", null, v(l.value ? "同时安装到当前工作区" : "Also install to the current workspace"), 1)
          ]),
          a("p", ic, v(e.state.workspacePath || (l.value ? "尚未选择工作区；候选将保存到本机全局。" : "No workspace selected. The candidate will be saved globally.")), 1),
          a("button", {
            class: "oxsk-button oxsk-button--primary",
            disabled: e.busy || e.state.crystal.busy || !String(e.state.crystal.draft.name || "").trim(),
            onClick: r[7] || (r[7] = (g) => n("command", "crystallizeSkill"))
          }, [
            a("i", {
              class: te(e.state.crystal.busy ? "fa-solid fa-circle-notch fa-spin" : "fa-regular fa-gem")
            }, null, 2),
            le(v(e.state.crystal.busy ? l.value ? "正在生成…" : "Creating…" : l.value ? "生成候选技能" : "Create candidate skill"), 1)
          ], 8, lc)
        ]),
        a("aside", oc, [
          a("div", rc, [
            r[16] || (r[16] = a("h3", null, "SKILL.md", -1)),
            a("span", null, v(l.value ? "实时预览" : "Live preview"), 1)
          ]),
          a("pre", null, v(e.state.crystal.preview || (l.value ? "开始填写后，这里会显示技能文件预览。" : "Start writing to preview the skill document.")), 1)
        ])
      ])
    ])) : (w(), C("section", ac, [
      a("div", cc, [
        a("div", null, [
          a("h2", null, v(l.value ? "看清技能如何成熟" : "See how skills mature"), 1),
          a("p", null, v(l.value ? "查看真实生命周期记录。状态转换仍由既有治理规则校验。" : "Review actual lifecycle records. Existing governance rules validate transitions."), 1)
        ]),
        a("div", uc, [
          a("button", {
            class: "oxsk-button",
            disabled: e.busy || e.state.lifecycle.loading,
            onClick: r[8] || (r[8] = (g) => n("command", "fetchSkillLifecycle", !1))
          }, v(l.value ? "刷新记录" : "Refresh records"), 9, fc),
          a("button", {
            class: "oxsk-button oxsk-button--primary",
            disabled: e.busy || e.state.lifecycle.running || e.state.lifecycle.phase !== "ready",
            onClick: r[9] || (r[9] = (g) => n("command", "runSkillLifecycleSleepCycle"))
          }, [
            a("i", {
              class: te(e.state.lifecycle.running ? "fa-solid fa-circle-notch fa-spin" : "fa-regular fa-moon")
            }, null, 2),
            le(v(e.state.lifecycle.running ? l.value ? "整理中…" : "Organizing…" : l.value ? "运行睡眠整理" : "Run sleep cycle"), 1)
          ], 8, dc)
        ])
      ]),
      e.state.lifecycle.phase === "loading" ? (w(), C("div", hc, [
        r[17] || (r[17] = a("i", { class: "fa-solid fa-circle-notch fa-spin" }, null, -1)),
        a("h3", null, v(l.value ? "正在读取生命周期记录…" : "Loading lifecycle records…"), 1),
        a("p", null, v(l.value ? "读取完成后显示当前状态与计数。" : "Current states and counts appear after loading completes."), 1)
      ])) : e.state.lifecycle.phase === "error" ? (w(), C("div", pc, [
        r[19] || (r[19] = a("i", { class: "fa-solid fa-circle-exclamation" }, null, -1)),
        a("h3", null, v(l.value ? "生命周期记录暂时无法读取" : "Lifecycle records are unavailable"), 1),
        a("p", gc, v(e.state.lifecycle.error), 1),
        a("button", {
          class: "oxsk-button",
          disabled: e.busy || e.state.lifecycle.loading,
          onClick: r[10] || (r[10] = (g) => n("command", "fetchSkillLifecycle", !1))
        }, [
          r[18] || (r[18] = a("i", { class: "fa-solid fa-rotate-right" }, null, -1)),
          le(v(l.value ? "重新读取" : "Retry"), 1)
        ], 8, vc)
      ])) : (w(), C(Q, { key: 2 }, [
        a("div", bc, [
          a("button", {
            class: te({ "is-active": i.value === "all" }),
            onClick: r[11] || (r[11] = (g) => i.value = "all")
          }, [
            a("span", null, v(l.value ? "已载入记录" : "Loaded records"), 1),
            a("strong", null, v(e.state.lifecycle.items.length), 1)
          ], 2),
          (w(!0), C(Q, null, pe(e.state.lifecycle.states, (g) => (w(), C("button", {
            key: g.value,
            class: te({ "is-active": i.value === g.value }),
            onClick: (_) => i.value = g.value
          }, [
            a("span", null, v(g.label), 1),
            a("strong", null, v(e.state.lifecycle.counts[g.value] || 0), 1)
          ], 10, yc))), 128))
        ]),
        e.state.lifecycle.summary.patterns || e.state.lifecycle.summary.thresholds ? (w(), C("div", mc, [
          e.state.lifecycle.summary.patterns?.total !== void 0 ? (w(), C("span", kc, v(l.value ? "已识别模式" : "Patterns") + " · " + v(e.state.lifecycle.summary.patterns.total), 1)) : se("", !0),
          e.state.lifecycle.summary.thresholds?.candidateMinTraces !== void 0 ? (w(), C("span", xc, v(l.value ? "候选所需轨迹" : "Candidate trace requirement") + " · " + v(e.state.lifecycle.summary.thresholds.candidateMinTraces), 1)) : se("", !0),
          e.state.lifecycle.summary.thresholds?.candidateMinSuccessRate !== void 0 ? (w(), C("span", wc, v(l.value ? "候选成功率门槛" : "Candidate success gate") + " · " + v(h(e.state.lifecycle.summary.thresholds.candidateMinSuccessRate)), 1)) : se("", !0)
        ])) : se("", !0),
        o.value.length ? (w(), C("div", Sc, [
          (w(!0), C(Q, null, pe(o.value, (g) => (w(), C("article", {
            key: g.skill_id || g.id
          }, [
            a("div", null, [
              a("strong", null, v(g.name || g.skill_id || g.id), 1),
              a("code", null, v(g.skill_id || g.id), 1),
              g.description ? (w(), C("p", Cc, v(g.description), 1)) : se("", !0),
              a("div", _c, [
                a("span", null, v(l.value ? "使用记录" : "Uses") + " · " + v(g.use_count ?? (l.value ? "未记录" : "Not recorded")), 1),
                a("span", null, v(l.value ? "成功率" : "Success rate") + " · " + v(h(g.success_rate)), 1),
                g.tool_chain?.length ? (w(), C("span", $c, v(g.tool_chain.join(" → ")), 1)) : se("", !0)
              ])
            ]),
            a("span", null, v(De(mt)(g.status || g.lifecycle_status, l.value)), 1),
            a("div", Ec, [
              (w(!0), C(Q, null, pe(De(Or)(g), (_) => (w(), C("button", {
                key: _,
                class: "oxsk-button",
                disabled: e.busy || e.state.lifecycle.running,
                onClick: (D) => n("command", "transitionSkillLifecycle", g, _)
              }, v(l.value ? "转为" : "Set") + " " + v(De(mt)(_, l.value)), 9, Ic))), 128))
            ])
          ]))), 128))
        ])) : (w(), C("div", Tc, [
          r[20] || (r[20] = a("i", { class: "fa-solid fa-code-branch" }, null, -1)),
          a("h3", null, v(e.state.lifecycle.loading ? l.value ? "正在读取记录…" : "Loading records…" : l.value ? "暂无此状态的技能记录" : "No skills in this state"), 1),
          a("p", null, v(l.value ? "已有旧格式技能仍可在已安装页管理。" : "Legacy packages remain available in Installed."), 1)
        ]))
      ], 64))
    ]));
  }
}, Ac = ["aria-busy"], Oc = { class: "oxsk-header" }, Mc = { class: "oxsk-title" }, Rc = { class: "oxsk-actions" }, Lc = ["disabled"], jc = ["disabled"], Fc = ["aria-label"], Dc = ["aria-current", "onClick"], Nc = ["disabled", "title"], Zc = { class: "oxsk-sr-only" }, Uc = {
  key: 0,
  class: "oxsk-alert",
  role: "alert"
}, Hc = {
  key: 1,
  class: "oxsk-alert",
  role: "status"
}, Wc = {
  key: 0,
  class: "oxsk-intro"
}, Vc = {
  key: 1,
  class: "oxsk-toolbar"
}, Gc = { class: "oxsk-search" }, Kc = ["value", "placeholder", "aria-label"], Bc = {
  key: 0,
  class: "oxsk-inline-field"
}, qc = ["value"], zc = { value: "all" }, Jc = { value: "global" }, Yc = { value: "project" }, Qc = { class: "oxsk-count" }, Xc = ["aria-label"], eu = ["aria-pressed", "onClick"], tu = {
  key: 3,
  class: "oxsk-location-note"
}, su = ["aria-busy"], nu = {
  key: 0,
  class: "oxsk-toolbar oxsk-toolbar--detail"
}, iu = { class: "oxsk-search" }, lu = ["value", "placeholder", "aria-label"], ou = { class: "oxsk-inline-field" }, ru = ["value", "aria-label"], au = ["value"], cu = {
  key: 0,
  class: "oxsk-inline-field"
}, uu = ["value", "aria-label"], fu = { value: "all" }, du = { value: "global" }, hu = { value: "project" }, pu = {
  key: 1,
  class: "oxsk-empty"
}, gu = {
  key: 2,
  class: "oxsk-grid"
}, vu = ["aria-label", "onClick"], bu = { class: "oxsk-card-top" }, yu = ["data-group"], mu = { class: "oxsk-card-group" }, ku = { class: "oxsk-id" }, xu = { class: "oxsk-location" }, wu = {
  key: 1,
  class: "oxsk-bundles"
}, Su = { class: "oxsk-section-heading" }, Cu = { class: "oxsk-icon" }, _u = { class: "oxsk-bundle-body" }, $u = { class: "oxsk-bundle-members" }, Eu = ["disabled", "onClick"], Iu = { class: "oxsk-bundle-starter" }, Tu = { class: "oxsk-library-footer" }, Pu = {
  href: "https://www.agentparty.top/skills.html",
  target: "_blank",
  rel: "noopener noreferrer"
}, Au = {
  href: "https://github.com/openxnet/openxnet.github.io/blob/main/skills.json",
  target: "_blank",
  rel: "noopener noreferrer"
}, Ou = {
  __name: "App",
  setup(e) {
    const t = Lr(), s = /* @__PURE__ */ Re(t.snapshot()), n = /* @__PURE__ */ Re("all"), i = /* @__PURE__ */ Re("all"), l = /* @__PURE__ */ Re(""), o = /* @__PURE__ */ Re(""), c = /* @__PURE__ */ Re(null);
    let f = null;
    const h = Se(() => s.value.isZh), d = Se(() => s.value.activeTab === "library" ? "discover" : s.value.activeTab), r = Se(() => Tr(s.value.library.items, { query: s.value.query, category: n.value, location: d.value === "installed" ? i.value : "all" })), g = Se(() => (d.value === "bundles" ? s.value.library.items : r.value).some((W) => W.id === s.value.preview.activeId) ? s.value.preview.current : null), _ = Se(() => Pr(s.value.library.items)), D = Se(() => [
      ["discover", h.value ? "发现技能" : "Discover", "fa-solid fa-compass"],
      ["installed", h.value ? "已安装" : "Installed", "fa-solid fa-layer-group"],
      ["bundles", h.value ? "技能套组" : "Bundles", "fa-solid fa-cubes-stacked"],
      ["transform", h.value ? "导入" : "Import", "fa-solid fa-arrow-down-to-bracket"],
      ["crystal", h.value ? "技能结晶" : "Crystal", "fa-regular fa-gem"],
      ["lifecycle", h.value ? "生命周期" : "Lifecycle", "fa-solid fa-code-branch"]
    ]);
    function A() {
      s.value = t.snapshot();
    }
    async function U(W, P) {
      if (!l.value) {
        l.value = W, o.value = "";
        try {
          const S = P();
          A(), await S;
        } catch (S) {
          o.value = S?.message || String(S);
        } finally {
          l.value = "", A();
        }
      }
    }
    async function G(W) {
      t.clearPreview(), n.value = "all", i.value = "all", o.value = "";
      try {
        await t.openTab(W === "discover" ? "library" : W);
      } catch (P) {
        o.value = P.message;
      }
      A();
    }
    function N(W) {
      n.value = W, t.clearPreview(), A();
    }
    function H(W) {
      i.value = W.target.value, t.clearPreview(), A();
    }
    function M(W) {
      t.setQuery(W.target.value), A();
    }
    async function q(W, P) {
      o.value = "";
      try {
        const S = t.previewSkill(W, P);
        A(), P || (await mi(), c.value?.scrollTo({ top: 0, behavior: "auto" }), c.value?.scrollIntoView({ block: "start", behavior: "auto" })), await S;
      } catch (S) {
        o.value = S.message;
      } finally {
        A();
      }
    }
    function ne() {
      t.clearPreview(), A();
    }
    function me(W, P) {
      return U(`${W}:${P}`, () => t.manageSkill(W, P));
    }
    function ke(W, ...P) {
      return U(W, () => t.invoke(W, ...P));
    }
    function Qe(W) {
      return U("enterprise", () => t.openEnterprise(W));
    }
    function Ue(W, P) {
      t.setCrystalField(W, P), A();
    }
    function st(W) {
      t.setGithubUrl(W), A();
    }
    function ut() {
      A(), f = window.setInterval(A, 400);
    }
    function ft() {
      f && window.clearInterval(f);
    }
    function wt(W) {
      W === "skills" && (n.value = "all", i.value = "all");
    }
    return Qt(() => s.value.activeMenu, wt), Ti(ut), Pi(ft), (W, P) => (w(), C("main", {
      ref_key: "workbench",
      ref: c,
      class: te(["oxsk-workbench", { "oxsk-workbench--detail": g.value }]),
      "aria-busy": !!l.value
    }, [
      a("header", Oc, [
        a("div", Mc, [
          P[5] || (P[5] = a("span", { class: "oxsk-mark" }, [
            a("i", {
              class: "fa-solid fa-shapes",
              "aria-hidden": "true"
            })
          ], -1)),
          a("div", null, [
            a("h1", null, v(h.value ? "技能工作台" : "Skill workbench"), 1),
            a("p", null, v(h.value ? "让方法成为员工可复用的能力" : "Turn methods into reusable employee capabilities"), 1)
          ])
        ]),
        a("div", Rc, [
          a("button", {
            class: "oxsk-button",
            disabled: !!l.value,
            onClick: P[0] || (P[0] = (S) => ke("openSkillsFolder"))
          }, [
            P[6] || (P[6] = a("i", { class: "fa-regular fa-folder-open" }, null, -1)),
            le(v(h.value ? "技能目录" : "Folder"), 1)
          ], 8, Lc),
          a("button", {
            class: "oxsk-button oxsk-button--primary",
            disabled: !!l.value,
            onClick: P[1] || (P[1] = (S) => Qe("enterprise-skills"))
          }, [
            P[7] || (P[7] = a("i", { class: "fa-solid fa-building" }, null, -1)),
            le(v(h.value ? "企业启用" : "Enterprise"), 1)
          ], 8, jc)
        ])
      ]),
      a("nav", {
        class: "oxsk-tabs",
        "aria-label": h.value ? "技能视图" : "Skill views"
      }, [
        (w(!0), C(Q, null, pe(D.value, (S) => (w(), C("button", {
          key: S[0],
          class: te({ "is-active": d.value === S[0] }),
          "aria-current": d.value === S[0] ? "page" : void 0,
          onClick: (Z) => G(S[0])
        }, [
          a("i", {
            class: te(S[2])
          }, null, 2),
          le(v(S[1]), 1)
        ], 10, Dc))), 128)),
        a("button", {
          class: "oxsk-refresh",
          disabled: !!l.value || s.value.library.loading,
          title: h.value ? "刷新全局与工作区技能" : "Refresh global and workspace skills",
          onClick: P[2] || (P[2] = (S) => ke("handleRefreshSkills"))
        }, [
          a("i", {
            class: te(["fa-solid fa-rotate-right", { "fa-spin": s.value.library.loading }])
          }, null, 2),
          a("span", Zc, v(h.value ? "刷新" : "Refresh"), 1)
        ], 8, Nc)
      ], 8, Fc),
      o.value || s.value.library.error ? (w(), C("p", Uc, [
        P[8] || (P[8] = a("i", { class: "fa-solid fa-circle-exclamation" }, null, -1)),
        le(v(o.value || s.value.library.error), 1)
      ])) : se("", !0),
      s.value.available ? se("", !0) : (w(), C("p", Hc, v(h.value ? "正在等待应用连接，技能操作暂不可用。" : "Waiting for the application connection. Skill actions are unavailable."), 1)),
      ["discover", "installed", "bundles"].includes(d.value) ? (w(), C(Q, { key: 2 }, [
        d.value === "discover" && !g.value ? (w(), C("section", Wc, [
          a("div", null, [
            P[9] || (P[9] = a("span", { class: "oxsk-eyebrow" }, "OPENXNET CAPABILITIES", -1)),
            a("h2", null, v(h.value ? "从一个任务，找到合适的方法" : "Find the right method for your next task"), 1),
            a("p", null, v(h.value ? "浏览本机与工作区的真实技能，查看用途，再决定如何配给员工。" : "Explore real local and workspace skills, understand their purpose, then configure your employees."), 1)
          ]),
          P[10] || (P[10] = a("div", {
            class: "oxsk-intro-art",
            "aria-hidden": "true"
          }, [
            a("i", { class: "fa-solid fa-diagram-project" }),
            a("span"),
            a("span")
          ], -1))
        ])) : se("", !0),
        d.value !== "bundles" && !g.value ? (w(), C("div", Vc, [
          a("label", Gc, [
            P[11] || (P[11] = a("i", { class: "fa-solid fa-magnifying-glass" }, null, -1)),
            a("input", {
              value: s.value.query,
              placeholder: h.value ? "搜索名称、用途或技能 ID" : "Search name, purpose or skill ID",
              "aria-label": h.value ? "搜索技能" : "Search skills",
              onInput: M
            }, null, 40, Kc)
          ]),
          d.value === "installed" ? (w(), C("label", Bc, [
            a("span", null, v(h.value ? "安装范围" : "Location"), 1),
            a("select", {
              value: i.value,
              onChange: H
            }, [
              a("option", zc, v(h.value ? "所有位置" : "All locations"), 1),
              a("option", Jc, v(h.value ? "本机全局" : "Global"), 1),
              a("option", Yc, v(h.value ? "当前工作区" : "Workspace"), 1)
            ], 40, qc)
          ])) : se("", !0),
          a("span", Qc, v(r.value.length) + " " + v(h.value ? "个技能" : "skills"), 1)
        ])) : se("", !0),
        d.value !== "bundles" && !g.value ? (w(), C("div", {
          key: 2,
          class: "oxsk-categories",
          "aria-label": h.value ? "能力类别" : "Capability categories"
        }, [
          (w(!0), C(Q, null, pe(De(os), (S) => (w(), C("button", {
            key: S.id,
            class: te({ "is-active": n.value === S.id }),
            "aria-pressed": n.value === S.id,
            onClick: (Z) => N(S.id)
          }, [
            a("i", {
              class: te(S.icon)
            }, null, 2),
            le(v(h.value ? S.zh : S.en), 1)
          ], 10, eu))), 128))
        ], 8, Xc)) : se("", !0),
        d.value === "installed" ? (w(), C("div", tu, [
          P[12] || (P[12] = a("i", { class: "fa-solid fa-folder-tree" }, null, -1)),
          a("span", null, v(s.value.workspacePath || (h.value ? "未选择工作区；可以管理本机全局技能。" : "No workspace selected. Global skills remain available.")), 1)
        ])) : se("", !0),
        a("div", {
          class: te(["oxsk-content", { "has-detail": g.value }])
        }, [
          d.value !== "bundles" ? (w(), C("section", {
            key: 0,
            class: "oxsk-catalog",
            "aria-busy": s.value.library.loading
          }, [
            g.value ? (w(), C("div", nu, [
              a("label", iu, [
                P[13] || (P[13] = a("i", { class: "fa-solid fa-magnifying-glass" }, null, -1)),
                a("input", {
                  value: s.value.query,
                  placeholder: h.value ? "搜索技能" : "Search skills",
                  "aria-label": h.value ? "搜索技能" : "Search skills",
                  onInput: M
                }, null, 40, lu)
              ]),
              a("label", ou, [
                a("select", {
                  value: n.value,
                  "aria-label": h.value ? "能力类别" : "Capability category",
                  onChange: P[3] || (P[3] = (S) => N(S.target.value))
                }, [
                  (w(!0), C(Q, null, pe(De(os), (S) => (w(), C("option", {
                    key: S.id,
                    value: S.id
                  }, v(h.value ? S.zh : S.en), 9, au))), 128))
                ], 40, ru)
              ]),
              d.value === "installed" ? (w(), C("label", cu, [
                a("select", {
                  value: i.value,
                  "aria-label": h.value ? "安装范围" : "Installation location",
                  onChange: H
                }, [
                  a("option", fu, v(h.value ? "所有位置" : "All locations"), 1),
                  a("option", du, v(h.value ? "本机全局" : "Global"), 1),
                  a("option", hu, v(h.value ? "当前工作区" : "Workspace"), 1)
                ], 40, uu)
              ])) : se("", !0)
            ])) : se("", !0),
            r.value.length ? (w(), C("div", gu, [
              (w(!0), C(Q, null, pe(r.value, (S) => (w(), C("article", {
                key: S.id,
                class: te(["oxsk-card", { "is-selected": g.value?.id === S.id }])
              }, [
                a("button", {
                  class: "oxsk-card-main",
                  "aria-label": (h.value ? "查看技能：" : "View skill: ") + S.name,
                  onClick: (Z) => q(S.id)
                }, [
                  a("div", bu, [
                    a("span", {
                      class: "oxsk-icon",
                      "data-group": S.group
                    }, [
                      a("i", {
                        class: te(S.icon)
                      }, null, 2)
                    ], 8, yu),
                    a("span", mu, v(S.groupLabel), 1),
                    P[15] || (P[15] = a("i", {
                      class: "fa-solid fa-arrow-up-right-from-square oxsk-card-arrow",
                      "aria-hidden": "true"
                    }, null, -1))
                  ]),
                  a("h3", null, v(S.name), 1),
                  a("span", ku, v(S.alias), 1),
                  a("p", null, v(S.description || (h.value ? "该技能暂未提供用途说明。" : "No purpose description provided.")), 1)
                ], 8, vu),
                a("footer", null, [
                  a("span", xu, [
                    P[16] || (P[16] = a("i", { class: "fa-solid fa-circle-check" }, null, -1)),
                    le(v(S.isGlobal && S.isProject ? h.value ? "本机 + 工作区" : "Global + workspace" : S.isGlobal ? h.value ? "本机全局" : "Global" : h.value ? "当前工作区" : "Workspace"), 1)
                  ]),
                  a("span", null, v(S.version ? `v${S.version}` : De(mt)(S.lifecycleStatus, h.value)), 1)
                ])
              ], 2))), 128))
            ])) : (w(), C("div", pu, [
              P[14] || (P[14] = a("i", { class: "fa-solid fa-box-open" }, null, -1)),
              a("h3", null, v(s.value.library.loading ? h.value ? "正在读取技能" : "Loading skills" : h.value ? "这里还没有匹配的技能" : "No matching skills"), 1),
              a("p", null, v(h.value ? "调整筛选，或从已有仓库和 ZIP 技能包导入。" : "Adjust the filters or import a repository or ZIP package."), 1),
              a("button", {
                class: "oxsk-button",
                onClick: P[4] || (P[4] = (S) => G("transform"))
              }, v(h.value ? "导入技能" : "Import skills"), 1)
            ]))
          ], 8, su)) : (w(), C("section", wu, [
            a("div", Su, [
              a("h2", null, v(h.value ? "把能力配成一条工作流" : "Connect capabilities into a workflow"), 1),
              a("p", null, v(h.value ? "套组是配套建议，逐项查看真实技能。选择套组不会安装或执行任务。" : "Bundles suggest related packages. Review each real skill; choosing a bundle does not install or execute it."), 1)
            ]),
            (w(!0), C(Q, null, pe(_.value, (S) => (w(), C("article", {
              key: S.id,
              class: "oxsk-bundle"
            }, [
              a("span", Cu, [
                a("i", {
                  class: te(S.icon)
                }, null, 2)
              ]),
              a("div", _u, [
                a("h3", null, v(h.value ? S.zh : S.en), 1),
                a("p", null, v(h.value ? S.descriptionZh : S.descriptionEn), 1),
                a("div", $u, [
                  (w(!0), C(Q, null, pe(S.members, (Z) => (w(), C("button", {
                    key: Z.id,
                    disabled: !Z.skill,
                    onClick: (Xe) => q(Z.id)
                  }, [
                    a("i", {
                      class: te(Z.skill ? "fa-solid fa-circle-check" : "fa-regular fa-circle")
                    }, null, 2),
                    a("span", null, v(Z.skill?.name || Z.id), 1),
                    a("small", null, v(Z.skill ? h.value ? "查看" : "View" : h.value ? "未在本机找到" : "Not found locally"), 1)
                  ], 8, Eu))), 128))
                ]),
                a("p", Iu, [
                  P[17] || (P[17] = a("i", { class: "fa-regular fa-comment-dots" }, null, -1)),
                  le(v(h.value ? S.starterZh : S.starterEn), 1)
                ])
              ])
            ]))), 128))
          ])),
          g.value ? (w(), Ns(Oa, {
            key: g.value.id,
            skill: g.value,
            preview: s.value.preview,
            "is-zh": h.value,
            "workspace-path": s.value.workspacePath,
            employees: s.value.employees,
            busy: !!l.value,
            onClose: ne,
            onManage: me,
            onPreview: q,
            onEnterprise: Qe
          }, null, 8, ["skill", "preview", "is-zh", "workspace-path", "employees", "busy"])) : se("", !0)
        ], 2),
        a("footer", Tu, [
          a("span", null, v(h.value ? "发现内容来自当前技能目录。更多技能可通过外部市场查看。" : "Discovery uses your current catalog. Browse the external market for more skills."), 1),
          a("a", Pu, [
            le(v(h.value ? "技能市场" : "Skill market") + " ", 1),
            P[18] || (P[18] = a("i", { class: "fa-solid fa-arrow-up-right-from-square" }, null, -1))
          ]),
          a("a", Au, v(h.value ? "提交技能" : "Submit a skill"), 1)
        ])
      ], 64)) : (w(), Ns(Pc, {
        key: 3,
        view: d.value,
        state: s.value,
        busy: !!l.value,
        onCommand: ke,
        onField: Ue,
        onGithub: st,
        onEnterprise: Qe
      }, null, 8, ["view", "state", "busy"]))
    ], 10, Ac));
  }
};
function Hs() {
  const e = document.getElementById("openxnet-vite-skills-root");
  !e || e.dataset.viteMounted === "true" || (_r(Ou).mount(e), e.dataset.viteMounted = "true");
}
document.readyState === "loading" ? document.addEventListener("DOMContentLoaded", Hs, { once: !0 }) : Hs();
window.addEventListener("openxnet-vite-skills-remount", Hs);
