// @__NO_SIDE_EFFECTS__
function Si(e) {
  const t = /* @__PURE__ */ Object.create(null);
  for (const n of e.split(",")) t[n] = 1;
  return (n) => n in t;
}
const oe = {}, Vt = [], Xe = () => {
}, Fr = () => !1, Dn = (e) => e.charCodeAt(0) === 111 && e.charCodeAt(1) === 110 && // uppercase letter
(e.charCodeAt(2) > 122 || e.charCodeAt(2) < 97), Ln = (e) => e.startsWith("onUpdate:"), ve = Object.assign, xi = (e, t) => {
  const n = e.indexOf(t);
  n > -1 && e.splice(n, 1);
}, es = Object.prototype.hasOwnProperty, ee = (e, t) => es.call(e, t), V = Array.isArray, Rt = (e) => gn(e) === "[object Map]", Vr = (e) => gn(e) === "[object Set]", Gi = (e) => gn(e) === "[object Date]", B = (e) => typeof e == "function", ce = (e) => typeof e == "string", Qe = (e) => typeof e == "symbol", te = (e) => e !== null && typeof e == "object", Rr = (e) => (te(e) || B(e)) && B(e.then) && B(e.catch), Nr = Object.prototype.toString, gn = (e) => Nr.call(e), ts = (e) => gn(e).slice(8, -1), $r = (e) => gn(e) === "[object Object]", Pi = (e) => ce(e) && e !== "NaN" && e[0] !== "-" && "" + parseInt(e, 10) === e, Xt = /* @__PURE__ */ Si(
  // the leading comma is intentional so empty string "" is also included
  ",key,ref,ref_for,ref_key,onVnodeBeforeMount,onVnodeMounted,onVnodeBeforeUpdate,onVnodeUpdated,onVnodeBeforeUnmount,onVnodeUnmounted"
), Fn = (e) => {
  const t = /* @__PURE__ */ Object.create(null);
  return ((n) => t[n] || (t[n] = e(n)));
}, ns = /-\w/g, Ne = Fn(
  (e) => e.replace(ns, (t) => t.slice(1).toUpperCase())
), is = /\B([A-Z])/g, Ot = Fn(
  (e) => e.replace(is, "-$1").toLowerCase()
), Br = Fn((e) => e.charAt(0).toUpperCase() + e.slice(1)), qn = Fn(
  (e) => e ? `on${Br(e)}` : ""
), ze = (e, t) => !Object.is(e, t), xn = (e, ...t) => {
  for (let n = 0; n < e.length; n++)
    e[n](...t);
}, Kr = (e, t, n, i = !1) => {
  Object.defineProperty(e, t, {
    configurable: !0,
    enumerable: !1,
    writable: i,
    value: n
  });
}, Ci = (e) => {
  const t = parseFloat(e);
  return isNaN(t) ? e : t;
}, rs = (e) => {
  const t = ce(e) ? Number(e) : NaN;
  return isNaN(t) ? e : t;
};
let Ji;
const Vn = () => Ji || (Ji = typeof globalThis < "u" ? globalThis : typeof self < "u" ? self : typeof window < "u" ? window : typeof globalThis < "u" ? globalThis : {});
function Ti(e) {
  if (V(e)) {
    const t = {};
    for (let n = 0; n < e.length; n++) {
      const i = e[n], r = ce(i) ? as(i) : Ti(i);
      if (r)
        for (const o in r)
          t[o] = r[o];
    }
    return t;
  } else if (ce(e) || te(e))
    return e;
}
const os = /;(?![^(]*\))/g, ss = /:([^]+)/, ls = /\/\*[^]*?\*\//g;
function as(e) {
  const t = {};
  return e.replace(ls, "").split(os).forEach((n) => {
    if (n) {
      const i = n.split(ss);
      i.length > 1 && (t[i[0].trim()] = i[1].trim());
    }
  }), t;
}
function Ie(e) {
  let t = "";
  if (ce(e))
    t = e;
  else if (V(e))
    for (let n = 0; n < e.length; n++) {
      const i = Ie(e[n]);
      i && (t += i + " ");
    }
  else if (te(e))
    for (const n in e)
      e[n] && (t += n + " ");
  return t.trim();
}
const cs = "itemscope,allowfullscreen,formnovalidate,ismap,nomodule,novalidate,readonly", us = /* @__PURE__ */ Si(cs);
function Hr(e) {
  return !!e || e === "";
}
function fs(e, t) {
  if (e.length !== t.length) return !1;
  let n = !0;
  for (let i = 0; n && i < e.length; i++)
    n = Ai(e[i], t[i]);
  return n;
}
function Ai(e, t) {
  if (e === t) return !0;
  let n = Gi(e), i = Gi(t);
  if (n || i)
    return n && i ? e.getTime() === t.getTime() : !1;
  if (n = Qe(e), i = Qe(t), n || i)
    return e === t;
  if (n = V(e), i = V(t), n || i)
    return n && i ? fs(e, t) : !1;
  if (n = te(e), i = te(t), n || i) {
    if (!n || !i)
      return !1;
    const r = Object.keys(e).length, o = Object.keys(t).length;
    if (r !== o)
      return !1;
    for (const s in e) {
      const a = e.hasOwnProperty(s), u = t.hasOwnProperty(s);
      if (a && !u || !a && u || !Ai(e[s], t[s]))
        return !1;
    }
  }
  return String(e) === String(t);
}
const jr = (e) => !!(e && e.__v_isRef === !0), R = (e) => ce(e) ? e : e == null ? "" : V(e) || te(e) && (e.toString === Nr || !B(e.toString)) ? jr(e) ? R(e.value) : JSON.stringify(e, Ur, 2) : String(e), Ur = (e, t) => jr(t) ? Ur(e, t.value) : Rt(t) ? {
  [`Map(${t.size})`]: [...t.entries()].reduce(
    (n, [i, r], o) => (n[Gn(i, o) + " =>"] = r, n),
    {}
  )
} : Vr(t) ? {
  [`Set(${t.size})`]: [...t.values()].map((n) => Gn(n))
} : Qe(t) ? Gn(t) : te(t) && !V(t) && !$r(t) ? String(t) : t, Gn = (e, t = "") => {
  var n;
  return (
    // Symbol.description in es2019+ so we need to cast here to pass
    // the lib: es2016 check
    Qe(e) ? `Symbol(${(n = e.description) != null ? n : t})` : e
  );
};
let ye;
class ds {
  // TODO isolatedDeclarations "__v_skip"
  constructor(t = !1) {
    this.detached = t, this._active = !0, this._on = 0, this.effects = [], this.cleanups = [], this._isPaused = !1, this._warnOnRun = !0, this.__v_skip = !0, !t && ye && (ye.active ? (this.parent = ye, this.index = (ye.scopes || (ye.scopes = [])).push(
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
      const n = ye;
      try {
        return ye = this, t();
      } finally {
        ye = n;
      }
    }
  }
  /**
   * This should only be called on non-detached scopes
   * @internal
   */
  on() {
    ++this._on === 1 && (this.prevScope = ye, ye = this);
  }
  /**
   * This should only be called on non-detached scopes
   * @internal
   */
  off() {
    if (this._on > 0 && --this._on === 0) {
      if (ye === this)
        ye = this.prevScope;
      else {
        let t = ye;
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
function ps() {
  return ye;
}
let ae;
const Jn = /* @__PURE__ */ new WeakSet();
class Wr {
  constructor(t) {
    this.fn = t, this.deps = void 0, this.depsTail = void 0, this.flags = 5, this.next = void 0, this.cleanup = void 0, this.scheduler = void 0, ye && (ye.active ? ye.effects.push(this) : this.flags &= -2);
  }
  pause() {
    this.flags |= 64;
  }
  resume() {
    this.flags & 64 && (this.flags &= -65, Jn.has(this) && (Jn.delete(this), this.trigger()));
  }
  /**
   * @internal
   */
  notify() {
    this.flags & 2 && !(this.flags & 32) || this.flags & 8 || Gr(this);
  }
  run() {
    if (!(this.flags & 1))
      return this.fn();
    this.flags |= 2, Yi(this), Jr(this);
    const t = ae, n = $e;
    ae = this, $e = !0;
    try {
      return this.fn();
    } finally {
      Yr(this), ae = t, $e = n, this.flags &= -3;
    }
  }
  stop() {
    if (this.flags & 1) {
      for (let t = this.deps; t; t = t.nextDep)
        Mi(t);
      this.deps = this.depsTail = void 0, Yi(this), this.onStop && this.onStop(), this.flags &= -2;
    }
  }
  trigger() {
    this.flags & 64 ? Jn.add(this) : this.scheduler ? this.scheduler() : this.runIfDirty();
  }
  /**
   * @internal
   */
  runIfDirty() {
    si(this) && this.run();
  }
  get dirty() {
    return si(this);
  }
}
let qr = 0, Qt, Zt;
function Gr(e, t = !1) {
  if (e.flags |= 8, t) {
    e.next = Zt, Zt = e;
    return;
  }
  e.next = Qt, Qt = e;
}
function wi() {
  qr++;
}
function Ii() {
  if (--qr > 0)
    return;
  if (Zt) {
    let t = Zt;
    for (Zt = void 0; t; ) {
      const n = t.next;
      t.next = void 0, t.flags &= -9, t = n;
    }
  }
  let e;
  for (; Qt; ) {
    let t = Qt;
    for (Qt = void 0; t; ) {
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
function Jr(e) {
  for (let t = e.deps; t; t = t.nextDep)
    t.version = -1, t.prevActiveLink = t.dep.activeLink, t.dep.activeLink = t;
}
function Yr(e) {
  let t, n = e.depsTail, i = n;
  for (; i; ) {
    const r = i.prevDep;
    i.version === -1 ? (i === n && (n = r), Mi(i), gs(i)) : t = i, i.dep.activeLink = i.prevActiveLink, i.prevActiveLink = void 0, i = r;
  }
  e.deps = t, e.depsTail = n;
}
function si(e) {
  for (let t = e.deps; t; t = t.nextDep)
    if (t.dep.version !== t.version || t.dep.computed && (zr(t.dep.computed) || t.dep.version !== t.version))
      return !0;
  return !!e._dirty;
}
function zr(e) {
  if (e.flags & 4 && !(e.flags & 16) || (e.flags &= -17, e.globalVersion === sn) || (e.globalVersion = sn, !e.isSSR && e.flags & 128 && (!e.deps && !e._dirty || !si(e))))
    return;
  e.flags |= 2;
  const t = e.dep, n = ae, i = $e;
  ae = e, $e = !0;
  try {
    Jr(e);
    const r = e.fn(e._value);
    (t.version === 0 || ze(r, e._value)) && (e.flags |= 128, e._value = r, t.version++);
  } catch (r) {
    throw t.version++, r;
  } finally {
    ae = n, $e = i, Yr(e), e.flags &= -3;
  }
}
function Mi(e, t = !1) {
  const { dep: n, prevSub: i, nextSub: r } = e;
  if (i && (i.nextSub = r, e.prevSub = void 0), r && (r.prevSub = i, e.nextSub = void 0), n.subs === e && (n.subs = i, !i && n.computed)) {
    n.computed.flags &= -5;
    for (let o = n.computed.deps; o; o = o.nextDep)
      Mi(o, !0);
  }
  !t && !--n.sc && n.map && n.map.delete(n.key);
}
function gs(e) {
  const { prevDep: t, nextDep: n } = e;
  t && (t.nextDep = n, e.prevDep = void 0), n && (n.prevDep = t, e.nextDep = void 0);
}
let $e = !0;
const Xr = [];
function lt() {
  Xr.push($e), $e = !1;
}
function at() {
  const e = Xr.pop();
  $e = e === void 0 ? !0 : e;
}
function Yi(e) {
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
let sn = 0;
class hs {
  constructor(t, n) {
    this.sub = t, this.dep = n, this.version = n.version, this.nextDep = this.prevDep = this.nextSub = this.prevSub = this.prevActiveLink = void 0;
  }
}
class Ei {
  // TODO isolatedDeclarations "__v_skip"
  constructor(t) {
    this.computed = t, this.version = 0, this.activeLink = void 0, this.subs = void 0, this.map = void 0, this.key = void 0, this.sc = 0, this.__v_skip = !0;
  }
  track(t) {
    if (!ae || !$e || ae === this.computed)
      return;
    let n = this.activeLink;
    if (n === void 0 || n.sub !== ae)
      n = this.activeLink = new hs(ae, this), ae.deps ? (n.prevDep = ae.depsTail, ae.depsTail.nextDep = n, ae.depsTail = n) : ae.deps = ae.depsTail = n, Qr(n);
    else if (n.version === -1 && (n.version = this.version, n.nextDep)) {
      const i = n.nextDep;
      i.prevDep = n.prevDep, n.prevDep && (n.prevDep.nextDep = i), n.prevDep = ae.depsTail, n.nextDep = void 0, ae.depsTail.nextDep = n, ae.depsTail = n, ae.deps === n && (ae.deps = i);
    }
    return n;
  }
  trigger(t) {
    this.version++, sn++, this.notify(t);
  }
  notify(t) {
    wi();
    try {
      for (let n = this.subs; n; n = n.prevSub)
        n.sub.notify() && n.sub.dep.notify();
    } finally {
      Ii();
    }
  }
}
function Qr(e) {
  if (e.dep.sc++, e.sub.flags & 4) {
    const t = e.dep.computed;
    if (t && !e.dep.subs) {
      t.flags |= 20;
      for (let i = t.deps; i; i = i.nextDep)
        Qr(i);
    }
    const n = e.dep.subs;
    n !== e && (e.prevSub = n, n && (n.nextSub = e)), e.dep.subs = e;
  }
}
const li = /* @__PURE__ */ new WeakMap(), It = /* @__PURE__ */ Symbol(
  ""
), ai = /* @__PURE__ */ Symbol(
  ""
), ln = /* @__PURE__ */ Symbol(
  ""
);
function be(e, t, n) {
  if ($e && ae) {
    let i = li.get(e);
    i || li.set(e, i = /* @__PURE__ */ new Map());
    let r = i.get(n);
    r || (i.set(n, r = new Ei()), r.map = i, r.key = n), r.track();
  }
}
function ot(e, t, n, i, r, o) {
  const s = li.get(e);
  if (!s) {
    sn++;
    return;
  }
  const a = (u) => {
    u && u.trigger();
  };
  if (wi(), t === "clear")
    s.forEach(a);
  else {
    const u = V(e), d = u && Pi(n);
    if (u && n === "length") {
      const f = Number(i);
      s.forEach((h, b) => {
        (b === "length" || b === ln || !Qe(b) && b >= f) && a(h);
      });
    } else
      switch ((n !== void 0 || s.has(void 0)) && a(s.get(n)), d && a(s.get(ln)), t) {
        case "add":
          u ? d && a(s.get("length")) : (a(s.get(It)), Rt(e) && a(s.get(ai)));
          break;
        case "delete":
          u || (a(s.get(It)), Rt(e) && a(s.get(ai)));
          break;
        case "set":
          Rt(e) && a(s.get(It));
          break;
      }
  }
  Ii();
}
function Dt(e) {
  const t = /* @__PURE__ */ Z(e);
  return t === e ? t : (be(t, "iterate", ln), /* @__PURE__ */ Ve(e) ? t : t.map(Be));
}
function Rn(e) {
  return be(e = /* @__PURE__ */ Z(e), "iterate", ln), e;
}
function Je(e, t) {
  return /* @__PURE__ */ ct(e) ? Bt(/* @__PURE__ */ Mt(e) ? Be(t) : t) : Be(t);
}
const vs = {
  __proto__: null,
  [Symbol.iterator]() {
    return Yn(this, Symbol.iterator, (e) => Je(this, e));
  },
  concat(...e) {
    return Dt(this).concat(
      ...e.map((t) => V(t) ? Dt(t) : t)
    );
  },
  entries() {
    return Yn(this, "entries", (e) => (e[1] = Je(this, e[1]), e));
  },
  every(e, t) {
    return et(this, "every", e, t, void 0, arguments);
  },
  filter(e, t) {
    return et(
      this,
      "filter",
      e,
      t,
      (n) => n.map((i) => Je(this, i)),
      arguments
    );
  },
  find(e, t) {
    return et(
      this,
      "find",
      e,
      t,
      (n) => Je(this, n),
      arguments
    );
  },
  findIndex(e, t) {
    return et(this, "findIndex", e, t, void 0, arguments);
  },
  findLast(e, t) {
    return et(
      this,
      "findLast",
      e,
      t,
      (n) => Je(this, n),
      arguments
    );
  },
  findLastIndex(e, t) {
    return et(this, "findLastIndex", e, t, void 0, arguments);
  },
  // flat, flatMap could benefit from ARRAY_ITERATE but are not straight-forward to implement
  forEach(e, t) {
    return et(this, "forEach", e, t, void 0, arguments);
  },
  includes(...e) {
    return zn(this, "includes", e);
  },
  indexOf(...e) {
    return zn(this, "indexOf", e);
  },
  join(e) {
    return Dt(this).join(e);
  },
  // keys() iterator only reads `length`, no optimization required
  lastIndexOf(...e) {
    return zn(this, "lastIndexOf", e);
  },
  map(e, t) {
    return et(this, "map", e, t, void 0, arguments);
  },
  pop() {
    return Wt(this, "pop");
  },
  push(...e) {
    return Wt(this, "push", e);
  },
  reduce(e, ...t) {
    return zi(this, "reduce", e, t);
  },
  reduceRight(e, ...t) {
    return zi(this, "reduceRight", e, t);
  },
  shift() {
    return Wt(this, "shift");
  },
  // slice could use ARRAY_ITERATE but also seems to beg for range tracking
  some(e, t) {
    return et(this, "some", e, t, void 0, arguments);
  },
  splice(...e) {
    return Wt(this, "splice", e);
  },
  toReversed() {
    return Dt(this).toReversed();
  },
  toSorted(e) {
    return Dt(this).toSorted(e);
  },
  toSpliced(...e) {
    return Dt(this).toSpliced(...e);
  },
  unshift(...e) {
    return Wt(this, "unshift", e);
  },
  values() {
    return Yn(this, "values", (e) => Je(this, e));
  }
};
function Yn(e, t, n) {
  const i = Rn(e), r = i[t]();
  return i !== e && !/* @__PURE__ */ Ve(e) && (r._next = r.next, r.next = () => {
    const o = r._next();
    return o.done || (o.value = n(o.value)), o;
  }), r;
}
const ms = Array.prototype;
function et(e, t, n, i, r, o) {
  const s = Rn(e), a = s !== e && !/* @__PURE__ */ Ve(e), u = s[t];
  if (u !== ms[t]) {
    const h = u.apply(e, o);
    return a ? Be(h) : h;
  }
  let d = n;
  s !== e && (a ? d = function(h, b) {
    return n.call(this, Je(e, h), b, e);
  } : n.length > 2 && (d = function(h, b) {
    return n.call(this, h, b, e);
  }));
  const f = u.call(s, d, i);
  return a && r ? r(f) : f;
}
function zi(e, t, n, i) {
  const r = Rn(e), o = r !== e && !/* @__PURE__ */ Ve(e);
  let s = n, a = !1;
  r !== e && (o ? (a = i.length === 0, s = function(d, f, h) {
    return a && (a = !1, d = Je(e, d)), n.call(this, d, Je(e, f), h, e);
  }) : n.length > 3 && (s = function(d, f, h) {
    return n.call(this, d, f, h, e);
  }));
  const u = r[t](s, ...i);
  return a ? Je(e, u) : u;
}
function zn(e, t, n) {
  const i = /* @__PURE__ */ Z(e);
  be(i, "iterate", ln);
  const r = i[t](...n);
  return (r === -1 || r === !1) && /* @__PURE__ */ Li(n[0]) ? (n[0] = /* @__PURE__ */ Z(n[0]), i[t](...n)) : r;
}
function Wt(e, t, n = []) {
  lt(), wi();
  const i = (/* @__PURE__ */ Z(e))[t].apply(e, n);
  return Ii(), at(), i;
}
const ys = /* @__PURE__ */ Si("__proto__,__v_isRef,__isVue"), Zr = new Set(
  /* @__PURE__ */ Object.getOwnPropertyNames(Symbol).filter((e) => e !== "arguments" && e !== "caller").map((e) => Symbol[e]).filter(Qe)
);
function _s(e) {
  Qe(e) || (e = String(e));
  const t = /* @__PURE__ */ Z(this);
  return be(t, "has", e), t.hasOwnProperty(e);
}
class eo {
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
      return i === (r ? o ? Ms : ro : o ? io : no).get(t) || // receiver is not the reactive proxy, but has the same prototype
      // this means the receiver is a user proxy of the reactive proxy
      Object.getPrototypeOf(t) === Object.getPrototypeOf(i) ? t : void 0;
    const s = V(t);
    if (!r) {
      let u;
      if (s && (u = vs[n]))
        return u;
      if (n === "hasOwnProperty")
        return _s;
    }
    const a = Reflect.get(
      t,
      n,
      // if this is a proxy wrapping a ref, return methods using the raw ref
      // as receiver so that we don't have to call `toRaw` on the ref in all
      // its class methods
      /* @__PURE__ */ Se(t) ? t : i
    );
    if ((Qe(n) ? Zr.has(n) : ys(n)) || (r || be(t, "get", n), o))
      return a;
    if (/* @__PURE__ */ Se(a)) {
      const u = s && Pi(n) ? a : a.value;
      return r && te(u) ? /* @__PURE__ */ ui(u) : u;
    }
    return te(a) ? r ? /* @__PURE__ */ ui(a) : /* @__PURE__ */ ki(a) : a;
  }
}
class to extends eo {
  constructor(t = !1) {
    super(!1, t);
  }
  set(t, n, i, r) {
    let o = t[n];
    const s = V(t) && Pi(n);
    if (!this._isShallow) {
      const d = /* @__PURE__ */ ct(o);
      if (!/* @__PURE__ */ Ve(i) && !/* @__PURE__ */ ct(i) && (o = /* @__PURE__ */ Z(o), i = /* @__PURE__ */ Z(i)), !s && /* @__PURE__ */ Se(o) && !/* @__PURE__ */ Se(i))
        return d || (o.value = i), !0;
    }
    const a = s ? Number(n) < t.length : ee(t, n), u = Reflect.set(
      t,
      n,
      i,
      /* @__PURE__ */ Se(t) ? t : r
    );
    return t === /* @__PURE__ */ Z(r) && (a ? ze(i, o) && ot(t, "set", n, i) : ot(t, "add", n, i)), u;
  }
  deleteProperty(t, n) {
    const i = ee(t, n);
    t[n];
    const r = Reflect.deleteProperty(t, n);
    return r && i && ot(t, "delete", n, void 0), r;
  }
  has(t, n) {
    const i = Reflect.has(t, n);
    return (!Qe(n) || !Zr.has(n)) && be(t, "has", n), i;
  }
  ownKeys(t) {
    return be(
      t,
      "iterate",
      V(t) ? "length" : It
    ), Reflect.ownKeys(t);
  }
}
class bs extends eo {
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
const Ss = /* @__PURE__ */ new to(), xs = /* @__PURE__ */ new bs(), Ps = /* @__PURE__ */ new to(!0);
const ci = (e) => e, yn = (e) => Reflect.getPrototypeOf(e);
function Cs(e, t, n) {
  return function(...i) {
    const r = this.__v_raw, o = /* @__PURE__ */ Z(r), s = Rt(o), a = e === "entries" || e === Symbol.iterator && s, u = e === "keys" && s, d = r[e](...i), f = n ? ci : t ? Bt : Be;
    return !t && be(
      o,
      "iterate",
      u ? ai : It
    ), ve(
      // inheriting all iterator properties
      Object.create(d),
      {
        // iterator protocol
        next() {
          const { value: h, done: b } = d.next();
          return b ? { value: h, done: b } : {
            value: a ? [f(h[0]), f(h[1])] : f(h),
            done: b
          };
        }
      }
    );
  };
}
function _n(e) {
  return function(...t) {
    return e === "delete" ? !1 : e === "clear" ? void 0 : this;
  };
}
function Ts(e, t) {
  const n = {
    get(r) {
      const o = this.__v_raw, s = /* @__PURE__ */ Z(o), a = /* @__PURE__ */ Z(r);
      e || (ze(r, a) && be(s, "get", r), be(s, "get", a));
      const { has: u } = yn(s), d = t ? ci : e ? Bt : Be;
      if (u.call(s, r))
        return d(o.get(r));
      if (u.call(s, a))
        return d(o.get(a));
      o !== s && o.get(r);
    },
    get size() {
      const r = this.__v_raw;
      return !e && be(/* @__PURE__ */ Z(r), "iterate", It), r.size;
    },
    has(r) {
      const o = this.__v_raw, s = /* @__PURE__ */ Z(o), a = /* @__PURE__ */ Z(r);
      return e || (ze(r, a) && be(s, "has", r), be(s, "has", a)), r === a ? o.has(r) : o.has(r) || o.has(a);
    },
    forEach(r, o) {
      const s = this, a = s.__v_raw, u = /* @__PURE__ */ Z(a), d = t ? ci : e ? Bt : Be;
      return !e && be(u, "iterate", It), a.forEach((f, h) => r.call(o, d(f), d(h), s));
    }
  };
  return ve(
    n,
    e ? {
      add: _n("add"),
      set: _n("set"),
      delete: _n("delete"),
      clear: _n("clear")
    } : {
      add(r) {
        const o = /* @__PURE__ */ Z(this), s = yn(o), a = /* @__PURE__ */ Z(r), u = !t && !/* @__PURE__ */ Ve(r) && !/* @__PURE__ */ ct(r) ? a : r;
        return s.has.call(o, u) || ze(r, u) && s.has.call(o, r) || ze(a, u) && s.has.call(o, a) || (o.add(u), ot(o, "add", u, u)), this;
      },
      set(r, o) {
        !t && !/* @__PURE__ */ Ve(o) && !/* @__PURE__ */ ct(o) && (o = /* @__PURE__ */ Z(o));
        const s = /* @__PURE__ */ Z(this), { has: a, get: u } = yn(s);
        let d = a.call(s, r);
        d || (r = /* @__PURE__ */ Z(r), d = a.call(s, r));
        const f = u.call(s, r);
        return s.set(r, o), d ? ze(o, f) && ot(s, "set", r, o) : ot(s, "add", r, o), this;
      },
      delete(r) {
        const o = /* @__PURE__ */ Z(this), { has: s, get: a } = yn(o);
        let u = s.call(o, r);
        u || (r = /* @__PURE__ */ Z(r), u = s.call(o, r)), a && a.call(o, r);
        const d = o.delete(r);
        return u && ot(o, "delete", r, void 0), d;
      },
      clear() {
        const r = /* @__PURE__ */ Z(this), o = r.size !== 0, s = r.clear();
        return o && ot(
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
    n[r] = Cs(r, e, t);
  }), n;
}
function Oi(e, t) {
  const n = Ts(e, t);
  return (i, r, o) => r === "__v_isReactive" ? !e : r === "__v_isReadonly" ? e : r === "__v_raw" ? i : Reflect.get(
    ee(n, r) && r in i ? n : i,
    r,
    o
  );
}
const As = {
  get: /* @__PURE__ */ Oi(!1, !1)
}, ws = {
  get: /* @__PURE__ */ Oi(!1, !0)
}, Is = {
  get: /* @__PURE__ */ Oi(!0, !1)
};
const no = /* @__PURE__ */ new WeakMap(), io = /* @__PURE__ */ new WeakMap(), ro = /* @__PURE__ */ new WeakMap(), Ms = /* @__PURE__ */ new WeakMap();
function Es(e) {
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
function Os(e) {
  return e.__v_skip || !Object.isExtensible(e) ? 0 : Es(ts(e));
}
// @__NO_SIDE_EFFECTS__
function ki(e) {
  return /* @__PURE__ */ ct(e) ? e : Di(
    e,
    !1,
    Ss,
    As,
    no
  );
}
// @__NO_SIDE_EFFECTS__
function ks(e) {
  return Di(
    e,
    !1,
    Ps,
    ws,
    io
  );
}
// @__NO_SIDE_EFFECTS__
function ui(e) {
  return Di(
    e,
    !0,
    xs,
    Is,
    ro
  );
}
function Di(e, t, n, i, r) {
  if (!te(e) || e.__v_raw && !(t && e.__v_isReactive))
    return e;
  const o = Os(e);
  if (o === 0)
    return e;
  const s = r.get(e);
  if (s)
    return s;
  const a = new Proxy(
    e,
    o === 2 ? i : n
  );
  return r.set(e, a), a;
}
// @__NO_SIDE_EFFECTS__
function Mt(e) {
  return /* @__PURE__ */ ct(e) ? /* @__PURE__ */ Mt(e.__v_raw) : !!(e && e.__v_isReactive);
}
// @__NO_SIDE_EFFECTS__
function ct(e) {
  return !!(e && e.__v_isReadonly);
}
// @__NO_SIDE_EFFECTS__
function Ve(e) {
  return !!(e && e.__v_isShallow);
}
// @__NO_SIDE_EFFECTS__
function Li(e) {
  return e ? !!e.__v_raw : !1;
}
// @__NO_SIDE_EFFECTS__
function Z(e) {
  const t = e && e.__v_raw;
  return t ? /* @__PURE__ */ Z(t) : e;
}
function Ds(e) {
  return !ee(e, "__v_skip") && Object.isExtensible(e) && Kr(e, "__v_skip", !0), e;
}
const Be = (e) => te(e) ? /* @__PURE__ */ ki(e) : e, Bt = (e) => te(e) ? /* @__PURE__ */ ui(e) : e;
// @__NO_SIDE_EFFECTS__
function Se(e) {
  return e ? e.__v_isRef === !0 : !1;
}
// @__NO_SIDE_EFFECTS__
function tt(e) {
  return Ls(e, !1);
}
function Ls(e, t) {
  return /* @__PURE__ */ Se(e) ? e : new Fs(e, t);
}
class Fs {
  constructor(t, n) {
    this.dep = new Ei(), this.__v_isRef = !0, this.__v_isShallow = !1, this._rawValue = n ? t : /* @__PURE__ */ Z(t), this._value = n ? t : Be(t), this.__v_isShallow = n;
  }
  get value() {
    return this.dep.track(), this._value;
  }
  set value(t) {
    const n = this._rawValue, i = this.__v_isShallow || /* @__PURE__ */ Ve(t) || /* @__PURE__ */ ct(t);
    t = i ? t : /* @__PURE__ */ Z(t), ze(t, n) && (this._rawValue = t, this._value = i ? t : Be(t), this.dep.trigger());
  }
}
function Vs(e) {
  return /* @__PURE__ */ Se(e) ? e.value : e;
}
const Rs = {
  get: (e, t, n) => t === "__v_raw" ? e : Vs(Reflect.get(e, t, n)),
  set: (e, t, n, i) => {
    const r = e[t];
    return /* @__PURE__ */ Se(r) && !/* @__PURE__ */ Se(n) ? (r.value = n, !0) : Reflect.set(e, t, n, i);
  }
};
function oo(e) {
  return /* @__PURE__ */ Mt(e) ? e : new Proxy(e, Rs);
}
class Ns {
  constructor(t, n, i) {
    this.fn = t, this.setter = n, this._value = void 0, this.dep = new Ei(this), this.__v_isRef = !0, this.deps = void 0, this.depsTail = void 0, this.flags = 16, this.globalVersion = sn - 1, this.next = void 0, this.effect = this, this.__v_isReadonly = !n, this.isSSR = i;
  }
  /**
   * @internal
   */
  notify() {
    if (this.flags |= 16, !(this.flags & 8) && // avoid infinite self recursion
    ae !== this)
      return Gr(this, !0), !0;
  }
  get value() {
    const t = this.dep.track();
    return zr(this), t && (t.version = this.dep.version), this._value;
  }
  set value(t) {
    this.setter && this.setter(t);
  }
}
// @__NO_SIDE_EFFECTS__
function $s(e, t, n = !1) {
  let i, r;
  return B(e) ? i = e : (i = e.get, r = e.set), new Ns(i, r, n);
}
const bn = {}, Tn = /* @__PURE__ */ new WeakMap();
let Tt;
function Bs(e, t = !1, n = Tt) {
  if (n) {
    let i = Tn.get(n);
    i || Tn.set(n, i = []), i.push(e);
  }
}
function Ks(e, t, n = oe) {
  const { immediate: i, deep: r, once: o, scheduler: s, augmentJob: a, call: u } = n, d = (O) => r ? O : /* @__PURE__ */ Ve(O) || r === !1 || r === 0 ? st(O, 1) : st(O);
  let f, h, b, S, E = !1, w = !1;
  if (/* @__PURE__ */ Se(e) ? (h = () => e.value, E = /* @__PURE__ */ Ve(e)) : /* @__PURE__ */ Mt(e) ? (h = () => d(e), E = !0) : V(e) ? (w = !0, E = e.some((O) => /* @__PURE__ */ Mt(O) || /* @__PURE__ */ Ve(O)), h = () => e.map((O) => {
    if (/* @__PURE__ */ Se(O))
      return O.value;
    if (/* @__PURE__ */ Mt(O))
      return d(O);
    if (B(O))
      return u ? u(O, 2) : O();
  })) : B(e) ? t ? h = u ? () => u(e, 2) : e : h = () => {
    if (b) {
      lt();
      try {
        b();
      } finally {
        at();
      }
    }
    const O = Tt;
    Tt = f;
    try {
      return u ? u(e, 3, [S]) : e(S);
    } finally {
      Tt = O;
    }
  } : h = Xe, t && r) {
    const O = h, G = r === !0 ? 1 / 0 : r;
    h = () => st(O(), G);
  }
  const K = ps(), W = () => {
    f.stop(), K && K.active && xi(K.effects, f);
  };
  if (o && t) {
    const O = t;
    t = (...G) => {
      O(...G), W();
    };
  }
  let D = w ? new Array(e.length).fill(bn) : bn;
  const J = (O) => {
    if (!(!(f.flags & 1) || !f.dirty && !O))
      if (t) {
        const G = f.run();
        if (r || E || (w ? G.some((ue, N) => ze(ue, D[N])) : ze(G, D))) {
          b && b();
          const ue = Tt;
          Tt = f;
          try {
            const N = [
              G,
              // pass undefined as the old value when it's changed for the first time
              D === bn ? void 0 : w && D[0] === bn ? [] : D,
              S
            ];
            D = G, u ? u(t, 3, N) : (
              // @ts-expect-error
              t(...N)
            );
          } finally {
            Tt = ue;
          }
        }
      } else
        f.run();
  };
  return a && a(J), f = new Wr(h), f.scheduler = s ? () => s(J, !1) : J, S = (O) => Bs(O, !1, f), b = f.onStop = () => {
    const O = Tn.get(f);
    if (O) {
      if (u)
        u(O, 4);
      else
        for (const G of O) G();
      Tn.delete(f);
    }
  }, t ? i ? J(!0) : D = f.run() : s ? s(J.bind(null, !0), !0) : f.run(), W.pause = f.pause.bind(f), W.resume = f.resume.bind(f), W.stop = W, W;
}
function st(e, t = 1 / 0, n) {
  if (t <= 0 || !te(e) || e.__v_skip || (n = n || /* @__PURE__ */ new Map(), (n.get(e) || 0) >= t))
    return e;
  if (n.set(e, t), t--, /* @__PURE__ */ Se(e))
    st(e.value, t, n);
  else if (V(e))
    for (let i = 0; i < e.length; i++)
      st(e[i], t, n);
  else if (Vr(e) || Rt(e))
    e.forEach((i) => {
      st(i, t, n);
    });
  else if ($r(e)) {
    for (const i in e)
      st(e[i], t, n);
    for (const i of Object.getOwnPropertySymbols(e))
      Object.prototype.propertyIsEnumerable.call(e, i) && st(e[i], t, n);
  }
  return e;
}
function hn(e, t, n, i) {
  try {
    return i ? e(...i) : e();
  } catch (r) {
    Nn(r, t, n);
  }
}
function Ke(e, t, n, i) {
  if (B(e)) {
    const r = hn(e, t, n, i);
    return r && Rr(r) && r.catch((o) => {
      Nn(o, t, n);
    }), r;
  }
  if (V(e)) {
    const r = [];
    for (let o = 0; o < e.length; o++)
      r.push(Ke(e[o], t, n, i));
    return r;
  }
}
function Nn(e, t, n, i = !0) {
  const r = t ? t.vnode : null, { errorHandler: o, throwUnhandledErrorInProduction: s } = t && t.appContext.config || oe;
  if (t) {
    let a = t.parent;
    const u = t.proxy, d = `https://vuejs.org/error-reference/#runtime-${n}`;
    for (; a; ) {
      const f = a.ec;
      if (f) {
        for (let h = 0; h < f.length; h++)
          if (f[h](e, u, d) === !1)
            return;
      }
      a = a.parent;
    }
    if (o) {
      lt(), hn(o, null, 10, [
        e,
        u,
        d
      ]), at();
      return;
    }
  }
  Hs(e, n, r, i, s);
}
function Hs(e, t, n, i = !0, r = !1) {
  if (r)
    throw e;
  console.error(e);
}
const Ce = [];
let qe = -1;
const Nt = [];
let ht = null, Lt = 0;
const so = /* @__PURE__ */ Promise.resolve();
let An = null;
function js(e) {
  const t = An || so;
  return e ? t.then(this ? e.bind(this) : e) : t;
}
function Us(e) {
  let t = qe + 1, n = Ce.length;
  for (; t < n; ) {
    const i = t + n >>> 1, r = Ce[i], o = an(r);
    o < e || o === e && r.flags & 2 ? t = i + 1 : n = i;
  }
  return t;
}
function Fi(e) {
  if (!(e.flags & 1)) {
    const t = an(e), n = Ce[Ce.length - 1];
    !n || // fast path when the job id is larger than the tail
    !(e.flags & 2) && t >= an(n) ? Ce.push(e) : Ce.splice(Us(t), 0, e), e.flags |= 1, lo();
  }
}
function lo() {
  An || (An = so.then(co));
}
function Ws(e) {
  V(e) ? Nt.push(...e) : ht && e.id === -1 ? ht.splice(Lt + 1, 0, e) : e.flags & 1 || (Nt.push(e), e.flags |= 1), lo();
}
function Xi(e, t, n = qe + 1) {
  for (; n < Ce.length; n++) {
    const i = Ce[n];
    if (i && i.flags & 2) {
      if (e && i.id !== e.uid)
        continue;
      Ce.splice(n, 1), n--, i.flags & 4 && (i.flags &= -2), i(), i.flags & 4 || (i.flags &= -2);
    }
  }
}
function ao(e) {
  if (Nt.length) {
    const t = [...new Set(Nt)].sort(
      (n, i) => an(n) - an(i)
    );
    if (Nt.length = 0, ht) {
      ht.push(...t);
      return;
    }
    for (ht = t, Lt = 0; Lt < ht.length; Lt++) {
      const n = ht[Lt];
      n.flags & 4 && (n.flags &= -2), n.flags & 8 || n(), n.flags &= -2;
    }
    ht = null, Lt = 0;
  }
}
const an = (e) => e.id == null ? e.flags & 2 ? -1 : 1 / 0 : e.id;
function co(e) {
  try {
    for (qe = 0; qe < Ce.length; qe++) {
      const t = Ce[qe];
      t && !(t.flags & 8) && (t.flags & 4 && (t.flags &= -2), hn(
        t,
        t.i,
        t.i ? 15 : 14
      ), t.flags & 4 || (t.flags &= -2));
    }
  } finally {
    for (; qe < Ce.length; qe++) {
      const t = Ce[qe];
      t && (t.flags &= -2);
    }
    qe = -1, Ce.length = 0, ao(), An = null, (Ce.length || Nt.length) && co();
  }
}
let Fe = null, uo = null;
function wn(e) {
  const t = Fe;
  return Fe = e, uo = e && e.type.__scopeId || null, t;
}
function fo(e, t = Fe, n) {
  if (!t || e._n)
    return e;
  const i = (...r) => {
    i._d && En(-1);
    const o = wn(t);
    let s;
    try {
      s = e(...r);
    } finally {
      wn(o), i._d && En(1);
    }
    return s;
  };
  return i._n = !0, i._c = !0, i._d = !0, i;
}
function qs(e, t) {
  if (Fe === null)
    return e;
  const n = jn(Fe), i = e.dirs || (e.dirs = []);
  for (let r = 0; r < t.length; r++) {
    let [o, s, a, u = oe] = t[r];
    o && (B(o) && (o = {
      mounted: o,
      updated: o
    }), o.deep && st(s), i.push({
      dir: o,
      instance: n,
      value: s,
      oldValue: void 0,
      arg: a,
      modifiers: u
    }));
  }
  return e;
}
function _t(e, t, n, i) {
  const r = e.dirs, o = t && t.dirs;
  for (let s = 0; s < r.length; s++) {
    const a = r[s];
    o && (a.oldValue = o[s].value);
    let u = a.dir[i];
    u && (lt(), Ke(u, n, 8, [
      e.el,
      a,
      e,
      t
    ]), at());
  }
}
function Gs(e, t) {
  if (Ae) {
    let n = Ae.provides;
    const i = Ae.parent && Ae.parent.provides;
    i === n && (n = Ae.provides = Object.create(i)), n[e] = t;
  }
}
function Pn(e, t, n = !1) {
  const i = Uo();
  if (i || $t) {
    let r = $t ? $t._context.provides : i ? i.parent == null || i.ce ? i.vnode.appContext && i.vnode.appContext.provides : i.parent.provides : void 0;
    if (r && e in r)
      return r[e];
    if (arguments.length > 1)
      return n && B(t) ? t.call(i && i.proxy) : t;
  }
}
const Js = /* @__PURE__ */ Symbol.for("v-scx"), Ys = () => Pn(Js);
function en(e, t, n) {
  return po(e, t, n);
}
function po(e, t, n = oe) {
  const { immediate: i, deep: r, flush: o, once: s } = n, a = ve({}, n), u = t && i || !t && o !== "post";
  let d;
  if (fn) {
    if (o === "sync") {
      const S = Ys();
      d = S.__watcherHandles || (S.__watcherHandles = []);
    } else if (!u) {
      const S = () => {
      };
      return S.stop = Xe, S.resume = Xe, S.pause = Xe, S;
    }
  }
  const f = Ae;
  a.call = (S, E, w) => Ke(S, f, E, w);
  let h = !1;
  o === "post" ? a.scheduler = (S) => {
    Pe(S, f && f.suspense);
  } : o !== "sync" && (h = !0, a.scheduler = (S, E) => {
    E ? S() : Fi(S);
  }), a.augmentJob = (S) => {
    t && (S.flags |= 4), h && (S.flags |= 2, f && (S.id = f.uid, S.i = f));
  };
  const b = Ks(e, t, a);
  return fn && (d ? d.push(b) : u && b()), b;
}
function zs(e, t, n) {
  const i = this.proxy, r = ce(e) ? e.includes(".") ? go(i, e) : () => i[e] : e.bind(i, i);
  let o;
  B(t) ? o = t : (o = t.handler, n = t);
  const s = vn(this), a = po(r, o.bind(i), n);
  return s(), a;
}
function go(e, t) {
  const n = t.split(".");
  return () => {
    let i = e;
    for (let r = 0; r < n.length && i; r++)
      i = i[n[r]];
    return i;
  };
}
const gt = /* @__PURE__ */ new WeakMap(), ho = /* @__PURE__ */ Symbol("_vte"), vo = (e) => e.__isTeleport, At = (e) => e && (e.disabled || e.disabled === ""), Xs = (e) => e && (e.defer || e.defer === ""), Qi = (e) => typeof SVGElement < "u" && e instanceof SVGElement, Zi = (e) => typeof MathMLElement == "function" && e instanceof MathMLElement, fi = (e, t) => {
  const n = e && e.to;
  return ce(n) ? t ? t(n) : null : n;
}, Qs = {
  name: "Teleport",
  __isTeleport: !0,
  process(e, t, n, i, r, o, s, a, u, d) {
    const {
      mc: f,
      pc: h,
      pbc: b,
      o: { insert: S, querySelector: E, createText: w, createComment: K, parentNode: W }
    } = d, D = At(t.props);
    let { dynamicChildren: J } = t;
    const O = (N, U, I) => {
      N.shapeFlag & 16 && f(
        N.children,
        U,
        I,
        r,
        o,
        s,
        a,
        u
      );
    }, G = (N = t) => {
      const U = At(N.props), I = N.target = fi(N.props, E), Y = di(I, N, w, S);
      I && (s !== "svg" && Qi(I) ? s = "svg" : s !== "mathml" && Zi(I) && (s = "mathml"), r && r.isCE && (r.ce._teleportTargets || (r.ce._teleportTargets = /* @__PURE__ */ new Set())).add(I), U || (O(N, I, Y), Jt(N, !1)));
    }, ue = (N) => {
      const U = () => {
        if (gt.get(N) === U) {
          if (gt.delete(N), At(N.props)) {
            const I = W(N.el) || n;
            O(N, I, N.anchor), Jt(N, !0);
          }
          G(N);
        }
      };
      gt.set(N, U), Pe(U, o);
    };
    if (e == null) {
      const N = t.el = w(""), U = t.anchor = w("");
      if (S(N, n, i), S(U, n, i), Xs(t.props) || o && o.pendingBranch) {
        ue(t);
        return;
      }
      D && (O(t, n, U), Jt(t, !0)), G();
    } else {
      t.el = e.el;
      const N = t.anchor = e.anchor, U = gt.get(e);
      if (U) {
        U.flags |= 8, gt.delete(e), ue(t);
        return;
      }
      t.targetStart = e.targetStart;
      const I = t.target = e.target, Y = t.targetAnchor = e.targetAnchor, X = At(e.props), T = X ? n : I, ie = X ? N : Y;
      if (s === "svg" || Qi(I) ? s = "svg" : (s === "mathml" || Zi(I)) && (s = "mathml"), J ? (b(
        e.dynamicChildren,
        J,
        T,
        r,
        o,
        s,
        a
      ), Bi(e, t, !0)) : u || h(
        e,
        t,
        T,
        ie,
        r,
        o,
        s,
        a,
        !1
      ), D)
        X ? t.props && e.props && t.props.to !== e.props.to && (t.props.to = e.props.to) : Sn(
          t,
          n,
          N,
          d,
          1
        );
      else if ((t.props && t.props.to) !== (e.props && e.props.to)) {
        const de = t.target = fi(
          t.props,
          E
        );
        de && Sn(
          t,
          de,
          null,
          d,
          0
        );
      } else X && Sn(
        t,
        I,
        Y,
        d,
        1
      );
      Jt(t, D);
    }
  },
  remove(e, t, n, { um: i, o: { remove: r } }, o) {
    const {
      shapeFlag: s,
      children: a,
      anchor: u,
      targetStart: d,
      targetAnchor: f,
      target: h,
      props: b
    } = e;
    let S = o || !At(b);
    const E = gt.get(e);
    if (E && (E.flags |= 8, gt.delete(e), S = !1), h && (r(d), r(f)), o && r(u), s & 16)
      for (let w = 0; w < a.length; w++) {
        const K = a[w];
        i(
          K,
          t,
          n,
          S,
          !!K.dynamicChildren
        );
      }
  },
  move: Sn,
  hydrate: Zs
};
function Sn(e, t, n, { o: { insert: i }, m: r }, o = 2) {
  o === 0 && i(e.targetAnchor, t, n);
  const { el: s, anchor: a, shapeFlag: u, children: d, props: f } = e, h = o === 2;
  if (h && i(s, t, n), !gt.has(e) && (!h || At(f)) && u & 16)
    for (let b = 0; b < d.length; b++)
      r(
        d[b],
        t,
        n,
        2
      );
  h && i(a, t, n);
}
function Zs(e, t, n, i, r, o, {
  o: { nextSibling: s, parentNode: a, querySelector: u, insert: d, createText: f }
}, h) {
  function b(K, W) {
    let D = W;
    for (; D; ) {
      if (D && D.nodeType === 8) {
        if (D.data === "teleport start anchor")
          t.targetStart = D;
        else if (D.data === "teleport anchor") {
          t.targetAnchor = D, K._lpa = t.targetAnchor && s(t.targetAnchor);
          break;
        }
      }
      D = s(D);
    }
  }
  function S(K, W) {
    W.anchor = h(
      s(K),
      W,
      a(K),
      n,
      i,
      r,
      o
    );
  }
  const E = t.target = fi(
    t.props,
    u
  ), w = At(t.props);
  if (E) {
    const K = E._lpa || E.firstChild;
    t.shapeFlag & 16 && (w ? (S(e, t), b(E, K), t.targetAnchor || di(
      E,
      t,
      f,
      d,
      // if target is the same as the main view, insert anchors before current node
      // to avoid hydrating mismatch
      a(e) === E ? e : null
    )) : (t.anchor = s(e), b(E, K), t.targetAnchor || di(E, t, f, d), h(
      K && s(K),
      t,
      E,
      n,
      i,
      r,
      o
    ))), Jt(t, w);
  } else w && t.shapeFlag & 16 && (S(e, t), t.targetStart = e, t.targetAnchor = s(e));
  return t.anchor && s(t.anchor);
}
const el = Qs;
function Jt(e, t) {
  const n = e.ctx;
  if (n && n.ut) {
    let i, r;
    for (t ? (i = e.el, r = e.anchor) : (i = e.targetStart, r = e.targetAnchor); i && i !== r; )
      i.nodeType === 1 && i.setAttribute("data-v-owner", n.uid), i = i.nextSibling;
    n.ut();
  }
}
function di(e, t, n, i, r = null) {
  const o = t.targetStart = n(""), s = t.targetAnchor = n("");
  return o[ho] = s, e && (i(o, e, r), i(s, e, r)), s;
}
const Ge = /* @__PURE__ */ Symbol("_leaveCb"), qt = /* @__PURE__ */ Symbol("_enterCb");
function tl() {
  const e = {
    isMounted: !1,
    isLeaving: !1,
    isUnmounting: !1,
    leavingVNodes: /* @__PURE__ */ new Map()
  };
  return Vi(() => {
    e.isMounted = !0;
  }), Ri(() => {
    e.isUnmounting = !0;
  }), e;
}
const Le = [Function, Array], mo = {
  mode: String,
  appear: Boolean,
  persisted: Boolean,
  // enter
  onBeforeEnter: Le,
  onEnter: Le,
  onAfterEnter: Le,
  onEnterCancelled: Le,
  // leave
  onBeforeLeave: Le,
  onLeave: Le,
  onAfterLeave: Le,
  onLeaveCancelled: Le,
  // appear
  onBeforeAppear: Le,
  onAppear: Le,
  onAfterAppear: Le,
  onAppearCancelled: Le
}, yo = (e) => {
  const t = e.subTree;
  return t.component ? yo(t.component) : t;
}, nl = {
  name: "BaseTransition",
  props: mo,
  setup(e, { slots: t }) {
    const n = Uo(), i = tl();
    return () => {
      const r = t.default && So(t.default(), !0), o = r && r.length ? _o(r) : (
        // Keep explicit default-slot conditionals on the same transition path
        // as regular v-if branches, which render a comment placeholder.
        n.subTree ? ge() : void 0
      );
      if (!o)
        return;
      const s = /* @__PURE__ */ Z(e), { mode: a } = s;
      if (i.isLeaving)
        return Xn(o);
      const u = er(o);
      if (!u)
        return Xn(o);
      let d = pi(
        u,
        s,
        i,
        n,
        // #11061, ensure enterHooks is fresh after clone
        (h) => d = h
      );
      u.type !== Te && cn(u, d);
      let f = n.subTree && er(n.subTree);
      if (f && f.type !== Te && !wt(f, u) && yo(n).type !== Te) {
        let h = pi(
          f,
          s,
          i,
          n
        );
        if (cn(f, h), a === "out-in" && u.type !== Te)
          return i.isLeaving = !0, h.afterLeave = () => {
            i.isLeaving = !1, n.job.flags & 8 || n.update(), delete h.afterLeave, f = void 0;
          }, Xn(o);
        a === "in-out" && u.type !== Te ? h.delayLeave = (b, S, E) => {
          const w = bo(
            i,
            f
          );
          w[String(f.key)] = f, b[Ge] = () => {
            S(), b[Ge] = void 0, delete d.delayedLeave, f = void 0;
          }, d.delayedLeave = () => {
            E(), delete d.delayedLeave, f = void 0;
          };
        } : f = void 0;
      } else f && (f = void 0);
      return o;
    };
  }
};
function _o(e) {
  let t = e[0];
  if (e.length > 1) {
    for (const n of e)
      if (n.type !== Te) {
        t = n;
        break;
      }
  }
  return t;
}
const il = nl;
function bo(e, t) {
  const { leavingVNodes: n } = e;
  let i = n.get(t.type);
  return i || (i = /* @__PURE__ */ Object.create(null), n.set(t.type, i)), i;
}
function pi(e, t, n, i, r) {
  const {
    appear: o,
    mode: s,
    persisted: a = !1,
    onBeforeEnter: u,
    onEnter: d,
    onAfterEnter: f,
    onEnterCancelled: h,
    onBeforeLeave: b,
    onLeave: S,
    onAfterLeave: E,
    onLeaveCancelled: w,
    onBeforeAppear: K,
    onAppear: W,
    onAfterAppear: D,
    onAppearCancelled: J
  } = t, O = String(e.key), G = bo(n, e), ue = (I, Y) => {
    I && Ke(
      I,
      i,
      9,
      Y
    );
  }, N = (I, Y) => {
    const X = Y[1];
    ue(I, Y), V(I) ? I.every((T) => T.length <= 1) && X() : I.length <= 1 && X();
  }, U = {
    mode: s,
    persisted: a,
    beforeEnter(I) {
      let Y = u;
      if (!n.isMounted)
        if (o)
          Y = K || u;
        else
          return;
      I[Ge] && I[Ge](
        !0
        /* cancelled */
      );
      const X = G[O];
      X && wt(e, X) && X.el[Ge] && X.el[Ge](), ue(Y, [I]);
    },
    enter(I) {
      if (G[O] === e) return;
      let Y = d, X = f, T = h;
      if (!n.isMounted)
        if (o)
          Y = W || d, X = D || f, T = J || h;
        else
          return;
      let ie = !1;
      I[qt] = (he) => {
        ie || (ie = !0, he ? ue(T, [I]) : ue(X, [I]), U.delayedLeave && U.delayedLeave(), I[qt] = void 0);
      };
      const de = I[qt].bind(null, !1);
      Y ? N(Y, [I, de]) : de();
    },
    leave(I, Y) {
      const X = String(e.key);
      if (I[qt] && I[qt](
        !0
        /* cancelled */
      ), n.isUnmounting)
        return Y();
      ue(b, [I]);
      let T = !1;
      I[Ge] = (de) => {
        T || (T = !0, Y(), de ? ue(w, [I]) : ue(E, [I]), I[Ge] = void 0, G[X] === e && delete G[X]);
      };
      const ie = I[Ge].bind(null, !1);
      G[X] = e, S ? N(S, [I, ie]) : ie();
    },
    clone(I) {
      const Y = pi(
        I,
        t,
        n,
        i,
        r
      );
      return r && r(Y), Y;
    }
  };
  return U;
}
function Xn(e) {
  if ($n(e))
    return e = vt(e), e.children = null, e;
}
function er(e) {
  if (!$n(e))
    return vo(e.type) && e.children ? _o(e.children) : e;
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
function cn(e, t) {
  e.shapeFlag & 6 && e.component ? (e.transition = t, cn(e.component.subTree, t)) : e.shapeFlag & 128 ? (e.ssContent.transition = t.clone(e.ssContent), e.ssFallback.transition = t.clone(e.ssFallback)) : e.transition = t;
}
function So(e, t = !1, n) {
  let i = [], r = 0;
  for (let o = 0; o < e.length; o++) {
    let s = e[o];
    const a = n == null ? s.key : String(n) + String(s.key != null ? s.key : o);
    s.type === _e ? (s.patchFlag & 128 && r++, i = i.concat(
      So(s.children, t, a)
    )) : (t || s.type !== Te) && i.push(a != null ? vt(s, { key: a }) : s);
  }
  if (r > 1)
    for (let o = 0; o < i.length; o++)
      i[o].patchFlag = -2;
  return i;
}
function xo(e) {
  e.ids = [e.ids[0] + e.ids[2]++ + "-", 0, 0];
}
function tr(e, t) {
  let n;
  return !!((n = Object.getOwnPropertyDescriptor(e, t)) && !n.configurable);
}
const In = /* @__PURE__ */ new WeakMap();
function tn(e, t, n, i, r = !1) {
  if (V(e)) {
    e.forEach(
      (w, K) => tn(
        w,
        t && (V(t) ? t[K] : t),
        n,
        i,
        r
      )
    );
    return;
  }
  if (nn(i) && !r) {
    i.shapeFlag & 512 && i.type.__asyncResolved && i.component.subTree.component && tn(e, t, n, i.component.subTree);
    return;
  }
  const o = i.shapeFlag & 4 ? jn(i.component) : i.el, s = r ? null : o, { i: a, r: u } = e, d = t && t.r, f = a.refs === oe ? a.refs = {} : a.refs, h = a.setupState, b = /* @__PURE__ */ Z(h), S = h === oe ? Fr : (w) => tr(f, w) ? !1 : ee(b, w), E = (w, K) => !(K && tr(f, K));
  if (d != null && d !== u) {
    if (nr(t), ce(d))
      f[d] = null, S(d) && (h[d] = null);
    else if (/* @__PURE__ */ Se(d)) {
      const w = t;
      E(d, w.k) && (d.value = null), w.k && (f[w.k] = null);
    }
  }
  if (B(u))
    hn(u, a, 12, [s, f]);
  else {
    const w = ce(u), K = /* @__PURE__ */ Se(u);
    if (w || K) {
      const W = () => {
        if (e.f) {
          const D = w ? S(u) ? h[u] : f[u] : E() || !e.k ? u.value : f[e.k];
          if (r)
            V(D) && xi(D, o);
          else if (V(D))
            D.includes(o) || D.push(o);
          else if (w)
            f[u] = [o], S(u) && (h[u] = f[u]);
          else {
            const J = [o];
            E(u, e.k) && (u.value = J), e.k && (f[e.k] = J);
          }
        } else w ? (f[u] = s, S(u) && (h[u] = s)) : K && (E(u, e.k) && (u.value = s), e.k && (f[e.k] = s));
      };
      if (s) {
        const D = () => {
          W(), In.delete(e);
        };
        D.id = -1, In.set(e, D), Pe(D, n);
      } else
        nr(e), W();
    }
  }
}
function nr(e) {
  const t = In.get(e);
  t && (t.flags |= 8, In.delete(e));
}
Vn().requestIdleCallback;
Vn().cancelIdleCallback;
const nn = (e) => !!e.type.__asyncLoader, $n = (e) => e.type.__isKeepAlive;
function rl(e, t) {
  Po(e, "a", t);
}
function ol(e, t) {
  Po(e, "da", t);
}
function Po(e, t, n = Ae) {
  const i = e.__wdc || (e.__wdc = () => {
    let r = n;
    for (; r; ) {
      if (r.isDeactivated)
        return;
      r = r.parent;
    }
    return e();
  });
  if (Bn(t, i, n), n) {
    let r = n.parent;
    for (; r && r.parent; )
      $n(r.parent.vnode) && sl(i, t, n, r), r = r.parent;
  }
}
function sl(e, t, n, i) {
  const r = Bn(
    t,
    e,
    i,
    !0
    /* prepend */
  );
  Co(() => {
    xi(i[t], r);
  }, n);
}
function Bn(e, t, n = Ae, i = !1) {
  if (n) {
    const r = n[e] || (n[e] = []), o = t.__weh || (t.__weh = (...s) => {
      lt();
      const a = vn(n), u = Ke(t, n, e, s);
      return a(), at(), u;
    });
    return i ? r.unshift(o) : r.push(o), o;
  }
}
const ut = (e) => (t, n = Ae) => {
  (!fn || e === "sp") && Bn(e, (...i) => t(...i), n);
}, ll = ut("bm"), Vi = ut("m"), al = ut(
  "bu"
), cl = ut("u"), Ri = ut(
  "bum"
), Co = ut("um"), ul = ut(
  "sp"
), fl = ut("rtg"), dl = ut("rtc");
function pl(e, t = Ae) {
  Bn("ec", e, t);
}
const gl = /* @__PURE__ */ Symbol.for("v-ndc");
function bt(e, t, n, i) {
  let r;
  const o = n, s = V(e);
  if (s || ce(e)) {
    const a = s && /* @__PURE__ */ Mt(e);
    let u = !1, d = !1;
    a && (u = !/* @__PURE__ */ Ve(e), d = /* @__PURE__ */ ct(e), e = Rn(e)), r = new Array(e.length);
    for (let f = 0, h = e.length; f < h; f++)
      r[f] = t(
        u ? d ? Bt(Be(e[f])) : Be(e[f]) : e[f],
        f,
        void 0,
        o
      );
  } else if (typeof e == "number") {
    r = new Array(e);
    for (let a = 0; a < e; a++)
      r[a] = t(a + 1, a, void 0, o);
  } else if (te(e))
    if (e[Symbol.iterator])
      r = Array.from(
        e,
        (a, u) => t(a, u, void 0, o)
      );
    else {
      const a = Object.keys(e);
      r = new Array(a.length);
      for (let u = 0, d = a.length; u < d; u++) {
        const f = a[u];
        r[u] = t(e[f], f, u, o);
      }
    }
  else
    r = [];
  return r;
}
const gi = (e) => e ? Wo(e) ? jn(e) : gi(e.parent) : null, rn = (
  // Move PURE marker to new line to workaround compiler discarding it
  // due to type annotation
  /* @__PURE__ */ ve(/* @__PURE__ */ Object.create(null), {
    $: (e) => e,
    $el: (e) => e.vnode.el,
    $data: (e) => e.data,
    $props: (e) => e.props,
    $attrs: (e) => e.attrs,
    $slots: (e) => e.slots,
    $refs: (e) => e.refs,
    $parent: (e) => gi(e.parent),
    $root: (e) => gi(e.root),
    $host: (e) => e.ce,
    $emit: (e) => e.emit,
    $options: (e) => Ao(e),
    $forceUpdate: (e) => e.f || (e.f = () => {
      Fi(e.update);
    }),
    $nextTick: (e) => e.n || (e.n = js.bind(e.proxy)),
    $watch: (e) => zs.bind(e)
  })
), Qn = (e, t) => e !== oe && !e.__isScriptSetup && ee(e, t), hl = {
  get({ _: e }, t) {
    if (t === "__v_skip")
      return !0;
    const { ctx: n, setupState: i, data: r, props: o, accessCache: s, type: a, appContext: u } = e;
    if (t[0] !== "$") {
      const b = s[t];
      if (b !== void 0)
        switch (b) {
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
        if (Qn(i, t))
          return s[t] = 1, i[t];
        if (r !== oe && ee(r, t))
          return s[t] = 2, r[t];
        if (ee(o, t))
          return s[t] = 3, o[t];
        if (n !== oe && ee(n, t))
          return s[t] = 4, n[t];
        hi && (s[t] = 0);
      }
    }
    const d = rn[t];
    let f, h;
    if (d)
      return t === "$attrs" && be(e.attrs, "get", ""), d(e);
    if (
      // css module (injected by vue-loader)
      (f = a.__cssModules) && (f = f[t])
    )
      return f;
    if (n !== oe && ee(n, t))
      return s[t] = 4, n[t];
    if (
      // global properties
      h = u.config.globalProperties, ee(h, t)
    )
      return h[t];
  },
  set({ _: e }, t, n) {
    const { data: i, setupState: r, ctx: o } = e;
    return Qn(r, t) ? (r[t] = n, !0) : i !== oe && ee(i, t) ? (i[t] = n, !0) : ee(e.props, t) || t[0] === "$" && t.slice(1) in e ? !1 : (o[t] = n, !0);
  },
  has({
    _: { data: e, setupState: t, accessCache: n, ctx: i, appContext: r, props: o, type: s }
  }, a) {
    let u;
    return !!(n[a] || e !== oe && a[0] !== "$" && ee(e, a) || Qn(t, a) || ee(o, a) || ee(i, a) || ee(rn, a) || ee(r.config.globalProperties, a) || (u = s.__cssModules) && u[a]);
  },
  defineProperty(e, t, n) {
    return n.get != null ? e._.accessCache[t] = 0 : ee(n, "value") && this.set(e, t, n.value, null), Reflect.defineProperty(e, t, n);
  }
};
function ir(e) {
  return V(e) ? e.reduce(
    (t, n) => (t[n] = null, t),
    {}
  ) : e;
}
let hi = !0;
function vl(e) {
  const t = Ao(e), n = e.proxy, i = e.ctx;
  hi = !1, t.beforeCreate && rr(t.beforeCreate, e, "bc");
  const {
    // state
    data: r,
    computed: o,
    methods: s,
    watch: a,
    provide: u,
    inject: d,
    // lifecycle
    created: f,
    beforeMount: h,
    mounted: b,
    beforeUpdate: S,
    updated: E,
    activated: w,
    deactivated: K,
    beforeDestroy: W,
    beforeUnmount: D,
    destroyed: J,
    unmounted: O,
    render: G,
    renderTracked: ue,
    renderTriggered: N,
    errorCaptured: U,
    serverPrefetch: I,
    // public API
    expose: Y,
    inheritAttrs: X,
    // assets
    components: T,
    directives: ie,
    filters: de
  } = t;
  if (d && ml(d, i, null), s)
    for (const ne in s) {
      const z = s[ne];
      B(z) && (i[ne] = z.bind(n));
    }
  if (r) {
    const ne = r.call(n, n);
    te(ne) && (e.data = /* @__PURE__ */ ki(ne));
  }
  if (hi = !0, o)
    for (const ne in o) {
      const z = o[ne], Ze = B(z) ? z.bind(n, n) : B(z.get) ? z.get.bind(n, n) : Xe, ft = !B(z) && B(z.set) ? z.set.bind(n) : Xe, we = Oe({
        get: Ze,
        set: ft
      });
      Object.defineProperty(i, ne, {
        enumerable: !0,
        configurable: !0,
        get: () => we.value,
        set: (De) => we.value = De
      });
    }
  if (a)
    for (const ne in a)
      To(a[ne], i, n, ne);
  if (u) {
    const ne = B(u) ? u.call(n) : u;
    Reflect.ownKeys(ne).forEach((z) => {
      Gs(z, ne[z]);
    });
  }
  f && rr(f, e, "c");
  function fe(ne, z) {
    V(z) ? z.forEach((Ze) => ne(Ze.bind(n))) : z && ne(z.bind(n));
  }
  if (fe(ll, h), fe(Vi, b), fe(al, S), fe(cl, E), fe(rl, w), fe(ol, K), fe(pl, U), fe(dl, ue), fe(fl, N), fe(Ri, D), fe(Co, O), fe(ul, I), V(Y))
    if (Y.length) {
      const ne = e.exposed || (e.exposed = {});
      Y.forEach((z) => {
        Object.defineProperty(ne, z, {
          get: () => n[z],
          set: (Ze) => n[z] = Ze,
          enumerable: !0
        });
      });
    } else e.exposed || (e.exposed = {});
  G && e.render === Xe && (e.render = G), X != null && (e.inheritAttrs = X), T && (e.components = T), ie && (e.directives = ie), I && xo(e);
}
function ml(e, t, n = Xe) {
  V(e) && (e = vi(e));
  for (const i in e) {
    const r = e[i];
    let o;
    te(r) ? "default" in r ? o = Pn(
      r.from || i,
      r.default,
      !0
    ) : o = Pn(r.from || i) : o = Pn(r), /* @__PURE__ */ Se(o) ? Object.defineProperty(t, i, {
      enumerable: !0,
      configurable: !0,
      get: () => o.value,
      set: (s) => o.value = s
    }) : t[i] = o;
  }
}
function rr(e, t, n) {
  Ke(
    V(e) ? e.map((i) => i.bind(t.proxy)) : e.bind(t.proxy),
    t,
    n
  );
}
function To(e, t, n, i) {
  let r = i.includes(".") ? go(n, i) : () => n[i];
  if (ce(e)) {
    const o = t[e];
    B(o) && en(r, o);
  } else if (B(e))
    en(r, e.bind(n));
  else if (te(e))
    if (V(e))
      e.forEach((o) => To(o, t, n, i));
    else {
      const o = B(e.handler) ? e.handler.bind(n) : t[e.handler];
      B(o) && en(r, o, e);
    }
}
function Ao(e) {
  const t = e.type, { mixins: n, extends: i } = t, {
    mixins: r,
    optionsCache: o,
    config: { optionMergeStrategies: s }
  } = e.appContext, a = o.get(t);
  let u;
  return a ? u = a : !r.length && !n && !i ? u = t : (u = {}, r.length && r.forEach(
    (d) => Mn(u, d, s, !0)
  ), Mn(u, t, s)), te(t) && o.set(t, u), u;
}
function Mn(e, t, n, i = !1) {
  const { mixins: r, extends: o } = t;
  o && Mn(e, o, n, !0), r && r.forEach(
    (s) => Mn(e, s, n, !0)
  );
  for (const s in t)
    if (!(i && s === "expose")) {
      const a = yl[s] || n && n[s];
      e[s] = a ? a(e[s], t[s]) : t[s];
    }
  return e;
}
const yl = {
  data: or,
  props: sr,
  emits: sr,
  // objects
  methods: Yt,
  computed: Yt,
  // lifecycle
  beforeCreate: xe,
  created: xe,
  beforeMount: xe,
  mounted: xe,
  beforeUpdate: xe,
  updated: xe,
  beforeDestroy: xe,
  beforeUnmount: xe,
  destroyed: xe,
  unmounted: xe,
  activated: xe,
  deactivated: xe,
  errorCaptured: xe,
  serverPrefetch: xe,
  // assets
  components: Yt,
  directives: Yt,
  // watch
  watch: bl,
  // provide / inject
  provide: or,
  inject: _l
};
function or(e, t) {
  return t ? e ? function() {
    return ve(
      B(e) ? e.call(this, this) : e,
      B(t) ? t.call(this, this) : t
    );
  } : t : e;
}
function _l(e, t) {
  return Yt(vi(e), vi(t));
}
function vi(e) {
  if (V(e)) {
    const t = {};
    for (let n = 0; n < e.length; n++)
      t[e[n]] = e[n];
    return t;
  }
  return e;
}
function xe(e, t) {
  return e ? [...new Set([].concat(e, t))] : t;
}
function Yt(e, t) {
  return e ? ve(/* @__PURE__ */ Object.create(null), e, t) : t;
}
function sr(e, t) {
  return e ? V(e) && V(t) ? [.../* @__PURE__ */ new Set([...e, ...t])] : ve(
    /* @__PURE__ */ Object.create(null),
    ir(e),
    ir(t ?? {})
  ) : t;
}
function bl(e, t) {
  if (!e) return t;
  if (!t) return e;
  const n = ve(/* @__PURE__ */ Object.create(null), e);
  for (const i in t)
    n[i] = xe(e[i], t[i]);
  return n;
}
function wo() {
  return {
    app: null,
    config: {
      isNativeTag: Fr,
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
let Sl = 0;
function xl(e, t) {
  return function(i, r = null) {
    B(i) || (i = ve({}, i)), r != null && !te(r) && (r = null);
    const o = wo(), s = /* @__PURE__ */ new WeakSet(), a = [];
    let u = !1;
    const d = o.app = {
      _uid: Sl++,
      _component: i,
      _props: r,
      _container: null,
      _context: o,
      _instance: null,
      version: ta,
      get config() {
        return o.config;
      },
      set config(f) {
      },
      use(f, ...h) {
        return s.has(f) || (f && B(f.install) ? (s.add(f), f.install(d, ...h)) : B(f) && (s.add(f), f(d, ...h))), d;
      },
      mixin(f) {
        return o.mixins.includes(f) || o.mixins.push(f), d;
      },
      component(f, h) {
        return h ? (o.components[f] = h, d) : o.components[f];
      },
      directive(f, h) {
        return h ? (o.directives[f] = h, d) : o.directives[f];
      },
      mount(f, h, b) {
        if (!u) {
          const S = d._ceVNode || Me(i, r);
          return S.appContext = o, b === !0 ? b = "svg" : b === !1 && (b = void 0), e(S, f, b), u = !0, d._container = f, f.__vue_app__ = d, jn(S.component);
        }
      },
      onUnmount(f) {
        a.push(f);
      },
      unmount() {
        u && (Ke(
          a,
          d._instance,
          16
        ), e(null, d._container), delete d._container.__vue_app__);
      },
      provide(f, h) {
        return o.provides[f] = h, d;
      },
      runWithContext(f) {
        const h = $t;
        $t = d;
        try {
          return f();
        } finally {
          $t = h;
        }
      }
    };
    return d;
  };
}
let $t = null;
const Pl = (e, t) => t === "modelValue" || t === "model-value" ? e.modelModifiers : e[`${t}Modifiers`] || e[`${Ne(t)}Modifiers`] || e[`${Ot(t)}Modifiers`];
function Cl(e, t, ...n) {
  if (e.isUnmounted) return;
  const i = e.vnode.props || oe;
  let r = n;
  const o = t.startsWith("update:"), s = o && Pl(i, t.slice(7));
  s && (s.trim && (r = n.map((f) => ce(f) ? f.trim() : f)), s.number && (r = n.map(Ci)));
  let a, u = i[a = qn(t)] || // also try camelCase event handler (#2249)
  i[a = qn(Ne(t))];
  !u && o && (u = i[a = qn(Ot(t))]), u && Ke(
    u,
    e,
    6,
    r
  );
  const d = i[a + "Once"];
  if (d) {
    if (!e.emitted)
      e.emitted = {};
    else if (e.emitted[a])
      return;
    e.emitted[a] = !0, Ke(
      d,
      e,
      6,
      r
    );
  }
}
const Tl = /* @__PURE__ */ new WeakMap();
function Io(e, t, n = !1) {
  const i = n ? Tl : t.emitsCache, r = i.get(e);
  if (r !== void 0)
    return r;
  const o = e.emits;
  let s = {}, a = !1;
  if (!B(e)) {
    const u = (d) => {
      const f = Io(d, t, !0);
      f && (a = !0, ve(s, f));
    };
    !n && t.mixins.length && t.mixins.forEach(u), e.extends && u(e.extends), e.mixins && e.mixins.forEach(u);
  }
  return !o && !a ? (te(e) && i.set(e, null), null) : (V(o) ? o.forEach((u) => s[u] = null) : ve(s, o), te(e) && i.set(e, s), s);
}
function Kn(e, t) {
  return !e || !Dn(t) ? !1 : (t = t.slice(2).replace(/Once$/, ""), ee(e, t[0].toLowerCase() + t.slice(1)) || ee(e, Ot(t)) || ee(e, t));
}
function lr(e) {
  const {
    type: t,
    vnode: n,
    proxy: i,
    withProxy: r,
    propsOptions: [o],
    slots: s,
    attrs: a,
    emit: u,
    render: d,
    renderCache: f,
    props: h,
    data: b,
    setupState: S,
    ctx: E,
    inheritAttrs: w
  } = e, K = wn(e);
  let W, D;
  try {
    if (n.shapeFlag & 4) {
      const O = r || i, G = O;
      W = Ye(
        d.call(
          G,
          O,
          f,
          h,
          S,
          b,
          E
        )
      ), D = a;
    } else {
      const O = t;
      W = Ye(
        O.length > 1 ? O(
          h,
          { attrs: a, slots: s, emit: u }
        ) : O(
          h,
          null
        )
      ), D = t.props ? a : Al(a);
    }
  } catch (O) {
    on.length = 0, Nn(O, e, 1), W = Me(Te);
  }
  let J = W;
  if (D && w !== !1) {
    const O = Object.keys(D), { shapeFlag: G } = J;
    O.length && G & 7 && (o && O.some(Ln) && (D = wl(
      D,
      o
    )), J = vt(J, D, !1, !0));
  }
  return n.dirs && (J = vt(J, null, !1, !0), J.dirs = J.dirs ? J.dirs.concat(n.dirs) : n.dirs), n.transition && cn(J, n.transition), W = J, wn(K), W;
}
const Al = (e) => {
  let t;
  for (const n in e)
    (n === "class" || n === "style" || Dn(n)) && ((t || (t = {}))[n] = e[n]);
  return t;
}, wl = (e, t) => {
  const n = {};
  for (const i in e)
    (!Ln(i) || !(i.slice(9) in t)) && (n[i] = e[i]);
  return n;
};
function Il(e, t, n) {
  const { props: i, children: r, component: o } = e, { props: s, children: a, patchFlag: u } = t, d = o.emitsOptions;
  if (t.dirs || t.transition)
    return !0;
  if (n && u >= 0) {
    if (u & 1024)
      return !0;
    if (u & 16)
      return i ? ar(i, s, d) : !!s;
    if (u & 8) {
      const f = t.dynamicProps;
      for (let h = 0; h < f.length; h++) {
        const b = f[h];
        if (Mo(s, i, b) && !Kn(d, b))
          return !0;
      }
    }
  } else
    return (r || a) && (!a || !a.$stable) ? !0 : i === s ? !1 : i ? s ? ar(i, s, d) : !0 : !!s;
  return !1;
}
function ar(e, t, n) {
  const i = Object.keys(t);
  if (i.length !== Object.keys(e).length)
    return !0;
  for (let r = 0; r < i.length; r++) {
    const o = i[r];
    if (Mo(t, e, o) && !Kn(n, o))
      return !0;
  }
  return !1;
}
function Mo(e, t, n) {
  const i = e[n], r = t[n];
  return n === "style" && te(i) && te(r) ? !Ai(i, r) : i !== r;
}
function Ml({ vnode: e, parent: t, suspense: n }, i) {
  for (; t; ) {
    const r = t.subTree;
    if (r.suspense && r.suspense.activeBranch === e && (r.suspense.vnode.el = r.el = i, e = r), r === e)
      (e = t.vnode).el = i, t = t.parent;
    else
      break;
  }
  n && n.activeBranch === e && (n.vnode.el = i);
}
const Eo = {}, Oo = () => Object.create(Eo), ko = (e) => Object.getPrototypeOf(e) === Eo;
function El(e, t, n, i = !1) {
  const r = {}, o = Oo();
  e.propsDefaults = /* @__PURE__ */ Object.create(null), Do(e, t, r, o);
  for (const s in e.propsOptions[0])
    s in r || (r[s] = void 0);
  n ? e.props = i ? r : /* @__PURE__ */ ks(r) : e.type.props ? e.props = r : e.props = o, e.attrs = o;
}
function Ol(e, t, n, i) {
  const {
    props: r,
    attrs: o,
    vnode: { patchFlag: s }
  } = e, a = /* @__PURE__ */ Z(r), [u] = e.propsOptions;
  let d = !1;
  if (
    // always force full diff in dev
    // - #1942 if hmr is enabled with sfc component
    // - vite#872 non-sfc component used by sfc component
    (i || s > 0) && !(s & 16)
  ) {
    if (s & 8) {
      const f = e.vnode.dynamicProps;
      for (let h = 0; h < f.length; h++) {
        let b = f[h];
        if (Kn(e.emitsOptions, b))
          continue;
        const S = t[b];
        if (u)
          if (ee(o, b))
            S !== o[b] && (o[b] = S, d = !0);
          else {
            const E = Ne(b);
            r[E] = mi(
              u,
              a,
              E,
              S,
              e,
              !1
            );
          }
        else
          S !== o[b] && (o[b] = S, d = !0);
      }
    }
  } else {
    Do(e, t, r, o) && (d = !0);
    let f;
    for (const h in a)
      (!t || // for camelCase
      !ee(t, h) && // it's possible the original props was passed in as kebab-case
      // and converted to camelCase (#955)
      ((f = Ot(h)) === h || !ee(t, f))) && (u ? n && // for camelCase
      (n[h] !== void 0 || // for kebab-case
      n[f] !== void 0) && (r[h] = mi(
        u,
        a,
        h,
        void 0,
        e,
        !0
      )) : delete r[h]);
    if (o !== a)
      for (const h in o)
        (!t || !ee(t, h)) && (delete o[h], d = !0);
  }
  d && ot(e.attrs, "set", "");
}
function Do(e, t, n, i) {
  const [r, o] = e.propsOptions;
  let s = !1, a;
  if (t)
    for (let u in t) {
      if (Xt(u))
        continue;
      const d = t[u];
      let f;
      r && ee(r, f = Ne(u)) ? !o || !o.includes(f) ? n[f] = d : (a || (a = {}))[f] = d : Kn(e.emitsOptions, u) || (!(u in i) || d !== i[u]) && (i[u] = d, s = !0);
    }
  if (o) {
    const u = /* @__PURE__ */ Z(n), d = a || oe;
    for (let f = 0; f < o.length; f++) {
      const h = o[f];
      n[h] = mi(
        r,
        u,
        h,
        d[h],
        e,
        !ee(d, h)
      );
    }
  }
  return s;
}
function mi(e, t, n, i, r, o) {
  const s = e[n];
  if (s != null) {
    const a = ee(s, "default");
    if (a && i === void 0) {
      const u = s.default;
      if (s.type !== Function && !s.skipFactory && B(u)) {
        const { propsDefaults: d } = r;
        if (n in d)
          i = d[n];
        else {
          const f = vn(r);
          i = d[n] = u.call(
            null,
            t
          ), f();
        }
      } else
        i = u;
      r.ce && r.ce._setProp(n, i);
    }
    s[
      0
      /* shouldCast */
    ] && (o && !a ? i = !1 : s[
      1
      /* shouldCastTrue */
    ] && (i === "" || i === Ot(n)) && (i = !0));
  }
  return i;
}
const kl = /* @__PURE__ */ new WeakMap();
function Lo(e, t, n = !1) {
  const i = n ? kl : t.propsCache, r = i.get(e);
  if (r)
    return r;
  const o = e.props, s = {}, a = [];
  let u = !1;
  if (!B(e)) {
    const f = (h) => {
      u = !0;
      const [b, S] = Lo(h, t, !0);
      ve(s, b), S && a.push(...S);
    };
    !n && t.mixins.length && t.mixins.forEach(f), e.extends && f(e.extends), e.mixins && e.mixins.forEach(f);
  }
  if (!o && !u)
    return te(e) && i.set(e, Vt), Vt;
  if (V(o))
    for (let f = 0; f < o.length; f++) {
      const h = Ne(o[f]);
      cr(h) && (s[h] = oe);
    }
  else if (o)
    for (const f in o) {
      const h = Ne(f);
      if (cr(h)) {
        const b = o[f], S = s[h] = V(b) || B(b) ? { type: b } : ve({}, b), E = S.type;
        let w = !1, K = !0;
        if (V(E))
          for (let W = 0; W < E.length; ++W) {
            const D = E[W], J = B(D) && D.name;
            if (J === "Boolean") {
              w = !0;
              break;
            } else J === "String" && (K = !1);
          }
        else
          w = B(E) && E.name === "Boolean";
        S[
          0
          /* shouldCast */
        ] = w, S[
          1
          /* shouldCastTrue */
        ] = K, (w || ee(S, "default")) && a.push(h);
      }
    }
  const d = [s, a];
  return te(e) && i.set(e, d), d;
}
function cr(e) {
  return e[0] !== "$" && !Xt(e);
}
const Ni = (e) => e === "_" || e === "_ctx" || e === "$stable", $i = (e) => V(e) ? e.map(Ye) : [Ye(e)], Dl = (e, t, n) => {
  if (t._n)
    return t;
  const i = fo((...r) => $i(t(...r)), n);
  return i._c = !1, i;
}, Fo = (e, t, n) => {
  const i = e._ctx;
  for (const r in e) {
    if (Ni(r)) continue;
    const o = e[r];
    if (B(o))
      t[r] = Dl(r, o, i);
    else if (o != null) {
      const s = $i(o);
      t[r] = () => s;
    }
  }
}, Vo = (e, t) => {
  const n = $i(t);
  e.slots.default = () => n;
}, Ro = (e, t, n) => {
  for (const i in t)
    (n || !Ni(i)) && (e[i] = t[i]);
}, Ll = (e, t, n) => {
  const i = e.slots = Oo();
  if (e.vnode.shapeFlag & 32) {
    const r = t._;
    r ? (Ro(i, t, n), n && Kr(i, "_", r, !0)) : Fo(t, i);
  } else t && Vo(e, t);
}, Fl = (e, t, n) => {
  const { vnode: i, slots: r } = e;
  let o = !0, s = oe;
  if (i.shapeFlag & 32) {
    const a = t._;
    a ? n && a === 1 ? o = !1 : Ro(r, t, n) : (o = !t.$stable, Fo(t, r)), s = t;
  } else t && (Vo(e, t), s = { default: 1 });
  if (o)
    for (const a in r)
      !Ni(a) && s[a] == null && delete r[a];
}, Pe = Bl;
function Vl(e) {
  return Rl(e);
}
function Rl(e, t) {
  const n = Vn();
  n.__VUE__ = !0;
  const {
    insert: i,
    remove: r,
    patchProp: o,
    createElement: s,
    createText: a,
    createComment: u,
    setText: d,
    setElementText: f,
    parentNode: h,
    nextSibling: b,
    setScopeId: S = Xe,
    insertStaticContent: E
  } = e, w = (l, c, p, _ = null, v = null, m = null, C = void 0, P = null, x = !!c.dynamicChildren) => {
    if (l === c)
      return;
    l && !wt(l, c) && (_ = dt(l), De(l, v, m, !0), l = null), c.patchFlag === -2 && (x = !1, c.dynamicChildren = null);
    const { type: y, ref: F, shapeFlag: A } = c;
    switch (y) {
      case Hn:
        K(l, c, p, _);
        break;
      case Te:
        W(l, c, p, _);
        break;
      case ei:
        l == null && D(c, p, _, C);
        break;
      case _e:
        T(
          l,
          c,
          p,
          _,
          v,
          m,
          C,
          P,
          x
        );
        break;
      default:
        A & 1 ? G(
          l,
          c,
          p,
          _,
          v,
          m,
          C,
          P,
          x
        ) : A & 6 ? ie(
          l,
          c,
          p,
          _,
          v,
          m,
          C,
          P,
          x
        ) : (A & 64 || A & 128) && y.process(
          l,
          c,
          p,
          _,
          v,
          m,
          C,
          P,
          x,
          H
        );
    }
    F != null && v ? tn(F, l && l.ref, m, c || l, !c) : F == null && l && l.ref != null && tn(l.ref, null, m, l, !0);
  }, K = (l, c, p, _) => {
    if (l == null)
      i(
        c.el = a(c.children),
        p,
        _
      );
    else {
      const v = c.el = l.el;
      c.children !== l.children && d(v, c.children);
    }
  }, W = (l, c, p, _) => {
    l == null ? i(
      c.el = u(c.children || ""),
      p,
      _
    ) : c.el = l.el;
  }, D = (l, c, p, _) => {
    [l.el, l.anchor] = E(
      l.children,
      c,
      p,
      _,
      l.el,
      l.anchor
    );
  }, J = ({ el: l, anchor: c }, p, _) => {
    let v;
    for (; l && l !== c; )
      v = b(l), i(l, p, _), l = v;
    i(c, p, _);
  }, O = ({ el: l, anchor: c }) => {
    let p;
    for (; l && l !== c; )
      p = b(l), r(l), l = p;
    r(c);
  }, G = (l, c, p, _, v, m, C, P, x) => {
    if (c.type === "svg" ? C = "svg" : c.type === "math" && (C = "mathml"), l == null)
      ue(
        c,
        p,
        _,
        v,
        m,
        C,
        P,
        x
      );
    else {
      const y = l.el && l.el._isVueCE ? l.el : null;
      try {
        y && y._beginPatch(), I(
          l,
          c,
          v,
          m,
          C,
          P,
          x
        );
      } finally {
        y && y._endPatch();
      }
    }
  }, ue = (l, c, p, _, v, m, C, P) => {
    let x, y;
    const { props: F, shapeFlag: A, transition: L, dirs: $ } = l;
    if (x = l.el = s(
      l.type,
      m,
      F && F.is,
      F
    ), A & 8 ? f(x, l.children) : A & 16 && U(
      l.children,
      x,
      null,
      _,
      v,
      Zn(l, m),
      C,
      P
    ), $ && _t(l, null, _, "created"), N(x, l, l.scopeId, C, _), F) {
      for (const re in F)
        re !== "value" && !Xt(re) && o(x, re, null, F[re], m, _);
      "value" in F && o(x, "value", null, F.value, m), (y = F.onVnodeBeforeMount) && We(y, _, l);
    }
    $ && _t(l, null, _, "beforeMount");
    const Q = Nl(v, L);
    Q && L.beforeEnter(x), i(x, c, p), ((y = F && F.onVnodeMounted) || Q || $) && Pe(() => {
      y && We(y, _, l), Q && L.enter(x), $ && _t(l, null, _, "mounted");
    }, v);
  }, N = (l, c, p, _, v) => {
    if (p && S(l, p), _)
      for (let m = 0; m < _.length; m++)
        S(l, _[m]);
    if (v) {
      let m = v.subTree;
      if (c === m || Bo(m.type) && (m.ssContent === c || m.ssFallback === c)) {
        const C = v.vnode;
        N(
          l,
          C,
          C.scopeId,
          C.slotScopeIds,
          v.parent
        );
      }
    }
  }, U = (l, c, p, _, v, m, C, P, x = 0) => {
    for (let y = x; y < l.length; y++) {
      const F = l[y] = P ? rt(l[y]) : Ye(l[y]);
      w(
        null,
        F,
        c,
        p,
        _,
        v,
        m,
        C,
        P
      );
    }
  }, I = (l, c, p, _, v, m, C) => {
    const P = c.el = l.el;
    let { patchFlag: x, dynamicChildren: y, dirs: F } = c;
    x |= l.patchFlag & 16;
    const A = l.props || oe, L = c.props || oe;
    let $;
    if (p && St(p, !1), ($ = L.onVnodeBeforeUpdate) && We($, p, c, l), F && _t(c, l, p, "beforeUpdate"), p && St(p, !0), (A.innerHTML && L.innerHTML == null || A.textContent && L.textContent == null) && f(P, ""), y ? Y(
      l.dynamicChildren,
      y,
      P,
      p,
      _,
      Zn(c, v),
      m
    ) : C || z(
      l,
      c,
      P,
      null,
      p,
      _,
      Zn(c, v),
      m,
      !1
    ), x > 0) {
      if (x & 16)
        X(P, A, L, p, v);
      else if (x & 2 && A.class !== L.class && o(P, "class", null, L.class, v), x & 4 && o(P, "style", A.style, L.style, v), x & 8) {
        const Q = c.dynamicProps;
        for (let re = 0; re < Q.length; re++) {
          const le = Q[re], pe = A[le], me = L[le];
          (me !== pe || le === "value") && o(P, le, pe, me, v, p);
        }
      }
      x & 1 && l.children !== c.children && f(P, c.children);
    } else !C && y == null && X(P, A, L, p, v);
    (($ = L.onVnodeUpdated) || F) && Pe(() => {
      $ && We($, p, c, l), F && _t(c, l, p, "updated");
    }, _);
  }, Y = (l, c, p, _, v, m, C) => {
    for (let P = 0; P < c.length; P++) {
      const x = l[P], y = c[P], F = (
        // oldVNode may be an errored async setup() component inside Suspense
        // which will not have a mounted element
        x.el && // - In the case of a Fragment, we need to provide the actual parent
        // of the Fragment itself so it can move its children.
        (x.type === _e || // - In the case of different nodes, there is going to be a replacement
        // which also requires the correct parent container
        !wt(x, y) || // - In the case of a component, it could contain anything.
        x.shapeFlag & 198) ? h(x.el) : (
          // In other cases, the parent container is not actually used so we
          // just pass the block element here to avoid a DOM parentNode call.
          p
        )
      );
      w(
        x,
        y,
        F,
        null,
        _,
        v,
        m,
        C,
        !0
      );
    }
  }, X = (l, c, p, _, v) => {
    if (c !== p) {
      if (c !== oe)
        for (const m in c)
          !Xt(m) && !(m in p) && o(
            l,
            m,
            c[m],
            null,
            v,
            _
          );
      for (const m in p) {
        if (Xt(m)) continue;
        const C = p[m], P = c[m];
        C !== P && m !== "value" && o(l, m, P, C, v, _);
      }
      "value" in p && o(l, "value", c.value, p.value, v);
    }
  }, T = (l, c, p, _, v, m, C, P, x) => {
    const y = c.el = l ? l.el : a(""), F = c.anchor = l ? l.anchor : a("");
    let { patchFlag: A, dynamicChildren: L, slotScopeIds: $ } = c;
    $ && (P = P ? P.concat($) : $), l == null ? (i(y, p, _), i(F, p, _), U(
      // #10007
      // such fragment like `<></>` will be compiled into
      // a fragment which doesn't have a children.
      // In this case fallback to an empty array
      c.children || [],
      p,
      F,
      v,
      m,
      C,
      P,
      x
    )) : A > 0 && A & 64 && L && // #2715 the previous fragment could've been a BAILed one as a result
    // of renderSlot() with no valid children
    l.dynamicChildren && l.dynamicChildren.length === L.length ? (Y(
      l.dynamicChildren,
      L,
      p,
      v,
      m,
      C,
      P
    ), // #2080 if the stable fragment has a key, it's a <template v-for> that may
    //  get moved around. Make sure all root level vnodes inherit el.
    // #2134 or if it's a component root, it may also get moved around
    // as the component is being moved.
    (c.key != null || v && c === v.subTree) && Bi(
      l,
      c,
      !0
      /* shallow */
    )) : z(
      l,
      c,
      p,
      F,
      v,
      m,
      C,
      P,
      x
    );
  }, ie = (l, c, p, _, v, m, C, P, x) => {
    c.slotScopeIds = P, l == null ? c.shapeFlag & 512 ? v.ctx.activate(
      c,
      p,
      _,
      C,
      x
    ) : de(
      c,
      p,
      _,
      v,
      m,
      C,
      x
    ) : he(l, c, x);
  }, de = (l, c, p, _, v, m, C) => {
    const P = l.component = Jl(
      l,
      _,
      v
    );
    if ($n(l) && (P.ctx.renderer = H), Yl(P, !1, C), P.asyncDep) {
      if (v && v.registerDep(P, fe, C), !l.el) {
        const x = P.subTree = Me(Te);
        W(null, x, c, p), l.placeholder = x.el;
      }
    } else
      fe(
        P,
        l,
        c,
        p,
        v,
        m,
        C
      );
  }, he = (l, c, p) => {
    const _ = c.component = l.component;
    if (Il(l, c, p))
      if (_.asyncDep && !_.asyncResolved) {
        ne(_, c, p);
        return;
      } else
        _.next = c, _.update();
    else
      c.el = l.el, _.vnode = c;
  }, fe = (l, c, p, _, v, m, C) => {
    const P = () => {
      if (l.isMounted) {
        let { next: A, bu: L, u: $, parent: Q, vnode: re } = l;
        {
          const je = No(l);
          if (je) {
            A && (A.el = re.el, ne(l, A, C)), je.asyncDep.then(() => {
              Pe(() => {
                l.isUnmounted || y();
              }, v);
            });
            return;
          }
        }
        let le = A, pe;
        St(l, !1), A ? (A.el = re.el, ne(l, A, C)) : A = re, L && xn(L), (pe = A.props && A.props.onVnodeBeforeUpdate) && We(pe, Q, A, re), St(l, !0);
        const me = lr(l), He = l.subTree;
        l.subTree = me, w(
          He,
          me,
          // parent may have changed if it's in a teleport
          h(He.el),
          // anchor may have changed if it's in a fragment
          dt(He),
          l,
          v,
          m
        ), A.el = me.el, le === null && Ml(l, me.el), $ && Pe($, v), (pe = A.props && A.props.onVnodeUpdated) && Pe(
          () => We(pe, Q, A, re),
          v
        );
      } else {
        let A;
        const { el: L, props: $ } = c, { bm: Q, m: re, parent: le, root: pe, type: me } = l, He = nn(c);
        St(l, !1), Q && xn(Q), !He && (A = $ && $.onVnodeBeforeMount) && We(A, le, c), St(l, !0);
        {
          pe.ce && pe.ce._hasShadowRoot() && pe.ce._injectChildStyle(
            me,
            l.parent ? l.parent.type : void 0
          );
          const je = l.subTree = lr(l);
          w(
            null,
            je,
            p,
            _,
            l,
            v,
            m
          ), c.el = je.el;
        }
        if (re && Pe(re, v), !He && (A = $ && $.onVnodeMounted)) {
          const je = c;
          Pe(
            () => We(A, le, je),
            v
          );
        }
        (c.shapeFlag & 256 || le && nn(le.vnode) && le.vnode.shapeFlag & 256) && l.a && Pe(l.a, v), l.isMounted = !0, c = p = _ = null;
      }
    };
    l.scope.on();
    const x = l.effect = new Wr(P);
    l.scope.off();
    const y = l.update = x.run.bind(x), F = l.job = x.runIfDirty.bind(x);
    F.i = l, F.id = l.uid, x.scheduler = () => Fi(F), St(l, !0), y();
  }, ne = (l, c, p) => {
    c.component = l;
    const _ = l.vnode.props;
    l.vnode = c, l.next = null, Ol(l, c.props, _, p), Fl(l, c.children, p), lt(), Xi(l), at();
  }, z = (l, c, p, _, v, m, C, P, x = !1) => {
    const y = l && l.children, F = l ? l.shapeFlag : 0, A = c.children, { patchFlag: L, shapeFlag: $ } = c;
    if (L > 0) {
      if (L & 128) {
        ft(
          y,
          A,
          p,
          _,
          v,
          m,
          C,
          P,
          x
        );
        return;
      } else if (L & 256) {
        Ze(
          y,
          A,
          p,
          _,
          v,
          m,
          C,
          P,
          x
        );
        return;
      }
    }
    $ & 8 ? (F & 16 && yt(y, v, m), A !== y && f(p, A)) : F & 16 ? $ & 16 ? ft(
      y,
      A,
      p,
      _,
      v,
      m,
      C,
      P,
      x
    ) : yt(y, v, m, !0) : (F & 8 && f(p, ""), $ & 16 && U(
      A,
      p,
      _,
      v,
      m,
      C,
      P,
      x
    ));
  }, Ze = (l, c, p, _, v, m, C, P, x) => {
    l = l || Vt, c = c || Vt;
    const y = l.length, F = c.length, A = Math.min(y, F);
    let L;
    for (L = 0; L < A; L++) {
      const $ = c[L] = x ? rt(c[L]) : Ye(c[L]);
      w(
        l[L],
        $,
        p,
        null,
        v,
        m,
        C,
        P,
        x
      );
    }
    y > F ? yt(
      l,
      v,
      m,
      !0,
      !1,
      A
    ) : U(
      c,
      p,
      _,
      v,
      m,
      C,
      P,
      x,
      A
    );
  }, ft = (l, c, p, _, v, m, C, P, x) => {
    let y = 0;
    const F = c.length;
    let A = l.length - 1, L = F - 1;
    for (; y <= A && y <= L; ) {
      const $ = l[y], Q = c[y] = x ? rt(c[y]) : Ye(c[y]);
      if (wt($, Q))
        w(
          $,
          Q,
          p,
          null,
          v,
          m,
          C,
          P,
          x
        );
      else
        break;
      y++;
    }
    for (; y <= A && y <= L; ) {
      const $ = l[A], Q = c[L] = x ? rt(c[L]) : Ye(c[L]);
      if (wt($, Q))
        w(
          $,
          Q,
          p,
          null,
          v,
          m,
          C,
          P,
          x
        );
      else
        break;
      A--, L--;
    }
    if (y > A) {
      if (y <= L) {
        const $ = L + 1, Q = $ < F ? c[$].el : _;
        for (; y <= L; )
          w(
            null,
            c[y] = x ? rt(c[y]) : Ye(c[y]),
            p,
            Q,
            v,
            m,
            C,
            P,
            x
          ), y++;
      }
    } else if (y > L)
      for (; y <= A; )
        De(l[y], v, m, !0), y++;
    else {
      const $ = y, Q = y, re = /* @__PURE__ */ new Map();
      for (y = Q; y <= L; y++) {
        const Ee = c[y] = x ? rt(c[y]) : Ye(c[y]);
        Ee.key != null && re.set(Ee.key, y);
      }
      let le, pe = 0;
      const me = L - Q + 1;
      let He = !1, je = 0;
      const Ut = new Array(me);
      for (y = 0; y < me; y++) Ut[y] = 0;
      for (y = $; y <= A; y++) {
        const Ee = l[y];
        if (pe >= me) {
          De(Ee, v, m, !0);
          continue;
        }
        let Ue;
        if (Ee.key != null)
          Ue = re.get(Ee.key);
        else
          for (le = Q; le <= L; le++)
            if (Ut[le - Q] === 0 && wt(Ee, c[le])) {
              Ue = le;
              break;
            }
        Ue === void 0 ? De(Ee, v, m, !0) : (Ut[Ue - Q] = y + 1, Ue >= je ? je = Ue : He = !0, w(
          Ee,
          c[Ue],
          p,
          null,
          v,
          m,
          C,
          P,
          x
        ), pe++);
      }
      const Ui = He ? $l(Ut) : Vt;
      for (le = Ui.length - 1, y = me - 1; y >= 0; y--) {
        const Ee = Q + y, Ue = c[Ee], Wi = c[Ee + 1], qi = Ee + 1 < F ? (
          // #13559, #14173 fallback to el placeholder for unresolved async component
          Wi.el || $o(Wi)
        ) : _;
        Ut[y] === 0 ? w(
          null,
          Ue,
          p,
          qi,
          v,
          m,
          C,
          P,
          x
        ) : He && (le < 0 || y !== Ui[le] ? we(Ue, p, qi, 2) : le--);
      }
    }
  }, we = (l, c, p, _, v = null) => {
    const { el: m, type: C, transition: P, children: x, shapeFlag: y } = l;
    if (y & 6) {
      we(l.component.subTree, c, p, _);
      return;
    }
    if (y & 128) {
      l.suspense.move(c, p, _);
      return;
    }
    if (y & 64) {
      C.move(l, c, p, H);
      return;
    }
    if (C === _e) {
      i(m, c, p);
      for (let A = 0; A < x.length; A++)
        we(x[A], c, p, _);
      i(l.anchor, c, p);
      return;
    }
    if (C === ei) {
      J(l, c, p);
      return;
    }
    if (_ !== 2 && y & 1 && P)
      if (_ === 0)
        P.beforeEnter(m), i(m, c, p), Pe(() => P.enter(m), v);
      else {
        const { leave: A, delayLeave: L, afterLeave: $ } = P, Q = () => {
          l.ctx.isUnmounted ? r(m) : i(m, c, p);
        }, re = () => {
          m._isLeaving && m[Ge](
            !0
            /* cancelled */
          ), A(m, () => {
            Q(), $ && $();
          });
        };
        L ? L(m, Q, re) : re();
      }
    else
      i(m, c, p);
  }, De = (l, c, p, _ = !1, v = !1) => {
    const {
      type: m,
      props: C,
      ref: P,
      children: x,
      dynamicChildren: y,
      shapeFlag: F,
      patchFlag: A,
      dirs: L,
      cacheIndex: $,
      memo: Q
    } = l;
    if (A === -2 && (v = !1), P != null && (lt(), tn(P, null, p, l, !0), at()), $ != null && (c.renderCache[$] = void 0), F & 256) {
      c.ctx.deactivate(l);
      return;
    }
    const re = F & 1 && L, le = !nn(l);
    let pe;
    if (le && (pe = C && C.onVnodeBeforeUnmount) && We(pe, c, l), F & 6)
      M(l.component, p, _);
    else {
      if (F & 128) {
        l.suspense.unmount(p, _);
        return;
      }
      re && _t(l, null, c, "beforeUnmount"), F & 64 ? l.type.remove(
        l,
        c,
        p,
        H,
        _
      ) : y && // #5154
      // when v-once is used inside a block, setBlockTracking(-1) marks the
      // parent block with hasOnce: true
      // so that it doesn't take the fast path during unmount - otherwise
      // components nested in v-once are never unmounted.
      !y.hasOnce && // #1153: fast path should not be taken for non-stable (v-for) fragments
      (m !== _e || A > 0 && A & 64) ? yt(
        y,
        c,
        p,
        !1,
        !0
      ) : (m === _e && A & 384 || !v && F & 16) && yt(x, c, p), _ && Re(l);
    }
    const me = Q != null && $ == null;
    (le && (pe = C && C.onVnodeUnmounted) || re || me) && Pe(() => {
      pe && We(pe, c, l), re && _t(l, null, c, "unmounted"), me && (l.el = null);
    }, p);
  }, Re = (l) => {
    const { type: c, el: p, anchor: _, transition: v } = l;
    if (c === _e) {
      Wn(p, _);
      return;
    }
    if (c === ei) {
      O(l);
      return;
    }
    const m = () => {
      r(p), v && !v.persisted && v.afterLeave && v.afterLeave();
    };
    if (l.shapeFlag & 1 && v && !v.persisted) {
      const { leave: C, delayLeave: P } = v, x = () => C(p, m);
      P ? P(l.el, m, x) : x();
    } else
      m();
  }, Wn = (l, c) => {
    let p;
    for (; l !== c; )
      p = b(l), r(l), l = p;
    r(c);
  }, M = (l, c, p) => {
    const { bum: _, scope: v, job: m, subTree: C, um: P, m: x, a: y } = l;
    ur(x), ur(y), _ && xn(_), v.stop(), m && (m.flags |= 8, De(C, l, c, p)), P && Pe(P, c), Pe(() => {
      l.isUnmounted = !0;
    }, c);
  }, yt = (l, c, p, _ = !1, v = !1, m = 0) => {
    for (let C = m; C < l.length; C++)
      De(l[C], c, p, _, v);
  }, dt = (l) => {
    if (l.shapeFlag & 6)
      return dt(l.component.subTree);
    if (l.shapeFlag & 128)
      return l.suspense.next();
    const c = b(l.anchor || l.el), p = c && c[ho];
    return p ? b(p) : c;
  };
  let kt = !1;
  const mn = (l, c, p) => {
    let _;
    l == null ? c._vnode && (De(c._vnode, null, null, !0), _ = c._vnode.component) : w(
      c._vnode || null,
      l,
      c,
      null,
      null,
      null,
      p
    ), c._vnode = l, kt || (kt = !0, Xi(_), ao(), kt = !1);
  }, H = {
    p: w,
    um: De,
    m: we,
    r: Re,
    mt: de,
    mc: U,
    pc: z,
    pbc: Y,
    n: dt,
    o: e
  };
  return {
    render: mn,
    hydrate: void 0,
    createApp: xl(mn)
  };
}
function Zn({ type: e, props: t }, n) {
  return n === "svg" && e === "foreignObject" || n === "mathml" && e === "annotation-xml" && t && t.encoding && t.encoding.includes("html") ? void 0 : n;
}
function St({ effect: e, job: t }, n) {
  n ? (e.flags |= 32, t.flags |= 4) : (e.flags &= -33, t.flags &= -5);
}
function Nl(e, t) {
  return (!e || e && !e.pendingBranch) && t && !t.persisted;
}
function Bi(e, t, n = !1) {
  const i = e.children, r = t.children;
  if (V(i) && V(r))
    for (let o = 0; o < i.length; o++) {
      const s = i[o];
      let a = r[o];
      a.shapeFlag & 1 && !a.dynamicChildren && ((a.patchFlag <= 0 || a.patchFlag === 32) && (a = r[o] = rt(r[o]), a.el = s.el), !n && a.patchFlag !== -2 && Bi(s, a)), a.type === Hn && (a.patchFlag === -1 && (a = r[o] = rt(a)), a.el = s.el), a.type === Te && !a.el && (a.el = s.el);
    }
}
function $l(e) {
  const t = e.slice(), n = [0];
  let i, r, o, s, a;
  const u = e.length;
  for (i = 0; i < u; i++) {
    const d = e[i];
    if (d !== 0) {
      if (r = n[n.length - 1], e[r] < d) {
        t[i] = r, n.push(i);
        continue;
      }
      for (o = 0, s = n.length - 1; o < s; )
        a = o + s >> 1, e[n[a]] < d ? o = a + 1 : s = a;
      d < e[n[o]] && (o > 0 && (t[i] = n[o - 1]), n[o] = i);
    }
  }
  for (o = n.length, s = n[o - 1]; o-- > 0; )
    n[o] = s, s = t[s];
  return n;
}
function No(e) {
  const t = e.subTree.component;
  if (t)
    return t.asyncDep && !t.asyncResolved ? t : No(t);
}
function ur(e) {
  if (e)
    for (let t = 0; t < e.length; t++)
      e[t].flags |= 8;
}
function $o(e) {
  if (e.placeholder)
    return e.placeholder;
  const t = e.component;
  return t ? $o(t.subTree) : null;
}
const Bo = (e) => e.__isSuspense;
function Bl(e, t) {
  t && t.pendingBranch ? V(e) ? t.effects.push(...e) : t.effects.push(e) : Ws(e);
}
const _e = /* @__PURE__ */ Symbol.for("v-fgt"), Hn = /* @__PURE__ */ Symbol.for("v-txt"), Te = /* @__PURE__ */ Symbol.for("v-cmt"), ei = /* @__PURE__ */ Symbol.for("v-stc"), on = [];
let ke = null;
function j(e = !1) {
  on.push(ke = e ? null : []);
}
function Kl() {
  on.pop(), ke = on[on.length - 1] || null;
}
let un = 1;
function En(e, t = !1) {
  un += e, e < 0 && ke && t && (ke.hasOnce = !0);
}
function Ko(e) {
  return e.dynamicChildren = un > 0 ? ke || Vt : null, Kl(), un > 0 && ke && ke.push(e), e;
}
function q(e, t, n, i, r, o) {
  return Ko(
    g(
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
function Ho(e, t, n, i, r) {
  return Ko(
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
function On(e) {
  return e ? e.__v_isVNode === !0 : !1;
}
function wt(e, t) {
  return e.type === t.type && e.key === t.key;
}
const jo = ({ key: e }) => e ?? null, Cn = ({
  ref: e,
  ref_key: t,
  ref_for: n
}) => (typeof e == "number" && (e = "" + e), e != null ? ce(e) || /* @__PURE__ */ Se(e) || B(e) ? { i: Fe, r: e, k: t, f: !!n } : e : null);
function g(e, t = null, n = null, i = 0, r = null, o = e === _e ? 0 : 1, s = !1, a = !1) {
  const u = {
    __v_isVNode: !0,
    __v_skip: !0,
    type: e,
    props: t,
    key: t && jo(t),
    ref: t && Cn(t),
    scopeId: uo,
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
    ctx: Fe
  };
  return a ? (Ki(u, n), o & 128 && e.normalize(u)) : n && (u.shapeFlag |= ce(n) ? 8 : 16), un > 0 && // avoid a block node from tracking itself
  !s && // has current parent block
  ke && // presence of a patch flag indicates this node needs patching on updates.
  // component nodes also should always be patched, because even if the
  // component doesn't need to update, it needs to persist the instance on to
  // the next vnode so that it can be properly unmounted later.
  (u.patchFlag > 0 || o & 6) && // the EVENTS flag is only for hydration and if it is the only flag, the
  // vnode should not be considered dynamic due to handler caching.
  u.patchFlag !== 32 && ke.push(u), u;
}
const Me = Hl;
function Hl(e, t = null, n = null, i = 0, r = null, o = !1) {
  if ((!e || e === gl) && (e = Te), On(e)) {
    const a = vt(
      e,
      t,
      !0
      /* mergeRef: true */
    );
    return n && Ki(a, n), un > 0 && !o && ke && (a.shapeFlag & 6 ? ke[ke.indexOf(e)] = a : ke.push(a)), a.patchFlag = -2, a;
  }
  if (Zl(e) && (e = e.__vccOpts), t) {
    t = jl(t);
    let { class: a, style: u } = t;
    a && !ce(a) && (t.class = Ie(a)), te(u) && (/* @__PURE__ */ Li(u) && !V(u) && (u = ve({}, u)), t.style = Ti(u));
  }
  const s = ce(e) ? 1 : Bo(e) ? 128 : vo(e) ? 64 : te(e) ? 4 : B(e) ? 2 : 0;
  return g(
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
function jl(e) {
  return e ? /* @__PURE__ */ Li(e) || ko(e) ? ve({}, e) : e : null;
}
function vt(e, t, n = !1, i = !1) {
  const { props: r, ref: o, patchFlag: s, children: a, transition: u } = e, d = t ? Wl(r || {}, t) : r, f = {
    __v_isVNode: !0,
    __v_skip: !0,
    type: e.type,
    props: d,
    key: d && jo(d),
    ref: t && t.ref ? (
      // #2078 in the case of <component :is="vnode" ref="extra"/>
      // if the vnode itself already has a ref, cloneVNode will need to merge
      // the refs so the single vnode can be set on multiple refs
      n && o ? V(o) ? o.concat(Cn(t)) : [o, Cn(t)] : Cn(t)
    ) : o,
    scopeId: e.scopeId,
    slotScopeIds: e.slotScopeIds,
    children: a,
    target: e.target,
    targetStart: e.targetStart,
    targetAnchor: e.targetAnchor,
    staticCount: e.staticCount,
    shapeFlag: e.shapeFlag,
    // if the vnode is cloned with extra props, we can no longer assume its
    // existing patch flag to be reliable and need to add the FULL_PROPS flag.
    // note: preserve flag for fragments since they use the flag for children
    // fast paths only.
    patchFlag: t && e.type !== _e ? s === -1 ? 16 : s | 16 : s,
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
    ssContent: e.ssContent && vt(e.ssContent),
    ssFallback: e.ssFallback && vt(e.ssFallback),
    placeholder: e.placeholder,
    el: e.el,
    anchor: e.anchor,
    ctx: e.ctx,
    ce: e.ce
  };
  return u && i && cn(
    f,
    u.clone(f)
  ), f;
}
function Ul(e = " ", t = 0) {
  return Me(Hn, null, e, t);
}
function ge(e = "", t = !1) {
  return t ? (j(), Ho(Te, null, e)) : Me(Te, null, e);
}
function Ye(e) {
  return e == null || typeof e == "boolean" ? Me(Te) : V(e) ? Me(
    _e,
    null,
    // #3666, avoid reference pollution when reusing vnode
    e.slice()
  ) : On(e) ? rt(e) : Me(Hn, null, String(e));
}
function rt(e) {
  return e.el === null && e.patchFlag !== -1 || e.memo ? e : vt(e);
}
function Ki(e, t) {
  let n = 0;
  const { shapeFlag: i } = e;
  if (t == null)
    t = null;
  else if (V(t))
    n = 16;
  else if (typeof t == "object")
    if (i & 65) {
      const r = t.default;
      r && (r._c && (r._d = !1), Ki(e, r()), r._c && (r._d = !0));
      return;
    } else {
      n = 32;
      const r = t._;
      !r && !ko(t) ? t._ctx = Fe : r === 3 && Fe && (Fe.slots._ === 1 ? t._ = 1 : (t._ = 2, e.patchFlag |= 1024));
    }
  else B(t) ? (t = { default: t, _ctx: Fe }, n = 32) : (t = String(t), i & 64 ? (n = 16, t = [Ul(t)]) : n = 8);
  e.children = t, e.shapeFlag |= n;
}
function Wl(...e) {
  const t = {};
  for (let n = 0; n < e.length; n++) {
    const i = e[n];
    for (const r in i)
      if (r === "class")
        t.class !== i.class && (t.class = Ie([t.class, i.class]));
      else if (r === "style")
        t.style = Ti([t.style, i.style]);
      else if (Dn(r)) {
        const o = t[r], s = i[r];
        s && o !== s && !(V(o) && o.includes(s)) ? t[r] = o ? [].concat(o, s) : s : s == null && o == null && // mergeProps({ 'onUpdate:modelValue': undefined }) should not retain
        // the model listener.
        !Ln(r) && (t[r] = s);
      } else r !== "" && (t[r] = i[r]);
  }
  return t;
}
function We(e, t, n, i = null) {
  Ke(e, t, 7, [
    n,
    i
  ]);
}
const ql = wo();
let Gl = 0;
function Jl(e, t, n) {
  const i = e.type, r = (t ? t.appContext : e.appContext) || ql, o = {
    uid: Gl++,
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
    scope: new ds(
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
    propsOptions: Lo(i, r),
    emitsOptions: Io(i, r),
    // emit
    emit: null,
    // to be set immediately
    emitted: null,
    // props default value
    propsDefaults: oe,
    // inheritAttrs
    inheritAttrs: i.inheritAttrs,
    // state
    ctx: oe,
    data: oe,
    props: oe,
    attrs: oe,
    slots: oe,
    refs: oe,
    setupState: oe,
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
  return o.ctx = { _: o }, o.root = t ? t.root : o, o.emit = Cl.bind(null, o), e.ce && e.ce(o), o;
}
let Ae = null;
const Uo = () => Ae || Fe;
let kn, yi;
{
  const e = Vn(), t = (n, i) => {
    let r;
    return (r = e[n]) || (r = e[n] = []), r.push(i), (o) => {
      r.length > 1 ? r.forEach((s) => s(o)) : r[0](o);
    };
  };
  kn = t(
    "__VUE_INSTANCE_SETTERS__",
    (n) => Ae = n
  ), yi = t(
    "__VUE_SSR_SETTERS__",
    (n) => fn = n
  );
}
const vn = (e) => {
  const t = Ae;
  return kn(e), e.scope.on(), () => {
    e.scope.off(), kn(t);
  };
}, fr = () => {
  Ae && Ae.scope.off(), kn(null);
};
function Wo(e) {
  return e.vnode.shapeFlag & 4;
}
let fn = !1;
function Yl(e, t = !1, n = !1) {
  t && yi(t);
  const { props: i, children: r } = e.vnode, o = Wo(e);
  El(e, i, o, t), Ll(e, r, n || t);
  const s = o ? zl(e, t) : void 0;
  return t && yi(!1), s;
}
function zl(e, t) {
  const n = e.type;
  e.accessCache = /* @__PURE__ */ Object.create(null), e.proxy = new Proxy(e.ctx, hl);
  const { setup: i } = n;
  if (i) {
    lt();
    const r = e.setupContext = i.length > 1 ? Ql(e) : null, o = vn(e), s = hn(
      i,
      e,
      0,
      [
        e.props,
        r
      ]
    ), a = Rr(s);
    if (at(), o(), (a || e.sp) && !nn(e) && xo(e), a) {
      if (s.then(fr, fr), t)
        return s.then((u) => {
          dr(e, u);
        }).catch((u) => {
          Nn(u, e, 0);
        });
      e.asyncDep = s;
    } else
      dr(e, s);
  } else
    qo(e);
}
function dr(e, t, n) {
  B(t) ? e.type.__ssrInlineRender ? e.ssrRender = t : e.render = t : te(t) && (e.setupState = oo(t)), qo(e);
}
function qo(e, t, n) {
  const i = e.type;
  e.render || (e.render = i.render || Xe);
  {
    const r = vn(e);
    lt();
    try {
      vl(e);
    } finally {
      at(), r();
    }
  }
}
const Xl = {
  get(e, t) {
    return be(e, "get", ""), e[t];
  }
};
function Ql(e) {
  const t = (n) => {
    e.exposed = n || {};
  };
  return {
    attrs: new Proxy(e.attrs, Xl),
    slots: e.slots,
    emit: e.emit,
    expose: t
  };
}
function jn(e) {
  return e.exposed ? e.exposeProxy || (e.exposeProxy = new Proxy(oo(Ds(e.exposed)), {
    get(t, n) {
      if (n in t)
        return t[n];
      if (n in rn)
        return rn[n](e);
    },
    has(t, n) {
      return n in t || n in rn;
    }
  })) : e.proxy;
}
function Zl(e) {
  return B(e) && "__vccOpts" in e;
}
const Oe = (e, t) => /* @__PURE__ */ $s(e, t, fn);
function ea(e, t, n) {
  try {
    En(-1);
    const i = arguments.length;
    return i === 2 ? te(t) && !V(t) ? On(t) ? Me(e, null, [t]) : Me(e, t) : Me(e, null, t) : (i > 3 ? n = Array.prototype.slice.call(arguments, 2) : i === 3 && On(n) && (n = [n]), Me(e, t, n));
  } finally {
    En(1);
  }
}
const ta = "3.5.34";
let _i;
const pr = typeof window < "u" && window.trustedTypes;
if (pr)
  try {
    _i = /* @__PURE__ */ pr.createPolicy("vue", {
      createHTML: (e) => e
    });
  } catch {
  }
const Go = _i ? (e) => _i.createHTML(e) : (e) => e, na = "http://www.w3.org/2000/svg", ia = "http://www.w3.org/1998/Math/MathML", it = typeof document < "u" ? document : null, gr = it && /* @__PURE__ */ it.createElement("template"), ra = {
  insert: (e, t, n) => {
    t.insertBefore(e, n || null);
  },
  remove: (e) => {
    const t = e.parentNode;
    t && t.removeChild(e);
  },
  createElement: (e, t, n, i) => {
    const r = t === "svg" ? it.createElementNS(na, e) : t === "mathml" ? it.createElementNS(ia, e) : n ? it.createElement(e, { is: n }) : it.createElement(e);
    return e === "select" && i && i.multiple != null && r.setAttribute("multiple", i.multiple), r;
  },
  createText: (e) => it.createTextNode(e),
  createComment: (e) => it.createComment(e),
  setText: (e, t) => {
    e.nodeValue = t;
  },
  setElementText: (e, t) => {
    e.textContent = t;
  },
  parentNode: (e) => e.parentNode,
  nextSibling: (e) => e.nextSibling,
  querySelector: (e) => it.querySelector(e),
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
      gr.innerHTML = Go(
        i === "svg" ? `<svg>${e}</svg>` : i === "mathml" ? `<math>${e}</math>` : e
      );
      const a = gr.content;
      if (i === "svg" || i === "mathml") {
        const u = a.firstChild;
        for (; u.firstChild; )
          a.appendChild(u.firstChild);
        a.removeChild(u);
      }
      t.insertBefore(a, n);
    }
    return [
      // first
      s ? s.nextSibling : t.firstChild,
      // last
      n ? n.previousSibling : t.lastChild
    ];
  }
}, pt = "transition", Gt = "animation", dn = /* @__PURE__ */ Symbol("_vtc"), Jo = {
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
}, oa = /* @__PURE__ */ ve(
  {},
  mo,
  Jo
), sa = (e) => (e.displayName = "Transition", e.props = oa, e), la = /* @__PURE__ */ sa(
  (e, { slots: t }) => ea(il, aa(e), t)
), xt = (e, t = []) => {
  V(e) ? e.forEach((n) => n(...t)) : e && e(...t);
}, hr = (e) => e ? V(e) ? e.some((t) => t.length > 1) : e.length > 1 : !1;
function aa(e) {
  const t = {};
  for (const T in e)
    T in Jo || (t[T] = e[T]);
  if (e.css === !1)
    return t;
  const {
    name: n = "v",
    type: i,
    duration: r,
    enterFromClass: o = `${n}-enter-from`,
    enterActiveClass: s = `${n}-enter-active`,
    enterToClass: a = `${n}-enter-to`,
    appearFromClass: u = o,
    appearActiveClass: d = s,
    appearToClass: f = a,
    leaveFromClass: h = `${n}-leave-from`,
    leaveActiveClass: b = `${n}-leave-active`,
    leaveToClass: S = `${n}-leave-to`
  } = e, E = ca(r), w = E && E[0], K = E && E[1], {
    onBeforeEnter: W,
    onEnter: D,
    onEnterCancelled: J,
    onLeave: O,
    onLeaveCancelled: G,
    onBeforeAppear: ue = W,
    onAppear: N = D,
    onAppearCancelled: U = J
  } = t, I = (T, ie, de, he) => {
    T._enterCancelled = he, Pt(T, ie ? f : a), Pt(T, ie ? d : s), de && de();
  }, Y = (T, ie) => {
    T._isLeaving = !1, Pt(T, h), Pt(T, S), Pt(T, b), ie && ie();
  }, X = (T) => (ie, de) => {
    const he = T ? N : D, fe = () => I(ie, T, de);
    xt(he, [ie, fe]), vr(() => {
      Pt(ie, T ? u : o), nt(ie, T ? f : a), hr(he) || mr(ie, i, w, fe);
    });
  };
  return ve(t, {
    onBeforeEnter(T) {
      xt(W, [T]), nt(T, o), nt(T, s);
    },
    onBeforeAppear(T) {
      xt(ue, [T]), nt(T, u), nt(T, d);
    },
    onEnter: X(!1),
    onAppear: X(!0),
    onLeave(T, ie) {
      T._isLeaving = !0;
      const de = () => Y(T, ie);
      nt(T, h), T._enterCancelled ? (nt(T, b), br(T)) : (br(T), nt(T, b)), vr(() => {
        T._isLeaving && (Pt(T, h), nt(T, S), hr(O) || mr(T, i, K, de));
      }), xt(O, [T, de]);
    },
    onEnterCancelled(T) {
      I(T, !1, void 0, !0), xt(J, [T]);
    },
    onAppearCancelled(T) {
      I(T, !0, void 0, !0), xt(U, [T]);
    },
    onLeaveCancelled(T) {
      Y(T), xt(G, [T]);
    }
  });
}
function ca(e) {
  if (e == null)
    return null;
  if (te(e))
    return [ti(e.enter), ti(e.leave)];
  {
    const t = ti(e);
    return [t, t];
  }
}
function ti(e) {
  return rs(e);
}
function nt(e, t) {
  t.split(/\s+/).forEach((n) => n && e.classList.add(n)), (e[dn] || (e[dn] = /* @__PURE__ */ new Set())).add(t);
}
function Pt(e, t) {
  t.split(/\s+/).forEach((i) => i && e.classList.remove(i));
  const n = e[dn];
  n && (n.delete(t), n.size || (e[dn] = void 0));
}
function vr(e) {
  requestAnimationFrame(() => {
    requestAnimationFrame(e);
  });
}
let ua = 0;
function mr(e, t, n, i) {
  const r = e._endId = ++ua, o = () => {
    r === e._endId && i();
  };
  if (n != null)
    return setTimeout(o, n);
  const { type: s, timeout: a, propCount: u } = fa(e, t);
  if (!s)
    return i();
  const d = s + "end";
  let f = 0;
  const h = () => {
    e.removeEventListener(d, b), o();
  }, b = (S) => {
    S.target === e && ++f >= u && h();
  };
  setTimeout(() => {
    f < u && h();
  }, a + 1), e.addEventListener(d, b);
}
function fa(e, t) {
  const n = window.getComputedStyle(e), i = (E) => (n[E] || "").split(", "), r = i(`${pt}Delay`), o = i(`${pt}Duration`), s = yr(r, o), a = i(`${Gt}Delay`), u = i(`${Gt}Duration`), d = yr(a, u);
  let f = null, h = 0, b = 0;
  t === pt ? s > 0 && (f = pt, h = s, b = o.length) : t === Gt ? d > 0 && (f = Gt, h = d, b = u.length) : (h = Math.max(s, d), f = h > 0 ? s > d ? pt : Gt : null, b = f ? f === pt ? o.length : u.length : 0);
  const S = f === pt && /\b(?:transform|all)(?:,|$)/.test(
    i(`${pt}Property`).toString()
  );
  return {
    type: f,
    timeout: h,
    propCount: b,
    hasTransform: S
  };
}
function yr(e, t) {
  for (; e.length < t.length; )
    e = e.concat(e);
  return Math.max(...t.map((n, i) => _r(n) + _r(e[i])));
}
function _r(e) {
  return e === "auto" ? 0 : Number(e.slice(0, -1).replace(",", ".")) * 1e3;
}
function br(e) {
  return (e ? e.ownerDocument : document).body.offsetHeight;
}
function da(e, t, n) {
  const i = e[dn];
  i && (t = (t ? [t, ...i] : [...i]).join(" ")), t == null ? e.removeAttribute("class") : n ? e.setAttribute("class", t) : e.className = t;
}
const Sr = /* @__PURE__ */ Symbol("_vod"), pa = /* @__PURE__ */ Symbol("_vsh"), ga = /* @__PURE__ */ Symbol(""), ha = /(?:^|;)\s*display\s*:/;
function va(e, t, n) {
  const i = e.style, r = ce(n);
  let o = !1;
  if (n && !r) {
    if (t)
      if (ce(t))
        for (const s of t.split(";")) {
          const a = s.slice(0, s.indexOf(":")).trim();
          n[a] == null && zt(i, a, "");
        }
      else
        for (const s in t)
          n[s] == null && zt(i, s, "");
    for (const s in n) {
      s === "display" && (o = !0);
      const a = n[s];
      a != null ? ya(
        e,
        s,
        !ce(t) && t ? t[s] : void 0,
        a
      ) || zt(i, s, a) : zt(i, s, "");
    }
  } else if (r) {
    if (t !== n) {
      const s = i[ga];
      s && (n += ";" + s), i.cssText = n, o = ha.test(n);
    }
  } else t && e.removeAttribute("style");
  Sr in e && (e[Sr] = o ? i.display : "", e[pa] && (i.display = "none"));
}
const xr = /\s*!important$/;
function zt(e, t, n) {
  if (V(n))
    n.forEach((i) => zt(e, t, i));
  else if (n == null && (n = ""), t.startsWith("--"))
    e.setProperty(t, n);
  else {
    const i = ma(e, t);
    xr.test(n) ? e.setProperty(
      Ot(i),
      n.replace(xr, ""),
      "important"
    ) : e[i] = n;
  }
}
const Pr = ["Webkit", "Moz", "ms"], ni = {};
function ma(e, t) {
  const n = ni[t];
  if (n)
    return n;
  let i = Ne(t);
  if (i !== "filter" && i in e)
    return ni[t] = i;
  i = Br(i);
  for (let r = 0; r < Pr.length; r++) {
    const o = Pr[r] + i;
    if (o in e)
      return ni[t] = o;
  }
  return t;
}
function ya(e, t, n, i) {
  return e.tagName === "TEXTAREA" && (t === "width" || t === "height") && ce(i) && n === i;
}
const Cr = "http://www.w3.org/1999/xlink";
function Tr(e, t, n, i, r, o = us(t)) {
  i && t.startsWith("xlink:") ? n == null ? e.removeAttributeNS(Cr, t.slice(6, t.length)) : e.setAttributeNS(Cr, t, n) : n == null || o && !Hr(n) ? e.removeAttribute(t) : e.setAttribute(
    t,
    o ? "" : Qe(n) ? String(n) : n
  );
}
function Ar(e, t, n, i, r) {
  if (t === "innerHTML" || t === "textContent") {
    n != null && (e[t] = t === "innerHTML" ? Go(n) : n);
    return;
  }
  const o = e.tagName;
  if (t === "value" && o !== "PROGRESS" && // custom elements may use _value internally
  !o.includes("-")) {
    const a = o === "OPTION" ? e.getAttribute("value") || "" : e.value, u = n == null ? (
      // #11647: value should be set as empty string for null and undefined,
      // but <input type="checkbox"> should be set as 'on'.
      e.type === "checkbox" ? "on" : ""
    ) : String(n);
    (a !== u || !("_value" in e)) && (e.value = u), n == null && e.removeAttribute(t), e._value = n;
    return;
  }
  let s = !1;
  if (n === "" || n == null) {
    const a = typeof e[t];
    a === "boolean" ? n = Hr(n) : n == null && a === "string" ? (n = "", s = !0) : a === "number" && (n = 0, s = !0);
  }
  try {
    e[t] = n;
  } catch {
  }
  s && e.removeAttribute(r || t);
}
function Ft(e, t, n, i) {
  e.addEventListener(t, n, i);
}
function _a(e, t, n, i) {
  e.removeEventListener(t, n, i);
}
const wr = /* @__PURE__ */ Symbol("_vei");
function ba(e, t, n, i, r = null) {
  const o = e[wr] || (e[wr] = {}), s = o[t];
  if (i && s)
    s.value = i;
  else {
    const [a, u] = Sa(t);
    if (i) {
      const d = o[t] = Ca(
        i,
        r
      );
      Ft(e, a, d, u);
    } else s && (_a(e, a, s, u), o[t] = void 0);
  }
}
const Ir = /(?:Once|Passive|Capture)$/;
function Sa(e) {
  let t;
  if (Ir.test(e)) {
    t = {};
    let i;
    for (; i = e.match(Ir); )
      e = e.slice(0, e.length - i[0].length), t[i[0].toLowerCase()] = !0;
  }
  return [e[2] === ":" ? e.slice(3) : Ot(e.slice(2)), t];
}
let ii = 0;
const xa = /* @__PURE__ */ Promise.resolve(), Pa = () => ii || (xa.then(() => ii = 0), ii = Date.now());
function Ca(e, t) {
  const n = (i) => {
    if (!i._vts)
      i._vts = Date.now();
    else if (i._vts <= n.attached)
      return;
    Ke(
      Ta(i, n.value),
      t,
      5,
      [i]
    );
  };
  return n.value = e, n.attached = Pa(), n;
}
function Ta(e, t) {
  if (V(t)) {
    const n = e.stopImmediatePropagation;
    return e.stopImmediatePropagation = () => {
      n.call(e), e._stopped = !0;
    }, t.map(
      (i) => (r) => !r._stopped && i && i(r)
    );
  } else
    return t;
}
const Mr = (e) => e.charCodeAt(0) === 111 && e.charCodeAt(1) === 110 && // lowercase letter
e.charCodeAt(2) > 96 && e.charCodeAt(2) < 123, Aa = (e, t, n, i, r, o) => {
  const s = r === "svg";
  t === "class" ? da(e, i, s) : t === "style" ? va(e, n, i) : Dn(t) ? Ln(t) || ba(e, t, n, i, o) : (t[0] === "." ? (t = t.slice(1), !0) : t[0] === "^" ? (t = t.slice(1), !1) : wa(e, t, i, s)) ? (Ar(e, t, i), !e.tagName.includes("-") && (t === "value" || t === "checked" || t === "selected") && Tr(e, t, i, s, o, t !== "value")) : /* #11081 force set props for possible async custom element */ e._isVueCE && // #12408 check if it's declared prop or it's async custom element
  (Ia(e, t) || // @ts-expect-error _def is private
  e._def.__asyncLoader && (/[A-Z]/.test(t) || !ce(i))) ? Ar(e, Ne(t), i, o, t) : (t === "true-value" ? e._trueValue = i : t === "false-value" && (e._falseValue = i), Tr(e, t, i, s));
};
function wa(e, t, n, i) {
  if (i)
    return !!(t === "innerHTML" || t === "textContent" || t in e && Mr(t) && B(n));
  if (t === "spellcheck" || t === "draggable" || t === "translate" || t === "autocorrect" || t === "sandbox" && e.tagName === "IFRAME" || t === "form" || t === "list" && e.tagName === "INPUT" || t === "type" && e.tagName === "TEXTAREA")
    return !1;
  if (t === "width" || t === "height") {
    const r = e.tagName;
    if (r === "IMG" || r === "VIDEO" || r === "CANVAS" || r === "SOURCE")
      return !1;
  }
  return Mr(t) && ce(n) ? !1 : t in e;
}
function Ia(e, t) {
  const n = (
    // @ts-expect-error _def is private
    e._def.props
  );
  if (!n)
    return !1;
  const i = Ne(t);
  return Array.isArray(n) ? n.some((r) => Ne(r) === i) : Object.keys(n).some((r) => Ne(r) === i);
}
const Er = (e) => {
  const t = e.props["onUpdate:modelValue"] || !1;
  return V(t) ? (n) => xn(t, n) : t;
};
function Ma(e) {
  e.target.composing = !0;
}
function Or(e) {
  const t = e.target;
  t.composing && (t.composing = !1, t.dispatchEvent(new Event("input")));
}
const ri = /* @__PURE__ */ Symbol("_assign");
function kr(e, t, n) {
  return t && (e = e.trim()), n && (e = Ci(e)), e;
}
const Ea = {
  created(e, { modifiers: { lazy: t, trim: n, number: i } }, r) {
    e[ri] = Er(r);
    const o = i || r.props && r.props.type === "number";
    Ft(e, t ? "change" : "input", (s) => {
      s.target.composing || e[ri](kr(e.value, n, o));
    }), (n || o) && Ft(e, "change", () => {
      e.value = kr(e.value, n, o);
    }), t || (Ft(e, "compositionstart", Ma), Ft(e, "compositionend", Or), Ft(e, "change", Or));
  },
  // set value on mounted so it's after min/max for type="range"
  mounted(e, { value: t }) {
    e.value = t ?? "";
  },
  beforeUpdate(e, { value: t, oldValue: n, modifiers: { lazy: i, trim: r, number: o } }, s) {
    if (e[ri] = Er(s), e.composing) return;
    const a = (o || e.type === "number") && !/^0\d/.test(e.value) ? Ci(e.value) : e.value, u = t ?? "";
    if (a === u)
      return;
    const d = e.getRootNode();
    (d instanceof Document || d instanceof ShadowRoot) && d.activeElement === e && e.type !== "range" && (i && t === n || r && e.value.trim() === u) || (e.value = u);
  }
}, Oa = ["ctrl", "shift", "alt", "meta"], ka = {
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
  exact: (e, t) => Oa.some((n) => e[`${n}Key`] && !t.includes(n))
}, Dr = (e, t) => {
  if (!e) return e;
  const n = e._withMods || (e._withMods = {}), i = t.join(".");
  return n[i] || (n[i] = ((r, ...o) => {
    for (let s = 0; s < t.length; s++) {
      const a = ka[t[s]];
      if (a && a(r, t)) return;
    }
    return e(r, ...o);
  }));
}, Da = /* @__PURE__ */ ve({ patchProp: Aa }, ra);
let Lr;
function La() {
  return Lr || (Lr = Vl(Da));
}
const Fa = ((...e) => {
  const t = La().createApp(...e), { mount: n } = t;
  return t.mount = (i) => {
    const r = Ra(i);
    if (!r) return;
    const o = t._component;
    !B(o) && !o.render && !o.template && (o.template = r.innerHTML), r.nodeType === 1 && (r.textContent = "");
    const s = n(r, !1, Va(r));
    return r instanceof Element && (r.removeAttribute("v-cloak"), r.setAttribute("data-v-app", "")), s;
  }, t;
});
function Va(e) {
  if (e instanceof SVGElement)
    return "svg";
  if (typeof MathMLElement == "function" && e instanceof MathMLElement)
    return "mathml";
}
function Ra(e) {
  return ce(e) ? document.querySelector(e) : e;
}
function se() {
  return typeof window < "u" && window.openxnetApp || null;
}
function Na(e) {
  if (e && typeof e.isCurrentLanguageZh == "function")
    try {
      return !!e.isCurrentLanguageZh();
    } catch {
      return !0;
    }
  return String(e?.currentLanguage || navigator.language || "zh-CN").toLowerCase().startsWith("zh");
}
function Yo(e, t) {
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
function $a(e) {
  const t = String(e?.displayName || e?.vendor || e?.displayVendor || e?.id || "").trim();
  return t ? t.charAt(0).toUpperCase() : "P";
}
function zo(e, t) {
  if (t && typeof t.getPrototypeProviderStatusTone == "function")
    return t.getPrototypeProviderStatusTone(e) || "muted";
  const n = !!String(e?.url || "").trim(), i = !!String(e?.modelId || "").trim();
  return n && i ? "success" : n ? "warning" : "muted";
}
function Hi(e, t, n) {
  if (t && typeof t.getPrototypeProviderStatusLabel == "function")
    return t.getPrototypeProviderStatusLabel(e);
  const i = !!String(e?.url || "").trim(), r = !!String(e?.modelId || "").trim();
  return i && r ? n ? "已连接" : "Connected" : i ? n ? "待选择模型" : "Model pending" : n ? "未配置" : "Not configured";
}
function Ba(e, t, n) {
  if (t && typeof t.getPrototypeProviderSummaryText == "function")
    return t.getPrototypeProviderSummaryText(e);
  const i = Array.isArray(e?.models) ? e.models.length : 0;
  return i > 0 ? n ? `${i} 个模型已配置` : `${i} models configured` : n ? "未设置" : "Unset";
}
function Xo(e, t) {
  return t && typeof t.getPrototypeProviderDisplayName == "function" ? t.getPrototypeProviderDisplayName(e) : String(e?.displayVendor || e?.vendor || e?.id || "").trim();
}
function ji(e, t) {
  try {
    if (e && typeof e.getVendorLogo == "function")
      return String(e.getVendorLogo(t) || "").trim();
  } catch {
  }
  return "source/providers/logo.png";
}
function Kt(e, t) {
  try {
    if (e && typeof e.getProviderModelOptionValue == "function")
      return String(e.getProviderModelOptionValue(t) || "").trim();
  } catch {
  }
  return t && typeof t == "object" ? String(t.id || t.value || t.model || t.name || t.label || "").trim() : String(t || "").trim();
}
function pn(e, t) {
  try {
    if (e && typeof e.getProviderModelOptionLabel == "function")
      return String(e.getProviderModelOptionLabel(t) || "").trim();
  } catch {
  }
  return t && typeof t == "object" ? String(t.label || t.name || t.id || t.value || t.model || "").trim() : String(t || "").trim();
}
function Ht(e) {
  if (e && typeof e.getPrototypeConfiguredProviders == "function")
    try {
      return e.getPrototypeConfiguredProviders() || [];
    } catch {
      return [];
    }
  return Array.isArray(e?.modelProviders) ? e.modelProviders : [];
}
function Qo(e) {
  const t = String(e?.vendor || "").trim(), n = String(e?.url || "").trim(), i = String(e?.modelId || "").trim(), r = String(e?.apiKey || "").trim(), o = Array.isArray(e?.models) ? e.models.map((s) => Kt(null, s)).filter(Boolean) : [];
  return !!(t || n || i || r || o.length);
}
function jt(e) {
  if (e && typeof e.getPrototypeProviderTemplates == "function")
    try {
      return e.getPrototypeProviderTemplates() || [];
    } catch {
      return [];
    }
  return [];
}
function Zo(e) {
  return String(e?.prototypeModelProviderSelection || "").trim();
}
function Et(e, t) {
  e && (e.prototypeModelProviderSelection = String(t || "").trim());
}
function Ka(e, t) {
  const n = Ht(e).filter((o) => e && typeof e.isPrototypeMeaningfulProvider == "function" ? e.isPrototypeMeaningfulProvider(o) : Qo(o)), i = Zo(e), r = String(e?.settings?.selectedProvider || "").trim();
  return n.map((o) => {
    const s = String(o?.id || ""), a = s && e && typeof e.getProviderCardValidation == "function" ? e.getProviderCardValidation(s) : null, u = Array.isArray(o?.models) ? o.models.map((d) => ({
      value: Kt(e, d),
      label: pn(e, d)
    })).filter((d) => d.value) : [];
    return {
      id: s,
      vendor: String(o?.vendor || ""),
      displayName: Xo(o, e),
      summary: Ba(o, e, t),
      statusLabel: a?.status ? t ? { success: "验证通过", warning: "需关注", blocked: "阻塞", error: "异常" }[a.status] || a.status : { success: "Validated", warning: "Warning", blocked: "Blocked", error: "Error" }[a.status] || a.status : Hi(o, e, t),
      statusTone: a?.status || zo(o, e),
      initial: $a(o),
      isTemplate: !!o?.isTemplate,
      selected: i ? s === i : s === r,
      active: s === r,
      // 每张卡内联表单需要的字段：
      url: String(o?.url || ""),
      apiKey: String(o?.apiKey || ""),
      modelId: String(o?.modelId || ""),
      logo: ji(e, o?.logoVendor || o?.setupVendor || o?.vendor),
      hasWebsite: !!String(e?.vendorAPIpage?.[o?.vendor] || "").trim(),
      isCustom: String(o?.vendor || "").toLowerCase() === "custom",
      rawModels: u,
      validationStatus: String(a?.status || "").trim(),
      validationMessage: String(a?.message || "").trim(),
      validationChecks: Array.isArray(a?.checks) ? a.checks : [],
      validationModels: Array.isArray(a?.models) ? a.models.map((d) => ({
        value: Kt(e, d),
        label: pn(e, d)
      })).filter((d) => d.value) : [],
      matchedModel: !!a?.matched_model,
      apiKeyConfigured: !!a?.api_key_configured,
      apiKeyOptional: !!a?.api_key_optional,
      isValidating: s && e && typeof e.isProviderCardValidating == "function" ? !!e.isProviderCardValidating(s) : !1,
      isApplying: s && e && typeof e.isProviderCardApplying == "function" ? !!e.isProviderCardApplying(s) : !1
    };
  });
}
const Ha = /* @__PURE__ */ new Set(["Ollama", "Vllm", "LMstudio", "xinference", "Dify", "newapi", "LocalAI", "ttswebui"]);
function ja(e, t) {
  const n = Array.isArray(e?.vendorValues) ? e.vendorValues : [], i = String(e?.newProviderTemp?.vendor || "").trim();
  return n.map((r) => {
    const o = String(r || "").trim(), s = o.toLowerCase() === "custom", a = `vendor.${o}`;
    let u = "";
    if (e && typeof e.t == "function")
      try {
        u = String(e.t(a) || "").trim();
      } catch {
        u = "";
      }
    return (!u || u === a) && (u = s ? t ? "自定义 OpenAI" : "Custom OpenAI" : o), {
      value: o,
      label: u,
      logo: ji(e, o),
      category: s ? "custom" : Ha.has(o) ? "local" : "cloud",
      selected: i === o,
      isCustom: s
    };
  });
}
function mt(e) {
  const t = Zo(e), n = [...Ht(e), ...jt(e)];
  if (t) {
    const r = n.find((o) => String(o?.id || "") === t);
    if (r) return r;
  }
  if (e && typeof e.getPrototypeCurrentMainProvider == "function") {
    const r = e.getPrototypeCurrentMainProvider();
    if (r)
      return t || Et(e, r.id), r;
  }
  const i = n[0] || null;
  return i && !t && Et(e, i.id), i;
}
function Ua(e, t) {
  const n = mt(e) || {}, i = !!n?.isTemplate, r = Array.isArray(n?.models) ? n.models.map((f) => e && typeof e.getProviderModelOptionValue == "function" ? e.getProviderModelOptionValue(f) : typeof f == "string" ? f : String(f?.id || f?.name || "")).filter(Boolean) : [], o = e?.newProviderTemp || {}, s = n?.id && e && typeof e.getProviderCardValidation == "function" ? e.getProviderCardValidation(n.id) : null, a = jt(e), u = (Array.isArray(e?.vendorOptions) ? e.vendorOptions : []).filter((f) => f?.isUnlockHub), d = i && o.vendor ? o.vendor === "custom" ? "Azure OpenAI" : String(o.vendor || "").trim() : Xo(n, e);
  return {
    id: String(n?.id || ""),
    isTemplate: i,
    displayName: d || (t ? "新供应商" : "New Provider"),
    statusLabel: String(s?.status || "").trim() ? t ? { success: "验证通过", warning: "需关注", blocked: "阻塞", error: "异常" }[s.status] || s.status : { success: "Validated", warning: "Warning", blocked: "Blocked", error: "Error" }[s.status] || s.status : Hi(n, e, t),
    statusTone: String(s?.status || "").trim() || zo(n, e),
    vendor: String(i ? o.vendor || n?.setupVendor || n?.vendor || "" : n?.vendor || ""),
    url: String(i ? o.url || "" : n?.url || ""),
    apiKey: String(i ? o.apiKey || "" : n?.apiKey || ""),
    modelId: String(i ? o.modelId || n?.modelId || "" : n?.modelId || ""),
    models: r.map((f) => ({
      value: Kt(e, f),
      label: pn(e, f)
    })),
    validationMessage: String(s?.message || ""),
    validationStatus: String(s?.status || ""),
    validationChecks: Array.isArray(s?.checks) ? s.checks : [],
    validationModels: Array.isArray(s?.models) ? s.models.map((f) => ({
      value: Kt(e, f),
      label: pn(e, f)
    })).filter((f) => f.value) : [],
    matchedModel: !!s?.matched_model,
    apiKeyConfigured: !!s?.api_key_configured,
    apiKeyOptional: !!s?.api_key_optional,
    isValidating: n?.id && e && typeof e.isProviderCardValidating == "function" ? !!e.isProviderCardValidating(n.id) : !1,
    isApplying: n?.id && e && typeof e.isProviderCardApplying == "function" ? !!e.isProviderCardApplying(n.id) : !1,
    isCurrentMain: String(e?.settings?.selectedProvider || "").trim() === String(n?.id || "").trim(),
    addOptions: [
      ...a.map((f) => ({
        value: String(f?.setupVendor || f?.vendor || "").trim(),
        label: String(f?.displayVendor || f?.vendor || f?.id || "").trim(),
        meta: String(f?.summaryText || "").trim(),
        isUnlockHub: !1,
        logo: ji(e, f?.logoVendor || f?.setupVendor || f?.vendor),
        selected: String(o?.vendor || n?.setupVendor || n?.vendor || "").trim() === String(f?.setupVendor || f?.vendor || "").trim()
      })),
      ...u.map((f) => ({
        value: String(f?.value || "").trim(),
        label: String(f?.label || f?.value || "").trim(),
        meta: String(f?.meta || "").trim(),
        isUnlockHub: !0,
        logo: "",
        selected: !1
      }))
    ],
    validProvider: !!e?.validProvider,
    websiteUrl: String(e?.vendorAPIpage?.[o?.vendor || n?.vendor] || "").trim()
  };
}
function Wa(e) {
  return Ht(e).filter((t) => e && typeof e.isPrototypeMeaningfulProvider == "function" ? e.isPrototypeMeaningfulProvider(t) : Qo(t)).map((t) => ({
    value: String(t?.id || ""),
    label: `${t?.vendor || "Provider"} · ${t?.modelId || t?.id || ""}`.trim()
  }));
}
function Ct(e, t, n) {
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
  }, o = i[t] || {}, s = String(o?.selectedProvider || ""), a = s && Array.isArray(e?.modelProviders) ? e.modelProviders.find((u) => String(u?.id || "") === s) : null;
  return {
    id: t,
    label: Yo(t, n),
    methodName: r[t],
    selectedProvider: s,
    selectedProviderName: a ? `${a.vendor || "Provider"} / ${a.modelId || (n ? "待选择模型" : "Model pending")}` : n ? "未选择供应商" : "No provider selected",
    selectedProviderStatus: a ? Hi(a, e, n) : n ? "未绑定" : "Unbound",
    providerOptions: Wa(e),
    providerModels: Array.isArray(a?.models) ? a.models.map((u) => ({
      value: Kt(e, u),
      label: pn(e, u)
    })).filter((u) => u.value) : [],
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
function qa() {
  const e = se(), t = Na(e), n = Array.isArray(e?.modelTiles) ? e.modelTiles.map((o) => ({
    id: String(o?.id || ""),
    label: Yo(o?.id, t)
  })) : [], i = String(e?.subMenu || "service"), r = e?.newProviderTemp || {};
  return {
    isZh: t,
    activeMenu: String(e?.activeMenu || ""),
    activeTab: i,
    tabs: n,
    service: {
      providers: Ka(e, t),
      current: Ua(e, t),
      totalConfigured: e && typeof e.getPrototypeProviderReadyCount == "function" ? e.getPrototypeProviderReadyCount() : Ht(e).length,
      totalTemplates: jt(e).length,
      currentMainId: String(e?.settings?.selectedProvider || "").trim()
    },
    addDialog: {
      visible: !!e?.showAddDialog,
      vendor: String(r?.vendor || "").trim(),
      url: String(r?.url || "").trim(),
      apiKey: String(r?.apiKey || "").trim(),
      modelId: String(r?.modelId || "").trim(),
      vendorOptions: ja(e, t),
      validProvider: !!e?.validProvider,
      websiteUrl: String(e?.vendorAPIpage?.[r?.vendor || ""] || "").trim()
    },
    slots: [
      Ct(e, "main", t),
      Ct(e, "fast", t),
      Ct(e, "reasoner", t),
      Ct(e, "vision", t),
      Ct(e, "text2img", t),
      Ct(e, "asr", t),
      Ct(e, "tts", t)
    ]
  };
}
function Un(e, t) {
  const n = String(t || "").trim();
  return n && (Array.isArray(e?.modelProviders) ? e.modelProviders : []).find((i) => String(i?.id || "") === n) || null;
}
async function Ga(e) {
  const t = se();
  t && (t.activeMenu = "model-config", t.subMenu = e);
}
async function Ja() {
  const e = se();
  if (!e) return;
  e.activeMenu = "model-config", e.subMenu = "service";
  const n = jt(e)[0] || null;
  n?.id && (Et(e, n.id), typeof e.handleSelectVendor == "function" && e.handleSelectVendor(n.setupVendor || n.vendor || "custom"));
}
async function Ya(e) {
  const t = se();
  if (!t) return;
  const i = [...Ht(t), ...jt(t)].find((r) => String(r?.id || "") === String(e || ""));
  i && (Et(t, i.id), i.isTemplate && typeof t.handleSelectVendor == "function" && t.handleSelectVendor(i.setupVendor || i.vendor || "custom"));
}
async function za(e, t) {
  const n = se();
  if (!n) return;
  const i = mt(n);
  if (i?.isTemplate)
    n.newProviderTemp[e] = t;
  else if (i && (i[e] = t, typeof n.handleProviderDraftChange == "function")) {
    await n.handleProviderDraftChange(i.id);
    return;
  }
  typeof n.autoSaveSettings == "function" && await n.autoSaveSettings();
}
async function Xa(e) {
  const t = se();
  !t || typeof t.handleSelectVendor != "function" || t.handleSelectVendor(e);
}
async function Qa() {
  const e = se();
  if (!e) return { ok: !1 };
  const t = mt(e);
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
      const a = typeof e?.buildProviderCardIdentity == "function" ? String(e.buildProviderCardIdentity(s) || "").trim() : `${String(s?.vendor || "").trim().toLowerCase()}::${String(s?.url || "").trim().replace(/\/+$/, "").toLowerCase()}::${String(s?.modelId || "").trim().toLowerCase()}`;
      return a && a === i;
    }) || (Array.isArray(e.modelProviders) ? e.modelProviders.find((s) => !r.has(String(s?.id || "").trim())) : null) || (Array.isArray(e.modelProviders) ? e.modelProviders : [])[0] || null;
    return o?.id ? (Et(e, o.id), typeof e.selectModelProviderForUiplan == "function" && e.selectModelProviderForUiplan(o), {
      ok: !0,
      providerId: String(o.id),
      mode: "added"
    }) : { ok: !1 };
  } else if (t && typeof e.applyProviderCardToMain == "function")
    return await e.applyProviderCardToMain(t), Et(e, t.id), {
      ok: !0,
      providerId: String(t.id || ""),
      mode: "applied"
    };
  return { ok: !1 };
}
async function Za() {
  const e = se();
  if (!e) return;
  const t = mt(e);
  t && typeof e.validateProviderCard == "function" && await e.validateProviderCard(t);
}
async function ec() {
  const e = se();
  if (!e) return;
  const t = mt(e);
  t && typeof e.fetchModelsForProvider == "function" && await e.fetchModelsForProvider(t);
}
async function tc() {
  const e = se();
  if (!e) return;
  const t = mt(e);
  t?.id && typeof e.copyProviderById == "function" && e.copyProviderById(t.id);
}
async function nc() {
  const e = se();
  if (!e) return;
  const t = mt(e);
  if (t?.id && typeof e.removeProviderById == "function") {
    await e.removeProviderById(t.id);
    const n = [...Ht(e), ...jt(e)][0] || null;
    Et(e, n?.id || "");
  }
}
function ic() {
  const e = se();
  if (!e) return;
  const t = mt(e);
  t && typeof e.goToURL == "function" && e.goToURL(t);
}
async function rc(e, t) {
  const n = se();
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
async function oc(e, t, n) {
  const i = se();
  if (!i) return;
  const r = Un(i, e);
  if (r) {
    if (r[t] = n, typeof i.handleProviderDraftChange == "function") {
      await i.handleProviderDraftChange(r.id);
      return;
    }
    typeof i.autoSaveSettings == "function" && await i.autoSaveSettings();
  }
}
async function sc(e) {
  const t = se();
  t && (typeof t.selectMainProvider == "function" ? await t.selectMainProvider(String(e || "").trim()) : t.settings && (t.settings.selectedProvider = String(e || "").trim(), typeof t.autoSaveSettings == "function" && await t.autoSaveSettings()));
}
async function lc(e) {
  const t = se();
  if (!t) return;
  const n = Un(t, e);
  n && typeof t.validateProviderCard == "function" && await t.validateProviderCard(n);
}
async function ac(e) {
  const t = se();
  if (!t) return;
  const n = Un(t, e);
  n && typeof t.fetchModelsForProvider == "function" && await t.fetchModelsForProvider(n);
}
async function cc(e) {
  const t = se();
  t && typeof t.copyProviderById == "function" && t.copyProviderById(String(e || "").trim());
}
async function uc(e) {
  const t = se();
  t && typeof t.removeProviderById == "function" && await t.removeProviderById(String(e || "").trim());
}
function fc(e) {
  const t = se();
  if (!t) return;
  const n = Un(t, e);
  n && typeof t.goToURL == "function" && t.goToURL(n);
}
function dc(e) {
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
function pc() {
  const e = se();
  e && (e.newProviderTemp = { vendor: "", url: "", apiKey: "", modelId: "" }, e.showAddDialog = !0);
}
function gc() {
  const e = se();
  e && (e.showAddDialog = !1);
}
function hc(e) {
  const t = se();
  if (t) {
    if (typeof t.handleSelectVendor == "function") {
      t.handleSelectVendor(String(e || "").trim());
      return;
    }
    t.newProviderTemp || (t.newProviderTemp = { vendor: "", url: "", apiKey: "", modelId: "" }), t.newProviderTemp.vendor = String(e || "").trim(), typeof t.handleVendorChange == "function" && t.handleVendorChange(t.newProviderTemp.vendor);
  }
}
function vc(e, t) {
  const n = se();
  n && (n.newProviderTemp || (n.newProviderTemp = { vendor: "", url: "", apiKey: "", modelId: "" }), n.newProviderTemp[e] = t);
}
async function mc() {
  const e = se();
  if (!e || !String(e.newProviderTemp?.vendor || "").trim()) return !1;
  if (typeof e.confirmAddProvider == "function") {
    const t = { ...e.newProviderTemp };
    try {
      return await e.confirmAddProvider(), e.showAddDialog === !1;
    } catch (n) {
      throw e.newProviderTemp = t, e.showAddDialog = !0, n;
    }
  }
  return !1;
}
function yc() {
  const e = se();
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
async function _c(e, t, n) {
  const i = se();
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
function bc() {
  return {
    snapshot: qa,
    selectTab: Ga,
    prepareAddProvider: Ja,
    selectProviderCard: Ya,
    updateServiceField: za,
    selectServiceVendor: Xa,
    saveServiceProvider: Qa,
    validateCurrentProvider: Za,
    fetchCurrentProviderModels: ec,
    copyCurrentProvider: tc,
    removeCurrentProvider: nc,
    openCurrentProviderWebsite: ic,
    // 新增：per-provider 与 Add Dialog
    updateProviderFieldById: oc,
    selectProviderAsMain: sc,
    validateProviderById: lc,
    fetchModelsById: ac,
    copyProviderById: cc,
    removeProviderById: uc,
    openProviderWebsiteById: fc,
    copyToClipboard: dc,
    openAddDialog: pc,
    closeAddDialog: gc,
    selectVendorInDialog: hc,
    setDialogField: vc,
    confirmAddDialog: mc,
    openVendorWebsiteFromDialog: yc,
    selectSlotProvider: rc,
    updateSlotField: _c
  };
}
const Sc = { class: "ox-vite-model-shell" }, xc = { class: "ox-vite-model-header" }, Pc = { class: "ox-vite-model-tabs" }, Cc = ["onClick"], Tc = {
  key: 0,
  class: "ox-vite-model-feedback"
}, Ac = {
  key: 0,
  class: "ox-vite-model-service"
}, wc = { class: "oxm-service-grid" }, Ic = {
  key: 0,
  class: "oxm-service-empty"
}, Mc = { class: "oxm-provider-card__head" }, Ec = { class: "oxm-provider-card__brand" }, Oc = ["src", "alt"], kc = { class: "oxm-provider-card__name" }, Dc = {
  key: 0,
  class: "oxm-provider-card__main-tag"
}, Lc = { class: "oxm-provider-card__actions" }, Fc = ["title", "onClick"], Vc = ["title", "onClick"], Rc = ["title", "disabled", "onClick"], Nc = ["title", "onClick"], $c = { class: "oxm-provider-card__form" }, Bc = { class: "oxm-field" }, Kc = ["title", "onClick"], Hc = ["value", "placeholder", "onInput"], jc = { class: "oxm-field" }, Uc = ["title", "onClick"], Wc = { class: "oxm-input-with-affix" }, qc = ["type", "value", "placeholder", "onInput"], Gc = ["title", "onClick"], Jc = { class: "oxm-field" }, Yc = ["title", "onClick"], zc = ["value", "placeholder", "onInput"], Xc = {
  key: 1,
  class: "oxm-model-select"
}, Qc = ["value", "placeholder", "onInput"], Zc = { class: "oxm-model-list" }, eu = { class: "oxm-model-list__items" }, tu = ["onClick"], nu = {
  key: 1,
  class: "oxm-card-footer"
}, iu = ["onClick"], ru = { class: "oxm-add-tile__label" }, ou = {
  key: 1,
  class: "ox-vite-model-slot-panel"
}, su = { class: "ox-vite-model-slot-header" }, lu = { class: "ox-vite-model-slot-status" }, au = { class: "ox-vite-model-slot-grid" }, cu = { class: "ox-vite-model-field" }, uu = ["value"], fu = { value: "" }, du = ["value"], pu = { class: "ox-vite-model-field" }, gu = ["value"], hu = {
  key: 0,
  class: "ox-vite-model-slot-models"
}, vu = ["onClick"], mu = { class: "ox-vite-model-field" }, yu = ["value"], _u = { class: "ox-vite-model-field" }, bu = ["value"], Su = {
  key: 1,
  class: "ox-vite-model-field"
}, xu = ["value"], Pu = {
  key: 2,
  class: "ox-vite-model-field"
}, Cu = ["value"], Tu = {
  key: 3,
  class: "ox-vite-model-field"
}, Au = ["value"], wu = {
  key: 4,
  class: "ox-vite-model-field"
}, Iu = ["value"], Mu = {
  key: 5,
  class: "ox-vite-model-switch"
}, Eu = ["checked"], Ou = { class: "oxm-dialog-shell" }, ku = { class: "oxm-dialog__head" }, Du = { id: "oxm-provider-title" }, Lu = ["disabled", "title"], Fu = { class: "oxm-dialog__body" }, Vu = { class: "oxm-dialog__filter-row" }, Ru = { class: "oxm-dialog__search" }, Nu = ["placeholder"], $u = { class: "oxm-dialog__filter-tabs" }, Bu = { class: "oxm-vendor-grid" }, Ku = ["onClick"], Hu = { class: "oxm-vendor-card__logo-wrap" }, ju = ["src", "alt"], Uu = { class: "oxm-vendor-card__name" }, Wu = {
  key: 0,
  class: "oxm-vendor-empty"
}, qu = {
  key: 0,
  class: "oxm-pager"
}, Gu = ["disabled", "title"], Ju = { class: "oxm-pager__pages" }, Yu = ["onClick"], zu = ["disabled", "title"], Xu = { class: "oxm-pager__hint" }, Qu = {
  key: 1,
  class: "oxm-dialog__form"
}, Zu = { class: "oxm-dialog__form-head" }, ef = ["src", "alt"], tf = { key: 0 }, nf = { key: 1 }, rf = { class: "oxm-dialog__form-grid" }, of = { class: "oxm-field oxm-field--full" }, sf = ["value", "placeholder"], lf = { class: "oxm-field" }, af = ["value", "placeholder"], cf = { class: "oxm-field" }, uf = ["value", "placeholder"], ff = {
  key: 2,
  class: "oxm-dialog__error",
  role: "alert"
}, df = { class: "oxm-dialog__foot" }, pf = ["disabled"], gf = ["disabled"], oi = 14, hf = {
  __name: "App",
  setup(e) {
    const t = bc(), n = /* @__PURE__ */ tt(t.snapshot()), i = /* @__PURE__ */ tt(null), r = /* @__PURE__ */ tt(!1), o = /* @__PURE__ */ tt(""), s = /* @__PURE__ */ tt({
      visible: !1,
      text: ""
    });
    let a = null, u = null;
    function d() {
      n.value = t.snapshot();
    }
    function f(k) {
      s.value = {
        visible: !0,
        text: String(k || "").trim()
      }, u && window.clearTimeout(u), u = window.setTimeout(() => {
        s.value.visible = !1;
      }, 2600);
    }
    function h(k) {
      t.selectTab(k), d();
    }
    function b() {
      o.value = "", t.openAddDialog(), d();
    }
    function S(k, l, c) {
      const p = c && c.target ? c.target.value : c;
      t.updateProviderFieldById(k, l, p), d();
    }
    function E(k, l) {
      t.updateProviderFieldById(k, "modelId", l), d();
    }
    function w(k) {
      k && (t.copyToClipboard(k), f(M.value ? "已复制到剪贴板" : "Copied to clipboard"));
    }
    function K(k) {
      t.copyProviderById(k), d(), f(M.value ? "已复制为新服务商" : "Provider duplicated");
    }
    function W(k) {
      t.openProviderWebsiteById(k);
    }
    function D(k) {
      t.fetchModelsById(k), d();
    }
    function J(k) {
      t.removeProviderById(k), d(), f(M.value ? "服务商已删除" : "Provider removed");
    }
    function O(k) {
      t.selectProviderAsMain(k), d(), f(M.value ? "已设为主模型服务商" : "Set as main provider");
    }
    const G = /* @__PURE__ */ tt({});
    function ue(k) {
      G.value = {
        ...G.value,
        [k]: !G.value[k]
      };
    }
    const N = /* @__PURE__ */ tt(""), U = /* @__PURE__ */ tt("all"), I = /* @__PURE__ */ tt(1);
    function Y(k) {
      t.selectVendorInDialog(k), d();
    }
    function X(k, l) {
      const c = l && l.target ? l.target.value : l;
      t.setDialogField(k, c), d();
    }
    function T() {
      r.value || (i.value?.close(), t.closeAddDialog(), o.value = "", N.value = "", U.value = "all", I.value = 1, d());
    }
    async function ie() {
      if (!r.value) {
        r.value = !0, o.value = "";
        try {
          await t.confirmAddDialog() && (N.value = "", U.value = "all", I.value = 1, f(M.value ? "服务商已添加" : "Provider added"));
        } catch {
          o.value = M.value ? "保存未完成，请检查配置后重试。" : "Could not finish saving. Check the configuration and try again.";
        } finally {
          r.value = !1, d();
        }
      }
    }
    function de() {
      t.openVendorWebsiteFromDialog();
    }
    const he = Oe(() => n.value.addDialog || { visible: !1, vendorOptions: [] });
    en([() => he.value.visible, i, r], ([k, l, c]) => {
      l && ((k || c) && !l.open && l.showModal(), !k && !c && l.open && l.close());
    }, { flush: "post" });
    const fe = Oe(() => {
      const k = he.value.vendorOptions || [], l = String(N.value || "").trim().toLowerCase(), c = U.value;
      return k.filter((p) => c === "cloud" && p.category === "local" || c === "local" && p.category !== "local" ? !1 : l ? String(p.label || "").toLowerCase().includes(l) || String(p.value || "").toLowerCase().includes(l) : !0);
    });
    en([N, U], () => {
      I.value = 1;
    });
    const ne = Oe(() => {
      const k = fe.value.length;
      return k <= 0 ? 1 : Math.max(1, Math.ceil(k / oi));
    }), z = Oe(() => {
      const k = Number(I.value || 1);
      return !Number.isFinite(k) || k < 1 ? 1 : Math.min(k, ne.value);
    }), Ze = Oe(() => {
      const k = fe.value, l = (z.value - 1) * oi;
      return k.slice(l, l + oi);
    });
    function ft(k) {
      const l = ne.value;
      let c = Number(k);
      Number.isFinite(c) || (c = 1), c < 1 && (c = 1), c > l && (c = l), I.value = c;
    }
    const we = Oe(
      () => (he.value.vendorOptions || []).find((k) => k.selected) || null
    );
    function De(k, l) {
      t.selectSlotProvider(k, l.target.value), d();
    }
    function Re(k, l, c) {
      let p = c.target.value;
      (l === "temperature" || l === "top_p") && (p = Number(p)), l === "max_tokens" && (p = Number(p)), t.updateSlotField(k, l, p);
    }
    function Wn(k, l) {
      t.updateSlotField(k, "model", l), d();
    }
    const M = Oe(() => n.value.isZh), yt = Oe(() => n.value.tabs || []), dt = Oe(() => n.value.activeTab || "service"), kt = Oe(() => n.value.service || { providers: [], current: {} }), mn = Oe(() => Object.fromEntries((n.value.slots || []).map((k) => [k.id, k]))), H = Oe(() => mn.value[dt.value] || null);
    return Vi(() => {
      d(), a = window.setInterval(d, 400);
    }), Ri(() => {
      i.value?.close(), a && (window.clearInterval(a), a = null), u && (window.clearTimeout(u), u = null);
    }), (k, l) => (j(), q("div", Sc, [
      g("div", xc, [
        g("div", null, [
          g("h1", null, R(M.value ? "模型配置" : "Model Configuration"), 1),
          g("p", null, R(M.value ? "管理 AI 模型提供商和 API 密钥" : "Manage providers, API keys, and runtime model slots."), 1)
        ]),
        g("button", {
          type: "button",
          class: "ox-vite-model-primary-btn",
          onClick: b
        }, [
          l[22] || (l[22] = g("i", { class: "fa-solid fa-plus" }, null, -1)),
          g("span", null, R(M.value ? "添加提供商" : "Add Provider"), 1)
        ])
      ]),
      g("div", Pc, [
        (j(!0), q(_e, null, bt(yt.value, (c) => (j(), q("button", {
          key: c.id,
          type: "button",
          class: Ie(["ox-vite-model-tab", { active: dt.value === c.id }]),
          onClick: (p) => h(c.id)
        }, R(c.label), 11, Cc))), 128))
      ]),
      Me(la, { name: "ox-vite-model-feedback" }, {
        default: fo(() => [
          s.value.visible ? (j(), q("div", Tc, [
            l[23] || (l[23] = g("i", { class: "fa-solid fa-circle-check" }, null, -1)),
            g("span", null, R(s.value.text), 1)
          ])) : ge("", !0)
        ]),
        _: 1
      }),
      dt.value === "service" ? (j(), q("div", Ac, [
        g("div", wc, [
          kt.value.providers.length ? ge("", !0) : (j(), q("div", Ic, [
            l[24] || (l[24] = g("i", { class: "fa-solid fa-plug-circle-plus" }, null, -1)),
            g("strong", null, R(M.value ? "还没有已配置的服务商" : "No configured providers yet"), 1),
            g("p", null, R(M.value ? "点击右下角磁贴添加新服务商，并在卡片里直接填写 API 地址、密钥与模型 ID。" : "Click the “Add Provider” tile to start; fill in URL, key and model directly on the card."), 1)
          ])),
          (j(!0), q(_e, null, bt(kt.value.providers, (c) => (j(), q("div", {
            key: c.id,
            class: Ie(["oxm-provider-card", { "is-current-main": c.active, [`is-${c.statusTone}`]: !!c.statusTone }])
          }, [
            g("div", Mc, [
              g("div", Ec, [
                g("img", {
                  src: c.logo,
                  alt: c.displayName,
                  class: "oxm-provider-card__logo"
                }, null, 8, Oc),
                g("div", kc, [
                  g("strong", null, R(c.displayName), 1),
                  c.active ? (j(), q("span", Dc, R(M.value ? "主服务商" : "Main"), 1)) : ge("", !0)
                ])
              ]),
              g("div", Lc, [
                g("button", {
                  type: "button",
                  class: "oxm-icon-btn",
                  title: M.value ? "复制为新卡" : "Duplicate",
                  onClick: (p) => K(c.id)
                }, [...l[25] || (l[25] = [
                  g("i", { class: "fa-solid fa-copy" }, null, -1)
                ])], 8, Fc),
                c.hasWebsite ? (j(), q("button", {
                  key: 0,
                  type: "button",
                  class: "oxm-icon-btn",
                  title: M.value ? "获取 API Key" : "Get API Key",
                  onClick: (p) => W(c.id)
                }, [...l[26] || (l[26] = [
                  g("i", { class: "fa-solid fa-key" }, null, -1)
                ])], 8, Vc)) : ge("", !0),
                g("button", {
                  type: "button",
                  class: "oxm-icon-btn oxm-icon-btn--accent",
                  title: M.value ? "拉取模型列表" : "Fetch model list",
                  disabled: c.isValidating,
                  onClick: (p) => D(c.id)
                }, [...l[27] || (l[27] = [
                  g("i", { class: "fa-solid fa-magnifying-glass" }, null, -1)
                ])], 8, Rc),
                g("button", {
                  type: "button",
                  class: "oxm-icon-btn oxm-icon-btn--danger",
                  title: M.value ? "删除" : "Delete",
                  onClick: (p) => J(c.id)
                }, [...l[28] || (l[28] = [
                  g("i", { class: "fa-solid fa-trash" }, null, -1)
                ])], 8, Nc)
              ])
            ]),
            g("div", $c, [
              g("div", Bc, [
                g("label", null, [
                  g("span", null, R(M.value ? "API 地址" : "API URL"), 1),
                  g("button", {
                    type: "button",
                    class: "oxm-field-copy",
                    title: M.value ? "复制" : "Copy",
                    onClick: (p) => w(c.url)
                  }, [...l[29] || (l[29] = [
                    g("i", { class: "fa-solid fa-copy" }, null, -1)
                  ])], 8, Kc)
                ]),
                g("input", {
                  type: "text",
                  value: c.url,
                  placeholder: (M.value, "https://api.example.com/v1"),
                  onInput: (p) => S(c.id, "url", p)
                }, null, 40, Hc)
              ]),
              g("div", jc, [
                g("label", null, [
                  g("span", null, R(M.value ? "API 密钥" : "API Key"), 1),
                  g("button", {
                    type: "button",
                    class: "oxm-field-copy",
                    title: M.value ? "复制" : "Copy",
                    onClick: (p) => w(c.apiKey)
                  }, [...l[30] || (l[30] = [
                    g("i", { class: "fa-solid fa-copy" }, null, -1)
                  ])], 8, Uc)
                ]),
                g("div", Wc, [
                  g("input", {
                    type: G.value[c.id] ? "text" : "password",
                    value: c.apiKey,
                    placeholder: (M.value, "sk-..."),
                    onInput: (p) => S(c.id, "apiKey", p)
                  }, null, 40, qc),
                  g("button", {
                    type: "button",
                    class: "oxm-input-affix",
                    title: G.value[c.id] ? M.value ? "隐藏" : "Hide" : M.value ? "显示" : "Show",
                    onClick: (p) => ue(c.id)
                  }, [
                    g("i", {
                      class: Ie(G.value[c.id] ? "fa-solid fa-eye-slash" : "fa-solid fa-eye")
                    }, null, 2)
                  ], 8, Gc)
                ])
              ]),
              g("div", Jc, [
                g("label", null, [
                  g("span", null, R(M.value ? "模型 ID（可手动填写）" : "Model ID (manual or list)"), 1),
                  g("button", {
                    type: "button",
                    class: "oxm-field-copy",
                    title: M.value ? "复制" : "Copy",
                    onClick: (p) => w(c.modelId)
                  }, [...l[31] || (l[31] = [
                    g("i", { class: "fa-solid fa-copy" }, null, -1)
                  ])], 8, Yc)
                ]),
                !c.rawModels || !c.rawModels.length ? (j(), q("input", {
                  key: 0,
                  type: "text",
                  value: c.modelId,
                  placeholder: M.value ? "点击放大镜可获取模型列表" : "Type or click the search icon to fetch",
                  onInput: (p) => S(c.id, "modelId", p)
                }, null, 40, zc)) : (j(), q("div", Xc, [
                  g("input", {
                    type: "text",
                    value: c.modelId,
                    placeholder: M.value ? "选择或输入模型" : "Select or type a model",
                    onInput: (p) => S(c.id, "modelId", p)
                  }, null, 40, Qc),
                  g("details", Zc, [
                    l[32] || (l[32] = g("summary", null, [
                      g("i", { class: "fa-solid fa-chevron-down" })
                    ], -1)),
                    g("div", eu, [
                      (j(!0), q(_e, null, bt(c.rawModels, (p) => (j(), q("button", {
                        key: `${c.id}-${p.value}`,
                        type: "button",
                        class: Ie(["oxm-model-list__item", { "is-active": c.modelId === p.value }]),
                        onClick: (_) => E(c.id, p.value)
                      }, R(p.label), 11, tu))), 128))
                    ])
                  ])
                ]))
              ]),
              c.validationMessage ? (j(), q("div", {
                key: 0,
                class: Ie(["oxm-validation", `is-${c.validationStatus || "success"}`])
              }, [
                l[33] || (l[33] = g("i", { class: "fa-solid fa-circle-info" }, null, -1)),
                g("span", null, R(c.validationMessage), 1)
              ], 2)) : ge("", !0),
              c.active ? ge("", !0) : (j(), q("div", nu, [
                g("button", {
                  type: "button",
                  class: "oxm-secondary-btn",
                  onClick: (p) => O(c.id)
                }, [
                  l[34] || (l[34] = g("i", { class: "fa-solid fa-circle-check" }, null, -1)),
                  g("span", null, R(M.value ? "设为主服务商" : "Set as main"), 1)
                ], 8, iu)
              ]))
            ])
          ], 2))), 128)),
          g("button", {
            type: "button",
            class: "oxm-provider-card oxm-provider-card--add",
            onClick: b
          }, [
            l[35] || (l[35] = g("div", { class: "oxm-add-tile__plus" }, [
              g("i", { class: "fa-solid fa-plus" })
            ], -1)),
            g("span", ru, R(M.value ? "添加新供应商" : "Add New Provider"), 1)
          ])
        ]),
        ge("", !0)
      ])) : H.value ? (j(), q("div", ou, [
        g("div", su, [
          g("div", null, [
            g("h2", null, R(H.value.label), 1),
            g("p", null, R(H.value.selectedProviderName), 1)
          ]),
          g("span", lu, R(H.value.selectedProviderStatus), 1)
        ]),
        g("div", au, [
          g("label", cu, [
            g("span", null, R(M.value ? "绑定供应商" : "Provider"), 1),
            g("select", {
              value: H.value.selectedProvider,
              onChange: l[4] || (l[4] = (c) => De(H.value.id, c))
            }, [
              g("option", fu, R(M.value ? "请选择供应商" : "Select provider"), 1),
              (j(!0), q(_e, null, bt(H.value.providerOptions, (c) => (j(), q("option", {
                key: c.value,
                value: c.value
              }, R(c.label), 9, du))), 128))
            ], 40, uu)
          ]),
          g("label", pu, [
            g("span", null, R(M.value ? "模型 ID" : "Model ID"), 1),
            g("input", {
              value: H.value.model,
              type: "text",
              onInput: l[5] || (l[5] = (c) => Re(H.value.id, "model", c))
            }, null, 40, gu)
          ]),
          H.value.providerModels && H.value.providerModels.length ? (j(), q("div", hu, [
            (j(!0), q(_e, null, bt(H.value.providerModels, (c) => (j(), q("button", {
              key: `${H.value.id}-${c.value}`,
              type: "button",
              class: Ie(["ox-vite-model-chip ox-vite-model-chip--button", { active: H.value.model === c.value }]),
              onClick: (p) => Wn(H.value.id, c.value)
            }, R(c.label), 11, vu))), 128))
          ])) : ge("", !0),
          g("label", mu, [
            l[45] || (l[45] = g("span", null, "Base URL", -1)),
            g("input", {
              value: H.value.base_url,
              type: "text",
              onInput: l[6] || (l[6] = (c) => Re(H.value.id, "base_url", c))
            }, null, 40, yu)
          ]),
          g("label", _u, [
            l[46] || (l[46] = g("span", null, "API Key", -1)),
            g("input", {
              value: H.value.api_key,
              type: "password",
              onInput: l[7] || (l[7] = (c) => Re(H.value.id, "api_key", c))
            }, null, 40, bu)
          ]),
          H.value.temperature !== void 0 ? (j(), q("label", Su, [
            l[47] || (l[47] = g("span", null, "Temperature", -1)),
            g("input", {
              value: H.value.temperature,
              type: "number",
              min: "0",
              max: "2",
              step: "0.1",
              onInput: l[8] || (l[8] = (c) => Re(H.value.id, "temperature", c))
            }, null, 40, xu)
          ])) : ge("", !0),
          H.value.max_tokens !== void 0 ? (j(), q("label", Pu, [
            l[48] || (l[48] = g("span", null, "Max Tokens", -1)),
            g("input", {
              value: H.value.max_tokens,
              type: "number",
              min: "1",
              step: "1",
              onInput: l[9] || (l[9] = (c) => Re(H.value.id, "max_tokens", c))
            }, null, 40, Cu)
          ])) : ge("", !0),
          H.value.top_p !== void 0 ? (j(), q("label", Tu, [
            l[49] || (l[49] = g("span", null, "Top P", -1)),
            g("input", {
              value: H.value.top_p,
              type: "number",
              min: "0",
              max: "1",
              step: "0.05",
              onInput: l[10] || (l[10] = (c) => Re(H.value.id, "top_p", c))
            }, null, 40, Au)
          ])) : ge("", !0),
          H.value.reasoning_effort !== void 0 ? (j(), q("label", wu, [
            g("span", null, R(M.value ? "推理强度" : "Reasoning Effort"), 1),
            g("input", {
              value: H.value.reasoning_effort || "",
              type: "text",
              onInput: l[11] || (l[11] = (c) => Re(H.value.id, "reasoning_effort", c))
            }, null, 40, Iu)
          ])) : ge("", !0),
          H.value.enabled !== null ? (j(), q("label", Mu, [
            g("span", null, [
              g("strong", null, R(M.value ? "启用该模型槽位" : "Enable this slot"), 1),
              g("small", null, R(M.value ? "关闭后当前工作流不会主动使用该模型" : "The current workflow will not actively use this slot when disabled."), 1)
            ]),
            g("input", {
              checked: H.value.enabled,
              type: "checkbox",
              onChange: l[12] || (l[12] = (c) => Re(H.value.id, "enabled", c))
            }, null, 40, Eu)
          ])) : ge("", !0)
        ])
      ])) : ge("", !0),
      (j(), Ho(el, { to: "body" }, [
        g("dialog", {
          ref_key: "providerDialogRef",
          ref: i,
          class: "oxm-dialog-mask",
          "aria-labelledby": "oxm-provider-title",
          onCancel: Dr(T, ["prevent"]),
          onClick: Dr(T, ["self"])
        }, [
          g("div", Ou, [
            g("div", ku, [
              g("h2", Du, R(M.value ? "添加新供应商" : "Add New Provider"), 1),
              g("button", {
                type: "button",
                class: "oxm-icon-btn",
                disabled: r.value,
                title: M.value ? "关闭" : "Close",
                onClick: T
              }, [...l[50] || (l[50] = [
                g("i", { class: "fa-solid fa-xmark" }, null, -1)
              ])], 8, Lu)
            ]),
            g("div", Fu, [
              g("div", Vu, [
                g("div", Ru, [
                  l[51] || (l[51] = g("i", { class: "fa-solid fa-magnifying-glass" }, null, -1)),
                  qs(g("input", {
                    "onUpdate:modelValue": l[13] || (l[13] = (c) => N.value = c),
                    autofocus: "",
                    type: "text",
                    placeholder: M.value ? "搜索供应商" : "Search providers"
                  }, null, 8, Nu), [
                    [Ea, N.value]
                  ])
                ]),
                g("div", $u, [
                  g("button", {
                    type: "button",
                    class: Ie({ "is-active": U.value === "all" }),
                    onClick: l[14] || (l[14] = (c) => U.value = "all")
                  }, R(M.value ? "全部" : "All"), 3),
                  g("button", {
                    type: "button",
                    class: Ie({ "is-active": U.value === "cloud" }),
                    onClick: l[15] || (l[15] = (c) => U.value = "cloud")
                  }, R(M.value ? "云端" : "Cloud"), 3),
                  g("button", {
                    type: "button",
                    class: Ie({ "is-active": U.value === "local" }),
                    onClick: l[16] || (l[16] = (c) => U.value = "local")
                  }, R(M.value ? "本地" : "Local"), 3)
                ])
              ]),
              g("div", Bu, [
                (j(!0), q(_e, null, bt(Ze.value, (c) => (j(), q("button", {
                  key: c.value,
                  type: "button",
                  class: Ie(["oxm-vendor-card", { "is-selected": c.selected, "is-custom": c.isCustom }]),
                  onClick: (p) => Y(c.value)
                }, [
                  g("div", Hu, [
                    g("img", {
                      src: c.logo,
                      alt: c.label
                    }, null, 8, ju)
                  ]),
                  g("span", Uu, R(c.label), 1)
                ], 10, Ku))), 128)),
                fe.value.length ? ge("", !0) : (j(), q("div", Wu, [
                  l[52] || (l[52] = g("i", { class: "fa-solid fa-circle-info" }, null, -1)),
                  g("span", null, R(M.value ? "没有匹配的供应商" : "No matching providers"), 1)
                ]))
              ]),
              ne.value > 1 ? (j(), q("div", qu, [
                g("button", {
                  type: "button",
                  class: "oxm-pager__btn",
                  disabled: z.value <= 1,
                  title: M.value ? "上一页" : "Previous",
                  onClick: l[17] || (l[17] = (c) => ft(z.value - 1))
                }, [...l[53] || (l[53] = [
                  g("i", { class: "fa-solid fa-chevron-left" }, null, -1)
                ])], 8, Gu),
                g("div", Ju, [
                  (j(!0), q(_e, null, bt(ne.value, (c) => (j(), q("button", {
                    key: `vendor-page-${c}`,
                    type: "button",
                    class: Ie(["oxm-pager__page", { "is-active": z.value === c }]),
                    onClick: (p) => ft(c)
                  }, R(c), 11, Yu))), 128))
                ]),
                g("button", {
                  type: "button",
                  class: "oxm-pager__btn",
                  disabled: z.value >= ne.value,
                  title: M.value ? "下一页" : "Next",
                  onClick: l[18] || (l[18] = (c) => ft(z.value + 1))
                }, [...l[54] || (l[54] = [
                  g("i", { class: "fa-solid fa-chevron-right" }, null, -1)
                ])], 8, zu),
                g("span", Xu, R(fe.value.length) + " " + R(M.value ? "个供应商" : "providers"), 1)
              ])) : ge("", !0),
              we.value ? (j(), q("div", Qu, [
                g("div", Zu, [
                  g("img", {
                    src: we.value.logo,
                    alt: we.value.label
                  }, null, 8, ef),
                  g("div", null, [
                    g("strong", null, R(we.value.label), 1),
                    we.value.isCustom ? (j(), q("p", tf, R(M.value ? "自定义 OpenAI 兼容入口，与 OpenXnet 订阅中心绑定。" : "Custom OpenAI-compatible endpoint, bound to OpenXnet subscription."), 1)) : (j(), q("p", nf, R(M.value ? "已为你预填该供应商默认地址，填入 API Key 即可使用。" : "Default URL pre-filled. Provide an API key to start using it."), 1))
                  ]),
                  he.value.websiteUrl ? (j(), q("a", {
                    key: 0,
                    href: "javascript:void(0)",
                    class: "oxm-dialog__form-link",
                    onClick: de
                  }, [
                    l[55] || (l[55] = g("i", { class: "fa-solid fa-key" }, null, -1)),
                    g("span", null, R(M.value ? "获取 API Key" : "Get API key"), 1)
                  ])) : ge("", !0)
                ]),
                g("div", rf, [
                  g("label", of, [
                    g("span", null, R(M.value ? "API 地址" : "API URL") + R(we.value.isCustom ? " *" : ""), 1),
                    g("input", {
                      type: "text",
                      value: he.value.url,
                      placeholder: (M.value, "https://api.example.com/v1"),
                      onInput: l[19] || (l[19] = (c) => X("url", c))
                    }, null, 40, sf)
                  ]),
                  g("label", lf, [
                    g("span", null, R(M.value ? "API 密钥" : "API Key"), 1),
                    g("input", {
                      type: "password",
                      value: he.value.apiKey,
                      placeholder: M.value ? "可选，先添加再去填写" : "Optional, can be filled later",
                      onInput: l[20] || (l[20] = (c) => X("apiKey", c))
                    }, null, 40, af)
                  ]),
                  g("label", cf, [
                    g("span", null, R(M.value ? "默认模型 ID（可选）" : "Default Model ID (optional)"), 1),
                    g("input", {
                      type: "text",
                      value: he.value.modelId,
                      placeholder: M.value ? "可留空，添加后可拉取模型列表" : "Optional, fetch models after adding",
                      onInput: l[21] || (l[21] = (c) => X("modelId", c))
                    }, null, 40, uf)
                  ])
                ])
              ])) : ge("", !0),
              o.value ? (j(), q("p", ff, R(o.value), 1)) : ge("", !0)
            ]),
            g("div", df, [
              g("button", {
                type: "button",
                class: "oxm-secondary-btn",
                disabled: r.value,
                onClick: T
              }, R(M.value ? "取消" : "Cancel"), 9, pf),
              g("button", {
                type: "button",
                class: "oxm-primary-btn",
                disabled: !he.value.vendor || r.value,
                onClick: ie
              }, [
                l[56] || (l[56] = g("i", { class: "fa-solid fa-check" }, null, -1)),
                g("span", null, R(r.value ? M.value ? "正在保存…" : "Saving…" : M.value ? "确认添加" : "Confirm"), 1)
              ], 8, gf)
            ])
          ])
        ], 544)
      ]))
    ]));
  }
};
function bi() {
  const e = document.getElementById("openxnet-vite-model-root");
  !e || e.dataset.viteMounted === "true" || (Fa(hf).mount(e), e.dataset.viteMounted = "true");
}
document.readyState === "loading" ? document.addEventListener("DOMContentLoaded", bi, { once: !0 }) : bi();
window.addEventListener("openxnet-vite-model-remount", bi);
